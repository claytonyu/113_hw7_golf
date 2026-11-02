/**
 * Heads-up display drawn over the 3D view: hole card, AI opponent panel, wind,
 * coin balance and coin popups, minimap, shot settings, consumable slots, swing meter, scorecard for both
 * golfers, key reminder, banners and confetti.
 *
 * The HUD re-renders every animation frame and reads the mutable game state
 * directly, so it always reflects the latest values without extra plumbing.
 */
import { useEffect, useMemo, useState } from 'react'
import { nineHoles } from '../course/holes'
import { AI_LABEL, AI_LEVELS, AI_SHORT, CLUBS, CONSUMABLES, PUTTER, YD } from '../config'
import { distXZ, opponent, player, OPPONENT, PLAYER, type GS, type GolferState } from '../game/game'
import { lieCarry, shotMods, shotParams } from '../game/shot'
import { armedBoost } from '../game/boosts'
import { useMinimap } from './minimap'
import { CoinCounter, CoinPopups, POPUP_MS } from './coins'

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

/** Formats a distance in yards, switching to feet inside 30 yards: [value, unit]. */
const yardsOrFeet = (yds: number): [string, string] => (yds < 30 ? [(yds * 3).toFixed(0), 'ft'] : [yds.toFixed(0), 'yds'])

/** Golfer `i`'s ball: the simulated ball while it is their shot in flight, otherwise where it rests. */
const ballOf = (g: GS, i: number) => (g.sim && g.turn === i ? g.sim.p : g.golfers[i].ball)

/** Is golfer `i` playing right now (lining up, swinging or ball in flight)? */
const isPlaying = (g: GS, i: number) => g.turn === i && (g.phase === 'plan' || g.phase === 'swing' || g.phase === 'ai' || g.phase === 'flight')

/** Values about the player's ball and shot that several HUD panels share. */
function hudInfo(g: GS) {
  const h = g.hole
  const you = player(g)
  const p = ballOf(g, PLAYER)
  const lie = h.lie(you.ball[0], you.ball[2])
  const toPin = distXZ(p, h.pin[0], h.pin[1]) / YD
  const elev = (h.height(h.pin[0], h.pin[1]) - you.ball[1]) / YD

  // Wind relative to the aim direction: 0 = blowing straight toward the target.
  const windAng = Math.atan2(-h.wind[0], h.wind[2]) - g.heading
  const windMph = Math.hypot(h.wind[0], h.wind[2]) / 0.447
  const headwind = -Math.cos(windAng) * windMph // positive = into the wind

  // Rule-of-thumb "plays like" distance: add elevation, and 1% per mph of headwind.
  const playsLike = toPin + elev + headwind * toPin / 100
  // Intended carry in yards, including equipment, lie and an armed Power Boost.
  const mods = shotMods(g, armedBoost(g))
  const carry = CLUBS[g.club].carry * g.power * lieCarry(lie, g.club, mods) * mods.carry
  return { h, p, lie, toPin, elev, windAng, windMph, headwind, playsLike, carry, putting: g.club === PUTTER }
}
type HudInfo = ReturnType<typeof hudInfo>

