# Media Management Guide

MediaNest provides comprehensive media management capabilities for organizing, searching, and managing your digital media collection. This guide covers all aspects of media management from import to organization.

## Media Import

### Automatic Library Scanning

MediaNest automatically scans your configured media directories to discover new files.

#### Configure Media Sources

1. Navigate to **Settings** → **Media Sources**
2. Click **Add New Source**
3. Configure the source:
   - **Name**: Descriptive name (e.g., "Movie Collection")
   - **Path**: Local or network path to media files
   - **Type**: Movies, TV Shows, Music, or Mixed
   - **Scan Schedule**: Automatic scanning frequency

#### Scan Settings

```json
{
  "sources": [
    {
      "name": "Movies",
      "path": "/media/movies",
      "type": "movies",
      "scanSchedule": "daily",
      "recursive": true,
      "followSymlinks": false
    },
    {
      "name": "TV Shows",
      "path": "/media/tv",
      "type": "tv",
      "scanSchedule": "hourly",
      "recursive": true
    }
  ]
}
```

### Manual Import

#### Upload Files

1. Navigate to **Library** → **Upload**
2. Choose upload method:
   - **Drag and Drop**: Drag files directly into the browser
   - **File Browser**: Click to select files
   - **Folder Upload**: Upload entire directories

#### Supported File Formats

| Media Type    | Supported Formats                  |
| ------------- | ---------------------------------- |
| **Video**     | MP4, MKV, AVI, MOV, WMV, FLV, WEBM |
| **Audio**     | MP3, FLAC, AAC, OGG, WAV, M4A      |
| **Images**    | JPEG, PNG, GIF, WebP, TIFF, BMP    |
| **Documents** | PDF, TXT, EPUB, MOBI               |
| **Archives**  | ZIP, RAR, 7Z, TAR                  |

### Bulk Import Operations

#### Command Line Import

```bash
# Import from command line
medianest import --path "/path/to/media" --type movies --recursive

# Import with metadata fetching
medianest import --path "/path/to/media" --fetch-metadata --overwrite

# Dry run to preview import
medianest import --path "/path/to/media" --dry-run
```

#### Batch Processing

- **Queue Management**: View and manage import queues
- **Progress Tracking**: Monitor import progress in real-time
- **Error Handling**: Review and resolve import errors
- **Retry Failed**: Retry failed imports automatically

## Media Organization

### Folder Structure

MediaNest supports flexible folder organization:

```
/media/
├── movies/
│   ├── Action/
│   ├── Comedy/
│   └── Drama/
├── tv-shows/
│   ├── Breaking Bad/
│   │   ├── Season 01/
│   │   └── Season 02/
└── music/
    ├── Artists/
    └── Albums/
```

### File Naming Conventions

#### Movies

```
Movie Title (Year).extension
The Matrix (1999).mp4
Inception (2010).mkv
```

#### TV Shows

```
Show Name - SxxExx - Episode Title.extension
Breaking Bad - S01E01 - Pilot.mp4
Game of Thrones - S08E06 - The Iron Throne.mkv
```

#### Music

```
Artist - Album - Track Number - Song Title.extension
The Beatles - Abbey Road - 01 - Come Together.mp3
```

### Auto-Organization Features

#### Smart Folder Organization

- **Genre-based**: Automatically organize by genre
- **Year-based**: Group media by release year
- **Rating-based**: Organize by content rating
- **Custom Rules**: Define custom organization rules

#### File Renaming

```javascript
// Example renaming rules
{
  "movies": "{title} ({year}) [{quality}].{ext}",
  "tv": "{series} - S{season:02d}E{episode:02d} - {title}.{ext}",
  "music": "{artist} - {album} - {track:02d} - {title}.{ext}"
}
```

## Metadata Management

### Automatic Metadata Fetching

MediaNest automatically fetches metadata from multiple sources:

#### Supported Metadata Sources

- **TMDB**: Movies and TV shows
- **TVDB**: Television series information
- **MusicBrainz**: Music metadata
- **Local Files**: Embedded metadata
- **File Names**: Parsed from filenames

#### Metadata Fields

