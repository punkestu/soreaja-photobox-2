export interface FramePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameMetadata {
  id: string;
  name: string;
  subtitle?: string;
  theme?: 'light' | 'dark' | 'warm';
  canvasWidth?: number;
  canvasHeight?: number;
  previewImg: string;
  frameImg: string;
  photoCount: number;
  positions: FramePosition[];
  hideGenericStamps?: boolean;
}

export type PhotoFilter = 'original' | 'warm-sore' | 'noir-bw' | 'vintage-film';

export interface AppSettings {
  id: string; // 'app_settings'
  driveUrl: string;
  studioName?: string;
  eventName?: string;
  defaultCaption?: string;
  showFrameStamps?: boolean;
  countdownSeconds?: number;
  autoDownload?: boolean;
  mirrorCamera?: boolean;
  cameraSourceMode?: 'auto' | 'simulator';
  kioskBackground?: string; // Data URL Base64, preset ID, or external URL
  kioskBackgroundOverlayOpacity?: number; // 20 - 100 percent
  themeColor?: string; // Hex color e.g. '#E11D48'
  themePreset?: string; // 'crimson' | 'amber' | etc.
  updatedAt?: string;
}

export interface SessionRecord {
  id?: number;
  timestamp: number;
  frameId: string;
  frameName: string;
  photoCount: number;
  finalLayoutBase64: string;
  driveUrl: string;
  printedThermal: boolean;
  printedColor: boolean;
}

export interface ActiveSessionRecord {
  id: string; // 'current_active_session'
  selectedFrame: FrameMetadata | null;
  capturedPhotos: string[];
  retakeIndex: number | null;
  finalLayoutBase64: string | null;
  gifBlobUrl?: string | null;
  selectedFilter: PhotoFilter;
  customCaption: string;
  showFrameStamps?: boolean;
  updatedAt: number;
}

export interface PhotoboxState {
  selectedFrame: FrameMetadata | null;
  capturedPhotos: string[];
  retakeIndex: number | null;
  finalLayoutBase64: string | null;
  gifBlobUrl: string | null;
  selectedFilter: PhotoFilter;
  customCaption: string;
  showFrameStamps: boolean;
  isHydrated: boolean;
}

