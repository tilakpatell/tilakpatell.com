// The GPU scene's hooks into three (GPU-first lane N1), in one file so an
// upgrade touches one place: the indirect draw (IndirectStorageBufferAttribute
// and BufferGeometry.setIndirect, read by the WebGPU backend through
// renderObject.getIndirect() and getIndirectOffset()), a storage buffer read
// as a vertex attribute (StorageBufferNode.toAttribute(), as
// particles/sprites.js reads its pools) and the render bundle (BundleGroup).
// Each is inside three's face in r186 and may move on an upgrade
// (docs/stack/three.md, "Upgrading"). Everything reaches three/webgpu and
// three/tsl through light/three.js's loadThree(), so a world that never
// draws this way never downloads them.
//
//   loadGpuThree() → Promise<{ THREE, tsl, IndirectStorageBufferAttribute, BundleGroup, StorageBufferAttribute, StorageInstancedBufferAttribute }>
//   storageAttribute(node) → the node read per instance (node.toAttribute())
//   setIndirect(geometry, attribute, offsets) → geometry (one drawIndexedIndirect an offset, in bytes)
//   indirectOf(renderObject) → { attribute, offsets } | null (what the backend will draw from)
//   hasIndirect(renderer) → boolean: the backend draws indirect with firstInstance (WebGPU; never the node renderer over WebGL 2)
//   upload(attribute, span, itemsPer) (one dirty span of a storage attribute sent, not the whole buffer)
//   widen(span | null, start, count = 1) → the span over both (the elements set since the last upload)

import { backendOf, loadThree } from '../light/three.js';

export async function loadGpuThree() {
  const { THREE, tsl } = await loadThree();
  return {
    THREE,
    tsl,
    IndirectStorageBufferAttribute: THREE.IndirectStorageBufferAttribute,
    BundleGroup: THREE.BundleGroup,
    StorageBufferAttribute: THREE.StorageBufferAttribute,
    StorageInstancedBufferAttribute: THREE.StorageInstancedBufferAttribute,
  };
}

export const storageAttribute = (node) => node.toAttribute();

export function setIndirect(geometry, attribute, offsets) {
  geometry.setIndirect(attribute, offsets.length === 1 ? offsets[0] : offsets);
  return geometry;
}

export function indirectOf(renderObject) {
  const attribute = renderObject.getIndirect?.() ?? null;
  if (!attribute) return null;
  const o = renderObject.getIndirectOffset?.() ?? 0;
  return { attribute, offsets: Array.isArray(o) ? o : [o] };
}

// (the WebGL 2 backend has no storage buffers and no indirect draws: the
// node renderer there warns and draws nothing, so the path is never taken;
// and a sub-draw's base rides in firstInstance, which WebGPU honours only
// with indirect-first-instance, an optional feature three asks for wherever
// the adapter has it: 99.99 % of web3dsurvey's reports, the research note's §1;
// and not on a compatibility-mode device (Chrome 146's, on OpenGL ES 3.1:
// three asks for compatibility first and sets compatibilityMode where the
// device lacks core-features-and-limits), which has no storage buffers in the
// vertex stage, where each instance's row is pulled: the research note's
// §2f item 9, the every-world hand-off's performance item 10)
export const hasIndirect = (renderer) => backendOf(renderer) === 'webgpu' && renderer.backend?.compatibilityMode !== true && renderer.backend?.hasFeature?.('indirect-first-instance') !== false;

// one span over every element touched since the last send (upload keeps one
// range a call: elements set one by one in a frame are widened into one)
export const widen = (span, start, count = 1) => (span ? { start: Math.min(span.start, start), count: Math.max(span.start + span.count, start + count) - Math.min(span.start, start) } : { start, count });

export function upload(attribute, span, itemsPer = 1) {
  if (!span) return;
  attribute.clearUpdateRanges?.();
  attribute.addUpdateRange?.(span.start * itemsPer * attribute.itemSize, span.count * itemsPer * attribute.itemSize);
  attribute.needsUpdate = true;
}
