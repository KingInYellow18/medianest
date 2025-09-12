# Task: Implement Missing Frontend Components and Fix Import Issues

## Task ID

**ID**: task-20250119-2103-implement-missing-frontend-components  
**Created**: 2025-01-19 21:03  
**Type**: Implementation - Missing Components

## Status

- [ ] Pending
- [ ] In Progress
- [ ] Completed
- [ ] Blocked

## Priority

**P1 - High** (Frontend test suite blocked)

## Description

Several frontend test files are importing components that don't exist, causing module resolution failures. The most critical is the `DownloadCard` component used by the YouTube download queue system. Additionally, there are incorrect imports trying to access `@medianest/shared/config` which doesn't exist in the shared package exports.

## Acceptance Criteria

- [ ] Create missing `DownloadCard` component for YouTube downloads
- [ ] Fix incorrect shared package imports across frontend
- [ ] All frontend component tests can import their dependencies
- [ ] New components follow project UI patterns and accessibility standards
- [ ] No remaining module resolution errors in frontend tests

## Technical Requirements

- **UI Framework**: Use existing UI component library (Card, Button, Progress, Badge)
- **TypeScript**: Proper typing with YouTubeDownload interface
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support
- **Responsive**: Mobile-friendly design patterns

## Files to Modify/Create

- **Create**: `frontend/src/components/youtube/DownloadCard.tsx`
  - Display download progress, status, and metadata
  - Action buttons for cancel, retry, delete
  - Status indicators with icons and colors
  - Error display and file information

- **Fix Imports**: Update incorrect shared package imports
  - Replace `@medianest/shared/config` with actual exports
  - Use `@medianest/shared` for constants and types
  - Verify all shared imports are available

- **Verify**: Test file imports resolve correctly
  - `DownloadQueue.test.tsx` can import DownloadCard
  - Other component tests have correct imports

## Testing Strategy

1. **Component Testing**:
   - Unit tests for DownloadCard component
   - Test all props and interaction handlers
   - Verify accessibility and responsive behavior

2. **Integration Testing**:
   - Test DownloadCard within DownloadQueue context
   - Verify proper event handling
   - Check WebSocket integration for progress updates

3. **Verification Steps**:
   ```bash
   cd frontend && npm test src/components/youtube/__tests__/DownloadQueue.test.tsx
   cd frontend && npm test src/components/youtube/
   cd frontend && npm test  # Full frontend test suite
   ```

## Progress Log

- **2025-01-19 21:03**: Task created from TEST_TASKS migration
- **Status**: Pending - Frontend component implementation needed

## Related Tasks

- **Depends On**: task-20250119-2102-implement-shared-crypto-validation-utilities (for shared exports)
- **Enables**: YouTube download functionality testing
- **Enables**: Frontend test suite completion

## Component Specifications

### DownloadCard Props

```typescript
interface DownloadCardProps {
  download: YouTubeDownload;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onDelete?: (id: string) => void;
}
```

### Status States

- **pending/queued**: Clock icon, gray badge
- **downloading/processing**: Download icon with pulse, blue badge
- **completed**: Green badge, delete option
- **failed**: Alert icon, red badge, retry option
- **cancelled**: Gray badge, delete option

### Features

- Progress bar for active downloads
- File size and duration display
- Error message display for failed downloads
- Responsive card layout
- Action buttons with hover states

## Implementation Notes

- **Design System**: Follow existing card patterns from dashboard
- **Icons**: Use Lucide React icons for consistency
- **State Management**: Handle download state updates via props
- **Performance**: Optimize for lists with many downloads
- **Error Handling**: Clear error display with user-friendly messages
