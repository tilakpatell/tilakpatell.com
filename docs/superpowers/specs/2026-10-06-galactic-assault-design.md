# Galactic Assault: a Battlefront battle on the galaxy's worlds

The galaxy's worlds (`src/components/galaxy/surface/`) can be walked, and three of them have a mission. None of them yet has a *battle*: the thing the Battlefront games are, two armies and the command posts between them, with you one soldier among them. This is the design for that, as a mission kind the surface engine runs on any world whose site gives it posts: *Galactic Assault*, at `/galaxy/<system>/surface?mission=assault`. It ships on Hoth (the Rebellion against the Empire, in front of Echo Base) and Geonosis (the Grand Army of the Republic against the Separatists' droids, on the plain the Clone Wars began on), and is data for any other world after.

## The models

The battle wears models from three places, and a kind is a kind whichever it wears:

- **Battlefront II's remaster** (Harrisonfog's Battlefront 2 Remaster for the 2005 game, whose author has given the site's owner permission to use its models on this non-commercial fan site). The remaster ships as the game's munged `.lvl` files (a 4.8 GB installer on ModDB, which also turns automated fetches away), so its models can't be pulled from here: the owner extracts them with the mod tools (a `.msh` and its `.tga` textures, or a `.glb` out of Blender's SWBF msh add-on) and `scripts/battlefront-import.mjs` brings each in: `scripts/lib/msh.mjs` reads the ZeroEngine mesh, `scripts/lib/tga.mjs` its textures, the shared steps (`scripts/lib/surface-model.mjs`) cut it down and stand it on the ground, and it lands as `public/models/galaxy/surface/<kind>.glb` with its line in `catalog/battlefront.js` and its credit (`license: 'permission'`, the permission's wording) in `src/data/modelCredits.json`, shown on the surface page and the galaxy's panel and in `CREDITS.md`'s own section. A kind named there takes over from the same kind's Sketchfab or built figure wherever a world or a battle asks for it.
- **Sketchfab**, under Creative Commons, through `scripts/sketchfab-surface.mjs` (the clone troopers, battle droids, super battle droids and AT-TEs on Geonosis; a snowtrooper brought in for this).
- **Code**, where there's neither yet (Hoth's Rebel troopers in their parkas, `props/ice.js`).

## The battle

A map is data on the mission (`missions/index.js`, kind `'assault'`):

- **Two sides.** `sides: { attack, defend }`, each `{ id, name, short, colour, kinds }`: who they are (the Empire, the Rebellion; the Separatists, the Republic), the colour the HUD and the posts show them in, and the soldier kinds they field with weights (`[['snowtrooper', 3], ['stormtrooper', 1]]`). You can fight for either. The attackers have the harder job and the clock against them.
- **Command posts.** `posts: [{ id, name, at: [x, z], r }]`, each on a flat of the site (a place from the films: the trenches, the ion cannon, the shield generator, Echo Base's mouth). A post is owned by a side or by nobody, with a meter: hold it (stand inside `r`) with more soldiers than the enemy and the meter moves your way at `0.08` a second per soldier of advantage, up to four; the owner's meter runs down to nothing (the post goes neutral), then yours runs up to one (captured). A soldier of yours, or you, in a post counts the same.
- **Phases.** `phases: [{ posts: [ids], tickets, name }]`: the attackers' way in. The posts of the current phase are the live ones; the later phases' posts are the defenders', shut until their phase comes. When the attackers own every post of the phase, the next begins: the defenders fall back to it (their soldiers' objectives move on), and the attackers' reinforcements are topped up to the phase's `tickets` where they've fallen under. Take the last phase and the attackers have won.
- **Reinforcements.** Each side has tickets (`tickets: { attack, defend }`). A soldier down comes back at one of their posts after `6` seconds and costs a ticket; with none left they stay down. You cost a ticket the same way. A side with no tickets and nobody standing has lost. The defenders' pool is deep (they lose by losing posts, in the main) and the attackers' is the clock.
- **Soldiers.** `n` a side from the device tier (`high` 14, `mid` 9, `low` 6). Each has an objective (attackers: a live post not theirs, spread across them; defenders: the live post of theirs most in need, spread the same), walks to it at `3` m/s steering round what's solid (`walker.js`'s `pushOut` on the solids near it) and off its fellows, and holds inside it once there, shifting about a little. An enemy within `48` m (another soldier, or you) turns it: it faces them and fires every `1.1` s or so. A shot at a soldier hits with a chance that falls off with distance (`0.55` at point blank to `0.15` at the edge of range) for `26` damage of their `100`. A shot at you is a real bolt through the surface's blaster (`blaster.enemy`): it hits if it passes through you, as every shot on the surface does; at most three enemies fire at you at once. Your shots are the blaster's, as everywhere on the surface: what's under the crosshair takes `34`.
- **You.** One soldier of the side you chose. Before the battle you pick a side and a post of theirs to deploy at; down, you pick again (the spawn card) and come back at the post, for a ticket. Your part is counted: kills, and the posts you were inside when they flipped.
- **The end.** Attackers own the last phase: they've won. A side has no tickets and nobody up: they've lost. The result is `{ won, t, stars, kills, captures, side }`; stars by time as the other missions (`stars: [a, b]`: three under `a` seconds, two under `b`), your best kept per mission as theirs is (`tp-galaxy-missions`), and the `galacticassault` achievement for a win.

