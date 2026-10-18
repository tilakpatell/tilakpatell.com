// Moria’s shaders: ../../../src/components/middleearth/towns/moria/
// propsShaders.js and sceneShaders.js against their twins under nodes/towns/
// moria/. Each case is one of them on a small scene, built the same on both
// sides from the same arguments: the kit’s shared uniforms U (a clock part
// way on, the staff’s light out, the moon on the ithildin, the fire up, some
// rage) and a noise picture painted as the kit paints its own; fog where
// the shader takes it, so the additive glows’ fading is drawn too.
import * as THREE from "three";
import * as PO from "../../../src/components/middleearth/towns/moria/propsShaders.js";
import * as PN from "../../../src/components/middleearth/nodes/towns/moria/propsShaders.js";
import * as SO from "../../../src/components/middleearth/towns/moria/sceneShaders.js";
import * as SN from "../../../src/components/middleearth/nodes/towns/moria/sceneShaders.js";
import {
  fbm,
  makeCanvas,
  makeNoise,
  paintPixels,
} from "../../../src/lib/paint.js";

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// the kit’s noiseCanvas, and two more pictures for the hide
const picture = (seeds, scales, S = 128) => {
  const ns = seeds.map((s) => makeNoise(s));
  const c = paintPixels(makeCanvas(S), (u, v, out) => {
    for (let k = 0; k < 3; k++)
      out[k] =
        fbm(ns[k], u * scales[k], v * scales[k], {
          period: scales[k],
          octaves: 4,
        }) * 255;
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
const kit = (renderer) => {
  const noise = picture([3, 17, 29], [4, 8, 2]);
  return {
    K: { renderer },
    U: {
      uTime: { value: 3.2 },
      uReveal: { value: 0.8 },
      uRevealAt: { value: V3() },
      uRevealCam: { value: 1 },
      uRevealColor: { value: new THREE.Color(0.72, 0.84, 1.0) },
      uIthil: { value: 0.7 },
      uFire: { value: 1 },
      uFireColor: { value: new THREE.Color(1.0, 0.3, 0.07) },
      uNoise: { value: noise },
      uRage: { value: 0.5 },
    },
  };
};
const rng = (seed) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};
const fogged = (scene, near = 3, far = 26) => {
  scene.fog = new THREE.Fog(0x0a0e18, near, far);
  scene.background = new THREE.Color(0x0a0e18);
};
const M = (o) =>
  new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });

// ── the hooks ──

const reveal =
  (P, instanced) =>
  ({ scene, camera, renderer }) => {
    const { U } = kit(renderer);
    const mat = P.revealable(
      M({
        color: 0x404a4a,
        roughness: 0.45,
        map: picture([5, 7, 9], [8, 8, 8]),
      }),
      U,
      "moria-reveal",
    );
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2),
      mat,
    );
    scene.add(floor);
    const box = new THREE.BoxGeometry(1.2, 14, 1.2).translate(0, 7, 0);
    const at = [
      [-3, -3],
      [3, -3],
      [-3, -8],
      [3, -8],
      [0, -13],
    ];
    if (instanced) {
      const im = new THREE.InstancedMesh(box, mat, at.length);
      const o = new THREE.Object3D();
      at.forEach(([x, z], i) => {
        o.position.set(x, 0, z);
        o.rotation.y = i * 0.4;
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
      });
      scene.add(im);
    } else
      for (const [x, z] of at) {
        const m = new THREE.Mesh(box, mat);
        m.position.set(x, 0, z);
        scene.add(m);
      }
    camera.position.set(0, 2.5, 6);
    camera.lookAt(0, 3, -6);
  };

const hide =
  (P, balrog) =>
  ({ scene, camera, renderer }) => {
    const { U } = kit(renderer);
    const tex = picture([11, 13, 15], [6, 6, 3]);
    const nrm = picture([21, 23, 25], [8, 8, 2]);
    const base = M({ color: balrog ? 0x3a3330 : 0x8a8270, roughness: 0.6 });
    const mat = balrog
      ? P.hide(base, {
          tex,
          nrm,
          scale: 0.3,
          bump: 1.3,
          shade: 0.45,
          key: "moria-balrog",
          ...P.balrogFire(U),
        })
      : P.hide(base, {
          tex,
          nrm,
          scale: 0.9,
          bump: 0.9,
          shade: 0.35,
          key: "moria-troll",
        });
    const knot = new THREE.Mesh(
      new THREE.TorusKnotGeometry(1.4, 0.55, 160, 24),
      mat,
    );
    knot.rotation.set(0.3, 0.5, 0);
    knot.scale.setScalar(1.1);
    scene.add(knot);
    camera.position.set(0, 1, 5.5);
    camera.lookAt(0, 0, 0);
  };

const underglow =
  (P) =>
  ({ scene, camera, renderer }) => {
    const { U } = kit(renderer);
    const mat = P.underglow(
      M({ color: 0x5a6060, roughness: 0.7 }),
      U,
      "moria-abyss",
    );
    // a span over the deep and a pier going down into it, seen from below
    const deck = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, 2), mat);
    const pier = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 2.2, 40, 16).translate(0, -20, 0),
      mat,
    );
    pier.position.x = 3;
    scene.add(deck, pier);
    camera.position.set(-2, -9, 7);
    camera.lookAt(1, -3, 0);
  };

