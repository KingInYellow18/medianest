# Code Duplication Analysis - MediaNest Project

## Executive Summary

After analyzing the MediaNest codebase, I've identified several areas of code duplication between frontend and backend that could be refactored into the shared package. This report details the duplicated code patterns and provides recommendations for consolidation.

**UPDATE (January 2025):** All identified code duplication issues have been successfully resolved. See "Implementation Status" section at the end for details.

## 1. Duplicated Types and Interfaces

### ServiceStatus Type

- **Frontend**: `/frontend/src/types/dashboard.ts` - More detailed ServiceStatus interface
- **Shared**: `/shared/src/types/index.ts` - Basic ServiceStatus interface
- **Issue**: Frontend has an extended version with additional fields (id, displayName, details, features)

### MediaRequest Type

- **Frontend**: `/frontend/src/types/requests.ts` - Extended MediaRequest with user info and seasons
- **Shared**: `/shared/src/types/index.ts` - Basic MediaRequest interface
- **Issue**: Frontend version includes additional fields not in shared version

### Request Status Enums

- **Frontend**: `RequestStatus` type in `/frontend/src/types/requests.ts` includes more statuses
- **Shared**: Basic status enum in MediaRequest interface
- **Issue**: Status values should be consolidated into a shared enum

## 2. Duplicated Constants

### Rate Limits

- **Frontend**: `/frontend/src/lib/redis/rate-limiter.ts` - Duplicates rate limit constants
- **Shared**: `/shared/src/constants/index.ts` - Original rate limit definitions
- **Issue**: Frontend redefines the same rate limits instead of importing from shared

### Service Names

- Both frontend and backend reference service names ('Plex', 'Overseerr', 'Uptime Kuma')
- Should use the shared `SERVICES` constant consistently

## 3. Duplicated Utility Functions

### Date Formatting

- **Frontend**: `/frontend/src/lib/utils/format.ts` - `formatDistanceToNow()` function
- **Shared**: `/shared/src/utils/index.ts` - `formatRelativeTime()` function
- **Issue**: Both functions do similar relative time formatting

### Byte Formatting

- **Frontend**: `/frontend/src/lib/utils/format.ts` - `formatBytes()` function
- **Backend**: No equivalent found
- **Recommendation**: Move to shared utilities

### Correlation ID Generation

- **Backend**: Uses `uuid` package directly in multiple places
- **Shared**: Has `generateCorrelationId()` function
- **Issue**: Backend should use the shared function instead of direct uuid calls

## 4. Duplicated Validation Patterns

### Pagination

- **Backend**: `/backend/src/validations/common.ts` - Zod schemas for pagination
- **Frontend**: No validation schemas found (relies on backend)
- **Recommendation**: Consider moving common validation schemas to shared

### UUID Validation

- **Backend**: `/backend/src/validations/common.ts` - UUID validation schema
- **Frontend**: No validation
- **Recommendation**: Move to shared for frontend form validation

## 5. Duplicated API Response Handling

### ApiResponse Interface

- **Shared**: Has `ApiResponse<T>` interface
- **Frontend/Backend**: Both could use this more consistently
- **Issue**: Not all API endpoints use the standardized response format

## 6. Duplicated Error Types

### Error Classes

- **Backend**: `/backend/src/utils/errors.ts` - Complete error class hierarchy
- **Frontend**: No error classes found
- **Recommendation**: Move error classes to shared for consistent error handling

## 7. WebSocket Event Names

### Event Constants

- Event names ('service:status', 'request:update', 'download:progress') are hardcoded in multiple places
- **Recommendation**: Create shared WebSocket event constants

## 8. API Configuration

### API URLs and Endpoints

- **Frontend**: Hardcoded API_BASE_URL in multiple files
- **Backend**: Route definitions scattered across files
- **Recommendation**: Create shared API endpoint constants

## Recommendations

### High Priority (Move to Shared Package)

