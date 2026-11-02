/**
 * Round state and hole flow: creating a round, starting each hole, deciding
 * whose turn it is, setting up the next shot, and resolving where a finished
 * shot leaves the golfer (holed, penalty, or next shot). Shot execution lives
 * in shot.ts, the AI's decisions in ai.ts, and the per-frame update in loop.ts.
 *
 * Two golfers play every hole: the player (index 0) and the AI opponent
 * (index 1). They share one shot plan (club, aim, power, shape) and one
 * simulated ball in flight; `turn` says whose shot it is.
 *
 * The state object `GS` is a plain mutable object. The 3D frame loop mutates
 * it directly; React re-renders by polling it (see ui/play.tsx).
 */
import { HOLES } from '../course/holes'
import { buildHole, headingTo, type Hole } from '../course/course'
import { CLUBS, PUTTER, LIE_CARRY, MAX_STROKES, YD, AI_NAME, AI_SHORT, type ClubMods, type ConsumableId, type Difficulty } from '../config'
import { STOCK_MODS, effectiveCarries } from '../progress/equipment'
import { payHole } from '../progress/rewards'
import { saveRound } from '../progress/roundSave'
import type { Ball } from '../sim/sim'
import { sfx } from '../sound'

/**
 * Turn phases:
 * intro (hole flyover) -> plan (player aiming) -> swing (meter running) -> flight (ball moving)
 *                      -> ai (opponent lining up) -> flight ...
 * -> holed (both golfers finished the hole).
 */
export type Phase = 'intro' | 'plan' | 'swing' | 'ai' | 'flight' | 'holed'

/** A short-lived spark of sand, grass or water spray. */
export interface Particle { p: number[]; v: number[]; life: number; max: number; c: [number, number, number] }

/** Big centered text such as "BIRDIE". `at` is the performance.now() time it appeared. */
export interface Banner { text: string; sub?: string; color: string; at: number }

/** What a golfer intends to hit: the same inputs the player controls. */
export interface ShotPlan {
  club: number    // index into CLUBS
  heading: number // aim direction in radians (see dirOf)
  power: number   // full swing: fraction of full carry (0-1); putter: intended roll distance in meters
  curve: number   // -1 (full draw) to 1 (full fade)
}

/** One golfer's progress through the round. */
export interface GolferState {
  name: string
  isAI: boolean
  ball: number[]     // current resting position
  lastPos: number[]  // position before the last shot (penalty replay spot)
  strokes: number    // strokes on the current hole
  scores: number[]   // strokes per hole; 0 = not played yet
  holed: boolean     // finished the current hole (holed out or picked up)
  mods: ClubMods[]   // per-club equipment modifiers (stock for the AI)
}

/** Colors for the player's ball, clubs and clothes. */
export interface PlayerLook { ball: string; shaft: string; head: string; shirt: string; pants: string; cap: string }

/** What the player brings into a round from their profile. */
export interface RoundSetup {
  mods: ClubMods[]                 // equipped gear
  charges: (ConsumableId | null)[] // consumable loadout, one per key 1-3
  look: PlayerLook
  coins: number                    // balance at the start of the round
}

/** A "+30 Birdie" coin popup. `at` is the performance.now() time it appeared. */
export interface CoinPopup { label: string; coins: number; at: number }

/** The AI's progress on its current shot. The planner runs a little each frame (see ai.ts). */
export interface AiTurn {
  elapsed: number                                  // seconds spent lining up
  planner: Generator<void, ShotPlan, void> | null  // incremental shot search
  plan: ShotPlan | null                            // the chosen shot, once planning finishes
}

/** Game state for a nine-hole round. Positions are [x, y, z] in meters. */
export interface GS extends ShotPlan {
  // round and hole
  nine: number            // 0 = front nine, 1 = back nine
  idx: number             // hole index within the nine (0-8)
  hole: Hole
  phase: Phase
  introT: number          // seconds into the intro flyover
  holedAt: number         // time the hole finished (debounces Space)

  // golfers and turn order
  golfers: GolferState[]  // [player, AI]
  turn: number            // index of the golfer playing now
  honor: number           // index of the golfer who tees off first on this hole
  difficulty: Difficulty
  ai: AiTurn | null

