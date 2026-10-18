// The Nazgûl's materials (./wraiths.js makes the rest): the cloth, the
// steel, the blade, the dark in the hood and the face and crown the Ring
// shows, their GLSL patches for the classic renderer, the night the steel
// sees, and the Ring's switch. ../nodes/towns/wraithsShaders.js is the same
// on the node renderer.

import * as THREE from "three";
import { clamp01, smooth } from "../../../lib/paint";

// What the steel sees: a dark night with a cold sky over it, a moon high on
// one side, a warm lit window low on the other, and a long thin light for a
// blade to catch.
export function nightEnv(renderer) {
  const room = new THREE.Scene();
  const walls = new THREE.BoxGeometry(20, 20, 20);
  const shade = [];
  const p = walls.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = (p.getY(i) + 10) / 20;
    shade.push(0.012 + k * 0.05, 0.014 + k * 0.06, 0.02 + k * 0.09);
  }
  walls.setAttribute("color", new THREE.Float32BufferAttribute(shade, 3));
  room.add(
    new THREE.Mesh(
      walls,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }),
    ),
  );
  const glow = (hex, k, w, h, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(hex).multiplyScalar(k),
        side: THREE.DoubleSide,
      }),
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    room.add(m);
  };
  glow(0xc4d2f0, 1.6, 4, 4, [-5, 8, -4]);
  glow(0xffa860, 1.5, 3, 2, [7, 0.5, 3]);
  glow(0xdfe6f4, 1.0, 14, 0.5, [0, 6, 7]);
  glow(0x8a9ab8, 0.5, 12, 3, [-8, 2, 5]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.03).texture;
  pmrem.dispose();
  room.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return env;
}

// ── the materials ──

// Shared by every Nazgûl's cloth: wind and flutter in the vertex shader;
// the tears, the faint cold rim, the shade (folds, the hood's dark) in the
// fragment; and the Ring's pale form.
const CLOTH_VERT = /* glsl */ `
#include <begin_vertex>
vCloth = uv;
vShade = color.g;
{
  float w = color.r;
  float ph = color.b * 6.2832;
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  float t = uTime;
  float gust = 0.65 + 0.35 * sin(t * 0.41 + wp.x * 0.09 + wp.z * 0.07);
  vec3 wind = transpose(mat3(modelMatrix)) * uWind;
  vec3 across = vec3(-wind.z, 0.0, wind.x);
  float a = sin(t * 1.3 + ph + wp.x * 0.6 + wp.z * 0.45 + position.y * 1.9);
  float b = sin(t * 2.1 + ph * 1.7 + position.y * 3.3 + wp.z * 0.3);
  transformed += (wind * (0.55 + 0.45 * a) * gust + across * b * 0.5) * w;
  float hem = 1.0 - smoothstep(0.0, 0.5, uv.y);
  float f = sin(t * 6.1 + uv.x * 21.0 + ph * 3.0) + 0.6 * sin(t * 9.3 - uv.x * 37.0 + ph);
  transformed += objectNormal * f * hem * w * 0.022;
}
`;
const CLOTH_FRAG_HEAD = /* glsl */ `
uniform sampler2D uTorn;
uniform vec2 uTear;
uniform vec3 uRimColor;
uniform float uRim;
uniform float uInner;
uniform float uRing;
uniform vec3 uGhost;
varying vec2 vCloth;
varying float vShade;
`;

