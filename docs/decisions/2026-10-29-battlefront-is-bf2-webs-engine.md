# Battlefront is bf2-web’s engine; the site’s own game is gone

## Context

Since 2026-10-28 Hoth has been `bf2-web`’s ([Hoth is bf2-web’s](2026-10-28-hoth-on-bf2-web.md)): its compiled engine on
the visitor’s GPU, served from the private bucket by the Worker. That decision kept the site’s own Battlefront world
for browsers the engine can’t run on, with a JS port of `bf2-web`’s rules under it. Neither happened:
- #1262 took the three.js world off `/battlefront`, which now only sends a browser to the engine or says why it can’t;
- the JS port was never wired into anything.

The owner, 2026-10-29: clean the repository for the Star Wars galaxy so that `bf2-web`’s engine and game code fit in
cleanly. Keep the flight, the space battles and the other planets’ open worlds as they are; Battlefront is the focus,
and the engine and its game logic are on Hoth alone for now, to reach other planets later.

## Decision

Battlefront is `bf2-web`’s engine and nothing else. `bf2-web` stays its own repository, and the site holds no engine
source: it serves what `bf2-web` exports. The site’s own Battlefront game is removed, and with it everything only it
used:
- `src/components/battlefront/`, all but the engine’s way in (`engine.js`, `index.js`);
- `src/lib/battlefront/`, all but three bots’ minds the galaxy uses, which move to `src/lib/bf2017/ai/`;
- its libraries, sounds (352 MP3s, 13 MB), Hoth’s Galactic Assault part, the navmesh and its WebAssembly search;
- its browser checks and its dev backend.

Hoth opens the engine first; its free roam, the galaxy’s own level of Hoth, comes back as a button on Hoth.

This supersedes, as history:
- [one deploy flow on the galaxy](2026-10-11-one-deploy-flow-on-the-galaxy.md) (its Hoth half);
- [the game’s post order](2026-10-12-the-games-post-order-and-the-chain-under-the-pace.md);
- [no frame waits for a shader](2026-10-12-no-frame-waits-for-a-shader-on-webgpu.md) (its soldier half);
- [Hoth at the record’s clamp](2026-10-12-hoth-at-the-records-clamp.md);
- [the page gets a turn](2026-10-12-the-page-gets-a-turn-between-shader-builds.md);
- [the waiting screen into Hoth](2026-10-12-the-waiting-screen-into-hoth.md);
- [Battlefront’s draws](2026-10-14-battlefront-draws-are-not-its-cost.md);
- the fallback half of [Hoth is bf2-web’s](2026-10-28-hoth-on-bf2-web.md).

## Consequences

- One game engine for Battlefront: new game work goes to `bf2-web`, and the site’s side is its way in, the Worker, the
  service worker and the pipeline.
- A browser the engine can’t run on gets no Battlefront round, only the reason, and the galaxy’s Hoth.
- The 2017 game’s data and asset pipeline stays: the galaxy’s surfaces, cast, vehicles, sabers, Starfighter Assault
  and space read it. Some rulebook records only the old game read are left for a later pass. Their producer,
  `scripts/bf2017-data.mjs`, runs only on the owner’s desktop.
- The old game is in git history before this change, if a piece of it is ever wanted again.

## Revisit when

- `bf2-web` plays another planet: that planet opens the engine as Hoth does.
- A visitor without a capable GPU needs a Battlefront round: `bf2-web` gets a lighter path, not the site a second game.
