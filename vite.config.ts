import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

function scanFramePacks(rootDir: string, syncToFile = false) {
  const packsDir = path.resolve(rootDir, 'public/frame-packs');
  if (!fs.existsSync(packsDir)) return [];
  const entries = fs.readdirSync(packsDir, { withFileTypes: true });
  const packs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const packJsonPath = path.join(packsDir, entry.name, 'pack.json');
    const metaJsonPath = path.join(packsDir, entry.name, 'metadata.json');
    let info = null;

    if (fs.existsSync(packJsonPath)) {
      try {
        info = JSON.parse(fs.readFileSync(packJsonPath, 'utf8'));
      } catch (err) {
        console.warn(`[FramePacks] Error parsing ${packJsonPath}:`, err);
      }
    } else if (fs.existsSync(metaJsonPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(metaJsonPath, 'utf8'));
        if (Array.isArray(raw)) {
          info = {
            id: entry.name,
            name: entry.name.replace(/[-_]/g, ' '),
            frames: raw,
          };
        } else {
          info = raw;
        }
      } catch (err) {
        console.warn(`[FramePacks] Error parsing ${metaJsonPath}:`, err);
      }
    }

    if (info) {
      const frameList = Array.isArray(info.frames) ? info.frames : [];
      const frameCount = typeof info.frameCount === 'number' ? info.frameCount : frameList.length;
      let coverImg = info.coverImg || frameList[0]?.previewImg || '';
      if (coverImg && !coverImg.startsWith('/') && !coverImg.startsWith('http')) {
        coverImg = `/frame-packs/${entry.name}/${coverImg}`;
      }

      packs.push({
        id: info.id || entry.name,
        name: info.name || entry.name,
        description: info.description || '',
        author: info.author || 'SoreAja Studio',
        version: info.version || '1.0.0',
        coverImg: coverImg,
        frameCount: frameCount,
        isDefault: Boolean(info.isDefault || entry.name === 'default'),
        path: `/frame-packs/${entry.name}`,
      });
    }
  }

  // Ensure 'default' is at the top
  packs.sort((a, b) => (a.isDefault ? -1 : b.isDefault ? 1 : a.name.localeCompare(b.name)));

  // Write/sync public/frame-packs/packs.json ONLY during build and only if content changed
  if (syncToFile) {
    try {
      const packsManifestPath = path.join(packsDir, 'packs.json');
      const newContent = JSON.stringify(packs, null, 2);
      let existingContent = '';
      if (fs.existsSync(packsManifestPath)) {
        existingContent = fs.readFileSync(packsManifestPath, 'utf8');
      }
      if (existingContent !== newContent) {
        fs.writeFileSync(packsManifestPath, newContent, 'utf8');
      }
    } catch (err) {
      console.warn('[FramePacks] Could not update packs.json:', err);
    }
  }

  return packs;
}

function framePackDiscoveryPlugin() {
  return {
    name: 'vite-plugin-frame-pack-discovery',
    buildStart() {
      scanFramePacks(process.cwd(), true);
    },
    configureServer(server: any) {
      // Dev endpoint to dynamically list all frame packs on disk (read-only in dev, never writes)
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/api/frame-packs' && req.method === 'GET') {
          try {
            const packs = scanFramePacks(process.cwd(), false);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(packs));
            return;
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
            return;
          }
        }
        next();
      });
    },
  };
}

function crossOriginIsolationPlugin() {
  return {
    name: 'vite-plugin-cross-origin-isolation',
    configureServer(server: any) {
      server.middlewares.use((_req: any, res: any, next: any) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        next();
      });
    },
    configurePreviewServer(server: any) {
      server.middlewares.use((_req: any, res: any, next: any) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    optimizeDeps: {
      exclude: ['web-gphoto2'],
    },
    plugins: [
      basicSsl(),
      crossOriginIsolationPlugin(),
      react(),
      tailwindcss(),
      framePackDiscoveryPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          id: '/',
          name: 'SoreAja Pose',
          short_name: 'SoreAja',
          description:
            'Offline-first web photobox application with local IndexedDB storage, WebRTC capture, and GIF generation.',
          theme_color: '#0A0A0B',
          background_color: '#0A0A0B',
          display: 'fullscreen',
          display_override: ['fullscreen', 'standalone', 'minimal-ui', 'window-controls-overlay'],
          orientation: 'any',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\/.*/, /^\/print\/.*/],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json,jpg,jpeg,webp}'],
          globIgnores: ['**/pwa-*.png'],
          runtimeCaching: [
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\/frames-metadata\.json$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'frames-metadata-cache',
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\/frame-packs\/.*\.json$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'frame-packs-meta-cache',
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\/frame-packs\/.*\.(?:png|jpg|jpeg|svg|webp|gif)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'frame-packs-images-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
          type: 'module',
          navigateFallback: 'index.html',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/public/frame-packs/**', '**/dist/**', '**/.git/**'],
      },
    },
    preview: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
  };
});
