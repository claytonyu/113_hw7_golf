import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sky, Environment } from '@react-three/drei'
import * as THREE from 'three'
import type { Hole } from './course'
import { dirOf } from './course'
import { grad } from './sim'

export const SUN = new THREE.Vector3(-120, 90, -160)

// ---------- procedural textures ----------
function grainTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')!
  const img = x.createImageData(256, 256)
  for (let i = 0; i < 256 * 256; i++) {
    const px = i % 256, py = (i / 256) | 0
    const v = 215 + Math.random() * 40 + 10 * Math.sin(px * 0.35) * Math.sin(py * 0.29)
    img.data.set([v, v, v, 255], i * 4)
  }
  x.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t
}
function waterNormals() {
  const N = 256; const data = new Uint8Array(N * N * 4)
  const waves = [[3, 1, 0.5, 0], [1, 4, 0.35, 1.3], [7, -3, 0.15, 2.1], [-5, 9, 0.1, 0.7], [13, 6, 0.06, 4.0]]
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N; let dx = 0, dy = 0
    for (const [kx, ky, a, ph] of waves) { const c = Math.cos(2 * Math.PI * (kx * u + ky * v) + ph) * a * 2 * Math.PI; dx += c * kx; dy += c * ky }
    const n = new THREE.Vector3(-dx * 0.02, -dy * 0.02, 1).normalize()
    data.set([(n.x * 0.5 + 0.5) * 255, (n.y * 0.5 + 0.5) * 255, (n.z * 0.5 + 0.5) * 255, 255], (j * N + i) * 4)
  }
  const t = new THREE.DataTexture(data, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t
}

// ---------- atmosphere ----------
export function Atmosphere({ focus }: { focus: () => number[] }) {
  const light = useRef<THREE.DirectionalLight>(null!)
  useFrame(() => {
    const f = focus(); const l = light.current
    l.position.set(f[0] + SUN.x * 0.6, f[1] + SUN.y * 0.6, f[2] + SUN.z * 0.6); l.target.position.set(f[0], f[1], f[2]); l.target.updateMatrixWorld()
  })
  return <>
    <Sky distance={2500} sunPosition={SUN.toArray()} turbidity={5} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.85} />
    <Environment frames={1} resolution={128}><Sky distance={400} sunPosition={SUN.toArray()} turbidity={5} rayleigh={1.2} /></Environment>
    <fog attach="fog" args={['#bcd9ec', 450, 1800]} />
    <hemisphereLight args={['#e6f4ff', '#4a6a34', 0.55]} />
    <directionalLight ref={light} intensity={2.4} color="#fff3dc" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.04}
      shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90} shadow-camera-near={1} shadow-camera-far={500} />
  </>
}

export function Ocean() {
  const tex = useMemo(waterNormals, [])
  useFrame((_, dt) => { tex.offset.x += dt * 0.004; tex.offset.y += dt * 0.0025 })
  useEffect(() => { tex.repeat.set(160, 160) }, [tex])
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -20.5, 300]}>
    <planeGeometry args={[6000, 6000]} />
    <meshStandardMaterial color="#1b6a8f" roughness={0.12} metalness={0.35} normalMap={tex} normalScale={new THREE.Vector2(0.6, 0.6)} envMapIntensity={1.2} />
  </mesh>
}

