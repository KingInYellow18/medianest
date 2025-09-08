import { describe, it, expect, vi, beforeEach } from 'vitest';
import PlexProvider, {
  createPlexPin,
  checkPlexPin,
  getPlexHeaders,
  type PlexProfile,
  type PlexPinResponse,
} from '../../../lib/auth/plex-provider';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('PlexProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create plex provider with default options', () => {
    const provider = PlexProvider({});

    expect(provider.id).toBe('plex');
    expect(provider.name).toBe('Plex');
    expect(provider.type).toBe('oauth');
    expect(provider.version).toBe('2.0');
    expect(provider.authorization.url).toBe('https://app.plex.tv/auth#');
  });

  it('should create plex provider with custom options', () => {
    const customOptions = {
      clientIdentifier: 'custom-client-id',
      product: 'CustomProduct',
      device: 'CustomDevice',
      deviceName: 'Custom Device Name',
      platform: 'CustomPlatform',
      platformVersion: '2.0',
      version: '2.0.0',
    };

    const provider = PlexProvider(customOptions);

    expect(provider.authorization.params.clientID).toBe('custom-client-id');
    expect(provider.authorization.params.context.device.product).toBe('CustomProduct');
    expect(provider.authorization.params.context.device.device).toBe('CustomDevice');
    expect(provider.authorization.params.context.device.deviceName).toBe('Custom Device Name');
    expect(provider.authorization.params.context.device.platform).toBe('CustomPlatform');
    expect(provider.authorization.params.context.device.platformVersion).toBe('2.0');
    expect(provider.authorization.params.context.device.version).toBe('2.0.0');
  });

  it('should generate client identifier when not provided', () => {
    const provider1 = PlexProvider({});
    const provider2 = PlexProvider({});

    const clientId1 = provider1.authorization.params.clientID;
    const clientId2 = provider2.authorization.params.clientID;

    expect(clientId1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(clientId2).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(clientId1).not.toBe(clientId2);
  });

  it('should have correct authorization configuration', () => {
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    const provider = PlexProvider({});

    expect(provider.authorization.params.forwardUrl).toBe(
      'http://localhost:3000/api/auth/callback/plex'
    );
    expect(provider.authorization.params.code).toBe('will-be-generated');
  });

  it('should have correct token configuration', async () => {
    const provider = PlexProvider({});

    expect(provider.token.url).toBe('https://plex.tv/api/v2/pins/{pinId}');

    // Test that token request throws custom implementation error
    await expect(() =>
      provider.token.request({
        client: {} as any,
        params: {} as any,
        checks: {} as any,
        provider: {} as any,
      })
    ).rejects.toThrow('Plex PIN auth requires custom implementation');
  });

  it('should fetch user info correctly', async () => {
    const mockUserData = {
      id: '12345',
      username: 'testuser',
      email: 'test@example.com',
      thumb: 'https://example.com/thumb.jpg',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockUserData),
    });

    const provider = PlexProvider({ clientIdentifier: 'test-client' });
    const tokens = { authToken: 'test-token' };

    const result = await provider.userinfo.request({ client: {} as any, tokens });

    expect(mockFetch).toHaveBeenCalledWith('https://plex.tv/api/v2/user', {
      headers: {
        'X-Plex-Token': 'test-token',
        'X-Plex-Client-Identifier': 'test-client',
        'X-Plex-Product': 'MediaNest',
        'X-Plex-Version': '1.0.0',
        'X-Plex-Platform': 'Web',
        'X-Plex-Platform-Version': '1.0',
        'X-Plex-Device': 'Web',
        'X-Plex-Device-Name': 'MediaNest Web',
        Accept: 'application/json',
      },
    });

    expect(result).toEqual(mockUserData);
  });

  it('should handle failed user info request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const provider = PlexProvider({});
    const tokens = { authToken: 'invalid-token' };

    await expect(provider.userinfo.request({ client: {} as any, tokens })).rejects.toThrow(
      'Failed to fetch Plex user info'
    );
  });

  it('should transform profile correctly', () => {
    const provider = PlexProvider({});
    const profile: PlexProfile = {
      id: '12345',
      uuid: 'uuid-12345',
      username: 'testuser',
      email: 'test@example.com',
      thumb: 'https://example.com/thumb.jpg',
      title: 'Test User',
      hasPassword: true,
      authToken: 'auth-token',
      subscription: {
        active: true,
        status: 'active',
        plan: 'premium',
      },
    };

    const result = provider.profile(profile);

    expect(result).toEqual({
      id: '12345',
      name: 'testuser',
      email: 'test@example.com',
      image: 'https://example.com/thumb.jpg',
      role: 'USER',
    });
  });

  it('should have correct styling configuration', () => {
    const provider = PlexProvider({});

    expect(provider.style).toEqual({
      logo: '/plex-logo.svg',
      bg: '#282a2d',
      text: '#fff',
      bgDark: '#1f2022',
      textDark: '#fff',
    });
  });
});

