#!/usr/bin/env bash
# Runs the perf probe from the bench worktree: bench.sh <label> <journeys or --heavy> [qualities] [gpus]
# Writes into $B/.perf-out/<label>/<q>-<g>/ and a log beside.
B="C:/Users/tilak/source/repos/new-portfolio-website/.claude/worktrees/perf-lanes"
label="$1"; shift
what="$1"; shift
qs="${1:-low high}"; gs="${2:-webgl webgpu}"
cd "$B" || exit 1
export MSYS_NO_PATHCONV=1 MACHINE="RTX 5090"
for q in $qs; do for g in $gs; do
  o=".perf-out/$label/$q-$g"
  mkdir -p "$o"
  QUALITY=$q GPU=$g OUT="$o" node scripts/perf-probe.mjs $what > "$o.log" 2>&1
  echo "$label $q $g exit $?"
done; done