// ---------- terrain ----------
const COL = {
  green: new THREE.Color('#4fc25a'), fringe: new THREE.Color('#5fb54a'), fairA: new THREE.Color('#64b246'), fairB: new THREE.Color('#58a43e'),
  firstCut: new THREE.Color('#4a8f36'), rough: new THREE.Color('#3b7a2c'), deep: new THREE.Color('#2f6524'), sand: new THREE.Color('#f0e0b4'),
  tee: new THREE.Color('#6bbd4c'), rock: new THREE.Color('#c9a27a'), rock2: new THREE.Color('#a87d58'), beach: new THREE.Color('#e8d3a6'), oob: new THREE.Color('#8a8a52'), pond: new THREE.Color('#3f7f8f'),
}
export function Terrain({ hole }: { hole: Hole }) {
  const grain = useMemo(grainTexture, [])
  const geo = useMemo(() => {
    const xs = hole.path.map(p => p[0]), zs = hole.path.map(p => p[1])
    const x0 = Math.min(...xs) - 200, x1 = Math.max(...xs) + 200, z0 = Math.min(...zs) - 120, z1 = Math.max(...zs) + 140
    const res = 2.2, nx = Math.ceil((x1 - x0) / res), nz = Math.ceil((z1 - z0) / res)
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2)
    const pos = g.attributes.position as THREE.BufferAttribute; const col = new Float32Array(pos.count * 3); const c = new THREE.Color()
    const [gx, gz] = hole.green; const R = hole.def.greenR
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i); const y = hole.height(x, z); pos.setY(i, y)
      const lie = hole.lie(x, z); const pr = hole.project(x, z); const dg = Math.hypot(x - gx, z - gz)
      const n = Math.sin(x * 0.13) * Math.cos(z * 0.11) * 0.5 + Math.sin(x * 0.41 + z * 0.37) * 0.25
      const cliff = hole.def.ocean && pr.lat * hole.def.ocean.side > hole.def.ocean.dist + 1
      if (cliff && y < -17) c.copy(COL.beach)
      else if (cliff) c.copy(COL.rock).lerp(COL.rock2, 0.5 + 0.5 * Math.sin(y * 1.7 + n))
      else if (lie === 'green') c.copy(COL.green).offsetHSL(0, 0, (Math.floor((x - gx) / 2.5 + 100) % 2 ? 0.015 : -0.01))
      else if (lie === 'sand') c.copy(COL.sand).offsetHSL(0, 0, n * 0.03)
      else if (lie === 'water') c.copy(COL.pond)
      else if (dg < R + 2.5) c.copy(COL.fringe)
      else if (lie === 'tee') c.copy(COL.tee)
      else if (lie === 'fairway') { const stripe = Math.floor((pr.along + pr.lat * 0.4) / 11) % 2; c.copy(stripe ? COL.fairA : COL.fairB).offsetHSL(0, 0, n * 0.015) }
      else if (lie === 'oob') c.copy(COL.oob).lerp(COL.deep, 0.5 + n * 0.5)
      else { const t = Math.min(1, Math.max(0, (pr.dist - hole.def.width / 2) / 30)); c.copy(COL.firstCut).lerp(COL.rough, Math.min(1, t * 2)).lerp(COL.deep, Math.max(0, t - 0.5 + n * 0.3)) }
      col.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals()
    grain.repeat.set((x1 - x0) / 6, (z1 - z0) / 6)
    return g
  }, [hole, grain])
  return <mesh geometry={geo} receiveShadow><meshStandardMaterial vertexColors map={grain} roughness={0.95} metalness={0} /></mesh>
}

