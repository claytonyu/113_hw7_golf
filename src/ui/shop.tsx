/**
 * The Pro Shop screen (mouse controlled): buy and equip permanent equipment,
 * buy consumable charges and pack up to three into the bag for the next
 * round, and buy and equip cosmetics.
 */
import { useState } from 'react'
import {
  BALL_COLORS, CLUB_FINISHES, CONSUMABLES, EQUIPMENT, EQUIP_SLOTS, MAX_CHARGES, OUTFITS,
  type ConsumableId, type Cosmetic,
} from '../config'
import {
  buyConsumable, buyItem, equipItem, owns, setLoadoutSlot, type Profile,
} from '../progress/profile'
import { sfx } from '../sound'
import { Coins } from './coins'

type Tab = 'equipment' | 'consumables' | 'cosmetics'
const TABS: { id: Tab; label: string }[] = [
  { id: 'equipment', label: 'Equipment' },
  { id: 'consumables', label: 'Consumables & Bag' },
  { id: 'cosmetics', label: 'Cosmetics' },
]

export function Shop({ profile, onChange, onBack }: {
  profile: Profile
  onChange: (p: Profile) => void // called with the updated profile after a successful action
  onBack: () => void
}) {
  const [tab, setTab] = useState<Tab>('equipment')
  const [message, setMessage] = useState('')

  /** Runs a shop operation; shows `fail` if it isn't allowed. */
  const act = (next: Profile | null, ok: string, fail: string) => {
    if (next) { onChange(next); setMessage(ok); sfx.click() }
    else setMessage(fail)
  }

  return <div className="overlay"><div className="glass shop">
    <div className="shop-head">
      <h2 style={{ margin: 0 }}>Pro Shop</h2>
      <Coins n={profile.coins} />
    </div>
    <div className="tabs">
      {TABS.map(t => <button key={t.id} className={`diff ${tab === t.id ? 'on' : ''}`} onClick={() => { setTab(t.id); setMessage('') }}>{t.label}</button>)}
    </div>
    <div className="shop-body">
      {tab === 'equipment' && <EquipmentTab profile={profile} act={act} />}
      {tab === 'consumables' && <ConsumablesTab profile={profile} act={act} />}
      {tab === 'cosmetics' && <CosmeticsTab profile={profile} act={act} />}
    </div>
    <div className="shop-foot">
      <span style={{ color: 'var(--dim)', fontSize: 13 }}>{message}</span>
      <button className="btn" onClick={onBack}>Back to menu</button>
    </div>
  </div></div>
}

type Act = (next: Profile | null, ok: string, fail: string) => void

/** Buy / Equip / Equipped button for an equipment or cosmetic item. */
function ItemButton({ profile, id, name, price, equipped, act }: {
  profile: Profile; id: string; name: string; price: number; equipped: boolean; act: Act
}) {
  if (equipped) return <button className="buy" disabled>Equipped</button>
  if (owns(profile, id)) return <button className="buy" onClick={() => act(equipItem(profile, id), `${name} equipped`, '')}>Equip</button>
  const short = profile.coins < price
  return <button className="buy primary" disabled={short} onClick={() => act(buyItem(profile, id), `Bought ${name}`, 'Not enough coins')}>
    Buy · ◉ {price}
  </button>
}

/** One row per item, grouped by club slot. Only one item per slot is equipped. */
function EquipmentTab({ profile, act }: { profile: Profile; act: Act }) {
  return <>
    <p className="hint">Permanent upgrades. Each one trades something away, so pick what suits your game. Stock gear is enough to play every hole.</p>
    {EQUIP_SLOTS.map(({ slot, label }) => <div key={slot} className="group">
      <div className="label">{label}</div>
      {EQUIPMENT.filter(e => e.slot === slot).map(item => <div key={item.id} className="row">
        <div><b>{item.name}</b><div className="desc">{item.desc}</div></div>
        <ItemButton profile={profile} id={item.id} name={item.name} price={item.price} equipped={profile.equipment[slot] === item.id} act={act} />
      </div>)}
    </div>)}
  </>
}

/** Charges for sale, how many are owned, and the three bag slots for the next round. */
function ConsumablesTab({ profile, act }: { profile: Profile; act: Act }) {
  const setSlot = (slot: number, id: ConsumableId | null) =>
    act(setLoadoutSlot(profile, slot, id), id ? 'Added to bag' : 'Slot emptied', 'You need another charge of that boost first')
  return <>
    <p className="hint">One-shot boosts. Arm one with its key (1–3) before swinging; press it again to cancel. A charge is only used when you strike the ball. Using any boost puts the round in the "boosted" record category.</p>
    <div className="group">
      <div className="label">Buy charges</div>
      {CONSUMABLES.map(c => <div key={c.id} className="row">
        <div><b style={{ color: c.color }}>{c.name}</b> <span className="desc">· owned {profile.consumables[c.id]}</span><div className="desc">{c.desc}</div></div>
        <button className="buy primary" disabled={profile.coins < c.price} onClick={() => act(buyConsumable(profile, c.id), `Bought 1 ${c.name}`, 'Not enough coins')}>
          Buy · ◉ {c.price}
        </button>
      </div>)}
    </div>
    <div className="group">
      <div className="label">Bag for the next round (up to {MAX_CHARGES})</div>
      {Array.from({ length: MAX_CHARGES }, (_, slot) => <div key={slot} className="row">
        <div><kbd>{slot + 1}</kbd> <b>{CONSUMABLES.find(c => c.id === profile.loadout[slot])?.name ?? 'Empty'}</b></div>
        <div style={{ display: 'flex', gap: 6 }}>
          {CONSUMABLES.map(c => <button key={c.id} className={`buy ${profile.loadout[slot] === c.id ? 'primary' : ''}`} onClick={() => setSlot(slot, c.id)}>{c.name}</button>)}
          <button className="buy" onClick={() => setSlot(slot, null)}>Empty</button>
        </div>
      </div>)}
    </div>
  </>
}

/** Color swatches previewing a cosmetic. */
function Swatches({ item }: { item: Cosmetic }) {
  const colors = item.kind === 'ball' ? [item.color] : item.kind === 'finish' ? [item.shaft, item.head] : [item.shirt, item.pants, item.cap]
  return <span className="swatches">{colors.map((c, i) => <i key={i} style={{ background: c }} />)}</span>
}

/** Ball colors, club finishes and outfits. */
function CosmeticsTab({ profile, act }: { profile: Profile; act: Act }) {
  const groups: { label: string; items: Cosmetic[]; equipped: string }[] = [
    { label: 'Ball color', items: BALL_COLORS, equipped: profile.ball },
    { label: 'Club finish', items: CLUB_FINISHES, equipped: profile.finish },
    { label: 'Golfer clothing', items: OUTFITS, equipped: profile.outfit },
  ]
  return <>
    <p className="hint">Looks only. Cosmetics never change how shots play.</p>
    {groups.map(gr => <div key={gr.label} className="group">
      <div className="label">{gr.label}</div>
      {gr.items.map(item => <div key={item.id} className="row">
        <div><Swatches item={item} /> <b>{item.name}</b></div>
        <ItemButton profile={profile} id={item.id} name={item.name} price={item.price} equipped={gr.equipped === item.id} act={act} />
      </div>)}
    </div>)}
  </>
}
