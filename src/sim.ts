import type { Hole, Lie } from './course'
import { dirOf } from './course'
export const G = 9.81, DT = 1 / 120, KD = 0.0050, LIFT = 1.0, SPIN_DECAY = 0.1, CURVE_A = 1.7
const ROLL: Record<string, number> = { green: 0.55, fairway: 3.2, tee: 3.2, rough: 6.5, sand: 9, water: 20, oob: 3 }
const BOUNCE: Record<string, [number, number]> = { green: [0.25, 0.25], fairway: [0.35, 0.3], tee: [0.35, 0.3], rough: [0.15, 0.6], sand: [0.03, 0.9], water: [0, 1], oob: [0.2, 0.5] }
export type Mode = 'air' | 'roll' | 'rest' | 'holed' | 'water' | 'oob'
export interface Ball { p: number[]; v: number[]; mode: Mode; t: number; curve: number; v0: number; contacts: number; spin: number; spin0: number }

// Shared aerodynamic model: quadratic drag + backspin lift (perpendicular to velocity, in the vertical plane), spin decays over time.
export function airAccel(v: number[], wind: number[], spin: number, out: number[]) {
  const vr0 = v[0] - wind[0], vr1 = v[1] - wind[1], vr2 = v[2] - wind[2]
  const sp = Math.hypot(vr0, vr1, vr2) || 1e-6
  const hs = Math.hypot(vr0, vr2) || 1e-6
  // lift direction: up-perpendicular to velocity
  const lx = -vr0 / hs * (vr1 / sp), ly = hs / sp, lz = -vr2 / hs * (vr1 / sp)
  const L = LIFT * spin * sp
  out[0] = -KD * sp * vr0 + L * lx; out[1] = -KD * sp * vr1 + L * ly - G; out[2] = -KD * sp * vr2 + L * lz
  return sp
}

export function launch(p: number[], heading: number, speed: number, launchDeg: number, curve: number, spin = 0): Ball {
  const [dx, dz] = dirOf(heading); const a = launchDeg * Math.PI / 180
  const c = Math.cos(a), s = Math.sin(a)
  return { p: [...p], v: [dx * speed * c, speed * s, dz * speed * c], mode: launchDeg === 0 ? 'roll' : 'air', t: 0, curve, v0: speed, contacts: 0, spin, spin0: spin }
}

function normal(h: Hole, x: number, z: number): number[] {
  const e = 0.3
  const gx = (h.height(x + e, z) - h.height(x - e, z)) / (2 * e), gz = (h.height(x, z + e) - h.height(x, z - e)) / (2 * e)
  const l = Math.hypot(gx, 1, gz); return [-gx / l, 1 / l, -gz / l]
}
export function grad(h: Hole, x: number, z: number) {
  const e = 0.3
  return [(h.height(x + e, z) - h.height(x - e, z)) / (2 * e), (h.height(x, z + e) - h.height(x, z - e)) / (2 * e)]
}

