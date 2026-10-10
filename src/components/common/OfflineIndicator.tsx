import React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const settings = useLiveQuery(() => db.settings.get('app_settings'), []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 px-3.5 py-2 text-xs font-mono-tabular text-neutral-200 shadow-2xl"
    >
      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
      <span>
        Mode Offline Aktif · {settings?.printApiEndpoint ? 'Print Server Lokal Siap' : 'Tersimpan di IndexedDB'}
      </span>
    </div>
  );
};
