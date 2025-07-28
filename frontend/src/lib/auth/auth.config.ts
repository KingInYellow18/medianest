import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '../db/prisma';
import PlexProvider from './plex-provider';
import CredentialsProvider from 'next-auth/providers/credentials';
import { z } from 'zod';
import { getPlexAuthConfig } from '@/config';

// Admin credentials schema
const adminCredentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// This will be used to dynamically add the admin provider
export async function getAuthOptions(): Promise<NextAuthOptions> {
  // Check if this is the first run (no users in database)
  const userCount = await prisma.user.count();
  const isFirstRun = userCount === 0;

  const providers: any[] = [
    // Plex OAuth provider
    PlexProvider({
      ...getPlexAuthConfig(),
      product: 'MediaNest',
      device: 'Web',
      deviceName: 'MediaNest Web Portal',
      platform: 'Web',
      platformVersion: '1.0',
      version: '1.0.0',
    }),
  ];

  // Add admin bootstrap provider only on first run
  if (isFirstRun) {
    providers.push(
      CredentialsProvider({
        id: 'admin-bootstrap',
        name: 'Admin Bootstrap',
        credentials: {
          username: { label: 'Username', type: 'text', value: 'admin' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          const parsed = adminCredentialsSchema.safeParse(credentials);

          if (!parsed.success) {
            return null;
          }

          // Only allow admin/admin on first run
          if (parsed.data.username === 'admin' && parsed.data.password === 'admin') {
            // Create the admin user
            const adminUser = await prisma.user.create({
              data: {
                email: 'admin@medianest.local',
                name: 'Administrator',
                role: 'ADMIN',
                plexId: null,
                plexUsername: null,
                // Force password change on first login
                requiresPasswordChange: true,
              },
            });

            return {
              id: adminUser.id,
              email: adminUser.email,
              name: adminUser.name,
              role: adminUser.role,
              requiresPasswordChange: true,
            };
          }

          return null;
        },
      }),
    );
  }

  return {
    adapter: PrismaAdapter(prisma as any) as any,
    providers,
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },

    jwt: {
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },

    pages: {
      signIn: '/auth/signin',
      signOut: '/auth/signout',
      error: '/auth/error',
      verifyRequest: '/auth/verify-request',
      newUser: '/auth/new-user',
    },

    callbacks: {
      async signIn({ user, account, profile }) {
        // Handle Plex sign in
        if (account?.provider === 'plex') {
          const plexProfile = profile as any;

          // Update or create user with Plex data
          await prisma.user.upsert({
            where: { email: user.email! },
            update: {
              plexId: plexProfile.id,
              plexUsername: plexProfile.username,
              plexToken: account.access_token,
              image: plexProfile.thumb,
            },
            create: {
              email: user.email!,
              name: user.name!,
              plexId: plexProfile.id,
              plexUsername: plexProfile.username,
              plexToken: account.access_token,
              image: plexProfile.thumb,
              role: 'USER',
            },
          });
        }

        return true;
      },

      async session({ session, token }) {
        if (token) {
          session.user.id = token.id as string;
          session.user.role = token.role as string;
          session.user.requiresPasswordChange = token.requiresPasswordChange as boolean;
          session.user.onboardingCompleted = token.onboardingCompleted as boolean;
          session.user.onboardingSkipped = token.onboardingSkipped as boolean;
        }

        return session;
      },

      async jwt({ token, user, account }) {
        if (user) {
          token.id = user.id;
          token.role = (user as any).role;
          token.requiresPasswordChange = (user as any).requiresPasswordChange;
          token.onboardingCompleted = (user as any).onboardingCompleted;
          token.onboardingSkipped = (user as any).onboardingSkipped;
        }

        // Update token with fresh user data on each request
        if (token.id) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              role: true,
              requiresPasswordChange: true,
              onboardingCompleted: true,
              onboardingSkipped: true,
            },
          });

          if (dbUser) {
            token.role = dbUser.role;
            token.requiresPasswordChange = dbUser.requiresPasswordChange;
            token.onboardingCompleted = dbUser.onboardingCompleted;
            token.onboardingSkipped = dbUser.onboardingSkipped;
          }
        }

        // Store Plex token for API calls
        if (account?.provider === 'plex') {
          token.plexToken = account.access_token;
        }

        return token;
      },

      async redirect({ url, baseUrl }) {
        // Redirect to password change page if required
        if (url.includes('requiresPasswordChange=true')) {
          return `${baseUrl}/auth/change-password`;
        }

        // Redirect to onboarding for new users
        if (url.includes('newUser=true')) {
          return `${baseUrl}/onboarding`;
        }

        // Allows relative callback URLs
        if (url.startsWith('/')) return `${baseUrl}${url}`;

        // Allows callback URLs on the same origin
        if (new URL(url).origin === baseUrl) return url;

        return baseUrl;
      },
    },

    events: {
      async signIn({ user, account, profile: _profile, isNewUser: _isNewUser }) {
        console.log(`User ${user.email} signed in via ${account?.provider}`);
      },

      async signOut({ session: _session, token: _token }) {
        console.log(`User signed out`);
      },
    },

    debug: process.env.NODE_ENV === 'development',
  };
}
