import React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-neutral-900 border border-neutral-700 px-3.5 py-2 text-xs font-mono-tabular text-neutral-200 shadow-xl"
    >
      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
      <span>Mode Offline Aktif · Tersimpan di IndexedDB</span>
    </div>
  );
};
