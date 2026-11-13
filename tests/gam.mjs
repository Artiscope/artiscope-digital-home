import { W_DIR, G_DIR, C_DIR, FIX, chromeOptions } from "./where.mjs";
// Global Art Monitor in the page editor: its data as one object, saved back into its three files.
import fs from "node:fs"; import assert from "node:assert/strict"; import { createRequire } from "node:module";
globalThis.Deno = { env: { get: (k) => ({ GITHUB_TOKEN: "t", ALLOWED_EMAILS: "me@x.com", SUPABASE_URL: "https://s" }[k] || "") }, serve() {} };
const { handle, SITES, gamForEditor, gamFromEditor, cleanPages, canon } = await import("./home.mjs");
const { makeGitHub } = await import("./fakegit.mjs");
const G = (G_DIR + "/");
const GAMR = createRequire(import.meta.url)(G + "assets/render.js");
const read = (p) => JSON.parse(fs.readFileSync(G + p, "utf8"));
const content = read("data/content.json"), sales = read("data/sales.json"), images = read("data/images.json"), pages = read("data/pages.json");
const imageFiles = fs.readdirSync(G + "assets/images");
const S = SITES[1];
const clone = (x) => JSON.parse(JSON.stringify(x));

// the editor's object and the site's own drawing agree
const E = gamForEditor(content, sales, images, imageFiles);
assert.equal(E.artists.length, 2); assert.equal(E.artists[0].sales[0]._i, 0); assert.equal(E.artists[0].image, "zara-muse.jpg");
const fromSite = GAMR.fromFiles(content, sales, images, imageFiles);
const drawn = (data, pg) => GAMR.Site(data, pg, "").all().map((x) => x.html).join("\n");
assert.equal(drawn(E, pages), drawn(fromSite, pages), "the editor's data draws the same pages as the files");
// pages cleaned by the server draw exactly as before, so a first save changes nothing else
const ctx = { ...S, artists: E.artists.map((a) => ({ slug: a.slug })), articleSlugs: E.articles.map((a) => a.slug) };
const cleanedPages = cleanPages(ctx, pages, pages);
assert.equal(drawn(fromSite, cleanedPages), drawn(fromSite, pages), "cleaning the page list changes nothing on the pages");
assert.deepEqual(cleanedPages.pages["auction-results"].sections.find((x) => x.type === "features").settings.which, pages.pages["auction-results"].sections.find((x) => x.type === "features").settings.which);
// nothing edited: nothing changes, down to the last character
let r = gamFromEditor(S.items, clone(E), content, sales, images, imageFiles);
assert.deepEqual(r.changed, []); assert.equal(canon(r.content), canon(content)); assert.equal(canon(r.sales), canon(sales)); assert.equal(canon(r.images), canon(images));

// a figure not known stays empty, and the page says To confirm
let e = clone(E); e.artists[0].sales[1].hammer = ""; e.artists[0].sales[1].premium = null;
r = gamFromEditor(S.items, e, content, sales, images, imageFiles);
assert.deepEqual(r.changed, ["Edit profile: Zara Muse"]);
assert.equal(r.sales.sales[1].hammer, null); assert.equal(r.sales.sales[1].premium, null);
assert.equal(canon(r.sales.sales[0]), canon(sales.sales[0]), "other sales keep their exact form");
const page = GAMR.Site(gamForEditor(r.content, r.sales, r.images, imageFiles), pages, "").artistPage("zara-muse").html;
assert.ok(page.includes('<span class="tbc">To confirm</span>'));
// a new sale needs its source and a proper date; estimates the right way round
e = clone(E); e.artists[1].sales.push({ title: "New work", year: "2026", date: "2026-10-01", date_text: "1 October 2026", house: "Tate Ward", sale: "Online", lot: "12", medium: "Print", currency: "GBP", est_low: 500, est_high: 700, hammer: 900, hammer_basis: "published", premium: 1125, source_label: "", source_url: "" });
assert.throws(() => gamFromEditor(S.items, e, content, sales, images, imageFiles), /needs a source/);
e.artists[1].sales.at(-1).source_label = "Tate Ward lot page"; e.artists[1].sales.at(-1).source_url = "https://www.tateward.com/lot/12";
r = gamFromEditor(S.items, e, content, sales, images, imageFiles);
assert.equal(r.sales.sales.length, sales.sales.length + 1); assert.equal(r.sales.sales.at(-1).artist, "konn-artiss"); assert.equal(r.sales.sales.at(-1).hammer, 900); assert.ok(!("_i" in r.sales.sales.at(-1)));
e.artists[1].sales.at(-1).date = "1 Oct 2026"; assert.throws(() => gamFromEditor(S.items, e, content, sales, images, imageFiles), /year-month-day/);
e.artists[1].sales.at(-1).date = "2026-10-01"; e.artists[1].sales.at(-1).est_low = 900; assert.throws(() => gamFromEditor(S.items, e, content, sales, images, imageFiles), /low estimate/);
// moving and removing sales
e = clone(E); e.artists[0].sales.reverse(); e.artists[0].sales.pop();
r = gamFromEditor(S.items, e, content, sales, images, imageFiles);
assert.equal(r.sales.sales.filter((x) => x.artist === "zara-muse").length, E.artists[0].sales.length - 1);
assert.equal(canon(r.sales.sales[0]), canon(sales.sales[E.artists[0].sales.length - 1]));
// an artist goes only once their sales have gone
e = clone(E); e.artists.pop(); assert.throws(() => gamFromEditor(S.items, e, content, sales, images, imageFiles), /Remove the sales/);
{ const s0 = clone(sales); s0.sales = s0.sales.filter((x) => x.artist !== "konn-artiss"); const e0 = gamForEditor(content, s0, images, imageFiles); e0.artists.pop();
  const r0 = gamFromEditor(S.items, e0, content, s0, images, imageFiles); assert.deepEqual(r0.changed, ["Delete artist: Konn Artiss"]); assert.ok(!r0.sales.artists["konn-artiss"] && !r0.content.bios["konn-artiss"] && !r0.images["konn-artiss"]); }
