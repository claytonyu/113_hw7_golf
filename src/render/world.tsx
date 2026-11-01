/**
 * The 3D scenes. `World` renders a hole during play and drives the per-frame
 * update (game loop, ball mesh, camera). `MenuWorld` is the slowly orbiting
 * backdrop behind the main menu.
 */
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HOLES } from '../course/holes'
import { buildHole } from '../course/course'
import { PUTTER } from '../config'
import type { GS } from '../game/game'
import { advanceGame } from '../game/loop'
import { dispersionSize, type Preview } from '../game/shot'
import { cameraGoal } from './camera'
import { Atmosphere, Ocean } from './environment'
import { Terrain } from './terrain'
import { Trees } from './trees'
import { Flag, TeeMarkers, SlopeGrid } from './props'
import { Golfer, type GolferPose } from './golfer'
import { Trail, Particles } from './fx'
import { PreviewLine, LandingMarker } from './preview'

/** Longest frame step (s) fed to the game, so a stalled tab doesn't jump the simulation. */
const MAX_FRAME_DT = 0.05

/** Golfer pose: idle waggle while planning, backswing with the meter, then downswing and follow-through. */
function golferPose(g: GS): GolferPose {
  const now = performance.now()
  const putting = g.club === PUTTER
  const amp = putting ? 0.45 : 2.5 // backswing size in radians
  let swing: number
  if (g.phase === 'plan' || g.phase === 'intro') {
    swing = Math.sin(now / 400) * 0.03
  } else if (g.phase === 'swing') {
    // The backswing eases out over the first 45% of the meter.
    const k = Math.min(1, g.meterT / 0.45)
    swing = -amp * (1 - (1 - k) * (1 - k))
  } else {
    // After the strike: 25% of the time swings down to the ball, the rest follows through.
    const k = (now - g.strikeAt) / (putting ? 500 : 380)
    swing = k < 0.25 ? -amp * (1 - k / 0.25) : amp * 1.1 * Math.min(1, (k - 0.25) / 0.75)
  }
  return {
    pos: g.phase === 'flight' ? g.shotStart : g.ball,
    heading: g.heading,
    swing,
    putting,
    visible: g.phase !== 'holed',
  }
}

/** The ball's current position: the simulated ball in flight, otherwise its resting spot. */
const ballPosition = (g: GS) => (g.phase === 'flight' && g.sim ? g.sim.p : g.ball)

/** Renders the current hole and runs the game loop. `pv` is the shot preview (null when not planning). */
export function World({ g, pv }: { g: GS; pv: Preview | null }) {
  const ball = useRef<THREE.Mesh>(null!)
  const { camera } = useThree()
  const camPos = useRef(new THREE.Vector3(0, 30, -60))
  const look = useRef(new THREE.Vector3(0, 0, 100))

  useFrame(({ clock }, dt) => {
    advanceGame(g, Math.min(dt, MAX_FRAME_DT))
    const p = ballPosition(g)

    // Ball mesh. It is scaled up with distance so it stays visible from far away.
    ball.current.position.set(p[0], p[1] + 0.05, p[2])
    ball.current.visible = g.phase !== 'holed'
    ball.current.scale.setScalar(Math.max(1, camera.position.distanceTo(ball.current.position) / 22))

    // Ease the camera toward its goal (exponential smoothing, frame-rate independent).
    const goal = cameraGoal(g, p, clock.elapsedTime)
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
    <mesh ref={ball} castShadow>
      <sphereGeometry args={[0.06, 20, 16]} />
      <meshStandardMaterial color="#ffffff" roughness={0.35} emissive="#ffffff" emissiveIntensity={0.25} />
    </mesh>
    <Golfer get={() => golferPose(g)} />
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
