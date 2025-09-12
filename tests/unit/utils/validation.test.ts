/**
 * VALIDATION UTILITIES UNIT TESTS
 *
 * Comprehensive tests for validation utilities covering:
 * - Input validation
 * - Data sanitization
 * - Schema validation
 * - Error handling
 */

import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateUsername,
  sanitizeInput,
  validatePagination,
  validateUUID,
  validatePlexId,
} from '../../../backend/src/utils/validation';
import { ValidationError } from '../../../backend/src/utils/errors';

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@medianest.com',
        'user.name+tag@example.com',
        'user123@domain-name.com',
        'first.last@subdomain.domain.com',
      ];

      validEmails.forEach((email) => {
        expect(() => validateEmail(email)).not.toThrow();
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        '',
        'invalid',
        'invalid@',
        '@invalid.com',
        'invalid.com',
        'invalid@.com',
        'invalid@com.',
        'user@domain..com',
        'user space@domain.com',
      ];

      invalidEmails.forEach((email) => {
        expect(() => validateEmail(email)).toThrow(ValidationError);
      });
    });

    it('should handle case sensitivity correctly', () => {
      expect(() => validateEmail('TEST@MEDIANEST.COM')).not.toThrow();
      expect(() => validateEmail('Test.User@Example.COM')).not.toThrow();
    });

    it('should reject emails that are too long', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(() => validateEmail(longEmail)).toThrow(ValidationError);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'StrongPassword123!',
        'MySecure@Pass1',
        'Complex$Password99',
        '8CharsPwd!',
      ];

      strongPasswords.forEach((password) => {
        expect(() => validatePassword(password)).not.toThrow();
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        '', // Empty
        '123', // Too short
        'password', // No uppercase, numbers, or special chars
        'PASSWORD', // No lowercase, numbers, or special chars
        '12345678', // No letters or special chars
        '!@#$%^&*', // No letters or numbers
        'Weak1', // Too short
        'NoNumbers!', // No numbers
        'nonumbers1', // No uppercase or special chars
      ];

      weakPasswords.forEach((password) => {
        expect(() => validatePassword(password)).toThrow(ValidationError);
      });
    });

    it('should provide specific error messages for different criteria', () => {
      expect(() => validatePassword('short')).toThrow('at least 8 characters');
      expect(() => validatePassword('nouppercase123!')).toThrow('uppercase letter');
      expect(() => validatePassword('NOLOWERCASE123!')).toThrow('lowercase letter');
      expect(() => validatePassword('NoNumbers!')).toThrow('number');
      expect(() => validatePassword('NoSpecialChars123')).toThrow('special character');
    });

    it('should reject passwords that are too long', () => {
      const longPassword = 'A1!' + 'a'.repeat(125);
      expect(() => validatePassword(longPassword)).toThrow(ValidationError);
    });
  });

  describe('validateUsername', () => {
    it('should validate correct usernames', () => {
      const validUsernames = [
        'user123',
        'test_user',
        'user-name',
        'TestUser',
        'u',
        'a'.repeat(30), // Max length
      ];

      validUsernames.forEach((username) => {
        expect(() => validateUsername(username)).not.toThrow();
      });
    });

    it('should reject invalid usernames', () => {
      const invalidUsernames = [
        '', // Empty
        'a'.repeat(31), // Too long
        'user@name', // Invalid character
        'user name', // Space
        'user!', // Special character
        '123user', // Starting with number
        '_user', // Starting with underscore
        '-user', // Starting with hyphen
        'user_', // Ending with underscore
        'user-', // Ending with hyphen
      ];

      invalidUsernames.forEach((username) => {
        expect(() => validateUsername(username)).toThrow(ValidationError);
      });
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize HTML and script tags', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello <b>World</b>';
      const sanitized = sanitizeInput(maliciousInput);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).toContain('Hello');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const sanitized = sanitizeInput(input);

      expect(sanitized).toBe('Hello World');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeInput(null)).toBe('');
      expect(sanitizeInput(undefined)).toBe('');
    });

    it('should preserve safe content', () => {
      const safeInput = 'This is safe content with numbers 123 and symbols: !@#$%';
      const sanitized = sanitizeInput(safeInput);

      expect(sanitized).toBe(safeInput);
    });

    it('should remove SQL injection attempts', () => {
      const sqlInjection = "'; DROP TABLE users; --";
      const sanitized = sanitizeInput(sqlInjection);

      expect(sanitized).not.toContain('DROP TABLE');
      expect(sanitized).not.toContain('--');
    });
  });

  describe('validatePagination', () => {
    it('should validate correct pagination parameters', () => {
      const validPagination = [
        { page: 1, limit: 10 },
        { page: 5, limit: 25 },
        { page: 100, limit: 100 },
      ];

      validPagination.forEach((params) => {
        expect(() => validatePagination(params)).not.toThrow();
      });
    });

    it('should reject invalid pagination parameters', () => {
      const invalidPagination = [
        { page: 0, limit: 10 }, // Page must be >= 1
        { page: -1, limit: 10 }, // Negative page
        { page: 1, limit: 0 }, // Limit must be >= 1
        { page: 1, limit: -5 }, // Negative limit
        { page: 1, limit: 1001 }, // Limit too high
        { page: 'abc', limit: 10 }, // Non-numeric page
        { page: 1, limit: 'xyz' }, // Non-numeric limit
      ];

      invalidPagination.forEach((params) => {
        expect(() => validatePagination(params as any)).toThrow(ValidationError);
      });
    });

    it('should use default values when parameters are missing', () => {
      const result1 = validatePagination({});
      expect(result1).toEqual({ page: 1, limit: 10 });

      const result2 = validatePagination({ page: 5 });
      expect(result2).toEqual({ page: 5, limit: 10 });

      const result3 = validatePagination({ limit: 25 });
      expect(result3).toEqual({ page: 1, limit: 25 });
    });

    it('should convert string numbers to integers', () => {
      const result = validatePagination({ page: '3', limit: '20' } as any);
      expect(result).toEqual({ page: 3, limit: 20 });
    });
  });

  describe('validateUUID', () => {
    it('should validate correct UUID formats', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        '01234567-89ab-cdef-0123-456789abcdef',
      ];

      validUUIDs.forEach((uuid) => {
        expect(() => validateUUID(uuid)).not.toThrow();
      });
    });

    it('should reject invalid UUID formats', () => {
      const invalidUUIDs = [
        '',
        'invalid-uuid',
        '123e4567-e89b-12d3-a456', // Too short
        '123e4567-e89b-12d3-a456-426614174000-extra', // Too long
        '123e4567e89b12d3a456426614174000', // No hyphens
        '123e4567-e89b-12d3-a456-42661417400g', // Invalid character
        'ZZZZZZZZ-e89b-12d3-a456-426614174000', // Invalid hex
      ];

      invalidUUIDs.forEach((uuid) => {
        expect(() => validateUUID(uuid)).toThrow(ValidationError);
      });
    });

    it('should handle null and undefined', () => {
      expect(() => validateUUID(null as any)).toThrow(ValidationError);
      expect(() => validateUUID(undefined as any)).toThrow(ValidationError);
    });
  });

  describe('validatePlexId', () => {
    it('should validate correct Plex ID formats', () => {
      const validPlexIds = [
        '12345',
        '9876543210',
        '0', // Single digit
        '999999999999999999', // Very long number
      ];

      validPlexIds.forEach((plexId) => {
        expect(() => validatePlexId(plexId)).not.toThrow();
      });
    });

    it('should reject invalid Plex ID formats', () => {
      const invalidPlexIds = ['', 'abc123', '123abc', '12.34', '12,34', ' 123 ', '-123', '+123'];

      invalidPlexIds.forEach((plexId) => {
        expect(() => validatePlexId(plexId)).toThrow(ValidationError);
      });
    });

    it('should handle null and undefined', () => {
      expect(() => validatePlexId(null as any)).toThrow(ValidationError);
      expect(() => validatePlexId(undefined as any)).toThrow(ValidationError);
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle extremely long inputs gracefully', () => {
      const veryLongString = 'a'.repeat(10000);

      expect(() => validateEmail(veryLongString + '@example.com')).toThrow(ValidationError);
      expect(() => validatePassword(veryLongString)).toThrow(ValidationError);
      expect(() => validateUsername(veryLongString)).toThrow(ValidationError);
    });

    it('should sanitize Unicode and special characters properly', () => {
      const unicodeInput = 'Hello 👋 World 🌍 with émojis';
      const sanitized = sanitizeInput(unicodeInput);

      expect(sanitized).toContain('Hello');
      expect(sanitized).toContain('World');
    });

    it('should handle different types of XSS attempts', () => {
      const xssAttempts = [
        '<img src=x onerror=alert(1)>',
        'javascript:alert(1)',
        '<svg onload=alert(1)>',
        '<iframe src=javascript:alert(1)></iframe>',
        '<object data=javascript:alert(1)>',
        '<embed src=javascript:alert(1)>',
      ];

      xssAttempts.forEach((attempt) => {
        const sanitized = sanitizeInput(attempt);
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('onload');
      });
    });

    it('should validate complex email edge cases', () => {
      const edgeCaseEmails = [
        'user+tag@example.com', // Plus addressing
        'user.name@example.com', // Dots in local part
        '1234567890@example.com', // Numeric local part
        'user@sub.domain.example.com', // Multiple subdomains
        'user@192.168.1.1', // IP address domain (should be rejected)
      ];

      // Most should pass
      expect(() => validateEmail(edgeCaseEmails[0])).not.toThrow();
      expect(() => validateEmail(edgeCaseEmails[1])).not.toThrow();
      expect(() => validateEmail(edgeCaseEmails[2])).not.toThrow();
      expect(() => validateEmail(edgeCaseEmails[3])).not.toThrow();

      // IP addresses should be rejected for this application
      expect(() => validateEmail(edgeCaseEmails[4])).toThrow(ValidationError);
    });
  });
});
