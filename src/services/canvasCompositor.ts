import type { FrameMetadata, PhotoFilter, StripRatioInfo, PlacedSticker } from '../types/photobox';

export { type StripRatioInfo, type PlacedSticker };

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

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, totalW, totalH);

  // 1. Draw Left Strip
  ctx.drawImage(img, 0, 0, singleW, singleH);

  // 2. Draw Right Strip (Duplicate side-by-side)
  ctx.drawImage(img, singleW + spacing, 0, singleW, singleH);

  // Dynamic scale factor relative to 1795 baseline height
  const S = Math.max(1, singleH / 1795);

  // 3. Center Cutting Guide & Outer Dotted Border
  if (includeCutLine) {
    drawDottedCutBorder(ctx, totalW, totalH, S);

    const dividerX = singleW + Math.floor(spacing / 2);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Pass 1: High-contrast white backing stroke to ensure visibility on dark frames
    ctx.beginPath();
    ctx.setLineDash([Math.round(14 * S), Math.round(10 * S)]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
    ctx.lineWidth = Math.max(3, Math.round(5 * S));
    ctx.moveTo(dividerX, 0);
    ctx.lineTo(dividerX, totalH);
    ctx.stroke();

    // Pass 2: Bold dark charcoal core stroke to ensure visibility on light frames
    ctx.beginPath();
    ctx.setLineDash([Math.round(14 * S), Math.round(10 * S)]);
    ctx.strokeStyle = 'rgba(9, 9, 11, 0.98)';
    ctx.lineWidth = Math.max(2, Math.round(3 * S));
    ctx.moveTo(dividerX, 0);
    ctx.lineTo(dividerX, totalH);
    ctx.stroke();

    if (showScissorIcon) {
      // Draw 3 prominent circular scissor badges (top, center, bottom)
      const badgeYPositions = [
        Math.min(Math.round(48 * S), Math.floor(totalH * 0.05)),
        Math.floor(totalH / 2),
        Math.max(totalH - Math.round(48 * S), Math.floor(totalH * 0.95)),
      ];

      const radius = Math.round(18 * S);
      for (const y of badgeYPositions) {
        ctx.save();
        // Circular white badge with dark ring and shadow
        ctx.beginPath();
        ctx.arc(dividerX, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = Math.round(8 * S);
        ctx.shadowOffsetY = Math.round(2 * S);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.lineWidth = Math.max(2, Math.round(2.5 * S));
        ctx.strokeStyle = '#09090B';
        ctx.stroke();

        // Bold scissor glyph
        ctx.fillStyle = '#09090B';
        ctx.font = `bold ${Math.round(20 * S)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✂', dividerX, y + Math.round(1 * S));
        ctx.restore();
      }
    }

    ctx.restore();
  }

  return canvas.toDataURL('image/png');
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
    case 'korean-clean':
      return 'contrast(1.14) brightness(1.08) saturate(1.15)';
    case 'warm-sore':
      return 'contrast(1.15) brightness(1.04) saturate(1.28) sepia(0.18)';
    case 'fuji-film':
      return 'contrast(1.18) brightness(1.04) saturate(1.20) sepia(0.08) hue-rotate(-6deg)';
    case 'noir-bw':
      return 'grayscale(1) contrast(1.35) brightness(1.04)';
    case 'vintage-film':
      return 'contrast(1.14) brightness(1.04) saturate(0.95) sepia(0.28)';
    case 'original':
    default:
      return 'contrast(1.12) brightness(1.02) saturate(1.08)';
  }
}

export async function compositeFinalLayout(
  capturedPhotos: string[],
  frame: FrameMetadata,
  filter: PhotoFilter = 'original',
  customCaption = 'SOREAJA — Pose',
  showStamps = true,
  themeColor?: string,
  placedStickers: PlacedSticker[] = [],
  scaleFactor = 2.0
): Promise<string> {
  const maxRight = Math.max(...frame.positions.map((p) => p.x + p.width));
  const maxBottom = Math.max(...frame.positions.map((p) => p.y + p.height));

  const baseWidth = frame.canvasWidth || maxRight + 50;
  const baseHeight = frame.canvasHeight || maxBottom + 120;
  const S = scaleFactor > 0 ? scaleFactor : 1.0;
  const canvasWidth = Math.round(baseWidth * S);
  const canvasHeight = Math.round(baseHeight * S);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const isDark =
    frame.theme === 'dark' ||
    frame.theme === 'Dark Minimalist' ||
    frame.id === 'sunday-3-photo';
  const isWarm = frame.theme === 'warm';

  // 1. Base background fill - pitch black #09090B for dark frames, crisp clean paper #FAF9F5 for light
  ctx.fillStyle = isDark ? '#09090B' : isWarm ? '#FAF3E8' : '#FAF9F5';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. Draw each captured photo into its exact slot from frame.positions (scaled by S)
  for (let i = 0; i < frame.positions.length; i++) {
    const rawPos = frame.positions[i];
    const pos = {
      x: Math.round(rawPos.x * S),
      y: Math.round(rawPos.y * S),
      width: Math.round(rawPos.width * S),
      height: Math.round(rawPos.height * S),
    };
    const photoSrc = capturedPhotos[i] || capturedPhotos[0];
    if (!photoSrc) continue;

    try {
      const img = await loadImage(photoSrc);
      ctx.save();
      ctx.beginPath();
      ctx.rect(pos.x, pos.y, pos.width, pos.height);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

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
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(frameImage, 0, 0, canvasWidth, canvasHeight);
      ctx.restore();
    } catch (err) {
      console.warn('Frame overlay image fallback to vector frame border:', err);
    }
  }

  // 4. Crisp Studio Typography Stamp (Top Header & Bottom Editorial Footer)
  if (showStamps && !frame.hideGenericStamps && frame.id !== 'frame_005' && frame.id !== 'sunday-3-photo') {
    const textColor = isDark ? '#F4F4F0' : '#18181B';
    const mutedColor = isDark ? '#A1A1AA' : '#52525B';
    const accentColor = themeColor || (isWarm ? '#C2410C' : '#E11D48');

    ctx.save();
    ctx.fillStyle = mutedColor;
    ctx.font = `500 ${Math.round(12 * S)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(frame.id.toUpperCase().replace('_', ' · '), canvasWidth - Math.round(50 * S), Math.round(72 * S));

    // Bottom Editorial Footer
    ctx.textAlign = 'left';
    ctx.fillStyle = textColor;
    ctx.font = `700 ${Math.round(20 * S)}px "Syne", sans-serif`;
    const captionText = (customCaption || 'SOREAJA — PHOTOBOX 2').toUpperCase();
    ctx.fillText(captionText, Math.round(50 * S), canvasHeight - Math.round(34 * S));

    const dateStr = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    ctx.textAlign = 'right';
    ctx.fillStyle = accentColor;
    ctx.font = `600 ${Math.round(13 * S)}px "JetBrains Mono", monospace`;
    ctx.fillText(`${dateStr.toUpperCase()} · STUDIO PRINT`, canvasWidth - Math.round(50 * S), canvasHeight - Math.round(34 * S));
    ctx.restore();
  }

  // 5. Draw Placed Interactive Stickers
  if (placedStickers && placedStickers.length > 0) {
    for (const sticker of placedStickers) {
      const sx = sticker.x * canvasWidth;
      const sy = sticker.y * canvasHeight;
      const baseSize = canvasWidth * 0.15;
      const size = baseSize * (sticker.scale || 1.0);

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(sx, sy);
      if (sticker.rotation) {
        ctx.rotate((sticker.rotation * Math.PI) / 180);
      }

      if (sticker.type === 'emoji') {
        ctx.font = `${Math.round(size)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = Math.round(8 * S);
        ctx.shadowOffsetY = Math.round(4 * S);
        ctx.fillText(sticker.content, 0, 0);
      } else if (sticker.type === 'image') {
        try {
          const img = await loadImage(sticker.content);
          const r = size / 2;

          // Circular background with drop shadow
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
          ctx.shadowBlur = Math.round(12 * S);
          ctx.shadowOffsetY = Math.round(4 * S);
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = '#481216';
          ctx.fill();
          ctx.restore();

          // Circular clipped image
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, -r, -r, size, size);
          ctx.restore();

          // Crisp circular border outline
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.lineWidth = Math.max(3 * S, Math.round(size * 0.04));
          ctx.strokeStyle = '#FFFFFF';
          ctx.stroke();
          ctx.restore();
        } catch (err) {
          console.warn('Failed to draw image sticker to canvas:', err);
        }
      } else {
        // Stamp / Badge
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const fontSize = Math.round(size * 0.32);
        ctx.font = `800 ${fontSize}px "Syne", sans-serif`;
        const textMetrics = ctx.measureText(sticker.content);
        const padX = fontSize * 0.85;
        const padY = fontSize * 0.45;
        const badgeW = textMetrics.width + padX * 2;
        const badgeH = fontSize + padY * 2;
        const radius = Math.round(size * 0.12);

        ctx.fillStyle = themeColor || '#E11D48';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = Math.round(10 * S);
        ctx.shadowOffsetY = Math.round(4 * S);
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, radius);
        } else {
          ctx.rect(-badgeW / 2, -badgeH / 2, badgeW, badgeH);
        }
        ctx.fill();

        ctx.lineWidth = Math.max(2 * S, Math.round(size * 0.04));
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'transparent';
        ctx.fillText(sticker.content, 0, 1 * S);
      }
      ctx.restore();
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Draws a high-contrast dual-pass dotted cutting guide inset along the outer border
 * so printed paper edges remain clearly trimmable on both dark and light frame themes.
 */
function drawDottedCutBorder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scaleFactor = 1
): void {
  const S = Math.max(1, scaleFactor);
  const inset = Math.max(4, Math.round(6 * S));
  const rectW = Math.max(1, width - inset * 2);
  const rectH = Math.max(1, height - inset * 2);
  const dashPattern = [Math.max(2, Math.round(2 * S)), Math.max(10, Math.round(14 * S))];

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Pass 1: White backing dots for high contrast on dark frames
  ctx.beginPath();
  ctx.setLineDash(dashPattern);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.lineWidth = Math.max(3, Math.round(5 * S));
  ctx.strokeRect(inset, inset, rectW, rectH);

  // Pass 2: Dark charcoal core dots for high contrast on light frames / paper edges
  ctx.beginPath();
  ctx.setLineDash(dashPattern);
  ctx.strokeStyle = 'rgba(24, 24, 27, 0.94)';
  ctx.lineWidth = Math.max(2, Math.round(3 * S));
  ctx.strokeRect(inset, inset, rectW, rectH);

  ctx.restore();
}

/**
 * Applies the outer dotted cutting border onto an existing rendered print image.
 */
async function addOuterCutBorderToImage(imageBase64: string): Promise<string> {
  if (!imageBase64) return imageBase64;
  const img = await loadImage(imageBase64);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageBase64;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0);

  const S = Math.max(1, img.height / 1795);
  drawDottedCutBorder(ctx, img.width, img.height, S);

  return canvas.toDataURL('image/png');
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
  doubleStripOptions?: DoubleStripOptions,
  placedStickers: PlacedSticker[] = [],
  scaleFactor = 2.0
): Promise<CompositeLayoutBundle> {
  const maxRight = Math.max(...frame.positions.map((p) => p.x + p.width));
  const maxBottom = Math.max(...frame.positions.map((p) => p.y + p.height));
  const canvasWidth = frame.canvasWidth || maxRight + 50;
  const canvasHeight = frame.canvasHeight || maxBottom + 120;

  const ratioInfo = checkStripRatio(canvasWidth, canvasHeight);

  // 1. Generate clean Single Strip Base64 with Placed Stickers at full master resolution
  const rawSingleStrip = await compositeFinalLayout(
    capturedPhotos,
    frame,
    filter,
    customCaption,
    showStamps,
    themeColor,
    placedStickers,
    scaleFactor
  );

  // 2. If it is a vertical long strip, generate image with side by side of 2 strip (from un-bordered source)
  let doubleStrip: string | null = null;
  if (ratioInfo.isVerticalLongStrip && rawSingleStrip) {
    try {
      doubleStrip = await generateSideBySideStrip(rawSingleStrip, doubleStripOptions);
    } catch (err) {
      console.warn('Failed to generate side-by-side double strip:', err);
    }
  }

  // 3. Apply outer dotted cut border onto singleStrip when cut line is enabled
  let singleStrip = rawSingleStrip;
  if (doubleStripOptions?.includeCutLine !== false && rawSingleStrip) {
    try {
      singleStrip = await addOuterCutBorderToImage(rawSingleStrip);
    } catch (err) {
      console.warn('Failed to apply outer cut border to single strip:', err);
    }
  }

  return {
    singleStrip,
    doubleStrip,
    ratioInfo,
  };
}
