// A level's reflection probe as the scene's environment. One alive at a time:
// a world's probe is disposed when the next arrives, and a load that is
// overtaken by a newer one is thrown away on arrival, so a quick zone change
// never leaves two prefiltered cubes on the GPU.

import * as THREE from 'three';
import { HDRCubeTextureLoader } from 'three/examples/jsm/loaders/HDRCubeTextureLoader.js';

// A face's bytes, held to being a file: a 404 or a page in its place (a dev
// server's index.html for a face left in the bucket) is a failed load, not
// an HDR the parser throws on outside any promise. → Promise<blob URL>
export async function faceUrl(url, get = fetch) {
  const r = await get(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  if (/text\/html/i.test(r.headers?.get?.('content-type') ?? '')) throw new Error(`not a probe face (a page) ${url}`);
  return URL.createObjectURL(new Blob([await r.arrayBuffer()]));
}

const loadFaces = async (urls) => {
  const blobs = await Promise.all(urls.map((u) => faceUrl(u)));
  try {
    return await new HDRCubeTextureLoader().setDataType(THREE.HalfFloatType).loadAsync(blobs);
  } finally {
    for (const b of blobs) URL.revokeObjectURL(b);
  }
};

// load(urls) → Promise<CubeTexture>; pmrem: a PMREMGenerator. Both are
// injected so the bookkeeping is tested without a GPU.
export function createProbeEnv({ renderer, load, pmrem } = {}) {
  const loader = load ?? loadFaces;
  const gen = pmrem ?? new THREE.PMREMGenerator(renderer);
  let env = null;
  let key = null;
  let ticket = 0;

  async function loadProbe(urls) {
    const want = urls.join('|');
    // (asked for what it has: that, and anything still on its way is late)
    const mine = ++ticket;
    if (env && key === want) return env;
    const cube = await loader(urls);
    const next = gen.fromCubemap(cube).texture;
    cube.dispose();
    if (mine !== ticket) {
      next.dispose();
      return null;
    }
    env?.dispose();
    env = next;
    key = want;
    return env;
  }

  return {
    load: loadProbe,
    current: () => env,
    dispose() {
      ticket++;
      env?.dispose();
      env = null;
      key = null;
      gen.dispose();
    },
  };
}
