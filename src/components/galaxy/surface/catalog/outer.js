// The surface models for the Outer Rim of The Mandalorian and Ahsoka
// (Nevarro, Mandalore, Lothal, Sorgan), from Sketchfab: what
// scripts/sketchfab-surface.mjs brings in (`node scripts/sketchfab-surface.mjs outer`),
// each written to public/models/galaxy/surface/<kind>.glb standing on y = 0,
// facing +z, in metres. (The script's header has what each field means;
// `anim`, for a model kept rigged, names its clips: { idle, walk, run }.)
export const MODELS = {
  // Grogu, in his robe
  grogu: { uid: '485192995fea4845a92b3fd92b8b188e', as: 'Grogu', metres: 0.4, yaw: 0, tris: 10000, tex: 512 },
  // an IG-series assassin droid (IG-88's frame, as IG-11 is built)
  ig11: { uid: 'a692ce1902b44511992b47b8f4672e61', as: 'IG-11', metres: 2, yaw: -Math.PI / 4, tris: 3000, tex: 512, rig: true, anim: { idle: 'Take 001' } },
  kuiil: { uid: 'd9baac7f1b744086854b3cfd201497d1', as: 'Kuiil', metres: 1.2, yaw: 0, tris: 6000, tex: 512 },
  mudhorn: { uid: '4898a1f161a94bee9b73e86cfa088444', lod: true, as: 'the mudhorn', metres: 3, yaw: Math.PI / 2, tris: 20000, tex: 1024, maps: 512 },
  // the Razor Crest, landed
  razorcrest: { uid: '172cb62cc1e141cfae4c48440c348de0', lod: true, as: 'the Razor Crest', metres: 23, along: 'z', yaw: 0, tris: 30000, tex: 1024, maps: 512 },
  // Ahsoka Tano, grown (as on Corvus)
  ahsokafig: { uid: '6979913cf90342ffa37b1151641babd2', as: 'Ahsoka Tano', metres: 1.85, yaw: 0, tris: 6000, tex: 512 },
  // the Mandalorian, Din Djarin
  dindjarin: { uid: 'e70db49d54f04cdfbdbbd2e36f84f0a6', as: 'the Mandalorian', metres: 1.85, yaw: 0, tris: 16000, tex: 1024, maps: 512 },
};
