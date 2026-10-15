# The engine floor: the inventory, and each lane’s numbers

The design: `docs/superpowers/specs/2026-10-15-engine-floor-design.md`. The hand-off: `docs/superpowers/HANDOFF-engine-floor.md`. Every number in the design’s §1 was read on 2026-10-15 in the cloud container at `f97079c7` by the commands below; each lane puts its before and after under `<lane>/README.md` here, every number with where it came from.

## The inventory’s commands

```bash
# lines and files
find src -type f \( -name '*.js' -o -name '*.jsx' \) ! -name '*.test.js' ! -name '*.test.jsx' -exec cat {} + | wc -l   # 605,667
find src -type f \( -name '*.test.js' -o -name '*.test.jsx' \) -exec cat {} + | wc -l                                  # 169,937
find scripts -name '*.mjs' ! -name '*.test.mjs' -exec cat {} + | wc -l                                                 # 87,182
for d in src/components/*/ src/lib src/lib/three src/runtime src/pages; do printf "%8d %s\n" $(find "$d" -type f \( -name '*.js' -o -name '*.jsx' \) ! -name '*.test.js' -exec cat {} + | wc -l) "$d"; done | sort -rn

# the floors
grep -rn --include=*.js --include=*.jsx -E "new (THREE\.)?(WebGPURenderer|WebGLRenderer)\b" src | grep -v test       # 17 classic, 1 node
grep -rl --include=*.js --include=*.jsx "requestAnimationFrame(" src | grep -v test | wc -l                            # 61
grep -rl --include=*.js --include=*.jsx "new EffectComposer" src | grep -v test | wc -l                                # 12
grep -rn --include=module.js -E "shading:\s*'" src/components                                                          # the modules and their shading
node scripts/health.mjs --check --skip build                                                                           # glsl-sites 619, boundary-breaks 479, cycles 5

# the twins
for t in $(find src -name '*Nodes.js' ! -name '*.test.js' | sort); do o=${t/Nodes.js/.js}; printf "%6d %-55s " $(wc -l < $t) $t; [ -f "$o" ] && printf "%6d %s\n" $(wc -l < $o) $o || echo "(no original)"; done

# the build
npm run build && node docs/superpowers/evidence/engine-floor/tools/chunks.mjs   # the chunks by source, the duplicates, the bytes by area
git checkout public/github.json

# dead files (none found: every unimported file is data or reached by URL or by folder)
node docs/superpowers/evidence/engine-floor/tools/deadfiles.mjs

# scripts nothing names
for f in $(find scripts -maxdepth 1 -name '*.mjs' ! -name '*.test.mjs' | sort); do b=$(basename $f); n=$(grep -rl --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git -F "$b" package.json .github docs scripts .claude src | grep -v "^$f$" | wc -l); [ "$n" = "0" ] && printf "%6d %s\n" $(wc -l < $f) $f; done | sort -rn

# the weight in git
for d in public/*/; do printf "%8.1f %s\n" $(git ls-files -z "$d" | xargs -0 du -cb | tail -1 | awk '{print $1/1048576}') "$d"; done | sort -rn
git ls-files -z docs/superpowers/evidence | xargs -0 du -cb | tail -1   # 97.9 MB
du -sh .git                                                              # 1.2 GB

# exports no other file names (knip ran out of memory on this tree: 8 GB,
# then 12 GB with src/data ignored; tools/knip.json is the config for a
# machine that has more)
node docs/superpowers/evidence/engine-floor/tools/unused-exports.mjs      # 531 in 324 files → FL1/unused-exports-before.txt

# the baseline
npm run lint                                                              # green, 2 min 14 s
npm test                                                                  # 15,524 passed, 6 skipped, 2 failed: the two 10,000-segment timing tests
                                                                          # (scripts/lib/bf2017-hulls.test.mjs, src/lib/combat/hulls.test.js: 111 to 114 ms
                                                                          # against their 50 ms line on the container’s CPU; one still fails run alone)
```

## The inventory, 2026-10-15

| what | number |
| --- | --- |
| `src/` source, tests left out | 605,667 lines, 4,112 files |
| `src/` tests | 169,937 lines |
| `scripts/` | 87,182 lines (686 `.mjs`), 20,023 of tests |
| renderer constructors outside `src/runtime` | 17 |
| files calling `requestAnimationFrame` | 61 |
| `new EffectComposer` sites | 12 |
| `glsl-sites` | 619 |
| `boundary-breaks` | 479 |
| `cycles` | 5 |
| `big-files` | 30 of 30 |
| TSL twins | 31 files, 5,037 lines; 29 originals, 5,003 lines |
| world modules on the runtime | 8 (`'nodes'`: earth, battlefront, galaxy/surface, minecraft; `'glsl'`: mario64, expanse/flight, deathstar/inside, galaxy) |
| build | 1,238 chunks, 28,968,693 bytes of JS, 1,010,816 of CSS |
| three.js in the build | `three.module` 365,087 B, `three.core` 379,014 B, `three.webgpu` 690,472 B |
| the biggest code chunks | `instantAction` 2,223,619 B, `FrontEnd` 859,669 B, `backdrop.worker` 715,428 B, `shapes` 548,733 B |
| JSON imported statically into those chunks | `bf2017/ai.json` 530,307 B, `ui.json` 388,698 B, `screens.json` 755,635 B |
| scripts nothing names | 9 files, 1,008 lines |
| unimported files under `src/` | 112 (12,019 lines), all data or reached by URL or by folder |
| exports no other file names | 531 in 324 files |
| tracked under `public/` | about 1,090 MB |
| tracked under `docs/superpowers/evidence/` | 97.9 MB |
| `.git` | 1.2 GB |
| `npm run lint` | green, 2 min 14 s in the container |
| `npm test` | 15,524 passed, 2 timing tests failed on the container’s CPU, 6 min 43 s |

## The lanes’ folders

| lane | folder | what it holds |
| --- | --- | --- |
| FL0 | `FL0/` | the six metrics’ first values and the budgets written |
| FL1 | `FL1/` | the exports scan before and after, the exceptions, the chunk sizes before and after |
| FL2 | `FL2-<world>/` | the before and after shots (pixel-identical), the world’s check, the probe on the classic backend |
| FL3 | `FL3-<world>/` | the twin table, the probe on both backends at Low and High, the closure |
| FL4 | `FL4/` | the five gates of the design’s §4.5 |
| FL5 | `FL5/` | the probe with and without `?worker=on` on the RTX 5090 |
| FL6 | `FL6/` | the census, the probe, the FLIP scores |

`tools/` holds the inventory’s own scripts (`deadfiles.mjs`, `chunks.mjs`, `unused-exports.mjs`, `knip.json`); the perf lanes’ bench tools are `docs/superpowers/evidence/perf/tools/` (`glsl-closure.mjs`, `bf-census.mjs`, `bench.sh`).
