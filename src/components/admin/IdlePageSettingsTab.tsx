import React, { useRef } from 'react';
import { DEFAULT_IDLE_PAGE_SETTINGS } from '../../db';
import {
  IdleCtaStyle,
  IdleGradientStrength,
  IdleHeroLayout,
  IdlePageSettings,
  IdlePolaroidSource,
} from '../../types/photobox';
import { usePhotobox } from '../../context/PhotoboxContext';
import { BrandLogo } from '../common/BrandLogo';

interface IdlePageSettingsTabProps {
  idlePage: IdlePageSettings;
  setIdlePage: React.Dispatch<React.SetStateAction<IdlePageSettings>>;
  themeColor: string;
  studioName: string;
  eventName: string;
  onSyncMode: (mode: 'standard' | 'fullscreen-camera') => void;
  onResetIdleDefaults: () => void;
  onNotice?: (msg: string) => void;
}

const MAX_LOGO_DIM = 512;

export const IdlePageSettingsTab: React.FC<IdlePageSettingsTabProps> = ({
  idlePage,
  setIdlePage,
  themeColor,
  studioName,
  eventName,
  onSyncMode,
  onResetIdleDefaults,
  onNotice,
}) => {
  const { t } = usePhotobox();
  const s = t.admin.idleSettings;
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const patch = (partial: Partial<IdlePageSettings>) => {
    setIdlePage((prev) => ({ ...prev, ...partial }));
    if (partial.mode) {
      onSyncMode(partial.mode);
    }
  };

  const applyPreset = (presetKey: 'classic' | 'minimal' | 'gif' | 'mirror') => {
    let next: IdlePageSettings;
    if (presetKey === 'classic') {
      next = {
        ...DEFAULT_IDLE_PAGE_SETTINGS,
        // Preserve custom copy/logo if admin already uploaded one
        customLogoUrl: idlePage.customLogoUrl,
      };
    } else if (presetKey === 'minimal') {
      next = {
        ...DEFAULT_IDLE_PAGE_SETTINGS,
        customLogoUrl: idlePage.customLogoUrl,
        mode: 'standard',
        heroLayout: 'minimal',
        showTopPill: true,
        showCameraModeSwitch: false,
        showLogo: false,
        headlineScale: 'lg',
        ctaStyle: 'pill',
        ctaSize: 'lg',
        ctaBounceIcon: false,
        showReadyBadge: false,
        backdropFit: 'cover',
        backdropBlurPx: 2,
        backdropGradientStrength: 'medium',
        showFloatingPolaroids: false,
        showLatestSpotlight: false,
      };
    } else if (presetKey === 'gif') {
      next = {
        ...DEFAULT_IDLE_PAGE_SETTINGS,
        customLogoUrl: idlePage.customLogoUrl,
        mode: 'standard',
        heroLayout: 'editorial-left',
        showTopPill: true,
        showLogo: true,
        logoSize: 'lg',
        ctaStyle: 'glass',
        ctaSize: 'lg',
        showReadyBadge: false,
        backdropFit: 'contain',
        backdropBlurPx: 0,
        backdropGradientStrength: 'soft',
        showFloatingPolaroids: false,
        showLatestSpotlight: false,
      };
    } else {
      next = {
        ...DEFAULT_IDLE_PAGE_SETTINGS,
        customLogoUrl: idlePage.customLogoUrl,
        mode: 'fullscreen-camera',
        showCameraModeSwitch: true,
        tapAnywhereToStart: true,
      };
    }
    setIdlePage(next);
    onSyncMode(next.mode);
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isGif =
      file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (!dataUrl) return;

      // Preserve animated GIFs directly (drawing onto canvas would freeze them)
      if (isGif) {
        patch({ customLogoUrl: dataUrl, showLogo: true });
        onNotice?.('Logo GIF animasi berhasil dipasang!');
        return;
      }

      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          patch({ customLogoUrl: dataUrl, showLogo: true });
          return;
        }
        const scale = Math.min(1, MAX_LOGO_DIM / Math.max(w, h));
        const targetW = Math.max(1, Math.round(w * scale));
        const targetH = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          patch({ customLogoUrl: dataUrl, showLogo: true });
          return;
        }
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        // Preserve transparency for PNG/WebP/SVG, use WebP/PNG
        const hasAlphaCandidate =
          file.type === 'image/png' ||
          file.type === 'image/webp' ||
          file.type === 'image/svg+xml';
        const outUrl = hasAlphaCandidate
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', 0.9);
        patch({ customLogoUrl: outUrl, showLogo: true });
        onNotice?.('Logo kustom berhasil diperbarui!');
      };
      img.onerror = () => {
        patch({ customLogoUrl: dataUrl, showLogo: true });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);

    // Allow re-uploading same filename
    e.target.value = '';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-neutral-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-neutral-900">{s.title}</h2>
            <p className="text-xs text-neutral-500 mt-0.5">{s.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onResetIdleDefaults}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-xs font-semibold text-neutral-700 cursor-pointer transition-colors"
          >
            ↺ {s.resetIdleDefaultsBtn}
          </button>
        </div>

        {/* 1-Click Presets */}
        <div className="pt-2 border-t border-neutral-100 space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            {s.presetsTitle}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => applyPreset('classic')}
              className="text-left p-3 rounded-xl border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 transition-all cursor-pointer"
            >
              <div className="text-xs font-bold text-neutral-900">🏛️ {s.presetClassic}</div>
              <div className="text-[11px] text-neutral-500 mt-0.5">{s.presetClassicDesc}</div>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('minimal')}
              className="text-left p-3 rounded-xl border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 transition-all cursor-pointer"
            >
              <div className="text-xs font-bold text-neutral-900">✨ {s.presetMinimal}</div>
              <div className="text-[11px] text-neutral-500 mt-0.5">{s.presetMinimalDesc}</div>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('gif')}
              className="text-left p-3 rounded-xl border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 transition-all cursor-pointer"
            >
              <div className="text-xs font-bold text-neutral-900">🎞️ {s.presetGif}</div>
              <div className="text-[11px] text-neutral-500 mt-0.5">{s.presetGifDesc}</div>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('mirror')}
              className="text-left p-3 rounded-xl border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 transition-all cursor-pointer"
            >
              <div className="text-xs font-bold text-neutral-900">🪞 {s.presetMirror}</div>
              <div className="text-[11px] text-neutral-500 mt-0.5">{s.presetMirrorDesc}</div>
            </button>
          </div>
        </div>
      </div>

      {/* Section 1: Mode & Hero Layout */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-neutral-200 shadow-xs space-y-5">
        <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
          <span>📐</span> {s.sectionModeLayout}
        </h3>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-neutral-700 block">{s.modeLabel}</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(
              [
                { id: 'standard', label: s.modeStandard, icon: '🖼️' },
                { id: 'fullscreen-camera', label: s.modeFullscreen, icon: '🎥' },
              ] as const
            ).map((opt) => {
              const active = idlePage.mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patch({ mode: opt.id })}
                  style={active ? { borderColor: themeColor } : {}}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left text-xs font-semibold cursor-pointer transition-all ${
                    active
                      ? 'bg-neutral-50 text-neutral-900 shadow-xs'
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {idlePage.mode === 'standard' ? (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-700 block">
              {s.heroLayoutLabel}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'centered', label: s.layoutCentered },
                  { id: 'editorial-left', label: s.layoutEditorialLeft },
                  { id: 'minimal', label: s.layoutMinimal },
                ] as { id: IdleHeroLayout; label: string }[]
              ).map((opt) => {
                const active = idlePage.heroLayout === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patch({ heroLayout: opt.id })}
                    style={active ? { borderColor: themeColor, color: themeColor } : {}}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      active
                        ? 'bg-neutral-50 shadow-xs'
                        : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-700 block">
              {s.fullscreenPromptLabel}
            </label>
            <input
              type="text"
              value={idlePage.fullscreenCameraPrompt}
              onChange={(e) => patch({ fullscreenCameraPrompt: e.target.value })}
              placeholder={s.fullscreenPromptPlaceholder}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/15"
            />
          </div>
        )}

        <label className="flex items-center justify-between gap-3 pt-1 cursor-pointer select-none">
          <span className="text-xs font-medium text-neutral-700">{s.showCameraSwitchLabel}</span>
          <input
            type="checkbox"
            checked={idlePage.showCameraModeSwitch}
            onChange={(e) => patch({ showCameraModeSwitch: e.target.checked })}
            className="w-4 h-4 accent-neutral-900 rounded cursor-pointer"
          />
        </label>
      </div>

      {/* Section 2: Branding, Logo & Copy */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-neutral-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
          <span>🏷️</span> {s.sectionBrandingCopy}
        </h3>

        {/* Top Pill */}
        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-2.5">
          <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
            <span className="text-xs font-semibold text-neutral-800">{s.showTopPillLabel}</span>
            <input
              type="checkbox"
              checked={idlePage.showTopPill}
              onChange={(e) => patch({ showTopPill: e.target.checked })}
              className="w-4 h-4 accent-neutral-900 rounded cursor-pointer"
            />
          </label>
          {idlePage.showTopPill && (
            <div>
              <label className="text-[11px] font-medium text-neutral-500 block mb-1">
                {s.topPillTextLabel}
              </label>
              <input
                type="text"
                value={idlePage.topPillText}
                onChange={(e) => patch({ topPillText: e.target.value })}
                placeholder={`${studioName || 'SoreAja Studio'} · ${eventName || 'Event 2026'}`}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900/15"
              />
            </div>
          )}
        </div>

        {/* Brand Logo Upload & Size */}
        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-3">
          <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
            <span className="text-xs font-semibold text-neutral-800">{s.showLogoLabel}</span>
            <input
              type="checkbox"
              checked={idlePage.showLogo}
              onChange={(e) => patch({ showLogo: e.target.checked })}
              className="w-4 h-4 accent-neutral-900 rounded cursor-pointer"
            />
          </label>

          {idlePage.showLogo && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-700 shrink-0 overflow-hidden p-2">
                <BrandLogo
                  src={idlePage.customLogoUrl || undefined}
                  size="sm"
                  showRing={false}
                />
              </div>
              <div className="flex-1 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold cursor-pointer transition-colors"
                  >
                    📤 {s.uploadLogoBtn}
                  </button>
                  {idlePage.customLogoUrl && (
                    <button
                      type="button"
                      onClick={() => patch({ customLogoUrl: '' })}
                      className="px-3 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {s.resetLogoBtn}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-neutral-600">{s.logoSizeLabel}:</span>
                  {(['md', 'lg', 'xl', '2xl'] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => patch({ logoSize: sz })}
                      style={
                        idlePage.logoSize === sz
                          ? { backgroundColor: themeColor, color: '#fff', borderColor: themeColor }
                          : {}
                      }
                      className={`px-2.5 py-1 rounded-md border text-[11px] font-bold uppercase cursor-pointer transition-all ${
                        idlePage.logoSize === sz
                          ? ''
                          : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Headline & Subtitle */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-neutral-700 block mb-1">
              {s.headlineLabel}
            </label>
            <input
              type="text"
              value={idlePage.headlineText}
              onChange={(e) => patch({ headlineText: e.target.value })}
              placeholder={t.appName}
              className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/15"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">
              {s.headlineScaleLabel}
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['md', 'lg', 'xl'] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => patch({ headlineScale: sc })}
                  style={
                    idlePage.headlineScale === sc
                      ? { backgroundColor: themeColor, color: '#fff', borderColor: themeColor }
                      : {}
                  }
                  className={`py-2 rounded-lg border text-xs font-bold uppercase cursor-pointer transition-all ${
                    idlePage.headlineScale === sc
                      ? ''
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  {sc}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-700 block mb-1">
            {s.subtitleLabel}
          </label>
          <input
            type="text"
            value={idlePage.subtitleText}
            onChange={(e) => patch({ subtitleText: e.target.value })}
            placeholder={t.idle.touchSubtitle}
            className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/15"
          />
        </div>

        {/* Bottom Ready Badge */}
        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-2.5">
          <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
            <span className="text-xs font-semibold text-neutral-800">{s.showReadyBadgeLabel}</span>
            <input
              type="checkbox"
              checked={idlePage.showReadyBadge}
              onChange={(e) => patch({ showReadyBadge: e.target.checked })}
              className="w-4 h-4 accent-neutral-900 rounded cursor-pointer"
            />
          </label>
          {idlePage.showReadyBadge && (
            <div>
              <label className="text-[11px] font-medium text-neutral-500 block mb-1">
                {s.readyBadgeLabel}
              </label>
              <input
                type="text"
                value={idlePage.readyBadgeText}
                onChange={(e) => patch({ readyBadgeText: e.target.value })}
                placeholder={t.idle.readyBadge}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900/15"
              />
            </div>
          )}
        </div>
      </div>

      {/* Section 3: CTA Button */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-neutral-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
          <span>🔘</span> {s.sectionCta}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-3">
            <label className="text-xs font-semibold text-neutral-700 block mb-1">
              {s.ctaTextLabel}
            </label>
            <input
              type="text"
              value={idlePage.ctaText}
              onChange={(e) => patch({ ctaText: e.target.value })}
              placeholder={t.idle.touchPrompt}
              className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/15"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">
              {s.ctaEmojiLabel}
            </label>
            <input
              type="text"
              value={idlePage.ctaEmoji}
              onChange={(e) => patch({ ctaEmoji: e.target.value })}
              placeholder="👆"
              className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900/15"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
              {s.ctaStyleLabel}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['solid', 'pill', 'glass', 'outline'] as IdleCtaStyle[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => patch({ ctaStyle: st })}
                  style={
                    idlePage.ctaStyle === st
                      ? { backgroundColor: themeColor, color: '#fff', borderColor: themeColor }
                      : {}
                  }
                  className={`py-2 rounded-lg border text-xs font-semibold capitalize cursor-pointer transition-all ${
                    idlePage.ctaStyle === st
                      ? ''
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
              {s.ctaSizeLabel}
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['md', 'lg', 'xl'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => patch({ ctaSize: sz })}
                  style={
                    idlePage.ctaSize === sz
                      ? { backgroundColor: themeColor, color: '#fff', borderColor: themeColor }
                      : {}
                  }
                  className={`py-2 rounded-lg border text-xs font-bold uppercase cursor-pointer transition-all ${
                    idlePage.ctaSize === sz
                      ? ''
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 pt-1 cursor-pointer select-none">
          <span className="text-xs font-medium text-neutral-700">{s.ctaBounceLabel}</span>
          <input
            type="checkbox"
            checked={idlePage.ctaBounceIcon}
            onChange={(e) => patch({ ctaBounceIcon: e.target.checked })}
            className="w-4 h-4 accent-neutral-900 rounded cursor-pointer"
          />
        </label>
      </div>

      {/* Section 4: Atmosphere & Polaroids */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-neutral-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
          <span>🌌</span> {s.sectionAtmosphere}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
              {s.backdropFitLabel}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'cover', label: s.fitCover },
                  { id: 'contain', label: s.fitContain },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patch({ backdropFit: opt.id })}
                  style={
                    idlePage.backdropFit === opt.id
                      ? { backgroundColor: themeColor, color: '#fff', borderColor: themeColor }
                      : {}
                  }
                  className={`py-2 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                    idlePage.backdropFit === opt.id
                      ? ''
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-700">
                {s.backdropBlurLabel}
              </label>
              <span className="text-xs font-mono-tabular font-bold text-neutral-800">
                {idlePage.backdropBlurPx}px
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={16}
              step={1}
              value={idlePage.backdropBlurPx}
              onChange={(e) => patch({ backdropBlurPx: Number(e.target.value) })}
              className="w-full accent-neutral-900 cursor-pointer"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
            {s.gradientStrengthLabel}
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                { id: 'none', label: s.gradNone },
                { id: 'soft', label: s.gradSoft },
                { id: 'medium', label: s.gradMedium },
                { id: 'dark', label: s.gradDark },
              ] as { id: IdleGradientStrength; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => patch({ backdropGradientStrength: opt.id })}
                style={
                  idlePage.backdropGradientStrength === opt.id
                    ? { backgroundColor: themeColor, color: '#fff', borderColor: themeColor }
                    : {}
                }
                className={`py-2 px-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                  idlePage.backdropGradientStrength === opt.id
                    ? ''
                    : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Floating Polaroids */}
        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-3">
          <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
            <span className="text-xs font-semibold text-neutral-800">{s.showPolaroidsLabel}</span>
            <input
              type="checkbox"
              checked={idlePage.showFloatingPolaroids}
              onChange={(e) => patch({ showFloatingPolaroids: e.target.checked })}
              className="w-4 h-4 accent-neutral-900 rounded cursor-pointer"
            />
          </label>

          {idlePage.showFloatingPolaroids && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-neutral-600 block mb-1">
                    {s.polaroidCountLabel}
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([0, 2, 4, 6] as const).map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => patch({ floatingPolaroidCount: cnt })}
                        style={
                          idlePage.floatingPolaroidCount === cnt
                            ? { backgroundColor: themeColor, color: '#fff', borderColor: themeColor }
                            : {}
                        }
                        className={`py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                          idlePage.floatingPolaroidCount === cnt
                            ? ''
                            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-neutral-600 block mb-1">
                    {s.polaroidSourceLabel}
                  </label>
                  <select
                    value={idlePage.floatingPolaroidSource}
                    onChange={(e) =>
                      patch({ floatingPolaroidSource: e.target.value as IdlePolaroidSource })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-semibold text-neutral-800 focus:outline-none"
                  >
                    <option value="mixed">{s.sourceMixed}</option>
                    <option value="real-only">{s.sourceReal}</option>
                    <option value="samples-only">{s.sourceSamples}</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                <span className="text-xs font-medium text-neutral-700">{s.floatAnimLabel}</span>
                <input
                  type="checkbox"
                  checked={idlePage.enableFloatAnimation}
                  onChange={(e) => patch({ enableFloatAnimation: e.target.checked })}
                  className="w-4 h-4 accent-neutral-900 rounded cursor-pointer"
                />
              </label>
            </div>
          )}
        </div>

        {/* Spotlight Banner */}
        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-2.5">
          <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
            <span className="text-xs font-semibold text-neutral-800">{s.showSpotlightLabel}</span>
            <input
              type="checkbox"
              checked={idlePage.showLatestSpotlight}
              onChange={(e) => patch({ showLatestSpotlight: e.target.checked })}
              className="w-4 h-4 accent-neutral-900 rounded cursor-pointer"
            />
          </label>
          {idlePage.showLatestSpotlight && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-neutral-600">
                  {s.spotlightIntervalLabel}
                </label>
                <span className="text-xs font-mono-tabular font-bold text-neutral-800">
                  {idlePage.spotlightIntervalSeconds}s
                </span>
              </div>
              <input
                type="range"
                min={3}
                max={15}
                step={1}
                value={idlePage.spotlightIntervalSeconds}
                onChange={(e) => patch({ spotlightIntervalSeconds: Number(e.target.value) })}
                className="w-full accent-neutral-900 cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>

      {/* Section 5: Interaction Behavior */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-neutral-200 shadow-xs space-y-3.5">
        <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
          <span>⚙️</span> {s.sectionBehavior}
        </h3>

        <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
          <span className="text-xs font-medium text-neutral-700">{s.tapAnywhereLabel}</span>
          <input
            type="checkbox"
            checked={idlePage.tapAnywhereToStart}
            onChange={(e) => patch({ tapAnywhereToStart: e.target.checked })}
            className="w-4 h-4 accent-neutral-900 rounded cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
          <span className="text-xs font-medium text-neutral-700">{s.autoFullscreenLabel}</span>
          <input
            type="checkbox"
            checked={idlePage.autoFullscreenOnStart}
            onChange={(e) => patch({ autoFullscreenOnStart: e.target.checked })}
            className="w-4 h-4 accent-neutral-900 rounded cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
};
