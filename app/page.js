'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import MapCanvas from '@/components/MapCanvas';
import ShopMenu from '@/components/ShopMenu';
import ShopPicker from '@/components/ShopPicker';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { get, post, put } from '@/lib/api';

/**
 * Applies a reorder to the map payload without a round-trip, mirroring what
 * the server does: the moved shop takes the midpoint between its new
 * neighbours, or steps one slot past the end it was dropped at.
 */
function reorderLocally(map, { shopId, streetId, beforeId, afterId }) {
  if (!map) return map;

  return {
    ...map,
    lines: map.lines.map((line) => {
      if (String(line._id) !== String(streetId)) return line;

      const orderOf = (id) =>
        id ? line.stations.find((s) => String(s._id) === String(id))?.order ?? null : null;
      const before = orderOf(beforeId);
      const after = orderOf(afterId);
      if (before === null && after === null) return line;

      const order =
        before !== null && after !== null
          ? (before + after) / 2
          : before !== null
            ? before + 10
            : after - 10;

      return {
        ...line,
        stations: line.stations
          .map((s) => (String(s._id) === String(shopId) ? { ...s, order } : s))
          .sort((a, b) => a.order - b.order),
      };
    }),
  };
}

/** One legend entry: a small SVG drawn the same way the map draws it. */
function Key({ label, children }) {
  return (
    <span className="legend-key">
      <svg width="36" height="24" viewBox="0 0 36 24" aria-hidden="true">
        {children}
      </svg>
      {label}
    </span>
  );
}

