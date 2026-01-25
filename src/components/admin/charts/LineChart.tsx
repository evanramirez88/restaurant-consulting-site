import React from 'react';

export interface DataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface LineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  showDots?: boolean;
  showArea?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  showTooltip?: boolean;
  yAxisFormatter?: (value: number) => string;
  xAxisFormatter?: (date: string) => string;
  className?: string;
  title?: string;
}

/**
 * LineChart - Simple SVG line chart for trends
 * Designed for revenue trajectory and time-series data
 */
export default function LineChart({
  data,
  width = 400,
  height = 200,
  strokeColor = '#f59e0b',
  fillColor = 'rgba(245, 158, 11, 0.15)',
  strokeWidth = 2,
  showDots = true,
  showArea = true,
  showGrid = true,
  showLabels = true,
  yAxisFormatter = (v) => v.toLocaleString(),
  xAxisFormatter = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  className = '',
  title
}: LineChartProps) {
  // Margins for axes
  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  if (!data || data.length < 2) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <p className="text-gray-500 text-sm">Not enough data</p>
      </div>
    );
  }

  // Calculate min/max
  const values = data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const padding = range * 0.1;

  // Y-axis scale
  const yMin = Math.max(0, minValue - padding);
  const yMax = maxValue + padding;
  const yRange = yMax - yMin || 1;

  const normalizeY = (value: number): number => {
    const normalized = (value - yMin) / yRange;
    return innerHeight - normalized * innerHeight;
  };

  // X-axis scale
  const stepX = innerWidth / (data.length - 1);

  // Generate points
  const points = data.map((d, index) => ({
    x: index * stepX,
    y: normalizeY(d.value),
    data: d
  }));

  // Create paths
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`)
    .join(' ');

  const areaPath = `${linePath} L ${innerWidth},${innerHeight} L 0,${innerHeight} Z`;

  // Generate grid lines (5 horizontal lines)
  const gridLines = [];
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const y = (innerHeight / gridCount) * i;
    const value = yMax - (yRange / gridCount) * i;
    gridLines.push({ y, value });
  }

  // X-axis labels (show first, middle, last)
  const xLabels = [
    { index: 0, x: 0 },
    { index: Math.floor(data.length / 2), x: innerWidth / 2 },
    { index: data.length - 1, x: innerWidth }
  ];

  const [hoveredPoint, setHoveredPoint] = React.useState<number | null>(null);

  return (
    <div className={className}>
      {title && (
        <h4 className="text-sm font-medium text-gray-400 mb-2">{title}</h4>
      )}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Grid lines */}
          {showGrid && gridLines.map((line, i) => (
            <g key={i}>
              <line
                x1={0}
                y1={line.y}
                x2={innerWidth}
                y2={line.y}
                stroke="#374151"
                strokeWidth={1}
                strokeDasharray={i === gridCount ? '' : '4 4'}
              />
              {showLabels && (
                <text
                  x={-8}
                  y={line.y + 4}
                  textAnchor="end"
                  className="fill-gray-500 text-xs"
                  style={{ fontSize: '10px' }}
                >
                  {yAxisFormatter(line.value)}
                </text>
              )}
            </g>
          ))}

          {/* Area fill */}
          {showArea && (
            <path
              d={areaPath}
              fill={fillColor}
            />
          )}

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dots */}
          {showDots && points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={hoveredPoint === index ? 5 : 3}
              fill={hoveredPoint === index ? '#fff' : strokeColor}
              stroke={strokeColor}
              strokeWidth={2}
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHoveredPoint(index)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}

          {/* X-axis labels */}
          {showLabels && xLabels.map(({ index, x }) => (
            <text
              key={index}
              x={x}
              y={innerHeight + 20}
              textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
              className="fill-gray-500"
              style={{ fontSize: '10px' }}
            >
              {xAxisFormatter(data[index].date)}
            </text>
          ))}

          {/* Tooltip */}
          {hoveredPoint !== null && (
            <g transform={`translate(${points[hoveredPoint].x}, ${points[hoveredPoint].y - 30})`}>
              <rect
                x={-40}
                y={-10}
                width={80}
                height={24}
                rx={4}
                fill="#1f2937"
                stroke="#374151"
              />
              <text
                x={0}
                y={6}
                textAnchor="middle"
                className="fill-white"
                style={{ fontSize: '11px', fontWeight: 500 }}
              >
                {yAxisFormatter(data[hoveredPoint].value)}
              </text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
