# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MediaNest is a unified web portal for managing a Plex media server and related services. It consolidates multiple tools (Overseerr, Uptime Kuma, YouTube downloaders, etc.) into a single authenticated interface for friends and family who access the Plex server.

## Key Project Goals

1. **Single Sign-On**: One login for all media-related services
2. **Service Integration**: Combines Overseerr (media requests), Uptime Kuma (status monitoring), YouTube playlist management, and Plex library browsing
3. **User-Friendly**: Designed for 10-20 casual users who just want to watch and manage media easily
4. **Admin Controls**: Separate admin capabilities for user management and configuration

## Core Features to Implement

### User Features
- Single authentication system
- Dashboard with service status (Uptime Kuma integration)
- Browse existing Plex media library
- Request new movies/shows through Overseerr integration
- YouTube playlist management and downloads
- Create/update Plex collections in "YouTube" library
- User guide and documentation access
- Quick links to other services (Audiobookshelf, Calibre-web)

### Admin Features
- User management (create, modify, delete accounts)
- System configuration settings
- Service monitoring and management

## Technical Architecture Considerations

### Authentication & Security
- Implement secure user authentication with hashed passwords
- Role-based access control (regular users vs. admins)
- All features require authentication
- Never expose user credentials or allow anonymous access

### Integrations Required
- **Plex API**: Library browsing, collection management
- **Overseerr API**: Media request submission and status tracking
- **Uptime Kuma API**: Service health monitoring
- **YouTube Download**: Playlist processing and file management

### Data Models
- Users (username, email, hashed password, role)
- Media Requests (title, type, status, requester, date)
- YouTube Downloads (playlist URL, file names, status)
- Service Status (from Uptime Kuma)
- Documentation/Links

## Development Commands

Since this is a new project, commands will be established as the technology stack is chosen. Future instances should check for:
- Build commands (e.g., `npm run build`, `python setup.py`)
- Development server (e.g., `npm run dev`, `flask run`)
- Test commands (e.g., `npm test`, `pytest`)
- Linting (e.g., `npm run lint`, `flake8`)
- Type checking (e.g., `npm run typecheck`, `mypy`)

## UI/UX Guidelines

- Modern, minimalist design similar to Overseerr and Plex
- Responsive web interface (mobile-friendly)
- Clear navigation and dashboard-style layout
- Prioritize clarity and ease of use for non-technical users

## Success Criteria

1. Users can sign up, log in, and request media through a unified interface
2. Dashboard displays real-time service status via Uptime Kuma
3. YouTube playlists can be downloaded and organized into Plex collections
4. All actions are properly authenticated and authorized

## Future Enhancements (Not Initial Scope)

- Push notifications for request updates
- Media analytics and viewing statistics
- Direct torrent downloader integration
- Automated transcoding and cloud backups