import '../../styles/lazy/worlds.css';
// Background art for the fan worlds, drawn in SVG so it takes each theme’s
// colours and costs nothing to load: Middle-earth (the Shire at golden hour or
// on a summer night, Mordor under ash or under fire) and the skyline of Cybertron.

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Middle-earth draws its land as crests, y for every x, so a hedge, a door or a
// fence stands exactly on the hill it belongs to.
const f1 = (n) => Math.round(n * 10) / 10;
const swell = (base, waves) => (x) => waves.reduce((y, [a, len, phase]) => y + a * Math.sin((x / len) * Math.PI * 2 + phase), base);
function line(crest, from = 0, to = 1440, step = 12) {
  let d = `M${from} ${f1(crest(from))}`;
  for (let x = from + step; x < to + step; x += step) d += ` L${Math.min(x, to)} ${f1(crest(Math.min(x, to)))}`;
  return d;
}
const land = (crest, from = 0, to = 1440) => `M${from} 360 L${line(crest, from, to).slice(1)} L${to} 360 Z`;
// mountains by midpoint displacement, so a range has crags and saddles, not a saw
function crags(rand, base, h, rough = 0.5) {
  let pts = Array.from({ length: 9 }, (_, i) => [i * 180, base - h * (0.25 + rand() * 0.75)]);
  for (let k = 0, amp = h * 0.45; k < 4; k++, amp *= rough) {
    pts = pts.flatMap((p, i) => (pts[i + 1] ? [p, [(p[0] + pts[i + 1][0]) / 2, (p[1] + pts[i + 1][1]) / 2 + (rand() - 0.5) * 2 * amp]] : [p]));
  }
  return `M0 360 ${pts.map(([x, y]) => `L${f1(x)} ${f1(Math.min(y, base + 4))}`).join(' ')} L1440 360 Z`;
}
// a row of round bushes standing on a crest, as one path
function hedge(crest, from, to, r) {
  let d = `M${from} ${f1(crest(from) + r)} L${from} ${f1(crest(from))}`;
  for (let x = from; x < to; x += r * 1.7) d += ` A${r} ${r} 0 0 1 ${f1(x + r * 1.7)} ${f1(crest(x + r * 1.7))}`;
  return `${d} L${f1(to + r)} ${f1(crest(to) + r)} Z`;
}
// many small circles as one path, so a bed of flowers or a sky of stars is one element
const dots = (list) => list.map(([x, y, r]) => `M${f1(x - r)} ${f1(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`).join('');
// a soft round glow: a radial gradient from a colour at `o` to nothing
function Glow({ id, color, o = 1 }) {
  return (
    <radialGradient id={id}>
      <stop offset="0" stopColor={color} stopOpacity={o} />
      <stop offset="0.45" stopColor={color} stopOpacity={o * 0.45} />
      <stop offset="1" stopColor={color} stopOpacity="0" />
    </radialGradient>
  );
}
// The page’s own colour laid over the land behind the hero’s words, from its
// buttons down: a mist thick enough that the muted line under the buttons
// (which falls in x 120–610, y 160–300 at every width) still reads at 4.5:1,
// thinning out before the Hill, Doom and the tower, and leaving the sky and the
// far land whole. The dark needs less of it (worlds.css).
function Wash({ id }) {
  return (
    <>
      <linearGradient id={`${id}-x`} x1="0" y1="0" x2="820" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="var(--bg)" stopOpacity="0.92" />
        <stop offset="0.74" stopColor="var(--bg)" stopOpacity="0.82" />
        <stop offset="1" stopColor="var(--bg)" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${id}-y`} x1="0" y1="140" x2="0" y2="180" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="white" stopOpacity="0" />
        <stop offset="1" stopColor="white" />
      </linearGradient>
      <mask id={`${id}-top`}>
        <rect y="140" width="820" height="220" fill={`url(#${id}-y)`} />
      </mask>
      <rect y="140" width="820" height="220" fill={`url(#${id}-x)`} mask={`url(#${id}-top)`} className="me-wash" />
    </>
  );
}

// A round door: a stone ring, planks clipped to a circle, a strap hinge and a
// brass knob dead centre.
function RoundDoor({ x, y, id }) {
  const planks = Array.from({ length: 7 }, (_, i) => -20 + (i * 40) / 7);
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-30 27 H30 L26 33 H-26 Z" fill="var(--me-tick)" />
      <circle r="26" fill="var(--me-stone)" />
      <path d={Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2).map((a) => `M${f1(Math.cos(a) * 21)} ${f1(Math.sin(a) * 21)} L${f1(Math.cos(a) * 26)} ${f1(Math.sin(a) * 26)}`).join('')} stroke="var(--me-tick)" strokeWidth="1.2" />
      <clipPath id={id}>
        <circle r="20.5" />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        {planks.map((px, i) => (
          <rect key={i} x={f1(px)} y="-21" width={f1(40 / 7 + 0.2)} height="42" fill={i % 2 ? 'var(--me-plank-2)' : 'var(--me-plank)'} />
        ))}
        <path d={planks.slice(1).map((px) => `M${f1(px)} -21 V21`).join('')} stroke="var(--me-seam)" strokeWidth="0.8" />
        <circle r="20.5" fill="none" stroke="var(--me-seam)" strokeWidth="2.4" />
      </g>
      <path d="M-19.5 -7 H-5 M-19.5 7 H-5" stroke="var(--me-iron)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M-5 -7 c2.4 0 2.4 -2.6 0.4 -2.6 M-5 7 c2.4 0 2.4 2.6 0.4 2.6" fill="none" stroke="var(--me-iron)" strokeWidth="1.2" strokeLinecap="round" />
      <circle r="3.3" fill="var(--me-knob)" />
      <circle cx="-0.9" cy="-0.9" r="1.2" fill="var(--me-knob-hi)" />
    </g>
  );
}

