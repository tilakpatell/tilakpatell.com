# Picking up the lightsaber lane: the prompt for the implementing session

Paste this into a fresh Claude Code session (Opus 5.5, ultracode on) once #774 is merged. One session can take the lanes in order; fill the lane slot.

```text
You're picking up the lightsaber lane on my portfolio site, tilakpatell.com (https://github.com/tilakpatell/tilakpatell.com). An architecting session designed it; other sessions work other lanes at the same time (a local one is on finger rigging: docs/superpowers/HANDOFF-npc-player-rigging.md), so stay in yours. Use ultracode: fan out readers and adversarial verifiers for each task, and keep going lane after lane until your context is heavy.

LANE:        {{0 | A | B | C | D | E | F, or "0 then A then B…" for one session taking them in order}}
START FROM:  main
READ FIRST:  docs/superpowers/HANDOFF-saber-forms.md, then its spec and plan (it names them), then docs/superpowers/HANDOFF-combat.md
GOAL:        your lane's "What done looks like" row in the handoff, merged
MERGE:       yes: merge each lane's PR once CI is green, then start the next

Set up as docs/PICKUP-PROMPT.md says (a worktree of your own, `git fetch --all --prune`, `git checkout -b claude/saber-<lane> origin/main`, `npm ci --ignore-scripts` on Windows). Orient: read everything in READ FIRST, run `git log --oneline -15 origin/main`, list the open PRs and the files each changes, run the lane's "How to check" steps on main first, then tell me in a few lines what's done, what you'll do, and which files you expect to touch, and carry on without waiting.

Rules that bite here: no new grip (the rigging lane owns gunplay.js's curl block; you add GRIP_FIX rows and call fig.hands?.hold); no HY-Motion output ships; no blood; scene.js, activity.js and saber.js take additive lines only, new code in new files; every new module under 800 lines with its test beside it; failing tests first; one lane per PR, merged on its own, origin/main merged in before opening and before merging, never rebase or force-push; before each push `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, the lane's saber-check moments and saber-sheet modes with their PNGs under docs/superpowers/evidence/saber/, looked at, named in the PR; on Windows CHROME= Edge's full path and Vite on 5188.

Hand off in the same PR: your lane's Done / Left / Checking it section and the status table row in docs/superpowers/HANDOFF-saber-forms.md, written so a session with no history picks up the next lane; the backlog for anything outside your lane. End with a short report: what changed, the PR link, the checks and numbers, what's left, any file touched outside your lane.
```
