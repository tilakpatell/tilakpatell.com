// The things that go round the fandoms' planets on the universe map, made
// in code (planets.js parks them on their orbits): each built to look like
// the thing it is up close, not a primitive standing in for it.
//
//   gemGeometry()            an oval brilliant: table, crown, girdle, pavilion
//   glowingGems(colours)     an InstancedMesh of them, each lit in its own colour
//   shardCluster(seed)       a cluster of glassy shards, Blue Sky's crystal
//   elementTile(el, size)    a periodic-table tile as Breaking Bad's titles set it
//   bossMug(size)            Michael's WORLD'S BEST BOSS mug, coffee in it

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paint, rng } from './kit';

// An oval brilliant, a unit across its girdle the long way: a flat table on
// top, the crown's facets down to the girdle, the pavilion's to the culet.
// Ten facets round; flat shading shows them.
function gemGeometry() {
  const pts = [
    [0, -0.82],
    [0.5, -0.36],
    [1, 0],
    [1, 0.07],
    [0.82, 0.24],
    [0.56, 0.38],
    [0, 0.38],
  ].map(([r, y]) => new THREE.Vector2(r * 0.5, y * 0.5));
  const geo = new THREE.LatheGeometry(pts, 10);
  geo.scale(1, 1, 0.74); // an oval, seen from above
  geo.computeVertexNormals();
  return geo;
}

// Gems lit from within, each in its own colour (the instance colour tints
// the glow as well as the stone), so they read as the Stones do: lit, not
// painted.
export function glowingGems(colours, size) {
  const geo = gemGeometry().scale(size, size, size);
  const mat = new THREE.MeshStandardMaterial({ color: '#8c8c8c', metalness: 0.4, roughness: 0.1, flatShading: true, emissive: '#ffffff', emissiveIntensity: 0.7 });
  mat.onBeforeCompile = (shader) => {
    // (the fragment shader knows an instance's colour as USE_COLOR's vColor)
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n  totalEmissiveRadiance *= vColor.rgb;\n#endif');
  };
  mat.customProgramCacheKey = () => 'glowing-gems';
  const gems = new THREE.InstancedMesh(geo, mat, colours.length);
  const c = new THREE.Color();
  colours.forEach((hex, i) => gems.setColorAt(i, c.set(hex)));
  return gems;
}

// Blue Sky: a cluster of glassy shards, long and pointed and a little
// tapered, leaning out every way from a common root (a unit tall).
export function shardCluster(seed) {
  const rand = rng(seed);
  const parts = [];
  const n = 6 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const h = 0.45 + rand() * 0.55;
    const w = 0.07 + rand() * 0.07;
    const g = new THREE.CylinderGeometry(w * 0.15, w, h, 6, 1);
    g.translate(0, h / 2, 0);
    // a point on top: the shard's tip, a little off its axis
    const tip = new THREE.ConeGeometry(w * 0.15, h * 0.12, 6, 1);
    tip.translate(w * 0.05, h + h * 0.06, 0);
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler((rand() - 0.5) * 1.5, rand() * Math.PI * 2, (rand() - 0.5) * 1.5));
    parts.push(g.applyMatrix4(m), tip.applyMatrix4(m));
  }
  const geo = mergeGeometries(parts.map((g) => g.toNonIndexed()));
  for (const g of parts) g.dispose();
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

