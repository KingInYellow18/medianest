'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface ConnectionStatusProps {
  connected: boolean;
  error?: string | null;
  reconnectAttempt?: number;
}

export function ConnectionStatus({ connected, error, reconnectAttempt = 0 }: ConnectionStatusProps) {
  const showStatus = !connected || error;

  return (
    <AnimatePresence>
      {showStatus && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className={clsx(
            'fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm',
            {
              'bg-yellow-600 text-white': !connected && !error,
              'bg-red-600 text-white': error,
            }
          )}
        >
          <div className="flex items-center justify-center space-x-2">
            {!connected && !error && (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>
                  Reconnecting to live updates...
                  {reconnectAttempt > 0 && ` (Attempt ${reconnectAttempt})`}
                </span>
              </>
            )}
            
            {error && (
              <>
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Connection error: {error}</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}