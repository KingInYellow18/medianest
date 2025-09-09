# Media Management

Learn how to effectively manage your media files with MediaNest's powerful organization and processing features.

## Overview

MediaNest provides comprehensive media management capabilities including:

- **Automated file organization** with customizable rules
- **Metadata extraction** from various file formats
- **Duplicate detection** and management
- **Batch operations** for efficient processing
- **Integration** with external metadata services

## Adding Media Files

### Manual Upload

1. **Single File Upload**:
   - Navigate to **Media > Add Media**
   - Click **Choose File** or drag and drop
   - Fill in metadata fields (optional)
   - Click **Upload**

2. **Bulk Upload**:
   - Use the **Bulk Upload** feature for multiple files
   - Select multiple files or entire folders
   - Choose processing options
   - Monitor upload progress in the queue

### Automatic Import

#### Watch Folders
Set up watch folders for automatic import:

1. Go to **Settings > Import Settings**
2. Add watch folder paths
3. Configure import rules:
   - File type filters
   - Automatic organization
   - Metadata extraction
   - Duplicate handling

#### Scheduled Scans
```bash
# Set up scheduled media scan
python manage.py scan_media --path /media/incoming --auto-import
```

## File Organization

### Folder Structure

MediaNest supports flexible folder organization:

```
/media/
├── Movies/
│   ├── Action/
│   ├── Comedy/
│   └── Drama/
├── TV Shows/
│   ├── Show Name/
│   │   ├── Season 01/
│   │   └── Season 02/
├── Music/
│   ├── Artist/
│   │   └── Album/
└── Documents/
    ├── PDFs/
    └── Images/
```

### Automatic Organization Rules

Create rules for automatic file organization:

1. **Go to Settings > Organization Rules**
2. **Create New Rule**:
   ```
   Rule: Movie Organization
   Pattern: *.{mp4,mkv,avi}
   Destination: /Movies/{genre}/{title} ({year})
   Conditions: file_type = video AND metadata.type = movie
   ```

3. **Common Organization Patterns**:
   - `{title} ({year})` - Movies with release year
   - `{series}/{season}/{episode}` - TV show episodes
   - `{artist}/{album}/{track}` - Music files
   - `{date}/{category}` - Documents by date

## Metadata Management

### Automatic Extraction

MediaNest automatically extracts metadata from:

- **Video files**: Title, duration, resolution, codec
- **Audio files**: Artist, album, track, genre
- **Images**: EXIF data, dimensions, camera info
- **Documents**: Title, author, creation date

### Manual Editing

1. **Select media item**
2. **Click Edit Metadata**
3. **Update fields**:
   - Title and description
   - Tags and categories
   - Custom attributes
4. **Save changes**

### Bulk Metadata Editing

1. **Select multiple items**
2. **Choose Bulk Edit**
3. **Update common fields**:
   - Add/remove tags
   - Change categories
   - Update custom fields
4. **Apply to selected items**

## File Processing

### Thumbnail Generation

**Automatic Thumbnails**:
- Generated for all supported media types
- Multiple sizes available
- Cached for performance

**Manual Thumbnail**:
1. Select media item
2. Click **Generate Thumbnail**
3. Choose timestamp (for videos)
4. Save custom thumbnail

### Video Processing

**Preview Generation**:
```bash
# Generate video previews
python manage.py process_videos --generate-previews
```

**Format Conversion**:
- Automatic format detection
- Conversion to web-compatible formats
- Quality and compression settings

### Image Processing

**Optimization**:
- Automatic image compression
- Multiple resolution variants
- Format conversion (JPEG, WebP)

**EXIF Handling**:
- Preserve or strip EXIF data
- GPS coordinate extraction
- Date/time correction

## Duplicate Management

### Detection Methods

1. **Hash-based Detection**:
   - MD5/SHA256 file hashes
   - Exact duplicate identification
   - Most accurate method

2. **Content-based Detection**:
   - Visual similarity for images
   - Audio fingerprinting for music
   - Perceptual hashing

