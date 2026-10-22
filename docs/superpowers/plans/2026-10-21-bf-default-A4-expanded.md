# Lane A4: Battlefront Expanded, for the owner

Design: `docs/superpowers/specs/2026-10-21-battlefront-by-default-design.md`, decision 8 (“Battlefront Expanded waits on the owner”). Written by lane A3; **not run**: the archives are not on this machine (the design’s “The mods on this machine”, measured 2026-10-21). These are the exact steps for the owner’s desktop, in order, each with the command, what it writes and what to check before the next. Branch, when it is run: `claude/bf-default-a4-expanded`. One PR for the records and the rulebook, one a hero after that.

## What it brings

Battlefront Expanded V7.3.2 (the Kyber Collection): 16 character-appearance packs, 4 trooper-appearance packs, 5 elites, about 75 heroes and about 28 reinforcements, each a Frosty mod (`.fbmod`) on the game’s own rig. For the site: the heroes and people the cast table draws as the site’s own today, each a `could` note in `src/lib/cast/bodies.js` that names it (`EXPANDED(…)`):

| cast row (`bodies.js`) | Expanded’s | today |
| --- | --- | --- |
| `ahsoka` | Ahsoka Tano | the site’s (Meshy) |
| `rex` | Captain Rex | the site’s |
| `jango` | Jango Fett | the site’s |
| `bokatan` | Bo-Katan Kryze | the site’s |
| `mando` | Din Djarin | the site’s |
| `quigon` | Qui-Gon Jinn | the site’s |
| `greedo` | Greedo | the site’s (and the cantina crowd’s Greedo, the `could` on its row) |
| `hondo` | Hondo Ohnaka | the site’s |
| `fennec` | Fennec Shand | the site’s |
| `caradune` | Cara Dune | the site’s |
| `greef` | Greef Karga | the site’s |

And, with no cast row yet (each a new row when it lands, not a swap): Mace Windu, Hera Syndulla, Cad Bane, Asajj Ventress, Savage Opress, Cody, Wolffe, Plo Koon, Kit Fisto, Ki-Adi-Mundi, Aayla Secura, Padmé, Thrawn, Krennic, Tarkin, Veers, Jyn Erso, Pre Vizsla, Cal Kestis, Dengar, IG-88, Wicket, R2-D2, Revan, Nihilus, Sion, Plagueis, Crosshair, Fordo (the flow-and-mods design’s list of the archive).

## The archives

