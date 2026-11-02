/**
 * The 3D scenes. `World` renders a hole during play and drives the per-frame
 * update (game loop, ball mesh, camera). `MenuWorld` is the slowly orbiting
 * backdrop behind the main menu.
 */
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HOLES } from '../course/holes'
import { buildHole, dirOf, headingTo } from '../course/course'
import { AI_LEVELS, AI_OUTFIT, PUTTER } from '../config'
import { OPPONENT, type GS } from '../game/game'
import { AI_BACKSWING } from '../game/ai'
import { advanceGame } from '../game/loop'
import { dispersionSize, type Preview } from '../game/shot'
import { cameraGoal } from './camera'
import { Atmosphere, Ocean } from './environment'
import { Terrain } from './terrain'
import { Trees } from './trees'
import { Flag, TeeMarkers, SlopeGrid } from './props'
import { Golfer, type GolferColors, type GolferPose } from './golfer'
import { Trail, Particles } from './fx'
import { PreviewLine, LandingMarker } from './preview'

/** Longest frame step (s) fed to the game, so a stalled tab doesn't jump the simulation. */
const MAX_FRAME_DT = 0.05

/** Golfer colors: the player's equipped cosmetics, and the AI opponent's fixed red and black. */
const golferColors = (g: GS): GolferColors[] => [g.look, AI_OUTFIT]

/** Ball colors: the player's equipped ball, and white for the AI. */
const ballColors = (g: GS) => [g.look.ball, '#ffffff']

/** Where a golfer who is waiting for their turn stands: 3 m behind their ball, looking at the pin. */
const WAIT_BACK = 3

/**
 * Pose for golfer `i`. The golfer whose turn it is: idle waggle while planning,
 * backswing with the meter (or at the end of the AI's lining-up time), then
 * downswing and follow-through. The other golfer waits behind their own ball.
 */
function golferPose(g: GS, i: number): GolferPose {
  const golfer = g.golfers[i]
  const visible = g.phase !== 'holed' && !golfer.holed
  const now = performance.now()

  if (i !== g.turn) {
    const heading = headingTo(golfer.ball, g.hole.pin[0], g.hole.pin[1])
    const [dx, dz] = dirOf(heading)
    const pos = [golfer.ball[0] - dx * WAIT_BACK, golfer.ball[1], golfer.ball[2] - dz * WAIT_BACK]
    return { pos, heading, swing: Math.sin(now / 400 + 1) * 0.03, putting: false, visible }
  }

  const putting = g.club === PUTTER
  const amp = putting ? 0.45 : 2.5 // backswing size in radians
  const backswing = (k: number) => -amp * (1 - (1 - k) * (1 - k)) // eases out toward the top
  const waggle = Math.sin(now / 400) * 0.03
  let swing: number
  if (g.phase === 'plan' || g.phase === 'intro') {
    swing = waggle
  } else if (g.phase === 'swing') {
    // The backswing eases out over the first 45% of the meter.
    swing = backswing(Math.min(1, g.meterT / 0.45))
  } else if (g.phase === 'ai') {
    const think = AI_LEVELS[g.difficulty].thinkTime
    const k = ((g.ai?.elapsed ?? 0) - (think - AI_BACKSWING)) / AI_BACKSWING
    swing = k > 0 ? backswing(Math.min(1, k)) : waggle
  } else {
    // After the strike: 25% of the time swings down to the ball, the rest follows through.
    const k = (now - g.strikeAt) / (putting ? 500 : 380)
    swing = k < 0.25 ? -amp * (1 - k / 0.25) : amp * 1.1 * Math.min(1, (k - 0.25) / 0.75)
  }
  return {
    pos: g.phase === 'flight' ? g.shotStart : golfer.ball,
    heading: g.heading,
    swing,
    putting,
    visible,
  }
}

/** Ball position for golfer `i` (default: whoever's turn it is): the simulated ball in flight, otherwise its resting spot. */
const ballPosition = (g: GS, i = g.turn) => (g.phase === 'flight' && g.sim && i === g.turn ? g.sim.p : g.golfers[i].ball)

/** A ball is drawn once it is in play: not holed, and not waiting on the tee for its golfer's first shot. */
function ballVisible(g: GS, i: number) {
  const golfer = g.golfers[i]
  return g.phase !== 'holed' && !golfer.holed && (golfer.strokes > 0 || i === g.turn)
}

