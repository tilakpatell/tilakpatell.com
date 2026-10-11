# Build and lint

**Version** `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`, `eslint`, `@eslint/js`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals` and `gh-pages`, each at the version its row in [README.md](README.md) gives · **Page owner** `vite.config.js` and `eslint.config.js` · **Decision** none recorded

## What it is, and why it is here

Vite is the dev server and the bundler (Rolldown underneath, `README.md`, “Tech stack”); `@vitejs/plugin-react` gives it JSX and fast refresh. Tailwind CSS, through PostCSS with Autoprefixer, writes the utility classes. ESLint, with the React, hooks and refresh plugins, lints every file. `gh-pages` is the manual way to publish `dist/`; the deploy workflow is the usual one.

## Where it is used

These are tools, so the census counts few importing files; the rows are in [README.md](README.md). What reads them:

- `vite.config.js`: the plugins, the test run’s excludes, the build’s manifest and its `vendor` chunk.
- `tailwind.config.js` and `postcss.config.js`: the classes, the shell’s font families and the theme’s radii.
- `eslint.config.js`: the rules for `src/` and the rules for `scripts/`.
- `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`: lint, test, build on every pull request and on `main`; the deploy to GitHub Pages.
- Scripts that start a Vite server of their own for a check (the census lists them under `scripts`).

## How the site uses it

- **The plugins**, in `vite.config.js`’s order: `scripts/library-slice.mjs` (the object library’s slice of the asset manifest as the virtual module `virtual:bf2017-published`, a few paths where the whole 16 MB file was bundled: lane D3), `scripts/icons-apart.mjs` (each `react-icons` icon its own module, so the entry chunk carries only the icons it draws), React, `scripts/prerender.mjs` (a page of its own for each hash route, with its title and preview card, and a sitemap) and `scripts/packs.mjs` (each world’s install pack, read from the build’s manifest).
- **One vendor chunk.** React and the router change rarely, so they cache apart from the app; `react-dom/server` stays out of it, so it loads only with the world that uses it.
- **Before every build**, `scripts/github-snapshot.mjs` saves the public GitHub numbers to `public/github.json` (`prebuild` in `package.json`).
- **Tailwind reads `src/`** (`tailwind.config.js`’s `content`), and the theme’s numbers come from tokens in `src/index.css` (`docs/health/RULES.md`, UI rule 1).
- **Lint is two configs in one file.** Browser globals and the React rules for `src/`; Node globals and the recommended rules for `scripts/**/*.mjs`; `*.config.js` gets Node globals.

## What the site does not use, and why

- **A server.** The site is static: `vite build` writes `dist/`, and GitHub Pages serves it (`.github/workflows/deploy.yml`).
- **TypeScript.** The site is JavaScript; there is no TypeScript config, and the React types serve editors only ([react.md](react.md)).
- **CSS-in-JS.** Styles are Tailwind classes and plain CSS files with tokens.
- **`react/prop-types`** is off in `eslint.config.js`: nothing checks props at run time.

## Rules

- `npm run lint`, `npm test` and `npm run build` pass on every pull request (`.github/workflows/ci.yml`).
- A lint rule is turned off in a file only with a reason; the measure’s `lint-disables` counts them and only lets the number fall.
- A number in CSS is a token from `src/index.css`, or carries a comment saying why (`docs/health/RULES.md`, UI rule 1; `src/styles/tokens.test.js` checks the depths).

## Upgrading

```
npm install vite@<v> @vitejs/plugin-react@<v>
npm run build
npm test
node scripts/autopilot-check.mjs --only smoke
```

A Vite major moves its bundler options: read `vite.config.js`’s `build` block against the release notes, then check that `dist/.vite/manifest.json` is still written (`scripts/packs.mjs` reads it) and that each route still gets its prerendered page. Tailwind and ESLint majors change their config formats; upgrade them on their own, one pull request each. Last upgrade: not recorded; record the next one here, with what it broke.

## Gotchas

- **The build runs a network fetch first.** `prebuild` runs `scripts/github-snapshot.mjs`; it keeps the last snapshot when GitHub doesn’t answer, so an offline build still works.
- **Packs read the manifest.** Turn off `build.manifest` and every world’s install pack is wrong (`vite.config.js`’s comment).
- **Hash routes never reach the server**, so a shared link sees only what `scripts/prerender.mjs` wrote for that route.
