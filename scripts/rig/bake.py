"""scripts/gen3d/bake.py for a figure that will be skinned, headless:

    blender --background --python scripts/rig/bake.py -- RAW.glb OUT.glb [--faces 30000] [--tex 2048] [--cage 0.08] [--voxel 400]

The same bake, its low mesh made from a voxel remesh of the raw model (a
400th of its size) rather than from the raw model itself. A generated model
is many shells with hairline gaps between them, and decimated as it is the
low mesh keeps every gap: the first figure came out with 34,000 positions
for 30,000 faces (a closed skin has half as many) and 48,000 vertices once
its charts were cut. A figure bends at every joint, and the gaps open; and a
skinned vertex carries its joints and weights too, so the gaps cost a cast of
thirty a third of its bytes. Remeshed, the low mesh is one skin: 30,000
faces on 15,000 places and 37,000 vertices, no cracks. The colours still
come from the raw model, by the bake, with the cage pushed out four times as
far (--cage 0.08 of the size): the remesh rounds a fringe's and a beard's
spikes off, and a ray started any nearer lands on the forehead under them
(the first figure's hair came out patched with skin at 0.02 and 0.04).

"""

import os
import runpy
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def take(flag, default):
    # (an argument of ours, taken out before bake.py reads the rest)
    if flag not in argv:
        return default
    i = argv.index(flag)
    v = argv[i + 1]
    del argv[i : i + 2]
    return v


divisions = float(take("--voxel", 400))
faces = int(argv[argv.index("--faces") + 1]) if "--faces" in argv else 24000
if "--cage" not in argv:
    argv += ["--cage", "0.08"]
sys.argv = sys.argv[: sys.argv.index("--") + 1] + argv

_object = bpy.ops.object


class _Object:
    # bake.py's decimation of its low copy, with the remesh before it
    def modifier_apply(self, **kw):
        if kw.get("modifier") == "decimate":
            low = bpy.context.view_layer.objects.active
            rm = low.modifiers.new("remesh", "REMESH")
            rm.mode = "VOXEL"
            rm.voxel_size = max(low.dimensions) / divisions
            _object.modifier_move_to_index(modifier="remesh", index=0)
            _object.modifier_apply(modifier="remesh")
            # (the remesh is quads, each two of the triangles asked for)
            low.modifiers["decimate"].ratio = min(1.0, faces / 2 / max(1, len(low.data.polygons)))
            print(f"remeshed the low copy: {len(low.data.polygons)} quads", flush=True)
        return _object.modifier_apply(**kw)

    def __getattr__(self, name):
        return getattr(_object, name)


bpy.ops.object = _Object()
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "gen3d", "bake.py"), run_name="__main__")
