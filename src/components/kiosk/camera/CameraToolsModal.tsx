import React, { memo, useState } from 'react';
import { STUDIO_PORTRAITS } from '../../../data/defaultFrames';
import type { TranslationDictionary } from '../../../i18n/translations';
import type { CropInfo } from './CropGuideOverlay';
import type { GPhotoStatus } from '../../../services/gphotoService';
import type { ImagePreprocessingSettings, PhotoEnhancerSettings } from '../../../types/photobox';
import {
  PREPROCESSING_PRESETS,
  isPreprocessingNeutral,
  getPreprocessingCssFilter,
} from '../../../services/imagePreprocessingService';
import { DEFAULT_IMAGE_PREPROCESSING, DEFAULT_PHOTO_ENHANCER } from '../../../db';

interface CameraToolsModalProps {
  showTools: boolean;
  onClose: () => void;
  cameraReady: boolean;
  targetSlot: { width: number; height: number };
  activeFrameName: string;
  cameraSource: 'webrtc' | 'gphoto' | 'simulator';
  setCameraSource: (val: 'webrtc' | 'gphoto' | 'simulator') => void;
  onSetCameraSourceMode?: (val: 'webrtc' | 'gphoto' | 'simulator') => Promise<void>;
  gphotoStatus: GPhotoStatus;
  onConnectGPhoto: () => Promise<void>;
  onDisconnectGPhoto: () => Promise<void>;
  onSetConfigValue?: (name: string, value: string | number) => Promise<void>;
  onRefreshConfig?: () => Promise<void>;
  showCropGuide: boolean;
  setShowCropGuide: React.Dispatch<React.SetStateAction<boolean>>;
  showGridLines: boolean;
  setShowGridLines: React.Dispatch<React.SetStateAction<boolean>>;
  cropInfo: CropInfo;
  activePoseIdx: number;
  setActivePoseIdx: (idx: number) => void;
  t: TranslationDictionary;
  imagePreprocessing?: ImagePreprocessingSettings;
  onUpdatePreprocessing?: (updater: Partial<ImagePreprocessingSettings> | ImagePreprocessingSettings) => Promise<void>;
  onTestCapture?: () => Promise<string>;
  photoEnhancer?: PhotoEnhancerSettings;
  onTogglePhotoEnhancer?: (enabled: boolean) => Promise<void>;
}

