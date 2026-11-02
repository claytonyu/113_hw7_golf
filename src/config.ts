/**
 * Central balancing config: club stats, lie penalties, swing-meter tuning,
 * keyboard step sizes, AI difficulty levels, Pro Shop items and prices, and
 * currency rewards. Tweak numbers here rather than inside game logic.
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
  spreadErr: 0.1,   // the landing-dispersion area shows strikes mistimed by up to this much beyond the perfect zone
}

/** Strokes after which the player picks up and moves to the next hole. */
export const MAX_STROKES = 10

/** Tee shots on holes longer than this (meters) aim down the first leg instead of at the pin. */
export const AIM_DOWN_LEG_DIST = 260

// ---------- Ball physics by surface ----------

/** Rolling deceleration (m/s^2) by lie. Higher = the ball stops sooner. */
export const ROLL: Record<string, number> = { green: 0.55, fairway: 3.2, tee: 3.2, rough: 6.5, sand: 9, water: 20, hazard: 20, oob: 3 }

/** [restitution, friction] on impact, by lie. Restitution keeps vertical speed; friction removes sliding speed. */
export const BOUNCE: Record<string, [number, number]> = {
  green: [0.25, 0.25], fairway: [0.35, 0.3], tee: [0.35, 0.3], rough: [0.15, 0.6], sand: [0.03, 0.9],
  water: [0, 1], hazard: [0, 1], oob: [0.2, 0.5],
}

/** Height (m) of the ocean surface. Ground below it on the ocean side is water. */
export const OCEAN_Y = -20.5

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
  puttStep: 0.3,      // minimum meters of putt distance per W/S press (about 1 ft)
  puttStepFrac: 0.015, // putt step as a fraction of the current putt distance, when that is larger
  holdAccel: 0.1,     // holding W/S: each key repeat grows the putt step by this fraction...
  holdAccelMax: 3,    // ...up to this multiple of the first step
  minPutt: 0.3,       // shortest putt distance in meters
  curveStep: 0.1,     // draw/fade step per Q/E press (curve ranges from -1 to 1)
  fine: 0.25,         // step multiplier while Shift is held
}

// ---------- Pro shop: equipment ----------

/**
 * How a piece of equipment changes the clubs it covers. Every field is a
 * multiplier (1 = stock), except roughCarry/sandCarry, which replace the
 * normal lie carry values when set.
 */
export interface ClubMods {
  carry: number      // carry distance
  zone: number       // perfect-zone width (forgiveness)
  spin: number       // backspin, which controls how fast the ball stops
  aimErr: number     // direction error from a mistimed swing
  distLoss: number   // distance lost from a mistimed swing
  sandZone: number   // extra perfect-zone multiplier from sand only
  roughCarry?: number // carry multiplier from the rough (stock: LIE_CARRY.rough)
  sandCarry?: number  // carry multiplier for wedges from sand (stock: WEDGE_SAND_CARRY)
}
export const NO_MODS: ClubMods = { carry: 1, zone: 1, spin: 1, aimErr: 1, distLoss: 1, sandZone: 1 }

/** Equipment slots and the club indexes (into CLUBS) each one covers. */
export type EquipSlot = 'driver' | 'wood' | 'irons' | 'wedges' | 'putter'
export const EQUIP_SLOTS: { slot: EquipSlot; label: string; clubs: number[] }[] = [
  { slot: 'driver', label: 'Driver', clubs: [0] },
  { slot: 'wood', label: '3 Wood', clubs: [1] },
  { slot: 'irons', label: 'Irons (4–9)', clubs: [2, 3, 4, 5, 6, 7] },
  { slot: 'wedges', label: 'Wedges', clubs: [8, 9] },
  { slot: 'putter', label: 'Putter', clubs: [10] },
]

/** A permanent equipment upgrade. Price 0 = stock gear every player starts with. */
export interface EquipmentItem { id: string; slot: EquipSlot; name: string; desc: string; price: number; mods: Partial<ClubMods> }

