# 15114_HW_7 — Torrey Pines Golf (prototype)
Setup: `npm install` then `npx vite` → open http://localhost:5173

Done: 18 approximate hole layouts (front/back nine), 3D terrain/trees/ocean, aim/power/club/draw-fade,
trajectory preview + landing ring + dispersion, two-press swing meter, shared fixed-step physics
(wind, curve, bounce, roll, slopes, lies, sand/rough penalties), putting with slope grid + cup capture,
water/OOB penalties (stroke and distance), scoring, scorecard.

Also done: Tiger Woods AI opponent (unofficial, game-simulated; Amateur/Pro/Tiger, tuned in src/config.ts AI_LEVELS).

Also done: Pro shop, coins and rewards, consumables (keys 1/2/3), records. Prices and rewards are in src/config.ts.

Not yet: saving and resuming an unfinished round.
Course is a stylized, approximate recreation — not survey-accurate.


BUGS/COMMENTS:
- Path on right side of screen is sometimes not accurate -- does not factor in the shape. Flag icon seems slightly misaligned as well.
- Incrementing the power when putting takes a very long time.
- Putting strength is bugged. Going at max strength (~100 ft) sometimes only moves the ball 10 feet.