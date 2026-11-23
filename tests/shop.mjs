// Shops on Shopify: the shop card, products, saving with every change checked against Shopify,
// many prices at once, the list of changes and putting them back, copies and photos.
import assert from "node:assert/strict";

const ADMIN = "boss@x.com", EDITOR = "ed@x.com";
let shopKey = "", clientId = "", clientSecret = "";
globalThis.Deno = { env: { get: (k) => ({ GITHUB_TOKEN: "t", ALLOWED_EMAILS: ADMIN, SUPABASE_URL: "https://s", SUPABASE_SERVICE_ROLE_KEY: "k", SHOPIFY_TOKEN: shopKey, SHOPIFY_CLIENT_ID: clientId, SHOPIFY_CLIENT_SECRET: clientSecret }[k] || "") }, serve() {} };
const h = await import("./home.mjs");
const { makeGitHub } = await import("./fakegit.mjs"); const { makePeople } = await import("./fakepeople.mjs"); const { makeShop } = await import("./fakeshop.mjs");
const CR = "Artiscope/artiscope-digital-home";
const list = { sites: [{ id: "zen-xander", name: "Zen Xander", domain: "zenxander.com", kind: "shop", store: "test-shop" }, { id: "bad-shop", name: "Bad", kind: "shop", store: "Not A Store!" }] };
const hub = makeGitHub({ [CR]: { "sites.json": JSON.stringify(list) } });
const ppl = makePeople();
const shop = makeShop("test-shop");
let signedIn = ADMIN;
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ email: signedIn }));
  if (shop.handles(url)) return shop.fetch(url, init);
  if (ppl.handles(url)) return ppl.fetch(url, init);
  return hub.fetch(url, init);
};
const { handle } = h;
const as = async (who, b) => { signedIn = who; const r = await handle(new Request("https://x", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify(b) })); const d = await r.json(); d.status = r.status; return d; };
let passed = 0; const ok = (m) => { passed++; console.log("ok   " + m); };
const S = { site: "zen-xander" };
const logOf = () => { const t = hub.read(CR, "shop-log", "shop-log/zen-xander.json"); return t ? JSON.parse(t).entries : []; };

await as(ADMIN, { action: "invitePerson", email: EDITOR, name: "Ed", sites: ["zen-xander"] });
// ----- the card -----
assert.deepEqual(h.cleanSiteList(list).map((x) => [x.id, x.kind, x.store]), [["zen-xander", "shop", "test-shop"]], "a shop needs a store name in Shopify's own form");
let d = await as(ADMIN, { action: "overview" });
let card = d.sites.find((x) => x.id === "zen-xander");
assert.ok(card && card.shop && card.shop.store === "test-shop" && card.shop.ready === false && card.live === false && card.buildable === false, JSON.stringify(card));
ok("Zen Xander is a shop card, not a site to build, and says the key is not there yet");
d = await as(ADMIN, { action: "shopProducts", ...S });
assert.equal(d.status, 503); assert.match(d.error, /SHOPIFY_TOKEN/);
ok("without the key, the console says where it goes");
shopKey = "shpat_test"; shop.setKey("shpat_wrong");
d = await as(ADMIN, { action: "shopProducts", ...S }); assert.equal(d.status, 502); assert.match(d.error, /did not accept the key/);
shop.setKey("shpat_test");
d = await as(ADMIN, { action: "overview" }); assert.equal(d.sites.find((x) => x.id === "zen-xander").shop.ready, true);
d = await as(EDITOR, { action: "shopProducts", ...S }); assert.equal(d.status, 403); assert.match(d.error, /Only the admin/);
d = await as(ADMIN, { action: "shopProducts", site: "world-art-review" }); assert.equal(d.status, 400);
ok("a wrong key is named plainly, editors are kept out, and other sites have no shop");

