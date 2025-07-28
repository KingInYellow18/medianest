import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { EncryptionService } from '../../../src/services/encryption.service';

// Mock the logger to prevent console output during tests
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

describe('EncryptionService Security Tests', () => {
  let encryptionService: EncryptionService;
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    // Set a strong test encryption key
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-minimum-length-for-security';
    encryptionService = new EncryptionService();
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore original environment
    if (originalEnv) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  describe('Constructor Security', () => {
    it('should reject encryption key shorter than 32 characters', () => {
      process.env.ENCRYPTION_KEY = 'short-key';
      expect(() => new EncryptionService()).toThrow(
        'Encryption key must be at least 32 characters',
      );
    });

    it('should reject missing encryption key', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => new EncryptionService()).toThrow(
        'Encryption key must be at least 32 characters',
      );
    });

    it('should reject empty encryption key', () => {
      process.env.ENCRYPTION_KEY = '';
      expect(() => new EncryptionService()).toThrow(
        'Encryption key must be at least 32 characters',
      );
    });

    it('should accept exactly 32 character key', () => {
      process.env.ENCRYPTION_KEY = '12345678901234567890123456789012'; // 32 chars
      expect(() => new EncryptionService()).not.toThrow();
    });

    it('should accept key longer than 32 characters', () => {
      process.env.ENCRYPTION_KEY = '123456789012345678901234567890123456789012345678901234567890'; // 60 chars
      expect(() => new EncryptionService()).not.toThrow();
    });
  });

  describe('Basic Encryption/Decryption Security', () => {
    it('should encrypt and decrypt text correctly', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted.encrypted).not.toBe(plaintext);
      expect(encrypted.iv).toHaveLength(32); // 16 bytes as hex
      expect(encrypted.authTag).toHaveLength(32); // 16 bytes as hex
      expect(encrypted.salt).toHaveLength(64); // 32 bytes as hex
    });

    it('should produce different encrypted outputs for same input', () => {
      const plaintext = 'Same input text';
      const encrypted1 = encryptionService.encrypt(plaintext);
      const encrypted2 = encryptionService.encrypt(plaintext);

      // Should be different due to random IV and salt
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.authTag).not.toBe(encrypted2.authTag);

      // But both should decrypt to the same plaintext
      expect(encryptionService.decrypt(encrypted1)).toBe(plaintext);
      expect(encryptionService.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle empty string encryption', () => {
      const plaintext = '';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode text encryption', () => {
      const plaintext = '🔒 Security test with émojis and spëcial chars: ñ ü ç 中文 العربية';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle very long text encryption', () => {
      const plaintext = 'A'.repeat(10000); // 10KB of text
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Authentication Tag Security', () => {
    it('should fail decryption with tampered encrypted data', () => {
      const plaintext = 'Sensitive data';
      const encrypted = encryptionService.encrypt(plaintext);

      // Tamper with encrypted data
      const tamperedData = {
        ...encrypted,
        encrypted: encrypted.encrypted.slice(0, -2) + 'XX',
      };

      expect(() => encryptionService.decrypt(tamperedData)).toThrow('Failed to decrypt data');
    });

    it('should fail decryption with tampered auth tag', () => {
      const plaintext = 'Sensitive data';
      const encrypted = encryptionService.encrypt(plaintext);

      // Tamper with auth tag
      const tamperedData = {
        ...encrypted,
        authTag: encrypted.authTag.slice(0, -2) + 'XX',
      };

      expect(() => encryptionService.decrypt(tamperedData)).toThrow('Failed to decrypt data');
    });

    it('should fail decryption with tampered IV', () => {
      const plaintext = 'Sensitive data';
      const encrypted = encryptionService.encrypt(plaintext);

      // Tamper with IV
      const tamperedData = {
        ...encrypted,
        iv: encrypted.iv.slice(0, -2) + 'XX',
      };

      expect(() => encryptionService.decrypt(tamperedData)).toThrow('Failed to decrypt data');
    });

    it('should fail decryption with tampered salt', () => {
      const plaintext = 'Sensitive data';
      const encrypted = encryptionService.encrypt(plaintext);

      // Tamper with salt
      const tamperedData = {
        ...encrypted,
        salt: encrypted.salt.slice(0, -2) + 'XX',
      };

      expect(() => encryptionService.decrypt(tamperedData)).toThrow('Failed to decrypt data');
    });
  });

  describe('Storage Format Security', () => {
    it('should encrypt and decrypt from storage format', () => {
      const plaintext = 'Storage test data';
      const storageData = encryptionService.encryptForStorage(plaintext);
      const decrypted = encryptionService.decryptFromStorage(storageData);

      expect(decrypted).toBe(plaintext);
      expect(storageData).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i);
    });

    it('should fail with malformed storage data - missing parts', () => {
      const malformedData = 'encrypted:iv:tag'; // Missing salt
      expect(() => encryptionService.decryptFromStorage(malformedData)).toThrow(
        'Invalid encrypted data format',
      );
    });

    it('should fail with malformed storage data - too many parts', () => {
      const malformedData = 'encrypted:iv:tag:salt:extra';
      expect(() => encryptionService.decryptFromStorage(malformedData)).toThrow(
        'Invalid encrypted data format',
      );
    });

    it('should fail with empty storage data parts', () => {
      const malformedData = 'encrypted::tag:salt'; // Empty IV
      expect(() => encryptionService.decryptFromStorage(malformedData)).toThrow(
        'Invalid encrypted data format',
      );
    });

    it('should correctly identify encrypted data format', () => {
      const plaintext = 'Test data';
      const storageData = encryptionService.encryptForStorage(plaintext);

      expect(encryptionService.isEncrypted(storageData)).toBe(true);
      expect(encryptionService.isEncrypted(plaintext)).toBe(false);
      expect(encryptionService.isEncrypted('not:encrypted:format')).toBe(false);
      expect(encryptionService.isEncrypted('abc:def:ghi:jkl:extra')).toBe(false);
    });

    it('should reject non-hex characters in encrypted data detection', () => {
      const nonHexData = 'abcg:1234:5678:9abc'; // 'g' is not hex
      expect(encryptionService.isEncrypted(nonHexData)).toBe(false);
    });
  });

  describe('Concurrency and Performance Security', () => {
    it('should handle concurrent encryption operations safely', async () => {
      const plaintext = 'Concurrent test';
      const promises = Array.from({ length: 50 }, () =>
        Promise.resolve(encryptionService.encrypt(plaintext)),
      );

      const results = await Promise.all(promises);

      // All should encrypt successfully
      expect(results).toHaveLength(50);

      // All should have different encrypted values (due to random IV/salt)
      const encryptedValues = results.map((r) => r.encrypted);
      const uniqueValues = new Set(encryptedValues);
      expect(uniqueValues.size).toBe(50);

      // All should decrypt correctly
      results.forEach((encrypted) => {
        expect(encryptionService.decrypt(encrypted)).toBe(plaintext);
      });
    });

    it('should handle concurrent decryption operations safely', async () => {
      const plaintext = 'Concurrent decrypt test';
      const encrypted = encryptionService.encrypt(plaintext);

      const promises = Array.from({ length: 50 }, () =>
        Promise.resolve(encryptionService.decrypt(encrypted)),
      );

      const results = await Promise.all(promises);

      // All should decrypt successfully to the same value
      expect(results).toHaveLength(50);
      results.forEach((result) => {
        expect(result).toBe(plaintext);
      });
    });

    it('should complete encryption within reasonable time', () => {
      const plaintext = 'Performance test data';
      const iterations = 1000;

      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        encryptionService.encrypt(plaintext);
      }
      const endTime = Date.now();

      const timePerOperation = (endTime - startTime) / iterations;
      expect(timePerOperation).toBeLessThan(5); // Should be under 5ms per operation
    });

    it('should complete decryption within reasonable time', () => {
      const plaintext = 'Performance test data';
      const encrypted = encryptionService.encrypt(plaintext);
      const iterations = 1000;

      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        encryptionService.decrypt(encrypted);
      }
      const endTime = Date.now();

      const timePerOperation = (endTime - startTime) / iterations;
      expect(timePerOperation).toBeLessThan(5); // Should be under 5ms per operation
    });
  });

  describe('Error Handling Security', () => {
    it('should handle crypto operation failures gracefully', () => {
      // Mock crypto to throw an error
      const originalCreateCipheriv = crypto.createCipheriv;
      vi.spyOn(crypto, 'createCipheriv').mockImplementation(() => {
        throw new Error('Crypto operation failed');
      });

      expect(() => encryptionService.encrypt('test')).toThrow('Failed to encrypt data');

      // Restore original function
      crypto.createCipheriv = originalCreateCipheriv;
    });

    it('should handle decryption failures gracefully', () => {
      const plaintext = 'Test data';
      const encrypted = encryptionService.encrypt(plaintext);

      // Mock crypto to throw an error during decryption
      const originalCreateDecipheriv = crypto.createDecipheriv;
      vi.spyOn(crypto, 'createDecipheriv').mockImplementation(() => {
        throw new Error('Crypto operation failed');
      });

      expect(() => encryptionService.decrypt(encrypted)).toThrow('Failed to decrypt data');

      // Restore original function
      crypto.createDecipheriv = originalCreateDecipheriv;
    });

    it('should not leak sensitive data in error messages', () => {
      const plaintext = 'sensitive-password-data';

      // Mock crypto to throw during encryption
      vi.spyOn(crypto, 'createCipheriv').mockImplementation(() => {
        throw new Error('Crypto operation failed');
      });

      try {
        encryptionService.encrypt(plaintext);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Failed to encrypt data');
        expect(error.message).not.toContain(plaintext);
      }
    });
  });

  describe('Memory Security', () => {
    it('should not retain sensitive data in memory after encryption', () => {
      const plaintext = 'sensitive-memory-test';
      const encrypted = encryptionService.encrypt(plaintext);

      // Verify encrypted object doesn't contain plaintext
      const encryptedString = JSON.stringify(encrypted);
      expect(encryptedString).not.toContain(plaintext);
    });

    it('should handle large data encryption without memory issues', () => {
      const largeData = 'A'.repeat(1024 * 1024); // 1MB of data

      const memBefore = process.memoryUsage();
      const encrypted = encryptionService.encrypt(largeData);
      const decrypted = encryptionService.decrypt(encrypted);
      const memAfter = process.memoryUsage();

      expect(decrypted).toBe(largeData);

      // Memory usage shouldn't increase drastically (allow 10MB variance)
      const memDiff = memAfter.heapUsed - memBefore.heapUsed;
      expect(memDiff).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Salt and IV Randomness Security', () => {
    it('should generate unique salts for each encryption', () => {
      const plaintext = 'Same input';
      const encryptions = Array.from({ length: 100 }, () => encryptionService.encrypt(plaintext));

      const salts = encryptions.map((e) => e.salt);
      const uniqueSalts = new Set(salts);

      expect(uniqueSalts.size).toBe(100); // All salts should be unique
    });

    it('should generate unique IVs for each encryption', () => {
      const plaintext = 'Same input';
      const encryptions = Array.from({ length: 100 }, () => encryptionService.encrypt(plaintext));

      const ivs = encryptions.map((e) => e.iv);
      const uniqueIVs = new Set(ivs);

      expect(uniqueIVs.size).toBe(100); // All IVs should be unique
    });

    it('should generate cryptographically secure random values', () => {
      const encryptions = Array.from({ length: 10 }, () => encryptionService.encrypt('test'));

      // Check that salt and IV values appear random (no obvious patterns)
      encryptions.forEach((encrypted) => {
        expect(encrypted.salt).toMatch(/^[0-9a-f]{64}$/i);
        expect(encrypted.iv).toMatch(/^[0-9a-f]{32}$/i);
        expect(encrypted.authTag).toMatch(/^[0-9a-f]{32}$/i);

        // Should not be all zeros or all the same character
        expect(encrypted.salt).not.toMatch(/^(.)\1+$/);
        expect(encrypted.iv).not.toMatch(/^(.)\1+$/);
        expect(encrypted.authTag).not.toMatch(/^(.)\1+$/);
      });
    });
  });

  describe('Key Derivation Security', () => {
    it('should derive different keys from different salts', () => {
      // This test verifies that different salts produce different encrypted outputs
      const plaintext = 'Key derivation test';
      const encryptions = Array.from({ length: 10 }, () => encryptionService.encrypt(plaintext));

      // All encrypted values should be different due to different salt-derived keys
      const encryptedValues = encryptions.map((e) => e.encrypted);
      const uniqueValues = new Set(encryptedValues);
      expect(uniqueValues.size).toBe(10);
    });

    it('should use proper key derivation parameters', () => {
      // Verify that the service uses the correct algorithm (AES-256-GCM)
      const plaintext = 'Algorithm test';
      const encrypted = encryptionService.encrypt(plaintext);

      // GCM mode produces specific characteristics
      expect(encrypted.authTag).toHaveLength(32); // 16 bytes as hex
      expect(encrypted.iv).toHaveLength(32); // 16 bytes as hex
      expect(encrypted.salt).toHaveLength(64); // 32 bytes as hex

      // Should decrypt correctly
      expect(encryptionService.decrypt(encrypted)).toBe(plaintext);
    });
  });

  describe('Edge Cases and Attack Scenarios', () => {
    it('should handle null byte injection attempts', () => {
      const maliciousInput = 'test\x00malicious\x00data';
      const encrypted = encryptionService.encrypt(maliciousInput);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(maliciousInput);
    });

    it('should handle control character injection', () => {
      const maliciousInput = 'test\r\n\t\x08\x1b[31mmalicious';
      const encrypted = encryptionService.encrypt(maliciousInput);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(maliciousInput);
    });

    it('should handle SQL injection-style input', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const encrypted = encryptionService.encrypt(maliciousInput);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(maliciousInput);
    });

    it('should handle script injection attempts', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const encrypted = encryptionService.encrypt(maliciousInput);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(maliciousInput);
    });

    it('should handle very long input without DoS', () => {
      // Test with 10MB of data
      const veryLongInput = 'A'.repeat(10 * 1024 * 1024);

      const startTime = Date.now();
      const encrypted = encryptionService.encrypt(veryLongInput);
      const decrypted = encryptionService.decrypt(encrypted);
      const endTime = Date.now();

      expect(decrypted).toBe(veryLongInput);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should have consistent timing for decryption failures', async () => {
      const plaintext = 'Timing test';
      const encrypted = encryptionService.encrypt(plaintext);

      // Create various types of invalid data
      const invalidInputs = [
        { ...encrypted, authTag: 'invalid' },
        { ...encrypted, encrypted: 'invalid' },
        { ...encrypted, iv: 'invalid' },
        { ...encrypted, salt: 'invalid' },
      ];

      const timings: number[] = [];

      for (const invalidInput of invalidInputs) {
        const start = process.hrtime.bigint();
        try {
          encryptionService.decrypt(invalidInput);
        } catch {
          // Expected to fail
        }
        const end = process.hrtime.bigint();
        timings.push(Number(end - start) / 1000000); // Convert to milliseconds
      }

      // All timing measurements should be relatively close
      const avgTime = timings.reduce((a, b) => a + b) / timings.length;
      const maxDeviation = Math.max(...timings.map((t) => Math.abs(t - avgTime)));

      // Allow for some variance but should be consistent within 50ms
      expect(maxDeviation).toBeLessThan(50);
    });
  });
});
