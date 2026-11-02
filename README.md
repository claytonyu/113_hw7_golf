# 15114_HW_7 — Torrey Pines Golf (prototype)
Setup: `npm install` then `npm run dev` → visit http://localhost:5173

## What is this?
This homework assignment for 15-114 was a two-part code handoff assignment. Another student (ZaneSoccer16) first created a SPEC file describing the game they wanted to make and its criteria (a golf game), then worked on it for an hour using AI. Another student (that's me, for this repository) worked on the game for another two hours, trying to stay faithful to the SPEC file.

## Progress
Done: 18 approximate hole layouts (front/back nine), 3D terrain/trees/ocean, aim/power/club/draw-fade,
trajectory preview + landing ring + dispersion, two-press swing meter, shared fixed-step physics
(wind, curve, bounce, roll, slopes, lies, sand/rough penalties), putting with slope grid + cup capture,
penalties (OOB: stroke and distance; water, canyons and cliffs: drop near where the ball went in, or replay;
U for an unplayable lie), scoring, scorecard.

Also done: Tiger Woods AI opponent (unofficial, game-simulated; Amateur/Pro/Tiger, tuned in src/config.ts AI_LEVELS).

Also done: Pro shop, coins and rewards, consumables (keys 1/2/3), records. Prices and rewards are in src/config.ts.

Also done: unfinished rounds autosave between shots and can be resumed from the menu.
Course is a stylized, approximate recreation — not survey-accurate.

## Acceptance criteria (met)
1. A player can complete either nine using keyboard controls for every shot.
  - Met; keyboard controls can be used to play the game.
2. Aim, power, club, shot shape, timing, wind, and lie meaningfully affect shots.
  - Met; these factors all play a role in the shot's trajectory.
3. Perfect shots closely match their previews.
  - Met; Shots match their previews (this was previously not the case for changing shape -- the preview would not bend).
4. Putting, cup detection, penalties, and hole transitions work consistently.
  - Met; these all should work. Cup detection was harder to test, but seems to work in normal gameplay.
5. The AI completes holes using simulated shots.
 - Met; the Tiger Woods AI's shots follow the same physics as the player.
6. Currency, purchases, records, and unfinished rounds survive reloads.
 - Met; this is implemented.
7. Consumables cannot be duplicated through reloads or canceled shots.
 - Met; this was tested to work.
8. The game remains responsive throughout a round.
 - Met; there is no hang while playing.
9. Include setup instructions and document any approximation in the course or rules.
 - Met; this can be accessed by pressing Esc during the game.

## Future Steps
It takes a long time to get enough coins to get any powerups, and the user cannot buy anything mid-game. Consider updating the balance by:
- Increasing the # of coins earned / Decreasing the prices of the items
- Allowing the users to buy items mid-game, as opposed to between rounds.