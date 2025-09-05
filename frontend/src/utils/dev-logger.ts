/**
 * Development-only logging utility
 * This will only log in development mode to prevent production console spam
 */

interface LogLevel {
  log: number;
  info: number;
  warn: number;
  error: number;
  debug: number;
}

const LOG_LEVELS: LogLevel = {
  debug: 0,
  log: 1,
  info: 2,
  warn: 3,
  error: 4,
};

class DevLogger {
  private isDev: boolean;
  private minLevel: number;

  constructor() {
    this.isDev = process.env.NODE_ENV === 'development';
    this.minLevel =
      LOG_LEVELS[process.env.NEXT_PUBLIC_LOG_LEVEL as keyof LogLevel] || LOG_LEVELS.info;
  }

  private shouldLog(level: keyof LogLevel): boolean {
    return this.isDev && LOG_LEVELS[level] >= this.minLevel;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  log(message: string, ...args: any[]): void {
    if (this.shouldLog('log')) {
      console.log(`[LOG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  // Special method for user actions that we want to track in development
  userAction(action: string, data?: any): void {
    if (this.shouldLog('log')) {
      console.log(`[USER_ACTION] ${action}`, data);
    }
  }

  // Method for API/service interactions
  service(service: string, action: string, data?: any): void {
    if (this.shouldLog('log')) {
      console.log(`[${service.toUpperCase()}] ${action}`, data);
    }
  }

  // Method for component lifecycle events
  component(component: string, event: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.debug(`[${component}] ${event}`, data);
    }
  }
}

// Create singleton instance
export const devLogger = new DevLogger();

// Export convenience methods
export const logDev = devLogger.log.bind(devLogger);
export const infoDev = devLogger.info.bind(devLogger);
export const warnDev = devLogger.warn.bind(devLogger);
export const errorDev = devLogger.error.bind(devLogger);
export const debugDev = devLogger.debug.bind(devLogger);
export const userActionDev = devLogger.userAction.bind(devLogger);
export const serviceDev = devLogger.service.bind(devLogger);
export const componentDev = devLogger.component.bind(devLogger);

export default devLogger;