3. **Metadata-based Detection**:
   - Similar titles and dates
   - Filename patterns
   - File size ranges

### Managing Duplicates

1. **Access Duplicate Manager**:
   - Go to **Tools > Duplicate Manager**
   - Run duplicate scan

2. **Review Results**:
   - Compare file details
   - Preview content
   - Check metadata differences

3. **Resolution Options**:
   - Keep highest quality version
   - Merge metadata from all versions
   - Delete selected duplicates
   - Mark as not duplicates

### Automatic Duplicate Handling

```python
# Configure duplicate handling in settings.py
DUPLICATE_HANDLING = {
    'auto_detection': True,
    'detection_methods': ['hash', 'content'],
    'auto_resolution': 'keep_highest_quality',
    'backup_before_delete': True
}
```

## Search and Filtering

### Basic Search

- **Full-text search** across all metadata
- **File name search** with wildcards
- **Tag-based filtering**
- **Date range filtering**

### Advanced Search

```
Search Examples:
- title:"Batman" year:2020..2023
- type:video duration:>120 resolution:1080p
- artist:"The Beatles" album:"Abbey Road"
- created:2023 tag:vacation location:"Hawaii"
```

### Saved Searches

1. **Create custom searches**
2. **Save for quick access**
3. **Share with team members**
4. **Set up alerts for new matches**

## Batch Operations

### Bulk Actions

1. **Select multiple items**
2. **Choose action**:
   - Move to folder
   - Add/remove tags
   - Delete files
   - Export metadata
   - Generate thumbnails

3. **Monitor progress** in task queue

### Scheduled Tasks

```bash
# Set up scheduled maintenance
python manage.py schedule_task cleanup_thumbnails --interval daily
python manage.py schedule_task scan_duplicates --interval weekly
python manage.py schedule_task backup_metadata --interval daily
```

## Integration Features

### Plex Integration

- **Automatic library sync**
- **Metadata sharing**
- **Playback tracking**
- **User synchronization**

### External Services

**Metadata Services**:
- TMDb for movies and TV shows
- MusicBrainz for music
- Google Vision API for images

**Cloud Storage**:
- AWS S3 integration
- Google Drive sync
- Dropbox backup

## Performance Optimization

### Processing Settings

```python
# Optimize processing performance
MEDIA_PROCESSING = {
    'thumbnail_quality': 85,
    'max_concurrent_jobs': 4,
    'enable_gpu_acceleration': True,
    'cache_processed_files': True
}
```

### Database Optimization

- **Regular maintenance** tasks
- **Index optimization** for searches
- **Archive old records** periodically

### Storage Management

- **Monitor disk usage**
- **Implement retention policies**
- **Use compression** for archives
- **Clean up temporary files**

## Troubleshooting

### Common Issues

**Slow Processing**:
- Check system resources
- Reduce concurrent jobs
- Enable hardware acceleration

**Missing Thumbnails**:
```bash
# Regenerate thumbnails
python manage.py generate_thumbnails --force
```

**Import Failures**:
- Check file permissions
- Verify supported formats
- Review error logs

**Metadata Issues**:
- Update metadata extractors
- Check external service APIs
- Manual metadata correction

## Best Practices

1. **Consistent Naming**:
   - Use standardized file naming
   - Include relevant metadata in names
   - Avoid special characters

2. **Regular Maintenance**:
   - Run duplicate scans weekly
   - Clean up processed files
   - Update metadata regularly

3. **Backup Strategy**:
   - Regular database backups
   - File system snapshots
   - Test restore procedures

4. **Performance Monitoring**:
   - Monitor processing queues
   - Track storage usage
   - Review system performance

## Next Steps

- [File Organization](file-organization.md) - Advanced organization strategies
- [Search and Filtering](search-filtering.md) - Master search capabilities
- [Collections](collections.md) - Create and manage collections
- [Metadata Management](metadata.md) - Deep dive into metadata