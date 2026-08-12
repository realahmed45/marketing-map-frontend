'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import ShopPicker from '@/components/ShopPicker';
import ColorPicker from '@/components/ColorPicker';
import { useToast } from '@/components/Toast';
import { del, get, post, put } from '@/lib/api';

const EMPTY = { name: '', color: '', orientation: 'h', lane: 0, active: true, notes: '' };

export default function StreetsPage() {
  const [streets, setStreets] = useState([]);
  const [palette, setPalette] = useState([]);
  const [editing, setEditing] = useState(null);
  const [managing, setManaging] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, notify] = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStreets(await get('/streets'));
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
    get('/streets/palette').then(setPalette).catch(() => {});
  }, [load]);

  async function remove(s) {
    if (!confirm(`Delete "${s.name}"?\n\nIts ${s.sectionCount} section(s) go too. Shops survive but lose this street.`))
      return;
    try {
      await del(`/streets/${s._id}`);
      notify('Street deleted');
      load();
    } catch (e) {
      notify(e.message, 'error');
    }
  }

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Streets</h1>
          <p>Lines on the map. Add shops to a street, then divide it into sections.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing(EMPTY)}>
          + New street
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">Loading…</div>
        ) : streets.length === 0 ? (
          <div className="empty">No streets yet. Create one to start the map.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Street</th>
                  <th>Direction</th>
                  <th>Shops</th>
                  <th>Sections</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {streets.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <span className="dot" style={{ background: s.color }} />
                        <strong>{s.name}</strong>
                      </span>
                    </td>
                    <td className="small">{s.orientation === 'h' ? 'Horizontal' : 'Vertical'}</td>
                    <td>{s.shopCount}</td>
                    <td>{s.sectionCount}</td>
                    <td>
                      <span className={`badge ${s.active ? 'green' : 'red'}`}>
                        {s.active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="actions">
                      <button
                        className="btn sm"
                        onClick={() => setManaging(s)}
                        disabled={s.shopCount < 2}
                        title={s.shopCount < 2 ? 'Add at least 2 shops to this street first' : ''}
                      >
                        Sections
                      </button>{' '}
                      <button className="btn sm" onClick={() => setEditing(s)}>
                        Edit
                      </button>{' '}
                      <button className="btn sm danger" onClick={() => remove(s)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small" style={{ marginBottom: 0 }}>
          Sections unlock once a street has two or more shops — add them on the{' '}
          <Link href="/shops" style={{ color: 'var(--primary)' }}>
            Shops
          </Link>{' '}
          page.
        </p>
      </div>

      {editing && (
        <StreetForm
          initial={editing}
          palette={palette}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            setEditing(null);
            notify(m);
            load();
          }}
        />
      )}
      {managing && (
        <SectionManager
          street={managing}
          streets={streets}
          onClose={() => setManaging(null)}
          onChanged={load}
          notify={notify}
        />
      )}
      {toast}
    </Shell>
  );
}

