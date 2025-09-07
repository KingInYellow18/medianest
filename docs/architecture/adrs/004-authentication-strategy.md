# ADR-004: Authentication Strategy - Plex OAuth with JWT

## Status

Accepted

## Context

MediaNest is a Plex-centric media management portal that requires seamless integration with existing Plex infrastructure. Authentication must:

- Leverage existing Plex user accounts and permissions
- Provide secure session management
- Support both web and potential future API access
- Maintain compatibility with Plex ecosystem
- Ensure security best practices

Authentication options considered:

1. **Plex OAuth + JWT tokens**
2. **Traditional username/password with Plex integration**
3. **NextAuth.js with multiple providers**
4. **Custom authentication with Plex verification**

## Decision

We implement **Plex OAuth as the primary authentication method** with **JWT tokens** for session management, integrated through **NextAuth.js**:

**Primary Authentication Flow:**

1. User initiates login through NextAuth.js Plex provider
2. Plex OAuth flow with PIN-based authentication
3. Successful authentication returns Plex user token
4. Create/update local user record with Plex metadata
5. Generate JWT access token for API authentication
6. Store session in Redis for fast lookup

**Architecture Components:**

- **NextAuth.js 4.24.7**: OAuth provider integration and session management
- **Plex OAuth Provider**: Custom provider for Plex authentication
- **JWT Tokens**: Stateless API authentication
- **Redis Sessions**: Fast session storage and invalidation
- **Prisma User Model**: Local user data with Plex integration

## Implementation Details

### Plex OAuth Flow

```typescript
// Custom Plex OAuth Provider
const PlexProvider = {
  id: 'plex',
  name: 'Plex',
  type: 'oauth',
  authorization: {
    url: 'https://app.plex.tv/auth#',
    params: {
      clientID: process.env.PLEX_CLIENT_ID,
      forwardUrl: `${process.env.NEXTAUTH_URL}/api/auth/callback/plex`,
    },
  },
  token: 'https://plex.tv/api/v2/user',
  userinfo: 'https://plex.tv/api/v2/user',
  profile(profile) {
    return {
      id: profile.id.toString(),
      name: profile.title,
      email: profile.email,
      image: profile.thumb,
    };
  },
};
```

### JWT Token Strategy

```typescript
// JWT Configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET,
  issuer: 'medianest',
  audience: 'medianest-api',
  expiresIn: '1h', // Short-lived access tokens
  algorithm: 'HS256',
};

// Token Generation
const generateTokens = (user: User): TokenPair => {
  const accessToken = jwt.sign(
    {
      sub: user.id,
      plexId: user.plexId,
      role: user.role,
      type: 'access',
    },
    jwtConfig.secret,
    {
      expiresIn: jwtConfig.expiresIn,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    }
  );

  const refreshToken = jwt.sign(
    {
      sub: user.id,
      type: 'refresh',
    },
    jwtConfig.secret,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};
```

### Session Management

```typescript
// Redis Session Storage
class SessionManager {
  async createSession(userId: string, sessionData: SessionData): Promise<string> {
    const sessionId = generateSecureId();
    const key = `session:${sessionId}`;

    await redis.setex(
      key,
      3600,
      JSON.stringify({
        userId,
        ...sessionData,
        createdAt: new Date().toISOString(),
      })
    );

    return sessionId;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const key = `session:${sessionId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async invalidateSession(sessionId: string): Promise<void> {
    await redis.del(`session:${sessionId}`);
  }
}
```

## Consequences

### Positive

- **Seamless User Experience**: Users authenticate with existing Plex credentials
- **Security**: OAuth2 standard with secure token management
- **Plex Integration**: Direct access to Plex user data and permissions
- **Scalability**: Stateless JWT tokens for API authentication
- **Performance**: Redis-backed sessions for fast lookup
- **Compatibility**: Works with existing Plex ecosystem and apps
- **Future-Proof**: Support for additional OAuth providers if needed

### Negative

- **Dependency on Plex**: System unavailable if Plex authentication is down
- **Complexity**: Multiple authentication layers (OAuth + JWT + Sessions)
- **Token Management**: Need to handle token refresh and expiration
- **User Management**: Syncing local user data with Plex changes

### Security Measures

- **Token Security**: Short-lived access tokens with refresh rotation
- **Session Security**: Secure session storage with TTL
- **CSRF Protection**: SameSite cookies and CSRF tokens
- **XSS Protection**: HTTPOnly cookies for sensitive data
- **Rate Limiting**: Authentication endpoint protection
- **Audit Trail**: Authentication events logging

### Migration Considerations

```typescript
// User Data Synchronization
class UserSyncService {
  async syncPlexUser(plexToken: string): Promise<User> {
    const plexUser = await this.plexClient.getUser(plexToken);

    const existingUser = await this.userRepository.findByPlexId(plexUser.id);

    if (existingUser) {
      // Update existing user data
      return await this.userRepository.update(existingUser.id, {
        plexUsername: plexUser.username,
        plexToken: plexToken,
        lastLoginAt: new Date(),
      });
    } else {
      // Create new user
      return await this.userRepository.create({
        plexId: plexUser.id,
        plexUsername: plexUser.username,
        email: plexUser.email,
        name: plexUser.title,
        plexToken: plexToken,
      });
    }
  }
}
```

### Future Considerations

- **Multi-Provider Support**: Ability to add additional OAuth providers
- **2FA Integration**: TOTP support for enhanced security (already implemented)
- **API Key Authentication**: Service-to-service authentication
- **SSO Integration**: Enterprise SSO provider support
- **Mobile App Support**: OAuth flow adaptation for mobile clients

This authentication strategy provides a secure, user-friendly, and Plex-integrated authentication system while maintaining flexibility for future enhancements.
