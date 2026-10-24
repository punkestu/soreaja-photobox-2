import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureDefaultSettings } from '../../db';
import { fetchFramesMetadata } from '../../data/defaultFrames';
import type { FrameMetadata, SessionRecord } from '../../types/photobox';
import { downloadSingleFile } from '../../services/downloadService';
import { printThermal, printColor } from '../../services/printServices';
import { usePhotobox } from '../../context/PhotoboxContext';
import { SessionDetailModal } from '../../components/admin/SessionDetailModal';
import { BrandLogo } from '../../components/common/BrandLogo';

export const AdminSessionsGallery: React.FC = () => {
  const navigate = useNavigate();
  const { language, t } = usePhotobox();

  // Data sources
  const settings = useLiveQuery(() => db.settings.get('app_settings'), []);
  const allSessions = useLiveQuery(
    () => db.sessions.orderBy('timestamp').reverse().toArray(),
    []
  );

  const [frames, setFrames] = useState<FrameMetadata[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPrint, setFilterPrint] = useState<'all' | 'unprinted' | 'thermal' | 'color'>('all');
  const [filterFrame, setFilterFrame] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'prints'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Pagination / Load More
  const [displayLimit, setDisplayLimit] = useState(24);

  // Reprint feedback & state
  const [reprintingSessionId, setReprintingSessionId] = useState<number | null>(null);
  const [reprintingType, setReprintingType] = useState<'thermal' | 'color' | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    ensureDefaultSettings();
    fetchFramesMetadata().then((data) => setFrames(data));
  }, []);

  // Compute storage and aggregate metrics
  const metrics = useMemo(() => {
    if (!allSessions || allSessions.length === 0) {
      return { total: 0, thermal: 0, color: 0, storageMb: '0.0 MB' };
    }
    let totalThermalPrints = 0;
    let totalColorPrints = 0;
    let totalBytes = 0;

    for (const s of allSessions) {
      totalThermalPrints += s.thermalPrintCount || (s.printedThermal ? 1 : 0);
      totalColorPrints += s.colorPrintCount || (s.printedColor ? 1 : 0);
      if (s.finalLayoutBase64) totalBytes += s.finalLayoutBase64.length;
      if (s.doubleStripBase64) totalBytes += s.doubleStripBase64.length;
    }

    const mb = totalBytes / (1024 * 1024);
    const storageFormatted = mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(totalBytes / 1024)} KB`;

    return {
      total: allSessions.length,
      thermal: totalThermalPrints,
      color: totalColorPrints,
      storageMb: storageFormatted,
    };
  }, [allSessions]);

  // Filtered & sorted sessions
  const filteredSessions = useMemo(() => {
    if (!allSessions) return [];
    let list = [...allSessions];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const frameNameMatch = s.frameName?.toLowerCase().includes(q);
        const frameIdMatch = s.frameId?.toLowerCase().includes(q);
        const dateStr = new Date(s.timestamp)
          .toLocaleString(language === 'en' ? 'en-US' : 'id-ID')
          .toLowerCase();
        const idMatch = String(s.id).includes(q);
        return frameNameMatch || frameIdMatch || dateStr.includes(q) || idMatch;
      });
    }

    // Filter print status
    if (filterPrint === 'unprinted') {
      list = list.filter((s) => !s.printedThermal && !s.printedColor);
    } else if (filterPrint === 'thermal') {
      list = list.filter((s) => s.printedThermal || (s.thermalPrintCount && s.thermalPrintCount > 0));
    } else if (filterPrint === 'color') {
      list = list.filter((s) => s.printedColor || (s.colorPrintCount && s.colorPrintCount > 0));
    }

    // Filter frame
    if (filterFrame !== 'all') {
      list = list.filter((s) => s.frameId === filterFrame);
    }

    // Sort
    if (sortBy === 'oldest') {
      list.sort((a, b) => a.timestamp - b.timestamp);
    } else if (sortBy === 'prints') {
      list.sort((a, b) => {
        const countA = (a.thermalPrintCount || 0) + (a.colorPrintCount || 0);
        const countB = (b.thermalPrintCount || 0) + (b.colorPrintCount || 0);
        return countB - countA;
      });
    } else {
      // newest
      list.sort((a, b) => b.timestamp - a.timestamp);
    }

    return list;
  }, [allSessions, searchQuery, filterPrint, filterFrame, sortBy, language]);

  const visibleSessions = useMemo(() => {
    return filteredSessions.slice(0, displayLimit);
  }, [filteredSessions, displayLimit]);

  // Single Delete Handler
  const handleDeleteSession = async (sessionId: number) => {
    try {
      await db.sessions.delete(sessionId);
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
      }
      setNotification(t.admin.deleteSessionSuccess);
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  // Bulk Clear Handler
  const handleClearAll = async () => {
    if (!window.confirm(t.admin.clearAllConfirm)) return;
    try {
      await db.sessions.clear();
      setSelectedSession(null);
      setNotification(t.admin.clearAllSuccess);
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error('Failed to clear sessions:', err);
    }
  };

  // Quick Reprint Handlers
  const handleReprintThermal = async (session: SessionRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!session.id || !session.finalLayoutBase64) return;
    setReprintingSessionId(session.id);
    setReprintingType('thermal');
    const targetPrinter = settings?.thermalPrinterName || settings?.printerName;
    try {
      const res = await printThermal(session.finalLayoutBase64, settings?.printApiEndpoint, targetPrinter);
      const nextCount = (session.thermalPrintCount || 0) + 1;
      await db.sessions.update(session.id, {
        printedThermal: true,
        thermalPrintCount: nextCount,
      });
      setNotification(`✅ Thermal #${session.id} (${nextCount}x · ${res.jobId})`);
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(`⚠️ Cetak Gagal: ${errMsg}`);
    } finally {
      setReprintingSessionId(null);
      setReprintingType(null);
    }
  };

  const handleReprintColor = async (session: SessionRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!session.id) return;
    const imageToPrint = session.doubleStripBase64 || session.finalLayoutBase64;
    if (!imageToPrint) return;
    setReprintingSessionId(session.id);
    setReprintingType('color');
    const targetPrinter = settings?.colorPrinterName || settings?.printerName;
    try {
      const res = await printColor(imageToPrint, settings?.printApiEndpoint, targetPrinter);
      const nextCount = (session.colorPrintCount || 0) + 1;
      await db.sessions.update(session.id, {
        printedColor: true,
        colorPrintCount: nextCount,
      });
      setNotification(`✅ Warna 4R #${session.id} (${nextCount}x · ${res.jobId})`);
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(`⚠️ Cetak Gagal: ${errMsg}`);
    } finally {
      setReprintingSessionId(null);
      setReprintingType(null);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Toast Notification */}
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

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <BrandLogo size="md" showRing={true} className="ring-neutral-200 shadow-xs" />
          <div>
            <div className="text-xs text-neutral-500 flex items-center gap-2 mb-1">
              <Link to="/admin/welcome" className="hover:underline">
                {t.admin.portalTitle}
              </Link>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-neutral-800">{t.admin.galleryTitle}</span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-neutral-900">
              {t.admin.galleryTitle}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              {t.admin.gallerySubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {allSessions && allSessions.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:text-rose-600 border border-neutral-300 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              🗑️ {t.admin.clearHistory}
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/app/idle')}
            className="min-h-[40px] px-4 py-2 text-xs font-bold text-white bg-[var(--theme-accent,#E11D48)] rounded-xl hover:bg-[var(--theme-accent-hover,#BE123C)] transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <span>🚀</span>
            <span>{t.admin.navOpenKiosk}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Bar */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-2xs">
          <p className="text-xs text-neutral-500 font-medium">{t.admin.statTotalSessions}</p>
          <p className="text-2xl font-bold font-mono-tabular text-neutral-900 mt-1">{metrics.total}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-2xs">
          <p className="text-xs text-neutral-500 font-medium">{t.admin.statThermalPrinted}</p>
          <p className="text-2xl font-bold font-mono-tabular text-emerald-600 mt-1">{metrics.thermal}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-2xs">
          <p className="text-xs text-neutral-500 font-medium">{t.admin.statColorPrinted}</p>
          <p className="text-2xl font-bold font-mono-tabular text-rose-600 mt-1">{metrics.color}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-2xs">
          <p className="text-xs text-neutral-500 font-medium">{t.admin.statStorageEstimate}</p>
          <p className="text-2xl font-bold font-mono-tabular text-neutral-700 mt-1">{metrics.storageMb}</p>
        </div>
      </section>

      {/* Toolbar: Search, Filters, Sorters & View Switcher */}
      <section className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.admin.searchPlaceholder}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-[#F4F4F0] border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent,#E11D48)]/40 focus:bg-white transition-all text-neutral-900"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Controls: Filter Print, Filter Frame, Sorter, View Mode */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Print */}
            <select
              value={filterPrint}
              onChange={(e) => setFilterPrint(e.target.value as any)}
              className="px-3 py-2 text-xs font-semibold bg-[#F4F4F0] border border-neutral-300 rounded-xl text-neutral-800 cursor-pointer focus:outline-none"
            >
              <option value="all">{t.admin.filterAll}</option>
              <option value="unprinted">{t.admin.filterUnprinted}</option>
              <option value="thermal">{t.admin.filterThermal}</option>
              <option value="color">{t.admin.filterColor}</option>
            </select>

            {/* Filter Frame */}
            <select
              value={filterFrame}
              onChange={(e) => setFilterFrame(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-[#F4F4F0] border border-neutral-300 rounded-xl text-neutral-800 cursor-pointer focus:outline-none max-w-[150px] truncate"
            >
              <option value="all">{t.admin.filterFrameAll}</option>
              {frames.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>

            {/* Sorter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 text-xs font-semibold bg-[#F4F4F0] border border-neutral-300 rounded-xl text-neutral-800 cursor-pointer focus:outline-none"
            >
              <option value="newest">{t.admin.sortNewest}</option>
              <option value="oldest">{t.admin.sortOldest}</option>
              <option value="prints">{t.admin.sortMostPrinted}</option>
            </select>

            {/* View Switcher Toggle */}
            <div className="inline-flex p-0.5 bg-neutral-100 rounded-xl border border-neutral-300">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title={t.admin.viewGrid}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                ▦
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title={t.admin.viewTable}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                ☰
              </button>
            </div>
          </div>
        </div>

        {/* Filter Summary counter */}
        <div className="flex items-center justify-between text-xs text-neutral-500 pt-1 border-t border-neutral-200/60">
          <span>
            {language === 'en'
              ? `Showing ${Math.min(visibleSessions.length, filteredSessions.length)} of ${filteredSessions.length} sessions`
              : `Menampilkan ${Math.min(visibleSessions.length, filteredSessions.length)} dari ${filteredSessions.length} sesi`}
          </span>
          {(searchQuery || filterPrint !== 'all' || filterFrame !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterPrint('all');
                setFilterFrame('all');
              }}
              className="text-xs text-neutral-700 hover:underline cursor-pointer"
            >
              {language === 'en' ? 'Reset Filters' : 'Reset Filter'}
            </button>
          )}
        </div>
      </section>

      {/* Sessions Display Area */}
      {filteredSessions.length === 0 ? (
        <div className="p-12 text-center bg-white border border-dashed border-neutral-300 rounded-2xl space-y-3">
          <p className="text-3xl">📷</p>
          <p className="text-sm font-semibold text-neutral-800">
            {allSessions && allSessions.length > 0 ? t.admin.noSessionsFound : t.admin.noSessionsYet}
          </p>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {allSessions && allSessions.length > 0
              ? language === 'en'
                ? 'Try adjusting your search query or filter selection.'
                : 'Coba ubah kata kunci pencarian atau sesuaikan opsi filter Anda.'
              : language === 'en'
              ? 'Complete a photo session in the kiosk to automatically populate this gallery.'
              : 'Selesaikan sesi photobox di kiosk untuk mengarsipkan hasil foto di galeri ini secara otomatis.'}
          </p>
          {(!allSessions || allSessions.length === 0) && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/app/idle')}
                className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                {language === 'en' ? 'Start First Session' : 'Mulai Sesi Pertama'}
              </button>
            </div>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {visibleSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setSelectedSession(session)}
              className="group bg-white border border-neutral-200 hover:border-neutral-400 rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-2xs hover:shadow-md transition-all cursor-pointer"
            >
              {/* Thumbnail Container */}
              <div className="space-y-2">
                <div className="aspect-[3/4] bg-[#1A1A1A] rounded-lg overflow-hidden flex items-center justify-center p-2 relative">
                  {session.finalLayoutBase64 ? (
                    <img
                      src={session.finalLayoutBase64}
                      alt={`Sesi #${session.id} - ${session.frameName}`}
                      loading="lazy"
                      className="max-h-full max-w-full object-contain shadow-sm group-hover:scale-[1.02] transition-transform duration-200"
                    />
                  ) : (
                    <span className="text-xs text-neutral-400 font-mono-tabular">Tidak ada gambar</span>
                  )}

                  {/* Top-Right Badge: Poses */}
                  <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-xs text-[10px] text-white px-1.5 py-0.5 rounded font-mono-tabular">
                    {session.photoCount} {t.frameSelect.poses}
                  </div>
                </div>

                {/* Session Title & Metadata */}
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-mono-tabular font-bold text-neutral-500">#{session.id}</p>
                    <p className="text-[11px] font-mono-tabular text-neutral-400">
                      {new Date(session.timestamp).toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-neutral-900 truncate mt-0.5">{session.frameName}</p>
                </div>
              </div>

              {/* Status Badges & Action Buttons */}
              <div className="space-y-2.5 pt-1 border-t border-neutral-100">
                {/* Print Status Badges */}
                <div className="flex items-center justify-between text-[11px] font-mono-tabular">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      session.printedThermal
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    🖨️ Thermal: {session.thermalPrintCount || (session.printedThermal ? 1 : 0)}x
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      session.printedColor
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    🎨 4R: {session.colorPrintCount || (session.printedColor ? 1 : 0)}x
                  </span>
                </div>

                {/* Quick Reprint & Inspect Row */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={reprintingSessionId === session.id}
                    onClick={(e) => handleReprintThermal(session, e)}
                    className="py-1.5 px-2 text-[11px] font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 active:scale-95 disabled:opacity-50 text-neutral-800 transition-all cursor-pointer flex items-center justify-center gap-1 border border-neutral-300"
                    title={language === 'en' ? 'Print 1 strip to thermal printer' : 'Cetak struk thermal 80mm'}
                  >
                    <span>🖨️</span>
                    <span>
                      {reprintingSessionId === session.id && reprintingType === 'thermal'
                        ? '...'
                        : 'Thermal'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={reprintingSessionId === session.id}
                    onClick={(e) => handleReprintColor(session, e)}
                    className="py-1.5 px-2 text-[11px] font-semibold rounded-lg bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 disabled:opacity-50 text-white transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                    title={language === 'en' ? 'Print to color printer (4R)' : 'Cetak warna studio 4R'}
                  >
                    <span>🎨</span>
                    <span>
                      {reprintingSessionId === session.id && reprintingType === 'color'
                        ? '...'
                        : 'Warna'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 font-semibold">
                  <th className="py-3 px-4 font-mono-tabular">ID</th>
                  <th className="py-3 px-4">{language === 'en' ? 'Preview' : 'Pratinjau'}</th>
                  <th className="py-3 px-4">{language === 'en' ? 'Date & Time' : 'Waktu Sesi'}</th>
                  <th className="py-3 px-4">{language === 'en' ? 'Frame Layout' : 'Layout Bingkai'}</th>
                  <th className="py-3 px-4">{language === 'en' ? 'Thermal Status' : 'Status Thermal'}</th>
                  <th className="py-3 px-4">{language === 'en' ? 'Color Status' : 'Status Warna'}</th>
                  <th className="py-3 px-4 text-right">{language === 'en' ? 'Actions' : 'Aksi'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {visibleSessions.map((session) => (
                  <tr
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className="hover:bg-neutral-50/80 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono-tabular font-bold text-neutral-900">
                      #{session.id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-10 h-14 bg-neutral-900 rounded overflow-hidden flex items-center justify-center p-0.5">
                        {session.finalLayoutBase64 ? (
                          <img
                            src={session.finalLayoutBase64}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-[9px] text-neutral-500">-</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-neutral-600 whitespace-nowrap">
                      {new Date(session.timestamp).toLocaleString(language === 'en' ? 'en-US' : 'id-ID', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="py-3 px-4 font-semibold text-neutral-900">
                      {session.frameName}{' '}
                      <span className="text-[11px] font-normal text-neutral-500">
                        ({session.photoCount} {t.frameSelect.poses})
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono-tabular ${
                          session.printedThermal
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-neutral-100 text-neutral-500'
                        }`}
                      >
                        {session.thermalPrintCount || (session.printedThermal ? 1 : 0)}x
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono-tabular ${
                          session.printedColor
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-neutral-100 text-neutral-500'
                        }`}
                      >
                        {session.colorPrintCount || (session.printedColor ? 1 : 0)}x
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedSession(session)}
                          className="px-2.5 py-1 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors cursor-pointer"
                        >
                          🔍 {language === 'en' ? 'Inspect' : 'Detail'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadSingleFile(
                              session.finalLayoutBase64,
                              `SoreAja_${session.id || session.timestamp}.png`
                            )
                          }
                          className="px-2.5 py-1 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors cursor-pointer"
                          title="Download"
                        >
                          ⬇️
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (session.id && window.confirm(t.admin.deleteSessionConfirm)) {
                              handleDeleteSession(session.id);
                            }
                          }}
                          className="px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Load More Button */}
      {filteredSessions.length > displayLimit && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => setDisplayLimit((prev) => prev + 24)}
            className="px-6 py-2.5 text-xs font-bold text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            {language === 'en'
              ? `Load More (${filteredSessions.length - displayLimit} remaining)`
              : `Muat Lebih Banyak (${filteredSessions.length - displayLimit} tersisa)`}
          </button>
        </div>
      )}

      {/* Session Detail / Lightbox Modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          settings={settings}
          onClose={() => setSelectedSession(null)}
          onDeleteSession={handleDeleteSession}
        />
      )}
    </div>
  );
};
