'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import MapCanvas from './MapCanvas';
import { get } from '@/lib/api';

/**
 * Picks shops off the map instead of a dropdown.
 *
 * `max` caps the selection — 2 for "place between these two", 1 for a single
 * endpoint. Clicking a chosen shop again removes it; clicking past the cap
 * drops the oldest pick so the map stays responsive rather than silently
 * ignoring the click.
 */
export default function ShopPicker({
  title = 'Pick on the map',
  street = null,
  max = 2,
  initial = [],
  exclude = [],
  onCancel,
  onConfirm,
}) {
  const [data, setData] = useState(null);
  const [picked, setPicked] = useState(initial.map(String));
  const [error, setError] = useState('');

  useEffect(() => {
    get('/map')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  function toggle(station) {
    const id = String(station._id);
    if (exclude.map(String).includes(id)) return;
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (max === 1) return [id];
      return [...cur, id].slice(-max);
    });
  }

  const names = (() => {
    if (!data) return [];
    const all = data.lines.flatMap((l) => l.stations);
    return picked.map((id) => all.find((s) => String(s._id) === id)).filter(Boolean);
  })();

  return (
    <Modal
      wide
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() =>
              onConfirm(
                picked,
                // Hand back the labels too, so the caller can render the
                // choice without refetching the map.
                Object.fromEntries(
                  names.map((s) => [String(s._id), s.code ? `${s.code} — ${s.name}` : s.name])
                )
              )
            }
            disabled={picked.length === 0}
          >
            Use {picked.length ? `${picked.length} shop${picked.length > 1 ? 's' : ''}` : 'selection'}
          </button>
        </>
      }
    >
      {error && <div className="alert error">{error}</div>}

      <div className="alert success" style={{ marginTop: 0 }}>
        {max === 2
          ? 'Click two shops — the new shop goes between them, in the order you click.'
          : 'Click a shop on the map.'}
        {street && ' Shops on other streets are dimmed.'}
      </div>

      <div className="row" style={{ marginBottom: 10, minHeight: 28 }}>
        {names.length === 0 ? (
          <span className="muted small">Nothing picked yet.</span>
        ) : (
          names.map((s, i) => (
            <span key={s._id} className="badge">
              {i + 1}. {s.code ? `${s.code} — ` : ''}
              {s.name}
            </span>
          ))
        )}
        {picked.length > 0 && (
          <>
            <span className="spacer" />
            <button className="btn sm" onClick={() => setPicked([])}>
              Clear
            </button>
          </>
        )}
      </div>

      <MapCanvas
        data={data}
        pickMode
        picked={picked}
        pickableStreet={street}
        onSelect={toggle}
        height={460}
      />
    </Modal>
  );
}
