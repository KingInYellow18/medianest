import { http, HttpResponse } from 'msw';

export const plexHandlers = [
  // PIN generation - Plex returns XML format
  http.post('https://plex.tv/pins.xml', () => {
    return new HttpResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<pin>
  <id>123456</id>
  <code>TEST</code>
  <product>MediaNest</product>
  <trusted>0</trusted>
  <clientIdentifier>test-client-id</clientIdentifier>
  <location>
    <code>US</code>
    <european_union_member>false</european_union_member>
    <continent_code>NA</continent_code>
    <country>United States</country>
    <city>New York</city>
    <time_zone>America/New_York</time_zone>
    <postal_code>10001</postal_code>
    <subdivisions>NY</subdivisions>
    <coordinates>40.7128,-74.0060</coordinates>
  </location>
  <expiresIn>1800</expiresIn>
  <createdAt>${new Date().toISOString()}</createdAt>
  <expiresAt>${new Date(Date.now() + 1800000).toISOString()}</expiresAt>
  <authToken></authToken>
  <newRegistration>false</newRegistration>
</pin>`,
      { headers: { 'Content-Type': 'application/xml' } },
    );
  }),

  // PIN check - Returns XML
  http.get('https://plex.tv/pins/:pinId.xml', ({ params }) => {
    const { pinId } = params;

    // Not authorized PIN
    if (pinId === 'test-pin-123' || pinId === 'unauthorized-pin') {
      return new HttpResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<pin>
  <id>${pinId}</id>
  <code>TEST</code>
  <product>MediaNest</product>
  <trusted>0</trusted>
  <clientIdentifier>test-client-id</clientIdentifier>
  <expiresIn>1800</expiresIn>
  <createdAt>${new Date().toISOString()}</createdAt>
  <expiresAt>${new Date(Date.now() + 1800000).toISOString()}</expiresAt>
  <authToken></authToken>
  <newRegistration>false</newRegistration>
</pin>`,
        { headers: { 'Content-Type': 'application/xml' } },
      );
    }

    // Authorized PINs
    if (
      ['test-pin-existing', 'test-pin-first-user', 'session-test-pin', 'logout-test-pin'].includes(
        pinId as string,
      )
    ) {
      return new HttpResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<pin>
  <id>${pinId}</id>
  <code>AUTHED</code>
  <product>MediaNest</product>
  <trusted>1</trusted>
  <clientIdentifier>test-client-id</clientIdentifier>
  <expiresIn>1800</expiresIn>
  <createdAt>${new Date().toISOString()}</createdAt>
  <expiresAt>${new Date(Date.now() + 1800000).toISOString()}</expiresAt>
  <authToken>test-auth-token-${pinId}</authToken>
  <newRegistration>false</newRegistration>
</pin>`,
        { headers: { 'Content-Type': 'application/xml' } },
      );
    }

    // Invalid PIN
    return HttpResponse.xml(
      '<?xml version="1.0" encoding="UTF-8"?><errors><error>Invalid PIN</error></errors>',
      { status: 404 },
    );
  }),

  // User info - Returns XML
  http.get('https://plex.tv/users/account.xml', ({ request }) => {
    const authHeader = request.headers.get('X-Plex-Token');

    if (authHeader?.startsWith('test-auth-token-')) {
      const pinId = authHeader.replace('test-auth-token-', '');

      // Different users based on PIN
      const userMappings: Record<string, any> = {
        'test-pin-existing': {
          plexId: 'plex-test-123',
          username: 'testuser',
          email: 'test@example.com',
        },
        'test-pin-first-user': {
          plexId: 'plex-first-user',
          username: 'firstuser',
          email: 'first@example.com',
        },
        'session-test-pin': {
          plexId: 'plex-session-test',
          username: 'sessionuser',
          email: 'session@example.com',
        },
        'logout-test-pin': {
          plexId: 'plex-logout-test',
          username: 'logoutuser',
          email: 'logout@example.com',
        },
      };

      const userData = userMappings[pinId] || {
        plexId: 'plex-default',
        username: 'testuser',
        email: 'test@example.com',
      };

      return new HttpResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<user>
  <id>${userData.plexId}</id>
  <username>${userData.username}</username>
  <email>${userData.email}</email>
  <title>${userData.username}</title>
  <friendlyName>${userData.username}</friendlyName>
  <locale>en</locale>
  <confirmed>1</confirmed>
  <joinedAt>1609459200</joinedAt>
  <emailOnlyAuth>0</emailOnlyAuth>
  <hasPassword>1</hasPassword>
  <protected>0</protected>
  <thumb>https://plex.tv/users/${userData.plexId}/avatar</thumb>
  <authToken>${authHeader}</authToken>
  <country>US</country>
</user>`,
        { headers: { 'Content-Type': 'application/xml' } },
      );
    }

    return HttpResponse.xml(
      '<?xml version="1.0" encoding="UTF-8"?><errors><error>Unauthorized</error></errors>',
      { status: 401 },
    );
  }),

  // Library sections
  http.get('*/library/sections', ({ request }) => {
    const authHeader = request.headers.get('X-Plex-Token');

    if (!authHeader) {
      return HttpResponse.xml(
        '<?xml version="1.0" encoding="UTF-8"?><errors><error>Unauthorized</error></errors>',
        { status: 401 },
      );
    }

    return new HttpResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
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
</MediaContainer>`,
      { headers: { 'Content-Type': 'application/xml' } },
    );
  }),

  // Search
  http.get('*/search', ({ request }) => {
    const authHeader = request.headers.get('X-Plex-Token');
    const url = new URL(request.url);
    const query = url.searchParams.get('query');

    if (!authHeader) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!query) {
      return HttpResponse.json({ error: 'Query parameter required' }, { status: 400 });
    }

    return new HttpResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
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
</MediaContainer>`,
      { headers: { 'Content-Type': 'application/xml' } },
    );
  }),
];
