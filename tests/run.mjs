import { W_DIR, G_DIR, C_DIR, FIX, chromeOptions } from "./where.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
import { parseCalendar, setAnswer, parseLog, safePhotoName, parseSlots, slotPhotoName, notePhotoName, cleanText, handle, SITES, cleanPages } from "./home.mjs";

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
console.log("ALL TESTS PASSED");
