import fs from "node:fs"; import assert from "node:assert/strict";
import { SITES, entriesOf, fieldsOf, applyValues, handle } from "./home.mjs";
const war = JSON.parse(fs.readFileSync("/home/claude/world-art-review/content/site.json", "utf8"));
const gamC = JSON.parse(fs.readFileSync("/home/claude/global-art-monitor/data/content.json", "utf8"));
const gamS = JSON.parse(fs.readFileSync("/home/claude/global-art-monitor/data/sales.json", "utf8"));
const W = SITES[0].collections, G = SITES[1].collections;
const by = (cols, id) => cols.find((c) => c.id === id);
assert.equal(entriesOf(war, by(W, "articles")).length, 16);
assert.equal(entriesOf(war, by(W, "artists")).length, 3);
assert.equal(entriesOf(war, by(W, "artworks")).length, 12);
assert.equal(entriesOf(war, by(W, "sources")).length, 21);
assert.equal(entriesOf(gamC, by(G, "articles")).length, 6);
assert.equal(entriesOf(gamS, by(G, "sales")).length, 8);
assert.equal(entriesOf(gamC, by(G, "artists")).length, 2);
assert.equal(entriesOf(gamC, by(G, "site")).length, 1);
// fields: locked ones never appear; kinds are right
const art = entriesOf(war, by(W, "articles"))[0].ref;
const names = fieldsOf(art).map((f) => f.name);
assert.ok(!names.includes("slug") && !names.includes("tone") && names.includes("title") && names.includes("body"));
assert.equal(fieldsOf(art).find((f) => f.name === "body").type, "long");
const sale = JSON.parse(JSON.stringify(gamS.sales.find((x) => x.hammer === null) || gamS.sales[0]));
const sf = fieldsOf(sale, ["est_low", "est_high", "hammer", "premium"]);
assert.equal(sf.find((f) => f.name === "hammer").type, "number");
// applying values: only real fields, kept as their kind
const copy = JSON.parse(JSON.stringify(art));
let n = applyValues(copy, { title: "A new title", slug: "hacked", tone: "red", made_up: "x", minutes: "9" });
assert.equal(n, 2); assert.equal(copy.title, "A new title"); assert.equal(copy.slug, art.slug); assert.equal(copy.minutes, 9); assert.ok(!("made_up" in copy));
n = applyValues(sale, { hammer: "12500", premium: "" }, ["est_low", "est_high", "hammer", "premium"]);
assert.equal(sale.hammer, 12500); assert.equal(sale.premium, null);
assert.throws(() => applyValues(sale, { hammer: "lots" }, ["hammer"]));
const bio = JSON.parse(JSON.stringify(gamC.bios["zara-muse"]));
applyValues(bio, { body: "First paragraph.\n\nSecond paragraph." });
assert.deepEqual(bio.body, ["First paragraph.", "Second paragraph."]);

// the handler, with GitHub mocked
globalThis.Deno = { env: { get: (k) => ({ GITHUB_TOKEN: "t", ALLOWED_EMAILS: "me@x.com", SUPABASE_URL: "https://s" }[k] || "") }, serve() {} };
const store = { "content/site.json": JSON.stringify(war), "image-slots.json": fs.readFileSync("/home/claude/world-art-review/image-slots.json", "utf8") };
const writes = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ email: "me@x.com" }));
  const m = url.match(/contents\/([^?]+)/); const method = init.method || "GET";
  if (m && method === "GET") return store[m[1]] ? new Response(JSON.stringify({ sha: "sha-" + m[1], content: Buffer.from(store[m[1]]).toString("base64") })) : new Response("{}", { status: 404 });
  if (m && method === "PUT") { const b = JSON.parse(init.body); store[m[1]] = Buffer.from(b.content, "base64").toString(); writes.push(b.message); return new Response("{}", { status: 200 }); }
  throw new Error("unexpected " + method + " " + url);
};
const post = (b) => new Request("https://x", { method: "POST", headers: { Authorization: "Bearer t", apikey: "k" }, body: JSON.stringify(b) });
let r = await handle(post({ action: "content", site: "world-art-review" })); let d = await r.json();
assert.equal(d.collections.length, 4); assert.equal(d.collections[0].entries.length, 16);
const first = d.collections[0].entries[0];
r = await handle(post({ action: "saveEntry", site: "world-art-review", collection: "articles", id: first.id, values: { title: "Edited in a test" } })); assert.equal(r.status, 200);
assert.equal(JSON.parse(store["content/site.json"]).articles[0].title, "Edited in a test");
assert.equal(writes.at(-1), "Edit article: " + first.title + " (me@x.com)");
r = await handle(post({ action: "setHidden", site: "world-art-review", collection: "articles", id: first.id, hidden: true })); assert.equal(r.status, 200);
assert.equal(JSON.parse(store["content/site.json"]).articles[0].hidden, true);
r = await handle(post({ action: "setHidden", site: "world-art-review", collection: "artists", id: "zara-muse", hidden: true })); assert.equal(r.status, 400);
r = await handle(post({ action: "deleteEntry", site: "world-art-review", collection: "artworks", id: "zara-muse~1" })); assert.equal(r.status, 200);
assert.equal(JSON.parse(store["content/site.json"]).artists[0].works.length, 7);
r = await handle(post({ action: "deleteEntry", site: "world-art-review", collection: "artists", id: "zara-muse" })); assert.equal(r.status, 400);
r = await handle(post({ action: "removePhoto", site: "world-art-review", slot: "artist-zara-muse" })); assert.equal(r.status, 200);
assert.equal(JSON.parse(store["content/site.json"]).artists[0].image, null);
assert.equal(JSON.parse(store["image-slots.json"]).slots.find((x) => x.id === "artist-zara-muse").filled, false);
r = await handle(post({ action: "saveEntry", site: "world-art-review", collection: "nope", id: "x", values: {} })); assert.equal(r.status, 400);

