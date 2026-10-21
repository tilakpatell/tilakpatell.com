import { useEffect, useRef, useState } from 'react';
import { StageWindow } from './StageKit';
import { useFrameLoop, useInView, useReducedMotion } from '../lib/hooks';
import { H, W, text } from './gb/font';
import { newMario, renderMario } from './gb/mario';

const hex = (n, w = 2) => n.toString(16).toUpperCase().padStart(w, '0');

// ─── CPU: step through a small LR35902 program ──────────────────────────────
const PROGRAM = [
  { addr: 0x0150, bytes: [0x31, 0xfe, 0xff], asm: 'LD SP,$FFFE', note: 'stack at the top of HRAM' },
  { addr: 0x0153, bytes: [0x21, 0x00, 0xc0], asm: 'LD HL,$C000', note: 'HL → start of work RAM' },
  { addr: 0x0156, bytes: [0xaf], asm: 'XOR A', note: 'loop: A = 0, Z set' },
  { addr: 0x0157, bytes: [0x22], asm: 'LD (HL+),A', note: 'clear a byte, HL++' },
  { addr: 0x0158, bytes: [0x7c], asm: 'LD A,H', note: 'high byte of HL' },
  { addr: 0x0159, bytes: [0xfe, 0xe0], asm: 'CP $E0', note: 'reached $E000?' },
  { addr: 0x015b, bytes: [0x20, 0xf9], asm: 'JR NZ,$0156', note: 'no → loop' },
  { addr: 0x015d, bytes: [0x3e, 0xe4], asm: 'LD A,$E4', note: 'palette 11 10 01 00' },
  { addr: 0x015f, bytes: [0xe0, 0x47], asm: 'LDH ($FF47),A', note: 'write BGP' },
  { addr: 0x0161, bytes: [0x3e, 0x91], asm: 'LD A,$91', note: 'LCD on, BG on' },
  { addr: 0x0163, bytes: [0xe0, 0x40], asm: 'LDH ($FF40),A', note: 'write LCDC' },
  { addr: 0x0165, bytes: [0x76], asm: 'HALT', note: 'wait for an interrupt' },
];

const fresh = () => ({ i: 0, A: 0x01, Z: 1, N: 0, Hf: 1, C: 1, HL: 0x014d, SP: 0xfffe, cycles: 0, cleared: 0, halted: false, fast: false });

function exec(s) {
  const ins = PROGRAM[s.i];
  let next = s.i + 1;
  let cyc = 4;
  switch (ins.asm) {
    case 'LD SP,$FFFE':
      s.SP = 0xfffe;
      cyc = 12;
      break;
    case 'LD HL,$C000':
      s.HL = 0xc000;
      cyc = 12;
      break;
    case 'XOR A':
      s.A = 0;
      s.Z = 1;
      s.N = 0;
      s.Hf = 0;
      s.C = 0;
      break;
    case 'LD (HL+),A':
      s.HL = (s.HL + 1) & 0xffff;
      s.cleared += 1;
      cyc = 8;
      break;
    case 'LD A,H':
      s.A = s.HL >> 8;
      break;
    case 'CP $E0':
      s.Z = s.A === 0xe0 ? 1 : 0;
      s.N = 1;
      s.Hf = 0;
      s.C = s.A < 0xe0 ? 1 : 0;
      cyc = 8;
      break;
    case 'JR NZ,$0156':
      if (!s.Z) {
        next = 2;
        cyc = 12;
      } else cyc = 8;
      break;
    case 'LD A,$E4':
      s.A = 0xe4;
      cyc = 8;
      break;
    case 'LD A,$91':
      s.A = 0x91;
      cyc = 8;
      break;
    case 'LDH ($FF47),A':
    case 'LDH ($FF40),A':
      cyc = 12;
      break;
    case 'HALT':
      s.halted = true;
      next = s.i;
      break;
    default:
      break;
  }
  s.cycles += cyc;
  s.i = next;
}

