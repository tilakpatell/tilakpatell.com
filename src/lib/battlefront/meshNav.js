// The soldiers on the game's own navmesh (lib/battlefront/navmesh.js: the
// level's NavPower polygons, bf2-re findings/57), where the battle has one:
// a bot's step goes along the mesh (a ray within it, sliding along its walls,
// and over a link from one of its ends to the other, off the mesh as
// NavPower's agents cross a link: a doorway opened, the level's hand links),
// a way is the mesh's (its polygons through their portals and the level's
// hand links, then a funnel), and a deploy stands on it. The mesh knows the
// floors of a place one over another (Echo Base under the mountain's snow),
// which the 2D grid on the terrain's heightmap never did; the grid is still
// what a soldier off the mesh walks, and what the line of sight and the cover
// read.
//
// Feet stand on the ground, not on the mesh: NavPower's polygons ride 0.07 to
// 0.62 m over the floor they were baked from (findings/57). Where the
// terrain is the floor (within LIFT_MAX under the mesh) it is the terrain's;
// elsewhere the level's own shapes if the battle was given a floor probe
// (the page's physics, round the player); else the mesh less LIFT.
//
//   attachMesh(nav, mesh, { floor }) → nav     floor(x, y, z) → the floor's height under a point, or null
//   meshMove(s, dir, dt, nav, speed) → metres moved, or null off the mesh (the grid's step then)
//   meshPath(nav, from, to, { fromY, toY }) → [[x, z]] | null (no way), undefined (no mesh)
//     (toY left out: the goal's floor is the one the walker can reach nearest its own height)
//   meshNearest(nav, x, z, r, y) → [x, z] | null      meshStand(nav, [x, y, z], r) → [x, y, z] | null
//   doorway(nav, gate) → the link through a gate opened (its doorway, 2 m out to 2 m in)
//   gateStand(nav, gate) → [x, y, z] | null   where a soldier on the gate's outer side holds its panel:
//     the nearest floor to the panel on that side's island the panel can be used from (gates.js's canUse)

import { canUse, reachOf } from './gates.js';
import { heightAt } from './nav.js';

// m: the mesh's lift over the floor where nothing better is known (findings/57's measure on Hoth: 0.07 to 0.62), by hand
export const LIFT = 0.4;
// m: how far under the mesh the terrain may be and still be its floor (over the 0.62 m measured)
export const LIFT_MAX = 1.0;
// m: how far over the feet the mesh is looked for, and under them
const ABOVE = 1.2;
const BELOW = 1.5;
// m: a doorway link's half length either side of a gate's line
export const DOORWAY = 2;
// m: how far off the mesh a walker's feet may be and still start a way from it (the route's own snap)
const SNAP = 4;
// m: how near a link's end a walker steps onto it, its way's next point the other end (by hand)
const LINK_NEAR = 1.5;

export function attachMesh(nav, mesh, { floor = null } = {}) {
  nav.mesh = mesh;
  nav.floor = floor;
  return nav;
}

// the polygon under a soldier's feet, near its height
const polyAt = (mesh, p) => mesh.locate(p[0], p[1] + LIFT, p[2], { above: ABOVE, below: BELOW });

// the feet's height at a place on the mesh (the game's frame)
function feetAt(nav, x, z, meshY) {
  const ground = heightAt(nav, x, z);
  if (meshY - ground >= -0.3 && meshY - ground <= LIFT_MAX) return ground;
  const f = nav.floor?.(x, meshY + 0.5, z);
  if (Number.isFinite(f) && meshY - f >= -0.3 && meshY - f <= LIFT_MAX) return f;
  return meshY - LIFT;
}

// the link a walker at p on polygon poly steps onto going (dx, dz) in the pack's frame: one whose end is
// near and whose other end is ahead → { a, b, to } (its ends in the pack's frame, the polygon it lands on)
function linkFrom(mesh, p, poly, dx, dz) {
  for (const l of mesh.links ?? []) {
    const ends = [[l.from, l.points[0], l.points[l.points.length - 1], l.to]];
    if (l.both) ends.push([l.to, l.points[l.points.length - 1], l.points[0], l.from]);
    for (const [at, a, b, to] of ends) {
      if (at !== poly || Math.hypot(a[0] - p[0], a[2] - p[2]) > LINK_NEAR) continue;
      if ((b[0] - p[0]) * dx + (b[2] - p[2]) * dz > 0) return { a, b, to };
    }
  }
  return null;
}