// the publisher disclosure must stay; the list of sections is fixed
e = clone(E); e.site.disclosure = " "; assert.throws(() => gamFromEditor(S.items, e, content, sales, images, imageFiles), /publishes the site/);
e = clone(E); e.sections.pop(); assert.throws(() => gamFromEditor(S.items, e, content, sales, images, imageFiles), /fixed/);
e = clone(E); e.sections[0][1] = "Market notes"; e.glossary.push(["Reserve", "The lowest price the seller will accept."]);
r = gamFromEditor(S.items, e, content, sales, images, imageFiles);
assert.deepEqual(r.changed, ["Edit site details"]); assert.equal(r.content.sections[0][0], content.sections[0][0]); assert.equal(r.content.sections[0][1], "Market notes"); assert.equal(r.content.glossary.length, content.glossary.length + 1);
// articles: a new one starts hidden; an artist's picture can be any file in assets/images
e = clone(E); e.articles.push({ slug: "a-new-study", title: "A new study" }); e.artists[1].image = "zara-muse.jpg"; e.artists[1].alt = "A test";
r = gamFromEditor(S.items, e, content, sales, images, imageFiles);
assert.deepEqual(r.changed, ["Add article: A new study", "Edit profile: Konn Artiss"]);
assert.equal(r.content.features.at(-1).hidden, true); assert.equal(r.images["konn-artiss"].file, "zara-muse.jpg");
assert.equal(gamForEditor(r.content, r.sales, r.images, imageFiles).artists[1].image, "zara-muse.jpg");
e = clone(E); e.artists[0].image = ""; r = gamFromEditor(S.items, e, content, sales, images, imageFiles);
assert.equal(gamForEditor(r.content, r.sales, r.images, imageFiles).artists[0].image, "", "a picture can be taken away");
// new pages get their own address
const withPage = clone(cleanedPages); withPage.pages.press = { title: "Press | Global Art Monitor", description: "For the press.", sections: [{ id: "head", type: "page-head", settings: { eyebrow: "Press", headline: "For the press", lede: "", wide: true } }] };
const np = cleanPages(ctx, withPage, pages).pages.press; assert.deepEqual([np.path, np.current, np.intro, np.description], ["press/index.html", "", false, "For the press."]);
withPage.pages.press.sections.push({ id: "r", type: "results-table", settings: {} }, { id: "r2", type: "results-table", settings: {} }, { id: "c", type: "contact-form", settings: {} }); assert.deepEqual(cleanPages(ctx, withPage, pages).pages.press.sections.map((x) => x.type), ["page-head", "results-table", "results-table", "contact-form"], "any section, any number of times, on a new page");
withPage.pages.press.sections.splice(1);
withPage.pages.assets = { title: "x", sections: [] }; assert.throws(() => cleanPages(ctx, withPage, pages), /web address/);

