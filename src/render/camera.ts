/**
 * Camera direction: picks where the camera should be and what it should look
 * at for the current phase. The World component then eases the real camera
 * toward that goal each frame.
 */
import * as THREE from 'three'
import { dirOf, pathPoint } from '../course/course'
import { PUTTER } from '../config'
import { distXZ, INTRO, type GS } from '../game/game'

/** Target camera position, look-at point, and easing speed (higher = snappier). */
export interface CameraGoal { pos: THREE.Vector3; look: THREE.Vector3; speed: number }

/**
 * Views cycled with C (index = g.cam). Each sets both the planning view and how
 * the ball is followed in flight:
 * - Behind ball: close aiming view; chase the ball, then cut to the TV landing camera on long shots.
 * - High: raised aiming view (good for reading greens); high chase camera.
 * - Ball follow: close aiming view; chase the ball all the way to rest.
 * - Landing: look back from the predicted landing spot (or from behind the hole when putting); TV landing camera in flight.
 * Tab toggles the overhead course view on top of any of these.
 */
export const CAMERAS = ['Behind ball', 'High', 'Ball follow', 'Landing'] as const
const BEHIND = 0, HIGH = 1, FOLLOW = 2, LANDING = 3

/**
 * Chooses the camera goal. `p` is the ball's current position, `time` the clock
 * in seconds, and `land` the previewed first-contact point (null when there is none).
 */
export function cameraGoal(g: GS, p: number[], time: number, land: number[] | null = null): CameraGoal {
  let goal: CameraGoal
  if (g.phase === 'intro') goal = introCamera(g)
  else if (g.phase === 'holed') goal = holedCamera(g, time)
  else if (g.overhead) goal = overheadCamera(g, p)
  else if (g.phase === 'flight' && g.sim) goal = flightCamera(g, p)
  else if (g.cam === LANDING && (g.phase === 'plan' || g.phase === 'swing')) goal = landingViewCamera(g, p, land)
  else goal = aimCamera(g, p)

  // Never go underground: stay at least 1 m above the terrain.
  const groundY = g.hole.height(goal.pos.x, goal.pos.z) + 1
  if (goal.pos.y < groundY) goal.pos.y = groundY
  return goal
}

/** Flyover from behind the tee toward the green, descending as it goes. */
function introCamera(g: GS): CameraGoal {
  const h = g.hole
  const s = g.introT / INTRO // 0 -> 1 over the intro
  const at = pathPoint(h, s * 0.85 - 0.08)
  const ahead = pathPoint(h, s * 0.85 + 0.2)
  return {
    pos: new THREE.Vector3(at[0], 45 - s * 10 + h.def.elev * s, at[1]),
    look: new THREE.Vector3(ahead[0], h.def.elev * s, ahead[1]),
    speed: 2.5,
  }
}

/** Slow orbit around the cup after holing out. */
function holedCamera(g: GS, time: number): CameraGoal {
  const h = g.hole
  const t = time * 0.35
  const y = h.height(h.pin[0], h.pin[1])
  return {
    pos: new THREE.Vector3(h.pin[0] + Math.cos(t) * 6, y + 2.5, h.pin[1] + Math.sin(t) * 6),
    look: new THREE.Vector3(h.pin[0], y + 0.3, h.pin[1]),
    speed: 2,
  }
}

/** High view over the midpoint between ball and pin, framing both. */
function overheadCamera(g: GS, p: number[]): CameraGoal {
  const h = g.hole
  const mx = (p[0] + h.pin[0]) / 2, mz = (p[2] + h.pin[1]) / 2
  const d = distXZ(p, h.pin[0], h.pin[1])
  return {
    // The tiny x offset avoids a degenerate lookAt when looking straight down.
    pos: new THREE.Vector3(mx + 0.01, Math.max(50, d * 1.05) + p[1], mz - d * 0.2),
    look: new THREE.Vector3(mx, p[1], mz),
    speed: 5,
  }
}

/**
 * During flight: chase the ball from behind, then for longer shots cut to a
 * "TV" camera beside the predicted landing spot, looking back at the incoming ball.
 */
function flightCamera(g: GS, p: number[]): CameraGoal {
  const sim = g.sim!
  const putting = g.club === PUTTER
  const v = sim.v
  const hs = Math.hypot(v[0], v[2]) || 1
  const longShot = g.contact && !putting && g.contactT > 1.8
  const useTvCam = longShot && (g.cam === LANDING || (g.cam === BEHIND && sim.t > g.contactT * 0.55))

  if (useTvCam) {
    // 16 m back toward the tee and 14 m to the side of the landing spot.
    const c = g.contact!
    const sx = g.shotStart[0] - c[0], sz = g.shotStart[2] - c[2]
    const sl = Math.hypot(sx, sz) || 1
    return {
      pos: new THREE.Vector3(c[0] + sx / sl * 16 + (-sz / sl) * 14, c[1] + 4, c[2] + sz / sl * 16 + (sx / sl) * 14),
      look: new THREE.Vector3(p[0], p[1], p[2]),
      speed: 2.2,
    }
  }

  const high = g.cam === HIGH
  const back = putting ? (high ? 8 : 3.5) : high ? 30 : sim.mode === 'roll' ? 12 : 14
  const up = putting ? (high ? 5 : 1.4) : high ? 14 : 4
  return {
    pos: new THREE.Vector3(p[0] - v[0] / hs * back, p[1] + up, p[2] - v[2] / hs * back),
    look: new THREE.Vector3(p[0] + v[0] / hs * 4, p[1], p[2] + v[2] / hs * 4),
    speed: putting ? 4 : 3,
  }
}

/**
 * Planning view from the target end. Full shots: beside and beyond the
 * previewed landing spot, looking at it with the ball behind. Putts: low
 * behind the hole, looking back along the line (useful for reading the break).
 */
function landingViewCamera(g: GS, p: number[], land: number[] | null): CameraGoal {
  const h = g.hole
  if (g.club === PUTTER || !land) {
    const [px, pz] = h.pin
    const py = h.height(px, pz)
    const dx = px - p[0], dz = pz - p[2]
    const l = Math.hypot(dx, dz) || 1
    return {
      pos: new THREE.Vector3(px + dx / l * 4, py + 1.6, pz + dz / l * 4),
      look: new THREE.Vector3(p[0], p[1], p[2]),
      speed: 4,
    }
  }
  // 16 m toward the ball and 14 m to the side of the landing spot, like the TV camera.
  const sx = p[0] - land[0], sz = p[2] - land[2]
  const sl = Math.hypot(sx, sz) || 1
  return {
    pos: new THREE.Vector3(land[0] + sx / sl * 16 + (-sz / sl) * 14, land[1] + 6, land[2] + sz / sl * 16 + (sx / sl) * 14),
    look: new THREE.Vector3(land[0], land[1], land[2]),
    speed: 4,
  }
}

/** Behind-the-ball aiming view: close, or raised for the High camera. */
function aimCamera(g: GS, p: number[]): CameraGoal {
  const [dx, dz] = dirOf(g.heading)
  const putting = g.club === PUTTER
  const high = g.cam === HIGH
  const back = putting ? (high ? 10 : 4.5) : high ? 32 : 9.5
  const up = putting ? (high ? 7 : 2) : high ? 16 : 3.4
  const lookAhead = putting ? 5 : 40
  return {
    pos: new THREE.Vector3(p[0] - dx * back, p[1] + up, p[2] - dz * back),
    look: new THREE.Vector3(p[0] + dx * lookAhead, p[1] + (putting ? 0 : 3), p[2] + dz * lookAhead),
    speed: 5,
  }
}
