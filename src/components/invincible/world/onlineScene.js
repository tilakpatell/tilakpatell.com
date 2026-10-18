// The other players online drawn (split out of ./scene.js as a repair).

import * as THREE from 'three';
import { POSES, figure } from '../../../lib/three/rig';
import { CAST } from '../cast';
import { createGhosts } from '../../middleearth/towns/ghosts';
import { surfaceAt } from './flight';
import { WATER_Y, groundAt } from './map';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const Y = new THREE.Vector3(0, 1, 0);

// `markT`: Mark's figure's model; `zone()`: the city or space, as the scene has it now
export function createOnlineGhosts({ markT, world, zone: zoneOf }) {
  // ── other players online, in their own worlds, as holograms ──
  // (as the Middle-earth towns show theirs: ../../middleearth/towns/ghosts.js)
  // each a pale, shimmering Mark with his name over him: walking, hanging in
  // the air, flat out, or stood on the Moon. Nothing here touches them, nor
  // they anything here. InvWorld's placeOf says where: in the city, x and z
  // and how high over the land or the water; in space, just where (and
  // which way's up there, and how high over it)
  const gAt = new THREE.Vector3();
  const gUp = new THREE.Vector3();
  const gYaw = new THREE.Quaternion();
  const gQ = new THREE.Quaternion();
  return createGhosts({
    height: (x, z) => (zoneOf() === 'city' ? Math.max(groundAt(x, z), WATER_Y) : 0),
    make: () => {
      const f = figure(markT, CAST.mark); // (he faces +z, as a ghost's face has it)
      f.snap(POSES.stand);
      const group = new THREE.Group();
      group.add(f.holder);
      return { group, top: CAST.mark.h, fig: f, gait: 0, at: null, v: new THREE.Vector3(), dispose: () => f.dispose() };
    },
    animate: (f, gt, p, gdt) => {
      const fig = f.fig;
      const speed = p.speed ?? 0;
      // off the ground: over the land, the water or a roof (or the Moon, or Mars)
      const y = p.over == null ? Math.max(groundAt(p.x, p.z), WATER_Y) + (p.y ?? 0) : 0;
      const air = (p.over ?? y - surfaceAt(world, p.x, p.z, y + 0.3).y) > 0.8;
      // which way they're going, from how the ghost itself moves (the room says how fast, not where)
      f.group.updateWorldMatrix(true, false);
      gAt.setFromMatrixPosition(f.group.matrixWorld);
      if (f.at && gdt > 0) f.v.lerp(gUp.subVectors(gAt, f.at).divideScalar(gdt), 1 - Math.exp(-4 * gdt));
      f.at = (f.at ?? new THREE.Vector3()).copy(gAt);
      // stood up the way that's up where they are (on the Moon, away from it), turned the way they face
      gYaw.setFromAxisAngle(Y, -f.group.rotation.y);
      if (!air && p.up) gUp.fromArray(p.up);
      else gUp.copy(Y);
      fig.holder.position.copy(gUp).applyQuaternion(gYaw).multiplyScalar(fig.hipHeight);
      // in the air: upright when still, along the way they're going when fast (as Mark is)
      const k = air ? clamp((f.v.length() - 8) / 30, 0, 1) : 0;
      gAt.copy(f.v.lengthSq() > 0.01 ? f.v : Y).normalize();
      gAt.lerpVectors(Y, gAt, k).normalize().applyQuaternion(gYaw);
      fig.body.quaternion.slerp(gQ.setFromUnitVectors(Y, gAt), 1 - Math.exp(-8 * gdt));
      fig.holder.quaternion.setFromUnitVectors(Y, gUp).premultiply(gYaw).multiply(gYaw.invert());
      // (Mark's clips where they fit; flat out, posed, as the lean above wants)
      if (air) {
        if (k > 0.45) fig.pose(POSES.fly(), gdt, 9);
        else fig.act('hover', { fade: 0.4 }) || fig.pose(POSES.hover(gt), gdt, 9);
      } else {
        f.gait += speed * gdt * 1.55;
        if (speed > 4.5) fig.act('run', { speed: clamp(speed / 5.5, 0.7, 1.6) }) || fig.pose(POSES.stride(f.gait, 1, clamp((speed - 4) / 5, 0, 1)), gdt, 14);
        else if (speed > 0.3) fig.act('walk', { speed: clamp(speed / 1.4, 0.6, 2.2) }) || fig.pose(POSES.stride(f.gait, clamp(speed / 2, 0, 1), 0), gdt, 14);
        else fig.act('idle') || fig.pose(POSES.stand, gdt, 14);
      }
      fig.tick(gdt);
    },
    tag: 0.5,
    halo: 1.3,
    snap: 150, // (flying, they're tens of metres on from one pose to the next)
  });
}
