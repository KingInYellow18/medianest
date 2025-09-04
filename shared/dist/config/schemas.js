"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConfigValidator = exports.formatValidationError = exports.TestConfigSchema = exports.FrontendConfigSchema = exports.BackendConfigSchema = exports.DockerSecretsSchema = exports.MonitoringConfigSchema = exports.ServiceEndpointsSchema = exports.ServerConfigSchema = exports.AdminConfigSchema = exports.YouTubeConfigSchema = exports.RateLimitConfigSchema = exports.EncryptionConfigSchema = exports.PlexConfigSchema = exports.NextAuthConfigSchema = exports.JWTConfigSchema = exports.RedisConfigSchema = exports.DatabaseConfigSchema = exports.BaseConfigSchema = exports.LogLevelSchema = exports.EnvironmentSchema = void 0;
const zod_1 = require("zod");
exports.EnvironmentSchema = zod_1.z.enum(['development', 'test', 'production']);
exports.LogLevelSchema = zod_1.z.enum(['error', 'warn', 'info', 'debug']);
exports.BaseConfigSchema = zod_1.z.object({
    NODE_ENV: exports.EnvironmentSchema.default('development'),
    LOG_LEVEL: exports.LogLevelSchema.default('info'),
});
exports.DatabaseConfigSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().url('Invalid database URL').min(1, 'Database URL is required'),
    DATABASE_POOL_SIZE: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    DATABASE_TIMEOUT: zod_1.z.coerce.number().int().min(1000).default(30000),
});
exports.RedisConfigSchema = zod_1.z.object({
    REDIS_URL: zod_1.z.string().url('Invalid Redis URL').optional(),
    REDIS_HOST: zod_1.z.string().min(1).default('localhost'),
    REDIS_PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(6379),
    REDIS_PASSWORD: zod_1.z.string().optional(),
    REDIS_USERNAME: zod_1.z.string().optional(),
    REDIS_DATABASE: zod_1.z.coerce.number().int().min(0).max(15).default(0),
    REDIS_TLS: zod_1.z.coerce.boolean().default(false),
});
exports.JWTConfigSchema = zod_1.z.object({
    JWT_SECRET: zod_1.z.string().min(32, 'JWT secret must be at least 32 characters'),
    JWT_ISSUER: zod_1.z.string().min(1).default('medianest'),
    JWT_AUDIENCE: zod_1.z.string().min(1).default('medianest-api'),
    JWT_EXPIRES_IN: zod_1.z
        .string()
        .regex(/^\d+[smhd]$/, 'Invalid JWT expiration format')
        .default('7d'),
});
exports.NextAuthConfigSchema = zod_1.z.object({
    NEXTAUTH_URL: zod_1.z.string().url('Invalid NextAuth URL'),
    NEXTAUTH_SECRET: zod_1.z.string().min(32, 'NextAuth secret must be at least 32 characters'),
});
exports.PlexConfigSchema = zod_1.z.object({
    PLEX_CLIENT_ID: zod_1.z.string().min(1, 'Plex client ID is required'),
    PLEX_CLIENT_SECRET: zod_1.z.string().min(1, 'Plex client secret is required'),
    PLEX_CLIENT_IDENTIFIER: zod_1.z.string().optional(),
    PLEX_SERVER_URL: zod_1.z.string().url('Invalid Plex server URL').optional(),
});
exports.EncryptionConfigSchema = zod_1.z.object({
    ENCRYPTION_KEY: zod_1.z.string().min(32, 'Encryption key must be at least 32 characters'),
});
exports.RateLimitConfigSchema = zod_1.z.object({
    RATE_LIMIT_API_REQUESTS: zod_1.z.coerce.number().int().min(1).default(100),
    RATE_LIMIT_API_WINDOW: zod_1.z.coerce.number().int().min(1).default(60),
    RATE_LIMIT_YOUTUBE_REQUESTS: zod_1.z.coerce.number().int().min(1).default(5),
    RATE_LIMIT_YOUTUBE_WINDOW: zod_1.z.coerce.number().int().min(1).default(3600),
    RATE_LIMIT_MEDIA_REQUESTS: zod_1.z.coerce.number().int().min(1).default(20),
    RATE_LIMIT_MEDIA_WINDOW: zod_1.z.coerce.number().int().min(1).default(3600),
});
exports.YouTubeConfigSchema = zod_1.z.object({
    YOUTUBE_DOWNLOAD_PATH: zod_1.z.string().min(1).default('/app/youtube'),
    YOUTUBE_MAX_CONCURRENT_DOWNLOADS: zod_1.z.coerce.number().int().min(1).max(10).default(3),
    YOUTUBE_RATE_LIMIT: zod_1.z.coerce.number().int().min(1).default(5),
});
exports.AdminConfigSchema = zod_1.z.object({
    ADMIN_USERNAME: zod_1.z.string().min(1).default('admin'),
    ADMIN_PASSWORD: zod_1.z.string().min(1).default('admin'),
});
exports.ServerConfigSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(4000),
    HOST: zod_1.z.string().default('0.0.0.0'),
    FRONTEND_URL: zod_1.z.string().url('Invalid frontend URL').default('http://localhost:3000'),
    BACKEND_URL: zod_1.z.string().url('Invalid backend URL').default('http://localhost:4000'),
    API_PREFIX: zod_1.z.string().default('/api'),
    API_VERSION: zod_1.z.string().default('v1'),
});
exports.ServiceEndpointsSchema = zod_1.z.object({
    OVERSEERR_URL: zod_1.z.string().url('Invalid Overseerr URL').optional(),
    OVERSEERR_API_KEY: zod_1.z.string().optional(),
    UPTIME_KUMA_URL: zod_1.z.string().url('Invalid Uptime Kuma URL').optional(),
    UPTIME_KUMA_TOKEN: zod_1.z.string().optional(),
    PLEX_URL: zod_1.z.string().url('Invalid Plex URL').optional(),
});
exports.MonitoringConfigSchema = zod_1.z.object({
    METRICS_TOKEN: zod_1.z.string().optional(),
    METRICS_ENDPOINT: zod_1.z.string().url('Invalid metrics endpoint').optional(),
    ERROR_REPORTING_ENDPOINT: zod_1.z.string().url('Invalid error reporting endpoint').optional(),
    HEALTH_CHECK_INTERVAL: zod_1.z.coerce.number().int().min(1000).default(30000),
});
exports.DockerSecretsSchema = zod_1.z.object({
    DOCKER_SECRETS_PATH: zod_1.z.string().default('/run/secrets'),
    USE_DOCKER_SECRETS: zod_1.z.coerce.boolean().default(false),
});
exports.BackendConfigSchema = exports.BaseConfigSchema.merge(exports.DatabaseConfigSchema)
    .merge(exports.RedisConfigSchema)
    .merge(exports.JWTConfigSchema)
    .merge(exports.PlexConfigSchema)
    .merge(exports.EncryptionConfigSchema)
    .merge(exports.RateLimitConfigSchema)
    .merge(exports.YouTubeConfigSchema)
    .merge(exports.AdminConfigSchema)
    .merge(exports.ServerConfigSchema)
    .merge(exports.ServiceEndpointsSchema)
    .merge(exports.MonitoringConfigSchema)
    .merge(exports.DockerSecretsSchema);
