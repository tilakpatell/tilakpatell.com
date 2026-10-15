// crash.js on the node renderer: what a crash looks like, and coming back
// from one.
//
// hit() plays the impact where the ship went in: a flash hot enough to
// bloom, sparks and bits of hull thrown out from the surface, and on a planet
// a shockwave that runs out over its surface and a crater that glows white,
// cools to red and goes dark; the sun just swallows the ship in a flare.
// arrive() brings the ship back: out of a green portal for Rick's cruiser,
// out of hyperspace (a flash and a ring of light) for the others.
// Everything is made once and reused, so a crash costs a few draws while it
// plays and nothing after.
//
// createCrash(parent) → { hit(info), arrive(info), update(dt, camera) → busy, dispose() }
// Points are in `parent`'s space (the map's, where the ship flies).
//
// What differs on the node renderer: each material is its node twin with
// the same settings; the shockwave’s and the portal’s shaders are nodes,
// line for line (the portal’s swirl is portalFxNodes.js’s, swirl.js’s
// portal() as nodes), their uniforms the same names on `material.uniforms`.
// The sparks were points sized by PointsMaterial’s `size`, and the node
// renderer draws a point one pixel wide, so a spark is a sprite instanced
// once a point (three’s PointsNodeMaterial on a Sprite with a count, its
// place and colour instance attributes), the same size in the same pixels.
// The portal was written premultiplied; the node material multiplies by
// the alpha itself where premultipliedAlpha is set, so the colour is
// divided out first (nothing under 0.004 is drawn at all, as before).

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial, PointsNodeMaterial, SpriteNodeMaterial } from 'three/webgpu';
import { acos, clamp, dot, exp, float, instancedBufferAttribute, max, mix, normalize, positionGeometry, smoothstep, texture, uniform, uv, vec3, vec4 } from 'three/tsl';
import { swirl } from '../../lib/three/portalFxNodes';
import { sharpen } from '../../lib/three/textures';

const SPARKS = 90;
const SHARDS = 18;

// a soft round spot, white in the middle: the flash, the sparks
function spot() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// On the planet’s surface: the shockwave, a ring running out from where the
// ship went in, and the crater, glowing and cooling (SHELL_FRAG, as nodes)
function shellMaterial(u) {
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, forceSinglePass: true });
  const vP = positionGeometry.toVarying('vP');
  const ang = acos(clamp(dot(normalize(vP), u.uDir), -1, 1)); // 0 where it went in
  const front = u.uAge.mul(1.5).add(0.15);
  // (squares multiplied out: pow() of anything below zero is NaN on some GPUs)
  const r = ang.sub(front).div(u.uAge.mul(0.04).add(0.05));
  const ring = exp(r.mul(r).negate()).mul(exp(u.uAge.mul(-1.6)));
  const crater = exp(ang.mul(ang).negate().div(0.0049));
  const halo = exp(ang.mul(ang).negate().div(0.04)).mul(0.35);
  const heat = exp(u.uAge.mul(-0.55));
  const hot = mix(vec3(0.45, 0.05, 0.01), vec3(5.0, 2.6, 1.0), heat);
  // (smoothstep(9, 4, age), its edges reversed: WGSL’s is undefined there)
  const fade = smoothstep(4, 9, u.uAge).oneMinus();
  material.colorNode = u.uWave.mul(ring).mul(2.4).add(hot.mul(crater.add(halo.mul(heat))).mul(fade));
  material.uniforms = u;
  return material;
}

// PORTAL_FRAG, as nodes: the show’s swirl on the plane
function portalMaterial(u) {
  const material = new MeshBasicNodeMaterial({ transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide, fog: false, forceSinglePass: true });
  const c = swirl(uv().mul(2).sub(1).mul(1.22), u.uT, u.uOpen, float(7));
  material.colorNode = c.rgb.mul(1.6).div(max(c.a, 0.004));
  material.opacityNode = c.a;
  material.maskNode = c.a.greaterThanEqual(0.004);
  material.uniforms = u;
  return material;
}

