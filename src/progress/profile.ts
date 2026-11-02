/**
 * The player's persistent profile: coins, purchases, equipped gear and
 * cosmetics, consumable inventory, the consumables loadout for the next round,
 * personal records, and which rounds have already paid out.
 *
 * Stored in localStorage as JSON. Everything read back is validated, so a
 * corrupted or hand-edited save falls back to safe defaults instead of
 * breaking the game. Operations return a new profile and never mutate the old one.
 */
import {
  BALL_COLORS, CLUB_FINISHES, CONSUMABLES, EQUIPMENT, EQUIP_SLOTS, MAX_CHARGES, OUTFITS,
  type ConsumableId, type Cosmetic, type EquipSlot,
} from '../config'

/** Lowest-score records per nine, kept separately for rounds with and without consumables. */
export type RecordKey = 'front-clean' | 'front-boosted' | 'back-clean' | 'back-boosted'
export const RECORD_KEYS: RecordKey[] = ['front-clean', 'front-boosted', 'back-clean', 'back-boosted']

export interface Profile {
  coins: number
  owned: string[]                              // purchased equipment and cosmetic ids (stock items are always owned)
  equipment: Record<EquipSlot, string>         // equipped item id per slot
  ball: string                                 // equipped cosmetic ids
  finish: string
  outfit: string
  consumables: Record<ConsumableId, number>    // charges owned
  loadout: (ConsumableId | null)[]             // up to MAX_CHARGES charges to bring into the next round
  records: Partial<Record<RecordKey, number>>  // lowest total strokes
  rewardedRounds: string[]                     // payout ids already paid (rounds and holes; prevents double rewards)
}

const STORAGE_KEY = 'torrey.profile.v1'

/** How many paid-out round ids to remember. */
const MAX_REWARDED_IDS = 500

/** Stock (free) equipment id for each slot. */
const STOCK: Record<EquipSlot, string> = Object.fromEntries(
  EQUIP_SLOTS.map(({ slot }) => [slot, EQUIPMENT.find(e => e.slot === slot && e.price === 0)!.id]),
) as Record<EquipSlot, string>

/** Every cosmetic, for lookups by id. */
export const ALL_COSMETICS: Cosmetic[] = [...BALL_COLORS, ...CLUB_FINISHES, ...OUTFITS]

export function defaultProfile(): Profile {
  return {
    coins: 0,
    owned: [],
    equipment: { ...STOCK },
    ball: BALL_COLORS[0].id,
    finish: CLUB_FINISHES[0].id,
    outfit: OUTFITS[0].id,
    consumables: { power: 0, tempo: 0, steady: 0 },
    loadout: Array(MAX_CHARGES).fill(null),
    records: {},
    rewardedRounds: [],
  }
}

/** Is a non-negative whole number? */
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

/** True if the player can use this item: it is free or has been bought. */
export function owns(p: Profile, id: string) {
  const item = EQUIPMENT.find(e => e.id === id) ?? ALL_COSMETICS.find(c => c.id === id)
  return !!item && (item.price === 0 || p.owned.includes(id))
}

/**
 * Builds a valid profile from untrusted stored data: unknown ids, wrong types
 * and impossible values are replaced with defaults.
 */
export function sanitizeProfile(raw: unknown): Profile {
  const p = defaultProfile()
  if (!raw || typeof raw !== 'object') return p
  const r = raw as Record<string, any>

  if (isCount(r.coins)) p.coins = r.coins
  const knownIds = new Set([...EQUIPMENT.map(e => e.id), ...ALL_COSMETICS.map(c => c.id)])
  if (Array.isArray(r.owned)) p.owned = [...new Set(r.owned.filter((id: unknown) => typeof id === 'string' && knownIds.has(id)))] as string[]

  for (const { slot } of EQUIP_SLOTS) {
    const id = r.equipment?.[slot]
    const item = EQUIPMENT.find(e => e.id === id)
    if (item && item.slot === slot && owns(p, id)) p.equipment[slot] = id
  }
  for (const [field, list] of [['ball', BALL_COLORS], ['finish', CLUB_FINISHES], ['outfit', OUTFITS]] as const) {
    const id = r[field]
    if (list.some(c => c.id === id) && owns(p, id)) p[field] = id
  }
  for (const c of CONSUMABLES) if (isCount(r.consumables?.[c.id])) p.consumables[c.id] = r.consumables[c.id]
  if (Array.isArray(r.loadout)) {
    p.loadout = p.loadout.map((_, i) => (CONSUMABLES.some(c => c.id === r.loadout[i]) ? r.loadout[i] : null))
  }
  p.loadout = fitLoadout(p.loadout, p.consumables)
  for (const k of RECORD_KEYS) if (isCount(r.records?.[k]) && r.records[k] > 0) p.records[k] = r.records[k]
  if (Array.isArray(r.rewardedRounds)) p.rewardedRounds = r.rewardedRounds.filter((x: unknown) => typeof x === 'string').slice(-MAX_REWARDED_IDS)
  return p
}

