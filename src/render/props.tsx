/**
 * Small course objects: the flag and cup, tee markers, and the putting slope grid.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { dirOf, type Hole } from '../course/course'
import { grad } from '../sim/sim'

/** Cup, flagstick and a waving cloth that points downwind. */
export function Flag({ hole }: { hole: Hole }) {
  const [x, z] = hole.pin
  const y = hole.height(x, z)
  const cloth = useRef<THREE.Mesh>(null!)
  // Shift the cloth so its left edge sits on the pole.
  const base = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.8, 0.5, 10, 4)
    g.translate(0.4, 0, 0)
    return g
  }, [])
  const orig = useMemo(() => (base.attributes.position.array as Float32Array).slice(), [base])
  const windAng = Math.atan2(hole.wind[0], hole.wind[2])

  // Ripple: a traveling sine wave whose amplitude grows toward the free edge.
  useFrame(({ clock }) => {
    const p = base.attributes.position as THREE.BufferAttribute
    const t = clock.elapsedTime
    for (let i = 0; i < p.count; i++) {
      const ox = orig[i * 3]
      p.setZ(i, Math.sin(ox * 6 - t * 7) * 0.08 * ox)
    }
    p.needsUpdate = true
  })

  return <group position={[x, y, z]}>
    <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.13, 20]} />
      <meshBasicMaterial color="#0d0d0d" />
    </mesh>
    <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.13, 0.16, 24]} />
      <meshBasicMaterial color="#f5f5f5" />
    </mesh>
    <mesh position={[0, 1.25, 0]} castShadow>
      <cylinderGeometry args={[0.02, 0.02, 2.5]} />
      <meshStandardMaterial color="#fafafa" />
    </mesh>
    <group position={[0, 2.25, 0]} rotation={[0, windAng - Math.PI / 2, 0]}>
      <mesh ref={cloth} geometry={base} castShadow>
        <meshStandardMaterial color="#ff3b3b" side={THREE.DoubleSide} roughness={0.7} />
      </mesh>
    </group>
  </group>
}

/** Two blue tee markers either side of the tee, square to the first leg. */
export function TeeMarkers({ hole }: { hole: Hole }) {
  const [dx, dz] = dirOf(Math.atan2(-hole.path[1][0], hole.path[1][1]))
  const rx = -dz, rz = dx
  return <>{[-1, 1].map(side => {
    const x = rx * 3.5 * side, z = rz * 3.5 * side
    return <mesh key={side} position={[x, hole.height(x, z) + 0.15, z]} castShadow>
      <sphereGeometry args={[0.18, 16, 12]} />
      <meshStandardMaterial color="#2f7cff" roughness={0.3} />
    </mesh>
  })}</>
}

/** Spacing (m) between slope-grid arrows. */
const GRID_STEP = 1.4

/**
 * Arrow segments for the slope grid: each sample point gets an arrow pointing
 * downhill. Longer and warmer (blue -> red) arrows mean steeper slopes.
 */
function buildSlopeArrows(hole: Hole) {
  const pts: number[] = [], cols: number[] = []
  const [gx, gz] = hole.green
  const R = hole.def.greenR * 1.5 // covers stretched oval greens; points off the green are skipped below
  for (let x = -R; x <= R; x += GRID_STEP) {
    for (let z = -R; z <= R; z += GRID_STEP) {
      const px = gx + x, pz = gz + z
      if (hole.greenDist(px, pz) > hole.def.greenR + 1) continue
      const [sx, sz] = grad(hole, px, pz)
      const m = Math.hypot(sx, sz) || 1e-6
      const y = hole.height(px, pz) + 0.03
      const L = Math.min(0.9, 0.2 + m * 22)
      const dx = -sx / m * L, dz = -sz / m * L // downhill, length L
      const tipX = px + dx, tipZ = pz + dz
      // Shaft, then the two arrowhead barbs.
      pts.push(
        px, y, pz, tipX, y, tipZ,
        tipX, y, tipZ, px + dx * 0.55 - dz * 0.3, y, pz + dz * 0.55 + dx * 0.3,
        tipX, y, tipZ, px + dx * 0.55 + dz * 0.3, y, pz + dz * 0.55 - dx * 0.3,
      )
      const c = new THREE.Color().setHSL(0.55 - Math.min(0.55, m * 18), 0.9, 0.65)
      for (let k = 0; k < 6; k++) cols.push(c.r, c.g, c.b)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
  return g
}

/** Pulsing grid of downhill arrows over the green, shown while putting. */
export function SlopeGrid({ hole }: { hole: Hole }) {
  const ref = useRef<THREE.LineSegments>(null!)
  const geo = useMemo(() => buildSlopeArrows(hole), [hole])
  useFrame(({ clock }) => {
    (ref.current.material as THREE.LineBasicMaterial).opacity = 0.55 + Math.sin(clock.elapsedTime * 3) * 0.2
  })
  return <lineSegments ref={ref} geometry={geo}>
    <lineBasicMaterial vertexColors transparent opacity={0.7} />
  </lineSegments>
}
