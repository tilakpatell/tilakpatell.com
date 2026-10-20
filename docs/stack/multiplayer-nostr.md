# Nostr and @noble/secp256k1

**Version** `@noble/secp256k1@^3.2.0` · **Page owner** `src/components/universe/online/` · **Decision** none recorded; the design is `docs/superpowers/specs/2026-10-05-multiplayer-across-worlds-design.md`

## What it is, and why it is here

Multiplayer runs over public Nostr relays: each browser opens secure WebSockets to the relays and sends signed events, so the site needs no server of its own and no visitor learns another’s IP address (`src/components/universe/online/nostr.js`’s header). `@noble/secp256k1` is the signing library: every event is signed with Schnorr signatures over secp256k1, as Nostr requires. It is the only package this page covers; the relays are other people’s, free.

## Where it is used

The census row is in [README.md](README.md). The files that import it:

- `src/components/universe/online/nostr.js`: the room, its events and their signatures.
- `src/components/universe/online/events.js`: the event shape.
- `src/components/universe/online/partyCrypt.js`: a party’s chat, sealed for each member (`getSharedSecret`).

Around them: `src/components/universe/online/client.js` (the site’s link, held by `OnlineProvider.jsx` above the pages), `src/components/universe/online/signer.worker.js` (signing and checking off the frames), and `scripts/online-check.mjs` (two browsers on the real relays).

## How the site uses it

- **One key a visit.** `visitKeys()` makes a key for the visit, the same in every room it joins, so the traveller in a world is the pilot in the roster and a block holds everywhere (`nostr.js`’s header).
- **Ephemeral events.** Everything goes out as an ephemeral kind: relays pass it on and keep nothing.
- **Bundled.** What is waiting goes out together, at most every `FLUSH_MS`, keeping only the latest pose and pointer, which keeps each pilot inside what the relays allow.
- **Checked twice.** The relays check each signature, and anything that matters (a hello, a hit, an alliance, leaving) is checked again in the browser, so no one can speak as another pilot; an event much older than a pilot’s others is dropped.
- **Heard by cell.** A room joined with `cells` (`nostr.js`’s header) asks the relays for `#g` too, the 3 × 3 grid cells round the pilot (`src/lib/net/cells.js`, `NET_CELL` 2,048 m), tags what it sends `['g', cell]`, and asks again under the same REQ id only when the set changes (`pool.js`’s `refresh()`); a message for one pilot carries their cell as well. A room joined without `cells` is unchanged.
- **Off the frames.** Signing and checking run in `signer.worker.js` (`docs/architecture.md`, Graphics).
- **ECDH for a party’s chat.** `getSharedSecret` agrees a key between two pilots’ signing keys (x-only, so `02` goes in front, and the secret’s x is the same whichever y); HKDF-SHA256 and AES-GCM-256 are the browser’s WebCrypto. A line goes out as a blob for each member present, sealed and opened in the signer worker, the room’s `seal` and `open` (`src/components/universe/online/partyCrypt.js`’s header; the design is `docs/superpowers/specs/2026-10-19-party-and-quick-chat-design.md`).

## What the site does not use, and why

- **A Nostr client library** (`nostr-tools` and the like): the site needs a handful of event shapes and one signature scheme, so `nostr.js` speaks the protocol itself over `@noble/secp256k1`.
- **Stored events and profiles**: ephemeral kinds only; nothing about a visit outlives it on the relays.
- **A server**: the site is static; the relays carry everything.

## Rules

- Sign and check through `nostr.js` and the signer worker, never with the library directly in a component (nothing measures it; the census shows which files import it).
- Every event that changes another pilot’s state is checked in the browser as well as by the relay (`src/components/universe/online/nostr.test.js`).
- A change to the protocol is checked in two browsers on the real relays (`scripts/online-check.mjs`; the steward runs it, CI does not).

## Upgrading

```
npm install @noble/secp256k1@<version>
npx vitest run src/components/universe/online
npm run build
node scripts/online-check.mjs
```

`nostr.js` and `events.js` import `schnorr` from it (`keygen`, signing and checking), and `partyCrypt.js` imports `getSharedSecret` and `utils.isValidSecretKey`; on a major version, read its changelog for those names first (`partyCrypt.test.js` pins the chat’s construction by hand, so a change in what `getSharedSecret` returns fails there). Last upgrade: not recorded; record the next one here, with what it broke.

## Gotchas

- **Relays have limits.** Send more often than they allow and they drop you; that is why messages are bundled (`nostr.js`’s header).
- **Duplicates are normal.** The same event arrives from each relay it went to; it is taken once, by its id.