/** Reads the profile from localStorage (defaults if missing, unreadable or storage is disabled). */
export function loadProfile(): Profile {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    return text ? sanitizeProfile(JSON.parse(text)) : defaultProfile()
  } catch {
    return defaultProfile()
  }
}

/** Writes the profile to localStorage. Storage errors are ignored (progress just isn't kept). */
export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // Storage full or disabled.
  }
}

/** Removes loadout charges the player doesn't actually own enough of. */
function fitLoadout(loadout: (ConsumableId | null)[], owned: Record<ConsumableId, number>) {
  const used: Record<string, number> = {}
  return loadout.map(id => {
    if (!id) return null
    used[id] = (used[id] ?? 0) + 1
    return used[id] <= owned[id] ? id : null
  })
}

// ---------- shop operations (each returns the updated profile, or null if not allowed) ----------

/** Buys an equipment or cosmetic item if affordable and not already owned. */
export function buyItem(p: Profile, id: string): Profile | null {
  const item = EQUIPMENT.find(e => e.id === id) ?? ALL_COSMETICS.find(c => c.id === id)
  if (!item || owns(p, id) || p.coins < item.price) return null
  return { ...p, coins: p.coins - item.price, owned: [...p.owned, id] }
}

/** Equips an owned equipment item in its slot, or an owned cosmetic. */
export function equipItem(p: Profile, id: string): Profile | null {
  if (!owns(p, id)) return null
  const gear = EQUIPMENT.find(e => e.id === id)
  if (gear) return { ...p, equipment: { ...p.equipment, [gear.slot]: id } }
  const cosmetic = ALL_COSMETICS.find(c => c.id === id)!
  return { ...p, [cosmetic.kind]: id }
}

/** Buys one consumable charge. */
export function buyConsumable(p: Profile, id: ConsumableId): Profile | null {
  const item = CONSUMABLES.find(c => c.id === id)
  if (!item || p.coins < item.price) return null
  return { ...p, coins: p.coins - item.price, consumables: { ...p.consumables, [id]: p.consumables[id] + 1 } }
}

/** Puts a charge in loadout slot `slot` (or empties it with null), limited by charges owned. */
export function setLoadoutSlot(p: Profile, slot: number, id: ConsumableId | null): Profile | null {
  if (slot < 0 || slot >= MAX_CHARGES) return null
  const loadout = [...p.loadout]
  loadout[slot] = id
  const fitted = fitLoadout(loadout, p.consumables)
  if (id && fitted[slot] !== id) return null // not enough charges owned
  return { ...p, loadout: fitted }
}

// ---------- in-round consumption ----------

/**
 * Spends one charge of `id` from the stored profile, saving immediately so a
 * reload can't bring it back. Returns false if none are left.
 */
export function spendConsumable(id: ConsumableId): boolean {
  const p = loadProfile()
  if (p.consumables[id] <= 0) return false
  const consumables = { ...p.consumables, [id]: p.consumables[id] - 1 }
  // Drop one matching loadout slot so the bag never lists charges that no longer exist.
  saveProfile({ ...p, consumables, loadout: fitLoadout(p.loadout, consumables) })
  return true
}

/** Record category for a round. */
export const recordKey = (nine: number, boosted: boolean): RecordKey =>
  `${nine ? 'back' : 'front'}-${boosted ? 'boosted' : 'clean'}` as RecordKey
