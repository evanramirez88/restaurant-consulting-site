import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingPlaceholderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function LoadingPlaceholder({
  message = 'Loading...',
  size = 'md',
  className = ''
}: LoadingPlaceholderProps) {
  const sizeClasses = {
    sm: { icon: 'w-5 h-5', text: 'text-sm', padding: 'py-4' },
    md: { icon: 'w-8 h-8', text: 'text-base', padding: 'py-8' },
    lg: { icon: 'w-12 h-12', text: 'text-lg', padding: 'py-12' }
  };

  const { icon, text, padding } = sizeClasses[size];

  return (
    <div
      className={`flex flex-col items-center justify-center ${padding} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className={`${icon} text-amber-400 animate-spin`} aria-hidden="true" />
      {message && (
        <span className={`mt-3 ${text} text-gray-400`}>
          {message}
        </span>
      )}
      <span className="sr-only">{message}</span>
    </div>
  );
}