// A tile as the opening titles set one: dark green, lit a little lighter to
// one corner, its edge picked out, the atomic number top left, the
// oxidation states down the right, the symbol, and the atomic weight under
// it. A thin slab, a unit across.
export function elementTile({ sym, n, mass, states }) {
  const face = paint(
    (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#3f9a58');
      grad.addColorStop(0.55, '#24693a');
      grad.addColorStop(1, '#154a28');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(190, 240, 170, 0.75)';
      g.lineWidth = w * 0.025;
      g.strokeRect(w * 0.04, h * 0.04, w * 0.92, h * 0.92);
      g.fillStyle = '#ffffff';
      g.textBaseline = 'top';
      g.font = `600 ${w * 0.12}px ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif`;
      g.fillText(String(n), w * 0.1, h * 0.09);
      g.textAlign = 'right';
      g.font = `500 ${w * 0.075}px ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif`;
      states.forEach((s, i) => g.fillText(s, w * 0.9, h * (0.1 + i * 0.085)));
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `700 ${w * 0.42}px ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif`;
      g.fillText(sym, w * 0.48, h * 0.53);
      g.font = `500 ${w * 0.085}px ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif`;
      g.fillText(mass, w * 0.5, h * 0.84);
    },
    256,
    256,
  );
  const edge = new THREE.MeshStandardMaterial({ color: '#1c5530', roughness: 0.4, metalness: 0.1 });
  const front = new THREE.MeshStandardMaterial({ map: face, roughness: 0.32, metalness: 0.05, emissive: '#ffffff', emissiveMap: face, emissiveIntensity: 0.18 });
  // (a box's faces: +x, −x, +y, −y, +z, −z; the print on the front and back)
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1), [edge, edge, edge, edge, front, front]);
}

// The mug: a diner mug turned on a lathe (a foot, a wall with a little belly,
// a rolled rim, the inside and its bottom), coffee in it, a handle bent
// round on the side, and the words both sides of it as the prop has them.
// A unit tall.
export function bossMug() {
  // (radius, height) up the outside, over the rim, down the inside; the
  // outside wall gets many points, so the words have most of the texture
  const WALL = Array.from({ length: 11 }, (_, k) => {
    const t = k / 10;
    return [0.405 + 0.035 * Math.sin(t * Math.PI * 0.5) - 0.006 * Math.sin(t * Math.PI), 0.06 + 0.88 * t];
  });
  const PROFILE = [[0, 0], [0.36, 0], [0.39, 0.02], ...WALL, [0.44, 0.98], [0.425, 1], [0.405, 0.985], [0.4, 0.94], [0.385, 0.14], [0.3, 0.1], [0, 0.1]];
  const n = PROFILE.length - 1;
  const v0 = 3 / n; // the wall's run of v (its first point is the fourth)
  const v1 = 13 / n;
  const label = paint(
    (g, w, h) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      // the texture is flipped: v = 1 is the top row. Round the mug is
      // 2π × 0.43 units in w pixels; up the wall, 0.88 units in this many:
      const top = (1 - v1) * h;
      const tall = (v1 - v0) * h;
      const squash = tall / 0.88 / (w / (2 * Math.PI * 0.43)); // so the letters keep their shape on the mug
      g.fillStyle = '#121212';
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      // both sides, away from the handle (u 0 faces +z; the handle is at +x, u 0.25)
      for (const cx of [0, 0.5, 1]) {
        g.save();
        g.translate(cx * w, top);
        g.scale(1, squash);
        const H = tall / squash; // the wall's height in unsquashed pixels
        g.font = `900 ${H * 0.085}px "Arial Black", Arial, ui-sans-serif, sans-serif`;
        g.fillText("WORLD'S BEST", 0, H * 0.4);
        g.font = `900 ${H * 0.2}px "Arial Black", Arial, ui-sans-serif, sans-serif`;
        g.fillText('BOSS', 0, H * 0.62);
        g.restore();
      }
    },
    1024,
    512,
  );
  const mug = new THREE.Group();
  const china = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.18, metalness: 0 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 48), new THREE.MeshStandardMaterial({ map: label, roughness: 0.18, metalness: 0, side: THREE.DoubleSide }));
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.392, 40), new THREE.MeshStandardMaterial({ color: '#3b2112', roughness: 0.08, metalness: 0 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.84;
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.42, 0.82, 0),
    new THREE.Vector3(0.62, 0.84, 0),
    new THREE.Vector3(0.74, 0.62, 0),
    new THREE.Vector3(0.69, 0.32, 0),
    new THREE.Vector3(0.43, 0.22, 0),
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(path, 32, 0.05, 10, false), china);
  handle.scale.z = 0.75; // flatter than it is round, as a mug's handle is
  mug.add(body, coffee, handle);
  for (const c of mug.children) c.position.y -= 0.5; // turning about its middle
  return mug;
}
