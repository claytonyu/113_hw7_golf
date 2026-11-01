/**
 * The hole's ground mesh: a grid displaced by hole.height() and vertex-colored
 * by lie (fairway stripes, rough, sand, green, cliff rock, beach).
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import type { Hole } from '../course/course'
import { grainTexture } from './textures'

const COL = {
  green: new THREE.Color('#4fc25a'), fringe: new THREE.Color('#5fb54a'),
  fairA: new THREE.Color('#64b246'), fairB: new THREE.Color('#58a43e'),
  firstCut: new THREE.Color('#4a8f36'), rough: new THREE.Color('#3b7a2c'), deep: new THREE.Color('#2f6524'),
  sand: new THREE.Color('#f0e0b4'), tee: new THREE.Color('#6bbd4c'),
  rock: new THREE.Color('#c9a27a'), rock2: new THREE.Color('#a87d58'), beach: new THREE.Color('#e8d3a6'),
  oob: new THREE.Color('#8a8a52'), pond: new THREE.Color('#3f7f8f'),
}

/** Grid spacing of the terrain mesh in meters. */
const RESOLUTION = 2.2

/** Writes the ground color at (x, z), with terrain height y, into `c`. */
function terrainColor(hole: Hole, x: number, z: number, y: number, c: THREE.Color) {
  const [gx, gz] = hole.green
  const lie = hole.lie(x, z)
  const pr = hole.project(x, z)
  const dg = Math.hypot(x - gx, z - gz)
  const noise = Math.sin(x * 0.13) * Math.cos(z * 0.11) * 0.5 + Math.sin(x * 0.41 + z * 0.37) * 0.25
  const cliff = hole.def.ocean && pr.lat * hole.def.ocean.side > hole.def.ocean.dist + 1

  if (cliff && y < -17) c.copy(COL.beach)
  else if (cliff) c.copy(COL.rock).lerp(COL.rock2, 0.5 + 0.5 * Math.sin(y * 1.7 + noise)) // rock strata by height
  else if (lie === 'green') {
    // Alternating 2.5 m mowing stripes.
    const stripe = Math.floor((x - gx) / 2.5 + 100) % 2
    c.copy(COL.green).offsetHSL(0, 0, stripe ? 0.015 : -0.01)
  }
  else if (lie === 'sand') c.copy(COL.sand).offsetHSL(0, 0, noise * 0.03)
  else if (lie === 'water') c.copy(COL.pond)
  else if (dg < hole.def.greenR + 2.5) c.copy(COL.fringe)
  else if (lie === 'tee') c.copy(COL.tee)
  else if (lie === 'fairway') {
    // Diagonal 11 m mowing stripes.
    const stripe = Math.floor((pr.along + pr.lat * 0.4) / 11) % 2
    c.copy(stripe ? COL.fairA : COL.fairB).offsetHSL(0, 0, noise * 0.015)
  }
  else if (lie === 'oob') c.copy(COL.oob).lerp(COL.deep, 0.5 + noise * 0.5)
  else {
    // Rough darkens from first cut to deep rough over the 30 m beyond the fairway edge.
    const t = Math.min(1, Math.max(0, (pr.dist - hole.def.width / 2) / 30))
    c.copy(COL.firstCut).lerp(COL.rough, Math.min(1, t * 2)).lerp(COL.deep, Math.max(0, t - 0.5 + noise * 0.3))
  }
}

/** Builds the displaced, vertex-colored grid covering the hole plus a margin. */
function buildTerrainGeometry(hole: Hole) {
  const xs = hole.path.map(p => p[0]), zs = hole.path.map(p => p[1])
  const x0 = Math.min(...xs) - 200, x1 = Math.max(...xs) + 200
  const z0 = Math.min(...zs) - 120, z1 = Math.max(...zs) + 140
  const nx = Math.ceil((x1 - x0) / RESOLUTION), nz = Math.ceil((z1 - z0) / RESOLUTION)

  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz)
  g.rotateX(-Math.PI / 2)
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2)

  const pos = g.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    const y = hole.height(x, z)
    pos.setY(i, y)
    terrainColor(hole, x, z, y, c)
    colors.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return { geometry: g, width: x1 - x0, depth: z1 - z0 }
}

/** Ground mesh for one hole. Rebuilt only when the hole changes. */
export function Terrain({ hole }: { hole: Hole }) {
  const grain = useMemo(grainTexture, [])
  const geo = useMemo(() => {
    const { geometry, width, depth } = buildTerrainGeometry(hole)
    grain.repeat.set(width / 6, depth / 6) // one grain tile per 6 m
    return geometry
  }, [hole, grain])
  return <mesh geometry={geo} receiveShadow>
    <meshStandardMaterial vertexColors map={grain} roughness={0.95} metalness={0} />
  </mesh>
}
