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
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 md:px-10 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4">
        <div>
          <div className="text-xs font-mono-tabular text-zinc-400 flex items-center gap-2 mb-2">
            <span>Tahap 02 dari 06</span>
            <span aria-hidden="true">·</span>
            <span>Sumber Data: /metadata.json</span>
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-bold text-[#F4F4F0]">
            Pilih Layout Bingkai Studio
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Setiap bingkai menentukan jumlah pengambilan foto otomatis dan tata letak
            kanvas akhir.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/app/idle')}
          className="px-4 py-2 text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap self-start md:self-auto cursor-pointer"
        >
          ← Kembali ke Layar Mulai
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-6">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className="h-[440px] bg-zinc-900/60 rounded-2xl animate-pulse p-5"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-6">
          {frames.map((frame) => {
            const isSelected = selectedFrame?.id === frame.id;
            return (
              <div
                key={frame.id}
                className={`bg-zinc-900/70 hover:bg-zinc-900 rounded-2xl p-5 flex flex-col justify-between gap-5 transition-all ${
                  isSelected
                    ? 'ring-2 ring-[var(--theme-accent,#E11D48)] bg-zinc-900'
                    : 'hover:shadow-2xl'
                }`}
              >
                <div className="space-y-4">
                  {/* Visual Preview Container */}
                  <div className="aspect-[3/4] bg-zinc-950 rounded-xl p-4 flex items-center justify-center overflow-hidden">
                    <img
                      src={frame.previewImg}
                      alt={`Pratinjau bingkai ${frame.name}`}
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full object-contain rounded shadow-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-mono-tabular text-zinc-400">
                      <span>{frame.photoCount} Pose Otomatis</span>
                      <span aria-hidden="true"> · </span>
                      <span>
                        {frame.canvasWidth || 500}×{frame.canvasHeight || 1220}px
                      </span>
                    </div>
                    <h2 className="font-display text-lg font-bold text-[#F4F4F0]">
                      {frame.name}
                    </h2>
                    {frame.subtitle && (
                      <p className="text-xs text-zinc-400">{frame.subtitle}</p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectFrame(frame)}
                  className="w-full py-3.5 px-4 text-xs font-semibold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-md"
                >
                  Pilih {frame.name} ({frame.photoCount} Foto)
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
