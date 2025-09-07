#!/usr/bin/env node
/**
 * Simple health check script for Docker HEALTHCHECK
 *
 * This script performs a basic HTTP request to the health endpoint
 * and exits with appropriate status codes for Docker health checking.
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 4000,
  path: '/health',
  method: 'GET',
  timeout: 5000,
};

const req = http.request(options, (res: any) => {
  if (res.statusCode === 200) {
    console.log('Health check passed');
    process.exit(0);
  } else {
    console.log(`Health check failed with status: ${res.statusCode}`);
    process.exit(1);
  }
});

req.on('error', (err: any) => {
  console.error('Health check failed with error:', err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Health check timed out');
  req.destroy();
  process.exit(1);
});

req.setTimeout(5000);
req.end();
