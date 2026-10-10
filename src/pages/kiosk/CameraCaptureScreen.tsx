import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { usePhotobox } from '../../context/PhotoboxContext';
import { DEFAULT_FRAMES, STUDIO_PORTRAITS } from '../../data/defaultFrames';
import { playShutterSound } from '../../services/shutterAudio';

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
    if (settings?.enableShutterSound !== false) {
      playShutterSound();
    }
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
    settings?.enableShutterSound,
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
          if (settings?.enableShutterSound !== false) {
            playShutterSound();
          }
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
          if (settings?.enableShutterSound !== false) {
            playShutterSound();
          }
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
    <div className="flex-1 w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 py-2 flex flex-col justify-between gap-2.5 min-h-[calc(100dvh-4.5rem)] select-none">
      {/* Top Breadcrumb & Minimalist Status */}
      <div className="flex items-center justify-between text-xs sm:text-sm font-mono-tabular text-zinc-400 pb-0.5 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[var(--theme-accent,#E11D48)] font-bold">Tahap 03/06</span>
          <span aria-hidden="true">·</span>
          <span className="text-zinc-200 font-semibold">Bingkai: {activeFrame.name}</span>
          <span aria-hidden="true">·</span>
          <span className="hidden sm:inline">
            {isRetakeMode
              ? `Mode Retake Foto #${(retakeIndex ?? 0) + 1}`
              : `${totalShotsNeeded} Pose Diperlukan`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUseSimulator((prev) => !prev)}
            className="min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-semibold text-zinc-200 bg-zinc-900/90 border border-zinc-700/80 active:scale-95 hover:border-zinc-500 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
          >
            <span>{useSimulator ? '🖥️ Simulator' : '📷 WebRTC'}</span>
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
            className="min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white bg-zinc-900/80 active:scale-95 border border-zinc-800 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1"
          >
            <span>{isRetakeMode ? 'Batal Retake' : '← Ganti Bingkai'}</span>
          </button>
        </div>
      </div>

      {/* Hero Edge-to-Edge Spotlight Viewfinder */}
      <div className="relative w-full flex-1 max-w-6xl mx-auto flex flex-col items-center justify-center">
        {/* Spotlight Stage Viewport */}
        <div
          data-testid="camera-viewfinder"
          className="relative aspect-[4/3] w-full max-h-[66vh] md:max-h-[70vh] lg:max-h-[74vh] bg-black rounded-3xl overflow-hidden shadow-[0_0_120px_rgba(0,0,0,0.98),0_0_60px_rgba(225,29,72,0.22)] ring-1 ring-white/20 border border-zinc-800/80 flex items-center justify-center group"
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

          {/* Cinematic Spotlight Vignette & Radial Beam Overlay */}
          <div
            className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.45)_65%,rgba(0,0,0,0.94)_100%)]"
            aria-hidden="true"
          />
          {/* Atmospheric Spotlight Glow Rim */}
          <div
            className="absolute inset-0 pointer-events-none z-10 shadow-[inset_0_0_80px_rgba(0,0,0,0.85)]"
            aria-hidden="true"
          />

          {/* Dynamic Crop Guide Mask & Framing Overlay */}
          {showCropGuide ? (
            <div className="absolute inset-0 pointer-events-none z-10">
              {/* Left & Right Cropped Area Dark Masks */}
              {cropInfo.type === 'sides' && (
                <>
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-black/75 backdrop-blur-[1px] flex flex-col items-center justify-center border-r-2 border-dashed border-red-500/85 shadow-inner"
                    style={{ width: `${cropInfo.leftPercent}%` }}
                  >
                    <div className="rotate-[-90deg] whitespace-nowrap text-[10px] font-mono tracking-widest text-red-300 font-bold uppercase select-none drop-shadow">
                      ✂ Terpotong
                    </div>
                  </div>
                  <div
                    className="absolute top-0 bottom-0 right-0 bg-black/75 backdrop-blur-[1px] flex flex-col items-center justify-center border-l-2 border-dashed border-red-500/85 shadow-inner"
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
                    className="absolute top-0 left-0 right-0 bg-black/75 backdrop-blur-[1px] flex items-center justify-center border-b-2 border-dashed border-red-500/85 shadow-inner"
                    style={{ height: `${cropInfo.topPercent}%` }}
                  >
                    <span className="text-[10px] font-mono tracking-widest text-red-300 font-bold uppercase select-none drop-shadow">
                      ✂ Area Terpotong Bingkai
                    </span>
                  </div>
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-black/75 backdrop-blur-[1px] flex items-center justify-center border-t-2 border-dashed border-red-500/85 shadow-inner"
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
              </div>
            </div>
          ) : (
            showGridLines && (
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-20 z-10">
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

          {/* Floating Minimalist Top Header (z-20) */}
          <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 flex items-center justify-between text-xs font-mono-tabular text-white z-20 pointer-events-auto">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-black/70 backdrop-blur-md border border-white/10 rounded-full shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold">{cameraReady ? 'LIVE' : 'MEMUAT'}</span>
            </span>

            <div className="flex items-center gap-2 px-4 py-1.5 bg-black/75 backdrop-blur-md border border-white/15 rounded-full shadow-xl">
              <span className="text-[var(--theme-accent,#E11D48)] font-bold text-xs uppercase tracking-wider">
                {isRetakeMode
                  ? `RETAKE SLOT #${(retakeIndex ?? 0) + 1}`
                  : `POSE ${currentShotNumber} / ${totalShotsNeeded}`}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-black/70 backdrop-blur-md border border-white/10 rounded-full text-[11px] text-zinc-300">
              <span>{targetSlot.width}×{targetSlot.height}px</span>
            </div>
          </div>

          {/* Countdown Big Center Overlay (z-30) */}
          {countdown !== null && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none z-30">
              <span className="font-display text-9xl sm:text-[140px] md:text-[180px] font-extrabold text-white tabular-nums drop-shadow-[0_10px_35px_rgba(0,0,0,0.95)] animate-pulse">
                {countdown}
              </span>
              <p className="mt-2 text-base sm:text-lg font-mono-tabular text-zinc-200 uppercase tracking-widest drop-shadow font-bold">
                Siapkan Pose Terbaikmu
              </p>
            </div>
          )}

          {/* Flash Burst Effect (z-40) */}
          {isFlashing && (
            <div className="absolute inset-0 bg-white animate-flash pointer-events-none z-40" />
          )}

          {/* Floating Minimalist Bottom Control Center (z-20) */}
          <div className="absolute bottom-3 sm:bottom-4 md:bottom-5 left-3 sm:left-4 md:left-5 right-3 sm:right-4 md:right-5 z-20 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 pointer-events-auto">
            {/* Captured Photos Floating Mini Tray */}
            <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-black/85 backdrop-blur-md border border-white/15 rounded-2xl shadow-2xl">
              {Array.from({ length: totalShotsNeeded }).map((_, idx) => {
                const shotSrc = localShots[idx];
                const isCurrent = !isRetakeMode && idx === currentShotNumber - 1;
                const isTargetRetake = isRetakeMode && retakeIndex === idx;
                return (
                  <div
                    key={idx}
                    className={`w-11 h-11 sm:w-13 sm:h-13 md:w-16 md:h-16 rounded-xl overflow-hidden relative bg-zinc-900/90 flex items-center justify-center transition-all ${
                      isTargetRetake || isCurrent
                        ? 'ring-2 ring-[var(--theme-accent,#E11D48)] shadow-[0_0_15px_rgba(225,29,72,0.6)] scale-105'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {shotSrc ? (
                      <img
                        src={shotSrc}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[11px] sm:text-xs font-mono-tabular text-zinc-400 font-bold">
                        #{idx + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Spotlight Shutter Action Buttons - Tablet Optimized */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                disabled={isCapturingSequence}
                onClick={startCountdownSequence}
                className="min-h-[58px] sm:min-h-[66px] md:min-h-[72px] px-8 sm:px-12 py-3.5 sm:py-4 text-base sm:text-lg md:text-xl font-extrabold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 disabled:opacity-50 rounded-2xl transition-all whitespace-nowrap cursor-pointer shadow-[0_0_35px_rgba(225,29,72,0.75)] flex items-center gap-3 ring-2 ring-white/20"
              >
                <span className="text-xl sm:text-2xl">📸</span>
                <span>
                  {isCapturingSequence
                    ? `Hitung Mundur (${countdown ?? '...'})`
                    : isRetakeMode
                    ? `Ambil Ulang #${(retakeIndex ?? 0) + 1}`
                    : `Mulai (${settings?.countdownSeconds || 3}s)`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleInstantCapture}
                className="min-h-[58px] sm:min-h-[66px] md:min-h-[72px] px-4 sm:px-6 py-3.5 text-xs sm:text-sm md:text-base font-bold text-zinc-200 bg-black/85 hover:bg-zinc-800 active:scale-95 backdrop-blur-md border border-white/15 rounded-2xl transition-all whitespace-nowrap cursor-pointer shadow-xl flex items-center gap-2"
                title="Ambil foto instan tanpa hitung mundur"
              >
                <span>⚡</span>
                <span className="hidden sm:inline">Instan</span>
              </button>
            </div>

            {/* Quick Floating Toggles - Tablet 48px Touch Targets */}
            <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-black/85 backdrop-blur-md border border-white/15 rounded-2xl shadow-2xl">
              <button
                type="button"
                onClick={() => setShowCropGuide((prev) => !prev)}
                className={`min-h-[48px] min-w-[48px] px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                  showCropGuide
                    ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Toggle Garis Panduan Crop"
              >
                <span>📐</span>
                <span className="hidden md:inline">Crop</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGridLines((prev) => !prev)}
                className={`min-h-[48px] min-w-[48px] px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                  showGridLines
                    ? 'bg-zinc-700 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Toggle Grid Rule of Thirds"
              >
                <span>⊞</span>
                <span className="hidden md:inline">Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Crop Warning Chip below Spotlight */}
        {cropInfo.isCropped && showCropGuide && (
          <div className="mt-3 w-full flex items-center justify-between gap-3 px-4 py-2 bg-zinc-900/90 border border-zinc-800/80 rounded-xl text-xs text-zinc-300">
            <span className="flex items-center gap-2">
              <span className="text-amber-400 font-bold shrink-0">ℹ Panduan Komposisi:</span>
              <span>
                Bingkai <strong>{activeFrame.name}</strong> ({targetSlot.width}×{targetSlot.height}px).
                {" "}{cropInfo.label}. Posisikan wajah di dalam kotak panduan merah.
              </span>
            </span>
            <span className="text-[11px] font-mono-tabular text-zinc-500 shrink-0">
              Slot #{activeSlotIndex + 1}
            </span>
          </div>
        )}

        {/* Studio Simulator Pose Picker */}
        {useSimulator && (
          <div className="mt-2 w-full flex flex-wrap items-center justify-between gap-2 bg-zinc-900/80 border border-zinc-800 rounded-xl p-2.5">
            <span className="text-xs text-zinc-400 pl-1 font-mono-tabular">
              Preset Simulator Studio:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {STUDIO_PORTRAITS.map((pose, idx) => (
                <button
                  key={pose.id}
                  type="button"
                  onClick={() => setActivePoseIdx(idx)}
                  className={`px-2.5 py-1 text-xs font-mono-tabular rounded-lg transition-colors cursor-pointer ${
                    activePoseIdx === idx
                      ? 'bg-white text-zinc-950 font-bold shadow-sm'
                      : 'bg-zinc-800/90 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  Pose 0{idx + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
