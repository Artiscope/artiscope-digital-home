import fs from "node:fs";
import assert from "node:assert/strict";
import { parseCalendar, setAnswer, parseLog, safePhotoName, parseSlots, slotPhotoName, notePhotoName, cleanText, handle } from "./home.mjs";

const empty = fs.readFileSync("/home/claude/global-art-monitor/CONTENT-CALENDAR.md", "utf8");
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

const log = fs.readFileSync("/home/claude/world-art-review/AGENT-LOG.md", "utf8");
const l = parseLog(log);
assert.ok(/\d{4}/.test(l[0].date));
assert.ok(l[0].lines.length >= 3);

assert.equal(safePhotoName("zara-muse", "In Her Own Light!", "JPEG"), "zara-muse-in-her-own-light.jpg");
assert.equal(safePhotoName("zara-muse", "../../etc", "png"), "zara-muse-etc.png");
assert.equal(safePhotoName("zara-muse", "x", "exe"), null);
assert.equal(safePhotoName("zara-muse", "", "jpg"), null);

const war = parseSlots(fs.readFileSync("/home/claude/world-art-review/image-slots.json", "utf8"));
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
console.log("ALL TESTS PASSED");
