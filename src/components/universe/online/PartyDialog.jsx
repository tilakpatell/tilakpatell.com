import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CloseButton } from '../../ui';
import { WORDS } from '../../../lib/words';
import { focusBack, wrapFocus } from '../../../lib/focus';
import { NAME_MAX } from './names';
import { AWAY, UNIVERSE, isFlight, placeName } from './where';
import { CHAT_MAX, PARTY_MAX } from './partyWire';
import { SUMMON_GAP } from './partyLimits';
import { QUIPS, QUIP_MS } from './quips';
import './party.css';

// The party's dialog, one for the whole site: opened by lib/palette's
// openParty (the online corner's Party, ⌘K's "Party" and "Quick chat", a
// world's players chip), heard and loaded the first time by PartyHost.jsx.
// Three tabs, the house switch as a tablist: the Party (who's in it, who
// leads, where each of them is or that they're not online, the invites
// waiting, Invite from those online, and the leader's Remove, Make leader and
// Summon; a member's Follow the leader), the Chat (the party's lines this
// visit and a field: sealed for each mate online, partyCrypt.js, so no one
// else reads them) and Quick chat (the set lines, quips.js, over you for
// anyone near). Offline, each tab is the corner's way online (Online.jsx's
// Join). useOnline.js keeps the state; the link (partyLink.js) does what's
// asked of it, and says so back in its snapshot.
//
// A modal, as the settings sheet is: a scrim over the page, focus in on the
// tab you're on and kept in, Esc first (in the capture phase, so the world
// under it doesn’t also back out), every other key kept from the world (bar
// ⌘K and the like), the page held still, and focus back to whatever opened
// it. In a portal on the body, out of the map’s dark scope,
// so it wears the page's own theme and mode; a sheet from the bottom on a
// phone (party.css). PartyCalls, the notices a member gets (a summons, the
// leader on the move), is here too, so its look loads with the dialog's.

const TABS = [
  ['party', WORDS.party],
  ['chat', 'Chat'],
  ['quick', WORDS.quickChat],
];
const pick = (tab) => (TABS.some(([id]) => id === tab) ? tab : 'party');
const NO_PARTY = { party: null, invites: [], follow: false };

// the focusable things in the sheet, for keeping Tab inside it (a tab not
// chosen is reached by the arrow keys, not by Tab)
const focusables = (el) => [...el.querySelectorAll('button, a[href], input, [tabindex]')].filter((x) => !x.disabled && x.tabIndex >= 0 && x.getClientRects().length > 0);

const CLOCK = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }) : null;
// (a line's time is when this browser heard it: useOnline.js stamps it `seen`)
const when = (seen) => (Number.isFinite(seen) ? { iso: new Date(seen).toISOString(), text: CLOCK ? CLOCK.format(seen) : '' } : null);
// where a member is taken by Go: the page, and the ship after them once it's in where you fly
const pathOf = (where) => (where === UNIVERSE ? '/universe' : where);

export default function PartyDialog(props) {
  return createPortal(<PartySheet {...props} />, document.body);
}

