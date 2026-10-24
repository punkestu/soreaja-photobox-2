import React, { memo } from 'react';
import { STUDIO_PORTRAITS } from '../../../data/defaultFrames';
import type { TranslationDictionary } from '../../../i18n/translations';
import type { CropInfo } from './CropGuideOverlay';

interface CameraToolsModalProps {
  showTools: boolean;
  onClose: () => void;
  cameraReady: boolean;
  targetSlot: { width: number; height: number };
  activeFrameName: string;
  useSimulator: boolean;
  setUseSimulator: (val: boolean) => void;
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
  useSimulator,
  setUseSimulator,
  showCropGuide,
  setShowCropGuide,
  showGridLines,
  setShowGridLines,
  cropInfo,
  activePoseIdx,
  setActivePoseIdx,
  t,
}) => {
  if (!showTools) return null;

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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUseSimulator(false)}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all border ${
                  !useSimulator
                    ? 'bg-[var(--theme-accent,#E11D48)] text-white border-[var(--theme-accent,#E11D48)]'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
              >
                📷 {t.camera.webRtc}
              </button>
              <button
                type="button"
                onClick={() => setUseSimulator(true)}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all border ${
                  useSimulator
                    ? 'bg-[var(--theme-accent,#E11D48)] text-white border-[var(--theme-accent,#E11D48)]'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
              >
                🖥️ {t.camera.sim}
              </button>
            </div>
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
        {useSimulator && (
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
