// Sample mode, Street Art Dispatch: assets/demo-sad.json, the site as the page editor opens it.
import { sadDir, C_DIR } from "../where.mjs";
import fs from "node:fs";
globalThis.Deno = { env: { get: () => "" }, serve() {} };
const m = await import(new URL("../home.mjs", import.meta.url));
let dir = null; try { dir = sadDir(); } catch (e) { console.log("Street Art Dispatch not found, its sample was left as it was. " + e.message); }
if (dir) {
  const read = (p) => JSON.parse(fs.readFileSync(dir + "/" + p, "utf8"));
  const S = m.SITES.find((s) => s.id === "street-art-dispatch"), kinds = {};
  for (const [k, v] of Object.entries(S.sectionKinds)) { kinds[k] = { label: v.label, about: v.about || "", fields: v.fields, library: v.library || "", starter: v.starter || null }; if (v.blocks) kinds[k].blocks = m.blockKinds(v.blocks); }
  const E = m.sadForEditor(read("data/content.json")), pages = read("data/pages.json");
  const ctx = { ...S, artists: E.artists.map((a) => ({ slug: a.slug })), articleSlugs: E.articles.map((a) => a.slug) };
  const doc = m.cleanPages(ctx, pages, pages), summaries = {};
  for (const [k, part] of Object.entries(doc.shared)) summaries["shared:" + k] = S.sectionKinds[part.type].summary ? String(S.sectionKinds[part.type].summary(part.settings)) : "";
  for (const [k, pg] of Object.entries(doc.pages)) for (const sec of pg.sections) summaries[k + ":" + sec.id] = S.sectionKinds[sec.type].summary ? String(S.sectionKinds[sec.type].summary(sec.settings || {})) : "";
  const images = fs.existsSync(dir + "/assets/images") ? fs.readdirSync(dir + "/assets/images") : [];
  fs.writeFileSync(C_DIR + "/assets/demo-sad.json", JSON.stringify({ pages: doc, kinds, summaries, images, imageMeta: {}, pictures: [], artists: E.artists.map((a) => ({ slug: a.slug, name: a.name })), site: E, itemKinds: S.items, lists: {}, listFields: [], gam: true, model: "sad", builtIn: S.builtIn,
    pageFields: [{ name: "title", label: "Title in the browser tab and search results", type: "text" }, { name: "description", label: "Description for search engines", type: "long", plain: true, hint: "One or two sentences. Not shown on the page." }] }));
}
