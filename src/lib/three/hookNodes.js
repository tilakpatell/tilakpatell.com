// What a shader hook is on the node renderer. The GLSL hooks in lib/three
// (grounding's floorShadow, foliage's wind, ink's rimToon…) chain
// onBeforeCompile on a material and swap three's chunks by name; a node
// material has no chunks, but it builds its shader by calling its own
// setup methods (NodeMaterial.setup: setupPosition, setupDiffuseColor,
// setupNormal, setupLightingModel, setupLighting), so a twin hook wraps the
// one method the chunk it swapped stood for, on the instance, and chains
// whatever was there before, as onBeforeCompile did:
//
//   GLSL chunk swapped                       node twin's method
//   begin_vertex (transformed)               onPosition (the vertex before morphs, skinning and instancing)
//   color_fragment (diffuseColor)            onColor
//   normal_fragment_begin / _maps (normal)   onNormal (view space)
//   lights_fragment_begin (directLight)      onDirect (each light's colour and what it adds)
//   aomap_fragment (indirect light)          onIndirect
//   opaque_fragment (outgoingLight)          onLight (the light out, emissive in)
//   fog_fragment (fogColor)                  onFog
//
// Each wrap also adds a tag and its uniform nodes' ids to the material's
// customProgramCacheKey, as the GLSL hooks did with their tags: the node
// renderer shares one program between materials whose keys agree, and two
// hooked materials with uniforms of their own must not share one.
//
//   twinScene(root, twins) → every classic material under root swapped for its twin
//   asNode(material) → the node material for a classic one (three's own
//     NodeLibrary.fromMaterial: every property copied; the same one every
//     time it's asked), or itself
//   follow(holder) → a uniform node that is `holder` ({ value } read every
//     render) or the node itself, so a caller's shared { value } still drives it
//   wrap(material, method, fn, tag, nodes) → material; keyed(material, tag, nodes) the key alone
//   onPosition, onColor, onNormal, onDirect, onIndirect, onLight, onFog, viewRay
//   instanceMatrixOf(builder) → the instance's matrix node, or null (GLSL's instanceMatrix)

import * as THREE from 'three';
import {
  LineBasicNodeMaterial,
  LineDashedNodeMaterial,
  MeshBasicNodeMaterial,
  MeshLambertNodeMaterial,
  MeshMatcapNodeMaterial,
  MeshNormalNodeMaterial,
  MeshPhongNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  MeshToonNodeMaterial,
  PointsNodeMaterial,
  SpriteNodeMaterial,
} from 'three/webgpu';
import { OnBeforeFrameUpdate, buffer, cameraPosition, densityFogFactor, diffuseColor, instanceIndex, instancedBufferAttribute, instancedDynamicBufferAttribute, mat4, mix, positionLocal, positionWorld, rangeFogFactor, reference, renderGroup, uniform, vec4 } from 'three/tsl';

const NODE_OF = {
  LineBasicMaterial: LineBasicNodeMaterial,
  LineDashedMaterial: LineDashedNodeMaterial,
  MeshBasicMaterial: MeshBasicNodeMaterial,
  MeshLambertMaterial: MeshLambertNodeMaterial,
  MeshMatcapMaterial: MeshMatcapNodeMaterial,
  MeshNormalMaterial: MeshNormalNodeMaterial,
  MeshPhongMaterial: MeshPhongNodeMaterial,
  MeshPhysicalMaterial: MeshPhysicalNodeMaterial,
  MeshStandardMaterial: MeshStandardNodeMaterial,
  MeshToonMaterial: MeshToonNodeMaterial,
  PointsMaterial: PointsNodeMaterial,
  SpriteMaterial: SpriteNodeMaterial,
};

// (what three's renderer does to a classic material it meets, done early,
// so a hook has a node material to wrap)
// (one twin a classic material, ever: a hook put on a classic material
// lands on its twin, and the swap that comes after, a house's adopt or
// twinScene, puts that same twin on the object, so the hook is drawn)
const TWINS = new WeakMap();

export function asNode(material) {
  if (!material || material.isNodeMaterial) return material;
  const known = TWINS.get(material);
  if (known) return known;
  const Kind = NODE_OF[material.type];
  if (!Kind) return material;
  const out = new Kind();
  // (a GLSL hook's own program key is left behind: the node material keys
  // its program by its nodes; a GLSL patch copied over does nothing here)
  for (const key in material) if (key !== 'customProgramCacheKey') out[key] = material[key];
  TWINS.set(material, out);
  return out;
}

