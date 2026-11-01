/**
 * Cosmetic reactions to ground contact: particle bursts and impact sounds.
 * Nothing here affects the physics.
 */
import { sfx } from '../sound'
import type { Ball } from '../sim/sim'
import type { GS } from './game'

type RGB = [number, number, number]

const MAX_PARTICLES = 600
const SPLASH: RGB = [0.85, 0.95, 1]
const SAND: RGB = [0.93, 0.85, 0.62]
const GREEN_GRASS: RGB = [0.45, 0.85, 0.4]
const GRASS: RGB = [0.35, 0.6, 0.25]

/** Spawns `n` particles at `p`, flying outward up to `spread` m/s and upward around `up` m/s. */
function burst(g: GS, p: number[], n: number, c: RGB, spread: number, up: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const r = Math.random() * spread
    g.fx.push({
      p: [p[0], p[1] + 0.05, p[2]],
      v: [Math.cos(a) * r, up * (0.5 + Math.random()), Math.sin(a) * r],
      life: 0,
      max: 0.6 + Math.random() * 0.8,
      c,
    })
  }
  // Drop the oldest particles beyond the cap.
  if (g.fx.length > MAX_PARTICLES) g.fx.splice(0, g.fx.length - MAX_PARTICLES)
}

/** Plays the splash, sand or grass effect for a ball touching down. Soft grass touches (under 4 m/s) are silent. */
export function onContact(g: GS, b: Ball) {
  const lie = g.hole.lie(b.p[0], b.p[2])
  const speed = Math.hypot(...b.v)
  if (b.mode === 'water') {
    burst(g, b.p, 80, SPLASH, 2.5, 7)
    sfx.splash()
    return
  }
  if (lie === 'sand') {
    burst(g, b.p, 45, SAND, 3, 4)
    sfx.sand()
  } else if (speed > 4) {
    burst(g, b.p, 14, lie === 'green' ? GREEN_GRASS : GRASS, 1.5, 2.5)
    sfx.thud()
  }
}
