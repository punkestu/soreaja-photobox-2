import fs from 'fs';
import zlib from 'zlib';

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
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
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

function renderPWAIcon(size, isMaskable = false) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;

  const setPixel = (x, y, r, g, b, a = 255) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = a;
  };

  // Base background: Deep studio slate-black #0A0A0B
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      setPixel(x, y, 10, 10, 11, 255);
    }
  }

  // Camera motif dimensions
  const scale = isMaskable ? 0.65 : 0.85;
  const bodyRadius = Math.round(18 * scale * (size / 100));
  const boxW = Math.round(70 * scale * (size / 100));
  const boxH = Math.round(52 * scale * (size / 100));
  const minX = Math.round(cx - boxW / 2);
  const maxX = Math.round(cx + boxW / 2);
  const minY = Math.round(cy - boxH / 2 + 4 * (size / 100));
  const maxY = Math.round(cy + boxH / 2 + 4 * (size / 100));

  // Top viewfinder bump
  const bumpW = Math.round(24 * scale * (size / 100));
  const bumpH = Math.round(10 * scale * (size / 100));
  for (let y = minY - bumpH; y <= minY; y++) {
    for (let x = Math.round(cx - bumpW / 2); x <= Math.round(cx + bumpW / 2); x++) {
      setPixel(x, y, 225, 29, 72, 255); // Crimson accent #E11D48
    }
  }

  // Camera body rounded box
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      setPixel(x, y, 24, 24, 27, 255); // Zinc-900 body
    }
  }

  // Lens circle outer ring
  const lensR = Math.round(20 * scale * (size / 100));
  const lensCenterY = Math.round((minY + maxY) / 2);
  for (let y = lensCenterY - lensR; y <= lensCenterY + lensR; y++) {
    for (let x = cx - lensR; x <= cx + lensR; x++) {
      const dist = Math.hypot(x - cx, y - lensCenterY);
      if (dist <= lensR) {
        if (dist >= lensR - Math.round(3 * (size / 100))) {
          setPixel(x, y, 225, 29, 72, 255); // Red aperture ring
        } else if (dist <= lensR * 0.5) {
          setPixel(x, y, 244, 244, 240, 255); // Inner lens reflection ivory
        } else {
          setPixel(x, y, 10, 10, 11, 255); // Lens dark core
        }
      }
    }
  }

  // Flash dot top right
  const flashR = Math.round(3.5 * (size / 100));
  const flashX = maxX - Math.round(10 * scale * (size / 100));
  const flashY = minY + Math.round(10 * scale * (size / 100));
  for (let y = flashY - flashR; y <= flashY + flashR; y++) {
    for (let x = flashX - flashR; x <= flashX + flashR; x++) {
      if (Math.hypot(x - flashX, y - flashY) <= flashR) {
        setPixel(x, y, 245, 158, 11, 255); // Amber strobe dot
      }
    }
  }

  return encodePNG(size, size, buf);
}

fs.mkdirSync('public', { recursive: true });

fs.writeFileSync('public/pwa-192x192.png', renderPWAIcon(192, false));
fs.writeFileSync('public/pwa-512x512.png', renderPWAIcon(512, false));
fs.writeFileSync('public/pwa-maskable-512x512.png', renderPWAIcon(512, true));
fs.writeFileSync('public/apple-touch-icon.png', renderPWAIcon(180, false));

// Brand SVG for modern desktop browser tabs
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <rect width="100" height="100" rx="22" fill="#0A0A0B"/>
  <rect x="36" y="16" width="28" height="12" rx="4" fill="#E11D48"/>
  <rect x="15" y="24" width="70" height="56" rx="14" fill="#18181B" stroke="#27272A" stroke-width="2"/>
  <circle cx="50" cy="52" r="20" stroke="#E11D48" stroke-width="3" fill="#0A0A0B"/>
  <circle cx="50" cy="52" r="9" fill="#F4F4F0"/>
  <circle cx="73" cy="35" r="4" fill="#F59E0B"/>
</svg>`;
fs.writeFileSync('public/icon.svg', svgIcon);

console.log('PWA icons created successfully in public/');