// ---------- vegetation ----------
export function Trees({ hole }: { hole: Hole }) {
  const data = useMemo(() => {
    let seed = hole.def.num * 977 + 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const trunks: THREE.Matrix4[] = [], crowns: THREE.Matrix4[] = [], crownCol: THREE.Color[] = [], bushes: THREE.Matrix4[] = []
    const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3()
    for (let i = 0; i < 1400 && trunks.length < 170; i++) {
      const segIdx = Math.floor(rnd() * (hole.path.length - 1)); const a = hole.path[segIdx], b = hole.path[segIdx + 1]; const t = rnd() * 1.15 - 0.05
      const dl = Math.hypot(b[0] - a[0], b[1] - a[1]); const rx = -(b[1] - a[1]) / dl, rz = (b[0] - a[0]) / dl
      const side = rnd() < 0.5 ? -1 : 1; const off = hole.def.width / 2 + 14 + Math.pow(rnd(), 0.7) * 80
      const x = a[0] + (b[0] - a[0]) * t + rx * off * side, z = a[1] + (b[1] - a[1]) * t + rz * off * side
      const lie = hole.lie(x, z); if (lie !== 'rough' && lie !== 'oob') continue
      if (Math.hypot(x - hole.green[0], z - hole.green[1]) < hole.def.greenR + 14 || Math.hypot(x, z) < 20) continue
      const y = hole.height(x, z); if (y < -3) continue
      if (rnd() < 0.35) { bushes.push(new THREE.Matrix4().compose(v.set(x, y + 0.4, z), q.setFromEuler(e.set(0, rnd() * 6, 0)), s.set(1.5 + rnd() * 2, 0.9 + rnd(), 1.5 + rnd() * 2))); continue }
      // Torrey pine: leaning trunk, wide flat clumped crown
      const hgt = 8 + rnd() * 7; const lx = (rnd() - 0.5) * 0.5, lz = (rnd() - 0.5) * 0.5
      trunks.push(new THREE.Matrix4().compose(v.set(x + lx * hgt * 0.25, y + hgt / 2, z + lz * hgt * 0.25), q.setFromEuler(e.set(lz, 0, -lx)), s.set(0.55, hgt, 0.55)))
      const cx = x + lx * hgt * 0.5, cz = z + lz * hgt * 0.5; const clumps = 3 + Math.floor(rnd() * 3)
      for (let k = 0; k < clumps; k++) {
        const ang = rnd() * Math.PI * 2, r = rnd() * 3.2
        crowns.push(new THREE.Matrix4().compose(v.set(cx + Math.cos(ang) * r, y + hgt - 0.5 + rnd() * 1.8, cz + Math.sin(ang) * r), q.setFromEuler(e.set(rnd() * 0.3, rnd() * 6, rnd() * 0.3)), s.set(2.2 + rnd() * 1.8, 1.1 + rnd() * 0.6, 2 + rnd() * 1.5)))
        crownCol.push(new THREE.Color().setHSL(0.3 + rnd() * 0.05, 0.4 + rnd() * 0.15, 0.17 + rnd() * 0.08))
      }
    }
    return { trunks, crowns, crownCol, bushes }
  }, [hole])
  const tr = useRef<THREE.InstancedMesh>(null!), cr = useRef<THREE.InstancedMesh>(null!), bu = useRef<THREE.InstancedMesh>(null!)
  useEffect(() => {
    data.trunks.forEach((m, i) => tr.current.setMatrixAt(i, m)); data.crowns.forEach((m, i) => { cr.current.setMatrixAt(i, m); cr.current.setColorAt(i, data.crownCol[i]) }); data.bushes.forEach((m, i) => bu.current.setMatrixAt(i, m))
    tr.current.instanceMatrix.needsUpdate = cr.current.instanceMatrix.needsUpdate = bu.current.instanceMatrix.needsUpdate = true
    if (cr.current.instanceColor) cr.current.instanceColor.needsUpdate = true
  }, [data])
  const k = hole.def.num
  return <>
    <instancedMesh key={'t' + k} ref={tr} args={[undefined, undefined, data.trunks.length]} castShadow><cylinderGeometry args={[0.35, 0.8, 1, 7]} /><meshStandardMaterial color="#6b4a33" roughness={0.9} /></instancedMesh>
    <instancedMesh key={'c' + k} ref={cr} args={[undefined, undefined, data.crowns.length]} castShadow><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial roughness={0.85} flatShading /></instancedMesh>
    <instancedMesh key={'b' + k} ref={bu} args={[undefined, undefined, data.bushes.length]} castShadow receiveShadow><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#5b7a3a" roughness={0.9} flatShading /></instancedMesh>
  </>
}

