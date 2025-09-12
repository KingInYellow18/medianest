/**
 * Test data fixtures for E2E testing
 * Contains sample data for media requests, users, and other entities
 */

export interface TestMediaRequest {
  id?: string;
  title: string;
  description: string;
  type: 'youtube' | 'audio' | 'video' | 'document';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  dueDate?: string;
  tags?: string[];
  metadata?: any;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TestYouTubeRequest extends TestMediaRequest {
  type: 'youtube';
  youtubeUrl: string;
  quality: string;
  format: string;
  startTime?: string;
  endTime?: string;
  includeSubtitles?: boolean;
  subtitlesLanguage?: string;
  includeThumbnail?: boolean;
}

// Sample media requests
export const testMediaRequests: Record<string, TestMediaRequest> = {
  basicYouTubeRequest: {
    title: 'Download Conference Presentation',
    description: 'Tech conference presentation on AI developments',
    type: 'youtube',
    priority: 'medium',
    status: 'pending',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    tags: ['conference', 'AI', 'presentation'],
    metadata: {
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      quality: '720p',
      format: 'mp4',
    },
  },

  urgentAudioRequest: {
    title: 'Extract Audio from Podcast',
    description: 'Need audio file for podcast editing',
    type: 'audio',
    priority: 'urgent',
    status: 'pending',
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
    tags: ['podcast', 'audio', 'editing'],
  },

  largeVideoRequest: {
    title: 'Download Full Documentary',
    description: 'Full length documentary for educational purposes',
    type: 'video',
    priority: 'low',
    status: 'in_progress',
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
    tags: ['documentary', 'education', 'full-length'],
    metadata: {
      estimatedSize: '2.5GB',
      duration: '120 minutes',
    },
  },

  completedRequest: {
    title: 'Music Video Download',
    description: 'Music video for personal collection',
    type: 'youtube',
    priority: 'medium',
    status: 'completed',
    tags: ['music', 'video', 'collection'],
    metadata: {
      youtubeUrl: 'https://www.youtube.com/watch?v=example',
      quality: '1080p',
      format: 'mp4',
      downloadPath: '/downloads/music-video.mp4',
    },
  },
};

// YouTube-specific test data
export const youTubeTestData = {
  validUrls: [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
  ],

  invalidUrls: [
    'https://www.google.com',
    'not-a-url',
    'https://youtube.com/invalid',
    'https://www.youtube.com/watch?v=',
    '',
  ],

  requestOptions: {
    qualities: ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'],
    formats: ['mp4', 'webm', 'mkv', 'flv', 'avi'],
    subtitleLanguages: ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh'],
  },
};

// Test file data
export const testFiles = {
  smallImage: {
    name: 'test-image.jpg',
    size: 50 * 1024, // 50KB
    type: 'image/jpeg',
    content: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAAAAAAD...', // Truncated base64
  },

  largeVideo: {
    name: 'test-video.mp4',
    size: 100 * 1024 * 1024, // 100MB
    type: 'video/mp4',
  },

  textDocument: {
    name: 'test-document.txt',
    size: 1024, // 1KB
    type: 'text/plain',
    content: 'This is a test document for E2E testing.',
  },
};

// Test notification data
export const testNotifications = {
  requestCompleted: {
    type: 'request_completed',
    title: 'Download Completed',
    message: 'Your media request has been processed successfully',
    priority: 'medium',
  },

  requestFailed: {
    type: 'request_failed',
    title: 'Download Failed',
    message: 'There was an error processing your request',
    priority: 'high',
  },

  systemMaintenance: {
    type: 'system_maintenance',
    title: 'Scheduled Maintenance',
    message: 'The system will be undergoing maintenance tonight',
    priority: 'low',
  },
};

// Test comment data
export const testComments = [
  'This request is urgent, please prioritize.',
  'Can you also include subtitles?',
  'The download quality should be at least 720p.',
  'Please extract audio only from this video.',
  'This is for educational purposes.',
  'Request completed successfully!',
  'There was an issue with the original URL.',
  'Updated the request with new requirements.',
];

// Test search queries
export const testSearchQueries = {
  valid: ['conference', 'music video', 'documentary', 'podcast', 'education'],

  edge_cases: [
    '',
    'a',
    'very long search query that might test input limits and see how the system handles extensive search terms',
    '123',
    '@#$%^&*()',
    'search with   multiple   spaces',
  ],
};

// Test filter combinations
export const testFilters = {
  byStatus: ['pending', 'in_progress', 'completed', 'failed'],
  byPriority: ['low', 'medium', 'high', 'urgent'],
  byType: ['youtube', 'audio', 'video', 'document'],
  byDateRange: [
    { start: '2024-01-01', end: '2024-01-31' },
    { start: '2024-02-01', end: '2024-02-29' },
    { start: '2024-03-01', end: '2024-03-31' },
  ],
};

// Test pagination data
export const testPagination = {
  pageSizes: [10, 25, 50, 100],
  pageNumbers: [1, 2, 3, 10, 50],
  totalRecords: [0, 1, 5, 15, 47, 100, 1000],
};

// Factory functions for generating test data
export class TestDataFactory {
  private static requestCounter = 0;

