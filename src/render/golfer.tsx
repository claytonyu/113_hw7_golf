/**
 * A simple low-poly golfer with a one-joint swing rig (arms and club rotate
 * around the shoulders).
 */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { dirOf } from '../course/course'

/** Where and how to draw the golfer this frame. `swing` is the arm rotation in radians. */
export interface GolferPose { pos: number[]; heading: number; swing: number; putting: boolean; visible: boolean }

/** Outfit and club-finish colors. */
export interface GolferColors { shirt: string; pants: string; cap: string; shaft: string; head: string }

const SKIN = '#e0b38c'

/**
 * Golfer standing to the left of the target line (right-handed), facing the ball.
 * `get` is polled every frame so the pose follows game state without React re-renders.
 */
export function Golfer({ get, colors }: { get: () => GolferPose; colors: GolferColors }) {
  const { shirt, pants, cap, shaft, head } = colors
  const root = useRef<THREE.Group>(null!)
  const arms = useRef<THREE.Group>(null!)
  useFrame(() => {
    const s = get()
    root.current.visible = s.visible
    if (!s.visible) return
    const [dx, dz] = dirOf(s.heading)
    const rx = -dz, rz = dx // unit vector to the right of the aim line
    const stance = s.putting ? 0.55 : 0.85 // stand closer to the ball when putting
    root.current.position.set(s.pos[0] - rx * stance, s.pos[1], s.pos[2] - rz * stance)
    root.current.rotation.y = Math.atan2(rx, rz)
    arms.current.rotation.z = s.swing
  })
  return <group ref={root}>
    {/* legs */}
    <mesh position={[0.14, 0.45, 0]} castShadow><capsuleGeometry args={[0.09, 0.7, 4, 8]} /><meshStandardMaterial color={pants} /></mesh>
    <mesh position={[-0.14, 0.45, 0]} castShadow><capsuleGeometry args={[0.09, 0.7, 4, 8]} /><meshStandardMaterial color={pants} /></mesh>
    {/* torso, head and cap, leaning forward */}
    <group position={[0, 0.95, 0]} rotation={[0.35, 0, 0]}>
      <mesh position={[0, 0.3, 0]} castShadow><capsuleGeometry args={[0.2, 0.42, 4, 10]} /><meshStandardMaterial color={shirt} /></mesh>
      <mesh position={[0, 0.78, 0.02]} castShadow><sphereGeometry args={[0.13, 16, 12]} /><meshStandardMaterial color={SKIN} /></mesh>
      <mesh position={[0, 0.86, 0.04]} castShadow><sphereGeometry args={[0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={cap} /></mesh>
      <mesh position={[0, 0.84, 0.15]} rotation={[0.2, 0, 0]}><boxGeometry args={[0.2, 0.02, 0.14]} /><meshStandardMaterial color={cap} /></mesh>
    </group>
    {/* swing pivot at the shoulders, tilted so the club reaches the ball */}
    <group position={[0, 1.38, 0.12]} rotation={[-0.42, 0, 0]}>
      <group ref={arms}>
        <mesh position={[0, -0.32, 0]} castShadow><capsuleGeometry args={[0.055, 0.55, 4, 8]} /><meshStandardMaterial color={shirt} /></mesh>
        <mesh position={[0, -0.66, 0]}><sphereGeometry args={[0.06, 10, 8]} /><meshStandardMaterial color="#fafafa" /></mesh>
        <mesh position={[0, -1.08, 0]} castShadow><cylinderGeometry args={[0.012, 0.012, 0.85]} /><meshStandardMaterial color={shaft} metalness={0.9} roughness={0.25} /></mesh>
        <mesh position={[0.05, -1.5, 0]} castShadow><boxGeometry args={[0.12, 0.05, 0.06]} /><meshStandardMaterial color={head} metalness={0.8} roughness={0.3} /></mesh>
      </group>
    </group>
  </group>
}
