'use client';

import { useEffect, useRef } from 'react';

const REFRESH_INTERVAL_MS = 45 * 60 * 1000;

export function AuthSessionRefresh() {
  const inFlight = useRef(false);

  useEffect(() => {
    const refresh = () => {
      if (inFlight.current) return;
      inFlight.current = true;
      void fetch('/api/auth/refresh', { method: 'POST' })
        .catch(() => undefined)
        .finally(() => {
          inFlight.current = false;
        });
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh();
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);
  return null;
}
