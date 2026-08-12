'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildLayout, linePath, R } from '@/lib/mapLayout';

// Corner shops join two streets, so their ring is drawn far heavier than a
// plain station's 4px outline.
const CORNER_STROKE = 16;

// Roughly 3cm on a typical screen — long enough to read as "carries on".
const CONTINUE = 110;

// Reach rings. Not to scale with anything on the ground; they exist to show
// which neighbours fall inside the 70% and 20% commission bands.
const RING_5 = 38;
const RING_15 = 62;

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
  onMove,
  pickMode = false,
  picked = [],
  pickableStreet = null,
  height,
}) {
  const layout = useMemo(() => buildLayout(data), [data]);
  const [hovered, setHovered] = useState(null);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  /** Pointer position in SVG user units, which the viewBox may have scaled. */
  const toSvg = useCallback((evt) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return {
      x: ((evt.clientX - r.left) / r.width) * (vb.width || r.width),
      y: ((evt.clientY - r.top) / r.height) * (vb.height || r.height),
    };
  }, []);

  // Dragging is tracked on the window so the pointer can leave the circle
  // mid-gesture without the drop being lost.
  useEffect(() => {
    if (!drag) return;

    const move = (e) => setDrag((d) => (d ? { ...d, ...toSvg(e), moved: true } : d));

    const up = () => {
      setDrag((d) => {
        if (!d?.moved || !onMove) return null;

        // Work out where along the line it was dropped, and hand back the two
        // shops it landed between so the caller can renumber it.
        const line = layout?.lines.find((l) => String(l._id) === d.lineId);
        if (line) {
          const horizontal = line.orientation === 'h';
          const pos = horizontal ? d.x : d.y;
          const others = line.stations.filter((s) => String(s._id) !== d.shopId);
          const before = others.filter((s) => (horizontal ? s.x : s.y) < pos).pop() || null;
          const after = others.find((s) => (horizontal ? s.x : s.y) >= pos) || null;
          onMove({
            shopId: d.shopId,
            streetId: d.lineId,
            beforeId: before ? String(before._id) : null,
            afterId: after ? String(after._id) : null,
          });
        }
        return null;
      });
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag, onMove, toSvg, layout]);

  if (!layout) return <div className="loading">Loading map…</div>;
  if (layout.lines.length === 0)
    return <div className="empty">No active streets yet.</div>;
  if (layout.lines.every((l) => l.stations.length === 0))
    return <div className="empty">Streets exist but no shops are placed on them yet.</div>;

  const pickedIndex = (id) => picked.findIndex((p) => String(p) === String(id));

  return (
    <div className="map-scroll" style={height ? { maxHeight: height, overflowY: 'auto' } : undefined}>
      <svg
        ref={svgRef}
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label="Street and shop map"
        style={{ touchAction: drag ? 'none' : undefined }}
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

        {/* Where a shop says the street carries on past it, run the line out
            beyond the last station so the map reads as unfinished there
            rather than stopping dead at the shop. */}
        {layout.lines.flatMap((line) => {
          if (line.stations.length === 0) return [];
          const horizontal = line.orientation === 'h';
          const first = line.stations[0];
          const last = line.stations[line.stations.length - 1];
          const out = [];

          const wants = (st, dir) => st.continues === dir || st.continues === 'both';
          const draw = (from, dir) => (
            <line
              key={`cont-${line._id}-${dir}`}
              x1={from.x}
              y1={from.y}
              x2={horizontal ? from.x + dir * CONTINUE : from.x}
              y2={horizontal ? from.y : from.y + dir * CONTINUE}
              stroke={line.color}
              strokeWidth="9"
              strokeLinecap="round"
              opacity="0.55"
              strokeDasharray="16 10"
            />
          );

          if (wants(first, 'left')) out.push(draw(first, -1));
          if (wants(last, 'right')) out.push(draw(last, 1));
          return out;
        })}

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
            const draggable = Boolean(onMove) && !dimmed && !pickMode;
            const isDragging = drag?.shopId === String(st._id) && drag.moved;
            const showRings =
              !pickMode && (isSel || String(hovered) === String(st._id) || isDragging);

            // While dragging, the glyph follows the pointer along the line
            // only — a station cannot leave its own street by dragging.
            const horizontal = line.orientation === 'h';
            const cx = isDragging ? (horizontal ? drag.x : st.x) : st.x;
            const cy = isDragging ? (horizontal ? st.y : drag.y) : st.y;

            return (
              <g
                key={`${line._id}-${st._id}`}
                onClick={(e) => {
                  // A drag that moved should not also register as a click.
                  if (drag?.moved) return;
                  if (clickable) onSelect?.(st, line, e);
                }}
                onPointerDown={(e) => {
                  if (!draggable || e.button !== 0) return;
                  const p = toSvg(e);
                  setDrag({
                    shopId: String(st._id),
                    lineId: String(line._id),
                    from: st.order,
                    ...p,
                    moved: false,
                  });
                }}
                onPointerEnter={() => setHovered(String(st._id))}
                onPointerLeave={() => setHovered((h) => (h === String(st._id) ? null : h))}
                style={{
                  cursor: draggable ? (isDragging ? 'grabbing' : 'grab') : clickable ? 'pointer' : 'default',
                  opacity: dimmed ? 0.3 : 1,
                }}
              >
                {isPicked && (
                  <circle cx={cx} cy={cy} r={R + 18} fill="#2563eb" opacity="0.16" />
                )}

                {/* Reach rings: the solid inner circle is the shop itself
                    (on the street, linked), then 5m and 15m as dashed rings.
                    Only drawn for the shop under the cursor or selected, or
                    the map would be unreadable. */}
                {showRings && (
                  <>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={RING_5}
                      fill="none"
                      stroke={line.color}
                      strokeWidth="2"
                      strokeDasharray="7 6"
                      opacity="0.75"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={RING_15}
                      fill="none"
                      stroke={line.color}
                      strokeWidth="2"
                      strokeDasharray="4 9"
                      opacity="0.5"
                    />
                    <text
                      x={cx + RING_5 + 4}
                      y={cy - 5}
                      fontSize="9"
                      fill={line.color}
                      opacity="0.9"
                    >
                      5 m
                    </text>
                    <text
                      x={cx + RING_15 + 4}
                      y={cy - 5}
                      fontSize="9"
                      fill={line.color}
                      opacity="0.7"
                    >
                      15 m
                    </text>
                  </>
                )}
                {/* A shop joining two streets gets a far heavier ring so the
                    junctions are obvious at a glance. */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={st.interchange ? R + 7 : R}
                  fill="#fff"
                  stroke={isPicked ? '#2563eb' : isSel ? '#0f172a' : line.color}
                  strokeWidth={st.interchange ? CORNER_STROKE : isPicked ? 5 : 4}
                />
                {st.proximity !== 'on' && (
                  <circle
                    cx={cx}
                    cy={cy}
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
                    x={cx - (st.interchange ? R + 14 : R + 7)}
                    y={cy - (st.interchange ? R + 14 : R + 7)}
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
                    x={cx + R + 12}
                    y={cy - R - 4}
                    fontSize="11"
                    fontWeight="700"
                    fill="#2563eb"
                  >
                    {pi + 1}
                  </text>
                )}
                <text
                  x={cx}
                  y={cy - reach(st) - 6}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="600"
                  fill="#0f172a"
                >
                  {st.code || st.name}
                </text>
                <text
                  x={cx}
                  y={cy + reach(st) + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#64748b"
                >
                  {st.code ? st.name : st.banner === 'none' ? 'no banner' : st.banner}
                </text>
                {/* How many streets this shop is linked to. */}
                <text
                  x={cx}
                  y={cy + reach(st) + 29}
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