// ----- the list and one product -----
d = await as(ADMIN, { action: "shopProducts", ...S });
assert.equal(d.status, 200, JSON.stringify(d));
assert.deepEqual(d.products.map((p) => p.title), ["Job Lot", "NO PLAN BEE", "NEW CHALLENGES", "SPACE RATS"], "newest change first, as in Shopify");
const rats = d.products.find((p) => p.title === "SPACE RATS");
assert.deepEqual([rats.status, rats.versions, rats.stock, rats.low, rats.high, rats.collections.length], ["ACTIVE", 18, 1800, "250.00", "350.00", 2]);
assert.deepEqual(rats.options.map((o) => o.name + ":" + o.values.length), ["Size:1", "Frame:3", "Color:6"]);
assert.deepEqual(d.collections.map((c) => [c.title, c.auto]), [["WILD REALITIES", false], ["Limited Edition Prints", false], ["New this month", true]]);
assert.equal(d.currency, "GBP");
ok("the list: status, versions, stock, price range and collections, with rule-filled collections marked");
d = await as(ADMIN, { action: "shopProduct", ...S, id: rats.id });
let P = d.product;
assert.equal(P.variants.length, 18); assert.equal(P.url, "https://zenxander.com/products/space-rats");
assert.deepEqual(P.options.map((o) => o.name), ["Size", "Frame", "Color"]);
assert.deepEqual(P.variants[0].stock.map((s) => [s.name, s.qty]), [["Print Shop", 100]]);
assert.equal(P.photos.length, 3); assert.equal(P.locations.length, 2); assert.equal(P.template, "new-series-template");
d = await as(ADMIN, { action: "shopProduct", ...S, id: "gid://shopify/Product/999999" }); assert.equal(d.status, 404);
d = await as(ADMIN, { action: "shopProduct", ...S, id: "../../etc" }); assert.equal(d.status, 400);
ok("one product: its versions with their options, stock in each place, photos, collections and layout");

// ----- saving one product -----
const altPhoto = P.photos[1].id, v0 = P.variants[0], v6 = P.variants[6], col = (t) => P.allCollections.find((c) => c.title === t).id;
d = await as(ADMIN, { action: "shopSave", ...S, id: P.id, change: {
  title: { from: "SPACE RATS", to: "SPACE RATS (Red)" },
  variants: [{ id: v0.id, price: { from: "250.00", to: "£260" }, sku: { from: "", to: "SR-GRN-U" } }, { id: v6.id, was: { from: null, to: "400" } }],
  stock: [{ item: v0.item, location: v0.stock[0].location, from: 100, to: 97 }],
  collections: { remove: [col("WILD REALITIES")] },
  photos: [{ id: P.photos[1].id, from: "", to: "SPACE RATS in a white frame" }],
  order: [P.photos[2].id, P.photos[0].id, P.photos[1].id] } });
assert.equal(d.status, 200, JSON.stringify(d));
const live = shop.findProduct(P.id);
assert.equal(live.title, "SPACE RATS (Red)"); assert.equal(live.variants[0].price, "260.00"); assert.equal(live.variants[0].sku, "SR-GRN-U"); assert.equal(live.variants[6].compareAtPrice, "400.00");
assert.equal(live.variants[0].item.levels[v0.stock[0].location], 97);
assert.ok(!shop.collections[0].products.includes(P.id)); assert.equal(live.media[0].id, P.photos[2].id); assert.equal(live.media.find((m) => m.id === P.photos[1].id).alt, "SPACE RATS in a white frame");
let L = logOf(); assert.equal(L.length, 1); assert.match(L[0].what, /changes to SPACE RATS/); assert.equal(L[0].by, "admin");
assert.equal(L[0].items.filter((x) => x.kind !== "note").length, 7);
assert.ok(!hub.read(CR, "main", "shop-log/zen-xander.json"), "the list of changes never lands on main");
ok("one Save changes the title, a price, a was price, a stock code, stock, a collection, a photo's words and the photo order, and lists them");

