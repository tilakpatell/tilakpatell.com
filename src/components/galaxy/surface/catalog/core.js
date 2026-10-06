// The surface models for Naboo, Coruscant, Kamino and Geonosis, from Sketchfab: what
// scripts/sketchfab-surface.mjs brings in (`node scripts/sketchfab-surface.mjs core`),
// each written to public/models/galaxy/surface/<kind>.glb standing on y = 0,
// facing +z, in metres. (The script's header has what each field means;
// `anim`, for a model kept rigged, names its clips: { idle, walk, run }.)
export const MODELS = {
  // Jar Jar Binks
  gungan: { uid: '85aef3e496d44e9b95c7386035c0ef10', as: 'the Gungans', metres: 1.96, yaw: 0, tris: 8000, tex: 384 },
  // the Jedi Temple on Coruscant
  jeditemple: { uid: '317dedec15a845cbb1abc8c90804b840', lod: true, as: 'the Jedi Temple', metres: 300, along: 'max', yaw: -Math.PI / 2, up: 'y', tris: 35000, tex: 1024, drop: /Plane001/ },
  // the Republic gunship
  laat: { uid: 'cf7f6043210a418abdd818d5e8dd0fd8', as: 'the Republic gunships', metres: 17.4, along: 'z', yaw: -Math.PI / 2, up: 'y', tris: 16000, tex: 1024 },
  atte: { uid: '93890aa7a2c84102a4a28af05bd07c9b', lod: true, as: 'the AT-TE walkers', metres: 22, along: 'max', yaw: 0, up: 'y', tris: 25000, tex: 1024 },
  // the Petranaki arena on Geonosis
  arena: { uid: '797d475ee192467399c0ee6ee15b41ed', lod: true, as: 'the Geonosian arena', metres: 150, along: 'max', yaw: 0, up: 'y', tris: 35000, tex: 256, drop: /chariot|Visor|Meathook|setka|WorldGrid|lambert1/ },
  // Tipoca City on Kamino
  tipoca: { uid: '9c569d83df584c06b1c6ea1b496a4704', as: 'Tipoca City', metres: 40, along: 'max', yaw: 0, up: 'y', tris: 35000, tex: 1024 },
  // a Coruscant airspeeder, nose to +z
  airspeeder: { uid: '7766ca8e7bd047f5ad4bdb86d11ec6d4', as: 'the airspeeders', metres: 6, along: 'z', yaw: 0, up: 'y', tris: 16000, tex: 1024 },
  droideka: { uid: 'f3688d384b2042b6a8fc3360f64b9a48', as: 'the droidekas', metres: 1.8, yaw: Math.PI, up: 'y', tris: 8000, tex: 512 },
  kaminoan: { uid: '5d758c4455b24ac383b94d7a4e30bbce', as: 'the Kaminoans', metres: 2.6, yaw: 0, up: 'y', tris: 8000, tex: 512 },
  geonosian: { uid: '021a5902e34c4742a828335c86bfe4cd', as: 'the Geonosians', metres: 1.7, yaw: Math.PI, up: 'y', tris: 8000, tex: 512 },
};
