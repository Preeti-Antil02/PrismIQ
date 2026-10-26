"use client";

import * as React from "react";

// ============================================================================
// Types
// ============================================================================

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  sublabel?: string;
}

export interface BarItem {
  label: string;
  value: number;
  color?: string;
  badge?: string;
  secondaryText?: string;
  onClick?: () => void;
}

export interface StackedSegment {
  label: string;
  value: number;
  color: string;
}

export interface StackedBarRow {
  label: string;
  isTarget?: boolean;
  segments: StackedSegment[];
  totalLabel?: string;
  onClick?: () => void;
}

export interface LineDataPoint {
  label: string; // e.g. "Week -2", "Week -1", "Current"
  [key: string]: string | number;
}

export interface LineSeries {
  key: string;
  name: string;
  color: string;
}

// ============================================================================
// 1. PrismDonutChart (Interactive Donut / Pie Chart)
// ============================================================================

export function PrismDonutChart({
  data,
  title,
  centerLabel,
  centerValue,
  size = 180,
  thickness = 22,
}: {
  data: DonutSegment[];
  title?: string;
  centerLabel?: string;
  centerValue?: string | number;
  size?: number;
  thickness?: number;
}) {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

  const total = React.useMemo(() => {
    return data.reduce((sum, d) => sum + (d.value || 0), 0);
  }, [data]);

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Compute strokeDasharray and offset for each segment
  let accumulatedPercent = 0;
  const segments = data.map((seg, idx) => {
    const pct = total > 0 ? seg.value / total : 0;
    const strokeDasharray = `${pct * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    accumulatedPercent += pct;
    return {
      ...seg,
      pct: Math.round(pct * 100),
      strokeDasharray,
      strokeDashoffset,
      idx,
    };
  });

  const activeSegment = hoveredIdx !== null ? segments[hoveredIdx] : null;

  return (
    <div className="flex flex-col items-center">
      {title && (
        <div className="text-xs font-bold uppercase tracking-wider text-[#70717a] mb-3 self-start">
          {title}
        </div>
      )}

      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background track circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(20,20,30,0.06)"
            strokeWidth={thickness}
          />

          {total === 0 ? (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={thickness}
            />
          ) : (
            segments.map((seg) => {
              const isHovered = hoveredIdx === seg.idx;
              return (
                <circle
                  key={seg.label}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={isHovered ? thickness + 4 : thickness}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-300 cursor-pointer"
                  style={{
                    opacity: hoveredIdx === null || isHovered ? 1 : 0.45,
                    filter: isHovered ? "drop-shadow(0px 2px 8px rgba(0,0,0,0.2))" : "none",
                  }}
                  onMouseEnter={() => setHoveredIdx(seg.idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })
          )}
        </svg>

        {/* Center label / count */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          {activeSegment ? (
            <>
              <span className="text-xl font-extrabold text-[#17171b] leading-tight">
                {activeSegment.value}
              </span>
              <span className="text-[10px] font-semibold text-[#70717a] truncate max-w-[100px]">
                {activeSegment.label} ({activeSegment.pct}%)
              </span>
            </>
          ) : (
            <>
              <span className="text-xl font-extrabold text-[#17171b] leading-tight">
                {centerValue !== undefined ? centerValue : total}
              </span>
              <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">
                {centerLabel || "Total"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Interactive Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 mt-4 text-xs">
        {segments.map((seg) => {
          const isHovered = hoveredIdx === seg.idx;
          return (
            <div
              key={seg.label}
              onMouseEnter={() => setHoveredIdx(seg.idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                isHovered ? "bg-zinc-100 font-bold" : "opacity-80 hover:opacity-100"
              }`}
            >
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-[#374151] text-[11px] font-medium">{seg.label}</span>
              <span className="text-[#70717a] text-[10px] font-bold">({seg.value})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 2. PrismHorizontalBarChart (Ranked Comparative Bar Graph)
// ============================================================================

export function PrismHorizontalBarChart({
  items,
  title,
  subtitle,
  maxVal,
}: {
  items: BarItem[];
  title?: string;
  subtitle?: string;
  maxVal?: number;
}) {
  const calculatedMax = maxVal || Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-3 w-full">
      {(title || subtitle) && (
        <div className="mb-2">
          {title && <div className="text-xs font-bold uppercase tracking-wider text-[#70717a]">{title}</div>}
          {subtitle && <div className="text-[11px] text-[#9ca3af] mt-0.5">{subtitle}</div>}
        </div>
      )}

      <div className="space-y-2.5">
        {items.map((item, idx) => {
          const pct = Math.min(100, Math.round((item.value / calculatedMax) * 100));
          return (
            <div
              key={item.label + idx}
              onClick={item.onClick}
              className={`group flex flex-col gap-1 ${
                item.onClick ? "cursor-pointer p-1.5 -mx-1.5 rounded-lg hover:bg-zinc-50/80 transition-colors" : ""
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-[#17171b] group-hover:text-[#6e57dc] transition-colors truncate max-w-[240px]">
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider bg-purple-50 text-[#6e57dc] border border-purple-200">
                      {item.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs shrink-0">
                  {item.secondaryText && (
                    <span className="text-[11px] text-[#9ca3af]">{item.secondaryText}</span>
                  )}
                  <span className="font-extrabold text-[#17171b]">{item.value}</span>
                </div>
              </div>

              {/* Progress bar track */}
              <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden relative">
                <div
                  style={{
                    width: `${pct}%`,
                    backgroundColor: item.color || "#6e57dc",
                  }}
                  className="h-full rounded-full transition-all duration-500 ease-out"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 3. PrismStackedBarChart (Multi-Category Stacked Breakdown Graph)
// ============================================================================

export function PrismStackedBarChart({
  rows,
  legend,
  title,
  subtitle,
}: {
  rows: StackedBarRow[];
  legend?: Array<{ label: string; color: string }>;
  title?: string;
  subtitle?: string;
}) {
  const maxRowTotal = React.useMemo(() => {
    return Math.max(
      ...rows.map((r) => r.segments.reduce((acc, s) => acc + s.value, 0)),
      1
    );
  }, [rows]);

  return (
    <div className="space-y-4 w-full">
      {(title || subtitle) && (
        <div>
          {title && <div className="text-xs font-bold uppercase tracking-wider text-[#70717a]">{title}</div>}
          {subtitle && <div className="text-[11px] text-[#9ca3af] mt-0.5">{subtitle}</div>}
        </div>
      )}

      {/* Legend */}
      {legend && (
        <div className="flex flex-wrap items-center gap-3 text-xs pb-1 border-b border-[rgba(20,20,30,0.06)]">
          {legend.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5 text-[11px] font-semibold text-[#595a63]">
              <div className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: l.color }} />
              <span>{l.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row, idx) => {
          const rowTotal = row.segments.reduce((acc, s) => acc + s.value, 0);
          const barWidthPct = Math.min(100, Math.round((rowTotal / maxRowTotal) * 100));

          return (
            <div
              key={row.label + idx}
              onClick={row.onClick}
              className={`group flex flex-col gap-1 ${
                row.onClick ? "cursor-pointer p-1.5 -mx-1.5 rounded-lg hover:bg-zinc-50 transition-colors" : ""
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className={`font-semibold ${
                      row.isTarget ? "text-[#6e57dc] font-bold" : "text-[#17171b]"
                    } group-hover:text-[#6e57dc] transition-colors`}
                  >
                    {row.label}
                  </span>
                  {row.isTarget && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-purple-100 text-[#6e57dc]">
                      Target
                    </span>
                  )}
                </div>
                <span className="font-bold text-[#17171b] text-xs shrink-0">
                  {row.totalLabel || `${rowTotal} items`}
                </span>
              </div>

              {/* Stacked bar segments */}
              <div className="h-3 w-full rounded-md bg-zinc-100 overflow-hidden flex items-center p-0.5">
                <div
                  style={{ width: `${Math.max(barWidthPct, 4)}%` }}
                  className="h-full rounded-xs overflow-hidden flex"
                >
                  {rowTotal === 0 ? (
                    <div className="w-full h-full bg-zinc-200" title="0 items" />
                  ) : (
                    row.segments.map((seg, sIdx) => {
                      if (seg.value <= 0) return null;
                      const segPct = (seg.value / rowTotal) * 100;
                      return (
                        <div
                          key={seg.label + sIdx}
                          style={{
                            width: `${segPct}%`,
                            backgroundColor: seg.color,
                          }}
                          className="h-full transition-all duration-300 hover:brightness-110"
                          title={`${seg.label}: ${seg.value} (${Math.round(segPct)}%)`}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 4. PrismLineChart (Longitudinal Velocity & Trend Wave Trajectory)
// ============================================================================

export function PrismLineChart({
  points,
  series,
  height = 180,
  title,
  subtitle,
}: {
  points: LineDataPoint[];
  series: LineSeries[];
  height?: number;
  title?: string;
  subtitle?: string;
}) {
  const [hoveredPointIdx, setHoveredPointIdx] = React.useState<number | null>(null);

  // Determine global max value across all points and series
  const maxValue = React.useMemo(() => {
    let max = 1;
    points.forEach((pt) => {
      series.forEach((s) => {
        const val = Number(pt[s.key] || 0);
        if (val > max) max = val;
      });
    });
    return Math.ceil(max * 1.15);
  }, [points, series]);

  const paddingX = 40;
  const paddingY = 25;
  const width = 500; // viewBox width

  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;

  // Coordinate mapper
  const getX = (idx: number) => {
    if (points.length <= 1) return paddingX + plotWidth / 2;
    return paddingX + (idx / (points.length - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    const ratio = Math.min(1, Math.max(0, val / maxValue));
    return paddingY + plotHeight - ratio * plotHeight;
  };

  return (
    <div className="w-full space-y-3">
      {(title || subtitle) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            {title && <div className="text-xs font-bold uppercase tracking-wider text-[#70717a]">{title}</div>}
            {subtitle && <div className="text-[11px] text-[#9ca3af] mt-0.5">{subtitle}</div>}
          </div>
          {/* Series Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {series.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-[11px] font-semibold text-[#595a63]">
                <div className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative w-full overflow-hidden bg-zinc-50/50 rounded-xl border border-[rgba(20,20,30,0.06)] p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          {/* Horizontal gridlines */}
          {[0, 0.33, 0.66, 1].map((ratio, i) => {
            const y = paddingY + plotHeight - ratio * plotHeight;
            const gridVal = Math.round(ratio * maxValue);
            return (
              <g key={i}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="rgba(20,20,30,0.06)"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[9px] fill-[#9ca3af] font-mono"
                >
                  {gridVal}
                </text>
              </g>
            );
          })}

          {/* Plot Series Lines and Area Fill */}
          {series.map((s) => {
            if (points.length < 2) return null;

            // Generate Path SVG data
            const pts = points.map((pt, idx) => ({
              x: getX(idx),
              y: getY(Number(pt[s.key] || 0)),
            }));

            let pathD = `M ${pts[0].x} ${pts[0].y}`;
            for (let i = 1; i < pts.length; i++) {
              // Smooth bezier or direct line
              const prev = pts[i - 1];
              const curr = pts[i];
              const cpX = (prev.x + curr.x) / 2;
              pathD += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
            }

            const areaD = `${pathD} L ${pts[pts.length - 1].x} ${paddingY + plotHeight} L ${pts[0].x} ${
              paddingY + plotHeight
            } Z`;

            return (
              <g key={s.key}>
                {/* Area under curve */}
                <path
                  d={areaD}
                  fill={s.color}
                  opacity="0.08"
                />
                {/* Line curve */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data Points */}
                {pts.map((p, idx) => {
                  const val = Number(points[idx][s.key] || 0);
                  const isHovered = hoveredPointIdx === idx;
                  return (
                    <circle
                      key={idx}
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 5.5 : 3.5}
                      fill="#ffffff"
                      stroke={s.color}
                      strokeWidth="2"
                      className="cursor-pointer transition-all duration-150"
                      onMouseEnter={() => setHoveredPointIdx(idx)}
                      onMouseLeave={() => setHoveredPointIdx(null)}
                    >
                      <title>{`${s.name} (${points[idx].label}): ${val}`}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}

          {/* X Axis Labels */}
          {points.map((pt, idx) => {
            const x = getX(idx);
            return (
              <text
                key={idx}
                x={x}
                y={height - 6}
                textAnchor="middle"
                className="text-[10px] fill-[#70717a] font-bold"
              >
                {pt.label}
              </text>
            );
          })}
        </svg>

        {/* Hover inspection pill */}
        {hoveredPointIdx !== null && (
          <div className="mt-2 pt-2 border-t border-[rgba(20,20,30,0.06)] flex items-center justify-between text-xs px-2">
            <span className="font-bold text-[#17171b]">
              {points[hoveredPointIdx].label} Snapshot:
            </span>
            <div className="flex items-center gap-3">
              {series.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5 text-xs font-semibold">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[#595a63]">{s.name}:</span>
                  <span className="font-extrabold text-[#17171b]">
                    {points[hoveredPointIdx][s.key]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
