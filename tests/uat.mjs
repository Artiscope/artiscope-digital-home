import { W_DIR, G_DIR, C_DIR, FIX, chromeOptions } from "./where.mjs";
// User acceptance run: the real console, signed in, talking to the real server code
// over an in-memory GitHub seeded from both sites, with the real sites as previews.
// Each case is recorded as passed or failed with a note; nothing stops the run.
import fs from "node:fs"; import path from "node:path"; import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
const OUT = "/tmp/uat/"; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT + "shots", { recursive: true });
const PORT = 8841, consoleAt = "http://localhost:" + PORT;
const WARDIR = (W_DIR + "/"), GAMDIR = (G_DIR + "/");

// ----- the two sites, built as visitors would get them, with the editor bridge pointed at this console -----
fs.rmSync("/tmp/uat-war", { recursive: true, force: true }); fs.rmSync("/tmp/uat-gam", { recursive: true, force: true });
execFileSync("python3", [WARDIR + "tools/build_site.py", "/tmp/uat-war"]);
fs.cpSync(WARDIR + "images", "/tmp/uat-war/images", { recursive: true });
fs.writeFileSync("/tmp/uat-war/index.html", fs.readFileSync("/tmp/uat-war/index.html", "utf8").split('"https://artiscope.github.io"').join('"' + consoleAt + '"'));
fs.cpSync(GAMDIR, "/tmp/uat-gam", { recursive: true, filter: (p) => !p.includes("/.git") });
execFileSync("node", ["/tmp/uat-gam/tools/build.mjs"]);
fs.writeFileSync("/tmp/uat-gam/assets/site.js", fs.readFileSync("/tmp/uat-gam/assets/site.js", "utf8").split('"https://artiscope.github.io"').join('"' + consoleAt + '"'));

// ----- the server, with GitHub in memory -----
let signedIn = "tester@artiscope.co.uk";
globalThis.Deno = { env: { get: (k) => ({ GITHUB_TOKEN: "t", ALLOWED_EMAILS: "tester@artiscope.co.uk", SUPABASE_URL: "https://s", SUPABASE_SERVICE_ROLE_KEY: "k" }[k] || "") }, serve() {} };
const { makePeople } = await import("./fakepeople.mjs"); const ppl = makePeople();
const { handle } = await import("./home.mjs");
const { makeGitHub } = await import("./fakegit.mjs");
const files = (dir, list) => Object.fromEntries(list.filter((f) => fs.existsSync(dir + f)).map((f) => [f, fs.readFileSync(dir + f, "utf8")]));
const pics = (dir, sub) => Object.fromEntries(fs.readdirSync(dir + sub).map((f) => [sub + "/" + f, "picture"]));
const WR = "Artiscope/World-art-review", GR = "Artiscope/global-art-monitor";
const hub = makeGitHub({
  [WR]: { ...files(WARDIR, ["content/site.json", "content/pages.json", "content/theme.json", "image-slots.json", "AGENT-LOG.md", "CONTENT-CALENDAR.md"]), ...pics(WARDIR, "images") },
  [GR]: { ...files(GAMDIR, ["data/content.json", "data/sales.json", "data/images.json", "data/pages.json", "data/theme.json", "image-slots.json", "AGENT-LOG.md", "CONTENT-CALENDAR.md"]), ...pics(GAMDIR, "assets/images") },
});
let breakGitHub = false;
globalThis.fetch = async (url, init = {}) => {
  if (String(url).includes("/auth/v1/user")) return new Response(JSON.stringify({ email: signedIn }));
  if (ppl.handles(url)) return ppl.fetch(url, init);
  if (breakGitHub && (init.method || "GET") !== "GET") return new Response(JSON.stringify({ message: "Server Error" }), { status: 500 });
  return hub.fetch(url, init);
};
const read = (repo, f) => { const t = hub.read(repo, "main", f); return t == null ? null : JSON.parse(t); };