// A chimney’s thread of smoke, leaning east as it thins; its dashes drift up
// (and hold still under reduced motion).
function Smoke({ id, x, y, h, w = 2 }) {
  const d = `M${x} ${y} c-5 ${f1(-h * 0.2)} 6 ${f1(-h * 0.3)} 2 ${f1(-h * 0.5)} s-3 ${f1(-h * 0.32)} 13 ${f1(-h * 0.5)}`;
  return (
    <>
      <linearGradient id={id} x1="0" y1={y} x2="0" y2={f1(y - h)} gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="var(--me-smoke)" stopOpacity="0.85" />
        <stop offset="1" stopColor="var(--me-smoke)" stopOpacity="0" />
      </linearGradient>
      <g fill="none" stroke={`url(#${id})`} strokeLinecap="round">
        <path d={d} strokeWidth={w * 3} opacity="0.25" />
        <path d={d} strokeWidth={w} className="me-smoke" />
      </g>
    </>
  );
}

// The Shire: the low sun (or the moon) over the downs, the Party Tree by its
// pond with the bridge and the mill, hedged hills with small round doors, and
// the Hill with its oak, its door, its window and its garden. The Hill stands
// between the hero’s words and its photo, inside the slice a phone keeps
// (x 300–1140); the land behind the words is misted toward the page.
function Shire() {
  const rand = rng(1937);
  const far = swell(184, [[5, 520, 0.4], [3, 230, 2.1]]);
  // the mid hills dip under the pond, the bridge and the mill, so the far downs show them
  const rolling = swell(204, [[7, 460, 1.3], [3, 190, 0.2]]);
  const mid = (x) => rolling(x) + 16 * Math.exp(-(((x - 1220) / 130) ** 2));
  const near = swell(226, [[6, 400, 2.4], [3, 170, 1.1]]);
  const ground = swell(258, [[3, 640, 0.9]]);
  const hill = (x) => ground(x) - 110 * Math.exp(-(((x - 822) / 158) ** 2));
  const tree = far(1150);
  const stars = Array.from({ length: 18 }, () => [300 + rand() * 1120, 20 + rand() * 120, 0.7 + rand() * 0.6]);
  const bed = (cx, cy, w, h, n) => Array.from({ length: n }, () => [cx + (rand() - 0.5) * w, cy + rand() * h, 1.1 + rand() * 1.1]);
  const flowers = [
    ...bed(778, 238, 40, 9, 12), ...bed(872, 236, 52, 10, 13),
    ...bed(740, ground(740) + 4, 128, 6, 16), ...bed(906, ground(906) + 4, 124, 6, 16),
    ...bed(598, near(598) + 13, 18, 4, 5), ...bed(1124, near(1124) + 13, 18, 4, 5), ...bed(1204, near(1204) + 13, 18, 4, 5),
  ].filter(([x, y]) => !(x > 810 && x < 838 && y > 236));
  // lit windows only east of the Hill: behind the words a lamp would sit in a letter
  const windows = Array.from({ length: 10 }, () => {
    const x = 1040 + rand() * 380;
    return [x, (rand() > 0.5 ? near(x) : mid(x)) + 5 + rand() * 6, 1.3 + rand() * 0.8];
  });
  const doors = [[586, near], [1112, near], [1192, near], [1296, mid]];
  const lanterns = Array.from({ length: 9 }, (_, i) => [1128 + i * 5.5, tree - 33 + Math.sin((i / 8) * Math.PI) * 7, 1.3]);
  const posts = [];
  for (let x = 676; x <= 970; x += 6.5) if (x < 807 || x > 841) posts.push(f1(x));
  const rail = (dy) => `M674 ${f1(ground(674) + dy)} L808 ${f1(ground(808) + dy)} M840 ${f1(ground(840) + dy)} L972 ${f1(ground(972) + dy)}`;
  return (
    <>
      <defs>
        <linearGradient id="me-shire-sky" x1="0" y1="0" x2="0" y2="230" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--me-sky-mid)" stopOpacity="0" />
          <stop offset="0.55" stopColor="var(--me-sky-mid)" />
          <stop offset="0.9" stopColor="var(--me-sky-low)" />
        </linearGradient>
        <Glow id="me-shire-sun" color="var(--me-glow)" o={0.95} />
        <Glow id="me-shire-lamp" color="var(--me-pane)" o={0.6} />
        <Glow id="me-shire-halo" color="var(--me-moon)" o={0.22} />
        {/* moonlight along the Hill’s crest, gone before it meets the land */}
        <linearGradient id="me-shire-rim" x1="562" y1="0" x2="1082" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--me-rim)" stopOpacity="0" />
          <stop offset="0.25" stopColor="var(--me-rim)" />
          <stop offset="0.75" stopColor="var(--me-rim)" />
          <stop offset="1" stopColor="var(--me-rim)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="me-shire-hill" cx="0.36" cy="0.1" r="0.75">
          <stop offset="0" stopColor="var(--me-hill-hi)" />
          <stop offset="1" stopColor="var(--me-hill)" />
        </radialGradient>
        {[['mid', 196], ['near', 220], ['ground', 252]].map(([k, y]) => (
          <linearGradient key={k} id={`me-shire-${k}`} x1="0" y1={y} x2="0" y2={y + 60} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={`var(--me-${k}-hi)`} />
            <stop offset="1" stopColor={`var(--me-${k})`} />
          </linearGradient>
        ))}
      </defs>
      <rect width="1440" height="240" fill="url(#me-shire-sky)" />
      <g className="me-day">
        <circle cx="590" cy="172" r="300" fill="url(#me-shire-sun)" />
        <circle cx="590" cy="166" r="17" fill="var(--me-sun)" />
      </g>
      <g className="me-night">
        <path d={dots(stars.slice(3))} fill="var(--me-star)" opacity="0.75" />
        {stars.slice(0, 3).map(([x, y, r], i) => (
          <circle key={i} cx={f1(x)} cy={f1(y)} r={f1(r + 0.3)} fill="var(--me-star)" className="me-twinkle" style={{ animationDelay: `${-i * 2.7}s` }} />
        ))}
        <circle cx="1386" cy="116" r="64" fill="url(#me-shire-halo)" />
        <path d="M1394 101 a16 16 0 1 0 6 28 a13 13 0 1 1 -6 -28 Z" fill="var(--me-moon)" />
      </g>
      <path d={land(swell(176, [[9, 300, 0.2], [5, 130, 1.7]]))} fill="var(--me-peaks)" />
      <path d={land(far)} fill="var(--me-far)" />
      {/* the Party Tree by its pond, the bridge over the stream and the mill */}
      <ellipse cx="1150" cy={f1(tree + 9)} rx="42" ry="4.5" fill="var(--me-water)" />
      <path d={`M1128 ${f1(tree + 8)} h26`} stroke="var(--me-glint)" strokeWidth="1" opacity="0.8" />
      <path d={`M1150 ${f1(tree + 3)} v-16`} stroke="var(--me-trunk)" strokeWidth="2.8" />
      <ellipse cx="1150" cy={f1(tree - 17)} rx="24" ry="10" fill="var(--me-tree)" />
      <ellipse cx="1150" cy={f1(tree - 29)} rx="19" ry="9" fill="var(--me-tree)" />
      <ellipse cx="1150" cy={f1(tree - 40)} rx="12" ry="8" fill="var(--me-tree)" />
      <ellipse cx="1144" cy={f1(tree - 42)} rx="6" ry="4" fill="var(--me-tree-hi)" opacity="0.6" className="me-day" />
      <g className="me-night">
        <path d={`M1126 ${f1(tree - 33)} Q1150 ${f1(tree - 19)} 1174 ${f1(tree - 33)}`} fill="none" stroke="var(--me-tree-hi)" strokeWidth="0.5" />
        {[1, 2, 3].map((k) => (
          <path key={k} d={dots(lanterns.filter((_, i) => i % 3 === k - 1))} fill={`var(--me-lantern-${k})`} />
        ))}
      </g>
      <path d={`M1196 ${f1(far(1236) + 12)} Q1236 ${f1(far(1236) + 8)} 1278 ${f1(far(1236) + 13)}`} stroke="var(--me-water)" strokeWidth="3" fill="none" />
      <path d={`M1210 ${f1(far(1236) + 13)} L1210 ${f1(far(1236) + 3)} Q1236 ${f1(far(1236) - 3)} 1262 ${f1(far(1236) + 3)} L1262 ${f1(far(1236) + 13)} L1256 ${f1(far(1236) + 13)} a7 7 0 0 0 -14 0 h-12 a7 7 0 0 0 -14 0 Z`} fill="var(--me-mill)" />
      <g transform={`translate(1310 ${f1(far(1310) - 1)})`}>
        <path d="M-12 4 V-12 L0 -21 L12 -12 V4 Z" fill="var(--me-mill)" />
        <path d="M-14 -11 L0 -23 L14 -11" fill="none" stroke="var(--me-tick)" strokeWidth="2" />
        <path d="M-3 4 v-6 h5 v6" fill="var(--me-tick)" />
        <circle cx="-14" cy="-3" r="8" fill="none" stroke="var(--me-tick)" strokeWidth="1" />
        <path d={Array.from({ length: 4 }, (_, i) => (i * Math.PI) / 4).map((a) => `M${f1(-14 + Math.cos(a) * 8)} ${f1(-3 + Math.sin(a) * 8)} L${f1(-14 - Math.cos(a) * 8)} ${f1(-3 - Math.sin(a) * 8)}`).join('')} stroke="var(--me-tick)" strokeWidth="0.5" />
      </g>
      <path d={land(mid)} fill="url(#me-shire-mid)" />
      <path d={hedge(mid, 980, 1440, 4)} fill="var(--me-hedge)" opacity="0.55" />
      <path d={land(near)} fill="url(#me-shire-near)" />
      <path d={hedge(near, 0, 1440, 5.5)} fill="var(--me-hedge)" />
      {/* small round doors in the hills, each with its chimney */}
      <g className="me-burrows">
        {doors.map(([x, crest], i) => {
          const small = crest === mid;
          const y = crest(x) + (small ? 7 : 10);
          const r = small ? 2.6 : 3.6;
          return (
            <g key={x}>
              <rect x={f1(x + r * 2.2)} y={f1(crest(x + r * 2.2) - r * 1.6)} width={f1(r * 0.8)} height={f1(r * 1.8)} fill="var(--me-tick)" />
              <circle cx={x} cy={f1(y)} r={f1(r + 0.9)} fill="var(--me-stone)" />
              <circle cx={x} cy={f1(y)} r={r} fill={`var(--me-burrow-${i + 1})`} />
            </g>
          );
        })}
      </g>
      <Smoke id="me-shire-smoke-a" x={1121} y={f1(near(1121) - 6)} h={62} w={1.6} />
      <path d={dots(windows)} fill="var(--me-pane)" className="me-night" />
      {/* the Hill: its oak, its chimney, its door and its round window */}
      <path d={land(hill, 462, 1182)} fill="url(#me-shire-hill)" />
      <path d={line(hill, 562, 1082)} fill="none" stroke="url(#me-shire-rim)" strokeWidth="1" />
      <path d={`M846 ${f1(hill(846) + 3)} v-24 M846 ${f1(hill(846) - 9)} l-11 -10 M846 ${f1(hill(846) - 13)} l12 -9`} stroke="var(--me-trunk)" strokeWidth="3.4" strokeLinecap="round" />
      <path d={dots([[815, 128, 15], [833, 116, 19], [857, 112, 19], [878, 124, 15], [826, 137, 14], [849, 131, 19], [873, 138, 12]])} fill="var(--me-oak)" />
      <path d={dots([[813, 124, 8], [830, 111, 10], [852, 106, 9]])} fill="var(--me-oak-hi)" />
      <rect x="780" y={f1(hill(784) - 12)} width="9" height="16" fill="var(--me-stone)" />
      <rect x="778" y={f1(hill(784) - 14)} width="13" height="3" fill="var(--me-tick)" />
      <Smoke id="me-shire-smoke-b" x={784} y={f1(hill(784) - 16)} h={84} />
      <g className="me-night">
        <circle cx="823" cy="214" r="54" fill="url(#me-shire-lamp)" />
        <circle cx="874" cy="204" r="34" fill="url(#me-shire-lamp)" />
        <circle cx="788" cy="216" r="24" fill="url(#me-shire-lamp)" />
      </g>
      <RoundDoor x={823} y={212} id="me-shire-door" />
      <g transform="translate(874 204)">
        <circle r="10" fill="var(--me-frame)" />
        <circle r="7.6" fill="var(--me-pane)" />
        <path d="M-7.6 0 H7.6 M0 -7.6 V7.6" stroke="var(--me-frame)" strokeWidth="1.4" />
      </g>
      {/* the lamp on its post beside the step */}
      <path d="M788 246 V221 M785 221 h6" stroke="var(--me-iron)" strokeWidth="1.4" />
      <path d="M785.4 220 V213 L788 211 L790.6 213 V220 Z" fill="var(--me-lamp)" stroke="var(--me-iron)" strokeWidth="0.8" />
      <path d={land(ground)} fill="url(#me-shire-ground)" />
      {/* the road from the step, down through the gate and away */}
      <path d="M823 246 C820 256 814 264 830 274 S922 296 966 360" fill="none" stroke="var(--me-road)" strokeWidth="2.2" strokeDasharray="6 5" opacity="0.65" />
      {/* the garden: its picket fence, the gate left open, and the flowers */}
      <path d={rail(-3) + rail(-7.5)} stroke="var(--me-fence)" strokeWidth="1" />
      <path d={posts.map((x) => `M${x} ${f1(ground(x) + 1)} V${f1(ground(x) - 9)} l1.1 -2.2 l1.1 2.2 V${f1(ground(x) + 1)} Z`).join('')} fill="var(--me-fence)" />
      <path d={`M808 ${f1(ground(808) + 1)} v-13 h2.2 v13 Z M838 ${f1(ground(838) + 1)} v-13 h2.2 v13 Z`} fill="var(--me-fence)" />
      <g className="me-day">
        {[1, 2, 3].map((k) => (
          <path key={k} d={dots(flowers.filter((_, i) => i % 3 === k - 1))} fill={`var(--me-flower-${k})`} />
        ))}
      </g>
      <g className="me-night">
        {[[722, 228], [966, 236], [910, 214], [652, 246], [1030, 252], [762, 262]].map(([x, y], i) => (
          <circle key={x} cx={x} cy={y} r="1.5" fill="var(--me-firefly)" className="me-twinkle" style={{ animationDelay: `${-i * 1.3}s`, animationDuration: '5s' }} />
        ))}
      </g>
      <Wash id="me-shire-wash" />
    </>
  );
}

