import { http, HttpResponse } from 'msw';

export const youtubeHandlers = [
  // YouTube API - Video info
  http.get('https://www.googleapis.com/youtube/v3/videos', ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const part = url.searchParams.get('part');

    if (!id || !part) {
      return HttpResponse.json(
        {
          error: {
            code: 400,
            message: 'Required parameters missing',
          },
        },
        { status: 400 },
      );
    }

    if (id === 'test-video-id') {
      return HttpResponse.json({
        kind: 'youtube#videoListResponse',
        etag: 'test-etag',
        items: [
          {
            kind: 'youtube#video',
            etag: 'test-video-etag',
            id: 'test-video-id',
            snippet: {
              publishedAt: '2023-01-01T00:00:00Z',
              channelId: 'test-channel-id',
              title: 'Test Video Title',
              description: 'Test video description',
              thumbnails: {
                default: {
                  url: 'https://i.ytimg.com/vi/test-video-id/default.jpg',
                  width: 120,
                  height: 90,
                },
                medium: {
                  url: 'https://i.ytimg.com/vi/test-video-id/mqdefault.jpg',
                  width: 320,
                  height: 180,
                },
                high: {
                  url: 'https://i.ytimg.com/vi/test-video-id/hqdefault.jpg',
                  width: 480,
                  height: 360,
                },
              },
              channelTitle: 'Test Channel',
              tags: ['test', 'video'],
              categoryId: '22',
              liveBroadcastContent: 'none',
              defaultLanguage: 'en',
              localized: {
                title: 'Test Video Title',
                description: 'Test video description',
              },
            },
            contentDetails: {
              duration: 'PT5M30S',
              dimension: '2d',
              definition: 'hd',
              caption: 'false',
              licensedContent: true,
              projection: 'rectangular',
            },
            statistics: {
              viewCount: '1000000',
              likeCount: '50000',
              dislikeCount: '500',
              favoriteCount: '0',
              commentCount: '10000',
            },
          },
        ],
        pageInfo: {
          totalResults: 1,
          resultsPerPage: 1,
        },
      });
    }

    if (id === 'playlist-video-id') {
      return HttpResponse.json({
        kind: 'youtube#videoListResponse',
        etag: 'test-etag',
        items: [
          {
            kind: 'youtube#video',
            etag: 'test-video-etag',
            id: 'playlist-video-id',
            snippet: {
              publishedAt: '2023-01-01T00:00:00Z',
              channelId: 'test-channel-id',
              title: 'Playlist Video Title',
              description: 'Playlist video description',
              thumbnails: {
                default: {
                  url: 'https://i.ytimg.com/vi/playlist-video-id/default.jpg',
                  width: 120,
                  height: 90,
                },
              },
              channelTitle: 'Test Channel',
              categoryId: '10',
              liveBroadcastContent: 'none',
            },
            contentDetails: {
              duration: 'PT3M45S',
              dimension: '2d',
              definition: 'hd',
              caption: 'false',
              licensedContent: true,
              projection: 'rectangular',
            },
            statistics: {
              viewCount: '500000',
              likeCount: '25000',
              commentCount: '5000',
            },
          },
        ],
        pageInfo: {
          totalResults: 1,
          resultsPerPage: 1,
        },
      });
    }

    return HttpResponse.json(
      {
        error: {
          code: 404,
          message: 'Video not found',
        },
      },
      { status: 404 },
    );
  }),

  // YouTube API - Playlist info
  http.get('https://www.googleapis.com/youtube/v3/playlists', ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const part = url.searchParams.get('part');

    if (!id || !part) {
      return HttpResponse.json(
        {
          error: {
            code: 400,
            message: 'Required parameters missing',
          },
        },
        { status: 400 },
      );
    }

    if (id === 'test-playlist-id') {
      return HttpResponse.json({
        kind: 'youtube#playlistListResponse',
        etag: 'test-etag',
        items: [
          {
            kind: 'youtube#playlist',
            etag: 'test-playlist-etag',
            id: 'test-playlist-id',
            snippet: {
              publishedAt: '2023-01-01T00:00:00Z',
              channelId: 'test-channel-id',
              title: 'Test Playlist',
              description: 'Test playlist description',
              thumbnails: {
                default: {
                  url: 'https://i.ytimg.com/vi/test-video-id/default.jpg',
                  width: 120,
                  height: 90,
                },
                medium: {
                  url: 'https://i.ytimg.com/vi/test-video-id/mqdefault.jpg',
                  width: 320,
                  height: 180,
                },
                high: {
                  url: 'https://i.ytimg.com/vi/test-video-id/hqdefault.jpg',
                  width: 480,
                  height: 360,
                },
              },
              channelTitle: 'Test Channel',
              tags: ['test', 'playlist'],
              defaultLanguage: 'en',
              localized: {
                title: 'Test Playlist',
                description: 'Test playlist description',
              },
            },
            contentDetails: {
              itemCount: 10,
            },
          },
        ],
        pageInfo: {
          totalResults: 1,
          resultsPerPage: 1,
        },
      });
    }

    return HttpResponse.json(
      {
        error: {
          code: 404,
          message: 'Playlist not found',
        },
      },
      { status: 404 },
    );
  }),

  // YouTube API - Playlist items
  http.get('https://www.googleapis.com/youtube/v3/playlistItems', ({ request }) => {
    const url = new URL(request.url);
    const playlistId = url.searchParams.get('playlistId');
    const part = url.searchParams.get('part');
    const maxResults = url.searchParams.get('maxResults') || '50';
    const pageToken = url.searchParams.get('pageToken');

    if (!playlistId || !part) {
      return HttpResponse.json(
        {
          error: {
            code: 400,
            message: 'Required parameters missing',
          },
        },
        { status: 400 },
      );
    }

    if (playlistId === 'test-playlist-id') {
      const items = [];
      const numItems = pageToken ? 5 : 10; // Return fewer items on second page

      for (let i = 0; i < numItems; i++) {
        const offset = pageToken ? 10 : 0;
        items.push({
          kind: 'youtube#playlistItem',
          etag: `test-item-etag-${i + offset}`,
          id: `test-playlist-item-${i + offset}`,
          snippet: {
            publishedAt: '2023-01-01T00:00:00Z',
            channelId: 'test-channel-id',
            title: `Playlist Video ${i + offset + 1}`,
            description: `Video ${i + offset + 1} in the playlist`,
            thumbnails: {
              default: {
                url: `https://i.ytimg.com/vi/video-${i + offset}/default.jpg`,
                width: 120,
                height: 90,
              },
            },
            channelTitle: 'Test Channel',
            playlistId: 'test-playlist-id',
            position: i + offset,
            resourceId: {
              kind: 'youtube#video',
              videoId: `playlist-video-${i + offset}`,
            },
          },
          contentDetails: {
            videoId: `playlist-video-${i + offset}`,
            videoPublishedAt: '2023-01-01T00:00:00Z',
          },
        });
      }

      return HttpResponse.json({
        kind: 'youtube#playlistItemListResponse',
        etag: 'test-etag',
        nextPageToken: !pageToken && numItems === 10 ? 'next-page-token' : undefined,
        items,
        pageInfo: {
          totalResults: 15,
          resultsPerPage: parseInt(maxResults),
        },
      });
    }

    return HttpResponse.json(
      {
        error: {
          code: 404,
          message: 'Playlist not found',
        },
      },
      { status: 404 },
    );
  }),

  // Mock yt-dlp info extraction endpoint (if backend provides one)
  http.post('*/api/v1/youtube/extract-info', () => {
    return HttpResponse.json({
      id: 'test-video-id',
      title: 'Test Video Title',
      uploader: 'Test Channel',
      uploaderId: 'test-channel-id',
      uploaderUrl: 'https://www.youtube.com/channel/test-channel-id',
      uploadDate: '20230101',
      duration: 330,
      viewCount: 1000000,
      likeCount: 50000,
      description: 'Test video description',
      thumbnail: 'https://i.ytimg.com/vi/test-video-id/maxresdefault.jpg',
      formats: [
        {
          formatId: '22',
          ext: 'mp4',
          quality: 'hd720',
          format: '1280x720',
          filesize: 104857600,
        },
        {
          formatId: '18',
          ext: 'mp4',
          quality: 'medium',
          format: '640x360',
          filesize: 52428800,
        },
      ],
    });
  }),
];
