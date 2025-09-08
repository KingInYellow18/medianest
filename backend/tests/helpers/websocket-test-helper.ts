/**
 * WebSocket Test Helper
 * 
 * Provides utilities for WebSocket testing including:
 * - Connection management
 * - Message broadcasting and receiving
 * - Authentication testing
 * - Real-time event testing
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: string;
  id?: string;
}

export interface ConnectionInfo {
  id: string;
  url: string;
  connected: boolean;
  authenticated: boolean;
  lastActivity: Date;
  messageCount: number;
}

export class WebSocketTestHelper extends EventEmitter {
  private baseUrl: string;
  private connections: Map<string, WebSocket> = new Map();
  private connectionInfo: Map<string, ConnectionInfo> = new Map();
  private messageHandlers: Map<string, Function[]> = new Map();

  constructor(baseUrl: string) {
    super();
    this.baseUrl = baseUrl;
  }

  /**
   * Create a WebSocket connection
   */
  async createConnection(
    path: string = '/ws',
    options: {
      token?: string;
      userId?: string;
      headers?: Record<string, string>;
    } = {}
  ): Promise<string> {
    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    let url = `${this.baseUrl.replace('http', 'ws')}${path}`;
    
    // Add query parameters
    const queryParams = new URLSearchParams();
    if (options.token) queryParams.set('token', options.token);
    if (options.userId) queryParams.set('userId', options.userId);
    
    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`;
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, {
        headers: options.headers
      });

      ws.on('open', () => {
        this.connections.set(connectionId, ws);
        this.connectionInfo.set(connectionId, {
          id: connectionId,
          url,
          connected: true,
          authenticated: false,
          lastActivity: new Date(),
          messageCount: 0
        });

        console.log(`✅ WebSocket connection ${connectionId} established`);
        resolve(connectionId);
      });

      ws.on('message', (data) => {
        this.handleMessage(connectionId, data.toString());
      });

      ws.on('close', () => {
        const info = this.connectionInfo.get(connectionId);
        if (info) {
          info.connected = false;
        }
        console.log(`🔌 WebSocket connection ${connectionId} closed`);
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket connection ${connectionId} error:`, error);
        reject(error);
      });

      // Timeout for connection
      setTimeout(() => {
        if (!this.connections.has(connectionId)) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Close a WebSocket connection
   */
  async closeConnection(connectionId: string): Promise<boolean> {
    const ws = this.connections.get(connectionId);
    if (!ws) return false;

    return new Promise((resolve) => {
      ws.on('close', () => {
        this.connections.delete(connectionId);
        this.connectionInfo.delete(connectionId);
        resolve(true);
      });

      ws.close();
    });
  }

  /**
   * Send message to specific connection
   */
  async sendMessage(
    connectionId: string, 
    message: WebSocketMessage
  ): Promise<boolean> {
    const ws = this.connections.get(connectionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const messageWithTimestamp: WebSocketMessage = {
      ...message,
      timestamp: new Date().toISOString(),
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    ws.send(JSON.stringify(messageWithTimestamp));

    // Update connection info
    const info = this.connectionInfo.get(connectionId);
    if (info) {
      info.lastActivity = new Date();
      info.messageCount++;
    }

    return true;
  }

  /**
   * Send message to all connections
   */
  async broadcastMessage(message: WebSocketMessage): Promise<number> {
    let sentCount = 0;

    for (const [connectionId] of this.connections) {
      const sent = await this.sendMessage(connectionId, message);
      if (sent) sentCount++;
    }

    return sentCount;
  }

  /**
   * Wait for specific message type
   */
  async waitForMessage(
    connectionId: string,
    messageType: string,
    timeout: number = 5000
  ): Promise<WebSocketMessage> {
    return new Promise((resolve, reject) => {
      const handler = (message: WebSocketMessage) => {
        if (message.type === messageType) {
          this.removeMessageHandler(connectionId, messageType, handler);
          resolve(message);
        }
      };

      this.addMessageHandler(connectionId, messageType, handler);

      setTimeout(() => {
        this.removeMessageHandler(connectionId, messageType, handler);
        reject(new Error(`Timeout waiting for message type: ${messageType}`));
      }, timeout);
    });
  }

  /**
   * Wait for multiple messages
   */
  async waitForMessages(
    connectionId: string,
    messageTypes: string[],
    timeout: number = 5000
  ): Promise<WebSocketMessage[]> {
    const messages: WebSocketMessage[] = [];
    const handlers: Function[] = [];

    return new Promise((resolve, reject) => {
      messageTypes.forEach(messageType => {
        const handler = (message: WebSocketMessage) => {
          if (message.type === messageType) {
            messages.push(message);
            
            // Remove this specific handler
            const index = messageTypes.indexOf(messageType);
            if (index > -1) {
              messageTypes.splice(index, 1);
              this.removeMessageHandler(connectionId, messageType, handler);
            }
            
            // Check if all messages received
            if (messages.length === messageTypes.length) {
              resolve(messages);
            }
          }
        };

        handlers.push(handler);
        this.addMessageHandler(connectionId, messageType, handler);
      });

      setTimeout(() => {
        // Cleanup handlers
        handlers.forEach((handler, index) => {
          const messageType = messageTypes[index];
          if (messageType) {
            this.removeMessageHandler(connectionId, messageType, handler);
          }
        });
        
        if (messages.length === 0) {
          reject(new Error(`Timeout waiting for messages: ${messageTypes.join(', ')}`));
        } else {
          resolve(messages); // Return partial results
        }
      }, timeout);
    });
  }

  /**
   * Test authentication flow
   */
  async testAuthentication(
    connectionId: string,
    authData: { token?: string; credentials?: any }
  ): Promise<{
    success: boolean;
    user?: any;
    error?: string;
    responseTime: number;
  }> {
    const startTime = Date.now();

    try {
      // Send auth message
      await this.sendMessage(connectionId, {
        type: 'authenticate',
        data: authData
      });

      // Wait for auth response
      const response = await this.waitForMessage(connectionId, 'auth_response', 3000);
      const responseTime = Date.now() - startTime;

      if (response.data?.success) {
        const info = this.connectionInfo.get(connectionId);
        if (info) {
          info.authenticated = true;
        }

        return {
          success: true,
          user: response.data.user,
          responseTime
        };
      } else {
        return {
          success: false,
          error: response.data?.error || 'Authentication failed',
          responseTime
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication timeout',
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Test real-time event propagation
   */
  async testEventPropagation(
    sourceConnectionId: string,
    targetConnectionIds: string[],
    event: WebSocketMessage,
    expectedType: string
  ): Promise<{
    sent: boolean;
    received: Array<{ connectionId: string; success: boolean; message?: WebSocketMessage; error?: string; }>;
    propagationTime: number;
  }> {
    const startTime = Date.now();

    // Set up listeners on target connections
    const receivePromises = targetConnectionIds.map(async (connectionId) => {
      try {
        const message = await this.waitForMessage(connectionId, expectedType, 3000);
        return {
          connectionId,
          success: true,
          message
        };
      } catch (error) {
        return {
          connectionId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Send event from source
    const sent = await this.sendMessage(sourceConnectionId, event);

    // Wait for all receivers to get the message
    const received = await Promise.all(receivePromises);
    const propagationTime = Date.now() - startTime;

    return {
      sent,
      received,
      propagationTime
    };
  }

  /**
   * Test connection stability under load
   */
  async testConnectionStability(
    connectionId: string,
    messageCount: number = 100,
    intervalMs: number = 10
  ): Promise<{
    messagesSent: number;
    messagesReceived: number;
    errors: number;
    avgResponseTime: number;
    connectionStable: boolean;
  }> {
    let messagesSent = 0;
    let messagesReceived = 0;
    let errors = 0;
    let totalResponseTime = 0;
    const responsePromises: Promise<void>[] = [];

    // Set up message counter
    const messageHandler = (message: WebSocketMessage) => {
      if (message.type === 'ping_response') {
        messagesReceived++;
        
        const sentTime = message.data?.sentTime;
        if (sentTime) {
          totalResponseTime += Date.now() - sentTime;
        }
      }
    };

    this.addMessageHandler(connectionId, 'ping_response', messageHandler);

    // Send messages at intervals
    for (let i = 0; i < messageCount; i++) {
      try {
        const sent = await this.sendMessage(connectionId, {
          type: 'ping',
          data: { index: i, sentTime: Date.now() }
        });

        if (sent) {
          messagesSent++;
        } else {
          errors++;
        }

        if (intervalMs > 0) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      } catch (error) {
        errors++;
      }
    }

    // Wait for remaining responses
    await new Promise(resolve => setTimeout(resolve, 2000));

    this.removeMessageHandler(connectionId, 'ping_response', messageHandler);

    const avgResponseTime = messagesReceived > 0 ? totalResponseTime / messagesReceived : 0;
    const connectionInfo = this.connectionInfo.get(connectionId);
    const connectionStable = connectionInfo?.connected ?? false;

    return {
      messagesSent,
      messagesReceived,
      errors,
      avgResponseTime,
      connectionStable
    };
  }

  /**
   * Test multiple concurrent connections
   */
  async testConcurrentConnections(
    connectionCount: number,
    path: string = '/ws',
    options: { token?: string } = {}
  ): Promise<{
    successfulConnections: number;
    failedConnections: number;
    connectionIds: string[];
    avgConnectionTime: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const connectionPromises: Promise<{ success: boolean; connectionId?: string; error?: string }>[] = [];
    const errors: string[] = [];

    // Create connections concurrently
    for (let i = 0; i < connectionCount; i++) {
      const promise = this.createConnection(path, {
        ...options,
        userId: `test-user-${i}`
      }).then(connectionId => ({
        success: true,
        connectionId
      })).catch(error => ({
        success: false,
        error: error.message
      }));

      connectionPromises.push(promise);
    }

    const results = await Promise.all(connectionPromises);

    const successfulConnections = results.filter(r => r.success).length;
    const failedConnections = results.filter(r => !r.success).length;
    const connectionIds = results
      .filter(r => r.success && r.connectionId)
      .map(r => r.connectionId!);

    results.forEach(result => {
      if (!result.success && result.error) {
        errors.push(result.error);
      }
    });

    const totalTime = Date.now() - startTime;
    const avgConnectionTime = connectionCount > 0 ? totalTime / connectionCount : 0;

    return {
      successfulConnections,
      failedConnections,
      connectionIds,
      avgConnectionTime,
      errors
    };
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(connectionId: string, data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      
      // Update connection info
      const info = this.connectionInfo.get(connectionId);
      if (info) {
        info.lastActivity = new Date();
        info.messageCount++;
      }

      // Emit to event handlers
      this.emit(`message:${connectionId}:${message.type}`, message);
      this.emit(`message:${connectionId}`, message);
      this.emit('message', connectionId, message);

      // Call registered handlers
      const handlers = this.messageHandlers.get(`${connectionId}:${message.type}`) || [];
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('Message handler error:', error);
        }
      });

    } catch (error) {
      console.error(`Error parsing WebSocket message from ${connectionId}:`, error);
    }
  }

  /**
   * Add message handler
   */
  private addMessageHandler(connectionId: string, messageType: string, handler: Function): void {
    const key = `${connectionId}:${messageType}`;
    if (!this.messageHandlers.has(key)) {
      this.messageHandlers.set(key, []);
    }
    this.messageHandlers.get(key)!.push(handler);
  }

  /**
   * Remove message handler
   */
  private removeMessageHandler(connectionId: string, messageType: string, handler: Function): void {
    const key = `${connectionId}:${messageType}`;
    const handlers = this.messageHandlers.get(key);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
      if (handlers.length === 0) {
        this.messageHandlers.delete(key);
      }
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    activeConnections: number;
    authenticatedConnections: number;
    totalMessages: number;
    avgMessagesPerConnection: number;
  } {
    const connections = Array.from(this.connectionInfo.values());
    const activeConnections = connections.filter(c => c.connected).length;
    const authenticatedConnections = connections.filter(c => c.authenticated).length;
    const totalMessages = connections.reduce((sum, c) => sum + c.messageCount, 0);
    
    return {
      totalConnections: connections.length,
      activeConnections,
      authenticatedConnections,
      totalMessages,
      avgMessagesPerConnection: connections.length > 0 ? totalMessages / connections.length : 0
    };
  }

  /**
   * Get connection info
   */
  getConnectionInfo(connectionId: string): ConnectionInfo | null {
    return this.connectionInfo.get(connectionId) || null;
  }

  /**
   * List all connections
   */
  listConnections(): ConnectionInfo[] {
    return Array.from(this.connectionInfo.values());
  }

  /**
   * Ping connection
   */
  async pingConnection(connectionId: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      await this.sendMessage(connectionId, {
        type: 'ping',
        data: { timestamp: startTime }
      });

      const response = await this.waitForMessage(connectionId, 'pong', 3000);
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Ping failed'
      };
    }
  }

  /**
   * Cleanup all connections
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up WebSocket test helper...');
    
    const closePromises = Array.from(this.connections.keys()).map(connectionId =>
      this.closeConnection(connectionId)
    );

    await Promise.all(closePromises);
    
    this.messageHandlers.clear();
    this.removeAllListeners();
    
    console.log('✅ WebSocket test helper cleanup complete');
  }
}