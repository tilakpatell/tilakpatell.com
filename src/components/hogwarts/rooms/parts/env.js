// What the metal in a room reflects: the gold plates and goblets, the brass
// of the hourglasses, the iron, the glass. A metal with nothing to reflect is
// black; the room’s own light is a few hundred candles and a fire, so the
// reflection is made from a little scene of that (a dark warm box, warm
// spots high up where the candles float, the cold windows down the sides)
// and prefiltered once a room. Worn per material, so the world’s own sky
// reflection outside is never touched.
//
//   roomEnv(renderer, { warm, windows }) → Promise<texture | null>
//   wearEnv(materials, texture, k) → how many took it

import * as THREE from 'three';
import { PMREMGenerator } from 'three/webgpu';

export async function roomEnv(renderer, { warm = '#ffb46a', windows = '#3a4a70', walls = '#2a221c' } = {}) {
  if (!renderer) return null;
  const scene = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 40), new THREE.MeshBasicMaterial({ color: walls, side: THREE.BackSide }));
  scene.add(box);
  const spot = new THREE.MeshBasicMaterial({ color: new THREE.Color(warm).multiplyScalar(4) });
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), spot);
    m.position.set(((i * 7) % 9) - 4, 4 + (i % 3), ((i * 13) % 34) - 17);
    scene.add(m);
  }
  const win = new THREE.MeshBasicMaterial({ color: new THREE.Color(windows).multiplyScalar(1.5) });
  for (const x of [-9.9, 9.9])
    for (let z = -15; z <= 15; z += 6) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 5), win);
      m.position.set(x, 3, z);
      m.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(m);
    }
  const pmrem = new PMREMGenerator(renderer);
  try {
    const rt = pmrem.fromSceneAsync ? await pmrem.fromSceneAsync(scene, 0.02) : pmrem.fromScene(scene, 0.02);
    return rt.texture;
  } catch {
    return null;
  } finally {
    pmrem.dispose();
    scene.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  }
}

export function wearEnv(materials, texture, k = 1) {
  if (!texture) return 0;
  let n = 0;
  for (const m of materials) {
    if (!m || !('envMap' in m)) continue;
    m.envMap = texture;
    m.envMapIntensity = k;
    m.needsUpdate = true;
    n++;
  }
  return n;
}
