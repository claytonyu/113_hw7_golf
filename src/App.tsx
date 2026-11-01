import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HOLES, buildHole, dirOf, type Hole } from './course'
import { CLUBS, PUTTER, METER, MAX_STROKES } from './config'
import { step, DT } from './sim'
import { newGame, startHole, preview, strike, finishShot, onContact, dist2, INTRO, type GS } from './game'
import { Atmosphere, Ocean, Terrain, Trees, Flag, TeeMarkers, SlopeGrid, Golfer, Trail, Particles } from './scene'
import { Hud } from './hud'
import { sfx, unlockAudio } from './sound'

function pathPoint(h: Hole, f: number): [number, number] {
  const segs = h.path.slice(1).map((b, i) => [h.path[i], b, Math.hypot(b[0] - h.path[i][0], b[1] - h.path[i][1])] as const)
  let s = Math.max(0, Math.min(1, f)) * segs.reduce((a, x) => a + x[2], 0)
  for (const [a, b, l] of segs) { if (s <= l) return [a[0] + (b[0] - a[0]) * s / l, a[1] + (b[1] - a[1]) * s / l]; s -= l }
  return h.green
}

function PreviewLine({ pts, color }: { pts: THREE.Vector3[]; color: string }) {
  const line = useMemo(() => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color, dashSize: 1.2, gapSize: 0.7, transparent: true, opacity: 0.95 })); l.computeLineDistances(); return l }, [pts, color])
  return <primitive object={line} />
}
function LandingMarker({ pos, heading, w, l }: { pos: number[]; heading: number; w: number; l: number }) {
  const ring = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => { const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.12; ring.current.scale.set(s, s, 1) })
  return <group position={[pos[0], pos[1] + 0.1, pos[2]]} rotation={[-Math.PI / 2, 0, -heading]}>
    <mesh scale={[w, l, 1]}><circleGeometry args={[1, 40]} /><meshBasicMaterial color="#ffd23f" transparent opacity={0.22} depthWrite={false} /></mesh>
    <mesh scale={[w, l, 1]}><ringGeometry args={[0.96, 1, 48]} /><meshBasicMaterial color="#ffd23f" transparent opacity={0.6} depthWrite={false} /></mesh>
    <mesh ref={ring}><ringGeometry args={[0.8, 1.15, 32]} /><meshBasicMaterial color="#ff4d6d" /></mesh>
    <mesh><circleGeometry args={[0.25, 16]} /><meshBasicMaterial color="#ff4d6d" /></mesh>
  </group>
}

