import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Context7 Pattern - Branded types for WebSocket management
type WebSocketUrl = string & { readonly __brand: 'WebSocketUrl' };
type MessageId = string & { readonly __brand: 'MessageId' };
type ConnectionId = string & { readonly __brand: 'ConnectionId' };

// Context7 Pattern - WebSocket state with discriminated unions
type WebSocketState =
  | { status: 'idle'; connection: null; error: null }
  | { status: 'connecting'; connection: WebSocket; error: null }
  | { status: 'connected'; connection: WebSocket; error: null }
  | { status: 'disconnecting'; connection: WebSocket; error: null }
  | { status: 'disconnected'; connection: null; error: null }
  | { status: 'error'; connection: WebSocket | null; error: Error };

// Context7 Pattern - Type-safe message interface
interface WebSocketMessage<T = any> {
  readonly id: MessageId;
  readonly type: string;
  readonly payload: T;
  readonly timestamp: Date;
}

// Context7 Pattern - WebSocket options with defaults
interface WebSocketOptions {
  readonly protocols?: string[];
  readonly maxReconnectAttempts?: number;
  readonly reconnectInterval?: number;
  readonly heartbeatInterval?: number;
  readonly messageBufferSize?: number;
  readonly autoConnect?: boolean;
}

// Context7 Pattern - Default options as const assertion
const DEFAULT_OPTIONS: Required<WebSocketOptions> = {
  protocols: [],
  maxReconnectAttempts: 5,
  reconnectInterval: 3000,
  heartbeatInterval: 30000,
  messageBufferSize: 100,
  autoConnect: true,
} as const;

// Context7 Pattern - Message buffer with bounded size
class MessageBuffer<T> {
  private buffer: WebSocketMessage<T>[] = [];

  constructor(private maxSize: number) {}