The rules are pure (`missions/assault.js`: `newBattle`, `stepBattle`, `hitSoldier`, `deploy`, `youDown`, `battleView`, `starsFor`), seeded, and tested in Node: a soldier alone reaches its post across an empty field; a post flips at the rate above and no faster than four soldiers' worth; a phase ends when its posts are held, and tops the attackers up; a side out of tickets with nobody up loses; the one with you in it counts you; `stepBattle` takes a long frame in short steps.

## How it's drawn

`missions/assaultScene.js` draws it in the surface scene (as `chaseScene.js` draws the chase): the soldiers (each kind's figure as `actors.js` finds one: a crew model, a catalogue model walking with its clips or a bob, a built figure, a humanoid prop), tipping over when down and gone after three seconds, up again where they come back; a chevron over each in the side's colour, the same size at any distance, so the fight reads through the snow; every post as a column of its owner's light with a ring on the ground that fills as it's taken; the soldiers' shots as bolts of the side's colour (`blaster.tracer`: a bolt that flies from here to there and harms nobody; the pool grows to make room); the shots at you as the blaster's enemy bolts. The shots near you sound (`sounds.blast`, rate-limited). The ambient life of the site that would be in the way of the battle (Hoth's standing snowtroopers, its Rebel trench line, Vader) is hidden while it runs (`life.hideKinds`), the walkers and the rest stay.

The surface scene gains the kind beside the chase: `fire()` shoots at the battle's targets while it runs; `hurt()` at nothing left puts you down (your figure tips, the stick does nothing) and the HUD asks where to deploy; Again starts the battle over; the compass's quest mark points at your side's objective; the battle's view goes to the page ten times a second as the chase's does.

## The HUD

`AssaultHud.jsx` over the scene, in the chase HUD's style:

- **Choose**: the mission's name and line, the two sides as cards (who, attack or defend, their soldier kinds), then the spawn card.
- **Deploy**: your side's posts as buttons (name, how it stands: held, contested, under attack), the tickets both sides have; a post deploys you.
- **Live**: top centre, the phase's name and a chip for each of its posts (its letter, the owner's colour, the meter filling); the reinforcements in each side's colour; when you're inside a post, a ring with what's happening (*Taking the trenches*, *Holding the ion cannon*, *Losing the ion cannon*) and the meter; a short feed of what's just happened (a post taken, a kill of yours); your kills.
- **Result**: how it went (`ends.won`, `ends.lost`, `ends.why`), the stars, the time, kills and captures, your best; Again, look round on foot, back to the system.

The quest panel and the things-to-do list stay out of the way while the battle runs; the crosshair is up while you're on your feet in it.

## Where it's wired

- `systems.js`: Hoth's briefing keeps the mission another lane shipped the same day (*The First Transport*, on foot) and carries the battle beside it, as `game.also` (a second mission on the same world, with its own line and button on the briefing page and the galaxy's panel: *The Battle of Hoth*, you a Rebel trooper or a snowtrooper; the snowspeeder is the vehicle to add to it later, Battlefront's way); Geonosis's game becomes *The Battle of Geonosis*, live (a clone or a battle droid on the plain), and its *Seismic Charges* flight moves to the games design's list, to come back as a `game.also` of its own.
- `Achievements.jsx`: `galacticassault`.
- `guide/pages.js`: a tip on the surface page for the assault.
- `README.md`, `docs/architecture.md`, `docs/superpowers/HANDOFF-battlefront.md`: what it is, where it lives, what's left.

## Not in this slice

- **Online**: one battle for everyone in the system, driven from the wall clock as the galaxy's set pieces are, with only what changes it sent (a post flipping, a soldier down, believed from a pilot near it), as the games design says. The rules are deterministic from a seed and a clock so this is a transport, not a rewrite.
- **Vehicles**: AT-STs to board, a snowspeeder on Hoth, an AT-TE's guns on Geonosis; heroes (Vader, a Jedi) as a reward for a streak.
- **More maps**: Kashyyyk's beach at Kachirho (clones and Wookiees against the droids coming out of the lagoon), Endor's bunker, Scarif's beach. Each is a `MISSIONS` entry: posts on the site's flats, two sides, phases.

## Done when

- Tests: the rules above; every assault's posts are on dry, level ground within the site's reach; its phases name only its posts and cover them all; its kinds are kinds there are; both sides can win in a simulation with no player.
- In Chromium at `/galaxy/hoth/surface?mission=assault`: the choose card, a side picked, deployed at a post, the two armies meeting between the trenches and the walkers' line, bolts both ways, a post flipping with its ring and chip, a phase ending, the result card both ways through the dev hooks (`window.__surfaceDo('missionDo', 'win' | 'lose')`), Again, no console errors; the same on Geonosis. `npm run lint`, `npm test`, `npm run build` clean; `node scripts/health.mjs --check --skip build` within budget.
