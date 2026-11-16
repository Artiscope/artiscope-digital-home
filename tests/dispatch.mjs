// Street Art Dispatch: edited in the page editor like the other sites, drawn by its own assets/render.js.
import { sadDir } from "./where.mjs";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import assert from "node:assert/strict"; import { execFileSync } from "node:child_process";
import { handle, SITES, ownCopyId, safeMarks, sadForEditor, sadFromEditor } from "./home.mjs";

const S_DIR = sadDir();
const ADMIN = "boss@x.com", SR = "Artiscope/street-art-dispatch", SAD = "street-art-dispatch";
globalThis.Deno = { env: { get: (k) => ({ GITHUB_TOKEN: "t", ALLOWED_EMAILS: ADMIN, SUPABASE_URL: "https://s", SUPABASE_SERVICE_ROLE_KEY: "k" }[k] || "") }, serve() {} };
const { makeGitHub } = await import("./fakegit.mjs"); const { makePeople } = await import("./fakepeople.mjs");
const read0 = (p) => fs.readFileSync(S_DIR + "/" + p, "utf8");
const content0 = read0("data/content.json"), pages0 = read0("data/pages.json"), C0 = JSON.parse(content0);
const hub = makeGitHub({ [SR]: { "data/content.json": content0, "data/pages.json": pages0, "data/theme.json": read0("data/theme.json"), "CNAME": "streetartdispatch.com", "AGENT-LOG.md": "# Log\n" } });
const ppl = makePeople(); let signedIn = ADMIN;
globalThis.fetch = async (url, init = {}) => {
  if (String(url).includes("/auth/v1/user")) return new Response(JSON.stringify({ email: signedIn }));
  if (ppl.handles(url)) return ppl.fetch(url, init);
  return hub.fetch(url, init);
};
const as = async (who, b) => { signedIn = who; const r = await handle(new Request("https://x", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify(b) })); const d = await r.json(); d.status = r.status; return d; };
const file = (p, ref = "main") => JSON.parse(hub.read(SR, ref, p));
const clone = (x) => JSON.parse(JSON.stringify(x));
let n = 0; const check = (c, msg) => { assert.ok(c, msg); n++; };

// it is a site like the other two: Pages, Theme, Files, Versions and History, and no separate Content screen
const site = SITES.find((s) => s.id === SAD);
check(site && site.live && site.repo === SR && site.domain === "streetartdispatch.com", "set up as a live site");
let d = await as(ADMIN, { action: "overview" }); const card = d.sites.find((s) => s.id === SAD);
check(card.pagesOn && card.themeOn && card.photosOn && card.files && card.edits, "every screen the other sites have");
check((site.collections || []).length === 0, "no separate Content lists");

// the page editor opens with every section the other sites offer
const pg = await as(ADMIN, { action: "pages", site: SAD });
check(pg.status === 200 && pg.gam === true && pg.model === "sad", "opens in the page editor");
const shared = ["announcement", "columns", "space", "quote", "faq", "button", "picture-banner", "slideshow", "gallery", "logo-row", "picture", "text-picture", "artworks", "exhibitions", "career", "press", "signup", "visit", "contact-form"];
check(shared.every((k) => pg.kinds[k]), "every shared section is offered");
check(["hero", "features", "profiles", "archive", "exhibition-list", "collecting", "text-page"].every((k) => pg.kinds[k]), "and the site's own sections");
check(pg.site.articles.length === C0.features.length + C0.columns.length && pg.site.artists.length === C0.artists.length, "articles and artists come with it");
check(pg.preview === "https://streetartdispatch.com/", "previews the live site");
check((await as(ADMIN, { action: "savePages", site: SAD, pages: pg.pages, content: pg.site, version: pg.version })).unchanged === true, "opening and saving changes nothing");

// what the editor sees, saved back unchanged, leaves the file exactly as it was
check(JSON.stringify(sadFromEditor(site.items, clone(sadForEditor(C0)), C0).content) === JSON.stringify(C0), "a save with nothing changed leaves the content file alone");