export const CameraToolsModal: React.FC<CameraToolsModalProps> = memo(({
  showTools,
  onClose,
  cameraReady,
  targetSlot,
  activeFrameName,
  cameraSource,
  setCameraSource,
  onSetCameraSourceMode,
  gphotoStatus,
  onConnectGPhoto,
  onDisconnectGPhoto,
  onSetConfigValue,
  onRefreshConfig,
  showCropGuide,
  setShowCropGuide,
  showGridLines,
  setShowGridLines,
  cropInfo,
  activePoseIdx,
  setActivePoseIdx,
  t,
  imagePreprocessing = DEFAULT_IMAGE_PREPROCESSING,
  onUpdatePreprocessing,
  onTestCapture,
  photoEnhancer = DEFAULT_PHOTO_ENHANCER,
  onTogglePhotoEnhancer,
}) => {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isPreprocessOpen, setIsPreprocessOpen] = useState<boolean>(true);
  const [previewPoseIdx, setPreviewPoseIdx] = useState<number>(activePoseIdx);
  const [isTestingCapture, setIsTestingCapture] = useState<boolean>(false);
  const [realTestSnapshot, setRealTestSnapshot] = useState<string | null>(null);

  if (!showTools) return null;

  const cfg = gphotoStatus.config || {};
  const isoField = cfg['iso'] || cfg['iso-speed'] || cfg['isospeed'];
  const shutterField = cfg['shutterspeed'] || cfg['shutter-speed'] || cfg['shutterspeed2'];
  const apertureField = cfg['aperture'] || cfg['f-number'] || cfg['fnumber'];
  const wbField = cfg['whitebalance'] || cfg['white-balance'];
  const captureTargetField = cfg['capturetarget'];

  const handleSyncFromCamera = async () => {
    if (!onRefreshConfig) return;
    setIsSyncing(true);
    try {
      await onRefreshConfig();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md p-4 sm:p-6 flex flex-col justify-between animate-in fade-in duration-200 pointer-events-auto">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>⚙️</span>
            <span>{t.camera.tools}</span>
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-white/10 rounded-full text-[11px] text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{cameraReady ? t.camera.live : t.camera.loading}</span>
          </span>
          <span className="hidden sm:inline text-xs font-mono-tabular text-zinc-400">
            {targetSlot.width}×{targetSlot.height}px
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all cursor-pointer border border-zinc-700"
        >
          ✕ {t.camera.closeTools}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-3 sm:space-y-4">
        {/* Source Selection & Aids */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800 space-y-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
              Sumber Kamera:
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  setCameraSource('webrtc');
                  if (onSetCameraSourceMode) await onSetCameraSourceMode('webrtc');
                }}
                className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-all border ${cameraSource === 'webrtc'
                  ? 'bg-[var(--theme-accent,#E11D48)] text-white border-[var(--theme-accent,#E11D48)]'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                  }`}
              >
                📷 {t.camera.webRtc}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setCameraSource('gphoto');
                  if (onSetCameraSourceMode) await onSetCameraSourceMode('gphoto');
                }}
                className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-all border ${cameraSource === 'gphoto'
                  ? 'bg-[var(--theme-accent,#E11D48)] text-white border-[var(--theme-accent,#E11D48)]'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                  }`}
              >
                📸 {t.camera.dslr}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setCameraSource('simulator');
                  if (onSetCameraSourceMode) await onSetCameraSourceMode('simulator');
                }}
                className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-all border ${cameraSource === 'simulator'
                  ? 'bg-[var(--theme-accent,#E11D48)] text-white border-[var(--theme-accent,#E11D48)]'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                  }`}
              >
                🖥️ {t.camera.sim}
              </button>
            </div>

            {/* DSLR WebUSB connection & status management */}
            {cameraSource === 'gphoto' && (
              <div className="mt-2.5 pt-2.5 border-t border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Status USB:</span>
                  <span className="flex items-center gap-1.5 font-medium truncate max-w-[180px]">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${gphotoStatus.isConnected
                        ? 'bg-emerald-400 animate-pulse'
                        : gphotoStatus.isConnecting
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-zinc-500'
                        }`}
                    />
                    <span
                      className={`truncate ${gphotoStatus.isConnected ? 'text-emerald-400' : 'text-zinc-400'
                        }`}
                      title={gphotoStatus.modelName || ''}
                    >
                      {gphotoStatus.isConnected
                        ? gphotoStatus.modelName || t.camera.dslrConnected
                        : gphotoStatus.isConnecting
                          ? t.camera.dslrConnecting
                          : t.camera.dslrDisconnected}
                    </span>
                  </span>
                </div>

                {!gphotoStatus.isSupported ? (
                  <p className="text-[11px] text-amber-300 bg-amber-950/40 p-2 rounded-lg border border-amber-500/30">
                    ⚠️ {t.camera.dslrNotSupported}
                  </p>
                ) : !gphotoStatus.isConnected ? (
                  <button
                    type="button"
                    onClick={onConnectGPhoto}
                    disabled={gphotoStatus.isConnecting}
                    className="w-full py-2 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>🔌</span>
                    <span>{t.camera.dslrConnectPrompt}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onDisconnectGPhoto}
                    className="w-full py-1.5 px-3 text-xs font-semibold bg-zinc-800 hover:bg-rose-900/60 text-zinc-300 hover:text-rose-200 rounded-lg transition-all border border-zinc-700 cursor-pointer"
                  >
                    ✕ Putuskan Kamera DSLR
                  </button>
                )}

                {gphotoStatus.error && (
                  <p className="text-[11px] text-rose-300 bg-rose-950/40 p-1.5 rounded border border-rose-500/30">
                    {gphotoStatus.error}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800 space-y-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
              Bantuan Framing:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCropGuide((prev) => !prev)}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all border ${showCropGuide
                  ? 'bg-[var(--theme-accent,#E11D48)] text-white border-[var(--theme-accent,#E11D48)]'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                  }`}
              >
                📐 {t.camera.cropToggle}
              </button>
              <button
                type="button"
                onClick={() => setShowGridLines((prev) => !prev)}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all border ${showGridLines
                  ? 'bg-zinc-700 text-white border-zinc-600'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                  }`}
              >
                ⊞ {t.camera.gridToggle}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Toggle: AI Photo Enhancer (UpscalerJS) */}
        {onTogglePhotoEnhancer && (
          <div className="bg-zinc-900/95 rounded-xl p-3.5 border border-zinc-800 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-white">
                  ✨ {t.camera.enhancer.title}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    photoEnhancer.enabled
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {photoEnhancer.enabled
                    ? t.camera.enhancer.enabledBadge
                    : t.camera.enhancer.disabledBadge}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {t.camera.enhancer.lowEndHint}
              </p>
            </div>

            <button
              type="button"
              data-testid="camera-tools-toggle-enhancer-btn"
              onClick={() => onTogglePhotoEnhancer(!photoEnhancer.enabled)}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shrink-0 active:scale-95 ${
                photoEnhancer.enabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              }`}
            >
              {photoEnhancer.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
        )}

        {/* Unified Image Preprocessing Section (Applies to ALL Cameras) */}
        <div className="bg-zinc-900/95 rounded-xl p-3.5 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>🎨</span>
                <span>{t.camera.preprocessing?.title || 'Pra-pemrosesan Citra Kamera'}</span>
              </span>
              {!isPreprocessingNeutral(imagePreprocessing) && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-semibold animate-pulse">
                  Aktif
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onUpdatePreprocessing && (
                <>
                  <button
                    type="button"
                    onClick={() => onUpdatePreprocessing({ enabled: !imagePreprocessing.enabled })}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${imagePreprocessing.enabled !== false
                      ? 'bg-[var(--theme-accent,#E11D48)] text-white border-transparent'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                  >
                    {imagePreprocessing.enabled !== false ? 'Aktif' : 'Nonaktif'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdatePreprocessing(DEFAULT_IMAGE_PREPROCESSING)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-all cursor-pointer"
                    title={t.camera.preprocessing?.reset}
                  >
                    ↺ {t.camera.preprocessing?.reset || 'Reset'}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setIsPreprocessOpen((prev) => !prev)}
                className="text-xs text-zinc-400 hover:text-white p-1 cursor-pointer"
                title={isPreprocessOpen ? 'Sembunyikan' : 'Buka'}
              >
                {isPreprocessOpen ? '▲' : '▼'}
              </button>
            </div>
          </div>

          {isPreprocessOpen && (
            <div className="space-y-3">
              {/* Presets Row */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  {t.camera.preprocessing?.presetsTitle || 'Preset Studio:'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PREPROCESSING_PRESETS.map((preset) => {
                    const isMatched =
                      (imagePreprocessing.brightness ?? 0) === preset.settings.brightness &&
                      (imagePreprocessing.contrast ?? 0) === preset.settings.contrast &&
                      (imagePreprocessing.saturation ?? 0) === preset.settings.saturation &&
                      (imagePreprocessing.ambiance ?? 0) === preset.settings.ambiance &&
                      (imagePreprocessing.highlights ?? 0) === preset.settings.highlights &&
                      (imagePreprocessing.shadows ?? 0) === preset.settings.shadows &&
                      (imagePreprocessing.warmth ?? 0) === preset.settings.warmth;

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onUpdatePreprocessing?.({ ...preset.settings, enabled: true })}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer flex items-center gap-1 ${isMatched
                          ? 'bg-white text-zinc-950 border-white font-bold shadow-sm'
                          : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-white'
                          }`}
                      >
                        <span>{preset.icon}</span>
                        <span>{preset.nameId}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Small Live Preview if there was a change in preprocessing */}
              {!isPreprocessingNeutral(imagePreprocessing) && (
                <div className="bg-zinc-950 p-3 rounded-xl border border-emerald-500/40 space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{t.camera.preprocessing?.smallPreviewTitle || 'Pratinjau Hasil Perubahan:'}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-zinc-500 mr-1 hidden sm:inline">Pose:</span>
                      {STUDIO_PORTRAITS.map((p, idx) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPreviewPoseIdx(idx)}
                          className={`w-5 h-5 text-[10px] font-mono rounded cursor-pointer transition-all ${previewPoseIdx === idx
                            ? 'bg-emerald-500 text-black font-bold'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                            }`}
                        >
                          {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dual side-by-side compact thumbnails: Sebelum (Asli) vs Sesudah (Hasil) */}
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="flex items-center gap-2 shrink-0">
                      {/* 1. Asli */}
                      <div className="space-y-1 text-center">
                        <div className="relative w-24 h-18 sm:w-28 sm:h-20 rounded-lg overflow-hidden bg-black border border-zinc-700">
                          <img
                            src={STUDIO_PORTRAITS[previewPoseIdx % STUDIO_PORTRAITS.length].src}
                            alt="Asli"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-1 left-1 px-1 py-0.2 rounded text-[8px] font-bold bg-black/80 text-zinc-300">
                            {t.camera.preprocessing?.beforeLabel || 'Asli'}
                          </span>
                        </div>
                      </div>

                      <span className="text-zinc-500 font-bold text-xs">→</span>

                      {/* 2. Hasil Kalibrasi */}
                      <div className="space-y-1 text-center">
                        <div className="relative w-24 h-18 sm:w-28 sm:h-20 rounded-lg overflow-hidden bg-black border border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                          <img
                            src={STUDIO_PORTRAITS[previewPoseIdx % STUDIO_PORTRAITS.length].src}
                            alt="Hasil"
                            style={{
                              filter:
                                imagePreprocessing.enabled !== false
                                  ? getPreprocessingCssFilter(imagePreprocessing)
                                  : 'none',
                            }}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-1 left-1 px-1 py-0.2 rounded text-[8px] font-bold bg-emerald-600 text-white">
                            {t.camera.preprocessing?.afterLabel || 'Hasil'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Adjusted Parameters Summary Chips */}
                    <div className="flex-1 min-w-0 space-y-1 w-full">
                      <span className="text-[10px] text-zinc-400 block font-medium">
                        {t.camera.preprocessing?.changedParams || 'Parameter yang disesuaikan:'}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {imagePreprocessing.brightness !== 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200 font-mono">
                            ☀️ {imagePreprocessing.brightness > 0 ? `+${imagePreprocessing.brightness}` : imagePreprocessing.brightness}
                          </span>
                        )}
                        {imagePreprocessing.contrast !== 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200 font-mono">
                            🌓 {imagePreprocessing.contrast > 0 ? `+${imagePreprocessing.contrast}` : imagePreprocessing.contrast}
                          </span>
                        )}
                        {imagePreprocessing.saturation !== 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200 font-mono">
                            🎨 {imagePreprocessing.saturation > 0 ? `+${imagePreprocessing.saturation}` : imagePreprocessing.saturation}
                          </span>
                        )}
                        {imagePreprocessing.ambiance !== 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200 font-mono">
                            ✨ {imagePreprocessing.ambiance > 0 ? `+${imagePreprocessing.ambiance}` : imagePreprocessing.ambiance}
                          </span>
                        )}
                        {imagePreprocessing.highlights !== 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200 font-mono">
                            🔆 {imagePreprocessing.highlights > 0 ? `+${imagePreprocessing.highlights}` : imagePreprocessing.highlights}
                          </span>
                        )}
                        {imagePreprocessing.shadows !== 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200 font-mono">
                            👥 {imagePreprocessing.shadows > 0 ? `+${imagePreprocessing.shadows}` : imagePreprocessing.shadows}
                          </span>
                        )}
                        {imagePreprocessing.warmth !== 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200 font-mono">
                            🌡️ {imagePreprocessing.warmth > 0 ? `+${imagePreprocessing.warmth}` : imagePreprocessing.warmth}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Test Capture Action inside modal */}
                  {onTestCapture && (
                    <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">
                        Ambil foto langsung dari sensor kamera:
                      </span>
                      <button
                        type="button"
                        disabled={isTestingCapture}
                        onClick={async () => {
                          setIsTestingCapture(true);
                          try {
                            const snap = await onTestCapture();
                            setRealTestSnapshot(snap);
                          } catch (err) {
                            console.warn('Test capture in tools failed:', err);
                          } finally {
                            setIsTestingCapture(false);
                          }
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                      >
                        <span>{isTestingCapture ? '⏳' : '📸'}</span>
                        <span>{isTestingCapture ? 'Menjepret...' : (t.camera.preprocessing?.testCaptureBtn || 'Uji Jepret Kamera')}</span>
                      </button>
                    </div>
                  )}

                  {/* Real Test Snapshot Result Card */}
                  {realTestSnapshot && (
                    <div className="pt-2 border-t border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Hasil Jepretan Nyata Sensor Kamera:</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setRealTestSnapshot(null)}
                          className="text-[10px] text-zinc-400 hover:text-white px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 cursor-pointer"
                        >
                          ✕ Tutup
                        </button>
                      </div>
                      <div className="relative aspect-video max-h-48 w-full rounded-lg overflow-hidden bg-black border border-emerald-500 shadow-lg flex items-center justify-center">
                        <img
                          src={realTestSnapshot}
                          alt="Real Test Snapshot"
                          className="w-full h-full object-contain"
                        />
                        <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-600 text-white shadow-md">
                          OUTPUT KAMERA NYATA (TERPROSES)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 7 Adjustment Sliders in 2 Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* 1. Brightness */}
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                      <span>☀️</span>
                      <span>{t.camera.preprocessing?.brightness || 'Kecerahan'}</span>
                    </span>
                    <span className="font-mono text-[11px] text-zinc-400 font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      {imagePreprocessing.brightness > 0 ? `+${imagePreprocessing.brightness}` : imagePreprocessing.brightness}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={imagePreprocessing.brightness ?? 0}
                    onChange={(e) => onUpdatePreprocessing?.({ brightness: Number(e.target.value) })}
                    className="w-full accent-[var(--theme-accent,#E11D48)] cursor-pointer"
                  />
                </div>

                {/* 2. Contrast */}
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                      <span>🌓</span>
                      <span>{t.camera.preprocessing?.contrast || 'Kontras'}</span>
                    </span>
                    <span className="font-mono text-[11px] text-zinc-400 font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      {imagePreprocessing.contrast > 0 ? `+${imagePreprocessing.contrast}` : imagePreprocessing.contrast}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={imagePreprocessing.contrast ?? 0}
                    onChange={(e) => onUpdatePreprocessing?.({ contrast: Number(e.target.value) })}
                    className="w-full accent-[var(--theme-accent,#E11D48)] cursor-pointer"
                  />
                </div>

                {/* 3. Saturation */}
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                      <span>🎨</span>
                      <span>{t.camera.preprocessing?.saturation || 'Saturasi'}</span>
                    </span>
                    <span className="font-mono text-[11px] text-zinc-400 font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      {imagePreprocessing.saturation > 0 ? `+${imagePreprocessing.saturation}` : imagePreprocessing.saturation}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={imagePreprocessing.saturation ?? 0}
                    onChange={(e) => onUpdatePreprocessing?.({ saturation: Number(e.target.value) })}
                    className="w-full accent-[var(--theme-accent,#E11D48)] cursor-pointer"
                  />
                </div>

                {/* 4. Ambiance */}
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                      <span>✨</span>
                      <span>{t.camera.preprocessing?.ambiance || 'Ambiance'}</span>
                    </span>
                    <span className="font-mono text-[11px] text-zinc-400 font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      {imagePreprocessing.ambiance > 0 ? `+${imagePreprocessing.ambiance}` : imagePreprocessing.ambiance}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={imagePreprocessing.ambiance ?? 0}
                    onChange={(e) => onUpdatePreprocessing?.({ ambiance: Number(e.target.value) })}
                    className="w-full accent-[var(--theme-accent,#E11D48)] cursor-pointer"
                  />
                </div>

                {/* 5. Highlights */}
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                      <span>🔆</span>
                      <span>{t.camera.preprocessing?.highlights || 'Highlights'}</span>
                    </span>
                    <span className="font-mono text-[11px] text-zinc-400 font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      {imagePreprocessing.highlights > 0 ? `+${imagePreprocessing.highlights}` : imagePreprocessing.highlights}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={imagePreprocessing.highlights ?? 0}
                    onChange={(e) => onUpdatePreprocessing?.({ highlights: Number(e.target.value) })}
                    className="w-full accent-[var(--theme-accent,#E11D48)] cursor-pointer"
                  />
                </div>

                {/* 6. Shadows */}
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                      <span>👥</span>
                      <span>{t.camera.preprocessing?.shadows || 'Shadows'}</span>
                    </span>
                    <span className="font-mono text-[11px] text-zinc-400 font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      {imagePreprocessing.shadows > 0 ? `+${imagePreprocessing.shadows}` : imagePreprocessing.shadows}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={imagePreprocessing.shadows ?? 0}
                    onChange={(e) => onUpdatePreprocessing?.({ shadows: Number(e.target.value) })}
                    className="w-full accent-[var(--theme-accent,#E11D48)] cursor-pointer"
                  />
                </div>

                {/* 7. Warmth */}
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                      <span>🌡️</span>
                      <span>{t.camera.preprocessing?.warmth || 'Temperatur Warna (Warmth)'}</span>
                      <span className="text-[10px] text-zinc-500 font-normal">
                        ({imagePreprocessing.warmth < 0 ? 'Dingin' : imagePreprocessing.warmth > 0 ? 'Hangat' : 'Netral'})
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-zinc-400 font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      {imagePreprocessing.warmth > 0 ? `+${imagePreprocessing.warmth}` : imagePreprocessing.warmth}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={imagePreprocessing.warmth ?? 0}
                    onChange={(e) => onUpdatePreprocessing?.({ warmth: Number(e.target.value) })}
                    className="w-full accent-[var(--theme-accent,#E11D48)] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* DSLR Hardware Settings: Directly follows camera configuration */}
        {cameraSource === 'gphoto' && gphotoStatus.isConnected && (
          <div className="bg-zinc-900/95 rounded-xl p-3.5 border border-zinc-800 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📸</span>
                  <span>Konfigurasi Hardware DSLR (Ikuti Kamera)</span>
                </span>
                {gphotoStatus.batteryLevel && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-emerald-400 font-mono">
                    🔋 {gphotoStatus.batteryLevel}
                  </span>
                )}
              </div>

              {onRefreshConfig && (
                <button
                  type="button"
                  onClick={handleSyncFromCamera}
                  disabled={isSyncing}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 rounded-lg border border-zinc-700 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Ambil ulang pengaturan dari tombol fisik / dial kamera"
                >
                  <span className={isSyncing ? 'animate-spin' : ''}>🔄</span>
                  <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkron dari Kamera'}</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Pengaturan di bawah ini otomatis membaca dan mengikuti konfigurasi fisik pada body kamera Anda.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* ISO */}
              {isoField && (
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    ISO
                  </span>
                  {isoField.choices && isoField.choices.length > 0 && onSetConfigValue ? (
                    <select
                      value={String(isoField.value)}
                      onChange={(e) => onSetConfigValue(isoField.name, e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-[var(--theme-accent,#E11D48)] cursor-pointer"
                    >
                      {isoField.choices.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs font-mono font-bold text-white py-1">
                      {String(isoField.value)}
                    </div>
                  )}
                </div>
              )}

              {/* Shutter Speed */}
              {shutterField && (
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Shutter Speed
                  </span>
                  {shutterField.choices && shutterField.choices.length > 0 && onSetConfigValue ? (
                    <select
                      value={String(shutterField.value)}
                      onChange={(e) => onSetConfigValue(shutterField.name, e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-[var(--theme-accent,#E11D48)] cursor-pointer"
                    >
                      {shutterField.choices.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs font-mono font-bold text-white py-1">
                      {String(shutterField.value)}
                    </div>
                  )}
                </div>
              )}

              {/* Aperture */}
              {apertureField && (
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Aperture (f)
                  </span>
                  {apertureField.choices && apertureField.choices.length > 0 && onSetConfigValue ? (
                    <select
                      value={String(apertureField.value)}
                      onChange={(e) => onSetConfigValue(apertureField.name, e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-[var(--theme-accent,#E11D48)] cursor-pointer"
                    >
                      {apertureField.choices.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs font-mono font-bold text-white py-1">
                      {String(apertureField.value)}
                    </div>
                  )}
                </div>
              )}

              {/* White Balance */}
              {wbField && (
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    White Balance
                  </span>
                  {wbField.choices && wbField.choices.length > 0 && onSetConfigValue ? (
                    <select
                      value={String(wbField.value)}
                      onChange={(e) => onSetConfigValue(wbField.name, e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-[var(--theme-accent,#E11D48)] cursor-pointer"
                    >
                      {wbField.choices.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs font-mono font-bold text-white py-1">
                      {String(wbField.value)}
                    </div>
                  )}
                </div>
              )}

              {/* Capture Target (RAM vs Card) */}
              {captureTargetField && (
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Simpan Ke
                  </span>
                  {captureTargetField.choices && captureTargetField.choices.length > 0 && onSetConfigValue ? (
                    <select
                      value={String(captureTargetField.value)}
                      onChange={(e) => onSetConfigValue(captureTargetField.name, e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-[var(--theme-accent,#E11D48)] cursor-pointer"
                    >
                      {captureTargetField.choices.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs font-mono font-bold text-white py-1">
                      {String(captureTargetField.value)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Composition Guide Info */}
        {cropInfo.isCropped && (
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2.5">
            <span className="text-base leading-none">ℹ️</span>
            <div>
              <strong className="text-amber-300 block mb-0.5">{t.camera.compositionGuide}</strong>
              <p>
                Bingkai <strong>{activeFrameName}</strong> ({targetSlot.width}×{targetSlot.height}px). {cropInfo.label}
              </p>
            </div>
          </div>
        )}

        {/* Studio Simulator Pose Picker (only when simulator active) */}
        {cameraSource === 'simulator' && (
          <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800 space-y-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
              {t.camera.presetSimulator}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STUDIO_PORTRAITS.map((pose, idx) => (
                <button
                  key={pose.id}
                  type="button"
                  onClick={() => setActivePoseIdx(idx)}
                  className={`p-2 text-xs font-mono-tabular rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${activePoseIdx === idx
                    ? 'bg-white text-zinc-950 font-bold border-white shadow-md scale-102'
                    : 'bg-zinc-950/80 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                    }`}
                >
                  <img
                    src={pose.src}
                    alt={pose.label}
                    className="w-12 h-12 object-cover rounded-lg"
                  />
                  <span>Pose 0{idx + 1}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-white/10 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 text-xs sm:text-sm font-bold bg-[var(--theme-accent,#E11D48)] text-white rounded-xl shadow-lg cursor-pointer"
        >
          ✓ Selesai & Kembali ke Kamera
        </button>
      </div>
    </div>
  );
});
