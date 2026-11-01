/**
 * Round state and hole flow: creating a round, starting each hole, setting up
 * the next shot, and resolving where a finished shot leaves the player
 * (holed, penalty, or next shot). Shot execution lives in shot.ts and the
 * per-frame update in loop.ts.
 *
 * The state object `GS` is a plain mutable object. The 3D frame loop mutates
 * it directly; React re-renders by polling it (see ui/play.tsx).
 */
import { HOLES } from '../course/holes'
import { buildHole, headingTo, type Hole } from '../course/course'
import { CLUBS, PUTTER, LIE_CARRY, MAX_STROKES, YD } from '../config'
import type { Ball } from '../sim/sim'
import { sfx } from '../sound'

/**
 * Turn phases:
 * intro (hole flyover) -> plan (aiming) -> swing (meter running) -> flight (ball moving) -> plan ... -> holed.
 */
export type Phase = 'intro' | 'plan' | 'swing' | 'flight' | 'holed'

/** A short-lived spark of sand, grass or water spray. */
export interface Particle { p: number[]; v: number[]; life: number; max: number; c: [number, number, number] }

/** Big centered text such as "BIRDIE". `at` is the performance.now() time it appeared. */
export interface Banner { text: string; sub?: string; color: string; at: number }

/** Game state for a nine-hole round. Positions are [x, y, z] in meters. */
export interface GS {
  // round and hole
  nine: number            // 0 = front nine, 1 = back nine
  idx: number             // hole index within the nine (0-8)
  hole: Hole
  scores: number[]        // strokes per hole; 0 = not played yet
  strokes: number         // strokes taken on the current hole
  phase: Phase
  introT: number          // seconds into the intro flyover
  holedAt: number         // time the hole finished (debounces Space)

  // ball
  ball: number[]          // current resting position
  lastPos: number[]       // position before the last shot (penalty replay spot)
  shotStart: number[]     // where the in-flight shot was struck from
  sim: Ball | null        // the ball being simulated during flight
  acc: number             // leftover frame time not yet simulated (fixed-step accumulator)
  fast: boolean           // fast-forward the current flight
  lastContacts: number    // ground contacts already handled for sound and particles

  // shot plan
  club: number            // index into CLUBS
  heading: number         // aim direction in radians (see dirOf)
  power: number           // full swing: fraction of full carry (0-1); putter: intended roll distance in meters
  curve: number           // -1 (full draw) to 1 (full fade)

  // swing meter
  meterT: number          // marker position, 0-1; the perfect zone is centered on 0.5
  meterOn: boolean

  // landing prediction for the TV camera
  contact: number[] | null // first ground contact of the current shot
  contactT: number         // flight time to that contact
  final: number[] | null   // predicted resting position

  // camera
  cam: number             // 0 = close behind-ball view, 1 = high view
  overhead: boolean

  // feedback and effects
  feedback: string        // toast message
  feedbackAt: number
  banner: Banner | null
  streak: number          // consecutive perfect strikes
  strikeAt: number        // time of the last strike (drives the golfer animation)
  confettiAt: number
  trail: number[][]       // points the ball has passed through this shot
  fx: Particle[]
}

/** Horizontal (x/z) distance from a 3D point to a ground point. */
export const distXZ = (a: number[], x: number, z: number) => Math.hypot(a[0] - x, a[2] - z)

/** Length of the hole intro flyover, in seconds. */
export const INTRO = 4.2

/** Tee shots on holes longer than this (meters) aim down the first leg instead of at the pin. */
const AIM_DOWN_LEG_DIST = 260

/** Score names relative to par, with banner colors. */
const SCORE_NAMES: Record<string, [string, string]> = {
  '-3': ['ALBATROSS', '#ff7ae0'],
  '-2': ['EAGLE', '#ffd23f'],
  '-1': ['BIRDIE', '#7CFFB2'],
  '0': ['PAR', '#ffffff'],
  '1': ['BOGEY', '#ffb36b'],
  '2': ['DOUBLE BOGEY', '#ff8a7a'],
}

/** Creates a fresh round on the chosen nine and starts its first hole. */
export function newGame(nine: number): GS {
  const g: GS = {
    nine, idx: 0, hole: buildHole(HOLES[nine * 9]), scores: Array(9).fill(0), strokes: 0, phase: 'intro', introT: 0, holedAt: 0,
    ball: [0, 0, 0], lastPos: [0, 0, 0], shotStart: [0, 0, 0], sim: null, acc: 0, fast: false, lastContacts: 0,
    club: 0, heading: 0, power: 1, curve: 0,
    meterT: 0, meterOn: false,
    contact: null, contactT: 0, final: null,
    cam: 0, overhead: false,
    feedback: '', feedbackAt: 0, banner: null, streak: 0, strikeAt: 0, confettiAt: 0, trail: [], fx: [],
  }
  startHole(g, 0)
  return g
}

