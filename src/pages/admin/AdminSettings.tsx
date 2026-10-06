import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { db, DEFAULT_DRIVE_URL, DEFAULT_APP_SETTINGS } from '../../db';

export const AdminSettings: React.FC = () => {
  const [driveUrl, setDriveUrl] = useState(DEFAULT_DRIVE_URL);
  const [studioName, setStudioName] = useState(DEFAULT_APP_SETTINGS.studioName || '');
  const [eventName, setEventName] = useState(DEFAULT_APP_SETTINGS.eventName || '');
  const [defaultCaption, setDefaultCaption] = useState(DEFAULT_APP_SETTINGS.defaultCaption || 'SOREAJA — PHOTOBOX 2');
  const [showFrameStamps, setShowFrameStamps] = useState<boolean>(true);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(3);
  const [autoDownload, setAutoDownload] = useState<boolean>(true);
  const [mirrorCamera, setMirrorCamera] = useState<boolean>(true);
  const [cameraSourceMode, setCameraSourceMode] = useState<'auto' | 'simulator'>('auto');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
        if (data.cameraSourceMode) {
          setCameraSourceMode(data.cameraSourceMode);
        }
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);

    const cleanUrl = driveUrl.trim() || DEFAULT_DRIVE_URL;

    // Sesuai TSD 4.1.2: menyimpan data ke IndexedDB via db.settings.put({id: 'app_settings', driveUrl: '...'})
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
      cameraSourceMode,
      updatedAt: new Date().toISOString(),
    });

    setDriveUrl(cleanUrl);
    setIsSaving(false);
    setSaveMessage(
      `Pengaturan berhasil disimpan ke IndexedDB (PhotoboxDB · id: app_settings) pada ${new Date().toLocaleTimeString('id-ID')}.`
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
    setSaveMessage('Pengaturan dikembalikan ke konfigurasi bawaan pabrik.');
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <div className="text-xs text-neutral-500 flex items-center gap-2 mb-2">
          <span>Konfigurasi Lokal</span>
          <span aria-hidden="true">·</span>
          <span>Dexie.js (PhotoboxDB)</span>
          <span aria-hidden="true">·</span>
          <span>Tabel: settings</span>
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-neutral-900">
          Pengaturan Google Drive & Parameter Sesi
        </h1>
        <p className="text-sm text-neutral-600 mt-1">
          Tautan Google Drive di bawah ini akan dikodekan menjadi QR Code pada layar
          akhir pelanggan agar mereka dapat mengunduh foto di masa mendatang.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-white border border-neutral-200 rounded-xl p-6 space-y-6"
        >
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-200">
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
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showFrameStamps}
                onChange={(e) => setShowFrameStamps(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-[#E11D48] rounded"
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

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoDownload}
                onChange={(e) => setAutoDownload(e.target.checked)}
                className="w-4 h-4 accent-[#E11D48] rounded"
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
                className="w-4 h-4 accent-[#E11D48] rounded"
              />
              <span className="text-sm text-neutral-800">
                Efek Cermin (Mirror Horizontal) pada pratinjau kamera pelanggan
              </span>
            </label>
          </div>

          {saveMessage && (
            <div
              role="status"
              className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900"
            >
              {saveMessage}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#E11D48] hover:bg-[#BE123C] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-4 py-2.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Reset ke Default
            </button>
          </div>
        </form>

        {/* Live QR Code Verification Panel */}
        <div className="lg:col-span-5 bg-white border border-neutral-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-neutral-900">
            Pratinjau Langsung QR Code
          </h2>
          <p className="text-xs text-neutral-500">
            Setiap perubahan pada kolom Google Drive URL langsung memperbarui kode QR di
            bawah ini.
          </p>

          <div className="p-6 bg-[#F4F4F0] rounded-lg border border-neutral-200 flex flex-col items-center justify-center">
            <div className="bg-white p-4 rounded-lg border border-neutral-200">
              <QRCodeSVG
                value={driveUrl.trim() || DEFAULT_DRIVE_URL}
                size={180}
                level="M"
              />
            </div>
            <p className="mt-3 text-xs font-mono-tabular text-neutral-700 break-all text-center">
              {driveUrl.trim() || DEFAULT_DRIVE_URL}
            </p>
          </div>

          <div className="text-xs text-neutral-500 space-y-1 pt-2 border-t border-neutral-200">
            <p className="font-semibold text-neutral-800">Catatan Operasional Offline:</p>
            <p>
              Operator dapat mengunggah folder hasil unduhan otomatis (
              <code className="font-mono-tabular">PB_*_final.png</code> &{' '}
              <code className="font-mono-tabular">PB_*_anim.gif</code>) ke folder Google
              Drive di atas setelah acara selesai atau saat koneksi tersedia.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
