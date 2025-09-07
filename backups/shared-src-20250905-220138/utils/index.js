"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCorrelationId = exports.formatRelativeTime = exports.formatDate = void 0;
const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};
exports.formatDate = formatDate;
const formatRelativeTime = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1)
        return 'just now';
    if (diffMins < 60)
        return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24)
        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30)
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return (0, exports.formatDate)(d);
};
exports.formatRelativeTime = formatRelativeTime;
const generateCorrelationId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
exports.generateCorrelationId = generateCorrelationId;
//# sourceMappingURL=index.js.map