// cme.js on the node renderer: a coronal mass ejection, what a star’s flare
// throws off (setpiecesNodes.js’s flare). While the star’s glare swells,
// loops of glowing plasma rise off its surface where it’s about to go, then
// a cone of plasma, three nested caps of a sphere webbed with bright
// filaments, runs out from it at the ship (cme.js’s header says it all).
//
// What differs on the node renderer: the glare is three’s SpriteMaterial’s
// node twin, the same settings; the shell’s and the loops’ ShaderMaterials
// are MeshBasicNodeMaterials with the same flags (and the ShaderMaterial’s
// defaults kept: no fog, one pass), their shaders nodes, line for line, the
// noise sunNodes.js’s `snoise`. The uniforms are nodes under the GLSL’s
// names on `material.uniforms`, so the frame code is cme.js’s, unchanged.
// CME and ejectionAt are cme.js’s, copied (cme.js reaches sun.js’s GLSL).
//
// ejectionAt(age, { rise, speed, starR, reach }) → { on, radius, life, glow }
// createEjection(parent, { small, glow }) → { launch(star, toward, { rise, speed, reach }),
//   update(dt, t, camera) → busy, busy, axis, dispose() }
// Points are in `parent`'s space (the map's).

import * as THREE from 'three';
import { MeshBasicNodeMaterial, SpriteNodeMaterial } from 'three/webgpu';
import { abs, acos, cameraPosition, clamp, dot, float, mix, modelWorldMatrix, normalLocal, normalize, positionLocal, positionWorld, pow, sin, smoothstep, uniform, uv, varying, vec3, vec4 } from 'three/tsl';
import { snoise } from './sunNodes';

export const CME = {
  half: 0.62, // radians: half the cone's width
  off: 0.42, // radians the axis is turned off the line to the ship (the eruption's toward the star's limb, seen from the ship)
  loops: 6, // prominences at the eruption
  layers: [
    // (the shell's radius as a share of the front's, how bright, how hot: 1 white-gold, 0 deep red)
    { k: 1, bright: 1.25, heat: 1 },
    { k: 0.93, bright: 0.85, heat: 0.6 },
    { k: 0.85, bright: 0.6, heat: 0.25 },
  ],
};

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};

// Where the ejection is at `age`: rising (held at the star while the glare
// swells), then running out at `speed` till its radius is `reach`. `life`
// is how far through it is, 0 … 1 (the rise is the first tenth).
export function ejectionAt(age, { rise, speed, starR, reach }) {
  if (age < rise) return { on: false, radius: starR, life: 0.1 * clamp01(age / rise), glow: smooth(age / rise) };
  const radius = starR + (age - rise) * speed;
  if (radius >= reach) return { on: false, radius: reach, life: 1, glow: 0 };
  return { on: true, radius, life: 0.1 + 0.9 * clamp01((radius - starR) / Math.max(1e-6, reach - starR)), glow: Math.exp(-(age - rise) * 1.6) };
}

// (the flags a ShaderMaterial has without being asked: no fog, one pass)
const shaderLike = (opts) => new MeshBasicNodeMaterial({ fog: false, forceSinglePass: true, ...opts });

// ridged noise: thin bright lines where the noise crosses zero
const ridge = (p) => abs(snoise(p)).oneMinus();