// ----- the console, served as it is -----
const srv = spawn("python3", ["-m", "http.server", String(PORT), "-d", path.resolve(".")], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 900));
const SUPA = `window.supabase={createClient:function(){var session={access_token:"t",user:{email:"tester@artiscope.co.uk"}},cbs=[];return{
  auth:{getSession:async function(){setTimeout(function(){cbs.forEach(function(cb){cb("SIGNED_IN",session);});},0);return{data:{session:session}};},onAuthStateChange:function(cb){cbs.push(cb);},
    signOut:async function(){cbs.forEach(function(cb){cb("SIGNED_OUT",null);});},signInWithOtp:async function(){return{error:null};},signInWithPassword:async function(){return{error:null};}},
  functions:{invoke:async function(name,o){var r=await fetch("/__fn",{method:"POST",body:JSON.stringify(o.body)});if(r.status>=400)return{data:null,error:{context:r}};return{data:await r.json(),error:null};}}};}};`;
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", svg: "image/svg+xml", json: "application/json" };
function serveSite(root, route, url) {
  let p = decodeURIComponent(new URL(url).pathname).replace(/^\/preview\/[^/]+\//, "/");
  if (p.endsWith("/")) p += "index.html";
  const f = root + p;
  if (!fs.existsSync(f)) return route.fulfill({ status: 404, contentType: "text/html", body: fs.existsSync(root + "/404.html") ? fs.readFileSync(root + "/404.html") : "Not found" });
  return route.fulfill({ status: 200, contentType: MIME[f.split(".").pop()] || "application/octet-stream", body: fs.readFileSync(f) });
}

const results = [], notes = [];
let area = "";
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
async function check(name, fn) {
  if (ONLY && !ONLY.includes(area)) return;
  const t0 = Date.now();
  try { const extra = await fn(); results.push({ area, name, ok: true, note: typeof extra === "string" ? extra : "", ms: Date.now() - t0 }); }
  catch (e) { await page.screenshot({ path: OUT + "shots/fail-" + results.length + ".png" }).catch(() => {}); results.push({ area, name, ok: false, note: String(e && e.message || e).split("\n")[0].slice(0, 240), ms: Date.now() - t0 }); }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const browser = await chromium.launch(chromeOptions());
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(7000);
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.route("**/*", async (route) => {
  const url = route.request().url();
  if (url.startsWith(consoleAt + "/__fn")) {
    const res = await handle(new Request("https://x/functions/v1/home", { method: "POST", headers: { Authorization: "Bearer t" }, body: route.request().postData() }));
    return route.fulfill({ status: res.status, contentType: "application/json", body: await res.text() });
  }
  if (url.startsWith(consoleAt)) return route.continue();
  if (url.startsWith("https://cdn.jsdelivr.net/npm/@supabase")) return route.fulfill({ status: 200, contentType: "text/javascript", body: SUPA });
  if (url.startsWith("https://worldartreview.com/")) return serveSite("/tmp/uat-war", route, url);
  if (url.startsWith("https://globalartmonitor.com/")) return serveSite("/tmp/uat-gam", route, url);
  return route.abort();
});
const shot = (n) => page.screenshot({ path: OUT + "shots/" + n + ".png" });
const settle = (ms = 800) => page.waitForTimeout(ms);
const frame = (host) => page.frames().find((f) => f.url().startsWith("https://" + host));
const text = (sel) => page.innerText(sel);
const notice = async () => (await page.locator(".notice").allInnerTexts()).join(" | ");
async function liveSave() { await page.click('[data-act="ed-save"]'); await page.click('[data-act="livesave"]'); await page.waitForSelector("text=Saved", { timeout: 9000 }); await settle(900); }
async function openSite(id) { await page.click('[data-tab="home"]', { timeout: 1500 }).catch(() => {}); await shot("open-" + id); await page.evaluate((x) => { window.__adh.state.leave = null; }, id); await page.waitForSelector('[data-act="open-site"][data-site="' + id + '"]', { timeout: 20000 }); await page.click('[data-act="open-site"][data-site="' + id + '"]'); await page.waitForSelector("#ed-sections .sec", { timeout: 12000 }); await settle(1800); }

// =============== 1. Getting in ===============
area = "Getting in";
await page.goto(consoleAt + "/index.html");
await check("Signed-in console opens on All sites, with all five sites", async () => { await page.waitForSelector('[data-act="open-site"]', { timeout: 12000 }); const n = await page.locator('[data-act="open-site"]').count(); must(n === 5, n + " sites shown"); await shot("01-home"); });
await check("Version number is shown", async () => must((await text("body")).includes("Version 31"), "no version"));
await check("An unbuilt site opens to Not built yet", async () => { await page.click('[data-act="open-site"][data-site="site-3"]'); await settle(); must((await text("body")).toLowerCase().includes("not built yet"), "no message"); await page.click('[data-tab="home"]'); });
await check("Someone not on the list is turned away with a plain message", async () => {
  signedIn = "stranger@example.com"; await page.click('[data-act="refresh"]').catch(() => page.reload()); await settle(1500);
  const t = await text("body"); signedIn = "tester@artiscope.co.uk";
  must(/does not have access/i.test(t), "message was: " + t.slice(0, 120)); await page.reload(); await page.waitForSelector('[data-act="open-site"]');
});

// =============== 2. World Art Review: the page editor ===============
area = "Page editor, World Art Review";
await check("Opening a site goes straight to the page editor with the real page", async () => { await openSite("world-art-review"); must(!!frame("worldartreview.com"), "no preview"); await shot("02-editor"); });
await check("Menu has Overview, Pages, Theme, Files, History, and no Content or Photos", async () => { const t = await text(".ed .rail"); must(["Overview", "Pages", "Theme", "Files", "History"].every((w) => t.includes(w)) && !t.includes("Content") && !t.includes("Photos"), "menu: " + t); });
await check("Clicking a part of the page opens its settings", async () => { await frame("worldartreview.com").click("#numbers"); await page.waitForSelector(".ed-right h2:has-text('Numbers band')"); });
await check("Typing redraws the page before saving", async () => { await page.fill('[data-pf="eyebrow"]', "The review in numbers"); await settle(500); must((await frame("worldartreview.com").evaluate(() => document.querySelector("#numbers .eyebrow").textContent)) === "The review in numbers", "not redrawn"); });
await check("Save on the live site asks once, then saves to the live site", async () => { await page.click('[data-act="ed-save"]'); await page.waitForSelector("text=goes live in about two minutes"); await shot("03-live-question"); await page.click('[data-act="livesave"]'); await page.waitForSelector("text=Saved"); await settle(1200); must(JSON.stringify(read(WR, "content/pages.json")).includes("The review in numbers"), "not on main"); });
await check("Undo takes the save back on the live site, after one question", async () => { await page.click('[data-act="undo-step"]'); await page.click('[data-act="livesave"]'); await settle(2500); must(!JSON.stringify(read(WR, "content/pages.json")).includes("The review in numbers"), "still there"); });
await check("Redo puts it back", async () => { await page.click('[data-act="redo-step"]'); await page.click('[data-act="livesave"]'); await settle(2500); must(JSON.stringify(read(WR, "content/pages.json")).includes("The review in numbers"), "not back"); });
await check("Discard throws away unsaved typing", async () => { await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await page.fill('[data-pf="eyebrow"]', "Throw me away"); await settle(300); await page.click('[data-act="ed-discard"]'); await settle(400); must(!(await text(".ed-top")).includes("Edited"), "still edited"); });
await check("Leaving with unsaved changes asks first, and Keep editing keeps them", async () => {
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await page.fill('[data-pf="eyebrow"]', "Keep me"); await settle(300);
  await page.click('.navb[data-tab="history"]'); await page.waitForSelector("text=You have changes that are not saved yet"); await page.click('[data-act="leave-stay"]');
  must(await page.inputValue('[data-pf="eyebrow"]') === "Keep me", "lost"); await page.click('[data-act="ed-discard"]');
});
await check("Text that looks like code is shown as words, never run", async () => {
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await page.fill('[data-pf="eyebrow"]', '<img src=x onerror="window.__hacked=1"><script>window.__hacked=1</script>'); await settle(700);
  const hacked = await frame("worldartreview.com").evaluate(() => !!window.__hacked); must(!hacked, "the code ran in the preview"); await page.click('[data-act="ed-discard"]');
});
await check("A long dash typed in is saved as a comma", async () => {
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await page.fill('[data-pf="eyebrow"]', "Facts — checked"); await settle(300); await liveSave();
  const e = read(WR, "content/pages.json").pages.home.sections.find((x) => x.id === "numbers").settings.eyebrow; must(e === "Facts, checked", "saved as: " + e); return "Saved as: " + e;
});
await check("Hiding, moving and adding sections shows on the page at once", async () => {
  await page.click('#ed-sections .sec[data-id="method"]:not(.blk)'); await page.click('.ptools [data-act="ed-hide"]'); await settle(400);
  const ids = await frame("worldartreview.com").evaluate(() => [...document.querySelectorAll("#main > section")].map((s) => s.id)); must(!ids.includes("method"), "still shown");
  await page.click('.ptools [data-act="ed-hide"]'); await page.click('.addl[data-act="ed-secpicker"]'); await page.click('.pk-item[data-key="quote"]'); await settle(500);
  must(await frame("worldartreview.com").evaluate(() => !!document.querySelector('[id^="quote-"]')), "quote not added"); await page.click('[data-act="ed-discard"]');
});
await check("A page with more than 40 sections is refused with a plain reason", async () => {
  await page.evaluate(() => { const p = window.__adh.pgOf(); const s = p.doc.pages.home.sections; for (let i = 0; i < 40; i++) s.push({ id: "extra-" + i, type: "quote", visible: true, settings: { text: ["x"], who: "", bg: "paper", fg: "" } }); p.dirty = true; window.__adh.state.dirty = true; });
  await page.evaluate(() => window.__adh.render()); await settle(300);
  await page.click('[data-act="ed-save"]'); await page.click('[data-act="livesave"]'); await settle(1500);
  const n = await notice(); await page.click('[data-act="ed-discard"]').catch(() => {}); must(/up to 40/i.test(n), "notice: " + n);
});
await check("Uploading something that is not a photo is refused", async () => {
  fs.writeFileSync("/tmp/uat/not-a-photo.txt", "hello");
  await page.click('.addl[data-act="ed-secpicker"]'); await page.click('.pk-item[data-key="picture"]'); await page.waitForSelector('[data-upload="image"]', { state: "attached" });
  await page.setInputFiles('[data-upload="image"]', "/tmp/uat/not-a-photo.txt"); await settle(500); const n = await notice(); must(/JPG or PNG/i.test(n), "notice: " + n);
});
await check("A photo without a description cannot be saved", async () => {
  await page.setInputFiles('[data-upload="image"]', (FIX + "/studio.jpg")); await page.waitForSelector(".picthumb[src^='data:image']"); await page.fill('[data-pf="alt"]', "");
  await page.click('[data-act="ed-save"]'); await settle(500); const n = await notice(); must(/describe the picture/i.test(n), "notice: " + n);
});
await check("With a description, the photo and the page save together as one step", async () => {
  await page.fill('[data-pf="alt"]', "A brown test square"); await liveSave(); const names = Object.keys(hub.refs(WR)).length;
  must(hub.read(WR, "main", "images/studio.jpg") != null, "photo not saved"); must(/^Edit page: /.test(hub.lastMessage(WR, "main")), "message: " + hub.lastMessage(WR, "main"));
});
await check("A very large photo is made smaller before it is sent", async () => {
  const big = await page.evaluate(async () => { const c = document.createElement("canvas"); c.width = 5200; c.height = 3400; const x = c.getContext("2d"); x.fillStyle = "#884422"; x.fillRect(0, 0, 5200, 3400); return c.toDataURL("image/jpeg", .9).split(",")[1]; });
  fs.writeFileSync("/tmp/uat/big.jpg", Buffer.from(big, "base64"));
  await page.click('.addl[data-act="ed-secpicker"]'); await page.click('.pk-item[data-key="picture"]'); await page.waitForSelector('[data-upload="image"]', { state: "attached" });
  await page.setInputFiles('[data-upload="image"]', "/tmp/uat/big.jpg"); await page.waitForSelector(".picthumb[src^='data:image']");
  const dims = await page.evaluate(() => new Promise((r) => { const p = window.__adh.pgOf(), k = Object.keys(p.uploads).pop(), i = new Image(); i.onload = () => r([i.width, i.height]); i.src = p.uploads[k].dataUrl; }));
  await page.click('[data-act="ed-discard"]'); must(Math.max(...dims) <= 2000, "sent at " + dims.join("x")); return "Sent at " + dims.join(" by ") + " pixels";
});
await check("A link in the page goes to that page; Alt with a click picks it", async () => {
  await frame("worldartreview.com").evaluate(() => [...document.querySelectorAll("header.hdr nav.left a")].find((a) => a.textContent.includes("Reviews")).click()); await settle(1200);
  must(await page.inputValue(".pagepick") === "reviews", "picker shows " + await page.inputValue(".pagepick"));
});
await check("A shared picture can be changed from the home page and says where else it shows", async () => {
  await page.selectOption(".pagepick", "home"); await settle(1200); await page.click('#ed-sections .sec[data-id="featured"]:not(.blk)'); await page.waitForSelector(".sec.pic");
  await page.click('.sec.pic >> nth=0'); await page.waitForSelector(".shared-note"); must((await text(".shared-note")).includes("also shows on"), "no note");
});

// =============== 3. Articles, portfolios and sources ===============
area = "Articles, portfolios, sources";
await check("New article without a title is refused", async () => { await page.click('[data-act="ed-new"]'); await page.click('[data-act="ed-new"][data-what="article"]'); await page.click('form[data-form="ednew"] button[type=submit]'); await settle(300); must(/title/i.test(await notice()), "notice: " + await notice()); });
await check("New article with an existing title gets its own web address", async () => {
  await page.fill("#nw-title", "Understanding palette-knife painting"); await page.click('form[data-form="ednew"] button[type=submit]'); await settle(1200);
  must(await page.inputValue(".pagepick") === "a-understanding-palette-knife-painting", "address: " + await page.inputValue(".pagepick"));
});
await check("A new article starts hidden and is not listed for visitors", async () => {
  await page.click('.sec[data-where="item"][data-id="settings"]'); must(await page.inputValue('[data-pf="hidden"]') === "true", "not hidden");
});
await check("Saving the new article keeps it hidden on the live site", async () => { await liveSave(); const a = read(WR, "content/site.json").articles.find((x) => x.slug === "understanding-palette-knife-painting"); must(a && a.hidden === true, "saved as " + JSON.stringify(a && a.hidden)); });
await check("Deleting an article asks first, and Undo brings it back", async () => {
  await page.selectOption(".pagepick", "a-understanding-palette-knife-painting"); await settle(1000); await page.click('.sec[data-where="item"][data-id="settings"]');
  await page.click('[data-act="ask"][data-k="ed-delart"]'); await page.click('[data-act="ed-delart"]'); await liveSave();
  must(!read(WR, "content/site.json").articles.some((x) => x.slug === "understanding-palette-knife-painting"), "not deleted");
  await page.click('[data-act="undo-step"]'); await page.click('[data-act="livesave"]'); await settle(2500); must(read(WR, "content/site.json").articles.some((x) => x.slug === "understanding-palette-knife-painting"), "not back");
});
await check("A new source with a link that is not https is refused", async () => {
  await page.click('[data-act="ed-new"]'); await page.click('[data-act="ed-new"][data-what="source"]'); await page.fill("#nw-title", "A source"); await page.fill("#nw-url", "javascript:alert(1)");
  await page.click('form[data-form="ednew"] button[type=submit]'); await settle(300); must(/https/i.test(await notice()), "notice: " + await notice()); await page.click('[data-act="ed-panel-close"]');
});
await check("Citing a source before clicking in the text explains what to do", async () => {
  await page.selectOption(".pagepick", "a-palette-knife-painting"); await settle(1000); await page.click('.sec[data-where="item"][data-id="body"]'); await page.waitForSelector(".rt-cite");
  await page.evaluate(() => { window.getSelection().removeAllRanges(); }); await page.selectOption(".rt-cite", "ap-muse"); await settle(300);
  const n = await notice(); const body = await page.evaluate(() => window.__adh.pgOf().site.articles.find((a) => a.slug === "palette-knife-painting").body);
  return /Click in the text/i.test(n) ? "Explained" : body.includes('data-src="ap-muse"') ? "Inserted where the cursor last was in this text (acceptable)" : (() => { throw new Error("nothing happened, notice: " + n); })();
});
await check("A source that is still cited cannot be deleted, and says why", async () => {
  await page.click('[data-act="ed-discard"]', { timeout: 1500 }).catch(() => {}); await page.click('.sec[data-where="item"][data-id="sources"]'); await page.click('.picklist [data-op="edit"] >> nth=0'); await page.waitForSelector(".ed-right h2:has-text('Source')");
  must((await text(".ed-right")).includes("cannot be deleted"), "no reason");
});
await check("An artist named in articles cannot be deleted, and says which", async () => {
  await page.selectOption(".pagepick", "artist-konn-artiss"); await settle(1000); await page.click('.sec[data-where="item"][data-id="settings"]'); must((await text(".ed-right")).includes("is named in"), "no reason");
});
await check("An artwork with no size uses none and is saved that way", async () => {
  await page.click('.sec[data-where="item"][data-id="works"]'); await page.click('.sec.blk[data-id="works"] >> nth=0'); await page.fill('[data-pf="works.0.size"]', "none"); await liveSave();
  const w = read(WR, "content/site.json").artists.find((a) => a.slug === "konn-artiss").works[0]; must(w.size === false, "saved as " + JSON.stringify(w.size));
});
await check("An unpublished portfolio shows in the preview for editing", async () => { await page.selectOption(".pagepick", "artist-zen-xander"); await settle(1200); must((await frame("worldartreview.com").evaluate(() => (document.querySelector(".phead h1") || {}).textContent || "")).includes("Zen Xander"), "not drawn"); });
await check("Editorial standards is editable but cannot be deleted", async () => { await page.selectOption(".pagepick", "page-standards"); await settle(1000); await page.click('.sec[data-where="pageinfo"]'); must((await text(".ed-right")).includes("site's own pages"), "can be deleted"); });

// =============== 4. Trial copies ===============
area = "Trial copies";
if (ONLY && ONLY.includes(area)) await openSite("world-art-review");
await check("A trial copy needs a name", async () => { await page.click('.ed-top [data-tab="overview"]'); await page.waitForSelector("#copy-name"); await page.fill("#copy-name", ""); await page.click('form[data-form="copy"] button[type=submit]'); await settle(500); must(/name/i.test(await notice()), "notice: " + await notice()); });
await check("Making a trial copy switches to it", async () => { await page.fill("#copy-name", "Spring look"); await page.click('form[data-form="copy"] button[type=submit]'); await page.waitForSelector("text=You are working on this", { timeout: 9000 }); await settle(800); must((await text("body")).includes("Spring look"), "no copy"); await shot("04-copies"); });
await check("Saving on a trial copy does not ask and does not touch the live site", async () => {
  await page.click('[data-tab="pages"]'); await page.waitForSelector("#ed-sections .sec", { timeout: 9000 }); await settle(1500);
  await page.selectOption(".pagepick", "home"); await settle(1200);
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await page.fill('[data-pf="eyebrow"]', "Spring numbers"); await settle(300); await page.click('[data-act="ed-save"]');
  await page.waitForSelector("text=Saved on this copy", { timeout: 9000 }); must(!JSON.stringify(read(WR, "content/pages.json")).includes("Spring numbers"), "reached live");
});
await check("A second copy is allowed, a third is not", async () => {
  await page.click('.ed-top [data-tab="overview"]'); await page.fill("#copy-name", "Summer look"); await page.click('form[data-form="copy"] button[type=submit]'); await settle(2500);
  must((await text("body")).includes("Two trial copies"), "a third could be made");
});
await check("Make live puts the copy's changes on the live site", async () => {
  await page.click('[data-act="work-on"] >> nth=1').catch(() => {}); await settle(1000);
  const btn = page.locator('[data-act="ask-big"][data-kind="makelive"]').first(); await btn.click(); await page.click('[data-act="makelive"]'); await settle(3000);
  must(JSON.stringify(read(WR, "content/pages.json")).includes("Spring numbers"), "not live");
});
await check("Deleting a trial copy asks first", async () => {
  const del = page.locator('[data-act="ask-big"][data-kind="deletecopy"]').first(); await del.click(); await page.waitForSelector("text=Delete the copy"); await page.click('[data-act="deletecopy"]'); await settle(2500);
});

// =============== 5. Files ===============
area = "Files";
await check("Files lists every photo with where it is used", async () => { await page.click('.navb[data-tab="files"]'); await page.waitForSelector(".filecard", { timeout: 9000 }); const n = await page.locator(".filecard").count(); must(n >= 2, n + " photos"); await shot("05-files"); });
await check("Photos cannot be added until each has a description", async () => { await page.setInputFiles('[data-change="files-add"]', [(FIX + "/studio.jpg")]); await page.waitForSelector(".addrow"); must(await page.isDisabled('[data-act="files-send"]'), "button enabled"); await page.click('[data-act="fadd-drop"]'); });
await check("A photo in use cannot be deleted", async () => { const t = await page.locator(".filecard").first().innerText(); must(t.includes("cannot be deleted") || !t.includes("Used in"), "deletable while used"); });
await check("Replacing a JPG with a PNG is refused with a reason", async () => {
  const png = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 40; c.height = 40; return c.toDataURL("image/png").split(",")[1]; }); fs.writeFileSync("/tmp/uat/small.png", Buffer.from(png, "base64"));
  const jpgCard = page.locator(".filecard", { hasText: ".jpg" }).first(); await jpgCard.locator('[data-change="files-replace"]').setInputFiles("/tmp/uat/small.png"); await settle(400);
  if (await page.isVisible('[data-act="livesave"]')) { await page.click('[data-act="livesave"]'); await settle(1500); }
  const n = await notice(); return /JPG/i.test(n) ? "Refused: " + n : "Turned into a JPG and replaced (the console converts it), notice: " + (n || "none");
});
await check("A place with no picture can be filled, but needs a description", async () => {
  await page.click('[data-act="files-filter"][data-f="empty"]'); await page.waitForSelector(".spot"); await page.click('.spot [data-act="files-assign"] >> nth=0'); await page.click('[data-act="files-pick"] >> nth=0');
  await page.fill("#fa-alt", ""); await page.click('form[data-form="fassign"] button[type=submit]'); await settle(400); must(/describe/i.test(await notice()), "notice: " + await notice());
});

