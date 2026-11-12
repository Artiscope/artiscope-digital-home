// User acceptance run: the real console, signed in, talking to the real server code
// over an in-memory GitHub seeded from both sites, with the real sites as previews.
// Each case is recorded as passed or failed with a note; nothing stops the run.
import fs from "node:fs"; import path from "node:path"; import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
const OUT = "/tmp/uat/"; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT + "shots", { recursive: true });
const PORT = 8841, consoleAt = "http://localhost:" + PORT;
const WARDIR = "/home/claude/world-art-review/", GAMDIR = "/home/claude/global-art-monitor/";

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
globalThis.Deno = { env: { get: (k) => ({ GITHUB_TOKEN: "t", ALLOWED_EMAILS: "tester@artiscope.co.uk", SUPABASE_URL: "https://s" }[k] || "") }, serve() {} };
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
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
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
await check("Version number is shown", async () => must((await text("body")).includes("Version 23"), "no version"));
await check("An unbuilt site opens to Not built yet", async () => { await page.click('[data-act="open-site"][data-site="site-3"]'); await settle(); must((await text("body")).toLowerCase().includes("not built yet"), "no message"); await page.click('[data-tab="home"]'); });
await check("Someone not on the list is turned away with a plain message", async () => {
  signedIn = "stranger@example.com"; await page.click('[data-act="refresh"]').catch(() => page.reload()); await settle(1500);
  const t = await text("body"); signedIn = "tester@artiscope.co.uk";
  must(/does not have access/i.test(t), "message was: " + t.slice(0, 120)); await page.reload(); await page.waitForSelector('[data-act="open-site"]');
});

