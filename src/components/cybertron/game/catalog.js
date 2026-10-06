// The models Cybertron's world is made of, the Aligned continuity's own:
// High Moon Studios' War for Cybertron and Fall of Cybertron for Iacon at
// war, Transformers: Prime for Team Prime's base and Jasper. Each is someone
// else's upload on Sketchfab (CC BY; who made it and where it came from are
// in src/data/modelCredits.json as cybertron-<kind>), brought in by
// scripts/sketchfab-cybertron.mjs with the settings here: stood on the
// ground facing +z, `metres` tall (or long, along `along`), at `file`.
//
// What the game reads besides: `role` (player, vehicle, npc, boss, enemy,
// landmark, prop), `era` (wfc, foc or tfp), `rig` (a skeleton kept, for
// lib/three/rig.js to pose; `still`: never given a skeleton of our own,
// for a robot whose shape the auto-rig can't read) and `clips` (what its own animation is: an
// idle, or the High Moon rips' whole transformation, robot to vehicle and
// back, with where in it each change is: `toVehicle` and `toRobot` from and
// to, in seconds, and `vehicle` a moment it's all vehicle).

export const MODELS = {
  // Iacon at war: War for Cybertron and Fall of Cybertron (High Moon Studios)
  'optimus-wfc': { uid: '5b4d634974c240f9988ac985f3ff4c0b', as: 'Optimus Prime (War for Cybertron), whom you play in Iacon', metres: 9.5, tris: 40000, tex: 2048, maps: 1024, drop: 'ButterflyAxe', rig: true, file: '/models/cybertron/optimus-wfc.glb', role: 'player', era: 'wfc', clips: { idle: 'Scene' } },
  'cybertruck': { uid: 'c7c10850cb60418d98c99eca2cb790ff', as: 'Optimus\'s Cybertronian truck (Fall of Cybertron), his alt mode in Iacon', metres: 9, along: 'max', tris: 25000, tex: 1024, file: '/models/cybertron/cybertruck.glb', role: 'vehicle', era: 'foc' },
  'bumblebee-wfc': { uid: '538ff8ba697c46618bedf6f4f8d511bd', as: 'Bumblebee (War for Cybertron)', metres: 6.2, tris: 25000, tex: 1024, rig: true, file: '/models/cybertron/bumblebee-wfc.glb', role: 'npc', era: 'wfc', clips: { idle: 'Scene' } },
  'bumblebee-car-wfc': { uid: '39c486035c7e4ebab8126244ebd29242', as: 'Bumblebee\'s Cybertronian car (War for Cybertron)', metres: 5.6, along: 'max', tris: 20000, tex: 1024, file: '/models/cybertron/bumblebee-car-wfc.glb', role: 'vehicle', era: 'wfc' },
  'jazz': { uid: '0db393eeea54496b853d8024d44f45b1', as: 'Jazz (War for Cybertron)', metres: 6.6, tris: 25000, tex: 1024, rig: true, file: '/models/cybertron/jazz.glb', role: 'npc', era: 'wfc' },
  'grimlock': { uid: 'f6f6af8ab56b49aba821e4cd7e37d108', as: 'Grimlock (Fall of Cybertron)', metres: 12, yaw: -1.5708, node: 'grimlock_bot', tris: 22000, tex: 1024, maps: 512, rig: true, file: '/models/cybertron/grimlock.glb', role: 'npc', era: 'foc' },
  'jetfire': { uid: '4e61515eca0b4c10b963fb67b0fa8243', as: 'Jetfire (Fall of Cybertron)', metres: 10.5, yaw: -1.5708, node: 'RB_Jetfire', tris: 22000, tex: 1024, maps: 512, rig: true, file: '/models/cybertron/jetfire.glb', role: 'npc', era: 'foc' },
  'jetfire-jet': { uid: '4e61515eca0b4c10b963fb67b0fa8243', as: 'Jetfire\'s jet mode (Fall of Cybertron), flying over Iacon', metres: 18, along: 'max', yaw: -1.5708, node: 'VH_Jetfire', tris: 8000, tex: 1024, maps: 512, file: '/models/cybertron/jetfire-jet.glb', role: 'vehicle', era: 'foc' },
  'zeta-prime': { uid: 'cd3ac403e72142ffb73d43632d3de9bb', as: 'Zeta Prime (War for Cybertron)', metres: 10, tris: 25000, tex: 1024, rig: true, file: '/models/cybertron/zeta-prime.glb', role: 'npc', era: 'wfc' },
  'megatron-foc': { uid: '25ab3faed0344431a6c08652dd1a828b', as: 'Megatron (Fall of Cybertron), and his change to a tank and back', metres: 10.5, tris: 30000, tex: 1024, maps: 256, rig: true, file: '/models/cybertron/megatron-foc.glb', role: 'boss', era: 'foc', clips: { transform: 'Scene', toVehicle: [5.3, 7.4], vehicle: 9, toRobot: [11.6, 13.2] } },
  'soundwave-foc': { uid: '6a0c0fa440954d6da747cdd050a2d1ab', as: 'Soundwave (Fall of Cybertron), watching from a roof', metres: 10, tris: 20000, tex: 1024, maps: 512, drop: 'Laserbeak', rig: true, file: '/models/cybertron/soundwave-foc.glb', role: 'npc', era: 'foc', clips: { idle: 'Scene' } },
  'shockwave-foc': { uid: '1f085604064043279e5a42ea9269fe8e', as: 'Shockwave (Fall of Cybertron)', metres: 11, tris: 25000, tex: 1024, rig: true, file: '/models/cybertron/shockwave-foc.glb', role: 'npc', era: 'foc' },
  'barricade': { uid: 'b7a7056e4e4646e1a145987b0a4bafa5', as: 'Barricade (War for Cybertron), and his change to a car and back', metres: 7.2, tris: 20000, tex: 1024, rig: true, file: '/models/cybertron/barricade.glb', role: 'enemy', era: 'wfc', clips: { transform: 'Scene', toVehicle: [4.15, 5.8], vehicle: 9, toRobot: [14.2, 16] } },
  'trooper': { uid: '636d65ae58a441078cccb53756440190', as: 'the Decepticon troopers (Fall of Cybertron)', metres: 7, yaw: -1.5708, node: 'Sea_of_Rust_soldier', tris: 10000, tex: 512, rig: true, file: '/models/cybertron/trooper.glb', role: 'enemy', era: 'foc' },
  'sniper': { uid: '636d65ae58a441078cccb53756440190', as: 'the Decepticon snipers (Fall of Cybertron)', metres: 7.4, yaw: -1.5708, node: 'decepticon_Sniper_ARM', tris: 10000, tex: 512, rig: true, file: '/models/cybertron/sniper.glb', role: 'enemy', era: 'foc' },
  'leaper': { uid: '636d65ae58a441078cccb53756440190', as: 'the Decepticon leapers (Fall of Cybertron)', metres: 6.4, yaw: -1.5708, node: 'leaper_ARM', tris: 10000, tex: 512, rig: true, file: '/models/cybertron/leaper.glb', role: 'enemy', era: 'foc' },
  'metroplex': { uid: '8b9864031eff48c4bab046aec29203e2', as: 'Metroplex (Fall of Cybertron), on the skyline', metres: 260, tris: 40000, tex: 1024, file: '/models/cybertron/metroplex.glb', role: 'landmark', era: 'foc' },
  'trypticon': { uid: 'cb7483d786fa4fd7a487d33428b48366', as: 'Trypticon (Fall of Cybertron), far off', metres: 180, tris: 30000, tex: 1024, file: '/models/cybertron/trypticon.glb', role: 'landmark', era: 'foc' },
  'space-bridge': { uid: '28d9d78cf1bd490b8b9472a7eca8400b', as: 'the space bridge', metres: 40, along: 'max', tris: 8000, tex: 1024, file: '/models/cybertron/space-bridge.glb', role: 'prop', era: 'foc' },
  'matrix': { uid: '935368cbc67b4639a1bbeecebd4281cc', as: 'the Matrix of Leadership (Fall of Cybertron)', metres: 0.9, along: 'max', tris: 4000, tex: 512, file: '/models/cybertron/matrix.glb', role: 'prop', era: 'foc' },
  'energon': { uid: '1c2e277c8c6b4c379ae55099c3122db1', as: 'the energon crystals', metres: 2.2, tris: 2000, tex: 512, file: '/models/cybertron/energon.glb', role: 'prop', era: 'foc' },
  'wheeljack-car': { uid: 'f446eac2bc664d2eae82c5aedabd4c06', as: 'Wheeljack\'s car (Fall of Cybertron), parked in Iacon', metres: 5.6, along: 'max', tris: 15000, tex: 1024, file: '/models/cybertron/wheeljack-car.glb', role: 'vehicle', era: 'foc' },
  // (the two of them small and still, for the universe map: on Cybertron's
  // orbit, and standing on its plating when you land)
  'optimus-orbit': { uid: '5b4d634974c240f9988ac985f3ff4c0b', as: 'Optimus Prime (War for Cybertron), on Cybertron\'s orbit in the universe map', metres: 9.5, tris: 9000, tex: 512, maps: 256, drop: 'ButterflyAxe', pose: 0, also: ['universe'], file: '/models/cybertron/optimus-orbit.glb', role: 'prop', era: 'wfc' },
  'megatron-orbit': { uid: '25ab3faed0344431a6c08652dd1a828b', as: 'Megatron (Fall of Cybertron), across Cybertron\'s orbit from him', metres: 10.5, tris: 9000, tex: 256, maps: 128, pose: 0, also: ['universe'], file: '/models/cybertron/megatron-orbit.glb', role: 'prop', era: 'foc' },
  // more of Fall of Cybertron's cast (hafid.quispe's uploads, each with its
  // robot and its vehicle in one file: split by node, the loose parts of the
  // other form left off): Starscream and his seekers for Kaon, Autobots for
  // its raiders, Ultra Magnus for Iacon
  'starscream-foc': { uid: 'f35afcf0967a4e1bb9926b4b2866ddc1', as: 'Starscream (Fall of Cybertron), in Kaon', metres: 9.5, yaw: 1.5708, node: 'Starscream-FoC_ARM', skinnedOnly: true, tris: 20000, tex: 1024, rig: true, file: '/models/cybertron/starscream-foc.glb', role: 'npc', era: 'foc' },
  'skywarp-jet': { uid: '81e1de0e69324c129e4d564759d775be', as: 'Skywarp\'s jet (Fall of Cybertron), over Kaon', metres: 13, along: 'max', yaw: 1.5708, node: 'Starscream-VH_ARM', tris: 8000, tex: 1024, file: '/models/cybertron/skywarp-jet.glb', role: 'vehicle', era: 'foc' },
  'thundercracker-jet': { uid: 'b639714d67a744339190e264009a134b', as: 'Thundercracker\'s jet (Fall of Cybertron), over Kaon', metres: 13, along: 'max', yaw: 1.5708, node: 'Starscream-VH_ARM', tris: 8000, tex: 1024, file: '/models/cybertron/thundercracker-jet.glb', role: 'vehicle', era: 'foc' },
  'ironhide-foc': { uid: 'bca7d4ec915347aaa1f4dd3ebf0c4b1c', as: 'Ironhide (Fall of Cybertron), raiding Kaon', metres: 8.5, yaw: 1.5708, node: '^(Ironhide_ARM|RB_Ironhide)', skinnedOnly: true, tris: 18000, tex: 1024, rig: true, file: '/models/cybertron/ironhide-foc.glb', role: 'enemy', era: 'foc' },
  'warpath-foc': { uid: '45b7d7e247314a3e92df394fc3057d05', as: 'Warpath (Fall of Cybertron), raiding Kaon', metres: 8, yaw: -1.5708, node: '^RB_Warpath', skinnedOnly: true, tris: 18000, tex: 1024, rig: true, file: '/models/cybertron/warpath-foc.glb', role: 'enemy', era: 'foc' },
  'ratchet-foc': { uid: '08c5f80bb63040df8280a0bf6ac99b9e', as: 'Ratchet (Fall of Cybertron), raiding Kaon', metres: 8.5, yaw: 1.5708, node: '^RB_Ratchet', skinnedOnly: true, tris: 18000, tex: 1024, rig: true, file: '/models/cybertron/ratchet-foc.glb', role: 'enemy', era: 'foc' },
  'ultra-magnus-foc': { uid: '115e3e99f69c4eae9f25f503c62c7add', as: 'Ultra Magnus (Fall of Cybertron), in Iacon', metres: 11, yaw: 1.5708, node: 'qc_skeleton|^FoC_Ultra_Magnus_(R|L)_', still: true, tris: 20000, tex: 1024, file: '/models/cybertron/ultra-magnus-foc.glb', role: 'npc', era: 'foc' },
  // Team Prime's base and Jasper: Transformers: Prime
  'optimus-tfp': { uid: 'd4c02597e39541518293a95a4afeadfe', as: 'Optimus Prime (Transformers: Prime), whom you play on Earth', metres: 9.5, tris: 12000, tex: 1024, file: '/models/cybertron/optimus-tfp.glb', role: 'player', era: 'tfp' },
  'truck-tfp': { uid: 'e75947aff6ad40b498c9f77eb76d06ef', as: 'Optimus\'s truck (Transformers: Prime)', metres: 8.5, along: 'max', tris: 25000, tex: 1024, file: '/models/cybertron/truck-tfp.glb', role: 'vehicle', era: 'tfp' },
  'bumblebee-tfp': { uid: '8b56f3daed3b4c3a8d8ecec663031fe1', as: 'Bumblebee (Transformers: Prime)', metres: 6.2, tris: 24000, tex: 1024, file: '/models/cybertron/bumblebee-tfp.glb', role: 'npc', era: 'tfp' },
  'bumblebee-car-tfp': { uid: 'bb60cf1d49cc4856abc9116e5ea239e7', as: 'Bumblebee\'s car (Transformers: Prime)', metres: 4.8, along: 'max', tris: 5000, tex: 1024, file: '/models/cybertron/bumblebee-car-tfp.glb', role: 'vehicle', era: 'tfp' },
  'arcee': { uid: '26956dff2a7e41bf8b4c4e5a5b6af58b', as: 'Arcee (Transformers: Prime)', metres: 5.6, tris: 30000, tex: 1024, rig: true, file: '/models/cybertron/arcee.glb', role: 'npc', era: 'tfp' },
  'ratchet': { uid: '7c87433e653245eb9c286ad7d39050e3', as: 'Ratchet (Transformers: Prime)', metres: 7.6, tris: 6000, tex: 1024, file: '/models/cybertron/ratchet.glb', role: 'npc', era: 'tfp' },
  'bulkhead': { uid: '518f2ef8efaa426592e9e22e81768a3d', as: 'Bulkhead (Transformers: Prime)', metres: 8, node: 'Armature|Empty_Legoi', tris: 12000, tex: 1024, rig: true, file: '/models/cybertron/bulkhead.glb', role: 'npc', era: 'tfp' },
  'bulkhead-car': { uid: '518f2ef8efaa426592e9e22e81768a3d', as: 'Bulkhead\'s truck (Transformers: Prime)', metres: 6, along: 'max', node: 'bulkhead_Car', tris: 8000, tex: 1024, file: '/models/cybertron/bulkhead-car.glb', role: 'vehicle', era: 'tfp' },
  'megatron-tfp': { uid: 'edaf84f0f99043619d80f9c95ba32ee4', as: 'Megatron (Transformers: Prime)', metres: 10.5, tris: 25000, tex: 1024, drop: '^material00', rig: true, file: '/models/cybertron/megatron-tfp.glb', role: 'boss', era: 'tfp' },
  'soundwave-tfp': { uid: 'c72b2a731d2f4bdfa41a99586c877627', as: 'Soundwave (Transformers: Prime)', metres: 10.5, tris: 25000, tex: 1024, rig: true, file: '/models/cybertron/soundwave-tfp.glb', role: 'npc', era: 'tfp' },
  'vehicon': { uid: '74294a7573974039a3431411934b3b08', as: 'the Vehicons (Transformers: Prime)', metres: 7, tris: 12000, tex: 512, colours: [['paint_01', '#3b3d4a', 0.6, 0.4], ['paint_02', '#5b2d7a', 0.5, 0.4], ['Protoform', '#2b2c33', 0.5, 0.5], ['Glass', '#ff2a3a', 0.1, 0.2], ['Face', '#9aa0aa', 0.7, 0.35], ['Rubber', '#141414', 0, 0.9], ['Hand', '#4a4c57', 0.6, 0.4], ['Mech', '#5a5d66', 0.7, 0.4], ['Canon', '#3a3c44', 0.7, 0.4], ['^material', '#46485a', 0.6, 0.4]], rig: true, file: '/models/cybertron/vehicon.glb', role: 'enemy', era: 'tfp' },
  'predaking': { uid: 'af924859c131440cb5b06f915949f892', as: 'Predaking (Transformers: Prime), flying over Jasper', metres: 14, tris: 25000, tex: 1024, colours: [['.', '#b69a62', 0.7, 0.35]], rig: true, file: '/models/cybertron/predaking.glb', role: 'landmark', era: 'tfp' },
  'dreadwing-jet': { uid: 'ee47da73cf6e4ccab484f726db7f3592', as: 'Dreadwing\'s jet (Transformers: Prime), flying over Jasper', metres: 16, along: 'max', tris: 4000, tex: 512, colours: [['.', '#3c4a63', 0.6, 0.4]], file: '/models/cybertron/dreadwing-jet.glb', role: 'vehicle', era: 'tfp' },
};
