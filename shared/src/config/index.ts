// Config exports for shared package
export * from './schemas';
export * from './utils';

export interface ConfigurationOptions {
  environment: 'development' | 'test' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export const createConfiguration = (options: ConfigurationOptions) => {
  return {
    ...options,
    created: new Date().toISOString(),
  };
};

export const environmentLoader = {
  getEnvironment: (): string => {
    return process.env.NODE_ENV || 'development';
  },
};
