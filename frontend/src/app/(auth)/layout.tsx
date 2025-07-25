import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import prisma from '@/lib/db/prisma';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/auth/signin');
  }

  // Check if user needs to complete onboarding
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      onboardingCompleted: true,
      onboardingSkipped: true,
      requiresPasswordChange: true,
    },
  });

  // Redirect to password change if required
  if (user?.requiresPasswordChange) {
    redirect('/auth/change-password');
  }

  // Redirect to onboarding if not completed
  if (!user?.onboardingCompleted && !user?.onboardingSkipped) {
    redirect('/onboarding');
  }

  return <>{children}</>;
}