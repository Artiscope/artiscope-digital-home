// Sample mode, the practice build: assets/demo-starter.json, the starter (starter/ in this repository) as the page editor opens it.
import { C_DIR } from "../where.mjs";
import fs from "node:fs";
globalThis.Deno = { env: { get: () => "" }, serve() {} };
const m = await import(new URL("../home.mjs", import.meta.url));
const dir = C_DIR + "/starter";
const read = (p) => JSON.parse(fs.readFileSync(dir + "/" + p, "utf8"));
const S = m.SITES.find((s) => s.id === "practice-build"), kinds = {};
for (const [k, v] of Object.entries(S.sectionKinds)) { kinds[k] = { label: v.label, about: v.about || "", fields: v.fields, library: v.library || "", starter: v.starter || null }; if (v.blocks) kinds[k].blocks = m.blockKinds(v.blocks); if (v.popup) kinds[k].popup = true; }
const content = read("data/content.json"); content.site.address = "https://artiscope.github.io/practice-build/";
const E = m.starterForEditor(content), pages = read("data/pages.json");
const doc = m.cleanPages({ ...S, artists: [], articleSlugs: [] }, pages, pages), summaries = {};
for (const [k, part] of Object.entries(doc.shared)) summaries["shared:" + k] = S.sectionKinds[part.type].summary ? String(S.sectionKinds[part.type].summary(part.settings)) : "";
for (const [k, pg] of Object.entries(doc.pages)) for (const sec of pg.sections) summaries[k + ":" + sec.id] = S.sectionKinds[sec.type].summary ? String(S.sectionKinds[sec.type].summary(sec.settings || {})) : "";
fs.writeFileSync(C_DIR + "/assets/demo-starter.json", JSON.stringify({ addonSpec: m.ADDONS.map((a) => ({ id: a.id, label: a.label, about: a.about, icon: a.icon, fields: a.fields })), pages: doc, kinds, summaries, images: [], imageMeta: {}, pictures: [], artists: [], site: E, itemKinds: S.items, lists: {}, listFields: [], gam: true, model: "starter", builtIn: S.builtIn,
    pageFields: [{ name: "title", label: "Title in the browser tab and search results", type: "text" }, { name: "description", label: "Description for search engines", type: "long", plain: true, hint: "One or two sentences. Not shown on the page." }] }));
console.log("Wrote the practice build sample");

// Sample mode, Start building: assets/demo-build.json, every starting choice planned by the server's own code.
{
  const c0 = m.cleanBuild({ name: "", pages: "home" }, { name: "Site 4" }), plans = {}, themes = {};
  const local = { "world-art-review": "world-art-review", "global-art-monitor": "global-art-monitor", "street-art-dispatch": "street-art-dispatch" };
  const { W_DIR, G_DIR, sadDir } = await import("../where.mjs");
  const dirs = { "world-art-review": W_DIR, "global-art-monitor": G_DIR, "street-art-dispatch": sadDir() };
  for (const key of ["home", "set", ...Object.keys(local).map((id) => "copy:" + id)]) {
    const [pages, from] = key.split(":");
    let copied = null;
    if (from) { const site = m.SITES.find((x) => x.id === from); copied = m.copyLayout(JSON.parse(fs.readFileSync(dirs[from] + "/" + site.pages.file, "utf8")), site); }
    const p = m.planFiles({ ...c0, name: "", tagline: "", pages, from }, "https://artiscope.github.io/site-4/", copied);
    plans[key] = { pages: p.pages, notes: p.notes };
  }
  for (const l of m.buildLooks()) themes[l.name] = m.planFiles({ ...c0, look: l.name }, "", null).theme;
  fs.writeFileSync(C_DIR + "/assets/demo-build.json", JSON.stringify({ spec: m.buildSpec(), plans, themes }));
  console.log("Wrote the Start building sample");
}
