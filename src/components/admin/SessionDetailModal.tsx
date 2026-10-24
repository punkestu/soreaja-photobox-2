import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { SessionRecord, AppSettings } from '../../types/photobox';
import { downloadSingleFile } from '../../services/downloadService';
import { printThermal, printColor } from '../../services/printServices';
import { db } from '../../db';
import { usePhotobox } from '../../context/PhotoboxContext';

interface SessionDetailModalProps {
  session: SessionRecord;
  settings?: AppSettings;
  onClose: () => void;
  onDeleteSession: (sessionId: number) => void;
}

export const SessionDetailModal: React.FC<SessionDetailModalProps> = ({
  session,
  settings,
  onClose,
  onDeleteSession,
}) => {
  const { language, t } = usePhotobox();
  const [activeTab, setActiveTab] = useState<'single' | 'double'>(
    session.doubleStripBase64 ? 'double' : 'single'
  );
  const [reprintingType, setReprintingType] = useState<'thermal' | 'color' | null>(null);
  const [printFeedback, setPrintFeedback] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);
  const [copiedDrive, setCopiedDrive] = useState(false);

  const formattedDate = new Date(session.timestamp).toLocaleString(
    language === 'en' ? 'en-US' : 'id-ID',
    {
      dateStyle: 'full',
      timeStyle: 'medium',
    }
  );

  const targetDriveUrl =
    session.driveUrl ||
    settings?.driveUrl ||
    'https://drive.google.com/drive/folders/1SoreAjaPhotobox2StudioArchive';

  const handleCopyDriveUrl = async () => {
    try {
      await navigator.clipboard.writeText(targetDriveUrl);
      setCopiedDrive(true);
      setTimeout(() => setCopiedDrive(false), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  };

  const handleReprintThermal = async () => {
    if (!session.id || !session.finalLayoutBase64) return;
    setReprintingType('thermal');
    setPrintFeedback(null);
    const targetPrinter = settings?.thermalPrinterName || settings?.printerName;
    try {
      const res = await printThermal(session.finalLayoutBase64, settings?.printApiEndpoint, targetPrinter);
      const nextCount = (session.thermalPrintCount || 0) + 1;
      await db.sessions.update(session.id, {
        printedThermal: true,
        thermalPrintCount: nextCount,
      });
      setPrintFeedback({
        message: `✅ ${language === 'en' ? 'Thermal Print Dispatched' : 'Cetak Thermal Berhasil'} (${nextCount}x · ${res.jobId})`,
        isError: false,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setPrintFeedback({
        message: `⚠️ ${language === 'en' ? 'Thermal Print Failed' : 'Gagal Cetak Thermal'}: ${errMsg}`,
        isError: true,
      });
    } finally {
      setReprintingType(null);
    }
  };

  const handleReprintColor = async () => {
    if (!session.id) return;
    const imageToPrint = session.doubleStripBase64 || session.finalLayoutBase64;
    if (!imageToPrint) return;
    setReprintingType('color');
    setPrintFeedback(null);
    const targetPrinter = settings?.colorPrinterName || settings?.printerName;
    try {
      const res = await printColor(imageToPrint, settings?.printApiEndpoint, targetPrinter);
      const nextCount = (session.colorPrintCount || 0) + 1;
      await db.sessions.update(session.id, {
        printedColor: true,
        colorPrintCount: nextCount,
      });
      setPrintFeedback({
        message: `✅ ${language === 'en' ? 'Color 4R Print Dispatched' : 'Cetak Warna 4R Berhasil'} (${nextCount}x · ${res.jobId})`,
        isError: false,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setPrintFeedback({
        message: `⚠️ ${language === 'en' ? 'Color Print Failed' : 'Gagal Cetak Warna'}: ${errMsg}`,
        isError: true,
      });
    } finally {
      setReprintingType(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-[#111111]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-neutral-200 bg-neutral-50/70">
          <div className="min-w-0 pr-3">
            <h2 id="session-detail-title" className="text-lg font-bold text-neutral-900 truncate">
              {t.admin.sessionDetails} #{session.id} · {session.frameName}
            </h2>
            <p className="text-xs text-neutral-500 font-mono-tabular mt-0.5 truncate">
              {formattedDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.admin.closeModal}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-200/60 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 transition-colors cursor-pointer text-sm font-bold shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: Image Preview with Tab switcher */}
          <div className="md:col-span-7 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500">
                {language === 'en' ? 'Photo Strip Preview' : 'Pratinjau Hasil Strip Foto'}
              </span>
              {/* Tab Selector */}
              <div className="inline-flex p-0.5 bg-neutral-100 rounded-lg border border-neutral-300">
                <button
                  type="button"
                  onClick={() => setActiveTab('single')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    activeTab === 'single'
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  📱 {t.admin.singleStripTab}
                </button>
                {session.doubleStripBase64 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('double')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      activeTab === 'double'
                        ? 'bg-neutral-900 text-white shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    👥 {t.admin.doubleStripTab}
                  </button>
                )}
              </div>
            </div>

            {/* Image Canvas Box */}
            <div className="w-full bg-[#1A1A1A] rounded-xl border border-neutral-800 p-3 sm:p-4 flex items-center justify-center min-h-[340px] max-h-[460px] overflow-hidden">
              {activeTab === 'single' ? (
                session.finalLayoutBase64 ? (
                  <img
                    src={session.finalLayoutBase64}
                    alt={`Strip foto ${session.frameName}`}
                    className="max-h-[420px] max-w-full object-contain rounded shadow-lg"
                  />
                ) : (
                  <span className="text-xs text-neutral-400">Tidak ada gambar</span>
                )
              ) : session.doubleStripBase64 ? (
                <img
                  src={session.doubleStripBase64}
                  alt={`2-Strip side-by-side 4R ${session.frameName}`}
                  className="max-h-[420px] max-w-full object-contain rounded shadow-lg"
                />
              ) : (
                <span className="text-xs text-neutral-400">Layout 2-Strip tidak tersedia</span>
              )}
            </div>

            {/* Download Buttons for Current View */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {session.finalLayoutBase64 && (
                <button
                  type="button"
                  onClick={() =>
                    downloadSingleFile(
                      session.finalLayoutBase64,
                      `SoreAja_Session_${session.id || session.timestamp}_Single.png`
                    )
                  }
                  className="w-full py-2 px-3 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <span>⬇️</span>
                  <span>{t.admin.downloadSingle}</span>
                </button>
              )}
              {session.doubleStripBase64 && (
                <button
                  type="button"
                  onClick={() =>
                    downloadSingleFile(
                      session.doubleStripBase64!,
                      `SoreAja_Session_${session.id || session.timestamp}_2Strip_4R.png`
                    )
                  }
                  className="w-full py-2 px-3 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <span>⬇️</span>
                  <span>{t.admin.downloadDouble}</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Metadata, Hardware Print, QR Code, and Management */}
          <div className="md:col-span-5 flex flex-col gap-4">
            {/* Feedback Alert */}
            {printFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold ${
                  printFeedback.isError
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                {printFeedback.message}
              </div>
            )}

            {/* Metadata Summary Card */}
            <div className="bg-[#F4F4F0] rounded-xl border border-neutral-200/80 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200">
                <span className="text-neutral-500">{t.admin.sessionId}:</span>
                <span className="font-mono-tabular font-bold text-neutral-900">#{session.id}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200">
                <span className="text-neutral-500">{t.admin.sessionFrame}:</span>
                <span className="font-medium text-neutral-900 text-right">
                  {session.frameName} ({session.photoCount} {t.frameSelect.poses})
                </span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200">
                <span className="text-neutral-500">ID Bingkai:</span>
                <span className="font-mono-tabular text-neutral-700">{session.frameId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">{t.admin.sessionPrints}:</span>
                <span className="space-x-1.5 text-[11px] font-mono-tabular">
                  <span
                    className={`px-1.5 py-0.5 rounded font-semibold ${
                      session.printedThermal
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-neutral-200 text-neutral-600'
                    }`}
                  >
                    Thermal: {session.thermalPrintCount || (session.printedThermal ? 1 : 0)}x
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-semibold ${
                      session.printedColor
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-neutral-200 text-neutral-600'
                    }`}
                  >
                    Warna: {session.colorPrintCount || (session.printedColor ? 1 : 0)}x
                  </span>
                </span>
              </div>
            </div>

            {/* Reprint Hardware Triggers */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-neutral-700">
                {language === 'en' ? 'Hardware Reprint' : 'Cetak Ulang Perangkat'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={reprintingType === 'thermal'}
                  onClick={handleReprintThermal}
                  className="min-h-[44px] px-3 py-2 text-xs font-bold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 active:scale-95 disabled:opacity-50 rounded-xl transition-all border border-neutral-300 shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🖨️</span>
                  <span>
                    {reprintingType === 'thermal'
                      ? (language === 'en' ? 'Printing...' : 'Mencetak...')
                      : t.admin.reprintThermalAction}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={reprintingType === 'color'}
                  onClick={handleReprintColor}
                  className="min-h-[44px] px-3 py-2 text-xs font-bold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 disabled:opacity-50 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🎨</span>
                  <span>
                    {reprintingType === 'color'
                      ? (language === 'en' ? 'Printing...' : 'Mencetak...')
                      : t.admin.reprintColorAction}
                  </span>
                </button>
              </div>
            </div>

            {/* Google Drive QR Code Box */}
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
              <span className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
                <span>📱</span>
                <span>{t.admin.sessionDriveQr}</span>
              </span>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg border border-neutral-200 shadow-2xs shrink-0">
                  <QRCodeSVG value={targetDriveUrl} size={74} level="M" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[11px] font-mono-tabular text-neutral-500 truncate" title={targetDriveUrl}>
                    {targetDriveUrl}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyDriveUrl}
                    className="px-2.5 py-1 text-[11px] font-semibold text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-100 rounded-md transition-colors cursor-pointer"
                  >
                    {copiedDrive
                      ? (language === 'en' ? '✓ Copied' : '✓ Tersalin')
                      : (language === 'en' ? 'Copy URL' : 'Salin URL')}
                  </button>
                </div>
              </div>
            </div>

            {/* Danger Zone: Delete this session */}
            <div className="pt-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => {
                  if (session.id && window.confirm(t.admin.deleteSessionConfirm)) {
                    onDeleteSession(session.id);
                  }
                }}
                className="w-full py-2 px-3 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🗑️</span>
                <span>{language === 'en' ? 'Delete this Session Record' : 'Hapus Sesi Ini dari Riwayat'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
