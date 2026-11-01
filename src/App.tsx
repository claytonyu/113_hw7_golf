/**
 * Top-level screen switcher: main menu -> round -> end-of-round scorecard -> menu.
 * The menu and end screens share an orbiting 3D backdrop.
 */
import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { MenuWorld } from './render/world'
import { Play } from './ui/play'
import { MainMenu, EndScreen } from './ui/screens'
import { sfx, unlockAudio } from './sound'
import { loadDifficulty, saveDifficulty } from './settings'
import type { Difficulty } from './config'
import type { RoundResult } from './game/game'

type Screen =
  | { s: 'menu' }
  | { s: 'play'; nine: number; key: number } // `key` remounts Play so each round starts fresh
  | { s: 'end'; result: RoundResult }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ s: 'menu' })
  const [difficulty, setDifficulty] = useState<Difficulty>(loadDifficulty)

  if (screen.s === 'play') {
    return <Play key={screen.key} nine={screen.nine} difficulty={difficulty} onExit={result => setScreen({ s: 'end', result })} />
  }

  const startRound = (nine: number) => {
    unlockAudio()
    sfx.click()
    setScreen({ s: 'play', nine, key: Date.now() })
  }
  const chooseDifficulty = (d: Difficulty) => {
    sfx.click()
    setDifficulty(d)
    saveDifficulty(d)
  }

  return <div style={{ position: 'absolute', inset: 0 }}>
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 45, near: 0.1, far: 4000 }}><MenuWorld /></Canvas>
    <div className="vignette" />
    {screen.s === 'menu' && <MainMenu difficulty={difficulty} onDifficulty={chooseDifficulty} onPlay={startRound} />}
    {screen.s === 'end' && <EndScreen result={screen.result} onMenu={() => setScreen({ s: 'menu' })} />}
  </div>
}
