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
    t,
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
  const [showTools, setShowTools] = useState<boolean>(false);

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
    <div className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-2 sm:px-4 py-1.5 sm:py-2 flex flex-col justify-between select-none h-full overflow-hidden">
      {/* Top Header & Breadcrumb */}
      <div className="flex items-center justify-between text-xs sm:text-sm font-mono-tabular text-zinc-400 pb-1 px-1 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[var(--theme-accent,#E11D48)] font-bold">{t.camera.stageBadge}</span>
          <span aria-hidden="true">·</span>
          <span className="text-zinc-200 font-semibold">{activeFrame.name}</span>
          <span aria-hidden="true">·</span>
          <span className="hidden sm:inline">
            {isRetakeMode
              ? `${t.camera.retakeSlot} #${(retakeIndex ?? 0) + 1}`
              : `${totalShotsNeeded} ${t.camera.posesNeeded}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Tools Toggle Button */}
          <button
            type="button"
            onClick={() => setShowTools((prev) => !prev)}
            aria-expanded={showTools}
            className={`min-h-[40px] px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5 border active:scale-95 ${
              showTools
                ? 'bg-[var(--theme-accent,#E11D48)] text-white border-[var(--theme-accent,#E11D48)]'
                : 'text-zinc-300 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 border-zinc-700/80'
            }`}
          >
            <span>⚙️</span>
            <span>{showTools ? t.camera.closeTools : t.camera.tools}</span>
          </button>

          {/* Back Button */}
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
            className="min-h-[40px] px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white bg-zinc-900/80 active:scale-95 border border-zinc-800 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
          >
            <span>{isRetakeMode ? t.camera.cancelRetake : t.camera.backToFrames}</span>
          </button>
        </div>
      </div>

      {/* Hero Edge-to-Edge Spotlight Viewfinder (Claims maximum available vertical space) */}
      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden py-1">
        {/* Spotlight Stage Viewport with strict 4:3 aspect ratio fitted to available container space */}
        <div
          data-testid="camera-viewfinder"
          className="relative aspect-[4/3] h-full max-h-full max-w-full bg-black rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_0_120px_rgba(0,0,0,0.98),0_0_60px_rgba(225,29,72,0.22)] ring-1 ring-white/20 border border-zinc-800/80 flex items-center justify-center group"
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
          {showCropGuide && (
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
          )}

          {!showCropGuide && showGridLines && (
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
          )}

          {/* Countdown Big Center Overlay (z-30) */}
          {countdown !== null && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none z-30">
              <span className="font-display text-8xl sm:text-[140px] md:text-[180px] font-extrabold text-white tabular-nums drop-shadow-[0_10px_35px_rgba(0,0,0,0.95)] animate-pulse">
                {countdown}
              </span>
              <p className="mt-2 text-sm sm:text-base md:text-lg font-mono-tabular text-zinc-200 uppercase tracking-widest drop-shadow font-bold">
                {t.camera.getReady}
              </p>
            </div>
          )}

          {/* Flash Burst Effect (z-40) */}
          {isFlashing && (
            <div className="absolute inset-0 bg-white animate-flash pointer-events-none z-40" />
          )}

          {/* Minimalist Bottom Bar: Captured Photo List & Shutter Controls (z-20) */}
          <div className="absolute bottom-2.5 sm:bottom-4 left-2.5 sm:left-4 right-2.5 sm:right-4 z-20 flex items-center justify-between gap-2 pointer-events-auto">
            {/* Captured Photos Mini Tray (Kept visible as requested) */}
            <div className="flex items-center gap-1.5 p-1 sm:p-1.5 bg-black/85 backdrop-blur-md border border-white/15 rounded-2xl shadow-2xl">
              {Array.from({ length: totalShotsNeeded }).map((_, idx) => {
                const shotSrc = localShots[idx];
                const isCurrent = !isRetakeMode && idx === currentShotNumber - 1;
                const isTargetRetake = isRetakeMode && retakeIndex === idx;
                return (
                  <div
                    key={idx}
                    className={`w-9 h-9 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl overflow-hidden relative bg-zinc-900/90 flex items-center justify-center transition-all ${
                      isTargetRetake || isCurrent
                        ? 'ring-2 ring-[var(--theme-accent,#E11D48)] shadow-[0_0_15px_rgba(225,29,72,0.6)] scale-105'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {shotSrc ? (
                      <img
                        src={shotSrc}
                        alt={`${t.camera.photoSlot} ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] sm:text-xs font-mono-tabular text-zinc-400 font-bold">
                        #{idx + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Shutter Action Buttons (Kept visible as requested) */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                disabled={isCapturingSequence}
                onClick={startCountdownSequence}
                className="min-h-[50px] sm:min-h-[60px] md:min-h-[64px] px-5 sm:px-8 md:px-10 py-2.5 sm:py-3 text-sm sm:text-base md:text-lg font-extrabold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 disabled:opacity-50 rounded-2xl transition-all whitespace-nowrap cursor-pointer shadow-[0_0_35px_rgba(225,29,72,0.75)] flex items-center gap-2 ring-2 ring-white/20"
              >
                <span className="text-base sm:text-lg">📸</span>
                <span>
                  {isCapturingSequence
                    ? `⏱️ ${countdown ?? '...'}`
                    : isRetakeMode
                    ? `↺ Retake #${(retakeIndex ?? 0) + 1}`
                    : `${t.camera.startSequence} (${settings?.countdownSeconds || 3}s)`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleInstantCapture}
                className="min-h-[50px] sm:min-h-[60px] md:min-h-[64px] px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold text-zinc-200 bg-black/85 hover:bg-zinc-800 active:scale-95 backdrop-blur-md border border-white/15 rounded-2xl transition-all whitespace-nowrap cursor-pointer shadow-xl flex items-center gap-1.5"
                title={t.camera.instantCapture}
              >
                <span>⚡</span>
                <span className="hidden md:inline">{t.camera.instantCapture}</span>
              </button>
            </div>
          </div>

          {/* Toggleable Clean Camera Tools Modal / Drawer (Revealed only when requested) */}
          {showTools && (
            <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md p-4 sm:p-6 flex flex-col justify-between animate-in fade-in duration-200 pointer-events-auto">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>⚙️</span>
                    <span>{t.camera.tools}</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-white/10 rounded-full text-[11px] text-zinc-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{cameraReady ? t.camera.live : t.camera.loading}</span>
                  </span>
                  <span className="hidden sm:inline text-xs font-mono-tabular text-zinc-400">
                    {targetSlot.width}×{targetSlot.height}px
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTools(false)}
                  className="px-3 py-1.5 text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all cursor-pointer border border-zinc-700"
                >
                  ✕ {t.camera.closeTools}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-3 sm:space-y-4">
                {/* Source Selection & Aids */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800 space-y-2">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                      Sumber Kamera:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setUseSimulator(false)}
                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all border ${
                          !useSimulator
                            ? 'bg-[var(--theme-accent,#E11D48)] text-white border-[var(--theme-accent,#E11D48)]'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                      >
                        📷 {t.camera.webRtc}
                      </button>
                      <button
                        type="button"
                        onClick={() => setUseSimulator(true)}
                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all border ${
                          useSimulator
                            ? 'bg-[var(--theme-accent,#E11D48)] text-white border-[var(--theme-accent,#E11D48)]'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                      >
                        🖥️ {t.camera.sim}
                      </button>
                    </div>
                  </div>

                  <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800 space-y-2">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                      Bantuan Framing:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCropGuide((prev) => !prev)}
                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all border ${
                          showCropGuide
                            ? 'bg-[var(--theme-accent,#E11D48)] text-white border-[var(--theme-accent,#E11D48)]'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                      >
                        📐 {t.camera.cropToggle}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowGridLines((prev) => !prev)}
                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all border ${
                          showGridLines
                            ? 'bg-zinc-700 text-white border-zinc-600'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                      >
                        ⊞ {t.camera.gridToggle}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Composition Guide Info */}
                {cropInfo.isCropped && (
                  <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2.5">
                    <span className="text-base leading-none">ℹ️</span>
                    <div>
                      <strong className="text-amber-300 block mb-0.5">{t.camera.compositionGuide}</strong>
                      <p>
                        Bingkai <strong>{activeFrame.name}</strong> ({targetSlot.width}×{targetSlot.height}px). {cropInfo.label}
                      </p>
                    </div>
                  </div>
                )}

                {/* Studio Simulator Pose Picker (only when simulator active) */}
                {useSimulator && (
                  <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800 space-y-2">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                      {t.camera.presetSimulator}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {STUDIO_PORTRAITS.map((pose, idx) => (
                        <button
                          key={pose.id}
                          type="button"
                          onClick={() => setActivePoseIdx(idx)}
                          className={`p-2 text-xs font-mono-tabular rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                            activePoseIdx === idx
                              ? 'bg-white text-zinc-950 font-bold border-white shadow-md scale-102'
                              : 'bg-zinc-950/80 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <img
                            src={pose.src}
                            alt={pose.label}
                            className="w-12 h-12 object-cover rounded-lg"
                          />
                          <span>Pose 0{idx + 1}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowTools(false)}
                  className="px-5 py-2 text-xs sm:text-sm font-bold bg-[var(--theme-accent,#E11D48)] text-white rounded-xl shadow-lg cursor-pointer"
                >
                  ✓ Selesai & Kembali ke Kamera
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
