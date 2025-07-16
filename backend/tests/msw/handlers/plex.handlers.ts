import { rest } from 'msw';

const PLEX_API_BASE = 'https://plex.tv/api/v2';

export const plexHandlers = [
  // PIN generation
  rest.post(`${PLEX_API_BASE}/pins`, (req, res, ctx) => {
    return res(
      ctx.json({
        id: 123456,
        code: 'TEST-CODE',
        product: 'MediaNest',
        trusted: false,
        qr: 'https://plex.tv/link/qr/TEST-CODE',
        clientIdentifier: 'test-client-id',
        location: {
          code: 'US',
          european_union_member: false,
          continent_code: 'NA',
          country: 'United States',
          city: 'New York',
          time_zone: 'America/New_York',
          postal_code: '10001',
          subdivisions: 'NY',
          coordinates: '40.7128,-74.0060',
        },
        expiresIn: 1800,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1800000).toISOString(),
        authToken: null,
        newRegistration: false,
      }),
    );
  }),

  // PIN check (not authorized)
  rest.get(`${PLEX_API_BASE}/pins/:pinId`, (req, res, ctx) => {
    const { pinId } = req.params;

    if (pinId === '123456') {
      return res(
        ctx.json({
          id: 123456,
          code: 'TEST-CODE',
          product: 'MediaNest',
          trusted: false,
          qr: 'https://plex.tv/link/qr/TEST-CODE',
          clientIdentifier: 'test-client-id',
          location: {
            code: 'US',
            european_union_member: false,
            continent_code: 'NA',
            country: 'United States',
            city: 'New York',
            time_zone: 'America/New_York',
            postal_code: '10001',
            subdivisions: 'NY',
            coordinates: '40.7128,-74.0060',
          },
          expiresIn: 1800,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 1800000).toISOString(),
          authToken: null,
          newRegistration: false,
        }),
      );
    }

    // Authorized PIN
    if (pinId === '999999') {
      return res(
        ctx.json({
          id: 999999,
          code: 'AUTH-CODE',
          product: 'MediaNest',
          trusted: true,
          qr: 'https://plex.tv/link/qr/AUTH-CODE',
          clientIdentifier: 'test-client-id',
          location: {
            code: 'US',
            european_union_member: false,
            continent_code: 'NA',
            country: 'United States',
            city: 'New York',
            time_zone: 'America/New_York',
            postal_code: '10001',
            subdivisions: 'NY',
            coordinates: '40.7128,-74.0060',
          },
          expiresIn: 1800,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 1800000).toISOString(),
          authToken: 'test-auth-token-123',
          newRegistration: false,
        }),
      );
    }

    return res(ctx.status(404), ctx.json({ error: 'PIN not found' }));
  }),

  // User info
  rest.get(`${PLEX_API_BASE}/user`, (req, res, ctx) => {
    const authHeader = req.headers.get('X-Plex-Token');

    if (authHeader === 'test-auth-token-123') {
      return res(
        ctx.json({
          id: 1234567,
          uuid: 'test-uuid-123',
          username: 'testuser',
          title: 'Test User',
          email: 'test@example.com',
          friendlyName: 'Test User',
          locale: 'en',
          confirmed: true,
          joinedAt: 1609459200,
          emailOnlyAuth: false,
          hasPassword: true,
          protected: false,
          thumb: 'https://plex.tv/users/test-uuid-123/avatar',
          authToken: 'test-auth-token-123',
          mailingListStatus: 'unsubscribed',
          mailingListActive: false,
          scrobbleTypes: '',
          country: 'US',
          subscription: {
            active: true,
            subscribedAt: '2021-01-01T00:00:00Z',
            status: 'Active',
            paymentService: 'stripe',
            plan: 'lifetime',
          },
          subscriptionDescription: 'Lifetime Plex Pass',
          restricted: false,
          home: true,
          guest: false,
          homeSize: 5,
          homeAdmin: true,
          maxHomeSize: 15,
          rememberExpiresAt: 1704067200,
          profile: {
            autoSelectAudio: true,
            defaultAudioLanguage: 'en',
            defaultSubtitleLanguage: 'en',
            autoSelectSubtitle: 0,
            defaultSubtitleAccessibility: 0,
            defaultSubtitleForced: 0,
          },
          entitlements: [
            'all_hardware_transcoding',
            'cloudsync',
            'content_filter',
            'dvr',
            'hardware_transcoding',
            'home',
            'lyrics',
            'music_videos',
            'pass',
            'photo_autotags',
            'premium_music_metadata',
            'session_bandwidth_restrictions',
            'sync',
            'trailers',
            'webhooks',
          ],
          roles: {
            roles: ['plexpass'],
          },
          services: [],
          adsConsent: null,
          adsConsentSetAt: null,
          adsConsentReminderAt: null,
          experimentalFeatures: false,
          twoFactorEnabled: false,
          backupCodesCreated: false,
        }),
      );
    }

    return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }));
  }),

  // Library sections
  rest.get('*/library/sections', (req, res, ctx) => {
    const authHeader = req.headers.get('X-Plex-Token');

    if (!authHeader) {
      return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }));
    }

    return res(
      ctx.xml(`<?xml version="1.0" encoding="UTF-8"?>
<MediaContainer size="3">
  <Directory allowSync="1" art="/:/resources/movie-fanart.jpg" composite="/library/sections/1/composite/1234567890" filters="1" refreshing="0" thumb="/:/resources/movie.png" key="1" type="movie" title="Movies" agent="tv.plex.agents.movie" scanner="Plex Movie" language="en-US" uuid="12345678-1234-1234-1234-123456789012" updatedAt="1234567890" createdAt="1234567890">
    <Location id="1" path="/media/movies" />
  </Directory>
  <Directory allowSync="1" art="/:/resources/show-fanart.jpg" composite="/library/sections/2/composite/1234567890" filters="1" refreshing="0" thumb="/:/resources/show.png" key="2" type="show" title="TV Shows" agent="tv.plex.agents.series" scanner="Plex TV Series" language="en-US" uuid="12345678-1234-1234-1234-123456789013" updatedAt="1234567890" createdAt="1234567890">
    <Location id="2" path="/media/tv" />
  </Directory>
  <Directory allowSync="1" art="/:/resources/artist-fanart.jpg" composite="/library/sections/3/composite/1234567890" filters="1" refreshing="0" thumb="/:/resources/artist.png" key="3" type="artist" title="Music" agent="tv.plex.agents.music" scanner="Plex Music" language="en-US" uuid="12345678-1234-1234-1234-123456789014" updatedAt="1234567890" createdAt="1234567890">
    <Location id="3" path="/media/music" />
  </Directory>
</MediaContainer>`),
    );
  }),

  // Search
  rest.get('*/search', (req, res, ctx) => {
    const authHeader = req.headers.get('X-Plex-Token');
    const query = req.url.searchParams.get('query');

    if (!authHeader) {
      return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }));
    }

    if (!query) {
      return res(ctx.status(400), ctx.json({ error: 'Query parameter required' }));
    }

    return res(
      ctx.xml(`<?xml version="1.0" encoding="UTF-8"?>
<MediaContainer size="2">
  <Video ratingKey="1" key="/library/metadata/1" guid="plex://movie/5d776b1d4de0ee001fcc8f6b" studio="Test Studio" type="movie" title="Test Movie" contentRating="PG-13" summary="A test movie for testing purposes" rating="8.5" year="2023" thumb="/library/metadata/1/thumb/1234567890" art="/library/metadata/1/art/1234567890" duration="7200000" originallyAvailableAt="2023-01-01" addedAt="1234567890" updatedAt="1234567890">
    <Media id="1" duration="7200000" bitrate="5000" width="1920" height="1080" aspectRatio="1.78" audioChannels="6" audioCodec="aac" videoCodec="h264" videoResolution="1080" container="mp4" videoFrameRate="24p" videoProfile="high">
      <Part id="1" key="/library/parts/1/1234567890/file.mp4" duration="7200000" file="/media/movies/Test Movie (2023).mp4" size="2147483648" container="mp4" videoProfile="high" />
    </Media>
    <Genre tag="Action" />
    <Genre tag="Adventure" />
    <Director tag="Test Director" />
    <Writer tag="Test Writer" />
    <Role tag="Test Actor" />
  </Video>
  <Directory ratingKey="2" key="/library/metadata/2/children" guid="plex://show/5d776b1d4de0ee001fcc8f6c" studio="Test Network" type="show" title="Test Show" contentRating="TV-14" summary="A test show for testing purposes" rating="9.0" year="2023" thumb="/library/metadata/2/thumb/1234567890" art="/library/metadata/2/art/1234567890" duration="1800000" originallyAvailableAt="2023-01-01" leafCount="10" viewedLeafCount="5" childCount="1" addedAt="1234567890" updatedAt="1234567890">
    <Genre tag="Drama" />
    <Genre tag="Comedy" />
    <Role tag="Test Actor" />
  </Directory>
</MediaContainer>`),
    );
  }),
];
