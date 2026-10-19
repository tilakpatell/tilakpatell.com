import { HULL_KEY, readHulls } from '../shipyard/build';
import { LOOK_KEY, readLooks } from '../../rickmorty/wardrobe/looks';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { local } from '../../../lib/hooks';
import { cleanName, randomCallsign } from './names';
import { isFlight } from './where';
import { LOADOUT_KEY, STOCK_LOADOUT, readLoadouts } from '../outfit';
import { useEconomy } from '../EconomyProvider';

// Going online, for the whole site (OnlineProvider.jsx holds it, so the
// link stays up from page to page): whether you are (asked once on the
// universe map, then remembered for next time), your callsign and ship (and
// what's fitted to it in the hangar),
// which page you're on, the link to the other pilots while you're on
// (client.js, loaded only then; the universe scene and Presence.jsx read
// it), who's here, and a short feed of what's happening (who came online or
// came to your page, alliances, who shot down whom), each line gone after a
// few seconds. Pages read it with useOnline().
//
// A tab left in the background a couple of minutes (AWAY_MS) leaves the room,
// so no one's left waiting on a ghost and your connection isn't kept open
// for nothing, and joins again when you're back. Live pointers off the map
// (Presence.jsx: yours to them, theirs to you) can be turned off, and that's
// remembered, and they're never drawn over a walkable world (enterWorld(),
// from ../../middleearth/towns/useTravellers.js), where the others are
// there in person, nor over a full-screen world with no others of its own
// yet (useInWorld(up), from its page).
//
// Your level and factions go in the hello too: the wallet's level and its
// marks (your standing with each universe, your oath and rank in the
// galaxy's wars), once a page has loaded it, read again whenever it
// changes, a standing level turns (`tp:standing`, from the universe page)
// or you swear (`tp:oath`, from the galaxy's).
//
// follow(id) is the roster's “Fly to” and “Go”: the pilot to fly to once
// the ship is in, on the universe map or in a galaxy system. The flight
// page acts on followId and clears it when the trip ends; left alone, it's
// forgotten after FOLLOW_MS (and on going offline), so a page opened much
// later doesn't set off after someone.
//
// Who you are (identity.js, through nostr.js, loaded once you're online):
// remember and setRemember(yes) are the roster's “Remember me on this
// browser”, newIdentity() its “New identity” (a fresh key, and in again on
// it), and guestTab says this tab flies as a guest, another being online
// on the kept key. Your allies and blocks are kept in this browser too
// (allies.js, made once you're online, handed to the link, which lists the
// saved allies who aren't here as room.away); removeAlly(id) is the roster's
// Remove on one of those, and isBlocked(id) says whether a block is kept
// for a pilot (a world's travellers ask it too).
//
// Your party (partyLink.js, through the link; partyStore.js keeps it in this
// browser, made with the allies' store and handed to the link the same way):
// party is the link's snapshot of it (the party, the invites waiting, and
// whether you follow the leader: followLeader, setFollowLeader(on)), or null
// with no link; partyDo(name, …args) is one of its actions (start, invite,
// accept, decline, leave, remove, promote, summon). Its chat is the last
// CHAT_KEEP lines heard this visit (kept over a dropped link, never past the
// tab), each stamped `seen` with this browser's clock as it came, `unread`
// counting the others' since markRead() (the dialog's Chat tab, while it's
// in view); say(text) → whether it went. quip(i) says one of quips.js's lines
// over you. A summons from the leader waits as `summon` ({ from, name,
// where }) till answerSummon(go) or SUMMON_MS: Go sets off after the leader
// where you fly, and hands back where they called you, for the page to go to
// (PartyHost.jsx).

const ONLINE_KEY = 'tp-universe-online'; // 'on' once you've gone online
const NAME_KEY = 'tp-universe-callsign';
const SHIP_KEY = 'tp-universe-ship'; // (crews.js's: the ship last flown)
const POINTERS_KEY = 'tp-universe-pointers'; // 'off' once you've turned pointers off
const AWAY_MS = 120000; // a tab hidden this long leaves the room till you're back
const FEED_MS = 6000;
const FEED_MAX = 4;
const FOLLOW_MS = 60000; // a pilot to fly to, once the ship's in (follow): forgotten after this
const CHAT_KEEP = 100; // the party's lines kept this visit
const SUMMON_MS = 60000; // a summons not answered: let go after this
const OFF = { status: 'off', self: null, peers: [], away: [] };

export const OnlineContext = createContext(null);
export const useOnline = () => useContext(OnlineContext);

// A full-screen world is up (`up`): the site draws no page pointers over it
// while it is (a pointer over a canvas means nothing). For a world's page
// that has no travellers of its own (useTravellers says it for those that
// do); nothing where there's no link.
export function useInWorld(up = true) {
  const enterWorld = useOnline()?.enterWorld;
  useEffect(() => (up && enterWorld ? enterWorld() : undefined), [up, enterWorld]);
}