// a page edit changes only the page list, signed by the admin, with no email address
let doc = clone(pg.pages); doc.pages.home.sections[0].settings.headline = "Typed in the console";
d = await as(ADMIN, { action: "savePages", site: SAD, pages: doc, what: "Opening banner", version: pg.version }); check(d.ok, "save a page edit");
check(file("data/pages.json").pages.home.sections[0].settings.headline === "Typed in the console", "the heading is saved");
check(hub.read(SR, "main", "data/content.json") === content0, "the content file is untouched");
const msgs = hub.commitLog(SR).map((c) => c.message).filter((m) => m !== "Start");
check(msgs.every((m) => !/@/.test(m)) && msgs.every((m) => /\(by admin\)$/.test(m)), "signed by admin, no email address: " + msgs.join(" | "));

// an article, an artist and the issue details, saved together
let p2 = await as(ADMIN, { action: "pages", site: SAD }), c = clone(p2.site);
c.articles.find((a) => a.slug === "spectacle-to-collectable").title = "From Spectacle to Collectable";
c.artists.find((a) => a.slug === "banksy").role = "Stencil · Satire";
c.site.date = "December 2026";
c.archive[0].y = "2025";
d = await as(ADMIN, { action: "savePages", site: SAD, pages: p2.pages, content: c, what: "Words", version: p2.version }); check(d.ok, "save content edits");
let now = file("data/content.json");
check(now.features.find((f) => f.slug === "spectacle-to-collectable").title === "From Spectacle to Collectable" && now.date === "December 2026", "article and issue date saved");
check(now.artists.find((a) => a.name === "Banksy").role === "Stencil · Satire" && !("slug" in now.artists.find((a) => a.name === "Banksy")), "artist saved, its address kept as it was");
check(now.archive[0].y === 2025 && now.archive.filter((x) => x.pending).length === C0.archive.filter((x) => x.pending).length, "a year is saved as a number and the dates to confirm stay");
check(JSON.stringify(now.columns) === JSON.stringify(C0.columns) && JSON.stringify(now.exhibitions) === JSON.stringify(C0.exhibitions), "everything else is untouched");

// a new article starts hidden, and can move to Urban Culture
p2 = await as(ADMIN, { action: "pages", site: SAD }); c = clone(p2.site);
c.articles.push({ slug: "a-new-dispatch", section: "urban-culture", kicker: "Column", title: "A new column", standfirst: "", tags: [], body: "<p>Write here.</p><script>x()</script>", hidden: true });
d = await as(ADMIN, { action: "savePages", site: SAD, pages: p2.pages, content: c, version: p2.version }); check(d.ok, "add an article");
now = file("data/content.json"); const added = now.columns.find((x) => x.slug === "a-new-dispatch");
check(added && added.hidden === true && added.column === true && !/script/.test(added.body), "kept hidden, as a column, with nothing that runs on a page");
check(!safeMarks('<p onclick="x">a</p>').includes("onclick"), "unsafe marks are removed");

// a new section of every shared kind, on a new page
p2 = await as(ADMIN, { action: "pages", site: SAD }); doc = clone(p2.pages);
doc.pages.trial = { path: "trial/index.html", title: "Trial | Street Art Dispatch", description: "", current: "", intro: false, sections: shared.map((k, i) => ({ id: k + "-1", type: k, visible: true, settings: clone(p2.kinds[k].starter || {}) })) };
d = await as(ADMIN, { action: "savePages", site: SAD, pages: doc, what: "Trial page", version: p2.version }); check(d.ok, "a page with every shared section saves: " + (d.error || ""));

