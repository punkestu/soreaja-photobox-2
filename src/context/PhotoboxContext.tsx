import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { FrameMetadata, PhotoFilter, PhotoboxState, AppLanguage, PlacedSticker } from '../types/photobox';
import { db } from '../db';
import { DEFAULT_FRAMES } from '../data/defaultFrames';
import { TRANSLATIONS, type TranslationDictionary } from '../i18n/translations';
import { playSessionExpiredAlertSound } from '../services/shutterAudio';

interface PhotoboxContextValue extends PhotoboxState {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: TranslationDictionary;
  setSelectedFrame: (frame: FrameMetadata | null) => void;
  setCapturedPhotos: React.Dispatch<React.SetStateAction<string[]>>;
  updatePhotoAtIndex: (index: number, photoBase64: string) => void;
  setRetakeIndex: (index: number | null) => void;
  setFinalLayoutBase64: (base64: string | null) => void;
  setDoubleStripBase64: (base64: string | null) => void;
  setGifBlobUrl: (url: string | null) => void;
  setSelectedFilter: (filter: PhotoFilter) => void;
  setCustomCaption: (caption: string) => void;
  setShowFrameStamps: (show: boolean) => void;
  setPlacedStickers: React.Dispatch<React.SetStateAction<PlacedSticker[]>>;
  resetSession: () => void;
  seedDemoSession: () => void;
  // Session countdown timer properties
  sessionSecondsLeft: number;
  sessionDurationMinutes: number;
  isSessionTimerEnabled: boolean;
  isSessionExpiredAlertOpen: boolean;
  dismissSessionExpiredAlert: () => void;
  startSessionTimer: () => void;
  resetSessionTimer: () => void;
  addExtraSessionTime: (minutes?: number) => void;
}

const initialState: PhotoboxState = {
  selectedFrame: null,
  capturedPhotos: [],
  retakeIndex: null,
  finalLayoutBase64: null,
  doubleStripBase64: null,
  gifBlobUrl: null,
  selectedFilter: 'original',
  customCaption: 'SOREAJA — PHOTOBOX 2',
  showFrameStamps: true,
  placedStickers: [],
  isHydrated: false,
};

const PhotoboxContext = createContext<PhotoboxContextValue | undefined>(undefined);

