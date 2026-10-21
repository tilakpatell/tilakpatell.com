"""A standing figure's mesh bound to Meshy's 24 bones with Blender's automatic
(heat) weights, headless:

    blender --background --python scripts/rig/skin.py -- IN.glb JOB.json OUT.glb

skin.mjs writes IN.glb (the figure, plain: no meshopt, feet on y = 0, facing
+z) and JOB.json (each bone's name, parent, head and tail in the glTF's
metres, and whether it deforms), and reads OUT.glb back for its weights
alone: the skeleton the site plays on is built in JavaScript to Luke's frames,
so Blender's bone rolls and axes never reach the site. Only the weights do.

Heat weighting wants a closed surface, and a baked figure isn't one: bake.py
decimates the generated mesh chart by chart, so it comes apart along every
UV seam (a figure of 30,000 faces has some 35,000 open edges), and the
solver gives up on all of it. When more than proxyAt of the vertices come
out with no weight (or proxy is "always"), the weights are made on a voxel
remesh of the figure instead (one closed skin over the cracks), coarser
each time the solver still fails, and carried over to the real mesh by
nearest face. Whatever is still bare after that takes its nearest weighted
neighbour's.
"""

import json
import sys

import bpy
from mathutils import Vector, kdtree

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
src, job_file, out = argv[:3]
with open(job_file, encoding="utf-8") as f:
    job = json.load(f)

bpy.ops.wm.read_factory_settings(use_empty=True)
# (merged: a glTF splits its vertices at every UV seam, and heat doesn't cross a split)
bpy.ops.import_scene.gltf(filepath=src, merge_vertices=True)
scene = bpy.context.scene
layer = bpy.context.view_layer
meshes = [o for o in scene.objects if o.type == "MESH"]
if not meshes:
    sys.exit("no mesh in the GLB")
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
fig = layer.objects.active
fig.name = "figure"
fig.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in [o for o in scene.objects if o.type != "MESH"]:
    bpy.data.objects.remove(o)


def blend(p):
    # glTF's y up and +z ahead as Blender has them: z up, -y ahead
    return Vector((p[0], -p[2], p[1]))


data = bpy.data.armatures.new("Armature")
arm = bpy.data.objects.new("Armature", data)
scene.collection.objects.link(arm)
bpy.ops.object.select_all(action="DESELECT")
layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
edit = {}
for b in job["bones"]:
    e = data.edit_bones.new(b["name"])
    e.head = blend(b["head"])
    e.tail = blend(b["tail"])
    e.use_deform = bool(b["deform"])
    edit[b["name"]] = e
for b in job["bones"]:
    if b["parent"]:
        edit[b["name"]].parent = edit[b["parent"]]
        edit[b["name"]].use_connect = False
bpy.ops.object.mode_set(mode="OBJECT")
deform = [b["name"] for b in job["bones"] if b["deform"]]


def bind(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    arm.select_set(True)
    layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")


def bare(obj):
    # the vertices no deforming bone has any of
    groups = {g.index for g in obj.vertex_groups if g.name in deform}
    return [v.index for v in obj.data.vertices if sum(g.weight for g in v.groups if g.group in groups) < 1e-6]


bind(fig)
missing = bare(fig)
share = len(missing) / max(1, len(fig.data.vertices))
print(f"heat weights: {len(missing)} of {len(fig.data.vertices)} vertices bare ({share:.2%})", flush=True)
proxied = False


def remeshed(voxel):
    # one closed skin round the whole figure, weighted
    proxy = fig.copy()
    proxy.data = fig.data.copy()
    proxy.name = "proxy"
    scene.collection.objects.link(proxy)
    proxy.vertex_groups.clear()
    for m in list(proxy.modifiers):
        proxy.modifiers.remove(m)
    proxy.parent = None
    bpy.ops.object.select_all(action="DESELECT")
    layer.objects.active = proxy
    proxy.select_set(True)
    rm = proxy.modifiers.new("remesh", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = voxel
    bpy.ops.object.modifier_apply(modifier="remesh")
    bind(proxy)
    left = len(bare(proxy)) / max(1, len(proxy.data.vertices))
    print(f"proxy at {voxel * 1000:.1f} mm: {len(proxy.data.vertices)} vertices, {left:.2%} bare", flush=True)
    return proxy, left


if job.get("proxy") == "always" or (job.get("proxy") != "never" and share > job.get("proxyAt", 0.005)):
    # (a voxel too fine leaves the cracks open and the solver fails again: coarser, up to three times)
    voxel = job.get("voxel", 0.012)
    for attempt in range(3):
        proxy, left = remeshed(voxel * 1.5**attempt)
        if left < 0.01 or attempt == 2:
            break
        bpy.data.objects.remove(proxy)
    for g in list(fig.vertex_groups):
        fig.vertex_groups.remove(g)
    for name in deform:
        fig.vertex_groups.new(name=name)
    bpy.ops.object.select_all(action="DESELECT")
    layer.objects.active = fig
    fig.select_set(True)
    dt = fig.modifiers.new("weights", "DATA_TRANSFER")
    dt.object = proxy
    dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}
    dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "ALL"
    dt.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.modifier_move_to_index(modifier="weights", index=0)
    bpy.ops.object.modifier_apply(modifier="weights")
    bpy.data.objects.remove(proxy)
    proxied = True
    missing = bare(fig)

# what's still bare takes the weights of its nearest weighted vertex
if missing:
    gone = set(missing)
    tree = kdtree.KDTree(len(fig.data.vertices) - len(gone))
    for v in fig.data.vertices:
        if v.index not in gone:
            tree.insert(v.co, v.index)
    tree.balance()
    names = {g.index: g.name for g in fig.vertex_groups}
    for i in missing:
        _, j, _ = tree.find(fig.data.vertices[i].co)
        if j is None:
            continue
        for g in fig.data.vertices[j].groups:
            if names.get(g.group) in deform and g.weight > 0:
                fig.vertex_groups[names[g.group]].add([i], g.weight, "REPLACE")
    print(f"filled {len(missing)} bare vertices from their neighbours", flush=True)

bpy.ops.object.select_all(action="DESELECT")
layer.objects.active = fig
fig.select_set(True)
bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)

bpy.ops.object.select_all(action="DESELECT")
fig.select_set(True)
arm.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_skins=True,
    export_animations=False,
    export_influence_nb=4,
    export_all_influences=False,
    export_def_bones=True,
    export_image_format="WEBP",
    export_image_quality=92,
)
# what skin.mjs reports: how much of the figure the heat reached on its own
with open(out + ".json", "w", encoding="utf-8") as f:
    json.dump({"vertices": len(fig.data.vertices), "proxied": proxied, "bare": share}, f)
