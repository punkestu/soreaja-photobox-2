import type { ImagePreprocessingSettings } from '../types/photobox';

export interface PreprocessingPreset {
  id: string;
  nameId: string;
  nameEn: string;
  icon: string;
  descriptionId: string;
  descriptionEn: string;
  settings: Omit<ImagePreprocessingSettings, 'enabled'>;
}

export const PREPROCESSING_PRESETS: PreprocessingPreset[] = [
  {
    id: 'default',
    nameId: 'Netral (Bawaan)',
    nameEn: 'Neutral (Default)',
    icon: '✨',
    descriptionId: 'Warna dan pencahayaan asli sensor kamera tanpa kalibrasi tambahan',
    descriptionEn: 'Original sensor output without additional lighting calibration',
    settings: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      ambiance: 0,
      highlights: 0,
      shadows: 0,
      warmth: 0,
    },
  },
  {
    id: 'studio-crisp',
    nameId: 'Studio Bersih & Tajam',
    nameEn: 'Clean & Crisp Studio',
    icon: '💎',
    descriptionId: 'Mencerahkan bayangan wajah, kontras tegas, dan detail jernih khas studio',
    descriptionEn: 'Lifts facial shadows, delivers crisp contrast and clean studio clarity',
    settings: {
      brightness: 8,
      contrast: 12,
      saturation: 6,
      ambiance: 12,
      highlights: -8,
      shadows: 14,
      warmth: 4,
    },
  },
  {
    id: 'warm-sunset',
    nameId: 'Studio Sore Hangat',
    nameEn: 'Warm Sunset Studio',
    icon: '🌅',
    descriptionId: 'Nuansa golden hour dengan saturasi lembut dan temperatur hangat menawan',
    descriptionEn: 'Golden hour amber warmth with rich tones and pleasing skin highlights',
    settings: {
      brightness: 6,
      contrast: 10,
      saturation: 10,
      ambiance: 15,
      highlights: -5,
      shadows: 12,
      warmth: 24,
    },
  },
  {
    id: 'vivid-punch',
    nameId: 'Vivid & Punchy',
    nameEn: 'Vivid & Punchy',
    icon: '🎨',
    descriptionId: 'Warna cerah menyala dengan kontras tinggi cocok untuk acara meriah',
    descriptionEn: 'High vibrancy and punchy dynamic contrast suited for lively party events',
    settings: {
      brightness: 10,
      contrast: 16,
      saturation: 22,
      ambiance: 18,
      highlights: 5,
      shadows: 8,
      warmth: 6,
    },
  },
  {
    id: 'soft-glam',
    nameId: 'Soft Glam / Potret Lembut',
    nameEn: 'Soft Glamour Portrait',
    icon: '🌸',
    descriptionId: 'Bayangan lembut terangkat, highlight terkendali, dan kontras halus',
    descriptionEn: 'High shadow fill, subdued highlights and gentle contrast for flattering portraits',
    settings: {
      brightness: 12,
      contrast: -4,
      saturation: 5,
      ambiance: 20,
      highlights: -15,
      shadows: 24,
      warmth: 10,
    },
  },
  {
    id: 'moody-editorial',
    nameId: 'Moody Editorial',
    nameEn: 'Moody Editorial',
    icon: '🎞️',
    descriptionId: 'Kontras mendalam dengan saturasi teredam untuk gaya editorial majalah',
    descriptionEn: 'Deep shadows, rich contrast, and desaturated tones for magazine editorial aesthetic',
    settings: {
      brightness: -4,
      contrast: 22,
      saturation: -12,
      ambiance: -8,
      highlights: -12,
      shadows: -16,
      warmth: -6,
    },
  },
];

/**
 * Checks whether preprocessing settings are neutral (effectively 0 or disabled),
 * allowing fast-path bypass without canvas reallocation or typed array processing overhead.
 */
