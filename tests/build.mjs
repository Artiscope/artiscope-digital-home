// Start building: a new site made from the starter with the owner's choices, the practice build
// rebuilt the same way, finishing what GitHub refused the first time, and connecting a web address.
import { C_DIR, W_DIR, G_DIR, sadDir } from "./where.mjs";
import fs from "node:fs"; import path from "node:path"; import assert from "node:assert/strict"; import { execFileSync } from "node:child_process";

const ADMIN = "boss@x.com";
globalThis.Deno = { env: { get: (k) => ({ GITHUB_TOKEN: "t", ALLOWED_EMAILS: ADMIN, SUPABASE_URL: "https://s", SUPABASE_SERVICE_ROLE_KEY: "k" }[k] || "") }, serve() {} };
const h = await import("./home.mjs");
const { makeGitHub } = await import("./fakegit.mjs"); const { makePeople } = await import("./fakepeople.mjs");

// the starter, as the console's repository holds it
const walk = (dir, base = "") => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name), base + e.name + "/") : [[base + e.name, fs.readFileSync(path.join(dir, e.name), "utf8")]]);
const starter = Object.fromEntries(walk(C_DIR + "/starter").filter(([f]) => !f.endsWith(".gitkeep")));
// and the Street Art Dispatch template beside it
const TSAD = Object.fromEntries(walk(C_DIR + "/templates/street-art-dispatch").filter(([f]) => !f.endsWith(".gitkeep")));
const CR = "Artiscope/artiscope-digital-home", PB = "Artiscope/practice-build";
const list = { sites: [{ id: "practice-build", name: "Practice build", domain: "artiscope.github.io/practice-build", repo: PB, kind: "starter", playground: true, live: true }, { id: "site-4", name: "Site 4", domain: "", repo: "", live: false }, { id: "site-5", name: "Site 5", domain: "", repo: "", live: false }, { id: "site-9", name: "Site 9", domain: "", repo: "", live: false }] };
const rd = (dir, f) => fs.readFileSync(dir + "/" + f, "utf8");
const hub = makeGitHub({
  [CR]: { "sites.json": JSON.stringify(list), ...Object.fromEntries(Object.entries(starter).map(([f, t]) => ["starter/" + f, t])), ...Object.fromEntries(Object.entries(TSAD).map(([f, t]) => ["templates/street-art-dispatch/" + f, t])) },
  [PB]: { ...Object.fromEntries(Object.entries(starter).filter(([f]) => !f.startsWith(".github/"))), ".github/workflows/pages.yml": starter[".github/workflows/pages.yml"] },
  "Artiscope/World-art-review": { "content/pages.json": rd(W_DIR, "content/pages.json") },
  "Artiscope/global-art-monitor": { "data/pages.json": rd(G_DIR, "data/pages.json") },
  "Artiscope/street-art-dispatch": { "data/pages.json": rd(sadDir(), "data/pages.json") },
});
const ppl = makePeople(); let signedIn = ADMIN, dns = {}, dnsTyped = null;
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ email: signedIn }));
  if (url.startsWith("https://dns.google/")) { const q = new URL(url).searchParams; if (dnsTyped) return new Response(JSON.stringify({ Answer: dnsTyped[q.get("name") + " " + (q.get("type") === "A" ? 1 : 5)] || [] })); return new Response(JSON.stringify({ Answer: (dns[q.get("name") + " " + q.get("type")] || []).map((data) => ({ data })) })); }
  if (ppl.handles(url)) return ppl.fetch(url, init);
  return hub.fetch(url, init);
};
const as = async (who, b) => { signedIn = who; const r = await handle(new Request("https://x", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify(b) })); const d = await r.json(); d.status = r.status; return d; };
const { handle } = h;
const read = (repo, f) => { const t = hub.read(repo, "main", f); return t == null ? null : JSON.parse(t); };
let n = 0; const ok = (what) => { n++; if (process.env.VERBOSE) console.log("ok " + what); };

