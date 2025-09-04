"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestDataFactory = void 0;
exports.createTestUser = createTestUser;
exports.createTestMediaRequest = createTestMediaRequest;
exports.createTestYoutubeDownload = createTestYoutubeDownload;
exports.createTestServiceStatus = createTestServiceStatus;
exports.createTestJwtPayload = createTestJwtPayload;
exports.createTestErrorResponse = createTestErrorResponse;
exports.createTestSuccessResponse = createTestSuccessResponse;
const types_1 = require("../types");
const test_helpers_1 = require("./test-helpers");
function createTestUser(overrides = {}) {
    return {
        id: (0, test_helpers_1.generateId)('user'),
        plexId: (0, test_helpers_1.generateId)('plex'),
        plexUsername: 'testuser',
        email: 'test@example.com',
        role: 'user',
        plexToken: 'encrypted-token',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        status: 'active',
        ...overrides,
    };
}
function createTestMediaRequest(overrides = {}) {
    return {
        id: (0, test_helpers_1.generateId)('request'),
        userId: (0, test_helpers_1.generateId)('user'),
        title: 'Test Movie',
        mediaType: 'movie',
        tmdbId: '12345',
        status: types_1.RequestStatus.PENDING,
        createdAt: new Date(),
        overseerrId: (0, test_helpers_1.generateId)('overseerr'),
        completedAt: null,
        ...overrides,
    };
}
function createTestYoutubeDownload(overrides = {}) {
    return {
        id: (0, test_helpers_1.generateId)('download'),
        userId: (0, test_helpers_1.generateId)('user'),
        playlistUrl: 'https://youtube.com/playlist?list=TEST123',
        playlistTitle: 'Test Playlist',
        status: 'queued',
        filePaths: [],
        plexCollectionId: null,
        createdAt: new Date(),
        completedAt: null,
        ...overrides,
    };
}
function createTestServiceStatus(overrides = {}) {
    return {
        name: 'test-service',
        displayName: 'Test Service',
        url: 'http://localhost:8080',
        status: 'online',
        responseTime: 100,
        uptime: 99.9,
        lastCheck: new Date(),
        error: null,
        ...overrides,
    };
}
class TestDataFactory {
    static createUsers(count, overrides = {}) {
        return Array.from({ length: count }, (_, i) => createTestUser({
            plexUsername: `testuser${i + 1}`,
            email: `test${i + 1}@example.com`,
            ...overrides,
        }));
    }
    static createMediaRequests(count, userId, overrides = {}) {
        return Array.from({ length: count }, (_, i) => createTestMediaRequest({
            userId,
            title: `Test Movie ${i + 1}`,
            tmdbId: `${12345 + i}`,
            ...overrides,
        }));
    }
    static createFullDataset() {
        const users = this.createUsers(3);
        const adminUser = createTestUser({ role: 'admin', plexUsername: 'admin' });
        const mediaRequests = [
            ...this.createMediaRequests(5, users[0].id, { status: types_1.RequestStatus.PENDING }),
            ...this.createMediaRequests(3, users[0].id, { status: types_1.RequestStatus.AVAILABLE }),
            ...this.createMediaRequests(2, users[1].id, { status: types_1.RequestStatus.PENDING }),
            ...this.createMediaRequests(1, adminUser.id, { status: types_1.RequestStatus.FAILED }),
        ];
        const youtubeDownloads = [
            createTestYoutubeDownload({ userId: users[0].id, status: 'completed' }),
            createTestYoutubeDownload({ userId: users[0].id, status: 'downloading' }),
            createTestYoutubeDownload({ userId: users[1].id, status: 'queued' }),
        ];
        const serviceStatuses = [
            createTestServiceStatus({ name: 'plex', displayName: 'Plex', status: 'online' }),
            createTestServiceStatus({ name: 'overseerr', displayName: 'Overseerr', status: 'online' }),
            createTestServiceStatus({
                name: 'uptime-kuma',
                displayName: 'Uptime Kuma',
                status: 'offline',
            }),
        ];
        return {
            users: [...users, adminUser],
            mediaRequests,
            youtubeDownloads,
            serviceStatuses,
        };
    }
}
exports.TestDataFactory = TestDataFactory;
function createTestJwtPayload(userId, role = 'user') {
    return {
        userId,
        role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
    };
}
function createTestErrorResponse(code, message, details = {}) {
    return {
        success: false,
        error: {
            code,
            message,
            details,
        },
    };
}
function createTestSuccessResponse(data) {
    return {
        success: true,
        data,
        meta: {
            timestamp: new Date().toISOString(),
            version: '1.0',
        },
    };
}
//# sourceMappingURL=test-factories.js.map