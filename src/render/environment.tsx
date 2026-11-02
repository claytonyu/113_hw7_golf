/**
 * Sky, lighting, fog and ocean shared by every hole and the menu backdrop.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sky, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { waterNormals } from './textures'
import { OCEAN_Y } from '../config'

/** Sun direction (also used as an offset from the focus point to place the shadow light). */
export const SUN = new THREE.Vector3(-120, 90, -160)

/**
 * Sky, ambient light and a shadow-casting sun. The sun light follows `focus()`
 * (usually the ball) so its limited shadow area always covers the action.
 */
export function Atmosphere({ focus }: { focus: () => number[] }) {
  const light = useRef<THREE.DirectionalLight>(null!)
  useFrame(() => {
    const f = focus()
    const l = light.current
    l.position.set(f[0] + SUN.x * 0.6, f[1] + SUN.y * 0.6, f[2] + SUN.z * 0.6)
    l.target.position.set(f[0], f[1], f[2])
    l.target.updateMatrixWorld()
  })
  return <>
    <Sky distance={2500} sunPosition={SUN.toArray()} turbidity={5} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.85} />
    <Environment frames={1} resolution={128}>
      <Sky distance={400} sunPosition={SUN.toArray()} turbidity={5} rayleigh={1.2} />
    </Environment>
    <fog attach="fog" args={['#bcd9ec', 450, 1800]} />
    <hemisphereLight args={['#e6f4ff', '#4a6a34', 0.55]} />
    <directionalLight
      ref={light} intensity={2.4} color="#fff3dc" castShadow
      shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.04}
      shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90}
      shadow-camera-near={1} shadow-camera-far={500}
    />
  </>
}

/** A large flat ocean plane at y = OCEAN_Y with a slowly scrolling wave normal map. */
export function Ocean() {
  const tex = useMemo(waterNormals, [])
  useFrame((_, dt) => {
    tex.offset.x += dt * 0.004
    tex.offset.y += dt * 0.0025
  })
  useEffect(() => { tex.repeat.set(160, 160) }, [tex])
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, OCEAN_Y, 300]}>
    <planeGeometry args={[6000, 6000]} />
    <meshStandardMaterial
      color="#1b6a8f" roughness={0.12} metalness={0.35}
      normalMap={tex} normalScale={new THREE.Vector2(0.6, 0.6)} envMapIntensity={1.2}
    />
  </mesh>
}
