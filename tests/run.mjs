import { W_DIR, G_DIR, C_DIR, FIX, chromeOptions, sadDir } from "./where.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
import { parseCalendar, setAnswer, parseLog, safePhotoName, parseSlots, slotPhotoName, notePhotoName, cleanText, handle, SITES, cleanPages, cleanCss, cleanSettings } from "./home.mjs";

const empty = fs.readFileSync((G_DIR + "/CONTENT-CALENDAR.md"), "utf8");
assert.deepEqual(parseCalendar(empty), { waiting: [], approved: [] });

const cal = `# Content calendar

Intro.

## Waiting for your answer

### What a buyer's premium adds to a hammer price
- Type: Collecting guide
- Why now: Fills a gap beside the auction tables.
- Sources found: 2, main one Tate Ward terms
- Your answer:

### Konn Artiss at auction: results so far
- Type: Auction results
- Why now: New lot page.
- Sources found: 1
- Your answer: no

## Approved, to be written

### How to read an auction estimate
- Type: Collecting guide
- Why now: x
- Sources found: 3
- Your answer: yes

## Written

Nothing yet.
`;
const p = parseCalendar(cal);
assert.equal(p.waiting.length, 2);
assert.equal(p.waiting[0].title, "What a buyer's premium adds to a hammer price");
assert.equal(p.waiting[0].answer, "");
assert.equal(p.waiting[1].answer, "no");
assert.equal(p.approved[0].title, "How to read an auction estimate");

const next = setAnswer(cal, "What a buyer's premium adds to a hammer price", "yes", "keep it\nshort");
assert.ok(next.includes("- Your answer: yes, keep it short"));
assert.equal(parseCalendar(next).waiting[0].answer, "yes, keep it short");
assert.equal(parseCalendar(next).waiting[1].answer, "no");          // others untouched
assert.equal(next.split("\n").length, cal.split("\n").length);       // nothing else moved
assert.equal(setAnswer(cal, "How to read an auction estimate", "yes"), null); // not in waiting
assert.equal(setAnswer(cal, "No such topic", "yes"), null);

const log = fs.readFileSync((W_DIR + "/AGENT-LOG.md"), "utf8");
const l = parseLog(log);
assert.ok(/\d{4}/.test(l[0].date));
assert.ok(l[0].lines.length >= 3);

assert.equal(safePhotoName("zara-muse", "In Her Own Light!", "JPEG"), "zara-muse-in-her-own-light.jpg");
assert.equal(safePhotoName("zara-muse", "../../etc", "png"), "zara-muse-etc.png");
assert.equal(safePhotoName("zara-muse", "x", "exe"), null);
assert.equal(safePhotoName("zara-muse", "", "jpg"), null);

const war = parseSlots(fs.readFileSync((W_DIR + "/image-slots.json"), "utf8"));
assert.equal(war.length, 31);
assert.ok(war.find((x) => x.id === "artist-zara-muse").filled);
assert.equal(parseSlots("not json").length, 0);
assert.equal(parseSlots(JSON.stringify({ slots: [{ id: "../x", label: "bad" }, { id: "ok-1", label: "Fine" }] })).length, 1);
assert.equal(slotPhotoName("article-palette-knife-painting", "JPEG"), "slot--article-palette-knife-painting.jpg");
assert.equal(slotPhotoName("../../etc", "jpg"), null);
assert.equal(slotPhotoName("ok-1", "gif"), null);
assert.equal(notePhotoName("Studio shot, 2025!", "png"), "note--studio-shot-2025.png");
assert.equal(notePhotoName("", "png"), null);
assert.equal(cleanText('A <b>bold</b>\n"claim" `x` \\ end', 240), 'A bbold/b "claim" x end');
assert.equal(cleanText("x".repeat(500), 240).length, 240);

