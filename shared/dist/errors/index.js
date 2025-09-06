"use strict";
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
exports.InternalServerError = exports.BadRequestError = exports.ServiceUnavailableError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.AppError = void 0;
exports.isAppError = isAppError;
exports.toAppError = toAppError;
exports.toErrorResponse = toErrorResponse;
class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(code, message, statusCode = 500, details = {}) {
        super(message);
        this.code = code;
        this.message = message;
        this.statusCode = statusCode;
        this.details = details;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
        this.name = this.constructor.name;
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, details) {
        super('VALIDATION_ERROR', message, 400, details);
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super('UNAUTHORIZED', message, 401);
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super('FORBIDDEN', message, 403);
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends AppError {
    constructor(resource) {
        const message = resource ? `${resource} not found` : 'Resource not found';
        super('NOT_FOUND', message, 404);
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message) {
        super('CONFLICT', message, 409);
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends AppError {
    constructor(message, retryAfter) {
        super('RATE_LIMIT_EXCEEDED', message || 'Too many requests', 429, retryAfter ? { retryAfter } : {});
    }
}
exports.RateLimitError = RateLimitError;
class ServiceUnavailableError extends AppError {
    constructor(service) {
        const message = service
            ? `${service} is temporarily unavailable`
            : 'Service temporarily unavailable';
        super('SERVICE_UNAVAILABLE', message, 503);
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
class BadRequestError extends AppError {
    constructor(message, details) {
        super('BAD_REQUEST', message, 400, details);
    }
}
exports.BadRequestError = BadRequestError;
class InternalServerError extends AppError {
    constructor(message = 'An internal server error occurred', details) {
        super('INTERNAL_ERROR', message, 500, details);
    }
}
exports.InternalServerError = InternalServerError;
function isAppError(error) {
    return error instanceof AppError;
}
function toAppError(error) {
    if (isAppError(error)) {
        return error;
    }
    if (error instanceof Error) {
        return new InternalServerError(error.message);
    }
    return new InternalServerError('An unknown error occurred');
}
function toErrorResponse(error) {
    if (isAppError(error)) {
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
__exportStar(require("./utils"), exports);
//# sourceMappingURL=index.js.map