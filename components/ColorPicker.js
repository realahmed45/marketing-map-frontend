'use client';

/**
 * Swatch grid over the map's fixed palette. A street is given the next free
 * colour automatically on creation, so this only appears when changing one.
 */
export default function ColorPicker({ palette, value, onChange }) {
  return (
    <div>
      <div className="swatches">
        {palette.map((c) => (
          <button
            key={c.hex}
            type="button"
            title={`${c.name} · ${c.hex}`}
            className={`swatch${value === c.hex ? ' active' : ''}`}
            style={{ background: c.hex }}
            onClick={() => onChange(c.hex)}
          />
        ))}
      </div>
      <div className="row small muted" style={{ marginTop: 6, gap: 8 }}>
        <span className="dot" style={{ background: value || '#e2e8f0' }} />
        <code>{value || 'assigned automatically'}</code>
        {value && (
          <button type="button" className="btn sm" onClick={() => onChange('')}>
            Auto
          </button>
        )}
      </div>
    </div>
  );
}
