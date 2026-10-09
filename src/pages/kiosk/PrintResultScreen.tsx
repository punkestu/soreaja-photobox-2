import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const [driveUrl, setDriveUrl] = useState<string>(DEFAULT_DRIVE_URL);
  const [isGeneratingGif, setIsGeneratingGif] = useState<boolean>(false);
  const [gifProgress, setGifProgress] = useState<number>(0);
  const [printStatus, setPrintStatus] = useState<string>(
    'Menghubungkan ke Printer Thermal...'
  );
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
      // 1. Ambil URL G-Drive dari Dexie.js
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

      // 4. Jalankan fungsi Mock printThermal()
      setIsPrintingThermal(true);
      setPrintStatus('Menghubungkan ke Printer Thermal...');
      const thermalRes = await printThermal(layoutToUse);
      setIsPrintingThermal(false);
      setPrintStatus(`✅ ${thermalRes.message} · ID: ${thermalRes.jobId}`);

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
    setPrintStatus('Menghubungkan ke Printer Thermal (80mm)...');
    const res = await printThermal(finalLayoutBase64);
    setIsPrintingThermal(false);
    setPrintStatus(`✅ Cetak Ulang Thermal Berhasil (${res.jobId}) · Strip Tunggal 80mm`);
  };

  const handlePrintColor = async () => {
    setIsPrintingColor(true);
    const imageToPrint = doubleStripBase64 || finalLayoutBase64;
    setPrintStatus(
      doubleStripBase64
        ? 'Menghubungkan ke Printer Warna (Dye-Sub 4R - 2 Strip Side-by-Side)...'
        : 'Menghubungkan ke Printer Warna...'
    );
    const res = await printColor(imageToPrint);
    setIsPrintingColor(false);
    setPrintStatus(
      `✅ Cetak Warna Selesai (${res.jobId}) · ${
        doubleStripBase64 ? 'Format 2-Strip Side-by-Side (4R)' : 'Format Standar'
      }`
    );
  };

  const handleNewSession = () => {
    resetSession();
    navigate('/app/idle');
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 md:px-10 py-8 space-y-8">
      {/* Header & Live Hardware Status */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4">
        <div>
          <div className="text-xs font-mono-tabular text-zinc-400 flex items-center gap-2 mb-2">
            <span>Tahap 06 dari 06</span>
            <span aria-hidden="true">·</span>
            <span>Sesi Selesai</span>
            <span aria-hidden="true">·</span>
            <span>Auto-Download & Cetak</span>
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-bold text-[#F4F4F0]">
            Hasil Akhir Photobox & QR Code
          </h1>
          <p
            role="status"
            className="text-xs font-mono-tabular text-emerald-400 mt-1.5"
          >
            {printStatus}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isPrintingThermal}
            onClick={handleReprintThermal}
            className="px-4 py-2.5 text-xs font-semibold text-zinc-100 bg-zinc-900/80 hover:bg-zinc-800 disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-md"
          >
            {isPrintingThermal ? 'Mencetak Thermal...' : 'Print Ulang Thermal'}
          </button>

          <button
            type="button"
            disabled={isPrintingColor}
            onClick={handlePrintColor}
            className="px-4 py-2.5 text-xs font-semibold text-zinc-100 bg-zinc-900/80 hover:bg-zinc-800 disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-md"
          >
            {isPrintingColor ? 'Mencetak Warna (3d)...' : 'Print Warna'}
          </button>

          <button
            type="button"
            onClick={handleNewSession}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-lg"
          >
            Sesi Baru
          </button>
        </div>
      </div>

      {/* 3-Column Result Showcase: Final Framed Strip | Animated GIF | QR Code Google Drive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Column 1: Final Framed Photo Strip */}
        <div className="lg:col-span-5 bg-zinc-900/80 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[#F4F4F0]">
                01. Hasil Cetak Berbingkai
              </h2>
              <p className="text-xs text-zinc-400">{activeFrame.name}</p>
            </div>

            <div className="flex items-center gap-1.5">
              {doubleStripBase64 && (
                <button
                  type="button"
                  onClick={() =>
                    downloadSingleFile(
                      doubleStripBase64,
                      `PB_${Date.now()}_side_by_side_2strip.png`
                    )
                  }
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
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
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  title="Unduh 1 strip tunggal"
                >
                  {doubleStripBase64 ? 'Unduh 1-Strip' : 'Unduh PNG'}
                </button>
              )}
            </div>
          </div>

          {/* Toggle View jika 2-strip tersedia */}
          {doubleStripBase64 && (
            <div className="flex items-center justify-between bg-zinc-950/80 p-1.5 rounded-xl border border-zinc-800/80 text-xs">
              <span className="text-[11px] text-zinc-400 pl-2">Pratinjau:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setStripDisplayMode('single')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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

          <div className="bg-zinc-950 rounded-xl p-4 flex flex-col items-center justify-center min-h-[420px] gap-2">
            {finalLayoutBase64 ? (
              <>
                <img
                  src={
                    stripDisplayMode === 'double' && doubleStripBase64
                      ? doubleStripBase64
                      : finalLayoutBase64
                  }
                  alt="Hasil akhir strip foto berbingkai"
                  className="max-h-[460px] w-auto object-contain rounded shadow-2xl"
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

        {/* Column 2: Animated GIF (gif.js) */}
        <div className="lg:col-span-4 bg-zinc-900/80 rounded-2xl p-6 space-y-4 shadow-xl">
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
                className="px-3 py-1.5 text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Unduh GIF
              </button>
            )}
          </div>

          <div className="aspect-[3/2] bg-zinc-950 rounded-xl overflow-hidden flex items-center justify-center">
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

        {/* Column 3: QR Code Google Drive (qrcode.react) */}
        <div className="lg:col-span-3 bg-zinc-900/80 rounded-2xl p-6 space-y-5 flex flex-col justify-between shadow-xl">
          <div className="space-y-2">
            <h2 className="font-display text-base font-bold text-[#F4F4F0]">
              03. Scan untuk Mengunduh
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Pindai QR Code ini menggunakan kamera ponsel untuk membuka tautan Google
              Drive acara.
            </p>
          </div>

          <div
            data-testid="qr-code-container"
            className="bg-white p-5 rounded-2xl flex flex-col items-center justify-center mx-auto shadow-2xl"
          >
            <QRCodeSVG value={driveUrl} size={196} level="M" className="max-w-full" />
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-[11px] font-mono-tabular text-zinc-400 break-all">
              {driveUrl}
            </p>
            <button
              type="button"
              onClick={handleNewSession}
              className="w-full py-3.5 px-4 text-xs font-semibold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-lg"
            >
              Mulai Sesi Baru
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
