// Particles against the depth buffer, Niagara's GPU collision (the GPU-
// first research note: "depth-buffer collision from the previous frame";
// Epic's own words for it, "low-cost, but also low-accuracy", hold here
// too): each particle is projected into last frame's depth, the surface
// there rebuilt as a world point and a normal from two neighbouring
// texels, and a particle just behind it (within the thickness, plus how
// far it moved this step, so a fast piece can't step over the surface
// between two frames) is put back on it, its speed into the surface turned
// and damped. Where there is no depth
// (off the screen, a texel nothing was drawn to: depth 1), there is no
// collision: the particle falls on and its lifetime bounds it (the design's
// Review Focus 3).
//
// This is the CPU twin gpu.js's update kernel is written from line by line
// (`collideNode`), as emitter.js is to its step: collide.test.js holds the
// twin to a synthetic floor; the fixture (scripts/light-fixture.mjs
// --debris) runs the kernel. Pure: no three.js (matrices are three's
// column-major `elements`).
//
//   collideParticle(posAge, velLife, i, { viewProj, invViewProj, camera,
//     depthAt(u, v) → z, texel: [du, dv], thickness, bounce, friction }, dt = 0) → bool
//     posAge, velLife: emitter.js's pool arrays (vec4 a slot), i the slot
//   depthSampler(depth, w, h) → depthAt (nearest texel, as textureLoad; off the buffer: 1)
//   COLLIDE: the defaults

export const COLLIDE = Object.freeze({
  thickness: 0.1, // m behind the surface still counted as in it (the plan's 0.1 m)
  bounce: 0.3, // of the speed into the surface given back
  friction: 0.6, // of the speed along it taken away at a touch
  _source: 'docs/superpowers/plans/2026-10-11-gpu-first-laneN5-sim.md Task 2 (0.1 m); bounce and friction this lane’s, for rubble',
});

export const NOTHING = 1; // the depth of a texel nothing was drawn to (WebGPU's 0…1, far is 1)

export function depthSampler(depth, w, h) {
  return (u, v) => {
    const x = Math.floor(u * w);
    const y = Math.floor(v * h);
    if (x < 0 || y < 0 || x >= w || y >= h) return NOTHING;
    return depth[y * w + x];
  };
}

// m (column-major) × [x, y, z, 1] → out [x, y, z, w]
function mul(m, x, y, z, out) {
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  out[3] = m[3] * x + m[7] * y + m[11] * z + m[15];
  return out;
}

const c = [0, 0, 0, 0];
const S = [0, 0, 0];
const A = [0, 0, 0];
const B = [0, 0, 0];

// the world point under texel (u, v) at depth z (v down the screen, as a texture's rows)
function unproject(inv, u, v, z, out) {
  mul(inv, u * 2 - 1, (0.5 - v) * 2, z, c);
  out[0] = c[0] / c[3];
  out[1] = c[1] / c[3];
  out[2] = c[2] / c[3];
  return out;
}

// a neighbour's world point, one texel along (du, dv), or the other side's
// where that one is nothing; false when neither is
function neighbour(o, u, v, du, dv, out) {
  let z = o.depthAt(u + du, v + dv);
  if (z < NOTHING) {
    unproject(o.invViewProj, u + du, v + dv, z, out);
    return 1;
  }
  z = o.depthAt(u - du, v - dv);
  if (z < NOTHING) {
    unproject(o.invViewProj, u - du, v - dv, z, out);
    return -1;
  }
  return 0;
}

export function collideParticle(posAge, velLife, i, o, dt = 0) {
  if (!o.depthAt) return false; // (a GPU depth texture with no CPU reader: the CPU path has no depth)
  const k = i * 4;
  const px = posAge[k];
  const py = posAge[k + 1];
  const pz = posAge[k + 2];
  mul(o.viewProj, px, py, pz, c);
  if (!(c[3] > 0)) return false; // (behind the camera)
  const u = (c[0] / c[3]) * 0.5 + 0.5;
  const v = 0.5 - (c[1] / c[3]) * 0.5;
  if (u < 0 || u > 1 || v < 0 || v > 1) return false; // (off the screen: no depth)
  const z = o.depthAt(u, v);
  if (!(z < NOTHING)) return false; // (nothing drawn there)
  unproject(o.invViewProj, u, v, z, S);
  const su = neighbour(o, u, v, o.texel[0], 0, A);
  const sv = neighbour(o, u, v, 0, o.texel[1], B);
  if (!su || !sv) return false;
  // the normal from the two neighbours (each the side it came from), towards the camera
  const ax = (A[0] - S[0]) * su;
  const ay = (A[1] - S[1]) * su;
  const az = (A[2] - S[2]) * su;
  const bx = (B[0] - S[0]) * sv;
  const by = (B[1] - S[1]) * sv;
  const bz = (B[2] - S[2]) * sv;
  let nx = ay * bz - az * by;
  let ny = az * bx - ax * bz;
  let nz = ax * by - ay * bx;
  const len = Math.hypot(nx, ny, nz);
  if (!(len > 1e-12)) return false;
  let flip = (o.camera[0] - S[0]) * nx + (o.camera[1] - S[1]) * ny + (o.camera[2] - S[2]) * nz < 0 ? -1 : 1;
  flip /= len;
  nx *= flip;
  ny *= flip;
  nz *= flip;
  // how far in front of the surface (negative: behind it)
  const d = (px - S[0]) * nx + (py - S[1]) * ny + (pz - S[2]) * nz;
  const vx = velLife[k];
  const vy = velLife[k + 1];
  const vz = velLife[k + 2];
  const thickness = (o.thickness ?? COLLIDE.thickness) + Math.hypot(vx, vy, vz) * dt;
  if (!(d < 0 && d > -thickness)) return false;
  posAge[k] = px - d * nx;
  posAge[k + 1] = py - d * ny;
  posAge[k + 2] = pz - d * nz;
  const vn = vx * nx + vy * ny + vz * nz;
  if (vn < 0) {
    // the speed into it turned and damped, the speed along it rubbed
    const keep = 1 - (o.friction ?? COLLIDE.friction);
    const back = -vn * (o.bounce ?? COLLIDE.bounce);
    velLife[k] = (vx - vn * nx) * keep + back * nx;
    velLife[k + 1] = (vy - vn * ny) * keep + back * ny;
    velLife[k + 2] = (vz - vn * nz) * keep + back * nz;
  }
  return true;
}
