# Plan: a party, its chat, and quick chat

The design: `docs/superpowers/specs/2026-10-19-party-and-quick-chat-design.md`.
All paths under `src/components/universe/online/` unless said. Every unit:
tests first (beside the file), British spelling, curly quotes in copy,
comments in the file’s voice saying why, files under 800 lines, no new
dependency. The contracts below are exact: units are built at the same time
by different hands and must meet in the middle.

## Wave 1 (pure pieces, each its own files)

### 1. `partyWire.js`, `quips.js`, `mates.js`, `protocol.js` rates

```js
// quips.js
export const QUIPS = ['Hello', 'Bye for now', 'On my way', 'Follow me', 'Wait for me', 'Over here', 'Look at this', 'Nice one', 'Thanks', 'Sorry', 'Yes', 'No', 'Ready?', 'Let’s go', 'Need a hand?', 'Watch out', 'Well played', 'Good game', 'Back in a bit', 'See you at the map'];
export const QUIP_MS = 6000;               // how long one shows
export const quipText = (i) => QUIPS[i] ?? null;

// partyWire.js
export const PARTY_MAX = 8;
export const CHAT_MAX = 200;               // characters of a line
export const PARTY_ID = /^[0-9a-f]{16}$/;
export const readPartyId = (v) => (typeof v === 'string' && PARTY_ID.test(v) ? v : null);
export function newPartyId(rand = crypto.getRandomValues.bind(crypto)) // 16 hex
// a party message as it came in, or null (junk, wrong shape):
//   { t: 'inv', p, l }            an invite to party p, led by l (to one pilot)
//   { t: 'join', p }              yes to an invite (to its leader)
//   { t: 'no', p }                no to an invite (to whoever asked)
//   { t: 'ros', p, l, e, m: [{ id, name }] }  the roster (to everyone): leader l, epoch e (integer ≥ 1),
//                                 members in joining order, 1..PARTY_MAX, ids 64 hex, unique, l among them
//   { t: 'left', p }              leaving party p (to everyone)
//   { t: 'out', p }               you're removed from p (to the one removed)
//   { t: 'sum', p, w }            the leader summons p to where w (to everyone; w through where.js's cleanWhere)
export function readParty(data)
export function writeParty(msg)           // the wire form (m as [[id, name], …]); readParty(writeParty(x)) deep-equals x
//   psay { b: [blob, …] }        1..PARTY_MAX-1 blobs, each /^[A-Za-z0-9_-]{1,700}$/
export function readSay(data)              // → { b } | null
//   quip { q }                   an index into QUIPS
export function readQuip(data)             // → { q } | null
```
Names in a roster go through `names.js`’s `cleanName` (an unreadable one is
'Pilot'). `protocol.js`: `RATES` gains `party: [1, 6]`, `psay: [1, 4]`,
`quip: [0.5, 3]`; its header table gains the three rows. `mates.js`:
`export const isMate = (p) => Boolean(p) && !p.blocked && (p.ally === 'ally' || p.mate === true);`
and `protocol.js`’s `hitCounts` and `ramCounts` ask `isMate(peer)` where they
asked `peer.ally === 'ally'` (the blocked check stays). Tests:
`partyWire.test.js`, `quips.test.js`, `mates.test.js`, and the protocol
tests still green.

### 2. `party.js` (the party’s rules, pure)

A party: `{ id, leader, epoch, members: [{ id, name, since }] }` (members in
joining order).
```js
export function newParty({ id, self: { id, name }, now })      // leader self, epoch 1, one member
export const isMember = (party, id) => …
export const isLeader = (party, id) => …
export function addMember(party, { id, name }, now)            // → party (epoch + 1) | null (full, there already)
export function removeMember(party, id)                        // → party (epoch + 1) | null (not in it). The leader
                                                               //   removed: the next member in order leads; none left: null
export function promote(party, id)                              // → party (epoch + 1, leader id) | null
export function successor(party, present)                       // present(id) → bool: the first present member in order, or null
export function takeOver(party, selfId)                         // → party (epoch + 1, leader selfId)
export function rosterMsg(party)                                // → { t: 'ros', p, l, e, m: [{ id, name }] }
// A roster heard: believed only from the leader it names (fromId === msg.l),
// for your party at a newer epoch (or the same epoch from a lower leader id:
// two who took over at once), or as your way in (no party, or another, and
// `joining` is msg.p: you said yes to its invite). Members keep their `since`
// (a new one's is now).
export function applyRoster(party, msg, { fromId, selfId, joining = null, now })
//   → { party, why: 'joined' | 'updated' | 'removed' | 'ignored' }
//   'removed': you aren't in it (party null); 'ignored': party unchanged
```
Tests cover each, ties, a stale epoch, a roster from a non-leader, a full
party, the leader removed, succession over who is present.

