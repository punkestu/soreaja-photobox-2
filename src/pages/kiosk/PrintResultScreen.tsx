import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { QRCodeSVG } from 'qrcode.react';
import { db, DEFAULT_DRIVE_URL } from '../../db';
import { usePhotobox } from '../../context/PhotoboxContext';
import { DEFAULT_FRAMES, STUDIO_PORTRAITS } from '../../data/defaultFrames';
import { generateGif } from '../../services/gifService';
import {
  autoDownloadSessionFiles,
  downloadSingleFile,
  type DownloadedFileManifest,
} from '../../services/downloadService';
import { printThermal, printColor } from '../../services/printServices';
import {
  compositeFinalLayoutBundle,
  generateSideBySideStrip,
  isVerticalLongStrip,
} from '../../services/canvasCompositor';

export const PrintResultScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    selectedFrame,
    capturedPhotos,
    finalLayoutBase64,
    setFinalLayoutBase64,
    doubleStripBase64,
    setDoubleStripBase64,
    gifBlobUrl,
    setGifBlobUrl,
    selectedFilter,
    customCaption,
    showFrameStamps,
    resetSession,
    isHydrated,
  } = usePhotobox();

  const settings = useLiveQuery(() => db.settings.get('app_settings'), []);
  const [driveUrl, setDriveUrl] = useState<string>(DEFAULT_DRIVE_URL);
  const [isGeneratingGif, setIsGeneratingGif] = useState<boolean>(false);
  const [gifProgress, setGifProgress] = useState<number>(0);
  const [printStatus, setPrintStatus] = useState<string>(
    'Memproses foto...'
  );
  const [printError, setPrintError] = useState<string | null>(null);
  const [isPrintingThermal, setIsPrintingThermal] = useState<boolean>(false);
  const [isPrintingColor, setIsPrintingColor] = useState<boolean>(false);
  const [thermalPrintCount, setThermalPrintCount] = useState<number>(0);
  const [colorPrintCount, setColorPrintCount] = useState<number>(0);
  const [downloadedManifest, setDownloadedManifest] = useState<
    DownloadedFileManifest[]
  >([]);
  const [stripDisplayMode, setStripDisplayMode] = useState<'single' | 'double'>('double');

  const hasInitializedRef = useRef<boolean>(false);
  const sessionIdRef = useRef<number | null>(null);
  const activeFrame = selectedFrame || DEFAULT_FRAMES[0];

  // Sesuai TSD 4.2.6: Proses On-Mount
  useEffect(() => {
    if (!isHydrated) return;
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const runOnMountPipeline = async () => {
      // 1. Ambil URL G-Drive dan pengaturan dari Dexie.js
      let currentDriveUrl = DEFAULT_DRIVE_URL;
      let shouldAutoDownload = true;
      let themeAccent = '#E11D48';
      try {
        const data = await db.settings.get('app_settings');
        if (data && data.driveUrl) {
          currentDriveUrl = data.driveUrl;
          setDriveUrl(data.driveUrl);
        }
        if (data && typeof data.autoDownload === 'boolean') {
          shouldAutoDownload = data.autoDownload;
        }
        if (data && data.themeColor) {
          themeAccent = data.themeColor;
        }
      } catch {
        // Fallback default URL
      }

      // Ensure we have photos and finalLayout even if user navigated directly to /app/print-result
      const photosToUse =
        capturedPhotos.length > 0
          ? capturedPhotos
          : Array.from({ length: activeFrame.photoCount }).map(
              (_, i) => STUDIO_PORTRAITS[i % STUDIO_PORTRAITS.length].src
            );

      let layoutToUse = finalLayoutBase64;
      let doubleStripToUse = doubleStripBase64;

      if (!layoutToUse) {
        const bundle = await compositeFinalLayoutBundle(
          photosToUse,
          activeFrame,
          selectedFilter,
          customCaption,
          showFrameStamps,
          themeAccent,
          { includeCutLine: true }
        );
        layoutToUse = bundle.singleStrip;
        doubleStripToUse = bundle.doubleStrip;
        setFinalLayoutBase64(layoutToUse);
        setDoubleStripBase64(doubleStripToUse);
      } else if (!doubleStripToUse) {
        const maxRight = Math.max(...activeFrame.positions.map((p) => p.x + p.width));
        const maxBottom = Math.max(...activeFrame.positions.map((p) => p.y + p.height));
        const cWidth = activeFrame.canvasWidth || maxRight + 50;
        const cHeight = activeFrame.canvasHeight || maxBottom + 120;
        if (isVerticalLongStrip(cWidth, cHeight)) {
          try {
            doubleStripToUse = await generateSideBySideStrip(layoutToUse, {
              includeCutLine: true,
            });
            setDoubleStripBase64(doubleStripToUse);
          } catch {
            // fallback
          }
        }
      }

      // 2. Jalankan gif.js untuk merender animasi dari capturedPhotos
      setIsGeneratingGif(true);
      const renderedGifUrl = await generateGif(photosToUse, (p) =>
        setGifProgress(Math.round(p * 100))
      );
      setGifBlobUrl(renderedGifUrl);
      setIsGeneratingGif(false);

      // 3. Unduh semua file (Raw, Final Frame, 2-Strip Side-by-Side jika ada, GIF) ke PC lokal secara otomatis
      const files = autoDownloadSessionFiles(
        photosToUse,
        layoutToUse,
        renderedGifUrl,
        shouldAutoDownload,
        doubleStripToUse
      );
      setDownloadedManifest(files);

      // 4. Simpan riwayat sesi ke IndexedDB (Status cetak awal: false, hanya dicetak saat tombol ditekan)
      try {
        const newSessionId = await db.sessions.add({
          timestamp: Date.now(),
          frameId: activeFrame.id,
          frameName: activeFrame.name,
          photoCount: photosToUse.length,
          finalLayoutBase64: layoutToUse,
          doubleStripBase64: doubleStripToUse,
          driveUrl: currentDriveUrl,
          printedThermal: false,
          printedColor: false,
        });
        sessionIdRef.current = Number(newSessionId);
      } catch {
        // Ignore DB archive error
      }

      setPrintStatus('Siap Cetak · Silakan tekan tombol Print Thermal atau Print Warna');
    };

    runOnMountPipeline();
  }, [
    activeFrame,
    capturedPhotos,
    customCaption,
    doubleStripBase64,
    finalLayoutBase64,
    isHydrated,
    selectedFilter,
    setDoubleStripBase64,
    setFinalLayoutBase64,
    setGifBlobUrl,
    showFrameStamps,
  ]);

  const handlePrintThermal = async () => {
    const layout = finalLayoutBase64;
    if (!layout) return;
    setIsPrintingThermal(true);
    setPrintError(null);
    const targetPrinter = settings?.thermalPrinterName || settings?.printerName;
    setPrintStatus(
      settings?.printApiEndpoint
        ? `Mengirim 1-strip ke Printer Thermal (${targetPrinter || 'Thermal'})...`
        : 'Menghubungkan ke Printer Thermal (80mm)...'
    );
    try {
      const res = await printThermal(
        layout, // Selalu kirim 1-strip untuk thermal
        settings?.printApiEndpoint,
        targetPrinter
      );
      const nextCount = thermalPrintCount + 1;
      setThermalPrintCount(nextCount);
      setPrintStatus(`Cetak Thermal Berhasil (${nextCount}x dicetak · ${res.jobId}) · ${res.message}`);
      if (sessionIdRef.current) {
        await db.sessions.update(sessionIdRef.current, {
          printedThermal: true,
          thermalPrintCount: nextCount,
        });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setPrintStatus(`⚠️ Gagal Print Thermal: ${errMsg}`);
      setPrintError(errMsg);
    } finally {
      setIsPrintingThermal(false);
    }
  };

  const handlePrintColor = async () => {
    setIsPrintingColor(true);
    setPrintError(null);
    // Aturan rasio: Jika strip vertikal panjang, kirim 2-strip berdampingan; jika format 4R / bukan strip vertikal, kirim single image
    const imageToPrint = doubleStripBase64 || finalLayoutBase64;
    const isDouble = !!doubleStripBase64;
    const targetPrinter = settings?.colorPrinterName || settings?.printerName;

    setPrintStatus(
      settings?.printApiEndpoint
        ? `Mengirim ${isDouble ? '2-strip (berdampingan)' : '1-foto 4R'} ke Printer Warna (${targetPrinter || 'Color'})...`
        : isDouble
        ? 'Menghubungkan ke Printer Warna (Dye-Sub 4R - 2 Strip Side-by-Side)...'
        : 'Menghubungkan ke Printer Warna (Dye-Sub 4R - Full Card)...'
    );
    try {
      const res = await printColor(
        imageToPrint,
        settings?.printApiEndpoint,
        targetPrinter
      );
      const nextCount = colorPrintCount + 1;
      setColorPrintCount(nextCount);
      setPrintStatus(
        `Cetak Warna Selesai (${nextCount}x dicetak · ${res.jobId}) · ${res.message}`
      );
      if (sessionIdRef.current) {
        await db.sessions.update(sessionIdRef.current, {
          printedColor: true,
          colorPrintCount: nextCount,
        });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setPrintStatus(`⚠️ Gagal Print Warna: ${errMsg}`);
      setPrintError(errMsg);
    } finally {
      setIsPrintingColor(false);
    }
  };

  const handleFallbackMockPrint = async () => {
    setPrintError(null);
    setIsPrintingColor(true);
    setPrintStatus('Menjalankan simulasi cetak offline...');
    const imageToPrint = doubleStripBase64 || finalLayoutBase64;
    const res = await printColor(imageToPrint, undefined, undefined);
    const nextCount = colorPrintCount + 1;
    setColorPrintCount(nextCount);
    setIsPrintingColor(false);
    setPrintStatus(`Simulasi Cetak Selesai (${nextCount}x dicetak · ${res.jobId}) · Mode Offline`);
    if (sessionIdRef.current) {
      await db.sessions.update(sessionIdRef.current, {
        printedColor: true,
        colorPrintCount: nextCount,
      });
    }
  };

  const handleNewSession = () => {
    resetSession();
    navigate('/app/idle');
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 space-y-6 md:space-y-8 select-none">
      {/* Header & Live Hardware Status */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="text-xs sm:text-sm font-mono-tabular text-zinc-400 flex items-center gap-2 mb-1.5">
            <span className="text-[var(--theme-accent,#E11D48)] font-bold">🏁 Selesai 06/06</span>
            <span aria-hidden="true">·</span>
            <span>💾 Unduh Otomatis</span>
            <span aria-hidden="true">·</span>
            <span>🖨️ Cetak Studio</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#F4F4F0]">
            Hasil Photobox & QR Code
          </h1>
          <p
            role="status"
            className="text-xs sm:text-sm font-mono-tabular text-emerald-400 font-semibold mt-1.5 flex items-center gap-1.5"
          >
            <span>{printStatus.startsWith('✅') ? '✅' : printStatus.startsWith('⚠️') ? '⚠️' : '⚡'}</span>
            <span>{printStatus}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <button
            type="button"
            disabled={isPrintingThermal || !finalLayoutBase64}
            onClick={handlePrintThermal}
            className="min-h-[46px] sm:min-h-[50px] grow px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-zinc-100 bg-zinc-900/90 hover:bg-zinc-800 active:scale-95 disabled:opacity-50 rounded-xl transition-all whitespace-nowrap cursor-pointer border border-zinc-800 shadow-md flex items-center justify-center gap-2"
          >
            <span>🖨️</span>
            <span>
              {isPrintingThermal
                ? 'Mencetak...'
                : thermalPrintCount > 0
                ? `Thermal (${thermalPrintCount}x)`
                : 'Thermal'}
            </span>
          </button>

          <button
            type="button"
            disabled={isPrintingColor || (!doubleStripBase64 && !finalLayoutBase64)}
            onClick={handlePrintColor}
            className="min-h-[46px] sm:min-h-[50px] grow px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-zinc-100 bg-zinc-900/90 hover:bg-zinc-800 active:scale-95 disabled:opacity-50 rounded-xl transition-all whitespace-nowrap cursor-pointer border border-zinc-800 shadow-md flex items-center justify-center gap-2"
          >
            <span>🎨</span>
            <span>
              {isPrintingColor
                ? 'Mencetak...'
                : colorPrintCount > 0
                ? `Warna (${colorPrintCount}x)`
                : 'Warna'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleNewSession}
            className="min-h-[46px] sm:min-h-[50px] grow px-6 sm:px-8 py-2 text-sm sm:text-base font-extrabold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-lg flex items-center justify-center gap-2"
          >
            <span>Sesi Baru</span>
            <span>✨</span>
          </button>
        </div>
      </div>

      {/* Print Error Alert Banner */}
      {printError && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-950/70 border border-amber-600/60 rounded-2xl text-amber-200 text-xs shadow-lg">
          <div className="flex items-center gap-2.5">
            <span className="text-amber-400 font-bold text-base">⚠️</span>
            <div>
              <p className="font-semibold text-amber-200">Gagal Mengirim ke Print API</p>
              <p className="text-amber-300/80 font-mono text-[11px] mt-0.5">{printError}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrintColor}
              className="px-3 py-1.5 bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] text-white font-semibold rounded-xl transition-colors cursor-pointer shadow-sm text-xs flex items-center gap-1.5"
            >
              <span>🎨</span>
              <span>Cetak Warna</span>
            </button>
            <button
              type="button"
              onClick={handlePrintThermal}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-xl transition-colors cursor-pointer text-xs flex items-center gap-1.5"
            >
              <span>🖨️</span>
              <span>Cetak Thermal</span>
            </button>
            <button
              type="button"
              onClick={handleFallbackMockPrint}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors cursor-pointer text-xs flex items-center gap-1.5"
            >
              <span>🧪</span>
              <span>Simulasi</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/settings')}
              className="px-3 py-1.5 bg-amber-900/60 hover:bg-amber-900 text-amber-200 border border-amber-600/50 font-medium rounded-xl transition-colors cursor-pointer text-xs flex items-center gap-1.5"
            >
              <span>⚙️</span>
              <span>Pengaturan</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Showcase: 2 Enlarged Columns (01. Hasil Cetak Berbingkai & 02. Animasi GIF) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-stretch">
        {/* Column 1: Final Framed Photo Strip (Enlarged) */}
        <div className="bg-zinc-900/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl border border-zinc-800/70 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold text-[#F4F4F0] flex items-center gap-2">
                  <span>🖼️</span>
                  <span>Hasil Cetak Berbingkai</span>
                </h2>
                <p className="text-xs text-zinc-400">Bingkai: {activeFrame.name}</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {doubleStripBase64 && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadSingleFile(
                        doubleStripBase64,
                        `PB_${Date.now()}_side_by_side_2strip.png`
                      )
                    }
                    className="min-h-[42px] px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-sm flex items-center gap-1.5"
                    title="Unduh 2 strip berdampingan dengan garis potong untuk cetak 4R"
                  >
                    <span>📥</span>
                    <span>2-Strip (4R)</span>
                  </button>
                )}
                {finalLayoutBase64 && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadSingleFile(
                        finalLayoutBase64,
                        `PB_${Date.now()}_strip_single.png`
                      )
                    }
                    className="min-h-[42px] px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                    title="Unduh 1 strip tunggal"
                  >
                    <span>📥</span>
                    <span>{doubleStripBase64 ? '1-Strip' : 'PNG'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Toggle View jika 2-strip tersedia */}
            {doubleStripBase64 && (
              <div className="flex items-center justify-between bg-zinc-950/80 p-2 rounded-xl border border-zinc-800/80 text-xs">
                <span className="text-xs text-zinc-400 pl-2 font-medium">Format:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStripDisplayMode('single')}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                      stripDisplayMode === 'single'
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    📱 1-Strip
                  </button>
                  <button
                    type="button"
                    onClick={() => setStripDisplayMode('double')}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                      stripDisplayMode === 'double'
                        ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>👥 2-Strip (4R)</span>
                    <span className="text-[10px] px-1 bg-white/20 text-white rounded font-mono">
                      ✂️ Garis Potong
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Enlarged Framed Image Viewport */}
          <div className="bg-zinc-950 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center min-h-[500px] sm:min-h-[580px] gap-3 border border-zinc-800/60 flex-1">
            {finalLayoutBase64 ? (
              <>
                <img
                  src={
                    stripDisplayMode === 'double' && doubleStripBase64
                      ? doubleStripBase64
                      : finalLayoutBase64
                  }
                  alt="Hasil akhir strip foto berbingkai"
                  className="max-h-[560px] sm:max-h-[640px] md:max-h-[680px] w-auto max-w-full object-contain rounded-xl shadow-2xl transition-all"
                />
                <p className="text-[11px] font-mono-tabular text-zinc-400 text-center flex items-center gap-2">
                  <span>
                    {stripDisplayMode === 'double' && doubleStripBase64
                      ? '👥 Mode 2-Strip Side-by-Side dengan Garis Potong Tebal · Standar 4R (4×6")'
                      : '📱 Mode 1-Strip Tunggal · Kertas Roll 80mm / Thermal'}
                  </span>
                </p>
              </>
            ) : (
              <span className="text-xs font-mono-tabular text-zinc-500">
                Memuat gambar akhir...
              </span>
            )}
          </div>
        </div>

        {/* Column 2: Animated GIF (gif.js) (Enlarged) */}
        <div className="bg-zinc-900/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl border border-zinc-800/70 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold text-[#F4F4F0] flex items-center gap-2">
                  <span>🎞️</span>
                  <span>Animasi GIF</span>
                </h2>
                <p className="text-xs text-zinc-400">600×400px · Loop 500ms</p>
              </div>
              {gifBlobUrl && (
                <button
                  type="button"
                  onClick={() =>
                    downloadSingleFile(gifBlobUrl, `PB_${Date.now()}_anim.gif`)
                  }
                  className="min-h-[42px] px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                >
                  <span>📥</span>
                  <span>Unduh GIF</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/80 text-xs">
              <span className="text-xs text-zinc-400 font-medium">Status GIF:</span>
              <div className="flex items-center gap-2 text-xs font-mono-tabular text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Boomerang Loop</span>
              </div>
            </div>
          </div>

          {/* Enlarged Animated GIF Viewport */}
          <div className="relative min-h-[500px] sm:min-h-[580px] bg-zinc-950 rounded-2xl overflow-hidden flex flex-col items-center justify-center border border-zinc-800/80 p-4 sm:p-5 shadow-inner flex-1">
            {isGeneratingGif ? (
              <div className="text-center space-y-3 p-6">
                <div className="w-12 h-12 border-3 border-[var(--theme-accent,#E11D48)] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-mono-tabular text-zinc-200 font-semibold">
                  Merender Animasi GIF ({gifProgress}%)...
                </p>
                <p className="text-xs text-zinc-500">Memproses pose via Web Worker</p>
              </div>
            ) : gifBlobUrl ? (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <img
                  data-testid="generated-gif-preview"
                  src={gifBlobUrl}
                  alt="Animasi GIF Sesi Photobox"
                  className="max-h-[480px] sm:max-h-[540px] md:max-h-[580px] w-auto max-w-full rounded-xl object-contain shadow-2xl transition-all"
                />
                <div className="mt-3 flex items-center gap-2 text-xs font-mono-tabular text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Animasi Siap Dibagikan</span>
                </div>
              </div>
            ) : (
              <span className="text-xs text-zinc-500 font-mono-tabular">Menyiapkan GIF...</span>
            )}
          </div>

          {/* Auto-Download Manifest Summary */}
          <div className="pt-3 border-t border-zinc-800/80 space-y-2">
            <p className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <span>💾</span>
              <span>File Sesi Tersimpan ({downloadedManifest.length}):</span>
            </p>
            <ul className="space-y-1 text-xs font-mono-tabular text-zinc-400 max-h-28 overflow-y-auto pr-1">
              {downloadedManifest.map((item) => (
                <li
                  key={item.filename}
                  className="flex items-center justify-between py-1 border-b border-zinc-800/50"
                >
                  <span className="truncate max-w-[240px]">{item.filename}</span>
                  <button
                    type="button"
                    onClick={() => downloadSingleFile(item.url, item.filename)}
                    className="text-zinc-200 hover:text-white underline ml-2 shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <span>📥</span>
                    <span>Simpan</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Section: Always Put QR Code at Bottom Across Full Width */}
      <div className="w-full bg-zinc-900/90 rounded-2xl p-5 sm:p-7 shadow-2xl border border-zinc-800/80">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 md:gap-8">
          {/* QR Code Graphic Container */}
          <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6 shrink-0">
            <div
              data-testid="qr-code-container"
              className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center shadow-2xl ring-4 ring-white/10 shrink-0"
            >
              <QRCodeSVG value={driveUrl} size={168} level="M" className="max-w-full" />
            </div>

            <div className="space-y-1.5 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--theme-accent,#E11D48)]/15 border border-[var(--theme-accent,#E11D48)]/30 text-[var(--theme-accent,#E11D48)] rounded-full text-xs font-bold font-mono-tabular">
                <span>📱</span>
                <span>Scan untuk Unduh</span>
              </div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-[#F4F4F0]">
                Pindai QR Code via Kamera Ponsel
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md">
                Buka folder Google Drive untuk mengunduh semua foto raw, bingkai cetak, dan animasi GIF sesi ini ke ponselmu.
              </p>
              <p className="text-[11px] font-mono-tabular text-zinc-400 break-all pt-1">
                🔗 {driveUrl}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons on Bottom Bar */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-3 w-full lg:w-auto shrink-0">
            <button
              type="button"
              onClick={handleNewSession}
              className="min-h-[52px] sm:min-h-[56px] px-8 sm:px-10 py-3.5 text-base sm:text-lg font-extrabold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-lg flex items-center justify-center gap-2.5"
            >
              <span>Mulai Sesi Baru</span>
              <span>✨</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isPrintingThermal || !finalLayoutBase64}
                onClick={handlePrintThermal}
                className="flex-1 min-h-[46px] px-4 py-2 text-xs font-bold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 active:scale-95 disabled:opacity-50 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-zinc-700/60"
              >
                <span>🖨️</span>
                <span>Print Thermal</span>
              </button>

              <button
                type="button"
                disabled={isPrintingColor || (!doubleStripBase64 && !finalLayoutBase64)}
                onClick={handlePrintColor}
                className="flex-1 min-h-[46px] px-4 py-2 text-xs font-bold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 active:scale-95 disabled:opacity-50 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-zinc-700/60"
              >
                <span>🎨</span>
                <span>Print Warna</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