// =============== 6. Theme ===============
area = "Theme";
if (ONLY && ONLY.includes(area)) await openSite("world-art-review");
await check("Theme tile shows the site's colours", async () => { await page.click('.navb[data-tab="overview"]'); await page.waitForSelector(".tile .swatches i"); });
await check("A colour that is hard to read is flagged", async () => {
  await page.click('.navb[data-tab="theme"]'); await page.waitForSelector("[data-theme-hex]", { timeout: 9000 }); const hex = page.locator("[data-theme-hex]").nth(3); await hex.fill("#EEE5D4"); await settle(400);
  must(/hard to read/i.test(await text("body")), "no warning"); await shot("06-theme");
});
await check("A colour code that is not real is ignored", async () => { const hex = page.locator("[data-theme-hex]").nth(0); await hex.fill("#ZZZ"); await settle(300); await page.click('[data-act="theme-discard"]').catch(() => {}); });

// =============== 6b. Sections, blocks and the pickers ===============
area = "Blocks and pickers";
const heroOf = () => read(WR, "content/pages.json").pages.home.sections.find((x) => x.type === "hero").settings;
await check("The opening banner opens to show its blocks, by kind", async () => {
  await page.evaluate(() => { const a = window.__adh; a.state.dirty = false; a.state.leave = null; a.state.place["world-art-review"] = "pages"; a.go("home"); }); await settle(600);
  await openSite("world-art-review"); await page.click('#ed-sections .sec[data-id="hero"]:not(.blk)'); await settle(500);
  const kinds = await page.$$eval('.sec.blk[data-id="hero"][data-bf]', (xs) => [...new Set(xs.map((x) => x.dataset.bf))].join(","));
  must(kinds === "headline,picture,tagline,latest,rule", "kinds: " + kinds); await shot("10-banner-blocks");
});
await check("The block picker offers only the banner's own blocks, one-only ones shown as already added", async () => {
  await page.click('.ed-right [data-act="ed-blockpicker"]'); await page.waitForSelector(".pk-item");
  const got = await page.$$eval(".pk-item", (xs) => xs.map((x) => x.dataset.key + (x.disabled ? "(added)" : "")).join(","));
  must(got === "headline,picture(added),tagline,latest,rule(added)", got); await shot("11-block-picker");
});
await check("A new headline line shows on the page as it is typed, and saves", async () => {
  await page.click('.pk-item[data-key="headline"]'); await settle(500);
  const n = heroOf().headline.length; await page.fill(`[data-pf="headline.${n}.t"]`, "Together."); await settle(700);
  must((await frame("worldartreview.com").textContent("#heroTitle")).includes("Together."), "not on the page");
  await liveSave(); must(heroOf().headline.some((x) => x.t === "Together."), "not saved");
});
await check("Clicking a line on the page picks that exact block", async () => {
  await frame("worldartreview.com").$eval('#heroTag [data-adh-b="tagline.1"] span', (el) => el.click()); await settle(600);
  must((await text(".ed-right h2")).trim() === "Art.", "picked: " + (await text(".ed-right h2")));
});
await check("Hiding the rule box and one Latest piece saves them hidden, and the page drops them", async () => {
  await page.click('.sec.blk[data-id="hero"][data-bf="rule"]'); await page.click('.ptools [data-act="ed-hide"]'); await settle(300);
  await page.click('.sec.blk[data-id="hero"][data-bf="latest"][data-block="1"]'); await page.click('.ptools [data-act="ed-hide"]'); await settle(700);
  const f = frame("worldartreview.com"); must((await f.$$(".glass.srcs")).length === 0, "rule box still shown"); must(!(await f.$$eval("#latest .slide", (x) => x.map((e) => e.dataset.adhB).join(","))).includes("latest.1"), "piece still shown");
  await liveSave(); const h = heroOf(); must(h.hide_rule === true, "rule not saved hidden"); must(h.latest[1] && h.latest[1].hidden === true && typeof h.latest[1].v === "string", "piece saved as " + JSON.stringify(h.latest[1]));
});
await check("Showing them again puts them back as they were", async () => {
  await page.click('.sec.blk[data-id="hero"][data-bf="rule"]'); await page.click('.ptools [data-act="ed-hide"]'); await settle(300);
  await page.click('.sec.blk[data-id="hero"][data-bf="latest"][data-block="1"]'); await page.click('.ptools [data-act="ed-hide"]'); await settle(300);
  await liveSave(); const h = heroOf(); must(!h.hide_rule && typeof h.latest[1] === "string", "still hidden: " + JSON.stringify(h.latest[1]));
});
await check("Add a section at the + line between two sections, found by searching", async () => {
  await page.click("#ed-sections > .ins >> nth=2"); await page.waitForSelector(".pk-item");
  await page.fill("[data-pick-q]", "photo"); await settle(200);
  const hits = await page.$$eval(".pk-item:not([hidden])", (xs) => xs.map((x) => x.dataset.key).join(","));
  must(hits === "text-picture,picture,gallery", "search found " + hits);
  await page.fill("[data-pick-q]", "quote"); await settle(200); await page.click('.pk-item[data-key="quote"]'); await settle(800);
  const ids = await page.$$eval("#ed-sections .sec:not(.blk)", (xs) => xs.map((x) => x.dataset.id));
  must(ids[2] && ids[2].indexOf("quote") === 0, "placed at " + ids.indexOf(ids.find((x) => x.indexOf("quote") === 0)) + ": " + ids.join(","));
  await page.click('.ptools [data-act="ask"]'); await page.click('.ptools [data-act="ed-remove"]'); await settle(300); await page.click('[data-act="ed-discard"]').catch(() => {}); await settle(500);
});
await check("A search with no match says so", async () => {
  await page.click('.addl[data-act="ed-secpicker"]'); await page.fill("[data-pick-q]", "zzzz"); await settle(200);
  must(await page.isVisible(".pk-none"), "no message"); await page.click('.pk [data-act="ed-pick-close"]'); await settle(200); must(!(await page.isVisible(".pk")), "picker still open");
});
await check("A logo goes into the menu bar, on the right, and saves with its picture and name", async () => {
  await page.click('.sec[data-where="shared"][data-id="header"]:not(.blk)'); await page.click('.ed-right [data-act="ed-blockpicker"]'); await page.waitForSelector('.pk-item[data-key="logos"]');
  await page.click('.pk-item[data-key="logos"]'); await settle(400);
  if (!fs.existsSync("/tmp/uat/small.png")) { const png = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 40; c.height = 40; return c.toDataURL("image/png").split(",")[1]; }); fs.writeFileSync("/tmp/uat/small.png", Buffer.from(png, "base64")); }
  await page.setInputFiles('[data-upload="logos.0.image"]', "/tmp/uat/small.png"); await settle(600);
  await page.fill('[data-pf="logos.0.alt"]', "Grove Gallery"); await page.click('.segr:has-text("Right")'); await settle(700);
  must((await frame("worldartreview.com").$$('header.hdr .right [data-adh-b="logos.0"] img')).length === 1, "not on the right of the bar"); await shot("12-logo");
  await liveSave(); const g = read(WR, "content/pages.json").shared.header.settings.logos[0];
  must(g && g.alt === "Grove Gallery" && g.place === "R" && g.size === "M" && /\.png$/.test(g.image), "saved " + JSON.stringify(g));
});
await check("A logo with no name is stopped before saving", async () => {
  await page.click('.sec[data-where="shared"][data-id="header"]:not(.blk)'); await page.click('.ed-right [data-act="ed-blockpicker"]'); await page.click('.pk-item[data-key="logos"]'); await settle(300);
  await page.click('[data-act="ed-picker"][data-path="logos.1.image"]'); await page.click('[data-act="ed-pic-choose"] >> nth=0'); await settle(300);
  await page.click('[data-act="ed-save"]'); await settle(500); const n = await notice(); must(/give the logo in the menu bar a name/i.test(n), "notice: " + n);
  await page.click('.ptools [data-act="ask"]'); await page.click('.ptools [data-act="ed-remove"]'); await settle(300); await page.click('[data-act="ed-discard"]').catch(() => {}); await settle(400);
});
await check("Global Art Monitor's menu bar takes logos too", async () => {
  await openSite("global-art-monitor"); await page.click('.sec[data-where="shared"][data-id="header"]:not(.blk)'); await page.click('.ed-right [data-act="ed-blockpicker"]'); await page.click('.pk-item[data-key="logos"]'); await settle(300);
  await page.fill('[data-pf="logos.0.alt"]', "Grove Gallery"); await page.click('.segr:has-text("Centre")'); await settle(900);
  must((await frame("globalartmonitor.com").$$('header.site-head .head-mid [data-adh-b="logos.0"]')).length === 1, "not in the middle of the bar");
  await liveSave(); const g = read(GR, "data/pages.json").shared.header.settings.logos[0]; must(g && g.place === "C" && g.alt === "Grove Gallery", "saved " + JSON.stringify(g));
  await page.click('.sec.blk[data-id="header"][data-bf="logos"]'); await page.click('.ptools [data-act="ask"]'); await page.click('.ptools [data-act="ed-remove"]'); await settle(300); await liveSave();
});

