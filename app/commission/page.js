'use client';

import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { useToast } from '@/components/Toast';
import { get, post, put } from '@/lib/api';

export default function CommissionPage() {
  const [settings, setSettings] = useState(null);
  const [streets, setStreets] = useState([]);
  const [street, setStreet] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState(null);
  const [calcError, setCalcError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, notify] = useToast();

  useEffect(() => {
    Promise.all([get('/commission/settings'), get('/streets')])
      .then(([s, st]) => {
        setSettings(s);
        setStreets(st);
        setAmount(String(s.defaultAmount));
        setStreet(st[0]?._id || '');
      })
      .catch((e) => notify(e.message, 'error'));
  }, [notify]);

  const calculate = useCallback(async () => {
    if (!street || amount === '') return setResult(null);
    setCalcError('');
    try {
      setResult(await post('/commission/calculate', { street, amount: Number(amount) }));
    } catch (e) {
      setResult(null);
      setCalcError(e.message);
    }
  }, [street, amount]);

  // Recalculate as the amount or street changes.
  useEffect(() => {
    const t = setTimeout(calculate, 250);
    return () => clearTimeout(t);
  }, [calculate]);

  async function saveSettings() {
    setSaving(true);
    try {
      const saved = await put('/commission/settings', {
        defaultAmount: Number(settings.defaultAmount),
        currency: settings.currency,
        bannerPoints: settings.bannerPoints,
        proximityPercent: settings.proximityPercent,
      });
      setSettings(saved);
      notify('Settings saved');
      calculate();
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <Shell><div className="loading">Loading…</div></Shell>;

  const cur = result?.currency || settings.currency;
  const fmt = (n) => `${cur} ${Number(n).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
  const setPoints = (k, v) =>
    setSettings((s) => ({ ...s, bannerPoints: { ...s.bannerPoints, [k]: v } }));
  const setPct = (k, v) =>
    setSettings((s) => ({ ...s, proximityPercent: { ...s.proximityPercent, [k]: v } }));

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Commission</h1>
          <p>Enter an amount and see how it divides across the shops on a street</p>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Calculator</h3>
        <div className="row" style={{ marginBottom: 6 }}>
          <label className="field" style={{ marginBottom: 0, minWidth: 210 }}>
            <span>Street</span>
            <select value={street} onChange={(e) => setStreet(e.target.value)}>
              {streets.length === 0 && <option value="">No streets yet</option>}
              {streets.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ marginBottom: 0, minWidth: 190 }}>
            <span>Amount to divide</span>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50000"
            />
          </label>
        </div>
      </div>

      {calcError && <div className="alert error" style={{ marginTop: 16 }}>{calcError}</div>}

      {result && (
        <div className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              Split across {result.lines.length} shop(s)
            </h3>
            <span className="spacer" />
            <span className="badge">Total points: {result.totalWeight}</span>
            <span className="badge green">Paid out: {fmt(result.totalPaid)}</span>
          </div>

          {result.lines.length === 0 ? (
            <div className="empty">No shops on this street yet.</div>
          ) : result.totalWeight === 0 ? (
            <div className="alert error">
              No shop on this street has a banner, so there are no points to divide by. Nothing is
              paid out.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Shop</th>
                    <th>Banner</th>
                    <th>Points</th>
                    <th>Proximity</th>
                    <th>Weight</th>
                    <th>Share</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lines.map((l) => (
                    <tr key={l.shop}>
                      <td>
                        <strong>{l.name}</strong>
                        {l.code && <span className="muted small"> ({l.code})</span>}
                        {l.isMine && <span className="badge green" style={{ marginLeft: 6 }}>Me</span>}
                      </td>
                      <td className="small">{l.banner}</td>
                      <td>{l.points}</td>
                      <td className="small">{l.proximityPercent}%</td>
                      <td>
                        <strong>{l.weight}</strong>
                        <span className="muted small">
                          {' '}
                          / {result.totalWeight}
                        </span>
                      </td>
                      <td>{l.sharePercent}%</td>
                      <td>
                        <strong>{fmt(l.share)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted small" style={{ marginBottom: 0 }}>
            Weight = banner points × proximity. Each shop takes weight ÷ total weight of the amount,
            so the full sum is always distributed.
          </p>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">Rules</h3>
        <div className="grid cols-2">
          <div>
            <div className="small muted" style={{ marginBottom: 8 }}>
              BANNER POINTS
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Large</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={settings.bannerPoints.large}
                  onChange={(e) => setPoints('large', e.target.value)}
                />
              </label>
              <label className="field">
                <span>Medium</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={settings.bannerPoints.medium}
                  onChange={(e) => setPoints('medium', e.target.value)}
                />
              </label>
              <label className="field">
                <span>No banner</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={settings.bannerPoints.none}
                  onChange={(e) => setPoints('none', e.target.value)}
                />
              </label>
            </div>
          </div>

          <div>
            <div className="small muted" style={{ marginBottom: 8 }}>
              PROXIMITY PERCENTAGE
            </div>
            <div className="form-grid">
              <label className="field">
                <span>On the street</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.proximityPercent.on}
                  onChange={(e) => setPct('on', e.target.value)}
                />
              </label>
              <label className="field">
                <span>Close ~5m</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.proximityPercent.close}
                  onChange={(e) => setPct('close', e.target.value)}
                />
              </label>
              <label className="field">
                <span>Nearby ~15m</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.proximityPercent.near}
                  onChange={(e) => setPct('near', e.target.value)}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Default amount</span>
            <input
              type="number"
              min="0"
              value={settings.defaultAmount}
              onChange={(e) => setSettings((s) => ({ ...s, defaultAmount: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Currency label</span>
            <input
              value={settings.currency}
              onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value }))}
            />
          </label>
        </div>

        <button className="btn primary" onClick={saveSettings} disabled={saving}>
          {saving ? 'Saving…' : 'Save rules'}
        </button>
      </div>
      {toast}
    </Shell>
  );
}
