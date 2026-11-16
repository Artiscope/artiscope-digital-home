// Street Art Dispatch: its words, kept in data/content.json, edited from the console.
import { sadDir } from "./where.mjs";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import assert from "node:assert/strict"; import { execFileSync } from "node:child_process";
import { handle, SITES, entriesOf, entryView, applyEntry, ownCopyId, safeMarks } from "./home.mjs";

const S_DIR = sadDir();
const ADMIN = "boss@x.com", SR = "Artiscope/street-art-dispatch", SAD = "street-art-dispatch";
globalThis.Deno = { env: { get: (k) => ({ GITHUB_TOKEN: "t", ALLOWED_EMAILS: ADMIN, SUPABASE_URL: "https://s", SUPABASE_SERVICE_ROLE_KEY: "k" }[k] || "") }, serve() {} };
const { makeGitHub } = await import("./fakegit.mjs"); const { makePeople } = await import("./fakepeople.mjs");
const src = fs.readFileSync(S_DIR + "/data/content.json", "utf8"), D0 = JSON.parse(src);
const hub = makeGitHub({ [SR]: { "data/content.json": src, "CNAME": "streetartdispatch.com", "AGENT-LOG.md": "# Log\n" } });
const ppl = makePeople(); let signedIn = ADMIN;
globalThis.fetch = async (url, init = {}) => {
  if (String(url).includes("/auth/v1/user")) return new Response(JSON.stringify({ email: signedIn }));
  if (ppl.handles(url)) return ppl.fetch(url, init);
  return hub.fetch(url, init);
};
const as = async (who, b) => { signedIn = who; const r = await handle(new Request("https://x", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify(b) })); const d = await r.json(); d.status = r.status; return d; };
let n = 0; const check = (c, msg) => { assert.ok(c, msg); n++; };

// it is the third site, live, with Content and the shared screens but no Pages, Theme or Photos yet
const site = SITES.find((s) => s.id === SAD);
check(site && site.live && site.repo === SR && site.domain === "streetartdispatch.com", "set up as a live site");
check(!SITES.some((s) => s.id === "site-3"), "the empty Site 3 has gone");
let d = await as(ADMIN, { action: "overview" }); const card = d.sites.find((s) => s.id === SAD);
check(card && card.pagesOn === false && card.themeOn === false && card.photosOn === false, "only Content and the shared screens");
check(d.sites.find((s) => s.id === "world-art-review").pagesOn === true, "World Art Review keeps its Pages screen");

// every list reads, with plain labels
d = await as(ADMIN, { action: "content", site: SAD }); const CONTENT = d;
const counts = Object.fromEntries(d.collections.map((c) => [c.id, c.entries.length]));
check(counts.dispatches === D0.features.length && counts.columns === D0.columns.length && counts.artists === D0.artists.length, "articles and artists");
check(counts.archive === D0.archive.length && counts.exhibitions === D0.exhibitions.length && counts.notes === Object.keys(D0.artist_notes).length, "archive, exhibitions, notes");
check(counts.glossary === D0.glossary.length && counts.figures === D0.stats.length && counts.about === 1 && counts.contact === 1 && counts.issue === 1, "pairs and single pages");
const col = (id) => CONTENT.collections.find((c) => c.id === id);
const allNames = d.collections.flatMap((c) => c.entries.flatMap((e) => e.fields.map((f) => f.name)));
check(!allNames.some((x) => ["slug", "cover", "read", "column", "name"].includes(x)), "web addresses, pictures and links stay locked");
check(col("exhibitions").entries[0].fields.find((f) => f.name === "t").label === "Title", "short names get plain labels");
check(col("archive").canDelete && col("exhibitions").canDelete && !col("dispatches").canDelete && !col("artists").canDelete, "only archive and exhibitions can be deleted");
check(!d.collections.some((c) => c.canHide), "nothing is hidden, the build needs every entry");

// saving everything as it is changes nothing at all
const D1 = JSON.parse(src); let changed = 0;
for (const c of site.collections) for (const x of entriesOf(D1, c)) changed += applyEntry(x, c, Object.fromEntries(entryView(x, c).fields.map((f) => [f.name, f.value])));
check(changed === 0 && JSON.stringify(D1) === JSON.stringify(D0), "a save with nothing changed leaves the file alone");

// a year is a whole number or TBC
{
  const D = JSON.parse(src), c = site.collections.find((k) => k.id === "archive"), xs = entriesOf(D, c);
  const tbc = xs.find((x) => x.ref.y === "TBC"), dated = xs.find((x) => typeof x.ref.y === "number");
  check(entryView(dated, c).fields.find((f) => f.name === "y").type === "text", "the year is typed as words");
  check(applyEntry(tbc, c, { y: " 2025 " }) === 1 && tbc.ref.y === 2025, "2025 is kept as a number");
  check(applyEntry(dated, c, { y: "" }) === 1 && dated.ref.y === "TBC", "an empty year becomes TBC");
}
check(!/script|onerror|javascript/i.test(safeMarks('<p>Hi</p><script>x()</script><img src=x onerror="y"><a href="javascript:z">a</a>')), "nothing that runs on the page is kept");
check(safeMarks('<p class="dropcap">Hi <a href="https://x.org">x</a></p>') === '<p class="dropcap">Hi <a href="https://x.org">x</a></p>', "ordinary marks are kept");