function World({ g, pv }: { g: GS; pv: ReturnType<typeof preview> | null }) {
  const ball = useRef<THREE.Mesh>(null!); const { camera } = useThree()
  const camPos = useRef(new THREE.Vector3(0, 30, -60)); const look = useRef(new THREE.Vector3(0, 0, 100))
  useFrame(({ clock }, dt) => {
    dt = Math.min(dt, 0.05); const h = g.hole
    if (g.phase === 'intro') { g.introT += dt; if (g.introT >= INTRO) g.phase = 'plan' }
    if (g.phase === 'swing' && g.meterOn) {
      g.meterT += dt / (g.club === PUTTER ? METER.puttPeriod : METER.period)
      if (g.meterT >= 1) strike(g, 1)
    }
    if (g.phase === 'flight' && g.sim) {
      g.acc += dt * (g.fast ? 5 : 1); let n = 0
      while (g.acc >= DT && n < 200) {
        step(g.sim, h, h.wind); g.acc -= DT; n++
        if (g.sim.contacts > g.lastContacts || g.sim.mode === 'water') { g.lastContacts = g.sim.contacts; onContact(g, g.sim) }
        if (n % 2 === 0 && (g.sim.mode === 'air' || g.sim.mode === 'roll')) g.trail.push([...g.sim.p])
        if (g.sim.mode !== 'air' && g.sim.mode !== 'roll') break
      }
      if (g.sim.mode !== 'air' && g.sim.mode !== 'roll') finishShot(g)
    }
    const p = g.phase === 'flight' && g.sim ? g.sim.p : g.ball
    ball.current.position.set(p[0], p[1] + 0.05, p[2])
    ball.current.visible = g.phase !== 'holed'
    ball.current.scale.setScalar(Math.max(1, camera.position.distanceTo(ball.current.position) / 22))

    // ----- cameras -----
    const [dx, dz] = dirOf(g.heading); const tgt = new THREE.Vector3(); const lk = new THREE.Vector3()
    const putting = g.club === PUTTER; let speed = 5
    if (g.phase === 'intro') {
      const s = g.introT / INTRO; const a = pathPoint(h, s * 0.85 - 0.08), b = pathPoint(h, s * 0.85 + 0.2)
      tgt.set(a[0], 45 - s * 10 + h.def.elev * s, a[1]); lk.set(b[0], h.def.elev * s, b[1]); speed = 2.5
    } else if (g.phase === 'holed') {
      const t = clock.elapsedTime * 0.35; const y = h.height(h.pin[0], h.pin[1])
      tgt.set(h.pin[0] + Math.cos(t) * 6, y + 2.5, h.pin[1] + Math.sin(t) * 6); lk.set(h.pin[0], y + 0.3, h.pin[1]); speed = 2
    } else if (g.overhead) {
      const mx = (p[0] + h.pin[0]) / 2, mz = (p[2] + h.pin[1]) / 2; const d = dist2(p, h.pin[0], h.pin[1])
      tgt.set(mx + 0.01, Math.max(50, d * 1.05) + p[1], mz - d * 0.2); lk.set(mx, p[1], mz)
    } else if (g.phase === 'flight' && g.sim) {
      const v = g.sim.v; const hs = Math.hypot(v[0], v[2]) || 1
      const tv = g.contact && !putting && g.contactT > 1.8 && g.sim.t > g.contactT * 0.55
      if (tv) { // TV landing camera: beside the landing area, looking back at the ball
        const c = g.contact!; const sx = g.shotStart[0] - c[0], sz = g.shotStart[2] - c[2]; const sl = Math.hypot(sx, sz) || 1
        tgt.set(c[0] + sx / sl * 16 + (-sz / sl) * 14, c[1] + 4, c[2] + sz / sl * 16 + (sx / sl) * 14); lk.set(p[0], p[1], p[2]); speed = 2.2
      } else {
        const back = putting ? 3.5 : g.sim.mode === 'roll' ? 12 : 14
        tgt.set(p[0] - v[0] / hs * back, p[1] + (putting ? 1.4 : 4), p[2] - v[2] / hs * back); lk.set(p[0] + v[0] / hs * 4, p[1], p[2] + v[2] / hs * 4); speed = putting ? 4 : 3
      }
    } else {
      const back = putting ? (g.cam ? 10 : 4.5) : g.cam ? 32 : 9.5, up = putting ? (g.cam ? 7 : 2) : g.cam ? 16 : 3.4
      tgt.set(p[0] - dx * back, p[1] + up, p[2] - dz * back); lk.set(p[0] + dx * (putting ? 5 : 40), p[1] + (putting ? 0 : 3), p[2] + dz * (putting ? 5 : 40))
    }
    // keep camera above ground
    const gy = h.height(tgt.x, tgt.z) + 1; if (tgt.y < gy) tgt.y = gy
    const k = 1 - Math.exp(-dt * speed)
    camPos.current.lerp(tgt, k); look.current.lerp(lk, k)
    camera.position.copy(camPos.current); camera.lookAt(look.current)
  })
  const putting = g.club === PUTTER && g.phase !== 'flight'
  const golfer = () => {
    const now = performance.now(); const amp = g.club === PUTTER ? 0.45 : 2.5; let swing = 0
    if (g.phase === 'plan' || g.phase === 'intro') swing = Math.sin(now / 400) * 0.03
    else if (g.phase === 'swing') { const k = Math.min(1, g.meterT / 0.45); swing = -amp * (1 - (1 - k) * (1 - k)) }
    else { const k = (now - g.strikeAt) / (g.club === PUTTER ? 500 : 380); swing = k < 0.25 ? -amp * (1 - k / 0.25) : amp * 1.1 * Math.min(1, (k - 0.25) / 0.75) }
    return { pos: g.phase === 'flight' ? g.shotStart : g.ball, heading: g.heading, swing, putting: g.club === PUTTER, visible: g.phase !== 'holed' && !(g.phase === 'flight' && g.club === PUTTER && false) }
  }
  const sw = pv?.land ? Math.max(2.5, CLUBS[g.club].carry * 0.06 * (pv.s.lie === 'rough' ? 1.5 : pv.s.lie === 'sand' ? 2 : 1)) : 0
  return <>
    <Atmosphere focus={() => (g.phase === 'flight' && g.sim ? g.sim.p : g.ball)} />
    <Ocean /><Terrain hole={g.hole} /><Trees hole={g.hole} /><Flag hole={g.hole} /><TeeMarkers hole={g.hole} />
    {putting && <SlopeGrid hole={g.hole} />}
    <mesh ref={ball} castShadow><sphereGeometry args={[0.06, 20, 16]} /><meshStandardMaterial color="#ffffff" roughness={0.35} emissive="#ffffff" emissiveIntensity={0.25} /></mesh>
    <Golfer get={golfer} />
    <Trail get={() => g.trail} />
    <Particles get={() => g.fx} />
    {pv && (g.phase === 'plan' || g.phase === 'swing') && <>
      <PreviewLine pts={pv.pts} color={putting ? '#ffffff' : '#ffd23f'} />
      {pv.land && <LandingMarker pos={pv.land} heading={pv.s.heading} w={sw} l={Math.max(2, CLUBS[g.club].carry * 0.035)} />}
    </>}
  </>
}

