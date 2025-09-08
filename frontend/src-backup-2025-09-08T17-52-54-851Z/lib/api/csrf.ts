import { apiClient } from './client';

export interface CSRFToken {
  token: string;
  expiresIn: number;
}

export interface CSRFStats {
  totalTokens: number;
  averageAgeSeconds: number;
  protection: string;
  tokenTtlSeconds: number;
}

/**
 * CSRF API client
 */
class CSRFClient {
  /**
   * Get CSRF token
   */
  async getToken(): Promise<CSRFToken> {
    const response = await apiClient.get('/csrf/token');
    return response.data;
  }

  /**
   * Refresh CSRF token
   */
  async refreshToken(): Promise<CSRFToken> {
    const response = await apiClient.post('/csrf/refresh');
    return response.data;
  }

  /**
   * Get CSRF statistics (admin only)
   */
  async getStats(): Promise<CSRFStats> {
    const response = await apiClient.get('/csrf/stats');
    return response.data;
  }
}

export const csrfClient = new CSRFClient();
