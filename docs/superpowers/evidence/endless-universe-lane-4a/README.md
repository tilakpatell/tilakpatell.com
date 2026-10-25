# Endless universe, lane 4a: things in space and gargantuans

The lane's numbers, task by task. Plan: `docs/superpowers/plans/2026-10-18-endless-universe-lane-4a-things.md`. Spec: `docs/superpowers/specs/2026-10-18-endless-universe-design.md`.

## Before: `eu/lane-4a` at `1936c112`, no code of this lane

PR 4a.1 draws nothing on this branch: the Expanse here sleeps inside the rim and draws `makeSector`'s 2D sectors, with no lattice and no lists. So its before for pictures is the coordinator's shots of `main` at `cc5e2eaf` (`/home/user/wt/main/lab/universe/{high,mid,low}/` and their `.json`), and no shot is taken here. The lane's browser before is Task 12's Step 0, on the wave-1 merge.

### Sizes

```
$ wc -l src/components/universe/scene.js src/components/universe/deepspace.js
  6374 src/components/universe/scene.js
  1490 src/components/universe/deepspace.js
```

### Health

```
$ node scripts/health.mjs --only glsl-sites,big-files,boundary-breaks,cycles
metric           value  unit     budget
glsl-sites       614    sites    619     ok
big-files        22     files    30      ok
boundary-breaks  481    imports  489     ok
cycles           5      cycles   5       ok
```

These are the numbers every task of PR 4a.1 compares with. `boundary-breaks` and `cycles` must not rise; `glsl-sites` may rise by one, in Task 18.

### The generator's time

`npx vitest run src/components/expanse/gen/space.test.js -t "ten middle-layer sectors"` passed three times out of three. The test keeps its time to itself, so its own loop (a warm-up sector, then the best of three runs of ten sectors at `10 + k, 0, 3`, in CPU time) was run three times from a scratch test that wrote the best down and was then deleted:

| run | best CPU time |
|---|---|
| 1 | 562.0 ms |
| 2 | 634.4 ms |
| 3 | 531.4 ms |

Best: **531.4 ms**, against the test's 600, at a load average of about 12. One run of the three was over 600 on its own, so the test has little room on this machine; Task 5 measures against 531.4.

### Tests red on `main`

The coordinator's full-suite run on `main` at `cc5e2eaf` (1,951 files, 21,266 tests) had one red: `scripts/health/art-mix.test.mjs`, "measures the site in the health table’s shape", which timed out at 5,000 ms under the machine's load. It isn't this lane's.
