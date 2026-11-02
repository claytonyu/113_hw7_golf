/**
 * The in-round screen: owns the game state, wires keyboard input to it, and
 * renders the 3D world, the HUD and the pause overlay.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { active, roundResult, type GS, type RoundResult } from '../game/game'
import { preview } from '../game/shot'
import { handleKeyDown } from '../game/input'
import { World } from '../render/world'
import { Hud } from './hud'
import { PauseOverlay } from './screens'

/** How often (ms) the shot preview is refreshed while not in flight. */
const PREVIEW_REFRESH_MS = 200

/**
 * Plays a nine-hole round against the AI. `init` creates the state (a new round or a resumed save).
 * `onExit` is called with both golfers' scores when the round ends or is abandoned;
 * `onSaveExit` leaves to the menu with the round kept for later.
 */
export function Play({ init, onExit, onSaveExit }: {
  init: () => GS
  onExit: (result: RoundResult) => void
  onSaveExit: () => void
}) {
  // The game state is created once and mutated in place; React never copies it.
  const g = useRef<GS | null>(null)
  if (!g.current) g.current = init()
  const gs = g.current

  // `ver` is bumped to force a re-render (and a fresh preview) after the state changes.
  const [ver, setVer] = useState(0)
  const [paused, setPaused] = useState(false)
  const refresh = () => setVer(v => v + 1)

  const pv = useMemo(
    () => (gs.phase === 'plan' || gs.phase === 'swing' ? preview(gs) : null),
    [ver, gs.phase, gs.idx, gs.turn, active(gs).ball[0], active(gs).ball[2], gs.club],
  )

  // Periodic refresh catches state changes made by the frame loop (e.g. intro ending).
  useEffect(() => {
    const t = setInterval(() => { if (gs.phase !== 'flight') refresh() }, PREVIEW_REFRESH_MS)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const actions = {
      refresh,
      togglePause: () => setPaused(p => !p),
      finishRound: onExit,
    }
    const down = (e: KeyboardEvent) => handleKeyDown(g.current!, e, actions)
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  return <div style={{ position: 'absolute', inset: 0 }}>
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 50, near: 0.05, far: 4000 }} gl={{ antialias: true }}>
      <World g={gs} pv={pv} />
    </Canvas>
    <Hud g={gs} />
    {paused && <PauseOverlay onSaveExit={onSaveExit} onQuit={() => onExit(roundResult(gs))} />}
  </div>
}
