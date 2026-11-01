/**
 * Heads-up display drawn over the 3D view: hole card, wind, minimap, shot
 * settings, swing meter, scorecard strip, key reminder, banners and confetti.
 *
 * The HUD re-renders every animation frame and reads the mutable game state
 * directly, so it always reflects the latest values without extra plumbing.
 */
import { useEffect, useMemo, useState } from 'react'
import { nineHoles } from '../course/holes'
import { CLUBS, PUTTER, LIE_CARRY, YD } from '../config'
import { distXZ, type GS } from '../game/game'
import { shotParams } from '../game/shot'
import { useMinimap } from './minimap'

const LIE_COL: Record<string, string> = {
  tee: '#7CFFB2', fairway: '#7CFFB2', rough: '#ffb36b', sand: '#f0e0b4', green: '#4fe36a', water: '#8fd3ff', oob: '#ff8a7a',
}

/** How long (ms) a banner stays up, unless it is waiting for Space at the end of a hole. */
const BANNER_MS = 1900
const CONFETTI_MS = 4000

/** Score relative to par as golfers write it: E, +2, -1. */
const formatToPar = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`)

/** Re-renders the calling component on every animation frame. */
function useEveryFrame() {
  const [, set] = useState(0)
  useEffect(() => {
    let r = 0
    const tick = () => { set(x => x + 1); r = requestAnimationFrame(tick) }
    r = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(r)
  }, [])
}

/** Values derived from the game state that several HUD panels share. */
function hudInfo(g: GS) {
  const h = g.hole
  const p = g.sim ? g.sim.p : g.ball
  const lie = h.lie(g.ball[0], g.ball[2])
  const toPin = distXZ(p, h.pin[0], h.pin[1]) / YD
  const elev = (h.height(h.pin[0], h.pin[1]) - g.ball[1]) / YD

  // Wind relative to the aim direction: 0 = blowing straight toward the target.
  const windAng = Math.atan2(-h.wind[0], h.wind[2]) - g.heading
  const windMph = Math.hypot(h.wind[0], h.wind[2]) / 0.447
  const headwind = -Math.cos(windAng) * windMph // positive = into the wind

  // Rule-of-thumb "plays like" distance: add elevation, and 1% per mph of headwind.
  const playsLike = toPin + elev + headwind * toPin / 100
  const carry = CLUBS[g.club].carry * g.power * (LIE_CARRY[lie] ?? 1)
  return { h, p, lie, toPin, elev, windAng, windMph, headwind, playsLike, carry, putting: g.club === PUTTER }
}
type HudInfo = ReturnType<typeof hudInfo>

/** The full HUD. */
export function Hud({ g }: { g: GS }) {
  useEveryFrame()
  const info = hudInfo(g)
  const showShotBar = g.phase !== 'intro' && g.phase !== 'holed'
  const confetti = performance.now() - g.confettiAt < CONFETTI_MS

  return <div className="hud">
    <div className="vignette" />
    <HoleCard g={g} info={info} />
    {g.feedback && <div key={'t' + g.feedbackAt} className="glass toast">{g.feedback}</div>}
    <BannerText g={g} />

    <div className="right">
      <WindCompass info={info} />
      <MinimapPanel g={g} info={info} />
    </div>

    {showShotBar && <ShotBar g={g} info={info} />}
    {g.phase === 'swing' && <SwingMeter g={g} />}
    {g.phase === 'intro' && <div className="skip">Press Space to tee off</div>}
    {g.phase === 'flight' && <div className="skip">Space to fast-forward</div>}

    <ScoreStrip g={g} />
    <KeysHint />
    {confetti && <Confetti seed={g.confettiAt} />}
  </div>
}

/** Hole number, name, par, stroke, distance to pin, plays-like distance, elevation and lie. */
function HoleCard({ g, info }: { g: GS; info: HudInfo }) {
  const { h, toPin, playsLike, elev, lie, putting } = info
  const stroke = g.strokes + (g.phase === 'holed' || g.phase === 'flight' ? 0 : 1) // the stroke about to be played
  const inFeet = toPin < 30
  return <div className="glass holecard">
    <div className="holenum">{h.def.num}</div>
    <div>
      <div className="holename">{h.def.name}</div>
      <div className="holemeta">PAR {h.def.par} · {h.def.yards} YDS · STROKE {stroke}</div>
      <div className="stats">
        <div className="stat">
          <div className="label">To pin</div>
          <div className="v">{inFeet ? (toPin * 3).toFixed(0) : toPin.toFixed(0)}<small>{inFeet ? 'ft' : 'yds'}</small></div>
        </div>
        {!putting && <div className="stat">
          <div className="label">Plays like</div>
          <div className="v">{playsLike.toFixed(0)}<small>yds</small></div>
        </div>}
        <div className="stat">
          <div className="label">Elev</div>
          <div className="v">{elev >= 0 ? '↑' : '↓'}{Math.abs(elev).toFixed(0)}<small>yds</small></div>
        </div>
        <div className="stat">
          <div className="label">Lie</div>
          <div style={{ marginTop: 4 }}>
            <span className="chip" style={{ background: LIE_COL[lie] + '33', color: LIE_COL[lie] }}>{lie}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
}

/** Big centered banner; end-of-hole banners stay until the player presses Space. */
function BannerText({ g }: { g: GS }) {
  const b = g.banner
  if (!b) return null
  const age = performance.now() - b.at
  const waitingForSpace = g.phase === 'holed' && b.sub?.includes('Space')
  if (!(age < BANNER_MS || waitingForSpace)) return null
  return <div className="banner" key={'b' + b.at} style={{ color: b.color }}>
    <div className="t">{b.text}</div>
    {b.sub && <div className="s">{b.sub}</div>}
  </div>
}

/** Compass with "AIM" at the top and an arrow showing where the wind blows, plus speed and into/helping/cross. */
function WindCompass({ info }: { info: HudInfo }) {
  const { windAng, windMph, headwind } = info
  const label = headwind > 2 ? 'Into' : headwind < -2 ? 'Helping' : 'Cross'
  return <div className="glass wind">
    <div className="label">Wind</div>
    <svg viewBox="-50 -50 100 100" width="84" height="84" style={{ display: 'block', margin: '4px auto' }}>
      <circle r="44" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) =>
        <line key={i} x1="0" y1="-44" x2="0" y2={i % 3 ? -40 : -36} stroke="rgba(255,255,255,.4)" strokeWidth="2" transform={`rotate(${i * 30})`} />)}
      <text y="-28" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,.55)">AIM</text>
      <g transform={`rotate(${windAng * 180 / Math.PI})`}>
        <path d="M0,-30 L11,6 L3,2 L3,26 L-3,26 L-3,2 L-11,6 Z" fill="#5ab0ff" style={{ filter: 'drop-shadow(0 0 6px #5ab0ff)' }} />
      </g>
    </svg>
    <div className="big" style={{ fontSize: 20 }}>{windMph.toFixed(0)} <span style={{ fontSize: 11, color: 'var(--dim)' }}>MPH</span></div>
    <div className="label" style={{ marginTop: 2 }}>{label}</div>
  </div>
}

/**
 * Top-down hole map with the ball, pin, shot trail, and (while planning a full
 * shot) a straight line out to the nominal carry distance.
 */
function MinimapPanel({ g, info }: { g: GS; info: HudInfo }) {
  const mini = useMinimap(info.h)
  const { p, h, carry } = info
  const [bx, bz] = mini.map(p[0], p[2])
  const [px, pz] = mini.map(h.pin[0], h.pin[1])
  const planning = g.phase === 'plan' || g.phase === 'swing'

  const aimLine = () => {
    const dx = -Math.sin(g.heading), dz = Math.cos(g.heading)
    const L = carry * YD
    const [ex, ez] = mini.map(g.ball[0] + dx * L, g.ball[2] + dz * L)
    return <>
      <line x1={bx} y1={bz} x2={ex} y2={ez} stroke="#ffd23f" strokeWidth="1.5" strokeDasharray="3 2" />
      <circle cx={ex} cy={ez} r="3" fill="none" stroke="#ff4d6d" strokeWidth="1.5" />
    </>
  }
  const trailPoints = () => g.trail.filter((_, i) => i % 6 === 0).map(t => mini.map(t[0], t[2]).join(',')).join(' ')

  return <div className="glass mini">
    <div style={{ position: 'relative' }}>
      <img src={mini.url} style={{ width: '100%', display: 'block', borderRadius: 10 }} />
      <svg viewBox={`0 0 ${mini.Wc} ${mini.Hc}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {planning && g.club !== PUTTER && aimLine()}
        {g.trail.length > 1 && <polyline points={trailPoints()} fill="none" stroke="#fff" strokeWidth="1" opacity=".7" />}
        <line x1={px} y1={pz} x2={px} y2={pz - 8} stroke="#fff" strokeWidth="1" />
        <path d={`M${px},${pz - 8} l5,1.5 l-5,1.5z`} fill="#ff3b3b" />
        <circle cx={bx} cy={bz} r="3.2" fill="#fff" stroke="#111" strokeWidth="1" />
      </svg>
    </div>
  </div>
}

