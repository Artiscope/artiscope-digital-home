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
const { makeGitHub } = await import("./fakegit.mjs");
const WR = "Artiscope/World-art-review";
const hub = makeGitHub({ [WR]: { "content/site.json": JSON.stringify(war), "image-slots.json": fs.readFileSync("/home/claude/world-art-review/image-slots.json", "utf8"), "images/zara-muse.jpg": "picture", "tools/build_site.py": "print(1)" } });
globalThis.fetch = async (url, init = {}) => String(url).includes("/auth/v1/user") ? new Response(JSON.stringify({ email: "me@x.com" })) : hub.fetch(url, init);
// what the copy being worked on holds, and what visitors see
const work = () => Object.keys(hub.refs(WR)).find((n) => n.startsWith("adh/live-"));
const store = new Proxy({}, { get: (_t, file) => hub.read(WR, work() || "main", file) });
const liveFile = (file) => hub.read(WR, "main", file);
const writes = { at: () => hub.lastMessage(WR, work() || "main") };
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

// live saves go straight to the live site; undo and redo add steps; trial copies wait for Make live
{
  const site = "world-art-review", call = async (b) => { const r = await handle(post({ site, ...b })); return { status: r.status, ...(await r.json()) }; };
  const over = async (copies) => (await (await handle(post({ action: "overview", copies }))).json()).sites[0];
  const title = (ref) => JSON.parse(hub.read(WR, ref, "content/site.json")).articles[0].title;
  assert.equal(title("main"), "Edited in a test", "a live save is on the live site at once");
  assert.equal(work(), undefined, "no working branch for the live site");
  let o = await over(); const live = o.copies[0];
  assert.equal(live.kind, "live"); assert.equal(live.ahead, 0); assert.ok(live.steps.length >= 5 && !live.canRedo);
  assert.equal(live.steps[0].what, "Theme: bands and buttons, headlines typeface"); assert.equal(live.steps[0].by, "me@x.com");
  assert.equal(live.preview, "", "the live site has no preview link");

  // undo one step, then two, then redo everything undone
  const n0 = live.steps.length;
  assert.equal((await call({ action: "undoStep" })).ok, true);
  o = await over(); assert.equal(o.copies[0].steps.length, n0 - 1); assert.equal(o.copies[0].canRedo, true);
  assert.equal(hub.read(WR, "main", "content/theme.json"), null, "the theme step is undone on the live site");
  assert.match(hub.lastMessage(WR, "main"), /^Undo: Theme: bands and buttons, headlines typeface \(me@x\.com\)\n/);
  assert.equal((await call({ action: "undoStep", steps: 2 })).ok, true);
  o = await over(); assert.equal(o.copies[0].steps.length, n0 - 3);
  assert.equal((await call({ action: "redoStep" })).ok, true);
  o = await over(); assert.equal(o.copies[0].steps.length, n0); assert.equal(o.copies[0].canRedo, false);
  assert.ok(hub.read(WR, "main", "content/theme.json").includes("#22304A"), "redo put the theme back");
  assert.equal((await call({ action: "redoStep" })).status, 409);
  // a new save after an undo ends the chance to redo, and the undone step stays undone
  await call({ action: "undoStep" });
  await call({ action: "saveEntry", collection: "articles", id: first.id, values: { title: "Second edit" } });
  o = await over(); assert.equal(o.copies[0].canRedo, false); assert.equal(title("main"), "Second edit"); assert.equal(hub.read(WR, "main", "content/theme.json"), null);
  assert.equal((await call({ action: "undoStep", steps: 99 })).status, 409);
  assert.equal((await call({ action: "discard" })).status, 400);

  // trial copies: made from live, at most two, edited on their own
  let t = await call({ action: "makeCopy", name: "Winter look!" }); assert.match(t.copy, /^trial-winter-look-[0-9a-f]{6}$/);
  assert.equal((await call({ action: "makeCopy", name: "  " })).status, 400);
  await call({ action: "makeCopy", name: "Second" }); assert.equal((await call({ action: "makeCopy", name: "Third" })).status, 400);
  o = await over({ [site]: t.copy }); assert.equal(o.copy, t.copy); assert.equal(o.copies.length, 3); assert.equal(o.copies[1].name, "Second");
  const trial = o.copies.find((c) => c.id === t.copy); assert.equal(trial.name, "Winter look"); assert.equal(trial.ahead, 0); assert.ok(trial.preview.endsWith("/preview/" + t.copy + "/"));
  await call({ action: "saveEntry", copy: t.copy, collection: "articles", id: first.id, values: { title: "Trial title" } });
  assert.equal(title("adh/" + t.copy), "Trial title"); assert.equal(title("main"), "Second edit");
  let c2 = await (await handle(post({ action: "content", site, copy: t.copy }))).json(); assert.equal(c2.collections[0].entries[0].title, "Trial title");
  assert.equal((await call({ action: "saveEntry", copy: "trial-gone-000000", collection: "articles", id: first.id, values: { title: "x" } })).status, 409);
  // trial undo and redo move the copy, step by step
  assert.equal((await call({ action: "undoStep", copy: t.copy })).ok, true); o = await over({ [site]: t.copy }); assert.equal(o.copies.find((c) => c.id === t.copy).ahead, 0);
  assert.equal((await call({ action: "redoStep", copy: t.copy })).ok, true); o = await over({ [site]: t.copy }); assert.equal(o.copies.find((c) => c.id === t.copy).ahead, 1);

  // live changed in the same file since: ask first, then replace content only
  hub.commitOn(WR, "main", "tools/build_site.py", "print(2)", "A layout fix made on live");
  await call({ action: "saveEntry", collection: "articles", id: first.id, values: { title: "Live edit in the meantime" } });
  o = await over({ [site]: t.copy }); assert.ok(o.copies.find((c) => c.id === t.copy).behind > 0);
  const clash = await call({ action: "publish", copy: t.copy }); assert.equal(clash.conflict, true); assert.ok(clash.live.includes("A layout fix made on live") && clash.live.some((x) => x.startsWith("Edit article: ")));
  assert.equal(title("main"), "Live edit in the meantime", "nothing is published while the question is open");
  assert.equal((await call({ action: "refreshCopy", copy: t.copy })).status, 409);
  assert.equal((await call({ action: "publish", copy: t.copy, replace: true })).ok, true);
  assert.equal(title("main"), "Trial title"); assert.equal(hub.read(WR, "main", "tools/build_site.py"), "print(2)", "live keeps its own layout fix");
  assert.equal(hub.lastMessage(WR, "main"), "Make live: Winter look (me@x.com)");
  o = await over(); assert.equal(o.copies.find((c) => c.id === t.copy).ahead, 0); assert.equal(o.copies[0].steps[0].what, "Make live: Winter look");
  assert.equal((await call({ action: "publish" })).unchanged, true);

  // History can put a published change back, straight onto the live site
  const hist = (await call({ action: "history" })).changes; const made = hist.find((h) => h.what === "Make live: Winter look"); assert.ok(made && made.canUndo);
  assert.equal((await call({ action: "undo", sha: made.sha })).ok, true);
  assert.equal(title("main"), "Live edit in the meantime"); assert.match(hub.lastMessage(WR, "main"), /^Undo: Make live: Winter look \(me@x\.com\)/);
  assert.equal(hist.find((h) => h.what === "A layout fix made on live").canUndo, false);

  // a refresh that can be joined, then delete
  const second = o.copies.find((c) => c.name === "Second").id;
  assert.equal((await call({ action: "refreshCopy", copy: second })).ok, true); o = await over({ [site]: second }); assert.equal(o.copies.find((c) => c.id === second).behind, 0);
  assert.equal((await call({ action: "deleteCopy", copy: second })).ok, true); assert.equal((await call({ action: "deleteCopy" })).status, 400);
  o = await over({ [site]: second }); assert.equal(o.copies.length, 2); assert.equal(o.copy, o.copies[0].id, "a deleted copy falls back to the live site");
  assert.ok(!Object.keys(hub.refs(WR)).some((n) => n.startsWith("adh-redo/")), "no leftovers");

}
console.log("CONTENT CHECKS PASSED");
