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
  printer?: string
): Promise<{ success: boolean; message: string; jobId?: string }> {
  if (!endpoint || !endpoint.trim()) {
    return { success: false, message: 'URL endpoint belum diatur.' };
  }

  // Create a minimal lightweight test canvas
  const testCanvas = document.createElement('canvas');
  testCanvas.width = 600;
  testCanvas.height = 300;
  const ctx = testCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#18181B';
    ctx.fillRect(0, 0, 600, 300);
    ctx.fillStyle = '#E11D48';
    ctx.fillRect(20, 20, 560, 6);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('SOREAJA PHOTOBOX · TEST PRINT', 30, 70);
    ctx.fillStyle = '#A1A1AA';
    ctx.font = '14px monospace';
    ctx.fillText(`Target: ${endpoint}`, 30, 110);
    ctx.fillText(`Printer: ${printer || '(default)'}`, 30, 140);
    ctx.fillText(`Timestamp: ${new Date().toISOString()}`, 30, 170);
  }
  const testBase64 = testCanvas.toDataURL('image/png');

  try {
    const res = await dispatchPrintApi(endpoint, testBase64, printer, 'color');
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
  finalImageBase64?: string | null,
  customEndpoint?: string,
  printerName?: string
): Promise<PrintJobResult> => {
  if (customEndpoint && customEndpoint.trim() && finalImageBase64) {
    return await dispatchPrintApi(customEndpoint.trim(), finalImageBase64, printerName, 'thermal');
  }

  // Fallback / Default Simulation
  console.log('Menghubungkan ke Printer Thermal (Simulasi)...', finalImageBase64 ? `(${Math.round(finalImageBase64.length / 1024)} KB)` : '');
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: 'success',
        message: 'Printed Thermal (80mm Monochrome Receipt Roll)',
        jobId: `THM-${Math.floor(100000 + Math.random() * 900000)}`,
        printerType: 'thermal',
        timestamp: new Date().toLocaleTimeString('id-ID'),
        isMockFallback: true,
      });
    }, 1500);
  });
};

export const printColor = async (
  finalImageBase64?: string | null,
  customEndpoint?: string,
  printerName?: string
): Promise<PrintJobResult> => {
  if (customEndpoint && customEndpoint.trim() && finalImageBase64) {
    return await dispatchPrintApi(customEndpoint.trim(), finalImageBase64, printerName, 'color');
  }

  // Fallback / Default Simulation
  console.log('Menghubungkan ke Printer Warna (Simulasi)...', finalImageBase64 ? `(${Math.round(finalImageBase64.length / 1024)} KB)` : '');
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: 'success',
        message: 'Printed Color (Dye-Sub 4R Studio Glossy)',
        jobId: `CLR-${Math.floor(100000 + Math.random() * 900000)}`,
        printerType: 'color',
        timestamp: new Date().toLocaleTimeString('id-ID'),
        isMockFallback: true,
      });
    }, 2500);
  });
};
