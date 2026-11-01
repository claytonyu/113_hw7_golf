/**
 * Visual effects drawn from game-state arrays: the ball's flight trail and
 * impact particles. Both use preallocated GPU buffers updated every frame.
 */
import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Particle } from '../game/game'

const MAX_TRAIL_POINTS = 3000
const MAX_PARTICLES = 600
const PARTICLE_GRAVITY = 9.8

/** Yellow line through the points the ball has travelled this shot. */
export function Trail({ get }: { get: () => number[][] }) {
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * MAX_TRAIL_POINTS), 3))
    g.setDrawRange(0, 0)
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.9 }))
  }, [])
  useFrame(() => {
    const pts = get()
    const attr = line.geometry.attributes.position as THREE.BufferAttribute
    const n = Math.min(pts.length, MAX_TRAIL_POINTS)
    for (let i = 0; i < n; i++) attr.setXYZ(i, pts[i][0], pts[i][1] + 0.1, pts[i][2])
    attr.needsUpdate = true
    line.geometry.setDrawRange(0, n)
    line.geometry.computeBoundingSphere()
  })
  return <primitive object={line} />
}

/**
 * Point sprites for impact particles. Also simulates them: gravity, motion,
 * fading toward gray, and removal from the shared array when they expire.
 */
export function Particles({ get }: { get: () => Particle[] }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3))
    return g
  }, [])
  useFrame((_, dt) => {
    const fx = get()
    dt = Math.min(dt, 0.05)
    // Iterate backwards so splicing doesn't skip elements.
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]
      f.life += dt
      f.v[1] -= PARTICLE_GRAVITY * dt
      f.p[0] += f.v[0] * dt
      f.p[1] += f.v[1] * dt
      f.p[2] += f.v[2] * dt
      if (f.life > f.max) fx.splice(i, 1)
    }
    const pa = geo.attributes.position as THREE.BufferAttribute
    const ca = geo.attributes.color as THREE.BufferAttribute
    fx.forEach((f, i) => {
      pa.setXYZ(i, f.p[0], f.p[1], f.p[2])
      const k = 1 - f.life / f.max // 1 when fresh, 0 when expiring
      const gray = (1 - k) * 0.6
      ca.setXYZ(i, f.c[0] * k + gray, f.c[1] * k + gray, f.c[2] * k + gray)
    })
    pa.needsUpdate = ca.needsUpdate = true
    geo.setDrawRange(0, fx.length)
    geo.computeBoundingSphere()
  })
  return <points geometry={geo}>
    <pointsMaterial size={0.22} vertexColors transparent opacity={0.9} depthWrite={false} />
  </points>
}