/** Loads hole `idx` of the current nine, places the ball on the tee and starts the intro flyover. */
export function startHole(g: GS, idx: number) {
  g.idx = idx
  g.hole = buildHole(HOLES[g.nine * 9 + idx])
  const h = g.hole
  g.ball = [0, h.height(0, 0), 0]
  g.lastPos = [...g.ball]
  g.strokes = 0
  g.sim = null
  g.trail = []
  g.phase = 'intro'
  g.introT = 0
  g.curve = 0
  setFeedback(g, h.def.name)
  showBanner(g, `HOLE ${h.def.num}`, '#ffffff', `PAR ${h.def.par} · ${h.def.yards} YDS`)
  prepShot(g)
}

/** Shows a toast message. */
export function setFeedback(g: GS, s: string) {
  g.feedback = s
  g.feedbackAt = performance.now()
}

/** Shows a big banner starting now. */
export function showBanner(g: GS, text: string, color: string, sub?: string) {
  g.banner = { text, sub, color, at: performance.now() }
}

/** Sets default aim, club and power for the next shot from the ball's position and lie. */
export function prepShot(g: GS) {
  const h = g.hole
  const d = distXZ(g.ball, h.pin[0], h.pin[1])

  g.heading = headingTo(g.ball, h.pin[0], h.pin[1])
  if (d > AIM_DOWN_LEG_DIST && g.strokes === 0) {
    const corner = h.path[1]
    g.heading = headingTo(g.ball, corner[0], corner[1])
  }

  const lie = h.lie(g.ball[0], g.ball[2])
  if (lie === 'green') {
    g.club = PUTTER
    g.power = d
    g.curve = 0
    return
  }
  pickClub(g, d / YD / (LIE_CARRY[lie] ?? 1))
}

/**
 * Chooses the shortest club whose full carry still covers `yards` (allowing 3% short),
 * falling back to the driver, and sets power to the needed fraction.
 */
function pickClub(g: GS, yards: number) {
  let c = 0
  for (let i = 0; i < PUTTER; i++) {
    if (CLUBS[i].carry >= yards * 0.97) c = i // clubs go longest to shortest, so the last match is the shortest
  }
  g.club = c
  g.power = Math.min(1, yards / CLUBS[c].carry)
}

/** Formats a remaining distance in yards, switching to feet inside 30 yards. */
function formatRemaining(yds: number) {
  return yds < 30 ? `${(yds * 3).toFixed(0)} ft` : `${yds.toFixed(0)} yds`
}

/** Called when the simulated ball stops. Scores the hole, applies a penalty, or sets up the next shot. */
export function finishShot(g: GS) {
  const b = g.sim!
  if (b.mode === 'holed') { finishHole(g, b); return }

  if (b.mode === 'water' || b.mode === 'oob') applyPenalty(g, b.mode)
  else settleBall(g, b)

  g.sim = null
  g.phase = 'plan'
  if (g.strokes >= MAX_STROKES) { pickUp(g); return }
  prepShot(g)
}

/** Ball dropped: records the score and plays the matching banner, sound and confetti. */
function finishHole(g: GS, b: Ball) {
  const h = g.hole
  g.phase = 'holed'
  g.ball = [...b.p]
  g.scores[g.idx] = g.strokes

  const toPar = g.strokes - h.def.par
  const holeInOne = g.strokes === 1
  const [name, color] = holeInOne ? ['HOLE IN ONE', '#ff7ae0'] : SCORE_NAMES[toPar] ?? [`+${toPar}`, '#ff8a7a']
  showBanner(g, name, color, `${g.strokes} strokes · Space for next hole`)
  setFeedback(g, 'In the cup!')
  sfx.cup()

  if (toPar < 0 || holeInOne) {
    sfx.cheer(toPar <= -2 || holeInOne)
    g.confettiAt = performance.now()
  } else if (toPar >= 2) {
    sfx.groan()
  }
  g.sim = null
  g.holedAt = performance.now()
}

/** Water or out of bounds: one penalty stroke and replay from the previous spot (stroke and distance). */
function applyPenalty(g: GS, mode: 'water' | 'oob') {
  g.strokes++
  g.ball = [...g.lastPos]
  showBanner(g, mode === 'water' ? 'SPLASH' : 'OUT OF BOUNDS', '#8fd3ff', '+1 stroke · replay from previous spot')
  setFeedback(g, 'Penalty stroke')
  if (mode === 'oob') sfx.groan()
}

/** Ball came to rest in play: moves it there and reports the shot distance, distance left and lie. */
function settleBall(g: GS, b: Ball) {
  const h = g.hole
  const carried = distXZ(g.shotStart, b.p[0], b.p[2]) / YD
  g.ball = [...b.p]
  const rem = distXZ(g.ball, h.pin[0], h.pin[1]) / YD
  const lie = h.lie(g.ball[0], g.ball[2])
  setFeedback(g, `${carried.toFixed(0)} yds · ${formatRemaining(rem)} left · ${lie === 'green' ? 'on the green' : 'in the ' + lie}`)
  if (lie === 'green' && rem < 3 && h.def.par - g.strokes >= 2) showBanner(g, 'TAP-IN EAGLE LOOK', '#ffd23f')
}

/** Hit the stroke limit: records the score and ends the hole. */
function pickUp(g: GS) {
  g.scores[g.idx] = g.strokes
  g.phase = 'holed'
  showBanner(g, 'PICKED UP', '#ffb36b', 'Space for next hole')
  g.holedAt = performance.now()
}
