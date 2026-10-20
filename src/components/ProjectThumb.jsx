// Small static artwork for project cards — a still from each project's page.
const DMG = ['#9bbc0f', '#8bac0f', '#306230', '#0f380f'];

function GameBoyThumb() {
  return (
    <svg viewBox="0 0 160 100" className="h-full w-full">
      <rect x="54" y="6" width="52" height="88" rx="5" style={{ fill: '#c9c4bf' }} />
      <path d="M 106 80 Q 106 94 92 94 L 59 94 Q 54 94 54 89" style={{ fill: '#b8b2ac' }} />
      <rect x="59" y="12" width="42" height="36" rx="3" style={{ fill: '#5a5e6e' }} />
      <rect x="66" y="17" width="28" height="25" style={{ fill: DMG[0] }} />
      <rect x="66" y="37" width="28" height="5" style={{ fill: DMG[2] }} />
      <rect x="84" y="31" width="5" height="6" style={{ fill: DMG[3] }} />
      <rect x="71" y="29" width="4" height="8" style={{ fill: DMG[3] }} />
      <rect x="72" y="27" width="3" height="3" style={{ fill: DMG[2] }} />
      <rect x="78" y="22" width="4" height="4" style={{ fill: DMG[1], stroke: DMG[3], strokeWidth: 0.6 }} />
      <path d="M 63 64 h 9 M 67.5 59.5 v 9" style={{ stroke: '#2a2c33', strokeWidth: 3.2, strokeLinecap: 'round' }} />
      <circle cx="91" cy="62" r="3.4" style={{ fill: '#9b2257' }} />
      <circle cx="84" cy="66" r="3.4" style={{ fill: '#9b2257' }} />
    </svg>
  );
}

function GpuThumb() {
  const pos = [
    [44, 22],
    [96, 22],
    [96, 60],
    [44, 60],
  ];
  return (
    <svg viewBox="0 0 160 100" className="h-full w-full">
      <path d="M 54 31 H 106 V 69 H 54 Z" fill="none" style={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }} />
      {pos.map(([x, y], i) => (
        <rect key={i} x={x - 2} y={y - 2} width="24" height="22" rx="3" style={{ fill: 'var(--surface-2)', stroke: i === 2 ? 'var(--accent)' : 'var(--border-strong)' }} />
      ))}
      <circle cx="80" cy="31" r="3" style={{ fill: 'var(--accent)' }} />
      <circle cx="106" cy="50" r="3" style={{ fill: 'var(--accent)' }} />
      <rect x="128" y="38" width="20" height="24" rx="3" style={{ fill: 'none', stroke: 'var(--accent)' }} />
      <path d="M 132 46 h 12 M 132 52 h 8" style={{ stroke: 'var(--accent)' }} />
    </svg>
  );
}

function EditorThumb() {
  return (
    <svg viewBox="0 0 160 100" className="h-full w-full">
      <rect x="20" y="12" width="120" height="76" rx="5" style={{ fill: 'var(--bg-deep)', stroke: 'var(--border-strong)' }} />
      {[26, 36, 46, 56, 66, 76].map((y, i) => (
        <rect key={y} x={32 + (i % 3) * 6} y={y} width={[52, 70, 40, 58, 30, 46][i]} height="4" rx="2" style={{ fill: i === 1 ? 'var(--accent)' : 'var(--border-strong)' }} />
      ))}
      <rect x="104" y="34" width="2" height="12" style={{ fill: 'var(--accent)' }} />
      <rect x="80" y="54" width="2" height="12" style={{ fill: '#7cc8ff' }} />
    </svg>
  );
}

function MergeThumb() {
  return (
    <svg viewBox="0 0 160 100" className="h-full w-full">
      <path d="M 16 38 H 144" style={{ stroke: 'var(--border-strong)', strokeWidth: 2 }} />
      <path d="M 50 38 C 64 38, 64 66, 78 66 H 98 C 112 66, 112 38, 122 38" fill="none" style={{ stroke: 'var(--accent)', strokeWidth: 2 }} />
      {[28, 50, 136].map((x) => (
        <circle key={x} cx={x} cy="38" r="4.5" style={{ fill: 'var(--bg-deep)', stroke: 'var(--text)', strokeWidth: 2 }} />
      ))}
      {[80, 96].map((x) => (
        <circle key={x} cx={x} cy="66" r="4.5" style={{ fill: 'var(--bg-deep)', stroke: 'var(--accent)', strokeWidth: 2 }} />
      ))}
      <circle cx="122" cy="38" r="6" style={{ fill: 'var(--accent)' }} />
    </svg>
  );
}

function PromptThumb({ lines }) {
  return (
    <svg viewBox="0 0 160 100" className="h-full w-full">
      <rect x="20" y="16" width="120" height="68" rx="5" style={{ fill: 'var(--bg-deep)', stroke: 'var(--border-strong)' }} />
      {lines.map((w, i) => (
        <g key={i}>
          <rect x="30" y={28 + i * 12} width="6" height="4" rx="1" style={{ fill: 'var(--accent)' }} />
          <rect x="40" y={28 + i * 12} width={w} height="4" rx="2" style={{ fill: 'var(--border-strong)' }} />
        </g>
      ))}
    </svg>
  );
}