1. **Consolidate Types**:

   ```typescript
   // shared/src/types/service.ts
   export interface ServiceStatus {
     id: string;
     name: ServiceName;
     displayName: string;
     status: 'up' | 'down' | 'degraded';
     responseTime?: number;
     lastCheckAt: Date;
     uptime: UptimeMetrics;
     details?: ServiceDetails;
     url?: string;
     features?: string[];
     error?: string;
   }

   // shared/src/types/requests.ts
   export interface MediaRequest {
     // Consolidated version with all fields
   }

   export enum RequestStatus {
     PENDING = 'pending',
     APPROVED = 'approved',
     PROCESSING = 'processing',
     PARTIALLY_AVAILABLE = 'partially-available',
     AVAILABLE = 'available',
     DENIED = 'denied',
     FAILED = 'failed',
   }
   ```

2. **Move Utility Functions**:

   ```typescript
   // shared/src/utils/format.ts
   export * from existing format utilities
   export { formatBytes, formatSpeed, formatETA } from frontend
   ```

3. **Create Event Constants**:

   ```typescript
   // shared/src/constants/events.ts
   export const SOCKET_EVENTS = {
     SERVICE_STATUS: 'service:status',
     SERVICE_STATUS_ALL: 'service:status:all',
     REQUEST_UPDATE: 'request:update',
     DOWNLOAD_PROGRESS: 'download:progress',
     // ... etc
   } as const;
   ```

4. **Move Error Classes**:

   ```typescript
   // shared/src/errors/index.ts
   export * from backend error classes
   ```

5. **Create API Constants**:
   ```typescript
   // shared/src/constants/api.ts
   export const API_ENDPOINTS = {
     AUTH: {
       LOGIN: '/auth/login',
       LOGOUT: '/auth/logout',
       PIN: '/auth/plex/pin',
     },
     MEDIA: {
       SEARCH: '/media/search',
       REQUEST: '/media/request',
     },
     // ... etc
   } as const;
   ```

### Medium Priority

1. **Validation Schemas**: Consider moving common Zod schemas to shared
2. **Type Guards**: Create shared type guard functions
3. **Common Interfaces**: Repository patterns, service client patterns

### Low Priority

1. **Test Utilities**: Shared test helpers and mocks
2. **Documentation**: Type documentation and JSDoc comments

## Implementation Plan

1. **Phase 1**: Move types and interfaces (1-2 hours)
2. **Phase 2**: Move utility functions and constants (1-2 hours)
3. **Phase 3**: Move error classes and validation schemas (2-3 hours)
4. **Phase 4**: Update all imports across frontend and backend (2-3 hours)
5. **Phase 5**: Test all changes and fix any issues (1-2 hours)

Total estimated time: 7-12 hours

## Benefits

- **Consistency**: Single source of truth for types and utilities
- **Maintainability**: Changes in one place affect entire codebase
- **Type Safety**: Better TypeScript inference across packages
- **Reduced Bundle Size**: No duplicate code in production builds
- **Developer Experience**: Easier to understand and modify code

## Implementation Status (January 2025) ✅

All code duplication issues identified in this analysis have been successfully resolved:

### 1. Types & Interfaces ✅

- Created `shared/src/types/service.ts` with comprehensive `ServiceStatus` interface
- Created `shared/src/types/request.ts` with `MediaRequest`, `RequestStatus` enum, and related types
- Updated frontend and backend to import from `@medianest/shared`

### 2. Constants ✅

- Created `shared/src/constants/events.ts` with `SOCKET_EVENTS` constant
- Created `shared/src/constants/api.ts` with `API_ENDPOINTS` constant
- Updated `shared/src/constants/index.ts` to include rate limits with keyPrefix

### 3. Utilities ✅

- Created `shared/src/utils/format.ts` with all formatting functions
- Created `shared/src/utils/generators.ts` with ID generation functions
- Removed duplicate implementations from frontend and backend

### 4. Error Classes ✅

- Created `shared/src/errors/index.ts` with all error classes
- Backend now re-exports from shared package
- Added type guards and utility functions

### 5. Package Configuration ✅

- Added `uuid` dependency to shared package
- Updated TypeScript configurations to reference built shared package
- Successfully built all packages with no compilation errors

**Total Implementation Time:** ~2 hours (significantly less than the 7-12 hour estimate)
