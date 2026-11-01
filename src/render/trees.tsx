/**
 * Torrey pines and bushes scattered through the rough, drawn with instanced
 * meshes for speed. Placement is seeded per hole, so it's the same every visit.
 */
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Hole } from '../course/course'

const MAX_TREES = 170
const MAX_ATTEMPTS = 1400

/** Instance transforms (and crown colors) for one hole's vegetation. */
interface Vegetation {
  trunks: THREE.Matrix4[]
  crowns: THREE.Matrix4[]
  crownCol: THREE.Color[]
  bushes: THREE.Matrix4[]
}

/** Deterministic pseudo-random generator (Park–Miller LCG) seeded by hole number. */
function seededRandom(holeNum: number) {
  let seed = holeNum * 977 + 13
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647
}

/**
 * Picks random spots beside the fairway and fills them with bushes or pines.
 * Spots must be in the rough or out of bounds, clear of the green and tee, and above the beach.
 * The order of rnd() calls matters: changing it changes every hole's trees.
 */
function scatterVegetation(hole: Hole): Vegetation {
  const rnd = seededRandom(hole.def.num)
  const veg: Vegetation = { trunks: [], crowns: [], crownCol: [], bushes: [] }
  for (let i = 0; i < MAX_ATTEMPTS && veg.trunks.length < MAX_TREES; i++) {
    // Choose a point along a random segment (slightly past either end), then step sideways off the fairway.
    const segIdx = Math.floor(rnd() * (hole.path.length - 1))
    const a = hole.path[segIdx], b = hole.path[segIdx + 1]
    const t = rnd() * 1.15 - 0.05
    const dl = Math.hypot(b[0] - a[0], b[1] - a[1])
    const rx = -(b[1] - a[1]) / dl, rz = (b[0] - a[0]) / dl
    const side = rnd() < 0.5 ? -1 : 1
    const off = hole.def.width / 2 + 14 + Math.pow(rnd(), 0.7) * 80
    const x = a[0] + (b[0] - a[0]) * t + rx * off * side
    const z = a[1] + (b[1] - a[1]) * t + rz * off * side

    const lie = hole.lie(x, z)
    if (lie !== 'rough' && lie !== 'oob') continue
    if (Math.hypot(x - hole.green[0], z - hole.green[1]) < hole.def.greenR + 14 || Math.hypot(x, z) < 20) continue
    const y = hole.height(x, z)
    if (y < -3) continue

    if (rnd() < 0.35) addBush(veg, rnd, x, y, z)
    else addPine(veg, rnd, x, y, z)
  }
  return veg
}

const q = new THREE.Quaternion(), euler = new THREE.Euler(), pos = new THREE.Vector3(), scale = new THREE.Vector3()

/** Builds a transform matrix from a position, Euler rotation and scale. */
function transform(p: [number, number, number], r: [number, number, number], s: [number, number, number]) {
  return new THREE.Matrix4().compose(pos.set(...p), q.setFromEuler(euler.set(...r)), scale.set(...s))
}

/** A low squashed bush with random rotation and size. */
function addBush(veg: Vegetation, rnd: () => number, x: number, y: number, z: number) {
  const rotY = rnd() * 6
  const sx = 1.5 + rnd() * 2, sy = 0.9 + rnd(), sz = 1.5 + rnd() * 2
  veg.bushes.push(transform([x, y + 0.4, z], [0, rotY, 0], [sx, sy, sz]))
}

/** A Torrey pine: a leaning trunk topped by a wide, flat crown made of 3-5 clumps. */
function addPine(veg: Vegetation, rnd: () => number, x: number, y: number, z: number) {
  const hgt = 8 + rnd() * 7
  const lx = (rnd() - 0.5) * 0.5, lz = (rnd() - 0.5) * 0.5 // lean
  veg.trunks.push(transform([x + lx * hgt * 0.25, y + hgt / 2, z + lz * hgt * 0.25], [lz, 0, -lx], [0.55, hgt, 0.55]))

  const cx = x + lx * hgt * 0.5, cz = z + lz * hgt * 0.5 // crown center follows the lean
  const clumps = 3 + Math.floor(rnd() * 3)
  for (let k = 0; k < clumps; k++) {
    const ang = rnd() * Math.PI * 2, r = rnd() * 3.2
    const cy = y + hgt - 0.5 + rnd() * 1.8
    const rot: [number, number, number] = [rnd() * 0.3, rnd() * 6, rnd() * 0.3]
    const size: [number, number, number] = [2.2 + rnd() * 1.8, 1.1 + rnd() * 0.6, 2 + rnd() * 1.5]
    veg.crowns.push(transform([cx + Math.cos(ang) * r, cy, cz + Math.sin(ang) * r], rot, size))
    veg.crownCol.push(new THREE.Color().setHSL(0.3 + rnd() * 0.05, 0.4 + rnd() * 0.15, 0.17 + rnd() * 0.08))
  }
}

/** Instanced trunks, crowns and bushes for the current hole. */
export function Trees({ hole }: { hole: Hole }) {
  const data = useMemo(() => scatterVegetation(hole), [hole])
  const tr = useRef<THREE.InstancedMesh>(null!)
  const cr = useRef<THREE.InstancedMesh>(null!)
  const bu = useRef<THREE.InstancedMesh>(null!)

  // Upload instance matrices and colors once per hole.
  useEffect(() => {
    data.trunks.forEach((m, i) => tr.current.setMatrixAt(i, m))
    data.crowns.forEach((m, i) => {
      cr.current.setMatrixAt(i, m)
      cr.current.setColorAt(i, data.crownCol[i])
    })
    data.bushes.forEach((m, i) => bu.current.setMatrixAt(i, m))
    tr.current.instanceMatrix.needsUpdate = true
    cr.current.instanceMatrix.needsUpdate = true
    bu.current.instanceMatrix.needsUpdate = true
    if (cr.current.instanceColor) cr.current.instanceColor.needsUpdate = true
  }, [data])

  // Keys force new instanced meshes when the hole (and so the instance count) changes.
  const k = hole.def.num
  return <>
    <instancedMesh key={'t' + k} ref={tr} args={[undefined, undefined, data.trunks.length]} castShadow>
      <cylinderGeometry args={[0.35, 0.8, 1, 7]} />
      <meshStandardMaterial color="#6b4a33" roughness={0.9} />
    </instancedMesh>
    <instancedMesh key={'c' + k} ref={cr} args={[undefined, undefined, data.crowns.length]} castShadow>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial roughness={0.85} flatShading />
    </instancedMesh>
    <instancedMesh key={'b' + k} ref={bu} args={[undefined, undefined, data.bushes.length]} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#5b7a3a" roughness={0.9} flatShading />
    </instancedMesh>
  </>
}