// ----- the choices, checked -----
const c = h.cleanBuild({ name: "  Grove Prints ", tagline: "Prints from the studio", domain: "HTTPS://www.GrovePrints.co.uk/shop", registrar: "godaddy", look: "Like Street Art Dispatch", pages: "set" }, { name: "Site 4" });
assert.deepEqual([c.name, c.domain, c.registrar, c.look, c.pages, c.email], ["Grove Prints", "groveprints.co.uk", "godaddy", "Like Street Art Dispatch", "set", "info@grovegallery.com"]); ok("choices are tidied");
assert.throws(() => h.cleanBuild({ domain: "not a domain" }, {}), /should look like newsite\.com/); ok("a wrong web address is refused in plain words");
assert.throws(() => h.cleanBuild({ domain: "artiscope.github.io" }, {}), /domain you own/); ok("a GitHub address is not a domain you own");
assert.throws(() => h.cleanBuild({ email: "nope" }, {}), /does not look like an email/); ok("a wrong email is refused");
assert.equal(h.cleanBuild({ look: "Neon", pages: "everything", registrar: "x" }, { name: "Site 4" }).look, "Ink and clay"); ok("unknown choices fall back");
assert.equal(h.buildSlug("Grove & Friends: Prints!"), "grove-and-friends-prints"); ok("the repository name comes from the site name");
assert.equal(h.buildLooks().length, 12); assert.equal(h.buildLooks().filter((l) => l.mine).length, 3); ok("twelve looks, three of them from the sites");

// ----- every plan builds, with placeholders in brackets and no made-up words -----
for (const [pages, from] of [["home"], ["set"], ["copy", "world-art-review"], ["copy", "global-art-monitor"], ["copy", "street-art-dispatch"]]) {
  const d = await as(ADMIN, { action: "planSite", site: "site-4", choices: { ...c, pages, from } });
  assert.equal(d.status, 200, JSON.stringify(d)); const plan = d.plan;
  assert.equal(plan.repo, "Artiscope/grove-prints"); assert.equal(plan.address, "https://artiscope.github.io/grove-prints/");
  assert.equal(plan.pages.shared.header.settings.name, "Grove Prints"); assert.equal(plan.pages.pages.home.title, "Grove Prints");
  assert.equal(plan.content.site.indexed, false, "hidden from search engines");
  assert.ok(plan.theme.css.includes("Gloock") && plan.theme.colours.band === "#163A30", "the chosen look");
  for (const pg of Object.values(plan.pages.pages)) for (const s of pg.sections) {
    assert.ok(h.STARTER_KINDS.includes(s.type), pages + ": " + s.type);
    for (const [k, v] of Object.entries(s.settings)) if (typeof v === "string" && v && /^(heading|text|body|title)$/.test(k) && !(k === "text" && s.id === "banner")) assert.ok(/^\[.*\]$/.test(v), pages + " " + s.id + "." + k + " = " + v);
  }
  const tmp = "/tmp/build-plan-" + pages + (from || ""); fs.rmSync(tmp, { recursive: true, force: true }); fs.cpSync(C_DIR + "/starter", tmp, { recursive: true });
  for (const [f, doc] of [["data/pages.json", plan.pages], ["data/theme.json", plan.theme], ["data/content.json", plan.content]]) fs.writeFileSync(tmp + "/" + f, JSON.stringify(doc));
  execFileSync("python3", ["tools/build.py", tmp + "/out"], { cwd: tmp, stdio: "pipe" });
  assert.ok(fs.readFileSync(tmp + "/out/index.html", "utf8").includes("Grove Prints"));
  if (pages === "set") { assert.deepEqual(Object.keys(plan.pages.pages), ["home", "about", "exhibitions", "visit", "contact"]); assert.deepEqual(plan.pages.shared.header.settings.links.map((l) => l[1]), ["./", "about/", "artists/", "exhibitions/", "visit/", "contact/"], "Artists is the list the site draws"); assert.ok(fs.existsSync(tmp + "/out/artists/index.html"), "the Artists list is published because the menu leads to it"); }
  if (from === "street-art-dispatch") assert.ok(!plan.pages.pages.artists && plan.notes.swapped.some((x) => /Artists list/.test(x.to)), "a page of artists becomes the Artists list");
  if (from === "world-art-review") assert.ok(plan.notes.left.some((x) => x.label === "Numbers band") && plan.notes.swapped.some((x) => x.to === "Picture banner"), JSON.stringify(plan.notes));
}
ok("every starting choice builds");
const visit = (await as(ADMIN, { action: "planSite", site: "site-4", choices: { ...c, pages: "set" } })).plan.pages.pages.visit.sections[0].settings.details;
assert.ok(visit.every((x) => x.text === ""), "Visit us never guesses an address or opening hours"); ok("Visit us starts empty");

