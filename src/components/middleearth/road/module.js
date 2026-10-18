// The Road through Middle-earth, the world module: one continuous ride
// from Bag End to the Grey Havens on the world runtime, on the node
// renderer (docs/superpowers/specs/2026-10-18-the-road-design.md). One
// number, the progress `s` along the sixteen stages, drives everything;
// the rules are pure files beside this one, and this file only draws.
//
// Props: { at: a stage id or 'id:metres' | null, reduced }.

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';

export default {
  id: 'road',
  shading: 'nodes',
  mb: 8,
  label: 'The Road through Middle-earth',
  create(rt) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);
    camera.position.set(0, 1.7, -3.2);
    camera.lookAt(0, 1, 6);
    // (the placeholder ground until the stages build their own)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new MeshStandardNodeMaterial({ color: 0x8a8f86, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(-30, 60, 20);
    scene.add(ground, sun, new THREE.HemisphereLight(0xdfe8ff, 0x5a5040, 0.6));
    return {
      ready: rt.gfx.compile?.(scene, camera),
      resize(w, h) {
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
      },
      step() {},
      draw(frame) {
        (frame?.renderer ?? rt.gfx.renderer).render(scene, camera);
      },
      wants: () => true,
      anchor: () => camera.position.toArray(),
      lowerQuality() {},
      update() {},
      dispose() {
        ground.geometry.dispose();
        ground.material.dispose();
      },
    };
  },
};
