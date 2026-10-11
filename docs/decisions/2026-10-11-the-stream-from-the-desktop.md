# The ultra picture streamed from the owner’s desktop: a spike, decided by its numbers

Date: 2026-10-11. **Status: draft**, written before the numbers (lane R2’s task 1), with the cloud’s plumbing numbers added the same day; finished from the desktop’s numbers when the owner has run it. The long version: `docs/superpowers/specs/2026-10-11-bf2017-picture-everywhere-design.md` §7; the plan: `docs/superpowers/plans/2026-10-11-bf2017-picture-laneR2-stream.md`; the numbers: `docs/superpowers/evidence/bf2017-picture/r2/README.md`.

## Context

The owner asked whether GeForce Now’s way of using a GPU could show the site’s Star Wars worlds at their full picture where the visitor’s device cannot draw it (a phone).

**What GeForce Now does.** A server GPU in a data centre runs the game, encodes each frame as video on the card’s own encoder, and streams it to the player over WebRTC; the player’s keys, pointer and pad go back on a data channel, and the server feeds them to the game. Nvidia asks for at least 15 Mbit/s for 720p at 60 frames and 25 Mbit/s for 1080p at 60, and a round trip under 80 ms to its data centre, under 40 ms for the best play (Nvidia’s published GeForce Now system requirements). A fleet of servers sits near every player.

**What is the same here.** The owner’s desktop has the GPU (an RTX 5090, `scripts/desktop/README.md`) and the encoder (NVENC); the site already draws its own ultra picture in a browser; Chromium on the desktop can capture a canvas (`HTMLCanvasElement.captureStream`) and send it over `RTCPeerConnection`, with the input back on a data channel. Nothing has to be installed on the visitor’s side.

**What differs.** One machine, not a fleet: one stream at a time (a consumer card’s encoder sessions are capped, and the desktop draws one ultra world at once), only while the desktop is awake and its runner up, through the owner’s home upload, with no relay near the visitor (a TURN relay is a cost, not built). Signalling needs a meeting place; the site has no server, but Supabase Realtime’s broadcast channels carry small messages behind the public anon key (`docs/stack/supabase.md`), so no server is added.

**The numbers that decide** (the plan’s, set against Nvidia’s above):

| what | yes if | why that line |
| --- | --- | --- |
| input to picture on the owner’s LAN | p95 under 80 ms | Nvidia’s playable round trip; a LAN adds almost nothing to it |
| input to picture over the internet, from a phone | p95 under 150 ms | the plan’s: a walk and a look, not a twitch shooter |
| 1080p at 60 frames | 15 to 25 Mbit/s, under the owner’s upload | Nvidia’s 720p60 and 1080p60 rates |
| the desktop’s frame at ultra, every layer on | p95 under 16.7 ms | 60 frames; lane U2’s and lane W’s gate (`scripts/galaxy-budget.mjs`) |

“Input to picture” is measured, not estimated: the receiver sends a numbered ping on the data channel, the sender replays it through the same path as a key, the number is painted into the frame’s corner as blocks, and the receiver reads it back from the decoded video (`src/lib/stream/stamp.js`). No clock has to agree between the two machines.

**What the cloud showed** (both ends on one 4-core machine, software GL, plumbing only; the evidence README has the table). Every piece joins: Realtime broadcast signals with no table or policy (offer to connected in 116 to 190 ms), the world’s canvas goes through the copy, the capture and WebRTC, a key held on the receiver is replayed on the sender as a real key, and the stamp reads back through AV1. At 640 × 360 and 30 frames, input to picture is p50 86 ms and p95 104 ms with no ping lost; at 720p60 the software encoder saturates and the times are seconds. None of it says what the desktop’s NVENC and a phone will do.

**The game itself, a second source** (the owner’s added ask). No WebAssembly port of the real game exists to run (no Frostbite source; the binary is EA’s), so the one way Battlefront II (2017) reaches a browser is this stream: its own window on the desktop (the owner’s copy, Frosty’s mods) captured with `getDisplayMedia`, the receiver’s keys and locked pointer put into it through Windows’ `SendInput`, its own frame time read by PresentMon. The same lines decide it, plus that frame time with the mods on. Nothing of the game is copied, stored or served: only the owner’s live frame, to the owner’s own browser behind the stream id. The cloud rehearsed the capture on a stand-in window; the injection and the game are the desktop’s.

## Decision

Draft: **the spike is built and its plumbing proven; nothing about a product is decided until the desktop’s numbers are in** (the owner’s run, the evidence README’s last section). If every line above holds on the desktop, a “watch at ultra, streamed from the desktop” mode is planned (not built) beside the quality switch; if the internet line fails but the LAN holds, it stays a tool for the owner’s own devices; if the LAN line fails, it is shelved. For the game’s window, a yes is a mode the owner starts from the desktop for the owner’s own devices, never a public route.

## Consequences

- A dev route (`#/stream?id=…`) and a desktop script (`scripts/desktop/bf2017-stream.mjs`) enter the repository; nothing links the route, and nothing on any world page changes.
- Supabase Realtime broadcast is used for the first time, for signalling only; the multiplayer stays on Nostr.
- The cloud can prove the plumbing (two pages on one machine in software GL) but not the picture or the latency that matter; those come from the owner’s run through lane W’s workflow.

## Revisit when

- The owner’s desktop numbers are in (this draft is finished then, in a new entry if a week has passed).
- A second GPU machine or a hosted GPU becomes available (a fleet changes “one stream at a time”).
- Browsers expose WebGPU canvas capture with a zero-copy encoder path (the copy to a 2D canvas goes).
