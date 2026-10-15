#!/usr/bin/env bash
# The fly journey A/B, interleaved: ab.sh <before-dir> <after-dir> <out> [rounds] [qualities]
# Each round runs the classic side (the before checkout, GPU=webgl: its
# module is 'glsl', so the classic renderer) and then the node side (the
# after checkout, GPU=webgl: 'nodes-webgl'), one browser at a time, at each
# quality. VIEW is 1280x800@1 (SwiftShader in the cloud: the 2x retina
# window takes minutes a frame there); the main thread's numbers are the point.
A="$1"; B="$2"; O="$3"; R="${4:-2}"; QS="${5:-low high}"
export VIEW="${VIEW:-1280x800@1}"
mkdir -p "$O"
for r in $(seq 1 "$R"); do for q in $QS; do
  for side in classic nodes; do
    d=$([ $side = classic ] && echo "$A" || echo "$B")
    o="$O/$q-$side-$r"
    (cd "$d" && QUALITY=$q GPU=webgl OUT="$o" node scripts/perf-probe.mjs fly > "$o.log" 2>&1)
    echo "$q $side $r exit $?"
  done
done; done