// Every classic material under `root` swapped on its object for its node
// twin (one twin a material, so a shared one stays shared: `twins` keeps
// them across calls), so hooks put on after change what is drawn.
export function twinScene(root, twins = new Map()) {
  const twin = (m) => {
    if (!m || m.isNodeMaterial) return m;
    if (!twins.has(m)) twins.set(m, asNode(m));
    return twins.get(m);
  };
  root?.traverse?.((o) => {
    if (!o.material) return;
    o.material = Array.isArray(o.material) ? o.material.map(twin) : twin(o.material);
  });
  return twins;
}

// A uniform node for what a GLSL hook took as a { value }: a node is kept,
// a { value } holder is read every render (the caller goes on writing the
// one it shares), anything else is a uniform of that value.
export function follow(holder, type) {
  if (holder?.isNode) return holder;
  if (holder && typeof holder === 'object' && 'value' in holder && !holder.isColor && !holder.isVector2 && !holder.isVector3 && !holder.isVector4) {
    const node = type ? uniform(holder.value, type) : uniform(holder.value);
    return node.onRenderUpdate(() => holder.value);
  }
  return type ? uniform(holder, type) : uniform(holder);
}

const idsOf = (nodes) =>
  Object.values(nodes ?? {})
    .filter((n) => n?.isNode)
    .map((n) => n.id)
    .join(',');

// The method on this one material, chained after what was there (the
// class's own, or another hook's), and a key for its program.
export function wrap(material, method, fn, tag, nodes = null) {
  const before = material[method];
  material[method] = function (builder, ...rest) {
    return fn.call(this, before.call(this, builder, ...rest), builder, ...rest);
  };
  return keyed(material, tag, nodes);
}

export function keyed(material, tag, nodes = null) {
  const key = material.customProgramCacheKey;
  const ids = idsOf(nodes);
  // (a tag may be a function, for a hook whose program changes after it's
  // put on: the house look once the ground map comes)
  material.customProgramCacheKey = function () {
    return `${key.call(this)}|${typeof tag === 'function' ? tag() : tag}${ids ? `:${ids}` : ''}`;
  };
  material.needsUpdate = true;
  return material;
}

// The vertex in the mesh's own space, as begin_vertex's `transformed` was:
// fn(positionLocal, builder) → the new position, before three morphs,
// skins and instances it (NodeMaterial.setupPosition, which runs next and
// reads positionLocal), so a hook that moved `transformed` moves it here.
export function onPosition(material, fn, tag, nodes) {
  const before = material.setupPosition;
  material.setupPosition = function (builder) {
    positionLocal.assign(fn(positionLocal, builder));
    return before.call(this, builder);
  };
  return keyed(material, tag, nodes);
}

// diffuseColor after the material's own colour, map and vertex colours
// (color_fragment): fn(diffuseColor, builder) → the new rgb (a vec3; its
// alpha is kept), or nothing for a hook that only reads.
export function onColor(material, fn, tag, nodes) {
  return wrap(
    material,
    'setupDiffuseColor',
    (out, builder) => {
      const rgb = fn(diffuseColor, builder);
      if (rgb) diffuseColor.assign(vec4(rgb, diffuseColor.a));
      return out;
    },
    tag,
    nodes,
  );
}

// The shading normal in view space, after the material's normal map
// (normal_fragment_maps): fn(normal) → the new normal.
export function onNormal(material, fn, tag, nodes) {
  return wrap(material, 'setupNormal', (n, builder) => fn(n, builder), tag, nodes);
}

// Each direct light, as three's lighting model takes it: fn(input, call)
// where input is { lightDirection, lightColor, lightNode, reflectedLight }
// and call(input) runs the model's own direct term with it, so a hook can
// scale the light's colour (the floor's baked shadow) or add a term after
// (light that wraps).
export function onDirect(material, fn, tag, nodes) {
  return wrap(
    material,
    'setupLightingModel',
    (model) => {
      if (!model) return model;
      const direct = model.direct.bind(model);
      model.direct = (input, builder) => fn(input, (next) => direct(next ?? input, builder), builder);
      return model;
    },
    tag,
    nodes,
  );
}

