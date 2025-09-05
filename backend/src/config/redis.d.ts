import Redis from 'ioredis';
export declare const initializeRedis: () => Promise<Redis>;
export declare const getRedis: () => Redis;
export declare const rateLimitScript = "\nlocal key = KEYS[1]\nlocal limit = tonumber(ARGV[1])\nlocal window = tonumber(ARGV[2])\nlocal current = redis.call('GET', key)\n\nif current and tonumber(current) >= limit then\n  return redis.call('TTL', key)\nelse\n  current = redis.call('INCR', key)\n  if current == 1 then\n    redis.call('EXPIRE', key, window)\n  end\n  return 0\nend\n";
//# sourceMappingURL=redis.d.ts.map