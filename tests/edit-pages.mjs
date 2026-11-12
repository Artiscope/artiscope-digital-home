// Moving between pages in the editor, and editing lists, articles, portfolios, sources and new pages in place.
import fs from "node:fs"; import path from "node:path"; import assert from "node:assert/strict"; import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module"; const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
const A = 8811, B = 8812, consoleAt = "http://localhost:" + B, siteAt = "http://localhost:" + A + "/";
fs.rmSync("/tmp/site-e", { recursive: true, force: true });
execFileSync("python3", ["/home/claude/world-art-review/tools/build_site.py", "/tmp/site-e"]);
fs.cpSync("/home/claude/world-art-review/images", "/tmp/site-e/images", { recursive: true });
fs.writeFileSync("/tmp/site-e/index.html", fs.readFileSync("/tmp/site-e/index.html", "utf8").split('var ok="https://artiscope.github.io"').join('var ok="' + consoleAt + '"'));
const servers = [spawn("python3", ["-m", "http.server", String(A), "-d", "/tmp/site-e"], { stdio: "ignore" }), spawn("python3", ["-m", "http.server", String(B), "-d", path.resolve(".")], { stdio: "ignore" })];
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const shots = "/tmp/s3/"; fs.mkdirSync(shots, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 960 } });
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.route((u) => !u.hostname.includes("localhost"), (r) => r.abort());
  await page.goto(consoleAt + "/index.html?demo&preview=" + encodeURIComponent(siteAt));
  await page.waitForSelector('[data-act="open-site"]'); await page.click('[data-act="open-site"][data-site="world-art-review"]');
  await page.waitForSelector("#ed-sections .sec"); await page.waitForTimeout(3000);
  const frame = () => page.frames().find((f) => f.url().startsWith(siteAt));
  const hash = () => frame().evaluate(() => location.hash);
  const settle = () => page.waitForTimeout(700);
  assert.ok(!(await page.isVisible('.sec.plain[data-tab="content"]')), "Content has gone, everything is in Pages");
  const groups = await page.$$eval(".pagepick optgroup", (g) => g.map((x) => x.label));
  assert.deepEqual(groups, ["Pages", "Lists", "Articles", "Artist portfolios"]);

  // a click on Reviews in the menu bar goes to Reviews, in the preview and in the editor
  await frame().click("header.hdr nav.left a:has-text('Reviews')"); await settle();
  assert.equal(await hash(), "#reviews"); assert.equal(await page.inputValue(".pagepick"), "reviews");
  assert.ok((await page.innerText(".ed-left")).includes("Page heading") && (await page.innerText(".ed-left")).includes("In this list"));
  // with Alt held, a click picks the link to change it
  await frame().click("header.hdr nav.left a:has-text('Reviews')", { modifiers: ["Alt"] }); await page.waitForSelector(".ed-right h2:has-text('Reviews')");
  assert.equal(await hash(), "#reviews");
  // the list's heading and introduction
  await page.click('.sec[data-where="list"]'); await page.waitForSelector(".ed-right h2:has-text('Page heading')");
  await page.fill('[data-pf="intro"]', "Close readings of single works."); await settle();
  assert.equal(await frame().evaluate(() => document.querySelector(".phead .dek").textContent), "Close readings of single works.");
  await page.screenshot({ path: shots + "list.png" });

  // open an article from the list, then edit it in place
  await page.click('[data-act="ed-go"][data-hash="a-review-anti-frieze"]'); await settle();
  assert.equal(await hash(), "#a-review-anti-frieze");
  assert.deepEqual(await page.locator(".ed-left .sec[data-where=item] .nm").evaluateAll((l) => l.map((x) => x.firstChild.textContent)), ["Title and summary", "Picture", "Body", "Sources", "Settings"]);
  await frame().click("#articleBody p >> nth=0"); await page.waitForSelector(".ed-right h2:has-text('Body')");
  assert.ok(await page.isVisible(".rt-cite"), "the body can cite a source");
  await page.click('.sec[data-where="item"][data-id="words"]'); await page.fill('[data-pf="title"]', "ANTI-FRIEZE: what the ice said"); await settle();
  assert.ok((await frame().evaluate(() => document.querySelector(".phead h1").textContent)).includes("what the ice said"));
  // cite a source in the body, at the cursor
  await page.click('.sec[data-where="item"][data-id="body"]'); await page.waitForSelector(".ed-right .rt-page");
  await page.click(".ed-right .rt-page p >> nth=0"); await settle(); await page.keyboard.press("End"); await settle();
  await page.selectOption(".rt-cite", "ap-muse"); await settle();
  assert.ok(await page.evaluate(() => { const p = window.__adh.pgOf(); return p.site.articles.find((a) => a.slug === "review-anti-frieze").body.includes('data-src="ap-muse"'); }));
  // sources: add one from the list, then a brand new one
  await page.click('.sec[data-where="item"][data-id="sources"]'); await page.waitForSelector(".picklist");
  const before = await page.locator(".picklist li").count();
  await page.selectOption('[data-change="ed-pk-add"]', "grove-zm"); await settle(); assert.equal(await page.locator(".picklist li").count(), before + 1);
  await page.selectOption('[data-change="ed-pk-add"]', "+new"); await page.waitForSelector('form[data-form="ednew"][data-what="source"]');
  await page.fill("#nw-title", "Ice blocks outside Frieze"); await page.fill("#nw-pub", "The Art Newspaper"); await page.fill("#nw-date", "2025"); await page.fill("#nw-url", "https://example.com/ice");
  await page.screenshot({ path: shots + "new-source.png" });
  await page.click('form[data-form="ednew"] button[type=submit]'); await page.waitForSelector(".picklist"); await settle();
  assert.equal(await page.locator(".picklist li").count(), before + 2); assert.ok((await page.innerText(".picklist")).includes("Ice blocks outside Frieze"));
  assert.ok((await frame().innerText("#sources-list")).includes("Ice blocks outside Frieze"), "the new source is in the article's list");
  await page.screenshot({ path: shots + "article.png" });

  // a portfolio: the timeline gets a new event, an artwork says it has no size
  await page.selectOption(".pagepick", "artist-konn-artiss"); await settle();
  assert.equal(await hash(), "#artist-konn-artiss");
  await page.click('.sec[data-where="item"][data-id="timeline"]'); await page.waitForSelector('.addl.blk[data-id="timeline"]');
  const events = await frame().evaluate(() => document.querySelectorAll("ol.timeline > li").length);
  await page.click('.addl.blk[data-id="timeline"]'); await page.fill('[data-pf="timeline.' + events + '.what"]', "Shows new work in Venice."); await settle();
  assert.equal(await frame().evaluate(() => document.querySelectorAll("ol.timeline > li").length), events + 1);
  assert.ok((await frame().evaluate(() => [...document.querySelectorAll("ol.timeline > li")].at(-1).textContent)).includes("Year to confirm"));
  await frame().click(".work-btn >> nth=0"); await page.waitForSelector(".ed-right :text('Work 1 of')");
  assert.ok((await page.innerText(".ed-right")).includes("Work 1 of"));
  await page.screenshot({ path: shots + "portfolio.png" });
  // an unpublished portfolio can be seen and edited
  await page.selectOption(".pagepick", "artist-zen-xander"); await settle();
  assert.ok((await frame().evaluate(() => document.querySelector(".phead h1").textContent)).includes("Zen Xander"));

  // something new: an article, hidden until ready, and a page in the menu bar
  await page.click('[data-act="ed-new"]'); await page.click('[data-act="ed-new"][data-what="article"]');
  await page.fill("#nw-title", "Reading a certificate"); await page.selectOption("#nw-section", "library"); await page.click('form[data-form="ednew"] button[type=submit]'); await settle();
  assert.equal(await hash(), "#a-reading-a-certificate"); assert.ok((await frame().evaluate(() => document.querySelector(".phead h1").textContent)).includes("Reading a certificate"));
  await page.click('.sec[data-where="item"][data-id="settings"]'); assert.equal(await page.inputValue('[data-pf="hidden"]'), "true");
  await page.click('[data-act="ed-new"]'); await page.click('[data-act="ed-new"][data-what="page"]'); await page.fill("#nw-title", "Visit us");
  await page.screenshot({ path: shots + "new-page.png" });
  await page.click('form[data-form="ednew"] button[type=submit]'); await settle();
  assert.equal(await hash(), "#page-visit-us"); assert.ok((await frame().innerText("header.hdr")).includes("Visit us"), "the new page is in the menu bar");
  assert.ok((await frame().innerText("#main")).includes("Visit us"));
  await page.click('[data-act="ed-library"]'); await page.waitForSelector('[data-act="ed-add"][data-kind="quote"]');
  assert.equal(await page.locator('[data-act="ed-add"][data-kind="hero"]').count(), 0, "home-only sections are not offered");
  await page.click('[data-act="ed-add"][data-kind="quote"]'); await settle();
  assert.ok(await frame().evaluate(() => !!document.querySelector("#quote-1")));

  // one Save keeps all of it
  await page.click('[data-act="ed-save"]'); await page.waitForSelector('[data-act="livesave"]'); await page.click('[data-act="livesave"]');
  await page.waitForSelector("text=Saved. Live in about two minutes"); await page.waitForSelector(".pagepick"); await settle();
  const after = await page.evaluate(() => { const p = window.__adh.pgOf(); return { page: p.doc.pages["visit-us"] && p.doc.pages["visit-us"].sections.length, art: p.site.articles.some((a) => a.slug === "reading-a-certificate" && a.hidden), src: Object.values(p.site.sources).some((x) => x.title === "Ice blocks outside Frieze"), title: p.site.articles.find((a) => a.slug === "review-anti-frieze").title, intro: p.doc.lists.reviews.intro, at: p.at, pageNow: p.page }; });
  assert.deepEqual(after, { page: 2, art: true, src: true, title: "ANTI-FRIEZE: what the ice said", intro: "Close readings of single works.", at: "", pageNow: "visit-us" });
  // a page can leave the menu bar and be deleted
  await page.click('.sec[data-where="pageinfo"]'); await page.click('[data-act="ed-menu"]'); await settle();
  assert.ok(!(await frame().innerText("header.hdr")).includes("Visit us"));
  await page.click('[data-act="ask"][data-k="ed-delpage"]'); await page.click('[data-act="ed-delpage"]'); await settle();
  assert.equal(await hash(), "#home"); assert.ok(!(await page.$$eval(".pagepick option", (o) => o.map((x) => x.value))).includes("page-visit-us"));
  await page.click('[data-act="ed-discard"]');
  // Editorial standards is a page of sections now, and can be edited, but not deleted
  await frame().click("footer a[href='#standards']"); await settle();
  assert.equal(await page.inputValue(".pagepick"), "page-standards");
  assert.deepEqual(await page.locator("#ed-sections .sec:not(.blk) .nm").evaluateAll((l) => l.map((x) => x.firstChild.textContent)), ["Page heading", "Long text"]);
  await frame().click("#text h2 >> nth=0"); await page.waitForSelector(".ed-right h2:has-text('Long text')");
  await page.click('.sec[data-where="pageinfo"]'); assert.ok((await page.innerText(".ed-right")).includes("one of the site's own pages"));
  // the research desk and search have their own headings
  await page.selectOption(".pagepick", "search"); await settle(); await page.click('.sec[data-where="list"]'); await page.fill('[data-pf="intro"]', "Find anything."); await settle();
  assert.equal(await frame().evaluate(() => document.querySelector(".phead .dek").textContent), "Find anything.");
  // a source that is cited cannot be deleted
  await page.selectOption(".pagepick", "a-palette-knife-painting"); await settle(); await page.click('.sec[data-where="item"][data-id="sources"]');
  await page.click('.picklist [data-op="edit"] >> nth=0'); await page.waitForSelector(".ed-right h2:has-text('Source')");
  assert.ok((await page.innerText(".ed-right")).includes("cannot be deleted"));
  // an artist named in articles cannot be deleted; one who is not, can
  await page.selectOption(".pagepick", "artist-zara-muse"); await settle(); await page.click('.sec[data-where="item"][data-id="settings"]');
  assert.ok((await page.innerText(".ed-right")).includes("is named in"));
  await page.selectOption(".pagepick", "artist-zen-xander"); await settle(); await page.click('.sec[data-where="item"][data-id="settings"]');
  await page.click('[data-act="ask"][data-k="ed-delartist"]'); await page.click('[data-act="ed-delartist"]'); await settle();
  assert.equal(await page.inputValue(".pagepick"), "artists"); assert.ok(!(await page.$$eval(".pagepick option", (o) => o.map((x) => x.value))).includes("artist-zen-xander"));
  await page.click('[data-act="ed-discard"]');
  // the Theme tile shows the site's own colours
  await page.click('[data-tab="overview"]'); await page.waitForSelector(".tile .swatches i"); assert.equal(await page.locator(".tile .swatches i").count(), 4);
  await page.screenshot({ path: shots + "overview.png" });
  // phone width holds
  await page.setViewportSize({ width: 390, height: 844 }); await settle();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 392), "no sideways scrolling on a phone");
  assert.deepEqual(errors, []);
  console.log("PAGE EDITING CHECKS PASSED");
} finally { await browser.close(); servers.forEach((s) => s.kill()); }