  /**
   * Generate a basic media request
   */
  static createMediaRequest(overrides: Partial<TestMediaRequest> = {}): TestMediaRequest {
    this.requestCounter++;

    return {
      title: `Test Request ${this.requestCounter}`,
      description: `Test description for request ${this.requestCounter}`,
      type: 'youtube',
      priority: 'medium',
      status: 'pending',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['test', `request-${this.requestCounter}`],
      ...overrides,
    };
  }

  /**
   * Generate a YouTube request
   */
  static createYouTubeRequest(overrides: Partial<TestYouTubeRequest> = {}): TestYouTubeRequest {
    const baseRequest = this.createMediaRequest({ type: 'youtube' });

    return {
      ...baseRequest,
      type: 'youtube',
      youtubeUrl: youTubeTestData.validUrls[0],
      quality: '720p',
      format: 'mp4',
      includeSubtitles: false,
      includeThumbnail: true,
      ...overrides,
    } as TestYouTubeRequest;
  }

  /**
   * Generate batch of media requests
   */
  static createBatch(count: number, template: Partial<TestMediaRequest> = {}): TestMediaRequest[] {
    const requests: TestMediaRequest[] = [];

    for (let i = 0; i < count; i++) {
      requests.push(this.createMediaRequest(template));
    }

    return requests;
  }

  /**
   * Generate requests with different statuses
   */
  static createRequestsWithAllStatuses(): TestMediaRequest[] {
    const statuses: TestMediaRequest['status'][] = [
      'pending',
      'in_progress',
      'completed',
      'failed',
      'cancelled',
    ];

    return statuses.map((status) => this.createMediaRequest({ status }));
  }

  /**
   * Generate requests with different priorities
   */
  static createRequestsWithAllPriorities(): TestMediaRequest[] {
    const priorities: TestMediaRequest['priority'][] = ['low', 'medium', 'high', 'urgent'];

    return priorities.map((priority) => this.createMediaRequest({ priority }));
  }

  /**
   * Generate requests for date range testing
   */
  static createRequestsForDateRange(
    startDate: Date,
    endDate: Date,
    count: number,
  ): TestMediaRequest[] {
    const requests: TestMediaRequest[] = [];
    const dateRange = endDate.getTime() - startDate.getTime();

    for (let i = 0; i < count; i++) {
      const randomDate = new Date(startDate.getTime() + Math.random() * dateRange);
      requests.push(
        this.createMediaRequest({
          createdAt: randomDate.toISOString(),
          dueDate: new Date(randomDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      );
    }

    return requests;
  }

  /**
   * Reset counter for test isolation
   */
  static resetCounter(): void {
    this.requestCounter = 0;
  }
}

// Common test scenarios
export const testScenarios = {
  emptyState: {
    description: 'User with no media requests',
    data: [],
  },

  singleRequest: {
    description: 'User with one media request',
    data: [testMediaRequests.basicYouTubeRequest],
  },

  multipleRequests: {
    description: 'User with multiple requests in different states',
    data: Object.values(testMediaRequests),
  },

  mixedPriorities: {
    description: 'Requests with different priority levels',
    data: TestDataFactory.createRequestsWithAllPriorities(),
  },

  allStatuses: {
    description: 'Requests covering all possible statuses',
    data: TestDataFactory.createRequestsWithAllStatuses(),
  },
};

// Export all test data for easy import
export const allTestData = {
  mediaRequests: testMediaRequests,
  youTube: youTubeTestData,
  files: testFiles,
  notifications: testNotifications,
  comments: testComments,
  searchQueries: testSearchQueries,
  filters: testFilters,
  pagination: testPagination,
  scenarios: testScenarios,
};
