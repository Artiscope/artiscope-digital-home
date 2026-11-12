// Global Art Monitor in the page editor, in a real browser with a local copy of the site.
import fs from "node:fs"; import path from "node:path"; import assert from "node:assert/strict"; import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module"; const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
const A = 8821, B = 8822, consoleAt = "http://localhost:" + B, siteAt = "http://localhost:" + A + "/";
fs.rmSync("/tmp/gam-site", { recursive: true, force: true });
fs.cpSync("/home/claude/global-art-monitor", "/tmp/gam-site", { recursive: true, filter: (p) => !p.includes("/.git") });
execFileSync("node", ["/tmp/gam-site/tools/build.mjs"]);
fs.writeFileSync("/tmp/gam-site/assets/site.js", fs.readFileSync("/tmp/gam-site/assets/site.js", "utf8").split('"https://artiscope.github.io"').join('"' + consoleAt + '"'));
const servers = [spawn("python3", ["-m", "http.server", String(A), "-d", "/tmp/gam-site"], { stdio: "ignore" }), spawn("python3", ["-m", "http.server", String(B), "-d", path.resolve(".")], { stdio: "ignore" })];
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const shots = "/tmp/s4/"; fs.mkdirSync(shots, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 960 } });
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.route((u) => !u.hostname.includes("localhost"), (r) => r.abort());
  await page.goto(consoleAt + "/index.html?demo&gampreview=" + encodeURIComponent(siteAt));
  await page.waitForSelector('[data-act="open-site"]'); await page.click('[data-act="open-site"][data-site="global-art-monitor"]');
  await page.waitForSelector("#ed-sections .sec"); await page.waitForTimeout(2500);
  const frame = () => page.frames().find((f) => f.url().startsWith(siteAt));
  const settle = () => page.waitForTimeout(700);
  const groups = await page.$$eval(".pagepick optgroup", (g) => g.map((x) => x.label));
  assert.deepEqual(groups, ["Pages", "Articles", "Artist market profiles", "Across the site"]);
  assert.deepEqual(await page.locator("#ed-sections .sec:not(.blk) .nm").evaluateAll((l) => l.map((x) => x.firstChild.textContent)), ["Opening banner", "Status line", "Artist auction timeline", "Words explained", "Article cards", "Artist profile cards", "Where to start", "How we report a price"]);
  // the home page's banner, edited in place
  await frame().click("[data-adh=hero] .h1"); await page.waitForSelector(".ed-right h2:has-text('Opening banner')");
  await page.fill('[data-pf="headline"]', "Auction records, kept straight."); await settle();
  assert.equal(await frame().evaluate(() => document.querySelector(".hero .h1").textContent), "Auction records, kept straight.");
  await page.screenshot({ path: shots + "home.png" });
  // a link in the menu bar goes to that page
  await frame().evaluate(() => [...document.querySelectorAll(".site-head .nav a")].find((a) => a.textContent === "Auction Results").click()); await settle();
  assert.equal(await page.inputValue(".pagepick"), "page-auction-results");
  assert.ok((await frame().evaluate(() => document.title)).startsWith("Auction Results"));
  assert.ok(await frame().evaluate(() => document.querySelectorAll("#all-results tbody tr").length > 5));
  // an artist's market profile: its sales, each figure in its own field
  await frame().click("#all-results tbody tr:first-child td:nth-child(2) a"); await settle();
  assert.equal(await page.inputValue(".pagepick"), "artist-zara-muse");
  assert.deepEqual(await page.locator(".ed-left .sec[data-where=item] .nm").evaluateAll((l) => l.map((x) => x.firstChild.textContent)), ["Words", "Picture", "Sales", "About the artist"]);
  await frame().click('[data-adh="sales"] tr[data-adh-row="1"] td:first-child'); await page.waitForSelector(".ed-right :text('Sale 2 of')");
  assert.equal(await page.getAttribute('[data-pf="sales.1.hammer"]', "placeholder"), "To confirm");
  await page.fill('[data-pf="sales.1.hammer"]', ""); await settle();
  assert.ok((await frame().evaluate(() => document.querySelector('[data-adh="sales"] tr[data-adh-row="1"]').innerHTML)).includes("To confirm"), "an empty figure shows as To confirm");
  assert.equal(await page.evaluate(() => window.__adh.pgOf().site.artists[0].sales[1].hammer), null);
  await page.screenshot({ path: shots + "sale.png" });
  // add a sale
  const rows = await frame().evaluate(() => document.querySelectorAll('[data-adh="sales"] tr[data-adh-row]').length / 1);
  await page.click('.addl.blk[data-id="sales"]'); await page.fill('[data-pf$=".title"]', "A new work"); await settle();
  assert.equal(await frame().evaluate(() => document.querySelectorAll('[data-adh="sales"] tr[data-adh-row]').length), rows + 1);
  // a research page: which article cards it shows
  await page.selectOption(".pagepick", "page-research"); await settle();
  await page.click('#ed-sections .sec[data-id="features"]'); await page.selectOption('[data-pf="which"]', "+chosen"); await settle();
  await page.selectOption('.picklist [data-change="ed-pk-add"]', "zara-muse-auction-results"); await settle();
  assert.equal(await frame().evaluate(() => document.querySelectorAll('[data-adh="features"] .card').length), 1);
  // site details: a glossary term
  await page.selectOption(".pagepick", "site-details"); await settle();
  await page.click('.sec[data-where="item"][data-id="glossary"]'); await page.click('.addl.blk[data-id="glossary"]');
  await page.fill('[data-pf$=".0"]', "Reserve"); await page.fill('[data-pf$=".1"]', "The lowest price the seller will accept.");
  await page.screenshot({ path: shots + "site-details.png" });
  // a new page, in the full-screen menu
  await page.click('[data-act="ed-new"]'); await page.click('[data-act="ed-new"][data-what="page"]'); await page.fill("#nw-title", "Press"); await page.click('form[data-form="ednew"] button[type=submit]'); await settle();
  assert.equal(await page.inputValue(".pagepick"), "page-press");
  assert.equal(await frame().evaluate(() => document.querySelector(".page-head .h1").textContent), "Press");
  assert.ok(await frame().evaluate(() => [...document.querySelectorAll(".menu-list a")].some((a) => a.textContent.includes("Press"))));
  await page.click('[data-act="ed-library"]'); assert.equal(await page.locator('[data-act="ed-add"][data-kind="hero"]').count(), 0);
  await page.click('[data-act="ed-add"][data-kind="panel"]'); await settle();
  // one Save keeps it all
  await page.click('[data-act="ed-save"]'); await page.click('[data-act="livesave"]'); await page.waitForSelector("text=Saved. Live in about two minutes"); await page.waitForSelector(".pagepick"); await settle();
  const after = await page.evaluate(() => { const p = window.__adh.pgOf(); return { press: !!p.doc.pages.press, sales: p.site.artists[0].sales.length, gloss: p.site.glossary.some((g) => g[0] === "Reserve") }; });
  assert.ok(after.press && after.gloss); assert.equal(after.sales, rows + 1);
  // Files lists Global Art Monitor's pictures; Photos and Content have gone
  await page.click('.navb[data-tab="files"]'); await page.waitForSelector(".filecard");
  assert.ok(!(await page.isVisible('.navb[data-tab="photos"]')) && !(await page.isVisible('.navb[data-tab="content"]')));
  assert.ok((await page.innerText(".files")).includes("zara-muse.jpg"));
  assert.deepEqual(errors, []);
  console.log("GLOBAL ART MONITOR EDITOR CHECKS PASSED");
} finally { await browser.close(); servers.forEach((s) => s.kill()); }
