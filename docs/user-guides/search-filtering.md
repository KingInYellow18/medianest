# Search and Filtering

Master MediaNest's powerful search and filtering capabilities to quickly find exactly what you're looking for in your media collection.

## Quick Search

The search bar at the top of the interface provides instant access to your entire media library:

```
# Basic search examples
Batman                  # Find any media with "Batman" in title or metadata
"The Dark Knight"       # Exact phrase search
actor:"Christian Bale"  # Search by specific field
2020..2023             # Date or year range
```

## Search Syntax

### Basic Operators

| Operator | Description | Example |
|----------|-------------|----------|
| `AND` | Both terms must exist | `batman AND joker` |
| `OR` | Either term must exist | `batman OR superman` |
| `NOT` | Exclude term | `batman NOT animated` |
| `""` | Exact phrase | `"The Dark Knight"` |
| `*` | Wildcard | `bat*` (matches batman, battle, etc.) |
| `?` | Single character wildcard | `bat?` (matches bats, bath, etc.) |

### Field-Specific Search

| Field | Description | Example |
|-------|-------------|----------|
| `title:` | Search in title | `title:"Inception"` |
| `genre:` | Search by genre | `genre:action` |
| `year:` | Search by year | `year:2020` |
| `actor:` | Search by actor | `actor:"Tom Hanks"` |
| `director:` | Search by director | `director:"Christopher Nolan"` |
| `tag:` | Search by tags | `tag:favorite` |
| `type:` | Media type | `type:movie` |
| `duration:` | Duration in minutes | `duration:>120` |
| `resolution:` | Video resolution | `resolution:1080p` |
| `size:` | File size | `size:>1GB` |
| `created:` | Creation date | `created:2023-01-01` |
| `modified:` | Last modified | `modified:>2023-06-01` |

### Comparison Operators

| Operator | Description | Example |
|----------|-------------|----------|
| `:` | Equals | `year:2020` |
| `:>` | Greater than | `duration:>120` |
| `:<` | Less than | `size:<500MB` |
| `:>=` | Greater than or equal | `year:>=2020` |
| `:<=` | Less than or equal | `rating:<=7` |
| `..` | Range | `year:2020..2023` |

## Advanced Search Examples

### Movies
```
# Action movies from the 2010s
type:movie genre:action year:2010..2019

# High-rated sci-fi movies over 2 hours
type:movie genre:"science fiction" rating:>8 duration:>120

# Movies with specific actors
actor:"Leonardo DiCaprio" AND actor:"Marion Cotillard"

# 4K movies added recently
resolution:2160p created:>2023-01-01
```

### TV Shows
```
# Complete TV series
type:series status:ended seasons:>5

# Current running shows
type:series status:running year:>=2020

# Episodes from specific season
type:episode series:"Breaking Bad" season:3

# Recent episodes
type:episode created:>2023-11-01
```

### Music
```
# Albums by genre and decade
type:album genre:rock year:1970..1979

# High-quality audio files
type:music bitrate:>320 format:flac

# Songs by duration
type:track duration:3..5

# Recent additions to music library
type:music created:>2023-10-01
```

### Images and Documents
```
# High-resolution images
type:image resolution:>1920x1080

# Recent photos with GPS data
type:photo created:>2023-01-01 location:*

# Large PDF documents
type:document format:pdf size:>10MB

# Images with specific camera
exif.camera:"Canon EOS R5"
```

## Filter Panels

### Quick Filters
Use the filter panel for common filtering options:

- **Media Type**: Movies, TV Shows, Music, Images, Documents
- **Genre**: Action, Comedy, Drama, Horror, etc.
- **Year**: By decade or specific year ranges
- **Rating**: IMDb, user ratings, or custom ratings
- **Quality**: Resolution, bitrate, file format
- **Status**: Watched/unwatched, favorite, etc.

### Advanced Filters

1. **Custom Date Ranges**:
   - Last 7 days
   - Last month
   - Last year
   - Custom range picker

2. **File Properties**:
   - File size ranges
   - Duration ranges
   - Quality/resolution
   - Audio/video codecs

3. **Collection Filters**:
   - Part of collection
   - Not in any collection
   - Specific collections

## Saved Searches

### Creating Saved Searches

1. **Build your search query**
2. **Click "Save Search"**
3. **Name your search**:
   - "Recent 4K Movies"
   - "Unwatched TV Episodes"
   - "High-Quality Music"
4. **Set visibility** (private/shared)

### Managing Saved Searches

- **Quick access** from sidebar
- **Edit search criteria**
- **Share with team members**
- **Set up notifications** for new matches
- **Export results** to various formats

### Smart Searches
Create dynamic searches that update automatically:

```
# Recently added movies
type:movie created:>7d

# Unwatched episodes from subscribed shows
type:episode watched:false subscribed:true

# High-priority items needing attention
priority:high status:pending
```

## Search Results

### View Options

1. **Grid View**:
   - Thumbnail grid with key info
   - Adjustable thumbnail sizes
   - Quick preview on hover

2. **List View**:
   - Detailed information columns
   - Sortable by any column
   - Bulk selection capabilities

