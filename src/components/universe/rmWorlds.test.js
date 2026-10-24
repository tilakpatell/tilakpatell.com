import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { RM_WORLDS } from './rmWorlds';
import { RM_SURFACES } from './rmWorldsGlsl';
import { MOONS, MOON_IDS } from './universes';

// a planet as buildPlanet hands it to a builder
const shell = (u) => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(u.size, 16, 12), new THREE.MeshStandardMaterial());
  group.add(body);
  return { group, body, orbits: [], tick: [], focus: [], slot: null, sun: new THREE.Vector3(1, 0.5, 0.2).normalize() };
};

describe('the Central Finite Curve’s worlds', () => {
  it('has a living world for every one of its moons, and a ground for each', () => {
    expect(Object.keys(RM_WORLDS).sort()).toEqual([...MOON_IDS].sort());
    for (const id of MOON_IDS) expect(RM_SURFACES[id]).toMatch(/vec3 rmSurface\(vec3 p, float t, float night, inout vec3 glow, inout float rough\)/);
  });

  for (const small of [false, true]) {
    it(`builds each one and keeps it moving${small ? ' (on a phone)' : ''}`, () => {
      for (const u of MOONS) {
        const p = shell(u);
        RM_WORLDS[u.id](p, { u, T: { small } });
        // its ground is a shader of its own, lit in flat bands
        expect(p.body.material.isMeshStandardMaterial).toBe(true);
        expect(p.body.material.customProgramCacheKey()).toContain(`rmworld-${u.id}`);
        expect(p.tick.length).toBeGreaterThan(0);
        // and it moves: every tick runs, at any time
        for (const t of [0, 1.3, 600.25]) {
          for (const o of p.orbits) o.set(t);
          for (const fn of p.tick) fn(t);
        }
      }
    });
  }

  it('puts the things that make each place round it', () => {
    const built = Object.fromEntries(
      MOONS.map((u) => {
        const p = shell(u);
        RM_WORLDS[u.id](p, { u, T: {} });
        let meshes = 0;
        p.group.traverse((o) => (meshes += o.isMesh || o.isPoints || o.isInstancedMesh ? 1 : 0));
        return [u.id, { meshes, orbits: p.orbits.length }];
      }),
    );
    expect(built.squanch.meshes).toBeGreaterThan(1); // (its fireworks)
    expect(built.birdworld.meshes).toBeGreaterThan(2); // (its clouds and its flocks)
    expect(built.gearworld.orbits).toBe(3); // (its cogs)
    expect(built.pluto.orbits).toBe(1); // (Charon)
    expect(built.snakeplanet.meshes).toBeGreaterThan(2); // (its serpents)
    expect(built.nuptia.meshes).toBeGreaterThan(2); // (its bands and the stone)
    expect(built.resort.meshes).toBeGreaterThan(1); // (its field)
  });

  it('lays Cronenberg World’s flesh on the real Earth’s coasts when it has their map, else on its blobs', () => {
    const u = MOONS.find((m) => m.id === 'cronenberg');
    const compiled = (T) => {
      const p = shell(u);
      RM_WORLDS.cronenberg(p, { u, T });
      const lib = THREE.ShaderLib.standard;
      const shader = { uniforms: {}, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader };
      p.body.material.onBeforeCompile(shader);
      return { shader, key: p.body.material.customProgramCacheKey() };
    };
    const land = new THREE.Texture();
    const withLand = compiled({ 'cronenberg-land': land });
    expect(withLand.shader.fragmentShader).toContain('#define RM_LAND');
    expect(withLand.shader.uniforms.uRmLand.value).toBe(land);
    const without = compiled({});
    expect(without.shader.fragmentShader).not.toContain('#define RM_LAND');
    expect(without.shader.uniforms.uRmLand).toBeUndefined();
    // (two programs, so each is its own in the cache and the warm-up)
    expect(withLand.key).not.toBe(without.key);
  });
});
