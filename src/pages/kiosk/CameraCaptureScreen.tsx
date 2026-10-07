import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { usePhotobox } from '../../context/PhotoboxContext';
import { DEFAULT_FRAMES, STUDIO_PORTRAITS } from '../../data/defaultFrames';

export const CameraCaptureScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    selectedFrame,
    setSelectedFrame,
    capturedPhotos,
    setCapturedPhotos,
    retakeIndex,
    setRetakeIndex,
    updatePhotoAtIndex,
  } = usePhotobox();

  const settings = useLiveQuery(() => db.settings.get('app_settings'), []);

  const activeFrame = selectedFrame || DEFAULT_FRAMES[0];
  const isRetakeMode = retakeIndex !== null;
  const totalShotsNeeded = activeFrame.photoCount;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const simulatorImagesRef = useRef<HTMLImageElement[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [useSimulator, setUseSimulator] = useState<boolean>(false);
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [showCropGuide, setShowCropGuide] = useState<boolean>(true);
  const [showGridLines, setShowGridLines] = useState<boolean>(true);
  const [activePoseIdx, setActivePoseIdx] = useState<number>(
    isRetakeMode && retakeIndex !== null ? retakeIndex % STUDIO_PORTRAITS.length : 0
  );
  const [currentShotNumber, setCurrentShotNumber] = useState<number>(
    isRetakeMode && retakeIndex !== null ? retakeIndex + 1 : 1
  );
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [isCapturingSequence, setIsCapturingSequence] = useState<boolean>(false);
  const [localShots, setLocalShots] = useState<string[]>(capturedPhotos);

  // Sync crop guide setting from IndexedDB app settings
  useEffect(() => {
    if (typeof settings?.showCropGuide === 'boolean') {
      setShowCropGuide(settings.showCropGuide);
    }
  }, [settings?.showCropGuide]);

  // Sync localShots when capturedPhotos are restored from IndexedDB
  useEffect(() => {
    setLocalShots(capturedPhotos);
    if (!isRetakeMode && capturedPhotos.length > 0 && capturedPhotos.length < totalShotsNeeded) {
      setCurrentShotNumber(capturedPhotos.length + 1);
      setActivePoseIdx(capturedPhotos.length % STUDIO_PORTRAITS.length);
    }
  }, [capturedPhotos, isRetakeMode, totalShotsNeeded]);

  // Ensure selectedFrame is set in context if user navigated directly
  useEffect(() => {
    if (!selectedFrame) {
      setSelectedFrame(DEFAULT_FRAMES[0]);
    }
  }, [selectedFrame, setSelectedFrame]);

  // Preload studio simulator portrait images
  useEffect(() => {
    const loaded: HTMLImageElement[] = [];
    STUDIO_PORTRAITS.forEach((p, idx) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = p.src;
      img.onload = () => {
        loaded[idx] = img;
        if (idx === 0) setCameraReady(true);
      };
      loaded[idx] = img;
    });
    simulatorImagesRef.current = loaded;
  }, []);

  // Initialize WebRTC or fallback to Studio Simulator
  useEffect(() => {
    let cancelled = false;

    const initCamera = async () => {
      if (settings?.cameraSourceMode === 'simulator') {
        setUseSimulator(true);
        setCameraReady(true);
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setUseSimulator(true);
        setCameraReady(true);
        return;
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 960 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play().catch(() => {});
        }
        setUseSimulator(false);
        setCameraReady(true);
      } catch {
        if (!cancelled) {
          setUseSimulator(true);
          setCameraReady(true);
        }
      }
    };

    initCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [settings?.cameraSourceMode]);

  const captureSinglePhoto = useCallback(
    (shotIndexZeroBased: number): string => {
      const canvas = document.createElement('canvas');
      const width = 800;
      const height = 600;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      const shouldMirror = settings?.mirrorCamera !== false;
      const videoEl = videoRef.current;

      if (
        !useSimulator &&
        videoEl &&
        videoEl.readyState >= 2 &&
        videoEl.videoWidth > 0
      ) {
        ctx.save();
        if (shouldMirror) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }
        const vRatio = videoEl.videoWidth / videoEl.videoHeight;
        const cRatio = width / height;
        let sx = 0,
          sy = 0,
          sw = videoEl.videoWidth,
          sh = videoEl.videoHeight;
        if (vRatio > cRatio) {
          sw = videoEl.videoHeight * cRatio;
          sx = (videoEl.videoWidth - sw) / 2;
        } else {
          sh = videoEl.videoWidth / cRatio;
          sy = (videoEl.videoHeight - sh) / 2;
        }
        ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, width, height);
        ctx.restore();
      } else {
        // Draw from Studio Simulator Portrait
        const poseIndex = shotIndexZeroBased % STUDIO_PORTRAITS.length;
        const simImg = simulatorImagesRef.current[poseIndex];
        if (simImg && simImg.complete && simImg.naturalWidth > 0) {
          const iRatio = simImg.naturalWidth / simImg.naturalHeight;
          const cRatio = width / height;
          let sx = 0,
            sy = 0,
            sw = simImg.naturalWidth,
            sh = simImg.naturalHeight;
          if (iRatio > cRatio) {
            sw = simImg.naturalHeight * cRatio;
            sx = (simImg.naturalWidth - sw) / 2;
          } else {
            sh = simImg.naturalWidth / cRatio;
            sy = (simImg.naturalHeight - sh) / 2;
          }
          ctx.drawImage(simImg, sx, sy, sw, sh, 0, 0, width, height);
        } else {
          // Procedural fallback canvas in case image is still decoding
          ctx.fillStyle = '#27272A';
          ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = '#F4F4F0';
          ctx.font = '700 36px "Syne", sans-serif';
          ctx.fillText(`SOREAJA STUDIO · POSE 0${shotIndexZeroBased + 1}`, 60, 300);
        }
      }

      return canvas.toDataURL('image/png', 0.92);
    },
    [settings?.mirrorCamera, useSimulator]
  );

  // Instant capture handler (captures remaining or retake shot immediately)
  const handleInstantCapture = useCallback(() => {
    setIsCapturingSequence(false);
    setCountdown(null);
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 300);

    if (isRetakeMode && retakeIndex !== null) {
      // Sesuai TSD 4.2.3: Ambil 1 foto, timpa array capturedPhotos pada index tersebut, set retakeIndex kembali null
      const newPhoto = captureSinglePhoto(activePoseIdx);
      updatePhotoAtIndex(retakeIndex, newPhoto);
      setRetakeIndex(null);
      navigate('/app/review-photos');
      return;
    }

    // Loop ambil foto sebanyak photoCount
    const generated: string[] = [];
    for (let i = 0; i < totalShotsNeeded; i++) {
      generated.push(captureSinglePhoto(i));
    }
    setLocalShots(generated);
    setCapturedPhotos(generated);
    navigate('/app/review-photos');
  }, [
    activePoseIdx,
    captureSinglePhoto,
    isRetakeMode,
    navigate,
    retakeIndex,
    setCapturedPhotos,
    setRetakeIndex,
    totalShotsNeeded,
    updatePhotoAtIndex,
  ]);

  // Timed Countdown Capture Sequence (TSD 4.2.3)
  const startCountdownSequence = useCallback(() => {
    if (isCapturingSequence) return;
    setIsCapturingSequence(true);

    const secondsPerShot = settings?.countdownSeconds || 3;

    if (isRetakeMode && retakeIndex !== null) {
      let timer = secondsPerShot;
      setCountdown(timer);
      const interval = setInterval(() => {
        timer -= 1;
        if (timer > 0) {
          setCountdown(timer);
        } else {
          clearInterval(interval);
          setCountdown(null);
          setIsFlashing(true);
          setTimeout(() => setIsFlashing(false), 300);
          const newPhoto = captureSinglePhoto(activePoseIdx);
          updatePhotoAtIndex(retakeIndex, newPhoto);
          setRetakeIndex(null);
          setIsCapturingSequence(false);
          navigate('/app/review-photos');
        }
      }, 900);
      return;
    }

    // Full multi-shot loop
    const accumulated: string[] = [];
    let currentIdx = 0;

    const runNextShot = () => {
      setCurrentShotNumber(currentIdx + 1);
      setActivePoseIdx(currentIdx % STUDIO_PORTRAITS.length);
      let timer = secondsPerShot;
      setCountdown(timer);

      const interval = setInterval(() => {
        timer -= 1;
        if (timer > 0) {
          setCountdown(timer);
        } else {
          clearInterval(interval);
          setCountdown(null);
          setIsFlashing(true);
          setTimeout(() => setIsFlashing(false), 300);

          const snap = captureSinglePhoto(currentIdx);
          accumulated.push(snap);
          const currentShots = [...accumulated];
          setLocalShots(currentShots);
          setCapturedPhotos(currentShots);

          currentIdx += 1;
          if (currentIdx < totalShotsNeeded) {
            setTimeout(runNextShot, 600);
          } else {
            setIsCapturingSequence(false);
            setTimeout(() => {
              navigate('/app/review-photos');
            }, 450);
          }
        }
      }, 900);
    };

    runNextShot();
  }, [
    activePoseIdx,
    captureSinglePhoto,
    isCapturingSequence,
    isRetakeMode,
    navigate,
    retakeIndex,
    setCapturedPhotos,
    setRetakeIndex,
    settings?.countdownSeconds,
    totalShotsNeeded,
    updatePhotoAtIndex,
  ]);

  const currentPortrait =
    STUDIO_PORTRAITS[activePoseIdx % STUDIO_PORTRAITS.length] || STUDIO_PORTRAITS[0];

  const activeSlotIndex =
    isRetakeMode && retakeIndex !== null
      ? retakeIndex
      : Math.min(localShots.length, totalShotsNeeded - 1);

  const targetSlot =
    activeFrame.positions[activeSlotIndex] ||
    activeFrame.positions[0] || {
      x: 0,
      y: 0,
      width: 400,
      height: 300,
    };

  const cameraAspect = 4 / 3;
  const slotAspect = targetSlot.width / targetSlot.height;

  const cropInfo = useMemo(() => {
    const diff = slotAspect - cameraAspect;
    if (diff < -0.015) {
      // Slot is narrower / more square than 4:3 (e.g. 500x480 = 1.04:1 vs 1.33:1)
      const widthPercent = (slotAspect / cameraAspect) * 100;
      const sidePercent = Math.max(0, (100 - widthPercent) / 2);
      return {
        isCropped: true,
        type: 'sides' as const,
        leftPercent: sidePercent,
        topPercent: 0,
        widthPercent: widthPercent,
        heightPercent: 100,
        croppedSidePercent: sidePercent,
        slotAspect,
        cameraAspect,
        label: `Sisi kiri & kanan (${Math.round(sidePercent * 2)}% total) akan terpotong pada bingkai`,
      };
    } else if (diff > 0.015) {
      // Slot is wider than 4:3 (e.g. 380x265 = 1.43:1 vs 1.33:1)
      const heightPercent = (cameraAspect / slotAspect) * 100;
      const topPercent = Math.max(0, (100 - heightPercent) / 2);
      return {
        isCropped: true,
        type: 'topBottom' as const,
        leftPercent: 0,
        topPercent: topPercent,
        widthPercent: 100,
        heightPercent: heightPercent,
        croppedSidePercent: topPercent,
        slotAspect,
        cameraAspect,
        label: `Sisi atas & bawah (${Math.round(topPercent * 2)}% total) akan terpotong pada bingkai`,
      };
    } else {
      return {
        isCropped: false,
        type: 'none' as const,
        leftPercent: 0,
        topPercent: 0,
        widthPercent: 100,
        heightPercent: 100,
        croppedSidePercent: 0,
        slotAspect,
        cameraAspect,
        label: 'Pas sempurna dengan rasio kamera (4:3)',
      };
    }
  }, [slotAspect, cameraAspect]);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 md:px-10 py-6 flex flex-col justify-between gap-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="text-xs font-mono-tabular text-zinc-400 flex items-center gap-2 mb-1">
            <span>Tahap 03 dari 06</span>
            <span aria-hidden="true">·</span>
            <span>Bingkai: {activeFrame.name}</span>
            <span aria-hidden="true">·</span>
            <span>
              {isRetakeMode
                ? `Mode Retake Foto #${(retakeIndex ?? 0) + 1}`
                : `Target: ${totalShotsNeeded} Pose`}
            </span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-[#F4F4F0]">
            {isRetakeMode
              ? `Ulangi Pengambilan Foto #${(retakeIndex ?? 0) + 1}`
              : `Sesi Pemotretan Studio (${currentShotNumber} / ${totalShotsNeeded})`}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setUseSimulator((prev) => !prev)}
            className="px-3.5 py-2 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {useSimulator ? 'Mode: Simulator Studio' : 'Mode: Kamera WebRTC'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (isRetakeMode) {
                setRetakeIndex(null);
                navigate('/app/review-photos');
              } else {
                navigate('/app/frame-selection');
              }
            }}
            className="px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-white border border-zinc-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {isRetakeMode ? 'Batal Retake' : '← Ganti Bingkai'}
          </button>
        </div>
      </div>

      {/* Main Viewfinder & Shot Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Live Camera / Studio Simulator Viewport */}
        <div className="lg:col-span-8 space-y-4">
          <div
            data-testid="camera-viewfinder"
            className="relative aspect-[4/3] w-full bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center"
          >
            {/* WebRTC Video Element */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${
                useSimulator ? 'hidden' : 'block'
              } ${settings?.mirrorCamera !== false ? 'scale-x-[-1]' : ''}`}
            />

            {/* Studio Camera Simulator Fallback */}
            {useSimulator && (
              <img
                src={currentPortrait.src}
                alt={currentPortrait.label}
                referrerPolicy="no-referrer"
                className={`w-full h-full object-cover transition-all duration-300 ${
                  settings?.mirrorCamera !== false ? 'scale-x-[-1]' : ''
                }`}
              />
            )}

            {/* Dynamic Crop Guide Mask & Framing Overlay */}
            {showCropGuide ? (
              <div className="absolute inset-0 pointer-events-none z-10">
                {/* Left & Right Cropped Area Dark Masks */}
                {cropInfo.type === 'sides' && (
                  <>
                    <div
                      className="absolute top-0 bottom-0 left-0 bg-black/70 backdrop-blur-[1px] flex flex-col items-center justify-center border-r-2 border-dashed border-red-500/80 shadow-inner"
                      style={{ width: `${cropInfo.leftPercent}%` }}
                    >
                      <div className="rotate-[-90deg] whitespace-nowrap text-[10px] font-mono tracking-widest text-red-300 font-bold uppercase select-none drop-shadow">
                        ✂ Terpotong
                      </div>
                    </div>
                    <div
                      className="absolute top-0 bottom-0 right-0 bg-black/70 backdrop-blur-[1px] flex flex-col items-center justify-center border-l-2 border-dashed border-red-500/80 shadow-inner"
                      style={{ width: `${cropInfo.leftPercent}%` }}
                    >
                      <div className="rotate-90 whitespace-nowrap text-[10px] font-mono tracking-widest text-red-300 font-bold uppercase select-none drop-shadow">
                        ✂ Terpotong
                      </div>
                    </div>
                  </>
                )}

                {/* Top & Bottom Cropped Area Dark Masks */}
                {cropInfo.type === 'topBottom' && (
                  <>
                    <div
                      className="absolute top-0 left-0 right-0 bg-black/70 backdrop-blur-[1px] flex items-center justify-center border-b-2 border-dashed border-red-500/80 shadow-inner"
                      style={{ height: `${cropInfo.topPercent}%` }}
                    >
                      <span className="text-[10px] font-mono tracking-widest text-red-300 font-bold uppercase select-none drop-shadow">
                        ✂ Area Terpotong Bingkai
                      </span>
                    </div>
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-[1px] flex items-center justify-center border-t-2 border-dashed border-red-500/80 shadow-inner"
                      style={{ height: `${cropInfo.topPercent}%` }}
                    >
                      <span className="text-[10px] font-mono tracking-widest text-red-300 font-bold uppercase select-none drop-shadow">
                        ✂ Area Terpotong Bingkai
                      </span>
                    </div>
                  </>
                )}

                {/* Active Photo Framing Boundary */}
                <div
                  className={`absolute transition-all duration-200 ${
                    cropInfo.isCropped
                      ? 'border-2 border-[var(--theme-accent,#E11D48)] shadow-[0_0_24px_rgba(225,29,72,0.45)]'
                      : 'border-2 border-white/50'
                  }`}
                  style={{
                    left: `${cropInfo.leftPercent}%`,
                    top: `${cropInfo.topPercent}%`,
                    width: `${cropInfo.widthPercent}%`,
                    height: `${cropInfo.heightPercent}%`,
                  }}
                >
                  {/* Studio Viewfinder Corner Brackets */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-[3px] border-l-[3px] border-[var(--theme-accent,#E11D48)] drop-shadow" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-[3px] border-r-[3px] border-[var(--theme-accent,#E11D48)] drop-shadow" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-[3px] border-l-[3px] border-[var(--theme-accent,#E11D48)] drop-shadow" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-[3px] border-r-[3px] border-[var(--theme-accent,#E11D48)] drop-shadow" />

                  {/* Center Crosshair Alignment Mark */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative w-8 h-8 opacity-40">
                      <div className="absolute top-1/2 left-0 right-0 h-px bg-white -translate-y-1/2" />
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white -translate-x-1/2" />
                      <div className="absolute inset-1.5 border border-white rounded-full" />
                    </div>
                  </div>

                  {/* Rule-of-Thirds Grid inside the Active Crop Area */}
                  {showGridLines && (
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20">
                      <div className="border-r border-b border-white" />
                      <div className="border-r border-b border-white" />
                      <div className="border-b border-white" />
                      <div className="border-r border-b border-white" />
                      <div className="border-r border-b border-white" />
                      <div className="border-b border-white" />
                      <div className="border-r border-white" />
                      <div className="border-r border-white" />
                      <div />
                    </div>
                  )}

                  {/* Floating Frame Slot Badge on Bottom */}
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/85 backdrop-blur-xs text-[11px] font-mono-tabular text-white rounded-full border border-white/20 whitespace-nowrap shadow-xl flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--theme-accent,#E11D48)] animate-pulse" />
                    <span>
                      Area Masuk Bingkai: {targetSlot.width}×{targetSlot.height}px ({slotAspect.toFixed(2)}:1)
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Fallback Full Viewfinder Grid if Crop Guide is Toggled Off */
              showGridLines && (
                <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-20">
                  <div className="border-r border-b border-white" />
                  <div className="border-r border-b border-white" />
                  <div className="border-b border-white" />
                  <div className="border-r border-b border-white" />
                  <div className="border-r border-b border-white" />
                  <div className="border-b border-white" />
                  <div className="border-r border-white" />
                  <div className="border-r border-white" />
                  <div />
                </div>
              )
            )}

            {/* Top Viewfinder Status Overlay */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-xs font-mono-tabular text-white bg-black/65 backdrop-blur-xs px-3.5 py-2 rounded-lg z-20">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{cameraReady ? '● LIVE · 800×600 RAW' : 'MEMUAT KAMERA...'}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-zinc-300">
                  SLOT #{activeSlotIndex + 1} ({targetSlot.width}×{targetSlot.height}px)
                </span>
                <span aria-hidden="true" className="text-zinc-500">·</span>
                <span className="text-[var(--theme-accent,#E11D48)] font-bold">
                  {isRetakeMode
                    ? `RETAKE SLOT #${(retakeIndex ?? 0) + 1}`
                    : `POSE ${currentShotNumber} DARI ${totalShotsNeeded}`}
                </span>
              </span>
            </div>

            {/* Countdown Overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center pointer-events-none z-30">
                <span className="font-display text-8xl md:text-9xl font-extrabold text-white tabular-nums drop-shadow-lg">
                  {countdown}
                </span>
                <p className="mt-2 text-sm font-mono-tabular text-zinc-200 uppercase tracking-widest">
                  Siapkan Pose Terbaikmu
                </p>
              </div>
            )}

            {/* Flash Burst Effect */}
            {isFlashing && (
              <div className="absolute inset-0 bg-white animate-flash pointer-events-none z-40" />
            )}
          </div>

          {/* Crop Guide Toolbar & Informational Callout */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCropGuide((prev) => !prev)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                    showCropGuide
                      ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-sm'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <span>📐 Panduan Crop:</span>
                  <span className="font-bold">{showCropGuide ? 'AKTIF' : 'NONAKTIF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowGridLines((prev) => !prev)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                    showGridLines
                      ? 'bg-zinc-800 text-white border border-zinc-600'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>⊞ Grid 3×3:</span>
                  <span>{showGridLines ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              <div className="text-xs font-mono-tabular text-zinc-400 flex items-center gap-2">
                <span>Rasio Bingkai: {targetSlot.width}×{targetSlot.height}px ({slotAspect.toFixed(2)}:1)</span>
                <span aria-hidden="true">·</span>
                <span>Kamera: 4:3 (1.33:1)</span>
              </div>
            </div>

            {/* Dynamic Crop Warning Chip */}
            {cropInfo.isCropped && showCropGuide && (
              <div className="flex items-start gap-2.5 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200">
                <span className="text-amber-400 font-bold shrink-0">ℹ Panduan Komposisi:</span>
                <span>
                  Bingkai <strong>{activeFrame.name}</strong> memiliki ukuran slot <strong>{targetSlot.width} × {targetSlot.height} px</strong>.
                  {" "}{cropInfo.label}. Pastikan seluruh pose dan wajah berada di dalam <strong>kotak garis panduan merah</strong> agar tidak terpotong saat digabungkan ke bingkai akhir.
                </span>
              </div>
            )}
          </div>

          {/* Simulator Pose Selector (helpful when using Studio Simulator) */}
          {useSimulator && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-900/90 border border-zinc-800 rounded-lg p-3">
              <span className="text-xs text-zinc-400">
                Preset Pose Simulator Studio:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {STUDIO_PORTRAITS.map((pose, idx) => (
                  <button
                    key={pose.id}
                    type="button"
                    onClick={() => setActivePoseIdx(idx)}
                    className={`px-3 py-1.5 text-xs font-mono-tabular rounded-md transition-colors cursor-pointer ${
                      activePoseIdx === idx
                        ? 'bg-white text-zinc-950 font-semibold'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    Pose 0{idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controls & Captured Slot Strip */}
        <div className="lg:col-span-4 bg-zinc-900/80 rounded-2xl p-6 space-y-6">
          <div className="space-y-2">
            <h2 className="font-display text-lg font-bold text-[#F4F4F0]">
              Kontrol Pemotretan
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRetakeMode
                ? `Mengambil ulang 1 foto untuk menggantikan Foto #${
                    (retakeIndex ?? 0) + 1
                  }.`
                : `Sistem akan mengambil ${totalShotsNeeded} foto berturut-turut dengan jeda hitung mundur ${
                    settings?.countdownSeconds || 3
                  } detik.`}
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              disabled={isCapturingSequence}
              onClick={startCountdownSequence}
              className="w-full py-4 px-5 text-sm font-semibold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-lg"
            >
              {isCapturingSequence
                ? `Mengambil Foto (${countdown ?? '...'})`
                : isRetakeMode
                ? `Mulai Countdown Retake #${(retakeIndex ?? 0) + 1}`
                : `Mulai Hitung Mundur (${totalShotsNeeded} Foto)`}
            </button>

            <button
              type="button"
              onClick={handleInstantCapture}
              className="w-full py-3 px-4 text-xs font-semibold text-zinc-100 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              {isRetakeMode
                ? `Ambil Instan Foto #${(retakeIndex ?? 0) + 1} (Tanpa Delay)`
                : `Ambil Instan Semua (${totalShotsNeeded} Foto)`}
            </button>
          </div>

          {/* Slot Thumbnails */}
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono-tabular text-zinc-400">
              <span>Slot Bingkai</span>
              <span>
                {localShots.length} / {totalShotsNeeded} Tersimpan
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: totalShotsNeeded }).map((_, idx) => {
                const shotSrc = localShots[idx];
                const isTargetRetake = isRetakeMode && retakeIndex === idx;
                return (
                  <div
                    key={idx}
                    className={`aspect-[4/3] rounded-xl overflow-hidden relative bg-zinc-950 flex items-center justify-center ${
                      isTargetRetake
                        ? 'ring-2 ring-[var(--theme-accent,#E11D48)]'
                        : ''
                    }`}
                  >
                    {shotSrc ? (
                      <img
                        src={shotSrc}
                        alt={`Slot foto ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-mono-tabular text-zinc-600">
                        Foto #{idx + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
