# twin-parity

Does a lane T twin (`src/lib/three/*Nodes.js`, `src/components/galaxy/surface/nodes/`) draw what its GLSL original drew? `scripts/twin-parity.mjs` builds each case in `cases.js` twice in Chromium: once with the original on `WebGLRenderer`, once with the twin on three's node renderer (WebGL 2, or WebGPU with `GPU=webgpu`), each through its renderer's post chain (or the case's own), and diffs the two pictures at 256 × 256. The floor bake's case diffs the baked mask, channel by channel, instead.

```sh
node scripts/twin-parity.mjs              # every case
node scripts/twin-parity.mjs sky water    # the cases whose names hold these
GPU=webgpu node scripts/twin-parity.mjs   # the node side on WebGPU
```

The pictures go to `scripts/twin-parity/out/` (gitignored), `<case>-node.png` and `<case>-glsl.png`. The table is markdown, for a pull request. A twin passes at the parity check's line (`scripts/gpu-parity/README.md`): 32 dB and under 2 % of its pixels more than 16/255 off. Exit 1 when a case logs an error or throws.

It is the shader-level check under the world-level one: when `scripts/gpu-parity.mjs` finds a world off, this says which twin. A new twin adds its case here, built the same way on both sides.

In the cloud container it runs on SwiftShader (both sides); the numbers in lane T's pull request are SwiftShader's.
