export interface StickerItem {
  id: string;
  label: string;
  content: string;
  type: 'emoji' | 'stamp' | 'badge' | 'image';
  category: 'sparkles' | 'hearts_y2k' | 'stamps';
}

export const STICKER_COLLECTION: StickerItem[] = [
  // ☀️ Studio Branding (Circular Logo)
  { id: 'st_logo', label: 'SoreAja Sun Logo', content: '/assets/logo.webp', type: 'image', category: 'stamps' },
  // ✨ Sparkles & Stars
  { id: 'spk_1', label: 'Sparkles', content: '✨', type: 'emoji', category: 'sparkles' },
  { id: 'spk_2', label: 'Star Glow', content: '🌟', type: 'emoji', category: 'sparkles' },
  { id: 'spk_3', label: 'Four Point Star', content: '✦', type: 'emoji', category: 'sparkles' },
  { id: 'spk_4', label: 'Dizzy Star', content: '💫', type: 'emoji', category: 'sparkles' },
  { id: 'spk_5', label: 'Star Flare', content: '⋆˙⟡', type: 'emoji', category: 'sparkles' },
  { id: 'spk_6', label: 'Lightning', content: '⚡', type: 'emoji', category: 'sparkles' },
  { id: 'spk_7', label: 'Retro Spark', content: '❇️', type: 'emoji', category: 'sparkles' },
  { id: 'spk_8', label: 'Shooting Star', content: '🌠', type: 'emoji', category: 'sparkles' },
  { id: 'spk_9', label: 'Magic Wand', content: '🪄', type: 'emoji', category: 'sparkles' },

  // 💖 Y2K & Hearts
  { id: 'y2k_1', label: 'Sparkle Heart', content: '💖', type: 'emoji', category: 'hearts_y2k' },
  { id: 'y2k_2', label: 'Ribbon Bow', content: '🎀', type: 'emoji', category: 'hearts_y2k' },
  { id: 'y2k_3', label: 'Cherries', content: '🍒', type: 'emoji', category: 'hearts_y2k' },
  { id: 'y2k_4', label: 'Disco Ball', content: '🪩', type: 'emoji', category: 'hearts_y2k' },
  { id: 'y2k_5', label: 'Butterfly', content: '🦋', type: 'emoji', category: 'hearts_y2k' },
  { id: 'y2k_6', label: 'Kiss Mark', content: '💋', type: 'emoji', category: 'hearts_y2k' },
  { id: 'y2k_7', label: 'Black Heart', content: '🖤', type: 'emoji', category: 'hearts_y2k' },
  { id: 'y2k_8', label: 'Teddy Bear', content: '🧸', type: 'emoji', category: 'hearts_y2k' },
  { id: 'y2k_9', label: 'Bubbles', content: '🫧', type: 'emoji', category: 'hearts_y2k' },
  { id: 'y2k_10', label: 'Y2K CD', content: '💿', type: 'emoji', category: 'hearts_y2k' },
  { id: 'y2k_11', label: 'Cherry Blossom', content: '🌸', type: 'emoji', category: 'hearts_y2k' },
  { id: 'y2k_12', label: 'Peace Sign', content: '✌️', type: 'emoji', category: 'hearts_y2k' },

  // 🏷️ Studio Stamps
  { id: 'st_1', label: 'SoreAja Studio', content: 'SOREAJA', type: 'stamp', category: 'stamps' },
  { id: 'st_2', label: 'Bestie Forever', content: 'BESTIE FOREVER', type: 'stamp', category: 'stamps' },
  { id: 'st_3', label: 'Sunset Mood', content: 'SUNSET MOOD', type: 'stamp', category: 'stamps' },
  { id: 'st_4', label: 'Selfie Club', content: 'SELFIE CLUB', type: 'stamp', category: 'stamps' },
  { id: 'st_5', label: 'Date Stamp', content: 'DATE STAMP', type: 'stamp', category: 'stamps' },
  { id: 'st_6', label: 'Cute Overload', content: 'CUTE OVERLOAD', type: 'stamp', category: 'stamps' },
  { id: 'st_7', label: 'Memories 2026', content: 'MEMORIES 2026', type: 'stamp', category: 'stamps' },
  { id: 'st_8', label: 'Photo Dump', content: 'PHOTO DUMP', type: 'stamp', category: 'stamps' },
  { id: 'st_9', label: 'Golden Hour', content: 'GOLDEN HOUR', type: 'stamp', category: 'stamps' },
];
