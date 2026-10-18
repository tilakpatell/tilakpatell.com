// The Nazgûl's materials on the node renderer: ../../towns/wraithsShaders.js's
// GLSL patches, line for line in TSL, as hooks on standard node materials;
// the night the steel sees prefiltered by the node renderer's PMREM (the
// classic one's passes are GLSL); the Ring's switch the same code. The
// uniforms are the kit's own { value } holders (wraiths.js's U, which its
// tick and setRing write), followed every render; the cloth keeps them on
// `material.uniforms` under the GLSL's names.
//
// What the node renderer does for the GLSL's chunks: the cloth's colour
// attribute holds its numbers, not a colour, and the GLSL took it out of
// diffuseColor by swapping color_fragment; here the material doesn't take
// vertex colours at all (vertexColors false) and the shader reads the
// attribute itself. The tears are the opacity three tests against
// alphaTest, as the GLSL's own alpha was.

import * as THREE from "three";
import {
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  PMREMGenerator,
} from "three/webgpu";
import {
  abs,
  attribute,
  bool,
  cameraViewMatrix,
  diffuseColor,
  dot,
  frontFacing,
  mat3,
  materialEmissive,
  mix,
  modelWorldMatrix,
  normalGeometry,
  normalView,
  normalViewGeometry,
  normalize,
  positionGeometry,
  positionView,
  saturate,
  select,
  sin,
  smoothstep,
  texture,
  transpose,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { clamp01, smooth } from "../../../../lib/paint";
import {
  follow,
  onLight,
  onPosition,
  wrap,
} from "../../../../lib/three/hookNodes";

// What the steel sees: a dark night with a cold sky over it, a moon high on
// one side, a warm lit window low on the other, and a long thin light for a
// blade to catch. (The original's room, copied: that file holds GLSL.)
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
      new MeshBasicNodeMaterial({ vertexColors: true, side: THREE.BackSide }),
    ),
  );
  const glow = (hex, k, w, h, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new MeshBasicNodeMaterial({
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
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.03).texture;
  pmrem.dispose();
  room.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return env;
}

// how much a surface turns from the eye: 1 at its edge, 0 face on
const edge = (n) =>
  saturate(abs(dot(normalize(n), normalize(positionView)))).oneMinus();

// The materials every Nazgûl shares, on the uniforms U the kit keeps, and
// setRing(k) to show them through the Ring.
export function wraithMaterials(U, { weave, weaveN, env }) {
  const n = {
    uTime: follow(U.uTime, "float"),
    uWind: follow(U.uWind),
    uTorn: texture(U.uTorn.value),
    uTear: follow(U.uTear),
    uRimColor: follow(U.uRimColor),
    uRim: follow(U.uRim, "float"),
    uInner: follow(U.uInner, "float"),
    uRing: follow(U.uRing, "float"),
    uGhost: follow(U.uGhost),
  };

  // Shared by every Nazgûl's cloth: wind and flutter in the vertex shader;
  // the tears, the faint cold rim, the shade (folds, the hood's dark) in the
  // fragment; and the Ring's pale form.
  const cloth = new MeshStandardNodeMaterial({
    map: weave,
    normalMap: weaveN,
    normalScale: new THREE.Vector2(1, 1),
    roughness: 0.93,
    metalness: 0,
    side: THREE.DoubleSide,
    alphaTest: 0.5,
  });
  cloth.name = "wraithCloth";
  // (the colour attribute: r how much the wind takes it, g its shade, b its
  // phase)
  const rig = attribute("color", "vec3");
  const vCloth = varying(uv(), "vCloth");
  const vShade = varying(rig.g, "vShade");
  onPosition(
    cloth,
    (p) => {
      const w = rig.r;
      const ph = rig.b.mul(6.2832);
      const wp = modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz;
      const t = n.uTime;
      const gust = sin(t.mul(0.41).add(wp.x.mul(0.09)).add(wp.z.mul(0.07)))
        .mul(0.35)
        .add(0.65);
      const wind = transpose(mat3(modelWorldMatrix)).mul(n.uWind);
      const across = vec3(wind.z.negate(), 0, wind.x);
      const a = sin(
        t
          .mul(1.3)
          .add(ph)
          .add(wp.x.mul(0.6))
          .add(wp.z.mul(0.45))
          .add(positionGeometry.y.mul(1.9)),
      );
      const b = sin(
        t
          .mul(2.1)
          .add(ph.mul(1.7))
          .add(positionGeometry.y.mul(3.3))
          .add(wp.z.mul(0.3)),
      );
      const blown = p.add(
        wind
          .mul(a.mul(0.45).add(0.55))
          .mul(gust)
          .add(across.mul(b).mul(0.5))
          .mul(w),
      );
      const st = uv();
      const hem = smoothstep(0, 0.5, st.y).oneMinus();
      const f = sin(t.mul(6.1).add(st.x.mul(21)).add(ph.mul(3))).add(
        sin(t.mul(9.3).sub(st.x.mul(37)).add(ph)).mul(0.6),
      );
      return blown.add(normalGeometry.mul(f.mul(hem).mul(w).mul(0.022)));
    },
    "wraith-cloth-1",
    n,
  );
  // torn: the mask decides (sampled everywhere, chosen after)
  const tear = texture(
    U.uTorn.value,
    vec2(vCloth.x.mul(n.uTear.y), vCloth.y.div(n.uTear.x)),
  ).r;
  cloth.opacityNode = select(vCloth.y.lessThan(n.uTear.x), tear, 1);
  wrap(
    cloth,
    "setupDiffuseColor",
    (out, builder) => {
      // the ragged ends are worn thin and greyer
      diffuseColor.assign(
        vec4(
          diffuseColor.rgb.mul(
            smoothstep(0, n.uTear.x, vCloth.y).oneMinus().mul(0.4).add(1),
          ),
          diffuseColor.a,
        ),
      );
      // through the Ring, see-through but for the edges
      if (!builder.isOpaque()) {
        const fres = edge(normalViewGeometry);
        diffuseColor.a.assign(
          mix(1, fres.mul(fres).mul(0.6).add(0.3), n.uRing),
        );
      }
      return out;
    },
    "wraith-cloth-1:alpha",
  );
  // black wool takes little gloss
  wrap(
    cloth,
    "setupLightingModel",
    (model) => {
      if (!model) return model;
      const finish = model.finish.bind(model);
      model.finish = (builder) => {
        const L = builder.lightsNode;
        builder.context.outgoingLight.assign(
          L.totalDiffuseNode.add(L.totalSpecularNode.mul(0.3)),
        );
        finish(builder);
      };
      return model;
    },
    "wraith-cloth-1:gloss",
  );
  // a cold rim, stronger where the cloth faces the sky
  {
    const gn = normalViewGeometry;
    const fr = edge(gn);
    const upV = normalize(cameraViewMatrix.mul(vec4(0, 1, 0, 0)).xyz);
    const sky = saturate(dot(gn, upV).mul(0.5).add(0.5)).mul(0.7).add(0.3);
    const fr2 = fr.mul(fr);
    cloth.emissiveNode = materialEmissive.add(
      n.uRimColor.mul(fr2.mul(fr2).mul(n.uRim).mul(sky)),
    );
  }
  // folds and the hood's dark; the inside of the cloth darker; the Ring's pale glow
  onLight(
    cloth,
    (light) => {
      const shadeK = mix(vShade, vShade.mul(0.7).add(0.3), n.uRing);
      const lit = light.mul(
        shadeK.mul(select(frontFacing, 1, mix(n.uInner, 0.8, n.uRing))),
      );
      const fr = edge(normalView);
      const ghost = n.uGhost.mul(
        shadeK.mul(0.22).add(0.07).add(fr.mul(fr).mul(fr).mul(0.8)),
      );
      return mix(lit, ghost.add(lit.mul(1.5)), n.uRing);
    },
    "wraith-cloth-1:ring",
  );
  cloth.uniforms = n;

  // steel: dark, a little sheen, the night in it; through the Ring, pale silver
  const silver = (m, key) =>
    onLight(
      m,
      (light) => {
        const fr = edge(normalView);
        const pale = n.uGhost
          .mul(fr.mul(fr).mul(0.7).add(0.18))
          .add(light.mul(1.4));
        return mix(light, pale, n.uRing.mul(0.85));
      },
      key,
      n,
    );
  const steel = silver(
    new MeshStandardNodeMaterial({
      color: 0x3a3d44,
      metalness: 0.88,
      roughness: 0.33,
      envMap: env,
      envMapIntensity: 1.1,
    }),
    "wraith-steel-1",
  );
  const blade = silver(
    new MeshStandardNodeMaterial({
      color: 0xb8bec8,
      metalness: 1,
      roughness: 0.2,
      envMap: env,
      envMapIntensity: 1.3,
    }),
    "wraith-blade-1",
  );
  // the dark inside the hood, and what the Ring shows there
  const voidMat = new MeshBasicNodeMaterial({ color: 0x000000 });
  const face = new MeshStandardNodeMaterial({
    vertexColors: true,
    color: 0xc8ccd4,
    roughness: 0.8,
    emissive: new THREE.Color(0.42, 0.45, 0.5),
    transparent: true,
    opacity: 0,
    visible: false,
  });
  // its own pale light, dark in the sockets and hollows
  face.emissiveNode = materialEmissive.mul(attribute("color", "vec3"));
  // (One original bug kept, so the two draw alike: the GLSL's
  // `totalEmissiveRadiance *= vColor` no longer compiles, three's vColor
  // being a vec4 now, so the classic face is never drawn. Its fix,
  // `vColor.rgb`, and this line's going belong in one change.)
  face.maskNode = bool(false);
  const crown = new MeshStandardNodeMaterial({
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
