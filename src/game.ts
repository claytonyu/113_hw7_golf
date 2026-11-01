import * as THREE from 'three'
import { HOLES, buildHole, dirOf, type Hole } from './course'
import { CLUBS, PUTTER, LIE_CARRY, LIE_ZONE, METER, MAX_STROKES } from './config'
import { launch, step, speedForCarry, speedForPutt, type Ball } from './sim'
import { sfx } from './sound'

export const YD = 0.9144
export type Phase = 'intro' | 'plan' | 'swing' | 'flight' | 'holed'
export interface Particle { p: number[]; v: number[]; life: number; max: number; c: [number, number, number] }
export interface Banner { text: string; sub?: string; color: string; at: number }
export interface GS {
  nine: number; idx: number; hole: Hole; ball: number[]; lastPos: number[]; strokes: number; scores: number[]
  club: number; heading: number; power: number; curve: number; phase: Phase
  meterT: number; meterOn: boolean; feedback: string; feedbackAt: number; sim: Ball | null; acc: number
  cam: number; overhead: boolean; shotStart: number[]; holedAt: number
  trail: number[][]; banner: Banner | null; fx: Particle[]; introT: number; fast: boolean
  contact: number[] | null; contactT: number; final: number[] | null; streak: number; strikeAt: number; lastContacts: number
  confettiAt: number
}

export const dist2 = (a: number[], x: number, z: number) => Math.hypot(a[0] - x, a[2] - z)
export const INTRO = 4.2

export function newGame(nine: number): GS {
  const g = { nine, scores: Array(9).fill(0), cam: 0, overhead: false, meterT: 0, meterOn: false, acc: 0, trail: [], fx: [], banner: null, streak: 0, strikeAt: 0, confettiAt: 0, fast: false } as unknown as GS
  startHole(g, 0); return g
}

export function startHole(g: GS, idx: number) {
  g.idx = idx; g.hole = buildHole(HOLES[g.nine * 9 + idx])
  const h = g.hole; g.ball = [0, h.height(0, 0), 0]; g.lastPos = [...g.ball]; g.strokes = 0; g.sim = null; g.trail = []
  g.phase = 'intro'; g.introT = 0; g.curve = 0
  say(g, `${h.def.name}`)
  g.banner = { text: `HOLE ${h.def.num}`, sub: `PAR ${h.def.par} · ${h.def.yards} YDS`, color: '#ffffff', at: performance.now() }
  prepShot(g)
}
export function say(g: GS, s: string) { g.feedback = s; g.feedbackAt = performance.now() }

export function prepShot(g: GS) {
  const h = g.hole; const d = dist2(g.ball, h.pin[0], h.pin[1])
  g.heading = Math.atan2(-(h.pin[0] - g.ball[0]), h.pin[1] - g.ball[2])
  if (d > 260 && g.strokes === 0) { const t = h.path[1]; g.heading = Math.atan2(-(t[0] - g.ball[0]), t[1] - g.ball[2]) }
  const lie = h.lie(g.ball[0], g.ball[2])
  if (lie === 'green') { g.club = PUTTER; g.power = d; g.curve = 0; return }
  const yd = d / YD / (LIE_CARRY[lie] ?? 1)
  let c = 0; for (let i = 0; i < PUTTER; i++) if (CLUBS[i].carry >= yd * 0.97) c = i
  g.club = c; g.power = Math.min(1, yd / CLUBS[c].carry)
}

export function shotParams(g: GS, timingErr = 0) {
  const h = g.hole; const lie = h.lie(g.ball[0], g.ball[2]); const club = CLUBS[g.club]
  const zone = METER.zone * (LIE_ZONE[lie] ?? 1) * (1 - Math.abs(g.curve) * 0.3)
  const over = Math.max(0, Math.abs(timingErr) - zone)
  const angErr = Math.sign(timingErr) * over * METER.errDeg * Math.PI / 180 * (g.club === PUTTER ? 0.25 : 1) * (1 + (lie === 'rough' ? 0.4 : lie === 'sand' ? 0.8 : 0))
  const distMul = 1 - over * METER.distLoss
  const heading = g.heading + angErr // early (negative) -> left
  if (g.club === PUTTER) return { heading, speed: speedForPutt(g.power * distMul), launch: 0, curve: 0, spin: 0, zone, lie }
  let lieMul = LIE_CARRY[lie] ?? 1
  if (lie === 'sand' && g.club >= 8) lieMul = 0.9 // wedges escape cleanly
  const carry = club.carry * YD * g.power * lieMul * distMul
  const spin = club.spin * (lie === 'rough' ? 0.5 : lie === 'sand' ? 0.7 : 1)
  return { heading, speed: speedForCarry(carry, club.launch, spin), launch: club.launch, curve: g.curve, spin, zone, lie }
}

export function preview(g: GS) {
  const s = shotParams(g); const b = launch(g.ball, s.heading, s.speed, s.launch, s.curve, s.spin)
  const pts: THREE.Vector3[] = [new THREE.Vector3(...b.p)]
  if (g.club === PUTTER) {
    const [dx, dz] = dirOf(s.heading); const L = Math.min(g.power * 0.5, 5)
    for (let i = 0; i <= 10; i++) { const x = g.ball[0] + dx * L * i / 10, z = g.ball[2] + dz * L * i / 10; pts.push(new THREE.Vector3(x, g.hole.height(x, z) + 0.04, z)) }
    return { pts, land: null, s }
  }
  for (let i = 0; i < 2400; i++) { const r = step(b, g.hole, g.hole.wind); if (i % 3 === 0) pts.push(new THREE.Vector3(...b.p)); if (r || b.mode !== 'air') break }
  pts.push(new THREE.Vector3(...b.p))
  return { pts, land: [...b.p], s }
}

