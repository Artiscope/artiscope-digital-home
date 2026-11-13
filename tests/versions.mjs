// Versions: every publish is a numbered version with release notes, kept as a GitHub release.
import { W_DIR } from "./where.mjs";
import fs from "node:fs"; import assert from "node:assert/strict";
import { handle, ownCopyId, versionOf, nextVersion, releaseNotes } from "./home.mjs";

const ADMIN = "boss@x.com";
globalThis.Deno = { env: { get: (k) => ({ GITHUB_TOKEN: "t", ALLOWED_EMAILS: ADMIN, SUPABASE_URL: "https://s", SUPABASE_SERVICE_ROLE_KEY: "k" }[k] || "") }, serve() {} };
const { makeGitHub } = await import("./fakegit.mjs"); const { makePeople } = await import("./fakepeople.mjs");
const WR = "Artiscope/World-art-review";
const hub = makeGitHub({ [WR]: { "content/site.json": fs.readFileSync(W_DIR + "/content/site.json", "utf8"), "content/pages.json": fs.readFileSync(W_DIR + "/content/pages.json", "utf8"), "content/theme.json": "{}" } });
const ppl = makePeople(); let signedIn = ADMIN;
globalThis.fetch = async (url, init = {}) => {
  if (String(url).includes("/auth/v1/user")) return new Response(JSON.stringify({ email: signedIn }));
  if (ppl.handles(url)) return ppl.fetch(url, init);
  return hub.fetch(url, init);
};
const as = async (who, b) => { signedIn = who; const r = await handle(new Request("https://x", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify(b) })); const d = await r.json(); d.status = r.status; return d; };
const site = "world-art-review", tags = () => hub.releases(WR).map((x) => x.tag_name), title = (ref) => JSON.parse(hub.read(WR, ref, "content/site.json")).articles[0].title;

// the numbers
assert.deepEqual(versionOf("v2.10"), [2, 10]); assert.equal(versionOf("2.1"), null); assert.equal(versionOf("v1.2.3"), null);
assert.deepEqual(nextVersion([], false), [1, 0]);
assert.deepEqual(nextVersion([[1, 0], [1, 9]], false), [1, 10], "2.9 is followed by 2.10, not 3.0");
assert.deepEqual(nextVersion([[1, 9], [1, 3]], true), [2, 0]);
assert.ok(!releaseNotes({ who: "Sam", tag: "abc", steps: ["Edit — page"] }).includes("—"), "no long dashes in the notes");

// an editor's first publish: 1.0 marks where versions began, the publish is 1.1
await as(ADMIN, { action: "invitePerson", email: "sam@example.org", name: "Sam Taylor", sites: [site] });
const SAM = "sam@example.org", tag = ppl.table[0].id, mine = ownCopyId(tag);
const startSha = hub.refs(WR).main;
await as(SAM, { action: "makeCopy", site });
const first = (await as(SAM, { action: "content", site, copy: mine })).collections[0].entries[0];
await as(SAM, { action: "saveEntry", site, copy: mine, collection: "articles", id: first.id, values: { title: "Version one point one" } });
let d = await as(SAM, { action: "publish", site, copy: mine, note: "Fixed the title — as asked.", big: true });
assert.equal(d.ok, true); assert.equal(d.version, "1.1", "an editor cannot mark a big change");
assert.deepEqual(tags(), ["v1.1", "v1.0"]);
let rel = hub.releases(WR);
assert.equal(rel[1].target_commitish, startSha, "1.0 is the site as it was before");
assert.equal(rel[0].target_commitish, hub.refs(WR).main);
assert.equal(rel[0].name, "World Art Review 1.1");
assert.ok(rel[0].body.startsWith("Published by Sam on "), rel[0].body);
assert.ok(rel[0].body.includes("- Edit article: " + first.title));
assert.ok(rel[0].body.includes("Sam's note: Fixed the title, as asked."));
assert.ok(!rel[0].body.includes("@") && !rel[0].body.includes("Taylor"), "the public notes carry a first name only");

