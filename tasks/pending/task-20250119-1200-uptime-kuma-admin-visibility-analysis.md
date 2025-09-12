# Task: Plan and Design Admin Control System for Uptime Kuma Monitor Visibility

## Task ID

task-20250119-1200-uptime-kuma-admin-visibility-analysis

## Status

- [ ] Not Started
- [ ] In Progress
- [ ] Testing
- [ ] Completed

## Priority

P1 (High)

## Description

Design and plan a comprehensive admin control system that allows administrators to control which Uptime Kuma monitors are visible to end users. This feature will enable selective visibility of monitors based on admin configuration, preventing users from seeing internal/sensitive monitors while maintaining visibility of user-relevant services.

## Acceptance Criteria

### Core Functionality

- [ ] Admins can mark specific Uptime Kuma monitors as "public" or "admin-only"
- [ ] Regular users only see monitors marked as "public"
- [ ] Admins see all monitors regardless of visibility setting
- [ ] Monitor visibility settings persist in the database
- [ ] Real-time WebSocket updates respect visibility rules
- [ ] Dashboard API endpoints filter results based on user role

### Admin Interface

- [ ] New admin page for managing monitor visibility
- [ ] Toggle controls for each detected monitor
- [ ] Bulk actions for setting multiple monitors at once
- [ ] Visual indicators showing current visibility status
- [ ] Search/filter functionality for large monitor lists

### User Experience

- [ ] Seamless experience for end users (no indication of hidden monitors)
- [ ] Admin interface follows existing MediaNest design patterns
- [ ] Responsive design for mobile admin management
- [ ] Real-time updates when visibility settings change

### Technical Requirements

- [ ] Database schema supports monitor visibility control
- [ ] Backend API respects role-based filtering
- [ ] Frontend components adapt to filtered data
- [ ] WebSocket events filtered by user permissions
- [ ] Proper error handling and validation

## Technical Requirements

### Database Schema Changes

- New table: `monitor_visibility` or extend `ServiceConfig`
- Fields needed:
  - `monitor_id` (Uptime Kuma monitor ID)
  - `monitor_name` (for identification)
  - `is_public` (boolean: true = visible to users, false = admin-only)
  - `created_at`, `updated_at`
  - `updated_by` (relation to User)

### API Endpoints

- `GET /api/admin/monitors` - List all monitors with visibility status
- `PATCH /api/admin/monitors/:id/visibility` - Update single monitor visibility
- `PATCH /api/admin/monitors/bulk-visibility` - Update multiple monitor visibility
- `GET /api/dashboard/status` - Modified to respect visibility rules

### Frontend Components

- `MonitorVisibilityManagement` - Main admin interface
- `MonitorVisibilityToggle` - Individual monitor toggle
- `MonitorVisibilityBulkActions` - Bulk operations component
- Modified `ServiceCard` and `UptimeKumaCard` - Respect filtered data

### Integration Points

- `StatusService` - Filter monitors based on user role
- WebSocket event filtering - Broadcast only relevant monitors
- `UptimeKumaClient` - Maintain monitor metadata for visibility control
- RBAC middleware - Ensure proper permission checking

## Files to Modify/Create

### Database

- `backend/prisma/schema.prisma` - Add monitor visibility schema
- `backend/prisma/migrations/` - New migration for schema changes

### Backend Services

- `backend/src/services/status.service.ts` - Add visibility filtering
- `backend/src/services/monitor-visibility.service.ts` - New service for managing visibility
- `backend/src/repositories/monitor-visibility.repository.ts` - New repository

### Backend Controllers

- `backend/src/controllers/admin.controller.ts` - Add monitor visibility endpoints
- `backend/src/controllers/dashboard.controller.ts` - Update status filtering

### Backend Routes

- `backend/src/routes/v1/admin.ts` - Add new monitor visibility routes

### Backend Validation

- `backend/src/validations/monitor-visibility.validation.ts` - New validation schemas

### Frontend Components

- `frontend/src/components/admin/MonitorVisibilityManagement.tsx` - New admin interface
- `frontend/src/components/admin/MonitorVisibilityToggle.tsx` - Individual toggle
- `frontend/src/components/admin/MonitorVisibilityBulkActions.tsx` - Bulk actions
- `frontend/src/components/dashboard/cards/ServiceCard.tsx` - Respect filtered data

### Frontend Services

- `frontend/src/lib/api/admin.ts` - Add monitor visibility API calls
- `frontend/src/lib/api/dashboard.ts` - Update status fetching

### Frontend Hooks

- `frontend/src/lib/hooks/useMonitorVisibility.ts` - New hook for visibility management
- `frontend/src/lib/hooks/useServiceStatus.ts` - Update to respect filtering

### Admin Pages

- `frontend/src/app/(auth)/admin/monitors/page.tsx` - New admin page

## Testing Strategy

### Unit Tests

- `monitor-visibility.service.test.ts` - Service logic testing
- `monitor-visibility.repository.test.ts` - Repository testing
- `admin.controller.test.ts` - API endpoint testing
- `MonitorVisibilityManagement.test.tsx` - Component testing

### Integration Tests

- Admin monitor visibility management flow
- User dashboard filtering verification
- WebSocket event filtering
- Role-based access control validation

### E2E Tests

- Admin sets monitor visibility and verifies user experience
- Real-time updates when visibility changes
- Bulk operations functionality

## Security Considerations

### Access Control

- Only admins can modify monitor visibility settings
- Regular users cannot access visibility management endpoints
- Monitor visibility data filtered before sending to frontend
- WebSocket events filtered by user role

### Data Validation

- Validate monitor IDs exist in Uptime Kuma
- Validate user has admin role for modification operations
- Sanitize all input data
- Rate limiting on visibility modification endpoints

## Progress Log

### 2025-01-19 12:00 - Task Created

- Analyzed current Uptime Kuma integration architecture
- Researched React Admin patterns for permission control
- Researched monitoring dashboard best practices
- Created comprehensive task specification
- Identified all required components and modifications

## Related Tasks

- Depends on: Current Uptime Kuma integration (completed)
- Blocks: None identified
- Related: Admin dashboard enhancements

## Notes

### Design Decisions Made

1. **Database Approach**: Create dedicated monitor visibility table vs extending ServiceConfig
   - Decision: Create dedicated table for cleaner separation and better scalability
2. **Visibility Model**: Per-monitor control vs category-based grouping
   - Decision: Per-monitor control for maximum flexibility
3. **Default Visibility**: New monitors default to public vs admin-only
   - Decision: Default to admin-only for security (admin must explicitly make public)

4. **Real-time Updates**: How to handle visibility changes for connected users
   - Decision: Immediately filter WebSocket events, users see changes in real-time

### Future Considerations

- Monitor grouping/categorization for easier bulk management
- Scheduled visibility changes (e.g., maintenance windows)
- User-specific monitor customization (beyond admin control)
- Integration with monitor tags from Uptime Kuma
- Audit logging for visibility changes

### Research Insights

- React Admin patterns emphasize granular permission control at resource.field level
- Dashboard design best practices recommend role-based data filtering
- Monitoring systems commonly use hierarchical visibility models
- Real-time filtering should be transparent to end users
