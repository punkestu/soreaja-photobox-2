import type { FrameMetadata, PhotoFilter, StripRatioInfo } from '../types/photobox';

export { type StripRatioInfo };

export function checkStripRatio(width: number, height: number): StripRatioInfo {
  const safeW = width || 480;
  const safeH = height || 1440;
  const ratio = safeW / safeH;

  // A vertical long strip is typically 1:3 or 1:2.5 (ratio <= 0.65).
  // Standard 4R portrait is 2:3 (ratio ~0.667). 3:4 is 0.75. Square is 1.0. Landscape > 1.0.
  const isVerticalLongStrip = ratio <= 0.65;

  let type: StripRatioInfo['type'] = 'standard-portrait';
  if (isVerticalLongStrip) {
    type = 'vertical-long-strip';
  } else if (Math.abs(ratio - 1) < 0.08) {
    type = 'square';
  } else if (ratio > 1.08) {
    type = 'landscape';
  }

  // Format readable ratio approximation
  let ratioFormatted = `${safeW}×${safeH} (${ratio.toFixed(2)})`;
  if (Math.abs(ratio - 1 / 3) < 0.05) {
    ratioFormatted = '1:3 (Photo Strip)';
  } else if (Math.abs(ratio - 1 / 2) < 0.06) {
    ratioFormatted = '1:2 (Tall Vertical Strip)';
  } else if (Math.abs(ratio - 2 / 3) < 0.05) {
    ratioFormatted = '2:3 (4R Standard Portrait)';
  } else if (Math.abs(ratio - 3 / 4) < 0.05) {
    ratioFormatted = '3:4 (Portrait)';
  } else if (Math.abs(ratio - 1) < 0.08) {
    ratioFormatted = '1:1 (Square)';
  } else if (Math.abs(ratio - 4 / 3) < 0.08) {
    ratioFormatted = '4:3 (Landscape)';
  } else if (Math.abs(ratio - 3 / 2) < 0.08) {
    ratioFormatted = '3:2 (Landscape 4R)';
  }

  return {
    width: safeW,
    height: safeH,
    ratio,
    ratioFormatted,
    isVerticalLongStrip,
    type,
  };
}

export function isVerticalLongStrip(width: number, height: number): boolean {
  return checkStripRatio(width, height).isVerticalLongStrip;
}

export interface DoubleStripOptions {
  includeCutLine?: boolean;
  cutLineColor?: string;
  spacing?: number;
  showScissorIcon?: boolean;
}