export const PhotoboxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedFrame, setSelectedFrame] = useState<FrameMetadata | null>(initialState.selectedFrame);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>(initialState.capturedPhotos);
  const [retakeIndex, setRetakeIndex] = useState<number | null>(initialState.retakeIndex);
  const [finalLayoutBase64, setFinalLayoutBase64] = useState<string | null>(initialState.finalLayoutBase64);
  const [doubleStripBase64, setDoubleStripBase64] = useState<string | null>(initialState.doubleStripBase64);
  const [gifBlobUrl, setGifBlobUrl] = useState<string | null>(initialState.gifBlobUrl);
  const [selectedFilter, setSelectedFilter] = useState<PhotoFilter>(initialState.selectedFilter);
  const [customCaption, setCustomCaption] = useState<string>(initialState.customCaption);
  const [showFrameStamps, setShowFrameStamps] = useState<boolean>(initialState.showFrameStamps);
  const [placedStickers, setPlacedStickers] = useState<PlacedSticker[]>(initialState.placedStickers);
  const [language, setLanguageState] = useState<AppLanguage>('id');
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Session timer states
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(5);
  const [isSessionTimerEnabled, setIsSessionTimerEnabled] = useState<boolean>(true);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number>(300);
  const [isSessionTimerRunning, setIsSessionTimerRunning] = useState<boolean>(false);
  const [isSessionExpiredAlertOpen, setIsSessionExpiredAlertOpen] = useState<boolean>(false);

  // Set language with instant update and persistent DB write
  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
    db.settings.update('app_settings', { language: lang }).catch(() => {
      db.settings.get('app_settings').then((existing) => {
        if (existing) {
          db.settings.put({ ...existing, language: lang });
        }
      }).catch(() => {});
    });
  }, []);

  // Load saved session and settings from Dexie IndexedDB on initial mount
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      db.activeSession.get('current_active_session'),
      db.settings.get('app_settings'),
    ])
      .then(([savedSession, savedSettings]) => {
        const configuredDefaultCaption =
          savedSettings?.defaultCaption?.trim() || 'SOREAJA — PHOTOBOX 2';
        const configuredShowStamps =
          savedSettings?.showFrameStamps !== undefined
            ? savedSettings.showFrameStamps
            : true;
        const durationMinutes =
          typeof savedSettings?.sessionDurationMinutes === 'number' && savedSettings.sessionDurationMinutes > 0
            ? savedSettings.sessionDurationMinutes
            : 5;
        const timerEnabled =
          typeof savedSettings?.enableSessionTimer === 'boolean'
            ? savedSettings.enableSessionTimer
            : true;

        if (isMounted) {
          setSessionDurationMinutes(durationMinutes);
          setIsSessionTimerEnabled(timerEnabled);
          setSessionSecondsLeft(durationMinutes * 60);

          if (savedSettings?.language === 'en' || savedSettings?.language === 'id') {
            setLanguageState(savedSettings.language);
          }
        }

        if (isMounted && savedSession) {
          if (savedSession.selectedFrame) setSelectedFrame(savedSession.selectedFrame);
          if (
            savedSession.capturedPhotos &&
            Array.isArray(savedSession.capturedPhotos) &&
            savedSession.capturedPhotos.length > 0
          ) {
            setCapturedPhotos(savedSession.capturedPhotos);
          }
          if (
            typeof savedSession.retakeIndex === 'number' ||
            savedSession.retakeIndex === null
          ) {
            setRetakeIndex(savedSession.retakeIndex);
          }
          if (savedSession.finalLayoutBase64)
            setFinalLayoutBase64(savedSession.finalLayoutBase64);
          if (savedSession.doubleStripBase64)
            setDoubleStripBase64(savedSession.doubleStripBase64);
          if (savedSession.selectedFilter)
            setSelectedFilter(savedSession.selectedFilter);
          if (savedSession.customCaption) {
            setCustomCaption(savedSession.customCaption);
          } else {
            setCustomCaption(configuredDefaultCaption);
          }
          if (savedSession.showFrameStamps !== undefined) {
            setShowFrameStamps(savedSession.showFrameStamps);
          } else {
            setShowFrameStamps(configuredShowStamps);
          }
          if (savedSession.placedStickers && Array.isArray(savedSession.placedStickers)) {
            setPlacedStickers(savedSession.placedStickers);
          }
        } else if (isMounted) {
          setCustomCaption(configuredDefaultCaption);
          setShowFrameStamps(configuredShowStamps);
        }
        if (isMounted) setIsHydrated(true);
      })
      .catch((err) => {
        console.warn('Could not restore session from IndexedDB:', err);
        if (isMounted) setIsHydrated(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Save changes to Dexie IndexedDB whenever photos or session parameters update
  const saveTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isHydrated) return;

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      db.activeSession
        .put({
          id: 'current_active_session',
          selectedFrame,
          capturedPhotos,
          retakeIndex,
          finalLayoutBase64,
          doubleStripBase64,
          selectedFilter,
          customCaption,
          showFrameStamps,
          placedStickers,
          updatedAt: Date.now(),
        })
        .catch((err) => {
          console.warn('Failed to persist active session to Dexie:', err);
        });
    }, 300);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    isHydrated,
    selectedFrame,
    capturedPhotos,
    retakeIndex,
    finalLayoutBase64,
    doubleStripBase64,
    selectedFilter,
    customCaption,
    showFrameStamps,
    placedStickers,
  ]);

  // Session timer countdown interval
  useEffect(() => {
    if (!isSessionTimerRunning || !isSessionTimerEnabled) return;

    const intervalId = window.setInterval(() => {
      setSessionSecondsLeft((prev) => {
        if (prev <= 1) {
          // Play audio chime once, pause timer loop, and trigger alert modal
          playSessionExpiredAlertSound();
          setIsSessionExpiredAlertOpen(true);
          setIsSessionTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isSessionTimerRunning, isSessionTimerEnabled]);

  const startSessionTimer = useCallback(() => {
    setIsSessionTimerRunning(true);
  }, []);

  const resetSessionTimer = useCallback(() => {
    setSessionSecondsLeft(sessionDurationMinutes * 60);
    setIsSessionExpiredAlertOpen(false);
  }, [sessionDurationMinutes]);

  const addExtraSessionTime = useCallback((minutes = 2) => {
    setSessionSecondsLeft((prev) => Math.max(0, prev) + minutes * 60);
    setIsSessionExpiredAlertOpen(false);
    setIsSessionTimerRunning(true);
  }, []);

  const dismissSessionExpiredAlert = useCallback(() => {
    setIsSessionExpiredAlertOpen(false);
  }, []);

  const updatePhotoAtIndex = useCallback((index: number, photoBase64: string) => {
    setCapturedPhotos((prev) => {
      const updated = [...prev];
      updated[index] = photoBase64;
      return updated;
    });
  }, []);

  const resetSession = useCallback(() => {
    setSelectedFrame(null);
    setCapturedPhotos([]);
    setRetakeIndex(null);
    setFinalLayoutBase64(null);
    setDoubleStripBase64(null);
    setGifBlobUrl((prevUrl) => {
      if (prevUrl && prevUrl.startsWith('blob:')) {
        URL.revokeObjectURL(prevUrl);
      }
      return null;
    });
    setSelectedFilter('original');
    setPlacedStickers([]);

    // Reset session timer
    setIsSessionTimerRunning(false);
    setIsSessionExpiredAlertOpen(false);
    db.settings
      .get('app_settings')
      .then((settings) => {
        const duration =
          typeof settings?.sessionDurationMinutes === 'number' && settings.sessionDurationMinutes > 0
            ? settings.sessionDurationMinutes
            : 5;
        setSessionDurationMinutes(duration);
        setSessionSecondsLeft(duration * 60);
        setCustomCaption(settings?.defaultCaption?.trim() || 'SOREAJA — PHOTOBOX 2');
        setShowFrameStamps(settings?.showFrameStamps !== undefined ? settings.showFrameStamps : true);
      })
      .catch(() => {
        setSessionSecondsLeft(300);
        setCustomCaption('SOREAJA — PHOTOBOX 2');
        setShowFrameStamps(true);
      });

    db.activeSession.delete('current_active_session').catch(() => {});
  }, []);

  const seedDemoSession = useCallback(() => {
    if (!selectedFrame) {
      setSelectedFrame(DEFAULT_FRAMES[0]);
    }
  }, [selectedFrame]);

  const t = TRANSLATIONS[language];

  return (
    <PhotoboxContext.Provider
      value={{
        selectedFrame,
        capturedPhotos,
        retakeIndex,
        finalLayoutBase64,
        doubleStripBase64,
        gifBlobUrl,
        selectedFilter,
        customCaption,
        showFrameStamps,
        placedStickers,
        setPlacedStickers,
        isHydrated,
        language,
        setLanguage,
        t,
        setSelectedFrame,
        setCapturedPhotos,
        updatePhotoAtIndex,
        setRetakeIndex,
        setFinalLayoutBase64,
        setDoubleStripBase64,
        setGifBlobUrl,
        setSelectedFilter,
        setCustomCaption,
        setShowFrameStamps,
        resetSession,
        seedDemoSession,
        sessionSecondsLeft,
        sessionDurationMinutes,
        isSessionTimerEnabled,
        isSessionExpiredAlertOpen,
        dismissSessionExpiredAlert,
        startSessionTimer,
        resetSessionTimer,
        addExtraSessionTime,
      }}
    >
      {children}
    </PhotoboxContext.Provider>
  );
};

export const usePhotobox = (): PhotoboxContextValue => {
  const ctx = useContext(PhotoboxContext);
  if (!ctx) {
    throw new Error('usePhotobox must be used within a PhotoboxProvider');
  }
  return ctx;
};