exports.FrontendConfigSchema = exports.BaseConfigSchema.merge(exports.NextAuthConfigSchema)
    .merge(zod_1.z.object({
    NEXT_PUBLIC_API_URL: zod_1.z.string().url('Invalid API URL').default('http://localhost:4000/api'),
    NEXT_PUBLIC_BACKEND_URL: zod_1.z
        .string()
        .url('Invalid backend URL')
        .default('http://localhost:4000'),
    NEXT_PUBLIC_WS_URL: zod_1.z.string().url('Invalid WebSocket URL').default('ws://localhost:4000'),
    NEXT_PUBLIC_PLEX_URL: zod_1.z.string().url('Invalid Plex URL').optional(),
    NEXT_PUBLIC_OVERSEERR_URL: zod_1.z.string().url('Invalid Overseerr URL').optional(),
    NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT: zod_1.z
        .string()
        .url('Invalid error reporting endpoint')
        .optional(),
    NEXT_PUBLIC_APP_NAME: zod_1.z.string().default('MediaNest'),
    NEXT_PUBLIC_APP_VERSION: zod_1.z.string().default('1.0.0'),
}))
    .merge(exports.PlexConfigSchema.pick({ PLEX_CLIENT_ID: true, PLEX_CLIENT_SECRET: true }));
exports.TestConfigSchema = exports.BackendConfigSchema.merge(zod_1.z.object({
    TEST_DATABASE_URL: zod_1.z.string().url('Invalid test database URL').optional(),
    TEST_REDIS_URL: zod_1.z.string().url('Invalid test Redis URL').optional(),
    TEST_PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(4001),
    TEST_TIMEOUT: zod_1.z.coerce.number().int().min(1000).default(30000),
}));
const formatValidationError = (error) => {
    const issues = error.issues.map((issue) => {
        const path = issue.path.join('.');
        return `${path}: ${issue.message}`;
    });
    return `Configuration validation failed:\n${issues.join('\n')}`;
};
exports.formatValidationError = formatValidationError;
const createConfigValidator = (schema) => {
    return (env) => {
        try {
            return schema.parse(env);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                throw new Error((0, exports.formatValidationError)(error));
            }
            throw error;
        }
    };
};
exports.createConfigValidator = createConfigValidator;
//# sourceMappingURL=schemas.js.map