// parts inside an entry: portfolio sections, at a glance, timeline, glossary
{
  const col = by(W, "artists"), zara = JSON.parse(JSON.stringify(entriesOf(war, col)[0].ref));
  const fs2 = fieldsOf(zara, [], col.inside), get = (n) => fs2.find((f) => f.name === n);
  assert.equal(get("sections.0.html").type, "long"); assert.equal(get("sections.0.html").group, "Portfolio sections");
  assert.equal(get("sections.0.html").label, "Biography: text");
  assert.ok(get("glance.1.1") && get("glance.1.1").label === "Based in" && get("timeline.0.what"));
  assert.ok(!fs2.some((f) => /^works|\.src$|\.id$|^related$|\.tone$/.test(f.name)), "internal names stay out");
  const n2 = applyValues(zara, { "sections.0.html": "<p>New text.</p>", "glance.1.1": "Paris", "sections.0.id": "x", "works.0.title": "x", "glance.1.0": "x" }, [], col.inside);
  assert.equal(n2, 2); assert.equal(zara.sections[0].html, "<p>New text.</p>"); assert.equal(zara.glance[1][1], "Paris");
  assert.equal(zara.glance[1][0], "Based in"); assert.equal(zara.sections[0].id, "bio");
  const konn = entriesOf(war, col)[1].ref;
  assert.equal(fieldsOf(konn, [], col.inside).find((f) => /placeholder/.test(String(f.value))).type, "long", "short text with marks opens in the writing editor");
  assert.ok(!fieldsOf(entriesOf(war, by(W, "articles"))[0].ref).some((f) => f.name === "sources" || f.name === "artists"));
  const gl = by(G, "glossary"), rows = entriesOf(gamC, gl);
  assert.equal(rows.length, 16); assert.equal(rows[0].title, "Hammer price");
  assert.deepEqual(fieldsOf(rows[0].ref, [], gl.columns).map((f) => f.label), ["Term", "Meaning"]);
  const sec = by(G, "sections"), srow = JSON.parse(JSON.stringify(entriesOf(gamC, sec)[0].ref));
  assert.deepEqual(fieldsOf(srow, [], sec.columns).map((f) => f.name), ["1", "2"]);
  assert.equal(applyValues(srow, { 0: "hacked", 2: "New words." }, [], sec.columns), 1); assert.equal(srow[0], "market-intelligence");
  const bio2 = fieldsOf(entriesOf(gamC, by(G, "artists"))[0].ref, [], by(G, "artists").inside);
  assert.ok(bio2.some((f) => f.name === "sources.0.1" && f.group === "Sources" && f.label === "1: link"));
}

// theme: read, check and save
{
  const { themeCss, cleanTheme } = await import("./home.mjs");
  const spec = SITES[0].theme;
  assert.deepEqual(themeCss(spec, cleanTheme(spec, {})), { css: "", font_links: [] }, "an untouched theme adds nothing to the site");
  assert.throws(() => cleanTheme(spec, { colours: { paper: "red" } })); assert.throws(() => cleanTheme(spec, { colours: { paper: "#fff;}body{display:none" } }));
  assert.throws(() => cleanTheme(spec, { fonts: { display: "Comic Sans MS" } }));
  let r2 = await handle(post({ action: "theme", site: "world-art-review" })), d2 = await r2.json();
  assert.equal(d2.values.colours.green, "#1D4A35"); assert.equal(d2.spec.colours.length, 4); assert.equal(d2.spec.url, "https://worldartreview.com/");
  r2 = await handle(post({ action: "saveTheme", site: "world-art-review", values: d2.values })); assert.equal((await r2.json()).unchanged, true);
  r2 = await handle(post({ action: "saveTheme", site: "world-art-review", values: { colours: { green: "#22304a" }, fonts: { display: "EB Garamond" } } })); assert.equal(r2.status, 200);
  const saved = JSON.parse(store["content/theme.json"]);
  assert.equal(saved.colours.green, "#22304A"); assert.equal(saved.colours.paper, "#EEE5D4"); assert.equal(saved.fonts.display, "EB Garamond");
  assert.ok(/^:root\{[^<>{}]*\}$/.test(saved.css) && saved.css.includes("--green:#22304A") && saved.css.includes("--green-dark:color-mix(in srgb, #22304A 78%, black)") && saved.css.includes("--display:'EB Garamond', Georgia, serif") && !saved.css.includes("--paper"));
  assert.deepEqual(saved.font_links, ["https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap"]);
  assert.equal(writes.at(-1), "Theme: bands and buttons, headlines typeface (me@x.com)");
  r2 = await handle(post({ action: "saveTheme", site: "world-art-review", values: { colours: { green: "url(x)" } } })); assert.equal(r2.status, 400);
  fs.writeFileSync("/tmp/theme-saved.json", JSON.stringify(saved, null, 2));
  for (const st of SITES.filter((x) => x.theme)) for (const l of st.theme.looks) cleanTheme(st.theme, { colours: l.colours });
}
console.log("CONTENT CHECKS PASSED");
