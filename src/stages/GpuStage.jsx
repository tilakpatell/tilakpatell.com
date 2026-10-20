import { useEffect, useRef, useState } from 'react';
import { PhaseBar, StageWindow, useStagePlayer } from './StageKit';
import { useScene } from '../lib/three/useScene';
import './gpu3d/gpu3d.css';

// Four GPUs in an NCCL ring: training, a MANA checkpoint, a fault, and a restart.
const PHASES = [
  { id: 'train', ms: 3400, label: 'Training: ring all-reduce across four GPUs' },
  { id: 'ckpt', ms: 2600, label: 'Checkpoint: MANA captures MPI and NCCL state' },
  { id: 'train', ms: 2400, label: 'Training continues past the checkpoint' },
  { id: 'fault', ms: 2200, label: 'Fault: GPU 2 drops out and the collective stalls' },
  { id: 'restore', ms: 2800, label: 'Restart: every rank restores from the checkpoint' },
];

const GPUS = [
  { x: 40, y: 34 },
  { x: 220, y: 34 },
  { x: 220, y: 182 },
  { x: 40, y: 182 },
];
const RING = 'M 100 66 H 280 V 214 H 100 Z';
const STORE = { x: 430, y: 92, w: 176, h: 100 };
// The fault red for the 3D prop alone: scene.js parses it as a colour, and a
// var() can’t be parsed. The SVG and the labels take the house --danger, so
// this is the window’s own (a .dark-scope’s) --danger written out, and the
// model goes the same red as its LOST tag.
const FAULT = '#ff8a8a';
const LABEL = 'Four GPUs connected in a ring, a checkpoint store, and the current phase of checkpoint-restart';

// The same scene as hardware, drawn in 3D over the SVG once it has loaded.
const scene3d = () => import('./gpu3d/scene');

// each GPU's load bar, out of 96 (the SVG's bar width)
const load = (id, step, i) => (id === 'fault' && i === 2 ? 0 : id === 'restore' ? 96 : 40 + ((step / 10 + i * 7) % 56));

export default function GpuStage() {
  const player = useStagePlayer(PHASES);
  const { ref, phase, running } = player;
  const svgRef = useRef(null);
  const [step, setStep] = useState(1200);
  const [saved, setSaved] = useState(null);

  const id = phase.id;
  const training = id === 'train';
  const { wrap, on, meant } = useScene(scene3d, {
    id: 'gpu-stage',
    props: { phase: id, running, saved, fault: FAULT, levels: [0, 1, 2, 3].map((i) => load(id, step, i) / 96) },
  });

  // the SVG's packets only move while it's the one on show
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg?.pauseAnimations) return;
    if (running && training && !meant) svg.unpauseAnimations();
    else svg.pauseAnimations();
  }, [running, training, meant]);

  useEffect(() => {
    if (!running || !training) return undefined;
    const t = setInterval(() => setStep((s) => s + 10), 280);
    return () => clearInterval(t);
  }, [running, training]);

  useEffect(() => {
    if (id === 'ckpt') setSaved(step);
    if (id === 'restore' && saved != null) setStep(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div ref={ref}>
      <StageWindow title="mana · nccl ring · 4 ranks" right={<span className="tabular">step {step.toLocaleString('en-US')}</span>}>
        <div className="gpu3d-frame" role="img" aria-label={LABEL}>
          <svg ref={svgRef} viewBox="0 0 640 260" className="block h-auto w-full" aria-hidden="true">
            <path d={RING} fill="none" style={{ stroke: 'var(--border-strong)', strokeWidth: 2, strokeDasharray: '6 6' }} />
            {[0, 1, 2, 3].map((i) => (
              <circle key={i} r="5" style={{ fill: 'var(--accent)', opacity: training ? 1 : 0, transition: 'opacity .3s' }}>
                <animateMotion dur="2.4s" repeatCount="indefinite" begin={`${-i * 0.6}s`} path={RING} />
              </circle>
            ))}

            {GPUS.map((g, i) => {
              const down = id === 'fault' && i === 2;
              const lineOn = id === 'ckpt' || id === 'restore';
              return (
                <g key={i}>
                  <path
                    className="gpu-link anim-march"
                    d={`M ${g.x + 120} ${g.y + 32} C ${g.x + 220} ${g.y + 32}, ${STORE.x - 60} ${STORE.y + STORE.h / 2}, ${STORE.x} ${STORE.y + STORE.h / 2}`}
                    fill="none"
                    style={{
                      stroke: 'var(--accent)',
                      strokeDasharray: '4 6',
                      opacity: lineOn ? 0.9 : 0,
                      animationDirection: id === 'restore' ? 'reverse' : 'normal',
                    }}
                  />
                  <rect
                    className="gpu-tile"
                    x={g.x}
                    y={g.y}
                    width="120"
                    height="64"
                    rx="8"
                    style={{ fill: down ? 'color-mix(in srgb, var(--danger) 18%, var(--surface))' : 'var(--surface)', stroke: down ? 'var(--danger)' : 'var(--border-strong)' }}
                  />
                  <text x={g.x + 12} y={g.y + 22} style={{ fill: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    GPU {i}
                  </text>
                  <text x={g.x + 108} y={g.y + 22} textAnchor="end" style={{ fill: down ? 'var(--danger)' : 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                    {down ? 'LOST' : `rank ${i}`}
                  </text>
                  <rect x={g.x + 12} y={g.y + 38} width="96" height="10" rx="3" style={{ fill: 'var(--bg-deep)' }} />
                  <rect
                    x={g.x + 12}
                    y={g.y + 38}
                    height="10"
                    rx="3"
                    width={load(id, step, i)}
                    style={{ fill: down ? 'var(--danger)' : 'color-mix(in srgb, var(--text) 70%, transparent)', transition: 'width .6s ease' }}
                  />
                </g>
              );
            })}

            <rect x={STORE.x} y={STORE.y} width={STORE.w} height={STORE.h} rx="10" style={{ fill: 'var(--surface)', stroke: id === 'ckpt' || id === 'restore' ? 'var(--accent)' : 'var(--border-strong)', transition: 'stroke .4s' }} />
            <text x={STORE.x + 16} y={STORE.y + 28} style={{ fill: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              checkpoint image
            </text>
            <text x={STORE.x + 16} y={STORE.y + 48} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
              {saved == null ? 'none yet' : `step ${saved.toLocaleString('en-US')} · 4 ranks`}
            </text>
            <rect x={STORE.x + 16} y={STORE.y + 66} width={STORE.w - 32} height="12" rx="4" style={{ fill: 'var(--bg-deep)' }} />
            {saved != null && (
              <rect key={saved} className="anim-grow" x={STORE.x + 16} y={STORE.y + 66} height="12" rx="4" width={STORE.w - 32} style={{ fill: 'var(--accent)' }} />
            )}
            {id === 'fault' && (
              <text x="190" y="146" textAnchor="middle" style={{ fill: 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                ncclAllReduce stalled
              </text>
            )}
          </svg>
          <div ref={wrap} className="gpu3d" data-on={on || undefined} style={{ '--gpu-fault': 'var(--danger)' }} aria-hidden="true" />
        </div>
      </StageWindow>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm btn-primary" onClick={() => player.setIndex(1)}>Checkpoint now</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => player.setIndex(3)}>Inject a GPU fault</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => player.setIndex(4)}>Restart from checkpoint</button>
      </div>
      <PhaseBar phases={PHASES} player={player} />
    </div>
  );
}
