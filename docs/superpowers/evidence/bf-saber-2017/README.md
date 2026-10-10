# Lane S: the lightsaber as the game’s, in the browser

Hoth, `?quality=high&mode=free`, software GL (SwiftShader), Luke with a green blade, `__surfaceDo('duel', 'vader', { ahead: 5 })`; the dev server with `VITE_ASSET_BASE` at the public bucket so the 2017 bodies come. `before-*` is the branch’s base (`5e85c350`, `main` plus the design), `after-*` lane S.

- `*-duel`: Vader set down 5 m off. `*-strikes`: three presses of F. `*-block`: C held through his strikes (before: the site’s guard meter, “Single blade”; after: the stamina meter, “One blade”, “Dodge ×2”). `*-dodges`: X pressed. `*-numbers.json`: the scene’s debug at each step.
- `after-bolt-front`, `after-bolt-back`, `after-dodges` and `after-block-numbers.json` are a second, quieter run with no strikes (the first run’s queued strikes kept the saber busy, which holds the block down): the block held, a trooper’s bolt from the front (`__surfaceDo('bolt', { turn: 0 })`) cost 5.3 of 100 stamina (4 × 60 / 45: its 8 of your health is 60 of Luke’s 750) and no health; one from behind (`turn: π`) took 8 health; the stamina back to 100 a second later at 33.3 a second; a dodge spent half the bar (the next presses fell inside the first dodge’s clip, 0.6 s).
- The before run has no `bolt` hook (added with lane S), so its bolt shots show nothing fired.