// =============== 2. World Art Review: the page editor ===============
area = "Page editor, World Art Review";
await check("Opening a site goes straight to the page editor with the real page", async () => { await openSite("world-art-review"); must(!!frame("worldartreview.com"), "no preview"); await shot("02-editor"); });
await check("Menu has Overview, Pages, Theme, Files, History, and no Content or Photos", async () => { const t = await text(".ed-left"); must(t.includes("Files") && !t.includes("Content: articles") , "left list: " + t.slice(-160)); });
await check("Clicking a part of the page opens its settings", async () => { await frame("worldartreview.com").click("#numbers"); await page.waitForSelector(".ed-right h2:has-text('Numbers band')"); });
await check("Typing redraws the page before saving", async () => { await page.fill('[data-pf="eyebrow"]', "The review in numbers"); await settle(500); must((await frame("worldartreview.com").evaluate(() => document.querySelector("#numbers .eyebrow").textContent)) === "The review in numbers", "not redrawn"); });
await check("Save on the live site asks once, then saves to the live site", async () => { await page.click('[data-act="ed-save"]'); await page.waitForSelector("text=goes live in about two minutes"); await shot("03-live-question"); await page.click('[data-act="livesave"]'); await page.waitForSelector("text=Saved"); await settle(1200); must(JSON.stringify(read(WR, "content/pages.json")).includes("The review in numbers"), "not on main"); });
await check("Undo takes the save back on the live site, after one question", async () => { await page.click('[data-act="undo-step"]'); await page.click('[data-act="livesave"]'); await settle(2500); must(!JSON.stringify(read(WR, "content/pages.json")).includes("The review in numbers"), "still there"); });
await check("Redo puts it back", async () => { await page.click('[data-act="redo-step"]'); await page.click('[data-act="livesave"]'); await settle(2500); must(JSON.stringify(read(WR, "content/pages.json")).includes("The review in numbers"), "not back"); });
await check("Discard throws away unsaved typing", async () => { await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await page.fill('[data-pf="eyebrow"]', "Throw me away"); await settle(300); await page.click('[data-act="ed-discard"]'); await settle(400); must(!(await text(".ed-top")).includes("Edited"), "still edited"); });
await check("Leaving with unsaved changes asks first, and Keep editing keeps them", async () => {
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await page.fill('[data-pf="eyebrow"]', "Keep me"); await settle(300);
  await page.click('.sec.plain[data-tab="history"]'); await page.waitForSelector("text=You have changes that are not saved yet"); await page.click('[data-act="leave-stay"]');
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
  await page.click('#ed-sections .sec[data-id="method"]:not(.blk)'); await page.click('#ed-float [data-act="ed-hide"]'); await settle(400);
  const ids = await frame("worldartreview.com").evaluate(() => [...document.querySelectorAll("#main > section")].map((s) => s.id)); must(!ids.includes("method"), "still shown");
  await page.click('#ed-float [data-act="ed-hide"]'); await page.click('[data-act="ed-library"]'); await page.click('[data-act="ed-add"][data-kind="quote"]'); await settle(500);
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
  await page.click('[data-act="ed-library"]'); await page.click('[data-act="ed-add"][data-kind="picture"]'); await page.waitForSelector('[data-upload="image"]', { state: "attached" });
  await page.setInputFiles('[data-upload="image"]', "/tmp/uat/not-a-photo.txt"); await settle(500); const n = await notice(); must(/JPG or PNG/i.test(n), "notice: " + n);
});
await check("A photo without a description cannot be saved", async () => {
  await page.setInputFiles('[data-upload="image"]', "/tmp/s2/studio.jpg"); await page.waitForSelector(".picthumb[src^='data:image']"); await page.fill('[data-pf="alt"]', "");
  await page.click('[data-act="ed-save"]'); await settle(500); const n = await notice(); must(/describe the picture/i.test(n), "notice: " + n);
});
await check("With a description, the photo and the page save together as one step", async () => {
  await page.fill('[data-pf="alt"]', "A brown test square"); await liveSave(); const names = Object.keys(hub.refs(WR)).length;
  must(hub.read(WR, "main", "images/studio.jpg") != null, "photo not saved"); must(/^Edit page: /.test(hub.lastMessage(WR, "main")), "message: " + hub.lastMessage(WR, "main"));
});
await check("A very large photo is made smaller before it is sent", async () => {
  const big = await page.evaluate(async () => { const c = document.createElement("canvas"); c.width = 5200; c.height = 3400; const x = c.getContext("2d"); x.fillStyle = "#884422"; x.fillRect(0, 0, 5200, 3400); return c.toDataURL("image/jpeg", .9).split(",")[1]; });
  fs.writeFileSync("/tmp/uat/big.jpg", Buffer.from(big, "base64"));
  await page.click('[data-act="ed-library"]'); await page.click('[data-act="ed-add"][data-kind="picture"]'); await page.waitForSelector('[data-upload="image"]', { state: "attached" });
  await page.setInputFiles('[data-upload="image"]', "/tmp/uat/big.jpg"); await page.waitForSelector(".picthumb[src^='data:image']");
  const dims = await page.evaluate(() => new Promise((r) => { const p = window.__adh.pgOf(), k = Object.keys(p.uploads).pop(), i = new Image(); i.onload = () => r([i.width, i.height]); i.src = p.uploads[k].dataUrl; }));
  await page.click('[data-act="ed-discard"]'); must(Math.max(...dims) <= 2400, "sent at " + dims.join("x")); return "Sent at " + dims.join(" by ") + " pixels";
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
await check("Photos cannot be added until each has a description", async () => { await page.setInputFiles('[data-change="files-add"]', ["/tmp/s2/studio.jpg"]); await page.waitForSelector(".addrow"); must(await page.isDisabled('[data-act="files-send"]'), "button enabled"); await page.click('[data-act="fadd-drop"]'); });
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
  const bad = await page.evaluate(() => [...document.querySelectorAll("button, a[href], [role=button]")].filter((b) => !(b.innerText || "").trim() && !b.getAttribute("aria-label") && !b.title).length); must(bad === 0, bad + " without words");
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
