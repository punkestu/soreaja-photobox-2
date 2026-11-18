import type { FrameMetadata, FramePackInfo } from '../types/photobox';
import { db } from '../db';
import kioskHeroBackdrop from '../assets/images/kiosk_hero_backdrop_1791290594313.jpg';
import posePortrait1 from '../assets/images/studio_pose_portrait_1_1791290615701.jpg';
import posePortrait2 from '../assets/images/studio_pose_portrait_2_1791290635389.jpg';
import posePortrait3 from '../assets/images/studio_pose_portrait_3_1791290652838.jpg';
import posePortrait4 from '../assets/images/studio_pose_portrait_4_1791290668731.jpg';

export const KIOSK_HERO_BACKDROP = kioskHeroBackdrop;

export const STUDIO_PORTRAITS = [
  {
    id: 'pose_1',
    label: 'Pose 01 · Warm Candid Smile',
    src: posePortrait1,
  },
  {
    id: 'pose_2',
    label: 'Pose 02 · Retro Shades & Attitude',
    src: posePortrait2,
  },
  {
    id: 'pose_3',
    label: 'Pose 03 · Golden Hour Peace Sign',
    src: posePortrait3,
  },
  {
    id: 'pose_4',
    label: 'Pose 04 · Joyful Finale Laugh',
    src: posePortrait4,
  },
];

export const DEFAULT_FRAMES: FrameMetadata[] = [
  {
    id: 'frame_001',
    name: 'Classic Strip',
    subtitle: '3-Cut Vertical Editorial Ivory',
    theme: 'light',
    canvasWidth: 602,
    canvasHeight: 1795,
    previewImg: '/assets/frames/clasic-bluestrip-3_transparent-preview.png',
    frameImg: '/assets/frames/clasic-bluestrip-3_transparent.png',
    photoCount: 3,
    positions: [
      { x: 60, y: 150, width: 480, height: 480 },
      { x: 60, y: 660, width: 480, height: 480 },
      { x: 60, y: 1160, width: 480, height: 480 },
    ],
  },
  {
    id: 'frame_002',
    name: 'SoreAja Noir Strip',
    subtitle: '3-Cut Matte Black & Crimson',
    theme: 'dark',
    canvasWidth: 602,
    canvasHeight: 1794,
    previewImg: '/assets/frames/sunday-3-photo-preview.png',
    frameImg: '/assets/frames/sunday-3-photo.png',
    photoCount: 3,
    positions: [
      { x: 51, y: 190, width: 500, height: 480 },
      { x: 51, y: 680, width: 500, height: 480 },
      { x: 51, y: 1170, width: 500, height: 480 },
    ],
  },
  {
    id: 'frame_003',
    name: 'Studio Contact 6-Cut Sheet',
    subtitle: '6-Cut Wide Gallery Double Sheet',
    theme: 'dark',
    canvasWidth: 1204,
    canvasHeight: 1795,
    previewImg: '/assets/frames/10. soreaja-strip-4cut-midnight-preview (9).png',
    frameImg: '/assets/frames/10_transparent.png',
    photoCount: 6,
    positions: [
      { x: 90, y: 170, width: 430, height: 430 },
      { x: 90, y: 610, width: 430, height: 430 },
      { x: 90, y: 1060, width: 430, height: 430 },
      { x: 690, y: 170, width: 440, height: 430 },
      { x: 690, y: 610, width: 430, height: 430 },
      { x: 690, y: 1050, width: 440, height: 440 },
    ],
  },
  {
    id: 'frame_004',
    name: 'Golden Hour Duo',
    subtitle: '2-Cut Warm Terracotta Edition',
    theme: 'warm',
    canvasWidth: 602,
    canvasHeight: 1794,
    previewImg: '/assets/frames/hbd-2-preview.png',
    frameImg: '/assets/frames/hbd-2-photo.png',
    photoCount: 2,
    positions: [
      { x: 40, y: 220, width: 520, height: 600 },
      { x: 40, y: 880, width: 520, height: 600 },
    ],
  },
  {
    id: 'frame_005',
    name: 'Pasar Sejati — Car Free Day',
    subtitle: '3-Cut Vintage Crimson & Stamp Edition',
    theme: 'dark',
    canvasWidth: 602,
    canvasHeight: 1795,
    previewImg: '/assets/frames/car-free-day-3_transparent-preview.png',
    frameImg: '/assets/frames/car-free-day-3_transparent.png',
    photoCount: 3,
    positions: [
      { x: 40, y: 350, width: 520, height: 390 },
      { x: 40, y: 740, width: 520, height: 420 },
      { x: 40, y: 1160, width: 520, height: 420 },
    ],
    hideGenericStamps: true,
  },
  {
    id: 'sunday-3-photo',
    name: 'Sunday',
    subtitle: 'Sunday - Soreaja',
    theme: 'dark',
    canvasWidth: 602,
    canvasHeight: 1794,
    previewImg: '/assets/frames/sunday-3-photo-preview.png',
    frameImg: '/assets/frames/sunday-3-photo.png',
    photoCount: 3,
    positions: [
      { x: 51, y: 190, width: 500, height: 480 },
      { x: 51, y: 680, width: 500, height: 480 },
      { x: 51, y: 1170, width: 500, height: 480 },
    ],
    hideGenericStamps: true,
  },
];

