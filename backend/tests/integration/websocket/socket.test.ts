import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { io, Socket } from 'socket.io-client';
import { Server } from 'socket.io';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import { TestDatabase } from '../../helpers/database';
import { testUsers } from '../../fixtures';

describe('WebSocket Integration', () => {
  let httpServer: any;
  let ioServer: Server;
  let clientSocket: Socket;
  let testDb: TestDatabase;
  let authToken: string;

  beforeAll(async () => {
    // Set up test database
    testDb = new TestDatabase();
    await testDb.setup();
    await testDb.seed();

    // Create test server
    httpServer = createServer();
    ioServer = new Server(httpServer, {
      cors: {
        origin: '*',
        credentials: true
      }
    });

    // Add authentication middleware
    ioServer.use((socket, next) => {
      const token = socket.handshake.auth.token;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
        socket.data.user = decoded;
        next();
      } catch (err) {
        next(new Error('Authentication failed'));
      }
    });

    // Set up event handlers
    ioServer.on('connection', (socket) => {
      socket.on('subscribe:status', () => {
        socket.join('status-updates');
      });

      socket.on('unsubscribe:status', () => {
        socket.leave('status-updates');
      });

      socket.on('request:refresh', (serviceId: string) => {
        // Simulate service refresh
        setTimeout(() => {
          ioServer.to('status-updates').emit('service:status', {
            serviceId,
            status: 'up',
            responseTime: Math.floor(Math.random() * 100),
            timestamp: new Date().toISOString()
          });
        }, 100);
      });
    });

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        const port = httpServer.address().port;
        console.log(`Test server listening on port ${port}`);
        resolve(port);
      });
    });

    // Generate auth token
    authToken = jwt.sign(
      { id: testUsers[0].id, username: testUsers[0].username, role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    ioServer.close();
    httpServer.close();
    await testDb.cleanup();
  });

  beforeEach(() => {
    // Clean up any existing connections
    if (clientSocket) {
      clientSocket.disconnect();
    }
  });

  describe('Connection Tests', () => {
    it('should connect with valid JWT token', (done) => {
      const port = httpServer.address().port;
      clientSocket = io(`http://localhost:${port}`, {
        auth: { token: authToken },
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });
    });

    it('should reject connection with invalid token', (done) => {
      const port = httpServer.address().port;
      clientSocket = io(`http://localhost:${port}`, {
        auth: { token: 'invalid-token' },
        transports: ['websocket']
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        done();
      });
    });

    it('should reject connection without token', (done) => {
      const port = httpServer.address().port;
      clientSocket = io(`http://localhost:${port}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        done();
      });
    });
  });

  describe('Status Update Tests', () => {
    beforeEach((done) => {
      const port = httpServer.address().port;
      clientSocket = io(`http://localhost:${port}`, {
        auth: { token: authToken },
        transports: ['websocket']
      });

      clientSocket.on('connect', done);
    });

    it('should subscribe to status updates', (done) => {
      clientSocket.emit('subscribe:status');

      // Verify subscription by checking if client receives updates
      clientSocket.on('service:status', (data) => {
        expect(data).toHaveProperty('serviceId');
        expect(data).toHaveProperty('status');
        expect(data).toHaveProperty('timestamp');
        done();
      });

      // Simulate a status update from server
      setTimeout(() => {
        ioServer.to('status-updates').emit('service:status', {
          serviceId: 'plex',
          status: 'up',
          responseTime: 45,
          timestamp: new Date().toISOString()
        });
      }, 100);
    });

    it('should unsubscribe from status updates', (done) => {
      let updateReceived = false;

      clientSocket.emit('subscribe:status');
      
      clientSocket.on('service:status', () => {
        updateReceived = true;
      });

      // Unsubscribe
      setTimeout(() => {
        clientSocket.emit('unsubscribe:status');
        
        // Send update after unsubscribe
        setTimeout(() => {
          ioServer.to('status-updates').emit('service:status', {
            serviceId: 'plex',
            status: 'up',
            timestamp: new Date().toISOString()
          });

          // Verify no update received
          setTimeout(() => {
            expect(updateReceived).toBe(false);
            done();
          }, 200);
        }, 100);
      }, 100);
    });

    it('should handle service refresh requests', (done) => {
      clientSocket.emit('subscribe:status');

      clientSocket.on('service:status', (data) => {
        expect(data.serviceId).toBe('overseerr');
        expect(data.status).toBe('up');
        expect(data).toHaveProperty('responseTime');
        done();
      });

      // Request refresh
      clientSocket.emit('request:refresh', 'overseerr');
    });

    it('should handle bulk status updates', (done) => {
      clientSocket.emit('subscribe:status');

      clientSocket.on('service:bulk-update', (services) => {
        expect(Array.isArray(services)).toBe(true);
        expect(services.length).toBeGreaterThan(0);
        expect(services[0]).toHaveProperty('id');
        expect(services[0]).toHaveProperty('status');
        done();
      });

      // Simulate bulk update
      ioServer.to('status-updates').emit('service:bulk-update', [
        { id: 'plex', status: 'up', lastCheckAt: new Date() },
        { id: 'overseerr', status: 'down', lastCheckAt: new Date() }
      ]);
    });
  });

  describe('Reconnection Tests', () => {
    it('should handle reconnection after disconnect', (done) => {
      const port = httpServer.address().port;
      let disconnectCount = 0;
      let reconnectCount = 0;

      clientSocket = io(`http://localhost:${port}`, {
        auth: { token: authToken },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionAttempts: 3
      });

      clientSocket.on('connect', () => {
        if (reconnectCount === 0) {
          // First connection - force disconnect
          setTimeout(() => {
            clientSocket.disconnect();
          }, 100);
        }
      });

      clientSocket.on('disconnect', () => {
        disconnectCount++;
        if (disconnectCount === 1) {
          // Reconnect
          clientSocket.connect();
        }
      });

      clientSocket.io.on('reconnect', () => {
        reconnectCount++;
        expect(clientSocket.connected).toBe(true);
        done();
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach((done) => {
      const port = httpServer.address().port;
      clientSocket = io(`http://localhost:${port}`, {
        auth: { token: authToken },
        transports: ['websocket']
      });

      clientSocket.on('connect', done);
    });

    it('should receive error messages', (done) => {
      clientSocket.on('error', (error) => {
        expect(error).toHaveProperty('message');
        expect(error.message).toBe('Test error message');
        done();
      });

      // Emit error from server
      const serverSocket = ioServer.sockets.sockets.get(clientSocket.id!);
      serverSocket?.emit('error', { message: 'Test error message' });
    });
  });
});