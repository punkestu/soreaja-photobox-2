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
  theme?: 'light' | 'dark' | 'warm' | string;
  canvasWidth?: number;
  canvasHeight?: number;
  previewImg: string;
  frameImg: string;
  photoCount: number;
  positions: FramePosition[];
  hideGenericStamps?: boolean;
}

export interface StripRatioInfo {
  width: number;
  height: number;
  ratio: number; // width / height
  ratioFormatted: string; // e.g. "1:3 (Photo Strip)"
  isVerticalLongStrip: boolean;
  type: 'vertical-long-strip' | 'standard-portrait' | 'square' | 'landscape';
}

export type PhotoFilter = 'original' | 'warm-sore' | 'noir-bw' | 'vintage-film' | 'korean-clean' | 'fuji-film';

export type AppLanguage = 'id' | 'en';

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
  showCropGuide?: boolean; // Tampilkan batas panduan area crop kamera
  printApiEndpoint?: string; // Endpoint URL for multipart/form-data printing API
  printerName?: string; // Legacy fallback printer name parameter
  thermalPrinterName?: string; // Nama printer thermal (misal Epson TM-T82 roll 80mm)
  colorPrinterName?: string; // Nama printer warna (misal DNP DS-RX1HS kertas 4R)
  enableShutterSound?: boolean; // Suara kamera saat capture foto
  enableSessionTimer?: boolean; // Aktifkan timer sesi booth
  sessionDurationMinutes?: number; // Durasi sesi dalam menit (default 5 menit)
  kioskBackground?: string; // Data URL Base64, preset ID, or external URL
  kioskBackgroundOverlayOpacity?: number; // 20 - 100 percent
  themeColor?: string; // Hex color e.g. '#E11D48'
  themePreset?: string; // 'crimson' | 'amber' | etc.
  language?: AppLanguage; // 'id' | 'en'
  updatedAt?: string;
}

export interface SessionRecord {
  id?: number;
  timestamp: number;
  frameId: string;
  frameName: string;
  photoCount: number;
  finalLayoutBase64: string;
  doubleStripBase64?: string | null;
  driveUrl: string;
  printedThermal: boolean;
  printedColor: boolean;
  thermalPrintCount?: number;
  colorPrintCount?: number;
}

export interface PlacedSticker {
  id: string;
  stickerId: string;
  content: string; // Emoji, SVG symbol, or text stamp
  type: 'emoji' | 'stamp' | 'badge';
  x: number; // 0 to 1 normalized coordinate relative to canvas width
  y: number; // 0 to 1 normalized coordinate relative to canvas height
  scale: number; // 0.5 to 2.5 relative scale
  rotation: number; // degrees -180 to 180
}

export interface ActiveSessionRecord {
  id: string; // 'current_active_session'
  selectedFrame: FrameMetadata | null;
  capturedPhotos: string[];
  retakeIndex: number | null;
  finalLayoutBase64: string | null;
  doubleStripBase64?: string | null;
  gifBlobUrl?: string | null;
  selectedFilter: PhotoFilter;
  customCaption: string;
  showFrameStamps?: boolean;
  placedStickers?: PlacedSticker[];
  updatedAt: number;
}

export interface PhotoboxState {
  selectedFrame: FrameMetadata | null;
  capturedPhotos: string[];
  retakeIndex: number | null;
  finalLayoutBase64: string | null;
  doubleStripBase64: string | null;
  gifBlobUrl: string | null;
  selectedFilter: PhotoFilter;
  customCaption: string;
  showFrameStamps: boolean;
  placedStickers: PlacedSticker[];
  isHydrated: boolean;
}


