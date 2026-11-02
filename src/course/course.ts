/**
 * Turns a HoleDef into playable geometry: a centerline path, a terrain height
 * function, and a lie (surface type) function. Physics, rendering and the HUD
 * all query these same functions, so what you see is what the ball hits.
 *
 * Coordinates: x/z is the ground plane, y is up. Every hole starts at the
 * origin and initially plays toward +z.
 */
import { OCEAN_Y, YD } from '../config'
import type { Canyon, HoleDef } from './holes'

/**
 * Surface types. 'water' is ocean or pond; 'hazard' is a dry penalty area
 * (canyon, cliff face or beach). Both are penalty areas with a relief drop.
 */
export type Lie = 'tee' | 'fairway' | 'rough' | 'sand' | 'green' | 'water' | 'hazard' | 'oob'

/** Lies a ball cannot be played from. */
export const outOfPlay = (lie: Lie) => lie === 'water' || lie === 'hazard' || lie === 'oob'

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
  /** Distance from the green center, scaled so that values below def.greenR are on the (possibly oval) green. */
  greenDist(x: number, z: number): number
  /** Fairway half-width (m) at distance `along` down the hole. */
  halfWidth(along: number): number
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
  greenDist: (x: number, z: number) => number
  halfWidth: (along: number) => number
}

/** Canyon depth (m) below the surrounding ground. */
const CANYON_DEPTH = 7

/** Ground elevation (before bumps) at fraction `f` of the hole, following the hole's elevation profile. */
function baseElevation(def: HoleDef, f: number) {
  const pts: [number, number][] = [[0, 0], ...(def.profile ?? []), [1, def.elev]]
  for (let i = 1; i < pts.length; i++) {
    const [f1, h1] = pts[i]
    if (f <= f1) {
      const [f0, h0] = pts[i - 1]
      return h0 + (h1 - h0) * smooth(f0, f1, f)
    }
  }
  return def.elev
}

/** How deep inside a canyon band a point is: 1 well inside, 0 outside, smooth at the edges. */
function canyonDepthFactor(c: Canyon, len: number, along: number, lat: number) {
  const half = c.width / 2
  const d = Math.abs(along - c.at * len)
  return smooth(half + 1, half - 4, d) * smooth(c.from - 1, c.from + 4, lat) * smooth(c.to + 1, c.to - 4, lat)
}

/** True when the point lies inside a canyon's penalty-area band. */
function inCanyon(c: Canyon, len: number, along: number, lat: number) {
  return Math.abs(along - c.at * len) < c.width / 2 && lat > c.from && lat < c.to
}

/** Signed distance past the cliff edge on the ocean side (negative = inland of it). */
function pastCliff(def: HoleDef, lat: number) {
  return def.ocean ? lat * def.ocean.side - def.ocean.dist : -Infinity
}

/** Width of the cliff top (m) between the edge and the start of the visible rock face. */
export const CLIFF_LIP = 1

/**
 * Terrain height at (x, z). Layers, in order:
 * the hole's tee-to-green elevation profile, rolling bumps (stronger off the fairway),
 * banks rising away from the fairway, a flat tilted green, bunker, pond and
 * canyon depressions, and finally the drop to the ocean.
 */
function heightAt(shape: HoleShape, x: number, z: number): number {
  const { def, len, green, bunkers, ponds } = shape
  const p = shape.project(x, z)
  const n = def.num // per-hole phase so every hole's bumps differ
  const fw = shape.halfWidth(p.along) * 2 // local fairway width

  // Elevation change plus undulation. Bumps are larger the further you are from the centerline.
  const progress = clamp(p.along / len, 0, 1)
  const offFairway = smooth(fw * 0.4, fw * 1.5, p.dist)
  const bumpScale = 0.6 + 1.6 * offFairway
  let h = baseElevation(def, progress)
    + bumpScale * Math.sin(x * 0.021 + n) * Math.cos(z * 0.017 + n * 2)
    + 0.5 * Math.sin(x * 0.05 + z * 0.04 + n)

  // Banks rise up to 3 m away from the fairway.
  h += 3 * smooth(fw, fw * 3, p.dist)

  // Blend into a flat, tilted green plane near the green.
  const distToGreen = shape.greenDist(x, z)
  const greenHeight = def.elev + def.slope[0] * (x - green[0]) + def.slope[1] * (z - green[1])
  h += (greenHeight - h) * smooth(def.greenR + 10, def.greenR, distToGreen)

  // Canyons cut steep-sided ditches across the hole.
  for (const c of def.canyons ?? []) h -= CANYON_DEPTH * canyonDepthFactor(c, len, p.along, p.lat)

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
  const past = pastCliff(def, p.lat)
  if (past > 0) h += (-24 - h) * smooth(0, 14, past)
  return h
}

