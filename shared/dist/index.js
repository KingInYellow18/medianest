"use strict";
// @medianest/shared - Shared types and utilities for MediaNest
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
exports.createSessionId = exports.createRequestId = exports.createEntityId = exports.createUserId = exports.failure = exports.success = void 0;
// Export shared utilities first (no conflicts)
__exportStar(require("./utils"), exports);
// Export shared constants (no conflicts)
__exportStar(require("./constants"), exports);
// Export configuration management (no conflicts)
__exportStar(require("./config"), exports);
// Export validation utilities (no conflicts)
__exportStar(require("./validation"), exports);
// Export error classes from errors module (these are the main implementations)
__exportStar(require("./errors"), exports);
// Export functions (not types) from Context7
var context7_shared_1 = require("./types/context7-shared");
Object.defineProperty(exports, "success", { enumerable: true, get: function () { return context7_shared_1.success; } });
Object.defineProperty(exports, "failure", { enumerable: true, get: function () { return context7_shared_1.failure; } });
Object.defineProperty(exports, "createUserId", { enumerable: true, get: function () { return context7_shared_1.createUserId; } });
Object.defineProperty(exports, "createEntityId", { enumerable: true, get: function () { return context7_shared_1.createEntityId; } });
Object.defineProperty(exports, "createRequestId", { enumerable: true, get: function () { return context7_shared_1.createRequestId; } });
Object.defineProperty(exports, "createSessionId", { enumerable: true, get: function () { return context7_shared_1.createSessionId; } });
//# sourceMappingURL=index.js.map