// =============== 6b. Tools on each row, and any section on any page ===============
area = "Tools and any section";
const panelH2 = async () => (await text(".ed-right h2")).trim();
await check("The eye on a row hides a section without leaving the one being changed", async () => {
  await openSite("world-art-review"); await page.selectOption(".pagepick", "home"); await settle(1200);
  await page.click('#ed-sections .sec[data-id="hero"]:not(.blk)'); await settle(300);
  await page.hover('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk) [data-act="ed-row-hide"]'); await settle(700);
  must((await panelH2()) === "Opening banner", "panel moved to " + (await panelH2()));
  must(!(await frame("worldartreview.com").$("#numbers")), "still on the page");
  must(await page.isVisible('#ed-sections .sec[data-id="numbers"]:not(.blk) .rb.is-off'), "the hidden row does not keep its eye showing"); await shot("13-row-eye");
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk) [data-act="ed-row-hide"]'); await settle(600); must(!!(await frame("worldartreview.com").$("#numbers")), "not back");
  await page.click('[data-act="ed-discard"]').catch(() => {}); await settle(400);
});
await check("The bin asks once, and Keep it keeps the section", async () => {
  await page.hover('#ed-sections .sec[data-id="method"]:not(.blk)'); await page.click('#ed-sections .sec[data-id="method"]:not(.blk) [data-act="ed-row-del"]'); await settle(400);
  must(/Remove this section\?/.test(await text(".ptools.ask")), "no question asked"); await shot("14-row-bin");
  await page.click('.ptools [data-act="cancel"]'); await settle(300); must(await page.isVisible('#ed-sections .sec[data-id="method"]'), "gone without a yes");
  await page.click('#ed-sections .sec[data-id="method"]:not(.blk) [data-act="ed-row-del"]'); await page.click('.ptools [data-act="ed-remove"]'); await settle(500);
  must(!(await page.$('#ed-sections .sec[data-id="method"]')), "still listed"); must(!(await frame("worldartreview.com").$("#method")), "still on the page");
  await page.click('[data-act="ed-discard"]').catch(() => {}); await settle(500); must(!!(await page.$('#ed-sections .sec[data-id="method"]')), "discard did not bring it back");
});
await check("No bin on the menu bar, footer, opening screen or the banner's one-only blocks, but they can be hidden", async () => {
  const bins = await page.$$eval('.sec[data-where="shared"] [data-act="ed-row-del"]', (x) => x.length); must(bins === 0, bins + " bins on shared rows");
  must((await page.$$('.sec[data-where="shared"] [data-act="ed-row-hide"]')).length >= 3, "shared rows cannot be hidden");
  await page.click('#ed-sections .sec[data-id="hero"]:not(.blk)'); await settle(300);
  must(!(await page.$('.sec.blk[data-id="hero"][data-bf="rule"] [data-act="ed-row-del"]')), "the rule box has a bin");
  must(!!(await page.$('.sec.blk[data-id="hero"][data-bf="rule"] [data-act="ed-row-hide"]')), "the rule box has no eye");
  await page.click('.sec[data-where="shared"][data-id="header"]:not(.blk)'); await settle(300);
  const tools = await page.$$eval(".ptools [data-act]", (x) => x.map((e) => e.dataset.act).join(",")); must(tools === "ed-hide", "menu bar tools: " + tools);
});
await check("The panel's own tools: eye, copy, move and bin", async () => {
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await settle(300);
  const tools = await page.$$eval(".ptools [data-act]", (x) => x.map((e) => e.dataset.act).join(",")); must(tools === "ed-hide,ed-dup,ed-move,ed-move,ask", tools);
  must(!(await page.$("#ed-float")), "the floating bar is still over the page");
});
await check("A new page takes the opening banner, which replaces the menu bar there, and two Featured artists", async () => {
  await page.click('[data-act="ed-new"]'); await page.click('[data-act="ed-new"][data-what="page"]'); await page.fill("#nw-title", "Exhibition"); await page.click('form[data-form="ednew"] button[type=submit]'); await settle(1200);
  const groups = await (await page.click('.addl[data-act="ed-secpicker"]'), page.$$eval(".pk-gl", (x) => x.map((e) => e.textContent).join("|")));
  must(groups === "Top of the page|Words|Pictures|Art and artists|Reading and trust|Contact and sign-up", groups);
  must((await page.$$(".pk-item[disabled]")).length === 0, "something is greyed out");
  await page.click('#ed-pick [data-act="ed-pick-close"] >> nth=-1'); await settle(200);
  await page.click("#ed-sections > .ins >> nth=0"); await page.click('.pk-item[data-key="hero"]'); await settle(400);
  for (let i = 0; i < 2; i++) { await page.click('.addl[data-act="ed-secpicker"]'); await page.click('.pk-item[data-key="featured"]'); await settle(400); }
  await settle(1500); const f = frame("worldartreview.com");
  must((await f.$$eval("header.hdr", (x) => x.length + ":" + x.filter((e) => e.closest(".hero")).length)) === "1:1", "the menu bar is drawn twice, or not inside the banner");
  must((await f.$$("[data-latest]")).length === 1 && (await f.$$(".feat, [id^=featured]")).length >= 2, "copies not drawn"); await shot("15-new-page-banner");
  await liveSave(); const pg = read(WR, "content/pages.json").pages.exhibition;
  must(pg && pg.sections.map((x) => x.type).join(",") === "hero,featured,featured,text", "saved " + (pg && pg.sections.map((x) => x.type)));
  must(JSON.stringify(pg.sections[0].settings.headline) === JSON.stringify(heroOf().headline), "the copy did not start with the home banner's words");
});
await check("Global Art Monitor: two results tables and a contact form on a new page, each with its own names", async () => {
  await openSite("global-art-monitor");
  await page.click('[data-act="ed-new"]'); await page.click('[data-act="ed-new"][data-what="page"]'); await page.fill("#nw-title", "Market desk"); await page.click('form[data-form="ednew"] button[type=submit]'); await settle(1200);
  for (const k of ["results-table", "results-table", "contact-form"]) { await page.click('.addl[data-act="ed-secpicker"]'); await page.click('.pk-item[data-key="' + k + '"]'); await settle(400); }
  await settle(1500); const f = frame("globalartmonitor.com");
  const r = await f.evaluate(() => { const g = [...document.querySelectorAll("[data-filter-group]")], t = g.map((x) => document.getElementById(x.getAttribute("data-filter-group")));
    const own = g.every((x, i) => t[i] && x.closest("section") === t[i].closest("section") && document.getElementById(t[i].id + "-empty"));
    const labels = [...document.querySelectorAll('form[id$="contact-form"] label[for]')].every((l) => { const i = document.getElementById(l.getAttribute("for")); return i && i.closest("form") === l.closest("form"); });
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id); return { n: g.length, own, labels, dup: ids.filter((x, i) => ids.indexOf(x) !== i) }; });
  must(r.n >= 2 && r.own && r.labels, "copies not wired to their own table and form " + JSON.stringify(r)); must(r.dup.length === 0, "names used twice: " + r.dup.join(","));
  await liveSave(); const pg = read(GR, "data/pages.json").pages["market-desk"];
  must(pg && pg.path === "market-desk/index.html" && pg.sections.map((x) => x.type).join(",") === "page-head,results-table,results-table,contact-form", "saved " + JSON.stringify(pg && pg.sections.map((x) => x.type)));
});

