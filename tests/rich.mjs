// The plain-writing editor, checked in a real browser against the real
// article bodies of both sites. Run: node tests/rich.mjs
import fs from "node:fs"; import path from "node:path"; import assert from "node:assert/strict";
import { createRequire } from "node:module"; const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
const here = path.resolve("."), read = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const war = read("../world-art-review/content/site.json"), gam = read("../global-art-monitor/data/content.json");
const bodies = [];
if (war) { war.articles.forEach((a) => bodies.push(a.body)); war.artists.forEach((a) => { a.seen && bodies.push(a.seen); (a.sections || []).forEach((x) => bodies.push(x.html)); (a.glance || []).forEach((r) => /</.test(r[1]) && bodies.push(r[1])); }); }
if (gam) gam.features.forEach((f) => bodies.push(f.body));
bodies.push('<p onclick="x()">Hi <img src=x onerror="window.bad=1"><a href="javascript:window.bad=1">link</a></p><script>window.bad=1</script><iframe src="https://example.com"></iframe>');

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.route(/^https?:/, (r) => r.abort());
await page.goto("file://" + here + "/index.html?demo");
await page.waitForSelector('[data-tab="content"]');

// 1. nothing is lost: every real body survives a trip through the editor
const results = await page.evaluate((list) => list.map((html) => {
  const keep = [], doc = new DOMParser().parseFromString("<body>" + html + "</body>", "text/html");
  const ed = document.createElement("div"); ed.contentEditable = "true"; document.body.appendChild(ed);
  ed.innerHTML = window.__adh.richIn(doc.body, keep);
  const shown = ed.innerHTML, out = window.__adh.richOut(ed, keep, window.__adh.richInline(doc.body)); ed.remove();
  return { shown, out };
}), bodies);
const norm = (h) => h.replace(/>\s+</g, "><").replace(/\s+/g, " ").replace(/=""/g, "").replace(/\s*\/>/g, ">").replace(/<\/(rect|feDiffuseLighting|feDistantLight|feTurbulence|feComposite|feGaussianBlur|feBlend|feColorMatrix|feMerge|feMergeNode|circle|path|line|stop)>/g, "").trim();
let same = 0;
results.slice(0, -1).forEach((r, i) => {
  const a = norm(bodies[i]), b = norm(r.out);
  if (a === b) { same++; return; }
  let j = 0; while (a[j] === b[j]) j++;
  assert.fail("body " + i + " changed at " + j + ":\n was: " + a.slice(Math.max(0, j - 80), j + 120) + "\n now: " + b.slice(Math.max(0, j - 80), j + 120));
});
console.log(same + " real bodies come back unchanged");
const bad = results[results.length - 1];
assert.ok(!/onclick|onerror|javascript:|<script|<iframe|<img/i.test(bad.shown), "nothing unsafe is put on the page: " + bad.shown);
assert.equal(await page.evaluate(() => window.bad), undefined);

// 2. the editor on screen
await page.click('[data-tab="content"]'); await page.click('[data-act="open"]');
await page.click('.seg.wide button:has-text("Body")');
await page.waitForSelector(".rt-page");
const shown = await page.innerHTML(".rt-page");
assert.ok(!(await page.innerText(".rt-page")).includes("<p>") && shown.includes("rt-chip") && shown.includes("The auction table for zara muse appears here"));
assert.equal(await page.locator("textarea.tall").count(), 0);
// untouched text is not sent
assert.ok(!("body" in await page.evaluate(() => { window.__adh.render(); return window.__adh.state.draft.values; })));
// type, make bold, add a heading and a link
const caret = (sel, atEnd) => page.evaluate(([q, end]) => { const n = document.querySelector(q), r = document.createRange(); r.selectNodeContents(n); r.collapse(!end); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.querySelector(".rt-page").focus(); }, [sel, atEnd]);
const back = async (n) => { await page.keyboard.down("Shift"); for (let i = 0; i < n; i++) await page.keyboard.press("ArrowLeft"); await page.keyboard.up("Shift"); };
await page.click(".rt-page p >> nth=0"); await caret(".rt-page p", false);
await page.keyboard.type("Hello there. "); await page.keyboard.press("ArrowLeft"); await back(6);
await page.click('[data-rt="bold"]');
await caret(".rt-page ul li:last-child", true); await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
await page.keyboard.type("A new heading"); await page.click('[data-rt="h2"]');
console.log(await page.innerHTML(".rt-page"));
await page.keyboard.press("Enter"); await page.keyboard.type("Visit Tate"); await back(4);
await page.click('[data-rt="link"]'); await page.fill(".rt-link input", "www.tate.org.uk"); await page.keyboard.press("Enter");
await page.screenshot({ path: "/tmp/rich.png", fullPage: true });
const body = await page.evaluate(() => { window.__adh.render(); return window.__adh.state.draft.values.body; });
console.log(body);
assert.ok(body.startsWith("<p>Hello <strong>there.</strong> Start with the whole picture"), "bold");
assert.ok(body.includes('<sup class="cite"><a data-src="sample-1">[sample-1]</a></sup>') && body.includes("[[TIMELINE:zara-muse]]"), "sources and features kept");
assert.ok(body.includes("<h2>A new heading</h2>") && body.includes('<p>Visit <a href="https://www.tate.org.uk">Tate</a></p>'), "heading and link");
assert.ok(body.includes('<div class="callout"><strong>Try it</strong>Pick one') && !/style=|rt-|contenteditable|&nbsp;/.test(body), "clean");
// a redraw keeps what was typed
assert.ok((await page.innerText(".rt-page")).includes("A new heading"));
await page.click('button[type="submit"]'); await page.waitForSelector("text=Saved. Not live yet");
assert.deepEqual(errors, []);
// phone width
await page.setViewportSize({ width: 390, height: 800 }); await page.click('[data-act="open"]'); await page.click('.seg.wide button:has-text("Body")'); await page.waitForSelector(".rt-page");
assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 392), "fits a phone");
await page.screenshot({ path: "/tmp/rich-phone.png" });
await page.setViewportSize({ width: 1280, height: 900 }); await page.click('[data-act="close"]'); await page.click('[data-act="ctab"][data-i="1"]'); await page.click('[data-act="open"]');
await page.waitForSelector(".rt-page.short", { state: "attached" }); assert.equal(await page.locator(".rt-page").count(), 2); assert.equal(await page.locator(".seg.wide button").count(), 4);
assert.ok(!(await page.inputValue("#f-3")).includes("<"));
await page.screenshot({ path: "/tmp/rich-artist.png", fullPage: true });
await browser.close(); console.log("rich editor: all good");
