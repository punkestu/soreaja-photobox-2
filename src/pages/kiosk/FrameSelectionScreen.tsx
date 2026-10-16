import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFramesMetadata } from '../../data/defaultFrames';
import { usePhotobox } from '../../context/PhotoboxContext';
import type { FrameMetadata } from '../../types/photobox';

export const FrameSelectionScreen: React.FC = () => {
  const navigate = useNavigate();
  const { selectedFrame, setSelectedFrame, setCapturedPhotos, setRetakeIndex, t } =
    usePhotobox();
  const [frames, setFrames] = useState<FrameMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const carouselRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Mouse drag handling state
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const hasMovedRef = useRef(false);

  // Fetch frame templates
  useEffect(() => {
    fetchFramesMetadata().then((data) => {
      setFrames(data);
      setLoading(false);

      // Determine initial active index if a frame was already chosen
      if (selectedFrame) {
        const foundIndex = data.findIndex((f) => f.id === selectedFrame.id);
        if (foundIndex !== -1) {
          setActiveIndex(foundIndex);
        }
      }
    });
  }, [selectedFrame]);

  // Center the active card programmatically
  const scrollToIndex = useCallback(
    (index: number, smooth = true) => {
      const container = carouselRef.current;
      const targetEl = itemRefs.current[index];
      if (!container || !targetEl) return;

      const containerWidth = container.offsetWidth;
      const targetLeft = targetEl.offsetLeft;
      const targetWidth = targetEl.offsetWidth;

      const targetScrollLeft = targetLeft - containerWidth / 2 + targetWidth / 2;

      container.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: smooth ? 'smooth' : 'auto',
      });
      setActiveIndex(index);
    },
    []
  );

  // Initial scroll on frames load
  useEffect(() => {
    if (!loading && frames.length > 0) {
      // Delay slightly for DOM layout calculation
      const timer = setTimeout(() => {
        scrollToIndex(activeIndex, false);
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [loading, frames.length, scrollToIndex, activeIndex]);

  // Track active item from scroll position
  const handleScroll = useCallback(() => {
    const container = carouselRef.current;
    if (!container || itemRefs.current.length === 0) return;

    const containerCenter = container.getBoundingClientRect().left + container.offsetWidth / 2;

    let closestIndex = 0;
    let minDiff = Infinity;

    itemRefs.current.forEach((el, index) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const itemCenter = rect.left + rect.width / 2;
      const diff = Math.abs(itemCenter - containerCenter);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  }, []);

  // Keyboard navigation (Left / Right / Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || frames.length === 0) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollToIndex(Math.max(0, activeIndex - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        scrollToIndex(Math.min(frames.length - 1, activeIndex + 1));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (frames[activeIndex]) {
          handleSelectFrame(frames[activeIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, frames, loading, scrollToIndex]);

  // Mouse drag handlers for desktop / touchscreen preview
  const handleMouseDown = (e: React.MouseEvent) => {
    const container = carouselRef.current;
    if (!container) return;
    isMouseDownRef.current = true;
    startXRef.current = e.pageX - container.offsetLeft;
    scrollLeftStartRef.current = container.scrollLeft;
    hasMovedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current) return;
    const container = carouselRef.current;
    if (!container) return;
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startXRef.current) * 1.3;
    if (Math.abs(walk) > 6) {
      hasMovedRef.current = true;
    }
    container.scrollLeft = scrollLeftStartRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isMouseDownRef.current = false;
  };

  const handleSelectFrame = (frame: FrameMetadata) => {
    setSelectedFrame(frame);
    setCapturedPhotos([]);
    setRetakeIndex(null);
    navigate('/app/camera');
  };

  const handleCardClick = (frame: FrameMetadata, index: number) => {
    if (hasMovedRef.current) return; // Ignore drag end click
    if (index === activeIndex) {
      handleSelectFrame(frame);
    } else {
      scrollToIndex(index);
    }
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 flex flex-col justify-between select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 sm:pb-4 border-b border-white/5 shrink-0">
        <div>
          <div className="text-xs sm:text-sm font-mono-tabular text-zinc-400 flex items-center gap-2 mb-1">
            <span className="text-[var(--theme-accent,#E11D48)] font-bold">{t.frameSelect.stageBadge}</span>
            <span aria-hidden="true">·</span>
            <span>🖼️ {t.frameSelect.title}</span>
            <span aria-hidden="true">·</span>
            <span>{frames.length} {t.frameSelect.framesAvailable}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#F4F4F0]">
            {t.frameSelect.title}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            {t.frameSelect.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/app/idle')}
          className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-300 bg-zinc-900/90 active:scale-95 hover:bg-zinc-800 rounded-xl transition-all whitespace-nowrap self-start sm:self-auto cursor-pointer border border-zinc-800 shadow-sm flex items-center gap-1.5"
        >
          <span>←</span>
          <span>{t.nav.backToStart}</span>
        </button>
      </div>

      {/* Swipeable Carousel Area */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-3 border-[var(--theme-accent,#E11D48)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-mono-tabular text-zinc-400">{t.frameSelect.loadingFrames}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center min-h-0 py-4 sm:py-6">
          {/* Scroll Track with Center Padding */}
          <div
            ref={carouselRef}
            onScroll={handleScroll}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
            className="w-full flex items-center gap-4 sm:gap-6 md:gap-8 overflow-x-auto py-4 px-[calc(50vw-135px)] sm:px-[calc(50vw-160px)] md:px-[calc(50vw-175px)] lg:px-[calc(50%-175px)] scroll-smooth snap-x snap-mandatory touch-pan-x cursor-grab active:cursor-grabbing focus:outline-none"
            tabIndex={0}
            role="region"
            aria-label="Frame Templates Carousel"
          >
            {frames.map((frame, index) => {
              const isActive = index === activeIndex;
              const isSelected = selectedFrame?.id === frame.id;
              const primarySlot = frame.positions?.[0];

              return (
                <div
                  key={frame.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  onClick={() => handleCardClick(frame, index)}
                  role="button"
                  tabIndex={0}
                  aria-selected={isActive}
                  aria-label={`${frame.name}, ${frame.photoCount} ${t.frameSelect.poses}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCardClick(frame, index);
                    }
                  }}
                  className={`w-[270px] sm:w-[320px] md:w-[350px] shrink-0 snap-center rounded-2xl flex flex-col justify-between transition-all duration-300 ease-out select-none border ${
                    isActive
                      ? 'scale-100 opacity-100 bg-zinc-900 border-[var(--theme-accent,#E11D48)] ring-2 ring-[var(--theme-accent,#E11D48)]/40 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_35px_rgba(225,29,72,0.35)] p-4 sm:p-5 z-10'
                      : 'scale-[0.88] sm:scale-[0.92] opacity-50 hover:opacity-80 bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700/80 p-4 sm:p-5 cursor-pointer z-0'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Artwork Preview Box */}
                    <div className="aspect-[3/4] sm:aspect-[9/13] bg-zinc-950 rounded-xl p-3 sm:p-4 flex items-center justify-center overflow-hidden border border-zinc-800/70 shadow-inner relative group">
                      <img
                        src={frame.previewImg}
                        alt={`Pratinjau ${frame.name}`}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        draggable={false}
                        className="max-h-full max-w-full object-contain rounded shadow-xl pointer-events-none transition-transform duration-300 group-hover:scale-[1.02]"
                      />

                      {/* Active Badges */}
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        <span className="bg-black/80 backdrop-blur-md text-[11px] font-mono-tabular font-bold text-white px-2.5 py-1 rounded-lg border border-white/10 shadow">
                          {frame.photoCount} {t.frameSelect.poses}
                        </span>
                      </div>

                      {isSelected && (
                        <div className="absolute top-2.5 left-2.5 bg-[var(--theme-accent,#E11D48)] text-[10px] font-bold text-white px-2 py-0.5 rounded shadow">
                          ✓ ACTIVE
                        </div>
                      )}
                    </div>

                    {/* Frame Minimal Details */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono-tabular text-zinc-400">
                        <span className="font-semibold text-zinc-300">
                          {frame.photoCount} {t.frameSelect.poses}
                        </span>
                        <span>
                          {frame.canvasWidth || 500}×{frame.canvasHeight || 1220}px
                        </span>
                      </div>
                      <h2 className="font-display text-base sm:text-lg font-bold text-[#F4F4F0] line-clamp-1">
                        {frame.name}
                      </h2>
                      {frame.subtitle && (
                        <p className="text-[11px] sm:text-xs text-zinc-400 line-clamp-1">
                          {frame.subtitle}
                        </p>
                      )}
                      {primarySlot && (
                        <p className="text-[10px] font-mono-tabular text-zinc-500 pt-0.5 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-accent,#E11D48)]" />
                          <span>Slot: {primarySlot.width}×{primarySlot.height}px</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action CTA */}
                  <div className="pt-3">
                    {isActive ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectFrame(frame);
                        }}
                        className="w-full min-h-[48px] py-2.5 px-4 text-xs sm:text-sm font-bold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-[0.98] rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-lg flex items-center justify-center gap-2"
                      >
                        <span>{t.frameSelect.selectAction}</span>
                        <span>📸</span>
                      </button>
                    ) : (
                      <div className="w-full min-h-[44px] py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors flex items-center justify-center gap-1.5 border border-zinc-800/60 rounded-xl bg-zinc-950/40">
                        <span>{t.frameSelect.tapToPreview}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dot Indicators & Carousel Counter */}
          <div className="flex flex-col items-center justify-center gap-2 pt-3 shrink-0">
            <div
              className="flex items-center justify-center gap-2"
              role="tablist"
              aria-label="Frame selector pagination"
            >
              {frames.map((frame, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={frame.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`${frame.name} (${idx + 1} / ${frames.length})`}
                    onClick={() => scrollToIndex(idx)}
                    className={`transition-all duration-300 rounded-full cursor-pointer ${
                      isActive
                        ? 'w-8 h-2.5 bg-[var(--theme-accent,#E11D48)] shadow-[0_0_12px_rgba(225,29,72,0.6)]'
                        : 'w-2.5 h-2.5 bg-zinc-700 hover:bg-zinc-500'
                    }`}
                  />
                );
              })}
            </div>

            <div className="text-xs font-mono-tabular text-zinc-400 flex items-center justify-center gap-2">
              <span className="font-semibold text-zinc-300">
                {activeIndex + 1} / {frames.length}
              </span>
              <span aria-hidden="true">·</span>
              <span>{t.frameSelect.swipeHint}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
