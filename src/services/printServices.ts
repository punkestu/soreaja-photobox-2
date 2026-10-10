export interface PrintJobResult {
  status: 'success' | 'error';
  message: string;
  jobId: string;
  printerType: 'thermal' | 'color';
  timestamp: string;
  isMockFallback?: boolean;
}

export function base64ToBlob(base64Data: string, mimeType = 'image/png'): Blob {
  const parts = base64Data.split(';base64,');
  const raw = parts.length > 1 ? parts[1] : parts[0];
  const byteString = atob(raw);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }
  return new Blob([uint8Array], { type: mimeType });
}

export async function dispatchPrintApi(
  endpoint: string,
  imageBase64: string,
  printer?: string,
  printerType: 'thermal' | 'color' = 'color'
): Promise<PrintJobResult> {
  const blob = base64ToBlob(imageBase64, 'image/png');
  const formData = new FormData();
  formData.append('image', blob, `photobox_print_${Date.now()}.png`);
  if (printer && printer.trim()) {
    formData.append('printer', printer.trim());
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  let jobId = `PRT-${Date.now().toString().slice(-6)}`;
  let message = `Terkirim ke Print Server (${printer || 'Default Printer'})`;
  try {
    const json = await response.json();
    if (json.jobId || json.id || json.job_id) {
      jobId = String(json.jobId || json.id || json.job_id);
    }
    if (json.message) {
      message = String(json.message);
    }
  } catch {
    // Plain text or empty response is valid
  }

  return {
    status: 'success',
    message,
    jobId,
    printerType,
    timestamp: new Date().toLocaleTimeString('id-ID'),
    isMockFallback: false,
  };
}

export async function testPrintApi(
  endpoint: string,
  printer?: string,
  testType: 'thermal' | 'color' = 'color'
): Promise<{ success: boolean; message: string; jobId?: string }> {
  if (!endpoint || !endpoint.trim()) {
    return { success: false, message: 'URL endpoint belum diatur.' };
  }
  if (!printer || !printer.trim()) {
    return {
      success: false,
      message: `Nama printer ${testType === 'thermal' ? 'thermal' : 'warna'} belum diatur. Harap masukkan nama printer di pengaturan.`,
    };
  }

  // Create a minimal lightweight test canvas
  const testCanvas = document.createElement('canvas');
  if (testType === 'thermal') {
    // 1-strip narrow format for thermal receipt test
    testCanvas.width = 480;
    testCanvas.height = 1000;
  } else {
    // 2-strip side-by-side format for 4R color test
    testCanvas.width = 1200;
    testCanvas.height = 800;
  }
  const ctx = testCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#18181B';
    ctx.fillRect(0, 0, testCanvas.width, testCanvas.height);
    ctx.fillStyle = testType === 'thermal' ? '#71717A' : '#E11D48';
    ctx.fillRect(20, 20, testCanvas.width - 40, 8);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(
      `TEST PRINT · ${testType === 'thermal' ? '1-STRIP THERMAL' : '2-STRIP COLOR 4R'}`,
      30,
      70
    );
    ctx.fillStyle = '#A1A1AA';
    ctx.font = '14px monospace';
    ctx.fillText(`Target: ${endpoint}`, 30, 110);
    ctx.fillText(`Printer: ${printer}`, 30, 140);
    ctx.fillText(`Payload: ${testType === 'thermal' ? '1-Strip Image' : '2-Strip Image'}`, 30, 170);
    ctx.fillText(`Timestamp: ${new Date().toISOString()}`, 30, 200);

    if (testType === 'color') {
      // Draw 2 side-by-side cut preview boxes
      ctx.strokeStyle = '#52525B';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(testCanvas.width / 2, 230);
      ctx.lineTo(testCanvas.width / 2, testCanvas.height - 30);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#A1A1AA';
      ctx.font = '12px monospace';
      ctx.fillText('STRIP A (LEFT)', 100, 260);
      ctx.fillText('STRIP B (RIGHT)', testCanvas.width / 2 + 80, 260);
    }
  }
  const testBase64 = testCanvas.toDataURL('image/png');

  try {
    const res = await dispatchPrintApi(endpoint, testBase64, printer, testType);
    return {
      success: true,
      message: `Koneksi berhasil! ${res.message}`,
      jobId: res.jobId,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export const printThermal = async (
  singleStripImageBase64?: string | null,
  customEndpoint?: string,
  thermalPrinterName?: string
): Promise<PrintJobResult> => {
  if (customEndpoint && customEndpoint.trim() && singleStripImageBase64) {
    if (!thermalPrinterName || !thermalPrinterName.trim()) {
      throw new Error(
        'Nama printer thermal belum diatur di Pengaturan. Harap isi Nama Printer Thermal terlebih dahulu.'
      );
    }
    return await dispatchPrintApi(
      customEndpoint.trim(),
      singleStripImageBase64,
      thermalPrinterName.trim(),
      'thermal'
    );
  }

  // Fallback / Default Simulation
  console.log(
    'Menghubungkan ke Printer Thermal (Simulasi)...',
    singleStripImageBase64
      ? `(${Math.round(singleStripImageBase64.length / 1024)} KB · 1-Strip)`
      : ''
  );
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: 'success',
        message: 'Printed Thermal (1-Strip 80mm Roll)',
        jobId: `THM-${Math.floor(100000 + Math.random() * 900000)}`,
        printerType: 'thermal',
        timestamp: new Date().toLocaleTimeString('id-ID'),
        isMockFallback: true,
      });
    }, 1500);
  });
};

