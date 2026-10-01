'use client';

import { useEffect, useState } from 'react';

export function ConnectionStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const updateOnline = () => setOnline(true);
    const updateOffline = () => setOnline(false);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOffline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOffline);
    };
  }, []);

  if (online) return null;

  return (
    <output
      className="fixed top-0 right-0 left-0 z-[100] border-b border-[#8b3f2f] bg-[#8b3f2f] px-4 py-2 text-center text-sm font-medium text-white"
      aria-live="assertive"
    >
      You&apos;re offline. Some actions may be unavailable until your connection
      returns.
    </output>
  );
}
