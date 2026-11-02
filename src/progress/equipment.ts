/**
 * Turns equipped gear into per-club shot modifiers (see ClubMods in config.ts).
 */
import { CLUBS, EQUIPMENT, EQUIP_SLOTS, NO_MODS, type ClubMods, type EquipSlot } from '../config'

/** Modifiers for every club (indexed like CLUBS) from the equipped item in each slot. */
export function clubModsFor(equipment: Record<EquipSlot, string>): ClubMods[] {
  const mods = CLUBS.map(() => ({ ...NO_MODS }))
  for (const { slot, clubs } of EQUIP_SLOTS) {
    const item = EQUIPMENT.find(e => e.id === equipment[slot])
    if (!item) continue
    for (const c of clubs) mods[c] = { ...NO_MODS, ...item.mods }
  }
  return mods
}

/** Stock gear for every club (used by the AI opponent). */
export const STOCK_MODS: ClubMods[] = CLUBS.map(() => ({ ...NO_MODS }))

/** Effective full-power carry (yards) of each club with these modifiers. */
export const effectiveCarries = (mods: ClubMods[]) => CLUBS.map((c, i) => c.carry * mods[i].carry)