### 3. `partyStore.js` (remembered, as `allies.js`)

```js
export const PARTY_KEY = 'tp-party';  // version 1
export const PARTY_DAYS = 14;          // unseen this long: forgotten
export function createPartyStore({ saves = null, now = () => Date.now() } = {})
//   → { get() → { party, as, seen } | null (as: your key's first 16 hex, the key
//        you flew; a stale or unreadable entry → null), save(party, as), touch()
//        (seen now), clear(), on(fn) → off (another tab's change) }
```
Read back as a stranger’s message would be (ids 64 hex, names cleaned, at
most `PARTY_MAX`, leader among the members). Mirrors `allies.js`: register,
watch, writes it hears back aren’t news, no storage → the visit.

### 4. `partyCrypt.js`, the worker, `nostr.js`

```js
// partyCrypt.js (WebCrypto and @noble/secp256k1 only; runs in the worker and the page, and in Node for tests)
export async function sealFor({ secretKey /* Uint8Array 32 */, selfPub /* hex64 */, to /* hex64[] */, party /* 16 hex */, text, cache /* Map */ })
//   → string[]: a blob for each recipient (shuffled), base64url
export async function openFrom({ secretKey, selfPub, from, party, blobs, cache })
//   → the text, or null (none opens: not for you, tampered, another party)
export function padText(text) / unpadText(bytes)               // u16 length ‖ utf-8, zero-filled to max(32, ceil32)
```
Pair key: x of `getSharedSecret(sk, 02‖peerX)` (bytes 1..33), HKDF-SHA256
(salt `tp-psay-v1`, info the two keys’ hex, lower first) → AES-GCM-256,
non-extractable, cached by `selfPub:peerPub`. A blob: IV(12) ‖ ciphertext ‖
tag(16). AAD: `tp-psay-v1|party|fromPub|toPub` (so a blob can’t be reflected
or replayed into another party). The text is cut to `CHAT_MAX` before it’s
sealed. A malformed key, blob or anything else → null, never a throw.
`signer.worker.js`: ops `seal` `{ key, pubkey, party, to, text }` → blobs,
`open` `{ key, pubkey, party, from, blobs }` → text | null, `forget` → true
(its cache dropped). `nostr.js`: the room gains
`seal(to, party, text)` → Promise<blobs> and `open(from, party, blobs)` →
Promise<text | null>, through `offPage` with the page fallback, on the room’s
own key; `docs/stack/multiplayer-nostr.md` says ECDH is used, for what.
Tests: `partyCrypt.test.js` (round trip, wrong recipient, reflected blob,
another party, tampered byte, odd-y keys, padding sizes, junk → null).

### 5. `src/lib/three/quipSprite.js` and the DOM bubble

```js
// lib/three/quipSprite.js
export function createQuipSprite({ height = 0.4, sizeAttenuation = true, center = [0.5, 0] } = {})
//   → { sprite, set(text | null), fade(k 0..1), dispose() }
// a rounded card with a tail, its CanvasTexture repainted only when the text
// changes, hidden while null; colours from the site's bubble look (a pale card,
// dark ink: readable over any world), the house font
```
`quipBubble.js` (DOM): `export function quipEl(doc)` → a `span.quip-bubble`
(aria-live off), and `setQuip(el, text | null)` (writes only on a change;
hidden when null). Its CSS in `online.css` under `.quip-bubble` (above the
tag it’s inside: `position: absolute; bottom: 100%`), glass at 0.86 or more,
text ≥ 0.75rem. Tests: `quipSprite.test.js`, `quipBubble.test.js`.

## Wave 2 (on wave 1)

### 6. `partyLink.js` and `client.js`

