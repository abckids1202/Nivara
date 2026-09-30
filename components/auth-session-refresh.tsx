'use client';

import { useEffect } from 'react';

const REFRESH_INTERVAL_MS = 45 * 60 * 1000;

export function AuthSessionRefresh() {
  useEffect(() => {
    const refresh = () => {
      void fetch('/api/auth/refresh', { method: 'POST' }).catch(
        () => undefined,
      );
    };
    refresh();
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);
  return null;
}