// through the handler, as one step that one Undo takes back
const GR = "Artiscope/global-art-monitor";
const seed = { "data/content.json": JSON.stringify(content), "data/sales.json": JSON.stringify(sales), "data/images.json": JSON.stringify(images), "data/pages.json": JSON.stringify(pages), "assets/images/zara-muse.jpg": "z", "assets/images/konn-artiss.jpg": "k" };
const hub = makeGitHub({ [GR]: seed });
globalThis.fetch = async (url, init = {}) => String(url).includes("/auth/v1/user") ? new Response(JSON.stringify({ email: "me@x.com" })) : hub.fetch(url, init);
const post = (b) => new Request("https://x/functions/v1/home", { method: "POST", headers: { Authorization: "Bearer a" }, body: JSON.stringify(b) });
const call = async (b) => { const res = await handle(post({ site: "global-art-monitor", ...b })); return { status: res.status, ...(await res.json()) }; };
const file = (p) => JSON.parse(hub.read(GR, "main", p));
{
  const pg = await call({ action: "pages" });
  assert.equal(pg.status, 200); assert.equal(pg.gam, true); assert.ok(pg.itemKinds.artist.parts.some((p) => p.id === "sales")); assert.equal(pg.imageBase, "https://globalartmonitor.com/assets/images/");
  assert.equal(pg.site.artists[0].image, "zara-muse.jpg"); assert.equal(pg.pageFields.length, 2);
  assert.ok(pg.kinds.hero.fields.length && pg.kinds.features.fields.some((f) => f.type === "which"));
  assert.equal((await call({ action: "savePages", pages: pg.pages, content: pg.site })).unchanged, true, "opening and saving changes nothing");
  // a sale with a new photo of the work, and a new page, in one step
  const c = clone(pg.site), doc = clone(pg.pages);
  c.artists[0].sales[0].hammer = 27500; c.artists[0].image = "upload:1"; c.artists[0].alt = "A new photo";
  doc.pages.press = { title: "Press | Global Art Monitor", description: "", sections: [{ id: "head", type: "page-head", visible: true, settings: { eyebrow: "Press", headline: "For the press", lede: "", wide: true } }] };
  let res = await call({ action: "savePages", pages: doc, content: c, what: "New page and a sale", uploads: [{ key: "upload:1", name: "Zara studio.jpg", ext: "jpg", content: "c3R1ZGlv" }] });
  if (res.status !== 200) console.log(res);
  assert.equal(res.status, 200);
  assert.equal(file("data/sales.json").sales[0].hammer, 27500); assert.equal(file("data/images.json")["zara-muse"].file, "zara-studio.jpg");
  assert.equal(hub.read(GR, "main", "assets/images/zara-studio.jpg"), "studio"); assert.equal(file("data/pages.json").pages.press.path, "press/index.html");
  assert.equal(file("data/files.json").files["zara-studio.jpg"].alt, "A new photo");
  // only the content changed: the step names it
  const c2 = clone((await call({ action: "pages" })).site); c2.artists[1].line = "Anonymous. Public interventions.";
  res = await call({ action: "savePages", pages: file("data/pages.json"), content: c2 }); assert.equal(res.status, 200);
  assert.match(hub.lastMessage(GR, "main"), /^Edit profile: Konn Artiss/);
  // refused content saves nothing
  const c3 = clone(c2); c3.artists[1].sales[0].source_url = "";
  assert.equal((await call({ action: "savePages", pages: file("data/pages.json"), content: c3 })).status, 400);
  // Files knows the artists' pictures
  const f = await call({ action: "files" });
  assert.equal(f.status, 200); assert.deepEqual(f.files.find((x) => x.name === "zara-studio.jpg").used.map((u) => u.label), ["Artist: Zara Muse"]);
  res = await call({ action: "saveFiles", op: "assign", name: "konn-artiss.jpg", spot: "artist:konn-artiss", alt: "Konn Artiss's work" });
  assert.equal(res.ok, true); assert.deepEqual(file("data/images.json")["konn-artiss"], { ...images["konn-artiss"], alt: "Konn Artiss's work", file: "konn-artiss.jpg" });
  // undo, step by step
  assert.equal((await call({ action: "undoStep" })).ok, true); assert.equal((await call({ action: "undoStep" })).ok, true); assert.equal((await call({ action: "undoStep" })).ok, true);
  assert.equal(file("data/sales.json").sales[0].hammer, sales.sales[0].hammer); assert.ok(!file("data/pages.json").pages.press);
}
console.log("GLOBAL ART MONITOR CHECKS PASSED");
