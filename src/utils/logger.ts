import winston from 'winston';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';

const LOG_DIR = join(homedir(), '.walmart-mcp', 'logs');
const LOG_LEVEL = process.env.WALMART_LOG_LEVEL || 'info';
const ENABLE_FILE_LOGGING = process.env.WALMART_ENABLE_FILE_LOGGING === 'true';

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }),
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat,
    stderrLevels: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
  }),
];

if (ENABLE_FILE_LOGGING) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
  } catch { /* ignore */ }

  transports.push(
    new winston.transports.File({
      filename: join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: join(LOG_DIR, 'combined.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  );
}

const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports,
  exitOnError: false,
});

interface ComponentLogger {
  error: (msg: string, meta?: object) => void;
  warn: (msg: string, meta?: object) => void;
  info: (msg: string, meta?: object) => void;
  debug: (msg: string, meta?: object) => void;
  http: (msg: string, meta?: object) => void;
}

export function createLogger(component: string): ComponentLogger {
  return {
    error: (msg, meta?) => logger.error(`[${component}] ${msg}`, meta),
    warn: (msg, meta?) => logger.warn(`[${component}] ${msg}`, meta),
    info: (msg, meta?) => logger.info(`[${component}] ${msg}`, meta),
    debug: (msg, meta?) => logger.debug(`[${component}] ${msg}`, meta),
    http: (msg, meta?) => logger.http(`[${component}] ${msg}`, meta),
  };
}

export const serverLogger = createLogger('Server');
export const apiLogger = createLogger('API');
export const authLogger = createLogger('Auth');
export const toolLogger = createLogger('Tool');
export const feedLogger = createLogger('Feed');

export function truncateData(data: unknown, maxLen = 1000): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return str.length > maxLen ? str.substring(0, maxLen) + '...[truncated]' : str;
}
