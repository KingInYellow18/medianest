import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * API helper utilities for E2E testing
 * Provides methods to interact with the backend API for test setup and verification
 */
export class ApiHelpers {
  private client: AxiosInstance;
  private authToken?: string;

  constructor(baseURL: string = process.env.API_BASE_URL || 'http://localhost:3000') {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      if (this.authToken) {
        config.headers.Authorization = `Bearer ${this.authToken}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    this.authToken = undefined;
  }

  /**
   * Generic GET request
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  /**
   * Generic POST request
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  /**
   * Generic PUT request
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  /**
   * Generic PATCH request
   */
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(url, data, config);
    return response.data;
  }

  /**
   * Generic DELETE request
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }

  // Authentication endpoints
  /**
   * Login user
   */
  async login(email: string, password: string): Promise<{ user: any; token: string }> {
    const response = await this.post('/api/auth/login', { email, password });
    
    if (response.success && response.data.token) {
      this.setAuthToken(response.data.token);
    }
    
    return response.data;
  }

  /**
   * Register new user
   */
  async register(userData: {
    name: string;
    email: string;
    password: string;
    role?: string;
  }): Promise<{ user: any; token: string }> {
    const response = await this.post('/api/auth/register', userData);
    return response.data;
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await this.post('/api/auth/logout');
    this.clearAuthToken();
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<any> {
    const response = await this.get('/api/auth/me');
    return response.data;
  }

  /**
   * Refresh auth token
   */
  async refreshToken(): Promise<string> {
    const response = await this.post('/api/auth/refresh');
    const newToken = response.data.token;
    
    if (newToken) {
      this.setAuthToken(newToken);
    }
    
    return newToken;
  }

  // User management endpoints
  /**
   * Get all users (admin only)
   */
  async getUsers(params?: { page?: number; limit?: number; search?: string }): Promise<any> {
    const response = await this.get('/api/users', { params });
    return response.data;
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<any> {
    const response = await this.get(`/api/users/${userId}`);
    return response.data;
  }

  /**
   * Create user (admin only)
   */
  async createUser(userData: {
    name: string;
    email: string;
    password: string;
    role?: string;
  }): Promise<any> {
    const response = await this.post('/api/users', userData);
    return response.data;
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updates: any): Promise<any> {
    const response = await this.put(`/api/users/${userId}`, updates);
    return response.data;
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    await this.delete(`/api/users/${userId}`);
  }

  // Media request endpoints
  /**
   * Get media requests
   */
  async getMediaRequests(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    priority?: string;
    type?: string;
  }): Promise<any> {
    const response = await this.get('/api/requests', { params });
    return response.data;
  }

  /**
   * Get media request by ID
   */
  async getMediaRequest(requestId: string): Promise<any> {
    const response = await this.get(`/api/requests/${requestId}`);
    return response.data;
  }

  /**
   * Create media request
   */
  async createMediaRequest(requestData: {
    title: string;
    description: string;
    type: string;
    priority: string;
    dueDate?: string;
    metadata?: any;
  }): Promise<any> {
    const response = await this.post('/api/requests', requestData);
    return response.data;
  }

  /**
   * Update media request
   */
  async updateMediaRequest(requestId: string, updates: any): Promise<any> {
    const response = await this.put(`/api/requests/${requestId}`, updates);
    return response.data;
  }

  /**
   * Delete media request
   */
  async deleteMediaRequest(requestId: string): Promise<void> {
    await this.delete(`/api/requests/${requestId}`);
  }

  /**
   * Process media request
   */
  async processMediaRequest(requestId: string): Promise<any> {
    const response = await this.post(`/api/requests/${requestId}/process`);
    return response.data;
  }

  /**
   * Cancel media request
   */
  async cancelMediaRequest(requestId: string): Promise<any> {
    const response = await this.post(`/api/requests/${requestId}/cancel`);
    return response.data;
  }

  // YouTube specific endpoints
  /**
   * Validate YouTube URL
   */
  async validateYouTubeUrl(url: string): Promise<{ valid: boolean; metadata?: any }> {
    const response = await this.post('/api/youtube/validate', { url });
    return response.data;
  }

  /**
   * Get YouTube video info
   */
  async getYouTubeVideoInfo(url: string): Promise<any> {
    const response = await this.get(`/api/youtube/info`, { params: { url } });
    return response.data;
  }

  /**
   * Download YouTube video
   */
  async downloadYouTubeVideo(requestData: {
    url: string;
    quality: string;
    format: string;
    startTime?: string;
    endTime?: string;
    includeSubtitles?: boolean;
    subtitlesLanguage?: string;
  }): Promise<any> {
    const response = await this.post('/api/youtube/download', requestData);
    return response.data;
  }

  // File upload endpoints
  /**
   * Upload file
   */
  async uploadFile(file: File | Buffer, fileName: string, mimeType?: string): Promise<any> {
    const formData = new FormData();
    
    if (file instanceof Buffer) {
      formData.append('file', new Blob([file]), fileName);
    } else {
      formData.append('file', file, fileName);
    }

    const response = await this.post('/api/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.delete(`/api/files/${fileId}`);
  }

  // Admin endpoints
  /**
   * Get system stats
   */
  async getSystemStats(): Promise<any> {
    const response = await this.get('/api/admin/stats');
    return response.data;
  }

  /**
   * Get system logs
   */
  async getSystemLogs(params?: { level?: string; limit?: number }): Promise<any> {
    const response = await this.get('/api/admin/logs', { params });
    return response.data;
  }

  /**
   * Update system settings
   */
  async updateSystemSettings(settings: any): Promise<any> {
    const response = await this.put('/api/admin/settings', settings);
    return response.data;
  }

  // Test data management
  /**
   * Create test data
   */
  async createTestData(testData: {
    users?: any[];
    requests?: any[];
    [key: string]: any;
  }): Promise<any> {
    const response = await this.post('/api/test/create-data', testData);
    return response.data;
  }

  /**
   * Clean test data
   */
  async cleanTestData(testData?: {
    userIds?: string[];
    requestIds?: string[];
    [key: string]: any;
  }): Promise<void> {
    await this.post('/api/test/clean-data', testData || {});
  }

  /**
   * Reset test database
   */
  async resetTestDatabase(): Promise<void> {
    await this.post('/api/test/reset-database');
  }

  // Health check
  /**
   * Check API health
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.get('/api/health');
    return response.data;
  }

  // Utility methods
  /**
   * Wait for request to complete
   */
  async waitForRequestCompletion(requestId: string, timeout = 60000): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const request = await this.getMediaRequest(requestId);
        
        if (request.status === 'completed' || request.status === 'failed') {
          return request;
        }
        
        // Wait 2 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        // Continue polling if request not found yet
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error(`Request ${requestId} did not complete within ${timeout}ms`);
  }

  /**
   * Batch create media requests
   */
  async batchCreateMediaRequests(requests: any[]): Promise<any[]> {
    const createdRequests = [];
    
    for (const requestData of requests) {
      try {
        const request = await this.createMediaRequest(requestData);
        createdRequests.push(request);
      } catch (error) {
        console.error('Failed to create request:', requestData, error);
      }
    }
    
    return createdRequests;
  }
}

// Create singleton instance
export const apiHelpers = new ApiHelpers();

// Export class for custom instances
export default ApiHelpers;