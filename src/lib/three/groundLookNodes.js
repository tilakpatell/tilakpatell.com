// groundLook.js on the node renderer: a world's ground, shaded by the
// site's palette by height and slope, broken up by noise at three sizes,
// rippled, grained, wearing its scan close up and layered at ultra, as a
// MeshStandardNodeMaterial with the GLSL's four chunk swaps as node hooks
// (./hookNodes.js): the colour (color_fragment), the relief
// (normal_fragment_maps), the glints (emissivemap_fragment: added to the
// light out, as totalEmissiveRadiance was) and the wet's smoothness
// (roughnessmap_fragment). The same arguments, and the same uniforms under
// the same names (uniform and texture nodes: uniforms.uMarks.value = …).
//
//   groundMaterial(site, { small, map, splat, half }) → { material, uniforms }
//
// `map` is groundmapNodes' createGroundMap (its groundColour). A texture
// the GLSL left null until it loaded (uMarks, uScan…) starts as a blank
// here, a texture node needing a picture; nothing reads it until the
// uniform that turns it on says so, as before.

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { Fn, If, abs, cameraPosition, cameraViewMatrix, clamp, cos, dot, float, floor, fract, length, mat2, mix, normalWorldGeometry, normalize, positionWorld, pow, roughness, select, smoothstep, step, texture, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { noiseTexture } from './noiseTex';
import { loadScan, scanOf } from './scansNodes';
import { splatOf } from './splatNodes';
import { detailLevel } from '../detail';
import { onColor, onLight, onNormal, wrap } from './hookNodes';

const blank = (r, g, b) => {
  const t = new THREE.DataTexture(Uint8Array.from([r, g, b, 255]), 1, 1);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
};
const BLACK = blank(0, 0, 0);
const WHITE = blank(255, 255, 255);
const FLAT = blank(128, 128, 255);

// gHash: a cell's random number (the GLSL's, line for line)
const gHash = (q) => {
  let p = fract(q.mul(vec2(123.34, 456.21)));
  p = p.add(dot(p, p.add(45.32)));
  return fract(p.x.mul(p.y));
};
// the GLSL's 1.0 - smoothstep(a, b, x), written as it was
const fall = (a, b, x) => smoothstep(a, b, x).oneMinus();

export function groundMaterial(site, { small = false, map = null, splat: layered = false, half = 640 } = {}) {
  const g = site.ground;
  const p = g.palette;
  const col = (c, fallback) => new THREE.Color(c ?? fallback);
  const uniforms = {
    uLow: uniform(col(p.low)),
    uHigh: uniform(col(p.high, p.low)),
    uRock: uniform(col(p.rock, p.low)),
    uAccent: uniform(col(p.accent, p.high ?? p.low)),
    uDeep: uniform(col(p.deep, p.low)),
    uHeights: uniform(new THREE.Vector4(p.hLow ?? 0, p.hHigh ?? 30, p.rockAt ?? 0.42, p.accentCover ?? 0)),
    uRipple: uniform(new THREE.Vector4(p.ripple?.strength ?? 0, p.ripple?.scale ?? 2.4, Math.cos(p.ripple?.wind ?? g.wind ?? 0), Math.sin(p.ripple?.wind ?? g.wind ?? 0))),
    uGrain: uniform(new THREE.Vector3(p.grain ?? 0.5, small ? 0 : (p.sparkle ?? 0), p.patch ?? 0.5)),
    uWet: uniform(new THREE.Vector4(p.wet?.level ?? -1e4, p.wet?.band ?? 1.5, 0, 0)),
    uWetColor: uniform(col(p.wet?.color, '#000000')),
    uMarks: texture(BLACK),
    uMarkColor: uniform(col(p.mark, '#000000')),
    uHalf: uniform(half),
    uNoise: texture(noiseTexture()),
    uScan: texture(WHITE),
    uScanN: texture(FLAT),
    uScanK: uniform(new THREE.Vector4(0.5, 0, 0, 0.5)),
    uScanFade: uniform(new THREE.Vector2(28, 90)),
    uMacro: texture(WHITE),
    uSteep: texture(WHITE),
    uSteepN: texture(FLAT),
    uDecal: texture(WHITE),
    uLayerK: [uniform(new THREE.Vector2(0.5, 0.5)), uniform(new THREE.Vector2(0.5, 0.5)), uniform(new THREE.Vector2(0.5, 0.5))],
    uSplatK: uniform(new THREE.Vector4(0.6, 0.75, 0.6, 0)),
  };
  // (uLayerK was a vec2[3] whose .value the loader wrote by index: kept so)
  uniforms.uLayerK.value = uniforms.uLayerK.map((u) => u.value);
  const look = g.detailLook ?? {};
  const scan = g.detail && !small && detailLevel() !== 'low' ? scanOf(g.detail) : null;
  if (scan) {
    uniforms.uScanFade.value.set(look.near ?? 28, look.far ?? 90);
    loadScan(g.detail).then((got) => {
      if (!got) return;
      uniforms.uScan.value = got.map;
      if (got.normalMap) uniforms.uScanN.value = got.normalMap;
      const metres = look.metres ?? scan.metres ?? 2;
      uniforms.uScanK.value.set(1 / metres, look.color ?? 0.75, got.normalMap ? (look.normal ?? 0.7) : 0, Math.pow(scan.mean ?? 0.8, 2.2));
    });
  }
  const layers = scan && layered ? splatOf(site) : null;
  if (layers) {
    uniforms.uScanFade.value.set((look.near ?? 28) * 1.5, (look.far ?? 90) * 1.8);
    const s = site.ground.splatLook ?? {};
    uniforms.uSplatK.value.set(s.macro ?? 0.6, s.decal ?? 0.75, s.wet ?? (site.water && site.water.kind !== 'lava' ? 0.6 : 0.25), 0);
    const roles = [layers.base, layers.macro ?? layers.base, layers.steep ?? layers.base, layers.decal ?? layers.base];
    Promise.all(roles.map((r) => loadScan(r, { xl: true }))).then((got) => {
      if (got.some((x) => !x)) return;
      const [, macro, steep, decal] = got;
      uniforms.uMacro.value = macro.map;
      uniforms.uSteep.value = steep.map;
      if (steep.normalMap) uniforms.uSteepN.value = steep.normalMap;
      uniforms.uDecal.value = decal.map;
      roles.slice(1).forEach((r, i) => uniforms.uLayerK.value[i].set(1 / (scanOf(r).metres ?? 2), Math.pow(scanOf(r).mean ?? 0.8, 2.2)));
      uniforms.uSplatK.value.w = 1;
    });
  }

  const u = uniforms;
  const [k0, k1, k2] = u.uLayerK;
  const gTex = (q) => u.uNoise.sample(q);
  const vGround = positionWorld;
  const vGroundN = normalWorldGeometry;
  const distOf = () => length(vGround.sub(cameraPosition));
  const gTri = (t, q, w) => t.sample(q.zy).rgb.mul(w.x).add(t.sample(q.xz).rgb.mul(w.y)).add(t.sample(q.xy).rgb.mul(w.z));

  // color_fragment's block: the colour diffuseColor is multiplied by, and
  // gWet, which the roughness reads (SPLAT). Its statements go straight
  // into the fragment's stack (a Fn with an If in it, called inside an
  // expression, can't be typed before it's built).
  const colour = (wetOut) => {
    const xz = vGround.xz;
    const dist = distOf().toVar();
    const nBig = gTex(xz.div(560)).r.mul(0.65).add(gTex(xz.div(140)).g.mul(0.35)).toVar();
    const nMid = gTex(xz.div(70)).g.mul(0.6).add(gTex(xz.div(22)).b.mul(0.4)).toVar();
    const nFine = gTex(xz.div(9)).a.toVar();
    const slope = clamp(normalize(vGroundN).y, 0, 1).oneMinus();
    const h = vGround.y.add(nBig.sub(0.5).mul(u.uHeights.y.sub(u.uHeights.x)).mul(0.35));
    const c = mix(u.uLow, u.uHigh, smoothstep(u.uHeights.x, u.uHeights.y, h)).toVar();
    // patches of the accent, and the deep colour in the hollows
    const cover = u.uHeights.w.oneMinus();
    c.assign(mix(c, u.uAccent, smoothstep(cover, cover.add(0.12), nBig.mul(0.7).add(nMid.mul(0.45))).mul(step(0.001, u.uHeights.w))));
    c.assign(mix(c, u.uDeep, smoothstep(0.62, 0.8, nMid).mul(0.35).mul(u.uGrain.z)));
    // rock where it's steep
    const rock = smoothstep(u.uHeights.z, u.uHeights.z.add(0.14), slope.add(nMid.sub(0.5).mul(0.16))).toVar();
    const rockC = u.uRock.mul(gTex(vec2(xz.x.mul(0.004).add(xz.y.mul(0.003)), vGround.y.mul(0.035))).b.mul(0.4).add(0.78));
    c.assign(mix(c, rockC, rock));
    // darker toward the water's edge
    c.assign(mix(c, u.uWetColor, fall(u.uWet.x, u.uWet.x.add(u.uWet.y), vGround.y).mul(0.75).mul(step(-9999, u.uWet.x))));
    if (map) {
      const mq = abs(xz).div(u.uHalf);
      c.assign(mix(c, map.groundColour(xz), fall(0.88, 1, mq.x.max(mq.y))));
    }
    // grain close up, fading out before it shimmers
    const near = fall(30, 160, dist);
    c.mulAssign(nFine.sub(0.5).mul(0.12).add(nMid.sub(0.5).mul(0.16)).mul(u.uGrain.x).mul(mix(0.5, 1, near)).add(1));
    if (layers) {
      wetOut.assign(0);
      If(u.uScanK.y.greaterThan(0).and(u.uSplatK.w.greaterThan(0.5)), () => {
        const scanNear = fall(u.uScanFade.x, u.uScanFade.y, dist);
        const sc = u.uScan.sample(xz.mul(u.uScanK.x)).rgb.div(u.uScanK.w.max(0.05)).toVar();
        const sc2 = u.uScan.sample(mat2(0.8, -0.6, 0.6, 0.8).mul(xz).mul(u.uScanK.x).mul(0.31)).rgb.div(u.uScanK.w.max(0.05));
        sc.assign(mix(sc, sc.mul(sc2), 0.5));
        const mK = smoothstep(0.5, 0.68, nBig.mul(0.75).add(nMid.mul(0.35))).mul(u.uSplatK.x);
        sc.assign(mix(sc, u.uMacro.sample(xz.mul(k0.x)).rgb.div(k0.y.max(0.05)), mK));
        const dc = xz.div(7);
        const cid = floor(dc);
        const ctr = vec2(gHash(cid.add(3.1)), gHash(cid.add(7.7))).mul(0.6).add(0.2);
        const blot = fall(0.16, 0.4, length(fract(dc).sub(ctr)).add(nFine.sub(0.5).mul(0.4))).mul(step(0.5, gHash(cid)));
        sc.assign(mix(sc, u.uDecal.sample(xz.mul(k2.x)).rgb.div(k2.y.max(0.05)), blot.mul(u.uSplatK.y).mul(rock.oneMinus())));
        const tw = pow(abs(normalize(vGroundN)), vec3(4)).toVar();
        tw.divAssign(tw.x.add(tw.y).add(tw.z));
        sc.assign(mix(sc, gTri(u.uSteep, vGround.mul(k1.x), tw).div(k1.y.max(0.05)), rock));
        c.mulAssign(mix(vec3(1, 1, 1), sc, u.uScanK.y.mul(scanNear)));
      });
      // wet: by the water's edge, and in the hollows (darker, smoother)
      const byWater = fall(u.uWet.x, u.uWet.x.add(u.uWet.y.mul(2.5)), vGround.y).mul(step(-9999, u.uWet.x));
      const inHollow = smoothstep(0.68, 0.86, nMid.mul(0.7).add(nFine.mul(0.3))).mul(u.uSplatK.z).mul(rock.oneMinus());
      wetOut.assign(byWater.max(inHollow).mul(rock.mul(0.7).oneMinus()));
      c.mulAssign(wetOut.mul(0.32).oneMinus());
    } else {
      If(u.uScanK.y.greaterThan(0), () => {
        const scanNear = fall(u.uScanFade.x, u.uScanFade.y, dist);
        const sc = u.uScan.sample(xz.mul(u.uScanK.x)).rgb.div(u.uScanK.w.max(0.05));
        c.mulAssign(mix(vec3(1, 1, 1), sc, u.uScanK.y.mul(scanNear)));
      });
    }
    // where things have been (sampled always, used inside the square)
    const muv = xz.div(u.uHalf.mul(2)).add(0.5);
    const inside = muv.x.greaterThan(0).and(muv.x.lessThan(1)).and(muv.y.greaterThan(0)).and(muv.y.lessThan(1));
    const marked = mix(c, u.uMarkColor, u.uMarks.sample(muv).r);
    return select(inside, marked, c);
  };

  const material = new MeshStandardNodeMaterial({ color: '#ffffff', roughness: p.roughness ?? 0.94, metalness: 0 });
  const wets = new WeakMap(); // builder → gWet
  const nodes = { ...uniforms, k0, k1, k2, ...(map?.uniforms ?? {}) };
  delete nodes.uLayerK;
  onColor(
    material,
    (d, builder) => {
      const wet = float(0).toVar('gWet');
      wets.set(builder, wet);
      return d.rgb.mul(colour(wet));
    },
    `galaxy-ground${map ? ':map' : ''}${layers ? ':splat' : ''}`,
    nodes,
  );

  // normal_fragment_maps' block: ripples across the wind, a little
  // roughness everywhere, the scan's relief and (SPLAT) the rock's
  const relief = Fn(([normal]) => {
    const dist = distOf();
    const fadeR = fall(40, 220, dist);
    const xz = vGround.xz;
    const across = vec2(u.uRipple.z, u.uRipple.w);
    const phase = dot(xz, across).mul(u.uRipple.y).add(gTex(xz.div(40)).b.mul(9));
    const flatK = smoothstep(0.65, 0.95, normalize(vGroundN).y);
    const tilt = vec3(across.x, 0, across.y).mul(cos(phase)).mul(u.uRipple.x).mul(fadeR).mul(flatK).toVar();
    const gq = xz.div(7);
    const e = 1 / 256;
    const n0 = gTex(gq).a;
    tilt.addAssign(vec3(gTex(gq.add(vec2(e, 0))).a.sub(n0), 0, gTex(gq.add(vec2(0, e))).a.sub(n0)).mul(2.2).mul(u.uGrain.x).mul(fadeR));
    If(u.uScanK.z.greaterThan(0), () => {
      const scanNear = fall(u.uScanFade.x, u.uScanFade.y, dist);
      const tn = u.uScanN.sample(xz.mul(u.uScanK.x)).xyz.mul(2).sub(1);
      tilt.subAssign(vec3(tn.x, 0, tn.y).mul(u.uScanK.z).mul(scanNear).mul(flatK));
      if (layers) {
        If(u.uSplatK.w.greaterThan(0.5), () => {
          const nw = normalize(vGroundN);
          const tw = pow(abs(nw), vec3(4)).toVar();
          tw.divAssign(tw.x.add(tw.y).add(tw.z));
          const sp = vGround.mul(k1.x);
          const tx = u.uSteepN.sample(sp.zy).xyz.mul(2).sub(1);
          const tz = u.uSteepN.sample(sp.xy).xyz.mul(2).sub(1);
          const side = vec3(0, tx.y, tx.x).mul(tw.x).add(vec3(tz.x, tz.y, 0).mul(tw.z));
          tilt.subAssign(side.mul(u.uScanK.z).mul(scanNear).mul(flatK.oneMinus()));
        });
      }
    });
    return normalize(normal.sub(cameraViewMatrix.mul(vec4(tilt, 0)).xyz));
  });
  onNormal(material, (normal) => relief(normal), 'galaxy-ground:relief');

  // emissivemap_fragment's block: glints off snow and salt, close up (a
  // pin-prick in one cell in seventy, which shift as you move)
  onLight(material, (light) => {
    const dist = distOf();
    const gq = vGround.xz.mul(9);
    const cellP = floor(gq);
    const seed = gHash(cellP.add(floor(cameraPosition.xz.mul(0.6))));
    const spot = vec2(gHash(cellP.add(17.3)), gHash(cellP.add(41.9))).mul(0.7).add(0.15);
    const pin = smoothstep(0.16, 0, length(fract(gq).sub(spot)));
    const glint = step(0.986, seed).mul(pin);
    return light.add(vec3(glint.mul(u.uGrain.y).mul(fall(3, 16, dist)).mul(1.2)));
  }, 'galaxy-ground:glint');

  // (wet ground is smoother: roughnessmap_fragment's line, after three's own)
  if (layers) {
    wrap(
      material,
      'setupVariants',
      (out, builder) => {
        const wet = wets.get(builder);
        if (wet) roughness.mulAssign(wet.mul(0.55).oneMinus());
        return out;
      },
      'galaxy-ground:wet',
    );
  }
  return { material, uniforms };
}
