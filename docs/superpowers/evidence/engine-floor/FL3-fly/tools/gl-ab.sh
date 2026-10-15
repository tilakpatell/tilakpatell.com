#!/usr/bin/env bash
# gl-calls.mjs A/B, interleaved: gl-ab.sh <classic-dir> <nodes-dir> <out.jsonl> [rounds] [qualities]
T="$(cd "$(dirname "$0")" && pwd)/gl-calls.mjs"
A="$1"; B="$2"; O="$3"; R="${4:-3}"; QS="${5:-low high}"
for r in $(seq 1 "$R"); do for q in $QS; do for d in "$A" "$B"; do
  (cd "$d" && QUALITY=$q PROFILE=1 timeout 900 node "$T" hoth 2>/dev/null | tail -1 | sed "s/^{/{\"q\":\"$q\",\"round\":$r,/") >> "$O"
done; done; done
