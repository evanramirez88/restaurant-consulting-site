import React from 'react';

export interface SparkLineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  showDots?: boolean;
  showArea?: boolean;
  className?: string;
}

/**
 * SparkLine - A minimal inline trend indicator using pure SVG
 * Perfect for showing trends in metric cards and compact spaces
 */
export default function SparkLine({
  data,
  width = 80,
  height = 24,
  strokeColor = '#f59e0b',
  fillColor = 'rgba(245, 158, 11, 0.1)',
  strokeWidth = 1.5,
  showDots = false,
  showArea = true,
  className = ''
}: SparkLineProps) {
  if (!data || data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#4b5563"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
      </svg>
    );
  }

  // Calculate min/max with padding
  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const range = maxValue - minValue || 1;
  const padding = range * 0.1;

  // Normalize data to SVG coordinates
  const normalizeY = (value: number): number => {
    const normalized = (value - (minValue - padding)) / (range + padding * 2);
    return height - normalized * height;
  };

  // Calculate x positions
  const stepX = width / (data.length - 1);

  // Generate path points
  const points = data.map((value, index) => ({
    x: index * stepX,
    y: normalizeY(value)
  }));

  // Create line path
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`)
    .join(' ');

  // Create area path (for gradient fill)
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  // Determine trend direction for color
  const trend = data[data.length - 1] - data[0];
  const trendColor = trend > 0 ? '#22c55e' : trend < 0 ? '#ef4444' : strokeColor;
  const trendFill = trend > 0 ? 'rgba(34, 197, 94, 0.1)' : trend < 0 ? 'rgba(239, 68, 68, 0.1)' : fillColor;

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {/* Area fill */}
      {showArea && (
        <path
          d={areaPath}
          fill={trendFill}
        />
      )}

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={trendColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End dot */}
      {showDots && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={2.5}
          fill={trendColor}
        />
      )}
    </svg>
  );
}
