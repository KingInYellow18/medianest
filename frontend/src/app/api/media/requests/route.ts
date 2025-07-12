import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { getAuthOptions } from '@/lib/auth/auth.config';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

export async function GET(_request: NextRequest) {
  try {
    const authOptions = await getAuthOptions();
  const session = await getServerSession(authOptions);

  if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${BACKEND_URL}/api/v1/media/requests`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching media requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