export const DEFAULT_FRAME_PACK: FramePackInfo = {
  id: 'default',
  name: 'SoreAja Classic Pack',
  description: 'Koleksi 54 template bingkai bawaan SoreAja Photobox (Single Strip & Double Sheet)',
  author: 'SoreAja Studio',
  version: '1.0.0',
  coverImg: '/assets/frames/hbd-1-preview.png',
  frameCount: 54,
  isDefault: true,
  path: '/frame-packs/default',
};

/**
 * Resolves frame asset URLs. If a relative path is provided, prepends the pack directory.
 */
export function resolveFrameAssetUrl(url: string | undefined, packId: string): string {
  if (!url) return '';
  if (url.startsWith('/') || url.startsWith('http') || url.startsWith('data:')) {
    return url;
  }
  return `/frame-packs/${packId}/${url}`;
}

/**
 * Fetch all available Frame Packs.
 * Tries dev API /api/frame-packs -> static /frame-packs/packs.json -> IndexedDB -> fallback.
 */
export async function fetchAvailablePacks(): Promise<FramePackInfo[]> {
  let packs: FramePackInfo[] = [];

  // 1. Try dev dynamic API
  try {
    const res = await fetch('/api/frame-packs');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        packs = data;
      }
    }
  } catch {
    // Dev API not reachable, try static manifest
  }

  // 2. Try static /frame-packs/packs.json
  if (packs.length === 0) {
    try {
      const res = await fetch('/frame-packs/packs.json');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          packs = data;
        }
      }
    } catch {
      // Static manifest unreachable
    }
  }

  // 3. Fallback to IndexedDB offline cache
  if (packs.length === 0) {
    try {
      const cached = await db.framePacks.toArray();
      if (cached && cached.length > 0) {
        packs = cached;
      }
    } catch {
      // Ignore DB error
    }
  }

  // 4. Default fallback if nothing found
  if (packs.length === 0) {
    packs = [DEFAULT_FRAME_PACK];
  }

  // Mirror to IndexedDB for guaranteed offline survival
  try {
    await db.framePacks.bulkPut(packs);
  } catch (err) {
    console.warn('Could not cache frame packs in IndexedDB:', err);
  }

  return packs;
}

/**
 * Fetch frame metadata for a specific pack (or the currently active pack).
 */
export async function fetchFramesMetadata(packId?: string): Promise<FrameMetadata[]> {
  let targetPackId = packId;

  if (!targetPackId) {
    try {
      const settings = await db.settings.get('app_settings');
      targetPackId = settings?.activeFramePack || 'default';
    } catch {
      targetPackId = 'default';
    }
  }

  // 1. Check IndexedDB for pre-cached pack frames
  try {
    const cachedPack = await db.framePacks.get(targetPackId);
    if (cachedPack && Array.isArray(cachedPack.frames) && cachedPack.frames.length > 0) {
      return cachedPack.frames;
    }
  } catch {
    // Continue to network fetch
  }

  // 2. Try fetching the pack's pack.json
  try {
    const res = await fetch(`/frame-packs/${targetPackId}/pack.json`);
    if (res.ok) {
      const data = await res.json();
      const rawFrames: FrameMetadata[] = Array.isArray(data.frames)
        ? data.frames
        : Array.isArray(data)
        ? data
        : [];

      if (rawFrames.length > 0) {
        const normalized = rawFrames.map((f) => ({
          ...f,
          previewImg: resolveFrameAssetUrl(f.previewImg, targetPackId!),
          frameImg: resolveFrameAssetUrl(f.frameImg, targetPackId!),
        }));

        // Cache into IndexedDB
        db.framePacks
          .put({
            id: targetPackId,
            name: data.name || targetPackId,
            description: data.description,
            author: data.author,
            version: data.version,
            coverImg: resolveFrameAssetUrl(data.coverImg || normalized[0]?.previewImg, targetPackId),
            frameCount: normalized.length,
            isDefault: targetPackId === 'default',
            path: `/frame-packs/${targetPackId}`,
            frames: normalized,
            updatedAt: new Date().toISOString(),
          })
          .catch(() => {});

        return normalized;
      }
    }
  } catch {
    // Continue fallback
  }

  // 3. Fallback to /metadata.json
  try {
    const res = await fetch('/metadata.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].positions) {
        return data as FrameMetadata[];
      }
    }
  } catch {
    // Fallback to frames-metadata.json
  }

  // 4. Fallback to /frames-metadata.json
  try {
    const res2 = await fetch('/frames-metadata.json');
    if (res2.ok) {
      const data2 = await res2.json();
      if (Array.isArray(data2) && data2.length > 0) {
        return data2 as FrameMetadata[];
      }
    }
  } catch {
    // Fallback to bundled DEFAULT_FRAMES
  }

  return DEFAULT_FRAMES;
}