// The indirect light once the model has it (ambient, the environment, the
// material's occlusion): fn(reflectedLight, builder) to change it in place.
export function onIndirect(material, fn, tag, nodes) {
  return wrap(
    material,
    'setupLightingModel',
    (model) => {
      if (!model) return model;
      const indirect = model.indirect.bind(model);
      model.indirect = (builder) => {
        indirect(builder);
        fn(builder.context.reflectedLight, builder);
      };
      return model;
    },
    tag,
    nodes,
  );
}

// The light leaving the surface, emissive in, before fog and the output
// (opaque_fragment's outgoingLight): fn(light) → the new vec3.
export function onLight(material, fn, tag, nodes) {
  return wrap(material, 'setupLighting', (light, builder) => fn(light, builder), tag, nodes);
}

// The scene's fog, its colour changed: fn(fogColor, builder) → the colour
// the fog mixes toward (fog_fragment's MIX line, swapped). Three's factor
// for the scene's Fog or FogExp2 is kept, as the GLSL's fogFactor was. The
// first fog hook on a material is the one that holds, as the first GLSL
// hook to swap the line was (the line was gone for the next); a scene with
// a fogNode of its own, or none, is left to three.
export function onFog(material, fn, tag, nodes) {
  if (material.userData.__fog) return material;
  Object.defineProperty(material.userData, '__fog', { value: true, enumerable: false, configurable: true });
  return wrap(
    material,
    'setupFog',
    (out, builder, outputNode) => {
      const f = builder.scene?.fog;
      if (!f || builder.scene.fogNode || !builder.fogNode || !(f.isFog || f.isFogExp2)) return out;
      const color = reference('color', 'color', f).setGroup(renderGroup);
      const factor = f.isFogExp2 ? densityFogFactor(reference('density', 'float', f).setGroup(renderGroup)) : rangeFogFactor(reference('near', 'float', f).setGroup(renderGroup), reference('far', 'float', f).setGroup(renderGroup));
      return vec4(mix(outputNode.rgb, fn(color, builder), factor), outputNode.a);
    },
    tag,
    nodes,
  );
}

// the direction from the camera to the point, in the world's axes (what
// transpose(mat3(viewMatrix)) * mvPosition.xyz made in GLSL), normalised
export const viewRay = () => positionWorld.sub(cameraPosition).normalize();

// whether a light node is the scene's directional light (the GLSL hooks
// changed only those: getDirectionalLightInfo)
export const isSun = (lightNode) => Boolean(lightNode?.light?.isDirectionalLight);

export const colourOf = (c, fallback) => (c?.isColor ? c : new THREE.Color(c ?? fallback));

// The instance's matrix in the vertex stage, for a hook that read GLSL's
// instanceMatrix (the wind's phase from where a tree stands): the same node
// three's own instancing builds (nodes/accessors/Instance.js, which keeps
// its own private), a uniform buffer while the matrices fit in one, else an
// interleaved attribute of its own kept in step with them. Null when the
// object isn't instanced.
const interleaved = new WeakMap();
export function instanceMatrixOf(builder) {
  const object = builder?.object;
  if (!object?.isInstancedMesh || !object.instanceMatrix?.isInstancedBufferAttribute) return null;
  const matrices = object.instanceMatrix;
  const count = Math.max(matrices.count, 1);
  if (count * 64 <= builder.getUniformBufferLimit()) return buffer(matrices.array, 'mat4', count).element(instanceIndex);
  let ib = interleaved.get(matrices);
  if (!ib) {
    ib = new THREE.InstancedInterleavedBuffer(matrices.array, 16, 1);
    interleaved.set(matrices, ib);
  }
  // (in the build's stack: every program reading it keeps it in step)
  OnBeforeFrameUpdate(() => {
    if (ib.version !== matrices.version) ib.version = matrices.version;
  });
  const at = matrices.usage === THREE.DynamicDrawUsage ? instancedDynamicBufferAttribute : instancedBufferAttribute;
  return mat4(at(ib, 'vec4', 16, 0), at(ib, 'vec4', 16, 4), at(ib, 'vec4', 16, 8), at(ib, 'vec4', 16, 12));
}
