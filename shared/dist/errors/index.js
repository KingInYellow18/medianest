"use strict";
// Shared error classes
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalServerError = exports.BadRequestError = exports.ServiceUnavailableError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.isAppError = exports.AppError = void 0;
exports.toAppError = toAppError;
exports.toErrorResponse = toErrorResponse;
// Import core types from separate module to avoid circular dependencies
const types_1 = require("./types");
Object.defineProperty(exports, "AppError", { enumerable: true, get: function () { return types_1.AppError; } });
Object.defineProperty(exports, "isAppError", { enumerable: true, get: function () { return types_1.isAppError; } });
class ValidationError extends types_1.AppError {
    constructor(message, details) {
        super('VALIDATION_ERROR', message, 400, details);
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends types_1.AppError {
    constructor(message = 'Authentication required') {
        super('UNAUTHORIZED', message, 401);
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends types_1.AppError {
    constructor(message = 'Insufficient permissions') {
        super('FORBIDDEN', message, 403);
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends types_1.AppError {
    constructor(resource) {
        const message = resource ? `${resource} not found` : 'Resource not found';
        super('NOT_FOUND', message, 404);
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends types_1.AppError {
    constructor(message) {
        super('CONFLICT', message, 409);
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends types_1.AppError {
    constructor(message, retryAfter) {
        super('RATE_LIMIT_EXCEEDED', message || 'Too many requests', 429, retryAfter ? { retryAfter } : {});
    }
}
exports.RateLimitError = RateLimitError;
class ServiceUnavailableError extends types_1.AppError {
    constructor(service) {
        const message = service
            ? `${service} is temporarily unavailable`
            : 'Service temporarily unavailable';
        super('SERVICE_UNAVAILABLE', message, 503);
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
class BadRequestError extends types_1.AppError {
    constructor(message, details) {
        super('BAD_REQUEST', message, 400, details);
    }
}
exports.BadRequestError = BadRequestError;
class InternalServerError extends types_1.AppError {
    constructor(message = 'An internal server error occurred', details) {
        super('INTERNAL_ERROR', message, 500, details);
    }
}
exports.InternalServerError = InternalServerError;
// Convert any error to AppError
function toAppError(error) {
    if ((0, types_1.isAppError)(error)) {
        return error;
    }
    if (error instanceof Error) {
        return new InternalServerError(error.message);
    }
    return new InternalServerError('An unknown error occurred');
}
// Convert error to error response format
function toErrorResponse(error) {
    if ((0, types_1.isAppError)(error)) {
        return {
            success: false,
            error: {
                code: error.code,
                message: error.message,
                details: error.details || {},
            },
        };
    }
    if (error instanceof Error) {
        return {
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message,
                details: {},
            },
        };
    }
    return {
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: {},
        },
    };
}
// Export utilities
__exportStar(require("./utils"), exports);
//# sourceMappingURL=index.js.map