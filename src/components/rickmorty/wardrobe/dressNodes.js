// dress.js on the node renderer: a look's colours read off each texel by
// zone and colour, as a hook on the figure's diffuse colour
// (lib/three/hookNodes.js's onColor, where dress.js put its chunk after the
// map), line for line, with the same uniform names in
// userData.regions.uniforms (each a { value }, so set() writes them as
// before). The zones and keys are ./dressCore.js's.
//
//   recolor(material, bodyId, colors) → the material (a node one), taught the body's regions
//   cloneShaded(material) → a copy that keeps its hooks
//   dressColors(figure, look) → the figure's own copies of its materials, recoloured

import { attribute, clamp, exp2, float, floor, max, min, mix, pow, select, smoothstep, uniformArray, varying, vec2, vec3 } from 'three/tsl';
import { asNode, onColor } from '../../../lib/three/hookNodes';
import { MAX_REGIONS, dressColorsWith, regionUniforms, weighs, zoneOf } from './dressCore';

export { KEYS, MAX_REGIONS, addZones, regionUniforms, zoneOf } from './dressCore';

const N = MAX_REGIONS;
// (GLSL's mod, which floors: WGSL's % truncates)
const mod = (a, b) => a.sub(b.mul(floor(a.div(b))));

// rgHsv: hue in degrees, saturation and value 0…1
function hsvOf(c) {
  const mx = max(c.r, max(c.g, c.b));
  const mn = min(c.r, min(c.g, c.b));
  const d = mx.sub(mn);
  const h = select(mx.equal(c.r), mod(c.g.sub(c.b).div(d), float(6)), select(mx.equal(c.g), c.b.sub(c.r).div(d).add(2), c.r.sub(c.g).div(d).add(4)));
  return vec3(select(d.greaterThan(1e-5), h, 0).mul(60), select(mx.greaterThan(1e-5), d.div(mx), 0), mx);
}
const inside = (x, w, soft) => smoothstep(w.x.sub(soft), w.x.add(soft), x).mul(smoothstep(w.y.sub(soft), w.y.add(soft), x).oneMinus());
const hueIn = (h, w) => select(w.y.sub(w.x).greaterThanEqual(359), float(1), select(w.x.lessThanEqual(w.y), inside(h, w, 5), max(inside(h, vec2(w.x, 366), 5), inside(h, vec2(-6, w.y), 5))));

// a { value } for an array uniform, as the GLSL's were: what's written to
// it is what the node draws with next
const held = (node) => ({
  node,
  get value() {
    return node.array;
  },
  set value(v) {
    node.array = v;
  },
});

// A material taught a body's regions (on top of whatever it's already
// taught: its rim, a paint). Its uniforms are in userData.regions; set(colors)
// changes the colours without a new program. A classic material comes back
// as its node twin: use what's returned.
export function recolor(material, bodyId, colors = {}) {
  const m = asNode(material);
  const u = regionUniforms(bodyId, colors);
  // (Walt’s and Jesse’s keep one zone a triangle, dress.js says why)
  const weighed = weighs(bodyId);
  const nodes = {
    rgOn: uniformArray(u.on, 'float'),
    rgSwatch: uniformArray(u.swatch, 'color'),
    rgZones: uniformArray(u.zones, 'float'),
    rgHue: uniformArray(u.hue, 'vec2'),
    rgSat: uniformArray(u.sat, 'vec2'),
    rgVal: uniformArray(u.val, 'vec2'),
    rgRef: uniformArray(u.ref, 'float'),
    rgShade: uniformArray(u.shade, 'vec2'),
    ...(weighed ? { rgLower: uniformArray(u.lower, 'vec2'), rgUpper: uniformArray(u.upper, 'vec2') } : {}),
  };
  const uniforms = Object.fromEntries(Object.entries(nodes).map(([k, n]) => [k, held(n)]));
  onColor(
    m,
    (diffuse) => {
      const vZone = weighed ? varying(attribute('zone', 'float'), 'vZone').setInterpolation('flat') : attribute('zone', 'float');
      const vLower = attribute('lower', 'float');
      const vUpper = attribute('upper', 'float');
      let lin = diffuse.rgb;
      const srgb = pow(max(lin, vec3(0)), vec3(1 / 2.2));
      const hsv = hsvOf(srgb);
      const zone = floor(vZone.add(0.5));
      // (a zone past 0 to 5 has no bit: read only those, dress.js says why)
      const known = zone.greaterThanEqual(0).and(zone.lessThanEqual(zoneOf('LeftHand')));
      for (let i = 0; i < N; i++) {
        const bit = select(known, mod(floor(nodes.rgZones.element(i).div(exp2(zone))), float(2)), float(0));
        let k = bit
          .mul(hueIn(hsv.x, nodes.rgHue.element(i)))
          .mul(inside(hsv.y, nodes.rgSat.element(i), 0.04))
          .mul(inside(hsv.z, nodes.rgVal.element(i), 0.04));
        if (weighed) k = k.mul(inside(vLower, nodes.rgLower.element(i), 0.03)).mul(inside(vUpper, nodes.rgUpper.element(i), 0.03));
        const shade = clamp(hsv.z.div(nodes.rgRef.element(i)), nodes.rgShade.element(i).x, nodes.rgShade.element(i).y);
        const col = pow(clamp(nodes.rgSwatch.element(i).mul(shade), 0, 1), vec3(2.2));
        // (a region that's off is skipped, as the GLSL's `continue` did)
        lin = mix(lin, col, select(nodes.rgOn.element(i).lessThan(0.5), float(0), k));
      }
      return lin;
    },
    `regions-${bodyId}`,
    nodes,
  );
  m.userData.regions = {
    uniforms,
    set(next) {
      const v = regionUniforms(bodyId, next);
      uniforms.rgOn.value = v.on;
      uniforms.rgSwatch.value = v.swatch;
    },
  };
  return m;
}

// A material's copy that keeps its hooks (its rim of light, a shirt's
// colour): Material.clone() leaves behind the methods a hook wrapped on the
// instance, and its program's key.
export function cloneShaded(material) {
  const m = material.clone();
  for (const k of Object.keys(material)) if (typeof material[k] === 'function') m[k] = material[k];
  // (and the marks that say what's in them, which a copy leaves behind:
  // house and core would put theirs on it a second time, a fog hook its)
  for (const k of ['house', 'core', '__fog']) if (material.userData[k]) Object.defineProperty(m.userData, k, { value: material.userData[k], enumerable: false, configurable: true });
  return m;
}

export const dressColors = dressColorsWith({ recolor, cloneShaded });
