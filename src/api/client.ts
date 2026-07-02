import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { randomUUID } from 'crypto';
import { type WalmartConfig, getBaseUrl } from '../config/environment.js';
import { WalmartOAuthClient } from '../auth/oauth.js';
import { apiLogger, truncateData } from '../utils/logger.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { WalmartApiError, formatWalmartError } from '../utils/api-error.js';
import { findKnownIssueHint } from '../utils/known-issues.js';

export class WalmartApiClient {
  private http: AxiosInstance;
  private authClient: WalmartOAuthClient;
  private rateLimiter: RateLimiter;

  constructor(private config: WalmartConfig) {
    this.authClient = new WalmartOAuthClient(config);
    // Walmart token bucket: ~20 req/s, use 1000 req/60s as safe sliding window
    this.rateLimiter = new RateLimiter(1000, 60_000, 'marketplace');

    this.http = axios.create({
      baseURL: getBaseUrl(config.environment),
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  async initialize(): Promise<void> {
    await this.authClient.initialize();
  }

  getAuthClient(): WalmartOAuthClient {
    return this.authClient;
  }

  /** Expose the rate limiter so the rate-budget MCP tool can snapshot it. */
  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  private setupInterceptors(): void {
    // ===== Request Interceptor =====
    this.http.interceptors.request.use(
      async (reqConfig: InternalAxiosRequestConfig) => {
        // 0. Pre-flight rate limit check
        await this.rateLimiter.acquireAsync();

        // 1. Inject access token
        const token = await this.authClient.getAccessToken();
        reqConfig.headers['WM_SEC.ACCESS_TOKEN'] = token;

        // 2. Inject required Walmart headers
        reqConfig.headers['WM_QOS.CORRELATION_ID'] = randomUUID();
        reqConfig.headers['WM_SVC.NAME'] = this.config.svcName;

        // 3. Optional headers
        if (this.config.consumerChannelType) {
          reqConfig.headers['WM_CONSUMER.CHANNEL.TYPE'] = this.config.consumerChannelType;
        }
        if (this.config.market !== 'us') {
          reqConfig.headers['WM_MARKET'] = this.config.market;
        }

        apiLogger.http(`→ ${reqConfig.method?.toUpperCase()} ${reqConfig.url}`, {
          params: reqConfig.params,
        });

        return reqConfig;
      },
      (error) => {
        apiLogger.error('Request interceptor error', { error: String(error) });
        return Promise.reject(error);
      },
    );

    // ===== Response Interceptor =====
    this.http.interceptors.response.use(
      (response) => {
        const tokenCount = response.headers['x-current-token-count'];
        const replenish = response.headers['x-next-replenish-time'];
        // Update rate limiter from server headers
        this.rateLimiter.updateFromHeaders(response.headers as Record<string, string>);
        apiLogger.http(
          `← ${response.status} ${response.statusText}`,
          tokenCount ? { rateTokens: tokenCount, replenish } : undefined,
        );
        return response;
      },
      async (error) => {
        if (!axios.isAxiosError(error) || !error.response || !error.config) {
          throw error;
        }

        const status = error.response.status;
        const config = error.config as InternalAxiosRequestConfig & {
          __authRetried?: boolean;
          __lockRetried?: boolean;
          __retryCount?: number;
        };

        // 401: Refresh token + retry once
        if (status === 401 && !config.__authRetried) {
          config.__authRetried = true;
          apiLogger.warn('401 Unauthorized - refreshing token');
          await this.authClient.refreshToken();
          const newToken = await this.authClient.getAccessToken();
          config.headers['WM_SEC.ACCESS_TOKEN'] = newToken;
          return this.http.request(config);
        }

        // 429: Rate limit exceeded. If Walmart's retry-after is short enough
        // to fit inside a typical MCP tool-call budget (~60s), wait it out
        // and retry once instead of surfacing an error the caller can only
        // respond to by... waiting and retrying. Longer waits still throw.
        if (status === 429) {
          const retryAfterSec = parseInt(error.response.headers['retry-after'] || '60', 10) || 60;
          const shortEnough = retryAfterSec <= 30;
          if (shortEnough && !(config as { __rateRetried?: boolean }).__rateRetried) {
            (config as { __rateRetried?: boolean }).__rateRetried = true;
            apiLogger.warn(`429 Rate limit - auto-waiting ${retryAfterSec}s then retrying once`);
            await new Promise((r) => setTimeout(r, retryAfterSec * 1000));
            return this.http.request(config);
          }
          apiLogger.warn(`429 Rate limit - retry after ${retryAfterSec}s`);
          throw new Error(
            `Rate limit exceeded. Retry after ${retryAfterSec} seconds. ` +
            `Remaining tokens: ${error.response.headers['x-current-token-count'] || 'unknown'}` +
            (error.response.headers['x-next-replenish-time']
              ? `. Bucket replenishes at ${error.response.headers['x-next-replenish-time']}`
              : ''),
          );
        }

        // 423: Resource locked - retry once after 20s. (Was 60s, but a 60s
        // in-band sleep guarantees the surrounding MCP tool call gets killed
        // by the client's ~60s timeout before the retry even fires.)
        if (status === 423 && !config.__lockRetried) {
          config.__lockRetried = true;
          apiLogger.warn('423 Resource locked - retrying in 20s');
          await new Promise((r) => setTimeout(r, 20_000));
          return this.http.request(config);
        }

        // 5xx: Exponential backoff retry (max 3)
        if (status >= 500) {
          const retryCount = config.__retryCount || 0;
          if (retryCount < 3) {
            config.__retryCount = retryCount + 1;
            const delay = Math.pow(2, retryCount) * 1000;
            apiLogger.warn(`${status} Server error - retry ${retryCount + 1}/3 in ${delay}ms`);
            await new Promise((r) => setTimeout(r, delay));
            return this.http.request(config);
          }
        }

        // Parse Walmart error response, preserving the full body detail.
        const errorMsg = formatWalmartError(
          status,
          error.response.statusText,
          error.response.data,
        );

        // Build endpoint label for error context: "GET /v3/items?limit=5".
        const method = (config.method ?? 'GET').toUpperCase();
        const path = config.url ?? '';
        const endpoint = `${method} ${path}`;

        // Look up workaround hint for known-broken Walmart endpoints. Strip
        // the query string so URL parameters do not interfere with the regex
        // match.
        const pathForLookup = path.split('?')[0] ?? path;
        const hint = findKnownIssueHint(method, pathForLookup);

        apiLogger.error(`API Error: ${errorMsg}`, {
          url: config.url,
          status,
          response: truncateData(error.response.data),
          ...(hint ? { hint } : {}),
        });

        throw new WalmartApiError(errorMsg, status, error.response.data, endpoint, undefined, hint);
      },
    );
  }

  // ===== HTTP Methods =====

  async get<T = unknown>(endpoint: string, params?: object): Promise<T> {
    const response = await this.http.get<T>(endpoint, { params });
    return response.data;
  }

  async post<T = unknown>(endpoint: string, data?: object, config?: object): Promise<T> {
    const response = await this.http.post<T>(endpoint, data, config);
    return response.data;
  }

  async put<T = unknown>(endpoint: string, data?: object): Promise<T> {
    const response = await this.http.put<T>(endpoint, data);
    return response.data;
  }

  async delete<T = unknown>(endpoint: string, params?: object): Promise<T> {
    const response = await this.http.delete<T>(endpoint, { params });
    return response.data;
  }
}
