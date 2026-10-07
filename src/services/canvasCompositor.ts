import type { FrameMetadata, PhotoFilter } from '../types/photobox';

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

  const isDark = frame.theme === 'dark';
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
  if (showStamps && !frame.hideGenericStamps && frame.id !== 'frame_005') {
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
