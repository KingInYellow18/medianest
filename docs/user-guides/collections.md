# Collections

Create and manage collections to organize your media library into themed groups, making discovery and organization more intuitive and enjoyable.

## What are Collections?

Collections in MediaNest are curated groups of media items organized around common themes, genres, series, or any criteria you define. Unlike simple folders, collections can include items from anywhere in your library and support rich metadata, artwork, and automation.

### Types of Collections

#### Smart Collections (Dynamic)
Automatically populate based on rules and criteria:
- Recently added movies
- Highly rated TV shows
- Unwatched episodes
- Movies by decade or genre

#### Manual Collections (Static)
Hand-curated collections with specific items:
- Personal favorites
- Movie marathons
- Themed playlists
- Special occasions

#### Hybrid Collections
Combine both approaches:
- Core manually selected items
- Additional automatic suggestions
- Rule-based filtering within manual selections

## Creating Collections

### Quick Collection Creation

1. **Select media items** (Ctrl+click for multiple)
2. **Right-click and choose "Add to Collection"**
3. **Create new collection or add to existing**
4. **Name and configure the collection**

### Advanced Collection Builder

Access the Collection Builder for sophisticated collections:

1. **Navigate to Collections > Create Collection**
2. **Choose collection type**:
   - Smart Collection (rule-based)
   - Manual Collection (curated)
   - Hybrid Collection (mixed approach)
3. **Configure collection properties**
4. **Set rules and criteria** (for smart collections)
5. **Add artwork and descriptions**
6. **Save and publish**

### Collection Configuration

#### Basic Properties
```yaml
name: "Marvel Cinematic Universe"
description: "Complete MCU movie collection in chronological order"
type: "hybrid"
visibility: "public"
sort_order: "release_date"
auto_update: true
```

#### Smart Collection Rules
```yaml
rules:
  - field: "genre"
    operator: "contains"
    value: "superhero"
  - field: "studio"
    operator: "equals"  
    value: "Marvel Studios"
  - field: "year"
    operator: "greater_than"
    value: 2008
```

## Smart Collection Rules

### Rule Operators

#### Text Operators
- `equals` - Exact match
- `contains` - Partial match
- `starts_with` - Beginning of text
- `ends_with` - End of text
- `regex` - Regular expression pattern

#### Numeric Operators  
- `equals` - Exact number
- `greater_than` - Larger than value
- `less_than` - Smaller than value
- `between` - Within range
- `not_equals` - Different from value

#### Date Operators
- `after` - Later than date
- `before` - Earlier than date
- `between` - Within date range
- `this_week` - Current week
- `this_month` - Current month
- `this_year` - Current year

### Example Rules

#### Genre-Based Collections
```yaml
# Horror Movies
rules:
  - field: "genre"
    operator: "contains"
    value: "horror"
  - field: "type"
    operator: "equals"
    value: "movie"

# 90s Comedies  
rules:
  - field: "genre"
    operator: "contains"
    value: "comedy"
  - field: "year"
    operator: "between"
    value: [1990, 1999]
```

#### Status-Based Collections
```yaml
# Unwatched Movies
rules:
  - field: "watched"
    operator: "equals"
    value: false
  - field: "type"
    operator: "equals"
    value: "movie"

# Recently Added
rules:
  - field: "date_added"
    operator: "after"
    value: "30 days ago"
```

#### Rating-Based Collections
```yaml
# Highly Rated Films
rules:
  - field: "imdb_rating"
    operator: "greater_than"
    value: 8.0
  - field: "user_rating"
    operator: "greater_than"
    value: 4
```

## Collection Management

### Editing Collections

#### Basic Information
- Change name and description
- Update artwork and thumbnails
- Modify visibility settings
- Adjust sort order and display options

#### Membership Management
- Add/remove specific items
- Modify smart collection rules
- Bulk operations on collection items
- Import/export collection lists

#### Collection Settings
```yaml
settings:
  auto_update: true           # Update smart collections automatically
  notification: false         # Notify on new additions
  featured: true             # Show on homepage
  sort_by: "release_date"    # Default sorting method
  view_mode: "grid"          # Display layout
  items_per_page: 50         # Pagination size
```

### Collection Organization

#### Hierarchical Collections
Create sub-collections within main collections:

```
Marvel Collections/
├── Marvel Cinematic Universe/
│   ├── Phase 1/
│   ├── Phase 2/
│   └── Phase 3/
├── Marvel TV Shows/
└── Marvel Comics Movies/
```

#### Cross-References
Collections can reference other collections:
- Related collections suggestions
- Parent-child relationships
- Tag-based connections
- Similar collection recommendations

## Collection Display and Sharing

### Viewing Options

#### Grid View
- Thumbnail grid with titles
- Customizable grid size
- Hover previews
- Bulk selection support

