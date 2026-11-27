import type { PhotoEnhancerPreset, PhotoEnhancerSettings } from '../types/photobox';

export interface EnhancerPresetConfig {
  id: PhotoEnhancerPreset;
  nameId: string;
  nameEn: string;
  descId: string;
  descEn: string;
  upscaleScale: 1 | 1.5 | 2;
  sharpenAmount: number;
  denoiseLevel: number;
  autoTone: boolean;
}

export const ENHANCER_PRESETS: EnhancerPresetConfig[] = [
  {
    id: 'natural-clean',
    nameId: 'Natural Clean (1× · Paling Ringan)',
    nameEn: 'Natural Clean (1× · Ultra Light)',
    descId: 'Haluskan noise webcam & pertajam halus di resolusi asli tanpa upscaling (<40ms)',
    descEn: 'Soft webcam denoise & subtle sharpening at native size without upscaling (<40ms)',
    upscaleScale: 1,
    sharpenAmount: 28,
    denoiseLevel: 25,
    autoTone: false,
  },
  {
    id: 'studio-crisp',
    nameId: 'Studio Crisp (1.5× · Seimbang)',
    nameEn: 'Studio Crisp (1.5× · Balanced)',
    descId: 'Naikkan resolusi 1.5×, bersihkan grain & pertajam detail mata/rambut dengan tone seimbang',
    descEn: '1.5× progressive upscale with edge-preserving denoise, crisp detail & auto tone',
    upscaleScale: 1.5,
    sharpenAmount: 45,
    denoiseLevel: 20,
    autoTone: true,
  },
  {
    id: 'hd-upscale',
    nameId: 'HD Upscale (2× · Tajam Maksimal)',
    nameEn: 'HD Upscale (2× · Max Clarity)',
    descId: 'Upscale bertahap 2× hingga maks 2400px + penajaman ekstra untuk cetak besar',
    descEn: 'Progressive 2× upscale (up to 2400px) + extra detail sharpening for large prints',
    upscaleScale: 2,
    sharpenAmount: 65,
    denoiseLevel: 15,
    autoTone: true,
  },
];

export interface EnhancePhotoResult {
  url: string;
  enhanced: boolean;
  durationMs: number;
  inputWidth: number;
  inputHeight: number;
  outputWidth: number;
  outputHeight: number;
  backend: string;
  fallbackUsed?: boolean;
  error?: string;
}

const MAX_OUTPUT_DIMENSION = 2400;

