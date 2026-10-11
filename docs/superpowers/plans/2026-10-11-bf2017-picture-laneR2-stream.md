# Lane R2: the stream. The ultra picture rendered on the owner’s GPU and streamed to any browser, as a spike

The design: `docs/superpowers/specs/2026-10-11-bf2017-picture-everywhere-design.md` (§7). Branch `claude/bf2017-r2-stream` from `origin/main`. One PR. The rules: `docs/health/RULES.md`, `.claude/skills/autopilot/SKILL.md`; a new package needs its `docs/stack/` page before it is imported.

Read first: `docs/stack/supabase.md`, `docs/stack/multiplayer-nostr.md`, `docs/decisions/2026-10-09-supabase-for-durable-shared-state.md`, `src/lib/net/*`, `src/components/galaxy/surface/scene.js` (how input reaches the walker), `src/runtime/` (how a world is created), `scripts/desktop/README.md`, the lane W plan.

A spike: the smallest thing that measures whether a stream from the owner’s desktop can show the game’s full frame on a phone, and the decision written from the numbers. No product surface beyond a dev route (`#/stream?…`) until the decision says so.

## Tasks

1. **The decision record first, as a draft:** what GeForce Now does (a server GPU renders, encodes, streams over WebRTC, input returns), what is the same here (the owner’s desktop GPU, the site’s own ultra picture), what differs (one encoder session, the desktop awake, the owner’s upload, no fleet), and the numbers that decide: glass-to-glass latency under 80 ms on the owner’s LAN and under 150 ms over the internet; 1080p60 at 15 to 25 Mbit/s; the desktop frame under 16.7 ms at ultra with every layer.
2. **Signalling** through Supabase Realtime (a channel per stream id, offer and answer and ICE as broadcast messages, the anon key under RLS as the stack page allows); no new server. STUN from the public servers; a TURN relay is a listed cost, not built.
3. **The sender:** `scripts/desktop/bf2017-stream.mjs`: Playwright’s Chromium on the desktop with WebGPU, the site at `?quality=ultra&stream=1`, `getDisplayMedia` of the page’s canvas (or `canvas.captureStream` from inside the page) into an `RTCPeerConnection` with H.264 or AV1 and NVENC where Chromium offers it; the input channel received and replayed into the page (keyboard, pointer, the walker’s controls).
4. **The receiver:** `src/components/stream/` (a lazy world module like the others, `shading` irrelevant): a video element full-bleed, the HUD over it, the input sent on the data channel, the latency measured by a timestamp painted into the frame and read back.
5. **The dry run in the cloud:** sender and receiver on the same machine in software GL (the picture poor, the plumbing proven), the numbers recorded as a plumbing check only.
6. **The desktop run:** through lane W’s workflow (`job: stream`), on the owner’s LAN and over the internet from a phone, the numbers into `docs/superpowers/evidence/bf2017-picture/r2/README.md`.
7. **The decision** finished from the numbers; if it says yes, the product plan (a “watch at ultra” mode in the settings panel beside the quality switch, its consent and its limits) is written, not built.
8. Merge `origin/main`, the full checks, the PR.
