# 15114_HW_7 — Torrey Pines Golf (prototype)
Setup: `npm install` then `npx vite` → visit http://localhost:5173

## What is this?
This homework assignment for 15-114 was a two-part code handoff assignment. Another student first created a SPEC file describing the game they wanted to make and its criteria (a golf game), then worked on it for an hour using AI. Another student (that's me, for this repository) worked on the game for another two hours, trying to stay faithful to the SPEC file.

Done: 18 approximate hole layouts (front/back nine), 3D terrain/trees/ocean, aim/power/club/draw-fade,
trajectory preview + landing ring + dispersion, two-press swing meter, shared fixed-step physics
(wind, curve, bounce, roll, slopes, lies, sand/rough penalties), putting with slope grid + cup capture,
water/OOB penalties (stroke and distance), scoring, scorecard.

Also done: Tiger Woods AI opponent (unofficial, game-simulated; Amateur/Pro/Tiger, tuned in src/config.ts AI_LEVELS).

Also done: Pro shop, coins and rewards, consumables (keys 1/2/3), records. Prices and rewards are in src/config.ts.

Also done: unfinished rounds autosave between shots and can be resumed from the menu.
Course is a stylized, approximate recreation — not survey-accurate.


BUGS/COMMENTS:
- Path on right side of screen is sometimes not accurate -- does not factor in the shape. Flag icon seems slightly misaligned as well.
- Incrementing the power when putting takes a very long time.
- Putting strength is bugged. Going at max strength (~100 ft) sometimes only moves the ball 10 feet.

## Acceptance criteria
- A player can complete either nine using keyboard controls for every shot.
- Aim, power, club, shot shape, timing, wind, and lie meaningfully affect shots.
- Perfect shots closely match their previews.
- Putting, cup detection, penalties, and hole transitions work consistently.
- The AI completes holes using simulated shots.
- Currency, purchases, records, and unfinished rounds survive reloads.
- Consumables cannot be duplicated through reloads or canceled shots.
- The game remains responsive throughout a round.
- Include setup instructions and document any approximation in the course or rules.