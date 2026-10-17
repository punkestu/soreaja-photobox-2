import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { usePhotobox } from '../../context/PhotoboxContext';
import { KIOSK_HERO_BACKDROP } from '../../data/defaultFrames';
import { BACKDROP_PRESETS } from '../../data/themeConfig';
import { SAMPLE_IDLE_STRIPS, type IdlePolaroidItem } from '../../data/sampleSessions';

export const IdleScreen: React.FC = () => {
  const navigate = useNavigate();
  const { resetSession, language, t } = usePhotobox();
  const settings = useLiveQuery(() => db.settings.get('app_settings'), []);
  const dbRecentSessions = useLiveQuery(
    () => db.sessions.orderBy('id').reverse().limit(6).toArray(),
    []
  );

  // Combine real customer sessions from Dexie with curated fallback sample strips
  const polaroidStrips: IdlePolaroidItem[] = useMemo(() => {
    const defaultTilts = [-6, 5, -4, 7, -8, 4];
    const delays = ['0s', '1.5s', '0.8s', '2.1s', '1.1s', '2.7s'];

    const realItems: IdlePolaroidItem[] = (dbRecentSessions || []).map((session, idx) => {
      const diffMs = Date.now() - session.timestamp;
      const diffMins = Math.max(1, Math.floor(diffMs / 60000));
      const timeId =
        diffMins < 2
          ? t.idle.justNow
          : diffMins < 60
          ? `${diffMins} ${t.idle.minutesAgo}`
          : `${Math.floor(diffMins / 60)} ${t.idle.hoursAgo}`;
      const timeEn =
        diffMins < 2
          ? 'Just now'
          : diffMins < 60
          ? `${diffMins}m ago`
          : `${Math.floor(diffMins / 60)}h ago`;

      const dateStr = new Date(session.timestamp).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
      });

      return {
        id: session.id || `session_${idx}`,
        image: session.finalLayoutBase64,
        frameName: session.frameName || 'Custom Frame',
        timeAgoTextId: timeId,
        timeAgoTextEn: timeEn,
        dateStr: `${dateStr} · Sesi #${session.id || idx + 1}`,
        isRealSession: true,
        tilt: defaultTilts[idx % defaultTilts.length],
        floatDelay: delays[idx % delays.length],
      };
    });

    if (realItems.length >= 6) {
      return realItems.slice(0, 6);
    }

    // Merge with sample strips to maintain 6 floating polaroids
    const needed = 6 - realItems.length;
    return [...realItems, ...SAMPLE_IDLE_STRIPS.slice(0, needed)];
  }, [dbRecentSessions, t.idle.hoursAgo, t.idle.justNow, t.idle.minutesAgo]);

  // 1-by-1 cycling spotlight index for recent session showcase
  const [activeSpotlightIdx, setActiveSpotlightIdx] = useState<number>(0);

  useEffect(() => {
    if (polaroidStrips.length === 0) return;
    const interval = setInterval(() => {
      setActiveSpotlightIdx((prev) => (prev + 1) % polaroidStrips.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [polaroidStrips.length]);

  const activeSpotlight = polaroidStrips[activeSpotlightIdx] || polaroidStrips[0];

  const handleStart = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Fullscreen may be restricted in some iframes, proceed gracefully
      }
    }
    resetSession();
    navigate('/app/frame-selection');
  };

  // Resolve background photo from custom uploaded base64, URL, preset, or default hero backdrop
  const backdropSrc = useMemo(() => {
    const customBg = settings?.kioskBackground;
    if (!customBg) return KIOSK_HERO_BACKDROP;
    const matchedPreset = BACKDROP_PRESETS.find((p) => p.id === customBg);
    if (matchedPreset) return matchedPreset.src;
    return customBg;
  }, [settings?.kioskBackground]);

  const opacityValue = (settings?.kioskBackgroundOverlayOpacity ?? 55) / 100;
  const themeColor = settings?.themeColor || '#E11D48';

  // Card position presets scattered around the viewport margins behind the hero CTA
  const cardLayoutStyles = [
    {
      // Card 0: Top Left
      className: 'top-6 left-4 sm:top-10 sm:left-8 md:top-12 md:left-12 lg:left-16',
      anim: 'animate-float-1',
    },
    {
      // Card 1: Bottom Left
      className: 'bottom-20 left-4 sm:bottom-24 sm:left-8 md:bottom-20 md:left-14 lg:left-20',
      anim: 'animate-float-2',
    },
    {
      // Card 2: Top Right
      className: 'top-6 right-4 sm:top-10 sm:right-8 md:top-12 md:right-12 lg:right-16',
      anim: 'animate-float-2',
    },
    {
      // Card 3: Bottom Right
      className: 'bottom-24 right-4 sm:bottom-28 sm:right-8 md:bottom-24 md:right-14 lg:right-20',
      anim: 'animate-float-1',
    },
    {
      // Card 4: Mid Left (Large screens)
      className: 'top-1/2 -translate-y-1/2 left-2 lg:left-6 hidden xl:block',
      anim: 'animate-float-1',
    },
    {
      // Card 5: Mid Right (Large screens)
      className: 'top-1/2 -translate-y-1/2 right-2 lg:right-6 hidden xl:block',
      anim: 'animate-float-2',
    },
  ];

  return (
    <div
      onClick={handleStart}
      role="region"
      aria-label={t.idle.touchPrompt}
      className="flex-1 w-full min-h-screen relative flex items-center justify-center overflow-hidden cursor-pointer select-none bg-[#09090B]"
    >
      {/* Editorial Studio Backdrop Image with Configurable Overlay */}
      <img
        src={backdropSrc}
        alt="Studio Photobox SoreAja"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover scale-105 transition-all duration-700"
        style={{ opacity: opacityValue }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/75 to-[#09090B]/40 pointer-events-none" />

      {/* Floating Polaroid Strip Collage in the Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
        {polaroidStrips.map((item, idx) => {
          const layout = cardLayoutStyles[idx % cardLayoutStyles.length];
          const isHighlighted = idx === activeSpotlightIdx;

          return (
            <div
              key={item.id}
              style={
                {
                  '--base-rot': `${item.tilt}deg`,
                  animationDelay: item.floatDelay,
                } as React.CSSProperties
              }
              className={`absolute ${layout.className} ${layout.anim} transition-all duration-700 pointer-events-auto ${
                isHighlighted
                  ? 'z-30 scale-105 sm:scale-110 drop-shadow-[0_25px_50px_rgba(0,0,0,0.95)]'
                  : 'z-10 opacity-70 sm:opacity-85 hover:opacity-100 hover:scale-105 drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]'
              }`}
            >
              {/* Authentic Polaroid White Paper Card Frame */}
              <div
                className={`relative w-[130px] sm:w-[155px] md:w-[175px] lg:w-[190px] bg-white p-2 pb-5 sm:pb-6 rounded-md shadow-2xl transition-all duration-300 ${
                  isHighlighted ? 'ring-3 ring-[var(--theme-accent,#E11D48)]' : 'ring-1 ring-black/10'
                }`}
              >
                {/* Frosted Translucent Tape Accent on Top */}
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-10 sm:w-12 h-4 sm:h-5 bg-white/40 backdrop-blur-sm -rotate-2 rounded-xs shadow-sm border-t border-b border-white/50" />

                {/* Photo Strip Image */}
                <div className="w-full aspect-[1/2.8] bg-zinc-900 rounded-xs overflow-hidden flex items-center justify-center">
                  <img
                    src={item.image}
                    alt={item.frameName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Handwritten-Style Card Metadata Footer */}
                <div className="mt-1.5 sm:mt-2 text-center">
                  <p className="text-[10px] sm:text-[11px] font-bold text-zinc-800 truncate px-0.5 font-display tracking-tight">
                    {item.frameName}
                  </p>
                  <p className="text-[8px] sm:text-[9px] font-mono-tabular text-zinc-500 truncate">
                    {language === 'en' ? item.timeAgoTextEn : item.timeAgoTextId}
                  </p>
                </div>

                {/* Subtle Glow Badge for Highlighted Item */}
                {isHighlighted && (
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[var(--theme-accent,#E11D48)] text-white text-[9px] font-black tracking-wider uppercase shadow-lg whitespace-nowrap animate-pulse">
                    ★ {t.idle.latestShowcase}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Foreground Kiosk Hero Content */}
      <div className="relative z-20 w-full max-w-4xl mx-auto px-6 py-8 sm:py-12 md:py-16 text-center space-y-6 sm:space-y-8 select-none">
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-xs sm:text-sm font-mono-tabular text-zinc-300 tracking-wide bg-black/40 backdrop-blur-md py-1.5 px-4 rounded-full w-fit mx-auto border border-white/10 shadow-lg">
          <span className="font-semibold text-white">{settings?.studioName || 'SoreAja Studio — Booth 02'}</span>
          <span aria-hidden="true">·</span>
          <span>{settings?.eventName || 'SoreAja Sunset Session 2026'}</span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-400 font-bold">{t.idle.offlineActive}</span>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <h1
            className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-[#F4F4F0] drop-shadow-2xl"
            style={{ textWrap: 'balance' }}
          >
            {t.appName}
          </h1>
          <p className="font-serif-editorial italic text-2xl sm:text-3xl md:text-5xl text-zinc-200 drop-shadow-md">
            {t.idle.touchSubtitle}
          </p>
        </div>

        <div className="pt-2 sm:pt-4 flex flex-col items-center gap-5">
          {/* Tablet First Commanding Primary Touch Action */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleStart();
            }}
            style={{
              backgroundColor: themeColor,
            }}
            className="min-h-[76px] sm:min-h-[86px] md:min-h-[92px] px-10 sm:px-16 md:px-20 py-5 sm:py-6 text-xl sm:text-2xl md:text-3xl font-display font-extrabold text-white rounded-3xl shadow-[0_0_60px_rgba(225,29,72,0.65)] transition-all duration-200 active:scale-95 whitespace-nowrap cursor-pointer hover:brightness-105 flex items-center gap-4 ring-2 ring-white/30 hover:scale-[1.02]"
          >
            <span className="text-2xl sm:text-3xl md:text-4xl animate-bounce">👉</span>
            <span>{t.idle.touchPrompt}</span>
          </button>

          <p className="text-xs sm:text-sm font-mono-tabular text-zinc-300 max-w-xl bg-black/30 backdrop-blur-xs px-4 py-1.5 rounded-full border border-white/5">
            {t.idle.readyBadge}
          </p>
        </div>

        {/* 1-by-1 Latest Session Spotlight Banner at Center-Bottom */}
        {activeSpotlight && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleStart();
            }}
            className="mt-6 sm:mt-8 inline-flex items-center gap-3 bg-zinc-950/85 backdrop-blur-md px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:bg-zinc-900/90 transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--theme-accent,#E11D48)]/20 border border-[var(--theme-accent,#E11D48)]/50 flex items-center justify-center text-sm">
              📸
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-[11px] sm:text-xs font-bold text-zinc-100 uppercase tracking-wider font-display">
                  {t.idle.latestShowcase}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                  {language === 'en' ? activeSpotlight.timeAgoTextEn : activeSpotlight.timeAgoTextId}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-400 font-mono-tabular truncate max-w-[200px] sm:max-w-xs">
                {activeSpotlight.frameName} · {activeSpotlight.dateStr}
              </p>
            </div>

            {/* Cycling Indicator Dots */}
            <div className="flex items-center gap-1 pl-2 border-l border-white/10">
              {polaroidStrips.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSpotlightIdx(i);
                  }}
                  className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                    i === activeSpotlightIdx
                      ? 'w-4 bg-[var(--theme-accent,#E11D48)]'
                      : 'bg-zinc-600 hover:bg-zinc-400'
                  }`}
                  aria-label={`Show session ${i + 1}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
