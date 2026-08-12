'use client';

import { useCallback, useEffect, useState } from 'react';

/** Minimal toast: `const [toast, notify] = useToast()` then render {toast}. */
export function useToast() {
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);

  const notify = useCallback((text, kind = 'info') => setMsg({ text, kind }), []);

  const node = msg ? (
    <div className={`toast${msg.kind === 'error' ? ' error' : ''}`}>{msg.text}</div>
  ) : null;

  return [node, notify];
}
