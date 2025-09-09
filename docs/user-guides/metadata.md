# Metadata Management

Master MediaNest's metadata system to enhance your media library with rich information, better organization, and improved discoverability.

## Understanding Metadata

Metadata is the information about your media files that makes them discoverable and organized. MediaNest extracts, manages, and enhances metadata automatically while giving you full control over customization.

### Types of Metadata

#### Technical Metadata
- File size, format, and codec information
- Resolution, bitrate, and duration
- Creation and modification dates
- Checksum and file integrity data

#### Descriptive Metadata  
- Title, description, and tags
- Genre, year, and rating information
- Cast, crew, and production details
- Cover art and promotional images

#### Custom Metadata
- Personal ratings and notes
- Watch status and progress
- Custom tags and categories
- User-defined fields

## Automatic Metadata Extraction

### File Analysis
MediaNest automatically extracts metadata from:

```bash
# Video files
- Title from filename or embedded metadata
- Duration, resolution, and codec information
- Subtitle tracks and audio languages
- Chapter information

# Audio files  
- Artist, album, and track information
- Genre, year, and disc number
- Album artwork and lyrics
- Audio quality and format details

# Images
- EXIF data including camera settings
- GPS location coordinates  
- Creation date and time
- Image dimensions and format
```

### External Data Sources

MediaNest integrates with popular metadata providers:

- **TMDb** - Movies and TV shows
- **MusicBrainz** - Music albums and artists
- **IMDb** - Film and television database
- **TheTVDB** - TV series information
- **Fanart.tv** - High-quality artwork

### Configuration

Configure automatic metadata fetching:

```python
# In settings.py
METADATA_PROVIDERS = {
    'tmdb': {
        'enabled': True,
        'api_key': 'your_tmdb_api_key',
        'language': 'en-US',
        'region': 'US'
    },
    'musicbrainz': {
        'enabled': True,
        'rate_limit': 1.0,  # seconds between requests
        'user_agent': 'MediaNest/1.0'
    }
}
```

## Manual Metadata Editing

### Single Item Editing

1. **Select media item**
2. **Click "Edit Metadata"**
3. **Update fields**:
   - Basic information (title, year, genre)
   - Cast and crew details
   - Plot summary and tags
   - Custom fields and notes
4. **Save changes**

### Bulk Editing

Edit multiple items simultaneously:

1. **Select multiple items** (Ctrl+click or shift+click)
2. **Choose "Bulk Edit"** from context menu
3. **Update common fields**:
   - Add/remove tags
   - Change genre or category
   - Update custom fields
   - Apply ratings
4. **Preview changes** before applying
5. **Apply to selected items**

### Advanced Editing Features

#### Field Templates
Create templates for consistent metadata:

```yaml
# Movie template
movie_template:
  genre: ""
  year: null
  rating: null
  tags: []
  custom_fields:
    collection: ""
    source: ""
    quality: ""
```

#### Batch Operations
Use patterns and rules for bulk updates:

```python
# Example: Add genre based on folder name
if media.folder_path.contains('Action'):
    media.genre.add('Action')
    
# Add quality tag based on resolution  
if media.resolution >= '1080p':
    media.tags.add('HD')
```

## Metadata Standards

### Naming Conventions

Follow consistent naming standards:

```
# Movies
Title (Year)
The Matrix (1999)

# TV Shows  
Show Name S01E01 - Episode Title
Breaking Bad S01E01 - Pilot

# Music
Artist - Album - Track Number - Title
The Beatles - Abbey Road - 01 - Come Together
```

### Tag Systems

Organize with systematic tagging:

#### Genre Tags
- Primary genres: Action, Comedy, Drama, Horror
- Sub-genres: Romantic Comedy, Psychological Thriller
- Mood tags: Feel-good, Dark, Uplifting

#### Quality Tags  
- Resolution: 480p, 720p, 1080p, 4K
- Source: BluRay, Web-DL, TV-Rip
- Audio: DTS, AC3, AAC, Atmos

#### Status Tags
- Watched, Unwatched, In Progress
- Favorite, Wishlist, Archive
- Collections: Marvel, DC, Studio Ghibli

## Custom Fields

### Creating Custom Fields

Add specialized metadata fields:

1. **Go to Settings > Metadata Fields**
2. **Click "Add Custom Field"**
3. **Configure field properties**:
   - Field name and display label
   - Data type (text, number, date, boolean)
   - Default value and validation rules
   - Visibility and editing permissions

### Field Types

#### Text Fields
- Single-line text (titles, names)
- Multi-line text (descriptions, notes)
- Rich text with formatting support

#### Structured Fields
- Select lists (dropdown options)
- Multi-select (tags, categories)
- Numeric fields (ratings, counts)
- Date/time fields