// the admin's own saves on the live site are listed in the next version's notes
await as(ADMIN, { action: "saveEntry", site, collection: "articles", id: first.id, values: { title: "Admin live fix" } });
hub.commitOn(WR, "adh/" + mine, "content/theme.json", '{"colours":{}}', "Theme: links (by " + tag + ")");   // a different file: the stand-in joins whole files
d = await as(SAM, { action: "publish", site, copy: mine }); assert.equal(d.version, "1.2");
rel = hub.releases(WR); assert.ok(rel[0].body.includes("Also on the live site since the last version:\n- Edit article: Version one point one"), rel[0].body);

// the admin marks a big change: a new first number
d = await as(ADMIN, { action: "makeCopy", site, name: "New look" }); const look = d.copy;
await as(ADMIN, { action: "saveEntry", site, copy: look, collection: "articles", id: first.id, values: { title: "The new look" } });
d = await as(ADMIN, { action: "publish", site, copy: look, big: true }); assert.equal(d.version, "2.0");
assert.ok(hub.releases(WR)[0].body.startsWith("Published by the admin on "));

// a website agent's draft, published by the admin, is a version too
const sha = hub.refs(WR).main;
await hub.fetch("https://api.github.com/repos/" + WR + "/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/draft/2026-11-13-typo", sha }) });
hub.commitOn(WR, "draft/2026-11-13-typo", "content/theme.json", '{"x":1}', "Fix a typo");
hub.addPull(WR, 7, "draft/2026-11-13-typo", "Fix a typo on the home page");
d = await as(ADMIN, { action: "publishDraft", site, number: 7 }); assert.equal(d.ok, true); assert.equal(d.version, "2.1");
assert.ok(hub.releases(WR)[0].body.includes("- Website agent's draft: Fix a typo on the home page"));

// the list, for anyone who works on the site; only the admin may go back
d = await as(SAM, { action: "versions", site });
assert.deepEqual(d.versions.map((v) => v.number), ["2.1", "2.0", "1.2", "1.1", "1.0"]);
assert.equal(d.canGoBack, false); assert.equal(d.versions[0].live, true); assert.equal(d.versions[2].by, "You"); assert.equal(d.versions[1].big, true);
assert.ok(!d.versions[0].notes.includes("<!--"), "the hidden marker is not shown");
assert.equal((await as(SAM, { action: "restoreVersion", site, version: "1.1" })).status, 403);
d = await as(ADMIN, { action: "versions", site }); assert.equal(d.canGoBack, true); assert.equal(d.versions[2].by, "Sam Taylor");
assert.equal((await as(ADMIN, { action: "restoreVersion", site, version: "2.1" })).status, 409, "the live version is already live");
assert.equal((await as(ADMIN, { action: "restoreVersion", site, version: "9.9" })).status, 404);

// going back is itself a new version, so it can be undone
d = await as(ADMIN, { action: "restoreVersion", site, version: "1.1" }); assert.equal(d.ok, true); assert.equal(d.version, "2.2");
assert.equal(title("main"), "Version one point one", "the words are back as they were in 1.1");
assert.ok(hub.releases(WR)[0].name.endsWith(": back to 1.1"));
d = await as(ADMIN, { action: "restoreVersion", site, version: "2.1" }); assert.equal(d.version, "2.3"); assert.equal(title("main"), "The new look");

// the editor's copy can then be brought up to date
d = await as(SAM, { action: "overview", copies: { [site]: mine } }); assert.ok(d.sites[0].copies.find((c) => c.id === mine).behind > 0);
assert.equal((await as(SAM, { action: "refreshCopy", site, copy: mine })).ok, true); assert.equal(title("adh/" + mine), "The new look");
console.log("VERSION CHECKS PASSED");
