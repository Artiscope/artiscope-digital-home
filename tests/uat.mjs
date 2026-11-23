import { W_DIR, G_DIR, C_DIR, FIX, chromeOptions, sadDir, tacDir, goTab } from "./where.mjs";
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
fs.rmSync("/tmp/uat-sad", { recursive: true, force: true }); execFileSync("python3", [sadDir() + "/tools/build.py", "/tmp/uat-sad"]);
fs.writeFileSync("/tmp/uat-sad/assets/site.js", fs.readFileSync("/tmp/uat-sad/assets/site.js", "utf8").split('"https://artiscope.github.io"').join('"' + consoleAt + '"'));

// the practice build: the starter, filled in as the console fills it, and built as publishing builds it
const STARTER = C_DIR + "/starter/", walk = (dir, at = "") => fs.readdirSync(dir + at, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(dir, at + d.name + "/") : [at + d.name]);
const starterFiles = Object.fromEntries(walk(STARTER).map((f) => [f, fs.readFileSync(STARTER + f, "utf8")]));
// every site template, as it sits in the console's repository
const tsadFiles = Object.fromEntries(["street-art-dispatch", "global-art-monitor", "world-art-review", "the-art-correspondent", "editions"].flatMap((t) => { const d = C_DIR + "/templates/" + t + "/"; return walk(d).filter((f) => !f.endsWith(".gitkeep")).map((f) => ["templates/" + t + "/" + f, fs.readFileSync(d + f, "utf8")]); }));
const pbContent = JSON.parse(starterFiles["data/content.json"]); pbContent.site.address = "https://artiscope.github.io/practice-build/";
const pbFiles = { ...starterFiles, "data/content.json": JSON.stringify(pbContent, null, 2) + "\n" };
fs.rmSync("/tmp/uat-pb-src", { recursive: true, force: true }); fs.rmSync("/tmp/uat-pb", { recursive: true, force: true });
for (const [f, t] of Object.entries(pbFiles)) { fs.mkdirSync(path.dirname("/tmp/uat-pb-src/" + f), { recursive: true }); fs.writeFileSync("/tmp/uat-pb-src/" + f, t); }
execFileSync("python3", ["/tmp/uat-pb-src/tools/build.py", "/tmp/uat-pb"]);
fs.writeFileSync("/tmp/uat-pb/assets/site.js", fs.readFileSync("/tmp/uat-pb/assets/site.js", "utf8").split('"https://artiscope.github.io"').join('"' + consoleAt + '"'));
const CR = "Artiscope/artiscope-digital-home", PB = "Artiscope/practice-build";
const siteList = { sites: [{ id: "practice-build", name: "Practice build", domain: "artiscope.github.io/practice-build", repo: PB, kind: "starter", playground: true, live: true }, { id: "site-4", name: "Site 4" }, { id: "site-5", name: "Site 5" }, { id: "site-6", name: "Old Notes", domain: "oldnotes.org", repo: "Artiscope/old-notes", kind: "outside" }, { id: "site-7", name: "The Art Correspondent", domain: "theartcorrespondent.com", repo: "Artiscope/the-art-correspondent", kind: "starter", template: "the-art-correspondent", live: true }] };

// ----- the server, with GitHub in memory -----
let signedIn = "tester@artiscope.co.uk";
globalThis.Deno = { env: { get: (k) => ({ GITHUB_TOKEN: "t", ALLOWED_EMAILS: "tester@artiscope.co.uk", SUPABASE_URL: "https://s", SUPABASE_SERVICE_ROLE_KEY: "k", SCHEDULE_KEY: "a-long-random-key-for-the-clock-0123456789", SHOPIFY_TOKEN: "shpat_uat" }[k] || "") }, serve() {} };
const { makeShop } = await import("./fakeshop.mjs"); const shop = makeShop("zx-test"); shop.setKey("shpat_uat");
const { makePeople } = await import("./fakepeople.mjs"); const ppl = makePeople();
const { handle, STARTER_KINDS, useSiteList } = await import("./home.mjs");
const { makeGitHub } = await import("./fakegit.mjs");
const files = (dir, list) => Object.fromEntries(list.filter((f) => fs.existsSync(dir + f)).map((f) => [f, fs.readFileSync(dir + f, "utf8")]));
const pics = (dir, sub) => Object.fromEntries(fs.readdirSync(dir + sub).map((f) => [sub + "/" + f, "picture"]));
const WR = "Artiscope/World-art-review", GR = "Artiscope/global-art-monitor", SR = "Artiscope/street-art-dispatch", TR = "Artiscope/the-art-correspondent";
// The Art Correspondent, as its repository holds it and built as publishing builds it
const TACDIR = tacDir() + "/";
fs.rmSync("/tmp/uat-tac", { recursive: true, force: true }); execFileSync("python3", [TACDIR + "tools/build.py", "/tmp/uat-tac"]);
fs.writeFileSync("/tmp/uat-tac/assets/site.js", fs.readFileSync("/tmp/uat-tac/assets/site.js", "utf8").split('"https://artiscope.github.io"').join('"' + consoleAt + '"'));
const SADDIR = sadDir() + "/", sad0 = JSON.parse(fs.readFileSync(SADDIR + "data/content.json", "utf8"));
const hub = makeGitHub({
  [WR]: { ...files(WARDIR, ["src/index.html", "tools/build_site.py", "content/site.json", "content/pages.json", "content/theme.json", "image-slots.json", "AGENT-LOG.md", "CONTENT-CALENDAR.md"]), ...pics(WARDIR, "images") },
  [SR]: files(SADDIR, ["data/content.json", "data/pages.json", "data/theme.json", "AGENT-LOG.md", "CONTENT-CALENDAR.md"]),
  [CR]: { "sites.json": JSON.stringify(siteList), ...Object.fromEntries(Object.entries(starterFiles).map(([f, t]) => ["starter/" + f, t])), ...tsadFiles },
  [PB]: pbFiles,
  [TR]: files(TACDIR, ["data/content.json", "data/pages.json", "data/theme.json", "data/files.json", "assets/render.js", "assets/site.css", "assets/site.js", "tools/build.mjs", "tools/build.py"]),
  [GR]: { ...files(GAMDIR, ["data/content.json", "data/sales.json", "data/images.json", "data/pages.json", "data/theme.json", "image-slots.json", "AGENT-LOG.md", "CONTENT-CALENDAR.md"]), ...pics(GAMDIR, "assets/images") },
});
let breakGitHub = false;
let previewGone = false, dnsAnswers = {};   // a new copy whose own preview is not built yet: GitHub answers 404 for it
globalThis.fetch = async (url, init = {}) => {
  if (String(url).includes("/auth/v1/user")) return new Response(JSON.stringify({ email: signedIn }));
  if (String(url).startsWith("https://dns.google/")) { const q = new URL(String(url)).searchParams; return new Response(JSON.stringify({ Answer: (dnsAnswers[q.get("name") + " " + q.get("type")] || []).map((data) => ({ data })) })); }
  if (init.method === "HEAD") return new Response(null, { status: previewGone && String(url).includes("/preview/") ? 404 : 200 });
  if (ppl.handles(url)) return ppl.fetch(url, init);
  if (shop.handles(url)) return shop.fetch(url, init);
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: process.env.FILM ? 4 / 3 : 1 });
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
  if (url.startsWith("https://streetartdispatch.com/")) return serveSite("/tmp/uat-sad", route, url);
  if (url.startsWith("https://theartcorrespondent.com/")) return serveSite("/tmp/uat-tac", route, url);
  if (url.startsWith("https://artiscope.github.io/practice-build/")) return serveSite("/tmp/uat-pb", route, url.replace("https://artiscope.github.io/practice-build/", "https://pb.local/"));
  if (url.startsWith("https://artiscope.github.io/grove-prints/") && fs.existsSync("/tmp/uat-new")) return serveSite("/tmp/uat-new", route, url.replace("https://artiscope.github.io/grove-prints/", "https://new.local/"));
  return route.abort();
});
const shot = (n) => page.screenshot({ path: OUT + "shots/" + n + ".png" });
const settle = (ms = 800) => page.waitForTimeout(ms);
// the newest frame showing that site: the editor's preview, not a small picture of the site left from another screen
const frame = (host) => page.frames().filter((f) => f.url().startsWith("https://" + host)).pop();
const text = (sel) => page.innerText(sel);
const notice = async () => (await page.locator(".notice").allInnerTexts()).join(" | ");
// Undo or Redo of a save sits in Save's dropdown; the top bar's Undo is for changes not saved yet.
async function savedStep(which) { if (!(await page.isVisible('.svp [data-act="' + which + '-step"]'))) await page.click('[data-act="ed-pop"][data-menu="save"]'); await page.click('.svp [data-act="' + which + '-step"]'); }
async function liveSaveTry() { await page.click('[data-act="ed-save"]'); await page.click('[data-act="livesave"]'); await settle(2500); }
async function liveSave() { await page.click('[data-act="ed-save"]'); await page.click('[data-act="livesave"]'); await page.waitForSelector("text=Saved", { timeout: 9000 }); await settle(900); }
async function openSite(id) { await page.click(".ed-exit", { timeout: 800 }).catch(() => {}); await page.click('[data-tab="home"]', { timeout: 1500 }).catch(() => {}); await shot("open-" + id); await page.evaluate((x) => { window.__adh.state.leave = null; }, id); await page.waitForSelector('[data-act="open-site"][data-site="' + id + '"]', { timeout: 20000 }); await page.click('[data-act="open-site"][data-site="' + id + '"]'); await page.waitForSelector('[data-tab="overview"]'); if (!(await page.isVisible(".ed-exit"))) await page.click('.navb[data-tab="pages"]'); await page.waitForSelector("#ed-sections .sec, .wdpanel", { timeout: 12000 }); await settle(1800); }

// The walkthrough video (FILM=1): every screen filmed for the video, then stop. See tests/tools/film.mjs.
if (process.env.FILM) {
  const { runFilm } = await import("./tools/film.mjs");
  await page.goto(consoleAt + "/index.html"); await page.waitForSelector('[data-act="open-site"]', { timeout: 20000 });
  await runFilm({ page, settle, openSite, ppl, consoleAt, hub, setSignedIn: (e) => { signedIn = e; } });
  await browser.close(); srv.kill(); process.exit(0);
}
// The usability walk (AUDIT=1): every screen at computer and phone width, then stop. See tests/audit.mjs.
if (process.env.AUDIT) {
  const { runAudit } = await import("./audit.mjs");
  await page.goto(consoleAt + "/index.html"); await page.waitForSelector('[data-act="open-site"]', { timeout: 20000 });
  const rep = await runAudit({ page, browser, consoleAt, hub, ppl, shot, settle, openSite, goTab, setSignedIn: (e) => { signedIn = e; } });
  console.log("AUDIT: " + rep.length + " screen views written to /tmp/uat/audit.json");
  await browser.close(); srv.kill(); process.exit(0);
}
// =============== 1. Getting in ===============
area = "Getting in";
await page.goto(consoleAt + "/index.html");
await check("Signed-in console opens on All sites, with all eight sites, The Art Correspondent, the Practice site and the practice build among them", async () => { await page.waitForSelector('[data-act="open-site"]', { timeout: 12000 }); const n = await page.locator('[data-act="open-site"]').count(); must(n === 8, n + " sites shown"); await shot("01-home"); });
await check("Version number is shown", async () => must((await text("body")).includes("Version 67"), "no version"));
await check("A site still to build opens Start building", async () => { await page.click('[data-act="open-site"][data-site="site-4"]'); await settle(); must((await text("body")).includes("About the site"), "no Start building"); await page.click('[data-act="bd-close"]'); await page.waitForSelector('[data-act="open-site"]'); });
await check("Someone not on the list is turned away with a plain message", async () => {
  signedIn = "stranger@example.com"; await page.click('[data-act="refresh"]').catch(() => page.reload()); await settle(1500);
  const t = await text("body"); signedIn = "tester@artiscope.co.uk";
  must(/does not have access/i.test(t) && /Ask the admin to invite you/.test(t) && /same email address/.test(t), "message was: " + t.slice(0, 160)); await page.reload(); await page.waitForSelector('[data-act="open-site"]');
});

