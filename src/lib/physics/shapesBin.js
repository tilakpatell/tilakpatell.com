// A level pack's shapes bin (physics/<mesh>.bin): one mesh's Havok shapes,
// in its own frame, written by the build (scripts/bf2017-physics.mjs) and
// read by the page (havok.js). 'BFPH', version 1, the count; then per shape
// u8 kind (hull, mesh, capsule, sphere), part, material, root, u32 points,
// u32 indices, and its numbers: a hull's points, a mesh's points and
// indices, a capsule's two ends and radius, a sphere's centre and radius.
// Every block a multiple of four bytes, so the reader's arrays are views
// into the one buffer. No three.js, no DOM.
//
// Version 2 ('BFPH', 2, shape count, f32 radius, part count; then per part a
// u8 name length, the UTF-8 name, a u8 property, padded to four) carries a
// kind's bounding radius and its parts, then version 1's shapes unchanged.
//
//   packShapes(shapes) → ArrayBuffer (version 1)
//   packHull({ radius, parts, shapes }) → ArrayBuffer (version 2)
//   readHull(buffer) → { version, radius, parts: [{ name, property }], shapes }
//   readShapes(buffer) → [{ kind, part, material, root, points?, indices?,
//     a?, b?, centre?, radius? }]

const KINDS = ['hull', 'mesh', 'capsule', 'sphere'];
const MAGIC = 0x48504642; // 'BFPH', little-endian

const byte = (v, what) => {
  if (!(Number.isInteger(v) && v >= 0 && v < 256)) throw new Error(`shapes bin: a shape's ${what} ${v} won't fit a byte`);
  return v;
};

const pad4 = (n) => (n + 3) & ~3;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// The shapes' block, shared by both versions; `head` is the bytes before it.
function pack(head, shapes, writeHead) {
  let size = head;
  for (const s of shapes) {
    size += 12;
    if (s.kind === 'hull') size += s.points.length * 4;
    else if (s.kind === 'mesh') size += s.points.length * 4 + s.indices.length * 4;
    else if (s.kind === 'capsule') size += 7 * 4;
    else if (s.kind === 'sphere') size += 4 * 4;
    else throw new Error(`shapes bin: no kind '${s.kind}'`);
  }
  const buf = new ArrayBuffer(size);
  const dv = new DataView(buf);
  let o = writeHead(dv);
  const floats = (list) => {
    for (const v of list) {
      dv.setFloat32(o, v, true);
      o += 4;
    }
  };
  for (const s of shapes) {
    dv.setUint8(o, KINDS.indexOf(s.kind));
    dv.setUint8(o + 1, byte(s.part ?? 0, 'part'));
    dv.setUint8(o + 2, byte(s.material ?? 0, 'material'));
    dv.setUint8(o + 3, byte(s.root ?? 0, 'root'));
    const n = s.kind === 'hull' || s.kind === 'mesh' ? s.points.length / 3 : 0;
    dv.setUint32(o + 4, n, true);
    dv.setUint32(o + 8, s.kind === 'mesh' ? s.indices.length : 0, true);
    o += 12;
    if (s.kind === 'hull') floats(s.points);
    else if (s.kind === 'mesh') {
      floats(s.points);
      for (const v of s.indices) {
        dv.setUint32(o, v, true);
        o += 4;
      }
    } else if (s.kind === 'capsule') floats([...s.a, ...s.b, s.radius]);
    else floats([...s.centre, s.radius]);
  }
  return buf;
}

export function packShapes(shapes) {
  return pack(12, shapes, (dv) => {
    dv.setUint32(0, MAGIC, true);
    dv.setUint32(4, 1, true);
    dv.setUint32(8, shapes.length, true);
    return 12;
  });
}

export function packHull({ radius, parts, shapes }) {
  const named = parts.map((p) => {
    const bytes = encoder.encode(p.name);
    if (bytes.length > 255) throw new Error(`shapes bin: part name '${p.name}' is ${bytes.length} bytes, over 255`);
    return { bytes, property: byte(p.property, 'property') };
  });
  const head = 20 + named.reduce((n, p) => n + pad4(p.bytes.length + 2), 0);
  return pack(head, shapes, (dv) => {
    dv.setUint32(0, MAGIC, true);
    dv.setUint32(4, 2, true);
    dv.setUint32(8, shapes.length, true);
    dv.setFloat32(12, radius, true);
    dv.setUint32(16, named.length, true);
    let o = 20;
    for (const p of named) {
      dv.setUint8(o, p.bytes.length);
      new Uint8Array(dv.buffer, o + 1, p.bytes.length).set(p.bytes);
      dv.setUint8(o + 1 + p.bytes.length, p.property);
      o += pad4(p.bytes.length + 2);
    }
    return o;
  });
}

// (views into the buffer where they line up, so a mesh's arrays are shared
// by everything that reads them)
export function readShapes(buffer) {
  return read(buffer).shapes;
}

export function readHull(buffer) {
  const { version, radius, parts, shapes } = read(buffer);
  return { version, radius, parts, shapes };
}

function read(buffer) {
  const buf = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const dv = new DataView(buf);
  if (buf.byteLength < 12 || dv.getUint32(0, true) !== MAGIC) throw new Error('shapes bin: not a shapes bin');
  const version = dv.getUint32(4, true);
  if (version !== 1 && version !== 2) throw new Error(`shapes bin: version ${version}`);
  const count = dv.getUint32(8, true);
  let radius = 0;
  const parts = [];
  let o = 12;
  if (version === 2) {
    radius = dv.getFloat32(12, true);
    const n = dv.getUint32(16, true);
    o = 20;
    for (let i = 0; i < n; i++) {
      const len = dv.getUint8(o);
      parts.push({ name: decoder.decode(new Uint8Array(buf, o + 1, len)), property: dv.getUint8(o + 1 + len) });
      o += pad4(len + 2);
    }
  }
  const shapes = [];
  for (let i = 0; i < count; i++) {
    const kind = KINDS[dv.getUint8(o)];
    const s = { kind, part: dv.getUint8(o + 1), material: dv.getUint8(o + 2), root: dv.getUint8(o + 3) };
    const n = dv.getUint32(o + 4, true);
    const m = dv.getUint32(o + 8, true);
    o += 12;
    if (kind === 'hull' || kind === 'mesh') {
      s.points = new Float32Array(buf, o, n * 3);
      o += n * 12;
      if (kind === 'mesh') {
        s.indices = new Uint32Array(buf, o, m);
        o += m * 4;
      }
    } else if (kind === 'capsule') {
      const f = new Float32Array(buf, o, 7);
      s.a = [f[0], f[1], f[2]];
      s.b = [f[3], f[4], f[5]];
      s.radius = f[6];
      o += 28;
    } else if (kind === 'sphere') {
      const f = new Float32Array(buf, o, 4);
      s.centre = [f[0], f[1], f[2]];
      s.radius = f[3];
      o += 16;
    } else throw new Error(`shapes bin: shape ${i} has an unknown kind`);
    shapes.push(s);
  }
  return { version, radius, parts, shapes };
}