export function normalizeEnhancerSettings(
  raw?: Partial<PhotoEnhancerSettings> | null
): PhotoEnhancerSettings {
  const validPreset =
    raw?.preset === 'natural-clean' ||
    raw?.preset === 'studio-crisp' ||
    raw?.preset === 'hd-upscale'
      ? raw.preset
      : 'studio-crisp';

  const validScale =
    raw?.upscaleScale === 1 || raw?.upscaleScale === 1.5 || raw?.upscaleScale === 2
      ? raw.upscaleScale
      : 1.5;

  return {
    enabled: Boolean(raw?.enabled),
    preset: validPreset,
    upscaleScale: validScale,
    sharpenAmount:
      typeof raw?.sharpenAmount === 'number'
        ? Math.max(0, Math.min(100, raw.sharpenAmount))
        : 45,
    denoiseLevel:
      typeof raw?.denoiseLevel === 'number'
        ? Math.max(0, Math.min(100, raw.denoiseLevel))
        : 20,
    autoTone: raw?.autoTone !== undefined ? Boolean(raw.autoTone) : true,
  };
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

/**
 * Progressive high-quality Canvas resampling (avoids single-pass blurriness
 * while remaining instantaneous on low-end CPUs).
 */
function resampleToCanvas(
  img: HTMLImageElement,
  scale: number
): { canvas: HTMLCanvasElement; inputWidth: number; inputHeight: number } {
  const rawW = img.naturalWidth || img.width;
  const rawH = img.naturalHeight || img.height;
  const maxDim = Math.max(rawW, rawH);

  const clampedScale =
    scale > 1 && maxDim > 0
      ? Math.max(1, Math.min(scale, MAX_OUTPUT_DIMENSION / maxDim))
      : 1;

  const targetW = Math.round(rawW * clampedScale);
  const targetH = Math.round(rawH * clampedScale);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetW;
  outCanvas.height = targetH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return { canvas: outCanvas, inputWidth: rawW, inputHeight: rawH };

  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';

  // Two-step resample when scaling >= 1.6x for cleaner edges
  if (clampedScale >= 1.6) {
    const midW = Math.round(rawW * Math.sqrt(clampedScale));
    const midH = Math.round(rawH * Math.sqrt(clampedScale));
    const midCanvas = document.createElement('canvas');
    midCanvas.width = midW;
    midCanvas.height = midH;
    const midCtx = midCanvas.getContext('2d');
    if (midCtx) {
      midCtx.imageSmoothingEnabled = true;
      midCtx.imageSmoothingQuality = 'high';
      midCtx.drawImage(img, 0, 0, midW, midH);
      outCtx.drawImage(midCanvas, 0, 0, targetW, targetH);
      return { canvas: outCanvas, inputWidth: rawW, inputHeight: rawH };
    }
  }

  outCtx.drawImage(img, 0, 0, targetW, targetH);
  return { canvas: outCanvas, inputWidth: rawW, inputHeight: rawH };
}

/**
 * Fast edge-preserving 4-neighbor smoothing that reduces flat low-light grain
 * without blurring sharp facial edges.
 */
function applyEdgePreservingDenoise(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  denoiseLevel: number
): void {
  if (denoiseLevel <= 0 || width < 3 || height < 3) return;

  const copy = new Uint8ClampedArray(data);
  const threshold = 16 + denoiseLevel * 0.28;
  const maxBlend = (denoiseLevel / 100) * 0.45;
  const stride = width * 4;

  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * stride;
    for (let x = 1; x < width - 1; x++) {
      const idx = rowOffset + x * 4;
      const r0 = copy[idx];
      const g0 = copy[idx + 1];
      const b0 = copy[idx + 2];

      let sumR = r0;
      let sumG = g0;
      let sumB = b0;
      let weightSum = 1;

      const neighbors = [idx - 4, idx + 4, idx - stride, idx + stride];
      for (let n = 0; n < 4; n++) {
        const nIdx = neighbors[n];
        const nr = copy[nIdx];
        const ng = copy[nIdx + 1];
        const nb = copy[nIdx + 2];
        const diff =
          Math.abs(nr - r0) * 0.299 +
          Math.abs(ng - g0) * 0.587 +
          Math.abs(nb - b0) * 0.114;

        if (diff < threshold) {
          const w = 1 - diff / threshold;
          sumR += nr * w;
          sumG += ng * w;
          sumB += nb * w;
          weightSum += w;
        }
      }

      if (weightSum > 1.05) {
        const avgR = sumR / weightSum;
        const avgG = sumG / weightSum;
        const avgB = sumB / weightSum;
        data[idx] = Math.round(r0 + (avgR - r0) * maxBlend);
        data[idx + 1] = Math.round(g0 + (avgG - g0) * maxBlend);
        data[idx + 2] = Math.round(b0 + (avgB - b0) * maxBlend);
      }
    }
  }
}

/**
 * Gentle percentile-safe studio dynamic range balance (prevents washed-out webcam shots).
 */
function applyGentleAutoTone(data: Uint8ClampedArray): void {
  const hist = new Uint32Array(256);
  let sampleCount = 0;
  for (let i = 0; i < data.length; i += 16) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    hist[lum < 0 ? 0 : lum > 255 ? 255 : lum]++;
    sampleCount++;
  }
  if (sampleCount === 0) return;

  const lowTarget = sampleCount * 0.015;
  const highTarget = sampleCount * 0.985;
  let cum = 0;
  let low = 0;
  let high = 255;

  for (let v = 0; v < 256; v++) {
    cum += hist[v];
    if (cum >= lowTarget) {
      low = v;
      break;
    }
  }
  cum = 0;
  for (let v = 0; v < 256; v++) {
    cum += hist[v];
    if (cum >= highTarget) {
      high = v;
      break;
    }
  }

  const span = high - low;
  if (span < 28 || (low <= 6 && high >= 248)) return;

  // Blend 28% toward stretched range so contrast looks naturally studio-lit
  const blend = 0.28;
  const scale = 255 / span;

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const orig = data[i + c];
      const stretched = Math.max(0, Math.min(255, (orig - low) * scale));
      data[i + c] = Math.round(orig + (stretched - orig) * blend);
    }
  }
}

