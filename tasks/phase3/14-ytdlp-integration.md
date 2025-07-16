# Phase 3: yt-dlp Integration for YouTube Downloads - ✅ COMPLETED

**Status:** ✅ COMPLETED  
**Priority:** High  
**Dependencies:** BullMQ queue setup, YouTube URL submission interface  
**Estimated Time:** 6 hours

## Objective

Integrate yt-dlp for downloading YouTube videos and playlists, with proper progress tracking, error handling, and Plex-compatible output formatting.

## Background

yt-dlp is a fork of youtube-dl with additional features and better performance. It will be used to download YouTube content requested by users, with downloads stored in user-isolated directories.

## Tasks

### 1. Install and Configure yt-dlp

- [ ] Install yt-dlp binary in Docker container
- [ ] Create yt-dlp configuration file
- [ ] Set up output templates for Plex compatibility
- [ ] Configure quality preferences (1080p max for bandwidth)
- [ ] Set up metadata extraction

### 2. Create yt-dlp Service Layer

- [ ] Build TypeScript wrapper for yt-dlp commands
- [ ] Implement playlist information extraction
- [ ] Add download execution with progress parsing
- [ ] Handle authentication for age-restricted content
- [ ] Implement format selection logic

### 3. Progress Tracking Implementation

- [ ] Parse yt-dlp progress output
- [ ] Convert to percentage completion
- [ ] Track individual video progress in playlists
- [ ] Store progress in Redis for resume capability
- [ ] Emit progress events via WebSocket

### 4. File Management

- [ ] Create user-isolated download directories
- [ ] Implement Plex-compatible naming scheme
- [ ] Handle subtitle downloads
- [ ] Create thumbnail extraction
- [ ] Implement post-processing for metadata

### 5. Error Handling

- [ ] Handle network interruptions
- [ ] Manage rate limiting from YouTube
- [ ] Handle region-blocked content
- [ ] Implement retry logic for failures
- [ ] Create detailed error messages

### 6. Security Considerations

- [ ] Validate URLs before processing
- [ ] Prevent directory traversal attacks
- [ ] Limit download file sizes
- [ ] Sanitize filenames
- [ ] Implement resource usage limits

## Implementation Details

```typescript
// Example yt-dlp wrapper
interface YtDlpOptions {
  url: string;
  outputPath: string;
  format: string;
  progressCallback: (progress: DownloadProgress) => void;
}

interface DownloadProgress {
  percentage: number;
  speed: string;
  eta: string;
  currentVideo?: number;
  totalVideos?: number;
}

// Output template for Plex
const outputTemplate = '%(uploader)s/%(playlist_title)s/%(playlist_index)03d - %(title)s.%(ext)s';

// yt-dlp command example
const args = [
  '--format',
  'best[height<=1080]',
  '--output',
  outputTemplate,
  '--write-sub',
  '--embed-subs',
  '--add-metadata',
  '--no-warnings',
  '--progress',
  '--newline',
  url,
];
```

## Testing Requirements

- [ ] Unit tests for service methods
- [ ] Integration tests with actual yt-dlp
- [ ] Test various URL formats (video, playlist, channel)
- [ ] Test progress tracking accuracy
- [ ] Test error scenarios
- [ ] Test file naming and organization

## Success Criteria

- [ ] Downloads complete successfully
- [ ] Progress tracked accurately
- [ ] Files organized for Plex scanning
- [ ] Metadata embedded correctly
- [ ] Errors handled gracefully
- [ ] Resource usage controlled

## Notes

- Consider using yt-dlp's JSON output for better parsing
- Monitor YouTube API changes
- Keep yt-dlp updated regularly
- Consider implementing download scheduling
- Document any YouTube-specific limitations
