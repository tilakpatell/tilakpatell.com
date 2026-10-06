# Site review, 5 October 2026: what to fix, improve and add

A whole-site review: the core pages, the universe map and galaxy, and every hidden world. Lint, the 2,081 tests and the build were green on `main` when it started; every core page and a sample of world routes passed `scripts/autopilot-check.mjs --only smoke`. Each item below says where, what and how to tell it's done. Items marked *(verified)* were reproduced or traced in the code; the rest come from reading and want a look first.

Work from this session lands as pull requests, one concern each, and ticks its line here and in `docs/autopilot/backlog.md`.

## Shipped in this session

- [x] The check script failed every galaxy mission briefing for having no canvas (they're text and a crawl). PR #175. *(verified)*
- [x] The first load: the entry chunk carried every icon the whole site uses (react-icons ships a set as one module, and a module lives in one chunk). `scripts/icons-apart.mjs` cuts each icon into a module of its own at build time, and `ClaudeSpark` has a file of its own, so Home and a project page don't bring the Claude stage. Entry 169 → 139 kB (gzip 58.9 → 50.4 kB); `/home` 711 → 694 kB of JS, `/projects` 663 → 643 kB, about thirteen more small requests a page. *(verified)*

## Core pages: bugs

- [x] **A filter click on a feed page jumps to the top of the feed** *(verified)*. `App.jsx`'s `ScrollToTop` re-runs when `top` flips, and after any feed move a page's own search-param update (Projects' tech chips, the Experience track, the Résumé skill) flips it, so `scrollTo(0, 0)` throws the visitor to the top of the page the feed started on, and page audio stops (`stopPageClips`). Scroll and stop only on a new path.
- [x] `ErrorBoundary resetKey={page}` is `'/feed'` for all six feed pages, so after an error in one, the nav's links can't clear it. Use the pathname.
- [x] One failed chunk inside the feed replaces the whole feed with the error screen, and `React.lazy` caches the rejection, so it can't retry. A boundary per `FeedPage` with a Retry.
- [x] Offline, a failed chunk matches `isStale` and `reloadFresh()` swaps the page for the browser's offline screen. Skip the reload when `navigator.onLine === false`.
- [x] The first ⌘K shows nothing while the palette's chunk loads (fallback null), and a second ⌘K toggles it shut. Prefetch `CommandPalette` with the other idle imports in `Shell`.
- [x] The Terminal's neofetch says React 18; it's 19.

## Core pages: accessibility

- [x] The Terminal swallows Tab and Shift+Tab always: a keyboard trap (WCAG 2.1.2). Swallow Tab only when a completion applies; let Shift+Tab and Escape leave.
- [x] The phone menu (portalled) doesn't move focus in, return it to the button, or make the page behind inert.
- [x] The Résumé's tabs: no roving tabindex, arrows change the view but not the focus.
- [x] Six `<h1>`s in one feed document. The pages off the address could render their title as `h2` (`usePageActive`). Done: `components/PageTitle.jsx` is the page's `h1` on the address and an `h2` elsewhere in the feed; the themes find it by `data-page-title`.
- [x] Contact's form doesn't move focus to the first invalid field. Done: its checks are `lib/contact.js` (tested), and a failed send focuses the first field that's wrong.

## Core pages: reach and polish

- [x] Between about 900 and 1180 px (a tablet, a small laptop), Music, Terminal and the colour picker were in neither the bar nor a menu (only search found them). The menu now shows below `lg`, or whenever the bar has let go of Terminal or Music to fit. *(verified)*
- [x] (A page per route: `scripts/prerender.mjs` writes `dist/<route>/index.html` with its own title, description, preview card and canonical address, and the sitemap lists all 55. *(verified)*) Every shared link (`/#/projects/x`) unfurls as the home page: hash routes have one title, description and image. Prerendered per-route HTML (title, description, OG) at build time would fix shares and search; `public/sitemap.xml` lists `/` only.
- [x] `scripts/github-snapshot.mjs` rewrites the tracked `public/github.json` on every build (its `fetchedAt`), leaving a dirty tree; and `Promise.all` drops the whole snapshot if the contributions API is down. Write only on change; `allSettled`. Done, tested: each answer stands alone, and the file is written only when more than its clock changed.
- [ ] Recruiter basics not on the site: where based, when available, open to relocation; a "last updated" on the résumé.

## The universe and the galaxy

- [ ] **Sixteen of the galaxy's eighteen missions were briefings**; Endor's speeder bike chase, Lothal's star map and Dagobah's *Do or Do Not* are now playable (`surface/missions/`, specs `2026-10-05-endor-chase-design.md`, `2026-10-06-quest-missions-design.md` and `2026-10-06-dagobah-mission-design.md`), thirteen to go. Missions can be on foot (no `ride`). A mission can now be a quest (`kind: 'quest'` in `missions/index.js`: the quest engine runs it, the result card is shared), so most of the rest are data. The chase's route planner, scouts and result are reusable for the Tatooine ride (`systems.js` status `'soon'`; Yavin and Alderaan go to `/deathstar`). Every one of the seventeen landable worlds has a surface site with quests (Tatooine five, the others one or two), so the engine is there: build the missions on it, smallest first, per `docs/superpowers/specs/2026-10-05-galaxy-games-design.md`.
- [ ] Anisotropy still hard-coded in `universe/stations.js:1410`, `universe/kit.js:38`, `universe/deepspace.js:951,963` (4) and `universe/scene.js:611`, `universe/planets.js:619` (1). Through `lib/three/textures.js`'s `sharpen`.
- [ ] The Invincible planet on the map was merged without a look in a browser (`HANDOFF-invincible-planet.md`).

## The worlds

| World | Walk in 3D | Rules tested | Others online | Next |
| --- | --- | --- | --- | --- |
| Music room | yes | yes | yes, as floating lamps (this session) | ghosts in the courtyard; a tabla theka under the sitar |
| Middle-earth | yes | yes (34 files) | 9 places | ghosts at Cirith Ungol and Mount Doom; Amon Hen's kitchen mist and ducks |
| Cybertron | no (Roll out, Iacon) | thin | no | Iacon's rules into a tested file; Cybertron on foot |
| Avengers HQ | yes, and swing | yes | holograms | ring 3 of the swing tour |
| Albuquerque | drive | yes | ghost Azteks | phone cuts (canopy detail, vigas out of the shadow pass) |
| Scranton | yes | partly (`world/story.js` untested) | yes, as pale Jims (this session) | ghosts; `story.test.js`; a new job |
| C-137 and the Citadel | yes | yes | yes, as Mortys and Ricks from other dimensions (this session) | ghosts (a Rick from another dimension); Morty's walk paused in the air |
| Dot Matrix | yes | yes | no | ghosts in the four greens; a speedrun timer |
| Earth | fly | yes | no | `day.webp`, `clouds.webp` 1.4 MB each; great-circle trails |
| The Caribbean | sail | yes | no | ghost ships |
| Invincible | fly | yes | no | a flight-lesson ring course, on the swing tour's pattern |
| Death Star | trench run | yes | no | a best-run ghost X-wing |

The shared ghosts hook (`middleearth/towns/useTravellers.js`, `{ bound, motion }`) is what Avengers HQ and the Middle-earth towns use; Scranton, C-137, the Citadel and Dot Matrix could have others online for a few dozen lines each.

## New places the engines already support

- **Mon Calamari** (Return of the Jedi era): a water world on the galaxy's surface engine (`sites/`, `water.js`, `quests.js`); its cruiser is already in the fleet. No sequels.
- **Edoras** off the road in Middle-earth, on the towns walker, as Orthanc was done (`hidden.js`): original halls and signs, short famous lines only.
- **Cybertron on foot**, on `universe/footScene`'s plated ground (as the Death Star's hull is walked), with Optimus and Megatron's models already in `public/models/universe`.
