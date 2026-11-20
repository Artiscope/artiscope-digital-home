// Builds the site's pages from the data files into a folder.
// The drawing itself is in assets/render.js, which the page editor in Artiscope
// Digital Home also uses, so the preview and the published page always match.
//   node tools/build.mjs <folder>        (python3 tools/build.py <folder> does the same)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "_site"));
const R = createRequire(import.meta.url)(path.join(ROOT, "assets", "render.js"));
const fail = (msg) => { console.error(msg); process.exit(1); };
const read = (p) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8")); } catch (e) { fail(p + " could not be read: " + e.message); } };

const content = read("data/content.json"), pages = read("data/pages.json");
const theme = fs.existsSync(path.join(ROOT, "data", "theme.json")) ? read("data/theme.json") : {};

// The colours and typefaces chosen in Artiscope Digital Home, for the page head.
function themeHead() {
  let out = "";
  for (const link of theme.font_links || []) {
    if (typeof link === "string" && link.startsWith("https://fonts.googleapis.com/css2?") && !/["<>\s]/.test(link)) out += '<link href="' + link.replace(/&/g, "&amp;") + '" rel="stylesheet">\n';
  }
  const css = theme.css || "";
  if (css && /^:root\{[^<>{}]*\}$/.test(css)) out += '<style id="theme">' + css + "</style>\n";
  const rules = theme.rules || "";
  if (typeof rules === "string" && rules.trim() && !rules.includes("<")) out += '<style id="theme-rules">\n' + rules + "\n</style>\n";
  return out;
}
const extras = { social: theme.social && typeof theme.social === "object" ? theme.social : {}, favicon: typeof theme.favicon === "string" ? theme.favicon : "" };

// Refuses to build if the page list would not draw, so a bad edit cannot blank the site.
const KINDS = ["announcement", "columns", "space", "quote", "faq", "button",
  "picture-banner", "slideshow", "gallery", "logo-row", "picture", "text-picture",
  "artworks", "exhibitions", "career", "press", "signup", "visit", "contact-form", "signup-popup",
  // the six sections of The Art Correspondent's design
  "tac-opening", "tac-lead", "tac-latest", "tac-subjects", "tac-band", "tac-text", "tac-entries"];
function checkPages() {
  for (const key of ["header", "footer"]) {
    const part = (pages.shared || {})[key];
    if (!part || typeof part !== "object" || typeof part.settings !== "object") fail("data/pages.json must have the shared part '" + key + "' with settings.");
  }
  if (!pages.pages || !pages.pages.home) fail("data/pages.json must have the home page.");
  for (const [key, pg] of Object.entries(pages.pages)) {
    if (!pg || !Array.isArray(pg.sections) || !String(pg.path || "").endsWith("index.html")) fail("The page '" + key + "' in data/pages.json needs a path ending in index.html and a list of sections.");
    if (pg.path.includes("..") || pg.path.startsWith("/")) fail("The page '" + key + "' has a path that is not allowed.");
    const seen = new Set();
    for (const sec of pg.sections) {
      if (!sec || !KINDS.includes(sec.type)) fail("The page '" + key + "' has a section of a kind the site cannot draw: " + JSON.stringify(sec && sec.type));
      if (sec.type === "signup-popup") fail("A sign-up popup goes in the Popups group, not on a page.");
      const sid = String(sec.id || "");
      if (!/^[A-Za-z0-9_-]+$/.test(sid) || seen.has(sid)) fail("Every section on page '" + key + "' needs its own id of letters, digits and hyphens: " + JSON.stringify(sid));
      seen.add(sid);
      if (sec.settings != null && typeof sec.settings !== "object") fail("The settings of section '" + sid + "' on page '" + key + "' must be a list of fields.");
    }
  }
  // templates: the sections article and artist pages are drawn with, around their own content ("main")
  const templates = pages.templates || {};
  if (typeof templates !== "object" || Array.isArray(templates)) fail("The templates in data/pages.json must be grouped by kind of page.");
  for (const [kind, all] of Object.entries(templates)) {
    if (!["article", "artist"].includes(kind) || !all || typeof all !== "object" || !all.default) fail("Templates are for articles and artists, and each kind needs a default: " + JSON.stringify(kind));
    for (const [tid, t] of Object.entries(all)) {
      const secs = t && t.sections;
      if (!Array.isArray(secs) || secs.filter((x) => x && x.type === "main").length !== 1) fail("The template '" + tid + "' needs a list of sections with the page's own content in it once.");
      for (const sec of secs) {
        if (!sec || (sec.type !== "main" && (!KINDS.includes(sec.type) || sec.type === "signup-popup"))) fail("The template '" + tid + "' has a section of a kind the site cannot draw.");
        if (sec.type !== "main" && !/^t-[a-z0-9-]+$/.test(String(sec.id || ""))) fail("Every section in a template needs its own id starting t-: " + JSON.stringify(sec.id));
      }
    }
  }
  // changed fixed words, from Edit default text: plain words only
  if (pages.words != null && (typeof pages.words !== "object" || Array.isArray(pages.words) || Object.values(pages.words).some((v) => typeof v !== "string"))) fail("The changed words in data/pages.json must be a list of plain words.");
  if (pages.assign != null && (typeof pages.assign !== "object" || Array.isArray(pages.assign))) fail("The templates chosen for articles and artists must be listed by kind.");
  // articles and artists: each needs its own web address
  for (const k of ["articles", "artists"]) {
    if (content[k] != null && !Array.isArray(content[k])) fail("data/content.json: " + k + " must be a list.");
    const seen = new Set();
    for (const x of content[k] || []) {
      if (!x || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(String(x.slug || "")) || seen.has(x.slug)) fail("data/content.json: every one of the " + k + " needs its own web address of letters, digits and hyphens: " + JSON.stringify(x && x.slug));
      seen.add(x.slug);
    }
  }
  const gseen = new Set();
  for (const where of ["top", "popups", "bottom"]) {
    for (const sec of ((pages.groups || {})[where] || [])) {
      if (!sec || !KINDS.includes(sec.type)) fail("A section shared by every page is of a kind the site cannot draw: " + JSON.stringify(sec && sec.type));
      if ((where === "popups") !== (sec.type === "signup-popup")) fail("Only sign-up popups go in the Popups group, and they go nowhere else.");
      const sid = String(sec.id || "");
      if (!/^every-[a-z0-9-]+$/.test(sid) || gseen.has(sid)) fail("Every shared section needs its own id starting every-: " + JSON.stringify(sid));
      gseen.add(sid);
    }
  }
}

checkPages();
const D = R.fromFiles(content);
const site = R.Site(D, pages, themeHead(), extras);
const address = R.addressOf(D);
const written = [];
const write = (p, text) => { const out = path.join(OUT, p); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, text); written.push(p); };
const pagesOut = site.all();
for (const pg of pagesOut) write(pg.path, pg.html);
// the site's old addresses, each sending the visitor on to its new page
for (const pg of site.forwards()) { if (written.includes(pg.path)) fail("An old address is also a page of the site: " + pg.path); write(pg.path, pg.html); }
const urls = pagesOut.filter((p) => p.path !== "404.html").map((p) => p.url);
if (D.site.indexed) {
  write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map((u) => "<url><loc>" + address + u + "</loc></url>\n").join("") + "</urlset>\n");
  write("robots.txt", "User-agent: *\nAllow: /\nSitemap: " + address + "sitemap.xml\n");
} else {
  // Until its own web address is connected, the site asks search engines to stay away.
  write("robots.txt", "User-agent: *\nDisallow: /\n");
}
fs.cpSync(path.join(ROOT, "assets"), path.join(OUT, "assets"), { recursive: true });
const host = address.replace(/^https:\/\//, "").replace(/\/.*$/, "");
if (D.site.indexed && !/\.github\.io$/.test(host) && host !== "example.org") write("CNAME", host + "\n");
write(".nojekyll", "");
console.log("built " + pagesOut.length + " pages into " + OUT);
