// Makes a site template's data files from a live site: the same pages and sections in the same
// order, with every word swapped for a placeholder in square brackets, and nothing of the site's
// own content (articles, artists, figures, photos, logos, email addresses).
//   node tests/tools/make-template.mjs street-art-dispatch
// The template's design code (assets/, tools/) is copied by hand once and kept in templates/<id>/.
import fs from "node:fs";
import { C_DIR, G_DIR, W_DIR, sadDir } from "../where.mjs";
globalThis.Deno = { env: { get: () => "" }, serve() {} };
const h = await import(new URL("../home.mjs", import.meta.url));

const id = process.argv[2] || "street-art-dispatch";
const dirs = { "street-art-dispatch": sadDir(), "global-art-monitor": G_DIR, "world-art-review": W_DIR };
const SRC = dirs[id], OUT = C_DIR + "/templates/" + id;
if (!SRC) { console.error("No template is made from " + id + " yet."); process.exit(1); }
const site = h.SITES.find((s) => s.id === id), kinds = site.sectionKinds;
// words that belong to the original site, never carried into a template
const OWN = new RegExp([site.name, site.domain, "Grove", "Konn", "Zara", "Artiscope"].map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).concat(["[\\w.-]+@[\\w-]+\\.[a-z]"]).concat(id === "street-art-dispatch" ? ["\\bDispatch\\b"] : id === "global-art-monitor" ? ["\\bMonitor\\b", "Tate Ward", "market note"] : id === "world-art-review" ? ["Malala", "Frieze", "Alexandra"] : []).join("|"), "i");
const words = (v) => String(v).replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length;
const short = (v, n) => typeof v === "string" && v.trim() && words(v) <= n && !OWN.test(v);
const label = (f) => "[" + String(f.label || f.name).replace(/\.$/, "") + "]";
const SPECIAL = { watermark: "", search_hint: "[Words in the empty search box]", tagline: "[A short line about the site]", legal: "[Small print, such as the year and the site's name]", photo: "[What the opening photo shows]" };

