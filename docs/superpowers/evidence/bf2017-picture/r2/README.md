# Lane R2’s numbers: the stream from the desktop

What the stream spike measured, and what it still needs. The plan: `docs/superpowers/plans/2026-10-11-bf2017-picture-laneR2-stream.md`; the decision these numbers finish: `docs/decisions/2026-10-11-the-stream-from-the-desktop.md`; the sender: `scripts/desktop/bf2017-stream.mjs`; the receiver: `#/stream?id=…` (`src/components/stream/`); the wire, the stamp and the numbers: `src/lib/stream/`.

## The files

| file | what |
| --- | --- |
| `dryrun-cloud-plumbing-360p30.json`, `.jpg` | the cloud, no world (the sender’s moving bars), 640 × 360 at 30 frames: the plumbing on its own |
| `dryrun-cloud-plumbing-720p60.json`, `.jpg` | the same at 1,280 × 720 and 60 frames: where the cloud’s software encoder gives out |
| `dryrun-cloud-hoth-low-360p30.json`, `.jpg` | the cloud, Hoth at `?quality=low` in software GL, 640 × 360 at 30: the world’s own canvas through the same pipe |
| `dryrun-cloud-game-standin-360p30.json`, `.jpg` | the second source rehearsed: `--source game --dry` captures a stand-in tab titled as the game’s window with `getDisplayMedia`, the same path the real window takes on the desktop |
| `desktop-*.json` | the owner’s runs (pending: below) |

Each JSON holds the sender’s numbers (`sender`: codec, size, encode ms a frame, the page’s frame interval), the receiver’s (`receiver`: input to picture, Mbit/s, frames, size, codec, the round trip), the replayed input’s counts and its hop through the script, every input-to-picture sample (`latencies`), the per-second samples (`samples`), the sender’s log, any page error, and `_source` saying where each comes from. The jpg is the receiver’s page at the end of the run.

## The cloud’s dry run: plumbing only (2026-10-11)

Both ends on one 4-core cloud machine with no GPU: two headless Chromium 141 processes (Playwright’s build, `/opt/pw-browsers/chromium-1194`) in software GL (ANGLE SwiftShader), the dev server beside them, signalling through the project’s Supabase Realtime over the session’s proxy. **The picture is poor and the latency is the machine’s, not the stream’s**: the numbers prove the pieces join, not what a phone would see.

| leg | input to picture p50 / p95 | samples (lost) | Mbit/s | frames received | codec | sender’s encode | sender’s frame p50 | replay hop p50 / p95 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| no world, 640 × 360 at 30 | **86 / 104 ms** | 238 (0) | 0.78 | 29.9 | AV1 | 4 ms | 16.7 ms | 2.6 / 9.6 ms |
| no world, 1,280 × 720 at 60 | 3,509 / 4,920 ms | 10 (208) | 1.04 | 24.6 | AV1 | 16 ms | 16.7 ms | 4.0 / 15.7 ms |
| Hoth at low, 640 × 360 at 30 | 2,643 / 3,292 ms | 58 (6) | 0.03 | 1.0 | AV1 | 7.5 ms | 817 ms | 2.7 / 59 ms |
| a stand-in window, captured, 640 × 360 at 30 | 2,939 / 5,185 ms | 75 (145) | 0.14 | 21.9 | AV1 | 5.5 ms | 16.7 ms | 3.3 / 18.6 ms |

`_source`: each row’s JSON (`receiver.latency`, `receiver.mbps.mean`, `receiver.fps.mean`, `receiver.codec`, `sender.encodeMs`, `sender.frameMs.p50`, `replayHopMs`), from one 60-second run each, ending 05:10, 05:11 and 05:13 UTC on 2026-10-11 (the stand-in at 05:38).

What it proves:

- **Signalling on Supabase Realtime broadcast works** behind the anon key with no table and no policy: from the sender’s offer to `connection connected` took 116 to 190 ms a run (the sender’s log).
- **The canvas copy, the capture and WebRTC carry the world**: Hoth’s own frame reached the receiver (`dryrun-cloud-hoth-low-360p30.jpg`).
- **The input channel works**: a key held on the receiver arrived on the sender and was replayed as a real key (`replayed.key` 2, down and up), and every ping went the same road (239 to 252 a run) in a few milliseconds (the replay hop).
- **The stamp reads back through AV1 compression**: 238 of 238 pings timed at 360p, none lost.
- **The game’s path works up to its window**: `getDisplayMedia` picks the window by title with no dialog (`--auto-select-tab-capture-source-by-title` here, `--auto-select-desktop-capture-source` on the desktop), and the captured picture goes through the same copy, stamp and offer (`dryrun-cloud-game-standin-360p30.jpg`). Its input was not injected: injection is Windows’ SendInput (`scripts/desktop/inject.mjs`), and the cloud is Linux.