// a change made in Shopify meanwhile stops the save, and nothing is changed
P = (await as(ADMIN, { action: "shopProduct", ...S, id: P.id })).product;
shop.findProduct(P.id).variants[1].price = "275.00";
d = await as(ADMIN, { action: "shopSave", ...S, id: P.id, change: { title: { from: P.title, to: "Changed" }, variants: [{ id: P.variants[1].id, price: { from: "250.00", to: "300" } }] } });
assert.equal(d.status, 409); assert.equal(d.stale, true); assert.match(d.error, /changed in Shopify since you opened it \(price\)/);
assert.equal(shop.findProduct(P.id).title, "SPACE RATS (Red)", "nothing changed");
shop.findVariant(P.variants[0].id).v.item.levels[P.variants[0].stock[0].location] = 50;
d = await as(ADMIN, { action: "shopSave", ...S, id: P.id, change: { stock: [{ item: P.variants[0].item, location: P.variants[0].stock[0].location, from: 97, to: 90 }] } });
assert.equal(d.status, 409); assert.match(d.error, /stock/);
ok("a price or stock changed in Shopify meanwhile stops the save, and nothing is changed");
d = await as(ADMIN, { action: "shopSave", ...S, id: P.id, change: { collections: { add: [col("New this month")] } } });
assert.equal(d.status, 400); assert.match(d.error, /fills itself by rules/);
d = await as(ADMIN, { action: "shopSave", ...S, id: P.id, change: { variants: [{ id: P.variants[2].id, price: { from: "250.00", to: "abc" } }] } });
assert.equal(d.status, 400); assert.match(d.error, /is not a price/);
d = await as(ADMIN, { action: "shopSave", ...S, id: P.id, change: { title: { from: P.title, to: "  " } } }); assert.equal(d.status, 400);
d = await as(ADMIN, { action: "shopSave", ...S, id: P.id, change: { status: { from: P.status, to: "GONE" } } }); assert.equal(d.status, 400);
d = await as(ADMIN, { action: "shopSave", ...S, id: P.id, change: { description: { from: P.description, to: '<p>New words<script>alert(1)</script></p><p onclick="x()">Two</p>' } } });
assert.equal(d.status, 200); assert.equal(shop.findProduct(P.id).descriptionHtml, "<p>New words</p><p>Two</p>");
shop.refuse.push({ op: "Vs", payload: "productVariantsBulkUpdate", message: "Price must be greater than 0", once: true });
d = await as(ADMIN, { action: "shopSave", ...S, id: P.id, change: { variants: [{ id: P.variants[2].id, price: { from: "250.00", to: "1" } }] } });
assert.equal(d.status, 400); assert.match(d.error, /refused by Shopify: Price must be greater than 0/);
shop.refuse.push({ op: "One", errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }], once: true });
d = await as(ADMIN, { action: "shopProduct", ...S, id: P.id }); assert.equal(d.status, 200, "a busy Shopify is asked again");
shop.refuse.push({ op: "One", errors: [{ message: "Access denied", extensions: { code: "ACCESS_DENIED" } }], once: true });
d = await as(ADMIN, { action: "shopProduct", ...S, id: P.id }); assert.match(d.error, /missing a permission/);
ok("rule-filled collections, bad prices, empty titles and unknown statuses are refused; descriptions lose anything that could run; Shopify's own refusals are passed on");

// ----- many prices at once -----
assert.equal(h.shopNewPrice("350.00", "set", "£375"), "375.00");
assert.equal(h.shopNewPrice("350.00", "percent", "7.5", "pound"), "376.00");
assert.equal(h.shopNewPrice("350.00", "percent", "7.5", "none"), "376.25");
assert.equal(h.shopNewPrice("350.00", "amount", "-25"), "325.00");
assert.throws(() => h.shopNewPrice("20.00", "amount", "-25"), /cannot be right/);
assert.equal(h.shopMoney("1,250.5"), "1250.50"); assert.equal(h.shopMoney("", true), null);
d = await as(ADMIN, { action: "shopPricePlan", ...S, filter: { products: "active", options: { Frame: ["White", "Black"] } }, how: "set", value: "375" });
assert.equal(d.status, 200, JSON.stringify(d));
let plan = d.plan;
assert.deepEqual([plan.count, plan.products, plan.to], [14, 2, "375.00"], "SPACE RATS's 12 framed and NEW CHALLENGES's 2; the draft and the archived stay out");
assert.ok(plan.groups.every((g) => g.status === "ACTIVE") && plan.groups.flatMap((g) => g.versions).every((v) => v.from === "350.00" && v.to === "375.00"));
d = await as(ADMIN, { action: "shopPricePlan", ...S, filter: { products: "collection", collection: col("Limited Edition Prints"), options: { Frame: ["Unframed"] } }, how: "percent", value: "-10", round: "pound", was: true });
assert.deepEqual(d.plan.groups.map((g) => g.title).sort(), ["NEW CHALLENGES", "NO PLAN BEE", "SPACE RATS (Red)"], "a collection takes drafts too, when chosen");
assert.equal(d.plan.count, 9);
assert.ok(d.plan.groups.flatMap((g) => g.versions).every((v) => v.to === String((Math.round(Number(v.from) * 0.9)).toFixed(2)) && v.wasTo === v.from), "lowered prices keep the old one as a was price");
d = await as(ADMIN, { action: "shopPricePlan", ...S, filter: { products: "active" }, how: "set", value: "-5" }); assert.equal(d.status, 400);
ok("a price plan: on sale only, by frame or colour, by collection; set, raise or lower by an amount or a percentage, rounded; a was price when lowering");

