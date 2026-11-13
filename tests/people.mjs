// People and permissions: one admin, and editors who work only on their own copy of their own sites.
// Supabase (sign-in and the people table) and GitHub are stood in for, in memory.
import { W_DIR } from "./where.mjs";
import fs from "node:fs"; import assert from "node:assert/strict";
import { handle, ownCopyId, ownerOfCopy, whatOf, byOf, cleanPerson, PEOPLE_SQL } from "./home.mjs";

const ADMIN = "boss@x.com";
let key = "service-key";
globalThis.Deno = { env: { get: (k) => ({ GITHUB_TOKEN: "t", ALLOWED_EMAILS: ADMIN, SUPABASE_URL: "https://s", SUPABASE_SERVICE_ROLE_KEY: key, SUPABASE_ANON_KEY: "anon" }[k] || "") }, serve() {} };
const { makeGitHub } = await import("./fakegit.mjs");
const WR = "Artiscope/World-art-review", GR = "Artiscope/global-art-monitor";
const hub = makeGitHub({ [WR]: { "content/site.json": fs.readFileSync(W_DIR + "/content/site.json", "utf8"), "content/pages.json": fs.readFileSync(W_DIR + "/content/pages.json", "utf8") }, [GR]: {} });

// the people table and the sign-in email, as Supabase would keep them
const { makePeople } = await import("./fakepeople.mjs");
const ppl = makePeople(); let signedIn = ADMIN; const mails = ppl.mails, dbKeys = ppl.keys;
const table = new Proxy([], { get: (_t, k) => { const v = ppl.table[k]; return typeof v === "function" ? v.bind(ppl.table) : v; } });
globalThis.fetch = async (url, init = {}) => {
  if (String(url).includes("/auth/v1/user")) return new Response(JSON.stringify({ email: signedIn }));
  if (ppl.handles(url)) return ppl.fetch(url, init);
  return hub.fetch(url, init);
};
const post = (b) => new Request("https://x", { method: "POST", headers: { Authorization: "Bearer t", apikey: "k" }, body: JSON.stringify(b) });
const as = async (who, b) => { signedIn = who; const r = await handle(post(b)); const d = await r.json(); d.status = r.status; return d; };
const site = "world-art-review";

// small parts
assert.ok(PEOPLE_SQL.includes("enable row level security"), "the table is closed to everyone but the server");
assert.equal(ownerOfCopy(ownCopyId("0123456789")), "0123456789"); assert.equal(ownerOfCopy("trial-winter-look-a1b2c3"), "");
assert.equal(whatOf("Edit page: Quote (by admin)"), "Edit page: Quote"); assert.equal(byOf("Edit page: Quote (by admin)"), "admin");
assert.equal(whatOf("Edit page: Quote (old@x.com)"), "Edit page: Quote"); assert.equal(byOf("Edit page: Quote (old@x.com)"), "old@x.com");
assert.deepEqual(cleanPerson({ name: "Sam — Taylor<b>", sites: ["world-art-review", "nowhere", "world-art-review"] }).sites, ["world-art-review"]);

// someone not invited is turned away, even with a working sign-in
let d = await as("stranger@x.com", { action: "overview" }); assert.equal(d.status, 403);

// the admin invites an editor: a row is added and the normal sign-in email is sent
d = await as(ADMIN, { action: "people" }); assert.deepEqual(d.people, []); assert.equal(d.sites.length, 6);
d = await as(ADMIN, { action: "invitePerson", email: " Sam@Example.org ", name: "Sam Taylor", sites: [site], back: "https://artiscope.github.io/artiscope-digital-home/" });
assert.equal(d.ok, true); assert.equal(d.emailed, true);
assert.deepEqual(mails.at(-1), { to: "sam@example.org", back: "https://artiscope.github.io/artiscope-digital-home/" });
assert.equal(table.length, 1); assert.match(table[0].id, /^[a-f0-9]{10}$/); assert.ok(dbKeys.every((k) => k === "Bearer service-key"), "the table is only reached with the server's own key");
assert.equal((await as(ADMIN, { action: "invitePerson", email: "sam@example.org", sites: [] })).status, 409, "no one is added twice");
assert.equal((await as(ADMIN, { action: "invitePerson", email: "not an address", sites: [] })).status, 400);
assert.equal((await as(ADMIN, { action: "invitePerson", email: ADMIN, sites: [] })).status, 400, "the admin cannot be added as an editor");
const SAM = "sam@example.org", tag = table[0].id, mine = ownCopyId(tag);

