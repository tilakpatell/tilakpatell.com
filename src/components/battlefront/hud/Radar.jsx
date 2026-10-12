import { useEffect, useState } from 'react';
import { MiniMap } from '../../../runtime/hud';
import { colour } from '../../../lib/bf2017/ui/index.js';
import { shape } from '../../../lib/bf2017/ui/shapes.js';
import { RADAR_GRID, RADAR_RANGE, radarPoint, referenceScale } from './widgets.js';

// The radar (UI/InGame/Hud/Radar/RadarWidget), the kit's minimap drawn as
// the game draws its own: a 200-unit disc (RadarMask, a square with its
// corners cut) on glass at the bottom left, 50 m from the middle to the rim
// (every element's MaxRange), a 20 m grid (RadarGridElementData), the decor
// ring (RadarDecor, palette 34), the player a triangle at the middle facing
// up (CenterTriangleNormal, 8 units, palette 33 at 0.5), friends in the
// friendly blue (RadarShape, palette 13), foes in the enemy red (palette 11)
// only while they fire (the game reveals an enemy on the radar when it
// shoots), the objectives as their letters in a hexagon
// (RadarObjectiveWithLetterWidget: 18 units, Univers 620 Bold 14 px at
// 0.85) held to the rim with a 6-unit arrow when out of range (the
// "Sticky Objectives" collector), N and S on the rim turning with the
// player (NorthSouthLine, Univers 520 Medium 14 px, palette 33 at 0.5).
// The game has no overview map image: this disc is its map.
//
//   <Radar read={() => ({ me: { at, yaw, team }, entities: [{ id, team, at, alive, firing }], objectives: [{ at, label }] })} />
export { RADAR_RANGE };
const DISC = 200; // units across (RadarWidget's 200 × 200 elements)
const MASK = shape('RadarMask');
const DECOR = shape('RadarDecor');
const HEX = shape('Hexagon_Default_Inside');
const INK = colour(33);
const RIM = colour(34);
const FRIEND = colour(13);
const FOE = colour(11);
const GLASS = 'rgba(10, 14, 18, 0.8)';
let paths = null;
const pathsOf = () => (paths ??= { mask: new Path2D(MASK.paths[0].d), decor: DECOR.paths.map((p) => [new Path2D(p.d), p.strokeWidth, p.opacity]), hex: new Path2D(HEX.paths[0].d) });

// the disc's size in CSS px: 200 on the game's 1080-tall reference
function useDiscSize() {
  const px = () => Math.round(DISC * referenceScale(window.innerWidth, window.innerHeight));
  const [size, setSize] = useState(() => (typeof window === 'undefined' ? DISC : px()));
  useEffect(() => {
    const on = () => setSize(px());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
}

export default function Radar({ read, size: given }) {
  const measured = useDiscSize();
  const size = given ?? measured;
  const draw = (ctx, px) => {
    const v = read();
    if (!v?.me) return null;
    const P = pathsOf();
    const k = px / DISC;
    const r = DISC / 2;
    ctx.save();
    ctx.scale(k, k);
    ctx.clip(P.mask);
    ctx.fillStyle = GLASS;
    ctx.fillRect(0, 0, DISC, DISC);
    // the grid, 20 m squares of the world turning with the player (the
    // record keeps it near invisible: here faint). Turned by yaw + π the
    // canvas axes are the world's x and z (radarPoint's frame, worked out)
    const step = (RADAR_GRID * r) / RADAR_RANGE;
    const kk = r / RADAR_RANGE;
    ctx.translate(r, r);
    ctx.rotate(v.me.yaw + Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    const ox = (((-v.me.at[0] * kk) % step) + step) % step;
    const oy = (((-v.me.at[2] * kk) % step) + step) % step;
    ctx.beginPath();
    for (let x = -r - step + ox; x <= r + step; x += step) {
      ctx.moveTo(x, -r);
      ctx.lineTo(x, r);
    }
    for (let y = -r - step + oy; y <= r + step; y += step) {
      ctx.moveTo(-r, y);
      ctx.lineTo(r, y);
    }
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.scale(k, k);
    for (const [p, w, a] of P.decor) {
      ctx.globalAlpha = a ?? 1;
      ctx.strokeStyle = RIM;
      ctx.lineWidth = w;
      ctx.stroke(p);
    }
    ctx.globalAlpha = 1;
    ctx.translate(r, r);
    // the soldiers (a 10-unit rounded square, RadarShape)
    for (const e of v.entities ?? []) {
      if (e.id === v.me.id || !e.alive) continue;
      const friend = e.team === v.me.team;
      if (!friend && !e.firing) continue;
      const { x, y, inside } = radarPoint(v.me, e.at, { radius: r });
      if (!inside) continue;
      ctx.fillStyle = friend ? FRIEND : FOE;
      ctx.beginPath();
      ctx.roundRect(x - 4, y - 4, 8, 8, 2.8);
      ctx.fill();
    }
    // the objectives: a letter in a hexagon, held to the rim with an arrow when past it
    ctx.font = `700 14px 'BF Univers Condensed', 'Arial Narrow', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const o of v.objectives ?? []) {
      const p = radarPoint(v.me, o.at, { radius: r });
      const rim = r - 12;
      const out = p.d > rim;
      const x = out ? (p.x / p.d) * rim : p.x;
      const y = out ? (p.y / p.d) * rim : p.y;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = INK;
      ctx.save();
      ctx.scale(18 / 96, 18 / 96);
      ctx.translate(-48, -48);
      ctx.fill(P.hex);
      ctx.restore();
      ctx.fillStyle = '#0b0f14';
      ctx.fillText(o.label ?? '', 0, 1);
      if (out) {
        const a = Math.atan2(p.y, p.x);
        ctx.rotate(a);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(14, -3);
        ctx.lineTo(18, 0);
        ctx.lineTo(14, 3);
        ctx.fill();
      }
      ctx.restore();
    }
    // the player, a triangle at the middle facing up
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(4, 4);
    ctx.lineTo(-4, 4);
    ctx.fill();
    // N and S on the rim, turning with the player (north is the world's +Z, ahead at yaw 0)
    ctx.font = `500 14px 'BF Univers Condensed', 'Arial Narrow', sans-serif`;
    ctx.rotate(v.me.yaw);
    ctx.fillText('N', 0, -r + 12);
    ctx.fillText('S', 0, r - 12);
    ctx.restore();
    return '';
  };
  return <MiniMap className="bf-radar" size={size} draw={draw} label="Radar" />;
}
