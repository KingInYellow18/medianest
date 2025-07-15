# MediaNest Pagination Implementation Guide

**Date:** January 2025  
**Purpose:** Add pagination to API endpoints that return potentially large datasets

## Overview

This guide documents the implementation of pagination for MediaNest API endpoints that currently lack it but could benefit from pagination for performance and usability.

## Standard Pagination Pattern

MediaNest uses a consistent pagination pattern across all endpoints:

### Request Parameters

```typescript
{
  page: number; // Current page (default: 1)
  pageSize: number; // Items per page (default: 20, max: 100)
  // or alternatively:
  limit: number; // Items per page (default: 20, max: 100)
  offset: number; // Number of items to skip
}
```

### Response Format

```typescript
{
  success: true,
  data: {
    items: T[],           // Array of items
    pagination: {
      total: number,      // Total number of items
      page: number,       // Current page
      pageSize: number,   // Items per page
      totalPages: number  // Total number of pages
    }
  }
}
```

## Endpoints Requiring Pagination

### 1. GET /api/v1/admin/users

**Current State:** Returns TODO placeholder  
**Priority:** HIGH  
**Implementation:**

```typescript
// backend/src/controllers/admin.controller.ts
async getUsers(req: Request, res: Response) {
  try {
    const { page = 1, pageSize = 20, search, role, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build filters
    const where: any = {};
    if (search) {
      where.OR = [
        { plexUsername: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    if (role && role !== 'all') {
      where.role = role as string;
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(pageSize);
    const total = await prisma.user.count({ where });

    // Get users
    const users = await prisma.user.findMany({
      where,
      skip,
      take: Number(pageSize),
      orderBy: { [sortBy as string]: sortOrder },
      select: {
        id: true,
        plexId: true,
        plexUsername: true,
        email: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            mediaRequests: true,
            youtubDownloads: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: Math.ceil(total / Number(pageSize))
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get users', { error });
    throw new AppError('Failed to get users', 500);
  }
}
```

**Validation Schema:**

```typescript
// backend/src/validations/admin.ts
export const getUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    role: z.enum(['user', 'admin', 'all']).default('all'),
    sortBy: z.enum(['createdAt', 'lastLoginAt', 'plexUsername', 'email']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});
```

### 2. GET /api/v1/plex/search

**Current State:** Returns all search results  
**Priority:** HIGH  
**Implementation:**

```typescript
// backend/src/controllers/plex.controller.ts
async search(req: Request, res: Response) {
  try {
    const { q, type = 'all', page = 1, limit = 20 } = req.query;

    if (!q) {
      throw new AppError('Search query is required', 400);
    }

    const plexService = await getPlexService();

    // Plex API doesn't support pagination directly, so we need to:
    // 1. Get all results
    // 2. Filter by type if needed
    // 3. Manually paginate

    const searchResults = await plexService.search(q as string);

    // Filter by type if specified
    let filteredResults = searchResults;
    if (type !== 'all') {
      filteredResults = searchResults.filter(item => item.type === type);
    }

    // Manual pagination
    const total = filteredResults.length;
    const offset = (Number(page) - 1) * Number(limit);
    const paginatedResults = filteredResults.slice(offset, offset + Number(limit));

    res.json({
      success: true,
      data: {
        results: paginatedResults,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Search failed', { error });
    throw new AppError('Search failed', 500);
  }
}
```

### 3. GET /api/v1/plex/recently-added

**Current State:** Returns all recently added items  
**Priority:** MEDIUM  
**Implementation:**

```typescript
// backend/src/controllers/plex.controller.ts
async getRecentlyAdded(req: Request, res: Response) {
  try {
    const { limit = 20, page = 1, type = 'all', libraryKey } = req.query;

    const plexService = await getPlexService();

    // Get recently added items (Plex typically limits this internally)
    const recentItems = await plexService.getRecentlyAdded({
      libraryKey: libraryKey as string,
      limit: 100 // Get more than needed for filtering
    });

    // Filter by type if specified
    let filteredItems = recentItems;
    if (type !== 'all') {
      filteredItems = recentItems.filter(item => item.type === type);
    }

    // Manual pagination
    const total = filteredItems.length;
    const offset = (Number(page) - 1) * Number(limit);
    const paginatedItems = filteredItems.slice(offset, offset + Number(limit));

    res.json({
      success: true,
      data: {
        items: paginatedItems,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get recently added', { error });
    throw new AppError('Failed to get recently added items', 500);
  }
}
```

