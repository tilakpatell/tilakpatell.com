# A party, its chat, and quick chat

## What’s wanted

The owner asked for a proper party system, a menu dialog for it that follows
the theme, free-text chat for those in a party (encrypted, no word filter),
and quick chat: set quips anyone online sees over the player, wherever they
are drawn (the universe map, the galaxy, every world). Allies stay as they
are; a party is the group on top of them.

The owner chose, when asked: a party with a leader, invites, the party’s
colour everywhere, where each member is, join the leader, Summon, chat and a
party that is remembered (option B); chat as encrypted free text for members
only, no word filter; quips public. The rest was left to this design (“figure
it out”): Summon is a prompt with Go plus a per-member “Follow the leader”
switch.

## What it rests on

`docs/superpowers/specs/2026-10-05-multiplayer-across-worlds-design.md` and
the site’s one room (`universe/online/client.js`, `nostr.js`): every pilot
online is in the room `universe-v2`, held above every page by
`OnlineProvider`, signed with the visit’s one key, so a player’s id is the
same in every world’s room. A message “to one pilot” is a field in the same
public bundle (`nostr.js`), so it is addressed, not private. Events are
ephemeral: nothing is kept, a late arrival hears nothing said before.

## The party

- **Who:** up to `PARTY_MAX` = 8, by invite. One leader.
- **Ids:** a party is a random 16-hex id; members are pilots’ keys.
- **The roster is the leader’s.** The leader’s signed `roster` message says
  who is in the party, in order of joining, with an epoch that only grows.
  A member believes a roster only from the pilot it names as leader, and only
  at an epoch at or past the one it has. Membership lasts while members are
  offline: who is *present* is who is online.
- **Invite:** any member may invite a pilot online who isn’t blocked and isn’t
  in your party. The invite names the party and its leader. Accepting sends
  `join` to the leader, who admits them (if there is room and the invite came
  from a member) and sends the roster with them in it. Accepting an invite
  while in another party keeps that one until the new leader’s roster lets
  you in, then leaves it (handing over first if you led it): a yes that’s
  never answered, or a leader who never asked you and says no, costs you
  nothing but a “Couldn’t join” in the feed. An invite declined within a
  minute isn’t asked again (as an ally ask isn’t).
- **Leave:** anyone. The leader leaving hands over first (see below).
- **Remove:** the leader, from the roster; the removed pilot is told.
- **Make leader:** the leader, by a roster naming another member, epoch + 1.
- **When the leader is gone** (offline, or quiet past the room’s 45 s): the
  first *present* member in roster order takes over and sends the roster with
  itself as leader at epoch + 1. Two who both think so: the higher epoch wins;
  at the same epoch, the roster with more members, then the lower leader id,
  then the lower member ids (`party.js`’s `beats`: one order, so two forks
  settle the same way everywhere and a stale fork never puts out a member the
  live roster has). A returning old leader takes the newer roster like any
  member. A party re-formed from the store doesn’t take over alone: it waits
  for another of its members.
- **Catching up:** the hello carries the epoch you hold (`pe`), and whoever
  holds a newer roster sends it to a member behind them (a member passes on
  the roster it holds; one taken on another member’s word isn’t passed on).
  A pilot whose hello names the party but isn’t on the roster (removed while
  away) is sent the roster, which says so. Only your own leader’s roster can
  remove you; another member’s is believed at most 256 epochs past yours.
- **Whom it trusts:** a party trusts its members, who were invited; a member
  running a changed client can disrupt it. A stranger, who can read every
  roster and hello, can’t join, be sealed a line, remove anyone, or make a
  member leave.
- **Remembered:** your party (id, leader, members with names, epoch) is kept
  in this browser (`tp-party`, version 2), one entry for each key you fly
  (`as`, as allies keep it; up to four), so a guest tab’s party never takes
  the place of your own key’s. Coming back online, you are in it again, alone until the others
  come; a member’s hello naming the party (`pt`) brings them in view, and the
  roster flows again from whoever leads. Forgotten when you leave, are
  removed, after 14 days unseen, or when your key changes (guest tab, New
  identity, Remember off: a new key is a new pilot, who is invited again).
- **The hello** carries `pt`, your party id (public: anyone could already see
  who is in a party together from the rosters).
- **Mates:** while in your party, a member is a mate as an ally is: drawn in the
  ally green everywhere, and no friendly fire (`isMate(peer)`, one function
  every place that asked `ally === 'ally'` asks now).

### Summon and follow

- **Summon** (the leader): every present member gets a prompt in the online
  corner’s feed: “Alpha summons the party to Bree · Go”. Go takes them there
  (the roster’s Go: `navigate(where)`, and `follow(leader)` where you fly).
  Ignored, nothing happens.
- **Follow the leader** (each member, a switch, kept in this browser): while
  on, when the leader’s place changes to one you can follow, you go too, after
  a notice with Stay (which turns the switch off) and a moment to press it.

## Chat

- Free text, at most `CHAT_MAX` = 200 characters, members only, no filter.
- Sealed for each present member: secp256k1 ECDH (`@noble/secp256k1`’s
  `getSharedSecret`, already a dependency), HKDF-SHA256 to an AES-GCM-256 key
  per pair (WebCrypto), a fresh 12-byte IV per line, the party and both keys
  in the additional data (so a line can’t be replayed from one pair to another,
  or between parties). The plaintext is padded to a multiple of 32 bytes.