// =============== 6c. New sections, batch 1 ===============
area = "New sections: batch 1";
const newPage = async (title) => { await page.click('[data-act="ed-new"]'); await page.click('[data-act="ed-new"][data-what="page"]'); await page.fill("#nw-title", title); await page.click('form[data-form="ednew"] button[type=submit]'); await settle(1200); };
const addSec = async (key, at) => { await page.click(at == null ? '.addl[data-act="ed-secpicker"]' : "#ed-sections > .ins >> nth=" + at); await page.click('.pk-item[data-key="' + key + '"]'); await settle(400); };
await check("An announcement bar with two messages sits above the menu bar, and each message is its own block", async () => {
  await openSite("world-art-review"); await newPage("Notices"); await addSec("announcement", 0);
  await page.click('.sec.blk[data-bf="messages"][data-block="0"]'); await page.fill('[data-pf="messages.0.text"]', "Two new sources added."); await page.fill('[data-pf="messages.0.link"]', "Read it"); await page.fill('[data-pf="messages.0.href"]', "#artists");
  await page.click('.addl.blk[data-act="ed-blockpicker"]'); await settle(300); await page.fill('[data-pf="messages.1.text"]', "A second message."); await settle(800);
  must((await text('.sec.blk[data-bf="messages"][data-block="1"]')).includes("A second message."), "the block row is not named by its message");
  const f = frame("worldartreview.com"); const r = await f.evaluate(() => { const a = document.querySelector("[data-ann]"); return [a.querySelectorAll(".msg").length, a.compareDocumentPosition(document.querySelector("header.hdr")) & 4 ? "above" : "below"]; });
  must(r[0] === 2 && r[1] === "above", JSON.stringify(r)); await shot("16-announcement");
  await liveSave(); const sec = read(WR, "content/pages.json").pages.notices.sections[0];
  must(sec.type === "announcement" && sec.settings.messages.length === 2 && sec.settings.messages[0].href === "#artists", "saved " + JSON.stringify(sec.settings.messages));
});
await check("Columns: hiding one with its eye takes it off the page, and it saves hidden", async () => {
  await addSec("columns"); await settle(500); const id = (await page.$$eval("#ed-sections .sec:not(.blk)", (x) => x.map((e) => e.dataset.id))).find((x) => x.indexOf("columns") === 0);
  const f = frame("worldartreview.com"); must((await f.$$eval("#" + id + " .col", (x) => x.length)) === 3, "three columns not drawn");
  await page.hover('.sec.blk[data-id="' + id + '"][data-block="1"]'); await page.click('.sec.blk[data-id="' + id + '"][data-block="1"] [data-act="ed-row-hide"]'); await settle(600);
  must((await f.$$eval("#" + id + " .col", (x) => x.length)) === 2, "hidden column still drawn");
  await liveSave(); const c = read(WR, "content/pages.json").pages.notices.sections.find((x) => x.id === id).settings.columns; must(c[1].hidden === true && !c[0].hidden, "saved " + JSON.stringify(c));
});
await check("Space: Large saves, and draws as empty room", async () => {
  await addSec("space"); await page.click('.segr:has-text("Large")'); await settle(500);
  const id = (await page.$$eval("#ed-sections .sec:not(.blk)", (x) => x.map((e) => e.dataset.id))).find((x) => x.indexOf("space") === 0);
  must(await frame("worldartreview.com").$eval("#" + id, (e) => e.classList.contains("l") && e.offsetHeight > 60 && !e.textContent.trim()), "not drawn as a large space");
  await liveSave(); must(read(WR, "content/pages.json").pages.notices.sections.find((x) => x.id === id).settings.size === "L", "size not saved");
});
await check("Global Art Monitor: columns, quote, questions and a button on a new page, in its own look", async () => {
  await openSite("global-art-monitor"); await newPage("Desk two");
  for (const k of ["columns", "quote", "faq", "button"]) await addSec(k);
  await settle(1200); const f = frame("globalartmonitor.com");
  const r = await f.evaluate(() => ({ cards: document.querySelectorAll(".col-card").length, quote: !!document.querySelector(".big-quote"), qa: document.querySelectorAll("details.qa").length, pill: !!document.querySelector(".cta-panel .pill-mint") }));
  must(r.cards === 3 && r.quote && r.qa === 1 && r.pill, JSON.stringify(r)); await shot("17-gam-batch1");
});
await check("A button with an unsafe address is not drawn, and the address is not saved", async () => {
  const id = (await page.$$eval("#ed-sections .sec:not(.blk)", (x) => x.map((e) => e.dataset.id))).find((x) => x.indexOf("button") === 0);
  await page.click('#ed-sections .sec[data-id="' + id + '"]'); await page.fill('[data-pf="href"]', "javascript:alert(1)"); await settle(500);
  await liveSave(); const b = read(GR, "data/pages.json").pages["desk-two"].sections.find((x) => x.id === id).settings;
  must(b.href === "", "saved " + b.href); must(!(await frame("globalartmonitor.com").$(".cta-panel .pill")), "button still drawn");
  const types = read(GR, "data/pages.json").pages["desk-two"].sections.map((x) => x.type).join(","); must(types === "page-head,columns,quote,faq,button", types);
});