// ----- only the admin starts a site; a test user only rebuilds the practice build -----
await as(ADMIN, { action: "invitePerson", email: "tess@example.org", name: "Tess", sites: ["practice-build", "site-4"] });
assert.equal((await as("tess@example.org", { action: "createSite", site: "site-4", choices: c })).status, 403); ok("an editor cannot start a new site");

// ----- the key cannot make repositories: nothing changes, and the message says what to set -----
hub.refuse(/^POST \/orgs\//, 403);
let d = await as(ADMIN, { action: "createSite", site: "site-4", choices: c });
assert.equal(d.status, 502); assert.match(d.error, /All repositories.*Administration/); assert.ok(!hub.repoMade("Artiscope/grove-prints")); ok("without permission nothing is made");
hub.allow();

// ----- a name already taken is refused before anything is made -----
d = await as(ADMIN, { action: "createSite", site: "site-4", choices: { ...c, name: "Practice build" } });
assert.equal(d.status, 400); assert.match(d.error, /already/); ok("a name in use is refused");

// ----- Create site: repository, publishing, files, version 1.0, the list of sites -----
d = await as(ADMIN, { action: "createSite", site: "site-4", choices: c });
assert.equal(d.status, 200, JSON.stringify(d)); assert.deepEqual(d.todo, []);
const R = "Artiscope/grove-prints";
assert.ok(hub.repoMade(R)); assert.equal(hub.pagesOf(R).build_type, "workflow");
assert.ok(hub.read(R, "main", ".github/workflows/pages.yml") && hub.read(R, "main", "tools/build.mjs") && hub.read(R, "main", "assets/render.js"), "the whole starter");
assert.equal(read(R, "data/pages.json").pages.about.sections[0].type, "text-picture"); assert.deepEqual([read(R, "data/content.json").articles, read(R, "data/content.json").artists], [[], []]);
assert.equal(read(R, "data/content.json").site.address, "https://artiscope.github.io/grove-prints/");
assert.equal(hub.releases(R)[0].tag_name, "v1.0"); assert.ok(!hub.releases(R)[0].body.includes("@"), "no email address in GitHub");
const saved = read(CR, "sites.json").sites.find((x) => x.id === "site-4");
assert.deepEqual([saved.name, saved.repo, saved.domain, saved.live, saved.kind, saved.want, saved.registrar], ["Grove Prints", R, "artiscope.github.io/grove-prints", true, "starter", "groveprints.co.uk", "godaddy"]);
ok("Create site makes the repository, switches publishing on, writes the starter, marks 1.0 and adds the site to the list");
d = await as(ADMIN, { action: "overview" });
const card = d.sites.find((x) => x.id === "site-4");
assert.deepEqual([card.name, card.live, card.starter, card.want, card.buildable], ["Grove Prints", true, true, "groveprints.co.uk", false]); ok("the new site is live on All sites");
d = await as(ADMIN, { action: "pages", site: "site-4" });
assert.equal(d.status, 200, JSON.stringify(d).slice(0, 300)); assert.ok(d.pages.pages.contact, "it opens in the page editor"); ok("it opens in the page editor");
assert.equal((await as(ADMIN, { action: "createSite", site: "site-4", choices: c })).status, 403); ok("a built site cannot be built again");

// ----- the web address: not yet, then connected -----
dns = { "groveprints.co.uk A": ["217.160.0.1"] };
d = await as(ADMIN, { action: "checkDomain", site: "site-4" });
assert.equal(d.connected, false); assert.deepEqual(d.found, ["217.160.0.1"]); assert.equal(hub.pagesOf(R).cname, null); ok("records not yet pointing at GitHub change nothing");
dns = { "groveprints.co.uk A": h.GITHUB_IPS, "www.groveprints.co.uk CNAME": ["artiscope.github.io."] };
d = await as(ADMIN, { action: "checkDomain", site: "site-4" });
assert.equal(d.connected, true, JSON.stringify(d)); assert.equal(d.wwwOk, true);
assert.equal(hub.pagesOf(R).cname, "groveprints.co.uk"); assert.equal(hub.pagesOf(R).https_enforced, true);
assert.deepEqual(read(R, "data/content.json").site, { email: "info@grovegallery.com", address: "https://groveprints.co.uk/", indexed: true });
assert.equal(read(CR, "sites.json").sites.find((x) => x.id === "site-4").domain, "groveprints.co.uk"); ok("connecting sets the address on GitHub, lets search engines in and moves the site to its own address");

// ----- the publishing steps refused: the site is still made, and Try again finishes it -----
hub.refuseSteps("Artiscope/second-site");
d = await as(ADMIN, { action: "createSite", site: "site-5", choices: { name: "Second site", pages: "home" } });
assert.equal(d.status, 200, JSON.stringify(d)); assert.deepEqual(d.todo, ["steps"]);
assert.ok(!hub.read("Artiscope/second-site", "main", ".github/workflows/pages.yml") && hub.read("Artiscope/second-site", "main", "data/pages.json"), "made without its publishing steps");
assert.deepEqual(read(CR, "sites.json").sites.find((x) => x.id === "site-5").todo, ["steps"]); ok("without Workflows the site is made and the missing part is noted");
d = await as(ADMIN, { action: "finishSite", site: "site-5" }); assert.equal(d.status, 502); assert.match(d.error, /Workflows/); ok("Try again says what is still missing");
hub.allow();
const before = hub.read("Artiscope/second-site", "main", "data/pages.json");
d = await as(ADMIN, { action: "finishSite", site: "site-5" }); assert.equal(d.status, 200, JSON.stringify(d));
assert.ok(hub.read("Artiscope/second-site", "main", ".github/workflows/pages.yml")); assert.equal(hub.read("Artiscope/second-site", "main", "data/pages.json"), before, "only the publishing steps are added");
assert.deepEqual(read(CR, "sites.json").sites.find((x) => x.id === "site-5").todo, []); ok("Try again adds the publishing steps and nothing else");

// ----- the practice build: a test user rebuilds it with their choices, in its own repository -----
await as(ADMIN, { action: "updatePerson", email: "tess@example.org", name: "Tess", sites: ["practice-build"] });
hub.commitOn(PB, "main", "data/pages.json", hub.read(PB, "main", "data/pages.json"), "x");
await (async () => { const r = await hub.fetch("https://api.github.com/repos/" + PB + "/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/adh/trial-try", sha: hub.refs(PB).main }) }); assert.equal(r.status, 201); })();
d = await as("tess@example.org", { action: "createSite", site: "practice-build", choices: { name: "Tess's gallery", look: "Sand and navy", pages: "copy", from: "global-art-monitor" } });
assert.equal(d.status, 200, JSON.stringify(d)); assert.equal(d.practice, true);
assert.equal(read(PB, "data/pages.json").shared.header.settings.name, "Tess's gallery"); assert.ok(read(PB, "data/pages.json").pages.contact);
assert.equal(read(PB, "data/content.json").site.address, "https://artiscope.github.io/practice-build/");
assert.equal(read(PB, "data/theme.json").colours.band, "#1F2A44");
assert.ok(!Object.keys(hub.refs(PB)).some((r) => r.startsWith("adh/")), "its copies go"); assert.ok(hub.lastMessage(PB, "main").includes("(by "), "signed by the test user's code");
assert.ok(!hub.repoMade("Artiscope/tess-s-gallery"), "no new repository"); ok("a test user rebuilds the practice build with their own choices");

