import { alliesText, othersText } from './hud';
import { openParty } from '../../lib/palette';

// The other players online in this world: "N others here", or a way to see
// them. Plain values, from the world's own link (its useTravellers): `count`,
// `allies` among them (the roster's allies, here with you: the chip says
// "· 1 ally" and wears `data-allies`, so a world can tint it), whether
// you're `on`, `onJoin` to go online, `available` (false: no going online
// here). `noun` is the world's word for them on the way in ("See
// other drivers"); once you're in they're "others" everywhere. `lore`: { off,
// on }, the world's own words for how the others show (a ghost Aztek, a pale
// Mark), as the tooltips. `item`: drawn as a Menu entry rather than a chip.
// Once you're in, the chip is the way to your party (invites, its chat, quick
// chat): a button that calls `onOpen`, lib/palette's openParty unless a world
// hands its own, with no click passed on (a click isn't a tab); `onOpen` null
// keeps it the plain count it was, a status.
export default function PlayersChip({ count = 0, allies = 0, on = true, onJoin = null, onOpen = openParty, available = true, noun = 'players', lore = null, item = false, className = '' }) {
  if (!available) return null;
  const cls = item ? className : `hud-chip hud-players ${className}`.trim();
  if (!on)
    return onJoin ? (
      <button type="button" className={cls || undefined} onClick={onJoin} title={lore?.off ?? 'Go online, and see everyone else here, with their name over them'}>
        See other {noun}
      </button>
    ) : null;
  const shown = {
    className: cls || undefined,
    'data-on': true,
    'data-allies': count > 0 && allies > 0 ? allies : undefined,
    'aria-label': othersText(count, allies) ?? 'No one else here',
    title: lore?.on ?? (onOpen ? 'Everyone else online here: open your party to invite them, chat or say a quick line' : 'Everyone else online here: nothing passes between you but where each of you is'),
  };
  const words =
    count > 0 ? (
      <>
        <b>{count}</b> {count === 1 ? 'other' : 'others'} here{allies > 0 ? ` · ${alliesText(allies, count)}` : ''}
      </>
    ) : (
      'No one else here'
    );
  if (!onOpen)
    return (
      <span {...shown} role={item ? undefined : 'status'}>
        {words}
      </span>
    );
  return (
    <button type="button" {...shown} aria-haspopup="dialog" onClick={() => onOpen()}>
      {words}
    </button>
  );
}