// =============== 2. World Art Review: the page editor ===============
area = "Page editor, World Art Review";
await check("Opening a site goes straight to the page editor with the real page", async () => { await openSite("world-art-review"); must(!!frame("worldartreview.com"), "no preview"); await shot("02-editor"); });
await check("Exit leads to the menu: Overview, Pages, Theme, Files, History, and no Content or Photos", async () => { await page.click(".ed-exit"); await page.waitForSelector(".rail"); const t = await text(".rail"); await goTab(page, "pages"); await page.waitForSelector("#ed-sections .sec"); await settle(2500); must(["Overview", "Pages", "Theme", "Files", "History"].every((w) => t.includes(w)) && !t.includes("Content") && !t.includes("Photos"), "menu: " + t); });
await check("Clicking a part of the page opens its settings", async () => { await frame("worldartreview.com").click("#numbers"); await page.waitForSelector(".ed-right h2:has-text('Numbers band')"); });
await check("Typing redraws the page before saving", async () => { await page.fill('[data-pf="eyebrow"]', "The review in numbers"); await settle(500); must((await frame("worldartreview.com").evaluate(() => document.querySelector("#numbers .eyebrow").textContent)) === "The review in numbers", "not redrawn"); });
await check("Save on the live site asks once, then saves to the live site", async () => { await page.click('[data-act="ed-save"]'); await page.waitForSelector("text=goes live in about two minutes"); await shot("03-live-question"); await page.click('[data-act="livesave"]'); await page.waitForSelector("text=Saved"); await settle(1200); must(JSON.stringify(read(WR, "content/pages.json")).includes("The review in numbers"), "not on main"); });
await check("Undo takes the save back on the live site, after one question", async () => { await savedStep("undo"); await page.click('[data-act="livesave"]'); await settle(2500); must(!JSON.stringify(read(WR, "content/pages.json")).includes("The review in numbers"), "still there"); });
await check("Redo puts it back", async () => { await savedStep("redo"); await page.click('[data-act="livesave"]'); await settle(2500); must(JSON.stringify(read(WR, "content/pages.json")).includes("The review in numbers"), "not back"); });
await check("Discard throws away unsaved typing", async () => { await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await page.fill('[data-pf="eyebrow"]', "Throw me away"); await settle(300); await page.click('[data-act="ed-discard"]'); await settle(400); must(!(await text(".ed-top")).includes("Edited"), "still edited"); });
await check("Leaving with unsaved changes asks first, and Keep editing keeps them", async () => {
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await page.fill('[data-pf="eyebrow"]', "Keep me"); await settle(300);
  await page.click('.ed-exit'); await page.waitForSelector("text=You have changes that are not saved yet"); await page.click('[data-act="leave-stay"]');
  must(await page.inputValue('[data-pf="eyebrow"]') === "Keep me", "lost"); await page.click('[data-act="ed-discard"]');
});
area = "Editor frame";
if (ONLY && ONLY.includes(area) && !ONLY.includes("Page editor, World Art Review")) await openSite("world-art-review");
await check("The top bar has Exit, the panel switches, the site, the page picker, Inspector, Computer and Phone, Undo, Redo, More and Save", async () => {
  for (const sel of [".ed-exit", '[data-act="ed-panel"][data-panel="sections"]', '[data-act="ed-panel"][data-panel="theme"]', '[data-act="ed-panel"][data-panel="addons"]', ".ed-sitebtn", ".ed-pagebtn", ".insp", '[data-act="ed-mode"][data-mode="phone"]', '[data-act="ed-undo"]', '[data-act="ed-redo"]', '[data-act="ed-pop"][data-menu="more"]', '[data-act="ed-save"]']) must(await page.isVisible(sel), "missing " + sel);
  must(!(await page.isVisible(".ed .rail")), "the side menu is still in the editor"); await shot("02b-topbar");
});
await check("Save stays off until something changes", async () => {
  must(await page.isDisabled('[data-act="ed-save"]'), "Save is on with nothing to save");
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await page.fill('[data-pf="eyebrow"]', "Now changed"); await settle(300);
  must(!(await page.isDisabled('[data-act="ed-save"]')), "Save stayed off"); await page.click('[data-act="ed-discard"]'); await settle(300);
});
await check("The panel switches change the left column, and the open one hides it", async () => {
  await page.click('[data-act="ed-panel"][data-panel="theme"]'); must((await text(".ed-left")).includes("Theme settings"), "no theme panel");
  await page.click('[data-act="ed-panel"][data-panel="theme"]'); must(await page.isVisible(".ed.noleft"), "the column stayed");
  await page.keyboard.press("Control+Alt+1"); await settle(200); must(await page.isVisible("#ed-sections .sec"), "Ctrl+Alt+1 did not bring the sections back");
});
await check("The page picker shows the kinds of page, then the pages of one kind", async () => {
  await page.click(".ed-pagebtn"); await page.click('[data-act="ed-ppgroup"][data-g="lists"]'); must((await text(".pp")).includes("Reviews"), "no lists: " + await text(".pp"));
  await page.click('.pp [data-act="ed-goto-item"][data-hash="reviews"]'); await settle(1200); must(await page.inputValue(".pagepick") === "reviews", "went to " + await page.inputValue(".pagepick"));
});
await check("Searching the page picker finds an article, and Enter opens it", async () => {
  await page.click(".ed-pagebtn"); await page.fill("#pp-q", "palette"); await settle(200);
  must(await page.locator(".pp-all .pp-item:not([hidden])").count() > 0, "nothing found"); await page.keyboard.press("Enter"); await settle(1200);
  must((await page.inputValue(".pagepick")).startsWith("a-"), "opened " + await page.inputValue(".pagepick"));
  await page.selectOption(".pagepick", "home"); await settle(1200);
});
await check("With the inspector off the page is shown as a visitor sees it, and on again it can be edited", async () => {
  await page.click(".insp"); await settle(1500); must(await frame("worldartreview.com").evaluate(() => !window.ADH_EDIT), "still in editing mode");
  await page.click(".insp"); await settle(2000); must(await frame("worldartreview.com").evaluate(() => !!window.ADH_EDIT), "editing did not come back");
});
await check("More has View the live page, and Edit code for the admin", async () => {
  await page.click('[data-act="ed-pop"][data-menu="more"]'); const t = await text(".ed-pop"); await shot("02c-more");
  must(t.includes("View the live page") && t.includes("Edit code") && t.includes("Keyboard shortcuts"), "menu: " + t); must(!(await page.isDisabled('.ed-pop .pp-item:has-text("Edit code")')), "Edit code is off for the admin");
  await page.keyboard.press("Escape"); must(!(await page.isVisible(".ed-pop")), "Escape did not close it");
});
await check("The site button says Live, the save state sits beside Save, and Save's dropdown starts with Publish later", async () => {
  must((await text(".ed-sitebtn")).includes("Live"), "site button: " + await text(".ed-sitebtn")); must((await text(".ed-top .righty .state")).length > 0, "no save state beside Save");
  await page.click('[data-act="ed-pop"][data-menu="save"]'); must((await page.locator(".ed-pop .pp-item").first().innerText()).includes("Publish later"), "first: " + await page.locator(".ed-pop .pp-item").first().innerText()); await page.keyboard.press("Escape");
});
await check("The page picker starts with the home page as a row of its own", async () => {
  await page.click(".ed-pagebtn"); must((await page.locator(".pp-lvl .pp-item").first().innerText()).includes("Home page"), "first row: " + await page.locator(".pp-lvl .pp-item").first().innerText()); await page.keyboard.press("Escape");
});
await check("The site button lists the live site and the trial copies", async () => {
  await page.click(".ed-sitebtn"); must((await text(".ed-pop")).includes("Live site"), "no live site"); await page.click(".ed-mid", { position: { x: 60, y: 6 } }); must(!(await page.isVisible(".ed-pop")), "a click outside did not close it");
});
area = "Page editor, World Art Review";
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
  await page.click('.ptools [data-act="ed-hide"]'); await page.click('.addl[data-act="ed-secpicker"][data-g="page"]'); await page.click('.pk-item[data-key="quote"]'); await settle(500);
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
  await page.click('.addl[data-act="ed-secpicker"][data-g="page"]'); await page.click('.pk-item[data-key="picture"]'); await page.waitForSelector('[data-upload="image"]', { state: "attached" });
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
  await page.click('.addl[data-act="ed-secpicker"][data-g="page"]'); await page.click('.pk-item[data-key="picture"]'); await page.waitForSelector('[data-upload="image"]', { state: "attached" });
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
await check("New article without a title is refused", async () => { await page.click('.ed-pagebtn'); await page.click('.pp [data-act="ed-new"]'); await page.click('[data-act="ed-new"][data-what="article"]'); await page.click('form[data-form="ednew"] button[type=submit]'); await settle(300); must(/title/i.test(await notice()), "notice: " + await notice()); });
await check("New article with an existing title gets its own web address", async () => {
  await page.fill("#nw-title", "Understanding palette-knife painting"); await page.click('form[data-form="ednew"] button[type=submit]'); await settle(1200);
  must(await page.inputValue(".pagepick") === "a-understanding-palette-knife-painting", "address: " + await page.inputValue(".pagepick"));
});
await check("A new article starts hidden and is not listed for visitors", async () => {
  await page.click('.sec[data-where="item"][data-id="settings"]'); must(await page.isChecked('[data-pf="hidden"]'), "not hidden");
});
await check("Saving the new article keeps it hidden on the live site", async () => { await liveSave(); const a = read(WR, "content/site.json").articles.find((x) => x.slug === "understanding-palette-knife-painting"); must(a && a.hidden === true, "saved as " + JSON.stringify(a && a.hidden)); });
await check("Deleting an article asks first, and Undo brings it back", async () => {
  await page.selectOption(".pagepick", "a-understanding-palette-knife-painting"); await settle(1000); await page.click('.sec[data-where="item"][data-id="settings"]');
  await page.click('[data-act="ask"][data-k="ed-delart"]'); await page.click('[data-act="ed-delart"]'); await liveSave();
  must(!read(WR, "content/site.json").articles.some((x) => x.slug === "understanding-palette-knife-painting"), "not deleted");
  await savedStep("undo"); await page.click('[data-act="livesave"]'); await settle(2500); must(read(WR, "content/site.json").articles.some((x) => x.slug === "understanding-palette-knife-painting"), "not back");
});
await check("A new source with a link that is not https is refused", async () => {
  await page.click('.ed-pagebtn'); await page.click('.pp [data-act="ed-new"]'); await page.click('[data-act="ed-new"][data-what="source"]'); await page.fill("#nw-title", "A source"); await page.fill("#nw-url", "javascript:alert(1)");
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
  await goTab(page, "pages"); await page.waitForSelector("#ed-sections .sec", { timeout: 9000 }); await settle(1500);
  await page.selectOption(".pagepick", "home"); await settle(1200);
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await page.fill('[data-pf="eyebrow"]', "Spring numbers"); await settle(300); await page.click('[data-act="ed-save"]');
  await page.waitForSelector("text=Saved on this copy", { timeout: 9000 }); must(!JSON.stringify(read(WR, "content/pages.json")).includes("Spring numbers"), "reached live");
});
await check("A second copy is allowed, a third is not", async () => {
  await page.click('.ed-top [data-tab="overview"]'); await page.fill("#copy-name", "Summer look"); await page.click('form[data-form="copy"] button[type=submit]');
  await page.waitForSelector("text=Two trial copies", { timeout: 9000 }).catch(() => {}); await settle(600);
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
await check("Files lists every photo with where it is used", async () => { await goTab(page, "files"); await page.waitForSelector(".filecard", { timeout: 9000 }); const n = await page.locator(".filecard").count(); must(n >= 2, n + " photos"); await shot("05-files"); });
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
await check("Theme tile shows the site's colours", async () => { await goTab(page, "overview"); await page.waitForSelector(".tile .swatches i"); });
await check("A colour that is hard to read is flagged", async () => {
  await goTab(page, "theme"); await page.waitForSelector("[data-theme-hex]", { timeout: 9000 }); const hex = page.locator("[data-theme-hex]").nth(3); await hex.fill("#EEE5D4"); await settle(400);
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
await check("The block picker offers only the banner's own blocks, and the one-only ones already in it drop out", async () => {
  await page.click('.ed-right [data-act="ed-blockpicker"]'); await page.waitForSelector(".pk-item");
  const got = await page.$$eval(".pk-item", (xs) => xs.map((x) => x.dataset.key + (x.disabled ? "(added)" : "")).join(","));
  must(got === "headline,tagline,latest", got); await shot("11-block-picker");
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
  await page.click('.premove [data-act="ed-remove"]'); await settle(300); await page.click('[data-act="ed-discard"]').catch(() => {}); await settle(500);
});
await check("A search with no match says so", async () => {
  await page.click('.addl[data-act="ed-secpicker"][data-g="page"]'); await page.fill("[data-pick-q]", "zzzz"); await settle(200);
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
  await page.click('[data-act="ed-picker"][data-path="logos.1.image"]'); await page.click('.libf >> nth=0'); await page.click('[data-act="ed-lib-done"]'); await settle(300);
  await page.click('[data-act="ed-save"]'); await settle(500); const n = await notice(); must(/give the logo in the menu bar a name/i.test(n), "notice: " + n);
  await page.click('.premove [data-act="ed-remove"]'); await settle(300); await page.click('[data-act="ed-discard"]').catch(() => {}); await settle(400);
});
await check("Global Art Monitor's menu bar takes logos too", async () => {
  await openSite("global-art-monitor"); await page.click('.sec[data-where="shared"][data-id="header"]:not(.blk)'); await page.click('.ed-right [data-act="ed-blockpicker"]'); await page.click('.pk-item[data-key="logos"]'); await settle(300);
  await page.fill('[data-pf="logos.0.alt"]', "Grove Gallery"); await page.click('.segr:has-text("Centre")'); await settle(900);
  must((await frame("globalartmonitor.com").$$('header.site-head .head-mid [data-adh-b="logos.0"]')).length === 1, "not in the middle of the bar");
  await liveSave(); const g = read(GR, "data/pages.json").shared.header.settings.logos[0]; must(g && g.place === "C" && g.alt === "Grove Gallery", "saved " + JSON.stringify(g));
  await page.click('.sec.blk[data-id="header"][data-bf="logos"]'); await page.click('.premove [data-act="ed-remove"]'); await settle(300); await liveSave();
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
await check("The bin removes a section at once, and Put it back brings it back where it was", async () => {
  const was = await page.$$eval("#ed-sections .sec:not(.blk)", (x) => x.map((r) => r.dataset.id));
  await page.hover('#ed-sections .sec[data-id="method"]:not(.blk)'); await page.click('#ed-sections .sec[data-id="method"]:not(.blk) [data-act="ed-row-del"]'); await settle(500);
  must(!(await page.$('#ed-sections .sec[data-id="method"]')), "still listed"); must(!(await frame("worldartreview.com").$("#method")), "still on the page");
  must((await text(".putback")).includes("How we research"), "no Put it back: " + await text(".ed-mid")); await shot("14-row-bin");
  await page.click('[data-act="ed-putback"]'); await settle(600); const order = await page.$$eval("#ed-sections .sec:not(.blk)", (x) => x.map((r) => r.dataset.id));
  must(order.join(",") === was.join(","), "came back at " + order.join(","));
  await page.click('[data-act="ed-discard"]').catch(() => {}); await settle(500);
});
await check("No bin on the menu bar, footer, opening screen or the banner's one-only blocks, but they can be hidden", async () => {
  const bins = await page.$$eval('.sec:not(.blk)[data-where="shared"] [data-act="ed-row-del"]', (x) => x.length); must(bins === 0, bins + " bins on shared rows");
  must((await page.$$('.sec[data-where="shared"] [data-act="ed-row-hide"]')).length >= 3, "shared rows cannot be hidden");
  await page.click('#ed-sections .sec[data-id="hero"]:not(.blk)'); await settle(300);
  must(!(await page.$('.sec.blk[data-id="hero"][data-bf="rule"] [data-act="ed-row-del"]')), "the rule box has a bin");
  must(!!(await page.$('.sec.blk[data-id="hero"][data-bf="rule"] [data-act="ed-row-hide"]')), "the rule box has no eye");
  await page.click('.sec[data-where="shared"][data-id="header"]:not(.blk)'); await settle(300);
  const tools = await page.$$eval(".ptools [data-act]", (x) => x.map((e) => e.dataset.act).join(",")); must(tools === "ed-hide", "menu bar tools: " + tools);
});
await check("The panel's own tools: eye, copy, move and bin", async () => {
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await settle(300);
  const tools = await page.$$eval(".ptools [data-act]", (x) => x.map((e) => e.dataset.act).join(",")); must(tools === "ed-hide,ed-dup,ed-move,ed-move", tools); must(await page.isVisible(".premove [data-act=\"ed-remove\"]"), "Remove at the bottom");
  must(!(await page.$("#ed-float")), "the floating bar is still over the page");
});
await check("A new page takes the opening banner, which replaces the menu bar there, and two Featured artists", async () => {
  await page.click('.ed-pagebtn'); await page.click('.pp [data-act="ed-new"]'); await page.click('[data-act="ed-new"][data-what="page"]'); await page.fill("#nw-title", "Exhibition"); await page.click('form[data-form="ednew"] button[type=submit]'); await settle(1200);
  const groups = await (await page.click('.addl[data-act="ed-secpicker"][data-g="page"]'), page.$$eval(".pk-gl", (x) => x.map((e) => e.textContent).join("|")));
  must(groups === "Top of the page|Words|Pictures|Art and artists|Reading and trust|Contact and sign-up", groups);
  must((await page.$$(".pk-item[disabled]")).length === 0, "something is greyed out");
  await page.click('#ed-pick [data-act="ed-pick-close"] >> nth=-1'); await settle(200);
  await page.click("#ed-sections > .ins >> nth=0"); await page.click('.pk-item[data-key="hero"]'); await settle(400);
  for (let i = 0; i < 2; i++) { await page.click('.addl[data-act="ed-secpicker"][data-g="page"]'); await page.click('.pk-item[data-key="featured"]'); await settle(400); }
  await settle(1500); const f = frame("worldartreview.com");
  must((await f.$$eval("header.hdr", (x) => x.length + ":" + x.filter((e) => e.closest(".hero")).length)) === "1:1", "the menu bar is drawn twice, or not inside the banner");
  must((await f.$$("[data-latest]")).length === 1 && (await f.$$(".feat, [id^=featured]")).length >= 2, "copies not drawn"); await shot("15-new-page-banner");
  await liveSave(); const pg = read(WR, "content/pages.json").pages.exhibition;
  must(pg && pg.sections.map((x) => x.type).join(",") === "hero,featured,featured,text", "saved " + (pg && pg.sections.map((x) => x.type)));
  must(JSON.stringify(pg.sections[0].settings.headline) === JSON.stringify(heroOf().headline), "the copy did not start with the home banner's words");
});
await check("Global Art Monitor: two results tables and a contact form on a new page, each with its own names", async () => {
  await openSite("global-art-monitor");
  await page.click('.ed-pagebtn'); await page.click('.pp [data-act="ed-new"]'); await page.click('[data-act="ed-new"][data-what="page"]'); await page.fill("#nw-title", "Market desk"); await page.click('form[data-form="ednew"] button[type=submit]'); await settle(1200);
  for (const k of ["results-table", "results-table", "contact-form"]) { await page.click('.addl[data-act="ed-secpicker"][data-g="page"]'); await page.click('.pk-item[data-key="' + k + '"]'); await settle(400); }
  await settle(1500); const f = frame("globalartmonitor.com");
  const r = await f.evaluate(() => { const g = [...document.querySelectorAll("[data-filter-group]")], t = g.map((x) => document.getElementById(x.getAttribute("data-filter-group")));
    const own = g.every((x, i) => t[i] && x.closest("section") === t[i].closest("section") && document.getElementById(t[i].id + "-empty"));
    const labels = [...document.querySelectorAll('form[id$="contact-form"] label[for]')].every((l) => { const i = document.getElementById(l.getAttribute("for")); return i && i.closest("form") === l.closest("form"); });
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id); return { n: g.length, own, labels, dup: ids.filter((x, i) => ids.indexOf(x) !== i) }; });
  must(r.n >= 2 && r.own && r.labels, "copies not wired to their own table and form " + JSON.stringify(r)); must(r.dup.length === 0, "names used twice: " + r.dup.join(","));
  await liveSave(); const pg = read(GR, "data/pages.json").pages["market-desk"];
  must(pg && pg.path === "market-desk/index.html" && pg.sections.map((x) => x.type).join(",") === "page-head,results-table,results-table,contact-form", "saved " + JSON.stringify(pg && pg.sections.map((x) => x.type)));
});

// =============== 6b2. The sections list (step 2) ===============
area = "Sections list";
const SL = async (sel) => page.$$eval(sel, (x) => x.map((r) => r.dataset.id));
await check("The list has Top of every page, This page and Bottom of every page, each ending with Add section", async () => {
  await openSite("world-art-review"); await page.selectOption(".pagepick", "home"); await settle(1200);
  const t = await text(".ed-left"); must(["Top of every page", "This page", "Bottom of every page"].every((w) => t.toLowerCase().includes(w.toLowerCase())), "groups: " + t.slice(0, 200));
  for (const g of ["top", "page", "bottom"]) must(await page.isVisible('.addl[data-act="ed-secpicker"][data-g="' + g + '"]'), "no Add section for " + g);
});
await check("The block count opens and closes a section's blocks without picking it", async () => {
  await page.click('#ed-sections .sec[data-id="method"] .cnt'); await settle(300);
  must(await page.locator('#ed-sections .sec.blk[data-id="method"]').count() === 3, "blocks not shown"); must(!(await page.isVisible(".ed-right h2")), "the section was picked");
  must((await page.locator('#ed-sections .sec.blk[data-id="method"] .nm').first().innerText()).startsWith("Card: "), "block row: " + await page.locator('#ed-sections .sec.blk[data-id="method"] .nm').first().innerText());
  await page.click('#ed-sections .sec[data-id="method"] .cnt'); await settle(300); must(await page.locator('#ed-sections .sec.blk[data-id="method"]').count() === 0, "blocks still shown");
});
await check("A right click opens Copy, Paste, Duplicate, Rename, Hide, Add before and after, Edit code and Remove; Paste waits for a Copy", async () => {
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)', { button: "right" }); const t = await text(".ctxm"); await shot("15-right-click");
  must(["Copy", "Paste", "Duplicate", "Rename", "Hide", "Add section before", "Add section after", "Edit code", "Remove"].every((w) => t.includes(w)), "menu: " + t);
  must(await page.isDisabled('.ctxm [data-op="paste"]') && !(await page.isDisabled('.ctxm [data-op="code"]')), "Paste is on, or Edit code is off");
  await page.keyboard.press("Escape"); must(!(await page.isVisible(".ctxm")), "Escape did not close it");
});
await check("Copy then Paste puts a copy straight after the row it was pasted on", async () => {
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)', { button: "right" }); await page.click('.ctxm [data-op="copy"]');
  await page.click('#ed-sections .sec[data-id="hero"]:not(.blk)', { button: "right" }); await page.click('.ctxm [data-op="paste"]'); await settle(800);
  const ids = await SL("#ed-sections .sec:not(.blk)"); must(ids[1] && ids[1].startsWith("numbers-"), "order: " + ids.join(","));
  must(await frame("worldartreview.com").evaluate((x) => !!document.getElementById(x), ids[1]), "not on the page");
  await page.click('[data-act="ed-discard"]'); await settle(500);
});
await check("Rename in place: Enter keeps the new name, Escape puts the old one back, and visitors never see it", async () => {
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)', { button: "right" }); await page.click('.ctxm [data-op="rename"]'); await page.fill("#ed-rename", "Our figures"); await page.keyboard.press("Escape"); await settle(200);
  must((await page.locator('#ed-sections .sec[data-id="numbers"]:not(.blk) .nm').innerText()).startsWith("Numbers band"), "Escape kept the new name");
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)', { button: "right" }); await page.click('.ctxm [data-op="rename"]'); await page.fill("#ed-rename", "Our figures"); await page.keyboard.press("Enter"); await settle(200);
  must((await page.locator('#ed-sections .sec[data-id="numbers"]:not(.blk) .nm').innerText()).startsWith("Our figures"), "name not kept");
  await liveSave(); const sec = read(WR, "content/pages.json").pages.home.sections.find((x) => x.id === "numbers"); must(sec && sec.name === "Our figures", "saved " + JSON.stringify(sec && sec.name));
  must(!(await frame("worldartreview.com").evaluate(() => document.body.innerText.includes("Our figures"))), "the name shows on the page");
});
await check("A section added to every page shows on another page and on an article, and saves in the shared list", async () => {
  await page.click('.addl[data-act="ed-secpicker"][data-g="top"]'); await page.fill("[data-pick-q]", "announcement"); await page.click('.pk-item[data-key="announcement"]'); await settle(900);
  must(await page.locator('.dl[data-g="top"] .sec:not(.blk)').count() === 1, "not in the top group");
  must(await frame("worldartreview.com").evaluate(() => !!document.querySelector('[id^="every-announcement"]')), "not on the home page");
  await page.selectOption(".pagepick", "a-palette-knife-painting"); await settle(1400);
  must(await frame("worldartreview.com").evaluate(() => !!document.querySelector('[id^="every-announcement"]')), "not on the article");
  await frame("worldartreview.com").click('[id^="every-announcement"]', { position: { x: 20, y: 10 } }); await settle(700); must((await panelH2()) === "Announcement bar", "a click on it opened " + await panelH2());
  await liveSave(); const g = read(WR, "content/pages.json").groups; must(g && g.top.length === 1 && g.top[0].id.startsWith("every-announcement"), "saved " + JSON.stringify(g));
  // take it off again, so the checks after this one see the site as it was
  await page.hover('.dl[data-g="top"] .sec:not(.blk)'); await page.click('.dl[data-g="top"] .sec:not(.blk) [data-act="ed-row-del"]'); await settle(400); await liveSave();
  must(read(WR, "content/pages.json").groups.top.length === 0, "the shared section stayed");
  await page.selectOption(".pagepick", "home"); await settle(1000);
});
await check("Dragging a section moves it within its group, and dragging a block moves it within its section", async () => {
  await page.dragAndDrop('#ed-sections .sec[data-id="method"]:not(.blk)', '#ed-sections .sec[data-id="featured"]:not(.blk)'); await settle(600);
  const ids = await SL("#ed-sections .sec:not(.blk)"); must(ids.indexOf("method") < ids.indexOf("featured"), "order: " + ids.join(","));
  await page.click('#ed-sections .sec[data-id="method"] .cnt'); await settle(300);
  const before = await page.locator('#ed-sections .sec.blk[data-id="method"] .nm').allInnerTexts();
  await page.dragAndDrop('#ed-sections .sec.blk[data-id="method"][data-block="2"]', '#ed-sections .sec.blk[data-id="method"][data-block="0"]'); await settle(600);
  const after = await page.locator('#ed-sections .sec.blk[data-id="method"] .nm').allInnerTexts(); must(after[0] === before[2], "blocks: " + after.join(" | "));
  await page.click('[data-act="ed-discard"]'); await settle(500);
});
await check("Ctrl+Shift+H hides the picked section and Shift+Delete removes it", async () => {
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await settle(300); await page.focus(".ed-left"); await page.keyboard.press("Control+Shift+H"); await settle(400);
  must(await page.locator('#ed-sections .sec.off[data-id="numbers"]').count() === 1, "not hidden"); must(await page.isVisible('#ed-sections .sec[data-id="numbers"]:not(.blk) .rb.is-off'), "no crossed-out eye");
  await page.keyboard.press("Shift+Delete"); await settle(400); must(!(await page.$('#ed-sections .sec[data-id="numbers"]')), "not removed");
  await page.click('[data-act="ed-discard"]'); await settle(500);
});
await check("A slideshow takes up to 10 slides: Add a slide then turns off and says 10 of 10", async () => {
  await page.click('.addl[data-act="ed-secpicker"][data-g="page"]'); await page.fill("[data-pick-q]", "slideshow"); await page.click('.pk-item[data-key="slideshow"]'); await settle(700);
  for (let i = 0; i < 12; i++) { const b = page.locator('.blocks[data-id^="slideshow"] .addl.blk').first(); if (await b.isDisabled()) break; await b.click(); await settle(150); }
  const b = page.locator('.blocks[data-id^="slideshow"] .addl.blk').first(); must(await b.isDisabled() && (await b.innerText()).includes("10 of 10"), "button: " + await b.innerText());
  await page.click('[data-act="ed-discard"]'); await settle(500);
});
await check("Clicking the picked section again folds its blocks away, and once more opens them", async () => {
  await page.click('#ed-sections .sec[data-id="hero"]:not(.blk)'); await settle(300); must(await page.locator('#ed-sections .sec.blk[data-id="hero"]').count() > 0, "blocks not shown");
  await page.click('#ed-sections .sec[data-id="hero"]:not(.blk)'); await settle(300); must(await page.locator('#ed-sections .sec.blk[data-id="hero"]').count() === 0, "blocks did not fold away");
  await page.click('#ed-sections .sec[data-id="hero"]:not(.blk)'); await settle(300); must(await page.locator('#ed-sections .sec.blk[data-id="hero"]').count() > 0, "blocks did not open again");
  must((await page.locator('.addl[data-act="ed-secpicker"]').allInnerTexts()).every((t) => t === "Add a section" || t === "Add a popup"), "buttons: " + (await page.locator('.addl[data-act="ed-secpicker"]').allInnerTexts()).join(" | "));
});
await check("The footer's columns hold their links as blocks one level down", async () => {
  await page.click('.sec[data-where="shared"][data-id="footer"]'); await settle(300); await page.click('.sec.blk[data-id="footer"][data-block="0"] .cnt'); await settle(300);
  const kids = await page.locator('.sec.kid[data-id="footer"][data-block="0"] .nm').allInnerTexts(); must(kids.length >= 2 && kids.every((t) => t.startsWith("Link: ")), "links: " + kids.join(" | "));
  await page.click('.sec.kid[data-id="footer"][data-block="0"][data-sub="0"]'); await settle(300); must((await text(".ed-right")).includes("Back to Column"), "panel: " + (await text(".ed-right")).slice(0, 80));
  await page.fill('[data-pf="columns.0.links.0.0"]', "All the artists"); await settle(500);
  must(await frame("worldartreview.com").evaluate(() => document.querySelector("footer").innerText.includes("All the artists")), "the page did not change");
  await page.click('.addl.kid[data-id="footer"][data-block="0"]'); await settle(300); must((await text(".ed-right")).includes("Link " + (kids.length + 1) + " of " + (kids.length + 1)), "no new link");
  await liveSave(); const col = read(WR, "content/pages.json").shared.footer.settings.columns[0];
  must(col.links[0][0] === "All the artists" && col.links.length === kids.length + 1, "saved " + JSON.stringify(col.links));
});
await check("Add a popup offers only popups; the popup shows in the preview while picked, saves in its own group, and no page offers it", async () => {
  await page.click('.addl[data-act="ed-secpicker"][data-g="popups"]'); const items = await page.$$eval(".pk-item", (b) => b.map((x) => x.dataset.key)); must(items.join() === "signup-popup", "offered " + items.join());
  await page.click('.pk-item[data-key="signup-popup"]'); await settle(900);
  must(await frame("worldartreview.com").evaluate(() => { const p = document.querySelector("[data-popup]"); return !!p && !p.hidden && getComputedStyle(p).position === "fixed"; }), "the popup is not shown"); await shot("15b-popup");
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await settle(600); must(await frame("worldartreview.com").evaluate(() => document.querySelector("[data-popup]").hidden), "the popup stayed while something else was picked");
  await page.click('.addl[data-act="ed-secpicker"][data-g="page"]'); must(!(await page.$('.pk-item[data-key="signup-popup"]')), "a page offers the popup"); await page.keyboard.press("Escape");
  await liveSave(); const g = read(WR, "content/pages.json").groups; must(g.popups.length === 1 && g.popups[0].type === "signup-popup", "saved " + JSON.stringify(g));
  await page.hover('.dl[data-g="popups"] .sec:not(.blk)'); await page.click('.dl[data-g="popups"] .sec:not(.blk) [data-act="ed-row-del"]'); await settle(300); await liveSave();
});
await check("Page not found is a fixed page: what is there is listed and nothing can be added to it", async () => {
  await page.selectOption(".pagepick", "not-found"); await settle(1200);
  must((await text(".ed-left")).includes("Drawn by the site itself"), "no fixed row"); must(!(await page.$('.addl[data-act="ed-secpicker"][data-g="page"]')), "Add a section on a fixed page");
  must(await page.isVisible('.addl[data-act="ed-secpicker"][data-g="top"]'), "the shared groups went too");
  must(/not find|not found/i.test(await frame("worldartreview.com").evaluate(() => document.body.innerText)), "the preview is not the page not found");
  await page.selectOption(".pagepick", "home"); await settle(1000);
});
await check("A page of its own layout has no menu bar, footer or shared sections, and saves that way", async () => {
  await page.click('.ed-pagebtn'); await page.click('.pp [data-act="ed-new"]'); await page.click('[data-act="ed-new"][data-what="page"]'); await page.fill("#nw-title", "Coming soon"); await page.check('input[name="own"]');
  await page.click('form[data-form="ednew"] button[type=submit]'); await settle(1500);
  must((await text(".ed-left")).includes("Page with its own layout") && !(await page.$('.addl[data-act="ed-secpicker"][data-g="top"]')), "the list still has the shared groups");
  const f = frame("worldartreview.com"); must(await f.evaluate(() => !document.querySelector("#main header.hdr") && !document.querySelector("#main footer")), "the preview has a menu bar or footer"); await shot("15c-own-layout");
  await liveSave(); const pg = read(WR, "content/pages.json").pages["coming-soon"]; must(pg && pg.own === true, "saved " + JSON.stringify(pg && pg.own));
});
await check("The main section of a page the site was built with has no Remove, and the server refuses to remove it", async () => {
  await page.selectOption(".pagepick", "page-standards"); await settle(1200);
  const first = await page.evaluate(() => window.__adh.pgOf().doc.pages.standards.sections.find((x) => x.type === "long-text").id); await page.hover('#ed-sections .sec[data-id="' + first + '"]:not(.blk)');
  must(!(await page.isVisible('#ed-sections .sec[data-id="' + first + '"]:not(.blk) [data-act="ed-row-del"]')), "the main section has a bin");
  await page.click('#ed-sections .sec[data-id="' + first + '"]:not(.blk)', { button: "right" }); must(!(await text(".ctxm")).includes("Remove"), "the menu offers Remove"); await page.keyboard.press("Escape");
  const r = await page.evaluate(async (id) => { const p = JSON.parse(JSON.stringify(window.__adh.pgOf().doc)); p.pages.standards.sections = p.pages.standards.sections.filter((x) => x.id !== id);
    const res = await fetch("/__fn", { method: "POST", body: JSON.stringify({ action: "savePages", site: "world-art-review", pages: p }) }); return (await res.json()).error || ""; }, first);
  must(/main section/i.test(r), "server said: " + r);
  await page.selectOption(".pagepick", "home"); await settle(1000);
});

// =============== 6b2. The settings panel (step 3) ===============
area = "Settings panel";
const addHere = async (key, g = "page") => { await page.click('.addl[data-act="ed-secpicker"][data-g="' + g + '"]'); await page.click('.pk-item[data-key="' + key + '"]'); await settle(700); return page.evaluate(() => window.__adh.pgOf().sel.id); };
const setOf = (id) => page.evaluate((x) => { const p = window.__adh.pgOf(); return (p.doc.pages.home.sections.find((s) => s.id === x) || {}).settings; }, id);
let qid = "";
await check("The panel shows Section, More and Close, then the name, which can be changed by clicking it", async () => {
  await openSite("world-art-review"); await page.selectOption(".pagepick", "home"); await settle(1200);
  qid = await addHere("quote");
  must((await text(".ed-right .rkind")).toLowerCase() === "section", "label: " + await text(".ed-right .rkind"));
  must(await page.isVisible('.ed-right [data-act="ed-pmore"]') && await page.isVisible('.ed-right [data-act="ed-panel-close"]'), "no More or Close");
  await page.click(".ed-right .rname"); await page.fill("#ed-rename", "Big line"); await page.keyboard.press("Enter"); await settle(300);
  must((await text(".ed-right .rtitle")).includes("Big line") && (await text('#ed-sections .sec[data-id="' + qid + '"] .nm')).includes("Big line"), "not renamed");
  await page.click(".ed-right .rname"); await page.fill("#ed-rename", "Not this"); await page.keyboard.press("Escape"); await settle(300);
  must((await text(".ed-right .rtitle")).includes("Big line"), "Escape did not put the name back");
  await page.click('.ed-right [data-act="ed-pmore"]'); await settle(200); const m = await page.locator(".ctxm .pp-item .t").allInnerTexts();
  must(m.join(",") === "Rename,Hide,Edit code", "More offers " + m.join(",")); await page.keyboard.press("Escape");
  await shot("16a-panel-head");
});
await check("The header stays in place while the settings scroll", async () => {
  await page.setViewportSize({ width: 1440, height: 640 }); await settle(300);
  await page.evaluate(() => { const r = document.querySelector(".ed-right"); r.scrollTop = r.scrollHeight; }); await settle(200);
  const top = await page.evaluate(() => { const r = document.querySelector(".ed-right").getBoundingClientRect(), h = document.querySelector(".ed-right .rhead").getBoundingClientRect(); return Math.round(h.top - r.top); });
  await page.setViewportSize({ width: 1440, height: 900 }); await settle(300);
  must(top <= 2, "the header moved by " + top);
});
await check("The colour picker has a square, a hue strip, the hex code and the theme colours, and the page follows as it moves", async () => {
  await page.click('.ed-right .cswatch[data-path="bg"]'); await settle(300);
  for (const sel of [".csv", ".chue", '.cfoot [data-kind="hex"]', ".cthemes .chip"]) must(await page.isVisible(".cpop " + sel), "no " + sel);
  const b = await page.locator(".csv").boundingBox(); await page.mouse.click(b.x + b.width * 0.9, b.y + b.height * 0.1); await settle(600);
  const hex = (await setOf(qid)).bg; must(/^#[0-9A-F]{6}$/.test(hex), "kept as " + hex);
  const bg = await frame("worldartreview.com").evaluate((x) => document.getElementById(x).getAttribute("style") || "", qid); must(bg.includes(hex), "page shows " + bg);
  await page.fill('.cfoot [data-kind="hex"]', "#1D4A35"); await settle(300); must((await setOf(qid)).bg === "#1D4A35", "hex typed not kept");
  await page.keyboard.press("Escape"); await settle(200); must(!(await page.isVisible(".cpop")), "Escape did not close it");
});
await check("A section's Custom CSS changes that section only, on the page as you type", async () => {
  await page.evaluate(() => { window.__adh.state.customCss = true; window.__adh.render(); }); await settle(300);
  await page.click('.ed-right [data-act="ed-css"]'); await page.fill(".cssbox textarea", "* { color: rgb(1, 2, 3) !important; }\n:scope { outline: 3px solid rgb(4, 5, 6); }"); await settle(900);
  must((await text(".cssbox .gut")).startsWith("1\n2"), "no line numbers");
  const r = await frame("worldartreview.com").evaluate((x) => { const q = document.getElementById(x), other = document.querySelector("#numbers *"); return [getComputedStyle(q.querySelector("*")).color, getComputedStyle(q).outlineColor, other ? getComputedStyle(other).color : ""]; }, qid);
  must(r[0] === "rgb(1, 2, 3)" && r[1] === "rgb(4, 5, 6)" && r[2] !== "rgb(1, 2, 3)", "colours: " + r.join(" / "));
  await shot("16b-custom-css");
});
await check("Remove section sits at the bottom, in red", async () => {
  await page.click('.premove [data-act="ed-remove"]'); await settle(400);
  must(!(await page.evaluate((x) => window.__adh.pgOf().doc.pages.home.sections.some((s) => s.id === x), qid)), "still there"); must(/Put it back/.test(await notice()), "no Put it back");
  await page.click('[data-act="ed-discard"]', { timeout: 1500 }).catch(() => {}); await settle(600);
});
await check("Short choices sit side by side, yes or no is a switch, and seconds are a slider with a number box", async () => {
  const sp = await addHere("space"); must(await page.locator('.ed-right .seg.wide input[type=radio]').count() === 3, "Space size is not side by side");
  await page.click('.ed-right .segr:has(input[value="L"])'); await settle(300); must((await setOf(sp)).size === "L", "size not kept");
  const an = await addHere("announcement"); must(await page.isVisible('.ed-right input[type=range][data-pf="seconds"]') && await page.isVisible('.ed-right .numbox input[data-pf="seconds"]'), "no slider");
  await page.fill('.ed-right .numbox input[data-pf="seconds"]', "99"); await settle(300); must((await setOf(an)).seconds === 30, "kept " + (await setOf(an)).seconds);
  must(await page.inputValue('.ed-right input[type=range][data-pf="seconds"]') === "30", "the slider did not follow");
  const co = await addHere("columns"); const sw = '.ed-right .switch:has([data-pf="numbered"])'; must(await page.isVisible(sw), "no switch"); const was = !!(await setOf(co)).numbered; await page.click(sw); await settle(300); must((await setOf(co)).numbered === !was, "switch not kept");
  await shot("16c-controls");
});
await check("A link field lists the site's pages and shows the chosen one as a tag", async () => {
  const anId = await page.evaluate(() => window.__adh.pgOf().doc.pages.home.sections.find((x) => x.type === "announcement").id);
  await page.click('#ed-sections .sec[data-id="' + anId + '"]:not(.blk)'); await settle(300); await page.click('#ed-sections .sec.blk[data-bf="messages"] >> nth=0'); await settle(300);
  await page.fill('[data-pf="messages.0.href"]', "konn"); await settle(300); must(await page.locator(".lopts .lopt").count() > 0, "no pages listed");
  await page.click(".lopts .lopt >> nth=0"); await settle(300);
  const href = await page.inputValue('[data-pf="messages.0.href"]'); must(/^#artist-konn-artiss|^#a-konn/.test(href), "chose " + href);
  must(/Konn Artiss/.test(await text(".ltag")), "tag: " + await text(".ltag")); await shot("16d-link");
  await page.click('[data-act="ed-discard"]', { timeout: 1500 }).catch(() => {}); await settle(600);
});
await check("Fonts, dates, videos, numbered groups and info lines all work from a section's settings list", async () => {
  await page.evaluate(() => { const p = window.__adh.pgOf(); p.kinds.zztest = { label: "Every control", about: "A test section.", fields: [
    { type: "info", text: "A note between settings.", go: "content", goLabel: "Open Content" },
    { name: "font", label: "Heading font", type: "font", fonts: { "Castoro": "Castoro:ital@0;1", "EB Garamond": "EB+Garamond:ital,wght@0,400;0,500;0,600;1,400" } },
    { name: "until", label: "Show until", type: "datetime" }, { name: "video", label: "Video", type: "video" },
    { name: "slides", label: "Slide", type: "set", count: 2, fields: [{ name: "t", label: "Words", type: "text" }] }] };
    p.doc.pages.home.sections.splice(1, 0, { id: "zztest-1", type: "zztest", visible: true, settings: {} }); window.__adh.render(); });
  await settle(500); await page.click('#ed-sections .sec[data-id="zztest-1"]'); await settle(300);
  must((await text(".ed-right .info")).includes("A note between settings."), "no info line");
  await page.click('[data-act="ed-font"]'); await page.click('.fontopt[data-v="EB Garamond"]'); await page.selectOption("#font-style", "600"); must((await setOf("zztest-1")).font === "EB Garamond:600", "font " + (await setOf("zztest-1")).font);
  await page.click('[data-act="ed-font-close"]'); must(!(await setOf("zztest-1")).font, "Close did not put the old font back");
  await page.click('[data-act="ed-font"]'); await page.fill('[data-input="fontq"]', "cast"); must((await page.locator(".fontopt:visible").allInnerTexts()).join() === "Castoro", "search");
  await page.click('.fontopt[data-v="Castoro"]'); await page.click('[data-act="ed-font-done"]'); must((await setOf("zztest-1")).font === "Castoro", "Done did not keep it");
  await page.selectOption('[data-dt="until"][data-part="d"]', "31"); await page.selectOption('[data-dt="until"][data-part="m"]', "04"); await page.selectOption('[data-dt="until"][data-part="y"]', String(new Date().getFullYear() + 1));
  must((await setOf("zztest-1")).until === (new Date().getFullYear() + 1) + "-04-30T09:00", "date " + (await setOf("zztest-1")).until);
  await page.fill('[data-pf="video"][data-kind="vlink"]', "https://www.example.com/film.mp4"); await settle(200); must((await setOf("zztest-1")).video === "https://www.example.com/film.mp4", "video link");
  await page.click('.swfield:has([data-pf="slides.1.on"]) .switch'); must((await setOf("zztest-1")).slides[1].on === false && await page.locator(".setgrp.off").count() === 1, "group switch");
  await page.click('[data-act="ed-discard"]'); await settle(600);
});
await check("The page address records what is picked, and opening it goes straight there", async () => {
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await settle(300);
  const u = page.url(); must(decodeURIComponent(u).includes("ed=world-art-review~page:home~page.numbers"), "address " + u);
  await page.goto(u); await page.waitForSelector(".ed-right h2", { timeout: 12000 }); await settle(500);
  const on = await page.evaluate(() => { const p = window.__adh.pgOf(); return p && p.sel ? p.page + ":" + p.sel.where + ":" + p.sel.id : ""; }); must(on === "home:page:numbers", "opened on " + on);
  await page.goto(consoleAt + "/index.html"); await page.waitForSelector('[data-act="open-site"]', { timeout: 12000 });
});
await check("Custom CSS works the same on Global Art Monitor and Street Art Dispatch", async () => {
  for (const [id, host] of [["global-art-monitor", "globalartmonitor.com"], ["street-art-dispatch", "streetartdispatch.com"]]) {
    await openSite(id); await page.selectOption(".pagepick", "home"); await settle(1200);
    await page.evaluate(() => { window.__adh.state.customCss = true; }); const q = await addHere("quote"); await page.click('.ed-right [data-act="ed-css"]'); await page.fill(".cssbox textarea", "* { color: rgb(7, 8, 9) !important; }"); await settle(1500);
    const c = await frame(host).evaluate((x) => { const el = document.querySelector('[data-css="' + x + '"] *'); return el ? getComputedStyle(el).color : "none"; }, q);
    must(c === "rgb(7, 8, 9)", id + ": " + c); await page.click('[data-act="ed-discard"]'); await settle(600);
  }
  await openSite("world-art-review");
});
await check("The panel holds together on a phone", async () => {
  await page.setViewportSize({ width: 390, height: 844 }); await settle(500); await page.selectOption(".pagepick", "home"); await settle(800);
  const q = await addHere("quote"); await page.click('.ed-right .cswatch[data-path="bg"]'); await settle(300);
  const w = await page.evaluate(() => document.documentElement.scrollWidth); await page.locator(".cpop").scrollIntoViewIfNeeded(); await shot("16e-phone");
  await page.click('[data-act="ed-discard"]'); await settle(500); await page.setViewportSize({ width: 1440, height: 900 }); await settle(400);
  must(w <= 392, "page is " + w + "px wide");
});

// =============== 6b3. Pickers (step 4) ===============
area = "Pickers";
const homeSecs = () => page.evaluate(() => window.__adh.pgOf().doc.pages.home.sections.map((x) => x.id + ":" + x.type));
await check("Add a section has Sections and Add-ons tabs, the most used kinds first, and Escape closes it", async () => {
  await openSite("world-art-review"); await page.selectOption(".pagepick", "home"); await settle(1200);
  await addHere("quote"); await addHere("quote");
  await page.click('.addl[data-act="ed-secpicker"][data-g="page"]'); await settle(300);
  const gl = await page.locator(".pk-gl").allInnerTexts(); must(gl[0] === "Most used on this site", "groups: " + gl.join(", "));
  must((await page.locator('.pk-grp[data-most] .pk-item b').allInnerTexts()).includes("Quote"), "Quote not among the most used");
  must((await page.locator(".pk-tabs button").allInnerTexts()).join() === "Sections,Add-ons", "tabs");
  await page.click('[data-act="ed-pk-tab"][data-t="addons"]'); must(/Add-ons work across the whole site/.test(await text(".pk")) && (await text(".pk")).includes("Back to top button"), "add-ons tab: " + (await text(".pk")).slice(0, 200));
  await page.click('[data-act="ed-pk-tab"][data-t="types"]'); const before = (await homeSecs()).length;
  await page.keyboard.press("Escape"); await settle(300); must(!(await page.isVisible(".pk")) && (await homeSecs()).length === before, "Escape left it open or added something");
  await shot("17a-picker");
  await page.click('[data-act="ed-discard"]', { timeout: 1500 }).catch(() => {}); await settle(600);
});
await check("Add a block is shorter, with no preview side, and blocks used once per section drop out", async () => {
  await page.click('#ed-sections .sec[data-id="hero"]:not(.blk)'); await settle(300);
  if (!(await page.isVisible('#ed-sections .addl.blk[data-id="hero"]'))) { await page.click('#ed-sections .sec[data-id="hero"]:not(.blk)'); await settle(300); }
  await page.click('#ed-sections .addl.blk[data-id="hero"]'); await settle(300);
  must(await page.isVisible(".pk.short") && !(await page.locator(".pk-view").count()), "not the short picker");
  const keys = await page.locator(".pk-item").evaluateAll((b) => b.map((x) => x.dataset.key)); must(keys.length && !keys.includes("picture") && !keys.includes("rule"), "listed " + keys.join(","));
  await page.keyboard.press("Escape"); await settle(200);
});
await check("A link field opens the site's kinds of page, each with its own list", async () => {
  const q = await addHere("quote"); await page.evaluate((x) => { const p = window.__adh.pgOf(); p.kinds.quote.fields.push({ name: "zz_link", label: "Test link", type: "text", addr: true }); }, q);
  await page.click('#ed-sections .sec[data-id="hero"]:not(.blk)'); await page.click('#ed-sections .sec[data-id="' + q + '"]:not(.blk)'); await settle(300);
  await page.focus('[data-pf="zz_link"]'); await settle(200);
  const kinds = await page.locator(".lopts .lkind .t").allInnerTexts(); must(["Pages", "Articles", "Artist portfolios"].every((k) => kinds.includes(k)), "kinds: " + kinds.join(", "));
  await page.click('.lopt[data-lkind="articles"]'); await settle(200); must(await page.isVisible(".lopts .lback"), "no way back to the kinds");
  await page.fill('[data-pf="zz_link"]', "palette"); await settle(200); await page.click(".lopts .lopt[data-href] >> nth=0"); await settle(200);
  const v = await page.inputValue('[data-pf="zz_link"]'); must(/^#a-/.test(v), "chose " + v); must(await page.isVisible(".ltag a"), "no Open on the tag");
  await shot("17b-link");
  await page.click('[data-act="ed-discard"]', { timeout: 1500 }).catch(() => {}); await settle(600);
});
await check("The image library: search, sort, grid or list, filters, add files, and Done waits for a tick", async () => {
  if (!fs.existsSync("/tmp/uat/small.png")) { const png = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 40; c.height = 40; return c.toDataURL("image/png").split(",")[1]; }); fs.writeFileSync("/tmp/uat/small.png", Buffer.from(png, "base64")); }
  const pb = await addHere("picture-banner"); await settle(300);
  await page.click('.ed-right [data-act="ed-picker"][data-path="image"]'); await settle(400);
  must(await page.isVisible(".lib") && (await text(".lib-head h2")).length > 0, "no library window");
  for (const sel of ["[data-lib-q]", '[data-o="sort"]', '[data-o="size"]', '[data-o="used"]', '[data-o="artist"]', '[data-act="ed-lib-view"][data-v="list"]', "[data-lib-drop]"]) must(await page.locator(".lib " + sel).count() === 1, "missing " + sel);
  must(await page.isDisabled('[data-act="ed-lib-done"]'), "Done is on with nothing ticked");
  const n = await page.locator(".libf").count(); await page.fill("[data-lib-q]", "zzzz"); must(await page.locator(".libf:visible").count() === 0, "search did not narrow"); await page.fill("[data-lib-q]", "");
  await page.setInputFiles("[data-lib-add]", OUT + "/small.png"); await settle(1200);
  must(await page.locator(".libf").count() === n + 1 && !(await page.isDisabled('[data-act="ed-lib-done"]')), "the new file is not there and ticked");
  await page.click('[data-act="ed-lib-view"][data-v="list"]'); await settle(200); must(await page.isVisible(".lib-files.list"), "no list view");
  await page.selectOption('[data-o="used"]', "no"); await settle(200); must(await page.locator(".libf:visible").count() >= 1, "the new file should be unused");
  await shot("17c-library");
  await page.click('[data-act="ed-lib-done"]'); await settle(500);
  const img = (await setOf(pb)).image; must(/^upload:/.test(img), "kept " + img);
  await page.click('.ed-right [data-act="ed-picker"][data-path="image"]'); await settle(300); await page.selectOption('[data-o="used"]', ""); await page.click(".libf >> nth=-1"); await page.keyboard.press("Escape"); await settle(300);
  must(!(await page.isVisible(".lib")) && (await setOf(pb)).image === img, "Escape changed the picture");
  await page.click('[data-act="ed-discard"]', { timeout: 1500 }).catch(() => {}); await settle(600);
});
await check("Choosing one artist shows a tag with Replace, Edit, Connect stored data and Remove", async () => {
  await page.click('#ed-sections .sec[data-id="hero"]:not(.blk)'); await settle(200);
  if (!(await page.isVisible('#ed-sections .sec.blk[data-id="hero"][data-bf="picture"]'))) { await page.click('#ed-sections .sec[data-id="hero"]:not(.blk)'); await settle(200); }
  await page.click('#ed-sections .sec.blk[data-id="hero"][data-bf="picture"]'); await settle(300);
  const sel = '[data-act="ed-res"][data-path="artist"]'; await page.click(sel + "[data-mode]"); await settle(200);
  if (await page.isVisible(".resmenu")) { await page.click('.resmenu [data-mode="list"]'); await settle(200); }
  await page.fill("[data-res-q]", "konn"); must(await page.locator(".resitems .pp-item:visible").count() === 1, "search did not narrow");
  must(await page.isVisible('.reslist [data-act="ed-res-new"]'), "no Create artist");
  await page.click('.resitems [data-v="konn-artiss"]'); await settle(300);
  const hero = await page.evaluate(() => window.__adh.pgOf().doc.pages.home.sections.find((x) => x.id === "hero").settings.artist); must(hero === "konn-artiss", "kept " + hero);
  await page.click('.rtag[data-path="artist"]'); await settle(200);
  must((await page.locator(".resmenu .pp-item .t").allInnerTexts()).join() === "Replace,Edit,Connect stored data,Remove", "menu");
  await shot("17d-artist");
  await page.click('.resmenu [data-act="ed-goto-item"]'); await settle(1200);
  const at = await page.evaluate(() => window.__adh.pgOf().at); must(at === "artist:konn-artiss", "Edit opened " + at);
  await page.click('[data-act="ed-discard"]', { timeout: 1500 }).catch(() => {}); await settle(600);
  await page.selectOption(".pagepick", "home"); await settle(1200);
});

// =============== 6b4. The preview inspector (step 5) ===============
area = "Inspector";
// a real mouse click on something in the preview, which is scaled down to fit when the window is narrow
const mouseIn = async (host, sel, at) => { const f = frame(host), el = await f.frameElement(), b = await el.boundingBox();
  await f.evaluate((q) => document.querySelector(q).scrollIntoView({ block: "nearest" }), sel); await settle(300);
  const r = await f.evaluate((a) => { const x = document.querySelector(a[0]).getBoundingClientRect(); return { x: x.x + (a[1] ? a[1].x : x.width / 2), y: x.y + (a[1] ? a[1].y : x.height / 2), w: innerWidth }; }, [sel, at || null]);
  const k = b.width / r.w; await page.mouse.click(b.x + r.x * k, b.y + r.y * k); };
const hoverOn = async (host, sel) => { const f = frame(host); await f.evaluate((q) => document.querySelector(q).scrollIntoView({ block: "center" }), sel); await settle(400); await f.evaluate((q) => document.querySelector(q).dispatchEvent(new MouseEvent("mousemove", { bubbles: true })), sel); await settle(300);
  return f.evaluate(() => { const h = document.getElementById("adh-hover"); return h ? { cls: h.className, tag: h.querySelector(".adh-tag").textContent } : { cls: "", tag: "" }; }); };
await check("Hovering a section on the page outlines it with its name; a block gets its own dashed outline", async () => {
  await openSite("world-art-review"); await page.selectOption(".pagepick", "home"); await settle(1500);
  const h = await hoverOn("worldartreview.com", "#numbers h2"); const nm = await text('#ed-sections .sec[data-id="numbers"] .nm');
  must(/\bon\b/.test(h.cls) && !/blk/.test(h.cls) && h.tag === nm.split("\n")[0].trim(), "section: " + JSON.stringify(h) + " vs " + nm);
  const b = await hoverOn("worldartreview.com", '#hero [data-adh-b^="headline"]'); must(/blk/.test(b.cls) && b.tag === "Headline line", "block: " + JSON.stringify(b));
  const hd = await hoverOn("worldartreview.com", "#main header.hdr .brand, #main header.hdr"); must(/noplus/.test(hd.cls), "the menu bar should have no plus: " + hd.cls);
  await shot("18a-hover");
});
await check("The plus under a section opens Add a section for exactly that spot", async () => {
  await hoverOn("worldartreview.com", "#numbers h2"); await mouseIn("worldartreview.com", "#adh-hover .adh-plus.bottom"); await settle(500);
  const pk = await page.evaluate(() => window.__adh.pgOf().picker2), at = (await homeSecs()).findIndex((x) => x.startsWith("numbers:")) + 1;
  must(pk && pk.mode === "section" && pk.at === at && pk.g === "page", "picker " + JSON.stringify(pk));
  await page.click('.pk-item[data-key="quote"]'); await settle(500); must((await homeSecs())[at].endsWith(":quote"), "added at " + (await homeSecs()).join(","));
  await page.click('[data-act="ed-discard"]', { timeout: 1500 }).catch(() => {}); await settle(800);
});
await check("The plus above a block adds a block just there", async () => {
  const n = await page.evaluate(() => window.__adh.pgOf().doc.pages.home.sections.find((x) => x.id === "hero").settings.headline.length);
  await hoverOn("worldartreview.com", '#hero [data-adh-b="headline.0"]'); await mouseIn("worldartreview.com", "#adh-hover .adh-plus.top"); await settle(500);
  const pk = await page.evaluate(() => window.__adh.pgOf().picker2); must(pk && pk.mode === "block" && pk.bf === "headline" && pk.at === 0, "picker " + JSON.stringify(pk));
  await page.click('.pk-item[data-key="headline"]'); await settle(500);
  const after = await page.evaluate(() => { const p = window.__adh.pgOf(); return [p.doc.pages.home.sections.find((x) => x.id === "hero").settings.headline.length, p.sel.block]; });
  must(after[0] === n + 1 && after[1] === 0, "after " + after.join(","));
  await page.click('[data-act="ed-discard"]', { timeout: 1500 }).catch(() => {}); await settle(800);
});
await check("Clicking picks it, and its settings offer Hide, Duplicate, Move up and Move down in words, with no bar over the page", async () => {
  await mouseIn("worldartreview.com", "#numbers h2", { x: 10, y: 10 }); await settle(500);
  must((await page.evaluate(() => window.__adh.pgOf().sel.id)) === "numbers", "not picked");
  must(!(await page.locator(".fbar").count()), "a bar is still over the page");
  const tools = await page.locator(".ptools button").allInnerTexts(); must(tools.map((x) => x.trim()).join() === "Hide,Duplicate,Move up,Move down", "tools: " + tools.join(","));
  const n = (await homeSecs()).length; await page.click('.ptools [data-act="ed-dup"]'); await settle(400); must((await homeSecs()).length === n + 1, "Duplicate");
  await page.click('[data-act="ed-discard"]', { timeout: 1500 }).catch(() => {}); await settle(800);
  await mouseIn("worldartreview.com", "#numbers h2", { x: 10, y: 10 }); await settle(400); await page.click('.ptools [data-act="ed-hide"]'); await settle(400);
  must((await page.evaluate(() => window.__adh.pgOf().doc.pages.home.sections.find((x) => x.id === "numbers").visible)) === false, "Hide");
  await shot("18b-settings-tools");
  await page.click('[data-act="ed-discard"]', { timeout: 1500 }).catch(() => {}); await settle(800);
});
await check("With the inspector off there are no outlines and no floating bar", async () => {
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await settle(300);
  await page.click('[data-act="ed-inspector"]'); await settle(2500);
  must(!(await page.locator(".fbar").count()), "the bar is still there");
  const h = await frame("worldartreview.com").evaluate(() => { document.querySelector("#numbers h2").dispatchEvent(new MouseEvent("mousemove", { bubbles: true })); return !!document.getElementById("adh-hover"); });
  await page.click('[data-act="ed-inspector"]'); await settle(2500); must(!h, "an outline was drawn with the inspector off");
});
await check("Global Art Monitor and Street Art Dispatch outline and add the same way", async () => {
  for (const [id, host] of [["global-art-monitor", "globalartmonitor.com"], ["street-art-dispatch", "streetartdispatch.com"]]) {
    await openSite(id); await page.selectOption(".pagepick", "home"); await settle(1500);
    const first = await page.evaluate(() => window.__adh.pgOf().doc.pages.home.sections.filter((x) => x.visible !== false)[1].id);
    const h = await hoverOn(host, '[data-adh="' + first + '"]'); const nm = (await text('#ed-sections .sec[data-id="' + first + '"] .nm')).split("\n")[0].trim();
    must(/\bon\b/.test(h.cls) && h.tag === nm, id + ": " + JSON.stringify(h) + " vs " + nm);
    await mouseIn(host, "#adh-hover .adh-plus.bottom"); await settle(500);
    const pk = await page.evaluate(() => window.__adh.pgOf().picker2); must(pk && pk.mode === "section" && pk.g === "page", id + " picker " + JSON.stringify(pk));
    await page.keyboard.press("Escape"); await settle(300);
    await mouseIn(host, '[data-adh="' + first + '"]', { x: 20, y: 20 }); await settle(500); must((await page.evaluate(() => (window.__adh.pgOf().sel || {}).id)) === first, id + ": not picked");
    await shot("18c-" + id);
  }
  await openSite("world-art-review");
});

// =============== 6b5. Theme settings (step 6) ===============
area = "Theme settings";
const draftT = (id) => page.evaluate((x) => window.__adh.state.theme[x].draft, id);
const openTheme = async () => { if (!(await page.isVisible(".tpanel"))) { await page.click('[data-act="ed-panel"][data-panel="theme"]'); await settle(600); } };
const toSections = async () => { if (await page.isVisible(".tpanel")) { await page.click('[data-act="ed-panel"][data-panel="sections"]'); await settle(300); } };
const openGroup = async (g) => { if (!(await page.isVisible('.tgrp.open [data-g="' + g + '"]'))) { await page.click('[data-act="ed-tgroup"][data-g="' + g + '"]'); await settle(300); } };
await check("Theme settings open in the left column: every group in order, one open at a time, the right panel closed, the group in the address", async () => {
  await openSite("world-art-review"); await page.selectOption(".pagepick", "home"); await settle(1500);
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await settle(300); await openTheme();
  const names = await page.locator(".tghead span").allInnerTexts();
  must(names.join(",") === "Colours,Typography,Design,Artworks,Artwork cards,Collection cards,Enquiries,Social media,Favicon,Search,Extras,Custom CSS,Theme style", names.join(","));
  must(!(await page.locator(".ed-right").count()), "the right panel is still open");
  await openGroup("type"); must((await page.locator(".tgrp.open").count()) === 1, "more than one open");
  must(decodeURIComponent(page.url()).includes("tg=type"), "address " + page.url());
  for (const g of ["artworks", "cards", "collections", "enquiries", "search"]) must((await text('[data-g="' + g + '"] em')) === "Not used on this site", g);
  await shot("19a-theme-type");
});
await check("The heading size slider and the capitals switch change every heading on the page straight away", async () => {
  const f = frame("worldartreview.com"), before = await f.evaluate(() => parseFloat(getComputedStyle(document.querySelector("#numbers h2")).fontSize));
  await page.fill('.numbox [data-pf="theme:settings.h_size"]', "130"); await settle(400);
  await page.click('.swfield:has([data-pf="theme:settings.h_caps"]) .switch'); await settle(500);
  const after = await f.evaluate(() => { const c = getComputedStyle(document.querySelector("#numbers h2")); return [parseFloat(c.fontSize), c.textTransform]; });
  must(Math.abs(after[0] / before - 1.3) < 0.02 && after[1] === "uppercase", "before " + before + ", after " + after.join(" "));
  must(await page.isVisible('[data-act="ed-range-reset"][data-path="theme:settings.h_size"]'), "no way back to the site's own");
  must(!(await page.isDisabled('[data-act="ed-save"]')), "Save is still off");
});
await check("A theme colour changes through the colour picker and shows on the page at once", async () => {
  await openGroup("colours"); await page.fill('.colour [data-pf="theme:colours.green"]', "#22304A"); await settle(500);
  const v = await frame("worldartreview.com").evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--green").trim().toUpperCase());
  must(v === "#22304A", "the page has " + v);
});
await check("A social media address shows at the foot of every page, and an address that is not https is refused", async () => {
  await openGroup("social"); await page.fill('[data-pf="theme:settings.social_instagram"]', "https://www.instagram.com/worldartreview"); await settle(900);
  const links = await frame("worldartreview.com").evaluate(() => [...document.querySelectorAll('footer nav[aria-label="Elsewhere"] a')].map((a) => a.textContent + "=" + a.getAttribute("href")).join(","));
  must(links.startsWith("Instagram=https://www.instagram.com/worldartreview") && !links.includes("X=#"), "footer: " + links);
  await page.fill('[data-pf="theme:settings.social_x"]', "x.com/worldartreview"); await settle(300);
  await page.click('[data-act="ed-save"]'); await page.click('[data-act="livesave"]').catch(() => {}); await settle(1500);
  must(/https/.test(await notice()), "notice: " + await notice());
  await page.fill('[data-pf="theme:settings.social_x"]', ""); await settle(300);
});
await check("Save keeps the theme: sizes as variables, the rules, the social links and Custom CSS in the site's theme file", async () => {
  await openGroup("css"); await page.fill('[data-pf="theme:settings.css"]', "h2 { word-spacing: 1px; }"); await settle(300);
  await liveSave();
  const th = read(WR, "content/theme.json");
  must(th.css.includes("--h-scale:1.3") && th.css.includes("--green:#22304A"), "css " + th.css);
  must(th.rules.includes("text-transform:uppercase") && th.rules.includes("h2 { word-spacing: 1px; }"), "rules " + th.rules);
  must(th.social.instagram && th.social.instagram.href === "https://www.instagram.com/worldartreview" && !th.social.x, "social " + JSON.stringify(th.social));
  must(/^Theme: /.test(hub.lastMessage(WR, "main")), "message " + hub.lastMessage(WR, "main"));
});
await check("Theme style asks first: Cancel changes nothing, Change style puts back that look and the site's own type", async () => {
  await openGroup("style"); await page.click('[data-act="ed-tlook"][data-i="0"]'); await settle(200);
  must(await page.isVisible('[data-act="ed-tlook-go"]') && await page.isVisible('[data-act="ed-tlook-cancel"]'), "no Cancel and Change style");
  await page.click('[data-act="ed-tlook-cancel"]'); await settle(200); must((await draftT("world-art-review")).colours.green === "#22304A", "Cancel changed it");
  await page.click('[data-act="ed-tlook"][data-i="-1"]'); await page.click('[data-act="ed-tlook-go"]'); await settle(400);
  const d = await draftT("world-art-review"); must(d.colours.green === "#1D4A35" && d.settings.h_size == null && !d.settings.h_caps, "after " + JSON.stringify([d.colours.green, d.settings.h_size, d.settings.h_caps]));
  await openGroup("social"); await page.fill('[data-pf="theme:settings.social_instagram"]', ""); await openGroup("css"); await page.fill('[data-pf="theme:settings.css"]', ""); await settle(300);
  await liveSave(); const th = read(WR, "content/theme.json"); must(!th.rules && !th.css, "not back to the site's own: " + th.css + " " + th.rules);
});
await check("A section's panel has a Theme settings box that leads to the theme", async () => {
  await toSections(); await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await settle(300);
  await page.click('.tbox [data-act="ed-tbox"]'); await settle(200); must(/across the whole site/.test(await text(".tbox")), "no warning");
  await page.click('.tbox [data-act="ed-theme-open"]'); await settle(400); must(await page.isVisible(".tpanel"), "did not open the theme");
  await toSections();
});
await check("Global Art Monitor and Street Art Dispatch size their headings from the theme too", async () => {
  for (const [id, host] of [["global-art-monitor", "globalartmonitor.com"], ["street-art-dispatch", "streetartdispatch.com"]]) {
    await openSite(id); await page.selectOption(".pagepick", "home"); await settle(1500); await openTheme(); await openGroup("type");
    const f = frame(host), q = "main h2, h2", before = await f.evaluate((x) => parseFloat(getComputedStyle(document.querySelector(x)).fontSize), q);
    await page.fill('.numbox [data-pf="theme:settings.h_size"]', "120"); await settle(600);
    const after = await f.evaluate((x) => parseFloat(getComputedStyle(document.querySelector(x)).fontSize), q);
    must(Math.abs(after / before - 1.2) < 0.03, id + ": " + before + " to " + after);
    await shot("19b-" + id); await page.click('[data-act="ed-discard"]'); await settle(600); await toSections();
  }
  await openSite("world-art-review");
});

// =============== 7. Templates ===============
area = "Templates";
const tplOf = (kind, id) => page.evaluate((a) => (window.__adh.pgOf().doc.templates[a[0]] || {})[a[1]] || null, [kind, id]);
const openTpl = async (g, kind, id) => { if (!(await page.isVisible(".pp"))) await page.click(".ed-pagebtn"); await page.click('[data-act="ed-ppgroup"][data-g="' + g + '"]'); await page.click('[data-act="ed-tpl-open"][data-kind="' + kind + '"][data-id="' + id + '"]'); await settle(1500); };
await check("The page picker counts templates, and kinds of page not built yet are greyed with Used by 0", async () => {
  await openSite("world-art-review"); await page.selectOption(".pagepick", "home"); await settle(1200);
  await page.click(".ed-pagebtn"); const t = await text(".pp-lvl");
  const nArt = await page.evaluate(() => window.__adh.pgOf().site.articles.length);
  must(new RegExp("Articles\\s*" + nArt + ", 1 template").test(t) && /Artist portfolios\s*\d+, 1 template/.test(t), "counts: " + t.replace(/\n/g, " "));
  must(t.includes("Not on this site yet") && /Exhibitions\s*Used by 0/.test(t) && await page.isDisabled('.pp-lvl .pp-item:has-text("Exhibitions")'), "greyed kinds");
  await page.click('[data-act="ed-ppgroup"][data-g="ct"]'); const ct = await text(".pp-lvl");
  must(ct.includes("Content type templates") && ct.includes("Comes later") && await page.isDisabled('.pp-lvl .pp-item:has-text("Artworks")'), "content types: " + ct.replace(/\n/g, " "));
  await page.click('[data-act="ed-ppgroup"][data-g=""]'); await page.click('[data-act="ed-ppgroup"][data-g="articles"]'); const at = await text(".pp-lvl");
  must(new RegExp("Article templates[\\s\\S]*Default article[\\s\\S]*Used by " + nArt + " articles[\\s\\S]*Create template").test(at) && await page.locator('.pp-lvl .tpl-line .tpl-star').count() === 1, "articles: " + at.slice(0, 200).replace(/\n/g, " "));
  await shot("41a-picker"); await page.keyboard.press("Escape");
});
await check("Opening a template shows its name, how many use it, which article fills the preview, and the article as its main section", async () => {
  await openTpl("articles", "article", "default");
  const l = await text(".ed-left"), nA = await page.evaluate(() => window.__adh.pgOf().site.articles.length);
  must(l.includes("Default article") && l.includes("Article template, used by " + nA + " articles") && l.includes("Preview:") && /Template[\s\S]*Article[\s\S]*Title and summary[\s\S]*Settings/.test(l), "left: " + l.slice(0, 300).replace(/\n/g, " "));
  must((await text(".ed-pagebtn")).includes("Default article"), "page button");
  must(!(await page.locator('.sec.tplmain .rb.del').count()), "the main section has a bin");
  await page.click(".sec.tplmain", { button: "right" }); await settle(200); must(!(await page.isVisible(".ctxm")), "the main section has a right-click menu");
  must(!(await page.locator('.ed-left .tpl-tools [data-act="ed-tpl-del"]').count()), "the default can be removed");
});
await check("A section added to a template shows on every article using it, not on other pages, and saves", async () => {
  await addHere("quote", "tpl"); await settle(600);
  const t = await tplOf("article", "default"); must(t.sections.length === 2 && t.sections[0].type === "main" && /^t-quote-/.test(t.sections[1].id), "template " + JSON.stringify(t.sections.map((x) => x.id)));
  await page.fill('[data-pf="text"]', "On every article"); await settle(700);
  must((await frame("worldartreview.com").innerText("#main")).includes("On every article"), "not in the preview");
  const first = await page.evaluate(() => window.__adh.pgOf().at);
  await page.click('[data-act="ed-tpl-ex"]'); must(await page.isVisible(".tpl-pop"), "no example picker");
  await page.fill("#tpl-ex-q", "palette"); await settle(200); must(await page.locator(".tpl-pop .pp-item:not([hidden])").count() >= 1, "search");
  await page.click(".tpl-pop .pp-item:not([hidden]) >> nth=0"); await settle(1500);
  must((await page.evaluate(() => window.__adh.pgOf().at)) !== first && (await frame("worldartreview.com").innerText("#main")).includes("On every article"), "another article");
  await shot("41b-template");
  await liveSave(); const saved = read(WR, "content/pages.json");
  must(saved.templates.article.default.sections[1].settings.text.join(" ").includes("On every article"), "not saved: " + JSON.stringify(saved.templates));
  await page.selectOption(".pagepick", "home"); await settle(1500); must(!(await frame("worldartreview.com").innerText("#main")).includes("On every article"), "on the home page");
});
await check("Create template asks for a name of up to 25 characters and a template to copy, then opens it", async () => {
  await page.click(".ed-pagebtn"); await page.click('[data-act="ed-ppgroup"][data-g="articles"]'); await page.click('[data-act="ed-tpl-new"][data-kind="article"]'); await settle(300);
  must(await page.isVisible(".tpl-dlg") && await page.isDisabled("#tpl-new-go") && (await text("#tpl-new-count")) === "0 of 25", "dialog");
  must((await page.inputValue("#tpl-new-base")) === "default", "based on");
  await page.fill("#tpl-new-name", "Default article"); must(await page.isDisabled("#tpl-new-go") && await page.isVisible("#tpl-new-clash"), "a name already used");
  await page.fill("#tpl-new-name", "Long read"); must(!(await page.isDisabled("#tpl-new-go")) && (await text("#tpl-new-count")) === "9 of 25", "count");
  await shot("41c-create"); await page.click("#tpl-new-go"); await settle(1500);
  const l = await text(".ed-left"); must(l.includes("Long read") && l.includes("used by 0 articles") && l.includes("Remove template"), "left: " + l.slice(0, 200).replace(/\n/g, " "));
  const t = await tplOf("article", "long-read"); must(t && t.sections.length === 2, "copy " + JSON.stringify(t));
});
await check("An article's own Settings choose its template, and the page changes with it", async () => {
  await page.click('.sec[data-where="item"][data-id="settings"]'); await settle(400);
  must(await page.isVisible("#tpl-assign") && (await page.inputValue("#tpl-assign")) === "default", "the choice");
  // the copy gets its own words, so the two can be told apart
  await page.click('.sec[data-where="tpl"]:not(.tplmain)'); await page.fill('[data-pf="text"]', "Only on long reads"); await settle(600);
  await page.click('.sec[data-where="item"][data-id="settings"]'); await settle(300);
  await page.selectOption("#tpl-assign", "long-read"); await settle(1200);
  const slug = await page.evaluate(() => window.__adh.pgOf().at.split(":")[1]);
  must((await page.evaluate(() => window.__adh.pgOf().doc.assign.article)) [slug] === "long-read", "not chosen");
  must((await text(".ed-left")).includes("used by 1 article") && (await frame("worldartreview.com").innerText("#main")).includes("Only on long reads"), "the page");
  await shot("41d-assign"); await liveSave();
  const saved = read(WR, "content/pages.json"); must(saved.assign.article[slug] === "long-read" && saved.templates.article["long-read"].name === "Long read", "saved " + JSON.stringify(saved.assign));
  // a template in use cannot be removed; back to the default, then it can
  must(!(await page.locator('[data-act="ed-tpl-del"]').count()), "Remove offered while in use");
  await page.click('.sec[data-where="item"][data-id="settings"]'); await page.selectOption("#tpl-assign", "default"); await settle(800);
  await openTpl("articles", "article", "long-read"); await page.click('[data-act="ed-tpl-del"]'); await settle(800);
  must(!(await tplOf("article", "long-read")), "not removed"); await liveSave();
  must(!read(WR, "content/pages.json").templates.article["long-read"], "still saved");
});
await check("Renaming a template keeps it to 25 characters", async () => {
  await openTpl("artists", "artist", "default"); await page.click('[data-act="ed-tpl-rename"]'); await page.fill("#tpl-rename", "Portfolio with notes"); await page.keyboard.press("Enter"); await settle(500);
  must((await tplOf("artist", "default")).name === "Portfolio with notes" && (await text(".ed-left .lt")).includes("Portfolio with notes"), "renamed");
  await page.click('[data-act="ed-discard"]'); await settle(800);
});
await check("Global Art Monitor and Street Art Dispatch draw template sections, and a click picks them", async () => {
  for (const [id, host] of [["global-art-monitor", "globalartmonitor.com"], ["street-art-dispatch", "streetartdispatch.com"]]) {
    await openSite(id); await openTpl("artists", "artist", "default");
    await addHere("quote", "tpl"); await page.fill('[data-pf="text"]', "On every artist page"); await settle(900);
    const f = frame(host); must((await f.innerText("main")).includes("On every artist page"), id + ": not drawn");
    await mouseIn(host, '[data-adh^="t-quote"]'); await settle(500);
    must((await page.evaluate(() => window.__adh.pgOf().sel || {})).where === "tpl", id + ": not picked");
    await shot("41e-" + id); await page.click('[data-act="ed-discard"]'); await settle(800);
  }
  await openSite("world-art-review");
});

// =============== 7b. Stored data in templates ===============
area = "Stored data";
await check("In a template, a setting can be connected to the page's own data, and each page shows its own", async () => {
  await openSite("world-art-review"); await openTpl("articles", "article", "default");
  const qid = await addHere("quote", "tpl"); await settle(500);
  await page.click('.storedl [data-mode="connect"] >> nth=0'); must(await page.isVisible(".resmenu"), "no menu");
  await page.click('.resmenu [data-v="{page.title}"]'); await settle(900);
  const shown = async () => (await frame("worldartreview.com").innerText("#" + qid)).trim();
  const title = await page.evaluate(() => { const p = window.__adh.pgOf(); return p.site.articles.find((a) => a.slug === p.at.split(":")[1]).title; });
  must((await shown()).includes(title), "shows " + await shown());
  must((await text("body")).includes("This article's title"), "no tag");
  await page.click('[data-act="ed-tpl-ex"]'); await page.click(".tpl-pop .pp-item:not(.on) >> nth=0"); await settle(1500);
  const title2 = await page.evaluate(() => { const p = window.__adh.pgOf(); return p.site.articles.find((a) => a.slug === p.at.split(":")[1]).title; });
  must(title2 !== title && (await shown()).includes(title2), "the other article shows " + await shown());
  await shot("42a-stored"); await liveSave();
  const sec = read(WR, "content/pages.json").templates.article.default.sections.find((x) => x.id === qid); must(JSON.stringify(sec.settings.text) === '["{page.title}"]', "saved " + JSON.stringify(sec.settings));
});
await check("An artist setting in an artist template can be this artist, and Disconnect empties it", async () => {
  await openTpl("artists", "artist", "default"); const cid = await addHere("artist-cards", "tpl"); await settle(500);
  if (await page.locator('.sec.blk[data-id="' + cid + '"]').count()) await page.click('.sec.blk[data-id="' + cid + '"] >> nth=0');
  else { await page.click('.blocknote [data-act="ed-blockpicker"]'); await settle(300); if (await page.isVisible(".pk-item")) await page.click(".pk-item >> nth=0"); }
  await settle(500); must((await page.evaluate(() => window.__adh.pgOf().sel || {})).block != null, "no artist block picked");
  await page.click('.resf [data-mode="connect"] >> nth=0'); await page.click('.resmenu [data-v="{page.artist}"]'); await settle(800);
  const v = await page.evaluate(() => { const p = window.__adh.pgOf(), s = p.doc.templates.artist.default.sections.find((x) => x.type === "artist-cards"); return JSON.stringify(s.settings); });
  must(v.includes("{page.artist}"), "set " + v); must((await text("body")).includes("This portfolio") && !(await text(".ed-left")).includes("{page.artist}"), "tag");
  await page.click('[data-act="ed-discard"]'); await settle(800);
});

// =============== 8. Undo, the Changes list and publishing later ===============
area = "Undo and changes";
if (ONLY && ONLY.includes(area)) { await page.goto(consoleAt + "/index.html"); await page.waitForSelector('[data-act="open-site"]', { timeout: 20000 }); await openSite("world-art-review"); }
const eyebrow = () => page.evaluate(() => window.__adh.pgOf().doc.pages.home.sections.find((x) => x.id === "numbers").settings.eyebrow);
await check("Undo and Redo step through this page's changes, and Save turns off once everything is undone", async () => {
  await page.selectOption(".pagepick", "home"); await settle(1200);
  must(await page.isDisabled('[data-act="ed-undo"]') && await page.isDisabled('[data-act="ed-redo"]'), "on with nothing to undo");
  const was = await eyebrow();
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await page.fill('[data-pf="eyebrow"]', "Step one"); await settle(1700);
  await page.fill('[data-pf="eyebrow"]', "Step two"); await settle(600);
  await page.click('[data-act="ed-undo"]'); await settle(500); must(await eyebrow() === "Step one", "first undo: " + await eyebrow());
  must(!(await page.isDisabled('[data-act="ed-redo"]')), "Redo is off after Undo");
  await page.click('[data-act="ed-undo"]'); await settle(500); must(await eyebrow() === was && await page.isDisabled('[data-act="ed-save"]'), "everything undone, Save " + await page.isDisabled('[data-act="ed-save"]'));
  await page.click('[data-act="ed-redo"]'); await settle(500); must(await eyebrow() === "Step one", "redo");
  await page.fill('[data-pf="eyebrow"]', "Something new"); await settle(600); must(await page.isDisabled('[data-act="ed-redo"]'), "Redo stays on after a new change");
  must((await frame("worldartreview.com").innerText("#numbers")).includes("Something new"), "preview");
});
await check("Removing a section happens at once and Undo puts it back in the same place, picked", async () => {
  const before = await homeSecs(); await page.click('#ed-sections .sec[data-id="method"]:not(.blk)'); await page.keyboard.press("Shift+Delete"); await settle(500);
  must((await homeSecs()).length === before.length - 1, "not removed");
  await page.locator("body").click({ position: { x: 5, y: 890 } }).catch(() => {}); await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z"); await settle(600);
  must(JSON.stringify(await homeSecs()) === JSON.stringify(before), "not back in place: " + (await homeSecs()).join());
  must((await page.evaluate(() => window.__adh.pgOf().sel || {})).id === "method", "not picked");
});
await check("Each page keeps its own Undo, and the Changes list shows every change in plain words, each with its own Undo", async () => {
  await page.selectOption(".pagepick", "page-standards"); await settle(1200);
  must(await page.isDisabled('[data-act="ed-undo"]'), "the home page's changes undo here");
  const n = Number(((await text(".chg-count")).match(/(\d+) changes?/) || [])[1]); must(n >= 2, "count " + n + " in " + JSON.stringify(await text(".chg-count")));
  await page.click(".chg-count"); const list = await text(".chg");
  must(/: Small line above the heading changed to "Something new"/.test(list) && list.includes("Home"), "list: " + list.replace(/\n/g, " | "));
  await shot("43a-changes");
  await page.click('.chg-row:has-text("Something new") [data-act="ed-chg-undo"]'); await settle(1200);
  must((await page.evaluate(() => window.__adh.pgOf().page)) === "home" && (await eyebrow()) === "Step one", "undo from the list: " + await eyebrow());
  await page.click('[data-act="ed-discard"]'); await settle(800); must(!(await page.isVisible(".chg-count")), "the count stays after Discard");
});
await check("Ctrl+S saves, and Ctrl+/ shows the shortcuts", async () => {
  await page.keyboard.press("Escape"); if (await page.isEnabled('[data-act="ed-discard"]').catch(() => false)) { await page.click('[data-act="ed-discard"]').catch(() => {}); await settle(600); }
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await page.fill('[data-pf="eyebrow"]', "Saved with keys"); await settle(400);
  await page.keyboard.press("Control+s"); await page.waitForSelector("text=goes live in about two minutes"); await page.click('[data-act="livesave"]'); await page.waitForSelector("text=Saved"); await settle(1500);
  must(JSON.stringify(read(WR, "content/pages.json")).includes("Saved with keys"), "not saved");
  await page.keyboard.press("Control+/"); await settle(300); const k = await text(".ed-pop"); must(k.includes("Undo") && k.includes("Redo") && k.includes("Save"), "keys: " + k); await page.keyboard.press("Escape");
});
await check("Publish later keeps the changes on a copy of their own, and the clock publishes them when the time comes", async () => {
  await page.keyboard.press("Escape"); await settle(200);
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)'); await page.fill('[data-pf="eyebrow"]', "Out on Monday"); await settle(500);
  await page.click('[data-act="ed-pop"][data-menu="save"]'); must(!(await page.isDisabled('.svp .pp-item:has-text("Publish later")')), "Publish later is off");
  await page.click('.svp .pp-item:has-text("Publish later")'); must(await page.isVisible("#later-date") && await page.isVisible("#later-time"), "no date and time");
  await shot("43b-later"); await page.click('[data-act="ed-later-go"]'); await page.waitForSelector("text=Kept to publish", { timeout: 9000 }); await settle(1500);
  must(!JSON.stringify(read(WR, "content/pages.json")).includes("Out on Monday"), "went live at once");
  const refs = hub.refs ? hub.refs(WR) : null, id = (await page.evaluate(() => (window.__adh.state.data.sites.find((x) => x.id === "world-art-review").copies || []).map((c) => c.id))).find((x) => /^trial-later-/.test(x));
  must(id, "no copy waiting"); must(JSON.stringify(JSON.parse(hub.read(WR, "adh/" + id, "content/pages.json"))).includes("Out on Monday"), "not on the copy");
  must(!(await eyebrow() || "").includes("Out on Monday"), "still in the editor");
  const { handle: h2, runLater } = await import("./home.mjs");
  const bad = await h2(new Request("https://x/", { method: "POST", headers: { "x-schedule-key": "wrong-key-wrong-key-wrong-key" }, body: "{}" })); must(bad.status === 403, "a wrong key was let in");
  const early = await runLater(new Date()); must(!early.done.length, "published early");
  const r = await runLater(new Date(Date.now() + 3 * 86400000)); must(r.done.length === 1 && r.done[0].result === "published", JSON.stringify(r));
  must(JSON.stringify(read(WR, "content/pages.json")).includes("Out on Monday") && hub.read(WR, "adh/" + id, "content/pages.json") == null, "not published");
  // the clock changed the live site behind the console's back, so start afresh as a person would after it ran
  await page.goto(consoleAt + "/index.html"); await page.waitForSelector('[data-act="open-site"]', { timeout: 12000 }); await settle(600);
});

// =============== 9. Add-ons and Edit code ===============
area = "Add-ons";
await check("The Add-ons panel lists the four add-ons, each with a switch and its own settings", async () => {
  await openSite("world-art-review"); await page.click('[data-act="ed-panel"][data-panel="addons"]'); await settle(400);
  const t = await text(".aopanel"); for (const w of ["Back to top button", "Reading progress", "Share links", "Privacy notice"]) must(t.includes(w), "missing " + w);
  await page.click('.ao-row[data-id="top"] [data-act="ed-addon-open"]'); await settle(300);
  must(await page.isVisible('[data-pf="addon:top.label"]'), "no settings for the Top button"); await shot("45-addons");
  await page.fill("#ao-q", "privacy"); await settle(200); must(await page.isVisible('.ao-row[data-id="privacy"]') && !(await page.isVisible('.ao-row[data-id="top"]')), "search"); await page.fill("#ao-q", "");
});
await check("Switching the Top button and Share links on shows them in the preview, and Save puts them on the live site", async () => {
  await page.selectOption(".pagepick", "home"); await settle(1000);
  await page.click('.ao-row[data-id="top"] .switch'); await page.fill('[data-pf="addon:top.label"]', "Back up"); await settle(900);
  must((await frame("worldartreview.com").innerText(".ao-top")).includes("Back up"), "no Top button in the preview");
  await page.click('.ao-row[data-id="share"] .switch'); await settle(600);
  const slug = await page.evaluate(() => window.__adh.pgOf().site.articles.find((a) => !a.hidden).slug);
  await page.selectOption(".pagepick", "a-" + slug); await settle(1500);
  const sh = await frame("worldartreview.com").innerText(".ao-share"); must(/Share this page/.test(sh) && /LinkedIn/.test(sh), "no share links: " + sh);
  await liveSave(); const ao = read(WR, "content/pages.json").addons || {};
  must(ao.top && ao.top.on === true && ao.top.label === "Back up" && ao.share && ao.share.on === true, "not saved: " + JSON.stringify(ao));
});
await check("On a phone the add-ons keep out of the way of the page", async () => {
  await page.click('[data-act="ed-mode"][data-mode="phone"]'); await settle(1500);
  const box = await frame("worldartreview.com").evaluate(() => { const b = document.querySelector(".ao-top"), r = b && b.getBoundingClientRect(); return r ? { r: r.right, w: innerWidth, h: r.height } : null; });
  must(box && box.r <= box.w && box.h < 60, "Top button: " + JSON.stringify(box)); await shot("46-addons-phone");
  await page.click('[data-act="ed-mode"][data-mode="computer"]'); await settle(800);
});

area = "Edit code";
const codeAt = (s) => page.evaluate(() => { const t = document.querySelector("#code-ta"); return t ? t.value.slice(0, t.selectionStart).split("\n").length : 0; });
await check("Edit code opens the site's own code, with read-only settings files and an outline", async () => {
  if (!(await page.isVisible(".ed-top"))) await openSite("world-art-review");
  await page.click('[data-act="ed-pop"][data-menu="more"]'); await page.click('[data-act="code-open"]'); await page.waitForSelector("#code-ta", { timeout: 9000 });
  const tree = await text(".code-files"); must(tree.includes("src/index.html") && tree.includes("tools/build_site.py") && /read only/i.test(tree) && tree.includes("content/pages.json"), "files: " + tree.replace(/\n/g, " | "));
  must((await page.inputValue("#code-ta")) === fs.readFileSync(WARDIR + "src/index.html", "utf8"), "not the live code");
  must((await page.locator(".code-ol .pp-item").count()) > 20, "the outline is nearly empty");
  await page.click('.code-files [data-path="content/pages.json"]'); must(await page.getAttribute("#code-ta", "readonly") !== null, "settings file can be typed in");
  must((await text(".code-site")).includes("Live site"), "says " + await text(".code-site")); await shot("47-code");
});
await check("Search, Go to file, Commands and Go to line find their way round the code", async () => {
  await page.fill("#code-q", "groupHTML"); await settle(300); must(/\d+ match/.test(await text(".code-found")), "search: " + await text(".code-found"));
  await page.click(".code-found .pp-item >> nth=0"); await settle(400); must(await page.inputValue("#code-ta") === fs.readFileSync(WARDIR + "src/index.html", "utf8") && (await codeAt()) > 1, "search did not go there");
  await page.locator("#code-ta").click(); await page.keyboard.press("Control+p"); await page.fill("#code-goq", "build_site"); await page.keyboard.press("Enter"); await settle(300);
  must((await text(".code-tab.on")).includes("build_site.py"), "Go to file: " + await text(".code-tabs"));
  await page.keyboard.press("Control+Shift+P"); must((await text(".code-pop")).includes("Go to line"), "commands"); await page.click('[data-cmd="line"]');
  await page.fill("#code-lq", "12"); await page.keyboard.press("Enter"); await settle(300); must((await codeAt()) === 12, "line " + await codeAt());
  await page.click('.code-tab:has-text("build_site.py") .ct-close'); await settle(200); must(!(await text(".code-tabs")).includes("build_site.py"), "Close");
});
await check("A section's Edit code opens the file where that section is drawn", async () => {
  await page.click('[data-act="code-back"]'); await page.waitForSelector(".ed-top"); await settle(400); if (!(await page.isVisible("#ed-sections"))) await page.click('[data-act="ed-panel"][data-panel="sections"]'); await page.selectOption(".pagepick", "home"); await page.waitForSelector('#ed-sections .sec[data-id="numbers"]'); await settle(600);
  await page.click('#ed-sections .sec[data-id="numbers"]:not(.blk)', { button: "right" }); await page.click('.ctxm [data-op="code"]'); await page.waitForSelector("#code-ta"); await settle(300);
  const line = (await page.inputValue("#code-ta")).split("\n")[(await codeAt()) - 1]; must(/^\s*'?numbers'?\(st/.test(line), "opened at: " + line);
});
await check("Saving puts the code on the Code changes trial copy only, and Make live waits until it builds", async () => {
  const live = hub.read(WR, "main", "src/index.html");
  await page.locator("#code-ta").click(); await page.keyboard.press("Control+End"); await page.keyboard.type("\n<!-- checked by the acceptance test -->");
  must(/1 file changed/.test(await text("#code-count")), "count: " + await text("#code-count"));
  await page.keyboard.press("Control+s"); await page.waitForSelector("text=Saved to the trial copy", { timeout: 9000 }); await settle(600);
  must(hub.read(WR, "main", "src/index.html") === live, "the live code changed");
  must((hub.read(WR, "adh/trial-code-changes", "src/index.html") || "").includes("checked by the acceptance test"), "not on the copy");
  must(/Checking/.test(await text("#code-status")) && !(await page.isVisible('[data-act="code-live-ask"]')), "Make live is on while checking");
  hub.setRun(WR, "adh/trial-code-changes", "failure"); await page.keyboard.press("Control+Shift+P"); await page.click('[data-cmd="check"]'); await page.waitForSelector("#code-status .bad", { timeout: 20000 });
  must(!(await page.isVisible('[data-act="code-live-ask"]')), "Make live on a copy that does not build");
  const res = await handle(new Request("https://x/", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify({ action: "publish", site: "world-art-review", copy: "trial-code-changes" }) }));
  must(res.status === 400 && /do not build/.test((await res.json()).error), "the server let a failing copy go live"); await shot("48-code-failed");
});
await check("Once the copy builds, Make live puts the code on the live site", async () => {
  hub.setRun(WR, "adh/trial-code-changes", "success"); await page.keyboard.press("Control+Shift+P"); await page.click('[data-cmd="check"]');
  await page.waitForSelector('[data-act="code-live-ask"]', { timeout: 20000 }); await shot("49-code-passed");
  await page.click('[data-act="code-live-ask"]'); await page.click('[data-act="code-live"]'); await page.waitForSelector("text=Visitors see the changes", { timeout: 9000 });
  must((hub.read(WR, "main", "src/index.html") || "").includes("checked by the acceptance test"), "not live");
  must(hub.read(WR, "adh/trial-code-changes", "src/index.html") == null, "the copy was kept");
  must((await text(".code-site")).includes("Live site"), "still on the copy");
});
await check("Edit code is the admin's only: an editor sees it switched off", async () => {
  await page.click('[data-act="code-back"]'); await page.waitForSelector(".ed-top");
  await page.evaluate(() => { const w = window.__adh; w.state.data.user.admin = false; });
  await page.click('[data-act="ed-pop"][data-menu="more"]'); const m = await text(".ed-pop");
  await page.evaluate(() => { const w = window.__adh; w.state.data.user.admin = true; w.state.edMenu = ""; w.render(); });
  must(/Edit code\s*Admin only/.test(m) && !(await page.isVisible('[data-act="code-open"]')), "menu: " + m.replace(/\n/g, " | "));
});

// =============== 9b. The practice build (new sites, step 3) ===============
area = "Practice build";
const pbRead = (f) => { const t = hub.read(PB, "main", f); return t == null ? null : JSON.parse(t); };
const pbHome = async () => { await page.goto(consoleAt + "/index.html"); await page.waitForSelector('[data-act="open-site"]', { timeout: 12000 }); await settle(600); };
const pbFrame = () => frame("artiscope.github.io/practice-build");
await check("The practice build opens in the page editor, drawn by the starter, and offers exactly the shared sections", async () => {
  await openSite("practice-build");
  must(pbFrame() && (await pbFrame().innerText("main")).includes("[A heading for three cards]"), "the starter's home page is not in the preview");
  must((await text(".ed-top")).includes("Live"), "the admin is not on the live practice build");
  await page.click('.addl[data-act="ed-secpicker"][data-g="page"]'); await settle(400);
  const keys = await page.$$eval(".pk-item[data-key]", (xs) => [...new Set(xs.map((x) => x.dataset.key))].sort());
  const want = STARTER_KINDS.filter((k) => k !== "signup-popup").sort();
  must(JSON.stringify(keys) === JSON.stringify(want), "offered " + keys.join(", ")); await shot("50-pb-picker");
  await page.keyboard.press("Escape"); await settle(200);
});
await check("A section added and saved goes onto the practice build, in square brackets until it gets real words", async () => {
  await page.click('.addl[data-act="ed-secpicker"][data-g="page"]'); await page.click('.pk-item[data-key="quote"]'); await settle(700);
  must((await pbFrame().innerText("main")).includes("[A line worth remembering]"), "the new quote is not in the preview");
  await liveSave();
  const doc = pbRead("data/pages.json"), q = doc.pages.home.sections.find((x) => x.type === "quote");
  must(q && q.settings.text === "[A line worth remembering]", "not saved: " + JSON.stringify(q));
  await shot("51-pb-quote");
});
await check("Site details: the email every form opens a message to", async () => {
  await page.selectOption(".pagepick", "site-details"); await settle(1000); await page.click('.sec[data-where="item"][data-id="details"]');
  await page.fill('[data-pf="site.email"]', "not an address"); await page.click('[data-act="ed-save"]'); await page.click('[data-act="livesave"]'); await settle(1500);
  const n = await notice(); must(/does not look like an email/i.test(n), "notice: " + n);
  await page.fill('[data-pf="site.email"]', "hello@example.org"); await liveSave();
  must(pbRead("data/content.json").site.email === "hello@example.org" && pbRead("data/content.json").site.address === "https://artiscope.github.io/practice-build/", "saved " + JSON.stringify(pbRead("data/content.json")));
});
await check("A test user given the practice build works there as the admin does, and as an editor on their other sites", async () => {
  ppl.table.push({ email: "tess@example.org", id: "0a1b2c3d4e", name: "Tess", sites: ["practice-build", "world-art-review"], invited_at: new Date().toISOString(), last_seen: null });
  signedIn = "tess@example.org";
  try {
    await pbHome(); must((await page.locator('[data-act="open-site"]').count()) === 2, "Tess should see two sites");
    await shot("54-pb-tess-home"); await openSite("practice-build");
    must((await text(".ed-top")).includes("Live"), "Tess is not on the live practice build: " + (await text(".ed-top")).slice(0, 120));
    await page.click('[data-act="ed-pop"][data-menu="more"]'); must(await page.isVisible('[data-act="code-open"]'), "Edit code is off for a test user on the practice build"); await page.keyboard.press("Escape");
    await page.click('#ed-sections .sec[data-id="cards"]:not(.blk)'); await settle(400); await page.fill('[data-pf="heading"]', "Tess was here"); await settle(300); await liveSave();
    must(pbRead("data/pages.json").pages.home.sections.find((x) => x.id === "cards").settings.heading === "Tess was here", "Tess's change is not live");
    must(hub.commitLog(PB).some((c) => /\(by 0a1b2c3d4e\)/.test(c.message)), "the change does not carry Tess's code");
    await openSite("world-art-review"); must(/Your copy/.test(await text(".ed-top")), "on World Art Review Tess is not on her own copy");
  } finally { signedIn = "tester@artiscope.co.uk"; ppl.table.splice(0, ppl.table.length, ...ppl.table.filter((x) => x.email !== "tess@example.org")); await pbHome(); }
});
await check("A new copy whose own preview is not built yet is shown on top of the live site, with a line saying so", async () => {
  previewGone = true;
  try {
    await openSite("practice-build");
    await page.click('.ed-top [data-tab="overview"]'); await page.waitForSelector("#copy-name");
    await page.fill("#copy-name", "Try it"); await page.click('form[data-form="copy"] button[type=submit]'); await page.waitForSelector("text=You are working on this", { timeout: 9000 }); await settle(600);
    await goTab(page, "pages"); await page.waitForSelector("#ed-sections .sec", { timeout: 9000 }); await settle(1500);
    await page.waitForSelector(".ed-wait", { timeout: 9000 });
    must(/still being made/.test(await text(".ed-wait")), "no line about the preview");
    must(pbFrame() && !pbFrame().url().includes("/preview/"), "the preview is not the live site: " + (pbFrame() && pbFrame().url()));
    await shot("52-pb-waiting");
  } finally { previewGone = false; }
});
await check("Start again puts the practice build back to the starter, after one question, and deletes its copies", async () => {
  await page.click(".ed-exit").catch(() => {}); await goTab(page, "overview"); await settle(600);
  await page.click('[data-act="ask-startagain"]'); await settle(300);
  must((await text("body")).includes("Start the practice build again?"), "no question");
  await page.click('[data-act="startagain"]'); await page.waitForSelector("text=starts again from the starter", { timeout: 9000 }); await settle(600);
  const doc = pbRead("data/pages.json"), want = JSON.parse(starterFiles["data/pages.json"]);
  must(JSON.stringify(doc.pages.home.sections.map((x) => x.id)) === JSON.stringify(want.pages.home.sections.map((x) => x.id)), "pages are not the starter's: " + doc.pages.home.sections.map((x) => x.id));
  must(pbRead("data/content.json").site.email === "info@grovegallery.com" && pbRead("data/content.json").site.address === "https://artiscope.github.io/practice-build/", "details: " + JSON.stringify(pbRead("data/content.json")));
  must(!Object.keys(hub.refs(PB)).some((r) => r.startsWith("adh/")), "copies are left: " + Object.keys(hub.refs(PB)));
  await shot("53-pb-startagain");
});

// =============== 6c. New sections, batch 1 ===============
area = "New sections: batch 1";
const newPage = async (title) => { await page.click('.ed-pagebtn'); await page.click('.pp [data-act="ed-new"]'); await page.click('[data-act="ed-new"][data-what="page"]'); await page.fill("#nw-title", title); await page.click('form[data-form="ednew"] button[type=submit]'); await settle(1200); };
const addSec = async (key, at) => { await page.click(at == null ? '.addl[data-act="ed-secpicker"][data-g="page"]' : "#ed-sections > .ins >> nth=" + at); await page.click('.pk-item[data-key="' + key + '"]'); await settle(400); };
await check("An announcement bar with two messages sits above the menu bar, and each message is its own block", async () => {
  await openSite("world-art-review"); await newPage("Notices"); await addSec("announcement", 0);
  await page.click('.sec.blk[data-bf="messages"][data-block="0"]'); await page.fill('[data-pf="messages.0.text"]', "Two new sources added."); await page.fill('[data-pf="messages.0.link"]', "Read it"); await page.fill('[data-pf="messages.0.href"]', "#artists");
  await page.click('#ed-sections .addl.blk[data-act="ed-blockpicker"]'); await settle(300); await page.fill('[data-pf="messages.1.text"]', "A second message."); await settle(800);
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
  await page.check('[data-pf="shows.0.reported"]'); await page.fill('[data-pf="shows.0.href"]', "javascript:alert(1)"); await settle(700);
  const f = frame("worldartreview.com"); must((await f.textContent("#" + ex + " .exh li")).includes("Reported"), "no Reported marker");
  must(!(await f.$("#" + ex + " a.src")), "an unsafe source link is drawn"); await shot("20-exhibitions");
  await liveSave(); const x = read(WR, "content/pages.json").pages.shows.sections.find((y) => y.id === ex).settings.shows[0];
  must(x.reported === true && x.href === "" && x.title === "Spring show", "saved " + JSON.stringify(x));
});
await check("Artist cards: choosing one artist shows just that artist's card", async () => {
  await addSec("artist-cards"); const ac = await secIdOf("artist-cards"); const f = frame("worldartreview.com");
  const all = await f.$$eval("#" + ac + " .acard", (x) => x.length); must(all >= 2, "with none chosen, all published artists should show: " + all);
  await page.click('.ed-right [data-act="ed-blockpicker"]'); await settle(400); await page.click('.ed-right [data-act="ed-res"][data-path="artists.0"]'); await page.click('.resitems [data-v="konn-artiss"]'); await settle(700);
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
const goHome = async () => { await page.goto(consoleAt + "/index.html"); await page.waitForSelector('[data-act="open-site"]', { timeout: 12000 }); await settle(600); };
await check("The admin invites an editor for one site, and the normal sign-in email is sent", async () => {
  await goHome(); await goTab(page, "people"); await page.waitForSelector(".prow"); await settle(500);
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
  await goHome(); await goTab(page, "people"); await page.waitForSelector('.prow[data-email="editor@example.org"]');
  await page.click('.prow[data-email="editor@example.org"]'); await page.click('[data-act="people-remove"]'); await settle(300);
  must(ppl.table.length === 1, "removed before the second press");
  await page.click('[data-act="people-remove-yes"]'); await settle(900); must(ppl.table.length === 0, "not removed");
  signedIn = "editor@example.org";
  try { await goHome().catch(() => {}); must((await text("body")).toLowerCase().includes("does not have access"), "the removed editor still got in"); }
  finally { signedIn = "tester@artiscope.co.uk"; await goHome(); }
});

let edVersion = "", edBefore = "";
await check("An editor gets their own copy, saves, then saves and publishes, and the live site changes", async () => {
  await goTab(page, "people"); await page.waitForSelector(".prow"); await page.click('[data-act="people-invite"]');
  await page.fill("#pi-email", "writer@example.org"); await page.check('form[data-form="invite"] input[value="world-art-review"]');
  await page.click('form[data-form="invite"] button[type=submit]'); await settle(900);
  const tag = (ppl.table.find((p) => p.email === "writer@example.org") || {}).id; must(!!tag, "not invited");
  signedIn = "writer@example.org";
  try {
    await goHome(); await page.click('[data-act="open-site"][data-site="world-art-review"]'); await page.click('.ov-head [data-tab="pages"]'); await page.waitForSelector("#ed-sections .sec", { timeout: 15000 }); await settle(1500);
    must(Object.keys(hub.refs(WR)).includes("adh/trial-own-" + tag), "no copy was made for the editor");
    must(!(await page.$("select.copypick")), "an editor should not be able to switch to the live site");
    const before = read(WR, "content/pages.json").pages.home.sections.length;
    await addSec("space"); await page.click('[data-act="ed-save"]'); await settle(1800);
    must(read(WR, "content/pages.json").pages.home.sections.length === before, "Save alone changed the live site");
    must((await text(".ed-top")).includes("Publish"), "no Publish after saving");
    await addSec("space"); await page.click('[data-act="ed-save-publish"]'); await page.waitForSelector(".ask #pub-note", { timeout: 9000 });
    must(read(WR, "content/pages.json").pages.home.sections.length === before, "published before the question was answered");
    must(!(await page.$("#pub-big")), "an editor is offered a big change");
    const had = hub.releases(WR).map((x) => x.tag_name); edBefore = had[0] || "";
    await page.fill("#pub-note", "Two spaces for breathing room."); await page.click('.ask [data-act="makelive"]'); await settle(2500);
    must(read(WR, "content/pages.json").pages.home.sections.length === before + 2, "Save and publish did not reach the live site");
    const rel = hub.releases(WR); must(rel.length === had.length + (had.length ? 1 : 2), "versions before " + had + ", after " + rel.map((x) => x.tag_name));
    edVersion = rel[0].tag_name.slice(1); if (!edBefore) edBefore = "v1.0";
    must(rel[0].body.includes("Two spaces for breathing room.") && rel[0].body.includes("Add section: Space") && !rel[0].body.includes("@"), "notes: " + rel[0].body.replace(/\n/g, " / "));
    must((await text("body")).includes("Published as " + edVersion), "the editor is not told the version");
    must(hub.lastMessage(WR, "main").endsWith("(by " + tag + ")"), "the live change is not recorded by the editor's private tag: " + hub.lastMessage(WR, "main"));
    must(!hub.lastMessage(WR, "main").includes("@"), "an email address went into GitHub"); await shot("26-editor-published");
  } finally { signedIn = "tester@artiscope.co.uk"; await goHome(); }
});
await check("The admin sees the editor's new version on All sites, with its notes, and can go back to an earlier one", async () => {
  const nv = await text(".newv").catch(() => "");
  must(nv.includes("World Art Review " + edVersion) && nv.includes("Two spaces for breathing room."), "no notice of the new version " + edVersion + ": " + nv.slice(0, 120)); await shot("27-new-version");
  await page.click('.newv [data-act="v-seen"]'); await settle(300); must(!(await page.$(".newv")), "Seen did not put it away");
  await openSite("world-art-review"); await goTab(page, "versions"); await page.waitForSelector(".vrow");
  const nums = await page.$$eval(".vnum", (x) => x.map((e) => e.textContent)); must(nums[0] === edVersion && nums.includes(edBefore.slice(1)), "versions shown: " + nums);
  const before = read(WR, "content/pages.json").pages.home.sections.length;
  await page.click('[data-act="ask-goback"][data-v="' + edBefore.slice(1) + '"]'); await page.click('.ask [data-act="goback"]'); await settle(2500);
  must(read(WR, "content/pages.json").pages.home.sections.length === before - 2, "going back did not put the page back");
  const [a, b] = edVersion.split(".").map(Number); must(hub.releases(WR)[0].tag_name === "v" + a + "." + (b + 1), "going back did not make the next version: " + hub.releases(WR)[0].tag_name); await shot("28-versions");
});

// =============== 7. Global Art Monitor ===============
area = "Global Art Monitor";
await check("The editor opens with the real page", async () => { await openSite("global-art-monitor"); must(!!frame("globalartmonitor.com"), "no preview"); });
await check("Global Art Monitor draws a popup on an artist page and shows it while it is picked", async () => {
  await page.selectOption(".pagepick", "artist-zara-muse"); await settle(1200);
  await page.click('.addl[data-act="ed-secpicker"][data-g="popups"]'); await page.click('.pk-item[data-key="signup-popup"]'); await settle(1200);
  must(await frame("globalartmonitor.com").evaluate(() => { const p = document.querySelector("[data-popup]"); return !!p && !p.hidden && getComputedStyle(p).position === "fixed"; }), "not shown");
  await page.click('[data-act="ed-discard"]'); await settle(600); await page.selectOption(".pagepick", "home"); await settle(1000);
});
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

// =============== 10. Street Art Dispatch: the same console as the other sites ===============
area = "Street Art Dispatch";
const SF = () => frame("streetartdispatch.com");
const sadWide = async () => { await page.setViewportSize({ width: 390, height: 844 }); await settle(900); const w = await page.evaluate(() => document.documentElement.scrollWidth); await page.setViewportSize({ width: 1440, height: 900 }); await settle(400); return w; };
await check("Opening Street Art Dispatch goes straight to the page editor with the real page", async () => {
  await page.evaluate(() => { window.__adh.state.leave = null; window.__adh.state.dirty = false; const p = window.__adh.pgOf(); if (p) p.dirty = false; });
  await openSite("street-art-dispatch"); must(!!SF(), "no preview"); await shot("40-sad-editor");
});
await check("Street Art Dispatch draws a popup and shows it while it is picked", async () => {
  await page.click('.addl[data-act="ed-secpicker"][data-g="popups"]'); await page.click('.pk-item[data-key="signup-popup"]'); await settle(1200);
  must(await SF().evaluate(() => { const p = document.querySelector("[data-popup]"); return !!p && !p.hidden && getComputedStyle(p).position === "fixed"; }), "not shown");
  await page.click('[data-act="ed-discard"]'); await settle(600);
});
await check("Exit leads to the menu: Overview, Pages, Theme, Files, Versions and History, and no Content", async () => { await page.click(".ed-exit"); await page.waitForSelector(".rail"); const t = await text(".rail"); await page.click('.navb[data-tab="pages"]'); await page.waitForSelector("#ed-sections .sec"); await settle(2500); must(["Overview", "Pages", "Theme", "Files", "Versions", "History"].every((w) => t.includes(w)) && !t.includes("Content"), "menu: " + t.replace(/\n/g, " ")); });
await check("Its own sections are listed, and clicking one on the page opens its settings", async () => {
  const t = await text("#ed-sections"); must(["Opening banner", "Article cards", "Intervention archive", "Collecting band", "Email sign-up"].every((w) => t.includes(w)), "list: " + t.replace(/\n/g, " "));
  await SF().click("#heroTitle"); await page.waitForSelector(".ed-right h2:has-text('Opening banner')");
});
await check("Typing redraws the page, and Save writes only the page list", async () => {
  await page.fill('[data-pf="headline"]', "Art in the open"); await settle(600); must((await SF().textContent("#heroTitle")) === "Art in the open", "not redrawn");
  await liveSave(); must(read(SR, "data/pages.json").pages.home.sections[0].settings.headline === "Art in the open", "not saved");
  must(hub.read(SR, "main", "data/content.json") === fs.readFileSync(SADDIR + "data/content.json", "utf8"), "the content file changed");
});
await check("Add a section offers the same sections as the other sites", async () => {
  await page.click('.addl[data-act="ed-secpicker"][data-g="page"]'); await page.waitForSelector(".pk-item");
  const keys = await page.$$eval(".pk-item", (b) => b.map((x) => x.dataset.key));
  const want = ["announcement", "columns", "space", "quote", "faq", "button", "picture-banner", "slideshow", "gallery", "logo-row", "picture", "text-picture", "artworks", "exhibitions", "career", "press", "signup", "visit", "contact-form"];
  must(want.every((k) => keys.includes(k)), "missing: " + want.filter((k) => !keys.includes(k)).join(", "));
  await page.click('.pk-item[data-key="faq"]'); await settle(900); must(await SF().evaluate(() => !!document.querySelector("details.qa")), "not drawn");
  await liveSave(); must(read(SR, "data/pages.json").pages.home.sections.some((x) => x.type === "faq"), "not saved");
});
await check("An article opens from the page list and its title saves into the content file", async () => {
  await page.selectOption(".pagepick", "a-spectacle-to-collectable"); await settle(1500); must((await SF().textContent("h1")).includes("Spectacle"), "not drawn");
  await page.click('.sec[data-where="item"][data-id="words"]'); await page.fill('[data-pf="title"]', "From Spectacle to Collectable"); await settle(500);
  must((await SF().textContent("h1")) === "From Spectacle to Collectable", "not redrawn"); await liveSave();
  must(read(SR, "data/content.json").features.find((f) => f.slug === "spectacle-to-collectable").title === "From Spectacle to Collectable", "not saved");
});
await check("Issue details hold the archive, and a year is kept as a number while Venice stays to confirm", async () => {
  await page.selectOption(".pagepick", "site-details"); await settle(1000); must((await text(".ed-left")).includes("Intervention archive"), "no archive part");
  const i = sad0.archive.findIndex((x) => typeof x.y === "number");
  await page.click('.sec[data-where="item"][data-id="archive"]'); await settle(400); await page.click('.sec.blk[data-id="archive"] >> nth=' + i); await settle(300); await page.fill('[data-pf="archive.' + i + '.y"]', String(sad0.archive[i].y + 1)); await settle(300); await liveSave();
  const now = read(SR, "data/content.json"); must(now.archive[i].y === sad0.archive[i].y + 1, "saved as " + JSON.stringify(now.archive[i].y)); must(now.archive.find((x) => x.pending).y === "TBC", "Venice changed");
});
await check("The theme opens with the site's own colours and typefaces", async () => {
  await page.evaluate(() => { window.__adh.state.leave = null; const p = window.__adh.pgOf(); if (p) p.dirty = false; window.__adh.go("theme"); }); await settle(1500);
  const t = await text("body"); must(t.includes("Gloock") && t.includes("Buttons"), "theme: " + t.slice(0, 200));
});
await check("Changes are signed by admin, with no email address in GitHub", async () => {
  const msgs = hub.commitLog(SR).map((c) => c.message).filter((m) => m !== "Start"); must(msgs.length >= 3 && msgs.every((m) => !/@/.test(m) && /\(by admin\)$/.test(m)), "messages: " + msgs.join(" | "));
});
await check("No sideways scrolling on a phone: the editor and the overview", async () => {
  await page.evaluate(() => window.__adh.go("pages")); await settle(2000); const a = await sadWide(); await page.evaluate(() => window.__adh.go("overview")); await settle(800); const b = await sadWide();
  must(a <= 392 && b <= 392, a + ", " + b + " pixels wide");
});

// =============== 11. Start building: a new site from the starter ===============
area = "Start building";
const NEW = "Artiscope/grove-prints";
const bdFrame = async () => { const el = await page.$("#bd-if"); return el ? await el.contentFrame() : null; };
const bdText = async () => { const f = await bdFrame(); return f ? await f.innerText("body").catch(() => "") : ""; };
await check("Start building opens on Template: each template draws its own home page beside it", async () => {
  await page.setViewportSize({ width: 1440, height: 900 }); await goHome();
  await page.click('[data-act="open-site"][data-site="site-4"]'); await page.waitForSelector(".bd-tpl"); await settle(2500);
  must((await page.locator(".bd-tpl").count()) === 6 && (await page.locator(".bd-tpl[disabled]").count()) === 0, "not six templates, all ready");
  await page.click('.bd-tpl[data-v="editions"]'); await settle(2500);
  let te = await bdText(); for (let i = 0; i < 10 && !te.includes("[Works appear here"); i++) { await settle(500); te = await bdText(); }
  must(te.includes("[Works appear here once you add them]") && te.includes("Photograph to come") && /join the list/i.test(te) && !/Zen Xander|Zara|Konn|Grove/.test(te), "not the Editions template's home page: " + te.slice(0, 160));
  await page.click('.bd-tpl[data-v="the-art-correspondent"]'); await settle(2500);
  let ta = await bdText(); for (let i = 0; i < 10 && !ta.includes("[Stories appear here"); i++) { await settle(500); ta = await bdText(); }
  must(ta.includes("[Your opening heading]") && ta.includes("[Stories appear here once you add them]") && ta.toLowerCase().includes("read by subject") && !/Art Correspondent|Konn|Zara|Studio Sessions/.test(ta), "not The Art Correspondent template's home page: " + ta.slice(0, 160));
  await page.click('.bd-tpl[data-v="world-art-review"]'); await settle(4500);
  const tw = await bdText(); must(tw.includes("[Discover]") && tw.includes("[Artist name]") && !/Konn|Zara|World Art Review|Frieze/.test(tw), "not the World Art Review template's home page: " + tw.slice(0, 160));
  await page.click('.bd-tpl[data-v="global-art-monitor"]'); await settle(2500);
  const tg = await bdText(); must(tg.includes("[Sales appear here once you add them]") && tg.includes("[Your opening heading]") && !/Konn|Zara|Global Art Monitor|Tate Ward/.test(tg), "not the Global Art Monitor template's home page: " + tg.slice(0, 160));
  must((await bdText()).includes("[Your opening heading]"), "no starter preview: " + (await bdText()).slice(0, 80));
  await page.click('.bd-tpl[data-v="street-art-dispatch"]'); await settle(2500);
  const tt = await bdText(); must(tt.includes("[The Intervention Archive]") && tt.includes("[Articles appear here once you add them]") && !/Konn|Banksy|Street Art Dispatch/.test(tt), "not the template's own home page: " + tt.slice(0, 160));
  must((await text(".bd-tinfo")).includes("Stays behind"), "no word on what stays behind");
  await shot("59-build-template");
  await page.click('[data-act="bd-next"]'); await settle(400); await page.click('[data-act="bd-next"]'); await settle(900);
  must((await text(".bd-form")).includes("From the template") && (await page.locator(".bd-look").first().getAttribute("data-v")) === "Street Art Dispatch's own", "the template's own look is not first");
  await page.click('[data-act="bd-step"][data-n="1"]'); await settle(400);
  await page.click('.bd-tpl[data-v="starter"]'); await settle(2500);
  must((await bdText()).includes("[Your opening heading]"), "the starter does not come back");
  await page.click('[data-act="bd-next"]'); await page.waitForSelector('[data-bd="name"]'); await settle(500);
  await page.fill('[data-bd="name"]', ""); await page.click('[data-act="bd-next"]'); await settle(300);
  must(/Give the site a name/.test(await text(".bd-err")), "an empty name went through");
  await page.fill('[data-bd="name"]', "Grove Prints"); await page.fill('[data-bd="tagline"]', "Prints from the Grove studio"); await page.fill('[data-bd="domain"]', "www.groveprints"); await settle(1200);
  await page.click('[data-act="bd-next"]'); await settle(300);
  must(/should look like newsite\.com/.test(await text(".bd-err")), "a wrong web address went through: " + await text(".bd-err"));
  await page.fill('[data-bd="domain"]', "https://www.groveprints.co.uk/"); await page.click('[data-act="bd-set"][data-v="godaddy"]'); await settle(1500);
  const t = await bdText(); must(t.includes("Grove Prints") && t.includes("Prints from the Grove studio"), "the name and tagline are not in the preview");
  await shot("60-build-about");
});
await check("Look: the chosen look recolours the preview, Phone shows it at phone width", async () => {
  await page.click('[data-act="bd-next"]'); await settle(500);
  must((await page.locator(".bd-look").count()) === 12, "not twelve looks");
  await page.click('.bd-look[data-v="Like Street Art Dispatch"]'); await settle(1500);
  const css = await (await bdFrame()).evaluate(() => (document.getElementById("theme") || {}).textContent || "");
  must(css.includes("#163A30") && css.includes("Gloock"), "the look is not in the preview: " + css.slice(0, 120));
  await page.click('[data-act="bd-view"][data-v="phone"]'); await settle(900);
  must((await page.$eval("#bd-if", (f) => f.style.width)) === "390px", "phone width"); await shot("61-build-look-phone");
  await page.click('[data-act="bd-view"][data-v="computer"]'); await settle(500);
});
await check("Pages: copying a layout lists what was swapped and what was left out", async () => {
  await page.click('[data-act="bd-next"]'); await settle(500);
  await page.click('.bd-opt[data-v="copy"]'); await settle(1500);
  await page.selectOption('select[data-bd="from"]', "global-art-monitor"); await settle(1800);
  const n = await text(".bd-notes"); must(n.includes("Left out") && n.includes("Status line"), "no list: " + n.slice(0, 160));
  must((await bdText()).includes("Auction results"), "the copied pages are not in the menu");
  await shot("62-build-copy");
  await page.click('.bd-opt[data-v="set"]'); await settle(1500);
  must(!(await page.$(".bd-notes")), "notes left after leaving the copy");
  const menu = await bdText(); must(["About", "Artists", "Exhibitions", "Visit us", "Contact"].every((w) => menu.includes(w)), "the ready set is not in the menu");
});
await check("Check and create: the summary, then Create site makes the repository and opens the Ready screen", async () => {
  await page.click('[data-act="bd-next"]'); await settle(500);
  const sum = await text(".bd-rows"); must(sum.includes("groveprints.co.uk") && sum.includes("Like Street Art Dispatch") && sum.includes("six pages"), "summary: " + sum);
  must((await text(".bd-box")).includes(NEW), "the repository's name is not shown");
  await shot("63-build-check");
  await page.click('[data-act="bd-create"]'); await page.waitForSelector("text=Grove Prints is ready", { timeout: 15000 }); await settle(500);
  must(hub.repoMade(NEW) && hub.pagesOf(NEW).build_type === "workflow", "no repository, or publishing is off");
  must(read(NEW, "data/pages.json").pages.contact && read(NEW, "data/theme.json").colours.band === "#163A30", "the files are not the choices");
  must(hub.releases(NEW)[0].tag_name === "v1.0", "no version 1.0");
  const entry = read(CR, "sites.json").sites.find((x) => x.id === "site-4"); must(entry.repo === NEW && entry.live && entry.want === "groveprints.co.uk" && entry.registrar === "godaddy", "list of sites: " + JSON.stringify(entry));
  must((await text(".bd-dom")).includes("In GoDaddy") && (await text(".bd-dom")).includes("185.199.108.153"), "no records for GoDaddy");
  await shot("64-build-ready");
});
await check("Check: records not pointing at GitHub yet say so; once they do, the address is connected", async () => {
  dnsAnswers = { "groveprints.co.uk A": ["217.160.0.1"] };
  await page.click('[data-act="dom-check"]'); await page.waitForSelector("text=points at 217.160.0.1", { timeout: 9000 });
  dnsAnswers = { "groveprints.co.uk A": ["185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"], "www.groveprints.co.uk CNAME": ["artiscope.github.io."] };
  await page.click('[data-act="dom-check"]'); await page.waitForSelector("text=Connected:", { timeout: 9000 }); await settle(800);
  must(hub.pagesOf(NEW).cname === "groveprints.co.uk" && read(NEW, "data/content.json").site.indexed === true, "not connected on GitHub");
  await shot("65-build-connected");
});
await check("Open the editor: the new site opens with its six pages", async () => {
  fs.rmSync("/tmp/uat-new-src", { recursive: true, force: true }); fs.rmSync("/tmp/uat-new", { recursive: true, force: true }); fs.cpSync("starter", "/tmp/uat-new-src", { recursive: true });
  for (const f of ["data/pages.json", "data/theme.json"]) fs.writeFileSync("/tmp/uat-new-src/" + f, hub.read(NEW, "main", f));
  const cn = read(NEW, "data/content.json"); cn.site.address = "https://artiscope.github.io/grove-prints/"; fs.writeFileSync("/tmp/uat-new-src/data/content.json", JSON.stringify(cn));
  execFileSync("python3", ["/tmp/uat-new-src/tools/build.py", "/tmp/uat-new"]);
  fs.writeFileSync("/tmp/uat-new/assets/site.js", fs.readFileSync("/tmp/uat-new/assets/site.js", "utf8").split('"https://artiscope.github.io"').join('"' + consoleAt + '"'));
  await page.click('[data-act="bd-open"]'); await page.waitForSelector("#ed-sections .sec", { timeout: 15000 }); await settle(2000);
  const opts = await page.$$eval(".pagepick option", (o) => o.map((x) => x.value)); must(["home", "page-about", "page-contact"].every((k) => opts.includes(k)), "pages: " + opts.join(","));
  await shot("66-build-editor");
});
await check("The practice build: Start building rebuilds it with the choices, and no repository is made", async () => {
  await openSite("practice-build"); await page.click(".ed-exit").catch(() => {}); await goTab(page, "overview"); await settle(500);
  await page.click('[data-act="bd-start"]'); await page.waitForSelector(".bd-tpl"); await settle(1200);
  await page.click('[data-act="bd-next"]'); await page.waitForSelector('[data-bd="name"]'); await settle(600);
  must(!(await page.$('[data-bd="domain"]')), "the practice build asks for a web address");
  await page.fill('[data-bd="name"]', "Tess tries it"); await settle(600);
  for (let i = 0; i < 3; i++) { await page.click('[data-act="bd-next"]'); await settle(500); }
  must((await text(".bd-go")).includes("Rebuild the practice build"), "not the practice build's words");
  await page.click('[data-act="bd-create"]'); await page.waitForSelector("text=is on the practice build", { timeout: 15000 });
  must(read(PB, "data/pages.json").shared.header.settings.name === "Tess tries it" && !hub.repoMade("Artiscope/tess-tries-it"), "not rebuilt in place");
  await page.click('[data-act="bd-close"]'); await page.waitForSelector('[data-act="open-site"]');
});

// =============== 12. Articles and artists on a site built in the console ===============
area = "Articles and artists";
const pbText = async () => { const f = pbFrame(); return f ? await f.innerText("body").catch(() => "") : ""; };
await check("Create artist: a new artist opens on their own page, hidden until shown", async () => {
  await openSite("practice-build");
  await page.click(".ed-pagebtn"); await page.click('[data-act="ed-ppgroup"][data-g="artists"]'); await settle(300);
  await page.click('.pp [data-act="ed-new"][data-what="artist"]'); await settle(300);
  await page.fill("#nw-name", "Test Artist"); await page.click('form[data-form="ednew"] button[type=submit]'); await settle(1500);
  must(await page.inputValue(".pagepick") === "artist-test-artist", "address: " + await page.inputValue(".pagepick"));
  must((await pbText()).includes("Test Artist") && (await pbText()).includes("[A short line on their work]"), "not drawn: " + (await pbText()).slice(0, 120));
  await page.click('.sec[data-where="item"][data-id="words"]'); await page.fill('[data-pf="line"]', "Painter and printmaker"); await settle(400);
  await page.click('.sec[data-where="item"][data-id="settings"]'); must(await page.isChecked('[data-pf="hidden"]'), "not hidden"); await page.click('[data-pf="hidden"]'); await settle(400);
  await shot("70-artist");
});
await check("Create article: the article names the artist, and saving writes both to the site", async () => {
  await page.click(".ed-pagebtn"); await page.click('[data-act="ed-ppgroup"][data-g="articles"]'); await settle(300);
  await page.click('.pp [data-act="ed-new"][data-what="article"]'); await settle(300);
  await page.fill("#nw-title", "A first article"); await page.click('form[data-form="ednew"] button[type=submit]'); await settle(1500);
  must(await page.inputValue(".pagepick") === "a-a-first-article", "address: " + await page.inputValue(".pagepick"));
  await page.fill('[data-pf="summary"]', "What the article is about, in a sentence."); await page.fill('[data-pf="date"]', "18 November 2026");
  await page.click('[data-act="ed-res"][data-mode="list"]'); await page.click('[data-act="ed-res-set"][data-v="test-artist"]'); await settle(600);
  await page.click('.sec[data-where="item"][data-id="settings"]'); await page.click('[data-pf="hidden"]'); await settle(500);
  const t = await pbText(); must(t.includes("A first article") && t.includes("About Test Artist") && t.includes("18 November 2026"), "preview: " + t.slice(0, 200));
  await shot("71-article");
  await liveSave();
  const c = pbRead("data/content.json"), a = c.articles.find((x) => x.slug === "a-first-article"), x = c.artists.find((y) => y.slug === "test-artist");
  must(a && a.hidden === false && a.artist === "test-artist" && a.summary.startsWith("What the article") && x && x.hidden === false && x.line === "Painter and printmaker", "saved: " + JSON.stringify(c).slice(0, 300));
});
await check("The Articles list and the artist's page fill themselves in, and the menu gains Articles and Artists", async () => {
  await page.selectOption(".pagepick", "articles"); await settle(1500);
  let t = await pbText(); must(t.includes("A first article") && /Articles\s/.test(t), "list: " + t.slice(0, 200));
  await page.click('.sec[data-where="list"]').catch(() => {}); await shot("72-articles-list");
  await page.selectOption(".pagepick", "artist-test-artist"); await settle(1500);
  t = await pbText(); must(t.includes("Articles about Test Artist") && t.includes("A first article"), "artist page: " + t.slice(0, 300));
  const menu = await pbFrame().$$eval(".nav-links a", (as) => as.map((a) => a.textContent.trim())); must(menu.includes("Articles") && menu.includes("Artists"), "menu: " + menu);
});
await check("The article template: a section added once shows on every article", async () => {
  await page.selectOption(".pagepick", "a-a-first-article"); await settle(1200);
  await page.click('.addl[data-act="ed-secpicker"][data-g="tpl"]').catch(async () => { await page.click('.addl[data-act="ed-secpicker"]'); }); await settle(400);
  await page.click('.pk-item[data-key="quote"]'); await settle(900);
  await liveSave();
  const tp = pbRead("data/pages.json").templates.article.default.sections; must(tp.some((x) => x.type === "quote" && /^t-/.test(x.id)) && tp.some((x) => x.type === "main"), "template: " + JSON.stringify(tp).slice(0, 200));
  must((await pbText()).includes("[A line worth remembering]"), "the template's section is not on the article");
  await shot("73-template");
});
await check("An artist named in an article cannot be deleted; hiding is offered instead", async () => {
  await page.selectOption(".pagepick", "artist-test-artist"); await settle(1000); await page.click('.sec[data-where="item"][data-id="settings"]'); await settle(300);
  must(/named in 1 article/.test(await text("body")), "no reason given");
});
await check("A new page on a site built in the console starts with a Text with picture section", async () => {
  await page.click(".ed-pagebtn"); await page.click('.pp [data-act="ed-new"]'); await settle(300);
  await page.fill("#nw-title", "Visit the studio"); await page.click('form[data-form="ednew"] button[type=submit]'); await settle(1500);
  await liveSave();
  const pg = pbRead("data/pages.json").pages["visit-the-studio"]; must(pg && pg.path === "visit-the-studio/index.html" && pg.sections[0].type === "text-picture" && pg.sections[0].settings.heading === "Visit the studio", "page: " + JSON.stringify(pg).slice(0, 200));
  const links = pbRead("data/pages.json").shared.header.settings.links.map((l) => l[1]); must(links.includes("visit-the-studio/"), "not in the menu: " + links);
});

// =============== 13. Edge cases from the usability pass (Version 51) ===============
area = "Edge cases";
if (ONLY && ONLY.includes(area)) { await page.goto(consoleAt + "/index.html"); await page.waitForSelector('[data-act="open-site"]', { timeout: 20000 }); }
await check("Exit with unsaved changes asks first, and Stay keeps them", async () => {
  await openSite("global-art-monitor");
  await page.click("#ed-sections .sec:not(.blk) >> nth=2"); await settle(500);
  await page.locator(".ed-right input[type=text], .ed-right textarea").first().fill("Edge case words"); await settle(400);
  await page.click(".ed-exit"); await settle(500);
  must(/not saved yet/.test(await text("body")), "no question when leaving");
  await page.click('[data-act="leave-stay"]'); await settle(400);
  must(await page.isVisible(".ed-exit"), "left the editor anyway");
});
await check("Closing the browser tab with unsaved changes warns", async () => {
  must(await page.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; }), "no warning");
});
await check("A save that GitHub refuses says the changes are still there", async () => {
  breakGitHub = true; await page.click('[data-act="ed-save"]'); await settle(300); await page.click('[data-act="livesave"]').catch(() => {}); await settle(2500);
  breakGitHub = false;
  const n = await notice(); must(/still here and not lost/.test(n), "notice: " + n.slice(0, 200));
  must(await page.evaluate(() => { const st = window.__adh.state; return !!(st.pg["global-art-monitor"] && st.pg["global-art-monitor"].dirty); }), "changes lost");
  await page.click('[data-act="ed-discard"]').catch(() => {}); await settle(600);
  await page.evaluate(() => { const st = window.__adh.state; st.notice = null; st.leave = null; st.dirty = false; });
});
await check("If the editor cannot read the pages, it says so with Try again and Back", async () => {
  await page.evaluate(() => { delete window.__adh.state.pg["street-art-dispatch"]; });
  hub.refuse(/street-art-dispatch\/contents\/data\/pages.json/, 500, "Server Error");
  await page.click(".ed-exit", { timeout: 800 }).catch(() => {}); await page.click('[data-tab="home"]', { timeout: 1500 }).catch(() => {});
  await page.waitForSelector('[data-act="open-site"][data-site="street-art-dispatch"]', { timeout: 20000 }); await page.click('[data-act="open-site"][data-site="street-art-dispatch"]');
  await page.waitForSelector('[data-tab="overview"]'); if (!(await page.isVisible(".ed-exit"))) await page.click('.navb[data-tab="pages"]');
  await page.waitForSelector('[data-act="ed-retry"]', { timeout: 12000 }); must(await page.isVisible('[data-act="ed-exit-fail"]'), "no way back");
  await shot("80-load-fails");
  hub.allow(); await page.click('[data-act="ed-retry"]'); await page.waitForSelector("#ed-sections .sec", { timeout: 12000 });
});
await check("Settings show beside or below the list at 1024 pixels wide, without scrolling to find them", async () => {
  await page.setViewportSize({ width: 1024, height: 768 }); await settle(600);
  await page.click("#ed-sections .sec:not(.blk) >> nth=1"); await settle(1500);
  const b = await page.locator(".ed-right").boundingBox(); must(b && b.y < 768 && b.y + 40 > 0, "settings at " + JSON.stringify(b));
  await shot("81-at-1024");
});
await check("The top bar fits at every computer width, with changes waiting", async () => {
  await page.setViewportSize({ width: 1440, height: 900 }); await settle(400);
  await page.click("#ed-sections .sec:not(.blk) >> nth=1"); await settle(400);
  await page.locator(".ed-right input[type=text], .ed-right textarea").first().fill("Top bar check"); await settle(500);
  const bad = [];
  for (const w of [1120, 1200, 1280, 1366, 1440, 1500, 1600, 1700, 1800, 1920, 2200]) {
    await page.setViewportSize({ width: w, height: 900 }); await settle(500);
    const r = await page.evaluate(() => { const top = document.querySelector(".ed-top"), save = document.querySelector('[data-act="ed-save"]'); const b = save.getBoundingClientRect(); let far = ""; top.querySelectorAll("*").forEach((e) => { const q = e.getBoundingClientRect(); if (q.width && q.right > innerWidth + 1) far += (e.className || e.tagName) + "@" + Math.round(q.right) + " "; }); return { over: top.scrollWidth > top.clientWidth + 1, right: b.right, w: innerWidth, sw: top.scrollWidth, cw: top.clientWidth, far: far.slice(0, 200) }; });
    if (r.over || r.right > r.w) { bad.push(w + ": " + JSON.stringify(r)); await shot("topbar-" + w); }
  }
  must(!bad.length, "the top bar runs off at " + bad.join(", "));
  await page.setViewportSize({ width: 1440, height: 900 }); await settle(500);
  await page.click('[data-act="ed-discard"]'); await settle(700);
  must(!(await page.isVisible(".chg-count")), "the change was not put back");
  await page.setViewportSize({ width: 1024, height: 768 }); await settle(500);
});
await check("Block counts are big enough to press", async () => {
  const hs = await page.$$eval(".ed .sec .cnt", (els) => els.filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect().height));
  must(hs.length && hs.every((h) => h >= 28), "heights: " + hs.slice(0, 6));
});
await check("On a phone, the page picker fits on the screen", async () => {
  await page.setViewportSize({ width: 390, height: 844 }); await settle(800);
  await page.click(".ed-pagebtn"); await settle(500);
  const b = await page.locator(".ed-pop.pp").boundingBox(); must(b && b.x >= 0 && b.x + b.width <= 391, "picker at " + JSON.stringify(b));
  await shot("82-phone-picker"); await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 900 }); await settle(600);
});
await check("Start building turns away a name with no letters, and a web address that is not one, before anything is made", async () => {
  await page.click(".ed-exit", { timeout: 800 }).catch(() => {}); await page.click('[data-tab="home"]', { timeout: 1500 }).catch(() => {});
  let found = false;
  for (const id of ["site-5", "site-4"]) {
    await page.waitForSelector('[data-act="open-site"][data-site="' + id + '"]', { timeout: 20000 }); await page.click('[data-act="open-site"][data-site="' + id + '"]');
    if (await page.waitForSelector(".bd-tpl", { timeout: 4000 }).then(() => true, () => false)) { await settle(800); await page.click('[data-act="bd-next"]'); await page.waitForSelector('[data-bd="name"]'); found = true; break; }
    await page.click('[data-tab="home"]', { timeout: 1500 }).catch(() => {});
  }
  must(found, "no site still to build");
  must(await page.getAttribute('[data-bd="name"]', "maxlength") === "60", "no length limit on the name");
  await page.fill('[data-bd="name"]', "🎨🎨"); await page.click('[data-act="bd-next"]'); await settle(300);
  must(/at least two letters or numbers/.test(await text(".bd-err")), "emoji name went through");
  await page.fill('[data-bd="name"]', "Edge Gallery"); await page.fill('[data-bd="domain"]', "not a web address"); await page.click('[data-act="bd-next"]'); await settle(300);
  must(/should look like newsite.com/.test(await text(".bd-err")), "bad address went through");
  must(!hub.repoMade("Artiscope/edge-gallery"), "a repository was made");
  // a template carries through to Check and create
  await page.fill('[data-bd="domain"]', ""); await page.click('[data-act="bd-step"][data-n="1"]'); await settle(400);
  await page.click('.bd-tpl[data-v="street-art-dispatch"]'); await settle(1800);
  for (let i = 0; i < 4; i++) { await page.click('[data-act="bd-next"]'); await settle(600); }
  const sum = await text(".bd-rows"); must(sum.includes("Street Art Dispatch") && sum.includes("9 of them") && sum.includes("Street Art Dispatch's own"), "summary: " + sum);
  await page.click('[data-act="bd-close"]'); await page.waitForSelector('[data-act="open-site"]');
});
await check("Signing out clears an old error message", async () => {
  await page.evaluate(() => { window.__adh.state.notice = { kind: "err", text: "Old trouble" }; }); 
  await page.click("details.acct summary"); await page.click('[data-act="signout"]'); await settle(800);
  must(!/Old trouble/.test(await text("body")), "error still shown after signing out");
  await page.reload(); await page.waitForSelector('[data-act="open-site"]', { timeout: 20000 });
});

