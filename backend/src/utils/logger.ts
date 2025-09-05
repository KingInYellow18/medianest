// Emergency production-ready logger - no file operations in test mode
const mockLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  child: () => mockLogger,
};

export const logger = process.env.NODE_ENV === 'test' ? mockLogger : require('./logger.ts.backup');

export function createChildLogger(correlationId?: string): any {
  return logger.child ? logger.child({ correlationId }) : mockLogger;
}

export const stream = {
  write: () => {},
};

export { logger as default };