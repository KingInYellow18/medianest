/**
 * Test data fixtures for E2E media request tests
 */

export const mockMediaResults = {
  movies: [
    {
      id: 550,
      title: "Fight Club",
      overview: "An insomniac office worker and a devil-may-care soapmaker form an underground fight club.",
      releaseDate: "1999-10-15",
      mediaType: "movie",
      posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      backdropPath: "/fCayJrkfRaCRCTh8GqN30f8oyQF.jpg",
      adult: false,
      genreIds: [18, 53],
      originalLanguage: "en",
      originalTitle: "Fight Club",
      popularity: 61.416,
      video: false,
      voteAverage: 8.433,
      voteCount: 26280
    },
    {
      id: 155,
      title: "The Dark Knight",
      overview: "Batman raises the stakes in his war on crime.",
      releaseDate: "2008-07-18",
      mediaType: "movie",
      posterPath: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
      backdropPath: "/dqK9Hag1054tghRQSqLSfrkvQnA.jpg",
      adult: false,
      genreIds: [18, 28, 80, 53],
      originalLanguage: "en",
      originalTitle: "The Dark Knight",
      popularity: 123.167,
      video: false,
      voteAverage: 8.516,
      voteCount: 31999
    },
    {
      id: 13,
      title: "Forrest Gump",
      overview: "The presidencies of Kennedy and Johnson through the eyes of an Alabama man with an IQ of 75.",
      releaseDate: "1994-06-23",
      mediaType: "movie",
      posterPath: "/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg",
      backdropPath: "/3h1JZGDhZ8nzxdgvkxha0qBqi05.jpg",
      adult: false,
      genreIds: [35, 18, 10749],
      originalLanguage: "en",
      originalTitle: "Forrest Gump",
      popularity: 88.717,
      video: false,
      voteAverage: 8.471,
      voteCount: 26000
    }
  ],
  tvShows: [
    {
      id: 1399,
      name: "Game of Thrones",
      overview: "Seven noble families fight for control of the mythical land of Westeros.",
      firstAirDate: "2011-04-17",
      mediaType: "tv",
      posterPath: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
      backdropPath: "/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg",
      genreIds: [10765, 18, 10759],
      originalLanguage: "en",
      originalName: "Game of Thrones",
      popularity: 369.594,
      voteAverage: 8.453,
      voteCount: 22000,
      seasons: [
        { id: 3624, name: "Season 1", seasonNumber: 1, episodeCount: 10, airDate: "2011-04-17" },
        { id: 3625, name: "Season 2", seasonNumber: 2, episodeCount: 10, airDate: "2012-04-01" },
        { id: 3626, name: "Season 3", seasonNumber: 3, episodeCount: 10, airDate: "2013-03-31" },
        { id: 3627, name: "Season 4", seasonNumber: 4, episodeCount: 10, airDate: "2014-04-06" },
        { id: 3628, name: "Season 5", seasonNumber: 5, episodeCount: 10, airDate: "2015-04-12" },
        { id: 3629, name: "Season 6", seasonNumber: 6, episodeCount: 10, airDate: "2016-04-24" },
        { id: 3630, name: "Season 7", seasonNumber: 7, episodeCount: 7, airDate: "2017-07-16" },
        { id: 3631, name: "Season 8", seasonNumber: 8, episodeCount: 6, airDate: "2019-04-14" }
      ]
    },
    {
      id: 1396,
      name: "Breaking Bad",
      overview: "A high school chemistry teacher turned methamphetamine producer.",
      firstAirDate: "2008-01-20",
      mediaType: "tv",
      posterPath: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
      backdropPath: "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
      genreIds: [18, 80],
      originalLanguage: "en",
      originalName: "Breaking Bad",
      popularity: 317.854,
      voteAverage: 8.908,
      voteCount: 13000,
      seasons: [
        { id: 3572, name: "Season 1", seasonNumber: 1, episodeCount: 7, airDate: "2008-01-20" },
        { id: 3573, name: "Season 2", seasonNumber: 2, episodeCount: 13, airDate: "2009-03-08" },
        { id: 3574, name: "Season 3", seasonNumber: 3, episodeCount: 13, airDate: "2010-03-21" },
        { id: 3575, name: "Season 4", seasonNumber: 4, episodeCount: 13, airDate: "2011-07-17" },
        { id: 3576, name: "Season 5", seasonNumber: 5, episodeCount: 16, airDate: "2012-07-15" }
      ]
    },
    {
      id: 60735,
      name: "The Flash",
      overview: "After a particle accelerator causes a freak storm, Barry Allen is struck by lightning.",
      firstAirDate: "2014-10-07",
      mediaType: "tv",
      posterPath: "/lJA2RCMfsWoskqlQhXPSLFQGXEJ.jpg",
      backdropPath: "/9LoKId4n8b4e1BKjp8RTEvwgKqW.jpg",
      genreIds: [18, 10765],
      originalLanguage: "en",
      originalName: "The Flash",
      popularity: 1329.297,
      voteAverage: 7.785,
      voteCount: 9800,
      seasons: [
        { id: 62643, name: "Season 1", seasonNumber: 1, episodeCount: 23, airDate: "2014-10-07" },
        { id: 66922, name: "Season 2", seasonNumber: 2, episodeCount: 23, airDate: "2015-10-06" },
        { id: 77195, name: "Season 3", seasonNumber: 3, episodeCount: 23, airDate: "2016-10-04" }
      ]
    }
  ]
};