/** Upgrades are modest, and each gives something up so no option is strictly best. */
export const EQUIPMENT: EquipmentItem[] = [
  { id: 'driver-stock', slot: 'driver', name: 'Stock Driver', desc: 'Balanced starter driver.', price: 0, mods: {} },
  { id: 'driver-tour', slot: 'driver', name: 'Tour Driver', desc: '+6% carry, but a 15% smaller perfect zone.', price: 400, mods: { carry: 1.06, zone: 0.85 } },
  { id: 'driver-max', slot: 'driver', name: 'Max-Forgive Driver', desc: '30% larger perfect zone, but 3% less carry.', price: 350, mods: { zone: 1.3, carry: 0.97 } },

  { id: 'wood-stock', slot: 'wood', name: 'Stock 3 Wood', desc: 'Balanced starter fairway wood.', price: 0, mods: {} },
  { id: 'wood-tour', slot: 'wood', name: 'Tour 3 Wood', desc: '+5% carry, but a 12% smaller perfect zone.', price: 300, mods: { carry: 1.05, zone: 0.88 } },
  { id: 'wood-rescue', slot: 'wood', name: 'Rescue 3 Wood', desc: 'Loses half as much distance from the rough, but 3% less carry.', price: 250, mods: { roughCarry: 0.925, carry: 0.97 } },

  { id: 'irons-stock', slot: 'irons', name: 'Stock Irons', desc: 'Balanced starter irons.', price: 0, mods: {} },
  { id: 'irons-blade', slot: 'irons', name: 'Forged Blades', desc: '+4% carry, but a 12% smaller perfect zone.', price: 450, mods: { carry: 1.04, zone: 0.88 } },
  { id: 'irons-cavity', slot: 'irons', name: 'Cavity-Back Irons', desc: '20% larger perfect zone, but 10% less spin (more rollout).', price: 400, mods: { zone: 1.2, spin: 0.9 } },

  { id: 'wedges-stock', slot: 'wedges', name: 'Stock Wedges', desc: 'Balanced starter wedges.', price: 0, mods: {} },
  { id: 'wedges-spin', slot: 'wedges', name: 'Spin-Milled Wedges', desc: '30% more spin to stop the ball, but an 8% smaller perfect zone.', price: 300, mods: { spin: 1.3, zone: 0.92 } },
  { id: 'wedges-sand', slot: 'wedges', name: 'Wide-Sole Wedges', desc: 'Full carry and a 30% larger zone from sand, but 15% less spin.', price: 250, mods: { sandCarry: 1, sandZone: 1.3, spin: 0.85 } },

  { id: 'putter-stock', slot: 'putter', name: 'Stock Putter', desc: 'Balanced starter putter.', price: 0, mods: {} },
  { id: 'putter-mallet', slot: 'putter', name: 'Mallet Putter', desc: '40% less direction error on mistimed putts, but 30% more pace error.', price: 300, mods: { aimErr: 0.6, distLoss: 1.3 } },
  { id: 'putter-blade', slot: 'putter', name: 'Tour Blade Putter', desc: '40% less pace error on mistimed putts, but 30% more direction error.', price: 300, mods: { distLoss: 0.6, aimErr: 1.3 } },
]

// ---------- Pro shop: consumables ----------

export type ConsumableId = 'power' | 'tempo' | 'steady'
export interface ConsumableItem { id: ConsumableId; name: string; desc: string; price: number; color: string }

/** One-shot boosts. A charge is used up only when the boosted shot is struck. */
export const CONSUMABLES: ConsumableItem[] = [
  { id: 'power', name: 'Power Boost', desc: '+10% intended carry for one full shot. The preview updates. Not for putts.', price: 60, color: '#ff9f1c' },
  { id: 'tempo', name: 'Slow Tempo', desc: 'The swing meter moves 30% slower for one shot.', price: 50, color: '#5ab0ff' },
  { id: 'steady', name: 'Steady Hands', desc: 'The perfect timing zone is 25% wider for one shot.', price: 50, color: '#7CFFB2' },
]

/** Boost strengths. */
export const BOOSTS = { powerCarry: 1.1, tempoSpeed: 0.7, steadyZone: 1.25 }

/** Consumable charges a player can bring into one nine-hole round (keys 1, 2, 3). */
export const MAX_CHARGES = 3