/**
 * Surface type at (x, z). Checks run in priority order: ocean side (water below
 * sea level, otherwise cliff/beach penalty area), ponds, out of bounds, green,
 * sand, canyons, tee, fairway, rough.
 */
function lieAt(shape: HoleShape, x: number, z: number): Lie {
  const { def, len, bunkers, ponds } = shape
  const p = shape.project(x, z)

  // The cliff face and beach are a dry penalty area; only ground under the ocean surface is water.
  if (pastCliff(def, p.lat) > CLIFF_LIP) return heightAt(shape, x, z) < OCEAN_Y ? 'water' : 'hazard'
  for (const [px, pz, r] of ponds) if (Math.hypot(x - px, z - pz) < r) return 'water'
  if (p.dist > 95 || p.along < -40 || p.along > len + 60) return 'oob'
  if (shape.greenDist(x, z) < def.greenR) return 'green'
  for (const [bx, bz, r] of bunkers) if (Math.hypot(x - bx, z - bz) < r) return 'sand'
  for (const c of def.canyons ?? []) if (inCanyon(c, len, p.along, p.lat)) return 'hazard'
  if (p.along < 6 && p.along > -6 && p.dist < 5) return 'tee'

  // Default fairway start: par 3s only have fairway in the last 40 m; longer holes start 95 m out.
  const fairwayStart = def.fairwayStart !== undefined ? def.fairwayStart * len : def.par === 3 ? len - 40 : 95
  if (p.dist < shape.halfWidth(p.along) && p.along > fairwayStart) return 'fairway'
  return 'rough'
}

/**
 * Fairway half-width at `along`: the hole's width, changed around each pinch
 * point (a bell curve about 35 m wide), and narrowing 30% over the final 60 m.
 */
function fairwayHalfWidth(def: HoleDef, len: number, along: number) {
  let k = 1
  for (const [f, mul] of def.pinches ?? []) k += (mul - 1) * Math.exp(-(((along - f * len) / 35) ** 2))
  return def.width / 2 * k * (1 - 0.3 * smooth(len - 60, len, along))
}

/**
 * Scaled distance from the green center for an oval green. The oval's length
 * runs along the final leg, rotated by the shape's angle.
 */
function makeGreenDist(def: HoleDef, green: [number, number], lastLeg: [number, number]) {
  const [lengthMul, widthMul, angleDeg] = def.greenShape ?? [1, 1, 0]
  const a = angleDeg * Math.PI / 180
  const c = Math.cos(a), s = Math.sin(a)
  // Long axis: the last leg's direction rotated by the angle (positive = clockwise from above, like headings).
  const ux = lastLeg[0] * c - lastLeg[1] * s, uz = lastLeg[0] * s + lastLeg[1] * c
  return (x: number, z: number) => {
    const dx = x - green[0], dz = z - green[1]
    const along = dx * ux + dz * uz
    const across = -dx * uz + dz * ux
    return Math.hypot(along / lengthMul, across / widthMul)
  }
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
  const greenDist = makeGreenDist(def, green, segs[segs.length - 1].d)
  const halfWidth = (along: number) => fairwayHalfWidth(def, len, along)

  const shape: HoleShape = { def, len, green, bunkers, ponds, project, greenDist, halfWidth }
  const height = (x: number, z: number) => heightAt(shape, x, z)
  const lie = (x: number, z: number) => lieAt(shape, x, z)

  return { def, path, len, green, pin, tee: [0, 0], bunkers, ponds, wind, project, greenDist, halfWidth, height, lie }
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
