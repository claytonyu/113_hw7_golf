/**
 * The AI opponent ("Tiger Woods — AI opponent", unofficial and game-simulated).
 *
 * The AI never invents a score. For each shot it:
 * 1. Builds candidate plans (club, aim, power, shape) like a player would.
 * 2. Simulates each one with the real physics (using its own, possibly imperfect,
 *    read of the wind) and scores where the ball ends up by expected strokes to
 *    hole out from there. That makes it weigh distance, lie, hazards, landing
 *    area and the approach it leaves.
 * 3. Re-scores the best few against its own miss pattern, so risky lines near
 *    hazards look worse than safe ones.
 * 4. Hits the winner through strike(), the same code path as the player, with a
 *    random timing error drawn from its difficulty level.
 *
 * Planning runs incrementally (a generator) so the frame rate stays smooth
 * while the AI "lines up" its shot.
 */
import { AI_LEVELS, CLUBS, LIE_CARRY, PUTTER, YD, type AiLevel } from '../config'
import { headingTo, type Hole } from '../course/course'
import { simulateToRest } from '../sim/sim'
import { computeShot, launchShot, strike } from './shot'
import { active, clubFor, distXZ, type GS, type ShotPlan } from './game'

// ---------- expected strokes to hole out ----------

/** Putts to hole out by distance in meters (approximate tour averages). */
const PUTT_TABLE: [number, number][] = [[0, 1], [0.9, 1.04], [1.5, 1.23], [3, 1.6], [6, 1.87], [9, 1.98], [18, 2.2], [30, 2.4]]

/** Strokes to hole out from the fairway by distance in yards (approximate tour averages). */
const APPROACH_TABLE: [number, number][] = [
  [0, 2.0], [10, 2.2], [20, 2.4], [50, 2.6], [100, 2.8], [150, 2.98],
  [200, 3.2], [250, 3.45], [300, 3.7], [400, 4.0], [500, 4.4], [650, 4.9],
]

/** Extra expected strokes for playing from a worse lie than the fairway. */
const LIE_EXTRA: Record<string, number> = { rough: 0.2, sand: 0.35 }

/** Linear interpolation in a [x, y] table sorted by x; clamps below and extends the last slope above. */
function interp(table: [number, number][], x: number) {
  if (x <= table[0][0]) return table[0][1]
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]
    if (x <= x1) {
      const [x0, y0] = table[i - 1]
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    }
  }
  const [xa, ya] = table[table.length - 2], [xb, yb] = table[table.length - 1]
  return yb + (yb - ya) * (x - xb) / (xb - xa)
}

/** Expected strokes to hole out from position `p`. */
export function expectedStrokes(hole: Hole, p: number[]) {
  const d = distXZ(p, hole.pin[0], hole.pin[1])
  const lie = hole.lie(p[0], p[2])
  if (lie === 'green') return interp(PUTT_TABLE, d)
  return interp(APPROACH_TABLE, d / YD) + (LIE_EXTRA[lie] ?? 0)
}

/**
 * Expected total strokes for hitting `plan` from `start` with timing error `err`:
 * this stroke, plus a penalty stroke and a replay if the ball leaves play,
 * plus the expected strokes from wherever it stops.
 */
function shotCost(hole: Hole, start: number[], plan: ShotPlan, wind: number[], err: number) {
  const s = computeShot(hole, start, plan, err)
  const b = simulateToRest(launchShot(start, s), hole, wind)
  if (b.mode === 'holed') return 1
  if (b.mode === 'water' || b.mode === 'oob') return 2 + expectedStrokes(hole, start)
  return 1 + expectedStrokes(hole, b.p)
}

// ---------- candidate shots ----------

/** Full-shot candidates: every combination of target line, aim offset, carry and shape the level considers. */
function fullShotCandidates(hole: Hole, start: number[], level: AiLevel): ShotPlan[] {
  const lie = hole.lie(start[0], start[2])
  const lieCarry = LIE_CARRY[lie] ?? 1
  const toPinYd = distXZ(start, hole.pin[0], hole.pin[1]) / YD
  const maxCarryYd = CLUBS[0].carry

  // Carries (flat-ground yards before lie loss): at or short of the pin, plus layups.
  const carries = level.carryFractions.map(f => toPinYd * f / lieCarry)
  for (const f of level.layups) if (maxCarryYd * f < toPinYd * 0.95 / lieCarry) carries.push(maxCarryYd * f)
  const clubPowers = new Map<string, { club: number; power: number }>()
  for (const yd of carries) {
    if (yd < 5) continue
    const { club, power } = clubFor(yd)
    const p = Math.max(0.1, power)
    clubPowers.set(`${club}|${p.toFixed(3)}`, { club, power: p })
  }

  // Target lines: straight at the pin, plus dogleg corners still ahead and within reach.
  const bases = [headingTo(start, hole.pin[0], hole.pin[1])]
  const startAlong = hole.project(start[0], start[2]).along
  for (const corner of hole.path.slice(1, -1)) {
    const ahead = hole.project(corner[0], corner[1]).along > startAlong + 20
    const reachable = distXZ(start, corner[0], corner[1]) < maxCarryYd * YD * 1.15
    if (ahead && reachable) bases.push(headingTo(start, corner[0], corner[1]))
  }

  const plans: ShotPlan[] = []
  for (const { club, power } of clubPowers.values())
    for (const base of bases)
      for (const off of level.aimOffsets)
        for (const curve of level.shapes) plans.push({ club, heading: base + off, power, curve })
  return plans
}

