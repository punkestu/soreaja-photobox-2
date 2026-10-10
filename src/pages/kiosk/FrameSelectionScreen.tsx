import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFramesMetadata } from '../../data/defaultFrames';
import { usePhotobox } from '../../context/PhotoboxContext';
import type { FrameMetadata } from '../../types/photobox';

export const FrameSelectionScreen: React.FC = () => {
  const navigate = useNavigate();
  const { selectedFrame, setSelectedFrame, setCapturedPhotos, setRetakeIndex } =
    usePhotobox();
  const [frames, setFrames] = useState<FrameMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFramesMetadata().then((data) => {
      setFrames(data);
      setLoading(false);
    });
  }, []);

  const handleSelectFrame = (frame: FrameMetadata) => {
    setSelectedFrame(frame);
    setCapturedPhotos([]);
    setRetakeIndex(null);
    navigate('/app/camera');
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 space-y-6 md:space-y-8 select-none">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 sm:pb-4 border-b border-white/5">
        <div>
          <div className="text-xs sm:text-sm font-mono-tabular text-zinc-400 flex items-center gap-2 mb-1.5">
            <span className="text-[var(--theme-accent,#E11D48)] font-bold">Tahap 02/06</span>
            <span aria-hidden="true">·</span>
            <span>Pilih Bingkai</span>
            <span aria-hidden="true">·</span>
            <span>{frames.length} Opsi Tersedia</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#F4F4F0]">
            Pilih Layout Bingkai Studio
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-zinc-400 mt-1">
            Sentuh bingkai pilihanmu untuk melanjutkan ke sesi pemotretan kamera.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/app/idle')}
          className="min-h-[48px] px-5 py-2.5 text-xs sm:text-sm font-semibold text-zinc-300 bg-zinc-900/90 active:scale-95 hover:bg-zinc-800 rounded-xl transition-all whitespace-nowrap self-start sm:self-auto cursor-pointer border border-zinc-800 shadow-sm flex items-center gap-2"
        >
          <span>←</span>
          <span>Kembali ke Layar Mulai</span>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 md:gap-7">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-[420px] sm:h-[480px] bg-zinc-900/60 rounded-2xl animate-pulse p-4 sm:p-5 border border-zinc-800/40"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 md:gap-7">
          {frames.map((frame) => {
            const isSelected = selectedFrame?.id === frame.id;
            const primarySlot = frame.positions?.[0];
            return (
              <div
                key={frame.id}
                onClick={() => handleSelectFrame(frame)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleSelectFrame(frame);
                }}
                className={`bg-zinc-900/80 hover:bg-zinc-900 active:scale-[0.98] rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 sm:gap-5 transition-all cursor-pointer border select-none ${
                  isSelected
                    ? 'ring-2 ring-[var(--theme-accent,#E11D48)] border-transparent bg-zinc-900 shadow-[0_0_30px_rgba(225,29,72,0.3)]'
                    : 'border-zinc-800/80 hover:border-zinc-700 hover:shadow-2xl'
                }`}
              >
                <div className="space-y-3 sm:space-y-4">
                  {/* Visual Preview Container */}
                  <div className="aspect-[3/4] bg-zinc-950 rounded-xl p-3 sm:p-4 flex items-center justify-center overflow-hidden border border-zinc-800/60 shadow-inner">
                    <img
                      src={frame.previewImg}
                      alt={`Pratinjau bingkai ${frame.name}`}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="max-h-full max-w-full object-contain rounded shadow-lg"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] sm:text-xs font-mono-tabular text-zinc-400 flex items-center justify-between">
                      <span className="font-bold text-white bg-zinc-800/80 px-2 py-0.5 rounded-md">
                        {frame.photoCount} Pose
                      </span>
                      <span>
                        {frame.canvasWidth || 500}×{frame.canvasHeight || 1220}px
                      </span>
                    </div>
                    <h2 className="font-display text-base sm:text-lg font-bold text-[#F4F4F0] line-clamp-1">
                      {frame.name}
                    </h2>
                    {frame.subtitle && (
                      <p className="text-[11px] sm:text-xs text-zinc-400 line-clamp-1">{frame.subtitle}</p>
                    )}
                    {primarySlot && (
                      <p className="text-[10px] sm:text-[11px] font-mono-tabular text-zinc-400 flex items-center gap-1.5 pt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-accent,#E11D48)]" />
                        <span>
                          Slot: {primarySlot.width}×{primarySlot.height}px
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectFrame(frame);
                  }}
                  className="w-full min-h-[50px] sm:min-h-[54px] py-3 px-4 text-xs sm:text-sm font-bold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  <span>Pilih Bingkai ({frame.photoCount} Foto)</span>
                  <span>→</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
