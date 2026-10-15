# Picking up another account's work

Paste the prompt below into a fresh Claude Code session. Use one session per lane, and fill in the five slots at the top. Leave the rest as it is.

The lanes at the bottom are the open pull requests on 14 October 2026, so they will go stale. Before reusing one, check the open PRs and the “Left” section of the area’s handoff.

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
- the handoffs: docs/superpowers/HANDOFF-*.md, one an area (battlefront, galaxy, universe, worlds, runtime), each with what landed and what is left
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
- Update the area’s handoff, docs/superpowers/HANDOFF-<area>.md (one of battlefront, galaxy, universe, worlds, runtime; a new area gets a new one), keeping its sections:
  - **Landed**: what works and where in the code, with PR numbers.
  - **Left**, in order. Each item says where it is and what done looks like.
  - **The owner’s rules** for the area, kept as they were.
  Write it so a session on either account can pick up with no history.
- If you finished a backlog item, tick it. If you found something outside your lane, add it to the backlog rather than doing it.
- End with a short report:
  - what changed
  - the PR link
  - the checks you ran and the numbers
  - what's left
  - any file you touched outside your lane
```

## Lanes in flight (14 October 2026)

Each is one session. START FROM the pull request’s branch; READ FIRST its handoff (`docs/superpowers/HANDOFF-battlefront.md` for the Hoth and Battlefront lanes, `HANDOFF-runtime.md` for performance) and the spec the handoff names; GOAL: check it in the browser, fix what is broken, merge when CI is green.

- #1004 `claude/hoth-terrain-weight`: Hoth’s ground by the tier’s texel density.
- #1002 `claude/hoth-charges`: Hoth’s fuel charges as the game runs them.
- #1001 `claude/hoth-ga-doors`: Galactic Assault’s base doors, gates and mode walls.
- #1000 `claude/hoth-base-light`: Echo Base under its own light.
- #993 `claude/perf-p4-main-thread`: performance lane P4, the main thread.
- #984 `claude/bf-landing-leftovers`: Hoth’s old surface address out of the links and checks.
- Drafts, not yet ready for a pickup: #982 far soldiers as rows, #975 guests on the game’s rig, #974 a hero’s own kit and star cards, #970 the bots’ line of fire, #968 a design, #912 WebGPU by default on the Star Wars worlds.

For anything else, take an item from the “Left” section of a handoff or the top of `docs/autopilot/backlog.md`, and start from `main`.
