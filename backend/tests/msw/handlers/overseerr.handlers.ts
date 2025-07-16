import { rest } from 'msw';

export const overseerrHandlers = [
  // Status check
  rest.get('*/api/v1/status', (req, res, ctx) => {
    return res(
      ctx.json({
        version: '1.33.2',
        commitTag: 'test-commit',
        updateAvailable: false,
        commitsBehind: 0,
      }),
    );
  }),

  // Search multi
  rest.get('*/api/v1/search/multi', (req, res, ctx) => {
    const query = req.url.searchParams.get('query');
    const page = req.url.searchParams.get('page') || '1';

    if (!query) {
      return res(ctx.status(400), ctx.json({ error: 'Query parameter required' }));
    }

    return res(
      ctx.json({
        page: parseInt(page),
        totalPages: 1,
        totalResults: 2,
        results: [
          {
            id: 123456,
            mediaType: 'movie',
            popularity: 100.5,
            posterPath: '/poster1.jpg',
            backdropPath: '/backdrop1.jpg',
            voteAverage: 8.5,
            voteCount: 1000,
            genreIds: [28, 12],
            overview: 'A test movie overview',
            originalLanguage: 'en',
            title: 'Test Movie',
            originalTitle: 'Test Movie',
            releaseDate: '2023-01-01',
            adult: false,
            video: false,
            mediaInfo: {
              status: 1, // AVAILABLE
              id: 1,
            },
          },
          {
            id: 789012,
            mediaType: 'tv',
            popularity: 95.2,
            posterPath: '/poster2.jpg',
            backdropPath: '/backdrop2.jpg',
            voteAverage: 9.0,
            voteCount: 500,
            genreIds: [18, 35],
            overview: 'A test TV show overview',
            originalLanguage: 'en',
            name: 'Test Show',
            originalName: 'Test Show',
            firstAirDate: '2023-01-01',
            originCountry: ['US'],
            mediaInfo: {
              status: 2, // PARTIALLY_AVAILABLE
              id: 2,
            },
          },
        ],
      }),
    );
  }),

  // Movie details
  rest.get('*/api/v1/movie/:movieId', (req, res, ctx) => {
    const { movieId } = req.params;

    if (movieId === '123456') {
      return res(
        ctx.json({
          id: 123456,
          imdbId: 'tt1234567',
          adult: false,
          backdropPath: '/backdrop1.jpg',
          posterPath: '/poster1.jpg',
          budget: 100000000,
          genres: [
            { id: 28, name: 'Action' },
            { id: 12, name: 'Adventure' },
          ],
          homepage: 'https://example.com',
          originalLanguage: 'en',
          originalTitle: 'Test Movie',
          overview: 'A test movie overview',
          popularity: 100.5,
          productionCompanies: [{ id: 1, name: 'Test Studio' }],
          productionCountries: [{ iso_3166_1: 'US', name: 'United States of America' }],
          releaseDate: '2023-01-01',
          revenue: 500000000,
          runtime: 120,
          spokenLanguages: [{ iso_639_1: 'en', name: 'English' }],
          status: 'Released',
          tagline: 'Test tagline',
          title: 'Test Movie',
          video: false,
          voteAverage: 8.5,
          voteCount: 1000,
          credits: {
            cast: [
              {
                id: 1,
                name: 'Test Actor',
                character: 'Main Character',
                profilePath: '/actor1.jpg',
              },
            ],
            crew: [
              {
                id: 2,
                name: 'Test Director',
                job: 'Director',
                profilePath: '/director1.jpg',
              },
            ],
          },
          mediaInfo: {
            id: 1,
            tmdbId: 123456,
            imdbId: 'tt1234567',
            status: 1, // AVAILABLE
            requests: [],
          },
        }),
      );
    }

    return res(ctx.status(404), ctx.json({ error: 'Movie not found' }));
  }),

  // TV show details
  rest.get('*/api/v1/tv/:tvId', (req, res, ctx) => {
    const { tvId } = req.params;

    if (tvId === '789012') {
      return res(
        ctx.json({
          id: 789012,
          backdropPath: '/backdrop2.jpg',
          posterPath: '/poster2.jpg',
          createdBy: [{ id: 1, name: 'Test Creator' }],
          episodeRunTime: [30],
          firstAirDate: '2023-01-01',
          genres: [
            { id: 18, name: 'Drama' },
            { id: 35, name: 'Comedy' },
          ],
          homepage: 'https://example.com/show',
          inProduction: true,
          languages: ['en'],
          lastAirDate: '2023-12-01',
          lastEpisodeToAir: {
            airDate: '2023-12-01',
            episodeNumber: 10,
            id: 1001,
            name: 'Season Finale',
            overview: 'The season finale',
            seasonNumber: 1,
            stillPath: '/still1.jpg',
            voteAverage: 9.2,
            voteCount: 100,
          },
          name: 'Test Show',
          networks: [{ id: 1, name: 'Test Network' }],
          numberOfEpisodes: 10,
          numberOfSeasons: 1,
          originCountry: ['US'],
          originalLanguage: 'en',
          originalName: 'Test Show',
          overview: 'A test TV show overview',
          popularity: 95.2,
          productionCompanies: [{ id: 2, name: 'Test Productions' }],
          productionCountries: [{ iso_3166_1: 'US', name: 'United States of America' }],
          seasons: [
            {
              airDate: '2023-01-01',
              episodeCount: 10,
              id: 1,
              name: 'Season 1',
              overview: 'The first season',
              posterPath: '/season1.jpg',
              seasonNumber: 1,
            },
          ],
          spokenLanguages: [{ iso_639_1: 'en', name: 'English' }],
          status: 'Returning Series',
          tagline: 'Test show tagline',
          type: 'Scripted',
          voteAverage: 9.0,
          voteCount: 500,
          credits: {
            cast: [
              {
                id: 3,
                name: 'Test Actor',
                character: 'Lead Character',
                profilePath: '/actor2.jpg',
              },
            ],
          },
          mediaInfo: {
            id: 2,
            tmdbId: 789012,
            status: 2, // PARTIALLY_AVAILABLE
            requests: [],
            seasons: [
              {
                id: 1,
                seasonNumber: 1,
                status: 2, // PARTIALLY_AVAILABLE
              },
            ],
          },
        }),
      );
    }

    return res(ctx.status(404), ctx.json({ error: 'TV show not found' }));
  }),

  // Create request
  rest.post('*/api/v1/request', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 1,
        status: 1, // PENDING
        media: {
          id: 1,
          tmdbId: 123456,
          imdbId: 'tt1234567',
          status: 3, // REQUESTED
          mediaType: 'movie',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        requestedBy: {
          id: 1,
          email: 'test@example.com',
          username: 'testuser',
          plexToken: '***',
          permissions: 2,
          avatar: '/avatar.jpg',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          requestCount: 1,
        },
        modifiedBy: null,
        is4k: false,
        serverId: null,
        profileId: null,
        rootFolder: null,
      }),
    );
  }),

  // User requests
  rest.get('*/api/v1/request', (req, res, ctx) => {
    const take = req.url.searchParams.get('take') || '10';
    const skip = req.url.searchParams.get('skip') || '0';

    return res(
      ctx.json({
        pageInfo: {
          pages: 1,
          pageSize: parseInt(take),
          results: 2,
          page: Math.floor(parseInt(skip) / parseInt(take)) + 1,
        },
        results: [
          {
            id: 1,
            status: 2, // APPROVED
            media: {
              id: 1,
              tmdbId: 123456,
              imdbId: 'tt1234567',
              status: 4, // PROCESSING
              mediaType: 'movie',
              movieInfo: {
                id: 123456,
                title: 'Test Movie',
                releaseDate: '2023-01-01',
                posterPath: '/poster1.jpg',
              },
            },
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-02T00:00:00.000Z',
            requestedBy: {
              id: 1,
              email: 'test@example.com',
              username: 'testuser',
            },
            modifiedBy: {
              id: 2,
              email: 'admin@example.com',
              username: 'admin',
            },
            is4k: false,
          },
          {
            id: 2,
            status: 1, // PENDING
            media: {
              id: 2,
              tmdbId: 789012,
              status: 3, // REQUESTED
              mediaType: 'tv',
              tvInfo: {
                id: 789012,
                name: 'Test Show',
                firstAirDate: '2023-01-01',
                posterPath: '/poster2.jpg',
              },
            },
            createdAt: '2023-01-03T00:00:00.000Z',
            updatedAt: '2023-01-03T00:00:00.000Z',
            requestedBy: {
              id: 1,
              email: 'test@example.com',
              username: 'testuser',
            },
            modifiedBy: null,
            is4k: false,
            seasons: [
              {
                id: 1,
                seasonNumber: 1,
                status: 1, // PENDING
              },
            ],
          },
        ],
      }),
    );
  }),
];