export function isPreprocessingNeutral(settings?: ImagePreprocessingSettings | null): boolean {
  if (!settings || settings.enabled === false) return true;
  return (
    (settings.brightness ?? 0) === 0 &&
    (settings.contrast ?? 0) === 0 &&
    (settings.saturation ?? 0) === 0 &&
    (settings.ambiance ?? 0) === 0 &&
    (settings.highlights ?? 0) === 0 &&
    (settings.shadows ?? 0) === 0 &&
    (settings.warmth ?? 0) === 0
  );
}

/**
 * High-performance in-place pixel transformation using typed arrays.
 * Handles 7 photographic adjustments:
 * Warmth -> Shadows -> Highlights -> Ambiance -> Brightness -> Contrast -> Saturation.
 */
export function processImageData(
  data: Uint8ClampedArray,
  settings: ImagePreprocessingSettings
): void {
  const brightness = settings.brightness ?? 0;
  const contrast = settings.contrast ?? 0;
  const saturation = settings.saturation ?? 0;
  const ambiance = settings.ambiance ?? 0;
  const highlights = settings.highlights ?? 0;
  const shadows = settings.shadows ?? 0;
  const warmth = settings.warmth ?? 0;

  // Precompute invariant coefficients
  const bOffset = brightness * 1.25;

  // Standard photographic S-curve contrast centered at middle gray (128)
  const cFactor =
    contrast !== 0
      ? (259 * (contrast * 2.55 + 255)) / (255 * (259 - contrast * 2.55))
      : 1;

  // Saturation factor
  const sFactor = Math.max(0, 1 + saturation / 100);

  // Warmth color temperature shifts
  const wR = warmth > 0 ? warmth * 0.65 : warmth * 0.5;
  const wG = warmth > 0 ? warmth * 0.16 : 0;
  const wB = warmth > 0 ? -warmth * 0.65 : -warmth * 0.55;

  const hlFactor = highlights * 0.85;
  const shFactor = shadows * 0.95;
  const ambFactor = ambiance;

  const hasWarmth = warmth !== 0;
  const hasShadows = shadows !== 0;
  const hasHighlights = highlights !== 0;
  const hasAmbiance = ambiance !== 0;
  const hasBrightness = brightness !== 0;
  const hasContrast = contrast !== 0;
  const hasSaturation = saturation !== 0;

  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 1. Warmth (Kelvin white balance shift)
    if (hasWarmth) {
      r += wR;
      g += wG;
      b += wB;
    }

    // Standard Rec.601 perceptual luminance
    let lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // 2. Shadows (Lift or deepen dark tones below ~160)
    if (hasShadows && lum < 160) {
      const shNorm = (160 - lum) / 160;
      const shWeight = shNorm * shNorm; // Smooth quadratic falloff
      const shDelta = shFactor * shWeight;
      r += shDelta;
      g += shDelta;
      b += shDelta;
    }

    // 3. Highlights (Recover or punch bright tones above ~120)
    if (hasHighlights && lum > 120) {
      const hlNorm = (lum - 120) / 135;
      const hlWeight = Math.min(1, hlNorm * hlNorm); // Smooth quadratic rise
      const hlDelta = hlFactor * hlWeight;
      r += hlDelta;
      g += hlDelta;
      b += hlDelta;
    }

    // 4. Ambiance (Dynamic fill-light & midtone clarity balance)
    if (hasAmbiance) {
      const normL = Math.max(0, Math.min(1, lum / 255));
      // Adaptive shadow fill
      const shadowFill = ambFactor * 0.42 * (1 - normL);
      // Soft highlight roll-off
      const highlightRoll = -ambFactor * 0.2 * normL;
      // Midtone clarity
      const midDist = (normL - 0.5) * 2;
      const midWeight = Math.max(0, 1 - midDist * midDist);
      const midClarity = ambFactor * 0.18 * midWeight;

      const ambTotal = shadowFill + highlightRoll + midClarity;
      r += ambTotal;
      g += ambTotal;
      b += ambTotal;
    }

    // 5. Brightness
    if (hasBrightness) {
      r += bOffset;
      g += bOffset;
      b += bOffset;
    }

    // 6. Contrast (Pivot around middle gray 128)
    if (hasContrast) {
      r = cFactor * (r - 128) + 128;
      g = cFactor * (g - 128) + 128;
      b = cFactor * (b - 128) + 128;
    }

    // 7. Saturation (Vibrancy vector from gray luminance)
    if (hasSaturation) {
      lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = lum + (r - lum) * sFactor;
      g = lum + (g - lum) * sFactor;
      b = lum + (b - lum) * sFactor;
    }

    // Strict 8-bit clamp
    data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
}

