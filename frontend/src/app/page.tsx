import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">MediaNest</h1>
          <p className="text-lg text-gray-600 mb-8">
            Your personal media hub for Plex requests and YouTube downloads
          </p>
          <Link href="/auth/signin">
            <Button size="lg" className="w-full">
              Sign In with Plex
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
