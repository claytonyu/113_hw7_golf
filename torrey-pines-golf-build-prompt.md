# Torrey Pines Golf — AI Build Prompt

Build a playable **full-3D browser golf game** focused on strategic shot planning, timing-based swings, and persistent pro-shop progression. Implement the game, including its assets and controls. Prioritize a complete playable golf loop over decorative menus.

## Game and technology

- Use TypeScript, React for menus/HUD, and Three.js with React Three Fiber for 3D rendering.
- Run entirely in the browser without a backend or paid services.
- Target desktop keyboard play.
- Save settings, currency, equipment, records, and unfinished rounds in localStorage.
- Use attractive stylized 3D graphics: coastal cliffs, ocean, Torrey pine silhouettes, fairways, bunkers, rough, and readable greens.
- Use procedural geometry and original assets wherever possible.

## Course and rounds

Create a recognizable recreation of **Torrey Pines South**, with all 18 holes. Players choose either the front nine or back nine for a round.

Research public course references for routing, approximate yardages, pars, major hazards, and coastal placement. Treat this as an approximate recreation; do not claim survey-level accuracy. Each hole must have its own layout rather than being a variation of a generic straight fairway.

- One fixed tee set initially.
- Standard stroke scoring, displayed relative to par.
- Separate lowest-score records for the front and back nine.
- Separate records for rounds using consumable boosts and rounds without them.
- No elimination, health system, or run failure.
- Allow saving and resuming between shots.

## Keyboard controls

| Input | Action |
|---|---|
| A / D | Aim left / right |
| W / S | Increase / decrease intended shot power |
| Q / E | Move shot shape toward draw / fade |
| Space | Start the swing meter; press again to strike |
| Left / right arrows | Change club |
| R | Reset shot shape to straight |
| C | Cycle camera views |
| Tab | Toggle overhead course view |
| 1 / 2 / 3 | Activate an equipped consumable before swinging |
| Escape | Pause and show controls |

Q/E should adjust a continuous signed curve setting, with a clearly marked straight-shot center. Prevent browser scrolling for gameplay keys while the game has focus. Use mouse controls for menus.

## Shot planning

Before each shot, let the player choose:

- Club.
- Aim direction.
- Intended power.
- Draw, straight, or fade shape, with adjustable curve strength.
- An optional consumable.

Show a projected flight path, expected first landing point, and shaded landing dispersion area. Include wind, elevation, club, power, shape, and lie effects in the prediction.

The preview and actual ball flight must use the same simulation. A perfect strike should closely follow the projected flight. Make clear that the landing marker represents first contact, not the final position after rollout.

Do not implement player-controlled spin yet.

## Swing mechanic

Use a two-press timing meter:

1. Press Space to start the marker.
2. Press Space again to stop it near the center of the perfect zone.

Swing results:

- Perfect timing closely follows the intended shot.
- Early timing causes a leftward error.
- Late timing causes a rightward error.
- Larger timing errors also reduce distance.
- Rough and bunker lies make execution harder.
- Stronger shot shaping slightly reduces forgiveness.
- Slower-meter power-ups visibly reduce marker speed.

Keep outcomes predominantly determined by player inputs. Avoid large hidden random errors. Show immediate feedback such as “Perfect,” “Early,” or “Late,” followed by shot distance and remaining distance.

Lock planning controls during the swing and ball flight. Holding Space must not trigger repeated inputs.

## Ball physics and terrain

Implement believable golf behavior:

- Gravity, flight, wind drift, and draw/fade curvature.
- Terrain collision, bouncing, friction, rollout, and eventual rest.
- Different behavior on fairway, rough, sand, and green.
- Elevation and slopes affect ball movement.
- Rough reduces carry and rollout.
- Bunkers penalize unsuitable clubs; wedges offer reliable escape options.
- Putting follows green slopes and gradually loses speed.
- Cup capture depends on both proximity and ball speed.

Use a fixed simulation timestep and reliable collision detection. Prevent balls from tunneling through terrain, rolling indefinitely, or becoming stuck in invalid states.

Provide clear penalty handling and legal drop positions for out-of-bounds or unplayable areas. State any simplified rules in the help screen.

