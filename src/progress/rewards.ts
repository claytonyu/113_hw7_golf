/**
 * Currency rewards and personal records.
 *
 * Rules (amounts in REWARDS, config.ts):
 * - Hole rewards are paid the moment the player holes out: par, birdie, eagle
 *   or better, plus a hole-in-one bonus. They are kept even if the round is quit.
 * - Round bonuses are paid when all nine holes are complete: a guaranteed
 *   completion reward, a new personal record (separate records with and
 *   without consumables), and beating the AI (scaled by difficulty).
 * Coins are only ever added. Each payout has an id ("<round>#h<hole>" for
 * holes, "<round>" for the round bonuses) that can pay at most once, so
 * reloading or re-submitting a round can't earn twice.
 */
import { AI_LEVELS, AI_SHORT, REWARDS } from '../config'
import { nineHoles } from '../course/holes'
import type { RoundResult } from '../game/game'
import { loadProfile, recordKey, saveProfile, type Profile } from './profile'

export interface RewardLine { label: string; coins: number }

export interface RoundRewards {
  lines: RewardLine[]      // round bonuses paid now
  total: number            // sum of `lines`
  holeLines: RewardLine[]  // hole rewards already paid during the round (for the summary)
  holeTotal: number
  newRecord: boolean
  previousRecord: number | null
  strokes: number
  alreadyPaid: boolean     // the round bonuses for this round id were already paid
}

/** How many payout ids to remember (9 holes + 1 round bonus per round). */
const MAX_PAYOUT_IDS = 500

/** Payout id for one hole of a round. */
const holePayoutId = (roundId: string, idx: number) => `${roundId}#h${idx}`

/** Coins for one hole: its score relative to par (bogey or worse earns nothing) and a hole-in-one bonus. */
export function holeRewardLines(strokes: number, par: number): RewardLine[] {
  const lines: RewardLine[] = []
  const toPar = strokes - par
  if (toPar === 0) lines.push({ label: 'Par', coins: REWARDS.holeScore.par })
  else if (toPar === -1) lines.push({ label: 'Birdie', coins: REWARDS.holeScore.birdie })
  else if (toPar === -2) lines.push({ label: 'Eagle', coins: REWARDS.holeScore.eagle })
  else if (toPar <= -3) lines.push({ label: 'Albatross or better', coins: REWARDS.holeScore.albatross })
  if (strokes === 1) lines.push({ label: 'Hole-in-one bonus', coins: REWARDS.holeInOne })
  return lines
}

/** Adds a payout id to the remembered list. */
const remember = (p: Profile, id: string) => [...p.rewardedRounds, id].slice(-MAX_PAYOUT_IDS)

/**
 * Pays the player's reward for hole `idx` of round `roundId` into the saved profile.
 * Returns the lines paid and the new balance, or null if nothing was paid
 * (no reward for this score, or this hole was already paid).
 */
export function payHole(roundId: string, idx: number, strokes: number, par: number) {
  const lines = holeRewardLines(strokes, par)
  const id = holePayoutId(roundId, idx)
  const p = loadProfile()
  if (lines.length === 0 || p.rewardedRounds.includes(id)) return null
  const total = lines.reduce((a, l) => a + l.coins, 0)
  const next = { ...p, coins: p.coins + total, rewardedRounds: remember(p, id) }
  saveProfile(next)
  return { lines, total, balance: next.coins }
}

/** Hole rewards for the whole round, grouped by result ("Birdie ×2"), for the end-of-round summary. */
function summarizeHoles(result: RoundResult): RewardLine[] {
  const holes = nineHoles(result.nine)
  const groups = new Map<string, { coins: number; n: number }>()
  result.you.forEach((s, i) => {
    if (!s) return
    for (const line of holeRewardLines(s, holes[i].par)) {
      const c = groups.get(line.label) ?? { coins: 0, n: 0 }
      groups.set(line.label, { coins: c.coins + line.coins, n: c.n + 1 })
    }
  })
  return [...groups].map(([label, { coins, n }]) => ({ label: n > 1 ? `${label} ×${n}` : label, coins }))
}

/** Works out the round bonuses (and the hole summary) for a round, without changing the profile. */
export function computeRewards(profile: Profile, result: RoundResult): RoundRewards {
  const strokes = result.you.reduce((a, b) => a + b, 0)
  const previousRecord = profile.records[recordKey(result.nine, result.boosted)] ?? null
  const holeLines = summarizeHoles(result)
  const base: RoundRewards = {
    lines: [], total: 0, holeLines, holeTotal: holeLines.reduce((a, l) => a + l.coins, 0),
    newRecord: false, previousRecord, strokes, alreadyPaid: false,
  }
  if (!result.completed) return base
  if (profile.rewardedRounds.includes(result.id)) return { ...base, alreadyPaid: true }

  const lines: RewardLine[] = [{ label: 'Round completed', coins: REWARDS.roundComplete }]
  const newRecord = previousRecord === null || strokes < previousRecord
  if (newRecord) lines.push({ label: 'New personal record', coins: REWARDS.personalRecord })
  const aiStrokes = result.opponent.reduce((a, b) => a + b, 0)
  if (strokes < aiStrokes) lines.push({ label: `Beat ${AI_SHORT} (${AI_LEVELS[result.difficulty].label})`, coins: REWARDS.beatAi[result.difficulty] })

  return { ...base, lines, total: lines.reduce((a, l) => a + l.coins, 0), newRecord }
}

/** Applies the round bonuses: adds coins, updates the record, and remembers the round id. */
export function applyRewards(profile: Profile, result: RoundResult, rewards: RoundRewards): Profile {
  if (!result.completed || rewards.alreadyPaid) return profile
  const key = recordKey(result.nine, result.boosted)
  return {
    ...profile,
    coins: profile.coins + rewards.total,
    records: rewards.newRecord ? { ...profile.records, [key]: rewards.strokes } : profile.records,
    rewardedRounds: remember(profile, result.id),
  }
}
