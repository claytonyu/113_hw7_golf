/**
 * Per-frame game update, called from the 3D render loop: advances the intro
 * timer, the swing meter, and the ball simulation.
 */
import { PUTTER, METER } from '../config'
import { step, DT } from '../sim/sim'
import { finishShot, INTRO, type GS } from './game'
import { strike } from './shot'
import { onContact } from './effects'

/** Fast-forward speed multiplier while Space is pressed during flight. */
const FAST_FORWARD = 5

/** At most this many physics steps per frame, so a long frame can't freeze the game. */
const MAX_STEPS_PER_FRAME = 200

/** Advances the game by `dt` seconds of real time. */
export function advanceGame(g: GS, dt: number) {
  if (g.phase === 'intro') advanceIntro(g, dt)
  if (g.phase === 'swing' && g.meterOn) advanceMeter(g, dt)
  if (g.phase === 'flight' && g.sim) advanceFlight(g, dt)
}

/** Ends the intro flyover once it has run its full length. */
function advanceIntro(g: GS, dt: number) {
  g.introT += dt
  if (g.introT >= INTRO) g.phase = 'plan'
}

/** Moves the swing-meter marker. If it reaches the end, the shot is struck as maximally late. */
function advanceMeter(g: GS, dt: number) {
  const period = g.club === PUTTER ? METER.puttPeriod : METER.period
  g.meterT += dt / period
  if (g.meterT >= 1) strike(g, 1)
}

const isMoving = (mode: string) => mode === 'air' || mode === 'roll'

/**
 * Runs as many fixed physics steps as the elapsed time allows (accumulator
 * pattern), triggering contact effects and recording the trail. Ends the shot
 * once the ball stops moving.
 */
function advanceFlight(g: GS, dt: number) {
  const ball = g.sim!
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
    if (n % 2 === 0 && isMoving(ball.mode)) g.trail.push([...ball.p])
    if (!isMoving(ball.mode)) break
  }
  if (!isMoving(ball.mode)) finishShot(g)
}
