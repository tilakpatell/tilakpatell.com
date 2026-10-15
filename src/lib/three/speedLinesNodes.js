// speedLines.js on the node renderer: at speed, the stars ahead drawn out
// into faint lines streaming past, riding with the camera along its line
// of sight. The same one LineSegments, a line a star, worked out in the
// vertex stage, now a LineBasicNodeMaterial whose positionNode and
// colorNode are the GLSL's vertex and fragment shaders; additive, no
// depth, no textures, no fog (a ShaderMaterial took none). The uniforms
// keep their names, as uniform nodes on `material.uniforms`, so a frame
// writing `.value` writes the same thing.
//
// createSpeedLines({ small }) → { group (the camera’s child), set({ stretch, speed }), busy, update(dt), dispose() }

import * as THREE from 'three';
import { LineBasicNodeMaterial } from 'three/webgpu';
import { attribute, cos, floor, float, sin, smoothstep, uniform, varying, vec3, vec4 } from 'three/tsl';

const LINES = 520;
const LINES_SMALL = 260;
const DEPTH = 420; // how deep the field of stars is
const NEAR = 3;

// GLSL's mod (floored), so a star behind the camera wraps to the back
const mod = (a, b) => a.sub(b.mul(floor(a.div(b))));

// The GLSL's LINE_VERT and LINE_FRAG, line for line: the point on the line,
// and its fade carried to the fragment as vFade was.
function lineNodes(u) {
  const aStar = attribute('aStar', 'vec4'); // angle round the line of sight, distance out from it, depth phase, brightness
  const aEnd = attribute('aEnd', 'float'); // 0 the head (nearer), 1 the tail
  const head = float(NEAR).add(mod(aStar.z.mul(DEPTH).sub(u.uTravel), float(DEPTH)));
  const z = head.add(aEnd.mul(u.uLen).mul(aStar.w.mul(0.6).add(0.4)));
  const r = aStar.y;
  const position = vec3(cos(aStar.x).mul(r), sin(aStar.x).mul(r), z.negate());
  // brightest at the head, gone down the tail; faint far off, and gone before it reaches you
  const fade = varying(
    aEnd
      .mul(0.92)
      .oneMinus()
      .mul(aStar.w)
      .mul(smoothstep(DEPTH, DEPTH * 0.55, head))
      .mul(smoothstep(NEAR, NEAR + 8, head))
      .mul(u.uStretch),
    'vFade',
  );
  return { position, color: vec4(u.uColor.mul(fade), 1) };
}

export function createSpeedLines({ small = false } = {}) {
  const group = new THREE.Group();
  const n = small ? LINES_SMALL : LINES;
  const star = new Float32Array(n * 2 * 4);
  const end = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.2 + Math.random() ** 0.7 * 26;
    const z = Math.random();
    const b = 0.35 + Math.random() * 0.65;
    for (let k = 0; k < 2; k++) {
      star.set([a, r, z, b], (i * 2 + k) * 4);
      end[i * 2 + k] = k;
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
  lineGeo.setAttribute('aStar', new THREE.BufferAttribute(star, 4));
  lineGeo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const uniforms = { uTravel: uniform(0), uLen: uniform(0), uStretch: uniform(0), uColor: uniform(new THREE.Color(1.6, 1.8, 2.4)) };
  const lineMat = new LineBasicNodeMaterial({
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const shape = lineNodes(uniforms);
  lineMat.positionNode = shape.position;
  lineMat.colorNode = shape.color;
  lineMat.uniforms = uniforms;
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  lines.renderOrder = 50;
  lines.visible = false;
  group.add(lines);

  const now = { stretch: 0, speed: 0 };
  let travel = 0;
  return {
    group,
    // stretch 0…1: the stars drawn out into lines; speed: how fast they rush past
    set(o) {
      Object.assign(now, o);
    },
    get busy() {
      return now.stretch > 0.001;
    },
    update(dt) {
      // (kept to one depth of the field, which the shader’s mod can’t tell
      // from the whole of it, so a long run never wears the float down)
      travel = (travel + dt * (40 + now.speed)) % DEPTH;
      const u = lineMat.uniforms;
      lines.visible = now.stretch > 0.001;
      u.uStretch.value = Math.min(1, now.stretch * 1.4);
      u.uLen.value = 0.4 + now.stretch ** 2 * 260;
      u.uTravel.value = travel;
    },
    dispose() {
      lineGeo.dispose();
      lineMat.dispose();
    },
  };
}