function Play({ nine, onExit }: { nine: number; onExit: (scores: number[]) => void }) {
  const g = useRef<GS | null>(null); if (!g.current) g.current = newGame(nine)
  const gs = g.current
  const [ver, setVer] = useState(0); const [help, setHelp] = useState(false)
  const bump = () => setVer(v => v + 1)
  const pv = useMemo(() => gs.phase === 'plan' || gs.phase === 'swing' ? preview(gs) : null, [ver, gs.phase, gs.idx, gs.ball[0], gs.ball[2], gs.club])
  useEffect(() => { const t = setInterval(() => { if (gs.phase !== 'flight') bump() }, 200); return () => clearInterval(t) }, [])
  useEffect(() => {
    const keys = ['Space', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyQ', 'KeyE', 'KeyR', 'KeyC']
    const down = (e: KeyboardEvent) => {
      if (keys.includes(e.code)) e.preventDefault()
      unlockAudio()
      const s = g.current!; const putting = s.club === PUTTER
      if (e.code === 'Escape') { setHelp(h => !h); return }
      if (e.code === 'Tab' && !e.repeat) { s.overhead = !s.overhead; sfx.click(); return }
      if (e.code === 'KeyC' && !e.repeat) { s.cam = (s.cam + 1) % 2; sfx.click(); return }
      if (e.code === 'Space') {
        if (e.repeat) return
        if (s.phase === 'intro') { s.phase = 'plan'; bump(); return }
        if (s.phase === 'holed' && performance.now() - s.holedAt > 700) { if (s.idx >= 8) onExit(s.scores); else startHole(s, s.idx + 1); bump(); return }
        if (s.phase === 'plan') { s.phase = 'swing'; s.meterT = 0; s.meterOn = true; s.overhead = false; sfx.start(); bump(); return }
        if (s.phase === 'swing' && s.meterOn) { strike(s, s.meterT); bump(); return }
        if (s.phase === 'flight') { s.fast = true; return }
        return
      }
      if (s.phase !== 'plan') return
      const fine = e.shiftKey ? 0.25 : 1
      if (e.code === 'KeyA') s.heading -= (putting ? 0.004 : 0.012) * fine
      if (e.code === 'KeyD') s.heading += (putting ? 0.004 : 0.012) * fine
      if (e.code === 'KeyW') s.power = putting ? s.power + 0.15 * fine : Math.min(1, s.power + 0.02 * fine)
      if (e.code === 'KeyS') s.power = putting ? Math.max(0.3, s.power - 0.15 * fine) : Math.max(0.1, s.power - 0.02 * fine)
      if (!putting && e.code === 'KeyQ') { s.curve = Math.max(-1, +(s.curve - 0.1).toFixed(2)); sfx.tick() }
      if (!putting && e.code === 'KeyE') { s.curve = Math.min(1, +(s.curve + 0.1).toFixed(2)); sfx.tick() }
      if (e.code === 'KeyR') s.curve = 0
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        const onGreen = s.hole.lie(s.ball[0], s.ball[2]) === 'green'
        if (!onGreen) { s.club = Math.max(0, Math.min(PUTTER, s.club + (e.code === 'ArrowLeft' ? -1 : 1))); sfx.click(); if (s.club === PUTTER) { s.power = dist2(s.ball, s.hole.pin[0], s.hole.pin[1]); s.curve = 0 } else if (s.power > 1) s.power = 1 }
      }
      bump()
    }
    window.addEventListener('keydown', down); return () => window.removeEventListener('keydown', down)
  }, [])
  return <div style={{ position: 'absolute', inset: 0 }}>
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 50, near: 0.05, far: 4000 }} gl={{ antialias: true }}><World g={gs} pv={pv} /></Canvas>
    <Hud g={gs} />
    {help && <div className="overlay"><div className="glass">
      <h2 style={{ marginTop: 0 }}>Paused</h2>
      <kbd>A</kbd>/<kbd>D</kbd> aim (hold Shift for fine) · <kbd>W</kbd>/<kbd>S</kbd> power or putt pace · <kbd>Q</kbd>/<kbd>E</kbd> draw / fade · <kbd>R</kbd> straight<br />
      <kbd>←</kbd>/<kbd>→</kbd> club · <kbd>Space</kbd> start swing, <kbd>Space</kbd> again in the green zone · <kbd>Space</kbd> in flight fast-forwards<br />
      <kbd>C</kbd> camera · <kbd>Tab</kbd> overhead · <kbd>Esc</kbd> resume
      <h3>Simplified rules</h3>
      <div style={{ color: 'var(--dim)' }}>Water / out of bounds: +1 stroke, replay from the previous spot. Max {MAX_STROKES} strokes per hole. The red ring marks first landing — the ball will still bounce and roll. Course is a stylized, approximate take on Torrey Pines South.</div>
      <p><button className="btn" onClick={() => onExit(gs.scores)}>Quit to menu</button></p>
    </div></div>}
  </div>
}

