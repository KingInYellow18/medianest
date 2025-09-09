# Getting Started with MediaNest

**Welcome to MediaNest!** This guide will help you set up and start using MediaNest for your media management needs.

## What is MediaNest?

MediaNest is a comprehensive media management platform that integrates with your Plex Media Server to provide:

- **Unified Media Discovery**: Search across multiple sources
- **Request Management**: Submit and track media requests
- **Plex Integration**: Seamless connection with your Plex library
- **Real-time Updates**: Live notifications and status updates
- **User Management**: Multi-user support with role-based access

## Quick Start Guide

### Step 1: Access MediaNest

1. Open your web browser
2. Navigate to your MediaNest instance (e.g., `https://medianest.yourdomain.com`)
3. You'll see the MediaNest login page

### Step 2: Authenticate with Plex

MediaNest uses Plex OAuth for secure authentication:

1. Click **"Sign in with Plex"**
2. A Plex PIN will be generated automatically
3. You'll be redirected to `plex.tv/link` (or see a QR code)
4. Enter the 4-digit PIN on the Plex website
5. Click **"Allow"** to authorize MediaNest
6. You'll be redirected back to MediaNest and logged in

!!! tip "Authentication Tips"
    - The PIN expires after 15 minutes
    - Make sure you're logged into the correct Plex account
    - If you have multiple Plex accounts, choose the one with access to your media server

### Step 3: Explore the Dashboard

After logging in, you'll see the main dashboard with:

- **Quick Stats**: Your request summary and recent activity
- **Service Status**: Health of integrated services
- **Recent Requests**: Your latest media requests
- **System Notifications**: Important updates

### Step 4: Search for Media

1. Click on **"Search"** in the navigation menu
2. Enter the name of a movie or TV show
3. Browse the search results
4. Click on any item to see detailed information

### Step 5: Request Media

To request new media that's not in your Plex library:

1. Search for the media you want
2. Click on the media item
3. Click **"Request"** button
4. For TV shows, select which seasons you want
5. Click **"Submit Request"**
6. Track your request in the **"My Requests"** section

## Interface Overview

### Navigation Menu

- **Dashboard**: Overview of your activity and system status
- **Search**: Discover and search for media
- **My Requests**: View and manage your media requests
- **Profile**: Manage your account settings
- **Admin** (if admin): Administrative functions

### Dashboard Components

#### Quick Stats Card
- Total Requests: Number of requests you've submitted
- Pending: Requests waiting for approval
- Approved: Requests approved for download
- Completed: Requests available in Plex

#### Service Status Card
- Shows health of all integrated services
- Green: Service is online and healthy
- Yellow: Service is degraded
- Red: Service is offline or error

#### Recent Activity
- Timeline of your recent actions
- Request submissions and status changes
- System notifications

### Search Interface

#### Search Bar
- Type at least 3 characters to search
- Searches across movies and TV shows
- Results update as you type

#### Search Results
Each result shows:
- **Poster Image**: Movie/show artwork
- **Title and Year**: Media title and release year
- **Overview**: Brief description
- **Status Indicators**:
  - ✅ **In Plex**: Already available in your library
  - 📥 **Requested**: You've already requested this
  - ⬇️ **Available**: Can be requested

#### Media Details Page
- **Complete Information**: Cast, crew, ratings, genres
- **Request Button**: Submit request for media
- **Plex Status**: Availability in your library
- **Related Media**: Similar movies/shows

### Request Management

#### Request Status Types
- **Pending**: Request submitted, waiting for admin approval
- **Approved**: Admin approved, download may be in progress
- **Completed**: Media is available in Plex
- **Rejected**: Request was denied (with reason)

#### Request Actions
- **View Details**: See request information and history
- **Cancel**: Cancel pending requests (only pending requests)
- **Re-request**: Submit again if previously rejected

## User Settings

### Profile Settings

Access your profile by clicking your username in the top right:

#### Account Information
- **Username**: Your Plex username (read-only)
- **Email**: Your Plex email address (read-only)
- **Role**: Your access level (user/admin)
- **Member Since**: When you first joined MediaNest

#### Notification Preferences
- **Email Notifications**: Get email updates for request status
- **Browser Notifications**: Real-time browser notifications
- **Weekly Summary**: Receive weekly activity summary

#### Privacy Settings
- **Activity Visibility**: Control if other users can see your activity
- **Request History**: Manage visibility of your request history

