import React, { useEffect, useState, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { db, DEFAULT_DRIVE_URL, DEFAULT_APP_SETTINGS, DEFAULT_IMAGE_PREPROCESSING, DEFAULT_PHOTO_ENHANCER } from '../../db';
import {
  THEME_COLOR_PRESETS,
  BACKDROP_PRESETS,
  applyThemeColor,
  calculateHoverColor,
} from '../../data/themeConfig';
import { KIOSK_HERO_BACKDROP, STUDIO_PORTRAITS } from '../../data/defaultFrames';
import { playShutterSound } from '../../services/shutterAudio';
import { testPrintApi, precacheAllFrameAssets } from '../../services/printServices';
import { usePhotobox } from '../../context/PhotoboxContext';
import { ResetAllDataModal } from '../../components/common/ResetAllDataModal';
import { BrandLogo } from '../../components/common/BrandLogo';
import { gphotoService, type GPhotoStatus } from '../../services/gphotoService';
import type { ImagePreprocessingSettings, PhotoEnhancerSettings } from '../../types/photobox';
import {
  PREPROCESSING_PRESETS,
  isPreprocessingNeutral,
  getPreprocessingCssFilter,
  applyImagePreprocessingToDataUrl,
} from '../../services/imagePreprocessingService';
import {
  ENHANCER_PRESETS,
  enhancePhotoDataUrl,
  normalizeEnhancerSettings,
} from '../../services/photoEnhancerService';

export const AdminSettings: React.FC = () => {
  const {
    language,
    setLanguage,
    t,
    activeFramePack,
    setActiveFramePack,
    availablePacks,
    refreshPacks,
  } = usePhotobox();
  const [driveUrl, setDriveUrl] = useState(DEFAULT_DRIVE_URL);
  const [studioName, setStudioName] = useState(DEFAULT_APP_SETTINGS.studioName || '');
  const [eventName, setEventName] = useState(DEFAULT_APP_SETTINGS.eventName || '');
  const [defaultCaption, setDefaultCaption] = useState(
    DEFAULT_APP_SETTINGS.defaultCaption || 'SOREAJA — PHOTOBOX 2'
  );
  const [showFrameStamps, setShowFrameStamps] = useState<boolean>(true);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(3);
  const [autoDownload, setAutoDownload] = useState<boolean>(true);
  const [mirrorCamera, setMirrorCamera] = useState<boolean>(true);
  const [showCropGuide, setShowCropGuide] = useState<boolean>(true);
  const [cameraSourceMode, setCameraSourceMode] = useState<'auto' | 'gphoto' | 'simulator'>('auto');
  const [dslrLiveFrame, setDslrLiveFrame] = useState<string | null>(null);

  // Camera Image Preprocessing Settings
  const [imagePreprocessing, setImagePreprocessing] = useState<ImagePreprocessingSettings>(
    DEFAULT_APP_SETTINGS.imagePreprocessing || DEFAULT_IMAGE_PREPROCESSING
  );
  const [previewPoseIdx, setPreviewPoseIdx] = useState<number>(0);

  // Lightweight Studio Photo Enhancer Settings & Benchmark State
  const [photoEnhancer, setPhotoEnhancer] = useState<PhotoEnhancerSettings>(
    DEFAULT_APP_SETTINGS.photoEnhancer || DEFAULT_PHOTO_ENHANCER
  );
  const [isTestingEnhancer, setIsTestingEnhancer] = useState<boolean>(false);
  const [enhancerProgress, setEnhancerProgress] = useState<number>(0);
  const [enhancerTestResult, setEnhancerTestResult] = useState<{
    beforeUrl: string;
    afterUrl: string;
    durationMs: number;
    inputDims: string;
    outputDims: string;
    backend?: string;
    fallbackUsed?: boolean;
    error?: string;
  } | null>(null);
  const [enhancerCompareView, setEnhancerCompareView] = useState<'after' | 'before'>('after');

  // Real Test Capture State
  interface TestCaptureResult {
    rawUrl: string;
    processedUrl: string;
    width: number;
    height: number;
    durationMs: number;
    source: string;
    timestamp: string;
  }
  const [isTestCapturing, setIsTestCapturing] = useState<boolean>(false);
  const [testCaptureResult, setTestCaptureResult] = useState<TestCaptureResult | null>(null);
  const [testCaptureViewModal, setTestCaptureViewModal] = useState<boolean>(false);
  const [testCaptureTab, setTestCaptureTab] = useState<'processed' | 'raw' | 'side-by-side'>('processed');
  const [testWebcamActive, setTestWebcamActive] = useState<boolean>(false);
  const testVideoRef = useRef<HTMLVideoElement | null>(null);
  const testStreamRef = useRef<MediaStream | null>(null);

  // Hardware: Print Server API & Shutter Sound
  const [printApiEndpoint, setPrintApiEndpoint] = useState<string>(
    DEFAULT_APP_SETTINGS.printApiEndpoint || ''
  );
  const [printerName, setPrinterName] = useState<string>(
    DEFAULT_APP_SETTINGS.printerName || ''
  );
  const [thermalPrinterName, setThermalPrinterName] = useState<string>(
    DEFAULT_APP_SETTINGS.thermalPrinterName || ''
  );
  const [colorPrinterName, setColorPrinterName] = useState<string>(
    DEFAULT_APP_SETTINGS.colorPrinterName || ''
  );
  const [enableShutterSound, setEnableShutterSound] = useState<boolean>(
    DEFAULT_APP_SETTINGS.enableShutterSound ?? true
  );
  const [enableSessionTimer, setEnableSessionTimer] = useState<boolean>(
    DEFAULT_APP_SETTINGS.enableSessionTimer ?? true
  );
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(
    DEFAULT_APP_SETTINGS.sessionDurationMinutes || 5
  );
  const [testingApi, setTestingApi] = useState<boolean>(false);
  const [testApiResult, setTestApiResult] = useState<{
    success: boolean;
    message: string;
    jobId?: string;
  } | null>(null);
  const [cachingOffline, setCachingOffline] = useState<boolean>(false);
  const [offlineCacheStatus, setOfflineCacheStatus] = useState<string | null>(null);

  // External DSLR / web-gphoto2 state & live preview frames
  const [dslrStatus, setDslrStatus] = useState<GPhotoStatus>(gphotoService.getStatus());

  useEffect(() => {
    const unsubState = gphotoService.subscribeState((status) => {
      setDslrStatus(status);
    });
    const unsubFrames = gphotoService.subscribeFrames((frameUrl) => {
      setDslrLiveFrame(frameUrl);
    });
    return () => {
      unsubState();
      unsubFrames();
    };
  }, []);

  // When cameraSourceMode is gphoto and connected, activate live view for testing
  useEffect(() => {
    if (cameraSourceMode === 'gphoto' && dslrStatus.isConnected) {
      gphotoService.startLiveView();
      return () => {
        gphotoService.stopLiveView();
      };
    }
  }, [cameraSourceMode, dslrStatus.isConnected]);

  const handleConnectDslr = async () => {
    await gphotoService.requestAndConnect();
  };

  const handleDisconnectDslr = async () => {
    await gphotoService.disconnect();
  };

  const [syncingDslrConfig, setSyncingDslrConfig] = useState<boolean>(false);

  const handleRefreshDslrConfig = async () => {
    setSyncingDslrConfig(true);
    try {
      await gphotoService.refreshConfig();
    } finally {
      setSyncingDslrConfig(false);
    }
  };

  const handleSetDslrConfig = async (name: string, value: string | number) => {
    try {
      await gphotoService.setConfigValue(name, value);
    } catch (err: any) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`Gagal mengubah konfigurasi ${name}: ${err?.message || err}`);
      }
    }
  };

  // Cleanup test webcam stream on unmount
  useEffect(() => {
    return () => {
      if (testStreamRef.current) {
        testStreamRef.current.getTracks().forEach((t) => t.stop());
        testStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (testWebcamActive && testStreamRef.current && testVideoRef.current) {
      testVideoRef.current.srcObject = testStreamRef.current;
      testVideoRef.current.play().catch(() => { });
    }
  }, [testWebcamActive]);

  const handleToggleTestWebcam = async () => {
    if (testWebcamActive) {
      if (testStreamRef.current) {
        testStreamRef.current.getTracks().forEach((t) => t.stop());
        testStreamRef.current = null;
      }
      if (testVideoRef.current) {
        testVideoRef.current.srcObject = null;
      }
      setTestWebcamActive(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Browser tidak mendukung akses kamera webcam.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false,
      });
      testStreamRef.current = stream;
      setTestWebcamActive(true);
    } catch (err: any) {
      alert(`Gagal mengakses kamera: ${err?.message || err}`);
    }
  };

  const handlePerformTestCapture = async () => {
    setIsTestCapturing(true);
    if (enableShutterSound !== false) {
      playShutterSound();
    }

    try {
      const startTime = performance.now();
      let rawUrl = '';
      let sourceName = 'Studio Simulator Portrait';
      let width = 1200;
      let height = 900;

      // 1. If camera source setting is gPhoto DSLR
      if (cameraSourceMode === 'gphoto') {
        if (!dslrStatus.isConnected) {
          alert('Kamera DSLR belum terhubung via WebUSB. Silakan hubungkan kamera DSLR terlebih dahulu pada bagian Sumber Kamera di atas.');
          setIsTestCapturing(false);
          return;
        }
        try {
          rawUrl = await gphotoService.captureHighResPhoto(mirrorCamera);
          sourceName = dslrStatus.modelName || 'Kamera DSLR (WebUSB)';
        } catch (err: any) {
          alert(`Gagal mengambil foto dari kamera DSLR: ${err?.message || err}`);
          setIsTestCapturing(false);
          return;
        }
      }

      // 2. If camera source setting is WebRTC (auto)
      if (cameraSourceMode === 'auto') {
        if (!testStreamRef.current) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 } },
              audio: false,
            });
            testStreamRef.current = stream;
            setTestWebcamActive(true);
            if (testVideoRef.current) {
              testVideoRef.current.srcObject = stream;
              await testVideoRef.current.play().catch(() => { });
            }
            await new Promise((r) => setTimeout(r, 400));
          } catch (camErr: any) {
            alert(`Gagal mengakses kamera webcam: ${camErr?.message || camErr}`);
            setIsTestCapturing(false);
            return;
          }
        }

        const v = testVideoRef.current;
        if (v && v.videoWidth > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            if (mirrorCamera) {
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);
            }
            ctx.drawImage(v, 0, 0);
            rawUrl = canvas.toDataURL('image/jpeg', 0.98);
            sourceName = 'Kamera Webcam (WebRTC)';
            width = canvas.width;
            height = canvas.height;
          }
        }
      }

      // 3. If camera source setting is simulator (or explicit fallback)
      if (cameraSourceMode === 'simulator' || !rawUrl) {
        const simImgSrc = STUDIO_PORTRAITS[previewPoseIdx % STUDIO_PORTRAITS.length].src;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = simImgSrc;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1200;
        canvas.height = img.naturalHeight || 900;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          rawUrl = canvas.toDataURL('image/jpeg', 0.98);
          sourceName = `Studio Simulator (Pose ${previewPoseIdx + 1})`;
          width = canvas.width;
          height = canvas.height;
        }
      }

      // Apply actual pixel preprocessing transformation
      const processedUrl = await applyImagePreprocessingToDataUrl(
        rawUrl,
        imagePreprocessing,
        'image/jpeg',
        0.98
      );

      const durationMs = Math.round(performance.now() - startTime);

      // Measure dimensions
      const finalImg = new Image();
      finalImg.src = processedUrl;
      await new Promise<void>((res) => {
        finalImg.onload = () => {
          width = finalImg.naturalWidth || width;
          height = finalImg.naturalHeight || height;
          res();
        };
        finalImg.onerror = () => res();
      });

      setTestCaptureResult({
        rawUrl,
        processedUrl,
        width,
        height,
        durationMs,
        source: sourceName,
        timestamp: new Date().toLocaleTimeString(language === 'id' ? 'id-ID' : 'en-US'),
      });
    } catch (err: any) {
      console.error('Test capture error:', err);
      alert(`Gagal mengambil foto uji: ${err?.message || err}`);
    } finally {
      setIsTestCapturing(false);
    }
  };

  const handleDownloadTestCapture = () => {
    if (!testCaptureResult) return;
    const a = document.createElement('a');
    a.href = testCaptureTab === 'raw' ? testCaptureResult.rawUrl : testCaptureResult.processedUrl;
    a.download = `soreaja-test-capture-${Date.now()}.jpg`;
    a.click();
  };

  const handleTestPhotoEnhancer = async () => {
    setIsTestingEnhancer(true);
    setEnhancerProgress(0);
    try {
      const sampleSrc =
        testCaptureResult?.processedUrl ||
        STUDIO_PORTRAITS[previewPoseIdx % STUDIO_PORTRAITS.length].src;
      const res = await enhancePhotoDataUrl(
        sampleSrc,
        photoEnhancer,
        (pct) => setEnhancerProgress(pct),
        true
      );
      setEnhancerTestResult({
        beforeUrl: sampleSrc,
        afterUrl: res.url,
        durationMs: res.durationMs,
        inputDims: `${res.inputWidth}×${res.inputHeight}px`,
        outputDims: `${res.outputWidth}×${res.outputHeight}px`,
        backend: res.backend,
        fallbackUsed: res.fallbackUsed,
        error: res.error,
      });
      setEnhancerCompareView('after');
    } finally {
      setIsTestingEnhancer(false);
    }
  };

  // Tema & Background Kiosk
  const [themeColor, setThemeColor] = useState<string>(DEFAULT_APP_SETTINGS.themeColor || '#E11D48');
  const [themePreset, setThemePreset] = useState<string>(DEFAULT_APP_SETTINGS.themePreset || 'crimson');
  const [kioskBackground, setKioskBackground] = useState<string>(DEFAULT_APP_SETTINGS.kioskBackground || '');
  const [kioskBackgroundOverlayOpacity, setKioskBackgroundOverlayOpacity] = useState<number>(
    DEFAULT_APP_SETTINGS.kioskBackgroundOverlayOpacity || 60
  );
  const [customBackdropUrl, setCustomBackdropUrl] = useState<string>('');
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [idleScreenMode, setIdleScreenMode] = useState<'standard' | 'fullscreen-camera'>(
    DEFAULT_APP_SETTINGS.idleScreenMode || 'standard'
  );

  const [activeTab, setActiveTab] = useState<'appearance' | 'packs' | 'session' | 'hardware'>('appearance');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showResetAllModal, setShowResetAllModal] = useState(false);

  // Frame Packs State & Handlers
  const [isRescanningPacks, setIsRescanningPacks] = useState(false);
  const [packNotice, setPackNotice] = useState<string | null>(null);
  const [precachingAllPacks, setPrecachingAllPacks] = useState(false);
  const [precacheProgress, setPrecacheProgress] = useState<{ current: number; total: number } | null>(null);

  const handleRescanPacks = async () => {
    setIsRescanningPacks(true);
    try {
      const packs = await refreshPacks();
      setPackNotice(
        language === 'en'
          ? `${packs.length} frame packs detected on disk`
          : `${packs.length} paket bingkai terdeteksi di folder`
      );
      setTimeout(() => setPackNotice(null), 3500);
    } catch {
      setPackNotice(language === 'en' ? 'Failed to scan frame packs' : 'Gagal memindai paket bingkai');
    } finally {
      setIsRescanningPacks(false);
    }
  };

  const handleSelectPack = async (packId: string) => {
    try {
      await setActiveFramePack(packId);
      setPackNotice(t.admin.packActivatedNotice);
      setTimeout(() => setPackNotice(null), 3500);
    } catch (err) {
      console.error('Failed to switch pack:', err);
    }
  };

  const handlePrecacheAllPacks = async () => {
    setPrecachingAllPacks(true);
    setPrecacheProgress(null);
    try {
      const result = await precacheAllFrameAssets((current, total) => {
        setPrecacheProgress({ current, total });
      });
      setPackNotice(`${t.admin.precachedAllSuccess} (${result.cachedCount}/${result.totalAssets})`);
      setTimeout(() => setPackNotice(null), 4000);
    } catch (err) {
      console.error('Error precaching packs:', err);
    } finally {
      setPrecachingAllPacks(false);
      setPrecacheProgress(null);
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    db.settings.get('app_settings').then((data) => {
      if (data) {
        if (data.driveUrl) setDriveUrl(data.driveUrl);
        if (data.studioName) setStudioName(data.studioName);
        if (data.eventName) setEventName(data.eventName);
        if (data.defaultCaption) setDefaultCaption(data.defaultCaption);
        if (typeof data.showFrameStamps === 'boolean') {
          setShowFrameStamps(data.showFrameStamps);
        }
        if (typeof data.countdownSeconds === 'number') {
          setCountdownSeconds(data.countdownSeconds);
        }
        if (typeof data.autoDownload === 'boolean') {
          setAutoDownload(data.autoDownload);
        }
        if (typeof data.mirrorCamera === 'boolean') {
          setMirrorCamera(data.mirrorCamera);
        }
        if (typeof data.showCropGuide === 'boolean') {
          setShowCropGuide(data.showCropGuide);
        }
        if (data.cameraSourceMode) {
          setCameraSourceMode(data.cameraSourceMode);
        }
        if (data.printApiEndpoint !== undefined) {
          setPrintApiEndpoint(data.printApiEndpoint);
        }
        if (data.printerName !== undefined) {
          setPrinterName(data.printerName);
        }
        if (data.thermalPrinterName !== undefined) {
          setThermalPrinterName(data.thermalPrinterName);
        } else if (data.printerName) {
          setThermalPrinterName(data.printerName);
        }
        if (data.colorPrinterName !== undefined) {
          setColorPrinterName(data.colorPrinterName);
        } else if (data.printerName) {
          setColorPrinterName(data.printerName);
        }
        if (typeof data.enableShutterSound === 'boolean') {
          setEnableShutterSound(data.enableShutterSound);
        }
        if (typeof data.enableSessionTimer === 'boolean') {
          setEnableSessionTimer(data.enableSessionTimer);
        }
        if (typeof data.sessionDurationMinutes === 'number') {
          setSessionDurationMinutes(data.sessionDurationMinutes);
        }
        if (data.themeColor) {
          setThemeColor(data.themeColor);
        }
        if (data.themePreset) {
          setThemePreset(data.themePreset);
        }
        if (data.kioskBackground !== undefined) {
          setKioskBackground(data.kioskBackground);
          if (data.kioskBackground && !BACKDROP_PRESETS.some((p) => p.id === data.kioskBackground) && !data.kioskBackground.startsWith('data:')) {
            setCustomBackdropUrl(data.kioskBackground);
          }
        }
        if (typeof data.kioskBackgroundOverlayOpacity === 'number') {
          setKioskBackgroundOverlayOpacity(data.kioskBackgroundOverlayOpacity);
        }
        if (data.idleScreenMode) {
          setIdleScreenMode(data.idleScreenMode);
        }
        if (data.imagePreprocessing) {
          setImagePreprocessing(data.imagePreprocessing);
        }
        if (data.photoEnhancer) {
          setPhotoEnhancer(normalizeEnhancerSettings(data.photoEnhancer));
        }
      }
    });
  }, []);

  const handleSelectColorPreset = (presetId: string, colorHex: string) => {
    setThemePreset(presetId);
    setThemeColor(colorHex);
    applyThemeColor(colorHex);
  };

  const handleCustomColorChange = (newColor: string) => {
    setThemeColor(newColor);
    setThemePreset('custom');
    applyThemeColor(newColor);
  };

  const handleSelectBackdropPreset = (presetId: string) => {
    setKioskBackground(presetId);
    setUploadNotice(null);
  };

  const handleUseDefaultBackdrop = () => {
    setKioskBackground('');
    setCustomBackdropUrl('');
    setUploadNotice('Menggunakan foto latar default studio.');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isGif = file.type === 'image/gif' || lowerName.endsWith('.gif');
    const isWebp = file.type === 'image/webp' || lowerName.endsWith('.webp');

    if (!file.type.startsWith('image/') && !isGif) {
      setUploadNotice('Harap pilih file gambar (JPG, PNG, WebP, atau GIF).');
      e.target.value = '';
      return;
    }

    setUploadNotice(
      isGif
        ? 'Memuat animasi GIF latar...'
        : 'Memproses dan mengoptimalkan gambar latar...'
    );
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        // Preserve animated GIFs (and compact WebPs) directly without canvas flattening
        if (isGif || (isWebp && file.size <= 6 * 1024 * 1024)) {
          const gifDataUrl =
            isGif && !dataUrl.startsWith('data:image/gif')
              ? dataUrl.replace(/^data:[^;]*;/, 'data:image/gif;')
              : dataUrl;
          setKioskBackground(gifDataUrl);
          setUploadNotice(
            `${isGif ? 'GIF animasi' : 'Gambar'} berhasil dimuat (${file.name} · ${img.width}×${img.height}px). Klik Simpan Pengaturan untuk menerapkan.`
          );
          return;
        }

        const maxWidth = 1920;
        const maxHeight = 1080;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          setKioskBackground(optimizedBase64);
          setUploadNotice(`Foto berhasil dimuat (${file.name} · ${width}×${height}px).`);
        } else {
          setKioskBackground(dataUrl);
          setUploadNotice(`Foto berhasil dimuat (${file.name}).`);
        }
      };
      img.onerror = () => {
        setUploadNotice('Gagal memproses file gambar.');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplyCustomUrl = () => {
    if (customBackdropUrl.trim()) {
      setKioskBackground(customBackdropUrl.trim());
      setUploadNotice('Tautan gambar kustom diterapkan.');
    }
  };

  const previewBackdropSrc = useMemo(() => {
    if (!kioskBackground) return KIOSK_HERO_BACKDROP;
    const match = BACKDROP_PRESETS.find((p) => p.id === kioskBackground);
    if (match) return match.src;
    return kioskBackground;
  }, [kioskBackground]);

  const handleTestShutterSound = () => {
    playShutterSound();
  };

  const handleTestPrintThermal = async () => {
    if (!printApiEndpoint.trim()) {
      setTestApiResult({
        success: false,
        message: 'Harap isi URL Print API Endpoint terlebih dahulu untuk melakukan uji coba.',
      });
      return;
    }
    if (!thermalPrinterName.trim()) {
      setTestApiResult({
        success: false,
        message: 'Harap isi Nama Printer Thermal terlebih dahulu.',
      });
      return;
    }
    setTestingApi(true);
    setTestApiResult(null);
    try {
      const res = await testPrintApi(printApiEndpoint.trim(), thermalPrinterName.trim(), 'thermal');
      setTestApiResult(res);
    } catch (err) {
      setTestApiResult({
        success: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTestingApi(false);
    }
  };

  const handleTestPrintColor = async () => {
    if (!printApiEndpoint.trim()) {
      setTestApiResult({
        success: false,
        message: 'Harap isi URL Print API Endpoint terlebih dahulu untuk melakukan uji coba.',
      });
      return;
    }
    if (!colorPrinterName.trim()) {
      setTestApiResult({
        success: false,
        message: 'Harap isi Nama Printer Warna terlebih dahulu.',
      });
      return;
    }
    setTestingApi(true);
    setTestApiResult(null);
    try {
      const res = await testPrintApi(printApiEndpoint.trim(), colorPrinterName.trim(), 'color');
      setTestApiResult(res);
    } catch (err) {
      setTestApiResult({
        success: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTestingApi(false);
    }
  };

  const handleWarmOfflineCache = async () => {
    setCachingOffline(true);
    setOfflineCacheStatus('Memeriksa dan menyimpan seluruh aset ke CacheStorage browser...');
    try {
      const res = await precacheAllFrameAssets();
      setOfflineCacheStatus(
        `✅ Berhasil meng-cache ${res.cachedCount} dari ${res.totalAssets} file bingkai & metadata secara offline.`
      );
    } catch (err) {
      setOfflineCacheStatus(
        `⚠️ Gagal meng-cache aset: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setCachingOffline(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);

    const cleanUrl = driveUrl.trim() || DEFAULT_DRIVE_URL;

    await db.settings.put({
      id: 'app_settings',
      driveUrl: cleanUrl,
      studioName: studioName.trim() || 'SoreAja Studio — Booth 02',
      eventName: eventName.trim() || 'SoreAja Sunset Session 2026',
      defaultCaption: defaultCaption.trim() || 'SOREAJA — PHOTOBOX 2',
      showFrameStamps,
      countdownSeconds,
      autoDownload,
      mirrorCamera,
      showCropGuide,
      cameraSourceMode,
      printApiEndpoint: printApiEndpoint.trim(),
      printerName: thermalPrinterName.trim() || colorPrinterName.trim() || printerName.trim(),
      thermalPrinterName: thermalPrinterName.trim(),
      colorPrinterName: colorPrinterName.trim(),
      enableShutterSound,
      enableSessionTimer,
      sessionDurationMinutes,
      themeColor,
      themePreset,
      kioskBackground,
      kioskBackgroundOverlayOpacity,
      idleScreenMode,
      language,
      imagePreprocessing,
      photoEnhancer,
      updatedAt: new Date().toISOString(),
    });

    applyThemeColor(themeColor);
    setDriveUrl(cleanUrl);
    setIsSaving(false);
    setSaveMessage(
      language === 'en'
        ? `Settings, printer names & theme color saved to IndexedDB at ${new Date().toLocaleTimeString('en-US')}.`
        : `Pengaturan, nama printer & warna tema berhasil disimpan ke IndexedDB pada ${new Date().toLocaleTimeString('id-ID')}.`
    );
  };

  const handleResetDefaults = async () => {
    await db.settings.put({
      ...DEFAULT_APP_SETTINGS,
      updatedAt: new Date().toISOString(),
    });
    setLanguage('id');
    setDriveUrl(DEFAULT_APP_SETTINGS.driveUrl);
    setStudioName(DEFAULT_APP_SETTINGS.studioName || '');
    setEventName(DEFAULT_APP_SETTINGS.eventName || '');
    setDefaultCaption(DEFAULT_APP_SETTINGS.defaultCaption || 'SOREAJA — PHOTOBOX 2');
    setShowFrameStamps(true);
    setCountdownSeconds(DEFAULT_APP_SETTINGS.countdownSeconds || 3);
    setAutoDownload(true);
    setMirrorCamera(true);
    setCameraSourceMode('auto');
    setPrintApiEndpoint(DEFAULT_APP_SETTINGS.printApiEndpoint || '');
    setPrinterName(DEFAULT_APP_SETTINGS.printerName || '');
    setThermalPrinterName(DEFAULT_APP_SETTINGS.thermalPrinterName || '');
    setColorPrinterName(DEFAULT_APP_SETTINGS.colorPrinterName || '');
    setEnableShutterSound(DEFAULT_APP_SETTINGS.enableShutterSound ?? true);
    setThemeColor(DEFAULT_APP_SETTINGS.themeColor || '#E11D48');
    setThemePreset(DEFAULT_APP_SETTINGS.themePreset || 'crimson');
    setKioskBackground('');
    setKioskBackgroundOverlayOpacity(60);
    setCustomBackdropUrl('');
    setIdleScreenMode(DEFAULT_APP_SETTINGS.idleScreenMode || 'standard');
    setImagePreprocessing(DEFAULT_IMAGE_PREPROCESSING);
    setPhotoEnhancer(DEFAULT_PHOTO_ENHANCER);
    setUploadNotice(null);
    setTestApiResult(null);
    applyThemeColor('#E11D48');
    setSaveMessage(
      language === 'en'
        ? 'Settings & theme reset to factory default configuration.'
        : 'Pengaturan & tema dikembalikan ke konfigurasi bawaan pabrik.'
    );
  };

  const handleResetAllSuccess = () => {
    setLanguage('id');
    setDriveUrl(DEFAULT_APP_SETTINGS.driveUrl);
    setStudioName(DEFAULT_APP_SETTINGS.studioName || '');
    setEventName(DEFAULT_APP_SETTINGS.eventName || '');
    setDefaultCaption(DEFAULT_APP_SETTINGS.defaultCaption || 'SOREAJA — PHOTOBOX 2');
    setShowFrameStamps(true);
    setCountdownSeconds(DEFAULT_APP_SETTINGS.countdownSeconds || 3);
    setAutoDownload(true);
    setMirrorCamera(true);
    setCameraSourceMode('auto');
    setPrintApiEndpoint(DEFAULT_APP_SETTINGS.printApiEndpoint || '');
    setPrinterName(DEFAULT_APP_SETTINGS.printerName || '');
    setThermalPrinterName(DEFAULT_APP_SETTINGS.thermalPrinterName || '');
    setColorPrinterName(DEFAULT_APP_SETTINGS.colorPrinterName || '');
    setEnableShutterSound(DEFAULT_APP_SETTINGS.enableShutterSound ?? true);
    setThemeColor(DEFAULT_APP_SETTINGS.themeColor || '#E11D48');
    setThemePreset(DEFAULT_APP_SETTINGS.themePreset || 'crimson');
    setKioskBackground('');
    setKioskBackgroundOverlayOpacity(60);
    setCustomBackdropUrl('');
    setImagePreprocessing(DEFAULT_IMAGE_PREPROCESSING);
    setPhotoEnhancer(DEFAULT_PHOTO_ENHANCER);
    setUploadNotice(null);
    setTestApiResult(null);
    applyThemeColor('#E11D48');
    setSaveMessage(t.admin.resetAllDataSuccess);
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-start gap-4">
        <BrandLogo size="lg" showRing={true} className="ring-neutral-200 mt-1 shadow-xs" />
        <div>
          <div className="text-xs text-neutral-500 flex items-center gap-2 mb-2 font-mono-tabular">
            <span>Konfigurasi Lokal</span>
            <span aria-hidden="true">·</span>
            <span>Dexie.js (PhotoboxDB)</span>
            <span aria-hidden="true">·</span>
            <span>Tabel: settings</span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-neutral-900">
            Pengaturan Studio, Tema & Latar Kiosk
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            Kustomisasi identitas visual booth: tentukan warna tema aksen aplikasi, foto latar belakang
            halaman awal kiosk, stempel cetakan bingkai, serta integrasi Google Drive.
          </p>
        </div>
      </div>

      {/* Navigation Tabs - Tablet Touch Friendly */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('appearance')}
          style={activeTab === 'appearance' ? { borderColor: themeColor, color: themeColor } : {}}
          className={`min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer border-b-2 active:scale-95 ${activeTab === 'appearance'
            ? 'border-b-2 bg-white text-neutral-900 shadow-xs'
            : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
        >
          🎨 {t.admin.settingsTabAppearance}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('packs')}
          style={activeTab === 'packs' ? { borderColor: themeColor, color: themeColor } : {}}
          className={`min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer border-b-2 active:scale-95 ${activeTab === 'packs'
            ? 'border-b-2 bg-white text-neutral-900 shadow-xs'
            : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
        >
          🎁 {t.admin.settingsTabPacks}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('session')}
          style={activeTab === 'session' ? { borderColor: themeColor, color: themeColor } : {}}
          className={`min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer border-b-2 active:scale-95 ${activeTab === 'session'
            ? 'border-b-2 bg-white text-neutral-900 shadow-xs'
            : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
        >
          ☁️ {t.admin.settingsTabSession}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('hardware')}
          style={activeTab === 'hardware' ? { borderColor: themeColor, color: themeColor } : {}}
          className={`min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer border-b-2 active:scale-95 ${activeTab === 'hardware'
            ? 'border-b-2 bg-white text-neutral-900 shadow-xs'
            : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
        >
          📷 {t.admin.settingsTabHardware}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-white border border-neutral-200 rounded-2xl p-6 space-y-6 shadow-xs"
        >
          {/* TAB 1: WARNA TEMA & BACKGROUND KIOSK */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Bagian 0: Bahasa Antarmuka (Language Switcher) */}
              <div className="space-y-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-200/80">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                      <span>🌐</span>
                      <span>{t.admin.languageTitle}</span>
                    </h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {t.admin.languageDesc}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setLanguage('id')}
                    className={`min-h-[58px] p-3.5 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer flex items-center justify-between border ${language === 'id'
                      ? 'bg-[var(--theme-accent,#E11D48)]/10 border-[var(--theme-accent,#E11D48)] ring-2 ring-[var(--theme-accent,#E11D48)] shadow-xs'
                      : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                      }`}
                  >
                    <div className="space-y-0.5">

                      <div className="flex items-center gap-2">
                        <span className="text-base">🇮🇩</span>
                        <span className="text-xs sm:text-sm font-bold text-neutral-900">
                          {t.admin.langId}
                        </span>
                        {language === 'id' && (
                          <span className="text-[10px] bg-[var(--theme-accent,#E11D48)] text-white px-2 py-0.2 rounded-full font-bold">
                            {language === 'id' ? 'Aktif' : 'Active'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        {t.admin.langIdDesc}
                      </p>
                    </div>

                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`min-h-[58px] p-3.5 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer flex items-center justify-between border ${language === 'en'
                      ? 'bg-[var(--theme-accent,#E11D48)]/10 border-[var(--theme-accent,#E11D48)] ring-2 ring-[var(--theme-accent,#E11D48)] shadow-xs'
                      : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                      }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🇬🇧</span>
                        <span className="text-xs sm:text-sm font-bold text-neutral-900">
                          {t.admin.langEn}
                        </span>
                        {language === 'en' && (
                          <span className="text-[10px] bg-[var(--theme-accent,#E11D48)] text-white px-2 py-0.2 rounded-full font-bold">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        {t.admin.langEnDesc}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Bagian 1: Warna Tema */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900">
                      1. {t.admin.themeColorTitle}
                    </h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {t.admin.themeColorDesc}
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono-tabular font-semibold text-white shadow-xs"
                    style={{ backgroundColor: themeColor }}
                  >
                    <span>{themeColor.toUpperCase()}</span>
                  </div>
                </div>

                {/* Preset Palettes */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  {THEME_COLOR_PRESETS.map((preset) => {
                    const isSelected = themePreset === preset.id && themeColor.toLowerCase() === preset.color.toLowerCase();
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectColorPreset(preset.id, preset.color)}
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${isSelected
                          ? 'border-neutral-900 bg-neutral-50 ring-2 ring-neutral-900 shadow-xs'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50'
                          }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full shrink-0 mt-0.5 shadow-xs border border-white"
                          style={{ backgroundColor: preset.color }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-neutral-800 truncate">{preset.name}</p>
                          <p className="text-[10px] text-neutral-500 truncate">{preset.color}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Color Picker */}
                <div className="pt-2 flex items-center gap-3 bg-[#F4F4F0] p-3 rounded-xl border border-neutral-200">
                  <label htmlFor="customColorPicker" className="text-xs font-semibold text-neutral-700 shrink-0">
                    Kustom Warna Bebas:
                  </label>
                  <input
                    id="customColorPicker"
                    type="color"
                    value={themeColor}
                    onChange={(e) => handleCustomColorChange(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-neutral-300 p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={themeColor}
                    maxLength={7}
                    onChange={(e) => handleCustomColorChange(e.target.value)}
                    placeholder="#E11D48"
                    className="px-2.5 py-1 text-xs font-mono-tabular bg-white border border-neutral-300 rounded-lg w-28 uppercase focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </div>

              {/* Bagian 2: Background Foto Start Kiosk */}
              <div className="space-y-4 pt-4 border-t border-neutral-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900">
                      2. Foto Background Layar Mulai Kiosk (/app/idle)
                    </h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Pilih dari preset potret studio SoreAja atau unggah foto/gambar kustom sendiri.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUseDefaultBackdrop}
                    className="text-xs font-medium text-neutral-600 hover:text-neutral-900 underline cursor-pointer"
                  >
                    Gunakan Foto Bawaan
                  </button>
                </div>

                {/* Preset Galeri Foto Studio */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-neutral-700">Pilih dari Galeri Studio Siap Pakai:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {BACKDROP_PRESETS.map((p) => {
                      const isSelected = kioskBackground === p.id || (!kioskBackground && p.id === 'default_sunset');
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectBackdropPreset(p.id)}
                          className={`group relative rounded-xl overflow-hidden border text-left p-1.5 transition-all cursor-pointer ${isSelected
                            ? 'border-neutral-900 ring-2 ring-neutral-900 shadow-md bg-neutral-900 text-white'
                            : 'border-neutral-200 bg-white hover:border-neutral-400'
                            }`}
                        >
                          <div className="aspect-video w-full rounded-lg overflow-hidden bg-neutral-100 relative">
                            <img
                              src={p.src}
                              alt={p.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 bg-black/70 text-white px-1.5 py-0.5 rounded text-[10px] font-mono-tabular">
                                Aktif
                              </div>
                            )}
                          </div>
                          <p className={`text-[11px] font-semibold mt-1 px-1 truncate ${isSelected ? 'text-white' : 'text-neutral-800'}`}>
                            {p.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Unggah Foto Kustom Sendiri */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-neutral-700">Atau Unggah Foto / GIF Kustom Anda Sendiri (Offline):</p>
                    <span className="text-[11px] text-neutral-500">JPG, PNG, WebP, GIF</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Pilih Foto</span>
                    </button>

                    <div className="flex-1 flex gap-2">
                      <input
                        type="url"
                        value={customBackdropUrl}
                        onChange={(e) => setCustomBackdropUrl(e.target.value)}
                        placeholder="Atau URL gambar..."
                        className="flex-1 px-3 py-2 text-xs bg-[#F4F4F0] border border-neutral-300 rounded-xl focus:outline-none focus:border-neutral-900"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCustomUrl}
                        className="px-3 py-2 text-xs font-medium bg-neutral-200 hover:bg-neutral-300 text-neutral-800 rounded-xl transition-colors cursor-pointer"
                      >
                        Pasang
                      </button>
                    </div>
                  </div>

                  {uploadNotice && (
                    <p className="text-xs font-mono-tabular text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
                      {uploadNotice}
                    </p>
                  )}
                </div>

                {/* Pengatur Opasitas / Kecerahan Latar */}
                <div className="space-y-1.5 pt-2 bg-[#F4F4F0] p-4 rounded-xl border border-neutral-200">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="opacitySlider" className="font-semibold text-neutral-800">
                      Kecerahan / Opasitas Foto Latar:
                    </label>
                    <span className="font-mono-tabular font-bold text-neutral-900">
                      {kioskBackgroundOverlayOpacity}%
                    </span>
                  </div>
                  <input
                    id="opacitySlider"
                    type="range"
                    min="20"
                    max="100"
                    step="5"
                    value={kioskBackgroundOverlayOpacity}
                    onChange={(e) => setKioskBackgroundOverlayOpacity(Number(e.target.value))}
                    className="w-full accent-neutral-900 cursor-pointer"
                  />
                </div>

                {/* 3. Mode Tampilan Layar Tunggu Standby */}
                <div className="pt-4 border-t border-neutral-200 space-y-3">
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900">
                      3. Mode Tampilan Layar Standby Kiosk (/app/idle)
                    </h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Pilih format visual yang menyambut tamu saat photobox standby menunggu pengguna baru.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIdleScreenMode('standard')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${idleScreenMode === 'standard'
                        ? 'border-neutral-900 ring-2 ring-neutral-900 bg-neutral-900 text-white shadow-md'
                        : 'border-neutral-200 bg-white hover:border-neutral-400 text-neutral-800'
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">🖼️</span>
                        <p className="text-xs font-bold">Mode Standar (Poster & Galeri)</p>
                      </div>
                      <p className={`text-[11px] ${idleScreenMode === 'standard' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                        Menampilkan poster studio, kolase sesi polaroid melayang, dan tombol sentuh besar.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIdleScreenMode('fullscreen-camera')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${idleScreenMode === 'fullscreen-camera'
                        ? 'border-neutral-900 ring-2 ring-neutral-900 bg-neutral-900 text-white shadow-md'
                        : 'border-neutral-200 bg-white hover:border-neutral-400 text-neutral-800'
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">📸</span>
                        <p className="text-xs font-bold">Kamera Fullscreen ("Foto sekarang simpan nanti")</p>
                      </div>
                      <p className={`text-[11px] ${idleScreenMode === 'fullscreen-camera' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                        Layar penuh kamera live tanpa tombol/elemen lain kecuali teks "Foto sekarang simpan nanti".
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: FRAME PACKS MANAGEMENT */}
          {activeTab === 'packs' && (
            <div className="space-y-6">
              {/* Header & Description */}
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                      <span>🎁</span>
                      <span>{t.admin.framePacksTitle}</span>
                    </h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {t.admin.framePacksSubtitle}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRescanPacks}
                      disabled={isRescanningPacks}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-bold bg-white border border-neutral-300 rounded-xl text-neutral-800 hover:bg-neutral-100 active:scale-95 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span className={isRescanningPacks ? 'animate-spin' : ''}>🔄</span>
                      <span>{isRescanningPacks ? t.admin.rescanningPacks : t.admin.rescanPacksAction}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrecacheAllPacks}
                      disabled={precachingAllPacks}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl active:scale-95 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span className={precachingAllPacks ? 'animate-bounce' : ''}>⚡</span>
                      <span>{precachingAllPacks ? t.admin.precachingProgress : t.admin.precacheAllPacksAction}</span>
                    </button>
                  </div>
                </div>

                {/* Feedback Notices */}
                {packNotice && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <span>✓</span>
                    <span>{packNotice}</span>
                  </div>
                )}

                {precacheProgress && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] font-semibold text-neutral-600">
                      <span>{t.admin.precachingProgress}</span>
                      <span>{precacheProgress.current} / {precacheProgress.total}</span>
                    </div>
                    <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-200"
                        style={{ width: `${Math.round((precacheProgress.current / (precacheProgress.total || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Grid of Frame Packs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availablePacks.map((pack) => {
                  const isActive = pack.id === activeFramePack;
                  return (
                    <div
                      key={pack.id}
                      className={`relative rounded-2xl border p-4.5 flex flex-col justify-between gap-4 transition-all ${isActive
                        ? 'border-[var(--theme-accent,#E11D48)] bg-[var(--theme-accent,#E11D48)]/[0.03] ring-2 ring-[var(--theme-accent,#E11D48)]/40 shadow-xs'
                        : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-2xs'
                        }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-neutral-900 leading-tight">
                                {pack.name}
                              </h3>
                              {pack.isDefault && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-semibold border border-neutral-200">
                                  Default
                                </span>
                              )}
                            </div>
                            {pack.author && (
                              <p className="text-[11px] text-neutral-500">
                                By {pack.author} {pack.version ? `· v${pack.version}` : ''}
                              </p>
                            )}
                          </div>

                          {isActive ? (
                            <span className="shrink-0 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-full flex items-center gap-1 shadow-2xs">
                              <span>✓</span>
                              <span>{t.admin.activePackBadge}</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSelectPack(pack.id)}
                              className="shrink-0 min-h-[34px] px-3 py-1 text-xs font-bold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 rounded-xl transition-all cursor-pointer shadow-2xs"
                            >
                              {t.admin.activatePackAction}
                            </button>
                          )}
                        </div>

                        {/* Pack Cover / Preview Thumbnail */}
                        <div className="h-32 w-full rounded-xl bg-neutral-100 border border-neutral-200/80 overflow-hidden flex items-center justify-center relative">
                          {pack.coverImg ? (
                            <img
                              src={pack.coverImg}
                              alt={pack.name}
                              className="h-full w-full object-contain p-2"
                              loading="lazy"
                            />
                          ) : (
                            <span className="text-3xl text-neutral-300">🖼️</span>
                          )}
                          <span className="absolute bottom-2 right-2 px-2 py-0.5 text-[10px] font-mono font-bold bg-neutral-900/80 text-white rounded-md backdrop-blur-xs">
                            {pack.frameCount || pack.frames?.length || 0} {t.admin.packFramesCount}
                          </span>
                        </div>

                        {pack.description && (
                          <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
                            {pack.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
                        <span className="font-mono">ID: {pack.id}</span>
                        {isActive && (
                          <span className="text-[var(--theme-accent,#E11D48)] font-semibold flex items-center gap-1">
                            <span>●</span>
                            <span>{t.admin.activeKioskIndicator}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Folder Addition Guide */}
              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2 text-neutral-800">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <span>💡</span>
                  <span>{t.admin.packFolderGuideTitle}</span>
                </div>
                <p className="text-xs text-amber-800/90 leading-relaxed">
                  {t.admin.packFolderGuideDesc}
                </p>
                <div className="text-[11px] font-mono bg-white/80 p-2.5 rounded-xl border border-amber-200 text-neutral-700 select-all overflow-x-auto">
                  public/frame-packs/[nama-paket]/pack.json
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE DRIVE & STEMPEL BINGKAI */}
          {activeTab === 'session' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="driveUrlInput"
                  className="block text-sm font-semibold text-neutral-900"
                >
                  Google Drive URL (Tautan Folder Acara)
                </label>
                <input
                  id="driveUrlInput"
                  name="driveUrl"
                  type="url"
                  required
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full px-3.5 py-2.5 text-sm bg-[#F4F4F0] border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900 font-mono-tabular"
                />
                <p className="text-xs text-neutral-500">
                  Disimpan secara reaktif dengan primary key{' '}
                  <code className="font-mono-tabular text-neutral-800">app_settings</code>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-200">
                <div className="space-y-1.5">
                  <label
                    htmlFor="studioNameInput"
                    className="block text-xs font-semibold text-neutral-700"
                  >
                    Nama Unit Booth
                  </label>
                  <input
                    id="studioNameInput"
                    type="text"
                    value={studioName}
                    onChange={(e) => setStudioName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#F4F4F0] border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="eventNameInput"
                    className="block text-xs font-semibold text-neutral-700"
                  >
                    Nama Acara / Klien
                  </label>
                  <input
                    id="eventNameInput"
                    type="text"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#F4F4F0] border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-neutral-200">
                <label
                  htmlFor="defaultCaptionInput"
                  className="block text-xs font-semibold text-neutral-700"
                >
                  Default Teks Stempel Bawah Bingkai (Caption Cetakan)
                </label>
                <input
                  id="defaultCaptionInput"
                  type="text"
                  maxLength={32}
                  value={defaultCaption}
                  onChange={(e) => setDefaultCaption(e.target.value)}
                  placeholder="SOREAJA Pose"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#F4F4F0] border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900 font-mono-tabular"
                />
                <p className="text-xs text-neutral-500">
                  Teks ini menjadi nilai default stempel di bagian bawah bingkai foto pada setiap sesi photobox baru.
                </p>
              </div>

              <div className="space-y-3 pt-2 border-t border-neutral-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFrameStamps}
                    onChange={(e) => setShowFrameStamps(e.target.checked)}
                    style={{ accentColor: themeColor }}
                    className="w-4 h-4 mt-0.5 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-medium text-neutral-800">
                      Tampilkan stempel teks pada bingkai (Header & Footer Stamp)
                    </span>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Hilangkan centang jika Anda menggunakan desain custom frame yang tidak kompatibel dengan teks stempel atau sudah memiliki logo/branding tersendiri.
                    </p>
                  </div>
                </label>
              </div>

              {/* Konfigurasi Timer Sesi Photobox */}
              <div className="space-y-3 pt-3 border-t border-neutral-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSessionTimer}
                    onChange={(e) => setEnableSessionTimer(e.target.checked)}
                    style={{ accentColor: themeColor }}
                    className="w-4 h-4 mt-0.5 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-semibold text-neutral-800">
                      Aktifkan Timer Sesi Kiosk (dengan audio chime & dialog pengingat)
                    </span>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Menghitung mundur durasi sesi photobox pelanggan di bar navigasi atas. Bila waktu habis, chime audio dan dialog pengingat akan muncul tanpa menutup sesi secara paksa.
                    </p>
                  </div>
                </label>

                {enableSessionTimer && (
                  <div className="pl-7 pt-1 max-w-sm">
                    <label
                      htmlFor="sessionDurationInput"
                      className="block text-xs font-semibold text-neutral-700 mb-1"
                    >
                      Durasi Sesi Pelanggan (Menit)
                    </label>
                    <div className="flex items-center gap-2.5">
                      <input
                        id="sessionDurationInput"
                        type="number"
                        min={1}
                        max={60}
                        value={sessionDurationMinutes}
                        onChange={(e) =>
                          setSessionDurationMinutes(
                            Math.max(1, Math.min(60, Number(e.target.value) || 5))
                          )
                        }
                        className="w-24 px-3 py-2 text-sm bg-[#F4F4F0] border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900 font-mono-tabular"
                      />
                      <span className="text-xs text-neutral-600 font-medium">
                        Menit (Standar: 5 Menit)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: KAMERA & CETAK OTOMATIS */}
          {activeTab === 'hardware' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="countdownSelect"
                    className="block text-xs font-semibold text-neutral-700"
                  >
                    Durasi Countdown Kamera
                  </label>
                  <select
                    id="countdownSelect"
                    value={countdownSeconds}
                    onChange={(e) => setCountdownSeconds(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-[#F4F4F0] border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900 font-mono-tabular"
                  >
                    <option value={1}>1 Detik (Cepat / Uji Coba)</option>
                    <option value={2}>2 Detik</option>
                    <option value={3}>3 Detik (Standar Studio)</option>
                    <option value={5}>5 Detik (Grup Besar)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="cameraSourceSelect"
                    className="block text-xs font-semibold text-neutral-700"
                  >
                    Sumber Kamera
                  </label>
                  <select
                    id="cameraSourceSelect"
                    value={cameraSourceMode}
                    onChange={(e) =>
                      setCameraSourceMode(e.target.value as 'auto' | 'gphoto' | 'simulator')
                    }
                    className="w-full px-3 py-2 text-sm bg-[#F4F4F0] border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900"
                  >
                    <option value="auto">Otomatis (WebRTC + Fallback Simulator)</option>
                    <option value="gphoto">Kamera Eksternal DSLR/Mirrorless (web-gphoto2 WebUSB)</option>
                    <option value="simulator">Paksa Mode Simulator Studio</option>
                  </select>
                </div>
                {/* DSLR diagnostics & test pairing in Admin */}
                <div className="mt-2 p-3 bg-neutral-100 rounded-lg border border-neutral-200 text-xs space-y-2 col-span-full">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-700">Kamera DSLR (WebUSB):</span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <span
                        className={`w-2 h-2 rounded-full ${dslrStatus.isConnected
                          ? 'bg-emerald-500 animate-pulse'
                          : dslrStatus.isConnecting
                            ? 'bg-amber-500 animate-pulse'
                            : 'bg-neutral-400'
                          }`}
                      />
                      <span className={dslrStatus.isConnected ? 'text-emerald-700' : 'text-neutral-600'}>
                        {dslrStatus.isConnected
                          ? dslrStatus.modelName || 'DSLR Terhubung'
                          : dslrStatus.isConnecting
                            ? 'Menghubungkan...'
                            : 'Tidak Terhubung'}
                      </span>
                    </span>
                  </div>

                  {!dslrStatus.isSupported ? (
                    <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                      ⚠️ Browser tidak mendukung WebUSB atau koneksi bukan HTTPS/localhost. Gunakan Google Chrome/Edge.
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 pt-1">
                      {!dslrStatus.isConnected ? (
                        <button
                          type="button"
                          onClick={handleConnectDslr}
                          disabled={dslrStatus.isConnecting}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                        >
                          <span>🔌</span>
                          <span>Hubungkan / Uji Kamera DSLR</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleDisconnectDslr}
                          className="px-3 py-1.5 text-xs font-semibold bg-neutral-200 hover:bg-rose-100 text-neutral-800 hover:text-rose-700 rounded-md transition-all border border-neutral-300 cursor-pointer"
                        >
                          ✕ Putuskan DSLR
                        </button>
                      )}
                    </div>
                  )}

                  {dslrStatus.isConnected && dslrStatus.config && (
                    <div className="mt-2.5 pt-2 border-t border-neutral-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-neutral-800 text-[11px] uppercase tracking-wide">
                          Konfigurasi Hardware Kamera:
                        </span>
                        <button
                          type="button"
                          onClick={handleRefreshDslrConfig}
                          disabled={syncingDslrConfig}
                          className="text-[11px] px-2 py-0.5 rounded bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-medium transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <span className={syncingDslrConfig ? 'animate-spin' : ''}>🔄</span>
                          <span>{syncingDslrConfig ? 'Menyinkronkan...' : 'Sinkron dari Kamera'}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        {/* ISO */}
                        {dslrStatus.config['iso'] && (
                          <div className="bg-white p-2 rounded border border-neutral-200">
                            <span className="text-[10px] text-neutral-500 font-bold block uppercase">ISO</span>
                            {dslrStatus.config['iso'].choices && dslrStatus.config['iso'].choices.length > 0 ? (
                              <select
                                value={String(dslrStatus.config['iso'].value)}
                                onChange={(e) => handleSetDslrConfig('iso', e.target.value)}
                                className="w-full text-xs font-semibold bg-neutral-50 border border-neutral-300 rounded p-1 mt-0.5"
                              >
                                {dslrStatus.config['iso'].choices.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="font-mono text-xs font-bold text-neutral-800">{String(dslrStatus.config['iso'].value)}</span>
                            )}
                          </div>
                        )}

                        {/* Shutter */}
                        {(dslrStatus.config['shutterspeed'] || dslrStatus.config['shutter-speed']) && (() => {
                          const f = dslrStatus.config['shutterspeed'] || dslrStatus.config['shutter-speed'];
                          return (
                            <div className="bg-white p-2 rounded border border-neutral-200">
                              <span className="text-[10px] text-neutral-500 font-bold block uppercase">Shutter</span>
                              {f.choices && f.choices.length > 0 ? (
                                <select
                                  value={String(f.value)}
                                  onChange={(e) => handleSetDslrConfig(f.name, e.target.value)}
                                  className="w-full text-xs font-semibold bg-neutral-50 border border-neutral-300 rounded p-1 mt-0.5"
                                >
                                  {f.choices.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="font-mono text-xs font-bold text-neutral-800">{String(f.value)}</span>
                              )}
                            </div>
                          );
                        })()}

                        {/* Aperture */}
                        {(dslrStatus.config['aperture'] || dslrStatus.config['f-number']) && (() => {
                          const f = dslrStatus.config['aperture'] || dslrStatus.config['f-number'];
                          return (
                            <div className="bg-white p-2 rounded border border-neutral-200">
                              <span className="text-[10px] text-neutral-500 font-bold block uppercase">Aperture</span>
                              {f.choices && f.choices.length > 0 ? (
                                <select
                                  value={String(f.value)}
                                  onChange={(e) => handleSetDslrConfig(f.name, e.target.value)}
                                  className="w-full text-xs font-semibold bg-neutral-50 border border-neutral-300 rounded p-1 mt-0.5"
                                >
                                  {f.choices.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="font-mono text-xs font-bold text-neutral-800">{String(f.value)}</span>
                              )}
                            </div>
                          );
                        })()}

                        {/* White Balance */}
                        {(dslrStatus.config['whitebalance'] || dslrStatus.config['white-balance']) && (() => {
                          const f = dslrStatus.config['whitebalance'] || dslrStatus.config['white-balance'];
                          return (
                            <div className="bg-white p-2 rounded border border-neutral-200">
                              <span className="text-[10px] text-neutral-500 font-bold block uppercase">WB</span>
                              {f.choices && f.choices.length > 0 ? (
                                <select
                                  value={String(f.value)}
                                  onChange={(e) => handleSetDslrConfig(f.name, e.target.value)}
                                  className="w-full text-xs font-semibold bg-neutral-50 border border-neutral-300 rounded p-1 mt-0.5"
                                >
                                  {f.choices.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="font-mono text-xs font-bold text-neutral-800">{String(f.value)}</span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-neutral-200">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoDownload}
                    onChange={(e) => setAutoDownload(e.target.checked)}
                    style={{ accentColor: themeColor }}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  <span className="text-sm text-neutral-800">
                    Unduh otomatis seluruh file sesi (Raw PNG, Final Frame, dan Animasi GIF)
                    saat layar cetak terbuka
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mirrorCamera}
                    onChange={(e) => setMirrorCamera(e.target.checked)}
                    style={{ accentColor: themeColor }}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  <span className="text-sm text-neutral-800">
                    Efek Cermin (Mirror Horizontal) pada pratinjau kamera pelanggan
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCropGuide}
                    onChange={(e) => setShowCropGuide(e.target.checked)}
                    style={{ accentColor: themeColor }}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  <span className="text-sm text-neutral-800">
                    Tampilkan Panduan Batas Crop Kamera secara default (menampilkan area yang terpotong saat ukuran foto bingkai berbeda dari rasio kamera)
                  </span>
                </label>
              </div>

              {/* Bagian: Pra-pemrosesan Citra Kamera (Image Preprocessing) */}
              <div className="pt-4 border-t border-neutral-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                      <span>🎨 Image Preprocessing</span>
                      {!isPreprocessingNeutral(imagePreprocessing) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-300">
                          Aktif
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Kalibrasi warna sumber kamera.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setImagePreprocessing((prev) => ({ ...prev, enabled: !prev.enabled }))
                      }
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${imagePreprocessing.enabled !== false
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : 'bg-neutral-100 text-neutral-500 border-neutral-300'
                        }`}
                    >
                      {imagePreprocessing.enabled !== false ? 'Aktif' : 'Nonaktif'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setImagePreprocessing(DEFAULT_IMAGE_PREPROCESSING)}
                      className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-lg transition-colors cursor-pointer"
                    >
                      ↺ Reset
                    </button>
                  </div>
                </div>

                {/* Interactive Live Comparison Card - Driven by Selected Camera from Settings */}
                <div className="bg-[#FAF9F5] p-4 rounded-xl border border-neutral-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide flex items-center gap-1.5">
                      <span>👁️</span>
                      <span>Komparasi Visual</span>
                      <span className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700 font-sans normal-case">
                        Kamera: {cameraSourceMode === 'gphoto' ? '📸 DSLR (WebUSB)' : cameraSourceMode === 'simulator' ? '🖥️ Simulator Studio' : '📹 Webcam Live'}
                      </span>
                    </span>
                    {cameraSourceMode === 'simulator' && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-neutral-500">Pose Uji:</span>
                        {STUDIO_PORTRAITS.map((p, idx) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPreviewPoseIdx(idx)}
                            className={`w-6 h-6 text-[10px] font-mono font-bold rounded cursor-pointer transition-all ${previewPoseIdx === idx
                              ? 'bg-neutral-900 text-white'
                              : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-700'
                              }`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 1. If Camera Source Setting is gPhoto DSLR */}
                  {cameraSourceMode === 'gphoto' && (
                    dslrStatus.isConnected && dslrLiveFrame ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Sebelum */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-neutral-600 font-semibold">
                            <span>Sebelum</span>
                            <span className="text-neutral-400 font-mono">filter: none</span>
                          </div>
                          <div className="relative aspect-4/3 rounded-lg overflow-hidden bg-black border border-neutral-300">
                            <img
                              src={dslrLiveFrame}
                              alt="Sebelum"
                              className={`w-full h-full object-cover ${mirrorCamera ? 'scale-x-[-1]' : ''}`}
                            />
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono">
                              RAW DSLR LIVE
                            </span>
                          </div>
                        </div>

                        {/* Sesudah */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-900">
                            <span>Sesudah</span>
                            <span className="text-emerald-700 font-mono text-[10px]">
                              {isPreprocessingNeutral(imagePreprocessing) ? 'Netral' : 'Teraplikasi'}
                            </span>
                          </div>
                          <div className="relative aspect-4/3 rounded-lg overflow-hidden bg-black border border-neutral-300">
                            <img
                              src={dslrLiveFrame}
                              alt="Sesudah"
                              style={{
                                filter:
                                  imagePreprocessing.enabled !== false
                                    ? getPreprocessingCssFilter(imagePreprocessing)
                                    : 'none',
                              }}
                              className={`w-full h-full object-cover ${mirrorCamera ? 'scale-x-[-1]' : ''}`}
                            />
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-[var(--theme-accent,#E11D48)] text-white text-[10px] font-bold">
                              PREPROCESSED
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 rounded-lg bg-white border border-neutral-200 text-center space-y-3">
                        <span className="text-3xl">📸</span>
                        <div className="space-y-1">
                          <h5 className="text-xs font-bold text-neutral-800">
                            Kamera DSLR (Sesuai Pengaturan: WebUSB) Belum Terhubung
                          </h5>
                          <p className="text-[11px] text-neutral-500 max-w-md mx-auto">
                            Pengaturan kamera saat ini adalah DSLR. Sambungkan kamera melalui kabel USB dan klik tombol di bawah untuk mengaktifkan live view sensor.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleConnectDslr}
                          disabled={dslrStatus.isConnecting}
                          className="px-3.5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          <span>🔌</span>
                          <span>{dslrStatus.isConnecting ? 'Menghubungkan...' : 'Hubungkan Kamera DSLR'}</span>
                        </button>
                      </div>
                    )
                  )}

                  {/* 2. If Camera Source Setting is WebRTC (auto) */}
                  {cameraSourceMode === 'auto' && (
                    testWebcamActive ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Sebelum */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-neutral-600 font-semibold">
                            <span>Sebelum (Sensor Asli Webcam)</span>
                            <span className="text-neutral-400 font-mono">filter: none</span>
                          </div>
                          <div className="relative aspect-4/3 rounded-lg overflow-hidden bg-black border border-neutral-300 flex items-center justify-center">
                            <video
                              ref={(el) => {
                                if (el && testStreamRef.current && el.srcObject !== testStreamRef.current) {
                                  el.srcObject = testStreamRef.current;
                                  el.play().catch(() => { });
                                }
                              }}
                              playsInline
                              autoPlay
                              muted
                              className={`w-full h-full object-cover ${mirrorCamera ? 'scale-x-[-1]' : ''}`}
                            />
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono">
                              RAW WEBCAM LIVE
                            </span>
                          </div>
                        </div>

                        {/* Sesudah */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-900">
                            <span>Sesudah (Terkalibrasi Studio)</span>
                            <span className="text-emerald-700 font-mono text-[10px]">
                              {isPreprocessingNeutral(imagePreprocessing) ? 'Netral' : 'Teraplikasi'}
                            </span>
                          </div>
                          <div className="relative aspect-4/3 rounded-lg overflow-hidden bg-black border border-neutral-300 flex items-center justify-center">
                            <video
                              ref={(el) => {
                                if (el && testStreamRef.current && el.srcObject !== testStreamRef.current) {
                                  el.srcObject = testStreamRef.current;
                                  el.play().catch(() => { });
                                }
                              }}
                              playsInline
                              autoPlay
                              muted
                              style={{
                                filter:
                                  imagePreprocessing.enabled !== false
                                    ? getPreprocessingCssFilter(imagePreprocessing)
                                    : 'none',
                              }}
                              className={`w-full h-full object-cover ${mirrorCamera ? 'scale-x-[-1]' : ''}`}
                            />
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-[var(--theme-accent,#E11D48)] text-white text-[10px] font-bold">
                              PREPROCESSED
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 rounded-lg bg-white border border-neutral-200 text-center space-y-3">
                        <span className="text-3xl">📹</span>
                        <div className="space-y-1">
                          <h5 className="text-xs font-bold text-neutral-800">
                            Kamera Webcam (Sesuai Pengaturan: Otomatis / WebRTC)
                          </h5>
                          <p className="text-[11px] text-neutral-500 max-w-md mx-auto">
                            Nyalakan kamera untuk melihat pratinjau komparasi filter sebelum vs sesudah langsung dari kamera aktif.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleToggleTestWebcam}
                          className="px-3.5 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <span>📹</span>
                          <span>Buka Live Camera untuk Pratinjau</span>
                        </button>
                      </div>
                    )
                  )}

                  {/* 3. If Camera Source Setting is Simulator */}
                  {cameraSourceMode === 'simulator' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Original Raw Preview */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-neutral-600 font-semibold">
                          <span>Sebelum (Asli Sensor / Netral)</span>
                          <span className="text-neutral-400 font-mono">filter: none</span>
                        </div>
                        <div className="relative aspect-4/3 rounded-lg overflow-hidden bg-black border border-neutral-300">
                          <img
                            src={STUDIO_PORTRAITS[previewPoseIdx % STUDIO_PORTRAITS.length].src}
                            alt="Sebelum"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono">
                            RAW SIMULATOR
                          </span>
                        </div>
                      </div>

                      {/* Preprocessed Result Preview */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-900">
                          <span>Sesudah (Terkalibrasi Studio)</span>
                          <span className="text-emerald-700 font-mono text-[10px] truncate max-w-[150px]">
                            {isPreprocessingNeutral(imagePreprocessing) ? 'Netral' : 'Teraplikasi'}
                          </span>
                        </div>
                        <div className="relative aspect-4/3 rounded-lg overflow-hidden bg-black border border-neutral-300">
                          <img
                            src={STUDIO_PORTRAITS[previewPoseIdx % STUDIO_PORTRAITS.length].src}
                            alt="Sesudah"
                            style={{
                              filter:
                                imagePreprocessing.enabled !== false
                                  ? getPreprocessingCssFilter(imagePreprocessing)
                                  : 'none',
                            }}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-[var(--theme-accent,#E11D48)] text-white text-[10px] font-bold">
                            PREPROCESSED
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Real Test Capture Control & Result Card */}
                <div className="bg-white p-4 rounded-xl border border-neutral-300 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-1.5">
                        <span>📸</span>
                        <span>Uji Jepret Kamera</span>
                      </h4>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Ambil foto uji dari kamera aktif sesuai pengaturan: <strong className="text-neutral-800">{cameraSourceMode === 'gphoto' ? (dslrStatus.modelName || 'Kamera DSLR (WebUSB)') : cameraSourceMode === 'simulator' ? 'Simulator Studio' : 'Webcam Live (WebRTC)'}</strong> dan proses langsung melalui engine kalibrasi.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {cameraSourceMode === 'auto' && (
                        <button
                          type="button"
                          onClick={handleToggleTestWebcam}
                          className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${testWebcamActive
                            ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border-rose-300'
                            : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-300'
                            }`}
                          title="Nyalakan kamera webcam langsung untuk uji coba pose Anda sendiri"
                        >
                          <span>{testWebcamActive ? '✕' : '📹'}</span>
                          <span>{testWebcamActive ? (t.camera.preprocessing?.testWebcamClose || 'Tutup Kamera Uji') : (t.camera.preprocessing?.testWebcamOpen || 'Aktifkan Kamera Uji')}</span>
                        </button>
                      )}

                      {cameraSourceMode === 'gphoto' && !dslrStatus.isConnected && (
                        <button
                          type="button"
                          onClick={handleConnectDslr}
                          disabled={dslrStatus.isConnecting}
                          className="px-3 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <span>🔌</span>
                          <span>{dslrStatus.isConnecting ? 'Menghubungkan...' : 'Hubungkan Kamera DSLR'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handlePerformTestCapture}
                        disabled={isTestCapturing}
                        className="px-4 py-2 text-xs font-bold bg-[var(--theme-accent,#E11D48)] hover:brightness-110 active:scale-95 text-white rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                      >
                        <span>{isTestCapturing ? '⏳' : '📸'}</span>
                        <span>{isTestCapturing ? 'Diproses...' : (t.camera.preprocessing?.testCaptureBtn || 'Ambil Foto Uji Coba')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Live Webcam Test Box */}
                  {testWebcamActive && (
                    <div className="bg-black rounded-xl overflow-hidden border border-neutral-800 p-3 space-y-2 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-xs text-white">
                        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Kamera Uji Live (Viewfinder)</span>
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          Efek filter live terpasang di layar
                        </span>
                      </div>
                      <div className="relative aspect-video max-h-72 w-full rounded-lg overflow-hidden bg-zinc-950 flex items-center justify-center">
                        <video
                          ref={testVideoRef}
                          playsInline
                          autoPlay
                          muted
                          style={{
                            filter: imagePreprocessing.enabled !== false
                              ? getPreprocessingCssFilter(imagePreprocessing)
                              : 'none',
                          }}
                          className={`w-full h-full object-contain ${mirrorCamera ? 'scale-x-[-1]' : ''}`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Real Test Capture Output Result Display */}
                  {testCaptureResult && (
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                          <div>
                            <span className="text-xs font-bold text-emerald-900 block">
                              {t.camera.preprocessing?.testCaptureTitle || 'Hasil Jepretan Uji Nyata'}
                            </span>
                            <span className="text-[11px] text-emerald-700 font-mono">
                              {testCaptureResult.source} · {testCaptureResult.width}×{testCaptureResult.height}px · {testCaptureResult.durationMs}ms processing · {testCaptureResult.timestamp}
                            </span>
                          </div>
                        </div>

                        {/* View Mode Switcher & Actions */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <div className="bg-white/80 p-0.5 rounded-lg border border-emerald-300 flex items-center text-[11px] font-medium">
                            <button
                              type="button"
                              onClick={() => setTestCaptureTab('processed')}
                              className={`px-2 py-1 rounded cursor-pointer transition-all ${testCaptureTab === 'processed'
                                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                : 'text-emerald-900 hover:text-black'
                                }`}
                            >
                              {t.camera.preprocessing?.processedView || 'Hasil'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setTestCaptureTab('raw')}
                              className={`px-2 py-1 rounded cursor-pointer transition-all ${testCaptureTab === 'raw'
                                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                : 'text-emerald-900 hover:text-black'
                                }`}
                            >
                              {t.camera.preprocessing?.rawView || 'Asli (Sensor)'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setTestCaptureTab('side-by-side')}
                              className={`px-2 py-1 rounded cursor-pointer transition-all ${testCaptureTab === 'side-by-side'
                                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                : 'text-emerald-900 hover:text-black'
                                }`}
                            >
                              {t.camera.preprocessing?.sideBySideView || 'Berdampingan'}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setTestCaptureViewModal(true)}
                            className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-lg transition-all cursor-pointer shadow-xs"
                            title="Buka gambar ukuran penuh"
                          >
                            {t.camera.preprocessing?.viewFullBtn || '🔍 Perbesar'}
                          </button>

                          <button
                            type="button"
                            onClick={handleDownloadTestCapture}
                            className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-lg transition-all cursor-pointer shadow-xs"
                            title="Unduh file hasil uji coba"
                          >
                            {t.camera.preprocessing?.downloadTestBtn || '⬇️ Unduh'}
                          </button>
                        </div>
                      </div>

                      {/* Display Picture(s) */}
                      {testCaptureTab === 'side-by-side' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-neutral-700 block">
                              1. Sensor Mentah Asli (Raw Input)
                            </span>
                            <div className="relative aspect-4/3 rounded-lg overflow-hidden bg-black border border-neutral-300">
                              <img
                                src={testCaptureResult.rawUrl}
                                alt="Raw Sensor Capture"
                                className="w-full h-full object-contain"
                              />
                              <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono">
                                RAW SENSOR
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-emerald-800 block">
                              2. Hasil Nyata Kalibrasi (Engine Output)
                            </span>
                            <div className="relative aspect-4/3 rounded-lg overflow-hidden bg-black border border-emerald-400 shadow-md">
                              <img
                                src={testCaptureResult.processedUrl}
                                alt="Processed Real Output"
                                className="w-full h-full object-contain"
                              />
                              <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                                PREPROCESSED OUTPUT
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="relative aspect-16/9 sm:aspect-21/9 max-h-80 w-full rounded-lg overflow-hidden bg-black border border-emerald-300 flex items-center justify-center">
                          <img
                            src={testCaptureTab === 'raw' ? testCaptureResult.rawUrl : testCaptureResult.processedUrl}
                            alt="Hasil Jepretan Uji"
                            className="w-full h-full object-contain"
                          />
                          <span className={`absolute bottom-2 left-2 px-2.5 py-1 rounded text-xs font-bold ${testCaptureTab === 'raw'
                            ? 'bg-black/85 text-white font-mono'
                            : 'bg-emerald-600 text-white shadow-md'
                            }`}>
                            {testCaptureTab === 'raw' ? 'SENSOR RAW ASLI' : 'HASIL NYATA KALIBRASI (PIXEL ENGINE)'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Preset Buttons */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-neutral-700 block">
                    Pilihan Preset Cepat Studio:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PREPROCESSING_PRESETS.map((preset) => {
                      const isMatched =
                        (imagePreprocessing.brightness ?? 0) === preset.settings.brightness &&
                        (imagePreprocessing.contrast ?? 0) === preset.settings.contrast &&
                        (imagePreprocessing.saturation ?? 0) === preset.settings.saturation &&
                        (imagePreprocessing.ambiance ?? 0) === preset.settings.ambiance &&
                        (imagePreprocessing.highlights ?? 0) === preset.settings.highlights &&
                        (imagePreprocessing.shadows ?? 0) === preset.settings.shadows &&
                        (imagePreprocessing.warmth ?? 0) === preset.settings.warmth;

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            setImagePreprocessing({
                              ...preset.settings,
                              enabled: true,
                            })
                          }
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${isMatched
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm font-semibold'
                            : 'bg-white hover:bg-neutral-100 text-neutral-800 border-neutral-300'
                            }`}
                        >
                          <span>{preset.icon}</span>
                          <span>{preset.nameId}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 7 Adjustment Sliders in 2 Columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                  {/* 1. Brightness */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-neutral-800 flex items-center gap-1.5">
                        <span>☀️</span>
                        <span>Kecerahan (Brightness)</span>
                      </label>
                      <span className="font-mono text-xs font-bold text-neutral-900 px-1.5 py-0.5 rounded bg-white border border-neutral-200">
                        {imagePreprocessing.brightness > 0 ? `+${imagePreprocessing.brightness}` : imagePreprocessing.brightness}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={imagePreprocessing.brightness ?? 0}
                      onChange={(e) =>
                        setImagePreprocessing((prev) => ({
                          ...prev,
                          brightness: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[var(--theme-accent,#E11D48)] cursor-pointer"
                    />
                    <p className="text-[11px] text-neutral-500">Mengatur tingkat exposure dan pencahayaan global.</p>
                  </div>

                  {/* 2. Contrast */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-neutral-800 flex items-center gap-1.5">
                        <span>🌓</span>
                        <span>Kontras (Contrast)</span>
                      </label>
                      <span className="font-mono text-xs font-bold text-neutral-900 px-1.5 py-0.5 rounded bg-white border border-neutral-200">
                        {imagePreprocessing.contrast > 0 ? `+${imagePreprocessing.contrast}` : imagePreprocessing.contrast}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={imagePreprocessing.contrast ?? 0}
                      onChange={(e) =>
                        setImagePreprocessing((prev) => ({
                          ...prev,
                          contrast: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[var(--theme-accent,#E11D48)] cursor-pointer"
                    />
                    <p className="text-[11px] text-neutral-500">Mempertegas rentang dinamis antara area gelap dan terang.</p>
                  </div>

                  {/* 3. Saturation */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-neutral-800 flex items-center gap-1.5">
                        <span>🎨</span>
                        <span>Saturasi (Saturation)</span>
                      </label>
                      <span className="font-mono text-xs font-bold text-neutral-900 px-1.5 py-0.5 rounded bg-white border border-neutral-200">
                        {imagePreprocessing.saturation > 0 ? `+${imagePreprocessing.saturation}` : imagePreprocessing.saturation}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={imagePreprocessing.saturation ?? 0}
                      onChange={(e) =>
                        setImagePreprocessing((prev) => ({
                          ...prev,
                          saturation: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[var(--theme-accent,#E11D48)] cursor-pointer"
                    />
                    <p className="text-[11px] text-neutral-500">Mengontrol kepekatan dan kekayaan warna gambar.</p>
                  </div>

                  {/* 4. Ambiance */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-neutral-800 flex items-center gap-1.5">
                        <span>✨</span>
                        <span>Ambiance (Fill Light & Balance)</span>
                      </label>
                      <span className="font-mono text-xs font-bold text-neutral-900 px-1.5 py-0.5 rounded bg-white border border-neutral-200">
                        {imagePreprocessing.ambiance > 0 ? `+${imagePreprocessing.ambiance}` : imagePreprocessing.ambiance}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={imagePreprocessing.ambiance ?? 0}
                      onChange={(e) =>
                        setImagePreprocessing((prev) => ({
                          ...prev,
                          ambiance: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[var(--theme-accent,#E11D48)] cursor-pointer"
                    />
                    <p className="text-[11px] text-neutral-500">Keseimbangan pencahayaan dinamis & kejelasan midtone.</p>
                  </div>

                  {/* 5. Highlights */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-neutral-800 flex items-center gap-1.5">
                        <span>🔆</span>
                        <span>Highlights (Area Terang)</span>
                      </label>
                      <span className="font-mono text-xs font-bold text-neutral-900 px-1.5 py-0.5 rounded bg-white border border-neutral-200">
                        {imagePreprocessing.highlights > 0 ? `+${imagePreprocessing.highlights}` : imagePreprocessing.highlights}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={imagePreprocessing.highlights ?? 0}
                      onChange={(e) =>
                        setImagePreprocessing((prev) => ({
                          ...prev,
                          highlights: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[var(--theme-accent,#E11D48)] cursor-pointer"
                    />
                    <p className="text-[11px] text-neutral-500">Meredam overexposure atau mempertegas kilau putih.</p>
                  </div>

                  {/* 6. Shadows */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-neutral-800 flex items-center gap-1.5">
                        <span>👥</span>
                        <span>Shadows (Area Gelap)</span>
                      </label>
                      <span className="font-mono text-xs font-bold text-neutral-900 px-1.5 py-0.5 rounded bg-white border border-neutral-200">
                        {imagePreprocessing.shadows > 0 ? `+${imagePreprocessing.shadows}` : imagePreprocessing.shadows}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={imagePreprocessing.shadows ?? 0}
                      onChange={(e) =>
                        setImagePreprocessing((prev) => ({
                          ...prev,
                          shadows: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[var(--theme-accent,#E11D48)] cursor-pointer"
                    />
                    <p className="text-[11px] text-neutral-500">Mengangkat detail bayangan pada wajah dan pakaian gelap.</p>
                  </div>

                  {/* 7. Warmth */}
                  <div className="space-y-1 sm:col-span-2">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-neutral-800 flex items-center gap-1.5">
                        <span>🌡️</span>
                        <span>Temperatur Warna (Warmth / Kelvin)</span>
                        <span className="text-[11px] text-neutral-500 font-normal">
                          ({imagePreprocessing.warmth < 0 ? 'Dingin / Biru' : imagePreprocessing.warmth > 0 ? 'Hangat / Oranye' : 'Netral'})
                        </span>
                      </label>
                      <span className="font-mono text-xs font-bold text-neutral-900 px-1.5 py-0.5 rounded bg-white border border-neutral-200">
                        {imagePreprocessing.warmth > 0 ? `+${imagePreprocessing.warmth}` : imagePreprocessing.warmth}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={imagePreprocessing.warmth ?? 0}
                      onChange={(e) =>
                        setImagePreprocessing((prev) => ({
                          ...prev,
                          warmth: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[var(--theme-accent,#E11D48)] cursor-pointer"
                    />
                    <p className="text-[11px] text-neutral-500">Mengatur white balance antara sejuk (dingin) dan keemasan (hangat).</p>
                  </div>
                </div>
              </div>

              {/* Bagian: Studio Photo Enhancer (Ringan - Toggleable) */}
              <div className="pt-4 border-t border-neutral-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2 flex-wrap">
                      <span>✨ {t.admin.photoEnhancer.title}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                          photoEnhancer.enabled
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-neutral-100 text-neutral-600 border-neutral-300'
                        }`}
                      >
                        {photoEnhancer.enabled
                          ? t.admin.photoEnhancer.activeBadge
                          : t.admin.photoEnhancer.inactiveBadge}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono border bg-sky-50 text-sky-700 border-sky-200">
                        {t.admin.photoEnhancer.engineReady}
                      </span>
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {t.admin.photoEnhancer.subtitle}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      data-testid="toggle-photo-enhancer-btn"
                      onClick={() =>
                        setPhotoEnhancer((prev) => ({ ...prev, enabled: !prev.enabled }))
                      }
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        photoEnhancer.enabled
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-neutral-100 text-neutral-600 border-neutral-300 hover:bg-neutral-200'
                      }`}
                    >
                      {photoEnhancer.enabled
                        ? t.admin.photoEnhancer.activeBadge
                        : t.admin.photoEnhancer.inactiveBadge}
                    </button>

                    <button
                      type="button"
                      onClick={() => setPhotoEnhancer(DEFAULT_PHOTO_ENHANCER)}
                      className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-lg transition-colors cursor-pointer"
                    >
                      ↺ Reset
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                  <input
                    type="checkbox"
                    checked={photoEnhancer.enabled}
                    onChange={(e) =>
                      setPhotoEnhancer((prev) => ({ ...prev, enabled: e.target.checked }))
                    }
                    style={{ accentColor: themeColor }}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  <span className="text-sm font-medium text-neutral-800">
                    {t.admin.photoEnhancer.enableLabel}
                  </span>
                </label>

                <div className="space-y-3 bg-[#FAF9F5] p-4 rounded-xl border border-neutral-200">
                  <div>
                    <span className="text-xs font-bold text-neutral-700 uppercase tracking-wide block mb-2">
                      {t.admin.photoEnhancer.presetLabel}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {ENHANCER_PRESETS.map((preset) => {
                        const isSelected = photoEnhancer.preset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() =>
                              setPhotoEnhancer((prev) => ({
                                ...prev,
                                preset: preset.id,
                                upscaleScale: preset.upscaleScale,
                                sharpenAmount: preset.sharpenAmount,
                                denoiseLevel: preset.denoiseLevel,
                                autoTone: preset.autoTone,
                              }))
                            }
                            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-white border-neutral-900 ring-1 ring-neutral-900 shadow-xs'
                                : 'bg-white/60 border-neutral-200 hover:border-neutral-300'
                            }`}
                          >
                            <p className="text-xs font-bold text-neutral-900">
                              {language === 'en' ? preset.nameEn : preset.nameId}
                            </p>
                            <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
                              {language === 'en' ? preset.descEn : preset.descId}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <label className="space-y-1 text-xs">
                      <span className="font-semibold text-neutral-700 block">
                        {t.admin.photoEnhancer.scaleLabel}
                      </span>
                      <select
                        value={photoEnhancer.upscaleScale}
                        onChange={(e) =>
                          setPhotoEnhancer((prev) => ({
                            ...prev,
                            upscaleScale: Number(e.target.value) as 1 | 1.5 | 2,
                          }))
                        }
                        className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-mono text-neutral-900"
                      >
                        <option value={1}>1× (Native · Fastest)</option>
                        <option value={1.5}>1.5× (Studio Crisp)</option>
                        <option value={2}>2× (HD Max 2400px)</option>
                      </select>
                    </label>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between font-semibold text-neutral-700">
                        <span>{t.admin.photoEnhancer.sharpenLabel}</span>
                        <span className="font-mono">{photoEnhancer.sharpenAmount}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={photoEnhancer.sharpenAmount}
                        onChange={(e) =>
                          setPhotoEnhancer((prev) => ({
                            ...prev,
                            sharpenAmount: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[var(--theme-accent,#E11D48)] cursor-pointer mt-1.5"
                      />
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between font-semibold text-neutral-700">
                        <span>{t.admin.photoEnhancer.denoiseLabel}</span>
                        <span className="font-mono">{photoEnhancer.denoiseLevel}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={photoEnhancer.denoiseLevel}
                        onChange={(e) =>
                          setPhotoEnhancer((prev) => ({
                            ...prev,
                            denoiseLevel: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[var(--theme-accent,#E11D48)] cursor-pointer mt-1.5"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={photoEnhancer.autoTone}
                      onChange={(e) =>
                        setPhotoEnhancer((prev) => ({
                          ...prev,
                          autoTone: e.target.checked,
                        }))
                      }
                      style={{ accentColor: themeColor }}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                    <span className="text-xs text-neutral-700">
                      {t.admin.photoEnhancer.autoToneLabel}
                    </span>
                  </label>

                  {/* Test & Benchmark Row */}
                  <div className="pt-2 border-t border-neutral-200/80 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={isTestingEnhancer}
                      onClick={handleTestPhotoEnhancer}
                      className="px-3.5 py-2 text-xs font-bold text-white rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-60 flex items-center gap-2"
                      style={{ backgroundColor: themeColor }}
                    >
                      <span>⚡</span>
                      <span>
                        {isTestingEnhancer
                          ? `${t.admin.photoEnhancer.testingBtn} (${enhancerProgress}%)`
                          : t.admin.photoEnhancer.testBtn}
                      </span>
                    </button>

                    {enhancerTestResult && (
                      <div className="text-[11px] font-mono text-neutral-600 flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 bg-white rounded border border-neutral-200">
                          ⏱️ {enhancerTestResult.durationMs}ms
                        </span>
                        <span className="px-2 py-0.5 bg-white rounded border border-neutral-200">
                          {enhancerTestResult.inputDims} → {enhancerTestResult.outputDims}
                        </span>
                        {enhancerTestResult.backend && (
                          <span className="px-2 py-0.5 bg-white rounded border border-neutral-200 uppercase">
                            {enhancerTestResult.backend}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {enhancerTestResult && (
                    <div className="space-y-2 pt-2">
                      {(enhancerTestResult.durationMs > 4000 || enhancerTestResult.fallbackUsed) && (
                        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs">
                          ⚠️{' '}
                          {enhancerTestResult.fallbackUsed
                            ? enhancerTestResult.error || 'Fallback triggered.'
                            : t.admin.photoEnhancer.slowWarning}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEnhancerCompareView('before')}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border cursor-pointer ${
                            enhancerCompareView === 'before'
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-white text-neutral-700 border-neutral-300'
                          }`}
                        >
                          {t.admin.photoEnhancer.beforeLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEnhancerCompareView('after')}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border cursor-pointer ${
                            enhancerCompareView === 'after'
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-white text-neutral-700 border-neutral-300'
                          }`}
                        >
                          {t.admin.photoEnhancer.afterLabel}
                        </button>
                      </div>

                      <div className="bg-neutral-900 rounded-xl p-2 flex justify-center">
                        <img
                          src={
                            enhancerCompareView === 'before'
                              ? enhancerTestResult.beforeUrl
                              : enhancerTestResult.afterUrl
                          }
                          alt="Photo enhancer benchmark comparison"
                          className="max-h-56 w-auto rounded-lg object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bagian: Suara Shutter Kamera */}
              <div className="pt-4 border-t border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                      <span>🔊 Suara Shutter Kamera (Mekanik SLR)</span>
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Efek audio jepretan kamera mekanik klasik dengan synthesizer Web Audio API offline.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestShutterSound}
                    className="px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                    title="Uji coba dengarkan efek suara shutter mekanik"
                  >
                    <span>▶️ Uji Suara</span>
                  </button>
                </div>

                <label className="flex items-start gap-3 cursor-pointer bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                  <input
                    type="checkbox"
                    checked={enableShutterSound}
                    onChange={(e) => setEnableShutterSound(e.target.checked)}
                    style={{ accentColor: themeColor }}
                    className="w-4 h-4 mt-0.5 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-medium text-neutral-800">
                      Aktifkan efek suara shutter saat kamera mengambil foto
                    </span>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Jika diaktifkan, suara shutter mekanik kamera SLR akan berbunyi tepat saat hitung mundur selesai dan lampu kilat (flash) menyala.
                    </p>
                  </div>
                </label>
              </div>

              {/* Bagian: Integrasi Eksternal Print API */}
              <div className="pt-4 border-t border-neutral-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                      <span>🖨️ Integrasi Eksternal Print API</span>
                      <span className="px-2 py-0.5 text-[10px] font-mono-tabular font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded">
                        multipart/form-data
                      </span>
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Hubungkan photobox dengan print server fisik lokal (driver DNP, Epson receipt, CUPS server, atau relay kiosk).
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="printApiEndpointInput"
                    className="block text-xs font-semibold text-neutral-700"
                  >
                    URL Endpoint Print API
                  </label>
                  <input
                    id="printApiEndpointInput"
                    type="url"
                    value={printApiEndpoint}
                    onChange={(e) => setPrintApiEndpoint(e.target.value)}
                    placeholder="http://localhost:5000/print atau http://192.168.1.50:8000/api/print"
                    className="w-full px-3.5 py-2 text-sm bg-[#F4F4F0] border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900 font-mono-tabular"
                  />
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1.5 text-xs text-neutral-600">
                    <p className="font-medium text-neutral-800">
                      Spesifikasi Payload HTTP POST:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 font-mono-tabular text-[11px] text-neutral-600">
                      <li>
                        <strong className="text-neutral-800">image</strong> (Binary File): File gambar PNG hasil cetakan photobox.
                      </li>
                      <li>
                        <strong className="text-neutral-800">printer</strong> (String, opsional): Nama printer tujuan di mesin server.
                      </li>
                    </ul>
                    <p className="text-[11px] text-neutral-500 pt-0.5">
                      * Jika URL endpoint dikosongkan, aplikasi akan otomatis menggunakan mode simulasi cetak offline (mock fallback).
                    </p>
                  </div>
                </div>

                {/* Dua Nama Printer: Thermal & Warna */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="thermalPrinterNameInput"
                        className="block text-xs font-bold text-neutral-900"
                      >
                        1. Nama Printer Thermal (Roll 80mm)
                      </label>
                      <span className="text-[10px] font-mono-tabular font-semibold px-1.5 py-0.5 bg-neutral-200 text-neutral-700 rounded">
                        1-Strip Payload
                      </span>
                    </div>
                    <input
                      id="thermalPrinterNameInput"
                      type="text"
                      value={thermalPrinterName}
                      onChange={(e) => setThermalPrinterName(e.target.value)}
                      placeholder="Contoh: Epson_TM_T82 atau RP80"
                      className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900 font-mono-tabular"
                    />
                    <p className="text-[11px] text-neutral-500">
                      Selalu mengirim <strong className="text-neutral-700">1-strip gambar tunggal</strong> ke printer ini saat tombol Print Thermal ditekan.
                    </p>
                  </div>

                  <div className="space-y-1.5 p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="colorPrinterNameInput"
                        className="block text-xs font-bold text-neutral-900"
                      >
                        2. Nama Printer Warna (Dye-Sub 4R)
                      </label>
                      <span className="text-[10px] font-mono-tabular font-semibold px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded">
                        2-Strip Payload
                      </span>
                    </div>
                    <input
                      id="colorPrinterNameInput"
                      type="text"
                      value={colorPrinterName}
                      onChange={(e) => setColorPrinterName(e.target.value)}
                      placeholder="Contoh: DNP_DS_RX1HS atau Citizen_CY02"
                      className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900 font-mono-tabular"
                    />
                    <p className="text-[11px] text-neutral-500">
                      Mengirim <strong className="text-neutral-700">2-strip berdampingan</strong> (jika strip vertikal) atau gambar 4R tunggal ke printer ini.
                    </p>
                  </div>
                </div>

                {/* Tombol Uji Cetak Masing-Masing Printer */}
                <div className="pt-1 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={testingApi}
                    onClick={handleTestPrintThermal}
                    className="px-3.5 py-2 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                    title="Kirim 1-strip test canvas ke printer thermal"
                  >
                    <span>🧾</span>
                    <span>{testingApi ? 'Mengirim...' : 'Uji Printer Thermal (1-Strip)'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={testingApi}
                    onClick={handleTestPrintColor}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-[var(--theme-accent,#E11D48)] hover:brightness-90 rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                    title="Kirim 2-strip side-by-side test canvas ke printer warna"
                  >
                    <span>🖼️</span>
                    <span>{testingApi ? 'Mengirim...' : 'Uji Printer Warna (2-Strip)'}</span>
                  </button>

                  <span className="text-[11px] text-neutral-500">
                    Memverifikasi komunikasi API endpoint & parameter nama printer ke Print Server tanpa memulai sesi photobox baru.
                  </span>
                </div>

                {testApiResult && (
                  <div
                    role="status"
                    className={`p-3 rounded-xl border text-xs font-mono-tabular ${testApiResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-300 text-amber-900'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{testApiResult.success ? '✅' : '⚠️'}</span>
                      <span className="font-semibold">
                        {testApiResult.success ? 'Hasil Uji Koneksi Berhasil:' : 'Hasil Uji Koneksi Gagal:'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] pl-6 break-all">
                      {testApiResult.message}
                    </p>
                  </div>
                )}
              </div>

              {/* Bagian: Akses PWA & Caching Offline 100% */}
              <div className="pt-4 border-t border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                      <span>📶 Mode Offline</span>
                      <span className="px-2 py-0.5 text-[10px] font-mono-tabular font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                        100% Offline Ready
                      </span>
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Aplikasi dapat dibuka dan dijalankan tanpa koneksi internet sama sekali, hanya terhubung ke Print Server lokal.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={cachingOffline}
                    onClick={handleWarmOfflineCache}
                    className="px-3.5 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    <span>⚡</span>
                    <span>{cachingOffline ? 'Caching...' : 'Cache'}</span>
                  </button>
                </div>

                <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2 text-xs text-neutral-600">
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold text-sm">✔</span>
                    <div>
                      <strong className="text-neutral-800">Semua Berkas Aplikasi & Bingkai Dicache:</strong>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Workbox Service Worker dikonfigurasi dengan batas cache 25MB untuk memastikan seluruh file transparansi bingkai foto, font, dan skrip tersimpan di browser Anda.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold text-sm">✔</span>
                    <div>
                      <strong className="text-neutral-800">Bypass Jaringan Print API:</strong>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Panggilan HTTP POST multipart ke server cetak (localhost atau IP LAN) langsung diteruskan tanpa hambatan cache browser.
                      </p>
                    </div>
                  </div>

                  {offlineCacheStatus && (
                    <div className="mt-2 p-2.5 bg-white border border-neutral-200 rounded-lg text-[11px] font-mono-tabular text-neutral-800">
                      {offlineCacheStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {saveMessage && (
            <div
              role="status"
              className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900"
            >
              {saveMessage}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-200">
            <button
              type="submit"
              disabled={isSaving}
              style={{ backgroundColor: themeColor }}
              className="min-h-[48px] px-7 py-3 text-sm sm:text-base font-extrabold text-white rounded-xl transition-all shadow-md active:scale-95 hover:brightness-90 whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              <span>💾</span>
              <span>{isSaving ? (language === 'en' ? 'Saving...' : 'Menyimpan...') : (language === 'en' ? 'Save' : 'Simpan')}</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="min-h-[48px] px-5 py-3 text-xs sm:text-sm font-semibold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer"
            >
              {t.admin.resetDefaults}
            </button>
          </div>
        </form>

        {/* Live Simulation Panels */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Start Kiosk Screen Mockup */}
          <div className="bg-neutral-950 text-white rounded-2xl p-5 border border-neutral-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Pratinjau Layar Awal Kiosk
                </h3>
                <p className="text-[11px] text-zinc-500">Simulasi langsung tampilan (/app/idle)</p>
              </div>
              <span className="text-[10px] font-mono-tabular bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                Live Preview
              </span>
            </div>

            {/* Mock Screen 16:9 */}
            <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center p-4 text-center select-none shadow-2xl">
              <img
                src={previewBackdropSrc}
                alt="Pratinjau Backdrop"
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                style={{ opacity: kioskBackgroundOverlayOpacity / 100 }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />

              <div className="relative z-10 space-y-2 w-full px-2">
                <p className="text-[9px] font-mono-tabular text-zinc-300 truncate">
                  {studioName || 'SoreAja Studio — Booth 02'} · {eventName || 'SoreAja Sunset Session 2026'}
                </p>
                <h4 className="font-display text-base sm:text-lg font-extrabold text-[#F4F4F0] tracking-tight">
                  SoreAja Pose
                </h4>
                <p className="font-serif-editorial italic text-xs text-zinc-300">
                  Abadikan momen sore terbaikmu
                </p>
                <div className="pt-1">
                  <span
                    style={{ backgroundColor: themeColor }}
                    className="inline-block px-4 py-1.5 rounded-lg text-[11px] font-bold text-white shadow-lg transition-transform"
                  >
                    Sentuh untuk Memulai
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-zinc-400 space-y-1 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80">
              <p className="font-semibold text-zinc-200">Status Visual Saat Ini:</p>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: themeColor }} />
                <span>Aksen: <strong className="text-zinc-200">{themeColor}</strong> ({themePreset})</span>
              </div>
              <p>Opasitas latar: <strong className="text-zinc-200">{kioskBackgroundOverlayOpacity}%</strong></p>
            </div>
          </div>

          {/* Live QR Code Verification Panel */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
              Pratinjau QR Code Google Drive
            </h3>
            <p className="text-[11px] text-neutral-500">
              Mengarahkan pelanggan ke folder penyimpanan foto sesi.
            </p>

            <div className="p-4 bg-[#F4F4F0] rounded-xl border border-neutral-200 flex flex-col items-center justify-center">
              <div className="bg-white p-3 rounded-lg border border-neutral-200 shadow-xs">
                <QRCodeSVG
                  value={driveUrl.trim() || DEFAULT_DRIVE_URL}
                  size={140}
                  level="M"
                />
              </div>
              <p className="mt-2 text-[10px] font-mono-tabular text-neutral-700 break-all text-center max-w-[240px]">
                {driveUrl.trim() || DEFAULT_DRIVE_URL}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone: System-Wide Data Reset Card */}
      <section className="bg-white border border-rose-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-rose-600 font-bold text-lg">⚠️</span>
              <h3 className="text-base font-bold text-neutral-900">
                {t.admin.dangerZoneTitle}
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-neutral-600 max-w-2xl leading-relaxed">
              {t.admin.dangerZoneDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowResetAllModal(true)}
            className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto"
          >
            <span>🗑️</span>
            <span>{t.admin.resetAllData}</span>
          </button>
        </div>
      </section>

      {/* Modal Dialog */}
      <ResetAllDataModal
        isOpen={showResetAllModal}
        onClose={() => setShowResetAllModal(false)}
        onSuccess={handleResetAllSuccess}
      />

      {/* Fullscreen High-Resolution Test Capture Viewer Modal */}
      {testCaptureViewModal && testCaptureResult && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md p-4 sm:p-6 flex flex-col justify-between animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm sm:text-base">
                🔍 {t.camera.preprocessing?.testCaptureTitle || 'Detail Foto Uji Coba Kalibrasi'}
              </span>
              <span className="text-xs font-mono text-zinc-400">
                {testCaptureResult.width}×{testCaptureResult.height}px ({testCaptureResult.source})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadTestCapture}
                className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer transition-all"
              >
                {t.camera.preprocessing?.downloadTestBtn || '⬇️ Unduh Foto'}
              </button>
              <button
                type="button"
                onClick={() => setTestCaptureViewModal(false)}
                className="px-3 py-1.5 text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg cursor-pointer transition-all"
              >
                ✕ Tutup
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto flex items-center justify-center p-2 sm:p-4">
            <img
              src={testCaptureTab === 'raw' ? testCaptureResult.rawUrl : testCaptureResult.processedUrl}
              alt="Full view"
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