  add(message: WebSocketMessage<T>): void {
    this.buffer.push(message);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getAll(): ReadonlyArray<WebSocketMessage<T>> {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }

  get size(): number {
    return this.buffer.length;
  }
}

// Context7 Pattern - Optimized WebSocket hook with comprehensive state management
export function useOptimizedWebSocket<TMessage = any>(url: string, options: WebSocketOptions = {}) {
  const opts = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options]);
  const wsUrl = useMemo(() => url as WebSocketUrl, [url]);

  // Context7 Pattern - State management with branded types
  const [state, setState] = useState<WebSocketState>({
    status: 'idle',
    connection: null,
    error: null,
  });

  // Context7 Pattern - Refs for stable references across renders
  const connectionIdRef = useRef<ConnectionId | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageBufferRef = useRef<MessageBuffer<TMessage>>(
    new MessageBuffer(opts.messageBufferSize)
  );

  // Context7 Pattern - Memoized message listeners
  const [messageListeners, setMessageListeners] = useState<
    Map<string, Set<(message: WebSocketMessage<TMessage>) => void>>
  >(() => new Map());

  // Context7 Pattern - Cleanup function with proper resource disposal
  const cleanup = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    messageBufferRef.current.clear();
    connectionIdRef.current = null;
  }, []);

  // Context7 Pattern - Memoized connection function
  const connect = useCallback(() => {
    if (state.status === 'connected' || state.status === 'connecting') {
      return;
    }

    try {
      const ws = new WebSocket(wsUrl, opts.protocols);
      connectionIdRef.current = `ws-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}` as ConnectionId;

      setState({ status: 'connecting', connection: ws, error: null });

      ws.onopen = () => {
        setState({ status: 'connected', connection: ws, error: null });
        reconnectAttemptsRef.current = 0;

        // Context7 Pattern - Heartbeat for connection health
        if (opts.heartbeatInterval > 0) {
          heartbeatIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            }
          }, opts.heartbeatInterval);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const message: WebSocketMessage<TMessage> = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as MessageId,
            type: data.type || 'message',
            payload: data.payload || data,
            timestamp: new Date(),
          };

          // Context7 Pattern - Buffer messages for history
          messageBufferRef.current.add(message);

          // Context7 Pattern - Notify type-specific listeners
          const typeListeners = messageListeners.get(message.type);
          if (typeListeners) {
            typeListeners.forEach((listener) => listener(message));
          }

          // Context7 Pattern - Notify all message listeners
          const allListeners = messageListeners.get('*');
          if (allListeners) {
            allListeners.forEach((listener) => listener(message));
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        cleanup();
        setState({ status: 'disconnected', connection: null, error: null });

        // Context7 Pattern - Auto-reconnect logic
        if (reconnectAttemptsRef.current < opts.maxReconnectAttempts) {
          setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, opts.reconnectInterval);
        }
      };

      ws.onerror = () => {
        const error = new Error(`WebSocket connection failed for ${wsUrl}`);
        setState({ status: 'error', connection: ws, error });
        cleanup();
      };
    } catch (error) {
      setState({
        status: 'error',
        connection: null,
        error: error as Error,
      });
    }
  }, [wsUrl, opts, state.status, messageListeners, cleanup]);

  // Context7 Pattern - Memoized disconnect function
  const disconnect = useCallback(() => {
    if (state.connection) {
      setState({ status: 'disconnecting', connection: state.connection, error: null });
      state.connection.close();
    }
    cleanup();
  }, [state.connection, cleanup]);

  // Context7 Pattern - Type-safe message sending
  const sendMessage = useCallback(
    <T = TMessage>(type: string, payload: T): boolean => {
      if (state.status !== 'connected' || !state.connection) {
        return false;
      }

      try {
        const message = {
          type,
          payload,
          timestamp: Date.now(),
          id: connectionIdRef.current,
        };

        state.connection.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        return false;
      }
    },
    [state]
  );

  // Context7 Pattern - Memoized listener management
  const addMessageListener = useCallback(
    (type: string, listener: (message: WebSocketMessage<TMessage>) => void) => {
      setMessageListeners((prev) => {
        const newListeners = new Map(prev);
        if (!newListeners.has(type)) {
          newListeners.set(type, new Set());
        }
        newListeners.get(type)!.add(listener);
        return newListeners;
      });

      // Context7 Pattern - Return cleanup function
      return () => {
        setMessageListeners((prev) => {
          const newListeners = new Map(prev);
          const typeListeners = newListeners.get(type);
          if (typeListeners) {
            typeListeners.delete(listener);
            if (typeListeners.size === 0) {
              newListeners.delete(type);
            }
          }
          return newListeners;
        });
      };
    },
    []
  );

  // Context7 Pattern - Auto-connect on mount if enabled
  useEffect(() => {
    if (opts.autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [opts.autoConnect, connect, disconnect]);

  // Context7 Pattern - Memoized return value for performance
  return useMemo(
    () => ({
      // State
      status: state.status,
      isConnected: state.status === 'connected',
      isConnecting: state.status === 'connecting',
      error: state.error,
      connectionId: connectionIdRef.current,

      // Actions
      connect,
      disconnect,
      sendMessage,
      addMessageListener,

      // Data
      messageHistory: messageBufferRef.current.getAll(),
      messageCount: messageBufferRef.current.size,

      // Metadata
      reconnectAttempts: reconnectAttemptsRef.current,
      maxReconnectAttempts: opts.maxReconnectAttempts,
    }),
    [state, connect, disconnect, sendMessage, addMessageListener, opts.maxReconnectAttempts]
  );
}

// Context7 Pattern - Specialized hook for typed message handling
export function useTypedWebSocketMessage<TMessage = any>(
  webSocket: ReturnType<typeof useOptimizedWebSocket<TMessage>>,
  messageType: string
): {
  messages: ReadonlyArray<WebSocketMessage<TMessage>>;
  latestMessage: WebSocketMessage<TMessage> | null;
  sendTypedMessage: (payload: TMessage) => boolean;
} {
  const [messages, setMessages] = useState<WebSocketMessage<TMessage>[]>([]);

  useEffect(() => {
    const cleanup = webSocket.addMessageListener(messageType, (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return cleanup;
  }, [webSocket, messageType]);

  const sendTypedMessage = useCallback(
    (payload: TMessage) => {
      return webSocket.sendMessage(messageType, payload);
    },
    [webSocket, messageType]
  );

  return useMemo(
    () => ({
      messages,
      latestMessage: messages[messages.length - 1] || null,
      sendTypedMessage,
    }),
    [messages, sendTypedMessage]
  );
}
