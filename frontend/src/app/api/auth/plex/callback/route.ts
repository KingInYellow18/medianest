import { NextRequest, NextResponse } from 'next/server';

import { checkPlexPin, getPlexHeaders } from '@/lib/auth/plex-provider';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { authToken } = body;

    if (!authToken) {
      return NextResponse.json({ error: 'Auth token is required' }, { status: 400 });
    }

    // Validate token format
    if (typeof authToken !== 'string' || authToken.length < 10) {
      return NextResponse.json({ error: 'Invalid auth token format' }, { status: 400 });
    }

    let plexUser;
    try {
      plexUser = await checkPlexPin(parseInt(authToken), 'client-id', getPlexHeaders('client-id'));
    } catch (error: any) {
      if (error.message?.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Plex API rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: 'Invalid Plex authentication token' }, { status: 401 });
    }

    // Sanitize user data
    const sanitizedUsername = plexUser.username
      ?.replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/[<>"']/g, (match) => {
        const entities: { [key: string]: string } = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
        };
        return entities[match] || match;
      });

    const email = plexUser.email || `${plexUser.username}@plex.local`;

    try {
      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { plexId: plexUser.id.toString() },
      });

      if (user) {
        // Update existing user's token
        user = await prisma.user.update({
          where: { plexId: plexUser.id.toString() },
          data: { plexToken: authToken },
        });
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            email,
            plexUsername: sanitizedUsername || plexUser.username,
            plexId: plexUser.id.toString(),
            plexToken: authToken,
            role: 'USER',
          },
        });
      }

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username: user.plexUsername || user.name,
          email: user.email,
          plexId: user.plexId,
          role: user.role,
        },
      });
    } catch (dbError: any) {
      console.error('Database error during Plex callback:', dbError.message);
      return NextResponse.json({ error: 'Database error occurred' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Failed to complete Plex authentication:', error.message);
    return NextResponse.json({ error: 'Failed to complete authentication' }, { status: 500 });
  }
}

// Utility function for generating client identifiers (currently unused)
// function generateClientIdentifier(): string {
//   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
//     const r = (Math.random() * 16) | 0;
//     const v = c === 'x' ? r : (r & 0x3) | 0x8;
//     return v.toString(16);
//   });
// }
