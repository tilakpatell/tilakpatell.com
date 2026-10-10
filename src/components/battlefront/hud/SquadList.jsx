import { loadRulebook, squadsOf } from '../../../lib/battlefront/rulebook.js';
import { squadListRows } from './widgets.js';

// The squad list (UI/InGame/Hud/SquadMemberList: SquadMemberList, its cell,
// its content and the local player's row): the player, then up to three
// squadmates, each a pin with their class icon and their name on a bar that
// fades out. A mate with an order turns the pin 45° and swaps the icon for
// the objective's letter and back; a fallen mate greys.
// Sizes are the widget's, on the game's 1920 × 1080 reference in 16ths of
// a rem, so the list keeps its proportions and its text stays readable.
//
//   <SquadList squad={{ letter, members: [{ id, name, cls, alive, local, order }] }} option="Default" />
const HUD = squadsOf(loadRulebook()).hud;
const rem = (px) => `${px / 16}rem`;
const SIZES = {
  '--bf-squad-w': rem(HUD.row[0]),
  '--bf-squad-row': rem(HUD.row[1]),
  '--bf-squad-name-x': rem(HUD.name.offset[0]),
  '--bf-squad-box': rem(HUD.icon.box),
  '--bf-squad-pin': rem(HUD.icon.pin),
  '--bf-squad-svg': rem(HUD.icon.svg),
  '--bf-squad-bar-tail': rem(HUD.bar.width),
  '--bf-squad-bar-fade': rem(HUD.bar.width - HUD.bar.solidTo),
};

export default function SquadList({ squad, option = 'Default' }) {
  const rows = squadListRows(squad, { option, hud: HUD });
  if (!rows.length) return null;
  return (
    <ul className="bf-squad" style={SIZES} aria-label={squad.letter ? `Squad ${squad.letter}` : 'Squad'}>
      {rows.map((r) => (
        <li key={r.id} className="bf-squad-row" data-local={r.local || undefined} data-dead={r.dead || undefined} data-order={r.turn || undefined}>
          <span className="bf-squad-icon" style={{ '--bf-squad-in': r.nameColour, '--bf-squad-out': r.iconColour }}>
            <span className="bf-squad-pin" aria-hidden="true" />
            <span className="bf-squad-class" aria-hidden="true" style={{ maskImage: `url("${r.icon}")`, WebkitMaskImage: `url("${r.icon}")` }} />
            {r.letter && <span className="bf-squad-letter">{r.letter}</span>}
          </span>
          {r.showName && (
            <span className="bf-squad-name" style={{ color: r.nameColour }}>
              {r.name}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
