import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { QRCodeSVG } from 'qrcode.react';
import { db, DEFAULT_DRIVE_URL, ensureDefaultSettings } from '../../db';
import { fetchFramesMetadata, KIOSK_HERO_BACKDROP } from '../../data/defaultFrames';
import type { FrameMetadata } from '../../types/photobox';
import { downloadSingleFile } from '../../services/downloadService';

export const AdminWelcome: React.FC = () => {
  const navigate = useNavigate();
  const [frames, setFrames] = useState<FrameMetadata[]>([]);
  const [loadingFrames, setLoadingFrames] = useState(true);

  const settings = useLiveQuery(() => db.settings.get('app_settings'), []);
  const sessions = useLiveQuery(
    () => db.sessions.orderBy('timestamp').reverse().limit(12).toArray(),
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

  return (
    <div className="space-y-10 max-w-5xl">
      {/* Hero Banner & Executive Summary */}
      <section className="bg-white border border-neutral-200 rounded-xl p-6 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="text-xs text-neutral-500 flex items-center gap-2">
              <span>Panel Manajemen Studio</span>
              <span aria-hidden="true">·</span>
              <span>Penyimpanan Dexie IndexedDB Aktif</span>
              <span aria-hidden="true">·</span>
              <span>Mode Offline Siap</span>
            </div>

            <h1
              className="font-display text-2xl md:text-4xl font-bold tracking-tight text-neutral-900"
              style={{ textWrap: 'balance' }}
            >
              Selamat Datang di {studioName}
            </h1>

            <p className="text-sm md:text-base text-neutral-600 leading-relaxed max-w-xl">
              Sistem photobox mandiri berbasis web untuk acara{' '}
              <strong className="font-semibold text-neutral-900">{eventName}</strong>.
              Seluruh proses pemotretan WebRTC, penggabungan bingkai kanvas, pembuatan
              animasi GIF, serta pengunduhan cadangan berjalan langsung di perangkat lokal.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/app/idle')}
                className="min-h-[48px] px-6 py-2.5 text-sm font-bold text-white bg-[var(--theme-accent,#E11D48)] rounded-xl hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 transition-all whitespace-nowrap cursor-pointer shadow-sm flex items-center gap-2"
              >
                <span>🚀</span>
                <span>Mulai Sesi Pelanggan</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/settings')}
                className="min-h-[48px] px-5 py-2.5 text-sm font-semibold text-neutral-800 bg-neutral-100 rounded-xl hover:bg-neutral-200 active:scale-95 transition-all whitespace-nowrap cursor-pointer flex items-center gap-2"
              >
                <span>⚙️</span>
                <span>Ubah Pengaturan Studio</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative rounded-lg overflow-hidden border border-neutral-200 aspect-video bg-neutral-900">
              <img
                src={KIOSK_HERO_BACKDROP}
                alt="Suasana Studio SoreAja Photobox 2"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex flex-col justify-end p-4 text-white">
                <p className="font-serif-editorial italic text-lg leading-snug">
                  “Abadikan momen sore terbaik dalam cetakan klasik.”
                </p>
                <p className="text-xs text-neutral-300 font-mono-tabular mt-1">
                  {frames.length} Template Bingkai Terdaftar · WebRTC + Simulasi Studio
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
              01. Status Komponen & Perangkat Lokal
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Ringkasan kesiapan modul lokal tanpa ketergantungan jaringan eksternal.
            </p>
          </div>

          <div className="divide-y divide-neutral-200 border-t border-b border-neutral-200 text-sm">
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-neutral-600">Database Lokal (Dexie.js / PhotoboxDB)</span>
              <span className="font-mono-tabular font-medium text-[#16A34A]">
                Terhubung · {sessions?.length ?? 0} Sesi Tersimpan
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-neutral-600">Konfigurasi Bingkai (/metadata.json)</span>
              <span className="font-mono-tabular font-medium text-neutral-900">
                {loadingFrames ? 'Memuat...' : `${frames.length} Bingkai Siap`}
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-neutral-600">Default Teks Stempel Bawah Bingkai</span>
              <span className="font-mono-tabular font-medium text-neutral-900 truncate max-w-[220px]">
                {settings?.defaultCaption || 'SOREAJA — PHOTOBOX 2'}
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-neutral-600">Stempel Teks Bingkai (Header & Footer)</span>
              <span className="font-mono-tabular font-medium text-neutral-900">
                {settings?.showFrameStamps !== false ? 'Aktif (Ditampilkan)' : 'Sembunyi (Mode Custom Frame)'}
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-neutral-600">Timer Hitung Mundur Kamera</span>
              <span className="font-mono-tabular font-medium text-neutral-900">
                {settings?.countdownSeconds ?? 3} Detik / Foto
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-neutral-600">Unduh Otomatis File Sesi (Raw + Final + GIF)</span>
              <span className="font-mono-tabular font-medium text-neutral-900">
                {settings?.autoDownload !== false ? 'Aktif' : 'Manual'}
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-4">
              <span className="text-neutral-600">Integrasi Cetak (Thermal 80mm & Warna 4R)</span>
              <span className="font-mono-tabular font-medium text-[#16A34A]">
                Siap (Simulasi Mock Aktif)
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Terakhir diperbarui: {settings?.updatedAt ? new Date(settings.updatedAt).toLocaleString('id-ID') : 'Baru saja'}</span>
            <Link
              to="/admin/launch"
              className="font-semibold text-neutral-900 hover:underline"
            >
              Uji Perangkat di Halaman Peluncuran →
            </Link>
          </div>
        </div>

        {/* Active QR Code Preview Card */}
        <div className="lg:col-span-5 bg-white border border-neutral-200 rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              02. QR Code Google Drive Aktif
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Ditampilkan pada layar hasil cetak untuk dipindai pelanggan.
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
              Edit URL di Pengaturan
            </button>
          </div>
        </div>
      </section>

      {/* Frame Catalog Loaded from /metadata.json */}
      <section className="bg-white border border-neutral-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              03. Katalog Bingkai Terdaftar (/metadata.json)
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Daftar layout bingkai dan koordinat slot foto untuk penggabungan HTML5 Canvas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/frame-selection')}
            className="px-3.5 py-2 text-xs font-semibold text-neutral-900 border border-neutral-300 rounded-lg hover:bg-neutral-100 transition-colors whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            Pratinjau Pemilih Bingkai
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                <th className="py-2.5 pr-4 font-medium">ID Bingkai</th>
                <th className="py-2.5 px-4 font-medium">Nama Layout</th>
                <th className="py-2.5 px-4 font-medium text-right">Jumlah Foto</th>
                <th className="py-2.5 px-4 font-medium text-right">Ukuran Kanvas</th>
                <th className="py-2.5 pl-4 font-medium">Koordinat Slot Pertama</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {frames.map((frame) => {
                const firstPos = frame.positions[0];
                return (
                  <tr key={frame.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-3 pr-4 font-mono-tabular text-xs text-neutral-600">
                      {frame.id}
                    </td>
                    <td className="py-3 px-4 font-medium text-neutral-900">
                      {frame.name}
                      {frame.subtitle ? (
                        <span className="text-xs text-neutral-500 font-normal">
                          {' '}
                          · {frame.subtitle}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular">
                      {frame.photoCount} Pose
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-xs text-neutral-600">
                      {frame.canvasWidth || 500} × {frame.canvasHeight || 1220} px
                    </td>
                    <td className="py-3 pl-4 font-mono-tabular text-xs text-neutral-600">
                      {firstPos
                        ? `x:${firstPos.x}, y:${firstPos.y} (${firstPos.width}×${firstPos.height})`
                        : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Session History in IndexedDB */}
      <section className="bg-white border border-neutral-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              04. Riwayat Sesi Photobox Lokal
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Arsip sesi terakhir yang tersimpan di IndexedDB perangkat ini.
            </p>
          </div>
          {sessions && sessions.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-[#DC2626] border border-neutral-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              Bersihkan Riwayat Lokal
            </button>
          )}
        </div>

        {!sessions || sessions.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-neutral-200 rounded-lg space-y-3">
            <p className="text-sm font-medium text-neutral-700">
              Belum ada sesi pemotretan yang tercatat pada perangkat ini.
            </p>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">
              Setiap kali pelanggan menyelesaikan sesi hingga tahap cetak, hasil strip
              foto akan diarsipkan secara otomatis di sini.
            </p>
            <div>
              <button
                type="button"
                onClick={() => navigate('/app/idle')}
                className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Mulai Sesi Pertama Sekarang
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="border border-neutral-200 rounded-lg p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="aspect-[3/4] bg-neutral-100 rounded overflow-hidden flex items-center justify-center p-2">
                    <img
                      src={session.finalLayoutBase64}
                      alt={`Hasil sesi ${session.frameName}`}
                      className="max-h-full max-w-full object-contain shadow-sm"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">
                      {session.frameName}
                    </p>
                    <p className="text-xs text-neutral-500 font-mono-tabular">
                      {new Date(session.timestamp).toLocaleString('id-ID')} ·{' '}
                      {session.photoCount} Foto
                    </p>
                  </div>
                </div>
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
                      className="w-full py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors cursor-pointer"
                    >
                      Unduh 2-Strip Side-by-Side (4R)
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
                    className="w-full py-1.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors cursor-pointer"
                  >
                    Unduh Strip Tunggal
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