// an address to one of the template's own kinds of page stays; one to an article, an artist or another site goes
function keepAddr(v) { v = String(v || ""); return /^(\.\/|#[\w-]*|[a-z0-9-]+\/(#[\w-]*)?)$/.test(v) && !/^#(a|artist)-/.test(v) ? v : ""; }
function placeholder(f, v) {
  if (v == null) return v;
  if (f.type === "image" || f.type === "video") return "";
  if (f.type === "artists") return Array.isArray(v) ? [] : "";
  if (f.type === "pair") return Array.isArray(v) ? [short(v[0], 5) ? "[" + v[0] + "]" : "[Link]", keepAddr(v[1])] : v;
  if (f.type === "which") return Array.isArray(v) ? [] : v;
  if (f.type === "lines") {
    const list = (Array.isArray(v) ? v : []).filter((x) => typeof x === "string");
    if (!list.length || list.every((x) => /^[a-z0-9-]+$/.test(x))) return [];   // names of articles or artists: none in a template
    // a heading set over several lines keeps its lines, with one pair of brackets around the whole
    if (f.name === "heading") return list.every((x) => short(x, 4)) ? list.map((x, i) => (i ? "" : "[") + x.trim() + (i === list.length - 1 ? "]" : "")) : [label(f)];
    // long passages become one placeholder, however many there were
    return list.map((x) => short(x, 4) ? "[" + x.trim() + "]" : f.name === "labels" ? "[Label]" : label(f)).filter((x, i, all) => x !== label(f) || all.indexOf(x) === i);
  }
  if (f.type === "rows") {
    const rows = Array.isArray(v) ? v : [];
    // a menu's links: the words name a kind of page, so short ones stay; addresses inside the site stay
    // a menu's links name kinds of page, so short ones stay as they are; other buttons and links go in brackets
    const menu = ["links", "menu_extra", "about_links", "nav_extra"].includes(f.name);
    // a link to one of the original's articles or artists, or to its email, is left out
    if (rows.every((r) => Array.isArray(r))) return rows.filter((r) => !String(r[1] || "") || keepAddr(r[1])).map((r) => [menu && short(r[0], 4) ? r[0] : short(r[0], 4) ? "[" + String(r[0]).trim() + "]" : "[Link]", keepAddr(r[1]), ...r.slice(2)]);
    return rows.slice(0, 4).map((r) => { const o = {}; for (const g of f.fields || []) if (g.name in (r || {})) o[g.name] = placeholder(g, r[g.name]); return o; });
  }
  if (f.type !== "text" && f.type !== "long") return v;
  if (typeof v !== "string" || !v.trim()) return v;
  if (/href$|_href|^href$|^map$/.test(f.name) || f.addr) return keepAddr(v);
  if (f.name === "copyright") return SPECIAL.legal;
  if (f.name === "unit") return v;   // a word put after a count, such as portfolio: it names a kind of page
  if (f.name === "legal" && /\{disclosure\}/.test(v)) return "{disclosure} " + SPECIAL.legal;
  if (f.name in SPECIAL) return SPECIAL[f.name];
  if (/anchor$/.test(f.name)) return /^[a-z0-9-]+$/.test(v) ? v : "";
  if (/^\[.*\]$/.test(v.trim()) || /^\{[a-z]+\}$/.test(v.trim()) || /^\d{1,3}$/.test(v.trim())) return v;
  return short(v, 4) ? "[" + v.trim().replace(/\.$/, "") + "]" : label(f);
}
const BY_HAND = {
  "world-art-review": {
    "standards:text": { body: "<h2>[A rule you follow]</h2>\n<p>[A sentence or two on it]</p>\n<h2>[Another rule]</h2>\n<p>[A sentence or two on it]</p>\n<h2>[Who publishes this site]</h2>\n<p>[Who publishes the site, and any interest it has in the artists it covers]</p>\n<h2>[Corrections]</h2>\n<p>[How to send a correction]</p>\n<h2>[Privacy and terms]</h2>\n<p>[The privacy notice and terms of use]</p>" },
  },
  "global-art-monitor": {
    "about:text": { html: '<h2 id="disclosure" style="margin-top:0">[Who publishes this]</h2>\n<p>{disclosure}</p>\n<p>[A paragraph on how you handle that interest]</p>\n\n' +
      '<h2 id="method">[Method]</h2>\n<p>[How you record a sale]</p>\n<ul>\n<li><strong>[First rule.]</strong> [A sentence on it]</li>\n<li><strong>[Second rule.]</strong> [A sentence on it]</li>\n</ul>\n\n' +
      '<h2 id="sources">[Sources]</h2>\n<p>[Where your figures come from]</p>\n\n<h2 id="corrections">[Corrections]</h2>\n<p>[How to send a correction to] <a href="mailto:{email}?subject=Correction">{email}</a>.</p>\n\n' +
      '<h2 id="newsletter">[The mailing list]</h2>\n<p>[What the list sends, and how often. To join, email] <a href="mailto:{email}?subject=Subscribe">{email}</a>.</p>\n\n' +
      '<h2 id="contact">[Contact]</h2>\n<p>[For anything else, use the] <a href="@@contact/">[contact page]</a>.</p>\n\n<h2 id="advice">[Not advice]</h2>\n<p>[A sentence saying the site is not advice]</p>',
      aside: '<div class="mini"><h2>[On this page]</h2><ul><li><a href="#disclosure">[Who publishes this]</a></li><li><a href="#method">[Method]</a></li><li><a href="#sources">[Sources]</a></li><li><a href="#corrections">[Corrections]</a></li><li><a href="#newsletter">[The mailing list]</a></li><li><a href="@@contact/">[Contact]</a></li></ul></div>\n<div class="mini"><h2>[Last updated]</h2><p>{published}</p></div>' },
    "contact:form": { html: '<form class="form" id="contact-form" data-email="{email}" data-reveal>\n<div class="field"><label for="cf-name">Your name</label><input id="cf-name" name="name" type="text" autocomplete="name" required></div>\n' +
      '<div class="field"><label for="cf-email">Your email</label><input id="cf-email" name="email" type="email" autocomplete="email" required></div>\n<div class="field"><label for="cf-topic">What is it about?</label>\n<select id="cf-topic" name="topic">\n<option>[General question]</option>\n<option>[Correction]</option>\n<option>[Something else]</option>\n</select></div>\n' +
      '<div class="field"><label for="cf-message">Your message</label><textarea id="cf-message" name="message" rows="7" required></textarea></div>\n<div class="form-foot"><button class="pill pill-ink" type="submit">[Send your message]</button>\n<p class="quiet" id="contact-status" role="status">This opens your email app with the message ready to send.</p></div>\n' +
      '<noscript><p class="quiet">This form needs scripts switched on. You can also write to {email}.</p></noscript>\n</form>',
      aside: '<div class="mini"><h2>[Email us directly]</h2><p><a href="mailto:{email}">{email}</a></p></div>\n<div class="mini"><h2>[A heading]</h2><p>[A line of help for people writing in]</p></div>' },
  },
};
function settingsOf(kind, st) {
  const k = kinds[kind]; if (!k) return {};
  const out = {};
  for (const f of k.fields || []) if (st && f.name in st) out[f.name] = placeholder(f, st[f.name]);
  if (["header", "opening"].includes(kind) && "name" in out) out.name = "[Site name]";
  return out;
}
const pages = JSON.parse(fs.readFileSync(SRC + "/" + site.pages.file, "utf8"));
const doc = { _how_to_edit: "This file is edited in Artiscope Digital Home. Each page is a list of sections; words in square brackets are placeholders waiting for real words.", shared: {}, pages: {} };
for (const [k, part] of Object.entries(pages.shared || {})) doc.shared[k] = { type: part.type, visible: part.visible !== false, settings: settingsOf(part.type, part.settings) };
for (const [k, pg] of Object.entries(pages.pages || {})) {
  const t = String(pg.title || "").split(" | ")[0].split(":")[0].trim();
  doc.pages[k] = { path: pg.path, title: k === "home" ? "[Site name]" : short(t, 4) ? t : "[" + k.replace(/-/g, " ") + "]", description: "[One or two sentences about this page, for search results]",
    ...(pg.home ? { home: true } : {}), ...Object.fromEntries(["current", "intro", "own"].filter((x) => x in pg).map((x) => [x, pg[x]])), sections: (pg.sections || []).map((s) => ({ id: s.id, type: s.type, visible: s.visible !== false, settings: { ...settingsOf(s.type, s.settings), ...(((BY_HAND[id] || {})[k + ":" + s.id]) || {}) } })) };
}
doc.groups = { top: [], popups: [], bottom: [] }; doc.addons = {};
const DATA = id === "world-art-review" ? "content" : "data";
const theme = JSON.parse(fs.readFileSync(SRC + "/" + DATA + "/theme.json", "utf8"));
const content = { site: { email: "info@grovegallery.com", address: "https://example.org/", indexed: false } };
if (id === "world-art-review") {
  Object.assign(content, { sources: {}, artists: [], articles: [], guides: [] });
  doc.templates = { article: { default: { name: "Default article", sections: [{ id: "main", type: "main" }] } }, artist: { default: { name: "Default artist portfolio", sections: [{ id: "main", type: "main" }] } } };
  doc.assign = { article: {}, artist: {} }; doc.addons = JSON.parse(JSON.stringify(pages.addons || {}));
  // the list pages the site draws itself: their small line, heading and introduction
  doc.lists = Object.fromEntries(Object.entries(pages.lists || {}).map(([k, l]) => [k, { eyebrow: short(l.eyebrow, 4) ? "[" + l.eyebrow + "]" : "[Small line]", heading: placeholder({ name: "heading", type: "lines", label: "Heading" }, l.heading), intro: "[A line about this page]" }]));
}
const extra = {};
if (id === "global-art-monitor") {
  const c0 = JSON.parse(fs.readFileSync(SRC + "/data/content.json", "utf8"));
  Object.assign(content, { published: "", published_text: "[Date of the latest update]",
    site: { name: "[Site name]", tagline: "[A short line about the site]", headline: "[Your opening heading]", intro: "[A sentence or two that says what the site is for]",
      email: "info@grovegallery.com", disclosure: "[Who publishes this site, and any interest it has in the artists it covers]", address: "https://example.org/", indexed: false },
    // the sections in the menu bar keep their places and names; what each is about is a placeholder
    sections: (c0.sections || []).map((x) => [x[0], x[1], "[A line about this section]"]), bios: {}, features: [], glossary: [] });
  extra["sales.json"] = { _how_to_edit: "Every public sale, one entry each, with its source. Edited in Artiscope Digital Home.", artists: {}, sales: [] };
  extra["images.json"] = {};
}
if (id === "street-art-dispatch") Object.assign(content, { desk: "[Writer or desk name]", date: "[Month and year]", features: [], columns: [], artists: [], artist_notes: {}, archive: [], exhibitions: [], stats: [], glossary: [], photos: {}, artist_photos: {}, photo_files: {}, artist_photo_files: {} });
const check = JSON.stringify({ ...doc, _how_to_edit: "" }), left = check.match(OWN);
if (left) { console.error("A word of the original site is still in the pages: " + check.slice(Math.max(0, left.index - 120), left.index + 40)); process.exit(1); }
fs.mkdirSync(OUT + "/" + DATA, { recursive: true });
const put = (p, v) => fs.writeFileSync(OUT + "/" + DATA + "/" + p, JSON.stringify(v, null, 2) + "\n");
put("pages.json", doc); for (const [f, v] of Object.entries(extra)) put(f, v); put("theme.json", { colours: theme.colours, fonts: theme.fonts, css: theme.css, font_links: theme.font_links }); put(id === "world-art-review" ? "site.json" : "content.json", content); put("files.json", { files: {} });
console.log("Wrote the " + site.name + " template's data files");