#### List View
- Detailed information columns
- Sortable headers
- Quick edit capabilities
- Export options

#### Card View
- Rich metadata display
- Large artwork presentation
- Extended descriptions
- Action buttons

### Sharing Collections

#### Public Collections
Make collections discoverable:
- Public collection directory
- Search and browse functionality
- Rating and review system
- Usage statistics

#### Private Collections  
Keep collections personal:
- Private visibility settings
- Access control management
- Sharing with specific users
- Collaboration features

#### Export Options
Share collections externally:
```bash
# Export collection as playlist
python manage.py export_collection "Marvel MCU" --format m3u --output mcu_playlist.m3u

# Export as JSON for backup
python manage.py export_collection "Favorites" --format json --include-metadata

# Export as CSV for spreadsheet
python manage.py export_collection "Horror Movies" --format csv --fields title,year,rating
```

## Automation and Integration

### Automated Collection Updates

#### Scheduled Updates
```yaml
schedule:
  smart_collections:
    update_interval: "daily"
    update_time: "02:00"
    batch_size: 100
    
  featured_collections:
    rotate_interval: "weekly" 
    featured_count: 5
```

#### Event-Driven Updates
- New media addition triggers
- Metadata change updates
- User activity responses
- External service synchronization

### Integration Features

#### Plex Integration
- Sync with Plex collections
- Import existing Plex playlists
- Bi-directional updates
- Maintain collection artwork

#### External Services
- Import from IMDb lists
- Sync with Letterboxd collections
- Integrate with Trakt.tv
- Connect to streaming service watchlists

### API Integration
```python
# Create collection via API
collection = {
    "name": "Oscar Winners 2023",
    "type": "smart",
    "rules": [
        {
            "field": "awards",
            "operator": "contains", 
            "value": "Oscar"
        },
        {
            "field": "year",
            "operator": "equals",
            "value": 2023
        }
    ]
}

response = requests.post(
    "http://localhost:8000/api/collections/",
    json=collection,
    headers={"Authorization": "Bearer " + token}
)
```

## Collection Analytics

### Usage Statistics

Track collection performance:
- View counts and engagement
- Most popular collections
- User interaction patterns
- Growth and retention metrics

### Recommendations Engine

Generate collection suggestions:
- Similar collections
- Collaborative filtering
- Content-based recommendations
- Trending collections

### Reporting

Generate collection reports:
```bash
# Collection usage report
python manage.py generate_report collections --period monthly

# Popular collections analysis
python manage.py analyze_collections --metric views --top 10

# Collection completion statistics  
python manage.py collection_stats --include-completion
```

## Best Practices

### Collection Strategy

#### Naming Conventions
- Use clear, descriptive names
- Include relevant keywords
- Maintain consistent formatting
- Consider searchability

#### Organization Principles
1. **Logical Grouping** - Group related content meaningfully
2. **Manageable Size** - Keep collections focused and reasonably sized
3. **Regular Maintenance** - Review and update collections periodically
4. **User Experience** - Design for discovery and engagement

### Content Curation

#### Quality Control
- Verify collection accuracy
- Remove outdated or irrelevant items
- Maintain high-quality artwork
- Update descriptions regularly

#### Engagement Features
- Add detailed descriptions
- Include interesting trivia
- Suggest viewing order
- Provide context and background

## Advanced Features

### Collection Templates

Create reusable collection templates:
```yaml
# Decade Collection Template
template:
  name: "{decade}s Movies"
  rules:
    - field: "year"
      operator: "between"  
      value: ["{start_year}", "{end_year}"]
    - field: "type"
      operator: "equals"
      value: "movie"
  artwork: "decade_{decade}.jpg"
```

### Workflow Automation

Automate collection management:
- New release monitoring
- Completion tracking
- Quality assessment
- Archive management

### Custom Collection Types

Define specialized collection types:
- Marathon collections (viewing order)
- Educational collections (documentaries)
- Seasonal collections (holiday themes)
- Mood-based collections (genres + atmosphere)

## Troubleshooting

### Common Issues

#### Smart Collections Not Updating
```bash
# Force collection refresh
python manage.py refresh_collections --collection-id 123

# Check rule validity
python manage.py validate_collection_rules --collection-id 123
```

#### Performance Issues with Large Collections
- Optimize collection rules
- Enable collection caching
- Use pagination effectively
- Consider collection splitting

#### Sync Problems
- Check external service credentials
- Verify API rate limits
- Review error logs
- Test individual collection sync

## Next Steps

- [Search and Filtering](search-filtering.md) - Find content across collections
- [Metadata Management](metadata.md) - Enhance collection organization
- [API Reference](../api/collections.md) - Programmatic collection management
- [User Sharing](sharing.md) - Collaborate on collections