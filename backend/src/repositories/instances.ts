import { PrismaClient } from '@prisma/client';

import { createRepositories } from './index';

// Create a single PrismaClient instance
const prisma = new PrismaClient();

// Create repository instances
const repositories = createRepositories(prisma);

// Export individual repositories
export const userRepository = repositories.userRepository;
export const mediaRequestRepository = repositories.mediaRequestRepository;
export const youtubeDownloadRepository = repositories.youtubeDownloadRepository;
export const serviceStatusRepository = repositories.serviceStatusRepository;
export const serviceConfigRepository = repositories.serviceConfigRepository;
export const sessionTokenRepository = repositories.sessionTokenRepository;

// Export prisma for direct access if needed
export { prisma };