/** Club carousel, power (or putt pace), and the draw/fade slider. */
function ShotBar({ g, info }: { g: GS; info: HudInfo }) {
  const { putting, carry } = info
  return <div className="glass shotbar">
    <div className="clubs">
      {g.club > 0 && <div className="club">{CLUBS[g.club - 1].short}</div>}
      <div className="club on">{CLUBS[g.club].short}</div>
      {g.club < PUTTER && <div className="club">{CLUBS[g.club + 1].short}</div>}
    </div>
    <PowerReadout g={g} putting={putting} carry={carry} />
    {putting
      ? <div style={{ fontSize: 12, color: 'var(--dim)', maxWidth: 160 }}>Arrows show downhill. Brighter/warmer = steeper.</div>
      : <ShapeReadout curve={g.curve} />}
  </div>
}

/** Power as a percentage and carry for full shots; putt distance in feet when putting. */
function PowerReadout({ g, putting, carry }: { g: GS; putting: boolean; carry: number }) {
  // Putt power is in meters; the bar is full at 25 m.
  const fill = putting ? Math.min(100, g.power / 25 * 100) : g.power * 100
  return <div>
    <div className="label">{putting ? 'Putt pace' : 'Power'}</div>
    <div className="big" style={{ fontSize: 26 }}>
      {putting ? `${(g.power / YD * 3).toFixed(0)} ft` : `${(g.power * 100).toFixed(0)}%`}
      <span style={{ fontSize: 12, color: 'var(--dim)', marginLeft: 8 }}>{putting ? '' : `${carry.toFixed(0)} yd carry`}</span>
    </div>
    <div className="bar" style={{ marginTop: 6 }}><div className="fill" style={{ width: `${fill}%` }} /></div>
  </div>
}

