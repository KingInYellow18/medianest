import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import prisma from '@/lib/db/prisma';

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/auth/signin');
  }

  // Check if user has already completed onboarding
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      onboardingCompleted: true,
      onboardingSkipped: true,
    },
  });

  if (user?.onboardingCompleted || user?.onboardingSkipped) {
    redirect('/dashboard');
  }

  return <OnboardingWizard />;
}