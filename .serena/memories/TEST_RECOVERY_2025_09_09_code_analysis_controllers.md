# MediaNest Controller API Analysis - Test Recovery

## Current Controller Structure

### 1. AuthController (`backend/src/controllers/auth.controller.ts`)
**Methods:**
- `generatePin()` - Generates Plex authentication PIN
- `verifyPin()` - Verifies PIN and creates/authenticates users
- `logout()` - Handles user logout
- `getSession()` - Returns current session info

**Key Dependencies:**
- Uses axios for Plex API communication
- Implements JWT token generation
- Handles cookie-based authentication
- Uses encryption service for token storage

### 2. MediaController (`backend/src/controllers/media.controller.ts`)
**Methods:**
- `searchMedia()` - Search for media content
- `requestMedia()` - Request media download
- `getUserRequests()` - Get user's media requests
- `getRequestDetails()` - Get specific request details
- `deleteRequest()` - Delete media request
- `getAllRequests()` - Admin function to get all requests
- `getMediaDetails()` - Get details for specific media

### 3. DashboardController (`backend/src/controllers/dashboard.controller.ts`)
**Methods:**
- `getServiceStatuses()` - Get status of all services
- `getServiceStatus()` - Get single service status
- `getDashboardStats()` - Get dashboard statistics
- `getNotifications()` - Get user notifications

### 4. AdminController (`backend/src/controllers/admin.controller.ts`)
**Methods:**
- `getUsers()` - List all users
- `getServices()` - Get service configurations
- `updateUserRole()` - Change user role
- `deleteUser()` - Remove user
- `getSystemStats()` - System performance metrics

### 5. PlexController (`backend/src/controllers/plex.controller.ts`)
**Methods:**
- `getServerInfo()` - Plex server information
- `getLibraries()` - List Plex libraries
- `getLibraryItems()` - Get items from library
- `search()` - Search Plex content
- `getRecentlyAdded()` - Recently added content
- `getCollections()` - Plex collections
- `getCollectionDetails()` - Collection details

### 6. HealthController (`backend/src/controllers/health.controller.ts`)
**Methods:**
- `getHealth()` - Basic health check
- `getMetrics()` - System metrics
- `formatUptime()` - Format system uptime
- `getEventLoopDelay()` - Node.js event loop metrics

## Current Route Structure

### Authentication Routes (`/api/v1/auth`)
- `POST /plex/pin` - Generate authentication PIN
- `POST /plex/pin/verify` - Verify PIN and login
- `POST /logout` - Logout user
- `GET /session` - Get current session

### Media Routes (`/api/v1/media`)
- Routes mapped to MediaController methods
- Protected routes requiring authentication

## Test Issues Identified

### 1. Mock Structure Mismatches
Tests expect specific mock patterns that may not align with current implementation:
- `userRepository.findByPlexId`
- `encryptionService.encryptForStorage` 
- Mock axios responses with XML parsing

### 2. Interface Changes
Controllers may have evolved beyond test expectations:
- Response format changes
- Error handling modifications
- Authentication flow updates

### 3. Missing Test Coverage
New controller methods and endpoints lack corresponding tests.