# An open prototype: architecture and provenance

A plan for rebuilding two games for the browser from independently written code. First deliverable: a small playable arena (`prototypes/arena/`, run with `npx vite` and open `/prototypes/arena/index.html`).

## What goes in, what stays out

| Input | Status |
| --- | --- |
| Code written for this project | In |
| three.js and other packages with a page under `docs/stack/` | In (open licences) |
| Public documentation, published interviews and talks, observable gameplay (played or watched, then described in our own words) | In, cited |
| Placeholder shapes, flat colours, synthesised sounds | In |
| Any engine source snapshot, however obtained | **Out** until the rights holder confirms in writing, outside this project’s own documents, that this copy may be inspected, modified and ported (see below) |
| Assets, models, audio, data tables, shapes or numbers exported from the games | **Out** of this prototype, whatever the site’s older work did |
| Values read from a decompiled executable | **Out** of this prototype |

A provenance doubt about an input is written down here, the input is left out and a placeholder takes its place.

## Provenance flags raised so far

- **The Frostbite source snapshot**: excluded. Matching a known leaked version is a version fact, not a provenance fact. To assess this copy: an authorized delivery record (who delivered it, when, through what channel), a written licence covering inspection, modification and web porting that names this project and the legal entity behind it, permissions for third-party dependencies and game assets, and a rights-holder contact who can confirm directly.
- **The site’s older Battlefront work** (`bf2-re/`, `src/data/bf2017/`, `docs/decisions/2026-10-10-battlefront-2017-assets.md`, the galaxy hulls and damage branches): built from exported game assets and values read from a decompiled executable. Not used here. Whether it stays in the site is the owner’s decision.

## Layers

```
rules (pure)  ←  sim (fixed step)  ←  shell (input, drawing, audio)  ←  page
```

- **Rules and sim**: plain JavaScript with no DOM and no three.js, stepped at a fixed 30 Hz from a seeded random generator, so a match is reproducible and testable without a canvas. `prototypes/arena/sim.js` is the first one.
- **Shell**: reads input, steps the sim, draws it. Replaceable (a headless runner, a server). `prototypes/arena/main.js`.
- **Content**: arenas, characters and weapons as data, all placeholder, kept apart from the rules so real licensed content can be dropped in later without touching them.
- **Net** (later): the sim’s fixed step and seeded state are what lets a server run the same rules and clients predict them.

## Two games, one spine

- **Battlefront-style arena**: teams, bots, bolts, cover, respawn, objectives. Phase 1 is `prototypes/arena/` (two teams, five a side, cover, 15 kills).
- **Football**: needs a ball with believable physics, player steering and passing, teams with simple roles, and a referee for the laws of the game. It shares the fixed-step sim, input mapping, bots and replay; its rules module is its own (`prototypes/pitch/` when started).

## Roadmap

1. **Arena (this change)**: flat arena, cover, bots, team score, respawn. Done when it plays end to end and its tests pass.
2. **Feel**: aim assist options, hit feedback, sounds, a minimap, a settings page.
3. **Depth**: classes with different weapons, vehicles as a second movement mode, capture points.
4. **Pitch**: ball physics, kick and tackle, a two-sided match with bots.
5. **Content**: replace placeholders with assets whose permissions are documented here.
6. **Net**: server-authoritative rooms on the same sim.
