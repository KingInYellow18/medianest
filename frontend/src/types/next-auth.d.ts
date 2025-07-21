import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    role: string;
    requiresPasswordChange?: boolean;
    onboardingCompleted?: boolean;
    onboardingSkipped?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      requiresPasswordChange?: boolean;
      onboardingCompleted?: boolean;
      onboardingSkipped?: boolean;
    } & DefaultSession['user'];
    accessToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    requiresPasswordChange?: boolean;
    plexToken?: string;
    onboardingCompleted?: boolean;
    onboardingSkipped?: boolean;
  }
}
