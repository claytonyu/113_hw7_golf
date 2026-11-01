// Approximate recreation of Torrey Pines South. Yardages/pars from public scorecards; geometry is stylized, not surveyed.
export type Lie = 'tee' | 'fairway' | 'rough' | 'sand' | 'green' | 'water' | 'oob'
const YD = 0.9144

interface HoleDef {
  num: number; par: number; yards: number; name: string
  legs: [number, number][]            // [fraction of length, heading deg; + = turns right]
  width: number                       // fairway width (m)
  bunkers: [number, number, number][] // [fraction along, lateral m (+ right), radius m]
  ocean?: { side: 1 | -1; dist: number } // canyon/ocean drop-off on this side
  ponds?: [number, number, number][]
  elev: number                        // green height relative to tee (m)
  wind: [number, number]              // [mph, blowing-toward deg relative to first leg; 0 = downwind]
  greenR: number
  slope: [number, number]             // green slope (rise per m in x, z)
  pin: [number, number]
}

export const HOLES: HoleDef[] = [
  { num: 1, par: 4, yards: 452, name: 'Down the Hill', legs: [[0.6, 0], [0.4, 12]], width: 34, bunkers: [[0.62, -20, 7], [0.97, 17, 6], [0.95, -16, 5]], elev: -6, wind: [8, 30], greenR: 15, slope: [0.012, -0.018], pin: [3, 2] },
  { num: 2, par: 4, yards: 389, name: 'Short Four', legs: [[1, -4]], width: 30, bunkers: [[0.58, 18, 8], [0.93, -15, 6], [0.97, 14, 5]], elev: 2, wind: [6, 120], greenR: 13, slope: [-0.015, 0.01], pin: [-4, 3] },
  { num: 3, par: 3, yards: 200, name: 'Ocean Par 3', legs: [[1, -8]], width: 22, bunkers: [[0.9, 15, 6], [0.95, -14, 5], [0.85, -12, 4]], ocean: { side: -1, dist: 30 }, elev: -12, wind: [12, 260], greenR: 14, slope: [0.02, 0.005], pin: [-5, -2] },
  { num: 4, par: 4, yards: 488, name: 'Cliffside', legs: [[0.55, -5], [0.45, -14]], width: 30, bunkers: [[0.55, 18, 7], [0.96, 16, 6]], ocean: { side: -1, dist: 32 }, elev: 0, wind: [10, 200], greenR: 14, slope: [-0.02, -0.01], pin: [-3, 4] },
  { num: 5, par: 4, yards: 453, name: 'Inland Turn', legs: [[0.6, 0], [0.4, 10]], width: 32, bunkers: [[0.6, -19, 8], [0.95, -15, 6], [0.98, 14, 6]], elev: 4, wind: [7, 80], greenR: 13, slope: [0.01, 0.02], pin: [2, -3] },
  { num: 6, par: 5, yards: 560, name: 'Uphill Five', legs: [[0.45, 0], [0.55, 18]], width: 32, bunkers: [[0.45, -20, 8], [0.7, 18, 7], [0.96, -14, 6]], elev: 9, wind: [9, 340], greenR: 14, slope: [-0.012, 0.022], pin: [-2, 5] },
  { num: 7, par: 4, yards: 462, name: 'Dogleg Left', legs: [[0.55, 4], [0.45, -20]], width: 30, bunkers: [[0.55, 19, 8], [0.92, 15, 6], [0.97, -14, 5]], elev: -3, wind: [8, 150], greenR: 13, slope: [0.018, -0.008], pin: [4, 1] },
  { num: 8, par: 3, yards: 177, name: 'Downhill Three', legs: [[1, 6]], width: 20, bunkers: [[0.88, -14, 6], [0.92, 14, 6], [1.08, 0, 5]], elev: -10, wind: [6, 60], greenR: 13, slope: [-0.01, -0.02], pin: [1, -3] },
  { num: 9, par: 5, yards: 613, name: 'Home Stretch', legs: [[0.35, 0], [0.35, -10], [0.3, 6]], width: 34, bunkers: [[0.38, 20, 8], [0.6, -20, 9], [0.85, 18, 8], [0.97, -14, 6]], elev: 3, wind: [8, 10], greenR: 15, slope: [0.015, 0.012], pin: [-3, -2] },
  { num: 10, par: 4, yards: 405, name: 'Back Turn', legs: [[1, 3]], width: 30, bunkers: [[0.6, -18, 7], [0.95, 14, 6]], elev: -2, wind: [9, 220], greenR: 13, slope: [-0.012, -0.015], pin: [2, 3] },
  { num: 11, par: 3, yards: 221, name: 'Long Three', legs: [[1, -3]], width: 22, bunkers: [[0.9, -15, 6], [0.93, 15, 6]], ocean: { side: 1, dist: 35 }, elev: -4, wind: [11, 90], greenR: 13, slope: [0.02, 0], pin: [-3, 2] },
  { num: 12, par: 4, yards: 504, name: 'Ocean Four', legs: [[0.6, 0], [0.4, -8]], width: 30, bunkers: [[0.6, 18, 8], [0.96, -15, 6]], ocean: { side: -1, dist: 34 }, elev: -3, wind: [13, 180], greenR: 14, slope: [-0.015, 0.01], pin: [3, -4] },
  { num: 13, par: 5, yards: 614, name: 'Canyon Five', legs: [[0.4, 0], [0.3, 14], [0.3, -6]], width: 34, bunkers: [[0.42, -20, 9], [0.72, 18, 8], [0.96, 14, 6]], ocean: { side: 1, dist: 45 }, elev: 5, wind: [8, 300], greenR: 15, slope: [0.01, -0.02], pin: [-2, 3] },
  { num: 14, par: 4, yards: 435, name: 'Narrow Four', legs: [[0.6, -6], [0.4, 8]], width: 28, bunkers: [[0.62, 17, 7], [0.95, -14, 6], [0.97, 14, 5]], elev: 1, wind: [7, 30], greenR: 13, slope: [0.02, 0.01], pin: [4, 2] },
  { num: 15, par: 4, yards: 478, name: 'Hilltop', legs: [[0.55, 2], [0.45, 14]], width: 30, bunkers: [[0.55, -19, 8], [0.95, 15, 6]], elev: 6, wind: [9, 110], greenR: 13, slope: [-0.018, -0.012], pin: [-3, 3] },
  { num: 16, par: 3, yards: 227, name: 'Cliff Three', legs: [[1, 8]], width: 22, bunkers: [[0.88, 15, 6], [0.92, -14, 6], [0.82, 12, 5]], ocean: { side: -1, dist: 28 }, elev: -8, wind: [12, 240], greenR: 14, slope: [0.015, -0.015], pin: [2, -2] },
  { num: 17, par: 4, yards: 442, name: 'Canyon Edge', legs: [[0.55, 0], [0.45, -12]], width: 28, bunkers: [[0.55, 18, 7], [0.96, 14, 6]], ocean: { side: -1, dist: 30 }, elev: -2, wind: [10, 190], greenR: 13, slope: [-0.02, 0.015], pin: [-4, -3] },
  { num: 18, par: 5, yards: 570, name: 'Pond Finish', legs: [[0.45, 0], [0.55, -10]], width: 34, bunkers: [[0.45, 20, 8], [0.8, -18, 7], [0.98, 15, 6]], ponds: [[0.93, -2, 12]], elev: 2, wind: [8, 20], greenR: 15, slope: [0.012, 0.018], pin: [2, 4] },
]