// The materials every Nazgûl shares, on the uniforms U the kit keeps, and
// setRing(k) to show them through the Ring.
export function wraithMaterials(U, { weave, weaveN, env }) {
  const cloth = new THREE.MeshStandardMaterial({
    map: weave,
    normalMap: weaveN,
    normalScale: new THREE.Vector2(1, 1),
    roughness: 0.93,
    metalness: 0,
    side: THREE.DoubleSide,
    vertexColors: true,
    alphaTest: 0.5,
  });
  cloth.name = "wraithCloth";
  cloth.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader =
      "uniform float uTime;\nuniform vec3 uWind;\nvarying vec2 vCloth;\nvarying float vShade;\n" +
      s.vertexShader.replace("#include <begin_vertex>", CLOTH_VERT);
    s.fragmentShader = (CLOTH_FRAG_HEAD + s.fragmentShader)
      // the colour attribute is the cloth's numbers, not a colour; the
      // ragged ends are worn thin and greyer
      .replace(
        "#include <color_fragment>",
        "diffuseColor.rgb *= 1.0 + 0.4 * (1.0 - smoothstep(0.0, uTear.x, vCloth.y));",
      )
      // torn: the mask decides; through the Ring, see-through but for the edges
      .replace(
        "#include <alphatest_fragment>",
        `diffuseColor.a = vCloth.y < uTear.x ? texture2D(uTorn, vec2(vCloth.x * uTear.y, vCloth.y / uTear.x)).r : 1.0;
        #include <alphatest_fragment>
        diffuseColor.a = 1.0;`,
      )
      .replace(
        "#include <alphahash_fragment>",
        `float fres = 1.0 - saturate(abs(dot(normalize(vNormal), normalize(vViewPosition))));
        diffuseColor.a = mix(1.0, 0.3 + 0.6 * fres * fres, uRing);
        #include <alphahash_fragment>`,
      )
      // black wool takes little gloss
      .replace(
        "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
        "vec3 outgoingLight = totalDiffuse + totalSpecular * 0.3 + totalEmissiveRadiance;",
      )
      // a cold rim, stronger where the cloth faces the sky
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          vec3 gn = normalize(vNormal);
          float fr = 1.0 - saturate(abs(dot(gn, normalize(vViewPosition))));
          vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          float sky = 0.3 + 0.7 * saturate(dot(gn, upV) * 0.5 + 0.5);
          fr *= fr;
          totalEmissiveRadiance += uRimColor * (fr * fr * uRim * sky);
        }`,
      )
      // folds and the hood's dark; the inside of the cloth darker; the Ring's pale glow
      .replace(
        "#include <opaque_fragment>",
        `float shadeK = mix(vShade, 0.3 + 0.7 * vShade, uRing);
        outgoingLight *= shadeK * (gl_FrontFacing ? 1.0 : mix(uInner, 0.8, uRing));
        {
          float fr = 1.0 - saturate(abs(dot(normal, normalize(vViewPosition))));
          vec3 ghost = uGhost * (0.07 + 0.22 * shadeK + 0.8 * fr * fr * fr);
          outgoingLight = mix(outgoingLight, ghost + outgoingLight * 1.5, uRing);
        }
        #include <opaque_fragment>`,
      );
  };
  cloth.customProgramCacheKey = () => "wraith-cloth-1";

  // steel: dark, a little sheen, the night in it; through the Ring, pale silver
  const silver = (m, key) => {
    m.onBeforeCompile = (s) => {
      s.uniforms.uRing = U.uRing;
      s.uniforms.uGhost = U.uGhost;
      s.fragmentShader =
        "uniform float uRing;\nuniform vec3 uGhost;\n" +
        s.fragmentShader.replace(
          "#include <opaque_fragment>",
          `{
          float fr = 1.0 - saturate(abs(dot(normal, normalize(vViewPosition))));
          vec3 pale = uGhost * (0.18 + 0.7 * fr * fr) + outgoingLight * 1.4;
          outgoingLight = mix(outgoingLight, pale, uRing * 0.85);
        }
        #include <opaque_fragment>`,
        );
    };
    m.customProgramCacheKey = () => key;
    return m;
  };
  const steel = silver(
    new THREE.MeshStandardMaterial({
      color: 0x3a3d44,
      metalness: 0.88,
      roughness: 0.33,
      envMap: env,
      envMapIntensity: 1.1,
    }),
    "wraith-steel-1",
  );
  const blade = silver(
    new THREE.MeshStandardMaterial({
      color: 0xb8bec8,
      metalness: 1,
      roughness: 0.2,
      envMap: env,
      envMapIntensity: 1.3,
    }),
    "wraith-blade-1",
  );
  // the dark inside the hood, and what the Ring shows there
  const voidMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const face = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0xc8ccd4,
    roughness: 0.8,
    emissive: new THREE.Color(0.42, 0.45, 0.5),
    transparent: true,
    opacity: 0,
    visible: false,
  });
  // its own pale light, dark in the sockets and hollows
  face.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor;",
    );
  };
  face.customProgramCacheKey = () => "wraith-face-1";
  const crown = new THREE.MeshStandardMaterial({
    color: 0xa8acb4,
    metalness: 0.8,
    roughness: 0.35,
    envMap: env,
    emissive: new THREE.Color(0.22, 0.23, 0.26),
    transparent: true,
    opacity: 0,
    visible: false,
  });
  const mats = { cloth, steel, blade, void: voidMat, face, crown };

  // Through the Ring: the cloth blends (switched on only while the Ring is
  // on, when its alpha starts at 1, so nothing jumps; the first time costs
  // one shader compile), the face and crown fade in.
  const setRing = (k) => {
    const r = clamp01(k);
    U.uRing.value = r;
    const see = r > 0.002;
    if (cloth.transparent !== see) {
      cloth.transparent = see;
      cloth.needsUpdate = true;
    }
    voidMat.color.setRGB(0.06 * r, 0.065 * r, 0.075 * r);
    face.opacity = crown.opacity = smooth(0.15, 0.9, r);
    face.visible = crown.visible = r > 0.01;
  };

  return { mats, setRing };
}