// The almond Eye: its iris, its slit, its lashes of flame.
function Eye({ x, y, rand }) {
  const lashes = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const l = 1.35 + rand() * 0.5;
    return `M${f1(Math.cos(a) * 12)} ${f1(Math.sin(a) * 5.5)} Q${f1(Math.cos(a + 0.2) * 15 * l)} ${f1(Math.sin(a + 0.2) * 7.5 * l)} ${f1(Math.cos(a + 0.1) * 17 * l)} ${f1(Math.sin(a + 0.1) * 9 * l)}`;
  });
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="36" fill="url(#me-mordor-eyeglow)" className="me-day" />
      <circle r="16" fill="var(--me-fire)" filter="url(#me-mordor-blur)" className="me-night" />
      <g className="me-eye">
        <path d={lashes.join('')} fill="none" stroke="var(--me-lash)" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M-12.5 0 Q0 -7.5 12.5 0 Q0 7.5 -12.5 0 Z" fill="url(#me-mordor-iris)" />
        <ellipse rx="1" ry="5" fill="var(--me-slit)" />
      </g>
    </g>
  );
}

// Barad-dûr: tiers stepping in as they rise, a spike at every ledge, fins
// rooting the lower three, and two horns curling in round the Eye.
function tower(cx, base) {
  const tiers = [[46, 234], [37, 210], [29, 188], [22, 169], [15, 153]];
  let left = `${cx - 48} ${base}`;
  tiers.forEach(([w, top], i) => {
    left += ` L${cx - w - 1} ${top + 6} L${cx - w - 2.5} ${top - 7} L${cx - w + 1.5} ${top} L${cx - (tiers[i + 1]?.[0] ?? 1)} ${top}`;
  });
  const half = left.split(' L');
  const right = half.map((p) => p.split(' ')).reverse().map(([px, py]) => `${f1(2 * cx - Number(px))} ${py}`);
  const fins = tiers.slice(0, 3).map(([w, top], i) => `M${cx - w} ${top + 3} L${cx - w} ${base} L${cx - w - 16 - i * 9} ${base} Z M${cx + w} ${top + 3} L${cx + w + 16 + i * 9} ${base} L${cx + w} ${base} Z`);
  const horns = `M${cx - 15} 153 C${cx - 23} 139 ${cx - 20} 117 ${cx - 6} 106 C${cx - 13} 119 ${cx - 13} 137 ${cx - 7} 153 Z M${cx + 7} 153 C${cx + 13} 137 ${cx + 13} 119 ${cx + 6} 106 C${cx + 20} 117 ${cx + 23} 139 ${cx + 15} 153 Z`;
  return `M${half.join(' L')} L${right.join(' L')} Z ${fins.join(' ')} ${horns}`;
}

