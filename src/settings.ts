/**
 * Small persistent settings stored in localStorage. Reads fall back to defaults
 * if storage is unavailable or holds an unexpected value.
 */
import { DEFAULT_DIFFICULTY, DIFFICULTIES, type Difficulty } from './config'

const DIFFICULTY_KEY = 'torrey.difficulty'

/** The last chosen AI difficulty, or the default (Pro). */
export function loadDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(DIFFICULTY_KEY)
    return DIFFICULTIES.includes(v as Difficulty) ? (v as Difficulty) : DEFAULT_DIFFICULTY
  } catch {
    return DEFAULT_DIFFICULTY
  }
}

/** Remembers the chosen AI difficulty. */
export function saveDifficulty(d: Difficulty) {
  try {
    localStorage.setItem(DIFFICULTY_KEY, d)
  } catch {
    // Storage can be disabled (e.g. private browsing); the choice just isn't remembered.
  }
}
