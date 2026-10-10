# Picking up another account's work

Paste the prompt below into a fresh Claude Code session. Use one session per lane, and fill in the five slots at the top. Leave the rest as it is.

The lanes at the bottom are filled in for what was in flight on 6 October 2026, so they'll go stale. Before reusing one, check `git branch -r --no-merged origin/main` and the open PRs.

## The prompt

```text
You're picking up work on my portfolio site, tilakpatell.com (https://github.com/tilakpatell/new-portfolio-website). Claude sessions on my other account started it. Other sessions are working other lanes at the same time, so stay in yours.

LANE:        {{short name, e.g. "Galaxy perf"}}
START FROM:  {{main | an existing branch, e.g. origin/claude/sharp-carson-h9c6mp | an open PR, e.g. #246}}
READ FIRST:  {{the handoff, spec and plan for this lane}}
GOAL:        {{what done looks like for this session}}
MERGE:       {{yes: merge once CI is green | no: open the PR and stop}}

## What you have
You have none of those sessions' conversation history. The `Claude-Session:` links in their commit trailers won't open on this account. Everything they knew is in the repo:
- the handoffs: docs/superpowers/HANDOFF-*.md
- the specs and plans: docs/superpowers/specs/ and plans/
- the backlog: docs/autopilot/backlog.md
- the architecture notes: docs/architecture.md
- the commit messages, which explain why
When the docs and the code disagree, trust the code and fix the doc.

## 1. Set up
- No clone yet? Run `git clone https://github.com/tilakpatell/new-portfolio-website.git`. Work in your own worktree or clone, never in a checkout another session is using.
- Run `git fetch --all --prune`.
- Starting from main: `git checkout -b claude/<lane-slug> origin/main`.
- Starting from a branch or PR: check it out, then `git merge origin/main`. Merge, don't rebase. The repo uses merge commits, and nobody force-pushes.
- Run `npm ci`. On Windows, run the scripts from Git Bash.

## 2. Orient before writing code
- Read everything in READ FIRST, plus your area's section of docs/architecture.md.
- Run `git log --oneline -15 origin/main`.
- If you started from a branch, also run `git log origin/main..HEAD` and `git diff --stat origin/main...HEAD`. That's the unfinished work you're inheriting. A commit marked WIP lists what was verified and what wasn't, so believe only the verified parts.
- List the open PRs and the files each one changes. Don't edit those files unless the PR is in your lane.
- Run the area as it is now, using the "How to check" or "Checking it" steps in its handoff.
- Then tell me, in a few lines: what's done, what's half-done, what you'll do this session, and which files you expect to touch. Carry on without waiting, unless the goal is unclear or the work would cross into another lane.

## 3. Rules
Follow the owner's standing rules. They're in two places: the "Standing rules" section of docs/superpowers/specs/2026-10-05-autopilot-design.md, and step 5 of .claude/skills/autopilot/SKILL.md. These are the easiest to break:
- Game rules and other pure logic go in tested modules (rules.js and the like), apart from the drawing. Write the tests first.
- No runtime calls to asset services. Fetch or generate assets ahead of time, commit them, and credit them.
- Never print or commit a key. MESHY_API_KEY and SKETCHFAB_API_TOKEN live only in .env.local. If this machine doesn't have them and the task needs them, stop and tell me.
- A new 3D model is made with scripts/gen3d (see its README and docs/architecture.md), not Meshy or a Sketchfab search: from a reference picture or a prompt, judged on its four-view sheet for accuracy before it ships. Only the owner's desktop has the GPU for it: if this machine isn't it, open a GitHub issue labelled `gen3d` (title = name, body = what/prompt/image, or several pictures) and the desktop's runner opens the PR. Voice lines likewise: once your lines are on main (or listed in the body as `who: line`), open an issue labelled `voices` and the desktop makes the recordings and opens the PR (scripts/voices/README.md).
- Every scene:
  - starts from lib/device's tier
  - lowers itself under lib/three/pace
  - loads only when near
  - disposes itself when you leave
  Textures stay within the spec's limits.