// The Black Gate: a wall spiked along the top, a tower at each end (battered,
// corbelled and crowned with thorns, not roofed like a castle in a story
// book), and the two iron leaves of the gate between them, riveted.
function gate(x0, top) {
  let wall = `M${x0} 268 V${top}`;
  for (let x = x0; x < 1446; x += 9) wall += ` l4.5 -6 l4.5 6`;
  wall += ' V268 Z';
  const keep = (cx, t) =>
    `M${cx - 22} 268 L${cx - 15} ${t + 14} L${cx - 19} ${t + 8} V${t} L${cx - 17} ${t - 14} L${cx - 12} ${t} H${cx - 4} L${cx} ${t - 22} L${cx + 4} ${t} H${cx + 12} L${cx + 17} ${t - 14} L${cx + 19} ${t} V${t + 8} L${cx + 15} ${t + 14} L${cx + 22} 268 Z`;
  return `${wall} ${keep(x0 + 24, top - 46)} ${keep(1416, top - 42)}`;
}

// Mordor: the sky glowing behind Mount Doom, its smoke trailing east,
// Barad-dûr and the Eye beside it, the ash plain, the Black Gate and the rocks
// in front. Doom and the tower stand between the hero’s words and its photo.
function Mordor() {
  const rand = rng(1066);
  const plain = swell(258, [[2, 560, 0.6]]);
  const motes = Array.from({ length: 14 }, () => [320 + rand() * 820, 60 + rand() * 190, 0.8 + rand() * 1.1, 7 + rand() * 5, rand() * 10]);
  const leaves = [];
  for (let y = 226; y < 266; y += 10) for (let x = 1272; x < 1352; x += 10) if (Math.abs(x - 1311) > 3) leaves.push([x, y, 1.2]);
  const plume = [[715, 110, 28, 16], [747, 94, 46, 21], [807, 80, 72, 25], [897, 70, 102, 28], [1025, 64, 140, 30], [1185, 62, 170, 28]];
  return (
    <>
      <defs>
        <linearGradient id="me-mordor-sky" x1="0" y1="0" x2="0" y2="236" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--me-sky-top)" stopOpacity="0" />
          <stop offset="0.38" stopColor="var(--me-sky-top)" />
          <stop offset="0.68" stopColor="var(--me-sky-mid)" />
          <stop offset="0.95" stopColor="var(--me-sky-low)" />
        </linearGradient>
        <Glow id="me-mordor-glow" color="var(--me-glow)" o={0.6} />
        <Glow id="me-mordor-heat" color="var(--me-heat)" o={0.45} />
        <Glow id="me-mordor-crater" color="var(--me-crater)" o={0.9} />
        <Glow id="me-mordor-eyeglow" color="var(--me-fire)" o={0.34} />
        <Glow id="me-mordor-smoke" color="var(--me-smoke)" o={0.9} />
        <Glow id="me-mordor-smoke-lit" color="var(--me-smoke-lit)" o={0.8} />
        <radialGradient id="me-mordor-iris">
          <stop offset="0" stopColor="var(--me-iris-0)" />
          <stop offset="0.5" stopColor="var(--me-iris-1)" />
          <stop offset="1" stopColor="var(--me-iris-2)" />
        </radialGradient>
        <linearGradient id="me-mordor-lava" x1="703" y1="140" x2="603" y2="262" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--me-lava-0)" />
          <stop offset="0.45" stopColor="var(--me-lava-1)" />
          <stop offset="1" stopColor="var(--me-lava-2)" />
        </linearGradient>
        <linearGradient id="me-mordor-doom" x1="575" y1="0" x2="775" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--me-doom-hi)" />
          <stop offset="1" stopColor="var(--me-doom)" />
        </linearGradient>
        <linearGradient id="me-mordor-plain" x1="0" y1="250" x2="0" y2="320" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--me-plain-hi)" />
          <stop offset="1" stopColor="var(--me-plain)" />
        </linearGradient>
        {/* the one blur on the page, and only by night: the glow behind the Eye */}
        <filter id="me-mordor-blur" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <rect width="1440" height="250" fill="url(#me-mordor-sky)" />
      <ellipse cx="710" cy="216" rx="440" ry="130" fill="url(#me-mordor-glow)" />
      <ellipse cx="708" cy="160" rx="170" ry="80" fill="url(#me-mordor-heat)" />
      <path d={crags(rand, 214, 58)} fill="var(--me-ridge-far)" />
      <path d={crags(rand, 240, 34, 0.55)} fill="var(--me-ridge)" />
      {/* Mount Doom, its crater broken, seams of lava down its flank, its smoke trailing east */}
      <ellipse cx="709" cy="128" rx="46" ry="22" fill="url(#me-mordor-crater)" className="me-lava" />
      <path d="M515 262 C581 250 625 214 651 178 C661 164 668 150 675 140 L682 133 L689 139 L697 129 L706 141 L713 135 L723 126 L735 135 C747 154 765 182 795 208 C835 240 889 254 965 262 Z" fill="url(#me-mordor-doom)" />
      <path d="M682 133 L689 139 L697 129 L706 141 L713 135 L723 126" fill="none" stroke="var(--me-lava-0)" strokeWidth="1" opacity="0.7" className="me-lava" />
      <path d="M704 140 C697 158 702 170 687 186 S671 206 659 214 S637 232 625 246 S613 256 601 262 M687 187 C692 198 686 210 691 228" fill="none" stroke="var(--me-lava-1)" strokeWidth="6" strokeLinecap="round" opacity="var(--me-seam-glow)" className="me-lava" />
      <path d="M704 140 C697 158 702 170 687 186 S671 206 659 214 S637 232 625 246 S613 256 601 262 M687 187 C692 198 686 210 691 228" fill="none" stroke="url(#me-mordor-lava)" strokeWidth="1.8" strokeLinecap="round" />
      <g className="me-cloud">
        {plume.map(([cx, cy, rx, ry]) => (
          <g key={cx}>
            <ellipse cx={cx} cy={cy + ry * 0.45} rx={rx} ry={ry * 0.8} fill="url(#me-mordor-smoke-lit)" />
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#me-mordor-smoke)" />
          </g>
        ))}
      </g>
      {/* Barad-dûr, and the Eye between its horns */}
      <path d={tower(858, 262)} fill="var(--me-tower)" stroke="var(--me-rim)" strokeWidth="1.6" paintOrder="stroke" />
      <path d="M849 220 v7 M867 220 v7 M858 198 v6 M853 178 v5 M863 178 v5 M858 160 v4" stroke="var(--me-window)" strokeWidth="1.5" />
      <Eye x={858} y={127} rand={rand} />
      <path d={land(plain)} fill="url(#me-mordor-plain)" />
      <path d={gate(1176, 214)} fill="var(--me-gate)" stroke="var(--me-rim)" strokeWidth="1.2" paintOrder="stroke" />
      <path d="M1268 268 V222 H1311 V268 Z M1313 268 V222 H1356 V268 Z" fill="var(--me-gate-hi)" />
      <path d={dots(leaves)} fill="var(--me-rivet)" />
      <path d={crags(rand, 340, 40, 0.68)} fill="var(--me-teeth)" />
      <Wash id="me-mordor-wash" />
      {motes.map(([x, y, r, t, d]) => (
        <circle key={x} cx={f1(x)} cy={f1(y)} r={f1(r)} fill="var(--me-mote)" className="me-mote" style={{ animationDuration: `${f1(t)}s`, animationDelay: `${-f1(d)}s` }} />
      ))}
    </>
  );
}

