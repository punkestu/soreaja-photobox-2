import React, { useEffect } from 'react';
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
            className="px-6 py-2.5 text-sm font-semibold text-white bg-[#E11D48] hover:bg-[#BE123C] rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-lg"
          >
            Selesai & Gabungkan Frame →
          </button>
        </div>
      </div>

      {/* Grid of Captured Photos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {capturedPhotos.map((photoSrc, index) => (
          <div
            key={index}
            className="bg-zinc-900/80 hover:bg-zinc-900 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all shadow-xl"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono-tabular text-zinc-400">
                <span>POSE #0{index + 1}</span>
                <span>Slot Koordinat #{index + 1}</span>
              </div>

              <button
                type="button"
                onClick={() => handleRetakeSinglePhoto(index)}
                aria-label={`Retake Foto Nomor ${index + 1}`}
                className="w-full aspect-[4/3] bg-zinc-950 rounded-xl overflow-hidden relative group cursor-pointer block"
              >
                <img
                  src={photoSrc}
                  alt={`Hasil tangkapan pose ${index + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
                  <span className="px-4 py-2 bg-white text-zinc-950 text-xs font-semibold rounded-lg shadow-lg">
                    Klik untuk Retake Foto #{index + 1}
                  </span>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleRetakeSinglePhoto(index)}
              className="w-full py-2.5 px-4 text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              Ulangi Foto #{index + 1}
            </button>
          </div>
        ))}
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
          className="px-8 py-3.5 text-sm font-semibold text-white bg-[#E11D48] hover:bg-[#BE123C] rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-lg"
        >
          Selesai
        </button>
      </div>
    </div>
  );
};
