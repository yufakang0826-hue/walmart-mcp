import axios from 'axios';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { type WalmartConfig, getBaseUrl } from '../config/environment.js';
import { authLogger } from '../utils/logger.js';

export class WalmartOAuthClient {
  private accessToken: string | null = null;
  private tokenExpiry = 0;
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  constructor(private config: WalmartConfig) {}

  async initialize(): Promise<void> {
    if (this.config.accessToken && this.config.accessTokenExpiry) {
      this.accessToken = this.config.accessToken;
      this.tokenExpiry = this.config.accessTokenExpiry;

      if (Date.now() < this.tokenExpiry - 120_000) {
        authLogger.info('Loaded cached token from .env');
        return;
      }
    }

    try {
      await this.refreshToken();
    } catch (error) {
      authLogger.warn('Initial token fetch failed (credentials may not be configured yet)');
    }
  }

  async getAccessToken(): Promise<string> {
    // Token valid and more than 2 min remaining
    if (this.accessToken && Date.now() < this.tokenExpiry - 120_000) {
      return this.accessToken;
    }

    // Prevent concurrent refresh
    if (this.isRefreshing && this.refreshPromise) {
      await this.refreshPromise;
      return this.accessToken!;
    }

    await this.refreshToken();
    return this.accessToken!;
  }

  async refreshToken(): Promise<void> {
    this.isRefreshing = true;
    this.refreshPromise = this._doRefresh();
    try {
      await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async _doRefresh(): Promise<void> {
    const baseUrl = getBaseUrl(this.config.environment);
    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64');

    authLogger.info(`Requesting token from ${this.config.environment} environment`);

    try {
      const response = await axios.post(
        `${baseUrl}/v3/token`,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'WM_QOS.CORRELATION_ID': randomUUID(),
            'WM_SVC.NAME': this.config.svcName,
          },
          timeout: 15_000,
        },
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

      authLogger.info(`Token obtained, expires in ${response.data.expires_in}s`);

      this.updateEnvFile({
        WALMART_ACCESS_TOKEN: this.accessToken!,
        WALMART_ACCESS_TOKEN_EXPIRY: String(this.tokenExpiry),
      });
    } catch (error: unknown) {
      const msg = axios.isAxiosError(error)
        ? error.response?.data?.error_description || error.message
        : String(error);
      authLogger.error(`Token refresh failed: ${msg}`);
      throw new Error(`Authentication failed: ${msg}`);
    }
  }

  async getTokenDetail(): Promise<object> {
    const token = await this.getAccessToken();
    const baseUrl = getBaseUrl(this.config.environment);

    const response = await axios.get(`${baseUrl}/v3/token/detail`, {
      headers: {
        'WM_SEC.ACCESS_TOKEN': token,
        'WM_QOS.CORRELATION_ID': randomUUID(),
        'WM_SVC.NAME': this.config.svcName,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });

    return response.data;
  }

  getTokenInfo(): object {
    return {
      hasToken: !!this.accessToken,
      expiresAt: this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : null,
      expiresInSeconds: this.tokenExpiry
        ? Math.max(0, Math.round((this.tokenExpiry - Date.now()) / 1000))
        : 0,
      environment: this.config.environment,
    };
  }

  private updateEnvFile(updates: Record<string, string>): void {
    try {
      const envPath = join(process.cwd(), '.env');
      let content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';

      for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^(#\\s*)?${key}=.*$`, 'gm');
        const newLine = `${key}=${value}`;

        if (regex.test(content)) {
          content = content.replace(regex, newLine);
        } else {
          content += `\n${newLine}`;
        }
      }

      writeFileSync(envPath, content, 'utf-8');
    } catch {
      // Silent failure - don't interfere with MCP stdout
    }
  }
}