export async function generateSideBySideStrip(
  singleStripBase64: string,
  options: DoubleStripOptions = {}
): Promise<string> {
  const {
    includeCutLine = true,
    cutLineColor = 'rgba(160, 160, 160, 0.45)',
    spacing = 0,
    showScissorIcon = true,
  } = options;

  const img = await loadImage(singleStripBase64);
  const singleW = img.width;
  const singleH = img.height;
  const totalW = singleW * 2 + spacing;
  const totalH = singleH;

  const canvas = document.createElement('canvas');
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return singleStripBase64;

  ctx.clearRect(0, 0, totalW, totalH);

  // 1. Draw Left Strip
  ctx.drawImage(img, 0, 0, singleW, singleH);

  // 2. Draw Right Strip (Duplicate side-by-side)
  ctx.drawImage(img, singleW + spacing, 0, singleW, singleH);

  // 3. Center Cutting Guide (Dashed line with scissor glyphs)
  if (includeCutLine) {
    const dividerX = singleW + Math.floor(spacing / 2);
    ctx.save();

    ctx.beginPath();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = cutLineColor;
    ctx.lineWidth = 1.5;
    ctx.moveTo(dividerX, 0);
    ctx.lineTo(dividerX, totalH);
    ctx.stroke();

    if (showScissorIcon) {
      ctx.fillStyle = cutLineColor;
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Top icon
      ctx.fillText('✂', dividerX, 26);
      // Center icon
      ctx.fillText('✂', dividerX, Math.floor(totalH / 2));
      // Bottom icon
      ctx.fillText('✂', dividerX, totalH - 26);
    }

    ctx.restore();
  }

  return canvas.toDataURL('image/png', 0.95);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function getFilterCss(filter: PhotoFilter): string {
  switch (filter) {
    case 'warm-sore':
      return 'sepia(0.22) saturate(1.25) contrast(1.06) brightness(1.02)';
    case 'noir-bw':
      return 'grayscale(1) contrast(1.22) brightness(1.03)';
    case 'vintage-film':
      return 'sepia(0.35) contrast(0.95) brightness(1.04) saturate(0.85)';
    case 'original':
    default:
      return 'none';
  }
}

export async function compositeFinalLayout(
  capturedPhotos: string[],
  frame: FrameMetadata,
  filter: PhotoFilter = 'original',
  customCaption = 'SOREAJA — PHOTOBOX 2',
  showStamps = true,
  themeColor?: string
): Promise<string> {
  const maxRight = Math.max(...frame.positions.map((p) => p.x + p.width));
  const maxBottom = Math.max(...frame.positions.map((p) => p.y + p.height));

  const canvasWidth = frame.canvasWidth || maxRight + 50;
  const canvasHeight = frame.canvasHeight || maxBottom + 120;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const isDark =
    frame.theme === 'dark' ||
    frame.theme === 'Dark Minimalist' ||
    frame.id === 'sunday-3-photo';
  const isWarm = frame.theme === 'warm';

  // 1. Base background fill
  ctx.fillStyle = isDark ? '#121214' : isWarm ? '#FAF3E8' : '#F6F4EE';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. Draw each captured photo into its exact slot from frame.positions
  for (let i = 0; i < frame.positions.length; i++) {
    const pos = frame.positions[i];
    const photoSrc = capturedPhotos[i] || capturedPhotos[0];
    if (!photoSrc) continue;

    try {
      const img = await loadImage(photoSrc);
      ctx.save();
      ctx.beginPath();
      ctx.rect(pos.x, pos.y, pos.width, pos.height);
      ctx.clip();

      ctx.filter = getFilterCss(filter);

      // Center crop (object-fit: cover)
      const imgAspect = img.width / img.height;
      const slotAspect = pos.width / pos.height;
      let sx = 0,
        sy = 0,
        sw = img.width,
        sh = img.height;

      if (imgAspect > slotAspect) {
        sw = img.height * slotAspect;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / slotAspect;
        sy = (img.height - sh) / 2;
      }

      ctx.drawImage(img, sx, sy, sw, sh, pos.x, pos.y, pos.width, pos.height);
      ctx.restore();
    } catch (err) {
      console.warn(`Failed to draw photo slot ${i}:`, err);
    }
  }

  // 3. Draw the Frame PNG overlay (with transparent cutouts at frame.positions)
  if (frame.frameImg) {
    try {
      const frameImage = await loadImage(frame.frameImg);
      ctx.drawImage(frameImage, 0, 0, canvasWidth, canvasHeight);
    } catch (err) {
      console.warn('Frame overlay image fallback to vector frame border:', err);
    }
  }

  // 4. Crisp Studio Typography Stamp (Top Header & Bottom Editorial Footer) - Only if showStamps is enabled and not a custom stamped/illustrated frame
  if (showStamps && !frame.hideGenericStamps && frame.id !== 'frame_005' && frame.id !== 'sunday-3-photo') {
    const textColor = isDark ? '#F4F4F0' : '#18181B';
    const mutedColor = isDark ? '#A1A1AA' : '#52525B';
    const accentColor = themeColor || (isWarm ? '#C2410C' : '#E11D48');

    // Top Header Metadata
    ctx.fillStyle = textColor;
    ctx.font = '700 18px "Syne", sans-serif';
    ctx.fillText('SOREAJA — PHOTOBOX 2', 50, 72);

    ctx.fillStyle = mutedColor;
    ctx.font = '500 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(frame.id.toUpperCase().replace('_', ' · '), canvasWidth - 50, 72);

    // Bottom Editorial Footer
    ctx.textAlign = 'left';
    ctx.fillStyle = textColor;
    ctx.font = '700 20px "Syne", sans-serif';
    const captionText = (customCaption || 'SOREAJA — PHOTOBOX 2').toUpperCase();
    ctx.fillText(captionText, 50, canvasHeight - 34);

    const dateStr = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    ctx.textAlign = 'right';
    ctx.fillStyle = accentColor;
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.fillText(`${dateStr.toUpperCase()} · STUDIO PRINT`, canvasWidth - 50, canvasHeight - 34);
  }

  return canvas.toDataURL('image/png', 0.95);
}

export interface CompositeLayoutBundle {
  singleStrip: string;
  doubleStrip: string | null;
  ratioInfo: StripRatioInfo;
}

export async function compositeFinalLayoutBundle(
  capturedPhotos: string[],
  frame: FrameMetadata,
  filter: PhotoFilter = 'original',
  customCaption = 'SOREAJA — PHOTOBOX 2',
  showStamps = true,
  themeColor?: string,
  doubleStripOptions?: DoubleStripOptions
): Promise<CompositeLayoutBundle> {
  const maxRight = Math.max(...frame.positions.map((p) => p.x + p.width));
  const maxBottom = Math.max(...frame.positions.map((p) => p.y + p.height));
  const canvasWidth = frame.canvasWidth || maxRight + 50;
  const canvasHeight = frame.canvasHeight || maxBottom + 120;

  const ratioInfo = checkStripRatio(canvasWidth, canvasHeight);

  // 1. Generate Single Strip Base64
  const singleStrip = await compositeFinalLayout(
    capturedPhotos,
    frame,
    filter,
    customCaption,
    showStamps,
    themeColor
  );

  // 2. If it is a vertical long strip, generate image with side by side of 2 strip
  let doubleStrip: string | null = null;
  if (ratioInfo.isVerticalLongStrip && singleStrip) {
    try {
      doubleStrip = await generateSideBySideStrip(singleStrip, doubleStripOptions);
    } catch (err) {
      console.warn('Failed to generate side-by-side double strip:', err);
    }
  }

  return {
    singleStrip,
    doubleStrip,
    ratioInfo,
  };
}
