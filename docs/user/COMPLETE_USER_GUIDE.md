# MediaNest Complete User Guide

**Version**: 2.0  
**Target Audience**: End Users  
**Last Updated**: September 8, 2025

## 🎬 Welcome to MediaNest

MediaNest is your unified media management platform that seamlessly integrates with Plex and YouTube, providing a single interface to discover, search, and manage your entertainment content.

## 🚀 Getting Started

### System Requirements

- **Web Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Internet Connection**: Stable broadband connection
- **Plex Account**: Active Plex account with server access
- **Optional**: YouTube account for enhanced features

### First-Time Setup

#### Step 1: Access MediaNest

1. Navigate to your MediaNest instance (e.g., `https://medianest.yourdomain.com`)
2. You'll be greeted with the login screen
3. Click **"Sign in with Plex"** to begin authentication

#### Step 2: Plex Authentication

1. Click **"Get PIN"** to generate a Plex authentication PIN
2. A new window will open to Plex's authentication page
3. If not already logged in, enter your Plex credentials
4. Click **"Authorize"** to grant MediaNest access to your account
5. Return to MediaNest and enter the 4-digit PIN
6. Click **"Authenticate"** to complete the process

#### Step 3: Initial Configuration

1. **Server Selection**: Choose your primary Plex server from the dropdown
2. **Library Permissions**: Grant access to desired libraries (Movies, TV Shows, Music)
3. **YouTube Integration**: Optionally connect your YouTube account for enhanced search
4. **Preferences**: Set your default search preferences and display options

## 🏠 Dashboard Overview

### Main Dashboard

The dashboard is your command center, providing an at-a-glance view of your media ecosystem:

```
┌─────────────────────────────────────────────────────────────┐
│  MediaNest Dashboard                                        │
├─────────────────────────────────────────────────────────────┤
│  📊 Library Statistics          🔍 Quick Search             │
│  • Movies: 1,247               ┌─────────────────────────┐   │
│  • TV Shows: 89                │ Search all media...     │   │
│  • Episodes: 3,421             └─────────────────────────┘   │
│  • Total Size: 12.4 TB                                     │
│                                                             │
│  🎬 Recently Added             ⭐ Recommended                │
│  [Movie thumbnails...]          [Curated suggestions...]    │
│                                                             │
│  📈 Viewing Activity           🔥 Trending                  │
│  [Activity graphs...]          [Popular content...]         │
└─────────────────────────────────────────────────────────────┘
```

### Navigation Menu

- **🏠 Dashboard**: Main overview and statistics
- **🔍 Search**: Advanced search across all platforms
- **🎬 Movies**: Browse and manage movie library
- **📺 TV Shows**: Browse and manage TV show library
- **🎵 Music**: Browse and manage music library
- **⚙️ Settings**: Account and preference management
- **❓ Help**: Documentation and support resources

## 🔍 Search Functionality

### Universal Search

MediaNest's powerful search engine queries across all your connected platforms simultaneously.

#### Basic Search

1. Click on the search bar in the dashboard or navigation
2. Type your search query (movie title, actor, genre, etc.)
3. Press Enter or click the search icon
4. Results appear grouped by source (Plex, YouTube)

#### Advanced Search

Access advanced search through the **Search** page:

1. **Filters Available**:

   - **Media Type**: Movies, TV Shows, Episodes, Music, Videos
   - **Source**: Plex Libraries, YouTube
   - **Genre**: Action, Comedy, Drama, Horror, etc.
   - **Year Range**: From/To year selection
   - **Rating**: Minimum rating threshold
   - **Quality**: SD, HD, 4K resolution filters

2. **Search Tips**:
   - Use quotes for exact phrases: `"The Dark Knight"`
   - Combine terms: `Marvel action 2020`
   - Use wildcards: `Star Wars*`
   - Filter by actor: `actor:"Robert Downey Jr"`

#### Search Results

Results are displayed in a card-based layout:

```
┌─────────────────────────────────────────────────────────────┐
│  Search Results for "Avengers"                             │
├─────────────────────────────────────────────────────────────┤
│  📊 Found 24 results across all sources                    │
│                                                             │
│  🎬 MOVIES (12)                                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │[Poster] │ │[Poster] │ │[Poster] │ │[Poster] │          │
│  │Avengers │ │Avengers │ │Avengers │ │Avengers │          │
│  │(2012)   │ │Age of   │ │Infinity │ │Endgame  │          │
│  │⭐ 8.0   │ │Ultron   │ │War      │ │(2019)   │          │
│  │📁 Plex  │ │⭐ 7.3   │ │⭐ 8.4   │ │⭐ 8.4   │          │
│  └─────────┘ │📁 Plex  │ │📁 Plex  │ │📁 Plex  │          │
│              └─────────┘ └─────────┘ └─────────┘          │
│                                                             │
│  📺 TV SHOWS (3)                                           │
│  [Similar card layout...]                                  │
│                                                             │
│  🎥 YOUTUBE VIDEOS (9)                                     │
│  [Video thumbnails with duration and view counts...]       │
└─────────────────────────────────────────────────────────────┘
```

