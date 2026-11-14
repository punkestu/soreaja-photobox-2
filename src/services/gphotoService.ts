import { Camera } from 'web-gphoto2';

export interface CameraConfigField {
  name: string;
  label: string;
  type: string;
  value: string | number | boolean;
  choices?: string[];
  readonly: boolean;
}

export interface GPhotoStatus {
  isSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  isCapturing: boolean;
  isLiveViewing: boolean;
  modelName: string | null;
  batteryLevel?: string | null;
  config?: Record<string, CameraConfigField>;
  error: string | null;
}

type StateListener = (status: GPhotoStatus) => void;
type FrameListener = (frameUrl: string) => void;

function extractConfigItems(
  node: any,
  result: Record<string, CameraConfigField> = {}
): Record<string, CameraConfigField> {
  if (!node) return result;
  if (node.children) {
    for (const key of Object.keys(node.children)) {
      extractConfigItems(node.children[key], result);
    }
  } else if (node.name) {
    result[node.name.toLowerCase()] = {
      name: node.name,
      label: node.label || node.name,
      type: node.type,
      value: node.value,
      choices: Array.isArray(node.choices) ? node.choices : undefined,
      readonly: Boolean(node.readonly),
    };
  }
  return result;
}

class GPhotoService {
  private camera: Camera | null = null;
  private isConnecting: boolean = false;
  private isCapturing: boolean = false;
  private isLiveViewing: boolean = false;
  private modelName: string | null = null;
  private batteryLevel: string | null = null;
  private cameraConfig: Record<string, CameraConfigField> = {};
  private lastError: string | null = null;

  private stateListeners: Set<StateListener> = new Set();
  private frameListeners: Set<FrameListener> = new Set();