// the admin edits the live site: one value changes, with the admin's name, and nothing else moves
const pick = (cid, i = 0) => col(cid).entries[i];
const disp = pick("dispatches", 1);
d = await as(ADMIN, { action: "saveEntry", site: SAD, collection: "dispatches", id: disp.id, values: { title: "A changed title" } }); check(d.ok, "save a dispatch");
let now = JSON.parse(hub.read(SR, "main", "data/content.json"));
check(now.features[1].title === "A changed title" && JSON.stringify({ ...now, features: D0.features }) === JSON.stringify({ ...D0, features: D0.features }), "only that dispatch changed");
check(JSON.stringify(now.features.slice(2)) === JSON.stringify(D0.features.slice(2)), "the other dispatches are untouched");
check(hub.read(SR, "main", "data/content.json").split("\n").length > 600 && hub.read(SR, "main", "data/content.json").startsWith('{\n  "'), "saved one value per line");
const note = col("notes").entries.find((e) => e.id === "Invader");
await as(ADMIN, { action: "saveEntry", site: SAD, collection: "notes", id: "Invader", values: { Invader: "A changed note", Banksy: "should not land" } });
now = JSON.parse(hub.read(SR, "main", "data/content.json"));
check(now.artist_notes.Invader === "A changed note" && now.artist_notes.Banksy === D0.artist_notes.Banksy && note, "a note saves only itself");
check((await as(ADMIN, { action: "deleteEntry", site: SAD, collection: "dispatches", id: disp.id })).status === 400, "a dispatch cannot be deleted");
const ex = pick("exhibitions", 2);
check((await as(ADMIN, { action: "deleteEntry", site: SAD, collection: "exhibitions", id: ex.id })).ok, "an exhibition can be deleted");
now = JSON.parse(hub.read(SR, "main", "data/content.json")); check(now.exhibitions.length === D0.exhibitions.length - 1, "and it is gone");
check(!hub.commitLog(SR).some((c) => /@/.test(c.message)) && hub.commitLog(SR).slice(-1)[0].message.endsWith("(by admin)"), "no email address goes into GitHub");

// an editor gets their own copy, saves there and publishes it as a version
await as(ADMIN, { action: "invitePerson", email: "ed@example.org", name: "Ed Editor", sites: [SAD] });
const E = "ed@example.org", mine = ownCopyId(ppl.table[0].id);
check((await as(E, { action: "makeCopy", site: SAD })).copy === mine, "an editor's own copy");
check((await as(E, { action: "saveEntry", site: SAD, collection: "issue", id: "only", values: { date: "December 2026" } })).status === 403, "an editor cannot change the live site");
check((await as(E, { action: "saveEntry", site: SAD, copy: mine, collection: "issue", id: "only", values: { date: "December 2026" } })).ok, "an editor saves on their copy");
check(JSON.parse(hub.read(SR, "main", "data/content.json")).date === D0.date, "the live site waits");
d = await as(E, { action: "publish", site: SAD, copy: mine }); check(d.ok && d.version === "1.1", "published as version 1.1");
check(JSON.parse(hub.read(SR, "main", "data/content.json")).date === "December 2026", "now live");
check(hub.releases(SR).length >= 1, "kept as a GitHub release");

// the file the console saves still builds into the site
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sad-"));
for (const f of execFileSync("git", ["ls-files"], { cwd: S_DIR, encoding: "utf8" }).split("\n").filter(Boolean)) {
  fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.copyFileSync(path.join(S_DIR, f), path.join(tmp, f));
}
fs.writeFileSync(path.join(tmp, "data/content.json"), hub.read(SR, "main", "data/content.json"));
execFileSync("python3", [path.join(tmp, "tools/build.py"), path.join(tmp, "_out")], { stdio: "pipe" });
const built = (p) => fs.readFileSync(path.join(tmp, "_out", p), "utf8");
check(built("index.html").includes("December 2026") || fs.readdirSync(path.join(tmp, "_out"), { recursive: true }).some((p) => String(p).endsWith(".html") && built(String(p)).includes("December 2026")), "the new issue date is on the built pages");
check(fs.readdirSync(path.join(tmp, "_out"), { recursive: true }).some((p) => String(p).endsWith(".html") && built(String(p)).includes("A changed title")), "the edited dispatch is on the built pages");
fs.rmSync(tmp, { recursive: true, force: true });
console.log(n + " of " + n + " passed. STREET ART DISPATCH CHECKS PASSED");
