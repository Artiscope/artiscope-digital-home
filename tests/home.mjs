// Artiscope Digital Home: the one server-side piece.
// It checks who is signed in, then reads and writes the website
// repositories on GitHub on their behalf. The GitHub token never
// reaches the browser.
//
// Secrets this function needs (set in Supabase, never in code):
//   GITHUB_TOKEN     a fine-grained token limited to the site repositories
//   ALLOWED_EMAILS   comma separated list of people who may use the console
// SUPABASE_URL is provided by Supabase. This function checks every
// request itself, so its "Verify JWT" setting is switched off.

// One entry per website. To add a site, add an entry and redeploy.
// ---------- theme: colours and typefaces ----------

// The typefaces the console offers, each with the exact request Google
// Fonts needs for it. A short list on purpose.
export const FONTS = {
  "Castoro": "Castoro:ital@0;1",
  "Libre Caslon Display": "Libre+Caslon+Display",
  "Cormorant Garamond": "Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400",
  "EB Garamond": "EB+Garamond:ital,wght@0,400;0,500;0,600;1,400",
  "Libre Baskerville": "Libre+Baskerville:ital,wght@0,400;0,700;1,400",
  "Newsreader": "Newsreader:ital,wght@0,400;0,500;0,600;1,400",
  "Literata": "Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;1,7..72,400",
  "Source Serif 4": "Source+Serif+4:ital,wght@0,400;0,500;0,600;1,400",
  "Libre Franklin": "Libre+Franklin:wght@400;500;600",
  "Work Sans": "Work+Sans:wght@400;500;600",
  "Public Sans": "Public+Sans:wght@400;500;600",
  "IBM Plex Sans": "IBM+Plex+Sans:wght@400;500;600",
  "Karla": "Karla:wght@400;500;600",
};
const HEADLINE_FONTS = ["Castoro", "Libre Caslon Display", "Cormorant Garamond", "EB Garamond", "Libre Baskerville", "Newsreader"];
const READING_FONTS = ["Literata", "Source Serif 4", "EB Garamond", "Libre Baskerville", "Newsreader", "Libre Franklin"];
const SMALL_FONTS = ["Libre Franklin", "Work Sans", "Public Sans", "IBM Plex Sans", "Karla"];

// Turns the chosen colours and typefaces into the small block of styling a
// site adds on top of its own. Nothing is produced for a setting left as it
// was, so an untouched theme leaves the site exactly as designed.
// The console holds the same function, and a test keeps the two in step.
export function themeCss(spec, values) {
  const decl = [], links = [];
  for (const c of spec.colours) {
    const v = String((values.colours || {})[c.id] || c.default).toUpperCase();
    if (v === c.default.toUpperCase()) continue;
    decl.push(c.var + ":" + v);
    for (const d of c.derived || []) decl.push(d[0] + ":color-mix(in srgb, " + v + " " + d[1] + "%, " + d[2] + ")");
  }
  for (const f of spec.fonts) {
    const name = (values.fonts || {})[f.id] || f.default;
    if (name === f.default || !FONTS[name]) continue;
    decl.push(f.var + ":'" + name + "', " + f.fallback);
    const link = "https://fonts.googleapis.com/css2?family=" + FONTS[name] + "&display=swap";
    if (!links.includes(link)) links.push(link);
  }
  return { css: decl.length ? ":root{" + decl.join(";") + "}" : "", font_links: links };
}

