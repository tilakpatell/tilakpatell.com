import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { discRings } from './ocean';
import { createWater } from './water';

const sky = { zenith: '#3a86d4', horizon: '#c6ecf2', suns: [] };
const site = (kind, extra = {}) => ({ sky, water: { level: 0, color: '#38c6c8', deep: '#0a5a78', kind, ...extra } });
const sun = new THREE.Vector3(0.3, 0.8, 0.2).normalize();
// a beach: dry east of x = 100, the sea floor falling away west of it
const beach = (x) => (x - 100) * 0.08;

describe('the water', () => {
  it('draws a sea on the disc round the camera', () => {
    const w = createWater(site('sea'), sun, '#ffffff', { heightAt: beach, id: 'scarif' });
    const { radii, around } = discRings({});
    expect(w.mesh.geometry.attributes.position.count).toBe(radii.length * around);
    expect(w.mesh.material.vertexShader).toContain('#include <fog_vertex>');
    expect(w.mesh.material.vertexShader).toContain('gerstner(');
    w.dispose();
  });

  it('a coarser disc on a small screen', () => {
    const w = createWater(site('swamp'), sun, '#ffffff', { heightAt: beach, small: true, id: 'dagobah' });
    const { radii, around } = discRings({ small: true });
    expect(w.mesh.geometry.attributes.position.count).toBe(radii.length * around);
    w.dispose();
  });

  it('keeps lava and cloud on their plane', () => {
    for (const kind of ['lava', 'clouds']) {
      const w = createWater(site(kind), sun, '#ffffff', { heightAt: beach });
      expect(w.mesh.geometry.attributes.position.count).toBe(4);
      w.dispose();
    }
  });

  it('flows the game’s lava film through the lava where it is handed one, the shader’s own lava under it', () => {
    const flow = new THREE.Texture();
    const w = createWater(site('lava', { video: 'volcano' }), sun, '#ffffff', { heightAt: beach, flow, flipped: true });
    expect(w.mesh.material.defines.VIDEO).toBe('');
    expect(w.mesh.material.uniforms.uFlow.value).toBe(flow);
    expect(w.mesh.material.uniforms.uFlowFlip.value).toBe(1);
    expect(w.mesh.material.fragmentShader).toContain('texture2D(uFlow');
    w.dispose();
    // (none handed in, on low or a saver connection: the shader's lava alone)
    const plain = createWater(site('lava', { video: 'volcano' }), sun, '#ffffff', { heightAt: beach });
    expect(plain.mesh.material.defines.VIDEO).toBeUndefined();
    plain.dispose();
  });

  it('gives the cloud sea a second, slower layer and the sun’s glints', () => {
    const w = createWater(site('clouds'), sun, '#ffffff', { heightAt: beach });
    const u = w.mesh.material.uniforms;
    expect(u.uWaves2.value).toBeCloseTo(u.uWaves.value * 2.3, 5);
    expect(w.mesh.material.fragmentShader).toContain('uWaves2');
    expect(w.mesh.material.fragmentShader).toContain('glint');
    w.dispose();
  });

  it('follows the camera in steps', () => {
    const w = createWater(site('sea'), sun, '#ffffff', { heightAt: beach, id: 'scarif' });
    w.update(1, { position: new THREE.Vector3(10.4, 30, -7.9) });
    const c = w.mesh.material.uniforms.uCentre.value;
    expect([c.x, c.y]).toEqual([10, -8.75]);
    w.dispose();
  });

  it('is still on the sand and moves out at sea', () => {
    const w = createWater(site('sea'), sun, '#ffffff', { heightAt: beach, id: 'scarif' });
    expect(w.depth.at(300, 0)).toBe(0);
    expect(w.height(300, 0, 3)).toBe(0);
    const out = [0, 1, 2, 3].map((t) => w.height(-400, 20, t));
    expect(Math.max(...out) - Math.min(...out)).toBeGreaterThan(0.1);
    w.dispose();
  });
  // (the drops in the air: parked ones sit far under the world)
  const flying = (w) => {
    const p = w.spray.geometry.attributes.position;
    let n = 0;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > -1e5) n++;
    return n;
  };

  it('throws spray off a leg in Kamino’s storm, and none with no legs', () => {
    const cam = { position: new THREE.Vector3(0, 30, 0) };
    const legs = createWater(site('sea', { legs: [[-300, 0, 12]] }), sun, '#ffffff', { id: 'kamino' });
    const none = createWater(site('sea'), sun, '#ffffff', { id: 'kamino' });
    let most = 0;
    for (let t = 0; t < 30; t += 1 / 30) {
      legs.update(t, cam);
      none.update(t, cam);
      most = Math.max(most, flying(legs));
    }
    expect(most).toBeGreaterThan(5);
    expect(flying(none)).toBe(0);
    legs.dispose();
    none.dispose();
  });

  it('splashes where something goes in, and the drops fall back', () => {
    const w = createWater(site('sea'), sun, '#ffffff', { id: 'kamino' });
    const cam = { position: new THREE.Vector3(0, 30, 0) };
    w.update(0, cam);
    w.splash(-300, 40);
    expect(flying(w)).toBeGreaterThan(20);
    for (let t = 1 / 30; t < 4; t += 1 / 30) w.update(t, cam);
    expect(flying(w)).toBe(0);
    w.dispose();
  });
});
