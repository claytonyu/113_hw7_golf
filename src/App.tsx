/**
 * Top-level screen switcher: main menu <-> Pro Shop, menu -> round ->
 * end-of-round scorecard and rewards -> menu, plus resuming a saved round.
 * Owns the player's profile (coins, gear, records) and saves it whenever it changes.
 * The menu, shop and end screens share an orbiting 3D backdrop.
 */
import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { MenuWorld } from './render/world'
import { Play } from './ui/play'
import { Shop } from './ui/shop'
import { MainMenu, EndScreen } from './ui/screens'
import { sfx, unlockAudio } from './sound'
import { loadDifficulty, saveDifficulty } from './settings'
import { loadProfile, saveProfile, type Profile } from './progress/profile'
import { applyRewards, computeRewards, type RoundRewards } from './progress/rewards'
import { roundSetup } from './progress/setup'
import type { Difficulty } from './config'
import { newGame, type GS, type RoundResult } from './game/game'
import { resumeGame } from './game/resume'
import { clearRound, loadRound, type RoundSave } from './progress/roundSave'

type Screen =
  | { s: 'menu' }
  | { s: 'shop' }
  | { s: 'play'; key: number; init: () => GS } // `key` remounts Play so each round starts fresh
  | { s: 'end'; result: RoundResult; rewards: RoundRewards }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ s: 'menu' })
  const [difficulty, setDifficulty] = useState<Difficulty>(loadDifficulty)
  const [profile, setProfile] = useState<Profile>(loadProfile)
  const [saved, setSaved] = useState<RoundSave | null>(loadRound)

  /** Saves and shows an updated profile. */
  const updateProfile = (p: Profile) => {
    saveProfile(p)
    setProfile(p)
  }

  /**
   * Round over (finished or quit). Re-reads the saved profile first, because
   * consumables spent and hole coins earned during the round were saved directly.
   * Round bonuses are paid once per round id (applyRewards ignores ids already paid).
   */
  const endRound = (result: RoundResult) => {
    clearRound()
    setSaved(null)
    const current = loadProfile()
    const rewards = computeRewards(current, result)
    updateProfile(applyRewards(current, result, rewards))
    if (rewards.total > 0) sfx.coin()
    setScreen({ s: 'end', result, rewards })
  }

  if (screen.s === 'play') {
    // Save & exit: the round is already saved at the last turn boundary; just refresh the menu's copy.
    const saveExit = () => { setProfile(loadProfile()); setSaved(loadRound()); setScreen({ s: 'menu' }) }
    return <Play key={screen.key} init={screen.init} onExit={endRound} onSaveExit={saveExit} />
  }

  /** Starts a new round, first confirming if it would replace a saved one. */
  const startRound = (nine: number) => {
    if (saved && !window.confirm('Starting a new round will abandon your saved round. Continue?')) return
    unlockAudio()
    sfx.click()
    clearRound()
    setSaved(null)
    const setup = roundSetup(profile)
    setScreen({ s: 'play', key: Date.now(), init: () => newGame(nine, difficulty, setup) })
  }
  /** Resumes the saved round with the current coin balance. */
  const resumeRound = () => {
    const save = loadRound()
    if (!save) { setSaved(null); return }
    unlockAudio()
    sfx.click()
    setScreen({ s: 'play', key: Date.now(), init: () => resumeGame(save, loadProfile().coins) })
  }
  const chooseDifficulty = (d: Difficulty) => {
    sfx.click()
    setDifficulty(d)
    saveDifficulty(d)
  }
  const toMenu = () => setScreen({ s: 'menu' })

  return <div style={{ position: 'absolute', inset: 0 }}>
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 45, near: 0.1, far: 4000 }}><MenuWorld /></Canvas>
    <div className="vignette" />
    {screen.s === 'menu' && <MainMenu profile={profile} saved={saved} onResume={resumeRound} difficulty={difficulty} onDifficulty={chooseDifficulty} onPlay={startRound} onShop={() => { sfx.click(); setScreen({ s: 'shop' }) }} />}
    {screen.s === 'shop' && <Shop profile={profile} onChange={updateProfile} onBack={toMenu} />}
    {screen.s === 'end' && <EndScreen result={screen.result} rewards={screen.rewards} coins={profile.coins} onMenu={toMenu} />}
  </div>
}
