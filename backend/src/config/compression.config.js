
// Optimized compression middleware
const compression = require('compression');

const compressionConfig = {
  level: 9, // Maximum compression
  threshold: 1024, // Compress files > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  // Custom compression for different file types
  strategy: 'Z_DEFAULT_STRATEGY',
  chunkSize: 16 * 1024, // 16KB chunks
  windowBits: 15,
  memLevel: 8
};

module.exports = compressionConfig;
