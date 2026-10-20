import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { usePhotobox } from '../../context/PhotoboxContext';
import { DEFAULT_FRAMES, STUDIO_PORTRAITS } from '../../data/defaultFrames';
import {
  compositeFinalLayoutBundle,
  checkStripRatio,
  type StripRatioInfo,
} from '../../services/canvasCompositor';
import { downloadSingleFile } from '../../services/downloadService';
import type { PhotoFilter, PlacedSticker } from '../../types/photobox';
import { STICKER_COLLECTION, type StickerItem } from '../../data/stickers';
import { InteractiveStickerCanvas } from '../../components/kiosk/InteractiveStickerCanvas';

const FILTERS: { id: PhotoFilter; label: string; desc: string }[] = [
  { id: 'original', label: 'Original Studio', desc: 'Warna asli tangkapan kamera' },
  { id: 'warm-sore', label: 'Warm Sore', desc: 'Tone keemasan hangat senja' },
  { id: 'noir-bw', label: 'Editorial B&W', desc: 'Monokrom kontras tinggi' },
  { id: 'vintage-film', label: 'Analog 35mm', desc: 'Tone klasik sepia lembut' },
];

export const FinalPreviewScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    selectedFrame,
    setSelectedFrame,
    capturedPhotos,
    setCapturedPhotos,
    finalLayoutBase64,
    setFinalLayoutBase64,
    doubleStripBase64,
    setDoubleStripBase64,
    selectedFilter,
    setSelectedFilter,
    customCaption,
    setCustomCaption,
    showFrameStamps,
    setShowFrameStamps,
    placedStickers,
    setPlacedStickers,
    isHydrated,
    language,
    t,
  } = usePhotobox();

  const [isCompositing, setIsCompositing] = useState<boolean>(!finalLayoutBase64);
  const [previewMode, setPreviewMode] = useState<'single' | 'double'>('single');
  const [showCutLine, setShowCutLine] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'filters' | 'stickers'>('stickers');
  const [activeStickerCategory, setActiveStickerCategory] = useState<'sparkles' | 'hearts_y2k' | 'stamps'>('sparkles');
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [stickerHistory, setStickerHistory] = useState<PlacedSticker[][]>([]);

  // Zoom & Pan state for inspecting strip details
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [baseFitHeight, setBaseFitHeight] = useState<number>(520);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1.0);

  const ZOOM_STEPS = [1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

  // Auto-calibrate base fit height to container dimensions
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateHeight = () => {
      const h = container.clientHeight;
      if (h > 100) {
        setBaseFitHeight(Math.max(340, h - 20));
      }
    };

    updateHeight();
    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const handleZoomIn = () => {
    setZoomLevel((curr) => {
      const next = ZOOM_STEPS.find((s) => s > curr + 0.05);
      return next ?? 3.0;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel((curr) => {
      const prev = [...ZOOM_STEPS].reverse().find((s) => s < curr - 0.05);
      return prev ?? 1.0;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1.0);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  };

  // Drag to pan when zoomed in
  const handlePanMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1.0 || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-sticker-item]')) return;

    isPanningRef.current = true;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: scrollContainerRef.current?.scrollLeft || 0,
      scrollTop: scrollContainerRef.current?.scrollTop || 0,
    };
  };

  const handlePanMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current || !scrollContainerRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    scrollContainerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
    scrollContainerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
  };

  const handlePanMouseUp = () => {
    isPanningRef.current = false;
    setIsPanning(false);
  };

  // Touch 2-finger pinch to zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      initialPinchDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      initialPinchZoomRef.current = zoomLevel;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistRef.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const scaleFactor = currentDist / initialPinchDistRef.current;
      const targetZoom = Math.min(
        3.0,
        Math.max(1.0, Number((initialPinchZoomRef.current * scaleFactor).toFixed(2)))
      );
      setZoomLevel(targetZoom);
    }
  };

  const handleTouchEnd = () => {
    initialPinchDistRef.current = null;
  };

  // Wheel zoom with Ctrl or trackpad pinch
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setZoomLevel((prev) => Math.min(3.0, Math.max(1.0, Number((prev + delta).toFixed(2)))));
    }
  };

  // Double click to toggle between fit and 1.75x zoom
  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-sticker-item]')) return;
    setZoomLevel((prev) => (prev > 1.05 ? 1.0 : 1.75));
  };

  const settings = useLiveQuery(() => db.settings.get('app_settings'), []);
  const activeFrame = selectedFrame || DEFAULT_FRAMES[0];

  const [ratioInfo, setRatioInfo] = useState<StripRatioInfo>(() => {
    const maxRight = Math.max(...activeFrame.positions.map((p) => p.x + p.width));
    const maxBottom = Math.max(...activeFrame.positions.map((p) => p.y + p.height));
    return checkStripRatio(
      activeFrame.canvasWidth || maxRight + 50,
      activeFrame.canvasHeight || maxBottom + 120
    );
  });

  // Ensure fallback photos only after hydration if opened directly without photos
  useEffect(() => {
    if (!isHydrated) return;

    if (!selectedFrame) {
      setSelectedFrame(DEFAULT_FRAMES[0]);
    }
    if (capturedPhotos.length === 0) {
      const count = (selectedFrame || DEFAULT_FRAMES[0]).photoCount;
      setCapturedPhotos(
        Array.from({ length: count }).map(
          (_, i) => STUDIO_PORTRAITS[i % STUDIO_PORTRAITS.length].src
        )
      );
    }
  }, [capturedPhotos.length, isHydrated, selectedFrame, setCapturedPhotos, setSelectedFrame]);

  // Debounced composite run to keep touch interaction silky smooth
  const compositeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isHydrated || capturedPhotos.length === 0) return;

    if (compositeTimeoutRef.current) {
      window.clearTimeout(compositeTimeoutRef.current);
    }

    setIsCompositing(true);

    compositeTimeoutRef.current = window.setTimeout(() => {
      let active = true;
      compositeFinalLayoutBundle(
        capturedPhotos,
        activeFrame,
        selectedFilter,
        customCaption,
        showFrameStamps,
        settings?.themeColor,
        { includeCutLine: showCutLine },
        placedStickers
      ).then((bundle) => {
        if (active) {
          setFinalLayoutBase64(bundle.singleStrip);
          setDoubleStripBase64(bundle.doubleStrip);
          setRatioInfo(bundle.ratioInfo);
          setIsCompositing(false);
        }
      });

      return () => {
        active = false;
      };
    }, 180);

    return () => {
      if (compositeTimeoutRef.current) {
        window.clearTimeout(compositeTimeoutRef.current);
      }
    };
  }, [
    activeFrame,
    capturedPhotos,
    customCaption,
    isHydrated,
    placedStickers,
    selectedFilter,
    setDoubleStripBase64,
    setFinalLayoutBase64,
    settings?.themeColor,
    showCutLine,
    showFrameStamps,
  ]);

  const isVertical = ratioInfo.isVerticalLongStrip;
  const activeDisplayImage =
    isVertical && previewMode === 'double' && doubleStripBase64
      ? doubleStripBase64
      : finalLayoutBase64;

  const handleDownloadActive = () => {
    if (!activeDisplayImage) return;
    const isDouble = isVertical && previewMode === 'double';
    const filename = `PB_${Date.now()}_${isDouble ? 'side_by_side_2strip_cutline' : 'strip_single'}.png`;
    downloadSingleFile(activeDisplayImage, filename);
  };

  // Sticker actions
  const handleAddSticker = (item: StickerItem) => {
    setStickerHistory((prev) => [...prev, placedStickers]);
    const id = `stk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    // Random subtle offset near top/middle
    const randomOffsetX = (Math.random() - 0.5) * 0.25;
    const randomOffsetY = (Math.random() - 0.5) * 0.35;
    const newSticker: PlacedSticker = {
      id,
      stickerId: item.id,
      content: item.content,
      type: item.type,
      x: Math.max(0.2, Math.min(0.8, 0.5 + randomOffsetX)),
      y: Math.max(0.15, Math.min(0.85, 0.45 + randomOffsetY)),
      scale: 1.0,
      rotation: Math.round((Math.random() - 0.5) * 24),
    };

    setPlacedStickers((prev) => [...prev, newSticker]);
    setSelectedStickerId(id);
    if (previewMode !== 'single') {
      setPreviewMode('single');
    }
  };

  const handleUndoSticker = () => {
    if (stickerHistory.length === 0) return;
    const previous = stickerHistory[stickerHistory.length - 1];
    setStickerHistory((prev) => prev.slice(0, prev.length - 1));
    setPlacedStickers(previous);
    setSelectedStickerId(null);
  };

  const handleClearStickers = () => {
    if (placedStickers.length === 0) return;
    setStickerHistory((prev) => [...prev, placedStickers]);
    setPlacedStickers([]);
    setSelectedStickerId(null);
  };

  const handleScaleActive = (delta: number) => {
    if (!selectedStickerId) return;
    setPlacedStickers((prev) =>
      prev.map((s) => {
        if (s.id !== selectedStickerId) return s;
        const scale = Math.max(0.4, Math.min(2.5, Number(((s.scale || 1.0) + delta).toFixed(2))));
        return { ...s, scale };
      })
    );
  };

  const handleRotateActive = (delta: number) => {
    if (!selectedStickerId) return;
    setPlacedStickers((prev) =>
      prev.map((s) => {
        if (s.id !== selectedStickerId) return s;
        let rot = (s.rotation || 0) + delta;
        while (rot > 180) rot -= 360;
        while (rot < -180) rot += 360;
        return { ...s, rotation: rot };
      })
    );
  };

  const handleDeleteActive = () => {
    if (!selectedStickerId) return;
    setStickerHistory((prev) => [...prev, placedStickers]);
    setPlacedStickers((prev) => prev.filter((s) => s.id !== selectedStickerId));
    setSelectedStickerId(null);
  };

  const filteredStickers = STICKER_COLLECTION.filter(
    (item) => item.category === activeStickerCategory
  );

  const selectedSticker = placedStickers.find((s) => s.id === selectedStickerId);

  return (
    <div className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3 flex flex-col justify-between select-none h-full overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2 border-b border-white/5 shrink-0">
        <div>
          <div className="text-xs font-mono-tabular text-zinc-400 flex items-center gap-2 mb-0.5">
            <span className="text-[var(--theme-accent,#E11D48)] font-bold">{t.preview.stageBadge}</span>
            <span aria-hidden="true">·</span>
            <span>🎨 Layout Frame</span>
            <span aria-hidden="true">·</span>
            <span>🖼️ {activeFrame.name}</span>
          </div>
          <h1 className="font-display text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-[#F4F4F0]">
            {t.preview.title}
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5 hidden sm:block">
            {t.preview.subtitle}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/app/review-photos')}
            className="min-h-[40px] px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-zinc-200 bg-zinc-900/90 hover:bg-zinc-800 active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer border border-zinc-800 shadow-sm flex items-center gap-1.5"
            title={t.nav.retake}
          >
            <span>↺</span>
            <span>{t.nav.retake}</span>
          </button>

          <button
            type="button"
            disabled={!activeDisplayImage}
            onClick={handleDownloadActive}
            className="min-h-[40px] px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-zinc-200 bg-zinc-900/90 hover:bg-zinc-800 active:scale-95 disabled:opacity-50 rounded-xl transition-all whitespace-nowrap cursor-pointer border border-zinc-800 shadow-sm flex items-center gap-1.5"
            title={t.preview.download}
          >
            <span>📥</span>
            <span>{t.preview.download}</span>
          </button>

          <button
            type="button"
            disabled={isCompositing || !finalLayoutBase64}
            onClick={() => navigate('/app/print-result')}
            className="min-h-[40px] px-5 py-1.5 text-xs sm:text-sm md:text-base font-extrabold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 disabled:opacity-50 rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-lg flex items-center gap-2"
          >
            <span>{t.preview.continueToPrint}</span>
            <span>🖨️</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 md:gap-5 items-stretch overflow-hidden my-auto py-1">
        {/* Final Composite Preview - Tablet 7 Cols */}
        <div className="md:col-span-7 bg-zinc-900/80 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-between shadow-2xl border border-zinc-800/70 h-full overflow-hidden">
          {/* Top Controls Toolbar: Single/Double Switcher & Zoom Controls */}
          <div className="w-full space-y-2 shrink-0 pb-1">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-950/70 p-1.5 rounded-xl border border-zinc-800">
              {/* Left Side: Frame Format Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {isVertical ? (
                  <div className="flex items-center gap-1.5 p-1 bg-zinc-900 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPreviewMode('single')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        previewMode === 'single'
                          ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      📱 {t.preview.singleStrip}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewMode('double');
                        setSelectedStickerId(null);
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                        previewMode === 'double'
                          ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span>👥 {t.preview.doubleStrip}</span>
                      <span className="text-[10px] px-1 py-0.2 bg-white/20 text-white rounded font-mono">
                        4R
                      </span>
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-mono-tabular text-zinc-400 pl-2">
                    🖼️ {activeFrame.name}
                  </span>
                )}

                {previewMode === 'double' && (
                  <label className="flex items-center gap-1.5 text-xs text-zinc-300 pr-1 cursor-pointer select-none bg-zinc-900/90 px-2 py-1 rounded-lg border border-zinc-800">
                    <input
                      type="checkbox"
                      checked={showCutLine}
                      onChange={(e) => setShowCutLine(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[var(--theme-accent,#E11D48)] rounded cursor-pointer"
                    />
                    <span className="font-semibold text-zinc-200">✂️ {t.preview.cutLine}</span>
                  </label>
                )}
              </div>

              {/* Right Side: Zoom In / Zoom Out / Fit Toolbar */}
              <div
                className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800 text-xs shadow-sm"
                role="toolbar"
                aria-label="Zoom Controls"
              >
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 1.0}
                  title={t.preview.zoomOut}
                  aria-label={t.preview.zoomOut}
                  className="w-7 h-7 flex items-center justify-center rounded font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-all"
                >
                  －
                </button>

                <button
                  type="button"
                  onClick={handleResetZoom}
                  title={t.preview.zoomReset}
                  className="px-2 h-7 flex items-center justify-center rounded font-mono font-bold text-xs text-zinc-200 hover:text-white hover:bg-zinc-800 active:scale-95 cursor-pointer transition-all"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>

                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 3.0}
                  title={t.preview.zoomIn}
                  aria-label={t.preview.zoomIn}
                  className="w-7 h-7 flex items-center justify-center rounded font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-all"
                >
                  ＋
                </button>

                {zoomLevel > 1.0 && (
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    className="px-2 py-1 text-[11px] font-semibold text-[var(--theme-accent,#E11D48)] bg-[var(--theme-accent,#E11D48)]/15 hover:bg-[var(--theme-accent,#E11D48)]/25 rounded border border-[var(--theme-accent,#E11D48)]/30 active:scale-95 cursor-pointer transition-all"
                  >
                    ⛶ {t.preview.zoomReset}
                  </button>
                )}
              </div>
            </div>
          </div>

          {isCompositing && !finalLayoutBase64 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-12">
              <p className="text-sm font-mono-tabular text-zinc-300">
                {t.preview.rendering}
              </p>
              <p className="text-xs text-zinc-500">
                {t.preview.combining}
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-between gap-1 overflow-hidden">
              {/* Scrollable & Zoomable Strip Container */}
              <div
                ref={scrollContainerRef}
                onMouseDown={handlePanMouseDown}
                onMouseMove={handlePanMouseMove}
                onMouseUp={handlePanMouseUp}
                onMouseLeave={handlePanMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onWheel={handleWheel}
                onDoubleClick={handleDoubleClick}
                className="relative flex-1 min-h-0 w-full overflow-auto flex select-none p-2 sm:p-3 custom-scrollbar rounded-xl bg-zinc-950/40"
                style={{
                  cursor: zoomLevel > 1.0 ? (isPanning ? 'grabbing' : 'grab') : 'default',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {/* Scaled Strip Content Centered with CSS Margin Auto */}
                <div
                  className="relative m-auto flex items-center justify-center transition-all duration-150 ease-out"
                  style={{
                    height: zoomLevel === 1.0 ? '100%' : `${Math.round(baseFitHeight * zoomLevel)}px`,
                    maxHeight: zoomLevel === 1.0 ? '100%' : 'none',
                  }}
                >
                  <img
                    data-testid="final-composite-image"
                    src={activeDisplayImage || finalLayoutBase64 || ''}
                    alt={`Hasil Akhir Bingkai ${activeFrame.name}`}
                    className="w-auto max-w-none rounded-xl shadow-2xl block"
                    style={{
                      height: zoomLevel === 1.0 ? '100%' : `${Math.round(baseFitHeight * zoomLevel)}px`,
                      maxHeight: zoomLevel === 1.0 ? 'calc(100vh - 14rem)' : 'none',
                      objectFit: 'contain',
                    }}
                    draggable={false}
                  />

                  {/* Interactive Sticker Studio Layer (only on single strip view for 1:1 precision) */}
                  {previewMode === 'single' && (
                    <InteractiveStickerCanvas
                      stickers={placedStickers}
                      onStickersChange={(newStickers) => setPlacedStickers(newStickers)}
                      selectedStickerId={selectedStickerId}
                      onSelectSticker={(id) => setSelectedStickerId(id)}
                      themeColor={settings?.themeColor}
                      isInteractive={activeTab === 'stickers'}
                    />
                  )}
                </div>

                {/* Floating Scroll & Zoom Guidance Chip when zoomed in */}
                {zoomLevel > 1.0 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none px-3.5 py-1.5 bg-black/85 backdrop-blur-md rounded-full border border-white/20 text-xs text-zinc-200 font-mono-tabular shadow-2xl flex items-center gap-1.5 z-20 animate-in fade-in duration-200">
                    <span className="text-sm">↕️</span>
                    <span className="font-semibold">{t.preview.zoomScrollHint}</span>
                  </div>
                )}
              </div>

              {/* Bottom Footer Info */}
              <div className="flex items-center justify-between w-full px-2 pt-1 text-[11px] font-mono-tabular text-zinc-400 shrink-0">
                <span>
                  {isVertical && previewMode === 'double'
                    ? `${t.preview.formatDouble} (${activeFrame.canvasWidth ? activeFrame.canvasWidth * 2 : 960}×${activeFrame.canvasHeight || 1440}px)`
                    : `${t.preview.formatSingle} (${activeFrame.canvasWidth || 480}×${activeFrame.canvasHeight || 1440}px)`}
                </span>

                <div className="flex items-center gap-3">
                  {placedStickers.length > 0 && (
                    <span className="text-rose-400 font-bold">
                      ✨ {placedStickers.length} {t.preview.tabStickers}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleDownloadActive}
                    className="text-zinc-300 hover:text-white flex items-center gap-1 underline cursor-pointer"
                  >
                    <span>📥 {t.preview.downloadPng}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tone Filter & Sticker Controls - Tablet 5 Cols */}
        <div className="md:col-span-5 bg-zinc-900/80 rounded-2xl p-3 sm:p-4 shadow-xl border border-zinc-800/70 h-full flex flex-col justify-between overflow-hidden">
          {/* Main Mode Tabs Switcher */}
          <div className="grid grid-cols-2 p-1 bg-zinc-950 rounded-xl border border-zinc-800 shrink-0 mb-2">
            <button
              type="button"
              onClick={() => setActiveTab('stickers')}
              className={`py-1.5 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'stickers'
                  ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>✨</span>
              <span>{t.preview.tabStickers}</span>
              {placedStickers.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-white text-zinc-900 text-[10px] font-black flex items-center justify-center ml-1">
                  {placedStickers.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('filters')}
              className={`py-1.5 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'filters'
                  ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>🎨</span>
              <span>{t.preview.tabFilters}</span>
            </button>
          </div>

          {/* Internal scrollable container for tab body */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">

          {/* TAB 1: INTERACTIVE STICKER STUDIO */}
          {activeTab === 'stickers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base sm:text-lg font-bold text-[#F4F4F0] flex items-center gap-2">
                    <span>✨</span>
                    <span>{t.preview.stickerPaletteTitle}</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {t.preview.addStickerHint}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={stickerHistory.length === 0}
                    onClick={handleUndoSticker}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 transition-all cursor-pointer"
                    title={t.preview.undoSticker}
                  >
                    ↩ {t.preview.undoSticker}
                  </button>
                  <button
                    type="button"
                    disabled={placedStickers.length === 0}
                    onClick={handleClearStickers}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 disabled:opacity-40 transition-all cursor-pointer border border-rose-800/40"
                    title={t.preview.clearStickers}
                  >
                    🗑️ {t.preview.clearStickers}
                  </button>
                </div>
              </div>

              {/* Categorized Packs Bar */}
              <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 overflow-x-auto scrollbar-none">
                {[
                  { id: 'sparkles' as const, label: t.preview.stickersCategorySparkles },
                  { id: 'hearts_y2k' as const, label: t.preview.stickersCategoryHearts },
                  { id: 'stamps' as const, label: t.preview.stickersCategoryStamps },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveStickerCategory(cat.id)}
                    className={`flex-1 py-1.5 px-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                      activeStickerCategory === cat.id
                        ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/20'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Sticker Grid Palette */}
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5 p-3 bg-zinc-950/90 rounded-xl border border-zinc-800/70 max-h-[220px] overflow-y-auto">
                {filteredStickers.map((sticker) => (
                  <button
                    key={sticker.id}
                    type="button"
                    onClick={() => handleAddSticker(sticker)}
                    className="aspect-square flex items-center justify-center p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all border border-zinc-800/60 shadow-sm cursor-pointer group"
                    title={`Add ${sticker.label}`}
                  >
                    {sticker.type === 'emoji' ? (
                      <span className="text-2xl sm:text-3xl drop-shadow-sm group-hover:scale-110 transition-transform">
                        {sticker.content}
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase text-center tracking-tight leading-tight text-white/90">
                        {sticker.content}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Interaction Tip or Selected Sticker Controls */}
              {selectedSticker ? (
                <div className="p-3 bg-zinc-950 rounded-xl border border-[var(--theme-accent,#E11D48)]/50 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span>🎯</span>
                      <span>Stiker Terpilih:</span>
                      <span className="text-[var(--theme-accent,#E11D48)]">
                        {selectedSticker.type === 'emoji' ? selectedSticker.content : selectedSticker.content}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedStickerId(null)}
                      className="text-zinc-400 hover:text-white text-xs underline cursor-pointer"
                    >
                      {t.preview.deselectSticker}
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleScaleActive(0.15)}
                      className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold rounded-lg text-white transition-all active:scale-95 cursor-pointer"
                    >
                      {t.preview.scaleUp}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScaleActive(-0.15)}
                      className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold rounded-lg text-white transition-all active:scale-95 cursor-pointer"
                    >
                      {t.preview.scaleDown}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRotateActive(45)}
                      className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold rounded-lg text-white transition-all active:scale-95 cursor-pointer"
                    >
                      {t.preview.rotate}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteActive}
                      className="py-1.5 px-2 bg-rose-900/80 hover:bg-rose-800 text-xs font-bold rounded-lg text-rose-200 transition-all active:scale-95 cursor-pointer"
                    >
                      {t.preview.deleteSticker}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800/60 text-xs text-zinc-400 flex items-start gap-2.5">
                  <span className="text-base">💡</span>
                  <span>{t.preview.dragStickerHint}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TONE FILTERS & CAPTION CONTROLS */}
          {activeTab === 'filters' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <h2 className="font-display text-base sm:text-lg font-bold text-[#F4F4F0] flex items-center gap-2">
                  <span>🎨</span>
                  <span>{t.preview.colorFiltersTitle}</span>
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400">
                  {t.preview.colorFiltersSubtitle}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {[
                    { id: 'original' as const, label: t.preview.filters.original, desc: t.preview.filters.originalDesc },
                    { id: 'warm-sore' as const, label: t.preview.filters.warmSore, desc: t.preview.filters.warmSoreDesc },
                    { id: 'noir-bw' as const, label: t.preview.filters.noirBw, desc: t.preview.filters.noirBwDesc },
                    { id: 'vintage-film' as const, label: t.preview.filters.vintageFilm, desc: t.preview.filters.vintageFilmDesc },
                  ].map((f) => {
                    const isActive = selectedFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedFilter(f.id)}
                        className={`min-h-[52px] p-3.5 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer ${
                          isActive
                            ? 'bg-[var(--theme-accent,#E11D48)]/15 ring-2 ring-[var(--theme-accent,#E11D48)] text-white shadow-md'
                            : 'bg-zinc-950/80 text-zinc-300 hover:bg-zinc-800 border border-zinc-800/60'
                        }`}
                      >
                        <p className="text-xs sm:text-sm font-bold">{f.label}</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">{f.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stempel Teks Bingkai Toggle & Caption */}
              <div className="pt-2 space-y-3 border-t border-zinc-800/60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
                      <span>🏷️</span>
                      <span>{t.preview.frameStampsTitle}</span>
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      {t.preview.frameStampsSubtitle}
                    </p>
                  </div>
                  <label className="min-h-[44px] flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showFrameStamps}
                      onChange={(e) => setShowFrameStamps(e.target.checked)}
                      className="w-4 h-4 accent-[var(--theme-accent,#E11D48)] rounded cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm font-mono-tabular text-zinc-300">
                      {showFrameStamps ? t.preview.showStamp : t.preview.hideStamp}
                    </span>
                  </label>
                </div>

                {showFrameStamps ? (
                  <div className="space-y-1.5 pt-1">
                    <label
                      htmlFor="captionInput"
                      className="block text-xs sm:text-sm font-semibold text-zinc-300"
                    >
                      ✍️ {t.preview.bottomCaptionLabel}
                    </label>
                    <input
                      id="captionInput"
                      type="text"
                      maxLength={32}
                      value={customCaption}
                      onChange={(e) => setCustomCaption(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm sm:text-base bg-zinc-950 rounded-xl text-white focus:outline-none ring-1 ring-zinc-700 focus:ring-[var(--theme-accent,#E11D48)] font-mono-tabular"
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-400 bg-zinc-950/90 p-3 rounded-xl">
                    {t.preview.cleanModeNotice}
                  </p>
                )}
              </div>
            </div>
          )}

          </div>

          {/* Action CTA Buttons */}
          <div className="pt-2 shrink-0 space-y-2 border-t border-white/5">
            <button
              type="button"
              disabled={isCompositing || !finalLayoutBase64}
              onClick={() => navigate('/app/print-result')}
              className="w-full min-h-[46px] py-2.5 px-4 text-xs sm:text-sm font-extrabold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 disabled:opacity-50 rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-lg flex items-center justify-center gap-2"
            >
              <span>{t.preview.continueToPrint}</span>
              <span>🖨️</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/app/review-photos')}
              className="w-full min-h-[40px] py-1.5 px-3 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
            >
              <span>↺</span>
              <span>{t.nav.retake}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
