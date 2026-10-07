import fs from 'fs';
import zlib from 'zlib';

// Minimal RGBA PNG encoder using Node built-in zlib
function encodePNG(width, height, rgbaData) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const combined = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(combined), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter type None
    rgbaData.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }

  const idatData = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idatData),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Generates the Pasar Sejati - Car Free Day frame
 * @param {boolean} isPreview - true for preview with yellow slots, false for transparent cutouts
 */
function generatePasarSejatiBuffer(isPreview) {
  const width = 480;
  const height = 1440;
  const buf = Buffer.alloc(width * height * 4);

  const setPixel = (x, y, r, g, b, a = 255) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    if (a === 255) {
      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = a;
    } else if (a > 0) {
      const srcA = a / 255;
      const dstA = buf[idx + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA > 0) {
        buf[idx] = Math.round((r * srcA + buf[idx] * dstA * (1 - srcA)) / outA);
        buf[idx + 1] = Math.round((g * srcA + buf[idx + 1] * dstA * (1 - srcA)) / outA);
        buf[idx + 2] = Math.round((b * srcA + buf[idx + 2] * dstA * (1 - srcA)) / outA);
        buf[idx + 3] = Math.round(outA * 255);
      }
    } else {
      // Clear pixel
      buf[idx] = 0;
      buf[idx + 1] = 0;
      buf[idx + 2] = 0;
      buf[idx + 3] = 0;
    }
  };

  const fillCircle = (cx, cy, radius, r, g, b, a = 255) => {
    const r2 = radius * radius;
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(width - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(height - 1, Math.ceil(cy + radius));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist2 = dx * dx + dy * dy;
        if (dist2 <= r2) {
          // Antialiasing on outer 1px
          const dist = Math.sqrt(dist2);
          const edgeAlpha = Math.max(0, Math.min(1, radius + 0.5 - dist));
          setPixel(x, y, r, g, b, Math.round(a * edgeAlpha));
        }
      }
    }
  };

  const fillRect = (x1, y1, w, h, r, g, b, a = 255) => {
    for (let y = y1; y < y1 + h; y++) {
      for (let x = x1; x < x1 + w; x++) {
        setPixel(x, y, r, g, b, a);
      }
    }
  };

  // 1. Fill Deep Crimson Background (#8F1B22)
  const bgR = 143, bgG = 27, bgB = 34;
  fillRect(0, 0, width, height, bgR, bgG, bgB, 255);

  // Halftone dots in top and bottom background corners
  const dotR = 105, dotG = 15, dotB = 21;
  // Top halftone area
  for (let gy = 0; gy < 180; gy += 14) {
    for (let gx = 0; gx < width; gx += 14) {
      if (gx < 140 || gy < 90 || gx > width - 100) {
        fillCircle(gx + (gy % 28 === 0 ? 0 : 7), gy, 3.5, dotR, dotG, dotB, 180);
      }
    }
  }
  // Bottom halftone area
  for (let gy = 1260; gy < height; gy += 14) {
    for (let gx = 0; gx < width; gx += 14) {
      fillCircle(gx + (gy % 28 === 0 ? 0 : 7), gy, 4, dotR, dotG, dotB, 200);
    }
  }

  // 2. White Scalloped Postage Stamp Card
  const stampLeft = 24;
  const stampRight = 456;
  const stampTop = 32;
  const stampBottom = 1290;
  const scallopR = 8.5;
  const scallopStep = 22;

  // Fill main white inner rectangle
  fillRect(stampLeft, stampTop, stampRight - stampLeft, stampBottom - stampTop, 255, 255, 255, 255);

  // Cut semicircles along the 4 edges to create scalloped postage stamp perforations
  // Left & Right edges
  for (let y = stampTop + 14; y < stampBottom - 5; y += scallopStep) {
    fillCircle(stampLeft, y, scallopR, bgR, bgG, bgB, 255);
    fillCircle(stampRight, y, scallopR, bgR, bgG, bgB, 255);
  }
  // Top & Bottom edges
  for (let x = stampLeft + 14; x < stampRight - 5; x += scallopStep) {
    fillCircle(x, stampTop, scallopR, bgR, bgG, bgB, 255);
    fillCircle(x, stampBottom, scallopR, bgR, bgG, bgB, 255);
  }

  // 3. The 3 Photo Slots
  const slotW = 380;
  const slotH = 265;
  const slotX = (width - slotW) / 2; // 50
  const slots = [
    { x: slotX, y: 68, w: slotW, h: slotH },
    { x: slotX, y: 360, w: slotW, h: slotH },
    { x: slotX, y: 652, w: slotW, h: slotH },
  ];

  for (const s of slots) {
    if (isPreview) {
      // Warm yellow/mustard placeholder (#FDCB58)
      fillRect(s.x, s.y, s.w, s.h, 253, 203, 88, 255);
    } else {
      // Transparent cutout for final compositing
      for (let y = s.y; y < s.y + s.h; y++) {
        for (let x = s.x; x < s.x + s.w; x++) {
          const idx = (y * width + x) * 4;
          buf[idx] = 0;
          buf[idx + 1] = 0;
          buf[idx + 2] = 0;
          buf[idx + 3] = 0;
        }
      }
    }
  }

  // 4. Dotted separator line below Slot 3
  const dotSepY = 948;
  const dotCount = 14;
  const dotStartX = 42;
  const dotEndX = 438;
  const dotSpacing = (dotEndX - dotStartX) / (dotCount - 1);
  for (let i = 0; i < dotCount; i++) {
    fillCircle(dotStartX + i * dotSpacing, dotSepY, 4.5, bgR, bgG, bgB, 255);
  }

  // 5. Typography on the white card
  // Helper to render letter shapes / bitmap strokes
  const drawLine = (x0, y0, x1, y1, thickness, r, g, b, a = 255) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist * 2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      fillCircle(x0 + dx * t, y0 + dy * t, thickness / 2, r, g, b, a);
    }
  };

  // Car Free Day script
  // Render "Car Free Day" in smooth cursive script
  const textDarkR = 17, textDarkG = 17, textDarkB = 17;

  // Draw "Car Free Day" cursive lettering
  const drawCarFreeDay = (cx, cy) => {
    // Stylized cursive script strokes around cx=240, cy=995
    // 'C'
    drawLine(cx - 95, cy - 8, cx - 105, cy - 2, 2.5, textDarkR, textDarkG, textDarkB);
    drawLine(cx - 105, cy - 2, cx - 110, cy + 8, 3, textDarkR, textDarkG, textDarkB);
    drawLine(cx - 110, cy + 8, cx - 98, cy + 14, 2.5, textDarkR, textDarkG, textDarkB);
    drawLine(cx - 98, cy + 14, cx - 88, cy + 8, 2.5, textDarkR, textDarkG, textDarkB);
    // 'a'
    fillCircle(cx - 80, cy + 8, 5, textDarkR, textDarkG, textDarkB);
    fillCircle(cx - 80, cy + 8, 3, 255, 255, 255);
    drawLine(cx - 75, cy + 3, cx - 74, cy + 13, 2.5, textDarkR, textDarkG, textDarkB);
    // 'r'
    drawLine(cx - 68, cy + 4, cx - 68, cy + 13, 2.5, textDarkR, textDarkG, textDarkB);
    drawLine(cx - 68, cy + 5, cx - 60, cy + 4, 2.5, textDarkR, textDarkG, textDarkB);

    // 'F'
    drawLine(cx - 40, cy - 12, cx - 45, cy + 14, 3, textDarkR, textDarkG, textDarkB);
    drawLine(cx - 52, cy - 10, cx - 30, cy - 10, 2.5, textDarkR, textDarkG, textDarkB);
    drawLine(cx - 48, cy + 2, cx - 35, cy + 2, 2.5, textDarkR, textDarkG, textDarkB);
    // 'r'
    drawLine(cx - 25, cy + 4, cx - 25, cy + 13, 2.5, textDarkR, textDarkG, textDarkB);
    drawLine(cx - 25, cy + 5, cx - 18, cy + 4, 2.5, textDarkR, textDarkG, textDarkB);
    // 'e'
    fillCircle(cx - 10, cy + 8, 4.5, textDarkR, textDarkG, textDarkB);
    fillCircle(cx - 10, cy + 8, 2.5, 255, 255, 255);
    drawLine(cx - 14, cy + 8, cx - 5, cy + 8, 2, textDarkR, textDarkG, textDarkB);
    // 'e'
    fillCircle(cx + 2, cy + 8, 4.5, textDarkR, textDarkG, textDarkB);
    fillCircle(cx + 2, cy + 8, 2.5, 255, 255, 255);
    drawLine(cx - 2, cy + 8, cx + 7, cy + 8, 2, textDarkR, textDarkG, textDarkB);

    // 'D'
    drawLine(cx + 25, cy - 10, cx + 24, cy + 14, 3, textDarkR, textDarkG, textDarkB);
    drawLine(cx + 24, cy - 10, cx + 38, cy - 3, 3, textDarkR, textDarkG, textDarkB);
    drawLine(cx + 38, cy - 3, cx + 42, cy + 4, 3, textDarkR, textDarkG, textDarkB);
    drawLine(cx + 42, cy + 4, cx + 24, cy + 14, 3, textDarkR, textDarkG, textDarkB);
    // 'a'
    fillCircle(cx + 52, cy + 8, 5, textDarkR, textDarkG, textDarkB);
    fillCircle(cx + 52, cy + 8, 3, 255, 255, 255);
    drawLine(cx + 57, cy + 3, cx + 58, cy + 13, 2.5, textDarkR, textDarkG, textDarkB);
    // 'y'
    drawLine(cx + 66, cy + 4, cx + 72, cy + 13, 2.5, textDarkR, textDarkG, textDarkB);
    drawLine(cx + 78, cy + 4, cx + 67, cy + 22, 2.5, textDarkR, textDarkG, textDarkB);
    drawLine(cx + 67, cy + 22, cx + 62, cy + 20, 2.5, textDarkR, textDarkG, textDarkB);
  };
  drawCarFreeDay(240, 995);

  // Pasar Sejati - Bold Vintage Calligraphic Script
  const drawPasarSejati = (cx, cy) => {
    // "Pasar"
    // 'P'
    drawLine(cx - 88, cy - 26, cx - 94, cy + 20, 5, textDarkR, textDarkG, textDarkB);
    fillCircle(cx - 72, cy - 10, 14, textDarkR, textDarkG, textDarkB);
    fillCircle(cx - 72, cy - 10, 7, 255, 255, 255);
    drawLine(cx - 92, cy - 24, cx - 74, cy - 24, 4, textDarkR, textDarkG, textDarkB);
    // 'a'
    fillCircle(cx - 48, cy + 5, 11, textDarkR, textDarkG, textDarkB);
    fillCircle(cx - 48, cy + 5, 5, 255, 255, 255);
    drawLine(cx - 39, cy - 3, cx - 38, cy + 15, 4.5, textDarkR, textDarkG, textDarkB);
    // 's'
    drawLine(cx - 24, cy - 2, cx - 15, cy - 1, 4, textDarkR, textDarkG, textDarkB);
    drawLine(cx - 24, cy - 2, cx - 25, cy + 6, 4, textDarkR, textDarkG, textDarkB);
    drawLine(cx - 25, cy + 6, cx - 14, cy + 10, 4, textDarkR, textDarkG, textDarkB);
    drawLine(cx - 14, cy + 10, cx - 17, cy + 16, 4, textDarkR, textDarkG, textDarkB);
    drawLine(cx - 17, cy + 16, cx - 26, cy + 15, 4, textDarkR, textDarkG, textDarkB);
    // 'a'
    fillCircle(cx - 2, cy + 5, 11, textDarkR, textDarkG, textDarkB);
    fillCircle(cx - 2, cy + 5, 5, 255, 255, 255);
    drawLine(cx + 7, cy - 3, cx + 8, cy + 15, 4.5, textDarkR, textDarkG, textDarkB);
    // 'r'
    drawLine(cx + 18, cy - 2, cx + 18, cy + 15, 4.5, textDarkR, textDarkG, textDarkB);
    drawLine(cx + 18, cy + 1, cx + 32, cy - 2, 4, textDarkR, textDarkG, textDarkB);
    fillCircle(cx + 32, cy - 2, 3, textDarkR, textDarkG, textDarkB);

    // "Sejati" (Line 2 below Pasar)
    const cy2 = cy + 56;
    // 'S'
    drawLine(cx - 75, cy2 - 20, cx - 55, cy2 - 22, 5, textDarkR, textDarkG, textDarkB);
    drawLine(cx - 75, cy2 - 20, cx - 80, cy2 - 6, 6, textDarkR, textDarkG, textDarkB);
    drawLine(cx - 80, cy2 - 6, cx - 52, cy2 + 2, 5.5, textDarkR, textDarkG, textDarkB);
    drawLine(cx - 52, cy2 + 2, cx - 60, cy2 + 16, 6, textDarkR, textDarkG, textDarkB);
    drawLine(cx - 60, cy2 + 16, cx - 85, cy2 + 12, 5, textDarkR, textDarkG, textDarkB);
    // 'e'
    fillCircle(cx - 36, cy2 + 6, 10, textDarkR, textDarkG, textDarkB);
    fillCircle(cx - 36, cy2 + 6, 4.5, 255, 255, 255);
    drawLine(cx - 44, cy2 + 6, cx - 28, cy2 + 6, 4, textDarkR, textDarkG, textDarkB);
    // 'j'
    drawLine(cx - 15, cy2 - 1, cx - 16, cy2 + 25, 4.5, textDarkR, textDarkG, textDarkB);
    drawLine(cx - 16, cy2 + 25, cx - 26, cy2 + 28, 4, textDarkR, textDarkG, textDarkB);
    fillCircle(cx - 14, cy2 - 10, 3, textDarkR, textDarkG, textDarkB);
    // 'a'
    fillCircle(cx + 5, cy2 + 6, 11, textDarkR, textDarkG, textDarkB);
    fillCircle(cx + 5, cy2 + 6, 5, 255, 255, 255);
    drawLine(cx + 14, cy2 - 2, cx + 15, cy2 + 16, 4.5, textDarkR, textDarkG, textDarkB);
    // 't'
    drawLine(cx + 28, cy2 - 12, cx + 29, cy2 + 16, 4.5, textDarkR, textDarkG, textDarkB);
    drawLine(cx + 20, cy2 - 2, cx + 38, cy2 - 2, 3.5, textDarkR, textDarkG, textDarkB);
    drawLine(cx + 29, cy2 + 16, cx + 36, cy2 + 14, 3.5, textDarkR, textDarkG, textDarkB);
    // 'i'
    drawLine(cx + 46, cy2 - 2, cx + 47, cy2 + 16, 4.5, textDarkR, textDarkG, textDarkB);
    fillCircle(cx + 46, cy2 - 10, 3, textDarkR, textDarkG, textDarkB);
  };
  drawPasarSejati(240, 1060);

  // Draw hearts and "@soreaja.id"
  const drawHeart = (hx, hy, size) => {
    fillCircle(hx - size * 0.4, hy - size * 0.3, size * 0.45, textDarkR, textDarkG, textDarkB);
    fillCircle(hx + size * 0.4, hy - size * 0.3, size * 0.45, textDarkR, textDarkG, textDarkB);
    for (let r = 0; r < size; r++) {
      const halfW = (size - r) * 0.75;
      drawLine(hx - halfW, hy + r * 0.7, hx + halfW, hy + r * 0.7, 2, textDarkR, textDarkG, textDarkB);
    }
  };

  const drawHandle = (cx, cy) => {
    drawHeart(cx - 80, cy, 7);
    drawHeart(cx + 80, cy, 7);

    // "@soreaja.id" text stroke representation
    const textStr = "@soreaja.id";
    let curX = cx - 58;
    for (let ch of textStr) {
      if (ch === '@') {
        fillCircle(curX + 6, cy - 2, 7, textDarkR, textDarkG, textDarkB);
        fillCircle(curX + 6, cy - 2, 4.5, 255, 255, 255);
        fillCircle(curX + 6, cy - 2, 2.5, textDarkR, textDarkG, textDarkB);
        curX += 16;
      } else if (ch === '.') {
        fillCircle(curX + 2, cy + 3, 2, textDarkR, textDarkG, textDarkB);
        curX += 8;
      } else {
        drawLine(curX, cy - 6, curX, cy + 4, 2, textDarkR, textDarkG, textDarkB);
        drawLine(curX, cy - 6, curX + 7, cy - 6, 2, textDarkR, textDarkG, textDarkB);
        drawLine(curX + 7, cy - 6, curX + 7, cy + 4, 2, textDarkR, textDarkG, textDarkB);
        curX += 11;
      }
    }
  };
  drawHandle(240, 1225);

  // 6. Bottom Barcode Stripes on Red Background
  const barY = 1335;
  const barH = 105;
  const stripeW = 10;
  const stripeGap = 16;
  const stripeCount = 14;
  const stripeStartX = (width - ((stripeCount - 1) * stripeGap + stripeW)) / 2; // ~130
  for (let i = 0; i < stripeCount; i++) {
    fillRect(stripeStartX + i * stripeGap, barY, stripeW, barH, 255, 255, 255, 255);
  }

  // 7. Sticker 1: Vintage Film Camera (Top Left)
  const drawCameraSticker = (camX, camY) => {
    // White die-cut outline background
    fillRect(camX - 6, camY - 6, 142, 98, 255, 255, 255, 255);
    fillCircle(camX + 65, camY + 45, 34, 255, 255, 255, 255);

    // Camera body (black and textured silver)
    fillRect(camX, camY, 130, 86, 25, 25, 28, 255);
    fillRect(camX + 10, camY + 8, 110, 20, 190, 192, 195, 255); // Top plate

    // Shutter button & dials
    fillRect(camX + 18, camY - 5, 12, 6, 170, 172, 175, 255);
    fillRect(camX + 96, camY - 5, 16, 6, 170, 172, 175, 255);

    // Viewfinder
    fillRect(camX + 22, camY + 12, 12, 9, 40, 40, 45, 255);

    // Textured leatherette grip pattern
    for (let py = camY + 32; py < camY + 80; py += 3) {
      for (let px = camX + 8; px < camX + 122; px += 3) {
        if (Math.hypot(px - (camX + 65), py - (camY + 45)) > 26) {
          setPixel(px, py, 45, 45, 50, 255);
        }
      }
    }

    // Lens assembly
    fillCircle(camX + 65, camY + 45, 26, 160, 162, 165, 255); // Outer silver ring
    fillCircle(camX + 65, camY + 45, 22, 25, 25, 28, 255);   // Lens barrel
    fillCircle(camX + 65, camY + 45, 16, 50, 52, 60, 255);   // Inner glass
    fillCircle(camX + 60, camY + 40, 7, 100, 110, 125, 255); // Lens reflection highlight
    fillCircle(camX + 58, camY + 38, 3, 240, 245, 255, 255);
  };
  drawCameraSticker(18, 14);

  // 8. Sticker 2: Hands Making Heart (Right side between Slot 1 and 2)
  const drawHeartHandsSticker = (hx, hy) => {
    // White sticker die cut outline
    fillCircle(hx + 50, hy + 28, 52, 255, 255, 255, 255);
    fillCircle(hx + 90, hy + 28, 48, 255, 255, 255, 255);
    fillCircle(hx + 130, hy + 38, 42, 255, 255, 255, 255);

    // Photographic Halftone Hands
    // Left hand forming half heart
    drawLine(hx + 20, hy + 45, hx + 50, hy + 10, 14, 180, 180, 180, 255);
    drawLine(hx + 50, hy + 10, hx + 75, hy + 14, 12, 150, 150, 150, 255);
    drawLine(hx + 75, hy + 14, hx + 65, hy + 34, 12, 120, 120, 120, 255);

    // Right hand forming other half heart
    drawLine(hx + 150, hy + 45, hx + 115, hy + 10, 14, 180, 180, 180, 255);
    drawLine(hx + 115, hy + 10, hx + 90, hy + 14, 12, 150, 150, 150, 255);
    drawLine(hx + 90, hy + 14, hx + 100, hy + 34, 12, 120, 120, 120, 255);

    // Thumbs meeting at bottom
    drawLine(hx + 65, hy + 34, hx + 82, hy + 42, 10, 100, 100, 100, 255);
    drawLine(hx + 100, hy + 34, hx + 82, hy + 42, 10, 100, 100, 100, 255);

    // Halftone shading dots across hands
    for (let py = hy; py < hy + 60; py += 3) {
      for (let px = hx + 10; px < hx + 160; px += 3) {
        if ((px + py) % 4 === 0) {
          fillCircle(px, py, 1.2, 50, 50, 55, 180);
        }
      }
    }
  };
  drawHeartHandsSticker(270, 310);

  // 9. Sticker 3: Jasmine Flower (Left side between Slot 2 and 3)
  const drawFlowerSticker = (fx, fy) => {
    // White sticker die cut outline
    fillCircle(fx + 45, fy + 45, 48, 255, 255, 255, 255);

    // 5 Petals
    const angles = [0, 72, 144, 216, 288];
    for (const ang of angles) {
      const rad = (ang * Math.PI) / 180;
      const px = fx + 45 + Math.cos(rad) * 26;
      const py = fy + 45 + Math.sin(rad) * 26;
      fillCircle(px, py, 16, 175, 178, 180, 255);
      fillCircle(px, py, 12, 210, 212, 215, 255);
    }
    // Flower center
    fillCircle(fx + 45, fy + 45, 12, 90, 92, 95, 255);
    fillCircle(fx + 45, fy + 45, 6, 40, 42, 45, 255);

    // Halftone dots texture on flower petals
    for (let py = fy + 10; py < fy + 80; py += 3) {
      for (let px = fx + 10; px < fx + 80; px += 3) {
        if (Math.hypot(px - (fx + 45), py - (fy + 45)) < 36 && (px * 3 + py * 7) % 5 === 0) {
          fillCircle(px, py, 1.4, 60, 60, 65, 200);
        }
      }
    }
  };
  drawFlowerSticker(4, 575);

  return encodePNG(width, height, buf);
}

// Ensure public/assets/frames directory exists
fs.mkdirSync('public/assets/frames', { recursive: true });

console.log('Generating frame_005.png (compositing overlay)...');
const frame005Buf = generatePasarSejatiBuffer(false);
fs.writeFileSync('public/assets/frames/frame_005.png', frame005Buf);
console.log('frame_005.png written successfully (' + frame005Buf.length + ' bytes)');

console.log('Generating preview_005.png (selection preview)...');
const preview005Buf = generatePasarSejatiBuffer(true);
fs.writeFileSync('public/assets/frames/preview_005.png', preview005Buf);
console.log('preview_005.png written successfully (' + preview005Buf.length + ' bytes)');
