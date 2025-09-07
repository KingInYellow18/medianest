import { v4 as uuidv4 } from 'uuid';

/**
 * Frontend tracing utilities for correlation with backend traces
 */
export class FrontendTracer {
  private correlationId: string;
  private sessionId: string;

  constructor() {
    // Initialize or restore correlation and session IDs
    this.correlationId = this.getOrCreateCorrelationId();
    this.sessionId = this.getOrCreateSessionId();
  }

  /**
   * Get or create correlation ID for the current request
   */
  private getOrCreateCorrelationId(): string {
    const stored = sessionStorage.getItem('correlationId');
    if (stored) return stored;
    
    const newId = uuidv4();
    sessionStorage.setItem('correlationId', newId);
    return newId;
  }

  /**
   * Get or create session ID for the current user session
   */
  private getOrCreateSessionId(): string {
    const stored = localStorage.getItem('sessionId');
    if (stored) return stored;
    
    const newId = uuidv4();
    localStorage.setItem('sessionId', newId);
    return newId;
  }

  /**
   * Create a new correlation ID for a new logical operation
   */
  createNewCorrelation(): string {
    this.correlationId = uuidv4();
    sessionStorage.setItem('correlationId', this.correlationId);
    return this.correlationId;
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Add tracing headers to HTTP requests
   */
  getTracingHeaders(): Record<string, string> {
    return {
      'X-Correlation-ID': this.correlationId,
      'X-Session-ID': this.sessionId,
      'X-User-Agent': navigator.userAgent,
      'X-Timestamp': new Date().toISOString(),
    };
  }

  /**
   * Create a client-side span for tracking operations
   */
  startClientSpan(operationName: string, attributes?: Record<string, any>) {
    const spanId = uuidv4();
    const startTime = performance.now();
    
    const span = {
      spanId,
      operationName,
      startTime,
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      attributes: {
        'client.operation': operationName,
        'client.url': window.location.href,
        'client.user_agent': navigator.userAgent,
        'client.timestamp': new Date().toISOString(),
        ...attributes,
      },
      events: [] as Array<{ name: string; timestamp: number; attributes?: any }>,
      
      // Add event to span
      addEvent: function(name: string, attributes?: any) {
        this.events.push({
          name,
          timestamp: performance.now(),
          attributes,
        });
      },
      
      // Set attributes
      setAttributes: function(attrs: Record<string, any>) {
        Object.assign(this.attributes, attrs);
      },
      
      // End span and send to backend
      end: () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        const spanData = {
          ...span,
          endTime,
          duration,
          status: 'OK',
        };
        
        // Send span data to backend for correlation
        this.sendSpanToBackend(spanData);
        
        return spanData;
      },
      
      // End span with error
      endWithError: function(error: Error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        const spanData = {
          ...span,
          endTime,
          duration,
          status: 'ERROR',
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        };
        
        // Send span data to backend for correlation
        tracer.sendSpanToBackend(spanData);
        
        return spanData;
      },
    };
    
    return span;
  }

  /**
   * Send client span data to backend for correlation
   */
  private async sendSpanToBackend(spanData: any): Promise<void> {
    try {
      // Only send in development or if explicitly enabled
      if (process.env.NODE_ENV !== 'development' && !process.env.REACT_APP_CLIENT_TRACING) {
        return;
      }

      const response = await fetch('/api/traces/client-spans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getTracingHeaders(),
        },
        body: JSON.stringify(spanData),
      });

      if (!response.ok) {
        console.warn('Failed to send client span data:', response.status);
      }
    } catch (error) {
      console.warn('Error sending client span data:', error);
    }
  }

  /**
   * Track page navigation
   */
  trackNavigation(from: string, to: string): void {
    const span = this.startClientSpan('page.navigation', {
      'navigation.from': from,
      'navigation.to': to,
      'navigation.type': 'client_side',
    });
    
    // End immediately for navigation events
    setTimeout(() => span.end(), 0);
  }

  /**
   * Track user interactions
   */
  trackInteraction(element: string, action: string, attributes?: Record<string, any>): void {
    const span = this.startClientSpan('user.interaction', {
      'interaction.element': element,
      'interaction.action': action,
      'interaction.timestamp': Date.now(),
      ...attributes,
    });
    
    // End immediately for interaction events
    setTimeout(() => span.end(), 0);
  }

  /**
   * Track API calls with automatic correlation
   */
  async trackAPICall<T>(
    url: string,
    options: RequestInit,
    operationName?: string
  ): Promise<T> {
    const span = this.startClientSpan(
      operationName || `api.${options.method?.toLowerCase() || 'get'}`,
      {
        'http.method': options.method || 'GET',
        'http.url': url,
        'http.client': 'fetch',
      }
    );

    try {
      // Add tracing headers
      const headers = {
        ...options.headers,
        ...this.getTracingHeaders(),
      };

      const response = await fetch(url, {
        ...options,
        headers,
      });

      span.setAttributes({
        'http.status_code': response.status,
        'http.status_text': response.statusText,
        'http.response_size': response.headers.get('content-length') || 0,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      span.end();
      return data;

    } catch (error) {
      span.endWithError(error as Error);
      throw error;
    }
  }

  /**
   * Track performance metrics
   */
  trackPerformance(): void {
    // Track page load performance
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (navigation) {
        const span = this.startClientSpan('page.load', {
          'performance.dom_content_loaded': navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          'performance.load_complete': navigation.loadEventEnd - navigation.loadEventStart,
          'performance.dns_lookup': navigation.domainLookupEnd - navigation.domainLookupStart,
          'performance.tcp_connect': navigation.connectEnd - navigation.connectStart,
          'performance.response_time': navigation.responseEnd - navigation.responseStart,
          'performance.dom_processing': navigation.domComplete - navigation.domLoading,
        });
        
        span.end();
      }
    });

    // Track Core Web Vitals if available
    if ('web-vital' in window) {
      // This would require the web-vitals library
      // import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';
    }
  }
}

// Export singleton instance
export const tracer = new FrontendTracer();

// Auto-track navigation for SPAs
if (typeof window !== 'undefined') {
  let currentPath = window.location.pathname;
  
  // Track initial page load
  tracer.trackNavigation('', currentPath);
  
  // Track route changes (for React Router, etc.)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(state, title, url) {
    const previousPath = currentPath;
    originalPushState.call(history, state, title, url);
    currentPath = window.location.pathname;
    tracer.trackNavigation(previousPath, currentPath);
  };
  
  history.replaceState = function(state, title, url) {
    const previousPath = currentPath;
    originalReplaceState.call(history, state, title, url);
    currentPath = window.location.pathname;
    tracer.trackNavigation(previousPath, currentPath);
  };
  
  // Track back/forward navigation
  window.addEventListener('popstate', () => {
    const previousPath = currentPath;
    currentPath = window.location.pathname;
    tracer.trackNavigation(previousPath, currentPath);
  });
  
  // Initialize performance tracking
  tracer.trackPerformance();
}