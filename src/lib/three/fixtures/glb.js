// A committed GLB parsed in Node for the figures' tests: the file without
// its pictures (Node can't decode a WebP; placer.glass.test.js does the
// same), its meshopt buffers decoded, the rest as the browser gets it.
//
//   parseGlb(path) → Promise<gltf>   (path from the repository's root)
//   glbJson(path) → the file's JSON chunk
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const jsonOf = (b) => JSON.parse(new TextDecoder().decode(b.subarray(20, 20 + b.readUInt32LE(12))));
export const glbJson = (path) => jsonOf(readFileSync(path));

function bare(b) {
  const j = jsonOf(b);
  delete j.textures;
  delete j.images;
  delete j.samplers;
  const strip = (o) => {
    for (const k of Object.keys(o)) {
      if (/Texture$/.test(k)) delete o[k];
      else if (o[k] && typeof o[k] === 'object') strip(o[k]);
    }
  };
  for (const m of j.materials ?? []) strip(m);
  if (j.extensionsUsed) j.extensionsUsed = j.extensionsUsed.filter((e) => !/texture/i.test(e));
  if (j.extensionsRequired) j.extensionsRequired = j.extensionsRequired.filter((e) => !/texture/i.test(e));
  let text = JSON.stringify(j);
  while (text.length % 4) text += ' ';
  const head = 20 + b.readUInt32LE(12);
  const rest = b.subarray(head);
  const out = Buffer.alloc(20 + text.length + rest.length);
  out.write('glTF', 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(text.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16); // JSON
  out.write(text, 20);
  rest.copy(out, 20 + text.length);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

export async function parseGlb(path) {
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return new Promise((resolve, reject) => loader.parse(bare(readFileSync(path)), '', resolve, reject));
}
