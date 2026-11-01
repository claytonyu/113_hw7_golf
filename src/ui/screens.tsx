/**
 * Menu-style overlays: the main menu (difficulty and front/back nine choice),
 * the end-of-round scorecard, and the pause/help screen.
 */
import { nineHoles } from '../course/holes'
import { AI_LABEL, AI_LEVELS, AI_NAME, AI_SHORT, DIFFICULTIES, MAX_STROKES, type Difficulty } from '../config'
import type { RoundResult } from '../game/game'

/** Total par and yardage for a nine. */
function nineInfo(nine: number) {
  const holes = nineHoles(nine)
  return {
    par: holes.reduce((sum, h) => sum + h.par, 0),
    yds: holes.reduce((sum, h) => sum + h.yards, 0),
  }
}

/** One-line description of each AI difficulty for the menu. */
const DIFFICULTY_BLURB: Record<Difficulty, string> = {
  amateur: 'Misreads wind, rarely lays up, mistimes often.',
  pro: 'Solid plans and steady timing. A fair fight.',
  tiger: 'Shapes shots, plays the percentages, rarely misses.',
}

/** Title panel with the AI difficulty choice and a button for each nine. */
export function MainMenu({ difficulty, onDifficulty, onPlay }: {
  difficulty: Difficulty
  onDifficulty: (d: Difficulty) => void
  onPlay: (nine: number) => void
}) {
  return <div className="menu"><div className="glass panel">
    <h1 className="title">Torrey Pines<span>SOUTH COURSE</span></h1>
    <p style={{ color: 'var(--dim)', marginTop: 18 }}>Clifftop golf above the Pacific. Read the wind, shape your shot, and nail the timing.</p>

    <div className="label" style={{ marginTop: 22 }}>Opponent · {AI_LABEL}</div>
    <div className="difficulties">
      {DIFFICULTIES.map(d =>
        <button key={d} className={`diff ${d === difficulty ? 'on' : ''}`} onClick={() => onDifficulty(d)}>{AI_LEVELS[d].label}</button>)}
    </div>
    <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 6 }}>{DIFFICULTY_BLURB[difficulty]}</div>

    <div className="nines">
      {[0, 1].map(n => {
        const info = nineInfo(n)
        return <button key={n} className="nine" onClick={() => onPlay(n)}>
          <span className="label">{n ? 'Holes 10–18' : 'Holes 1–9'}</span>
          <b>{n ? 'Back Nine' : 'Front Nine'}</b>
          <small>Par {info.par} · {info.yds.toLocaleString()} yds</small>
        </button>
      })}
    </div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 2 }}>
      <kbd>A</kbd><kbd>D</kbd> aim <kbd>W</kbd><kbd>S</kbd> power <kbd>Q</kbd><kbd>E</kbd> shape <kbd>←</kbd><kbd>→</kbd> club <kbd>Space</kbd> swing
    </div>
    <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 8 }}>
      {AI_NAME} here is an unofficial, game-simulated opponent. No affiliation or endorsement is implied.
    </div>
  </div></div>
}

/** Strokes over a set of holes, and the matching par. */
function totals(scores: number[], pars: number[], holes: number[]) {
  return {
    strokes: holes.reduce((sum, i) => sum + scores[i], 0),
    par: holes.reduce((sum, i) => sum + pars[i], 0),
  }
}

const formatToPar = (d: number) => (d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`)

/**
 * Final scorecard for both golfers. Rounds quit early only count holes both
 * golfers finished (score 0 = unplayed), so the match compares like with like.
 */
export function EndScreen({ result, onMenu }: { result: RoundResult; onMenu: () => void }) {
  const holes = nineHoles(result.nine)
  const pars = holes.map(h => h.par)
  const counted = holes.map((_, i) => i).filter(i => result.you[i] && result.opponent[i])
  const you = totals(result.you, pars, counted)
  const ai = totals(result.opponent, pars, counted)
  const margin = ai.strokes - you.strokes

  const verdict = counted.length === 0 ? 'No holes completed'
    : margin > 0 ? `You beat ${AI_SHORT} by ${margin}`
    : margin < 0 ? `${AI_SHORT} wins by ${-margin}`
    : 'All square'
  const scoreCell = (s: number, i: number) =>
    <td key={i} style={{ color: s && s < pars[i] ? '#ff6b6b' : '#fff' }}>{s || '–'}</td>

  return <div className="overlay"><div className="glass" style={{ textAlign: 'center' }}>
    <div className="label">
      {result.nine ? 'Back nine' : 'Front nine'} · {counted.length}/9 holes · vs {AI_NAME} ({AI_LEVELS[result.difficulty].label})
    </div>
    <div className="big" style={{ fontSize: 52, lineHeight: 1.15, color: margin > 0 ? '#7CFFB2' : margin < 0 ? '#ff8a8a' : '#fff' }}>{verdict}</div>
    <div style={{ color: 'var(--dim)' }}>
      You {you.strokes} ({formatToPar(you.strokes - you.par)}) · {AI_SHORT} {ai.strokes} ({formatToPar(ai.strokes - ai.par)})
    </div>
    <table className="card"><tbody>
      <tr className="label"><td>Hole</td>{holes.map(h => <td key={h.num}>{h.num}</td>)}</tr>
      <tr style={{ color: 'var(--dim)' }}><td>Par</td>{holes.map(h => <td key={h.num}>{h.par}</td>)}</tr>
      <tr className="big"><td>You</td>{result.you.map(scoreCell)}</tr>
      <tr className="big"><td style={{ color: '#ff8a8a' }}>{AI_SHORT}</td>{result.opponent.map(scoreCell)}</tr>
    </tbody></table>
    <button className="btn" onClick={onMenu}>Main menu</button>
  </div></div>
}

/** Controls and simplified rules, with a button to quit the round. */
export function PauseOverlay({ onQuit }: { onQuit: () => void }) {
  return <div className="overlay"><div className="glass">
    <h2 style={{ marginTop: 0 }}>Paused</h2>
    <kbd>A</kbd>/<kbd>D</kbd> aim (hold Shift for fine) · <kbd>W</kbd>/<kbd>S</kbd> power or putt pace · <kbd>Q</kbd>/<kbd>E</kbd> draw / fade · <kbd>R</kbd> straight<br />
    <kbd>←</kbd>/<kbd>→</kbd> club · <kbd>Space</kbd> start swing, <kbd>Space</kbd> again in the green zone · <kbd>Space</kbd> in flight fast-forwards<br />
    <kbd>Space</kbd> during {AI_SHORT}'s turn skips his shot (same result) · <kbd>C</kbd> camera · <kbd>Tab</kbd> overhead · <kbd>Esc</kbd> resume
    <h3>Simplified rules</h3>
    <div style={{ color: 'var(--dim)' }}>
      Water / out of bounds: +1 stroke, replay from the previous spot. Max {MAX_STROKES} strokes per hole.
      The red ring marks first landing — the ball will still bounce and roll.
      Course is a stylized, approximate take on Torrey Pines South.
    </div>
    <h3>Playing {AI_NAME}</h3>
    <div style={{ color: 'var(--dim)' }}>
      Total-strokes match against an unofficial, game-simulated AI opponent. The lower score on the previous hole
      has the honor on the tee; after that, whoever is farther from the hole plays first. His shots use the same swing
      meter and ball physics as yours. His ball is marked red on the course and the minimap.
    </div>
    <p><button className="btn" onClick={onQuit}>Quit to menu</button></p>
  </div></div>
}
