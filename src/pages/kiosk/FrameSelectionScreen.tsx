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
  const [isScrolling, setIsScrolling] = useState(false);
  const isScrollingRef = useRef(false);

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
      } else if (data.length > 0) {
        // Set first frame as default selected if none chosen yet
        setSelectedFrame(data[0]);
      }
    });
  }, [selectedFrame, setSelectedFrame]);

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

  // Snap and commit selection only when sliding has completely stopped
  const snapToSettledFrame = useCallback(() => {
    if (isProgrammaticScrollRef.current || frames.length === 0) {
      setIsScrolling(false);
      isScrollingRef.current = false;
      return;
    }
    const finalTarget = getClosestFrameIndex();
    setActiveIndex(finalTarget);
    if (frames[finalTarget]) {
      setSelectedFrame(frames[finalTarget]);
    }
    scrollToIndex(finalTarget, true);
    setIsScrolling(false);
    isScrollingRef.current = false;
  }, [getClosestFrameIndex, frames, setSelectedFrame, scrollToIndex]);

  // Pure fluid scrolling without React state churn or re-rendering while in motion
  const handleScroll = useCallback(() => {
    // If this is a programmatic scroll (e.g. arrow button), do not trigger settle
    if (isProgrammaticScrollRef.current) return;

    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
      setIsScrolling(true);
    }

    // Clear any pending settle timer
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
    }

    // Only commit selection and snap when motion has completely stopped (zero flicker on mid-end devices)
    settleTimeoutRef.current = setTimeout(() => {
      if (!isPointerDownRef.current) {
        snapToSettledFrame();
      }
    }, 180);
  }, [snapToSettledFrame]);

  // Listen for native scrollend event where supported
  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;

    const onScrollEnd = () => {
      if (isProgrammaticScrollRef.current || isPointerDownRef.current) return;
      snapToSettledFrame();
    };

    container.addEventListener('scrollend', onScrollEnd);
    return () => {
      container.removeEventListener('scrollend', onScrollEnd);
    };
  }, [snapToSettledFrame]);

  // Next and Prev buttons: actively select the frame, update state, and glide to center
  const handleNext = useCallback(() => {
    cancelMomentum();
    const nextIndex = Math.min(frames.length - 1, activeIndex + 1);
    if (nextIndex !== activeIndex) {
      setIsScrolling(false);
      isScrollingRef.current = false;
      setActiveIndex(nextIndex);
      if (frames[nextIndex]) {
        setSelectedFrame(frames[nextIndex]);
      }
      scrollToIndex(nextIndex, true);
    }
  }, [activeIndex, frames, setSelectedFrame, scrollToIndex, cancelMomentum]);

  const handlePrev = useCallback(() => {
    cancelMomentum();
    const prevIndex = Math.max(0, activeIndex - 1);
    if (prevIndex !== activeIndex) {
      setIsScrolling(false);
      isScrollingRef.current = false;
      setActiveIndex(prevIndex);
      if (frames[prevIndex]) {
        setSelectedFrame(frames[prevIndex]);
      }
      scrollToIndex(prevIndex, true);
    }
  }, [activeIndex, frames, setSelectedFrame, scrollToIndex, cancelMomentum]);

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
        if (!isScrollingRef.current) {
          isScrollingRef.current = true;
          setIsScrolling(true);
        }
      }

      // 1:1 instantaneous drag tracking on compositor
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
            // Motion stopped: commit selection and snap
            snapToSettledFrame();
          }
        };
        momentumAnimationRef.current = requestAnimationFrame(glide);
      } else {
        // Slow release: commit selection and snap
        snapToSettledFrame();
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [snapToSettledFrame]);

  const handleSelectFrame = (frame: FrameMetadata) => {
    setSelectedFrame(frame);
    setCapturedPhotos([]);
    setRetakeIndex(null);
    navigate('/app/camera');
  };

  const handleCardClick = (frame: FrameMetadata, index: number) => {
    // Instantly halt any ongoing momentum or track scrolling
    cancelMomentum();
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
    }
    const container = carouselRef.current;
    if (container) {
      const currentScroll = container.scrollLeft;
      container.scrollTo({ left: currentScroll, behavior: 'auto' });
    }

    const wasScrolling = isScrollingRef.current || hasMovedRef.current;
    hasMovedRef.current = false;
    isScrollingRef.current = false;
    setIsScrolling(false);

    // Stop and center clicked frame, committing it as selected
    setActiveIndex(index);
    setSelectedFrame(frame);
    scrollToIndex(index, true);

    // If card was already stationary and active before this click, proceed to camera
    if (!wasScrolling && index === activeIndex) {
      handleSelectFrame(frame);
    }
  };

  return (
    <div className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-2 sm:py-3 flex flex-col justify-between select-none h-full overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-white/5 shrink-0">
        <div>
          <div className="text-xs font-mono-tabular text-zinc-400 flex items-center gap-2 mb-0.5">
            <span className="text-[var(--theme-accent,#E11D48)] font-bold">{t.frameSelect.stageBadge}</span>
            <span aria-hidden="true">·</span>
            <span>🖼️ {t.frameSelect.title}</span>
            <span aria-hidden="true">·</span>
            <span>{frames.length} {t.frameSelect.framesAvailable}</span>
          </div>
          <h1 className="font-display text-lg sm:text-xl md:text-2xl font-extrabold text-[#F4F4F0]">
            {t.frameSelect.title}
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5 hidden sm:block">
            {t.frameSelect.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/app/idle')}
          className="min-h-[40px] px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-zinc-300 bg-zinc-900/90 active:scale-95 hover:bg-zinc-800 rounded-xl transition-all whitespace-nowrap self-start sm:self-auto cursor-pointer border border-zinc-800 shadow-sm flex items-center gap-1.5"
        >
          <span>←</span>
          <span>{t.nav.backToStart}</span>
        </button>
      </div>

      {/* Swipeable Carousel Area with Lightweight 60+ FPS Scroll */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-3 border-[var(--theme-accent,#E11D48)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-mono-tabular text-zinc-400">{t.frameSelect.loadingFrames}</p>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 min-h-0 w-full flex flex-col justify-center py-1 sm:py-2 my-auto overflow-hidden">
          {/* Side Navigation Arrow Buttons - Pressing Next / Prev actively selects the frame */}
          <button
            type="button"
            onClick={handlePrev}
            disabled={activeIndex === 0}
            aria-label={t.frameSelect.prevFrame || 'Previous frame'}
            className={`absolute left-1 sm:left-3 md:left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 border shadow-2xl backdrop-blur-md cursor-pointer ${
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
            className={`absolute right-1 sm:right-3 md:right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 border shadow-2xl backdrop-blur-md cursor-pointer ${
              activeIndex === frames.length - 1
                ? 'opacity-20 pointer-events-none bg-zinc-900/40 border-zinc-800 text-zinc-600'
                : 'bg-zinc-900/90 hover:bg-zinc-800 text-white border-white/15 active:scale-90 hover:scale-105 hover:border-[var(--theme-accent,#E11D48)]/50 hover:shadow-[0_0_20px_rgba(225,29,72,0.3)]'
            }`}
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6 stroke-current" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Scroll Track: Native momentum scroll without state churn during movement */}
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
            className="w-full flex items-center gap-4 sm:gap-6 md:gap-8 overflow-x-auto py-2 sm:py-3 px-[calc(50vw-120px)] sm:px-[calc(50vw-145px)] md:px-[calc(50vw-160px)] lg:px-[calc(50%-160px)] touch-pan-x focus:outline-none cursor-grab active:cursor-grabbing will-change-scroll"
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
                  className={`w-[220px] sm:w-[250px] md:w-[280px] max-h-[58vh] shrink-0 rounded-2xl flex flex-col justify-between transition-all duration-300 ease-out select-none border transform-gpu ${
                    isActive
                      ? 'scale-100 opacity-100 bg-zinc-900 border-[var(--theme-accent,#E11D48)] ring-2 ring-[var(--theme-accent,#E11D48)]/40 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_35px_rgba(225,29,72,0.35)] p-3 sm:p-4 z-10'
                      : 'scale-[0.9] sm:scale-[0.93] opacity-60 hover:opacity-85 bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700/80 p-3 sm:p-4 cursor-pointer z-0'
                  }`}
                >
                  {/* Top Metadata: Poses count & Dimensions - Placed ABOVE artwork */}
                  <div className="flex items-center justify-between pb-1.5 text-[11px] font-mono-tabular text-zinc-400 shrink-0">
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

                  {/* Frame Preview Container: Uncropped, completely visible vertical strip */}
                  <div className="w-full bg-zinc-950/90 rounded-xl p-2 flex items-center justify-center border border-zinc-800/80 shadow-inner relative group flex-1 min-h-[220px] max-h-[44vh]">
                    <img
                      src={frame.previewImg}
                      alt={`Pratinjau ${frame.name}`}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className="h-full w-auto max-h-[42vh] max-w-full object-contain pointer-events-none drop-shadow-[0_12px_30px_rgba(0,0,0,0.8)] transition-transform duration-300 group-hover:scale-[1.01]"
                    />
                  </div>

                  {/* Frame Title & Subtitle */}
                  <div className="pt-2 pb-0.5 space-y-0.5 shrink-0 text-center">
                    <h2 className="font-display text-sm sm:text-base font-bold text-[#F4F4F0] line-clamp-1">
                      {frame.name}
                    </h2>
                    {frame.subtitle && (
                      <p className="text-[11px] text-zinc-400 line-clamp-1">
                        {frame.subtitle}
                      </p>
                    )}
                  </div>

                  {/* Action CTA */}
                  <div className="pt-1.5 shrink-0">
                    {isActive ? (
                      <button
                        type="button"
                        disabled={isScrolling}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isScrolling) return;
                          handleSelectFrame(frame);
                        }}
                        className={`w-full min-h-[42px] py-2 px-3 text-xs sm:text-sm font-bold text-white rounded-xl transition-all whitespace-nowrap shadow-lg flex items-center justify-center gap-2 ${
                          isScrolling
                            ? 'bg-zinc-800 text-zinc-400 border border-zinc-700/60 shadow-none cursor-default'
                            : 'bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-[0.98] cursor-pointer'
                        }`}
                      >
                        {isScrolling ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                            <span>{t.frameSelect.scrollingIndicator || 'Menggeser...'}</span>
                          </>
                        ) : (
                          <>
                            <span>{t.frameSelect.selectAction}</span>
                            <span>📸</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="w-full min-h-[40px] py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors flex items-center justify-center gap-1.5 border border-zinc-800/60 rounded-xl bg-zinc-950/40">
                        <span>{t.frameSelect.tapToPreview}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dot Indicators & Carousel Counter */}
          <div className="flex flex-col items-center justify-center gap-1 pt-1.5 shrink-0">
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
                    onClick={() => {
                      setActiveIndex(idx);
                      setSelectedFrame(frame);
                      scrollToIndex(idx, true);
                    }}
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
