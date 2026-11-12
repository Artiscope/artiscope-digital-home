// Articles, portfolios, sources, list headings and new pages, saved from the page editor.
import fs from "node:fs"; import assert from "node:assert/strict";
globalThis.Deno = { env: { get: (k) => ({ GITHUB_TOKEN: "t", ALLOWED_EMAILS: "me@x.com", SUPABASE_URL: "https://s" }[k] || "") }, serve() {} };
const { handle, cleanSite, cleanPages, SITES, slugFrom, siteForEditor, canon } = await import("./home.mjs");
const { makeGitHub } = await import("./fakegit.mjs");
const WAR = "/home/claude/world-art-review/";
const war = JSON.parse(fs.readFileSync(WAR + "content/site.json", "utf8"));
const pagesSeed = fs.readFileSync(WAR + "content/pages.json", "utf8");
const W = SITES[0];

// the pure parts
{
  assert.equal(slugFrom("Ecos de Azul: a review!"), "ecos-de-azul-a-review"); assert.equal(slugFrom("Café"), "cafe");
  // sending the content back unchanged changes nothing
  const ed = siteForEditor(war);
  assert.equal(ed.artists[0].works[0].alt, ""); assert.ok(!("image" in war.artists[0].works[0]) || war.artists[0].works[0].image !== undefined);
  let r = cleanSite(W.items, ed, war); assert.deepEqual(r.changed, []); assert.equal(canon(r.data), canon(war));
  // a few real edits
  const g = siteForEditor(war), zara = g.artists[0];
  zara.timeline.push({ when: "", what: "Joins Grove Gallery.", reported: true, src: ["grove-zm", "nope"] });
  zara.works[10 % zara.works.length].size = "none";
  zara.works[0].image = "malala.jpg"; zara.works[0].alt = "A portrait of Malala";
  zara.related = ["a-palette-knife-painting", "a-gone"];
  g.sources["new-src"] = { title: "A new review", pub: "The Paper", date: "2026", kind: "Independent news report", url: "https://example.com/a" };
  g.articles.find((a) => a.slug === "palette-knife-painting").sources.push("new-src");
  g.articles.push({ slug: "a-fresh-piece", title: "A fresh piece", section: "reviews" });
  r = cleanSite(W.items, g, war);
  assert.deepEqual(r.changed, ["Add source: A new review", "Edit portfolio: Zara Muse", "Edit article: Understanding palette-knife painting", "Add article: A fresh piece"]);
  const z = r.data.artists[0];
  assert.deepEqual(z.timeline.at(-1), { when: null, what: "Joins Grove Gallery.", reported: true, src: ["grove-zm"] });
  assert.equal(z.works[0].image, "images/malala.jpg"); assert.equal(z.works[0].tone, war.artists[0].works[0].tone, "an artwork keeps its colour");
  assert.equal(z.works[10 % z.works.length].size, false);
  assert.deepEqual(z.related, ["a-palette-knife-painting"]);
  assert.equal(r.data.artists[1], war.artists[1] === undefined ? undefined : r.data.artists[1]); assert.equal(canon(r.data.artists[1]), canon(war.artists[1]), "untouched artists stay exactly as they were");
  const fresh = r.data.articles.at(-1); assert.equal(fresh.hidden, true); assert.equal(fresh.section, "reviews"); assert.equal(fresh.status, "Draft for review");
  // refusals
  const bad2 = siteForEditor(war); bad2.articles.push({ slug: "Bad Slug", title: "x" }); assert.throws(() => cleanSite(W.items, bad2, war), /web address/);
  const bad3 = siteForEditor(war); bad3.sources["x-1"] = { title: "x", url: "javascript:alert(1)" }; assert.throws(() => cleanSite(W.items, bad3, war), /https/);
  const bad4 = siteForEditor(war); bad4.articles[0].title = " "; assert.throws(() => cleanSite(W.items, bad4, war), /title/);
  // a source can be deleted only when nothing cites it; an artist only when no article names them
  const ds = siteForEditor(war); delete ds.sources["ap-muse"]; assert.throws(() => cleanSite(W.items, ds, war), /still cited/);
  const unused = Object.keys(war.sources).find((id) => !JSON.stringify({ a: war.artists, b: war.articles }).includes('"' + id + '"') && !JSON.stringify(war.articles).includes('\\"' + id + '\\"'));
  if (unused) { const d2 = siteForEditor(war); delete d2.sources[unused]; const rr = cleanSite(W.items, d2, war); assert.ok(!(unused in rr.data.sources)); assert.match(rr.changed[0], /^Delete source/); }
  const da = siteForEditor(war); da.artists = da.artists.filter((a) => a.slug !== "zara-muse"); assert.throws(() => cleanSite(W.items, da, war), /named in the article/);
  const dz = siteForEditor(war); dz.artists = dz.artists.filter((a) => a.slug !== "zen-xander"); assert.deepEqual(cleanSite(W.items, dz, war).changed, ["Delete artist: Zen Xander"]);
  // deleting an article
  const del = siteForEditor(war); del.articles = del.articles.filter((a) => a.slug !== "glossary-of-paint");
  assert.match(cleanSite(W.items, del, war).changed[0], /^Delete article: A short glossary/);
  // pages: list headings start from the site's own words; new pages take library sections only
  const cur = JSON.parse(pagesSeed), clean = cleanPages(W, cur, cur);
  assert.deepEqual(clean.lists.reviews.heading, ["Recent reviews", "and comparisons"]);
  const withPage = JSON.parse(JSON.stringify(clean));
  withPage.pages.visit = { title: "Visit us", sections: [{ id: "text-1", type: "text", settings: { heading: ["Find us"], body: "<p>Hi</p>" } }] };
  assert.equal(cleanPages(W, withPage, cur).pages.visit.title, "Visit us");
  withPage.pages.visit.sections.push({ id: "hero2", type: "hero", settings: {} }); assert.throws(() => cleanPages(W, withPage, cur), /cannot go on a new page/);
  withPage.pages.visit.sections.pop(); withPage.pages.reviews = { title: "x", sections: [] }; assert.throws(() => cleanPages(W, withPage, cur), /web address/);
  delete withPage.pages.reviews; delete withPage.pages.home; assert.ok(cleanPages(W, withPage, cur).pages.home, "the home page cannot be removed");
}

