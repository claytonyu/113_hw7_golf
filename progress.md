# Progress

## Done
- 3D course: all 18 holes (approximate Torrey Pines South layouts), front/back nine selection
- Graphics: sky, reflective ocean, cliffs, textured grass, Torrey pines, shadows, animated golfer and flag
- Shot planning: aim, power, club select, draw/fade, wind, trajectory preview with landing marker
- Two-press swing meter (early = left, late = right, misses lose distance)
- Ball physics: flight, spin, wind, bounce, roll, slopes, different behavior per lie
- Putting: auto putter, slope grid, cup capture based on speed
- Penalties for water / out of bounds, max 10 strokes per hole
- Scoring, scorecard, end-of-round screen
- HUD: hole info, wind compass, minimap, club carousel, banners, confetti
- Cameras: hole flyover, behind-ball, TV landing cam, overhead (Tab), cup orbit
- Sound effects (synthesized)
- Tiger Woods AI opponent (Amateur / Pro / Tiger, default Pro): plays real simulated shots, tee honors then farther-first, skippable shots, opponent panel, two-row scorecard, head-to-head end screen; difficulty saved in localStorage

- Pro shop (mouse): 10 equipment upgrades with tradeoffs, 3 consumables, 16 cosmetics (ball colors, club finishes, outfits); prices in src/config.ts
- Currency rewards: par-or-better holes and hole-in-ones pay as soon as you hole out (kept if you quit); completing a nine adds completion, personal-record and beat-the-AI bonuses. Each payout pays once, coins are never deducted. Coin counter in the HUD with popups for every gain
- Consumables: bag of up to 3 charges per round, keys 1/2/3 arm/cancel, one per shot, spent only on strike and saved immediately
- Personal records: front/back x boosted/unboosted, shown on the menu and end screen
- Profile (coins, purchases, equipped gear, records) saved in localStorage and validated on load

## To do
- Save and resume rounds (localStorage)
- Polish: smoother terrain up close, menu camera, performance tuning
