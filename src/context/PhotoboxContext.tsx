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
  setGifBlobUrl: (url: string | null) => void;
  setSelectedFilter: (filter: PhotoFilter) => void;
  setCustomCaption: (caption: string) => void;
  resetSession: () => void;
  seedDemoSession: () => void;
}

const initialState: PhotoboxState = {
  selectedFrame: null,
  capturedPhotos: [],
  retakeIndex: null,
  finalLayoutBase64: null,
  gifBlobUrl: null,
  selectedFilter: 'original',
  customCaption: 'SOREAJA — PHOTOBOX 2',
  isHydrated: false,
};

const PhotoboxContext = createContext<PhotoboxContextValue | undefined>(undefined);

export const PhotoboxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedFrame, setSelectedFrame] = useState<FrameMetadata | null>(initialState.selectedFrame);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>(initialState.capturedPhotos);
  const [retakeIndex, setRetakeIndex] = useState<number | null>(initialState.retakeIndex);
  const [finalLayoutBase64, setFinalLayoutBase64] = useState<string | null>(initialState.finalLayoutBase64);
  const [gifBlobUrl, setGifBlobUrl] = useState<string | null>(initialState.gifBlobUrl);
  const [selectedFilter, setSelectedFilter] = useState<PhotoFilter>(initialState.selectedFilter);
  const [customCaption, setCustomCaption] = useState<string>(initialState.customCaption);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Load saved session from Dexie IndexedDB on initial mount
  useEffect(() => {
    let isMounted = true;
    db.activeSession
      .get('current_active_session')
      .then((saved) => {
        if (isMounted && saved) {
          if (saved.selectedFrame) setSelectedFrame(saved.selectedFrame);
          if (saved.capturedPhotos && Array.isArray(saved.capturedPhotos) && saved.capturedPhotos.length > 0) {
            setCapturedPhotos(saved.capturedPhotos);
          }
          if (typeof saved.retakeIndex === 'number' || saved.retakeIndex === null) {
            setRetakeIndex(saved.retakeIndex);
          }
          if (saved.finalLayoutBase64) setFinalLayoutBase64(saved.finalLayoutBase64);
          if (saved.selectedFilter) setSelectedFilter(saved.selectedFilter);
          if (saved.customCaption) setCustomCaption(saved.customCaption);
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
      if (capturedPhotos.length === 0 && !selectedFrame && !finalLayoutBase64) {
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
            selectedFilter,
            customCaption,
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
    selectedFilter,
    customCaption,
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
    setGifBlobUrl((prevUrl) => {
      if (prevUrl && prevUrl.startsWith('blob:')) {
        URL.revokeObjectURL(prevUrl);
      }
      return null;
    });
    setSelectedFilter('original');
    setCustomCaption('SOREAJA — PHOTOBOX 2');
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
        gifBlobUrl,
        selectedFilter,
        customCaption,
        isHydrated,
        setSelectedFrame,
        setCapturedPhotos,
        updatePhotoAtIndex,
        setRetakeIndex,
        setFinalLayoutBase64,
        setGifBlobUrl,
        setSelectedFilter,
        setCustomCaption,
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
