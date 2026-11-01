/**
 * Shot execution: turning the player's plan (club, aim, power, shape) plus the
 * swing-meter timing into launch parameters, previewing the shot, and striking it.
 * The preview and the real strike both go through shotParams() and the same
 * simulation, so a perfect strike reproduces the preview exactly.
 */
import * as THREE from 'three'
import { dirOf, type Lie } from '../course/course'
import {
  CLUBS, PUTTER, FIRST_WEDGE, LIE_CARRY, LIE_ZONE, LIE_AIM_ERROR, LIE_SPIN, WEDGE_SAND_CARRY, METER, YD,
} from '../config'
import { launch, step, cloneBall, type Ball } from '../sim/sim'
import { speedForCarry, speedForPutt } from '../sim/calibrate'
import { setFeedback, showBanner, type GS } from './game'
import { sfx } from '../sound'

/** Launch parameters for a shot, plus the perfect-zone width and lie used to compute them. */
export interface ShotParams {
  heading: number
  speed: number
  launch: number
  curve: number
  spin: number
  zone: number // half-width of the perfect timing zone
  lie: Lie
}

/** Half-width of the perfect zone: smaller from bad lies and with stronger draw/fade. */
function perfectZone(g: GS, lie: Lie) {
  return METER.zone * (LIE_ZONE[lie] ?? 1) * (1 - Math.abs(g.curve) * METER.shapePenalty)
}

/**
 * Computes the shot's launch parameters. `timingErr` is the meter position minus
 * 0.5 (negative = early). Only the error beyond the perfect zone counts: it pulls
 * the shot left (early) or pushes it right (late) and costs distance.
 */
export function shotParams(g: GS, timingErr = 0): ShotParams {
  const lie = g.hole.lie(g.ball[0], g.ball[2])
  const club = CLUBS[g.club]
  const zone = perfectZone(g, lie)
  const isPutt = g.club === PUTTER

  const miss = Math.max(0, Math.abs(timingErr) - zone)
  const aimScale = (isPutt ? METER.putterAim : 1) * (LIE_AIM_ERROR[lie] ?? 1)
  const angErr = Math.sign(timingErr) * miss * METER.errDeg * Math.PI / 180 * aimScale
  const distMul = 1 - miss * METER.distLoss
  const heading = g.heading + angErr // negative error turns left

  if (isPutt) return { heading, speed: speedForPutt(g.power * distMul), launch: 0, curve: 0, spin: 0, zone, lie }

  const lieMul = lie === 'sand' && g.club >= FIRST_WEDGE ? WEDGE_SAND_CARRY : LIE_CARRY[lie] ?? 1
  const carry = club.carry * YD * g.power * lieMul * distMul
  const spin = club.spin * (LIE_SPIN[lie] ?? 1)
  return { heading, speed: speedForCarry(carry, club.launch, spin), launch: club.launch, curve: g.curve, spin, zone, lie }
}

/** Preview geometry: line points, first-contact point (null for putts), and the params used. */
export interface Preview { pts: THREE.Vector3[]; land: number[] | null; s: ShotParams }

/**
 * Builds the shot preview for a perfect strike. Full shots trace the simulated
 * flight up to first contact. Putts only show a short aim line along the
 * ground, so the player still has to read the break.
 */
export function preview(g: GS): Preview {
  const s = shotParams(g)
  const b = launch(g.ball, s.heading, s.speed, s.launch, s.curve, s.spin)
  if (g.club === PUTTER) return { pts: puttAimLine(g, s.heading, b), land: null, s }
  const pts = flightLine(g, b)
  return { pts, land: [...b.p], s }
}

/**
 * Size of the shaded landing-dispersion ellipse: [width, length] in meters.
 * This is a rough visual guide scaled from club carry and lie, not simulated.
 */
export function dispersionSize(club: number, lie: Lie): [number, number] {
  const carry = CLUBS[club].carry
  const lieScale = lie === 'rough' ? 1.5 : lie === 'sand' ? 2 : 1
  return [Math.max(2.5, carry * 0.06 * lieScale), Math.max(2, carry * 0.035)]
}

/** Short straight line hugging the green in the aim direction (at most 5 m). */
function puttAimLine(g: GS, heading: number, b: Ball): THREE.Vector3[] {
  const pts = [new THREE.Vector3(...b.p)]
  const [dx, dz] = dirOf(heading)
  const len = Math.min(g.power * 0.5, 5)
  for (let i = 0; i <= 10; i++) {
    const x = g.ball[0] + dx * len * i / 10
    const z = g.ball[2] + dz * len * i / 10
    pts.push(new THREE.Vector3(x, g.hole.height(x, z) + 0.04, z))
  }
  return pts
}

/** Simulates the flight until first contact, sampling every third step. Leaves `b` at the landing point. */
function flightLine(g: GS, b: Ball): THREE.Vector3[] {
  const pts = [new THREE.Vector3(...b.p)]
  for (let i = 0; i < 2400; i++) {
    const contact = step(b, g.hole, g.hole.wind)
    if (i % 3 === 0) pts.push(new THREE.Vector3(...b.p))
    if (contact || b.mode !== 'air') break
  }
  pts.push(new THREE.Vector3(...b.p))
  return pts
}

/** Feedback text for a strike with timing error `err`. */
function timingLabel(err: number, perfect: boolean) {
  if (perfect) return 'Perfect strike'
  const way = Math.abs(err) > 0.2
  if (err < 0) return way ? 'Way early — pulled left' : 'Early — a touch left'
  return way ? 'Way late — pushed right' : 'Late — a touch right'
}

/** Strikes the ball with the meter stopped at `t` (0-1) and starts the flight phase. */
export function strike(g: GS, t: number) {
  const err = t - 0.5
  const s = shotParams(g, err)
  const perfect = Math.abs(err) <= s.zone

  setFeedback(g, timingLabel(err, perfect))
  g.meterOn = false
  if (perfect) {
    g.streak++
    showBanner(g, g.streak > 1 ? `PERFECT ×${g.streak}` : 'PERFECT', '#7CFFB2')
  } else {
    g.streak = 0
  }

  g.lastPos = [...g.ball]
  g.shotStart = [...g.ball]
  g.strokes++
  g.strikeAt = performance.now()
  g.sim = launch(g.ball, s.heading, s.speed, s.launch, s.curve, s.spin)
  g.acc = 0
  g.phase = 'flight'
  g.trail = [[...g.ball]]
  g.fast = false
  g.lastContacts = 0

  predictOutcome(g)
  if (g.club === PUTTER) sfx.putt()
  else sfx.strike(perfect)
}

/** Simulates a copy of the shot to completion so the TV camera knows where and when the ball lands. */
function predictOutcome(g: GS) {
  const c = cloneBall(g.sim!)
  g.contact = null
  g.final = null
  for (let i = 0; i < 8000 && (c.mode === 'air' || c.mode === 'roll'); i++) {
    const contact = step(c, g.hole, g.hole.wind)
    if (contact && !g.contact) {
      g.contact = [...c.p]
      g.contactT = c.t
    }
  }
  g.final = [...c.p]
}
