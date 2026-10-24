import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db';
import { fetchFramesMetadata } from '../../data/defaultFrames';
import { usePhotobox } from '../../context/PhotoboxContext';
import type { FrameMetadata } from '../../types/photobox';

export type FrameFilterType = 'all' | 'single' | 'double';

export const FrameSelectionScreen: React.FC = () => {
  const navigate = useNavigate();
  const { selectedFrame, setSelectedFrame, setCapturedPhotos, setRetakeIndex, t } =
    usePhotobox();
  const [frames, setFrames] = useState<FrameMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FrameFilterType>('all');
  const [isScrolling, setIsScrolling] = useState(false);
  const isScrollingRef = useRef(false);

  // Helper to determine whether a frame has double strip width (full 4R sheet, ratio > 0.65)
  const isDoubleWidthFrame = useCallback((frame: FrameMetadata) => {
    const w = frame.canvasWidth || 500;
    const h = frame.canvasHeight || 1220;
    return w / h > 0.65;
  }, []);

  // Filtered frame list based on activeFilter
  const filteredFrames = useMemo(() => {
    if (activeFilter === 'single') {
      return frames.filter((f) => !isDoubleWidthFrame(f));
    }
    if (activeFilter === 'double') {
      return frames.filter((f) => isDoubleWidthFrame(f));
    }
    return frames;
  }, [frames, activeFilter, isDoubleWidthFrame]);

  // Counts for filter badges
  const singleCount = useMemo(
    () => frames.filter((f) => !isDoubleWidthFrame(f)).length,
    [frames, isDoubleWidthFrame]
  );
  const doubleCount = useMemo(
    () => frames.filter((f) => isDoubleWidthFrame(f)).length,
    [frames, isDoubleWidthFrame]
  );

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
  const programmaticTargetRef = useRef<number | null>(null);
  const programmaticTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingFilterScrollRef = useRef<number | null>(null);
  const settleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const momentumAnimationRef = useRef<number | null>(null);
  const wheelCooldownRef = useRef(false);

  // Initial mount guard
  const hasInitializedRef = useRef(false);
  const hasInitialScrolledRef = useRef(false);

  // Fetch frame templates once on component mount
  useEffect(() => {
    let isMounted = true;
    fetchFramesMetadata().then((data) => {
      if (!isMounted) return;
      setFrames(data);
      setLoading(false);

      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        // Determine initial focused index if a frame was already chosen
        if (selectedFrame) {
          const foundIndex = data.findIndex((f) => f.id === selectedFrame.id);
          if (foundIndex !== -1) {
            setFocusedIndex(foundIndex);
          }
        } else if (data.length > 0) {
          setFocusedIndex(0);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, []); // Run ONCE on mount

  // Sync focusedIndex with selectedFrame if selectedFrame is externally updated
  useEffect(() => {
    if (selectedFrame && filteredFrames.length > 0) {
      const idx = filteredFrames.findIndex((f) => f.id === selectedFrame.id);
      if (idx !== -1 && idx !== focusedIndex) {
        setFocusedIndex(idx);
      }
    }
  }, [selectedFrame, filteredFrames]);

  // Cancel any active momentum animation
  const cancelMomentum = useCallback(() => {
    if (momentumAnimationRef.current) {
      cancelAnimationFrame(momentumAnimationRef.current);
      momentumAnimationRef.current = null;
    }
  }, []);

  // Calculate which frame element is currently closest to the carousel center within filtered list bounds
  const getClosestFrameIndex = useCallback(() => {
    const container = carouselRef.current;
    const count = filteredFrames.length;
    if (!container || count === 0) return 0;

    const containerCenter = container.getBoundingClientRect().left + container.offsetWidth / 2;

    let closestIndex = 0;
    let minDiff = Infinity;

    for (let i = 0; i < count; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const itemCenter = rect.left + rect.width / 2;
      const diff = Math.abs(itemCenter - containerCenter);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }

    return closestIndex;
  }, [filteredFrames.length]);

  // Programmatically center a card with smooth animation using accurate getBoundingClientRect delta
  const scrollToIndex = useCallback(
    (index: number, smooth = true) => {
      const container = carouselRef.current;
      const targetEl = itemRefs.current[index];
      if (!container || !targetEl) return;

      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const delta = (targetRect.left + targetRect.width / 2) - (containerRect.left + containerRect.width / 2);
      const targetScrollLeft = Math.max(0, container.scrollLeft + delta);

      if (programmaticTimerRef.current) {
        clearTimeout(programmaticTimerRef.current);
      }
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }

      isProgrammaticScrollRef.current = true;
      programmaticTargetRef.current = index;

      container.scrollTo({
        left: targetScrollLeft,
        behavior: smooth ? 'smooth' : 'auto',
      });
      setFocusedIndex(index);

      // Generous buffer so handleScroll never interrupts smooth scroll before it finishes
      programmaticTimerRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        programmaticTargetRef.current = null;
        setIsScrolling(false);
        isScrollingRef.current = false;
      }, smooth ? 600 : 80);
    },
    []
  );

  // Initial scroll on frames load
  useEffect(() => {
    if (!loading && frames.length > 0 && !hasInitialScrolledRef.current) {
      hasInitialScrolledRef.current = true;
      const targetIdx = selectedFrame
        ? Math.max(0, filteredFrames.findIndex((f) => f.id === selectedFrame.id))
        : 0;
      const timer = setTimeout(() => {
        scrollToIndex(targetIdx !== -1 ? targetIdx : 0, false);
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [loading, frames.length, scrollToIndex, selectedFrame, filteredFrames]);

  // Auto-focus and auto-center the nearest frame when filter changes
  useEffect(() => {
    if (pendingFilterScrollRef.current !== null && filteredFrames.length > 0) {
      const targetIdx = pendingFilterScrollRef.current;
      pendingFilterScrollRef.current = null;

      isProgrammaticScrollRef.current = true;
      programmaticTargetRef.current = targetIdx;

      // Allow DOM to layout the cards, then scroll and focus
      const rafId = requestAnimationFrame(() => {
        scrollToIndex(targetIdx, true);
        const cardEl = itemRefs.current[targetIdx];
        if (cardEl) {
          cardEl.focus({ preventScroll: true });
        }
      });

      return () => cancelAnimationFrame(rafId);
    }
  }, [filteredFrames, scrollToIndex]);

  // Handle filter changes and sync active card (auto select and auto focus nearest frame)
  const handleFilterChange = useCallback(
    (newFilter: FrameFilterType) => {
      if (newFilter === activeFilter) return;
      cancelMomentum();
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }
      if (programmaticTimerRef.current) {
        clearTimeout(programmaticTimerRef.current);
      }

      // Block manual scroll snapping immediately during filter transition
      isProgrammaticScrollRef.current = true;
      setActiveFilter(newFilter);

      let nextList = frames;
      if (newFilter === 'single') {
        nextList = frames.filter((f) => !isDoubleWidthFrame(f));
      } else if (newFilter === 'double') {
        nextList = frames.filter((f) => isDoubleWidthFrame(f));
      }

      if (nextList.length === 0) {
        isProgrammaticScrollRef.current = false;
        return;
      }

      // Determine closest relevant candidate in new list
      const candidateId = selectedFrame?.id || filteredFrames[focusedIndex]?.id;
      const foundIdx = candidateId ? nextList.findIndex((f) => f.id === candidateId) : -1;
      const targetIdx = foundIdx !== -1 ? foundIdx : 0;

      programmaticTargetRef.current = targetIdx;
      setFocusedIndex(targetIdx);

      // Schedule auto-scroll and auto-focus for the nearest frame on next layout frame
      pendingFilterScrollRef.current = targetIdx;
    },
    [activeFilter, cancelMomentum, frames, isDoubleWidthFrame, selectedFrame, focusedIndex, filteredFrames]
  );

  // Auto-snap and update visual center card when scrolling has completely stopped
  const snapToSettledFrame = useCallback(() => {
    // If programmatic scroll, dragging, or empty, never override
    if (isPointerDownRef.current || isProgrammaticScrollRef.current || filteredFrames.length === 0) {
      setIsScrolling(false);
      isScrollingRef.current = false;
      return;
    }
    const finalTarget = getClosestFrameIndex();
    if (finalTarget >= 0 && finalTarget < filteredFrames.length) {
      if (finalTarget !== focusedIndex) {
        setFocusedIndex(finalTarget);
      }

      // Gentle alignment only if noticeably miscentered (does not cause endless bounce)
      const container = carouselRef.current;
      const targetEl = itemRefs.current[finalTarget];
      if (container && targetEl) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const delta = (targetRect.left + targetRect.width / 2) - (containerRect.left + containerRect.width / 2);
        if (Math.abs(delta) > 8) {
          isProgrammaticScrollRef.current = true;
          container.scrollTo({
            left: Math.max(0, container.scrollLeft + delta),
            behavior: 'smooth',
          });
          setTimeout(() => {
            isProgrammaticScrollRef.current = false;
          }, 250);
        }
      }
    }
    setIsScrolling(false);
    isScrollingRef.current = false;
  }, [getClosestFrameIndex, filteredFrames.length, focusedIndex]);

  // Pure fluid scrolling with instantaneous auto-snap when scroll stops
  const handleScroll = useCallback(() => {
    // If this is a programmatic scroll (card click, arrow button, filter switch), don't trigger intermediate snaps
    if (isProgrammaticScrollRef.current) {
      return;
    }

    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
      setIsScrolling(true);
    }

    // Reset settle timer on every scroll frame
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
    }

    // Automatically align to the nearest centered frame once scrolling ceases
    settleTimeoutRef.current = setTimeout(() => {
      if (!isPointerDownRef.current && !isProgrammaticScrollRef.current) {
        snapToSettledFrame();
      }
    }, 150);
  }, [snapToSettledFrame]);

  // Listen for native scrollend event where supported for instant snapping
  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;

    const onScrollEnd = () => {
      if (isPointerDownRef.current || isProgrammaticScrollRef.current) return;
      snapToSettledFrame();
    };

    container.addEventListener('scrollend', onScrollEnd);
    return () => {
      container.removeEventListener('scrollend', onScrollEnd);
    };
  }, [snapToSettledFrame]);

  // Next and Prev buttons: glide focus to adjacent card
  const handleNext = useCallback(() => {
    cancelMomentum();
    const nextIndex = Math.min(filteredFrames.length - 1, focusedIndex + 1);
    if (nextIndex !== focusedIndex) {
      setIsScrolling(false);
      isScrollingRef.current = false;
      setFocusedIndex(nextIndex);
      scrollToIndex(nextIndex, true);
    }
  }, [focusedIndex, filteredFrames.length, scrollToIndex, cancelMomentum]);

  const handlePrev = useCallback(() => {
    cancelMomentum();
    const prevIndex = Math.max(0, focusedIndex - 1);
    if (prevIndex !== focusedIndex) {
      setIsScrolling(false);
      isScrollingRef.current = false;
      setFocusedIndex(prevIndex);
      scrollToIndex(prevIndex, true);
    }
  }, [focusedIndex, scrollToIndex, cancelMomentum]);

  // Keyboard navigation (Left / Right / Enter / Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || filteredFrames.length === 0) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (filteredFrames[focusedIndex]) {
          handleSelectFrame(filteredFrames[focusedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, filteredFrames, loading, handlePrev, handleNext]);

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

      // If user did not drag/move (pure click), do NOT snap! The card's onClick handles selection without bounce
      if (!hasMovedRef.current) {
        return;
      }

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
        // Slow release after dragging: commit selection and snap
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

  const handleTouchStart = () => {
    cancelMomentum();
    isPointerDownRef.current = true;
    hasMovedRef.current = false;
  };

  const handleTouchEnd = () => {
    isPointerDownRef.current = false;
    // Let natural inertia scroll smoothly; handleScroll will align center once momentum ends
  };

  const handleSelectFrame = (frame: FrameMetadata) => {
    setSelectedFrame(frame);
    setCapturedPhotos([]);
    setRetakeIndex(null);

    // Eagerly persist to IndexedDB active session
    try {
      db.activeSession.put({
        id: 'current_active_session',
        selectedFrame: frame,
        capturedPhotos: [],
        retakeIndex: null,
        finalLayoutBase64: null,
        doubleStripBase64: null,
        selectedFilter: 'original',
        customCaption: 'SOREAJA — Pose',
        showFrameStamps: true,
        placedStickers: [],
        updatedAt: Date.now(),
      }).catch(() => { });
    } catch {
      // ignore storage errors
    }

    navigate('/app/camera');
  };

  const handleCardClick = (frame: FrameMetadata, index: number) => {
    // If user was actively dragging or swiping the carousel, do not trigger click selection
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      return;
    }

    cancelMomentum();
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
    }
    if (programmaticTimerRef.current) {
      clearTimeout(programmaticTimerRef.current);
    }

    isScrollingRef.current = false;
    setIsScrolling(false);

    // If card was already focused, clicking it confirms and advances to camera
    if (index === focusedIndex) {
      handleSelectFrame(frame);
      return;
    }

    // Otherwise glide to focus and center it
    setFocusedIndex(index);
    scrollToIndex(index, true);
  };

  return (
    <div className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-2 sm:py-3 flex flex-col justify-between select-none h-full overflow-hidden">
      {/* Top Header with Compact Layout Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2 border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div>
            <div className="text-xs font-mono-tabular text-zinc-400 flex items-center gap-2 mb-0.5">
              <span className="text-[var(--theme-accent,#E11D48)] font-bold">{t.frameSelect.stageBadge}</span>
              <span aria-hidden="true">·</span>
              <span>🖼️ {t.frameSelect.title}</span>
              <span aria-hidden="true">·</span>
              <span>{filteredFrames.length} {t.frameSelect.framesAvailable}</span>
            </div>
            <h1 className="font-display text-base sm:text-lg md:text-xl font-extrabold text-[#F4F4F0] leading-tight">
              {t.frameSelect.title}
            </h1>
          </div>

          {/* Mobile Back to Start button */}
          <button
            type="button"
            onClick={() => navigate('/app/idle')}
            className="md:hidden h-8 px-2.5 py-1 text-xs font-semibold text-zinc-300 bg-zinc-900/90 active:scale-95 hover:bg-zinc-800 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-zinc-800 shadow-sm flex items-center gap-1"
          >
            <span>←</span>
            <span>{t.nav.backToStart}</span>
          </button>
        </div>

        {/* Compact Filter Segmented Control & Desktop Back Button */}
        <div className="flex items-center gap-2">
          {/* Format Filter Pills: All, Single Strip (2x6), Double Strip (Full 4R) */}
          <div
            role="group"
            aria-label="Filter frame format"
            className="inline-flex items-center p-0.5 bg-zinc-900/90 border border-zinc-800/80 rounded-lg shadow-inner text-[11px] sm:text-xs"
          >
            <button
              type="button"
              onClick={() => handleFilterChange('all')}
              className={`h-7 sm:h-7.5 px-2 sm:px-2.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap ${activeFilter === 'all'
                ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-sm font-bold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
            >
              <span>{t.frameSelect.filterAll}</span>
              <span
                className={`text-[9px] sm:text-[10px] font-mono-tabular px-1 sm:px-1.5 py-0.2 rounded-full ${activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
              >
                {frames.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleFilterChange('single')}
              className={`h-7 sm:h-7.5 px-2 sm:px-2.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap ${activeFilter === 'single'
                ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-sm font-bold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
            >
              <span className="text-[11px]">📱</span>
              <span>{t.frameSelect.filterSingleStrip}</span>
              <span
                className={`text-[9px] sm:text-[10px] font-mono-tabular px-1 sm:px-1.5 py-0.2 rounded-full ${activeFilter === 'single' ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
              >
                {singleCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleFilterChange('double')}
              className={`h-7 sm:h-7.5 px-2 sm:px-2.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap ${activeFilter === 'double'
                ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-sm font-bold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
            >
              <span className="text-[11px]">👥</span>
              <span>{t.frameSelect.filterDoubleStrip}</span>
              <span
                className={`text-[9px] sm:text-[10px] font-mono-tabular px-1 sm:px-1.5 py-0.2 rounded-full ${activeFilter === 'double' ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
              >
                {doubleCount}
              </span>
            </button>
          </div>

          {/* Desktop Back button */}
          <button
            type="button"
            onClick={() => navigate('/app/idle')}
            className="hidden md:flex h-7 sm:h-7.5 px-2.5 sm:px-3 text-xs font-semibold text-zinc-300 bg-zinc-900/90 active:scale-95 hover:bg-zinc-800 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-zinc-800 shadow-sm items-center gap-1"
          >
            <span>←</span>
            <span>{t.nav.backToStart}</span>
          </button>
        </div>
      </div>

      {/* Swipeable Carousel Area with Lightweight 60+ FPS Scroll */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-3 border-[var(--theme-accent,#E11D48)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-mono-tabular text-zinc-400">{t.frameSelect.loadingFrames}</p>
          </div>
        </div>
      ) : filteredFrames.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-zinc-300 font-semibold mb-3">Tidak ada template bingkai untuk kategori ini.</p>
          <button
            type="button"
            onClick={() => handleFilterChange('all')}
            className="px-4 py-2 bg-[var(--theme-accent,#E11D48)] text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            {t.frameSelect.filterAll}
          </button>
        </div>
      ) : (
        <div className="relative flex-1 min-h-0 w-full flex flex-col justify-center py-1 sm:py-2 my-auto overflow-hidden">
          {/* Side Navigation Arrow Buttons - Pressing Next / Prev glides visual focus */}
          <button
            type="button"
            onClick={handlePrev}
            disabled={focusedIndex === 0}
            aria-label={t.frameSelect.prevFrame || 'Previous frame'}
            className={`absolute left-1 sm:left-3 md:left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 border shadow-2xl backdrop-blur-md cursor-pointer ${focusedIndex === 0
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
            disabled={focusedIndex === filteredFrames.length - 1}
            aria-label={t.frameSelect.nextFrame || 'Next frame'}
            className={`absolute right-1 sm:right-3 md:right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 border shadow-2xl backdrop-blur-md cursor-pointer ${focusedIndex === filteredFrames.length - 1
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
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorX: 'contain',
              willChange: 'scroll-position',
            }}
            className="w-full relative flex items-center gap-4 sm:gap-6 md:gap-8 overflow-x-auto py-2 sm:py-3 px-[calc(50vw-120px)] sm:px-[calc(50vw-145px)] md:px-[calc(50vw-160px)] lg:px-[calc(50%-160px)] touch-pan-x focus:outline-none cursor-grab active:cursor-grabbing"
            tabIndex={0}
            role="region"
            aria-label="Frame Templates Carousel"
          >
            {filteredFrames.map((frame, index) => {
              const isFocused = index === focusedIndex;
              const isSelected = selectedFrame ? selectedFrame.id === frame.id : isFocused;
              const isDoubleWidth = isDoubleWidthFrame(frame);

              return (
                <div
                  key={frame.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                    if (index === filteredFrames.length - 1) {
                      itemRefs.current.length = filteredFrames.length;
                    }
                  }}
                  onClick={() => handleCardClick(frame, index)}
                  role="button"
                  tabIndex={0}
                  aria-selected={isFocused}
                  aria-label={`${frame.name}, ${frame.photoCount} ${t.frameSelect.poses}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCardClick(frame, index);
                    }
                  }}
                  className={`w-[220px] sm:w-[250px] md:w-[280px] max-h-[58vh] shrink-0 rounded-2xl flex flex-col justify-between p-3 sm:p-3.5 select-none border transform-gpu outline-none focus-visible:ring-4 focus-visible:ring-[var(--theme-accent,#E11D48)]/60 transition-[transform,opacity,border-color,box-shadow] duration-500 ease-out will-change-[transform,opacity] ${isFocused
                    ? 'scale-100 opacity-100 bg-zinc-900 border-[var(--theme-accent,#E11D48)] ring-2 ring-[var(--theme-accent,#E11D48)]/40 shadow-[0_16px_40px_rgba(0,0,0,0.8),0_0_25px_rgba(225,29,72,0.3)] z-10'
                    : 'scale-[0.94] opacity-65 hover:opacity-85 bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700/80 cursor-pointer z-0'
                    }`}
                >
                  {/* Top Metadata: Poses count, Strip Format Badge & Active indicator */}
                  <div className="flex items-center justify-between pb-1.5 text-[11px] font-mono-tabular text-zinc-400 shrink-0 gap-1.5">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="font-bold text-white bg-black/60 px-2 py-0.5 rounded border border-white/10 shadow-sm shrink-0">
                        {frame.photoCount} {t.frameSelect.poses}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${isDoubleWidth
                          ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
                          : 'text-sky-300 bg-sky-500/15 border-sky-500/30'
                          }`}
                      >
                        {isDoubleWidth ? `👥 ${t.frameSelect.doubleStripBadge}` : `📱 ${t.frameSelect.singleStripBadge}`}
                      </span>
                    </div>

                    {isFocused || isSelected ? (
                      <span className="text-[10px] font-bold text-[var(--theme-accent,#E11D48)] bg-[var(--theme-accent,#E11D48)]/10 px-2 py-0.5 rounded border border-[var(--theme-accent,#E11D48)]/30 shrink-0">
                        ✓ ACTIVE
                      </span>
                    ) : (
                      <span className="text-zinc-500 text-[10px] shrink-0">
                        {frame.canvasWidth || 500}×{frame.canvasHeight || 1220}
                      </span>
                    )}
                  </div>

                  {/* Frame Preview Container: Uncropped, completely visible vertical strip */}
                  <div className="w-full bg-zinc-950/90 rounded-xl p-2 flex items-center justify-center border border-zinc-800/80 shadow-inner relative group flex-1 min-h-[220px] max-h-[44vh] overflow-hidden">
                    <img
                      src={frame.previewImg}
                      alt={`Pratinjau ${frame.name}`}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className={`h-full w-auto max-h-[42vh] max-w-full object-contain pointer-events-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] transform-gpu transition-transform duration-500 transition-all ${isFocused ? 'rotate-[-7deg]' : ''}`}
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

                  {/* Action CTA: Explicitly Select and Navigate Immediately */}
                  <div className="pt-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectFrame(frame);
                      }}
                      className={`w-full min-h-[42px] py-2 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap shadow-lg flex items-center justify-center gap-2 cursor-pointer ${isFocused || isSelected
                        ? 'bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] text-white shadow-[0_0_20px_rgba(225,29,72,0.4)] ring-2 ring-[var(--theme-accent,#E11D48)]/50 active:scale-[0.98]'
                        : 'bg-zinc-800/90 hover:bg-[var(--theme-accent,#E11D48)] text-zinc-300 hover:text-white border border-zinc-700/80 active:scale-[0.98]'
                        }`}
                    >
                      <span>{t.frameSelect.selectAction}</span>
                      <span>📸</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dot Indicators & Carousel Counter with Immediate Select CTA */}
          <div className="flex flex-col items-center justify-center gap-1.5 pt-1.5 shrink-0">
            <div
              className="flex items-center justify-center gap-1.5 max-w-full overflow-x-hidden px-4"
              role="tablist"
              aria-label="Frame selector pagination"
            >
              {filteredFrames.map((frame, idx) => {
                const isDotActive = idx === focusedIndex;
                return (
                  <button
                    key={frame.id}
                    type="button"
                    role="tab"
                    aria-selected={isDotActive}
                    aria-label={`${frame.name} (${idx + 1} / ${filteredFrames.length})`}
                    onClick={() => {
                      setFocusedIndex(idx);
                      scrollToIndex(idx, true);
                    }}
                    className={`transition-all duration-300 rounded-full cursor-pointer shrink-0 ${isDotActive
                      ? 'w-7 sm:w-8 h-2 bg-[var(--theme-accent,#E11D48)] shadow-[0_0_12px_rgba(225,29,72,0.6)]'
                      : 'w-1.5 sm:w-2 h-1.5 sm:h-2 bg-zinc-700 hover:bg-zinc-500'
                      }`}
                  />
                );
              })}
            </div>

            <div className="text-xs font-mono-tabular text-zinc-400 flex items-center justify-center gap-2">
              <span className="font-semibold text-zinc-300">
                {focusedIndex + 1} / {filteredFrames.length}
              </span>
              <span aria-hidden="true">·</span>
              <span>{t.frameSelect.swipeHint}</span>
            </div>

            {/* Direct Confirmation Bottom Button */}
            {filteredFrames[focusedIndex] && (
              <button
                type="button"
                onClick={() => handleSelectFrame(filteredFrames[focusedIndex])}
                className="min-h-[40px] px-6 py-1.5 bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] text-white font-bold text-xs sm:text-sm rounded-xl shadow-[0_0_20px_rgba(225,29,72,0.4)] active:scale-95 transition-all cursor-pointer flex items-center gap-2"
              >
                <span>{t.frameSelect.selectAction}: {filteredFrames[focusedIndex].name}</span>
                <span>📸</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

