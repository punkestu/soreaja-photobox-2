import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { ensureDefaultSettings } from '../../db';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    ensureDefaultSettings();
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F4F0] text-[#111111] flex flex-col">
      {/* Top Bar Contract: 3 Zones (Brand Wordmark — Nav Links — Primary Action) */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-neutral-200 sticky top-0 z-30">
        <Link
          to="/admin/welcome"
          className="font-display text-lg font-bold tracking-tight text-neutral-900 whitespace-nowrap"
        >
          SoreAja — Photobox 2
        </Link>

        <nav
          aria-label="Navigasi Utama Admin"
          className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-600"
        >
          <NavLink
            to="/admin/welcome"
            className={({ isActive }) =>
              `py-1 transition-colors whitespace-nowrap ${
                isActive
                  ? 'text-neutral-900 font-semibold border-b-2 border-[#E11D48]'
                  : 'hover:text-neutral-900'
              }`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/admin/settings"
            className={({ isActive }) =>
              `py-1 transition-colors whitespace-nowrap ${
                isActive
                  ? 'text-neutral-900 font-semibold border-b-2 border-[#E11D48]'
                  : 'hover:text-neutral-900'
              }`
            }
          >
            Pengaturan Drive & Studio
          </NavLink>
          <NavLink
            to="/admin/launch"
            className={({ isActive }) =>
              `py-1 transition-colors whitespace-nowrap ${
                isActive
                  ? 'text-neutral-900 font-semibold border-b-2 border-[#E11D48]'
                  : 'hover:text-neutral-900'
              }`
            }
          >
            Peluncuran Kiosk
          </NavLink>
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/idle')}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#E11D48] rounded-lg hover:bg-[#BE123C] transition-colors whitespace-nowrap cursor-pointer"
          >
            Buka Sesi Photobox
          </button>
        </div>
      </header>

      {/* Workspace Canvas: Sidebar + Main Content Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1440px] w-full mx-auto">
        <aside
          aria-label="Sidebar Manajemen Photobox"
          className="w-full lg:w-[260px] shrink-0 bg-[#F4F4F0] border-b lg:border-b-0 lg:border-r border-neutral-200 p-6 flex flex-col justify-between gap-6"
        >
          <div className="space-y-6">
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-3">
                Manajemen Sistem
              </p>
              <div className="flex lg:flex-col gap-1 overflow-x-auto">
                <NavLink
                  to="/admin/welcome"
                  className={({ isActive }) =>
                    `px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-700 hover:bg-neutral-200/70'
                    }`
                  }
                >
                  01. Ringkasan & Status
                </NavLink>
                <NavLink
                  to="/admin/settings"
                  className={({ isActive }) =>
                    `px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-700 hover:bg-neutral-200/70'
                    }`
                  }
                >
                  02. Konfigurasi Dexie DB
                </NavLink>
                <NavLink
                  to="/admin/launch"
                  className={({ isActive }) =>
                    `px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-700 hover:bg-neutral-200/70'
                    }`
                  }
                >
                  03. Luncurkan Kiosk
                </NavLink>
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-200/80 hidden lg:block">
              <p className="text-xs font-medium text-neutral-500 mb-2">
                Pintasan Layar Pelanggan
              </p>
              <div className="space-y-1.5 text-xs text-neutral-600">
                <Link
                  to="/app/idle"
                  className="block py-1 hover:text-neutral-900 hover:underline"
                >
                  Layar Utama (/app/idle)
                </Link>
                <Link
                  to="/app/frame-selection"
                  className="block py-1 hover:text-neutral-900 hover:underline"
                >
                  Pilih Bingkai (/app/frame-selection)
                </Link>
                <Link
                  to="/app/camera"
                  className="block py-1 hover:text-neutral-900 hover:underline"
                >
                  Kamera Studio (/app/camera)
                </Link>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-200/80 text-xs text-neutral-500 space-y-1">
            <p className="font-semibold text-neutral-800">Mode Offline Mandiri</p>
            <p>Penyimpanan lokal IndexedDB via Dexie.js aktif.</p>
          </div>
        </aside>

        <main className="flex-1 p-6 md:p-10 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
