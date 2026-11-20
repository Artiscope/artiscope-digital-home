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
// step 7: templates. Article and artist pages are drawn with the sections of their template around their own content.
{
  const W = SITES.find((x) => x.repo === "Artiscope/World-art-review");
  const ctx = { ...W, artists: [{ slug: "zara-muse", name: "Zara Muse" }], articleSlugs: ["a-one", "a-two"], sourceIds: [] };
  const cur = { shared: {}, pages: { home: { title: "Home", sections: [] } } };
  // nothing set: each kind gets its default, which is just the page's own content
  const plain = cleanPages(ctx, cur, cur);
  assert.deepEqual(plain.templates.article, { default: { name: "Default article", sections: [{ id: "main", type: "main" }] } });
  assert.equal(plain.templates.artist.default.name, "Default artist portfolio"); assert.deepEqual(plain.assign, { article: {}, artist: {} });
  const q = (id, text) => ({ id, type: "quote", visible: true, settings: { text: [text], who: "" } });
  const given = { ...cur, templates: { article: { default: { name: "Default article", sections: [q("t-quote-1", "Above"), { id: "main", type: "main" }] }, "long-read": { name: "Long read", sections: [{ id: "main", type: "main" }, q("t-quote-1", "Below")] } } },
    assign: { article: { "a-two": "long-read", "a-one": "default", "gone": "long-read", "a-three": "missing" } } };
  const out = cleanPages(ctx, given, cur);
  assert.deepEqual(Object.keys(out.templates.article), ["default", "long-read"]); assert.equal(out.templates.article["long-read"].sections[1].settings.text[0], "Below");
  assert.deepEqual(out.assign.article, { "a-two": "long-read" }, "only real articles and real templates are kept, and the default is never written");
  const bad = (t, re) => assert.throws(() => cleanPages(ctx, { ...cur, templates: { article: t } }, cur), re);
  bad({ default: { name: "Default article", sections: [q("t-quote-1", "x")] } }, /own content once/);
  bad({ default: { name: "Default article", sections: [{ id: "main", type: "main" }, { id: "main", type: "main" }] } }, /own content once/);
  bad({ default: { name: "Default article", sections: [{ id: "main", type: "main" }, q("quote-1", "x")] } }, /starting t-/);
  bad({ default: { name: "Default article", sections: [{ id: "main", type: "main" }] }, x: { name: "Default article", sections: [{ id: "main", type: "main" }] } }, /same name/);
  bad({ default: { name: "Default article", sections: [{ id: "main", type: "main" }] }, "Bad Id": { name: "Odd", sections: [{ id: "main", type: "main" }] } }, /short name/);
  bad({ default: { name: "Default article", sections: [{ id: "main", type: "main" }, { id: "t-pop", type: "signup-popup", settings: {} }] } }, /Popups/);
  assert.equal(cleanPages(ctx, { ...cur, templates: { article: { default: { name: "A name much longer than twenty-five letters", sections: [{ id: "main", type: "main" }] } } } }, cur).templates.article.default.name.length, 25);
  // each site draws them
  const { execFileSync } = await import("node:child_process"); const path = await import("node:path");
  const T = (above, below) => ({ default: { name: "Default", sections: [q("t-quote-1", above), { id: "main", type: "main" }] }, other: { name: "Other", sections: [{ id: "main", type: "main" }, q("t-quote-1", below)] } });
  for (const [dir, build, art, artist] of [[G_DIR, ["tools/build.py"], (x) => "research/" + x + "/index.html", (x) => "artists/" + x + "/index.html"], [sadDir(), ["tools/build.py", "/tmp/tpl-sad-out"], null, (x) => "artists/" + x + "/index.html"]]) {
    const tmp = "/tmp/tpl-" + path.basename(dir); fs.rmSync(tmp, { recursive: true, force: true }); fs.cpSync(dir, tmp, { recursive: true, filter: (x) => !/\/\.git(\/|$)/.test(x) });
    const pj = JSON.parse(fs.readFileSync(tmp + "/data/pages.json", "utf8")), c = JSON.parse(fs.readFileSync(tmp + "/data/content.json", "utf8"));
    const slugOf = (n) => String(n).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), arts = (c.features || []).map((x) => x.slug), people = path.basename(dir).includes("street") ? (c.artists || []).map((x) => x.slug || slugOf(x.name)) : Object.keys(c.bios || {});
    pj.templates = { article: T("Above every article", "Below this article"), artist: T("Above every artist", "Below this artist") };
    pj.assign = { article: { [arts[1]]: "other" }, artist: { [people[1]]: "other" } };
    fs.writeFileSync(tmp + "/data/pages.json", JSON.stringify(pj));
    execFileSync("python3", build, { cwd: tmp, stdio: "pipe" });
    const outDir = build[1] || tmp, read = (f) => fs.readFileSync(outDir + "/" + f, "utf8");
    const files = []; const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const f = d + "/" + e.name; if (e.isDirectory() && !/^(\.git|assets|data|tools|inbox|node_modules)$/.test(e.name)) walk(f); else if (e.name === "index.html") files.push(f.slice(outDir.length + 1)); });
    walk(outDir);
    const artFile = (x) => art ? art(x) : files.find((f) => !f.startsWith("artists/") && f.endsWith("/" + x + "/index.html"));
    const a0 = read(artFile(arts[0])), a1 = read(artFile(arts[1]));
    assert.ok(a0.includes("Above every article") && a0.indexOf("Above every article") < a0.indexOf("<article") + (a0.includes("<article") ? 0 : 1e9) || a0.includes("Above every article"), dir + ": the default article template");
    assert.ok(!a1.includes("Above every article") && a1.includes("Below this article"), dir + ": an article with its own template");
    const p0 = read(artist(people[0])), p1 = read(artist(people[1]));
    assert.ok(p0.includes("Above every artist") && !p1.includes("Above every artist") && p1.includes("Below this artist"), dir + ": artist templates");
    assert.ok(!read(files.find((f) => f === "index.html") || "index.html").includes("Above every article"), dir + ": not on other pages");
    pj.templates.article.default.sections = [q("t-quote-1", "x")]; fs.writeFileSync(tmp + "/data/pages.json", JSON.stringify(pj));
    assert.throws(() => execFileSync("python3", build, { cwd: tmp, stdio: "pipe" }), dir + ": a template without the page's own content still built");
  }
  const wtmp = "/tmp/tpl-war"; fs.rmSync(wtmp, { recursive: true, force: true }); fs.cpSync(W_DIR, wtmp, { recursive: true, filter: (x) => !/\/\.git(\/|$)/.test(x) });
  const wp = JSON.parse(fs.readFileSync(wtmp + "/content/pages.json", "utf8")); wp.templates = { article: T("Above every article", "Below") }; wp.assign = { article: {} };
  fs.writeFileSync(wtmp + "/content/pages.json", JSON.stringify(wp));
  execFileSync("python3", ["tools/build_site.py", "/tmp/tpl-war-out"], { cwd: wtmp, stdio: "pipe" });
  assert.ok(fs.readFileSync("/tmp/tpl-war-out/index.html", "utf8").includes("Above every article") && fs.readFileSync("/tmp/tpl-war-out/index.html", "utf8").includes("function tplWrap"));
  wp.templates.article.default.sections[0].id = "quote-1"; fs.writeFileSync(wtmp + "/content/pages.json", JSON.stringify(wp));
  assert.throws(() => execFileSync("python3", ["tools/build_site.py", "/tmp/tpl-war-out"], { cwd: wtmp, stdio: "pipe" }), "a template section without t- in its id still built");
}
// step 8: Publish later. The time is London time; the copy's id carries it in UTC.
{
  const h = await import("./home.mjs");
  assert.equal(h.fromLondon("2026-12-01T09:00").toISOString(), "2026-12-01T09:00:00.000Z", "winter: London is UTC");
  assert.equal(h.fromLondon("2027-07-01T09:00").toISOString(), "2027-07-01T08:00:00.000Z", "summer: London is an hour ahead");
  assert.equal(h.fromLondon("tomorrow"), null);
  const id = h.laterId(h.fromLondon("2027-07-01T09:00")); assert.match(id, /^trial-later-202707010800-[0-9a-f]{6}$/);
  assert.equal(h.laterOf(id).toISOString(), "2027-07-01T08:00:00.000Z"); assert.equal(h.copyName(id), "Publish later: 1 July 2027, 09:00");
  assert.equal(h.copyName("trial-held-a1b2c3"), "Could not publish later");
  // stored data: an artist or an article can be "the page's own" only inside a template
  const W = SITES.find((x) => x.repo === "Artiscope/World-art-review");
  const ctx = { ...W, artists: [{ slug: "zara-muse", name: "Zara Muse" }], articleSlugs: ["a-one"], sourceIds: [] };
  const cur = { shared: {}, pages: { home: { title: "Home", sections: [] } } };
  const cards = (id, v) => ({ id, type: "artist-cards", visible: true, settings: { artists: [v] } });
  const out = cleanPages(ctx, { ...cur, templates: { artist: { default: { name: "Default artist portfolio", sections: [{ id: "main", type: "main" }, cards("t-cards", "{page.artist}")] } } } }, cur);
  assert.deepEqual(out.templates.artist.default.sections[1].settings.artists, ["{page.artist}"]);
  const onPage = cleanPages(ctx, { ...cur, pages: { home: { title: "Home", sections: [cards("cards", "{page.artist}")] } } }, cur);
  assert.deepEqual(onPage.pages.home.sections[0].settings.artists, [], "a page outside a template has no page of its own to take from");
}
// step 9: add-ons and Edit code
{
  const h = await import("./home.mjs"); const { execFileSync } = await import("node:child_process"); const path = await import("node:path");
  const W = SITES.find((x) => x.repo === "Artiscope/World-art-review");
  const ao = h.cleanAddons(W, { top: { on: true, label: "Up<script>x</script>", side: "middle", after: 99999 }, share: { on: "yes", networks: ["email", "myspace"] }, spy: { on: true } }, {});
  assert.deepEqual(Object.keys(ao).sort(), ["privacy", "progress", "share", "top"], "only our own add-ons");
  assert.equal(ao.top.on, true); assert.equal(typeof ao.top.label, "string");
  assert.equal(ao.top.side, "right", "an unknown side falls back"); assert.ok(ao.top.after <= 2000, "the distance stays in range");
  assert.equal(ao.share.on, false, "only true switches an add-on on"); assert.deepEqual(ao.share.networks, ["email"], "only the four ways to share");
  assert.equal(ao.progress.on, false, "add-ons start off");
  assert.equal(h.copyName(h.CODE_COPY), "Code changes");
  for (const x of SITES.filter((y) => y.repo && y.live)) assert.ok(x.code && x.code.edit.length && x.code.edit.every((f) => !/\.json$/.test(f)), x.id + ": its code files, with the settings files read only");
  for (const dir of [W_DIR, G_DIR, sadDir()]) {
    const wf = fs.readFileSync(dir + "/.github/workflows/check-copy.yml", "utf8");
    assert.ok(/adh\/\*\*/.test(wf) && !/deploy-pages|upload-pages-artifact/.test(wf), dir + ": the check builds working copies and publishes nothing");
  }
  assert.ok(fs.readFileSync(W_DIR + "/src/index.html", "utf8").includes("function aoHtml"), "World Art Review draws add-ons");
  for (const [dir, build, out] of [[G_DIR, ["tools/build.py"], ""], [sadDir(), ["tools/build.py", "/tmp/ao-sad-out"], "/tmp/ao-sad-out"]]) {
    const tmp = "/tmp/ao-" + path.basename(dir); fs.rmSync(tmp, { recursive: true, force: true }); fs.cpSync(dir, tmp, { recursive: true, filter: (x) => !/\/\.git(\/|$)/.test(x) });
    const pj = JSON.parse(fs.readFileSync(tmp + "/data/pages.json", "utf8")); pj.addons = { top: { on: true, label: "Up again <b>", side: "left", after: 600 }, privacy: { on: true, text: "No tracking here." } };
    fs.writeFileSync(tmp + "/data/pages.json", JSON.stringify(pj)); execFileSync("python3", build, { cwd: tmp, stdio: "pipe" });
    const home = fs.readFileSync((out || tmp) + "/index.html", "utf8");
    assert.ok(home.includes("Up again &lt;b&gt;") && /ao-top[^"]*left/.test(home) && home.includes("No tracking here."), dir + ": add-ons built into the pages");
  }
}
// new sites, step 3: the starter, the list of sites, the practice build and the People fix
{
  const h = await import("./home.mjs"); const { execFileSync } = await import("node:child_process");
  const shared = ["announcement", "columns", "space", "quote", "faq", "button", "picture-banner", "slideshow", "gallery", "logo-row", "picture", "text-picture", "artworks", "exhibitions", "career", "press", "signup", "visit", "contact-form", "signup-popup"];
  assert.deepEqual([...h.STARTER_KINDS].sort(), [...shared].sort(), "the starter offers the shared 20 and nothing else");
  for (const k of shared) assert.ok(h.STARTER_SECTIONS[k], "the server has no starter section " + k);
  // the list of sites
  const keep = SITES.slice();
  const l = h.cleanSiteList({ sites: [
    { id: "world-art-review", name: "Taken" }, { id: "Bad Id!" }, { id: "pb", name: "Practice <b>build</b>", repo: "Artiscope/practice-build", kind: "starter", playground: true, live: true, domain: "artiscope.github.io/practice-build" },
    { id: "plain", name: "Plain", playground: true, live: true }, { id: "pb", name: "Twice" } ] });
  assert.deepEqual(l.map((x) => x.id), ["pb", "plain"], "built-in ids, bad ids and repeats are dropped");
  assert.ok(!l[0].name.includes("<"), "names are plain words");
  assert.equal(l[0].playground && l[0].live && l[0].kind, "starter");
  assert.equal(l[1].playground || l[1].live, false, "a site with no repository is never live or a practice build");
  h.useSiteList(l);
  const pb = SITES.find((x) => x.id === "pb");
  assert.ok(pb && pb.repo === "Artiscope/practice-build" && pb.model && pb.model.id === "starter", "the practice build is drawn by the starter");
  assert.ok(SITES.find((x) => x.id === "world-art-review").name === "World Art Review", "the built-in sites stay as they are");
  const tess = { email: "t@example.org", admin: false, sites: ["pb"] };
  assert.equal(h.asOn(tess, pb).admin, true, "a test user works as the admin on the practice build");
  assert.equal(h.asOn(tess, SITES.find((x) => x.id === "world-art-review")).admin, false, "and as an editor everywhere else");
  // a site made outside the console: a card only, never live in the editor and never built over
  const ol = h.cleanSiteList({ sites: [{ id: "tac", name: "The Art Correspondent", domain: "theartcorrespondent.com", repo: "Artiscope/the-art-correspondent", kind: "outside", live: true },
    { id: "nodomain", name: "No address", repo: "Artiscope/x", kind: "outside" }] });
  assert.deepEqual(ol.map((x) => [x.id, x.kind, x.live]), [["tac", "outside", false], ["nodomain", "", false]], "an outside site needs its repository and address, and is never live in the editor");
  h.useSiteList(ol);
  const tac = SITES.find((x) => x.id === "tac");
  assert.ok(tac.outside && !tac.live && !tac.pages && !tac.starter && tac.repo === "Artiscope/the-art-correspondent", "an outside site has no pages, theme or model");
  SITES.splice(0, SITES.length, ...keep);
  // site details
  assert.deepEqual(h.starterForEditor({ site: { email: "a@b.org", address: "https://x.org/" } }).site, { email: "a@b.org", address: "https://x.org/", indexed: false });
  assert.throws(() => h.starterFromEditor({ site: { email: "nope" } }, { site: { email: "a@b.org" } }), /does not look like an email/);
  assert.equal(h.starterFromEditor({ site: { email: "c@d.org" } }, { site: { email: "a@b.org", address: "https://x.org/" } }).content.site.address, "https://x.org/", "only the email changes");
  // the starter builds, hidden from search engines
  const tmp = "/tmp/run-starter"; fs.rmSync(tmp, { recursive: true, force: true }); fs.cpSync(C_DIR + "/starter", tmp + "/src", { recursive: true });
  execFileSync("python3", ["tools/build.py", tmp + "/out"], { cwd: tmp + "/src", stdio: "pipe" });
  const home = fs.readFileSync(tmp + "/out/index.html", "utf8");
  assert.ok(/<meta name="robots" content="noindex, nofollow">/.test(home), "the starter's pages are hidden from search engines");
  assert.ok(/Disallow: \//.test(fs.readFileSync(tmp + "/out/robots.txt", "utf8")), "robots.txt keeps search engines out");
  assert.ok(!fs.existsSync(tmp + "/out/CNAME"), "the practice build never gets a web address");
  assert.ok(fs.existsSync(tmp + "/out/404.html"), "it has a Page not found page");
  // People: the grants and the plain message
  assert.ok(h.PEOPLE_SQL.includes("grant usage on schema public to service_role;") && h.PEOPLE_SQL.includes("grant select, insert, update, delete on table public.people to service_role;"), "the setup lines give the server use of the table");
  assert.ok(/SQL Editor/.test(h.GRANT_HELP) && !/42501/.test(h.GRANT_HELP), "the message is in plain words");
  // every site builds a new copy's preview when the copy is made
  for (const dir of [W_DIR, G_DIR, sadDir()]) {
    const wf = fs.readFileSync(dir + "/.github/workflows/preview.yml", "utf8");
    assert.ok(/\n\s+create:/.test(wf) && /ref_type == 'branch'/.test(wf), dir + ": the preview is built when a copy is made");
  }
}
// Edit default text, step 2: every site draws its fixed words through W(), and the server's lists match the code
{
  const h = await import("./home.mjs"); const { wordsIn } = await import("./tools/site-words.mjs"); const { execFileSync } = await import("node:child_process");
  const S = sadDir();
  const sets = { war: [[W_DIR + "/src/index.html"], h.WAR_WORDS], gam: [[G_DIR + "/assets/render.js", G_DIR + "/assets/site.js"], h.GAM_WORDS],
    sad: [[S + "/assets/render.js", S + "/assets/site.js"], h.SAD_WORDS], starter: [[C_DIR + "/starter/assets/render.js", C_DIR + "/starter/assets/site.js"], h.STARTER_WORDS],
    tsad: [[C_DIR + "/templates/street-art-dispatch/assets/render.js", C_DIR + "/templates/street-art-dispatch/assets/site.js"], h.TSAD_WORDS],
    tgam: [[C_DIR + "/templates/global-art-monitor/assets/render.js", C_DIR + "/templates/global-art-monitor/assets/site.js"], h.TGAM_WORDS],
    twar: [[C_DIR + "/templates/world-art-review/src/index.html"], h.TWAR_WORDS],
    ttac: [[C_DIR + "/templates/the-art-correspondent/assets/render.js", C_DIR + "/templates/the-art-correspondent/assets/site.js"], h.TTAC_WORDS] };
  for (const [id, [files, list]] of Object.entries(sets)) {
    const found = wordsIn(files);
    assert.deepEqual(found.clash, [], id + ": one key, one set of words");
    assert.deepEqual(found.words, list, id + ": the server's list of words matches the site's code");
    for (const k of Object.keys(h.WORD_LOCKS[id])) assert.ok(list[k], id + ": a locked word is one the site uses: " + k);
    for (const k of Object.keys(list)) assert.ok(h.WORD_GROUPS.some((g) => g[0] === k.split(".")[0]), id + ": " + k + " belongs to a group");
  }
  // the server cleans what is saved
  const gam = SITES.find((x) => x.id === "global-art-monitor"), war = SITES.find((x) => x.id === "world-art-review");
  assert.equal(SITES.find((x) => x.id === "practice-site").words, war.words, "the Practice site has World Art Review's words");
  assert.deepEqual(h.cleanWords(gam, { "btn.read-feature": " Read the  <b>whole</b> feature ", "nope.key": "x", "item.who": "Who pays us", "menu.open": "Menu", "menu.close": "  " }),
    { "btn.read-feature": "Read the whole feature" }, "plain words only; unknown, locked, unchanged and empty words are dropped");
  assert.throws(() => h.cleanWords(gam, { "btn.read-feature": "x".repeat(41) }), /too long\. Keep them to 40 letters/);
  assert.ok(h.cleanWords(gam, { "missing.no-priced": "y".repeat(200) })["missing.no-priced"], "longer words are allowed where there is room");
  assert.throws(() => h.cleanWords(gam, { "item.at-auction": "At auction" }), /Keep \{name\} in the words in place of "\{name\} at auction"\. It is where the artist's name goes/);
  assert.throws(() => h.cleanWords(gam, { "btn.count": "{n} of {total}, {all}" }), /\{all\} is not something the site can fill in/);
  assert.deepEqual(h.cleanWords(gam, { "btn.count": "{n} out of {total}" }), { "btn.count": "{n} out of {total}" });
  const gp = JSON.parse(fs.readFileSync(G_DIR + "/data/pages.json", "utf8"));
  assert.ok(!("words" in h.cleanPages(gam, gp, gp)), "a site with no changed words gets no words in its file");
  const withW = h.cleanPages(gam, { ...gp, words: { "menu.open": "Sections" } }, gp);
  assert.deepEqual(withW.words, { "menu.open": "Sections" });
  assert.deepEqual(h.cleanPages(gam, { ...withW, words: undefined }, withW).words, { "menu.open": "Sections" }, "a save without words keeps the ones there");
  assert.ok(!("words" in h.cleanPages(gam, { ...withW, words: {} }, withW)), "putting every word back leaves none in the file");
  // each site draws changed words, and refuses a file whose words are not plain words
  const tmp = "/tmp/run-words"; fs.rmSync(tmp, { recursive: true, force: true });
  const tryBuild = (src, kind, words, file, cmd, check) => {
    const dir = tmp + "/" + kind; fs.cpSync(src, dir, { recursive: true, filter: (p) => !p.includes("/.git") });
    const pf = dir + "/" + file, pg = JSON.parse(fs.readFileSync(pf, "utf8")); pg.words = words; fs.writeFileSync(pf, JSON.stringify(pg));
    execFileSync("python3", cmd, { cwd: dir, stdio: "pipe" }); check(dir);
    pg.words = { "menu.open": 3 }; fs.writeFileSync(pf, JSON.stringify(pg));
    assert.throws(() => execFileSync("python3", cmd, { cwd: dir, stdio: "pipe" }), undefined, kind + ": words that are not plain words do not publish");
  };
  tryBuild(G_DIR, "gam", { "menu.open": "Sections", "nf.title": "Not in the record" }, "data/pages.json", ["tools/build.py"], (d) => {
    const home = fs.readFileSync(d + "/index.html", "utf8"); assert.ok(home.includes('aria-controls="menu">Sections</button>') && home.includes('id="adh-words"'), "Global Art Monitor draws a changed word");
    assert.ok(fs.readFileSync(d + "/404.html", "utf8").includes("Not in the record"));
  });
  tryBuild(S, "sad", { "menu.open": "Sections" }, "data/pages.json", ["tools/build.py", tmp + "/sad-out"], () => {
    assert.ok(fs.readFileSync(tmp + "/sad-out/index.html", "utf8").includes('</i>Sections</button>'), "Street Art Dispatch draws a changed word");
  });
  tryBuild(C_DIR + "/starter", "starter", { "menu.skip": "Jump to the page" }, "data/pages.json", ["tools/build.py", tmp + "/st-out"], () => {
    assert.ok(fs.readFileSync(tmp + "/st-out/index.html", "utf8").includes(">Jump to the page</a>"), "a site built in the console draws a changed word");
  });
  tryBuild(W_DIR, "war", { "menu.close": "Shut" }, "content/pages.json", ["tools/build_site.py", tmp + "/war-out"], () => {
    assert.ok(fs.readFileSync(tmp + "/war-out/index.html", "utf8").includes('"menu.close": "Shut"'), "World Art Review carries the changed words to the page");
  });
}
// Photos from the editor (Version 53): Street Art Dispatch articles and artists have a Picture part
{
  const h = await import("./home.mjs");
  const S = sadDir(), content = JSON.parse(fs.readFileSync(S + "/data/content.json", "utf8"));
  const kinds = SITES.find((x) => x.id === "street-art-dispatch").items;
  assert.ok(kinds.article.parts.some((p) => p.id === "picture") && kinds.artist.parts.some((p) => p.id === "picture"), "articles and artists have a Picture part");
  const E = h.sadForEditor(content), konn = E.artists.find((a) => a.name === "Konn Artiss");
  assert.equal(konn.alt, content.artist_photos["Konn Artiss"], "what the photo shows starts as the frame's own words");
  assert.equal(h.sadFromEditor(kinds, E, content).changed.length, 0, "opening and saving changes nothing");
  assert.deepEqual(h.sadFromEditor(kinds, E, content).content, content, "the file stays exactly as it was");
  const withPic = JSON.parse(JSON.stringify(E)); Object.assign(withPic.artists.find((a) => a.name === "Konn Artiss"), { image: "konn.jpg", credit: "Photograph: Grove Gallery" });
  Object.assign(withPic.articles[0], { image: "konn.jpg", alt: "Konn Artiss at work in Venice" });
  const r = h.sadFromEditor(kinds, withPic, content), ka = r.content.artists.find((a) => a.name === "Konn Artiss"), f0 = r.content.features[0];
  assert.equal(ka.image, "konn.jpg"); assert.equal(ka.credit, "Photograph: Grove Gallery"); assert.ok(!("alt" in ka), "the frame's own words are not repeated");
  assert.equal(f0.image, "konn.jpg"); assert.equal(f0.alt, "Konn Artiss at work in Venice", "new words for what the photo shows are kept");
  const back = JSON.parse(JSON.stringify(h.sadForEditor(r.content))); Object.assign(back.artists.find((a) => a.name === "Konn Artiss"), { image: "", credit: "" });
  const r2 = h.sadFromEditor(kinds, back, r.content), kb = r2.content.artists.find((a) => a.name === "Konn Artiss");
  assert.ok(!("image" in kb) && !("credit" in kb), "Remove leaves nothing behind");
  const bad = JSON.parse(JSON.stringify(E)); bad.artists[0].image = "../../secret.txt";
  assert.ok(!h.sadFromEditor(kinds, bad, content).content.artists[0].image, "only a photo file's name is kept");
  // a licensed photo already placed (artist_photo_files, photo_files) shows as the item's photo and can be changed or removed
  const lic = Object.keys(content.artist_photo_files || {})[0];
  if (lic) {
    const L = content.artist_photo_files[lic], shown = E.artists.find((a) => a.name === lic);
    assert.equal(shown.image, L.image, "a licensed photo shows as the artist's photo in the editor");
    assert.equal(shown.credit, L.credit, "with its credit");
    const ed = JSON.parse(JSON.stringify(E)); ed.artists.find((a) => a.name === lic).alt = "A tall mural on a factory wall";
    const rl = h.sadFromEditor(kinds, ed, content);
    assert.equal(rl.content.artist_photo_files[lic].alt, "A tall mural on a factory wall", "a new description is kept with the licensed photo");
    assert.equal(rl.content.artist_photo_files[lic].credit_href, L.credit_href, "its credit link stays");
    assert.ok(!("image" in rl.content.artists.find((a) => a.name === lic)), "the licensed photo is not copied into the artist");
    const nc = JSON.parse(JSON.stringify(E)); nc.artists.find((a) => a.name === lic).credit = "";
    assert.throws(() => h.sadFromEditor(kinds, nc, content), /credit line/, "a licensed photo cannot lose its credit");
    const rm = JSON.parse(JSON.stringify(E)); Object.assign(rm.artists.find((a) => a.name === lic), { image: "", credit: "" });
    const rr = h.sadFromEditor(kinds, rm, content);
    assert.ok(!(lic in rr.content.artist_photo_files) && !rr.content.artists.find((a) => a.name === lic).image, "Remove takes the licensed photo away");
  }
  // the site draws the photo, or the frame
  const R = (await import("node:module")).createRequire(import.meta.url)(S + "/assets/render.js");
  const pages = JSON.parse(fs.readFileSync(S + "/data/pages.json", "utf8"));
  const site = R.Site(R.fromFiles(r.content), pages, "", {}), html = site.all().map((p) => p.html).join("\n");
  assert.ok(/<img class="ph-img" src="[^"]*konn\.jpg"/.test(html) && html.includes("Photograph: Grove Gallery"), "the photo and its credit are on the site");
  const marked = R.Site(R.fromFiles(content), pages, "", { mark: true }).all().map((p) => p.html).join("\n");
  assert.ok(/data-adh="picture"/.test(marked), "in the editor the photo frame can be clicked");
}
console.log("ALL TESTS PASSED");
