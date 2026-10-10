import React, { useEffect, useState, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { db, DEFAULT_DRIVE_URL, DEFAULT_APP_SETTINGS } from '../../db';
import {
  THEME_COLOR_PRESETS,
  BACKDROP_PRESETS,
  applyThemeColor,
  calculateHoverColor,
} from '../../data/themeConfig';
import { KIOSK_HERO_BACKDROP } from '../../data/defaultFrames';
import { playShutterSound } from '../../services/shutterAudio';
import { testPrintApi, precacheAllFrameAssets } from '../../services/printServices';

export const AdminSettings: React.FC = () => {
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
  const [cameraSourceMode, setCameraSourceMode] = useState<'auto' | 'simulator'>('auto');

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
  const [testingApi, setTestingApi] = useState<boolean>(false);
  const [testApiResult, setTestApiResult] = useState<{
    success: boolean;
    message: string;
    jobId?: string;
  } | null>(null);
  const [cachingOffline, setCachingOffline] = useState<boolean>(false);
  const [offlineCacheStatus, setOfflineCacheStatus] = useState<string | null>(null);

  // Tema & Background Kiosk
  const [themeColor, setThemeColor] = useState<string>(DEFAULT_APP_SETTINGS.themeColor || '#E11D48');
  const [themePreset, setThemePreset] = useState<string>(DEFAULT_APP_SETTINGS.themePreset || 'crimson');
  const [kioskBackground, setKioskBackground] = useState<string>(DEFAULT_APP_SETTINGS.kioskBackground || '');
  const [kioskBackgroundOverlayOpacity, setKioskBackgroundOverlayOpacity] = useState<number>(
    DEFAULT_APP_SETTINGS.kioskBackgroundOverlayOpacity || 60
  );
  const [customBackdropUrl, setCustomBackdropUrl] = useState<string>('');
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'appearance' | 'session' | 'hardware'>('appearance');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

    if (!file.type.startsWith('image/')) {
      setUploadNotice('Harap pilih file gambar (JPG, PNG, atau WebP).');
      return;
    }

    setUploadNotice('Memproses dan mengoptimalkan gambar latar...');
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
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
      themeColor,
      themePreset,
      kioskBackground,
      kioskBackgroundOverlayOpacity,
      updatedAt: new Date().toISOString(),
    });

    applyThemeColor(themeColor);
    setDriveUrl(cleanUrl);
    setIsSaving(false);
    setSaveMessage(
      `Pengaturan, nama printer & warna tema berhasil disimpan ke IndexedDB pada ${new Date().toLocaleTimeString('id-ID')}.`
    );
  };

  const handleResetDefaults = async () => {
    await db.settings.put({
      ...DEFAULT_APP_SETTINGS,
      updatedAt: new Date().toISOString(),
    });
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
    setUploadNotice(null);
    setTestApiResult(null);
    applyThemeColor('#E11D48');
    setSaveMessage('Pengaturan & tema dikembalikan ke konfigurasi bawaan pabrik.');
  };

  return (
    <div className="space-y-8 max-w-5xl">
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

      {/* Navigation Tabs - Tablet Touch Friendly */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('appearance')}
          style={activeTab === 'appearance' ? { borderColor: themeColor, color: themeColor } : {}}
          className={`min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer border-b-2 active:scale-95 ${
            activeTab === 'appearance'
              ? 'border-b-2 bg-white text-neutral-900 shadow-xs'
              : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          🎨 Warna Tema & Background
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('session')}
          style={activeTab === 'session' ? { borderColor: themeColor, color: themeColor } : {}}
          className={`min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer border-b-2 active:scale-95 ${
            activeTab === 'session'
              ? 'border-b-2 bg-white text-neutral-900 shadow-xs'
              : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          ☁️ Google Drive & Teks Stempel
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('hardware')}
          style={activeTab === 'hardware' ? { borderColor: themeColor, color: themeColor } : {}}
          className={`min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer border-b-2 active:scale-95 ${
            activeTab === 'hardware'
              ? 'border-b-2 bg-white text-neutral-900 shadow-xs'
              : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          📷 Kamera & Cetak Otomatis
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
              {/* Bagian 1: Warna Tema */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900">
                      1. Pilihan Warna Tema Aplikasi (Theme Accent Color)
                    </h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Warna ini diterapkan pada tombol aksi, navigasi aktif, seleksi bingkai, dan stempel studio.
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
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                          isSelected
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
                  <span className="text-[11px] text-neutral-500 hidden sm:inline">
                    Pilih warna apa pun sesuai identitas acara / brand.
                  </span>
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
                          className={`group relative rounded-xl overflow-hidden border text-left p-1.5 transition-all cursor-pointer ${
                            isSelected
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
                    <p className="text-xs font-semibold text-neutral-700">Atau Unggah Foto Kustom Anda Sendiri (Offline):</p>
                    <span className="text-[11px] text-neutral-500">JPG, PNG, WebP</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
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
                      <span>Pilih File Foto dari Perangkat</span>
                    </button>

                    <div className="flex-1 flex gap-2">
                      <input
                        type="url"
                        value={customBackdropUrl}
                        onChange={(e) => setCustomBackdropUrl(e.target.value)}
                        placeholder="Atau tempel URL gambar eksternal..."
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
                  <div className="flex justify-between text-[10px] text-neutral-500 font-mono-tabular">
                    <span>20% (Lebih Gelap / Teks Sangat Kontras)</span>
                    <span>60% (Standar Studio)</span>
                    <span>100% (Terang Maksimal)</span>
                  </div>
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
                  placeholder="SOREAJA — PHOTOBOX 2"
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
                      setCameraSourceMode(e.target.value as 'auto' | 'simulator')
                    }
                    className="w-full px-3 py-2 text-sm bg-[#F4F4F0] border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900"
                  >
                    <option value="auto">Otomatis (WebRTC + Fallback Simulator)</option>
                    <option value="simulator">Paksa Mode Simulator Studio</option>
                  </select>
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
                    className={`p-3 rounded-xl border text-xs font-mono-tabular ${
                      testApiResult.success
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
                      <span>📶 Mode Offline & Akses Tanpa Internet</span>
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
                    <span>{cachingOffline ? 'Menyimpan Aset...' : 'Pre-Cache Seluruh Aset'}</span>
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
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="min-h-[48px] px-5 py-3 text-xs sm:text-sm font-semibold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer"
            >
              Reset ke Default Pabrik
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
                  SoreAja — Photobox
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
    </div>
  );
};

