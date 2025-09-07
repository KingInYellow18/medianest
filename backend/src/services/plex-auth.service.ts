// Use built-in fetch (Node.js 18+)
import { SessionTokenRepository } from '../repositories/session-token.repository';
import { UserRepository } from '../repositories/user.repository';
import { AppError } from '../utils/errors';
import { generateToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { PlexUser as PlexUserType, PlexAuthPin } from '../types/integration/external-apis.types';

export interface PlexPin {
  id: number;
  code: string;
  product: string;
  trusted: boolean;
  clientIdentifier: string;
  location: {
    code: string;
    country: string;
  };
  expiresIn: number;
  createdAt: string;
  expiresAt: string;
  authToken?: string;
  newRegistration?: boolean;
}

export interface PlexUser {
  id: number;
  uuid: string;
  username: string;
  email: string;
  locale: string;
  emailOnlyAuth: boolean;
  hasPassword: boolean;
  protected: boolean;
  thumb: string;
  authToken: string;
  mailingListStatus: string;
  mailingListActive: boolean;
  scrobbleTypes: string;
  country: string;
  subscription?: {
    active: boolean;
    status: string;
    plan: string;
    features: string[];
  };
  profile?: {
    autoSelectAudio: boolean;
    defaultAudioLanguage: string;
    defaultSubtitleLanguage: string;
    autoSelectSubtitle: number;
    defaultSubtitleAccessibility: number;
    defaultSubtitleForced: number;
  };
  entitlements: string[];
  roles: string[];
  services: Array<{
    identifier: string;
    endpoint: string;
    token: string;
    status: string;
    secret: string;
  }>;
  adsConsent?: boolean;
  adsConsentSetAt?: string;
  adsConsentReminderAt?: string;
  experimentalFeatures: boolean;
  twoFactorEnabled: boolean;
  backupCodesCreated: boolean;
}

export class PlexAuthService {
  private readonly userRepository: UserRepository;
  private readonly sessionTokenRepository: SessionTokenRepository;
  private readonly clientIdentifier: string;
  private readonly product: string;
  private readonly version: string;
  private readonly platform: string;
  private readonly deviceName: string;

  constructor(userRepository: UserRepository, sessionTokenRepository: SessionTokenRepository) {
    this.userRepository = userRepository;
    this.sessionTokenRepository = sessionTokenRepository;
    this.clientIdentifier = process.env.PLEX_CLIENT_ID || this.generateClientId();
    this.product = process.env.PLEX_PRODUCT || 'MediaNest';
    this.version = process.env.PLEX_VERSION || '1.0.0';
    this.platform = process.env.PLEX_PLATFORM || 'Web';
    this.deviceName = process.env.PLEX_DEVICE_NAME || 'MediaNest Web';
  }

  /**
   * Generate Plex client identifier
   */
  private generateClientId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Get standard Plex headers
   */
  private getPlexHeaders(authToken?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Plex-Client-Identifier': this.clientIdentifier,
      'X-Plex-Product': this.product,
      'X-Plex-Version': this.version,
      'X-Plex-Platform': this.platform,
      'X-Plex-Device': this.platform,
      'X-Plex-Device-Name': this.deviceName,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['X-Plex-Token'] = authToken;
    }

    return headers;
  }

  /**
   * Create a new PIN for Plex OAuth
   */
  async createPin(): Promise<PlexPin> {
    try {
      const headers = this.getPlexHeaders();

      const response = await fetch('https://plex.tv/api/v2/pins', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          strong: true,
          'X-Plex-Client-Identifier': this.clientIdentifier,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Failed to create Plex PIN', {
          status: response.status,
          error: errorText,
        });
        throw new AppError('Unable to connect to Plex services', 503, 'PLEX_UNAVAILABLE');
      }

      const data = (await response.json()) as PlexPin;

      logger.info('Plex PIN created successfully', {
        pinId: data.id,
        code: data.code,
        expiresAt: data.expiresAt,
      });

      return data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error('Error creating Plex PIN', { error });
      throw new AppError('Failed to initialize Plex authentication', 500, 'PLEX_PIN_ERROR');
    }
  }

  /**
   * Check PIN status and get auth token if authorized
   */
  async checkPin(pinId: number): Promise<PlexPin> {
    try {
      const headers = this.getPlexHeaders();

      const response = await fetch(`https://plex.tv/api/v2/pins/${pinId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new AppError('PIN_NOT_FOUND', 'PIN not found or expired', 404);
        }

        const errorText = await response.text();
        logger.error('Failed to check Plex PIN', {
          pinId,
          status: response.status,
          error: errorText,
        });
        throw new AppError('Unable to verify PIN status', 503, 'PLEX_UNAVAILABLE');
      }

      const data = (await response.json()) as PlexPin;

      logger.info('Plex PIN checked', {
        pinId: data.id,
        hasAuthToken: !!data.authToken,
        expiresAt: data.expiresAt,
      });

      return data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error('Error checking Plex PIN', { error, pinId });
      throw new AppError('Failed to check PIN status', 500, 'PLEX_PIN_CHECK_ERROR');
    }
  }

  /**
   * Get Plex user information using auth token
   */
  async getPlexUser(authToken: string): Promise<PlexUser> {
    try {
      const headers = this.getPlexHeaders(authToken);

      const response = await fetch('https://plex.tv/api/v2/user', {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new AppError('INVALID_TOKEN', 'Invalid Plex auth token', 401);
        }

        const errorText = await response.text();
        logger.error('Failed to get Plex user', {
          status: response.status,
          error: errorText,
        });
        throw new AppError('Unable to fetch user information', 503, 'PLEX_USER_ERROR');
      }

      const data = (await response.json()) as PlexUser;

      logger.info('Plex user fetched successfully', {
        userId: data.id,
        username: data.username,
        email: data.email,
      });

      return data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error('Error getting Plex user', { error });
      throw new AppError('Failed to fetch user information', 500, 'PLEX_USER_FETCH_ERROR');
    }
  }

  /**
   * Complete OAuth flow: exchange PIN for user session
   */
  async completeOAuth(pinId: number): Promise<{
    user: PlexUserType;
    token: string;
    isNewUser: boolean;
  }> {
    try {
      // Check PIN and get auth token
      const pin = await this.checkPin(pinId);

      if (!pin.authToken) {
        throw new AppError('PIN not yet authorized by user', 400, 'PIN_NOT_AUTHORIZED');
      }

      // Get user info from Plex
      const plexUser = await this.getPlexUser(pin.authToken);

      // Find or create user in our database
      let user = await this.userRepository.findByPlexId(plexUser.id.toString());
      let isNewUser = false;

      if (!user) {
        // Create new user
        user = await this.userRepository.create({
          email: plexUser.email || '',
          name: plexUser.username,
          plexId: plexUser.id.toString(),
          plexUsername: plexUser.username,
          plexToken: plexUser.authenticationToken,
          role: 'user',
        });
        isNewUser = true;

        logger.info('New user created from Plex OAuth', {
          userId: user.id,
          plexId: plexUser.id,
          email: plexUser.email,
        });
      } else {
        // Update existing user with new token and login time
        user = await this.userRepository.update(user.id, {
          plexToken: plexUser.authenticationToken,
          lastLoginAt: new Date(),
          name: plexUser.username, // Update name in case it changed
        });

        logger.info('Existing user updated from Plex OAuth', {
          userId: user.id,
          plexId: plexUser.id,
        });
      }

      // Generate JWT token
      const jwtToken = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        plexId: user.plexId || undefined,
      });

      // Create session token record
      await this.sessionTokenRepository.create({
        userId: user.id,
        hashedToken: jwtToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plexUsername: user.plexUsername,
        },
        token: jwtToken,
        isNewUser,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error('Error completing Plex OAuth', { error, pinId });
      throw new AppError('Failed to complete authentication', 500, 'OAUTH_COMPLETION_ERROR');
    }
  }
}
