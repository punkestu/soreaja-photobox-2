import React, { useEffect, useRef, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { RotateCcw, X } from 'lucide-react';
import { usePhotobox } from '../../context/PhotoboxContext';

interface PrintAnimationModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  animationKey: number;
  onClose: () => void;
}

const PRINT_KEYFRAMES = [
  '-102%',
  '-88%',
  '-86%',
  '-70%',
  '-68%',
  '-50%',
  '-48%',
  '-30%',
  '-28%',
  '-10%',
  '-8%',
  '0%',
];

const PRINT_TIMES = [0, 0.12, 0.16, 0.28, 0.32, 0.45, 0.49, 0.63, 0.67, 0.82, 0.86, 1];
const PRINT_DURATION_S = 2.8;

/**
 * Purely visual popup animation showing the photo paper printing out
 * downward from a horizontal printer slot bar. Does not trigger any print job.
 */
export const PrintAnimationModal: React.FC<PrintAnimationModalProps> = ({
  isOpen,
  imageSrc,
  animationKey,
  onClose,
}) => {
  const { t } = usePhotobox();
  const [localReplayCount, setLocalReplayCount] = useState<number>(0);
  const [isPaperReady, setIsPaperReady] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const activeAnimKey = `${animationKey}-${localReplayCount}`;

  useEffect(() => {
    if (!isOpen || !imageSrc) {
      setIsPaperReady(false);
      return;
    }

    setIsPaperReady(false);
    let rafId = 0;

    const startNextFrame = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        setIsPaperReady(true);
      });
    };

    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      startNextFrame();
    }

    const fallbackTimer = window.setTimeout(startNextFrame, 250);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(fallbackTimer);
    };
  }, [isOpen, imageSrc, activeAnimKey]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !imageSrc) return null;

  const handleReplay = () => {
    setIsPaperReady(false);
    setLocalReplayCount((prev) => prev + 1);
  };

  return (
    <MotionConfig reducedMotion="never">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.printResult.printModalTitle}
        data-testid="print-animation-modal"
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg max-h-[92vh] bg-zinc-900 border border-zinc-800 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden"
        >
          {/* Top-Right Close Button */}
          <div className="px-4 pt-3.5 pb-1 flex justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              aria-label={t.printResult.printModalClose}
              className="w-9 h-9 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Printer Slot Bar + Paper Feeding Out Downward */}
          <div className="px-4 sm:px-6 pb-6 pt-1 flex-1 min-h-0 flex flex-col items-center justify-start overflow-y-auto">
            {/* Horizontal Printer Slot Bar */}
            <div className="w-full max-w-md bg-gradient-to-b from-zinc-700/70 via-zinc-800 to-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 shadow-[0_14px_30px_rgba(0,0,0,0.8)] relative z-30">
              <div className="h-4 bg-black rounded-full border border-zinc-700/90 shadow-[inset_0_4px_12px_rgba(0,0,0,1)] flex items-center justify-center px-3 overflow-hidden relative">
                {isPaperReady && (
                  <motion.div
                    key={`beam-${activeAnimKey}`}
                    initial={{ x: '-90%', opacity: 0.9 }}
                    animate={{ x: ['-90%', '90%', '-90%', '90%', '-90%', '90%'], opacity: [0.9, 0.9, 0.9, 0.9, 0.9, 0] }}
                    transition={{ duration: PRINT_DURATION_S, ease: 'easeInOut' }}
                    className="h-0.5 w-1/3 rounded-full bg-gradient-to-r from-transparent via-zinc-300/80 to-transparent"
                  />
                )}
              </div>
            </div>

            {/* Clipped Paper Chute Directly Under the Bar Slot */}
            <div className="w-full max-w-md -mt-2.5 pt-0 pb-2 px-4 overflow-hidden relative z-10 flex justify-center">
              {/* Shadow cast by the slot bar lip onto the emerging paper */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-0 left-4 right-4 h-6 bg-gradient-to-b from-black/95 via-black/45 to-transparent z-20"
              />

              <motion.div
                key={activeAnimKey}
                initial={{ y: '-102%' }}
                animate={isPaperReady ? { y: PRINT_KEYFRAMES } : { y: '-102%' }}
                transition={{
                  duration: PRINT_DURATION_S,
                  times: PRINT_TIMES,
                  ease: 'linear',
                }}
                className="relative inline-flex justify-center pt-4 will-change-transform"
              >
                <div className="relative rounded-b-xl rounded-t-sm overflow-hidden shadow-[0_20px_45px_rgba(0,0,0,0.85)] ring-1 ring-white/25 bg-white">
                  <img
                    ref={imgRef}
                    data-testid="print-animation-image"
                    src={imageSrc}
                    alt={t.printResult.printModalTitle}
                    onLoad={() => {
                      window.requestAnimationFrame(() => setIsPaperReady(true));
                    }}
                    className="max-h-[52vh] sm:max-h-[58vh] w-auto max-w-full object-contain block select-none"
                    draggable={false}
                  />

                  {/* Subtle glossy sweep right as paper finishes emerging */}
                  {isPaperReady && (
                    <motion.div
                      key={`sheen-${activeAnimKey}`}
                      aria-hidden="true"
                      initial={{ x: '-140%', opacity: 0 }}
                      animate={{ x: '240%', opacity: [0, 0.45, 0] }}
                      transition={{
                        delay: PRINT_DURATION_S - 0.35,
                        duration: 0.85,
                        ease: 'easeOut',
                      }}
                      className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent"
                    />
                  )}
                </div>
              </motion.div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-5 sm:px-6 py-3.5 border-t border-zinc-800/80 bg-zinc-900/95 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              data-testid="print-modal-replay-btn"
              onClick={handleReplay}
              className="min-h-[44px] px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 active:scale-95 rounded-xl transition-all cursor-pointer border border-zinc-700/80 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t.printResult.printModalReplay}</span>
            </button>

            <button
              type="button"
              data-testid="print-modal-close-btn"
              onClick={onClose}
              className="min-h-[44px] px-6 sm:px-8 py-2 text-xs sm:text-sm font-extrabold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 rounded-xl transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
            >
              <span>{t.printResult.printModalClose}</span>
            </button>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
};
