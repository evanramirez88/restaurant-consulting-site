import React from 'react';
import type { Priority } from '../types';

interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'priority' | 'health';
  size?: 'sm' | 'md';
  className?: string;
}

export default function StatusBadge({
  status,
  variant = 'default',
  size = 'md',
  className = ''
}: StatusBadgeProps) {
  const getColors = () => {
    if (variant === 'priority') {
      switch (status.toLowerCase() as Priority) {
        case 'critical':
          return 'text-red-400 bg-red-500/20 border-red-500/30';
        case 'high':
          return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
        case 'medium':
          return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
        case 'low':
          return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
        default:
          return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
      }
    }

    if (variant === 'health') {
      switch (status.toLowerCase()) {
        case 'healthy':
        case 'on_track':
        case 'low':
          return 'text-green-400 bg-green-500/20 border-green-500/30';
        case 'warning':
        case 'at_risk':
        case 'medium':
          return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
        case 'critical':
        case 'behind':
        case 'high':
        case 'error':
          return 'text-red-400 bg-red-500/20 border-red-500/30';
        case 'idle':
          return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
        default:
          return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
      }
    }

    // Default variant
    switch (status.toLowerCase()) {
      case 'active':
      case 'completed':
      case 'success':
      case 'approved':
      case 'published':
        return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'pending':
      case 'in_progress':
      case 'queued':
      case 'draft':
        return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
      case 'error':
      case 'failed':
      case 'rejected':
      case 'declined':
        return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'snoozed':
      case 'paused':
        return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
      case 'dismissed':
      case 'archived':
      case 'expired':
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs'
  };

  const formatStatus = (s: string) => {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${sizeClasses[size]} ${getColors()} ${className}`}
      role="status"
    >
      {formatStatus(status)}
    </span>
  );
}
