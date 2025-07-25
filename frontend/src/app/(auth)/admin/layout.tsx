'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
