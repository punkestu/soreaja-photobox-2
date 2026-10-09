import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { FrameMetadata, PhotoFilter, PhotoboxState } from '../types/photobox';
import { db } from '../db';
import { DEFAULT_FRAMES } from '../data/defaultFrames';

interface PhotoboxContextValue extends PhotoboxState {
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
  resetSession: () => void;
  seedDemoSession: () => void;
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
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

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
      if (capturedPhotos.length === 0 && !selectedFrame && !finalLayoutBase64 && !doubleStripBase64) {
        // Empty state
        db.activeSession.delete('current_active_session').catch(() => {});
      } else {
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
            updatedAt: Date.now(),
          })
          .catch((err) => {
            console.warn('Could not save session to IndexedDB:', err);
          });
      }
    }, 150);

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
  ]);

  const updatePhotoAtIndex = useCallback((index: number, photoBase64: string) => {
    setCapturedPhotos((prev) => {
      const next = [...prev];
      next[index] = photoBase64;
      return next;
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

    // Restore configured default caption & stamp settings from local settings
    db.settings
      .get('app_settings')
      .then((settings) => {
        setCustomCaption(settings?.defaultCaption?.trim() || 'SOREAJA — PHOTOBOX 2');
        setShowFrameStamps(settings?.showFrameStamps !== undefined ? settings.showFrameStamps : true);
      })
      .catch(() => {
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
        isHydrated,
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
