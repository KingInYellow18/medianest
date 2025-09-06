import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidEmail,
  isValidUrl,
  isValidUuid,
  isValidPort,
  isValidIpAddress,
  sanitizeString,
  truncateString,
} from '../validation';

// Mock console for error testing
const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('Validation Utilities', () => {
  beforeEach(() => {
    consoleSpy.mockClear();
    consoleWarnSpy.mockClear();
  });
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

    it('should handle null and undefined inputs', () => {
      expect(isValidEmail(null as any)).toBe(false);
      expect(isValidEmail(undefined as any)).toBe(false);
      expect(isValidEmail({} as any)).toBe(false);
      expect(isValidEmail([] as any)).toBe(false);
      expect(isValidEmail(123 as any)).toBe(false);
    });

    it('should validate international email addresses', () => {
      expect(isValidEmail('user@münchen.de')).toBe(true); // Unicode domains accepted by basic regex
      expect(isValidEmail('test@xn--mnchen-3ya.de')).toBe(true); // Punycode version
    });

    it('should handle edge cases', () => {
      expect(isValidEmail('a@b.co')).toBe(true); // Minimum valid
      expect(
        isValidEmail(
          'very.long.email.address.that.might.exceed.normal.length@very.long.domain.name.com',
        ),
      ).toBe(true);
      expect(isValidEmail('user@sub.domain.example.com')).toBe(true);
    });

    it('should handle malicious inputs (basic regex behavior)', () => {
      expect(isValidEmail('<script>alert("xss")</script>@example.com')).toBe(true); // Basic regex allows this pattern
      expect(isValidEmail('user@example.com<script>')).toBe(true); // Basic regex allows this too
      expect(isValidEmail('user\x00@example.com')).toBe(true); // Null bytes pass basic regex
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

    it('should validate complex URLs', () => {
      expect(
        isValidUrl(
          'https://user:pass@example.com:8080/path/to/resource?param=value&other=123#section',
        ),
      ).toBe(true);
      expect(isValidUrl('http://192.168.1.1:3000/api/v1/users')).toBe(true);
      expect(isValidUrl('https://[::1]:8080/path')).toBe(true); // IPv6
    });

    it('should handle protocol validation', () => {
      expect(isValidUrl('javascript:void(0)')).toBe(false); // Blocked protocol
      expect(isValidUrl('data:text/plain;base64,SGVsbG8=')).toBe(false); // Data URLs blocked
      expect(isValidUrl('file:///etc/passwd')).toBe(false); // File protocol blocked
    });

    it('should handle type validation', () => {
      expect(isValidUrl(null as any)).toBe(false);
      expect(isValidUrl(undefined as any)).toBe(false);
      expect(isValidUrl(123 as any)).toBe(false);
      expect(isValidUrl({} as any)).toBe(false);
    });

    it('should handle malicious URLs', () => {
      expect(isValidUrl('https://evil.com@good.com')).toBe(true); // Valid but misleading
      expect(isValidUrl('https://192.168.1.1@example.com')).toBe(true); // Valid but suspicious
    });

    it('should validate international domains', () => {
      expect(isValidUrl('https://xn--nxasmq6b.xn--j6w193g')).toBe(true); // Punycode
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

    it('should validate UUID case insensitivity', () => {
      const uuid = '550E8400-E29B-41D4-A716-446655440000';
      expect(isValidUuid(uuid)).toBe(true);
      expect(isValidUuid(uuid.toLowerCase())).toBe(true);
      expect(isValidUuid(uuid.toUpperCase())).toBe(true);
    });

    it('should handle different UUID versions', () => {
      expect(isValidUuid('00000000-0000-1000-8000-000000000000')).toBe(true); // v1
      expect(isValidUuid('00000000-0000-2000-8000-000000000000')).toBe(true); // v2
      expect(isValidUuid('00000000-0000-3000-8000-000000000000')).toBe(true); // v3
      expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true); // v4
      expect(isValidUuid('00000000-0000-5000-8000-000000000000')).toBe(true); // v5
    });

    it('should handle type validation', () => {
      expect(isValidUuid(null as any)).toBe(false);
      expect(isValidUuid(undefined as any)).toBe(false);
      expect(isValidUuid(123 as any)).toBe(false);
      expect(isValidUuid({} as any)).toBe(false);
      expect(isValidUuid([] as any)).toBe(false);
    });

    it('should handle malformed UUIDs', () => {
      expect(isValidUuid('550e8400-e29b-41d4-a716-44665544000')).toBe(false); // Too short
      expect(isValidUuid('550e8400-e29b-41d4-a716-4466554400000')).toBe(false); // Too long
      expect(isValidUuid('550e8400_e29b_41d4_a716_446655440000')).toBe(false); // Wrong separator
    });

    it('should handle edge cases with special characters', () => {
      expect(isValidUuid('550e8400-e29b-41d4-a716-44665544000\x00')).toBe(false);
      expect(isValidUuid('550e8400-e29b-41d4-a716-44665544000\n')).toBe(false);
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

    it('should handle well-known ports', () => {
      expect(isValidPort(21)).toBe(true); // FTP
      expect(isValidPort(22)).toBe(true); // SSH
      expect(isValidPort(25)).toBe(true); // SMTP
      expect(isValidPort(53)).toBe(true); // DNS
      expect(isValidPort(80)).toBe(true); // HTTP
      expect(isValidPort(443)).toBe(true); // HTTPS
      expect(isValidPort(993)).toBe(true); // IMAPS
      expect(isValidPort(995)).toBe(true); // POP3S
    });

    it('should handle type coercion issues', () => {
      expect(isValidPort('80' as any)).toBe(false); // String numbers rejected
      expect(isValidPort(80.5)).toBe(false); // Floats rejected
      expect(isValidPort(null as any)).toBe(false);
      expect(isValidPort(undefined as any)).toBe(false);
      expect(isValidPort(Infinity)).toBe(false);
      expect(isValidPort(-Infinity)).toBe(false);
    });

    it('should validate edge boundary cases', () => {
      expect(isValidPort(1)).toBe(true); // Minimum valid port
      expect(isValidPort(65535)).toBe(true); // Maximum valid port
      expect(isValidPort(65534)).toBe(true); // Just under max
      expect(isValidPort(2)).toBe(true); // Just above min
    });

    it('should handle performance with large numbers', () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        isValidPort(Math.floor(Math.random() * 70000));
      }
      const end = performance.now();
      expect(end - start).toBeLessThan(100); // Should be fast
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

    it('should validate special IPv4 addresses', () => {
      expect(isValidIpAddress('0.0.0.0')).toBe(true); // Any address
      expect(isValidIpAddress('127.0.0.1')).toBe(true); // Loopback
      expect(isValidIpAddress('169.254.1.1')).toBe(true); // Link-local
      expect(isValidIpAddress('224.0.0.1')).toBe(true); // Multicast
      expect(isValidIpAddress('255.255.255.255')).toBe(true); // Broadcast
    });

    it('should validate special IPv6 addresses', () => {
      expect(isValidIpAddress('::')).toBe(true); // All zeros
      expect(isValidIpAddress('::1')).toBe(true); // Loopback
      expect(isValidIpAddress('fe80::1')).toBe(true); // Link-local
      expect(isValidIpAddress('ff02::1')).toBe(true); // Multicast
      expect(isValidIpAddress('2001:db8::8a2e:370:7334')).toBe(true); // Documentation
    });

    it('should handle IPv6 with embedded IPv4', () => {
      expect(isValidIpAddress('::ffff:192.168.1.1')).toBe(true); // IPv4-mapped
      expect(isValidIpAddress('2001:db8::192.168.1.1')).toBe(true); // IPv4-embedded
    });

    it('should handle type validation', () => {
      expect(isValidIpAddress(null as any)).toBe(false);
      expect(isValidIpAddress(undefined as any)).toBe(false);
      expect(isValidIpAddress(123 as any)).toBe(false);
      expect(isValidIpAddress({} as any)).toBe(false);
    });

    it('should handle malformed IP addresses', () => {
      expect(isValidIpAddress('192.168.001.1')).toBe(true); // Leading zeros allowed
      expect(isValidIpAddress('192.168.-1.1')).toBe(false); // Negative numbers
      expect(isValidIpAddress('192.168.1.1.1')).toBe(false); // Too many octets
      expect(isValidIpAddress('192.168.256.1')).toBe(false); // Out of range
    });

    it('should handle performance with large inputs', () => {
      const longString = 'a'.repeat(1000);
      const start = performance.now();
      expect(isValidIpAddress(longString)).toBe(false);
      const end = performance.now();
      expect(end - start).toBeLessThan(10); // Should fail fast
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

    it('should handle type validation', () => {
      expect(sanitizeString(null as any)).toBe('');
      expect(sanitizeString(undefined as any)).toBe('');
      expect(sanitizeString(123 as any)).toBe('');
      expect(sanitizeString({} as any)).toBe('');
      expect(sanitizeString([] as any)).toBe('');
    });

    it('should handle malicious script injection attempts', () => {
      expect(sanitizeString('<script>document.cookie</script>')).toBe('');
      expect(sanitizeString('<img src="x" onerror="alert(1)">')).toBe('');
      expect(sanitizeString('<svg onload="alert(1)"></svg>')).toBe('');
      expect(sanitizeString('<iframe src="javascript:alert(1)"></iframe>')).toBe('');
    });

    it('should handle nested script tags', () => {
      expect(sanitizeString('<script><script>alert("nested")</script></script>')).toBe('');
      expect(sanitizeString('<div><script>alert("nested")</script>content</div>')).toBe('content');
    });

    it('should preserve safe content while removing tags', () => {
      expect(sanitizeString('<h1>Title</h1><p>Content with <em>emphasis</em></p>')).toBe(
        'TitleContent with emphasis',
      );
      expect(sanitizeString('<div>Safe content <span>with</span> nested tags</div>')).toBe(
        'Safe content with nested tags',
      );
    });

    it('should handle malformed HTML', () => {
      expect(sanitizeString('<div>Unclosed tag')).toBe('Unclosed tag');
      expect(sanitizeString('Text <b>bold text')).toBe('Text bold text');
      expect(sanitizeString('<<script>>alert("test")<</script>>')).toBe(''); // Script content gets removed
    });

    it('should handle mixed content types', () => {
      expect(sanitizeString('Text <script>evil</script> more text <b>bold</b>')).toBe(
        'Text more text bold',
      );
      expect(sanitizeString('   <p>  Text with   spaces  </p>   ')).toBe('Text with spaces');
    });

    it('should handle unicode and special characters', () => {
      expect(sanitizeString('Hello 🌟 <b>world</b> 你好')).toBe('Hello 🌟 world 你好');
      expect(sanitizeString('<p>Test with &amp; entities &lt;</p>')).toBe(
        'Test with &amp; entities &lt;',
      );
    });

    it('should handle performance with large inputs', () => {
      const largeInput =
        '<div>' + 'x'.repeat(10000) + '</div>' + '<script>alert("test")</script>'.repeat(100);
      const start = performance.now();
      const result = sanitizeString(largeInput);
      const end = performance.now();
      expect(result).toBe('x'.repeat(10000));
      expect(end - start).toBeLessThan(100); // Should be reasonably fast
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

    it('should handle type validation', () => {
      expect(truncateString(null as any, 10)).toBe('');
      expect(truncateString(undefined as any, 10)).toBe('');
      expect(truncateString(123 as any, 10)).toBe('');
      expect(truncateString({} as any, 10)).toBe('');
      expect(truncateString([] as any, 10)).toBe('');
    });

    it('should handle trailing whitespace correctly', () => {
      expect(truncateString('Hello world   ', 8)).toBe('Hello wo...');
      expect(truncateString('Test text    ', 9)).toBe('Test text...');
      expect(truncateString('   Spaces   ', 6)).toBe('   Spa...');
    });

    it('should handle unicode characters', () => {
      expect(truncateString('Hello 🌟 world', 8)).toBe('Hello 🌟...');
      expect(truncateString('测试中文字符串', 4)).toBe('测试中文...');
      expect(truncateString('Café résumé naïve', 10)).toBe('Café r\u00e9sum...');
    });

    it('should handle different suffix lengths', () => {
      expect(truncateString('Long string for testing', 10, '')).toBe('Long strin');
      expect(truncateString('Long string for testing', 10, ' (continued)')).toBe(
        'Long strin (continued)',
      );
      expect(truncateString('Short', 10, ' [very long suffix that is longer than content]')).toBe(
        'Short',
      );
    });

    it('should handle very short max lengths', () => {
      expect(truncateString('Hello', 1)).toBe('H...');
      expect(truncateString('Hello', 2)).toBe('He...');
      expect(truncateString('Hello', 3)).toBe('Hel...');
    });

    it('should handle equal length strings', () => {
      expect(truncateString('Hello', 5)).toBe('Hello');
      expect(truncateString('Test!', 5)).toBe('Test!');
    });

    it('should handle performance with large strings', () => {
      const largeString = 'x'.repeat(100000);
      const start = performance.now();
      const result = truncateString(largeString, 100);
      const end = performance.now();
      expect(result).toBe('x'.repeat(100) + '...');
      expect(end - start).toBeLessThan(10); // Should be very fast
    });

    it('should handle newlines and tabs', () => {
      expect(truncateString('Hello\nworld\ttab', 10)).toBe('Hello\nworl...');
      expect(truncateString('Multi\n\nline\ttext', 8)).toBe('Multi\n\nl...');
    });
  });

  // Performance and stress testing
  describe('Performance and Stress Tests', () => {
    it('should handle validation performance under load', () => {
      const testEmails = [
        'test@example.com',
        'invalid.email',
        'user+tag@domain.co.uk',
        '@missing-local.com',
        'no-domain@',
      ];

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        const email = testEmails[i % testEmails.length];
        isValidEmail(email);
      }
      const end = performance.now();

      expect(end - start).toBeLessThan(1000); // Should complete in under 1s
    });

    it('should handle large data validation gracefully', () => {
      const largeString = 'a'.repeat(100000);
      const veryLongEmail = 'a'.repeat(1000) + '@' + 'b'.repeat(1000) + '.com';

      expect(() => sanitizeString(largeString)).not.toThrow();
      expect(() => isValidEmail(veryLongEmail)).not.toThrow();
      expect(() => truncateString(largeString, 100)).not.toThrow();
    });
  });

  // Integration tests with shared error handling
  describe('Error Handling Integration', () => {
    it('should handle validation with shared error patterns', () => {
      // Test with various error-prone inputs that might come from external sources
      const problematicInputs = [
        null,
        undefined,
        '',
        '   ',
        '<script>alert("xss")</script>',
        '\x00\x01\x02',
        '🤖👨‍💻🔒', // emojis
        'a'.repeat(10000), // very long
      ];

      problematicInputs.forEach((input) => {
        expect(() => {
          isValidEmail(input as any);
          isValidUrl(input as any);
          isValidUuid(input as any);
          isValidIpAddress(input as any);
          sanitizeString(input as any);
          truncateString(input as any, 10);
        }).not.toThrow();
      });
    });

    it('should maintain consistent behavior across all validators', () => {
      const testCases = [null, undefined, '', {}, [], 123, true];

      testCases.forEach((testCase) => {
        // All string validators should return false for non-string inputs
        expect(isValidEmail(testCase as any)).toBe(false);
        expect(isValidUrl(testCase as any)).toBe(false);
        expect(isValidUuid(testCase as any)).toBe(false);
        expect(isValidIpAddress(testCase as any)).toBe(false);

        // Sanitizers should return empty string for invalid inputs
        expect(sanitizeString(testCase as any)).toBe('');
        expect(truncateString(testCase as any, 10)).toBe('');
      });
    });
  });
});
