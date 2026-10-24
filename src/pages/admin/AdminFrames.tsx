import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchFramesMetadata } from '../../data/defaultFrames';
import type { FrameMetadata } from '../../types/photobox';
import { usePhotobox } from '../../context/PhotoboxContext';
import { FrameDetailModal } from '../../components/admin/FrameDetailModal';
import { BrandLogo } from '../../components/common/BrandLogo';

export const AdminFrames: React.FC = () => {
  const navigate = useNavigate();
  const { language, t } = usePhotobox();

  const [frames, setFrames] = useState<FrameMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFrame, setSelectedFrame] = useState<FrameMetadata | null>(null);

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFormat, setFilterFormat] = useState<'all' | 'single' | 'double'>('all');
  const [filterPoses, setFilterPoses] = useState<'all' | string>('all');
  const [filterTheme, setFilterTheme] = useState<'all' | string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  useEffect(() => {
    fetchFramesMetadata().then((data) => {
      setFrames(data);
      setLoading(false);
    });
  }, []);

  const isDoubleWidth = (frame: FrameMetadata) => {
    const w = frame.canvasWidth || 500;
    const h = frame.canvasHeight || 1220;
    return w / h > 0.65;
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = frames.length;
    const single = frames.filter((f) => !isDoubleWidth(f)).length;
    const double = frames.filter((f) => isDoubleWidth(f)).length;
    const uniquePoses = Array.from(new Set(frames.map((f) => f.photoCount))).sort((a, b) => a - b);

    return {
      total,
      single,
      double,
      posesStr: uniquePoses.map((p) => `${p} Pose`).join(', ') || '3 Pose',
    };
  }, [frames]);

  // Unique pose counts for filter dropdown
  const availablePoseCounts = useMemo(() => {
    return Array.from(new Set(frames.map((f) => f.photoCount))).sort((a, b) => a - b);
  }, [frames]);

  // Filtered & sorted frames
  const filteredFrames = useMemo(() => {
    let list = [...frames];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((f) => {
        const nameMatch = f.name?.toLowerCase().includes(q);
        const subMatch = f.subtitle?.toLowerCase().includes(q);
        const idMatch = f.id?.toLowerCase().includes(q);
        const themeMatch = f.theme?.toLowerCase().includes(q);
        return nameMatch || subMatch || idMatch || themeMatch;
      });
    }

    // Filter format
    if (filterFormat === 'single') {
      list = list.filter((f) => !isDoubleWidth(f));
    } else if (filterFormat === 'double') {
      list = list.filter((f) => isDoubleWidth(f));
    }

    // Filter poses
    if (filterPoses !== 'all') {
      const count = Number(filterPoses);
      list = list.filter((f) => f.photoCount === count);
    }

    // Filter theme
    if (filterTheme !== 'all') {
      list = list.filter((f) => (f.theme || 'light') === filterTheme);
    }

    return list;
  }, [frames, searchQuery, filterFormat, filterPoses, filterTheme]);

  return (
    <div className="space-y-8 max-w-6xl">
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
              <span className="font-semibold text-neutral-800">{t.admin.framesCatalogTitle}</span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-neutral-900">
              {t.admin.framesCatalogTitle}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              {t.admin.framesCatalogSubtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/app/frame-selection')}
          className="min-h-[40px] px-4 py-2 text-xs font-bold text-white bg-[var(--theme-accent,#E11D48)] rounded-xl hover:bg-[var(--theme-accent-hover,#BE123C)] transition-all cursor-pointer shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>📸</span>
          <span>{t.admin.testInKiosk}</span>
        </button>
      </div>

      {/* Metric Cards Bar */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-2xs">
          <p className="text-xs text-neutral-500 font-medium">{t.admin.statTotalFrames}</p>
          <p className="text-2xl font-bold font-mono-tabular text-neutral-900 mt-1">{metrics.total}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-2xs">
          <p className="text-xs text-neutral-500 font-medium">{t.admin.statSingleStrip}</p>
          <p className="text-2xl font-bold font-mono-tabular text-sky-600 mt-1">{metrics.single}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-2xs">
          <p className="text-xs text-neutral-500 font-medium">{t.admin.statDoubleStrip}</p>
          <p className="text-2xl font-bold font-mono-tabular text-amber-600 mt-1">{metrics.double}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-2xs">
          <p className="text-xs text-neutral-500 font-medium">{t.admin.statPoseVariants}</p>
          <p className="text-lg font-bold font-mono-tabular text-neutral-800 mt-1 truncate" title={metrics.posesStr}>
            {metrics.posesStr}
          </p>
        </div>
      </section>

      {/* Toolbar: Search, Filters & View Switcher */}
      <section className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.admin.searchFramesPlaceholder}
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

          {/* Controls: Filter Format, Filter Poses, Filter Theme, View Mode */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Format */}
            <select
              value={filterFormat}
              onChange={(e) => setFilterFormat(e.target.value as any)}
              className="px-3 py-2 text-xs font-semibold bg-[#F4F4F0] border border-neutral-300 rounded-xl text-neutral-800 cursor-pointer focus:outline-none"
            >
              <option value="all">{t.admin.filterFormatAll}</option>
              <option value="single">{t.admin.filterFormatSingle}</option>
              <option value="double">{t.admin.filterFormatDouble}</option>
            </select>

            {/* Filter Poses */}
            <select
              value={filterPoses}
              onChange={(e) => setFilterPoses(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-[#F4F4F0] border border-neutral-300 rounded-xl text-neutral-800 cursor-pointer focus:outline-none"
            >
              <option value="all">{t.admin.filterPosesAll}</option>
              {availablePoseCounts.map((p) => (
                <option key={p} value={String(p)}>
                  {p} {t.frameSelect.poses}
                </option>
              ))}
            </select>

            {/* Filter Theme */}
            <select
              value={filterTheme}
              onChange={(e) => setFilterTheme(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-[#F4F4F0] border border-neutral-300 rounded-xl text-neutral-800 cursor-pointer focus:outline-none"
            >
              <option value="all">{t.admin.filterThemeAll}</option>
              <option value="light">{t.admin.filterThemeLight}</option>
              <option value="dark">{t.admin.filterThemeDark}</option>
              <option value="warm">{t.admin.filterThemeWarm}</option>
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

        {/* Counter Summary */}
        <div className="flex items-center justify-between text-xs text-neutral-500 pt-1 border-t border-neutral-200/60">
          <span>
            {language === 'en'
              ? `Showing ${filteredFrames.length} of ${frames.length} frames`
              : `Menampilkan ${filteredFrames.length} dari ${frames.length} bingkai`}
          </span>
          {(searchQuery || filterFormat !== 'all' || filterPoses !== 'all' || filterTheme !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterFormat('all');
                setFilterPoses('all');
                setFilterTheme('all');
              }}
              className="text-xs text-neutral-700 hover:underline cursor-pointer"
            >
              {language === 'en' ? 'Reset Filters' : 'Reset Filter'}
            </button>
          )}
        </div>
      </section>

      {/* Frame Catalog View */}
      {loading ? (
        <div className="py-16 text-center text-xs text-neutral-500 font-mono-tabular">
          Memuat katalog bingkai...
        </div>
      ) : filteredFrames.length === 0 ? (
        <div className="p-12 text-center bg-white border border-dashed border-neutral-300 rounded-2xl space-y-3">
          <p className="text-3xl">🖼️</p>
          <p className="text-sm font-semibold text-neutral-800">{t.admin.noFramesFound}</p>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {language === 'en'
              ? 'Try adjusting your search terms or filter selection.'
              : 'Coba ubah kata kunci pencarian atau sesuaikan opsi filter Anda.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* VISUAL GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredFrames.map((frame) => {
            const isDouble = isDoubleWidth(frame);
            const firstPos = frame.positions[0];

            return (
              <div
                key={frame.id}
                onClick={() => setSelectedFrame(frame)}
                className="group bg-white border border-neutral-200 hover:border-neutral-400 rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-2xs hover:shadow-md transition-all cursor-pointer"
              >
                <div className="space-y-2.5">
                  {/* Artwork Preview Box */}
                  <div className="aspect-[3/4] bg-[#121214] rounded-lg overflow-hidden flex items-center justify-center p-2 relative">
                    {frame.previewImg || frame.frameImg ? (
                      <img
                        src={frame.previewImg || frame.frameImg}
                        alt={frame.name}
                        loading="lazy"
                        className="max-h-full max-w-full object-contain shadow-sm group-hover:scale-[1.03] transition-transform duration-200"
                      />
                    ) : (
                      <span className="text-xs text-neutral-500">No preview</span>
                    )}

                    {/* Top Badges */}
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded shadow-2xs ${
                          isDouble
                            ? 'text-amber-900 bg-amber-300/90'
                            : 'text-sky-900 bg-sky-200/90'
                        }`}
                      >
                        {isDouble ? '👥 4R' : '📱 Strip'}
                      </span>
                    </div>

                    <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-xs text-[10px] text-white px-1.5 py-0.5 rounded font-mono-tabular">
                      {frame.photoCount} {t.frameSelect.poses}
                    </div>
                  </div>

                  {/* Frame Metadata Title */}
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono-tabular text-[11px] font-bold text-neutral-500">
                        {frame.id}
                      </span>
                      <span className="text-[10px] font-mono capitalize text-neutral-400">
                        {frame.theme || 'Light'}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-neutral-900 truncate mt-0.5">{frame.name}</p>
                    {frame.subtitle && (
                      <p className="text-xs text-neutral-500 truncate mt-0.5">{frame.subtitle}</p>
                    )}
                  </div>
                </div>

                {/* Technical Specs Footer */}
                <div className="pt-2 border-t border-neutral-100 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono-tabular text-neutral-500">
                    <span>{frame.canvasWidth || 500} × {frame.canvasHeight || 1220} px</span>
                    <span>
                      {firstPos ? `${firstPos.width}×${firstPos.height}` : '-'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFrame(frame);
                      }}
                      className="py-1.5 px-2 text-[11px] font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-800 transition-all cursor-pointer flex items-center justify-center gap-1 border border-neutral-300"
                    >
                      <span>🔍</span>
                      <span>{language === 'en' ? 'Slots' : 'Slot'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/app/frame-selection');
                      }}
                      className="py-1.5 px-2 text-[11px] font-semibold rounded-lg bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 text-white transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                    >
                      <span>📸</span>
                      <span>{language === 'en' ? 'Test' : 'Uji'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TECHNICAL SPECIFICATION TABLE VIEW */
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 font-semibold">
                  <th className="py-3 px-4 font-mono-tabular">{t.admin.frameIdLabel}</th>
                  <th className="py-3 px-4">{language === 'en' ? 'Preview' : 'Pratinjau'}</th>
                  <th className="py-3 px-4">{t.admin.frameNameLabel}</th>
                  <th className="py-3 px-4">Format</th>
                  <th className="py-3 px-4">Tema</th>
                  <th className="py-3 px-4 text-right">{t.admin.frameSlotsCount}</th>
                  <th className="py-3 px-4 text-right">{t.admin.frameCanvasSize}</th>
                  <th className="py-3 px-4">{t.admin.frameSlotCoordinates} #1</th>
                  <th className="py-3 px-4 text-right">{language === 'en' ? 'Actions' : 'Aksi'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredFrames.map((frame) => {
                  const isDouble = isDoubleWidth(frame);
                  const firstPos = frame.positions[0];

                  return (
                    <tr
                      key={frame.id}
                      onClick={() => setSelectedFrame(frame)}
                      className="hover:bg-neutral-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono-tabular font-bold text-neutral-900">
                        {frame.id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-9 h-14 bg-neutral-900 rounded overflow-hidden flex items-center justify-center p-0.5">
                          {frame.previewImg || frame.frameImg ? (
                            <img
                              src={frame.previewImg || frame.frameImg}
                              alt=""
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <span className="text-[9px] text-neutral-500">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-neutral-900">
                        {frame.name}
                        {frame.subtitle && (
                          <span className="block text-[11px] font-normal text-neutral-500">
                            {frame.subtitle}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            isDouble
                              ? 'text-amber-800 bg-amber-100'
                              : 'text-sky-800 bg-sky-100'
                          }`}
                        >
                          {isDouble ? '👥 Double 4R' : '📱 Single'}
                        </span>
                      </td>
                      <td className="py-3 px-4 capitalize font-mono-tabular text-neutral-600">
                        {frame.theme || 'light'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-neutral-900">
                        {frame.photoCount} {t.frameSelect.poses}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-neutral-600">
                        {frame.canvasWidth || 500} × {frame.canvasHeight || 1220} px
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-neutral-600">
                        {firstPos
                          ? `x:${firstPos.x}, y:${firstPos.y} (${firstPos.width}×${firstPos.height})`
                          : '-'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedFrame(frame)}
                            className="px-2.5 py-1 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors cursor-pointer"
                          >
                            🔍 {language === 'en' ? 'Slots' : 'Detail'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Frame Detail & Slot Inspection Modal */}
      {selectedFrame && (
        <FrameDetailModal
          frame={selectedFrame}
          onClose={() => setSelectedFrame(null)}
        />
      )}
    </div>
  );
};
