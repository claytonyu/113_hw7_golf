/**
 * Shot execution: turning a shot plan (club, aim, power, shape) plus the
 * swing-meter timing into launch parameters, previewing the shot, and striking it.
 * The preview, the AI's planning and the real strike all go through
 * computeShot() and the same simulation, so a perfect strike reproduces the
 * preview exactly and the AI plays by the same physics as the player.
 * Equipment upgrades and an armed consumable boost enter as ClubMods multipliers.
 */
import * as THREE from 'three'
import { dirOf, type Hole, type Lie } from '../course/course'
import {
  CLUBS, PUTTER, FIRST_WEDGE, LIE_CARRY, LIE_ZONE, LIE_AIM_ERROR, LIE_SPIN, WEDGE_SAND_CARRY, METER, YD, NO_MODS, CONSUMABLES,
  type ClubMods, type ConsumableId,
} from '../config'
import { launch, step, cloneBall, simulateToRest, type Ball } from '../sim/sim'
import { speedForCarry, speedForPutt } from '../sim/calibrate'
import { active, setFeedback, showBanner, type GS, type ShotPlan } from './game'
import { armedBoost, boostMods, useArmedBoost } from './boosts'
import { sfx } from '../sound'
import { saveRound } from '../progress/roundSave'

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
export function perfectZone(curve: number, lie: Lie) {
  return METER.zone * (LIE_ZONE[lie] ?? 1) * (1 - Math.abs(curve) * METER.shapePenalty)
}

/** Carry multiplier for the lie, including equipment that softens rough or sand. */
export function lieCarry(lie: Lie, club: number, mods: ClubMods) {
  if (lie === 'sand' && club >= FIRST_WEDGE) return mods.sandCarry ?? WEDGE_SAND_CARRY
  if (lie === 'rough' && mods.roughCarry !== undefined) return mods.roughCarry
  return LIE_CARRY[lie] ?? 1
}

/**
 * Computes launch parameters for `plan` played from `ball` with club modifiers
 * `mods`. `timingErr` is the meter position minus 0.5 (negative = early). Only
 * the error beyond the perfect zone counts: it pulls the shot left (early) or
 * pushes it right (late) and costs distance.
 */
export function computeShot(hole: Hole, ball: number[], plan: ShotPlan, timingErr = 0, mods: ClubMods = NO_MODS): ShotParams {
  const lie = hole.lie(ball[0], ball[2])
  const club = CLUBS[plan.club]
  const zone = perfectZone(plan.curve, lie) * mods.zone * (lie === 'sand' ? mods.sandZone : 1)
  const isPutt = plan.club === PUTTER

  const miss = Math.max(0, Math.abs(timingErr) - zone)
  const aimScale = (isPutt ? METER.putterAim : 1) * (LIE_AIM_ERROR[lie] ?? 1) * mods.aimErr
  const angErr = Math.sign(timingErr) * miss * METER.errDeg * Math.PI / 180 * aimScale
  const distMul = 1 - miss * METER.distLoss * mods.distLoss
  const heading = plan.heading + angErr // negative error turns left

  if (isPutt) return { heading, speed: speedForPutt(plan.power * distMul), launch: 0, curve: 0, spin: 0, zone, lie }

  const carry = club.carry * YD * plan.power * lieCarry(lie, plan.club, mods) * distMul * mods.carry
  const spin = club.spin * (LIE_SPIN[lie] ?? 1) * mods.spin
  return { heading, speed: speedForCarry(carry, club.launch, spin), launch: club.launch, curve: plan.curve, spin, zone, lie }
}

/** The active golfer's equipment modifiers for the current club, combined with a boost. */
export function shotMods(g: GS, boost: ConsumableId | null): ClubMods {
  const gear = active(g).mods[g.club]
  const b = boostMods(boost)
  return { ...gear, carry: gear.carry * (b.carry ?? 1), zone: gear.zone * (b.zone ?? 1) }
}

/** Launch parameters for the active golfer's current plan, including any armed boost (so the preview shows it). */
export function shotParams(g: GS, timingErr = 0): ShotParams {
  return computeShot(g.hole, active(g).ball, g, timingErr, shotMods(g, armedBoost(g)))
}

/** A ball launched from `from` with the given parameters. */
export function launchShot(from: number[], s: ShotParams): Ball {
  return launch(from, s.heading, s.speed, s.launch, s.curve, s.spin)
}

/** Preview geometry: line points, first-contact point (null for putts), and the params used. */
export interface Preview { pts: THREE.Vector3[]; land: number[] | null; s: ShotParams }

/**
 * Builds the shot preview for a perfect strike. Full shots trace the simulated
 * flight up to first contact. Putts only show a short aim line along the
 * ground, so the player still has to read the break.
 */
export function preview(g: GS): Preview {
  const ball = active(g).ball
  const s = shotParams(g)
  const b = launchShot(ball, s)
  if (g.club === PUTTER) return { pts: puttAimLine(g, ball, s.heading, b), land: null, s }
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
function puttAimLine(g: GS, ball: number[], heading: number, b: Ball): THREE.Vector3[] {
  const pts = [new THREE.Vector3(...b.p)]
  const [dx, dz] = dirOf(heading)
  const len = Math.min(g.power * 0.5, 5)
  for (let i = 0; i <= 10; i++) {
    const x = ball[0] + dx * len * i / 10
    const z = ball[2] + dz * len * i / 10
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

/** Strikes the active golfer's ball with the meter stopped at `t` (0-1) and starts the flight phase. */
export function strike(g: GS, t: number) {
  const golfer = active(g)
  const err = t - 0.5
  const boost = useArmedBoost(g) // spends the charge now, at the strike
  const s = computeShot(g.hole, golfer.ball, g, err, shotMods(g, boost))
  const perfect = Math.abs(err) <= s.zone

  g.meterOn = false
  if (golfer.isAI) {
    setFeedback(g, `${golfer.name}: ${timingLabel(err, perfect)}`)
  } else {
    const used = boost ? ` · ${CONSUMABLES.find(c => c.id === boost)!.name} used` : ''
    setFeedback(g, timingLabel(err, perfect) + used)
    if (perfect) {
      g.streak++
      showBanner(g, g.streak > 1 ? `PERFECT ×${g.streak}` : 'PERFECT', '#7CFFB2')
    } else {
      g.streak = 0
    }
  }

  golfer.lastPos = [...golfer.ball]
  g.shotStart = [...golfer.ball]
  golfer.strokes++
  g.strikeAt = performance.now()
  g.sim = launchShot(golfer.ball, s)
  g.acc = 0
  g.phase = 'flight'
  g.trail = golfer.isAI ? [] : [[...golfer.ball]] // the AI's shots leave no trail, so it can't clutter the player's preview
  g.fast = false
  g.lastContacts = 0

  predictOutcome(g)
  saveRound(g) // includes the launched ball, so a reload replays this shot instead of retaking it
  if (g.club === PUTTER) sfx.putt()
  else sfx.strike(perfect)
}

/** Simulates a copy of the shot to completion so the TV camera knows where and when the ball lands. */
export function predictOutcome(g: GS) {
  g.contact = null
  g.final = null
  const c = simulateToRest(cloneBall(g.sim!), g.hole, g.hole.wind, b => {
    if (!g.contact) {
      g.contact = [...b.p]
      g.contactT = b.t
    }
  })
  g.final = [...c.p]
}
