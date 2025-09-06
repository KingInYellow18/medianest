import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock crypto module with inline mock functions
vi.mock('crypto', () => ({
  randomBytes: vi.fn(),
  scryptSync: vi.fn(),
  createCipheriv: vi.fn(),
  createDecipheriv: vi.fn(),
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { EncryptionService } from '../../services/encryption.service';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    // Mock environment variable
    process.env.ENCRYPTION_KEY = 'test-encryption-key-that-is-32-chars-long!';
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mocks
    const mockSalt = Buffer.from('mock-salt-32-bytes-long-for-testing!!');
    const mockIv = Buffer.from('mock-iv-16-bytes!');
    const mockKey = Buffer.from('mock-derived-key-32-bytes-long!!!!');
    
    mockRandomBytes
      .mockReturnValueOnce(mockSalt) // for salt
      .mockReturnValueOnce(mockIv);  // for IV
      
    mockScryptSync.mockReturnValue(mockKey);

    encryptionService = new EncryptionService();
  });

  describe('constructor', () => {
    it('should throw error if encryption key is missing', () => {
      delete process.env.ENCRYPTION_KEY;
      
      expect(() => new EncryptionService()).toThrow('Encryption key must be at least 32 characters');
    });

    it('should throw error if encryption key is too short', () => {
      process.env.ENCRYPTION_KEY = 'short-key';
      
      expect(() => new EncryptionService()).toThrow('Encryption key must be at least 32 characters');
    });
  });

  describe('encrypt', () => {
    it('should encrypt text successfully', () => {
      const mockCipher = {
        update: vi.fn().mockReturnValue('encrypted-part'),
        final: vi.fn().mockReturnValue('final-part'),
        getAuthTag: vi.fn().mockReturnValue(Buffer.from('auth-tag-16-bytes!')),
      };

      mockCreateCipheriv.mockReturnValue(mockCipher);

      const result = encryptionService.encrypt('test-plaintext');

      expect(result).toEqual({
        encrypted: 'encrypted-partfinal-part',
        iv: expect.any(String),
        authTag: expect.any(String),
        salt: expect.any(String),
      });

      expect(mockCreateCipheriv).toHaveBeenCalledWith('aes-256-gcm', expect.any(Buffer), expect.any(Buffer));
      expect(mockCipher.update).toHaveBeenCalledWith('test-plaintext', 'utf8', 'hex');
      expect(mockCipher.final).toHaveBeenCalledWith('hex');
    });

    it('should handle encryption errors', () => {
      mockCreateCipheriv.mockImplementation(() => {
        throw new Error('Cipher creation failed');
      });

      expect(() => encryptionService.encrypt('test-plaintext')).toThrow('Failed to encrypt data');
    });
  });

  describe('decrypt', () => {
    it('should decrypt data successfully', () => {
      const mockDecipher = {
        setAuthTag: vi.fn(),
        update: vi.fn().mockReturnValue('decrypted-part'),
        final: vi.fn().mockReturnValue('final-part'),
      };

      mockCreateDecipheriv.mockReturnValue(mockDecipher);

      const encryptedData = {
        encrypted: 'encrypted-text',
        iv: 'mock-iv-hex',
        authTag: 'auth-tag-hex',
        salt: 'salt-hex',
      };

      const result = encryptionService.decrypt(encryptedData);

      expect(result).toBe('decrypted-partfinal-part');
      expect(mockCreateDecipheriv).toHaveBeenCalledWith('aes-256-gcm', expect.any(Buffer), expect.any(Buffer));
      expect(mockDecipher.setAuthTag).toHaveBeenCalled();
      expect(mockDecipher.update).toHaveBeenCalledWith('encrypted-text', 'hex', 'utf8');
      expect(mockDecipher.final).toHaveBeenCalledWith('utf8');
    });

    it('should handle decryption errors', () => {
      mockCreateDecipheriv.mockImplementation(() => {
        throw new Error('Decipher creation failed');
      });

      const encryptedData = {
        encrypted: 'encrypted-text',
        iv: 'mock-iv-hex',
        authTag: 'auth-tag-hex',
        salt: 'salt-hex',
      };

      expect(() => encryptionService.decrypt(encryptedData)).toThrow('Failed to decrypt data');
    });
  });

  describe('encryptForStorage', () => {
    it('should encrypt and format data for storage', () => {
      const mockCipher = {
        update: vi.fn().mockReturnValue('encrypted'),
        final: vi.fn().mockReturnValue(''),
        getAuthTag: vi.fn().mockReturnValue(Buffer.from('auth-tag-16-bytes!')),
      };

      mockCreateCipheriv.mockReturnValue(mockCipher);

      const result = encryptionService.encryptForStorage('test-data');

      expect(result).toMatch(/^[^:]+:[^:]+:[^:]+:[^:]+$/); // Should have 4 parts separated by colons
    });
  });

  describe('decryptFromStorage', () => {
    it('should decrypt data from storage format', () => {
      const mockDecipher = {
        setAuthTag: vi.fn(),
        update: vi.fn().mockReturnValue('decrypted'),
        final: vi.fn().mockReturnValue(''),
      };

      mockCreateDecipheriv.mockReturnValue(mockDecipher);

      const storedData = 'encrypted:iv:authTag:salt';
      const result = encryptionService.decryptFromStorage(storedData);

      expect(result).toBe('decrypted');
    });

    it('should throw error for invalid storage format', () => {
      const invalidData = 'invalid-format';

      expect(() => encryptionService.decryptFromStorage(invalidData)).toThrow('Invalid encrypted data format');
    });
  });

  describe('isEncrypted', () => {
    it('should return true for properly formatted encrypted data', () => {
      const encryptedData = 'abc123:def456:789abc:def123';
      
      expect(encryptionService.isEncrypted(encryptedData)).toBe(true);
    });

    it('should return false for invalid format', () => {
      const invalidData = 'not-encrypted-data';
      
      expect(encryptionService.isEncrypted(invalidData)).toBe(false);
    });

    it('should return false for data with non-hex characters', () => {
      const invalidData = 'abc123:def456:789xyz:def123'; // 'xyz' is not hex
      
      expect(encryptionService.isEncrypted(invalidData)).toBe(false);
    });
  });
});