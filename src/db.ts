import Dexie, { type Table } from 'dexie';
import type { AppSettings, SessionRecord, ActiveSessionRecord } from './types/photobox';

export class PhotoboxDatabase extends Dexie {
  settings!: Table<AppSettings, string>;
  sessions!: Table<SessionRecord, number>;
  activeSession!: Table<ActiveSessionRecord, string>;

  constructor() {
    super('PhotoboxDB');
    this.version(1).stores({
      settings: 'id, driveUrl', // 'id' sebagai primary key sesuai TSD 3.1
      sessions: '++id, timestamp, frameId, frameName, driveUrl',
    });
    this.version(2).stores({
      settings: 'id, driveUrl',
      sessions: '++id, timestamp, frameId, frameName, driveUrl',
      activeSession: 'id, updatedAt',
    });
  }
}

export const db = new PhotoboxDatabase();

export async function clearActiveSession(): Promise<void> {
  try {
    await db.activeSession.delete('current_active_session');
  } catch (err) {
    console.warn('Error clearing active session:', err);
  }
}


export const DEFAULT_DRIVE_URL =
  'https://drive.google.com/drive/folders/1SoreAjaPhotobox2StudioArchive';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'app_settings',
  driveUrl: DEFAULT_DRIVE_URL,
  studioName: 'SoreAja Studio — Booth 02',
  eventName: 'SoreAja Sunset Session 2026',
  defaultCaption: 'SOREAJA — PHOTOBOX 2',
  showFrameStamps: true,
  countdownSeconds: 3,
  autoDownload: true,
  mirrorCamera: true,
  cameraSourceMode: 'auto',
  kioskBackground: '', // Empty means use default studio hero image
  kioskBackgroundOverlayOpacity: 60, // 60%
  themeColor: '#E11D48',
  themePreset: 'crimson',
  updatedAt: new Date().toISOString(),
};

export async function ensureDefaultSettings(): Promise<AppSettings> {
  try {
    const existing = await db.settings.get('app_settings');
    if (existing && existing.driveUrl) {
      return {
        ...DEFAULT_APP_SETTINGS,
        ...existing,
      };
    }
    await db.settings.put(DEFAULT_APP_SETTINGS);
    return DEFAULT_APP_SETTINGS;
  } catch (err) {
    console.warn('Dexie fallback to in-memory settings:', err);
    return DEFAULT_APP_SETTINGS;
  }
}
