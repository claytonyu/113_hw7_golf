/**
 * Turns a HoleDef into playable geometry: a centerline path, a terrain height
 * function, and a lie (surface type) function. Physics, rendering and the HUD
 * all query these same functions, so what you see is what the ball hits.
 *
 * Coordinates: x/z is the ground plane, y is up. Every hole starts at the
 * origin and initially plays toward +z.
 */
import { YD } from '../config'
import type { HoleDef } from './holes'

export type Lie = 'tee' | 'fairway' | 'rough' | 'sand' | 'green' | 'water' | 'oob'

/** A circle on the ground: [x, z, radius]. */
type Circle = [number, number, number]

export interface Hole {
  def: HoleDef
  path: [number, number][]  // centerline corners from tee to green center
  len: number               // nominal hole length in meters
  green: [number, number]   // green center
  pin: [number, number]
  tee: [number, number]
  bunkers: Circle[]
  ponds: Circle[]
  wind: [number, number, number] // world-space wind velocity (m/s)
  project(x: number, z: number): { along: number; lat: number; dist: number }
  height(x: number, z: number): number
  lie(x: number, z: number): Lie
}

/** One straight leg of the centerline. */
interface Segment {
  a: [number, number]   // start point
  b: [number, number]   // end point
  l: number             // length
  d: [number, number]   // unit direction
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/**
 * Smoothstep from e0 to e1. Passing e0 > e1 gives a falloff
 * (1 near e1, fading to 0 at e0), which is used for blending features in.
 */
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * Unit ground direction for a heading angle (radians).
 * Convention: heading 0 points to +z, and positive headings turn right (toward -x).
 */
export const dirOf = (h: number): [number, number] => [-Math.sin(h), Math.cos(h)]

/** Heading angle (radians) that points from `from` (a 3D point) toward ground point (x, z). Inverse of dirOf. */
export function headingTo(from: number[], x: number, z: number): number {
  return Math.atan2(-(x - from[0]), z - from[2])
}

/** Builds the centerline by walking each leg from the tee at the origin. */
function buildPath(def: HoleDef, len: number): [number, number][] {
  const path: [number, number][] = [[0, 0]]
  for (const [frac, headingDeg] of def.legs) {
    const [dx, dz] = dirOf(headingDeg * Math.PI / 180)
    const [px, pz] = path[path.length - 1]
    path.push([px + dx * frac * len, pz + dz * frac * len])
  }
  return path
}

/** Splits the path into straight segments with lengths and unit directions. */
function buildSegments(path: [number, number][]): Segment[] {
  return path.slice(1).map((b, i) => {
    const a = path[i]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    return { a, b, l, d: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] }
  })
}

/**
 * Point at distance `s` along the centerline, plus the unit vector to the
 * player's right at that point: [x, z, rightX, rightZ]. Distances past the end
 * extend the last segment.
 */
function pointAlong(segs: Segment[], s: number): [number, number, number, number] {
  let acc = 0
  for (const sg of segs) {
    const isLast = sg === segs[segs.length - 1]
    if (s <= acc + sg.l || isLast) {
      const t = s - acc
      return [sg.a[0] + sg.d[0] * t, sg.a[1] + sg.d[1] * t, -sg.d[1], sg.d[0]]
    }
    acc += sg.l
  }
  return [0, 0, -1, 0]
}

/** Converts a [fraction along, lateral offset, radius] feature into a world-space circle. */
function featureToWorld(segs: Segment[], len: number, [frac, lat, r]: Circle): Circle {
  const [x, z, rx, rz] = pointAlong(segs, frac * len)
  return [x + rx * lat, z + rz * lat, r]
}

/** Rotates the first leg's direction by the hole's wind angle (positive = to the right) and scales by speed. */
function windVector(def: HoleDef, firstLeg: [number, number]): [number, number, number] {
  const angle = def.wind[1] * Math.PI / 180
  const speed = def.wind[0] * 0.447 // mph -> m/s
  const right: [number, number] = [-firstLeg[1], firstLeg[0]]
  return [
    (firstLeg[0] * Math.cos(angle) + right[0] * Math.sin(angle)) * speed,
    0,
    (firstLeg[1] * Math.cos(angle) + right[1] * Math.sin(angle)) * speed,
  ]
}

/**
 * Projects a ground point onto the nearest centerline segment.
 * Returns distance along the hole, signed lateral offset (+ = right) and unsigned distance.
 * `along` can be negative behind the tee or exceed the length past the green.
 */
function projectOnto(segs: Segment[], x: number, z: number) {
  let best = { along: 0, lat: 0, dist: 1e9 }
  let acc = 0
  segs.forEach((sg, i) => {
    const raw = (x - sg.a[0]) * sg.d[0] + (z - sg.a[1]) * sg.d[1]
    const t = clamp(raw, 0, sg.l)
    const px = sg.a[0] + sg.d[0] * t
    const pz = sg.a[1] + sg.d[1] * t
    const dist = Math.hypot(x - px, z - pz)
    if (dist < best.dist) {
      const lat = (x - px) * -sg.d[1] + (z - pz) * sg.d[0]
      // Only the first and last segments are allowed to extend beyond their ends.
      const beforeTee = i === 0 && raw < 0
      const pastGreen = i === segs.length - 1 && raw > sg.l
      const along = acc + (beforeTee || pastGreen ? raw : t)
      best = { along, lat: Math.sign(lat || 1) * dist, dist }
    }
    acc += sg.l
  })
  return best
}

