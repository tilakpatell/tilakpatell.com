import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createQuipSprite } from './quipSprite';

// Node has no canvas: a pen that measures every character alike, draws
// nothing and keeps what it was asked to write stands in for one.
let written = [];
beforeAll(() => {
  const pen = new Proxy(
    {},
    {
      get: (_, k) => {
        if (k === 'measureText') return (s) => ({ width: String(s).length * 18 });
        if (k === 'fillText') return (s, x, y, max) => written.push({ s, x, y, max });
        return () => {};
      },
      set: () => true,
    },
  );
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => pen }) });
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  written = [];
});

const lines = () => written.map((w) => w.s);

describe('the quick-chat sprite', () => {
  it('starts hidden: a sprite with its painted card, anchored at the tail’s tip', () => {
    const q = createQuipSprite();
    expect(q.sprite.isSprite).toBe(true);
    expect(q.sprite.visible).toBe(false);
    expect(q.sprite.center.toArray()).toEqual([0.5, 0]);
    const m = q.sprite.material;
    expect(m.isSpriteMaterial).toBe(true);
    expect(m.map.isCanvasTexture).toBe(true);
    expect(m.map.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.sizeAttenuation).toBe(true);
    expect(lines()).toEqual([]);
    q.dispose();
  });

  it('is the canvas’s shape, the card `height` tall and the tail below it', () => {
    const q = createQuipSprite({ height: 0.5 });
    const { width, height } = q.sprite.material.map.image;
    expect(width).toBeGreaterThan(height);
    expect(q.sprite.scale.x / q.sprite.scale.y).toBeCloseTo(width / height, 6);
    // taller than the card alone (the tail), but not twice it
    expect(q.sprite.scale.y).toBeGreaterThan(0.5);
    expect(q.sprite.scale.y).toBeLessThan(1);
    q.dispose();
  });

  it('takes a size that doesn’t shrink with distance, and an anchor of its own', () => {
    const q = createQuipSprite({ height: 0.06, sizeAttenuation: false, center: [0.5, -0.4] });
    expect(q.sprite.material.sizeAttenuation).toBe(false);
    expect(q.sprite.center.toArray()).toEqual([0.5, -0.4]);
    q.dispose();
  });

  it('shows a line, painted once however often it’s set', () => {
    const q = createQuipSprite();
    const v0 = q.sprite.material.map.version;
    q.set('Hello');
    expect(q.sprite.visible).toBe(true);
    expect(lines()).toEqual(['Hello']);
    const v1 = q.sprite.material.map.version;
    expect(v1).toBeGreaterThan(v0);
    for (let i = 0; i < 60; i++) q.set('Hello');
    expect(lines()).toEqual(['Hello']);
    expect(q.sprite.material.map.version).toBe(v1);
    q.dispose();
  });

  it('repaints for a new line; hides on null without painting; the last line back isn’t painted again', () => {
    const q = createQuipSprite();
    q.set('Hello');
    q.set('On my way');
    expect(lines()).toEqual(['Hello', 'On my way']);
    const v = q.sprite.material.map.version;
    q.set(null);
    expect(q.sprite.visible).toBe(false);
    q.set('On my way');
    expect(q.sprite.visible).toBe(true);
    expect(lines()).toEqual(['Hello', 'On my way']);
    expect(q.sprite.material.map.version).toBe(v);
    q.dispose();
  });

  it('takes anything that isn’t a line as none', () => {
    for (const junk of [undefined, '', 0, 42, {}, [], true]) {
      const q = createQuipSprite();
      q.set('Yes');
      q.set(junk);
      expect(q.sprite.visible).toBe(false);
      q.dispose();
    }
  });

  it('writes the line in the card’s middle, squeezed to fit rather than past its edge', () => {
    const q = createQuipSprite();
    const { width } = q.sprite.material.map.image;
    q.set('See you at the map');
    const long = 'A line far longer than any of the set ones would ever be, said anyway';
    q.set(long);
    for (const w of written) {
      expect(w.max).toBeGreaterThan(0);
      expect(w.max).toBeLessThan(width);
    }
    expect(written[1].s).toBe(long);
    q.dispose();
  });

  it('fades with whoever it’s over, and is hidden when gone', () => {
    const q = createQuipSprite();
    q.set('Thanks');
    expect(q.sprite.material.opacity).toBe(1);
    q.fade(0.5);
    expect(q.sprite.material.opacity).toBeCloseTo(0.5);
    expect(q.sprite.visible).toBe(true);
    q.fade(2);
    expect(q.sprite.material.opacity).toBe(1);
    q.fade(0);
    expect(q.sprite.visible).toBe(false);
    q.fade(0.8);
    expect(q.sprite.visible).toBe(true);
    for (const k of [-1, NaN, undefined]) {
      q.fade(k);
      expect(q.sprite.material.opacity).toBe(0);
      expect(q.sprite.visible).toBe(false);
    }
    // faded in with nothing to say: still hidden
    q.set(null);
    q.fade(1);
    expect(q.sprite.visible).toBe(false);
    q.dispose();
  });

  it('lets go of its texture and material, and leaves whatever held it', () => {
    const q = createQuipSprite();
    const group = new THREE.Group();
    group.add(q.sprite);
    const map = vi.spyOn(q.sprite.material.map, 'dispose');
    const mat = vi.spyOn(q.sprite.material, 'dispose');
    q.dispose();
    expect(map).toHaveBeenCalledOnce();
    expect(mat).toHaveBeenCalledOnce();
    expect(group.children).toEqual([]);
  });
});
