/**
 * Snapshot Tests for useOptimizedWebSocket Hook
 * Tests visual consistency of components using WebSocket connectivity
 */

import React, { useEffect, useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { render, fireEvent, act } from '../../test-utils/render';
import { useOptimizedWebSocket, useTypedWebSocketMessage } from '../useOptimizedWebSocket';

// Mock WebSocket for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  public readyState = MockWebSocket.CONNECTING;
  public url: string;
  public protocols: string[];

  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  constructor(url: string, protocols: string[] = []) {
    this.url = url;
    this.protocols = protocols;

    // Simulate connection after a brief delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Echo back the sent message for testing
    setTimeout(() => {
      this.onmessage?.(new MessageEvent('message', { data }));
    }, 5);
  }

  close() {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.onclose?.(new CloseEvent('close'));
    }, 5);
  }

  // Method to simulate receiving a message
  simulateMessage(data: any) {
    if (this.readyState === MockWebSocket.OPEN) {
      const messageData = typeof data === 'string' ? data : JSON.stringify(data);
      this.onmessage?.(new MessageEvent('message', { data: messageData }));
    }
  }

  // Method to simulate connection error
  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

// Replace global WebSocket with mock
global.WebSocket = MockWebSocket as any;

// Test component for basic WebSocket functionality
const WebSocketComponent = ({
  url = 'ws://localhost:8080/test',
  options = {},
}: {
  url?: string;
  options?: any;
}) => {
  const ws = useOptimizedWebSocket(url, options);

  return (
    <div data-testid='websocket-component'>
      <div className='connection-info'>
        <div data-testid='ws-status'>{ws.status}</div>
        <div data-testid='ws-connected'>{ws.isConnected ? 'Connected' : 'Not Connected'}</div>
        <div data-testid='ws-connecting'>{ws.isConnecting ? 'Connecting' : 'Not Connecting'}</div>
        <div data-testid='ws-error'>{ws.error ? ws.error.message : 'No Error'}</div>
        <div data-testid='ws-connection-id'>{ws.connectionId || 'No Connection ID'}</div>
      </div>

      <div className='message-info'>
        <div data-testid='ws-message-count'>{ws.messageCount}</div>
        <div data-testid='ws-message-history'>
          {ws.messageHistory.map((msg) => (
            <div key={msg.id} className='message-item'>
              <span className='message-type'>{msg.type}</span>
              <span className='message-payload'>{JSON.stringify(msg.payload)}</span>
              <span className='message-timestamp'>{msg.timestamp.toISOString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className='reconnect-info'>
        <div data-testid='ws-reconnect-attempts'>{ws.reconnectAttempts}</div>
        <div data-testid='ws-max-reconnect-attempts'>{ws.maxReconnectAttempts}</div>
      </div>

      <div className='controls'>
        <button data-testid='connect-btn' onClick={ws.connect}>
          Connect
        </button>
        <button data-testid='disconnect-btn' onClick={ws.disconnect}>
          Disconnect
        </button>
        <button
          data-testid='send-message-btn'
          onClick={() => ws.sendMessage('test', { message: 'Hello WebSocket!' })}
        >
          Send Message
        </button>
      </div>
    </div>
  );
};

// Test component for typed WebSocket messages
const TypedWebSocketComponent = ({ url = 'ws://localhost:8080/typed' }: { url?: string }) => {
  const ws = useOptimizedWebSocket<{ content: string; timestamp: number }>(url);
  const chatMessages = useTypedWebSocketMessage(ws, 'chat');
  const systemMessages = useTypedWebSocketMessage(ws, 'system');

  return (
    <div data-testid='typed-websocket-component'>
      <div className='connection-status'>
        <div data-testid='typed-ws-status'>{ws.status}</div>
      </div>

      <div className='chat-messages'>
        <h3>Chat Messages</h3>
        <div data-testid='chat-message-count'>{chatMessages.messages.length}</div>
        <div data-testid='chat-latest-message'>
          {chatMessages.latestMessage
            ? JSON.stringify(chatMessages.latestMessage.payload)
            : 'No messages'}
        </div>
        <div data-testid='chat-messages-list'>
          {chatMessages.messages.map((msg) => (
            <div key={msg.id} className='chat-message'>
              {JSON.stringify(msg.payload)}
            </div>
          ))}
        </div>
      </div>

      <div className='system-messages'>
        <h3>System Messages</h3>
        <div data-testid='system-message-count'>{systemMessages.messages.length}</div>
        <div data-testid='system-latest-message'>
          {systemMessages.latestMessage
            ? JSON.stringify(systemMessages.latestMessage.payload)
            : 'No messages'}
        </div>
      </div>

      <div className='typed-controls'>
        <button
          data-testid='send-chat-btn'
          onClick={() =>
            chatMessages.sendTypedMessage({
              content: 'Hello from chat!',
              timestamp: Date.now(),
            })
          }
        >
          Send Chat
        </button>
        <button
          data-testid='send-system-btn'
          onClick={() =>
            systemMessages.sendTypedMessage({
              content: 'System notification',
              timestamp: Date.now(),
            })
          }
        >
          Send System
        </button>
      </div>
    </div>
  );
};

// Complex component combining multiple WebSocket features
const ComplexWebSocketComponent = () => {
  const [customUrl, setCustomUrl] = useState('ws://localhost:8080/complex');
  const [messageFilter, setMessageFilter] = useState('all');

  const ws = useOptimizedWebSocket(customUrl, {
    protocols: ['chat-protocol', 'data-protocol'],
    maxReconnectAttempts: 3,
    reconnectInterval: 1000,
    heartbeatInterval: 5000,
    messageBufferSize: 50,
    autoConnect: true,
  });

  const filteredMessages = ws.messageHistory.filter(
    (msg) => messageFilter === 'all' || msg.type === messageFilter,
  );

  return (
    <div data-testid='complex-websocket-component'>
      <div className='config-section'>
        <h3>Configuration</h3>
        <input
          data-testid='url-input'
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          placeholder='WebSocket URL'
        />
        <select
          data-testid='message-filter'
          value={messageFilter}
          onChange={(e) => setMessageFilter(e.target.value)}
        >
          <option value='all'>All Messages</option>
          <option value='chat'>Chat Messages</option>
          <option value='system'>System Messages</option>
          <option value='data'>Data Messages</option>
        </select>
      </div>

      <div className='status-section'>
        <h3>Connection Status</h3>
        <div data-testid='complex-ws-status'>{ws.status}</div>
        <div data-testid='complex-ws-protocols'>
          {JSON.stringify(['chat-protocol', 'data-protocol'])}
        </div>
        <div data-testid='complex-ws-options'>
          Max Reconnects: {ws.maxReconnectAttempts}, Current Attempts: {ws.reconnectAttempts}
        </div>
      </div>

      <div className='messages-section'>
        <h3>Messages ({filteredMessages.length})</h3>
        <div data-testid='complex-filtered-messages'>
          {filteredMessages.map((msg) => (
            <div key={msg.id} className={`complex-message ${msg.type}`}>
              <span className='type'>{msg.type}</span>
              <span className='payload'>{JSON.stringify(msg.payload)}</span>
              <span className='time'>{msg.timestamp.toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className='actions-section'>
        <h3>Actions</h3>
        <button onClick={() => ws.sendMessage('chat', { text: 'Complex chat message' })}>
          Send Chat
        </button>
        <button onClick={() => ws.sendMessage('system', { alert: 'System alert' })}>
          Send System
        </button>
        <button onClick={() => ws.sendMessage('data', { values: [1, 2, 3, 4, 5] })}>
          Send Data
        </button>
      </div>
    </div>
  );
};

describe('useOptimizedWebSocket Hook Snapshot Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-12T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Basic WebSocket Component Snapshots', () => {
    it('should match snapshot in initial connecting state', () => {
      const { container } = render(<WebSocketComponent />);

      expect(container.firstChild).toMatchSnapshot('websocket-initial-connecting');
    });

    it('should match snapshot after connection established', async () => {
      const { container } = render(<WebSocketComponent />);

      // Fast forward to complete connection
      act(() => {
        vi.advanceTimersByTime(20);
      });

      expect(container.firstChild).toMatchSnapshot('websocket-connected');
    });

    it('should match snapshot with custom URL', () => {
      const { container } = render(<WebSocketComponent url='wss://secure.example.com/websocket' />);

      expect(container.firstChild).toMatchSnapshot('websocket-custom-url');
    });

    it('should match snapshot with custom options', () => {
      const options = {
        maxReconnectAttempts: 10,
        reconnectInterval: 5000,
        heartbeatInterval: 10000,
        messageBufferSize: 200,
        autoConnect: false,
      };

      const { container } = render(<WebSocketComponent options={options} />);

      expect(container.firstChild).toMatchSnapshot('websocket-custom-options');
    });

    it('should match snapshot after manual connection', () => {
      const options = { autoConnect: false };
      const { container, getByTestId } = render(<WebSocketComponent options={options} />);

      const connectBtn = getByTestId('connect-btn');
      act(() => {
        fireEvent.click(connectBtn);
        vi.advanceTimersByTime(20);
      });

      expect(container.firstChild).toMatchSnapshot('websocket-manual-connection');
    });

    it('should match snapshot after disconnection', () => {
      const { container, getByTestId } = render(<WebSocketComponent />);

      act(() => {
        vi.advanceTimersByTime(20); // Connect
      });

      const disconnectBtn = getByTestId('disconnect-btn');
      act(() => {
        fireEvent.click(disconnectBtn);
        vi.advanceTimersByTime(20); // Disconnect
      });

      expect(container.firstChild).toMatchSnapshot('websocket-disconnected');
    });

    it('should match snapshot with sent message', () => {
      const { container, getByTestId } = render(<WebSocketComponent />);

      act(() => {
        vi.advanceTimersByTime(20); // Connect
      });

      const sendBtn = getByTestId('send-message-btn');
      act(() => {
        fireEvent.click(sendBtn);
        vi.advanceTimersByTime(10); // Process message
      });

      expect(container.firstChild).toMatchSnapshot('websocket-with-sent-message');
    });
  });

  describe('Typed WebSocket Component Snapshots', () => {
    it('should match snapshot with no messages', () => {
      const { container } = render(<TypedWebSocketComponent />);

      act(() => {
        vi.advanceTimersByTime(20);
      });

      expect(container.firstChild).toMatchSnapshot('typed-websocket-no-messages');
    });

    it('should match snapshot with chat messages', () => {
      const { container, getByTestId } = render(<TypedWebSocketComponent />);

      act(() => {
        vi.advanceTimersByTime(20); // Connect
      });

      const sendChatBtn = getByTestId('send-chat-btn');
      act(() => {
        fireEvent.click(sendChatBtn);
        fireEvent.click(sendChatBtn);
        vi.advanceTimersByTime(10);
      });

      expect(container.firstChild).toMatchSnapshot('typed-websocket-chat-messages');
    });

    it('should match snapshot with mixed message types', () => {
      const { container, getByTestId } = render(<TypedWebSocketComponent />);

      act(() => {
        vi.advanceTimersByTime(20); // Connect
      });

      const sendChatBtn = getByTestId('send-chat-btn');
      const sendSystemBtn = getByTestId('send-system-btn');

      act(() => {
        fireEvent.click(sendChatBtn);
        fireEvent.click(sendSystemBtn);
        fireEvent.click(sendChatBtn);
        vi.advanceTimersByTime(15);
      });

      expect(container.firstChild).toMatchSnapshot('typed-websocket-mixed-messages');
    });

    it('should match snapshot with latest message display', () => {
      const { container, getByTestId } = render(<TypedWebSocketComponent />);

      act(() => {
        vi.advanceTimersByTime(20);
      });

      const sendChatBtn = getByTestId('send-chat-btn');
      act(() => {
        fireEvent.click(sendChatBtn);
        vi.advanceTimersByTime(10);
      });

      expect(container.firstChild).toMatchSnapshot('typed-websocket-latest-message');
    });
  });

  describe('Complex WebSocket Component Snapshots', () => {
    it('should match snapshot with initial configuration', () => {
      const { container } = render(<ComplexWebSocketComponent />);

      expect(container.firstChild).toMatchSnapshot('complex-websocket-initial');
    });

    it('should match snapshot with custom URL configuration', () => {
      const { container, getByTestId } = render(<ComplexWebSocketComponent />);

      const urlInput = getByTestId('url-input');
      act(() => {
        fireEvent.change(urlInput, {
          target: { value: 'wss://production.example.com/realtime' },
        });
      });

      expect(container.firstChild).toMatchSnapshot('complex-websocket-custom-url');
    });

    it('should match snapshot with message filtering', () => {
      const { container, getByTestId } = render(<ComplexWebSocketComponent />);

      act(() => {
        vi.advanceTimersByTime(20); // Connect
      });

      // Send various message types
      const chatBtn = getByTestId('complex-websocket-component')?.querySelector(
        'button:nth-of-type(1)',
      ) as HTMLButtonElement;
      const systemBtn = getByTestId('complex-websocket-component')?.querySelector(
        'button:nth-of-type(2)',
      ) as HTMLButtonElement;

      act(() => {
        chatBtn?.click();
        systemBtn?.click();
        vi.advanceTimersByTime(10);
      });

      // Filter to chat messages only
      const filterSelect = getByTestId('message-filter');
      act(() => {
        fireEvent.change(filterSelect, { target: { value: 'chat' } });
      });

      expect(container.firstChild).toMatchSnapshot('complex-websocket-filtered-chat');
    });

    it('should match snapshot with all message types', () => {
      const { container, getByTestId } = render(<ComplexWebSocketComponent />);

      act(() => {
        vi.advanceTimersByTime(20);
      });

      // Send all types of messages
      const component = getByTestId('complex-websocket-component');
      const buttons = component.querySelectorAll('.actions-section button');

      act(() => {
        buttons[0]?.dispatchEvent(new Event('click', { bubbles: true }));
        buttons[1]?.dispatchEvent(new Event('click', { bubbles: true }));
        buttons[2]?.dispatchEvent(new Event('click', { bubbles: true }));
        vi.advanceTimersByTime(15);
      });

      expect(container.firstChild).toMatchSnapshot('complex-websocket-all-message-types');
    });

    it('should match snapshot with system messages filter', () => {
      const { container, getByTestId } = render(<ComplexWebSocketComponent />);

      const filterSelect = getByTestId('message-filter');
      act(() => {
        fireEvent.change(filterSelect, { target: { value: 'system' } });
      });

      expect(container.firstChild).toMatchSnapshot('complex-websocket-system-filter');
    });
  });

  describe('Error State Snapshots', () => {
    it('should match snapshot with connection error', () => {
      // Mock WebSocket to simulate error
      const originalWebSocket = global.WebSocket;
      global.WebSocket = class extends MockWebSocket {
        constructor(url: string, protocols?: string[]) {
          super(url, protocols);
          setTimeout(() => {
            this.simulateError();
          }, 15);
        }
      } as any;

      const { container } = render(<WebSocketComponent />);

      act(() => {
        vi.advanceTimersByTime(20);
      });

      expect(container.firstChild).toMatchSnapshot('websocket-connection-error');

      global.WebSocket = originalWebSocket;
    });

    it('should match snapshot with send message failure', () => {
      const { container, getByTestId } = render(<WebSocketComponent />);

      // Don't connect, try to send message
      const sendBtn = getByTestId('send-message-btn');
      act(() => {
        fireEvent.click(sendBtn);
      });

      expect(container.firstChild).toMatchSnapshot('websocket-send-failure');
    });
  });

  describe('Reconnection Snapshots', () => {
    it('should match snapshot during reconnection attempts', () => {
      const options = {
        maxReconnectAttempts: 3,
        reconnectInterval: 100,
      };

      // Mock WebSocket to close after connection
      const originalWebSocket = global.WebSocket;
      global.WebSocket = class extends MockWebSocket {
        constructor(url: string, protocols?: string[]) {
          super(url, protocols);
          setTimeout(() => {
            this.readyState = MockWebSocket.OPEN;
            this.onopen?.(new Event('open'));
            // Immediately close to trigger reconnection
            setTimeout(() => {
              this.readyState = MockWebSocket.CLOSED;
              this.onclose?.(new CloseEvent('close'));
            }, 5);
          }, 10);
        }
      } as any;

      const { container } = render(<WebSocketComponent options={options} />);

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(container.firstChild).toMatchSnapshot('websocket-reconnecting');

      global.WebSocket = originalWebSocket;
    });
  });

  describe('Message History Snapshots', () => {
    it('should match snapshot with message buffer limit', () => {
      const options = { messageBufferSize: 3 };
      const { container, getByTestId } = render(<WebSocketComponent options={options} />);

      act(() => {
        vi.advanceTimersByTime(20);
      });

      // Send more messages than buffer size
      const sendBtn = getByTestId('send-message-btn');
      act(() => {
        for (let i = 0; i < 5; i++) {
          fireEvent.click(sendBtn);
        }
        vi.advanceTimersByTime(30);
      });

      expect(container.firstChild).toMatchSnapshot('websocket-message-buffer-limit');
    });

    it('should match snapshot with empty message history', () => {
      const options = { autoConnect: false };
      const { container } = render(<WebSocketComponent options={options} />);

      expect(container.firstChild).toMatchSnapshot('websocket-empty-message-history');
    });
  });

  describe('Protocol and Configuration Snapshots', () => {
    it('should match snapshot with multiple protocols', () => {
      const options = {
        protocols: ['chat-protocol-v1', 'data-protocol-v2', 'admin-protocol'],
      };
      const { container } = render(<WebSocketComponent options={options} />);

      expect(container.firstChild).toMatchSnapshot('websocket-multiple-protocols');
    });

    it('should match snapshot with disabled auto-connect', () => {
      const options = { autoConnect: false };
      const { container } = render(<WebSocketComponent options={options} />);

      expect(container.firstChild).toMatchSnapshot('websocket-disabled-auto-connect');
    });

    it('should match snapshot with custom heartbeat interval', () => {
      const options = { heartbeatInterval: 1000 };
      const { container } = render(<WebSocketComponent options={options} />);

      act(() => {
        vi.advanceTimersByTime(20);
      });

      expect(container.firstChild).toMatchSnapshot('websocket-custom-heartbeat');
    });
  });
});
