import { Suspense, lazy, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiCloseLine, RiGroupLine } from 'react-icons/ri';
import { NAME_MAX } from './names';
import { AWAY, UNIVERSE, isFlight, placeName } from './where';
import { rosterWhere } from './rosterWhere';
import { crewById } from '../crews';
import { paintById } from '../paint';
import Face from '../Faces';
import { factionText, relation } from './relations';
import { isMate } from './mates';
import { openParty } from '../../../lib/palette';
import { WORDS } from '../../../lib/words';
import './online.css';
import './party.css';

// Multiplayer, in the bottom-left corner (of the universe map, or, once
// you're online, of every other page: `floating`): a button that says how
// many pilots are online (or offers to go online), and a card above it with
// either the way in (your callsign, and what going online means) or who's
// online, what they fly (and in what paint), their kills, which page they're on (with a button
// to go there too; out on the universe map, which region, from where they
// were last seen: rosterWhere.js), and the buttons to ask them to be allies, accept,
// decline or end an alliance, or block them, whether live pointers
// show on pages, and whether your key is kept in this browser (identity.js:
// “Remember me on this browser”, and “New identity”, asked once), or, in a
// tab opened while another's online on it, that this one flies as a guest.
// What's happening (who came online or came to your page,
// alliances, who shot down whom) shows in a short feed above the button.
// useOnline.js keeps the state. A click on a pilot's tag over the map (a
// `tp:pilot` event, pilots.js) opens the list on them. Each row says whose
// side the pilot flies for (relations.js: their oath and rank, how the law
// sees them) with their level, coloured by how they stand to you; your own
// row opens your flight record (Record.jsx, loaded only then: it brings the
// wallet).
//
// A pilot flying where you're flying, when you have a ship, has “Fly to”:
// the autopilot takes you to them (online.follow, which the page acts on).
// “Go” to another place you fly in follows them there, and the ship sets
// off after them once it's in.
//
// Your allies come first, in a section of their own (allies.js keeps them
// in this browser): those online, with everything a row has, then those
// saved and away (room.away), each with when they were last seen and
// Remove.
//
// Your party comes before them (partyLink.js, as useOnline's `party`): a line
// saying whose party you're in and who of it is online, with Party, the way
// to its dialog (PartyDialog.jsx, through lib/palette's openParty), marked
// while an invite or an unread line waits; the invites themselves, to accept
// or turn down here; and the members online, first of all, in the ally green.
// An invite counts on the corner's badge as an ally's ask does.

const TONE = { join: 'join', ally: 'ally', kill: 'kill', info: 'info' };
const WHERE_MS = 2000; // how often the roster looks again at where everyone on the map is
const Record = lazy(() => import('../Record'));

