import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { createSign, randomUUID } from 'crypto';
import { type WalmartConfig, getAdBaseUrl } from '../../config/environment.js';
import { apiLogger, truncateData } from '../../utils/logger.js';

export class WalmartAdClient {
  private http: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(private config: WalmartConfig) {
    this.http = axios.create({
      baseURL: getAdBaseUrl(config.environment),
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private generateSignature(url: string, method: string, timestamp: string): string {
    if (!this.config.adPrivateKey) {
      throw new Error('WALMART_AD_PRIVATE_KEY is required for advertising API');
    }

    const stringToSign = `${this.config.adConsumerId}\n${url}\n${method.toUpperCase()}\n${timestamp}\n`;
    const sign = createSign('RSA-SHA256');
    sign.update(stringToSign);
    return sign.sign(this.config.adPrivateKey, 'base64');
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const tokenUrl = `${getAdBaseUrl(this.config.environment)}/v1/oauth/token`;
    const timestamp = Date.now().toString();
    const signature = this.generateSignature(tokenUrl, 'POST', timestamp);

    const response = await axios.post(tokenUrl, null, {
      headers: {
        'WM_CONSUMER.ID': this.config.adConsumerId,
        'WM_SEC.AUTH_SIGNATURE': signature,
        'WM_CONSUMER.INTIMESTAMP': timestamp,
        'WM_SEC.KEY_VERSION': this.config.adKeyVersion || '1',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      params: {
        grant_type: 'client_credentials',
      },
    });

    this.accessToken = response.data.access_token;
    this.tokenExpiry = Date.now() + (response.data.expires_in || 900) * 1000 - 120_000;
    apiLogger.info('Advertising token refreshed');
    return this.accessToken!;
  }

  private setupInterceptors(): void {
    this.http.interceptors.request.use(
      async (reqConfig: InternalAxiosRequestConfig) => {
        if (!this.config.adConsumerId || !this.config.adPrivateKey) {
          throw new Error(
            'Walmart Connect credentials not configured. Set WALMART_AD_CONSUMER_ID and WALMART_AD_PRIVATE_KEY.',
          );
        }

        const token = await this.getAccessToken();
        const timestamp = Date.now().toString();
        const fullUrl = `${reqConfig.baseURL || ''}${reqConfig.url || ''}`;
        const signature = this.generateSignature(
          fullUrl,
          reqConfig.method?.toUpperCase() || 'GET',
          timestamp,
        );

        reqConfig.headers['Authorization'] = `Bearer ${token}`;
        reqConfig.headers['WM_CONSUMER.ID'] = this.config.adConsumerId;
        reqConfig.headers['WM_SEC.AUTH_SIGNATURE'] = signature;
        reqConfig.headers['WM_CONSUMER.INTIMESTAMP'] = timestamp;
        reqConfig.headers['WM_QOS.CORRELATION_ID'] = randomUUID();
        reqConfig.headers['WM_SEC.KEY_VERSION'] = this.config.adKeyVersion || '1';

        apiLogger.http(`→ AD ${reqConfig.method?.toUpperCase()} ${reqConfig.url}`, {
          params: reqConfig.params,
        });

        return reqConfig;
      },
      (error) => {
        apiLogger.error('Ad request interceptor error', { error: String(error) });
        return Promise.reject(error);
      },
    );

    this.http.interceptors.response.use(
      (response) => {
        apiLogger.http(`← AD ${response.status} ${response.statusText}`);
        return response;
      },
      async (error) => {
        if (!axios.isAxiosError(error) || !error.response || !error.config) {
          throw error;
        }

        const status = error.response.status;
        const config = error.config as InternalAxiosRequestConfig & {
          __authRetried?: boolean;
          __retryCount?: number;
        };

        if (status === 401 && !config.__authRetried) {
          config.__authRetried = true;
          apiLogger.warn('AD 401 - refreshing token');
          this.accessToken = null;
          this.tokenExpiry = 0;
          return this.http.request(config);
        }

        if (status === 429) {
          const retryAfter = error.response.headers['retry-after'] || '60';
          throw new Error(`Advertising rate limit exceeded. Retry after ${retryAfter}s.`);
        }

        if (status >= 500) {
          const retryCount = config.__retryCount || 0;
          if (retryCount < 3) {
            config.__retryCount = retryCount + 1;
            const delay = Math.pow(2, retryCount) * 1000;
            apiLogger.warn(`AD ${status} - retry ${retryCount + 1}/3 in ${delay}ms`);
            await new Promise((r) => setTimeout(r, delay));
            return this.http.request(config);
          }
        }

        const errorMsg = error.response.data?.message
          || error.response.data?.errors?.[0]?.message
          || `AD HTTP ${status}: ${error.response.statusText}`;

        apiLogger.error(`AD API Error: ${errorMsg}`, {
          url: config.url,
          status,
          response: truncateData(error.response.data),
        });

        throw new Error(errorMsg);
      },
    );
  }

  async get<T = unknown>(endpoint: string, params?: object): Promise<T> {
    const response = await this.http.get<T>(endpoint, { params });
    return response.data;
  }

  async post<T = unknown>(endpoint: string, data?: object): Promise<T> {
    const response = await this.http.post<T>(endpoint, data);
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