## Putting

On the green:

- Automatically select the putter.
- A/D adjusts aim; W/S adjusts intended putting distance.
- Space uses the same swing interaction with a slower meter.
- Disable shot shaping.
- Display a slope grid with directional indicators.
- Show the initial aim direction, but do not reveal the full curved putting path.
- Make pace and reading the break meaningful.

## Conditions and strategy

For the first version, use fixed, hole-specific weather conditions so repeated scores are comparable.

- Show wind speed and direction.
- Wind stays constant throughout each shot.
- Include strategically meaningful rough, bunkers, elevation, slopes, and hazards.
- No rain initially.

Safe routes should offer easier next shots. Aggressive routes should offer shorter approaches while increasing hazard exposure. Club selection and placement should matter alongside timing.

## Tiger Woods AI opponent

Include an unofficial, game-simulated opponent labeled **“Tiger Woods — AI opponent.”** Do not imply endorsement or use copied voice recordings.

- He plays alongside the user in total-strokes competition.
- Use tee honors and otherwise have the farther player hit first.
- Show his ball, shots, score, and current position.
- Allow skipping his animations while preserving the simulated result.
- Provide Amateur, Pro, and Tiger difficulty settings.
- Default to Pro so the game is initially competitive.

The AI must play actual shots through the same physics system, rather than generating a score independently.

Its decisions should account for distance, lie, hazards, wind, landing area, and approach position. Higher difficulty improves planning and execution but never guarantees perfect play. Include controlled execution variation and occasional mistakes.

## Pro shop and progression

Award persistent currency for:

- Completing a nine-hole round.
- Pars, birdies, eagles, and better results.
- Setting a personal record.
- Beating the AI, with difficulty-scaled bonuses.

Guarantee a completion reward. Never deduct currency for poor play. Prevent duplicate rewards when a saved round is reloaded.

The pro shop sells:

1. **Permanent equipment upgrades:** Modest distance or forgiveness improvements, with tradeoffs so one club does not dominate every choice.
2. **Consumables:** Temporary boosts for one shot.
3. **Cosmetics:** Ball colors, club finishes, and golfer clothing colors.

Starter equipment must be sufficient to enjoy and complete every hole.

Initial consumables:

- **Power Boost:** Increase intended carry by 10% for one shot; update the preview.
- **Slow Tempo:** Reduce swing-meter speed by 30% for one shot.
- **Steady Hands:** Widen the perfect timing zone by 25% for one shot.

Players can equip up to three consumable charges per nine-hole round and use at most one per shot. Consume a charge only when the shot is struck. Allow canceling activation before starting the swing.

Mark a round as boosted when a consumable is actually used. Permanent equipment is allowed in both record categories.

Use a centralized configuration file for prices, rewards, club stats, and difficulty settings so balancing is easy.

## Cameras and interface

Provide:

- Behind-the-ball aiming camera.
- Smooth ball-follow camera during flight.
- Landing camera for bounce and rollout.
- Overhead course view for planning.
- Putting camera that makes slopes readable.

The HUD should show:

- Hole number, par, and distance to pin.
- Player and AI scores.
- Current club, power, and shot shape.
- Lie and elevation difference.
- Wind.
- Equipped consumables.
- Swing meter during execution.
- A compact controls reminder.

Include a main menu, front/back-nine selection, difficulty selection, pro shop, pause screen, scorecard, and end-of-round rewards screen.

## Implementation priorities

Build in this order, verifying each stage before expanding:

1. One complete 3D hole with aiming, trajectory preview, timing, ball flight, terrain collision, putting, and scoring.
2. Full nine-hole round flow, saving, and resuming.
3. All 18 distinct course layouts and front/back selection.
4. AI opponent using the real shot simulation.
5. Pro shop, consumables, records, and rewards.
6. Visual polish, sound effects, and performance improvements.

The first hole is a development milestone, not the final scope. Finish the complete requested game.

Avoid placeholder buttons or systems that only look functional. If scope must be reduced temporarily, preserve a working game and clearly identify what remains incomplete.

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

Make routine implementation decisions independently. Deliver a playable game, not just a design document or visual mockup.

