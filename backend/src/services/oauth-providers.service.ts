import axios from 'axios';
import crypto from 'crypto';
import { UserRepository } from '../repositories/user.repository';
import { SessionTokenRepository } from '../repositories/session-token.repository';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { generateToken } from '../utils/jwt';
import { generateSecureToken, logSecurityEvent } from '../utils/security';

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
}

interface OAuthState {
  state: string;
  provider: 'github' | 'google';
  redirectUri: string;
  createdAt: Date;
  ipAddress: string;
  userAgent: string;
}

interface OAuthUserInfo {
  id: string;
  email: string;
  name?: string;
  username?: string;
  avatar?: string;
  verified: boolean;
}

interface OAuthResult {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    avatar?: string;
  };
  token: string;
  isNewUser: boolean;
  provider: string;
}

export class OAuthProvidersService {
  private userRepository: UserRepository;
  private sessionTokenRepository: SessionTokenRepository;
  
  // In-memory storage for OAuth states - use Redis in production
  private oauthStates: Map<string, OAuthState> = new Map();
  
  private configs: Record<string, OAuthConfig>;

  constructor(
    userRepository: UserRepository,
    sessionTokenRepository: SessionTokenRepository
  ) {
    this.userRepository = userRepository;
    this.sessionTokenRepository = sessionTokenRepository;
    
    this.configs = {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        redirectUri: process.env.GITHUB_REDIRECT_URI || `${process.env.BACKEND_URL}/api/auth/oauth/github/callback`,
        scope: 'user:email'
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.BACKEND_URL}/api/auth/oauth/google/callback`,
        scope: 'openid profile email'
      }
    };

    // Cleanup expired states every hour
    setInterval(() => this.cleanupExpiredStates(), 60 * 60 * 1000);
  }

  /**
   * Generate OAuth authorization URL
   */
  async generateAuthUrl(
    provider: 'github' | 'google',
    options: {
      redirectUri?: string;
      ipAddress: string;
      userAgent: string;
    }
  ): Promise<{ authUrl: string; state: string }> {
    const config = this.configs[provider];
    if (!config.clientId || !config.clientSecret) {
      throw new AppError(
        `${provider} OAuth not configured`,
        500,
        'OAUTH_NOT_CONFIGURED'
      );
    }

    // Generate secure state parameter
    const state = generateSecureToken(32);
    const redirectUri = options.redirectUri || config.redirectUri;

    // Store state for verification
    this.oauthStates.set(state, {
      state,
      provider,
      redirectUri,
      createdAt: new Date(),
      ipAddress: options.ipAddress,
      userAgent: options.userAgent
    });

    let authUrl: string;

    switch (provider) {
      case 'github':
        authUrl = this.generateGitHubAuthUrl(state, redirectUri, config);
        break;
      case 'google':
        authUrl = this.generateGoogleAuthUrl(state, redirectUri, config);
        break;
      default:
        throw new AppError('Unsupported OAuth provider', 400, 'UNSUPPORTED_PROVIDER');
    }

    logSecurityEvent('OAUTH_AUTH_INITIATED', {
      provider,
      state,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent
    }, 'info');

    return { authUrl, state };
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(
    provider: 'github' | 'google',
    code: string,
    state: string,
    options: {
      ipAddress: string;
      userAgent: string;
    }
  ): Promise<OAuthResult> {
    // Verify state parameter
    const stateData = this.oauthStates.get(state);
    if (!stateData) {
      logSecurityEvent('OAUTH_INVALID_STATE', {
        provider,
        state,
        ipAddress: options.ipAddress
      }, 'error');
      throw new AppError('Invalid OAuth state', 400, 'INVALID_OAUTH_STATE');
    }

    // Check state expiration (10 minutes)
    if (Date.now() - stateData.createdAt.getTime() > 10 * 60 * 1000) {
      this.oauthStates.delete(state);
      throw new AppError('OAuth state expired', 400, 'EXPIRED_OAUTH_STATE');
    }

    // Verify provider matches
    if (stateData.provider !== provider) {
      throw new AppError('OAuth provider mismatch', 400, 'PROVIDER_MISMATCH');
    }

    try {
      // Exchange code for access token
      const accessToken = await this.exchangeCodeForToken(provider, code, stateData.redirectUri);
      
      // Get user information
      const userInfo = await this.getUserInfo(provider, accessToken);
      
      // Find or create user
      const result = await this.findOrCreateUser(provider, userInfo, options);
      
      // Clean up state
      this.oauthStates.delete(state);
      
      logSecurityEvent('OAUTH_LOGIN_SUCCESS', {
        provider,
        userId: result.user.id,
        email: result.user.email,
        isNewUser: result.isNewUser,
        ipAddress: options.ipAddress
      }, 'info');

      return result;

    } catch (error) {
      // Clean up state on error
      this.oauthStates.delete(state);
      
      logSecurityEvent('OAUTH_LOGIN_FAILED', {
        provider,
        state,
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: options.ipAddress
      }, 'error');

      if (error instanceof AppError) {
        throw error;
      }
      
      logger.error('OAuth callback error', {
        provider,
        error,
        ipAddress: options.ipAddress
      });
      
      throw new AppError('OAuth authentication failed', 500, 'OAUTH_FAILED');
    }
  }

  /**
   * Generate GitHub authorization URL
   */
  private generateGitHubAuthUrl(state: string, redirectUri: string, config: OAuthConfig): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: config.scope,
      state,
      allow_signup: 'true'
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Generate Google authorization URL
   */
  private generateGoogleAuthUrl(state: string, redirectUri: string, config: OAuthConfig): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.scope,
      state,
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(
    provider: 'github' | 'google',
    code: string,
    redirectUri: string
  ): Promise<string> {
    const config = this.configs[provider];
    
    switch (provider) {
      case 'github':
        return this.exchangeGitHubCode(code, redirectUri, config);
      case 'google':
        return this.exchangeGoogleCode(code, redirectUri, config);
      default:
        throw new AppError('Unsupported provider for token exchange', 400, 'UNSUPPORTED_PROVIDER');
    }
  }

  /**
   * Exchange GitHub authorization code
   */
  private async exchangeGitHubCode(code: string, redirectUri: string, config: OAuthConfig): Promise<string> {
    const response = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri
    }, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MediaNest-OAuth'
      }
    });

    if (response.data.error) {
      throw new AppError(`GitHub OAuth error: ${response.data.error_description}`, 400, 'GITHUB_OAUTH_ERROR');
    }

    return response.data.access_token;
  }

  /**
   * Exchange Google authorization code
   */
  private async exchangeGoogleCode(code: string, redirectUri: string, config: OAuthConfig): Promise<string> {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.data.error) {
      throw new AppError(`Google OAuth error: ${response.data.error_description}`, 400, 'GOOGLE_OAUTH_ERROR');
    }

    return response.data.access_token;
  }

  /**
   * Get user information from OAuth provider
   */
  private async getUserInfo(provider: 'github' | 'google', accessToken: string): Promise<OAuthUserInfo> {
    switch (provider) {
      case 'github':
        return this.getGitHubUserInfo(accessToken);
      case 'google':
        return this.getGoogleUserInfo(accessToken);
      default:
        throw new AppError('Unsupported provider for user info', 400, 'UNSUPPORTED_PROVIDER');
    }
  }

  /**
   * Get GitHub user information
   */
  private async getGitHubUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const [userResponse, emailsResponse] = await Promise.all([
      axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'MediaNest-OAuth'
        }
      }),
      axios.get('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'MediaNest-OAuth'
        }
      })
    ]);

    const user = userResponse.data;
    const emails = emailsResponse.data;
    
    // Find primary email
    const primaryEmail = emails.find((email: any) => email.primary) || emails[0];
    
    if (!primaryEmail) {
      throw new AppError('No email address found for GitHub account', 400, 'NO_EMAIL_FOUND');
    }

    return {
      id: user.id.toString(),
      email: primaryEmail.email,
      name: user.name,
      username: user.login,
      avatar: user.avatar_url,
      verified: primaryEmail.verified
    };
  }

  /**
   * Get Google user information
   */
  private async getGoogleUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const user = response.data;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.email.split('@')[0], // Use email prefix as username
      avatar: user.picture,
      verified: user.verified_email
    };
  }

  /**
   * Find or create user from OAuth information
   */
  private async findOrCreateUser(
    provider: 'github' | 'google',
    userInfo: OAuthUserInfo,
    options: {
      ipAddress: string;
      userAgent: string;
    }
  ): Promise<OAuthResult> {
    // Check if user exists by email
    let user = await this.userRepository.findByEmail(userInfo.email);
    let isNewUser = false;

    if (!user) {
      // Create new user
      user = await this.userRepository.create({
        email: userInfo.email,
        name: userInfo.name || null,
        role: 'user',
        status: 'active',
        emailVerified: userInfo.verified,
        avatar: userInfo.avatar,
        [`${provider}Id`]: userInfo.id,
        [`${provider}Username`]: userInfo.username
      });
      
      isNewUser = true;
      
      logSecurityEvent('OAUTH_USER_CREATED', {
        userId: user.id,
        email: user.email,
        provider,
        ipAddress: options.ipAddress
      }, 'info');
    } else {
      // Update existing user with OAuth information
      await this.userRepository.update(user.id, {
        [`${provider}Id`]: userInfo.id,
        [`${provider}Username`]: userInfo.username,
        avatar: userInfo.avatar || user.avatar,
        lastLoginAt: new Date()
      });
      
      // Refresh user data
      user = await this.userRepository.findById(user.id);
      if (!user) {
        throw new AppError('User not found after update', 500, 'USER_UPDATE_FAILED');
      }
    }

    // Generate JWT token
    const token = generateToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        [`${provider}Id`]: userInfo.id
      },
      false,
      {
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      }
    );

    // Create session token
    await this.sessionTokenRepository.create({
      userId: user.id,
      hashedToken: token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      deviceId: crypto.createHash('sha256').update(options.userAgent + options.ipAddress).digest('hex').substring(0, 16)
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar
      },
      token,
      isNewUser,
      provider
    };
  }

  /**
   * Unlink OAuth provider from user account
   */
  async unlinkProvider(
    userId: string,
    provider: 'github' | 'google'
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check if user has password or another OAuth method
    if (!user.passwordHash && !user.plexId) {
      const otherProvider = provider === 'github' ? 'google' : 'github';
      const hasOtherProvider = user[`${otherProvider}Id` as keyof typeof user];
      
      if (!hasOtherProvider) {
        throw new AppError(
          'Cannot unlink last authentication method. Please set a password first.',
          400,
          'LAST_AUTH_METHOD'
        );
      }
    }

    // Remove OAuth provider data
    await this.userRepository.update(userId, {
      [`${provider}Id`]: null,
      [`${provider}Username`]: null
    });

    logSecurityEvent('OAUTH_PROVIDER_UNLINKED', {
      userId,
      provider
    }, 'info');
  }

  /**
   * Get OAuth connection status for user
   */
  async getConnectionStatus(userId: string): Promise<{
    github: boolean;
    google: boolean;
    plex: boolean;
    hasPassword: boolean;
  }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return {
      github: !!user.githubId,
      google: !!user.googleId,
      plex: !!user.plexId,
      hasPassword: !!user.passwordHash
    };
  }

  /**
   * Clean up expired OAuth states
   */
  private cleanupExpiredStates(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [state, stateData] of this.oauthStates.entries()) {
      if (now - stateData.createdAt.getTime() > 10 * 60 * 1000) { // 10 minutes
        this.oauthStates.delete(state);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up expired OAuth states', { count: cleaned });
    }
  }

  /**
   * Get OAuth statistics
   */
  async getStatistics(): Promise<{
    activeStates: number;
    totalUsers: {
      github: number;
      google: number;
      plex: number;
    };
  }> {
    // Clean up first
    this.cleanupExpiredStates();

    const users = await this.userRepository.findAll();
    
    return {
      activeStates: this.oauthStates.size,
      totalUsers: {
        github: users.filter(u => u.githubId).length,
        google: users.filter(u => u.googleId).length,
        plex: users.filter(u => u.plexId).length
      }
    };
  }
}