```json
{
  "title": "The Matrix",
  "originalTitle": "The Matrix",
  "year": 1999,
  "genre": ["Action", "Sci-Fi"],
  "director": ["Lana Wachowski", "Lilly Wachowski"],
  "cast": ["Keanu Reeves", "Laurence Fishburne"],
  "plot": "A computer programmer is drawn into a rebellion...",
  "rating": "R",
  "imdbId": "tt0133093",
  "tmdbId": 603,
  "poster": "/poster.jpg",
  "backdrop": "/backdrop.jpg",
  "trailer": "https://youtube.com/watch?v=..."
}
```

### Manual Metadata Editing

#### Edit Individual Items

1. Select media item
2. Click **Edit** or **Info** button
3. Modify fields:
   - **Basic Info**: Title, year, genre
   - **Cast & Crew**: Actors, directors, writers
   - **Technical**: Resolution, codec, duration
   - **Custom Fields**: Tags, notes, ratings

#### Batch Metadata Editing

1. Select multiple items
2. Choose **Bulk Edit** from actions menu
3. Apply changes to all selected items
4. Options include:
   - Genre updates
   - Tag additions
   - Metadata refresh
   - Custom field updates

### Custom Metadata Fields

#### Create Custom Fields

```javascript
// Define custom fields in settings
{
  "customFields": {
    "personalRating": {
      "type": "number",
      "min": 1,
      "max": 10,
      "label": "Personal Rating"
    },
    "watchlist": {
      "type": "boolean",
      "label": "In Watchlist"
    },
    "notes": {
      "type": "text",
      "label": "Personal Notes"
    }
  }
}
```

## Media Processing

### Thumbnail Generation

MediaNest automatically generates thumbnails for visual media:

#### Thumbnail Settings

- **Quality**: JPEG quality (1-100)
- **Sizes**: Multiple thumbnail sizes
- **Formats**: JPEG, WebP support
- **Video Thumbnails**: Extract frames from videos

```json
{
  "thumbnails": {
    "quality": 80,
    "sizes": [
      { "name": "small", "width": 300, "height": 300 },
      { "name": "medium", "width": 600, "height": 600 },
      { "name": "large", "width": 1200, "height": 1200 }
    ],
    "videoThumbnails": {
      "enabled": true,
      "frameTime": "10%",
      "count": 3
    }
  }
}
```

### File Processing

#### Image Processing

- **Format Conversion**: Convert between formats
- **Compression**: Optimize file sizes
- **Resizing**: Generate different resolutions
- **Watermarking**: Add watermarks automatically

#### Video Processing (Advanced)

- **Transcoding**: Convert video formats
- **Quality Optimization**: Compress for streaming
- **Subtitle Extraction**: Extract embedded subtitles
- **Chapter Detection**: Detect video chapters

#### Audio Processing

- **Format Conversion**: Convert audio formats
- **Normalization**: Normalize audio levels
- **Metadata Extraction**: Extract embedded metadata
- **Artwork Extraction**: Extract album artwork

## Media Viewing and Playback

### Built-in Media Player

#### Supported Features

- **Video Playback**: HTML5 video player
- **Audio Playback**: HTML5 audio player
- **Playlist Support**: Create and manage playlists
- **Subtitle Support**: SRT, VTT subtitle files
- **Speed Control**: Playback speed adjustment

#### Player Controls

- Play/pause, seek, volume control
- Fullscreen mode
- Picture-in-picture mode
- Keyboard shortcuts
- Gesture controls (mobile)

### External Player Integration

#### Plex Integration

```bash
# Configure Plex integration
PLEX_SERVER_URL=http://plex.local:32400
PLEX_TOKEN=your_plex_token
PLEX_SYNC_ENABLED=true
```

#### VLC Integration

- **Stream to VLC**: Direct streaming to VLC player
- **Playlist Export**: Export playlists to M3U format
- **Remote Control**: Control VLC remotely

## Media Organization Tools

### Collections and Playlists

#### Create Collections

1. Navigate to **Collections** → **New Collection**
2. Configure collection:
   - **Name**: Collection name
   - **Description**: Optional description
   - **Criteria**: Auto-collection rules
   - **Manual**: Manually add items

#### Smart Collections

```json
{
  "name": "Recent Action Movies",
  "criteria": {
    "type": "movie",
    "genre": "Action",
    "dateAdded": {
      "$gte": "30 days ago"
    },
    "rating": {
      "$gte": 7.0
    }
  },
  "autoUpdate": true
}
```

