// More of the fandoms' planets' skins (planets.js's BUILDERS), kept apart
// so planets.js stays under the size the health check allows, as its
// shading went to planetShading.js. Each takes the planet being built and
// its maps: (p, { u, T }), as planets.js's own do.

import * as THREE from 'three';

// The Harry Potter world (scripts/planets/potter.mjs): a cold northern
// planet of lochs and moor, the Highlands in glens running south-west to
// north-east, snow on the tops; the Black Lake with the castle lit on the
// crag at its head, Hogsmeade along its shore, the railway's lamps down to
// a city's glow; long rain fronts going over. The castle's windows are the
// glow, so they show on the dark side before the night's lights fade in.
export function potter(p, { u, T }) {
  const r = u.size;
  if (!T.potter) {
    // (without the maps: the palette's moor green under grey cloud, a cold sea)
    p.body.material = new THREE.MeshStandardMaterial({ color: u.palette.base, roughness: 0.85 });
    return;
  }
  const mat = new THREE.MeshStandardMaterial({
    map: T.potter,
    normalMap: T['potter-normal'] ?? null,
    normalScale: new THREE.Vector2(1.3, 1.3),
    // (the lochs and the sea glossy, the moor matte)
    roughnessMap: T['potter-rough'] ?? null,
    roughness: 1,
    metalness: 0,
    emissive: '#ffffff',
    emissiveMap: T['potter-glow'] ?? null,
    emissiveIntensity: T['potter-glow'] ? 2.2 : 0,
  });
  p.body.material = mat;
  p.night = T['potter-night'] ?? null;
  // the windows flicker, the way a castle full of candles does from far off
  if (T['potter-glow']) p.tick.push((t) => (mat.emissiveIntensity = 2 + 0.35 * Math.sin(t * 2.3) * Math.sin(t * 0.9 + 1)));
  if (T['potter-clouds']) {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.012, T.small ? 44 : 64, T.small ? 28 : 40),
      new THREE.MeshStandardMaterial({ color: '#e8ecf2', alphaMap: T['potter-clouds'], transparent: true, depthWrite: false, roughness: 1 }),
    );
    p.group.add(sky);
    // (the fronts come in from the west)
    p.tick.push((t) => (sky.rotation.y = t * 0.06));
  }
}