export const printColor = async (
  imageToPrint?: string | null,
  customEndpoint?: string,
  colorPrinterName?: string
): Promise<PrintJobResult> => {
  if (customEndpoint && customEndpoint.trim() && imageToPrint) {
    if (!colorPrinterName || !colorPrinterName.trim()) {
      throw new Error(
        'Nama printer warna belum diatur di Pengaturan. Harap isi Nama Printer Warna terlebih dahulu.'
      );
    }
    return await dispatchPrintApi(
      customEndpoint.trim(),
      imageToPrint,
      colorPrinterName.trim(),
      'color'
    );
  }

  // Fallback / Default Simulation
  console.log(
    'Menghubungkan ke Printer Warna (Simulasi)...',
    imageToPrint ? `(${Math.round(imageToPrint.length / 1024)} KB · 2-Strip/4R)` : ''
  );
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: 'success',
        message: 'Printed Color (Dye-Sub 4R Glossy)',
        jobId: `CLR-${Math.floor(100000 + Math.random() * 900000)}`,
        printerType: 'color',
        timestamp: new Date().toLocaleTimeString('id-ID'),
        isMockFallback: true,
      });
    }, 2500);
  });
};

/**
 * Pre-cache all frame assets, icons, and metadata in CacheStorage for 100% offline availability.
 */
export async function precacheAllFrameAssets(): Promise<{
  totalAssets: number;
  cachedCount: number;
  isFullyCached: boolean;
}> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { totalAssets: 0, cachedCount: 0, isFullyCached: false };
  }

  const cache = await caches.open('photobox-offline-frames-v1');
  const urlsToCache = new Set<string>([
    '/frames-metadata.json',
    '/assets/gif.worker.js',
    '/favicon.ico',
    '/pwa-192x192.png',
    '/pwa-512x512.png',
    '/pwa-maskable-512x512.png',
  ]);

  try {
    const metaRes = await fetch('/frames-metadata.json');
    if (metaRes.ok) {
      const frames = await metaRes.json();
      if (Array.isArray(frames)) {
        for (const f of frames) {
          if (f.frameImg) urlsToCache.add(f.frameImg);
          if (f.previewImg) urlsToCache.add(f.previewImg);
        }
      }
    }
  } catch (err) {
    console.warn('Could not read frames-metadata for precaching:', err);
  }

  const allUrls = Array.from(urlsToCache);
  let successCount = 0;

  for (const url of allUrls) {
    try {
      const match = await cache.match(url);
      if (match) {
        successCount++;
      } else {
        const res = await fetch(url);
        if (res.ok) {
          await cache.put(url, res);
          successCount++;
        }
      }
    } catch {
      // Continue next
    }
  }

  return {
    totalAssets: allUrls.length,
    cachedCount: successCount,
    isFullyCached: successCount === allUrls.length,
  };
}
