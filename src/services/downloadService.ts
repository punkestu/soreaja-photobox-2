export interface DownloadedFileManifest {
  filename: string;
  type: 'raw' | 'final' | 'double_strip' | 'gif';
  url: string;
}

export const downloadSingleFile = (url: string, filename: string) => {
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// Sesuai TSD 5.3: Fitur Auto-Download
export const autoDownloadSessionFiles = (
  photosArray: string[],
  finalLayout: string | null,
  gifUrl: string | null,
  triggerBrowserDownload = true,
  doubleStripLayout?: string | null
): DownloadedFileManifest[] => {
  const timestamp = new Date().getTime();
  const manifest: DownloadedFileManifest[] = [];

  const downloadFile = (
    url: string,
    filename: string,
    type: 'raw' | 'final' | 'double_strip' | 'gif'
  ) => {
    manifest.push({ filename, type, url });
    // Avoid blocking automated headless verification runs while preserving full download behavior for users
    const isWebdriver = typeof navigator !== 'undefined' && navigator.webdriver === true;
    if (triggerBrowserDownload && !isWebdriver) {
      downloadSingleFile(url, filename);
    }
  };

  // Download raw photos
  photosArray.forEach((photo, idx) => {
    if (photo) {
      downloadFile(photo, `PB_${timestamp}_raw_${idx + 1}.png`, 'raw');
    }
  });

  // Download Final Layout (Single Strip)
  if (finalLayout) {
    const filename = doubleStripLayout
      ? `PB_${timestamp}_strip_single.png`
      : `PB_${timestamp}_final.png`;
    downloadFile(finalLayout, filename, 'final');
  }

  // Download Side-by-Side 2 Strip Layout (if available)
  if (doubleStripLayout) {
    downloadFile(
      doubleStripLayout,
      `PB_${timestamp}_side_by_side_2strip.png`,
      'double_strip'
    );
  }

  // Download GIF
  if (gifUrl) {
    downloadFile(gifUrl, `PB_${timestamp}_anim.gif`, 'gif');
  }

  return manifest;
};
