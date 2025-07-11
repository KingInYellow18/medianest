import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UptimeKumaClient } from '@/integrations/uptime-kuma/uptime-kuma.client';
import { EventEmitter } from 'events';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket)
}));

const mockSocket = new EventEmitter() as any;
mockSocket.disconnect = vi.fn();
mockSocket.emit = vi.fn();
mockSocket.connected = false;

describe('UptimeKumaClient', () => {
  let client: UptimeKumaClient;
  const mockUrl = 'http://localhost:3001';

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    client = new UptimeKumaClient(mockUrl);
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      const connectPromise = client.connect();
      
      // Simulate connection
      setTimeout(() => {
        mockSocket.emit('connect');
        mockSocket.connected = true;
      }, 10);

      await connectPromise;
      
      expect(mockSocket.emit).toHaveBeenCalledWith('monitorList');
    });

    it('should handle connection timeout', async () => {
      await expect(client.connect()).rejects.toThrow('Connection timeout');
    });

    it('should authenticate when credentials provided', async () => {
      client = new UptimeKumaClient(mockUrl, 'username', 'password');
      
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'login' && callback) {
          callback({ ok: true });
        }
      });

      const connectPromise = client.connect();
      
      setTimeout(() => {
        mockSocket.emit('connect');
        mockSocket.connected = true;
      }, 10);

      await connectPromise;
      
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'login',
        expect.objectContaining({
          username: 'username',
          password: 'password'
        }),
        expect.any(Function)
      );
    });
  });

  describe('monitor events', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      setTimeout(() => {
        mockSocket.emit('connect');
        mockSocket.connected = true;
      }, 10);
      await connectPromise;
    });

    it('should handle monitorList event', (done) => {
      const mockMonitors = {
        '1': {
          monitorID: 1,
          name: 'Test Service',
          type: 'http',
          active: true,
          status: true,
          ping: 50
        }
      };

      client.on('monitorList', (monitors) => {
        expect(monitors).toHaveLength(1);
        expect(monitors[0].name).toBe('Test Service');
        done();
      });

      mockSocket.emit('monitorList', mockMonitors);
    });

    it('should handle heartbeat event', (done) => {
      const mockMonitors = {
        '1': {
          monitorID: 1,
          name: 'Test Service',
          type: 'http',
          active: true,
          status: true,
          ping: 50
        }
      };

      // Setup monitor first
      mockSocket.emit('monitorList', mockMonitors);

      const mockHeartbeat = {
        monitorID: 1,
        status: 1,
        time: new Date().toISOString(),
        msg: 'OK',
        ping: 45
      };

      client.on('heartbeat', ({ monitor, heartbeat }) => {
        expect(monitor.monitorID).toBe(1);
        expect(monitor.ping).toBe(45);
        expect(heartbeat.status).toBe(1);
        done();
      });

      mockSocket.emit('heartbeat', mockHeartbeat);
    });

    it('should handle statusChange event', (done) => {
      const mockHeartbeats = [{
        monitorID: 1,
        status: 0,
        time: new Date().toISOString(),
        msg: 'Connection failed',
        important: true
      }];

      client.on('statusChange', ({ monitorID, heartbeats }) => {
        expect(monitorID).toBe(1);
        expect(heartbeats[0].status).toBe(0);
        done();
      });

      mockSocket.emit('importantHeartbeatList', 1, mockHeartbeats);
    });
  });

  describe('getters', () => {
    it('should get monitors', async () => {
      const connectPromise = client.connect();
      setTimeout(() => {
        mockSocket.emit('connect');
        mockSocket.connected = true;
      }, 10);
      await connectPromise;

      const mockMonitors = {
        '1': { monitorID: 1, name: 'Service 1' },
        '2': { monitorID: 2, name: 'Service 2' }
      };

      mockSocket.emit('monitorList', mockMonitors);

      const monitors = client.getMonitors();
      expect(monitors).toHaveLength(2);
    });

    it('should get monitor by name', async () => {
      const connectPromise = client.connect();
      setTimeout(() => {
        mockSocket.emit('connect');
        mockSocket.connected = true;
      }, 10);
      await connectPromise;

      const mockMonitors = {
        '1': { monitorID: 1, name: 'Plex Media Server' }
      };

      mockSocket.emit('monitorList', mockMonitors);

      const monitor = client.getMonitorByName('Plex Media Server');
      expect(monitor?.monitorID).toBe(1);
    });
  });

  describe('disconnect', () => {
    it('should disconnect properly', () => {
      client.disconnect();
      
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(client.isConnected()).toBe(false);
    });
  });
});