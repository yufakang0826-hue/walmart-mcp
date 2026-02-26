import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { randomUUID } from 'crypto';
import { type WalmartConfig, getBaseUrl } from '../config/environment.js';
import { WalmartOAuthClient } from '../auth/oauth.js';
import { apiLogger, truncateData } from '../utils/logger.js';

export class WalmartApiClient {
  private http: AxiosInstance;
  private authClient: WalmartOAuthClient;

  constructor(private config: WalmartConfig) {
    this.authClient = new WalmartOAuthClient(config);

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

  private setupInterceptors(): void {
    // ===== Request Interceptor =====
    this.http.interceptors.request.use(
      async (reqConfig: InternalAxiosRequestConfig) => {
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

        // 429: Rate limit exceeded
        if (status === 429) {
          const retryAfter = error.response.headers['retry-after'] || '60';
          apiLogger.warn(`429 Rate limit - retry after ${retryAfter}s`);
          throw new Error(
            `Rate limit exceeded. Retry after ${retryAfter} seconds. ` +
            `Remaining tokens: ${error.response.headers['x-current-token-count'] || 'unknown'}`,
          );
        }

        // 423: Resource locked - retry once after 60s
        if (status === 423 && !config.__lockRetried) {
          config.__lockRetried = true;
          apiLogger.warn('423 Resource locked - retrying in 60s');
          await new Promise((r) => setTimeout(r, 60_000));
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

        // Parse Walmart error response
        const walmartError = error.response.data?.errors?.[0];
        const errorMsg = walmartError
          ? `${walmartError.code}: ${walmartError.description || walmartError.message}`
          : `HTTP ${status}: ${error.response.statusText}`;

        apiLogger.error(`API Error: ${errorMsg}`, {
          url: config.url,
          status,
          response: truncateData(error.response.data),
        });

        throw new Error(errorMsg);
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
