import crypto from 'crypto';
import { UserRepository } from '../repositories/user.repository';
import { SessionTokenRepository } from '../repositories/session-token.repository';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

interface DeviceFingerprint {
  userAgent: string;
  ipAddress: string;
  acceptLanguage?: string;
  acceptEncoding?: string;
  deviceId: string;
  riskScore: number;
}

interface SessionDevice {
  id: string;
  userId: string;
  deviceId: string;
  fingerprint: DeviceFingerprint;
  lastSeen: Date;
  isActive: boolean;
  location?: {
    country?: string;
    city?: string;
    timezone?: string;
  };
  riskAssessment: {
    score: number;
    factors: string[];
    isNewDevice: boolean;
    isNewLocation: boolean;
  };
}

export class DeviceSessionService {
  private userRepository: UserRepository;
  private sessionTokenRepository: SessionTokenRepository;

  constructor(
    userRepository?: UserRepository,
    sessionTokenRepository?: SessionTokenRepository
  ) {
    this.userRepository = userRepository || new UserRepository();
    this.sessionTokenRepository = sessionTokenRepository || new SessionTokenRepository();
  }

  /**
   * Generate device fingerprint from request
   */
  generateDeviceFingerprint(req: any): DeviceFingerprint {
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection.remoteAddress || '';
    const acceptLanguage = req.headers['accept-language'];
    const acceptEncoding = req.headers['accept-encoding'];
    
    // Create device ID hash from stable browser/device characteristics
    const fingerprintData = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;
    const deviceId = crypto
      .createHash('sha256')
      .update(fingerprintData)
      .digest('hex')
      .substring(0, 16);

    // Calculate risk score based on various factors
    let riskScore = 0;
    
    // Unknown user agent
    if (!userAgent || userAgent.length < 10) riskScore += 30;
    
    // Missing standard headers
    if (!acceptLanguage) riskScore += 10;
    if (!acceptEncoding) riskScore += 10;
    
    // Private/internal IP addresses
    if (this.isPrivateIP(ipAddress)) riskScore += 20;

    return {
      userAgent,
      ipAddress,
      acceptLanguage,
      acceptEncoding,
      deviceId,
      riskScore: Math.min(riskScore, 100)
    };
  }

  /**
   * Track device for user session
   */
  async trackDevice(userId: string, fingerprint: DeviceFingerprint): Promise<SessionDevice> {
    const existingDevice = await this.getDeviceByFingerprint(userId, fingerprint.deviceId);
    
    if (existingDevice) {
      // Update existing device
      existingDevice.lastSeen = new Date();
      existingDevice.fingerprint = fingerprint;
      existingDevice.isActive = true;
      
      // Assess risk changes
      existingDevice.riskAssessment = await this.assessDeviceRisk(userId, fingerprint, existingDevice);
      
      await this.updateDevice(existingDevice);
      return existingDevice;
    } else {
      // Create new device
      const newDevice: SessionDevice = {
        id: crypto.randomUUID(),
        userId,
        deviceId: fingerprint.deviceId,
        fingerprint,
        lastSeen: new Date(),
        isActive: true,
        riskAssessment: await this.assessDeviceRisk(userId, fingerprint, null)
      };
      
      await this.saveDevice(newDevice);
      return newDevice;
    }
  }

  /**
   * Assess device risk
   */
  private async assessDeviceRisk(
    userId: string, 
    fingerprint: DeviceFingerprint, 
    existingDevice: SessionDevice | null
  ): Promise<SessionDevice['riskAssessment']> {
    let score = fingerprint.riskScore;
    const factors: string[] = [];
    
    // Check if new device
    const isNewDevice = !existingDevice;
    if (isNewDevice) {
      score += 25;
      factors.push('new_device');
    }
    
    // Check location change
    const isNewLocation = await this.isNewLocationForUser(userId, fingerprint.ipAddress);
    if (isNewLocation) {
      score += 20;
      factors.push('new_location');
    }
    
    // Check for suspicious patterns
    const suspiciousUserAgent = this.isSuspiciousUserAgent(fingerprint.userAgent);
    if (suspiciousUserAgent) {
      score += 40;
      factors.push('suspicious_user_agent');
    }
    
    return {
      score: Math.min(score, 100),
      factors,
      isNewDevice,
      isNewLocation
    };
  }

  /**
   * Get device by fingerprint
   */
  private async getDeviceByFingerprint(userId: string, deviceId: string): Promise<SessionDevice | null> {
    // This would typically query a database
    // For now, return null to simulate new device
    return null;
  }

  /**
   * Save device to storage
   */
  private async saveDevice(device: SessionDevice): Promise<void> {
    // This would typically save to database
    logger.info('Device tracked', { 
      deviceId: device.deviceId, 
      userId: device.userId,
      riskScore: device.riskAssessment.score 
    });
  }

  /**
   * Update device in storage
   */
  private async updateDevice(device: SessionDevice): Promise<void> {
    // This would typically update database record
    logger.info('Device updated', { 
      deviceId: device.deviceId, 
      userId: device.userId,
      riskScore: device.riskAssessment.score 
    });
  }

  /**
   * Check if IP is from new location for user
   */
  private async isNewLocationForUser(userId: string, ipAddress: string): Promise<boolean> {
    // This would typically check against user's historical locations
    // For now, assume locations are not tracked
    return false;
  }

  /**
   * Check if user agent is suspicious
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /crawler/i,
      /bot/i,
      /scanner/i,
      /sqlmap/i,
      /nikto/i,
      /burp/i,
      /nmap/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Check if IP is private/internal
   */
  private isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00::/,
      /^fe80::/
    ];
    
    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Get user devices
   */
  async getUserDevices(userId: string): Promise<SessionDevice[]> {
    // This would typically query database for user's devices
    return [];
  }

  /**
   * Revoke device access
   */
  async revokeDevice(userId: string, deviceId: string): Promise<void> {
    // Mark device as inactive and revoke sessions
    logger.info('Device revoked', { userId, deviceId });
  }
}