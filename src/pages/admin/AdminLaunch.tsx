import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { printThermal, printColor, type PrintJobResult } from '../../services/printServices';

export const AdminLaunch: React.FC = () => {
  const navigate = useNavigate();
  const [testingThermal, setTestingThermal] = useState(false);
  const [testingColor, setTestingColor] = useState(false);
  const [lastPrintResult, setLastPrintResult] = useState<PrintJobResult | null>(null);

  const handleLaunchKiosk = async (requestFullscreen: boolean) => {
    if (requestFullscreen && document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Ignore fullscreen rejection in embedded iframes
      }
    }
    navigate('/app/idle');
  };

  const handleTestThermal = async () => {
    setTestingThermal(true);
    const res = await printThermal();
    setLastPrintResult(res);
    setTestingThermal(false);
  };

  const handleTestColor = async () => {
    setTestingColor(true);
    const res = await printColor();
    setLastPrintResult(res);
    setTestingColor(false);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <div className="text-xs text-neutral-500 flex items-center gap-2 mb-2">
          <span>Mode Pelanggan</span>
          <span aria-hidden="true">·</span>
          <span>Rute Target: /app/idle</span>
          <span aria-hidden="true">·</span>
          <span>Layar Penuh Kiosk</span>
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-neutral-900">
          Peluncuran Sesi Photobox (Kiosk Mode)
        </h1>
        <p className="text-sm text-neutral-600 mt-1">
          Pastikan printer thermal, printer warna, dan kamera studio siap sebelum
          membuka tampilan layar penuh untuk pelanggan.
        </p>
      </div>

      {/* Primary Launch Card */}
      <section className="bg-neutral-900 text-white rounded-xl p-8 border border-neutral-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <p className="text-xs font-mono-tabular text-neutral-400">
            KIOSK DISPLAY · 100% OFFLINE READY
          </p>
          <h2 className="font-display text-2xl font-bold">
            Siap Menerima Pelanggan di Booth?
          </h2>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Membuka antarmuka layar sentuh pelanggan dimulai dari layar tunggu (
            <code className="font-mono-tabular text-white">/app/idle</code>), pemilihan
            bingkai, pengambilan foto otomatis, hingga pencetakan dan QR Code.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0 w-full md:w-auto">
          <button
            type="button"
            onClick={() => handleLaunchKiosk(true)}
            className="px-6 py-3.5 text-sm font-semibold text-white bg-[#E11D48] hover:bg-[#BE123C] rounded-lg transition-colors whitespace-nowrap text-center cursor-pointer"
          >
            Luncurkan Photobox Fullscreen
          </button>
          <Link
            to="/app/idle"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors whitespace-nowrap text-center"
          >
            Buka di Tab Baru (/app/idle)
          </Link>
        </div>
      </section>

      {/* Hardware Diagnostic & Mock Print Verification */}
      <section className="bg-white border border-neutral-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">
            Uji Coba Printer (Simulasi Mock Hardware)
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Verifikasi fungsi <code className="font-mono-tabular">printThermal()</code>{' '}
            (1500ms) dan <code className="font-mono-tabular">printColor()</code> (3000ms)
            sebelum sesi dimulai.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-[#F4F4F0] rounded-lg border border-neutral-200 flex flex-col justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                Printer Thermal 80mm
              </p>
              <p className="text-xs text-neutral-600 mt-1">
                Digunakan untuk cetak otomatis struk foto monokrom saat sesi selesai.
              </p>
            </div>
            <button
              type="button"
              disabled={testingThermal}
              onClick={handleTestThermal}
              className="px-4 py-2 text-xs font-semibold text-neutral-900 bg-white border border-neutral-300 hover:bg-neutral-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {testingThermal ? 'Menghubungkan Printer Thermal...' : 'Test Cetak Thermal'}
            </button>
          </div>

          <div className="p-4 bg-[#F4F4F0] rounded-lg border border-neutral-200 flex flex-col justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                Printer Warna Studio (Dye-Sub 4R)
              </p>
              <p className="text-xs text-neutral-600 mt-1">
                Digunakan untuk cetak warna kualitas tinggi berbingkai pada tahap akhir.
              </p>
            </div>
            <button
              type="button"
              disabled={testingColor}
              onClick={handleTestColor}
              className="px-4 py-2 text-xs font-semibold text-neutral-900 bg-white border border-neutral-300 hover:bg-neutral-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {testingColor ? 'Menghubungkan Printer Warna...' : 'Test Cetak Warna'}
            </button>
          </div>
        </div>

        {lastPrintResult && (
          <div
            role="status"
            className="p-3.5 rounded-lg bg-neutral-900 text-neutral-100 text-xs font-mono-tabular flex items-center justify-between"
          >
            <span>
              Status: {lastPrintResult.message} · ID: {lastPrintResult.jobId}
            </span>
            <span className="text-emerald-400">{lastPrintResult.timestamp}</span>
          </div>
        )}
      </section>
    </div>
  );
};
