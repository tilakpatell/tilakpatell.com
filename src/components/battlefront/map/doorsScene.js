// The mode part's moving and switching things drawn and made solid (map/
// doors.js says where and whether): each instance the part's far table gave
// up (map/level.js's `modePart.rows`, doorsTable.js's split) one object of
// its mesh's first shipped LOD under the part's group, in the pack's frame,
// and one body of its mesh's own shapes (the pack's physics section, lane
// P0's havok.js) in the physics world, which is that frame too: a door's or
// a gate's leaf a kinematic body moved with it, a prop a fixed body there
// while it is shown and gone while it is not. A gate the graph has blown
// loses its leaves, drawn and solid.
//
//   createDoorsScene({ part, physics = null }) → { ready: Promise, update(state), stats(), dispose() }
//   (part: map/level.js's modePart; physics: lane P0's world, or none: then only drawn;
//    update(state): map/doors.js's state, after stepDoors, once a frame)

import { collidersOf, instanceBody, readShapes } from '../../../lib/physics/havok.js';
import { gateStands, shown } from './doors.js';

// the first LOD the pack ships of a mesh (a pack built without --ultra holds none under the high cap)
const fileOf = (mesh) => (mesh?.glb ?? []).find(Boolean) ?? null;

export function createDoorsScene({ part, physics = null }) {
  const items = [];
  let gone = false;
  const shapes = new Map(); // mesh → Promise<colliders | null>
  const section = part.pack.physics ?? { meshes: {}, materials: {} };
  const collidersFor = (mesh) => {
    const key = String(mesh);
    if (!shapes.has(key)) {
      const rec = section.meshes?.[key];
      shapes.set(key, rec ? Promise.resolve(part.loadBin(rec.file)).then((buf) => collidersOf(readShapes(buf), { materials: section.materials })).catch(() => null) : Promise.resolve(null));
    }
    return shapes.get(key);
  };

  const ready = Promise.resolve(part.rows).then(async (rows) => {
    for (const row of rows ?? []) {
      if (gone) return;
      const item = { row, object: null, body: null, colliders: null, on: null, leaf: row.is.kind === 'leaf' };
      items.push(item);
      const file = fileOf(part.pack.meshes[row.mesh]);
      const [gltf, colliders] = await Promise.all([file ? part.loadGltf(file).catch(() => null) : null, physics ? collidersFor(row.mesh) : null]);
      if (gone) return;
      if (gltf?.scene) {
        const o = gltf.scene.clone(true);
        o.name = `mode:${row.is.id}`;
        o.position.fromArray(row.position);
        o.quaternion.fromArray(row.quaternion).normalize();
        o.scale.fromArray(row.scale);
        o.traverse((m) => {
          if (!m.isMesh) return;
          m.castShadow = true;
          m.receiveShadow = true;
        });
        o.visible = false;
        part.group.add(o);
        item.object = o;
      }
      item.colliders = colliders?.length ? colliders : null;
    }
  });

  const bodyOf = (item) => {
    if (!physics || !item.colliders || item.body) return item.body;
    const desc = instanceBody(item.colliders, { position: item.row.position, quaternion: item.row.quaternion, scale: item.row.scale }, item.row.mesh);
    try {
      item.body = physics.add(item.leaf ? { ...desc, type: 'kinematicPositionBased' } : desc);
    } catch {
      item.colliders = null; // (shapes the engine won't build: drawn, not solid)
    }
    return item.body;
  };
  const drop = (item) => {
    if (!item.body) return;
    physics.remove(item.body);
    item.body = null;
  };

  return {
    ready,
    update(state) {
      if (gone) return;
      for (const item of items) {
        const is = item.row.is;
        let on = true;
        if (item.leaf) {
          on = state.gates.some((g) => g.def.id === is.id) ? gateStands(state, is.id) : true;
          const k = (state.doors.find((d) => d.def.id === is.id) ?? state.gates.find((d) => d.def.id === is.id))?.ip.value ?? 0;
          const [x, y, z] = item.row.position;
          const p = [x + is.leaf.slide[0] * k, y + is.leaf.slide[1] * k, z + is.leaf.slide[2] * k];
          item.object?.position.fromArray(p);
          if (on) {
            const b = bodyOf(item);
            b?.body.setNextKinematicTranslation({ x: p[0], y: p[1], z: p[2] });
          }
        } else on = shown(state, is.prop, is.part);
        if (on === item.on) continue;
        item.on = on;
        if (item.object) item.object.visible = on;
        if (on) bodyOf(item);
        else drop(item);
      }
    },
    stats: () => ({ things: items.length, drawn: items.filter((i) => i.object?.visible).length, bodies: items.filter((i) => i.body).length }),
    dispose() {
      gone = true;
      for (const item of items) {
        item.object?.removeFromParent();
        drop(item);
      }
      items.length = 0;
    },
  };
}