## 🎬 Media Management

### Movie Library

Access your movie collection through the **Movies** section:

#### Browsing Movies

1. **View Options**:

   - Grid View: Poster thumbnails in a grid
   - List View: Detailed list with metadata
   - Cover Flow: Apple-style browsing experience

2. **Sorting Options**:

   - Recently Added
   - Alphabetical (A-Z, Z-A)
   - Release Year
   - IMDb Rating
   - File Size
   - Duration

3. **Filtering**:
   - Genre selection
   - Year ranges
   - Quality filters
   - Watch status

#### Movie Details

Click on any movie to view detailed information:

```
┌─────────────────────────────────────────────────────────────┐
│  The Dark Knight (2008)                                    │
├─────────────────────────────────────────────────────────────┤
│  [Large Poster] │ ⭐ 9.0/10 IMDb                            │
│                 │ 🕐 152 minutes                            │
│                 │ 🏷️ Action, Crime, Drama                   │
│                 │ 📅 July 18, 2008                         │
│                 │ 🎬 Christopher Nolan                      │
│                 │                                           │
│                 │ 📝 Synopsis:                              │
│                 │ When the menace known as the Joker...    │
│                 │                                           │
│                 │ 👥 Cast:                                  │
│                 │ Christian Bale, Heath Ledger...          │
│                 │                                           │
│                 │ ▶️ Play    📋 Add to Playlist            │
│                 │ ⭐ Rate    💾 Download Info               │
└─────────────────────────────────────────────────────────────┘
```

### TV Show Library

Manage your TV show collection:

#### Show Organization

1. **Seasons View**: Shows organized by seasons
2. **Episode Tracking**: Track watched/unwatched episodes
3. **Progress Indicators**: Visual progress bars for show completion
4. **Next Up**: Automatically suggests next episode to watch

#### Episode Management

- **Episode Details**: Complete metadata and descriptions
- **Watch Status**: Mark as watched/unwatched
- **Continue Watching**: Resume from last position
- **Subtitle Options**: Available subtitle languages

### Music Library

If connected, manage your music collection:

#### Features

- **Artist Browser**: Browse by artist, album, or song
- **Playlist Management**: Create and manage custom playlists
- **Genre Classification**: Browse by musical genres
- **Album Art**: High-quality album artwork display

## ⚙️ Settings & Preferences

### Account Settings

Access through the **Settings** menu:

#### Profile Management

1. **User Information**:

   - Display name
   - Email address
   - Avatar image
   - Plex account status

2. **Connected Services**:
   - Plex server connections
   - YouTube account integration
   - Third-party service links

#### Privacy Settings

1. **Data Sharing**:

   - Anonymous usage statistics
   - Error reporting preferences
   - Marketing communications

2. **Viewing History**:
   - Enable/disable watch tracking
   - Clear viewing history
   - Export personal data

### Display Preferences

#### Interface Options

1. **Theme Selection**:

   - Light theme
   - Dark theme (default)
   - Auto (system preference)
   - Custom theme colors

2. **Layout Options**:
   - Grid density (comfortable, compact, cozy)
   - Thumbnail size preferences
   - Information display level

#### Content Preferences

1. **Default Filters**:

   - Preferred quality settings
   - Language preferences
   - Content rating restrictions

2. **Search Settings**:
   - Default search sources
   - Auto-complete suggestions
   - Search history retention

### Server Management

Configure your Plex server connections:

#### Server Configuration

1. **Primary Server**: Select your main Plex server
2. **Additional Servers**: Add secondary servers
3. **Library Selection**: Choose which libraries to include
4. **Sync Settings**: Configure automatic library updates

#### Connection Settings

1. **Connection Type**: Local vs Remote access preferences
2. **Quality Settings**: Streaming quality preferences
3. **Bandwidth Limits**: Set streaming bandwidth limits
4. **Offline Access**: Configure offline content settings

## 🔧 Advanced Features

### Playlists & Collections

Create custom media collections:

#### Creating Playlists

1. Click **"Create Playlist"** from any media page
2. Add title and description
3. Drag and drop media items to add
4. Set playlist visibility (private/public)
5. Save and share with other users

#### Smart Collections

Create dynamic collections based on criteria:

- **Genre Collections**: Automatically group by genre
- **Year Collections**: Movies/shows from specific years
- **Rating Collections**: Highly-rated content
- **Recently Added**: Latest additions to your library

### Integration Features

#### YouTube Integration

When connected to YouTube:

1. **Unified Search**: Search both Plex and YouTube simultaneously
2. **Watch Later**: Add YouTube videos to watch later queue
3. **Subscriptions**: View YouTube channel subscriptions
4. **Recommended**: Get recommendations based on viewing history

#### Plex Features

Full Plex integration includes:

