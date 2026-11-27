import Dexie, { type Table } from 'dexie';
import type {
  AppSettings,
  SessionRecord,
  ActiveSessionRecord,
  FramePackInfo,
  ImagePreprocessingSettings,
  PhotoEnhancerSettings,
} from './types/photobox';

export class PhotoboxDatabase extends Dexie {
  settings!: Table<AppSettings, string>;
  sessions!: Table<SessionRecord, number>;
  activeSession!: Table<ActiveSessionRecord, string>;
  framePacks!: Table<FramePackInfo, string>;

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
    this.version(3).stores({
      settings: 'id, driveUrl',
      sessions: '++id, timestamp, frameId, frameName, driveUrl',
      activeSession: 'id, updatedAt',
      framePacks: 'id, name, isDefault, updatedAt',
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

export async function resetAllData(): Promise<void> {
  try {
    await Promise.all([
      db.sessions.clear(),
      db.activeSession.clear(),
      db.settings.clear(),
      db.framePacks.clear(),
    ]);
    await db.settings.put({
      ...DEFAULT_APP_SETTINGS,
      updatedAt: new Date().toISOString(),
    });
    try {
      localStorage.removeItem('soreaja_last_active_route');
      sessionStorage.removeItem('soreaja_last_active_route');
    } catch {
      // Ignore storage access errors
    }
  } catch (err) {
    console.error('Failed to reset all data in PhotoboxDatabase:', err);
    throw err;
  }
}



export const DEFAULT_DRIVE_URL =
  'https://drive.google.com/drive/folders/1SoreAjaPhotobox2StudioArchive';

export const DEFAULT_IMAGE_PREPROCESSING: ImagePreprocessingSettings = {
  enabled: true,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  ambiance: 0,
  highlights: 0,
  shadows: 0,
  warmth: 0,
};

export const DEFAULT_PHOTO_ENHANCER: PhotoEnhancerSettings = {
  enabled: false,
  preset: 'studio-crisp',
  upscaleScale: 1.5,
  sharpenAmount: 45,
  denoiseLevel: 20,
  autoTone: true,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'app_settings',
  driveUrl: DEFAULT_DRIVE_URL,
  studioName: 'SoreAja Studio — Booth 02',
  eventName: 'SoreAja Sunset Session 2026',
  defaultCaption: 'SOREAJA — Pose',
  showFrameStamps: true,
  countdownSeconds: 3,
  autoDownload: true,
  mirrorCamera: true,
  cameraSourceMode: 'auto',
  showCropGuide: true,
  printApiEndpoint: '', // URL e.g. http://localhost:5000/print
  printerName: '',
  thermalPrinterName: '', // Nama printer thermal bawaan
  colorPrinterName: '', // Nama printer warna bawaan
  enableShutterSound: true,
  enableSessionTimer: true,
  sessionDurationMinutes: 5,
  kioskBackground: '', // Empty means use default studio hero image
  kioskBackgroundOverlayOpacity: 60, // 60%
  themeColor: '#E11D48',
  themePreset: 'crimson',
  language: 'id',
  idleScreenMode: 'standard',
  activeFramePack: 'default',
  imagePreprocessing: DEFAULT_IMAGE_PREPROCESSING,
  photoEnhancer: DEFAULT_PHOTO_ENHANCER,
  updatedAt: new Date().toISOString(),
};

export async function ensureDefaultSettings(): Promise<AppSettings> {
  try {
    const existing = await db.settings.get('app_settings');
    if (existing && existing.driveUrl) {
      return {
        ...DEFAULT_APP_SETTINGS,
        ...existing,
        activeFramePack: existing.activeFramePack || 'default',
        imagePreprocessing: existing.imagePreprocessing || DEFAULT_IMAGE_PREPROCESSING,
        photoEnhancer:
          existing.photoEnhancer &&
          (existing.photoEnhancer.preset === 'natural-clean' ||
            existing.photoEnhancer.preset === 'studio-crisp' ||
            existing.photoEnhancer.preset === 'hd-upscale')
            ? { ...DEFAULT_PHOTO_ENHANCER, ...existing.photoEnhancer }
            : {
                ...DEFAULT_PHOTO_ENHANCER,
                enabled: Boolean(existing.photoEnhancer?.enabled),
              },
      };
    }
    await db.settings.put(DEFAULT_APP_SETTINGS);
    return DEFAULT_APP_SETTINGS;
  } catch (err) {
    console.warn('Dexie fallback to in-memory settings:', err);
    return DEFAULT_APP_SETTINGS;
  }
}
