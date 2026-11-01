// Tiny synthesized sound kit (Web Audio, no assets).
let ctx: AudioContext | null = null
const ac = () => (ctx ??= new AudioContext())
export function unlockAudio() { const c = ac(); if (c.state === 'suspended') c.resume() }

function noise(dur: number, filterType: BiquadFilterType, freq: number, gain: number, q = 1, sweepTo?: number) {
  const c = ac(); const len = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = c.createBufferSource(); src.buffer = buf
  const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, c.currentTime + dur)
  const g = c.createGain(); g.gain.setValueAtTime(gain, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
  src.connect(f).connect(g).connect(c.destination); src.start()
}
function tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', delay = 0, slideTo?: number) {
  const c = ac(); const o = c.createOscillator(); o.type = type; const t = c.currentTime + delay
  o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05)
}
export const sfx = {
  tick: () => tone(1400, 0.04, 0.04, 'square'),
  click: () => tone(900, 0.05, 0.05, 'triangle'),
  start: () => noise(0.35, 'bandpass', 600, 0.15, 2, 1800),
  strike: (perfect: boolean) => { noise(0.08, 'highpass', 2500, 0.6); tone(perfect ? 1800 : 1100, 0.12, 0.25, 'triangle'); noise(0.5, 'bandpass', 2400, 0.12, 1.5, 500) },
  putt: () => { tone(700, 0.08, 0.2, 'triangle'); noise(0.04, 'highpass', 3000, 0.2) },
  thud: () => { tone(90, 0.15, 0.3, 'sine', 0, 50); noise(0.1, 'lowpass', 500, 0.2) },
  sand: () => noise(0.35, 'lowpass', 1800, 0.35, 0.7, 300),
  splash: () => { noise(0.9, 'lowpass', 2500, 0.5, 0.7, 200); tone(300, 0.3, 0.1, 'sine', 0.05, 120) },
  cup: () => { [0, 0.07, 0.13, 0.2].forEach((d, i) => tone(2200 - i * 300, 0.06, 0.12, 'triangle', d)); tone(180, 0.2, 0.25, 'sine', 0.22, 90) },
  cheer: (big: boolean) => { noise(big ? 2.6 : 1.6, 'bandpass', 1400, big ? 0.35 : 0.22, 0.6, 900); [523, 659, 784, big ? 1047 : 0].forEach((f, i) => f && tone(f, 0.35, 0.12, 'triangle', 0.15 + i * 0.1)) },
  groan: () => { noise(1.2, 'bandpass', 500, 0.15, 0.8, 250); tone(330, 0.5, 0.08, 'sine', 0, 220) },
}