/** Putt aim offsets (radians) and pace multipliers searched on the green. */
const PUTT_AIMS = Array.from({ length: 17 }, (_, i) => (i - 8) * 0.03)
const PUTT_PACES = [0.95, 1.05, 1.15, 1.3, 1.5]

/** Putt candidates: a grid of aim lines and paces around the straight putt. */
function puttCandidates(hole: Hole, start: number[]): ShotPlan[] {
  const d = distXZ(start, hole.pin[0], hole.pin[1])
  const base = headingTo(start, hole.pin[0], hole.pin[1])
  const plans: ShotPlan[] = []
  for (const aim of PUTT_AIMS)
    for (const pace of PUTT_PACES) plans.push({ club: PUTTER, heading: base + aim, power: Math.max(0.3, d * pace), curve: 0 })
  return plans
}

/** Small adjustments around the best putt found so far. */
function puttRefinements(best: ShotPlan): ShotPlan[] {
  const plans: ShotPlan[] = []
  for (const da of [-0.02, -0.01, 0, 0.01, 0.02])
    for (const pm of [0.97, 1, 1.03]) plans.push({ ...best, heading: best.heading + da, power: best.power * pm })
  return plans
}

/**
 * Timing errors (and weights) used to judge risk: three points that match a
 * normal distribution with the level's spread, plus its occasional big miss either way.
 */
function riskSamples(level: AiLevel): [number, number][] {
  const s = level.timingSigma * Math.sqrt(3)
  const m = level.mistakeChance
  const big = (level.mistakeSize[0] + level.mistakeSize[1]) / 2
  return [[-s, (1 - m) / 6], [0, (1 - m) * 2 / 3], [s, (1 - m) / 6], [-big, m / 2], [big, m / 2]]
}

// ---------- planning ----------

interface Scored { plan: ShotPlan; cost: number }

/**
 * Searches for the AI's best shot from `start`, yielding after each simulated
 * candidate so the work can be spread across frames. Returns the chosen plan.
 */
export function* planShot(hole: Hole, start: number[], level: AiLevel): Generator<void, ShotPlan, void> {
  const wind = hole.wind.map(w => w * level.windRead) // the AI's read of the wind
  const onGreen = hole.lie(start[0], start[2]) === 'green'

  // Stage 1: every candidate, assuming a perfect strike.
  const scored: Scored[] = []
  const tryAll = function* (plans: ShotPlan[]) {
    for (const plan of plans) {
      scored.push({ plan, cost: shotCost(hole, start, plan, wind, 0) })
      yield
    }
  }
  if (onGreen) {
    yield* tryAll(puttCandidates(hole, start))
    scored.sort((a, b) => a.cost - b.cost)
    yield* tryAll(puttRefinements(scored[0].plan))
  } else {
    yield* tryAll(fullShotCandidates(hole, start, level))
  }
  scored.sort((a, b) => a.cost - b.cost)

  // Stage 2: re-score the best few against the AI's own misses (skipped by weaker levels).
  const top = scored.slice(0, level.riskChecks)
  for (const c of top) {
    c.cost = riskSamples(level).reduce((sum, [err, w]) => sum + w * (err === 0 ? c.cost : shotCost(hole, start, c.plan, wind, err)), 0)
    yield
  }
  top.sort((a, b) => a.cost - b.cost)
  return (top[0] ?? scored[0]).plan
}

// ---------- execution ----------

/** Standard normal random number (Box–Muller). */
function gaussian() {
  const u = 1 - Math.random(), v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Random swing-meter timing error for one AI swing: usually small, occasionally a big miss. */
function timingError(level: AiLevel) {
  if (Math.random() < level.mistakeChance) {
    const [lo, hi] = level.mistakeSize
    return (Math.random() < 0.5 ? -1 : 1) * (lo + Math.random() * (hi - lo))
  }
  return gaussian() * level.timingSigma
}

/** Applies green-reading error to a putt plan: slightly wrong line and pace. */
function misreadPutt(plan: ShotPlan, level: AiLevel): ShotPlan {
  if (plan.club !== PUTTER) return plan
  return {
    ...plan,
    heading: plan.heading + gaussian() * level.puttAimSigma,
    power: Math.max(0.3, plan.power * (1 + gaussian() * level.puttPaceSigma)),
  }
}

/** Planner time budget per frame (ms). */
const PLAN_BUDGET_MS = 6

/** Seconds of backswing shown at the end of the AI's lining-up time. */
export const AI_BACKSWING = 0.45

/**
 * Advances the AI's turn by `dt` seconds: runs the planner within the frame
 * budget, shows the chosen club and aim, and swings once the think time has
 * passed. With `force`, finishes planning and swings immediately (skip).
 */
export function advanceAiTurn(g: GS, dt: number, force = false) {
  const ai = g.ai!
  const level = AI_LEVELS[g.difficulty]
  ai.elapsed += dt
  if (!ai.planner) ai.planner = planShot(g.hole, active(g).ball, level)

  if (!ai.plan) {
    const t0 = performance.now()
    for (;;) {
      const r = ai.planner.next()
      if (r.done) {
        ai.plan = misreadPutt(r.value, level)
        Object.assign(g, ai.plan) // show the chosen club and aim
        break
      }
      if (!force && performance.now() - t0 > PLAN_BUDGET_MS) break
    }
  }

  if (ai.plan && (force || ai.elapsed >= level.thinkTime)) {
    const t = Math.min(1, Math.max(0, 0.5 + timingError(level)))
    strike(g, t)
  }
}
