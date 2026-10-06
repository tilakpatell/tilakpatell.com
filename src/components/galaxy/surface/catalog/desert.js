// The surface models for Tatooine, from Sketchfab: what
// scripts/sketchfab-surface.mjs brings in (`node scripts/sketchfab-surface.mjs desert`),
// each written to public/models/galaxy/surface/<kind>.glb standing on y = 0,
// facing +z, in metres. (The script's header has what each field means;
// `anim`, for a model kept rigged, names its clips: { idle, walk, run }.)
export const MODELS = {
  // a moisture vaporator, the tall pole of a Tatooine farm
  vaporator: { uid: 'acf6211d84eb4a46bb38c9a321771826', as: 'the moisture vaporators', metres: 5, along: 'y', yaw: 0, up: 'y', tris: 3000, tex: 512 },
  // Luke's X-34 landspeeder
  landspeeder: { uid: '3adfdc41c67f4731910800404ba97b4e', as: "Luke's landspeeder", metres: 3.4, along: 'z', yaw: 0, up: 'y', tris: 16000, tex: 1024 },
  jawa: { uid: '08124df6beef4ca18b2d24a25f5fd6bf', as: 'the Jawas', metres: 1, along: 'y', yaw: 0, up: 'y', tris: 8000, tex: 512 },
  bantha: { uid: '3581f3a312dc426d87af3031f5198edf', as: 'the banthas', metres: 2.8, along: 'y', yaw: 0, up: 'y', tris: 10000, tex: 512, gain: 1.3, rig: true, anim: { walk: 'Bantha_Walk' } },
  // a domed adobe house of Mos Eisley
  adobe: { uid: '66893ef6ad5f434e9db954b1f5496dfc', as: 'the adobe houses', metres: 10, along: 'max', yaw: Math.PI, up: 'y', tris: 35000, tex: 1024 },
  dewback: { uid: 'b84145ed48d143ff8746eda2623b3bd8', as: 'the dewbacks', metres: 4, along: 'max', yaw: 0, up: 'y', tris: 10000, tex: 512 },
  // Anakin's podracer
  podracer: { uid: 'dac6d14dcf914e88af8625b59f4020bc', as: 'the podracers', metres: 10, along: 'max', yaw: 0, up: 'y', tris: 16000, tex: 512, maps: 128 },
  // the rancor, rigged (its one clip a breathing idle)
  rancor: { uid: '983d578002d74691a3da6a5aad700a6c', as: 'the rancor', metres: 5, yaw: 0, tris: 20000, tex: 1024, maps: 512, rig: true, anim: { idle: 'Unreal Take' } },
  // Jabba's sail barge, the Khetanna (a diecast toy's shape)
  sailbarge: { uid: '47acb5ba43f74bba9c904c9c3bd5d83b', lod: true, as: "Jabba's sail barge", metres: 30, along: 'z', yaw: -Math.PI / 2, tris: 40000, tex: 1024 },
  jabba: { uid: '524e1fcf8c774573b5b15496efc4f572', as: 'Jabba the Hutt', metres: 3.9, along: 'max', yaw: 0, tris: 20000, tex: 1024, maps: 512 },
  // a GNK power droid
  gonk: { uid: '99e5fe9631d74b0aaa3ff0b8223c72d3', as: 'the gonk droids', metres: 1.1, yaw: 0, tris: 12000, tex: 512 },
  // Salacious B. Crumb (a scan of a collectible figure)
  salacious: { uid: '60b4c93af8644d21992a5ee6bd60af31', as: 'Salacious B. Crumb', metres: 0.7, yaw: 0, tris: 12000, tex: 1024 },
  // a dejarik holochess table, its monsters on the board
  dejarik: { uid: '49790bf56ec74e5c82b8ef462ae7ab68', as: 'the dejarik tables', metres: 1.6, along: 'max', yaw: 0, tris: 20000, tex: 1024 },
};