### Tagging System

#### Create and Manage Tags

- **Hierarchical Tags**: Support for nested tags
- **Color Coding**: Visual tag identification
- **Auto-Tagging**: Automatic tag assignment
- **Tag Templates**: Predefined tag sets

#### Tag Categories

```javascript
// Example tag structure
{
  "categories": {
    "genre": ["Action", "Comedy", "Drama"],
    "quality": ["4K", "HD", "SD"],
    "status": ["Watched", "Watching", "Wishlist"],
    "custom": ["Family Friendly", "Director's Cut"]
  }
}
```

## Advanced Media Management

### Duplicate Detection

#### Automatic Duplicate Detection

- **File Hash Comparison**: MD5/SHA1 hash matching
- **Filename Similarity**: Similar name detection
- **Metadata Matching**: Same title/year matching
- **Size Comparison**: Similar file size detection

#### Duplicate Resolution

1. Review detected duplicates
2. Compare file details:
   - Quality differences
   - File size variations
   - Metadata completeness
3. Choose resolution action:
   - Keep best quality
   - Merge metadata
   - Delete duplicates
   - Mark as different

### Media Health Monitoring

#### File Integrity Checks

- **Corruption Detection**: Identify corrupted files
- **Missing File Detection**: Find missing media files
- **Orphaned Metadata**: Clean up unused metadata
- **Broken Links**: Fix broken file links

#### Scheduled Maintenance

```json
{
  "maintenance": {
    "schedule": "weekly",
    "tasks": ["integrityCheck", "duplicateDetection", "metadataCleanup", "thumbnailGeneration"]
  }
}
```

## Quality Management

### Video Quality Assessment

#### Quality Metrics

- **Resolution**: 4K, 1080p, 720p, 480p
- **Bitrate**: Video and audio bitrate
- **Codec**: H.264, H.265, VP9, AV1
- **HDR Support**: HDR10, Dolby Vision
- **Audio Quality**: Lossless, compressed formats

#### Quality Filters

```javascript
// Filter by quality criteria
{
  "minResolution": "1080p",
  "minBitrate": 5000000,
  "preferredCodecs": ["h265", "h264"],
  "hdrSupport": true
}
```

### Transcoding Management

#### Transcoding Profiles

```json
{
  "profiles": {
    "web": {
      "video": "h264",
      "resolution": "1080p",
      "bitrate": 5000000,
      "audio": "aac"
    },
    "mobile": {
      "video": "h264",
      "resolution": "720p",
      "bitrate": 2000000,
      "audio": "aac"
    }
  }
}
```

## Export and Backup

### Media Export

#### Export Options

- **Full Export**: Complete media and metadata
- **Metadata Only**: Export metadata to CSV/JSON
- **Selective Export**: Export specific collections
- **Format Conversion**: Export in different formats

#### Export Destinations

- Local filesystem
- Cloud storage (AWS S3, Google Drive)
- Network shares (SMB, NFS)
- External drives

### Backup Strategies

#### Automated Backups

```bash
# Configure automated backups
BACKUP_ENABLED=true
BACKUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM
BACKUP_RETENTION=30          # Keep 30 days
BACKUP_DESTINATION=/backup/medianest
```

#### Backup Contents

- Media files (optional, usually stored separately)
- Database with metadata
- Configuration files
- User data and preferences
- Custom fields and collections

## Integration with External Tools

### API Integration

#### REST API Access

```javascript
// Get media items via API
const response = await fetch('/api/media', {
  headers: {
    Authorization: 'Bearer ' + token,
  },
});
const media = await response.json();
```

#### Webhook Integration

```json
{
  "webhooks": {
    "mediaAdded": "https://external-app.com/webhook/media-added",
    "metadataUpdated": "https://external-app.com/webhook/metadata-updated"
  }
}
```

### Third-party Tool Integration

#### Supported Integrations

- **Plex**: Bi-directional synchronization
- **Kodi**: Library sharing
- **Jellyfin**: Metadata synchronization
- **Sonarr/Radarr**: Automated downloads integration

For more advanced media management features, see the [API Reference](../api/index.md) and [Developer Documentation](../developers/index.md).
