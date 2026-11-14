import React, { memo, useState } from 'react';
import { STUDIO_PORTRAITS } from '../../../data/defaultFrames';
import type { TranslationDictionary } from '../../../i18n/translations';
import type { CropInfo } from './CropGuideOverlay';
import type { GPhotoStatus } from '../../../services/gphotoService';

interface CameraToolsModalProps {
  showTools: boolean;
  onClose: () => void;
  cameraReady: boolean;
  targetSlot: { width: number; height: number };
  activeFrameName: string;
  cameraSource: 'webrtc' | 'gphoto' | 'simulator';
  setCameraSource: (val: 'webrtc' | 'gphoto' | 'simulator') => void;
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
}

export const CameraToolsModal: React.FC<CameraToolsModalProps> = memo(({
  showTools,
  onClose,
  cameraReady,
  targetSlot,
  activeFrameName,
  cameraSource,
  setCameraSource,
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
}) => {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

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
                onClick={() => setCameraSource('webrtc')}
                className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-all border ${
                  cameraSource === 'webrtc'
                    ? 'bg-[var(--theme-accent,#E11D48)] text-white border-[var(--theme-accent,#E11D48)]'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
              >
                📷 {t.camera.webRtc}
              </button>
              <button
                type="button"
                onClick={() => setCameraSource('gphoto')}
                className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-all border ${
                  cameraSource === 'gphoto'
                    ? 'bg-[var(--theme-accent,#E11D48)] text-white border-[var(--theme-accent,#E11D48)]'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
              >
                📸 {t.camera.dslr}
              </button>
              <button
                type="button"
                onClick={() => setCameraSource('simulator')}
                className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-all border ${
                  cameraSource === 'simulator'
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
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        gphotoStatus.isConnected
                          ? 'bg-emerald-400 animate-pulse'
                          : gphotoStatus.isConnecting
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-zinc-500'
                      }`}
                    />
                    <span
                      className={`truncate ${
                        gphotoStatus.isConnected ? 'text-emerald-400' : 'text-zinc-400'
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
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all border ${
                  showCropGuide
                    ? 'bg-[var(--theme-accent,#E11D48)] text-white border-[var(--theme-accent,#E11D48)]'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
              >
                📐 {t.camera.cropToggle}
              </button>
              <button
                type="button"
                onClick={() => setShowGridLines((prev) => !prev)}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all border ${
                  showGridLines
                    ? 'bg-zinc-700 text-white border-zinc-600'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
              >
                ⊞ {t.camera.gridToggle}
              </button>
            </div>
          </div>
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
                  className={`p-2 text-xs font-mono-tabular rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    activePoseIdx === idx
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