### 4. GET /api/v1/dashboard/notifications

**Current State:** Returns empty array (TODO)  
**Priority:** MEDIUM  
**Implementation:**

```typescript
// backend/src/controllers/dashboard.controller.ts
async getNotifications(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const { page = 1, limit = 20, unread, type } = req.query;

    // Build filters
    const where: any = { userId };
    if (unread !== undefined) {
      where.read = unread === 'true' ? false : true;
    }
    if (type) {
      where.type = type as string;
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    const total = await prisma.notification.count({ where });

    // Get notifications
    const notifications = await prisma.notification.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get notifications', { error });
    throw new AppError('Failed to get notifications', 500);
  }
}
```

### 5. GET /api/v1/youtube/downloads

**Current State:** Returns TODO placeholder  
**Priority:** HIGH  
**Implementation:**

```typescript
// backend/src/controllers/youtube.controller.ts
async getDownloads(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const { page = 1, pageSize = 20, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build filters
    const where: any = { userId };
    if (status && status !== 'all') {
      where.status = status as string;
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(pageSize);
    const total = await prisma.youtubeDownload.count({ where });

    // Get downloads
    const downloads = await prisma.youtubeDownload.findMany({
      where,
      skip,
      take: Number(pageSize),
      orderBy: { [sortBy as string]: sortOrder }
    });

    res.json({
      success: true,
      data: {
        downloads,
        pagination: {
          total,
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: Math.ceil(total / Number(pageSize))
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get downloads', { error });
    throw new AppError('Failed to get downloads', 500);
  }
}
```

## Database Schema Updates

For notifications, we need to add the table:

```prisma
// backend/prisma/schema.prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String
  type      String   // request_approved, request_completed, download_complete, etc.
  title     String
  message   String
  metadata  Json?    // Additional data specific to notification type
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, read, createdAt])
  @@index([userId, type, createdAt])
}
```

## Frontend Updates

Update API client methods to handle pagination:

```typescript
// frontend/src/lib/api/admin.ts
export async function getUsers(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });

  return apiClient.get(`/admin/users?${searchParams.toString()}`);
}
```

## Testing Pagination

### Unit Tests

```typescript
describe('Pagination', () => {
  it('should return paginated results', async () => {
    const response = await request(app)
      .get('/api/v1/admin/users')
      .query({ page: 2, pageSize: 10 })
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.users).toHaveLength(10);
    expect(response.body.data.pagination.page).toBe(2);
    expect(response.body.data.pagination.pageSize).toBe(10);
  });

  it('should respect max page size', async () => {
    const response = await request(app)
      .get('/api/v1/admin/users')
      .query({ pageSize: 200 })
      .set('Cookie', adminCookie);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('pageSize');
  });
});
```

## Migration Strategy

1. **Phase 1:** Implement pagination for high-priority endpoints

   - Admin users list
   - Plex search results
   - YouTube downloads

2. **Phase 2:** Add pagination to medium-priority endpoints

   - Dashboard notifications
   - Plex recently added

3. **Phase 3:** Update frontend components to use pagination
   - Add pagination controls
   - Update API calls
   - Handle loading states

## Performance Considerations

1. **Database Indexes:** Ensure proper indexes on commonly sorted fields
2. **Count Optimization:** Consider caching total counts for large tables
3. **Cursor Pagination:** For very large datasets, consider cursor-based pagination
4. **Response Caching:** Cache paginated responses with appropriate TTL

## Best Practices

1. **Consistent Parameters:** Use same parameter names across all endpoints
2. **Validation:** Always validate page and pageSize parameters
3. **Max Page Size:** Enforce maximum page size to prevent abuse
4. **Total Count:** Include total count for UI pagination controls
5. **Error Handling:** Return empty array for out-of-range pages
6. **Documentation:** Update API docs with pagination parameters
