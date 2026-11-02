/**
 * Per-frame game update, called from the 3D render loop: advances the intro
 * timer, the swing meter, the AI's turn, and the ball simulation. Also holds
 * the "skip" action that finishes the AI's current shot instantly.
 */
import { PUTTER, METER } from '../config'
import { step, simulateToRest, isMoving, DT } from '../sim/sim'
import { active, beginTurn, finishShot, INTRO, type GS } from './game'
import { strike } from './shot'
import { advanceAiTurn } from './ai'
import { meterSpeed } from './boosts'
import { onContact } from './effects'

/** Fast-forward speed multiplier while Space is pressed during the player's flight. */
const FAST_FORWARD = 5

/** At most this many physics steps per frame, so a long frame can't freeze the game. */
const MAX_STEPS_PER_FRAME = 200

/** Advances the game by `dt` seconds of real time. */
export function advanceGame(g: GS, dt: number) {
  if (g.paused) return // the meter, the AI and the ball all freeze
  if (g.phase === 'intro') advanceIntro(g, dt)
  if (g.phase === 'swing' && g.meterOn) advanceMeter(g, dt)
  if (g.phase === 'ai' && g.ai) advanceAiTurn(g, dt)
  if (g.phase === 'flight' && g.sim) advanceFlight(g, dt)
}

/** Ends the intro flyover once it has run its full length, and starts the first turn. */
function advanceIntro(g: GS, dt: number) {
  g.introT += dt
  if (g.introT >= INTRO) beginTurn(g)
}

/**
 * Moves the swing-meter marker (slower with Slow Tempo armed). If it reaches
 * the end, the shot is struck as maximally late.
 */
function advanceMeter(g: GS, dt: number) {
  const period = g.club === PUTTER ? METER.puttPeriod : METER.period
  g.meterT += dt * meterSpeed(g) / period
  if (g.meterT >= 1) strike(g, 1)
}

/**
 * Runs as many fixed physics steps as the elapsed time allows (accumulator
 * pattern), triggering contact effects and recording the trail. Ends the shot
 * once the ball stops moving.
 */
function advanceFlight(g: GS, dt: number) {
  const ball = g.sim!
  const recordTrail = !active(g).isAI // only the player's shots draw a trail
  g.acc += dt * (g.fast ? FAST_FORWARD : 1)
  let n = 0
  while (g.acc >= DT && n < MAX_STEPS_PER_FRAME) {
    step(ball, g.hole, g.hole.wind)
    g.acc -= DT
    n++
    if (ball.contacts > g.lastContacts || ball.mode === 'water') {
      g.lastContacts = ball.contacts
      onContact(g, ball)
    }
    if (recordTrail && n % 2 === 0 && isMoving(ball)) g.trail.push([...ball.p])
    if (!isMoving(ball)) break
  }
  if (!isMoving(ball)) finishShot(g)
}

/**
 * Skips the AI's current shot: finishes its planning and swing, then runs the
 * ball to rest instantly. The same fixed steps run as in the animated version,
 * so the result is identical.
 */
export function skipAiShot(g: GS) {
  if (g.phase === 'ai' && g.ai) advanceAiTurn(g, 0, true)
  if (g.phase === 'flight' && g.sim && active(g).isAI) {
    simulateToRest(g.sim, g.hole, g.hole.wind, undefined, Infinity)
    finishShot(g)
  }
}
