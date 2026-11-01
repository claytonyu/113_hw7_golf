/**
 * Shot-planning overlays in the 3D scene: the dashed trajectory line and the
 * landing marker with its shaded dispersion ellipse.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

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
 * First-contact marker: a pulsing red ring on the predicted landing point inside
 * a yellow ellipse (w x l meters) oriented along the shot heading.
 */
export function LandingMarker({ pos, heading, w, l }: { pos: number[]; heading: number; w: number; l: number }) {
  const ring = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.12
    ring.current.scale.set(s, s, 1)
  })
  return <group position={[pos[0], pos[1] + 0.1, pos[2]]} rotation={[-Math.PI / 2, 0, -heading]}>
    <mesh scale={[w, l, 1]}>
      <circleGeometry args={[1, 40]} />
      <meshBasicMaterial color="#ffd23f" transparent opacity={0.22} depthWrite={false} />
    </mesh>
    <mesh scale={[w, l, 1]}>
      <ringGeometry args={[0.96, 1, 48]} />
      <meshBasicMaterial color="#ffd23f" transparent opacity={0.6} depthWrite={false} />
    </mesh>
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
