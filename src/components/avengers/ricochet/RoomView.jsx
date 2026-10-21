import { SHIELD, botAt } from './rules';
import { discAt, pointsOf, previewPath, thrownAt, viewBox } from './flatInput';

// A Ricochet room from above (spec 2026-10-18-avengers-hq-fix-and-hub-design,
// §8): abstract markers only, in metres as the SVG's units. Steel is a solid
// line, a mat a hatched band, glass a dashed line, a door a line with a
// toggle, a switch a small toggle; a bot is a square, an armoured one two, the
// hostage an open circle; Cap is a chevron turned to the aim, and the shield a
// plain disc. Pure and hook-free: the 2D view writes the moving parts (the
// disc, the patrols, the chevron, the preview) straight to its attributes.

// a band 0.3 m wide along a–b (a mat)
const band = ([ax, az], [bx, bz]) => {
  const len = Math.hypot(bx - ax, bz - az) || 1;
  const nx = (-(bz - az) / len) * 0.15;
  const nz = ((bx - ax) / len) * 0.15;
  return [
    [ax + nx, az + nz],
    [bx + nx, bz + nz],
    [bx - nx, bz - nz],
    [ax - nx, az - nz],
  ]
    .map((p) => p.join(','))
    .join(' ');
};

function Wall({ w }) {
  const [[x1, y1], [x2, y2]] = [w.a, w.b];
  if (w.kind === 'mat') return <polygon data-wall="mat" fill="url(#rf-hatch)" points={band(w.a, w.b)} />;
  if (w.kind === 'glass') return w.broken ? null : <line data-wall="glass" strokeDasharray="0.5 0.3" x1={x1} y1={y1} x2={x2} y2={y2} />;
  if (w.kind === 'door') {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    return (
      <g>
        <line data-wall="door" data-open={w.open || undefined} x1={x1} y1={y1} x2={x2} y2={y2} />
        <rect data-toggle="" data-on={w.open || undefined} x={mx - 0.18} y={my - 0.18} width="0.36" height="0.36" />
      </g>
    );
  }
  return <line data-wall="steel" x1={x1} y1={y1} x2={x2} y2={y2} />;
}

function Bot({ b, t }) {
  const [x, z] = botAt(b, t);
  const down = b.down || undefined;
  let marker;
  if (b.kind === 'hostage') marker = <circle data-bot="hostage" data-down={down} r="0.45" fill="none" />;
  else if (b.kind === 'armored')
    marker = (
      <g data-bot="armored" data-down={down}>
        {b.dents < 1 && <rect x="-0.45" y="-0.45" width="0.9" height="0.9" />}
        <rect x="-0.3" y="-0.3" width="0.6" height="0.6" />
      </g>
    );
  else marker = <rect data-bot="bot" data-down={down} x="-0.45" y="-0.45" width="0.9" height="0.9" />;
  return (
    <g data-patrol={b.patrol ? b.key : undefined} transform={`translate(${x} ${z})`}>
      {marker}
    </g>
  );
}

export default function RoomView({ room, angle, assist }) {
  // one rect a pillar, under its walls
  const pillars = [...new Map(room.walls.filter((w) => w.box).map((w) => [w.box.join(','), w.box])).values()];
  const disc = discAt(room.flight);
  const cap = room.def.cap;
  return (
    <svg className="rf-room" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Room ${room.index + 1}, ${room.def.name}, from above`}>
      <defs>
        <pattern id="rf-hatch" patternUnits="userSpaceOnUse" width="0.3" height="0.3" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="0.3" />
        </pattern>
      </defs>
      <rect className="rf-floor" x="-8" y="-6" width="16" height="12" />
      {pillars.map(([x0, z0, x1, z1]) => (
        <rect key={`${x0},${z0}`} data-pillar="" x={x0} y={z0} width={x1 - x0} height={z1 - z0} />
      ))}
      {room.walls.map((w) => (
        <Wall key={w.key} w={w} />
      ))}
      {room.switches.map((s) => (
        <g key={s.key} data-switch="" data-on={s.on || undefined} transform={`translate(${s.x} ${s.z})`}>
          <rect x="-0.4" y="-0.22" width="0.8" height="0.44" rx="0.22" />
          <circle cx={s.on ? 0.2 : -0.2} cy="0" r="0.16" />
        </g>
      ))}
      {room.bots.map((b) => (
        <Bot key={b.key} b={b} t={room.t} />
      ))}
      <polyline data-preview="" points={pointsOf(previewPath(room, angle, assist))} fill="none" />
      <polygon data-thrower="" points="0,-0.6 0.45,0.35 0,0.1 -0.45,0.35" transform={thrownAt(cap, angle)} />
      <circle data-disc="" r={SHIELD.r} fill="var(--hq-accent)" cx={disc ? disc[0] : cap[0]} cy={disc ? disc[1] : cap[1]} visibility={disc ? undefined : 'hidden'} />
    </svg>
  );
}
