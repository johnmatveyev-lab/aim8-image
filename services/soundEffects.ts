
// Audio Engine for UI Sound Effects
// Uses Web Audio API to generate sci-fi/AI interface sounds programmatically
// No external assets required.

let audioCtx: AudioContext | null = null;

const getContext = () => {
  if (!audioCtx) {
    const AudioContextPolyfill = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextPolyfill();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

// 1. Standard Button Hover - A quick, high-tech "blip"
export const playHoverSound = () => {
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // High tech sine wave
    osc.type = 'sine';
    
    // Slight randomization for organic AI feel
    const freq = 800 + Math.random() * 200; 
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.05);

    // Envelope
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch (e) {
    // Ignore audio errors (e.g. if context not ready)
  }
};

// 2. Button Click - A tactile "confirm" sound
export const playClickSound = () => {
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
};

// 3. Logo Sound - A "Neural Network" data stream effect
// Rapid burst of random high notes
export const playLogoSound = () => {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.08, now);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    masterGain.connect(ctx.destination);

    // Create a sequence of beeps
    const count = 8;
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = i % 2 === 0 ? 'sine' : 'square';
      
      // Random pentatonic-ish frequencies
      const notes = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.50];
      const freq = notes[Math.floor(Math.random() * notes.length)] * (Math.random() > 0.5 ? 2 : 1);
      
      const startTime = now + (i * 0.04);
      
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.05, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);

      osc.connect(gain);
      gain.connect(masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.15);
    }
  } catch (e) {}
};

// 4. Generation Start - A "Power Up" swell
export const playStartSound = () => {
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {}
};
