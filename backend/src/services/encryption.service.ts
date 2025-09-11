// @ts-nocheck
import crypto from 'crypto';

import { CatchError } from '../types/common';

import { logger } from '@/utils/logger';

interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
  salt: string;
}

export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private encryptionKey: string;
  private saltLength = 32;

  constructor() {
    // Get encryption key from environment variable
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error('Encryption key must be at least 32 characters');
    }

    this.encryptionKey = encryptionKey;
  }

  /**
   * Derive a key from the master key using a random salt
   */
  private deriveKey(salt: Buffer): Buffer {
    return crypto.scryptSync(this.encryptionKey, salt, 32);
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  encrypt(text: string): EncryptedData {
    try {
      // Generate random salt and IV
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(16);

      // Derive key from salt
      const key = this.deriveKey(salt);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      // Encrypt data
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get auth tag
      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        salt: salt.toString('hex'),
      };
    } catch (error: CatchError) {
      logger.error('Encryption failed', { error });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data encrypted with AES-256-GCM
   */
  decrypt(data: EncryptedData): string {
    try {
      // Derive key from salt
      const salt = Buffer.from(data.salt, 'hex');
      const key = this.deriveKey(salt);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, Buffer.from(data.iv, 'hex'));

      // Set auth tag
      decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

      // Decrypt data
      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: CatchError) {
      logger.error('Decryption failed', { error });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt data and return as single string for storage
   */
  encryptForStorage(text: string): string {
    const encrypted = this.encrypt(text);
    // Combine all parts with delimiter
    return `${encrypted.encrypted}:${encrypted.iv}:${encrypted.authTag}:${encrypted.salt}`;
  }

  /**
   * Decrypt data from storage format
   */
  decryptFromStorage(storedData: string): string {
    const [encrypted, iv, authTag, salt] = storedData.split(':');

    if (!encrypted || !iv || !authTag || !salt) {
      throw new Error('Invalid encrypted data format');
    }

    return this.decrypt({ encrypted, iv, authTag, salt });
  }

  /**
   * Check if a string is encrypted (has the expected format)
   */
  isEncrypted(data: string): boolean {
    const parts = data.split(':');
    return parts.length === 4 && parts.every((part) => /^[0-9a-f]+$/i.test(part));
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();
