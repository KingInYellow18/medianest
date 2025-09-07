#!/usr/bin/env node
/**
 * Simple health check script for Docker HEALTHCHECK
 *
 * This script performs a basic HTTP request to the health endpoint
 * and exits with appropriate status codes for Docker health checking.
 */

const http = require('http');
const { logger } = require('./utils/logger');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 4000,
  path: '/health',
  method: 'GET',
  timeout: 5000,
};

const req = http.request(options, (res: any) => {
  if (res.statusCode === 200) {
    logger.info('Health check passed', {
      statusCode: res.statusCode,
      endpoint: '/health',
      timestamp: new Date().toISOString(),
    });
    process.exit(0);
  } else {
    logger.error('Health check failed', {
      statusCode: res.statusCode,
      endpoint: '/health',
      timestamp: new Date().toISOString(),
    });
    process.exit(1);
  }
});

req.on('error', (err: any) => {
  logger.error('Health check failed with error', {
    error: err.message,
    endpoint: '/health',
    timestamp: new Date().toISOString(),
  });
  process.exit(1);
});

req.on('timeout', () => {
  logger.error('Health check timed out', {
    endpoint: '/health',
    timeout: 5000,
    timestamp: new Date().toISOString(),
  });
  req.destroy();
  process.exit(1);
});

req.setTimeout(5000);
req.end();
