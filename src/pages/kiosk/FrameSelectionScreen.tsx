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

  // Settle, momentum & gesture state
  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const velocityRef = useRef(0);
  const hasMovedRef = useRef(false);

  const isProgrammaticScrollRef = useRef(false);
  const settleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const momentumAnimationRef = useRef<number | null>(null);
  const wheelCooldownRef = useRef(false);

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

  // Cancel any active momentum animation
  const cancelMomentum = useCallback(() => {
    if (momentumAnimationRef.current) {
      cancelAnimationFrame(momentumAnimationRef.current);
      momentumAnimationRef.current = null;
    }
  }, []);

  // Calculate which frame element is currently closest to the carousel center
  const getClosestFrameIndex = useCallback(() => {
    const container = carouselRef.current;
    if (!container || itemRefs.current.length === 0) return 0;

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

    return closestIndex;
  }, []);

  // Programmatically center a card with smooth animation
  const scrollToIndex = useCallback(
    (index: number, smooth = true) => {
      const container = carouselRef.current;
      const targetEl = itemRefs.current[index];
      if (!container || !targetEl) return;

      const containerWidth = container.offsetWidth;
      const targetLeft = targetEl.offsetLeft;
      const targetWidth = targetEl.offsetWidth;

      const targetScrollLeft = targetLeft - containerWidth / 2 + targetWidth / 2;

      if (smooth) {
        isProgrammaticScrollRef.current = true;
        if (settleTimeoutRef.current) {
          clearTimeout(settleTimeoutRef.current);
        }
      }

      container.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: smooth ? 'smooth' : 'auto',
      });
      setActiveIndex(index);

      if (smooth) {
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 320);
      }
    },
    []
  );

  // Initial scroll on frames load
  useEffect(() => {
    if (!loading && frames.length > 0) {
      const timer = setTimeout(() => {
        scrollToIndex(activeIndex, false);
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [loading, frames.length, scrollToIndex, activeIndex]);

  // Handle free fluid scrolling: preview the closest card while moving, then when scroll slows down, settle & center
  const handleScroll = useCallback(() => {
    const container = carouselRef.current;
    if (!container) return;

    const closest = getClosestFrameIndex();

    // If this is a programmatic scroll (e.g. arrow button or settle animation), update active index and exit
    if (isProgrammaticScrollRef.current) {
      setActiveIndex(closest);
      return;
    }

    // Live update active card visual indicator as cards glide past center
    setActiveIndex(closest);

    // Clear any previous settle timeout
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
    }

    // When scrolling slows down and comes to rest (150ms debounce), snap cleanly to the selected frame
    settleTimeoutRef.current = setTimeout(() => {
      if (!isPointerDownRef.current) {
        const finalTarget = getClosestFrameIndex();
        scrollToIndex(finalTarget, true);
      }
    }, 150);
  }, [getClosestFrameIndex, scrollToIndex]);

  // Listen for native scrollend event where supported
  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;

    const onScrollEnd = () => {
      if (isProgrammaticScrollRef.current || isPointerDownRef.current) return;
      const finalTarget = getClosestFrameIndex();
      scrollToIndex(finalTarget, true);
    };

    container.addEventListener('scrollend', onScrollEnd);
    return () => {
      container.removeEventListener('scrollend', onScrollEnd);
    };
  }, [getClosestFrameIndex, scrollToIndex]);

  // Directional navigation helpers
  const handlePrev = useCallback(() => {
    cancelMomentum();
    if (activeIndex > 0) {
      scrollToIndex(activeIndex - 1, true);
    }
  }, [activeIndex, scrollToIndex, cancelMomentum]);

  const handleNext = useCallback(() => {
    cancelMomentum();
    if (activeIndex < frames.length - 1) {
      scrollToIndex(activeIndex + 1, true);
    }
  }, [activeIndex, frames.length, scrollToIndex, cancelMomentum]);

  // Keyboard navigation (Left / Right / Enter / Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || frames.length === 0) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (frames[activeIndex]) {
          handleSelectFrame(frames[activeIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, frames, loading, handlePrev, handleNext]);

  // Mouse wheel & trackpad horizontal translation
  const handleWheel = (e: React.WheelEvent) => {
    cancelMomentum();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 25 || wheelCooldownRef.current) return;

    wheelCooldownRef.current = true;
    if (delta > 0) {
      handleNext();
    } else {
      handlePrev();
    }

    setTimeout(() => {
      wheelCooldownRef.current = false;
    }, 320);
  };

  // Mouse drag handling with momentum glide on desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only primary mouse button
    const container = carouselRef.current;
    if (!container) return;

    cancelMomentum();
    isPointerDownRef.current = true;
    startXRef.current = e.clientX;
    lastXRef.current = e.clientX;
    lastTimeRef.current = performance.now();
    scrollLeftStartRef.current = container.scrollLeft;
    velocityRef.current = 0;
    hasMovedRef.current = false;
  };

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isPointerDownRef.current) return;
      const container = carouselRef.current;
      if (!container) return;

      const now = performance.now();
      const dt = now - lastTimeRef.current;
      if (dt > 0) {
        velocityRef.current = (e.clientX - lastXRef.current) / dt;
        lastXRef.current = e.clientX;
        lastTimeRef.current = now;
      }

      const dx = e.clientX - startXRef.current;
      if (Math.abs(dx) > 6) {
        hasMovedRef.current = true;
      }

      // 1:1 instantaneous drag tracking
      container.scrollLeft = scrollLeftStartRef.current - dx;
    };

    const handleWindowMouseUp = () => {
      if (!isPointerDownRef.current) return;
      isPointerDownRef.current = false;

      const container = carouselRef.current;
      if (!container) return;

      const releaseVelocity = velocityRef.current;

      // If user flicked with noticeable velocity, glide with kinetic inertia decay!
      if (Math.abs(releaseVelocity) > 0.15) {
        let currentV = releaseVelocity * 16;
        const glide = () => {
          if (!container) return;
          currentV *= 0.94; // Deceleration friction
          container.scrollLeft -= currentV;

          if (Math.abs(currentV) > 0.5) {
            momentumAnimationRef.current = requestAnimationFrame(glide);
          } else {
            momentumAnimationRef.current = null;
            // Motion slowed down: calculate which frame is selected and center it
            const target = getClosestFrameIndex();
            scrollToIndex(target, true);
          }
        };
        momentumAnimationRef.current = requestAnimationFrame(glide);
      } else {
        // Slow release: settle to closest frame
        const target = getClosestFrameIndex();
        scrollToIndex(target, true);
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [getClosestFrameIndex, scrollToIndex]);

  const handleSelectFrame = (frame: FrameMetadata) => {
    setSelectedFrame(frame);
    setCapturedPhotos([]);
    setRetakeIndex(null);
    navigate('/app/camera');
  };

  const handleCardClick = (frame: FrameMetadata, index: number) => {
    if (hasMovedRef.current) return; // Ignore drag release click
    cancelMomentum();
    if (index === activeIndex) {
      handleSelectFrame(frame);
    } else {
      scrollToIndex(index, true);
    }
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-3 sm:py-5 flex flex-col justify-between select-none min-h-[calc(100vh-70px)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-3 pb-3 border-b border-white/5 shrink-0">
        <div>
          <div className="text-xs sm:text-sm font-mono-tabular text-zinc-400 flex items-center gap-2 mb-1">
            <span className="text-[var(--theme-accent,#E11D48)] font-bold">{t.frameSelect.stageBadge}</span>
            <span aria-hidden="true">·</span>
            <span>🖼️ {t.frameSelect.title}</span>
            <span aria-hidden="true">·</span>
            <span>{frames.length} {t.frameSelect.framesAvailable}</span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-extrabold text-[#F4F4F0]">
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

      {/* Swipeable Carousel Area with Complete Uncropped Frame Preview */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-3 border-[var(--theme-accent,#E11D48)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-mono-tabular text-zinc-400">{t.frameSelect.loadingFrames}</p>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 w-full flex flex-col justify-center py-2 sm:py-4 my-auto">
          {/* Side Navigation Arrow Buttons */}
          <button
            type="button"
            onClick={handlePrev}
            disabled={activeIndex === 0}
            aria-label={t.frameSelect.prevFrame || 'Previous frame'}
            className={`absolute left-1 sm:left-3 md:left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all duration-200 border shadow-2xl backdrop-blur-md cursor-pointer ${
              activeIndex === 0
                ? 'opacity-20 pointer-events-none bg-zinc-900/40 border-zinc-800 text-zinc-600'
                : 'bg-zinc-900/90 hover:bg-zinc-800 text-white border-white/15 active:scale-90 hover:scale-105 hover:border-[var(--theme-accent,#E11D48)]/50 hover:shadow-[0_0_20px_rgba(225,29,72,0.3)]'
            }`}
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6 stroke-current" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={activeIndex === frames.length - 1}
            aria-label={t.frameSelect.nextFrame || 'Next frame'}
            className={`absolute right-1 sm:right-3 md:right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all duration-200 border shadow-2xl backdrop-blur-md cursor-pointer ${
              activeIndex === frames.length - 1
                ? 'opacity-20 pointer-events-none bg-zinc-900/40 border-zinc-800 text-zinc-600'
                : 'bg-zinc-900/90 hover:bg-zinc-800 text-white border-white/15 active:scale-90 hover:scale-105 hover:border-[var(--theme-accent,#E11D48)]/50 hover:shadow-[0_0_20px_rgba(225,29,72,0.3)]'
            }`}
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6 stroke-current" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Scroll Track: Completely fluid, uninhibited momentum scroll with deceleration settle */}
          <div
            ref={carouselRef}
            onScroll={handleScroll}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorX: 'contain',
            }}
            className="w-full flex items-center gap-5 sm:gap-7 md:gap-9 overflow-x-auto py-4 px-[calc(50vw-120px)] sm:px-[calc(50vw-145px)] md:px-[calc(50vw-160px)] lg:px-[calc(50%-160px)] touch-pan-x focus:outline-none cursor-grab active:cursor-grabbing"
            tabIndex={0}
            role="region"
            aria-label="Frame Templates Carousel"
          >
            {frames.map((frame, index) => {
              const isActive = index === activeIndex;
              const isSelected = selectedFrame?.id === frame.id;

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
                  className={`w-[240px] sm:w-[280px] md:w-[310px] shrink-0 rounded-2xl flex flex-col justify-between transition-all duration-300 ease-out select-none border ${
                    isActive
                      ? 'scale-100 opacity-100 bg-zinc-900 border-[var(--theme-accent,#E11D48)] ring-2 ring-[var(--theme-accent,#E11D48)]/40 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_35px_rgba(225,29,72,0.35)] p-4 sm:p-5 z-10'
                      : 'scale-[0.9] sm:scale-[0.93] opacity-60 hover:opacity-85 bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700/80 p-4 sm:p-5 cursor-pointer z-0'
                  }`}
                >
                  {/* Top Metadata: Poses count & Dimensions - Placed ABOVE the artwork so it NEVER covers the frame! */}
                  <div className="flex items-center justify-between pb-2 text-[11px] font-mono-tabular text-zinc-400 shrink-0">
                    <span className="font-bold text-white bg-black/60 px-2 py-0.5 rounded border border-white/10 shadow-sm">
                      {frame.photoCount} {t.frameSelect.poses}
                    </span>
                    {isSelected ? (
                      <span className="text-[10px] font-bold text-[var(--theme-accent,#E11D48)] bg-[var(--theme-accent,#E11D48)]/10 px-2 py-0.5 rounded border border-[var(--theme-accent,#E11D48)]/30">
                        ✓ ACTIVE
                      </span>
                    ) : (
                      <span className="text-zinc-500">
                        {frame.canvasWidth || 500}×{frame.canvasHeight || 1220}
                      </span>
                    )}
                  </div>

                  {/* Frame Preview Container: High-contrast studio backdrop, perfectly sized to display the ENTIRE uncropped frame */}
                  <div className="w-full bg-zinc-950/90 rounded-xl p-2.5 sm:p-3 flex items-center justify-center border border-zinc-800/80 shadow-inner relative group min-h-[360px] sm:min-h-[420px] max-h-[62vh]">
                    <img
                      src={frame.previewImg}
                      alt={`Pratinjau ${frame.name}`}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      draggable={false}
                      className="h-full w-auto max-h-[58vh] max-w-full object-contain pointer-events-none drop-shadow-[0_12px_30px_rgba(0,0,0,0.8)] transition-transform duration-300 group-hover:scale-[1.01]"
                    />
                  </div>

                  {/* Frame Title & Subtitle */}
                  <div className="pt-3 pb-1 space-y-0.5 shrink-0 text-center">
                    <h2 className="font-display text-base sm:text-lg font-bold text-[#F4F4F0] line-clamp-1">
                      {frame.name}
                    </h2>
                    {frame.subtitle && (
                      <p className="text-xs text-zinc-400 line-clamp-1">
                        {frame.subtitle}
                      </p>
                    )}
                  </div>

                  {/* Action CTA */}
                  <div className="pt-2 shrink-0">
                    {isActive ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectFrame(frame);
                        }}
                        className="w-full min-h-[46px] py-2.5 px-4 text-xs sm:text-sm font-bold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-[0.98] rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-lg flex items-center justify-center gap-2"
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
          <div className="flex flex-col items-center justify-center gap-1.5 pt-3 shrink-0">
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
                    onClick={() => scrollToIndex(idx, true)}
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