// an editor cannot manage people
assert.equal((await as(SAM, { action: "people" })).status, 403);
assert.equal((await as(SAM, { action: "invitePerson", email: "friend@x.com", sites: [site] })).status, 403);

// an editor sees only their own sites, and none of the weekday agent's drafts or topics
d = await as(SAM, { action: "overview" });
assert.equal(d.status, 200); assert.equal(d.user.admin, false); assert.deepEqual(d.sites.map((s) => s.id), [site]);
assert.deepEqual(d.sites[0].drafts, []); assert.ok(table[0].last_seen, "last signed in is noted");
assert.equal((await as(SAM, { action: "pages", site: "global-art-monitor" })).status, 403, "a site that is not theirs is refused");
assert.equal((await as(SAM, { action: "history", site })).status, 403, "the agent's drafts and history are the admin's");
assert.equal((await as(SAM, { action: "answerTopic", site, title: "x", answer: "yes" })).status, 403);

// an editor can read the live site, but never change it
d = await as(SAM, { action: "content", site }); assert.equal(d.status, 200);
const first = d.collections[0].entries[0];
d = await as(SAM, { action: "saveEntry", site, collection: "articles", id: first.id, values: { title: "Sneaky live edit" } });
assert.equal(d.status, 403); assert.notEqual(JSON.parse(hub.read(WR, "main", "content/site.json")).articles[0].title, "Sneaky live edit");
for (const action of ["undoStep", "redoStep", "publish", "savePages", "saveTheme", "uploadPhoto", "removePhoto", "deleteCopy", "refreshCopy"]) {
  assert.equal((await as(SAM, { action, site })).status, 403, action + " on the live site is refused");
}

// their own copy: made once, named by a private tag, never by their address
d = await as(SAM, { action: "makeCopy", site, name: "anything" }); assert.equal(d.copy, mine);
assert.equal((await as(SAM, { action: "makeCopy", site })).copy, mine, "asking again gives the same copy");
assert.ok(!mine.includes("sam") && !mine.includes("@"));
d = await as(SAM, { action: "saveEntry", site, copy: mine, collection: "articles", id: first.id, values: { title: "Sam's edit" } });
assert.equal(d.status, 200); assert.equal(JSON.parse(hub.read(WR, "adh/" + mine, "content/site.json")).articles[0].title, "Sam's edit");
assert.equal(hub.lastMessage(WR, "adh/" + mine), "Edit article: " + first.title + " (by " + tag + ")", "who made it is the tag, not the address");
d = await as(SAM, { action: "overview", copies: { [site]: mine } });
let c = d.sites[0].copies.find((x) => x.id === mine); assert.equal(c.name, "Your copy"); assert.equal(c.mine, true); assert.equal(c.steps[0].by, "You");
assert.equal((await as(SAM, { action: "deleteCopy", site, copy: mine })).status, 403, "only the admin deletes an editor's copy");

// the admin sees the editor's copy by their name, and the editor cannot see the admin's own trial copies
d = await as(ADMIN, { action: "makeCopy", site, name: "Winter look" }); const winter = d.copy;
d = await as(ADMIN, { action: "overview", copies: { [site]: mine } });
c = d.sites[0].copies.find((x) => x.id === mine); assert.equal(c.name, "Sam Taylor"); assert.equal(c.steps[0].by, "Sam Taylor");
d = await as(SAM, { action: "overview" }); assert.ok(!d.sites[0].copies.some((x) => x.id === winter));
assert.equal((await as(SAM, { action: "saveEntry", site, copy: winter, collection: "articles", id: first.id, values: { title: "x" } })).status, 409, "another copy cannot even be found");

// an editor publishes their own copy; it goes live and their copy then matches live
d = await as(SAM, { action: "publish", site, copy: mine }); assert.equal(d.ok, true);
assert.equal(JSON.parse(hub.read(WR, "main", "content/site.json")).articles[0].title, "Sam's edit");
assert.equal(hub.lastMessage(WR, "main"), "Make live: An editor's copy (by " + tag + ")");
d = await as(SAM, { action: "overview", copies: { [site]: mine } }); assert.equal(d.sites[0].copies.find((x) => x.id === mine).ahead, 0);

