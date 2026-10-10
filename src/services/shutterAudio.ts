// Web Audio API Synthesizer for Classic Mechanical SLR Camera Shutter Sound
// 100% Offline, Zero external asset latency, Sub-millisecond instant trigger

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return null;

  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContextClass();
  }

  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }

  return sharedAudioCtx;
}

export function playShutterSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // --- STAGE 1: Mirror Flip-Up (Mechanical snap + camera body thump) ---
    // 1A. High-frequency metallic snap (burst of filtered white noise)
    const snap1Buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.035), ctx.sampleRate);
    const snap1Data = snap1Buffer.getChannelData(0);
    for (let i = 0; i < snap1Data.length; i++) {
      snap1Data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008));
    }
    const snap1Source = ctx.createBufferSource();
    snap1Source.buffer = snap1Buffer;

    const snap1Filter = ctx.createBiquadFilter();
    snap1Filter.type = 'bandpass';
    snap1Filter.frequency.setValueAtTime(2600, now);
    snap1Filter.Q.setValueAtTime(2.5, now);

    const snap1Gain = ctx.createGain();
    snap1Gain.gain.setValueAtTime(0.85, now);
    snap1Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.035);

    snap1Source.connect(snap1Filter);
    snap1Filter.connect(snap1Gain);
    snap1Gain.connect(ctx.destination);
    snap1Source.start(now);

    // 1B. Mirror body slap low thump (sine wave damping)
    const thumpOsc = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thumpOsc.type = 'triangle';
    thumpOsc.frequency.setValueAtTime(180, now);
    thumpOsc.frequency.exponentialRampToValueAtTime(60, now + 0.045);

    thumpGain.gain.setValueAtTime(0.7, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.045);

    thumpOsc.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thumpOsc.start(now);
    thumpOsc.stop(now + 0.05);

    // --- STAGE 2: Curtain Close & Mechanical Latch (crisp second click at t + 70ms) ---
    const t2 = now + 0.07;

    const snap2Buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.045), ctx.sampleRate);
    const snap2Data = snap2Buffer.getChannelData(0);
    for (let i = 0; i < snap2Data.length; i++) {
      snap2Data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
    }
    const snap2Source = ctx.createBufferSource();
    snap2Source.buffer = snap2Buffer;

    const snap2Filter = ctx.createBiquadFilter();
    snap2Filter.type = 'highpass';
    snap2Filter.frequency.setValueAtTime(1800, t2);

    const snap2Gain = ctx.createGain();
    snap2Gain.gain.setValueAtTime(0.95, t2);
    snap2Gain.gain.exponentialRampToValueAtTime(0.01, t2 + 0.045);

    snap2Source.connect(snap2Filter);
    snap2Filter.connect(snap2Gain);
    snap2Gain.connect(ctx.destination);
    snap2Source.start(t2);

    // Mechanical gear click in curtain travel
    const gearOsc = ctx.createOscillator();
    const gearGain = ctx.createGain();
    gearOsc.type = 'sine';
    gearOsc.frequency.setValueAtTime(420, t2);
    gearOsc.frequency.exponentialRampToValueAtTime(140, t2 + 0.03);

    gearGain.gain.setValueAtTime(0.5, t2);
    gearGain.gain.exponentialRampToValueAtTime(0.01, t2 + 0.035);

    gearOsc.connect(gearGain);
    gearGain.connect(ctx.destination);
    gearOsc.start(t2);
    gearOsc.stop(t2 + 0.04);
  } catch (err) {
    console.warn('Audio playback not supported or blocked by policy:', err);
  }
}
