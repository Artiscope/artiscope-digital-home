// Shared pictures in the page editor and the Files screen, in a real browser with a local copy of World Art Review.
import fs from "node:fs"; import path from "node:path"; import assert from "node:assert/strict"; import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module"; const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
const A = 8791, B = 8792, consoleAt = "http://localhost:" + B, siteAt = "http://localhost:" + A + "/";
fs.rmSync("/tmp/site-f", { recursive: true, force: true });
execFileSync("python3", ["/home/claude/world-art-review/tools/build_site.py", "/tmp/site-f"]);
fs.cpSync("/home/claude/world-art-review/images", "/tmp/site-f/images", { recursive: true });
fs.writeFileSync("/tmp/site-f/index.html", fs.readFileSync("/tmp/site-f/index.html", "utf8").split('var ok="https://artiscope.github.io"').join('var ok="' + consoleAt + '"'));
const servers = [spawn("python3", ["-m", "http.server", String(A), "-d", "/tmp/site-f"], { stdio: "ignore" }), spawn("python3", ["-m", "http.server", String(B), "-d", path.resolve(".")], { stdio: "ignore" })];
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 960 } });
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.route((u) => !u.hostname.includes("localhost"), (r) => r.abort());
  await page.goto(consoleAt + "/index.html?demo&preview=" + encodeURIComponent(siteAt));
  await page.waitForSelector('[data-act="open-site"]'); await page.click('[data-act="open-site"][data-site="world-art-review"]');
  await page.waitForSelector("#ed-sections .sec"); await page.waitForTimeout(3000);
  const frame = () => page.frames().find((f) => f.url().startsWith(siteAt));
  assert.ok(await page.isVisible('.sec.plain[data-tab="files"]') && !(await page.isVisible('[data-tab="photos"]')), "Files replaces Photos");

  // the banner lists the pictures it shows, each one shared
  await page.click('#ed-sections .sec[data-id="hero"]:not(.blk)'); await page.waitForSelector(".sec.pic");
  const rows = await page.locator(".sec.pic .nm").allInnerTexts();
  assert.deepEqual(rows, ["Banner: Zara Muse", "Latest box: Zara Muse: biography, artistic style and career", "Latest box: Konn Artiss: artist profile and selected works", "Latest box: ANTI-FRIEZE: what melts when the art market is put on ice", "Small box: Konn Artiss"]);
  assert.ok((await page.innerText(".ed-right")).includes("Main picture"), "the banner has its own picture setting");
  await page.screenshot({ path: "/tmp/s2/step2-banner.png" });

  // Konn Artiss has no picture yet: upload one from the panel, see it on the page at once
  await page.click('.sec.pic[data-key="artist:konn-artiss"]'); await page.waitForSelector(".ed-right h2:has-text('Picture of Konn Artiss')");
  assert.ok((await page.innerText(".ed-right")).includes("also shows on Konn Artiss's portfolio and the home page"));
  assert.equal(await page.locator("#ed-float .float").count(), 0, "no move or hide for a shared picture");
  await page.setInputFiles('[data-upload="image"]', "/tmp/s2/studio.jpg"); await page.waitForSelector(".picthumb[src^='data:image']"); await page.waitForTimeout(500);
  assert.ok(await frame().evaluate(() => [...document.querySelectorAll(".hero .srcs .plate img")].some((i) => i.src.startsWith("data:image"))), "the small box shows the new photo");
  await page.fill('[data-pf="alt"]', "Blocks of ice on a London pavement"); await page.fill('[data-pf="credit"]', "Photo: studio"); await page.waitForTimeout(300);
  assert.ok((await page.innerText(".ed-top")).includes("Edited, not saved"));
  await page.screenshot({ path: "/tmp/s2/step2-shared.png" });

  // the banner's own picture, chosen from the site: its saved description comes with it
  await page.click('[data-act="ed-pick"][data-id="hero"]'); await page.waitForSelector('[data-act="ed-picker"][data-path="image"]');
  await page.click('[data-act="ed-picker"][data-path="image"]'); await page.click('[data-act="ed-pic-choose"][data-name="zara-muse-portrait.jpg"]'); await page.waitForTimeout(400);
  assert.equal(await page.inputValue('[data-pf="alt"]'), "Zara Muse's portrait, painted with a palette knife in warm reds and gold");
  assert.ok(!(await page.locator(".sec.pic .nm").allInnerTexts()).some((t) => t.startsWith("Banner:")), "the artist's picture is no longer in the banner");
  await page.fill('[data-pf="credit"]', "Zara Muse, studio wall"); await page.waitForTimeout(400);
  assert.equal(await frame().evaluate(() => document.querySelector("#heroFrame .credit").textContent), "Zara Muse, studio wall");

  // save asks once, naming the shared picture
  await page.click('[data-act="ed-save"]'); await page.waitForSelector("text=including the shared picture of Konn Artiss");
  await page.click('[data-act="livesave"]'); await page.waitForSelector("text=Saved. Live in about two minutes");
  await page.waitForSelector("#ed-sections .sec"); await page.waitForTimeout(800);
  assert.ok(!(await page.innerText(".ed-top")).includes("Edited"));

  // a description is needed before a shared picture can be saved
  await page.click('#ed-sections .sec[data-id="featured"]:not(.blk)'); await page.click('.sec.pic[data-key="artist:zara-muse"]');
  await page.fill('[data-pf="alt"]', ""); await page.click('[data-act="ed-save"]');
  await page.waitForSelector("text=Please describe the picture in the picture of Zara Muse");
  await page.click('[data-act="ed-discard"]');

  // Files: every photo, what it shows and where it is used
  await page.click('.sec.plain[data-tab="files"]'); await page.waitForSelector(".filecard");
  assert.ok(await page.isVisible('.navb[data-tab="files"]') && !(await page.isVisible('.navb[data-tab="photos"]')), "the menu shows Files, not Photos");
  const names = await page.locator(".filecard .fname").allInnerTexts();
  assert.deepEqual(names, ["zara-muse-portrait.jpg", "article-palette-knife-painting.jpg", "studio.jpg"]);
  const zara = page.locator(".filecard").first();
  assert.ok((await zara.innerText()).includes("Home page: Opening banner") && (await zara.innerText()).includes("Artist: Zara Muse"));
  assert.ok((await zara.innerText()).includes("In use, so it cannot be deleted"));
  assert.ok((await page.locator(".filecard").nth(1).innerText()).includes("No description yet"));
  await page.screenshot({ path: "/tmp/s2/step2-files.png", fullPage: true });
  // filters
  await page.click('[data-act="files-filter"][data-f="nodesc"]'); assert.equal(await page.locator(".filecard").count(), 1);
  await page.click('[data-act="files-describe"][data-name="article-palette-knife-painting.jpg"]');
  await page.fill("#fd-alt", "Close view of paint pressed on with a palette knife"); await page.click('form[data-form="fdesc"] button[type=submit]');
  await page.waitForSelector("text=The description of article-palette-knife-painting.jpg goes live"); await page.click('[data-act="livesave"]'); await page.waitForSelector("text=Description saved");
  await page.waitForSelector(".filters"); assert.equal(await page.locator('[data-act="files-filter"][data-f="nodesc"] .n').innerText(), "0");
  // upload two at once, each described
  await page.click('[data-act="files-filter"][data-f="all"]');
  await page.setInputFiles('[data-change="files-add"]', ["/tmp/s2/studio.jpg", "/tmp/s2/studio.jpg"]);
  await page.waitForSelector(".addrow"); assert.ok(await page.isDisabled('[data-act="files-send"]'));
  await page.fill("#fa-alt-0", "A painter's studio"); await page.fill("#fa-alt-1", "The same studio again"); assert.ok(!(await page.isDisabled('[data-act="files-send"]')));
  await page.waitForTimeout(900); await page.screenshot({ path: "/tmp/s2/step2-upload.png" });
  await page.click('[data-act="files-send"]'); await page.click('[data-act="livesave"]'); await page.waitForSelector("text=2 photos added");
  await page.waitForSelector(".filecard"); assert.equal(await page.locator(".filecard").count(), 5);
  // an unused photo can be deleted, after a question
  await page.click('.filecard:last-child [data-act="ask"]'); await page.click('[data-act="files-remove"]'); await page.click('[data-act="livesave"]');
  await page.waitForSelector("text=Photo deleted"); await page.waitForSelector(".filecard"); assert.equal(await page.locator(".filecard").count(), 4);
  // a place without a picture gets one
  await page.click('[data-act="files-filter"][data-f="empty"]'); await page.waitForSelector(".spot");
  const before = Number(await page.locator('[data-act="files-filter"][data-f="empty"] .n').innerText());
  await page.click('.spot [data-act="files-assign"][data-key="work:zara-muse:0"]'); await page.click('[data-act="files-pick"][data-name="studio.jpg"]');
  assert.equal(await page.inputValue("#fa-alt"), "Blocks of ice on a London pavement", "the photo's description is offered");
  await page.waitForTimeout(900); await page.screenshot({ path: "/tmp/s2/step2-place.png" });
  await page.click('form[data-form="fassign"] button[type=submit]'); await page.click('[data-act="livesave"]'); await page.waitForSelector("text=Picture put in place");
  await page.waitForSelector(".filters"); assert.equal(Number(await page.locator('[data-act="files-filter"][data-f="empty"] .n').innerText()), before - 1);
  // "Used in" leads straight to the section in Pages
  await page.click('[data-act="files-filter"][data-f="all"]'); await page.click('.filecard >> nth=0 >> [data-act="files-goto"]');
  await page.waitForSelector(".ed-right h2:has-text('Opening banner')");
  // phone width holds
  await page.setViewportSize({ width: 390, height: 844 }); 
  await page.evaluate(() => { window.__adh.state.tab = "files"; window.__adh.render(); }); await page.waitForSelector(".filecard");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 392), "no sideways scrolling on a phone");
  assert.deepEqual(errors, []);
  console.log("FILES SCREEN CHECKS PASSED");
} finally { await browser.close(); servers.forEach((s) => s.kill()); }
