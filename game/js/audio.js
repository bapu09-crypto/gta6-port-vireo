// Procedural sound: every tone is generated with WebAudio, no audio files.
let ctx = null;
let engineOsc = null;
let engineGain = null;
let sirenTimer = null;
let muted = false;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setMuted(m) { muted = m; if (muted) stopEngine(); }
export function isMuted() { return muted; }

function tone(freq, dur, type = 'sine', vol = 0.15, slideTo = null) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

function noiseBurst(dur, vol = 0.25, lowpass = 1200) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

export function playGunshot() { noiseBurst(0.14, 0.3, 2600); tone(180, 0.08, 'square', 0.08, 60); }
export function playPunch() { noiseBurst(0.09, 0.2, 500); }
export function playChime() { tone(880, 0.12, 'sine', 0.12); setTimeout(() => tone(1318, 0.18, 'sine', 0.12), 90); }
export function playPickup() { tone(660, 0.1, 'triangle', 0.12); setTimeout(() => tone(990, 0.14, 'triangle', 0.12), 70); }
export function playMissionComplete() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.14), i * 120));
}
export function playMissionFail() { tone(220, 0.4, 'sawtooth', 0.1, 110); }
export function playExplosion() { noiseBurst(0.7, 0.4, 800); tone(90, 0.5, 'sine', 0.2, 40); }
export function playBusted() { tone(440, 0.3, 'square', 0.1, 220); setTimeout(() => tone(330, 0.4, 'square', 0.1, 165), 250); }
export function playClick() { tone(1200, 0.05, 'sine', 0.08); }

export function startEngine() {
  if (muted) return;
  const c = ac();
  if (!c || engineOsc) return;
  engineOsc = c.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  engineGain = c.createGain();
  engineGain.gain.value = 0.03;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 320;
  engineOsc.connect(f).connect(engineGain).connect(c.destination);
  engineOsc.start();
}

export function setEngineSpeed(ratio) {
  if (!engineOsc || !engineGain) return;
  engineOsc.frequency.setTargetAtTime(55 + ratio * 90, ctx.currentTime, 0.08);
  engineGain.gain.setTargetAtTime(0.02 + ratio * 0.05, ctx.currentTime, 0.08);
}

export function stopEngine() {
  if (engineOsc) { try { engineOsc.stop(); } catch (e) { /* already stopped */ } engineOsc = null; engineGain = null; }
}

export function startSiren() {
  if (sirenTimer || muted) return;
  let high = true;
  sirenTimer = setInterval(() => {
    if (muted) { stopSiren(); return; }
    tone(high ? 950 : 700, 0.28, 'sine', 0.045);
    high = !high;
  }, 300);
}

export function stopSiren() {
  if (sirenTimer) { clearInterval(sirenTimer); sirenTimer = null; }
}
