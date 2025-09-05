export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly details?: any;
    constructor(message: string, statusCode?: number, code?: string, details?: any);
}
export declare class ValidationError extends AppError {
    constructor(message: string, details?: any);
}
export declare class AuthenticationError extends AppError {
    constructor(message?: string);
}
export declare class AuthorizationError extends AppError {
    constructor(message?: string);
}
export declare class NotFoundError extends AppError {
    constructor(resource: string);
}
export declare class ConflictError extends AppError {
    constructor(message: string);
}
export declare class RateLimitError extends AppError {
    constructor(retryAfter?: number);
}
export declare class ServiceUnavailableError extends AppError {
    constructor(service: string);
}
export declare class BadRequestError extends AppError {
    constructor(message: string, details?: any);
}
export declare class InternalServerError extends AppError {
    constructor(message?: string, details?: any);
}
export declare function isAppError(error: any): error is AppError;
export declare function toAppError(error: any): AppError;
export * from './utils';
//# sourceMappingURL=index.d.ts.map