/**
 * Applies preprocessing directly onto an HTMLCanvasElement in-place.
 */
export function applyImagePreprocessingToCanvas(
  canvas: HTMLCanvasElement,
  settings?: ImagePreprocessingSettings | null
): void {
  if (isPreprocessingNeutral(settings) || !settings) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    processImageData(imgData.data, settings);
    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.warn('[ImagePreprocessing] Canvas pixel processing fallback:', err);
  }
}

/**
 * Applies preprocessing to an image source string (Base64 data URL or image path)
 * and returns the preprocessed Base64 JPEG data URL.
 */
export async function applyImagePreprocessingToDataUrl(
  imageSrc: string,
  settings?: ImagePreprocessingSettings | null,
  mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg',
  quality: number = 0.98
): Promise<string> {
  if (!imageSrc) return imageSrc;
  if (isPreprocessingNeutral(settings) || !settings) return imageSrc;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        processImageData(imgData.data, settings);
        ctx.putImageData(imgData, 0, 0);

        resolve(canvas.toDataURL(mimeType, quality));
      } catch (err) {
        console.warn('[ImagePreprocessing] DataURL processing failed:', err);
        resolve(imageSrc);
      }
    };
    img.onerror = (err) => {
      console.warn('[ImagePreprocessing] Image load error:', err);
      resolve(imageSrc);
    };
    img.src = imageSrc;
  });
}

/**
 * Generates real-time 60fps CSS filter string for live viewfinder elements
 * (<video>, DSLR preview <img>, and simulator portrait).
 */
export function getPreprocessingCssFilter(settings?: ImagePreprocessingSettings | null): string {
  if (isPreprocessingNeutral(settings) || !settings) return 'none';

  const b = settings.brightness ?? 0;
  const c = settings.contrast ?? 0;
  const s = settings.saturation ?? 0;
  const amb = settings.ambiance ?? 0;
  const sh = settings.shadows ?? 0;
  const hl = settings.highlights ?? 0;
  const warmth = settings.warmth ?? 0;

  // Composite brightness multiplier
  // Ambiance + shadows gently lift perceived exposure; highlights balance it
  const bTotal = 1 + (b / 100) * 0.75 + (amb / 100) * 0.12 + (sh / 100) * 0.1 + (hl / 100) * 0.08;
  const brightnessCss = Math.max(0.1, bTotal).toFixed(3);

  // Composite contrast multiplier
  const cTotal = 1 + (c / 100) * 0.75 + (amb / 100) * 0.08;
  const contrastCss = Math.max(0.1, cTotal).toFixed(3);

  // Composite saturation multiplier
  const sTotal = 1 + (s / 100) * 0.85 + (amb / 100) * 0.08;
  const saturateCss = Math.max(0, sTotal).toFixed(3);

  const filterParts: string[] = [
    `brightness(${brightnessCss})`,
    `contrast(${contrastCss})`,
    `saturate(${saturateCss})`,
  ];

  // Color temperature simulation in CSS
  if (warmth > 0) {
    const sepiaVal = Math.min(60, Math.round(warmth * 0.35));
    filterParts.push(`sepia(${sepiaVal}%)`);
  } else if (warmth < 0) {
    const hueVal = Math.max(-30, Math.round(warmth * 0.2));
    filterParts.push(`hue-rotate(${hueVal}deg)`);
  }

  return filterParts.join(' ');
}