// an editor works on their own copy and publishes it as a version
await as(ADMIN, { action: "invitePerson", email: "ed@example.org", name: "Ed Editor", sites: [SAD] });
const E = "ed@example.org", mine = ownCopyId(ppl.table[0].id);
check((await as(E, { action: "makeCopy", site: SAD })).copy === mine, "an editor's own copy");
const pe = await as(E, { action: "pages", site: SAD, copy: mine }); const de = clone(pe.pages); de.pages.home.sections[0].settings.eyebrow = "From the desk";
check((await as(E, { action: "savePages", site: SAD, pages: de, version: pe.version })).status === 403, "an editor cannot change the live site");
check((await as(E, { action: "savePages", site: SAD, copy: mine, pages: de, version: pe.version })).ok, "an editor saves on their copy");
check(file("data/pages.json").pages.home.sections[0].settings.eyebrow === "From the editors", "the live site waits");
d = await as(E, { action: "publish", site: SAD, copy: mine }); check(d.ok && d.version === "1.1", "published as version 1.1");
check(file("data/pages.json").pages.home.sections[0].settings.eyebrow === "From the desk" && hub.releases(SR).length >= 1, "now live, kept as a release");

// the theme saves to data/theme.json
const th = await as(ADMIN, { action: "theme", site: SAD });
check(th.spec.colours.length === 3 && th.values.colours.linen === "#EFE6D3" && th.values.fonts.display === "Gloock", "the theme reads the site's own colours and typefaces");
check((await as(ADMIN, { action: "saveTheme", site: SAD, values: th.values })).unchanged === true, "saving the theme unchanged changes nothing");
d = await as(ADMIN, { action: "saveTheme", site: SAD, values: { colours: { ...th.values.colours, ruby: "#C2412D" }, fonts: th.values.fonts } }); check(d.ok, "a theme change saves");
check(/--ruby:#C2412D/.test(file("data/theme.json").css), "and is written for the site");

// the files the console saved still build into the site, with every change on the pages
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sad-"));
for (const f of execFileSync("git", ["ls-files"], { cwd: S_DIR, encoding: "utf8" }).split("\n").filter(Boolean).concat(["assets/render.js", "tools/build.mjs", "data/pages.json", "data/theme.json"])) {
  if (!fs.existsSync(path.join(S_DIR, f))) continue; fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.copyFileSync(path.join(S_DIR, f), path.join(tmp, f));
}
for (const f of ["data/content.json", "data/pages.json", "data/theme.json"]) fs.writeFileSync(path.join(tmp, f), hub.read(SR, "main", f));
execFileSync("python3", [path.join(tmp, "tools/build.py"), path.join(tmp, "_out")], { stdio: "pipe" });
const built = (p) => fs.readFileSync(path.join(tmp, "_out", p), "utf8");
check(built("index.html").includes("Typed in the console") && built("index.html").includes("From the desk"), "the page edits are on the home page");
check(built("dispatches/spectacle-to-collectable/index.html").includes("December 2026"), "the issue date is on the articles");
check(built("index.html").includes("--ruby:#C2412D"), "the theme is on the pages");
const trial = fs.existsSync(path.join(tmp, "_out/trial/index.html")) ? built("trial/index.html") : "";
const marks = { announcement: 'class="ann ', columns: 'class="lgrid', space: 'class="space ', quote: 'class="bigq"', faq: 'class="qa"', button: 'class="cta', "picture-banner": 'class="pb ', slideshow: "data-slides", gallery: "data-gallery", "logo-row": 'class="lgrow', picture: 'class="pic', "text-picture": 'class="tp', artworks: 'class="aw"', exhibitions: 'class="egrid"', career: 'class="car"', press: 'class="lcard pq"', signup: 'class="nl"', visit: 'class="lcard vis"', "contact-form": 'data-mailform="contact"' };
check(shared.every((k) => trial.includes(marks[k])), "every shared section is drawn: missing " + shared.filter((k) => !trial.includes(marks[k])).join(", "));
check(!fs.existsSync(path.join(tmp, "_out/urban-culture/a-new-dispatch/index.html")), "a hidden article gets no page");
fs.rmSync(tmp, { recursive: true, force: true });
console.log(n + " of " + n + " passed. STREET ART DISPATCH CHECKS PASSED");