const ithildin =
  (P) =>
  ({ scene, camera, renderer }) => {
    const { U } = kit(renderer);
    const drawing = makeCanvas(128);
    const g = drawing.getContext("2d");
    g.fillStyle = "#000";
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "#fff";
    g.lineWidth = 4;
    g.beginPath();
    g.arc(64, 70, 34, Math.PI, 0);
    g.moveTo(30, 70);
    g.lineTo(30, 124);
    g.moveTo(98, 70);
    g.lineTo(98, 124);
    g.moveTo(64, 30);
    g.lineTo(64, 110);
    g.stroke();
    const em = new THREE.CanvasTexture(drawing);
    em.colorSpace = THREE.SRGBColorSpace;
    const mat = P.ithildinGlow(
      M({
        color: 0x9a9ea4,
        roughness: 0.8,
        emissive: new THREE.Color(0.62, 0.78, 1.0),
        emissiveMap: em,
        emissiveIntensity: 1.5,
      }),
      U,
    );
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(5, 5), mat));
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
  };

// ── the chamber’s light ──

const beam =
  (P) =>
  ({ scene, camera, renderer }) => {
    fogged(scene);
    const { U } = kit(renderer);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1.8, 9, 24, 1, true),
      P.beamMaterial(U),
    );
    shaft.rotation.z = 0.6;
    shaft.position.set(0, 1.5, -2);
    scene.add(shaft);
    camera.position.set(0, 1, 7);
    camera.lookAt(0, 1, -2);
  };

const sunlit =
  (P) =>
  ({ scene, camera, renderer }) => {
    fogged(scene);
    const { U } = kit(renderer);
    const from = V3(-6, 8, -2);
    const dir = V3(0.55, -0.8, 0.15).normalize();
    const sun = P.sunlitMaterial(U, { from, dir, r0: 0.8, r1: 2.6, len: 12 });
    sun.uniforms.uBoxMin.value.set(-0.8, 0, -0.6);
    sun.uniforms.uBoxMax.value.set(0.8, 1.2, 0.6);
    scene.add(
      new THREE.Mesh(
        new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x353a3a, roughness: 0.9 }),
      ),
      new THREE.Mesh(
        new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2),
        sun,
      ),
    );
    camera.position.set(1, 6, 7);
    camera.lookAt(0, 0, 0);
  };

const dust =
  (P) =>
  ({ scene, camera, renderer }) => {
    fogged(scene, 2, 14);
    const { U, K } = kit(renderer);
    const r = rng(41);
    const N = 420;
    const mp = new Float32Array(N * 3);
    const ms = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      mp.set([(r() - 0.5) * 4, (r() - 0.5) * 4, (r() - 0.5) * 6], i * 3);
      ms.set([r(), r(), r(), r()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mp, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(ms, 4));
    const d = P.dustPoints(g, U, K);
    d.frustumCulled = false;
    d.renderOrder = 5;
    d.material.userData.fit();
    // (motes a few pixels across, so their shape is compared too)
    d.material.uniforms.uScale.value *= 12;
    scene.add(d);
    camera.position.set(0, 0, 4);
    camera.lookAt(0, 0, 0);
  };

// ── the abyss ──

const abyss =
  (P, card) =>
  ({ scene, camera, renderer }) => {
    const { U } = kit(renderer);
    if (card) {
      const m = P.abyssMaterial(U, true);
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.PlaneGeometry(8, 10), m);
        c.position.set(i - 1, 0, -i);
        c.rotation.y = i * 0.35 - 0.3;
        scene.add(c);
      }
      camera.position.set(0, 0, 9);
      camera.lookAt(0, 0, 0);
    } else {
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(90, 90),
        P.abyssMaterial(U, false),
      );
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);
      camera.position.set(0, 30, 30);
      camera.lookAt(0, 0, 0);
    }
  };

const sparks =
  (P) =>
  ({ scene, camera, renderer }) => {
    const { U, K } = kit(renderer);
    const r = rng(153);
    const N = 260;
    const ss = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) ss.set([r(), r(), r(), r()], i * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(N * 3), 3),
    );
    g.setAttribute("aSeed", new THREE.BufferAttribute(ss, 4));
    const s = P.sparkPoints(g, U, K);
    s.material.uniforms.uSpan.value.set(20, 30, 8);
    s.frustumCulled = false;
    s.material.userData.fit();
    s.material.uniforms.uScale.value *= 4;
    scene.add(s);
    camera.position.set(0, -15, 16);
    camera.lookAt(0, -15, 0);
  };

// ── Durin’s Bane’s fire ──

