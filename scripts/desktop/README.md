# The desktop's jobs: 3D models and voice lines from anywhere

Three pipelines need the owner's desktop and its GPU (an RTX 5090):
**gen3d** makes 3D models (`scripts/gen3d`), **voices** makes voice
lines in the characters' cloned voices (`scripts/voices`), and **motion**
makes a clip on Meshy's skeleton from a sentence (`scripts/motion`). Anyone with write
access asks for them from anywhere: a phone, a laptop, a cloud Claude
session. The desktop makes them when it's awake and answers with a pull
request.

```
request (form, gh, issue)  →  GitHub issue (the queue; it keeps while the desktop is off)
                           →  workflow gen3d.yml / voices.yml
                           →  self-hosted runner on the desktop (label gpu, one job at a time)
                           →  scripts/<pipeline>/runner.mjs --auto  →  make it  →  pull request + issue comment
```

## Asking for something

Pick whichever is handy. Each one ends as the same labelled issue.

**From the Actions tab** (phone or browser): Actions → *gen3d* or *voices* →
*Run workflow*, fill in the form.

**From an issue**: New issue → *3D model* or *Voice lines*. You can drag a
picture straight into the form.

**From a terminal or a cloud session** (gh signed in):

```
node scripts/desktop/ask.mjs gen3d tie-fighter --what "a TIE fighter" --image https://…/tie.png --faces 30000
node scripts/desktop/ask.mjs gen3d stump --what "a redwood stump" --prompt "a huge old redwood stump, …" --faces 6000 --options "tex: 1024"
node scripts/desktop/ask.mjs voices citadel --only rick,morty --line "rick: Wubba lubba dub dub." --line "morty: Aw geez."
node scripts/desktop/ask.mjs motion overhead-strike --prompt "a two-handed overhead sword strike, stepping forward"
```

`ask.mjs` checks the request before it opens anything; add `--dry-run` to
see the issue first. `gh workflow run gen3d.yml -f name=… -f what=… -f image=…`
and a plain `gh issue create --label gen3d` work too. The fields are listed
in `scripts/gen3d/runner.mjs`, `scripts/voices/runner.mjs` and
`scripts/motion/runner.mjs`.

**What makes a good 3D request:** attach a picture. A three-quarter view
with the whole thing in frame, on a plain background, works best. A prompt
alone only works for designs the image model already knows, like an X-wing.
Several sides of one thing go through a multi-view engine. Ask for small
`faces` for small things: a rock 4000, a prop 10000, a character 30000.

## Following it

```
node scripts/desktop/status.mjs          # runner up?  what's queued, running, waiting, failed; recent runs
node scripts/desktop/status.mjs --json   # the same, for a script or a session
```

The issue says each step: *Started* links the live run, *Made* links the
pull request, *Failed* gives the log's tail and a hint. Each run in the
Actions tab has the full log, and a gen3d run keeps the judging sheet as an
artifact.

The runner also takes one job of its own every night at 04:00 UTC:
`ai-health.yml` (`scripts/ai-e2e/README.md`) evaluates the judges, makes
one real model and one real line, renders every model, and keeps one issue
labelled `ai-health` open while a night is red. The status shows the last
night. The jobs' own contract (what `ask.mjs` writes, the runners read
back the same; the status; the doctor; the workflows' guards) is tested on
every pull request with a fake `gh` (`GH_BIN`).

- **Queued**: the desktop is off or asleep. GitHub holds a run for up to a
  day, and the hourly sweep finds the issue after that.
- **Waiting for the GPU**: something else is using the GPU, such as a long
  TTS run or a game. The job waits up to 45 minutes for enough free memory
  (gen3d 18 GB, voices 10 GB, motion 26 GB), then leaves it for the next sweep. It never
  crashes into the other job.
- **Failed**: fix what the comment says (the picture link, a field), then
  remove the `…:failed` label to try again. A gen3d retry picks up at the
  step it died on.
- **Running for too long**: the run stops itself after 5 hours (6 for
  voices). A step that hangs is stopped sooner.

Only issues from the owner or a collaborator are made. An issue form adds
its label for anyone, so the label alone doesn't count.

## Setting up the desktop (once)

