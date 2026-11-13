// The Practice site: a copy of World Art Review that people can be given to try things out on.
import { W_DIR } from "./where.mjs";
import fs from "node:fs"; import assert from "node:assert/strict";
import { handle, SITES, ownCopyId } from "./home.mjs";

const ADMIN = "boss@x.com";
globalThis.Deno = { env: { get: (k) => ({ GITHUB_TOKEN: "t", ALLOWED_EMAILS: ADMIN, SUPABASE_URL: "https://s", SUPABASE_SERVICE_ROLE_KEY: "k" }[k] || "") }, serve() {} };
const { makeGitHub } = await import("./fakegit.mjs"); const { makePeople } = await import("./fakepeople.mjs");
const WR = "Artiscope/World-art-review", PR = "Artiscope/practice-site";
const warSite = fs.readFileSync(W_DIR + "/content/site.json", "utf8"), warPages = fs.readFileSync(W_DIR + "/content/pages.json", "utf8");
const hub = makeGitHub({
  [WR]: { "content/site.json": warSite, "content/pages.json": warPages, "content/theme.json": "{}", "images/zara-muse.jpg": "picture", "CNAME": "worldartreview.com" },
  [PR]: { "content/site.json": warSite.replace("Zara Muse", "Practised Name"), "content/pages.json": warPages, "content/theme.json": '{"colours":{"paper":"#000000"}}', "images/someone-tried-this.jpg": "x", "tools/build_site.py": "print(1)" },
});
const ppl = makePeople(); let signedIn = ADMIN;
globalThis.fetch = async (url, init = {}) => {
  if (String(url).includes("/auth/v1/user")) return new Response(JSON.stringify({ email: signedIn }));
  if (ppl.handles(url)) return ppl.fetch(url, init);
  return hub.fetch(url, init);
};
const as = async (who, b) => { signedIn = who; const r = await handle(new Request("https://x", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify(b) })); const d = await r.json(); d.status = r.status; return d; };
const P = "practice-site";

// it is a site like World Art Review, at its own unlisted address
const ps = SITES.find((s) => s.id === P); assert.equal(ps.repo, PR); assert.equal(ps.domain, "artiscope.github.io/practice-site"); assert.equal(ps.sectionKinds, SITES[0].sectionKinds);
let d = await as(ADMIN, { action: "overview" }); const card = d.sites.find((s) => s.id === P);
assert.equal(card.practice, true); assert.equal(d.sites.length, 6);

// someone given only the Practice site works there, and never reaches the real sites
await as(ADMIN, { action: "invitePerson", email: "trainee@example.org", name: "Tess Trainee", sites: [P] });
const T = "trainee@example.org", mine = ownCopyId(ppl.table[0].id);
d = await as(T, { action: "overview" }); assert.deepEqual(d.sites.map((s) => s.id), [P]);
assert.equal((await as(T, { action: "content", site: "world-art-review" })).status, 403);
assert.equal((await as(T, { action: "makeCopy", site: P })).copy, mine);
assert.ok(hub.refs(PR)["adh/" + mine] && !hub.refs(WR)["adh/" + mine], "the copy is made in the practice repository only");
const first = (await as(T, { action: "content", site: P, copy: mine })).collections[0].entries[0];
await as(T, { action: "saveEntry", site: P, copy: mine, collection: "articles", id: first.id, values: { title: "Practising" } });
d = await as(T, { action: "publish", site: P, copy: mine }); assert.equal(d.ok, true); assert.equal(d.version, "1.1");
assert.equal(JSON.parse(hub.read(PR, "main", "content/site.json")).articles[0].title, "Practising");
assert.equal(hub.read(WR, "main", "content/site.json"), warSite, "World Art Review is untouched");
assert.equal(hub.releases(WR).length, 0, "no versions on World Art Review");

// only the admin starts it again, and only the Practice site can be started again
assert.equal((await as(T, { action: "resetPractice", site: P })).status, 403);
assert.equal((await as(ADMIN, { action: "resetPractice", site: "world-art-review" })).status, 400);
d = await as(ADMIN, { action: "resetPractice", site: P }); assert.equal(d.ok, true);
assert.equal(hub.read(PR, "main", "content/site.json"), warSite, "the words are World Art Review's again");
assert.equal(hub.read(PR, "main", "content/theme.json"), "{}", "and so is the theme");
assert.equal(hub.read(PR, "main", "images/zara-muse.jpg"), "picture", "its photos are copied");
assert.equal(hub.read(PR, "main", "images/someone-tried-this.jpg"), null, "photos added in practice are cleared");
assert.equal(hub.read(PR, "main", "tools/build_site.py"), "print(1)", "the practice site's own workings are left alone");
assert.equal(hub.read(PR, "main", "CNAME"), null, "the real address never comes across");
assert.match(hub.lastMessage(PR, "main"), /^Start again from World Art Review \(by admin\)$/);
assert.equal((await as(ADMIN, { action: "resetPractice", site: P })).unchanged, true, "starting again twice changes nothing");
// the trainee's copy is then behind, and can be brought up to date
d = await as(T, { action: "overview", copies: { [P]: mine } }); assert.ok(d.sites[0].copies.find((c) => c.id === mine).behind > 0);
console.log("PRACTICE CHECKS PASSED");
