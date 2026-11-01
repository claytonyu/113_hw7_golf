/**
 * Keyboard controls during a round. Translates keydown events into changes to
 * the game state. Planning keys only work in the 'plan' phase, so the shot is
 * locked during the swing and ball flight.
 */
import { PUTTER, CONTROLS } from '../config'
import { distXZ, startHole, type GS } from './game'
import { strike } from './shot'
import { sfx, unlockAudio } from '../sound'

/** Keys whose browser default (scrolling, focus change) is suppressed during play. */
const GAME_KEYS = ['Space', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyQ', 'KeyE', 'KeyR', 'KeyC']

/** Minimum time (ms) after holing out before Space advances, so a held swing press can't skip the result. */
const HOLED_DEBOUNCE = 700

/** Callbacks from the React layer. */
export interface KeyActions {
  refresh(): void               // re-render the UI after a state change
  togglePause(): void
  finishRound(scores: number[]): void
}

/** Handles one keydown event during play. */
export function handleKeyDown(g: GS, e: KeyboardEvent, actions: KeyActions) {
  if (GAME_KEYS.includes(e.code)) e.preventDefault()
  unlockAudio() // browsers only allow audio after a user gesture

  switch (e.code) {
    case 'Escape':
      actions.togglePause()
      return
    case 'Tab':
      if (!e.repeat) { g.overhead = !g.overhead; sfx.click() }
      return
    case 'KeyC':
      if (!e.repeat) { g.cam = (g.cam + 1) % 2; sfx.click() }
      return
    case 'Space':
      if (!e.repeat) handleSpace(g, actions) // holding Space must not repeat swings
      return
  }

  if (g.phase !== 'plan') return
  handlePlanningKey(g, e)
  actions.refresh()
}

/** Space does something different in each phase: skip intro, next hole, start swing, strike, fast-forward. */
function handleSpace(g: GS, actions: KeyActions) {
  switch (g.phase) {
    case 'intro':
      g.phase = 'plan'
      actions.refresh()
      return
    case 'holed':
      if (performance.now() - g.holedAt <= HOLED_DEBOUNCE) return
      if (g.idx >= 8) actions.finishRound(g.scores)
      else startHole(g, g.idx + 1)
      actions.refresh()
      return
    case 'plan':
      g.phase = 'swing'
      g.meterT = 0
      g.meterOn = true
      g.overhead = false
      sfx.start()
      actions.refresh()
      return
    case 'swing':
      if (g.meterOn) { strike(g, g.meterT); actions.refresh() }
      return
    case 'flight':
      g.fast = true
      return
  }
}

/** Aim, power, shape and club keys. Shift gives finer steps. */
function handlePlanningKey(g: GS, e: KeyboardEvent) {
  const putting = g.club === PUTTER
  const fine = e.shiftKey ? CONTROLS.fine : 1
  const aimStep = (putting ? CONTROLS.puttAimStep : CONTROLS.aimStep) * fine

  switch (e.code) {
    case 'KeyA':
      g.heading -= aimStep
      break
    case 'KeyD':
      g.heading += aimStep
      break
    case 'KeyW':
      // For the putter, power is a distance in meters with no upper limit.
      g.power = putting ? g.power + CONTROLS.puttStep * fine : Math.min(1, g.power + CONTROLS.powerStep * fine)
      break
    case 'KeyS':
      g.power = putting
        ? Math.max(CONTROLS.minPutt, g.power - CONTROLS.puttStep * fine)
        : Math.max(CONTROLS.minPower, g.power - CONTROLS.powerStep * fine)
      break
    case 'KeyQ':
      if (!putting) { g.curve = Math.max(-1, roundCurve(g.curve - CONTROLS.curveStep)); sfx.tick() }
      break
    case 'KeyE':
      if (!putting) { g.curve = Math.min(1, roundCurve(g.curve + CONTROLS.curveStep)); sfx.tick() }
      break
    case 'KeyR':
      g.curve = 0
      break
    case 'ArrowLeft':
      changeClub(g, -1)
      break
    case 'ArrowRight':
      changeClub(g, 1)
      break
  }
}

/** Rounds to 2 decimals so repeated 0.1 steps land exactly on 0 (straight). */
const roundCurve = (c: number) => +c.toFixed(2)

/** Moves one club longer (-1) or shorter (+1). Disabled on the green, where the putter is forced. */
function changeClub(g: GS, dir: -1 | 1) {
  const onGreen = g.hole.lie(g.ball[0], g.ball[2]) === 'green'
  if (onGreen) return
  g.club = Math.max(0, Math.min(PUTTER, g.club + dir))
  sfx.click()
  if (g.club === PUTTER) {
    // Switching to the putter: power becomes the distance to the pin, and shaping is disabled.
    g.power = distXZ(g.ball, g.hole.pin[0], g.hole.pin[1])
    g.curve = 0
  } else if (g.power > 1) {
    g.power = 1 // coming back from the putter, where power was in meters
  }
}