- British spelling, curly quotes, plain sentences. Comments say why.
- Don't change content in src/data/ (roles, projects, résumé) unless the goal says to. No sequel-trilogy Star Wars.
- Use the repo's skills (.claude/skills/) where they fit: threejs-* for anything drawn, test-driven-development, systematic-debugging, verification-before-completion.
- docs/architecture.md, README.md and the backlog are shared by every session. Edit only your own area's part of each, and keep it small.

## 4. Check
- Run `npm run lint`, `npm test` and `npm run build`.
- For anything visible, run `node scripts/autopilot-check.mjs --routes <the routes you touched>`. Then open the screenshots and look at them. Add `--phone` for layout changes.
- Never skip or quieten a test. If something is red, fix it.

## 5. Ship
- Commit messages are one plain sentence about what changed. The body says why, with numbers where you measured.
- Merge origin/main in again just before your last push.
- Push, then open a PR to main, or push to the PR you started from.
  - The title is plain.
  - The body has the summary, the numbers, the checks you ran and the screenshots.
- Use whatever GitHub tools you have: gh or the GitHub MCP. If you have neither, push the branch and give me the compare link.
- If MERGE is yes: wait for the CI check to pass, then merge with a merge commit. Never merge red. Never force-push. Never merge a PR outside your lane.

## 6. Hand off, in the same PR
- Update or create docs/superpowers/HANDOFF-<area>.md, with three sections:
  - **Done**, with PR numbers.
  - **Left**, in order. Each item says where it is and what done looks like.
  - **Checking it**: URLs, dev hooks, gotchas.
  Write it so a session on either account can pick up with no history.
- If you finished a backlog item, tick it. If you found something outside your lane, add it to the backlog rather than doing it.
- End with a short report:
  - what changed
  - the PR link
  - the checks you ran and the numbers
  - what's left
  - any file you touched outside your lane
```

## Lanes in flight (6 October 2026)

All four open PRs had green CI on 6 October. Each lane below is one session.

### 1. Dagobah mission, PR #247
- **START FROM:** `#247` (`claude/youthful-einstein-nxsa3a`)
- **READ FIRST:**
  - `docs/superpowers/specs/2026-10-06-dagobah-mission-design.md`
  - `docs/superpowers/HANDOFF-galaxy-surfaces.md`
  - `docs/superpowers/plans/2026-10-05-site-review.md`
- **GOAL:** play Do or Do Not through in the browser. Fix anything broken, then merge.
- **MERGE:** yes

### 2. Cybertron: Metroplex, Barricade and Iacon's skyline, PR #246
- **START FROM:** `#246` (`claude/jolly-newton-f5oiko`)
- **READ FIRST:** `docs/superpowers/HANDOFF-cybertron-world.md`, the copy on that branch.
- **GOAL:** check Metroplex waking and Barricade ramming in the browser, then merge. Then take the next item from the handoff's "Left" section in a new PR.
- **MERGE:** yes

### 3. Fingers round the gun, PR #242
- **START FROM:** `#242` (`claude/kind-meitner-wndmww`)
- **READ FIRST:**
  - `src/components/universe/grip.js` and `grip.test.js`
  - `scripts/preview/gunplay.html`
  - the gunplay line on that branch's `docs/architecture.md`
- **GOAL:** check the grip in the preview and on a landing, then merge.
- **MERGE:** yes

### 4. Multiplayer across the worlds, part 2, PR #234
- **START FROM:** `#234` (`claude/magical-hypatia-assk57`)
- **READ FIRST:**
  - `docs/superpowers/specs/2026-10-05-multiplayer-across-worlds-design.md`
  - `scripts/online-check.mjs`
