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

// ---------- AI opponent ----------

/** Display names for the unofficial, game-simulated opponent. */
export const AI_NAME = 'Tiger Woods'
export const AI_SHORT = 'Tiger'
export const AI_LABEL = 'Tiger Woods — AI opponent'

export type Difficulty = 'amateur' | 'pro' | 'tiger'
export const DIFFICULTIES: Difficulty[] = ['amateur', 'pro', 'tiger']
export const DEFAULT_DIFFICULTY: Difficulty = 'pro'

/**
 * How well the AI plans and executes at each difficulty.
 * Planning: which shots it considers and how well it reads the wind and its own misses.
 * Execution: random timing error on the same swing meter the player uses, plus rare big mistakes.
 */
export interface AiLevel {
  label: string
  // planning
  aimOffsets: number[]   // aim directions tried, in radians either side of each target line
  carryFractions: number[] // carries tried, as fractions of the distance to the pin (shorter ones allow for rollout)
  layups: number[]       // extra carries tried, as fractions of the longest club's carry (0 = never lays up)
  shapes: number[]       // draw/fade values tried
  windRead: number       // fraction of the real wind the AI plans for (1 = perfect read)
  riskChecks: number     // best candidates re-scored against the AI's own miss pattern (0 = ignores risk)
  // execution
  timingSigma: number    // standard deviation of swing timing error (perfect zone half-width is METER.zone)
  mistakeChance: number  // chance per shot of a badly mistimed swing
  mistakeSize: [number, number] // timing error range of a mistake
  puttAimSigma: number   // green-reading error in radians
  puttPaceSigma: number  // putt pace error as a fraction of the intended distance
  thinkTime: number      // minimum seconds spent "lining up" before each shot
}

export const AI_LEVELS: Record<Difficulty, AiLevel> = {
  amateur: {
    label: 'Amateur',
    aimOffsets: [-0.06, 0, 0.06],
    carryFractions: [1],
    layups: [],
    shapes: [0],
    windRead: 0.4,
    riskChecks: 0,
    timingSigma: 0.08,
    mistakeChance: 0.12,
    mistakeSize: [0.15, 0.3],
    puttAimSigma: 0.05,
    puttPaceSigma: 0.2,
    thinkTime: 1.4,
  },
  pro: {
    label: 'Pro',
    aimOffsets: [-0.12, -0.08, -0.04, 0, 0.04, 0.08, 0.12],
    carryFractions: [1, 0.9, 0.8],
    layups: [0.9, 0.75],
    shapes: [0],
    windRead: 0.8,
    riskChecks: 5,
    timingSigma: 0.06,
    mistakeChance: 0.08,
    mistakeSize: [0.12, 0.22],
    puttAimSigma: 0.035,
    puttPaceSigma: 0.15,
    thinkTime: 1.2,
  },
  tiger: {
    label: 'Tiger',
    aimOffsets: [-0.16, -0.12, -0.08, -0.04, 0, 0.04, 0.08, 0.12, 0.16],
    carryFractions: [1, 0.93, 0.86, 0.78],
    layups: [0.95, 0.85, 0.7],
    shapes: [-0.5, 0, 0.5],
    windRead: 0.95,
    riskChecks: 10,
    timingSigma: 0.038,
    mistakeChance: 0.04,
    mistakeSize: [0.1, 0.2],
    puttAimSigma: 0.018,
    puttPaceSigma: 0.085,
    thinkTime: 1.0,
  },
}

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
