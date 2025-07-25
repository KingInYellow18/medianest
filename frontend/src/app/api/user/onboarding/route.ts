import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import prisma from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { completed, skipped } = body;

    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        onboardingCompleted: completed || false,
        onboardingSkipped: skipped || false,
        onboardingCompletedAt: completed ? new Date() : undefined,
        onboardingStep: completed ? null : body.currentStep,
      },
    });

    return Response.json({
      success: true,
      onboardingCompleted: updatedUser.onboardingCompleted,
      onboardingSkipped: updatedUser.onboardingSkipped,
    });
  } catch (error) {
    console.error('Error updating onboarding status:', error);
    return new Response('Failed to update onboarding status', { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        onboardingCompleted: true,
        onboardingSkipped: true,
        onboardingStep: true,
        onboardingCompletedAt: true,
      },
    });

    if (!user) {
      return new Response('User not found', { status: 404 });
    }

    return Response.json(user);
  } catch (error) {
    console.error('Error fetching onboarding status:', error);
    return new Response('Failed to fetch onboarding status', { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        onboardingCompleted: false,
        onboardingSkipped: false,
        onboardingStep: null,
        onboardingCompletedAt: null,
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error resetting onboarding:', error);
    return new Response('Failed to reset onboarding', { status: 500 });
  }
}