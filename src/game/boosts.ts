/**
 * Consumable boosts during a round. The player arms one of their (up to three)
 * charges with keys 1-3 before swinging; pressing the same key again cancels.
 * A charge is spent only when the boosted shot is actually struck, and the
 * profile is saved at that moment so a reload can't restore it.
 */
import { BOOSTS, CONSUMABLES, PUTTER, type ClubMods, type ConsumableId } from '../config'
import { spendConsumable } from '../progress/profile'
import { PLAYER, setFeedback, type GS } from './game'
import { sfx } from '../sound'

const nameOf = (id: ConsumableId) => CONSUMABLES.find(c => c.id === id)!.name

/** Power Boost changes carry, so it can't be used with the putter. */
export const boostFits = (id: ConsumableId, club: number) => !(id === 'power' && club === PUTTER)

/** The boost armed for the player's next shot, or null. */
export function armedBoost(g: GS): ConsumableId | null {
  if (g.turn !== PLAYER || g.boostSlot === null) return null
  return g.charges[g.boostSlot] ?? null
}

/** Arms the charge in `slot` (0-2), switches to it from another, or cancels it if already armed. */
export function toggleBoost(g: GS, slot: number) {
  const id = g.charges[slot]
  if (!id) { setFeedback(g, `Slot ${slot + 1} is empty`); return }
  if (g.boostSlot === slot) {
    g.boostSlot = null
    setFeedback(g, `${nameOf(id)} cancelled`)
    sfx.click()
    return
  }
  if (!boostFits(id, g.club)) { setFeedback(g, `${nameOf(id)} can't be used for putts`); return }
  g.boostSlot = slot // at most one boost per shot: arming a new one replaces the old
  setFeedback(g, `${nameOf(id)} armed · press ${slot + 1} again to cancel`)
  sfx.tick()
}

/** Cancels the armed boost if it no longer fits the selected club (e.g. switching to the putter). */
export function dropUnfitBoost(g: GS) {
  const id = armedBoost(g)
  if (id && !boostFits(id, g.club)) {
    g.boostSlot = null
    setFeedback(g, `${nameOf(id)} cancelled · not for putts`)
  }
}

/** Shot modifiers from the armed boost (multiplied into the club's equipment modifiers). */
export function boostMods(id: ConsumableId | null): Partial<ClubMods> {
  if (id === 'power') return { carry: BOOSTS.powerCarry }
  if (id === 'steady') return { zone: BOOSTS.steadyZone }
  return {}
}

/** Swing-meter speed multiplier: Slow Tempo slows the marker. */
export const meterSpeed = (g: GS) => (armedBoost(g) === 'tempo' ? BOOSTS.tempoSpeed : 1)

/**
 * Called at the moment of the strike. Spends the armed charge from the saved
 * profile, empties its slot and marks the round as boosted. Returns the boost
 * that applies to this shot, or null if none (or if no charge was left to spend).
 */
export function useArmedBoost(g: GS): ConsumableId | null {
  const id = armedBoost(g)
  const slot = g.boostSlot
  g.boostSlot = null
  if (!id || slot === null || !boostFits(id, g.club)) return null
  if (!spendConsumable(id)) {
    g.charges[slot] = null
    return null
  }
  g.charges[slot] = null
  g.boosted = true
  return id
}
