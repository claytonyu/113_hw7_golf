/**
 * Renders a top-down hole map into an image by sampling hole.lie() per pixel,
 * plus a function mapping world coordinates to map pixels.
 */
import { useMemo } from 'react'
import { CLIFF_LIP, type Hole } from '../course/course'

const LIE_RGB: Record<string, number[]> = {
  green: [79, 210, 90], fairway: [100, 178, 70], tee: [100, 178, 70], rough: [52, 110, 42],
  sand: [240, 224, 180], water: [40, 120, 160], hazard: [150, 118, 80], oob: [38, 70, 40],
}
const CLIFF_RGB = [190, 155, 115]

const MAP_WIDTH = 150  // target width in pixels
const MAX_HEIGHT = 300 // cap for long holes; the width shrinks to keep the aspect ratio

export interface Minimap {
  url: string   // data URL of the rendered image
  Wc: number    // image width in pixels
  Hc: number    // image height in pixels
  map: (x: number, z: number) => [number, number] // world (x, z) -> pixel (px, py)
}

/** World-space bounds of the map: the hole's path plus some padding. */
function mapBounds(h: Hole) {
  const xs = h.path.map(p => p[0]), zs = h.path.map(p => p[1])
  const pad = 55
  return {
    x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad,
    z0: Math.min(...zs) - 20, z1: Math.max(...zs) + 30,
  }
}

/**
 * Draws the minimap for a hole. The tee is at the bottom and the hole plays up the image.
 * Both axes are flipped: larger z is higher on screen, and larger x is further left
 * (positive headings turn right, toward -x).
 */
export function renderMinimap(h: Hole): Minimap {
  const { x0, x1, z0, z1 } = mapBounds(h)
  const naturalHeight = Math.round(MAP_WIDTH * (z1 - z0) / (x1 - x0))
  const Hc = Math.min(naturalHeight, MAX_HEIGHT)
  const sc = Hc / (z1 - z0) // pixels per meter
  const Wc = Math.round((x1 - x0) * sc)

  const canvas = document.createElement('canvas')
  canvas.width = Wc
  canvas.height = Hc
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(Wc, Hc)
  for (let j = 0; j < Hc; j++) {
    for (let i = 0; i < Wc; i++) {
      // Sample at the pixel's center so the image lines up with map() (used for the ball, pin and lines).
      const x = x1 - (i + 0.5) / sc, z = z1 - (j + 0.5) / sc
      const lie = h.lie(x, z)
      const cliff = h.def.ocean && h.project(x, z).lat * h.def.ocean.side > h.def.ocean.dist + CLIFF_LIP
      const rgb = cliff && lie !== 'water' ? CLIFF_RGB : LIE_RGB[lie]
      img.data.set([rgb[0], rgb[1], rgb[2], 255], (j * Wc + i) * 4)
    }
  }
  ctx.putImageData(img, 0, 0)

  return {
    url: canvas.toDataURL(),
    Wc,
    Hc,
    map: (x: number, z: number) => [(x1 - x) * sc, (z1 - z) * sc],
  }
}

/** Memoized minimap for the current hole (rendering samples tens of thousands of points). */
export function useMinimap(h: Hole): Minimap {
  return useMemo(() => renderMinimap(h), [h])
}
