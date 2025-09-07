"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.environmentLoader = exports.configUtils = exports.EnvironmentConfigLoader = exports.CompositeEnvLoader = exports.DotenvLoader = exports.DockerSecretsLoader = exports.ProcessEnvLoader = void 0;
exports.createConfiguration = createConfiguration;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
class ProcessEnvLoader {
    load() {
        const env = {};
        for (const [key, value] of Object.entries(process.env)) {
            if (value !== undefined) {
                env[key] = value;
            }
        }
        return env;
    }
}
exports.ProcessEnvLoader = ProcessEnvLoader;
class DockerSecretsLoader {
    secretsPath;
    constructor(secretsPath = '/run/secrets') {
        this.secretsPath = secretsPath;
    }
    load() {
        const env = {};
        if (!fs_1.default.existsSync(this.secretsPath)) {
            return env;
        }
        try {
            const secretFiles = fs_1.default.readdirSync(this.secretsPath);
            for (const file of secretFiles) {
                const secretPath = path_1.default.join(this.secretsPath, file);
                if (fs_1.default.statSync(secretPath).isFile()) {
                    try {
                        const value = fs_1.default.readFileSync(secretPath, 'utf8').trim();
                        const envKey = file.toUpperCase();
                        env[envKey] = value;
                    }
                    catch (error) {
                        console.warn(`Failed to read Docker secret ${file}:`, error);
                    }
                }
            }
        }
        catch (error) {
            console.warn('Failed to read Docker secrets directory:', error);
        }
        return env;
    }
}
exports.DockerSecretsLoader = DockerSecretsLoader;
class DotenvLoader {
    envPath;
    constructor(envPath) {
        this.envPath = envPath;
    }
    load() {
        const env = {};
        try {
            const result = dotenv_1.default.config({ path: this.envPath });
            if (result.parsed) {
                Object.assign(env, result.parsed);
            }
        }
        catch (error) {
            console.warn('Failed to load .env file:', error);
        }
        return env;
    }
}
exports.DotenvLoader = DotenvLoader;
class CompositeEnvLoader {
    loaders;
    constructor(loaders) {
        this.loaders = loaders;
    }
    load() {
        let env = {};
        for (const loader of this.loaders) {
            const loaderEnv = loader.load();
            env = { ...env, ...loaderEnv };
        }
        return env;
    }
}
exports.CompositeEnvLoader = CompositeEnvLoader;
class EnvironmentConfigLoader {
    static instance;
    envCache = null;
    constructor() { }
    static getInstance() {
        if (!EnvironmentConfigLoader.instance) {
            EnvironmentConfigLoader.instance = new EnvironmentConfigLoader();
        }
        return EnvironmentConfigLoader.instance;
    }
    loadEnvironment(options = {}) {
        if (this.envCache) {
            return this.envCache;
        }
        const loaders = [];
        if (options.envFilePath || this.shouldLoadDotenv()) {
            loaders.push(new DotenvLoader(options.envFilePath));
        }
        if (options.useDockerSecrets || this.shouldUseDockerSecrets()) {
            loaders.push(new DockerSecretsLoader(options.secretsPath));
        }
        loaders.push(new ProcessEnvLoader());
        const compositeLoader = new CompositeEnvLoader(loaders);
        this.envCache = compositeLoader.load();
        return this.envCache;
    }
    clearCache() {
        this.envCache = null;
    }
    getEnvironment() {
        const env = this.loadEnvironment();
        const nodeEnv = env.NODE_ENV?.toLowerCase();
        if (nodeEnv === 'production')
            return 'production';
        if (nodeEnv === 'test')
            return 'test';
        return 'development';
    }
    shouldLoadDotenv() {
        const nodeEnv = process.env.NODE_ENV?.toLowerCase();
        const env = nodeEnv === 'production' ? 'production' : nodeEnv === 'test' ? 'test' : 'development';
        return env === 'development' || env === 'test';
    }
    shouldUseDockerSecrets() {
        const useDockerSecrets = process.env.USE_DOCKER_SECRETS?.toLowerCase();
        const nodeEnv = process.env.NODE_ENV?.toLowerCase();
        const env = nodeEnv === 'production' ? 'production' : nodeEnv === 'test' ? 'test' : 'development';
        return useDockerSecrets === 'true' || env === 'production';
    }
}
exports.EnvironmentConfigLoader = EnvironmentConfigLoader;
exports.configUtils = {
    isValidUrl: (value) => {
        try {
            new URL(value);
            return true;
        }
        catch {
            return false;
        }
    },
    parseArray: (value, defaultValue = []) => {
        if (!value)
            return defaultValue;
        return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    },
    parseBoolean: (value, defaultValue = false) => {
        if (!value)
            return defaultValue;
        const lowercased = value.toLowerCase();
        return lowercased === 'true' || lowercased === '1' || lowercased === 'yes';
    },
    parseInt: (value, defaultValue, min, max) => {
        if (!value)
            return defaultValue;
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed))
            return defaultValue;
        if (min !== undefined && parsed < min)
            return defaultValue;
        if (max !== undefined && parsed > max)
            return defaultValue;
        return parsed;
    },
    maskSensitiveValue: (key, value) => {
        const sensitiveKeys = [
            'password',
            'secret',
            'key',
            'token',
            'api_key',
            'private',
            'jwt_secret',
            'nextauth_secret',
            'encryption_key',
            'plex_client_secret',
        ];
        const isSensitive = sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive));
        if (isSensitive && value.length > 0) {
            return `${value.substring(0, 4)}${'*'.repeat(value.length - 4)}`;
        }
        return value;
    },
    sanitizeConfigForLogging: (config) => {
        const sanitized = {};
        for (const [key, value] of Object.entries(config)) {
            if (typeof value === 'string') {
                sanitized[key] = exports.configUtils.maskSensitiveValue(key, value);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    },
};
function createConfiguration(validator, options = {}) {
    const loader = EnvironmentConfigLoader.getInstance();
    const env = loader.loadEnvironment(options);
    try {
        return validator(env);
    }
    catch (error) {
        console.error('Configuration validation failed:', error);
        throw error;
    }
}
exports.environmentLoader = EnvironmentConfigLoader.getInstance();
//# sourceMappingURL=utils.js.map