// a step along the link the walker is on, to its far end and off it there
function linkMove(s, nav, step, dt) {
  const mesh = nav.mesh;
  const p0 = mesh.toPack(s.at);
  const { b } = s.link;
  const left = Math.hypot(b[0] - p0[0], b[2] - p0[2]);
  const k = left <= step ? 1 : step / left;
  const q = [p0[0] + (b[0] - p0[0]) * k, p0[1] + (b[1] - LIFT - p0[1]) * k, p0[2] + (b[2] - p0[2]) * k];
  if (k === 1) s.link = null;
  const g = mesh.toGame(q);
  s.vel[0] = (g[0] - s.at[0]) / dt;
  s.vel[2] = (g[2] - s.at[2]) / dt;
  const moved = Math.hypot(g[0] - s.at[0], g[2] - s.at[2]);
  s.at[0] = g[0];
  s.at[1] = s.link ? g[1] : feetAt(nav, g[0], g[2], g[1] + LIFT);
  s.at[2] = g[2];
  s.moving = true;
  return moved;
}

export function meshMove(s, dir, dt, nav, speed) {
  const mesh = nav?.mesh;
  if (!mesh) return null;
  const len = Math.hypot(dir[0], dir[1]);
  const step = speed * dt;
  if (s.link && s.alive && step > 0) return linkMove(s, nav, step, dt);
  const p0 = mesh.toPack(s.at);
  const poly = polyAt(mesh, p0);
  if (poly < 0) return null;
  if (!s.alive || len < 1e-9 || step <= 0) {
    s.moving = false;
    s.vel[0] = s.vel[2] = 0;
    return 0;
  }
  // (the stick turned into the pack's frame: the mesh's own)
  const c = Math.cos(mesh.yaw ?? 0);
  const sn = Math.sin(mesh.yaw ?? 0);
  const dx = (dir[0] / len) * step;
  const dz = (dir[1] / len) * step;
  const tries = [
    [dx, dz],
    [dx, 0],
    [0, dz],
  ];
  for (const [mx, mz] of tries) {
    if (Math.abs(mx) + Math.abs(mz) < 1e-9) continue;
    const to = [p0[0] + mx * c + mz * sn, p0[1], p0[2] - mx * sn + mz * c];
    const r = mesh.raycast(p0, to, { poly });
    if (r.hit || r.poly < 0) continue;
    const meshY = mesh.heightOn(r.poly, to[0], to[2]);
    const game = mesh.toGame([to[0], meshY, to[2]]);
    const y = feetAt(nav, game[0], game[2], game[1]);
    s.vel[0] = (game[0] - s.at[0]) / dt;
    s.vel[2] = (game[2] - s.at[2]) / dt;
    const moved = Math.hypot(game[0] - s.at[0], game[2] - s.at[2]);
    s.at[0] = game[0];
    s.at[1] = y;
    s.at[2] = game[2];
    s.moving = true;
    return moved;
  }
  // (walled: a link's end here, the way on over it)
  const link = linkFrom(mesh, p0, poly, dx * c + dz * sn, -dx * sn + dz * c);
  if (link) {
    s.link = link;
    return linkMove(s, nav, step, dt);
  }
  s.moving = false;
  s.vel[0] = s.vel[2] = 0;
  return 0;
}

// a goal given on the ground only: its floor the one under it that the walker can reach (on its own
// island) nearest the walker's height, the fuel room's under the snow and not the snow over it, the
// snow of the field's far end 40 m over the trench, not nothing; or the walker's own height where none is
// (from: the walker's feet in the pack's frame; x, z the goal's there; the height back in the game's)
function floorFor(mesh, from, x, z) {
  const game = (y) => mesh.toGame([x, y, z])[1];
  let start = polyAt(mesh, from);
  if (start < 0) start = mesh.nearest(from[0], from[1] + LIFT, from[2], { radius: SNAP })?.poly ?? -1;
  if (start < 0) return game(from[1]);
  const isle = mesh.island(start);
  const accept = (k) => mesh.island(k) === isle;
  const p = mesh.locate(x, from[1] + LIFT, z, { above: Infinity, below: Infinity, accept });
  if (p >= 0) return game(mesh.heightOn(p, x, z) - LIFT);
  // (a goal on the mesh's rim, a stand by a wall: the floor nearest it on x–z)
  const n = mesh.nearest(x, from[1] + LIFT, z, { radius: SNAP, accept, flat: true });
  return game(n ? n.point[1] - LIFT : from[1]);
}

