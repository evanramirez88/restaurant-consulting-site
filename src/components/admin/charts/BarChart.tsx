import React from 'react';

export interface BarDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarDataPoint[];
  width?: number;
  height?: number;
  barColor?: string;
  showLabels?: boolean;
  showValues?: boolean;
  horizontal?: boolean;
  valueFormatter?: (value: number) => string;
  className?: string;
  title?: string;
  maxValue?: number;
}

/**
 * BarChart - SVG bar chart for comparisons
 * Supports both vertical and horizontal orientations
 */
export default function BarChart({
  data,
  width = 300,
  height = 200,
  barColor = '#f59e0b',
  showLabels = true,
  showValues = true,
  horizontal = false,
  valueFormatter = (v) => v.toLocaleString(),
  className = '',
  title,
  maxValue
}: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <p className="text-gray-500 text-sm">No data</p>
      </div>
    );
  }

  const margin = horizontal
    ? { top: 10, right: 40, bottom: 10, left: 80 }
    : { top: 20, right: 10, bottom: 40, left: 40 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const max = maxValue || Math.max(...data.map(d => d.value));

  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  if (horizontal) {
    // Horizontal bar chart
    const barHeight = Math.min(30, (innerHeight - (data.length - 1) * 4) / data.length);
    const gap = 4;

    return (
      <div className={className}>
        {title && (
          <h4 className="text-sm font-medium text-gray-400 mb-2">{title}</h4>
        )}
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {data.map((item, index) => {
              const barWidth = max > 0 ? (item.value / max) * innerWidth : 0;
              const y = index * (barHeight + gap);
              const isHovered = hoveredIndex === index;

              return (
                <g
                  key={index}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="cursor-pointer"
                >
                  {/* Background bar */}
                  <rect
                    x={0}
                    y={y}
                    width={innerWidth}
                    height={barHeight}
                    fill="#1f2937"
                    rx={4}
                  />

                  {/* Value bar */}
                  <rect
                    x={0}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={item.color || barColor}
                    rx={4}
                    opacity={isHovered ? 1 : 0.85}
                    className="transition-opacity"
                  />

                  {/* Label */}
                  {showLabels && (
                    <text
                      x={-8}
                      y={y + barHeight / 2 + 4}
                      textAnchor="end"
                      className="fill-gray-400"
                      style={{ fontSize: '11px' }}
                    >
                      {item.label}
                    </text>
                  )}

                  {/* Value */}
                  {showValues && (
                    <text
                      x={barWidth + 8}
                      y={y + barHeight / 2 + 4}
                      textAnchor="start"
                      className="fill-white font-medium"
                      style={{ fontSize: '11px' }}
                    >
                      {valueFormatter(item.value)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    );
  }

  // Vertical bar chart
  const barWidth = Math.min(40, (innerWidth - (data.length - 1) * 8) / data.length);
  const gap = 8;
  const totalBarsWidth = data.length * barWidth + (data.length - 1) * gap;
  const startX = (innerWidth - totalBarsWidth) / 2;

  return (
    <div className={className}>
      {title && (
        <h4 className="text-sm font-medium text-gray-400 mb-2">{title}</h4>
      )}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <g key={i}>
              <line
                x1={0}
                y1={innerHeight * (1 - ratio)}
                x2={innerWidth}
                y2={innerHeight * (1 - ratio)}
                stroke="#374151"
                strokeWidth={1}
                strokeDasharray={i === 0 ? '' : '4 4'}
              />
              {i > 0 && (
                <text
                  x={-8}
                  y={innerHeight * (1 - ratio) + 4}
                  textAnchor="end"
                  className="fill-gray-500"
                  style={{ fontSize: '10px' }}
                >
                  {valueFormatter(max * ratio)}
                </text>
              )}
            </g>
          ))}

          {/* Bars */}
          {data.map((item, index) => {
            const barHeight = max > 0 ? (item.value / max) * innerHeight : 0;
            const x = startX + index * (barWidth + gap);
            const y = innerHeight - barHeight;
            const isHovered = hoveredIndex === index;

            return (
              <g
                key={index}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
              >
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={item.color || barColor}
                  rx={4}
                  opacity={isHovered ? 1 : 0.85}
                  className="transition-all"
                />

                {/* Label */}
                {showLabels && (
                  <text
                    x={x + barWidth / 2}
                    y={innerHeight + 16}
                    textAnchor="middle"
                    className="fill-gray-400"
                    style={{ fontSize: '10px' }}
                  >
                    {item.label}
                  </text>
                )}

                {/* Value on hover */}
                {isHovered && (
                  <g transform={`translate(${x + barWidth / 2}, ${y - 12})`}>
                    <rect
                      x={-30}
                      y={-12}
                      width={60}
                      height={20}
                      rx={4}
                      fill="#1f2937"
                      stroke="#374151"
                    />
                    <text
                      x={0}
                      y={4}
                      textAnchor="middle"
                      className="fill-white"
                      style={{ fontSize: '11px', fontWeight: 500 }}
                    >
                      {valueFormatter(item.value)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
