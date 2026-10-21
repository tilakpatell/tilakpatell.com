import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { placeOf, watchTextures } from './textureWatch';

describe('a texture moved along its surface, on the node renderer', () => {
  it('reads every texture’s place on a material, and none where there are none', () => {
    const map = new THREE.Texture();
    const m = new THREE.MeshBasicMaterial({ map });
    const before = placeOf(m);
    map.offset.y -= 0.35;
    expect(placeOf(m)).not.toBe(before);
    expect(placeOf(new THREE.MeshBasicMaterial())).toBe('');
  });

  it('takes a draw whose texture moved for changed, even when three’s observer saw nothing', () => {
    class Observer {
      equals() {
        return true;
      }
    }
    watchTextures(Observer);
    watchTextures(Observer); // (once)
    const map = new THREE.Texture();
    const ro = { material: new THREE.MeshBasicMaterial({ map }) };
    const o = new Observer();
    expect(o.equals(ro)).toBe(false); // (the first look: nothing to compare with)
    expect(o.equals(ro)).toBe(true);
    map.offset.y = 0.2;
    expect(o.equals(ro)).toBe(false);
    expect(o.equals(ro)).toBe(true);
  });
});
