/**
 * Ball physics on a fixed 1/120 s timestep. The shot preview, the real shot
 * and the landing-camera prediction all run this exact code, so a perfect
 * strike follows its preview.
 *
 * A ball is either in the air (drag, backspin lift, wind, draw/fade curve,
 * bouncing on contact) or rolling (slope gravity and per-lie friction) until
 * it comes to rest, drops in the cup, or leaves play.
 */
import type { Hole, Lie } from '../course/course'
import { dirOf } from '../course/course'
import { BOUNCE, ROLL } from '../config'

export const G = 9.81           // gravity (m/s^2)
export const DT = 1 / 120       // fixed simulation step (s)
export const KD = 0.0050        // quadratic drag coefficient
export const LIFT = 1.0         // lift per unit of spin and speed
export const SPIN_DECAY = 0.1   // backspin decay rate (1/s)
export const CURVE_A = 1.7      // sideways acceleration (m/s^2) at full draw/fade

// Per-lie rolling deceleration (ROLL) and bounce (BOUNCE) tables live in config.ts.

/** Fraction of slope gravity that accelerates a rolling ball (5/7 for a solid rolling sphere). */
export const ROLL_SLOPE = 0.71

/**
 * Ball mode when it reaches an unplayable lie. Water and dry penalty areas
 * (canyons, cliffs) both end the shot as 'water' (a penalty area); 'oob' stays 'oob'.
 */
const endMode = (lie: Lie): Mode | null => (lie === 'water' || lie === 'hazard' ? 'water' : lie === 'oob' ? 'oob' : null)

/** A ball stops bouncing and starts rolling once its rebound speed drops below this (m/s). */
const MIN_BOUNCE = 1.2

/** Safety cap: any ball still rolling after this many seconds is stopped. */
const MAX_SHOT_TIME = 45

export type Mode = 'air' | 'roll' | 'rest' | 'holed' | 'water' | 'oob'

export interface Ball {
  p: number[]       // position
  v: number[]       // velocity
  mode: Mode
  t: number         // seconds since launch
  curve: number     // draw/fade amount: negative = draw (left), positive = fade (right)
  v0: number        // launch speed
  contacts: number  // number of ground contacts so far
  spin: number      // current backspin
  spin0: number     // backspin at launch
}

/** True while the ball is still in the air or rolling. */
export const isMoving = (b: Ball) => b.mode === 'air' || b.mode === 'roll'

/**
 * Steps `b` until it stops (or `maxSteps` runs out), using the same fixed
 * steps as live play. `onContact` is called at the first ground contact.
 */
export function simulateToRest(b: Ball, hole: Hole, wind: number[], onContact?: (b: Ball) => void, maxSteps = 8000) {
  for (let i = 0; i < maxSteps && isMoving(b); i++) {
    if (step(b, hole, wind) && onContact) onContact(b)
  }
  return b
}

/** Copies a ball so it can be simulated ahead without touching the original. */
export function cloneBall(b: Ball): Ball {
  return { ...b, p: [...b.p], v: [...b.v] }
}

/**
 * Aerodynamic acceleration (excluding curve) written into `out`: quadratic drag
 * plus backspin lift, both relative to the wind, plus gravity. Lift acts
 * perpendicular to the velocity in its vertical plane. Returns air speed.
 */
export function airAccel(v: number[], wind: number[], spin: number, out: number[]) {
  const vr0 = v[0] - wind[0], vr1 = v[1] - wind[1], vr2 = v[2] - wind[2]
  const sp = Math.hypot(vr0, vr1, vr2) || 1e-6
  const hs = Math.hypot(vr0, vr2) || 1e-6
  // Unit lift direction: "up" rotated to be perpendicular to the velocity.
  const lx = -vr0 / hs * (vr1 / sp)
  const ly = hs / sp
  const lz = -vr2 / hs * (vr1 / sp)
  const L = LIFT * spin * sp
  out[0] = -KD * sp * vr0 + L * lx
  out[1] = -KD * sp * vr1 + L * ly - G
  out[2] = -KD * sp * vr2 + L * lz
  return sp
}

/** Creates a ball at `p` leaving along `heading`. A zero launch angle (putts) starts it rolling. */
export function launch(p: number[], heading: number, speed: number, launchDeg: number, curve: number, spin = 0): Ball {
  const [dx, dz] = dirOf(heading)
  const a = launchDeg * Math.PI / 180
  const c = Math.cos(a), s = Math.sin(a)
  return {
    p: [...p],
    v: [dx * speed * c, speed * s, dz * speed * c],
    mode: launchDeg === 0 ? 'roll' : 'air',
    t: 0, curve, v0: speed, contacts: 0, spin, spin0: spin,
  }
}

/** Terrain slope at (x, z) by central differences: [dh/dx, dh/dz]. */
export function grad(h: Hole, x: number, z: number) {
  const e = 0.3
  return [
    (h.height(x + e, z) - h.height(x - e, z)) / (2 * e),
    (h.height(x, z + e) - h.height(x, z - e)) / (2 * e),
  ]
}

/** Unit surface normal at (x, z). */
function normal(h: Hole, x: number, z: number): number[] {
  const [gx, gz] = grad(h, x, z)
  const l = Math.hypot(gx, 1, gz)
  return [-gx / l, 1 / l, -gz / l]
}

