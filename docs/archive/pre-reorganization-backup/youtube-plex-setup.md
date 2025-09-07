# YouTube to Plex Integration Setup Guide

This guide explains how to configure MediaNest to automatically add downloaded YouTube content to your Plex library.

## Prerequisites

1. **Plex Media Server** configured and accessible
2. **MediaNest** with YouTube downloader enabled
3. Proper directory permissions for both MediaNest and Plex

## Configuration Steps

### 1. Create a YouTube Library in Plex

1. Open Plex Web UI
2. Go to Settings → Manage → Libraries
3. Click "Add Library"
4. Choose "Other Videos" as the library type
5. Name it "YouTube" (or any name containing "youtube")
6. Add the folder path where YouTube downloads will be stored
   - Default: `/data/youtube` (inside Docker)
   - This should map to your `YOUTUBE_DOWNLOAD_PATH`

### 2. Configure MediaNest Environment Variables

Add these to your `.env` file:

```bash
# YouTube Download Configuration
YOUTUBE_DOWNLOAD_PATH=/app/youtube           # Where MediaNest saves files
PLEX_YOUTUBE_LIBRARY_PATH=/data/youtube      # Where Plex reads files

# These paths must be accessible by both containers
# Example Docker volume mapping:
# - ./youtube:/app/youtube:rw                 # MediaNest write access
# - ./youtube:/data/youtube:ro                # Plex read access
```

### 3. Docker Compose Configuration

Ensure both MediaNest and Plex containers can access the YouTube downloads:

```yaml
services:
  medianest:
    volumes:
      - ./youtube:/app/youtube:rw # Read/write for downloads
    environment:
      - YOUTUBE_DOWNLOAD_PATH=/app/youtube
      - PLEX_YOUTUBE_LIBRARY_PATH=/data/youtube

  plex:
    volumes:
      - ./youtube:/data/youtube:ro # Read-only for Plex
```

### 4. Directory Structure

MediaNest organizes downloads by user:

```
youtube/
├── user-id-1/
│   ├── Video_Title_abc123_1234567890.mp4
│   ├── Video_Title_abc123_1234567890.nfo    # Metadata for Plex
│   └── Video_Title_abc123_1234567890-thumb.jpg
└── user-id-2/
    └── Another_Video_xyz789_1234567891.mp4
```

## Features

### Automatic Library Scanning

- After each successful download, MediaNest triggers a Plex library scan
- Only the specific user's directory is scanned (efficient)
- Scans are queued to avoid overwhelming Plex

### Metadata Enhancement

MediaNest creates `.nfo` files with:

- Video title
- YouTube channel as "studio"
- Duration
- Thumbnail URL
- YouTube video ID for identification

### Thumbnail Downloads

- Thumbnails are automatically downloaded from YouTube
- Saved as `video-name-thumb.jpg`
- Plex will use these for poster images

### Storage Management

- Each user has a 10GB storage limit
- Oldest videos are automatically deleted when limit is reached
- Configurable per-user limits (future feature)

## API Endpoints

### Manually Trigger YouTube Library Scan

```bash
POST /api/v1/plex/youtube/scan
Authorization: Bearer <token>
```

### Scan Specific Directory

```bash
POST /api/v1/plex/libraries/scan
Authorization: Bearer <token>
Content-Type: application/json

{
  "libraryKey": "3",
  "directory": "/data/youtube/user-id"
}
```

## Troubleshooting

### Videos Not Appearing in Plex

1. **Check Library Path**: Ensure Plex library points to the correct directory
2. **Verify Permissions**: Plex needs read access to the files
3. **Manual Scan**: Try manually scanning the library in Plex settings
4. **Check Logs**: Look for scan errors in MediaNest logs

### Metadata Not Working

1. **NFO Files**: Ensure `.nfo` files are being created
2. **Plex Agent**: Use "Personal Media" or "Local Media Assets" agent
3. **File Naming**: Files should have clean, readable names

### Common Issues

**Issue**: "No YouTube library found in Plex"

- **Solution**: Create a library with "youtube" in the name

**Issue**: Downloads succeed but Plex doesn't see them

- **Solution**: Check volume mappings in Docker Compose

**Issue**: Thumbnails not showing

- **Solution**: Ensure Plex agent is configured to use local assets

## Best Practices

1. **Library Organization**
   - Keep YouTube content in a separate library
   - Don't mix with other media types

2. **Naming Convention**
   - MediaNest uses: `Title_VideoID_Timestamp.extension`
   - This prevents duplicates and ensures uniqueness

3. **Regular Maintenance**
   - Monitor storage usage
   - Clean up old content periodically
   - Check for failed scans in logs

## Future Enhancements

- [ ] Collection creation by YouTube channel
- [ ] Playlist support with proper ordering
- [ ] Custom metadata templates
- [ ] Automatic quality selection based on Plex client
- [ ] Subtitle download and integration
