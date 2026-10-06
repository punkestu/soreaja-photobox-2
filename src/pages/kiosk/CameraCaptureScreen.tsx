import React, { useEffect, useRef, useState, useCallback } from 'react';
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
          setLocalShots([...accumulated]);

          currentIdx += 1;
          if (currentIdx < totalShotsNeeded) {
            setTimeout(runNextShot, 600);
          } else {
            setCapturedPhotos(accumulated);
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

  return (
    <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 flex flex-col justify-between gap-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
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
            className="relative aspect-[4/3] w-full bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden flex items-center justify-center"
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

            {/* Rule-of-Thirds Studio Viewfinder Grid */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
              <div className="border-r border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div className="border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div className="border-b border-white/10" />
              <div className="border-r border-white/10" />
              <div className="border-r border-white/10" />
              <div />
            </div>

            {/* Top Viewfinder Status Overlay */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-xs font-mono-tabular text-white bg-black/60 backdrop-blur-xs px-3.5 py-2 rounded-lg">
              <span>
                {cameraReady ? '● REC · 800×600 RAW' : 'MEMUAT KAMERA...'}
              </span>
              <span>
                {isRetakeMode
                  ? `RETAKE SLOT #${(retakeIndex ?? 0) + 1}`
                  : `POSE ${currentShotNumber} DARI ${totalShotsNeeded}`}
              </span>
            </div>

            {/* Countdown Overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center pointer-events-none">
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
              <div className="absolute inset-0 bg-white animate-flash pointer-events-none" />
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
        <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
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
              className="w-full py-3.5 px-5 text-sm font-semibold text-white bg-[#E11D48] hover:bg-[#BE123C] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
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
              className="w-full py-3 px-4 text-xs font-semibold text-zinc-100 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              {isRetakeMode
                ? `Ambil Instan Foto #${(retakeIndex ?? 0) + 1} (Tanpa Delay)`
                : `Ambil Instan Semua (${totalShotsNeeded} Foto)`}
            </button>
          </div>

          {/* Slot Thumbnails */}
          <div className="pt-4 border-t border-zinc-800 space-y-3">
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
                    className={`aspect-[4/3] rounded-lg border overflow-hidden relative bg-zinc-950 flex items-center justify-center ${
                      isTargetRetake
                        ? 'border-[#E11D48] ring-2 ring-[#E11D48]/40'
                        : 'border-zinc-800'
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
