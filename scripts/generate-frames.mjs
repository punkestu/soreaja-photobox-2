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

function createFramePNG({
  width,
  height,
  bgColor,
  accentColor,
  borderColor,
  positions,
  isPreview = false,
}) {
  const buf = Buffer.alloc(width * height * 4);

  const setPixel = (x, y, r, g, b, a = 255) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = a;
  };

  // Fill background
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Subtle paper grain
      const noise = ((x * 37 + y * 17) % 5) - 2;
      setPixel(
        x,
        y,
        Math.min(255, Math.max(0, bgColor[0] + noise)),
        Math.min(255, Math.max(0, bgColor[1] + noise)),
        Math.min(255, Math.max(0, bgColor[2] + noise)),
        255
      );
    }
  }

  // Outer border (12px)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < 10 || x >= width - 10 || y < 10 || y >= height - 10) {
        setPixel(x, y, borderColor[0], borderColor[1], borderColor[2], 255);
      } else if (
        (x >= 18 && x < 20 && y >= 18 && y < height - 18) ||
        (x >= width - 20 && x < width - 18 && y >= 18 && y < height - 18) ||
        (y >= 18 && y < 20 && x >= 18 && x < width - 18) ||
        (y >= height - 20 && y < height - 18 && x >= 18 && x < width - 18)
      ) {
        setPixel(x, y, accentColor[0], accentColor[1], accentColor[2], 255);
      }
    }
  }

  // Top header accent bar
  for (let y = 38; y < 44; y++) {
    for (let x = 50; x < width - 50; x++) {
      setPixel(x, y, accentColor[0], accentColor[1], accentColor[2], 255);
    }
  }

  // Footer accent bar
  for (let y = height - 68; y < height - 62; y++) {
    for (let x = 50; x < width - 50; x++) {
      setPixel(x, y, accentColor[0], accentColor[1], accentColor[2], 255);
    }
  }

  // Cut out or fill photo positions
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    // Draw a 4px frame border around each slot
    for (let y = pos.y - 4; y < pos.y + pos.height + 4; y++) {
      for (let x = pos.x - 4; x < pos.x + pos.width + 4; x++) {
        setPixel(x, y, borderColor[0], borderColor[1], borderColor[2], 255);
      }
    }

    // Inside slot: transparent for frameImg, or stylized gradient placeholder for previewImg
    for (let y = pos.y; y < pos.y + pos.height; y++) {
      for (let x = pos.x; x < pos.x + pos.width; x++) {
        if (!isPreview) {
          setPixel(x, y, 0, 0, 0, 0); // 100% transparent cutout for HTML5 Canvas compositing
        } else {
          // Warm gradient preview placeholder
          const relY = (y - pos.y) / pos.height;
          const relX = (x - pos.x) / pos.width;
          const r = Math.round(215 - relY * 35 + i * 8);
          const g = Math.round(205 - relY * 40);
          const b = Math.round(195 - relX * 25);
          setPixel(x, y, r, g, b, 255);
        }
      }
    }
  }

  return encodePNG(width, height, buf);
}

const frames = [
  {
    id: 'frame_001',
    name: 'Classic Strip',
    subtitle: '3-Cut Vertical Editorial Ivory',
    theme: 'light',
    canvasWidth: 500,
    canvasHeight: 1220,
    bgColor: [246, 244, 238],
    accentColor: [225, 29, 72],
    borderColor: [24, 24, 27],
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
    bgColor: [18, 18, 20],
    accentColor: [225, 29, 72],
    borderColor: [63, 63, 70],
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
    bgColor: [242, 239, 230],
    accentColor: [217, 119, 6],
    borderColor: [28, 25, 23],
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
    bgColor: [250, 243, 232],
    accentColor: [194, 65, 12],
    borderColor: [67, 20, 7],
    previewImg: '/assets/frames/preview_004.png',
    frameImg: '/assets/frames/frame_004.png',
    photoCount: 2,
    positions: [
      { x: 50, y: 100, width: 400, height: 300 },
      { x: 50, y: 440, width: 400, height: 300 },
    ],
  },
];

fs.mkdirSync('public/assets/frames', { recursive: true });

for (const f of frames) {
  const frameBuf = createFramePNG({
    width: f.canvasWidth,
    height: f.canvasHeight,
    bgColor: f.bgColor,
    accentColor: f.accentColor,
    borderColor: f.borderColor,
    positions: f.positions,
    isPreview: false,
  });
  fs.writeFileSync(`public${f.frameImg}`, frameBuf);

  const previewBuf = createFramePNG({
    width: f.canvasWidth,
    height: f.canvasHeight,
    bgColor: f.bgColor,
    accentColor: f.accentColor,
    borderColor: f.borderColor,
    positions: f.positions,
    isPreview: true,
  });
  fs.writeFileSync(`public${f.previewImg}`, previewBuf);
}

// Write public/metadata.json matching TSD Section 3.2 schema
const metadataJson = frames.map(({ id, name, subtitle, theme, canvasWidth, canvasHeight, previewImg, frameImg, photoCount, positions }) => ({
  id,
  name,
  subtitle,
  theme,
  canvasWidth,
  canvasHeight,
  previewImg,
  frameImg,
  photoCount,
  positions,
}));

fs.writeFileSync('public/metadata.json', JSON.stringify(metadataJson, null, 2));
fs.writeFileSync('public/frames-metadata.json', JSON.stringify(metadataJson, null, 2));
console.log('Generated frames and public/metadata.json successfully!');
