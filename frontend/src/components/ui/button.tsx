import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'outline';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = 'md', variant = 'primary', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors',
          {
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-4': size === 'md',
            'h-12 px-6 text-lg': size === 'lg',
          },
          {
            'bg-blue-600 text-white hover:bg-blue-700': variant === 'primary',
            'bg-gray-200 text-gray-900 hover:bg-gray-300': variant === 'secondary',
            'border border-gray-300 bg-transparent hover:bg-gray-50': variant === 'outline',
          },
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button };
