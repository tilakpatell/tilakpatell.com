import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LADDER, rendererState } from './stage';

const fakeRenderer = () => {
  const clear = new THREE.Color(0x123456);
  return {
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
    outputColorSpace: THREE.SRGBColorSpace,
    autoClear: true,
    shadowMap: { enabled: false, type: THREE.PCFShadowMap },
    info: { autoReset: true },
    clearAlpha: 0,
    getClearColor: (c) => c.copy(clear),
    getClearAlpha() {
      return this.clearAlpha;
    },
    setClearColor(c, a) {
      clear.copy(c);
      this.clearAlpha = a;
    },
  };
};

describe('the stage on a shared renderer', () => {
  it('reads what it changes on the renderer and puts it back as it was', () => {
    const r = fakeRenderer();
    const state = rendererState(r);
    const theirs = state.read();
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.4;
    r.shadowMap.enabled = true;
    r.info.autoReset = false;
    r.setClearColor(new THREE.Color(0), 1);
    const mine = state.read();
    state.write(theirs);
    expect(state.read()).toEqual(theirs);
    expect(r.getClearColor(new THREE.Color()).getHex()).toBe(0x123456);
    state.write(mine);
    expect(r.toneMappingExposure).toBe(1.4);
    expect(r.info.autoReset).toBe(false);
    expect(r.getClearAlpha()).toBe(1);
  });

  it('steps down in lib/stage3d’s order: sharpness, shadows, bloom, sharpness again', () => {
    expect(LADDER).toEqual(['full', 'ratio', 'shadows', 'bloom', 'low']);
  });
});

describe('the page’s frame as the world’s draw', async () => {
  const { pageFrame } = await import('./stage');
  const stage = { hold: () => true, giveBack: () => {} };
  it('starts a frame begun anew on 16 ms, as the page’s own loop did, then the runtime’s interval', () => {
    const calls = [];
    const ref = { current: null };
    const page = pageFrame(stage, ref);
    expect(page.wants()).toBe(false);
    page.draw({ dt: 0.02, now: 1 });
    ref.current = (ms) => calls.push(ms);
    expect(page.wants()).toBe(true);
    page.draw({ dt: 0, now: 2 });
    page.draw({ dt: 0.02, now: 3 });
    ref.current = (ms) => calls.push(-ms); // (live again: a new frame)
    page.draw({ dt: 0, now: 4 });
    expect(calls).toEqual([16, 20, -16]);
  });
});
