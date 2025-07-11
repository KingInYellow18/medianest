'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface UpdateAnimationProps {
  serviceId: string;
  children: React.ReactNode;
}

export function UpdateAnimation({ serviceId, children }: UpdateAnimationProps) {
  const queryClient = useQueryClient();
  
  const { data: update } = useQuery({
    queryKey: ['service-update', serviceId],
    enabled: false, // Only used for animation trigger
    staleTime: 1000, // Clear after animation
    gcTime: 1000 // Garbage collect after 1 second
  });

  return (
    <AnimatePresence mode="wait">
      {update ? (
        <motion.div
          key={`update-${serviceId}-${Date.now()}`}
          initial={{ scale: 1 }}
          animate={{ 
            scale: [1, 1.03, 1],
            borderColor: ['rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 0.5)', 'rgba(59, 130, 246, 0)']
          }}
          transition={{ 
            duration: 0.6,
            ease: 'easeInOut'
          }}
          style={{
            borderWidth: 2,
            borderStyle: 'solid',
            borderRadius: '0.5rem'
          }}
        >
          {children}
        </motion.div>
      ) : (
        <div>{children}</div>
      )}
    </AnimatePresence>
  );
}