import { describe, expect, it } from 'vitest';
import { HOTSPOTS, LINKS, TASKS, nearHotspot, nearLink } from './rules';
import { DIAL, linkTarget } from './dimensions/destinations';
import { dialledName, dialledNote, firstHint, isGunKey, portalName } from './portalGun';

const garagePortal = LINKS.find((l) => l.id === 'garage-portal');

describe('C-137: the portal gun', () => {
  it('names where the garage portal is dialled, as the trip through it does', () => {
    for (const d of DIAL.slice(1)) {
      expect(dialledName(d.id)).toBe(d.name);
      // (the trip's label, but a name with 'The' in front of it is mid-sentence there)
      expect(portalName(d.id)).toBe(linkTarget(garagePortal, d.id).label.replace(/ to The /, ' to the '));
    }
    // the arcade (not a destination, so the trip keeps the link's own label), and anything the dial doesn't have
    for (const dial of ['annex', 'gazorpazorp', 'nope', null, undefined]) expect(portalName(dial)).toBe('Through the portal to Blips and Chitz');
    // (four of the sector's planets, and the Citadel, are on the dial now)
    expect(portalName('squanch')).toBe('Through the portal to Planet Squanch');
    expect(portalName('citadel')).toBe('Through the portal to the Citadel');
    expect(portalName('fantasy')).toBe('Through the portal to Fantasy World');
    expect(portalName('vat')).toBe('Through the portal to the vat of acid');
    expect(portalName('jerryboree')).toBe('Through the portal to the Jerryboree');
    // (the name on its own, in the dial, keeps its capital)
    expect(dialledName('jerryboree')).toBe('The Jerryboree');
  });

  it('says where the portal is once it’s dialled, if he isn’t by it', () => {
    expect(dialledNote('fantasy', 'garage')).toBe('Dialled to Fantasy World. Step through the portal.');
    expect(dialledNote('fantasy', 'street')).toBe('Dialled to Fantasy World. The portal’s on the west wall of Rick’s garage.');
    expect(dialledNote('jerryboree', 'garage')).toBe('Dialled to the Jerryboree. Step through the portal.');
    expect(dialledNote('vat', 'house')).toMatch(/^Dialled to the vat of acid\. /);
    for (const area of ['garage', 'house', 'arcade']) expect(dialledNote('annex', area)).not.toMatch(/!/);
  });

  it('is P, pressed once, without Ctrl, Cmd or Alt', () => {
    expect(isGunKey({ code: 'KeyP', key: 'p' })).toBe(true);
    expect(isGunKey({ code: 'KeyP', key: 'P', shiftKey: true })).toBe(true);
    expect(isGunKey({ code: '', key: 'p' })).toBe(true); // (a virtual keyboard, with no code)
    expect(isGunKey({ code: 'KeyP', key: 'p', repeat: true })).toBe(false);
    for (const mod of ['metaKey', 'ctrlKey', 'altKey']) expect(isGunKey({ code: 'KeyP', key: 'p', [mod]: true }), mod).toBe(false);
    expect(isGunKey({ code: 'KeyO', key: 'p' })).toBe(false); // (a layout with p elsewhere: where the key is counts)
    expect(isGunKey({ code: 'KeyE', key: 'e' })).toBe(false);
  });

  it('is in the first hint in C-137, keys or touch, and not on a planet', () => {
    expect(firstHint()).toMatch(/hold B to emote\. P is Rick’s portal gun\.$/);
    // (a phone has no P: the chip, up top)
    expect(firstHint({ touch: true })).toMatch(/look round\. The Portal gun button, up top, picks where Rick’s garage portal goes\.$/);
    expect(firstHint({ touch: true })).not.toMatch(/swirl|\bP\b/);
    for (const touch of [false, true]) {
      expect(firstHint({ touch, planet: true })).not.toMatch(/gun|P is/);
      expect(firstHint({ touch })).not.toMatch(/!/);
    }
  });

  it('is on Rick’s bench, out of the portal’s reach (as every hotspot is out of every link’s), so it’s the gun that’s offered there', () => {
    // (the world offers a link in reach first, and a hotspot only when there's none: RmWorld's nearLink, then nearHotspot)
    for (const h of HOTSPOTS) expect(nearLink(h.area, h.x, h.z)?.id, h.id).toBeUndefined();
    // the portal gun on Rick's bench, right by the portal, is the closest
    const dial = HOTSPOTS.find((h) => h.id === 'dial');
    expect(nearLink('garage', dial.x, dial.z, [])).toBe(null);
    expect(nearHotspot('garage', dial.x, dial.z, []).id).toBe('dial');
  });

  it('is in the portal’s thing to do: where it is, and how to get at it, with no keys a phone hasn’t got', () => {
    const { hint } = TASKS.find((t) => t.id === 'portal');
    expect(hint).toBe('The portal gun is on Rick’s bench in the garage (or its button up top, from anywhere): dial a dimension, then step through the portal on the west wall.');
    expect(hint).not.toMatch(/\b[EP]\b|press/i);
  });
});
