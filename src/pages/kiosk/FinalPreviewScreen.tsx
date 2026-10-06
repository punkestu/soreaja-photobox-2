import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhotobox } from '../../context/PhotoboxContext';
import { DEFAULT_FRAMES, STUDIO_PORTRAITS } from '../../data/defaultFrames';
import { compositeFinalLayout } from '../../services/canvasCompositor';
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
    selectedFilter,
    setSelectedFilter,
    customCaption,
    setCustomCaption,
    isHydrated,
  } = usePhotobox();

  const [isCompositing, setIsCompositing] = useState<boolean>(!finalLayoutBase64);
  const activeFrame = selectedFrame || DEFAULT_FRAMES[0];

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

  // Sesuai TSD 4.2.5: Gabungkan capturedPhotos + selectedFrame.frameImg menggunakan HTML Canvas
  useEffect(() => {
    if (!isHydrated || capturedPhotos.length === 0) return;
    let active = true;
    setIsCompositing(true);

    compositeFinalLayout(
      capturedPhotos,
      activeFrame,
      selectedFilter,
      customCaption
    ).then((base64) => {
      if (active) {
        setFinalLayoutBase64(base64);
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
    setFinalLayoutBase64,
  ]);

  return (
    <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
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
            className="px-5 py-2.5 text-xs font-semibold text-zinc-200 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            ← Retake
          </button>

          <button
            type="button"
            disabled={isCompositing || !finalLayoutBase64}
            onClick={() => navigate('/app/print-result')}
            className="px-7 py-2.5 text-sm font-semibold text-white bg-[#E11D48] hover:bg-[#BE123C] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Lanjut →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Final Composite Preview */}
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center min-h-[540px]">
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
            <img
              data-testid="final-composite-image"
              src={finalLayoutBase64}
              alt={`Hasil Akhir Bingkai ${activeFrame.name}`}
              className="max-h-[600px] w-auto object-contain rounded shadow-2xl border border-zinc-800"
            />
          )}
        </div>

        {/* Tone Filter & Caption Controls */}
        <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
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
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-zinc-800 border-[#E11D48] text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <p className="text-xs font-semibold">{f.label}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{f.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-zinc-800">
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
              className="w-full px-3.5 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600 font-mono-tabular"
            />
          </div>

          <div className="pt-4 border-t border-zinc-800 space-y-3">
            <button
              type="button"
              disabled={isCompositing || !finalLayoutBase64}
              onClick={() => navigate('/app/print-result')}
              className="w-full py-3.5 px-5 text-sm font-semibold text-white bg-[#E11D48] hover:bg-[#BE123C] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Lanjut ke Cetak & QR Code →
            </button>

            <button
              type="button"
              onClick={() => navigate('/app/review-photos')}
              className="w-full py-2.5 px-4 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Retake (Kembali ke Evaluasi Foto)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