describe('createPlexPin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create plex pin successfully', async () => {
    const mockPinResponse: PlexPinResponse = {
      id: 123456,
      code: 'ABCD',
      product: 'MediaNest',
      trusted: false,
      expiresIn: 1800,
      createdAt: '2023-01-01T00:00:00Z',
      expiresAt: '2023-01-01T00:30:00Z',
      clientIdentifier: 'test-client',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPinResponse),
    });

    const headers = { 'X-Plex-Product': 'MediaNest' };
    const result = await createPlexPin('test-client', headers);

    expect(mockFetch).toHaveBeenCalledWith('https://plex.tv/api/v2/pins', {
      method: 'POST',
      headers: {
        'X-Plex-Product': 'MediaNest',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        strong: true,
        'X-Plex-Client-Identifier': 'test-client',
      }),
    });

    expect(result).toEqual(mockPinResponse);
  });

  it('should handle failed pin creation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
    });

    const headers = { 'X-Plex-Product': 'MediaNest' };

    await expect(createPlexPin('test-client', headers)).rejects.toThrow(
      'Failed to create Plex PIN'
    );
  });
});

describe('checkPlexPin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check plex pin status successfully', async () => {
    const mockPinResponse: PlexPinResponse = {
      id: 123456,
      code: 'ABCD',
      product: 'MediaNest',
      trusted: true,
      expiresIn: 1800,
      createdAt: '2023-01-01T00:00:00Z',
      expiresAt: '2023-01-01T00:30:00Z',
      authToken: 'auth-token-123',
      clientIdentifier: 'test-client',
      username: 'testuser',
      email: 'test@example.com',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPinResponse),
    });

    const headers = { 'X-Plex-Product': 'MediaNest' };
    const result = await checkPlexPin(123456, 'test-client', headers);

    expect(mockFetch).toHaveBeenCalledWith('https://plex.tv/api/v2/pins/123456', {
      headers: {
        'X-Plex-Product': 'MediaNest',
        Accept: 'application/json',
      },
    });

    expect(result).toEqual(mockPinResponse);
  });

  it('should handle failed pin check', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const headers = { 'X-Plex-Product': 'MediaNest' };

    await expect(checkPlexPin(123456, 'test-client', headers)).rejects.toThrow(
      'Failed to check Plex PIN status'
    );
  });
});

describe('getPlexHeaders', () => {
  it('should generate correct headers with default values', () => {
    const headers = getPlexHeaders('test-client');

    expect(headers).toEqual({
      'X-Plex-Client-Identifier': 'test-client',
      'X-Plex-Product': 'MediaNest',
      'X-Plex-Version': '1.0.0',
      'X-Plex-Platform': 'Web',
      'X-Plex-Platform-Version': '1.0',
      'X-Plex-Device': 'Web',
      'X-Plex-Device-Name': 'MediaNest Web',
    });
  });

  it('should generate correct headers with custom values', () => {
    const headers = getPlexHeaders(
      'custom-client',
      'CustomProduct',
      '2.0.0',
      'CustomPlatform',
      '2.0',
      'CustomDevice',
      'Custom Device Name'
    );

    expect(headers).toEqual({
      'X-Plex-Client-Identifier': 'custom-client',
      'X-Plex-Product': 'CustomProduct',
      'X-Plex-Version': '2.0.0',
      'X-Plex-Platform': 'CustomPlatform',
      'X-Plex-Platform-Version': '2.0',
      'X-Plex-Device': 'CustomDevice',
      'X-Plex-Device-Name': 'Custom Device Name',
    });
  });
});