#### Reference Fields
- Links to other media items
- Person references (actors, directors)
- Collection memberships

### Field Examples

```yaml
custom_fields:
  acquisition_date:
    type: date
    label: "Date Added"
    default: today
    
  personal_rating:
    type: number
    label: "My Rating"
    min: 1
    max: 10
    
  viewing_notes:
    type: textarea
    label: "Notes"
    max_length: 1000
    
  collection:
    type: select
    label: "Collection"
    options: [Marvel, DC, Disney, Horror]
```

## Metadata Validation

### Quality Checks

MediaNest performs automatic validation:

- **Completeness**: Identifies missing required fields
- **Consistency**: Checks for data format compliance
- **Accuracy**: Validates against external sources
- **Duplicates**: Detects duplicate or conflicting entries

### Validation Rules

Create custom validation rules:

```python
# Example validation rules
validation_rules = {
    'title': {
        'required': True,
        'min_length': 1,
        'max_length': 200
    },
    'year': {
        'type': 'integer',
        'min': 1900,
        'max': current_year + 2
    },
    'rating': {
        'type': 'float',
        'min': 0.0,
        'max': 10.0
    }
}
```

### Error Reporting

View and fix metadata issues:

1. **Access Metadata Dashboard**
2. **Review validation reports**:
   - Missing metadata warnings
   - Format inconsistencies
   - External source conflicts
3. **Bulk fix common issues**
4. **Export reports for analysis**

## Performance Optimization

### Indexing Strategy

Optimize search performance:

```sql
-- Database indexes for common metadata searches
CREATE INDEX idx_media_title ON media(title);
CREATE INDEX idx_media_genre ON media(genre);
CREATE INDEX idx_media_year ON media(year);
CREATE INDEX idx_media_tags ON media USING GIN(tags);
```

### Caching

Improve metadata lookup speed:

- Cache frequently accessed metadata
- Pre-load related information
- Background refresh of external data
- Optimized database queries

### Batch Processing

Process metadata efficiently:

- Queue metadata updates
- Batch external API requests
- Background processing for large libraries
- Progress tracking and resumption

## Import and Export

### Export Metadata

Export metadata for backup or migration:

```bash
# Export all metadata
python manage.py export_metadata --format json --output metadata.json

# Export specific fields
python manage.py export_metadata --fields title,year,genre --format csv

# Export by collection
python manage.py export_metadata --collection "Marvel Movies" --format xml
```

### Import Metadata

Import metadata from external sources:

```bash
# Import from JSON
python manage.py import_metadata metadata.json

# Import from CSV with field mapping
python manage.py import_metadata data.csv --mapping title:Title,year:Year

# Import from external database
python manage.py import_metadata --source plex --server http://plex:32400
```

### Format Support

Supported import/export formats:

- **JSON** - Complete metadata with relationships
- **CSV** - Tabular data for spreadsheet compatibility  
- **XML** - Structured data with schema validation
- **YAML** - Human-readable configuration format

## Integration Features

### Plex Metadata Sync

Keep metadata synchronized with Plex:

- Bi-directional sync support
- Conflict resolution strategies
- Custom field mapping
- Scheduled synchronization

### External Tool Integration

Connect with popular tools:

- **Sonarr/Radarr** - Automatic metadata updates
- **Tautulli** - Viewing statistics integration
- **Jellyfin** - Cross-platform metadata sharing
- **Kodi** - Media center integration

## Best Practices

### Organization Principles

1. **Consistency First** - Use standardized formats and naming
2. **Complete Information** - Fill in all relevant fields
3. **Regular Maintenance** - Schedule periodic metadata reviews
4. **Backup Strategy** - Export metadata regularly
5. **Quality Control** - Validate and clean data periodically

### Workflow Tips

- Set up automatic rules for common scenarios
- Use templates for consistent data entry
- Batch edit similar items together
- Review and approve automatic changes
- Maintain changelog for significant updates

## Troubleshooting

### Common Issues

#### Missing Metadata
```bash
# Force metadata refresh
python manage.py refresh_metadata --force

# Check external API status
python manage.py check_metadata_sources
```

#### Slow Performance
```bash
# Rebuild metadata indexes
python manage.py rebuild_indexes

# Clear metadata cache
python manage.py clear_cache metadata
```

#### Sync Conflicts
- Review conflicting changes
- Set conflict resolution preferences
- Manual resolution for complex cases
- Backup before major sync operations

## Next Steps

- [Search and Filtering](search-filtering.md) - Find content using metadata
- [Collections](collections.md) - Organize with metadata-driven collections
- [API Reference](../api/media.md) - Programmatic metadata access