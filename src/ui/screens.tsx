/**
 * Menu-style overlays: the main menu (front/back nine choice), the
 * end-of-round scorecard, and the pause/help screen.
 */
import { nineHoles } from '../course/holes'
import { MAX_STROKES } from '../config'

/** Total par and yardage for a nine. */
function nineInfo(nine: number) {
  const holes = nineHoles(nine)
  return {
    par: holes.reduce((sum, h) => sum + h.par, 0),
    yds: holes.reduce((sum, h) => sum + h.yards, 0),
  }
}

/** Title panel with a button for each nine. */
export function MainMenu({ onPlay }: { onPlay: (nine: number) => void }) {
  return <div className="menu"><div className="glass panel">
    <h1 className="title">Torrey Pines<span>SOUTH COURSE</span></h1>
    <p style={{ color: 'var(--dim)', marginTop: 18 }}>Clifftop golf above the Pacific. Read the wind, shape your shot, and nail the timing.</p>
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
  </div></div>
}

/**
 * Final scorecard. Rounds quit early only count the holes played (score 0 = unplayed),
 * so the to-par total compares against those holes' par only.
 */
export function EndScreen({ nine, scores, onMenu }: { nine: number; scores: number[]; onMenu: () => void }) {
  const holes = nineHoles(nine)
  const played = scores.filter(Boolean).length
  const total = scores.reduce((sum, s) => sum + s, 0)
  const par = holes.reduce((sum, h, i) => sum + (scores[i] ? h.par : 0), 0)
  const toPar = total - par
  return <div className="overlay"><div className="glass" style={{ textAlign: 'center' }}>
    <div className="label">{nine ? 'Back nine' : 'Front nine'} · {played}/9 holes</div>
    <div className="big" style={{ fontSize: 72, lineHeight: 1.1 }}>{toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : toPar}</div>
    <div style={{ color: 'var(--dim)' }}>{total} strokes</div>
    <table className="card"><tbody>
      <tr className="label"><td>Hole</td>{holes.map(h => <td key={h.num}>{h.num}</td>)}</tr>
      <tr style={{ color: 'var(--dim)' }}><td>Par</td>{holes.map(h => <td key={h.num}>{h.par}</td>)}</tr>
      <tr className="big"><td>You</td>{scores.map((s, i) =>
        <td key={i} style={{ color: s && s < holes[i].par ? '#ff6b6b' : '#fff' }}>{s || '–'}</td>)}</tr>
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
    <kbd>C</kbd> camera · <kbd>Tab</kbd> overhead · <kbd>Esc</kbd> resume
    <h3>Simplified rules</h3>
    <div style={{ color: 'var(--dim)' }}>
      Water / out of bounds: +1 stroke, replay from the previous spot. Max {MAX_STROKES} strokes per hole.
      The red ring marks first landing — the ball will still bounce and roll.
      Course is a stylized, approximate take on Torrey Pines South.
    </div>
    <p><button className="btn" onClick={onQuit}>Quit to menu</button></p>
  </div></div>
}