// =============== 6d. New sections, batch 2 ===============
area = "New sections: batch 2";
const secIdOf = async (t) => (await page.$$eval("#ed-sections .sec:not(.blk)", (x) => x.map((e) => e.dataset.id))).find((x) => x.indexOf(t) === 0);
for (const [f, t] of [["tall.jpg", "gal-tall.jpg"], ["wide.jpg", "gal-wide.jpg"], ["logo.png", "row-logo.png"]]) fs.copyFileSync(FIX + "/" + f, "/tmp/uat/" + t);
await check("A gallery photo without a description stops the save, and opens that photo to describe", async () => {
  await openSite("world-art-review"); await newPage("Pictures"); await addSec("gallery"); const gl = await secIdOf("gallery");
  await page.click('.sec.blk[data-id="' + gl + '"][data-block="1"]'); await page.setInputFiles('[data-upload="photos.1.image"]', "/tmp/uat/gal-tall.jpg"); await page.waitForSelector(".picthumb[src^='data:image']");
  await page.click('.sec.blk[data-id="' + gl + '"][data-block="0"]'); await settle(200);
  await page.click('[data-act="ed-save"]'); await settle(500); const n = await notice(); must(/describe the picture in Gallery/i.test(n), "notice: " + n);
  must((await text(".ed-right h2")).trim() === "Photo 2", "picked: " + (await text(".ed-right h2")));
});
await check("With its description the photo saves into the site's pictures, and shows in the gallery", async () => {
  await page.fill('[data-pf="photos.1.alt"]', "A tall test picture"); await page.fill('[data-pf="photos.1.caption"]', "Tall work"); await settle(500);
  must((await frame("worldartreview.com").$$eval(".gl-item img", (x) => x.length)) === 1, "not drawn in the gallery"); await shot("18-gallery");
  await liveSave(); must(hub.read(WR, "main", "images/gal-tall.jpg") != null, "photo not saved");
  const ph = read(WR, "content/pages.json").pages.pictures.sections.find((x) => x.type === "gallery").settings.photos[1]; must(ph.image === "gal-tall.jpg" && ph.alt === "A tall test picture", "saved " + JSON.stringify(ph));
});
await check("Slideshow: hiding a slide with its eye leaves two, and it saves hidden", async () => {
  await addSec("slideshow"); const ss = await secIdOf("slideshow"); const f = frame("worldartreview.com");
  must((await f.$$eval("#" + ss + " .ss-slide", (x) => x.length)) === 3, "three slides not drawn");
  await page.hover('.sec.blk[data-id="' + ss + '"][data-block="2"]'); await page.click('.sec.blk[data-id="' + ss + '"][data-block="2"] [data-act="ed-row-hide"]'); await settle(600);
  must((await f.$$eval("#" + ss + " .ss-slide", (x) => x.length)) === 2 && (await f.textContent("#" + ss + " .ss-at")) === "1 of 2", "hidden slide still counted");
  await liveSave(); must(read(WR, "content/pages.json").pages.pictures.sections.find((x) => x.id === ss).settings.slides[2].hidden === true, "not saved hidden");
});
await check("Picking a later slide in the list brings it into view on the page", async () => {
  const ss = await secIdOf("slideshow"); await page.click('.sec.blk[data-id="' + ss + '"][data-block="1"]'); await settle(700);
  must(await frame("worldartreview.com").$eval("#" + ss, (e) => e.querySelectorAll(".ss-slide")[1].classList.contains("on")), "second slide not shown");
});
await check("Global Art Monitor: a picture banner with an uploaded picture, and a logo row with a link, save together", async () => {
  await openSite("global-art-monitor"); await newPage("Partners"); await addSec("picture-banner"); await addSec("logo-row");
  const pb = await secIdOf("picture-banner"), lr = await secIdOf("logo-row");
  await page.click('#ed-sections .sec[data-id="' + pb + '"]:not(.blk)'); await page.setInputFiles('[data-upload="image"]', "/tmp/uat/gal-wide.jpg"); await page.waitForSelector(".picthumb[src^='data:image']");
  await page.fill('[data-pf="alt"]', "A wide test picture"); await page.fill('[data-pf="heading"]', "Every documented sale.");
  await page.click('#ed-sections .sec[data-id="' + lr + '"]:not(.blk)'); await page.click('.sec.blk[data-id="' + lr + '"][data-block="0"]');
  await page.fill('[data-pf="logos.0.alt"]', "Test partner"); await page.fill('[data-pf="logos.0.href"]', "https://example.org"); await settle(800);
  const f = frame("globalartmonitor.com"); must(!!(await f.$(".pbanner .pb-pic img")) && !!(await f.$('a.lg[href="https://example.org"]')), "not drawn"); await shot("19-gam-banner");
  await liveSave(); const secs = read(GR, "data/pages.json").pages.partners.sections;
  must(secs.find((x) => x.id === pb).settings.image === "gal-wide.jpg" && hub.read(GR, "main", "assets/images/gal-wide.jpg") != null, "banner picture not saved");
  must(secs.find((x) => x.id === lr).settings.logos[0].href === "https://example.org", "logo link not saved");
});

