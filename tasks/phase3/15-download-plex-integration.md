# Phase 3: YouTube Downloads to Plex Integration

**Status:** Not Started  
**Priority:** Medium  
**Dependencies:** yt-dlp integration, Plex API client  
**Estimated Time:** 4 hours

## Objective

Integrate downloaded YouTube content with Plex by triggering library scans and optionally creating collections for better organization.

## Background

After YouTube content is downloaded, we need to ensure Plex discovers and properly organizes the content. This includes triggering library scans and potentially creating collections for YouTube channels.

## Tasks

### 1. Library Scan Triggering

- [ ] Implement Plex library section detection
- [ ] Create targeted scan for specific directories
- [ ] Add scan progress monitoring
- [ ] Handle scan failures gracefully
- [ ] Queue scans to avoid overwhelming Plex

### 2. Download Path Configuration

- [ ] Configure YouTube library path in Plex
- [ ] Map Docker volume mounts correctly
- [ ] Ensure proper permissions for Plex access
- [ ] Create directory structure documentation
- [ ] Validate path accessibility

### 3. Metadata Enhancement

- [ ] Create .nfo files for better Plex matching
- [ ] Add poster images from YouTube thumbnails
- [ ] Set proper content ratings
- [ ] Add channel information as studio/network
- [ ] Configure episode ordering for playlists

### 4. Collection Management (Post-MVP)

- [ ] Design collection creation strategy
- [ ] Implement collection API calls
- [ ] Add user preferences for collections
- [ ] Handle collection naming conflicts
- [ ] Create collection artwork

### 5. Download Completion Workflow

- [ ] Notify user when download completes
- [ ] Trigger Plex scan automatically
- [ ] Wait for scan completion
- [ ] Verify content appears in Plex
- [ ] Send final success notification

### 6. Error Recovery

- [ ] Handle Plex server unavailability
- [ ] Retry failed scans
- [ ] Clean up orphaned downloads
- [ ] Report issues to users
- [ ] Log detailed errors for debugging

## Implementation Details

```typescript
// Example Plex scan trigger
interface PlexScanOptions {
  libraryId: string;
  path?: string;
  force?: boolean;
}

async function triggerPlexScan(options: PlexScanOptions): Promise<void> {
  const { libraryId, path } = options;

  // Trigger targeted scan
  if (path) {
    await plexClient.scanDirectory(libraryId, path);
  } else {
    await plexClient.refreshLibrary(libraryId);
  }

  // Monitor scan progress
  await monitorScanProgress(libraryId);
}

// Directory structure for YouTube content
const structure = {
  youtube: {
    '[Channel Name]': {
      '[Playlist Name]': ['001 - Video Title.mp4', '002 - Video Title.mp4'],
    },
  },
};
```

## Testing Requirements

- [ ] Test library scan triggering
- [ ] Test metadata file creation
- [ ] Verify Plex discovers content
- [ ] Test error scenarios
- [ ] Test with various content types
- [ ] Verify user isolation works

## Success Criteria

- [ ] Downloads appear in Plex automatically
- [ ] Metadata displays correctly
- [ ] Scans complete efficiently
- [ ] No impact on other Plex users
- [ ] Clear success/failure notifications
- [ ] Proper content organization

## Notes

- Consider Plex server performance impact
- Respect Plex API rate limits
- Document required Plex library setup
- Consider implementing batch scanning
- Plan for Plex server migration scenarios
