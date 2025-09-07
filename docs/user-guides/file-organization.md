# File Organization Guide

MediaNest provides powerful file organization features to help you maintain a clean and structured media library. This guide covers organizing files, folders, and implementing automated organization rules.

## Organization Principles

### Best Practices

#### Consistent Naming Conventions

- Use consistent naming patterns across your library
- Include relevant information in filenames
- Avoid special characters that may cause issues
- Use separators consistently (spaces, dashes, or underscores)

#### Logical Directory Structure

```
/media/
├── Movies/
│   ├── Action/
│   ├── Comedy/
│   ├── Drama/
│   └── Foreign/
├── TV Shows/
│   ├── Ongoing Series/
│   ├── Completed Series/
│   └── Documentaries/
├── Music/
│   ├── Artists/
│   ├── Albums/
│   └── Compilations/
└── Other/
    ├── Audiobooks/
    ├── Podcasts/
    └── Home Videos/
```

#### Metadata-Driven Organization

- Leverage metadata for automatic organization
- Use tags and collections for flexible grouping
- Maintain accurate metadata for better organization

## Automated Organization

### Auto-Organization Rules

MediaNest can automatically organize files based on customizable rules:

#### Create Organization Rules

1. Navigate to **Settings** → **File Organization**
2. Click **Add New Rule**
3. Configure rule parameters:
   - **Source Pattern**: Files to match
   - **Destination Pattern**: Where to move files
   - **Conditions**: When to apply the rule
   - **Actions**: What to do with matched files

#### Example Organization Rules

##### Movie Organization

```json
{
  "name": "Movie Organization",
  "enabled": true,
  "source": "/media/downloads/movies/*",
  "destination": "/media/movies/{genre}/{title} ({year})/",
  "pattern": "{title} ({year}) [{quality}].{ext}",
  "conditions": {
    "mediaType": "movie",
    "minFileSize": "100MB"
  },
  "actions": ["move", "rename", "createFolder"]
}
```

##### TV Show Organization

```json
{
  "name": "TV Show Organization",
  "enabled": true,
  "source": "/media/downloads/tv/*",
  "destination": "/media/tv/{series}/Season {season:02d}/",
  "pattern": "{series} - S{season:02d}E{episode:02d} - {title}.{ext}",
  "conditions": {
    "mediaType": "tv",
    "hasEpisodeInfo": true
  },
  "actions": ["move", "rename", "createFolder"]
}
```

##### Music Organization

```json
{
  "name": "Music Organization",
  "enabled": true,
  "source": "/media/downloads/music/*",
  "destination": "/media/music/{artist}/{album}/",
  "pattern": "{track:02d} - {title}.{ext}",
  "conditions": {
    "mediaType": "music",
    "hasMetadata": true
  },
  "actions": ["move", "rename"]
}
```

### Organization Patterns

#### Pattern Variables

MediaNest supports various pattern variables for file organization:

| Variable     | Description    | Example          |
| ------------ | -------------- | ---------------- |
| `{title}`    | Media title    | "The Matrix"     |
| `{year}`     | Release year   | "1999"           |
| `{genre}`    | Primary genre  | "Action"         |
| `{director}` | Director name  | "Lana Wachowski" |
| `{series}`   | TV series name | "Breaking Bad"   |
| `{season}`   | Season number  | "1" or "01"      |
| `{episode}`  | Episode number | "5" or "05"      |
| `{artist}`   | Music artist   | "The Beatles"    |
| `{album}`    | Album name     | "Abbey Road"     |
| `{track}`    | Track number   | "3" or "03"      |
| `{quality}`  | Video quality  | "1080p", "4K"    |
| `{codec}`    | Video codec    | "h264", "h265"   |
| `{ext}`      | File extension | "mp4", "mkv"     |

#### Pattern Modifiers

```javascript
// Number formatting
{season:02d}    // Zero-padded 2-digit number: "01", "02"
{episode:03d}   // Zero-padded 3-digit number: "001", "002"

// Text formatting
{title:title}   // Title case: "The Matrix"
{title:upper}   // Upper case: "THE MATRIX"
{title:lower}   // Lower case: "the matrix"
{title:clean}   // Clean special characters: "The_Matrix"

// Conditional patterns
{genre:default=Unknown}        // Use "Unknown" if genre is empty
{director:format=by {value}}   // Format as "by Director Name"
```