function burst(g: GS, p: number[], n: number, c: [number, number, number], spread: number, up: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * spread
    g.fx.push({ p: [p[0], p[1] + 0.05, p[2]], v: [Math.cos(a) * r, up * (0.5 + Math.random()), Math.sin(a) * r], life: 0, max: 0.6 + Math.random() * 0.8, c })
  }
  if (g.fx.length > 600) g.fx.splice(0, g.fx.length - 600)
}
export function onContact(g: GS, b: Ball) {
  const lie = g.hole.lie(b.p[0], b.p[2]); const sp = Math.hypot(...b.v)
  if (b.mode === 'water') { burst(g, b.p, 80, [0.85, 0.95, 1], 2.5, 7); sfx.splash(); return }
  if (lie === 'sand') { burst(g, b.p, 45, [0.93, 0.85, 0.62], 3, 4); sfx.sand() }
  else if (sp > 4) { burst(g, b.p, 14, lie === 'green' ? [0.45, 0.85, 0.4] : [0.35, 0.6, 0.25], 1.5, 2.5); sfx.thud() }
}

export function strike(g: GS, t: number) {
  const err = t - 0.5; const s = shotParams(g, err); const ae = Math.abs(err); const perfect = ae <= s.zone
  const label = perfect ? 'Perfect strike' : err < 0 ? (ae > 0.2 ? 'Way early — pulled left' : 'Early — a touch left') : (ae > 0.2 ? 'Way late — pushed right' : 'Late — a touch right')
  say(g, label); g.meterOn = false
  if (perfect) { g.streak++; g.banner = { text: g.streak > 1 ? `PERFECT ×${g.streak}` : 'PERFECT', color: '#7CFFB2', at: performance.now() } }
  else g.streak = 0
  g.lastPos = [...g.ball]; g.shotStart = [...g.ball]; g.strokes++; g.strikeAt = performance.now()
  g.sim = launch(g.ball, s.heading, s.speed, s.launch, s.curve, s.spin); g.acc = 0; g.phase = 'flight'; g.trail = [[...g.ball]]; g.fast = false; g.lastContacts = 0
  // predict outcome for TV-style landing camera
  const c: Ball = JSON.parse(JSON.stringify(g.sim)); g.contact = null; g.final = null
  for (let i = 0; i < 8000 && (c.mode === 'air' || c.mode === 'roll'); i++) { const r = step(c, g.hole, g.hole.wind); if (r && !g.contact) { g.contact = [...c.p]; g.contactT = c.t } }
  g.final = [...c.p]
  if (g.club === PUTTER) sfx.putt(); else sfx.strike(perfect)
}

const NAMES: Record<string, [string, string]> = { '-3': ['ALBATROSS', '#ff7ae0'], '-2': ['EAGLE', '#ffd23f'], '-1': ['BIRDIE', '#7CFFB2'], '0': ['PAR', '#ffffff'], '1': ['BOGEY', '#ffb36b'], '2': ['DOUBLE BOGEY', '#ff8a7a'] }
export function finishShot(g: GS) {
  const b = g.sim!; const h = g.hole
  const carried = dist2(g.shotStart, b.p[0], b.p[2]) / YD
  if (b.mode === 'holed') {
    g.phase = 'holed'; g.ball = [...b.p]; g.scores[g.idx] = g.strokes
    const d = g.strokes - h.def.par; const [name, color] = g.strokes === 1 ? ['HOLE IN ONE', '#ff7ae0'] : NAMES[d] ?? [`+${d}`, '#ff8a7a']
    g.banner = { text: name, sub: `${g.strokes} strokes · Space for next hole`, color, at: performance.now() }
    say(g, 'In the cup!'); sfx.cup()
    if (d < 0 || g.strokes === 1) { sfx.cheer(d <= -2 || g.strokes === 1); g.confettiAt = performance.now() } else if (d >= 2) sfx.groan()
    g.sim = null; g.holedAt = performance.now(); return
  }
  if (b.mode === 'water' || b.mode === 'oob') {
    g.strokes++; g.ball = [...g.lastPos]
    g.banner = { text: b.mode === 'water' ? 'SPLASH' : 'OUT OF BOUNDS', sub: '+1 stroke · replay from previous spot', color: '#8fd3ff', at: performance.now() }
    say(g, 'Penalty stroke'); if (b.mode === 'oob') sfx.groan()
  } else {
    g.ball = [...b.p]
    const rem = dist2(g.ball, h.pin[0], h.pin[1]) / YD; const lie = h.lie(g.ball[0], g.ball[2])
    say(g, `${carried.toFixed(0)} yds · ${rem < 30 ? (rem * 3).toFixed(0) + ' ft' : rem.toFixed(0) + ' yds'} left · ${lie === 'green' ? 'on the green' : 'in the ' + lie}`)
    if (lie === 'green' && rem < 3 && h.def.par - g.strokes >= 2) g.banner = { text: 'TAP-IN EAGLE LOOK', color: '#ffd23f', at: performance.now() }
  }
  g.sim = null; g.phase = 'plan'; g.trail = g.trail.slice()
  if (g.strokes >= MAX_STROKES) { g.scores[g.idx] = g.strokes; g.phase = 'holed'; g.banner = { text: 'PICKED UP', sub: 'Space for next hole', color: '#ffb36b', at: performance.now() }; g.holedAt = performance.now(); return }
  prepShot(g)
}