export default function MapPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [menu, setMenu] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [toast, notify] = useToast();

  const load = useCallback(
    () => get('/map').then(setData).catch((e) => setError(e.message)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  function onStationClick(station, line, e) {
    setSelected(station);
    setMenu({ station, line, x: e.clientX + 4, y: e.clientY + 4 });
  }

  /**
   * Dropped after dragging a station along its line. The new order is applied
   * locally first so the shop stays where it was released; the server call
   * then confirms it. On failure the previous arrangement is restored.
   */
  async function onStationMove({ shopId, streetId, beforeId, afterId }) {
    if (!beforeId && !afterId) return; // nothing to sit between

    const snapshot = data;
    setData((cur) => reorderLocally(cur, { shopId, streetId, beforeId, afterId }));

    try {
      await put(`/shops/${shopId}/reorder`, { street: streetId, beforeId, afterId });
      load();
    } catch (e) {
      setData(snapshot);
      notify(e.message, 'error');
    }
  }

  async function handleAction(key) {
    const { station, line } = menu;
    setMenu(null);

    if (key === 'view') return setSelected(station);
    if (key === 'edit') return (window.location.href = `/shops?edit=${station._id}`);
    if (key === 'street-between') return setDialog({ kind: 'street-between', station });
    if (key.startsWith('add-'))
      return setDialog({ kind: 'adjacent', station, line, side: key.slice(4) });

    // The three distance shortcuts open the same dialog with step 2 prefilled.
    if (key.startsWith('cross-')) {
      const preset = { 'cross-on': 'on', 'cross-close': 'close', 'cross-near': 'near' }[key];
      return setDialog({ kind: 'crossing', station, line, proximity: preset || 'on' });
    }

    if (key === 'toggle-end') {
      try {
        await put(`/shops/${station._id}`, { atStreetEnd: !station.atStreetEnd });
        notify(station.atStreetEnd ? 'No longer a street ending' : 'Marked as street ending');
        load();
      } catch (e) {
        notify(e.message, 'error');
      }
      return;
    }

    if (key === 'continue-left' || key === 'continue-right') {
      const dir = key === 'continue-left' ? 'left' : 'right';
      const cur = station.continues || 'none';
      // Toggle just this direction, keeping whatever the other one was.
      const has = (d) => cur === d || cur === 'both';
      const next = { left: has('left'), right: has('right'), [dir]: !has(dir) };
      const value =
        next.left && next.right ? 'both' : next.left ? 'left' : next.right ? 'right' : 'none';
      try {
        await put(`/shops/${station._id}/continues`, { street: line._id, continues: value });
        notify(has(dir) ? 'Street no longer continues' : 'Street continues past this shop');
        load();
      } catch (e) {
        notify(e.message, 'error');
      }
    }
  }

  if (error) return <Shell><div className="alert error">{error}</div></Shell>;
  if (!data) return <Shell><div className="loading">Loading map…</div></Shell>;

  const hasSections = data.lines.some((l) => l.sections.length > 0);

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Map</h1>
          <p>Streets as lines, shops as stations. A shop on two streets joins them at the corner.</p>
        </div>
        <div className="row">
          <Link href="/streets" className="btn">
            Manage streets
          </Link>
          <Link href="/shops" className="btn primary">
            Manage shops
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          {data.lines.map((l) => (
            <span key={l._id} className="row" style={{ gap: 6, marginRight: 14 }}>
              <span
                style={{
                  width: 22,
                  height: 5,
                  borderRadius: 3,
                  background: l.color,
                  display: 'inline-block',
                }}
              />
              <span className="small">
                <strong>{l.name}</strong> <span className="muted">({l.stations.length})</span>
              </span>
            </span>
          ))}
        </div>

        <p className="muted small" style={{ marginTop: 0 }}>
          Click any shop for its menu — edit it, add a crossing street, mark it as a street ending,
          or add a shop beside it. Drag a shop along its street to reorder it; press Escape mid-drag
          to cancel.
        </p>

        <MapCanvas
          data={data}
          selectedId={selected?._id}
          onSelect={onStationClick}
          onMove={onStationMove}
        />

        <div className="map-legend">
          <Key label="Shop">
            <circle cx="17" cy="12" r="7" fill="#fff" stroke="#64748b" strokeWidth="3" />
          </Key>

          <Key label="Corner — joins two streets">
            <circle cx="17" cy="12" r="7" fill="#fff" stroke="#64748b" strokeWidth="7" />
          </Key>

          <Key label="Not at the crossing — 5 m or 15 m away">
            <circle cx="17" cy="12" r="7" fill="#fff" stroke="#64748b" strokeWidth="3" />
            <circle
              cx="17"
              cy="12"
              r="7"
              fill="none"
              stroke="#64748b"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
          </Key>

          <Key label="Street ending — the street stops here">
            <rect
              x="7"
              y="2"
              width="20"
              height="20"
              rx="3"
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
            />
            <circle cx="17" cy="12" r="7" fill="#fff" stroke="#64748b" strokeWidth="3" />
          </Key>

          <Key label="Street continues past this shop">
            <circle cx="9" cy="12" r="6" fill="#fff" stroke="#64748b" strokeWidth="3" />
            <line
              x1="17"
              y1="12"
              x2="34"
              y2="12"
              stroke="#64748b"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="5 4"
              opacity="0.7"
            />
          </Key>

          <Key label="Reach rings — 5 m and 15 m, shown on hover">
            <circle cx="17" cy="12" r="4" fill="#fff" stroke="#64748b" strokeWidth="2.5" />
            <circle
              cx="17"
              cy="12"
              r="8"
              fill="none"
              stroke="#64748b"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />
            <circle
              cx="17"
              cy="12"
              r="11.5"
              fill="none"
              stroke="#64748b"
              strokeWidth="1.2"
              strokeDasharray="2 4"
              opacity="0.7"
            />
          </Key>

          <span className="legend-key">
            <strong style={{ color: '#7c3aed', width: 34, textAlign: 'center' }}>2</strong>
            Streets a corner shop joins
          </span>
        </div>
      </div>

      {selected && (
        <div className="card">
          <div className="row">
            <h3 className="card-title" style={{ margin: 0 }}>
              {selected.name} {selected.code ? `(${selected.code})` : ''}
            </h3>
            <span className="spacer" />
            <button className="btn sm" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <span className="badge">Banner: {selected.banner}</span>
            <span className="badge">Proximity: {selected.proximity}</span>
            <span className="badge">On {selected.streetCount} street(s)</span>
            {selected.side !== 'unset' && <span className="badge">Side: {selected.side}</span>}
            {selected.interchange && <span className="badge amber">Corner shop</span>}
            {selected.atStreetEnd && <span className="badge">Street ending</span>}
          </div>
        </div>
      )}

      {data.orphanShops.length > 0 && (
        <div className="card">
          <h3 className="card-title">Not on the map ({data.orphanShops.length})</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            These shops have no street, so they can&apos;t be drawn or earn commission.
          </p>
          <div className="row" style={{ gap: 6 }}>
            {data.orphanShops.map((s) => (
              <span key={s._id} className="badge">
                {s.code ? `${s.code} — ` : ''}
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasSections && (
        <div className="card">
          <h3 className="card-title">Sections</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Street</th>
                  <th>Section</th>
                  <th>Between</th>
                  <th>Connection</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.flatMap((l) =>
                  l.sections.map((s) => (
                    <tr key={s._id}>
                      <td>
                        <span className="row" style={{ gap: 6 }}>
                          <span className="dot" style={{ background: l.color }} />
                          {l.name}
                        </span>
                      </td>
                      <td>{s.name || <span className="muted">—</span>}</td>
                      <td className="small">
                        {s.fromShop?.name} → {s.toShop?.name}
                      </td>
                      <td className="small">
                        {s.connection.kind === 'none' && <span className="muted">Stand-alone</span>}
                        {s.connection.kind === 'crossing' && (
                          <>
                            Crosses <strong>{s.connection.otherStreet?.name}</strong>
                            {s.connection.atShop ? ` at ${s.connection.atShop.name}` : ''}
                          </>
                        )}
                        {s.connection.kind === 'nextTo' && (
                          <>
                            Next to <strong>{s.connection.otherStreet?.name}</strong>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {menu && (
        <ShopMenu
          station={menu.station}
          line={menu.line}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onAction={handleAction}
        />
      )}

      {dialog?.kind === 'crossing' && (
        <CrossingDialog
          station={dialog.station}
          streets={data.lines}
          initialProximity={dialog.proximity}
          onClose={() => setDialog(null)}
          onSaved={(m) => {
            setDialog(null);
            notify(m);
            load();
          }}
        />
      )}

      {dialog?.kind === 'adjacent' && (
        <AdjacentDialog
          station={dialog.station}
          line={dialog.line}
          side={dialog.side}
          onClose={() => setDialog(null)}
          onSaved={(m) => {
            setDialog(null);
            notify(m);
            load();
          }}
        />
      )}

      {dialog?.kind === 'street-between' && (
        <StreetBetweenDialog
          station={dialog.station}
          onClose={() => setDialog(null)}
          onSaved={(m) => {
            setDialog(null);
            notify(m);
            load();
          }}
        />
      )}
      {toast}
    </Shell>
  );
}

/**
 * Adds a crossing street to a shop, in the two steps the spec calls for:
 * name the street, then say how far away it is and which side the shop is on.
 */
function CrossingDialog({ station, streets, initialProximity = 'on', onClose, onSaved }) {
  const alreadyOn = new Set(
    streets
      .filter((l) => l.stations.some((s) => String(s._id) === String(station._id)))
      .map((l) => String(l._id))
  );
  const available = streets.filter((l) => !alreadyOn.has(String(l._id)));

  const [mode, setMode] = useState(available.length ? 'existing' : 'new');
  const [street, setStreet] = useState(available[0]?._id || '');
  const [name, setName] = useState('');
  const [proximity, setProximity] = useState(initialProximity);
  const [side, setSide] = useState('unset');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setError('');
    setBusy(true);
    try {
      const body =
        mode === 'existing'
          ? { street, proximity, side }
          : { newStreet: { name }, proximity, side };
      await post(`/shops/${station._id}/crossing`, body);
      onSaved('Crossing street added');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add a crossing street here"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={save}
            disabled={busy || (mode === 'existing' ? !street : !name.trim())}
          >
            {busy ? 'Adding…' : 'Add crossing'}
          </button>
        </>
      }
    >
      {error && <div className="alert error">{error}</div>}

      <fieldset>
        <legend>Step 1 — the street</legend>
        <label className="field">
          <span>Which street</span>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            {available.length > 0 && <option value="existing">An existing street</option>}
            <option value="new">Create a new street</option>
          </select>
        </label>

        {mode === 'existing' ? (
          <label className="field">
            <span>Street *</span>
            <select value={street} onChange={(e) => setStreet(e.target.value)}>
              {available.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field">
            <span>Street name *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <span className="small muted">
              Drawn across the street this shop is on, and given the next colour automatically.
            </span>
          </label>
        )}
      </fieldset>

      <fieldset>
        <legend>Step 2 — where the shop sits</legend>
        <div className="form-grid">
          <label className="field">
            <span>Distance from the crossing</span>
            <select value={proximity} onChange={(e) => setProximity(e.target.value)}>
              <option value="on">At the crossing — 100%</option>
              <option value="close">5 metres away — 70%</option>
              <option value="near">15 metres away — 20%</option>
            </select>
          </label>
          <label className="field">
            <span>Which side of that street</span>
            <select value={side} onChange={(e) => setSide(e.target.value)}>
              <option value="unset">Not specified</option>
              <option value="left">Left side</option>
              <option value="right">Right side</option>
            </select>
          </label>
        </div>
      </fieldset>
    </Modal>
  );
}

/** Creates a shop immediately to one side of an existing one. */
function AdjacentDialog({ station, line, side, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    code: '',
    banner: 'none',
    proximity: 'on',
    side: 'unset',
    owner: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const where =
    line.orientation === 'h'
      ? side === 'left'
        ? 'to the left of'
        : 'to the right of'
      : side === 'left'
        ? 'above'
        : 'below';

  async function save() {
    setError('');
    setBusy(true);
    try {
      await post(`/shops/${station._id}/adjacent`, { ...form, street: line._id, side });
      onSaved('Shop added');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Add a shop ${where} ${station.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={busy || !form.name.trim()}>
            {busy ? 'Adding…' : 'Add shop'}
          </button>
        </>
      }
    >
      {error && <div className="alert error">{error}</div>}
      <p className="muted small" style={{ marginTop: 0 }}>
        It goes on <strong>{line.name}</strong>, {where} {station.name}.
      </p>

      <div className="form-grid">
        <label className="field">
          <span>Shop name *</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Map code</span>
          <input
            value={form.code}
            onChange={(e) => set('code', e.target.value)}
            maxLength={4}
            placeholder="A, B, C…"
          />
        </label>
        <label className="field">
          <span>Banner</span>
          <select value={form.banner} onChange={(e) => set('banner', e.target.value)}>
            <option value="large">Large — 2 points</option>
            <option value="medium">Medium — 1 point</option>
            <option value="none">No banner — 0 points</option>
          </select>
        </label>
        <label className="field">
          <span>Distance from the street</span>
          <select value={form.proximity} onChange={(e) => set('proximity', e.target.value)}>
            <option value="on">At the crossing — 100%</option>
            <option value="close">5 metres away — 70%</option>
            <option value="near">15 metres away — 20%</option>
          </select>
        </label>
        <label className="field">
          <span>Owner</span>
          <input value={form.owner} onChange={(e) => set('owner', e.target.value)} />
        </label>
        <label className="field">
          <span>Phone</span>
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}

/** Creates a street running between this shop and another picked off the map. */
function StreetBetweenDialog({ station, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [other, setOther] = useState(null);
  const [proximity, setProximity] = useState('on');
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setError('');
    setBusy(true);
    try {
      await post('/streets/between', {
        name,
        fromShop: station._id,
        toShop: other.id,
        proximity,
      });
      onSaved('Street created between the two shops');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add a street between 2 shops"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={busy || !name.trim() || !other}>
            {busy ? 'Creating…' : 'Create street'}
          </button>
        </>
      }
    >
      {error && <div className="alert error">{error}</div>}

      <label className="field">
        <span>Street name *</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>

      <label className="field">
        <span>Runs between</span>
        <div className="row">
          <span className="badge">{station.name}</span>
          <span className="muted">and</span>
          {other ? (
            <span className="badge">{other.label}</span>
          ) : (
            <span className="muted small">no shop picked</span>
          )}
          <button type="button" className="btn sm" onClick={() => setPicking(true)}>
            🗺 Pick the other shop
          </button>
        </div>
      </label>

      <label className="field">
        <span>How close both shops are to it</span>
        <select value={proximity} onChange={(e) => setProximity(e.target.value)}>
          <option value="on">At the crossing — 100%</option>
          <option value="close">5 metres away — 70%</option>
          <option value="near">15 metres away — 20%</option>
        </select>
      </label>

      {picking && (
        <ShopPicker
          title="Pick the other end of the street"
          max={1}
          exclude={[station._id]}
          onCancel={() => setPicking(false)}
          onConfirm={(ids, names) => {
            setOther({ id: ids[0], label: names?.[ids[0]] || 'Selected shop' });
            setPicking(false);
          }}
        />
      )}
    </Modal>
  );
}