// Sample mode, World Art Review: assets/demo-site.json and the sample pages in assets/app.js.
import { W_DIR, G_DIR, C_DIR } from "../where.mjs";
import fs from "node:fs";
globalThis.Deno = { env: { get: () => "" }, serve() {} };
const m = await import(new URL("../home.mjs", import.meta.url));
const war = JSON.parse(fs.readFileSync((W_DIR + "/content/site.json"), "utf8"));
const W = m.SITES[0];
const lists = Object.fromEntries(Object.entries(W.lists).map(([k, l]) => [k, { label: l.label, section: l.section || "" }]));
const pages0 = JSON.parse(fs.readFileSync((W_DIR + "/content/pages.json"), "utf8"));
const LF = m.SITES[0].sectionKinds.text.fields.slice(0, 2);
fs.writeFileSync((C_DIR + "/assets/demo-site.json"), JSON.stringify({ site: m.siteForEditor(war), itemKinds: W.items, lists, pageLists: m.cleanPages(W, pages0, pages0).lists, listFields: m.LIST_FIELDS }));
// kinds and spots in app.js, as before
const kinds = {};
for (const [k, v] of Object.entries(W.sectionKinds)) { kinds[k] = { label: v.label, about: v.about || "", fields: v.fields, library: v.library || "", starter: v.starter || null }; if (v.blocks) kinds[k].blocks = m.blockKinds(v.blocks); }
const p = (C_DIR + "/assets/app.js"); let s = fs.readFileSync(p, "utf8");
s = s.replace(/  var demoKinds = .*;\n/, () => "  var demoKinds = " + JSON.stringify(kinds) + ";\n");
fs.writeFileSync(p, s);
const pages = JSON.parse(fs.readFileSync((W_DIR + "/content/pages.json"), "utf8"));
console.log("ok", fs.statSync((C_DIR + "/assets/demo-site.json")).size, JSON.stringify(m.cleanPages(W, pages, pages).lists).length);
{
  const p2 = (C_DIR + "/assets/app.js"); let s2 = fs.readFileSync(p2, "utf8");
  const cur = JSON.parse(fs.readFileSync((W_DIR + "/content/pages.json"), "utf8"));
  s2 = s2.replace(/  var demoPages = .*;\n/, () => "  var demoPages = " + JSON.stringify(m.cleanPages(W, cur, cur)) + ";\n");
  fs.writeFileSync(p2, s2); console.log("demo pages refreshed");
}
