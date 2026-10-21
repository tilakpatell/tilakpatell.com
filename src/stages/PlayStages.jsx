import { useMemo, useState } from 'react';
import { StageWindow } from './StageKit';

// ─── Summarizer: paste any text, get the three most salient sentences ───────
const SAMPLE =
  'The city council approved a plan on Tuesday to put solar panels on every public school by 2030. Officials said the panels would cut electricity costs and double as teaching tools for science classes. The meeting ran long, and several residents spoke about unrelated parking concerns. Funding will come from a state clean-energy grant, so no new local taxes are needed. A pilot installation at two high schools begins next spring.';
const STOP = new Set('a an the and or but if of to in on at by for with from as is are was were be been it its this that these those will would can could should so not no do does did has have had they them their there here he she we you i our your his her which who what when where how about into over after before more most some such than then too very just also'.split(' '));

function summarize(text, keep = 3) {
  const sentences = (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map((s) => s.trim()).filter(Boolean);
  const words = (s) => (s.toLowerCase().match(/[a-z0-9']+/g) || []).filter((w) => !STOP.has(w) && w.length > 2);
  const freq = {};
  sentences.forEach((s) => words(s).forEach((w) => (freq[w] = (freq[w] || 0) + 1)));
  const max = Math.max(1, ...Object.values(freq));
  const scored = sentences.map((s, i) => {
    const ws = words(s);
    const score = ws.length ? ws.reduce((n, w) => n + freq[w] / max, 0) / Math.sqrt(ws.length) : 0;
    return { s, i, score: score + (i === 0 ? 0.25 : 0) };
  });
  const top = Math.max(...scored.map((x) => x.score), 0.001);
  const picked = new Set([...scored].sort((a, b) => b.score - a.score).slice(0, keep).map((x) => x.i));
  return { scored: scored.map((x) => ({ ...x, norm: x.score / top, keep: picked.has(x.i) })), summary: scored.filter((x) => picked.has(x.i)).map((x) => x.s) };
}

export function SummarizerPlay() {
  const [text, setText] = useState(SAMPLE);
  const [keep, setKeep] = useState(3);
  const result = useMemo(() => summarize(text, keep), [text, keep]);
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <StageWindow title="article.txt · paste anything" right={<span>{result.scored.length} sentences</span>}>
        <div className="p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="stage-code w-full resize-y rounded-md border border-line bg-[var(--bg-deep)] p-3 text-body outline-none focus:border-[var(--accent)]"
            aria-label="Text to summarize"
          />
          <ol className="mt-4 grid gap-2">
            {result.scored.map((x) => (
              <li key={x.i} className="grid grid-cols-[1fr_4.5rem] items-center gap-3 text-sm">
                <span className={x.keep ? 'text-ink' : 'text-muted'}>{x.s}</span>
                <span className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <span className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.round(x.norm * 100)}%`, background: x.keep ? 'var(--accent)' : 'var(--muted)' }} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      </StageWindow>
      <StageWindow title="summary.txt" right={
        <label className="flex items-center gap-2">
          keep
          <input type="range" min="1" max="5" value={keep} onChange={(e) => setKeep(Number(e.target.value))} className="w-20 accent-[var(--accent)]" aria-label="Sentences to keep" />
          {keep}
        </label>
      }>
        <div className="p-4 text-sm leading-relaxed">
          {result.summary.map((s, i) => (
            <p key={i} className="mb-2 text-ink">{s}</p>
          ))}
          <p className="mono mt-4 text-xs text-muted">Runs in your browser with word-frequency scoring. The project itself scores sentences with a BERT model.</p>
        </div>
      </StageWindow>
    </div>
  );
}

// ─── Finance: a portfolio split that follows your risk level ────────────────
const MIXES = [
  { at: 0, split: [20, 10, 60, 10] },
  { at: 50, split: [45, 20, 25, 10] },
  { at: 100, split: [70, 22, 5, 3] },
];
const SLICE_META = [
  { label: 'US equities', color: 'var(--accent)' },
  { label: 'International', color: '#7cc8ff' },
  { label: 'Bonds', color: '#c38bff' },
  { label: 'Cash', color: 'var(--muted)' },
];
const mixAt = (risk) => {
  const [a, b] = risk <= 50 ? [MIXES[0], MIXES[1]] : [MIXES[1], MIXES[2]];
  const k = (risk - a.at) / (b.at - a.at);
  const raw = a.split.map((v, i) => v + (b.split[i] - v) * k);
  const total = raw.reduce((x, y) => x + y, 0);
  return raw.map((v) => Math.round((v / total) * 100));
};

export function PortfolioPlay() {
  const [risk, setRisk] = useState(50);
  const split = mixAt(risk);
  const C = 2 * Math.PI * 42;
  let acc = 0;
  const label = risk < 34 ? 'conservative' : risk < 67 ? 'moderate' : 'aggressive';
  return (
    <StageWindow title="GET /finance/recommend?risk=…" right={<span className="tabular">risk {risk}</span>}>
      <div className="grid items-center gap-6 p-5 sm:grid-cols-[220px_1fr]">
        <svg viewBox="0 0 120 120" className="mx-auto w-48" role="img" aria-label={`Portfolio split for a ${label} risk level`}>
          {split.map((pct, i) => {
            const len = (pct / 100) * C;
            const el = (
              <circle key={i} cx="60" cy="60" r="42" fill="none" strokeWidth="16" transform="rotate(-90 60 60)"
                style={{ stroke: SLICE_META[i].color, strokeDasharray: `${len} ${C}`, strokeDashoffset: -acc, transition: 'stroke-dasharray .35s ease, stroke-dashoffset .35s ease' }} />
            );
            acc += len;
            return el;
          })}
          <text x="60" y="64" textAnchor="middle" style={{ fill: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{label}</text>
        </svg>
        <div>
          <label className="block text-sm text-body">
            Risk appetite
            <input type="range" min="0" max="100" value={risk} onChange={(e) => setRisk(Number(e.target.value))} className="mt-2 w-full accent-[var(--accent)]" />
          </label>
          <ul className="mt-4 grid gap-2">
            {SLICE_META.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3 text-sm">
                <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} />
                <span className="text-body">{s.label}</span>
                <span className="mono ml-auto text-ink tabular">{split[i]}%</span>
              </li>
            ))}
          </ul>
          <p className="mono mt-4 text-xs text-muted">Illustrative mixes. The API returns a recommendation from the user’s risk profile.</p>
        </div>
      </div>
    </StageWindow>
  );
}

// ─── FUSE: create, write and delete files; watch inodes and blocks ──────────
const RESERVED = 5;
const BLOCKS = 40;
const startFiles = () => [
  { ino: 2, name: 'docs/', dir: true, blocks: [5] },
  { ino: 3, name: 'hello.txt', size: 6, blocks: [6] },
];

export function InodePlay() {
  const [files, setFiles] = useState(startFiles);
  const [msg, setMsg] = useState('mounted tpfs on /mnt/tpfs');
  const used = new Set(files.flatMap((f) => f.blocks));
  const freeBlock = () => {
    for (let b = RESERVED; b < BLOCKS; b++) if (!used.has(b)) return b;
    return -1;
  };
  const nextIno = () => Math.max(1, ...files.map((f) => f.ino)) + 1;
  const touch = () => {
    const b = freeBlock();
    if (b < 0) return setMsg('ENOSPC: no space left on device');
    const ino = nextIno();
    setFiles((f) => [...f, { ino, name: `file${ino}.txt`, size: 0, blocks: [b] }]);
    setMsg(`touch file${ino}.txt  → inode ${ino}, block ${b}`);
  };
  const mkdir = () => {
    const b = freeBlock();
    if (b < 0) return setMsg('ENOSPC: no space left on device');
    const ino = nextIno();
    setFiles((f) => [...f, { ino, name: `dir${ino}/`, dir: true, blocks: [b] }]);
    setMsg(`mkdir dir${ino}  → inode ${ino}, block ${b}`);
  };
  const write = () => {
    const target = [...files].reverse().find((f) => !f.dir);
    if (!target) return setMsg('nothing to write to: touch a file first');
    const add = [];
    for (let b = RESERVED; b < BLOCKS && add.length < 4; b++) if (!used.has(b)) add.push(b);
    if (!add.length) return setMsg('ENOSPC: no space left on device');
    setFiles((fs) => fs.map((f) => (f.ino === target.ino ? { ...f, size: (f.size || 0) + add.length * 4096, blocks: [...f.blocks, ...add] } : f)));
    setMsg(`write 16 KB to ${target.name}  → blocks ${add.join(', ')}`);
  };
  const rm = () => {
    const target = [...files].reverse().find((f) => f.ino > 3);
    if (!target) return setMsg('nothing to remove');
    setFiles((fs) => fs.filter((f) => f.ino !== target.ino));
    setMsg(`rm ${target.name}  → freed inode ${target.ino} and ${target.blocks.length} block(s)`);
  };
  return (
    <StageWindow title="tpfs · your file system" right={<span>{used.size + RESERVED}/{BLOCKS} blocks</span>}>
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex flex-wrap gap-2">
            {[['touch', touch], ['mkdir', mkdir], ['write 16 KB', write], ['rm', rm]].map(([l, fn]) => (
              <button key={l} type="button" onClick={fn} className="btn btn-sm border border-[var(--border-strong)] font-mono text-ink hover:bg-[var(--surface-2)]">
                {l}
              </button>
            ))}
            <button type="button" onClick={() => { setFiles(startFiles()); setMsg('remounted'); }} className="btn btn-sm text-muted">reset</button>
          </div>
          <p className="mono mt-3 text-xs text-accent" aria-live="polite">$ {msg}</p>
          <table className="stage-code mt-3 w-full text-left">
            <thead className="text-muted">
              <tr><th className="pr-3 font-normal">ino</th><th className="pr-3 font-normal">size</th><th className="pr-3 font-normal">blocks</th><th className="font-normal">name</th></tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.ino}>
                  <td className="pr-3 text-ink">{f.ino}</td>
                  <td className="pr-3 tabular text-body">{f.dir ? 4096 : f.size}</td>
                  <td className="pr-3 text-accent">{f.blocks.join(',')}</td>
                  <td className="text-ink">{f.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <p className="eyebrow">Block bitmap</p>
          <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}>
            {Array.from({ length: BLOCKS }).map((_, b) => (
              <span key={b} className="mono grid aspect-square place-items-center rounded-sm text-[0.6rem] transition-colors duration-200"
                style={{ background: b < RESERVED ? 'var(--muted)' : used.has(b) ? 'var(--accent)' : 'var(--surface-2)', color: b < RESERVED || used.has(b) ? 'var(--btn-ink)' : 'var(--muted)' }}>
                {b}
              </span>
            ))}
          </div>
          <p className="mono mt-3 text-xs text-muted">0-4: superblock, bitmaps, inode table</p>
        </div>
      </div>
    </StageWindow>
  );
}
