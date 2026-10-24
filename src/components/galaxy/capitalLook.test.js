import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LENGTH, dressCapital, isCapital, nozzlesOf, plateTint } from './capitalLook';

// a capital as galaxy/models.js hands it over: a holder in the unit frame,
// a bare hull (no colour map, the export's), a glass of windows, an engine
// with two nozzles facing aft at the stern, and a hull metal tune() lit
const ship = () => {
  const holder = new THREE.Group();
  holder.scale.setScalar(0.25);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 4), new THREE.MeshStandardMaterial({ name: 'M_Hull_01_lods' }));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.1), new THREE.MeshStandardMaterial({ name: 'M_Windows', transparent: true, opacity: 0.32 }));
  const nozzle = (x) => {
    const g = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 12).rotateX(Math.PI / 2).translate(x, 0, -2.1);
    return g;
  };
  const engine = new THREE.Mesh(nozzle(-0.3), new THREE.MeshStandardMaterial({ name: 'M_MainEngine_01_lods', map: new THREE.Texture() }));
  const engine2 = new THREE.Mesh(nozzle(0.3), engine.material);
  const metal = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ name: 'MC_80_light_Met', emissive: '#ffffff', emissiveIntensity: 3.2, map: new THREE.Texture() }));
  holder.add(hull, glass, engine, engine2, metal);
  return { holder, hull, glass, engine, engine2, metal };
};

describe('capitalLook', () => {
  it('knows the capitals and their lengths and greys', () => {
    for (const kind of ['destroyer', 'venator', 'moncal', 'lucrehulk', 'lightcruiser', 'interdictor']) {
      expect(isCapital(kind), kind).toBe(true);
      expect(LENGTH[kind], kind).toBeGreaterThan(50);
    }
    expect(isCapital('xwing')).toBe(false);
    expect(plateTint('destroyer')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('plates a bare hull in its own frame, lights the windows and the engines aft, and puts out a metal lit by name', () => {
    const { holder, hull, glass, engine, metal } = ship();
    const done = dressCapital(holder, 'destroyer');
    expect(hull.material.userData.plated).toBe(true);
    expect(hull.material.customProgramCacheKey()).toMatch(/plated$/);
    // (the shader takes the mesh's frame and the ship's length)
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    hull.material.onBeforeCompile(shader);
    expect(shader.uniforms.uLength.value).toBe(LENGTH.destroyer);
    expect(shader.uniforms.uUnit.value.elements[0]).toBeCloseTo(0.25, 6);
    expect(shader.fragmentShader).toMatch(/plPlating/);
    expect(shader.vertexShader).toMatch(/vShip = /);
    expect(glass.material.emissiveIntensity).toBeGreaterThan(1);
    expect(engine.material.userData.burning).toBe(true);
    expect(metal.material.emissive.getHex()).toBe(0);
    // (and the nozzles' glows, one mesh)
    expect(done.nozzles).toHaveLength(2);
    expect(holder.children.filter((o) => o.userData.glows)).toHaveLength(1);
  });

  it('greys a bare hull without plating it where the detail is lowest', () => {
    const { holder, hull } = ship();
    dressCapital(holder, 'destroyer', { plating: false });
    expect(hull.material.userData.plated).toBeUndefined();
    expect(hull.material.color.getHex()).toBe(new THREE.Color(plateTint('destroyer')).getHex());
  });

  it('lights a kind’s own lights-and-engines material, and plates a kind whose maps are next to flat colour', () => {
    const { holder } = ship();
    const lights = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ name: 'M_FrigateNebulonB_01_Emissive', color: 0x6b6f76 }));
    holder.add(lights);
    dressCapital(holder, 'nebulon');
    expect(lights.material.emissiveIntensity).toBeGreaterThan(0.5);
    expect(lights.material.userData.plated).toBeUndefined();
    const flat = ship();
    const painted = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1), new THREE.MeshStandardMaterial({ name: 'Mat_1', map: new THREE.Texture() }));
    flat.holder.add(painted);
    dressCapital(flat.holder, 'acclamator');
    expect(painted.material.userData.plated).toBe(true);
  });

  it('leaves a ship that isn’t a capital as it was', () => {
    const { holder, hull } = ship();
    expect(dressCapital(holder, 'xwing')).toBeNull();
    expect(hull.material.userData.plated).toBeUndefined();
  });

  it('finds a nozzle each where an engine faces aft at the stern', () => {
    const { holder, engine, engine2 } = ship();
    holder.updateMatrixWorld(true);
    const n = nozzlesOf([engine, engine2]);
    expect(n).toHaveLength(2);
    for (const [x, y, z, r] of n) {
      expect(Math.abs(Math.abs(x) - 0.075)).toBeLessThan(0.01);
      expect(Math.abs(y)).toBeLessThan(0.01);
      expect(z).toBeLessThan(-0.5);
      expect(r).toBeGreaterThan(0.01);
    }
  });
});