// Keeps only what the theme allows: six-figure colour codes and listed typefaces.
export function cleanTheme(spec, given) {
  const out = { colours: {}, fonts: {} };
  for (const c of spec.colours) {
    const v = String(((given || {}).colours || {})[c.id] || "").trim();
    if (v && !/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(c.label + " needs a colour code such as #1D4A35.");
    out.colours[c.id] = (v || c.default).toUpperCase();
  }
  for (const f of spec.fonts) {
    const v = String(((given || {}).fonts || {})[f.id] || f.default);
    if (!f.options.includes(v)) throw new Error(f.label + " must be one of the listed typefaces.");
    out.fonts[f.id] = v;
  }
  return out;
}

export const SITES = [
  {
    id: "world-art-review",
    name: "World Art Review",
    domain: "worldartreview.com",
    repo: "Artiscope/World-art-review",
    live: true,
    artists: [
      { slug: "zara-muse", name: "Zara Muse" },
      { slug: "konn-artiss", name: "Konn Artiss" },
      { slug: "zen-xander", name: "Zen Xander" },
    ],
    theme: {
      file: "content/theme.json",
      colours: [
        { id: "paper", role: "bg", label: "Page background", use: "Pages and cards", var: "--paper", default: "#EEE5D4",
          derived: [["--paper-deep", 94, "black"], ["--line", 89, "black"], ["--ghost", 86, "black"], ["--page", 55, "white"], ["--card", 70, "white"], ["--p85", 85, "transparent"], ["--p65", 65, "transparent"], ["--p50", 50, "transparent"]] },
        { id: "green", role: "band", label: "Bands and buttons", use: "Top band, buttons and labels", var: "--green", default: "#1D4A35", on: "paper", min: 3,
          derived: [["--green-dark", 78, "black"], ["--green-hover", 88, "white"]] },
        { id: "brick", role: "accent", label: "Links and highlights", use: "Links and small accents", var: "--brick", default: "#B5392B", on: "paper", min: 3,
          derived: [["--brick-soft", 45, "white"]] },
        { id: "ink", role: "text", label: "Text", use: "All reading text", var: "--ink", default: "#1D1D1B", on: "paper", min: 4.5,
          derived: [["--tile", 100, "black"], ["--mk-tile", 100, "black"]] },
      ],
      fonts: [
        { id: "display", role: "display", label: "Headlines", use: "Site name and titles", var: "--display", default: "Castoro", fallback: "Georgia, serif", options: HEADLINE_FONTS },
        { id: "text", role: "body", label: "Reading text", use: "Articles and portfolios", var: "--text", default: "Literata", fallback: "Georgia, serif", options: READING_FONTS },
        { id: "sans", role: "small", label: "Small text", use: "Buttons, labels and menus", var: "--sans", default: "Libre Franklin", fallback: "Arial, sans-serif", options: SMALL_FONTS },
      ],
      looks: [
        { name: "Ink and clay", colours: { paper: "#F1EEE8", green: "#22304A", brick: "#A4572F", ink: "#1B1D22" } },
        { name: "Bark and moss", colours: { paper: "#EFEAE4", green: "#3B2F2A", brick: "#5F7A3C", ink: "#1F1B19" } },
        { name: "Stone and plum", colours: { paper: "#ECEAE6", green: "#4A2A3F", brick: "#9A4B2E", ink: "#1E1B1D" } },
      ],
    },
    collections: [
      { id: "articles", label: "Articles", singular: "article", file: "content/site.json", path: ["articles"], shape: "list", key: "slug", title: "title", sub: ["kicker", "section"], canHide: true, canDelete: true },
      { id: "artists", label: "Artists", singular: "artist", file: "content/site.json", path: ["artists"], shape: "list", key: "slug", title: "name", sub: ["tag", "place"], canHide: false, canDelete: false, inside: { works: false, glance: { labelFrom: 0, cols: { 1: "" } } } },
      { id: "artworks", label: "Artworks", singular: "artwork", file: "content/site.json", path: ["artists"], shape: "nested", key: "slug", child: "works", parentTitle: "name", title: "title", sub: ["medium", "year"], canHide: true, canDelete: true },
      { id: "sources", label: "Sources", singular: "source", file: "content/site.json", path: ["sources"], shape: "map", title: "title", sub: ["pub", "date"], canHide: false, canDelete: false },
    ],
  },
  {
    id: "global-art-monitor",
    name: "Global Art Monitor",
    domain: "globalartmonitor.com",
    repo: "Artiscope/global-art-monitor",
    live: true,
    artists: [
      { slug: "zara-muse", name: "Zara Muse" },
      { slug: "konn-artiss", name: "Konn Artiss" },
    ],
    theme: {
      file: "data/theme.json",
      colours: [
        { id: "blush", role: "bg", label: "Page background", use: "Pages and cards", var: "--blush", default: "#F3C3C8",
          derived: [["--blush-light", 40, "white"], ["--blush-deep", 94, "black"], ["--paper", 30, "white"]] },
        { id: "ink", role: "band", label: "Dark bands and text", use: "Dark panels, headings and text", var: "--ink", default: "#2A2A2F", on: "blush", min: 4.5,
          derived: [["--ink-2", 94, "white"], ["--ink-3", 90, "white"], ["--on-blush-body", 88, "white"], ["--on-blush-quiet", 76, "white"]] },
        { id: "mint", role: "accent", label: "Highlights", use: "Buttons, markers and small accents", var: "--mint", default: "#22E3A2", on: "ink", min: 3, derived: [] },
      ],
      fonts: [
        { id: "serif", role: "display", label: "Headlines", use: "Site name and titles", var: "--serif", default: "Libre Caslon Display", fallback: "Georgia, 'Times New Roman', serif", options: HEADLINE_FONTS },
        { id: "sans", role: "body", label: "Text", use: "Reading text, tables and buttons", var: "--sans", default: "Libre Franklin", fallback: "Arial, Helvetica, sans-serif", options: SMALL_FONTS },
      ],
      looks: [
        { name: "Sand and navy", colours: { blush: "#EADFCB", ink: "#1F2A44", mint: "#E0A33B" } },
        { name: "Mist and forest", colours: { blush: "#DCE5DF", ink: "#1E3329", mint: "#F0B45A" } },
        { name: "Paper and ink", colours: { blush: "#EDEAE4", ink: "#232326", mint: "#D9532F" } },
      ],
    },
    collections: [
      { id: "articles", label: "Articles", singular: "article", file: "data/content.json", path: ["features"], shape: "list", key: "slug", title: "title", sub: ["kicker"], canHide: true, canDelete: true },
      { id: "sales", label: "Auction sales", singular: "sale", file: "data/sales.json", path: ["sales"], shape: "list", key: null, title: "title", sub: ["house", "date_text"], canHide: false, canDelete: true, numbers: ["est_low", "est_high", "hammer", "premium"] },
      { id: "artists", label: "Artist notes", singular: "artist note", file: "data/content.json", path: ["bios"], shape: "map", title: null, sub: [], canHide: false, canDelete: false, inside: { sources: { cols: { 0: "name", 1: "link" } } } },
      { id: "glossary", label: "Glossary", singular: "glossary term", file: "data/content.json", path: ["glossary"], shape: "rows", titleAt: 0, columns: ["Term", "Meaning"], canHide: false, canDelete: false },
      { id: "sections", label: "Sections", singular: "section", file: "data/content.json", path: ["sections"], shape: "rows", titleAt: 1, columns: [null, "Name", "Description"], canHide: false, canDelete: false },
      { id: "site", label: "Site details", singular: "site details", file: "data/content.json", path: ["site"], shape: "single", title: "name", sub: ["tagline"], canHide: false, canDelete: false },
    ],
  },
  { id: "site-3", name: "Site 3", domain: "", repo: "", live: false, artists: [], collections: [] },
  { id: "site-4", name: "Site 4", domain: "", repo: "", live: false, artists: [], collections: [] },
  { id: "site-5", name: "Site 5", domain: "", repo: "", live: false, artists: [], collections: [] },
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function env(name) {
  return (globalThis.Deno ? globalThis.Deno.env.get(name) : "") || "";
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ---------- reading the plain text files the agent keeps ----------

function field(block, label) {
  const m = block.match(new RegExp("^- " + label + ":[ \\t]*(.*)$", "m"));
  return m ? m[1].trim() : "";
}

function sectionOf(md, heading) {
  const parts = md.split(/^## /m);
  for (const p of parts) {
    if (p.toLowerCase().startsWith(heading.toLowerCase())) return p;
  }
  return "";
}

function itemsOf(section) {
  return section
    .split(/^### /m)
    .slice(1)
    .map((b) => {
      const title = b.split("\n")[0].trim();
      return {
        title,
        type: field(b, "Type"),
        why: field(b, "Why now"),
        sources: field(b, "Sources found"),
        answer: field(b, "Your answer"),
      };
    })
    .filter((t) => t.title);
}

export function parseCalendar(md) {
  return {
    waiting: itemsOf(sectionOf(md, "Waiting for your answer")),
    approved: itemsOf(sectionOf(md, "Approved, to be written")),
  };
}

// Writes the owner's yes or no next to one topic. Returns the new text,
// or null if that topic is not waiting for an answer.
export function setAnswer(md, title, answer, note) {
  const parts = md.split(/^(?=## )/m);
  let done = false;
  const out = parts.map((sec) => {
    if (done || !/^## Waiting for your answer/i.test(sec)) return sec;
    const blocks = sec.split(/^(?=### )/m);
    return blocks
      .map((b) => {
        if (done || !b.startsWith("### ")) return b;
        if (b.split("\n")[0].slice(4).trim() !== title) return b;
        const clean = String(note || "").replace(/[\r\n]+/g, " ").trim().slice(0, 300);
        const line = "- Your answer: " + answer + (clean ? ", " + clean : "");
        if (!/^- Your answer:.*$/m.test(b)) return b;
        done = true;
        return b.replace(/^- Your answer:.*$/m, line);
      })
      .join("");
  });
  return done ? out.join("") : null;
}

export function parseLog(md, limit = 3) {
  return md
    .split(/^## /m)
    .slice(1)
    .slice(0, limit)
    .map((e) => {
      const lines = e.split("\n");
      return {
        date: lines[0].trim(),
        lines: lines.slice(1).map((l) => l.trim()).filter(Boolean).slice(0, 8),
      };
    });
}

export function safePhotoName(artistSlug, description, ext) {
  const slug = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  const e = String(ext || "").toLowerCase().replace("jpeg", "jpg");
  if (e !== "jpg" && e !== "png") return null;
  const a = slug(artistSlug);
  const d = slug(description);
  if (!a || !d) return null;
  return a + "-" + d + "." + e;
}

// Reads a site's list of image spots. Anything malformed is dropped.
export function parseSlots(text) {
  let data = null;
  try { data = JSON.parse(text); } catch (_e) { return []; }
  const list = data && Array.isArray(data.slots) ? data.slots : [];
  return list
    .filter((x) => x && /^[a-z0-9][a-z0-9-]{1,90}$/.test(String(x.id || "")) && x.label)
    .slice(0, 400)
    .map((x) => ({
      id: String(x.id),
      group: String(x.group || "Other").slice(0, 80),
      label: String(x.label).slice(0, 160),
      filled: x.filled === true,
    }));
}

// Plain single-line text, safe to drop into a page.
export function cleanText(text, limit) {
  return String(text || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[<>`\\]/g, "")
    .replace(/\u2014/g, ",").replace(/\u2013/g, "-")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, limit);
}

// A photo meant for an exact spot is saved as slot--<spot id>.<ext>
export function slotPhotoName(slotId, ext) {
  const e = String(ext || "").toLowerCase().replace("jpeg", "jpg");
  if (e !== "jpg" && e !== "png") return null;
  if (!/^[a-z0-9][a-z0-9-]{1,90}$/.test(String(slotId || ""))) return null;
  return "slot--" + slotId + "." + e;
}

// A photo with only a description is saved as note--<description>.<ext>
export function notePhotoName(description, ext) {
  const e = String(ext || "").toLowerCase().replace("jpeg", "jpg");
  if (e !== "jpg" && e !== "png") return null;
  const d = String(description || "").toLowerCase().normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  return d ? "note--" + d + "." + e : null;
}

// ---------- content: the words on each site ----------

// Fields the console never shows, because changing them breaks links
// or belongs to another screen.
const LOCKED = ["slug", "letter", "tone", "heroTone", "image", "hidden", "artist", "url_slug"];
const LABELS = {
  dek: "Summary line", kicker: "Label above the title", alt: "Picture description",
  credit: "Picture caption", heroCredit: "Picture caption", html: "Text", body: "Body",
  what: "What happened", when: "When", sections: "Portfolio sections", glance: "At a glance",
  timeline: "Timeline", research: "Still to research", sources: "Sources",
  mins: "Reading time, minutes", minutes: "Reading time, minutes", standfirst: "Opening line",
  est_low: "Estimate, low", est_high: "Estimate, high", hammer: "Hammer price",
  premium: "Price with buyer's premium", hammer_basis: "Hammer price basis (published or calculated)",
  date: "Sale date (year-month-day)", date_text: "Sale date in words", pub: "Publication",
  source_label: "Source name", source_url: "Source link", source2_label: "Second source name",
  source2_url: "Second source link", published: "Shown on the site", ghostWords: "Large background words",
  tag: "Type of work", checked: "Last checked", seen: "Where to see the work", tags: "Tags",
};

function labelFor(name) {
  if (LABELS[name]) return LABELS[name];
  const words = String(name).replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Lists of internal names (which sources, which artists). Not for hand editing.
const ID_LISTS = ["sources", "artists", "related", "src"];
const INNER_LOCKED = ["id", "src"];
const HAS_MARKS = /<[a-z][^>]*>/i;

function kindOf(name, v, numbers) {
  if (numbers.includes(name) || typeof v === "number") return "number";
  if (typeof v === "boolean") return "yesno";
  if (typeof v === "string") return v.length > 90 || v.includes("\n") || HAS_MARKS.test(v) || name === "html" ? "long" : "text";
  if (v === null) return "text";
  return null;
}

// Which fields of an entry can be edited, and as what. Parts that sit
// inside an entry (portfolio sections, timeline, at a glance) come out as
// fields too, named by where they sit, for example "sections.0.html".
// "inside" says how to treat those parts; false leaves one out.
export function fieldsOf(entry, numbers = [], inside = {}) {
  const out = [];
  if (Array.isArray(entry)) {
    const cols = Array.isArray(inside) ? inside : [];
    entry.forEach((v, j) => {
      if (!cols[j] || typeof v !== "string") return;
      out.push({ name: String(j), label: cols[j], type: kindOf("", v, []), value: v });
    });
    return out;
  }
  const rules = inside && !Array.isArray(inside) ? inside : {};
  const later = [];
  for (const name of Object.keys(entry || {})) {
    if (LOCKED.includes(name) || rules[name] === false) continue;
    const v = entry[name];
    const type = kindOf(name, v, numbers);
    if (type) { out.push({ name, label: labelFor(name), type, value: v }); continue; }
    if (!Array.isArray(v) || v.length === 0) continue;
    if (v.every((x) => typeof x === "string")) {
      if (!ID_LISTS.includes(name)) out.push({ name, label: labelFor(name), type: "lines", value: v });
    } else if (v.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
      v.forEach((item, i) => {
        const lead = typeof item.title === "string" && item.title ? item.title : String(i + 1);
        for (const k of Object.keys(item)) {
          if (LOCKED.includes(k) || INNER_LOCKED.includes(k)) continue;
          const t = kindOf(k, item[k], []);
          if (t) later.push({ name: name + "." + i + "." + k, label: lead + ": " + labelFor(k).toLowerCase(), type: t, value: item[k], group: labelFor(name) });
        }
      });
    } else if (rules[name] && v.every((x) => Array.isArray(x))) {
      const rule = rules[name];
      v.forEach((row, i) => {
        for (const j of Object.keys(rule.cols)) {
          if (typeof row[j] !== "string") continue;
          const lead = rule.labelFrom != null ? String(row[rule.labelFrom]) : String(i + 1);
          const tail = rule.cols[j] ? ": " + rule.cols[j] : "";
          later.push({ name: name + "." + i + "." + j, label: lead + tail, type: kindOf("", row[j], []), value: row[j], group: labelFor(name) });
        }
      });
    }
  }
  return out.concat(later);
}

function dig(data, path) {
  let node = data;
  for (const k of path) node = node == null ? undefined : node[k];
  return node;
}

// Every entry of one collection, each with an id the console can send back.
export function entriesOf(data, col) {
  const node = dig(data, col.path);
  const list = [];
  if (col.shape === "single" && node && typeof node === "object") {
    list.push({ id: "only", ref: node, parent: null, title: node[col.title] || col.label });
  } else if (col.shape === "map" && node && typeof node === "object") {
    for (const k of Object.keys(node)) list.push({ id: k, ref: node[k], parent: null, title: (col.title && node[k][col.title]) || k });
  } else if (col.shape === "list" && Array.isArray(node)) {
    node.forEach((e, i) => list.push({ id: col.key && e[col.key] ? String(e[col.key]) : "n" + i, ref: e, parent: null, title: e[col.title] || "Untitled" }));
  } else if (col.shape === "rows" && Array.isArray(node)) {
    node.forEach((row, i) => { if (Array.isArray(row)) list.push({ id: "n" + i, ref: row, parent: null, title: row[col.titleAt] || "Untitled" }); });
  } else if (col.shape === "nested" && Array.isArray(node)) {
    node.forEach((p) => {
      (Array.isArray(p[col.child]) ? p[col.child] : []).forEach((e, i) => {
        list.push({ id: String(p[col.key]) + "~" + i, ref: e, parent: p, title: e[col.title] || "Untitled", group: p[col.parentTitle] || "" });
      });
    });
  }
  return list;
}

function entryView(x, col) {
  const sub = (col.sub || []).map((k) => x.ref[k]).filter((v) => typeof v === "string" && v).join(", ");
  return {
    id: x.id, title: String(x.title), sub: [x.group, sub].filter(Boolean).join(". "),
    hidden: x.ref.hidden === true, fields: fieldsOf(x.ref, col.numbers || [], col.columns || col.inside || {}),
  };
}

// Applies edited values to one entry. Only fields the entry already has,
// and only as the kind of value they already are.
export function applyValues(entry, values, numbers = [], inside = {}) {
  const allowed = fieldsOf(entry, numbers, inside);
  let changed = 0;
  for (const f of allowed) {
    if (!(f.name in values)) continue;
    let v = values[f.name];
    if (f.type === "number") {
      if (v === "" || v === null) v = null;
      else { v = Number(v); if (!Number.isFinite(v)) throw new Error(f.label + " must be a number."); }
    } else if (f.type === "yesno") {
      v = v === true || v === "true";
    } else if (f.type === "lines") {
      v = (Array.isArray(v) ? v : String(v).split(/\n+/)).map((x) => String(x).trim()).filter(Boolean).slice(0, 60);
    } else {
      v = String(v == null ? "" : v).replace(/—/g, ",").slice(0, 60000);
      if (f.value === null && v === "") v = null;
    }
    // the name is a path that fieldsOf produced from this same entry, so every step exists
    const steps = f.name.split("."), last = steps.pop();
    let holder = entry;
    for (const k of steps) holder = holder[k];
    if (JSON.stringify(holder[last]) !== JSON.stringify(v)) { holder[last] = v; changed++; }
  }
  return changed;
}

function decodeBase64Utf8(b64) {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// ---------- GitHub ----------

async function gh(path, init = {}) {
  const res = await fetch("https://api.github.com" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + env("GITHUB_TOKEN"),
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "artiscope-digital-home",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  let data = null;
  try {
    data = await res.json();
  } catch (_e) {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

// Says in plain words why GitHub refused to save something.
function writeProblem(r, fallback) {
  if (r.status === 401) return "The GitHub key is no longer valid. Create a new one and replace the GITHUB_TOKEN secret.";
  if (r.status === 403 || r.status === 404) {
    return "The GitHub key is not allowed to make changes to this site. On GitHub, open the key and check that the resource owner is Artiscope, this repository is selected, Contents and Pull requests are both set to Read and write, and the key is not waiting for approval.";
  }
  return fallback + " (GitHub code " + r.status + ")";
}

async function getText(repo, path, ref = "") {
  const r = await gh("/repos/" + repo + "/contents/" + path + (ref ? "?ref=" + encodeURIComponent(ref) : ""));
  if (!r.ok || !r.data || !r.data.content) return null;
  return { text: decodeBase64Utf8(r.data.content), sha: r.data.sha };
}

async function draftsOf(repo) {
  const r = await gh("/repos/" + repo + "/pulls?state=open&per_page=30");
  if (!r.ok || !Array.isArray(r.data)) return [];
  return r.data
    .filter((p) => p.head && String(p.head.ref).startsWith("draft/"))
    .map((p) => ({
      number: p.number,
      title: p.title,
      body: String(p.body || "").slice(0, 6000),
      url: p.html_url,
      created: p.created_at,
    }));
}

async function inboxOf(repo, ref = "") {
  const r = await gh("/repos/" + repo + "/contents/inbox" + (ref ? "?ref=" + encodeURIComponent(ref) : ""));
  if (!r.ok || !Array.isArray(r.data)) return [];
  return r.data
    .filter((f) => f.type === "file" && /\.(jpe?g|png)$/i.test(f.name))
    .map((f) => f.name);
}


// ---------- copies of a site: the live one being worked on, and trial copies ----------
//
// Nothing the console saves goes straight to visitors. Each site has a
// working branch for the live site ("adh/live-...") and up to two trial
// copies ("adh/trial-..."). Publishing merges one of them into main.

const MAX_TRIALS = 2;
const COPY_ID = /^(live|trial)-[a-z0-9-]{1,60}$/;

function randomTail() {
  const b = new Uint8Array(3);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
export function copySlug(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30).replace(/-+$/g, "");
}
export function copyName(id) {
  const words = String(id).replace(/^trial-/, "").replace(/-[0-9a-f]{6}$/, "").replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
function stepOf(c) {
  const first = String((c.commit && c.commit.message) || "").split("\n")[0];
  return {
    sha: c.sha,
    what: first.replace(/ \([^()@ ]+@[^()]+\)$/, ""),
    when: c.commit && c.commit.author ? c.commit.author.date : "",
    by: (first.match(/\(([^()@ ]+@[^()]+)\)$/) || [])[1] || "",
  };
}

// Every copy of one site, with how far each is from the live site.
async function copiesOf(site) {
  // one call finds both the copies ("adh/...") and their redo markers ("adh-redo/...")
  const found = await gh("/repos/" + site.repo + "/git/matching-refs/heads/adh");
  const all = Array.isArray(found.data) ? found.data : [];
  const redoable = all.filter((r) => String(r.ref).startsWith("refs/heads/adh-redo/")).map((r) => String(r.ref).replace("refs/heads/adh-redo/", ""));
  const ids = all
    .filter((r) => String(r.ref).startsWith("refs/heads/adh/"))
    .map((r) => ({ id: String(r.ref).replace("refs/heads/adh/", ""), sha: r.object && r.object.sha }))
    .filter((r) => COPY_ID.test(r.id));
  const out = await Promise.all(ids.map(async (r) => {
    const cmp = await gh("/repos/" + site.repo + "/compare/main...adh/" + r.id);
    const d = cmp.ok && cmp.data ? cmp.data : {};
    const commits = Array.isArray(d.commits) ? d.commits : [];
    const kind = r.id.startsWith("live-") ? "live" : "trial";
    return {
      id: r.id, kind, name: kind === "live" ? "Live site" : copyName(r.id), branch: "adh/" + r.id, sha: r.sha,
      ahead: Number(d.ahead_by || 0), behind: Number(d.behind_by || 0),
      since: d.merge_base_commit && d.merge_base_commit.commit && d.merge_base_commit.commit.committer ? d.merge_base_commit.commit.committer.date : "",
      steps: commits.slice(-20).reverse().map(stepOf),
      canRedo: redoable.includes(r.id),
      preview: "https://" + site.domain + "/preview/" + r.id + "/",
    };
  }));
  const lives = out.filter((c) => c.kind === "live");
  const live = lives[0] || { id: "live", kind: "live", name: "Live site", branch: "", sha: "", ahead: 0, behind: 0, since: "", steps: [], canRedo: false, preview: "" };
  return [live].concat(out.filter((c) => c.kind === "trial").sort((a, b) => a.id.localeCompare(b.id)));
}
function pickCopy(copies, id) {
  if (!id || id === "live" || String(id).startsWith("live-")) return copies[0];
  return copies.find((c) => c.id === id) || null;
}
// Where to read a copy from. The live copy is read from main until it has changes of its own.
function readRefOf(copy) {
  if (copy.kind === "trial") return copy.branch;
  return copy.branch && copy.ahead > 0 ? copy.branch : "main";
}
function publicCopy(c) {
  return { id: c.id, kind: c.kind, name: c.name, ahead: c.ahead, behind: c.behind, since: c.since, steps: c.steps.map((x) => ({ what: x.what, when: x.when, by: x.by })), canRedo: c.canRedo, preview: c.ahead > 0 || c.kind === "trial" ? c.preview : "" };
}
async function mainSha(site) {
  const r = await gh("/repos/" + site.repo + "/git/ref/heads/main");
  return r.ok && r.data && r.data.object ? r.data.object.sha : "";
}
async function moveBranch(site, branch, sha, force) {
  return await gh("/repos/" + site.repo + "/git/refs/heads/" + branch, { method: "PATCH", body: JSON.stringify({ sha, force: !!force }) });
}
async function dropRedo(site, copy) {
  if (copy.canRedo) await gh("/repos/" + site.repo + "/git/refs/heads/adh-redo/" + copy.id, { method: "DELETE" });
  copy.canRedo = false;
}
// Makes sure the copy has a branch to save to, brought up to date with live where that is safe.
async function branchForWriting(site, copy, who) {
  if (!copy.branch) {
    const sha = await mainSha(site);
    if (!sha) return null;
    const id = "live-" + randomTail();
    const made = await gh("/repos/" + site.repo + "/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/adh/" + id, sha }) });
    if (!made.ok) return null;
    copy.id = id; copy.branch = "adh/" + id; copy.sha = sha;
  } else if (copy.kind === "live" && copy.behind > 0) {
    if (copy.ahead === 0) await moveBranch(site, copy.branch, await mainSha(site), false);
    else await gh("/repos/" + site.repo + "/merges", { method: "POST", body: JSON.stringify({ base: copy.branch, head: "main", commit_message: "Bring in the latest live changes" + who }) });
  }
  await dropRedo(site, copy);
  return copy.branch;
}

async function siteOverview(site, wanted = "") {
  const base = { id: site.id, name: site.name, domain: site.domain, live: site.live, artists: site.artists };
  if (!site.live) return base;
  try {
    const copies = await copiesOf(site);
    const copy = pickCopy(copies, wanted) || copies[0];
    const ref = readRefOf(copy);
    const [cal, log, drafts, inbox, slotFile] = await Promise.all([
      getText(site.repo, "CONTENT-CALENDAR.md"),
      getText(site.repo, "AGENT-LOG.md"),
      draftsOf(site.repo),
      inboxOf(site.repo, ref),
      getText(site.repo, "image-slots.json", ref),
    ]);
    const waitingSlots = inbox
      .map((n) => (n.match(/^slot--([a-z0-9-]+)\.(jpg|png)$/) || [])[1])
      .filter(Boolean);
    const slots = (slotFile ? parseSlots(slotFile.text) : []).map((x) => ({
      ...x,
      waiting: waitingSlots.includes(x.id),
    }));
    return {
      ...base,
      topics: cal ? parseCalendar(cal.text) : { waiting: [], approved: [] },
      log: log ? parseLog(log.text) : [],
      drafts,
      inbox,
      slots,
      copies: copies.map(publicCopy),
      copy: copy.id,
    };
  } catch (_e) {
    return { ...base, error: "Could not read this site from GitHub just now." };
  }
}

function liveSite(id) {
  return SITES.find((s) => s.id === id && s.live) || null;
}

async function draftPull(site, number) {
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) return null;
  const r = await gh("/repos/" + site.repo + "/pulls/" + n);
  if (!r.ok || !r.data || r.data.state !== "open") return null;
  if (!String(r.data.head.ref).startsWith("draft/")) return null;
  return r.data;
}

// ---------- who is asking ----------

function publishableKey() {
  try {
    const keys = JSON.parse(env("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    const first = keys.default || Object.values(keys)[0];
    if (first) return String(first);
  } catch (_e) { /* fall through to the older variable */ }
  return env("SUPABASE_ANON_KEY");
}

async function signedInEmail(req) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  // The browser sends the project's publishable key with every call.
  // It is public by design, so it is safe to pass on to the sign-in service.
  const apikey = req.headers.get("apikey") || publishableKey();
  const res = await fetch(env("SUPABASE_URL") + "/auth/v1/user", {
    headers: { Authorization: auth, apikey },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user && user.email ? String(user.email).toLowerCase() : null;
}

function isAllowed(email) {
  const list = env("ALLOWED_EMAILS")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email);
}

// ---------- the actions the console can ask for ----------

export async function handle(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const email = await signedInEmail(req);
  if (!email) return json({ error: "Please sign in again." }, 401);
  if (!isAllowed(email)) return json({ error: "This email address does not have access." }, 403);
  if (!env("GITHUB_TOKEN")) return json({ error: "The GitHub connection has not been set up yet." }, 500);

  let body = {};
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "Could not read the request." }, 400);
  }
  const action = String(body.action || "");

  if (action === "overview") {
    const wanted = body.copies && typeof body.copies === "object" ? body.copies : {};
    const sites = await Promise.all(SITES.map((s) => siteOverview(s, String(wanted[s.id] || ""))));
    return json({ user: { email }, sites });
  }

  const site = liveSite(String(body.site || ""));
  if (!site) return json({ error: "That site is not available." }, 400);

  // ----- content -----
  const col = (site.collections || []).find((c) => c.id === body.collection) || null;
  const who = " (" + email + ")";

  // Which copy of the site this request is about, and the branch that goes with it.
  const WRITES = ["saveTheme", "saveEntry", "setHidden", "deleteEntry", "removePhoto", "undo", "uploadPhoto"];
  const COPY_ACTIONS = ["makeCopy", "deleteCopy", "refreshCopy", "publish", "discard", "undoStep", "redoStep"];
  const DRAFT_ACTIONS = ["answerTopic", "publishDraft", "returnDraft", "rejectDraft", "history"];
  let copies = [], copy = null, ref = "main";
  if (!DRAFT_ACTIONS.includes(action)) {
    copies = await copiesOf(site);
    copy = pickCopy(copies, String(body.copy || ""));
    if (!copy) return json({ error: "That trial copy is no longer there. Refresh and choose again." }, 409);
    if (WRITES.includes(action)) {
      const b = await branchForWriting(site, copy, who);
      if (!b) return json({ error: "The working copy could not be prepared. Please try again." }, 502);
      ref = b;
    } else ref = readRefOf(copy);
  }
  // Reads and writes of site files go to that branch.
  const ghc = (path, init = {}) => {
    if (!init.method) return gh(path.includes("?ref=") ? path : path + "?ref=" + encodeURIComponent(ref), init);
    const b = JSON.parse(init.body || "{}");
    return gh(path, { ...init, body: JSON.stringify({ ...b, branch: ref }) });
  };

  async function loadJson(file) {
    const f = await getText(site.repo, file, ref);
    if (!f) return null;
    try { return { data: JSON.parse(f.text), sha: f.sha }; } catch (_e) { return null; }
  }
  async function saveJson(file, data, sha, message) {
    return await ghc("/repos/" + site.repo + "/contents/" + file, {
      method: "PUT",
      body: JSON.stringify({ message: message + who, content: encodeBase64Utf8(JSON.stringify(data, null, 2) + "\n"), sha }),
    });
  }

  if (action === "content") {
    const files = {};
    const out = [];
    for (const c of site.collections || []) {
      if (!files[c.file]) files[c.file] = await loadJson(c.file);
      const f = files[c.file];
      out.push({
        id: c.id, label: c.label, singular: c.singular, canHide: !!c.canHide, canDelete: !!c.canDelete,
        entries: f ? entriesOf(f.data, c).map((x) => entryView(x, c)) : [],
        problem: f ? "" : "This part of the site could not be read.",
      });
    }
    return json({ collections: out });
  }

  if (action === "theme" || action === "saveTheme") {
    const spec = site.theme;
    if (!spec) return json({ error: "This site has no theme settings yet." }, 400);
    const f = await loadJson(spec.file);
    let current;
    try { current = cleanTheme(spec, f ? f.data : {}); } catch (_e) { current = cleanTheme(spec, {}); }
    if (action === "theme") {
      return json({ spec: { colours: spec.colours, fonts: spec.fonts, looks: spec.looks || [], fontRequests: FONTS, url: "https://" + site.domain + "/" }, values: current });
    }
    let next;
    try { next = cleanTheme(spec, body.values); } catch (e) { return json({ error: e.message }, 400); }
    if (JSON.stringify(next) === JSON.stringify(current)) return json({ ok: true, unchanged: true });
    const changed = [];
    for (const c of spec.colours) if (next.colours[c.id] !== current.colours[c.id]) changed.push(c.label.toLowerCase());
    for (const x of spec.fonts) if (next.fonts[x.id] !== current.fonts[x.id]) changed.push(x.label.toLowerCase() + " typeface");
    const put = await saveJson(spec.file, Object.assign({}, next, themeCss(spec, next)), f ? f.sha : undefined, "Theme: " + changed.join(", ").slice(0, 120));
    if (put.status === 409) return json({ error: "Someone else changed the theme at the same moment. Refresh and try again." }, 409);
    if (!put.ok) return json({ error: writeProblem(put, "GitHub did not save the theme. Please try again.") }, 502);
    return json({ ok: true, values: next });
  }

  if (action === "saveEntry" || action === "setHidden" || action === "deleteEntry") {
    if (!col) return json({ error: "That kind of content is not available on this site." }, 400);
    const f = await loadJson(col.file);
    if (!f) return json({ error: "The site content could not be read." }, 502);
    const all = entriesOf(f.data, col);
    const x = all.find((e) => e.id === String(body.id));
    if (!x) return json({ error: "That entry is no longer there. Refresh and try again." }, 409);
    let message = "";

    if (action === "saveEntry") {
      let changed = 0;
      try { changed = applyValues(x.ref, body.values || {}, col.numbers || [], col.columns || col.inside || {}); }
      catch (e) { return json({ error: e.message }, 400); }
      if (!changed) return json({ ok: true, unchanged: true });
      message = "Edit " + col.singular + ": " + x.title;
    } else if (action === "setHidden") {
      if (!col.canHide) return json({ error: "This kind of content cannot be hidden." }, 400);
      if (body.hidden) x.ref.hidden = true; else delete x.ref.hidden;
      message = (body.hidden ? "Hide " : "Show ") + col.singular + ": " + x.title;
    } else {
      if (!col.canDelete) return json({ error: "This kind of content cannot be deleted here." }, 400);
      const holder = col.shape === "nested" ? x.parent[col.child] : dig(f.data, col.path);
      const at = holder.indexOf(x.ref);
      if (at < 0) return json({ error: "That entry is no longer there." }, 409);
      holder.splice(at, 1);
      message = "Delete " + col.singular + ": " + x.title;
    }
    const put = await saveJson(col.file, f.data, f.sha, message);
    if (put.status === 409) return json({ error: "Someone else changed this at the same moment. Refresh and try again." }, 409);
    if (!put.ok) return json({ error: writeProblem(put, "GitHub did not save the change. Please try again.") }, 502);
    return json({ ok: true });
  }

  if (action === "removePhoto") {
    const slotFile = await loadJson("image-slots.json");
    const slot = slotFile && Array.isArray(slotFile.data.slots) ? slotFile.data.slots.find((x) => x.id === body.slot) : null;
    if (!slot) return json({ error: "That spot is not on the site." }, 409);
    const m = /^(artist|article)-(.+)$/.exec(String(slot.id));
    if (!m) return json({ error: "Photos in this kind of spot cannot be removed here yet." }, 400);
    const builtSite = site.collections.some((c) => c.file === "data/content.json");
    if (builtSite) {
      let removed = false;
      for (const ext of ["jpg", "jpeg", "png", "webp"]) {
        const path = "/repos/" + site.repo + "/contents/assets/images/" + m[2] + "." + ext;
        const cur = await ghc(path);
        if (cur.ok && cur.data && cur.data.sha) {
          const del = await ghc(path, { method: "DELETE", body: JSON.stringify({ message: "Remove photo: " + slot.label + who, sha: cur.data.sha }) });
          if (!del.ok) return json({ error: writeProblem(del, "GitHub did not remove the photo.") }, 502);
          removed = true;
        }
      }
      if (!removed) return json({ error: "There is no photo in that spot." }, 409);
    } else {
      const f = await loadJson("content/site.json");
      if (!f) return json({ error: "The site content could not be read." }, 502);
      const list = m[1] === "artist" ? f.data.artists : f.data.articles;
      const e = (list || []).find((x) => x.slug === m[2]);
      if (!e || !e.image) return json({ error: "There is no photo in that spot." }, 409);
      e.image = null; e.alt = "";
      const put = await saveJson("content/site.json", f.data, f.sha, "Remove photo: " + slot.label);
      if (!put.ok) return json({ error: writeProblem(put, "GitHub did not remove the photo.") }, 502);
    }
    const fresh = await loadJson("image-slots.json");
    if (fresh) {
      const again = fresh.data.slots.find((x) => x.id === slot.id);
      if (again) { again.filled = false; await saveJson("image-slots.json", fresh.data, fresh.sha, "Mark spot empty: " + slot.label); }
    }
    return json({ ok: true });
  }

  // ----- history and undo -----
  const CONTENT_FILES = ["content/site.json", "data/content.json", "data/sales.json", "data/images.json", "image-slots.json", "content/theme.json", "data/theme.json"];
  const UNDOABLE = /^(Edit |Hide |Show |Delete |Remove photo|Add photo|Place photos|Theme: |Publish: |Make live: |Undo: )/;

  if (action === "history") {
    const r = await gh("/repos/" + site.repo + "/commits?per_page=30");
    if (!r.ok || !Array.isArray(r.data)) return json({ error: "The history could not be read." }, 502);
    return json({
      changes: r.data.map((c) => {
        const first = String(c.commit.message || "").split("\n")[0];
        return { sha: c.sha, what: first.replace(/ \([^()@ ]+@[^()]+\)$/, ""), when: c.commit.author ? c.commit.author.date : "", by: (first.match(/\(([^()@ ]+@[^()]+)\)$/) || [])[1] || (c.commit.author ? c.commit.author.name : ""), canUndo: UNDOABLE.test(first) };
      }),
    });
  }

  // Puts back what one published change altered, as a new step on the copy being worked on.
  if (action === "undo") {
    const sha = String(body.sha || "");
    if (!/^[0-9a-f]{40}$/.test(sha)) return json({ error: "That change could not be found." }, 400);
    const c = await gh("/repos/" + site.repo + "/commits/" + sha);
    if (!c.ok || !c.data) return json({ error: "That change could not be found." }, 404);
    const first = String(c.data.commit.message || "").split("\n")[0];
    const files = c.data.files || [];
    const parent = c.data.parents && c.data.parents[0] ? c.data.parents[0].sha : "";
    const allowed = (f) => CONTENT_FILES.includes(f) || /^(images|assets\/images|inbox)\/[^/]+$/.test(f);
    if (!UNDOABLE.test(first) || !parent || !files.length || files.length > 60 || !files.every((x) => allowed(x.filename))) {
      return json({ error: "This change cannot be undone from here." }, 400);
    }
    const tree = [];
    for (const f of files) {
      let blob = null;
      if (f.status !== "added") {
        const before = await gh("/repos/" + site.repo + "/contents/" + f.filename + "?ref=" + parent);
        if (!before.ok || !before.data || !before.data.sha) return json({ error: "The earlier version could not be read." }, 502);
        blob = before.data.sha;
      }
      tree.push({ path: f.filename, mode: "100644", type: "blob", sha: blob });
    }
    const head = await gh("/repos/" + site.repo + "/git/ref/heads/" + ref);
    const headSha = head.ok && head.data && head.data.object ? head.data.object.sha : "";
    const headCommit = headSha ? await gh("/repos/" + site.repo + "/git/commits/" + headSha) : null;
    if (!headCommit || !headCommit.ok) return json({ error: "The working copy could not be read." }, 502);
    const made = await gh("/repos/" + site.repo + "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: headCommit.data.tree.sha, tree }) });
    if (!made.ok) return json({ error: writeProblem(made, "GitHub did not save the undo.") }, 502);
    if (made.data.sha === headCommit.data.tree.sha) return json({ ok: true, unchanged: true });
    const commit = await gh("/repos/" + site.repo + "/git/commits", { method: "POST", body: JSON.stringify({ message: "Undo: " + first.replace(/ \([^()@ ]+@[^()]+\)$/, "") + who, tree: made.data.sha, parents: [headSha] }) });
    if (!commit.ok) return json({ error: writeProblem(commit, "GitHub did not save the undo.") }, 502);
    const moved = await moveBranch(site, ref, commit.data.sha, false);
    if (!moved.ok) return json({ error: writeProblem(moved, "GitHub did not save the undo.") }, 502);
    return json({ ok: true });
  }

  // ----- copies: trial copies, undo and redo, publish -----
  if (COPY_ACTIONS.includes(action)) {
    const repo = "/repos/" + site.repo;
    if (action === "makeCopy") {
      const slug = copySlug(body.name);
      if (!slug) return json({ error: "Give the trial copy a short name, for example Winter look." }, 400);
      if (copies.filter((c) => c.kind === "trial").length >= MAX_TRIALS) return json({ error: "This site already has " + MAX_TRIALS + " trial copies. Delete one to make another." }, 400);
      const sha = await mainSha(site);
      const id = "trial-" + slug + "-" + randomTail();
      const made = await gh(repo + "/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/adh/" + id, sha }) });
      if (!sha || !made.ok) return json({ error: writeProblem(made, "GitHub did not make the copy. Please try again.") }, 502);
      return json({ ok: true, copy: id });
    }
    if (action === "deleteCopy") {
      if (copy.kind !== "trial") return json({ error: "The live site cannot be deleted." }, 400);
      await dropRedo(site, copy);
      const del = await gh(repo + "/git/refs/heads/" + copy.branch, { method: "DELETE" });
      if (!del.ok && del.status !== 422) return json({ error: writeProblem(del, "GitHub did not delete the copy.") }, 502);
      return json({ ok: true });
    }
    if (!copy.branch) return json({ ok: true, unchanged: true });

    if (action === "refreshCopy") {
      if (copy.behind === 0) return json({ ok: true, unchanged: true });
      await dropRedo(site, copy);
      const m = copy.ahead === 0
        ? await moveBranch(site, copy.branch, await mainSha(site), false)
        : await gh(repo + "/merges", { method: "POST", body: JSON.stringify({ base: copy.branch, head: "main", commit_message: "Bring in the latest live changes" + who }) });
      if (m.status === 409) return json({ error: "Live and this copy have both changed the same thing, so they cannot be joined automatically. Make the same edit on the copy by hand, or start a fresh copy." }, 409);
      if (!m.ok && m.status !== 204) return json({ error: writeProblem(m, "GitHub did not refresh the copy.") }, 502);
      return json({ ok: true });
    }

    if (action === "publish") {
      if (copy.ahead === 0) return json({ ok: true, unchanged: true });
      const message = (copy.kind === "live" ? "Publish: " + copy.ahead + (copy.ahead === 1 ? " change" : " changes") : "Make live: " + copy.name) + who;
      let newSha = "";
      const m = await gh(repo + "/merges", { method: "POST", body: JSON.stringify({ base: "main", head: copy.branch, commit_message: message }) });
      if (m.ok && m.data && m.data.sha) newSha = m.data.sha;
      else if (m.status === 409) {
        if (!body.replace) {
          const since = await gh(repo + "/compare/" + copy.branch + "...main");
          const theirs = since.ok && Array.isArray(since.data.commits) ? since.data.commits.slice(-8).reverse().map((c) => stepOf(c).what) : [];
          return json({ conflict: true, live: theirs });
        }
        // Live changed in the same places. Take the copy's words, pictures and theme, and keep everything else of live.
        const [mainRef, root] = await Promise.all([mainSha(site), gh(repo + "/git/trees/" + copy.sha + "?recursive=1")]);
        if (!mainRef || !root.ok || !Array.isArray(root.data.tree)) return json({ error: "The copy could not be read." }, 502);
        const mainCommit = await gh(repo + "/git/commits/" + mainRef);
        const tree = root.data.tree
          .filter((t) => t.type === "blob" && (CONTENT_FILES.includes(t.path) || /^(images|assets\/images)\/[^/]+$/.test(t.path)))
          .map((t) => ({ path: t.path, mode: t.mode, type: t.type, sha: t.sha }));
        const made = await gh(repo + "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: mainCommit.data.tree.sha, tree }) });
        if (!made.ok) return json({ error: writeProblem(made, "GitHub did not publish the copy.") }, 502);
        const commit = await gh(repo + "/git/commits", { method: "POST", body: JSON.stringify({ message, tree: made.data.sha, parents: [mainRef, copy.sha] }) });
        if (!commit.ok) return json({ error: writeProblem(commit, "GitHub did not publish the copy.") }, 502);
        const moved = await moveBranch(site, "main", commit.data.sha, false);
        if (!moved.ok) return json({ error: writeProblem(moved, "GitHub did not publish the copy. Please try again.") }, 502);
        newSha = commit.data.sha;
      } else return json({ error: writeProblem(m, "GitHub did not publish. Please try again.") }, 502);
      await dropRedo(site, copy);
      await moveBranch(site, copy.branch, newSha, true);   // the copy now matches live exactly
      return json({ ok: true });
    }

    if (action === "discard") {
      if (copy.kind !== "live") return json({ error: "To drop a trial copy, delete it." }, 400);
      await dropRedo(site, copy);
      const moved = await moveBranch(site, copy.branch, await mainSha(site), true);
      if (!moved.ok) return json({ error: writeProblem(moved, "GitHub did not discard the changes.") }, 502);
      return json({ ok: true });
    }

    if (action === "undoStep") {
      const n = Math.max(1, Math.min(20, Number(body.steps) || 1));
      if (copy.ahead < n) return json({ error: "There is nothing more to undo." }, 409);
      let at = copy.sha;
      for (let i = 0; i < n; i++) {
        const c = await gh(repo + "/git/commits/" + at);
        if (!c.ok || !c.data.parents || !c.data.parents[0]) return json({ error: "That step could not be undone." }, 502);
        at = c.data.parents[0].sha;
      }
      if (!copy.canRedo) {
        const kept = await gh(repo + "/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/adh-redo/" + copy.id, sha: copy.sha }) });
        if (!kept.ok) return json({ error: writeProblem(kept, "GitHub did not undo the step.") }, 502);
      }
      const moved = await moveBranch(site, copy.branch, at, true);
      if (!moved.ok) return json({ error: writeProblem(moved, "GitHub did not undo the step.") }, 502);
      return json({ ok: true });
    }

    if (action === "redoStep") {
      if (!copy.canRedo) return json({ error: "There is nothing to redo." }, 409);
      const tip = await gh(repo + "/git/ref/heads/adh-redo/" + copy.id);
      let at = tip.ok && tip.data.object ? tip.data.object.sha : "", next = "";
      const top = at;
      for (let i = 0; i < 40 && at; i++) {
        const c = await gh(repo + "/git/commits/" + at);
        const parent = c.ok && c.data.parents && c.data.parents[0] ? c.data.parents[0].sha : "";
        if (parent === copy.sha) { next = at; break; }
        at = parent;
      }
      if (!next) { await dropRedo(site, copy); return json({ error: "There is nothing to redo." }, 409); }
      const moved = await moveBranch(site, copy.branch, next, false);
      if (!moved.ok) return json({ error: writeProblem(moved, "GitHub did not redo the step.") }, 502);
      if (next === top) await dropRedo(site, copy);
      return json({ ok: true });
    }
  }

  if (action === "answerTopic") {
    const answer = body.answer === "yes" ? "yes" : body.answer === "no" ? "no" : null;
    if (!answer) return json({ error: "Answer must be yes or no." }, 400);
    const file = await getText(site.repo, "CONTENT-CALENDAR.md");
    if (!file) return json({ error: "The content calendar could not be read." }, 502);
    const next = setAnswer(file.text, String(body.title || ""), answer, body.note);
    if (!next) return json({ error: "That topic is no longer waiting for an answer." }, 409);
    const put = await gh("/repos/" + site.repo + "/contents/CONTENT-CALENDAR.md", {
      method: "PUT",
      body: JSON.stringify({
        message: "Topic answered " + answer + " from Artiscope Digital Home",
        content: encodeBase64Utf8(next),
        sha: file.sha,
      }),
    });
    if (!put.ok) return json({ error: writeProblem(put, "GitHub did not save the answer. Please try again.") }, 502);
    return json({ ok: true });
  }

  if (action === "publishDraft" || action === "returnDraft" || action === "rejectDraft") {
    const pull = await draftPull(site, body.number);
    if (!pull) return json({ error: "That draft is no longer open." }, 409);
    const base = "/repos/" + site.repo;

    if (action === "publishDraft") {
      const m = await gh(base + "/pulls/" + pull.number + "/merge", {
        method: "PUT",
        body: JSON.stringify({ merge_method: "squash" }),
      });
      if (!m.ok && (m.status === 401 || m.status === 403 || m.status === 404)) {
        return json({ error: writeProblem(m, "") }, 502);
      }
      if (!m.ok) {
        return json({
          error: "This draft could not be published as it stands. The agent will refresh it on its next run.",
        }, 409);
      }
      return json({ ok: true });
    }

    const note = String(body.note || "").trim().slice(0, 2000);
    if (action === "returnDraft" && !note) return json({ error: "Please say what should change." }, 400);
    if (note) {
      const label = action === "returnDraft" ? "Sent back by the owner" : "Rejected by the owner";
      await gh(base + "/issues/" + pull.number + "/comments", {
        method: "POST",
        body: JSON.stringify({ body: label + " (" + email + "):\n\n" + note }),
      });
    }
    if (action === "rejectDraft") {
      const c = await gh(base + "/pulls/" + pull.number, {
        method: "PATCH",
        body: JSON.stringify({ state: "closed" }),
      });
      if (!c.ok) return json({ error: writeProblem(c, "GitHub did not close the draft. Please try again.") }, 502);
    }
    return json({ ok: true });
  }

  if (action === "uploadPhoto") {
    let name = null;
    if (body.slot) {
      const slotFile = await getText(site.repo, "image-slots.json", ref);
      const known = slotFile ? parseSlots(slotFile.text) : [];
      if (!known.some((x) => x.id === body.slot)) return json({ error: "That spot is no longer on the site. Refresh and choose again." }, 409);
      name = slotPhotoName(body.slot, body.ext);
    } else {
      name = notePhotoName(body.description, body.ext);
    }
    if (!name) return json({ error: "Choose where the photo goes, or describe it, and use a JPG or PNG." }, 400);
    const content = String(body.content || "");
    if (!content || content.length > 7_500_000 || /[^A-Za-z0-9+/=]/.test(content)) {
      return json({ error: "That photo is too large or could not be read." }, 400);
    }
    const path = "/repos/" + site.repo + "/contents/inbox/" + name;
    const exists = await ghc(path);
    if (exists.ok) return json({ error: "A photo is already waiting for that spot. It will be placed shortly." }, 409);

    // The owner's description travels with the photo in a small note,
    // saved first so it is already there when the photo arrives.
    const alt = cleanText(body.alt, 240);
    const caption = cleanText(body.caption, 160);
    if (alt || caption) {
      const notePath = "/repos/" + site.repo + "/contents/inbox/" + name.replace(/\.(jpg|png)$/, ".json");
      const old = await ghc(notePath);
      const saved = await ghc(notePath, {
        method: "PUT",
        body: JSON.stringify({
          message: "Photo description from Artiscope Digital Home",
          content: encodeBase64Utf8(JSON.stringify({ alt, caption, sent_by: email }, null, 2) + "\n"),
          ...(old.ok && old.data && old.data.sha ? { sha: old.data.sha } : {}),
        }),
      });
      if (!saved.ok) return json({ error: writeProblem(saved, "GitHub did not accept the description. Please try again.") }, 502);
    }

    const put = await ghc(path, {
      method: "PUT",
      body: JSON.stringify({ message: "Add photo: " + (body.slot ? String(body.slot) : cleanText(body.description, 60)) + who, content }),
    });
    if (!put.ok) return json({ error: writeProblem(put, "GitHub did not accept the photo. Please try again.") }, 502);
    return json({ ok: true, name, slot: body.slot || null });
  }

  return json({ error: "Unknown request." }, 400);
}

if (globalThis.Deno) {
  globalThis.Deno.serve(handle);
}
