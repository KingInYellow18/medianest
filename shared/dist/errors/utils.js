"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_FRIENDLY_MESSAGES = void 0;
exports.serializeError = serializeError;
exports.parseApiError = parseApiError;
exports.logError = logError;
exports.getUserFriendlyMessage = getUserFriendlyMessage;
exports.isRetryableError = isRetryableError;
exports.extractErrorDetails = extractErrorDetails;
const types_1 = require("./types");
function serializeError(error) {
    if (error instanceof types_1.AppError) {
        return {
            message: error.message,
            code: error.code,
            statusCode: error.statusCode,
            details: error.details,
        };
    }
    return {
        message: error.message || 'An unknown error occurred',
        code: 'UNKNOWN_ERROR',
        statusCode: 500,
    };
}
function parseApiError(response) {
    if (response?.error) {
        const { message, code, statusCode, details } = response.error;
        return new types_1.AppError(code || 'API_ERROR', message || 'An error occurred', statusCode || 500, details);
    }
    return new types_1.AppError('UNKNOWN_ERROR', 'An unknown error occurred', 500);
}
function logError(error, context) {
    const entry = {
        error,
        context,
        timestamp: new Date().toISOString(),
    };
    if (typeof globalThis !== 'undefined' &&
        'window' in globalThis &&
        typeof globalThis.window !== 'undefined') {
        const win = globalThis.window;
        entry.userAgent = win.navigator?.userAgent;
        entry.url = win.location?.href;
    }
    if (process.env.NODE_ENV === 'production') {
        console.error('[Error]', entry);
    }
    else {
        console.error('[Error]', error, context);
    }
    return entry;
}
exports.USER_FRIENDLY_MESSAGES = {
    NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
    TIMEOUT_ERROR: 'The request took too long. Please try again.',
    AUTHENTICATION_ERROR: 'Please sign in to continue.',
    AUTHORIZATION_ERROR: "You don't have permission to do that.",
    SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
    VALIDATION_ERROR: 'Please check your input and try again.',
    INVALID_INPUT: 'The information provided is invalid.',
    RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',
    SERVICE_UNAVAILABLE: 'This service is temporarily unavailable.',
    MAINTENANCE_MODE: "We're performing maintenance. Please try again later.",
    UNKNOWN_ERROR: 'Something went wrong. Please try again.',
    NOT_FOUND: 'The requested item could not be found.',
    CONFLICT_ERROR: 'This action conflicts with another operation.',
};
function getUserFriendlyMessage(error) {
    if (error instanceof types_1.AppError) {
        return exports.USER_FRIENDLY_MESSAGES[error.code] ?? error.message;
    }
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) {
        return exports.USER_FRIENDLY_MESSAGES.NETWORK_ERROR ?? 'Network error occurred';
    }
    if (message.includes('timeout')) {
        return exports.USER_FRIENDLY_MESSAGES.TIMEOUT_ERROR ?? 'Request timeout occurred';
    }
    return exports.USER_FRIENDLY_MESSAGES.UNKNOWN_ERROR ?? 'An unexpected error occurred';
}
function isRetryableError(error) {
    if (error instanceof types_1.AppError) {
        const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
        return retryableStatusCodes.includes(error.statusCode);
    }
    const message = error.message.toLowerCase();
    return message.includes('network') || message.includes('timeout');
}
function extractErrorDetails(error) {
    const details = {
        message: error.message,
        name: error.name,
        stack: error.stack,
    };
    if (error instanceof types_1.AppError) {
        details.code = error.code;
        details.statusCode = error.statusCode;
        details.details = error.details;
    }
    if ('cause' in error && error.cause) {
        details.cause = extractErrorDetails(error.cause);
    }
    return details;
}
//# sourceMappingURL=utils.js.map