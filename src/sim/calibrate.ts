/**
 * Converts intended distances into launch speeds. Club carries are defined in
 * yards, so before a shot we search for the launch speed whose flat-ground,
 * windless flight lands at that carry. The real shot then runs the full
 * simulation (wind, terrain, curve) from that speed.
 */
import { airAccel, DT, ROLL, SPIN_DECAY } from './sim'

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

/**
 * Starting speed for a putt that rolls `d` meters on a flat green.
 * Under constant deceleration a, distance = v^2 / 2a, so v = sqrt(2 a d).
 */
export const speedForPutt = (d: number) => Math.sqrt(2 * ROLL.green * Math.max(0.2, d))
