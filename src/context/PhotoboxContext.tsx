import React, { createContext, useContext, useState, useCallback } from 'react';
import type { FrameMetadata, PhotoFilter, PhotoboxState } from '../types/photobox';
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
