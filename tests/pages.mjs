// The page editor on World Art Review, in a real browser with a local copy of the site.
import fs from "node:fs"; import path from "node:path"; import assert from "node:assert/strict"; import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module"; const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
const A = 8781, B = 8782, consoleAt = "http://localhost:" + B, siteAt = "http://localhost:" + A + "/";
fs.rmSync("/tmp/site-p", { recursive: true, force: true });
execFileSync("python3", ["/home/claude/world-art-review/tools/build_site.py", "/tmp/site-p"]);
fs.writeFileSync("/tmp/site-p/index.html", fs.readFileSync("/tmp/site-p/index.html", "utf8").split('var ok="https://artiscope.github.io"').join('var ok="' + consoleAt + '"'));
const servers = [spawn("python3", ["-m", "http.server", String(A), "-d", "/tmp/site-p"], { stdio: "ignore" }), spawn("python3", ["-m", "http.server", String(B), "-d", path.resolve(".")], { stdio: "ignore" })];
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 960 } });
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.route((u) => !u.hostname.includes("localhost"), (r) => r.abort());
  await page.goto(consoleAt + "/index.html?demo&preview=" + encodeURIComponent(siteAt));
  await page.waitForSelector('[data-act="open-site"]'); await page.click('[data-act="open-site"][data-site="world-art-review"]');
  await page.waitForSelector("#ed-sections .sec"); await page.waitForTimeout(3500);
  const frame = () => page.frames().find((f) => f.url().startsWith(siteAt));
  const ids = () => frame().evaluate(() => [...document.querySelectorAll("#main > section")].map((s) => s.id));
  assert.deepEqual(await page.locator("#ed-sections .sec:not(.blk) .nm").allInnerTexts().then((t) => t.map((x) => x.split("\n")[0])), ["Opening banner", "Featured artists", "Read by section", "Art, explained", "Numbers band", "How we research"]);
  assert.deepEqual(await ids(), ["hero", "featured", "sections", "explainedHome", "numbers", "method"]);
  // pick a section on the page itself
  await frame().click("#numbers"); await page.waitForSelector(".ed-right h2:has-text('Numbers band')");
  assert.ok(await frame().evaluate(() => document.querySelector("#numbers").classList.contains("adh-picked-block")));
  // edit a word: the page redraws before anything is saved
  await page.fill('[data-pf="eyebrow"]', "The review today"); await page.waitForTimeout(400);
  assert.equal(await frame().evaluate(() => document.querySelector("#numbers .eyebrow").textContent), "The review today");
  assert.ok((await page.innerText(".ed-top")).includes("Edited, not saved") && await page.isVisible('[data-act="ed-save"]'));
  // hide it, move it up, add a quote below it
  await page.click('#ed-float [data-act="ed-hide"]'); await page.waitForTimeout(300); assert.ok(!(await ids()).includes("numbers"));
  await page.click('#ed-float [data-act="ed-hide"]'); await page.click('#ed-float [data-act="ed-move"][data-dir="-1"]'); await page.waitForTimeout(300);
  assert.deepEqual(await ids(), ["hero", "featured", "sections", "numbers", "explainedHome", "method"]);
  await page.click('[data-act="ed-library"]'); await page.click('[data-act="ed-add"][data-kind="quote"]'); await page.waitForTimeout(400);
  assert.deepEqual(await ids(), ["hero", "featured", "sections", "numbers", "quote-1", "explainedHome", "method"]);
  await page.fill('[data-pf="text"]', "Knives,\nnot brushes."); await page.fill('[data-pf="who"]', "House rule"); await page.waitForTimeout(400);
  assert.ok((await frame().evaluate(() => document.querySelector("#quote-1").textContent)).includes("not brushes."));
  await page.selectOption('[data-pf="bg"]', "custom"); await page.waitForTimeout(300);
  assert.ok((await frame().evaluate(() => document.querySelector("#quote-1").getAttribute("style") || "")).includes("background:#1D4A35"));
  await page.screenshot({ path: "/tmp/editor-live.png" });
  // a text section with the plain-writing editor
  await page.click('[data-act="ed-library"]'); await page.click('[data-act="ed-add"][data-kind="text"]'); await page.waitForSelector(".ed-right .rt-page");
  await page.click(".ed-right .rt-page"); await page.keyboard.press("Control+End"); await page.keyboard.type(" More words."); await page.waitForTimeout(400);
  assert.ok((await frame().evaluate(() => document.querySelector("#text-1 .prose").textContent)).includes("More words."));
  // remove it, with the question first
  await page.click('#ed-float [data-act="ask"]'); await page.click('#ed-float [data-act="ed-remove"]'); await page.waitForTimeout(300);
  assert.ok(!(await ids()).includes("text-1"));
  // leaving asks; discard puts everything back
  await page.click('[data-tab="overview"]'); assert.ok(await page.isVisible("text=You have changes that are not saved yet"));
  await page.click('[data-act="leave-stay"]');
  await page.click('[data-act="ed-discard"]'); await page.waitForTimeout(400);
  assert.deepEqual(await ids(), ["hero", "featured", "sections", "explainedHome", "numbers", "method"]);
  assert.ok(!(await page.innerText(".ed-top")).includes("Edited"));
  // save goes through the live question
  await page.click('#ed-sections .sec[data-id="method"]:not(.blk)'); await page.fill('[data-pf="eyebrow"]', "Our method"); await page.waitForTimeout(300);
  await page.click('[data-act="ed-save"]'); await page.waitForSelector("text=This page change goes live"); await page.click('[data-act="livesave"]');
  await page.waitForSelector("text=Saved. Live in about two minutes");
  assert.ok(!(await page.innerText(".ed-top")).includes("Edited"));
  // blocks: the cards of How we research are listed under it and can be picked, hidden, moved and added
  await page.click('#ed-sections .sec[data-id="method"]:not(.blk)'); await page.waitForSelector(".blocknote");
  assert.deepEqual(await page.locator('.sec.blk[data-id="method"] .nm').allInnerTexts(), ["Start with the work", "Every fact, sourced", "Publicity, flagged"]);
  await page.click('.sec.blk[data-id="method"][data-block="1"]'); await page.waitForSelector(".ed-right h2:has-text('Every fact, sourced')");
  assert.ok((await page.innerText(".ed-right")).includes("Card 2 of 3") && (await page.innerText(".ed-right")).includes("Shown in bold at the foot of the card."));
  await page.waitForTimeout(400);
  assert.ok(await frame().evaluate(() => { const b = document.querySelectorAll("#method .mcard")[1]; return b.classList.contains("adh-picked-block") && b.getAttribute("data-adh-label") === "Card: Every fact, sourced"; }), "the block is outlined and labelled on the page");
  await page.fill('[data-pf="cards.1.title"]', "Every fact, checked"); await page.waitForTimeout(300);
  assert.ok((await frame().evaluate(() => document.querySelectorAll("#method .mcard")[1].textContent)).includes("Every fact, checked"));
  await page.click('#ed-float [data-act="ed-hide"]'); await page.waitForTimeout(300);
  assert.equal(await frame().evaluate(() => document.querySelectorAll("#method .mcard").length), 2, "a hidden card leaves the page");
  await page.click('#ed-float [data-act="ed-hide"]'); await page.click('#ed-float [data-act="ed-move"][data-dir="-1"]'); await page.waitForTimeout(300);
  assert.ok((await frame().evaluate(() => document.querySelectorAll("#method .mcard")[0].textContent)).includes("Every fact, checked"));
  await page.click('.addl.blk[data-id="method"]'); await page.waitForTimeout(300);
  assert.equal(await frame().evaluate(() => document.querySelectorAll("#method .mcard").length), 4);
  await page.click('#ed-float [data-act="ask"]'); await page.click('#ed-float [data-act="ed-remove"]'); await page.waitForTimeout(300);
  assert.equal(await frame().evaluate(() => document.querySelectorAll("#method .mcard").length), 3);
  // click a card on the page itself
  await frame().click("#method .mcard >> nth=2"); await page.waitForSelector(".ed-right h2:has-text('Publicity, flagged')");
  // a picture: upload, see it on the page at once, describe it, save both together
  await page.click('[data-act="ed-library"]'); await page.click('[data-act="ed-add"][data-kind="picture"]'); await page.waitForSelector('[data-upload="image"]', { state: "attached" });
  await page.setInputFiles('[data-upload="image"]', "/tmp/s2/studio.jpg"); await page.waitForSelector(".picthumb[src^='data:image']");
  await page.waitForTimeout(400);
  assert.ok(await frame().evaluate(() => (document.querySelector("#picture-1 img") || {}).src.startsWith("data:image/jpeg")), "the new photo shows on the page before saving");
  await page.click('[data-act="ed-picker"]'); assert.ok(await page.isVisible(".picgrid .pictile")); await page.click('[data-act="ed-picker"]');
  await page.screenshot({ path: "/tmp/editor-blocks.png" });
  await page.click('[data-act="ed-save"]'); await page.waitForSelector("text=Please describe the picture");
  await page.fill('[data-pf="alt"]', "A studio wall"); await page.click('[data-act="ed-save"]');
  await page.waitForSelector("text=This page change and its new photo goes live"); await page.click('[data-act="livesave"]'); await page.waitForSelector("text=Saved. Live in about two minutes");
  // phone view and a trial copy
  await page.waitForTimeout(800); await page.click('[data-act="ed-mode"][data-mode="phone"]'); await page.waitForSelector("#ed-frame"); assert.equal(await page.evaluate(() => document.querySelector("#ed-frame").offsetWidth), 390);
  assert.deepEqual(errors, []);
  console.log("page editor: all good");
} finally { await browser.close(); servers.forEach((s) => s.kill()); }