export function meshPath(nav, from, to, { fromY = null, toY = null } = {}) {
  const mesh = nav?.mesh;
  if (!mesh) return undefined;
  const fy = fromY ?? heightAt(nav, from[0], from[1]);
  const start = mesh.toPack([from[0], fy, from[1]]);
  const goal = mesh.toPack([to[0], fy, to[1]]);
  const ty = toY ?? floorFor(mesh, start, goal[0], goal[2]);
  const pts = mesh.findPath(mesh.toPack([from[0], fy + LIFT, from[1]]), mesh.toPack([to[0], ty + LIFT, to[1]]));
  if (!pts) return null;
  return pts.map((p) => {
    const g = mesh.toGame(p);
    return [g[0], g[2]];
  });
}

export function meshNearest(nav, x, z, r, y) {
  const mesh = nav?.mesh;
  if (!mesh || !Number.isFinite(y)) return null;
  const p = mesh.toPack([x, y + LIFT, z]);
  const n = mesh.nearest(p[0], p[1], p[2], { radius: r });
  if (!n) return null;
  const g = mesh.toGame(n.point);
  return [g[0], g[2]];
}

// a place to stand on the mesh within r of a point: the point itself when it is on it, its floor's height
export function meshStand(nav, at, r = 12) {
  const mesh = nav?.mesh;
  if (!mesh) return null;
  const p = mesh.toPack(at);
  let poly = polyAt(mesh, p);
  let q = p;
  if (poly < 0) {
    const n = mesh.nearest(p[0], p[1] + LIFT, p[2], { radius: r });
    if (!n) return null;
    poly = n.poly;
    q = n.point;
  }
  const g = mesh.toGame([q[0], mesh.heightOn(poly, q[0], q[2]), q[2]]);
  return [g[0], feetAt(nav, g[0], g[2], g[1]), g[2]];
}

export function doorway(nav, gate) {
  const mesh = nav?.mesh;
  if (!mesh || !gate?.at) return -1;
  const f = [Math.sin(gate.yaw ?? 0), Math.cos(gate.yaw ?? 0)];
  const y = gate.at[1] + LIFT;
  const out = [gate.at[0] + f[0] * DOORWAY, y, gate.at[2] + f[1] * DOORWAY];
  const into = [gate.at[0] - f[0] * DOORWAY, y, gate.at[2] - f[1] * DOORWAY];
  return mesh.addLink({ points: [mesh.toPack(out), mesh.toPack(into)], both: true, snap: DOORWAY });
}

export function gateStand(nav, gate) {
  const mesh = nav?.mesh;
  if (!mesh || !gate?.at || !gate.panel?.at) return null;
  // (the outer side: the field's island, at the doorway's outer end, where the attackers come from)
  const f = [Math.sin(gate.yaw ?? 0), Math.cos(gate.yaw ?? 0)];
  const out = mesh.toPack([gate.at[0] + f[0] * DOORWAY, gate.at[1] + LIFT, gate.at[2] + f[1] * DOORWAY]);
  const side = mesh.nearest(out[0], out[1], out[2], { radius: DOORWAY });
  if (!side) return null;
  const isle = mesh.island(side.poly);
  const p = mesh.toPack(gate.panel.at);
  const n = mesh.nearest(p[0], p[1], p[2], { radius: reachOf(gate), accept: (poly) => mesh.island(poly) === isle });
  if (!n) return null;
  const g = mesh.toGame(n.point);
  const at = [g[0], feetAt(nav, g[0], g[2], g[1]), g[2]];
  return canUse(gate, at) ? at : null;
}
