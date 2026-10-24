import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { printThermal, printColor, type PrintJobResult } from '../../services/printServices';
import { usePhotobox } from '../../context/PhotoboxContext';

export const AdminLaunch: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = usePhotobox();
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
        <div className="text-xs text-neutral-500 flex items-center gap-2 mb-2 font-mono-tabular">
          <span>{t.admin.launchCustomerMode}</span>
          <span aria-hidden="true">·</span>
          <span>{t.admin.launchTargetRoute}</span>
          <span aria-hidden="true">·</span>
          <span>{t.admin.launchFullscreenBadge}</span>
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-neutral-900">
          {t.admin.launchTitle}
        </h1>
        <p className="text-sm text-neutral-600 mt-1">
          {t.admin.launchSubtitle}
        </p>
      </div>

      {/* Primary Launch Card */}
      <section className="bg-neutral-900 text-white rounded-xl p-8 border border-neutral-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <p className="text-xs font-mono-tabular text-neutral-400">
            KIOSK DISPLAY · 100% OFFLINE READY
          </p>
          <h2 className="font-display text-2xl font-bold">
            {t.admin.launchReadyTitle}
          </h2>
          <p className="text-sm text-neutral-300 leading-relaxed">
            {t.admin.launchReadyDesc}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0 w-full md:w-auto">
          <button
            type="button"
            onClick={() => handleLaunchKiosk(true)}
            className="min-h-[50px] px-7 py-3 text-sm font-bold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 rounded-xl transition-all whitespace-nowrap text-center cursor-pointer shadow-md flex items-center justify-center gap-2"
          >
            <span>🖥️</span>
            <span>{t.admin.launchFullscreenBtn}</span>
          </button>
          <Link
            to="/app/idle"
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[46px] px-6 py-2.5 text-xs sm:text-sm font-semibold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 active:scale-95 rounded-xl transition-all whitespace-nowrap text-center flex items-center justify-center gap-2"
          >
            <span>↗</span>
            <span>{t.admin.launchNewTabBtn}</span>
          </Link>
        </div>
      </section>
    </div>
  );
};
