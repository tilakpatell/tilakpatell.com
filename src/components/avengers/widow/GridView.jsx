import { CAMERA, VISION, angleOf, biteTargets, camAngle, intent, visionPolygon } from './rules';
import { laserLine, laserState, viewBoxOf } from './flatInput';

// An Infiltration level from above (spec 2026-10-18-avengers-hq-fix-and-hub-
// design, §8): abstract markers only, a tile to a unit. Walls, blocks, glass
// and desks are squares; the guards' and cameras' sight is shaded; a guard is
// a triangle, a camera a wedge, a laser a line by its state, a terminal, the
// file and the exit simple icons, and Natasha a filled chevron. Pure and hook-free.

const TILE = { '#': 'wall', R: 'block', C: 'block', '=': 'glass', d: 'desk' };
const pts = (list) => list.map((p) => p.join(',')).join(' ');

export default function GridView({ s, input, preview }) {
  const def = s.def;
  const tiles = [];
  for (let y = 0; y < def.h; y++)
    for (let x = 0; x < def.w; x++) {
      const kind = TILE[def.grid[y][x]] ?? 'floor';
      tiles.push(kind === 'desk' ? <rect key={`${x},${y}`} data-tile="desk" x={x - 0.35} y={y - 0.35} width="0.7" height="0.7" /> : <rect key={`${x},${y}`} data-tile={kind} x={x - 0.5} y={y - 0.5} width="1" height="1" />);
    }
  const targets = input?.biting ? biteTargets(s) : [];
  return (
    <svg className="iwf-grid" viewBox={viewBoxOf(def)} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Level ${s.index + 1}, ${def.name}, from above`}>
      {tiles}
      {s.guards.map((g) => (g.down || g.stun > 0 ? null : <polygon key={`gc${g.id}`} data-cone="guard" points={pts(visionPolygon(def, g.x, g.y, angleOf(g.dir), VISION))} />))}
      {s.cams.map((c) => {
        const cd = def.cameras[c.id];
        return c.off ? null : <polygon key={`cc${c.id}`} data-cone="camera" points={pts(visionPolygon(def, cd.x, cd.y, camAngle(def, s, c.id), CAMERA))} />;
      })}
      {def.lasers.map((l) => {
        const [[x1, y1], [x2, y2]] = laserLine(def, l);
        return <line key={`l${l.id}`} data-laser={laserState(def, l.id, s.t)} x1={x1} y1={y1} x2={x2} y2={y2} />;
      })}
      {def.terminals.map((t) => (
        <g key={`t${t.id}`} data-terminal="" data-used={s.terminals[t.id].used || undefined} transform={`translate(${t.x} ${t.y})`}>
          <rect x="-0.3" y="-0.22" width="0.6" height="0.44" />
          <line x1="-0.15" y1="0" x2="0.15" y2="0" />
        </g>
      ))}
      {!s.file && <path data-file="" d="M-0.22 -0.3 H0.1 L0.22 -0.18 V0.3 H-0.22 Z" transform={`translate(${def.file[0]} ${def.file[1]})`} />}
      <g data-exit="" data-open={s.file || undefined} transform={`translate(${def.exit[0]} ${def.exit[1]})`}>
        <rect x="-0.35" y="-0.35" width="0.7" height="0.7" />
        <line x1="0" y1="-0.35" x2="0" y2="0.35" />
      </g>
      {s.guards.map((g) => {
        const next = !g.down && g.stun === 0 ? intent(s, g) : null;
        const moves = next && (next.x !== g.x || next.y !== g.y || next.dir !== g.dir);
        return (
          <g key={`g${g.id}`}>
            {moves && <polygon data-intent="" points="0.38,0 -0.3,0.3 -0.3,-0.3" transform={`translate(${next.x} ${next.y}) rotate(${angleOf(next.dir)})`} />}
            <polygon data-guard="" data-down={g.down || undefined} data-stun={g.stun || undefined} points="0.38,0 -0.3,0.3 -0.3,-0.3" transform={`translate(${g.x} ${g.y}) rotate(${angleOf(g.dir)})`} />
            {Array.from({ length: g.stun }, (_, i) => (
              <circle key={i} cx={g.x - 0.2 + i * 0.14} cy={g.y - 0.42} r="0.06" />
            ))}
          </g>
        );
      })}
      {def.cameras.map((c) => (
        <path key={`k${c.id}`} data-camera="" data-off={s.cams[c.id].off || undefined} d="M0 0 L0.4 -0.17 A0.44 0.44 0 0 1 0.4 0.17 Z" transform={`translate(${c.x} ${c.y}) rotate(${camAngle(def, s, c.id)})`} />
      ))}
      {targets.map((b) => (
        <circle key={`b${b.guard.id}`} data-target="" r="0.48" fill="none" cx={b.guard.x} cy={b.guard.y} />
      ))}
      {preview && <rect data-preview={preview.danger ? 'danger' : 'safe'} x={preview.x - 0.45} y={preview.y - 0.45} width="0.9" height="0.9" />}
      <polygon data-player="" points="0.4,0 -0.3,0.32 -0.12,0 -0.3,-0.32" fill="var(--hq-accent)" transform={`translate(${s.px} ${s.py}) rotate(${angleOf(s.face)})`} />
    </svg>
  );
}
