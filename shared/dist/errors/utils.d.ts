import { AppError } from './index';
export interface SerializedError {
    message: string;
    code: string;
    statusCode?: number;
    details?: any;
    correlationId?: string;
    retryAfter?: number;
}
export declare function serializeError(error: AppError | Error): SerializedError;
export declare function parseApiError(response: any): AppError;
export interface ErrorLogEntry {
    error: Error | AppError;
    context?: any;
    userAgent?: string;
    url?: string;
    timestamp: string;
}
export declare function logError(error: Error | AppError, context?: any): ErrorLogEntry;
export declare const USER_FRIENDLY_MESSAGES: Record<string, string>;
export declare function getUserFriendlyMessage(error: Error | AppError): string;
export declare function isRetryableError(error: Error | AppError): boolean;
export declare function extractErrorDetails(error: Error | AppError): Record<string, any>;
//# sourceMappingURL=utils.d.ts.map