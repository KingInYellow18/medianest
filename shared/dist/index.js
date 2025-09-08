"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// Core error class
class AppError extends Error {
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

// Type guard for AppError
function isAppError(error) {
    return error instanceof AppError;
}
exports.isAppError = isAppError;

// Error classes
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

// Convert any error to AppError
function toAppError(error) {
    if (isAppError(error)) {
        return error;
    }
    if (error instanceof Error) {
        return new InternalServerError(error.message);
    }
    return new InternalServerError('An unknown error occurred');
}
exports.toAppError = toAppError;

// Convert error to error response format
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
exports.toErrorResponse = toErrorResponse;