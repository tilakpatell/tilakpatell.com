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
  const engine = new THREE.Mesh(nozzle(-0.3), new THREE.MeshStandardMaterial({ name: 'M_MainEngine_01_lods', map: new THREE.Texture(), metalness: 1 }));
  const engine2 = new THREE.Mesh(nozzle(0.3), engine.material);
  const metal = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ name: 'ImperialLightCruiser_Hatch', emissive: '#ffffff', emissiveIntensity: 3.2, map: new THREE.Texture() }));
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
    expect(shader.fragmentShader).toMatch(/plOf\(/);
    expect(shader.uniforms.uDetail.value.isTexture).toBe(true);
    expect(shader.vertexShader).toMatch(/vShip = /);
    expect(glass.material.emissiveIntensity).toBeGreaterThan(1);
    expect(engine.material.userData.burning).toBe(true);
    // (its glow by the housing's own map, not the plating over it)
    const burnt = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    engine.material.onBeforeCompile(burnt);
    expect(burnt.fragmentShader).toMatch(/aftOwn = texture2D\( map, vMapUv \)\.rgb \* diffuse;/);
    expect(metal.material.emissive.getHex()).toBe(0);
    // (the export's whole metal brought down to paint, a dielectric as the game's; a material made plain left plain)
    expect(engine.material.metalness).toBe(0);
    expect(hull.material.metalness).toBe(0);
    // (a map of where the metal is keeps a little of it, never a chrome hull)
    const chrome = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'Material_0', map: new THREE.Texture(), metalnessMap: new THREE.Texture(), metalness: 1 }));
    const generated = new THREE.Group();
    generated.add(chrome);
    dressCapital(generated, 'interdictor');
    expect(chrome.material.metalness).toBeGreaterThan(0);
    expect(chrome.material.metalness).toBeLessThanOrEqual(0.2);
    // (and its map, painted darker than the Imperial grey, brought up to it)
    expect(chrome.material.color.r).toBeGreaterThan(1.5);
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
    // (small lights on it, not a lit slab: its mask didn't come through)
    expect(lights.material.userData.panes).toBe(true);
    const flat = ship();
    const painted = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1), new THREE.MeshStandardMaterial({ name: 'Mat_1', map: new THREE.Texture() }));
    flat.holder.add(painted);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ name: 'Material.017', color: 0x009ce7 }));
    flat.holder.add(lamp);
    dressCapital(flat.holder, 'acclamator');
    expect(painted.material.userData.plated).toBe(true);
    // (and a bare one of a strong colour, a lamp: alight, not plated)
    expect(lamp.material.emissive.getHex()).toBe(lamp.material.color.getHex());
    expect(lamp.material.userData.plated).toBeUndefined();
  });

  it('lights an engine’s own bare glow in its side’s engine light, and puts its nozzles’ glow on', () => {
    const { holder } = ship();
    holder.remove(...holder.children.filter((o) => /Engine/.test(o.material.name)));
    const g = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 12).rotateX(Math.PI / 2).translate(0, 0, -2.1);
    const glow = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ name: 'RedEngineGlow', color: 0xf50000, emissive: 0xf50000, emissiveIntensity: 3.2 }));
    holder.add(glow);
    const done = dressCapital(holder, 'executor');
    // (blue-white, as the films' Imperial engines: not the model's red)
    expect(glow.material.emissive.b).toBeGreaterThan(glow.material.emissive.r);
    expect(glow.material.userData.plated).toBeUndefined();
    expect(done.nozzles).toHaveLength(1);
    expect(holder.children.filter((o) => o.userData.glows)).toHaveLength(1);
  });

  it('lights the MC80’s own lit windows, which the export gave the hull’s breakup, as small panes', () => {
    const { holder } = ship();
    const windows = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ name: 'MC_80_light_Met', emissive: '#ffffff', emissiveIntensity: 3.2, map: new THREE.Texture() }));
    holder.add(windows);
    dressCapital(holder, 'moncal');
    expect(windows.material.map).toBeNull();
    expect(windows.material.userData.panes).toBe(true);
    expect(windows.material.emissiveIntensity).toBeGreaterThan(1);
    expect(windows.material.color.r).toBeLessThan(0.1);
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