// ---------- props ----------
export function Flag({ hole }: { hole: Hole }) {
  const [x, z] = hole.pin; const y = hole.height(x, z)
  const cloth = useRef<THREE.Mesh>(null!)
  const base = useMemo(() => { const g = new THREE.PlaneGeometry(0.8, 0.5, 10, 4); g.translate(0.4, 0, 0); return g }, [])
  const orig = useMemo(() => (base.attributes.position.array as Float32Array).slice(), [base])
  const windAng = Math.atan2(hole.wind[0], hole.wind[2])
  useFrame(({ clock }) => {
    const p = base.attributes.position as THREE.BufferAttribute; const t = clock.elapsedTime
    for (let i = 0; i < p.count; i++) { const ox = orig[i * 3]; p.setZ(i, Math.sin(ox * 6 - t * 7) * 0.08 * ox) }
    p.needsUpdate = true
  })
  return <group position={[x, y, z]}>
    <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.13, 20]} /><meshBasicMaterial color="#0d0d0d" /></mesh>
    <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.13, 0.16, 24]} /><meshBasicMaterial color="#f5f5f5" /></mesh>
    <mesh position={[0, 1.25, 0]} castShadow><cylinderGeometry args={[0.02, 0.02, 2.5]} /><meshStandardMaterial color="#fafafa" /></mesh>
    <group position={[0, 2.25, 0]} rotation={[0, windAng - Math.PI / 2, 0]}>
      <mesh ref={cloth} geometry={base} castShadow><meshStandardMaterial color="#ff3b3b" side={THREE.DoubleSide} roughness={0.7} /></mesh>
    </group>
  </group>
}

export function TeeMarkers({ hole }: { hole: Hole }) {
  const [dx, dz] = dirOf(Math.atan2(-hole.path[1][0], hole.path[1][1])); const rx = -dz, rz = dx
  return <>{[-1, 1].map(s => { const x = rx * 3.5 * s, z = rz * 3.5 * s; return <mesh key={s} position={[x, hole.height(x, z) + 0.15, z]} castShadow><sphereGeometry args={[0.18, 16, 12]} /><meshStandardMaterial color="#2f7cff" roughness={0.3} /></mesh> })}</>
}

export function SlopeGrid({ hole }: { hole: Hole }) {
  const ref = useRef<THREE.LineSegments>(null!)
  const geo = useMemo(() => {
    const pts: number[] = [], cols: number[] = []; const [gx, gz] = hole.green; const R = hole.def.greenR + 1
    for (let x = -R; x <= R; x += 1.4) for (let z = -R; z <= R; z += 1.4) {
      if (x * x + z * z > R * R) continue
      const px = gx + x, pz = gz + z; const [sx, sz] = grad(hole, px, pz); const m = Math.hypot(sx, sz) || 1e-6
      const y = hole.height(px, pz) + 0.03; const L = Math.min(0.9, 0.2 + m * 22)
      const dx = -sx / m * L, dz = -sz / m * L
      const c = new THREE.Color().setHSL(0.55 - Math.min(0.55, m * 18), 0.9, 0.65)
      pts.push(px, y, pz, px + dx, y, pz + dz, px + dx, y, pz + dz, px + dx * 0.55 - dz * 0.3, y, pz + dz * 0.55 + dx * 0.3, px + dx, y, pz + dz, px + dx * 0.55 + dz * 0.3, y, pz + dz * 0.55 - dx * 0.3)
      for (let k = 0; k < 6; k++) cols.push(c.r, c.g, c.b)
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); return g
  }, [hole])
  useFrame(({ clock }) => { (ref.current.material as THREE.LineBasicMaterial).opacity = 0.55 + Math.sin(clock.elapsedTime * 3) * 0.2 })
  return <lineSegments ref={ref} geometry={geo}><lineBasicMaterial vertexColors transparent opacity={0.7} /></lineSegments>
}

