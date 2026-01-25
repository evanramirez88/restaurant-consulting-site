import React from 'react';

export interface HealthGaugeProps {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  showTrend?: 'up' | 'down' | 'stable' | null;
  label?: string;
  className?: string;
}

/**
 * HealthGauge - Circular progress indicator for health scores
 * Displays a donut-style gauge with color-coded status
 */
export default function HealthGauge({
  score,
  size = 120,
  strokeWidth = 10,
  showLabel = true,
  showTrend = null,
  label = 'Health Score',
  className = ''
}: HealthGaugeProps) {
  // Clamp score to 0-100
  const clampedScore = Math.max(0, Math.min(100, score));

  // Calculate dimensions
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;
  const center = size / 2;

  // Determine color based on score
  const getColor = (s: number): string => {
    if (s >= 80) return '#22c55e'; // green
    if (s >= 60) return '#84cc16'; // lime
    if (s >= 40) return '#eab308'; // yellow
    if (s >= 20) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const color = getColor(clampedScore);

  // Status text
  const getStatus = (s: number): string => {
    if (s >= 80) return 'Excellent';
    if (s >= 60) return 'Good';
    if (s >= 40) return 'Fair';
    if (s >= 20) return 'Poor';
    return 'Critical';
  };

  // Trend arrow paths
  const trendArrows = {
    up: 'M8 12l4-4 4 4M12 8v8',
    down: 'M8 8l4 4 4-4M12 8v8',
    stable: 'M4 12h16'
  };

  const trendColors = {
    up: '#22c55e',
    down: '#ef4444',
    stable: '#6b7280'
  };

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#374151"
            strokeWidth={strokeWidth}
          />

          {/* Progress arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={color} stopOpacity="0.6" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center content */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ transform: 'translateY(-2px)' }}
        >
          <span
            className="font-bold"
            style={{
              fontSize: size * 0.28,
              color: color,
              lineHeight: 1
            }}
          >
            {Math.round(clampedScore)}
          </span>
          {showLabel && (
            <span
              className="text-gray-400 mt-1"
              style={{ fontSize: size * 0.1 }}
            >
              {getStatus(clampedScore)}
            </span>
          )}
        </div>

        {/* Trend indicator */}
        {showTrend && (
          <div
            className="absolute"
            style={{
              bottom: -4,
              right: -4,
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <path
                d={trendArrows[showTrend]}
                stroke={trendColors[showTrend]}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Label below */}
      {label && (
        <span className="text-gray-500 text-xs mt-2">{label}</span>
      )}
    </div>
  );
}
