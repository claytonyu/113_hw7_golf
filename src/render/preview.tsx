/**
 * Shot-planning overlays in the 3D scene: the dashed trajectory line and the
 * landing marker with its shaded dispersion ellipse.
 */
import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Spread } from '../game/shot'

/** Dashed line through the preview points. */
export function PreviewLine({ pts, color }: { pts: THREE.Vector3[]; color: string }) {
  const line = useMemo(() => {
    const material = new THREE.LineDashedMaterial({ color, dashSize: 1.2, gapSize: 0.7, transparent: true, opacity: 0.95 })
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material)
    l.computeLineDistances() // required for dashes to render
    return l
  }, [pts, color])
  return <primitive object={line} />
}

/**
 * First-contact marker: a pulsing red ring on the predicted landing point, plus
 * the yellow dispersion ellipse (simulated mistimed strikes, see shot.ts) oriented along the shot heading.
 */
export function LandingMarker({ pos, heading, spread }: { pos: number[]; heading: number; spread: Spread }) {
  const ring = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.12
    ring.current.scale.set(s, s, 1)
  })
  const rot: [number, number, number] = [-Math.PI / 2, 0, -heading]
  const [w, l] = [spread.w / 2, spread.l / 2] // ellipse radii
  return <>
    <group position={[spread.c[0], spread.c[1] + 0.1, spread.c[2]]} rotation={rot}>
      <mesh scale={[w, l, 1]}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial color="#ffd23f" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh scale={[w, l, 1]}>
        <ringGeometry args={[0.96, 1, 48]} />
        <meshBasicMaterial color="#ffd23f" transparent opacity={0.6} depthWrite={false} />
      </mesh>
    </group>
    <LandingRing pos={pos} rot={rot} ring={ring} />
  </>
}

/** The pulsing red first-contact ring and dot. */
function LandingRing({ pos, rot, ring }: { pos: number[]; rot: [number, number, number]; ring: RefObject<THREE.Mesh> }) {
  return <group position={[pos[0], pos[1] + 0.12, pos[2]]} rotation={rot}>
    <mesh ref={ring}>
      <ringGeometry args={[0.8, 1.15, 32]} />
      <meshBasicMaterial color="#ff4d6d" />
    </mesh>
    <mesh>
      <circleGeometry args={[0.25, 16]} />
      <meshBasicMaterial color="#ff4d6d" />
    </mesh>
  </group>
}