// through the handler, as one step that one Undo takes back
const WR = "Artiscope/World-art-review";
const hub = makeGitHub({ [WR]: { "content/site.json": JSON.stringify(war), "content/pages.json": pagesSeed, "image-slots.json": fs.readFileSync(WAR + "image-slots.json", "utf8"), "images/zara-muse-portrait.jpg": "zara" } });
globalThis.fetch = async (url, init = {}) => String(url).includes("/auth/v1/user") ? new Response(JSON.stringify({ email: "me@x.com" })) : hub.fetch(url, init);
const post = (b) => new Request("https://x/functions/v1/home", { method: "POST", headers: { Authorization: "Bearer a" }, body: JSON.stringify(b) });
const call = async (b) => { const r = await handle(post({ site: "world-art-review", ...b })); return { status: r.status, ...(await r.json()) }; };
const read = (f) => JSON.parse(hub.read(WR, "main", f));
{
  const pg = await call({ action: "pages" });
  assert.equal(pg.status, 200); assert.ok(pg.itemKinds.article.parts.some((p) => p.picture)); assert.equal(pg.lists.reviews.section, "reviews");
  assert.equal(pg.site.articles.length, war.articles.length); assert.ok(pg.pages.lists.artists.intro.startsWith("Each portfolio"));
  // a new article with its picture uploaded, a new page in the menu, a new list heading: one Save
  const doc = JSON.parse(JSON.stringify(pg.pages)), content = JSON.parse(JSON.stringify(pg.site));
  content.articles.push({ slug: "studio-visit", title: "A studio visit", section: "library", body: "<p>Words.</p>" });
  content.artists[2].works = [{ title: "First work", image: "upload:1", alt: "A first work", year: "", medium: "Oil", size: "", note: "", src: [] }];
  doc.pages.visit = { title: "Visit us", sections: [{ id: "text-1", type: "text", visible: true, settings: { heading: ["Find us"], body: "<p>Hi</p>" } }] };
  doc.shared.header.settings.links.push(["Visit us", "#page-visit"]);
  doc.lists.library.intro = "Guides for collectors.";
  let r = await call({ action: "savePages", pages: doc, content, what: "New article and page", pictures: { "article:studio-visit": { image: "zara-muse-portrait.jpg", alt: "The studio", credit: "" } }, uploads: [{ key: "upload:1", name: "work.jpg", ext: "jpg", content: "d29yaw==" }] });
  if (r.status !== 200) console.log(r);
  assert.equal(r.status, 200);
  const s = read("content/site.json"), p = read("content/pages.json"), slots = read("image-slots.json");
  const a = s.articles.find((x) => x.slug === "studio-visit"); assert.equal(a.hidden, true); assert.equal(a.image, "images/zara-muse-portrait.jpg"); assert.equal(a.alt, "The studio");
  assert.equal(s.artists[2].works[0].image, "images/work.jpg"); assert.equal(hub.read(WR, "main", "images/work.jpg"), "work");
  assert.equal(p.pages.visit.title, "Visit us"); assert.deepEqual(p.shared.header.settings.links.at(-1), ["Visit us", "#page-visit"]); assert.equal(p.lists.library.intro, "Guides for collectors.");
  assert.ok(slots.slots.some((x) => x.id === "article-studio-visit" && x.filled), "the new article has a picture spot for the agents");
  assert.ok(slots.slots.some((x) => x.id === "work-zen-xander-first-work"));
  assert.match(hub.lastMessage(WR, "main"), /^Edit page: New article and page/);
  // only an article changed: the step says so
  const c2 = JSON.parse(JSON.stringify(siteForEditor(s))); c2.articles.find((x) => x.slug === "studio-visit").hidden = false;
  r = await call({ action: "savePages", pages: p, content: c2 }); assert.equal(r.status, 200);
  assert.match(hub.lastMessage(WR, "main"), /^Show article: A studio visit/);
  assert.ok(!("hidden" in read("content/site.json").articles.find((x) => x.slug === "studio-visit")) || read("content/site.json").articles.find((x) => x.slug === "studio-visit").hidden === false);
  // nothing changed: nothing saved
  assert.equal((await call({ action: "savePages", pages: p, content: siteForEditor(read("content/site.json")) })).unchanged, true);
  // refused content is not saved at all
  const c3 = siteForEditor(read("content/site.json")); c3.artists.shift();
  assert.equal((await call({ action: "savePages", pages: p, content: c3 })).status, 400);
  // undo takes the last step back, then the first
  assert.equal((await call({ action: "undoStep" })).ok, true); assert.equal(read("content/site.json").articles.find((x) => x.slug === "studio-visit").hidden, true);
  assert.equal((await call({ action: "undoStep" })).ok, true);
  assert.ok(!read("content/site.json").articles.some((x) => x.slug === "studio-visit")); assert.ok(!read("content/pages.json").pages.visit);
}
console.log("ITEM CHECKS PASSED");