/** The full HUD. */
export function Hud({ g }: { g: GS }) {
  useEveryFrame()
  const info = hudInfo(g)
  const showShotBar = isPlaying(g, PLAYER) && g.phase !== 'ai'
  const aiPlaying = isPlaying(g, OPPONENT)
  const confetti = performance.now() - g.confettiAt < CONFETTI_MS

  return <div className="hud">
    <div className="vignette" />
    <div className="left">
      <HoleCard g={g} info={info} />
      <OpponentPanel g={g} />
    </div>
    {g.feedback && <div key={'t' + g.feedbackAt} className="glass toast">{g.feedback}</div>}
    <BannerText g={g} />

    <div className="right">
      <CoinCounter coins={g.coins} />
      <WindCompass info={info} />
      <MinimapPanel g={g} info={info} />
    </div>

    {showShotBar && <ShotBar g={g} info={info} />}
    {showShotBar && <BoostSlots g={g} />}
    {g.phase === 'swing' && <SwingMeter g={g} />}
    {g.phase === 'intro' && <div className="skip">Press Space to tee off</div>}
    {g.phase === 'flight' && !aiPlaying && <div className="skip">Space to fast-forward</div>}
    {aiPlaying && <div className="skip">Space to skip {AI_SHORT}'s shot</div>}

    <ScoreStrip g={g} />
    <KeysHint />
    <HudCoinPopups g={g} />
    {confetti && <Confetti seed={g.confettiAt} />}
  </div>
}

/** Hole number, name, par, stroke, distance to pin, plays-like distance, elevation and lie. */
function HoleCard({ g, info }: { g: GS; info: HudInfo }) {
  const { h, toPin, playsLike, elev, lie, putting } = info
  const you = player(g)
  const done = you.holed || g.phase === 'holed' || (g.phase === 'flight' && g.turn === PLAYER)
  const stroke = you.strokes + (done ? 0 : 1) // the stroke about to be played
  const [pinValue, pinUnit] = yardsOrFeet(toPin)
  return <div className="glass holecard">
    <div className="holenum">{h.def.num}</div>
    <div>
      <div className="holename">{h.def.name}</div>
      <div className="holemeta">PAR {h.def.par} · {h.def.yards} YDS · STROKE {stroke}</div>
      <div className="stats">
        <div className="stat">
          <div className="label">To pin</div>
          <div className="v">{pinValue}<small>{pinUnit}</small></div>
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
  const ai = opponent(g)
  const aiVisible = !ai.holed && (ai.strokes > 0 || g.turn === OPPONENT)
  const aiPos = ballOf(g, OPPONENT)
  const [ax, az] = mini.map(aiPos[0], aiPos[2])
  const youBall = player(g).ball

  const aimLine = () => {
    const dx = -Math.sin(g.heading), dz = Math.cos(g.heading)
    const L = carry * YD
    const [ex, ez] = mini.map(youBall[0] + dx * L, youBall[2] + dz * L)
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
        {planning && g.turn === PLAYER && g.club !== PUTTER && aimLine()}
        {g.trail.length > 1 && <polyline points={trailPoints()} fill="none" stroke="#fff" strokeWidth="1" opacity=".7" />}
        <line x1={px} y1={pz} x2={px} y2={pz - 8} stroke="#fff" strokeWidth="1" />
        <path d={`M${px},${pz - 8} l5,1.5 l-5,1.5z`} fill="#ff3b3b" />
        {aiVisible && <circle cx={ax} cy={az} r="3.2" fill="#ff3b3b" stroke="#111" strokeWidth="1" />}
        {!player(g).holed && <circle cx={bx} cy={bz} r="3.2" fill="#fff" stroke="#111" strokeWidth="1" />}
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
  const boost = armedBoost(g)
  const item = boost && CONSUMABLES.find(c => c.id === boost)
  return <div className="glass meter">
    {item && <div className="label" style={{ color: item.color, textAlign: 'center', marginBottom: 6 }}>{item.name} active</div>}
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

/** Total strokes over the holes both golfers have finished, and the match status text. */
function matchStatus(g: GS) {
  const [you, ai] = [player(g), opponent(g)]
  let diff = 0
  you.scores.forEach((s, i) => { if (s && ai.scores[i]) diff += s - ai.scores[i] })
  if (diff === 0) return 'All square'
  return diff < 0 ? `You lead by ${-diff}` : `${AI_SHORT} leads by ${diff}`
}

/** Score relative to par over the holes this golfer has finished. */
function toParTotal(g: GS, golfer: GolferState) {
  const holes = nineHoles(g.nine)
  return golfer.scores.reduce((sum, s, i) => sum + (s ? s - holes[i].par : 0), 0)
}

/** CSS class that marks birdies, eagles and bogeys on the scorecard. */
function scoreClass(s: number, par: number) {
  if (!s) return ''
  const d = s - par
  return d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 1 ? 'bogey' : d >= 2 ? 'dbl' : ''
}

/** Scorecard for both golfers: a row each with per-hole strokes and the total to par, plus the match status. */
function ScoreStrip({ g }: { g: GS }) {
  const holes = nineHoles(g.nine)
  return <div className="glass score">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span className="label">{g.nine ? 'Back nine' : 'Front nine'} · Total strokes</span>
      <span className="label" style={{ color: 'var(--ink)' }}>{matchStatus(g)}</span>
    </div>
    <div className="scorerow">
      <div className="who" />
      <div className="cells">{holes.map((hd, i) => <div key={i} className={`cell ${i === g.idx ? 'cur' : ''}`}>{hd.num}</div>)}</div>
      <div className="tot" />
    </div>
    {g.golfers.map((golfer, gi) => {
      const total = toParTotal(g, golfer)
      return <div key={gi} className="scorerow">
        <div className="who" style={{ color: gi === OPPONENT ? '#ff8a8a' : 'var(--ink)' }}>{golfer.isAI ? AI_SHORT : 'You'}</div>
        <div className="cells">
          {holes.map((hd, i) => {
            const s = golfer.scores[i]
            return <div key={i} className={`cell ${i === g.idx ? 'cur' : ''}`}>
              <div className={`sc ${scoreClass(s, hd.par)}`}>{s || (i === g.idx ? '·' : '')}</div>
            </div>
          })}
        </div>
        <div className="tot big" style={{ color: total < 0 ? '#ff6b6b' : '#fff' }}>{formatToPar(total)}</div>
      </div>
    })}
  </div>
}

/** What the AI is doing now, for the opponent panel. */
function opponentStatus(g: GS): string {
  const ai = opponent(g)
  if (ai.holed) return `Finished · ${ai.scores[g.idx]} strokes`
  if (g.turn === OPPONENT && g.phase === 'ai') return g.ai?.plan ? `Lining up · ${CLUBS[g.club].name}` : 'Reading the shot…'
  if (g.turn === OPPONENT && g.phase === 'flight') return 'Ball in the air'
  if (ai.strokes === 0) return 'On the tee'
  return 'Waiting'
}

/** The AI opponent: name, difficulty, score, and where its ball is. */
function OpponentPanel({ g }: { g: GS }) {
  const ai = opponent(g)
  const h = g.hole
  const p = ballOf(g, OPPONENT)
  const lie = h.lie(p[0], p[2])
  const [value, unit] = yardsOrFeet(distXZ(p, h.pin[0], h.pin[1]) / YD)
  const total = toParTotal(g, ai)
  const active = isPlaying(g, OPPONENT)
  return <div className={`glass opponent ${active ? 'on' : ''}`}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
      <div className="label" style={{ color: '#ff8a8a' }}>{AI_LABEL}</div>
      <span className="chip" style={{ background: '#ff3b3b33', color: '#ff8a8a' }}>{AI_LEVELS[g.difficulty].label}</span>
    </div>
    <div className="stats">
      <div className="stat"><div className="label">Total</div><div className="v">{formatToPar(total)}</div></div>
      <div className="stat"><div className="label">Stroke</div><div className="v">{ai.strokes}</div></div>
      {!ai.holed && <div className="stat"><div className="label">To pin</div><div className="v">{value}<small>{unit}</small></div></div>}
      {!ai.holed && ai.strokes > 0 && <div className="stat">
        <div className="label">Lie</div>
        <div style={{ marginTop: 4 }}><span className="chip" style={{ background: LIE_COL[lie] + '33', color: LIE_COL[lie] }}>{lie}</span></div>
      </div>}
    </div>
    <div className="holemeta" style={{ marginTop: 6 }}>{opponentStatus(g)}</div>
  </div>
}

/** The player's three consumable slots (keys 1-3), with the armed one highlighted. */
function BoostSlots({ g }: { g: GS }) {
  return <div className="glass boosts">
    <div className="label">Boosts{g.boosted ? ' · round boosted' : ''}</div>
    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
      {g.charges.map((id, i) => {
        const item = id ? CONSUMABLES.find(c => c.id === id)! : null
        const armed = g.boostSlot === i && g.turn === PLAYER
        return <div key={i} className={`slot ${armed ? 'on' : ''} ${item ? '' : 'empty'}`} style={item ? { borderColor: item.color, color: item.color } : undefined}>
          <kbd>{i + 1}</kbd> {item ? item.name : '—'}
        </div>
      })}
    </div>
  </div>
}

/** Popups for coins earned during the round, staggered when several arrive at once. */
function HudCoinPopups({ g }: { g: GS }) {
  const now = performance.now()
  const items = g.coinPopups
    .map((p, i) => ({ ...p, id: `${p.at}-${i}`, delay: (i - g.coinPopups.findIndex(q => q.at === p.at)) * 350 }))
    .filter(p => now - p.at < POPUP_MS + p.delay)
  return <CoinPopups items={items} />
}

/** Compact controls reminder. */
function KeysHint() {
  return <div className="glass keys">
    <kbd>A</kbd><kbd>D</kbd> aim <kbd>W</kbd><kbd>S</kbd> power <kbd>Q</kbd><kbd>E</kbd> shape <kbd>R</kbd> straight<br />
    <kbd>←</kbd><kbd>→</kbd> club <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> boost <kbd>Space</kbd> swing<br />
    <kbd>C</kbd> cam <kbd>Tab</kbd> overhead <kbd>Esc</kbd> help
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
