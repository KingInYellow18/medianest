/** @type {import('next').NextConfig} */
const nextConfig = {
  // Trust proxy headers for correct protocol detection
  experimental: {
    // Enable instrumentation for OpenTelemetry if needed
    instrumentationHook: true,
  },
  // Configure for reverse proxy
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  // Handle WebSocket upgrade for Socket.io
  async rewrites() {
    return {
      beforeFiles: [
        // WebSocket support
        {
          source: '/socket.io/:path*',
          destination: '/api/socketio/:path*',
        },
      ],
    };
  },
}

module.exports = nextConfig