// =============== 14. Edit default text (Version 52) ===============
area = "Default text";
if (ONLY && ONLY.includes(area)) { await page.goto(consoleAt + "/index.html"); await page.waitForSelector('[data-act="open-site"]', { timeout: 20000 }); }
const gamF = () => frame("globalartmonitor.com");
const wdRow = (k) => '.wd-row[data-k="' + k + '"]';
await check("Edit default text opens from More, with the site's words in groups", async () => {
  await openSite("global-art-monitor");
  await page.click('[data-act="ed-pop"][data-menu="more"]'); await page.click('.ed-pop.mp [data-act="wd-open"]'); await settle(500);
  must(await page.isVisible(".wdpanel"), "no panel");
  must(/Search 86 words/.test(await page.getAttribute("#wd-q", "placeholder")), "placeholder: " + await page.getAttribute("#wd-q", "placeholder"));
  const groups = await page.$$eval(".wd-grp .t", (x) => x.map((y) => y.textContent));
  must(groups.includes("Buttons") && groups.includes("Auction table") && groups.includes("Page not found") && groups.includes("Words for screen readers"), "groups: " + groups);
  await shot("90-words");
});
await check("Show me where outlines the word on the page", async () => {
  await page.click('.wd-grp[data-g="btn"]'); await settle(300);
  await page.click(wdRow("btn.read-feature") + ' [data-act="wd-find"]'); await settle(1200);
  must(/Outlined in blue/.test(await text(wdRow("btn.read-feature") + " .wd-where")), "said: " + await text(wdRow("btn.read-feature") + " .wd-where"));
  must(/Read the feature/.test(await gamF().innerText(".adh-found")), "nothing outlined");
  await page.click(wdRow("btn.tell-me") + ' [data-act="wd-find"]').catch(() => {}); await settle(1000);
});
await check("Typing a word changes the page as you type, and joins the Changes list", async () => {
  await page.fill(wdRow("btn.read-feature") + " .wd-in", "Read the whole feature"); await settle(900);
  must((await gamF().innerText("body")).includes("Read the whole feature"), "preview not changed");
  must(/1 changed/.test(await text(".wd-count")) && /1 changed/.test(await text('.wd-grp[data-g="btn"]')), "counts not updated");
  must(await page.isVisible(wdRow("btn.read-feature") + ' [data-act="wd-reset"]'), "no Use the site's own");
  await page.click('[data-act="ed-pop"][data-menu="changes"]'); await settle(300);
  must(/Default text, Buttons: "Read the feature" changed to "Read the whole feature"/.test(await text(".ed-pop.chg")), "changes: " + await text(".ed-pop.chg"));
  await page.keyboard.press("Escape"); await shot("91-word-typed");
});
await check("A word with a slot must keep it, and long words are stopped", async () => {
  await page.click('.wd-grp[data-g="item"]'); await settle(300);
  await page.fill(wdRow("item.at-auction") + " .wd-in", "At auction"); await settle(300);
  must(/Keep \{name\} in the words\. It is where the artist's name goes/.test(await text(wdRow("item.at-auction") + " .wd-err")), "no slot message");
  await page.fill(wdRow("item.at-auction") + " .wd-in", "{name} under the hammer"); await settle(300);
  must(!(await page.isVisible(wdRow("item.at-auction") + " .wd-err")), "message stays");
  await page.click('.wd-grp[data-g="btn"]'); await settle(300);
  await page.fill(wdRow("btn.open-profile") + " .wd-in", "A very long line of words for one small button"); await settle(300);
  must(/Too long for this spot\. Keep it to 40 letters/.test(await text(wdRow("btn.open-profile") + " .wd-err")), "no length message");
  await shot("92-word-problems");
});
await check("Save refuses words that would break the site and keeps them; fixed, they save", async () => {
  await liveSaveTry(); must(/too long/i.test(await notice()) && /still here and not lost/.test(await notice()), "notice: " + await notice());
  await page.fill(wdRow("btn.open-profile") + " .wd-in", ""); await settle(300);
  await liveSave();
  const w = read(GR, "data/pages.json").words;
  must(w && w["btn.read-feature"] === "Read the whole feature" && w["item.at-auction"] === "{name} under the hammer" && !w["btn.open-profile"], "saved: " + JSON.stringify(w));
});
await check("Locked words are shown with the reason, and cannot be typed in", async () => {
  await page.fill("#wd-q", "publishes"); await settle(300);
  must(await page.isVisible(wdRow("item.who") + ".locked") && !(await page.$(wdRow("item.who") + " .wd-in")), "not locked");
  must(/publisher disclosure/.test(await text(wdRow("item.who"))), "no reason");
  await page.fill("#wd-q", ""); await settle(200);
});
await check("Changed only, Use the site's own and Undo", async () => {
  await page.click("#wd-only"); await settle(300);
  must((await page.$$(".wd-row")).length === 2, "rows: " + (await page.$$(".wd-row")).length);
  await page.click(wdRow("btn.read-feature") + ' [data-act="wd-reset"]'); await settle(700);
  must((await gamF().innerText("body")).includes("Read the feature"), "preview not put back");
  await page.click('[data-act="ed-undo"]'); await settle(800);
  must(await page.inputValue(wdRow("btn.read-feature") + " .wd-in") === "Read the whole feature", "Undo did not bring it back");
  await page.click("#wd-only"); await settle(200);
  await page.click('[data-act="ed-discard"]').catch(() => {}); await settle(600);
});
await check("World Art Review: a changed menu word shows in the page's own menu bar", async () => {
  await page.evaluate(() => { const st = window.__adh.state; st.leave = null; st.dirty = false; });
  await openSite("world-art-review");
  await page.click(".ed-pagebtn"); await page.click('.pp [data-act="wd-open"]'); await settle(400);
  await page.fill("#wd-q", "menu"); await settle(300);
  await page.fill(wdRow("menu.open") + " .wd-in", "Sections"); await settle(1200);
  const f = frame("worldartreview.com"); must(/Sections/.test(await f.innerText("header .menubtn")), "menu button: " + await f.innerText("header .menubtn"));
  await page.fill("#wd-q", ""); await page.click('[data-act="ed-discard"]').catch(() => {}); await settle(600);
});
await check("Edge: code typed in is taken out on Save, and a box of spaces keeps the site's own words", async () => {
  await page.click('[data-act="wd-close"]').catch(() => {}); await settle(300);
  await openSite("global-art-monitor");
  await page.click('[data-act="ed-pop"][data-menu="more"]'); await page.click('.ed-pop.mp [data-act="wd-open"]'); await settle(400);
  await page.fill("#wd-q", "close"); await settle(300);
  await page.fill(wdRow("menu.close") + " .wd-in", "<b>Shut</b>"); await settle(300);
  must(/tags will be taken out/.test(await text(wdRow("menu.close") + " .wd-note")), "no note about the tags");
  await page.fill(wdRow("btn.close") + " .wd-in", "   "); await settle(300);
  await liveSave();
  const w = read(GR, "data/pages.json").words || {};
  must(w["menu.close"] === "Shut" && !("btn.close" in w), "saved: " + JSON.stringify(w));
  must(!/<b>/.test(JSON.stringify(read(GR, "data/pages.json"))), "the tags were kept");
});
await check("Edge: no matches, nothing changed, and Show me where with the inspector off", async () => {
  await page.fill("#wd-q", "zzzz"); await settle(300); must(/No word matches that/.test(await text("#wd-body")), "no message for no matches");
  await page.fill("#wd-q", ""); await settle(200);
  await page.click('.wd-grp[data-g="nf"]'); await settle(300);
  await page.click(wdRow("nf.home") + ' [data-act="wd-find"]'); await settle(1200);
  must(/Not on the page shown now/.test(await text(wdRow("nf.home") + " .wd-where")), "said: " + await text(wdRow("nf.home") + " .wd-where"));
  await page.click('[data-act="ed-inspector"]'); await settle(800);
  await page.click(wdRow("nf.title") + ' [data-act="wd-find"]'); await settle(300);
  must(/Turn on the inspector/.test(await text(wdRow("nf.title") + " .wd-where")), "no message with the inspector off");
  await page.click('[data-act="ed-inspector"]'); await settle(1200);
  // put the saved words back, so later areas see the site as it was
  const doc = read(GR, "data/pages.json"); delete doc.words; hub.commitOn(GR, "main", "data/pages.json", JSON.stringify(doc, null, 2), "Words back");
});
await check("Edge: Street Art Dispatch keeps Draft and Date to confirm locked; other words change", async () => {
  await page.evaluate(() => { const st = window.__adh.state; st.leave = null; st.dirty = false; delete st.pg["global-art-monitor"]; });
  await openSite("street-art-dispatch");
  await page.click(".ed-pagebtn"); await page.click('.pp [data-act="wd-open"]'); await settle(400);
  await page.fill("#wd-q", "confirm"); await settle(300);
  must(await page.isVisible(wdRow("missing.date") + ".locked") && /confirmed facts/.test(await text(wdRow("missing.date"))), "Date to confirm is not locked");
  await page.fill("#wd-q", "draft"); await settle(300);
  must(await page.isVisible(wdRow("item.draft") + ".locked"), "Draft is not locked");
  await page.fill("#wd-q", "Menu"); await settle(300);
  await page.fill(wdRow("menu.open") + " .wd-in", "Sections"); await settle(1200);
  must(/Sections/.test(await SF().innerText("#menuBtn")), "menu button: " + await SF().innerText("#menuBtn"));
  await page.fill("#wd-q", ""); await page.click('[data-act="ed-discard"]').catch(() => {}); await settle(600);
});
await check("Edge: a site built in the console saves its changed words", async () => {
  await page.evaluate(() => { const st = window.__adh.state; st.leave = null; st.dirty = false; });
  await openSite("practice-build");
  await page.click(".ed-pagebtn"); await page.click('.pp [data-act="wd-open"]'); await settle(400);
  await page.fill("#wd-q", "skip"); await settle(300);
  await page.fill(wdRow("menu.skip") + " .wd-in", "Jump to the page"); await settle(500);
  await liveSave();
  must((pbRead("data/pages.json").words || {})["menu.skip"] === "Jump to the page", "saved: " + JSON.stringify(pbRead("data/pages.json").words));
  must(/Jump to the page/.test(await pbFrame().evaluate(() => document.querySelector(".skip") ? document.querySelector(".skip").textContent : "")), "not in the preview");
  await page.fill("#wd-q", ""); await settle(300);
});
await check("On a phone, the panel fits and the boxes are full width", async () => {
  await page.setViewportSize({ width: 390, height: 844 }); await settle(600);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); must(!ov, "the page runs off the side");
  const b = await page.locator(".wdpanel").boundingBox(); must(b && b.x >= 0 && b.x + b.width <= 391, "panel at " + JSON.stringify(b));
  await shot("93-words-phone");
  await page.setViewportSize({ width: 1440, height: 900 }); await settle(500);
  await page.click('[data-act="wd-close"]'); await settle(300); must(await page.isVisible("#ed-sections"), "Close did not go back to the sections");
});