// Advance one fixed step. Returns 'contact' on first ground contact.
const ACC = [0, 0, 0]
export function step(b: Ball, hole: Hole, wind: number[]): 'contact' | null {
  b.t += DT
  const [px, , pz] = b.p
  if (b.mode === 'air') {
    const sp = airAccel(b.v, wind, b.spin, ACC)
    b.spin *= Math.exp(-SPIN_DECAY * DT)
    const hs = Math.hypot(b.v[0], b.v[2]) || 1
    const ca = b.curve * CURVE_A * Math.min(1, sp / b.v0) // curve: - = draw (left), + = fade (right)
    const rx = -b.v[2] / hs, rz = b.v[0] / hs
    b.v[0] += (ACC[0] + ca * rx) * DT
    b.v[1] += ACC[1] * DT
    b.v[2] += (ACC[2] + ca * rz) * DT
    b.p[0] += b.v[0] * DT; b.p[1] += b.v[1] * DT; b.p[2] += b.v[2] * DT
    const h = hole.height(b.p[0], b.p[2])
    if (b.p[1] <= h) {
      const lie = hole.lie(b.p[0], b.p[2])
      b.p[1] = h; b.contacts++
      if (lie === 'water' || lie === 'oob') { b.mode = lie; return 'contact' }
      if (cupCheck(b, hole, 2.5)) return 'contact'
      const n = normal(hole, b.p[0], b.p[2]); const vn = b.v[0] * n[0] + b.v[1] * n[1] + b.v[2] * n[2]
      // backspin bites on the first bounce: wedges check up, drivers release
      const bite = b.contacts === 1 ? Math.min(0.75, b.spin0 * (lie === 'green' ? 3.2 : lie === 'fairway' ? 2.2 : 1.2)) : 0
      const e = BOUNCE[lie][0], f = Math.min(0.95, BOUNCE[lie][1] + bite)
      const vt = [b.v[0] - vn * n[0], b.v[1] - vn * n[1], b.v[2] - vn * n[2]]
      if (-vn * e > 1.2) {
        for (let i = 0; i < 3; i++) b.v[i] = vt[i] * (1 - f) - vn * e * n[i]
        b.p[1] = h + 0.002
      } else { b.mode = 'roll'; b.v = [vt[0] * (1 - f * 0.5), 0, vt[2] * (1 - f * 0.5)] }
      return b.contacts === 1 ? 'contact' : null
    }
    return null
  }
  if (b.mode === 'roll') {
    const lie = hole.lie(px, pz)
    if (lie === 'water' || lie === 'oob') { b.mode = lie; return null }
    const [gx, gz] = grad(hole, px, pz)
    const ax = -G * 0.71 * gx, az = -G * 0.71 * gz
    const dec = ROLL[lie]; const s = Math.hypot(b.v[0], b.v[2])
    if (s < 0.05 && Math.hypot(ax, az) < dec * 0.9) { b.mode = 'rest'; b.v = [0, 0, 0]; return null }
    const fx = s > 1e-6 ? -dec * b.v[0] / s : 0, fz = s > 1e-6 ? -dec * b.v[2] / s : 0
    b.v[0] += (ax + fx) * DT; b.v[2] += (az + fz) * DT
    b.p[0] += b.v[0] * DT; b.p[2] += b.v[2] * DT
    b.p[1] = hole.height(b.p[0], b.p[2])
    cupCheck(b, hole, 1.6)
    if (b.t > 45) { b.mode = 'rest'; b.v = [0, 0, 0] }
  }
  return null
}

function cupCheck(b: Ball, hole: Hole, maxSpeed: number) {
  const d = Math.hypot(b.p[0] - hole.pin[0], b.p[2] - hole.pin[1]); const s = Math.hypot(b.v[0], b.v[2])
  if ((d < 0.08 && s < maxSpeed) || (d < 0.14 && s < 0.6)) { b.mode = 'holed'; b.p = [hole.pin[0], hole.height(hole.pin[0], hole.pin[1]) - 0.05, hole.pin[1]]; b.v = [0, 0, 0]; return true }
  return false
}

// Flat-ground, no-wind carry for a given launch speed — used to calibrate club distances.
const NOWIND = [0, 0, 0], FA = [0, 0, 0]
export function flatFlight(speed: number, launchDeg: number, spin: number) {
  const a = launchDeg * Math.PI / 180; const v = [0, speed * Math.sin(a), speed * Math.cos(a)]; const p = [0, 0, 0]
  let apex = 0, t = 0
  for (let i = 0; i < 2400; i++) {
    airAccel(v, NOWIND, spin, FA); spin *= Math.exp(-SPIN_DECAY * DT); t += DT
    for (let k = 0; k < 3; k++) v[k] += FA[k] * DT
    p[1] += v[1] * DT; p[2] += v[2] * DT; apex = Math.max(apex, p[1])
    if (p[1] < 0) break
  }
  return { carry: p[2], apex, t, land: Math.atan2(-v[1], v[2]) * 180 / Math.PI }
}
const cache = new Map<string, number>()
export function speedForCarry(carryM: number, launchDeg: number, spin = 0) {
  const key = `${Math.round(carryM * 10)}|${launchDeg}|${spin}`
  if (cache.has(key)) return cache.get(key)!
  let lo = 1, hi = 120
  for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; if (flatFlight(m, launchDeg, spin).carry < carryM) lo = m; else hi = m }
  cache.set(key, lo); return lo
}
export const speedForPutt = (d: number) => Math.sqrt(2 * ROLL.green * Math.max(0.2, d))

export function lieAt(hole: Hole, p: number[]): Lie { return hole.lie(p[0], p[2]) }
