/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import kioskHeroBackdrop from '../assets/images/kiosk_hero_backdrop_1791290594313.jpg';
import posePortrait1 from '../assets/images/studio_pose_portrait_1_1791290615701.jpg';
import posePortrait2 from '../assets/images/studio_pose_portrait_2_1791290635389.jpg';
import posePortrait3 from '../assets/images/studio_pose_portrait_3_1791290652838.jpg';
import posePortrait4 from '../assets/images/studio_pose_portrait_4_1791290668731.jpg';

export interface ThemeColorOption {
  id: string;
  name: string;
  color: string;
  hoverColor: string;
  desc: string;
}

export const THEME_COLOR_PRESETS: ThemeColorOption[] = [
  {
    id: 'crimson',
    name: 'Sore Crimson (Bawaan)',
    color: '#E11D48',
    hoverColor: '#BE123C',
    desc: 'Warna identitas SoreAja Studio yang berani & elegan',
  },
  {
    id: 'amber',
    name: 'Sunset Amber',
    color: '#D97706',
    hoverColor: '#B45309',
    desc: 'Kehangatan sinar senja emas nostalgia',
  },
  {
    id: 'violet',
    name: 'Electric Violet',
    color: '#8B5CF6',
    hoverColor: '#7C3AED',
    desc: 'Nuansa booth neon malam & festival pesta',
  },
  {
    id: 'cobalt',
    name: 'Ocean Cobalt',
    color: '#2563EB',
    hoverColor: '#1D4ED8',
    desc: 'Biru royal bersih, modern, dan profesional',
  },
  {
    id: 'emerald',
    name: 'Botanical Emerald',
    color: '#059669',
    hoverColor: '#047857',
    desc: 'Hijau daun alami untuk garden party & wedding',
  },
  {
    id: 'pink',
    name: 'Pastel Cherry',
    color: '#DB2777',
    hoverColor: '#BE185D',
    desc: 'Merah muda manis untuk perayaan ulang tahun',
  },
  {
    id: 'noir',
    name: 'Studio Noir',
    color: '#27272A',
    hoverColor: '#18181B',
    desc: 'Monokromatik editorial gelap minimalis',
  },
];

export interface BackdropPresetOption {
  id: string;
  name: string;
  desc: string;
  src: string;
}

export const BACKDROP_PRESETS: BackdropPresetOption[] = [
  {
    id: 'default_sunset',
    name: 'Studio SoreAja Sunset (Bawaan)',
    desc: 'Nuansa studio hangat senja SoreAja',
    src: kioskHeroBackdrop,
  },
  {
    id: 'candid_warm',
    name: 'Warm Candid Studio',
    desc: 'Potret hangat pencahayaan studio lembut',
    src: posePortrait1,
  },
  {
    id: 'retro_shades',
    name: 'Retro Sunglasses & Vibe',
    desc: 'Gaya kasual analog studio dengan kacamata',
    src: posePortrait2,
  },
  {
    id: 'golden_peace',
    name: 'Golden Hour Smile',
    desc: 'Ekspresi ceria dengan rona sinar keemasan',
    src: posePortrait3,
  },
  {
    id: 'joyful_laugh',
    name: 'Joyful Studio Moments',
    desc: 'Momen tawa riang bersama orang terdekat',
    src: posePortrait4,
  },
];

/**
 * Calculates a slightly darker shade for hover states
 */
export function calculateHoverColor(hex: string): string {
  if (!hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) {
    return hex;
  }
  const cleanHex = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  
  const r = parseInt(cleanHex.slice(1, 3), 16);
  const g = parseInt(cleanHex.slice(3, 5), 16);
  const b = parseInt(cleanHex.slice(5, 7), 16);

  const factor = 0.85; // darken by 15%
  const newR = Math.max(0, Math.floor(r * factor));
  const newG = Math.max(0, Math.floor(g * factor));
  const newB = Math.max(0, Math.floor(b * factor));

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}

/**
 * Applies dynamic CSS variables to the document root and meta theme-color
 */
export function applyThemeColor(color: string, hoverColor?: string): void {
  if (typeof document === 'undefined') return;
  const primary = color || '#E11D48';
  const hover = hoverColor || calculateHoverColor(primary);

  document.documentElement.style.setProperty('--theme-accent', primary);
  document.documentElement.style.setProperty('--theme-accent-hover', hover);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', primary);
  }
}