/** Draw/fade slider with a marked straight-shot center. */
function ShapeReadout({ curve }: { curve: number }) {
  const label = Math.abs(curve) < 0.02 ? 'Straight' : curve < 0 ? `Draw ${(-curve * 100).toFixed(0)}` : `Fade ${(curve * 100).toFixed(0)}`
  return <div>
    <div className="label">Shape · {label}</div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--dim)', marginTop: 8 }}>
      <span>DRAW</span><span>FADE</span>
    </div>
    <div className="bar" style={{ marginTop: 4 }}>
      <div className="mid" />
      <div className="knob" style={{ left: `${50 + curve * 50}%` }} />
    </div>
  </div>
}

/** The timing meter: a moving needle and a green perfect zone centered on the track. */
function SwingMeter({ g }: { g: GS }) {
  const zoneHalfWidth = shotParams(g).zone * 100 // in percent of the track
  return <div className="glass meter">
    <div className="track">
      <div className="zone" style={{ left: `${50 - zoneHalfWidth}%`, width: `${zoneHalfWidth * 2}%` }} />
      <div className="needle" style={{ left: `${g.meterT * 100}%` }} />
    </div>
    <div className="ends">
      <span className="label">Early · pull</span>
      <span className="label" style={{ color: '#2dff8f' }}>Perfect</span>
      <span className="label">Late · push</span>
    </div>
  </div>
}

/** Running score relative to par plus a cell per hole of the nine. */
function ScoreStrip({ g }: { g: GS }) {
  const holes = nineHoles(g.nine)
  const total = g.scores.reduce((sum, s, i) => sum + (s ? s - holes[i].par : 0), 0)
  const scoreClass = (s: number, par: number) => {
    if (!s) return ''
    const d = s - par
    return d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 1 ? 'bogey' : d >= 2 ? 'dbl' : ''
  }
  return <div className="glass score">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span className="label">{g.nine ? 'Back nine' : 'Front nine'}</span>
      <span className="big" style={{ fontSize: 20, color: total < 0 ? '#ff6b6b' : '#fff' }}>{formatToPar(total)}</span>
    </div>
    <div className="cells">
      {holes.map((hd, i) => {
        const s = g.scores[i]
        return <div key={i} className={`cell ${i === g.idx ? 'cur' : ''}`}>
          {hd.num}
          <div className={`sc ${scoreClass(s, hd.par)}`}>{s || (i === g.idx ? '·' : '')}</div>
        </div>
      })}
    </div>
  </div>
}

/** Compact controls reminder. */
function KeysHint() {
  return <div className="glass keys">
    <kbd>A</kbd><kbd>D</kbd> aim <kbd>W</kbd><kbd>S</kbd> power <kbd>Q</kbd><kbd>E</kbd> shape <kbd>R</kbd> straight<br />
    <kbd>←</kbd><kbd>→</kbd> club <kbd>Space</kbd> swing <kbd>C</kbd> cam <kbd>Tab</kbd> overhead <kbd>Esc</kbd> help
  </div>
}

/** Falling confetti pieces. `seed` (the celebration time) re-randomizes them for each celebration. */
function Confetti({ seed }: { seed: number }) {
  const bits = useMemo(() => Array.from({ length: 90 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    duration: 2 + Math.random() * 2,
    color: ['#ffd23f', '#7CFFB2', '#ff4d6d', '#5ab0ff', '#fff'][i % 5],
  })), [seed])
  return <div className="confetti">
    {bits.map((b, i) => <i key={i} style={{ left: `${b.left}%`, background: b.color, animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s` }} />)}
  </div>
}