function StreetForm({ initial, palette, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isNew = !initial._id;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        color: form.color,
        orientation: form.orientation,
        lane: Number(form.lane) || 0,
        active: form.active,
        notes: form.notes,
      };
      if (isNew) await post('/streets', payload);
      else await put(`/streets/${initial._id}`, payload);
      onSaved(isNew ? 'Street created' : 'Street updated');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isNew ? 'New street' : `Edit ${initial.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save street'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}
        <label className="field">
          <span>Street name *</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
        </label>
        <label className="field">
          <span>Line colour</span>
          <ColorPicker palette={palette} value={form.color} onChange={(hex) => set('color', hex)} />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Draw direction</span>
            <select value={form.orientation} onChange={(e) => set('orientation', e.target.value)}>
              <option value="h">Horizontal →</option>
              <option value="v">Vertical ↓</option>
            </select>
          </label>
          <label className="field">
            <span>Lane (row / column)</span>
            <input type="number" value={form.lane} onChange={(e) => set('lane', e.target.value)} />
          </label>
          <label className="field">
            <span>Status</span>
            <select value={form.active ? 'a' : 'i'} onChange={(e) => set('active', e.target.value === 'a')}>
              <option value="a">Active</option>
              <option value="i">Hidden from map</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </label>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/** Short label for a shop id, falling back gracefully if it isn't loaded yet. */
function label(shops, id) {
  const s = shops.find((x) => String(x._id) === String(id));
  if (!s) return 'Shop';
  return s.code ? `${s.code} — ${s.name}` : s.name;
}

/** Sections live inside the street they belong to, so they're managed here. */
function SectionManager({ street, streets, onClose, onChanged, notify }) {
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await get(`/streets/${street._id}`));
    } catch (e) {
      setError(e.message);
    }
  }, [street._id]);

  useEffect(() => {
    load();
  }, [load]);

  const blank = {
    street: street._id,
    name: '',
    fromShop: '',
    toShop: '',
    connection: { kind: 'none', otherStreet: '', atShop: '' },
    notes: '',
  };

  async function save() {
    setError('');
    setBusy(true);
    try {
      if (form._id) await put(`/sections/${form._id}`, form);
      else await post('/sections', form);
      setForm(null);
      await load();
      onChanged();
      notify('Section saved');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this section?')) return;
    try {
      await del(`/sections/${id}`);
      await load();
      onChanged();
      notify('Section deleted');
    } catch (e) {
      setError(e.message);
    }
  }

  const shops = detail?.shops || [];
  // Only shops on both streets can serve as a crossing point.
  const crossCandidates = form?.connection?.otherStreet
    ? shops.filter((s) => s.streets.some((l) => String(l.street) === String(form.connection.otherStreet)))
    : [];

  return (
    <Modal wide title={`Sections of ${street.name}`} onClose={onClose}>
      {error && <div className="alert error">{error}</div>}
      {!detail ? (
        <div className="loading">Loading…</div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <span className="muted small">
              {shops.length} shop(s) on this street: {shops.map((s) => s.code || s.name).join(' → ')}
            </span>
            <span className="spacer" />
            <button className="btn sm primary" onClick={() => setForm(blank)}>
              + Add section
            </button>
          </div>

          {detail.sections.length === 0 ? (
            <div className="empty">No sections yet.</div>
          ) : (
            <div className="table-wrap" style={{ marginBottom: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Section</th>
                    <th>Between</th>
                    <th>Connection</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {detail.sections.map((s) => (
                    <tr key={s._id}>
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
                      <td className="actions">
                        <button
                          className="btn sm"
                          onClick={() =>
                            setForm({
                              ...s,
                              street: street._id,
                              fromShop: s.fromShop?._id || '',
                              toShop: s.toShop?._id || '',
                              connection: {
                                kind: s.connection.kind,
                                otherStreet: s.connection.otherStreet?._id || '',
                                atShop: s.connection.atShop?._id || '',
                              },
                            })
                          }
                        >
                          Edit
                        </button>{' '}
                        <button className="btn sm danger" onClick={() => remove(s._id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {form && (
            <fieldset>
              <legend>{form._id ? 'Edit section' : 'New section'}</legend>
              <label className="field">
                <span>Label (optional)</span>
                <input
                  value={form.name || ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. North stretch"
                />
              </label>
              <label className="field">
                <span>Section runs between *</span>
                <div className="row">
                  <button type="button" className="btn sm" onClick={() => setPicking(true)}>
                    🗺 Pick on the map
                  </button>
                  {form.fromShop && form.toShop ? (
                    <span className="badge">
                      {label(shops, form.fromShop)} → {label(shops, form.toShop)}
                    </span>
                  ) : (
                    <span className="muted small">Click two shops on this street.</span>
                  )}
                </div>
              </label>

              <label className="field">
                <span>Connection to another street</span>
                <select
                  value={form.connection.kind}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      connection: { kind: e.target.value, otherStreet: '', atShop: '' },
                    })
                  }
                >
                  <option value="none">No connection — stand-alone for now</option>
                  <option value="crossing">Crosses another street</option>
                  <option value="nextTo">Next to / close by another street</option>
                </select>
              </label>

              {form.connection.kind !== 'none' && (
                <div className="form-grid">
                  <label className="field">
                    <span>{form.connection.kind === 'crossing' ? 'Crossing street' : 'Nearby street'} *</span>
                    <select
                      value={form.connection.otherStreet}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          connection: { ...form.connection, otherStreet: e.target.value, atShop: '' },
                        })
                      }
                    >
                      <option value="">Select…</option>
                      {streets
                        .filter((s) => s._id !== street._id)
                        .map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  {form.connection.kind === 'crossing' && (
                    <label className="field">
                      <span>At shop (the corner)</span>
                      <select
                        value={form.connection.atShop}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            connection: { ...form.connection, atShop: e.target.value },
                          })
                        }
                      >
                        <option value="">— not set —</option>
                        {crossCandidates.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      {form.connection.otherStreet && crossCandidates.length === 0 && (
                        <span className="small muted">
                          No shop sits on both streets yet — add one to both to mark the corner.
                        </span>
                      )}
                    </label>
                  )}
                </div>
              )}

              <div className="row">
                <button className="btn primary" onClick={save} disabled={busy}>
                  {busy ? 'Saving…' : 'Save section'}
                </button>
                <button className="btn" onClick={() => setForm(null)}>
                  Cancel
                </button>
              </div>
            </fieldset>
          )}

          {picking && (
            <ShopPicker
              title={`Pick the two ends of the section on ${street.name}`}
              street={street._id}
              max={2}
              initial={[form.fromShop, form.toShop].filter(Boolean)}
              onCancel={() => setPicking(false)}
              onConfirm={(ids) => {
                setForm({ ...form, fromShop: ids[0] || '', toShop: ids[1] || '' });
                setPicking(false);
              }}
            />
          )}
        </>
      )}
    </Modal>
  );
}