// Golfer with a simple swing rig. Stands on the left of the target line (right-handed), facing the ball.
export function Golfer({ get }: { get: () => { pos: number[]; heading: number; swing: number; putting: boolean; visible: boolean } }) {
  const root = useRef<THREE.Group>(null!), arms = useRef<THREE.Group>(null!)
  useFrame(() => {
    const s = get(); root.current.visible = s.visible; if (!s.visible) return
    const [dx, dz] = dirOf(s.heading); const rx = -dz, rz = dx
    root.current.position.set(s.pos[0] - rx * (s.putting ? 0.55 : 0.85), s.pos[1], s.pos[2] - rz * (s.putting ? 0.55 : 0.85))
    root.current.rotation.y = Math.atan2(rx, rz)
    arms.current.rotation.z = s.swing
  })
  const shirt = '#1d3557', pants = '#f1f1f1', skin = '#e0b38c'
  return <group ref={root}>
    <mesh position={[0.14, 0.45, 0]} castShadow><capsuleGeometry args={[0.09, 0.7, 4, 8]} /><meshStandardMaterial color={pants} /></mesh>
    <mesh position={[-0.14, 0.45, 0]} castShadow><capsuleGeometry args={[0.09, 0.7, 4, 8]} /><meshStandardMaterial color={pants} /></mesh>
    <group position={[0, 0.95, 0]} rotation={[0.35, 0, 0]}>
      <mesh position={[0, 0.3, 0]} castShadow><capsuleGeometry args={[0.2, 0.42, 4, 10]} /><meshStandardMaterial color={shirt} /></mesh>
      <mesh position={[0, 0.78, 0.02]} castShadow><sphereGeometry args={[0.13, 16, 12]} /><meshStandardMaterial color={skin} /></mesh>
      <mesh position={[0, 0.86, 0.04]} castShadow><sphereGeometry args={[0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#e63946" /></mesh>
      <mesh position={[0, 0.84, 0.15]} rotation={[0.2, 0, 0]}><boxGeometry args={[0.2, 0.02, 0.14]} /><meshStandardMaterial color="#e63946" /></mesh>
    </group>
    {/* swing pivot at the shoulders, tilted so the club reaches the ball */}
    <group position={[0, 1.38, 0.12]} rotation={[-0.42, 0, 0]}>
      <group ref={arms}>
        <mesh position={[0, -0.32, 0]} castShadow><capsuleGeometry args={[0.055, 0.55, 4, 8]} /><meshStandardMaterial color={shirt} /></mesh>
        <mesh position={[0, -0.66, 0]}><sphereGeometry args={[0.06, 10, 8]} /><meshStandardMaterial color="#fafafa" /></mesh>
        <mesh position={[0, -1.08, 0]} castShadow><cylinderGeometry args={[0.012, 0.012, 0.85]} /><meshStandardMaterial color="#c0c6cc" metalness={0.9} roughness={0.25} /></mesh>
        <mesh position={[0.05, -1.5, 0]} castShadow><boxGeometry args={[0.12, 0.05, 0.06]} /><meshStandardMaterial color="#222831" metalness={0.8} roughness={0.3} /></mesh>
      </group>
    </group>
  </group>
}

export function Trail({ get }: { get: () => number[][] }) {
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 3000), 3)); g.setDrawRange(0, 0)
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.9 }))
  }, [])
  useFrame(() => {
    const pts = get(); const a = line.geometry.attributes.position as THREE.BufferAttribute; const n = Math.min(pts.length, 3000)
    for (let i = 0; i < n; i++) a.setXYZ(i, pts[i][0], pts[i][1] + 0.1, pts[i][2])
    a.needsUpdate = true; line.geometry.setDrawRange(0, n); line.geometry.computeBoundingSphere()
  })
  return <primitive object={line} />
}

export function Particles({ get }: { get: () => { p: number[]; v: number[]; life: number; max: number; c: number[] }[] }) {
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(600 * 3), 3)); return g }, [])
  useFrame((_, dt) => {
    const fx = get(); dt = Math.min(dt, 0.05)
    for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.life += dt; f.v[1] -= 9.8 * dt; f.p[0] += f.v[0] * dt; f.p[1] += f.v[1] * dt; f.p[2] += f.v[2] * dt; if (f.life > f.max) fx.splice(i, 1) }
    const pa = geo.attributes.position as THREE.BufferAttribute, ca = geo.attributes.color as THREE.BufferAttribute
    fx.forEach((f, i) => { pa.setXYZ(i, f.p[0], f.p[1], f.p[2]); const k = 1 - f.life / f.max; ca.setXYZ(i, f.c[0] * k + (1 - k) * 0.6, f.c[1] * k + (1 - k) * 0.6, f.c[2] * k + (1 - k) * 0.6) })
    pa.needsUpdate = ca.needsUpdate = true; geo.setDrawRange(0, fx.length); geo.computeBoundingSphere()
  })
  return <points geometry={geo}><pointsMaterial size={0.22} vertexColors transparent opacity={0.9} depthWrite={false} /></points>
}