### Folder Structure Templates

#### Pre-defined Templates

MediaNest includes several organization templates:

##### Plex-Compatible Structure

```
Movies/
├── Action/
│   └── The Matrix (1999)/
│       └── The Matrix (1999) - 1080p.mp4
└── Comedy/
    └── The Hangover (2009)/
        └── The Hangover (2009) - 720p.mkv

TV Shows/
├── Breaking Bad (2008)/
│   ├── Season 01/
│   │   └── Breaking Bad - S01E01 - Pilot.mp4
│   └── Season 02/
└── Game of Thrones (2011)/
```

##### Jellyfin-Compatible Structure

```
Movies/
└── The Matrix (1999)/
    ├── The Matrix (1999).mp4
    ├── poster.jpg
    └── fanart.jpg

Shows/
└── Breaking Bad/
    ├── Season 01/
    │   └── Breaking Bad S01E01.mp4
    └── metadata/
        └── series.xml
```

##### Custom Flat Structure

```
All Media/
├── Movies - Action - The Matrix (1999).mp4
├── Movies - Comedy - The Hangover (2009).mkv
├── TV - Breaking Bad - S01E01 - Pilot.mp4
└── Music - The Beatles - Come Together.mp3
```

## Manual Organization

### File Operations

#### Move Files

1. Select files in the library view
2. Choose **Move** from the action menu
3. Select destination folder or create new one
4. Choose to move or copy files
5. Update metadata references automatically

#### Rename Files

1. Select files to rename
2. Choose **Rename** from the action menu
3. Options:
   - **Pattern-based**: Use naming patterns
   - **Manual**: Edit names individually
   - **Batch**: Apply same changes to multiple files

#### Create Folder Structure

```bash
# Create folder structure via web interface or CLI
medianest organize create-structure --template plex --path /media

# Create custom structure
medianest organize create-folders --config custom-structure.json
```

### Batch Operations

#### Bulk File Operations

1. **Select Multiple Files**:

   - Checkbox selection
   - Ctrl+click for individual selection
   - Shift+click for range selection
   - Select all with Ctrl+A

2. **Available Bulk Operations**:
   - Move to folder
   - Rename with pattern
   - Update metadata
   - Apply tags
   - Delete files

#### Batch Rename Examples

##### Sequential Numbering

```
Original: episode1.mp4, episode2.mp4
Pattern: Episode {counter:02d}.mp4
Result: Episode 01.mp4, Episode 02.mp4
```

##### Metadata-based Naming

```
Original: random_name.mp4
Pattern: {series} - S{season:02d}E{episode:02d} - {title}.mp4
Result: Breaking Bad - S01E01 - Pilot.mp4
```

## Smart Organization Features

### Duplicate Management

#### Duplicate Detection Settings

```json
{
  "duplicateDetection": {
    "enabled": true,
    "methods": ["fileHash", "filename", "metadata"],
    "sensitivity": "high",
    "autoAction": "prompt"
  }
}
```

#### Duplicate Resolution Strategies

- **Keep Best Quality**: Automatically keep highest quality version
- **Keep Newest**: Keep most recently added file
- **Keep Largest**: Keep largest file size
- **Manual Review**: Prompt user for decision
- **Keep All**: Mark as duplicates but keep both

### Orphaned File Cleanup

#### Find Orphaned Files

```bash
# CLI command to find orphaned files
medianest organize find-orphans --path /media --action list

# Clean up orphaned files
medianest organize cleanup-orphans --dry-run
```

#### Orphaned File Types

- **Missing Metadata**: Files without database entries
- **Broken Links**: Database entries with missing files
- **Unused Thumbnails**: Thumbnails without source files
- **Temporary Files**: Leftover temporary files

### Missing File Recovery

#### Scan for Missing Files

1. Navigate to **Library** → **Maintenance**
2. Click **Scan for Missing Files**
3. Review missing file report
4. Actions:
   - **Re-scan**: Look for moved files
   - **Update Path**: Update file locations
   - **Remove**: Remove from database
   - **Ignore**: Mark as intentionally missing

## Advanced Organization

### Custom Organization Scripts

#### JavaScript-based Rules