// the shell (SHELL_VERT and SHELL_FRAG, as nodes)
function shellMaterial(u) {
  const material = shaderLike({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const vDir = varying(normalize(positionLocal));
  const vNormalW = varying(normalize(modelWorldMatrix.mul(vec4(normalLocal, 0.0)).xyz));
  const vViewW = varying(cameraPosition.sub(positionWorld));
  // how far off the cone's axis (its +z), and the rim fading out
  const ang = acos(clamp(vDir.z, -1.0, 1.0));
  const rim = smoothstep(u.uHalf.mul(0.78), u.uHalf, ang).oneMinus();
  // the filaments: ridged fbm over the shell, sharp and thin, swirling slowly,
  // finer as it spreads
  const p = vDir.mul(u.uLife.mul(2.4).add(3.4)).add(vec3(u.uSeed, u.uSeed.mul(0.7), 0.0));
  const f1 = ridge(p.add(vec3(0.0, 0.0, u.uT.mul(0.12))));
  const f2 = ridge(p.mul(2.1).add(vec3(u.uT.mul(0.09), u.uT.mul(-0.07), u.uSeed)));
  const f3 = ridge(p.mul(4.7).sub(vec3(0.0, u.uT.mul(0.05), u.uSeed.mul(0.5))));
  const threads = pow(f1, 7.0).mul(1.2).add(pow(f2, 9.0).mul(0.8)).add(pow(f3, 12.0).mul(0.5));
  // clumps of brighter plasma, and darker gaps between
  const clump = smoothstep(-0.3, 0.8, snoise(vDir.mul(1.7).add(u.uSeed).add(u.uT.mul(0.05))));
  // brightest seen edge-on: the ragged front, with the sky through its middle
  const edge = abs(dot(normalize(vNormalW), normalize(vViewW))).oneMinus();
  const front = pow(edge, 2.2).mul(0.94).add(0.06);
  // white-hot to gold to deep red, by layer, toward the rim and as it cools
  const heat = clamp(
    u.uHeat
      .mul(ang.mul(0.5).div(u.uHalf).oneMinus())
      .mul(u.uLife.mul(0.45).oneMinus())
      .add(threads.mul(0.35)),
    0.0,
    1.0,
  );
  let col = mix(vec3(0.7, 0.1, 0.03), vec3(1.0, 0.55, 0.15), smoothstep(0.0, 0.55, heat));
  col = mix(col, vec3(1.0, 0.93, 0.8), smoothstep(0.65, 1.0, heat));
  col = col.mul(mix(vec3(1.0), u.uTint, 0.3));
  // thinning out as it goes
  const fade = smoothstep(0.6, 1.0, u.uLife).oneMinus().mul(smoothstep(0.0, 0.1, u.uLife));
  const a = threads.mul(clump.mul(1.1).add(0.12)).mul(front).mul(rim).mul(fade).mul(u.uBright);
  material.colorNode = col.mul(a).mul(2.4);
  material.uniforms = u;
  return material;
}

// the prominences (LOOP_FRAG, as nodes)
function loopMaterial(u) {
  const material = shaderLike({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const vUv = uv();
  // bright along the loop, brightest at the feet and the top, flickering
  const along = vUv.x;
  const knots = snoise(vec3(along.mul(9.0).add(u.uSeed), u.uT.mul(1.3), u.uSeed)).mul(0.4).add(0.6);
  const feet = sin(along.mul(3.14159)).oneMinus().mul(0.4).add(0.6);
  // soft across the tube: the middle of the strip
  const across = sin(vUv.y.mul(3.14159));
  const a = knots.mul(feet).mul(across.mul(0.6).add(0.4)).mul(u.uOn);
  const col = mix(vec3(1.0, 0.22, 0.04), vec3(1.0, 0.7, 0.35), knots.mul(feet).mul(0.8));
  material.colorNode = col.mul(a).mul(float(4.0));
  material.uniforms = u;
  return material;
}

// a soft round glare, white in the middle
function glareTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  r.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const Z = new THREE.Vector3(0, 0, 1);

export function createEjection(parent, { small = false, glow = null } = {}) {
  const made = [];
  const keep = (x) => (made.push(x), x);
  const group = new THREE.Group();
  group.visible = false;
  parent.add(group);

  // the star's glare
  const glareMap = glow ?? (typeof document !== 'undefined' ? keep(glareTexture()) : null);
  const glare = new THREE.Sprite(keep(new SpriteNodeMaterial({ map: glareMap, color: new THREE.Color(1, 1, 1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  group.add(glare);

  // the shell: three caps round the cone's axis (+z in `cone`)
  const cone = new THREE.Group();
  group.add(cone);
  const capGeo = keep(new THREE.SphereGeometry(1, small ? 56 : 112, small ? 18 : 36, 0, Math.PI * 2, 0, CME.half).rotateX(Math.PI / 2));
  const layers = CME.layers.map((l, i) => {
    const mat = keep(
      shellMaterial({ uT: uniform(0), uLife: uniform(0), uHalf: uniform(CME.half), uBright: uniform(l.bright), uHeat: uniform(l.heat), uSeed: uniform(3.7 * i + 1.3), uTint: uniform(new THREE.Color(1, 1, 1)) }),
    );
    const m = new THREE.Mesh(capGeo, mat);
    m.frustumCulled = false;
    m.renderOrder = 3 - i;
    cone.add(m);
    return { mesh: m, mat, k: l.k };
  });

  // the prominences: arcs rising off the surface where it erupts, in a frame
  // whose +z is straight out of the star there (`foot`)
  const foot = new THREE.Group();
  group.add(foot);
  const loopMat = keep(loopMaterial({ uT: uniform(0), uOn: uniform(0), uSeed: uniform(0) }));
  const loops = [];
  const n = small ? 4 : CME.loops;
  for (let i = 0; i < n; i++) {
    // each loop: feet apart across the surface, arching up; turned about the
    // way out, and set a little off the middle
    const span = 0.22 + 0.16 * ((i * 37) % 7) / 7;
    const height = span * (0.9 + 0.5 * ((i * 53) % 5) / 5);
    const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(-span / 2, 0, -0.02), new THREE.Vector3(-span / 2, 0, height * 1.3), new THREE.Vector3(span / 2, 0, height * 1.3), new THREE.Vector3(span / 2, 0, -0.02));
    const tube = new THREE.Mesh(keep(new THREE.TubeGeometry(curve, small ? 24 : 48, 0.012 + 0.008 * (i % 3), 8, false)), loopMat);
    tube.rotation.z = (i / n) * Math.PI + 0.3 * i;
    tube.position.set(Math.cos(i * 2.4) * 0.07, Math.sin(i * 2.4) * 0.07, 0);
    tube.frustumCulled = false;
    foot.add(tube);
    loops.push(tube);
  }

  const st = { age: -1, star: null, opts: null, center: new THREE.Vector3() };
  const axis = new THREE.Vector3(0, 0, 1);
  const q = new THREE.Quaternion();
  const side = new THREE.Vector3();

  return {
    // star: { at, r, color }; toward: where the ship is ({ x, y, z }); the
    // rise, the speed and how far it goes, as setpieces.js times them
    launch(star, toward, { rise, speed, reach }) {
      st.star = star;
      st.opts = { rise, speed, reach, starR: star.r };
      st.age = 0;
      st.center.set(...star.at);
      axis.set(toward.x - star.at[0], toward.y - star.at[1], toward.z - star.at[2]).normalize();
      // turned a little off the ship's line, to one side (whichever, by where the ship is)
      side.set(-axis.z, 0.35, axis.x).normalize();
      if (Math.sin(toward.x * 0.37 + toward.z * 0.11) < 0) side.multiplyScalar(-1);
      axis.applyAxisAngle(side, CME.off).normalize();
      q.setFromUnitVectors(Z, axis);
      group.position.copy(st.center);
      cone.quaternion.copy(q);
      foot.quaternion.copy(q);
      foot.position.copy(axis).multiplyScalar(star.r * 0.995);
      foot.scale.set(star.r, star.r, 0.001);
      const c = new THREE.Color(star.color);
      glare.material.color.copy(c).multiplyScalar(2.5);
      glare.material.opacity = 0;
      for (const l of layers) l.mat.uniforms.uTint.value.copy(c);
      loopMat.uniforms.uSeed.value = (toward.x * 0.013) % 10;
      cone.visible = false;
      group.visible = true;
    },
    get busy() {
      return st.age >= 0;
    },
    // the cone's axis (for a test, and the crew's look)
    get axis() {
      return axis;
    },
    update(dt, t) {
      if (st.age < 0) return false;
      st.age += dt;
      const e = ejectionAt(st.age, st.opts);
      const r = st.star.r;
      // the glare: swelling while it rises, fading after
      glare.material.opacity = st.age < st.opts.rise ? Math.min(1, st.age / 0.6) : e.glow;
      glare.scale.setScalar(r * (st.age < st.opts.rise ? 1.2 + 1.6 * e.glow * e.glow : 2.8) * 2);
      // the loops: rising off the surface while it builds, then torn away with it
      const rise = clamp01(st.age / st.opts.rise);
      const after = Math.max(0, st.age - st.opts.rise);
      foot.scale.z = r * (0.15 + 0.85 * smooth(rise) + after * 1.6);
      loopMat.uniforms.uOn.value = smooth(rise * 1.5) * Math.exp(-after * 1.1);
      loopMat.uniforms.uT.value = t;
      foot.visible = loopMat.uniforms.uOn.value > 0.01;
      // the shell
      cone.visible = e.on;
      if (e.on) {
        for (const l of layers) {
          l.mesh.scale.setScalar(Math.max(r, e.radius * l.k));
          l.mat.uniforms.uT.value = t;
          l.mat.uniforms.uLife.value = e.life;
        }
      }
      if (!e.on && st.age >= st.opts.rise) {
        st.age = -1;
        group.visible = false;
        return false;
      }
      return true;
    },
    dispose() {
      group.removeFromParent();
      for (const m of made) m.dispose?.();
    },
  };
}
