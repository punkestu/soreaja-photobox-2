import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { usePhotobox } from '../../context/PhotoboxContext';

const STEPS = [
  { path: '/app/idle', label: '01. Mulai' },
  { path: '/app/frame-selection', label: '02. Bingkai' },
  { path: '/app/camera', label: '03. Kamera' },
  { path: '/app/review-photos', label: '04. Evaluasi' },
  { path: '/app/preview-final', label: '05. Hasil Frame' },
  { path: '/app/print-result', label: '06. Cetak & QR' },
];

export const KioskLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { resetSession } = usePhotobox();

  const handleRestart = () => {
    resetSession();
    navigate('/app/idle');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#F4F4F0] flex flex-col">
      {/* Top Bar Contract: 3 Zones (Brand Wordmark — Step Nav — Primary Action) */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#0A0A0B]/95 border-b border-zinc-800 sticky top-0 z-30">
        <Link
          to="/app/idle"
          className="font-display text-lg font-bold tracking-tight text-[#F4F4F0] whitespace-nowrap"
        >
          SoreAja — Photobox
        </Link>

        <nav
          aria-label="Tahapan Sesi Photobox"
          className="hidden lg:flex items-center gap-6 text-xs font-mono-tabular"
        >
          {STEPS.slice(0, 5).map((step) => {
            const isCurrent = location.pathname === step.path;
            return (
              <span
                key={step.path}
                className={`whitespace-nowrap transition-colors ${
                  isCurrent
                    ? 'text-[#F4F4F0] font-semibold border-b-2 border-[#E11D48] pb-0.5'
                    : 'text-zinc-500'
                }`}
              >
                {step.label}
              </span>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {location.pathname !== '/app/idle' && (
            <button
              type="button"
              onClick={handleRestart}
              className="px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Ulangi Sesi
            </button>
          )}
          <Link
            to="/admin/welcome"
            className="px-3.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors whitespace-nowrap"
          >
            Panel Admin
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
};
