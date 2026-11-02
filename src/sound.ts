/**
 * Tiny synthesized sound kit built on the Web Audio API (no audio files).
 * Every effect is a mix of filtered noise bursts and short tones.
 */
let ctx: AudioContext | null = null

/** Lazily creates the shared AudioContext. */
const ac = () => (ctx ??= new AudioContext())

/** Resumes audio; browsers keep it suspended until the user interacts with the page. */
export function unlockAudio() {
  const c = ac()
  if (c.state === 'suspended') c.resume()
}

/**
 * Plays filtered white noise that fades out over `dur` seconds.
 * If `sweepTo` is given, the filter frequency slides there over the duration.
 */
function noise(dur: number, filterType: BiquadFilterType, freq: number, gain: number, q = 1, sweepTo?: number) {
  const c = ac()
  const len = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf

  const f = c.createBiquadFilter()
  f.type = filterType
  f.frequency.value = freq
  f.Q.value = q
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, c.currentTime + dur)

  const g = c.createGain()
  g.gain.setValueAtTime(gain, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)

  src.connect(f).connect(g).connect(c.destination)
  src.start()
}

/**
 * Plays a short tone with a quick attack and exponential decay, starting after `delay` seconds.
 * If `slideTo` is given, the pitch glides there over the duration.
 */
function tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', delay = 0, slideTo?: number) {
  const c = ac()
  const o = c.createOscillator()
  o.type = type
  const t = c.currentTime + delay
  o.frequency.setValueAtTime(freq, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)

  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)

  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** Named game sound effects. */
export const sfx = {
  /** Shot-shape adjustment. */
  tick: () => tone(1400, 0.04, 0.04, 'square'),
  /** Menu / club / camera click. */
  click: () => tone(900, 0.05, 0.05, 'triangle'),
  /** Backswing whoosh when the meter starts. */
  start: () => noise(0.35, 'bandpass', 600, 0.15, 2, 1800),
  /** Club contact; a perfect strike rings higher. */
  strike: (perfect: boolean) => {
    noise(0.08, 'highpass', 2500, 0.6)
    tone(perfect ? 1800 : 1100, 0.12, 0.25, 'triangle')
    noise(0.5, 'bandpass', 2400, 0.12, 1.5, 500)
  },
  putt: () => {
    tone(700, 0.08, 0.2, 'triangle')
    noise(0.04, 'highpass', 3000, 0.2)
  },
  /** Ball landing on grass. */
  thud: () => {
    tone(90, 0.15, 0.3, 'sine', 0, 50)
    noise(0.1, 'lowpass', 500, 0.2)
  },
  sand: () => noise(0.35, 'lowpass', 1800, 0.35, 0.7, 300),
  splash: () => {
    noise(0.9, 'lowpass', 2500, 0.5, 0.7, 200)
    tone(300, 0.3, 0.1, 'sine', 0.05, 120)
  },
  /** Ball rattling into the cup: four descending clicks and a low thunk. */
  cup: () => {
    [0, 0.07, 0.13, 0.2].forEach((delay, i) => tone(2200 - i * 300, 0.06, 0.12, 'triangle', delay))
    tone(180, 0.2, 0.25, 'sine', 0.22, 90)
  },
  /** Crowd noise plus a rising arpeggio; `big` adds length and a top note. */
  cheer: (big: boolean) => {
    noise(big ? 2.6 : 1.6, 'bandpass', 1400, big ? 0.35 : 0.22, 0.6, 900)
    const notes = big ? [523, 659, 784, 1047] : [523, 659, 784]
    notes.forEach((f, i) => tone(f, 0.35, 0.12, 'triangle', 0.15 + i * 0.1))
  },
  /** Coins earned: two quick bright pings. */
  coin: () => {
    tone(1568, 0.09, 0.12, 'triangle')
    tone(2093, 0.18, 0.12, 'triangle', 0.08)
  },
  groan: () => {
    noise(1.2, 'bandpass', 500, 0.15, 0.8, 250)
    tone(330, 0.5, 0.08, 'sine', 0, 220)
  },
}