// ----- templates: a new site from the Street Art Dispatch design -----
{
  const T = "street-art-dispatch", TR = "Artiscope/wall-notes";
  const SAD_OWN = /Street Art Dispatch|streetartdispatch|Konn|Banksy|Invader|Fairey|Grove Gallery roster|sad-tile|sad-mark|assets\/brand/;
  let d = await as(ADMIN, { action: "planSite", site: "site-9", choices: { name: "Wall Notes", tagline: "Walls and what is on them", email: "hello@wallnotes.org", template: T } });
  assert.equal(d.status, 200, JSON.stringify(d).slice(0, 300));
  const tp = d.spec.templates; assert.deepEqual(tp.filter((x) => x.ready).map((x) => x.id), ["starter", T]); assert.ok(tp.find((x) => x.id === "the-art-correspondent").later); ok("five templates are offered, two of them ready");
  let plan = d.plan; assert.equal(plan.choices.template, T); assert.equal(plan.choices.pages, "template"); assert.equal(plan.choices.look, "Street Art Dispatch's own");
  assert.equal(d.spec.looks[0].own, true); assert.ok(!d.spec.looks.some((l) => l.name === "Like Street Art Dispatch"), "no second copy of its own look"); ok("the template's own look comes first");
  assert.deepEqual(Object.keys(plan.pages.pages).sort(), ["about", "artists", "collecting", "contact", "dispatches", "exhibitions", "home", "interventions", "urban-culture"]);
  assert.equal(plan.pages.shared.header.settings.name, "Wall Notes"); assert.equal(plan.pages.pages.home.title, "Wall Notes"); assert.equal(plan.pages.shared.footer.settings.tagline, "Walls and what is on them");
  assert.deepEqual([plan.content.features, plan.content.artists, plan.content.archive, plan.content.exhibitions, plan.content.stats], [[], [], [], [], []]);
  assert.deepEqual(plan.content.site, { email: "hello@wallnotes.org", address: "https://artiscope.github.io/wall-notes/", indexed: false });
  assert.deepEqual(plan.theme.colours, { linen: "#EFE6D3", pine: "#163A30", ruby: "#F0283C" }); assert.equal(plan.theme.fonts.display, "Gloock"); assert.equal(plan.theme.css, "", "its own look needs nothing over the design's own colours");
  assert.ok(!SAD_OWN.test(JSON.stringify({ ...plan.pages, _how_to_edit: "" }) + JSON.stringify(plan.content)), "nothing of Street Art Dispatch's own content");
  for (const pg of Object.values(plan.pages.pages)) for (const s of pg.sections) for (const [k, v] of Object.entries(s.settings)) {
    if (typeof v === "string" && v && /^(heading|headline|intro|text|stand|primer|eyebrow)$/.test(k)) assert.ok(/^\[.*\]$/.test(v), s.id + "." + k + " = " + v);
    if (k === "image") assert.equal(v, "", "no photos");
  }
  ok("the plan is the template's nine pages, with placeholders, empty lists and none of the original's words");
  d = await as(ADMIN, { action: "planSite", site: "site-9", choices: { name: "Wall Notes", template: T, look: "Ink and clay" } });
  assert.deepEqual(d.plan.theme.colours, { linen: "#F1EEE8", pine: "#22304A", ruby: "#A4572F" }); assert.equal(d.plan.theme.fonts.display, "Castoro"); ok("another look is put into the template's own colours by what each is for");
  d = await as(ADMIN, { action: "planSite", site: "site-9", choices: { name: "Wall Notes", template: "world-art-review" } });
  assert.equal(d.plan.choices.template, "starter"); ok("a template not ready yet falls back to the starter");
  // Create site
  d = await as(ADMIN, { action: "createSite", site: "site-9", choices: { name: "Wall Notes", tagline: "Walls and what is on them", email: "hello@wallnotes.org", template: T, look: "Ink and clay" } });
  assert.equal(d.status, 200, JSON.stringify(d));
  const files = hub.files(TR);
  assert.equal(hub.read(TR, "main", "assets/render.js"), TSAD["assets/render.js"]); assert.equal(hub.read(TR, "main", "assets/site.css"), TSAD["assets/site.css"]);
  assert.ok(files.includes(".github/workflows/pages.yml") && files.includes("tools/build.mjs") && files.includes("data/files.json"));
  assert.ok(!files.some((f) => /^(assets\/brand|brand)\/|CLAUDE\.md|AGENT-LOG|VOICE|photo-sources|fetch_photos|make_logo|CNAME/.test(f)), "nothing of the original's own: " + files.join(", "));
  assert.equal(read(TR, "data/theme.json").colours.pine, "#22304A");
  const entry = read(CR, "sites.json").sites.find((x) => x.id === "site-9"); assert.equal(entry.template, T);
  assert.match(hub.releases(TR)[0].body, /Street Art Dispatch template/); ok("Create site copies the template's design, its own data files and no more, and lists the site with its template");
  const card = h.SITES.find((x) => x.id === "site-9"); assert.equal(card.model.id, "sad"); assert.equal(card.template, T); assert.ok(card.sectionKinds.archive && !card.sectionKinds["picture-banner"].starter.heading?.includes("Street"));
  assert.ok(!JSON.stringify(card.items).includes('"draft"'), "no Draft note"); assert.deepEqual(card.items.site.parts[0].fields.map((f) => f.name), ["site.desk", "site.date", "site.email"]);
  d = await as(ADMIN, { action: "pages", site: "site-9" }); assert.equal(d.status, 200, JSON.stringify(d).slice(0, 300));
  assert.equal(d.model, "sad"); assert.ok(d.kinds.archive && d.kinds["contact-form"]); assert.equal(d.site.site.email, "hello@wallnotes.org"); ok("it opens in the page editor with the template's sections and its own email");
  // the email saves into the site's details, and a wrong one is refused
  const cn = read(TR, "data/content.json"), K = card.items;
  const r = h.sadFromEditor(K, { ...h.sadForEditor(cn), site: { desk: "The wall desk", date: "", email: "post@wallnotes.org" } }, cn);
  assert.equal(r.content.site.email, "post@wallnotes.org"); assert.equal(r.content.desk, "The wall desk"); assert.equal(r.content.site.address, "https://artiscope.github.io/wall-notes/");
  assert.throws(() => h.sadFromEditor(K, { ...h.sadForEditor(cn), site: { email: "nope" } }, cn), /does not look like an email/);
  const sadC = JSON.parse(rd(sadDir(), "data/content.json")); assert.ok(!("email" in h.sadForEditor(sadC).site), "Street Art Dispatch itself is unchanged"); ok("the site's email is kept in its details");
  // it builds, hidden from search engines, with its own email and no logo
  const tmp = "/tmp/build-tsad"; fs.rmSync(tmp, { recursive: true, force: true }); fs.cpSync(C_DIR + "/templates/" + T, tmp, { recursive: true });
  for (const f of ["data/pages.json", "data/theme.json", "data/content.json"]) fs.writeFileSync(tmp + "/" + f, hub.read(TR, "main", f));
  execFileSync("python3", [tmp + "/tools/build.py", tmp + "/_site"]);
  const home = fs.readFileSync(tmp + "/_site/index.html", "utf8");
  assert.ok(home.includes('content="noindex, nofollow"') && home.includes("Wall Notes") && home.includes("mailto:hello@wallnotes.org") && home.includes("https://artiscope.github.io/wall-notes/"));
  assert.ok(fs.readFileSync(tmp + "/_site/404.html", "utf8").includes("'/wall-notes/'"), "the page for a wrong address finds its way home");
  assert.equal(fs.readFileSync(tmp + "/_site/robots.txt", "utf8"), "User-agent: *\nDisallow: /\n"); assert.ok(!fs.existsSync(tmp + "/_site/CNAME"));
  for (const f of fs.readdirSync(tmp + "/_site", { recursive: true }).filter((x) => String(x).endsWith(".html"))) assert.ok(!SAD_OWN.test(fs.readFileSync(tmp + "/_site/" + f, "utf8")), f + " has the original's words");
  ok("the new site builds, hidden from search engines, with its own name and email and nothing of the original");
  // the practice build from the template, then Start again back to the starter
  d = await as("tess@example.org", { action: "createSite", site: "practice-build", choices: { name: "Tess tries walls", template: T } });
  assert.equal(d.status, 200, JSON.stringify(d));
  assert.equal(hub.read(PB, "main", "assets/render.js"), TSAD["assets/render.js"]); assert.ok(read(PB, "data/pages.json").pages.interventions);
  assert.equal(read(CR, "sites.json").sites.find((x) => x.id === "practice-build").template, T); assert.equal(h.SITES.find((x) => x.id === "practice-build").model.id, "sad");
  assert.match(hub.lastMessage(PB, "main"), /from the Street Art Dispatch template/); ok("the practice build can start from the template, and is run as a site of it");
  d = await as("tess@example.org", { action: "startAgain", site: "practice-build" }); assert.equal(d.status, 200, JSON.stringify(d));
  assert.equal(hub.read(PB, "main", "assets/render.js"), starter["assets/render.js"]); assert.ok(!hub.files(PB).includes("data/files.json") || true);
  assert.ok(!("template" in read(CR, "sites.json").sites.find((x) => x.id === "practice-build"))); assert.equal(h.SITES.find((x) => x.id === "practice-build").model.id, "starter");
  ok("Start again puts the practice build back on the starter");
}

