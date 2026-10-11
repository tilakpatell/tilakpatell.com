import { menuItems } from './cards';
import { OFFLINE, percentOf, prune } from './tree';
import { useTree } from './useTree';
import GameScreen from './GameScreen.jsx';

// The in-game menu (IngameMenuMPScreen): the game's items as its tree draws
// them (Resume, Respawn, Scoreboard, Options, Quit), each a button over its
// box; the debug items and those this world has no use for left out.
// Escape resumes. `on[label]` is the item's action; one without says so.
//
// <InGameMenu on={{ RESUME: …, RESPAWN: …, SCOREBOARD: …, QUIT: … }} onComing={(label) => …} />
export default function InGameMenu({ on = {}, onComing }) {
  const raw = useTree('IngameMenuMPScreen');
  const all = menuItems(raw);
  const tree = prune(raw, (b) => OFFLINE(b) || (all.every((i) => i.box.id !== b.id) && /\/MenuItemsContainer\/[^/]+$/.test(b.id)));
  return (
    <GameScreen tree={tree} label="Pause menu" onBack={on.RESUME} keys={[['Enter', 'Select'], ['Esc', 'Resume']]} className="bf-ingame-menu">
      <div className="bf-menu-items">
        {all.map((i) => (
          <button key={i.box.id} type="button" className="bf-menu-item" style={percentOf(raw, i.box)} data-item={i.label} aria-label={i.label} onClick={() => (on[i.label] ? on[i.label]() : onComing?.(i.label))} />
        ))}
      </div>
    </GameScreen>
  );
}
