// Central balancing config.
export interface Club { name: string; short: string; carry: number; launch: number; spin: number } // carry yds, launch deg, spin = lift coefficient
export const CLUBS: Club[] = [
  { name: 'Driver', short: 'DR', carry: 255, launch: 14.5, spin: 0.12 },
  { name: '3 Wood', short: '3W', carry: 230, launch: 15, spin: 0.13 },
  { name: '4 Iron', short: '4i', carry: 205, launch: 16.5, spin: 0.15 },
  { name: '5 Iron', short: '5i', carry: 192, launch: 17.5, spin: 0.16 },
  { name: '6 Iron', short: '6i', carry: 180, launch: 19, spin: 0.17 },
  { name: '7 Iron', short: '7i', carry: 167, launch: 20.5, spin: 0.18 },
  { name: '8 Iron', short: '8i', carry: 154, launch: 22.5, spin: 0.19 },
  { name: '9 Iron', short: '9i', carry: 141, launch: 25, spin: 0.2 },
  { name: 'P Wedge', short: 'PW', carry: 126, launch: 28, spin: 0.21 },
  { name: 'S Wedge', short: 'SW', carry: 100, launch: 32, spin: 0.22 },
  { name: 'Putter', short: 'PT', carry: 0, launch: 0, spin: 0 },
]
export const PUTTER = CLUBS.length - 1
export const LIE_CARRY: Record<string, number> = { tee: 1, fairway: 1, rough: 0.85, sand: 0.55, green: 1 }
export const LIE_ZONE: Record<string, number> = { tee: 1, fairway: 1, rough: 0.8, sand: 0.65, green: 1 }
export const METER = { period: 1.15, puttPeriod: 1.7, zone: 0.04, errDeg: 18, distLoss: 0.7 }
export const MAX_STROKES = 10