function MenuWorld() {
  const hole = useMemo(() => buildHole(HOLES[2]), [])
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.06; const [gx, gz] = hole.green
    camera.position.set(gx + Math.cos(t) * 110, 32, gz + Math.sin(t) * 110 - 40); camera.lookAt(gx, -6, gz)
  })
  return <><Atmosphere focus={() => [hole.green[0], 0, hole.green[1]]} /><Ocean /><Terrain hole={hole} /><Trees hole={hole} /><Flag hole={hole} /></>
}

export default function App() {
  const [screen, setScreen] = useState<{ s: 'menu' } | { s: 'play'; nine: number; key: number } | { s: 'end'; nine: number; scores: number[] }>({ s: 'menu' })
  if (screen.s === 'play') return <Play key={screen.key} nine={screen.nine} onExit={scores => setScreen({ s: 'end', nine: screen.nine, scores })} />
  const nineInfo = (n: number) => { const hs = HOLES.slice(n * 9, n * 9 + 9); return { par: hs.reduce((a, h) => a + h.par, 0), yds: hs.reduce((a, h) => a + h.yards, 0) } }
  return <div style={{ position: 'absolute', inset: 0 }}>
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 45, near: 0.1, far: 4000 }}><MenuWorld /></Canvas>
    <div className="vignette" />
    {screen.s === 'menu' && <div className="menu"><div className="glass panel">
      <h1 className="title">Torrey Pines<span>SOUTH COURSE</span></h1>
      <p style={{ color: 'var(--dim)', marginTop: 18 }}>Clifftop golf above the Pacific. Read the wind, shape your shot, and nail the timing.</p>
      <div className="nines">
        {[0, 1].map(n => { const i = nineInfo(n); return <button key={n} className="nine" onClick={() => { unlockAudio(); sfx.click(); setScreen({ s: 'play', nine: n, key: Date.now() }) }}>
          <span className="label">{n ? 'Holes 10–18' : 'Holes 1–9'}</span><b>{n ? 'Back Nine' : 'Front Nine'}</b><small>Par {i.par} · {i.yds.toLocaleString()} yds</small></button> })}
      </div>
      <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 2 }}><kbd>A</kbd><kbd>D</kbd> aim <kbd>W</kbd><kbd>S</kbd> power <kbd>Q</kbd><kbd>E</kbd> shape <kbd>←</kbd><kbd>→</kbd> club <kbd>Space</kbd> swing</div>
    </div></div>}
    {screen.s === 'end' && (() => {
      const hs = HOLES.slice(screen.nine * 9, screen.nine * 9 + 9); const played = screen.scores.filter(Boolean).length
      const tot = screen.scores.reduce((a, b) => a + b, 0); const par = hs.reduce((a, h, i) => a + (screen.scores[i] ? h.par : 0), 0); const d = tot - par
      return <div className="overlay"><div className="glass" style={{ textAlign: 'center' }}>
        <div className="label">{screen.nine ? 'Back nine' : 'Front nine'} · {played}/9 holes</div>
        <div className="big" style={{ fontSize: 72, lineHeight: 1.1 }}>{d === 0 ? 'E' : d > 0 ? `+${d}` : d}</div>
        <div style={{ color: 'var(--dim)' }}>{tot} strokes</div>
        <table className="card"><tbody>
          <tr className="label"><td>Hole</td>{hs.map(h => <td key={h.num}>{h.num}</td>)}</tr>
          <tr style={{ color: 'var(--dim)' }}><td>Par</td>{hs.map(h => <td key={h.num}>{h.par}</td>)}</tr>
          <tr className="big"><td>You</td>{screen.scores.map((s, i) => <td key={i} style={{ color: s && s < hs[i].par ? '#ff6b6b' : '#fff' }}>{s || '–'}</td>)}</tr>
        </tbody></table>
        <button className="btn" onClick={() => setScreen({ s: 'menu' })}>Main menu</button>
      </div></div>
    })()}
  </div>
}