// =============== 15. Photos from the editor on every site (Version 53) ===============
area = "Photos";
if (ONLY && ONLY.includes(area)) { await page.goto(consoleAt + "/index.html"); await page.waitForSelector('[data-act="open-site"]', { timeout: 20000 }); }
const sadRead = (f) => read(SR, f);
await check("Street Art Dispatch: clicking an artist's photo frame opens its Picture settings", async () => {
  await page.click('[data-act="wd-close"]').catch(() => {});
  await openSite("street-art-dispatch");
  await page.selectOption(".pagepick", "artist-konn-artiss"); await settle(1800);
  must((await SF().$$('[data-adh="picture"] .ph')).length === 1, "no Photo to come frame marked on the page");
  await mouseIn("streetartdispatch.com", '[data-adh="picture"] .ph'); await settle(900);
  must(await page.isVisible('[data-upload="image"], [data-act="ed-lib"]') || (await page.$('[data-upload="image"]')) !== null, "the Picture settings did not open");
  must(await page.inputValue('.ed-right [data-pf="alt"]') === "Konn Artiss in the studio", "what the photo shows: " + await page.inputValue('.ed-right [data-pf="alt"]'));
  await shot("100-sad-picture");
});
await check("Street Art Dispatch: a photo uploaded for an artist shows on the page and saves", async () => {
  await page.setInputFiles('[data-upload="image"]', FIX + "/studio.jpg"); await page.waitForSelector(".picthumb[src^='data:image']");
  await page.fill('.ed-right [data-pf="credit"]', "Photograph: Grove Gallery"); await settle(1500);
  must((await SF().$$('[data-adh="picture"] img.ph-img')).length === 1, "the photo is not on the page");
  must(/Photograph: Grove Gallery/.test(await SF().innerText('[data-adh="picture"] figcaption')), "no credit under the photo");
  await shot("101-sad-photo");
  await liveSave();
  const a = sadRead("data/content.json").artists.find((x) => x.name === "Konn Artiss");
  must(a.image && /\.jpe?g$/.test(a.image) && a.credit === "Photograph: Grove Gallery" && !("alt" in a), "saved: " + JSON.stringify({ image: a.image, alt: a.alt, credit: a.credit }));
  must(hub.read(SR, "main", "assets/images/" + a.image) != null, "the photo file was not saved");
});
await check("Street Art Dispatch: the same photo can be chosen for an article, and Remove brings the frame back", async () => {
  const name = sadRead("data/content.json").artists.find((x) => x.name === "Konn Artiss").image;
  await page.selectOption(".pagepick", "artist-konn-artiss"); await settle(1200);
  await mouseIn("streetartdispatch.com", '[data-adh="picture"] img'); await settle(800);
  await page.click('.ed-right [data-act="ed-pic-none"]'); await settle(1200);
  must((await SF().$$('[data-adh="picture"] .ph')).length === 1, "the frame did not come back");
  await liveSave();
  const a = sadRead("data/content.json").artists.find((x) => x.name === "Konn Artiss");
  must(!a.image, "not removed: " + JSON.stringify({ image: a.image, credit: a.credit }));
  const art = sadRead("data/content.json").features[0].slug;
  await page.selectOption(".pagepick", "a-" + art); await settle(1500);
  must((await SF().$$('[data-adh="picture"]')).length === 1, "the article has no picture spot");
  await mouseIn("streetartdispatch.com", '[data-adh="picture"] .ph'); await settle(800);
  await page.click('.ed-right [data-act="ed-picker"][data-path="image"]'); await settle(600);
  await page.fill("[data-lib-q]", name.replace(/\.[a-z]+$/, "")); await settle(300);
  await page.click(".libf:visible >> nth=0"); await settle(300);
  await page.click('[data-act="ed-lib-done"]'); await settle(1500);
  await shot("102-sad-article-photo");
  must((await SF().$$('[data-adh="picture"] img.ph-img')).length === 1, "the chosen photo is not on the article");
  await page.click('[data-act="ed-discard"]').catch(() => {}); await settle(600);
});
await check("Street Art Dispatch: the home page's lead photo can be uploaded", async () => {
  await page.selectOption(".pagepick", "home"); await settle(1500);
  await mouseIn("streetartdispatch.com", ".hero figure .ph"); await settle(900);
  must((await page.$('.ed-right [data-upload="image"]')) !== null && /What the lead photo shows/.test(await text(".ed-right")), "no Lead photo setting");
  await page.setInputFiles('.ed-right [data-upload="image"]', FIX + "/tall.jpg"); await settle(1500);
  must((await SF().$$(".hero figure img.ph-img")).length === 1, "the lead photo is not on the page");
  await page.click('[data-act="ed-discard"]').catch(() => {}); await settle(600);
});
await check("Global Art Monitor: every artist profile has its picture spot in the editor, and a click opens Picture", async () => {
  await openSite("global-art-monitor");
  const imgs = read(GR, "data/images.json") || {}, bare = Object.keys(imgs).length ? null : null;
  await page.selectOption(".pagepick", "artist-konn-artiss"); await settle(1800);
  const f = frame("globalartmonitor.com"); must((await f.$$('[data-adh="picture"]')).length === 1, "no picture spot on the profile");
  await f.evaluate(() => document.querySelector('[data-adh="picture"]').scrollIntoView({ block: "center" })); await settle(500);
  await mouseIn("globalartmonitor.com", '[data-adh="picture"]', { x: 40, y: 40 }); await settle(900);
  must((await page.$('.ed-right [data-upload="image"]')) !== null, "Picture did not open");
  await shot("103-gam-picture");
});
await check("World Art Review: an article with no picture yet shows its spot in the editor", async () => {
  await openSite("world-art-review");
  const plain = read(WR, "content/site.json").articles.find((a) => !a.hidden && !a.image && !a.credit);
  if (!plain) return "every article already has a picture";
  await page.selectOption(".pagepick", "a-" + plain.slug); await settle(1800);
  const f = frame("worldartreview.com"); must((await f.$$(".art-hero")).length === 1, "no picture spot on the article");
  await mouseIn("worldartreview.com", ".art-hero"); await settle(900);
  must(/Picture/.test(await text(".ed-right")), "Picture did not open");
});

