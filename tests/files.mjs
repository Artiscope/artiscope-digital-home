import { W_DIR, G_DIR, C_DIR, FIX, chromeOptions } from "./where.mjs";
// Shared pictures in the page editor, and the Files screen, against an in-memory GitHub.
import fs from "node:fs"; import assert from "node:assert/strict";
globalThis.Deno = { env: { get: (k) => ({ GITHUB_TOKEN: "t", ALLOWED_EMAILS: "me@x.com", SUPABASE_URL: "https://s" }[k] || "") }, serve() {} };
const { handle, pictureSpots, applyPictures, usageOf, fillDescriptions } = await import("./home.mjs");
const { makeGitHub } = await import("./fakegit.mjs");
const WAR = (W_DIR + "/");
const war = JSON.parse(fs.readFileSync(WAR + "content/site.json", "utf8"));
const WR = "Artiscope/World-art-review";
// start from Konn Artiss without a picture, whatever the live site has now
Object.assign(war.artists.find((a) => a.slug === "konn-artiss"), { image: null, alt: "" });
const slotsSeed = JSON.parse(fs.readFileSync(WAR + "image-slots.json", "utf8")); slotsSeed.slots.find((x) => x.id === "artist-konn-artiss").filled = false;

// the pure parts first
{
  const data = JSON.parse(JSON.stringify(war));
  const spots = pictureSpots(data);
  const zara = spots.find((x) => x.key === "artist:zara-muse");
  assert.equal(zara.image, "zara-muse-portrait.jpg"); assert.equal(zara.group, "Artists");
  assert.equal(spots.filter((x) => x.kind === "work").length, 12);
  assert.equal(spots.find((x) => x.kind === "work").slot, "work-zara-muse-malala-yousafzai");
  assert.equal(spots.find((x) => x.key === "article:palette-knife-painting").image, "article-palette-knife-painting.jpg");
  const slots = JSON.parse(JSON.stringify(slotsSeed));
  const res = applyPictures(data, { "artist:konn-artiss": { image: "ice.jpg", alt: "Ice blocks", credit: "Photo: x" }, "artist:zara-muse": { alt: "Zara Muse's portrait" } }, slots);
  assert.deepEqual(res.done.sort(), ["Konn Artiss", "Zara Muse"]); assert.equal(res.slotsChanged, true);
  const konn = data.artists.find((a) => a.slug === "konn-artiss");
  assert.equal(konn.image, "images/ice.jpg"); assert.equal(konn.alt, "Ice blocks"); assert.equal(konn.heroCredit, "Photo: x");
  assert.equal(slots.slots.find((x) => x.id === "artist-konn-artiss").filled, true);
  assert.throws(() => applyPictures(data, { "artist:nobody": { image: "a.jpg" } }));
  assert.throws(() => applyPictures(data, { "artist:zara-muse": { image: "../secret" } }));
  assert.equal(applyPictures(data, { "artist:zara-muse": { image: "", alt: "" } }, slots).done.length, 1);
  assert.equal(data.artists[0].image, null); assert.equal(slots.slots.find((x) => x.id === "artist-zara-muse").filled, false);
  const pages = { shared: {}, pages: { home: { title: "Home", sections: [{ id: "p1", type: "picture", visible: false, settings: { image: "ice.jpg", alt: "" } }] } } };
  const used = usageOf("ice.jpg", pages, { picture: { label: "Picture" } }, pictureSpots(data));
  assert.deepEqual(used.map((u) => u.label), ["Home page: Picture (hidden)", "Artist: Konn Artiss"]);
  assert.equal(fillDescriptions(pages.pages, "ice.jpg", "Blocks of ice"), 1); assert.equal(pages.pages.home.sections[0].settings.alt, "Blocks of ice");
}

const hub = makeGitHub({ [WR]: {
  "content/site.json": JSON.stringify(war), "content/pages.json": fs.readFileSync(WAR + "content/pages.json", "utf8"), "image-slots.json": JSON.stringify(slotsSeed),
  "images/zara-muse-portrait.jpg": "zara", "images/article-palette-knife-painting.jpg": "knife", "images/spare.jpg": "spare",
} });
globalThis.fetch = async (url, init = {}) => String(url).includes("/auth/v1/user") ? new Response(JSON.stringify({ email: "me@x.com" })) : hub.fetch(url, init);
const post = (b) => new Request("https://x/functions/v1/home", { method: "POST", headers: { Authorization: "Bearer a" }, body: JSON.stringify(b) });
const call = async (b) => { const r = await handle(post({ site: "world-art-review", ...b })); return { status: r.status, ...(await r.json()) }; };
const site = () => JSON.parse(hub.read(WR, "main", "content/site.json"));