/**
 * Advances the ball by one fixed step. Returns 'contact' on the first ground
 * contact (the preview's landing point) and when the ball hits water/OOB or the cup.
 */
export function step(b: Ball, hole: Hole, wind: number[]): 'contact' | null {
  b.t += DT
  if (b.mode === 'air') return stepAir(b, hole, wind)
  if (b.mode === 'roll') stepRoll(b, hole)
  return null
}

const ACC = [0, 0, 0] // scratch buffer reused every step to avoid allocations

/** One step of flight: aerodynamics, draw/fade curve, then a ground check. */
function stepAir(b: Ball, hole: Hole, wind: number[]): 'contact' | null {
  const sp = airAccel(b.v, wind, b.spin, ACC)
  b.spin *= Math.exp(-SPIN_DECAY * DT)

  // Draw/fade: push sideways (perpendicular to horizontal velocity), fading as the ball slows.
  const hs = Math.hypot(b.v[0], b.v[2]) || 1
  const ca = b.curve * CURVE_A * Math.min(1, sp / b.v0)
  const rx = -b.v[2] / hs, rz = b.v[0] / hs

  b.v[0] += (ACC[0] + ca * rx) * DT
  b.v[1] += ACC[1] * DT
  b.v[2] += (ACC[2] + ca * rz) * DT
  b.p[0] += b.v[0] * DT
  b.p[1] += b.v[1] * DT
  b.p[2] += b.v[2] * DT

  const ground = hole.height(b.p[0], b.p[2])
  if (b.p[1] > ground) return null
  return landOrBounce(b, hole, ground)
}

/** Handles a ground contact: hazards, cup, then a bounce or a switch to rolling. */
function landOrBounce(b: Ball, hole: Hole, ground: number): 'contact' | null {
  const lie = hole.lie(b.p[0], b.p[2])
  b.p[1] = ground
  b.contacts++
  const end = endMode(lie)
  if (end) { b.mode = end; return 'contact' }
  if (cupCheck(b, hole, 2.5)) return 'contact'

  // Split velocity into the part into the ground (vn) and the part along it (vt).
  const n = normal(hole, b.p[0], b.p[2])
  const vn = b.v[0] * n[0] + b.v[1] * n[1] + b.v[2] * n[2]
  const vt = [b.v[0] - vn * n[0], b.v[1] - vn * n[1], b.v[2] - vn * n[2]]

  // Backspin "bites" on the first bounce: wedges check up, drivers release.
  const biteByLie = lie === 'green' ? 3.2 : lie === 'fairway' ? 2.2 : 1.2
  const bite = b.contacts === 1 ? Math.min(0.75, b.spin0 * biteByLie) : 0
  const restitution = BOUNCE[lie][0]
  const friction = Math.min(0.95, BOUNCE[lie][1] + bite)

  if (-vn * restitution > MIN_BOUNCE) {
    for (let i = 0; i < 3; i++) b.v[i] = vt[i] * (1 - friction) - vn * restitution * n[i]
    b.p[1] = ground + 0.002 // lift slightly so the next step starts above the ground
  } else {
    b.mode = 'roll'
    b.v = [vt[0] * (1 - friction * 0.5), 0, vt[2] * (1 - friction * 0.5)]
  }
  return b.contacts === 1 ? 'contact' : null
}

/** One step of rolling: slope gravity, rolling friction, cup check, and coming to rest. */
function stepRoll(b: Ball, hole: Hole) {
  const [px, , pz] = b.p
  const lie: Lie = hole.lie(px, pz)
  const end = endMode(lie)
  if (end) { b.mode = end; return }

  const [gx, gz] = grad(hole, px, pz)
  const ax = -G * ROLL_SLOPE * gx, az = -G * ROLL_SLOPE * gz
  const dec = ROLL[lie]
  const s = Math.hypot(b.v[0], b.v[2])

  // Stop when nearly still and the slope is too gentle to overcome friction.
  if (s < 0.05 && Math.hypot(ax, az) < dec * 0.9) { b.mode = 'rest'; b.v = [0, 0, 0]; return }

  // Friction opposes the direction of travel.
  const fx = s > 1e-6 ? -dec * b.v[0] / s : 0
  const fz = s > 1e-6 ? -dec * b.v[2] / s : 0
  b.v[0] += (ax + fx) * DT
  b.v[2] += (az + fz) * DT
  b.p[0] += b.v[0] * DT
  b.p[2] += b.v[2] * DT
  b.p[1] = hole.height(b.p[0], b.p[2])

  cupCheck(b, hole, 1.6)
  if (b.t > MAX_SHOT_TIME) { b.mode = 'rest'; b.v = [0, 0, 0] }
}

/**
 * Drops the ball in the cup if it is close enough and slow enough.
 * Dead center (8 cm) accepts up to `maxSpeed`; the lip (14 cm) only accepts very slow balls.
 */
function cupCheck(b: Ball, hole: Hole, maxSpeed: number) {
  const d = Math.hypot(b.p[0] - hole.pin[0], b.p[2] - hole.pin[1])
  const s = Math.hypot(b.v[0], b.v[2])
  if ((d < 0.08 && s < maxSpeed) || (d < 0.14 && s < 0.6)) {
    b.mode = 'holed'
    b.p = [hole.pin[0], hole.height(hole.pin[0], hole.pin[1]) - 0.05, hole.pin[1]]
    b.v = [0, 0, 0]
    return true
  }
  return false
}
