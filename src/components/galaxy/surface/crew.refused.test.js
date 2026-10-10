import { describe, expect, it, vi } from 'vitest';

// the own-rig loader refusing a kind whose pack isn't built yet (Review Focus 5)
vi.mock('../../universe/footScene', () => ({
  loadPartyFigure: async () => {
    throw new Error('/models/galaxy/bf2017/crew/sneep.lod1.glb: no clips for the rig sneep');
  },
  loadSharedFigure: async () => null,
}));

const { crewFigure } = await import('./crew');

describe('a crew kind its loader refuses', () => {
  it('is skipped, with one line for the kind however many of it a world places', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await crewFigure('sneep', 0)).toBe(null);
    expect(await crewFigure('sneep', 1)).toBe(null);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0])).toMatch(/sneep/);
    warn.mockRestore();
  });
});
