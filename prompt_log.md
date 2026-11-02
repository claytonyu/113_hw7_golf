# Prompt Log
I used Claude Opus 5.5 and Sonnet 5.5 in Kiro IDE to work on this project, building incrementally, feature by feature. I built features in order of importance of the criteria listed in the build prompt.

One instance of when the LLM did something I didn't want was when it added the trace of the Tiger Woods AI's previous ball's path on the screen. This made it hard to see my current shot, especially if my previous path trace was also there. I decided to remove the AI path trace, but I could see alternatives where the AI trace is kept but the prediction trace is made clearer (making the current shot prediction trace have a higher stroke weight, or coloring it differently).

## Inheriting the Project
Here is a game I've received from someone else. Read the `torrey-pines-golf-build-prompt.md` and `progress.md` files, and the game code. Don't change or write anything yet. Do two things:

1. Explain how the code is structured, what works, and which acceptance criteria look closest to done. 
2. Determine, if any, any glaring errors or parts of code that don't align with the build prompt. You do not need to be completely thorough.

## Refactoring the code
Refactor the code -- do NOT overhaul or completely change it. You may split & rename functions or files for modularity. Most of the work should be recognizable to the original code. Use the following principles:

- KISS & Readability: Prioritize plain, clear, idiomatic code over overly clever or compressed one-liners
- Modularity: In general, keep generated functions, classes, and modules focused on one specific job.
- Add brief comments to each function describing its purpose, and a module-level comment per file. Comment anything that is unintuitive or complex.

## Adding features (Creating the Tiger Woods AI)
Create the Tiger Woods AI, following the build prompt. Also build anything related to the AI (ex: the interface should now show the AI scores).

...

Seeing the AI opponent's ball path is a bit distracting with the predicted. Can you not show it?

## Adding features (Currency, Shop, Interface)
Generate a list of shop items, following the build prompt. Include equipment updates, cosmetics, and one-time consumable powerups.

Then code the currency awarding system, following the build prompt. 

Lastly, write code to finish the shop interface, inventory, and anything else in the Pro shop & Progression section in the build prompt file.

## Tweak - Adjusting UI
Reorder & change the numbers shown by the top left UI. Remove the "plays like" description, and put stroke count in there instead. Reorder fields to read: Elev, Stroke, To Pin, Lie.

## Bug Fixes (Identification)
Evaluate these errors and inconsistencies. Do they still exist? This should be brief; don't go too in depth.

[Copied text from earlier conversation -- removed due to length]
[This includes bugs with the escape button not pausing, adjusting putting being very small steps, the preview on the minimap did not include shape, the flag icon being misaligned, penalties not implemented correctly]

Other comments (these are also important):  
- Path on right side of screen is sometimes not accurate -- does not factor in the shape. Flag icon seems slightly misaligned as well.  
- Incrementing the power when putting takes a very long time.  
- Putting strength is bugged. Going at max strength (~100 ft) sometimes only moves the ball 10 feet. If this is because of wind strength and elevation, it is not clear.

## Bug Fixes (Fixes)
Fix all explicit bugs and mismatches. Ignore the 113 title.


Also add a bug: the pause screen menu has a lot of text, which falls off the screen to the point where you can no longer see the buttons. Increase the horizontal size of the overlay a bit, limit its vertical size, and importantly, add scrolling.
