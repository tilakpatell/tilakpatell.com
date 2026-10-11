import { useId } from 'react';
import { CONTROLS, write } from '../../lib/video.js';
import { ceilingOf, useVideo } from './useVideo.js';
import { LEVEL, groupsOf, optionsFor } from './video.js';
import { Row, Segmented, Slider } from './parts.jsx';

// The picture's controls under the quality presets (lane V1 of the Frostbite
// gaps design): every one a knob the engine has (lib/video.js names the
// reader), grouped as a game's video menu is. A control turned marks the
// picture Custom beside the Quality row (Settings.jsx reads `custom`); a
// value this device cannot afford is greyed with the reason; a control that
// is not live says the world is built once and takes the panel's reload.

export default function Video({ onNeedsReload = null }) {
  const { values, held } = useVideo();
  const ceiling = ceilingOf();
  const hintId = useId();
  const change = (control, value) => {
    write({ [control.id]: value });
    if (!control.live) onNeedsReload?.(control);
  };
  return (
    <>
      {groupsOf(CONTROLS).map(({ group, controls }) => (
        <section key={group} aria-labelledby={`${hintId}-${group}`}>
          <h3 id={`${hintId}-${group}`}>{group}</h3>
          {controls.map((c) => {
            const heldAt = held[c.id];
            const hint = heldAt !== undefined ? `${c.hint} Held at ${LEVEL[ceiling] ?? ceiling}’s value: this device cannot draw more.` : c.live ? c.hint : `${c.hint} A change here takes a reload of the world.`;
            return (
              <Row key={c.id} title={c.label} hint={hint} id={`${hintId}-${c.id}`}>
                {c.kind === 'choice' ? (
                  <Segmented label={c.label} value={values[c.id]} options={optionsFor(c, ceiling)} onChange={(v) => change(c, v)} describedBy={`${hintId}-${c.id}`} />
                ) : (
                  <Slider label={c.label} value={values[c.id]} min={c.values.min} max={c.values.max} step={c.values.step} show={c.values.show} onChange={(v) => change(c, v)} />
                )}
              </Row>
            );
          })}
        </section>
      ))}
    </>
  );
}
