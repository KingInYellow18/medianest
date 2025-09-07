"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCorrelationId = generateCorrelationId;
exports.generateSimpleId = generateSimpleId;
exports.generateSessionId = generateSessionId;
exports.generateRequestId = generateRequestId;
const uuid_1 = require("uuid");
function generateCorrelationId() {
    return (0, uuid_1.v4)();
}
function generateSimpleId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
function generateSessionId() {
    return `session_${generateCorrelationId()}`;
}
function generateRequestId() {
    return `req_${generateCorrelationId()}`;
}
//# sourceMappingURL=generators.js.map