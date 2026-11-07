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
    canvasWidth: 500,
    canvasHeight: 1220,
    previewImg: '/assets/frames/preview_001.png',
    frameImg: '/assets/frames/frame_001.png',
    photoCount: 3,
    positions: [
      { x: 50, y: 100, width: 400, height: 300 },
      { x: 50, y: 450, width: 400, height: 300 },
      { x: 50, y: 800, width: 400, height: 300 },
    ],
  },
  {
    id: 'frame_002',
    name: 'SoreAja Noir Strip',
    subtitle: '3-Cut Matte Black & Crimson',
    theme: 'dark',
    canvasWidth: 500,
    canvasHeight: 1220,
    previewImg: '/assets/frames/preview_002.png',
    frameImg: '/assets/frames/frame_002.png',
    photoCount: 3,
    positions: [
      { x: 50, y: 100, width: 400, height: 300 },
      { x: 50, y: 450, width: 400, height: 300 },
      { x: 50, y: 800, width: 400, height: 300 },
    ],
  },
  {
    id: 'frame_003',
    name: 'Studio Contact 2x2',
    subtitle: '4-Cut Wide Gallery Sheet',
    theme: 'light',
    canvasWidth: 920,
    canvasHeight: 820,
    previewImg: '/assets/frames/preview_003.png',
    frameImg: '/assets/frames/frame_003.png',
    photoCount: 4,
    positions: [
      { x: 50, y: 100, width: 390, height: 292 },
      { x: 480, y: 100, width: 390, height: 292 },
      { x: 50, y: 422, width: 390, height: 292 },
      { x: 480, y: 422, width: 390, height: 292 },
    ],
  },
  {
    id: 'frame_004',
    name: 'Golden Hour Duo',
    subtitle: '2-Cut Warm Terracotta Edition',
    theme: 'warm',
    canvasWidth: 500,
    canvasHeight: 880,
    previewImg: '/assets/frames/preview_004.png',
    frameImg: '/assets/frames/frame_004.png',
    photoCount: 2,
    positions: [
      { x: 50, y: 100, width: 400, height: 300 },
      { x: 50, y: 440, width: 400, height: 300 },
    ],
  },
  {
    id: 'frame_005',
    name: 'Pasar Sejati — Car Free Day',
    subtitle: '3-Cut Vintage Crimson & Stamp Edition',
    theme: 'dark',
    canvasWidth: 480,
    canvasHeight: 1440,
    previewImg: '/assets/frames/preview_005.png',
    frameImg: '/assets/frames/frame_005.png',
    photoCount: 3,
    positions: [
      { x: 50, y: 68, width: 380, height: 265 },
      { x: 50, y: 360, width: 380, height: 265 },
      { x: 50, y: 652, width: 380, height: 265 },
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
