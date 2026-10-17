// An airliner going round the city at 1,400 m, as fast as Mark goes flat
// out: what people built to fly. Modelled in code (an original livery, a
// made-up airline): the fuselage with its row of windows, swept wings and
// tail, two engines, the lights blinking at the wingtips, and contrails.
// `near(p)` says how far a point is from it, for the moment Mark flies
// alongside.

import * as THREE from 'three';
import { PartBuilder, canvasTexture } from '../../avengers/hq/kit/shapes';
import { hot } from '../../avengers/hq/stage';

export const JET = { y: 1400, rx: 2600, rz: 2100, speed: 235 }; // (inside the world's edge, so he can catch it)

// the fuselage's paint: white, a blue belly under a gold line, a row of
// windows down each side, the name. (Round the cylinder is across the
// canvas, from the belly, up the left side, over the top and down the
// right; along it is down the canvas, nose at the top.)
function livery() {
  return canvasTexture(256, 1024, (x, w, h) => {
    x.fillStyle = '#f4f5f6';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#1d4f9a';
    x.fillRect(0, 0, w * 0.15, h);
    x.fillRect(w * 0.85, 0, w * 0.15, h);
    x.fillStyle = '#e8b22e';
    x.fillRect(w * 0.15, 0, w * 0.02, h);
    x.fillRect(w * 0.83, 0, w * 0.02, h);
    x.fillStyle = '#20262e';
    for (let i = 0; i < 44; i++) for (const u of [0.3, 0.7]) x.fillRect(w * u - 2, h * 0.1 + i * h * 0.018, 4, h * 0.009);
    x.fillStyle = '#1d4f9a';
    x.font = '700 30px system-ui, sans-serif';
    x.textAlign = 'center';
    for (const [u, rot] of [
      [0.37, Math.PI / 2],
      [0.63, -Math.PI / 2],
    ]) {
      x.save();
      x.translate(w * u, h * 0.42);
      x.rotate(rot);
      x.fillText('GRAYSTONE AIR', 0, 10);
      x.restore();
    }
  });
}

export function buildJet() {
  const b = new PartBuilder();
  const L = 38;
  // the fuselage along +z, nose forward
  const body = new THREE.CylinderGeometry(2, 2, L, 24, 1, true);
  b.add('body', body, { r: [Math.PI / 2, 0, 0] });
  b.add('white', new THREE.SphereGeometry(2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), { p: [0, 0, L / 2], r: [Math.PI / 2, 0, 0], s: [1, 1.9, 1] });
  b.add('white', new THREE.ConeGeometry(2, 8, 24, 1, true), { p: [0, 0.6, -L / 2 - 4], r: [-Math.PI / 2 - 0.08, 0, 0] });
  b.add('glass', new THREE.SphereGeometry(1.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), { p: [0, 0.9, L / 2 + 1.2], r: [0.9, 0, 0], s: [1, 0.6, 1] });
  // the wings, swept back, and the tailplane
  const wing = (span, root, tip, sweep, t) => {
    const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(span, -sweep), new THREE.Vector2(span, -sweep - tip), new THREE.Vector2(0, -root)]);
    return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }).rotateX(Math.PI / 2);
  };
  for (const sd of [-1, 1]) {
    b.add('white', wing(17, 7, 2.2, 7, 0.45), { p: [sd * 1.5, -0.9, 4], s: [sd, 1, 1] });
    b.add('white', wing(6.5, 3.6, 1.4, 3.2, 0.3), { p: [sd * 0.8, 0.6, -L / 2 - 1], s: [sd, 1, 1] });
    // the engines under the wings
    b.add('engine', new THREE.CylinderGeometry(1.15, 1.0, 4.4, 18, 1, true), { p: [sd * 6.5, -2.2, 3.2], r: [Math.PI / 2, 0, 0] });
    b.add('dark', new THREE.CircleGeometry(1.1, 18), { p: [sd * 6.5, -2.2, 5.4] });
    b.add('white', new THREE.BoxGeometry(0.3, 1.2, 2.4), { p: [sd * 6.5, -1.4, 2.6] });
  }
  // the fin, in the airline's colours
  const fin = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-6.5, 0), new THREE.Vector2(-9.5, 8.5), new THREE.Vector2(-6.2, 8.5)]);
  b.add('fin', new THREE.ExtrudeGeometry(fin, { depth: 0.35, bevelEnabled: false }).rotateY(-Math.PI / 2), { p: [0.17, 1.6, -L / 2 + 3] });
  const tex = livery();
  const mats = {
    body: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.2 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf1f2f3, roughness: 0.35, metalness: 0.2 }),
    fin: new THREE.MeshStandardMaterial({ color: 0x1d4f9a, roughness: 0.35, metalness: 0.2 }),
    engine: new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.3, metalness: 0.7, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0f161d, roughness: 0.1, metalness: 0.8 }),
  };
  const group = b.build(mats);
  // the lights: red to port, green to starboard, a white strobe in the tail
  const lights = [
    [new THREE.SphereGeometry(0.35, 8, 6), 0xff2a2a, [18.5, -0.9, -3]],
    [new THREE.SphereGeometry(0.35, 8, 6), 0x2aff6a, [-18.5, -0.9, -3]],
    [new THREE.SphereGeometry(0.3, 8, 6), 0xffffff, [0, 2, -L / 2 - 8]],
  ].map(([g, c, p]) => {
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: hot(c, 4), toneMapped: false }));
    m.position.set(...p);
    group.add(m);
    return m;
  });
  // the contrails: thin and starting a little way behind each engine,
  // widening and fading, soft at their edges
  const trailMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main() { vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main() { float edge = pow(abs(dot(vN, vV)), 1.4); float a = 0.32 * pow(vY, 2.2) * smoothstep(1.0, 0.94, vY) * edge; gl_FragColor = vec4(vec3(1.0), a); }',
  });
  for (const sd of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 4.5, 600, 12, 1, true).translate(0, -300, 0).rotateX(Math.PI / 2), trailMat);
    t.position.set(sd * 6.5, -2.2, -2);
    t.renderOrder = 4;
    group.add(t);
  }
  group.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  group.name = 'jet';

  const p = new THREE.Vector3();
  const v = new THREE.Vector3();
  let a = 0.3;
  return {
    group,
    position: p,
    velocity: v,
    update(dt, t) {
      // round its ellipse at its own speed, banked into the turn
      const r = Math.hypot(JET.rx * Math.sin(a), JET.rz * Math.cos(a));
      a += (JET.speed / r) * dt;
      p.set(Math.cos(a) * JET.rx, JET.y + Math.sin(a * 2) * 40, Math.sin(a) * JET.rz);
      v.set(-Math.sin(a) * JET.rx, Math.cos(a * 2) * 80, Math.cos(a) * JET.rz).normalize().multiplyScalar(JET.speed);
      group.position.copy(p);
      group.lookAt(p.clone().add(v));
      group.rotateZ(-0.32);
      const blink = Math.sin(t * 6) > 0.6;
      lights[0].visible = lights[1].visible = true;
      lights[2].visible = blink;
    },
    near: (q) => p.distanceTo(q),
  };
}
