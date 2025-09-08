/**
 * Validation Helpers - Common response validation and data checking utilities
 */

// Context7 Pattern: Define proper response types for type safety
interface ApiResponse<T = unknown> {
  status: number;
  body: {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
  };
}

interface MediaItem {
  id: string;
  title: string;
  mediaType: 'movie' | 'tv';
  overview?: string;
  releaseDate?: string;
}

interface RequestItem {
  id: string;
  mediaId: string;
  userId: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
}

interface PaginationResponse<T> {
  data: T[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface DashboardStats {
  users: {
    total: number;
    active?: number;
  };
  requests: {
    total: number;
    pending: number;
    approved?: number;
    denied?: number;
  };
  system: {
    uptime?: number;
    version?: string;
  };
}

interface PerformanceMetrics {
  duration: number;
  memory?: {
    used: number;
    limit: number;
  };
}

export class ValidationHelper {
  /**
   * Validate API response structure
   */
  static validateApiResponse(response: ApiResponse, expectedStatus: number = 200): boolean {
    try {
      expect(response.status).toBe(expectedStatus);
      expect(response.body).toBeDefined();
      expect(typeof response.body).toBe('object');

      if (expectedStatus < 400) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      } else {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate media search response structure
   */
  static validateMediaSearchResponse(response: ApiResponse<MediaItem[]>): boolean {
    try {
      this.validateApiResponse(response, 200);

      const { data } = response.body;
      expect(Array.isArray(data)).toBe(true);

      if (data.length > 0) {
        const firstItem = data[0];
        expect(firstItem).toHaveProperty('id');
        expect(firstItem).toHaveProperty('title');
        expect(firstItem).toHaveProperty('mediaType');
        expect(['movie', 'tv']).toContain(firstItem.mediaType);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate request list response structure
   */
  static validateRequestListResponse(response: ApiResponse<RequestItem[]>): boolean {
    try {
      this.validateApiResponse(response, 200);

      const { data } = response.body;
      expect(data).toHaveProperty('requests');
      expect(Array.isArray(data.requests)).toBe(true);

      if (data.requests.length > 0) {
        const firstRequest = data.requests[0];
        expect(firstRequest).toHaveProperty('id');
        expect(firstRequest).toHaveProperty('status');
        expect(firstRequest).toHaveProperty('media');
        expect(firstRequest.media).toHaveProperty('tmdbId');
      }

      // Check pagination if present
      if (data.pagination) {
        expect(data.pagination).toHaveProperty('page');
        expect(data.pagination).toHaveProperty('pageSize');
        expect(data.pagination).toHaveProperty('total');
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate single request response structure
   */
  static validateRequestResponse(response: ApiResponse<RequestItem>): boolean {
    try {
      this.validateApiResponse(response, 200);

      const { data } = response.body;
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('media');
      expect(data).toHaveProperty('requestedBy');
      expect(data).toHaveProperty('requestedAt');

      const validStatuses = ['pending', 'approved', 'rejected', 'fulfilled'];
      expect(validStatuses).toContain(data.status);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate user authentication response
   */
  static validateAuthResponse(response: ApiResponse<{ token: string; user: object }>): boolean {
    try {
      this.validateApiResponse(response, 200);

      const { data } = response.body;
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('id');
      expect(data.user).toHaveProperty('username');
      expect(data.user).toHaveProperty('role');
      expect(['admin', 'user']).toContain(data.user.role);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate error response structure
   */
  static validateErrorResponse(response: ApiResponse, expectedStatus: number): boolean {
    try {
      expect(response.status).toBe(expectedStatus);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toHaveProperty('message');
      expect(typeof response.body.error.message).toBe('string');

      if (response.body.error.code) {
        expect(typeof response.body.error.code).toBe('string');
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate pagination response
   */
  static validatePaginationResponse(
    response: ApiResponse<PaginationResponse<unknown>>,
    expectedPage: number = 1,
    expectedPageSize: number = 20
  ): boolean {
    try {
      this.validateApiResponse(response, 200);

      const pagination = response.body.data.pagination || response.body.meta;
      expect(pagination).toBeDefined();
      expect(pagination.page).toBe(expectedPage);
      expect(pagination.pageSize).toBe(expectedPageSize);
      expect(typeof pagination.total).toBe('number');
      expect(typeof pagination.totalPages).toBe('number');

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate admin dashboard stats response
   */
  static validateDashboardStatsResponse(response: ApiResponse<DashboardStats>): boolean {
    try {
      this.validateApiResponse(response, 200);

      const { data } = response.body;
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('requests');
      expect(data).toHaveProperty('system');

      expect(typeof data.users.total).toBe('number');
      expect(typeof data.requests.total).toBe('number');
      expect(typeof data.requests.pending).toBe('number');

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate session timeout response
   */
  static validateSessionTimeoutResponse(response: ApiResponse): boolean {
    try {
      return (
        this.validateErrorResponse(response, 401) && response.body.error.code === 'TOKEN_EXPIRED'
      );
    } catch {
      return false;
    }
  }

  /**
   * Validate rate limit response
   */
  static validateRateLimitResponse(response: ApiResponse): boolean {
    try {
      const isValid = this.validateErrorResponse(response, 429);
      if (!isValid) return false;

      expect(response.body.error.code).toBe('RATE_LIMITED');

      if (response.body.error.retryAfter) {
        expect(typeof response.body.error.retryAfter).toBe('number');
        expect(response.body.error.retryAfter).toBeGreaterThan(0);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate user isolation (no access to other user's data)
   */
  static validateUserIsolation(
    userRequests: RequestItem[],
    otherUserRequests: RequestItem[]
  ): boolean {
    try {
      const userIds = userRequests.map((r) => r.id);
      const otherUserIds = otherUserRequests.map((r) => r.id);

      const overlap = userIds.filter((id) => otherUserIds.includes(id));
      expect(overlap.length).toBe(0);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate performance metrics
   */
  static validatePerformanceMetrics(
    metrics: PerformanceMetrics,
    thresholds: { maxDuration: number }
  ): boolean {
    try {
      expect(metrics.duration).toBeGreaterThan(0);
      expect(metrics.duration).toBeLessThan(thresholds.maxDuration);

      if (metrics.memory) {
        expect(typeof metrics.memory.heapUsed).toBe('number');
        expect(metrics.memory.heapUsed).toBeGreaterThan(0);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate data consistency across operations
   */
  static validateDataConsistency(
    initialData: any,
    updatedData: any,
    expectedChanges: string[]
  ): boolean {
    try {
      // Check that non-changed fields remain the same
      for (const key of Object.keys(initialData)) {
        if (!expectedChanges.includes(key)) {
          expect(updatedData[key]).toEqual(initialData[key]);
        }
      }

      // Check that expected changes occurred
      for (const key of expectedChanges) {
        expect(updatedData[key]).not.toEqual(initialData[key]);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate security headers
   */
  static validateSecurityHeaders(response: any): boolean {
    try {
      const headers = response.headers || {};

      // Check for common security headers
      const requiredHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'strict-transport-security',
      ];

      for (const header of requiredHeaders) {
        expect(headers[header]).toBeDefined();
      }

      return true;
    } catch {
      return false;
    }
  }
}
