import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { usePhotobox } from '../../context/PhotoboxContext';
import { DEFAULT_FRAMES, STUDIO_PORTRAITS } from '../../data/defaultFrames';
import {
  compositeFinalLayoutBundle,
  checkStripRatio,
  type StripRatioInfo,
} from '../../services/canvasCompositor';
import { downloadSingleFile } from '../../services/downloadService';
import type { PhotoFilter } from '../../types/photobox';

const FILTERS: { id: PhotoFilter; label: string; desc: string }[] = [
  { id: 'original', label: 'Original Studio', desc: 'Warna asli tangkapan kamera' },
  { id: 'warm-sore', label: 'Warm Sore', desc: 'Tone keemasan hangat senja' },
  { id: 'noir-bw', label: 'Editorial B&W', desc: 'Monokrom kontras tinggi' },
  { id: 'vintage-film', label: 'Analog 35mm', desc: 'Tone klasik sepia lembut' },
];

export const FinalPreviewScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    selectedFrame,
    setSelectedFrame,
    capturedPhotos,
    setCapturedPhotos,
    finalLayoutBase64,
    setFinalLayoutBase64,
    doubleStripBase64,
    setDoubleStripBase64,
    selectedFilter,
    setSelectedFilter,
    customCaption,
    setCustomCaption,
    showFrameStamps,
    setShowFrameStamps,
    isHydrated,
    language,
    t,
  } = usePhotobox();

  const [isCompositing, setIsCompositing] = useState<boolean>(!finalLayoutBase64);
  const [previewMode, setPreviewMode] = useState<'single' | 'double'>('double');
  const [showCutLine, setShowCutLine] = useState<boolean>(true);
  const settings = useLiveQuery(() => db.settings.get('app_settings'), []);
  const activeFrame = selectedFrame || DEFAULT_FRAMES[0];

  const [ratioInfo, setRatioInfo] = useState<StripRatioInfo>(() => {
    const maxRight = Math.max(...activeFrame.positions.map((p) => p.x + p.width));
    const maxBottom = Math.max(...activeFrame.positions.map((p) => p.y + p.height));
    return checkStripRatio(
      activeFrame.canvasWidth || maxRight + 50,
      activeFrame.canvasHeight || maxBottom + 120
    );
  });

  // Ensure fallback photos only after hydration if opened directly without photos
  useEffect(() => {
    if (!isHydrated) return;

    if (!selectedFrame) {
      setSelectedFrame(DEFAULT_FRAMES[0]);
    }
    if (capturedPhotos.length === 0) {
      const count = (selectedFrame || DEFAULT_FRAMES[0]).photoCount;
      setCapturedPhotos(
        Array.from({ length: count }).map(
          (_, i) => STUDIO_PORTRAITS[i % STUDIO_PORTRAITS.length].src
        )
      );
    }
  }, [capturedPhotos.length, isHydrated, selectedFrame, setCapturedPhotos, setSelectedFrame]);

  // Gabungkan capturedPhotos + selectedFrame.frameImg menggunakan HTML Canvas
  // Otomatis cek rasio W/H strip: Jika vertical long strip, buat juga 2-strip side-by-side
  useEffect(() => {
    if (!isHydrated || capturedPhotos.length === 0) return;
    let active = true;
    setIsCompositing(true);

    compositeFinalLayoutBundle(
      capturedPhotos,
      activeFrame,
      selectedFilter,
      customCaption,
      showFrameStamps,
      settings?.themeColor,
      { includeCutLine: showCutLine }
    ).then((bundle) => {
      if (active) {
        setFinalLayoutBase64(bundle.singleStrip);
        setDoubleStripBase64(bundle.doubleStrip);
        setRatioInfo(bundle.ratioInfo);
        setIsCompositing(false);
      }
    });

    return () => {
      active = false;
    };
  }, [
    activeFrame,
    capturedPhotos,
    customCaption,
    isHydrated,
    selectedFilter,
    setDoubleStripBase64,
    setFinalLayoutBase64,
    settings?.themeColor,
    showCutLine,
    showFrameStamps,
  ]);

  const isVertical = ratioInfo.isVerticalLongStrip;
  const activeDisplayImage =
    isVertical && previewMode === 'double' && doubleStripBase64
      ? doubleStripBase64
      : finalLayoutBase64;

  const handleDownloadActive = () => {
    if (!activeDisplayImage) return;
    const isDouble = isVertical && previewMode === 'double';
    const filename = `PB_${Date.now()}_${isDouble ? 'side_by_side_2strip_cutline' : 'strip_single'}.png`;
    downloadSingleFile(activeDisplayImage, filename);
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 space-y-6 md:space-y-8 select-none">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="text-xs sm:text-sm font-mono-tabular text-zinc-400 flex items-center gap-2 mb-1.5">
            <span className="text-[var(--theme-accent,#E11D48)] font-bold">{t.preview.stageBadge}</span>
            <span aria-hidden="true">·</span>
            <span>🎨 Layout Frame</span>
            <span aria-hidden="true">·</span>
            <span>🖼️ {activeFrame.name}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#F4F4F0]">
            {t.preview.title}
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-zinc-400 mt-1">
            {t.preview.subtitle}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 sm:gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/app/review-photos')}
            className="min-h-[46px] sm:min-h-[50px] px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold text-zinc-200 bg-zinc-900/90 hover:bg-zinc-800 active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer border border-zinc-800 shadow-sm flex items-center gap-1.5"
            title={t.nav.retake}
          >
            <span>↺</span>
            <span>{t.nav.retake}</span>
          </button>

          <button
            type="button"
            disabled={!activeDisplayImage}
            onClick={handleDownloadActive}
            className="min-h-[46px] sm:min-h-[50px] px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold text-zinc-200 bg-zinc-900/90 hover:bg-zinc-800 active:scale-95 disabled:opacity-50 rounded-xl transition-all whitespace-nowrap cursor-pointer border border-zinc-800 shadow-sm flex items-center gap-1.5"
            title={t.preview.download}
          >
            <span>📥</span>
            <span>{t.preview.download}</span>
          </button>

          <button
            type="button"
            disabled={isCompositing || !finalLayoutBase64}
            onClick={() => navigate('/app/print-result')}
            className="min-h-[46px] sm:min-h-[50px] px-6 sm:px-7 py-2.5 text-xs sm:text-sm md:text-base font-extrabold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 disabled:opacity-50 rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-lg flex items-center gap-2"
          >
            <span>{t.preview.continueToPrint}</span>
            <span>🖨️</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start">
        {/* Final Composite Preview - Tablet 7 Cols */}
        <div className="md:col-span-7 bg-zinc-900/80 rounded-2xl p-5 sm:p-6 flex flex-col items-center justify-center min-h-[480px] shadow-2xl space-y-4 border border-zinc-800/70">
          {/* Ratio detection & layout tabs if it is vertical long strip */}
          {isVertical && (
            <div className="w-full space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-950/70 p-2 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-1.5 p-1 bg-zinc-900 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('single')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      previewMode === 'single'
                        ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    📱 {t.preview.singleStrip}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('double')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      previewMode === 'double'
                        ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>👥 {t.preview.doubleStrip}</span>
                    <span className="text-[10px] px-1 py-0.2 bg-white/20 text-white rounded font-mono">
                      4R
                    </span>
                  </button>
                </div>

                {previewMode === 'double' && (
                  <label className="flex items-center gap-1.5 text-xs text-zinc-300 pr-2 cursor-pointer select-none bg-zinc-900/90 px-2.5 py-1.5 rounded-lg border border-zinc-800">
                    <input
                      type="checkbox"
                      checked={showCutLine}
                      onChange={(e) => setShowCutLine(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[var(--theme-accent,#E11D48)] rounded cursor-pointer"
                    />
                    <span className="font-semibold text-zinc-200">✂️ {t.preview.cutLine}</span>
                  </label>
                )}
              </div>
            </div>
          )}

          {isCompositing || !finalLayoutBase64 ? (
            <div className="text-center space-y-3 py-16">
              <p className="text-sm font-mono-tabular text-zinc-300">
                {t.preview.rendering}
              </p>
              <p className="text-xs text-zinc-500">
                {t.preview.combining}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 w-full">
              <img
                data-testid="final-composite-image"
                src={activeDisplayImage || finalLayoutBase64}
                alt={`Hasil Akhir Bingkai ${activeFrame.name}`}
                className="max-h-[580px] w-auto object-contain rounded-xl shadow-2xl"
              />
              <div className="flex items-center justify-between w-full px-2 text-[11px] font-mono-tabular text-zinc-400">
                <span>
                  {isVertical && previewMode === 'double'
                    ? `${t.preview.formatDouble} (${activeFrame.canvasWidth ? activeFrame.canvasWidth * 2 : 960}×${activeFrame.canvasHeight || 1440}px)`
                    : `${t.preview.formatSingle} (${activeFrame.canvasWidth || 480}×${activeFrame.canvasHeight || 1440}px)`}
                </span>
                <button
                  type="button"
                  onClick={handleDownloadActive}
                  className="text-zinc-300 hover:text-white flex items-center gap-1 underline cursor-pointer"
                >
                  <span>📥 {t.preview.downloadPng}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tone Filter & Caption Controls - Tablet 5 Cols */}
        <div className="md:col-span-5 bg-zinc-900/80 rounded-2xl p-5 sm:p-6 space-y-5 sm:space-y-6 shadow-xl border border-zinc-800/70">
          <div className="space-y-3">
            <h2 className="font-display text-base sm:text-lg font-bold text-[#F4F4F0] flex items-center gap-2">
              <span>🎨</span>
              <span>{t.preview.colorFiltersTitle}</span>
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              {t.preview.colorFiltersSubtitle}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {[
                { id: 'original' as const, label: t.preview.filters.original, desc: t.preview.filters.originalDesc },
                { id: 'warm-sore' as const, label: t.preview.filters.warmSore, desc: t.preview.filters.warmSoreDesc },
                { id: 'noir-bw' as const, label: t.preview.filters.noirBw, desc: t.preview.filters.noirBwDesc },
                { id: 'vintage-film' as const, label: t.preview.filters.vintageFilm, desc: t.preview.filters.vintageFilmDesc },
              ].map((f) => {
                const isActive = selectedFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFilter(f.id)}
                    className={`min-h-[52px] p-3.5 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer ${
                      isActive
                        ? 'bg-[var(--theme-accent,#E11D48)]/15 ring-2 ring-[var(--theme-accent,#E11D48)] text-white shadow-md'
                        : 'bg-zinc-950/80 text-zinc-300 hover:bg-zinc-800 border border-zinc-800/60'
                    }`}
                  >
                    <p className="text-xs sm:text-sm font-bold">{f.label}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{f.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stempel Teks Bingkai Toggle & Caption */}
          <div className="pt-2 space-y-3 border-t border-zinc-800/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
                  <span>🏷️</span>
                  <span>{t.preview.frameStampsTitle}</span>
                </p>
                <p className="text-[11px] text-zinc-400">
                  {t.preview.frameStampsSubtitle}
                </p>
              </div>
              <label className="min-h-[44px] flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showFrameStamps}
                  onChange={(e) => setShowFrameStamps(e.target.checked)}
                  className="w-4 h-4 accent-[var(--theme-accent,#E11D48)] rounded cursor-pointer"
                />
                <span className="text-xs sm:text-sm font-mono-tabular text-zinc-300">
                  {showFrameStamps ? t.preview.showStamp : t.preview.hideStamp}
                </span>
              </label>
            </div>

            {showFrameStamps ? (
              <div className="space-y-1.5 pt-1">
                <label
                  htmlFor="captionInput"
                  className="block text-xs sm:text-sm font-semibold text-zinc-300"
                >
                  ✍️ {t.preview.bottomCaptionLabel}
                </label>
                <input
                  id="captionInput"
                  type="text"
                  maxLength={32}
                  value={customCaption}
                  onChange={(e) => setCustomCaption(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm sm:text-base bg-zinc-950 rounded-xl text-white focus:outline-none ring-1 ring-zinc-700 focus:ring-[var(--theme-accent,#E11D48)] font-mono-tabular"
                />
              </div>
            ) : (
              <p className="text-[11px] text-zinc-400 bg-zinc-950/90 p-3 rounded-xl">
                {t.preview.cleanModeNotice}
              </p>
            )}
          </div>

          <div className="pt-2 space-y-3">
            <button
              type="button"
              disabled={isCompositing || !finalLayoutBase64}
              onClick={() => navigate('/app/print-result')}
              className="w-full min-h-[52px] sm:min-h-[56px] py-3.5 px-6 text-sm sm:text-base font-extrabold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 disabled:opacity-50 rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-lg flex items-center justify-center gap-2"
            >
              <span>{t.preview.continueToPrint}</span>
              <span>🖨️</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/app/review-photos')}
              className="w-full min-h-[46px] py-2.5 px-4 text-xs sm:text-sm font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
            >
              <span>↺</span>
              <span>{t.nav.retake}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