// props.js’s cardCloud: a card a point, each its own seed
const cardCloud = (material, pts, seed = 1) => {
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute("position", quad.getAttribute("position"));
  const em = new Float32Array(pts.length * 3);
  const sd = new Float32Array(pts.length * 4);
  const r = rng(seed);
  pts.forEach((p, i) => {
    em.set([p.x, p.y, p.z], i * 3);
    sd.set([r(), r(), r(), r()], i * 4);
  });
  geo.setAttribute("aEmit", new THREE.InstancedBufferAttribute(em, 3));
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(sd, 4));
  geo.instanceCount = pts.length;
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return mesh;
};
const fire =
  (P, smoke) =>
  ({ scene, camera, renderer }) => {
    fogged(scene, 4, 30);
    if (smoke) scene.background = new THREE.Color(0x6a5a50);
    const { U } = kit(renderer);
    const r = rng(7);
    const pts = Array.from({ length: 60 }, () =>
      V3((r() - 0.5) * 3, r() * 0.4, (r() - 0.5) * 1.5),
    );
    const mat = smoke
      ? P.smokeMaterial(U, { size: 1.2, rise: 4 })
      : P.flameMaterial(U, { size: 0.8, rise: 2.2, heat: 1, rate: 1 });
    const cloud = cardCloud(mat, pts, 91);
    cloud.position.y = -1;
    scene.add(cloud);
    camera.position.set(0, 0.6, 5.5);
    camera.lookAt(0, 0.3, 0);
  };

const fireSolid =
  (P) =>
  ({ scene, camera, renderer }) => {
    fogged(scene, 4, 20);
    const { U } = kit(renderer);
    const blade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.5, 6, 24, 8),
      P.fireSolidMaterial(U),
    );
    blade.rotation.z = 0.9;
    scene.add(blade);
    camera.position.set(0, 0, 6);
    camera.lookAt(0, 0, 0);
  };

const wing =
  (P) =>
  ({ scene, camera, renderer }) => {
    fogged(scene, 4, 30);
    scene.background = new THREE.Color(0x5a4a40);
    const { U } = kit(renderer);
    const g = new THREE.PlaneGeometry(6, 4, 24, 16);
    const uvs = g.getAttribute("uv");
    const wingAt = new Float32Array(uvs.count * 2);
    for (let i = 0; i < uvs.count; i++)
      wingAt.set([uvs.getY(i), 1 - uvs.getX(i)], i * 2);
    g.setAttribute("aWing", new THREE.BufferAttribute(wingAt, 2));
    const m = new THREE.Mesh(g, P.wingMaterial(U));
    m.rotation.set(-0.3, 0.4, 0);
    scene.add(m);
    camera.position.set(0, 0, 6);
    camera.lookAt(0, 0, 0);
  };

const ripple =
  (P) =>
  ({ scene, camera }) => {
    fogged(scene, 3, 20);
    const base = P.rippleMaterial();
    // two arms’ ripples, cloned as the Watcher’s are, each its own clock
    [
      [-1.8, 0.4],
      [2, 1.7],
    ].forEach(([x, t]) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2),
        base.clone(),
      );
      m.material.uniforms.uTime.value = t;
      m.material.uniforms.uK.value = 1;
      m.position.x = x;
      scene.add(m);
    });
    camera.position.set(0, 4, 5);
    camera.lookAt(0, 0, 0);
  };

const lake =
  (S) =>
  ({ scene, camera }) => {
    fogged(scene, 10, 60);
    const water = {
      uniforms: {
        uSky: { value: new THREE.Color(0.06, 0.08, 0.14) },
        uDeep: { value: new THREE.Color(0.005, 0.008, 0.012) },
        uSun: { value: V3(-0.4, 0.5, -1).normalize() },
        uSunColor: { value: new THREE.Color(0.8, 0.85, 1) },
        uGlints: { value: 1 },
      },
    };
    const m = S.lakeMaterial(water);
    m.uniforms.uTime.value = 4;
    m.uniforms.uStir.value = 0.5;
    scene.add(
      new THREE.Mesh(new THREE.PlaneGeometry(80, 60).rotateX(-Math.PI / 2), m),
    );
    camera.position.set(0, 2, 8);
    camera.lookAt(0, 0, -6);
  };

const both = (f, ...a) => ({ node: f(PN, ...a), classic: f(PO, ...a) });

export default {
  "middleearth:moria:reveal": both(reveal, false),
  "middleearth:moria:reveal:instanced": both(reveal, true),
  "middleearth:moria:hide:troll": both(hide, false),
  "middleearth:moria:hide:balrog": both(hide, true),
  "middleearth:moria:underglow": both(underglow),
  "middleearth:moria:ithildin": both(ithildin),
  "middleearth:moria:beam": both(beam),
  "middleearth:moria:sunlit": both(sunlit),
  "middleearth:moria:dust": both(dust),
  "middleearth:moria:abyss:floor": both(abyss, false),
  "middleearth:moria:abyss:card": both(abyss, true),
  "middleearth:moria:sparks": both(sparks),
  "middleearth:moria:flame": both(fire, false),
  "middleearth:moria:smoke": both(fire, true),
  "middleearth:moria:fireSolid": both(fireSolid),
  "middleearth:moria:wing": both(wing),
  "middleearth:moria:ripple": both(ripple),
  "middleearth:moria:lake": { node: lake(SN), classic: lake(SO) },
};