// the editor is given the shared pictures, and saves them with the page as one step
{
  const pg = await call({ action: "pages" });
  assert.equal(pg.status, 200); assert.ok(pg.kinds.hero.fields.some((f) => f.name === "image" && f.type === "image" && f.alt === "alt"));
  assert.ok(pg.pictures.some((x) => x.key === "artist:zara-muse" && x.image === "zara-muse-portrait.jpg" && x.hasCredit));
  assert.ok(!pg.pictures.some((x) => x.kind === "work"), "artworks wait for the portfolio editor");
  assert.deepEqual(pg.imageMeta, {});
  // the banner's own picture, and a new photo for Konn Artiss
  const doc = JSON.parse(JSON.stringify(pg.pages));
  Object.assign(doc.pages.home.sections.find((x) => x.type === "hero").settings, { image: "spare.jpg", alt: "A spare photo", credit: "Studio photo" });
  let r = await call({ action: "savePages", pages: doc, what: "Edit Opening banner", pictures: { "artist:konn-artiss": { image: "upload:1", alt: "Konn Artiss's ice blocks", credit: "" } }, uploads: [{ key: "upload:1", name: "Ice.JPG", ext: "jpg", content: "aWNl" }] });
  if (r.status !== 200) console.log(r); assert.equal(r.status, 200); assert.equal(r.photos["upload:1"], "ice.jpg");
  assert.equal(hub.read(WR, "main", "images/ice.jpg"), "ice");
  const konn = site().artists.find((a) => a.slug === "konn-artiss"); assert.equal(konn.image, "images/ice.jpg"); assert.equal(konn.alt, "Konn Artiss's ice blocks");
  assert.equal(JSON.parse(hub.read(WR, "main", "image-slots.json")).slots.find((x) => x.id === "artist-konn-artiss").filled, true);
  const hero = JSON.parse(hub.read(WR, "main", "content/pages.json")).pages.home.sections.find((x) => x.type === "hero").settings;
  assert.equal(hero.image, "spare.jpg"); assert.equal(hero.credit, "Studio photo");
  assert.deepEqual(JSON.parse(hub.read(WR, "main", "content/files.json")).files["ice.jpg"], { alt: "Konn Artiss's ice blocks", caption: "" }, "the new photo keeps its description");
  assert.match(hub.lastMessage(WR, "main"), /^Edit page: Edit Opening banner/);
  // a picture change on its own
  r = await call({ action: "savePages", pages: doc, pictures: { "article:texture-in-portraiture": { image: "spare.jpg", alt: "Spare" } } }); if (r.status !== 200) console.log(r);
  assert.equal(r.status, 200); assert.match(hub.lastMessage(WR, "main"), /^Edit picture: The role of texture/);
  // nothing new: nothing saved
  assert.equal((await call({ action: "savePages", pages: doc, pictures: { "article:texture-in-portraiture": { image: "spare.jpg", alt: "Spare" } } })).unchanged, true);
  assert.equal((await call({ action: "savePages", pages: doc, pictures: { "artist:nobody": { image: "x.jpg" } } })).status, 400);
  // one Undo takes the picture back
  assert.equal((await call({ action: "undoStep" })).ok, true);
  assert.ok(!site().articles.find((a) => a.slug === "texture-in-portraiture").image);
}

