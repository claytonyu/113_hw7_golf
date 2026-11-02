/**
 * Converts intended distances into launch speeds. Club carries are defined in
 * yards, so before a shot we search for the launch speed whose flat-ground,
 * windless flight lands at that carry. The real shot then runs the full
 * simulation (wind, terrain, curve) from that speed.
 */
import { airAccel, DT, SPIN_DECAY } from './sim'
import { ROLL } from '../config'
import { dirOf, type Hole } from '../course/course'

const NO_WIND = [0, 0, 0]
const FLAT_ACC = [0, 0, 0] // scratch buffer

/** Simulates a windless shot over flat ground at height 0. Returns carry, apex, flight time and landing angle. */
export function flatFlight(speed: number, launchDeg: number, spin: number) {
  const a = launchDeg * Math.PI / 180
  const v = [0, speed * Math.sin(a), speed * Math.cos(a)]
  const p = [0, 0, 0]
  let apex = 0, t = 0
  for (let i = 0; i < 2400; i++) {
    airAccel(v, NO_WIND, spin, FLAT_ACC)
    spin *= Math.exp(-SPIN_DECAY * DT)
    t += DT
    for (let k = 0; k < 3; k++) v[k] += FLAT_ACC[k] * DT
    p[1] += v[1] * DT
    p[2] += v[2] * DT
    apex = Math.max(apex, p[1])
    if (p[1] < 0) break
  }
  return { carry: p[2], apex, t, land: Math.atan2(-v[1], v[2]) * 180 / Math.PI }
}

/** Memoized results keyed by carry (to 0.1 m), launch angle and spin. */
const cache = new Map<string, number>()

/** Launch speed (m/s) that carries `carryM` meters on flat ground, found by binary search. */
export function speedForCarry(carryM: number, launchDeg: number, spin = 0) {
  const key = `${Math.round(carryM * 10)}|${launchDeg}|${spin}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  let lo = 1, hi = 120
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2
    if (flatFlight(mid, launchDeg, spin).carry < carryM) lo = mid
    else hi = mid
  }
  cache.set(key, lo)
  return lo
}

/** Spacing (m) of the lie samples along a putt's line. */
const PUTT_SAMPLE = 0.25

/** Speed (m/s) below which a rolling ball on gentle ground comes to rest (matches stepRoll). */
const REST_SPEED = 0.05

/**
 * Starting speed for a putt that rolls `d` meters along `heading` from `from`
 * on level ground. Each stretch of the line slows the ball by its own lie's
 * rolling friction (green, fringe, rough...), so putts from off the green get
 * enough pace. Slopes are deliberately left out: reading them is the player's job.
 *
 * Works backward from the resting point. Under deceleration a, one fixed sim
 * step that covers ds removes about 2·a·ds·(1 + a·DT/v) of v² (the second term
 * is the fixed-step integration's extra loss, which matters at low speed in rough).
 */
export function speedForPutt(hole: Hole, from: number[], heading: number, d: number) {
  const dist = Math.max(0.2, d)
  const [dx, dz] = dirOf(heading)
  let v = REST_SPEED
  for (let s = dist; s > 0; s -= PUTT_SAMPLE) {
    const ds = Math.min(PUTT_SAMPLE, s)
    const mid = s - ds / 2
    const a = ROLL[hole.lie(from[0] + dx * mid, from[2] + dz * mid)] ?? ROLL.green
    // Two half-stretches keep the low-speed term accurate.
    for (let k = 0; k < 2; k++) {
      const h = ds / 2
      v = Math.sqrt(v * v + 2 * a * h * (1 + a * DT / Math.max(v, a * DT)))
    }
  }
  return v
}