```javascript
// Custom organization script
function organizeFile(file, metadata) {
  if (metadata.type === 'movie') {
    const genre = metadata.genre[0] || 'Unknown';
    const decade = Math.floor(metadata.year / 10) * 10;
    return {
      path: `/movies/${genre}/${decade}s/`,
      filename: `${metadata.title} (${metadata.year}).${file.extension}`,
    };
  }

  if (metadata.type === 'tv') {
    return {
      path: `/tv/${metadata.series}/Season ${metadata.season.padStart(2, '0')}/`,
      filename: `${metadata.series} - S${metadata.season.padStart(
        2,
        '0'
      )}E${metadata.episode.padStart(2, '0')} - ${metadata.title}.${file.extension}`,
    };
  }

  return null; // Don't organize this file
}
```

#### Python Integration

```python
# External Python script for complex organization
import os
import json
from medianest import MediaNestAPI

api = MediaNestAPI(token=os.environ['MEDIANEST_TOKEN'])

def custom_organizer(file_info):
    """Custom organization logic"""
    metadata = file_info['metadata']

    # Example: Organize by IMDb rating
    if metadata.get('imdbRating'):
        rating = float(metadata['imdbRating'])
        if rating >= 8.0:
            return 'movies/highly-rated/'
        elif rating >= 6.0:
            return 'movies/good/'
        else:
            return 'movies/average/'

    return 'movies/unrated/'

# Process all movies
for movie in api.get_movies():
    new_path = custom_organizer(movie)
    api.move_file(movie['id'], new_path)
```

### Integration with External Tools

#### Sonarr/Radarr Integration

```json
{
  "externalIntegrations": {
    "sonarr": {
      "enabled": true,
      "url": "http://sonarr.local:8989",
      "apiKey": "your_api_key",
      "syncEnabled": true
    },
    "radarr": {
      "enabled": true,
      "url": "http://radarr.local:7878",
      "apiKey": "your_api_key",
      "syncEnabled": true
    }
  }
}
```

#### File Monitoring

```bash
# Monitor directories for changes
WATCH_DIRECTORIES=/media/downloads,/media/incoming
WATCH_RECURSIVE=true
WATCH_EVENTS=create,move,delete
AUTO_ORGANIZE=true
```

## Organization Monitoring

### Activity Logging

#### Track Organization Activities

- File moves and renames
- Folder creation/deletion
- Rule applications
- Batch operations
- User actions

#### Activity Log Format

```json
{
  "timestamp": "2024-12-07T10:30:00Z",
  "user": "admin",
  "action": "move_file",
  "source": "/media/downloads/movie.mp4",
  "destination": "/media/movies/Action/The Matrix (1999)/The Matrix (1999) - 1080p.mp4",
  "rule": "Movie Organization",
  "status": "success"
}
```

### Organization Reports

#### Generate Reports

```bash
# Organization summary report
medianest organize report --type summary --period month

# Detailed organization activity
medianest organize report --type detailed --start-date 2024-12-01

# Rule effectiveness report
medianest organize report --type rules --format json
```

#### Report Metrics

- Files organized per rule
- Organization success rate
- Most active organization patterns
- Storage space changes
- Error frequency and types

## Organization Best Practices

### Performance Optimization

#### Efficient Organization Strategies

1. **Batch Processing**: Process multiple files together
2. **Off-peak Hours**: Schedule organization during low usage
3. **Progressive Organization**: Organize in stages
4. **Resource Monitoring**: Monitor CPU and I/O usage

#### Large Library Considerations

- Use incremental organization for large libraries
- Implement file locking during moves
- Consider network bandwidth for remote storage
- Plan for extended processing times

### Backup and Recovery

#### Pre-organization Backup

```bash
# Create backup before major organization
medianest backup create --name "pre-organization-$(date +%Y%m%d)"

# Test organization with dry-run
medianest organize apply-rules --dry-run --verbose
```

#### Recovery Procedures

- Maintain file location history
- Keep organization logs for reversal
- Test restoration procedures
- Document organization changes

### Maintenance Schedule

#### Regular Maintenance Tasks

```json
{
  "schedule": {
    "daily": ["scan_new_files", "apply_auto_rules"],
    "weekly": ["duplicate_detection", "orphaned_file_cleanup", "organization_report"],
    "monthly": ["full_library_scan", "rule_effectiveness_review", "storage_optimization"]
  }
}
```

For more information about automated workflows and advanced organization features, see the [API Reference](../api/index.md) and [Developer Documentation](../developers/index.md).
