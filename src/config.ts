/**
 * Central balancing config: club stats, lie penalties, swing-meter tuning and
 * keyboard step sizes. Tweak numbers here rather than inside game logic.
 */

/** Meters per yard. The simulation works in meters; the HUD shows yards. */
export const YD = 0.9144

/** One club in the bag. */
export interface Club {
  name: string
  short: string  // two-letter label for the HUD
  carry: number  // full-power carry distance on flat ground, in yards
  launch: number // launch angle in degrees
  spin: number   // backspin lift coefficient; also controls how much the ball "bites" on landing
}

/** The bag, ordered longest to shortest. The putter must stay last. */
export const CLUBS: Club[] = [
  { name: 'Driver', short: 'DR', carry: 255, launch: 14.5, spin: 0.12 },
  { name: '3 Wood', short: '3W', carry: 230, launch: 15, spin: 0.13 },
  { name: '4 Iron', short: '4i', carry: 205, launch: 16.5, spin: 0.15 },
  { name: '5 Iron', short: '5i', carry: 192, launch: 17.5, spin: 0.16 },
  { name: '6 Iron', short: '6i', carry: 180, launch: 19, spin: 0.17 },
  { name: '7 Iron', short: '7i', carry: 167, launch: 20.5, spin: 0.18 },
  { name: '8 Iron', short: '8i', carry: 154, launch: 22.5, spin: 0.19 },
  { name: '9 Iron', short: '9i', carry: 141, launch: 25, spin: 0.2 },
  { name: 'P Wedge', short: 'PW', carry: 126, launch: 28, spin: 0.21 },
  { name: 'S Wedge', short: 'SW', carry: 100, launch: 32, spin: 0.22 },
  { name: 'Putter', short: 'PT', carry: 0, launch: 0, spin: 0 },
]

/** Index of the putter in CLUBS. */
export const PUTTER = CLUBS.length - 1

/** Index of the first wedge (P Wedge). Wedges and shorter escape bunkers cleanly. */
export const FIRST_WEDGE = 8

/** Carry multiplier by lie: rough and sand lose distance. */
export const LIE_CARRY: Record<string, number> = { tee: 1, fairway: 1, rough: 0.85, sand: 0.55, green: 1 }

/** Carry multiplier for a wedge played out of sand (replaces LIE_CARRY.sand). */
export const WEDGE_SAND_CARRY = 0.9

/** Perfect-zone width multiplier by lie: harder lies give a smaller zone. */
export const LIE_ZONE: Record<string, number> = { tee: 1, fairway: 1, rough: 0.8, sand: 0.65, green: 1 }

/** Direction-error multiplier by lie: a mistimed swing strays further from bad lies. */
export const LIE_AIM_ERROR: Record<string, number> = { rough: 1.4, sand: 1.8 }

/** Backspin multiplier by lie: less spin from rough and sand, so the ball releases more. */
export const LIE_SPIN: Record<string, number> = { rough: 0.5, sand: 0.7 }

/** Swing meter tuning. The marker travels from 0 to 1; the perfect zone is centered on 0.5. */
export const METER = {
  period: 1.15,     // seconds for the marker to cross the whole meter
  puttPeriod: 1.7,  // slower meter when putting
  zone: 0.04,       // half-width of the perfect zone, as a fraction of the meter
  errDeg: 18,       // degrees of direction error per unit of timing error outside the zone
  distLoss: 0.7,    // fraction of distance lost per unit of timing error outside the zone
  putterAim: 0.25,  // putter direction errors are scaled down by this factor
  shapePenalty: 0.3, // full draw/fade shrinks the perfect zone by this fraction
}

/** Strokes after which the player picks up and moves to the next hole. */
export const MAX_STROKES = 10

/** Keyboard step sizes for shot planning (applied once per keydown, including key repeats). */
export const CONTROLS = {
  aimStep: 0.012,     // radians per A/D press
  puttAimStep: 0.004, // radians per A/D press while putting
  powerStep: 0.02,    // fraction of full power per W/S press
  minPower: 0.1,
  puttStep: 0.15,     // meters of putt distance per W/S press
  minPutt: 0.3,       // shortest putt distance in meters
  curveStep: 0.1,     // draw/fade step per Q/E press (curve ranges from -1 to 1)
  fine: 0.25,         // step multiplier while Shift is held
}
