import { useEffect, useMemo, useState } from 'react'
import { HOLES, type Hole } from './course'
import { CLUBS, PUTTER, LIE_CARRY } from './config'
import { shotParams, dist2, YD, type GS } from './game'

const LIE_COL: Record<string, string> = { tee: '#7CFFB2', fairway: '#7CFFB2', rough: '#ffb36b', sand: '#f0e0b4', green: '#4fe36a', water: '#8fd3ff', oob: '#ff8a7a' }

function useMinimap(h: Hole) {
  return useMemo(() => {
    const xs = h.path.map(p => p[0]), zs = h.path.map(p => p[1])
    const pad = 55; const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, z0 = Math.min(...zs) - 20, z1 = Math.max(...zs) + 30
    const W = 150, H = Math.round(W * (z1 - z0) / (x1 - x0)); const Hc = Math.min(H, 300); const sc = Hc / (z1 - z0); const Wc = Math.round((x1 - x0) * sc)
    const c = document.createElement('canvas'); c.width = Wc; c.height = Hc; const ctx = c.getContext('2d')!; const img = ctx.createImageData(Wc, Hc)
    const col: Record<string, number[]> = { green: [79, 210, 90], fairway: [100, 178, 70], tee: [100, 178, 70], rough: [52, 110, 42], sand: [240, 224, 180], water: [40, 120, 160], oob: [38, 70, 40] }
    for (let j = 0; j < Hc; j++) for (let i = 0; i < Wc; i++) {
      const x = x1 - i / sc, z = z1 - j / sc; const lie = h.lie(x, z); const y = h.height(x, z)
      const cliff = h.def.ocean && h.project(x, z).lat * h.def.ocean.side > h.def.ocean.dist + 1; void y
      const cc = cliff && lie !== 'water' ? [190, 155, 115] : col[lie]
      img.data.set([cc[0], cc[1], cc[2], 255], (j * Wc + i) * 4)
    }
    ctx.putImageData(img, 0, 0)
    return { url: c.toDataURL(), Wc, Hc, map: (x: number, z: number) => [(x1 - x) * sc, (z1 - z) * sc] }
  }, [h])
}