```js
export function createPartyLink({ self /* client's self: .id, .name, .where */, peers /* Map */, emit, feed, roster, now, store /* partyStore | null */, rand })
// → {
//   wire({ action, admit }),  // makes 'party', 'psay', 'quip' (action(ns) → { send(data, opts), onMessage }); admit(kind, id) as client.js's
//   setCrypt({ seal, open } | null),
//   helloField() → { pt } | {},
//   hello(p, data, first),    // a pilot's hello (raw data: its `pt`)
//   gone(p), blocked(p, on), tick() /* the heartbeat's */,
//   snapshot() → { party: { id, leader, epoch, members: [{ id, name, since, present, where, leader, you }] } | null,
//                  invites: [{ from, name, party, leader, at }], follow: bool },
//   quipOf(id) → text | null (yours too, by self.id), api: { start(), invite(id), accept(fromId), decline(fromId),
//     leave(), remove(id), promote(id), summon(), say(text) → Promise<bool>, quip(i), setFollow(on) },
//   dispose()
// }
```
Peers it marks: `p.mate` (a present member of your party), `p.pt` (their
party id), `p.quip` (`{ text, at }`). Events (emit): `{ type: 'party' }`,
`{ type: 'chat', line: { from, name, text, at, mine } }`, `{ type: 'summon',
from, name, where }`, `{ type: 'quip', id, text }`. Feed lines (feed): an
invite (“Alpha asks you to their party”), a member in or out, leader changes,
quips from mates (“Alpha: On my way”). Rules: the leader sends the roster on
every change and with every heartbeat while anyone else is present; the
successor takes over when the leader is gone; a member hearing a pilot’s
hello with its party id, who isn’t in the roster, ignores it; re-forming from
the store when its `as` is your key now; accepting an invite while in another
party leaves it; a block takes them out (leader) or you out (member);
`say(text)` seals to the present members and sends `psay`; a `psay` from a
mate is opened and becomes a `chat` event (`psay` from anyone else: dropped).

`client.js`: makes the link with the store (`createClient({ …, party })`:
the store comes in like `allies`), wires it, puts `helloField()` in the hello,
hands it each hello (`hello(p, data, first)`), each `gone`, each `block`,
`tick()` on the heartbeat, the room’s `seal`/`open` (`setCrypt`) once joined,
`snapshot().party` in the snapshot, `party` (its api) and `quip(id)` on the
returned object, and `dispose()` in `leave()`. The `ally === 'ally'` checks in
`hit`/`ram` become `isMate(p)`. `useOnline.js` makes the store as it makes
allies. Tests: `partyLink.test.js` (its rules on a fake room), and
`client.test.js`: three pilots on the bus, with a fake crypt.

### 7. The dialog and its doors (UI)

- `lib/palette.js`: `openParty({ tab })` → `tp:party`.
- `PartyHost.jsx` in `OnlineProvider` (always, inside the router): hears
  `tp:party`, lazy-loads `PartyDialog.jsx`; shows a summon notice (Go,
  Not now) and does Follow the leader (a notice with Stay, then
  `navigate(where)` and `follow(leaderId)` where you fly).
- `PartyDialog.jsx` + `party.css`: as the spec’s “The dialog” says (tabs
  Party, Chat, Quick chat; the house kit; tokens only; a portal; modal;
  phone sheet). Offline: the way online (callsign, Go online) as the corner’s
  card has it.
- `useOnline.js`: `party` (snapshot), `partyDo(name, …args)`, `chat` (last
  100 lines this visit), `unread`, `markRead()`, `say(text)`, `quip(i)`,
  `summon` (pending) and `answerSummon(go)`, `followLeader`/`setFollowLeader`.
- `Online.jsx`: a Party button on the card (and a dot when an invite or an
  unread line waits), invites shown, mates first.
- `CommandPalette.jsx`: “Party” and “Quick chat”.
- `runtime/hud/PlayersChip.jsx`: once online it is a button (in the Menu and
  out) that opens the party dialog (`openParty()`), keeping its words.
- `lib/words.js`: party, quickChat, leader, summon, followLeader.
- New tokens in `src/index.css` `:root` and dark mode, once: `--ok`,
  `--warn`, `--danger` (moved from extras), `--ally`, `--scrim`.

### 8. Quips and mates, wherever players are drawn

- DOM: `pilots.js` and `pilotsNodes.js` (a `quipEl` in each tag, set from
  `client.quip(p.id)` each frame it’s drawn), `Presence.jsx`.
- 3D, with `createQuipSprite`: `middleearth/towns/ghostsOf.js` (rows carry
  `quip`; `travellers.js` takes `quip(id)` as it takes `ally(id)`;
  `useTravellers.js` hands it `client.quip`), `earth/scene.js`,
  `galaxy/surface/peers.js` (`net.quip?.(id)`), `universe/footScene.js` (the
  guests’ rows from `universe/scene.js`), `expanse/flight/peers.js` (through
  `shared.js`’s `join` and `Fly.jsx`, as `ally` came).
- Mates: every `ally === 'ally'` that colours or spares asks `isMate`:
  `relations.js`, `pilots.js`, `pilotsNodes.js`, `galaxy/surface/peers.js`,
  `Presence.jsx`, `useTravellers.js`, `Fly.jsx`.

## Wave 3

- `scripts/online-check.mjs --party` (fake relay): Alpha opens the dialog,
  invites Bravo; Bravo accepts; each sends a chat line the other reads; Alpha
  says a quip, seen over Alpha’s tag on the map; then in Bree, over Alpha’s
  ghost.
- Review (correctness, security of the crypto, the theme rules), fixes,
  lint, tests, build, health, the browser check, one PR, merged when green.
