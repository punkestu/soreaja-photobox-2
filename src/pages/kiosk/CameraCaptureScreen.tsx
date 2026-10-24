import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { usePhotobox } from '../../context/PhotoboxContext';
import { DEFAULT_FRAMES, STUDIO_PORTRAITS } from '../../data/defaultFrames';
import { playShutterSound } from '../../services/shutterAudio';
import { CropGuideOverlay, type CropInfo } from '../../components/kiosk/camera/CropGuideOverlay';
import { CountdownOverlay } from '../../components/kiosk/camera/CountdownOverlay';
import { PhotoTray } from '../../components/kiosk/camera/PhotoTray';
import { ShutterControls } from '../../components/kiosk/camera/ShutterControls';
import { CameraToolsModal } from '../../components/kiosk/camera/CameraToolsModal';

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Timer tracking to prevent memory leaks and unmounted component updates
  const timeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const intervalIdsRef = useRef<Set<ReturnType<typeof setInterval>>>(new Set());

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

  // Safe timer helpers with automatic tracking
  const safeSetTimeout = useCallback((fn: () => void, delayMs: number) => {
    const id = setTimeout(() => {
      timeoutIdsRef.current.delete(id);
      fn();
    }, delayMs);
    timeoutIdsRef.current.add(id);
    return id;
  }, []);

  const safeSetInterval = useCallback((fn: () => void, intervalMs: number) => {
    const id = setInterval(fn, intervalMs);
    intervalIdsRef.current.add(id);
    return id;
  }, []);

  const clearRegisteredInterval = useCallback((id: ReturnType<typeof setInterval> | null) => {
    if (id !== null) {
      clearInterval(id);
      intervalIdsRef.current.delete(id);
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    timeoutIdsRef.current.forEach((id) => clearTimeout(id));
    timeoutIdsRef.current.clear();
    intervalIdsRef.current.forEach((id) => clearInterval(id));
    intervalIdsRef.current.clear();
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

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

  // Initialize WebRTC or release stream on simulator mode / unmount
  useEffect(() => {
    let cancelled = false;

    // If simulator mode is active, release hardware camera tracks immediately
    if (useSimulator || settings?.cameraSourceMode === 'simulator') {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraReady(true);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setUseSimulator(true);
      setCameraReady(true);
      return;
    }

    const initCamera = async () => {
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
  }, [useSimulator, settings?.cameraSourceMode]);

  // Recycled canvas generator to eliminate DOM allocation overhead
  const getRecycledCanvas = useCallback((width: number, height: number): HTMLCanvasElement => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    return canvas;
  }, []);

  // Capture single photo snapshot with recycled canvas and ultra-fast JPEG encoding
  const captureSinglePhoto = useCallback(
    (shotIndexZeroBased: number): string => {
      const width = 800;
      const height = 600;
      const canvas = getRecycledCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      ctx.clearRect(0, 0, width, height);

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

      // JPEG at 0.92 gives ~5x faster encoding and ~8x smaller base64 payloads
      return canvas.toDataURL('image/jpeg', 0.92);
    },
    [getRecycledCanvas, settings?.mirrorCamera, useSimulator]
  );

  // Instant capture handler (captures remaining or retake shot immediately)
  const handleInstantCapture = useCallback(() => {
    clearAllTimers();
    setIsCapturingSequence(false);
    setCountdown(null);
    setIsFlashing(true);
    if (settings?.enableShutterSound !== false) {
      playShutterSound();
    }
    safeSetTimeout(() => setIsFlashing(false), 300);

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
    clearAllTimers,
    isRetakeMode,
    navigate,
    retakeIndex,
    safeSetTimeout,
    setCapturedPhotos,
    setRetakeIndex,
    settings?.enableShutterSound,
    totalShotsNeeded,
    updatePhotoAtIndex,
  ]);

  // Timed Countdown Capture Sequence (TSD 4.2.3)
  const startCountdownSequence = useCallback(() => {
    if (isCapturingSequence) return;
    clearAllTimers();
    setIsCapturingSequence(true);

    const secondsPerShot = settings?.countdownSeconds || 3;

    if (isRetakeMode && retakeIndex !== null) {
      let timer = secondsPerShot;
      setCountdown(timer);
      let intervalId: ReturnType<typeof setInterval> | null = null;
      intervalId = safeSetInterval(() => {
        timer -= 1;
        if (timer > 0) {
          setCountdown(timer);
        } else {
          clearRegisteredInterval(intervalId);
          setCountdown(null);
          setIsFlashing(true);
          if (settings?.enableShutterSound !== false) {
            playShutterSound();
          }
          safeSetTimeout(() => setIsFlashing(false), 300);
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

      let intervalId: ReturnType<typeof setInterval> | null = null;
      intervalId = safeSetInterval(() => {
        timer -= 1;
        if (timer > 0) {
          setCountdown(timer);
        } else {
          clearRegisteredInterval(intervalId);
          setCountdown(null);
          setIsFlashing(true);
          if (settings?.enableShutterSound !== false) {
            playShutterSound();
          }
          safeSetTimeout(() => setIsFlashing(false), 300);

          const snap = captureSinglePhoto(currentIdx);
          accumulated.push(snap);
          const currentShots = [...accumulated];
          setLocalShots(currentShots);
          setCapturedPhotos(currentShots);

          currentIdx += 1;
          if (currentIdx < totalShotsNeeded) {
            safeSetTimeout(runNextShot, 600);
          } else {
            setIsCapturingSequence(false);
            safeSetTimeout(() => {
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
    clearAllTimers,
    clearRegisteredInterval,
    isCapturingSequence,
    isRetakeMode,
    navigate,
    retakeIndex,
    safeSetInterval,
    safeSetTimeout,
    setCapturedPhotos,
    setRetakeIndex,
    settings?.countdownSeconds,
    settings?.enableShutterSound,
    totalShotsNeeded,
    updatePhotoAtIndex,
  ]);

  // Clean back navigation handler with full timer cancellation
  const handleBack = useCallback(() => {
    clearAllTimers();
    setIsCapturingSequence(false);
    setCountdown(null);
    if (isRetakeMode) {
      setRetakeIndex(null);
      navigate('/app/review-photos');
    } else {
      navigate('/app/frame-selection');
    }
  }, [clearAllTimers, isRetakeMode, navigate, setRetakeIndex]);

  // Keyboard shortcut for kiosk operation (Space/Enter to trigger, Esc to close tools)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!isCapturingSequence && !showTools) {
          startCountdownSequence();
        }
      } else if (e.code === 'Escape' && showTools) {
        e.preventDefault();
        setShowTools(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCapturingSequence, showTools, startCountdownSequence]);

  const currentPortrait =
    STUDIO_PORTRAITS[activePoseIdx % STUDIO_PORTRAITS.length] || STUDIO_PORTRAITS[0];

  const activeSlotIndex = useMemo(() => {
    if (isRetakeMode && retakeIndex !== null) return retakeIndex;
    return Math.min(localShots.length, totalShotsNeeded - 1);
  }, [isRetakeMode, retakeIndex, localShots.length, totalShotsNeeded]);

  const targetSlot = useMemo(() => {
    return (
      activeFrame.positions[activeSlotIndex] ||
      activeFrame.positions[0] || {
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      }
    );
  }, [activeFrame, activeSlotIndex]);

  const cameraAspect = 4 / 3;
  const slotAspect = targetSlot.width / targetSlot.height;

  const cropInfo: CropInfo = useMemo(() => {
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
            onClick={handleBack}
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
          {useSimulator && currentPortrait?.src && (
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
          <CropGuideOverlay
            showCropGuide={showCropGuide}
            showGridLines={showGridLines}
            cropInfo={cropInfo}
          />

          {/* Countdown Big Center Overlay & Flash Burst Effect */}
          <CountdownOverlay
            countdown={countdown}
            isFlashing={isFlashing}
            getReadyText={t.camera.getReady}
          />

          {/* Minimalist Bottom Bar: Captured Photo List & Shutter Controls (z-20) */}
          <div className="absolute bottom-2.5 sm:bottom-4 left-2.5 sm:left-4 right-2.5 sm:right-4 z-20 flex items-center justify-between gap-2 pointer-events-auto">
            {/* Captured Photos Mini Tray */}
            <PhotoTray
              totalShotsNeeded={totalShotsNeeded}
              localShots={localShots}
              currentShotNumber={currentShotNumber}
              isRetakeMode={isRetakeMode}
              retakeIndex={retakeIndex}
              photoSlotText={t.camera.photoSlot}
            />

            {/* Shutter Action Buttons */}
            <ShutterControls
              isCapturingSequence={isCapturingSequence}
              isRetakeMode={isRetakeMode}
              retakeIndex={retakeIndex}
              countdown={countdown}
              countdownSeconds={settings?.countdownSeconds || 3}
              onStartSequence={startCountdownSequence}
              onInstantCapture={handleInstantCapture}
              t={t}
            />
          </div>

          {/* Toggleable Clean Camera Tools Modal / Drawer */}
          <CameraToolsModal
            showTools={showTools}
            onClose={() => setShowTools(false)}
            cameraReady={cameraReady}
            targetSlot={targetSlot}
            activeFrameName={activeFrame.name}
            useSimulator={useSimulator}
            setUseSimulator={setUseSimulator}
            showCropGuide={showCropGuide}
            setShowCropGuide={setShowCropGuide}
            showGridLines={showGridLines}
            setShowGridLines={setShowGridLines}
            cropInfo={cropInfo}
            activePoseIdx={activePoseIdx}
            setActivePoseIdx={setActivePoseIdx}
            t={t}
          />
        </div>
      </div>
    </div>
  );
};