## Features in Detail

### Media Search

#### Search Tips
- Use specific titles for better results
- Try alternative titles or original language names
- Use year to narrow down results (e.g., "Inception 2010")
- Search works for movies and TV shows

#### Search Filters
- **Media Type**: Filter by movies or TV shows
- **Year Range**: Search within specific years
- **Genre**: Filter by genre categories
- **Availability**: Show only available or unavailable media

### Request System

#### TV Show Requests
When requesting TV shows:
1. Select specific seasons you want
2. Choose "All Seasons" for complete series
3. Add seasons later if new ones are released

#### Request Notifications
You'll be notified when:
- Your request is approved by an admin
- Download starts and progress updates
- Media becomes available in Plex
- Request is rejected (with reason)

### Real-time Updates

MediaNest provides live updates without page refresh:
- Request status changes
- New media availability
- System maintenance notifications
- Service status updates

## Mobile Experience

MediaNest is fully responsive and works great on mobile devices:

### Mobile Features
- **Touch-optimized Interface**: Easy navigation on phones/tablets
- **Responsive Design**: Adapts to any screen size
- **Mobile Search**: Quick search with touch-friendly results
- **Push Notifications**: Get updates on your mobile device

### Mobile Tips
- Add MediaNest to your home screen for app-like experience
- Enable browser notifications for real-time updates
- Use landscape mode for better media browsing

## Keyboard Shortcuts

Speed up your workflow with keyboard shortcuts:

| Shortcut | Action |
|----------|--------|
| `/` | Focus search bar |
| `Ctrl + K` | Quick search |
| `Esc` | Close modals/dialogs |
| `Enter` | Submit forms |
| `Tab` | Navigate between form fields |

## Troubleshooting Common Issues

### Authentication Problems

**Problem**: Can't log in with Plex
**Solutions**:
1. Make sure you're using the correct Plex account
2. Check if your Plex account has access to the media server
3. Try clearing browser cookies and cache
4. Disable browser extensions that might block authentication

**Problem**: PIN expired during authentication
**Solutions**:
1. Generate a new PIN by refreshing the login page
2. Complete the authorization process more quickly
3. Check if your browser is blocking popups

### Search Issues

**Problem**: No search results
**Solutions**:
1. Try different search terms or spellings
2. Search with just the main title (without year or extra words)
3. Check if the media exists on TMDB (The Movie Database)

**Problem**: Can't find specific media
**Solutions**:
1. Try searching with the original language title
2. Use alternative titles or abbreviations
3. Search by year if you know it

### Request Problems

**Problem**: Can't submit request
**Solutions**:
1. Make sure you're logged in
2. Check if you've already requested this media
3. Verify the media isn't already in your Plex library

**Problem**: Request stuck in pending
**Solutions**:
1. Wait for admin approval (admins are notified automatically)
2. Contact your administrator if it's been pending too long
3. Check if there are any system issues affecting requests

## Getting Help

### Built-in Help
- **Tooltips**: Hover over interface elements for help
- **Status Indicators**: Check service status on dashboard
- **Error Messages**: Read error messages for specific guidance

### Contact Support
- **Admin Contact**: Reach out to your MediaNest administrator
- **Community**: Join the MediaNest Discord community
- **Documentation**: Browse the full documentation site
- **GitHub**: Report bugs or request features on GitHub

### Best Practices

1. **Search Before Requesting**: Check if media is already available
2. **Be Specific**: Use exact titles when possible
3. **Check Your Requests**: Monitor request status regularly
4. **Respect Guidelines**: Follow any rules set by your administrator
5. **Report Issues**: Let administrators know about problems

## What's Next?

Now that you're set up with MediaNest:

1. **Explore**: Browse different types of media and discover new content
2. **Request**: Submit requests for movies and shows you want to watch
3. **Customize**: Adjust your notification and privacy settings
4. **Engage**: Join the community and share recommendations

### Advanced Features

As you become more comfortable with MediaNest, explore:
- **Advanced Search**: Use filters and sorting options
- **Request History**: Track your requesting patterns
- **Watchlists**: Create and manage media watchlists (if enabled)
- **Recommendations**: Get personalized media suggestions

Welcome to MediaNest! We hope you enjoy managing your media collection with ease and efficiency.

---

**Need more help?** Check out our [User Guides](/user-guides/) or contact your administrator.

**Last Updated:** January 15, 2025  
**Version:** 1.0.0