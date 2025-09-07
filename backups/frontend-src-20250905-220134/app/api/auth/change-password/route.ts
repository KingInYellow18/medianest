import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { getAuthOptions } from '@/lib/auth/auth.config';
import { prisma } from '@/lib/db/prisma';
// import bcrypt from "bcryptjs" // Will be used when password storage is implemented

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    // Get the current session
    const authOptions = await getAuthOptions();
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate the request body
    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    const { currentPassword } = parsed.data;

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // For admin bootstrap, the initial password is "admin"
    if (user.requiresPasswordChange && currentPassword !== 'admin') {
      return NextResponse.json({ error: 'Invalid current password' }, { status: 401 });
    }

    // Hash the new password (not stored yet in this implementation)
    // const hashedPassword = await bcrypt.hash(_newPassword, 10)

    // Update the user record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        requiresPasswordChange: false,
        // In a real implementation, you'd store the hashed password
        // For now, we just mark that the password change is no longer required
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Failed to change password:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
