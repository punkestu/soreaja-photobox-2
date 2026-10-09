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

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 md:px-10 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4">
        <div>
          <div className="text-xs font-mono-tabular text-zinc-400 flex items-center gap-2 mb-2">
            <span>Tahap 05 dari 06</span>
            <span aria-hidden="true">·</span>
            <span>HTML5 Canvas Compositor</span>
            <span aria-hidden="true">·</span>
            <span>Bingkai: {activeFrame.name}</span>
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-bold text-[#F4F4F0]">
            Pratinjau Layout Akhir Berbingkai
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Periksa penggabungan foto dengan bingkai studio dan pilih tone warna sebelum
            mencetak.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/review-photos')}
            className="px-5 py-2.5 text-xs font-semibold text-zinc-200 bg-zinc-900/80 hover:bg-zinc-800 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
          >
            ← Retake
          </button>

          <button
            type="button"
            disabled={isCompositing || !finalLayoutBase64}
            onClick={() => navigate('/app/print-result')}
            className="px-7 py-2.5 text-sm font-semibold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-lg"
          >
            Lanjut →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Final Composite Preview */}
        <div className="lg:col-span-7 bg-zinc-900/80 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[540px] shadow-2xl space-y-4">
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
                    📱 Strip Tunggal (1x)
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
                    <span>👥 2-Strip Berdampingan (Side-by-Side)</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-white/20 text-white rounded font-mono">
                      4R
                    </span>
                  </button>
                </div>

                {previewMode === 'double' && (
                  <label className="flex items-center gap-1.5 text-xs text-zinc-300 pr-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showCutLine}
                      onChange={(e) => setShowCutLine(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[var(--theme-accent,#E11D48)] rounded cursor-pointer"
                    />
                    <span>✂️ Garis Potong Tengah</span>
                  </label>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono-tabular text-emerald-400/90 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-lg">
                <span>📐</span>
                <span>
                  <strong>Rasio Strip Vertikal ({ratioInfo.ratioFormatted}):</strong> Otomatis digandakan 2 strip berdampingan untuk cetak kertas 4R (4×6").
                </span>
              </div>
            </div>
          )}

          {isCompositing || !finalLayoutBase64 ? (
            <div className="text-center space-y-3 py-16">
              <p className="text-sm font-mono-tabular text-zinc-300">
                Merender komposisi HTML5 Canvas...
              </p>
              <p className="text-xs text-zinc-500">
                Menggabungkan {capturedPhotos.length} foto dengan {activeFrame.frameImg}
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
              <p className="text-[11px] font-mono-tabular text-zinc-400 text-center">
                {isVertical && previewMode === 'double'
                  ? `Format Cetak: 2-Strip Side-by-Side (${activeFrame.canvasWidth ? activeFrame.canvasWidth * 2 : 960}×${activeFrame.canvasHeight || 1440}px) · Standar 4R`
                  : `Format Cetak: Strip Tunggal (${activeFrame.canvasWidth || 480}×${activeFrame.canvasHeight || 1440}px)`}
              </p>
            </div>
          )}
        </div>

        {/* Tone Filter & Caption Controls */}
        <div className="lg:col-span-5 bg-zinc-900/80 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[#F4F4F0]">
              Tone Warna Studio (Filter Kanvas)
            </h2>
            <p className="text-xs text-zinc-400">
              Pilih karakter warna untuk diterapkan secara langsung pada hasil cetakan.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {FILTERS.map((f) => {
                const isActive = selectedFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFilter(f.id)}
                    className={`p-3.5 rounded-xl text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[var(--theme-accent,#E11D48)]/15 ring-2 ring-[var(--theme-accent,#E11D48)] text-white'
                        : 'bg-zinc-950/80 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <p className="text-xs font-semibold">{f.label}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{f.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stempel Teks Bingkai Toggle & Caption */}
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-200">
                  Stempel Teks Bingkai
                </p>
                <p className="text-[11px] text-zinc-400">
                  Header identitas studio & stempel bawah
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFrameStamps}
                  onChange={(e) => setShowFrameStamps(e.target.checked)}
                  className="w-4 h-4 accent-[var(--theme-accent,#E11D48)] rounded cursor-pointer"
                />
                <span className="text-xs font-mono-tabular text-zinc-300">
                  {showFrameStamps ? 'Tampil' : 'Sembunyi'}
                </span>
              </label>
            </div>

            {showFrameStamps ? (
              <div className="space-y-1.5 pt-1">
                <label
                  htmlFor="captionInput"
                  className="block text-xs font-semibold text-zinc-300"
                >
                  Teks Stempel Bawah Bingkai
                </label>
                <input
                  id="captionInput"
                  type="text"
                  maxLength={32}
                  value={customCaption}
                  onChange={(e) => setCustomCaption(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-zinc-950 rounded-xl text-white focus:outline-none ring-1 ring-zinc-700 focus:ring-[var(--theme-accent,#E11D48)] font-mono-tabular"
                />
              </div>
            ) : (
              <p className="text-[11px] text-zinc-400 bg-zinc-950/90 p-3 rounded-xl">
                Mode bersih aktif: Tidak ada stempel teks yang dicetak di atas bingkai (cocok untuk custom frame).
              </p>
            )}
          </div>

          <div className="pt-4 space-y-3">
            <button
              type="button"
              disabled={isCompositing || !finalLayoutBase64}
              onClick={() => navigate('/app/print-result')}
              className="w-full py-4 px-5 text-sm font-semibold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-lg"
            >
              Lanjut ke Cetak & QR Code →
            </button>

            <button
              type="button"
              onClick={() => navigate('/app/review-photos')}
              className="w-full py-3 px-4 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              Retake (Kembali ke Evaluasi Foto)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