export interface Hole {
  def: HoleDef; path: [number, number][]; len: number
  green: [number, number]; pin: [number, number]; tee: [number, number]
  bunkers: [number, number, number][]; ponds: [number, number, number][]
  wind: [number, number, number]
  project(x: number, z: number): { along: number; lat: number; dist: number }
  height(x: number, z: number): number
  lie(x: number, z: number): Lie
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t) }
// heading convention: dir = (-sin h, cos h), so +h turns right when facing +z
export const dirOf = (h: number): [number, number] => [-Math.sin(h), Math.cos(h)]

export function buildHole(def: HoleDef): Hole {
  const len = def.yards * YD
  const path: [number, number][] = [[0, 0]]
  for (const [f, hd] of def.legs) {
    const [dx, dz] = dirOf(hd * Math.PI / 180); const [px, pz] = path[path.length - 1]
    path.push([px + dx * f * len, pz + dz * f * len])
  }
  const segs = path.slice(1).map((b, i) => {
    const a = path[i]; const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    return { a, b, l, d: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] as [number, number] }
  })
  const pointAt = (s: number): [number, number, number, number] => {
    let acc = 0
    for (const sg of segs) {
      if (s <= acc + sg.l || sg === segs[segs.length - 1]) { const t = s - acc; return [sg.a[0] + sg.d[0] * t, sg.a[1] + sg.d[1] * t, -sg.d[1], sg.d[0]] }
      acc += sg.l
    }
    return [0, 0, -1, 0]
  }
  const toWorld = ([f, lat, r]: [number, number, number]): [number, number, number] => { const [x, z, rx, rz] = pointAt(f * len); return [x + rx * lat, z + rz * lat, r] }
  const green = path[path.length - 1]
  const pin: [number, number] = [green[0] + def.pin[0], green[1] + def.pin[1]]
  const bunkers = def.bunkers.map(toWorld)
  const ponds = (def.ponds ?? []).map(toWorld)
  const w0 = segs[0].d; const wh = def.wind[1] * Math.PI / 180; const ws = def.wind[0] * 0.447
  // rotate first-leg direction by wind angle (positive = to the right)
  const wr: [number, number] = [-w0[1], w0[0]]
  const wind: [number, number, number] = [(w0[0] * Math.cos(wh) + wr[0] * Math.sin(wh)) * ws, 0, (w0[1] * Math.cos(wh) + wr[1] * Math.sin(wh)) * ws]

  const project = (x: number, z: number) => {
    let best = { along: 0, lat: 0, dist: 1e9 }; let acc = 0
    segs.forEach((sg, i) => {
      let t = (x - sg.a[0]) * sg.d[0] + (z - sg.a[1]) * sg.d[1]
      const raw = t
      t = clamp(t, 0, sg.l)
      const px = sg.a[0] + sg.d[0] * t, pz = sg.a[1] + sg.d[1] * t
      const dist = Math.hypot(x - px, z - pz)
      if (dist < best.dist) {
        const lat = (x - px) * -sg.d[1] + (z - pz) * sg.d[0]
        const along = acc + (i === 0 && raw < 0 ? raw : i === segs.length - 1 && raw > sg.l ? raw : t)
        best = { along, lat: Math.sign(lat || 1) * dist, dist }
      }
      acc += sg.l
    })
    return best
  }
  const n = def.num
  const height = (x: number, z: number) => {
    const p = project(x, z)
    const f = clamp(p.along / len, 0, 1)
    const nearCenter = smooth(def.width * 0.4, def.width * 1.5, p.dist)
    let h = def.elev * f + (0.6 + 1.6 * nearCenter) * Math.sin(x * 0.021 + n) * Math.cos(z * 0.017 + n * 2) + 0.5 * Math.sin(x * 0.05 + z * 0.04 + n)
    h += 3 * smooth(def.width, def.width * 3, p.dist) // banks rise away from fairway
    const dg = Math.hypot(x - green[0], z - green[1])
    const gh = def.elev + def.slope[0] * (x - green[0]) + def.slope[1] * (z - green[1])
    h = h + (gh - h) * smooth(def.greenR + 10, def.greenR, dg)
    for (const [bx, bz, r] of bunkers) { const d = Math.hypot(x - bx, z - bz); if (d < r + 1.5) h -= 0.7 * smooth(r + 1.5, r * 0.6, d) }
    for (const [px, pz, r] of ponds) { const d = Math.hypot(x - px, z - pz); if (d < r + 3) h -= 2.5 * smooth(r + 3, r, d) }
    if (def.ocean) { const s = p.lat * def.ocean.side; if (s > def.ocean.dist) h += (-24 - h) * smooth(def.ocean.dist, def.ocean.dist + 14, s) }
    return h
  }
  const lie = (x: number, z: number): Lie => {
    const p = project(x, z)
    if (def.ocean && p.lat * def.ocean.side > def.ocean.dist + 4) return 'water'
    for (const [px, pz, r] of ponds) if (Math.hypot(x - px, z - pz) < r) return 'water'
    if (p.dist > 95 || p.along < -40 || p.along > len + 60) return 'oob'
    if (Math.hypot(x - green[0], z - green[1]) < def.greenR) return 'green'
    for (const [bx, bz, r] of bunkers) if (Math.hypot(x - bx, z - bz) < r) return 'sand'
    if (p.along < 6 && p.along > -6 && p.dist < 5) return 'tee'
    const fwStart = def.par === 3 ? len - 40 : 95
    const halfW = def.width / 2 * (1 - 0.3 * smooth(len - 60, len, p.along))
    if (p.dist < halfW && p.along > fwStart) return 'fairway'
    return 'rough'
  }
  return { def, path, len, green, pin, tee: [0, 0], bunkers, ponds, wind, project, height, lie }
}
