'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { QuickAction } from '@/types/dashboard';

interface QuickActionButtonProps {
  action: QuickAction;
  onClick: (e: React.MouseEvent) => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export function QuickActionButton({ 
  action, 
  onClick, 
  variant = 'primary',
  size = 'md',
  disabled = false
}: QuickActionButtonProps) {
  const getActionText = (action: QuickAction) => {
    switch (action.type) {
      case 'navigate':
        return 'Open';
      case 'configure':
        return 'Configure';
      case 'refresh':
        return 'Refresh';
      default:
        return 'Action';
    }
  };

  const getActionIcon = (action: QuickAction) => {
    switch (action.type) {
      case 'navigate':
        return '🔍';
      case 'configure':
        return '⚙️';
      case 'refresh':
        return '🔄';
      default:
        return '⚡';
    }
  };

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  };

  const disabledClasses = disabled 
    ? 'opacity-50 cursor-not-allowed bg-gray-500 hover:bg-gray-500' 
    : '';

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 
        font-medium rounded-md
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800
        transition-all duration-200
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabledClasses}
      `}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      aria-label={`${getActionText(action)} ${action.serviceId}`}
    >
      <span role="img" aria-hidden="true">
        {getActionIcon(action)}
      </span>
      <span>{getActionText(action)}</span>
    </motion.button>
  );
}