/** Shared data that the height and lie functions need. */
interface HoleShape {
  def: HoleDef
  len: number
  green: [number, number]
  bunkers: Circle[]
  ponds: Circle[]
  project: (x: number, z: number) => { along: number; lat: number; dist: number }
}

/**
 * Terrain height at (x, z). Layers, in order:
 * gentle tee-to-green elevation change, rolling bumps (stronger off the fairway),
 * banks rising away from the fairway, a flat tilted green, bunker and pond
 * depressions, and finally the drop to the ocean.
 */
function heightAt(shape: HoleShape, x: number, z: number): number {
  const { def, len, green, bunkers, ponds } = shape
  const p = shape.project(x, z)
  const n = def.num // per-hole phase so every hole's bumps differ

  // Elevation change plus undulation. Bumps are larger the further you are from the centerline.
  const progress = clamp(p.along / len, 0, 1)
  const offFairway = smooth(def.width * 0.4, def.width * 1.5, p.dist)
  const bumpScale = 0.6 + 1.6 * offFairway
  let h = def.elev * progress
    + bumpScale * Math.sin(x * 0.021 + n) * Math.cos(z * 0.017 + n * 2)
    + 0.5 * Math.sin(x * 0.05 + z * 0.04 + n)

  // Banks rise up to 3 m away from the fairway.
  h += 3 * smooth(def.width, def.width * 3, p.dist)

  // Blend into a flat, tilted green plane near the green.
  const distToGreen = Math.hypot(x - green[0], z - green[1])
  const greenHeight = def.elev + def.slope[0] * (x - green[0]) + def.slope[1] * (z - green[1])
  h += (greenHeight - h) * smooth(def.greenR + 10, def.greenR, distToGreen)

  // Bunkers are shallow 0.7 m dips; ponds are 2.5 m deep.
  for (const [bx, bz, r] of bunkers) {
    const d = Math.hypot(x - bx, z - bz)
    if (d < r + 1.5) h -= 0.7 * smooth(r + 1.5, r * 0.6, d)
  }
  for (const [px, pz, r] of ponds) {
    const d = Math.hypot(x - px, z - pz)
    if (d < r + 3) h -= 2.5 * smooth(r + 3, r, d)
  }

  // Cliff: past `ocean.dist` on the ocean side, the ground drops to -24 m over 14 m.
  if (def.ocean) {
    const towardOcean = p.lat * def.ocean.side
    if (towardOcean > def.ocean.dist) h += (-24 - h) * smooth(def.ocean.dist, def.ocean.dist + 14, towardOcean)
  }
  return h
}

/** Surface type at (x, z). Checks run in priority order: water, out of bounds, green, sand, tee, fairway, rough. */
function lieAt(shape: HoleShape, x: number, z: number): Lie {
  const { def, len, green, bunkers, ponds } = shape
  const p = shape.project(x, z)

  if (def.ocean && p.lat * def.ocean.side > def.ocean.dist + 4) return 'water'
  for (const [px, pz, r] of ponds) if (Math.hypot(x - px, z - pz) < r) return 'water'
  if (p.dist > 95 || p.along < -40 || p.along > len + 60) return 'oob'
  if (Math.hypot(x - green[0], z - green[1]) < def.greenR) return 'green'
  for (const [bx, bz, r] of bunkers) if (Math.hypot(x - bx, z - bz) < r) return 'sand'
  if (p.along < 6 && p.along > -6 && p.dist < 5) return 'tee'

  // Par 3s only have fairway in the last 40 m; longer holes start fairway 95 m out.
  // The fairway narrows by 30% over the final 60 m before the green.
  const fairwayStart = def.par === 3 ? len - 40 : 95
  const halfWidth = def.width / 2 * (1 - 0.3 * smooth(len - 60, len, p.along))
  if (p.dist < halfWidth && p.along > fairwayStart) return 'fairway'
  return 'rough'
}

/** Builds the full playable Hole (geometry plus height and lie queries) from its definition. */
export function buildHole(def: HoleDef): Hole {
  const len = def.yards * YD
  const path = buildPath(def, len)
  const segs = buildSegments(path)
  const green = path[path.length - 1]
  const pin: [number, number] = [green[0] + def.pin[0], green[1] + def.pin[1]]
  const bunkers = def.bunkers.map(b => featureToWorld(segs, len, b))
  const ponds = (def.ponds ?? []).map(p => featureToWorld(segs, len, p))
  const wind = windVector(def, segs[0].d)
  const project = (x: number, z: number) => projectOnto(segs, x, z)

  const shape: HoleShape = { def, len, green, bunkers, ponds, project }
  const height = (x: number, z: number) => heightAt(shape, x, z)
  const lie = (x: number, z: number) => lieAt(shape, x, z)

  return { def, path, len, green, pin, tee: [0, 0], bunkers, ponds, wind, project, height, lie }
}

/**
 * Point at fraction f (0 = tee, 1 = green) of the way along the hole's path.
 * Used by the intro flyover camera.
 */
export function pathPoint(h: Hole, f: number): [number, number] {
  const segs = buildSegments(h.path)
  const total = segs.reduce((sum, sg) => sum + sg.l, 0)
  let s = clamp(f, 0, 1) * total
  for (const { a, b, l } of segs) {
    if (s <= l) return [a[0] + (b[0] - a[0]) * s / l, a[1] + (b[1] - a[1]) * s / l]
    s -= l
  }
  return h.green
}
