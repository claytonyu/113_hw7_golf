/**
 * Coin display pieces shared by the HUD, menu, shop and end screen:
 * an inline amount, a balance counter, and floating "+30 Birdie" popups.
 */
import { useEffect, useState } from 'react'
import type { RewardLine } from '../progress/rewards'

/** How long one popup stays on screen (ms); matches the coin-pop CSS animation. */
export const POPUP_MS = 2800

/** Coin amount with a coin symbol. */
export const Coins = ({ n }: { n: number }) => <span className="coins">◉ {n.toLocaleString()}</span>

/** Balance panel. It pulses briefly whenever the amount goes up. */
export function CoinCounter({ coins }: { coins: number }) {
  const [last, setLast] = useState(coins)
  const [bumpAt, setBumpAt] = useState(0)
  useEffect(() => {
    if (coins > last) setBumpAt(Date.now())
    setLast(coins)
  }, [coins])
  return <div key={bumpAt} className={`glass coinbox ${bumpAt ? 'bump' : ''}`}>
    <div className="label">Coins</div>
    <Coins n={coins} />
  </div>
}

/** One popup to show; `delay` (ms) staggers several that arrive together. */
export interface PopupItem extends RewardLine { id: string; delay?: number }

/** Floating "+coins label" popups that rise and fade out. */
export function CoinPopups({ items }: { items: PopupItem[] }) {
  return <div className="coinpops">
    {items.map(it =>
      <div key={it.id} className="coinpop" style={{ animationDelay: `${it.delay ?? 0}ms` }}>
        <span className="coins">+◉ {it.coins}</span> {it.label}
      </div>)}
  </div>
}
