/**
 * Rebuilds a playable round from a saved snapshot (see progress/roundSave.ts).
 */
import { HOLES } from '../course/holes'
import { buildHole } from '../course/course'
import type { RoundSave } from '../progress/roundSave'
import { beginTurn, createState, prepShot, setFeedback, showBanner, type GS } from './game'
import { predictOutcome } from './shot'

/**
 * Restores a saved round. `coins` is the current balance from the profile.
 * - intro: replays the hole flyover.
 * - turn: the golfer who was up plans (or the AI lines up) again from their ball.
 * - flight: the saved launched ball flies again, giving the same result as before the reload.
 * - holed: shows the finished hole; Space moves on.
 */
export function resumeGame(save: RoundSave, coins: number): GS {
  const you = save.golfers[0]
  const g = createState(save.nine, save.difficulty, { mods: you.mods, charges: save.charges, look: save.look, coins }, save.roundId)
  g.idx = save.idx
  g.hole = buildHole(HOLES[save.nine * 9 + save.idx])
  g.golfers = save.golfers.map(x => ({ ...x, ball: [...x.ball], lastPos: [...x.lastPos], scores: [...x.scores] }))
  g.turn = save.turn
  g.honor = save.honor
  g.boosted = save.boosted
  g.streak = save.streak
  const h = g.hole

  if (save.phase === 'flight' && save.sim) {
    prepShot(g)
    g.club = save.club
    g.heading = save.heading
    g.curve = save.sim.curve
    g.shotStart = [...save.shotStart]
    g.sim = { ...save.sim, p: [...save.sim.p], v: [...save.sim.v] }
    g.phase = 'flight'
    g.trail = []
    g.strikeAt = performance.now() - 10_000 // the swing animation already finished
    predictOutcome(g)
  } else if (save.phase === 'holed') {
    g.phase = 'holed'
    showBanner(g, `HOLE ${h.def.num} COMPLETE`, '#ffffff', 'Space for next hole')
  } else if (save.phase === 'intro') {
    prepShot(g)
    g.phase = 'intro'
  } else {
    prepShot(g)
    beginTurn(g)
  }
  setFeedback(g, `Round resumed · Hole ${h.def.num}`)
  return g
}
