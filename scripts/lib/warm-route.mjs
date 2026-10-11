/* global window */
// The dev server warmed before a multiplayer check's visitors come
// (online-check.mjs, flyto-check.mjs). Vite finds a page's lazily imported
// dependencies as a browser asks for them, and on finding new ones it
// re-bundles and answers "504 (Outdated Optimize Dep)" until it's done,
// which makes the page reload itself; a check whose page reloads midway
// loses its `window.__universeDebug` ("reading 'net'", and "Execution
// context was destroyed" in CI's Multiplayer job, on main itself). So a
// scout, offline and alone, loads the route first and waits for it to be
// up and to stay up, going again if the page went from under it; only then
// do Alpha and Bravo come. A server already warm costs the scout a few
// seconds. WARM=0 skips it.
//
// warmRoute(browser, base, path, ready) → whether it settled (it logs a line
// either way: `ok   warmed …` or `warn warmed … (never settled …)`)

export async function warmRoute(browser, base, path, ready) {
  if (process.env.WARM === '0' || !path) return true;
  const t = Date.now();
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-intro', '1');
    // (a ship chosen, or the map waits at the choice and never has one)
    window.localStorage.setItem('tp-universe-ship', JSON.stringify('xwing'));
    window.localStorage.setItem('tp-universe-online', JSON.stringify('off'));
    window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
    window.sessionStorage.setItem('tp-gl-anyway', 'true');
  });
  const page = await ctx.newPage();
  let up = false;
  try {
    // (four minutes at most: a server that never settles is the run's to
    // report, not the scout's to wait out)
    while (!up && Date.now() - t < 240000) {
      try {
        await page.goto(base + path, { timeout: 120000 });
        await page.waitForFunction(ready, null, { timeout: 120000 });
        // (a re-bundle's reload comes a moment after the page is up: give it one)
        await page.waitForTimeout(5000);
        up = await page.evaluate(ready);
      } catch {
        // (the page went from under us: the optimizer's reload; once more)
      }
    }
  } finally {
    await ctx.close().catch(() => {});
  }
  console.log(`${up ? 'ok  ' : 'warn'} warmed ${path} in ${((Date.now() - t) / 1000).toFixed(0)} s${up ? '' : ' (never settled: the run may reload)'}`);
  return up;
}