export function CpuStage() {
  const [ref, inView] = useInView({ rootMargin: '0px' });
  const reduced = useReducedMotion();
  const sim = useRef(fresh());
  const [, force] = useState(0);
  const slowSteps = useRef(0);
  const [auto, setAuto] = useState(!reduced);

  const stepOnce = () => {
    setAuto(false);
    const s = sim.current;
    if (s.halted) sim.current = fresh();
    else exec(s);
    force((n) => n + 1);
  };
  const reset = () => {
    sim.current = fresh();
    slowSteps.current = 0;
    force((n) => n + 1);
  };

  useEffect(() => {
    if (!inView || !auto) return undefined;
    let t;
    const tick = () => {
      const s = sim.current;
      if (s.halted) {
        t = setTimeout(() => {
          sim.current = fresh();
          slowSteps.current = 0;
          force((n) => n + 1);
          t = setTimeout(tick, 500);
        }, 1800);
        return;
      }
      if (s.fast && s.i >= 2 && s.i <= 6) {
        // fast-forward the clear loop a few hundred iterations per tick
        for (let n = 0; n < 1400 && !(s.i === 7); n++) exec(s);
        force((n) => n + 1);
        t = setTimeout(tick, 16);
        return;
      }
      exec(s);
      slowSteps.current += 1;
      if (slowSteps.current === 12) s.fast = true;
      force((n) => n + 1);
      t = setTimeout(tick, s.i >= 7 ? 420 : 320);
    };
    t = setTimeout(tick, 400);
    return () => clearTimeout(t);
  }, [inView, auto]);

  const s = sim.current;
  const pc = PROGRAM[s.i].addr;
  const regs = [
    ['A', hex(s.A)],
    ['F', hex((s.Z << 7) | (s.N << 6) | (s.Hf << 5) | (s.C << 4))],
    ['HL', hex(s.HL, 4)],
    ['SP', hex(s.SP, 4)],
    ['PC', hex(pc, 4)],
  ];
  const flags = [
    ['Z', s.Z],
    ['N', s.N],
    ['H', s.Hf],
    ['C', s.C],
  ];

  return (
    <div ref={ref}>
      <StageWindow title="lr35902 · step debugger" right={<span className="tabular">{s.cycles.toLocaleString('en-US')} cycles</span>}>
        <div className="grid gap-0 md:grid-cols-[1.5fr_1fr]">
          <ol className="stage-code px-3 py-3 sm:px-4">
            {PROGRAM.map((ins, i) => {
              const on = i === s.i;
              return (
                <li
                  key={ins.addr}
                  className="grid grid-cols-[3.4rem_5.6rem_1fr] items-baseline gap-2 rounded px-2 sm:grid-cols-[3.6rem_6.4rem_9rem_1fr]"
                  style={{ background: on ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'transparent' }}
                >
                  <span className="text-muted">{hex(ins.addr, 4)}</span>
                  <span className="text-muted">{ins.bytes.map((b) => hex(b)).join(' ')}</span>
                  <span className={on ? 'text-ink' : 'text-body'}>{ins.asm}</span>
                  <span className="hidden truncate text-muted sm:inline">; {ins.note}</span>
                </li>
              );
            })}
          </ol>
          <div className="grid content-start gap-4 border-t border-line p-4 md:border-l md:border-t-0">
            <dl className="stage-code grid grid-cols-2 gap-x-4 gap-y-1">
              {regs.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-ink tabular">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex gap-2">
              {flags.map(([k, v]) => (
                <span
                  key={k}
                  className="mono grid h-8 w-8 place-items-center rounded text-sm"
                  style={{ background: v ? 'var(--accent)' : 'var(--surface-2)', color: v ? 'var(--btn-ink)' : 'var(--muted)' }}
                >
                  {k}
                </span>
              ))}
            </div>
            <div>
              <p className="mono flex justify-between text-xs text-muted">
                <span>WRAM cleared</span>
                <span className="tabular">
                  {s.cleared.toLocaleString('en-US')} / 8,192 B
                </span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div className="h-full rounded-full" style={{ width: `${(s.cleared / 8192) * 100}%`, background: 'var(--accent)' }} />
              </div>
            </div>
            <p className="mono text-xs text-muted">{s.halted ? 'HALT: waiting for an interrupt' : s.fast && s.i < 7 ? 'fast-forwarding the loop…' : auto ? 'running' : 'paused: step it yourself'}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-sm btn-primary" onClick={stepOnce}>Step</button>
              <button type="button" className="btn btn-sm border border-[var(--border-strong)] text-ink hover:bg-[var(--surface-2)]" onClick={() => setAuto((a) => !a)}>
                {auto ? 'Pause' : 'Run'}
              </button>
              <button type="button" className="btn btn-sm text-muted hover:text-ink" onClick={reset}>Reset</button>
            </div>
          </div>
        </div>
      </StageWindow>
    </div>
  );
}

// ─── PPU: draw a frame one scanline at a time ───────────────────────────────
// The blank screen is the dark island’s --bg. A canvas can’t read a var(), so
// it asks for the token’s value (a plain colour in a .dark-scope) and keeps
// the old dark when there is none to read (a test’s DOM).
const lcdOff = (el) => (el && getComputedStyle(el).getPropertyValue('--bg').trim()) || '#0f141a';

export function PpuStage() {
  const [ref, inView] = useInView({ rootMargin: '0px' });
  const reduced = useReducedMotion();
  const canvasRef = useRef(null);
  const source = useRef(null);
  const ly = useRef(0);
  const acc = useRef(0);
  const [line, setLine] = useState(0);

  useEffect(() => {
    const src = document.createElement('canvas');
    src.width = W;
    src.height = H;
    const g = newMario({ attract: true, seed: 7 });
    g.t = 1;
    renderMario(src.getContext('2d'), g);
    source.current = src;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.fillStyle = lcdOff(canvasRef.current);
      ctx.fillRect(0, 0, W, H);
      if (reduced) ctx.drawImage(src, 0, 0);
    }
  }, [reduced]);

  useFrameLoop((dt) => {
    const ctx = canvasRef.current?.getContext('2d');
    const src = source.current;
    if (!ctx || !src) return;
    acc.current += dt;
    const per = 1000 / 48; // 48 lines a second so the sweep is visible
    let changed = false;
    while (acc.current >= per) {
      acc.current -= per;
      const y = ly.current;
      if (y < H) ctx.drawImage(src, 0, y, W, 1, 0, y, W, 1);
      ly.current = (y + 1) % 154;
      if (ly.current === 0) {
        ctx.fillStyle = lcdOff(canvasRef.current);
        ctx.fillRect(0, 0, W, H);
      }
      changed = true;
    }
    if (changed) setLine(ly.current);
  }, inView && !reduced);

  const vblank = line >= 144;
  return (
    <div ref={ref}>
      <StageWindow title="ppu · one frame, line by line" right={<span className="tabular">LY {String(line).padStart(3, '0')}</span>}>
        <div className="grid items-center gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="relative mx-auto w-full max-w-[400px]">
            <canvas ref={canvasRef} width={W} height={H} className="block w-full rounded-sm" style={{ imageRendering: 'pixelated', aspectRatio: '160 / 144' }} />
            {!vblank && !reduced && (
              <span
                className="pointer-events-none absolute inset-x-0 h-[2px]"
                style={{ top: `${(line / 144) * 100}%`, background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }}
              />
            )}
          </div>
          <div className="grid gap-3">
            {[
              ['Mode 2', 'OAM scan: find the sprites on this line', !vblank],
              ['Mode 3', 'Pixel transfer: push 160 pixels to the LCD', !vblank],
              ['Mode 0', 'HBlank: CPU may touch VRAM', !vblank],
              ['Mode 1', 'VBlank: lines 144-153, the frame is done', vblank],
            ].map(([m, d, on]) => (
              <div key={m} className="rounded-lg border p-3 transition-colors" style={{ borderColor: on ? 'var(--accent)' : 'var(--border)' }}>
                <p className="mono text-sm" style={{ color: on ? 'var(--accent)' : 'var(--muted)' }}>
                  {m}
                </p>
                <p className="text-sm text-body">{d}</p>
              </div>
            ))}
            <p className="mono text-xs text-muted">154 lines × 456 dots = 70,224 dots per frame · 59.7 Hz</p>
          </div>
        </div>
      </StageWindow>
    </div>
  );
}

