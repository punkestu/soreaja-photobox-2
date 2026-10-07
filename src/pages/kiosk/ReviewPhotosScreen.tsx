import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhotobox } from '../../context/PhotoboxContext';
import { DEFAULT_FRAMES, STUDIO_PORTRAITS } from '../../data/defaultFrames';

export const ReviewPhotosScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    selectedFrame,
    setSelectedFrame,
    capturedPhotos,
    setCapturedPhotos,
    setRetakeIndex,
    isHydrated,
  } = usePhotobox();

  const [viewMode, setViewMode] = useState<'cropped' | 'full'>('cropped');
  const activeFrame = selectedFrame || DEFAULT_FRAMES[0];

  // Ensure valid fallback photos only after hydration if user navigated directly without photos
  useEffect(() => {
    if (!isHydrated) return;

    if (!selectedFrame) {
      setSelectedFrame(DEFAULT_FRAMES[0]);
    }
    if (capturedPhotos.length === 0) {
      const count = (selectedFrame || DEFAULT_FRAMES[0]).photoCount;
      const seeded = Array.from({ length: count }).map(
        (_, i) => STUDIO_PORTRAITS[i % STUDIO_PORTRAITS.length].src
      );
      setCapturedPhotos(seeded);
    }
  }, [capturedPhotos.length, isHydrated, selectedFrame, setCapturedPhotos, setSelectedFrame]);

  // Sesuai TSD 4.2.4: Klik foto -> Set retakeIndex ke index foto tersebut -> Kembali ke /app/camera
  const handleRetakeSinglePhoto = (index: number) => {
    setRetakeIndex(index);
    navigate('/app/camera');
  };

  const handleFinishReview = () => {
    setRetakeIndex(null);
    navigate('/app/preview-final');
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 md:px-10 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4">
        <div>
          <div className="text-xs font-mono-tabular text-zinc-400 flex items-center gap-2 mb-2">
            <span>Tahap 04 dari 06</span>
            <span aria-hidden="true">·</span>
            <span>Evaluasi Pose Individual</span>
            <span aria-hidden="true">·</span>
            <span>{capturedPhotos.length} Foto Siap</span>
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-bold text-[#F4F4F0]">
            Periksa Hasil Foto Individual
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Klik pada salah satu foto di bawah ini jika ingin mengulang pose tersebut,
            atau klik <strong className="text-white">Selesai</strong> untuk menggabungkan
            ke dalam bingkai.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setRetakeIndex(null);
              navigate('/app/camera');
            }}
            className="px-4 py-2.5 text-xs font-medium text-zinc-300 bg-zinc-900/80 hover:bg-zinc-800 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
          >
            Ulangi Semua Foto
          </button>

          <button
            type="button"
            onClick={handleFinishReview}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-lg"
          >
            Selesai & Gabungkan Frame →
          </button>
        </div>
      </div>

      {/* View Mode Toggle Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900/80 border border-zinc-800 rounded-xl px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-medium mr-1">Mode Tampilan:</span>
          <button
            type="button"
            onClick={() => setViewMode('cropped')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'cropped'
                ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-sm'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            <span>📐 Sesuai Potongan Bingkai ({activeFrame.name})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('full')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'full'
                ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-sm'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            <span>📷 Foto Kamera Utuh + Garis Batas Crop</span>
          </button>
        </div>
        <p className="text-xs text-zinc-400 font-mono-tabular">
          {viewMode === 'cropped'
            ? 'Menampilkan hasil potong presisi untuk cetak'
            : 'Menampilkan foto asli dengan batas crop'}
        </p>
      </div>

      {/* Grid of Captured Photos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {capturedPhotos.map((photoSrc, index) => {
          const slot =
            activeFrame.positions[index] ||
            activeFrame.positions[0] || { width: 400, height: 300 };
          const cameraAspect = 4 / 3;
          const slotAspect = slot.width / slot.height;
          const isNarrower = slotAspect < cameraAspect - 0.015;
          const isWider = slotAspect > cameraAspect + 0.015;
          const sideCropPercent = isNarrower
            ? Math.max(0, (100 - (slotAspect / cameraAspect) * 100) / 2)
            : 0;
          const topCropPercent = isWider
            ? Math.max(0, (100 - (cameraAspect / slotAspect) * 100) / 2)
            : 0;

          return (
            <div
              key={index}
              className="bg-zinc-900/80 hover:bg-zinc-900 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all shadow-xl"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono-tabular text-zinc-400">
                  <span className="font-bold text-white">POSE #0{index + 1}</span>
                  <span className="text-[var(--theme-accent,#E11D48)] font-semibold">
                    Slot #{index + 1} ({slot.width}×{slot.height}px)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRetakeSinglePhoto(index)}
                  aria-label={`Retake Foto Nomor ${index + 1}`}
                  style={
                    viewMode === 'cropped'
                      ? { aspectRatio: `${slot.width} / ${slot.height}` }
                      : undefined
                  }
                  className={`w-full bg-zinc-950 rounded-xl overflow-hidden relative group cursor-pointer block ${
                    viewMode === 'full' ? 'aspect-[4/3]' : ''
                  }`}
                >
                  <img
                    src={photoSrc}
                    alt={`Hasil tangkapan pose ${index + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                  />

                  {/* If Full View Mode: Show Crop Guide Mask Overlay */}
                  {viewMode === 'full' && (isNarrower || isWider) && (
                    <div className="absolute inset-0 pointer-events-none">
                      {isNarrower && (
                        <>
                          <div
                            className="absolute top-0 bottom-0 left-0 bg-black/65 border-r border-dashed border-red-400 flex items-center justify-center"
                            style={{ width: `${sideCropPercent}%` }}
                          >
                            <span className="rotate-[-90deg] text-[9px] text-red-300 font-mono font-bold uppercase">
                              ✂ Potong
                            </span>
                          </div>
                          <div
                            className="absolute top-0 bottom-0 right-0 bg-black/65 border-l border-dashed border-red-400 flex items-center justify-center"
                            style={{ width: `${sideCropPercent}%` }}
                          >
                            <span className="rotate-90 text-[9px] text-red-300 font-mono font-bold uppercase">
                              ✂ Potong
                            </span>
                          </div>
                        </>
                      )}
                      {isWider && (
                        <>
                          <div
                            className="absolute top-0 left-0 right-0 bg-black/65 border-b border-dashed border-red-400 flex items-center justify-center"
                            style={{ height: `${topCropPercent}%` }}
                          >
                            <span className="text-[9px] text-red-300 font-mono font-bold uppercase">
                              ✂ Area Terpotong
                            </span>
                          </div>
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-black/65 border-t border-dashed border-red-400 flex items-center justify-center"
                            style={{ height: `${topCropPercent}%` }}
                          >
                            <span className="text-[9px] text-red-300 font-mono font-bold uppercase">
                              ✂ Area Terpotong
                            </span>
                          </div>
                        </>
                      )}
                      {/* Active Box Outline */}
                      <div
                        className="absolute border-2 border-[var(--theme-accent,#E11D48)]"
                        style={{
                          left: `${sideCropPercent}%`,
                          right: `${sideCropPercent}%`,
                          top: `${topCropPercent}%`,
                          bottom: `${topCropPercent}%`,
                        }}
                      />
                    </div>
                  )}

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 z-10">
                    <span className="px-4 py-2 bg-white text-zinc-950 text-xs font-semibold rounded-lg shadow-lg">
                      Klik untuk Retake Foto #{index + 1}
                    </span>
                  </div>
                </button>

                <div className="text-[11px] font-mono-tabular text-zinc-400 flex items-center justify-between">
                  <span>Rasio: {slotAspect.toFixed(2)}:1</span>
                  <span>{viewMode === 'cropped' ? 'Pratinjau Crop Bingkai' : 'Kamera Asli (4:3)'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRetakeSinglePhoto(index)}
                className="w-full py-2.5 px-4 text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                Ulangi Foto #{index + 1}
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-zinc-900/80 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#F4F4F0]">
            Sudah puas dengan semua ekspresi dan pose?
          </p>
          <p className="text-xs text-zinc-400">
            Tahap berikutnya akan menggabungkan {capturedPhotos.length} foto di atas
            dengan bingkai <strong className="text-zinc-200">{activeFrame.name}</strong>{' '}
            menggunakan HTML5 Canvas.
          </p>
        </div>

        <button
          type="button"
          onClick={handleFinishReview}
          className="px-8 py-3.5 text-sm font-semibold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-lg"
        >
          Selesai
        </button>
      </div>
    </div>
  );
};
