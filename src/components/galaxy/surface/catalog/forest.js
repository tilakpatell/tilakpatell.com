// The surface models for Endor, Kashyyyk, Dagobah and Yavin 4, from Sketchfab: what
// scripts/sketchfab-surface.mjs brings in (`node scripts/sketchfab-surface.mjs forest`),
// each written to public/models/galaxy/surface/<kind>.glb standing on y = 0,
// facing +z, in metres. (The script's header has what each field means;
// `anim`, for a model kept rigged, names its clips: { idle, walk, run }.)
export const MODELS = {
  // the Imperial scout walker
  atst: { uid: '18164d3b3eb64ea1b8d3dc2ad5f4f9cf', as: 'the AT-ST walkers', metres: 8.6, yaw: 0, tris: 15000, tex: 1024, rig: true, anim: { idle: 'ATST Armature|Stationary pose', walk: 'ATST Armature|Walking action' } },
  // the 74-Z speeder bike, nose to +z
  speederbike: { uid: 'efbdcedb6f0a483b9046daa716d1ff6a', as: 'the speeder bikes', metres: 3.2, along: 'z', yaw: 0, tris: 14000, tex: 512 },
  ewok: { uid: '77fb4fc353c64b8098bc2f71667f1062', as: 'the Ewoks', metres: 1.0, yaw: 0, tris: 8000, tex: 512 },
  // an Imperial bunker, as on Endor
  bunker: { uid: '1c54abb1c6824f26a0a087d2bd7a635a', lod: true, as: 'the Imperial bunker', metres: 12, along: 'max', yaw: 0, up: 'y', tris: 35000, tex: 1024 },
  yoda: { uid: '04face8041ab4b108649093172c49af2', as: 'Yoda', metres: 0.66, yaw: -Math.PI / 2, up: 'y', tris: 6000, tex: 512 },
  // the Imperial shuttle, wings up
  lambda: { uid: 'ba88e6e431974dc2b920d43dccc750c6', as: 'the Imperial shuttles', metres: 20, yaw: Math.PI, up: 'y', tris: 14000, tex: 1024 },
  atrt: { uid: '6796698b4d564377838c06319ec96f90', as: 'the AT-RT walkers', metres: 3.2, yaw: 0, up: 'y', tris: 14000, tex: 1024 },
  atap: { uid: 'c721bd590a6d465387895d56a2c8aa9a', as: 'the AT-AP walkers', metres: 10, yaw: 0, up: 'y', tris: 25000, tex: 512, rig: true, anim: { idle: 'Armature|Idle', walk: 'Armature|Walker Walk' } },
};