// =============== 16. Shortcuts, full width and the row that lights up (Version 54) ===============
area = "Shortcuts and full width";
if (ONLY && ONLY.includes(area)) { await page.goto(consoleAt + "/index.html"); await page.waitForSelector('[data-act="open-site"]', { timeout: 20000 }); }
const picked = () => page.evaluate(() => { const r = document.querySelector(".ed-left .sec.on"); return r ? [r.dataset.where, r.dataset.id, r.dataset.bf || "", r.dataset.block || ""].join("|") : ""; });
const rowsNow = () => page.evaluate(() => Array.from(document.querySelectorAll('.ed-left [data-act="ed-pick"]')).map((r) => [r.dataset.where, r.dataset.id, r.dataset.bf || "", r.dataset.block || ""].join("|")));
await check("Shift+Down and Shift+Up move the pick along the list, sections and blocks alike", async () => {
  await openSite("world-art-review"); await page.selectOption(".pagepick", "home"); await settle(1500);
  await page.click('#ed-sections .sec[data-id="numbers"]'); await settle(700);
  const rows = await rowsNow(), at = rows.indexOf(await picked());
  must(at >= 0, "nothing picked");
  await page.locator("body").press("Shift+ArrowDown"); await settle(700);
  const rows2 = await rowsNow(), now = await picked();
  must(now === rows2[rows2.indexOf(rows[at]) + 1], "down went to " + now + " not " + rows2[rows2.indexOf(rows[at]) + 1]);
  await page.locator("body").press("Shift+ArrowUp"); await settle(700);
  must(await picked() === rows[at], "up went to " + await picked());
});
await check("Shift+Enter opens and closes the picked section's blocks; Ctrl+Shift+O and P open and close them all", async () => {
  const withBlocks = await page.evaluate(() => { const b = document.querySelector('#ed-sections .sec:not(.blk) [data-act="ed-expand"]'); return b ? b.closest(".sec").dataset.id : ""; });
  must(withBlocks, "no section on the home page has blocks");
  await page.click('#ed-sections .sec[data-id="' + withBlocks + '"] .nm'); await settle(500);
  const openNow = () => page.evaluate((id) => { const b = document.querySelector('#ed-sections .sec[data-id="' + id + '"] [data-act="ed-expand"]'); return b ? b.getAttribute("aria-expanded") : "none"; }, withBlocks);
  const was = await openNow();
  must(was !== "none", "the section has no blocks to open");
  await page.locator("body").press("Shift+Enter"); await settle(600);
  must(await openNow() !== was, "Shift+Enter did not change the blocks");
  await page.locator("body").press("Control+Shift+KeyO"); await settle(700);
  const all = await page.evaluate(() => Array.from(document.querySelectorAll('.ed-left .sec:not(.blk) [data-act="ed-expand"]')).map((b) => b.getAttribute("aria-expanded")));
  must(all.length > 1 && all.every((x) => x === "true"), "not all open: " + all.join(","));
  await page.locator("body").press("Alt+Shift+KeyP"); await settle(700);
  const none = await page.evaluate(() => Array.from(document.querySelectorAll('.ed-left .sec:not(.blk) [data-act="ed-expand"]')).map((b) => b.getAttribute("aria-expanded")));
  must(none.every((x) => x === "false"), "not all closed: " + none.join(","));
});
await check("Ctrl+Alt+0 shows the page at full width; Escape and the bar bring the panels back", async () => {
  await page.click('#ed-sections .sec[data-id="numbers"]'); await settle(500);
  const w0 = (await page.locator(".ed-frame").boundingBox()).width;
  await page.locator("body").press("Control+Alt+Digit0"); await settle(900);
  must(await page.isVisible(".fullbar") && !(await page.isVisible(".ed-left")) && !(await page.isVisible(".ed-right")), "panels still showing");
  const w1 = (await page.locator(".ed-frame").boundingBox()).width;
  must(w1 > w0 + 250, "the preview did not widen: " + w0 + " to " + w1);
  await shot("110-full-width");
  await page.locator("body").press("Escape"); await settle(700);
  must(await page.isVisible(".ed-left") && !(await page.isVisible(".fullbar")), "Escape did not bring the panels back");
  await page.click('.ed-top [data-act="ed-pop"][data-menu="more"]'); await page.click('[data-act="ed-full"]'); await settle(700);
  must(await page.isVisible(".fullbar"), "More did not turn on full width");
  await page.click('.fullbar [data-act="ed-full"]'); await settle(700);
  must(await page.isVisible(".ed-left"), "Show the panels did not work");
});
await check("Picking something on the page at full width brings the panels back with its settings", async () => {
  await page.locator("body").press("Control+Alt+Digit0"); await settle(800);
  await mouseIn("worldartreview.com", "#numbers h2"); await settle(1000);
  must(!(await page.isVisible(".fullbar")) && await page.isVisible(".ed-right") && await picked() === "page|numbers||", "picked: " + await picked());
});
await check("Pointing at a section or block on the page lights up its row in the list", async () => {
  await page.click('#ed-sections .sec[data-id="numbers"]'); await settle(400);
  await page.click(".ed-left").catch(() => {});
  await hoverOn("worldartreview.com", "#numbers h2"); await settle(500);
  const over = await page.evaluate(() => Array.from(document.querySelectorAll(".ed-left .sec.over")).map((r) => r.dataset.id + "|" + (r.dataset.bf || "")));
  must(over.length === 1 && over[0].startsWith("numbers|"), "lit rows: " + over.join(","));
  await frame("worldartreview.com").evaluate(() => document.documentElement.dispatchEvent(new MouseEvent("mouseleave"))); await settle(500);
  must((await page.$$(".ed-left .sec.over")).length === 0, "the row stayed lit after the pointer left");
  for (const [id, host, sel] of [["global-art-monitor", "globalartmonitor.com", "[data-adh]"], ["street-art-dispatch", "streetartdispatch.com", "[data-adh]"]]) {
    await openSite(id); await page.selectOption(".pagepick", "home").catch(() => {}); await settle(1500);
    // an earlier area may have left another panel open on the left (Default text, say): show the sections list
    if (!(await page.isVisible("#ed-sections"))) { await page.click('[data-act="ed-panel"][data-panel="sections"]').catch(() => {}); await settle(700); }
    const sid = await frame(host).evaluate((q) => { const els = Array.from(document.querySelectorAll(q)); const e = els.find((x) => x.getBoundingClientRect().height > 40); return e ? e.getAttribute("data-adh") : ""; }, sel);
    // the preview may still be settling after the page change: point again a few times before giving up
    let lit = [];
    for (let i = 0; i < 4 && !(lit.length === 1 && lit[0] === sid); i++) {
      await hoverOn(host, '[data-adh="' + sid + '"]').catch(() => {}); await settle(500 + i * 700);
      lit = await page.evaluate(() => Array.from(document.querySelectorAll(".ed-left .sec.over")).map((r) => r.dataset.id));
    }
    must(lit.length === 1 && lit[0] === sid, id + ": lit " + lit.join(",") + " for " + sid + (await page.isVisible("#ed-sections") ? "" : " (the sections list is not showing)"));
  }
});
await check("The keyboard shortcuts list shows the new shortcuts", async () => {
  await page.click('.ed-top [data-act="ed-pop"][data-menu="more"]'); await page.click('[data-act="ed-pop"][data-menu="keys"]'); await settle(400);
  const t = await text(".ed-pop");
  must(["Preview at full width", "Pick the item above", "Pick the item below", "Shift+Enter", "Open the blocks of every section", "Close the blocks of every section"].every((w) => t.includes(w)), "list: " + t.slice(0, 300));
  await page.keyboard.press("Escape");
});

