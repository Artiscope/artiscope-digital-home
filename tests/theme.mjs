import { W_DIR, G_DIR, C_DIR, FIX, chromeOptions } from "./where.mjs";
// The Theme screen, the real-site preview and the easier lists, in a real browser.
// Run: PLAYWRIGHT=<path to playwright> node tests/theme.mjs
import fs from "node:fs"; import path from "node:path"; import assert from "node:assert/strict"; import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module"; const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
import { SITES, FONTS, themeCss } from "./home.mjs";
const A = 8731, B = 8732, consoleAt = "http://localhost:" + B, siteAt = "http://localhost:" + A + "/";
// a built copy of World Art Review that trusts this test console instead of the real one
fs.rmSync("/tmp/site-a", { recursive: true, force: true });
execFileSync("python3", [(W_DIR + "/tools/build_site.py"), "/tmp/site-a"]);
let built = fs.readFileSync("/tmp/site-a/index.html", "utf8"); assert.ok(built.includes('var ok="https://artiscope.github.io"'));
fs.writeFileSync("/tmp/site-a/index.html", built);
fs.writeFileSync("/tmp/site-a/index.html", built.split('var ok="https://artiscope.github.io"').join('var ok="' + consoleAt + '"'));
const servers = [spawn("python3", ["-m", "http.server", String(A), "-d", "/tmp/site-a"], { stdio: "ignore" }), spawn("python3", ["-m", "http.server", String(B), "-d", path.resolve(".")], { stdio: "ignore" })];
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch(chromeOptions());
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.route((u) => !u.hostname.includes("localhost"), (r) => r.abort());
  await page.goto(consoleAt + "/index.html?demo&preview=" + encodeURIComponent(siteAt));
  await page.waitForSelector('[data-act="open-site"]'); await page.click('[data-act="open-site"][data-site="world-art-review"]'); await page.waitForSelector('[data-tab="theme"]');

  // the console and the server work the theme out the same way
  for (const s of SITES.filter((x) => x.theme)) {
    const spec = Object.assign({}, s.theme, { fontRequests: FONTS });
    const vals = { colours: Object.assign({}, ...s.theme.colours.map((c) => ({ [c.id]: c.default })), s.theme.looks[0].colours), fonts: Object.assign({}, ...s.theme.fonts.map((f) => ({ [f.id]: f.options[1] }))) };
    assert.deepEqual(await page.evaluate(([a, b]) => window.__adh.themeCss(a, b), [spec, vals]), themeCss(s.theme, vals), s.id);
  }

  await page.click('[data-tab="theme"]'); await page.waitForSelector("#pv-live:not([hidden])", { timeout: 9000 });
  assert.ok((await page.innerText("#pv-note")).includes("real homepage"));
  const frame = page.frames().find((f) => f.url().startsWith(siteAt));
  const band = () => frame.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--green").trim());
  assert.equal(await band(), "#1D4A35");
  assert.ok((await page.innerText(".island")).includes("Saves go straight to visitors")); assert.equal(await page.locator(".savebar").count(), 0);
  // a ready-made look
  await page.click('.look >> nth=1'); await page.waitForTimeout(200);
  assert.equal(await band(), "#22304A");
  assert.ok((await page.innerText("#theme-settings")).includes("4 changes to the theme, not saved yet"));
  assert.equal(await page.locator("#pv-live").count(), 1);
  // typing a colour code, without the screen redrawing
  await page.fill('[data-theme-hex="brick"]', "#f4f1ea"); await page.waitForTimeout(150);
  assert.equal(await frame.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--brick").trim()), "#F4F1EA");
  await page.locator('[data-theme-hex="brick"]').blur(); await page.waitForTimeout(150);
  assert.ok((await page.innerText("#theme-settings")).includes("Hard to read against the page background"));
  // a typeface
  await page.selectOption('[data-theme-font="display"]', "EB Garamond"); await page.waitForTimeout(150);
  assert.ok((await frame.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--display"))).includes("EB Garamond"));
  assert.equal(await frame.locator('link[data-adh*="EB+Garamond"]').count(), 1);
  await page.waitForTimeout(4000); await page.screenshot({ path: "/tmp/theme-live.png" });
  await page.click('[data-act="pv-mode"][data-mode="phone"]');
  assert.equal(await page.evaluate(() => document.querySelector("#pv-live").offsetWidth), 390);
  await page.screenshot({ path: "/tmp/theme-phone.png" });
  // discard, then change one thing and publish
  await page.click('[data-act="theme-discard"]'); await page.waitForTimeout(150);
  assert.equal(await band(), "#1D4A35"); assert.equal(await page.locator("#theme-settings .savebar").count(), 0);
  await page.fill('[data-theme-hex="green"]', "#22304A"); await page.locator('[data-theme-hex="green"]').blur();
  assert.ok((await page.innerText("#theme-settings")).includes("1 change to the theme, not saved yet"));
  await page.click('[data-act="theme-publish"]'); await page.waitForSelector("text=This theme change goes live"); await page.click('[data-act="livesave"]'); await page.waitForSelector("text=Saved. Live in about two minutes");
  await page.waitForSelector('[data-theme-hex="green"]'); assert.equal(await page.inputValue('[data-theme-hex="green"]'), "#22304A");
  assert.equal(await page.locator("#theme-settings .savebar").count(), 0);
  await page.click('[data-tab="overview"]'); assert.ok((await page.innerText(".island")).includes("Saves go straight to visitors"));
  await page.screenshot({ path: "/tmp/topbar.png", clip: { x: 0, y: 0, width: 1440, height: 420 } });
  await page.fill("#copy-name", "Winter look"); await page.click('form[data-form="copy"] button[type=submit]');
  await page.waitForSelector("text=Trial copy made"); assert.equal(await page.inputValue("#copy-pick"), "trial-winter-look-000001");
  await page.evaluate(() => window.__adh.go("content")); await page.click('[data-act="open"]'); await page.fill("#f-0", "A trial title"); await page.click('button[type="submit"]'); await page.waitForSelector("text=Saved on this copy");
  await page.click('[data-tab="overview"]'); await page.waitForSelector("text=1 change saved on this copy"); await page.screenshot({ path: "/tmp/sites.png", fullPage: true });
  await page.selectOption("#copy-pick", ""); await page.waitForSelector(".copycard.on >> text=What visitors see");
  assert.ok((await page.innerText(".island")).includes("Saves go straight to visitors"));

  // content: the editor is split into parts, and asks before losing typing
  await page.evaluate(() => window.__adh.go("content")); await page.click('[data-act="ctab"][data-i="1"]'); await page.click('[data-act="open"]');
  assert.deepEqual(await page.locator(".seg.wide button").allInnerTexts(), ["Details", "At a glance", "Portfolio sections", "Timeline"]);
  assert.equal(await page.locator(".egroup:not([hidden])").count(), 1);
  await page.click('.seg.wide button >> nth=2'); assert.ok(await page.isVisible(".egroup:not([hidden]) .rt-page")); assert.ok(!(await page.isVisible("#f-0")));
  await page.locator(".egroup:not([hidden]) input[type=text]").first().fill("Life story");
  await page.click('.seg.wide button >> nth=0'); await page.fill("#f-0", "Zara M");
  await page.screenshot({ path: "/tmp/editor-parts.png" });
  await page.click('[data-tab="files"]');
  assert.ok(await page.isVisible("text=You have changes that are not saved yet"));
  assert.equal(await page.inputValue("#f-0"), "Zara M", "typing survives the question");
  await page.click('[data-act="leave-stay"]'); assert.equal(await page.inputValue("#f-0"), "Zara M");
  const sent = await page.evaluate(() => { window.__adh.render(); return window.__adh.state.draft.values; });
  assert.equal(sent["sections.0.title"], "Life story"); assert.equal(sent.name, "Zara M");
  await page.click('[data-tab="files"]'); await page.click('[data-act="leave-go"]'); await page.waitForSelector(".files");
  assert.equal(await page.evaluate(() => window.__adh.state.tab), "files");
  // long lists open short, and search looks through all of them
  await page.evaluate(() => window.__adh.go("content")); await page.waitForSelector("#clist"); await page.click('[data-act="ctab"][data-i="0"]');
  await page.evaluate(() => { const st = window.__adh.state, c = st.content[Object.keys(st.content)[0]][0]; for (let i = 1; i <= 12; i++) c.entries.push(Object.assign({}, c.entries[0], { id: "x" + i, title: "Extra piece " + i, sub: "Looking" })); window.__adh.render(); });
  const showing = () => page.locator("#clist .entry:not([hidden])").count();
  assert.equal(await showing(), 8); assert.ok(await page.isVisible("#cmore"));
  await page.fill("#csearch", "piece 11"); assert.equal(await showing(), 1); assert.ok(!(await page.isVisible("#cmore")));
  await page.fill("#csearch", "zzz"); assert.ok(await page.isVisible("#cnone"));
  await page.fill("#csearch", ""); assert.equal(await showing(), 8);
  await page.click("#cmore"); assert.ok((await showing()) > 12);
  await page.selectOption('[data-change="csort"]', "az"); const titles = await page.locator("#clist .entry b").allInnerTexts(); assert.deepEqual(titles, [...titles].sort((x, y) => x.localeCompare(y))); assert.ok(titles.length > 12);
  await page.screenshot({ path: "/tmp/content-list.png" });
  assert.deepEqual(errors, []);

  // phone width: nothing runs off the side
  await page.setViewportSize({ width: 390, height: 800 });
  for (const tab of ["theme", "files"]) { await page.click('[data-tab="' + tab + '"]'); await page.waitForTimeout(400); const wide = await page.evaluate(() => document.documentElement.scrollWidth <= 392 ? "" : ([...document.querySelectorAll("#app *")].filter((e) => e.getBoundingClientRect().right > 392).slice(0, 6).map((e) => e.tagName + "." + e.className + "#" + e.id + " " + Math.round(e.getBoundingClientRect().right)).join(" | ") || "page " + document.documentElement.scrollWidth)); assert.equal(wide, "", tab + " fits a phone"); }
  console.log("theme and editor: all good");
} finally { await browser.close(); servers.forEach((s) => s.kill()); }
