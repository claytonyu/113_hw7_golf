/**
 * Hole data for an approximate recreation of Torrey Pines South.
 * Pars and yardages come from public scorecards; the geometry is stylized, not surveyed.
 * Each entry is turned into playable terrain by buildHole() in course.ts.
 */

/** Compact description of one hole. Lateral offsets are in meters; "+" is to the player's right. */
export interface HoleDef {
  num: number
  par: number
  yards: number
  name: string
  legs: [number, number][]            // [fraction of total length, heading in degrees; + turns right]
  width: number                       // fairway width (m)
  bunkers: [number, number, number][] // [fraction along the hole, lateral offset m, radius m]
  ocean?: { side: 1 | -1; dist: number } // canyon/ocean drop-off on this side, starting `dist` m from the centerline
  ponds?: [number, number, number][]  // same format as bunkers
  elev: number                        // green height relative to the tee (m)
  wind: [number, number]              // [mph, blowing-toward angle in degrees relative to the first leg; 0 = downwind]
  greenR: number                      // green radius (m)
  slope: [number, number]             // green tilt: rise per meter in x and z
  pin: [number, number]               // pin offset from the green center (m)
}

export const HOLES: HoleDef[] = [
  // ---------- front nine ----------
  {
    num: 1, par: 4, yards: 452, name: 'Down the Hill',
    legs: [[0.6, 0], [0.4, 12]], width: 34,
    bunkers: [[0.62, -20, 7], [0.97, 17, 6], [0.95, -16, 5]],
    elev: -6, wind: [8, 30], greenR: 15, slope: [0.012, -0.018], pin: [3, 2],
  },
  {
    num: 2, par: 4, yards: 389, name: 'Short Four',
    legs: [[1, -4]], width: 30,
    bunkers: [[0.58, 18, 8], [0.93, -15, 6], [0.97, 14, 5]],
    elev: 2, wind: [6, 120], greenR: 13, slope: [-0.015, 0.01], pin: [-4, 3],
  },
  {
    num: 3, par: 3, yards: 200, name: 'Ocean Par 3',
    legs: [[1, -8]], width: 22,
    bunkers: [[0.9, 15, 6], [0.95, -14, 5], [0.85, -12, 4]],
    ocean: { side: -1, dist: 30 },
    elev: -12, wind: [12, 260], greenR: 14, slope: [0.02, 0.005], pin: [-5, -2],
  },
  {
    num: 4, par: 4, yards: 488, name: 'Cliffside',
    legs: [[0.55, -5], [0.45, -14]], width: 30,
    bunkers: [[0.55, 18, 7], [0.96, 16, 6]],
    ocean: { side: -1, dist: 32 },
    elev: 0, wind: [10, 200], greenR: 14, slope: [-0.02, -0.01], pin: [-3, 4],
  },
  {
    num: 5, par: 4, yards: 453, name: 'Inland Turn',
    legs: [[0.6, 0], [0.4, 10]], width: 32,
    bunkers: [[0.6, -19, 8], [0.95, -15, 6], [0.98, 14, 6]],
    elev: 4, wind: [7, 80], greenR: 13, slope: [0.01, 0.02], pin: [2, -3],
  },
  {
    num: 6, par: 5, yards: 560, name: 'Uphill Five',
    legs: [[0.45, 0], [0.55, 18]], width: 32,
    bunkers: [[0.45, -20, 8], [0.7, 18, 7], [0.96, -14, 6]],
    elev: 9, wind: [9, 340], greenR: 14, slope: [-0.012, 0.022], pin: [-2, 5],
  },
  {
    num: 7, par: 4, yards: 462, name: 'Dogleg Left',
    legs: [[0.55, 4], [0.45, -20]], width: 30,
    bunkers: [[0.55, 19, 8], [0.92, 15, 6], [0.97, -14, 5]],
    elev: -3, wind: [8, 150], greenR: 13, slope: [0.018, -0.008], pin: [4, 1],
  },
  {
    num: 8, par: 3, yards: 177, name: 'Downhill Three',
    legs: [[1, 6]], width: 20,
    bunkers: [[0.88, -14, 6], [0.92, 14, 6], [1.08, 0, 5]],
    elev: -10, wind: [6, 60], greenR: 13, slope: [-0.01, -0.02], pin: [1, -3],
  },
  {
    num: 9, par: 5, yards: 613, name: 'Home Stretch',
    legs: [[0.35, 0], [0.35, -10], [0.3, 6]], width: 34,
    bunkers: [[0.38, 20, 8], [0.6, -20, 9], [0.85, 18, 8], [0.97, -14, 6]],
    elev: 3, wind: [8, 10], greenR: 15, slope: [0.015, 0.012], pin: [-3, -2],
  },
  // ---------- back nine ----------
  {
    num: 10, par: 4, yards: 405, name: 'Back Turn',
    legs: [[1, 3]], width: 30,
    bunkers: [[0.6, -18, 7], [0.95, 14, 6]],
    elev: -2, wind: [9, 220], greenR: 13, slope: [-0.012, -0.015], pin: [2, 3],
  },
  {
    num: 11, par: 3, yards: 221, name: 'Long Three',
    legs: [[1, -3]], width: 22,
    bunkers: [[0.9, -15, 6], [0.93, 15, 6]],
    ocean: { side: 1, dist: 35 },
    elev: -4, wind: [11, 90], greenR: 13, slope: [0.02, 0], pin: [-3, 2],
  },
  {
    num: 12, par: 4, yards: 504, name: 'Ocean Four',
    legs: [[0.6, 0], [0.4, -8]], width: 30,
    bunkers: [[0.6, 18, 8], [0.96, -15, 6]],
    ocean: { side: -1, dist: 34 },
    elev: -3, wind: [13, 180], greenR: 14, slope: [-0.015, 0.01], pin: [3, -4],
  },
  {
    num: 13, par: 5, yards: 614, name: 'Canyon Five',
    legs: [[0.4, 0], [0.3, 14], [0.3, -6]], width: 34,
    bunkers: [[0.42, -20, 9], [0.72, 18, 8], [0.96, 14, 6]],
    ocean: { side: 1, dist: 45 },
    elev: 5, wind: [8, 300], greenR: 15, slope: [0.01, -0.02], pin: [-2, 3],
  },
  {
    num: 14, par: 4, yards: 435, name: 'Narrow Four',
    legs: [[0.6, -6], [0.4, 8]], width: 28,
    bunkers: [[0.62, 17, 7], [0.95, -14, 6], [0.97, 14, 5]],
    elev: 1, wind: [7, 30], greenR: 13, slope: [0.02, 0.01], pin: [4, 2],
  },
  {
    num: 15, par: 4, yards: 478, name: 'Hilltop',
    legs: [[0.55, 2], [0.45, 14]], width: 30,
    bunkers: [[0.55, -19, 8], [0.95, 15, 6]],
    elev: 6, wind: [9, 110], greenR: 13, slope: [-0.018, -0.012], pin: [-3, 3],
  },
  {
    num: 16, par: 3, yards: 227, name: 'Cliff Three',
    legs: [[1, 8]], width: 22,
    bunkers: [[0.88, 15, 6], [0.92, -14, 6], [0.82, 12, 5]],
    ocean: { side: -1, dist: 28 },
    elev: -8, wind: [12, 240], greenR: 14, slope: [0.015, -0.015], pin: [2, -2],
  },
  {
    num: 17, par: 4, yards: 442, name: 'Canyon Edge',
    legs: [[0.55, 0], [0.45, -12]], width: 28,
    bunkers: [[0.55, 18, 7], [0.96, 14, 6]],
    ocean: { side: -1, dist: 30 },
    elev: -2, wind: [10, 190], greenR: 13, slope: [-0.02, 0.015], pin: [-4, -3],
  },
  {
    num: 18, par: 5, yards: 570, name: 'Pond Finish',
    legs: [[0.45, 0], [0.55, -10]], width: 34,
    bunkers: [[0.45, 20, 8], [0.8, -18, 7], [0.98, 15, 6]],
    ponds: [[0.93, -2, 12]],
    elev: 2, wind: [8, 20], greenR: 15, slope: [0.012, 0.018], pin: [2, 4],
  },
]

/** The nine HoleDefs for a round: 0 = front nine (1–9), 1 = back nine (10–18). */
export function nineHoles(nine: number): HoleDef[] {
  return HOLES.slice(nine * 9, nine * 9 + 9)
}
