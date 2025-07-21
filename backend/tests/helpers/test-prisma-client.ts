import { vi } from 'vitest';

// Create a mock Prisma client that includes all required models
export const createTestPrismaClient = () => {
  const mockDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const mockCreate = vi.fn();
  const mockFindUnique = vi.fn();
  const mockFindMany = vi.fn();
  const mockUpdate = vi.fn();
  const mockUpsert = vi.fn();
  const mockDelete = vi.fn();
  const mockCount = vi.fn();

  // Create a user ID counter for unique IDs
  let userIdCounter = 1;

  const createModelMock = (modelName?: string) => ({
    create: mockCreate,
    createMany: vi.fn(),
    findUnique: mockFindUnique,
    findFirst: vi.fn(),
    findMany: mockFindMany,
    update: mockUpdate,
    updateMany: vi.fn(),
    delete: mockDelete,
    deleteMany: mockDeleteMany,
    count: mockCount,
    upsert: mockUpsert,
  });

  const client = {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    user: createModelMock('user'),
    mediaRequest: createModelMock('mediaRequest'),
    youtubeDownload: createModelMock('youtubeDownload'),
    serviceConfig: createModelMock('serviceConfig'),
    serviceStatus: createModelMock('serviceStatus'),
    session: createModelMock('session'),
    sessionToken: createModelMock('sessionToken'),
    account: createModelMock('account'),
    verificationToken: createModelMock('verificationToken'),
    rateLimit: createModelMock('rateLimit'),
    errorLog: createModelMock('errorLog'),
    monitorVisibility: createModelMock('monitorVisibility'),
  };

  // Setup user.upsert to return a mock user
  client.user.upsert.mockImplementation(async ({ where, update, create }) => {
    const userId = `user-${userIdCounter++}`;
    return {
      id: userId,
      plexId: create?.plexId || where?.plexId || `plex-user-${userId}`,
      plexUsername: create?.plexUsername || `testuser${userId}`,
      email: create?.email || `user${userId}@example.com`,
      role: create?.role || 'USER',
      plexToken: create?.plexToken || 'encrypted-token',
      createdAt: new Date(),
      lastLoginAt: update?.lastLoginAt || new Date(),
      status: 'active',
      name: null,
      image: null,
      requiresPasswordChange: false,
      onboardingCompleted: false,
      onboardingSkipped: false,
      onboardingStep: null,
      onboardingCompletedAt: null,
    };
  });

  // Setup session.create to return a mock session
  client.session.create.mockImplementation(async ({ data }) => {
    return {
      id: `session-${Date.now()}`,
      sessionToken: data.sessionToken,
      userId: data.userId,
      expires: data.expires,
    };
  });

  // Setup user.findUnique to return a mock user
  client.user.findUnique.mockImplementation(async ({ where }) => {
    if (where.id && where.id.startsWith('user-')) {
      return {
        id: where.id,
        plexId: `plex-${where.id}`,
        plexUsername: `testuser-${where.id}`,
        email: `${where.id}@example.com`,
        role: 'USER',
        plexToken: 'encrypted-token',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        status: 'active',
        name: null,
        image: null,
        requiresPasswordChange: false,
        onboardingCompleted: false,
        onboardingSkipped: false,
        onboardingStep: null,
        onboardingCompletedAt: null,
      };
    }
    return null;
  });

  // Setup user.findMany to return mock users
  client.user.findMany.mockImplementation(async ({ where }) => {
    if (where?.id?.in) {
      return where.id.in.map((id: string) => ({
        id,
        plexId: `plex-${id}`,
        plexUsername: `testuser-${id}`,
        email: `${id}@example.com`,
        role: 'USER',
        plexToken: 'encrypted-token',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        status: 'active',
        name: null,
        image: null,
        requiresPasswordChange: false,
        onboardingCompleted: false,
        onboardingSkipped: false,
        onboardingStep: null,
        onboardingCompletedAt: null,
      }));
    }
    return [];
  });

  // Setup session.findUnique to return null (deleted sessions)
  client.session.findUnique.mockResolvedValue(null);

  // Setup session.delete to resolve successfully
  client.session.delete.mockResolvedValue({
    id: 'deleted',
    sessionToken: 'deleted',
    userId: 'deleted',
    expires: new Date(),
  });

  return client;
};

// Export a singleton instance for tests
export const testPrismaClient = createTestPrismaClient();
