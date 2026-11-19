// Makes a site template's data files from a live site: the same pages and sections in the same
// order, with every word swapped for a placeholder in square brackets, and nothing of the site's
// own content (articles, artists, figures, photos, logos, email addresses).
//   node tests/tools/make-template.mjs street-art-dispatch
// The template's design code (assets/, tools/) is copied by hand once and kept in templates/<id>/.
import fs from "node:fs";
import { C_DIR, sadDir } from "../where.mjs";
globalThis.Deno = { env: { get: () => "" }, serve() {} };
const h = await import(new URL("../home.mjs", import.meta.url));

const id = process.argv[2] || "street-art-dispatch";
const dirs = { "street-art-dispatch": sadDir() };
const SRC = dirs[id], OUT = C_DIR + "/templates/" + id;
if (!SRC) { console.error("No template is made from " + id + " yet."); process.exit(1); }
const site = h.SITES.find((s) => s.id === id), kinds = site.sectionKinds;
// words that belong to the original site, never carried into a template
const OWN = new RegExp([site.name, site.domain, "Grove", "Konn", "Artiscope", "@"].map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).concat(id === "street-art-dispatch" ? ["\\bDispatch\\b"] : []).join("|"), "i");
const words = (v) => String(v).replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length;
const short = (v, n) => typeof v === "string" && v.trim() && words(v) <= n && !OWN.test(v);
const label = (f) => "[" + String(f.label || f.name).replace(/\.$/, "") + "]";
const SPECIAL = { search_hint: "[Words in the empty search box]", name: "[Site name]", tagline: "[A short line about the site]", legal: "[Small print, such as the year and the site's name]", photo: "[What the opening photo shows]" };

// an address to one of the template's own kinds of page stays; one to an article, an artist or another site goes
function keepAddr(v) { v = String(v || ""); return /^(\.\/|#[\w-]*|[a-z0-9-]+\/(#[\w-]*)?)$/.test(v) ? v : ""; }
function placeholder(f, v) {
  if (v == null) return v;
  if (f.type === "image" || f.type === "video") return "";
  if (f.type === "artists") return [];
  if (f.type === "which") return Array.isArray(v) ? [] : v;
  if (f.type === "lines") return Array.isArray(v) && v.length ? [label(f)] : [];
  if (f.type === "rows") {
    const rows = Array.isArray(v) ? v : [];
    // a menu's links: the words name a kind of page, so short ones stay; addresses inside the site stay
    if (rows.every((r) => Array.isArray(r))) return rows.map((r) => [short(r[0], 3) ? r[0] : "[Link]", keepAddr(r[1])]);
    return rows.slice(0, 2).map((r) => { const o = {}; for (const g of f.fields || []) if (g.name in (r || {})) o[g.name] = placeholder(g, r[g.name]); return o; });
  }
  if (f.type !== "text" && f.type !== "long") return v;
  if (typeof v !== "string" || !v.trim()) return v;
  if (/href$|_href|^href$|^map$/.test(f.name) || f.addr) return keepAddr(v);
  if (SPECIAL[f.name]) return SPECIAL[f.name];
  if (/anchor$/.test(f.name)) return /^[a-z0-9-]+$/.test(v) ? v : "";
  if (/^\[.*\]$/.test(v.trim())) return v;
  return short(v, 4) ? "[" + v.trim().replace(/\.$/, "") + "]" : label(f);
}
function settingsOf(kind, st) {
  const k = kinds[kind]; if (!k) return {};
  const out = {};
  for (const f of k.fields || []) if (st && f.name in st) out[f.name] = placeholder(f, st[f.name]);
  return out;
}
const pages = JSON.parse(fs.readFileSync(SRC + "/" + site.pages.file, "utf8"));
const doc = { _how_to_edit: "This file is edited in Artiscope Digital Home. Each page is a list of sections; words in square brackets are placeholders waiting for real words.", shared: {}, pages: {} };
for (const [k, part] of Object.entries(pages.shared || {})) doc.shared[k] = { type: part.type, visible: part.visible !== false, settings: settingsOf(part.type, part.settings) };
for (const [k, pg] of Object.entries(pages.pages || {})) {
  const t = String(pg.title || "").split(" | ")[0].trim();
  doc.pages[k] = { path: pg.path, title: k === "home" ? "[Site name]" : short(t, 3) ? t : "[" + k.replace(/-/g, " ") + "]", description: "[One or two sentences about this page, for search results]",
    ...(pg.home ? { home: true } : {}), sections: (pg.sections || []).map((s) => ({ id: s.id, type: s.type, visible: s.visible !== false, settings: settingsOf(s.type, s.settings) })) };
}
doc.groups = { top: [], popups: [], bottom: [] }; doc.addons = {};
const theme = JSON.parse(fs.readFileSync(SRC + "/data/theme.json", "utf8"));
const content = { site: { email: "info@grovegallery.com", address: "https://example.org/", indexed: false } };
if (id === "street-art-dispatch") Object.assign(content, { desk: "[Writer or desk name]", date: "[Month and year]", features: [], columns: [], artists: [], artist_notes: {}, archive: [], exhibitions: [], stats: [], glossary: [], photos: {}, artist_photos: {}, photo_files: {}, artist_photo_files: {} });
const check = JSON.stringify({ ...doc, _how_to_edit: "" }), left = check.match(OWN);
if (left) { console.error("A word of the original site is still in the pages: " + check.slice(Math.max(0, left.index - 120), left.index + 40)); process.exit(1); }
fs.mkdirSync(OUT + "/data", { recursive: true });
const put = (p, v) => fs.writeFileSync(OUT + "/data/" + p, JSON.stringify(v, null, 2) + "\n");
put("pages.json", doc); put("theme.json", { colours: theme.colours, fonts: theme.fonts, css: theme.css, font_links: theme.font_links }); put("content.json", content); put("files.json", { files: {} });
console.log("Wrote the " + site.name + " template's data files");