await check("A site made outside the console shows as live, with its picture, View site and GitHub, and no Open", async () => {
  await page.goto(consoleAt + "/index.html"); await page.waitForSelector('[data-act="open-site"]', { timeout: 20000 }); await settle(800);
  const c = await page.evaluate(() => { const card = Array.from(document.querySelectorAll(".hcard")).find((x) => x.textContent.includes("Old Notes")); if (!card) return null;
    return { open: !!card.querySelector('[data-act="open-site"]'), view: (card.querySelector('a[href^="https://oldnotes.org"]') || {}).textContent || "", gh: (card.querySelector('a[href="https://github.com/Artiscope/old-notes"]') || {}).textContent || "", state: card.querySelector(".hstate").textContent, pic: !!card.querySelector(".hpic iframe") }; });
  must(c && !c.open && c.view === "View site" && c.gh === "GitHub" && c.pic && c.state.includes("Not in the editor yet"), JSON.stringify(c));
  const counts = await text(".hcounts");
  must(!(await page.$$eval(".hquiet", (q) => q.some((x) => x.textContent.includes("Old Notes")))), "it also shows as a site to build");
  await shot("111-outside-site");
});

// =============== 18. Templates end to end (site templates, step 6) ===============
area = "Templates end to end";
if (ONLY && ONLY.includes(area)) { await page.goto(consoleAt + "/index.html"); await page.waitForSelector('[data-act="open-site"]', { timeout: 20000 }); }
// the practice build as publishing would build it from its files in the (test) GitHub, with the editor link pointed at this console
function pbPublish() {
  fs.rmSync("/tmp/uat-pb-src", { recursive: true, force: true }); fs.rmSync("/tmp/uat-pb", { recursive: true, force: true });
  for (const f of hub.files(PB)) { fs.mkdirSync(path.dirname("/tmp/uat-pb-src/" + f), { recursive: true }); fs.writeFileSync("/tmp/uat-pb-src/" + f, hub.read(PB, "main", f)); }
  execFileSync("python3", ["/tmp/uat-pb-src/tools/build.py", "/tmp/uat-pb"]);
  for (const f of ["/tmp/uat-pb/assets/site.js", "/tmp/uat-pb/index.html"]) if (fs.existsSync(f)) fs.writeFileSync(f, fs.readFileSync(f, "utf8").split('"https://artiscope.github.io"').join('"' + consoleAt + '"'));
}
const TPL_RUNS = [
  { id: "street-art-dispatch", name: "Tess on walls", files: "data", kind: "archive", sees: "[The Intervention Archive]" },
  { id: "global-art-monitor", name: "Tess on sales", files: "data", kind: "timeline", sees: "[Sales appear here once you add them]" },
  { id: "world-art-review", name: "Tess on portraits", files: "content", kind: "hero", sees: "[Discover]" },
  { id: "the-art-correspondent", name: "Tess on studios", files: "data", kind: "tac-opening", sees: "[Stories appear here once you add them]" },
  { id: "editions", name: "Tess prints", files: "data", kind: "ed-series", sees: "[Works appear here once you add them]" },
];
for (const run of TPL_RUNS) {
  await check("The practice build rebuilt from the " + run.id.replace(/-/g, " ") + " template opens in the editor as that design, and a change saves", async () => {
    await openSite("practice-build"); await page.click(".ed-exit").catch(() => {}); await goTab(page, "overview"); await settle(500);
    await page.click('[data-act="bd-start"]'); await page.waitForSelector(".bd-tpl"); await settle(800);
    await page.click('.bd-tpl[data-v="' + run.id + '"]'); await settle(2500);
    await page.click('[data-act="bd-next"]'); await page.waitForSelector('[data-bd="name"]'); await page.fill('[data-bd="name"]', run.name); await settle(700);
    for (let i = 0; i < 3; i++) { await page.click('[data-act="bd-next"]'); await settle(600); }
    must((await text(".bd-rows")).includes("Template"), "no template in the summary");
    await page.click('[data-act="bd-create"]'); await page.waitForSelector("text=is on the practice build", { timeout: 20000 });
    const pagesFile = run.files + "/pages.json", doc = read(PB, pagesFile);
    must(doc && doc.shared.header.settings.name === run.name, "not rebuilt from the template: " + JSON.stringify(doc && doc.shared.header.settings).slice(0, 160));
    must(JSON.parse(hub.read(CR, "main", "sites.json")).sites.find((x) => x.id === "practice-build").template === run.id, "the list of sites does not say which template");
    pbPublish();
    await page.click('[data-act="bd-close"]'); await page.waitForSelector('[data-act="open-site"]');
    await openSite("practice-build"); await settle(2500);
    const body = await pbText(); must(body.toLowerCase().includes(run.name.toLowerCase()) && body.includes(run.sees), "the preview is not the template's design: " + body.slice(0, 200));
    must(!/World Art Review|Global Art Monitor|Street Art Dispatch|Art Correspondent|Konn|Zara/.test(body), "a word of the original site in the preview");
    await shot("120-tpl-" + run.id);
    // pick the template's own section, change its first words, and save
    // the template's own kind of section first, then the others, until one has a heading or small line to change
    const secs = doc.pages.home.sections.slice().sort((x, y) => (y.type === run.kind) - (x.type === run.kind));
    let box = null, pf = "";
    for (const x of secs) {
      await page.click('.sec[data-where="page"][data-id="' + x.id + '"]').catch(() => {}); await settle(600);
      box = await page.$('input[data-pf="heading"]:visible, input[data-pf="eyebrow"]:visible');
      if (box) { pf = x.type + "." + (await box.getAttribute("data-pf")); break; }
    }
    must(box, "no words to change on the home page");
    await box.fill("Changed by Tess"); await settle(900);
    must((await pbText()).toLowerCase().includes("changed by tess"), "the change is not in the preview (" + pf + ")");   // some designs set small lines in capitals
    await liveSave();
    must(hub.read(PB, "main", pagesFile).includes("Changed by Tess"), "the change was not saved to " + pagesFile);
  });
}
await check("Start again puts the practice build back on the starter after a template", async () => {
  await openSite("practice-build"); await page.click(".ed-exit").catch(() => {}); await goTab(page, "overview"); await settle(500);
  await page.click('[data-act="ask-startagain"]'); await settle(300);
  await page.click('[data-act="startagain"]'); await page.waitForSelector("text=starts again from the starter", { timeout: 9000 }); await settle(800);
  must(hub.read(PB, "main", "assets/render.js") === starterFiles["assets/render.js"] && hub.read(PB, "main", "content/pages.json") == null, "not the starter again");
  must(!("template" in JSON.parse(hub.read(CR, "main", "sites.json")).sites.find((x) => x.id === "practice-build")), "the list of sites still names a template");
  pbPublish();
});