- **GOAL:** run `scripts/online-check.mjs` across the worlds, fix what fails, then merge. This PR touches a dozen worlds' `*World.jsx` and `scene.js` files, so check it against every other open PR first.
- **MERGE:** yes

### 5. Galaxy perf (branch with 20 commits, no PR yet)
- **START FROM:** `origin/claude/sharp-carson-h9c6mp`
- **READ FIRST:** on that branch:
  - `docs/superpowers/specs/2026-10-05-galaxy-upgrade-design.md`
  - `docs/superpowers/plans/2026-10-05-galaxy-upgrade-phase-1.md`
  - `docs/superpowers/plans/2026-10-05-galaxy-upgrade-phase-2.md`
- **GOAL:** phase 1 looks done; confirm that against the plan's checks. Open its PR with before and after counts, then merge. Phase 2 goes in its own PR afterwards.
- **MERGE:** yes
- **Note:** this lane shares `src/components/galaxy/systems.js` with lane 1. Merge lane 1 first, then merge main into this branch.

### 6. Albuquerque: foliage, grass, wheels, matcaps (Step 1 merged)
- **START FROM:** `main`
- **READ FIRST:**
  - `docs/superpowers/plans/2026-10-06-albuquerque-grounding-foliage-wheels.md`: the plan; Tasks A1–A3 are done
  - the "Implementation notes" at the end of `docs/superpowers/specs/2026-10-06-baked-look-and-toy-physics-design.md`
  - `docs/superpowers/specs/2026-10-06-ground-grass-foliage-design.md`
  - `src/lib/three/foliage.js` and `lod.js`, built and tested but not wired in yet
- **GOAL:** the plan's next task. Step G first:
  - G1, foliage normals in `city.js` and `scene.js`
  - then G2–G6
  - then Step 2 (cannon-es) and Step 3 (matcaps)
  - measure the mid tier before and after with `scripts/abq-qa.mjs`, and never accept a slower frame
- **MERGE:** yes

### 7. The backlog
- **START FROM:** `main`
- **READ FIRST:** `docs/autopilot/backlog.md`, the handoff for the item you pick, and `.claude/skills/autopilot/SKILL.md`.
- **GOAL:** one unchecked item, finished.
- **MERGE:** yes
- **Note:** if the autopilot Routine is still switched on, it takes the top unchecked item every four hours. Pick one further down so the two don't collide.

### 8. GPU detail: quality that scales with the graphics card
- **START FROM:** `main`, once `claude/gpu-detail-quality` is merged
- **READ FIRST:** `docs/superpowers/HANDOFF-gpu-detail.md`
- **GOAL:** its handoff's next item.
- **MERGE:** yes

### 9. Beyond WebGL: the WebGPU foundation
- **START FROM:** `main`, once the spec's PR is merged and the owner has approved the spec
- **READ FIRST:**
  - `docs/superpowers/HANDOFF-webgpu-worlds.md`
  - `docs/superpowers/specs/2026-10-06-webgpu-worlds-and-living-worlds-design.md`
  - `docs/superpowers/plans/2026-10-06-webgpu-foundation.md`
- **GOAL:** Foundation A, task by task: `/lab/gpu` drawing on both backends, `scripts/gpu-check.mjs` green, `src/lib/tsl/` tested.
- **MERGE:** yes

## Where the lanes stand (6 October, evening)

- **Merged:** lane 2 (#246, then #249), lane 3 (#242), lane 6's Step 1.
- **Still open:** lane 1 (#247) and lane 4 (#234).
- **Being worked by sessions on this machine:**
  - galaxy sky baking and the jump (lane 5)
  - the Star Wars world on the runtime (`claude/world-runtime-galaxy`)
  - Invincible's UI
  - crew voices (`claude/crew-voices-hq`)
  - GPU detail (lane 8)
- **Before starting a lane:** check `git branch -r --no-merged origin/main` and the open PRs. Before merging anything: merge `origin/main` in, and tell the other sessions which files you touched.
