// Simple logger utility for shared package
export interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

// Simple console-based logger for shared package
export const logger: Logger = {
  info: (message: string, meta?: any) => {
    if (meta) {
    } else {
    }
  },
  warn: (message: string, meta?: any) => {
    if (meta) {
      logger.warn(`[WARN] ${message}`, meta);
    } else {
      logger.warn(`[WARN] ${message}`);
    }
  },
  error: (message: string, meta?: any) => {
    if (meta) {
    } else {
    }
  },
  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      if (meta) {
      } else {
      }
    }
  },
};