export function useOnlineState(where) {
  const [name, setName] = useState(() => cleanName(local.get(NAME_KEY)));
  const [on, setOn] = useState(() => local.get(ONLINE_KEY) === 'on' && Boolean(name));
  const [kind, setKind] = useState(() => (typeof local.get(SHIP_KEY) === 'string' ? local.get(SHIP_KEY) : null));
  // (as it was last fitted; the universe page says what it flies with now)
  const [loadout, setLoadout] = useState(() => (kind && readLoadouts(local.get(LOADOUT_KEY), [kind])[kind]) || STOCK_LOADOUT);
  // and the hull it flies: its garage build (shipyard/), or null for its stock ship
  const [build, setBuild] = useState(() => (kind && readHulls(local.get(HULL_KEY), [kind])[kind]) || null);
  // and how its Rick and Morty, or its Walt and Jesse, are dressed (the wardrobe’s, wherever it’s changed)
  const [looks, setLooks] = useState(() => readLooks(local.get(LOOK_KEY)));
  useEffect(() => {
    const on = (e) => setLooks(readLooks(e.detail));
    window.addEventListener('tp:looks', on);
    return () => window.removeEventListener('tp:looks', on);
  }, []);
  const { economy, version: wallet, marks } = useEconomy({ ask: false });
  const level = economy?.level ?? 1;
  const [marked, setMarked] = useState(0); // bumps when a standing or an oath changes
  useEffect(() => {
    const bump = () => setMarked((n) => n + 1);
    window.addEventListener('tp:standing', bump);
    window.addEventListener('tp:oath', bump);
    return () => {
      window.removeEventListener('tp:standing', bump);
      window.removeEventListener('tp:oath', bump);
    };
  }, []);
  const [client, setClient] = useState(null);
  const allies = useRef(null); // (allies.js's store: one for the page, made the first time you're online)
  const partyStore = useRef(null); // (partyStore.js's, made with it: your party, kept in this browser)
  const [chat, setChat] = useState([]); // the party's lines this visit, the newest last
  const heard = useRef(0); // (each line's key: counted over every link this visit, as the lines are kept over them)
  const [unread, setUnread] = useState(0);
  const [summon, setSummon] = useState(null); // the leader's call, waiting for Go or Not now
  const [room, setRoom] = useState(OFF);
  const [feed, setFeed] = useState([]);
  const [attempt, setAttempt] = useState(0); // a retry makes a fresh link
  const [away, setAway] = useState(false); // the tab's been in the background a while
  const [pointers, setPointers] = useState(() => local.get(POINTERS_KEY) !== 'off');
  const [worlds, setWorlds] = useState(0); // walkable worlds up (each with its own room of travellers)
  // a world's up: → done() once it's gone
  const enterWorld = useCallback(() => {
    setWorlds((n) => n + 1);
    let gone = false;
    return () => {
      if (gone) return;
      gone = true;
      setWorlds((n) => n - 1);
    };
  }, []);
  const [following, setFollowing] = useState(null); // { id, at }: a fresh object each time, so asking again starts the clock again
  const follow = useCallback((id) => setFollowing(typeof id === 'string' && id ? { id, at: Date.now() } : null), []);
  useEffect(() => {
    if (!following) return undefined;
    const t = setTimeout(() => setFollowing(null), FOLLOW_MS);
    return () => clearTimeout(t);
  }, [following]);
  useEffect(() => {
    if (!on) setFollowing(null);
  }, [on]);
  const latest = useRef({ name, kind, loadout, build, looks, where });
  latest.current = { name, kind, loadout, build, looks, where };
  // who you are, once you've gone online (the module that has it comes with the link)
  const [me, setMe] = useState(null);
  const [, setMeChanged] = useState(0); // (bumped when it changes, for a render)
  useEffect(() => {
    if (!on || me) return undefined;
    let gone = false;
    import('./nostr')
      .then((m) => !gone && setMe(m.identity()))
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [on, me]);

  // gone from the tab a while: out of the room; back: in again
  useEffect(() => {
    if (!on) return undefined;
    let t = 0;
    const check = () => {
      clearTimeout(t);
      if (document.hidden) t = setTimeout(() => setAway(true), AWAY_MS);
      else setAway(false);
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', check);
      setAway(false);
    };
  }, [on]);

  useEffect(() => {
    if (!on || away) return undefined;
    let c = null;
    let off = null;
    let gone = false;
    const timers = new Set();
    let n = 0;
    setRoom({ ...OFF, status: 'connecting' });
    Promise.all([import('./client'), import('./allies'), import('./partyStore'), import('../../../runtime/local')])
      .then(([{ createClient }, { createAllies }, { createPartyStore }, { localSaves }]) => {
        if (gone) return;
        allies.current ??= createAllies({ saves: localSaves() });
        partyStore.current ??= createPartyStore({ saves: localSaves() });
        c = createClient({ ...latest.current, allies: allies.current, party: partyStore.current });
        setClient(c);
        setRoom(c.snapshot());
        off = c.on((e) => {
          if (e.type === 'status' || e.type === 'roster' || e.type === 'party') setRoom(c.snapshot());
          else if (e.type === 'chat' && e.line) {
            const line = { ...e.line, key: heard.current++, seen: Date.now() };
            setChat((lines) => [...lines.slice(1 - CHAT_KEEP), line]);
            if (!line.mine) setUnread((u) => u + 1);
          } else if (e.type === 'summon') setSummon({ from: e.from, name: e.name, where: e.where, key: n++ });
          else if (e.type === 'feed') {
            const item = { id: n++, text: e.text, tone: e.tone };
            setFeed((f) => [...f.slice(1 - FEED_MAX), item]);
            const t = setTimeout(() => {
              timers.delete(t);
              setFeed((f) => f.filter((x) => x !== item));
            }, FEED_MS);
            timers.add(t);
          }
        });
      })
      .catch(() => !gone && setRoom({ ...OFF, status: 'failed' }));
    // closing the tab: out of the room at once, so no one's left waiting on a
    // ghost; back again from the browser's back-forward cache: a fresh link
    const bye = () => c?.leave();
    const back = (e) => e.persisted && setAttempt((a) => a + 1);
    window.addEventListener('pagehide', bye);
    window.addEventListener('pageshow', back);
    return () => {
      gone = true;
      window.removeEventListener('pagehide', bye);
      window.removeEventListener('pageshow', back);
      off?.();
      c?.leave();
      for (const t of timers) clearTimeout(t);
      setClient(null);
      setRoom(OFF);
      setFeed([]);
      setSummon(null); // (a call heard on a link that's gone is gone with it)
    };
  }, [on, attempt, away]);

  // a summons left alone is let go
  useEffect(() => {
    if (!summon) return undefined;
    const t = setTimeout(() => setSummon(null), SUMMON_MS);
    return () => clearTimeout(t);
  }, [summon]);
  const markRead = useCallback(() => setUnread(0), []);
  const answerSummon = useCallback(
    (go) => {
      setSummon(null);
      if (!go || !summon) return null;
      if (isFlight(summon.where)) follow(summon.from); // (and after the leader, once the ship's in there)
      return summon.where;
    },
    [summon, follow],
  );

  // (marks() is read here, not each render: it counts up the war's points)
  useEffect(() => {
    client?.setProfile({ name, kind, loadout, build, looks, where, level, marks: marks() });
  }, [client, name, kind, loadout, build, looks, where, level, marks, wallet, marked]);

  const keepName = (callsign) => {
    const next = cleanName(callsign) ?? name ?? randomCallsign();
    local.set(NAME_KEY, next);
    setName(next);
    return next;
  };

  return {
    on,
    name,
    where,
    client,
    room,
    feed,
    pointers, // live pointers off the map, yours and theirs
    inWorld: worlds > 0, // in a walkable world, where the others walk about instead
    enterWorld,
    setKind, // the universe page says which ship you fly
    setLoadout, // and what's fitted to it
    setBuild, // and the hull it is: a garage build, or null
    suggest: () => name ?? randomCallsign(),
    goOnline(callsign) {
      keepName(callsign);
      local.set(ONLINE_KEY, 'on');
      setOn(true);
    },
    goOffline() {
      local.set(ONLINE_KEY, 'off');
      setOn(false);
    },
    retry: () => setAttempt((a) => a + 1),
    showPointers(yes) {
      local.set(POINTERS_KEY, yes ? 'on' : 'off');
      setPointers(yes);
    },
    rename: keepName,
    remember: me ? me.remember : true, // your key kept in this browser (identity.js)
    setRemember(yes) {
      if (!me) return;
      me.setRemember(yes);
      setMeChanged((n) => n + 1);
    },
    // a fresh key, and in again on it (your allies won't know you)
    newIdentity() {
      if (!me) return;
      me.renew();
      setAttempt((a) => a + 1);
    },
    guestTab: Boolean(me?.guest), // another tab's online on the kept key: this one's a guest
    follow, // follow(id): fly to them once the ship's in; follow(null) to forget it
    followId: following?.id ?? null,
    ally: (id, what) => client?.ally(id, what),
    block: (id, yes) => client?.block(id, yes),
    removeAlly: (id) => allies.current?.dropAlly(id), // (a saved ally who isn't here: forgotten)
    isBlocked: (id) => Boolean(allies.current?.isBlocked(id)), // (a block of yours kept in this browser: for the worlds' travellers)
    party: room.party ?? null, // { party, invites, follow }: the link's, or null with none
    // (only the link's own actions, by name: start, invite, accept, decline, leave, remove, promote, summon)
    partyDo: (name, ...args) => (client?.party && Object.hasOwn(client.party, name) ? client.party[name](...args) : undefined),
    chat,
    unread,
    markRead,
    async say(text) {
      try {
        return Boolean(await client?.party?.say(text));
      } catch {
        return false; // (sealing went wrong, or the link went: it didn't go)
      }
    },
    quip: (i) => client?.party?.quip(i),
    summon,
    answerSummon,
    followLeader: Boolean(room.party?.follow),
    setFollowLeader: (yes) => client?.party?.setFollow(yes),
  };
}
