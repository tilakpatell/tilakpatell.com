import { describe, expect, it } from 'vitest';
import { NeutralToneMapping, NoToneMapping, PCFShadowMap, PCFSoftShadowMap } from 'three';
import { borrow } from './borrow';

// the runtime's renderer as the next world expects it
const shared = () => ({ info: { autoReset: true }, localClippingEnabled: false, toneMapping: NeutralToneMapping, shadowMap: { enabled: false, type: PCFSoftShadowMap } });

describe('the renderer the map borrows', () => {
  it('counts its own frames and maps no tone while the map draws', () => {
    const r = shared();
    borrow(r);
    expect(r.info.autoReset).toBe(false);
    expect(r.toneMapping).toBe(NoToneMapping);
  });

  it('goes back as it was, whatever the map and its cockpits changed meanwhile', () => {
    const r = shared();
    const giveBack = borrow(r);
    r.localClippingEnabled = true;
    r.shadowMap.enabled = true;
    r.shadowMap.type = PCFShadowMap;
    giveBack();
    expect(r).toEqual(shared());
  });

  it('only once: a second giving back leaves what the next world set', () => {
    const r = shared();
    const giveBack = borrow(r);
    giveBack();
    r.toneMapping = NoToneMapping;
    giveBack();
    expect(r.toneMapping).toBe(NoToneMapping);
  });
});
