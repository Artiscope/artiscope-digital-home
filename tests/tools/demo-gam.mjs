// Sample mode, Global Art Monitor: assets/demo-gam.json.
import { W_DIR, G_DIR, C_DIR } from "../where.mjs";
import fs from "node:fs";
globalThis.Deno = { env: { get: () => "" }, serve() {} };
const m = await import(new URL("../home.mjs", import.meta.url));
const G = (G_DIR + "/"), read = (p) => JSON.parse(fs.readFileSync(G + p, "utf8"));
const S = m.SITES[1], kinds = {};
for (const [k, v] of Object.entries(S.sectionKinds)) { kinds[k] = { label: v.label, about: v.about || "", fields: v.fields, library: v.library || "", starter: v.starter || null }; if (v.blocks) kinds[k].blocks = m.blockKinds(v.blocks); }
const E = m.gamForEditor(read("data/content.json"), read("data/sales.json"), read("data/images.json"), fs.readdirSync(G + "assets/images"));
const pages = read("data/pages.json"), ctx = { ...S, artists: E.artists.map((a) => ({ slug: a.slug })), articleSlugs: E.articles.map((a) => a.slug) };
const doc = m.cleanPages(ctx, pages, pages);
const summaries = {};
for (const [k, part] of Object.entries(doc.shared)) summaries["shared:" + k] = S.sectionKinds[part.type].summary ? String(S.sectionKinds[part.type].summary(part.settings)) : "";
for (const [k, pg] of Object.entries(doc.pages)) for (const sec of pg.sections) summaries[k + ":" + sec.id] = S.sectionKinds[sec.type].summary ? String(S.sectionKinds[sec.type].summary(sec.settings || {})) : "";
fs.writeFileSync((C_DIR + "/assets/demo-gam.json"), JSON.stringify({ pages: doc, kinds, summaries, images: fs.readdirSync(G + "assets/images"), imageMeta: {}, pictures: [], artists: E.artists.map((a) => ({ slug: a.slug, name: a.name })), site: E, itemKinds: S.items, lists: {}, listFields: [], gam: true,
  pageFields: [{ name: "title", label: "Title in the browser tab and search results", type: "text" }, { name: "description", label: "Description for search engines", type: "long", plain: true, hint: "One or two sentences. Not shown on the page." }] }));
console.log("ok", fs.statSync((C_DIR + "/assets/demo-gam.json")).size);