/** Renders the current hole and runs the game loop. `pv` is the shot preview (null when not planning). */
export function World({ g, pv }: { g: GS; pv: Preview | null }) {
  const balls = useRef<THREE.Mesh[]>([])
  const marker = useRef<THREE.Mesh>(null!)
  const { camera } = useThree()
  const camPos = useRef(new THREE.Vector3(0, 30, -60))
  const look = useRef(new THREE.Vector3(0, 0, 100))

  useFrame(({ clock }, dt) => {
    advanceGame(g, Math.min(dt, MAX_FRAME_DT))

    // Ball meshes. They are scaled up with distance so they stay visible from far away.
    g.golfers.forEach((_, i) => {
      const mesh = balls.current[i]
      const p = ballPosition(g, i)
      mesh.position.set(p[0], p[1] + 0.05, p[2])
      mesh.visible = ballVisible(g, i)
      mesh.scale.setScalar(Math.max(1, camera.position.distanceTo(mesh.position) / 22))
    })

    // Red marker floating above the AI's ball so its position is easy to spot.
    const aiBall = balls.current[OPPONENT]
    const s = aiBall.scale.x
    marker.current.position.set(aiBall.position.x, aiBall.position.y + 0.35 * s, aiBall.position.z)
    marker.current.scale.setScalar(s)
    marker.current.visible = aiBall.visible

    // Ease the camera toward its goal (exponential smoothing, frame-rate independent).
    const goal = cameraGoal(g, ballPosition(g), clock.elapsedTime)
    const k = 1 - Math.exp(-Math.min(dt, MAX_FRAME_DT) * goal.speed)
    camPos.current.lerp(goal.pos, k)
    look.current.lerp(goal.look, k)
    camera.position.copy(camPos.current)
    camera.lookAt(look.current)
  })

  const putting = g.club === PUTTER && g.phase !== 'flight'
  const planning = g.phase === 'plan' || g.phase === 'swing'
  return <>
    <Atmosphere focus={() => ballPosition(g)} />
    <Ocean />
    <Terrain hole={g.hole} />
    <Trees hole={g.hole} />
    <Flag hole={g.hole} />
    <TeeMarkers hole={g.hole} />
    {putting && <SlopeGrid hole={g.hole} />}
    {g.golfers.map((_, i) =>
      <mesh key={i} ref={m => { if (m) balls.current[i] = m }} castShadow>
        <sphereGeometry args={[0.06, 20, 16]} />
        <meshStandardMaterial color={ballColors(g)[i]} roughness={0.35} emissive={ballColors(g)[i]} emissiveIntensity={0.25} />
      </mesh>)}
    <mesh ref={marker} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[0.07, 0.18, 12]} />
      <meshBasicMaterial color="#ff3b3b" />
    </mesh>
    {g.golfers.map((_, i) => <Golfer key={i} colors={golferColors(g)[i]} get={() => golferPose(g, i)} />)}
    <Trail get={() => g.trail} />
    <Particles get={() => g.fx} />
    {pv && planning && <ShotPreview g={g} pv={pv} putting={putting} />}
  </>
}

/** Trajectory line plus, for full shots, the landing marker. */
function ShotPreview({ g, pv, putting }: { g: GS; pv: Preview; putting: boolean }) {
  const [w, l] = dispersionSize(g.club, pv.s.lie)
  return <>
    <PreviewLine pts={pv.pts} color={putting ? '#ffffff' : '#ffd23f'} />
    {pv.land && <LandingMarker pos={pv.land} heading={pv.s.heading} w={w} l={l} />}
  </>
}

/** Menu backdrop: a slow orbit around hole 3's green above the ocean. */
export function MenuWorld() {
  const hole = useMemo(() => buildHole(HOLES[2]), [])
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.06
    const [gx, gz] = hole.green
    camera.position.set(gx + Math.cos(t) * 110, 32, gz + Math.sin(t) * 110 - 40)
    camera.lookAt(gx, -6, gz)
  })
  return <>
    <Atmosphere focus={() => [hole.green[0], 0, hole.green[1]]} />
    <Ocean />
    <Terrain hole={hole} />
    <Trees hole={hole} />
    <Flag hole={hole} />
  </>
}
