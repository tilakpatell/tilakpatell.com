// The Nazgûl on the Road: a hooded cloak with nothing in its face, on foot
// or on a black horse, its hood turned by nazgul.rules.js’s search; under
// the Ring vision the pale king it was shows through the cloak, crowned
// (kingsPose). Built in code: a lathe for the cloak, another for the hood,
// a black disc for the face; the king a thinner lathe and a ring of points,
// unlit, so the vision’s drain leaves him white. One kit a stage, its
// geometries and materials shared by every rider in it (nine at the Ford).
//
//   createNazgulKit(rt, road) → { rider({ mounted, seed }) → Rider, dispose }
//   Rider: { group, head, set({ speed, yaw, pitch, king }), tick(dt), dispose }
//     speed: the horse’s, m/s (its gait from horse.rules.js); yaw, pitch: the
//     hood’s; king: kingsPose’s pose (or 0 for none)

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { createHorse } from './horse';

const CLOTH = 0x0d0d11;
const KING = new THREE.Color(1.5, 1.55, 1.7); // over 1: the bloom takes it
const BACK = 1.25; // m: a 1.7 m horse’s back, where a rider sits

// a cloak’s outline turned round its axis: the hem wide, the shoulders, the neck
const robe = (h, hem) =>
  new THREE.LatheGeometry(
    [
      [hem, 0],
      [hem * 0.82, h * 0.25],
      [hem * 0.6, h * 0.62],
      [hem * 0.5, h * 0.86],
      [hem * 0.22, h * 0.96],
      [0.01, h],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    9,
  );
const hood = () =>
  new THREE.LatheGeometry(
    [
      [0.2, -0.05],
      [0.24, 0.12],
      [0.22, 0.3],
      [0.12, 0.42],
      [0.01, 0.46],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    8,
  );

export function createNazgulKit(rt, road) {
  const cloth = road.material({ color: CLOTH, flatShading: true });
  const voidMat = new MeshBasicNodeMaterial({ color: 0x000000 });
  const kingMat = new MeshBasicNodeMaterial({ color: KING, transparent: true, opacity: 0, depthWrite: false });
  const geo = {
    standing: robe(1.75, 0.55),
    seated: robe(0.95, 0.42),
    skirt: new THREE.ConeGeometry(0.85, 1.1, 9, 1, true),
    hood: hood(),
    face: new THREE.CircleGeometry(0.15, 10),
    kingBody: robe(1.7, 0.32),
    crown: new THREE.CylinderGeometry(0.19, 0.17, 0.12, 9, 1, true),
  };
  const riders = new Set();

  function rider({ mounted = true, seed = 0 } = {}) {
    const group = new THREE.Group();
    group.name = mounted ? 'road:nazgul:mounted' : 'road:nazgul';
    const horse = mounted ? createHorse(rt, { coat: 'black', height: 1.7, seed }) : null;
    if (horse) group.add(horse.group);
    const body = new THREE.Group();
    body.position.y = mounted ? BACK : 0;
    group.add(body);
    const cloak = new THREE.Mesh(mounted ? geo.seated : geo.standing, cloth);
    cloak.castShadow = true;
    body.add(cloak);
    if (mounted) {
      // (the cloak’s skirt over the horse’s flanks)
      const skirt = new THREE.Mesh(geo.skirt, cloth);
      skirt.position.y = -0.1;
      skirt.scale.set(0.8, 0.5, 1.25);
      body.add(skirt);
    }
    const top = mounted ? 0.95 : 1.75;
    const head = new THREE.Group();
    head.position.y = top - 0.12;
    const hoodMesh = new THREE.Mesh(geo.hood, cloth);
    head.add(hoodMesh);
    const face = new THREE.Mesh(geo.face, voidMat);
    face.position.set(0, 0.16, 0.2);
    head.add(face);
    body.add(head);
    // the king, inside the cloak, shown only by the vision
    const king = new THREE.Group();
    king.visible = false;
    const kb = new THREE.Mesh(geo.kingBody, kingMat);
    kb.scale.setScalar(mounted ? 0.62 : 1.05);
    king.add(kb);
    const crown = new THREE.Mesh(geo.crown, kingMat);
    crown.position.y = (mounted ? 1.05 : 1.85) + 0.08;
    king.add(crown);
    body.add(king);

    let sway = seed * 1.7;
    const r = {
      group,
      head,
      set({ speed, yaw, pitch, king: pose } = {}) {
        if (speed != null) horse?.set({ speed });
        if (yaw != null) head.rotation.y = yaw;
        if (pitch != null) head.rotation.x = pitch;
        if (pose !== undefined) {
          const k = pose ? pose.king : 0;
          king.visible = k > 0.01;
          kingMat.opacity = k;
          crown.visible = Boolean(pose && pose.crown > 0.01);
          cloak.visible = !pose || pose.cloak > 0.05;
        }
      },
      tick(dt) {
        horse?.tick(dt);
        // (the cloth moves a little even when the rider does not)
        sway += dt;
        cloak.rotation.z = Math.sin(sway * 1.3) * 0.025;
        cloak.rotation.x = Math.sin(sway * 0.9) * 0.02;
      },
      dispose() {
        horse?.dispose();
        group.removeFromParent();
        riders.delete(r);
      },
    };
    riders.add(r);
    return r;
  }

  return {
    rider,
    dispose() {
      for (const r of [...riders]) r.dispose();
      for (const g of Object.values(geo)) g.dispose();
      cloth.dispose();
      voidMat.dispose();
      kingMat.dispose();
    },
  };
}