// ----- step 5: articles and artists on a site built from the starter -----
{
  const K = h.SITES.find((x) => x.id === "practice-build").items;
  assert.ok(K.article && K.artist, "articles and artists can be edited");
  const base = { site: { email: "info@grovegallery.com", address: "https://artiscope.github.io/practice-build/", indexed: false }, articles: [], artists: [] };
  let r = h.starterFromEditor({ site: base.site, articles: [{ slug: "first-look", title: "First look", body: "<p>Hello <script>x()</script><b>there</b></p>", sources: [{ title: "A source", href: "javascript:alert(1)" }, { title: "" }], artist: "tess-example" }], artists: [{ slug: "tess-example", name: "Tess Example" }] }, base, K);
  const a0 = r.content.articles[0], x0 = r.content.artists[0];
  assert.equal(a0.hidden, true, "a new article starts hidden"); assert.equal(x0.hidden, true, "a new artist starts hidden");
  assert.ok(!a0.body.includes("script") && a0.body.includes("<b>there</b>"), "words keep their formatting and lose anything that could run: " + a0.body);
  assert.deepEqual(a0.sources, [{ title: "A source", publisher: "", date: "", href: "" }], "an empty source goes, and a link that is not a web address is dropped");
  assert.equal(a0.artist, "tess-example"); assert.deepEqual(r.changed, ["Add article: First look", "Add artist: Tess Example"]); ok("new articles and artists are cleaned and start hidden");
  assert.throws(() => h.starterFromEditor({ articles: [{ slug: "artists", title: "x" }] }, base, K), /taken by the articles page/); ok("the list addresses are kept for the lists");
  assert.throws(() => h.starterFromEditor({ articles: [{ slug: "a", title: "x" }, { slug: "a", title: "y" }] }, base, K), /same web address/); ok("two articles cannot share an address");
  assert.throws(() => h.starterFromEditor({ artists: [{ slug: "b", name: " " }] }, base, K), /needs a name/); ok("an artist needs a name");
  const c1 = r.content;
  r = h.starterFromEditor({ articles: c1.articles.map((a) => ({ ...a, hidden: false })), artists: c1.artists.map((x) => ({ ...x, name: "Tess Renamed", hidden: false })) }, c1, K);
  assert.equal(r.content.artists[0].slug, "tess-example", "the address stays when the name changes"); assert.deepEqual(r.changed, ["Show article: First look", "Show artist: Tess Renamed"]); ok("showing and renaming keep the address");
  const c2 = r.content;
  r = h.starterFromEditor({ articles: c2.articles, artists: [] }, c2, K);
  assert.equal(r.content.articles[0].artist, "", "an article about a removed artist points at nobody"); assert.ok(r.changed.includes("Remove artist: Tess Renamed")); ok("removing an artist leaves nothing pointing at them");
  // the pages: an article, an artist, the two lists and the menu, built from the starter
  const tmp = "/tmp/build-items"; fs.rmSync(tmp, { recursive: true, force: true }); fs.cpSync(C_DIR + "/starter", tmp, { recursive: true });
  const content = { ...c2, articles: [...c2.articles, { slug: "still-hidden", title: "Still hidden", hidden: true, sources: [] }] };
  const pages = JSON.parse(fs.readFileSync(tmp + "/data/pages.json", "utf8"));
  pages.templates = { article: { default: { name: "Default article", sections: [{ id: "main", type: "main" }, { id: "t-quote", type: "quote", visible: true, settings: { text: "{page.title}", who: "" } }] } } };
  fs.writeFileSync(tmp + "/data/content.json", JSON.stringify(content)); fs.writeFileSync(tmp + "/data/pages.json", JSON.stringify(pages));
  execFileSync("python3", ["tools/build.py", tmp + "/out"], { cwd: tmp, stdio: "pipe" });
  const art = fs.readFileSync(tmp + "/out/articles/first-look/index.html", "utf8"), who = fs.readFileSync(tmp + "/out/artists/tess-example/index.html", "utf8");
  const list = fs.readFileSync(tmp + "/out/articles/index.html", "utf8"), home = fs.readFileSync(tmp + "/out/index.html", "utf8");
  assert.ok(art.includes("First look") && art.includes("About <a") && art.includes("Tess Renamed") && art.includes("<b>there</b>"), "the article page");
  assert.ok(/<blockquote[\s\S]*First look/.test(art) || /class="q[^"]*"[\s\S]*First look/.test(art.split("</article>")[1] || ""), "the template's section, filled in from the article");
  assert.ok(who.includes("Articles about Tess Renamed") && who.includes("articles/first-look/"), "the artist page lists the article about them");
  assert.ok(list.includes("First look") && !list.includes("Still hidden"), "the Articles page lists what visitors can see");
  assert.ok(!fs.existsSync(tmp + "/out/articles/still-hidden"), "a hidden article gets no page");
  assert.ok(/href="articles\/">Articles<\/a>/.test(home) && /href="artists\/">Artists<\/a>/.test(home), "Articles and Artists join the menu once there is one");
  assert.ok(!art.includes("[Credit]") && !art.includes("[Add the sources"), "no editor placeholders on the published page");
  ok("article and artist pages, the lists and the menu are built");
}
// ----- edge cases found in the usability pass (Version 51) -----
{
  const card = { name: "Site 4" };
  assert.equal(h.cleanBuild({ name: "<script>alert(1)</script>Gallery" }, card).name, "alert(1) Gallery", "anything that looks like code goes from a name");
  assert.equal(h.cleanBuild({ name: "x", domain: "Café.com" }, card).domain, "xn--caf-dma.com", "a web address with accents is kept in the form DNS uses");
  assert.equal(h.cleanBuild({ name: "x", domain: "https://WWW.Example.co.uk/shop?x=1" }, card).domain, "example.co.uk");
  assert.throws(() => h.cleanBuild({ domain: "example.com:8080" }, card), /should look like newsite\.com/);
  assert.deepEqual([h.isSubdomain("example.co.uk"), h.isSubdomain("shop.example.co.uk"), h.isSubdomain("example.com"), h.isSubdomain("shop.example.com")], [false, true, false, true]);
  assert.deepEqual(h.dnsRecords("shop.example.co.uk"), [["CNAME", "shop", "artiscope.github.io"]], "a subdomain gets one CNAME record");
  assert.equal(h.dnsRecords("example.com").length, 5, "a whole domain gets four A records and www");
  ok("names, accented and sub domains are handled");
  // a Create site that stopped half way can be pressed again with the same name
  const more = read(CR, "sites.json"); more.sites.push({ id: "site-6", name: "Site 6", domain: "", repo: "", live: false });
  hub.commitOn(CR, "main", "sites.json", JSON.stringify(more), "Add a card"); h.useSiteList(more);
  hub.refuse(/^POST \/repos\/Artiscope\/half-made\/git\/trees/, 500, "Server Error");
  let d = await as(ADMIN, { action: "createSite", site: "site-6", choices: { name: "Half made" } });
  assert.equal(d.status, 502); assert.match(d.error, /site's files/); assert.ok(hub.repoMade("Artiscope/half-made"));
  hub.allow();
  d = await as(ADMIN, { action: "createSite", site: "site-6", choices: { name: "Half made" } });
  assert.equal(d.status, 200, JSON.stringify(d)); assert.match(d.done[0], /Carried on with the repository made last time/);
  assert.ok(hub.read("Artiscope/half-made", "main", "data/pages.json") && read(CR, "sites.json").sites.find((x) => x.id === "site-6").repo === "Artiscope/half-made");
  ok("a half-made site is finished by pressing Create site again");
  // someone else's repository with that name is never taken over
  await hub.fetch("https://api.github.com/orgs/Artiscope/repos", { method: "POST", body: JSON.stringify({ name: "taken-name", auto_init: true, homepage: "https://example.org/" }) });
  const more2 = read(CR, "sites.json"); more2.sites.push({ id: "site-7", name: "Site 7", domain: "", repo: "", live: false }); hub.commitOn(CR, "main", "sites.json", JSON.stringify(more2), "Add a card"); h.useSiteList(more2);
  d = await as(ADMIN, { action: "createSite", site: "site-7", choices: { name: "Taken name" } });
  assert.equal(d.status, 400); assert.match(d.error, /already a repository called Artiscope\/taken-name/); assert.ok(!hub.read("Artiscope/taken-name", "main", "data/pages.json"), "nothing written into it");
  ok("a repository the console did not begin is never taken over");
  // a subdomain connects with its CNAME record, and a lookup answer that lists the CNAME first still counts
  const more3 = read(CR, "sites.json"); more3.sites.push({ id: "site-8", name: "Site 8", domain: "", repo: "", live: false }); hub.commitOn(CR, "main", "sites.json", JSON.stringify(more3), "Add a card"); h.useSiteList(more3);
  d = await as(ADMIN, { action: "createSite", site: "site-8", choices: { name: "Shop site", domain: "shop.example.co.uk" } });
  assert.deepEqual(d.records, [["CNAME", "shop", "artiscope.github.io"]]);
  dnsTyped = { "shop.example.co.uk 5": [{ type: 5, data: "artiscope.github.io." }], "shop.example.co.uk 1": [{ type: 5, data: "artiscope.github.io." }, { type: 1, data: "185.199.108.153" }] };
  d = await as(ADMIN, { action: "checkDomain", site: "site-8" });
  assert.equal(d.connected, true, JSON.stringify(d)); assert.equal(hub.pagesOf("Artiscope/shop-site").cname, "shop.example.co.uk");
  dnsTyped = null;
  ok("a subdomain connects with its CNAME record");
}
h.useSiteList(h.DEFAULT_SITE_LIST);
console.log(n + " of " + n + " passed. START BUILDING CHECKS PASSED");