  // progression
  roundId: string                    // unique id, so a round can only pay out once
  charges: (ConsumableId | null)[]   // the player's consumables for this round (null = empty or used)
  boostSlot: number | null           // charge armed for the next shot (keys 1-3), if any
  boosted: boolean                   // a consumable was used this round (separate record category)
  look: PlayerLook
  coins: number                      // current coin balance, shown in the HUD
  coinPopups: CoinPopup[]            // recent coin gains, shown briefly

  // the shot in progress (shot plan fields come from ShotPlan)
  shotStart: number[]     // where the in-flight shot was struck from
  sim: Ball | null        // the ball being simulated during flight
  acc: number             // leftover frame time not yet simulated (fixed-step accumulator)
  fast: boolean           // fast-forward the current flight
  lastContacts: number    // ground contacts already handled for sound and particles

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
  streak: number          // the player's consecutive perfect strikes
  strikeAt: number        // time of the last strike (drives the golfer animation)
  confettiAt: number
  trail: number[][]       // points the ball has passed through this shot
  fx: Particle[]
}

/** Index of the player and the AI opponent in `golfers`. */
export const PLAYER = 0
export const OPPONENT = 1

/** The golfer whose turn it is. */
export const active = (g: GS) => g.golfers[g.turn]
export const player = (g: GS) => g.golfers[PLAYER]
export const opponent = (g: GS) => g.golfers[OPPONENT]

/** Final (or partial, if quit) scores for the end-of-round screen and rewards. */
export interface RoundResult {
  id: string
  nine: number
  difficulty: Difficulty
  you: number[]
  opponent: number[]
  boosted: boolean
  completed: boolean // all nine holes finished (only completed rounds earn rewards and records)
}

