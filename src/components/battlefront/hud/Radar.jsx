import { MiniMap } from '../../../runtime/hud';

// The radar (UI/InGame/Hud/Radar: RadarWidget): the kit's minimap drawn as
// the game's, the player at the middle facing up, friends blue, foes red
// when they are seen, the objectives as their letters.
//
//   <Radar read={() => ({ me: { at, yaw, team }, entities, objectives })} />
export const RADAR_RANGE = 80; // m from the middle to the rim (the game's soldier radar)

export default function Radar({ read, size }) {
  const draw = (ctx, px) => {
    const v = read();
    if (!v?.me) return null;
    const r = px / 2;
    const k = r / RADAR_RANGE;
    const [mx, , mz] = v.me.at;
    const c = Math.cos(v.me.yaw);
    const s = Math.sin(v.me.yaw);
    // the export's frame to the disc: ahead (+Z turned by yaw) is up
    const toDisc = (x, z) => {
      const dx = x - mx;
      const dz = z - mz;
      const ahead = dx * s + dz * c;
      const right = -dx * c + dz * s;
      return [r + right * k, r - ahead * k];
    };
    ctx.clearRect(0, 0, px, px);
    ctx.fillStyle = 'rgba(8, 12, 18, 0.8)';
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();
    for (const o of v.objectives ?? []) {
      const [x, y] = toDisc(o.at[0], o.at[2]);
      if (Math.hypot(x - r, y - r) > r) continue;
      ctx.fillStyle = '#f2f5f8';
      ctx.font = '12px sans-serif';
      ctx.fillText(o.label, x - 4, y + 4);
    }
    for (const e of v.entities ?? []) {
      if (e.id === v.me.id || e.state !== 'alive') continue;
      const [x, y] = toDisc(e.at[0], e.at[2]);
      if (Math.hypot(x - r, y - r) > r) continue;
      ctx.fillStyle = e.team === v.me.team ? '#2f7bff' : '#ff3b30';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    ctx.fillStyle = '#f2f5f8';
    ctx.beginPath();
    ctx.moveTo(r, r - 6);
    ctx.lineTo(r + 4, r + 4);
    ctx.lineTo(r - 4, r + 4);
    ctx.fill();
    return ' ';
  };
  return <MiniMap className="bf-radar" size={size} draw={draw} label="Radar" />;
}
