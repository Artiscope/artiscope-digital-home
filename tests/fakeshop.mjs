// A small stand-in for a Shopify store's Admin API, kept in memory, so the console's shop code can be
// tested without touching the real shop. It answers the console's own queries and mutations by name.
export function makeShop(store = "test-shop") {
  let n = 1000, clock = Date.UTC(2026, 10, 1);
  const gid = (k) => "gid://shopify/" + k + "/" + (++n);
  const tick = () => new Date((clock += 60000)).toISOString();
  const locations = [{ id: gid("Location"), name: "Print Shop", isActive: true }, { id: gid("Location"), name: "Shop location", isActive: true }];
  const collections = [
    { id: gid("Collection"), title: "WILD REALITIES", handle: "welcome-to-the-wild", ruleSet: null, products: [] },
    { id: gid("Collection"), title: "Limited Edition Prints", handle: "limited-edition-prints", ruleSet: null, products: [] },
    { id: gid("Collection"), title: "New this month", handle: "new", ruleSet: { appliedDisjunctively: false }, products: [] },
  ];
  const products = [];
  function addProduct(title, status, colours, inCols = [0, 1]) {
    const p = { id: gid("Product"), title, handle: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), status, descriptionHtml: "<p>" + title + " by the artist</p>", templateSuffix: "new-series-template", updatedAt: tick(),
      seo: { title: null, description: null }, options: [{ name: "Size", values: ["A2 (42x60cm)"] }, { name: "Frame", values: ["Unframed", "White", "Black"] }], variants: [], media: [] };
    if (colours.length) p.options.push({ name: "Color", values: colours });
    for (const frame of ["Unframed", "White", "Black"]) for (const c of colours.length ? colours : [null]) {
      const sel = [{ name: "Size", value: "A2 (42x60cm)" }, { name: "Frame", value: frame }, ...(c ? [{ name: "Color", value: c }] : [])];
      p.variants.push({ id: gid("ProductVariant"), title: sel.map((x) => x.value).join(" / "), price: frame === "Unframed" ? "250.00" : "350.00", compareAtPrice: null, sku: "", selectedOptions: sel,
        item: { id: gid("InventoryItem"), tracked: true, levels: { [locations[0].id]: 100 } } });
    }
    for (let i = 0; i < 3; i++) p.media.push({ id: gid("MediaImage"), alt: i ? "" : title + " print", status: "READY", url: "https://cdn.example/" + p.handle + "-" + i + ".jpg" });
    for (const ci of inCols) collections[ci].products.push(p.id);
    products.push(p); return p;
  }
  addProduct("SPACE RATS", "ACTIVE", ["Green", "Orange", "Pink", "Purple", "Mint", "Red"]);
  addProduct("NEW CHALLENGES", "ACTIVE", [], [1]);
  addProduct("NO PLAN BEE", "DRAFT", ["Yellow", "Blue"], [1]);
  addProduct("Job Lot", "ARCHIVED", [], []);
  const log = [], uploads = [], refuse = [];   // refuse: [{ op, errors }] a test's way to make Shopify say no
  let key = "", client = null, issued = 0;

  const findProduct = (id) => products.find((p) => p.id === id);
  const findVariant = (id) => { for (const p of products) { const v = p.variants.find((x) => x.id === id); if (v) return { p, v }; } return null; };
  const total = (p) => p.variants.reduce((s, v) => s + Object.values(v.item.levels).reduce((a, b) => a + b, 0), 0);
  const money = (x) => x == null ? null : Number(x).toFixed(2);
  const page = (list, after, size) => { const i = after ? Number(after) : 0, nodes = list.slice(i, i + size); return { nodes, pageInfo: { hasNextPage: i + size < list.length, endCursor: String(i + size) } }; };
  const colOut = (c) => ({ id: c.id, title: c.title, handle: c.handle, ruleSet: c.ruleSet });
  function listed(p) {
    const ps = p.variants.map((v) => Number(v.price));
    return { id: p.id, title: p.title, handle: p.handle, status: p.status, totalInventory: total(p), variantsCount: { count: p.variants.length }, updatedAt: p.updatedAt, options: p.options.map((o) => ({ name: o.name, optionValues: o.values.map((name) => ({ name })) })),
      priceRangeV2: { minVariantPrice: { amount: String(Math.min(...ps)) }, maxVariantPrice: { amount: String(Math.max(...ps)) } },
      featuredMedia: p.media[0] ? { preview: { image: { url: p.media[0].url } } } : null, collections: { nodes: collections.filter((c) => c.products.includes(p.id)).map((c) => ({ id: c.id })) } };
  }
  function full(p) {
    return { id: p.id, title: p.title, handle: p.handle, status: p.status, descriptionHtml: p.descriptionHtml, templateSuffix: p.templateSuffix, updatedAt: p.updatedAt, totalInventory: total(p), seo: p.seo,
      options: p.options.map((o) => ({ name: o.name, optionValues: o.values.map((name) => ({ name })) })),
      variants: { nodes: p.variants.map((v) => ({ id: v.id, title: v.title, price: v.price, compareAtPrice: v.compareAtPrice, sku: v.sku, selectedOptions: v.selectedOptions,
        inventoryItem: { id: v.item.id, tracked: v.item.tracked, inventoryLevels: { nodes: Object.entries(v.item.levels).map(([loc, q]) => ({ location: { id: loc, name: locations.find((l) => l.id === loc).name }, quantities: [{ name: "available", quantity: q }] })) } } })) },
      media: { nodes: p.media.map((m) => ({ id: m.id, alt: m.alt, mediaContentType: "IMAGE", status: m.status, preview: { image: { url: m.url } } })) },
      collections: { nodes: collections.filter((c) => c.products.includes(p.id)).map((c) => ({ id: c.id, title: c.title })) } };
  }
  const ok = (name, extra = {}) => ({ [name]: { userErrors: [], ...extra } });
  const no = (name, message) => ({ [name]: { userErrors: [{ field: null, message }] } });

  function run(op, v) {
    const r = refuse.find((x) => x.op === op);
    if (r) { if (r.once) refuse.splice(refuse.indexOf(r), 1); return r.errors ? { errors: r.errors } : { data: no(r.payload, r.message) }; }
    log.push(op);
    switch (op) {
      case "List": { const pg = page([...products].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), v.after, 100); return { data: { products: { nodes: pg.nodes.map(listed), pageInfo: pg.pageInfo }, collections: { nodes: collections.map(colOut) }, shop: { currencyCode: "GBP" } } }; }
      case "One": { const p = findProduct(v.id); return { data: { product: p ? full(p) : null, collections: { nodes: collections.map(colOut) }, locations: { nodes: locations } } }; }
      case "Up": {
        const p = findProduct(v.product.id); if (!p) return { data: no("productUpdate", "Product does not exist") };
        const u = v.product;
        if (u.title != null) p.title = u.title; if (u.descriptionHtml != null) p.descriptionHtml = u.descriptionHtml; if (u.status) p.status = u.status;
        if ("templateSuffix" in u) p.templateSuffix = u.templateSuffix; if (u.seo) p.seo = { title: u.seo.title || null, description: u.seo.description || null };
        p.updatedAt = tick(); return { data: ok("productUpdate", { product: { id: p.id, updatedAt: p.updatedAt } }) };
      }
      case "Vs": {
        const p = findProduct(v.productId); if (!p) return { data: no("productVariantsBulkUpdate", "Product does not exist") };
        for (const x of v.variants) {
          const vv = p.variants.find((y) => y.id === x.id); if (!vv) return { data: no("productVariantsBulkUpdate", "Product variant does not exist") };
          if (x.price != null) vv.price = money(x.price); if ("compareAtPrice" in x) vv.compareAtPrice = money(x.compareAtPrice); if (x.inventoryItem && "sku" in x.inventoryItem) vv.sku = x.inventoryItem.sku;
        }
        p.updatedAt = tick(); return { data: ok("productVariantsBulkUpdate", { productVariants: v.variants.map((x) => ({ id: x.id })) }) };
      }
      case "Stock": {
        if (!v.key) return { errors: [{ message: "The @idempotent directive is required for this mutation." }] };
        for (const q of v.input.quantities) {
          if (!("changeFromQuantity" in q)) return { errors: [{ message: "changeFromQuantity is required" }] };
          const hit = products.flatMap((p) => p.variants).find((x) => x.item.id === q.inventoryItemId);
          const cur = hit ? hit.item.levels[q.locationId] || 0 : null;
          if (hit && q.changeFromQuantity != null && cur !== q.changeFromQuantity) return { data: { inventorySetQuantities: { userErrors: [{ code: "CHANGE_FROM_QUANTITY_STALE", field: null, message: "The quantity has changed" }] } } };
        }
        for (const q of v.input.quantities) { const hit = products.flatMap((p) => p.variants).find((x) => x.item.id === q.inventoryItemId); hit.item.levels[q.locationId] = q.quantity; }
        return { data: ok("inventorySetQuantities", { inventoryAdjustmentGroup: { reason: "correction" } }) };
      }
      case "Add": case "Remove": {
        const c = collections.find((x) => x.id === v.id), name = op === "Add" ? "collectionAddProducts" : "collectionRemoveProducts";
        if (!c) return { data: no(name, "Collection does not exist") };
        if (c.ruleSet) return { data: no(name, "Can't manually add products to a smart collection") };
        for (const id of v.productIds) { if (op === "Add" && !c.products.includes(id)) c.products.push(id); if (op === "Remove") c.products = c.products.filter((x) => x !== id); }
        return { data: ok(name) };
      }
      case "Alt": { for (const f of v.files) for (const p of products) { const m = p.media.find((x) => x.id === f.id); if (m) m.alt = f.alt; } return { data: ok("fileUpdate", { files: v.files.map((f) => ({ id: f.id })) }) }; }
      case "Order": { const p = findProduct(v.id); const by = Object.fromEntries(p.media.map((m) => [m.id, m])); p.media = v.moves.slice().sort((a, b) => Number(a.newPosition) - Number(b.newPosition)).map((m) => by[m.id]); return { data: { productReorderMedia: { job: { id: "j" }, mediaUserErrors: [] } } }; }
      case "All": { const all = products.flatMap((p) => p.variants.map((x) => ({ id: x.id, title: x.title, price: x.price, compareAtPrice: x.compareAtPrice, selectedOptions: x.selectedOptions, product: { id: p.id, title: p.title, status: p.status } }))); const pg = page(all, v.after, 250); return { data: { productVariants: pg } }; }
      case "In": { const c = collections.find((x) => x.id === v.id); if (!c) return { data: { collection: null } }; const pg = page(c.products.map((id) => ({ id })), v.after, 250); return { data: { collection: { title: c.title, products: pg } } }; }
      case "Now": case "V": return { data: { nodes: v.ids.map((id) => { const h = findVariant(id); return h ? { id, price: h.v.price, compareAtPrice: h.v.compareAtPrice, sku: h.v.sku, product: { id: h.p.id } } : null; }) } };
      case "Dup": { const src = findProduct(v.productId); if (!src) return { data: no("productDuplicate", "Product does not exist") }; const copy = JSON.parse(JSON.stringify(src)); copy.id = gid("Product"); copy.title = v.newTitle; copy.status = "DRAFT"; copy.handle = v.newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-"); copy.variants.forEach((x) => { x.id = gid("ProductVariant"); x.item.id = gid("InventoryItem"); }); copy.media.forEach((m) => { m.id = gid("MediaImage"); }); copy.updatedAt = tick(); products.push(copy); return { data: ok("productDuplicate", { newProduct: { id: copy.id, title: copy.title } }) }; }
      case "New": { const p = { id: gid("Product"), title: v.product.title, handle: v.product.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), status: v.product.status, descriptionHtml: "", templateSuffix: null, updatedAt: tick(), seo: { title: null, description: null }, options: [{ name: "Title", values: ["Default Title"] }], variants: [{ id: gid("ProductVariant"), title: "Default Title", price: "0.00", compareAtPrice: null, sku: "", selectedOptions: [{ name: "Title", value: "Default Title" }], item: { id: gid("InventoryItem"), tracked: false, levels: {} } }], media: [] }; products.push(p); return { data: ok("productCreate", { product: { id: p.id, title: p.title } }) }; }
      case "Stage": { const f = v.input[0]; return { data: ok("stagedUploadsCreate", { stagedTargets: [{ url: "https://shopify-staged-uploads.storage.googleapis.com/", resourceUrl: "https://shopify-staged-uploads.storage.googleapis.com/tmp/" + f.filename, parameters: [{ name: "key", value: "tmp/" + f.filename }, { name: "policy", value: "p" }] }] }) }; }
      case "Media": { const p = findProduct(v.product.id); for (const m of v.media || []) { if (!uploads.some((u) => m.originalSource.endsWith(u.key))) return { data: no("productUpdate", "Staged file not found") }; p.media.push({ id: gid("MediaImage"), alt: m.alt, status: "READY", url: m.originalSource }); } p.updatedAt = tick(); return { data: ok("productUpdate", { product: { id: p.id } }) }; }
    }
    return { errors: [{ message: "Unknown operation " + op }] };
  }
  async function fetch(url, init = {}) {
    url = String(url);
    if (url.startsWith("https://shopify-staged-uploads.storage.googleapis.com/")) {
      const form = init.body; const k = form && form.get ? form.get("key") : ""; const file = form && form.get ? form.get("file") : null;
      if (!k || !file) return new Response("", { status: 400 });
      uploads.push({ key: k, size: file.size, type: file.type }); return new Response(null, { status: 204 });
    }
    const oauth = url.match(/^https:\/\/([a-z0-9-]+)\.myshopify\.com\/admin\/oauth\/access_token$/);
    if (oauth) {
      const f = new URLSearchParams(String(init.body || ""));
      if (oauth[1] !== store || f.get("grant_type") !== "client_credentials" || !client || f.get("client_id") !== client.id || f.get("client_secret") !== client.secret) return new Response(JSON.stringify({ error: "invalid_client", error_description: "Client authentication failed" }), { status: 400 });
      issued++; key = "shpca_" + issued; return new Response(JSON.stringify({ access_token: key, scope: "write_products", expires_in: 86399 }));
    }
    const m = url.match(/^https:\/\/([a-z0-9-]+)\.myshopify\.com\/admin\/api\/(\d{4}-\d{2})\/graphql\.json$/);
    if (!m || m[1] !== store) return new Response(JSON.stringify({ errors: "Not Found" }), { status: 404 });
    if (!key || init.headers["X-Shopify-Access-Token"] !== key) return new Response(JSON.stringify({ errors: "[API] Invalid API key or access token (unrecognized login or wrong password)" }), { status: 401 });
    const body = JSON.parse(init.body), op = (String(body.query).match(/^\s*(?:query|mutation)\s+(\w+)/) || [])[1];
    if (op === "Stock" && !/@idempotent\(key: \$key\)/.test(body.query)) return new Response(JSON.stringify({ errors: [{ message: "@idempotent missing" }] }));
    return new Response(JSON.stringify(run(op, body.variables || {})));
  }
  return { fetch, handles: (url) => /\.myshopify\.com\/admin\/(api|oauth)\//.test(String(url)) || String(url).startsWith("https://shopify-staged-uploads.storage.googleapis.com/"),
    products, collections, locations, log, uploads, refuse, setKey(k) { key = k; }, setClient(c) { client = c; }, get issued() { return issued; }, expire() { key = "gone"; }, findProduct, findVariant, total };
}