/** Snapshot of the round's scores. */
export function roundResult(g: GS): RoundResult {
  const you = [...player(g).scores]
  return {
    id: g.roundId, nine: g.nine, difficulty: g.difficulty, you, opponent: [...opponent(g).scores],
    boosted: g.boosted, completed: you.every(s => s > 0) && g.phase === 'holed',
  }
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

/** Name and banner color for a hole score, e.g. ['BIRDIE', '#7CFFB2']. */
export function scoreName(strokes: number, par: number): [string, string] {
  if (strokes === 1) return ['HOLE IN ONE', '#ff7ae0']
  const toPar = strokes - par
  return SCORE_NAMES[toPar] ?? [`+${toPar}`, '#ff8a7a']
}

/** A golfer at the start of a round. */
function newGolfer(name: string, isAI: boolean, mods: ClubMods[]): GolferState {
  return { name, isAI, ball: [0, 0, 0], lastPos: [0, 0, 0], strokes: 0, scores: Array(9).fill(0), holed: false, mods }
}

/** A random id for a new round. */
const newRoundId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/**
 * Creates a fresh round on the chosen nine against the AI at `difficulty`, with the
 * player's gear, consumables and look from `setup`, and starts its first hole.
 */
export function newGame(nine: number, difficulty: Difficulty, setup: RoundSetup): GS {
  const g = createState(nine, difficulty, setup, newRoundId())
  startHole(g, 0)
  return g
}

/** A round's state object with nothing played yet (used by newGame and when resuming a save). */
export function createState(nine: number, difficulty: Difficulty, setup: RoundSetup, roundId: string): GS {
  return {
    nine, idx: 0, hole: buildHole(HOLES[nine * 9]), phase: 'intro', introT: 0, holedAt: 0,
    golfers: [newGolfer('You', false, setup.mods), newGolfer(AI_NAME, true, STOCK_MODS)],
    turn: PLAYER, honor: PLAYER, difficulty, ai: null,
    roundId, charges: [...setup.charges], boostSlot: null, boosted: false, look: setup.look,
    coins: setup.coins, coinPopups: [],
    club: 0, heading: 0, power: 1, curve: 0,
    shotStart: [0, 0, 0], sim: null, acc: 0, fast: false, lastContacts: 0,
    meterT: 0, meterOn: false,
    contact: null, contactT: 0, final: null,
    cam: 0, overhead: false,
    feedback: '', feedbackAt: 0, banner: null, streak: 0, strikeAt: 0, confettiAt: 0, trail: [], fx: [],
  }
}

/**
 * Tee honors: the golfer with the lower score on the previous hole tees off first.
 * A tie keeps the previous honor. The player has the honor on the first hole.
 */
function updateHonor(g: GS, idx: number) {
  if (idx === 0) { g.honor = PLAYER; return }
  const [p, o] = g.golfers.map(golfer => golfer.scores[idx - 1])
  if (p < o) g.honor = PLAYER
  else if (o < p) g.honor = OPPONENT
}

/** Loads hole `idx` of the current nine, places both golfers on the tee and starts the intro flyover. */
export function startHole(g: GS, idx: number) {
  updateHonor(g, idx)
  g.idx = idx
  g.hole = buildHole(HOLES[g.nine * 9 + idx])
  const h = g.hole
  for (const golfer of g.golfers) {
    golfer.ball = [0, h.height(0, 0), 0]
    golfer.lastPos = [...golfer.ball]
    golfer.strokes = 0
    golfer.holed = false
  }
  g.turn = g.honor
  g.ai = null
  g.boostSlot = null
  g.sim = null
  g.trail = []
  g.phase = 'intro'
  g.introT = 0
  g.curve = 0
  setFeedback(g, h.def.name)
  showBanner(g, `HOLE ${h.def.num}`, '#ffffff', `PAR ${h.def.par} · ${h.def.yards} YDS`)
  prepShot(g)
  saveRound(g)
}

/** Hands control to the golfer whose turn it is: the player plans, the AI lines up. */
export function beginTurn(g: GS) {
  if (active(g).isAI) {
    g.phase = 'ai'
    g.ai = { elapsed: 0, planner: null, plan: null }
  } else {
    g.phase = 'plan'
    g.ai = null
  }
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

/** Prefixes a message with the golfer's name when it is about the AI. */
const about = (golfer: GolferState, msg: string) => (golfer.isAI ? `${AI_SHORT}: ${msg}` : msg)

/** Sets default aim, club and power for the active golfer's next shot from their ball's position and lie. */
export function prepShot(g: GS) {
  const h = g.hole
  const golfer = active(g)
  const d = distXZ(golfer.ball, h.pin[0], h.pin[1])

  g.heading = headingTo(golfer.ball, h.pin[0], h.pin[1])
  if (d > AIM_DOWN_LEG_DIST && golfer.strokes === 0) {
    const corner = h.path[1]
    g.heading = headingTo(golfer.ball, corner[0], corner[1])
  }

  const lie = h.lie(golfer.ball[0], golfer.ball[2])
  if (lie === 'green') {
    g.club = PUTTER
    g.power = d
    g.curve = 0
    return
  }
  const { club, power } = clubFor(d / YD / (LIE_CARRY[lie] ?? 1), effectiveCarries(golfer.mods))
  g.club = club
  g.power = power
}

/**
 * Chooses the shortest club whose full carry still covers `yards` (allowing 3% short),
 * falling back to the driver, and the power fraction needed. `carries` defaults to stock clubs.
 */
export function clubFor(yards: number, carries = CLUBS.map(c => c.carry)) {
  let club = 0
  for (let i = 0; i < PUTTER; i++) {
    if (carries[i] >= yards * 0.97) club = i // clubs go longest to shortest, so the last match is the shortest
  }
  return { club, power: Math.min(1, yards / carries[club]) }
}

/** Formats a remaining distance in yards, switching to feet inside 30 yards. */
function formatRemaining(yds: number) {
  return yds < 30 ? `${(yds * 3).toFixed(0)} ft` : `${yds.toFixed(0)} yds`
}

/** Called when the simulated ball stops. Scores, penalizes or settles the shot, then passes the turn. */
export function finishShot(g: GS) {
  const b = g.sim!
  const golfer = active(g)
  if (b.mode === 'holed') holeOut(g, golfer, b)
  else if (b.mode === 'water' || b.mode === 'oob') applyPenalty(g, golfer, b.mode)
  else settleBall(g, golfer, b)

  g.sim = null
  if (!golfer.holed && golfer.strokes >= MAX_STROKES) pickUp(g, golfer)
  nextTurn(g)
  saveRound(g) // between shots: the next golfer is up, or the hole is complete
}

/**
 * Picks who plays next: the golfer still playing who is farthest from the pin
 * (ties go to the golfer with the honor). Ends the hole when both are done.
 */
function nextTurn(g: GS) {
  const h = g.hole
  const remaining = g.golfers.map((golfer, i) => ({ i, golfer })).filter(x => !x.golfer.holed)
  if (remaining.length === 0) { completeHole(g); return }

  const dist = (x: { golfer: GolferState }) => distXZ(x.golfer.ball, h.pin[0], h.pin[1])
  remaining.sort((a, b) => dist(b) - dist(a) || (a.i === g.honor ? -1 : b.i === g.honor ? 1 : 0))
  g.turn = remaining[0].i
  prepShot(g)
  beginTurn(g)
}

/** Ball dropped: records the score, with banner, sound and confetti for the player and a toast for the AI. */
function holeOut(g: GS, golfer: GolferState, b: Ball) {
  const par = g.hole.def.par
  golfer.ball = [...b.p]
  golfer.holed = true
  golfer.scores[g.idx] = golfer.strokes
  const [name, color] = scoreName(golfer.strokes, par)
  sfx.cup()

  if (golfer.isAI) {
    setFeedback(g, `${AI_NAME} holes out · ${name.toLowerCase()} (${golfer.strokes})`)
    return
  }
  showBanner(g, name, color, `${golfer.strokes} strokes`)
  setFeedback(g, 'In the cup!')
  awardHole(g, golfer.strokes, par)
  const toPar = golfer.strokes - par
  if (toPar < 0 || golfer.strokes === 1) {
    sfx.cheer(toPar <= -2 || golfer.strokes === 1)
    g.confettiAt = performance.now()
  } else if (toPar >= 2) {
    sfx.groan()
  }
}

/** Pays the player's coins for this hole right away and queues a popup for each reward. */
function awardHole(g: GS, strokes: number, par: number) {
  const paid = payHole(g.roundId, g.idx, strokes, par)
  if (!paid) return
  g.coins = paid.balance
  const now = performance.now()
  for (const line of paid.lines) g.coinPopups.push({ ...line, at: now })
  sfx.coin()
}

/** Both golfers are done: shows the player's result and both scores until Space is pressed. */
function completeHole(g: GS) {
  const p = player(g), o = opponent(g)
  const [name, color] = scoreName(p.scores[g.idx], g.hole.def.par)
  g.phase = 'holed'
  g.ai = null
  showBanner(g, name, color, `You ${p.scores[g.idx]} · ${AI_SHORT} ${o.scores[g.idx]} · Space for next hole`)
  g.holedAt = performance.now()
}

/** Water or out of bounds: one penalty stroke and replay from the previous spot (stroke and distance). */
function applyPenalty(g: GS, golfer: GolferState, mode: 'water' | 'oob') {
  golfer.strokes++
  golfer.ball = [...golfer.lastPos]
  const sub = '+1 stroke · replay from previous spot'
  showBanner(g, mode === 'water' ? 'SPLASH' : 'OUT OF BOUNDS', '#8fd3ff', golfer.isAI ? `${AI_SHORT} · ${sub}` : sub)
  setFeedback(g, about(golfer, 'Penalty stroke'))
  if (mode === 'oob') sfx.groan()
}

/** Ball came to rest in play: moves it there and reports the shot distance, distance left and lie. */
function settleBall(g: GS, golfer: GolferState, b: Ball) {
  const h = g.hole
  const carried = distXZ(g.shotStart, b.p[0], b.p[2]) / YD
  golfer.ball = [...b.p]
  const rem = distXZ(golfer.ball, h.pin[0], h.pin[1]) / YD
  const lie = h.lie(golfer.ball[0], golfer.ball[2])
  const where = lie === 'green' ? 'on the green' : 'in the ' + lie
  setFeedback(g, about(golfer, `${carried.toFixed(0)} yds · ${formatRemaining(rem)} left · ${where}`))
  if (!golfer.isAI && lie === 'green' && rem < 3 && h.def.par - golfer.strokes >= 2) showBanner(g, 'TAP-IN EAGLE LOOK', '#ffd23f')
}

/** Hit the stroke limit: records the score and ends the golfer's hole. */
function pickUp(g: GS, golfer: GolferState) {
  golfer.scores[g.idx] = golfer.strokes
  golfer.holed = true
  if (golfer.isAI) setFeedback(g, `${AI_NAME} picks up`)
  else showBanner(g, 'PICKED UP', '#ffb36b')
}
