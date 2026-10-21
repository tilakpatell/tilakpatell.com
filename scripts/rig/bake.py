"""scripts/gen3d/bake.py for a figure that will be skinned, headless:

    blender --background --python scripts/rig/bake.py -- RAW.glb OUT.glb [--faces 30000] [--tex 2048]

The same bake, with the raw model's vertices welded as it's read in. A
generated model's atlas is thousands of tiny charts, and a glTF splits its
vertices at every chart's edge; read in as it is, the decimation shrinks
each chart on its own and the low mesh comes out in thousands of pieces
with hairline cracks between them (a figure of 30,000 faces had 34,000 open
edges). A prop never moves, so it never shows; a figure bends at every
joint, the cracks open, and bone heat can't weight a mesh in pieces at all.
Welded, the raw model is one closed skin (1,656 open edges of 290,000 faces
on the first figure), and so is what's baked from it.
"""

import os
import runpy

import bpy

_read = bpy.ops.import_scene.gltf


class _Welded:
    # bake.py's own call to the importer, with merge_vertices on
    def gltf(self, **kw):
        kw.setdefault("merge_vertices", True)
        return _read(**kw)

    def __getattr__(self, name):
        return getattr(bpy.ops.import_scene.__class__, name)


bpy.ops.import_scene = _Welded()
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "gen3d", "bake.py"), run_name="__main__")
