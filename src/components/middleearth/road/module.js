// The Road through Middle-earth, the world module: one continuous ride
// from Bag End to the Grey Havens on the world runtime, on the node
// renderer (docs/superpowers/specs/2026-10-18-the-road-design.md). One
// number, the progress `s` along the sixteen stages, drives everything;
// the rules are pure files beside this one (line, clock, director,
// fellowship, daylight), and this file only draws.
//
// Props: { at: a stage id, or 'id:metres' | null, reduced }.
// In development, window.__ROAD__ = { set(s), info(), world } for the checks.

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { newClock, step as stepClock } from './clock';
import { pose } from './director';
import { light as lightAt } from './daylight';
import { at as lineAt, sOf, total } from './line';
import { createSky } from './sky';
import { STAGES, stageById } from './stages/index';

const TOTAL = total(STAGES);

// 'moria' or 'moria:120' → s; anything else, the start
export function sFromAddress(at) {
  if (!at) return 0;
  const [id, metres] = String(at).split(':');
  if (!stageById(id)) return 0;
  return sOf(STAGES, id, Number(metres) || 0);
}

export default {
  id: 'road',
  shading: 'nodes',
  mb: 8,
  label: 'The Road through Middle-earth',
  create(rt, props = {}) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);
    scene.fog = new THREE.FogExp2(0xc0c8d0, 0.004);
    // (the placeholder ground: a flat stage until the stages build their own)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 600), new MeshStandardNodeMaterial({ color: 0x7d8a6a, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x5a5040, 0.6);
    const sky = createSky();
    scene.add(ground, sun, sun.target, hemi, sky.mesh);

    let clock = newClock({ s: sFromAddress(props.at), reduced: Boolean(props.reduced) });
    const look = { yaw: 0, pitch: 0 };
    const sunDir = new THREE.Vector3();

    // the light for where the ride is: the sky, the sun, the fog
    const relight = () => {
      const l = lightAt(STAGES, clock.s);
      sky.set(l);
      const { az, el, colour } = l.sun;
      sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      sun.color.setRGB(...colour);
      sun.intensity = 2.4 * Math.max(0, Math.min(1, (el + 0.05) / 0.3)) * (1 - 0.6 * l.pall.amount);
      hemi.intensity = 0.25 + l.ambient * 1.6;
      hemi.color.setRGB(...l.fog.colour);
      scene.fog.color.setRGB(...l.fog.colour);
      scene.fog.density = l.fog.density;
    };

    // the camera on the director’s rig, following the lead along the stage
    const frame = (dt = 0) => {
      const here = lineAt(STAGES, clock.s);
      const p = pose({ rig: 'follow', params: {}, lead: { at: [0, 0, here.local], heading: 0 }, tangent: [0, 0, 1], metres: here.local, look, mode: 'walk', reduced: clock.reduced, heightAt: () => 0, t: 0 });
      camera.position.set(...p.at);
      camera.lookAt(...p.lookAt);
      if (camera.fov !== p.fov) {
        camera.fov = p.fov;
        camera.updateProjectionMatrix();
      }
      ground.position.z = here.local;
      sun.position.copy(camera.position).addScaledVector(sunDir, 100);
      sun.target.position.copy(camera.position);
      sky.update(camera, dt);
      return here;
    };
    relight();
    frame();

    const world = {
      ready: rt.gfx.compile?.(scene, camera),
      resize(w, h) {
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
      },
      step(dt, input) {
        const keys = { walk: Boolean(input?.action?.('walk')), run: Boolean(input?.action?.('run')), back: Boolean(input?.action?.('back')), toggleAuto: false, next: false };
        clock = stepClock(clock, dt, keys, { total: TOTAL, holdAt: () => 0, nextBeat: () => null });
        relight();
        frame(dt);
      },
      draw(f) {
        (f?.renderer ?? rt.gfx.renderer).render(scene, camera);
      },
      wants: () => true,
      anchor: () => camera.position.toArray(),
      lowerQuality() {},
      update() {},
      // (the checks’: put the ride at s and draw it there)
      set(s) {
        clock = { ...clock, s: Math.min(1, Math.max(0, s)), holdLeft: 0 };
        relight();
        frame();
      },
      get s() {
        return clock.s;
      },
      dispose() {
        ground.geometry.dispose();
        ground.material.dispose();
        sky.dispose();
        if (typeof window !== 'undefined' && window.__ROAD__?.world === world) delete window.__ROAD__;
      },
    };
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      window.__ROAD__ = { world, set: (s) => world.set(s), info: () => ({ ...(rt.gfx.renderer?.info?.render ?? {}), s: clock.s }) };
    }
    return world;
  },
};