// ---------- Pro shop: cosmetics ----------

export interface BallColor { id: string; kind: 'ball'; name: string; price: number; color: string }
export interface ClubFinish { id: string; kind: 'finish'; name: string; price: number; shaft: string; head: string }
export interface Outfit { id: string; kind: 'outfit'; name: string; price: number; shirt: string; pants: string; cap: string }
export type Cosmetic = BallColor | ClubFinish | Outfit

export const BALL_COLORS: BallColor[] = [
  { id: 'ball-white', kind: 'ball', name: 'Tour White', price: 0, color: '#ffffff' },
  { id: 'ball-yellow', kind: 'ball', name: 'Optic Yellow', price: 80, color: '#e8ff3b' },
  { id: 'ball-pink', kind: 'ball', name: 'Hot Pink', price: 80, color: '#ff5fb3' },
  { id: 'ball-orange', kind: 'ball', name: 'Matte Orange', price: 80, color: '#ff8c2a' },
  { id: 'ball-blue', kind: 'ball', name: 'Sky Blue', price: 80, color: '#5ec8ff' },
  { id: 'ball-gold', kind: 'ball', name: 'Gold', price: 250, color: '#ffcf3f' },
]

export const CLUB_FINISHES: ClubFinish[] = [
  { id: 'finish-chrome', kind: 'finish', name: 'Chrome', price: 0, shaft: '#c0c6cc', head: '#222831' },
  { id: 'finish-black', kind: 'finish', name: 'Black Satin', price: 120, shaft: '#2a2d31', head: '#111214' },
  { id: 'finish-copper', kind: 'finish', name: 'Copper', price: 150, shaft: '#c98b5a', head: '#8a4b25' },
  { id: 'finish-blue', kind: 'finish', name: 'Blue Ion', price: 150, shaft: '#7fb3ff', head: '#1f4fbf' },
  { id: 'finish-gold', kind: 'finish', name: 'Gold Plated', price: 300, shaft: '#f2d27a', head: '#c9a227' },
]

/** Player outfits. Red-and-black is left to the AI opponent so the two golfers are easy to tell apart. */
export const OUTFITS: Outfit[] = [
  { id: 'outfit-navy', kind: 'outfit', name: 'Classic Navy', price: 0, shirt: '#1d3557', pants: '#f1f1f1', cap: '#e63946' },
  { id: 'outfit-white', kind: 'outfit', name: 'Coastal White', price: 120, shirt: '#f4f4f4', pants: '#2b3a55', cap: '#2b3a55' },
  { id: 'outfit-pine', kind: 'outfit', name: 'Torrey Pine', price: 120, shirt: '#2d6a4f', pants: '#e9dcc0', cap: '#1b4332' },
  { id: 'outfit-sunset', kind: 'outfit', name: 'Sunset Orange', price: 120, shirt: '#f48c06', pants: '#f1f1f1', cap: '#ffffff' },
  { id: 'outfit-purple', kind: 'outfit', name: 'Royal Purple', price: 150, shirt: '#5a189a', pants: '#e0e0e0', cap: '#ffd23f' },
  { id: 'outfit-sky', kind: 'outfit', name: 'Sand & Sky', price: 150, shirt: '#8ecae6', pants: '#e8d3a6', cap: '#023047' },
]

/** The AI opponent's fixed look. */
export const AI_OUTFIT = { shirt: '#c1121f', pants: '#1b1b1b', cap: '#1b1b1b', shaft: '#c0c6cc', head: '#222831' }

// ---------- Progression: currency rewards ----------

/** Coins awarded at the end of a completed nine-hole round. Coins are never taken away. */
export const REWARDS = {
  roundComplete: 100,               // always paid for finishing all nine holes
  holeScore: { par: 10, birdie: 30, eagle: 75, albatross: 150 }, // per hole; better than albatross pays the albatross rate
  holeInOne: 150,                   // bonus on top of the score reward
  personalRecord: 75,               // new lowest score for this nine and record category
  beatAi: { amateur: 40, pro: 100, tiger: 200 } as Record<Difficulty, number>, // fewer total strokes than the AI
}