// how long ago, in words (“3 days ago”, “yesterday”), for an ally's last seen
const RELATIVE = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' }) : null;
const UNITS = [
  ['year', 365 * 864e5],
  ['month', 30 * 864e5],
  ['week', 7 * 864e5],
  ['day', 864e5],
  ['hour', 36e5],
  ['minute', 6e4],
];
function ago(at, now = Date.now()) {
  const gap = Math.max(0, now - at);
  for (const [unit, ms] of UNITS) {
    const n = Math.floor(gap / ms);
    if (n >= 1) return RELATIVE ? RELATIVE.format(-n, unit) : `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

export default function Online({ online, ship = null, floating = false }) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(null); // the pilot whose tag was clicked
  const { on, room, feed } = online;
  useEffect(() => {
    const show = (e) => {
      setFocus(e.detail?.id ?? null);
      setOpen(true);
    };
    window.addEventListener('tp:pilot', show);
    return () => window.removeEventListener('tp:pilot', show);
  }, []);
  const count = on ? room.peers.filter((p) => !p.blocked).length + 1 : 0;
  const here = room.peers.filter((p) => !p.blocked && p.where === online.where).length;
  const asks = room.peers.filter((p) => p.ally === 'got' && !p.blocked).length + (online.party?.invites?.length ?? 0);
  const label = !on ? 'Multiplayer' : room.status === 'connecting' ? 'Connecting…' : room.status === 'failed' ? 'Couldn’t connect' : `${count} ${count === 1 ? 'pilot' : 'pilots'} online${floating && here ? ` · ${here} here` : ''}`;
  const short = !on ? 'Join' : room.status === 'online' ? String(count) : room.status === 'failed' ? '!' : '…'; // (a phone's corner is tight)

  const close = () => setOpen(false);
  const onKeyDown = (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault(); // (the page's Escape leaves the universe otherwise)
    close();
  };

  return (
    <div className={floating ? 'universe-online dark-scope' : 'universe-online'} data-floating={floating || undefined} onKeyDown={onKeyDown}>
      <div className="universe-online-feed" aria-live="polite">
        {feed.map((f) => (
          <p key={f.id} className="universe-online-note" data-tone={TONE[f.tone] ?? 'info'}>
            {f.text}
          </p>
        ))}
      </div>
      {open && (on ? <Roster online={online} ship={ship} floating={floating} focus={focus} onClose={close} /> : <Join online={online} onClose={close} />)}
      <button type="button" className="universe-online-pill" data-tour="online" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="universe-online-dot" data-status={on ? room.status : 'off'} aria-hidden="true" />
        <RiGroupLine className="h-4 w-4" aria-hidden="true" />
        <span className="universe-online-full">{label}</span>
        <span className="universe-online-short" aria-hidden="true">
          {short}
        </span>
        {asks > 0 && <span className="universe-online-badge">{asks}</span>}
      </button>
    </div>
  );
}

function Card({ title, onClose, children }) {
  return (
    <section className="universe-online-card" aria-label={title}>
      <div className="universe-online-head">
        <p className="eyebrow">{title}</p>
        <button type="button" className="universe-online-x" onClick={onClose} aria-label="Close">
          <RiCloseLine className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {children}
    </section>
  );
}

function Join({ online, onClose }) {
  const [name, setName] = useState(online.suggest);
  const id = useId();
  const input = useRef(null);
  useEffect(() => input.current?.focus(), []);
  const submit = (e) => {
    e.preventDefault();
    online.goOnline(name);
  };
  return (
    <Card title="Multiplayer" onClose={onClose}>
      <form onSubmit={submit}>
        <h2 className="universe-online-title">Fly with whoever else is here</h2>
        <p className="universe-online-text">
          Go online and everyone else on the site right now shows up: in their own ship out here, callsign over it, and as a live pointer on any page you’re both on. Ask someone to be allies,
          or shoot it out.
        </p>
        <label className="universe-online-label" htmlFor={id}>
          Your callsign
        </label>
        <input ref={input} id={id} className="universe-online-input" value={name} maxLength={NAME_MAX * 2} autoComplete="nickname" spellCheck={false} onChange={(e) => setName(e.target.value)} />
        <div className="universe-online-buttons">
          <button type="submit" className="btn btn-primary btn-sm">
            Go online
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Not now
          </button>
        </div>
        <p className="universe-online-fine">
          Everything goes through public Nostr relays (free servers run by others), so it works from any network and other pilots never see your IP address. Your callsign and a key for
          this browser are kept here, so allies know you next time. Nothing is stored anywhere else.
        </p>
      </form>
    </Card>
  );
}

function Roster({ online, ship, floating, focus, onClose }) {
  const { room } = online;
  const [renaming, setRenaming] = useState(false);
  const [record, setRecord] = useState(false); // your flight record, in the list's place
  const [name, setName] = useState(online.name ?? '');
  const id = useId();
  const others = room.peers;
  // your party first (those of it online), then your allies: those here, then those saved and away
  const members = new Set((online.party?.party?.members ?? []).map((m) => m.id));
  const inParty = (p) => !p.blocked && (p.mate === true || members.has(p.id));
  const isAlly = (p) => p.ally === 'ally' && !p.blocked;
  const mates = others.filter(inParty);
  const allies = others.filter((p) => isAlly(p) && !inParty(p));
  const rest = others.filter((p) => !isAlly(p) && !inParty(p));
  const invites = online.party?.invites ?? [];
  const away = room.away ?? [];
  // (poses come in ten times a second, not as roster news: while anyone's
  // out on the map, the regions they're in are read again now and then)
  const [, tick] = useState(0);
  const mapped = others.some((p) => p.where === UNIVERSE);
  useEffect(() => {
    if (!mapped) return undefined;
    const t = setInterval(() => tick((n) => n + 1), WHERE_MS);
    return () => clearInterval(t);
  }, [mapped]);
  const rename = (e) => {
    e.preventDefault();
    setName(online.rename(name));
    setRenaming(false);
  };
  if (record)
    return (
      <Card title="Multiplayer" onClose={onClose}>
        <Suspense fallback={<p className="universe-online-text">Opening the record…</p>}>
          <Record open onClose={() => setRecord(false)} />
        </Suspense>
      </Card>
    );
  return (
    <Card title="Multiplayer" onClose={onClose}>
      {renaming ? (
        <form className="universe-online-rename" onSubmit={rename}>
          <label className="sr-only" htmlFor={id}>
            Your callsign
          </label>
          <input id={id} className="universe-online-input" value={name} maxLength={NAME_MAX * 2} autoFocus spellCheck={false} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn btn-primary btn-sm">
            Save
          </button>
        </form>
      ) : (
        <div className="universe-online-me">
          <span>
            You’re <b>{online.name}</b>
            {room.self?.level ? ` · Lv ${room.self.level}` : ''}
            {room.self?.kills ? ` · ${room.self.kills} ${room.self.kills === 1 ? 'kill' : 'kills'}` : ''}
          </span>
          <span className="universe-online-mine">
            <button type="button" className="universe-online-link" onClick={() => setRecord(true)}>
              Record
            </button>
            <button type="button" className="universe-online-link" onClick={() => setRenaming(true)}>
              Rename
            </button>
          </span>
        </div>
      )}
      {room.status === 'failed' ? (
        <p className="universe-online-text">
          Couldn’t reach the other pilots.{' '}
          <button type="button" className="universe-online-link" onClick={online.retry}>
            Try again
          </button>
        </p>
      ) : room.status === 'connecting' ? (
        <p className="universe-online-text">Looking for other pilots…</p>
      ) : (
        <>
          <PartyLine online={online} />
          {invites.length > 0 && (
            <section className="universe-online-allies" aria-label="Party invites">
              <p className="universe-online-label">Invites</p>
              <ul className="universe-online-list">
                {invites.map((inv) => (
                  <li key={inv.from} className="universe-online-pilot" data-ally="">
                    <span className="universe-online-face" aria-hidden="true" />
                    <span className="universe-online-who">
                      <span className="universe-online-name">
                        <b>{inv.name}</b>
                      </span>
                      <span>asks you to their party</span>
                    </span>
                    <span className="universe-online-acts">
                      <button type="button" className="universe-online-act" data-yes="" onClick={() => online.partyDo('accept', inv.from)} aria-label={`Join ${inv.name}’s party`}>
                        Accept
                      </button>
                      <button type="button" className="universe-online-act" onClick={() => online.partyDo('decline', inv.from)} aria-label={`Turn down ${inv.name}’s invite`}>
                        Decline
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {mates.length > 0 && (
            <section className="universe-online-allies" aria-label="Your party">
              <p className="universe-online-label">Your party</p>
              <ul className="universe-online-list">
                {mates.map((p) => (
                  <Pilot key={p.id} p={p} online={online} ship={ship} mine={room.self?.factions ?? null} focus={focus === p.id} mate />
                ))}
              </ul>
            </section>
          )}
          {(allies.length > 0 || away.length > 0) && (
            <section className="universe-online-allies" aria-label="Allies">
              <p className="universe-online-label">Allies</p>
              <ul className="universe-online-list">
                {allies.map((p) => (
                  <Pilot key={p.id} p={p} online={online} ship={ship} mine={room.self?.factions ?? null} focus={focus === p.id} />
                ))}
                {away.map((a) => (
                  <Away key={a.id} a={a} online={online} />
                ))}
              </ul>
            </section>
          )}
          {!others.length ? (
            <p className="universe-online-text">No one else is online right now. Anyone who opens the site and goes online shows up here, and on the map.</p>
          ) : (
            rest.length > 0 && (
              <ul className="universe-online-list">
                {rest.map((p) => (
                  <Pilot key={p.id} p={p} online={online} ship={ship} mine={room.self?.factions ?? null} focus={focus === p.id} />
                ))}
              </ul>
            )
          )}
        </>
      )}
      {!floating && !ship && room.status === 'online' && <p className="universe-online-fine">Pick a ship in the panel to fly with them; till then you’re watching.</p>}
      <label className="universe-online-check">
        <input type="checkbox" checked={online.pointers} onChange={(e) => online.showPointers(e.target.checked)} />
        Live pointers on pages, yours and theirs
      </label>
      {online.guestTab ? <p className="universe-online-fine">You’re online in another tab: this one flies as a guest.</p> : <Identity online={online} />}
      <p className="universe-online-fine">Through public relays: other pilots never see your IP address.</p>
      <button type="button" className="universe-online-link universe-online-leave" onClick={online.goOffline}>
        Go offline
      </button>
    </Card>
  );
}

// Your party in a line (whose, and how many of it are online), and Party:
// the dialog, with a dot while an invite or a line you haven't read waits
function PartyLine({ online }) {
  const party = online.party?.party ?? null;
  const invites = online.party?.invites?.length ?? 0;
  const unread = online.unread ?? 0;
  const lead = party?.members.find((m) => m.leader) ?? null;
  const on = party ? party.members.filter((m) => m.present).length : 0;
  const says = !party ? 'Not in a party' : `${lead?.you ? 'Your party' : `${lead?.name ?? 'Their'}’s party`} · ${on} of ${party.members.length} online`;
  const waits = [invites && `${invites} ${invites === 1 ? 'invite' : 'invites'}`, unread && `${unread} unread`].filter(Boolean).join(', ');
  return (
    <div className="universe-online-party">
      <span>{says}</span>
      <button type="button" className="universe-online-act" aria-haspopup="dialog" aria-label={waits ? `${WORDS.party}: ${waits}` : undefined} onClick={() => openParty()}>
        {WORDS.party}
        {waits && <span className="party-dot" aria-hidden="true" />}
      </button>
    </div>
  );
}

// A saved ally who isn't here: when they were last seen, and Remove
function Away({ a, online }) {
  return (
    <li className="universe-online-pilot" data-away="">
      <span className="universe-online-face" aria-hidden="true" />
      <span className="universe-online-who">
        <span className="universe-online-name">
          <b>{a.name}</b>
        </span>
        <span>{`last seen ${ago(a.seen)}`}</span>
      </span>
      <span className="universe-online-acts">
        <button type="button" className="universe-online-link" onClick={() => online.removeAlly(a.id)} aria-label={`Remove ${a.name} from your allies`}>
          Remove
        </button>
      </span>
    </li>
  );
}

// Your key kept in this browser or not (identity.js), and a new one, asked once
function Identity({ online }) {
  const [asking, setAsking] = useState(false);
  const id = useId();
  return (
    <div className="universe-online-identity">
      <div className="universe-online-remember">
        <span id={id}>Remember me on this browser</span>
        <div className="switch" data-size="sm" role="group" aria-labelledby={id}>
          <button type="button" aria-pressed={online.remember} onClick={() => online.setRemember(true)}>
            On
          </button>
          <button type="button" aria-pressed={!online.remember} onClick={() => online.setRemember(false)}>
            Off
          </button>
        </div>
      </div>
      {asking ? (
        <p className="universe-online-fine">
          Your allies won’t know you: they stay in your list, and each alliance is asked for afresh. Start again?{' '}
          <button
            type="button"
            className="universe-online-link"
            onClick={() => {
              setAsking(false);
              online.newIdentity();
            }}
          >
            Start again
          </button>{' '}
          <button type="button" className="universe-online-link" onClick={() => setAsking(false)}>
            Keep this one
          </button>
        </p>
      ) : (
        <button type="button" className="universe-online-link universe-online-renew" onClick={() => setAsking(true)}>
          New identity
        </button>
      )}
    </div>
  );
}

function Pilot({ p, online, ship, mine, focus, mate = false }) {
  const navigate = useNavigate();
  const row = useRef(null);
  useEffect(() => {
    if (focus) row.current?.scrollIntoView({ block: 'nearest' });
  }, [focus]);
  const crew = crewById(p.kind);
  const who = crew ? Object.keys(crew.speakers)[0] : null;
  const coat = paintById(p.loadout?.paint);
  const act = (what) => () => online.ally(p.id, what);
  const elsewhere = p.where && p.where !== online.where;
  // (out on the map, the region they're in says more than “here” does, the map being as wide as it is)
  const pose = p.where === UNIVERSE ? (online.client?.poseOf?.(p.id) ?? null) : null;
  const at = !p.where ? '' : pose ? ` · ${rosterWhere(p.where, pose)}` : elsewhere ? ` · ${placeName(p.where)}` : ' · here';
  // (flying here too, in a ship: somewhere the autopilot can take you, on
  // the universe map or in the same galaxy system)
  const flyTo = Boolean(ship && p.kind && p.where && !elsewhere && isFlight(online.where));
  const goTo = () => {
    if (isFlight(p.where)) online.follow(p.id); // (and after them, once the ship's in there)
    navigate(p.where === UNIVERSE ? '/universe' : p.where);
  };
  const sides = factionText(p.factions);
  // (an ally or a mate in your party: the ally green, as their tag over the map has it)
  const friend = isMate(p) || (mate && !p.blocked);
  return (
    <li ref={row} className="universe-online-pilot" data-focus={focus || undefined} data-ally={friend || undefined} data-blocked={p.blocked || undefined} data-relation={p.blocked ? undefined : relation({ ally: friend, factions: mine }, p)}>
      {who ? <Face who={who} className="universe-online-face" /> : <span className="universe-online-face" aria-hidden="true" />}
      <span className="universe-online-who">
        <span className="universe-online-name">
          <b>{p.blocked ? 'Blocked pilot' : p.name}</b>
          {!p.blocked && <em className="universe-online-lv">Lv {p.level ?? 1}</em>}
        </span>
        <span>
          {p.blocked ? 'hidden' : crew ? `${crew.ship.replace(/^(The|An) /, '')}${coat.hull ? ` in ${coat.name}` : ''}` : 'no ship yet'}
          {!p.blocked && sides ? ` · ${sides}` : ''}
          {!p.blocked && at}
          {!p.blocked && p.kills ? ` · ${p.kills} ${p.kills === 1 ? 'kill' : 'kills'}` : ''}
          {p.ally === 'ally' && !p.blocked ? ' · ally' : ''}
          {mate && !p.blocked ? ' · in your party' : ''}
        </span>
      </span>
      <span className="universe-online-acts">
        {p.blocked ? (
          <button type="button" className="universe-online-link" onClick={() => online.block(p.id, false)}>
            Unblock
          </button>
        ) : (
          <>
            {elsewhere && p.where !== AWAY && (
              <button type="button" className="universe-online-act" onClick={goTo} aria-label={`Go to ${placeName(p.where)}, where ${p.name} is`}>
                Go
              </button>
            )}
            {flyTo && (
              <button type="button" className="universe-online-act" onClick={() => online.follow(p.id)} aria-label={`Fly to ${p.name}`}>
                Fly to
              </button>
            )}
            {p.ally === 'none' && (
              <button type="button" className="universe-online-act" onClick={act('ask')}>
                Ally
              </button>
            )}
            {p.ally === 'sent' && (
              <button type="button" className="universe-online-act" onClick={act('end')} title="Asked: click to take it back" aria-label={`Cancel your request to ${p.name}`}>
                Asked…
              </button>
            )}
            {p.ally === 'got' && (
              <>
                <button type="button" className="universe-online-act" data-yes="" onClick={act('accept')}>
                  Accept
                </button>
                <button type="button" className="universe-online-act" onClick={act('decline')}>
                  Decline
                </button>
              </>
            )}
            {p.ally === 'ally' && (
              <button type="button" className="universe-online-act" onClick={act('end')} aria-label={`End your alliance with ${p.name}`}>
                End
              </button>
            )}
            <button type="button" className="universe-online-link" onClick={() => online.block(p.id, true)} aria-label={`Block ${p.name}`}>
              Block
            </button>
          </>
        )}
      </span>
    </li>
  );
}