d = await as(ADMIN, { action: "shopPriceApply", ...S, groups: plan.groups, label: "Framed prints to £375" });
assert.equal(d.status, 200, JSON.stringify(d)); assert.deepEqual([d.ok, d.changed, d.of], [true, 14, 14]);
assert.ok(shop.findProduct(rats.id).variants.filter((v) => v.selectedOptions[1].value !== "Unframed").every((v) => v.price === "375.00"));
assert.ok(shop.products.find((p) => p.title === "NO PLAN BEE").variants.every((v) => v.price !== "375.00"));
L = logOf(); assert.equal(L[0].what, "Framed prints to £375"); assert.equal(L[0].items.filter((x) => x.field === "price").length, 14);
d = await as(ADMIN, { action: "shopPriceApply", ...S, groups: plan.groups });
assert.equal(d.status, 409); assert.match(d.error, /14 prices have changed in Shopify since the check\. Nothing was changed/);
ok("the checked plan is applied as shown, listed in Changes, and the same plan again is refused because Shopify has moved on");

// one product refused part way: the rest stops, and what was done is listed so it can be put back
d = await as(ADMIN, { action: "shopPricePlan", ...S, filter: { products: "active", options: { Frame: ["White", "Black"] } }, how: "amount", value: "10" });
plan = d.plan; shop.refuse.push({ op: "Vs", payload: "productVariantsBulkUpdate", message: "Something went wrong", once: true });
const first = plan.groups[0].title;
d = await as(ADMIN, { action: "shopPriceApply", ...S, groups: plan.groups.slice().reverse() });
assert.equal(d.ok, false); assert.match(d.problem, /0 of 14 prices were changed before that/);
shop.refuse.length = 0;
ok("if Shopify refuses part way, the console says how many were changed before it stopped (" + first + ")");

// ----- the list of changes, and putting one back -----
d = await as(ADMIN, { action: "shopChanges", ...S });
assert.equal(d.changes[0].what, "Framed prints to £375");
d = await as(ADMIN, { action: "shopChanges", ...S, id: shop.products.find((p) => p.title === "NEW CHALLENGES").id });
assert.deepEqual(d.changes.map((c) => c.what), ["Framed prints to £375"], "a product's own page lists only its changes");
const priceEntry = logOf()[0].id;
d = await as(ADMIN, { action: "shopPutBack", ...S, entry: priceEntry });
assert.equal(d.status, 200, JSON.stringify(d));
assert.ok(shop.findProduct(rats.id).variants.filter((v) => v.selectedOptions[1].value !== "Unframed").every((v) => v.price === "350.00"));
assert.equal(shop.findProduct(rats.id).variants[6].price, "350.00");
L = logOf(); assert.match(L[0].what, /^Put back: Framed prints to £375/); assert.ok(L.find((e) => e.id === priceEntry).putBack);
d = await as(ADMIN, { action: "shopPutBack", ...S, entry: priceEntry }); assert.equal(d.status, 409); assert.match(d.error, /already been put back/);
ok("Put back sets every price as it was, and says so in the list; it cannot be done twice");
const saveEntry = L.find((e) => /changes to SPACE RATS$/.test(e.what)).id;
shop.findProduct(rats.id).title = "Renamed in Shopify";
d = await as(ADMIN, { action: "shopPutBack", ...S, entry: saveEntry }); assert.equal(d.status, 409); assert.match(d.error, /changed again since \(2 parts\), so nothing was put back/);
shop.findProduct(rats.id).title = "SPACE RATS (Red)";
const lvl = shop.findProduct(rats.id).variants[0].item.levels; lvl[Object.keys(lvl)[0]] = 97; shop.findProduct(rats.id).variants[0].price = "260.00";
d = await as(ADMIN, { action: "shopPutBack", ...S, entry: saveEntry }); assert.equal(d.status, 200, JSON.stringify(d));
const back = shop.findProduct(rats.id);
assert.deepEqual([back.title, back.variants[0].price, back.variants[0].sku, back.variants[6].compareAtPrice, back.variants[0].item.levels[Object.keys(lvl)[0]]], ["SPACE RATS", "250.00", "", null, 100]);
assert.ok(shop.collections[0].products.includes(rats.id)); assert.equal(back.media.find((m) => m.id === altPhoto).alt, "");
ok("a whole Save is put back only when nothing in it has moved since: title, prices, stock code, was price, stock, collection and photo words");