function TreeThumb() {
  return (
    <svg viewBox="0 0 160 100" className="h-full w-full">
      <path d="M 40 22 V 78 M 40 40 H 56 M 40 60 H 56 M 64 50 V 70 M 64 70 H 78 M 40 78 H 56" fill="none" style={{ stroke: 'var(--border-strong)' }} />
      {[
        [32, 16, 'var(--text)'],
        [58, 35, 'var(--accent)'],
        [58, 55, 'var(--accent)'],
        [80, 65, 'var(--border-strong)'],
        [58, 73, 'var(--border-strong)'],
      ].map(([x, y, c], i) => (
        <rect key={i} x={x} y={y} width={i === 0 ? 34 : 26} height="10" rx="2" style={{ fill: c }} />
      ))}
      {Array.from({ length: 16 }).map((_, i) => (
        <rect key={`b${i}`} x={112 + (i % 4) * 9} y={24 + Math.floor(i / 4) * 13} width="7" height="10" rx="1" style={{ fill: i < 7 ? 'var(--accent)' : 'var(--surface-2)' }} />
      ))}
    </svg>
  );
}

function ChartThumb() {
  return (
    <svg viewBox="0 0 160 100" className="h-full w-full">
      {[30, 50, 70].map((y) => (
        <path key={y} d={`M 20 ${y} H 140`} style={{ stroke: 'var(--border)' }} />
      ))}
      <path d="M 20 70 L 38 62 L 52 66 L 68 48 L 84 52 L 100 36 L 116 40 L 140 24" fill="none" style={{ stroke: 'var(--accent)', strokeWidth: 2.5, strokeLinejoin: 'round' }} />
    </svg>
  );
}

function TextThumb() {
  return (
    <svg viewBox="0 0 160 100" className="h-full w-full">
      {[20, 32, 44, 56, 68].map((y, i) => (
        <rect key={y} x="22" y={y} width={[96, 88, 70, 92, 54][i]} height="5" rx="2.5" style={{ fill: i === 0 || i === 3 ? 'var(--accent)' : 'var(--border-strong)' }} />
      ))}
      <rect x="22" y="80" width="116" height="1" style={{ fill: 'var(--border-strong)' }} />
    </svg>
  );
}

function TranslatorThumb() {
  const rays = [0, 33, 68, 101, 138, 172, 205, 241, 276, 309, 342];
  return (
    <svg viewBox="0 0 160 100" className="h-full w-full">
      <rect x="16" y="14" width="56" height="72" rx="2" style={{ fill: '#f1e7d0' }} />
      {[24, 32, 40, 48, 56, 64].map((y, i) => (
        <rect key={y} x={i === 0 ? 30 : 22} y={y} width={i === 0 ? 28 : [44, 40, 30, 36, 24][i - 1]} height="3" rx="1.5" style={{ fill: '#5b4a36' }} />
      ))}
      {/* the scan stays paper; the typeset page is the site’s own, so it turns with the mode */}
      <rect x="88" y="14" width="56" height="72" rx="2" style={{ fill: 'var(--surface)', stroke: 'var(--border)' }} />
      {[24, 32, 40, 48, 56, 64].map((y, i) => (
        <rect key={y} x={i === 0 ? 102 : 94} y={y} width={i === 0 ? 28 : [44, 38, 32, 40, 22][i - 1]} height="3" rx="1.5" style={{ fill: i === 2 ? '#d97757' : 'var(--border-strong)' }} />
      ))}
      <g transform="translate(80 50) scale(0.42) translate(-24 -24)">
        {rays.map((deg, i) => (
          <rect key={deg} x="22.3" y={i % 3 === 0 ? 3 : i % 3 === 1 ? 6 : 4.5} width="3.4" height={i % 3 === 0 ? 21 : i % 3 === 1 ? 18 : 19.5} rx="1.7" transform={`rotate(${deg} 24 24)`} style={{ fill: '#d97757' }} />
        ))}
      </g>
    </svg>
  );
}

const THUMBS = {
  translator: TranslatorThumb,
  gameboy: GameBoyThumb,
  gpu: GpuThumb,
  devspace: EditorThumb,
  merge: MergeThumb,
  shell: () => <PromptThumb lines={[70, 44, 82, 56]} />,
  tree: TreeThumb,
  api: ChartThumb,
  summarizer: TextThumb,
};

export default function ProjectThumb({ stage, className = '' }) {
  const Thumb = THUMBS[stage];
  return (
    <div className={`overflow-hidden rounded-panel border border-line bg-deep ${className}`} aria-hidden="true">
      {Thumb ? <Thumb /> : null}
    </div>
  );
}