3. **Card View**:
   - Rich media cards
   - Extended metadata display
   - Action buttons visible

### Sorting Options

- **Title** (A-Z or Z-A)
- **Date Added** (newest or oldest first)
- **Release Date** (newest or oldest first)
- **File Size** (largest or smallest first)
- **Duration** (longest or shortest first)
- **Rating** (highest or lowest first)
- **Random** (shuffle results)

### Result Actions

#### Individual Items
- **Preview** content inline
- **Play/Open** in default application
- **Download** original file
- **Edit metadata** inline
- **Add to collection**
- **Share** with users
- **Mark as favorite**

#### Bulk Actions
- **Select all** or **select filtered**
- **Add tags** to multiple items
- **Move to folder**
- **Delete selected**
- **Export metadata**
- **Generate thumbnails**
- **Add to collection**

## Faceted Search

### Dynamic Filters
As you search, MediaNest shows available filters based on your results:

```
Search: "science fiction"

Available Filters:
├── Genre:
│   ├── Science Fiction (1,245)
│   ├── Action (567)
│   └── Thriller (234)
├── Decade:
│   ├── 2020s (145)
│   ├── 2010s (456)
│   └── 2000s (234)
└── Rating:
    ├── 9+ (23)
    ├── 8-9 (145)
    └── 7-8 (234)
```

### Filter Combinations
Apply multiple filters to narrow results:

1. **Start with broad search**: `science fiction`
2. **Add year filter**: `+ 2020s`
3. **Add rating filter**: `+ Rating 8+`
4. **Add quality filter**: `+ 4K UHD`

## Search Performance

### Indexing
MediaNest maintains full-text indexes for:

- **File names and paths**
- **Metadata fields**
- **Custom tags and descriptions**
- **OCR text from images**
- **Subtitle content**

### Search Tips for Better Performance

1. **Use specific fields** when possible:
   ```
   # Faster
   title:batman year:2020
   
   # Slower
   batman 2020
   ```

2. **Limit broad searches**:
   ```
   # Better
   type:movie genre:action
   
   # Avoid
   *
   ```

3. **Use saved searches** for complex queries

4. **Filter by file type** first for large libraries

## Search History

### Recent Searches
- **Access last 50 searches**
- **Quick re-run** previous searches
- **Clear search history**

### Search Analytics
For administrators:

- **Most popular search terms**
- **Search performance metrics**
- **User search patterns**
- **Failed search analysis**

## API Search

### REST API Search
```bash
# Basic search via API
curl -X GET "http://localhost:8000/api/media/search/?q=batman&type=movie"

# Advanced search with filters
curl -X GET "http://localhost:8000/api/media/search/?q=genre:action&year_min=2020&limit=50"
```

### GraphQL Search
```graphql
query SearchMedia($query: String!, $filters: MediaFilter) {
  searchMedia(query: $query, filters: $filters) {
    results {
      id
      title
      type
      year
      thumbnail
    }
    totalCount
    facets {
      genre {
        name
        count
      }
      year {
        name
        count
      }
    }
  }
}
```

## Integration with External Search

### Global Search
Search across:

- **Local MediaNest library**
- **Connected Plex servers**
- **Cloud storage providers**
- **External databases**

### Search Providers
Configure additional search sources:

1. **IMDb** - Movie and TV show information
2. **TMDb** - The Movie Database
3. **MusicBrainz** - Music metadata
4. **Google Drive** - Cloud files
5. **Dropbox** - Cloud storage

## Troubleshooting Search

### Common Issues

**Slow Search Performance**:
- Check database indexes
- Reduce search scope
- Use more specific queries
- Consider search result limits

**Missing Results**:
- Verify file indexing
- Check search permissions
- Review filter settings
- Refresh metadata index

**Search Errors**:
```bash
# Rebuild search index
python manage.py rebuild_index

# Update search statistics
python manage.py update_index
```

### Maintenance Commands

```bash
# Reindex all media files
python manage.py reindex_media

# Clear search cache
python manage.py clear_search_cache

# Optimize search database
python manage.py optimize_search_db
```

## Best Practices

1. **Start broad, then narrow**:
   - Begin with general terms
   - Add filters progressively
   - Use faceted search results

2. **Use field-specific searches**:
   - More accurate results
   - Better performance
   - Clearer intent

3. **Save frequent searches**:
   - Quick access to common queries
   - Share team searches
   - Set up alerts

4. **Learn the syntax**:
   - Master advanced operators
   - Use keyboard shortcuts
   - Practice complex queries

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Focus search bar |
| `Enter` | Execute search |
| `Ctrl/Cmd + Enter` | Save current search |
| `Escape` | Clear search |
| `Ctrl/Cmd + F` | Advanced search |
| `Tab` | Navigate filters |
| `Ctrl/Cmd + A` | Select all results |
| `Space` | Preview selected item |

## Next Steps

- [Collections](collections.md) - Organize search results into collections
- [Metadata Management](metadata.md) - Improve searchability with better metadata
- [API Reference](../api/search.md) - Integrate search into custom applications
- [Advanced Configuration](../installation/configuration.md) - Tune search performance