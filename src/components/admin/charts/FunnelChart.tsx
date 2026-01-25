import React from 'react';

export interface FunnelStage {
  label: string;
  value: number;
  color?: string;
}

export interface FunnelChartProps {
  stages: FunnelStage[];
  width?: number;
  height?: number;
  showPercentages?: boolean;
  showValues?: boolean;
  valueFormatter?: (value: number) => string;
  className?: string;
  title?: string;
}

/**
 * FunnelChart - SVG pipeline funnel visualization
 * Shows progression through stages with conversion rates
 */
export default function FunnelChart({
  stages,
  width = 300,
  height = 200,
  showPercentages = true,
  showValues = true,
  valueFormatter = (v) => v.toLocaleString(),
  className = '',
  title
}: FunnelChartProps) {
  if (!stages || stages.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <p className="text-gray-500 text-sm">No data</p>
      </div>
    );
  }

  const margin = { top: 10, right: 60, bottom: 10, left: 10 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Calculate the maximum value (first stage) for scaling
  const maxValue = Math.max(...stages.map(s => s.value));

  // Calculate funnel dimensions
  const stageHeight = innerHeight / stages.length;
  const minWidth = innerWidth * 0.3; // Minimum width for the smallest stage
  const maxWidth = innerWidth;

  // Default colors for funnel stages
  const defaultColors = [
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#a855f7', // purple
    '#d946ef', // fuchsia
    '#ec4899', // pink
    '#f43f5e', // rose
  ];

  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  return (
    <div className={className}>
      {title && (
        <h4 className="text-sm font-medium text-gray-400 mb-2">{title}</h4>
      )}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {stages.map((stage, index) => {
            // Calculate width based on value (with minimum width)
            const widthRatio = maxValue > 0 ? stage.value / maxValue : 0;
            const stageWidth = minWidth + (maxWidth - minWidth) * widthRatio;

            // Calculate position (centered)
            const x = (innerWidth - stageWidth) / 2;
            const y = index * stageHeight;

            // Calculate conversion percentage from previous stage
            const prevValue = index > 0 ? stages[index - 1].value : stage.value;
            const conversionRate = prevValue > 0 ? (stage.value / prevValue) * 100 : 100;

            const isHovered = hoveredIndex === index;
            const color = stage.color || defaultColors[index % defaultColors.length];

            // Create trapezoid shape
            const nextStageWidth = index < stages.length - 1
              ? minWidth + (maxWidth - minWidth) * (stages[index + 1].value / maxValue)
              : stageWidth * 0.8;
            const nextX = (innerWidth - nextStageWidth) / 2;

            const path = `
              M ${x},${y}
              L ${x + stageWidth},${y}
              L ${index < stages.length - 1 ? nextX + nextStageWidth : x + stageWidth * 0.9},${y + stageHeight}
              L ${index < stages.length - 1 ? nextX : x + stageWidth * 0.1},${y + stageHeight}
              Z
            `;

            return (
              <g
                key={index}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
              >
                {/* Funnel segment */}
                <path
                  d={path}
                  fill={color}
                  opacity={isHovered ? 1 : 0.85}
                  className="transition-opacity"
                />

                {/* Stage label */}
                <text
                  x={innerWidth / 2}
                  y={y + stageHeight / 2 - 6}
                  textAnchor="middle"
                  className="fill-white font-medium"
                  style={{ fontSize: '12px' }}
                >
                  {stage.label}
                </text>

                {/* Value */}
                {showValues && (
                  <text
                    x={innerWidth / 2}
                    y={y + stageHeight / 2 + 10}
                    textAnchor="middle"
                    className="fill-white/80"
                    style={{ fontSize: '11px' }}
                  >
                    {valueFormatter(stage.value)}
                  </text>
                )}

                {/* Conversion percentage (on the right) */}
                {showPercentages && index > 0 && (
                  <g transform={`translate(${innerWidth + 10}, ${y + stageHeight / 2})`}>
                    <text
                      x={0}
                      y={0}
                      textAnchor="start"
                      className={`font-medium ${conversionRate >= 50 ? 'fill-green-400' : conversionRate >= 25 ? 'fill-yellow-400' : 'fill-red-400'}`}
                      style={{ fontSize: '11px' }}
                    >
                      {conversionRate.toFixed(0)}%
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