// the sparks: a PointsMaterial with the spot for its map, its colours each
// spark’s, the spark a sprite with its place and colour stepped once an instance
function sparkMaterial(map, position, color) {
  const material = new PointsNodeMaterial({ map, size: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
  material.positionNode = position;
  material.colorNode = vec4(color.toVarying('vColor'), 1).mul(texture(map, uv()));
  return material;
}

export function createCrash(parent) {
  const tex = spot();
  const made = [tex];
  const keep = (...things) => {
    made.push(...things);
    return things[0];
  };

  // the flash
  const flashMat = keep(new SpriteNodeMaterial({ map: tex, color: new THREE.Color(6, 3.6, 1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  const flash = new THREE.Sprite(flashMat);
  flash.visible = false;
  parent.add(flash);

  // the shockwave and crater, laid over a planet's surface
  const shellMat = keep(shellMaterial({ uDir: uniform(new THREE.Vector3(0, 0, 1)), uAge: uniform(0), uWave: uniform(new THREE.Color(1.6, 1.2, 0.9)) }));
  const shell = new THREE.Mesh(keep(new THREE.SphereGeometry(1, 96, 48)), shellMat);
  shell.visible = false;

  // sparks, thrown out from the impact and slowing
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkCol = new Float32Array(SPARKS * 3);
  // (instance attributes, held by a geometry of our own to free)
  const sparkGeo = keep(new THREE.BufferGeometry());
  sparkGeo.setAttribute('position', new THREE.InstancedBufferAttribute(sparkPos, 3).setUsage(THREE.DynamicDrawUsage));
  sparkGeo.setAttribute('color', new THREE.InstancedBufferAttribute(sparkCol, 3).setUsage(THREE.DynamicDrawUsage));
  const sparkMat = keep(sparkMaterial(tex, instancedBufferAttribute(sparkGeo.attributes.position), instancedBufferAttribute(sparkGeo.attributes.color)));
  const sparks = new THREE.Sprite(sparkMat);
  sparks.count = SPARKS;
  sparks.frustumCulled = false;
  sparks.visible = false;
  parent.add(sparks);
  const sparkV = Array.from({ length: SPARKS }, () => ({ v: new THREE.Vector3(), life: 0, max: 1, heat: 1 }));

  // bits of hull, tumbling out and burning down
  const shardMat = keep(new MeshStandardNodeMaterial({ color: '#3d434d', metalness: 0.7, roughness: 0.45, emissive: '#ff7a2a', emissiveIntensity: 3, flatShading: true }));
  const shards = new THREE.InstancedMesh(keep(new THREE.TetrahedronGeometry(1, 0)), shardMat, SHARDS);
  shards.frustumCulled = false;
  shards.visible = false;
  parent.add(shards);
  const shardV = Array.from({ length: SHARDS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0), spin: 0, size: 0, life: 0, max: 1 }));

  // coming back: the cruiser's portal, the others' ring of light
  const portalMat = keep(portalMaterial({ uT: uniform(0), uOpen: uniform(0) }));
  const portal = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), portalMat);
  portal.visible = false;
  parent.add(portal);
  const ringMat = keep(new MeshBasicNodeMaterial({ color: new THREE.Color(2.2, 3, 5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide, forceSinglePass: true }));
  const ring = new THREE.Mesh(keep(new THREE.RingGeometry(0.92, 1, 64)), ringMat);
  ring.visible = false;
  parent.add(ring);

  const fx = { hit: -1, arrive: -1, flashAt: -1, kind: null, flashSize: 1, flashColor: new THREE.Color() };
  const tmp = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const s3 = new THREE.Vector3();
  const rand = (a, b) => a + Math.random() * (b - a);
  const randomDir = (v) => v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
  let clock = 0;

  // face the camera: undo the parent's turn, then take the camera's
  const face = (obj, camera) => {
    parent.getWorldQuaternion(q);
    obj.quaternion.copy(q.invert()).multiply(camera.quaternion);
  };

  return {
    // info: { point, normal (unit, out of the surface), body (the planet's
    // surface mesh, for the shockwave; none for a station), radius, sun }
    hit({ point, normal, body = null, radius = 1, sun = false, colour = null }) {
      fx.hit = clock;
      fx.flashAt = clock;
      fx.flashSize = sun ? 2.4 : 0.55 + Math.min(radius, 12) * 0.25;
      fx.flashColor.setRGB(...(sun ? [6, 2.8, 0.9] : [4, 2.4, 1.1]));
      if (colour) fx.flashColor.set(colour).multiplyScalar(4.5); // (a giant's clouds: its own colour)
      flash.position.copy(point).addScaledVector(normal, 0.12);
      flash.visible = true;
      // sparks: mostly outward, fanned
      for (let i = 0; i < SPARKS; i++) {
        const sp = sparkV[i];
        randomDir(sp.v).addScaledVector(normal, 1.3).normalize().multiplyScalar(rand(1.2, sun ? 5 : 3.6));
        sp.life = 0;
        sp.max = rand(0.5, 1.4);
        sp.heat = rand(0.6, 1.4);
        sparkPos[i * 3] = point.x;
        sparkPos[i * 3 + 1] = point.y;
        sparkPos[i * 3 + 2] = point.z;
      }
      sparks.visible = true;
      // the hull: not from the sun, which takes it all
      shards.visible = !sun;
      for (const sh of shardV) {
        sh.p.copy(point).addScaledVector(normal, 0.05);
        randomDir(sh.v).addScaledVector(normal, 1.1).normalize().multiplyScalar(rand(0.6, 1.8));
        randomDir(sh.axis);
        sh.spin = rand(4, 12);
        sh.size = rand(0.012, 0.04);
        sh.life = 0;
        sh.max = rand(1.2, 2.4);
      }
      // the shockwave over the surface (planets only: stations and the sun have none)
      shell.removeFromParent();
      shell.visible = false;
      if (body && !sun) {
        body.add(shell);
        shell.scale.setScalar(radius * 1.006);
        parent.localToWorld(tmp.copy(point));
        body.worldToLocal(tmp);
        shellMat.uniforms.uDir.value.copy(tmp).normalize();
        shellMat.uniforms.uAge.value = 0;
        shell.visible = true;
      }
    },

    // info: { point, kind (the ship), heading }
    arrive({ point, kind, heading = 0 }) {
      fx.arrive = clock;
      fx.kind = kind;
      if (kind === 'cruiser') {
        portal.position.copy(point);
        portal.visible = true;
      } else {
        ring.position.copy(point);
        ring.rotation.set(0, heading, 0);
        ring.visible = true;
        flash.position.copy(point);
        fx.flashAt = clock;
        fx.flashColor.setRGB(1.6, 2.3, 4);
        fx.flashSize = 0.32;
        flash.visible = true;
      }
    },

    update(dt, camera) {
      clock += dt;
      let busy = false;

      // the flash: up fast, then gone
      if (flash.visible) {
        const a = clock - fx.flashAt;
        const k = a < 0.08 ? a / 0.08 : Math.exp(-(a - 0.08) * 5);
        flash.scale.setScalar(fx.flashSize * (0.4 + Math.min(1, a / 0.12) * 0.8));
        flashMat.color.copy(fx.flashColor).multiplyScalar(k);
        if (a > 1.2) flash.visible = false;
        busy = true;
      }

      if (sparks.visible) {
        let any = false;
        for (let i = 0; i < SPARKS; i++) {
          const sp = sparkV[i];
          sp.life += dt;
          const k = Math.max(0, 1 - sp.life / sp.max);
          if (k > 0) any = true;
          sp.v.multiplyScalar(Math.exp(-dt * 2.2));
          sparkPos[i * 3] += sp.v.x * dt;
          sparkPos[i * 3 + 1] += sp.v.y * dt;
          sparkPos[i * 3 + 2] += sp.v.z * dt;
          const h = k * k * sp.heat;
          sparkCol[i * 3] = 5 * h;
          sparkCol[i * 3 + 1] = 2.4 * h * k;
          sparkCol[i * 3 + 2] = 0.7 * h * k * k;
        }
        sparkGeo.attributes.position.needsUpdate = true;
        sparkGeo.attributes.color.needsUpdate = true;
        sparks.visible = any;
        busy ||= any;
      }

      if (shards.visible) {
        let any = false;
        for (let i = 0; i < SHARDS; i++) {
          const sh = shardV[i];
          sh.life += dt;
          const k = Math.max(0, 1 - sh.life / sh.max);
          if (k > 0) any = true;
          sh.v.multiplyScalar(Math.exp(-dt * 0.9));
          sh.p.addScaledVector(sh.v, dt);
          q.setFromAxisAngle(sh.axis, sh.life * sh.spin);
          shards.setMatrixAt(i, m.compose(sh.p, q, s3.setScalar(sh.size * Math.min(1, k * 3))));
        }
        shards.instanceMatrix.needsUpdate = true;
        shardMat.emissiveIntensity = 3 * Math.exp(-(clock - fx.hit) * 1.4);
        shards.visible = any;
        busy ||= any;
      }

      if (shell.visible) {
        const a = clock - fx.hit;
        shellMat.uniforms.uAge.value = a;
        if (a > 9) {
          shell.visible = false;
          shell.removeFromParent();
        }
        busy = true;
      }

      if (portal.visible) {
        // swirls open, holds while the ship comes out, closes
        const a = clock - fx.arrive;
        const open = a < 0.45 ? a / 0.45 : a < 1.1 ? 1 : Math.max(0, 1 - (a - 1.1) / 0.4);
        portalMat.uniforms.uOpen.value = open;
        portalMat.uniforms.uT.value = clock;
        portal.scale.setScalar(0.5 * (0.3 + 0.7 * open));
        if (camera) face(portal, camera);
        if (a > 1.5) portal.visible = false;
        busy = true;
      }

      if (ring.visible) {
        const a = clock - fx.arrive;
        const k = Math.min(1, a / 0.6);
        ring.scale.setScalar(0.04 + k * 0.26);
        ringMat.color.setRGB(2.2, 3, 5).multiplyScalar((1 - k) ** 3);
        if (a > 0.6) ring.visible = false;
        busy = true;
      }
      return busy;
    },

    dispose() {
      shell.removeFromParent();
      for (const o of [flash, sparks, shards, portal, ring]) o.removeFromParent();
      shards.dispose();
      for (const thing of made) thing.dispose();
    },
  };
}
