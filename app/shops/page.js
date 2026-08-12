'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import ShopPicker from '@/components/ShopPicker';
import { useToast } from '@/components/Toast';
import { del, get, post, put } from '@/lib/api';

const EMPTY = {
  name: '',
  code: '',
  owner: '',
  phone: '',
  address: '',
  banner: 'none',
  atStreetEnd: false,
  active: true,
  notes: '',
  streets: [],
};

const BANNER_LABEL = { large: 'Large', medium: 'Medium', none: 'None' };
const PROX_LABEL = { on: 'At the crossing', close: '5 m away', near: '15 m away' };
const PROX_PCT = { on: 100, close: 70, near: 20 };

export default function ShopsPage() {
  return (
    <Suspense fallback={<div className="loading">Loading…</div>}>
      <ShopsInner />
    </Suspense>
  );
}

/** Turns a raw shop record into the shape the edit form expects. */
function toFormShape(s) {
  return {
    ...EMPTY,
    ...s,
    streets: (s.streets || []).map((l) => ({
      street: l.street?._id || l.street,
      order: l.order,
      proximity: l.proximity,
      between: [],
    })),
  };
}

function ShopsInner() {
  const params = useSearchParams();
  const [shops, setShops] = useState([]);
  const [streets, setStreets] = useState([]);
  const [q, setQ] = useState('');
  const [streetFilter, setStreetFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, notify] = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sh, st] = await Promise.all([
        get('/shops', { q, street: streetFilter }),
        get('/streets'),
      ]);
      setShops(sh);
      setStreets(st);
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [q, streetFilter, notify]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // Arriving from the map's "Edit shop" action opens that shop straight away.
  const editId = params.get('edit');
  useEffect(() => {
    if (!editId || editing) return;
    get(`/shops/${editId}`)
      .then((s) => setEditing(toFormShape(s)))
      .catch((e) => notify(e.message, 'error'));
    // Only react to the id in the URL, not to every edit-state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function remove(s) {
    if (!confirm(`Delete "${s.name}"?`)) return;
    try {
      await del(`/shops/${s._id}`);
      notify('Shop deleted');
      load();
    } catch (e) {
      notify(e.message, 'error');
    }
  }

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Shops</h1>
          <p>Stations on the map. A shop on two streets sits on the corner.</p>
        </div>
        <button
          className="btn primary"
          onClick={() => setEditing(EMPTY)}
          disabled={streets.length === 0}
          title={streets.length === 0 ? 'Create a street first' : ''}
        >
          + New shop
        </button>
      </div>

      {streets.length === 0 && (
        <div className="alert error">
          Create a{' '}
          <Link href="/streets" style={{ textDecoration: 'underline' }}>
            street
          </Link>{' '}
          first — a shop is placed along one.
        </div>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: 14 }}>
          <input
            placeholder="Search name, code, owner, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 300 }}
          />
          <select
            value={streetFilter}
            onChange={(e) => setStreetFilter(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            <option value="">All streets</option>
            {streets.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="loading">Loading…</div>
        ) : shops.length === 0 ? (
          <div className="empty">No shops found.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Shop</th>
                  <th>On streets</th>
                  <th>Banner</th>
                  <th>Points</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shops.map((s) => {
                  const pts = s.banner === 'large' ? 2 : s.banner === 'medium' ? 1 : 0;
                  return (
                    <tr key={s._id}>
                      <td>
                        <strong>{s.code || '—'}</strong>
                      </td>
                      <td>
                        <strong>{s.name}</strong>
                        {s.atStreetEnd && <span className="badge" style={{ marginLeft: 6 }}>End</span>}
                        {s.streets.length > 1 && (
                          <span className="badge amber" style={{ marginLeft: 6 }}>
                            Corner
                          </span>
                        )}
                        {s.owner && <div className="small muted">{s.owner}</div>}
                      </td>
                      <td>
                        {s.streets.length === 0 ? (
                          <span className="muted">Not placed</span>
                        ) : (
                          <div className="row" style={{ gap: 5 }}>
                            {s.streets.map((l, i) => (
                              <span
                                key={i}
                                className="badge team"
                                style={{ background: l.street?.color || '#64748b' }}
                                title={PROX_LABEL[l.proximity]}
                              >
                                {l.street?.name} · {PROX_PCT[l.proximity]}%
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>{BANNER_LABEL[s.banner]}</td>
                      <td>{pts}</td>
                      <td className="actions">
                        <button
                          className="btn sm"
                          onClick={() => setEditing(toFormShape(s))}
                        >
                          Edit
                        </button>{' '}
                        <button className="btn sm danger" onClick={() => remove(s)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <ShopForm
          initial={editing}
          streets={streets}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            setEditing(null);
            notify(m);
            load();
          }}
        />
      )}
      {toast}
    </Shell>
  );
}

function ShopForm({ initial, streets, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Names for the shops picked off the map, keyed by id, so the form can
  // show "between A and B" without refetching the whole map.
  const [pickedNames, setPickedNames] = useState({});
  const [pickingFor, setPickingFor] = useState(null); // index of the street row
  const isNew = !initial._id;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function addLink() {
    set('streets', [...form.streets, { street: '', proximity: 'on', between: [], order: '' }]);
  }
  function updateLink(i, patch) {
    set(
      'streets',
      form.streets.map((l, idx) => (idx === i ? { ...l, ...patch } : l))
    );
  }
  function removeLink(i) {
    set('streets', form.streets.filter((_, idx) => idx !== i));
  }

  async function submit(e) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        code: form.code,
        owner: form.owner,
        phone: form.phone,
        address: form.address,
        banner: form.banner,
        atStreetEnd: form.atStreetEnd,
        active: form.active,
        notes: form.notes,
        streets: form.streets.filter((l) => l.street),
      };
      if (isNew) await post('/shops', payload);
      else await put(`/shops/${initial._id}`, payload);
      onSaved(isNew ? 'Shop created' : 'Shop updated');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const points = form.banner === 'large' ? 2 : form.banner === 'medium' ? 1 : 0;

  return (
    <Modal
      wide
      title={isNew ? 'New shop' : `Edit ${initial.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save shop'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}

        <fieldset>
          <legend>Shop</legend>
          <div className="form-grid">
            <label className="field">
              <span>Shop name *</span>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
            </label>
            <label className="field">
              <span>Map code</span>
              <input
                value={form.code}
                onChange={(e) => set('code', e.target.value)}
                placeholder="A, B, C…"
                maxLength={4}
              />
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
          <label className="field">
            <span>Address</span>
            <input value={form.address} onChange={(e) => set('address', e.target.value)} />
          </label>
        </fieldset>

        <fieldset>
          <legend>Banner — decides the commission share</legend>
          <div className="form-grid">
            <label className="field">
              <span>Banner bought</span>
              <select value={form.banner} onChange={(e) => set('banner', e.target.value)}>
                <option value="large">Large — full, 2 points</option>
                <option value="medium">Medium — 50%, 1 point</option>
                <option value="none">No banner — 0 points</option>
              </select>
            </label>
            <label className="field">
              <span>Position on the street</span>
              <select
                value={form.atStreetEnd ? 'end' : 'mid'}
                onChange={(e) => set('atStreetEnd', e.target.value === 'end')}
              >
                <option value="mid">Along the street</option>
                <option value="end">At the street ending</option>
              </select>
            </label>
          </div>
          <div className="alert success" style={{ marginBottom: 0 }}>
            Worth <strong>{points} point{points === 1 ? '' : 's'}</strong> before proximity is applied.
          </div>
        </fieldset>

        <fieldset>
          <legend>Placement on streets</legend>
          <p className="muted small" style={{ marginTop: 0 }}>
            Add a second street to make this a corner shop — it then earns on both.
          </p>

          {form.streets.length === 0 && (
            <div className="empty" style={{ padding: 18 }}>
              Not placed on any street yet.
            </div>
          )}

          {form.streets.map((link, i) => {
            const pct = PROX_PCT[link.proximity];
            return (
              <div
                key={i}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <div className="form-grid">
                  <label className="field">
                    <span>Street *</span>
                    <select
                      value={link.street}
                      onChange={(e) => updateLink(i, { street: e.target.value, between: [] })}
                    >
                      <option value="">Select street…</option>
                      {streets
                        .filter(
                          (s) => s._id === link.street || !form.streets.some((l) => l.street === s._id)
                        )
                        .map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>How close is it?</span>
                    <select
                      value={link.proximity}
                      onChange={(e) => updateLink(i, { proximity: e.target.value })}
                    >
                      <option value="on">On the street — 100%</option>
                      <option value="close">Close by, ~5m — 70%</option>
                      <option value="near">Nearby, ~15m — 20%</option>
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span>Place between</span>
                  <div className="row">
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => setPickingFor(i)}
                      disabled={!link.street}
                      title={!link.street ? 'Choose a street first' : ''}
                    >
                      🗺 Pick on the map
                    </button>
                    {(link.between || []).length > 0 ? (
                      <>
                        {link.between.map((id, n) => (
                          <span key={id} className="badge">
                            {n + 1}. {pickedNames[id] || 'Selected shop'}
                          </span>
                        ))}
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => updateLink(i, { between: [], order: '' })}
                        >
                          Clear
                        </button>
                      </>
                    ) : (
                      <span className="muted small">
                        Not set — the shop is added at the end of the line.
                      </span>
                    )}
                  </div>
                </label>

                <div className="row">
                  <span className="badge">Weight on this street: {(points * pct) / 100}</span>
                  <span className="spacer" />
                  <button type="button" className="btn sm danger" onClick={() => removeLink(i)}>
                    Remove street
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className="btn sm"
            onClick={addLink}
            disabled={form.streets.length >= streets.length}
          >
            + Add street
          </button>
        </fieldset>

        <label className="field">
          <span>Notes</span>
          <textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </label>
        <button type="submit" hidden />
      </form>

      {pickingFor !== null && (
        <ShopPicker
          title="Pick the two shops to sit between"
          street={form.streets[pickingFor]?.street}
          max={2}
          initial={form.streets[pickingFor]?.between || []}
          exclude={initial._id ? [initial._id] : []}
          onCancel={() => setPickingFor(null)}
          onConfirm={(ids, names) => {
            updateLink(pickingFor, { between: ids, order: '' });
            if (names) setPickedNames((m) => ({ ...m, ...names }));
            setPickingFor(null);
          }}
        />
      )}
    </Modal>
  );
}
