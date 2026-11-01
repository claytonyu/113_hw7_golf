/**
 * Procedurally generated textures, so the game ships with no image assets.
 */
import * as THREE from 'three'

/** Subtle grayscale noise tiled over the terrain to give grass some grain. */
export function grainTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    const px = i % size, py = Math.floor(i / size)
    const v = 215 + Math.random() * 40 + 10 * Math.sin(px * 0.35) * Math.sin(py * 0.29)
    img.data.set([v, v, v, 255], i * 4)
  }
  ctx.putImageData(img, 0, 0)

  const t = new THREE.CanvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/**
 * Tileable ocean normal map built from a few summed sine waves.
 * Each wave is [kx, ky, amplitude, phase]; integer k values keep it seamless when tiled.
 */
export function waterNormals() {
  const N = 256
  const data = new Uint8Array(N * N * 4)
  const waves = [[3, 1, 0.5, 0], [1, 4, 0.35, 1.3], [7, -3, 0.15, 2.1], [-5, 9, 0.1, 0.7], [13, 6, 0.06, 4.0]]
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const u = i / N, v = j / N
      // Accumulate the surface slope (derivative of each wave).
      let dx = 0, dy = 0
      for (const [kx, ky, a, ph] of waves) {
        const c = Math.cos(2 * Math.PI * (kx * u + ky * v) + ph) * a * 2 * Math.PI
        dx += c * kx
        dy += c * ky
      }
      // Encode the normal from [-1, 1] into RGB [0, 255].
      const n = new THREE.Vector3(-dx * 0.02, -dy * 0.02, 1).normalize()
      data.set([(n.x * 0.5 + 0.5) * 255, (n.y * 0.5 + 0.5) * 255, (n.z * 0.5 + 0.5) * 255, 255], (j * N + i) * 4)
    }
  }
  const t = new THREE.DataTexture(data, N, N)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.needsUpdate = true
  return t
}
