import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { usePhotobox } from '../../context/PhotoboxContext';
import { DEFAULT_FRAMES, STUDIO_PORTRAITS } from '../../data/defaultFrames';
import { playShutterSound } from '../../services/shutterAudio';
import { gphotoService, type GPhotoStatus } from '../../services/gphotoService';
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
    sessionSecondsLeft,
    isSessionTimerEnabled,
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

  // Camera Source Mode: 'webrtc' | 'gphoto' | 'simulator'
  const [cameraSource, setCameraSource] = useState<'webrtc' | 'gphoto' | 'simulator'>('webrtc');
  const [gphotoStatus, setGphotoStatus] = useState<GPhotoStatus>(gphotoService.getStatus());
  const [gphotoLiveFrame, setGphotoLiveFrame] = useState<string | null>(null);

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

  // Subscribe to gPhoto WebUSB status and live preview frames
  useEffect(() => {
    const unsubState = gphotoService.subscribeState((status) => {
      setGphotoStatus(status);
    });
    const unsubFrames = gphotoService.subscribeFrames((frameUrl) => {
      setGphotoLiveFrame(frameUrl);
      setCameraReady(true);
    });
    return () => {
      unsubState();
      unsubFrames();
    };
  }, []);

  // Initialize cameraSource from AppSettings
  useEffect(() => {
    if (settings?.cameraSourceMode === 'gphoto') {
      setCameraSource('gphoto');
    } else if (settings?.cameraSourceMode === 'simulator') {
      setCameraSource('simulator');
    } else {
      setCameraSource('webrtc');
    }
  }, [settings?.cameraSourceMode]);

  // Sync crop guide setting from IndexedDB app settings
  useEffect(() => {
    if (typeof settings?.showCropGuide === 'boolean') {
      setShowCropGuide(settings.showCropGuide);
    }
  }, [settings?.showCropGuide]);

  // Sync localShots when capturedPhotos are restored from IndexedDB
  useEffect(() => {
    setLocalShots(capturedPhotos);
    if (!isRetakeMode) {
      if (capturedPhotos.length === 0) {
        setCurrentShotNumber(1);
        setActivePoseIdx(0);
      } else if (capturedPhotos.length < totalShotsNeeded) {
        setCurrentShotNumber(capturedPhotos.length + 1);
        setActivePoseIdx(capturedPhotos.length % STUDIO_PORTRAITS.length);
      }
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
        if (idx === 0 && cameraSource === 'simulator') setCameraReady(true);
      };
      loaded[idx] = img;
    });
    simulatorImagesRef.current = loaded;
  }, [cameraSource]);

  // Camera stream lifecycle coordinator
  useEffect(() => {
    let cancelled = false;

    // 1. DSLR / gPhoto mode
    if (cameraSource === 'gphoto') {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (gphotoStatus.isConnected) {
        gphotoService.startLiveView();
      } else {
        setCameraReady(true);
      }
      return () => {
        cancelled = true;
        gphotoService.stopLiveView();
      };
    }

    // 2. Simulator mode
    if (cameraSource === 'simulator') {
      gphotoService.stopLiveView();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraReady(true);
      return () => {
        cancelled = true;
      };
    }

    // 3. WebRTC Live Camera mode
    gphotoService.stopLiveView();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraSource('simulator');
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
          setCameraSource('simulator');
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
  }, [cameraSource, gphotoStatus.isConnected]);

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

  // Capture single photo snapshot: prioritizes DSLR full-res PTP capture with canvas fallback
  const captureSinglePhoto = useCallback(
    async (shotIndexZeroBased: number): Promise<string> => {
      // 1. High-resolution hardware shutter if DSLR is active and connected
      if (cameraSource === 'gphoto' && gphotoStatus.isConnected) {
        try {
          return await gphotoService.captureHighResPhoto();
        } catch (err) {
          console.warn('[CameraCaptureScreen] DSLR shutter failed, using fallback:', err);
        }
      }

      // 2. High-speed recycled canvas capture (WebRTC video, DSLR live frame, or Simulator)
      const width = 800;
      const height = 600;
      const canvas = getRecycledCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      ctx.clearRect(0, 0, width, height);
      const shouldMirror = settings?.mirrorCamera !== false;
      const videoEl = videoRef.current;

      if (
        cameraSource === 'webrtc' &&
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
    [cameraSource, getRecycledCanvas, gphotoStatus.isConnected, settings?.mirrorCamera]
  );

  // Instant capture handler (captures remaining or retake shot immediately)
  const handleInstantCapture = useCallback(async () => {
    clearAllTimers();
    setIsCapturingSequence(false);
    setCountdown(null);
    setIsFlashing(true);
    if (settings?.enableShutterSound !== false) {
      playShutterSound();
    }
    safeSetTimeout(() => setIsFlashing(false), 300);

    if (isRetakeMode && retakeIndex !== null) {
      const newPhoto = await captureSinglePhoto(activePoseIdx);
      updatePhotoAtIndex(retakeIndex, newPhoto);
      setRetakeIndex(null);
      navigate('/app/review-photos');
      return;
    }

    // Loop ambil foto sebanyak photoCount
    const generated: string[] = [];
    for (let i = 0; i < totalShotsNeeded; i++) {
      generated.push(await captureSinglePhoto(i));
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

  // Timed Countdown Capture Sequence
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
          captureSinglePhoto(activePoseIdx).then((newPhoto) => {
            updatePhotoAtIndex(retakeIndex, newPhoto);
            setRetakeIndex(null);
            setIsCapturingSequence(false);
            navigate('/app/review-photos');
          });
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

          captureSinglePhoto(currentIdx).then((snap) => {
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
          });
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

  const handleConnectGPhoto = useCallback(async () => {
    const res = await gphotoService.requestAndConnect();
    if (res.success) {
      setCameraSource('gphoto');
    }
  }, []);

  const handleDisconnectGPhoto = useCallback(async () => {
    await gphotoService.disconnect();
    setGphotoLiveFrame(null);
    setCameraSource('webrtc');
  }, []);

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
        label: t.camera.cropSideWarning,
      };
    } else if (diff > 0.015) {
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
        label: t.camera.cropTopWarning,
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
        label: t.camera.cropPerfect,
      };
    }
  }, [slotAspect, cameraAspect, t.camera]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* Hero Edge-to-Edge Spotlight Viewfinder (Borderless Fullscreen) */}
      <div
        data-testid="camera-viewfinder"
        className="absolute inset-0 w-full h-full bg-black overflow-hidden flex items-center justify-center group"
      >
        {/* DSLR Live View Preview Frame */}
        {cameraSource === 'gphoto' && gphotoStatus.isConnected && gphotoLiveFrame && (
          <img
            src={gphotoLiveFrame}
            alt="DSLR Live View"
            className={`w-full h-full object-cover select-none pointer-events-none ${
              settings?.mirrorCamera !== false ? 'scale-x-[-1]' : ''
            }`}
          />
        )}

        {/* DSLR Waiting / Disconnected Prompt */}
        {cameraSource === 'gphoto' && (!gphotoStatus.isConnected || !gphotoLiveFrame) && (
          <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-300 space-y-3 z-10">
            <span className="text-4xl sm:text-5xl">📸</span>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-white">
                {gphotoStatus.isConnected ? 'Menunggu Live View DSLR...' : t.camera.dslrDisconnected}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-sm">
                {gphotoStatus.isConnected
                  ? 'Kamera terdeteksi. Mengaktifkan preview sensor PTP...'
                  : 'Pastikan kamera menyala, terhubung via kabel USB, dan beri izin WebUSB.'}
              </p>
            </div>
            {!gphotoStatus.isConnected && (
              <button
                type="button"
                onClick={handleConnectGPhoto}
                disabled={gphotoStatus.isConnecting}
                className="px-4 py-2 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>🔌</span>
                <span>{t.camera.dslrConnectPrompt}</span>
              </button>
            )}
          </div>
        )}

        {/* WebRTC Video Element */}
        {cameraSource === 'webrtc' && (
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${
              settings?.mirrorCamera !== false ? 'scale-x-[-1]' : ''
            }`}
          />
        )}

        {/* Studio Camera Simulator Fallback */}
        {cameraSource === 'simulator' && currentPortrait?.src && (
          <img
            src={currentPortrait.src}
            alt={currentPortrait.label}
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover transition-all duration-300 ${
              settings?.mirrorCamera !== false ? 'scale-x-[-1]' : ''
            }`}
          />
        )}

        {/* Ambient Vignette & Top/Bottom Gradients to Guarantee Floating HUD Legibility */}
        <div
          className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-b from-black/60 via-transparent to-black/75"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.35)_75%,rgba(0,0,0,0.85)_100%)]"
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

        {/* Floating Back Button (Top Left - z-20) */}
        <div className="absolute top-3 sm:top-5 left-3 sm:left-5 z-20 pointer-events-auto">
          <button
            type="button"
            onClick={handleBack}
            className="min-h-[44px] px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-100 hover:text-white bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/20 active:scale-95 rounded-full transition-all cursor-pointer shadow-xl flex items-center gap-2 group"
            title={isRetakeMode ? t.camera.cancelRetake : t.camera.backToFrames}
          >
            <span className="text-sm transition-transform group-hover:-translate-x-0.5">←</span>
            <span className="font-medium">
              {isRetakeMode ? t.camera.cancelRetake : t.camera.backToFrames}
            </span>
          </button>
        </div>

        {/* Floating Top Center: Session Timer & Photo Tray Preview (z-20) */}
        <div className="absolute top-3 sm:top-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center gap-2 max-w-[92vw]">
          {/* Floating Session Timer */}
          {isSessionTimerEnabled && (
            <div
              title={t.sessionTimer.timeRemaining}
              aria-label={t.sessionTimer.timeRemaining}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono-tabular backdrop-blur-md shadow-lg transition-all select-none ${
                sessionSecondsLeft === 0
                  ? 'bg-rose-950/80 border-rose-500/80 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.5)] animate-pulse'
                  : sessionSecondsLeft <= 60
                  ? 'bg-amber-950/80 border-amber-500/80 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'bg-black/60 border-white/20 text-zinc-200'
              }`}
            >
              <span className="text-[11px]">{sessionSecondsLeft === 0 ? '🔔' : '⏳'}</span>
              <span className="font-bold tracking-wider">
                {String(Math.floor(sessionSecondsLeft / 60)).padStart(2, '0')}:
                {String(sessionSecondsLeft % 60).padStart(2, '0')}
              </span>
              <span className="text-[10px] text-zinc-400 font-sans hidden sm:inline">
                · {activeFrame.name}
              </span>
            </div>
          )}

          {/* Floating Photo Preview Tray */}
          <PhotoTray
            totalShotsNeeded={totalShotsNeeded}
            localShots={localShots}
            currentShotNumber={currentShotNumber}
            isRetakeMode={isRetakeMode}
            retakeIndex={retakeIndex}
            photoSlotText={t.camera.photoSlot}
          />
        </div>

        {/* Floating Camera Tools Button (Top Right - z-20) */}
        <div className="absolute top-3 sm:top-5 right-3 sm:right-5 z-20 pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowTools((prev) => !prev)}
            aria-expanded={showTools}
            className={`min-h-[44px] min-w-[44px] px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-full backdrop-blur-md transition-all cursor-pointer shadow-xl flex items-center justify-center gap-1.5 border active:scale-95 ${
              showTools
                ? 'bg-[var(--theme-accent,#E11D48)] text-white border-[var(--theme-accent,#E11D48)] shadow-[0_0_20px_rgba(225,29,72,0.6)]'
                : 'text-zinc-200 hover:text-white bg-black/60 hover:bg-black/85 border-white/20'
            }`}
            title={showTools ? t.camera.closeTools : t.camera.tools}
          >
            <span className="text-base">⚙️</span>
            <span className="hidden sm:inline">
              {showTools ? t.camera.closeTools : t.camera.tools}
            </span>
          </button>
        </div>

        {/* Floating Bottom Center: Shutter Controls (z-20) */}
        <div className="absolute bottom-5 sm:bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center pointer-events-auto">
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

        {/* Toggleable Clean Camera Tools Modal / Drawer (z-40) */}
        <CameraToolsModal
          showTools={showTools}
          onClose={() => setShowTools(false)}
          cameraReady={cameraReady}
          targetSlot={targetSlot}
          activeFrameName={activeFrame.name}
          cameraSource={cameraSource}
          setCameraSource={setCameraSource}
          gphotoStatus={gphotoStatus}
          onConnectGPhoto={handleConnectGPhoto}
          onDisconnectGPhoto={handleDisconnectGPhoto}
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
  );
};