// ----- adding products and photos -----
d = await as(ADMIN, { action: "shopAdd", ...S, from: rats.id, title: "MOON RATS" });
assert.equal(d.status, 200, JSON.stringify(d));
const moon = shop.findProduct(d.id); assert.deepEqual([moon.title, moon.status, moon.variants.length, moon.media.length], ["MOON RATS", "DRAFT", 18, 3]);
d = await as(ADMIN, { action: "shopAdd", ...S, title: "Blank one" }); assert.equal(shop.findProduct(d.id).status, "DRAFT");
d = await as(ADMIN, { action: "shopAdd", ...S, title: " " }); assert.equal(d.status, 400);
ok("Add a product: a copy of another (versions, prices and photos) or a blank one, always as a draft");
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).toString("base64");
d = await as(ADMIN, { action: "shopPhoto", ...S, id: moon.id, title: "MOON RATS", name: "Moon Rats framed.JPG", ext: "jpg", content: jpg, alt: "MOON RATS in a black frame" });
assert.equal(d.status, 200, JSON.stringify(d));
assert.equal(shop.uploads.length, 1); assert.equal(shop.uploads[0].key, "tmp/moon-rats-framed.jpg"); assert.equal(shop.findProduct(moon.id).media.at(-1).alt, "MOON RATS in a black frame");
d = await as(ADMIN, { action: "shopPhoto", ...S, id: moon.id, name: "x.jpg", ext: "jpg", content: jpg, alt: "" }); assert.match(d.error, /Say what the photo shows/);
d = await as(ADMIN, { action: "shopPhoto", ...S, id: moon.id, name: "x.gif", ext: "gif", content: jpg, alt: "x" }); assert.equal(d.status, 400);
ok("a photo goes to Shopify with what it shows, and is refused without those words");
assert.deepEqual([h.shopSay([{ kind: "variant", field: "price", from: "250.00", to: "275.00" }], "X"), h.gbp("249.50"), h.gbp(null)], ["1 price on X, £250 to £275", "£249.50", "none"]);
assert.ok(shop.log.includes("Stock") && h.SHOPIFY_VERSION === "2026-10");

// ----- an app made in the Dev Dashboard: the server asks Shopify for a key, keeps it, and asks again when it lapses -----
shopKey = ""; clientId = "cid"; clientSecret = "wrong"; shop.setClient({ id: "cid", secret: "csecret" });
d = await as(ADMIN, { action: "shopProducts", ...S }); assert.equal(d.status, 502); assert.match(d.error, /Client ID and secret \(Client authentication failed\)/);
clientSecret = "csecret";
d = await as(ADMIN, { action: "shopProducts", ...S }); assert.equal(d.status, 200); assert.equal(shop.issued, 1);
d = await as(ADMIN, { action: "shopProducts", ...S }); assert.equal(shop.issued, 1, "the key is kept while it lasts");
shop.expire();
d = await as(ADMIN, { action: "shopProducts", ...S }); assert.equal(d.status, 200); assert.equal(shop.issued, 2, "a lapsed key is asked for again once");
d = await as(ADMIN, { action: "overview" }); assert.equal(d.sites.find((x) => x.id === "zen-xander").shop.ready, true);
ok("an app from Shopify's Dev Dashboard works too: its Client ID and secret get a key, kept until it lapses");

console.log("\n" + passed + " passed. SHOP CHECKS PASSED");
