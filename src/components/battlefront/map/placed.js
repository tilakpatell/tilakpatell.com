// What a level's pack places beside its pieces (lane E0's actors.json and
// vehicles.json), stood in the game world where the game put them (lane
// G2): its creatures and droids still, its vehicles parked at their spawns,
// each the galaxy's model of its kind (galaxy/shared/models.js), once a kind
// and cloned. Scenery until lane G5's vehicles are the sim's entities. A
// kind the galaxy has no model for is counted, never drawn.
//
//   createPlaced({ group, rows, heightAt, models, loadModel }) → { count(), skipped(), dispose() }
//     rows: [{ kind, at: [x, z], face | yaw }] in the pack's frame

import * as THREE from 'three';

const shared = () => import('../../galaxy/shared/models.js');

export function createPlaced({ group, rows = [], heightAt = () => 0, models = null, loadModel = null }) {
  const root = new THREE.Group();
  root.name = 'placed';
  group.add(root);
  let gone = false;
  let stood = 0;
  let missed = 0;
  const kinds = new Map(); // kind → Promise<gltf | null>
  (async () => {
    const lib = models && loadModel ? { SURFACE_MODELS: models, loadModel } : await shared().catch(() => null);
    if (!lib || gone) return;
    for (const r of rows) {
      if (!lib.SURFACE_MODELS[r.kind]) {
        missed++;
        continue;
      }
      if (!kinds.has(r.kind)) kinds.set(r.kind, Promise.resolve(lib.loadModel(r.kind)).catch(() => null));
      kinds.get(r.kind).then((g) => {
        if (gone || !g?.scene) return void missed++;
        const o = g.scene.clone(true);
        const [x, z] = r.at;
        o.position.set(x, heightAt(x, z), z);
        o.rotation.y = r.face ?? r.yaw ?? 0;
        root.add(o);
        stood++;
      });
    }
  })();
  return {
    count: () => stood,
    skipped: () => missed,
    dispose() {
      gone = true;
      root.removeFromParent();
    },
  };
}
