export interface PrintJobResult {
  status: 'success' | 'error';
  message: string;
  jobId: string;
  printerType: 'thermal' | 'color';
  timestamp: string;
}

export const printThermal = async (finalImageBase64?: string | null): Promise<PrintJobResult> => {
  console.log('Menghubungkan ke Printer Thermal...', finalImageBase64 ? `(${Math.round(finalImageBase64.length / 1024)} KB)` : '');
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('✅ [MOCK] Berhasil mencetak foto (Thermal).');
      resolve({
        status: 'success',
        message: 'Printed Thermal (80mm Monochrome Receipt Roll)',
        jobId: `THM-${Math.floor(100000 + Math.random() * 900000)}`,
        printerType: 'thermal',
        timestamp: new Date().toLocaleTimeString('id-ID'),
      });
    }, 1500); // Simulasi delay koneksi hardware sesuai TSD 5.2
  });
};

export const printColor = async (finalImageBase64?: string | null): Promise<PrintJobResult> => {
  console.log('Menghubungkan ke Printer Warna...', finalImageBase64 ? `(${Math.round(finalImageBase64.length / 1024)} KB)` : '');
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('✅ [MOCK] Berhasil mencetak foto (Warna).');
      resolve({
        status: 'success',
        message: 'Printed Color (Dye-Sub 4R Studio Glossy)',
        jobId: `CLR-${Math.floor(100000 + Math.random() * 900000)}`,
        printerType: 'color',
        timestamp: new Date().toLocaleTimeString('id-ID'),
      });
    }, 3000); // Simulasi delay 3000ms sesuai TSD 5.2
  });
};