From the owner’s Nexus download history (a login: the owner’s account), into `C:\Users\tilak\Downloads\`, as listed on 2026-10-10 (`docs/superpowers/specs/2026-10-10-battlefront-flow-and-mods-design.md`, “The mods on the owner’s machine”):

| archive | size | what |
| --- | --- | --- |
| `Battlefront Expanded - Kyber Collection-9291-V7-3-2.zip` | 6.4 GB, 141 `.fbmod` | the heroes, reinforcements, elites and appearance packs |
| `2021 Compatibility Update-1211.zip` | 614 MB | the 4K Clone Legions base some packs need |
| `Base File Collection-8942.zip` | 179 MB | the Movie Clone Troopers base, markings, gear |

1. Unzip each into its own empty folder, `C:\Users\tilak\Downloads\mods\expanded\` and so on (the archives are data: nothing in them is run).
2. Check: 141 `.fbmod` under `expanded\`; note each file’s name and size in `docs/superpowers/evidence/bf-mods/expanded.md` (the lane’s evidence).

## The records, as data (no game, no profile)

The exporter reads a `.fbmod` without applying it (`ModDump.cs`, the mode that extracted the Overhaul on 2026-10-12):

```
cd C:\Users\tilak\Downloads\BF2_Extract\tool\bin\moddump
bf2export.exe C:\Users\tilak\Downloads\BF2_Extract\frosty\FrostyEditor "C:\Program Files\EA Games\STAR WARS Battlefront II" C:\Users\tilak\source\repos\bf2-re\data\mods\expanded-<pack> moddump --mod C:\Users\tilak\Downloads\mods\expanded\<pack>.fbmod --raw D:\bf2-mods-raw\expanded-<pack>
```

once a `.fbmod` (a loop over the folder). It writes `mod.json`, `resources.tsv` and `ebx/` (every record the pack adds or replaces, as JSON) beside the Overhaul’s; the raw chunks and resources go to `--raw`, outside every repository.

3. **`bf2017-mods.mjs` for its records.** Add `expanded` to `MODS` in `scripts/bf2017-mods.mjs` with a reader beside `scripts/lib/bf2017-mods-iao.mjs` (`bf2017-mods-expanded.mjs`): for each hero pack, its kit (`kitRow`: side, era, class), its abilities and their numbers (the game’s `abilities.json` shape: `scripts/lib/bf2017-rulebook.mjs`’s `abilityRow` over the pack’s records), its health and its weapon; for each appearance pack, the skins it adds (`collection.json`’s shape). Then `node scripts/bf2017-mods.mjs expanded --root C:\Users\tilak\source\repos\bf2-re\data\mods` writes `src/data/bf2017/mods/expanded.json`, every number with its `_source`, tested on a fixture of three records as the Overhaul’s reader is (`scripts/lib/bf2017-mods.test.mjs`).

## The bodies (the profile, the export, the diff)

4. **The Frosty profile.** In Frosty Mod Manager (`FrostyModManager.zip`, the 2023-09-29 build with `Swbf2MergerPlugin.dll`), a profile named `Expanded` with the Compatibility Update and the Base File Collection first, then the Expanded packs in the order the mod’s page gives. Apply and launch once, closing the game at once:

```
FrostyModManager.exe -launch "Expanded"
```

   This writes `C:\Program Files\EA Games\STAR WARS Battlefront II\ModData\Expanded\` (a Data and Patch mirror with the patched bundles). Check: the folder exists and its `Data\` holds `initfs_Win32` and the patched `cas` catalogues. If the exporter wants the game’s own `initfs` (the flow-and-mods design’s open assumption 2), copy the vanilla `Data\` beside the mirror as hard links and say so in the evidence.

5. **`bf2export` on `ModData\Expanded`.** The same exporter as the vanilla export, with the mirror as the game folder:

```
cd C:\Users\tilak\Downloads\BF2_Extract\tool\bin\Release
bf2export.exe C:\Users\tilak\Downloads\BF2_Extract\frosty\FrostyEditor "C:\Program Files\EA Games\STAR WARS Battlefront II\ModData\Expanded" C:\Users\tilak\Downloads\BF2_Extract\web_mods\expanded_all meshes --lods 6
bf2export.exe … textures --referenced
bf2export.exe … anims
bf2export.exe … data --gz
```

   (`<frostyDir> <gameDir> <outDir> <mode>`, `Program.cs`’s usage line.) It writes the same manifests as the vanilla export: `models.jsonl`, `textures.jsonl`, `anims.jsonl`, `data.tsv`, and the files they name.

6. **The diff against the vanilla manifests.** Keep only what the mod adds or changes: a model, texture or clip whose `name` is not in the vanilla `web\models.jsonl`, `textures.jsonl`, `anims.jsonl` (`C:\Users\tilak\Downloads\BF2_Extract\web\`), or whose bytes differ; a record not in `web\data.tsv` or whose file differs. Copy those, with their manifests cut to them, into `C:\Users\tilak\Downloads\BF2_Extract\web_mods\expanded\` (the bucket’s layout: `lab/assets/bf2017/` mirrors `web/`, so `--root` reads it as it reads the vanilla export). A small script does it (`scripts/bf2017-mod-diff.mjs`, new: two manifests in, the cut out, the counts printed); check the counts against the packs (about 75 heroes’ meshes, their textures, no vanilla file).

## A hero onto the site

7. **`bf2017-import.mjs` per hero, on the humanoid rig.** For each row of the table above, the hero’s full body from the cut export:

```
node scripts/bf2017-import.mjs <manifest name> --root C:\Users\tilak\Downloads\BF2_Extract\web_mods\expanded --kind ahsoka --as 'Ahsoka Tano (Battlefront Expanded)' --rig --crew --hero --full --far
```

   on the game’s humanoid skeleton (`rig: 'walrus'`, the game’s clips by `pack`); a hero with a skeleton of its own goes through `ownRig.js` as the beasts did. Sizes by the owner’s rule: the light cut under 4 MB a hero and committed, the full cut published by hash to the bucket (`scripts/assets-publish.mjs`). Each is a clip sheet beside the site’s body (`scripts/clip-shot.mjs`, decision 2: compare, never assume), and the PR says which is better and why.

8. **The cast rows it fills.** In `src/lib/cast/bodies.js` the row’s `url`, `rig: 'walrus'`, `pack`, `full`, `lod`, `far` and `source: 'mod:expanded'`; its `could` goes (the `EXPANDED(…)` note is what the row waits on). `scripts/cast-audit.mjs` prints the count by source before and after: the `'site'` rows with a `could` go down by one each. The credit first: a `bf2017-mod-expanded` row in `src/data/modelCredits.json` with the mod’s name, its author and its Nexus page beside the game’s permission line; nothing of a mod is published to the bucket before its credit row exists (the flow-and-mods design, decision 6).

## The sequel era, refused

`isSequel` (`scripts/lib/bf2017-manifest.mjs`) and the mods’ `sequelMod` (`scripts/lib/bf2017-mods.mjs`) refuse a record, a model, a texture, a clip, an option or a kit of the sequel era at every step above, the diff included. In Expanded that is, at least: Rey, Kylo Ren, Finn, Poe Dameron, Captain Phasma, General Hux, Snoke, Rose Tico, Jannah, Zorii Bliss, the Knights of Ren, the Sith troopers, the First Order’s and the Resistance’s troopers and officers, BB-8 and BB-9E, and the Jakku, Takodana, Starkiller Base, Crait and Exegol looks. Before step 3 the lane lists the packs’ folder names and adds the ones the two tests miss to `sequelMod`’s words (`poe`, `hux`, `snoke`, `jannah`, `zorii`, `rose`, `knightsofren`, `sithtrooper`, `exegol`), each with a test.

One name to rule on before it runs: Expanded’s **Starkiller** is Galen Marek (The Force Unleashed), not the sequel era’s base, but `isSequel` refuses every name with `starkiller` in it. Left refused unless the owner says otherwise.

## Done when

- `src/data/bf2017/mods/expanded.json` written, every number with its `_source`, tested on a fixture of three records; nothing of the sequel era in it.
- Each hero row above on the game’s rig with `source: 'mod:expanded'`, its credit row, its clip sheet beside the site’s, its sizes under the caps; `scripts/cast-audit.mjs`’s `'site'` count with a `could` lower by the number brought in.
- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` green.