- **On the wire:** `psay` `{ b: [blob, …] }`, a blob for each present member,
  shuffled, and nothing else: no party id, no recipients. A member opens a
  `psay` only from a mate, trying its blobs. What stays public: who sends
  `psay`, when, and how many blobs (the party’s size).
- **Where the secret is used:** the signer worker (`signer.worker.js`) gets
  `seal` and `open`, as it has `sign`; the page runs the same functions if
  there is no worker. The pair keys are cached, non-extractable, per own key.
- No history: a line reaches who is in the party and present when it is sent.
  The visit keeps the last 100 lines in memory.
- A blocked pilot can’t be in your party: a block removes them (as leader) or
  leaves (as member) and their lines are dropped.

## Quick chat

- `QUIPS`: 20 set lines (an index on the wire, so nothing to filter and nothing
  free-form in public): Hello, Bye for now, On my way, Follow me, Wait for me,
  Over here, Look at this, Nice one, Thanks, Sorry, Yes, No, Ready?, Let’s go,
  Need a hand?, Watch out, Well played, Good game, Back in a bit, See you at the
  map.
- `quip` `{ q }` to the whole room, at most one every two seconds (burst 3).
- Shown over the player for `QUIP_MS` = 6 s, wherever they are drawn:
  - **DOM:** the universe map’s and the galaxy’s ship tags (`pilots.js`, and
    its node twin), the page pointers (`Presence.jsx`): a bubble above the tag.
  - **3D:** one sprite bubble (`lib/three/quipSprite.js`, canvas on a Sprite,
    both renderers) used by the worlds’ ghosts (`ghostsOf.js`: 27 worlds),
    Earth, the galaxy surfaces and Rick and Morty planets
    (`galaxy/surface/peers.js`), the universe’s crews on foot
    (`footScene.js`) and the planet flight (`expanse/flight/peers.js`).
  - The data is one place: `client.quip(id)` → the line, or null once it’s
    old (by the client’s own clock). A world’s travellers rows carry it as they
    carry `ally` (`useTravellers`’s `quip(id)`).
  - Your own quip shows over you where you are drawn to yourself, and in the
    feed for your party and allies (“Alpha: On my way”).

## The dialog

- **One Party dialog**, opened from the online corner (a Party button), the
  command palette (“Party”, “Quick chat”) and every world’s Menu (the players
  chip there opens it: `PlayersChip`’s `onOpen`), through
  `openParty({ tab })` (`lib/palette.js`), heard by a host in
  `OnlineProvider` (`tp:party`). Offline, it offers to go online.
- **Tabs** (`.switch[data-size=md]`, a tablist): **Party** (members, leader,
  present or away and where, Invite from those online, Leave, Remove, Make
  leader, Summon, Follow the leader, pending invites with Accept/Decline),
  **Chat** (the lines and a field; “Start or join a party to chat” outside
  one), **Quick chat** (the quips as buttons).
- **The house kit only:** `.card`, `.btn`, `.chip`, `.switch`, `.notice`,
  `.dialog-title`, `CloseButton`, `lib/focus.js`’s trap, `--z-dialog`,
  `--shadow-dialog`, a scrim, Esc, focus back to the opener, a portal to the
  body (so it is out of the map’s dark scope and follows the page’s theme and
  mode). Colours from tokens only; new tokens where the site has none
  (`--ok`, `--warn`, `--danger`, `--ally`, `--scrim`, defined once on `:root`
  and for dark mode, so every theme gets them and a theme may set its own).
- **Phone:** a bottom sheet under 640 px, 44 px targets.
- **Words** (`lib/words.js`): party, quick chat, leader, Summon, Follow the
  leader.

## Files

- `online/party.js`: the party’s rules, pure (rosters, epochs, succession,
  invites, mates), tested.
- `online/partyStore.js`: `tp-party`, as `allies.js` keeps allies, tested.
- `online/partyCrypt.js`: seal and open, tested in Node (WebCrypto).
- `online/quips.js`: the lines, the wire, tested.
- `online/partyWire.js`: the party, `psay` and `quip` messages’ readers and
  writers, tested; `RATES` gains `party`, `psay`, `quip`.
- `online/partyLink.js`: the party’s side of the client (its actions, state,
  events), so `client.js` stays under 800 lines; `client.js` hands it the
  room, `admit`, the peers and the hello.
- `online/mates.js`: `isMate(peer)`.
- `online/PartyDialog.jsx`, `PartyHost.jsx`, `party.css`.
- `lib/three/quipSprite.js`; the DOM bubble in `online.css`.
- The worker’s `seal`/`open`, `nostr.js`’s `room.seal`/`room.open`.

## Testing

- Pure: `party.test.js` (invite, join, leave, remove, promote, succession,
  ties, epochs, remembered re-forming, blocks), `partyStore.test.js`,
  `partyCrypt.test.js` (round trip, wrong key, reflected blob, other party,
  tampered byte, odd-y keys, padding), `partyWire.test.js`, `quips.test.js`.
- The client: `client.test.js`’s bus, three pilots: invite, join, chat, leave,
  remove, promote, the leader going, summon.
- In browsers: `scripts/online-check.mjs --party` on the fake relay: Alpha
  invites Bravo from the dialog, Bravo accepts, a chat line each way, a quip
  seen over Alpha’s tag on the map and over Alpha’s ghost in a world.

## Not in scope

- Chat history across visits; a party bigger than 8; voice; quips in the
  hobbit rush (its own room, no callsigns).