// Files: list, add, describe, replace everywhere, put in an empty place, delete only when unused
{
  let f = await call({ action: "files" });
  assert.equal(f.status, 200); assert.equal(f.imageBase, "https://worldartreview.com/images/");
  const by = (n) => f.files.find((x) => x.name === n);
  assert.deepEqual(f.files.map((x) => x.name).sort(), ["article-palette-knife-painting.jpg", "ice.jpg", "spare.jpg", "zara-muse-portrait.jpg"]);
  assert.deepEqual(by("spare.jpg").used.map((u) => u.label), ["Home page: Opening banner"]);
  assert.equal(by("spare.jpg").used[0].id, "hero");
  assert.deepEqual(by("ice.jpg").used.map((u) => u.label), ["Artist: Konn Artiss"]); assert.equal(by("ice.jpg").alt, "Konn Artiss's ice blocks");
  assert.ok(f.spots.some((x) => x.key === "work:zara-muse:0" && !x.image));
  // add a photo with its description
  let r = await call({ action: "saveFiles", op: "add", fileName: "Studio Wall.png", ext: "png", content: "d2FsbA==", alt: "A studio wall", caption: "The studio" });
  assert.equal(r.name, "studio-wall.png"); assert.equal(hub.read(WR, "main", "images/studio-wall.png"), "wall");
  assert.match(hub.lastMessage(WR, "main"), /^Add photo: studio-wall\.png/);
  assert.equal((await call({ action: "saveFiles", op: "add", fileName: "x.jpg", ext: "jpg", content: "not ok!" })).status, 400);
  // describe: the description also fills empty ones where the photo is used
  const p = JSON.parse(hub.read(WR, "main", "content/pages.json")); p.pages.home.sections.find((x) => x.type === "hero").settings.alt = "";
  await call({ action: "savePages", pages: p });
  r = await call({ action: "saveFiles", op: "describe", name: "spare.jpg", alt: "A spare photo of the studio", caption: "" });
  assert.equal(r.ok, true);
  assert.equal(JSON.parse(hub.read(WR, "main", "content/pages.json")).pages.home.sections.find((x) => x.type === "hero").settings.alt, "A spare photo of the studio");
  assert.equal(JSON.parse(hub.read(WR, "main", "content/files.json")).files["spare.jpg"].alt, "A spare photo of the studio");
  // replace everywhere keeps the name, so every place shows the new photo
  assert.equal((await call({ action: "saveFiles", op: "replace", name: "spare.jpg", ext: "png", content: "bmV3" })).status, 400, "same kind of file only");
  r = await call({ action: "saveFiles", op: "replace", name: "spare.jpg", ext: "jpg", content: "bmV3" }); assert.equal(r.ok, true);
  assert.equal(hub.read(WR, "main", "images/spare.jpg"), "new"); assert.match(hub.lastMessage(WR, "main"), /^Replace photo: spare\.jpg/);
  // put a photo in an empty place
  assert.equal((await call({ action: "saveFiles", op: "assign", name: "zara-muse-portrait.jpg", spot: "work:zara-muse:0" })).status, 400, "needs a description");
  r = await call({ action: "saveFiles", op: "assign", name: "studio-wall.png", spot: "work:zara-muse:0" }); assert.equal(r.ok, true);
  assert.equal(site().artists[0].works[0].image, "images/studio-wall.png"); assert.equal(site().artists[0].works[0].alt, "A studio wall");
  assert.equal(JSON.parse(hub.read(WR, "main", "image-slots.json")).slots.find((x) => x.id === "work-zara-muse-malala-yousafzai").filled, true);
  // delete: refused while used, done when not
  assert.equal((await call({ action: "saveFiles", op: "remove", name: "studio-wall.png" })).status, 409);
  assert.equal((await call({ action: "saveFiles", op: "remove", name: "gone.jpg" })).status, 409);
  await call({ action: "saveFiles", op: "add", fileName: "unused", ext: "jpg", content: "dW51c2Vk", alt: "Not used" });
  r = await call({ action: "saveFiles", op: "remove", name: "unused.jpg" }); assert.equal(r.ok, true);
  assert.equal(hub.read(WR, "main", "images/unused.jpg"), null); assert.ok(!("unused.jpg" in JSON.parse(hub.read(WR, "main", "content/files.json")).files));
  // undo brings it back, description and all
  assert.equal((await call({ action: "undoStep" })).ok, true);
  assert.equal(hub.read(WR, "main", "images/unused.jpg"), "unused"); assert.equal(JSON.parse(hub.read(WR, "main", "content/files.json")).files["unused.jpg"].alt, "Not used");
  const o = await (await handle(post({ action: "overview" }))).json();
  assert.equal(o.sites[0].files, true); assert.equal(o.sites[1].files, true); assert.equal(o.sites[1].edits, true);
}
console.log("FILES CHECKS PASSED");
