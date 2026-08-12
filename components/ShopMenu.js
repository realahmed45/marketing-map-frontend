'use client';

import { useEffect, useRef } from 'react';

/**
 * Context menu for a shop on the map, positioned at the click point and
 * clamped so it never runs off the viewport.
 */
/** Whether the street already runs past this shop in the given direction. */
function contHint(current, dir) {
  const on = current === dir || current === 'both';
  return on ? 'Currently drawn — click to stop it' : 'Draw the line running on past this shop';
}

export default function ShopMenu({ station, line, x, y, onClose, onAction }) {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    window.addEventListener('keydown', onKey);
    // Deferred so the click that opened the menu doesn't immediately shut it.
    const t = setTimeout(() => window.addEventListener('mousedown', onDown), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
      clearTimeout(t);
    };
  }, [onClose]);

  const WIDTH = 278;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const left = Math.max(8, Math.min(x, vw - WIDTH - 12));

  const item = (key, label, hint) => (
    <button className="shop-menu-item" onClick={() => onAction(key)}>
      <span>{label}</span>
      {hint && <small>{hint}</small>}
    </button>
  );

  const sideways = line.orientation === 'h';

  return (
    <div className="shop-menu" style={{ left, top: Math.max(8, y) }} ref={ref}>
      <div className="shop-menu-head">
        <strong>{station.name}</strong>
        {station.code && <span className="muted small"> ({station.code})</span>}
        <div className="muted small">on {line.name}</div>
      </div>

      {item('view', 'View settings', `${station.banner} banner · ${station.streetCount} street(s)`)}
      {item('edit', 'Edit shop')}

      <div className="shop-menu-sep">Character</div>

      <div className="shop-menu-group">Street crossing</div>
      {item('cross-here', 'Add a crossing street here', 'Choose the distance and side')}
      {item('cross-on', 'At the crossing', '100% of the share')}
      {item('cross-close', '5 metres away', '70% of the share')}
      {item('cross-near', '15 metres away', '20% of the share')}

      <div className="shop-menu-group">Shop related</div>
      {item(
        'toggle-end',
        station.atStreetEnd ? 'Shop not at the street ending' : 'Add street ending',
        station.atStreetEnd
          ? 'Currently marked as the end of the street'
          : 'The shop is at the corner or end of the street'
      )}
      {item(
        'continue-left',
        sideways ? 'Street continues to the left' : 'Street continues upwards',
        contHint(station.continues, 'left')
      )}
      {item(
        'continue-right',
        sideways ? 'Street continues to the right' : 'Street continues downwards',
        contHint(station.continues, 'right')
      )}
      {item('street-between', 'Add a street between 2 shops', 'Starts from this shop')}

      <div className="shop-menu-sep">Add a shop next to this one</div>
      {item('add-left', sideways ? 'Add shop on the left' : 'Add shop above')}
      {item('add-right', sideways ? 'Add shop on the right' : 'Add shop below')}
    </div>
  );
}
