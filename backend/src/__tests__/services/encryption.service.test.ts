import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EncryptionService } from '../../services/encryption.service';

// Mock crypto module
const mockCrypto = {
  randomBytes: vi.fn(),
  createCipher: vi.fn(),
  createDecipher: vi.fn(),
  createHash: vi.fn(),
  pbkdf2Sync: vi.fn(),
};

vi.mock('crypto', () => mockCrypto);

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    // Setup default mocks
    mockCrypto.randomBytes.mockReturnValue(Buffer.from('test-random-bytes'));
    mockCrypto.createHash.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('hashed-value'),
    });
    mockCrypto.pbkdf2Sync.mockReturnValue(Buffer.from('derived-key'));

    encryptionService = new EncryptionService();
  });

  describe('encrypt', () => {
    it('should encrypt text successfully', () => {
      const mockCipher = {
        update: vi.fn().mockReturnValue('encrypted-part'),
        final: vi.fn().mockReturnValue('final-part'),
      };

      mockCrypto.createCipher.mockReturnValue(mockCipher);

      const result = encryptionService.encrypt('test-plaintext');

      expect(result).toEqual({
        success: true,
        encrypted: 'encrypted-partfinal-part',
        algorithm: 'aes-256-cbc',
      });

      expect(mockCrypto.createCipher).toHaveBeenCalledWith('aes-256-cbc', expect.any(String));
      expect(mockCipher.update).toHaveBeenCalledWith('test-plaintext', 'utf8', 'hex');
      expect(mockCipher.final).toHaveBeenCalledWith('hex');
    });

    it('should handle encryption errors', () => {
      mockCrypto.createCipher.mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      const result = encryptionService.encrypt('test-plaintext');

      expect(result).toEqual({
        success: false,
        error: 'Encryption failed',
      });
    });

    it('should validate input data', () => {
      const result = encryptionService.encrypt('');

      expect(result).toEqual({
        success: false,
        error: 'Input data is required',
      });
    });

    it('should use custom algorithm when specified', () => {
      const mockCipher = {
        update: vi.fn().mockReturnValue('encrypted'),
        final: vi.fn().mockReturnValue(''),
      };

      mockCrypto.createCipher.mockReturnValue(mockCipher);

      const result = encryptionService.encrypt('test', 'aes-192-cbc');

      expect(mockCrypto.createCipher).toHaveBeenCalledWith('aes-192-cbc', expect.any(String));
      expect(result.algorithm).toBe('aes-192-cbc');
    });
  });

  describe('decrypt', () => {
    it('should decrypt text successfully', () => {
      const mockDecipher = {
        update: vi.fn().mockReturnValue('decrypted-part'),
        final: vi.fn().mockReturnValue('final-part'),
      };

      mockCrypto.createDecipher.mockReturnValue(mockDecipher);

      const result = encryptionService.decrypt('encrypted-text');

      expect(result).toEqual({
        success: true,
        decrypted: 'decrypted-partfinal-part',
      });

      expect(mockCrypto.createDecipher).toHaveBeenCalledWith('aes-256-cbc', expect.any(String));
      expect(mockDecipher.update).toHaveBeenCalledWith('encrypted-text', 'hex', 'utf8');
      expect(mockDecipher.final).toHaveBeenCalledWith('utf8');
    });

    it('should handle decryption errors', () => {
      mockCrypto.createDecipher.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = encryptionService.decrypt('encrypted-text');

      expect(result).toEqual({
        success: false,
        error: 'Decryption failed',
      });
    });

    it('should validate encrypted data', () => {
      const result = encryptionService.decrypt('');

      expect(result).toEqual({
        success: false,
        error: 'Encrypted data is required',
      });
    });

    it('should handle invalid encrypted data format', () => {
      const mockDecipher = {
        update: vi.fn().mockImplementation(() => {
          throw new Error('Invalid hex string');
        }),
        final: vi.fn(),
      };

      mockCrypto.createDecipher.mockReturnValue(mockDecipher);

      const result = encryptionService.decrypt('invalid-hex-data');

      expect(result).toEqual({
        success: false,
        error: 'Invalid encrypted data format',
      });
    });
  });

  describe('hash', () => {
    it('should generate hash successfully', () => {
      const result = encryptionService.hash('test-data');

      expect(result).toEqual({
        success: true,
        hash: 'hashed-value',
        algorithm: 'sha256',
      });

      expect(mockCrypto.createHash).toHaveBeenCalledWith('sha256');
    });

    it('should support different hash algorithms', () => {
      const result = encryptionService.hash('test-data', 'sha512');

      expect(mockCrypto.createHash).toHaveBeenCalledWith('sha512');
      expect(result.algorithm).toBe('sha512');
    });

    it('should handle hashing errors', () => {
      mockCrypto.createHash.mockImplementation(() => {
        throw new Error('Hashing failed');
      });

      const result = encryptionService.hash('test-data');

      expect(result).toEqual({
        success: false,
        error: 'Hashing failed',
      });
    });

    it('should validate input data for hashing', () => {
      const result = encryptionService.hash('');

      expect(result).toEqual({
        success: false,
        error: 'Input data is required',
      });
    });
  });

  describe('generateSalt', () => {
    it('should generate salt with default length', () => {
      mockCrypto.randomBytes.mockReturnValue(Buffer.from('test-salt-16-bytes'));

      const result = encryptionService.generateSalt();

      expect(result).toEqual({
        success: true,
        salt: expect.any(String),
        length: 16,
      });

      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(16);
    });

    it('should generate salt with custom length', () => {
      mockCrypto.randomBytes.mockReturnValue(Buffer.from('test-salt-32-bytes-long-string'));

      const result = encryptionService.generateSalt(32);

      expect(result.length).toBe(32);
      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
    });

    it('should handle salt generation errors', () => {
      mockCrypto.randomBytes.mockImplementation(() => {
        throw new Error('Random bytes generation failed');
      });

      const result = encryptionService.generateSalt();

      expect(result).toEqual({
        success: false,
        error: 'Salt generation failed',
      });
    });

    it('should validate salt length', () => {
      const result = encryptionService.generateSalt(0);

      expect(result).toEqual({
        success: false,
        error: 'Salt length must be greater than 0',
      });
    });
  });

  describe('deriveKey', () => {
    it('should derive key from password and salt', () => {
      const result = encryptionService.deriveKey('password123', 'salt-value');

      expect(result).toEqual({
        success: true,
        key: expect.any(String),
        iterations: 10000,
        keyLength: 32,
      });

      expect(mockCrypto.pbkdf2Sync).toHaveBeenCalledWith(
        'password123',
        'salt-value',
        10000,
        32,
        'sha256',
      );
    });

    it('should support custom iterations and key length', () => {
      const result = encryptionService.deriveKey('password123', 'salt-value', 5000, 64);

      expect(result.iterations).toBe(5000);
      expect(result.keyLength).toBe(64);

      expect(mockCrypto.pbkdf2Sync).toHaveBeenCalledWith(
        'password123',
        'salt-value',
        5000,
        64,
        'sha256',
      );
    });

    it('should handle key derivation errors', () => {
      mockCrypto.pbkdf2Sync.mockImplementation(() => {
        throw new Error('Key derivation failed');
      });

      const result = encryptionService.deriveKey('password123', 'salt-value');

      expect(result).toEqual({
        success: false,
        error: 'Key derivation failed',
      });
    });

    it('should validate password and salt', () => {
      const result = encryptionService.deriveKey('', 'salt-value');

      expect(result).toEqual({
        success: false,
        error: 'Password and salt are required',
      });
    });
  });

  describe('generateKeyPair', () => {
    it('should generate RSA key pair', () => {
      const mockKeyPair = {
        publicKey: 'mock-public-key',
        privateKey: 'mock-private-key',
      };

      // Mock crypto.generateKeyPairSync
      const generateKeyPairSync = vi.fn().mockReturnValue(mockKeyPair);
      mockCrypto.generateKeyPairSync = generateKeyPairSync;

      const result = encryptionService.generateKeyPair();

      expect(result).toEqual({
        success: true,
        publicKey: 'mock-public-key',
        privateKey: 'mock-private-key',
        algorithm: 'rsa',
        keySize: 2048,
      });
    });

    it('should support different key sizes', () => {
      const mockKeyPair = {
        publicKey: 'mock-public-key-4096',
        privateKey: 'mock-private-key-4096',
      };

      const generateKeyPairSync = vi.fn().mockReturnValue(mockKeyPair);
      mockCrypto.generateKeyPairSync = generateKeyPairSync;

      const result = encryptionService.generateKeyPair('rsa', 4096);

      expect(result.keySize).toBe(4096);
    });

    it('should handle key pair generation errors', () => {
      const generateKeyPairSync = vi.fn().mockImplementation(() => {
        throw new Error('Key pair generation failed');
      });
      mockCrypto.generateKeyPairSync = generateKeyPairSync;

      const result = encryptionService.generateKeyPair();

      expect(result).toEqual({
        success: false,
        error: 'Key pair generation failed',
      });
    });
  });

  describe('encryptWithPassword', () => {
    it('should encrypt data with password-derived key', () => {
      const mockCipher = {
        update: vi.fn().mockReturnValue('encrypted-data'),
        final: vi.fn().mockReturnValue(''),
      };

      mockCrypto.createCipher.mockReturnValue(mockCipher);

      const result = encryptionService.encryptWithPassword('sensitive-data', 'password123');

      expect(result).toEqual({
        success: true,
        encrypted: 'encrypted-data',
        salt: expect.any(String),
      });

      expect(mockCrypto.pbkdf2Sync).toHaveBeenCalled();
      expect(mockCrypto.createCipher).toHaveBeenCalled();
    });

    it('should validate password strength', () => {
      const result = encryptionService.encryptWithPassword('data', '123');

      expect(result).toEqual({
        success: false,
        error: 'Password must be at least 8 characters long',
      });
    });
  });

  describe('decryptWithPassword', () => {
    it('should decrypt data with password and salt', () => {
      const mockDecipher = {
        update: vi.fn().mockReturnValue('decrypted-data'),
        final: vi.fn().mockReturnValue(''),
      };

      mockCrypto.createDecipher.mockReturnValue(mockDecipher);

      const result = encryptionService.decryptWithPassword(
        'encrypted-data',
        'password123',
        'salt-value',
      );

      expect(result).toEqual({
        success: true,
        decrypted: 'decrypted-data',
      });

      expect(mockCrypto.pbkdf2Sync).toHaveBeenCalledWith(
        'password123',
        'salt-value',
        expect.any(Number),
        expect.any(Number),
        'sha256',
      );
    });

    it('should handle wrong password gracefully', () => {
      const mockDecipher = {
        update: vi.fn().mockImplementation(() => {
          throw new Error('Bad decrypt');
        }),
        final: vi.fn(),
      };

      mockCrypto.createDecipher.mockReturnValue(mockDecipher);

      const result = encryptionService.decryptWithPassword(
        'encrypted-data',
        'wrong-password',
        'salt-value',
      );

      expect(result).toEqual({
        success: false,
        error: 'Invalid password or corrupted data',
      });
    });
  });

  describe('verifyHash', () => {
    it('should verify hash matches original data', () => {
      const originalData = 'test-data';
      const hash = 'expected-hash';

      // Mock hash generation to return the expected hash
      const mockHasher = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(hash),
      };
      mockCrypto.createHash.mockReturnValue(mockHasher);

      const result = encryptionService.verifyHash(originalData, hash);

      expect(result).toEqual({
        success: true,
        valid: true,
      });
    });

    it('should detect hash mismatch', () => {
      const originalData = 'test-data';
      const wrongHash = 'wrong-hash';

      const mockHasher = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('correct-hash'),
      };
      mockCrypto.createHash.mockReturnValue(mockHasher);

      const result = encryptionService.verifyHash(originalData, wrongHash);

      expect(result).toEqual({
        success: true,
        valid: false,
      });
    });
  });

  describe('secureCompare', () => {
    it('should perform timing-safe string comparison', () => {
      const str1 = 'secret-value';
      const str2 = 'secret-value';

      const result = encryptionService.secureCompare(str1, str2);

      expect(result).toBe(true);
    });

    it('should return false for different strings', () => {
      const str1 = 'secret-value';
      const str2 = 'different-value';

      const result = encryptionService.secureCompare(str1, str2);

      expect(result).toBe(false);
    });

    it('should handle different length strings', () => {
      const str1 = 'short';
      const str2 = 'much-longer-string';

      const result = encryptionService.secureCompare(str1, str2);

      expect(result).toBe(false);
    });
  });
});