// =============== 6e. New sections, batch 3 ===============
area = "New sections: batch 3";
await check("Exhibitions: one only from publicity shows Reported, and a source that is not a web address is not kept", async () => {
  await openSite("world-art-review"); await newPage("Shows"); await addSec("exhibitions"); const ex = await secIdOf("exhibitions");
  await page.click('.sec.blk[data-id="' + ex + '"][data-block="0"]'); await page.fill('[data-pf="shows.0.title"]', "Spring show"); await page.fill('[data-pf="shows.0.place"]', "A gallery, London");
  await page.selectOption('[data-pf="shows.0.reported"]', "true"); await page.fill('[data-pf="shows.0.href"]', "javascript:alert(1)"); await settle(700);
  const f = frame("worldartreview.com"); must((await f.textContent("#" + ex + " .exh li")).includes("Reported"), "no Reported marker");
  must(!(await f.$("#" + ex + " a.src")), "an unsafe source link is drawn"); await shot("20-exhibitions");
  await liveSave(); const x = read(WR, "content/pages.json").pages.shows.sections.find((y) => y.id === ex).settings.shows[0];
  must(x.reported === true && x.href === "" && x.title === "Spring show", "saved " + JSON.stringify(x));
});
await check("Artist cards: choosing one artist shows just that artist's card", async () => {
  await addSec("artist-cards"); const ac = await secIdOf("artist-cards"); const f = frame("worldartreview.com");
  const all = await f.$$eval("#" + ac + " .acard", (x) => x.length); must(all >= 2, "with none chosen, all published artists should show: " + all);
  await page.click('.ed-right [data-act="ed-blockpicker"]'); await settle(400); await page.selectOption('[data-pf="artists.0"]', "konn-artiss"); await settle(700);
  const names = await f.$$eval("#" + ac + " .acard .wn", (x) => x.map((e) => e.textContent)); must(names.join() === "Konn Artiss", "cards: " + names.join());
  await liveSave(); const a = read(WR, "content/pages.json").pages.shows.sections.find((y) => y.id === ac).settings.artists; must(JSON.stringify(a) === '["konn-artiss"]', "saved " + JSON.stringify(a));
});
await check("Global Art Monitor: a press quote with its source, and a career moment without a date shows To confirm", async () => {
  await openSite("global-art-monitor"); await newPage("Record"); await addSec("press"); await addSec("career");
  const pr = await secIdOf("press"), ca = await secIdOf("career");
  await page.click('#ed-sections .sec[data-id="' + pr + '"]:not(.blk)'); await page.click('.sec.blk[data-id="' + pr + '"][data-block="0"]');
  await page.fill('[data-pf="quotes.0.quote"]', "A careful, measured record."); await page.fill('[data-pf="quotes.0.publication"]', "A test paper"); await page.fill('[data-pf="quotes.0.href"]', "https://example.org/review"); await settle(700);
  const f = frame("globalartmonitor.com");
  must(!!(await f.$('.pq-card a.src[href="https://example.org/review"]')), "no source link on the quote");
  must((await f.textContent('[data-adh="' + ca + '"] .exh-when')).includes("To confirm"), "an empty date is not shown as To confirm"); await shot("21-gam-press");
  await liveSave(); const q = read(GR, "data/pages.json").pages.record.sections.find((y) => y.id === pr).settings.quotes[0];
  must(q.href === "https://example.org/review" && q.publication === "A test paper", "saved " + JSON.stringify(q));
});

// =============== 6f. New sections, batch 4 ===============
area = "New sections: batch 4";
await check("Contact form: a hidden topic is left out, and the button readies an email to the gallery without sending anything", async () => {
  await openSite("world-art-review"); await newPage("Write"); await addSec("contact-form"); const cf = await secIdOf("contact-form");
  await page.click('.sec.blk[data-id="' + cf + '"][data-block="1"]'); await page.click('.ptools [data-act="ed-hide"]'); await settle(700);
  const f = frame("worldartreview.com"); const opts = await f.$$eval("#" + cf + " option", (o) => o.map((x) => x.textContent));
  must(!opts.includes("A correction") && opts.includes("A question"), "topics shown: " + opts.join());
  must((await f.textContent("#" + cf + " .mf-note")).includes("opens your own email app"), "no plain line under the button");
  await f.fill("#" + cf + " [name=name]", "Sam"); await f.fill("#" + cf + " [name=email]", "sam@example.org"); await f.fill("#" + cf + " [name=message]", "Hello");
  await f.$eval("#" + cf + " form", (x) => x.requestSubmit()); await settle(300); // in the editor a click picks the section, so the form is sent directly
  const m = decodeURIComponent(await f.getAttribute("#" + cf + " form", "data-mailto") || "");
  must(m.startsWith("mailto:info@grovegallery.com?subject=A question from Sam") && m.includes("Reply to: sam@example.org"), "email: " + m); await shot("22-contact-form");
});
await check("Visit us: a map link that is not a web address is not kept or drawn", async () => {
  await addSec("visit"); const vi = await secIdOf("visit");
  await page.click('#ed-sections .sec[data-id="' + vi + '"]:not(.blk)'); await page.fill('[data-pf="map"]', "javascript:alert(1)"); await settle(700);
  must(!(await frame("worldartreview.com").$("#" + vi + " a.vmap")), "an unsafe map link is drawn");
  await liveSave(); const x = read(WR, "content/pages.json").pages.write.sections.find((y) => y.id === vi).settings;
  must(x.map === "" && x.details.length === 3 && x.details[0].title === "Address", "saved " + JSON.stringify(x));
});
await check("Global Art Monitor: the sign-up says it opens the visitor's email app, and saves", async () => {
  await openSite("global-art-monitor"); await newPage("Join"); await addSec("signup"); const su = await secIdOf("signup"); const f = frame("globalartmonitor.com");
  must((await f.textContent('[data-adh="' + su + '"] .su-note')).includes("info@grovegallery.com"), "no plain line under the button"); await shot("23-gam-signup");
  await liveSave(); const s = read(GR, "data/pages.json").pages.join.sections.find((y) => y.id === su).settings; must(s.button === "Ask to join", "saved " + JSON.stringify(s));
});

// =============== 6g. People ===============
area = "People";
const goHome = async () => { await page.reload(); await page.waitForSelector('[data-act="open-site"]', { timeout: 12000 }); await settle(600); };
await check("The admin invites an editor for one site, and the normal sign-in email is sent", async () => {
  await goHome(); await page.click('[data-tab="people"]'); await page.waitForSelector(".prow"); await settle(500);
  must((await text("body")).includes("No editors yet"), "an empty list should say so");
  await page.click('[data-act="people-invite"]'); await page.fill("#pi-email", "Editor@Example.org"); await page.fill("#pi-name", "Edie Tor");
  await page.check('form[data-form="invite"] input[value="world-art-review"]'); await page.click('form[data-form="invite"] button[type=submit]'); await settle(900);
  must(ppl.table.length === 1 && ppl.table[0].email === "editor@example.org" && JSON.stringify(ppl.table[0].sites) === '["world-art-review"]', "saved " + JSON.stringify(ppl.table));
  must(ppl.mails.length === 1 && ppl.mails[0].to === "editor@example.org", "no sign-in email");
  must((await text('.prow[data-email="editor@example.org"]')).includes("Editor, invited"), "the new editor is not shown as invited"); await shot("24-people");
});
await check("The admin gives the editor a second site", async () => {
  await page.click('.prow[data-email="editor@example.org"]'); await page.check('form[data-form="person"] input[value="global-art-monitor"]');
  await page.click('form[data-form="person"] button[type=submit]'); await settle(900);
  must(JSON.stringify(ppl.table[0].sites) === '["world-art-review","global-art-monitor"]', "saved " + JSON.stringify(ppl.table[0].sites));
});
await check("An editor sees only their sites, and no People screen", async () => {
  await page.click('.prow[data-email="editor@example.org"]'); await page.uncheck('form[data-form="person"] input[value="global-art-monitor"]');
  await page.click('form[data-form="person"] button[type=submit]'); await settle(900);
  signedIn = "editor@example.org";
  try {
    await goHome();
    const n = await page.locator('[data-act="open-site"]').count(); must(n === 1, n + " sites shown to the editor");
    must(!(await page.$('[data-tab="people"]')), "People shows for an editor"); await shot("25-editor-home");
  } finally { signedIn = "tester@artiscope.co.uk"; }
});
await check("Removing someone asks once, and they are turned away from their next click", async () => {
  await goHome(); await page.click('[data-tab="people"]'); await page.waitForSelector('.prow[data-email="editor@example.org"]');
  await page.click('.prow[data-email="editor@example.org"]'); await page.click('[data-act="people-remove"]'); await settle(300);
  must(ppl.table.length === 1, "removed before the second press");
  await page.click('[data-act="people-remove-yes"]'); await settle(900); must(ppl.table.length === 0, "not removed");
  signedIn = "editor@example.org";
  try { await goHome().catch(() => {}); must((await text("body")).toLowerCase().includes("does not have access"), "the removed editor still got in"); }
  finally { signedIn = "tester@artiscope.co.uk"; await goHome(); }
});

