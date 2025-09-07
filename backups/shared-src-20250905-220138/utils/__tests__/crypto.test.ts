import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateToken, generateId } from '../crypto';

describe('Crypto Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'mySecurePassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'samePassword';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty password', async () => {
      const hash = await hashPassword('');
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(20);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'correctPassword';
      const wrongPassword = 'wrongPassword';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should handle empty password verification', async () => {
      const password = 'notEmpty';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate token of default length', () => {
      const token = generateToken();
      // Default 32 bytes = 64 hex characters
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate token of specified length', () => {
      const token16 = generateToken(16);
      const token64 = generateToken(64);

      expect(token16).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(token64).toHaveLength(128); // 64 bytes = 128 hex chars
    });

    it('should generate unique tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateToken());
      }

      expect(tokens.size).toBe(100);
    });
  });

  describe('generateId', () => {
    it('should generate ID with default prefix', () => {
      const id = generateId();
      expect(id).toMatch(/^id_[a-z0-9]+$/);
      expect(id.length).toBeGreaterThan(3);
    });

    it('should generate ID with custom prefix', () => {
      const userId = generateId('user');
      const requestId = generateId('req');

      expect(userId).toMatch(/^user_[a-z0-9]+$/);
      expect(requestId).toMatch(/^req_[a-z0-9]+$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }

      expect(ids.size).toBe(100);
    });

    it('should handle empty prefix', () => {
      const id = generateId('');
      expect(id).toMatch(/^_[a-z0-9]+$/);
    });
  });
});