What it cannot say:

- **Why the captured leg’s times climb.** Its samples rise steadily through the run, 673 ms to 5,185 ms (`latencies`), while the frames keep coming at about 22 a second: a queue on a saturated machine running three pages, a tab capture and a software encoder, not a fixed delay. On the desktop the same growth would mean the encoder cannot keep up; the run’s `latencies` show it either way.

- **Latency at the decision’s size.** At 720p60 the software AV1 encoder takes 16 ms a frame on a machine already running two browsers and a software GPU, the queue grows, and the samples are seconds; at 360p30 the same pipe holds 86 ms at p50. The desktop encodes on NVENC, in hardware.
- **H.264.** Playwright’s Chromium has no H.264 encoder, so every run negotiated AV1; Chrome on the desktop offers H.264 (the codec every phone decodes in hardware), and `send.js` asks for it first.
- **The world’s frame at ultra.** Software GL draws Hoth at low at 817 ms a frame; the stream sends what the world draws, so the world leg’s latency is the world’s. The desktop’s frame at ultra is lane W’s gate (`job: gate`).
- **The encoder’s name.** The WebRTC stats hide `encoderImplementation` and `powerEfficientEncoder` from a page that holds no camera or screen permission, so `sender.encoder` is null here and will be on the desktop too; there NVENC shows only as the encode time, to read against the cloud’s 16 ms a 720p frame.

## The desktop run: pending, the owner’s

The numbers that decide (the decision’s table): input to picture p95 under 80 ms on the LAN and under 150 ms over the internet; 1080p at 60 between 15 and 25 Mbit/s; the desktop’s frame at ultra p95 under 16.7 ms.

On the desktop, with the repository checked out and `npm ci` done, and the project’s `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the environment (the runner’s `.env`, never the repository):

```
node scripts/desktop/bf2017-stream.mjs --world hoth --minutes 15 --name desktop-lan
```

It starts the dev server on the LAN, opens Hoth at ultra in Chrome (the installed one: it has H.264 and the hardware encoder; `CHROME=<path>` for another), and prints the address. On the phone, on the same Wi-Fi, open that address (`http://<desktop>:5188/#/stream?id=…`), walk about for ten minutes, then let the script stop. Then over the internet, with the phone on mobile data:

```
node scripts/desktop/bf2017-stream.mjs --world hoth --minutes 15 --name desktop-internet
```

and open `https://tilakpatell.com/#/stream?id=<the printed id>&where=internet` once this PR is deployed (the deploy builds with the Supabase environment). Each run writes `desktop-lan.json` and `desktop-internet.json` here with the phone’s own numbers (it reports them back every five seconds) and the desktop’s; the decision is finished from them.

Through lane W’s workflow (`.github/workflows/bf2017-desktop.yml`, `job: stream`), the step is the same command (`node scripts/desktop/bf2017-stream.mjs --minutes 15 --name desktop-lan`); the runner as a service has no screen, so the script runs headless, and `--headed` is for a runner started in the owner’s session. If a mobile network refuses the connection (both ends behind NAT that STUN cannot open), that is the TURN relay’s cost, listed, not built.

### The game itself (the second source)

Battlefront II (2017) running on the desktop with the owner’s own copy and the mods the owner picks in Frosty, the window in front:

```
set PRESENTMON=C:\Tools\PresentMon.exe      (optional: the game’s own frame times)
node scripts/desktop/bf2017-stream.mjs --source game --minutes 15 --name desktop-game-lan
```

The script opens a Chrome window (it must stay open; it keeps drawing behind the game), captures the window titled “STAR WARS Battlefront II” (`--window "<title>"` for another title, `--process <exe>` for PresentMon), and prints the address. On the phone, click (or tap) the picture: on a computer that locks the pointer, so mouse moves go to the game’s camera as relative motion, and Esc frees it. Keys go into the game as scan codes and the mouse as relative moves through Windows’ `SendInput` (`scripts/desktop/inject.mjs`); a controller is not passed through (a virtual pad driver would be a further ask). The game must have the focus for its input, and some games refuse injected input: if the camera does not move, that is the answer for this game. The run writes `desktop-game-lan.json` with the phone’s numbers, the stream’s, and `gameFrame` (the game’s own p50 and p95 frame time) when PresentMon is set.

The same lines decide it, plus the game’s frame time with the mods on. Nothing of the game is copied, stored or served: only the owner’s live frame goes to the owner’s own browser behind the stream id, and the run’s file holds numbers only. If yes, it is a mode the owner starts from the desktop, never a public route.