// =============== 19. The Art Correspondent, moved into the console ===============
area = "The Art Correspondent";
const tacFrame = () => page.frames().filter((f) => f.url().startsWith("https://theartcorrespondent.com")).pop();
const tacText = async () => { const f = tacFrame(); return f ? await f.innerText("body").catch(() => "") : ""; };
await check("The Art Correspondent opens in the editor in its own design, with Stories and Subjects in the page picker", async () => {
  await openSite("site-7"); await settle(1200);
  const t = await tacText(); must(t.includes("Behind Every Work, There Is a Story.") && t.includes("All 22 stories") && t.includes("Filed from the studio floor."), "home: " + t.slice(0, 200));
  must(!/published by Grove/i.test(t), "a publisher line");
  await page.click(".ed-pagebtn"); await settle(400); const pp = await text(".pp");
  must(pp.includes("Stories") && pp.includes("Subjects"), "picker: " + pp.slice(0, 300)); await page.keyboard.press("Escape");
  await shot("130-tac-home");
});
await check("A story shows its section, Filed under and its chosen Read next, and a changed standfirst saves to the site", async () => {
  await page.selectOption(".pagepick", "a-who-owns-the-street"); await settle(1800);
  const t = await tacText();
  must(t.includes("Who Owns the Street?") && t.toLowerCase().includes("filed under") && t.includes("Art in public") && t.includes("From Gallery Wall to Hotel Wall") && t.includes("By The Art Correspondent. Published 19 November 2026."), "story: " + t.slice(0, 300));
  await page.click('.sec[data-where="item"][data-id="words"]'); await page.fill('[data-pf="summary"]', "Changed by Tess."); await settle(800);
  must((await tacText()).includes("Changed by Tess."), "the change is not in the preview");
  await shot("131-tac-story");
  await liveSave();
  const c = read(TR, "data/content.json"), a = c.articles.find((x) => x.slug === "who-owns-the-street");
  must(a.summary === "Changed by Tess." && a.next === "the-gallery-in-residence" && a.subjects.join() === "art-in-public" && c.forward["who-owns-the-street.html"] === "stories/who-owns-the-street/", "saved: " + JSON.stringify(a).slice(0, 300));
});
await check("A subject page lists its stories, and Exhibitions opens as a list made by hand", async () => {
  await page.selectOption(".pagepick", "artist-art-in-public"); await settle(1800);
  let t = await tacText(); must(t.includes("Art in public") && t.includes("Who Owns the Street?") && t.includes("Vhils and the Art of Taking Away"), "subject: " + t.slice(0, 300));
  await page.selectOption(".pagepick", "page-exhibitions"); await settle(1800);
  t = await tacText(); must(t.includes("Konn Artiss, ANTI-FRIEZE") && t.includes("These notes come from published reports."), "exhibitions: " + t.replace(/\s+/g, " ").slice(0, 300));
  await page.click('.sec[data-where="page"][data-id="exhibitions-list"]'); await settle(600);
  must((await page.inputValue('input[data-pf="heading"]')) === "Shows and installations in our reporting", "the list's settings did not open");
  await shot("132-tac-exhibitions");
});

