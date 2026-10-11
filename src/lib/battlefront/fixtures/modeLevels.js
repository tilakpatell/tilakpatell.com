// Small levels for the other modes' tests, in the map rulebook's shape
// (src/data/bf2017/maps/<world>.json's rows): two sides' spawns, the mode's
// prefabs with the inputs their sub-world wires in. Metres, level frame.

const spawn = (mode, team, x, z, i) => ({ id: `${mode}_Logic:${team}${i}`, mode, team, priority: 1, enabled: true, at: [x, 0, z], yaw: 0 });
const spawns = (mode, a, b) => [0, 1, 2].flatMap((i) => [spawn(mode, 1, a[0] + i * 3, a[1], i), spawn(mode, 2, b[0] + i * 3, b[1], i)]);
const prefab = (mode, name, i, at, inputs = null) => ({ id: `${mode}_Logic:p${i}`, mode, layer: `${mode}_Logic`, name, blueprint: `Gameplay/GameModes/${name}`, ...(at ? { at, yaw: 0 } : {}), ...(inputs ? { inputs } : {}) });
const base = { polygons: [], volumes: [], spheres: [], boxes: [], waypoints: [], locators: [], cameras: [], strings: [], unplaced: [], bounds: { min: [-150, -150], max: [150, 150] } };

// Strike's bombs: Team1 defends (the interface's DefendingTeam), two sites
export const strikeBombs = () => ({ ...base, level: 'Fixture/Strike', modes: ['strike'], spawns: spawns('strike', [-100, 0], [100, 0]), prefabs: [prefab('strike', 'PF_Strike_Bombs', 1, [0, 0, 0], { DefendingTeam: 1, BombALocation: [-60, 0, 20], BombBLocation: [-60, 0, -20] })] });

// Strike's carried objective: the pickup and the drop-off where the CTF prefab places them
export const strikeCarry = () => ({ ...base, level: 'Fixture/StrikeCTF', modes: ['strike'], spawns: spawns('strike', [-100, 0], [100, 0]), prefabs: [prefab('strike', 'PF_Strike_CTF', 1, [0, 0, 0], { DefendingTeam: 1 }), prefab('strike', 'PF_Pickup_ObjectiveCTF', 2, [-40, 0, 0]), prefab('strike', 'Pf_FlagDropOff', 3, [90, 0, 0])] });

// a Strike whose bomb sites are not wired (Review Focus 2)
export const strikeUnplaced = () => ({ ...strikeBombs(), prefabs: [prefab('strike', 'PF_Strike_Bombs', 1, null, { DefendingTeam: 1 })], unplaced: [{ id: 'strike_Logic:p1', mode: 'strike', layer: 'strike_Logic', name: 'PF_Strike_Bombs', why: 'an objective prefab with no transform and no site wired to it' }] });

// Extraction: the cargo, its path, three checkpoints and their times
export const extraction = () => ({
  ...base,
  level: 'Fixture/Extraction',
  modes: ['extraction'],
  spawns: spawns('extraction', [-100, 0], [100, 0]),
  waypoints: [{ id: 'Mode5_Logic:w', mode: 'extraction', layer: 'Mode5_Logic', points: [[-90, 0, 0], [0, 0, 0], [90, 0, 0]], closed: false }],
  prefabs: [prefab('extraction', 'PF_Mode5_Objective_Generic', 1, [-90, 0, 0]), prefab('extraction', 'PF_GameMode_Mode5', 2, [0, 0, 0], { CheckpointPosition1: [-30, 0, 0], CheckpointPosition2: [30, 0, 0], CheckpointPosition3: [90, 0, 0], CP1Overtime: 240, CP2Overtime: 270, CP3Overtime: 300 })],
});

// Ewok Hunt: the troopers' and the Ewoks' spawns, two extraction points
export const ewokHunt = () => ({ ...base, level: 'Fixture/EwokHunt', modes: ['ewokHunt'], spawns: spawns('ewokHunt', [-100, 0], [100, 0]), prefabs: [prefab('ewokHunt', 'PF_UI_ExtractionPoint_Marker_Mode3', 1, [0, 0, 100]), prefab('ewokHunt', 'PF_UI_ExtractionPoint_Marker_Mode3', 2, [0, 0, -100])] });

// Supremacy's ground: five command posts by their ObjectiveIndex
export const supremacy = () => ({ ...base, level: 'Fixture/Supremacy', modes: ['supremacy'], spawns: spawns('supremacy', [-120, 0], [120, 0]), prefabs: [0, 1, 2, 3, 4].map((i) => prefab('supremacy', 'PF_CapturePoint_Mode1', i, [-80 + i * 40, 0, 0], { ObjectiveIndex: i + 1, CaptureDuration: 20 })).concat([prefab('supremacy', 'PF_UI_Mode1', 9, [0, 0, 0], { MaxReinforcements: 70, MaxBoardingTickets: 20 })]) });