From a **normal PowerShell window** in the repository (Start menu, not a
terminal inside the Claude app):

```
powershell -ExecutionPolicy Bypass -File scripts\desktop\setup-runner.ps1
```

This signs gh in if it isn't already, and sets git to push with gh's login.
It downloads the GitHub Actions runner to `~\actions-runner` and registers
it on the repository with the label `gpu`. It adds a scheduled task,
`desktop-jobs-runner`, that starts the runner at logon and checks on it
every five minutes; the runner reconnects by itself after sleep. It moves
the old Startup-folder pollers aside, starts the runner, and runs the
doctor. Running it again is safe. `-Remove` undoes it.

```
node scripts/desktop/doctor.mjs          # everything a job needs on this machine, each with its fix
gh workflow run desktop-doctor.yml       # the same, on the runner itself, from anywhere (Actions tab: desktop doctor)
```

Why "not from the Claude app": the Claude desktop app is an MSIX package,
so whatever a session inside it writes under `%LOCALAPPDATA%` lands in the
app's private copy (`AppData\Local\Packages\Claude_…\LocalCache\Local`).
That's where `trellis-studio`, `sdcpp`, `llamacpp`, `blender` and `voices`
are. Processes outside the app (the runner, a scheduled task, a Startup
item) don't see them at the usual path, which is why the old Startup
pollers never came back after a reboot. `localDir()` in `lib.mjs` looks in
both places, and the runner lives outside AppData.

Security: the repository is public, so workflows from forks need the
owner's approval (Settings → Actions → "Require approval for all external
contributors"). The self-hosted runner only takes the two workflows' `make`
jobs, and those run only for trusted issues.

## Running a job by hand

On the desktop, without Actions:

```
node scripts/gen3d/runner.mjs --issue 384     # one issue
node scripts/gen3d/runner.mjs --sweep         # every open one
node scripts/gen3d/runner.mjs --watch 60      # keep sweeping (the runner is the usual way)
node scripts/gen3d/make.mjs NAME --image photo.png --what "…"   # no issue at all: scripts/gen3d/README.md
```

To keep the runner off a pipeline while you work on its files by hand
(generate.py on the same references and cache, say), put a
`~/.desktop-jobs/voices.lock` (or `gen3d.lock`) there: with a process id
in it, it holds while that process lives; empty, for a day. Jobs wait as
they do for a busy GPU.

A lock in `~\.desktop-jobs\locks` keeps two runners of one pipeline from
running on this machine at once. An issue still labelled `…:running` with
no live runner behind it was cut off by sleep or a restart, and the next
run takes it again.

## The stream (lane R2’s spike)

`bf2017-stream.mjs` draws a world at ultra in Chrome on this machine’s GPU
and streams it over WebRTC to a phone at `#/stream?id=…`, the phone’s
input coming back and replayed. It measures; nothing on the site links it.
With `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the environment:

```
node scripts/desktop/bf2017-stream.mjs --world hoth --minutes 15 --name desktop-lan
```

`--source game` streams the real game’s window instead (the owner’s copy,
running here), its input put in through Windows’ SendInput (`inject.mjs`)
and its frame time read by PresentMon when `PRESENTMON` names it
(`presentmon.mjs`). It prints the address the phone opens and writes the run’s numbers to
`docs/superpowers/evidence/bf2017-picture/r2/`, whose README says what to
run and what the numbers decide.

## The files

| file | what |
|---|---|
| `lib.mjs` | gh and git, an issue's fields, picture fetching, the GPU wait, keep-awake, checkouts, `localDir` |
| `jobs.mjs` | a job from issue to pull request; the runners' shared command line |
| `ask.mjs` / `status.mjs` / `doctor.mjs` | ask, follow, check the machine |
| `setup-runner.ps1` | the runner and its watchdog, once |
| `bf2017-stream.mjs` | the stream spike’s sender (above) |
| `inject.mjs` / `presentmon.mjs` | the game source’s input into a window, and its frame times |
| `../../.github/workflows/gen3d.yml`, `voices.yml`, `motion.yml` | the workflows |
| `../../.github/ISSUE_TEMPLATE/gen3d.yml`, `voices.yml`, `motion.yml` | the issue forms |