export function MiddleEarth({ variant = 'shire', className = '' }) {
  return (
    <svg viewBox="0 0 1440 360" preserveAspectRatio="xMidYMax slice" className={`backdrop backdrop-me ${className}`} data-variant={variant} aria-hidden="true">
      {variant === 'mordor' ? <Mordor /> : <Shire />}
    </svg>
  );
}

// Cybertron: Aligned-style spires with lit bands of energon, and a jagged,
// Bay-style ridge of shards in front.
export function Cybertron({ faction = 'autobot', className = '' }) {
  const rand = rng(faction === 'decepticon' ? 4242 : 1984);
  const towers = [];
  for (let x = -20; x < 1460; ) {
    const w = 34 + rand() * 70;
    const h = 120 + rand() * 210;
    towers.push({ x, w, h, cap: rand() });
    x += w + 6 + rand() * 18;
  }
  const spires = Array.from({ length: 14 }, () => ({ x: rand() * 1440, h: 180 + rand() * 160, w: 10 + rand() * 18 }));
  let shard = 'M0 360 L0 320';
  for (let x = 0; x <= 1440; x += 36) shard += ` L${x + 10 + rand() * 16} ${300 - rand() * 60} L${x + 36} ${318 - rand() * 14}`;
  shard += ' L1440 360 Z';
  return (
    <svg viewBox="0 0 1440 360" preserveAspectRatio="xMidYMax slice" className={`backdrop backdrop-cy ${className}`} data-faction={faction} aria-hidden="true">
      <defs>
        <linearGradient id={`cy-glow-${faction}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--cy-light)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--cy-light)" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <rect width="1440" height="360" fill={`url(#cy-glow-${faction})`} />
      {spires.map((s, i) => (
        <path key={i} d={`M${s.x - s.w / 2} 360 L${s.x - s.w / 6} ${360 - s.h} L${s.x} ${340 - s.h} L${s.x + s.w / 6} ${360 - s.h} L${s.x + s.w / 2} 360 Z`} fill="var(--cy-far)" />
      ))}
      {towers.map((t, i) => {
        const top = 360 - t.h;
        const cap = t.cap > 0.6 ? `L${t.x + t.w * 0.5} ${top - 22} ` : t.cap > 0.3 ? `L${t.x + t.w * 0.2} ${top - 12} L${t.x + t.w * 0.8} ${top - 12} ` : '';
        return (
          <g key={i}>
            <path d={`M${t.x} 360 L${t.x} ${top} ${cap}L${t.x + t.w} ${top} L${t.x + t.w} 360 Z`} fill="var(--cy-mid)" />
            {Array.from({ length: Math.floor(t.h / 26) }, (_, k) => (
              <rect key={k} x={t.x + 5} y={top + 14 + k * 26} width={t.w - 10} height="2" fill="var(--cy-light)" opacity={((i + k) % 3 === 0 ? 0.85 : 0.25).toString()} className={(i + k) % 7 === 0 ? 'cy-blink' : undefined} />
            ))}
          </g>
        );
      })}
      <path d={shard} fill="var(--cy-near)" />
    </svg>
  );
}

// The right backdrop for the active theme, or nothing.
export function ThemeBackdrop({ theme, className = '' }) {
  if (theme === 'shire' || theme === 'mordor') return <MiddleEarth variant={theme} className={className} />;
  if (['optimus', 'bumblebee'].includes(theme)) return <Cybertron faction="autobot" className={className} />;
  if (['megatron', 'shockwave', 'soundwave'].includes(theme)) return <Cybertron faction="decepticon" className={className} />;
  return null;
}
