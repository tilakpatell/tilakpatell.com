import { describe, expect, it } from 'vitest';
import { NeutralToneMapping, NoToneMapping, PCFShadowMap, PCFSoftShadowMap } from 'three';
import { borrow } from './borrow';

// the runtime's renderer as the next world expects it
const shared = () => ({ info: { autoReset: true }, localClippingEnabled: false, toneMapping: NeutralToneMapping, shadowMap: { enabled: false, type: PCFSoftShadowMap } });

describe('the renderer the map borrows', () => {
  it('counts its own frames and maps no tone only while the map draws', () => {
    const r = shared();
    const b = borrow(r);
    // (made while another world still draws: that world's frames as they were)
    expect(r.info.autoReset).toBe(true);
    expect(r.toneMapping).toBe(NeutralToneMapping);
    const seen = b.during(() => [r.info.autoReset, r.toneMapping]);
    expect(seen).toEqual([false, NoToneMapping]);
    expect(r).toEqual(shared());
  });

  it('puts them back after a draw that throws', () => {
    const r = shared();
    const b = borrow(r);
    expect(() =>
      b.during(() => {
        throw new Error('frame failed');
      }),
    ).toThrow('frame failed');
    expect(r).toEqual(shared());
  });

  it('goes back as it was, whatever the map and its cockpits changed meanwhile, when no world has it next', () => {
    const r = shared();
    const b = borrow(r);
    r.localClippingEnabled = true;
    r.shadowMap.enabled = true;
    r.shadowMap.type = PCFShadowMap;
    b.giveBack();
    expect(r).toEqual(shared());
  });

  it('only once: a second giving back leaves what the next world set', () => {
    const r = shared();
    const b = borrow(r);
    b.giveBack();
    r.localClippingEnabled = true;
    b.giveBack();
    expect(r.localClippingEnabled).toBe(true);
  });
});
