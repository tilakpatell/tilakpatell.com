import { useEffect, useState } from 'react';
import { PhaseBar, StageWindow, useStagePlayer } from './StageKit';
import { useInView, useReducedMotion } from '../lib/hooks';

// ─── DevSpace: runs from several editors scheduled onto the Jetson's GPU ────
const JOBS = [
  { who: 'tilak', color: 'var(--accent)', file: 'kernel.cu' },
  { who: 'teammate', color: '#7cc8ff', file: 'matmul.cu' },
  { who: 'guest', color: '#c38bff', file: 'hello.py' },
  { who: 'tilak', color: 'var(--accent)', file: 'reduce.cu' },
];

export function SchedulerStage() {
  const [ref, inView] = useInView({ rootMargin: '0px' });
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(reduced ? 40 : 0);
  useEffect(() => {
    if (!inView || reduced) return undefined;
    const t = setInterval(() => setTick((n) => (n + 1) % 48), 140);
    return () => clearInterval(t);
  }, [inView, reduced]);

  // each job: queued at 3i, starts at 6+5i, runs 12 ticks
  const state = (i) => {
    const start = 6 + i * 5;
    if (tick < 3 * i) return 'hidden';
    if (tick < start) return 'queued';
    if (tick < start + 12) return 'running';
    return 'done';
  };
  const running = JOBS.filter((_, i) => state(i) === 'running').length;

  return (
    <div ref={ref}>
      <StageWindow title="devspace · run queue → jetson-nano" right={<span>{running}/2 GPU slots busy</span>}>
        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="eyebrow">Run requests</p>
            <ul className="mt-3 grid gap-2">
              {JOBS.map((j, i) => {
                const s = state(i);
                return (
                  <li
                    key={i}
                    className="stage-fade mono flex items-center gap-3 rounded-md border border-line px-3 py-2 text-sm"
                    data-on={s === 'hidden' ? 'false' : 'true'}
                  >
                    <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: j.color }} />
                    <span className="text-ink">{j.file}</span>
                    <span className="ml-auto text-xs text-muted">{s === 'hidden' ? '' : s}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Containers on the GPU</p>
            <div className="mt-3 grid gap-2">
              {[0, 1].map((slot) => {
                const i = JOBS.findIndex((_, k) => state(k) === 'running' && k % 2 === slot);
                const j = JOBS[i];
                const pct = i >= 0 ? Math.min(100, ((tick - (6 + i * 5)) / 12) * 100) : 0;
                return (
                  <div key={slot} className="rounded-md border border-line p-3">
                    <p className="mono flex justify-between text-xs text-muted">
                      <span>container {slot + 1} · CUDA</span>
                      <span>{j ? j.file : 'idle'}</span>
                    </p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${pct}%`, background: j ? j.color : 'transparent' }} />
                    </div>
                  </div>
                );
              })}
              <p className="mono mt-1 text-xs text-muted">Isolated Docker containers, GPU passed through on the Jetson Nano</p>
            </div>
          </div>
        </div>
      </StageWindow>
    </div>
  );
}

// ─── awesome-copilot: an error-recovery hook in action ──────────────────────
const RECOVERY = [
  { id: 'send', ms: 1100, label: 'The app sends a request through the Copilot SDK' },
  { id: 'error', ms: 1300, label: 'The call fails: a dropped connection' },
  { id: 'hook', ms: 1300, label: 'The error-recovery hook catches it and backs off' },
  { id: 'retry', ms: 1200, label: 'Retry with the session intact' },
  { id: 'ok', ms: 1900, label: 'Response streams back. The user never saw the failure' },
];
const R_ORDER = RECOVERY.map((r) => r.id);

export function RecoveryStage() {
  const player = useStagePlayer(RECOVERY);
  const at = R_ORDER.indexOf(player.phase.id);
  const lines = [
    ['›', 'session.send(prompt)', 0],
    ['✕', 'ConnectionResetError: peer closed connection', 1],
    ['↻', 'on_error hook → retry in 2s (attempt 1 of 3)', 2],
    ['›', 'session.send(prompt)  # resumed', 3],
    ['✓', '200 · streaming response', 4],
  ];
  return (
    <div ref={player.ref}>
      <StageWindow title="copilot-sdk · error-recovery hook">
        <div className="stage-code min-h-[12rem] px-4 py-4">
          {lines.map(([icon, text, step]) => (
            <p key={step} className="stage-fade flex gap-3" data-on={at >= step ? 'true' : 'false'}>
              <span className="w-4 text-center" style={{ color: icon === '✕' ? 'var(--danger)' : icon === '✓' ? 'var(--accent)' : 'var(--muted)' }}>
                {icon}
              </span>
              <span className={icon === '✕' ? 'text-[color:var(--danger)]' : 'text-body'}>{text}</span>
            </p>
          ))}
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${((at + 1) / RECOVERY.length) * 100}%`, background: at === 1 ? 'var(--danger)' : 'var(--accent)' }} />
          </div>
        </div>
      </StageWindow>
      <div className="mt-3">
        <button type="button" className="btn btn-sm btn-primary" onClick={() => player.setIndex(1)}>Drop the connection</button>
      </div>
      <PhaseBar phases={RECOVERY} player={player} />
    </div>
  );
}

// ─── Unix shell: a pipeline as processes joined by pipes ────────────────────
export function PipelineStage() {
  const [ref, inView] = useInView({ rootMargin: '0px' });
  const reduced = useReducedMotion();
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!inView || reduced) return undefined;
    const id = setInterval(() => setT((n) => (n + 1) % 60), 90);
    return () => clearInterval(id);
  }, [inView, reduced]);
  const procs = [
    { cmd: 'ls src', pid: 4121 },
    { cmd: 'grep "\\.c$"', pid: 4122 },
    { cmd: 'wc -l', pid: 4123 },
  ];
  return (
    <div ref={ref}>
      <StageWindow title="tsh: fork, pipe, dup2, exec">
        <div className="p-4 sm:p-6">
          <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
            {procs.map((p, i) => [
              <div key={p.pid} className="rounded-md border border-line p-3 text-center">
                <p className="mono text-sm text-ink">{p.cmd}</p>
                <p className="mono mt-1 text-xs text-muted">pid {p.pid}</p>
              </div>,
              i < procs.length - 1 && (
                <div key={`pipe${i}`} className="relative mx-auto h-8 w-16 sm:h-6 sm:w-20" aria-hidden="true">
                  <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-[var(--border-strong)]" />
                  {[0, 1, 2].map((k) => {
                    const x = ((t * 3 + k * 33 + i * 17) % 100) / 100;
                    return (
                      <span
                        key={k}
                        className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
                        style={{ left: `calc(${x * 100}% - 4px)`, background: 'var(--accent)', opacity: reduced ? 0 : 1 }}
                      />
                    );
                  })}
                  <span className="mono absolute -bottom-4 left-0 right-0 text-center text-[0.65rem] text-muted">pipe</span>
                </div>
              ),
            ])}
          </div>
          <p className="mono mt-8 text-sm text-body">
            <span className="text-accent">tsh&gt;</span> ls src | grep &quot;\.c$&quot; | wc -l
          </p>
          <p className="mono text-sm text-ink">3</p>
        </div>
      </StageWindow>
    </div>
  );
}

// ─── FUSE: an inode table and the block bitmap as a file is written ─────────

// ─── Finance: a portfolio split drawing in ──────────────────────────────────

// ─── Summarizer: attention over the tokens of one sentence ──────────────────
const TOKENS = ['The', 'council', 'approved', 'solar', 'panels', 'on', 'every', 'public', 'school', 'by', '2030', '.'];
const WEIGHTS = [0.1, 0.55, 0.9, 0.85, 0.8, 0.12, 0.3, 0.35, 0.7, 0.15, 0.75, 0.05];

export function AttentionStage() {
  const [ref, inView] = useInView({ rootMargin: '0px' });
  const reduced = useReducedMotion();
  const [focus, setFocus] = useState(2);
  useEffect(() => {
    if (!inView || reduced) return undefined;
    const t = setInterval(() => setFocus((f) => (f + 1) % TOKENS.length), 900);
    return () => clearInterval(t);
  }, [inView, reduced]);
  const w = (j) => Math.max(0.08, (WEIGHTS[j] + (j === focus ? 1 : 0) + WEIGHTS[focus] * (1 - Math.abs(j - focus) / TOKENS.length)) / 2.2);
  return (
    <div ref={ref}>
      <StageWindow title="bert · attention from one token" right={<span>head 7 · layer 11</span>}>
        <div className="p-5">
          <p className="flex flex-wrap gap-1.5">
            {TOKENS.map((t, j) => (
              <span
                key={j}
                className="mono rounded px-2 py-1 text-sm transition-colors duration-300"
                style={{
                  // capped at 60% so the light text stays readable on every token
                  background: `color-mix(in srgb, var(--accent) ${Math.round(Math.min(0.6, w(j)) * 100)}%, var(--surface-2))`,
                  color: 'var(--text)',
                  outline: j === focus ? '2px solid var(--text)' : 'none',
                }}
              >
                {t}
              </span>
            ))}
          </p>
          <p className="mono mt-4 text-xs text-muted">
            Stronger color = more attention from “{TOKENS[focus]}” (illustrative weights); salient sentences score higher and make the summary
          </p>
        </div>
      </StageWindow>
    </div>
  );
}

// ─── GPU research: a flamegraph of a checkpoint ─────────────────────────────
const FLAME = [
  [{ x: 0, w: 100, l: 'main' }],
  [{ x: 0, w: 62, l: 'mana_checkpoint' }, { x: 62, w: 38, l: 'train_step' }],
  [{ x: 0, w: 30, l: 'drain_mpi' }, { x: 30, w: 32, l: 'write_image' }, { x: 62, w: 24, l: 'ncclAllReduce' }, { x: 86, w: 14, l: 'kernel' }],
  [{ x: 0, w: 22, l: 'MPI_Alltoall' }, { x: 30, w: 20, l: 'fsync' }, { x: 62, w: 18, l: 'ring_step' }],
];

export function FlamegraphStage() {
  const [ref, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  return (
    <div ref={ref}>
      <StageWindow title="perf → flamegraph, one checkpoint (illustrative)">
        <div className="p-4 sm:p-5">
          <div className="grid gap-1" style={{ direction: 'ltr' }}>
            {[...FLAME].reverse().map((row, r) => (
              <div key={r} className="relative h-7">
                {row.map((b, k) => (
                  <span
                    key={k}
                    className="mono absolute inset-y-0 truncate rounded-sm px-1.5 text-[0.7rem] leading-7"
                    style={{
                      left: `${b.x}%`,
                      width: `calc(${b.w}% - 2px)`,
                      background: `color-mix(in srgb, var(--accent) ${40 + ((r * 13 + k * 17) % 50)}%, #e8742c)`,
                      color: 'var(--btn-ink)',
                      transform: inView ? 'scaleX(1)' : 'scaleX(0)',
                      transformOrigin: 'left',
                      transition: `transform 0.5s var(--ease-smooth) ${(FLAME.length - r) * 120 + k * 60}ms`,
                    }}
                    title={b.l}
                  >
                    {b.l}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <p className="mono mt-3 text-xs text-muted">Width = time on CPU. Profiling showed where checkpoint time went: draining MPI traffic and writing the image.</p>
        </div>
      </StageWindow>
    </div>
  );
}

// ─── DevSpace: edit the kernel and run it on the "GPU" ──────────────────────
const OPS = { '+': (x, y) => x + y, '-': (x, y) => x - y, '*': (x, y) => x * y, max: (x, y) => Math.max(x, y) };

export function KernelPlay() {
  const [op, setOp] = useState('+');
  const [a, setA] = useState('1, 2, 3, 4');
  const [b, setB] = useState('10, 20, 30, 40');
  const [run, setRun] = useState(null);
  const parse = (s) => s.split(/[\s,]+/).filter(Boolean).map(Number).filter((n) => Number.isFinite(n)).slice(0, 8);
  const go = () => {
    const xs = parse(a);
    const ys = parse(b);
    const n = Math.min(xs.length, ys.length);
    const out = Array.from({ length: n }, (_, i) => OPS[op](xs[i], ys[i]));
    setRun({ n, out, t: Date.now() });
  };
  const expr = op === 'max' ? 'max(a[i], b[i])' : `a[i] ${op} b[i]`;
  return (
    <StageWindow title="kernel.cu · your turn" right={<span>{run ? `${run.n} threads` : 'not run yet'}</span>}>
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <pre className="stage-code whitespace-pre-wrap text-body">
            <span className="text-accent">__global__ void</span> op(int *a, int *b, int *c) {'{'}
            {'\n'}  int i = threadIdx.x;
            {'\n'}  c[i] = <span className="text-ink">{expr}</span>;
            {'\n'}{'}'}
          </pre>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mono text-xs text-muted">operation</span>
            {Object.keys(OPS).map((k) => (
              <button key={k} type="button" onClick={() => setOp(k)} aria-pressed={op === k}
                className="mono rounded px-3 py-1 text-sm"
                style={{ background: op === k ? 'var(--accent)' : 'var(--surface-2)', color: op === k ? 'var(--btn-ink)' : 'var(--text-body)' }}>
                {k}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="mono text-xs text-muted">a[]
              <input value={a} onChange={(e) => setA(e.target.value)} className="mt-1 w-full rounded border border-line bg-[var(--bg-deep)] px-2 py-1.5 text-sm text-ink outline-none focus:border-[var(--accent)]" />
            </label>
            <label className="mono text-xs text-muted">b[]
              <input value={b} onChange={(e) => setB(e.target.value)} className="mt-1 w-full rounded border border-line bg-[var(--bg-deep)] px-2 py-1.5 text-sm text-ink outline-none focus:border-[var(--accent)]" />
            </label>
          </div>
          <button type="button" className="btn btn-sm btn-primary mt-4" onClick={go}>Run on the Jetson</button>
        </div>
        <div>
          <p className="eyebrow">GPU threads</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => {
              const on = run && i < run.n;
              return (
                <div key={`${i}-${run?.t}`} className="rounded-md border p-2 text-center transition-colors duration-300"
                  style={{ borderColor: on ? 'var(--accent)' : 'var(--border)', background: on ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent', transitionDelay: `${i * 70}ms` }}>
                  <p className="mono text-[0.65rem] text-muted">t{i}</p>
                  <p className="mono text-sm text-ink tabular">{on ? run.out[i] : '·'}</p>
                </div>
              );
            })}
          </div>
          <p className="mono mt-3 text-xs text-muted">{run ? `c = [${run.out.join(', ')}]` : 'Pick an operation, edit the arrays, run it.'}</p>
        </div>
      </div>
    </StageWindow>
  );
}