// a second editor on the same site: their copy falls behind when Sam publishes, and can be brought up to date, keeping their own work
assert.equal((await as(ADMIN, { action: "invitePerson", email: "jo@example.org", name: "Jo Lee", sites: [site] })).ok, true);
const JO = "jo@example.org", joCopy = ownCopyId(ppl.table.find((p) => p.email === JO).id);
assert.equal((await as(JO, { action: "makeCopy", site })).copy, joCopy);
const second = (await as(JO, { action: "content", site, copy: joCopy })).collections[0].entries[1];
// Jo works on a different part from Sam (the stand-in for GitHub joins whole files, where GitHub joins lines)
hub.commitOn(WR, "adh/" + joCopy, "content/theme.json", '{"colours":{"brick":"#A1332A"}}', "Theme: links (by " + joCopy.slice(-10) + ")");
assert.equal((await as(SAM, { action: "saveEntry", site, copy: mine, collection: "articles", id: first.id, values: { title: "Sam again" } })).ok, true);
assert.equal((await as(SAM, { action: "publish", site, copy: mine })).ok, true);
d = await as(JO, { action: "overview", copies: { [site]: joCopy } }); c = d.sites[0].copies.find((x) => x.id === joCopy);
assert.ok(c.behind > 0 && c.ahead > 0, "Jo's copy should be behind the live site, with Jo's work still on it");
assert.ok(!d.sites[0].copies.some((x) => x.id === mine), "Jo cannot see Sam's copy");
{ const rr = await as(JO, { action: "refreshCopy", site, copy: joCopy }); assert.equal(rr.ok, true, JSON.stringify(rr)); }
const joNow = JSON.parse(hub.read(WR, "adh/" + joCopy, "content/site.json")).articles;
assert.equal(joNow[0].title, "Sam again", "Sam's published work came in"); assert.ok(hub.read(WR, "adh/" + joCopy, "content/theme.json").includes("#A1332A"), "Jo's own work is kept");
// when both changed the very same part, Jo is told plainly, and can start again from the live site
assert.equal((await as(JO, { action: "saveEntry", site, copy: joCopy, collection: "articles", id: second.id, values: { title: "Jo's edit" } })).ok, true);
assert.equal((await as(SAM, { action: "saveEntry", site, copy: mine, collection: "articles", id: first.id, values: { title: "Sam a third time" } })).ok, true);
assert.equal((await as(SAM, { action: "publish", site, copy: mine })).ok, true);
d = await as(JO, { action: "refreshCopy", site, copy: joCopy }); assert.equal(d.status, 409); assert.equal(d.clash, true);
assert.equal((await as(JO, { action: "refreshCopy", site, copy: joCopy, fresh: true })).ok, true);
d = await as(JO, { action: "overview", copies: { [site]: joCopy } }); c = d.sites[0].copies.find((x) => x.id === joCopy);
assert.equal(c.ahead + c.behind, 0, "Jo's copy is now exactly the live site");
assert.equal((await as(JO, { action: "publish", site, copy: mine })).status, 409, "Jo cannot even find Sam's copy, let alone publish it");

// the admin changes their sites, and it works from their next click
assert.equal((await as(ADMIN, { action: "updatePerson", email: SAM, name: "Sam Taylor", sites: ["global-art-monitor"] })).ok, true);
assert.equal((await as(SAM, { action: "content", site })).status, 403);
d = await as(SAM, { action: "overview" }); assert.deepEqual(d.sites.map((s) => s.id), ["global-art-monitor"]);
assert.equal((await as(ADMIN, { action: "resendInvite", email: SAM })).emailed, true); assert.equal(mails.length, 3);

// removing someone: they are turned away at once, and what they saved stays
assert.equal((await as(ADMIN, { action: "removePerson", email: SAM })).ok, true);
assert.equal((await as(SAM, { action: "overview" })).status, 403);
assert.equal(JSON.parse(hub.read(WR, "main", "content/site.json")).articles[0].title, "Sam a third time", "what they published stays");

// with no database key, the admin still works and editors are simply not there
key = ""; d = await as(ADMIN, { action: "overview" }); assert.equal(d.status, 200); assert.equal(d.sites.length, 6);
assert.equal((await as(ADMIN, { action: "people" })).status, 500);
console.log("PEOPLE CHECKS PASSED");
