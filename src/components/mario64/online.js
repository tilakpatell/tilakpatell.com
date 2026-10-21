// Where Mario is, to the others online (Mario64.jsx's useTravellers,
// middleearth/towns/travellers.js): in metres (the rules' units are a
// hundredth of one, scene.js's S), each area its own (the grounds, the
// castle's inside, Bob-omb Battlefield: each its own coordinates), and his
// height lifted by LIFT, since the link keeps a height from naught up and
// the moat is under the ground (the scene puts the ghosts LIFT down again).
// Pure: the module sends what this gives each step he plays.

export const LIFT = 10; // metres: the moat's floor is some 4 m under the lawn
const S = 0.01; // (metres a unit: scene.js's)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function stepOf(m, area) {
  // (fwd is units a thirtieth of a second: ×0.3 is metres a second)
  return [{ x: m.pos.x * S, y: m.pos.y * S + LIFT, z: m.pos.z * S, face: wrap(m.yaw), speed: Math.abs(m.fwd ?? 0) * 0.3 }, { area }];
}
