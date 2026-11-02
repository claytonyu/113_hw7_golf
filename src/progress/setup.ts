/**
 * Builds what the player brings into a round (gear, consumables, look) from their profile.
 */
import { BALL_COLORS, CLUB_FINISHES, OUTFITS } from '../config'
import type { RoundSetup } from '../game/game'
import { clubModsFor } from './equipment'
import type { Profile } from './profile'

export function roundSetup(p: Profile): RoundSetup {
  const ball = BALL_COLORS.find(c => c.id === p.ball) ?? BALL_COLORS[0]
  const finish = CLUB_FINISHES.find(c => c.id === p.finish) ?? CLUB_FINISHES[0]
  const outfit = OUTFITS.find(c => c.id === p.outfit) ?? OUTFITS[0]
  return {
    mods: clubModsFor(p.equipment),
    charges: [...p.loadout],
    coins: p.coins,
    look: { ball: ball.color, shaft: finish.shaft, head: finish.head, shirt: outfit.shirt, pants: outfit.pants, cap: outfit.cap },
  }
}
