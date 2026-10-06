import GIF from 'gif.js';

export const generateGif = (
  photoArrayBase64: string[],
  onProgress?: (p: number) => void
): Promise<string> => {
  return new Promise((resolve) => {
    if (!photoArrayBase64 || photoArrayBase64.length === 0) {
      resolve('');
      return;
    }

    const width = 600;
    const height = 400;

    let settled = false;
    const finish = (url: string) => {
      if (!settled) {
        settled = true;
        resolve(url);
      }
    };

    // Safety fallback if web worker hangs in restricted headless browser environments
    const safetyTimer = setTimeout(() => {
      finish(photoArrayBase64[0]);
    }, 8000);

    try {
      const gif = new GIF({
        workers: 2,
        quality: 10,
        width,
        height,
        workerScript: '/assets/gif.worker.js', // Sesuai TSD 5.1
      });

      const loadImages = photoArrayBase64.map((src) => {
        return new Promise<HTMLImageElement>((res, rej) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => res(img);
          img.onerror = (err) => rej(err);
          img.src = src;
        });
      });

      Promise.all(loadImages)
        .then((images) => {
          images.forEach((img, index) => {
            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = width;
            frameCanvas.height = height;
            const ctx = frameCanvas.getContext('2d');
            if (ctx) {
              // Aspect-fill draw
              const imgRatio = img.width / img.height;
              const targetRatio = width / height;
              let sx = 0,
                sy = 0,
                sw = img.width,
                sh = img.height;
              if (imgRatio > targetRatio) {
                sw = img.height * targetRatio;
                sx = (img.width - sw) / 2;
              } else {
                sh = img.width / targetRatio;
                sy = (img.height - sh) / 2;
              }
              ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

              // Subtle bottom-right studio stamp on GIF frames
              ctx.fillStyle = 'rgba(17, 17, 17, 0.72)';
              ctx.fillRect(width - 178, height - 36, 166, 24);
              ctx.fillStyle = '#F4F4F0';
              ctx.font = '600 11px "JetBrains Mono", monospace';
              ctx.fillText(`SOREAJA · FRAME 0${index + 1}`, width - 166, height - 20);

              gif.addFrame(frameCanvas, { copy: true, delay: 500 }); // Delay 500ms sesuai TSD 5.1
            } else {
              gif.addFrame(img, { delay: 500 });
            }
          });

          if (onProgress) {
            gif.on('progress', (p: number) => onProgress(p));
          }

          gif.on('finished', function (blob: Blob) {
            clearTimeout(safetyTimer);
            finish(URL.createObjectURL(blob));
          });

          gif.render();
        })
        .catch(() => {
          clearTimeout(safetyTimer);
          finish(photoArrayBase64[0]);
        });
    } catch {
      clearTimeout(safetyTimer);
      finish(photoArrayBase64[0]);
    }
  });
};
