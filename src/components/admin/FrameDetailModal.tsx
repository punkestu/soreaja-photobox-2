import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FrameMetadata } from '../../types/photobox';
import { usePhotobox } from '../../context/PhotoboxContext';

interface FrameDetailModalProps {
  frame: FrameMetadata;
  onClose: () => void;
}

export const FrameDetailModal: React.FC<FrameDetailModalProps> = ({
  frame,
  onClose,
}) => {
  const navigate = useNavigate();
  const { language, t } = usePhotobox();
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const canvasWidth = frame.canvasWidth || 500;
  const canvasHeight = frame.canvasHeight || 1220;
  const aspectRatio = canvasWidth / canvasHeight;
  const isDoubleWidth = aspectRatio > 0.65;

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(frame, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write error
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="frame-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-[#111111]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-neutral-200 bg-neutral-50/70">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2">
              <span className="font-mono-tabular text-xs font-bold px-2 py-0.5 rounded bg-neutral-200 text-neutral-800">
                {frame.id}
              </span>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                  isDoubleWidth
                    ? 'text-amber-800 bg-amber-100'
                    : 'text-sky-800 bg-sky-100'
                }`}
              >
                {isDoubleWidth ? '👥 Double Strip 4R' : '📱 Single Strip'}
              </span>
            </div>
            <h2 id="frame-detail-title" className="text-lg font-bold text-neutral-900 truncate mt-1">
              {frame.name}
              {frame.subtitle ? (
                <span className="text-xs text-neutral-500 font-normal"> · {frame.subtitle}</span>
              ) : null}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.admin.closeModal}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-200/60 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 transition-colors cursor-pointer text-sm font-bold shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: Visual Canvas Slot Overlay Visualizer */}
          <div className="md:col-span-6 flex flex-col items-center gap-3">
            <div className="w-full flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-600">
                {t.admin.frameVisualSlotPreview}
              </span>
              <span className="font-mono-tabular text-neutral-500 text-[11px]">
                {canvasWidth} × {canvasHeight} px
              </span>
            </div>

            {/* Canvas mockup box with bounding box slot overlays */}
            <div className="w-full max-w-[320px] bg-[#121214] rounded-xl border border-neutral-800 p-2 sm:p-3 flex items-center justify-center shadow-lg">
              <div
                className="relative w-full rounded overflow-hidden select-none"
                style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
              >
                {/* Background Frame Artwork */}
                {frame.previewImg || frame.frameImg ? (
                  <img
                    src={frame.previewImg || frame.frameImg}
                    alt={frame.name}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  />
                ) : null}

                {/* Overlaid bounding box rectangles for photo slots */}
                {frame.positions.map((pos, idx) => {
                  const leftPct = (pos.x / canvasWidth) * 100;
                  const topPct = (pos.y / canvasHeight) * 100;
                  const widthPct = (pos.width / canvasWidth) * 100;
                  const heightPct = (pos.height / canvasHeight) * 100;

                  return (
                    <div
                      key={idx}
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                      }}
                      className="absolute border-2 border-dashed border-emerald-400 bg-emerald-500/25 flex flex-col items-center justify-center p-1 text-center transition-all hover:bg-emerald-500/40"
                      title={`Slot #${idx + 1}: x=${pos.x}, y=${pos.y}, w=${pos.width}, h=${pos.height}`}
                    >
                      <span className="text-[10px] sm:text-xs font-mono font-bold text-white drop-shadow-md bg-black/60 px-1 py-0.2 rounded">
                        Slot #{idx + 1}
                      </span>
                      <span className="text-[8px] sm:text-[9px] font-mono text-emerald-200 drop-shadow-sm">
                        {pos.width}×{pos.height}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-[11px] text-neutral-500 text-center max-w-xs">
              💡 {t.admin.frameVisualSlotDesc}
            </p>
          </div>

          {/* Right Column: Technical Specs & Coordinate Table */}
          <div className="md:col-span-6 flex flex-col gap-4">
            {/* Specs Breakdown */}
            <div className="bg-[#F4F4F0] rounded-xl border border-neutral-200/80 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200">
                <span className="text-neutral-500">{t.admin.frameIdLabel}:</span>
                <span className="font-mono-tabular font-bold text-neutral-900">{frame.id}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200">
                <span className="text-neutral-500">{t.admin.frameNameLabel}:</span>
                <span className="font-medium text-neutral-900">{frame.name}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200">
                <span className="text-neutral-500">{t.admin.frameCanvasSize}:</span>
                <span className="font-mono-tabular font-semibold text-neutral-900">
                  {canvasWidth} × {canvasHeight} px (ratio {aspectRatio.toFixed(2)})
                </span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200">
                <span className="text-neutral-500">{t.admin.frameSlotsCount}:</span>
                <span className="font-mono-tabular font-bold text-neutral-900">
                  {frame.photoCount} {t.frameSelect.poses}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Theme Tone:</span>
                <span className="capitalize font-mono-tabular text-neutral-700">
                  {frame.theme || 'Standard'}
                </span>
              </div>
            </div>

            {/* Coordinates Table */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-neutral-700">
                {t.admin.frameSlotCoordinates} ({frame.positions.length} Slots)
              </span>
              <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold font-mono-tabular">
                      <th className="py-2 px-3">Slot</th>
                      <th className="py-2 px-2 text-right">X (px)</th>
                      <th className="py-2 px-2 text-right">Y (px)</th>
                      <th className="py-2 px-2 text-right">Width</th>
                      <th className="py-2 px-3 text-right">Height</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 font-mono-tabular">
                    {frame.positions.map((pos, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                        <td className="py-2 px-3 font-bold text-neutral-800">#{idx + 1}</td>
                        <td className="py-2 px-2 text-right text-neutral-600">{pos.x}</td>
                        <td className="py-2 px-2 text-right text-neutral-600">{pos.y}</td>
                        <td className="py-2 px-2 text-right text-neutral-900 font-semibold">{pos.width}</td>
                        <td className="py-2 px-3 text-right text-neutral-900 font-semibold">{pos.height}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Metadata JSON Toggle & Copy */}
            <div className="pt-1 space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowJson(!showJson)}
                  className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 underline cursor-pointer"
                >
                  {showJson ? 'Sembunyikan Raw JSON' : 'Tampilkan Raw JSON'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="px-2.5 py-1 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-lg transition-colors cursor-pointer"
                >
                  {copied ? t.admin.copiedMetadata : t.admin.copyMetadata}
                </button>
              </div>

              {showJson && (
                <pre className="p-3 bg-neutral-900 text-neutral-200 rounded-xl text-[10px] font-mono overflow-x-auto max-h-[140px]">
                  {JSON.stringify(frame, null, 2)}
                </pre>
              )}
            </div>

            {/* Test CTA */}
            <div className="pt-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/app/frame-selection');
                }}
                className="w-full min-h-[44px] px-4 py-2 text-xs font-bold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
              >
                <span>📸</span>
                <span>{t.admin.testInKiosk}</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
