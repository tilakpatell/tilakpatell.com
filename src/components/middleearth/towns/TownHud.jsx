import { forwardRef } from 'react';
import { audioContext } from '../../../lib/audio';
import { useVoiced } from '../../../lib/useVoiced';
import { Bubble as KitBubble, Exit, QuestList as KitQuestList, Stick as KitStick, alliesText } from '../../../runtime/hud';
import { nodeVoice, personVoice } from './talk';
import '../../../styles/lazy/middleearth.css';

// The HUD parts a walkable town shares, the HUD kit's (src/runtime/hud) in
// the Shire's look (its shire-* classes and variables, ../shire/shire.css,
// re-tinted by each town): the list of things to do, a speech bubble, a
// conversation, the touch stick and the other travellers. The corner map is
// ./map.js.

// The list of things to do (the HUD kit's, in the Shire's look: its
// shire-list skin) and, under it, anything a town has on the side or a
// town's own list of them (./SideList.jsx), as children. `title` is the
// town's name for it, which a screen reader hears; the heading says
// "Things to do" in every town. It hangs under the map and the chips, as
// many as there are (measured).
export function QuestList({ title, ...rest }) {
  return <KitQuestList className="shire-list" label={title} under=".shire-side" {...rest} />;
}

// Who's talking, over their head, and in their own voice where it's been
// made (`who`: their id in the town's CAST; ./voicelines.js): the kit's
// bubble in the Shire's look.
export const Bubble = forwardRef(function Bubble({ who = null, name, line }, ref) {
  return <KitBubble ref={ref} className="shire-bubble" voice={personVoice(who)} name={name} line={line} />;
});

// A conversation: who says it, what they say, and the replies to pick (with
// their number keys), or a button to go on; and, given onLeave, a way out
// of it (Esc).
export function Convo({ title, name, node, onPick, onNext, onLeave = null, touch, className = '' }) {
  useVoiced(nodeVoice(node), node?.say); // in the speaker's own voice, where it's been made (lib/voiced.js)
  if (!node) return null;
  const leave = onLeave && <Exit onLeave={onLeave} touch={touch} />;
  return (
    <div className={`shire-panel town-convo ${className}`} role="dialog" aria-label={title}>
      <p className="shire-panel-title">{name}</p>
      <p className="shire-panel-say" aria-live="polite">
        {node.say}
      </p>
      {node.choices ? (
        <>
          <div className="town-choices">
            {node.choices.map((c, i) => (
              <button key={c.text} type="button" className="btn btn-ghost btn-sm town-choice" onClick={() => onPick(i)}>
                {!touch && <kbd>{i + 1}</kbd>} {c.text}
              </button>
            ))}
          </div>
          {leave && <div className="shire-panel-row">{leave}</div>}
        </>
      ) : (
        <div className="shire-panel-row">
          <button type="button" className="btn btn-primary btn-sm" onClick={onNext}>
            {node.end ? 'Go on' : 'Next'} {!touch && <kbd>Space</kbd>}
          </button>
          {leave}
        </div>
      )}
    </div>
  );
}

// The touch stick: drag from where you put your thumb (the kit's, a little
// longer a throw than the default, as the towns' always was). `onMove(x, y)`
// is the town's; the first touch wakes the sound (iOS wants it there).
export function Stick({ onMove }) {
  return (
    <div className="shire-hud shire-hud-bottom">
      <KitStick className="shire-stick" onMove={onMove} onStart={audioContext} reach={46} />
    </div>
  );
}

// Other travellers online in this town (./useTravellers.js): how many (and
// how many of them your allies, in the ally green), or a way to see them.
export function Travellers({ trav }) {
  if (!trav.available) return null;
  if (!trav.on)
    return (
      <button type="button" className="shire-chip town-travellers" onClick={trav.join} title="Go online, and see everyone else walking this town as a ghost from another world">
        See other travellers
      </button>
    );
  return (
    <span className="shire-chip town-travellers" data-on data-allies={trav.allies > 0 ? trav.allies : undefined} title="Everyone else online in this town shows as a pale ghost: they can’t touch your story, nor you theirs">
      <b>{trav.count}</b> {trav.count === 1 ? 'traveller' : 'travellers'} here
      {trav.allies > 0 && <em className="town-allies"> · {alliesText(trav.allies, trav.count)}</em>}
    </span>
  );
}
