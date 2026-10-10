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
    'Menghubungkan ke Printer...'
  );
  const [printError, setPrintError] = useState<string | null>(null);
  const [isPrintingThermal, setIsPrintingThermal] = useState<boolean>(false);
  const [isPrintingColor, setIsPrintingColor] = useState<boolean>(false);
  const [downloadedManifest, setDownloadedManifest] = useState<
    DownloadedFileManifest[]
  >([]);
  const [stripDisplayMode, setStripDisplayMode] = useState<'single' | 'double'>('double');

  const hasInitializedRef = useRef<boolean>(false);
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
      let targetApiEndpoint = '';
      let targetPrinterName = '';
      let targetThermalPrinter = '';
      let targetColorPrinter = '';
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
        if (data && data.printApiEndpoint) {
          targetApiEndpoint = data.printApiEndpoint;
        }
        if (data && data.thermalPrinterName) {
          targetThermalPrinter = data.thermalPrinterName;
        } else if (data && data.printerName) {
          targetThermalPrinter = data.printerName;
        }
        if (data && data.colorPrinterName) {
          targetColorPrinter = data.colorPrinterName;
        } else if (data && data.printerName) {
          targetColorPrinter = data.printerName;
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

      // 4. Jalankan fungsi Cetak (Thermal: Selalu 1-Strip ke thermalPrinterName)
      setIsPrintingThermal(true);
      setPrintError(null);
      setPrintStatus(
        targetApiEndpoint
          ? `Mengirim 1-strip ke Print API (${targetThermalPrinter || 'Thermal'})...`
          : 'Menghubungkan ke Printer Thermal (Simulasi)...'
      );
      try {
        const thermalRes = await printThermal(
          layoutToUse, // Selalu kirim 1 strip untuk thermal
          targetApiEndpoint,
          targetThermalPrinter
        );
        setIsPrintingThermal(false);
        setPrintStatus(`✅ ${thermalRes.message} · ID: ${thermalRes.jobId}`);
      } catch (err) {
        setIsPrintingThermal(false);
        const errMsg = err instanceof Error ? err.message : String(err);
        setPrintStatus(`⚠️ Gagal Print Thermal: ${errMsg}`);
        setPrintError(errMsg);
      }

      // 5. Simpan riwayat sesi ke IndexedDB
      try {
        await db.sessions.add({
          timestamp: Date.now(),
          frameId: activeFrame.id,
          frameName: activeFrame.name,
          photoCount: photosToUse.length,
          finalLayoutBase64: layoutToUse,
          doubleStripBase64: doubleStripToUse,
          driveUrl: currentDriveUrl,
          printedThermal: true,
          printedColor: false,
        });
      } catch {
        // Ignore DB archive error
      }
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

  const handleReprintThermal = async () => {
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
        finalLayoutBase64, // Selalu kirim 1-strip untuk thermal
        settings?.printApiEndpoint,
        targetPrinter
      );
      setPrintStatus(`✅ Cetak Thermal Berhasil (${res.jobId}) · ${res.message}`);
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
      setPrintStatus(
        `✅ Cetak Warna Selesai (${res.jobId}) · ${res.message}`
      );
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
    setIsPrintingColor(false);
    setPrintStatus(`✅ Simulasi Cetak Selesai (${res.jobId}) · Mode Offline`);
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
            <span className="text-[var(--theme-accent,#E11D48)] font-bold">Tahap 06/06</span>
            <span aria-hidden="true">·</span>
            <span>Sesi Selesai</span>
            <span aria-hidden="true">·</span>
            <span>Auto-Download & Cetak</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#F4F4F0]">
            Hasil Akhir Photobox & QR Code
          </h1>
          <p
            role="status"
            className="text-xs sm:text-sm font-mono-tabular text-emerald-400 font-semibold mt-1.5"
          >
            {printStatus}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            disabled={isPrintingThermal}
            onClick={handleReprintThermal}
            className="min-h-[50px] sm:min-h-[54px] px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-bold text-zinc-100 bg-zinc-900/90 hover:bg-zinc-800 active:scale-95 disabled:opacity-50 rounded-xl transition-all whitespace-nowrap cursor-pointer border border-zinc-800 shadow-md flex items-center gap-2"
          >
            <span>🖨️</span>
            <span>{isPrintingThermal ? 'Mencetak Thermal...' : 'Print Ulang Thermal'}</span>
          </button>

          <button
            type="button"
            disabled={isPrintingColor}
            onClick={handlePrintColor}
            className="min-h-[50px] sm:min-h-[54px] px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-bold text-zinc-100 bg-zinc-900/90 hover:bg-zinc-800 active:scale-95 disabled:opacity-50 rounded-xl transition-all whitespace-nowrap cursor-pointer border border-zinc-800 shadow-md flex items-center gap-2"
          >
            <span>🎨</span>
            <span>{isPrintingColor ? 'Mencetak Warna (3d)...' : 'Print Warna'}</span>
          </button>

          <button
            type="button"
            onClick={handleNewSession}
            className="min-h-[50px] sm:min-h-[54px] px-8 sm:px-10 py-2.5 text-sm sm:text-base font-extrabold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-lg flex items-center gap-2"
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
              className="px-3.5 py-1.5 bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] text-white font-semibold rounded-xl transition-colors cursor-pointer shadow-sm text-xs"
            >
              Coba Cetak Warna
            </button>
            <button
              type="button"
              onClick={handleReprintThermal}
              className="px-3.5 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-xl transition-colors cursor-pointer text-xs"
            >
              Coba Cetak Thermal
            </button>
            <button
              type="button"
              onClick={handleFallbackMockPrint}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors cursor-pointer text-xs"
            >
              Simulasi Offline
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/settings')}
              className="px-3.5 py-1.5 bg-amber-900/60 hover:bg-amber-900 text-amber-200 border border-amber-600/50 font-medium rounded-xl transition-colors cursor-pointer text-xs"
            >
              ⚙️ Buka Pengaturan
            </button>
          </div>
        </div>
      )}

      {/* 3-Column Result Showcase: Tablet-First Balanced Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 md:gap-8 items-start">
        {/* Column 1: Final Framed Photo Strip - Tablet Left Col */}
        <div className="md:col-span-1 lg:col-span-5 bg-zinc-900/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl border border-zinc-800/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h2 className="font-display text-base font-bold text-[#F4F4F0]">
                01. Hasil Cetak Berbingkai
              </h2>
              <p className="text-xs text-zinc-400">{activeFrame.name}</p>
            </div>

            <div className="flex items-center gap-2">
              {doubleStripBase64 && (
                <button
                  type="button"
                  onClick={() =>
                    downloadSingleFile(
                      doubleStripBase64,
                      `PB_${Date.now()}_side_by_side_2strip.png`
                    )
                  }
                  className="min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-sm"
                  title="Unduh 2 strip berdampingan untuk cetak kertas 4R"
                >
                  Unduh 2-Strip (4R)
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
                  className="min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer"
                  title="Unduh 1 strip tunggal"
                >
                  {doubleStripBase64 ? 'Unduh 1-Strip' : 'Unduh PNG'}
                </button>
              )}
            </div>
          </div>

          {/* Toggle View jika 2-strip tersedia */}
          {doubleStripBase64 && (
            <div className="flex items-center justify-between bg-zinc-950/80 p-2 rounded-xl border border-zinc-800/80 text-xs">
              <span className="text-xs text-zinc-400 pl-2">Pratinjau:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStripDisplayMode('single')}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                    stripDisplayMode === 'single'
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  📱 Strip Tunggal
                </button>
                <button
                  type="button"
                  onClick={() => setStripDisplayMode('double')}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                    stripDisplayMode === 'double'
                      ? 'bg-[var(--theme-accent,#E11D48)] text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  👥 2-Strip Side-by-Side (4R)
                </button>
              </div>
            </div>
          )}

          <div className="bg-zinc-950 rounded-xl p-4 flex flex-col items-center justify-center min-h-[400px] gap-2 border border-zinc-800/60">
            {finalLayoutBase64 ? (
              <>
                <img
                  src={
                    stripDisplayMode === 'double' && doubleStripBase64
                      ? doubleStripBase64
                      : finalLayoutBase64
                  }
                  alt="Hasil akhir strip foto berbingkai"
                  className="max-h-[440px] w-auto object-contain rounded shadow-2xl"
                />
                <p className="text-[11px] font-mono-tabular text-zinc-400 text-center">
                  {stripDisplayMode === 'double' && doubleStripBase64
                    ? '👥 Mode 2-Strip Side-by-Side · Cetak ganda untuk kertas 4R (4×6")'
                    : '📱 Mode Strip Tunggal · 80mm Roll / Thermal'}
                </p>
              </>
            ) : (
              <span className="text-xs font-mono-tabular text-zinc-500">
                Memuat gambar akhir...
              </span>
            )}
          </div>
        </div>

        {/* Column 2: Animated GIF (gif.js) - Tablet Right Col */}
        <div className="md:col-span-1 lg:col-span-4 bg-zinc-900/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl border border-zinc-800/70">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-[#F4F4F0]">
                02. Animasi GIF (gif.js)
              </h2>
              <p className="text-xs text-zinc-400">600×400px · Delay 500ms</p>
            </div>
            {gifBlobUrl && (
              <button
                type="button"
                onClick={() =>
                  downloadSingleFile(gifBlobUrl, `PB_${Date.now()}_anim.gif`)
                }
                className="min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer"
              >
                Unduh GIF
              </button>
            )}
          </div>

          <div className="aspect-[3/2] bg-zinc-950 rounded-xl overflow-hidden flex items-center justify-center border border-zinc-800/60">
            {isGeneratingGif ? (
              <div className="text-center space-y-2 p-4">
                <p className="text-xs font-mono-tabular text-zinc-300">
                  Merender GIF via Web Worker ({gifProgress}%)...
                </p>
                <p className="text-[11px] text-zinc-500">/assets/gif.worker.js</p>
              </div>
            ) : gifBlobUrl ? (
              <img
                data-testid="generated-gif-preview"
                src={gifBlobUrl}
                alt="Animasi GIF Sesi Photobox"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs text-zinc-500">Menyiapkan GIF...</span>
            )}
          </div>

          {/* Auto-Download Manifest Summary */}
          <div className="pt-3 border-t border-zinc-800/80 space-y-2">
            <p className="text-xs font-semibold text-zinc-300">
              File Sesi Lokal ({downloadedManifest.length} File):
            </p>
            <ul className="space-y-1 text-xs font-mono-tabular text-zinc-400 max-h-36 overflow-y-auto">
              {downloadedManifest.map((item) => (
                <li
                  key={item.filename}
                  className="flex items-center justify-between py-1 border-b border-zinc-800/50"
                >
                  <span className="truncate max-w-[200px]">{item.filename}</span>
                  <button
                    type="button"
                    onClick={() => downloadSingleFile(item.url, item.filename)}
                    className="text-zinc-200 hover:text-white underline ml-2 shrink-0 cursor-pointer"
                  >
                    Simpan
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Column 3: QR Code Google Drive - Tablet Full Width Banner / Desktop Col 3 */}
        <div className="md:col-span-2 lg:col-span-3 bg-zinc-900/80 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl border border-zinc-800/70">
          <div className="space-y-2">
            <h2 className="font-display text-base font-bold text-[#F4F4F0]">
              03. Scan untuk Mengunduh
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Pindai QR Code ini menggunakan kamera ponsel untuk membuka tautan Google Drive acara.
            </p>
          </div>

          <div
            data-testid="qr-code-container"
            className="bg-white p-5 rounded-2xl flex flex-col items-center justify-center mx-auto shadow-2xl"
          >
            <QRCodeSVG value={driveUrl} size={196} level="M" className="max-w-full" />
          </div>

          <div className="space-y-2.5 pt-2">
            <p className="text-[11px] font-mono-tabular text-zinc-400 break-all text-center">
              {driveUrl}
            </p>
            <button
              type="button"
              onClick={handleNewSession}
              className="w-full min-h-[50px] sm:min-h-[54px] py-3.5 px-4 text-sm font-extrabold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-lg flex items-center justify-center gap-2"
            >
              <span>Mulai Sesi Baru</span>
              <span>✨</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
