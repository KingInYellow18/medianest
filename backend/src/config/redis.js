"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitScript = exports.getRedis = exports.initializeRedis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
let redisClient;
const initializeRedis = async () => {
    if (!redisClient) {
        redisClient = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });
        redisClient.on('connect', () => {
            logger_1.logger.info('Redis connected');
        });
        redisClient.on('error', (err) => {
            logger_1.logger.error('Redis error:', err);
        });
        await redisClient.ping();
    }
    return redisClient;
};
exports.initializeRedis = initializeRedis;
const getRedis = () => {
    if (!redisClient) {
        throw new Error('Redis not initialized');
    }
    return redisClient;
};
exports.getRedis = getRedis;
exports.rateLimitScript = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current = redis.call('GET', key)

if current and tonumber(current) >= limit then
  return redis.call('TTL', key)
else
  current = redis.call('INCR', key)
  if current == 1 then
    redis.call('EXPIRE', key, window)
  end
  return 0
end
`;
//# sourceMappingURL=redis.js.map