1. **Remote Access**: Stream from anywhere
2. **Mobile Sync**: Download content for offline viewing
3. **User Management**: Multiple user profiles
4. **Parental Controls**: Content filtering for family accounts

### Keyboard Shortcuts

Enhance your productivity with keyboard shortcuts:

#### Global Shortcuts

- `Ctrl + K` / `Cmd + K`: Open search
- `Ctrl + H` / `Cmd + H`: Go to dashboard
- `Ctrl + M` / `Cmd + M`: Movies library
- `Ctrl + T` / `Cmd + T`: TV shows library
- `Ctrl + S` / `Cmd + S`: Settings
- `Ctrl + ?` / `Cmd + ?`: Show help

#### Media Player Shortcuts

- `Space`: Play/Pause
- `←/→`: Skip 10 seconds
- `↑/↓`: Volume control
- `F`: Fullscreen
- `M`: Mute
- `Esc`: Exit fullscreen

## 🛠️ Troubleshooting

### Common Issues

#### Authentication Problems

**Issue**: Cannot log in with Plex account
**Solutions**:

1. Verify Plex account credentials on plex.tv
2. Clear browser cache and cookies
3. Try incognito/private browsing mode
4. Check if Plex services are operational
5. Contact administrator if using shared server

#### Search Not Working

**Issue**: Search returns no results
**Solutions**:

1. Check internet connection
2. Verify Plex server is online and accessible
3. Refresh library in Plex server
4. Clear browser cache
5. Try different search terms

#### Streaming Issues

**Issue**: Videos won't play or buffer constantly
**Solutions**:

1. Check internet connection speed (minimum 5 Mbps for HD)
2. Lower quality settings in player
3. Verify Plex server has sufficient bandwidth
4. Check for browser compatibility issues
5. Disable VPN if active

#### Library Not Updating

**Issue**: New content not appearing
**Solutions**:

1. Manually refresh Plex library
2. Check MediaNest sync settings
3. Verify file permissions on Plex server
4. Wait for automatic sync (occurs every hour)
5. Contact server administrator

### Performance Optimization

#### Browser Performance

1. **Recommended Browsers**: Chrome or Firefox for best performance
2. **Clear Cache**: Regularly clear browser cache
3. **Disable Extensions**: Temporarily disable browser extensions
4. **Update Browser**: Keep browser updated to latest version

#### Network Optimization

1. **Wired Connection**: Use Ethernet for stable connection
2. **Close Background Apps**: Minimize bandwidth usage
3. **Quality Settings**: Adjust streaming quality based on connection
4. **Peak Hours**: Avoid streaming during network peak hours

### Getting Help

#### Built-in Help

- **Help Section**: Access through navigation menu
- **Tooltips**: Hover over interface elements for quick tips
- **Status Indicators**: Check system status on dashboard

#### External Resources

1. **Documentation**: Complete documentation at `/docs`
2. **Community Forum**: User community discussions
3. **Support Tickets**: Contact support for technical issues
4. **Video Tutorials**: Step-by-step video guides

#### Contact Support

For technical issues that cannot be resolved:

1. **Email Support**: support@medianest.app
2. **Live Chat**: Available during business hours
3. **Issue Tracker**: Report bugs via GitHub issues
4. **Community Discord**: Real-time community help

## 📱 Mobile Experience

### Mobile Web App

MediaNest provides a responsive mobile web experience:

#### Mobile Features

1. **Touch Navigation**: Optimized touch interfaces
2. **Swipe Gestures**: Swipe to navigate and control
3. **Offline Viewing**: Download content for offline access
4. **Push Notifications**: Get notified of new content

#### Mobile-Specific Tips

1. **Add to Home Screen**: Install as PWA for app-like experience
2. **Background Playback**: Continue audio playback when switching apps
3. **Data Saver**: Enable low-bandwidth mode for mobile networks
4. **Touch Controls**: Use tap gestures for media control

## 🎯 Best Practices

### Library Organization

1. **Consistent Naming**: Use consistent file naming conventions
2. **Metadata Cleanup**: Regularly clean up media metadata
3. **Duplicate Removal**: Remove duplicate files to save space
4. **Quality Management**: Maintain consistent video quality standards

### Security Best Practices

1. **Strong Passwords**: Use strong, unique passwords
2. **Two-Factor Authentication**: Enable 2FA when available
3. **Regular Updates**: Keep software updated
4. **Secure Networks**: Avoid public WiFi for streaming
5. **Account Monitoring**: Regularly review account activity

### Performance Best Practices

1. **Regular Maintenance**: Perform regular system maintenance
2. **Storage Management**: Monitor available storage space
3. **Network Monitoring**: Keep track of network usage
4. **Quality Balance**: Balance quality with performance needs

---

**Generated by**: MediaNest SWARM User Experience Agent  
**User Tested**: Yes  
**Next Update**: October 8, 2025  
**Feedback**: userguide@medianest.app
