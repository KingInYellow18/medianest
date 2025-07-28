'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Server, Check, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSession } from 'next-auth/react';

interface PlexSetupStepProps {
  onNext: () => void;
}

export default function PlexSetupStep({ onNext }: PlexSetupStepProps) {
  const { data: session, status } = useSession();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Check if user already has Plex connected
    if (session?.user?.plexToken) {
      setConnectionStatus('connected');
    }
  }, [session]);

  const handlePlexConnect = async () => {
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setErrorMessage('');

    try {
      // Initiate Plex OAuth flow
      const response = await fetch('/api/auth/plex/pin', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to initiate Plex authentication');
      }

      const { authUrl } = await response.json();

      // Open Plex auth in new window
      const authWindow = window.open(
        authUrl,
        'PlexAuth',
        'width=600,height=700,resizable=yes,scrollbars=yes',
      );

      // Poll for completion
      const checkInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch('/api/auth/plex/callback');
          const statusData = await statusResponse.json();

          if (statusData.authenticated) {
            clearInterval(checkInterval);
            authWindow?.close();
            setConnectionStatus('connected');
            setIsConnecting(false);

            // Give user a moment to see success before moving on
            setTimeout(() => {
              onNext();
            }, 1500);
          }
        } catch (error) {
          // Continue polling
        }
      }, 2000);

      // Cleanup after 5 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        if (connectionStatus === 'connecting') {
          setConnectionStatus('error');
          setErrorMessage('Authentication timeout. Please try again.');
          setIsConnecting(false);
        }
      }, 300000);
    } catch (error) {
      console.error('Plex connection error:', error);
      setConnectionStatus('error');
      setErrorMessage('Failed to connect to Plex. Please try again.');
      setIsConnecting(false);
    }
  };

  const connectionSteps = [
    'Click "Connect with Plex" below',
    'Sign in to your Plex account',
    'Authorize MediaNest to access your libraries',
    'Return to this window to continue',
  ];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-yellow-600 rounded-full mb-6"
        >
          <Server className="w-10 h-10 text-white" />
        </motion.div>

        <h2 className="text-3xl font-bold text-white mb-4">Connect Your Plex Server</h2>
        <p className="text-gray-300 max-w-2xl mx-auto">
          Connect your Plex account to browse your media library, manage requests, and more.
        </p>
      </motion.div>

      {connectionStatus === 'connected' ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-green-900/20 border border-green-700/50 rounded-lg p-6"
        >
          <div className="flex items-center space-x-3 text-green-400">
            <Check className="w-6 h-6" />
            <div>
              <h3 className="text-lg font-semibold">Plex Connected Successfully!</h3>
              <p className="text-sm text-green-400/80">
                Your Plex account is now linked to MediaNest.
              </p>
            </div>
          </div>
        </motion.div>
      ) : (
        <>
          <div className="bg-gray-700/30 backdrop-blur-sm rounded-lg p-6 border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-4">How to Connect:</h3>
            <div className="space-y-3">
              {connectionSteps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="flex items-start space-x-3"
                >
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </span>
                  <span className="text-gray-300">{step}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col items-center space-y-4">
            <Button
              onClick={handlePlexConnect}
              disabled={isConnecting}
              size="lg"
              className="bg-[#E5A00D] hover:bg-[#cc9200] text-black font-semibold px-8 py-3"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <img src="/plex-logo.svg" alt="Plex" className="mr-2 h-5 w-5" />
                  Connect with Plex
                </>
              )}
            </Button>

            {connectionStatus === 'connecting' && (
              <p className="text-sm text-gray-400 text-center">
                A new window should open for Plex authentication.
                <br />
                Please complete the authorization process.
              </p>
            )}

            <button
              onClick={onNext}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Skip for now
            </button>
          </div>
        </>
      )}

      <div className="border-t border-gray-700 pt-6">
        <div className="flex items-start space-x-2 text-sm text-gray-400">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p>
              Don't have a Plex server?{' '}
              <a
                href="https://www.plex.tv/media-server-downloads/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 inline-flex items-center"
              >
                Download Plex Media Server
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
