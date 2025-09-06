import NextAuth from 'next-auth';

import { getAuthOptions } from '@/lib/auth/auth.config';

// Create the handler with dynamic options
async function createHandler() {
  const authOptions = await getAuthOptions();
  return NextAuth(authOptions);
}

// Export dynamic route handlers
export async function GET(req: Request) {
  const handler = await createHandler();
  return handler(req);
}

export async function POST(req: Request) {
  const handler = await createHandler();
  return handler(req);
}
