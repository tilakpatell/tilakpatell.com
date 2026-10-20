// The companies’ switch-in marks (ThemeTransition.jsx): each drawn once in
// the company’s light over its own dark, from its quiet background
// (ambience/motifs.css): AWS’s smile, RTX’s drafting corners, a ring of Bose
// sound, Pendar’s laser split into its spectrum, Empowerreg’s graph lighting
// node by node, SRC’s radar sweep. Strokes are drawn by their dash, so nothing
// is redrawn but a line’s length; the visitor’s own colour gets a colour wheel
// that settles on theirs. The styles are themetransition.css’s.

const SPECTRUM = ['#6a4cff', '#2f8cff', '#18c6d6', '#34d27a', '#d9d23a', '#ff9a3a', '#ff4a5a'];
const NODES = [
  [18, 44],
  [52, 16],
  [78, 50],
  [110, 22],
  [138, 46],
  [154, 14],
];
const LINKS = [
  [0, 1],
  [1, 2],
  [1, 3],
  [2, 3],
  [3, 4],
  [4, 5],
  [3, 5],
];

export default function CompanyMark({ id }) {
  if (id === 'aws')
    return (
      <svg className="tt-mark" data-mark="aws" viewBox="0 0 160 64" aria-hidden="true">
        <path className="tt-draw" pathLength="1" d="M12 26 Q80 64 146 24" />
        <path className="tt-draw tt-late" pathLength="1" d="M131 18 L148 23 L141 39" />
      </svg>
    );
  if (id === 'rtx')
    return (
      <svg className="tt-mark" data-mark="rtx" viewBox="0 0 160 64" aria-hidden="true">
        {['M2 18V2H18', 'M142 2H158V18', 'M158 46V62H142', 'M18 62H2V46'].map((d, i) => (
          <path key={d} className="tt-snap" style={{ '--i': i }} d={d} />
        ))}
        <path className="tt-draw tt-thin" pathLength="1" d="M28 32H132" />
      </svg>
    );
  if (id === 'bose')
    return (
      <svg className="tt-mark" data-mark="bose" viewBox="0 0 160 64" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <circle key={i} className="tt-ring-out" style={{ '--i': i }} cx="80" cy="32" r="22" />
        ))}
      </svg>
    );
  if (id === 'pendar')
    return (
      <svg className="tt-mark" data-mark="pendar" viewBox="0 0 160 64" aria-hidden="true">
        <path className="tt-draw tt-thin" pathLength="1" d="M4 32H156" />
        {SPECTRUM.map((c, i) => (
          <circle key={c} className="tt-dot" style={{ '--i': i, fill: c }} cx={20 + i * 20} cy="32" r="5" />
        ))}
      </svg>
    );
  if (id === 'empowerreg')
    return (
      <svg className="tt-mark" data-mark="empowerreg" viewBox="0 0 160 64" aria-hidden="true">
        {LINKS.map(([a, b], i) => (
          <path key={`${a}-${b}`} className="tt-draw tt-thin" pathLength="1" style={{ '--i': i }} d={`M${NODES[a].join(' ')}L${NODES[b].join(' ')}`} />
        ))}
        {NODES.map(([x, y], i) => (
          <circle key={`${x}-${y}`} className={`tt-dot${i === 3 ? ' tt-lit' : ''}`} style={{ '--i': i }} cx={x} cy={y} r={i === 3 ? 7 : 5} />
        ))}
      </svg>
    );
  if (id === 'src')
    return (
      <svg className="tt-mark" data-mark="src" viewBox="0 0 160 64" aria-hidden="true">
        <circle className="tt-thin" cx="80" cy="32" r="29" />
        <circle className="tt-thin tt-faint" cx="80" cy="32" r="16" />
        <path className="tt-sweep-arm" d="M80 32 L80 3 A29 29 0 0 1 105 17.5 Z" />
        <circle className="tt-dot tt-blip" cx="98" cy="22" r="3.5" />
      </svg>
    );
  return null;
}

export function ColourWheel({ color }) {
  return <span className="tt-wheel" aria-hidden="true" style={{ '--c': color }} />;
}
