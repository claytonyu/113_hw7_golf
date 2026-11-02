/**
 * Saving and resuming an unfinished round in localStorage.
 *
 * The round is saved at every turn boundary: when a hole starts, when a ball
 * is struck, and when a shot comes to rest. A save made at the strike includes
 * the launched ball, so reloading mid-flight replays that same shot (the
 * physics is deterministic) instead of letting the player retake it.
 *
 * Only one unfinished round is kept. It is cleared when the round ends or is
 * abandoned. Loaded data is validated; anything malformed is discarded.
 */
import { CLUBS, CONSUMABLES, DIFFICULTIES, NO_MODS, type ClubMods, type ConsumableId, type Difficulty } from '../config'
import type { Ball, Mode } from '../sim/sim'
import type { GS, GolferState, PlayerLook, Relief } from '../game/game'

const STORAGE_KEY = 'torrey.round.v1'

/** Everything needed to rebuild a round. The hole geometry is rebuilt from `nine` and `idx`. */
export interface RoundSave {
  nine: number
  idx: number
  difficulty: Difficulty
  roundId: string
  golfers: GolferState[]
  turn: number
  honor: number
  charges: (ConsumableId | null)[]
  boosted: boolean
  look: PlayerLook
  phase: 'intro' | 'turn' | 'flight' | 'drop' | 'holed' // 'turn' = waiting for the active golfer to play
  relief?: Relief | null // only for 'drop': the penalty relief the player still has to choose
  // only for 'flight': the shot in progress
  sim: Ball | null
  shotStart: number[]
  club: number
  heading: number
  streak: number
  savedAt: number
}

/** Copies the parts of the game state worth saving. */
export function snapshot(g: GS): RoundSave {
  const flying = g.phase === 'flight' && g.sim !== null
  const phase: RoundSave['phase'] = g.phase === 'intro' || g.phase === 'holed' || g.phase === 'drop' ? g.phase : flying ? 'flight' : 'turn'
  return {
    nine: g.nine, idx: g.idx, difficulty: g.difficulty, roundId: g.roundId,
    golfers: g.golfers.map(x => ({ ...x, ball: [...x.ball], lastPos: [...x.lastPos], scores: [...x.scores], mods: x.mods.map(m => ({ ...m })) })),
    turn: g.turn, honor: g.honor, charges: [...g.charges], boosted: g.boosted, look: { ...g.look },
    phase,
    relief: g.phase === 'drop' && g.relief
      ? { title: g.relief.title, options: g.relief.options.map(o => ({ label: o.label, pos: [...o.pos] })) }
      : null,
    sim: flying ? { ...g.sim!, p: [...g.sim!.p], v: [...g.sim!.v] } : null,
    shotStart: [...g.shotStart], club: g.club, heading: g.heading, streak: g.streak,
    savedAt: Date.now(),
  }
}

/** Saves the round. Storage errors are ignored (the round just can't be resumed). */
export function saveRound(g: GS) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot(g)))
  } catch {
    // Storage full or disabled.
  }
}

/** Forgets the saved round. */
export function clearRound() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage disabled.
  }
}

/** The saved round, or null if there is none or it is invalid. */
export function loadRound(): RoundSave | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    return text ? validateRound(JSON.parse(text)) : null
  } catch {
    return null
  }
}

// ---------- validation ----------

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi
const isVec3 = (v: unknown): v is number[] => Array.isArray(v) && v.length === 3 && v.every(isNum)
const isColor = (v: unknown) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
const MODES: Mode[] = ['air', 'roll', 'rest', 'holed', 'water', 'oob']
const MOD_KEYS: (keyof ClubMods)[] = Object.keys(NO_MODS) as (keyof ClubMods)[]

function validMods(v: unknown): v is ClubMods[] {
  if (!Array.isArray(v) || v.length !== CLUBS.length) return false
  return v.every(m => m && typeof m === 'object'
    && MOD_KEYS.every(k => isNum(m[k]) && m[k] > 0 && m[k] < 3)
    && (m.roughCarry === undefined || isNum(m.roughCarry))
    && (m.sandCarry === undefined || isNum(m.sandCarry)))
}

function validGolfer(v: any): v is GolferState {
  return v && typeof v === 'object' && typeof v.name === 'string' && typeof v.isAI === 'boolean'
    && isVec3(v.ball) && isVec3(v.lastPos) && isInt(v.strokes, 0, 99) && typeof v.holed === 'boolean'
    && Array.isArray(v.scores) && v.scores.length === 9 && v.scores.every((s: unknown) => isInt(s, 0, 99))
    && validMods(v.mods)
}

function validRelief(v: any): v is Relief {
  return v && typeof v === 'object' && typeof v.title === 'string' && Array.isArray(v.options)
    && v.options.length >= 1 && v.options.length <= 3
    && v.options.every((o: any) => o && typeof o.label === 'string' && isVec3(o.pos))
}

function validBall(v: any): v is Ball {
  return v && typeof v === 'object' && isVec3(v.p) && isVec3(v.v) && MODES.includes(v.mode)
    && [v.t, v.curve, v.v0, v.spin, v.spin0].every(isNum) && isInt(v.contacts, 0, 1e6)
}

/** Returns the save if every field has the expected shape, otherwise null. */
export function validateRound(raw: any): RoundSave | null {
  if (!raw || typeof raw !== 'object') return null
  const ok = isInt(raw.nine, 0, 1) && isInt(raw.idx, 0, 8) && DIFFICULTIES.includes(raw.difficulty)
    && typeof raw.roundId === 'string' && raw.roundId.length > 0
    && Array.isArray(raw.golfers) && raw.golfers.length === 2 && raw.golfers.every(validGolfer)
    && raw.golfers[0].isAI === false && raw.golfers[1].isAI === true
    && isInt(raw.turn, 0, 1) && isInt(raw.honor, 0, 1)
    && Array.isArray(raw.charges) && raw.charges.length === 3
    && raw.charges.every((c: unknown) => c === null || CONSUMABLES.some(x => x.id === c))
    && typeof raw.boosted === 'boolean'
    && raw.look && ['ball', 'shaft', 'head', 'shirt', 'pants', 'cap'].every(k => isColor(raw.look[k]))
    && ['intro', 'turn', 'flight', 'drop', 'holed'].includes(raw.phase)
    && (raw.phase !== 'drop' || validRelief(raw.relief))
    && (raw.phase !== 'flight' || validBall(raw.sim))
    && isVec3(raw.shotStart) && isInt(raw.club, 0, CLUBS.length - 1) && isNum(raw.heading)
    && isInt(raw.streak, 0, 1e6) && isNum(raw.savedAt)
  return ok ? (raw as RoundSave) : null
}