export function Hud({ g }: { g: GS }) {
  const [, set] = useState(0)
  useEffect(() => { let r = 0; const f = () => { set(x => x + 1); r = requestAnimationFrame(f) }; r = requestAnimationFrame(f); return () => cancelAnimationFrame(r) }, [])
  const h = g.hole; const mini = useMinimap(h)
  const p = g.sim ? g.sim.p : g.ball
  const lie = h.lie(g.ball[0], g.ball[2]); const d = dist2(p, h.pin[0], h.pin[1]) / YD
  const elev = (h.height(h.pin[0], h.pin[1]) - g.ball[1]) / YD
  const total = g.scores.reduce((a, s, i) => a + (s ? s - HOLES[g.nine * 9 + i].par : 0), 0) + (g.phase !== 'holed' && g.strokes ? 0 : 0)
  const fmt = (n: number) => n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`
  const windAng = Math.atan2(-h.wind[0], h.wind[2]) - g.heading
  const ws = Math.hypot(h.wind[0], h.wind[2]) / 0.447
  const putting = g.club === PUTTER
  const headwind = -(Math.cos(windAng)) * ws
  const playsLike = d + elev + headwind * d / 100
  const carry = CLUBS[g.club].carry * g.power * (LIE_CARRY[lie] ?? 1)
  const now = performance.now()
  const bannerAge = g.banner ? now - g.banner.at : 1e9
  const showBanner = g.banner && (bannerAge < 1900 || (g.phase === 'holed' && g.banner.sub?.includes('Space')))
  const planning = g.phase === 'plan' || g.phase === 'swing'
  const [bx, bz] = mini.map(p[0], p[2]); const [px, pz] = mini.map(h.pin[0], h.pin[1])
  const confetti = now - g.confettiAt < 4000
  const confettiBits = useMemo(() => Array.from({ length: 90 }, (_, i) => ({ l: Math.random() * 100, d: Math.random() * 1.2, t: 2 + Math.random() * 2, c: ['#ffd23f', '#7CFFB2', '#ff4d6d', '#5ab0ff', '#fff'][i % 5] })), [g.confettiAt])

  return <div className="hud">
    <div className="vignette" />
    <div className="glass holecard">
      <div className="holenum">{h.def.num}</div>
      <div>
        <div className="holename">{h.def.name}</div>
        <div className="holemeta">PAR {h.def.par} · {h.def.yards} YDS · STROKE {g.strokes + (g.phase === 'holed' || g.phase === 'flight' ? 0 : 1)}</div>
        <div className="stats">
          <div className="stat"><div className="label">To pin</div><div className="v">{d < 30 ? (d * 3).toFixed(0) : d.toFixed(0)}<small>{d < 30 ? 'ft' : 'yds'}</small></div></div>
          {!putting && <div className="stat"><div className="label">Plays like</div><div className="v">{playsLike.toFixed(0)}<small>yds</small></div></div>}
          <div className="stat"><div className="label">Elev</div><div className="v">{elev >= 0 ? '↑' : '↓'}{Math.abs(elev).toFixed(0)}<small>yds</small></div></div>
          <div className="stat"><div className="label">Lie</div><div style={{ marginTop: 4 }}><span className="chip" style={{ background: LIE_COL[lie] + '33', color: LIE_COL[lie] }}>{lie}</span></div></div>
        </div>
      </div>
    </div>

    {g.feedback && <div key={"t" + g.feedbackAt} className="glass toast">{g.feedback}</div>}
    {showBanner && <div className="banner" key={"b" + g.banner!.at} style={{ color: g.banner!.color }}><div className="t">{g.banner!.text}</div>{g.banner!.sub && <div className="s">{g.banner!.sub}</div>}</div>}

    <div className="right">
      <div className="glass wind">
        <div className="label">Wind</div>
        <svg viewBox="-50 -50 100 100" width="84" height="84" style={{ display: 'block', margin: '4px auto' }}>
          <circle r="44" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
          {Array.from({ length: 12 }, (_, i) => <line key={i} x1="0" y1="-44" x2="0" y2={i % 3 ? -40 : -36} stroke="rgba(255,255,255,.4)" strokeWidth="2" transform={`rotate(${i * 30})`} />)}
          <text y="-28" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,.55)">AIM</text>
          <g transform={`rotate(${windAng * 180 / Math.PI})`}>
            <path d="M0,-30 L11,6 L3,2 L3,26 L-3,26 L-3,2 L-11,6 Z" fill="#5ab0ff" style={{ filter: 'drop-shadow(0 0 6px #5ab0ff)' }} />
          </g>
        </svg>
        <div className="big" style={{ fontSize: 20 }}>{ws.toFixed(0)} <span style={{ fontSize: 11, color: 'var(--dim)' }}>MPH</span></div>
        <div className="label" style={{ marginTop: 2 }}>{headwind > 2 ? 'Into' : headwind < -2 ? 'Helping' : 'Cross'}</div>
      </div>
      <div className="glass mini">
        <div style={{ position: 'relative' }}>
          <img src={mini.url} style={{ width: '100%', display: 'block', borderRadius: 10 }} />
          <svg viewBox={`0 0 ${mini.Wc} ${mini.Hc}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            {planning && g.club !== PUTTER && (() => { const [dx, dz] = [-Math.sin(g.heading), Math.cos(g.heading)]; const L = carry * YD; const [ex, ez] = mini.map(g.ball[0] + dx * L, g.ball[2] + dz * L); return <><line x1={bx} y1={bz} x2={ex} y2={ez} stroke="#ffd23f" strokeWidth="1.5" strokeDasharray="3 2" /><circle cx={ex} cy={ez} r="3" fill="none" stroke="#ff4d6d" strokeWidth="1.5" /></> })()}
            {g.trail.length > 1 && <polyline points={g.trail.filter((_, i) => i % 6 === 0).map(t => mini.map(t[0], t[2]).join(',')).join(' ')} fill="none" stroke="#fff" strokeWidth="1" opacity=".7" />}
            <line x1={px} y1={pz} x2={px} y2={pz - 8} stroke="#fff" strokeWidth="1" /><path d={`M${px},${pz - 8} l5,1.5 l-5,1.5z`} fill="#ff3b3b" />
            <circle cx={bx} cy={bz} r="3.2" fill="#fff" stroke="#111" strokeWidth="1" />
          </svg>
        </div>
      </div>
    </div>

    {g.phase !== 'intro' && g.phase !== 'holed' && <div className="glass shotbar">
      <div className="clubs">
        {g.club > 0 && <div className="club">{CLUBS[g.club - 1].short}</div>}
        <div className="club on">{CLUBS[g.club].short}</div>
        {g.club < PUTTER && <div className="club">{CLUBS[g.club + 1].short}</div>}
      </div>
      <div>
        <div className="label">{putting ? 'Putt pace' : 'Power'}</div>
        <div className="big" style={{ fontSize: 26 }}>{putting ? `${(g.power / YD * 3).toFixed(0)} ft` : `${(g.power * 100).toFixed(0)}%`}<span style={{ fontSize: 12, color: 'var(--dim)', marginLeft: 8 }}>{putting ? '' : `${carry.toFixed(0)} yd carry`}</span></div>
        <div className="bar" style={{ marginTop: 6 }}><div className="fill" style={{ width: `${putting ? Math.min(100, g.power / 25 * 100) : g.power * 100}%` }} /></div>
      </div>
      {!putting && <div>
        <div className="label">Shape · {Math.abs(g.curve) < 0.02 ? 'Straight' : g.curve < 0 ? `Draw ${(-g.curve * 100).toFixed(0)}` : `Fade ${(g.curve * 100).toFixed(0)}`}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--dim)', marginTop: 8 }}><span>DRAW</span><span>FADE</span></div>
        <div className="bar" style={{ marginTop: 4 }}><div className="mid" /><div className="knob" style={{ left: `${50 + g.curve * 50}%` }} /></div>
      </div>}
      {putting && <div style={{ fontSize: 12, color: 'var(--dim)', maxWidth: 160 }}>Arrows show downhill. Brighter/warmer = steeper.</div>}
    </div>}

    {g.phase === 'swing' && (() => { const s = shotParams(g); const zw = s.zone * 100; const nT = g.meterT * 100; return <div className="glass meter">
      <div className="track"><div className="zone" style={{ left: `${50 - zw}%`, width: `${zw * 2}%` }} /><div className="needle" style={{ left: `${nT}%` }} /></div>
      <div className="ends"><span className="label">Early · pull</span><span className="label" style={{ color: '#2dff8f' }}>Perfect</span><span className="label">Late · push</span></div>
    </div> })()}
    {g.phase === 'intro' && <div className="skip">Press Space to tee off</div>}
    {g.phase === 'flight' && <div className="skip">Space to fast-forward</div>}

    <div className="glass score">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span className="label">{g.nine ? 'Back nine' : 'Front nine'}</span><span className="big" style={{ fontSize: 20, color: total < 0 ? '#ff6b6b' : '#fff' }}>{fmt(total)}</span></div>
      <div className="cells">
        {HOLES.slice(g.nine * 9, g.nine * 9 + 9).map((hd, i) => { const s = g.scores[i]; const dd = s - hd.par
          const cls = !s ? '' : dd <= -2 ? 'eagle' : dd === -1 ? 'birdie' : dd === 1 ? 'bogey' : dd >= 2 ? 'dbl' : ''
          return <div key={i} className={`cell ${i === g.idx ? 'cur' : ''}`}>{hd.num}<div className={`sc ${cls}`}>{s || (i === g.idx ? '·' : '')}</div></div> })}
      </div>
    </div>
    <div className="glass keys">
      <kbd>A</kbd><kbd>D</kbd> aim <kbd>W</kbd><kbd>S</kbd> power <kbd>Q</kbd><kbd>E</kbd> shape <kbd>R</kbd> straight<br />
      <kbd>←</kbd><kbd>→</kbd> club <kbd>Space</kbd> swing <kbd>C</kbd> cam <kbd>Tab</kbd> overhead <kbd>Esc</kbd> help
    </div>
    {confetti && <div className="confetti">{confettiBits.map((b, i) => <i key={i} style={{ left: `${b.l}%`, background: b.c, animationDuration: `${b.t}s`, animationDelay: `${b.d}s` }} />)}</div>}
  </div>
}
