// Re-export repository instances for dependency injection
import { PrismaClient } from '@prisma/client';

import { MediaRequestRepository } from './media-request.repository';
import { ServiceConfigRepository } from './service-config.repository';
import { ServiceStatusRepository } from './service-status.repository';
import { SessionTokenRepository } from './session-token.repository';
import { UserRepository } from './user.repository';
import { YoutubeDownloadRepository } from './youtube-download.repository';

export * from './base.repository';
export * from './user.repository';
export * from './media-request.repository';
export * from './youtube-download.repository';
export * from './service-status.repository';
export * from './service-config.repository';
export * from './session-token.repository';

export function createRepositories(prisma: PrismaClient) {
  return {
    userRepository: new UserRepository(prisma),
    mediaRequestRepository: new MediaRequestRepository(prisma),
    youtubeDownloadRepository: new YoutubeDownloadRepository(prisma),
    serviceStatusRepository: new ServiceStatusRepository(prisma),
    serviceConfigRepository: new ServiceConfigRepository(prisma),
    sessionTokenRepository: new SessionTokenRepository(prisma),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

// Re-export repository singletons
export {
  userRepository,
  mediaRequestRepository,
  youtubeDownloadRepository,
  serviceStatusRepository,
  serviceConfigRepository,
  sessionTokenRepository,
  prisma,
} from './instances';