// ─── Blargg's cpu_instrs ────────────────────────────────────────────────────
const TESTS = ['special', 'interrupts', 'op sp,hl', 'op r,imm', 'op rp', 'ld r,r', 'jr,jp,call,ret,rst', 'misc instrs', 'op r,r', 'bit ops', 'op a,(hl)'];
const GREEN = ['#9bbc0f', '#8bac0f', '#306230', '#0f380f'];

export function BlarggStage() {
  const [ref, inView] = useInView({ rootMargin: '0px' });
  const reduced = useReducedMotion();
  const [done, setDone] = useState(reduced ? TESTS.length + 1 : 0);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!inView || reduced) return undefined;
    const t = setTimeout(() => setDone((d) => (d > TESTS.length + 4 ? 0 : d + 1)), done === 0 ? 700 : done > TESTS.length ? 900 : 380);
    return () => clearTimeout(t);
  }, [done, inView, reduced]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = GREEN[0];
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'CPU INSTRS', 8, 10, GREEN[3]);
    const shown = Math.min(done, TESTS.length);
    for (let i = 0; i < shown; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      text(ctx, `${String(i + 1).padStart(2, '0')}:OK`, 8 + col * 48, 26 + row * 12, GREEN[3]);
    }
    if (done > TESTS.length) text(ctx, 'PASSED ALL TESTS', 8, 84, GREEN[3]);
  }, [done]);

  return (
    <div ref={ref}>
      <StageWindow title="blargg · cpu_instrs.gb" right={done > TESTS.length ? 'passed' : `${Math.min(done, TESTS.length)}/11`}>
        <div className="grid items-center gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="mx-auto block w-full max-w-[400px] rounded-sm"
            style={{ imageRendering: 'pixelated', aspectRatio: '160 / 144' }}
          />
          <ol className="stage-code grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {TESTS.map((t, i) => (
              <li key={t} className="flex items-center gap-2" style={{ color: i < done ? 'var(--text-body)' : 'var(--muted)', opacity: i < done ? 1 : 0.8 }}>
                <span className="w-5 text-center" style={{ color: i < done ? 'var(--accent)' : 'var(--muted)' }}>
                  {i < done ? '✓' : '·'}
                </span>
                <span className="tabular">{String(i + 1).padStart(2, '0')}</span>
                <span className="truncate">{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </StageWindow>
    </div>
  );
}