// handler: sign-in and allow-list checks, with the network mocked
const realFetch = globalThis.fetch;
function mock(userEmail) {
  globalThis.fetch = async (url) => {
    if (String(url).includes("/auth/v1/user")) {
      return userEmail ? new Response(JSON.stringify({ email: userEmail })) : new Response("{}", { status: 401 });
    }
    throw new Error("unexpected call " + url);
  };
}
const post = (body, auth) => new Request("https://x/functions/v1/home", { method: "POST", headers: auth ? { Authorization: auth } : {}, body: JSON.stringify(body) });

mock(null);
assert.equal((await handle(new Request("https://x", { method: "OPTIONS" }))).status, 204);
assert.equal((await handle(post({ action: "overview" }))).status, 401);
assert.equal((await handle(post({ action: "overview" }, "Bearer bad"))).status, 401);
mock("stranger@example.com");
assert.equal((await handle(post({ action: "overview" }, "Bearer t"))).status, 403);
globalThis.fetch = realFetch;
// every section kind the console offers is one each site's build accepts, and the other way round
{
  const kinds = (repo) => Object.keys(SITES.find((x) => x.repo === repo).sectionKinds).filter((k) => !["opening", "header", "footer"].includes(k)).sort();
  const war = fs.readFileSync((W_DIR + "/tools/build_site.py"), "utf8").match(/SECTION_TYPES = \{([^}]*)\}/)[1].match(/"([^"]+)"/g).map((x) => x.slice(1, -1)).sort();
  const gam = fs.readFileSync((G_DIR + "/tools/build.mjs"), "utf8").match(/const KINDS = \[([^\]]*)\]/)[1].match(/"([^"]+)"/g).map((x) => x.slice(1, -1)).sort();
  assert.deepEqual(kinds("Artiscope/World-art-review"), war, "World Art Review: console and build disagree");
  assert.deepEqual(kinds("Artiscope/global-art-monitor"), gam, "Global Art Monitor: console and build disagree");
  const warSrc = fs.readFileSync((W_DIR + "/src/index.html"), "utf8"), gamSrc = fs.readFileSync((G_DIR + "/assets/render.js"), "utf8");
  for (const k of war) assert.ok(warSrc.includes(k + "(st") || warSrc.includes("'" + k + "'(st"), "World Art Review cannot draw " + k);
  for (const k of gam) assert.ok(gamSrc.includes('S["' + k + '"]') || gamSrc.includes("S." + k + " ="), "Global Art Monitor cannot draw " + k);
  const sadDirNow = sadDir(), sad = fs.readFileSync(sadDirNow + "/tools/build.mjs", "utf8").match(/const KINDS = \[([^\]]*)\]/)[1].match(/"([^"]+)"/g).map((x) => x.slice(1, -1)).sort();
  assert.deepEqual(kinds("Artiscope/street-art-dispatch"), sad, "Street Art Dispatch: console and build disagree");
  const sadSrc = fs.readFileSync(sadDirNow + "/assets/render.js", "utf8");
  for (const k of sad) assert.ok(sadSrc.includes('S["' + k + '"]') || sadSrc.includes("S." + k + " ="), "Street Art Dispatch cannot draw " + k);
  // every site offers the same sections any page can use
  const shared = ["announcement", "columns", "space", "quote", "faq", "button", "picture-banner", "slideshow", "gallery", "logo-row", "picture", "text-picture", "artworks", "exhibitions", "career", "press", "signup", "visit", "contact-form"];
  for (const repo of ["Artiscope/World-art-review", "Artiscope/global-art-monitor", "Artiscope/street-art-dispatch"]) for (const k of shared) assert.ok(kinds(repo).includes(k), repo + " does not offer " + k);
  // the new sections keep only safe links
  const W = SITES.find((x) => x.repo === "Artiscope/World-art-review");
  const ctx = { sectionKinds: W.sectionKinds, artists: [], articleSlugs: [], sourceIds: [] };
  const cur = { shared: {}, pages: { home: { title: "Home", sections: [] } } };
  const out = cleanPages(ctx, { shared: {}, pages: { home: { title: "Home", sections: [] }, trial: { title: "Trial", sections: [
    { id: "a", type: "announcement", settings: { messages: [{ text: "Hi — there", link: "Go", href: "javascript:alert(1)" }, { text: "Two", link: "Go", href: "#artists" }], seconds: 6, bg: "green" } },
    { id: "c", type: "columns", settings: { columns: [{ title: "A", text: "x", link: "y", href: "https://example.org" }], per_row: "9" } },
    { id: "s", type: "space", settings: { size: "XL" } }] } } }, cur).pages.trial.sections;
  assert.deepEqual(out[0].settings.messages.map((m) => [m.text, m.href]), [["Hi, there", ""], ["Two", "#artists"]]);
  assert.equal(out[1].settings.per_row, "3"); assert.equal(out[1].settings.columns[0].href, "https://example.org"); assert.equal(out[2].settings.size, "M");
}
// sections shared by every page: kept in their own list, drawn on every page by each site's build
{
  const W = SITES.find((x) => x.repo === "Artiscope/World-art-review");
  const ctx = { ...W, artists: [], articleSlugs: [], sourceIds: [] };
  const cur = { shared: {}, pages: { home: { title: "Home", sections: [] }, standards: { title: "Standards", sections: [{ id: "h", type: "page-heading", settings: {} }, { id: "body", type: "long-text", settings: {} }] } } };
  const quote = { id: "every-quote-1", type: "quote", name: "Pull quote", settings: { text: "A line", who: "" } };
  const out = cleanPages(ctx, { ...cur, groups: { top: [], bottom: [quote] } }, cur);
  assert.equal(out.groups.bottom[0].id, "every-quote-1"); assert.equal(out.groups.bottom[0].name, "Pull quote"); assert.deepEqual(out.groups.top, []);
  assert.throws(() => cleanPages(ctx, { ...cur, groups: { top: [{ ...quote, id: "quote-1" }], bottom: [] } }, cur), /every-/);
  assert.throws(() => cleanPages(ctx, { ...cur, groups: { top: [quote], bottom: [quote] } }, cur), /its own short name/);
  // the main section of a page the site was built with can move and hide, not go
  assert.throws(() => cleanPages(ctx, { ...cur, pages: { ...cur.pages, standards: { title: "Standards", sections: [cur.pages.standards.sections[0]] } } }, cur), /main section/);
  const moved = cleanPages(ctx, { ...cur, pages: { ...cur.pages, standards: { title: "Standards", sections: [{ ...cur.pages.standards.sections[1], visible: false }, cur.pages.standards.sections[0]] } } }, cur);
  assert.equal(moved.pages.standards.sections[0].visible, false);
  // popups live in their own group, and only there
  const pop = { id: "every-signup-popup-1", type: "signup-popup", settings: { heading: "Join", delay: 900 } };
  const withPop = cleanPages(ctx, { ...cur, groups: { top: [], popups: [pop], bottom: [] } }, cur);
  assert.equal(withPop.groups.popups[0].settings.delay, 60, "the delay is kept between 3 and 60 seconds");
  assert.throws(() => cleanPages(ctx, { ...cur, groups: { top: [pop], popups: [], bottom: [] } }, cur), /Popups group/);
  assert.throws(() => cleanPages(ctx, { ...cur, groups: { top: [], popups: [quote], bottom: [] } }, cur), /Only popups/);
  assert.throws(() => cleanPages(ctx, { ...cur, pages: { ...cur.pages, home: { title: "Home", sections: [{ ...pop, id: "p1" }] } } }, cur), /Popups group/);
  // a page of its own layout keeps the mark; the home page and the site's own pages never take it
  const ownDoc = cleanPages(ctx, { ...cur, pages: { ...cur.pages, home: { title: "Home", sections: [], own: true }, soon: { title: "Soon", sections: [], own: true } } }, cur);
  assert.equal(ownDoc.pages.soon.own, true); assert.equal(ownDoc.pages.home.own, undefined);
  // step 3: the settings panel's new kinds of setting, cleaned on the server
  const sch = { fields: [{ name: "g", type: "range", min: 0, max: 120, step: 4 }, { type: "info", text: "A note" }, { name: "d", type: "datetime" }, { name: "f", type: "font", fonts: { "Castoro": "Castoro" } },
    { name: "v", type: "video" }, { name: "w", type: "video" }, { name: "x", type: "video" }, { name: "s", type: "set", count: 2, fields: [{ name: "t", type: "text" }] }] };
  const cs = cleanSettings(sch, { g: 999, d: "2027-02-30T09:00", f: "Castoro:700i", v: "https://www.example.com/film.mp4", w: "javascript:alert(1)", x: "film.mp4", s: [{ t: "One", on: false }] }, {});
  assert.deepEqual(cs, { g: 120, d: "2027-02-30T09:00", f: "Castoro:700i", v: "https://www.example.com/film.mp4", w: "", x: "film.mp4", s: [{ on: false, t: "One" }, { on: true, t: "" }] });
  assert.equal(cleanSettings(sch, { g: 13, d: "tomorrow", f: "Comic Sans" }, {}).g, 12, "a slider keeps to its steps");
  assert.equal(cleanSettings(sch, { d: "tomorrow", f: "Comic Sans" }, {}).f, "", "only the fonts on offer");
  assert.ok(!("undefined" in cs), "an info line keeps nothing");
  // a section's own CSS: nothing that loads from elsewhere or runs as code
  assert.equal(cleanCss("h2 { color: red; }\n@import url(https://evil.example/x.css);\na { background: url(https://evil.example/t.gif) }\n</style><script>alert(1)</script>"), "h2 { color: red; }\n\na { background: none }\n/stylescriptalert(1)/script");
  const withCss = cleanPages(ctx, { ...cur, groups: { top: [], popups: [], bottom: [{ ...quote, id: "every-quote-9", css: "p { color: #123456 }" }] } }, cur);
  assert.equal(withCss.groups.bottom[0].css, "p { color: #123456 }");
  // the footer's columns hold their links as blocks one level down
  const fk = W.sectionKinds.footer; assert.ok(fk.blocks && fk.blocks.blocks && fk.blocks.blocks[0].field === "links", "footer links are not blocks inside the columns");
  // each site draws them, on its own pages and on articles and artists
  const { execFileSync } = await import("node:child_process"); const path = await import("node:path");
  for (const [dir, file, build] of [[G_DIR, "data/pages.json", ["tools/build.py"]], [sadDir(), "data/pages.json", ["tools/build.py", "/tmp/grp-sad-out"]]]) {
    const tmp = "/tmp/grp-" + path.basename(dir); fs.rmSync(tmp, { recursive: true, force: true }); fs.cpSync(dir, tmp, { recursive: true, filter: (x) => !/\/\.git(\/|$)/.test(x) });
    const pj = JSON.parse(fs.readFileSync(tmp + "/" + file, "utf8")); pj.groups = { top: [], popups: [{ id: "every-signup-popup-1", type: "signup-popup", visible: true, settings: { heading: "Join the list", text: "", button: "Ask to join", delay: 8 } }], bottom: [{ id: "every-quote-1", type: "quote", visible: true, css: "p { color: #123456 }\n:scope { padding: 1px }", settings: { text: "Shared on every page", who: "" } }] };
    pj.pages.soon = { path: "soon/index.html", title: "Coming soon", description: "", current: "", intro: false, own: true, sections: [{ id: "q", type: "quote", visible: true, settings: { text: "Opening in spring", who: "" } }] };
    fs.writeFileSync(tmp + "/" + file, JSON.stringify(pj));
    const th = JSON.parse(fs.readFileSync(tmp + "/data/theme.json", "utf8")); Object.assign(th, { css: ":root{--h-scale:1.2}", rules: "h1, h2{text-transform:uppercase !important}", social: { instagram: { label: "Instagram", href: "https://www.instagram.com/example" } }, favicon: "assets/images/mark.png" });
    fs.writeFileSync(tmp + "/data/theme.json", JSON.stringify(th));
    execFileSync("python3", build, { cwd: tmp, stdio: "pipe" });
    const outDir = build[1] || tmp, pages = [];
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const f = d + "/" + e.name; if (e.isDirectory() && !/^(\.git|assets|data|tools|inbox|node_modules)$/.test(e.name)) walk(f); else if (e.name === "index.html") pages.push(f); });
    walk(outDir); assert.ok(pages.length > 5, dir + ": built " + pages.length + " pages");
    const soon = pages.find((f) => /\/soon\/index\.html$/.test(f)), soonHtml = fs.readFileSync(soon, "utf8");
    assert.ok(soonHtml.includes("Opening in spring") && !soonHtml.includes("Shared on every page") && !/site-head|id="nav"|site-foot|class="on-pine foot"/.test(soonHtml) && soonHtml.includes("data-popup"), dir + ": the page of its own layout");
    const missing = pages.filter((f) => f !== soon && !fs.readFileSync(f, "utf8").includes("Shared on every page"));
    assert.deepEqual(missing, [], dir + ": pages without the shared section");
    assert.deepEqual(pages.filter((f) => !fs.readFileSync(f, "utf8").includes("data-popup")), [], dir + ": pages without the popup");
    const one = fs.readFileSync(pages.find((f) => f !== soon), "utf8");
    assert.ok(one.includes('[data-css="every-quote-1"] p { color: #123456 }') && one.includes('[data-css="every-quote-1"] { padding: 1px }') && /<[a-z]+ data-css="every-quote-1"/.test(one), dir + ": the section's own CSS");
    assert.ok(!fs.readFileSync(soon, "utf8").includes("data-sec-css"), dir + ": no CSS left over on a page without it");
    assert.ok(one.includes(":root{--h-scale:1.2}") && one.includes('<style id="theme-rules">') && one.includes('class="foot-social"') && one.includes('href="https://www.instagram.com/example"') && /<link rel="icon" href="[^"]*assets\/images\/mark\.png">/.test(one) && !one.includes("favicon.svg"), dir + ": the theme's settings");
  }
  const wtmp = "/tmp/grp-war"; fs.rmSync(wtmp, { recursive: true, force: true }); fs.cpSync(W_DIR, wtmp, { recursive: true, filter: (x) => !/\/\.git(\/|$)/.test(x) });
  const wp = JSON.parse(fs.readFileSync(wtmp + "/content/pages.json", "utf8")); wp.groups = { top: [], bottom: [{ id: "every-quote-1", type: "quote", visible: true, settings: { text: "Shared on every page", who: "" } }] };
  fs.writeFileSync(wtmp + "/content/pages.json", JSON.stringify(wp));
  const wth = JSON.parse(fs.readFileSync(wtmp + "/content/theme.json", "utf8")); Object.assign(wth, { rules: ".crumbs{display:none !important}", social: { x: { label: "X", href: "https://x.com/example" } }, favicon: "images/mark.png" });
  fs.writeFileSync(wtmp + "/content/theme.json", JSON.stringify(wth));
  execFileSync("python3", ["tools/build_site.py", "/tmp/grp-war-out"], { cwd: wtmp, stdio: "pipe" });
  const wout = fs.readFileSync("/tmp/grp-war-out/index.html", "utf8");
  assert.ok(wout.includes("Shared on every page"));
  assert.ok(wout.includes('<style id="theme-rules">') && /let SOCIAL = .*https:\/\/x\.com\/example/.test(wout) && wout.includes('<link rel="icon" href="images/mark.png">') && !wout.includes("data:image/svg+xml,%3Csvg"), "World Art Review: the theme's settings");
  wp.groups.top = [{ id: "quote-1", type: "quote", settings: {} }]; fs.writeFileSync(wtmp + "/content/pages.json", JSON.stringify(wp));
  assert.throws(() => execFileSync("python3", ["tools/build_site.py", "/tmp/grp-war-out"], { cwd: wtmp, stdio: "pipe" }), "a shared section without every- in its id still built");
}
console.log("ALL TESTS PASSED");