  private liveViewLoopActive: boolean = false;
  private currentFrameUrl: string | null = null;
  private isLoopTickRunning: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'usb' in navigator) {
      (navigator as any).usb?.addEventListener('disconnect', (event: any) => {
        // If our USB device was disconnected
        if (this.camera) {
          console.warn('[GPhotoService] USB device disconnected:', event);
          this.disconnect();
          this.notifyState('Perangkat USB kamera terputus');
        }
      });
    }
  }

  /**
   * Check if WebUSB and browser environment support web-gphoto2
   */
  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      'usb' in navigator &&
      Boolean(window.isSecureContext)
    );
  }

  /**
   * Get current camera and service status
   */
  public getStatus(): GPhotoStatus {
    return {
      isSupported: this.isSupported(),
      isConnected: this.camera !== null,
      isConnecting: this.isConnecting,
      isCapturing: this.isCapturing,
      isLiveViewing: this.isLiveViewing,
      modelName: this.modelName,
      batteryLevel: this.batteryLevel,
      config: this.cameraConfig,
      error: this.lastError,
    };
  }

  /**
   * Subscribe to camera state changes (connect, disconnect, capture, errors)
   */
  public subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Subscribe to liveview frames (object URLs)
   */
  public subscribeFrames(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    if (this.currentFrameUrl) {
      listener(this.currentFrameUrl);
    }
    return () => {
      this.frameListeners.delete(listener);
    };
  }

  private notifyState(error?: string) {
    if (error !== undefined) {
      this.lastError = error;
    }
    const status = this.getStatus();
    this.stateListeners.forEach((l) => {
      try {
        l(status);
      } catch (err) {
        console.error('[GPhotoService] Error in state listener:', err);
      }
    });
  }

  /**
   * Prompt user with browser's native WebUSB picker, connect to camera,
   * and immediately read the camera's full hardware configuration.
   */
  public async requestAndConnect(): Promise<{ success: boolean; model?: string; error?: string }> {
    if (!this.isSupported()) {
      const err = 'Browser tidak mendukung WebUSB atau koneksi tidak aman (HTTPS/localhost dibutuhkan)';
      this.notifyState(err);
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`Error menghubungkan kamera: ${err}`);
      }
      return { success: false, error: err };
    }

    if (typeof SharedArrayBuffer === 'undefined') {
      const err =
        'SharedArrayBuffer belum aktif (Cross-Origin Isolation dibutuhkan). Harap refresh halaman atau restart dev server.';
      this.notifyState(err);
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`Error menghubungkan kamera: ${err}`);
      }
      return { success: false, error: err };
    }

    if (this.isConnecting) {
      return { success: false, error: 'Koneksi sedang berlangsung' };
    }

    this.isConnecting = true;
    this.lastError = null;
    this.notifyState();

    try {
      // 1. Show native USB device selector dialog
      await Camera.showPicker();

      // 2. Initialize Camera and connect
      const camera = new Camera();
      await camera.connect();

      this.camera = camera;
      this.isConnecting = false;

      // 3. Read camera configuration tree so DSLR config follows camera hardware settings
      await this.refreshConfigInternal();

      return {
        success: true,
        model: this.modelName || 'DSLR / Mirrorless USB Camera',
      };
    } catch (err: any) {
      console.error('[GPhotoService] Failed to connect to camera:', err);
      this.isConnecting = false;
      this.camera = null;
      this.modelName = null;
      this.batteryLevel = null;
      this.cameraConfig = {};
      const errMsg = err?.message || String(err) || 'Gagal menghubungkan ke kamera USB';
      this.notifyState(errMsg);
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`Error menghubungkan kamera: ${errMsg}`);
      }
      return { success: false, error: errMsg };
    }
  }

  /**
   * Refresh and sync configuration tree directly from connected camera
   */
  public async refreshConfig(): Promise<Record<string, CameraConfigField>> {
    if (!this.camera) return {};

    const wasLive = this.isLiveViewing;
    if (wasLive) {
      this.stopLiveView();
      await new Promise((r) => setTimeout(r, 60));
    }

    try {
      await this.refreshConfigInternal();
      return this.cameraConfig;
    } finally {
      if (wasLive && this.camera) {
        this.startLiveView();
      }
    }
  }

  private async refreshConfigInternal(): Promise<void> {
    if (!this.camera) return;
    try {
      const rawConfig = await this.camera.getConfig();
      this.cameraConfig = extractConfigItems(rawConfig);

      // Extract model name
      const modelField =
        this.cameraConfig['cameramodel'] ||
        this.cameraConfig['model'] ||
        this.cameraConfig['cameraname'];
      if (modelField && typeof modelField.value === 'string' && modelField.value.trim()) {
        this.modelName = modelField.value.trim();
      } else if (!this.modelName) {
        this.modelName = 'DSLR / Mirrorless USB Camera';
      }

      // Extract battery level if reported
      const batteryField =
        this.cameraConfig['batterylevel'] ||
        this.cameraConfig['battery'] ||
        this.cameraConfig['batterystatus'];
      if (batteryField && batteryField.value !== undefined) {
        this.batteryLevel = String(batteryField.value);
      }

      this.notifyState();
    } catch (err) {
      console.warn('[GPhotoService] Could not read camera config:', err);
    }
  }

  /**
   * Set a specific camera configuration setting (e.g. 'iso', 'shutterspeed', 'aperture', 'whitebalance')
   */
  public async setConfigValue(name: string, value: string | number | boolean): Promise<void> {
    if (!this.camera) {
      throw new Error('Kamera USB belum terhubung');
    }

    const wasLive = this.isLiveViewing;
    if (wasLive) {
      this.stopLiveView();
      await new Promise((r) => setTimeout(r, 60));
    }

    try {
      await this.camera.setConfigValue(name, value);
      // Wait briefly for camera hardware to register update
      await new Promise((r) => setTimeout(r, 150));
      await this.refreshConfigInternal();
    } catch (err: any) {
      console.error(`[GPhotoService] Failed to set config ${name}=${value}:`, err);
      throw err;
    } finally {
      if (wasLive && this.camera) {
        this.startLiveView();
      }
    }
  }

  /**
   * Disconnect the external camera and clean up preview loops
   */
  public async disconnect(): Promise<void> {
    this.stopLiveView();

    if (this.camera) {
      try {
        await this.camera.disconnect();
      } catch (err) {
        console.warn('[GPhotoService] Error during camera.disconnect():', err);
      }
      this.camera = null;
    }

    this.modelName = null;
    this.batteryLevel = null;
    this.cameraConfig = {};
    this.isCapturing = false;
    this.notifyState();
  }

  /**
   * Start live view stream loop with automated memory recycling
   */
  public startLiveView(frameIntervalMs: number = 80): void {
    if (!this.camera || this.isLiveViewing) return;

    this.isLiveViewing = true;
    this.liveViewLoopActive = true;
    this.notifyState();

    const fetchNextFrame = async () => {
      if (!this.liveViewLoopActive || !this.camera) return;

      if (!this.isCapturing && !this.isLoopTickRunning) {
        this.isLoopTickRunning = true;
        try {
          const blob = await this.camera.capturePreviewAsBlob();
          if (blob && blob.size > 0 && this.liveViewLoopActive) {
            const nextUrl = URL.createObjectURL(blob);
            const oldUrl = this.currentFrameUrl;
            this.currentFrameUrl = nextUrl;

            // Notify all subscribers with the new frame URL
            this.frameListeners.forEach((listener) => {
              try {
                listener(nextUrl);
              } catch (e) {
                console.error('[GPhotoService] Error in frame listener:', e);
              }
            });

            // Immediately revoke old URL to prevent browser memory leaks
            if (oldUrl) {
              URL.revokeObjectURL(oldUrl);
            }
          }
        } catch (previewErr) {
          // If error during preview (e.g. camera busy or unplugged), log non-critically
          console.debug('[GPhotoService] Liveview frame fetch skipped:', previewErr);
        } finally {
          this.isLoopTickRunning = false;
        }
      }

      if (this.liveViewLoopActive) {
        setTimeout(fetchNextFrame, frameIntervalMs);
      }
    };

    fetchNextFrame();
  }

  /**
   * Stop the live view stream and revoke the active preview URL
   */
  public stopLiveView(): void {
    this.liveViewLoopActive = false;
    this.isLiveViewing = false;

    if (this.currentFrameUrl) {
      URL.revokeObjectURL(this.currentFrameUrl);
      this.currentFrameUrl = null;
    }

    this.notifyState();
  }

  /**
   * Mutex-guarded high-resolution photo capture.
   * Pauses the liveview loop to prevent PTP device concurrency collisions,
   * triggers camera shutter, optionally mirrors horizontally to match viewfinder,
   * converts resulting file to base64 data URL, and resumes liveview.
   */
  public async captureHighResPhoto(shouldMirror: boolean = false): Promise<string> {
    if (!this.camera) {
      throw new Error('Kamera USB belum terhubung');
    }

    if (this.isCapturing) {
      throw new Error('Pengambilan foto sedang berlangsung');
    }

    const wasLiveViewing = this.isLiveViewing;
    this.isCapturing = true;
    this.notifyState();

    try {
      // 1. Wait until any currently running preview tick finishes
      while (this.isLoopTickRunning) {
        await new Promise((r) => setTimeout(r, 20));
      }

      // Small cooldown to ensure PTP bus is completely idle
      await new Promise((r) => setTimeout(r, 60));

      // 2. Trigger hardware shutter and download full-res file
      const file = await this.camera.captureImageAsFile();

      // 3. Mirror image if requested to match kiosk viewfinder mirror mode
      if (shouldMirror && typeof document !== 'undefined') {
        try {
          const bitmap = await createImageBitmap(file);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(bitmap, 0, 0);
            bitmap.close();
            return canvas.toDataURL('image/jpeg', 0.95);
          }
        } catch (bitmapErr) {
          console.warn('[GPhotoService] Failed to mirror via ImageBitmap, using raw image:', bitmapErr);
        }
      }

      // 4. Convert File/Blob to Base64 Data URL for compositing
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      return base64;
    } finally {
      this.isCapturing = false;
      this.notifyState();

      // 5. Resume live view if it was running previously
      if (wasLiveViewing && this.camera && !this.liveViewLoopActive) {
        this.startLiveView();
      }
    }
  }
}

export const gphotoService = new GPhotoService();
