"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatBytes = formatBytes;
exports.formatSpeed = formatSpeed;
exports.formatETA = formatETA;
exports.isToday = isToday;
exports.formatDate = formatDate;
exports.formatDateTime = formatDateTime;
exports.formatRelativeTime = formatRelativeTime;
exports.formatDistanceToNow = formatDistanceToNow;
exports.formatPercentage = formatPercentage;
exports.formatCurrency = formatCurrency;
function formatBytes(bytes, decimals) {
    if (bytes === 0)
        return '0 Bytes';
    if (bytes < 0) {
        return `-${formatBytes(Math.abs(bytes), decimals)}`;
    }
    const dm = decimals === undefined ? 2 : decimals;
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    const formatted = value.toFixed(dm);
    if (decimals === undefined) {
        const num = parseFloat(formatted);
        return `${num} ${sizes[i]}`;
    }
    return `${formatted} ${sizes[i]}`;
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
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
        return 'Invalid Date';
    }
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    };
    return d.toLocaleDateString('en-US', options);
}
function formatDateTime(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC',
    };
    return d.toLocaleDateString('en-US', options);
}
function formatRelativeTime(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInSeconds = Math.floor((d.getTime() - now.getTime()) / 1000);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'week', seconds: 604800 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 },
        { label: 'second', seconds: 1 },
    ];
    for (const interval of intervals) {
        const count = Math.floor(Math.abs(diffInSeconds) / interval.seconds);
        if (count >= 1) {
            return rtf.format(diffInSeconds < 0 ? -count : count, interval.label);
        }
    }
    return 'just now';
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
function formatPercentage(value, decimals) {
    const percentage = value * 100;
    if (decimals === undefined) {
        if (percentage % 1 === 0) {
            return `${percentage}%`;
        }
        return `${percentage.toFixed(1)}%`;
    }
    return `${percentage.toFixed(decimals)}%`;
}
function formatCurrency(amount, currency = 'USD', locale = 'en-US') {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
    }).format(amount);
}
//# sourceMappingURL=format.js.map