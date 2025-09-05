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
class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, details) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends AppError {
    constructor(resource) {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, 'CONFLICT_ERROR');
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends AppError {
    constructor(retryAfter) {
        super('Too many requests', 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
    }
}
exports.RateLimitError = RateLimitError;
class ServiceUnavailableError extends AppError {
    constructor(service) {
        super(`${service} is temporarily unavailable`, 503, 'SERVICE_UNAVAILABLE');
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
class BadRequestError extends AppError {
    constructor(message, details) {
        super(message, 400, 'BAD_REQUEST', details);
    }
}
exports.BadRequestError = BadRequestError;
class InternalServerError extends AppError {
    constructor(message = 'An internal server error occurred', details) {
        super(message, 500, 'INTERNAL_SERVER_ERROR', details);
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
__exportStar(require("./utils"), exports);
//# sourceMappingURL=index.js.map