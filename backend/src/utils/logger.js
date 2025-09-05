"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.stream = exports.logger = void 0;
exports.createChildLogger = createChildLogger;
const mockLogger = {
    info: () => { },
    error: () => { },
    warn: () => { },
    debug: () => { },
    child: () => mockLogger,
};
exports.logger = process.env.NODE_ENV === 'test' ? mockLogger : require('./logger.ts.backup');
exports.default = exports.logger;
function createChildLogger(correlationId) {
    return exports.logger.child ? exports.logger.child({ correlationId }) : mockLogger;
}
exports.stream = {
    write: () => { },
};
//# sourceMappingURL=logger.js.map