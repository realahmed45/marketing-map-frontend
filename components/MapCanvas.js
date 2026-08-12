'use client';

import { useMemo } from 'react';
import { buildLayout, linePath, R } from '@/lib/mapLayout';

// Corner shops join two streets, so their ring is drawn far heavier than a
// plain station's 4px outline.
const CORNER_STROKE = 28;

/** Outer edge of a station's glyph — labels are placed clear of this. */
function reach(st) {
  if (st.atStreetEnd) return (st.interchange ? R + 14 : R + 7) + 2;
  return st.interchange ? R + 7 + CORNER_STROKE / 2 : R + 4;
}

/**
 * Draws the metro-style map.
 *
 * `pickMode` turns every station into a selectable target: pass the ids that
 * are currently chosen and a handler, and the canvas highlights them and
 * numbers them in click order. `pickableStreet` dims shops on other streets
 * so only valid endpoints invite a click.
 */
export default function MapCanvas({
  data,
  selectedId = null,
  onSelect,
  pickMode = false,
  picked = [],
  pickableStreet = null,
  height,
}) {
  const layout = useMemo(() => buildLayout(data), [data]);

  if (!layout) return <div className="loading">Loading map…</div>;
  if (layout.lines.length === 0)
    return <div className="empty">No active streets yet.</div>;
  if (layout.lines.every((l) => l.stations.length === 0))
    return <div className="empty">Streets exist but no shops are placed on them yet.</div>;

  const pickedIndex = (id) => picked.findIndex((p) => String(p) === String(id));

  return (
    <div className="map-scroll" style={height ? { maxHeight: height, overflowY: 'auto' } : undefined}>
      <svg
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label="Street and shop map"
      >
        {/* Lines first, so stations always sit on top of them. */}
        {layout.lines.map((line) => (
          <path
            key={`line-${line._id}`}
            d={linePath(line.stations, line)}
            fill="none"
            stroke={line.color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={pickableStreet && String(pickableStreet) !== String(line._id) ? 0.25 : 0.9}
          />
        ))}

        {/* A lone shop still needs its street shown as a stub. */}
        {layout.lines
          .filter((l) => l.stations.length === 1)
          .map((line) => {
            const s = line.stations[0];
            const horizontal = line.orientation === 'h';
            return (
              <line
                key={`stub-${line._id}`}
                x1={horizontal ? s.x - 40 : s.x}
                y1={horizontal ? s.y : s.y - 40}
                x2={horizontal ? s.x + 40 : s.x}
                y2={horizontal ? s.y : s.y + 40}
                stroke={line.color}
                strokeWidth="9"
                strokeLinecap="round"
                opacity="0.35"
              />
            );
          })}

        {layout.lines.map((line) => {
          const first = line.stations[0];
          if (!first) return null;
          const horizontal = line.orientation === 'h';
          return (
            <text
              key={`lbl-${line._id}`}
              x={horizontal ? first.x - 52 : first.x}
              y={horizontal ? first.y + 5 : first.y - 44}
              textAnchor={horizontal ? 'end' : 'middle'}
              fontSize="14"
              fontWeight="700"
              fill={line.color}
            >
              {line.name}
            </text>
          );
        })}

        {layout.lines.map((line) => {
          const dimmed = pickableStreet && String(pickableStreet) !== String(line._id);
          return line.stations.map((st) => {
            // A corner shop is drawn once, by whichever line reaches it first.
            const pi = pickedIndex(st._id);
            const isPicked = pi !== -1;
            const isSel = String(selectedId) === String(st._id);
            const clickable = !dimmed && (pickMode || onSelect);

            return (
              <g
                key={`${line._id}-${st._id}`}
                onClick={(e) => clickable && onSelect?.(st, line, e)}
                style={{ cursor: clickable ? 'pointer' : 'default', opacity: dimmed ? 0.3 : 1 }}
              >
                {isPicked && (
                  <circle cx={st.x} cy={st.y} r={R + 18} fill="#2563eb" opacity="0.16" />
                )}
                {/* A shop joining two streets gets a far heavier ring so the
                    junctions are obvious at a glance. */}
                <circle
                  cx={st.x}
                  cy={st.y}
                  r={st.interchange ? R + 7 : R}
                  fill="#fff"
                  stroke={isPicked ? '#2563eb' : isSel ? '#0f172a' : line.color}
                  strokeWidth={st.interchange ? CORNER_STROKE : isPicked ? 5 : 4}
                />
                {st.proximity !== 'on' && (
                  <circle
                    cx={st.x}
                    cy={st.y}
                    r={st.interchange ? R + 7 : R}
                    fill="none"
                    stroke={line.color}
                    strokeWidth="2"
                    strokeDasharray="3 3"
                  />
                )}
                {/* A shop that terminates the street is squared off. */}
                {st.atStreetEnd && (
                  <rect
                    x={st.x - (st.interchange ? R + 14 : R + 7)}
                    y={st.y - (st.interchange ? R + 14 : R + 7)}
                    width={(st.interchange ? R + 14 : R + 7) * 2}
                    height={(st.interchange ? R + 14 : R + 7) * 2}
                    fill="none"
                    stroke={line.color}
                    strokeWidth="2"
                    rx="3"
                  />
                )}
                {isPicked && (
                  <text
                    x={st.x + R + 12}
                    y={st.y - R - 4}
                    fontSize="11"
                    fontWeight="700"
                    fill="#2563eb"
                  >
                    {pi + 1}
                  </text>
                )}
                <text
                  x={st.x}
                  y={st.y - reach(st) - 6}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="600"
                  fill="#0f172a"
                >
                  {st.code || st.name}
                </text>
                <text
                  x={st.x}
                  y={st.y + reach(st) + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#64748b"
                >
                  {st.code ? st.name : st.banner === 'none' ? 'no banner' : st.banner}
                </text>
                {/* How many streets this shop is linked to. */}
                <text
                  x={st.x}
                  y={st.y + reach(st) + 29}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="700"
                  fill="#7c3aed"
                >
                  {st.streetCount}
                </text>
              </g>
            );
          });
        })}
      </svg>
    </div>
  );
}
