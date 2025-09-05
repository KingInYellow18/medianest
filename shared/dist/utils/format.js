"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatBytes = formatBytes;
exports.formatSpeed = formatSpeed;
exports.formatETA = formatETA;
exports.isToday = isToday;
exports.formatDate = formatDate;
exports.formatRelativeTime = formatRelativeTime;
exports.formatDistanceToNow = formatDistanceToNow;
exports.formatPercentage = formatPercentage;
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}
function formatSpeed(bytesPerSecond) {
    if (!bytesPerSecond)
        return '0 B/s';
    return `${formatBytes(bytesPerSecond)}/s`;
}
function formatETA(seconds) {
    if (!seconds || seconds === Infinity)
        return 'Unknown';
    if (seconds < 60)
        return `${Math.round(seconds)}s`;
    if (seconds < 3600)
        return `${Math.round(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}
function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}
function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}
function formatRelativeTime(date) {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffSeconds < 60)
        return 'just now';
    if (diffMinutes === 1)
        return '1 minute ago';
    if (diffMinutes < 60)
        return `${diffMinutes} minutes ago`;
    if (diffHours === 1)
        return '1 hour ago';
    if (diffHours < 24)
        return `${diffHours} hours ago`;
    if (diffDays === 1)
        return 'yesterday';
    if (diffDays < 7)
        return `${diffDays} days ago`;
    if (diffDays < 30)
        return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(d);
}
function formatDistanceToNow(date) {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffSeconds < 60)
        return 'just now';
    if (diffMinutes < 60)
        return `${diffMinutes}m ago`;
    if (diffHours < 24)
        return `${diffHours}h ago`;
    if (diffDays === 1)
        return 'yesterday';
    if (diffDays < 7)
        return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
function formatPercentage(value, decimals = 1) {
    return `${value.toFixed(decimals)}%`;
}
//# sourceMappingURL=format.js.map