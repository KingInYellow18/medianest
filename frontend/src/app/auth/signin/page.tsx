'use client';

import { Loader2, AlertCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const error = searchParams.get('error');

  const [isLoading, setIsLoading] = useState(false);
  const [plexPin, setPlexPin] = useState<string | null>(null);
  const [plexSessionId, setPlexSessionId] = useState<string | null>(null);
  const [plexAuthUrl, setPlexAuthUrl] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Admin login state
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');

  // Start Plex PIN authentication flow
  const startPlexAuth = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/plex/pin', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start authentication');
      }

      const data = await response.json();
      setPlexPin(data.pin);
      setPlexSessionId(data.sessionId);
      setPlexAuthUrl(data.authUrl);
      setIsPolling(true);

      // Open Plex auth page in new window
      window.open(data.authUrl, 'plexAuth', 'width=800,height=600');
    } catch (error) {
      console.error('Failed to start Plex authentication:', error);
      alert('Failed to start Plex authentication. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for PIN authorization
  const pollForAuthorization = useCallback(async () => {
    if (!plexSessionId || !isPolling) return;

    try {
      const response = await fetch(`/api/auth/plex/pin?sessionId=${plexSessionId}`);

      if (!response.ok) {
        throw new Error('Failed to check authorization');
      }

      const data = await response.json();

      if (data.authorized) {
        setIsPolling(false);

        // Exchange Plex token for NextAuth session
        const callbackResponse = await fetch('/api/auth/plex/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authToken: data.authToken }),
        });

        if (callbackResponse.ok) {
          router.push(callbackUrl);
        } else {
          throw new Error('Failed to complete authentication');
        }
      }
    } catch (error) {
      console.error('Failed to check authorization:', error);
      setIsPolling(false);
      alert('Authentication failed. Please try again.');
    }
  }, [plexSessionId, isPolling, callbackUrl, router]);

  // Poll for authorization every 2 seconds
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(pollForAuthorization, 2000);

    return () => clearInterval(interval);
  }, [isPolling, pollForAuthorization]);

  // Handle admin login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn('admin-bootstrap', {
        username: adminUsername,
        password: adminPassword,
        redirect: false,
      });

      if (result?.error) {
        alert('Invalid credentials');
      } else if (result?.ok) {
        router.push('/auth/change-password?requiresPasswordChange=true');
      }
    } catch (error) {
      console.error('Admin login failed:', error);
      alert('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Sign in to MediaNest</CardTitle>
          <CardDescription className="text-center">
            Access your media server and services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error === 'OAuthSignin' && 'Failed to start authentication'}
                {error === 'OAuthCallback' && 'Authentication failed'}
                {error === 'OAuthCreateAccount' && 'Failed to create account'}
                {error === 'EmailCreateAccount' && 'Failed to create account'}
                {error === 'Callback' && 'Authentication failed'}
                {error === 'Default' && 'An error occurred during sign in'}
              </AlertDescription>
            </Alert>
          )}

          {!showAdminLogin ? (
            <>
              {!plexPin ? (
                <Button onClick={startPlexAuth} disabled={isLoading} className="w-full" size="lg">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting authentication...
                    </>
                  ) : (
                    <>
                      <img src="/plex-logo.svg" alt="Plex" className="mr-2 h-5 w-5" />
                      Sign in with Plex
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Enter this PIN on the Plex website:
                    </p>
                    <p className="text-4xl font-bold tracking-wider">{plexPin}</p>
                  </div>

                  {plexAuthUrl && (
                    <Button
                      onClick={() => window.open(plexAuthUrl, 'plexAuth', 'width=800,height=600')}
                      variant="outline"
                      className="w-full"
                    >
                      Open Plex Authorization Page
                    </Button>
                  )}

                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Waiting for authorization...
                    </p>
                  </div>

                  <Button
                    onClick={() => {
                      setIsPolling(false);
                      setPlexPin(null);
                      setPlexSessionId(null);
                      setPlexAuthUrl(null);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-gray-900 px-2 text-gray-500 dark:text-gray-400">
                    First time setup?
                  </span>
                </div>
              </div>

              <Button onClick={() => setShowAdminLogin(true)} variant="outline" className="w-full">
                Admin Setup
              </Button>
            </>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  disabled
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Default: admin"
                  required
                />
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in as Admin'
                )}
              </Button>

              <Button
                type="button"
                onClick={() => setShowAdminLogin(false)}
                variant="outline"
                className="w-full"
              >
                Back to Plex Login
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