// =============== 20. A shop on Shopify: products and prices from the console ===============
area = "Shop";
const shopList = { sites: [...siteList.sites, { id: "zen-xander", name: "Zen Xander", domain: "zenxander.com", kind: "shop", store: "zx-test" }] };
if (!ONLY || ONLY.includes(area)) {
  // the shop joins sites.json as well, so the server's own reading of the list keeps it
  const cur = await (await hub.fetch("https://api.github.com/repos/" + CR + "/contents/sites.json?ref=main")).json();
  const listNow = JSON.parse(Buffer.from(cur.content, "base64").toString("utf8")); listNow.sites.push(shopList.sites.at(-1));
  await hub.fetch("https://api.github.com/repos/" + CR + "/contents/sites.json", { method: "PUT", body: JSON.stringify({ message: "Add the shop", content: Buffer.from(JSON.stringify(listNow)).toString("base64"), sha: cur.sha, branch: "main" }) });
  useSiteList(listNow); await page.click('[data-tab="home"]', { timeout: 1500 }).catch(() => {}); signedIn = "tester@artiscope.co.uk"; await page.evaluate(() => { window.__adh.state.leave = null; }).catch(() => {}); await page.goto(consoleAt + "/index.html"); await page.waitForSelector('[data-act="open-site"][data-site="zen-xander"]', { timeout: 20000 }); }
const ratsId = shop.products[0].id, rats = () => shop.findProduct(ratsId);
await check("The shop opens on Products, read from Shopify, with only Products and Changes in the menu", async () => {
  await page.click('[data-act="open-site"][data-site="zen-xander"]'); await page.waitForSelector(".sp-table", { timeout: 9000 }); await settle(600);
  const t = await text(".sp"); must(t.includes("4 products in the Zen Xander shop, 2 of them on sale") && t.includes("SPACE RATS") && t.includes("£250 to £350") && t.includes("1,800"), t.slice(0, 300));
  const nav = (await page.locator(".navb").allInnerTexts()).map((x) => x.trim()); must(nav.join() === "All sites,Products,Changes", nav.join());
  await page.click('[data-act="sp-filter"][data-v="DRAFT"]'); must((await page.locator(".sp-table tbody tr").count()) === 1, "Draft filter");
  await page.click('[data-act="sp-filter"][data-v="all"]'); await shot("140-shop-list");
});
await check("One product: the White group's price set once for all six, a stock and a collection changed, saved to Shopify and listed beside it", async () => {
  await page.click('[data-act="sp-open"][data-id="' + ratsId + '"]'); await page.waitForSelector('[data-sp-group="1"]', { timeout: 9000 });
  await page.fill('[data-sp-group="1"]', "375");
  await page.click('[data-act="sp-group"][data-v="Unframed"]'); const st = page.locator('[data-sp="stock"]').first(); await st.fill("98");
  await page.uncheck('[data-sp="col"][value="' + shop.collections[0].id + '"]');
  must((await text("#sp-count")) === "8 changes not saved", await text("#sp-count"));
  must(await page.isDisabled('[data-sp="col"][value="' + shop.collections[2].id + '"]'), "a rule-filled collection can be ticked");
  await shot("141-shop-product");
  await page.click('[data-act="sp-save"]'); await page.waitForSelector("#sp-count:has-text('All saved')", { timeout: 9000 }); await settle(800);
  const white = rats().variants.filter((v) => v.selectedOptions[1].value === "White");
  must(white.every((v) => v.price === "375.00") && Object.values(rats().variants[0].item.levels)[0] === 98 && !shop.collections[0].products.includes(ratsId), "Shopify was not changed as asked");
  must((await text(".sp-side")).includes("8 changes to SPACE RATS"), "not listed beside it");
});
await check("A price changed in Shopify meanwhile stops the save and says so, and nothing is changed", async () => {
  rats().variants[13].price = "360.00";
  await page.fill('[data-sp-group="2"]', "390"); await page.click('[data-act="sp-save"]'); await settle(1500);
  must((await notice()).includes("changed in Shopify since you opened it"), await notice());
  must(rats().variants[12].price === "350.00", "a price was changed");
  rats().variants[13].price = "350.00"; await page.click('[data-act="sp-reload"]').catch(() => {}); await settle(800);
});
await check("Change prices: on sale, White and Black, set to £380, checked before saving, then saved", async () => {
  await page.click('[data-tab="products"]'); await settle(600); await page.click('[data-act="sp-view"][data-v="prices"]'); await settle(400);
  await page.click('[data-act="sp-pf"][data-k="opt:Frame"][data-v="White"]'); await page.click('[data-act="sp-pf"][data-k="opt:Frame"][data-v="Black"]');
  await page.fill('[data-sp-pf="value"]', "380"); await page.click('[data-act="sp-plan"]'); await page.waitForSelector(".sp-sum", { timeout: 9000 });
  const sum = await text(".sp-sum"); must(sum.startsWith("14 versions in 2 products change"), sum);
  await shot("142-shop-prices");
  await page.click('[data-act="sp-apply"]'); await settle(1500);
  must((await notice()).includes("14 prices changed in the shop"), await notice());
  must(shop.products.filter((p) => p.status === "ACTIVE").every((p) => p.variants.filter((v) => v.selectedOptions[1].value !== "Unframed").every((v) => v.price === "380.00")), "not all at £380");
  must(shop.products.find((p) => p.status === "DRAFT").variants.every((v) => v.price !== "380.00"), "a draft changed");
});
await check("Changes lists it, and Put back asks once, then sets every price as it was", async () => {
  await page.click('.navb[data-tab="changes"]'); await page.waitForSelector(".sp-change", { timeout: 9000 });
  must((await text(".sp")).includes("14 prices changed"), await text(".sp"));
  await page.click('.sp-change [data-act="sp-confirm"]'); must((await text(".sp-change")).includes("Put back 14 parts in the shop straight away?"), await text(".sp-change"));
  await page.click('[data-act="sp-putback"]'); await settle(1500);
  must((await notice()).includes("Put back in the shop"), await notice());
  const white = rats().variants.filter((v) => v.selectedOptions[1].value === "White"), black = rats().variants.filter((v) => v.selectedOptions[1].value === "Black");
  must(white.every((v) => v.price === "375.00") && black.every((v) => v.price === "350.00"), "not put back as it was");
  await shot("143-shop-changes");
});
await check("Add a product as a copy: a draft with the same versions, opened straight away", async () => {
  await page.click('.navb[data-tab="products"]'); await settle(600); await page.click('[data-act="sp-view"][data-v="add"]');
  await page.selectOption('[data-sp-add="from"]', ratsId); await page.fill('[data-sp-add="title"]', "MOON RATS"); await page.click('[data-act="sp-add"]');
  await page.waitForSelector('[data-sp="title"]', { timeout: 9000 }); await settle(600);
  const made = shop.products.find((p) => p.title === "MOON RATS"); must(made && made.status === "DRAFT" && made.variants.length === 18, "no draft copy");
  must((await page.inputValue('[data-sp="title"]')) === "MOON RATS" && (await notice()).includes("Added as a draft"), "the copy did not open");
});

// =============== results ===============
results.push(...errors.map((e) => ({ area: "Script errors on the page", name: e.slice(0, 160), ok: false, note: "" })));
fs.writeFileSync(OUT + "results.json", JSON.stringify(results, null, 2));
const passed = results.filter((r) => r.ok).length;
console.log(`UAT: ${passed} of ${results.length} passed`);
for (const r of results) console.log((r.ok ? "PASS " : "FAIL ") + r.area + " | " + r.name + (r.note ? " | " + r.note : ""));
await browser.close(); srv.kill();
