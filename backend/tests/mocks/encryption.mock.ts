import { vi } from 'vitest';

export const createMockEncryptionService = () => ({
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  encryptForStorage: vi.fn(),
  decryptFromStorage: vi.fn(),
  hash: vi.fn(),
  compareHash: vi.fn(),
  generateSalt: vi.fn(),
  generateKeyPair: vi.fn(),
  sign: vi.fn(),
  verify: vi.fn()
});

export const mockEncryptionMethods = (mockEncryptionService: ReturnType<typeof createMockEncryptionService>) => {
  // Basic encryption/decryption
  mockEncryptionService.encrypt.mockImplementation(async (plaintext: string) => {
    return Buffer.from(plaintext).toString('base64'); // Simple base64 for testing
  });
  
  mockEncryptionService.decrypt.mockImplementation(async (ciphertext: string) => {
    return Buffer.from(ciphertext, 'base64').toString('utf8');
  });
  
  // Storage encryption (adds prefix/suffix for identification)
  mockEncryptionService.encryptForStorage.mockImplementation((plaintext: string) => {
    return `encrypted:${Buffer.from(plaintext).toString('base64')}:storage`;
  });
  
  mockEncryptionService.decryptFromStorage.mockImplementation((ciphertext: string) => {
    if (ciphertext.startsWith('encrypted:') && ciphertext.endsWith(':storage')) {
      const base64Data = ciphertext.slice(10, -8); // Remove prefix and suffix
      return Buffer.from(base64Data, 'base64').toString('utf8');
    }
    throw new Error('Invalid encrypted storage format');
  });
  
  // Hashing
  mockEncryptionService.hash.mockImplementation(async (data: string, salt?: string) => {
    const actualSalt = salt || 'test-salt';
    return `hashed:${data}:${actualSalt}`;
  });
  
  mockEncryptionService.compareHash.mockImplementation(async (data: string, hash: string) => {
    const expectedHash = await mockEncryptionService.hash(data, 'test-salt');
    return hash === expectedHash;
  });
  
  mockEncryptionService.generateSalt.mockImplementation(() => {
    return 'test-salt-' + Math.random().toString(36).substr(2, 9);
  });
  
  // Digital signatures (simplified for testing)
  const testKeyPair = {
    publicKey: 'test-public-key',
    privateKey: 'test-private-key'
  };
  
  mockEncryptionService.generateKeyPair.mockResolvedValue(testKeyPair);
  
  mockEncryptionService.sign.mockImplementation(async (data: string, privateKey: string) => {
    if (privateKey !== testKeyPair.privateKey) {
      throw new Error('Invalid private key');
    }
    return `signature:${data}:${privateKey}`;
  });
  
  mockEncryptionService.verify.mockImplementation(async (data: string, signature: string, publicKey: string) => {
    if (publicKey !== testKeyPair.publicKey) {
      return false;
    }
    const expectedSignature = `signature:${data}:${testKeyPair.privateKey}`;
    return signature === expectedSignature;
  });
};

export const mockEncryptionErrors = (mockEncryptionService: ReturnType<typeof createMockEncryptionService>) => {
  const originalDecrypt = mockEncryptionService.decrypt;
  const originalDecryptFromStorage = mockEncryptionService.decryptFromStorage;
  
  mockEncryptionService.decrypt.mockImplementation(async (ciphertext: string) => {
    if (ciphertext === 'invalid-cipher') {
      throw new Error('Decryption failed: Invalid ciphertext');
    }
    return originalDecrypt(ciphertext);
  });
  
  mockEncryptionService.decryptFromStorage.mockImplementation((ciphertext: string) => {
    if (ciphertext === 'corrupted-storage-data') {
      throw new Error('Decryption failed: Corrupted storage data');
    }
    return originalDecryptFromStorage(ciphertext);
  });
};

export const mockJWTService = () => ({
  generateToken: vi.fn(),
  verifyToken: vi.fn(),
  refreshToken: vi.fn(),
  generateAccessToken: vi.fn(),
  generateRefreshToken: vi.fn(),
  extractTokenFromHeader: vi.fn()
});

export const mockJWTMethods = (mockJWTService: ReturnType<typeof mockJWTService>) => {
  const testPayload = { userId: 'test-user-id', role: 'user' };
  const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-payload.test-signature';
  
  mockJWTService.generateToken.mockImplementation(async (payload: any, expiresIn: string = '1h') => {
    return `${testToken}.${expiresIn}`;
  });
  
  mockJWTService.verifyToken.mockImplementation(async (token: string) => {
    if (token.startsWith(testToken)) {
      return testPayload;
    }
    throw new Error('Invalid token');
  });
  
  mockJWTService.generateAccessToken.mockImplementation(async (payload: any) => {
    return mockJWTService.generateToken(payload, '15m');
  });
  
  mockJWTService.generateRefreshToken.mockImplementation(async (payload: any) => {
    return mockJWTService.generateToken(payload, '7d');
  });
  
  mockJWTService.refreshToken.mockImplementation(async (refreshToken: string) => {
    const payload = await mockJWTService.verifyToken(refreshToken);
    const newAccessToken = await mockJWTService.generateAccessToken(payload);
    const newRefreshToken = await mockJWTService.generateRefreshToken(payload);
    
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  });
  
  mockJWTService.extractTokenFromHeader.mockImplementation((authHeader: string) => {
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  });
};