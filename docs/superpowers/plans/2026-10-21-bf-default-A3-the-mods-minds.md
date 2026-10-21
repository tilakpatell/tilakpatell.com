# Lane A3: the mods’ minds

Design: `docs/superpowers/specs/2026-10-21-battlefront-by-default-design.md`, decision 8. Branch `claude/bf-default-a3-mods`. One PR. Wave 2: starts once A2 is on `main` (it shares `src/lib/battlefront/ai/`).

## Read first

- `src/lib/battlefront/ai/botLogicOverhaul.js` and its test, `botLogic.js`, `autoPlayer.js`, `waves.js`, `difficulty.js`; `src/data/bf2017/NOTES.md` (“The Overhaul’s bot logic”, “The AutoPlayers”, “Instant Action”); `src/lib/battlefront/instantAction.js`, `instantActionForm.js`.
- `scripts/bf2017-data.mjs` and `scripts/lib/bf2017-ebx.mjs` (how a record becomes a rulebook row with its `_source`), `scripts/lib/bf2017-rulebook-*.mjs`.
- The Overhaul, extracted: `C:\Users\tilak\source\repos\bf2-re\data\mods\iao-v2\` (`mod.json`, `resources.tsv`, `handlers.json`, `ebx/gameplay/gamemodes/mode9/prefabs/pve_botlogic.json`, `ebx/addons/mode1/gameplay/pf_bot_logic.json`, `ebx/s7_2/gameplay/kits/ai/`, `ebx/online/gamesettingscontainer.json`, the AutoPlayer records: find the 34 by type). Read-only.
- `docs/superpowers/specs/2026-10-10-battlefront-flow-and-mods-design.md` (“The mods on the owner’s machine”, “How a mod becomes site data”), `HANDOFF-battlefront.md` (“The mods (lane D2, the desktop)”).
- The law: no sequel-era record (`isSequel`), every number with its `_source`, nothing of a mod’s binaries in the repo (records as JSON rows only, under the owner’s own extraction).

## Tasks

1. **`scripts/bf2017-mods.mjs`.** `node scripts/bf2017-mods.mjs iao-v2 --root <bf2-re>/data/mods` reads the mod’s records into `src/data/bf2017/mods/iao-v2.json`: the settings it changes (`gamesettingscontainer`: the AutoPlayer counts, the squad-spawn probability, the aim, reaction and dodging step tables, the adaptive difficulty’s scales and period), its AI kits (`kits/ai/`: which class template and tactics each kit binds), and the bot-logic graphs already read by hand (so `botLogicOverhaul.js`’s table has a `_source`). Each row’s `_source` is the record’s path and field. Tested on a fixture of three records.
2. **`botLogicOverhaul.js` covers the bot.** From the rulebook: the five steps of aim, reaction and dodging (today “the middle unless asked”: the tables), the adaptive difficulty (ten scales every 15 s: the real scales and period), the squad-spawn probability, the kits’ templates. Each a tested rule; the `?bots=overhaul` round reads them through the sim (`bots.js`’s `ap`, `difficulty.js`).
3. **Adaptive on the ground.** `difficulty.js` (or a small `adaptive.js` beside it) exposes the Overhaul’s adaptive driver as a difficulty source the galaxy’s ground war (A1’s `brainFor`) can take when its Menu setting is `adaptive`; pure, tested. Do not edit `src/components/galaxy/` (A1’s) beyond the one line that lists the setting, if A1 is merged; else leave a NOTES line for it.
4. **Measure.** Twelve Supremacy seeds at 20 a side on the Overhaul before and after (the NOTES’ measured rows are the method); the kits’ numbers in a table in `docs/superpowers/evidence/bf-mods/README.md`.
5. **Battlefront Expanded, written up for the owner.** `docs/superpowers/plans/2026-10-21-bf-default-A4-expanded.md`: the archives’ names and sizes (from the flow-and-mods design), the Frosty profile, `bf2export` on `ModData\<Profile>`, the diff against the vanilla manifests, `bf2017-mods.mjs` for its records, `bf2017-import.mjs` per hero on the humanoid rig, the cast rows it would fill (each `could` in `src/lib/cast/bodies.js` names it), and the sequel-era names to refuse. Not run: the archives are not on this machine.
6. **Docs.** NOTES rows for every new number; `HANDOFF-battlefront.md` “The mods”.

## Done when

- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` green; `npm run test:ai -- src/lib/battlefront` stuck 0.
- Every number `botLogicOverhaul.js` holds has a `_source` in `src/data/bf2017/mods/iao-v2.json`; the Expanded plan is written.