/**
 * Luminance-preserving unsharp mask (3x3 Gaussian blur difference on Y channel)
 * with a noise floor threshold to avoid amplifying flat-area grain.
 */
function applyLuminanceUnsharpMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sharpenAmount: number
): void {
  if (sharpenAmount <= 0 || width < 3 || height < 3) return;

  const totalPixels = width * height;
  const lum = new Float32Array(totalPixels);
  for (let p = 0, i = 0; p < totalPixels; p++, i += 4) {
    lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const gain = (sharpenAmount / 100) * 1.15;
  const noiseThreshold = 3.5;

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const p = row + x;
      const blur =
        (lum[p - width - 1] +
          2 * lum[p - width] +
          lum[p - width + 1] +
          2 * lum[p - 1] +
          4 * lum[p] +
          2 * lum[p + 1] +
          lum[p + width - 1] +
          2 * lum[p + width] +
          lum[p + width + 1]) /
        16;

      const detail = lum[p] - blur;
      if (Math.abs(detail) <= noiseThreshold) continue;

      const delta = detail * gain;
      const i = p * 4;
      const r = data[i] + delta;
      const g = data[i + 1] + delta;
      const b = data[i + 2] + delta;
      data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
  }
}

/**
 * Lightweight Studio Photo Enhancer (pure Canvas 2D + typed arrays).
 * Fast-paths immediately when disabled and runs in ~30-100ms with zero ML/WASM overhead.
 */
export async function enhancePhotoDataUrl(
  imageSrc: string,
  settings?: Partial<PhotoEnhancerSettings> | null,
  onProgress?: (percent: number) => void,
  forceRun = false
): Promise<EnhancePhotoResult> {
  if (!imageSrc) {
    return {
      url: imageSrc,
      enhanced: false,
      durationMs: 0,
      inputWidth: 0,
      inputHeight: 0,
      outputWidth: 0,
      outputHeight: 0,
      backend: 'canvas-2d',
    };
  }

  const normalized = normalizeEnhancerSettings(settings);
  if (!forceRun && !normalized.enabled) {
    return {
      url: imageSrc,
      enhanced: false,
      durationMs: 0,
      inputWidth: 0,
      inputHeight: 0,
      outputWidth: 0,
      outputHeight: 0,
      backend: 'canvas-2d',
    };
  }

  const startTime = performance.now();
  let inputWidth = 0;
  let inputHeight = 0;

  try {
    onProgress?.(15);
    const img = await loadHtmlImage(imageSrc);
    const { canvas, inputWidth: inW, inputHeight: inH } = resampleToCanvas(
      img,
      normalized.upscaleScale
    );
    inputWidth = inW;
    inputHeight = inH;

    onProgress?.(40);
    await yieldToBrowser();

    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (normalized.denoiseLevel > 0) {
        applyEdgePreservingDenoise(
          imgData.data,
          canvas.width,
          canvas.height,
          normalized.denoiseLevel
        );
      }

      onProgress?.(65);
      await yieldToBrowser();

      if (normalized.autoTone) {
        applyGentleAutoTone(imgData.data);
      }

      if (normalized.sharpenAmount > 0) {
        applyLuminanceUnsharpMask(
          imgData.data,
          canvas.width,
          canvas.height,
          normalized.sharpenAmount
        );
      }

      ctx.putImageData(imgData, 0, 0);
    }

    onProgress?.(95);
    const outUrl = canvas.toDataURL('image/jpeg', 0.96);
    onProgress?.(100);

    return {
      url: outUrl,
      enhanced: true,
      durationMs: Math.round(performance.now() - startTime),
      inputWidth,
      inputHeight,
      outputWidth: canvas.width,
      outputHeight: canvas.height,
      backend: 'canvas-2d',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[PhotoEnhancer] Falling back to original photo:', message);
    return {
      url: imageSrc,
      enhanced: false,
      durationMs: Math.round(performance.now() - startTime),
      inputWidth,
      inputHeight,
      outputWidth: inputWidth,
      outputHeight: inputHeight,
      backend: 'canvas-2d',
      fallbackUsed: true,
      error: message,
    };
  }
}