export const mockPlexLibraries = [
  {
    id: "1",
    key: "/library/sections/1",
    title: "Movies",
    type: "movie",
    agent: "tv.plex.agents.movie",
    scanner: "Plex Movie Scanner",
    language: "en",
    uuid: "12345678-1234-1234-1234-123456789abc",
    updatedAt: Date.now(),
    createdAt: Date.now(),
    scannedAt: Date.now(),
    content: true,
    directory: true,
    contentChangedAt: Date.now()
  },
  {
    id: "2", 
    key: "/library/sections/2",
    title: "TV Shows",
    type: "show",
    agent: "tv.plex.agents.series",
    scanner: "Plex Series Scanner",
    language: "en",
    uuid: "87654321-4321-4321-4321-cba987654321",
    updatedAt: Date.now(),
    createdAt: Date.now(),
    scannedAt: Date.now(),
    content: true,
    directory: true,
    contentChangedAt: Date.now()
  },
  {
    id: "3",
    key: "/library/sections/3", 
    title: "Music",
    type: "artist",
    agent: "tv.plex.agents.music",
    scanner: "Plex Music Scanner",
    language: "en",
    uuid: "abcdef12-5678-9012-3456-789012345def",
    updatedAt: Date.now(),
    createdAt: Date.now(),
    scannedAt: Date.now(),
    content: true,
    directory: true,
    contentChangedAt: Date.now()
  }
];

export const mockPlexContent = {
  movies: [
    {
      ratingKey: "1234",
      key: "/library/metadata/1234",
      guid: "plex://movie/5d7768224390c6002062b78b",
      title: "The Matrix",
      type: "movie",
      titleSort: "Matrix",
      contentRating: "R",
      summary: "A computer hacker learns from mysterious rebels about the true nature of his reality.",
      rating: 8.7,
      audienceRating: 8.5,
      year: 1999,
      tagline: "Free your mind",
      thumb: "/library/metadata/1234/thumb/1234567890",
      art: "/library/metadata/1234/art/1234567890",
      duration: 8160000,
      originallyAvailableAt: "1999-03-31",
      addedAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      ratingKey: "5678",
      key: "/library/metadata/5678", 
      guid: "plex://movie/5d776825f2a8d8002059c0f8",
      title: "Inception",
      type: "movie",
      titleSort: "Inception",
      contentRating: "PG-13",
      summary: "A thief who enters people's dreams and steals their subconscious secrets.",
      rating: 8.8,
      audienceRating: 9.0,
      year: 2010,
      tagline: "Your mind is the scene of the crime",
      thumb: "/library/metadata/5678/thumb/1234567890",
      art: "/library/metadata/5678/art/1234567890", 
      duration: 8880000,
      originallyAvailableAt: "2010-07-16",
      addedAt: Date.now(),
      updatedAt: Date.now()
    }
  ],
  tvShows: [
    {
      ratingKey: "9012",
      key: "/library/metadata/9012",
      guid: "plex://show/5d77681f880197002061bdc5",
      title: "Stranger Things",
      type: "show",
      titleSort: "Stranger Things",
      contentRating: "TV-14",
      summary: "A love letter to the '80s classics that captivated a generation.",
      rating: 8.7,
      audienceRating: 8.8,
      year: 2016,
      thumb: "/library/metadata/9012/thumb/1234567890",
      art: "/library/metadata/9012/art/1234567890",
      leafCount: 34,
      viewedLeafCount: 0,
      childCount: 4,
      addedAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      ratingKey: "3456", 
      key: "/library/metadata/3456",
      guid: "plex://show/5d77681fa5a5a8001f0a4afe",
      title: "The Office",
      type: "show",
      titleSort: "Office",
      contentRating: "TV-14",
      summary: "A mockumentary on a group of typical office workers.",
      rating: 9.0,
      audienceRating: 9.1,
      year: 2005,
      thumb: "/library/metadata/3456/thumb/1234567890",
      art: "/library/metadata/3456/art/1234567890",
      leafCount: 201,
      viewedLeafCount: 150,
      childCount: 9,
      addedAt: Date.now(),
      updatedAt: Date.now()
    }
  ]
};

export const requestStatusValues = [
  'pending',
  'approved', 
  'processing',
  'available',
  'declined',
  'failed'
] as const;

export type RequestStatus = typeof requestStatusValues[number];

export const createMockRequest = (overrides?: Partial<any>) => ({
  id: Math.floor(Math.random() * 100000),
  title: 'Test Movie',
  mediaType: 'movie',
  tmdbId: '12345',
  status: 'pending' as RequestStatus,
  requestedAt: new Date().toISOString(),
  ...overrides
});

export const searchQueries = {
  movies: [
    'Matrix',
    'Dark Knight', 
    'Inception',
    'Fight Club',
    'Forrest Gump',
    'Pulp Fiction',
    'Shawshank Redemption'
  ],
  tvShows: [
    'Breaking Bad',
    'Game of Thrones',
    'Stranger Things',
    'The Office',
    'Friends',
    'The Flash',
    'Arrow'
  ],
  mixed: [
    'Marvel',
    'DC',
    'Star Wars',
    'Lord of the Rings',
    'Batman',
    'Spider-Man'
  ]
};

export const errorScenarios = {
  invalidTmdbId: {
    mediaType: 'movie',
    tmdbId: 'invalid-id'
  },
  missingMediaType: {
    tmdbId: '12345'
  },
  invalidMediaType: {
    mediaType: 'invalid-type',
    tmdbId: '12345'
  },
  negativeId: {
    mediaType: 'movie', 
    tmdbId: '-1'
  },
  extremelyLargeId: {
    mediaType: 'movie',
    tmdbId: '999999999999999'
  }
};