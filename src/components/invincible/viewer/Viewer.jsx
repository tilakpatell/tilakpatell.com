import { useCallback, useEffect, useRef, useState } from 'react';
import { register, useStage, useStageFrame } from '../../avengers/shared/runtime';
import gameModule from './module';
import { use3D } from '../../../lib/gpu';
import { capturePointer } from '../../../lib/pointer';

// The GDA's files on the three of them, Cecil's way: who, what they can do,
// and what to do about it.
const FILES = [
  {
    id: 'mark',
    name: 'Invincible',
    real: 'Mark Grayson',
    rating: 'Ally (probationary)',
    facts: ['Eighteen. Powers came in at seventeen, late for his kind.', 'Half-human, half-Viltrumite: flight, strength, a healing factor, and a long life ahead of him.', 'Day job: Burger Mart. Night job: whatever Cecil calls about.'],
    note: 'Takes a beating and gets up. Hasn’t learned yet that he can’t save everybody.',
  },
  {
    id: 'omni',
    name: 'Omni-Man',
    real: 'Nolan Grayson',
    rating: 'Threat: planetary',
    facts: ['Earth’s mightiest defender for twenty years. A Viltrumite the whole time.', 'Killed the Guardians of the Globe in one night.', 'Went toe to toe with his son over the city, then left Earth.'],
    note: 'Contingencies on file: none that worked.',
  },
  {
    id: 'thragg',
    name: 'Thragg',
    real: 'Grand Regent of the Viltrum Empire',
    rating: 'Threat: extinction-level',
    facts: ['The strongest Viltrumite alive, bred for it.', 'The scar is older than the empire’s current borders.', 'Has heard about Earth, and about Nolan’s son.'],
    note: 'Do not engage. Do not let Mark engage. (Mark will engage.)',
  },
];
// the poses, then the footage: each one's own motion-captured clips
// (scripts/meshy-invincible.mjs's CLIPS.hero), played on the turntable
const POSE_NAMES = [
  ['stand', 'Standing'],
  ['hover', 'Hovering'],
  ['fly', 'Flying'],
  ['punch', 'Punching'],
  ['windup', 'Winding up'],
  ['clip:walk', 'Walking'],
  ['clip:run', 'Running'],
  ['clip:punch', 'Combination'],
  ['clip:hit', 'Taking a hit'],
  ['clip:land', 'Landing'],
  ['clip:wave', 'Waving'],
  ['clip:cheer', 'Cheering'],
];

// One of the three at a time, on a turntable: drag to turn him, pick a pose.
export default function Viewer() {
  const three = use3D();
  const stage = useStage(gameModule, { enabled: three.on, id: 'gda-viewer' });
  const [who, setWho] = useState('mark');
  const [pose, setPose] = useState('stand');
  const [ready, setReady] = useState(false);
  const drag = useRef(null);
  const file = FILES.find((f) => f.id === who);

  useEffect(() => {
    const v = stage.view.current;
    if (stage.status !== 'on' || !v) return;
    let live = true;
    setReady(false);
    v.show(who).then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [stage.status, stage.view, who]);
  useEffect(() => {
    stage.view.current?.setPose(pose);
  }, [pose, stage.status, stage.view]);

  const tick = useCallback((dtMs) => stage.view.current?.render(Math.min(0.05, dtMs / 1000)), [stage.view]);
  useStageFrame(stage, tick, stage.status === 'on' && stage.visible);
  // (for the browser checks, in development: its view, as each HQ game's)
  useEffect(
    () =>
      register('viewer', {
        get view() {
          return stage.view.current;
        },
      }),
    [stage.view],
  );

  const onPointerDown = (e) => {
    capturePointer(e);
    drag.current = { id: e.pointerId, x: e.clientX };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    stage.view.current?.turn((e.clientX - d.x) * 0.012);
    d.x = e.clientX;
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      stage.view.current?.turn(e.key === 'ArrowLeft' ? -0.25 : 0.25);
    }
  };

  const show3D = three.on && !['failed', 'slow', 'lost'].includes(stage.status);
  return (
    <div className="gda">
      <div ref={stage.wrap} className="gda-stage">
        {show3D ? (
          <div
            className="gda-screen"
            role="img"
            tabIndex={0}
            aria-label={`${file.name}, ${POSE_NAMES.find((p) => p[0] === pose)[1].toLowerCase()}, on a turntable. Drag or use the arrow keys to turn him.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onKeyDown={onKeyDown}
          >
            <div ref={stage.host} className="hq-canvas" data-on={(stage.status === 'on' && ready) || undefined} aria-hidden="true" />
            {(stage.status !== 'on' || !ready) && (
              <div className="hq-loading" aria-hidden="true">
                <span className="hq-loading-ring" />
              </div>
            )}
            <p className="gda-stamp" aria-hidden="true">
              G.D.A. · {file.rating}
            </p>
          </div>
        ) : (
          <div className="gda-screen gda-flat" aria-hidden="true">
            <span>{file.name}</span>
          </div>
        )}
        <div className="gda-poses" role="radiogroup" aria-label="Pose">
          {POSE_NAMES.map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={pose === id} onClick={() => setPose(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="gda-file">
        <div className="gda-tabs" role="tablist" aria-label="Files">
          {FILES.map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={who === f.id} onClick={() => setWho(f.id)}>
              {f.name}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="gda-card">
          <p className="gda-kicker">Global Defense Agency · file</p>
          <h3 className="gda-name">{file.name}</h3>
          <p className="gda-real">{file.real}</p>
          <ul className="gda-facts">
            {file.facts.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="gda-note">
            <b>Cecil’s note:</b> {file.note}
          </p>
        </div>
      </div>
    </div>
  );
}
