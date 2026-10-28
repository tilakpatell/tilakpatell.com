# bf2-web’s builds reach the site on their own: a contract, not a port

**Date:** 2026-10-28 · **Status:** accepted · **Where:** `.github/workflows/bf2web.yml`, `scripts/bf2web-{adopt,upload,smoke}.mjs`, `scripts/lib/bf2web-site.mjs`, `scripts/desktop/bf2web-build.mjs` · **Follows:** [Hoth is bf2-web’s](2026-10-28-hoth-on-bf2-web.md)

## Context

The owner asked for a pipeline: whenever `bf2-web` is pushed, its new version is built and played on the site, without an AI session each time, if that can be done, and in parts.

What stands in the way, 2026-10-28:

- Only the owner’s desktop can build: the engine drop, the retail install, the cooked inputs and a GPU for the export’s run are there and nowhere else. The site’s self-hosted runner (`[self-hosted, gpu]`) is on that machine.
- `bf2-web`’s export, upload and release are fixed steps (`WORLD_EXPORT`, `export-play-site.mjs verify`, `publish-release.mjs`, `docs/DEPLOY.md` on its `feat/deploy-bundle`). Its World build is not: “the integrator’s round notes record the exact command of each round”. That one step is why each version needed someone.
- The site already takes the build as data: `src/data/bf2web/play.json` names it and `cloudflare/play.js` serves it from the bucket. No `bf2-web` source is in this repository, so a new version needs nothing rewritten here unless what the site relies on changes.

## Decision

- **A contract between the two, checked on every build** (`scripts/lib/bf2web-site.mjs`, `CONTRACT`):
  - the manifest’s schema (`bf2-play-site/1`) and the roots the Worker serves;
  - the files `play.js` and the front end need;
  - the play page’s hooks `cloudflare/playReturn.js` reads (`window.__playFlow`, its sessions’ `endReason`, the body’s `play-<state>`);
  - every listed file uploaded at its size, the manifest last;
  - the nine rulebooks.

  A build that keeps to it is adopted with no one involved. One that breaks it is refused with what broke, and that change is the one a person or a session looks at.
- **`bf2-web` owns how it builds; the site owns how it hosts.**
  - `bf2-web` provides one entry point, `WebPort/deploy/build-play-site.mjs --out <dir> --commit <sha>`. It runs the World build by a recipe checked in beside it, the scene, the export, and the play-flow check on the desktop’s GPU, so a build that can’t play a round isn’t uploaded. A round that changes the build command changes the recipe in the same pull request.
  - The site’s steps never change with a round.
- **Four parts, each run alone or together** (`bf2web.yml`, `stage`):
  - *build* (the desktop, `scripts/desktop/bf2web-build.mjs`): `bf2-web`’s main, or a commit, becomes `main-<sha8>` unless the bucket has it already. The steps are a worktree, the entry point, the export check, the rulebooks from the export, the upload and the engine’s private release.
  - *upload* (`scripts/bf2web-upload.mjs`): a file the last build has byte for byte (by its sha256) is copied inside R2, so a build sends what changed, about 100 MB of engine and not 2.2 GB. A file already there is skipped, so a cut-off upload resumes. The manifest goes last.
  - *adopt* (GitHub’s runner, `scripts/bf2web-adopt.mjs`): the newest build of `bf2-web`’s main (`main-<sha8>`) that passes the contract and is newer than `play.json`’s is named there. A build from a branch or a worktree goes live only when it is named (`stage: adopt`, `build`); one from the desktop’s round-1030 worktree was adopted on its own on 2026-10-28, before this rule, with its own rulebooks (`sites/<build>/ui-data/`) when it carries them, so going back to a build brings its rulebooks back.
  - *compress* (`scripts/bf2web-compress.mjs`, after each adopt, or `stage: compress`): brotli copies (`<key>.br`) of the binary files Cloudflare sends as they are: textures, scene data, collision. They're listed in the build’s `encodings.json`, written last. `cloudflare/play.js` sends a copy, whole, to a browser that takes brotli. Cloudflare already compresses the wasm and the JSON on its own (104 MB of engine arrives as 17). The rest of main-da7a51b3 measured about 2.07 GB on the wire, some 1.57 with the copies.
  - *smoke and ship* (`scripts/bf2web-smoke.mjs`): the Worker’s own code serves the bucket locally, headless Chromium opens the engine’s page to its menu, cross-origin isolated with the way back present. Then the play site’s tests run, `play.json` is pushed to main and `deploy.yml` is started by name, since a push with the workflow’s token starts no workflow.
- **When it runs:**
  - when `bf2-web`’s main moves: its notify workflow sends `repository_dispatch` `bf2web-main` with the commit, using a token the owner adds as `SITE_DISPATCH_TOKEN` there;
  - every six hours in case that was missed;
  - from the Actions tab.

  One run at a time.

## Consequences

- A `bf2-web` round that keeps to the contract reaches the site in one desktop run and one adopt run, with no session involved.
- The site’s pull-request review is not part of this path: the adopt job commits `play.json` (data, one file) to main after its own checks, and `deploy.yml` runs lint, the tests and the build again before anything goes live. Going back to an earlier build is one line in `play.json`, or `stage: adopt` with that build.
- Until `bf2-web` has its entry point and recipe (and `feat/deploy-bundle` on its main), the build stage stops and says so; adopt, upload and smoke work today on the builds the desktop uploads by hand.
- Old builds stay in the bucket until pruned, about 2.2 GB each in storage, though copies cost nothing to send.
- A real round on a GPU is checked on the desktop, inside the entry point. GitHub’s runner only proves the build is whole and served as the contract says.
