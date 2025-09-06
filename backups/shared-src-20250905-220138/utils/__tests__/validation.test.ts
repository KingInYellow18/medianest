import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidUrl,
  isValidUuid,
  isValidPort,
  isValidIpAddress,
  sanitizeString,
  truncateString,
} from '../validation';

describe('Validation Utilities', () => {
  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
      expect(isValidEmail('123@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user @example.com')).toBe(false);
      expect(isValidEmail('user@example')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('https://sub.domain.com/path?query=value')).toBe(true);
      expect(isValidUrl('ftp://files.example.com')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('invalid')).toBe(false);
      expect(isValidUrl('http://')).toBe(false);
      expect(isValidUrl('//example.com')).toBe(false);
      expect(isValidUrl('example.com')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('isValidUuid', () => {
    it('should validate correct UUIDs', () => {
      expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUuid('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
      expect(isValidUuid('00000000-0000-0000-0000-000000000000')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUuid('invalid')).toBe(false);
      expect(isValidUuid('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidUuid('550e8400e29b41d4a716446655440000')).toBe(false);
      expect(isValidUuid('GGGGGGGG-GGGG-GGGG-GGGG-GGGGGGGGGGGG')).toBe(false);
      expect(isValidUuid('')).toBe(false);
    });
  });

  describe('isValidPort', () => {
    it('should validate correct port numbers', () => {
      expect(isValidPort(80)).toBe(true);
      expect(isValidPort(443)).toBe(true);
      expect(isValidPort(3000)).toBe(true);
      expect(isValidPort(8080)).toBe(true);
      expect(isValidPort(65535)).toBe(true);
    });

    it('should reject invalid port numbers', () => {
      expect(isValidPort(0)).toBe(false);
      expect(isValidPort(-1)).toBe(false);
      expect(isValidPort(65536)).toBe(false);
      expect(isValidPort(100000)).toBe(false);
      expect(isValidPort(NaN)).toBe(false);
    });
  });

  describe('isValidIpAddress', () => {
    it('should validate IPv4 addresses', () => {
      expect(isValidIpAddress('192.168.1.1')).toBe(true);
      expect(isValidIpAddress('10.0.0.0')).toBe(true);
      expect(isValidIpAddress('255.255.255.255')).toBe(true);
      expect(isValidIpAddress('127.0.0.1')).toBe(true);
    });

    it('should validate IPv6 addresses', () => {
      expect(isValidIpAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
      expect(isValidIpAddress('2001:db8:85a3::8a2e:370:7334')).toBe(true);
      expect(isValidIpAddress('::1')).toBe(true);
      expect(isValidIpAddress('::')).toBe(true);
    });

    it('should reject invalid IP addresses', () => {
      expect(isValidIpAddress('256.256.256.256')).toBe(false);
      expect(isValidIpAddress('192.168.1')).toBe(false);
      expect(isValidIpAddress('192.168.1.1.1')).toBe(false);
      expect(isValidIpAddress('invalid')).toBe(false);
      expect(isValidIpAddress('')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('');
      expect(sanitizeString('<p>Hello <b>World</b></p>')).toBe('Hello World');
      expect(sanitizeString('Normal text')).toBe('Normal text');
    });

    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
      expect(sanitizeString('\n\t text \n\t')).toBe('text');
    });

    it('should handle empty strings', () => {
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString('   ')).toBe('');
    });
  });

  describe('truncateString', () => {
    it('should truncate long strings', () => {
      const longString = 'This is a very long string that needs to be truncated';
      expect(truncateString(longString, 10)).toBe('This is a...');
      expect(truncateString(longString, 20)).toBe('This is a very long...');
    });

    it('should not truncate short strings', () => {
      expect(truncateString('Short', 10)).toBe('Short');
      expect(truncateString('Exact', 5)).toBe('Exact');
    });

    it('should handle custom suffix', () => {
      expect(truncateString('Long string', 8, '…')).toBe('Long str…');
      expect(truncateString('Long string', 8, ' [more]')).toBe('Long str [more]');
    });

    it('should handle edge cases', () => {
      expect(truncateString('', 10)).toBe('');
      expect(truncateString('abc', 0)).toBe('...');
      expect(truncateString('abc', -1)).toBe('...');
    });
  });
});