// The dialog itself (PartyDialog puts it on the body). `request` is what
// openParty asked ({ tab }); a new one while it's up turns to its tab.
export function PartySheet({ online, request, onClose }) {
  const [tab, setTab] = useState(() => pick(request?.tab));
  const [asked, setAsked] = useState(request);
  if (request !== asked) {
    setAsked(request);
    setTab(pick(request?.tab));
  }
  const sheet = useRef(null);
  const ids = useId();

  // focus in, kept in, and given back on the way out; Esc closes, before anything under it hears
  useEffect(() => {
    const was = document.activeElement;
    const into = requestAnimationFrame(() => sheet.current?.querySelector('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true }));
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !sheet.current) return;
      const items = focusables(sheet.current);
      const at = document.activeElement;
      // (a stop in the sheet that isn’t one of them takes the browser’s own
      // step: the chat’s list, once it scrolls, is one the browser makes, and
      // sent back to the tabs from it, Tab would never reach the field. Not a
      // control gone dead under focus, as Send does while a line goes: where
      // a browser leaves focus on it, its own step is out past the last stop)
      if (sheet.current.contains(at) && !items.includes(at) && !at.disabled) return;
      const next = wrapFocus(items, at, e.shiftKey);
      if (!next) return;
      e.preventDefault();
      next.focus();
    };
    window.addEventListener('keydown', onKey, true);
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(into);
      window.removeEventListener('keydown', onKey, true);
      html.style.overflow = overflow;
      // (back to what opened it; failing that, the online corner's button)
      focusBack(was, () => document.querySelector('[data-tour="online"]'));
    };
  }, [onClose]);

  // the chat in view is the chat read, as each line comes
  const { markRead } = online;
  const last = online.chat?.at(-1)?.key;
  useEffect(() => {
    if (tab === 'chat') markRead?.();
  }, [tab, last, markRead]);

  // tabs: the arrow keys move between them, as tabs do
  const onTabKey = (e) => {
    const at = TABS.findIndex(([id]) => id === tab);
    const to = { ArrowRight: at + 1, ArrowLeft: at - 1 + TABS.length, Home: 0, End: TABS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = TABS[to % TABS.length][0];
    setTab(next);
    requestAnimationFrame(() => document.getElementById(`${ids}-${next}`)?.focus());
  };
  const unread = tab !== 'chat' && online.unread > 0 ? online.unread : 0;
  // (a key pressed in the dialog goes no further: the world under it listens
  // on the window, and would walk or jump on an arrow, or take Space and
  // Enter for itself, so the button they were pressed on never heard them;
  // ⌘K and the like still reach the page)
  const hold = (e) => {
    if (!e.metaKey && !e.ctrlKey && !e.altKey) e.stopPropagation();
  };

  return (
    <div className="party-scrim" onKeyDown={hold} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={sheet} className="party-dialog card dialog" role="dialog" aria-modal="true" aria-labelledby={`${ids}-title`}>
        <div className="party-head">
          <h2 id={`${ids}-title`} className="dialog-title">
            {WORDS.party}
          </h2>
          <div className="party-tabs switch" data-size="md" role="tablist" aria-label={WORDS.party}>
            {TABS.map(([id, label]) => (
              <button key={id} id={`${ids}-${id}`} role="tab" type="button" aria-selected={tab === id} aria-controls={`${ids}-panel`} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={onTabKey}>
                {label}
                {id === 'chat' && unread > 0 && (
                  <>
                    <span className="party-dot" aria-hidden="true" />
                    <span className="sr-only">{`, ${unread} new`}</span>
                  </>
                )}
              </button>
            ))}
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <div id={`${ids}-panel`} role="tabpanel" aria-labelledby={`${ids}-${tab}`} className="party-body">
          {tab === 'chat' ? <ChatTab online={online} /> : tab === 'quick' ? <QuickTab online={online} /> : <PartyTab online={online} onGo={onClose} />}
        </div>
      </div>
    </div>
  );
}

// Offline, or not through yet: the way online, or what's happening instead (else null)
function Gate({ online }) {
  if (!online.on) return <GoOnline online={online} />;
  const status = online.room?.status;
  if (status === 'failed')
    return (
      <p className="party-text">
        Couldn’t reach the other pilots.{' '}
        <button type="button" className="party-link" onClick={online.retry}>
          Try again
        </button>
      </p>
    );
  if (status !== 'online') return <p className="party-text">Looking for other pilots…</p>;
  return null;
}

// The corner's way online (Online.jsx's Join), in the dialog's own words
function GoOnline({ online }) {
  const [name, setName] = useState(online.suggest);
  const id = useId();
  const submit = (e) => {
    e.preventDefault();
    online.goOnline(name);
  };
  return (
    <form className="party-join" onSubmit={submit}>
      <h3 className="party-title">Go online to fly in a party</h3>
      <p className="party-text">
        Online, everyone else on the site right now shows up: in their own ship on the map, callsign over it, and as a live pointer on any page you’re both on. Make a party with any of them, chat
        with it, or say a quick line over your ship.
      </p>
      <label className="label" htmlFor={id}>
        Your callsign
      </label>
      <input id={id} className="party-input" value={name} maxLength={NAME_MAX * 2} autoComplete="nickname" spellCheck={false} onChange={(e) => setName(e.target.value)} />
      <div className="party-buttons">
        <button type="submit" className="btn btn-primary btn-sm">
          Go online
        </button>
      </div>
      <p className="party-fine">
        Everything goes through public Nostr relays (free servers run by others), so it works from any network and other pilots never see your IP address. Your callsign and a key for this
        browser are kept here, so allies know you next time. Nothing is stored anywhere else.
      </p>
    </form>
  );
}

