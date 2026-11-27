import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  GripVertical,
  RotateCcw,
  X,
} from 'lucide-react';
import { usePhotobox } from '../../context/PhotoboxContext';
import { DEFAULT_FRAMES, STUDIO_PORTRAITS } from '../../data/defaultFrames';
import { db } from '../../db';
import { compositeFinalLayout } from '../../services/canvasCompositor';
import { ConfirmActionModal } from '../../components/kiosk/ConfirmActionModal';

export const ReviewPhotosScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    selectedFrame,
    setSelectedFrame,
    capturedPhotos,
    setCapturedPhotos,
    setRetakeIndex,
    setFinalLayoutBase64,
    setDoubleStripBase64,
    selectedFilter,
    customCaption,
    showFrameStamps,
    placedStickers,
    isHydrated,
    t,
  } = usePhotobox();

  const settings = useLiveQuery(() => db.settings.get('app_settings'), []);
  const [viewMode, setViewMode] = useState<'cropped' | 'full'>('cropped');
  const [poseOrder, setPoseOrder] = useState<number[]>(() =>
    capturedPhotos.map((_, i) => i)
  );
  const [swapSourceIndex, setSwapSourceIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [framedPreviewSrc, setFramedPreviewSrc] = useState<string | null>(null);
  const [isUpdatingPreview, setIsUpdatingPreview] = useState<boolean>(false);
  const [isRetakeAllConfirmOpen, setIsRetakeAllConfirmOpen] = useState<boolean>(false);

  const activeFrame = selectedFrame || DEFAULT_FRAMES[0];
  const isRetakingAllRef = useRef<boolean>(false);

  // Ensure valid fallback photos only after hydration if user navigated directly without photos
  useEffect(() => {
    if (!isHydrated || isRetakingAllRef.current) return;

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

  // Keep poseOrder length synchronized with capturedPhotos
  useEffect(() => {
    setPoseOrder((prev) => {
      if (prev.length === capturedPhotos.length) return prev;
      return capturedPhotos.map((_, i) => i);
    });
  }, [capturedPhotos.length]);

  // Live debounced framed preview reflecting current photo order & slot crops
  useEffect(() => {
    if (!isHydrated || capturedPhotos.length === 0) return;

    let isActive = true;
    setIsUpdatingPreview(true);

    const timer = window.setTimeout(() => {
      compositeFinalLayout(
        capturedPhotos,
        activeFrame,
        selectedFilter,
        customCaption,
        showFrameStamps,
        settings?.themeColor,
        placedStickers,
        1.0
      )
        .then((result) => {
          if (isActive) {
            setFramedPreviewSrc(result);
            setIsUpdatingPreview(false);
          }
        })
        .catch(() => {
          if (isActive) {
            setIsUpdatingPreview(false);
          }
        });
    }, 140);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [
    activeFrame,
    capturedPhotos,
    customCaption,
    isHydrated,
    placedStickers,
    selectedFilter,
    settings?.themeColor,
    showFrameStamps,
  ]);

  const hasReordered = poseOrder.some((origIdx, currIdx) => origIdx !== currIdx);

  const applyReorder = (nextPhotos: string[], nextOrder: number[]) => {
    setCapturedPhotos(nextPhotos);
    setPoseOrder(nextOrder);
    setFinalLayoutBase64(null);
    setDoubleStripBase64(null);
    setSwapSourceIndex(null);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const reorderPhoto = (
    fromIndex: number,
    toIndex: number,
    mode: 'swap' | 'move' = 'swap'
  ) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= capturedPhotos.length ||
      toIndex >= capturedPhotos.length
    ) {
      return;
    }

    const nextPhotos = [...capturedPhotos];
    const baseOrder =
      poseOrder.length === capturedPhotos.length
        ? [...poseOrder]
        : capturedPhotos.map((_, i) => i);

    if (mode === 'swap') {
      [nextPhotos[fromIndex], nextPhotos[toIndex]] = [
        nextPhotos[toIndex],
        nextPhotos[fromIndex],
      ];
      [baseOrder[fromIndex], baseOrder[toIndex]] = [
        baseOrder[toIndex],
        baseOrder[fromIndex],
      ];
    } else {
      const [movedPhoto] = nextPhotos.splice(fromIndex, 1);
      const [movedOrder] = baseOrder.splice(fromIndex, 1);
      nextPhotos.splice(toIndex, 0, movedPhoto);
      baseOrder.splice(toIndex, 0, movedOrder);
    }

    applyReorder(nextPhotos, baseOrder);
  };

  const handleResetOrder = () => {
    if (!hasReordered || poseOrder.length !== capturedPhotos.length) return;
    const restoredPhotos = new Array<string>(capturedPhotos.length);
    poseOrder.forEach((origIdx, currIdx) => {
      restoredPhotos[origIdx] = capturedPhotos[currIdx];
    });
    const identityOrder = capturedPhotos.map((_, i) => i);
    applyReorder(restoredPhotos, identityOrder);
  };

  // Sesuai TSD 4.2.4: Klik foto -> Set retakeIndex ke index foto tersebut -> Kembali ke /app/camera
  const handleRetakeSinglePhoto = (index: number) => {
    setSwapSourceIndex(null);
    setRetakeIndex(index);
    navigate('/app/camera');
  };

  const handlePhotoClick = (index: number) => {
    if (swapSourceIndex !== null) {
      if (swapSourceIndex === index) {
        setSwapSourceIndex(null);
      } else {
        reorderPhoto(swapSourceIndex, index, 'swap');
      }
      return;
    }
    handleRetakeSinglePhoto(index);
  };

  const handleToggleSwap = (index: number) => {
    if (swapSourceIndex === null) {
      setSwapSourceIndex(index);
    } else if (swapSourceIndex === index) {
      setSwapSourceIndex(null);
    } else {
      reorderPhoto(swapSourceIndex, index, 'swap');
    }
  };

  const handleRetakeAll = () => {
    isRetakingAllRef.current = true;
    setSwapSourceIndex(null);
    setRetakeIndex(null);
    setCapturedPhotos([]);
    setFinalLayoutBase64(null);
    setDoubleStripBase64(null);
    db.activeSession
      .update('current_active_session', {
        capturedPhotos: [],
        retakeIndex: null,
        finalLayoutBase64: null,
        doubleStripBase64: null,
        updatedAt: Date.now(),
      })
      .catch(() => { });
    navigate('/app/camera');
  };

  const handleFinishReview = () => {
    setSwapSourceIndex(null);
    setRetakeIndex(null);
    navigate('/app/preview-final');
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 space-y-6 md:space-y-8 select-none">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="text-xs sm:text-sm font-mono-tabular text-zinc-400 flex items-center gap-2 mb-1.5">
            <span className="text-[var(--theme-accent,#E11D48)] font-bold">
              {t.review.stageBadge}
            </span>
            <span aria-hidden="true">·</span>
            <span>📸 {t.review.title}</span>
            <span aria-hidden="true">·</span>
            <span>
              👤 {capturedPhotos.length} {t.review.photosReady}
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#F4F4F0]">
            {t.review.title}
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-zinc-400 mt-1">
            {t.review.subtitle}
          </p>
        </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 sm:gap-3">
            {hasReordered && (
              <button
                type="button"
                data-testid="reset-photo-order-btn"
                onClick={handleResetOrder}
                className="min-h-[46px] sm:min-h-[50px] px-4 py-2.5 text-xs sm:text-sm font-semibold text-amber-200 bg-amber-950/60 hover:bg-amber-900/70 active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer border border-amber-700/50 shadow-sm flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t.review.resetOrder}</span>
              </button>
            )}

            <button
              type="button"
              data-testid="review-retake-all-btn"
              onClick={() => setIsRetakeAllConfirmOpen(true)}
              className="min-h-[46px] sm:min-h-[50px] px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold text-zinc-200 bg-zinc-900/90 hover:bg-zinc-800 active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer border border-zinc-800 shadow-sm flex items-center gap-1.5"
            >
              <span>↺</span>
              <span>{t.review.retakeAll}</span>
            </button>

            <button
              type="button"
              onClick={handleFinishReview}
              className="min-h-[46px] sm:min-h-[50px] px-6 sm:px-7 py-2.5 text-xs sm:text-sm md:text-base font-extrabold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-lg flex items-center gap-2"
            >
              <span>{t.review.continueToFrame}</span>
              <span>🎨</span>
            </button>
          </div>
        </div>

        {/* View Mode Toggle Bar - Tablet Optimized */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-3 sm:p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm text-zinc-400 font-medium mr-1">
                👁️ {t.review.viewMode}
              </span>
              <button
                type="button"
                onClick={() => setViewMode('cropped')}
                className={`min-h-[42px] px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${viewMode === 'cropped'
                    ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-sm'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
              >
                <span>📐 {t.review.croppedMode}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('full')}
                className={`min-h-[42px] px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${viewMode === 'full'
                    ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-sm'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
              >
                <span>📷 {t.review.fullMode}</span>
              </button>
            </div>
            <p className="text-xs font-mono-tabular text-zinc-400">
              {viewMode === 'cropped' ? t.review.croppedDesc : t.review.fullDesc}
            </p>
          </div>

              {/* Active Swap Mode Banner */ }
              {
                swapSourceIndex !== null && (
                  <div
                    role="status"
                    data-testid="swap-mode-banner"
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[var(--theme-accent,#E11D48)]/15 border border-[var(--theme-accent,#E11D48)]/50 text-zinc-100 text-xs sm:text-sm shadow-lg"
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <ArrowLeftRight className="w-4 h-4 text-[var(--theme-accent,#E11D48)] shrink-0" />
                      <span>
                        {t.review.swapHint}
                        {swapSourceIndex + 1}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSwapSourceIndex(null)}
                      className="min-h-[36px] px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-zinc-200 border border-zinc-700 cursor-pointer flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>{t.review.cancelSwap}</span>
                    </button>
                  </div>
                )
              }

                    {/* Main Split Layout: Left Reorderable Photo Grid + Right Live Framed Preview */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                      {/* Left: Grid of Captured Photos */}
                      <div className="md:col-span-7 lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                        {capturedPhotos.map((photoSrc, index) => {
                          const slot =
                            activeFrame.positions[index] ||
                            activeFrame.positions[0] || { width: 400, height: 300 };
                          const cameraAspect = 4 / 3;
                          const slotAspect = slot.width / slot.height;
                          const isNarrower = slotAspect < cameraAspect - 0.015;
                          const isWider = slotAspect > cameraAspect + 0.015;
                          const sideCropPercent = isNarrower
                            ? Math.max(0, (100 - (slotAspect / cameraAspect) * 100) / 2)
                            : 0;
                          const topCropPercent = isWider
                            ? Math.max(0, (100 - (cameraAspect / slotAspect) * 100) / 2)
                            : 0;

            const originalShotNumber= (poseOrder[index] ?? index) + 1;
                          const isSwapSource = swapSourceIndex === index;
                          const isSwapTarget = swapSourceIndex !== null && swapSourceIndex !== index;
                          const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                          const isDragged = draggedIndex === index;

                          return (
                            <div
                              key={`slot-${index}`}
                              data-testid={`review-photo-card-${index}`}
                              draggable={capturedPhotos.length > 1}
                              onDragStart={(e) => {
                                setDraggedIndex(index);
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', String(index));
                              }}
                              onDragOver={(e) => {
                                if (draggedIndex === null || draggedIndex === index) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                if (dragOverIndex !== index) {
                                  setDragOverIndex(index);
                                }
                }}
                                  onDragLeave={() => {
                                    if (dragOverIndex === index) {
                                      setDragOverIndex(null);
                                    }
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (draggedIndex !== null && draggedIndex !== index) {
                                      reorderPhoto(draggedIndex, index, 'move');
                                    } else {
                                      setDraggedIndex(null);
                                      setDragOverIndex(null);
                                    }
                                  }}
                                  onDragEnd={() => {
                                    setDraggedIndex(null);
                                    setDragOverIndex(null);
                                  }}
                                  className={`bg-zinc-900/80 hover:bg-zinc-900 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-all shadow-xl border ${isSwapSource
                                      ? 'border-[var(--theme-accent,#E11D48)] ring-2 ring-[var(--theme-accent,#E11D48)]/60'
                                      : isDragTarget
                                        ? 'border-[var(--theme-accent,#E11D48)] ring-2 ring-dashed ring-[var(--theme-accent,#E11D48)]/70 scale-[1.01]'
                                        : isSwapTarget
                                          ? 'border-zinc-700 hover:border-[var(--theme-accent,#E11D48)]/70'
                                          : 'border-zinc-800/80'
                                    } ${isDragged ? 'opacity-50' : ''}`}
              >
                                  <div className="space-y-3">
                                    {/* Card Header: Slot # + Original Pose # + Reorder Buttons */}
                                    <div className="flex items-center justify-between gap-2 text-xs font-mono-tabular text-zinc-400">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <GripVertical
                                          className="w-4 h-4 text-zinc-500 shrink-0 hidden sm:block cursor-grab"
                                          aria-hidden="true"
                                        />
                                        <span className="font-bold text-white whitespace-nowrap">
                                          Slot #{index + 1}
                                        </span>
                                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 whitespace-nowrap">
                                          {t.review.originalShot}0{originalShotNumber}
                                        </span>
                                      </div>

                    {capturedPhotos.length > 1 && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          data-testid={`move-left-btn-${index}`}
                          disabled={index === 0}
                          onClick={() => reorderPhoto(index, index - 1, 'swap')}
                          aria-label={`${t.review.moveLeft} Slot #${index + 1}`}
                          title={t.review.moveLeft}
                          className="w-9 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-zinc-200 flex items-center justify-center transition-all cursor-pointer active:scale-95 border border-zinc-700/70"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          data-testid={`swap-photo-btn-${index}`}
                          onClick={() => handleToggleSwap(index)}
                          aria-label={`${t.review.swapPhoto} Slot #${index + 1}`}
                          aria-pressed={isSwapSource}
                          title={t.review.swapPhoto}
                          className={`h-9 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 border ${
                            isSwapSource
                              ? 'bg-[var(--theme-accent,#E11D48)] text-white border-[var(--theme-accent,#E11D48)] shadow-sm'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700/70'
                          }`}
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          data-testid={`move-right-btn-${index}`}
                          disabled={index === capturedPhotos.length - 1}
                          onClick={() => reorderPhoto(index, index + 1, 'swap')}
                          aria-label={`${t.review.moveRight} Slot #${index + 1}`}
                          title={t.review.moveRight}
                          className="w-9 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-zinc-200 flex items-center justify-center transition-all cursor-pointer active:scale-95 border border-zinc-700/70"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePhotoClick(index)}
                    aria-label={
                      isSwapTarget
                        ? `${t.review.swapPhoto} Slot #${index + 1}`
                        : `Retake Foto Nomor ${index + 1}`
                    }
                    style={
                      viewMode === 'cropped'
                        ? { aspectRatio: `${slot.width} / ${slot.height}` }
                        : undefined
                    }
                    className={`w-full bg-zinc-950 rounded-xl overflow-hidden relative group cursor-pointer block ${
                      viewMode === 'full' ? 'aspect-[4/3]' : ''
                    }`}
                  >
                    {photoSrc ? (
                      <img
                        src={photoSrc}
                        alt={`Hasil tangkapan pose ${index + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs font-mono">
                        Foto kosong
                      </div>
                    )}

                    {/* If Full View Mode: Show Crop Guide Mask Overlay */}
                    {viewMode === 'full' && (isNarrower || isWider) && (
                      <div className="absolute inset-0 pointer-events-none">
                        {isNarrower && (
                          <>
                            <div
                              className="absolute top-0 bottom-0 left-0 bg-black/65 border-r border-dashed border-red-400 flex items-center justify-center"
                              style={{ width: `${sideCropPercent}%` }}
                            >
                              <span className="rotate-[-90deg] text-[9px] text-red-300 font-mono font-bold uppercase">
                                ✂ Potong
                              </span>
                            </div>
                            <div
                              className="absolute top-0 bottom-0 right-0 bg-black/65 border-l border-dashed border-red-400 flex items-center justify-center"
                              style={{ width: `${sideCropPercent}%` }}
                            >
                              <span className="rotate-90 text-[9px] text-red-300 font-mono font-bold uppercase">
                                ✂ Potong
                              </span>
                            </div>
                          </>
                        )}
                        {isWider && (
                          <>
                            <div
                              className="absolute top-0 left-0 right-0 bg-black/65 border-b border-dashed border-red-400 flex items-center justify-center"
                              style={{ height: `${topCropPercent}%` }}
                            >
                              <span className="text-[9px] text-red-300 font-mono font-bold uppercase">
                                ✂ Area Terpotong
                              </span>
                            </div>
                            <div
                              className="absolute bottom-0 left-0 right-0 bg-black/65 border-t border-dashed border-red-400 flex items-center justify-center"
                              style={{ height: `${topCropPercent}%` }}
                            >
                              <span className="text-[9px] text-red-300 font-mono font-bold uppercase">
                                ✂ Area Terpotong
                              </span>
                            </div>
                          </>
                        )}
                        {/* Active Box Outline */}
                        <div
                          className="absolute border-2 border-[var(--theme-accent,#E11D48)]"
                          style={{
                            left: `${sideCropPercent}%`,
                            right: `${sideCropPercent}%`,
                            top: `${topCropPercent}%`,
                            bottom: `${topCropPercent}%`,
                          }}
                        />
                      </div>
                    )}

                    {/* Persistent touch hint overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity bg-black/50 z-10">
                      <span className="px-4 py-2 bg-white text-zinc-950 text-xs sm:text-sm font-bold rounded-xl shadow-lg">
                        {isSwapTarget
                          ? `${t.review.swapPhoto} ↔ Slot #${index + 1}`
                          : `${t.review.tapToRetake} #${index + 1}`}
                      </span>
                    </div>
                  </button>

                                          <div className="text-[11px] font-mono-tabular text-zinc-400 flex items-center justify-between">
                                            <span>
                                              {slot.width}×{slot.height}px · {slotAspect.toFixed(2)}:1
                                            </span>
                                            <span>
                                              {viewMode === 'cropped' ? t.review.croppedMode : t.review.fullMode}
                                            </span>
                                          </div>
                                      </div>

                                      {/* Tablet Touch Friendly Retake Button */}
                                      <button
                                        type="button"
                                        onClick={() => handleRetakeSinglePhoto(index)}
                                        className="w-full min-h-[44px] sm:min-h-[46px] py-2 px-3 text-xs sm:text-sm font-bold text-zinc-100 bg-zinc-800 hover:bg-zinc-700 active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                                      >
                                        <span>↺</span>
                                        <span>
                                          {t.review.retakeSingle} #{index + 1}
                                        </span>
                                      </button>
                                    </div>
                                    );
          })}
                                  </div>

                                  {/* Right: Sticky Live Framed Preview Panel */}
                                  <aside className="md:col-span-5 lg:col-span-4 md:sticky md:top-20 md:self-start md:max-h-[calc(100vh-6rem)] md:overflow-y-auto bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <h2 className="font-display text-base sm:text-lg font-bold text-[#F4F4F0] flex items-center gap-2">
                                          <span>🖼️</span>
                                          <span>{t.review.framedPreviewTitle}</span>
                                        </h2>
                                        <p className="text-xs text-zinc-400 mt-0.5">
                                          {activeFrame.name} · {t.review.framedPreviewSubtitle}
                                        </p>
                                      </div>
                                      {isUpdatingPreview && (
                                        <span className="text-[11px] font-mono-tabular px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 shrink-0 animate-pulse">
                                          {t.review.updatingPreview}
                                        </span>
                                      )}
                                    </div>

                                    <div className="bg-zinc-950 rounded-xl p-3 sm:p-4 flex items-center justify-center min-h-[340px] border border-zinc-800/70">
                                      {framedPreviewSrc ? (
                                        <img
                                          data-testid="review-framed-preview-image"
                                          src={framedPreviewSrc}
                                          alt={`Pratinjau bingkai ${activeFrame.name}`}
                                          className="max-h-[520px] w-auto max-w-full object-contain rounded-lg shadow-2xl transition-opacity duration-150"
                                        />
                                      ) : (
                                        <div className="flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs font-mono-tabular">
                                          <div className="w-8 h-8 border-2 border-[var(--theme-accent,#E11D48)] border-t-transparent rounded-full animate-spin" />
                                          <span>{t.review.updatingPreview}</span>
                                        </div>
                                      )}
                                    </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-mono-tabular text-zinc-400">
                                      {capturedPhotos.map((_, idx) => (
                                        <span
                                          key={`order-chip-${idx}`}
                                          className="px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-300"
                                        >
                                    #{idx + 1}: {t.review.originalShot}0{(poseOrder[idx] ?? idx) + 1}
                                  </span>
            ))}
                                </div>
        </aside>
      </div>

                      {/* Bottom Action Bar - Tablet First Touch Area */}
                      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                        <div className="space-y-1">
                          <p className="text-sm sm:text-base font-bold text-[#F4F4F0] flex items-center gap-1.5">
                            <span>✨</span>
                            <span>{t.review.satisfiedQuestion}</span>
                          </p>
                          <p className="text-xs sm:text-sm text-zinc-400">
                            {capturedPhotos.length} {t.review.combineDesc}{' '}
                            <strong className="text-zinc-200">{activeFrame.name}</strong>.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleFinishReview}
                          className="min-h-[50px] sm:min-h-[54px] px-8 sm:px-10 py-3 text-sm sm:text-base font-extrabold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-lg flex items-center justify-center gap-2 self-stretch sm:self-auto"
                        >
                          <span>{t.review.continueToFrame}</span>
                          <span>🎨</span>
                        </button>
                      </div>

      <ConfirmActionModal
        isOpen={isRetakeAllConfirmOpen}
        title={t.review.retakeAllConfirmTitle}
        message={t.review.retakeAllConfirmDesc}
        confirmLabel={t.review.retakeAllConfirmBtn}
        cancelLabel={t.nav.cancel}
        onConfirm={() => {
          setIsRetakeAllConfirmOpen(false);
          handleRetakeAll();
        }}
        onCancel={() => setIsRetakeAllConfirmOpen(false)}
      />
                    </div>
                    );
};
