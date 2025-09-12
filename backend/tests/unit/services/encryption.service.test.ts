import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { EncryptionService } from '@/services/encryption.service';

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  let originalEncryptionKey: string | undefined;

  beforeEach(() => {
    originalEncryptionKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long';
    encryptionService = new EncryptionService();
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with valid encryption key', () => {
      expect(() => new EncryptionService()).not.toThrow();
    });

    it('should throw error if encryption key is missing', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => new EncryptionService()).toThrow(
        'Encryption key must be at least 32 characters',
      );
    });

    it('should throw error if encryption key is too short', () => {
      process.env.ENCRYPTION_KEY = 'short-key';
      expect(() => new EncryptionService()).toThrow(
        'Encryption key must be at least 32 characters',
      );
    });

    it('should accept encryption key exactly 32 characters', () => {
      process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
      expect(() => new EncryptionService()).not.toThrow();
    });
  });

  describe('encrypt', () => {
    it('should encrypt plain text successfully', () => {
      const plaintext = 'sensitive data';
      const result = encryptionService.encrypt(plaintext);

      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');
      expect(result).toHaveProperty('salt');
      expect(typeof result.encrypted).toBe('string');
      expect(typeof result.iv).toBe('string');
      expect(typeof result.authTag).toBe('string');
      expect(typeof result.salt).toBe('string');
    });

    it('should generate different encrypted values for same input', () => {
      const plaintext = 'same data';
      const result1 = encryptionService.encrypt(plaintext);
      const result2 = encryptionService.encrypt(plaintext);

      expect(result1.encrypted).not.toBe(result2.encrypted);
      expect(result1.iv).not.toBe(result2.iv);
      expect(result1.salt).not.toBe(result2.salt);
    });

    it('should handle empty string', () => {
      const result = encryptionService.encrypt('');
      expect(result).toHaveProperty('encrypted');
      expect(result.encrypted).toBeTruthy();
    });

    it('should handle unicode characters', () => {
      const plaintext = 'héllo wørld 🌍';
      const result = encryptionService.encrypt(plaintext);
      expect(result).toHaveProperty('encrypted');
    });

    it('should handle very long strings', () => {
      const plaintext = 'x'.repeat(10000);
      const result = encryptionService.encrypt(plaintext);
      expect(result).toHaveProperty('encrypted');
    });
  });

  describe('decrypt', () => {
    it('should decrypt data successfully', () => {
      const plaintext = 'sensitive data';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty string decryption', () => {
      const plaintext = '';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'héllo wørld 🌍';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error with invalid encrypted data', () => {
      const invalidData = {
        encrypted: 'invalid',
        iv: 'invalid',
        authTag: 'invalid',
        salt: 'invalid',
      };

      expect(() => encryptionService.decrypt(invalidData)).toThrow('Failed to decrypt data');
    });

    it('should throw error with corrupted auth tag', () => {
      const plaintext = 'test data';
      const encrypted = encryptionService.encrypt(plaintext);
      encrypted.authTag = 'corrupted';

      expect(() => encryptionService.decrypt(encrypted)).toThrow('Failed to decrypt data');
    });

    it('should throw error with wrong salt', () => {
      const plaintext = 'test data';
      const encrypted = encryptionService.encrypt(plaintext);
      encrypted.salt = '0'.repeat(64);

      expect(() => encryptionService.decrypt(encrypted)).toThrow('Failed to decrypt data');
    });
  });

  describe('encryptForStorage', () => {
    it('should return encrypted data as colon-separated string', () => {
      const plaintext = 'storage data';
      const result = encryptionService.encryptForStorage(plaintext);

      expect(typeof result).toBe('string');
      expect(result.split(':')).toHaveLength(4);
    });

    it('should create different strings for same input', () => {
      const plaintext = 'same data';
      const result1 = encryptionService.encryptForStorage(plaintext);
      const result2 = encryptionService.encryptForStorage(plaintext);

      expect(result1).not.toBe(result2);
    });

    it('should handle special characters in storage format', () => {
      const plaintext = 'data:with:colons';
      const result = encryptionService.encryptForStorage(plaintext);
      expect(result.split(':')).toHaveLength(4);
    });
  });

  describe('decryptFromStorage', () => {
    it('should decrypt data from storage format', () => {
      const plaintext = 'storage data';
      const encrypted = encryptionService.encryptForStorage(plaintext);
      const decrypted = encryptionService.decryptFromStorage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle data with special characters', () => {
      const plaintext = 'data:with:colons';
      const encrypted = encryptionService.encryptForStorage(plaintext);
      const decrypted = encryptionService.decryptFromStorage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error with invalid format - too few parts', () => {
      const invalidData = 'part1:part2:part3';
      expect(() => encryptionService.decryptFromStorage(invalidData)).toThrow(
        'Invalid encrypted data format',
      );
    });

    it('should throw error with invalid format - too many parts', () => {
      const invalidData = 'part1:part2:part3:part4:part5';
      expect(() => encryptionService.decryptFromStorage(invalidData)).toThrow(
        'Failed to decrypt data',
      );
    });

    it('should throw error with empty parts', () => {
      const invalidData = 'part1::part3:part4';
      expect(() => encryptionService.decryptFromStorage(invalidData)).toThrow(
        'Invalid encrypted data format',
      );
    });
  });

  describe('isEncrypted', () => {
    it('should return true for properly encrypted data', () => {
      const plaintext = 'test data';
      const encrypted = encryptionService.encryptForStorage(plaintext);
      expect(encryptionService.isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(encryptionService.isEncrypted('plain text')).toBe(false);
    });

    it('should return false for invalid format - wrong number of parts', () => {
      expect(encryptionService.isEncrypted('part1:part2:part3')).toBe(false);
    });

    it('should return false for invalid format - non-hex characters', () => {
      expect(encryptionService.isEncrypted('abcd:efgh:ijkl:mnop')).toBe(false);
    });

    it('should return true for all hex parts', () => {
      expect(encryptionService.isEncrypted('abcd1234:efgh5678:ijkl9abc:mnop0def')).toBe(true);
    });

    it('should handle empty string', () => {
      expect(encryptionService.isEncrypted('')).toBe(false);
    });

    it('should handle single colon', () => {
      expect(encryptionService.isEncrypted(':')).toBe(false);
    });
  });

  describe('round-trip encryption/decryption', () => {
    const testCases = [
      'simple text',
      '',
      'text with spaces and 123 numbers',
      'special!@#$%^&*()characters',
      'héllo wørld 🌍 unicode',
      'very'.repeat(1000) + ' long string',
      JSON.stringify({ key: 'value', nested: { array: [1, 2, 3] } }),
    ];

    testCases.forEach((testCase) => {
      it(`should handle round-trip for: "${testCase.substring(0, 50)}${testCase.length > 50 ? '...' : ''}"`, () => {
        const encrypted = encryptionService.encrypt(testCase);
        const decrypted = encryptionService.decrypt(encrypted);
        expect(decrypted).toBe(testCase);
      });

      it(`should handle storage round-trip for: "${testCase.substring(0, 50)}${testCase.length > 50 ? '...' : ''}"`, () => {
        const encrypted = encryptionService.encryptForStorage(testCase);
        const decrypted = encryptionService.decryptFromStorage(encrypted);
        expect(decrypted).toBe(testCase);
      });
    });
  });

  describe('error handling', () => {
    it('should handle crypto errors in encryption', () => {
      // Mock crypto to throw error
      const originalCrypto = global.crypto;
      vi.stubGlobal('crypto', {
        ...global.crypto,
        randomBytes: () => {
          throw new Error('Crypto error');
        },
      });

      expect(() => encryptionService.encrypt('test')).toThrow('Failed to encrypt data');

      vi.stubGlobal('crypto', originalCrypto);
    });
  });
});