// =============== 7. Global Art Monitor ===============
area = "Global Art Monitor";
await check("The editor opens with the real page", async () => { await openSite("global-art-monitor"); must(!!frame("globalartmonitor.com"), "no preview"); });
await check("An empty hammer price shows as To confirm and saves as empty", async () => {
  await page.selectOption(".pagepick", "artist-zara-muse"); await settle(1200); await page.click('.sec[data-where="item"][data-id="sales"]'); await page.click('.sec.blk[data-id="sales"] >> nth=1');
  await page.fill('[data-pf="sales.1.hammer"]', ""); await settle(500); await liveSave(); must(read(GR, "data/sales.json").sales[1].hammer === null, "saved as " + read(GR, "data/sales.json").sales[1].hammer);
});
await check("A sale without a source is refused with a plain reason", async () => {
  await page.click('.addl.blk[data-id="sales"]'); await page.fill('[data-pf$=".title"] >> nth=0', "No source work"); await settle(300);
  await page.click('[data-act="ed-save"]'); await page.click('[data-act="livesave"]'); await settle(1500); const n = await notice(); must(/needs a source/i.test(n), "notice: " + n); return n;
});
await check("A sale date written in words is refused", async () => {
  const i = await page.evaluate(() => window.__adh.pgOf().site.artists[0].sales.length - 1);
  await page.fill(`[data-pf="sales.${i}.source_label"]`, "Lot page"); await page.fill(`[data-pf="sales.${i}.source_url"]`, "https://example.com/lot"); await page.fill(`[data-pf="sales.${i}.date"]`, "3 March 2026"); await settle(300);
  await page.click('[data-act="ed-save"]'); await page.click('[data-act="livesave"]'); await settle(1500); const n = await notice(); must(/year-month-day/i.test(n), "notice: " + n);
});
await check("A low estimate above the high estimate is refused", async () => {
  const i = await page.evaluate(() => window.__adh.pgOf().site.artists[0].sales.length - 1);
  await page.fill(`[data-pf="sales.${i}.date"]`, "2026-03-03"); await page.fill(`[data-pf="sales.${i}.est_low"]`, "900"); await page.fill(`[data-pf="sales.${i}.est_high"]`, "500"); await settle(300);
  await page.click('[data-act="ed-save"]'); await page.click('[data-act="livesave"]'); await settle(1500); const n = await notice(); await page.click('[data-act="ed-discard"]'); must(/low estimate/i.test(n), "notice: " + n);
});
await check("The publisher disclosure cannot be emptied", async () => {
  await page.selectOption(".pagepick", "site-details"); await settle(1000); await page.click('.sec[data-where="item"][data-id="details"]'); await page.fill('[data-pf="site.disclosure"]', "");
  await page.click('[data-act="ed-save"]'); await page.click('[data-act="livesave"]'); await settle(1500); const n = await notice(); await page.click('[data-act="ed-discard"]'); must(/publishes the site/i.test(n), "notice: " + n);
});
await check("An artist with sales cannot be deleted, and says why", async () => { await page.selectOption(".pagepick", "artist-konn-artiss"); await settle(1000); await page.click('.sec[data-where="item"][data-id="about"]'); must((await text(".ed-right")).includes("Remove the sales"), "no reason"); });
await check("Global Art Monitor's own pages cannot be deleted", async () => { await page.selectOption(".pagepick", "page-about"); await settle(1000); await page.click('.sec[data-where="pageinfo"]'); must((await text(".ed-right")).includes("site's own pages"), "deletable"); });

// =============== 8. When things go wrong ===============
area = "When things go wrong";
await check("If GitHub fails, the message is plain and nothing is half saved", async () => {
  await page.selectOption(".pagepick", "home"); await settle(1000); await page.click('#ed-sections .sec[data-id="status"]:not(.blk)'); await page.fill('[data-pf="clock"]', "Fail me"); await settle(300);
  breakGitHub = true; await page.click('[data-act="ed-save"]'); await page.click('[data-act="livesave"]'); await settle(2000); breakGitHub = false;
  const n = await notice(); must(n && !/undefined|\[object/i.test(n), "notice: " + n); must(!JSON.stringify(read(GR, "data/pages.json")).includes("Fail me"), "half saved"); return n;
});
await check("After a failure, saving again works", async () => { await page.click('[data-act="ed-save"]'); await page.click('[data-act="livesave"]').catch(() => {}); await page.waitForSelector("text=Saved", { timeout: 9000 }); await settle(800); must(JSON.stringify(read(GR, "data/pages.json")).includes("Fail me"), "not saved"); });
await check("If someone else changed the page meanwhile, the save says so instead of overwriting", async () => {
  await page.click('#ed-sections .sec[data-id="status"]:not(.blk)'); await page.fill('[data-pf="clock"]', "Mine"); await settle(300);
  // a change made elsewhere (by the agent, say) to the same file
  const p = read(GR, "data/pages.json"); p.pages.home.sections.find((x) => x.id === "status").settings.clock = "Theirs";
  await handle(new Request("https://x/functions/v1/home", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify({ action: "savePages", site: "global-art-monitor", pages: p }) }));
  await page.click('[data-act="ed-save"]'); await page.click('[data-act="livesave"]'); await settle(2000);
  const now = read(GR, "data/pages.json").pages.home.sections.find((x) => x.id === "status").settings.clock;
  if (now === "Mine") throw new Error("the other change was overwritten without a word");
  must(await page.isVisible("text=Someone else changed this site while you were editing"), "no explanation shown"); await shot("08-someone-else");
});
await check("Save mine anyway then saves over it, on purpose", async () => {
  await page.click('[data-act="stale-replace"]'); await page.waitForSelector("text=Saved", { timeout: 9000 }); await settle(800);
  must(read(GR, "data/pages.json").pages.home.sections.find((x) => x.id === "status").settings.clock === "Mine", "not saved");
});

// =============== 9. Phone, keyboard and screen readers ===============
area = "Phone and access";
for (const tab of ["home", "overview", "files", "history", "theme"]) {
  await check("No sideways scrolling on a phone: " + tab, async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate((t) => { window.__adh.state.leave = null; window.__adh.state.dirty = false; const p = window.__adh.pgOf(); if (p) { p.dirty = false; } window.__adh.go(t); }, tab); await settle(900);
    const w = await page.evaluate(() => document.documentElement.scrollWidth); await page.setViewportSize({ width: 1440, height: 900 }); must(w <= 392, "page is " + w + " pixels wide");
  });
}
await check("Editor on a phone stays usable", async () => { await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.__adh.go("pages")); await settle(2500); await shot("07-phone-editor"); const w = await page.evaluate(() => document.documentElement.scrollWidth); await page.setViewportSize({ width: 1440, height: 900 }); must(w <= 392, w + " pixels wide"); });
await check("Every button has words a screen reader can read", async () => {
  const bad = await page.evaluate(() => [...document.querySelectorAll("button, a[href], [role=button]")].filter((b) => !(b.innerText || "").trim() && !b.getAttribute("aria-label") && !b.title && !b.closest("details:not([open])")).length); must(bad === 0, bad + " without words");
});
await check("Every form box has a label", async () => {
  const bad = await page.evaluate(() => [...document.querySelectorAll("input:not([type=hidden]):not([type=file]), select, textarea")].filter((i) => !(i.id && document.querySelector('label[for="' + i.id + '"]')) && !i.getAttribute("aria-label") && !i.closest("label")).map((i) => i.dataset.pf || i.dataset.change || i.className)); must(bad.length === 0, bad.length + " without a label: " + bad.slice(0, 5).join(", "));
});
await check("You can see where the keyboard is", async () => { await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); const o = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle); must(o !== "none", "no visible focus"); });

// =============== results ===============
results.push(...errors.map((e) => ({ area: "Script errors on the page", name: e.slice(0, 160), ok: false, note: "" })));
fs.writeFileSync(OUT + "results.json", JSON.stringify(results, null, 2));
const passed = results.filter((r) => r.ok).length;
console.log(`UAT: ${passed} of ${results.length} passed`);
for (const r of results) console.log((r.ok ? "PASS " : "FAIL ") + r.area + " | " + r.name + (r.note ? " | " + r.note : ""));
await browser.close(); srv.kill();
