import NextAuth from 'next-auth';

import { getAuthOptions } from '@/lib/auth/auth.config';

// Create the handler with dynamic options
async function createHandler() {
  const authOptions = await getAuthOptions();
  return NextAuth(authOptions);
}

// Export dynamic route handlers
export async function GET(req: Request, res: Response) {
  const handler = await createHandler();
  return handler(req, res);
}

export async function POST(req: Request, res: Response) {
  const handler = await createHandler();
  return handler(req, res);
}
