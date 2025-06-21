import { 
  validateEmail, 
  validatePassword, 
  formatUserName, 
  isTokenExpired,
  clearAuthData,
  getStoredToken 
} from '../authService';

// Mock localStorage for testing
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

describe('authService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('validateEmail', () => {
    it('validates correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('rejects invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user..name@example.com',
        'user@.com',
        '',
        null,
        undefined
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });

    it('handles edge cases', () => {
      expect(validateEmail('a@b.c')).toBe(true); // Minimal valid email
      expect(validateEmail('user@domain')).toBe(false); // Missing TLD
      expect(validateEmail('user name@example.com')).toBe(false); // Space in local part
    });
  });

  describe('validatePassword', () => {
    it('validates strong passwords', () => {
      const strongPasswords = [
        'Password123!',
        'MyStr0ng@Pass',
        'C0mplex#Password',
        'Secure$Pass1'
      ];

      strongPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(true);
      });
    });

    it('rejects weak passwords', () => {
      const weakPasswords = [
        'password', // No uppercase, numbers, or special chars
        'PASSWORD', // No lowercase, numbers, or special chars
        '12345678', // No letters or special chars
        'Pass1', // Too short
        'Password1', // No special characters
        '', // Empty
        null,
        undefined
      ];

      weakPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(false);
      });
    });

    it('enforces minimum length requirement', () => {
      expect(validatePassword('Pass1!')).toBe(false); // 6 chars, too short
      expect(validatePassword('Pass12!')).toBe(false); // 7 chars, still too short
      expect(validatePassword('Pass123!')).toBe(true); // 8 chars, meets requirement
    });
  });

  describe('formatUserName', () => {
    it('formats names correctly', () => {
      expect(formatUserName('john doe')).toBe('John Doe');
      expect(formatUserName('JANE SMITH')).toBe('Jane Smith');
      expect(formatUserName('bob johnson')).toBe('Bob Johnson');
      expect(formatUserName('mary-jane watson')).toBe('Mary-jane Watson');
    });

    it('handles edge cases', () => {
      expect(formatUserName('')).toBe('');
      expect(formatUserName('   ')).toBe('');
      expect(formatUserName('john')).toBe('John');
      expect(formatUserName('  john  doe  ')).toBe('John Doe');
    });

    it('handles null and undefined', () => {
      expect(formatUserName(null)).toBe('');
      expect(formatUserName(undefined)).toBe('');
    });
  });

  describe('isTokenExpired', () => {
    it('correctly identifies expired tokens', () => {
      const expiredToken = {
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      };
      expect(isTokenExpired(expiredToken)).toBe(true);
    });

    it('correctly identifies valid tokens', () => {
      const validToken = {
        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      };
      expect(isTokenExpired(validToken)).toBe(false);
    });

    it('handles tokens without expiration', () => {
      const tokenWithoutExp = { userId: '123' };
      expect(isTokenExpired(tokenWithoutExp)).toBe(true); // Should be considered expired
    });

    it('handles invalid token formats', () => {
      expect(isTokenExpired(null)).toBe(true);
      expect(isTokenExpired(undefined)).toBe(true);
      expect(isTokenExpired('')).toBe(true);
      expect(isTokenExpired({})).toBe(true);
    });
  });

  describe('clearAuthData', () => {
    it('removes all auth-related items from localStorage', () => {
      clearAuthData();

      expect(localStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(localStorage.removeItem).toHaveBeenCalledWith('refreshToken');
      expect(localStorage.removeItem).toHaveBeenCalledWith('userProfile');
      expect(localStorage.removeItem).toHaveBeenCalledTimes(3);
    });
  });

  describe('getStoredToken', () => {
    it('returns token from localStorage', () => {
      const mockToken = 'mock-jwt-token';
      localStorage.getItem.mockReturnValue(mockToken);

      const result = getStoredToken();

      expect(localStorage.getItem).toHaveBeenCalledWith('authToken');
      expect(result).toBe(mockToken);
    });

    it('returns null when no token is stored', () => {
      localStorage.getItem.mockReturnValue(null);

      const result = getStoredToken();

      expect(localStorage.getItem).toHaveBeenCalledWith('authToken');
      expect(result).toBeNull();
    });

    it('handles localStorage errors gracefully', () => {
      localStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      const result = getStoredToken();

      expect(result).toBeNull();
    });
  });
});

// Integration-style tests
describe('authService integration', () => {
  it('validates complete user registration data', () => {
    const userData = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      name: 'john doe'
    };

    expect(validateEmail(userData.email)).toBe(true);
    expect(validatePassword(userData.password)).toBe(true);
    expect(formatUserName(userData.name)).toBe('John Doe');
  });

  it('handles authentication flow', () => {
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    
    // Mock storing token
    localStorage.setItem('authToken', mockToken);
    localStorage.getItem.mockReturnValue(mockToken);

    // Verify token retrieval
    expect(getStoredToken()).toBe(mockToken);

    // Clear auth data
    clearAuthData();
    expect(localStorage.removeItem).toHaveBeenCalledWith('authToken');
  });
});