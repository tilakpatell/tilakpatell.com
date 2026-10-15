#!/usr/bin/env bash
# P4 on the bench: Battlefront at High and Low on WebGPU, before (P0's
# commit) and after (P4 with P0's probe), interleaved twice so a load from
# elsewhere falls on both; the census after; a profile each.
S="C:/Users/tilak/AppData/Local/Temp/claude/C--Users-tilak-source-repos-new-portfolio-website--claude-worktrees-delete-old-workflows-828863/3036bb66-a6a1-43bd-b2a0-4129f4050239/scratchpad"
B="C:/Users/tilak/source/repos/new-portfolio-website/.claude/worktrees/perf-lanes"
cd "$B" || exit 1
export MSYS_NO_PATHCONV=1 MACHINE="RTX 5090"
P0=claude/perf-p0-measure
at() {
  git checkout -q -- scripts/gpu-parity.mjs scripts/twin-parity.mjs 2>/dev/null
  git checkout -q --detach "$1" || exit 1
  if [ -n "$2" ]; then git merge -q --no-edit --no-ff "$2" >/dev/null || { git merge --abort; echo "merge $1 + $2 failed"; exit 1; }; fi
  echo "at $(git log --oneline -1)"
}
probe() {
  local label=$1 q=$2 g=$3; shift 3
  local o=".perf-out/$label/$q-$g"; mkdir -p "$o"
  QUALITY=$q GPU=$g OUT="$o" node scripts/perf-probe.mjs "$@" > "$o.log" 2>&1
  echo "$label $q $g exit $?"
}
for round in 1 2; do
  at $P0
  probe p4b-before-$round high webgpu battlefront
  at claude/perf-p4-main-thread $P0
  probe p4b-after-$round high webgpu battlefront
done
at $P0
probe p4b-before low webgpu battlefront
PROFILE=1 probe p4b-before-prof high webgpu battlefront
at claude/perf-p4-main-thread $P0
probe p4b-after low webgpu battlefront
PROFILE=1 probe p4b-after-prof high webgpu battlefront
node "$S/bf-census.mjs" > .perf-out/bf-census-after.json 2>&1; echo "census exit $?"
at $P0
echo done
