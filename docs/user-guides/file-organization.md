# File Organization

Learn how to organize your media files effectively with MediaNest's automated and manual organization features.

## Overview

MediaNest provides flexible file organization capabilities that help you maintain a clean, structured media library regardless of your starting point or preferred organization method.

## Organization Strategies

### Automatic Organization

MediaNest can automatically organize your files based on metadata and customizable rules:

```
/media/
├── Movies/
│   ├── Action/
│   │   └── The Matrix (1999)/
│   │       ├── The Matrix (1999).mkv
│   │       └── poster.jpg
│   └── Drama/
│       └── The Godfather (1972)/
└── TV Shows/
    └── Breaking Bad/
        ├── Season 01/
        └── Season 02/
```

### Manual Organization

For users who prefer manual control:

- Drag-and-drop interface
- Batch move operations
- Custom folder structures
- Metadata-based sorting

## Organization Rules

Create custom rules for automatic file organization:

### Rule Examples

```yaml
# Movie Organization
pattern: "*.{mp4,mkv,avi}"
destination: "/Movies/{genre}/{title} ({year})"
conditions:
  - file_type: video
  - metadata.type: movie

# TV Show Organization  
pattern: "*.{mp4,mkv,avi}"
destination: "/TV Shows/{series}/Season {season:02d}"
conditions:
  - file_type: video
  - metadata.type: episode
```

## Best Practices

### Naming Conventions

Follow consistent naming patterns:

- **Movies**: `Title (Year).ext`
- **TV Shows**: `Show Name S01E01 - Episode Title.ext`
- **Music**: `Artist - Album - Track Number - Title.ext`

### Folder Structure

Recommended folder hierarchy:

```
/media/
├── Movies/
│   ├── 0-9/
│   ├── A-C/
│   ├── D-G/
│   └── [continues alphabetically]
├── TV Shows/
│   ├── Currently Watching/
│   ├── Completed/
│   └── To Watch/
├── Music/
│   ├── Albums/
│   ├── Singles/
│   └── Playlists/
└── Personal/
    ├── Home Movies/
    ├── Photos/
    └── Documents/
```

## Organization Tools

### Bulk Operations

Select multiple files and:
- Move to different folders
- Rename using patterns
- Apply metadata changes
- Generate thumbnails

### Smart Folders

Create dynamic folders based on criteria:
- Recently added
- Unwatched movies
- Favorite genres
- Custom tags

## Integration Features

### Plex Compatibility

MediaNest maintains Plex-compatible folder structures:

- Standard Plex naming conventions
- Proper season/episode numbering
- Metadata preservation
- Library sync maintenance

### External Tools

Works with popular organization tools:
- Sonarr/Radarr integration
- Filebot compatibility
- Custom script support

## Next Steps

- [Metadata Management](metadata.md) - Enhance organization with metadata
- [Collections](collections.md) - Create themed collections
- [Search and Filtering](search-filtering.md) - Find content quickly