// The Party tab. `onGo`: the dialog closes as Go takes you to a member.
export function PartyTab({ online, onGo = null }) {
  const navigate = useNavigate();
  const [asked, setAsked] = useState(() => new Set()); // invited while the dialog's been up
  // the leader’s last Summon, said in a status line ({ ok, text, n }): held
  // for the gap the link keeps between two, so a press in it isn’t lost unsaid
  const [called, setCalled] = useState(null);
  useEffect(() => {
    if (!called) return undefined;
    const t = setTimeout(() => setCalled(null), SUMMON_GAP);
    return () => clearTimeout(t);
  }, [called]);
  const id = useId();
  const gate = Gate({ online });
  if (gate) return gate;
  const snap = online.party ?? NO_PARTY;
  const party = snap.party;
  const act = (name, ...args) => () => online.partyDo(name, ...args);
  const invites = snap.invites ?? [];
  const invited = invites.length > 0 && (
    <section className="party-section" aria-labelledby={`${id}-invites`}>
      <p id={`${id}-invites`} className="label">
        Invites
      </p>
      <ul className="party-list">
        {invites.map((inv) => (
          <li key={inv.from} className="party-row" data-invite="">
            <span className="party-who">
              <span>
                <b>{inv.name}</b> asks you to their party
              </span>
              {party && <span className="party-sub">Joining theirs leaves yours</span>}
            </span>
            <span className="party-acts">
              <button type="button" className="btn btn-primary btn-sm" onClick={act('accept', inv.from)} aria-label={`Join ${inv.name}’s party`}>
                Accept
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={act('decline', inv.from)} aria-label={`Turn down ${inv.name}’s invite`}>
                Decline
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
  if (!party)
    return (
      <>
        {invited}
        <section className="party-section">
          <h3 className="party-title">You’re not in a party</h3>
          <p className="party-text">
            Start one and invite whoever’s online: up to {PARTY_MAX} of you, in the ally green wherever you’re drawn, with a chat no one else can read. Your party is kept in this browser,
            so it’s there when you’re next online.
          </p>
          <div className="party-buttons">
            <button type="button" className="btn btn-primary btn-sm" onClick={act('start')}>
              Start a party
            </button>
          </div>
        </section>
      </>
    );

  const leader = party.members.find((m) => m.leader) ?? null;
  const leading = Boolean(leader?.you);
  const inIt = new Set(party.members.map((m) => m.id));
  const others = party.members.filter((m) => !m.you && m.present);
  const full = party.members.length >= PARTY_MAX;
  // (your allies first among them, each list as the roster has it)
  const pilots = (online.room?.peers ?? []).filter((p) => !p.blocked && p.name && !inIt.has(p.id)).sort((a, b) => Number(b.ally === 'ally') - Number(a.ally === 'ally'));
  const goTo = (m) => {
    if (isFlight(m.where)) online.follow(m.id); // (and after them, once the ship's in there)
    navigate(pathOf(m.where));
    onGo?.();
  };
  const invite = (p) => {
    if (asked.has(p.id)) return;
    online.partyDo('invite', p.id);
    setAsked((s) => new Set(s).add(p.id));
  };
  const summonable = others.length > 0 && online.where && online.where !== AWAY;
  const summon = () => {
    if (called?.ok) return;
    const ok = Boolean(online.partyDo('summon'));
    const who = others.length === 1 ? others[0].name : `${others.length} of your party`;
    const text = ok ? `Summoned ${who} to ${placeName(online.where)}` : 'That summons didn’t go: try again in a moment';
    setCalled((was) => ({ ok, text, n: (was?.n ?? 0) + 1 }));
  };

  return (
    <>
      {invited}
      <section className="party-section" aria-labelledby={`${id}-members`}>
        <div className="party-heading">
          <p id={`${id}-members`} className="label">
            {leading ? 'Your party' : `${leader?.name ?? 'Their'}’s party`}
          </p>
          <span className="party-count">{`${party.members.length} of ${PARTY_MAX}`}</span>
        </div>
        <ul className="party-list">
          {party.members.map((m) => {
            const elsewhere = m.present && !m.you && m.where && m.where !== online.where;
            const at = !m.present ? 'not online' : m.you ? placeName(online.where) : m.where === online.where ? 'here with you' : placeName(m.where);
            return (
              <li key={m.id} className="party-row" data-you={m.you || undefined} data-mate={!m.you || undefined} data-away={!m.present || undefined}>
                <span className="party-who">
                  <span className="party-name">
                    <b>{m.name}</b>
                    {m.leader && <span className="chip chip-sm">{WORDS.leader}</span>}
                    {m.you && <span className="party-you">you</span>}
                  </span>
                  <span className="party-sub" data-where="">
                    {at}
                  </span>
                </span>
                <span className="party-acts">
                  {elsewhere && m.where !== AWAY && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => goTo(m)} aria-label={`Go to ${placeName(m.where)}, where ${m.name} is`}>
                      Go
                    </button>
                  )}
                  {leading && !m.you && (
                    <>
                      {/* (only to someone online: a leader who isn't would hold the party up till they were) */}
                      {m.present && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={act('promote', m.id)} aria-label={`Make ${m.name} leader`}>
                          Make leader
                        </button>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm party-remove" onClick={act('remove', m.id)} aria-label={`Remove ${m.name} from the party`}>
                        Remove
                      </button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        {leading ? (
          <>
            <div className="party-summon">
              <span className="party-sub">{summonable ? `Calls everyone in it who’s online to ${placeName(online.where)}` : 'Calls your party to you, once anyone else in it is online'}</span>
              <button type="button" className="btn btn-primary btn-sm" onClick={summon} disabled={!summonable} aria-disabled={called?.ok || undefined}>
                {WORDS.summon}
              </button>
            </div>
            {/* (keyed, so the same words twice are read out twice) */}
            <p className="party-fine" role="status">
              {called && <span key={called.n}>{called.text}</span>}
            </p>
          </>
        ) : (
          <div className="party-follow">
            <span id={`${id}-follow`}>
              {WORDS.followLeader}
              <span className="party-sub">{`Go where ${leader?.name ?? 'your leader'} goes, after a moment to stay`}</span>
            </span>
            <div className="switch" data-size="sm" role="group" aria-labelledby={`${id}-follow`}>
              <button type="button" aria-pressed={Boolean(online.followLeader)} onClick={() => online.setFollowLeader(true)}>
                On
              </button>
              <button type="button" aria-pressed={!online.followLeader} onClick={() => online.setFollowLeader(false)}>
                Off
              </button>
            </div>
          </div>
        )}
      </section>
      <section className="party-section" aria-labelledby={`${id}-invite`}>
        <p id={`${id}-invite`} className="label">
          Invite
        </p>
        {full ? (
          <p className="party-text">{`Your party is full: ${PARTY_MAX} is as many as fly together.`}</p>
        ) : pilots.length ? (
          <ul className="party-list">
            {pilots.map((p) => {
              const was = asked.has(p.id);
              return (
                <li key={p.id} className="party-row" data-ally={p.ally === 'ally' || undefined}>
                  <span className="party-who">
                    <span className="party-name">
                      <b>{p.name}</b>
                    </span>
                    <span className="party-sub">
                      {p.ally === 'ally' ? 'your ally · ' : ''}
                      {placeName(p.where)}
                    </span>
                  </span>
                  {/* (asked, it stays in the Tab order, marked and doing nothing:
                      a disabled button would drop the keyboard’s place after each invite) */}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => invite(p)} aria-disabled={was || undefined} aria-label={`${was ? 'Asked' : 'Invite'} ${p.name} to your party`}>
                    {was ? 'Asked' : 'Invite'}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="party-text">No one else is online to invite right now.</p>
        )}
      </section>
      <div className="party-buttons">
        <button type="button" className="btn btn-ghost btn-sm" onClick={act('leave')}>
          Leave the party
        </button>
      </div>
    </>
  );
}

// The Chat tab: the party’s lines this visit, and a field. Only this party’s:
// each line comes stamped with the party it was sealed in (partyLink.js), and
// those of one you’ve left stay that one’s, not the next one’s to read.
export function ChatTab({ online }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = useId();
  const list = useRef(null);
  const last = online.chat?.at(-1)?.key;
  // (the newest line in view, as a chat keeps it)
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last]);
  const gate = Gate({ online });
  if (gate) return gate;
  const party = online.party?.party ?? null;
  if (!party)
    return (
      <section className="party-section">
        <h3 className="party-title">Start or join a party to chat</h3>
        <p className="party-text">A party’s lines go to its members alone, sealed so no one else can read them.</p>
        <div className="party-buttons">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => online.partyDo('start')}>
            Start a party
          </button>
        </div>
      </section>
    );
  const lines = (online.chat ?? []).filter((l) => l.party === party.id);
  const mates = party.members.filter((m) => !m.you && m.present).length;
  const count = [...text].length;
  const send = async (e) => {
    e.preventDefault();
    const line = text.trim();
    if (!line || !mates || sending) return;
    setSending(true);
    setFailed(false);
    let sent = false;
    try {
      sent = await online.say(line);
    } catch {
      sent = false; // (it didn't go: said so under the field)
    }
    setSending(false);
    if (sent) setText('');
    else setFailed(true);
  };
  return (
    <>
      {/* (the list is up, empty, before the first line: a line put into a live
          region that’s there is read out, where one born with it in isn’t) */}
      <ol ref={list} className="party-lines" aria-live="polite" aria-label="The party’s chat">
        {lines.map((l) => {
          const t = when(l.seen);
          return (
            <li key={l.key} className="party-line" data-mine={l.mine || undefined}>
              <span className="party-line-head">
                <b>{l.name}</b>
                {t && <time dateTime={t.iso}>{t.text}</time>}
              </span>
              <p>{l.text}</p>
            </li>
          );
        })}
      </ol>
      {!lines.length && <p className="party-text">Nothing said yet this visit.</p>}
      <form className="party-say" onSubmit={send}>
        <label className="sr-only" htmlFor={id}>
          Say to your party
        </label>
        <input
          id={id}
          className="party-input"
          value={text}
          maxLength={CHAT_MAX * 2}
          autoComplete="off"
          enterKeyHint="send"
          placeholder={mates ? 'Say something to your party' : undefined}
          aria-describedby={`${id}-count ${id}-note`}
          // (a line's length is its characters, as the wire counts them: an emoji is one)
          onChange={(e) => setText([...e.target.value].slice(0, CHAT_MAX).join(''))}
        />
        <span id={`${id}-count`} className="party-count" data-full={count >= CHAT_MAX || undefined}>
          {`${count}/${CHAT_MAX}`}
        </span>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!mates || !text.trim() || sending}>
          Send
        </button>
      </form>
      {failed && (
        <p className="party-alert" role="alert">
          That line didn’t go. Try again.
        </p>
      )}
      {!mates && <p className="party-text">No one else in your party is online: a line reaches only those here when it’s said.</p>}
      <p id={`${id}-note`} className="party-fine">
        Only your party reads these: each line is sealed for the mates online as it’s sent, and none is kept after this visit.
      </p>
    </>
  );
}

// The Quick chat tab: the set lines, any of them over you for a moment. The
// status says what went, or that one didn’t (the link holds the next a
// moment after three quick ones), each time afresh so the same line twice
// is heard twice.
export function QuickTab({ online }) {
  const [said, setSaid] = useState(null); // { text, n }: text null when it didn’t go
  const gate = Gate({ online });
  if (gate) return gate;
  const say = (i) => {
    const went = Boolean(online.quip(i));
    setSaid((was) => ({ text: went ? QUIPS[i] : null, n: (was?.n ?? 0) + 1 }));
  };
  return (
    <>
      <p className="party-text">{`Say a line over yourself, and everyone near sees it for ${QUIP_MS / 1000} seconds: over your ship on the map, your pointer on a page, you in a world.`}</p>
      <div className="party-quips" role="group" aria-label={WORDS.quickChat}>
        {QUIPS.map((q, i) => (
          <button key={q} type="button" className="btn btn-ghost btn-sm" onClick={() => say(i)}>
            {q}
          </button>
        ))}
      </div>
      <p className="party-fine" role="status">
        {said && <span key={said.n}>{said.text ? `You said “${said.text}”` : 'Wait a moment before the next line'}</span>}
      </p>
    </>
  );
}

// What a member's asked while the dialog's shut, top centre: a summons
// (`summon` { name, where }: onSummon(go)), or the leader on the move with
// Follow the leader on (`moving` { name, where }: off in `wait` ms, unless
// onStay). The notices alone: PartyHost.jsx puts them in its live region on
// the body (.party-calls, up before them, so they’re read out) and does the
// going.
export function PartyCalls({ summon = null, moving = null, wait = 5000, onSummon = null, onStay = null }) {
  if (!summon && !moving) return null;
  return (
    <>
      {summon && (
        <div className="party-call notice">
          <p>
            <b>{summon.name}</b> summons the party to {placeName(summon.where)}
          </p>
          <span className="party-acts">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onSummon?.(true)}>
              Go
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSummon?.(false)}>
              Not now
            </button>
          </span>
        </div>
      )}
      {moving && (
        <div key={`${moving.id}:${moving.where}`} className="party-call notice">
          <p>
            Following <b>{moving.name}</b> to {placeName(moving.where)}…
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onStay?.()}>
            Stay
          </button>
          <span className="party-call-time" style={{ '--wait': `${wait}ms` }} aria-hidden="true" />
        </div>
      )}
    </>
  );
}
