// The study’s materials on the node renderer, and the Ring’s wraith-world
// in them (the Road’s pattern, road/hooks.js, copied: one uniform,
// uVision, drains every lit colour toward a cold grey-blue, so the vision
// reads on every tier with no pass of its own). A ghost is a card that
// shows only as the vision rises; the moon-letters likewise, unlit.
//
//   createMats() → { uVision, card(map, opts), lit(opts), ghost(map), moon(map), glow(colour), dispose() }
//   canvasMap(canvas, opts) → a colour texture; dataMap(canvas, opts) → a normal or roughness one

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial, SpriteNodeMaterial } from 'three/webgpu';
import { dot, mix, texture, uniform, vec3, vec4 } from 'three/tsl';
import { makeCanvas } from '../../../lib/paint';

const COLD = vec3(0.55, 0.6, 0.7);
const LUMA = vec3(0.2126, 0.7152, 0.0722);
const PAPER_GLOW = 0.3;

// a soft round light, white, for every glow to tint
function glowTexture() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function canvasMap(canvas, { repeat = false, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// a map of numbers, not colours: a surface's relief (a normal map) or its roughness
export function dataMap(canvas, { repeat = false, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function createMats() {
  const uVision = uniform(0);
  const made = [];
  const keep = (m) => (made.push(m), m);
  const drain = (rgb) => mix(rgb, COLD.mul(dot(rgb, LUMA).mul(1.5)), uVision.mul(0.92));
  const soft = glowTexture();

  return {
    uVision,
    soft,
    // a cut-out on card: its picture, its margin, nothing beyond. `soft`:
    // a see-through one (rain, snow, birds) blended rather than cut;
    // `shine`: a uniform that lifts it toward light, for a toy that glows
    card(map, { soft: blend = false, shine = null } = {}) {
      const m = new MeshStandardNodeMaterial({ side: THREE.DoubleSide, roughness: 0.92, metalness: 0 });
      const t = texture(map);
      m.colorNode = vec4(drain(t.rgb), t.a);
      // (paper holds the candlelight: a card facing away from every flame
      // still reads as painted, not as a black cut-out)
      const paper = drain(t.rgb).mul(PAPER_GLOW);
      m.emissiveNode = shine ? paper.add(t.rgb.mul(shine)) : paper;
      if (blend) {
        m.transparent = true;
        m.depthWrite = false;
      } else m.alphaTest = 0.5;
      return keep(m);
    },
    // a thing under the Ring: shows as the vision rises, pale and lit from within
    ghost(map) {
      const m = new MeshBasicNodeMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false });
      const t = texture(map);
      m.colorNode = vec4(t.rgb.mul(1.2), 1);
      m.opacityNode = t.a.mul(uVision).mul(0.9);
      return keep(m);
    },
    // the moon-letters in a page’s margins: silver, unlit, only under the Ring
    moon(map) {
      const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      const t = texture(map);
      m.colorNode = vec4(vec3(0.85, 0.92, 1).mul(1.4), 1);
      m.opacityNode = t.a.mul(uVision);
      return keep(m);
    },
    // a solid in the study: oak, wax, stone, leather. `normalMap` its relief,
    // `roughnessMap` where it shines (times `roughness`), `envMap` the room
    // seen in it, for the metals
    lit({ color = 0xffffff, map = null, roughness = 0.8, metalness = 0, emissive = null, side = THREE.FrontSide, normalMap = null, normalScale = 1, roughnessMap = null, envMap = null, envMapIntensity = 1 } = {}) {
      const m = new MeshStandardNodeMaterial({ roughness, metalness, side });
      const c = vec3(...new THREE.Color(color).toArray());
      m.colorNode = vec4(drain(map ? texture(map).rgb.mul(c) : c), 1);
      if (emissive) m.emissiveNode = vec3(...new THREE.Color(emissive).toArray());
      if (normalMap) {
        m.normalMap = normalMap;
        m.normalScale.set(normalScale, normalScale);
      }
      if (roughnessMap) m.roughnessMap = roughnessMap;
      if (envMap) {
        m.envMap = envMap;
        m.envMapIntensity = envMapIntensity;
      }
      return keep(m);
    },
    // the soft shadow a standing card lays on its page (its opacity set as it stands)
    shade(map) {
      return keep(new MeshBasicNodeMaterial({ map, color: new THREE.Color(0x1a0e06), transparent: true, depthWrite: false, opacity: 0 }));
    },
    // a light seen: a glow card that always faces the eye, added to what is behind
    glow(colour, opacity = 1) {
      const m = new SpriteNodeMaterial({ map: soft, color: new THREE.Color(colour), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity });
      return keep(m);
    },
    dispose() {
      for (const m of made) m.dispose();
      soft.dispose();
    },
  };
}
