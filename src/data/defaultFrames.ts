import type { FrameMetadata } from '../types/photobox';
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
];

export async function fetchFramesMetadata(): Promise<FrameMetadata[]> {
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
