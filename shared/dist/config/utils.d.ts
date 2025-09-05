import { Environment } from './schemas';
export interface EnvLoader {
    load(): Record<string, string>;
}
export declare class ProcessEnvLoader implements EnvLoader {
    load(): Record<string, string>;
}
export declare class DockerSecretsLoader implements EnvLoader {
    private secretsPath;
    constructor(secretsPath?: string);
    load(): Record<string, string>;
}
export declare class DotenvLoader implements EnvLoader {
    private envPath?;
    constructor(envPath?: string | undefined);
    load(): Record<string, string>;
}
export declare class CompositeEnvLoader implements EnvLoader {
    private loaders;
    constructor(loaders: EnvLoader[]);
    load(): Record<string, string>;
}
export declare class EnvironmentConfigLoader {
    private static instance;
    private envCache;
    private constructor();
    static getInstance(): EnvironmentConfigLoader;
    loadEnvironment(options?: {
        useDockerSecrets?: boolean;
        envFilePath?: string;
        secretsPath?: string;
    }): Record<string, string>;
    clearCache(): void;
    getEnvironment(): Environment;
    private shouldLoadDotenv;
    private shouldUseDockerSecrets;
}
export declare const configUtils: {
    isValidUrl: (value: string) => boolean;
    parseArray: (value: string | undefined, defaultValue?: string[]) => string[];
    parseBoolean: (value: string | undefined, defaultValue?: boolean) => boolean;
    parseInt: (value: string | undefined, defaultValue: number, min?: number, max?: number) => number;
    maskSensitiveValue: (key: string, value: string) => string;
    sanitizeConfigForLogging: (config: Record<string, unknown>) => Record<string, unknown>;
};
export declare function createConfiguration<T>(validator: (env: Record<string, unknown>) => T, options?: {
    useDockerSecrets?: boolean;
    envFilePath?: string;
    secretsPath?: string;
}): T;
export declare const environmentLoader: EnvironmentConfigLoader;
//# sourceMappingURL=utils.d.ts.map