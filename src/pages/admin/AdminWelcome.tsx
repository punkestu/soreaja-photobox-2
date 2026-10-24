import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { QRCodeSVG } from 'qrcode.react';
import { db, DEFAULT_DRIVE_URL, ensureDefaultSettings } from '../../db';
import { fetchFramesMetadata, KIOSK_HERO_BACKDROP } from '../../data/defaultFrames';
import type { FrameMetadata, SessionRecord } from '../../types/photobox';
import { downloadSingleFile } from '../../services/downloadService';
import { printThermal, printColor } from '../../services/printServices';
import { usePhotobox } from '../../context/PhotoboxContext';
import { ResetAllDataModal } from '../../components/common/ResetAllDataModal';
import { BrandLogo } from '../../components/common/BrandLogo';

export const AdminWelcome: React.FC = () => {
  const navigate = useNavigate();
  const { language, t } = usePhotobox();
  const [frames, setFrames] = useState<FrameMetadata[]>([]);
  const [loadingFrames, setLoadingFrames] = useState(true);
  const [reprintingSessionId, setReprintingSessionId] = useState<number | null>(null);
  const [reprintingType, setReprintingType] = useState<'thermal' | 'color' | null>(null);
  const [reprintFeedback, setReprintFeedback] = useState<{
    sessionId: number;
    message: string;
    isError: boolean;
  } | null>(null);
  const [showResetAllModal, setShowResetAllModal] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const settings = useLiveQuery(() => db.settings.get('app_settings'), []);
  const totalSessionCount = useLiveQuery(() => db.sessions.count(), []);
  const sessions = useLiveQuery(
    () => db.sessions.orderBy('timestamp').reverse().limit(3).toArray(),
    []
  );

  useEffect(() => {
    ensureDefaultSettings();
    fetchFramesMetadata().then((data) => {
      setFrames(data);
      setLoadingFrames(false);
    });
  }, []);

  const activeDriveUrl = settings?.driveUrl || DEFAULT_DRIVE_URL;
  const studioName = settings?.studioName || 'SoreAja Studio — Booth 02';
  const eventName = settings?.eventName || 'SoreAja Sunset Session 2026';

  const handleClearHistory = async () => {
    await db.sessions.clear();
  };

  const handleReprintThermal = async (session: SessionRecord) => {
    if (!session.id || !session.finalLayoutBase64) return;
    setReprintingSessionId(session.id);
    setReprintingType('thermal');
    setReprintFeedback(null);
    const targetPrinter = settings?.thermalPrinterName || settings?.printerName;
    try {
      const res = await printThermal(session.finalLayoutBase64, settings?.printApiEndpoint, targetPrinter);
      const nextCount = (session.thermalPrintCount || 0) + 1;
      await db.sessions.update(session.id, {
        printedThermal: true,
        thermalPrintCount: nextCount,
      });
      setReprintFeedback({
        sessionId: session.id,
        message: `✅ Cetak Thermal Berhasil (${nextCount}x · ${res.jobId})`,
        isError: false,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setReprintFeedback({
        sessionId: session.id,
        message: `⚠️ Gagal: ${errMsg}`,
        isError: true,
      });
    } finally {
      setReprintingSessionId(null);
      setReprintingType(null);
    }
  };

  const handleReprintColor = async (session: SessionRecord) => {
    if (!session.id) return;
    const imageToPrint = session.doubleStripBase64 || session.finalLayoutBase64;
    if (!imageToPrint) return;
    setReprintingSessionId(session.id);
    setReprintingType('color');
    setReprintFeedback(null);
    const targetPrinter = settings?.colorPrinterName || settings?.printerName;
    try {
      const res = await printColor(imageToPrint, settings?.printApiEndpoint, targetPrinter);
      const nextCount = (session.colorPrintCount || 0) + 1;
      await db.sessions.update(session.id, {
        printedColor: true,
        colorPrintCount: nextCount,
      });
      setReprintFeedback({
        sessionId: session.id,
        message: `✅ Cetak Warna Berhasil (${nextCount}x · ${res.jobId})`,
        isError: false,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setReprintFeedback({
        sessionId: session.id,
        message: `⚠️ Gagal: ${errMsg}`,
        isError: true,
      });
    } finally {
      setReprintingSessionId(null);
      setReprintingType(null);
    }
  };

  return (
    <div className="space-y-10 max-w-5xl">
      {notification && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-900 flex items-center justify-between shadow-xs animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{notification}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hero Banner & Executive Summary */}
      <section className="bg-white border border-neutral-200 rounded-xl p-6 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-3">
              <BrandLogo size="md" showRing={true} className="ring-neutral-200 shadow-xs" />
              <div className="text-xs text-neutral-500 flex items-center gap-2">
                <span>{t.admin.portalTitle}</span>
                <span aria-hidden="true">·</span>
                <span>Dexie.js (PhotoboxDB)</span>
                <span aria-hidden="true">·</span>
                <span>{t.admin.offlineReady}</span>
              </div>
            </div>

            <h1
              className="font-display text-2xl md:text-4xl font-bold tracking-tight text-neutral-900"
              style={{ textWrap: 'balance' }}
            >
              {language === 'en' ? `Welcome to ${studioName}` : `Selamat Datang di ${studioName}`}
            </h1>

            <p className="text-sm md:text-base text-neutral-600 leading-relaxed max-w-xl">
              {language === 'en'
                ? `Self-contained photobox kiosk system for ${eventName}. WebRTC capture, canvas framing, animated GIF generation, and backups run directly on your local device.`
                : `Sistem photobox mandiri berbasis web untuk acara ${eventName}. Seluruh proses pemotretan WebRTC, penggabungan bingkai kanvas, pembuatan animasi GIF, serta pengunduhan cadangan berjalan langsung di perangkat lokal.`}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/app/idle')}
                className="min-h-[48px] px-6 py-2.5 text-sm font-bold text-white bg-[var(--theme-accent,#E11D48)] rounded-xl hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 transition-all whitespace-nowrap cursor-pointer shadow-sm flex items-center gap-2"
              >
                <span>🚀</span>
                <span>{t.admin.navOpenKiosk}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/settings')}
                className="min-h-[48px] px-5 py-2.5 text-sm font-semibold text-neutral-800 bg-neutral-100 rounded-xl hover:bg-neutral-200 active:scale-95 transition-all whitespace-nowrap cursor-pointer flex items-center gap-2"
              >
                <span>⚙️</span>
                <span>{t.admin.navSettings}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative rounded-lg overflow-hidden border border-neutral-200 aspect-video bg-neutral-900">
              <img
                src={KIOSK_HERO_BACKDROP}
                alt="Studio Photobox"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-90"
              />
              <div className="absolute top-3 right-3 z-10">
                <BrandLogo size="xs" showRing={true} className="ring-white/40 shadow-sm" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex flex-col justify-end p-4 text-white">
                <p className="font-serif-editorial italic text-lg leading-snug">
                  {language === 'en'
                    ? '“Capture the best golden moments in classic printouts.”'
                    : '“Abadikan momen sore terbaik dalam cetakan klasik.”'}
                </p>
                <p className="text-xs text-neutral-300 font-mono-tabular mt-1">
                  {frames.length} {language === 'en' ? 'Frame Templates Registered · WebRTC + Studio Simulator' : 'Template Bingkai Terdaftar · WebRTC + Simulasi Studio'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Operational Metrics & Active Google Drive QR Verification */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-neutral-200 rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              01. {language === 'en' ? 'System Status & Local Devices' : 'Status Komponen & Perangkat Lokal'}
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              {language === 'en'
                ? 'Overview of offline module readiness with zero external network dependency.'
                : 'Ringkasan kesiapan modul lokal tanpa ketergantungan jaringan eksternal.'}
            </p>
          </div>

          <div className="divide-y divide-neutral-200 border-t border-b border-neutral-200 text-sm">
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-neutral-600">{language === 'en' ? 'Local DB (Dexie.js / PhotoboxDB)' : 'Database Lokal (Dexie.js / PhotoboxDB)'}</span>
              <span className="font-mono-tabular font-medium text-[#16A34A]">
                {language === 'en' ? `Connected · ${sessions?.length ?? 0} Sessions Saved` : `Terhubung · ${sessions?.length ?? 0} Sesi Tersimpan`}
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-neutral-600">{language === 'en' ? 'Frame Catalog (/metadata.json)' : 'Konfigurasi Bingkai (/metadata.json)'}</span>
              <span className="font-mono-tabular font-medium text-neutral-900">
                {loadingFrames ? (language === 'en' ? 'Loading...' : 'Memuat...') : `${frames.length} ${language === 'en' ? 'Frames Ready' : 'Bingkai Siap'}`}
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-neutral-600">{t.admin.defaultCaptionLabel}</span>
              <span className="font-mono-tabular font-medium text-neutral-900 truncate max-w-[220px]">
                {settings?.defaultCaption || 'SOREAJA — PHOTOBOX 2'}
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-neutral-600">{language === 'en' ? 'Frame Text Stamps' : 'Stempel Teks Bingkai'}</span>
              <span className="font-mono-tabular font-medium text-neutral-900">
                {settings?.showFrameStamps !== false
                  ? (language === 'en' ? 'Active (Displayed)' : 'Aktif (Ditampilkan)')
                  : (language === 'en' ? 'Hidden (Clean Mode)' : 'Sembunyi (Mode Custom Frame)')}
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-neutral-600">{t.admin.countdownLabel}</span>
              <span className="font-mono-tabular font-medium text-neutral-900">
                {settings?.countdownSeconds ?? 3} {language === 'en' ? 'Seconds / Shot' : 'Detik / Foto'}
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-neutral-600">{t.admin.autoDownloadLabel}</span>
              <span className="font-mono-tabular font-medium text-neutral-900">
                {settings?.autoDownload !== false ? (language === 'en' ? 'Active' : 'Aktif') : 'Manual'}
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-neutral-600">{language === 'en' ? 'Print Integration (80mm & 4R)' : 'Integrasi Cetak (Thermal 80mm & Warna 4R)'}</span>
              <span className="font-mono-tabular font-medium text-[#16A34A]">
                {language === 'en' ? 'Ready (Mock Simulation Active)' : 'Siap (Simulasi Mock Aktif)'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>
              {language === 'en' ? 'Last updated: ' : 'Terakhir diperbarui: '}
              {settings?.updatedAt ? new Date(settings.updatedAt).toLocaleString(language === 'en' ? 'en-US' : 'id-ID') : (language === 'en' ? 'Just now' : 'Baru saja')}
            </span>
            <Link
              to="/admin/launch"
              className="font-semibold text-neutral-900 hover:underline"
            >
              {language === 'en' ? 'Test Printers on Launch Page →' : 'Uji Perangkat di Halaman Peluncuran →'}
            </Link>
          </div>
        </div>

        {/* Active QR Code Preview Card */}
        <div className="lg:col-span-5 bg-white border border-neutral-200 rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              02. {language === 'en' ? 'Active Google Drive QR Code' : 'QR Code Google Drive Aktif'}
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              {language === 'en'
                ? 'Displayed on kiosk print result screen for customers to scan.'
                : 'Ditampilkan pada layar hasil cetak untuk dipindai pelanggan.'}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center py-3 bg-[#F4F4F0] rounded-lg border border-neutral-200/80">
            <div className="bg-white p-3 rounded-lg border border-neutral-200">
              <QRCodeSVG value={activeDriveUrl} size={136} level="M" />
            </div>
            <p className="mt-3 px-4 text-xs font-mono-tabular text-neutral-600 truncate max-w-full">
              {activeDriveUrl}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-neutral-500">Key: app_settings</span>
            <button
              type="button"
              onClick={() => navigate('/admin/settings')}
              className="px-3 py-1.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              {language === 'en' ? 'Edit URL in Settings' : 'Edit URL di Pengaturan'}
            </button>
          </div>
        </div>
      </section>

      {/* Frame Catalog Overview & Quick Link */}
      <section className="bg-white border border-neutral-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              03. {t.admin.framesCatalogTitle || (language === 'en' ? 'Studio Frame Catalog' : 'Katalog Bingkai Studio')}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {language === 'en'
                ? 'Registered frames and slot coordinate configurations for HTML5 canvas compositing.'
                : 'Daftar layout bingkai dan konfigurasi slot foto kanvas untuk penggabungan hasil cetak.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <Link
              to="/admin/frames"
              className="px-3.5 py-2 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
            >
              <span>🖼️</span>
              <span>
                {t.admin.viewAllFrames} ({frames.length}) →
              </span>
            </Link>
            <button
              type="button"
              onClick={() => navigate('/app/frame-selection')}
              className="px-3.5 py-2 text-xs font-semibold text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-100 transition-colors whitespace-nowrap cursor-pointer"
            >
              {language === 'en' ? 'Preview Frame Picker' : 'Pratinjau Pemilih Bingkai'}
            </button>
          </div>
        </div>

        {/* Quick Summary Pill Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular">
          <span className="px-2.5 py-1 bg-[#F4F4F0] border border-neutral-200 rounded-lg font-semibold text-neutral-800">
            📊 {frames.length} {language === 'en' ? 'Total Frames' : 'Total Bingkai'}
          </span>
          <span className="px-2.5 py-1 bg-sky-50 border border-sky-200 rounded-lg font-semibold text-sky-800">
            📱 {frames.filter((f) => (f.canvasWidth || 500) / (f.canvasHeight || 1220) <= 0.65).length} Single Strip
          </span>
          <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg font-semibold text-amber-800">
            👥 {frames.filter((f) => (f.canvasWidth || 500) / (f.canvasHeight || 1220) > 0.65).length} Double Strip 4R
          </span>
        </div>

        {/* Mini Preview Reel */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {frames.slice(0, 4).map((frame) => {
            const isDouble = (frame.canvasWidth || 500) / (frame.canvasHeight || 1220) > 0.65;
            return (
              <Link
                key={frame.id}
                to="/admin/frames"
                className="group p-2.5 bg-[#F4F4F0] hover:bg-white border border-neutral-200 hover:border-neutral-400 rounded-xl transition-all shadow-2xs hover:shadow-sm flex flex-col justify-between gap-2"
              >
                <div className="aspect-[3/4] bg-[#121214] rounded-lg overflow-hidden flex items-center justify-center p-1.5 relative">
                  {frame.previewImg || frame.frameImg ? (
                    <img
                      src={frame.previewImg || frame.frameImg}
                      alt={frame.name}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <span className="text-[10px] text-neutral-500">-</span>
                  )}
                  <span className="absolute top-1.5 right-1.5 text-[9px] font-mono-tabular bg-black/75 text-white px-1 py-0.2 rounded">
                    {frame.photoCount}P
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-900 truncate">{frame.name}</p>
                  <p className="text-[10px] font-mono-tabular text-neutral-500 truncate">
                    {frame.canvasWidth || 500}×{frame.canvasHeight || 1220} px · {isDouble ? '4R' : 'Strip'}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent Session History in IndexedDB */}
      <section className="bg-white border border-neutral-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              04. {t.admin.recentSessions}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {language === 'en'
                ? 'Latest session archive stored in IndexedDB on this local device.'
                : 'Arsip sesi terakhir yang tersimpan di IndexedDB perangkat ini.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/sessions"
              className="px-3.5 py-1.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
            >
              <span>🖼️</span>
              <span>
                {t.admin.viewAllSessions}
                {typeof totalSessionCount === 'number' && totalSessionCount > 0
                  ? ` (${totalSessionCount})`
                  : ''} →
              </span>
            </Link>
            {sessions && sessions.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-[#DC2626] border border-neutral-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                {t.admin.clearHistory}
              </button>
            )}
          </div>
        </div>

        {!sessions || sessions.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-neutral-200 rounded-lg space-y-3">
            <p className="text-sm font-medium text-neutral-700">
              {t.admin.noSessions}
            </p>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">
              {language === 'en'
                ? 'Whenever customers complete a photobox session, the final strips and photos are archived here automatically.'
                : 'Setiap kali pelanggan menyelesaikan sesi hingga tahap cetak, hasil strip foto akan diarsipkan secara otomatis di sini.'}
            </p>
            <div>
              <button
                type="button"
                onClick={() => navigate('/app/idle')}
                className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                {language === 'en' ? 'Start First Session Now' : 'Mulai Sesi Pertama Sekarang'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="border border-neutral-200 rounded-lg p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="aspect-[3/4] bg-neutral-100 rounded overflow-hidden flex items-center justify-center p-2">
                    {session.finalLayoutBase64 ? (
                      <img
                        src={session.finalLayoutBase64}
                        alt={`Hasil sesi ${session.frameName}`}
                        className="max-h-full max-w-full object-contain shadow-sm"
                      />
                    ) : (
                      <span className="text-xs text-neutral-400 font-mono-tabular">Tidak ada gambar</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">
                      {session.frameName}
                    </p>
                    <p className="text-xs text-neutral-500 font-mono-tabular">
                      {new Date(session.timestamp).toLocaleString(language === 'en' ? 'en-US' : 'id-ID')} ·{' '}
                      {session.photoCount} {t.frameSelect.poses}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 w-full pt-1">
                  {/* File Download Buttons */}
                  <div className="flex flex-col gap-1.5 w-full">
                    {session.doubleStripBase64 && (
                      <button
                        type="button"
                        onClick={() =>
                          downloadSingleFile(
                            session.doubleStripBase64!,
                            `SoreAja_${session.timestamp}_side_by_side_2strip.png`
                          )
                        }
                        className="w-full py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                      >
                        {language === 'en' ? 'Download 2-Strip Side-by-Side (4R)' : 'Unduh 2-Strip Side-by-Side (4R)'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        downloadSingleFile(
                          session.finalLayoutBase64,
                          `SoreAja_${session.timestamp}_final.png`
                        )
                      }
                      className="w-full py-1.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                    >
                      {language === 'en' ? 'Download Single Strip' : 'Unduh Strip Tunggal'}
                    </button>
                  </div>

                  {/* Direct Reprint Actions & Counters */}
                  <div className="pt-2 border-t border-neutral-200 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono-tabular text-neutral-500">
                      <span className="font-medium text-neutral-600">{language === 'en' ? 'Reprint Session:' : 'Cetak Ulang Sesi:'}</span>
                      <span className="text-neutral-500">
                        Thermal: <strong className="text-neutral-800">{session.thermalPrintCount || (session.printedThermal ? 1 : 0)}x</strong> · {language === 'en' ? 'Color' : 'Warna'}: <strong className="text-neutral-800">{session.colorPrintCount || (session.printedColor ? 1 : 0)}x</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        disabled={reprintingSessionId === session.id}
                        onClick={() => handleReprintThermal(session)}
                        className="min-h-[42px] px-2.5 py-1.5 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 active:scale-95 disabled:opacity-50 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-neutral-300 shadow-2xs"
                        title={language === 'en' ? 'Send 1 strip to thermal printer (80mm)' : 'Kirim 1 strip ke printer thermal (80mm)'}
                      >
                        <span>🖨️</span>
                        <span>
                          {reprintingSessionId === session.id && reprintingType === 'thermal'
                            ? (language === 'en' ? 'Printing...' : 'Mencetak...')
                            : session.thermalPrintCount
                              ? `Thermal (${session.thermalPrintCount}x)`
                              : 'Thermal'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={reprintingSessionId === session.id}
                        onClick={() => handleReprintColor(session)}
                        className="min-h-[42px] px-2.5 py-1.5 text-xs font-semibold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 disabled:opacity-50 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                        title={language === 'en' ? 'Send to color printer (4R)' : 'Kirim ke printer warna (4R)'}
                      >
                        <span>🎨</span>
                        <span>
                          {reprintingSessionId === session.id && reprintingType === 'color'
                            ? (language === 'en' ? 'Printing...' : 'Mencetak...')
                            : session.colorPrintCount
                              ? `${language === 'en' ? 'Color' : 'Warna'} (${session.colorPrintCount}x)`
                              : (language === 'en' ? 'Color' : 'Warna')}
                        </span>
                      </button>
                    </div>

                    {reprintFeedback && reprintFeedback.sessionId === session.id && (
                      <p
                        role="status"
                        className={`text-[11px] font-mono-tabular px-2.5 py-1.5 rounded-lg border leading-tight ${reprintFeedback.isError
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold'
                          }`}
                      >
                        {reprintFeedback.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalSessionCount && totalSessionCount > 3 ? (
            <div className="pt-2 text-center">
              <Link
                to="/admin/sessions"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-neutral-900 bg-[#F4F4F0] hover:bg-neutral-200 border border-neutral-300 rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                <span>
                  {language === 'en'
                    ? `View all ${totalSessionCount} sessions in Full Gallery`
                    : `Lihat seluruh ${totalSessionCount} sesi di Galeri Lengkap`}
                </span>
                <span>→</span>
              </Link>
            </div>
          ) : null}
        </>
      )}
      </section>

      {/* Modal Dialog for Resetting All Data */}
      <ResetAllDataModal
        isOpen={showResetAllModal}
        onClose={() => setShowResetAllModal(false)}
        onSuccess={() => {
          setNotification(t.admin.resetAllDataSuccess);
          setTimeout(() => setNotification(null), 5000);
        }}
      />
    </div>
  );
};
