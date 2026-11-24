// Artiscope Digital Home: the one server-side piece.
// It checks who is signed in, then reads and writes the website
// repositories on GitHub on their behalf. The GitHub token never
// reaches the browser.
//
// Secrets this function needs (set in Supabase, never in code):
//   GITHUB_TOKEN     a fine-grained token limited to the site repositories
//   ALLOWED_EMAILS   the admin's email address (more than one only as a backstop)
// Editors are kept in the "people" table of the Supabase database (see PEOPLE_SQL below).
// SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEYS) is provided by Supabase and lets
// this function, and nothing else, read and write that table.
// SUPABASE_URL is provided by Supabase. This function checks every
// request itself, so its "Verify JWT" setting is switched off.

// One entry per website. To add a site, add an entry and redeploy.
// ---------- theme: colours and typefaces ----------

// The typefaces the console offers, each with the exact request Google
// Fonts needs for it. A short list on purpose.
// ----- Edit default text: the fixed words of each site's design -----
// Every word a site's design writes itself (buttons, empty spaces, Page not found, words for screen
// readers) is drawn through W("key", "the site's own words") in the site's code. Changed words are kept
// in the page list file under "words"; a word not changed keeps the site's own. These lists hold the
// site's own words, and tests/run.mjs checks they match the sites' code exactly.
export const WORD_GROUPS = [["menu", "Menu and links"], ["loading", "Loading screen"], ["btn", "Buttons"], ["table", "Auction table"], ["archive", "Archive search"],
  ["missing", "Missing or empty"], ["form", "Forms"], ["item", "Articles and artists"], ["note", "Notebook and reading tools"], ["toast", "Short messages"],
  ["search", "Search"], ["gw", "Gallery walk"], ["nf", "Page not found"], ["sr", "Words for screen readers"]];
// Words that cannot be changed here, and why. The form notes say honestly what the form does, and the
// rest follow each site's own rules.
const NOTE_LOCK = "This line says honestly what the form does, so it stays as it is.";
export const WORD_LOCKS = {
  war: { "form.note": NOTE_LOCK, "form.note-contact": NOTE_LOCK },
  gam: { "form.note": NOTE_LOCK, "item.who": "The heading of the publisher disclosure stays as it is, by the site's rules." },
  sad: { "form.note": NOTE_LOCK, "form.note-contact": NOTE_LOCK, "missing.date": "Stays until confirmed facts are given, by the site's rules.", "item.draft": "Stays until confirmed facts are given, by the site's rules." },
  starter: { "form.note": NOTE_LOCK, "form.note-contact": NOTE_LOCK },
  tsad: { "form.note": NOTE_LOCK, "form.note-contact": NOTE_LOCK },
  twar: { "form.note": NOTE_LOCK, "form.note-contact": NOTE_LOCK },
  ttac: { "form.note": NOTE_LOCK, "form.note-contact": NOTE_LOCK },
  ted: { "form.note": NOTE_LOCK, "form.note-contact": NOTE_LOCK, "form.note-work": NOTE_LOCK },
  ttawr: { "form.note": NOTE_LOCK, "form.note-contact": NOTE_LOCK },
  tgam: { "form.note": NOTE_LOCK, "item.who": "The heading of the publisher disclosure stays as it is: readers are always told who publishes the site." },
};
export const WAR_WORDS = {
  "menu.close": "Close", "menu.artists": "Artists A to Z", "menu.reviews": "Reviews", "menu.explained": "Art Explained",
  "menu.library": "Collector's Library", "menu.method": "How we research", "menu.subscribe": "Subscribe", "menu.search": "Search",
  "menu.notebook-count": "Your notebook ({n})", "menu.notebook": "Your notebook", "menu.open": "Menu", "btn.close": "Close",
  "btn.join": "Ask to join", "btn.back-reading": "Back to reading", "btn.previous": "Previous", "btn.next": "Next",
  "btn.leave-gallery": "Leave the gallery", "btn.see-sources": "See in sources", "btn.open-original": "Open original", "btn.remove": "Remove",
  "btn.delete": "Delete", "btn.count": "{n} of {total}", "btn.top": "Top", "btn.prev-artist": "Previous artist", "btn.next-artist": "Next artist",
  "btn.source": "Source", "btn.read-source": "Read it at the source", "btn.write": "Write the email", "btn.walk": "Walk the gallery",
  "btn.read-next": "Read next", "btn.copy": "Copy link", "btn.open-portfolio": "Open the portfolio", "missing.image": "Image to supply",
  "missing.untitled": "Untitled work", "missing.work": "Work to be documented", "missing.artwork-image": "Artwork image to supply",
  "missing.title": "Title to confirm", "missing.dates": "Dates to confirm", "missing.year": "Year to confirm", "missing.to-add": "To add",
  "form.your-name": "Your name", "form.email": "Your email", "form.sub-err": "We need a working email address to send it to.",
  "form.topics": "Anything you would like us to cover? Optional.", "form.thanks": "Your email app should now be open.",
  "form.thanks-name": "Thank you, {name}. Your email app should now be open.",
  "form.need-email": "We need a working email address, so we can reply.", "form.need-message": "Write your message first.",
  "form.subject": "Please add me to the World Art Review letter", "form.first-name": "Your first name",
  "form.note": "This opens your own email app with a message ready to send to {email}.", "form.topic": "What it is about",
  "form.message": "Your message", "form.note-contact": "This opens your own email app with your message ready to send to {email}.",
  "item.sources": "Sources", "item.spotted": "Spotted an error?", "item.tell-us": "Tell us how to correct it", "item.year": "Year",
  "item.medium": "Medium", "item.size": "Size", "item.notes": "Notes", "item.source": "Source", "item.reported": "Reported",
  "item.in-research": "Portfolio in research", "item.glance": "At a glance", "item.see-missing": "See what is missing",
  "item.in-portfolio": "In this portfolio", "item.works": "Documented works", "item.career": "Career timeline",
  "item.where": "Where to see the work", "item.reading-now": "Reading now", "item.back": "Back to the section",
  "item.in-article": "Artists in this article", "item.related": "Related", "note.ask": "What do you notice?", "note.in": "In your notebook",
  "note.writing": "Writing...", "note.saved": "Saved in your notebook", "note.empty-saved": "Use the bookmark on any article to keep it here.",
  "note.empty-notes": "Open any documented work and write down what you notice. Your notes collect here.",
  "note.kept": "Kept in this browser only. Nobody else can see it.", "note.saved-read": "Saved to read", "note.noticed": "What you noticed",
  "note.deleted": "Note deleted", "note.ask-hint": "A colour, a mark, a detail you keep coming back to",
  "toast.removed": "Removed from your reading list", "toast.saved": "Saved to your reading list", "toast.smaller": "Smaller text",
  "toast.larger": "Larger text", "toast.standard": "Standard text", "toast.copied": "Link copied", "toast.no-copy": "Copying is not available here",
  "search.hint": "Artists, artworks, techniques", "search.keys-move": "Up and down arrows to move", "search.keys-open": "Enter to open",
  "search.keys-close": "Esc to close", "gw.kicker": "Gallery walk", "gw.note-hint": "Write it down before you move on",
  "gw.hint": "Drag, scroll or use the arrow keys.", "nf.eyebrow": "Not found", "nf.line1": "We could not", "nf.line2": "find that page",
  "nf.home": "Return to the homepage", "sr.menu": "Menu", "sr.more": "More", "sr.search": "Search World Art Review",
  "sr.close-search": "Close search", "sr.results": "Results", "sr.wall": "Works on the wall", "sr.source": "Source", "sr.tools": "Reading tools",
  "sr.remove": "Remove {title}", "sr.delete-note": "Delete this note", "sr.text-size": "Change text size", "sr.save": "Save to reading list",
  "sr.sections": "Sections", "sr.open-menu": "Open menu", "sr.share": "Share this page", "sr.privacy": "Privacy", "sr.elsewhere": "Elsewhere",
  "sr.larger": "Larger picture", "sr.breadcrumb": "Breadcrumb",
};
export const GAM_WORDS = {
  "menu.skip": "Skip to content", "menu.open": "Menu", "menu.close": "Close", "menu.foot-sections": "Sections", "menu.foot-artists": "Artists",
  "menu.foot-about": "About", "loading.line": "Art market intelligence, beyond the headlines.", "loading.word": "Loading",
  "btn.read-feature": "Read the feature", "btn.open-profile": "Open the market profile", "btn.tell-me": "Tell me when a profile is added",
  "btn.full-method": "Read the full method", "btn.count": "{n} of {total}", "btn.previous": "Previous", "btn.next": "Next", "btn.source": "Source",
  "btn.read-source": "Read it at the source", "btn.join": "Ask to join", "btn.close": "Close", "table.from": "From {low}",
  "table.calculated": "Our calculation", "table.lot": "Lot {lot}", "table.swipe": "Swipe sideways to see every column.", "table.date": "Sale date",
  "table.artist": "Artist", "table.work": "Work", "table.house": "House and sale", "table.estimate": "Estimate", "table.hammer": "Hammer price",
  "table.premium": "With premium", "table.currency": "Currency", "table.source": "Source", "table.key-hammer": "Hammer price",
  "table.key-premium": "Price with premium", "table.key-estimate": "Estimate", "table.bar-high": "High estimate {price}",
  "table.bar-hammer": "Hammer {price}", "table.bar-premium": "With premium {price}", "table.chip-premium": "With buyer's premium",
  "missing.high": "High estimate to confirm", "missing.tbc": "To confirm", "missing.no-priced": "No priced sale documented yet.",
  "missing.picture": "Picture to supply", "missing.title": "Title to confirm", "missing.to-add": "To add", "missing.no-dated": "No dated sale yet.",
  "form.first-name": "First name", "form.email": "Email", "form.note": "This opens your own email app with a message ready to send to {email}.",
  "form.need-email": "We need a working email address, so we can reply.", "form.subject": "Please add me to the market note",
  "form.sent": "Your email app should now be open with the message ready. Send it and you are on the list. If nothing opened, write to {email}.",
  "item.reported": "Reported", "item.crumb-artists": "Artist Market Profiles", "item.highest": "Highest documented price",
  "item.priced": "Priced results", "item.out-of": "Out of {total} lots we have found.", "item.earliest": "Earliest dated sale",
  "item.houses": "Auction houses", "item.timeline": "Artist auction timeline", "item.at-auction": "{name} at auction",
  "item.side-by-side": "Estimate, hammer and total, side by side", "item.about": "About the artist", "item.related": "Related reading",
  "item.sources": "Background sources", "item.gap": "Spotted a gap?", "item.crumb-research": "Research Reports", "item.more": "More research",
  "item.figures": "The figures", "item.who": "Who publishes this", "nf.eyebrow": "Page not found", "nf.title": "That page is not in the record.",
  "nf.lede": "The link may be old or mistyped.", "nf.home": "Go to the home page", "nf.results": "Browse auction results", "sr.nav": "Sections",
  "sr.menu": "All sections", "sr.social": "Social media", "sr.share": "Share this page", "sr.privacy": "Privacy",
  "sr.table": "Auction results table",
  "sr.ladder": "Bar comparison of estimate, hammer price and price with premium for each priced sale. The same figures are in the table.",
  "sr.filter-artist": "Filter by artist", "sr.filter-house": "Filter by auction house", "sr.larger": "Larger picture",
};
export const SAD_WORDS = {
  "menu.open": "Menu", "menu.close": "Close", "menu.skip": "Skip to content", "btn.read-story": "Read the story", "btn.open-profile": "Open profile",
  "btn.read-column": "Read the column", "btn.read-dispatch": "Read the dispatch", "btn.close": "Close", "btn.join": "Ask to join",
  "btn.count": "{n} of {total}", "btn.previous": "Previous", "btn.next": "Next", "btn.source": "Source", "btn.read-source": "Read it at the source",
  "btn.write": "Write the email", "btn.read-next": "Read next", "archive.all-years": "All years", "archive.search": "Search",
  "archive.artist": "Artist", "archive.all-artists": "All artists", "archive.city": "City", "archive.all-cities": "All cities",
  "archive.year": "Year", "archive.count": "{n} interventions, newest first", "archive.clear": "Clear filters",
  "archive.empty": "Nothing matches those filters yet.", "archive.showing": "Showing {shown} of {total} interventions",
  "missing.photo": "Photo to come", "missing.awaiting": "Awaiting confirmation", "missing.soon": "Coming soon", "missing.date": "Date to confirm",
  "missing.title": "Title to confirm", "missing.tbc": "To confirm", "missing.to-add": "To add",
  "missing.commission": "Photograph to be commissioned.", "form.email": "Email address", "form.placeholder": "you@example.com",
  "form.note": "This opens your own email app with a message ready to send to {email}.", "form.name": "Your name", "form.your-email": "Your email",
  "form.topic": "What it is about", "form.message": "Your message",
  "form.note-contact": "This opens your own email app with your message ready to send to {email}.", "form.subject": "Subscribe to the Dispatch",
  "form.sent-box": "Your email app should open with a subscription request. Send it and we’ll add you.",
  "form.need-email": "We need a working email address, so we can reply.", "form.need-message": "Please write your message first.",
  "form.sent": "Your email app should now be open with the message ready. Send it and it reaches us. If nothing opened, write to {email}.",
  "form.need-email-join": "We need a working email address, so we can add you.",
  "form.sent-join": "Your email app should now be open with the message ready. Send it and we will add you. If nothing opened, write to {email}.",
  "item.min-read": "{n} min read", "item.mins": "{n} min", "item.dates": "Dates:", "item.reported": "Reported", "item.draft": "Draft",
  "item.filed": "Filed under {tags}.", "item.next-column": "Next column", "item.next-dispatch": "Next dispatch", "item.in-archive": "In the archive",
  "item.see-archive": "See these entries in the archive", "item.crumb-artists": "Artists", "item.kicker-artist": "Artist",
  "item.read-more": "Read more", "nf.eyebrow": "Page not found", "nf.title": "That page isn’t here.",
  "nf.lede": "It may have moved, or the address may be mistyped.", "nf.home": "Go to the front page", "nf.or": "or",
  "nf.archive": "search the archive", "sr.social": "Social media", "sr.photo": "Photograph to come: {what}", "sr.share": "Share this page",
  "sr.privacy": "Privacy", "sr.nav": "Sections", "sr.menu": "Menu", "sr.photo-box": "Photo",
};
export const STARTER_WORDS = {
  "menu.articles": "Articles", "menu.artists": "Artists", "menu.open": "Menu", "menu.close": "Close", "menu.skip": "Skip to content",
  "btn.join": "Ask to join", "btn.close": "Close", "btn.count": "{n} of {total}", "btn.previous": "Previous", "btn.next": "Next",
  "btn.source": "Source", "btn.read-source": "Read it at the source", "btn.write": "Write the email", "btn.read-next": "Read next",
  "missing.photo": "Photo to come", "missing.title": "Title to confirm", "missing.tbc": "To confirm", "missing.to-add": "To add",
  "form.email": "Email address", "form.placeholder": "you@example.com",
  "form.note": "This opens your own email app with a message ready to send to {email}.", "form.name": "Your name", "form.your-email": "Your email",
  "form.topic": "What it is about", "form.message": "Your message",
  "form.note-contact": "This opens your own email app with your message ready to send to {email}.",
  "form.need-email-join": "We need a working email address, so we can add you.", "form.subject": "Join the {site} mailing list",
  "form.sent-join": "Your email app should now be open with the message ready. Send it and we will add you. If nothing opened, write to {email}.",
  "form.need-email": "We need a working email address, so we can reply.", "form.need-message": "Please write your message first.",
  "form.sent": "Your email app should now be open with the message ready. Send it and it reaches us. If nothing opened, write to {email}.",
  "item.reported": "Reported", "item.dates": "Dates:", "item.sources": "Sources", "item.about": "About", "item.next": "Next article",
  "item.kicker-artist": "Artist", "item.articles-about": "Articles about {name}", "nf.eyebrow": "Page not found",
  "nf.title": "That page is not here.", "nf.lede": "It may have moved, or the address may be mistyped.", "nf.home": "Go to the home page",
  "sr.social": "Social media", "sr.photo": "Photograph to come: {what}", "sr.share": "Share this page", "sr.privacy": "Privacy", "sr.nav": "Pages",
  "sr.menu": "Menu", "sr.links": "Links", "sr.photo-box": "Photo",
};
// The longest a changed word may be: short for buttons, menus and table headings, so they never break the layout.
export function wordMax(key) { return ["menu", "btn", "table"].includes(String(key).split(".")[0]) ? 40 : 200; }
const SLOT_WORDS = { name: "the artist's name", email: "the email address", n: "the number", total: "the total", low: "the low estimate", price: "the price",
  lot: "the lot number", tags: "the subjects", what: "what the photograph shows", shown: "the number shown", site: "the site's name", title: "the title", date: "the date" };
export const slotsOf = (t) => [...String(t).matchAll(/\{([a-z]+)\}/g)].map((m) => m[1]);
// What the console needs for Edit default text: the groups, and each word with the site's own words, its longest and why it is locked.
export function wordSpec(site) {
  const list = site.words || {}, locks = site.wordLocks || {};
  return { groups: WORD_GROUPS, words: Object.keys(list).map((k) => ({ k, t: list[k], max: wordMax(k), lock: locks[k] || "" })) };
}
// Cleans the changed words: plain words only, known and not locked, within their length, with every slot kept.
export function cleanWords(site, given) {
  const list = site.words || {}, locks = site.wordLocks || {}, out = {};
  if (!given || typeof given !== "object" || Array.isArray(given)) return out;
  for (const [k, v] of Object.entries(given)) {
    if (!Object.prototype.hasOwnProperty.call(list, k) || locks[k] || typeof v !== "string") continue;
    const t = v.replace(/<[^>]*>?/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    if (!t || t === list[k]) continue;
    if (t.length > wordMax(k)) throw new Error("The words in place of \"" + list[k] + "\" are too long. Keep them to " + wordMax(k) + " letters or fewer.");
    const need = slotsOf(list[k]), lost = need.filter((x) => !t.includes("{" + x + "}"));
    if (lost.length) throw new Error("Keep {" + lost[0] + "} in the words in place of \"" + list[k] + "\". It is where " + (SLOT_WORDS[lost[0]] || "the site's own detail") + " goes.");
    const odd = slotsOf(t).filter((x) => !need.includes(x));
    if (odd.length) throw new Error("{" + odd[0] + "} is not something the site can fill in for \"" + list[k] + "\". Take it out, or use " + (need.length ? need.map((x) => "{" + x + "}").join(" or ") : "plain words") + ".");
    out[k] = t;
  }
  return out;
}
export const FONTS = {
  "Castoro": "Castoro:ital@0;1",
  "Gloock": "Gloock",
  "Libre Caslon Display": "Libre+Caslon+Display",
  "Libre Caslon Text": "Libre+Caslon+Text:ital@0;1",
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
  "Syne": "Syne:wght@600;700;800",
  "Anton": "Anton",
  "DM Sans": "DM+Sans:wght@400;500;700",
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
  decl.push(...themeVars(values.settings));
  return { css: decl.length ? ":root{" + decl.join(";") + "}" : "", font_links: links };
}

// The site-wide settings in the editor's Theme settings, the same for every site.
// A slider left at "the site's own" is kept as null, and then changes nothing.
const SOCIAL = [["instagram", "Instagram", "https://www.instagram.com/yourname"], ["x", "X", "https://x.com/yourname"], ["linkedin", "LinkedIn", "https://www.linkedin.com/company/yourname"],
  ["facebook", "Facebook", "https://www.facebook.com/yourname"], ["pinterest", "Pinterest", "https://www.pinterest.com/yourname"], ["youtube", "YouTube", "https://www.youtube.com/@yourname"], ["tiktok", "TikTok", "https://www.tiktok.com/@yourname"]];
export const THEME_SETTINGS = [
  { name: "h_size", group: "Headings", label: "Size", type: "range", min: 70, max: 140, step: 5, unit: "%", dflt: 100, reset: true },
  { name: "h_track", group: "Headings", label: "Letter spacing", type: "range", min: -5, max: 20, step: 1, unit: "%", dflt: 0, reset: true, hint: "Space between letters, as a share of the letter size." },
  { name: "h_lh", group: "Headings", label: "Line height", type: "range", min: 85, max: 180, step: 5, unit: "%", dflt: 110, reset: true },
  { name: "h_caps", group: "Headings", label: "Capital letters", type: "yesno" },
  { name: "b_size", group: "Body text", label: "Size", type: "range", min: 80, max: 130, step: 5, unit: "%", dflt: 100, reset: true },
  { name: "b_track", group: "Body text", label: "Letter spacing", type: "range", min: -3, max: 10, step: 1, unit: "%", dflt: 0, reset: true },
  { name: "b_lh", group: "Body text", label: "Line height", type: "range", min: 120, max: 210, step: 5, unit: "%", dflt: 160, reset: true },
  { name: "nav_font", group: "Navigation", label: "Typeface of the menu", type: "choice", options: [["", "Site's own"], ["body", "Body text"], ["heading", "Headings"]] },
  { name: "nav_size", group: "Navigation", label: "Size", type: "range", min: 80, max: 130, step: 5, unit: "%", dflt: 100, reset: true },
  { name: "nav_caps", group: "Navigation", label: "Capital letters", type: "yesno" },
  { name: "dir", group: "Language", label: "Text direction", type: "choice", options: [["ltr", "Left to right"], ["rtl", "Right to left"]], hint: "Right to left is for languages such as Arabic and Hebrew." },
  { name: "corners", group: "Design", label: "Corners", type: "choice", options: [["", "Site's own"], ["square", "Square"], ["round", "Round"]], hint: "Buttons, boxes and pictures." },
  { name: "buttons", group: "Design", label: "Button style", type: "choice", options: [["", "Filled"], ["outline", "Outline"]] },
  ...SOCIAL.map((x) => ({ name: "social_" + x[0], group: "Social media", label: x[1], type: "text", social: true, hint: "For example " + x[2] })),
  { name: "favicon", group: "Favicon", label: "Favicon", type: "image", hint: "Shown at 32 by 32 pixels in the browser tab. A square picture works best." },
  { name: "crumbs", group: "Extras", label: "Show breadcrumbs", type: "yesno", only: "crumbs", hint: "The trail of links at the top of an article, such as Home, Art Explained." },
  { name: "css", group: "Custom CSS", label: "Custom CSS", type: "code" },
];
function cleanThemeSetting(f, v) {
  if (v == null || v === "") return f.type === "yesno" ? null : f.type === "range" ? null : "";
  if (f.type === "range") { const n = Number(v); if (!Number.isFinite(n)) return null; return Math.min(f.max, Math.max(f.min, Math.round(n / f.step) * f.step)); }
  if (f.type === "yesno") return v === true || v === "true";
  if (f.type === "choice") return f.options.some((o) => o[0] === String(v)) ? String(v) : "";
  if (f.type === "image") { const x = String(v); return /^[A-Za-z0-9._-]{1,120}\.(png|jpe?g|svg|ico)$/i.test(x) ? x : ""; }
  if (f.type === "code") return cleanCss(v);
  if (f.social) { const x = String(v).trim().slice(0, 200); if (!/^https:\/\/[^\s<>"'`]+$/.test(x)) throw new Error(f.label + " needs a full address starting https://"); return x; }
  return cleanText(v, 200);
}
// The rules a theme adds on top of a site's own styling. Only what was changed is written.
export function themeRules(spec, st) {
  const L = spec.look || {}, out = [], has = (k) => st && st[k] != null && st[k] !== "";
  const head = L.head || "h1, h2, h3, h4", body = L.body || "p, li, dd", nav = L.nav || "nav a";
  if (has("h_track")) out.push(head + "{letter-spacing:" + st.h_track / 100 + "em !important}");
  if (has("h_lh")) out.push(head + "{line-height:" + st.h_lh / 100 + " !important}");
  if (st && st.h_caps) out.push(head + "{text-transform:uppercase !important}");
  if (has("b_track")) out.push(body + "{letter-spacing:" + st.b_track / 100 + "em !important}");
  if (has("b_lh")) out.push(body + "{line-height:" + st.b_lh / 100 + " !important}");
  const nf = { body: L.bodyFont, heading: L.headFont }[st && st.nav_font];
  if (nf) out.push(nav + "{font-family:" + nf + " !important}");
  if (st && st.nav_caps) out.push(nav + "{text-transform:uppercase !important;letter-spacing:.06em !important}");
  if (st && st.dir === "rtl") out.push("html, body{direction:rtl}");
  if (has("corners") && L.round) out.push(L.round + "{border-radius:" + (st.corners === "round" ? "10px" : "0") + " !important}");
  if (st && st.buttons === "outline" && L.buttons) out.push(L.buttons + "{background:transparent !important;color:" + (L.band || "currentColor") + " !important;box-shadow:inset 0 0 0 2px currentColor !important}");
  if (st && st.crumbs === false && L.crumbs) out.push(L.crumbs + "{display:none !important}");
  const own = st && st.css ? cleanCss(st.css) : "";
  return out.join("\n") + (own ? (out.length ? "\n" : "") + own : "");
}
function themeVars(st) {
  const v = [];
  for (const [k, n] of [["h_size", "--h-scale"], ["b_size", "--b-scale"], ["nav_size", "--nav-scale"]]) if (st && st[k] != null && st[k] !== "" && Number(st[k]) !== 100) v.push(n + ":" + Number(st[k]) / 100);
  return v;
}
// Keeps only what the theme allows: six-figure colour codes and listed typefaces.
// What a site's theme file holds: the choices, and what the site's build turns into its page head.
export function themeFile(site, spec, v) {
  const st = v.settings || {}, social = {};
  for (const x of SOCIAL) if (st["social_" + x[0]]) social[x[0]] = { label: x[1], href: st["social_" + x[0]] };
  return Object.assign({}, v, themeCss(spec, v), { rules: themeRules(spec, st), social, favicon: st.favicon ? site.pages.images + "/" + st.favicon : "" });
}
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
  out.settings = {};
  const st = (given || {}).settings || {};
  for (const f of THEME_SETTINGS) { if (f.only && !(spec.look || {})[f.only]) continue; out.settings[f.name] = cleanThemeSetting(f, st[f.name]); }
  return out;
}


// ---------- pages: what each kind of section offers to edit ----------
//
// A field: { name, label, type, ... }. Types: text, long (plain writing with
// formatting), lines (one item per paragraph), number, yesno, choice (options),
// colour (theme colours or any), image (a file in images/), artists (pick from
// the site's artists), rows (a list of small records with their own fields),
// links (label and address pairs).

const BG = { name: "bg", label: "Background", type: "colour", group: "Look", theme: [["paper", "Page background"], ["deep", "Deeper paper"], ["green", "Bands and buttons"]], hint: "Theme colours keep the site consistent. Choose Any colour for something else." };
const FG = { name: "fg", label: "Text colour", type: "colour", group: "Look", theme: [["", "Automatic"]], hint: "Automatic picks dark or light text to suit the background." };
const HEADING = { name: "heading", label: "Heading", type: "lines", hint: "Each line of the heading on its own line. Two short lines read best." };
const EYEBROW = { name: "eyebrow", label: "Small line above the heading", type: "text", hint: "Shown in small italics. Leave empty to hide." };
const ADDRESS = { name: 1, label: "Address", type: "text", hint: "A page on this site starts with #, for example #artists. Or paste a full web address." };
const LINK_ROWS = { name: "links", label: "Links", type: "rows", fields: [{ name: 0, label: "Words", type: "text", hint: "What visitors see." }, ADDRESS] };
// Logos in the menu bar: as many as wanted, each with its own size, place and link.
const LOGO_ROWS = { name: "logos", label: "Logos", type: "rows", fields: [
  { name: "image", label: "Logo", type: "image", alt: "alt", button: "Upload a logo", hint: "A PNG with a clear background works best." },
  { name: "alt", label: "Name, read aloud to people who cannot see it", type: "text", hint: "For example Grove Gallery." },
  { name: "size", label: "Size", type: "choice", seg: true, dflt: "M", options: [["S", "Small"], ["M", "Medium"], ["L", "Large"]] },
  { name: "place", label: "Place in the menu bar", type: "choice", seg: true, options: [["L", "Left"], ["C", "Centre"], ["R", "Right"]] },
  { name: "href", label: "Opens when clicked", type: "text", addr: true, hint: "A page on this site such as #home, or a full web address starting https://. Leave empty for no link." },
] };
const LOGO_BLOCK = { field: "logos", label: "Logo", add: "Add a logo", about: "A logo in the menu bar. Add more than one, for example the gallery's beside the site's." };

const WAR_SECTIONS = {
  opening: { label: "Opening screen", about: "The short screen shown while the site loads.", summary: (st) => st.name || "", fields: [{ name: "name", label: "Site name", type: "text", hint: "Shown beside the logo." }, { name: "tagline", label: "Tagline", type: "text", hint: "Small words under the name." }] },
  header: { label: "Menu bar", about: "The bar at the top of every page.", summary: (st) => ((st.links || []).length + " links" + ((st.logos || []).length ? ", " + st.logos.length + ((st.logos || []).length === 1 ? " logo" : " logos") : "")), blocks: [{ field: "links", label: "Link", add: "Add a link", about: "A link on the left of the menu bar." }, LOGO_BLOCK], fields: [{ name: "name", label: "Site name", type: "text", hint: "Shown in the middle of the bar." }, LINK_ROWS, LOGO_ROWS] },
  footer: { label: "Newsletter and footer", about: "The sign-up band and the links at the bottom of every page.", summary: (st) => ((st.columns || []).length + " columns"), blocks: { field: "columns", label: "Column", add: "Add a column", title: (b) => b.title, blocks: [{ field: "links", label: "Link", add: "Add a link", about: "One link in this column: its words and where it goes." }] }, fields: [
    EYEBROW, HEADING, { name: "button", label: "Button words", type: "text", hint: "The button opens the sign-up form." }, { name: "blurb", label: "Short description of the site", type: "long", hint: "Shown under the name, at the bottom left." },
    { name: "columns", label: "Link columns", type: "rows", fields: [{ name: "title", label: "Column title", type: "text", hint: "A short word or two, such as Read." }, { ...LINK_ROWS, label: "Links in this column" }] },
    { name: "copyright", label: "Copyright line", type: "text" }, { name: "elsewhere", label: "Links in the bottom bar", type: "rows", fields: LINK_ROWS.fields },
  ] },
  hero: { label: "Opening banner", about: "The large green band, usually at the top of the home page. On another page it takes the place of the menu bar.", summary: (st) => (st.headline || []).filter((x) => x && !x.hidden).map((x) => x.t).join(" "), blocks: [
    { field: "headline", label: "Headline line", add: "Add a headline line", about: "One line of the large headline." },
    { field: "picture", label: "Picture", one: true, hide: "hide_picture", fields: ["image", "alt", "credit", "artist"], about: "The picture on the right of the banner, with the artist's details beside it." },
    { field: "tagline", label: "Tagline line", add: "Add a tagline line", about: "One line of the smaller words at the bottom left." },
    { field: "latest", label: "Latest box piece", add: "Add a piece", about: "One piece shown in turn in the Latest box.", item: { name: null, label: "Piece", type: "piece" } },
    { field: "rule", label: "Rule box", one: true, hide: "hide_rule", fields: ["rule_label", "rule_text", "rule_link"], about: "The box at the bottom right of the banner." },
  ], fields: [
    { name: "headline", label: "Headline", type: "rows", hint: "Each line of the large headline. Italic lines are set in the slanted style.", fields: [{ name: "t", label: "Words", type: "text" }, { name: "ital", label: "In italics", type: "yesno" }] },
    { name: "tagline", label: "Tagline", type: "rows", hint: "The smaller words at the bottom left of the banner.", fields: [{ name: "t", label: "Words", type: "text" }, { name: "ital", label: "In italics", type: "yesno" }] },
    { name: "image", label: "Main picture", type: "image", alt: "alt", hint: "Leave empty to show the picture of the artist chosen below. A picture here is used in this banner only." },
    { name: "alt", label: "Describe the picture", type: "text", hint: "Read aloud to people who cannot see it." },
    { name: "credit", label: "Credit under the picture", type: "text", hint: "For example the title of the work and the photographer. Leave empty for none." },
    { name: "artist", label: "Whose work is shown", type: "artists", one: true, hint: "Leave empty for the first published artist. Their name and details sit beside the picture." },
    { name: "rule_label", label: "Rule box, small line", type: "text", hint: "The box at the bottom right of the banner." }, { name: "rule_text", label: "Rule box, text", type: "text" }, { name: "rule_link", label: "Rule box, link words", type: "text", hint: "The link opens the page about sources." },
    { name: "latest", label: "Pieces in the Latest box", type: "lines", hint: "Article names as they appear in web addresses, for example zara-muse-profile." },
    { name: "hide_picture", label: "Hide the picture", type: "yesno", internal: true }, { name: "hide_rule", label: "Hide the rule box", type: "yesno", internal: true },
  ] },
  featured: { label: "Featured artists", about: "The artist carousel under the banner. With no artists added, every published artist is shown.", summary: (st) => ((st.artists || []).length ? (st.artists || []).length + " chosen" : "All published"), blocks: [{ field: "artists", label: "Artist", add: "Add an artist", about: "One artist in the carousel, in this order.", item: { name: null, label: "Which artist", type: "artists", one: true } }], fields: [
    { name: "badge", label: "Badge words", type: "text", hint: "Under the number in the small square." }, { name: "artists", label: "Which artists", type: "artists", hint: "Tick the artists to show, in the order ticked. Leave all empty to show every published artist." },
  ] },
  "section-list": { label: "Read by section", about: "A list of the parts of the site, each with a count.", summary: (st) => ((st.rows || []).length + " rows"), blocks: { field: "rows", label: "Row", add: "Add a row", title: (b) => b.name }, fields: [
    EYEBROW, HEADING,
    { name: "rows", label: "Rows", type: "rows", fields: [{ name: "n", label: "Number", type: "text", hint: "Shown small on the left, such as 01." }, { name: "name", label: "Name", type: "text" }, { name: "desc", label: "Description", type: "text", hint: "One short sentence." }, { name: "href", label: "Address", type: "text", hint: "Where the row leads. A page on this site starts with #." }, { name: "count", label: "Count shown", hint: "The number on the right is counted for you.", type: "choice", options: [["artists", "Artists"], ["reviews", "Reviews"], ["explained", "Art explained pieces"], ["library", "Library guides"], ["articles", "All articles"], ["sources", "Sources"]] }, { name: "unit", label: "Count word", type: "text" }] },
  ] },
  explained: { label: "Art, explained", about: "Two Art Explained articles beside a short introduction.", summary: (st) => ((Number(st.count) || 2) + " articles"), fields: [HEADING, { name: "text", label: "Text", type: "long", plain: true, hint: "One or two sentences." }, { name: "count", label: "How many articles", type: "number", hint: "The newest Art Explained articles are shown." }] },
  numbers: { label: "Numbers band", about: "Four figures counted from the site.", summary: () => "Four figures", fields: [EYEBROW, HEADING, { name: "labels", label: "The four labels", type: "lines", hint: "One label per line. The numbers are counted for you." }] },
  method: { label: "How we research", about: "Three cards explaining the method.", summary: (st) => ((st.cards || []).length + " cards"), blocks: { field: "cards", label: "Card", add: "Add a card", title: (b) => b.title }, fields: [
    EYEBROW, HEADING,
    { name: "cards", label: "Cards", type: "rows", fields: [{ name: "n", label: "Number", type: "text", hint: "Shown large at the top of the card." }, { name: "title", label: "Title", type: "text", hint: "Shown in bold at the foot of the card." }, { name: "text", label: "Text", type: "long", hint: "Two or three short sentences read best." }, { name: "sub", label: "Small line", type: "text", hint: "Grey text under the title. Leave empty to hide." }] },
  ] },
  text: { label: "Text", about: "A heading and a few paragraphs.", summary: (st) => ((st.heading || [])[0] || "Text"), library: "A heading and paragraphs", fields: [EYEBROW, HEADING, { name: "body", label: "Text", type: "long", hint: "Type as you would in a document." }, { name: "align", label: "Placing", type: "choice", group: "Look", options: [["", "Left"], ["centre", "Centred"]] }, BG, FG],
    starter: { eyebrow: "", heading: ["A new heading"], body: "<p>Write here.</p>", align: "", bg: "paper", fg: "" } },
  "text-picture": { label: "Text with picture", about: "Words on one side, a photo on the other.", summary: (st) => ((st.heading || [])[0] || "Text with picture"), library: "Words beside a photo", fields: [EYEBROW, HEADING, { name: "body", label: "Text", type: "long" }, { name: "image", label: "Picture", type: "image", alt: "alt" }, { name: "alt", label: "Describe the picture", type: "text", hint: "For people who cannot see it. Needed before you save." }, { name: "caption", label: "Caption", type: "text", hint: "Small text under the picture. Leave empty to hide." }, { name: "side", group: "Look", label: "Picture on the", type: "choice", options: [["right", "Right"], ["left", "Left"]] }, BG, FG],
    starter: { eyebrow: "", heading: ["A new heading"], body: "<p>Write here.</p>", image: "", alt: "", caption: "", side: "right", bg: "paper", fg: "" } },
  picture: { label: "Picture", about: "One large photo with a caption.", summary: (st) => (st.caption || st.image || "Picture"), library: "One large photo, with a caption", fields: [{ name: "image", label: "Picture", type: "image", alt: "alt" }, { name: "alt", label: "Describe the picture", type: "text", hint: "For people who cannot see it. Needed before you save." }, { name: "caption", label: "Caption", type: "text", hint: "Small text under the picture. Leave empty to hide." }, { name: "size", group: "Look", label: "Width", type: "choice", options: [["", "Full width"], ["contained", "Contained"]] }, BG],
    starter: { image: "", alt: "", caption: "", size: "", bg: "paper" } },
  quote: { label: "Quote", about: "One line, shown large.", summary: (st) => (Array.isArray(st.text) ? st.text[0] : String(st.text || "").split("\n")[0]) || "", library: "A short line that stands out", fields: [{ name: "text", label: "The quote", type: "lines", hint: "Each line of the quote on its own line." }, { name: "who", label: "Who said it", type: "text", hint: "Leave empty to hide." }, BG, FG],
    starter: { text: ["A line worth remembering."], who: "", bg: "green", fg: "" } },
  articles: { label: "Latest articles", about: "Article cards, filled in from Content.", summary: (st) => ((Number(st.count) || 3) + " from " + (st.section && st.section !== "all" ? st.section : "all")), library: "Fills itself from Content", fields: [EYEBROW, HEADING, { name: "section", label: "Which articles", type: "choice", options: [["all", "All"], ["reviews", "Reviews"], ["explained", "Art explained"], ["library", "Collector's library"], ["features", "Artist portfolios"]] }, { name: "count", label: "How many", type: "number" }, { type: "info", text: "The cards are filled in from your articles, so their words and pictures are changed there, not here.", go: "content", goLabel: "Open Content" }, BG, FG],
    starter: { eyebrow: "Latest", heading: ["Recent pieces"], section: "all", count: 3, bg: "paper", fg: "" } },
  faq: { label: "Questions and answers", about: "Questions that open to show their answer.", summary: (st) => ((st.items || []).length + " questions"), blocks: { field: "items", label: "Question", add: "Add a question", title: (b) => b.q }, library: "A list that opens and closes", fields: [EYEBROW, HEADING, { name: "items", label: "Questions", type: "rows", fields: [{ name: "q", label: "Question", type: "text", hint: "Keep it short. Visitors click it to open the answer." }, { name: "a", label: "Answer", type: "long" }] }, BG, FG],
    starter: { eyebrow: "", heading: ["Questions"], items: [{ q: "A question?", a: "<p>The answer.</p>" }], bg: "paper", fg: "" } },
  button: { label: "Button or link", about: "A heading, a line and one button.", summary: (st) => (st.label || "Button"), library: "Send visitors somewhere", fields: [HEADING, { name: "text", label: "Text", type: "text" }, { name: "label", label: "Button words", type: "text" }, { name: "href", label: "Where it goes", type: "text", hint: "A page on this site starts with #, or a full web address." }, { name: "style", label: "Style", type: "choice", group: "Look", options: [["green", "Green"], ["paper", "Paper"], ["outline", "Outline"]] }, BG, FG],
    starter: { heading: ["Find out more"], text: "", label: "Read on", href: "#artists", style: "green", bg: "paper", fg: "" } },
};
// A page's own heading, and long text, as on Editorial standards.
WAR_SECTIONS["page-heading"] = { label: "Page heading", about: "The heading at the top of a page.", summary: (st) => (st.heading || []).join(" "), library: "A page's heading and introduction",
  starter: { eyebrow: "A small line", heading: ["A new", "page"], intro: "" }, fields: [EYEBROW, { ...HEADING, label: "Heading" }, { name: "intro", label: "Introduction", type: "long", plain: true }] };
WAR_SECTIONS["long-text"] = { label: "Long text", about: "Headings and paragraphs, in the narrow reading column.", summary: (st) => String(st.body || "").replace(/<[^>]*>/g, " ").trim().split(/\s+/).slice(0, 6).join(" "), library: "Headings and paragraphs to read",
  starter: { body: "<h2>A heading</h2><p>Write here.</p>" }, fields: [{ name: "body", label: "Text", type: "long", cite: false, hint: "Type as you would in a document. Grey square brackets mark wording still to be added." }] };
// Sections of the original design can be added again from the library too.
WAR_SECTIONS.numbers.library = "Figures from the site, in a band"; WAR_SECTIONS.numbers.starter = { eyebrow: "The review so far", heading: ["Research you", "can check"], labels: ["Artists documented", "Articles and reviews", "Sources cited", "Facts with a numbered source"] };
WAR_SECTIONS.method.library = "Three cards in a row"; WAR_SECTIONS.method.starter = { eyebrow: "How we research", heading: ["The work first,", "then the story"], cards: [{ n: "1", text: "Write here.", title: "A title", sub: "A small line" }] };
WAR_SECTIONS.articles.library = "Fills itself from Content";

// ----- new sections for any page: batch 1 -----
const ADDR = { name: "href", label: "Where the link goes", type: "text", addr: true, hint: "A page on this site starts with #, such as #artists, or a full web address starting https://." };
const SPACE = { label: "Space", about: "Empty room between two sections. Nothing is drawn, not even a line.", summary: (st) => ({ S: "Small", L: "Large" }[st.size] || "Medium"), library: "Empty room between two sections", starter: { size: "M" },
  fields: [{ name: "size", label: "How much room", type: "choice", seg: true, dflt: "M", options: [["S", "Small"], ["M", "Medium"], ["L", "Large"]] }] };
const ANN_ABOUT = "A thin band with a short message. With more than one message they take turns. As the first section on a page it sits above the menu bar.";
const ANN_MESSAGES = { name: "messages", label: "Messages", type: "rows", fields: [{ name: "text", label: "Message", type: "text", hint: "One short sentence." }, { name: "link", label: "Link words", type: "text", hint: "Leave empty for no link." }, ADDR] };
const ANN_BLOCK = { field: "messages", label: "Message", add: "Add a message", about: "One message in the bar. With more than one, they take turns." };
const ANN_SUMMARY = (st) => { const m = (st.messages || []).filter((x) => x && !x.hidden); return m.length > 1 ? m.length + " messages" : (m[0] && m[0].text) || "No message yet"; };
const SECONDS = { name: "seconds", label: "Seconds before the next message", type: "range", min: 3, max: 30, step: 1, unit: "s", dflt: 6, group: "Look", hint: "Only used with more than one message." };
const COL_BLOCK = { field: "columns", label: "Column", add: "Add a column", about: "One column: a title, a few words and a link." };
const COL_ROWS = { name: "columns", label: "Columns", type: "rows", fields: [{ name: "title", label: "Title", type: "text" }, { name: "text", label: "Text", type: "long", plain: true, hint: "Two or three short sentences read best." }, { name: "link", label: "Link words", type: "text", hint: "Leave empty for no link." }, ADDR] };
const PER_ROW = { name: "per_row", label: "Columns in a row", type: "choice", group: "Look", seg: true, dflt: "3", options: [["2", "Two"], ["3", "Three"], ["4", "Four"]], hint: "On a phone they always stack." };
const NUMBERED = { name: "numbered", label: "Number the columns", type: "yesno", group: "Look" };
const COL_SUMMARY = (st) => { const n = (st.columns || []).filter((x) => x && !x.hidden).length; return n + (n === 1 ? " column" : " columns"); };
const COL_STARTER = (heading) => ({ eyebrow: "", heading, columns: [{ title: "A title", text: "A few words about it.", link: "", href: "" }, { title: "A title", text: "A few words about it.", link: "", href: "" }, { title: "A title", text: "A few words about it.", link: "", href: "" }], per_row: "3", numbered: true });
WAR_SECTIONS.announcement = { label: "Announcement bar", about: ANN_ABOUT, summary: ANN_SUMMARY, library: "A short message in a thin band", blocks: [ANN_BLOCK],
  starter: { messages: [{ text: "A short message for visitors.", link: "", href: "" }], seconds: 6, bg: "green", fg: "" }, fields: [ANN_MESSAGES, SECONDS, BG, FG] };
WAR_SECTIONS.columns = { label: "Columns", about: "Two to four columns side by side, each with a title, a few words and a link. On a phone they stack.", summary: COL_SUMMARY, library: "Columns side by side", blocks: [COL_BLOCK],
  starter: { ...COL_STARTER(["A heading"]), bg: "paper", fg: "" }, fields: [EYEBROW, HEADING, COL_ROWS, PER_ROW, NUMBERED, BG, FG] };
WAR_SECTIONS.space = SPACE;

// ----- new sections for any page: batch 2, pictures -----
const PIC = { name: "image", label: "Picture", type: "image", alt: "alt" };
const PIC_ALT = { name: "alt", label: "Describe the picture", type: "text", hint: "For people who cannot see it. Needed before you save." };
const PB_PLACE = { name: "place", label: "Box of words at the", type: "choice", group: "Look", seg: true, dflt: "L", options: [["L", "Left"], ["C", "Centre"], ["R", "Right"]] };
const PB_FIT = { name: "fit", label: "Picture", type: "choice", group: "Look", seg: true, dflt: "fill", options: [["fill", "Fill the banner"], ["whole", "Show it whole"]], hint: "Fill the banner trims the edges to fit. Choose Show it whole for an artwork, so none of it is cut off." };
const SLIDE_ROWS = { name: "slides", label: "Slides", type: "rows", max: 10, fields: [PIC, PIC_ALT, { name: "caption", label: "Caption", type: "text", hint: "Such as the title, year and medium, and who took the photo. Leave empty for none." }] };
const SLIDE_BLOCK = { field: "slides", label: "Slide", add: "Add a slide", max: 10, about: "One picture in the slideshow, with its caption." };
const SLIDE_LOOK = [{ name: "auto", label: "Move on by itself", type: "yesno", group: "Look", hint: "Every few seconds, until a visitor uses Previous or Next. Pictures stay still for people who ask their device for less motion." }, { name: "seconds", label: "Seconds on each slide", type: "range", min: 3, max: 30, step: 1, unit: "s", dflt: 6, group: "Look" }];
const SLIDE_SUMMARY = (st) => { const n = (st.slides || []).filter((x) => x && !x.hidden).length; return n + (n === 1 ? " slide" : " slides"); };
const SLIDE_STARTER = { slides: [{ image: "", alt: "", caption: "" }, { image: "", alt: "", caption: "" }, { image: "", alt: "", caption: "" }], auto: true, seconds: 6 };
const PHOTO_ROWS = { name: "photos", label: "Photos", type: "rows", fields: [PIC, PIC_ALT, { name: "caption", label: "Title under the photo", type: "text", hint: "Leave empty for none." }, { name: "sub", label: "Small line", type: "text", hint: "Such as the year and medium. Leave empty for none." }] };
const PHOTO_BLOCK = { field: "photos", label: "Photo", add: "Add a photo", about: "One photo in the gallery. Visitors click it to see it larger." };
const PHOTO_PER_ROW = { name: "per_row", label: "Photos in a row", type: "choice", group: "Look", seg: true, dflt: "3", options: [["2", "Two"], ["3", "Three"], ["4", "Four"]], hint: "Two in a row on a phone." };
const PHOTO_SUMMARY = (st) => { const n = (st.photos || []).filter((x) => x && !x.hidden).length; return n + (n === 1 ? " photo" : " photos"); };
const PHOTO_STARTER = { photos: [1, 2, 3].map(() => ({ image: "", alt: "", caption: "", sub: "" })), per_row: "3" };
const LOGO_ITEM_ROWS = (hint) => ({ name: "logos", label: "Logos", type: "rows", max: 12, fields: [{ ...PIC, label: "Logo", button: "Upload a logo", hint: "A PNG with a clear background works best." }, { name: "alt", label: "Name, read aloud to people who cannot see it", type: "text", hint: "Shown as words until a logo is uploaded." }, { name: "href", label: "Opens when clicked", type: "text", addr: true, hint }] });
const LOGO_ITEM_BLOCK = { field: "logos", label: "Logo", add: "Add a logo", max: 12, about: "One logo in the row, with an optional link." };
const LOGO_COLOUR = { name: "colour", label: "Logo colours", type: "choice", group: "Look", seg: true, dflt: "one", options: [["one", "One colour"], ["own", "Their own colours"]], hint: "One colour keeps a row of different logos calm." };
const LOGO_SUMMARY = (st) => { const n = (st.logos || []).filter((x) => x && !x.hidden).length; return n + (n === 1 ? " logo" : " logos"); };
const LOGO_STARTER = { logos: [1, 2, 3].map(() => ({ image: "", alt: "Partner", href: "" })), colour: "one" };
const PB_ABOUT = "A large picture with a box of words and one button over it.";
WAR_SECTIONS["picture-banner"] = { label: "Picture banner", about: PB_ABOUT, summary: (st) => (st.heading || []).join(" ") || "Picture banner", library: "A large picture with words over it",
  starter: { image: "", alt: "", eyebrow: "", heading: ["A heading"], text: "", label: "Read on", href: "#artists", place: "L", box: "green", fit: "fill" },
  fields: [PIC, PIC_ALT, EYEBROW, HEADING, { name: "text", label: "Text", type: "text", hint: "One short sentence. Leave empty to hide." }, { name: "label", label: "Button words", type: "text", hint: "Leave empty for no button." }, ADDR, PB_PLACE, { name: "box", label: "Box colour", type: "choice", group: "Look", seg: true, dflt: "green", options: [["green", "Green"], ["paper", "Paper"]] }, PB_FIT] };
WAR_SECTIONS.slideshow = { label: "Slideshow", about: "Large pictures that take turns, each with a caption. Visitors move it on with Previous and Next.", summary: SLIDE_SUMMARY, library: "Pictures that take turns", blocks: [SLIDE_BLOCK],
  starter: { eyebrow: "", heading: [], ...SLIDE_STARTER, bg: "paper", fg: "" }, fields: [EYEBROW, HEADING, SLIDE_ROWS, ...SLIDE_LOOK, BG, FG] };
WAR_SECTIONS.gallery = { label: "Gallery", about: "A grid of photos with captions. Visitors click one to see it larger.", summary: PHOTO_SUMMARY, library: "A grid of photos that open larger", blocks: [PHOTO_BLOCK],
  starter: { eyebrow: "", heading: ["Gallery"], ...PHOTO_STARTER, bg: "paper", fg: "" }, fields: [EYEBROW, HEADING, PHOTO_ROWS, PHOTO_PER_ROW, BG, FG] };
WAR_SECTIONS["logo-row"] = { label: "Logo row", about: "A row of logos, such as partners or fairs, each with an optional link.", summary: LOGO_SUMMARY, library: "A row of partner logos", blocks: [LOGO_ITEM_BLOCK],
  starter: { eyebrow: "", ...LOGO_STARTER, bg: "paper", fg: "" }, fields: [{ ...EYEBROW, label: "Small line above the logos" }, LOGO_ITEM_ROWS("A page on this site starts with #, or a full web address starting https://. Leave empty for no link."), LOGO_COLOUR, BG, FG] };

// ----- new sections for any page: batch 3, art and reading -----
const SRC_LINK = { name: "href", label: "Source link", type: "text", addr: true, hint: "Where this can be checked, such as the gallery's or a newspaper's page, starting https://." };
const REPORTED = { name: "reported", label: "Only from publicity or the artist", type: "yesno", hint: "Marks it Reported, so readers know it has not been checked elsewhere." };
const AW_ROWS = { name: "artworks", label: "Artworks", type: "rows", fields: [PIC, PIC_ALT, { name: "title", label: "Title", type: "text" }, { name: "year", label: "Year", type: "text", hint: "Leave empty if not known yet." }, { name: "medium", label: "Medium", type: "text", hint: "Such as Acrylic on canvas." }, { name: "size", label: "Size", type: "text", hint: "Such as 100 x 80 cm. Leave empty if not known." }, { name: "note", label: "Small line", type: "text", hint: "Such as where it is now. Leave empty for none." }, { ...ADDR, label: "Opens when clicked", hint: "A page on this site starts with #, or a full web address. Leave empty for no link." }] };
const AW_BLOCK = { field: "artworks", label: "Artwork", add: "Add an artwork", about: "One work with its label: title, year, medium and size." };
const AW_SUMMARY = (st) => { const n = (st.artworks || []).filter((x) => x && !x.hidden).length; return n + (n === 1 ? " artwork" : " artworks"); };
const AW_STARTER = { artworks: [1, 2, 3].map(() => ({ image: "", alt: "", title: "", year: "", medium: "", size: "", note: "", href: "" })), per_row: "3" };
const AW_PER_ROW = { ...PHOTO_PER_ROW, label: "Artworks in a row" };
const SHOW_ROWS = { name: "shows", label: "Exhibitions", type: "rows", fields: [{ name: "title", label: "Exhibition title", type: "text" }, { name: "dates", label: "Dates", type: "text", hint: "Such as 4 March to 12 April 2026. Leave empty if not confirmed." }, { name: "place", label: "Gallery and city", type: "text" }, { name: "kind", label: "Kind", type: "text", hint: "Such as Solo, Group or Art fair. Leave empty for none." }, SRC_LINK, REPORTED] };
const SHOW_BLOCK = { field: "shows", label: "Exhibition", add: "Add an exhibition", about: "One exhibition with its dates, place and source." };
const SHOW_SUMMARY = (st) => { const n = (st.shows || []).filter((x) => x && !x.hidden).length; return n + (n === 1 ? " exhibition" : " exhibitions"); };
const SHOW_STARTER = { shows: [{ title: "Exhibition title", dates: "", place: "", kind: "", href: "", reported: false }] };
const EVENT_ROWS = { name: "events", label: "Moments", type: "rows", fields: [{ name: "when", label: "When", type: "text", hint: "A year, or a month and year. Leave empty if not confirmed." }, { name: "what", label: "What happened", type: "text", hint: "One sentence." }, SRC_LINK, REPORTED] };
const EVENT_BLOCK = { field: "events", label: "Moment", add: "Add a moment", about: "One dated moment in the artist's career, with its source." };
const EVENT_SUMMARY = (st) => { const n = (st.events || []).filter((x) => x && !x.hidden).length; return n + (n === 1 ? " moment" : " moments"); };
const EVENT_STARTER = { events: [{ when: "", what: "What happened.", href: "", reported: false }] };
const QUOTE_ROWS = { name: "quotes", label: "Quotes", type: "rows", fields: [{ name: "quote", label: "The quote", type: "long", plain: true, hint: "A short line, word for word, from a named review. Keep it under twenty words." }, { name: "who", label: "Who wrote it", type: "text" }, { name: "publication", label: "Publication", type: "text" }, { name: "date", label: "Date", type: "text" }, { ...SRC_LINK, hint: "The page the quote comes from, starting https://. A quote is shown with its source." }] };
const QUOTE_BLOCK = { field: "quotes", label: "Quote", add: "Add a quote", about: "One short quote from named press, with its source." };
const QUOTE_SUMMARY = (st) => { const n = (st.quotes || []).filter((x) => x && !x.hidden).length; return n + (n === 1 ? " quote" : " quotes"); };
const QUOTE_STARTER = { quotes: [{ quote: "A short line from a named review.", who: "", publication: "", date: "", href: "" }] };
WAR_SECTIONS.artworks = { label: "Artworks", about: "A grid of works, each with a label: title, year, medium and size.", summary: AW_SUMMARY, library: "Works, each with its label", blocks: [AW_BLOCK],
  starter: { eyebrow: "", heading: ["Selected works"], ...AW_STARTER, bg: "paper", fg: "" }, fields: [EYEBROW, HEADING, AW_ROWS, AW_PER_ROW, BG, FG] };
WAR_SECTIONS.exhibitions = { label: "Exhibitions", about: "A list of exhibitions with their dates, places and sources.", summary: SHOW_SUMMARY, library: "Exhibitions with dates and places", blocks: [SHOW_BLOCK],
  starter: { eyebrow: "", heading: ["Exhibitions"], ...SHOW_STARTER, bg: "paper", fg: "" }, fields: [EYEBROW, HEADING, SHOW_ROWS, BG, FG] };
WAR_SECTIONS.career = { label: "Career timeline", about: "Dated moments in an artist's career, each with its source, as on a portfolio.", summary: EVENT_SUMMARY, library: "Dated moments, with sources", blocks: [EVENT_BLOCK],
  starter: { eyebrow: "", heading: ["Career timeline"], ...EVENT_STARTER, bg: "paper", fg: "" }, fields: [EYEBROW, HEADING, EVENT_ROWS, BG, FG] };
WAR_SECTIONS.press = { label: "Press quotes", about: "Short quotes from named press, each with a link to its source.", summary: QUOTE_SUMMARY, library: "Quotes from the press, with sources", blocks: [QUOTE_BLOCK],
  starter: { eyebrow: "", heading: ["In the press"], ...QUOTE_STARTER, bg: "paper", fg: "" }, fields: [EYEBROW, HEADING, QUOTE_ROWS, BG, FG] };
WAR_SECTIONS["artist-cards"] = { label: "Artist cards", about: "A card for each artist, linking to their portfolio. With none added, every published artist is shown.", summary: (st) => ((st.artists || []).filter((x) => x && !x.hidden).length ? (st.artists || []).filter((x) => x && !x.hidden).length + " chosen" : "All published"), library: "Cards linking to portfolios",
  blocks: [{ field: "artists", label: "Artist", add: "Add an artist", about: "One artist's card, in this order.", item: { name: null, label: "Which artist", type: "artists", one: true } }],
  starter: { eyebrow: "", heading: ["Artists"], artists: [], bg: "paper", fg: "" }, fields: [EYEBROW, HEADING, { name: "artists", label: "Which artists", type: "artists", hint: "Leave empty to show every published artist." }, BG, FG] };

// ----- new sections for any page: batch 4, sign-up, visiting and contact -----
// The forms send nothing themselves: they open the visitor's own email app with a message
// ready to send to the site's address, and say so under the button. No outside service.
const FORM_HONEST = " It opens the visitor's own email app with the message ready to send to info@grovegallery.com. Nothing is sent or kept by the site.";
const FORM_TEXT = { name: "text", label: "Text", type: "long", plain: true, hint: "One or two short sentences. Leave empty to hide." };
const FORM_BUTTON = (eg) => ({ name: "button", label: "Button words", type: "text", hint: "Such as " + eg + ". The line under the button, saying it opens the visitor's email app, is always shown." });
const SIGNUP_ABOUT = "A heading, a line, first name and email, and one button." + FORM_HONEST;
const VISIT_ROWS = { name: "details", label: "Lines", type: "rows", fields: [{ name: "title", label: "Label", type: "text", hint: "Such as Address, Opening hours or Getting there." }, { name: "text", label: "Words", type: "long", plain: true, hint: "Put each part on its own line, such as the street and the postcode." }] };
const VISIT_BLOCK = { field: "details", label: "Line", add: "Add a line", about: "One line of visiting details: a label and its words." };
const VISIT_SUMMARY = (st) => { const n = (st.details || []).filter((x) => x && !x.hidden).length; return n + (n === 1 ? " line" : " lines"); };
const VISIT_STARTER = { details: ["Address", "Opening hours", "Getting there"].map((t) => ({ title: t, text: "" })), map_words: "Open in a map", map: "" };
const VISIT_MAP = [{ name: "map_words", label: "Map link words", type: "text", hint: "Leave empty for no map link." }, { name: "map", label: "Map link", type: "text", addr: true, hint: "The gallery's page on a map site, starting https://. It opens in a new tab. No map is built into the page." }];
WAR_SECTIONS.signup = { label: "Email sign-up", about: SIGNUP_ABOUT, summary: (st) => (st.button || "Sign-up"), library: "Visitors ask to join the letter",
  starter: { eyebrow: "Get the review", heading: ["New portfolios,", "once a month."], text: "One short letter when there is something new to read. No spare emails.", button: "Ask to join", bg: "green", fg: "" },
  fields: [EYEBROW, HEADING, FORM_TEXT, FORM_BUTTON("Ask to join"), BG, FG] };
// A sign-up box that pops up once a visit, after a few seconds, and opens the visitor's own email app. It lives in the Popups group only.
const POPUP_DELAY = { name: "delay", label: "Seconds before it shows", type: "range", min: 3, max: 60, step: 1, unit: "s", dflt: 8, hint: "It shows once a visit, and Close or Escape puts it away." };
const SIGNUP_POPUP = { label: "Sign-up popup", about: "A small box that pops up once a visit, with an email box and one button." + FORM_HONEST, popup: true, summary: (st) => "After " + (st.delay || 8) + " seconds",
  library: "A sign-up box that pops up", starter: { eyebrow: "", heading: "Join the mailing list", text: "Leave your email and we will add you.", button: "Ask to join", delay: 8 },
  fields: [{ ...EYEBROW, label: "Small line above the heading" }, { name: "heading", label: "Heading", type: "text" }, FORM_TEXT, FORM_BUTTON("Ask to join"), POPUP_DELAY] };
WAR_SECTIONS["signup-popup"] = SIGNUP_POPUP;
WAR_SECTIONS.visit = { label: "Visit us", about: "The address, opening hours and how to get there, with an optional link to a map.", summary: VISIT_SUMMARY, library: "Address, hours and directions", blocks: [VISIT_BLOCK],
  starter: { eyebrow: "See the work", heading: ["Visit Grove Gallery"], ...VISIT_STARTER, bg: "paper", fg: "" }, fields: [EYEBROW, HEADING, VISIT_ROWS, ...VISIT_MAP, BG, FG] };
WAR_SECTIONS["contact-form"] = { label: "Contact form", about: "Name, email, a topic and a message." + FORM_HONEST, summary: (st) => { const n = (st.topics || []).filter((x) => typeof x === "string").length; return n ? n + (n === 1 ? " topic" : " topics") : "No topics"; }, library: "Visitors write to the gallery",
  blocks: [{ field: "topics", label: "Topic", add: "Add a topic", about: "One choice in the list of what a message is about. With none, the list is left out.", item: { name: null, label: "Topic", type: "text" } }],
  starter: { eyebrow: "Contact", heading: ["Write to us"], text: "Questions, corrections and press enquiries all reach the same desk.", topics: ["A question", "A correction", "Press", "Something else"], button: "Write the email", bg: "deep", fg: "" },
  fields: [EYEBROW, HEADING, FORM_TEXT, { name: "topics", label: "Topics", type: "lines", hint: "The choices for what a message is about, each on its own. Leave empty to leave the choice out." }, FORM_BUTTON("Write the email"), BG, FG] };

// ----- articles, artist portfolios and sources, edited in place on their own pages -----
// Each is a set of parts shown in the list on the left. A part with picture: true is the
// item's shared picture. Fields not listed here (tone, letter, compare and so on) are kept as they are.
const SRC_FIELD = { name: "src", label: "Sources", type: "sources", hint: "The sources behind this. Their numbers appear on the page." };
const WAR_ITEMS = {
  article: { label: "Article", parts: [
    { id: "words", label: "Title and summary", about: "The heading of the article and how it is listed.", fields: [
      { name: "title", label: "Title", type: "text", hint: "A colon splits it over two lines." },
      { name: "kicker", label: "Label above the title", type: "text", hint: "One or two words, such as Technique or Review." },
      { name: "dek", label: "Summary line", type: "long", plain: true, hint: "One sentence under the title, also used in lists." },
      { name: "section", label: "Which list it belongs to", type: "choice", options: [["explained", "Art Explained"], ["library", "Collector's Library"], ["reviews", "Reviews"], ["features", "Artists A to Z"]] },
      { name: "artists", label: "Artists in this article", type: "artists", hint: "Shown beside the article with a link to each portfolio." },
      { name: "minutes", label: "Reading time, minutes", type: "number" },
      { name: "updated", label: "Updated", type: "text", hint: "For example November 2026." },
      { name: "status", label: "Status label", type: "text", hint: "For example Draft for review. Leave empty to hide it." },
    ] },
    { id: "picture", label: "Picture", picture: true },
    { id: "body", label: "Body", about: "The text of the article.", fields: [{ name: "body", label: "Text", type: "long", cite: true, hint: "Type as you would in a document. Cite a source where a fact needs one." }] },
    { id: "sources", label: "Sources", about: "The numbered list at the end.", fields: [{ name: "sources", label: "Sources listed at the end", type: "sources", hint: "Numbered in this order. Sources cited in the text are added after these." }] },
    { id: "settings", label: "Settings", about: "Whether visitors can see the article.", fields: [{ name: "hidden", label: "Hidden from the site", type: "yesno", hint: "A hidden article is kept but not shown or listed anywhere. New articles start hidden." }] },
  ] },
  artist: { label: "Artist portfolio", parts: [
    { id: "words", label: "Words", about: "The name and the lines about the artist.", fields: [
      { name: "name", label: "Name", type: "text" },
      { name: "tag", label: "Type of work", type: "text", hint: "Shown under the name, such as Portraiture." },
      { name: "place", label: "Based in", type: "text" },
      { name: "summary", label: "Short summary", type: "long", plain: true, hint: "Used on the artist's card on the home page." },
      { name: "dek", label: "Opening line", type: "long", plain: true, hint: "Under the name at the top of the portfolio." },
      { name: "ghostWords", label: "Large background words", type: "lines", hint: "Four short words, one per line, shown large behind the artist on the home page." },
      { name: "checked", label: "Last checked", type: "text", hint: "For example 9 November 2026." },
    ] },
    { id: "picture", label: "Picture", picture: true },
    { id: "glance", label: "At a glance", about: "The facts beside the picture.", fields: [{ name: "glance", label: "Rows", type: "rows", fields: [{ name: 0, label: "Label", type: "text", hint: "Such as Medium or Based in." }, { name: 1, label: "Value", type: "text" }, { name: 2, label: "Sources", type: "sources", hint: "The sources behind this fact." }] }], blocks: { field: "glance", label: "Fact", add: "Add a fact" } },
    { id: "sections", label: "Portfolio sections", about: "The written parts of the portfolio, and where to see the work.", fields: [
      { name: "sections", label: "Sections", type: "rows", keep: ["id"], fields: [{ name: "title", label: "Heading", type: "text" }, { name: "html", label: "Text", type: "long", cite: true }] },
      { name: "seen", label: "Where to see the work", type: "long", cite: true, hint: "Shown near the end of the portfolio." },
    ], blocks: { field: "sections", label: "Section", add: "Add a section" } },
    { id: "timeline", label: "Timeline", about: "The career timeline.", fields: [{ name: "timeline", label: "Events", type: "rows", keep: ["todo"], fields: [
      { name: "when", label: "When", type: "text", nullable: true, hint: "A year or date. Leave empty and the page says Year to confirm." },
      { name: "what", label: "What happened", type: "text" },
      { name: "reported", label: "Only reported, not confirmed", type: "yesno", hint: "Marks it Reported, for claims that come only from publicity." },
      SRC_FIELD,
    ] }], blocks: { field: "timeline", label: "Event", add: "Add an event" } },
    { id: "works", label: "Artworks", about: "The documented works.", fields: [{ name: "works", label: "Works", type: "rows", keep: ["tone"], fields: [
      { name: "title", label: "Title", type: "text", nullable: true, hint: "Leave empty and the page says Title to be documented." },
      { name: "image", label: "Picture", type: "image", alt: "alt", path: "images/" },
      { name: "alt", label: "Describe the picture", type: "text", hint: "Read aloud to people who cannot see it." },
      { name: "year", label: "Year", type: "text", nullable: true },
      { name: "medium", label: "Medium", type: "text", nullable: true },
      { name: "size", label: "Size", type: "text", nullable: true, none: true, hint: "Leave empty if not known yet. Type none when a size does not apply, such as for a performance." },
      { name: "note", label: "Note", type: "long", plain: true, nullable: true },
      SRC_FIELD,
    ] }], blocks: { field: "works", label: "Work", add: "Add a work" } },
    { id: "settings", label: "Settings", about: "Whether the portfolio is shown, and what to read next.", fields: [
      { name: "published", label: "Portfolio shown on the site", type: "yesno", hint: "New portfolios start unpublished. The artist still appears in Artists A to Z as In research." },
      { name: "related", label: "Read next", type: "articles", hint: "Articles listed at the end of the portfolio." },
      { name: "research", label: "Still to research", type: "lines", hint: "One item per line. Shown on the research desk, not to visitors." },
    ] },
  ] },
  source: { label: "Source", parts: [{ id: "words", label: "Source", fields: [
    { name: "title", label: "Title", type: "text", hint: "The title of the article, page or record." },
    { name: "pub", label: "Publication or owner", type: "text", hint: "Such as The Guardian or Bonhams." },
    { name: "date", label: "Date", type: "text", hint: "A year, or a full date." },
    { name: "kind", label: "Kind of source", type: "text", hint: "Such as Independent news report, Interview with the artist or Gallery source." },
    { name: "url", label: "Link", type: "text", hint: "The full web address, starting https://" },
  ] }] },
};
// The heading and introduction at the top of each list page.
export const LIST_FIELDS = [EYEBROW, { ...HEADING, label: "Heading", hint: "Each line of the large heading on its own line." }, { name: "intro", label: "Introduction", type: "long", plain: true, hint: "One or two sentences under the heading." }];
const WAR_LISTS = {
  artists: { label: "Artists A to Z", start: { eyebrow: "Artists A to Z", heading: ["Every artist,", "researched and sourced"], intro: "Each portfolio brings together biography, documented works, a career timeline and the sources behind every fact. Portfolios marked in research are being compiled now." } },
  reviews: { label: "Reviews", section: "reviews", start: { eyebrow: "Reviews", heading: ["Recent reviews", "and comparisons"], intro: "Considered responses to individual works and projects, and side-by-side comparisons of artists." } },
  explained: { label: "Art Explained", section: "explained", start: { eyebrow: "Art Explained", heading: ["How the work is made,", "and why it matters"], intro: "Plain-language guides to the techniques, materials and ideas behind the artworks." } },
  library: { label: "Collector's Library", section: "library", start: { eyebrow: "Collector's Library", heading: ["Buy with your", "eyes open"], intro: "Practical, independent guidance on researching artists, understanding what you are buying and keeping good records." } },
  guides: { label: "Exhibition Guides", start: { eyebrow: "Exhibition Guides", heading: ["What to see,", "and how to see it"], intro: "Short, practical guides to current exhibitions featuring the artists we cover." } },
  search: { label: "Search", start: { eyebrow: "Search", heading: ["Search the", "archive"], intro: "Artists, artworks, techniques and collecting guides." } },
  research: { label: "Research desk", start: { eyebrow: "Research desk", heading: ["What still needs", "to be added"], intro: "An internal checklist, drawn from the portfolios themselves. Each item disappears once the information is added. Not for the public site." } },
};

// ----- Global Art Monitor: its sections, articles, artist market profiles and site details -----
const G_ADDRESS = { name: 1, label: "Address", type: "text", hint: "A page on this site, such as about/ or auction-results/, or a full web address." };
const G_LINKS = (name, label) => ({ name, label, type: "rows", fields: [{ name: 0, label: "Words", type: "text" }, G_ADDRESS] });
const G_WORDS_HINT = "Words in curly brackets are filled in by the site: {tagline}, {headline}, {intro}, {disclosure}, {email}, {published}.";
const G_WHICH = { name: "which", label: "Which articles", type: "which", options: [["all", "All articles"], ["tag:research", "Research"], ["tag:auction-results", "Auction results"], ["tag:market-intelligence", "Market intelligence"], ["tag:collecting-valuation", "Collecting and valuation"]], hint: "Or choose the articles one by one." };
const GAM_SECTIONS = {
  header: { label: "Menu bar", about: "The bar at the top of every page, and the full-screen menu.", summary: (st) => (st.name || "") + ((st.logos || []).length ? ", " + st.logos.length + (st.logos.length === 1 ? " logo" : " logos") : ""), blocks: [{ field: "menu_extra", label: "Menu link", add: "Add a menu link", about: "An extra link in the full-screen menu." }, LOGO_BLOCK], fields: [
    { name: "name", label: "Site name", type: "text" }, { name: "subscribe", label: "Subscribe button words", type: "text" }, { name: "subscribe_href", label: "Subscribe button address", type: "text" },
    { ...G_LINKS("menu_extra", "Extra links in the full-screen menu"), hint: "Shown after the main sections." }, { name: "menu_tagline", label: "Line at the foot of the menu", type: "text" },
    { ...LOGO_ROWS, fields: LOGO_ROWS.fields.map((g) => g.name === "href" ? { ...g, hint: "A page on this site such as about/, or a full web address starting https://. Leave empty for no link." } : g) },
  ] },
  footer: { label: "Footer", about: "The sign-up band and links at the bottom of every page.", summary: (st) => ((st.about_links || []).length + " links"), blocks: { field: "about_links", label: "Link", add: "Add a link", title: (b) => b[0] }, fields: [
    { name: "heading", label: "Heading", type: "text" }, { name: "button", label: "Button words", type: "text" }, { name: "button_href", label: "Button address", type: "text" },
    { name: "blurb", label: "Short description of the site", type: "long", plain: true }, G_LINKS("about_links", "Links under About"),
    { name: "legal", label: "Small print", type: "long", plain: true, hint: "Keep {disclosure} in it: readers are told who publishes the site. " + G_WORDS_HINT },
    { name: "legal_link", label: "Link after the small print", type: "pair", labels: ["Words", "Address"] },
  ] },
  hero: { label: "Opening banner", about: "The heading, introduction and latest documented result at the top of the home page.", summary: (st) => st.headline || "", blocks: { field: "buttons", label: "Button", add: "Add a button", title: (b) => b[0] }, fields: [
    { name: "eyebrow", label: "Small line above the heading", type: "text", hint: G_WORDS_HINT }, { name: "headline", label: "Heading", type: "text", hint: G_WORDS_HINT }, { name: "lede", label: "Introduction", type: "long", plain: true, hint: G_WORDS_HINT },
    { name: "buttons", label: "Buttons", type: "rows", fields: [{ name: 0, label: "Words", type: "text" }, G_ADDRESS, { name: 2, label: "Colour", type: "choice", options: [["mint", "Mint"], ["ink", "Charcoal"], ["blush", "Blush"]] }] },
    { name: "result_card", label: "Show the latest result card", type: "yesno", hint: "The card shows the most recent sale with a confirmed price, counted from the sales." },
    { name: "result_label", label: "Result card, small line", type: "text" }, { name: "result_link", label: "Result card, link words", type: "text" },
    { name: "watermark", label: "Large background word", type: "text", group: "Look" },
  ] },
  status: { label: "Status line", about: "A thin line of facts with the London time.", summary: (st) => (st.items || []).join(", "), library: "A line of short facts", starter: { items: ["Independent market research"], clock: "Published in London" }, fields: [{ name: "items", label: "Facts", type: "lines" }, { name: "clock", label: "Words beside the clock", type: "text" }] },
  timeline: { label: "Artist auction timeline", about: "One artist's sales table, drawn from the sales.", summary: (st) => st.heading || "", library: "One artist's sales, as a table", starter: { eyebrow: "Artist auction timeline", heading: "A documented market timeline", intro: "", artist: "", button: "See every documented result", button_href: "auction-results/" }, fields: [
    { name: "eyebrow", label: "Small line above the heading", type: "text" }, { name: "heading", label: "Heading", type: "text" }, { name: "intro", label: "Introduction", type: "long", plain: true },
    { name: "artist", label: "Whose sales", type: "artists", one: true, hint: "Leave empty for the first artist." }, { name: "button", label: "Button words", type: "text" }, { name: "button_href", label: "Button address", type: "text" },
  ] },
  words: { label: "Words explained", about: "Short words, each with a line and a link.", summary: (st) => ((st.words || []).length + " words"), library: "Words with a short line each", starter: { label: "Words explained", words: [{ word: "Hammer", text: "The winning bid in the room, before any fees.", href: "collecting-valuation/", style: "ink" }] }, blocks: { field: "words", label: "Word", add: "Add a word", title: (b) => b.word }, fields: [
    { name: "label", label: "Description for screen readers", type: "text" },
    { name: "words", label: "Words", type: "rows", fields: [{ name: "word", label: "Word", type: "text" }, { name: "text", label: "Line", type: "text" }, { name: "href", label: "Address", type: "text" }, { name: "style", label: "Colour", type: "choice", options: [["ink", "Charcoal"], ["light", "Light"], ["mint", "Mint"], ["ghost", "Outline"]] }] },
  ] },
  features: { label: "Article cards", about: "Cards for research articles.", summary: (st) => (Array.isArray(st.which) ? st.which.length + " chosen" : st.which === "all" ? "All articles" : String(st.which || "").replace("tag:", "").replace(/-/g, " ")), library: "Cards for research articles", starter: { eyebrow: "", heading: "Research", which: "all", numbered: false, big: 0, compact: false }, fields: [
    { name: "eyebrow", label: "Small line above the heading", type: "text" }, { name: "heading", label: "Heading", type: "text" }, G_WHICH,
    { name: "numbered", label: "Number the cards", type: "yesno", group: "Look" }, { name: "big", label: "How many large cards first", type: "number", group: "Look" }, { name: "compact", label: "Compact heading", type: "yesno", group: "Look" },
  ] },
  profiles: { label: "Artist profile cards", about: "A card for each artist with their highest documented price.", summary: (st) => ((st.artists || []).length ? (st.artists || []).length + " chosen" : "All artists"), library: "Cards for artist market profiles", starter: { heading: "Artist market profiles", artists: [], more_card: true }, fields: [
    { name: "heading", label: "Heading", type: "text" }, { name: "artists", label: "Which artists", type: "artists", hint: "Leave all empty for every artist." }, { name: "more_card", label: "Add the More artists card", type: "yesno" },
  ] },
  "page-links": { label: "Where to start", about: "A row for each section of the site, from Site details.", summary: (st) => st.heading || "", library: "A row for each section of the site", starter: { heading: "Where to start" }, fields: [{ name: "heading", label: "Heading", type: "text" }] },
  method: { label: "How we report a price", about: "The method panel. Its words are fixed, so every page says the same.", summary: () => "Method", library: "The method panel", starter: {}, fields: [] },
  "page-head": { label: "Page heading", about: "The heading at the top of the page.", summary: (st) => st.headline || "", library: "A heading and introduction", starter: { eyebrow: "", headline: "A new page", lede: "", wide: true }, fields: [
    { name: "eyebrow", label: "Small line above the heading", type: "text" }, { name: "headline", label: "Heading", type: "text", hint: G_WORDS_HINT },
    { name: "lede", label: "Introduction", type: "long", plain: true, hint: "Counts can be filled in too: {lots}, {artists}, {houses}, {priced}. " + G_WORDS_HINT }, { name: "wide", label: "Wide", type: "yesno", group: "Look" },
  ] },
  "results-table": { label: "All auction results", about: "Every documented sale, with filters. The figures come from each artist's sales.", summary: () => "All sales", fields: [{ name: "all_artists", label: "Filter words, all artists", type: "text" }, { name: "all_houses", label: "Filter words, all houses", type: "text" }, { name: "empty", label: "When no sale matches", type: "text" }] },
  "latest-result": { label: "Latest result", about: "The most recent sale with a confirmed price.", summary: () => "Latest result", library: "The latest documented result", starter: { eyebrow: "Latest documented result", text: "", button: "Open the full timeline" }, fields: [{ name: "eyebrow", label: "Small line", type: "text" }, { name: "text", label: "Text", type: "long", plain: true }, { name: "button", label: "Button words", type: "text" }] },
  glossary: { label: "Glossary", about: "The auction terms. Change the terms themselves in Site details.", summary: (st) => st.heading || "", library: "The glossary of auction terms", starter: { heading: "Auction terms, in plain words" }, fields: [{ name: "heading", label: "Heading", type: "text" }] },
  panel: { label: "Panel", about: "A dark panel with a heading and a few words.", summary: (st) => st.heading || "", library: "A heading and a few words, in a dark panel", starter: { heading: "A heading", text: "A few words." }, fields: [{ name: "heading", label: "Heading", type: "text" }, { name: "text", label: "Text", type: "long", plain: true }] },
  prose: { label: "Text", about: "Longer text with a side column.", summary: () => "Text", library: "Longer text with a side column", starter: { html: "<h2>A heading</h2>\n<p>Write here.</p>", aside: "" }, fields: [{ name: "html", label: "Text", type: "long", hint: G_WORDS_HINT }, { name: "aside", label: "Side column", type: "long" }] },
  "contact-form": { label: "Contact form", about: "The form that opens an email to the research desk.", summary: () => "Form", fields: [
    { name: "html", label: "The form, as it is written for the page", type: "long", plain: true, hint: "Change the words carefully and keep the form's parts as they are. {email} is the contact address." },
    { name: "aside", label: "Side column, as it is written for the page", type: "long", plain: true },
  ] },
};
// ----- new sections for any page: batch 1 -----
const G_HEAD = [{ name: "eyebrow", label: "Small line above the heading", type: "text", hint: "Leave empty to hide." }, { name: "heading", label: "Heading", type: "text" }];
GAM_SECTIONS.announcement = { label: "Announcement bar", about: ANN_ABOUT, summary: ANN_SUMMARY, library: "A short message in a thin band", blocks: [ANN_BLOCK],
  starter: { messages: [{ text: "A short message for visitors.", link: "", href: "" }], seconds: 6, style: "ink" },
  fields: [{ ...ANN_MESSAGES, fields: ANN_MESSAGES.fields.map((g) => g.name === "href" ? { ...g, hint: "A page on this site such as auction-results/, or a full web address starting https://." } : g) }, SECONDS, { name: "style", label: "Colour", type: "choice", group: "Look", seg: true, options: [["ink", "Charcoal"], ["mint", "Mint"], ["blush", "Pink"]] }] };
GAM_SECTIONS.columns = { label: "Columns", about: "Two to four rounded cards side by side, each with a title, a few words and a link. On a phone they stack.", summary: COL_SUMMARY, library: "Columns side by side", blocks: [COL_BLOCK],
  starter: COL_STARTER("A heading"), fields: [...G_HEAD, { ...COL_ROWS, fields: COL_ROWS.fields.map((g) => g.name === "href" ? { ...g, hint: "A page on this site such as auction-results/, or a full web address starting https://." } : g) }, PER_ROW, NUMBERED] };
GAM_SECTIONS.space = SPACE;
GAM_SECTIONS.quote = { label: "Quote", about: "One line, shown large, with who said it.", summary: (st) => String(st.text || "").split("\n")[0], library: "A short line that stands out", starter: { text: "A line worth remembering.", who: "" },
  fields: [{ name: "text", label: "The quote", type: "long", plain: true, hint: "Keep it to a sentence or two. A quote needs a named source." }, { name: "who", label: "Who said it", type: "text", hint: "Such as a name and a publication. Leave empty to hide." }] };
GAM_SECTIONS.faq = { label: "Questions and answers", about: "Questions that open to show their answer.", summary: (st) => ((st.items || []).filter((x) => x && !x.hidden).length + " questions"), library: "A list that opens and closes",
  blocks: [{ field: "items", label: "Question", add: "Add a question", about: "A question that opens to show its answer." }], starter: { eyebrow: "Questions", heading: "Questions and answers", items: [{ q: "A question?", a: "The answer." }] },
  fields: [...G_HEAD, { name: "items", label: "Questions", type: "rows", fields: [{ name: "q", label: "Question", type: "text", hint: "Keep it short. Visitors click it to open the answer." }, { name: "a", label: "Answer", type: "long", plain: true }] }] };
GAM_SECTIONS.button = { label: "Button or link", about: "A heading, a line and one button, in a dark panel or on the page.", summary: (st) => st.label || "Button", library: "Send visitors somewhere",
  starter: { heading: "Find out more", text: "", label: "Read on", href: "auction-results/", colour: "mint", panel: true },
  fields: [{ name: "heading", label: "Heading", type: "text" }, { name: "text", label: "Text", type: "text" }, { name: "label", label: "Button words", type: "text" },
    { name: "href", label: "Where it goes", type: "text", addr: true, hint: "A page on this site such as auction-results/, or a full web address starting https://." },
    { name: "colour", label: "Button colour", type: "choice", group: "Look", seg: true, options: [["mint", "Mint"], ["ink", "Charcoal"], ["blush", "Pink"]], hint: "On the dark panel, Charcoal shows light." },
    { name: "panel", label: "In a dark panel", type: "yesno", group: "Look" }] };
// ----- new sections for any page: batch 2, pictures -----
const G_ADDR_HINT = "A page on this site such as auction-results/, or a full web address starting https://.";
GAM_SECTIONS["picture-banner"] = { label: "Picture banner", about: PB_ABOUT, summary: (st) => st.heading || "Picture banner", library: "A large picture with words over it",
  starter: { image: "", alt: "", eyebrow: "", heading: "A heading", text: "", label: "Read on", href: "auction-results/", place: "L", box: "ink", fit: "fill", colour: "mint" },
  fields: [PIC, PIC_ALT, ...G_HEAD, { name: "text", label: "Text", type: "text", hint: "One short sentence. Leave empty to hide." }, { name: "label", label: "Button words", type: "text", hint: "Leave empty for no button." }, { ...ADDR, hint: G_ADDR_HINT }, PB_PLACE,
    { name: "box", label: "Box colour", type: "choice", group: "Look", seg: true, dflt: "ink", options: [["ink", "Charcoal"], ["blush", "Pink"]] }, { name: "colour", label: "Button colour", type: "choice", group: "Look", seg: true, dflt: "mint", options: [["mint", "Mint"], ["ink", "Charcoal"], ["blush", "Pink"]] }, PB_FIT] };
GAM_SECTIONS.slideshow = { label: "Slideshow", about: "Large pictures that take turns, each with a caption. Visitors move it on with Previous and Next.", summary: SLIDE_SUMMARY, library: "Pictures that take turns", blocks: [SLIDE_BLOCK],
  starter: { eyebrow: "", heading: "", ...SLIDE_STARTER }, fields: [...G_HEAD, SLIDE_ROWS, ...SLIDE_LOOK] };
GAM_SECTIONS.gallery = { label: "Gallery", about: "A grid of photos with captions. Visitors click one to see it larger.", summary: PHOTO_SUMMARY, library: "A grid of photos that open larger", blocks: [PHOTO_BLOCK],
  starter: { eyebrow: "", heading: "Gallery", ...PHOTO_STARTER }, fields: [...G_HEAD, PHOTO_ROWS, PHOTO_PER_ROW] };
GAM_SECTIONS["logo-row"] = { label: "Logo row", about: "A row of logos, such as data sources or partners, each with an optional link.", summary: LOGO_SUMMARY, library: "A row of partner logos", blocks: [LOGO_ITEM_BLOCK],
  starter: { eyebrow: "", ...LOGO_STARTER }, fields: [{ name: "eyebrow", label: "Small line beside the logos", type: "text", hint: "Leave empty to hide." }, LOGO_ITEM_ROWS(G_ADDR_HINT + " Leave empty for no link."), LOGO_COLOUR] };
GAM_SECTIONS.picture = { label: "Picture", about: "One large photo with a caption.", summary: (st) => st.caption || st.image || "Picture", library: "One large photo, with a caption", starter: { image: "", alt: "", caption: "", size: "" },
  fields: [PIC, PIC_ALT, { name: "caption", label: "Caption", type: "text", hint: "Small text under the picture. Leave empty to hide." }, { name: "size", label: "Width", type: "choice", group: "Look", seg: true, options: [["", "Full width"], ["contained", "Contained"]] }] };
GAM_SECTIONS["text-picture"] = { label: "Text with picture", about: "Words on one side, a photo on the other.", summary: (st) => st.heading || "Text with picture", library: "Words beside a photo",
  starter: { eyebrow: "", heading: "A heading", body: "Write here.", link: "", href: "", image: "", alt: "", caption: "", side: "right" },
  fields: [...G_HEAD, { name: "body", label: "Text", type: "long", plain: true, hint: "Leave an empty line between paragraphs." }, { name: "link", label: "Link words", type: "text", hint: "Leave empty for no link." }, { ...ADDR, hint: G_ADDR_HINT },
    PIC, PIC_ALT, { name: "caption", label: "Caption", type: "text", hint: "Small text under the picture. Leave empty to hide." }, { name: "side", label: "Picture on the", type: "choice", group: "Look", seg: true, options: [["right", "Right"], ["left", "Left"]] }] };
// ----- new sections for any page: batch 3, art and reading -----
const G_SRC = (f) => f.name === "href" ? { ...f, hint: f.label === "Opens when clicked" ? G_ADDR_HINT + " Leave empty for no link." : f.hint } : f;
GAM_SECTIONS.artworks = { ...WAR_SECTIONS.artworks, starter: { eyebrow: "", heading: "Selected works", ...AW_STARTER }, fields: [...G_HEAD, { ...AW_ROWS, fields: AW_ROWS.fields.map(G_SRC) }, AW_PER_ROW] };
GAM_SECTIONS.exhibitions = { ...WAR_SECTIONS.exhibitions, starter: { eyebrow: "", heading: "Exhibitions", ...SHOW_STARTER }, fields: [...G_HEAD, SHOW_ROWS] };
GAM_SECTIONS.career = { ...WAR_SECTIONS.career, about: "Dated moments in an artist's career, each with its source.", starter: { eyebrow: "", heading: "Career timeline", ...EVENT_STARTER }, fields: [...G_HEAD, EVENT_ROWS] };
GAM_SECTIONS.press = { ...WAR_SECTIONS.press, starter: { eyebrow: "", heading: "In the press", ...QUOTE_STARTER }, fields: [...G_HEAD, QUOTE_ROWS] };
// ----- new sections for any page: batch 4, sign-up and visiting (the contact form is already here) -----
GAM_SECTIONS["signup-popup"] = SIGNUP_POPUP;
GAM_SECTIONS.signup = { ...WAR_SECTIONS.signup, about: SIGNUP_ABOUT + " Shown in a dark panel.", starter: { eyebrow: "The market note", heading: "Sent when there is something to report.", text: "New documented results and new research, and nothing else.", button: "Ask to join" },
  fields: [...G_HEAD, FORM_TEXT, FORM_BUTTON("Ask to join")] };
GAM_SECTIONS.visit = { ...WAR_SECTIONS.visit, about: "The address, opening hours and how to get there, each in a rounded card, with an optional link to a map.", starter: { eyebrow: "Visit", heading: "See the work at Grove Gallery", ...VISIT_STARTER },
  fields: [...G_HEAD, VISIT_ROWS, ...VISIT_MAP] };
const G_SALE_FIELDS = [
  { name: "title", label: "Title of the work", type: "text" }, { name: "year", label: "Year made", type: "text" },
  { name: "date", label: "Sale date, as year-month-day", type: "text", nullable: true, hint: "Such as 2025-03-18. Leave empty if not known yet." }, { name: "date_text", label: "Sale date in words", type: "text", hint: "Such as 18 March 2025." },
  { name: "house", label: "Auction house", type: "text" }, { name: "sale", label: "Sale title and city", type: "text" }, { name: "lot", label: "Lot number", type: "text" },
  { name: "medium", label: "Medium, edition and size", type: "text" },
  { name: "currency", label: "Currency of the sale", type: "choice", options: [["GBP", "GBP, pounds"], ["USD", "USD, US dollars"], ["EUR", "EUR, euros"], ["HKD", "HKD, Hong Kong dollars"], ["CHF", "CHF, Swiss francs"]], hint: "Figures stay in the currency of the sale. Never convert them." },
  { name: "est_low", label: "Low estimate", type: "number", nullable: true, hint: "Leave empty if not known. The site says To confirm." },
  { name: "est_high", label: "High estimate", type: "number", nullable: true },
  { name: "hammer", label: "Hammer price", type: "number", nullable: true, hint: "The winning bid, before fees. Leave empty if not known." },
  { name: "hammer_basis", label: "Hammer price comes from", type: "choice", options: [["published", "The house or a database states it"], ["calculated", "Worked back from the total"]] },
  { name: "premium", label: "Price with buyer's premium", type: "number", nullable: true },
  { name: "source_label", label: "Source name", type: "text", hint: "The lot page or a named database. Every sale needs one." }, { name: "source_url", label: "Source link", type: "text" },
  { name: "source2_label", label: "Second source name", type: "text" }, { name: "source2_url", label: "Second source link", type: "text" },
];
const GAM_ITEMS = {
  article: { label: "Article", parts: [
    { id: "words", label: "Title and summary", about: "The heading of the article and how it is listed.", fields: [
      { name: "title", label: "Title", type: "text" }, { name: "kicker", label: "Label above the title", type: "text", hint: "Such as Auction results or Analysis." },
      { name: "standfirst", label: "Summary line", type: "long", plain: true, hint: "Shown on the article's card." },
      { name: "description", label: "Description for search engines", type: "long", plain: true, hint: "One or two sentences. Not shown on the page." },
      { name: "tags", label: "Shown in", type: "checks", options: [["research", "Research"], ["auction-results", "Auction results"], ["market-intelligence", "Market intelligence"], ["collecting-valuation", "Collecting and valuation"]] },
      { name: "mins", label: "Reading time, minutes", type: "number" },
    ] },
    { id: "body", label: "Body", about: "The text of the article. An artist's sales table can sit inside it.", fields: [{ name: "body", label: "Text", type: "long", hint: "Type as you would in a document. The grey boxes are an artist's sales table, drawn from the sales." }] },
    { id: "settings", label: "Settings", about: "Whether visitors can see the article.", fields: [{ name: "hidden", label: "Hidden from the site", type: "yesno", hint: "A hidden article is kept but not shown or listed. New articles start hidden." }] },
  ] },
  artist: { label: "Artist market profile", parts: [
    { id: "words", label: "Words", about: "The name and the lines about the artist.", fields: [
      { name: "name", label: "Name", type: "text" }, { name: "line", label: "Short line", type: "text", hint: "Such as British, born 1971. Painter." },
      { name: "summary", label: "Opening paragraph", type: "long", plain: true }, { name: "houses", label: "Auction houses", type: "lines", hint: "One per line, shown as chips." },
    ] },
    { id: "picture", label: "Picture", about: "The picture beside About the artist.", fields: [
      { name: "image", label: "Picture", type: "image", alt: "alt" }, { name: "alt", label: "Describe the picture", type: "text", hint: "Read aloud to people who cannot see it." }, { name: "caption", label: "Caption", type: "text" },
    ] },
    { id: "sales", label: "Sales", about: "Every public sale, with each figure in its own field. An empty figure shows as To confirm.", fields: [{ name: "sales", label: "Sales", type: "rows", fields: G_SALE_FIELDS }], blocks: { field: "sales", label: "Sale", add: "Add a sale" } },
    { id: "about", label: "About the artist", about: "The paragraphs, why the work is valued, and the background sources.", fields: [
      { name: "body", label: "Paragraphs", type: "lines", hint: "One paragraph per line." },
      { name: "standing", label: "Why the work is valued", type: "lines", hint: "One paragraph per line. Shown under its own heading after the paragraphs; leave empty to leave it out." },
      { name: "sources", label: "Background sources", type: "rows", fields: [{ name: 0, label: "Name", type: "text" }, { name: 1, label: "Link", type: "text" }] },
    ] },
  ] },
  site: { label: "Site details", parts: [
    { id: "details", label: "Details", about: "The site's name and the words used across it.", fields: [
      { name: "site.name", label: "Site name", type: "text" }, { name: "site.tagline", label: "Tagline", type: "text" }, { name: "site.headline", label: "Headline", type: "text" },
      { name: "site.intro", label: "Introduction", type: "long", plain: true }, { name: "site.email", label: "Contact email", type: "text" },
      { name: "site.disclosure", label: "Who publishes the site", type: "long", plain: true, hint: "Readers are told that Artiscope sells work by the artists covered. This must stay." },
    ] },
    { id: "sections", label: "Sections", about: "The main sections in the menu bar. Their pages stay where they are.", fields: [{ name: "sections", label: "Sections", type: "rows", fixed: true, fields: [{ name: 1, label: "Name", type: "text" }, { name: 2, label: "Description", type: "text" }] }] },
    { id: "glossary", label: "Glossary", about: "The auction terms on Collecting and Valuation.", fields: [{ name: "glossary", label: "Terms", type: "rows", fields: [{ name: 0, label: "Term", type: "text" }, { name: 1, label: "Meaning", type: "long", plain: true }] }], blocks: { field: "glossary", label: "Term", add: "Add a term" } },
  ] },
};
const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"];
// The site's data as one object for the editor, matching assets/render.js on the site.
export function gamForEditor(content, sales, images, imageFiles) {
  images = images || {}; imageFiles = imageFiles || [];
  const artists = Object.keys(sales.artists || {}).map((slug) => {
    const a = sales.artists[slug], bio = (content.bios || {})[slug] || {}, note = images[slug] || {};
    let image = "";
    if ("file" in note) image = note.file && imageFiles.includes(note.file) ? note.file : "";
    else image = (IMAGE_EXTS.map((e) => slug + "." + e).find((n) => imageFiles.includes(n))) || "";
    return { slug, name: a.name, line: a.line || "", houses: [...(a.houses || [])], summary: bio.summary || "", body: [...(bio.body || [])], standing: [...(bio.standing || [])], sources: (bio.sources || []).map((x) => [...x]),
      image, alt: note.alt || "", caption: note.caption || "", sales: (sales.sales || []).filter((x) => x.artist === slug).map((x, i) => ({ ...x, _i: i })) };
  });
  return { published: content.published, published_text: content.published_text, site: { ...(content.site || {}) }, sections: (content.sections || []).map((x) => [...x]),
    glossary: (content.glossary || []).map((x) => [...x]), articles: (content.features || []).map((f) => ({ ...f })), artists };
}
// Only the fields that really changed are written; everything else keeps its exact form.
function keepOrClean(f, cur, given, ctx) { const a = cleanField(f, cur, ctx), b = cleanField(f, given, ctx); return canon(a) === canon(b) ? { same: true, v: cur } : { same: false, v: b }; }
function cleanSale(g, cur, slug, ctx) {
  const out = cur ? JSON.parse(JSON.stringify(cur)) : { artist: slug };
  let changed = !cur;
  for (const f of G_SALE_FIELDS) { const r = keepOrClean(f, cur ? cur[f.name] : undefined, g ? g[f.name] : undefined, ctx); if (!r.same || !cur) { out[f.name] = r.same && cur ? cur[f.name] : cleanField(f, g ? g[f.name] : undefined, ctx); changed = changed || !r.same; } }
  out.artist = slug;
  const name = out.title || "a sale";
  if (out.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(out.date))) throw new Error("The sale date of " + name + " must be written as year-month-day, such as 2025-03-18, or left empty.");
  for (const k of ["est_low", "est_high", "hammer", "premium"]) if (out[k] !== null && !(out[k] >= 0)) throw new Error("The figures of " + name + " must be numbers of 0 or more, or left empty.");
  if (out.est_low !== null && out.est_high !== null && out.est_low > out.est_high) throw new Error("The low estimate of " + name + " is higher than its high estimate.");
  if (!String(out.source_label || "").trim() || !/^https?:\/\//i.test(String(out.source_url || ""))) throw new Error("Every sale needs a source: the lot page or a named database, with its link starting https://. " + name + " has none yet.");
  if (out.source2_url && !/^https?:\/\//i.test(String(out.source2_url))) throw new Error("The second source link of " + name + " must start https://");
  return { sale: out, changed };
}
// Turns the edited object back into the three data files. Throws with a plain reason.
export function gamFromEditor(kinds, given, content, sales, images, imageFiles) {
  if (!given || typeof given !== "object") throw new Error("The content could not be read.");
  const c = JSON.parse(JSON.stringify(content)), s = JSON.parse(JSON.stringify(sales)), im = JSON.parse(JSON.stringify(images || {})), changed = [];
  const ga = Array.isArray(given.articles) ? given.articles : content.features || [], gr = Array.isArray(given.artists) ? given.artists : [];
  const ctx = { artists: gr.map((a) => ({ slug: String((a && a.slug) || "") })), articleSlugs: ga.map((a) => String((a && a.slug) || "")) };
  // site details, sections and glossary
  const siteKind = kinds.site.parts;
  let siteChanged = false;
  for (const f of siteKind[0].fields) {
    const k = f.name.slice(5), r = keepOrClean(f, (content.site || {})[k], (given.site || {})[k], ctx);
    if (!r.same) { c.site[k] = r.v; siteChanged = true; }
  }
  if (!String(c.site.disclosure || "").trim()) throw new Error("The words saying who publishes the site must stay. Readers are told that Artiscope sells work by the artists covered.");
  if (c.site.email && !/^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(c.site.email)) throw new Error("The contact email does not look right.");
  const gs = Array.isArray(given.sections) ? given.sections : content.sections || [];
  if (gs.length !== (content.sections || []).length) throw new Error("The list of sections is fixed, because each has its own page. Change their names and descriptions only.");
  const secs = (content.sections || []).map((row, i) => [row[0], cleanText((gs[i] || [])[1], 80) || row[1], cleanText((gs[i] || [])[2], 200)]);
  if (canon(secs) !== canon(content.sections || [])) { c.sections = secs; siteChanged = true; }
  const gloss = kinds.site.parts[2].fields[0], gr2 = keepOrClean(gloss, content.glossary || [], given.glossary, ctx);
  if (!gr2.same) { c.glossary = gr2.v.filter((x) => String(x[0]).trim()); siteChanged = true; }
  if (siteChanged) changed.push("Edit site details");
  // articles
  const curA = content.features || [], seen = new Set(), feats = [];
  for (const g of ga) {
    const slug = String((g && g.slug) || ""), cur = curA.find((x) => x.slug === slug);
    if (seen.has(slug)) throw new Error("Two articles have the same web address.");
    seen.add(slug);
    if (!cur && !SLUG.test(slug)) throw new Error("A new article needs a web address of letters, digits and hyphens.");
    const base = cur || { slug, title: String((g && g.title) || "New article"), kicker: "Research", tags: ["research"], mins: 5, standfirst: "", body: "<p>Write here.</p>", description: "", hidden: true };
    const next = cleanItem(kinds.article, cur ? g : { ...base, ...g }, base, ctx);
    if (!String(next.title || "").trim()) throw new Error("Every article needs a title.");
    if (next.hidden === false && !(cur && "hidden" in cur)) delete next.hidden;
    if (!cur) changed.push("Add article: " + next.title); else if (canon(next) !== canon(cur)) changed.push((cur.hidden === true && next.hidden !== true ? "Show article: " : next.hidden === true && cur.hidden !== true ? "Hide article: " : "Edit article: ") + next.title);
    feats.push(next);
  }
  for (const cur of curA) if (!seen.has(cur.slug)) changed.push("Delete article: " + cur.title);
  c.features = feats;
  // artists, with their sales
  const curSlugs = Object.keys(sales.artists || {}), seenR = new Set(), bySlug = {}, artistsOut = {}, wasAll = gamForEditor(content, sales, images, imageFiles || []);
  const wordFields = kinds.artist.parts[0].fields, picFields = kinds.artist.parts[1].fields, aboutFields = kinds.artist.parts[3].fields;
  for (const g of gr) {
    const slug = String((g && g.slug) || ""), isNew = !curSlugs.includes(slug);
    if (seenR.has(slug)) throw new Error("Two artists have the same web address.");
    seenR.add(slug);
    if (isNew && !SLUG.test(slug)) throw new Error("A new artist needs a web address of letters, digits and hyphens.");
    const was = isNew ? { slug, name: "", line: "", houses: [], summary: "", body: [], standing: [], sources: [], image: "", alt: "", caption: "", sales: [] } : wasAll.artists.find((a) => a.slug === slug);
    let touched = isNew;
    const a = { ...((sales.artists || {})[slug] || {}) }, bio = { ...((content.bios || {})[slug] || {}) };
    for (const f of wordFields) { const r = keepOrClean(f, was[f.name], g[f.name], ctx); if (!r.same || isNew) { touched = touched || !r.same; const v = r.same ? was[f.name] : r.v; if (f.name === "summary") bio.summary = v; else a[f.name] = v; } }
    if (!String(a.name || "").trim()) throw new Error("Every artist needs a name.");
    for (const f of aboutFields) { const r = keepOrClean(f, was[f.name], g[f.name], ctx); if (!r.same || isNew) { touched = touched || !r.same; bio[f.name] = r.same ? was[f.name] : r.v; } }
    for (const row of bio.sources || []) if (row[1] && !/^https?:\/\//i.test(row[1])) throw new Error("Background source links must start https://");
    artistsOut[slug] = a; if (!c.bios) c.bios = {}; c.bios[slug] = bio;
    // the picture: a file in assets/images, its description and caption
    const note = { ...(im[slug] || {}) }, pic = {};
    for (const f of picFields) pic[f.name] = cleanField(f, g[f.name], ctx);
    if (canon(pic.alt) !== canon(was.alt) || canon(pic.caption) !== canon(was.caption) || pic.image !== was.image) {
      note.alt = pic.alt; note.caption = pic.caption;
      if (pic.image !== was.image) note.file = pic.image;
      im[slug] = note; touched = true;
    }
    // sales: unchanged rows keep their exact form
    const curSales = (sales.sales || []).filter((x) => x.artist === slug), gsales = Array.isArray(g.sales) ? g.sales : [];
    if (gsales.length > 200) throw new Error("An artist can have up to 200 sales here.");
    const rows = gsales.map((x) => cleanSale(x, x && x._i != null && curSales[Number(x._i)] ? curSales[Number(x._i)] : null, slug, ctx));
    if (rows.some((r) => r.changed) || rows.length !== curSales.length || rows.some((r, i) => r.sale !== curSales[i] && canon(r.sale) !== canon(curSales[i]))) touched = true;
    bySlug[slug] = rows.map((r) => { delete r.sale._i; return r.sale; });
    if (isNew) changed.push("Add artist: " + a.name); else if (touched) changed.push("Edit profile: " + a.name);
  }
  // an artist can go only once their sales have gone
  for (const slug of curSlugs) if (!seenR.has(slug)) {
    const n = (sales.sales || []).filter((x) => x.artist === slug).length, name = (sales.artists[slug] || {}).name || slug;
    if (n) throw new Error(name + " still has " + n + (n === 1 ? " sale" : " sales") + " on the site. Remove the sales and save first, then delete the artist.");
    if (c.bios) delete c.bios[slug]; delete im[slug]; changed.push("Delete artist: " + name);
  }
  // each sale keeps its place in the file: an artist's sales fill that artist's old places in their new order,
  // added ones follow the artist's last old place, and a new artist's sales go at the end
  const allSales = [], used = {}, lastAt = {};
  (sales.sales || []).forEach((x, i) => { lastAt[x.artist] = i; });
  const next = (slug) => { const k = used[slug] || 0; used[slug] = k + 1; return bySlug[slug][k]; };
  (sales.sales || []).forEach((x, i) => {
    const list = bySlug[x.artist]; if (!list) return;
    if ((used[x.artist] || 0) < list.length) allSales.push(next(x.artist));
    if (i === lastAt[x.artist]) while ((used[x.artist] || 0) < list.length) allSales.push(next(x.artist));
  });
  for (const slug of Object.keys(bySlug)) for (let k = used[slug] || 0; k < bySlug[slug].length; k++) allSales.push(bySlug[slug][k]);
  s.artists = artistsOut; s.sales = allSales;
  return { content: c, sales: s, images: im, changed };
}
export function gamSpots(content, sales, images, imageFiles) {
  return gamForEditor(content, sales, images, imageFiles).artists.map((a) => ({ key: "artist:" + a.slug, kind: "artist", label: a.name, group: "Artists", also: a.name + "'s market profile", image: a.image, alt: a.alt, credit: a.caption, slot: "artist-" + a.slug, hasCredit: true }));
}

// ---------- Street Art Dispatch: its sections, articles, artists and issue details ----------
// The site is drawn by its own assets/render.js from data/content.json and data/pages.json,
// like Global Art Monitor. Its own sections come first; then the same set every site offers.
const S_ADDR_HINT = "A page on this site such as dispatches/, or a full web address starting https://.";
const S_SRC = (f) => f.name === "href" ? { ...f, hint: S_ADDR_HINT + " Leave empty for no link." } : f;
const S_TOP = { name: "top", label: "The page's own heading", type: "yesno", group: "Look", hint: "Yes when this section starts the page: its heading is then the large page heading." };
const S_FLUSH = { name: "flush", label: "Sit close to the section above", type: "yesno", group: "Look" };
const S_HEAD = [{ name: "heading", label: "Heading", type: "text" }, { name: "intro", label: "Line under the heading", type: "text", hint: "Leave empty to hide." }];
const S_WHICH = { name: "which", label: "Which articles", type: "which", options: [["dispatches", "Every dispatch"], ["columns", "Every Urban Culture column"], ["all", "Every article"]], hint: "Or choose the articles one by one." };
const SAD_SECTIONS = {
  header: { label: "Menu bar", about: "The name, the links along the top of every page, and the menu on a phone.", summary: (st) => ((st.links || []).length + " links" + ((st.logos || []).length ? ", " + st.logos.length + (st.logos.length === 1 ? " logo" : " logos") : "")),
    blocks: [{ field: "links", label: "Menu link", add: "Add a menu link", about: "A link in the menu bar, the phone menu and the footer." }, LOGO_BLOCK], fields: [
    { name: "name", label: "Site name", type: "text" }, { name: "tagline", label: "Tagline", type: "text", hint: "Shown under the name at the top of the home page." },
    { ...LINK_ROWS, fields: [LINK_ROWS.fields[0], { ...ADDRESS, hint: S_ADDR_HINT }] },
    { name: "subscribe", label: "Subscribe button words", type: "text" }, { name: "subscribe_href", label: "Subscribe button address", type: "text", hint: "#newsletter is the sign-up on the home page." },
    { ...LOGO_ROWS, fields: LOGO_ROWS.fields.map((g) => g.name === "href" ? { ...g, hint: S_ADDR_HINT + " Leave empty for no link." } : g) },
  ] },
  footer: { label: "Footer", about: "The name, the section links and the small print at the bottom of every page.", summary: (st) => ((st.about_links || []).length + " links"), blocks: { field: "about_links", label: "Link", add: "Add a link", title: (b) => b[0] }, fields: [
    { name: "tagline", label: "Line under the name", type: "text" }, { name: "sections_heading", label: "Heading over the section links", type: "text" }, { name: "about_heading", label: "Heading over the other links", type: "text" },
    { ...LINK_ROWS, name: "about_links", label: "Other links", fields: [LINK_ROWS.fields[0], { ...ADDRESS, hint: S_ADDR_HINT }] }, { name: "legal", label: "Small print", type: "text" },
  ] },
  hero: { label: "Opening banner", about: "The large heading, introduction and lead picture at the top of the home page.", summary: (st) => st.headline || "", library: "A large heading with a lead picture",
    starter: { eyebrow: "", headline: "A heading", intro: "", button: "", button_href: "", link: "", link_href: "", photo: "Lead picture", caption: "", caption_link: "", caption_href: "" }, fields: [
    { name: "eyebrow", label: "Small line above the heading", type: "text", hint: "Leave empty to hide." }, { name: "headline", label: "Heading", type: "text" }, { name: "intro", label: "Introduction", type: "long", plain: true },
    { name: "button", label: "Button words", type: "text" }, { name: "button_href", label: "Button address", type: "text", hint: S_ADDR_HINT }, { name: "link", label: "Link words", type: "text" }, { name: "link_href", label: "Link address", type: "text", hint: S_ADDR_HINT },
    { name: "image", label: "Lead photo", type: "image", alt: "photo" },
    { name: "photo", label: "What the lead photo shows", type: "text", hint: "Read aloud to people who cannot see it, and written in the Photo to come frame until a photo is added." },
    { name: "caption", label: "Caption", type: "text" }, { name: "caption_link", label: "Caption link words", type: "text" }, { name: "caption_href", label: "Caption link address", type: "text", hint: S_ADDR_HINT },
  ] },
  features: { label: "Article cards", about: "Cards for dispatches or Urban Culture columns, as a grid with a lead story or as a row of columns.", summary: (st) => (Array.isArray(st.which) ? st.which.length + " chosen" : { dispatches: "Every dispatch", columns: "Every column", all: "Every article" }[st.which] || ""),
    library: "Cards for articles", starter: { heading: "Dispatches", intro: "", which: "dispatches", look: "grid", top: false, flush: false }, fields: [
    ...S_HEAD, S_WHICH, { name: "look", label: "Look", type: "choice", group: "Look", seg: true, options: [["grid", "Lead story and grid"], ["list", "Row of columns"]] }, S_TOP, S_FLUSH,
  ] },
  profiles: { label: "Artist cards", about: "A card for each artist. Artists without a profile yet show as Coming soon.", summary: (st) => ((st.artists || []).filter((x) => typeof x === "string").length ? st.artists.filter((x) => typeof x === "string").length + " chosen" : "Every artist"),
    library: "Cards for the artists", starter: { heading: "Artists", intro: "", artists: [], top: false, flush: false }, fields: [
    ...S_HEAD, { name: "artists", label: "Which artists", type: "artists", hint: "Leave all empty for every artist." }, S_TOP, S_FLUSH,
  ] },
  archive: { label: "Intervention archive", about: "The archive of art made in public: the latest few, or every entry with search and filters. The entries themselves are in Issue details.", summary: (st) => (st.show === "all" ? "Every entry, with search" : "The latest " + (st.count || 6)),
    library: "The archive, latest or searchable", starter: { heading: "The Intervention Archive", intro: "", show: "recent", count: 6, button: "Search all {count} interventions", button_href: "interventions/", search_hint: "", note: "", note_link: "", top: false, flush: false }, fields: [
    ...S_HEAD, { name: "show", label: "Show", type: "choice", seg: true, options: [["recent", "The latest few"], ["all", "Every entry, with search"]] }, { name: "count", label: "How many of the latest", type: "number" },
    { name: "button", label: "Button words", type: "text", hint: "{count} is the number of entries. Leave empty for no button." }, { name: "button_href", label: "Button address", type: "text", hint: S_ADDR_HINT },
    { name: "search_hint", label: "Words in the empty search box", type: "text" }, { name: "note", label: "Note under the archive", type: "long", plain: true }, { name: "note_link", label: "Words of the link to send an entry", type: "text", hint: "Opens an email to info@grovegallery.com. Leave empty for none." }, S_TOP, S_FLUSH,
  ] },
  "exhibition-list": { label: "Exhibition listings", about: "The exhibitions in Issue details, each in a card with its dates and status.", summary: () => "From Issue details", library: "The exhibition listings", starter: { heading: "Exhibitions", intro: "", top: false, flush: false }, fields: [...S_HEAD, S_TOP, S_FLUSH] },
  collecting: { label: "Collecting band", about: "The collecting figures, a short primer and the glossary, in a dark green band. The figures and terms are in Issue details.", summary: (st) => st.heading || "", library: "Figures, primer and glossary",
    starter: { heading: "Collecting Street Art", intro: "", primer_heading: "A collector’s primer", primer: "", button: "", button_href: "", top: false }, fields: [
    ...S_HEAD, { name: "primer_heading", label: "Primer heading", type: "text" }, { name: "primer", label: "Primer", type: "long", plain: true }, { name: "button", label: "Button words", type: "text", hint: "Leave empty for no button." }, { name: "button_href", label: "Button address", type: "text", hint: S_ADDR_HINT }, S_TOP,
  ] },
  signup: { label: "Email sign-up", about: "Get the Dispatch: an email box and one button." + FORM_HONEST, summary: (st) => st.button || "Sign-up", library: "Visitors ask to join the letter",
    starter: { heading: "Get the Dispatch", text: "", button: "Subscribe", pitch: "" }, fields: [
    { name: "heading", label: "Heading", type: "text" }, FORM_TEXT, FORM_BUTTON("Subscribe"), { name: "pitch", label: "Line before the email address", type: "text", hint: "Such as Pitches, tips and press:. Leave empty to hide." },
  ] },
  "text-page": { label: "Page text", about: "A page heading, paragraphs, a list of headed points and a closing part, as on About and Contact.", summary: (st) => st.heading || "", library: "A page of text with a list",
    blocks: { field: "items", label: "Point", add: "Add a point", title: (b) => b.term }, starter: { heading: "A new page", stand: "", intro: [], list_heading: "", list_anchor: "", items: [], end_heading: "", end_text: "" }, fields: [
    { name: "heading", label: "Heading", type: "text" }, { name: "stand", label: "Opening line", type: "long" }, { name: "intro", label: "Paragraphs", type: "lines", hint: "One paragraph per item." },
    { name: "list_heading", label: "Heading over the points", type: "text", hint: "Leave empty to hide." }, { name: "list_anchor", label: "Name for links to the points", type: "text", hint: "Such as standards, so about/#standards leads here. Leave empty for none." },
    { name: "items", label: "Points", type: "rows", fields: [{ name: "term", label: "Heading", type: "text" }, { name: "text", label: "Words", type: "long" }] },
    { name: "end_heading", label: "Closing heading", type: "text", hint: "Leave empty to hide." }, { name: "end_text", label: "Closing words", type: "long" },
  ] },
  // the same set of sections every site offers, drawn in this site's look
  announcement: { ...GAM_SECTIONS.announcement, fields: GAM_SECTIONS.announcement.fields.map((f) => f.name === "style" ? { ...f, dflt: "pine", options: [["pine", "Dark green"], ["linen", "Linen"]] } : f.name === "messages" ? { ...f, fields: f.fields.map(S_SRC) } : f),
    starter: { ...GAM_SECTIONS.announcement.starter, style: "pine" } },
  columns: { ...GAM_SECTIONS.columns, about: "Two to four cards side by side, each with a title, a few words and a link. On a phone they stack.", fields: GAM_SECTIONS.columns.fields.map((f) => f.name === "columns" ? { ...f, fields: f.fields.map(S_SRC) } : f) },
  space: SPACE,
  quote: GAM_SECTIONS.quote,
  faq: GAM_SECTIONS.faq,
  button: { ...GAM_SECTIONS.button, about: "A heading, a line and one button, in a dark green band or on the page.", starter: { heading: "Find out more", text: "", label: "Read on", href: "dispatches/", panel: true },
    fields: GAM_SECTIONS.button.fields.filter((f) => f.name !== "colour").map((f) => f.name === "href" ? { ...f, hint: S_ADDR_HINT } : f.name === "panel" ? { ...f, label: "In a dark green band" } : f) },
  "picture-banner": { ...GAM_SECTIONS["picture-banner"], starter: { ...GAM_SECTIONS["picture-banner"].starter, href: "dispatches/", box: "pine" },
    fields: GAM_SECTIONS["picture-banner"].fields.filter((f) => f.name !== "colour").map((f) => f.name === "box" ? { ...f, dflt: "pine", options: [["pine", "Dark green"], ["linen", "Linen"]] } : f.name === "href" ? { ...f, hint: S_ADDR_HINT } : f) },
  slideshow: GAM_SECTIONS.slideshow,
  gallery: GAM_SECTIONS.gallery,
  "logo-row": { ...GAM_SECTIONS["logo-row"], fields: GAM_SECTIONS["logo-row"].fields.map((f) => f.name === "logos" ? { ...f, fields: f.fields.map(S_SRC) } : f) },
  picture: GAM_SECTIONS.picture,
  "text-picture": { ...GAM_SECTIONS["text-picture"], fields: GAM_SECTIONS["text-picture"].fields.map(S_SRC) },
  artworks: { ...GAM_SECTIONS.artworks, fields: GAM_SECTIONS.artworks.fields.map((f) => f.name === "artworks" ? { ...f, fields: f.fields.map(S_SRC) } : f) },
  exhibitions: { ...GAM_SECTIONS.exhibitions, about: "Exhibitions added by hand, each in a card with its dates and a source. The site's own listings are the Exhibition listings section." },
  career: GAM_SECTIONS.career,
  press: GAM_SECTIONS.press,
  visit: GAM_SECTIONS.visit,
  "signup-popup": SIGNUP_POPUP,
  "contact-form": { ...WAR_SECTIONS["contact-form"], starter: { eyebrow: "Contact", heading: "Write to us", text: "Pitches, tips, corrections and press all reach the same desk.", topics: ["A pitch or a tip", "A correction", "Press", "Something else"], button: "Write the email" },
    fields: [...G_HEAD, FORM_TEXT, WAR_SECTIONS["contact-form"].fields.find((f) => f.name === "topics"), FORM_BUTTON("Write the email")] },
};
const S_ARCHIVE = { name: "archive", label: "Entries", type: "rows", keep: ["read"], fields: [
  { name: "y", label: "Year", type: "text", hint: "A year such as 2018, or TBC while it is being confirmed." }, { name: "title", label: "Title", type: "text" }, { name: "artist", label: "Artist", type: "text", hint: "As the artist's name is written on the site." },
  { name: "city", label: "City", type: "text" }, { name: "country", label: "Country", type: "text" }, { name: "type", label: "Kind of work", type: "text" }, { name: "note", label: "Note", type: "long", plain: true },
  { name: "pending", label: "Date to confirm: show Awaiting confirmation", type: "yesno" },
] };
const S_SHOWS = { name: "exhibitions", label: "Exhibitions", type: "rows", fields: [
  { name: "t", label: "Title", type: "text" }, { name: "sub", label: "Second line", type: "text" }, { name: "venue", label: "Venue", type: "text" }, { name: "when", label: "Dates", type: "text", hint: "Leave as To be confirmed until the venue confirms." }, { name: "status", label: "Status", type: "text" },
] };
// A Street Art Dispatch article's or artist's photo: chosen or uploaded in the editor, with what it shows and its credit.
// Until a photo is added, what it shows is written in the site's Photo to come frame.
const S_PICTURE = (what) => ({ id: "picture", label: "Picture", about: "The photo on the " + what + " and its card, what it shows and its credit.", fields: [
  { name: "image", label: "Photo", type: "image", alt: "alt" },
  { name: "alt", label: "What the photo shows", type: "text", hint: "Read aloud to people who cannot see it, and written in the Photo to come frame until a photo is added." },
  { name: "credit", label: "Credit", type: "text", hint: "Shown under the photo, such as the photographer. Without a photo the frame says it is still to be commissioned." }] });
const SAD_ITEMS = {
  article: { label: "Article", parts: [
    { id: "words", label: "Title and summary", about: "The heading of the article and how it is listed.", fields: [
      { name: "title", label: "Title", type: "text" }, { name: "kicker", label: "Label above the title", type: "text", hint: "Such as Essay or Artist Profile." },
      { name: "standfirst", label: "Opening line", type: "long", plain: true, hint: "Shown on the article's card and under its title." },
      { name: "section", label: "Listed under", type: "choice", seg: true, options: [["dispatches", "Dispatches"], ["urban-culture", "Urban Culture"]], hint: "Moving an article changes its web address." },
      { name: "tags", label: "Filed under", type: "lines", hint: "One per item, shown at the foot of the article." },
      { name: "draft", label: "Show the Draft note", type: "yesno", hint: "Says that details are still being confirmed. Keep it on until the facts are confirmed." },
    ] },
    S_PICTURE("article"),
    { id: "body", label: "Body", about: "The text of the article.", fields: [{ name: "body", label: "Text", type: "long", hint: "Type as you would in a document." }] },
    { id: "settings", label: "Settings", about: "Whether visitors can see the article.", fields: [{ name: "hidden", label: "Hidden from the site", type: "yesno", hint: "A hidden article is kept but not shown or listed. New articles start hidden." }] },
  ] },
  artist: { label: "Artist profile", parts: [
    { id: "words", label: "Words", about: "The name and the lines about the artist.", fields: [
      { name: "name", label: "Name", type: "text" }, { name: "role", label: "Kinds of work", type: "text", hint: "Such as Intervention · Installation." },
      { name: "summary", label: "Short summary", type: "long", plain: true }, { name: "note", label: "Note on the profile", type: "long", plain: true },
      { name: "read", label: "The story the profile links to", type: "piece", hint: "An artist with a story gets a profile page. Without one the card says Coming soon." },
    ] },
    S_PICTURE("artist profile"),
    { id: "facts", label: "Key facts", about: "The facts in the box on the profile, each with its label.", fields: [{ name: "facts", label: "Facts", type: "rows", fields: [{ name: 0, label: "Label", type: "text" }, { name: 1, label: "Fact", type: "long", plain: true }] }], blocks: { field: "facts", label: "Fact", add: "Add a fact" } },
  ] },
  site: { label: "Issue details", parts: [
    { id: "details", label: "Issue", about: "The byline and date on every article.", fields: [{ name: "site.desk", label: "Name of the desk", type: "text", hint: "Articles say By and this name." }, { name: "site.date", label: "Issue date", type: "text", hint: "Such as November 2026." }] },
    { id: "archive", label: "Intervention archive", about: "Every entry in the archive, newest first on the site.", fields: [S_ARCHIVE], blocks: { field: "archive", label: "Entry", add: "Add an entry" } },
    { id: "exhibitions", label: "Exhibition listings", about: "The exhibitions on the home page and the Exhibitions page.", fields: [S_SHOWS], blocks: { field: "exhibitions", label: "Exhibition", add: "Add an exhibition" } },
    { id: "figures", label: "Collecting figures", about: "The large figures in the Collecting band.", fields: [{ name: "stats", label: "Figures", type: "rows", fields: [{ name: 0, label: "Figure", type: "text" }, { name: 1, label: "What it is", type: "text" }] }], blocks: { field: "stats", label: "Figure", add: "Add a figure" } },
    { id: "glossary", label: "Glossary", about: "The terms in the Collecting band.", fields: [{ name: "glossary", label: "Terms", type: "rows", fields: [{ name: 0, label: "Term", type: "text" }, { name: 1, label: "Meaning", type: "long", plain: true }] }], blocks: { field: "glossary", label: "Term", add: "Add a term" } },
  ] },
};
// The data file as one object for the editor, the same shape the site's assets/render.js draws from.
export function sadForEditor(content) {
  const c = JSON.parse(JSON.stringify(content || {})), notes = c.artist_notes || {};
  return {
    // a site from the Street Art Dispatch template also keeps the email its forms write to
    site: { desk: c.desk || "", date: c.date || "", ...(c.site && typeof c.site === "object" ? { email: String(c.site.email || "") } : {}) }, photos: c.photos || {}, artist_photos: c.artist_photos || {},
    articles: (c.features || []).map((f) => ({ ...f, section: "dispatches" })).concat((c.columns || []).map((f) => ({ ...f, section: "urban-culture" })))
      .map((f) => sadShown(f, (c.photo_files || {})[f.slug], (c.photos || {})[f.slug])),
    artists: (c.artists || []).map((a) => ({ slug: a.slug || slugOf(a.name), ...sadShown(a, (c.artist_photo_files || {})[a.name], (c.artist_photos || {})[a.name]), note: notes[a.name] || "" })),
    archive: c.archive || [], exhibitions: c.exhibitions || [], stats: c.stats || [], glossary: c.glossary || [],
  };
}
// A licensed photo placed in an article's or artist's space (photo_files, artist_photo_files: image, alt, caption,
// credit, credit_href, focus). The editor shows it as the item's photo while the item has none of its own.
const LIC_FILE = /^[A-Za-z0-9._-]{1,120}\.(png|jpe?g)$/;
function sadLic(v) { return v && typeof v === "object" && LIC_FILE.test(String(v.image || "")) ? v : null; }
function sadShown(x, lic, frame) {
  const l = !x.image && sadLic(lic);
  if (l) return { ...x, image: l.image, alt: x.alt || l.alt || frame || "", credit: x.credit || l.credit || "" };
  return { ...x, alt: x.alt || frame || "" };
}
// After an edit: a licensed photo left in place keeps its entry (with any new description or credit) and nothing
// is copied into the item; one changed or removed in the editor gives way to the item's own photo, or to none.
function sadLicSave(out, raw, shown, files, key) {
  const l = raw && !raw.image && sadLic(files[key]);
  if (!l) return false;
  if (String(out.image || "") === l.image) {
    const n = { ...l }, alt = String(out.alt || "").trim(), credit = String(out.credit || "").trim();
    if (alt && alt !== String(shown.alt || "")) n.alt = alt;
    if (!credit && l.credit) throw new Error("A licensed photo keeps its credit line. Change the credit, or remove the photo.");
    if (credit !== String(shown.credit || "").trim()) n.credit = credit;
    for (const k of ["image", "alt", "credit"]) { if (k !== "image" && raw[k]) out[k] = raw[k]; else delete out[k]; }
    if (canon(n) === canon(l)) return false;
    files[key] = n; return true;
  }
  delete files[key]; return true;
}
// The photo's words are kept only where they say something: what a photo shows is not repeated when it is
// the description the frame already had, and an empty photo, description or credit is left out.
function sadPicture(out, frameWords) {
  if (out.alt === (frameWords || "")) delete out.alt;
  for (const k of ["image", "alt", "credit"]) if (k in out && !String(out[k] || "").trim()) delete out[k];
}
// A year is a whole number, or TBC while it is being confirmed.
function sadYear(v) { const t = String(v == null ? "" : v).trim(); return /^\d{3,4}$/.test(t) ? Number(t) : "TBC"; }
// Turns the edited object back into data/content.json. Unchanged parts keep their exact form. Throws with a plain reason.
export function sadFromEditor(kinds, given, content) {
  if (!given || typeof given !== "object") throw new Error("The content could not be read.");
  const c = JSON.parse(JSON.stringify(content)), was = sadForEditor(content), changed = [];
  const ga = Array.isArray(given.articles) ? given.articles : was.articles, gr = Array.isArray(given.artists) ? given.artists : was.artists;
  const ctx = { artists: gr.map((a) => ({ slug: String((a && a.slug) || "") })), articleSlugs: ga.map((a) => String((a && a.slug) || "")) };
  // issue details, the archive, exhibitions, figures and glossary
  let siteChanged = false;
  for (const f of kinds.site.parts[0].fields) {
    const k = f.name.slice(5), r = keepOrClean(f, was.site[k], (given.site || {})[k], ctx);
    if (r.same) continue;
    if (k === "email") {
      const em = String(r.v || "").trim();
      if (em && !EMAIL_SHAPE.test(em)) throw new Error("The email shown on the site does not look like an email address.");
      c.site = { ...(c.site || {}), email: em };
    } else c[k] = r.v;
    siteChanged = true;
  }
  if (siteChanged) changed.push("Edit issue details");
  const lists = [["archive", S_ARCHIVE, "Edit the archive"], ["exhibitions", S_SHOWS, "Edit the exhibition listings"], ["stats", kinds.site.parts[3].fields[0], "Edit the collecting figures"], ["glossary", kinds.site.parts[4].fields[0], "Edit the glossary"]];
  for (const [key, f, note] of lists) {
    const r = keepOrClean(f, content[key] || [], given[key], ctx);
    if (r.same) continue;
    let rows = r.v;
    if (key === "archive") rows = rows.map((x) => { const o = { ...x, y: sadYear(x.y) }; if (!o.pending) delete o.pending; if (!o.read) delete o.read; return o; }).filter((x) => String(x.title || "").trim());
    else if (key === "exhibitions") rows = rows.filter((x) => String(x.t || "").trim());
    else rows = rows.filter((x) => String(x[0] || "").trim());
    if (rows.length > 400) throw new Error("A list can hold up to 400 entries.");
    c[key] = rows; changed.push(note);
  }
  // articles: dispatches and columns
  const curAll = was.articles, seen = new Set(), feats = [], cols = [];
  const rawArt = (content.features || []).concat(content.columns || []), picFiles = { ...(content.photo_files || {}) };
  let picsChanged = false;
  for (const g of ga) {
    const slug = String((g && g.slug) || ""), cur = curAll.find((x) => x.slug === slug);
    if (seen.has(slug)) throw new Error("Two articles have the same web address.");
    seen.add(slug);
    if (!cur && !SLUG.test(slug)) throw new Error("A new article needs a web address of letters, digits and hyphens.");
    const base = cur || { slug, section: "dispatches", kicker: "", title: String((g && g.title) || "New article"), standfirst: "", tags: [], body: "<p>Write here.</p>", hidden: true };
    const next = cleanItem(kinds.article, cur ? g : { ...base, ...g }, base, ctx);
    if (!String(next.title || "").trim()) throw new Error("Every article needs a title.");
    for (const k of ["hidden", "draft"]) if (next[k] === false && !(cur && k in cur)) delete next[k];
    if (!cur) changed.push("Add article: " + next.title); else if (canon(next) !== canon(cur)) changed.push((cur.hidden === true && next.hidden !== true ? "Show article: " : next.hidden === true && cur.hidden !== true ? "Hide article: " : "Edit article: ") + next.title);
    const out = { ...next }, col = out.section === "urban-culture";
    delete out.section;
    if (cur && sadLicSave(out, rawArt.find((x) => x.slug === slug), cur, picFiles, slug)) picsChanged = true;
    sadPicture(out, (content.photos || {})[slug]);
    if (col) { out.column = true; cols.push(out); } else { delete out.column; feats.push(out); }
  }
  for (const cur of curAll) if (!seen.has(cur.slug)) changed.push("Delete article: " + cur.title);
  for (const cur of curAll) if (!seen.has(cur.slug) && cur.slug in picFiles) { delete picFiles[cur.slug]; picsChanged = true; }
  if (picsChanged) c.photo_files = picFiles;
  c.features = feats; c.columns = cols;
  // artists: their words, note and facts
  const notes = { ...(content.artist_notes || {}) }, photos = { ...(content.artist_photos || {}) }, artistsOut = [], seenR = new Set();
  const artFiles = { ...(content.artist_photo_files || {}) };
  let artPicsChanged = false;
  for (const g of gr) {
    const slug = String((g && g.slug) || ""), cur = was.artists.find((a) => a.slug === slug);
    if (seenR.has(slug)) throw new Error("Two artists have the same web address.");
    seenR.add(slug);
    if (!cur && !SLUG.test(slug)) throw new Error("A new artist needs a web address of letters, digits and hyphens.");
    const base = cur || { slug, name: String((g && g.name) || "New artist"), role: "", cover: "", read: null, summary: "", facts: [], note: "" };
    const next = cleanItem(kinds.artist, cur ? g : { ...base, ...g }, base, ctx);
    const name = String(next.name || "").trim();
    if (!name) throw new Error("Every artist needs a name.");
    if (!next.read) next.read = null;
    for (const row of next.facts || []) if (!Array.isArray(row)) throw new Error("A key fact could not be read.");
    const oldName = cur ? cur.name : name;
    if (cur && name !== oldName) {
      // the note, photo description and archive entries follow the artist's new name
      if (oldName in notes) { notes[name] = notes[oldName]; delete notes[oldName]; }
      if (oldName in photos) { photos[name] = photos[oldName]; delete photos[oldName]; }
      if (oldName in artFiles) { artFiles[name] = artFiles[oldName]; delete artFiles[oldName]; artPicsChanged = true; }
      c.archive = (c.archive || []).map((x) => x.artist === oldName ? { ...x, artist: name } : x);
    }
    if (next.note) notes[name] = next.note; else delete notes[name];
    const out = { ...next }; delete out.note;
    if (cur && sadLicSave(out, (content.artists || []).find((a) => (a.slug || slugOf(a.name)) === slug), cur, artFiles, name)) artPicsChanged = true;
    sadPicture(out, photos[name]);
    // the web address stays as it was, even when the name changes
    if (slugOf(name) === slug) delete out.slug; else out.slug = slug;
    if (!cur) changed.push("Add artist: " + name); else if (canon(next) !== canon(cur)) changed.push("Edit artist: " + name);
    artistsOut.push(out);
  }
  for (const cur of was.artists) if (!seenR.has(cur.slug)) { changed.push("Delete artist: " + cur.name); delete notes[cur.name]; delete photos[cur.name]; if (cur.name in artFiles) { delete artFiles[cur.name]; artPicsChanged = true; } }
  if (artPicsChanged) c.artist_photo_files = artFiles;
  c.artists = artistsOut; c.artist_notes = notes; c.artist_photos = photos;
  // keep the file exactly as it was where nothing changed
  for (const k of ["features", "columns", "artists", "artist_notes", "artist_photos", "archive"]) if (canon(c[k]) === canon(content[k])) c[k] = content[k];
  return { content: c, changed };
}
// How each site that is drawn from its own data is read and saved. Global Art Monitor and Street Art Dispatch.
const GAM_MODEL = {
  id: "gam",
  async load(loadJson, gh, repoPath, ref) {
    const [content, sales, images, listing] = await Promise.all([loadJson("data/content.json"), loadJson("data/sales.json"), loadJson("data/images.json"), gh(repoPath + "/contents/assets/images?ref=" + encodeURIComponent(ref))]);
    if (!content || !sales) return null;
    const imageFiles = Array.isArray(listing.data) ? listing.data.filter((x) => x.type === "file").map((x) => x.name) : [];
    return { content: content.data, sales: sales.data, images: images ? images.data : {}, imageFiles, shas: [content.sha, sales.sha, images ? images.sha : ""] };
  },
  forEditor: (n) => gamForEditor(n.content, n.sales, n.images, n.imageFiles),
  fromEditor(kinds, given, n, newFiles) {
    const r = gamFromEditor(kinds, given, n.content, n.sales, n.images, n.imageFiles.concat(newFiles));
    const files = [["data/content.json", r.content, n.content], ["data/sales.json", r.sales, n.sales], ["data/images.json", r.images, n.images]].filter((x) => canon(x[1]) !== canon(x[2])).map((x) => [x[0], x[1]]);
    return { files, changed: files.length ? r.changed : [] };
  },
  spots: (n) => gamSpots(n.content, n.sales, n.images, n.imageFiles),
};
const SAD_MODEL = {
  id: "sad",
  async load(loadJson) {
    const content = await loadJson("data/content.json");
    return content ? { content: content.data, shas: [content.sha] } : null;
  },
  forEditor: (n) => sadForEditor(n.content),
  fromEditor(kinds, given, n) {
    const r = sadFromEditor(kinds, given, n.content);
    const files = canon(r.content) !== canon(n.content) ? [["data/content.json", r.content]] : [];
    return { files, changed: files.length ? r.changed : [] };
  },
  spots: () => [],
};

// ----- Sites built from the starter (the console repository's starter/ folder) -----
// Every new site begins as a copy of it: the shared 20 sections, drawn by its own assets/render.js
// from data/pages.json, data/theme.json and data/content.json, in the colours of its theme.
const ST_ADDR_HINT = "A page on this site such as about/, ./ for the home page, or a full web address starting https://.";
const ST_SRC = (f) => f.name === "href" ? { ...f, hint: ST_ADDR_HINT + " Leave empty for no link." } : f;
const ST_LOOK = (f, name) => f.name === name ? { ...f, dflt: "band", options: [["band", "Dark band"], ["page", "Page colour"]] } : f;
// A new site's sample words go in square brackets, so nobody takes them for real words. Addresses, pictures,
// descriptions of pictures, button words and small labels such as Contact stay as they are.
const ST_KEEP = ["href", "image", "alt", "map", "map_words", "email", "button", "eyebrow"];
function ST_BRACKET(fields, st, kind) {
  const out = { ...(st || {}) };
  for (const f of fields || []) {
    const v = out[f.name];
    if (f.type === "rows" && Array.isArray(v)) out[f.name] = v.map((row) => row && typeof row === "object" && !Array.isArray(row) ? ST_BRACKET(f.fields.filter((g) => !(kind === "visit" && g.name === "title")), row, kind) : row);
    else if ((f.type === "text" || f.type === "long") && typeof v === "string" && v.trim() && !ST_KEEP.includes(f.name) && !/^\[.*\]$/.test(v.trim())) out[f.name] = "[" + v.trim().replace(/\.$/, "") + "]";
  }
  return out;
}
export const STARTER_KINDS = ["announcement", "columns", "space", "quote", "faq", "button", "picture-banner", "slideshow", "gallery", "logo-row", "picture", "text-picture",
  "artworks", "exhibitions", "career", "press", "signup", "visit", "contact-form", "signup-popup"];
export const STARTER_SECTIONS = {
  header: { label: "Menu bar", about: "The name and tagline, the links along the top of every page, an optional button, and the menu on a phone.",
    summary: (st) => ((st.links || []).length + " links" + ((st.logos || []).length ? ", " + st.logos.length + (st.logos.length === 1 ? " logo" : " logos") : "")),
    blocks: [{ field: "links", label: "Menu link", add: "Add a menu link", about: "A link in the menu bar and the phone menu." }, LOGO_BLOCK], fields: [
    { name: "name", label: "Site name", type: "text" }, { name: "tagline", label: "Tagline", type: "text", hint: "Small words beside the name. Leave empty to hide." },
    { ...LINK_ROWS, fields: [LINK_ROWS.fields[0], { ...ADDRESS, hint: ST_ADDR_HINT }] },
    { name: "button", label: "Button words", type: "text", hint: "A button at the right of the menu bar. Leave empty for none." }, { name: "button_href", label: "Button address", type: "text", hint: ST_ADDR_HINT },
    { ...LOGO_ROWS, fields: LOGO_ROWS.fields.map((g) => g.name === "href" ? { ...g, hint: ST_ADDR_HINT + " Leave empty for no link." } : g) },
  ] },
  footer: { label: "Footer", about: "The name, a few links and the small print at the bottom of every page.", summary: (st) => ((st.links || []).length + " links"),
    blocks: { field: "links", label: "Link", add: "Add a link", title: (b) => b[0] }, fields: [
    { name: "tagline", label: "Line under the name", type: "text" }, { name: "links_heading", label: "Heading over the links", type: "text", hint: "Leave empty to hide." },
    { ...LINK_ROWS, fields: [LINK_ROWS.fields[0], { ...ADDRESS, hint: ST_ADDR_HINT }] }, { name: "legal", label: "Small print", type: "text" },
  ] },
};
for (const k of STARTER_KINDS) {
  const from = SAD_SECTIONS[k];
  let def = { ...from };
  if (k === "announcement") def = { ...def, fields: from.fields.map((f) => ST_LOOK(f, "style")).map((f) => f.name === "messages" ? { ...f, fields: f.fields.map(ST_SRC) } : f), starter: { ...def.starter, style: "band" } };
  if (k === "picture-banner") def = { ...def, fields: from.fields.map((f) => ST_LOOK(f, "box")).map(ST_SRC), starter: { ...def.starter, box: "band", href: "", label: "" } };
  if (k === "button") def = { ...def, about: "A heading, a line and one button, in a dark band or on the page.", starter: { ...def.starter, href: "./" },
    fields: from.fields.map((f) => f.name === "panel" ? { ...f, label: "In a dark band" } : ST_SRC(f)) };
  if (k === "columns" || k === "artworks" || k === "logo-row") def = { ...def, fields: def.fields.map((f) => f.type === "rows" ? { ...f, fields: f.fields.map(ST_SRC) } : f) };
  if (k === "text-picture") def = { ...def, fields: def.fields.map(ST_SRC) };
  if (k === "signup") def = { ...def, about: "An email box and one button, for visitors to ask to join a mailing list." + FORM_HONEST, starter: { heading: "[A heading for the sign-up]", text: "", button: "Ask to join", pitch: "" } };
  if (k === "contact-form") def = { ...def, starter: { eyebrow: "Contact", heading: "[Write to us]", text: "", topics: ["A question", "Something else"], button: "Write the email" } };
  if (k === "exhibitions") def = { ...def, about: "Exhibitions added by hand, each in a card with its dates and a source." };
  if (k === "visit") def = { ...def, starter: { ...def.starter, heading: "Visit us" } };
  if (def.starter) def = { ...def, starter: ST_BRACKET(def.fields, def.starter, k) };
  STARTER_SECTIONS[k] = def;
}
// What an article and an artist hold on a site built from the starter. Whatever is not given yet
// stays in square brackets on the page, so nothing on the site is ever made up.
const ST_SOURCES = { name: "sources", label: "Sources", type: "rows", fields: [
  { name: "title", label: "Title", type: "text", hint: "The title of the article, page or record." }, { name: "publisher", label: "Publisher", type: "text", hint: "Such as The Guardian or the gallery's own site." },
  { name: "date", label: "Date", type: "text" }, { name: "href", label: "Link", type: "text", hint: "A full web address starting https://." }] };
const ST_SOURCE_BLOCKS = { field: "sources", label: "Source", add: "Add a source", about: "A source this page rests on, listed at its foot." };
const ST_PICTURE = (what) => ({ id: "picture", label: "Picture", about: "The picture on the " + what + ", its description and its credit.", fields: [
  { name: "image", label: "Picture", type: "image" }, { name: "alt", label: "What the picture shows", type: "text", hint: "For people who cannot see it. Say what is in the picture." },
  { name: "credit", label: "Credit", type: "text", hint: "Such as the photographer and the gallery. Shown under the picture." }] });
const ST_HIDDEN = (what) => ({ id: "settings", label: "Settings", about: "Whether visitors can see the " + what + ".", fields: [
  { name: "hidden", label: "Hidden from the site", type: "yesno", hint: "A hidden " + what + " is kept here but not shown or listed. New ones start hidden, so you can write in peace." }] });
const STARTER_ITEMS = {
  article: { label: "Article", parts: [
    { id: "words", label: "Title and summary", about: "The heading of the article and how it is listed.", fields: [
      { name: "title", label: "Title", type: "text" }, { name: "kicker", label: "Small line above the title", type: "text", hint: "Such as Interview, Review or News. Leave empty to hide." },
      { name: "summary", label: "Summary", type: "long", plain: true, hint: "Shown under the title, on the Articles page and in search results." },
      { name: "date", label: "Date", type: "text", hint: "Such as 18 November 2026. The Articles page lists the newest first." },
      { name: "artist", label: "About an artist", type: "artists", one: true, hint: "The article is then listed on that artist's page." },
    ] },
    ST_PICTURE("article"),
    { id: "body", label: "The words", about: "The text of the article.", fields: [{ name: "body", label: "Text", type: "long", hint: "Type as you would in a document. A fact that comes only from an artist's own channels is written as reported." }] },
    { id: "sources", label: "Sources", about: "Every source the article rests on, listed at its foot.", fields: [ST_SOURCES], blocks: ST_SOURCE_BLOCKS },
    ST_HIDDEN("article"),
  ] },
  artist: { label: "Artist", parts: [
    { id: "words", label: "Name and line", about: "The artist's name and a short line on their work.", fields: [
      { name: "name", label: "Name", type: "text", hint: "The page keeps its web address when the name changes." }, { name: "line", label: "A short line on their work", type: "text", hint: "Such as Painter and printmaker. Shown under the name and on the Artists page." },
    ] },
    { id: "about", label: "About the artist", about: "Their work, how they make it and where it has been shown. Nothing about their private life.", fields: [{ name: "about", label: "Text", type: "long" }] },
    { id: "details", label: "Details", about: "Short facts in the box under the text, each with its label.", fields: [{ name: "details", label: "Details", type: "rows", fields: [{ name: 0, label: "Label", type: "text", hint: "Such as Based in." }, { name: 1, label: "Detail", type: "text" }] }],
      blocks: { field: "details", label: "Detail", add: "Add a detail", about: "One fact, with its label.", title: (b) => b[0] } },
    ST_PICTURE("artist page"),
    { id: "sources", label: "Sources", about: "Every source the page rests on, listed at its foot.", fields: [ST_SOURCES], blocks: ST_SOURCE_BLOCKS },
    ST_HIDDEN("artist"),
  ] },
  site: { label: "Site details", parts: [
    { id: "details", label: "Site details", about: "The email address the forms open a message to.", fields: [
      { name: "site.email", label: "Email shown on the site", type: "text", hint: "Every form opens the visitor's own email app with a message ready to send here." },
    ] },
  ] },
};
// The Articles and Artists pages the site draws itself: their small line, heading and introduction.
const STARTER_LISTS = {
  articles: { label: "Articles list", start: { eyebrow: "Articles", heading: ["Articles"], intro: "[A line about what the articles cover]" } },
  artists: { label: "Artists list", start: { eyebrow: "Artists", heading: ["Artists"], intro: "[A line about the artists on this site]" } },
};
const EMAIL_SHAPE = /^[^\s@<>"(),;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
export function starterForEditor(content) {
  const c = content || {}, s = c.site || {};
  // the logo's outline, the icons and the sharing picture come along for the preview; only the email can be changed here
  const look = Object.fromEntries(["mark", "icons", "share"].filter((k) => typeof s[k] === "string" && s[k]).map((k) => [k, s[k]]));
  return { site: { email: String(s.email || ""), address: String(s.address || ""), indexed: s.indexed === true, ...look },
    articles: JSON.parse(JSON.stringify(Array.isArray(c.articles) ? c.articles : [])), artists: JSON.parse(JSON.stringify(Array.isArray(c.artists) ? c.artists : [])) };
}
const ST_NEW_ARTICLE = (slug, g) => ({ slug, title: String((g && g.title) || "New article"), kicker: "", summary: "", date: "", artist: "", image: "", alt: "", credit: "", body: "", sources: [], hidden: true });
const ST_NEW_ARTIST = (slug, g) => ({ slug, name: String((g && g.name) || "New artist"), line: "", about: "", details: [], image: "", alt: "", credit: "", sources: [], hidden: true });
// Turns the edited site details, articles and artists back into data/content.json. Throws with a plain reason.
export function starterFromEditor(given, content, kinds = STARTER_ITEMS) {
  if (!given || typeof given !== "object") throw new Error("The site details could not be read.");
  const c = JSON.parse(JSON.stringify(content || {})), was = starterForEditor(content), changed = [];
  const want = String(((given.site || {}).email) ?? was.site.email).trim();
  if (want !== was.site.email) {
    if (want && !EMAIL_SHAPE.test(want)) throw new Error("The email shown on the site does not look like an email address.");
    c.site = { ...(c.site || {}), email: want }; changed.push("Edit site details");
  }
  const ga = Array.isArray(given.articles) ? given.articles : was.articles, gr = Array.isArray(given.artists) ? given.artists : was.artists;
  const ctx = { artists: gr.map((a) => ({ slug: String((a && a.slug) || "") })), articleSlugs: ga.map((a) => String((a && a.slug) || "")) };
  const tidy = (x) => { x.sources = (x.sources || []).filter((r) => r && String(r.title || "").trim()).map((r) => ({ ...r, href: /^https?:\/\/[^\s<>"']+$/i.test(String(r.href || "").trim()) ? String(r.href).trim() : "" })); return x; };
  const go = (list, cur0, make, kind, word, nameKey) => {
    const out = [], seen = new Set();
    if (list.length > 500) throw new Error("A site can hold up to 500 " + word + "s.");
    for (const g of list) {
      const slug = String((g && g.slug) || ""), cur = cur0.find((x) => x.slug === slug);
      if (seen.has(slug)) throw new Error("Two " + word + "s have the same web address.");
      seen.add(slug);
      if (!cur && !SLUG.test(slug)) throw new Error("A new " + word + " needs a web address of letters, digits and hyphens.");
      if (!cur && ["articles", "artists"].includes(slug)) throw new Error("That web address is taken by the " + word + "s page.");
      const base = cur || make(slug, g), next = tidy(cleanItem(kind, cur ? g : { ...base, ...g }, base, ctx));
      next.slug = slug;
      if (!String(next[nameKey] || "").trim()) throw new Error("Every " + word + " needs " + (nameKey === "name" ? "a name." : "a title."));
      const label = String(next[nameKey]).trim();
      if (!cur) changed.push("Add " + word + ": " + label);
      else if (canon(next) !== canon(cur)) changed.push((cur.hidden === true && next.hidden !== true ? "Show " : next.hidden === true && cur.hidden !== true ? "Hide " : "Edit ") + word + ": " + label);
      out.push(cur && canon(next) === canon(cur) ? cur : next);
    }
    for (const cur of cur0) if (!seen.has(cur.slug)) changed.push("Remove " + word + ": " + String(cur[nameKey] || cur.slug));
    return out;
  };
  const arts = go(ga, was.articles, ST_NEW_ARTICLE, kinds.article, "article", "title");
  const people = go(gr, was.artists, ST_NEW_ARTIST, kinds.artist, "artist", "name");
  // an article about an artist who has gone keeps nothing pointing at them
  const alive = new Set(people.map((x) => x.slug));
  const fixed = arts.map((a) => a.artist && !alive.has(a.artist) ? { ...a, artist: "" } : a);
  if (canon(fixed) !== canon((content || {}).articles || [])) c.articles = fixed;
  if (canon(people) !== canon((content || {}).artists || [])) c.artists = people;
  return { content: c, changed };
}
const STARTER_MODEL = {
  id: "starter",
  async load(loadJson) {
    const content = await loadJson("data/content.json");
    return content ? { content: content.data, shas: [content.sha] } : null;
  },
  forEditor: (n) => starterForEditor(n.content),
  fromEditor(kinds, given, n) {
    const r = starterFromEditor(given, n.content, kinds || STARTER_ITEMS);
    return { files: r.changed.length ? [["data/content.json", r.content]] : [], changed: r.changed };
  },
  spots: () => [],
};
// The looks a new site can start from: the nine ready-made ones and the three sites' own.
export const STARTER_LOOKS = [
  { name: "Ink and clay", colours: { page: "#F1EEE8", band: "#22304A", accent: "#A4572F", ink: "#1B1D22" } },
  { name: "Bark and moss", colours: { page: "#EFEAE4", band: "#3B2F2A", accent: "#5F7A3C", ink: "#1F1B19" } },
  { name: "Stone and plum", colours: { page: "#ECEAE6", band: "#4A2A3F", accent: "#9A4B2E", ink: "#1E1B1D" } },
  { name: "Sand and navy", colours: { page: "#EADFCB", band: "#1F2A44", accent: "#B07A1E", ink: "#1F2A44" } },
  { name: "Mist and forest", colours: { page: "#DCE5DF", band: "#1E3329", accent: "#B5652A", ink: "#1E3329" } },
  { name: "Paper and ink", colours: { page: "#EDEAE4", band: "#232326", accent: "#D9532F", ink: "#232326" } },
  { name: "Brick and soot", colours: { page: "#EDE6DE", band: "#2A2624", accent: "#C2412D", ink: "#2A2624" } },
  { name: "Concrete and cobalt", colours: { page: "#E9E8E4", band: "#1F2B44", accent: "#E3462F", ink: "#1F2B44" } },
  { name: "Paper and moss", colours: { page: "#EEEBE2", band: "#2D3B23", accent: "#D2422B", ink: "#2D3B23" } },
  { name: "Like World Art Review", colours: { page: "#EEE5D4", band: "#1D4A35", accent: "#B5392B", ink: "#1D1D1B" } },
  { name: "Like Global Art Monitor", colours: { page: "#F3C3C8", band: "#2A2A2F", accent: "#1F7A5C", ink: "#2A2A2F" } },
  { name: "Like Street Art Dispatch", colours: { page: "#EFE6D3", band: "#163A30", accent: "#F0283C", ink: "#163A30" } },
];
const STARTER_THEME = {
  file: "data/theme.json",
  look: { head: "h1, h2, h3, h4", body: "p, li, dd", nav: ".nav-links a", bodyFont: "var(--text)", headFont: "var(--display)", buttons: ".btn", band: "var(--band)",
    round: ".btn, .ph, .ph-img, .lcard, .qa, .ecard, .pb-box, .supop, .field input, .field select, .nl input, .mf textarea, main img, .ao-top, .ao-privacy" },
  colours: [
    { id: "page", role: "bg", label: "Page background", use: "Pages and cards", var: "--page", default: "#F1EEE8", derived: [] },
    { id: "band", role: "band", label: "Bands and buttons", use: "Dark bands, buttons and the footer", var: "--band", default: "#22304A", on: "page", min: 4.5, derived: [] },
    { id: "accent", role: "accent", label: "Highlights", use: "Link lines, small markers and the reading bar", var: "--accent", default: "#A4572F", on: "page", min: 3, derived: [] },
    { id: "ink", role: "text", label: "Text", use: "All reading text", var: "--ink", default: "#1B1D22", on: "page", min: 4.5, derived: [] },
  ],
  fonts: [
    { id: "display", role: "display", label: "Headlines", use: "Site name and titles", var: "--display", default: "Castoro", fallback: "Georgia, serif", options: ["Gloock", ...HEADLINE_FONTS] },
    { id: "text", role: "body", label: "Reading text", use: "Paragraphs and introductions", var: "--text", default: "Literata", fallback: "Georgia, serif", options: READING_FONTS },
    { id: "sans", role: "small", label: "Small text", use: "Buttons, labels and menus", var: "--sans", default: "Libre Franklin", fallback: "Arial, sans-serif", options: SMALL_FONTS },
  ],
  looks: STARTER_LOOKS,
};
export const STARTER_DIR = "starter";
// ----- Site templates: the design a new site starts from -----
// Each template is a folder in this repository (starter/, templates/<id>/) holding a copy of a site's design
// code with placeholder data files. A new site gets its own copy of the folder, so later changes to the
// original site never reach it. Nothing of the original's content comes across: no articles, artists,
// figures, photos, logos or email addresses, and every word starts in square brackets.
// The Street Art Dispatch template: its sections with bracketed starting words, and no Draft note.
const TSAD_SECTIONS = Object.fromEntries(Object.entries(SAD_SECTIONS).map(([k, v]) => [k, v.starter ? { ...v, starter: ST_BRACKET(v.fields, k === "collecting" ? { ...v.starter, heading: "Collecting" } : v.starter, k) } : v]));
const TSAD_ITEMS = Object.fromEntries(Object.entries(SAD_ITEMS).map(([k, v]) => [k, { ...v, parts: v.parts.map((part) => part.fields ? { ...part, fields: part.fields.filter((f) => f.name !== "draft") } : part) }]));
TSAD_ITEMS.site = { ...TSAD_ITEMS.site, label: "Site details", parts: TSAD_ITEMS.site.parts.map((part, i) => i ? part : { ...part, label: "Site details", about: "The byline and date on every article, and the email address the forms open a message to.",
  fields: part.fields.concat([{ name: "site.email", label: "Email shown on the site", type: "text", hint: "Every form opens the visitor's own email app with a message ready to send here." }]) }) };
export const TSAD_WORDS = Object.fromEntries(Object.entries({ ...SAD_WORDS, "form.subject": "Join the {site} mailing list" }).filter(([k]) => k !== "item.draft"));
// The Global Art Monitor template: its sections with bracketed starting words, and a plain hint on the disclosure.
const TGAM_SECTIONS = Object.fromEntries(Object.entries(GAM_SECTIONS).map(([k, v]) => [k, v.starter ? { ...v, starter: ST_BRACKET(v.fields, k === "visit" ? { ...v.starter, heading: "Visit us" } : v.starter, k) } : v]));
const TGAM_ITEMS = Object.fromEntries(Object.entries(GAM_ITEMS).map(([k, v]) => [k, { ...v, parts: v.parts.map((part) => part.fields ? { ...part, fields: part.fields.map((f) => f.name === "site.disclosure" ? { ...f, hint: "Who publishes the site, and any interest it has in the artists it covers. Readers are always told." } : f) } : part) }]));
export const TGAM_WORDS = { ...GAM_WORDS, "loading.line": "Loading the latest figures.", "form.subject": "Please add me to the mailing list" };
// Added to Global Art Monitor on 23 November (prices kept in their sale currency). The template is an older copy of its code without this note, so it stays off the template's list.
GAM_WORDS["table.mixed-note"] = "These sales were held in more than one currency. Each price is shown in the currency of its sale, and the bars are scaled within each currency, so bars in different currencies cannot be compared with each other.";
GAM_WORDS["item.standing"] = "Why the work is valued";
// The World Art Review template: its sections with bracketed starting words, and the search label naming the site.
const TWAR_SECTIONS = Object.fromEntries(Object.entries(WAR_SECTIONS).map(([k, v]) => [k, v.starter ? { ...v, starter: ST_BRACKET(v.fields, v.starter, k) } : v]));
export const TWAR_WORDS = { ...WAR_WORDS, "sr.search": "Search {site}", "form.subject": "Please add me to the mailing list" };
// The Art Correspondent template: the sections every site offers, six of its own, and a menu bar of the name and links only.
const TAC_LINK = { name: "link", label: "Link words", type: "text", hint: "Leave empty for no link." };
const TAC_HREF = { ...ADDR, label: "Link address", hint: ST_ADDR_HINT };
const TAC_EYEBROW = { name: "eyebrow", label: "Small line above the heading", type: "text", hint: "Leave empty to hide." };
export const TAC_KINDS = ["tac-opening", "tac-lead", "tac-latest", "tac-subjects", "tac-band", "tac-text", "tac-entries"];
const TAC_OWN = {
  "tac-opening": { label: "Page opening", about: "The words at the top of a page: a small line, a large heading, an introduction and a link. Large on the home page, smaller on the others.",
    summary: (st) => st.heading || "Page opening", library: "Words at the top of a page",
    starter: { size: "page", eyebrow: "", heading: "[A heading for the page]", text: "[A line that says what the page is about]", link: "", href: "" }, fields: [
    { name: "size", label: "Size", type: "choice", seg: true, dflt: "large", options: [["large", "Large"], ["page", "Page heading"]], hint: "Large suits the home page." },
    TAC_EYEBROW, { name: "heading", label: "Heading", type: "text" }, { name: "text", label: "Introduction", type: "long", plain: true, hint: "Leave empty to hide." }, TAC_LINK, TAC_HREF] },
  "tac-lead": { label: "Lead photograph", about: "One wide photograph, with a short line in handwriting under it.", summary: (st) => st.hand || "Lead photograph", library: "A wide photograph with a handwritten line",
    starter: { image: "", alt: "[What the photograph shows]", hand: "" }, fields: [
    { name: "image", label: "Photograph", type: "image", alt: "alt" }, { name: "alt", label: "What the photograph shows", type: "text", hint: "For people who cannot see it. Shown in the frame until a photograph is chosen." },
    { name: "hand", label: "Line in handwriting", type: "text", hint: "A few words under the photograph. Leave empty to hide." }] },
  "tac-latest": { label: "Latest stories", about: "The newest stories, as a numbered list or as cards. A story appears here as soon as it is shown on the site.",
    summary: (st) => (st.only ? st.only + ", " : "") + (st.style === "cards" ? "as cards" : "numbered list"), library: "The newest stories, listed or as cards",
    starter: { heading: "Latest", count: 6, style: "list", only: "", more: "All stories" }, fields: [
    { name: "heading", label: "Small heading", type: "text", hint: "Leave empty to hide." },
    { name: "style", label: "Show them as", type: "choice", seg: true, dflt: "list", options: [["list", "Numbered list"], ["cards", "Cards"]] },
    { name: "every", label: "Show every story", type: "yesno", hint: "For a page that lists them all. Otherwise How many below decides." },
    { name: "count", label: "How many", type: "range", min: 1, max: 24, step: 1, dflt: 6 },
    { name: "only", label: "Only stories with this small line", type: "text", hint: "Such as Features, to make a page of one kind of story. Leave empty for every story." },
    { name: "more", label: "Words of the link to every story", type: "text", hint: "{n} becomes the number of stories, as in All {n} stories. Leave empty to hide." }] },
  "tac-subjects": { label: "Read by subject", about: "Links to what the stories are filed under: every subject's page, then any links added here.",
    summary: (st) => { const n = (st.links || []).filter((x) => x && !x.hidden).length; return (st.artists === false ? "" : "Every subject") + (n ? (st.artists === false ? "" : ", ") + n + (n === 1 ? " link" : " links") : st.artists === false ? "No links yet" : ""); },
    library: "Links to artists and subjects", blocks: { field: "links", label: "Subject", add: "Add a subject", about: "A link to a page of stories, or to any page." },
    starter: { heading: "Read by subject", artists: true, links: [] }, fields: [
    { name: "heading", label: "Small heading", type: "text", hint: "Leave empty to hide." },
    { name: "artists", label: "List every subject's page", type: "yesno", dflt: true },
    { name: "links", label: "Subjects", type: "rows", fields: [{ name: "label", label: "Words", type: "text" }, TAC_HREF] }] },
  "tac-band": { label: "Feature band", about: "A band in the second colour, with a small line, a heading, a few words and a link, about one thing the site does.",
    summary: (st) => st.heading || "Feature band", library: "A coloured band about one feature",
    starter: { eyebrow: "[A small line above the heading]", heading: "[A heading for a feature of the site]", text: "[A few words about it]", link: "", href: "" }, fields: [
    TAC_EYEBROW, { name: "heading", label: "Heading", type: "text" }, { name: "text", label: "Words", type: "long", plain: true, hint: "Leave empty to hide." }, TAC_LINK, TAC_HREF] },
  "tac-text": { label: "Page text", about: "Words in the reading column, as on About: a larger first paragraph, paragraphs, then parts each with its own heading.",
    summary: (st) => st.heading || ((st.parts || [])[0] || {}).heading || "Page text", library: "Paragraphs and headed parts",
    blocks: { field: "parts", label: "Part", add: "Add a part", about: "A heading and the paragraphs under it." },
    starter: { heading: "", standfirst: "", paras: ["[A paragraph]"], parts: [], align: "left", link: "", href: "" }, fields: [
    { name: "heading", label: "Heading at the top", type: "text", hint: "Leave empty to hide." },
    { name: "standfirst", label: "Larger first paragraph", type: "long", plain: true, hint: "Leave empty to hide." },
    { name: "paras", label: "Paragraphs", type: "lines", hint: "One paragraph per item." },
    { name: "parts", label: "Parts", type: "rows", fields: [{ name: "heading", label: "Heading", type: "text" }, { name: "text", label: "Paragraphs", type: "long", plain: true, hint: "Leave an empty line between paragraphs." }] },
    { name: "align", label: "Words", type: "choice", seg: true, dflt: "left", options: [["left", "Ranged left"], ["centre", "Centred"]] }, TAC_LINK, TAC_HREF] },
  "tac-entries": { label: "List by hand", about: "A list you write yourself, such as the shows in the site's reporting: each with a title, a link, a line on where and when, and a few words.",
    summary: (st) => { const n = (st.entries || []).filter((x) => x && !x.hidden).length; return n + (n === 1 ? " entry" : " entries"); }, library: "A list written by hand",
    blocks: { field: "entries", label: "Entry", add: "Add an entry", about: "One entry: its title, where it leads, where and when, and a few words." },
    starter: { heading: "[A heading for the list]", numbered: false, note: "", entries: [{ title: "[A title]", href: "", where: "[Where and when]", blurb: "[A few words about it]" }] }, fields: [
    { name: "heading", label: "Small heading", type: "text", hint: "Leave empty to hide." },
    { name: "numbered", label: "Number the entries", type: "yesno" },
    { name: "entries", label: "Entries", type: "rows", fields: [{ name: "title", label: "Title", type: "text" }, { ...TAC_HREF, label: "Where it leads", hint: ST_ADDR_HINT + " Leave empty for no link." },
      { name: "where", label: "Where and when", type: "text", hint: "Such as Tate Modern, London, October 2025." }, { name: "blurb", label: "A few words", type: "long", plain: true }] },
    { name: "note", label: "Note under the list", type: "text", hint: "Such as where the entries come from. Leave empty to hide." }] },
};
const TTAC_SECTIONS = { ...STARTER_SECTIONS, header: { ...STARTER_SECTIONS.header, about: "The name and the links along the top of every page. On a phone the links sit under the name.",
  fields: STARTER_SECTIONS.header.fields.filter((f) => !["tagline", "button", "button_href"].includes(f.name)) }, ...TAC_OWN };
// What a story and a subject hold: the starter's article and artist, with the subjects a story is filed under, a chosen Read next and a line on how it was reported.
const TTAC_ITEMS = { ...STARTER_ITEMS,
  article: { ...STARTER_ITEMS.article, label: "Story", parts: STARTER_ITEMS.article.parts.map((part) => part.id === "words"
    ? { ...part, about: "The heading of the story, how it is listed, and what it is filed under.", fields: part.fields.flatMap((f) => f.name === "kicker" ? [{ ...f, label: "Section", hint: "Such as Features or Culture. Shown above the title, and a page of one section lists the stories with it." }]
      : f.name === "summary" ? [{ ...f, label: "Standfirst", hint: "One or two sentences under the title. Also shown on the story cards." },
        { name: "description", label: "Search description", type: "long", plain: true, hint: "What search results show under the title. Leave empty to use the standfirst." }]
      : f.name === "artist" ? [{ name: "subjects", label: "Filed under", type: "artists", hint: "The subjects this story is listed under, in this order. Each subject's page lists it." },
        { name: "next", label: "Read next", type: "piece", hint: "The story suggested at the end. Leave empty for the next one in the list." }] : [f]) }
    : part.id === "sources" ? { ...part, about: "How the story was reported, and every source it rests on.", fields: [{ name: "how", label: "How it was reported", type: "long", plain: true, hint: "Such as: This is a reported essay drawing on published interviews. Shown above the sources." }].concat(part.fields) } : part) },
  artist: { ...STARTER_ITEMS.artist, label: "Subject", parts: STARTER_ITEMS.artist.parts.map((part) => part.id === "words"
    ? { ...part, label: "Name and introduction", about: "The subject's name, such as an artist or a theme, and a line about what is filed under it.", fields: part.fields.map((f) => f.name === "name" ? { ...f, hint: "Such as Zara Muse or Art in public. The page keeps its web address when the name changes." } : f.name === "line" ? { ...f, label: "Introduction", type: "long", plain: true, hint: "Shown under the name, and in search results." } : f) }
    : part.id === "about" ? { ...part, label: "More about the subject", about: "Optional words under the introduction. Nothing about anyone's private life.", fields: part.fields }
    : part.id === "picture" ? { ...part, about: "An optional picture for the subject page, its description and its credit." }
    : part.id === "settings" ? { ...part, about: "Whether visitors can see the subject page." } : part) },
};
const TTAC_LISTS = {
  articles: { label: "All stories list", start: { eyebrow: "", heading: ["All stories"], intro: "[A line about what the stories cover]" } },
  artists: { label: "Subjects list", start: { eyebrow: "Read by subject", heading: ["Subjects"], intro: "[A line about the subjects the stories are filed under]" } },
};
const TTAC_THEME = { ...STARTER_THEME,
  look: { ...STARTER_THEME.look, nav: ".site-nav a", round: STARTER_THEME.look.round + ", .feature-grid li, .details, .photo" },
  colours: [
    { id: "page", role: "bg", label: "Page background", use: "Pages", var: "--page", default: "#F6F1E8", derived: [] },
    { id: "band", role: "band", label: "Buttons and footer", use: "Buttons, the footer and dark bands", var: "--band", default: "#24231F", on: "page", min: 4.5, derived: [] },
    { id: "accent", role: "accent", label: "Second colour", use: "The feature band, photograph frames and story cards", var: "--accent", default: "#D9BE91", derived: [] },
    { id: "ink", role: "text", label: "Text", use: "All reading text", var: "--ink", default: "#24231F", on: "page", min: 4.5, derived: [] },
  ],
  fonts: [
    { id: "display", role: "display", label: "Headlines", use: "Site name, titles and story names", var: "--display", default: "EB Garamond", fallback: "Georgia, serif", options: ["Gloock", ...HEADLINE_FONTS] },
    { id: "text", role: "body", label: "Reading text", use: "Paragraphs and introductions", var: "--text", default: "Karla", fallback: "Arial, sans-serif", options: [...READING_FONTS, "Karla"] },
    { id: "sans", role: "small", label: "Small text", use: "Labels, buttons and menus", var: "--sans", default: "Karla", fallback: "Arial, sans-serif", options: SMALL_FONTS },
  ],
};
// The fixed words of The Art Correspondent template, as its code writes them.
export const TTAC_WORDS = {
  "sr.social": "Social media", "menu.articles": "All stories", "menu.artists": "Subjects", "sr.photo": "Photograph to come: {what}",
  "missing.photo": "Photograph to come.", "sr.share": "Share this page", "sr.privacy": "Privacy", "sr.nav": "Sections", "sr.links": "Links",
  "menu.skip": "Skip to the stories", "form.email": "Your email address", "btn.join": "Sign up",
  "form.note": "This opens your own email app with a message ready to send to {email}.", "btn.close": "Close", "form.placeholder": "you@example.com",
  "item.reported": "Reported", "btn.count": "{n} of {total}", "btn.previous": "Previous", "btn.next": "Next", "missing.title": "Title to confirm",
  "item.dates": "Dates:", "missing.tbc": "To confirm", "btn.source": "Source", "btn.read-source": "Read it at the source",
  "missing.to-add": "To add", "form.name": "Your name", "form.your-email": "Your email address", "form.topic": "What it is about",
  "form.message": "Your message", "btn.write": "Write the email",
  "form.note-contact": "This opens your own email app with your message ready to send to {email}.", "item.sources": "Sources",
  "item.byline-date": "By {site}. Published {date}.", "item.byline": "By {site}.", "btn.read-next": "Read next", "item.filed": "Filed under",
  "item.subject": "Read by subject", "item.stories-about": "Stories filed under {name}", "sr.filter": "Show stories from", "btn.all": "All",
  "nf.eyebrow": "Page not found", "nf.title": "This page has wandered off.",
  "nf.lede": "The address may have changed, or the story may not be published yet.", "nf.home": "Back to the front page",
  "nf.moved": "This page has moved. Continue to the new address.", "form.need-email-join": "We need a working email address, so we can add you.",
  "form.subject": "Join the {site} mailing list",
  "form.sent-join": "Your email app should now be open with the message ready. Send it and we will add you. If nothing opened, write to {email}.",
  "sr.photo-box": "Photo", "form.need-email": "We need a working email address, so we can reply.",
  "form.need-message": "Please write your message first.",
  "form.sent": "Your email app should now be open with the message ready. Send it and it reaches us. If nothing opened, write to {email}.",
};
// The Editions template: prints and editions in their frames, on a bold page. Works and series are the
// site's articles and artists, at works/<name>/ and series/<name>/.
export const ED_KINDS = ["ed-slides", "ed-series", "ed-works", "ed-social", "ed-series-list"];
const ED_SLIDE = [TAC_EYEBROW, { name: "heading", label: "Heading", type: "text" }, { name: "text", label: "Words", type: "long", plain: true, hint: "Leave empty to hide." }, TAC_LINK, TAC_HREF,
  { name: "image", label: "Photograph of the work", type: "image", alt: "alt", hint: "Shown whole in its frame, never cropped." }, { name: "alt", label: "What the work shows", type: "text", hint: "For people who cannot see it." }];
const ED_OWN = {
  "ed-slides": { label: "Opening slides", about: "Up to three large slides, one at a time, each with a heading, a few words, a button and a work in its frame. Visitors move on with Previous and Next.",
    summary: (st) => { const n = (st.slides || []).filter((x) => x && !x.hidden).length; return n + (n === 1 ? " slide" : " slides"); }, library: "Large slides with a framed work",
    blocks: { field: "slides", label: "Slide", add: "Add a slide", max: 3, about: "One slide: its words, its button and the work in its frame." },
    starter: { slides: [{ eyebrow: "", heading: "[A heading for the slide]", text: "[A sentence or two]", link: "", href: "", image: "", alt: "[What the work shows]" }] }, fields: [
    { name: "slides", label: "Slides", type: "rows", max: 3, fields: ED_SLIDE }] },
  "ed-series": { label: "Series banner", about: "One series: a small line, a large heading, a few words and a button, beside two of its works in their frames.",
    summary: (st) => st.heading || st.series || "Series banner", library: "One series beside two of its works",
    starter: { eyebrow: "", series: "", heading: "[A heading, or leave empty for the series' name]", text: "", link: "", href: "" }, fields: [
    { name: "series", label: "Which series", type: "artists", one: true, hint: "Its first two works are shown. Leave empty to show frames waiting for photographs." },
    TAC_EYEBROW, { name: "heading", label: "Heading", type: "text", hint: "Leave empty for the series' name." },
    { name: "text", label: "Words", type: "long", plain: true, hint: "Leave empty for the series' short line." }, TAC_LINK, { ...TAC_HREF, hint: ST_ADDR_HINT + " Leave empty for the series' page." }] },
  "ed-works": { label: "Works", about: "A grid of works in their frames, with title, edition and price: every work, or one series. A work appears here as soon as it is shown on the site.",
    summary: (st) => (st.series ? st.series + ", " : "") + (st.every ? "every work" : (st.count || 8) + " works"), library: "A grid of framed works",
    starter: { heading: "[A heading, such as New works]", series: "", every: false, count: 8, per_row: "4", more: "" }, fields: [
    { name: "heading", label: "Heading", type: "text", hint: "Leave empty to hide, or for the series' name when one is chosen." },
    { name: "series", label: "Only this series", type: "artists", one: true, hint: "Leave empty for every work." },
    { name: "every", label: "Show every work", type: "yesno", hint: "For a page that lists them all. Otherwise How many below decides." },
    { name: "count", label: "How many", type: "range", min: 1, max: 24, step: 1, dflt: 8 },
    { name: "per_row", label: "Works in a row", type: "choice", seg: true, dflt: "4", options: [["4", "Four"], ["3", "Three"]], hint: "Two on a phone." },
    { name: "more", label: "Words of the link to every work", type: "text", hint: "{n} becomes the number of works, as in See all {n} works. Leave empty to hide." }] },
  "ed-social": { label: "Social tiles", about: "A row of your own photographs, each a link to your Instagram, TikTok or any page. Nothing is fetched from other sites.",
    summary: (st) => { const n = (st.tiles || []).filter((x) => x && !x.hidden).length; return n + (n === 1 ? " tile" : " tiles"); }, library: "Square photographs that link out",
    blocks: { field: "tiles", label: "Tile", add: "Add a tile", max: 10, about: "One square photograph and where it leads." },
    starter: { heading: "[A heading, such as Follow the studio]", link: "", href: "", tiles: [] }, fields: [
    { name: "heading", label: "Heading", type: "text", hint: "Leave empty to hide." }, { ...TAC_LINK, label: "Button words", hint: "Such as Instagram. Leave empty for no button." }, { ...TAC_HREF, label: "Button address" },
    { name: "tiles", label: "Tiles", type: "rows", max: 10, fields: [{ name: "image", label: "Photograph", type: "image", alt: "alt" }, { name: "alt", label: "What the photograph shows", type: "text", hint: "For people who cannot see it." },
      { ...TAC_HREF, label: "Where it leads", hint: "Such as your Instagram address. Leave empty for no link." }] }] },
  "ed-series-list": { label: "Every series", about: "Every series as a card with two of its works. On a series page it can leave out the series being shown.",
    summary: (st) => st.heading || "Every series", library: "A card for each series",
    starter: { heading: "[A heading, such as The series]", skip: "" }, fields: [
    { name: "heading", label: "Heading", type: "text", hint: "Leave empty to hide." },
    { name: "skip", label: "Leave out this series", type: "artists", one: true, hint: "In a series page template, connect it to the page's own series to leave that one out." }] },
};
const TED_SECTIONS = { ...STARTER_SECTIONS, header: { ...STARTER_SECTIONS.header, about: "The name in capitals and the links along the top of every page, with a bar of quick links at the foot of a phone screen.",
  fields: STARTER_SECTIONS.header.fields.filter((f) => !["tagline", "button", "button_href"].includes(f.name)).concat([{ name: "bar", label: "Quick links at the foot of a phone screen", type: "yesno", dflt: true, hint: "Home and the first two menu links, always in reach on a phone." }]) }, ...ED_OWN };
// What a work and a series hold: the starter's article and artist, with the work's series, edition, price and details.
const ED_DETAILS = (about) => ({ id: "details", label: "Details", about, fields: [{ name: "details", label: "Details", type: "rows", fields: [{ name: 0, label: "Label", type: "text", hint: "Such as Size, Paper or Frame." }, { name: 1, label: "Detail", type: "text" }] }],
  blocks: { field: "details", label: "Detail", add: "Add a detail", about: "One fact, with its label.", title: (b) => b[0] } });
const TED_ITEMS = { ...STARTER_ITEMS,
  article: { ...STARTER_ITEMS.article, label: "Work", parts: STARTER_ITEMS.article.parts.flatMap((part) => part.id === "words"
    ? [{ ...part, label: "Title, price and series", about: "The work's title, how it is listed, its price and the series it belongs to.", fields: part.fields.flatMap((f) => f.name === "kicker" ? [{ ...f, hint: "Shown above the title when the work is in no series. Leave empty to hide." }]
      : f.name === "summary" ? [{ ...f, label: "Search description", hint: "One or two sentences for search results." }]
      : f.name === "date" ? [{ name: "edition", label: "Edition", type: "text", hint: "Such as Edition of 50, or Original. Shown under the title on the cards." },
        { name: "price", label: "Price", type: "text", hint: "As it should read, such as From £250 or Sold. Leave empty to show no price." }]
      : f.name === "artist" ? [{ ...f, label: "Series", hint: "The series this work belongs to. Its page lists the work." }] : [f]) }, ED_DETAILS("Short facts beside the work, such as its size, paper and frame.")]
    : part.id === "picture" ? [{ ...part, about: "The photograph of the work, shown whole in its frame, its description and its credit." }]
    : part.id === "body" ? [{ ...part, about: "A few lines about the work." }] : [part]) },
  artist: { ...STARTER_ITEMS.artist, label: "Series", parts: STARTER_ITEMS.artist.parts.map((part) => part.id === "words"
    ? { ...part, label: "Name and line", about: "The series' name and a short line about it.", fields: part.fields.map((f) => f.name === "line" ? { ...f, label: "A short line about the series", hint: "Such as Screen prints of the estuary. Shown under the name and on the cards." } : f) }
    : part.id === "about" ? { ...part, label: "About the series", about: "Where the idea came from and how the works are made, printed and framed." }
    : part.id === "details" ? { ...part, about: "Short facts in the box under the name, such as the number of works and the edition size." }
    : part.id === "picture" ? { ...part, about: "An optional picture for the series page, its description and its credit." }
    : part.id === "settings" ? { ...part, about: "Whether visitors can see the series page." } : part) },
};
const TED_LISTS = {
  articles: { label: "All works list", start: { eyebrow: "", heading: ["All works"], intro: "[A line about the works]" } },
  artists: { label: "Series list", start: { eyebrow: "", heading: ["Series"], intro: "[A line about the series]" } },
};
const TED_THEME = { ...STARTER_THEME,
  look: { ...STARTER_THEME.look, nav: ".site-nav a", round: STARTER_THEME.look.round + ", .tile, .spics, .sq, .work-art, .slide" },
  colours: [
    { id: "page", role: "bg", label: "Page background", use: "Pages", var: "--page", default: "#0B0B0B", derived: [] },
    { id: "ink", role: "text", label: "Text and buttons", use: "All text, and the solid buttons", var: "--ink", default: "#F2F0EB", on: "page", min: 4.5, derived: [] },
    { id: "accent", role: "accent", label: "Panels", use: "The panels behind the works, the slides and the cards", var: "--accent", default: "#171716", derived: [] },
    { id: "band", role: "band", label: "Frames", use: "The frame round every work", var: "--band", default: "#050505", derived: [] },
  ],
  fonts: [
    { id: "display", role: "display", label: "Headlines", use: "Site name, headings and titles, in capitals", var: "--display", default: "Syne", fallback: "Arial, sans-serif", options: ["Syne", "Anton", "Gloock", ...HEADLINE_FONTS] },
    { id: "text", role: "body", label: "Reading text", use: "Paragraphs and introductions", var: "--text", default: "DM Sans", fallback: "Arial, sans-serif", options: ["DM Sans", ...READING_FONTS] },
    { id: "sans", role: "small", label: "Small text", use: "Labels, buttons, prices and menus", var: "--sans", default: "DM Sans", fallback: "Arial, sans-serif", options: ["DM Sans", ...SMALL_FONTS] },
  ],
  looks: [{ name: "White gallery", colours: { page: "#FFFFFF", ink: "#111111", accent: "#F1F0EC", band: "#050505" } }, { name: "Warm grey", colours: { page: "#E6E1D8", ink: "#1C1B19", accent: "#D8D2C7", band: "#050505" } }],
};
// The Editions template's own looks besides its black one: a white gallery and a warm grey.
const ED_LOOKS = [
  { name: "White gallery", colours: { page: "#FFFFFF", ink: "#111111", accent: "#F1F0EC", band: "#050505" }, fonts: { display: "Syne", text: "DM Sans", sans: "DM Sans" }, corners: "", mine: false, own: true },
  { name: "Warm grey", colours: { page: "#E6E1D8", ink: "#1C1B19", accent: "#D8D2C7", band: "#050505" }, fonts: { display: "Anton", text: "Libre Franklin", sans: "Libre Franklin" }, corners: "", mine: false, own: true },
];
// The fixed words of the Editions template, as its code writes them.
export const TED_WORDS = { "sr.social": "Social media", "menu.articles": "All works", "menu.artists": "Series", "sr.photo": "Photograph to come: {what}", "missing.photo": "Photograph to come.", "sr.share": "Share this page", "sr.privacy": "Privacy", "sr.nav": "Sections", "sr.links": "Links", "sr.bar": "Quick links", "menu.home": "Home", "menu.skip": "Skip to the works", "form.email": "Your email address", "btn.join": "Sign up", "form.note": "This opens your own email app with a message ready to send to {email}.", "btn.close": "Close", "form.placeholder": "you@example.com", "item.one-work": "1 work", "item.works": "{n} works", "btn.count": "{n} of {total}", "btn.previous": "Previous", "btn.next": "Next", "sr.slides": "Opening slides", "item.reported": "Reported", "missing.title": "Title to confirm", "item.dates": "Dates:", "missing.tbc": "To confirm", "btn.source": "Source", "btn.read-source": "Read it at the source", "missing.to-add": "To add", "form.name": "Your name", "form.your-email": "Your email address", "form.topic": "What it is about", "form.message": "Your message", "btn.write": "Write the email", "form.note-contact": "This opens your own email app with your message ready to send to {email}.", "item.sources": "Sources", "form.about-work": "About {work}", "btn.ask": "Ask about this work", "form.note-work": "This opens your own email app with a message about this work, ready to send to {email}.", "item.more-from": "More from {series}", "btn.see-series": "See the series", "item.series": "Series", "item.works-in": "Works in {series}", "nf.eyebrow": "Page not found", "nf.title": "Nothing hangs here.", "nf.lede": "The address may have changed, or the work may not be shown yet.", "nf.home": "Back to the home page", "nf.moved": "This page has moved. Continue to the new address.", "form.need-email-join": "We need a working email address, so we can add you.", "form.subject": "Join the {site} mailing list", "form.sent-join": "Your email app should now be open with the message ready. Send it and we will add you. If nothing opened, write to {email}.", "sr.photo-box": "Photo", "form.need-email": "We need a working email address, so we can reply.", "form.need-message": "Please write your message first.", "form.sent": "Your email app should now be open with the message ready. Send it and it reaches us. If nothing opened, write to {email}." };

// Where each kind of site keeps its pages, look and content (a World Art Review site keeps them in content/).
const DATA_FILES = { pages: "data/pages.json", theme: "data/theme.json", content: "data/content.json" };
const WAR_FILES = { pages: "content/pages.json", theme: "content/theme.json", content: "content/site.json" };
// The Art World Report template: an editorial site on the business of the art world. Features and
// research areas are the site's articles and artists, at features/<name>/ and research/<name>/.
// Words between stars in a heading are set in italics, as in "Understanding the *Business* of Art.".
const AWR_ITAL = "Put words between stars to set them in italics, as in Understanding the *Business* of Art.";
const AWR_EYEBROW = { name: "eyebrow", label: "Small line above the heading", type: "text", hint: "Leave empty to hide." };
const AWR_HEADING = { name: "heading", label: "Heading", type: "text", hint: AWR_ITAL + " Leave empty to hide." };
const AWR_BAND = { name: "band", label: "Background", type: "choice", seg: true, dflt: "", options: [["", "White"], ["grey", "Grey"]] };
const AWR_HREF = { ...ADDR, hint: ST_ADDR_HINT };
export const AWR_KINDS = ["awr-opening", "awr-features", "awr-cards", "awr-briefing", "awr-links", "awr-text"];
const AWR_OWN = {
  "awr-opening": { label: "Page opening", about: "The words at the top of a page: a small line, a large heading, an introduction, and a button and a link. Full screen on the home page, smaller on the others.",
    summary: (st) => String(st.heading || "Page opening").replace(/\*/g, ""), library: "Words at the top of a page",
    starter: { size: "page", eyebrow: "[A small line]", heading: "[A heading for the page]", note: "", text: "[A line that says what the page is about]", wide: false, topics: [], email: false, button: "", button_href: "", link: "", href: "" }, fields: [
    { name: "size", label: "Size", type: "choice", seg: true, dflt: "page", options: [["large", "Full screen"], ["page", "Page heading"], ["tall", "Tall"]], hint: "Full screen suits the home page. Tall suits a short page, such as Contact." },
    AWR_EYEBROW, AWR_HEADING, { name: "note", label: "Small line under the heading", type: "text", hint: "Such as Last updated 24 November 2026. Leave empty to hide." },
    { name: "text", label: "Introduction", type: "long", plain: true, hint: "Leave empty to hide." },
    { name: "wide", label: "Wider introduction", type: "yesno", hint: "For a longer introduction, as on About." },
    { name: "topics", label: "Topics in a row", type: "lines", hint: "Short words under the heading, one per line. Leave empty to hide." },
    { name: "email", label: "Show the email address, large", type: "yesno", hint: "As on Contact. The address is the one in Site details." },
    { name: "button", label: "Button words", type: "text", hint: "Leave empty for no button." }, { ...AWR_HREF, name: "button_href", label: "Button address" },
    { name: "link", label: "Link words", type: "text", hint: "A link beside the button. Leave empty for none." }, AWR_HREF] },
  "awr-features": { label: "Feature cards", about: "Cards for the features, newest first: every feature, one section's, or one research area's. A feature appears here as soon as it is shown on the site.",
    summary: (st) => (st.only ? st.only : st.folder ? "Everything in " + st.folder + "/" : st.area ? "One research area" : "Every feature") + (st.every === false ? ", up to " + (st.count || 6) : ""), library: "The features as cards",
    starter: { eyebrow: "Features", heading: "", only: "", folder: "", area: "", every: true, count: 6, empty: "Nothing has been published in this section yet.", band: "", close: false }, fields: [
    AWR_EYEBROW, AWR_HEADING,
    { name: "only", label: "Only features in these sections", type: "text", hint: "Such as Galleries, to make the page of one section, or Industry News, Reports for several. A feature counts when it is its own section or one it is also listed under. Leave empty for every section." },
    { name: "folder", label: "Only features in this folder", type: "text", hint: "Such as features, to leave out the news and reports kept in their own folders. Leave empty for every folder." },
    { name: "area", label: "Only features in this research area", type: "artists", one: true, hint: "Leave empty for every research area." },
    { name: "every", label: "Show every feature", type: "yesno", dflt: true, hint: "Otherwise How many below decides." },
    { name: "count", label: "How many", type: "range", min: 1, max: 48, step: 1, dflt: 6 },
    { name: "empty", label: "Words when there is none yet", type: "text" }, AWR_BAND,
    { name: "close", label: "Sit close under the page heading", type: "yesno", hint: "As on the section pages." }] },
  "awr-cards": { label: "Cards", about: "A row of cards, each with a heading, a line and an optional link, such as What we cover. Or one card for every research area.",
    summary: (st) => st.source === "areas" ? "Every research area" : (() => { const n = (st.cards || []).filter((x) => x && !x.hidden).length; return n + (n === 1 ? " card" : " cards"); })(),
    library: "A row of cards with headings", blocks: { field: "cards", label: "Card", add: "Add a card", about: "A card with a heading, a line and an optional link." },
    starter: { eyebrow: "[A small line]", heading: "", source: "hand", band: "", cards: [{ title: "[A heading]", text: "[A line about it]", href: "" }, { title: "[A heading]", text: "[A line about it]", href: "" }, { title: "[A heading]", text: "[A line about it]", href: "" }] }, fields: [
    AWR_EYEBROW, AWR_HEADING,
    { name: "source", label: "Cards", type: "choice", seg: true, dflt: "hand", options: [["hand", "Written here"], ["areas", "Every research area"]], hint: "Every research area shows each one's name and short line, and leads to its page." },
    { name: "cards", label: "Cards", type: "rows", fields: [{ name: "title", label: "Heading", type: "text" }, { name: "text", label: "Line", type: "long", plain: true, hint: "To make some words a link, write them in square brackets with the address after them in round brackets, as in [tell us](contact/)." }, { ...AWR_HREF, label: "Where the heading leads", hint: ST_ADDR_HINT + " Leave empty for no link." }] },
    AWR_BAND] },
  "awr-briefing": { label: "Briefing band", about: "The newsletter: a full band with the sign-up box, or a short strip at the foot of a page with a button that leads to it. The box opens the visitor's own email app with a request to join, and a line under it says so.",
    summary: (st) => (st.style === "strip" ? "Short strip: " : "Full band: ") + String(st.heading || "").replace(/\*/g, ""), library: "The newsletter, as a band or a strip",
    starter: { style: "strip", eyebrow: "", heading: "[The newsletter's *name*]", text: "[A line about what readers get]", button: "Subscribe", href: "briefing/", main: false }, fields: [
    { name: "style", label: "Shape", type: "choice", seg: true, dflt: "full", options: [["full", "Full band with the box"], ["strip", "Short strip with a button"]] },
    AWR_EYEBROW, AWR_HEADING, { name: "text", label: "Words", type: "long", plain: true, hint: "Leave empty to hide." },
    { name: "button", label: "Button words", type: "text" }, { ...AWR_HREF, label: "Where the strip's button leads", hint: "The page with the full band, such as briefing/." },
    { name: "main", label: "The page's main heading", type: "yesno", hint: "On a page that is only the newsletter, so its heading is the page's own." }] },
  "awr-links": { label: "Link list", about: "A row of large links, such as the sections or the related research areas.",
    summary: (st) => { const n = (st.links || []).filter((x) => x && !x.hidden).length; return n + (n === 1 ? " link" : " links"); }, library: "A row of large links",
    blocks: { field: "links", label: "Link", add: "Add a link", about: "One link: its words and where it goes." },
    starter: { eyebrow: "[A small line]", band: "grey", links: [{ label: "[A link]", href: "./" }] }, fields: [
    AWR_EYEBROW, { name: "links", label: "Links", type: "rows", fields: [{ name: "label", label: "Words", type: "text" }, AWR_HREF] }, AWR_BAND] },
  "awr-text": { label: "Page text", about: "Words in the reading column, with headings, lists and links, such as Privacy and Terms.",
    summary: (st) => { const h = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(String(st.body || "")); return h ? h[1].replace(/<[^>]*>/g, "").trim() : "Page text"; }, library: "Headings, paragraphs, lists and links",
    starter: { standfirst: "", body: "<h2>[A heading]</h2><p>[Write the words for this page here.]</p>" }, fields: [
    { name: "standfirst", label: "Larger first paragraph", type: "long", plain: true, hint: "Leave empty to hide." },
    { name: "body", label: "Words", type: "long", cite: false, hint: "Type as you would in a document: headings, lists and links keep their look." }] },
};
const AWR_LINKS = { ...LINK_ROWS, fields: [LINK_ROWS.fields[0], { ...ADDRESS, hint: ST_ADDR_HINT }] };
const TTAWR_SECTIONS = { ...STARTER_SECTIONS,
  header: { label: "Menu bar", about: "The name and a few links along the top of every page, and the full-screen menu that the Menu button opens.",
    summary: (st) => ((st.links || []).length + " links, " + (st.menu || []).length + " in the menu"),
    blocks: [{ field: "links", label: "Top link", add: "Add a top link", about: "A link along the top of every page. On a phone only Menu shows." },
      { field: "menu", label: "Menu link", add: "Add a menu link", about: "A large link in the full-screen menu." }], fields: [
    { name: "name", label: "Site name", type: "text" }, { ...AWR_LINKS, label: "Top links" }, { ...AWR_LINKS, name: "menu", label: "Links in the full menu" },
    { name: "line", label: "Line at the foot of the menu", type: "text", hint: "Beside the email address. Leave empty to hide." }] },
  footer: { label: "Footer", about: "The name, a line, the email address, columns of links and the small print at the bottom of every page.", summary: (st) => ((st.columns || []).length + " columns"),
    blocks: { field: "columns", label: "Column", add: "Add a column", title: (b) => b.title, blocks: [{ field: "links", label: "Link", add: "Add a link", about: "One link in this column: its words and where it goes." }] }, fields: [
    { name: "tagline", label: "Line under the name", type: "text" }, { name: "email", label: "Show the email address", type: "yesno", dflt: true },
    { name: "columns", label: "Link columns", type: "rows", fields: [{ name: "title", label: "Column heading", type: "text" }, { ...AWR_LINKS, label: "Links in this column" }] },
    { name: "legal", label: "Small print", type: "text", hint: "{year} becomes the current year." }] },
  ...AWR_OWN };
// What a feature and a research area hold.
const TTAWR_ITEMS = { ...STARTER_ITEMS,
  article: { ...STARTER_ITEMS.article, label: "Feature", parts: STARTER_ITEMS.article.parts.filter((part) => part.id !== "picture").map((part) => part.id === "words"
    ? { ...part, label: "Title and standfirst", about: "The heading of the feature, how it is listed, and where it is filed.", fields: part.fields.flatMap((f) => f.name === "kicker" ? [{ ...f, label: "Section", hint: "Such as Galleries. Shown above the title and on the cards; it leads to the page that lists that section's features." }]
      : f.name === "summary" ? [{ ...f, label: "Standfirst", hint: "One or two sentences that open the feature, in larger italics." },
        { name: "description", label: "Search description", type: "long", plain: true, hint: "What search results show under the title. Leave empty to use the standfirst." }]
      : f.name === "date" ? [{ ...f, hint: "Such as 24 November 2026. Shown in the byline; the newest features come first." }]
      : f.name === "artist" ? [{ name: "subjects", label: "Research areas", type: "artists", hint: "The research areas this feature is filed under, in this order. Each one's page lists it, and the feature links to them." }] : [f]) }
    : part.id === "settings" ? { ...part, label: "Listing and settings", about: "Its card line, its web address folder, the other sections that list it, the three shown beside it, and whether visitors can see it.", fields: [
      { name: "card", label: "Line on its card", type: "long", plain: true, hint: "One sentence shown under the title wherever the feature is listed. Leave empty for none." },
      { name: "folder", label: "Web address folder", type: "text", hint: "Leave empty for features/. Write industry-news or reports to keep news or a report in that folder. Changing it changes the feature's web address." },
      { name: "also", label: "Also listed under", type: "lines", hint: "Other sections whose page lists this feature too, one per line, such as Auction Houses." },
      { name: "more1", label: "More reading, first", type: "piece", hint: "The three shown beside the feature. Leave all three empty for the next ones in the list." },
      { name: "more2", label: "More reading, second", type: "piece" }, { name: "more3", label: "More reading, third", type: "piece" }, ...part.fields] }
    : part.id === "body" ? { ...part, about: "The text of the feature, under the standfirst. Each heading becomes a line in its contents list. Every fact rests on a named source." }
    : part.id === "sources" ? { ...part, about: "Every source the feature rests on, listed at its foot under Sources." } : part) },
  artist: { ...STARTER_ITEMS.artist, label: "Research area", parts: [
    { id: "words", label: "Name and topics", about: "The research area's name, the short line on its card, and its topics.", fields: [
      { name: "name", label: "Name", type: "text", hint: "Such as Gallery business. The page keeps its web address when the name changes." },
      { name: "line", label: "Short line", type: "text", hint: "Shown on its card, such as Representation, artist development, gallery models." },
      { name: "description", label: "Search description", type: "long", plain: true, hint: "What search results show under the name. Leave empty to use the short line." },
      { name: "topics", label: "Topics", type: "lines", hint: "Shown in a row under the name, one per line." }] },
    { id: "related", label: "Related sections", about: "Links to the section pages this research area relates to, shown under its features.",
      fields: [{ name: "related", label: "Related sections", type: "rows", fields: [{ name: "label", label: "Words", type: "text" }, AWR_HREF] }],
      blocks: { field: "related", label: "Section", add: "Add a section", about: "A link to a section page, such as Galleries." } },
    ST_HIDDEN("research area")] },
};
const TTAWR_LISTS = {
  articles: { label: "Features list", start: { eyebrow: "Features", heading: ["Features"], intro: "[A line about what the features cover]" } },
  artists: { label: "Research areas list", start: { eyebrow: "Research areas", heading: ["Research areas"], intro: "[A line about the research areas]" } },
};
const TTAWR_THEME = { ...STARTER_THEME,
  look: { ...STARTER_THEME.look, nav: ".head-nav a, .menu-btn", round: STARTER_THEME.look.round + ", .signup input" },
  colours: [
    { id: "page", role: "bg", label: "Page background", use: "Pages", var: "--page", default: "#FFFFFF", derived: [] },
    { id: "ink", role: "text", label: "Text and buttons", use: "All text, and the solid buttons", var: "--ink", default: "#191917", on: "page", min: 4.5, derived: [] },
    { id: "accent", role: "accent", label: "Grey bands", use: "The grey bands and the cards of the sections every site offers", var: "--accent", default: "#F3F3F3", derived: [] },
    { id: "band", role: "band", label: "Dark bands and footer", use: "The newsletter, the full-screen menu and the footer", var: "--band", default: "#191917", derived: [] },
  ],
  fonts: [
    { id: "display", role: "display", label: "Headlines", use: "Site name, headings and the menu", var: "--display", default: "Libre Caslon Text", fallback: "Georgia, serif", options: ["Libre Caslon Text", ...HEADLINE_FONTS] },
    { id: "text", role: "body", label: "Reading text", use: "Paragraphs, introductions and the features", var: "--text", default: "Libre Franklin", fallback: "Arial, sans-serif", options: ["Libre Franklin", ...READING_FONTS.filter((f) => f !== "Libre Franklin")] },
    { id: "sans", role: "small", label: "Small text", use: "Small lines, buttons and the menu bar", var: "--sans", default: "Libre Franklin", fallback: "Arial, sans-serif", options: SMALL_FONTS },
  ],
};
// The fixed words of The Art World Report template, as its code writes them.
export const TTAWR_WORDS = {
  "sr.social": "Social media", "menu.articles": "Features", "menu.artists": "Research areas", "sr.photo": "Photograph to come: {what}", "missing.photo": "Photograph to come.",
  "sr.share": "Share this page", "sr.privacy": "Privacy", "sr.nav": "Primary", "btn.menu": "Menu", "btn.close": "Close", "sr.menu": "All sections", "menu.skip": "Skip to content",
  "btn.join": "Subscribe", "form.email": "Email address", "form.placeholder": "Your email address",
  "form.note": "This opens your own email app with a message ready to send to {email}.", "item.reported": "Reported", "btn.count": "{n} of {total}", "btn.previous": "Previous",
  "btn.next": "Next", "missing.title": "Title to confirm", "item.dates": "Dates:", "missing.tbc": "To confirm", "btn.source": "Source", "btn.read-source": "Read it at the source",
  "missing.to-add": "To add", "form.name": "Your name", "form.your-email": "Your email address", "form.topic": "What it is about", "form.message": "Your message", "btn.write": "Write the email",
  "form.note-contact": "This opens your own email app with your message ready to send to {email}.", "item.sources": "Sources", "item.byline-date": "{site} · {date}", "item.byline": "{site}",
  "item.related-areas": "Related research areas", "item.subject": "Research area", "item.stories-about": "Features on this subject",
  "item.none-yet": "Nothing has been published on this subject yet.", "item.related": "Related sections", "item.toc": "In this article", "item.more": "More features", "item.more-other": "More reading", "nf.eyebrow": "Page not found", "nf.title": "This page does not exist.",
  "nf.home": "Back to the homepage", "form.need-email-join": "We need a working email address, so we can add you.", "form.subject": "Join the {site} mailing list",
  "form.sent-join": "Your email app should now be open with the message ready. Send it and we will add you. If nothing opened, write to {email}.", "sr.photo-box": "Photo",
  "form.need-email": "We need a working email address, so we can reply.", "form.need-message": "Please write your message first.",
  "form.sent": "Your email app should now be open with the message ready. Send it and it reaches us. If nothing opened, write to {email}.",
};
export const SITE_TEMPLATES = [
  { id: "starter", name: "The starter", dir: STARTER_DIR, global: "STARTER", ready: true, line: "Simple and flexible. The design every new site has had so far.",
    own: "None of its own", pages: "Articles and artist pages", stays: "Nothing: it has no content of its own" },
  { id: "street-art-dispatch", name: "Street Art Dispatch", dir: "templates/street-art-dispatch", global: "SAD", ready: true, line: "A magazine, with story cards and a dated archive.",
    own: "7 of its own: Opening banner, Article cards, Artist cards, Intervention archive, Exhibition listings, Collecting band and Page text", pages: "Articles, columns, artist profiles and the archive",
    stays: "Its stories, artists, archive entries, licensed photos, the stamp logo and the Draft notes. The archive, exhibitions and collecting figures arrive empty" },
  { id: "world-art-review", name: "World Art Review", dir: "templates/world-art-review", global: "", ready: true, line: "Editorial, with artist portfolios, reviews and guides.",
    own: "12 of its own, such as Opening screen, Featured artists, Read by section, Art explained, Numbers band and Artist cards", pages: "Artist portfolios, articles in four sections, exhibition guides and editorial standards",
    stays: "Its artists, articles, sources, guides, photos and the frame logo. Portfolios and articles arrive empty, and the opening and featured artist show placeholders until the first artist is published", files: WAR_FILES },
  { id: "global-art-monitor", name: "Global Art Monitor", dir: "templates/global-art-monitor", global: "GAM", ready: true, line: "Data-led, with tables, figures and timelines.",
    own: "14 of its own, such as the artist auction timeline, Latest result, All auction results, Words explained and the glossary", pages: "Articles, artist market profiles with their sales, and auction results",
    stays: "Its sales and figures, artists, articles, glossary, photos and the G logo. The tables, profiles and glossary arrive empty" },
  { id: "the-art-correspondent", name: "The Art Correspondent", dir: "templates/the-art-correspondent", global: "TAC", ready: true, line: "Quiet and text-led, with story lists by section and subject.",
    own: "6 of its own: Page opening, Lead photograph, Latest stories, Read by subject, Feature band and Page text", pages: "Stories in sections, subject pages for artists, About and Write to us",
    stays: "Its stories, artist pages, sources, the nib logo and its Studio Sessions words. Stories and subjects arrive empty" },
  { id: "the-art-world-report", name: "The Art World Report", dir: "templates/the-art-world-report", global: "TAWR", ready: true, line: "Editorial and calm, on white with black bands, with features in sections and research areas.",
    own: "6 of its own: Page opening, Feature cards, Cards, Briefing band, Link list and Page text", pages: "Features in sections, research area pages, the newsletter, About and Contact",
    stays: "Its features, research areas and sources. Features and research areas arrive empty" },
  { id: "editions", name: "Editions", dir: "templates/editions", global: "EDITIONS", ready: true, line: "Bold and gallery-like, with every work in a black frame and a paper mount.",
    own: "5 of its own: Opening slides, Series banner, Works, Social tiles and Every series", pages: "Works with price, edition and details, series pages, About and Contact",
    stays: "Nothing: it is an original design with no content of its own. Works and series arrive empty", ownLook: "Black gallery", looks: ED_LOOKS },
];
export const templateOf = (id) => SITE_TEMPLATES.find((t) => t.id === id && t.ready) || SITE_TEMPLATES[0];
// A site from the list of sites, built from the starter or from a template.
export function starterSite(e) {
  const t = templateOf(e.template), base = {
    id: e.id, name: e.name, domain: e.domain, repo: e.repo, live: !!e.live, starter: true, playground: !!e.playground, practice: !!e.playground, artists: [],
    want: e.want || "", registrar: e.registrar || "", todo: Array.isArray(e.todo) ? e.todo : [], template: t.id, dir: t.dir,
    pages: { file: "data/pages.json", images: "assets/images", meta: "data/files.json" },
    code: { edit: ["assets/render.js", "assets/site.css", "assets/site.js", "tools/build.mjs"], read: ["data/pages.json", "data/theme.json", "data/content.json"] },
  };
  if (t.id === "world-art-review") {
    const war = SITES.find((x) => x.id === "world-art-review");
    return { ...war, ...base, pages: war.pages, code: war.code, artists: [], sectionKinds: TWAR_SECTIONS, words: TWAR_WORDS, wordLocks: WORD_LOCKS.twar, files: WAR_FILES };
  }
  if (t.id === "global-art-monitor") {
    const gam = SITES.find((x) => x.id === "global-art-monitor");
    return { ...base, code: { ...base.code, read: base.code.read.concat(["data/sales.json"]) }, sectionKinds: TGAM_SECTIONS, words: TGAM_WORDS, wordLocks: WORD_LOCKS.tgam, items: TGAM_ITEMS, model: GAM_MODEL, gam: true, builtIn: gam.builtIn, theme: gam.theme, collections: [] };
  }
  if (t.id === "street-art-dispatch") {
    const sad = SITES.find((x) => x.id === "street-art-dispatch");
    return { ...base, sectionKinds: TSAD_SECTIONS, words: TSAD_WORDS, wordLocks: WORD_LOCKS.tsad, items: TSAD_ITEMS, model: SAD_MODEL, builtIn: sad.builtIn, theme: sad.theme, collections: [] };
  }
  if (t.id === "the-art-correspondent") {
    return { ...base, sectionKinds: TTAC_SECTIONS, words: TTAC_WORDS, wordLocks: WORD_LOCKS.ttac, items: TTAC_ITEMS, model: STARTER_MODEL, builtIn: ["home"], theme: TTAC_THEME, collections: [], lists: TTAC_LISTS,
      paths: { articles: "stories", artists: "subjects" } };
  }
  if (t.id === "the-art-world-report") {
    return { ...base, sectionKinds: TTAWR_SECTIONS, words: TTAWR_WORDS, wordLocks: WORD_LOCKS.ttawr, items: TTAWR_ITEMS, model: STARTER_MODEL, builtIn: ["home"], theme: TTAWR_THEME, collections: [], lists: TTAWR_LISTS,
      paths: { articles: "features", artists: "research" } };
  }
  if (t.id === "editions") {
    return { ...base, sectionKinds: TED_SECTIONS, words: TED_WORDS, wordLocks: WORD_LOCKS.ted, items: TED_ITEMS, model: STARTER_MODEL, builtIn: ["home"], theme: TED_THEME, collections: [], lists: TED_LISTS,
      paths: { articles: "works", artists: "series" } };
  }
  return { ...base, sectionKinds: STARTER_SECTIONS, words: STARTER_WORDS, wordLocks: WORD_LOCKS.starter, items: STARTER_ITEMS, model: STARTER_MODEL, builtIn: ["home"], theme: STARTER_THEME, collections: [], lists: STARTER_LISTS };
}

function cleanField(f, v, site) {
  const t = f.type;
  if (t === "text") {
    if (f.none && (v === false || /^\s*none\s*$/i.test(String(v == null ? "" : v)))) return false;
    const x = String(v == null ? "" : v).replace(/ *— */g, ", ").replace(/, ,/g, ",").slice(0, 400);
    if (f.addr) { const a = x.trim().replace(/[<>"\s]/g, ""); return /^(\.\/$|#|\/|[a-z0-9-]+\/|https?:\/\/|mailto:)/i.test(a) ? a.slice(0, 300) : ""; }
    return f.nullable && !x.trim() ? null : x;
  }
  if (t === "long") { const x = safeMarks(String(v == null ? "" : v).replace(/ *— */g, ", ").replace(/, ,/g, ",").slice(0, 60000)); return f.nullable && !x.trim() ? null : x; }
  if (t === "sources") { const ok = site.sourceIds || []; return [...new Set((Array.isArray(v) ? v : []).map(String))].filter((x) => ok.includes(x)).slice(0, 40); }
  if (t === "articles") { const ok = site.articleSlugs || []; return [...new Set((Array.isArray(v) ? v : []).map(String))].filter((x) => ok.includes(x.replace(/^a-/, ""))).map((x) => "a-" + x.replace(/^a-/, "")).slice(0, 12); }
  if (t === "lines") return (Array.isArray(v) ? v : String(v == null ? "" : v).split(/\n\s*\n/)).map((x) => x && typeof x === "object" ? (String(x.v == null ? "" : x.v).trim() ? { v: String(x.v).trim(), hidden: true } : "") : String(x).trim()).filter(Boolean).slice(0, 40);
  if (t === "number") { if (f.nullable && (v === "" || v === null || v === undefined)) return null; const n = Number(v); return Number.isFinite(n) ? n : f.nullable ? null : 0; }
  if (t === "pair") { const x = Array.isArray(v) ? v : []; return [cleanText(x[0], 200), String(x[1] == null ? "" : x[1]).replace(/[<>"\s]/g, "").slice(0, 300)]; }
  if (t === "checks") { const ok = f.options.map((o) => o[0]); return (Array.isArray(v) ? v : []).map(String).filter((x, i, a) => ok.includes(x) && a.indexOf(x) === i); }
  if (t === "which") {
    if (Array.isArray(v)) { const ok = site.articleSlugs || []; return v.map(String).filter((x, i, a) => ok.includes(x) && a.indexOf(x) === i).slice(0, 24); }
    const ok = f.options.map((o) => o[0]); return ok.includes(String(v)) ? String(v) : ok[0];
  }
  if (t === "yesno") return v === true || v === "true";
  if (t === "range") { const lo = f.min ?? 0, hi = f.max ?? 100, st = f.step || 1, n = Number(v); const x = Number.isFinite(n) ? n : (f.dflt ?? lo); return Math.min(hi, Math.max(lo, Math.round(x / st) * st)); }
  if (t === "menu") return ["main", "footer"].includes(String(v)) ? String(v) : "";
  if (t === "datetime") { const x = String(v == null ? "" : v); return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/.test(x) ? x : ""; }
  if (t === "font") { const m = /^([^:]{1,60}?)(?::(\d{3}i?))?$/.exec(String(v == null ? "" : v).trim()); if (!m) return ""; const ok = Object.keys(f.fonts || {}).concat(["system-sans", "system-serif", "system-mono"]); return ok.includes(m[1]) ? m[1] + (m[2] && m[2] !== "400" ? ":" + m[2] : "") : ""; }
  if (t === "video") { const x = String(v == null ? "" : v).trim(); if (/^https:\/\/[^\s<>"']+\.mp4(\?[^\s<>"']*)?$/i.test(x)) return x.slice(0, 300); return /^[A-Za-z0-9._-]{1,120}\.mp4$/i.test(x) ? x : ""; }
  if (t === "set") {
    const rows = Array.isArray(v) ? v : [], out = [];
    for (let i = 0; i < (f.count || 3); i++) { const row = rows[i] && typeof rows[i] === "object" ? rows[i] : {}, o = { on: row.on !== false }; for (const g of f.fields || []) o[g.name] = cleanField(g, row[g.name], site); out.push(o); }
    return out;
  }
  // in a template, an artist or an article can be the page's own ("connect stored data")
  if (t === "piece" && site.tplKind === "article" && v === "{page.article}") return v;
  if (t === "artists" && f.one && site.tplKind && v === "{page.artist}") return v;
  if (t === "piece") { const ok = site.articleSlugs || []; return ok.includes(String(v == null ? "" : v)) ? String(v) : null; }
  if (t === "choice") { const ok = f.options.map((o) => o[0]); return ok.includes(String(v == null ? "" : v)) ? String(v) : (f.dflt && ok.includes(f.dflt) ? f.dflt : ok[0]); }
  if (t === "colour") { const x = String(v == null ? "" : v).trim(); const themeOk = (f.theme || []).map((o) => o[0]); return themeOk.includes(x) ? x : (/^#[0-9a-fA-F]{6}$/.test(x) ? x.toUpperCase() : (themeOk[0] || "")); }
  if (t === "image") {
    let x = String(v == null ? "" : v).trim();
    if (f.path) { x = x.startsWith(f.path) ? x.slice(f.path.length) : x; return /^[A-Za-z0-9._-]{1,120}$/.test(x) ? f.path + x : null; }
    return /^[A-Za-z0-9._-]{0,120}$/.test(x) ? x : "";
  }
  if (t === "artists") { const ok = (site.artists || []).map((a) => a.slug).concat(site.tplKind ? ["{page.artist}"] : []); if (f.one) return ok.includes(String(v)) ? String(v) : ""; return (Array.isArray(v) ? v : []).map((x) => x && typeof x === "object" ? (ok.includes(String(x.v)) ? { v: String(x.v), hidden: true } : "") : (ok.includes(String(x)) ? String(x) : "")).filter(Boolean).slice(0, 20); }
  if (t === "rows") {
    const rows = (Array.isArray(v) ? v : []).slice(0, f.max || 40);
    return rows.map((row) => {
      const isList = f.fields.some((g) => typeof g.name === "number");
      const out = isList ? [] : {};
      for (const g of f.fields) { if (g.type === "info") continue; out[g.name] = cleanField(g, row && row[g.name], site); }
      if (!isList && row && row.hidden === true) out.hidden = true;
      // a few small values kept as they are, such as a section's address or an artwork's colour
      for (const k of f.keep || []) { const x = row && row[k]; if (typeof x === "boolean" || x === null || (typeof x === "string" && x.length <= 80 && !/[<>"]/.test(x))) { if (x !== undefined) out[k] = x; } }
      return out;
    });
  }
  return "";
}
export function cleanSettings(schema, given, site) {
  const out = {};
  for (const f of schema.fields) { if (f.type === "info") continue; out[f.name] = cleanField(f, given ? given[f.name] : undefined, site); }
  return out;
}
const SECTION_ID = /^[A-Za-z][A-Za-z0-9-]{0,40}$/;
// The same thing written with its keys in the same order, so two copies can be compared.
export function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v);
}

// Checks a whole page document from the console and returns a clean copy, or throws.
// A safe, unused file name for a photo sent from the editor.
export function photoFileName(wanted, ext, taken) {
  const base = String(wanted || "photo").toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "photo";
  const e = ext === "png" ? "png" : "jpg";
  let name = base + "." + e, n = 2;
  while (taken.includes(name)) name = base + "-" + (n++) + "." + e;
  return name;
}

// ----- pictures kept with the content: artists, their artworks and articles -----
// These are shared: an artist's picture shows on the home page and on the portfolio alike.
const PIC_FILE = /^[A-Za-z0-9._-]{1,120}$/;
function picName(v) { const m = /^images\/([A-Za-z0-9._-]{1,120})$/.exec(String(v || "")); return m ? m[1] : ""; }
function slugOf(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
const ARTICLE_GROUP = { features: "Articles: Features", explained: "Articles: Art explained", library: "Articles: Collecting library", reviews: "Articles: Reviews" };
export function pictureSpots(data) {
  const out = [];
  for (const a of (data && data.artists) || []) {
    if (!a || typeof a !== "object") continue;
    out.push({ key: "artist:" + a.slug, kind: "artist", label: a.name, group: "Artists", also: a.name + "'s portfolio and the home page", image: picName(a.image), alt: a.alt || "", credit: a.heroCredit || "", published: !!a.published, slot: "artist-" + a.slug, ref: a, creditKey: "heroCredit" });
    (a.works || []).forEach((w, i) => {
      if (!w || typeof w !== "object") return;
      out.push({ key: "work:" + a.slug + ":" + i, kind: "work", label: w.title || "Work " + (i + 1) + " by " + a.name, group: "Artworks: " + a.name, also: a.name + "'s portfolio", image: picName(w.image), alt: w.alt || "", credit: "", slot: w.title ? "work-" + a.slug + "-" + slugOf(w.title) : "", ref: w, creditKey: null });
    });
  }
  for (const x of (data && data.articles) || []) {
    if (!x || typeof x !== "object") continue;
    out.push({ key: "article:" + x.slug, kind: "article", label: x.title, group: ARTICLE_GROUP[x.section] || "Articles", section: x.section || "", hidden: x.hidden === true, also: "the article and its card in every list", image: picName(x.image), alt: x.alt || "", credit: x.credit || "", slot: "article-" + x.slug, ref: x, creditKey: "credit" });
  }
  return out;
}
export function publicSpot(sp) { const o = { ...sp }; delete o.ref; delete o.creditKey; o.hasCredit = !!sp.creditKey; return o; }
// Applies picture changes { key: { image, alt, credit } } to the content, in place.
export function applyPictures(data, changes, slotsData) {
  const spots = pictureSpots(data), done = [];
  for (const [key, c] of Object.entries(changes || {})) {
    const sp = spots.find((x) => x.key === key);
    if (!sp) throw new Error("One of the pictures is no longer on the site. Refresh and try again.");
    if (!c || typeof c !== "object") continue;
    let touched = false;
    if ("image" in c) {
      const img = String(c.image || "").trim();
      if (img && !PIC_FILE.test(img)) throw new Error("A picture's file name could not be read.");
      if (img !== sp.image) { sp.ref.image = img ? "images/" + img : null; touched = true; }
    }
    if ("alt" in c) { const v = cleanText(c.alt, 240); if (v !== sp.alt) { sp.ref.alt = v; touched = true; } }
    if ("credit" in c && sp.creditKey) { const v = cleanText(c.credit, 160); if (v !== sp.credit) { sp.ref[sp.creditKey] = v; touched = true; } }
    if (touched) done.push(sp);
  }
  let slotsChanged = false;
  if (slotsData && Array.isArray(slotsData.slots)) for (const sp of done) {
    const slot = slotsData.slots.find((x) => x.id === sp.slot);
    if (slot && slot.filled !== !!sp.ref.image) { slot.filled = !!sp.ref.image; slotsChanged = true; }
  }
  return { done: done.map((x) => x.label), slotsChanged };
}
// New artists, articles and artworks get a spot in image-slots.json, for the agents.
export function keepSlots(slotsData, data) {
  if (!slotsData || !Array.isArray(slotsData.slots)) return;
  for (const sp of pictureSpots(data)) {
    if (!sp.slot || slotsData.slots.some((x) => x.id === sp.slot)) continue;
    slotsData.slots.push({ id: sp.slot, group: sp.group, label: sp.label, filled: !!sp.image });
  }
}
// Every place a photo is used: sections of the pages, and the shared pictures.
export function usageOf(name, pagesDoc, kinds, spots) {
  const has = (v) => (Array.isArray(v) ? v.some(has) : v && typeof v === "object" ? Object.values(v).some(has) : v === name);
  const used = [];
  for (const [key, part] of Object.entries((pagesDoc && pagesDoc.shared) || {})) if (part && has(part.settings)) used.push({ label: "Every page: " + ((kinds[part.type] || {}).label || key), page: "home", where: "shared", id: key });
  for (const where of ["top", "popups", "bottom"]) for (const sec of ((pagesDoc && pagesDoc.groups) || {})[where] || []) if (has(sec.settings)) used.push({ label: "Every page: " + ((kinds[sec.type] || {}).label || sec.type) + (sec.visible === false ? " (hidden)" : ""), page: "home", where, id: sec.id });
  for (const [pk, pg] of Object.entries((pagesDoc && pagesDoc.pages) || {})) for (const sec of (pg && pg.sections) || []) {
    if (has(sec.settings)) used.push({ label: (pg.title || pk) + " page: " + ((kinds[sec.type] || {}).label || sec.type) + (sec.visible === false ? " (hidden)" : ""), page: pk, where: "page", id: sec.id });
  }
  for (const [kind, all] of Object.entries((pagesDoc && pagesDoc.templates) || {})) for (const [tid, t] of Object.entries(all || {})) for (const sec of (t && t.sections) || []) {
    if (sec.type !== "main" && has(sec.settings)) used.push({ label: "Template " + (t.name || tid) + ": " + ((kinds[sec.type] || {}).label || sec.type) + (sec.visible === false ? " (hidden)" : ""), page: "home", where: "tpl", id: "", kind, tpl: tid });
  }
  const word = { artist: "Artist: ", work: "Artwork: ", article: "Article: " };
  for (const sp of spots) if (sp.image === name) used.push({ label: word[sp.kind] + sp.label, spot: sp.key });
  return used;
}
// Fills empty descriptions next to a photo, wherever it is used.
export function fillDescriptions(v, name, alt) {
  let n = 0;
  const walk = (x) => {
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (!x || typeof x !== "object") return;
    const uses = Object.keys(x).some((k) => k !== "alt" && (x[k] === name || x[k] === "images/" + name));
    if (uses && "alt" in x && !String(x.alt || "").trim()) { x.alt = alt; n++; }
    Object.values(x).forEach(walk);
  };
  walk(v);
  return n;
}

// ----- saving articles, portfolios and sources -----
const SLUG = /^[a-z0-9][a-z0-9-]{0,60}$/;
export function slugFrom(text) { return String(text || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60); }
function itemFields(kind) { return kind.parts.filter((x) => !x.picture).flatMap((x) => x.fields); }
// Only the fields that really changed are written, so everything else keeps its exact form.
function cleanItem(kind, given, current, ctx) {
  const out = JSON.parse(JSON.stringify(current));
  for (const f of itemFields(kind)) {
    const now = cleanField(f, current[f.name], ctx), want = cleanField(f, given ? given[f.name] : undefined, ctx);
    if (canon(now) !== canon(want)) out[f.name] = want;
  }
  return out;
}
function today() { return new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }); }
function newArticle(slug, g) { return { slug, section: "explained", kicker: "", artists: [], tone: "#D3C5AA", title: String((g && g.title) || "New article"), dek: "", credit: "", minutes: 5, updated: today(), status: "Draft for review", sources: [], body: "<p>Write here.</p>", hidden: true, image: null, alt: "" }; }
function newArtist(slug, g) {
  const name = String((g && g.name) || "New artist");
  return { slug, name, letter: (name.trim()[0] || "A").toUpperCase(), published: false, image: null, alt: "", ghostWords: [name, "", "", ""], tag: "", place: "", tone: "#D3C5AA", heroTone: "#D9CCB4", summary: "", dek: "", heroCredit: "", checked: "", glance: [], sections: [], works: [], timeline: [], seen: "", related: [], research: ["Biography and background"] };
}
// Checks the articles, artists and sources sent from the editor against the ones on the site.
// Returns the new content and a short note of what changed, or throws with a plain reason.
export function cleanSite(kinds, given, current) {
  if (!given || typeof given !== "object") throw new Error("The content could not be read.");
  const out = JSON.parse(JSON.stringify(current)), changed = [];
  // sources first, so articles and portfolios can cite new ones
  const gs = given.sources && typeof given.sources === "object" && !Array.isArray(given.sources) ? given.sources : current.sources || {};
  const sources = {};
  for (const id of Object.keys(current.sources || {})) sources[id] = current.sources[id];
  for (const id of Object.keys(gs)) {
    const cur = (current.sources || {})[id];
    if (!cur && !SLUG.test(id)) throw new Error("A new source needs a short name of letters, digits and hyphens.");
    const blank = { title: "", pub: "", date: "", kind: "", url: "" }, next = cleanItem(kinds.source, cur ? gs[id] : { ...blank, ...gs[id] }, cur || blank, {});
    if (next.url && !/^https?:\/\//i.test(next.url)) throw new Error("A source's link must start with https://");
    if (!cur) { if (!String(next.title).trim()) throw new Error("A new source needs a title."); changed.push("Add source: " + next.title); }
    else if (canon(next) !== canon(cur)) changed.push("Edit source: " + next.title);
    sources[id] = next;
  }
  if (Object.keys(sources).length > 400) throw new Error("There are too many sources.");
  out.sources = sources;
  const ga = Array.isArray(given.articles) ? given.articles : current.articles || [];
  const gr = Array.isArray(given.artists) ? given.artists : current.artists || [];
  const ctx = { sourceIds: Object.keys(sources).filter((id) => !(given.sources && typeof given.sources === "object" && !Array.isArray(given.sources)) || id in given.sources), articleSlugs: ga.map((x) => String((x && x.slug) || "")), artists: gr.map((x) => ({ slug: String((x && x.slug) || "") })) };
  // artists: changed or added, never removed here
  const curArtists = current.artists || [], seenA = new Set(), artists = [];
  for (const g of gr) {
    const slug = String((g && g.slug) || ""), cur = curArtists.find((x) => x.slug === slug);
    if (seenA.has(slug)) throw new Error("Two artists have the same web address.");
    seenA.add(slug);
    if (!cur && !SLUG.test(slug)) throw new Error("A new artist needs a web address of letters, digits and hyphens.");
    const base = cur || newArtist(slug, g), next = cleanItem(kinds.artist, cur ? g : { ...base, ...g }, base, ctx);
    if (!String(next.name || "").trim()) throw new Error("Every artist needs a name.");
    if (!cur || next.name !== cur.name) next.letter = (String(next.name).trim()[0] || "A").toUpperCase();
    if (!cur) changed.push("Add artist: " + next.name); else if (canon(next) !== canon(cur)) changed.push("Edit portfolio: " + next.name);
    artists.push(next);
  }
  // an artist can go only when no article names them
  for (const cur of curArtists) if (!seenA.has(cur.slug)) {
    const named = ga.find((a) => Array.isArray(a && a.artists) && a.artists.includes(cur.slug));
    if (named) throw new Error(cur.name + " is named in the article " + named.title + ". Take them out of it first, or unpublish the portfolio instead.");
    changed.push("Delete artist: " + cur.name);
  }
  if (artists.length > 60) throw new Error("There are too many artists.");
  out.artists = artists;
  // articles: changed, added, moved or deleted
  const curArticles = current.articles || [], seen = new Set(), articles = [];
  for (const g of ga) {
    const slug = String((g && g.slug) || ""), cur = curArticles.find((x) => x.slug === slug);
    if (seen.has(slug)) throw new Error("Two articles have the same web address.");
    seen.add(slug);
    if (!cur && !SLUG.test(slug)) throw new Error("A new article needs a web address of letters, digits and hyphens.");
    const base = cur || newArticle(slug, g), next = cleanItem(kinds.article, cur ? g : { ...base, ...g }, base, ctx);
    if (!String(next.title || "").trim()) throw new Error("Every article needs a title.");
    if (next.hidden === false && (!cur || !("hidden" in cur))) delete next.hidden;
    if (!cur) changed.push("Add article: " + next.title); else if (canon(next) !== canon(cur)) changed.push((cur.hidden === true && next.hidden !== true ? "Show article: " : next.hidden === true && cur.hidden !== true ? "Hide article: " : "Edit article: ") + next.title);
    articles.push(next);
  }
  for (const cur of curArticles) if (!seen.has(cur.slug)) changed.push("Delete article: " + cur.title);
  if (articles.length > 400) throw new Error("There are too many articles.");
  if (curArticles.map((x) => x.slug).join() !== articles.map((x) => x.slug).join() && !changed.length) changed.push("Reorder articles");
  out.articles = articles;
  // a source can go only when nothing cites it any more
  if (given.sources && typeof given.sources === "object" && !Array.isArray(given.sources)) {
    const text = JSON.stringify({ a: given.artists || current.artists, b: given.articles || current.articles });
    for (const id of Object.keys(current.sources || {})) {
      if (id in given.sources) continue;
      if (text.includes('"' + id + '"') || text.includes('\\"' + id + '\\"')) throw new Error("The source " + (current.sources[id].title || id) + " is still cited. Take it out of those places first.");
      delete out.sources[id]; changed.push("Delete source: " + (current.sources[id].title || id));
    }
  }
  return { data: out, changed };
}
// Item data as the editor sees it: artwork pictures by file name, like every other picture.
export function siteForEditor(data) {
  const out = JSON.parse(JSON.stringify(data || {}));
  for (const a of out.artists || []) for (const w of a.works || []) if (w && typeof w === "object") { w.image = picName(w.image); if (!("alt" in w)) w.alt = ""; }
  return out;
}

const GROUP_ID = /^every-[a-z0-9-]{1,40}$/;
function cleanSection(spec, sec, id, site) {
  const out = { id, type: sec.type, visible: sec.visible !== false, settings: cleanSettings(spec[sec.type], sec.settings, site) };
  if (spec[sec.type].popup) out.settings.delay = Math.max(3, Math.min(60, Math.round(Number(out.settings.delay) || 8)));
  const nm = cleanText(sec.name, 40); if (nm) out.name = nm;
  const css = cleanCss(sec.css); if (css) out.css = css;
  return out;
}
// Custom CSS for one section. Nothing that could load from another website or run as code is kept.
export function cleanCss(v) {
  let x = String(v == null ? "" : v).replace(/\r/g, "").slice(0, 6000);
  x = x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[<>]/g, "").replace(/\\/g, "");
  x = x.replace(/@import[^;]*;?/gi, "").replace(/@font-face\s*\{[^}]*\}/gi, "").replace(/@charset[^;]*;?/gi, "").replace(/@namespace[^;]*;?/gi, "");
  x = x.replace(/url\s*\([^)]*\)/gi, "none").replace(/expression\s*\(/gi, "(").replace(/javascript\s*:/gi, "").replace(/-moz-binding|behaviou?r\s*:/gi, "");
  return x.split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").trim().slice(0, 5000);
}
export function cleanPages(site, given, current) {
  const spec = site.sectionKinds;
  if (!given || typeof given !== "object") throw new Error("The page could not be read.");
  const out = { _how_to_edit: current._how_to_edit, shared: {}, pages: {} };
  for (const key of Object.keys(current.shared || {})) {
    const cur = current.shared[key], g = (given.shared || {})[key] || cur;
    if (!spec[cur.type]) { out.shared[key] = cur; continue; }
    out.shared[key] = { type: cur.type, visible: g.visible !== false, settings: cleanSettings(spec[cur.type], g.settings, site) };
    const nm = cleanText(g.name, 40); if (nm) out.shared[key].name = nm;
    const css = cleanCss(g.css); if (css) out.shared[key].css = css;
  }
  // sections shared by every page, above the page's own and below them
  out.groups = { top: [], popups: [], bottom: [] };
  for (const where of ["top", "popups", "bottom"]) {
    const list = Array.isArray(given.groups && given.groups[where]) ? given.groups[where] : ((current.groups || {})[where] || []);
    if (list.length > (where === "popups" ? 3 : 10)) throw new Error(where === "popups" ? "A site can have up to 3 popups." : "Up to 10 sections can be shared by every page, at the top and at the bottom.");
    for (const sec of list) {
      if (!sec || typeof sec !== "object" || !spec[sec.type]) throw new Error("One of the sections shared by every page is of a kind this site cannot draw.");
      if (!!spec[sec.type].popup !== (where === "popups")) throw new Error(where === "popups" ? "Only popups go in the Popups group." : "A popup goes in the Popups group, not on a page.");
      const id = String(sec.id || "");
      if (!GROUP_ID.test(id) || out.groups.top.concat(out.groups.popups, out.groups.bottom).some((x) => x.id === id)) throw new Error("Every shared section needs its own short name, starting every-.");
      out.groups[where].push(cleanSection(spec, sec, id, site));
    }
  }
  // templates: the sections an article or artist page is drawn with, around the page's own content ("main")
  const tkinds = TEMPLATE_KINDS.filter((k) => site.items && site.items[k]);
  if (tkinds.length) {
    out.templates = {}; out.assign = {};
    const gt = given.templates && typeof given.templates === "object" ? given.templates : current.templates || {};
    const gas = given.assign && typeof given.assign === "object" ? given.assign : current.assign || {};
    for (const kind of tkinds) {
      const src = gt[kind] && typeof gt[kind] === "object" && !Array.isArray(gt[kind]) ? gt[kind] : {};
      const ids = Object.keys(src); if (!ids.includes("default")) ids.unshift("default");
      if (ids.length > 10) throw new Error("Each kind of page can have up to 10 templates.");
      const names = new Set(); out.templates[kind] = {};
      for (const id of ids) {
        if (!TPL_ID.test(id)) throw new Error("A template needs a short name of letters, digits and hyphens.");
        const t = src[id] && typeof src[id] === "object" ? src[id] : {};
        const name = cleanText(t.name, 25) || (id === "default" ? templateName(site, kind) : "");
        if (!name) throw new Error("Every template needs a name.");
        if (names.has(name.toLowerCase())) throw new Error("Two templates have the same name: " + name + ".");
        names.add(name.toLowerCase());
        const list = Array.isArray(t.sections) ? t.sections : [{ id: "main", type: "main" }];
        if (list.length > 21) throw new Error("A template can hold up to 20 sections around the page's own content.");
        const seen = new Set(), sections = []; let mains = 0;
        for (const sec of list) {
          if (sec && sec.type === "main") { mains++; sections.push({ id: "main", type: "main" }); continue; }
          if (!sec || typeof sec !== "object" || !spec[sec.type]) throw new Error("One of the sections in a template is of a kind this site cannot draw.");
          if (spec[sec.type].popup) throw new Error("A popup goes in the Popups group, not in a template.");
          const sid = String(sec.id || "");
          if (!TPL_SEC.test(sid) || seen.has(sid)) throw new Error("Every section in a template needs its own short name, starting t-.");
          seen.add(sid); sections.push(cleanSection(spec, sec, sid, { ...site, tplKind: kind }));
        }
        if (mains !== 1) throw new Error("A template keeps the page's own content once. It can be moved, not removed.");
        out.templates[kind][id] = { name, sections };
      }
      out.assign[kind] = {};
      const known = kind === "artist" ? (site.artists || []).map((a) => a.slug) : site.articleSlugs || null;
      const ga = gas[kind] && typeof gas[kind] === "object" && !Array.isArray(gas[kind]) ? gas[kind] : {};
      for (const slug of Object.keys(ga).sort()) {
        const id = String(ga[slug] || "");
        if (!SLUG.test(slug) || id === "default" || !out.templates[kind][id] || (known && !known.includes(slug))) continue;
        out.assign[kind][slug] = id;
      }
    }
  }
  // the home page is always there; other pages can be added and removed
  const gp = given.pages && typeof given.pages === "object" ? given.pages : current.pages || {};
  const keys = Object.keys(gp);
  if (!keys.includes("home")) keys.unshift("home");
  if (keys.length > 30) throw new Error("A site can have up to 30 pages.");
  for (const key of keys) {
    const cur = (current.pages || {})[key], g = gp[key] || cur;
    if (!cur && (!PAGE_KEY.test(key) || RESERVED.includes(key))) throw new Error("A new page needs a short web address of letters, digits and hyphens, not already used by the site.");
    const list = Array.isArray(g && g.sections) ? g.sections : [];
    if (list.length > 40) throw new Error("A page can hold up to 40 sections.");
    const seen = new Set(), sections = [];
    for (const sec of list) {
      if (!sec || typeof sec !== "object" || !spec[sec.type]) throw new Error("One of the sections is of a kind this site cannot draw.");
      if (spec[sec.type].popup) throw new Error("A popup goes in the Popups group, not on a page.");
      const id = String(sec.id || "");
      if (!SECTION_ID.test(id) || seen.has(id)) throw new Error("Every section needs its own short name.");
      seen.add(id);
      sections.push(cleanSection(spec, sec, id, site));
    }
    const main = cur && mainSectionOf(site, key, cur.sections);
    if (main && !sections.some((x) => x.id === main)) throw new Error("The main section of a page can be hidden or moved, but not removed.");
    const title = cleanText(g && g.title, site.model ? 120 : 60) || (cur && cur.title) || "";
    if (!title) throw new Error("Every page needs a title.");
    const built = site.builtIn || (site.model ? [] : ["standards"]);
    const own = !!(g && g.own === true) && key !== "home" && !built.includes(key);
    if (site.model) {
      const base = cur || { path: key + "/index.html", title, description: "", current: "", intro: false };
      out.pages[key] = { ...base, title, description: cleanText(g && g.description != null ? g.description : base.description, 300), sections };
    } else out.pages[key] = { ...(cur || {}), title, sections };
    if (own) out.pages[key].own = true; else delete out.pages[key].own;
  }
  // the site's add-ons
  out.addons = cleanAddons(site, given.addons, current.addons);
  // changed fixed words (Edit default text); none kept means no "words" in the file at all
  if (site.words) {
    const words = cleanWords(site, given.words === undefined ? current.words : given.words);
    if (Object.keys(words).length) out.words = words;
  }
  // the heading and introduction of each list page
  if (site.lists) {
    out.lists = {};
    for (const [k, l] of Object.entries(site.lists)) {
      const g = (given.lists || {})[k] || (current.lists || {})[k] || l.start;
      out.lists[k] = cleanSettings({ fields: LIST_FIELDS }, g, site);
    }
  }
  return out;
}
// The page's own content: on a page the site was built with (not the home page), the first section after its heading.
export function mainSectionOf(site, key, sections) {
  const built = site.builtIn || (site.model ? [] : ["standards"]);
  if (key === "home" || !built.includes(key)) return "";
  const s = (sections || []).find((x) => x && !["page-head", "page-heading", "announcement"].includes(x.type));
  return s ? s.id : "";
}
const PAGE_KEY = /^[a-z][a-z0-9-]{0,40}$/;
const TEMPLATE_KINDS = ["article", "artist"];
// Add-ons: our own small extras for every page of a site, each switched on or off, kept in the page list file.
export const ADDONS = [
  { id: "top", label: "Back to top button", about: "A small Top button on long pages.", icon: "arrowup",
    fields: [{ name: "label", label: "Words on the button", type: "text" }, { name: "side", label: "Where it sits", type: "choice", options: [["right", "Right"], ["left", "Left"]] },
      { name: "after", label: "Shows after scrolling", type: "range", min: 200, max: 2000, step: 100, unit: "px", dflt: 600, hint: "How far down the page before it appears." }],
    start: { on: false, label: "Top", side: "right", after: 600 } },
  { id: "progress", label: "Reading progress", about: "How far through an article the reader is.", icon: "progress",
    fields: [{ name: "style", label: "How it shows", type: "choice", options: [["bar", "A thin bar at the top"], ["percent", "A percentage in the corner"]], select: true },
      { name: "where", label: "On which pages", type: "choice", options: [["articles", "Articles"], ["items", "Articles and artist pages"], ["all", "Every page"]], select: true }],
    start: { on: false, style: "bar", where: "articles" } },
  { id: "share", label: "Share links", about: "Email, X, LinkedIn and Facebook, as plain links.", icon: "share",
    fields: [{ name: "heading", label: "Words before the links", type: "text" }, { name: "networks", label: "Ways to share", type: "checks", options: [["email", "Email"], ["x", "X"], ["linkedin", "LinkedIn"], ["facebook", "Facebook"]] },
      { name: "where", label: "On which pages", type: "choice", options: [["articles", "Articles"], ["items", "Articles and artist pages"]], select: true }],
    start: { on: false, heading: "Share this page", networks: ["email", "x", "linkedin", "facebook"], where: "articles" } },
  { id: "privacy", label: "Privacy notice", about: "Says the site uses no tracking, with a Close button.", icon: "shield",
    fields: [{ name: "text", label: "The notice", type: "text" }, { name: "link_label", label: "Link words", type: "text", hint: "Leave empty for no link." }, { name: "link", label: "Link to", type: "text", addr: true },
      { name: "button", label: "Close button words", type: "text" }],
    start: { on: false, text: "This site uses no tracking and no adverts.", link_label: "", link: "", button: "Close" } },
];
export function cleanAddons(site, given, current) {
  const out = {};
  for (const a of ADDONS) {
    const g = (given && typeof given === "object" && given[a.id] && typeof given[a.id] === "object") ? given[a.id] : (current && current[a.id]) || a.start;
    out[a.id] = { on: g.on === true, ...cleanSettings({ fields: a.fields }, { ...a.start, ...g }, site) };
  }
  return out;
}
const TPL_ID = /^[a-z0-9][a-z0-9-]{0,30}$/;
const TPL_SEC = /^t-[a-z0-9-]{1,40}$/;
// The default template's name: "Default article", "Default artist portfolio" and so on, in 25 characters at most.
export function templateName(site, kind) {
  const l = String(((site.items || {})[kind] || {}).label || kind).toLowerCase();
  return ("Default " + l).length <= 25 ? "Default " + l : ("Default " + l.replace(/^artist /, "")).slice(0, 25);
}
const RESERVED = ["home", "artists", "reviews", "explained", "library", "guides", "standards", "research", "search", "assets", "data", "tools", "inbox", "preview", "auction-results", "market-intelligence", "collecting-valuation", "about", "contact", "dispatches", "urban-culture", "interventions", "exhibitions", "collecting", "images", "stories", "subjects", "articles"];
// A section's kinds of block, as a list. A kind is a list of rows, a list of names, or one block made of some of the section's own fields.
export function blockKinds(b) {
  return (Array.isArray(b) ? b : b ? [b] : []).map((x) => {
    const o = { field: x.field, label: x.label, add: x.add || "", about: x.about || "" };
    if (x.one) { o.one = true; o.hide = x.hide || ""; o.fields = x.fields || []; }
    if (x.item) o.item = x.item;
    if (x.max) o.max = x.max;
    if (x.blocks) o.blocks = blockKinds(x.blocks);
    return o;
  });
}
// What the console needs to draw the editor: each kind's label, fields and starter.
function kindsFor(site) {
  const out = {};
  for (const [k, v] of Object.entries(site.sectionKinds || {})) {
    out[k] = { label: v.label, about: v.about || "", fields: v.fields, library: v.library || "", starter: v.starter || null };
    if (v.popup) out[k].popup = true;
    if (v.blocks) out[k].blocks = blockKinds(v.blocks);
  }
  return out;
}
function summariesFor(site, pages) {
  const f = (sec) => { const k = site.sectionKinds[sec.type]; try { return k && k.summary ? String(k.summary(sec.settings || {})) : ""; } catch (_e) { return ""; } };
  const out = {};
  for (const [key, part] of Object.entries(pages.shared || {})) out["shared:" + key] = f(part);
  for (const where of ["top", "popups", "bottom"]) for (const sec of ((pages.groups || {})[where] || [])) out["every:" + sec.id] = f(sec);
  for (const [key, pg] of Object.entries(pages.pages || {})) for (const sec of pg.sections || []) out[key + ":" + sec.id] = f(sec);
  for (const [kind, all] of Object.entries(pages.templates || {})) for (const [id, t] of Object.entries(all || {})) for (const sec of (t && t.sections) || []) if (sec.type !== "main") out["tpl:" + kind + ":" + id + ":" + sec.id] = f(sec);
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
    pages: { file: "content/pages.json", images: "images", meta: "content/files.json", content: "content/site.json" },
    code: { edit: ["src/index.html", "tools/build_site.py"], read: ["content/pages.json", "content/theme.json", "content/site.json"] },
    sectionKinds: WAR_SECTIONS, words: WAR_WORDS, wordLocks: WORD_LOCKS.war,
    items: WAR_ITEMS,
    lists: WAR_LISTS,
    theme: {
      file: "content/theme.json",
      look: { head: "#main h1, #main h2, #main h3, #main h4", body: "#main p, #main li, #main dd, #main blockquote", nav: ".hdr .left a, .hdr .right a, .hdr .right button", bodyFont: "var(--text)", headFont: "var(--display)", buttons: ".btn", band: "var(--green)", round: ".btn, .mf input, .mf select, .mf textarea, #main img", crumbs: ".crumbs" },
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
    pages: { file: "data/pages.json", images: "assets/images", meta: "data/files.json" },
    code: { edit: ["assets/render.js", "assets/site.css", "assets/site.js", "tools/build.mjs"], read: ["data/pages.json", "data/theme.json", "data/content.json", "data/sales.json"] },
    sectionKinds: GAM_SECTIONS, words: GAM_WORDS, wordLocks: WORD_LOCKS.gam,
    items: GAM_ITEMS,
    gam: true,
    model: GAM_MODEL,
    builtIn: ["home", "auction-results", "artists", "research", "market-intelligence", "collecting-valuation", "about", "contact"],
    theme: {
      file: "data/theme.json",
      look: { head: "h1, h2, h3, h4", body: "p, li, dd", nav: ".nav a", bodyFont: "var(--sans)", headFont: "var(--serif)", buttons: ".pill", band: "var(--ink)", round: ".pill, .chip, .card, .site-head, .nav a, main img" },
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
  {
    // Street Art Dispatch: drawn by its own assets/render.js from data/content.json and data/pages.json,
    // edited in the page editor like Global Art Monitor.
    id: "street-art-dispatch",
    name: "Street Art Dispatch",
    domain: "streetartdispatch.com",
    repo: "Artiscope/street-art-dispatch",
    live: true,
    artists: [
      { slug: "konn-artiss", name: "Konn Artiss" },
      { slug: "banksy", name: "Banksy" },
      { slug: "invader", name: "Invader" },
      { slug: "shepard-fairey", name: "Shepard Fairey" },
    ],
    pages: { file: "data/pages.json", images: "assets/images", meta: "data/files.json" },
    code: { edit: ["assets/render.js", "assets/site.css", "assets/site.js", "tools/build.mjs"], read: ["data/pages.json", "data/theme.json", "data/content.json"] },
    sectionKinds: SAD_SECTIONS, words: SAD_WORDS, wordLocks: WORD_LOCKS.sad,
    items: SAD_ITEMS,
    model: SAD_MODEL,
    builtIn: ["home", "dispatches", "urban-culture", "artists", "interventions", "exhibitions", "collecting", "about", "contact"],
    theme: {
      file: "data/theme.json",
      look: { head: "h1, h2, h3, h4", body: "p, li, dd", nav: ".nav-links a", bodyFont: "var(--serif)", headFont: "var(--display)", buttons: ".btn", band: "var(--pine)", round: ".btn, .ph-img, .field input, .field select, main img" },
      colours: [
        { id: "linen", role: "bg", label: "Page background", use: "Pages and cards", var: "--linen", default: "#EFE6D3",
          derived: [["--linen-2", 95, "black"], ["--linen-3", 90, "black"]] },
        { id: "pine", role: "band", label: "Bands and text", use: "Text, the footer and the dark green bands", var: "--pine", default: "#163A30", on: "linen", min: 4.5,
          derived: [["--pine-2", 72, "white"], ["--pine-line", 16, "transparent"]] },
        { id: "ruby", role: "accent", label: "Buttons", use: "Buttons only", var: "--ruby", default: "#F0283C", on: "linen", min: 3, derived: [["--ruby-dk", 88, "black"]] },
      ],
      fonts: [
        { id: "display", role: "display", label: "Headlines", use: "Site name and titles", var: "--display", default: "Gloock", fallback: "Georgia, serif", options: ["Gloock", ...HEADLINE_FONTS] },
        { id: "text", role: "body", label: "Reading text", use: "Articles and introductions", var: "--serif", default: "Source Serif 4", fallback: "Georgia, serif", options: READING_FONTS },
        { id: "sans", role: "small", label: "Small text", use: "Buttons, labels and menus", var: "--sans", default: "Libre Franklin", fallback: "Arial, sans-serif", options: SMALL_FONTS },
      ],
      looks: [
        { name: "Brick and soot", colours: { linen: "#EDE6DE", pine: "#2A2624", ruby: "#C2412D" } },
        { name: "Concrete and cobalt", colours: { linen: "#E9E8E4", pine: "#1F2B44", ruby: "#E3462F" } },
        { name: "Paper and moss", colours: { linen: "#EEEBE2", pine: "#2D3B23", ruby: "#D2422B" } },
      ],
    },
    collections: [],
  },

];
// The Practice site: a copy of World Art Review for trying things out, at an unlisted address that
// search engines are told to ignore. The website agents never work on it. The admin can start it
// again from World Art Review at any time.
SITES.push({ ...SITES[0], id: "practice-site", name: "Practice site", domain: "artiscope.github.io/practice-site", repo: "Artiscope/practice-site", practice: true, from: "world-art-review" });
const BUILT_IN = SITES.length;
// The rest of the sites come from the list file sites.json in the console's own repository, so a new site
// can be added from the console without a change to this code. Each is built from the starter, or not built yet.
export const CONSOLE_REPO = "Artiscope/artiscope-digital-home";
const SHOP_STORE = /^[a-z0-9][a-z0-9-]{1,60}$/;
const SITE_ID = /^[a-z][a-z0-9-]{1,40}$/, REPO_NAME = /^Artiscope\/[A-Za-z0-9._-]{1,100}$/, DOMAIN_OK = /^[a-z0-9.-]{3,190}(\/[a-z0-9._-]{1,100})?$/;
export const DEFAULT_SITE_LIST = [
  { id: "practice-build", name: "Practice build", domain: "artiscope.github.io/practice-build", repo: "Artiscope/practice-build", kind: "starter", playground: true, live: true },
  { id: "site-4", name: "Site 4", domain: "", repo: "", live: false },
  { id: "site-5", name: "Site 5", domain: "", repo: "", live: false },
];
export function cleanSiteList(given) {
  const list = Array.isArray(given && given.sites) ? given.sites : Array.isArray(given) ? given : [], out = [], seen = new Set(SITES.slice(0, BUILT_IN).map((x) => x.id));
  for (const e of list.slice(0, 40)) {
    if (!e || typeof e !== "object" || !SITE_ID.test(String(e.id || "")) || seen.has(e.id)) continue;
    seen.add(e.id);
    const repo = REPO_NAME.test(String(e.repo || "")) ? String(e.repo) : "", domain = DOMAIN_OK.test(String(e.domain || "")) ? String(e.domain) : "";
    const name = cleanText(e.name, 60) || e.id, built = repo && e.kind === "starter";
    let want = ""; try { want = cleanDomain(e.want); } catch (_e) { want = ""; }
    const registrar = ["123-reg", "godaddy", "other"].includes(e.registrar) ? e.registrar : "", todo = Array.isArray(e.todo) ? e.todo.filter((t) => t === "pages" || t === "steps") : [];
    // A shop on Shopify: its products and prices are changed from the console, and Shopify keeps taking the payments.
    // `store` is the part of its Shopify address before .myshopify.com.
    if (e.kind === "shop") { if (SHOP_STORE.test(String(e.store || ""))) out.push({ id: e.id, name, domain, repo: "", kind: "shop", store: String(e.store), playground: false, live: false }); continue; }
    // A site made outside the console (its own hand-written pages): a card with its picture and links, never opened in the editor.
    if (e.kind === "outside" && repo && domain) { out.push({ id: e.id, name, domain, repo, kind: "outside", playground: false, live: false }); continue; }
    const template = templateOf(e.template).id;
    out.push({ id: e.id, name, domain, repo, kind: built ? "starter" : "", playground: !!e.playground && built, live: !!e.live && !!built && !!domain, ...(built ? { want, registrar, todo, ...(template !== "starter" ? { template } : {}) } : {}) });
  }
  return out;
}
export function useSiteList(list) {
  SITES.splice(BUILT_IN, SITES.length - BUILT_IN);
  for (const e of cleanSiteList(list)) SITES.push(e.kind === "starter" ? starterSite(e) : e.kind === "shop" ? { id: e.id, name: e.name, domain: e.domain, repo: "", live: false, shop: { store: e.store }, artists: [], collections: [] } : { id: e.id, name: e.name, domain: e.domain, repo: e.repo, live: false, outside: e.kind === "outside", artists: [], collections: [], playground: e.playground });
}
useSiteList(DEFAULT_SITE_LIST);
let siteListAt = 0, siteListSha = "";
async function loadSiteList() {
  if (Date.now() - siteListAt < 30000) return;
  siteListAt = Date.now();
  try {
    const r = await gh("/repos/" + CONSOLE_REPO + "/contents/sites.json?ref=main");
    if (!r.ok || !r.data || !r.data.content) return;
    if (r.data.sha === siteListSha) return;
    useSiteList(JSON.parse(decodeBase64Utf8(r.data.content)));
    siteListSha = r.data.sha;
  } catch (_e) { /* keep the list already known */ }
}

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
    .replace(/ *\u2014 */g, ", ").replace(/, ,/g, ",").replace(/ \u2013 /g, ", ").replace(/\u2013/g, "-")
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
    // true opens a field that is usually locked, where it is plain words on this site
    if ((LOCKED.includes(name) && rules[name] !== true) || rules[name] === false) continue;
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
    list.push({ id: "only", ref: node, parent: null, title: (col.title && node[col.title]) || col.label });
  } else if (col.shape === "map" && node && typeof node === "object") {
    for (const k of Object.keys(node)) list.push({ id: k, ref: node[k], parent: null, title: (col.title && node[k][col.title]) || k });
  } else if (col.shape === "textmap" && node && typeof node === "object") {
    for (const k of Object.keys(node)) if (typeof node[k] === "string") list.push({ id: k, ref: node, parent: null, title: k, only: k });
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

export function entryView(x, col) {
  const sub = (col.sub || []).map((k) => x.ref[k]).filter((v) => typeof v === "string" && v).join(", ");
  return {
    id: x.id, title: String(x.title), sub: [x.group, sub].filter(Boolean).join(". "),
    hidden: x.ref.hidden === true, fields: labelled(fieldsOf(x.ref, col.numbers || [], col.columns || col.inside || {}).filter((f) => !x.only || f.name === x.only), col)
      .map((f) => (col.year && f.name === col.year ? { ...f, type: "text", value: f.value == null ? "TBC" : String(f.value) } : f)),
  };
}

// A site can give its own short field names clearer labels ("*" for every field).
function labelled(fields, col) {
  const L = col.labels || {};
  return fields.map((f) => (L[f.name] || L["*"] ? { ...f, label: L[f.name] || L["*"] } : f));
}

// Saves one entry of a collection, as the console sent it. Returns how many values changed.
export function applyEntry(x, col, given) {
  given = given && typeof given === "object" ? given : {};
  const vals = x.only ? (x.only in given ? { [x.only]: given[x.only] } : {}) : { ...given };
  let extra = 0;
  // a year is a whole number, or "TBC" while it is being confirmed
  if (col.year && col.year in vals && col.year in x.ref) {
    const raw = String(vals[col.year] == null ? "" : vals[col.year]).trim();
    const v = /^\d{3,4}$/.test(raw) ? Number(raw) : "TBC";
    if (x.ref[col.year] !== v) { x.ref[col.year] = v; extra++; }
    delete vals[col.year];
  }
  return extra + applyValues(x.ref, vals, col.numbers || [], col.columns || col.inside || {});
}

// Words can carry simple marks (paragraphs, bold, links), but never anything that runs on the page.
export function safeMarks(v) {
  return String(v)
    .replace(/<(script|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?(script|iframe|object|embed|link|meta|base)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["']?)\s*(javascript|data|vbscript):[^"'\s>]*\2/gi, '$1="#"');
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
      v = (Array.isArray(v) ? v : String(v).split(/\n+/)).map((x) => safeMarks(String(x).trim())).filter(Boolean).slice(0, 60);
    } else {
      v = safeMarks(String(v == null ? "" : v).replace(/ *— */g, ", ").replace(/, ,/g, ",").slice(0, 60000));
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


const CONTENT_FILES = ["content/site.json", "content/files.json", "data/content.json", "data/sales.json", "data/images.json", "image-slots.json", "content/theme.json", "data/theme.json", "content/pages.json", "data/pages.json"];
const UNDOABLE = /^(Edit|Hide |Show |Delete |Remove photo|Mark spot |Add |Photo description|Place photos|Replace photo|Theme: |Publish: |Make live: |Undo: |Redo: |Add section|Remove section|Move section)/;

// ---------- copies of a site: the live one being worked on, and trial copies ----------
//
// Saving on the live site goes straight to visitors: it commits to main.
// A trial copy ("adh/trial-...") keeps its changes on its own branch
// until "Make live" merges it into main. Undo on the live site adds a
// new commit that puts the earlier words back.

const MAX_TRIALS = 2;
// Edit code saves to this copy only. It can be made live once it builds without errors.
export const CODE_COPY = "trial-code-changes";
const COPY_ID = /^(live|trial)-[a-z0-9-]{1,60}$/;

function randomTail() {
  const b = new Uint8Array(3);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
export function copySlug(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30).replace(/-+$/g, "");
}
// Publish later: a copy whose id carries the time it goes live, in UTC: trial-later-202612010900-a1b2c3.
const LATER_ID = /^trial-later-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})-[0-9a-f]{6}$/;
export function laterOf(id) { const m = LATER_ID.exec(String(id)); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])) : null; }
export function londonWhen(d) {
  try { return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d).replace(" at ", ", "); }
  catch (_e) { return d.toISOString().slice(0, 16).replace("T", " ") + " UTC"; }
}
// "2026-12-01T09:00", meant as London time, as the moment it is.
export function fromLondon(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(s || "")); if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const parts = (t) => { const o = {}; for (const x of new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(t))) o[x.type] = x.value; return Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute); };
  let t = guess - (parts(guess) - guess); t = guess - (parts(t) - t);
  return new Date(t);
}
export function laterId(d) { const p = (n) => String(n).padStart(2, "0"); return "trial-later-" + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + p(d.getUTCHours()) + p(d.getUTCMinutes()) + "-" + randomTail(); }
export function copyName(id) {
  if (ownerOfCopy(id)) return "An editor's copy";
  const later = laterOf(id); if (later) return "Publish later: " + londonWhen(later);
  if (/^trial-held-/.test(String(id))) return "Could not publish later";
  if (id === CODE_COPY) return "Code changes";
  const words = String(id).replace(/^trial-/, "").replace(/-[0-9a-f]{6}$/, "").replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
// Who made a change is kept at the end of its message: "(by admin)" or "(by <editor tag>)".
// Changes from before people existed end with an email address instead; both are read.
// Email addresses are never written any more, because the site repositories are public.
const WHO_TAIL = / \((?:[^()@ ]+@[^()]+|by [a-z0-9-]{1,40})\)$/;
export function whatOf(first) { return String(first || "").replace(WHO_TAIL, ""); }
export function byOf(first) {
  const m = String(first || "").match(/\(([^()@ ]+@[^()]+)\)$/) || String(first || "").match(/\(by ([a-z0-9-]{1,40})\)$/);
  return m ? m[1] : "";
}
function stepOf(c) {
  const first = String((c.commit && c.commit.message) || "").split("\n")[0];
  return {
    sha: c.sha,
    what: whatOf(first),
    when: c.commit && c.commit.author ? c.commit.author.date : "",
    by: byOf(first),
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
      later: laterOf(r.id) ? laterOf(r.id).toISOString() : "",
      preview: "https://" + site.domain + "/preview/" + r.id + "/",
    };
  }));
  // an older working copy of the live site (from before saving went straight to live) is published and removed
  for (const old of out.filter((c) => c.kind === "live")) {
    if (old.ahead > 0) await gh("/repos/" + site.repo + "/merges", { method: "POST", body: JSON.stringify({ base: "main", head: old.branch, commit_message: "Publish: earlier saved changes" }) });
    await gh("/repos/" + site.repo + "/git/refs/heads/" + old.branch, { method: "DELETE" });
    if (redoable.includes(old.id)) await gh("/repos/" + site.repo + "/git/refs/heads/adh-redo/" + old.id, { method: "DELETE" });
  }
  const recent = await gh("/repos/" + site.repo + "/commits?sha=main&per_page=20");
  const list = recent.ok && Array.isArray(recent.data) ? recent.data : [];
  // the steps still standing: an Undo or Redo commit says which earlier state it put back,
  // so the list continues from there
  const steps = [];
  for (let i = 0; i < list.length;) {
    const st = stepOf(list[i]);
    if (!UNDOABLE.test(st.what)) break;
    const back = String(list[i].commit.message || "").match(/\nRestored-To: ([0-9a-f]{40})/);
    if (back) { const j = list.findIndex((c) => c.sha === back[1]); if (j < 0) break; i = j; continue; }
    steps.push(st); i++;
  }
  const live = { id: "live", kind: "live", name: "Live site", branch: "main", sha: list[0] ? list[0].sha : "", ahead: 0, behind: 0, since: "", steps, canRedo: redoable.includes("live"), preview: "" };
  return [live].concat(out.filter((c) => c.kind === "trial").sort((a, b) => a.id.localeCompare(b.id)));
}
function pickCopy(copies, id) {
  if (!id || id === "live" || String(id).startsWith("live-")) return copies[0];
  return copies.find((c) => c.id === id) || null;
}
function readRefOf(copy) { return copy.kind === "trial" ? copy.branch : "main"; }
function publicCopy(c, me, names) {
  const own = ownerOfCopy(c.id), name = own ? (me && own === me.tag ? "Your copy" : (names && names[own]) || "An editor's copy") : c.name;
  const by = (x) => nameOf(x, me, names);
  return { id: c.id, kind: c.kind, name, own: !!own, mine: !!(own && me && own === me.tag), ahead: c.ahead, behind: c.behind, since: c.since, steps: c.steps.map((x) => ({ what: x.what, when: x.when, by: by(x.by) })), canRedo: c.canRedo, preview: c.kind === "trial" ? c.preview : "" };
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
  if (copy.kind === "live" && !copy.canRedo) { /* nothing kept */ }
  copy.canRedo = false;
}
// The branch a save goes to. The live site is main; a trial copy is its own branch.
async function branchForWriting(site, copy, _who) {
  await dropRedo(site, copy);
  return copy.branch || "main";
}

async function siteOverview(site, wanted = "", me = null, names = {}) {
  const base = { id: site.id, name: site.name, domain: site.domain, live: site.live, artists: site.artists, files: !!(site.pages && site.pages.meta), edits: !!site.items, practice: !!site.practice,
    pagesOn: !!site.pages, themeOn: !!site.theme, photosOn: !site.noPhotos, starter: !!site.starter, template: site.starter ? site.template || "starter" : undefined, playground: !!site.playground, youAdmin: !!(me && me.admin),
    want: site.want || "", registrar: site.registrar || "", todo: site.todo || [], records: dnsRecords(site.want || ""), buildable: !site.live && !site.repo && !site.playground && !site.shop, outside: !!site.outside, repo: site.outside ? site.repo : undefined,
    shop: site.shop ? { store: site.shop.store, ready: !!shopKey(site) } : undefined };
  if (!site.live) return base;
  try {
    const copies = (await copiesOf(site)).filter((c) => !me || me.admin || c.kind === "live" || ownerOfCopy(c.id) === me.tag);
    const copy = pickCopy(copies, wanted) || copies[0];
    const ref = readRefOf(copy);
    const [cal, log, drafts, inbox, slotFile, versions] = await Promise.all([
      getText(site.repo, "CONTENT-CALENDAR.md"),
      getText(site.repo, "AGENT-LOG.md"),
      draftsOf(site.repo),
      inboxOf(site.repo, ref),
      getText(site.repo, "image-slots.json", ref),
      versionsOf(site).catch(() => []),
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
      copies: copies.map((c) => publicCopy(c, me, names)),
      copy: copy.id,
      // the latest versions, so the admin hears about new releases at the top of All sites
      versions: versions.slice(0, 3).map((v, i) => ({ number: v.number, when: v.when, live: i === 0, by: nameOf(v.by, me, names), notes: v.notes.replace(/\n*<!-- by: [^>]* -->\s*$/, "") })),
      // the weekday agent's topics, log and drafts are the admin's to answer
      ...(me && !me.admin ? { topics: { waiting: [], approved: [] }, log: [], drafts: [] } : {}),
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

// ---------- versions: every publish is a numbered version, kept as a GitHub release ----------
// 1.0 marks the site as it was when versions began. Each publish adds one to the second number;
// a big change, which only the admin can mark, starts a new first number. GitHub emails the
// release to anyone watching the repository's releases. The repositories are public, so the
// notes carry a first name only, never an address.
export function versionOf(tag) { const m = /^v(\d{1,4})\.(\d{1,5})$/.exec(String(tag || "")); return m ? [Number(m[1]), Number(m[2])] : null; }
const vNewer = (a, b) => a[0] - b[0] || a[1] - b[1];
export function nextVersion(list, big) {
  if (!list.length) return [1, 0];
  const top = list.slice().sort(vNewer).pop();
  return big ? [top[0] + 1, 0] : [top[0], top[1] + 1];
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function ukDate(d) { return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
function firstName(me) { return me.admin ? "the admin" : (String(me.name || "").trim().split(/\s+/)[0] || "an editor"); }
export function releaseNotes(o) {
  const lines = ["Published by " + o.who + " on " + ukDate(o.at || new Date()) + "."];
  const line = (x) => "- " + String(x).replace(/^Edit page: /, "");
  const who = o.who.charAt(0).toUpperCase() + o.who.slice(1);
  if (o.steps && o.steps.length) lines.push("", "What changed:", ...o.steps.map(line));
  if (o.earlier && o.earlier.length) lines.push("", "Also on the live site since the last version:", ...o.earlier.map(line));
  if (o.note) lines.push("", who + "'s note: " + o.note);
  lines.push("", "<!-- by: " + o.tag + " -->");
  return lines.join("\n").replace(/ *\u2014 */g, ", ");
}
// The site's versions, newest first.
export async function versionsOf(site) {
  const r = await gh("/repos/" + site.repo + "/releases?per_page=100");
  return (r.ok && Array.isArray(r.data) ? r.data : []).map((x) => ({ n: versionOf(x.tag_name), x })).filter((y) => y.n)
    .sort((a, b) => vNewer(b.n, a.n))
    .map((y) => ({ number: y.n.join("."), n: y.n, name: String(y.x.name || ""), notes: String(y.x.body || ""), when: y.x.published_at || y.x.created_at || "", sha: String(y.x.target_commitish || ""),
      by: (String(y.x.body || "").match(/<!-- by: ([a-z0-9-]{1,40}) -->/) || [])[1] || "" }));
}
async function addRelease(site, n, sha, title, body) {
  const r = await gh("/repos/" + site.repo + "/releases", { method: "POST", body: JSON.stringify({ tag_name: "v" + n.join("."), target_commitish: sha, name: site.name + " " + n.join(".") + (title ? ": " + title : ""), body }) });
  return r.ok;
}
// Records a publish as the next version. "before" is the live site just before it, so the
// first time, 1.0 can mark where versions began. A version that cannot be recorded never
// undoes the publish: it is said plainly instead.
async function makeVersion(site, me, o) {
  try {
    let list = await versionsOf(site);
    const at = new Date();
    if (!list.length && o.before) {
      if (!(await addRelease(site, [1, 0], o.before, "where versions began", releaseNotes({ who: "the admin", tag: "admin", at, steps: ["The site as it was when versions began."] })))) return { version: "", versionProblem: true };
      list = [{ n: [1, 0], sha: o.before }];
    }
    let earlier = [];
    if (list.length && list[0].sha && o.before && list[0].sha !== o.before) {
      const cmp = await gh("/repos/" + site.repo + "/compare/" + list[0].sha + "..." + o.before);
      earlier = cmp.ok && cmp.data && Array.isArray(cmp.data.commits) ? cmp.data.commits.map((c) => whatOf(String(c.commit.message || "").split("\n")[0])).filter((w) => !/^(Merge|Bring in the latest)/.test(w)).slice(-20).reverse() : [];
    }
    const n = nextVersion(list.map((v) => v.n), !!o.big && me.admin);
    const body = releaseNotes({ who: firstName(me), tag: me.tag, at, steps: o.steps || [], earlier, note: o.note ? cleanText(o.note, 300) : "" });
    if (!(await addRelease(site, n, o.sha, o.title || "", body))) return { version: "", versionProblem: true };
    return { version: n.join(".") };
  } catch (_e) { return { version: "", versionProblem: true }; }
}

// ---------- people: one admin, and editors ----------
// Run once in the Supabase SQL editor. Row level security is on with no rules, so only this
// function (with the service key Supabase gives it) can read or change the table.
export const PEOPLE_SQL = `create table if not exists public.people (
  email text primary key check (email = lower(email)),
  id text not null unique,
  name text not null default '',
  sites text[] not null default '{}',
  invited_at timestamptz not null default now(),
  last_seen timestamptz
);
alter table public.people enable row level security;
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.people to service_role;`;
// Supabase gives the function two kinds of key. The newer kind ("sb_secret_...") goes in the apikey
// header only; the older kind is a token that also goes in Authorization. If one is refused, the other
// is tried, so the people list works on old and new projects alike.
function dbKeys() {
  const out = [];
  try { const keys = JSON.parse(env("SUPABASE_SECRET_KEYS") || "{}"); const k = keys.default || Object.values(keys)[0]; if (k) out.push(String(k)); } catch (_e) { /* none */ }
  if (env("SUPABASE_SERVICE_ROLE_KEY")) out.push(env("SUPABASE_SERVICE_ROLE_KEY"));
  return [...new Set(out)];
}
async function db(path, init = {}) {
  const keys = dbKeys();
  if (!keys.length) return { ok: false, status: 0, data: null };
  let last = { ok: false, status: 0, data: null };
  for (const key of keys) {
    const auth = /^eyJ/.test(key) ? { Authorization: "Bearer " + key } : {};
    const res = await fetch(env("SUPABASE_URL") + "/rest/v1/" + path, {
      ...init,
      headers: { apikey: key, ...auth, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) },
    });
    let data = null;
    try { data = await res.json(); } catch (_e) { data = null; }
    last = { ok: res.ok, status: res.status, data };
    if (res.status !== 401 && res.status !== 403) return last;
  }
  return last;
}
// Whether a published page is still missing (GitHub answers 404). Anything else, or no answer, counts as there.
async function pageMissing(url) {
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(url, { method: "HEAD", signal: ctl.signal, redirect: "follow" });
    clearTimeout(t);
    return r.status === 404;
  } catch (_e) { return false; }
}
// Supabase refusing the table itself (code 42501) means the server was never given the right to use it.
function dbRefused(r) { return !!(r && r.data && typeof r.data === "object" && String(r.data.code || "") === "42501"); }
export const GRANT_HELP = "Supabase does not let the console's server use the people table yet. In Supabase, open SQL Editor, New query, and run these two lines: " +
  "grant usage on schema public to service_role; grant select, insert, update, delete on table public.people to service_role; Then press Refresh here.";
// Supabase's own words about a refusal. They never include a key.
function dbSaid(r) {
  const d = r && r.data && typeof r.data === "object" ? r.data : {};
  const words = String(d.message || d.msg || d.error || d.hint || "").replace(/[<>]/g, "").slice(0, 200);
  return (words ? " Supabase said: " + words + "." : "") + " (code " + (r ? r.status : 0) + (d.code ? ", " + String(d.code).slice(0, 20) : "") + ")";
}
const EDITOR_TAG = /^[a-f0-9]{10}$/;
function newTag() { const b = new Uint8Array(5); crypto.getRandomValues(b); return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join(""); }
// Who is asking: the admin (from ALLOWED_EMAILS), an editor from the people table, or nobody.
export async function personOf(email) {
  if (isAllowed(email)) return { email, admin: true, name: "Admin", tag: "admin", sites: SITES.map((s) => s.id) };
  const r = await db("people?select=id,name,sites&email=eq." + encodeURIComponent(email));
  const p = r.ok && Array.isArray(r.data) ? r.data[0] : null;
  if (!p || !EDITOR_TAG.test(String(p.id))) return null;
  return { email, admin: false, name: String(p.name || ""), tag: String(p.id), sites: (Array.isArray(p.sites) ? p.sites : []).map(String).filter((id) => SITES.some((s) => s.id === id)) };
}
// On the practice build, a test user given it can do everything the admin can, there only.
// Their changes still carry their own code, so History says who did what.
export function asOn(me, site) { return site && site.playground && me && !me.admin ? { ...me, admin: true, tester: true } : me; }
// Each editor's names, by tag, to show who made a change. The admin also sees addresses.
async function namesFor(me) {
  const r = await db("people?select=id,name,email");
  const out = {};
  for (const p of r.ok && Array.isArray(r.data) ? r.data : []) out[p.id] = String(p.name || "") || (me.admin ? String(p.email) : "An editor");
  return out;
}
function nameOf(by, me, names) {
  if (!by) return "";
  if (by === "admin" || (by.includes("@") && isAllowed(by))) return me && me.admin ? "You" : "The admin";
  if (me && by === me.tag) return "You";
  if (by.includes("@")) return me && me.admin ? by : "Someone";
  return (names && names[by]) || "An editor";
}
// An editor's own copy of a site: one each, named by their tag, never by their address.
export function ownCopyId(tag) { return "trial-own-" + tag; }
export function ownerOfCopy(id) { const m = String(id).match(/^trial-own-([a-f0-9]{10})$/); return m ? m[1] : ""; }
const EMAIL_OK = /^[^\s@<>"(),;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/;
export function cleanPerson(given) {
  const g = given && typeof given === "object" ? given : {};
  return {
    name: cleanText(g.name, 60),
    sites: [...new Set((Array.isArray(g.sites) ? g.sites : []).map(String))].filter((id) => SITES.some((s) => s.id === id)),
  };
}
// Sends the normal sign-in email, the same one the admin gets.
async function sendSignIn(email, back) {
  const to = /^https:\/\/[a-z0-9.-]+(:\d+)?\/[^\s"<>]*$/i.test(String(back || "")) ? "?redirect_to=" + encodeURIComponent(back) : "";
  const res = await fetch(env("SUPABASE_URL") + "/auth/v1/otp" + to, { method: "POST", headers: { apikey: publishableKey(), "Content-Type": "application/json" }, body: JSON.stringify({ email, create_user: true }) });
  return res.ok;
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

// Whether the Code changes copy builds: the site's "Check a working copy" job runs on every save to it.
async function codeCheck(site, sha) {
  const r = await gh("/repos/" + site.repo + "/actions/workflows/check-copy.yml/runs?branch=" + encodeURIComponent("adh/" + CODE_COPY) + "&per_page=10");
  if (!r.ok) return { status: "unknown", why: r.status === 403 ? "The GitHub key cannot read the build checks. On GitHub, give the key Actions: Read access to this repository." : "The build check could not be read (GitHub code " + r.status + ")." };
  const run = (Array.isArray(r.data && r.data.workflow_runs) ? r.data.workflow_runs : []).find((x) => x.head_sha === sha);
  if (!run || run.status !== "completed") return { status: "checking", url: run ? run.html_url : "" };
  return { status: run.conclusion === "success" ? "passed" : "failed", url: run.html_url || "" };
}
function sameText(a, b) {
  a = String(a); b = String(b); let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
// Publishes every copy whose time has come. One that clashes with the live site is kept as an ordinary
// trial copy called "Could not publish later", so someone can look at it.
export async function runLater(now) {
  const done = [];
  for (const site of SITES) {
    if (!site.repo || !site.live) continue;
    const found = await gh("/repos/" + site.repo + "/git/matching-refs/heads/adh/trial-later-");
    for (const r of Array.isArray(found.data) ? found.data : []) {
      const id = String(r.ref).replace("refs/heads/adh/", ""), at = laterOf(id);
      if (!at || at.getTime() > now.getTime()) continue;
      const repo = "/repos/" + site.repo, before = await mainSha(site);
      const cmp = await gh(repo + "/compare/main..." + "adh/" + id);
      const commits = cmp.ok && Array.isArray(cmp.data.commits) ? cmp.data.commits : [];
      if (!commits.length) { await gh(repo + "/git/refs/heads/adh/" + id, { method: "DELETE" }); done.push({ site: site.id, id, result: "nothing to publish" }); continue; }
      const m = await gh(repo + "/merges", { method: "POST", body: JSON.stringify({ base: "main", head: "adh/" + id, commit_message: "Publish later: " + londonWhen(at) + " (by admin)" }) });
      if (!(m.ok && m.data && m.data.sha)) {
        const held = await gh(repo + "/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/adh/trial-held-" + randomTail(), sha: r.object.sha }) });
        if (held.ok) await gh(repo + "/git/refs/heads/adh/" + id, { method: "DELETE" });
        done.push({ site: site.id, id, result: "held" }); continue;
      }
      await gh(repo + "/git/refs/heads/adh/" + id, { method: "DELETE" });
      const steps = commits.map((c) => stepOf(c).what).filter((w) => !/^(Merge|Bring in the latest)/.test(w)).slice(-20);
      const v = await makeVersion(site, { admin: true, tag: "admin", name: "Publish later" }, { before, sha: m.data.sha, steps, note: "Published later, as planned for " + londonWhen(at) + ".", title: "" });
      done.push({ site: site.id, id, result: "published", version: v.version || "" });
    }
  }
  return { ok: true, done };
}

// Puts the starter (the console repository's starter/ folder) into a site's main branch as one commit,
// with the site's own web address in its details. Files the starter does not have are removed, except the
// publishing steps under .github, which only GitHub itself may change.
export async function starterInto(site, message, opts = {}) {
  const prefix = (opts.dir || site.dir || STARTER_DIR) + "/", own = opts.files || {}, withSteps = !!opts.github, only = opts.only || "";
  const [src, headSha] = await Promise.all([gh("/repos/" + CONSOLE_REPO + "/git/trees/main?recursive=1"), mainSha(site)]);
  if (!src.ok || !Array.isArray(src.data && src.data.tree)) return { error: "The site's design could not be read from GitHub just now." };
  const head = headSha ? await gh("/repos/" + site.repo + "/git/commits/" + headSha) : null;
  const have = headSha ? await gh("/repos/" + site.repo + "/git/trees/" + headSha + "?recursive=1") : null;
  if (!head || !head.ok || !have || !have.ok) return { error: "The practice build could not be read from GitHub just now." };
  const inStarter = (t) => t.type === "blob" && t.path.startsWith(prefix + only) && (withSteps || !t.path.startsWith(prefix + ".github/"));
  const wanted = src.data.tree.filter(inStarter).map((t) => ({ path: t.path.slice(prefix.length), sha: t.sha, mode: t.mode || "100644" }));
  const names = new Set(wanted.map((t) => t.path)), had = {};
  for (const t of have.data.tree) if (t.type === "blob" && (withSteps || !t.path.startsWith(".github/"))) had[t.path] = t.sha;
  const tree = Object.keys(had).filter((pth) => !names.has(pth) && pth.startsWith(only)).map((pth) => ({ path: pth, mode: "100644", type: "blob", sha: null }));
  for (const t of wanted) {
    let content = null;
    if (own[t.path] != null) {
      content = { content: encodeBase64Utf8(typeof own[t.path] === "string" ? own[t.path] : JSON.stringify(own[t.path], null, 2) + "\n"), encoding: "base64" };
    } else if (t.path === "data/content.json") {
      const b = await gh("/repos/" + CONSOLE_REPO + "/git/blobs/" + t.sha);
      let c = {}; try { c = JSON.parse(decodeBase64Utf8(String((b.data || {}).content || "").replace(/\n/g, ""))); } catch (_e) { c = {}; }
      c.site = { ...(c.site || {}), address: "https://" + site.domain + "/", indexed: false };
      content = { content: encodeBase64Utf8(JSON.stringify(c, null, 2) + "\n"), encoding: "base64" };
    } else if (had[t.path] === t.sha) continue;   // already the same
    if (!content) {
      const b = await gh("/repos/" + CONSOLE_REPO + "/git/blobs/" + t.sha);
      if (!b.ok) return { error: "GitHub did not give the design's " + t.path + "." };
      content = { content: String(b.data.content || "").replace(/\n/g, ""), encoding: "base64" };
    }
    const made = await gh("/repos/" + site.repo + "/git/blobs", { method: "POST", body: JSON.stringify(content) });
    if (!made.ok) return { error: writeProblem(made, "GitHub did not copy " + t.path + ".") };
    if (had[t.path] !== made.data.sha) tree.push({ path: t.path, mode: t.mode === "100755" ? "100755" : "100644", type: "blob", sha: made.data.sha });
  }
  if (!tree.length) return { ok: true, unchanged: true, sha: headSha };
  const madeTree = await gh("/repos/" + site.repo + "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: head.data.tree.sha, tree }) });
  if (!madeTree.ok) return { error: writeProblem(madeTree, "GitHub did not write the site's files.") };
  const commit = await gh("/repos/" + site.repo + "/git/commits", { method: "POST", body: JSON.stringify({ message, tree: madeTree.data.sha, parents: [headSha] }) });
  if (!commit.ok) return { error: writeProblem(commit, "GitHub did not write the site's files.") };
  const moved = await moveBranch(site, "main", commit.data.sha, false);
  // GitHub only lets a key write publishing steps (.github/workflows) when it has the Workflows permission.
  if (!moved.ok && withSteps && /workflow/i.test(JSON.stringify(moved.data || ""))) return { error: STEPS_HELP, steps: true };
  if (!moved.ok) return { error: writeProblem(moved, "GitHub did not write the site's files.") };
  return { ok: true, sha: commit.data.sha };
}

// ---------- building a new site from the console (Start building) ----------
// A new site is the starter with the owner's choices written into its data files.
// Nothing here makes up facts: every word the owner has not given stays in square brackets.
export const BUILD_ORG = "Artiscope";
const STEPS_HELP = "GitHub did not let the console add the site's publishing steps. The GitHub key needs Workflows set to Read and write (GitHub, the key's settings, Repository permissions). Then press Try again.";
const MAKE_HELP = "GitHub did not let the console make a new repository. The GitHub key needs access to All repositories in the Artiscope organisation, with Administration, Contents, Pages and Workflows set to Read and write. Change that in the key's settings on GitHub, then press Create site again.";
const PAGES_HELP = "GitHub did not switch publishing on. The GitHub key needs Pages set to Read and write. Then press Try again.";
const LIST_HELP = "The site was made, but the console could not add it to its list of sites. The GitHub key needs Contents set to Read and write on artiscope-digital-home. Then press Try again.";
// Typefaces and corners for each starting look; every other look uses Castoro and Literata with square corners.
const BUILD_LOOK_TYPE = {
  "Like Global Art Monitor": ["Libre Caslon Display", "Libre Franklin", "round"],
  "Sand and navy": ["Libre Caslon Display", "Libre Franklin", "round"],
  "Like Street Art Dispatch": ["Gloock", "Source Serif 4", ""],
  "Brick and soot": ["Gloock", "Source Serif 4", ""],
  "Concrete and cobalt": ["Libre Caslon Display", "Libre Franklin", ""],
};
// A template's own look comes first, then the others (but not "Like" the template's own site, which is the same).
export function buildLooks(template = "starter") {
  const all = STARTER_LOOKS.map((l) => {
    const t = BUILD_LOOK_TYPE[l.name] || ["Castoro", "Literata", ""];
    return { name: l.name, colours: { ...l.colours }, fonts: { display: t[0], text: t[1], sans: "Libre Franklin" }, corners: t[2], mine: /^Like /.test(l.name) };
  });
  const t = templateOf(template);
  if (t.id === "starter") return all;
  const spec = starterSite({ template: t.id }).theme, col = (role) => ((spec.colours.find((c) => c.role === role) || {}).default || ""), font = (role) => ((spec.fonts.find((f) => f.role === role) || {}).default || "");
  const own = { name: t.ownLook || t.name + "'s own", colours: { page: col("bg"), band: col("band"), accent: col("accent"), ink: col("text") || col("band") }, fonts: { display: font("display"), text: font("body"), sans: font("small") || "Libre Franklin" }, corners: "", mine: false, own: true };
  return [own].concat((t.looks || []).map((l) => ({ ...l, colours: { ...l.colours }, fonts: { ...l.fonts } })), all.filter((l) => l.name !== "Like " + t.name));
}
// A look put into a theme's own colours and typefaces, by what each is for.
function lookInto(spec, look) {
  const colours = {}, fonts = {}, C = { bg: "page", band: "band", accent: "accent", text: "ink" }, T = { display: "display", body: "text", small: "sans" };
  for (const c of spec.colours) if (C[c.role] && look.colours[C[c.role]]) colours[c.id] = look.colours[C[c.role]];
  // a typeface goes where the theme's list allows it: a theme with one text face takes the reading face, or else the small one
  for (const f of spec.fonts) {
    const tries = f.role === "body" && !spec.fonts.some((g) => g.role === "small") ? [look.fonts.text, look.fonts.sans] : [look.fonts[T[f.role]]];
    const pick = tries.find((x) => x && (!Array.isArray(f.options) || f.options.includes(x)));
    if (pick) fonts[f.id] = pick;
  }
  return { colours, fonts, settings: { corners: look.corners === "round" ? "round" : "" } };
}
export const BUILD_REGISTRARS = [["123-reg", "123-reg"], ["godaddy", "GoDaddy"], ["other", "Somewhere else"]];
export const BUILD_SET = [["home", "Home"], ["about", "About"], ["artists", "Artists"], ["exhibitions", "Exhibitions"], ["visit", "Visit us"], ["contact", "Contact"]];
export const BUILD_FROM = ["world-art-review", "global-art-monitor", "street-art-dispatch"];
// The other sites' own sections, and the shared section that takes each one's place when a layout is copied.
export const BUILD_NEAR = {
  hero: "picture-banner", features: "columns", featured: "columns", profiles: "columns", "section-list": "columns", "page-links": "columns", collecting: "columns",
  prose: "text-picture", "long-text": "text-picture", "text-page": "text-picture", words: "text-picture", explained: "text-picture", method: "text-picture", panel: "text-picture",
  "exhibition-list": "exhibitions", "page-head": "heading", "page-heading": "heading",
};
export const GITHUB_IPS = ["185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"];
// Endings shared by many domains, so shop.example.co.uk is seen as a subdomain of example.co.uk.
const TWO_PART = /\.(co|org|ac|gov|me|ltd|plc|net|sch|nhs|com|edu)\.(uk|au|nz|za|jp|in|br|cn|kr|il|sg|hk|my|tr|mx|ar)$/;
const keepParts = (d) => TWO_PART.test("." + d) ? 3 : 2;
export function isSubdomain(d) { return String(d || "").split(".").length > keepParts(d); }
// The records to add where the domain is registered: four A records and www for a whole domain,
// or one CNAME record for a subdomain such as shop.example.com.
export function dnsRecords(d) {
  if (!d) return [];
  const host = BUILD_ORG.toLowerCase() + ".github.io";
  if (isSubdomain(d)) return [["CNAME", d.split(".").slice(0, -keepParts(d)).join("."), host]];
  return GITHUB_IPS.map((ip) => ["A", "@", ip]).concat([["CNAME", "www", host]]);
}
export function buildSlug(name) { return String(name || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, ""); }
export function cleanDomain(v) {
  let d = String(v || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/^www\./, "").replace(/\.$/, "");
  if (!d) return "";
  // a web address with accents (café.com) is kept in the form DNS uses (xn--caf-dma.com)
  if (/[^\x00-\x7f]/.test(d)) { try { d = new URL("https://" + d + "/").hostname; } catch (_e) { /* refused below */ } }
  if (!/^(?=.{4,190}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d)) throw new Error("The web address should look like newsite.com, without https:// or anything after it.");
  if (/(^|\.)github\.io$|(^|\.)artiscope\.github\.io$/.test(d)) throw new Error("Give the domain you own. The GitHub address is made for you.");
  return d;
}
// The owner's choices, checked. card is the site being built (Site 4, or the practice build).
export function cleanBuild(given, card) {
  const g = given && typeof given === "object" ? given : {};
  const noTags = (v) => String(v || "").replace(/<[^>]*>?/g, " ").replace(/\s+/g, " ");
  const name = cleanText(noTags(g.name == null ? (card && card.name) || "" : g.name), 60).trim();
  const tagline = cleanText(noTags(g.tagline || ""), 120).trim();
  const email = String(g.email == null ? "info@grovegallery.com" : g.email).trim();
  if (email && !EMAIL_SHAPE.test(email)) throw new Error("The email shown on the site does not look like an email address.");
  const template = templateOf(g.template).id, looks = buildLooks(template), look = looks.some((l) => l.name === g.look) ? g.look : looks[0].name;
  // a template brings its own pages; the starter offers a home page, the ready set or another site's layout
  const pages = template !== "starter" ? "template" : ["home", "set", "copy"].includes(g.pages) ? g.pages : "home";
  const from = BUILD_FROM.includes(g.from) ? g.from : BUILD_FROM[0];
  const registrar = BUILD_REGISTRARS.some((r) => r[0] === g.registrar) ? g.registrar : "other";
  return { name, tagline, domain: cleanDomain(g.domain), registrar, email: email || "info@grovegallery.com", template, look, pages, from };
}
const BUILD_SEC = (id, kind, over) => ({ id, type: kind, visible: true, settings: { ...JSON.parse(JSON.stringify(STARTER_SECTIONS[kind].starter || {})), ...(over || {}) } });
const BUILD_WORDS = "[One or two sentences about this page, for search results]";
function buildPage(key, title, sections) {
  return { path: key === "home" ? "index.html" : key + "/index.html", title, description: BUILD_WORDS, ...(key === "home" ? { home: true } : {}), sections };
}
function buildHome() {
  return [
    BUILD_SEC("banner", "picture-banner", { alt: "[What the opening picture shows]", eyebrow: "[A small line above the heading]", heading: "[Your opening heading]", text: "[A sentence or two that says what the site is for]", colour: undefined }),
    BUILD_SEC("cards", "columns", { heading: "[A heading for three cards]", numbered: false, columns: [1, 2, 3].map(() => ({ title: "[Card heading]", text: "[A short line of placeholder words]", link: "", href: "" })) }),
    BUILD_SEC("signup", "signup", { text: "[A line on what people will receive]" }),
  ];
}
function buildSet() {
  return {
    home: buildHome(),
    about: [BUILD_SEC("about", "text-picture", { heading: "[About us]", body: "[Who you are and what the site is for]" }), BUILD_SEC("quote", "quote")],
    exhibitions: [BUILD_SEC("exhibitions", "exhibitions")],
    visit: [BUILD_SEC("visit", "visit")],
    contact: [BUILD_SEC("contact", "contact-form")],
  };
}
const human = (k) => { const t = String(k).replace(/[-_]+/g, " ").trim(); return t ? t[0].toUpperCase() + t.slice(1) : "Page"; };
// Copies another site's pages and the order of their sections, with placeholder words.
// Sections only that site has are swapped for the nearest shared section, or left out and listed.
export function copyLayout(doc, from) {
  const src = (doc && doc.pages) || {}, kinds = (from && from.sectionKinds) || {}, out = {}, swapped = [], left = [], labels = [];
  const keys = Object.keys(src).filter((k) => src[k] && Array.isArray(src[k].sections));
  const order = (keys.includes("home") ? ["home"] : []).concat(keys.filter((k) => k !== "home")).slice(0, 12);
  for (const key of order) {
    const k2 = key === "home" ? "home" : buildSlug(key);
    if (!k2 || out[k2] || labels.some((x) => x[0] === k2)) continue;
    // a page of articles or artists becomes the list the site draws itself from the new site's own
    if (k2 === "articles" || k2 === "artists") {
      labels.push([k2, k2 === "articles" ? "Articles" : "Artists"]);
      swapped.push({ page: human(key), from: "the whole page", to: "the " + (k2 === "articles" ? "Articles" : "Artists") + " list, drawn by the site from your own " + k2 });
      continue;
    }
    const title = key === "home" ? "Home" : human(key), secs = [], used = {};
    for (const s of src[key].sections) {
      if (!s || typeof s !== "object" || s.visible === false) continue;
      const label = String((kinds[s.type] && kinds[s.type].label) || human(s.type));
      const same = STARTER_KINDS.includes(s.type) && s.type !== "signup-popup", near = same ? s.type : BUILD_NEAR[s.type];
      if (!near) { left.push({ page: title, label }); continue; }
      if (!same) swapped.push({ page: title, from: label, to: near === "heading" ? "Columns, with a heading only" : STARTER_SECTIONS[near].label });
      const kind = near === "heading" ? "columns" : near, n = (used[kind] = (used[kind] || 0) + 1), id = kind + (n > 1 ? "-" + n : "");
      secs.push(near === "heading" ? BUILD_SEC(id, "columns", { heading: "[Page heading]", columns: [], numbered: false }) : BUILD_SEC(id, kind));
    }
    if (!secs.length) secs.push(BUILD_SEC("words", "text-picture"));
    out[k2] = secs; labels.push([k2, title]);
  }
  if (!out.home) { out.home = buildHome(); labels.unshift(["home", "Home"]); }
  return { sections: out, labels, swapped, left };
}
// Puts the site's name and tagline where they belong. The console does the same in sample mode.
export function nameInto(pages, c) {
  const p = JSON.parse(JSON.stringify(pages)), hd = p.shared.header.settings, ft = p.shared.footer.settings, op = p.shared.opening ? p.shared.opening.settings : null;
  // the name goes in the menu bar (and an opening screen); the tagline wherever the design shows one
  hd.name = c.name || "[Site name]";
  for (const st of [hd, ft, op]) if (st && "tagline" in st) st.tagline = c.tagline || "[A short line about the site]";
  if (op) op.name = c.name || "[Site name]";
  if (p.pages.home) {
    p.pages.home.title = c.name || "[Site name]";
    const b = (p.pages.home.sections || []).find((x) => x.id === "banner");
    if (b && c.tagline) b.settings.text = c.tagline;
  }
  return p;
}
function buildPagesDoc(list) {
  const links = list.labels.slice(0, 7).map(([k, t]) => [t, k === "home" ? "./" : k + "/"]), pages = {};
  // Articles and Artists are lists the site draws itself, so they are links, not pages
  for (const [k, t] of list.labels) if (list.sections[k]) pages[k] = buildPage(k, t, list.sections[k]);
  return {
    _how_to_edit: "This file is edited in Artiscope Digital Home. Each page is a list of sections; words in square brackets are placeholders waiting for real words.",
    shared: {
      header: { type: "header", visible: true, settings: { name: "[Site name]", tagline: "[A short line about the site]", links, button: "", button_href: "", logos: [] } },
      footer: { type: "footer", visible: true, settings: { tagline: "[A short line about the site]", links_heading: "", links, legal: "[Small print, such as the year and the site's name]" } },
    },
    groups: { top: [], popups: [], bottom: [] }, pages, addons: {},
  };
}
// The three data files a new site starts with, and notes on anything copied that had to change.
export function planFiles(c, address, copied, tpl) {
  // from a template: its own pages, with the name and tagline put in, and its own empty content
  if (c.template && c.template !== "starter") {
    if (!tpl) throw new Error("The template could not be read from GitHub just now. Try again in a moment.");
    const spec = starterSite({ template: c.template }).theme, look = buildLooks(c.template).find((l) => l.name === c.look) || buildLooks(c.template)[0];
    const theme = themeFile({ pages: { images: (starterSite({ template: c.template }).pages || {}).images || "assets/images" } }, spec, cleanTheme(spec, lookInto(spec, look)));
    const t0 = JSON.parse(JSON.stringify(tpl.content || {})), was = t0.site || {};
    // a template whose details carry the site's name and tagline (Global Art Monitor's) gets them there too
    const named = { ...("name" in was ? { name: c.name || "[Site name]" } : {}), ...("tagline" in was ? { tagline: c.tagline || was.tagline } : {}) };
    const content = { ...t0, site: { ...was, ...named, email: c.email, address, indexed: false } };
    return { pages: nameInto(tpl.pages, c), theme, content, notes: { swapped: [], left: [] } };
  }
  let list, notes = { swapped: [], left: [] };
  if (c.pages === "set") { const set = buildSet(); list = { sections: set, labels: BUILD_SET.slice() }; }
  else if (c.pages === "copy" && copied) { list = copied; notes = { swapped: copied.swapped, left: copied.left }; }
  else list = { sections: { home: buildHome() }, labels: [["home", "Home"]] };
  const pages = nameInto(buildPagesDoc(list), c);
  const look = buildLooks().find((l) => l.name === c.look) || buildLooks()[0];
  const v = cleanTheme(STARTER_THEME, { colours: look.colours, fonts: look.fonts, settings: { corners: look.corners === "round" ? "round" : "" } });
  const theme = themeFile({ pages: { images: "assets/images" } }, STARTER_THEME, v);
  const content = { site: { email: c.email, address, indexed: false }, articles: [], artists: [] };
  return { pages, theme, content, notes };
}
const buildCopies = {};
async function copiedFrom(id) {
  const from = SITES.find((x) => x.id === id && x.live && x.pages);
  if (!from) return null;
  const hit = buildCopies[id];
  if (hit && Date.now() - hit.at < 120000) return hit.copy;
  const got = await getText(from.repo, from.pages.file);
  let doc = null; try { doc = got ? JSON.parse(got.text) : null; } catch (_e) { doc = null; }
  if (!doc) return null;
  const copy = copyLayout(doc, from);
  buildCopies[id] = { at: Date.now(), copy };
  return copy;
}
// A template's pages and content, read from its folder in this repository (kept two minutes).
const tplFiles = {};
async function templateFiles(id) {
  const t = templateOf(id), hit = tplFiles[t.id];
  if (hit && Date.now() - hit.at < 120000) return hit.files;
  const F = t.files || DATA_FILES;
  const [p, c] = await Promise.all([getText(CONSOLE_REPO, t.dir + "/" + F.pages), getText(CONSOLE_REPO, t.dir + "/" + F.content)]);
  let files = null; try { files = p && c ? { pages: JSON.parse(p.text), content: JSON.parse(c.text) } : null; } catch (_e) { files = null; }
  if (files) tplFiles[t.id] = { at: Date.now(), files };
  return files;
}
export function buildSpec(template = "starter") {
  return { looks: buildLooks(template), templates: SITE_TEMPLATES.map((t) => ({ id: t.id, name: t.name, ready: !!t.ready, dir: t.dir || "", global: t.global || "", page: t.id === "world-art-review" ? "src/index.html" : "", line: t.line, own: t.own || "", pages: t.pages || "", stays: t.stays || "", later: t.later || "",
      look: buildLooks(t.ready ? t.id : "starter")[0] })), registrars: BUILD_REGISTRARS, set: BUILD_SET.map((x) => x[1]), from: BUILD_FROM.map((id) => ({ id, name: (SITES.find((x) => x.id === id) || {}).name || id })),
    kinds: STARTER_KINDS.map((k) => STARTER_SECTIONS[k].label), ips: GITHUB_IPS, org: BUILD_ORG };
}
// Where a new site will be until its own web address is connected.
function buildAddress(card, c) { return card.playground ? "https://" + card.domain + "/" : "https://" + BUILD_ORG.toLowerCase() + ".github.io/" + buildSlug(c.name) + "/"; }
export async function planSite(card, given) {
  const c = cleanBuild(given, card);
  const copied = c.pages === "copy" ? await copiedFrom(c.from) : null;
  if (c.pages === "copy" && !copied) throw new Error("That site's pages could not be read from GitHub just now. Try again in a moment.");
  const tpl = c.template !== "starter" ? await templateFiles(c.template) : null;
  return { choices: c, address: buildAddress(card, c), repo: card.playground ? card.repo : BUILD_ORG + "/" + buildSlug(c.name), ...planFiles(c, buildAddress(card, c), copied, tpl) };
}
// The list of sites in sites.json, changed and saved. Returns an error message or "".
async function changeSiteList(change, message) {
  for (let i = 0; i < 2; i++) {
    const r = await gh("/repos/" + CONSOLE_REPO + "/contents/sites.json?ref=main");
    let list = DEFAULT_SITE_LIST.map((x) => ({ ...x })), sha;
    if (r.ok && r.data && r.data.content) { try { const d = JSON.parse(decodeBase64Utf8(String(r.data.content).replace(/\n/g, ""))); list = Array.isArray(d.sites) ? d.sites : list; } catch (_e) { /* the defaults */ } sha = r.data.sha; }
    else if (r.status !== 404) return LIST_HELP;
    list = change(list);
    const doc = { about: "The sites Artiscope Digital Home runs beyond the five built into it. Start building adds to this list.", sites: list };
    const w = await gh("/repos/" + CONSOLE_REPO + "/contents/sites.json", { method: "PUT", body: JSON.stringify({ message, content: encodeBase64Utf8(JSON.stringify(doc, null, 2) + "\n"), ...(sha ? { sha } : {}), branch: "main" }) });
    if (w.ok) { useSiteList(doc); siteListAt = Date.now(); siteListSha = ""; return ""; }
    if (w.status !== 409 && w.status !== 422) return LIST_HELP;
  }
  return LIST_HELP;
}
async function waitForMain(repo) {
  for (let i = 0; i < 6; i++) {
    const r = await gh("/repos/" + repo + "/git/ref/heads/main");
    if (r.ok && r.data && r.data.object) return r.data.object.sha;
    await new Promise((ok) => setTimeout(ok, 700));
  }
  return "";
}
async function pagesOn(repo) {
  const r = await gh("/repos/" + repo + "/pages", { method: "POST", body: JSON.stringify({ build_type: "workflow" }) });
  if (r.ok || r.status === 409) return true;
  const now = await gh("/repos/" + repo + "/pages");
  return !!(now.ok && now.data && now.data.build_type === "workflow");
}
// Publishes again by moving main to a new commit with the same files, so the publishing steps run.
async function publishAgain(site, message) {
  const head = await mainSha(site), c = head ? await gh("/repos/" + site.repo + "/git/commits/" + head) : null;
  if (!c || !c.ok) return false;
  const made = await gh("/repos/" + site.repo + "/git/commits", { method: "POST", body: JSON.stringify({ message, tree: c.data.tree.sha, parents: [head] }) });
  return !!(made.ok && (await moveBranch(site, "main", made.data.sha, false)).ok);
}
// Creates the site: a new repository (or the practice build rewritten), publishing switched on,
// the files written, version 1.0, and its place in the list of sites. Each part is reported.
export async function createSite(card, given, tag) {
  const plan = await planSite(card, given), c = plan.choices, done = [], todo = [];
  const F = templateOf(c.template).files || DATA_FILES, files = { [F.pages]: plan.pages, [F.theme]: plan.theme, [F.content]: plan.content };
  if (!c.name) throw new Error("Give the site a name.");
  if (card.playground) {
    const w = await starterInto({ ...card, dir: templateOf(c.template).dir }, "Start building: " + c.name + (c.template !== "starter" ? ", from the " + templateOf(c.template).name + " template" : "") + " (by " + tag + ")", { files });
    if (w.error) return { error: w.error };
    // the practice build is now run as a site of that template
    if ((card.template || "starter") !== c.template) {
      const err = await changeSiteList((list) => { const had = list.some((x) => x && x.id === card.id), base = had ? list : list.concat(DEFAULT_SITE_LIST.filter((x) => x.id === card.id));
        return base.map((x) => { if (!x || x.id !== card.id) return x; const n = { ...x }; if (c.template === "starter") delete n.template; else n.template = c.template; return n; }); }, "The practice build now uses the " + templateOf(c.template).name + " design (by " + tag + ")");
      if (err) return { error: err };
    }
    const found = await gh("/repos/" + card.repo + "/git/matching-refs/heads/adh/");
    for (const ref of Array.isArray(found.data) ? found.data : []) await gh("/repos/" + card.repo + "/git/" + String(ref.ref).replace(/^refs\//, "refs/"), { method: "DELETE" });
    done.push("Pages, look and words written", "Published to " + plan.address.replace(/^https:\/\//, "").replace(/\/$/, ""), "Hidden from search engines");
    return { ok: true, site: card.id, address: plan.address, done, todo, practice: true };
  }
  const slug = buildSlug(c.name);
  if (!slug || slug.length < 2) throw new Error("Give the site a name with at least two letters or numbers.");
  const repo = BUILD_ORG + "/" + slug;
  if (SITES.some((x) => String(x.repo || "").toLowerCase() === repo.toLowerCase())) throw new Error("Another site already uses the name " + repo + ". Choose a different site name.");
  const there = await gh("/repos/" + repo);
  // A repository the console began for this address (it carries the address as its homepage) and that
  // is not on the list of sites yet is one a Create site stopped half way through: carry on with it.
  const resume = there.ok && there.data && String(there.data.homepage || "").replace(/\/$/, "") === plan.address.replace(/\/$/, "");
  if (there.ok && !resume) throw new Error("There is already a repository called " + repo + " on GitHub. Choose a different site name.");
  if (!resume) {
    const made = await gh("/orgs/" + BUILD_ORG + "/repos", { method: "POST", body: JSON.stringify({ name: slug, description: c.tagline || c.name, private: false, auto_init: true, has_wiki: false, has_projects: false, homepage: plan.address }) });
    if (!made.ok) return { error: made.status === 422 ? "GitHub would not make " + repo + ". Try a different site name." : MAKE_HELP };
  }
  done.push((resume ? "Carried on with the repository made last time: " : "Repository made: ") + repo);
  const site = starterSite({ id: card.id, name: c.name, domain: plan.address.replace(/^https:\/\//, "").replace(/\/$/, ""), repo, live: true, template: c.template });
  if (!(await waitForMain(repo))) return { error: "GitHub made " + repo + " but it is not ready yet. Wait a minute, then press Create site again with a different name, or ask for help.", done };
  if (await pagesOn(repo)) done.push("Publishing switched on"); else todo.push("pages");
  let w = await starterInto(site, "Start the site from Artiscope Digital Home (by " + tag + ")", { files, github: true });
  if (w.steps) { todo.push("steps"); w = await starterInto(site, "Start the site from Artiscope Digital Home (by " + tag + ")", { files }); }
  if (w.error) return { error: w.error, done };
  done.push("Pages, look and words written");
  const had = resume ? await gh("/repos/" + repo + "/releases?per_page=5") : null;
  if (had && had.ok && Array.isArray(had.data) && had.data.some((x) => x.tag_name === "v1.0")) done.push("Version 1.0");
  else if (w.sha && await addRelease(site, [1, 0], w.sha, "First version", "The site was built in Artiscope Digital Home from " + (c.template === "starter" ? "the starter" : "the " + templateOf(c.template).name + " template") + ".\n\n<!-- by: " + tag + " -->")) done.push("Version 1.0");
  done.push("Hidden from search engines until its own address is connected");
  const entry = { id: card.id, name: c.name, domain: site.domain, repo, kind: "starter", live: true, want: c.domain, registrar: c.registrar, todo, ...(c.template !== "starter" ? { template: c.template } : {}) };
  const listErr = await changeSiteList((list) => { const out = list.filter((x) => x && x.id !== card.id); out.push(entry); return out; }, "Add " + c.name + " to the list of sites (by " + tag + ")");
  if (listErr) return { error: listErr, done };
  return { ok: true, site: card.id, address: plan.address, done, todo, want: c.domain, registrar: c.registrar, records: dnsRecords(c.domain) };
}
// Finishes what Create site could not do the first time (publishing steps, or switching publishing on).
export async function finishSite(site, tag) {
  const todo = (site.todo || []).slice(), left = [];
  for (const t of todo) {
    if (t === "pages") { if (await pagesOn(site.repo)) { await publishAgain(site, "Publish now that publishing is on (by " + tag + ")"); } else left.push(t); }
    if (t === "steps") {
      const w = await starterInto(site, "Add the publishing steps (by " + tag + ")", { github: true, only: ".github/" });
      if (w.error) left.push(t);
    }
  }
  const err = await changeSiteList((list) => list.map((x) => x && x.id === site.id ? { ...x, todo: left } : x), "Set up " + site.name + " (by " + tag + ")");
  if (err) return { error: err };
  return left.length ? { error: left.includes("steps") ? STEPS_HELP : PAGES_HELP, todo: left } : { ok: true };
}
// Asks a public DNS service what an address points at.
async function dnsAsk(name, type) {
  try {
    const r = await fetch("https://dns.google/resolve?name=" + encodeURIComponent(name) + "&type=" + type, { headers: { Accept: "application/dns-json" } });
    const d = await r.json(), want = type === "A" ? 1 : type === "CNAME" ? 5 : 0;
    // an answer can carry the steps on the way (a CNAME before the A records): keep only the kind asked for
    return (Array.isArray(d.Answer) ? d.Answer : []).filter((a) => a.type == null || a.type === want).map((a) => String(a.data || "").replace(/\.$/, "").toLowerCase());
  } catch (_e) { return null; }
}
// Checks the web address the owner gave, and connects it once its records point at GitHub.
export async function checkDomain(site, tag) {
  const want = site.want;
  if (!want) return { error: "This site has no web address to connect. Give one in Site details first." };
  const sub = isSubdomain(want);
  const [a, www, own] = await Promise.all([dnsAsk(want, "A"), sub ? Promise.resolve([]) : dnsAsk("www." + want, "CNAME"), sub ? dnsAsk(want, "CNAME") : Promise.resolve([])]);
  if (a === null || own === null) return { error: "The address could not be looked up just now. Try again in a moment." };
  const host = BUILD_ORG.toLowerCase() + ".github.io", wwwOk = !!(www && www.includes(host));
  const aOk = sub ? own.includes(host) : a.length > 0 && a.every((ip) => GITHUB_IPS.includes(ip));
  if (!aOk) return { ok: true, connected: false, found: sub ? own : a, wwwOk };
  const domain = want, connected = site.domain === domain;
  if (!connected) {
    const set = await gh("/repos/" + site.repo + "/pages", { method: "PUT", body: JSON.stringify({ cname: domain }) });
    if (!set.ok) return { error: PAGES_HELP.replace(" Then press Try again.", " Then press Check again.") };
    const detailsFile = (site.files || DATA_FILES).content, got = await getText(site.repo, detailsFile);
    let content = {}; try { content = JSON.parse(got ? got.text : "{}"); } catch (_e) { content = {}; }
    content.site = { ...(content.site || {}), address: "https://" + domain + "/", indexed: true };
    const put = await gh("/repos/" + site.repo + "/contents/" + detailsFile, { method: "PUT", body: JSON.stringify({ message: "Connect " + domain + " and let search engines in (by " + tag + ")", content: encodeBase64Utf8(JSON.stringify(content, null, 2) + "\n"), ...(got ? { sha: got.sha } : {}), branch: "main" }) });
    if (!put.ok) return { error: writeProblem(put, "The site's address could not be saved.") };
    const err = await changeSiteList((list) => list.map((x) => x && x.id === site.id ? { ...x, domain } : x), "Connect " + domain + " (by " + tag + ")");
    if (err) return { error: err };
  }
  const secure = (await gh("/repos/" + site.repo + "/pages", { method: "PUT", body: JSON.stringify({ cname: domain, https_enforced: true }) })).ok;
  return { ok: true, connected: true, secure, wwwOk, found: a };
}

// ---------- shops on Shopify: products, prices, stock and photos from the console ----------
// A shop is a card in sites.json with kind "shop" and its Shopify store's name (the part of its Shopify
// address before .myshopify.com). The console reads and changes the store through Shopify's Admin API, with
// the owner's own app in Shopify. Its key lives only in Supabase's secrets, in one of two forms:
// - SHOPIFY_TOKEN: the Admin API key of an app made in the shop's admin before 2026 (Apps, Develop apps).
// - SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET: an app made in Shopify's Dev Dashboard, in the same organisation as
//   the shop. The server asks Shopify for a key with them when it needs one (each lasts a day).
// A second store adds _<STORE> to each name (SHOPIFY_TOKEN_MY_OTHER_SHOP). Shopify stays the one record: nothing about the products is kept here, except the list
// of changes made from the console (on the shop-log branch of the console's repository), so each can be put back.
// Shopify still takes the payments, sends the order emails and handles delivery.
export const SHOPIFY_VERSION = "2026-10";
export const SHOP_NEEDS = "read and write products, inventory and files, and read locations";
const shopEnv = (site, name) => env(name + "_" + site.shop.store.toUpperCase().replace(/-/g, "_")) || env(name);
export function shopKey(site) {
  return !!(shopEnv(site, "SHOPIFY_TOKEN") || (shopEnv(site, "SHOPIFY_CLIENT_ID") && shopEnv(site, "SHOPIFY_CLIENT_SECRET")));
}
const shopKeys = {};
async function shopToken(site, fresh = false) {
  const fixed = shopEnv(site, "SHOPIFY_TOKEN"); if (fixed) return fixed;
  const id = shopEnv(site, "SHOPIFY_CLIENT_ID"), secret = shopEnv(site, "SHOPIFY_CLIENT_SECRET");
  if (!id || !secret) return "";
  const had = shopKeys[site.shop.store];
  if (had && !fresh && had.until > Date.now()) return had.key;
  let r;
  try {
    r = await fetch("https://" + site.shop.store + ".myshopify.com/admin/oauth/access_token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }).toString() });
  } catch (_e) { throw shopError("Shopify could not be reached just now. Please try again in a minute."); }
  let d = null; try { d = await r.json(); } catch (_e) { d = null; }
  if (!r.ok || !d || !d.access_token) throw shopError("Shopify did not give the console a key with the app's Client ID and secret" + (d && d.error ? " (" + cleanText(d.error_description || d.error, 120) + ")" : "") + ". Check that the app is installed on the shop, and that the app and the shop are in the same organisation in Shopify's Dev Dashboard.");
  shopKeys[site.shop.store] = { key: d.access_token, until: Date.now() + Math.max(60, Number(d.expires_in || 3600) - 300) * 1000 };
  return d.access_token;
}
function shopError(message, status = 502, stale = false) { const e = new Error(message); e.status = status; e.stale = stale; return e; }
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function shopify(site, query, variables = {}) {
  let key = await shopToken(site);
  if (!key) throw shopError("The Shopify key has not been added yet. Add it in Supabase under Edge Functions, Secrets: SHOPIFY_TOKEN for an app made in the shop's admin, or SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET for an app made in Shopify's Dev Dashboard.", 503);
  for (let i = 0; i < 4; i++) {
    let res;
    try {
      res = await fetch("https://" + site.shop.store + ".myshopify.com/admin/api/" + SHOPIFY_VERSION + "/graphql.json", {
        method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": key }, body: JSON.stringify({ query, variables }) });
    } catch (_e) { throw shopError("Shopify could not be reached just now. Please try again in a minute."); }
    if (res.status === 401 && !shopEnv(site, "SHOPIFY_TOKEN") && i === 0) { key = await shopToken(site, true); continue; }
    if (res.status === 401) throw shopError("Shopify did not accept the key. Make a new key for the app in Shopify and replace it in Supabase.");
    if (res.status === 402 || res.status === 423) throw shopError("Shopify says the shop is not open at the moment. Check the shop's plan in Shopify.");
    if (res.status === 429 || res.status >= 500) { await pause(700 * (i + 1)); continue; }
    let d = null;
    try { d = await res.json(); } catch (_e) { d = null; }
    if (!d) throw shopError("Shopify sent an answer the console could not read. Please try again.");
    const errs = Array.isArray(d.errors) ? d.errors : d.errors ? [d.errors] : [];
    const code = (e) => e && e.extensions && e.extensions.code;
    if (errs.some((e) => code(e) === "THROTTLED")) { await pause(1000 * (i + 1)); continue; }
    if (res.status === 403 || errs.some((e) => code(e) === "ACCESS_DENIED")) throw shopError("The Shopify key is missing a permission. In Shopify, give the app access to " + SHOP_NEEDS + ".");
    if (errs.length) throw shopError("Shopify could not do that: " + cleanText(errs[0].message || errs[0], 200));
    return d.data || {};
  }
  throw shopError("Shopify is busy just now. Please try again in a minute.");
}
// A mutation's own refusals, in Shopify's words.
function shopRefused(payload, what) {
  const list = payload ? [...(payload.userErrors || []), ...(payload.mediaUserErrors || [])] : [];
  if (!payload) throw shopError(what + " could not be done in Shopify.");
  if (list.length) throw shopError(what + " was refused by Shopify: " + cleanText(list[0].message, 200), 400);
  return payload;
}

// Money as Shopify keeps it ("250.00"), from what was typed ("£250", "250", "1,250.5").
export function shopMoney(v, blankOk = false) {
  const t = String(v == null ? "" : v).replace(/[£,\s]/g, "");
  if (!t) { if (blankOk) return null; throw shopError("A price is empty.", 400); }
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(t)) throw shopError("\"" + cleanText(String(v), 30) + "\" is not a price. Write it like 250 or 249.50.", 400);
  return Number(t).toFixed(2);
}
const sameMoney = (a, b) => (a == null || a === "" ? null : Number(a).toFixed(2)) === (b == null || b === "" ? null : Number(b).toFixed(2));
const GID = (kind) => new RegExp("^gid://shopify/" + kind + "/\\d{1,20}$");
const isGid = (v, kind) => GID(kind).test(String(v || ""));
const STATUS_OK = ["ACTIVE", "DRAFT", "ARCHIVED", "UNLISTED"];

const LIST_Q = `query List($after: String) {
  products(first: 100, after: $after, sortKey: UPDATED_AT, reverse: true) {
    pageInfo { hasNextPage endCursor }
    nodes { id title handle status totalInventory variantsCount { count } updatedAt options { name optionValues { name } }
      priceRangeV2 { minVariantPrice { amount } maxVariantPrice { amount } }
      featuredMedia { preview { image { url(transform: { maxWidth: 160 }) } } }
      collections(first: 10) { nodes { id } } }
  }
  collections(first: 60, sortKey: TITLE) { nodes { id title handle ruleSet { appliedDisjunctively } } }
  shop { currencyCode }
}`;
const ONE_Q = `query One($id: ID!) {
  product(id: $id) { id title handle status descriptionHtml templateSuffix updatedAt totalInventory
    seo { title description }
    options { name optionValues { name } }
    variants(first: 100) { nodes { id title price compareAtPrice sku selectedOptions { name value }
      inventoryItem { id tracked inventoryLevels(first: 10) { nodes { location { id name } quantities(names: ["available"]) { name quantity } } } } } }
    media(first: 60) { nodes { id alt mediaContentType status preview { image { url(transform: { maxWidth: 400 }) } } } }
    collections(first: 30) { nodes { id title } } }
  collections(first: 60, sortKey: TITLE) { nodes { id title handle ruleSet { appliedDisjunctively } } }
  locations(first: 20) { nodes { id name isActive } }
}`;
const shopCollections = (d) => ((d.collections && d.collections.nodes) || []).map((c) => ({ id: c.id, title: c.title, handle: c.handle, auto: !!c.ruleSet }));
function shopListed(p) {
  const lo = p.priceRangeV2 && p.priceRangeV2.minVariantPrice ? p.priceRangeV2.minVariantPrice.amount : null, hi = p.priceRangeV2 && p.priceRangeV2.maxVariantPrice ? p.priceRangeV2.maxVariantPrice.amount : null;
  const pic = p.featuredMedia && p.featuredMedia.preview && p.featuredMedia.preview.image ? p.featuredMedia.preview.image.url : "";
  return { id: p.id, title: p.title, handle: p.handle, status: p.status, stock: p.totalInventory, versions: p.variantsCount ? p.variantsCount.count : 0,
    low: lo == null ? null : Number(lo).toFixed(2), high: hi == null ? null : Number(hi).toFixed(2), pic, collections: ((p.collections && p.collections.nodes) || []).map((c) => c.id), updatedAt: p.updatedAt,
    options: (p.options || []).map((o) => ({ name: o.name, values: (o.optionValues || []).map((v) => v.name) })) };
}
function shopProduct(site, p, d) {
  const stockOf = (v) => (((v.inventoryItem && v.inventoryItem.inventoryLevels && v.inventoryItem.inventoryLevels.nodes) || []).map((l) => {
    const q = (l.quantities || []).find((x) => x.name === "available");
    return { location: l.location.id, name: l.location.name, qty: q ? q.quantity : 0 };
  }));
  return { id: p.id, title: p.title, handle: p.handle, status: p.status, description: p.descriptionHtml || "", template: p.templateSuffix || "", updatedAt: p.updatedAt, stock: p.totalInventory,
    url: site.domain && p.handle ? "https://" + site.domain + "/products/" + p.handle : "",
    seo: { title: (p.seo && p.seo.title) || "", description: (p.seo && p.seo.description) || "" },
    options: (p.options || []).map((o) => ({ name: o.name, values: (o.optionValues || []).map((v) => v.name) })),
    variants: ((p.variants && p.variants.nodes) || []).map((v) => ({ id: v.id, title: v.title, price: Number(v.price).toFixed(2), was: v.compareAtPrice == null ? null : Number(v.compareAtPrice).toFixed(2), sku: v.sku || "",
      options: Object.fromEntries((v.selectedOptions || []).map((o) => [o.name, o.value])), item: v.inventoryItem ? v.inventoryItem.id : "", tracked: !!(v.inventoryItem && v.inventoryItem.tracked), stock: stockOf(v) })),
    photos: ((p.media && p.media.nodes) || []).filter((m) => m.mediaContentType === "IMAGE").map((m) => ({ id: m.id, alt: m.alt || "", url: m.preview && m.preview.image ? m.preview.image.url : "", ready: m.status === "READY" })),
    collections: ((p.collections && p.collections.nodes) || []).map((c) => c.id),
    allCollections: shopCollections(d), locations: ((d.locations && d.locations.nodes) || []).filter((l) => l.isActive !== false).map((l) => ({ id: l.id, name: l.name })) };
}
async function shopReadOne(site, id) {
  if (!isGid(id, "Product")) throw shopError("That product is not known.", 400);
  const d = await shopify(site, ONE_Q, { id });
  if (!d.product) throw shopError("That product is no longer in the shop. It may have been deleted in Shopify.", 404);
  return shopProduct(site, d.product, d);
}

// ----- the list of changes made from the console, so each can be put back -----
const SHOP_LOG_BRANCH = "shop-log";
const shopLogPath = (site) => "shop-log/" + site.id + ".json";
async function shopLogRead(site) {
  const r = await gh("/repos/" + CONSOLE_REPO + "/contents/" + shopLogPath(site) + "?ref=" + SHOP_LOG_BRANCH);
  if (!r.ok || !r.data || !r.data.content) return { entries: [], sha: "", missing: r.status === 404 };
  try { const d = JSON.parse(decodeBase64Utf8(String(r.data.content).replace(/\n/g, ""))); return { entries: Array.isArray(d.entries) ? d.entries : [], sha: r.data.sha }; }
  catch (_e) { return { entries: [], sha: r.data.sha }; }
}
async function shopLogAdd(site, entry) {
  for (let i = 0; i < 3; i++) {
    const now = await shopLogRead(site);
    if (!now.sha) {
      const br = await gh("/repos/" + CONSOLE_REPO + "/git/ref/heads/" + SHOP_LOG_BRANCH);
      if (!br.ok) {
        const main = await gh("/repos/" + CONSOLE_REPO + "/git/ref/heads/main");
        if (!main.ok || !main.data || !main.data.object) return false;
        await gh("/repos/" + CONSOLE_REPO + "/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/" + SHOP_LOG_BRANCH, sha: main.data.object.sha }) });
      }
    }
    const entries = [entry, ...now.entries].slice(0, 300);
    const doc = { about: "Changes made to " + site.name + "'s Shopify products from Artiscope Digital Home, newest first. Each can be put back from the console.", entries };
    const w = await gh("/repos/" + CONSOLE_REPO + "/contents/" + shopLogPath(site), { method: "PUT", body: JSON.stringify({ message: "Shop: " + cleanText(entry.what, 120) + " (by " + entry.by + ")", content: encodeBase64Utf8(JSON.stringify(doc, null, 1) + "\n"), branch: SHOP_LOG_BRANCH, ...(now.sha ? { sha: now.sha } : {}) }) });
    if (w.ok) return true;
    if (w.status !== 409 && w.status !== 422) return false;
  }
  return false;
}
function shopEntry(by, what, items) {
  return { id: crypto.randomUUID().slice(0, 12), when: new Date().toISOString(), by, what: cleanText(what, 200), items };
}

// ----- saving one product: every change carries what it was, and is refused if Shopify has moved on -----
const PRODUCT_FIELDS = { title: 255, description: 60000, status: 20, seoTitle: 70, seoDescription: 320, template: 60 };
export function shopCleanChange(given, now) {
  const c = given && typeof given === "object" ? given : {}, out = { product: {}, variants: [], stock: [], add: [], remove: [], photos: [], order: null };
  const moved = [];
  const cur = { title: now.title, description: now.description, status: now.status, seoTitle: now.seo.title, seoDescription: now.seo.description, template: now.template };
  for (const f of Object.keys(PRODUCT_FIELDS)) {
    if (!c[f] || typeof c[f] !== "object") continue;
    let to = String(c[f].to == null ? "" : c[f].to);
    if (f === "description") to = safeMarks(to).slice(0, PRODUCT_FIELDS[f]);
    else if (f === "status") { if (!STATUS_OK.includes(to)) throw shopError("That status is not known.", 400); }
    else if (f === "template") { if (to && !/^[a-z0-9_-]{1,60}$/i.test(to)) throw shopError("That page layout is not known.", 400); }
    else to = cleanText(to, PRODUCT_FIELDS[f]);
    if (f === "title" && !to.trim()) throw shopError("A product needs a title.", 400);
    if (String(c[f].from == null ? "" : c[f].from) !== String(cur[f] == null ? "" : cur[f])) moved.push(f);
    if (to !== String(cur[f] || "")) out.product[f] = { from: cur[f] || "", to };
  }
  const vs = Object.fromEntries(now.variants.map((v) => [v.id, v]));
  for (const g of (Array.isArray(c.variants) ? c.variants : []).slice(0, 100)) {
    const v = g && vs[g.id]; if (!v) throw shopError("A version of this product is no longer in the shop. Refresh and try again.", 409, true);
    const ch = { id: v.id, version: v.title };
    if (g.price) { if (!sameMoney(g.price.from, v.price)) moved.push("price"); const to = shopMoney(g.price.to); if (!sameMoney(to, v.price)) ch.price = { from: v.price, to }; }
    if (g.was) { if (!sameMoney(g.was.from, v.was)) moved.push("was price"); const to = shopMoney(g.was.to, true); if (!sameMoney(to, v.was)) ch.was = { from: v.was, to }; }
    if (g.sku) { if (String(g.sku.from || "") !== v.sku) moved.push("stock code"); const to = cleanText(g.sku.to, 100); if (to !== v.sku) ch.sku = { from: v.sku, to }; }
    if (ch.price || ch.was || ch.sku) out.variants.push(ch);
  }
  for (const s of (Array.isArray(c.stock) ? c.stock : []).slice(0, 300)) {
    const v = now.variants.find((x) => x.item === s.item); const at = v && v.stock.find((l) => l.location === s.location);
    if (!v || !at) throw shopError("A stock place is no longer in the shop. Refresh and try again.", 409, true);
    const to = Number(s.to); if (!Number.isInteger(to) || to < 0 || to > 1000000) throw shopError("Stock must be a whole number.", 400);
    if (Number(s.from) !== at.qty) moved.push("stock");
    if (to !== at.qty) out.stock.push({ item: v.item, version: v.title, location: at.location, place: at.name, from: at.qty, to });
  }
  const known = Object.fromEntries(now.allCollections.map((x) => [x.id, x]));
  for (const id of (c.collections && Array.isArray(c.collections.add) ? c.collections.add : []).slice(0, 60)) {
    if (!known[id]) throw shopError("That collection is not in the shop.", 400);
    if (known[id].auto) throw shopError("\"" + known[id].title + "\" fills itself by rules in Shopify, so products cannot be added to it by hand.", 400);
    if (!now.collections.includes(id)) out.add.push({ id, title: known[id].title });
  }
  for (const id of (c.collections && Array.isArray(c.collections.remove) ? c.collections.remove : []).slice(0, 60)) {
    if (!known[id]) continue;
    if (known[id].auto) throw shopError("\"" + known[id].title + "\" fills itself by rules in Shopify, so products cannot be taken out of it by hand.", 400);
    if (now.collections.includes(id)) out.remove.push({ id, title: known[id].title });
  }
  const pics = Object.fromEntries(now.photos.map((x) => [x.id, x]));
  for (const ph of (Array.isArray(c.photos) ? c.photos : []).slice(0, 60)) {
    const was = ph && pics[ph.id]; if (!was) throw shopError("A photo is no longer on this product. Refresh and try again.", 409, true);
    if (String(ph.from || "") !== was.alt) moved.push("photo description");
    const to = cleanText(ph.to, 500); if (to !== was.alt) out.photos.push({ id: was.id, from: was.alt, to });
  }
  if (Array.isArray(c.order) && c.order.length) {
    const ids = c.order.map(String);
    if (ids.length !== now.photos.length || ids.some((id) => !pics[id])) throw shopError("The photos changed in Shopify. Refresh and try again.", 409, true);
    if (ids.join() !== now.photos.map((x) => x.id).join()) out.order = ids;
  }
  if (moved.length) throw shopError("This product was changed in Shopify since you opened it (" + [...new Set(moved)].join(", ") + "). Refresh to see the latest, then make your change again.", 409, true);
  return out;
}
const PRODUCT_UPDATE_M = `mutation Up($product: ProductUpdateInput!) { productUpdate(product: $product) { product { id updatedAt } userErrors { field message } } }`;
const VARIANTS_M = `mutation Vs($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants) { productVariants { id price } userErrors { field message } } }`;
const STOCK_M = `mutation Stock($input: InventorySetQuantitiesInput!, $key: String!) { inventorySetQuantities(input: $input) @idempotent(key: $key) { inventoryAdjustmentGroup { reason } userErrors { code field message } } }`;
const ADD_M = `mutation Add($id: ID!, $productIds: [ID!]!) { collectionAddProducts(id: $id, productIds: $productIds) { userErrors { field message } } }`;
const REMOVE_M = `mutation Remove($id: ID!, $productIds: [ID!]!) { collectionRemoveProducts(id: $id, productIds: $productIds) { userErrors { field message } } }`;
const ALT_M = `mutation Alt($files: [FileUpdateInput!]!) { fileUpdate(files: $files) { files { id } userErrors { field message } } }`;
const ORDER_M = `mutation Order($id: ID!, $moves: [MoveInput!]!) { productReorderMedia(id: $id, moves: $moves) { job { id } mediaUserErrors { field message } } }`;

// Makes the changes in Shopify, in a fixed order, and says what was done.
async function shopApply(site, now, ch) {
  const items = [], P = { productId: now.id, title: now.title };
  const pu = { id: now.id };
  if (ch.product.title) pu.title = ch.product.title.to;
  if (ch.product.description) pu.descriptionHtml = ch.product.description.to;
  if (ch.product.status) pu.status = ch.product.status.to;
  if (ch.product.template) pu.templateSuffix = ch.product.template.to || null;
  if (ch.product.seoTitle || ch.product.seoDescription) pu.seo = { title: (ch.product.seoTitle || { to: now.seo.title }).to, description: (ch.product.seoDescription || { to: now.seo.description }).to };
  if (Object.keys(pu).length > 1) {
    const d = await shopify(site, PRODUCT_UPDATE_M, { product: pu }); shopRefused(d.productUpdate, "Saving the product");
    for (const [f, x] of Object.entries(ch.product)) items.push({ kind: "product", ...P, field: f, from: x.from, to: x.to });
  }
  if (ch.variants.length) {
    const d = await shopify(site, VARIANTS_M, { productId: now.id, variants: ch.variants.map((v) => ({ id: v.id, ...(v.price ? { price: v.price.to } : {}), ...(v.was ? { compareAtPrice: v.was.to } : {}), ...(v.sku ? { inventoryItem: { sku: v.sku.to } } : {}) })) });
    shopRefused(d.productVariantsBulkUpdate, "Saving the prices");
    for (const v of ch.variants) for (const f of ["price", "was", "sku"]) if (v[f]) items.push({ kind: "variant", ...P, variantId: v.id, version: v.version, field: f, from: v[f].from, to: v[f].to });
  }
  if (ch.stock.length) {
    const d = await shopify(site, STOCK_M, { key: crypto.randomUUID(), input: { name: "available", reason: "correction", quantities: ch.stock.map((s) => ({ inventoryItemId: s.item, locationId: s.location, quantity: s.to, changeFromQuantity: s.from })) } });
    const pay = d.inventorySetQuantities;
    if (pay && (pay.userErrors || []).some((e) => /CHANGE_FROM_QUANTITY_STALE|COMPARE_QUANTITY_STALE/.test(String(e.code || "")))) throw shopError("The stock was changed in Shopify since you opened this product. Refresh to see the latest, then make your change again.", 409, true);
    shopRefused(pay, "Saving the stock");
    for (const s of ch.stock) items.push({ kind: "stock", ...P, item: s.item, version: s.version, location: s.location, place: s.place, from: s.from, to: s.to });
  }
  for (const c of ch.add) { const d = await shopify(site, ADD_M, { id: c.id, productIds: [now.id] }); shopRefused(d.collectionAddProducts, "Adding it to " + c.title); items.push({ kind: "collection", ...P, collectionId: c.id, collection: c.title, from: false, to: true }); }
  for (const c of ch.remove) { const d = await shopify(site, REMOVE_M, { id: c.id, productIds: [now.id] }); shopRefused(d.collectionRemoveProducts, "Taking it out of " + c.title); items.push({ kind: "collection", ...P, collectionId: c.id, collection: c.title, from: true, to: false }); }
  if (ch.photos.length) {
    const d = await shopify(site, ALT_M, { files: ch.photos.map((x) => ({ id: x.id, alt: x.to })) }); shopRefused(d.fileUpdate, "Saving the photo descriptions");
    for (const x of ch.photos) items.push({ kind: "photo", ...P, mediaId: x.id, from: x.from, to: x.to });
  }
  if (ch.order) {
    const d = await shopify(site, ORDER_M, { id: now.id, moves: ch.order.map((id, i) => ({ id, newPosition: String(i) })) }); shopRefused(d.productReorderMedia, "Changing the order of the photos");
    items.push({ kind: "note", ...P, what: "Photos put in a new order" });
  }
  return items;
}
export function shopSay(items, title) {
  const n = items.filter((x) => x.kind !== "note").length, prices = items.filter((x) => x.kind === "variant" && x.field === "price");
  if (!n) return items.length ? items[0].what + ", " + title : "";
  if (prices.length === n) {
    const from = [...new Set(prices.map((x) => x.from))], to = [...new Set(prices.map((x) => x.to))];
    return (prices.length === 1 ? "1 price" : prices.length + " prices") + " on " + title + (from.length === 1 && to.length === 1 ? ", " + gbp(from[0]) + " to " + gbp(to[0]) : "");
  }
  return (n === 1 ? "1 change" : n + " changes") + " to " + title;
}
export const gbp = (v) => v == null || v === "" ? "none" : "£" + (Number(v) % 1 ? Number(v).toFixed(2) : String(Number(v)));

// ----- changing many prices at once: a plan to check, then the same plan applied -----
const VARIANTS_Q = `query All($after: String) { productVariants(first: 250, after: $after) { pageInfo { hasNextPage endCursor }
  nodes { id title price compareAtPrice selectedOptions { name value } product { id title status } } } }`;
const IN_COLLECTION_Q = `query In($id: ID!, $after: String) { collection(id: $id) { title products(first: 250, after: $after) { pageInfo { hasNextPage endCursor } nodes { id } } } }`;
async function shopPages(site, query, vars, pick, most = 20) {
  const out = []; let after = null;
  for (let i = 0; i < most; i++) {
    const d = await shopify(site, query, { ...vars, after }); const conn = pick(d);
    if (!conn) break;
    out.push(...(conn.nodes || []));
    if (!conn.pageInfo || !conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return out;
}
export function shopNewPrice(old, how, value, round) {
  const o = Number(old); let n;
  if (how === "set") n = Number(shopMoney(value));
  else {
    const t = String(value == null ? "" : value).replace(/[£%,\s]/g, "");
    if (!/^[-+]?\d{1,7}(\.\d{1,2})?$/.test(t)) throw shopError("Write the change as a number, such as 25 or -10.", 400);
    n = how === "percent" ? o * (1 + Number(t) / 100) : o + Number(t);
    if (round === "pound") n = Math.round(n);
  }
  if (!(n > 0) || n >= 10000000) throw shopError("That would make a price of " + gbp(n.toFixed(2)) + ", which cannot be right.", 400);
  return n.toFixed(2);
}
async function shopPricePlan(site, body) {
  const f = body && body.filter && typeof body.filter === "object" ? body.filter : {}, how = ["set", "amount", "percent"].includes(body.how) ? body.how : "";
  if (!how) throw shopError("Choose how the prices change.", 400);
  const options = f.options && typeof f.options === "object" ? f.options : {};
  let inSet = null;
  if (f.products === "collection") {
    if (!isGid(f.collection, "Collection")) throw shopError("Choose a collection.", 400);
    inSet = new Set((await shopPages(site, IN_COLLECTION_Q, { id: f.collection }, (d) => d.collection && d.collection.products)).map((p) => p.id));
  } else if (f.products === "chosen") {
    const ids = (Array.isArray(f.ids) ? f.ids : []).filter((x) => isGid(x, "Product"));
    if (!ids.length) throw shopError("Choose at least one product.", 400);
    inSet = new Set(ids);
  }
  const all = await shopPages(site, VARIANTS_Q, {}, (d) => d.productVariants);
  const groups = {}, order = [];
  for (const v of all) {
    const p = v.product; if (!p) continue;
    if (f.products === "active" || !f.products) { if (p.status !== "ACTIVE") continue; }
    else if (inSet && !inSet.has(p.id)) continue;
    const opts = Object.fromEntries((v.selectedOptions || []).map((o) => [o.name, o.value]));
    if (Object.entries(options).some(([name, vals]) => Array.isArray(vals) && vals.length && !vals.includes(opts[name]))) continue;
    const from = Number(v.price).toFixed(2), to = shopNewPrice(from, how, body.value, body.round);
    const wasFrom = v.compareAtPrice == null ? null : Number(v.compareAtPrice).toFixed(2);
    let wasTo = wasFrom;
    if (body.was === true && Number(to) < Number(from)) wasTo = from;
    if (to === from && wasTo === wasFrom) continue;
    if (!groups[p.id]) { groups[p.id] = { productId: p.id, title: p.title, status: p.status, versions: [] }; order.push(p.id); }
    groups[p.id].versions.push({ id: v.id, title: v.title, from, to, wasFrom, wasTo });
  }
  const list = order.map((id) => groups[id]), flat = list.flatMap((g) => g.versions);
  const froms = [...new Set(flat.map((x) => x.from))], tos = [...new Set(flat.map((x) => x.to))];
  return { groups: list, count: flat.length, products: list.length, from: froms.length === 1 ? froms[0] : null, to: tos.length === 1 ? tos[0] : null };
}
const NODES_Q = `query Now($ids: [ID!]!) { nodes(ids: $ids) { ... on ProductVariant { id price compareAtPrice product { id } } } }`;
async function shopPriceApply(site, body, by) {
  const groups = (Array.isArray(body.groups) ? body.groups : []).slice(0, 2000);
  const want = [];
  for (const g of groups) for (const v of (Array.isArray(g.versions) ? g.versions : [])) {
    if (!isGid(g.productId, "Product") || !isGid(v.id, "ProductVariant")) throw shopError("The list of changes could not be read. Check the prices again.", 400);
    want.push({ productId: g.productId, title: cleanText(g.title, 255), id: v.id, version: cleanText(v.title, 255), from: shopMoney(v.from), to: shopMoney(v.to), wasFrom: shopMoney(v.wasFrom, true), wasTo: shopMoney(v.wasTo, true) });
  }
  if (!want.length) throw shopError("There are no prices to change.", 400);
  if (want.length > 5000) throw shopError("That is too many prices for one go. Choose fewer products.", 400);
  // Each price must still be what the check showed, or nothing is changed.
  const live = {};
  for (let i = 0; i < want.length; i += 250) {
    const d = await shopify(site, NODES_Q, { ids: want.slice(i, i + 250).map((x) => x.id) });
    for (const n of d.nodes || []) if (n && n.id) live[n.id] = n;
  }
  const moved = want.filter((x) => !live[x.id] || !sameMoney(live[x.id].price, x.from) || !sameMoney(live[x.id].compareAtPrice, x.wasFrom) || live[x.id].product.id !== x.productId);
  if (moved.length) throw shopError((moved.length === 1 ? "1 price has" : moved.length + " prices have") + " changed in Shopify since the check. Nothing was changed. Check the prices again.", 409, true);
  const byProduct = {};
  for (const x of want) (byProduct[x.productId] = byProduct[x.productId] || []).push(x);
  const items = []; let problem = "";
  for (const [productId, list] of Object.entries(byProduct)) {
    try {
      const d = await shopify(site, VARIANTS_M, { productId, variants: list.map((x) => ({ id: x.id, price: x.to, ...(x.wasTo !== x.wasFrom ? { compareAtPrice: x.wasTo } : {}) })) });
      shopRefused(d.productVariantsBulkUpdate, "Changing the prices of " + list[0].title);
    } catch (e) { problem = String(e.message || e); break; }
    for (const x of list) {
      items.push({ kind: "variant", productId, title: x.title, variantId: x.id, version: x.version, field: "price", from: x.from, to: x.to });
      if (x.wasTo !== x.wasFrom) items.push({ kind: "variant", productId, title: x.title, variantId: x.id, version: x.version, field: "was", from: x.wasFrom, to: x.wasTo });
    }
  }
  const done = items.filter((x) => x.field === "price").length;
  const label = cleanText(body.label, 160) || ((done === 1 ? "1 price" : done + " prices") + " changed");
  const logged = items.length ? await shopLogAdd(site, shopEntry(by, label, items)) : true;
  return { ok: !problem, changed: done, of: want.length, problem: problem ? problem + " " + done + " of " + want.length + " prices were changed before that, and are listed in Changes, where they can be put back." : "", logged };
}

// ----- putting a change back: each part only if it is still as the change left it -----
const VARIANT_NOW_Q = `query V($ids: [ID!]!) { nodes(ids: $ids) { ... on ProductVariant { id price compareAtPrice sku product { id } } } }`;
async function shopPutBack(site, body, by) {
  const log = await shopLogRead(site), entry = log.entries.find((e) => e.id === String(body.entry || ""));
  if (!entry) throw shopError("That change is no longer in the list.", 404);
  if (entry.putBack) throw shopError("That change has already been put back.", 409);
  const parts = entry.items.filter((x) => x.kind !== "note");
  if (!parts.length) throw shopError("This change cannot be put back from the console.", 400);
  // Check everything first, so nothing is half put back.
  const products = {}, variantIds = parts.filter((x) => x.kind === "variant").map((x) => x.variantId), vnow = {};
  for (const id of [...new Set(parts.filter((x) => x.kind !== "variant").map((x) => x.productId))]) products[id] = await shopReadOne(site, id);
  for (let i = 0; i < variantIds.length; i += 250) { const d = await shopify(site, VARIANT_NOW_Q, { ids: variantIds.slice(i, i + 250) }); for (const n of d.nodes || []) if (n && n.id) vnow[n.id] = n; }
  const moved = [];
  for (const x of parts) {
    const p = products[x.productId];
    if (x.kind === "variant") { const n = vnow[x.variantId]; const cur = !n ? undefined : x.field === "price" ? n.price : x.field === "was" ? n.compareAtPrice : n.sku || ""; if (n === undefined || (x.field === "sku" ? String(cur) !== String(x.to || "") : !sameMoney(cur, x.to))) moved.push(x); }
    else if (x.kind === "product") { const cur = { title: p.title, description: p.description, status: p.status, seoTitle: p.seo.title, seoDescription: p.seo.description, template: p.template }[x.field]; if (String(cur || "") !== String(x.to || "")) moved.push(x); }
    else if (x.kind === "stock") { const v = p.variants.find((y) => y.item === x.item), at = v && v.stock.find((l) => l.location === x.location); if (!at || at.qty !== x.to) moved.push(x); }
    else if (x.kind === "collection") { if (p.collections.includes(x.collectionId) !== x.to) moved.push(x); }
    else if (x.kind === "photo") { const ph = p.photos.find((y) => y.id === x.mediaId); if (!ph || ph.alt !== x.to) moved.push(x); }
  }
  if (moved.length) throw shopError("Some of this has been changed again since (" + moved.length + (moved.length === 1 ? " part" : " parts") + "), so nothing was put back. Change those back by hand.", 409, true);
  const items = [];
  const byVariantProduct = {};
  for (const x of parts.filter((y) => y.kind === "variant")) (byVariantProduct[x.productId] = byVariantProduct[x.productId] || []).push(x);
  for (const [productId, list] of Object.entries(byVariantProduct)) {
    const per = {};
    for (const x of list) { per[x.variantId] = per[x.variantId] || { id: x.variantId }; if (x.field === "price") per[x.variantId].price = x.from; if (x.field === "was") per[x.variantId].compareAtPrice = x.from; if (x.field === "sku") per[x.variantId].inventoryItem = { sku: x.from || "" }; }
    const d = await shopify(site, VARIANTS_M, { productId, variants: Object.values(per) }); shopRefused(d.productVariantsBulkUpdate, "Putting the prices back");
    for (const x of list) items.push({ ...x, from: x.to, to: x.from });
  }
  for (const [productId, p] of Object.entries(products)) {
    const mine = parts.filter((x) => x.productId === productId && x.kind !== "variant");
    if (!mine.length) continue;
    const ch = { product: {}, variants: [], stock: [], add: [], remove: [], photos: [], order: null };
    for (const x of mine) {
      if (x.kind === "product") ch.product[x.field] = { from: x.to, to: x.from };
      if (x.kind === "stock") ch.stock.push({ item: x.item, version: x.version, location: x.location, place: x.place, from: x.to, to: x.from });
      if (x.kind === "collection") (x.from ? ch.add : ch.remove).push({ id: x.collectionId, title: x.collection });
      if (x.kind === "photo") ch.photos.push({ id: x.mediaId, from: x.to, to: x.from });
    }
    items.push(...await shopApply(site, p, ch));
  }
  entry.putBack = new Date().toISOString();
  const back = shopEntry(by, "Put back: " + entry.what, items); back.undoes = entry.id;
  await shopLogMark(site, entry.id, back);
  return { ok: true };
}
async function shopLogMark(site, id, back) {
  for (let i = 0; i < 3; i++) {
    const now = await shopLogRead(site);
    const entries = [back, ...now.entries.map((e) => e.id === id ? { ...e, putBack: back.when } : e)].slice(0, 300);
    const doc = { about: "Changes made to " + site.name + "'s Shopify products from Artiscope Digital Home, newest first. Each can be put back from the console.", entries };
    const w = await gh("/repos/" + CONSOLE_REPO + "/contents/" + shopLogPath(site), { method: "PUT", body: JSON.stringify({ message: "Shop: " + cleanText(back.what, 120) + " (by " + back.by + ")", content: encodeBase64Utf8(JSON.stringify(doc, null, 1) + "\n"), branch: SHOP_LOG_BRANCH, ...(now.sha ? { sha: now.sha } : {}) }) });
    if (w.ok) return true;
    if (w.status !== 409 && w.status !== 422) return false;
  }
  return false;
}

// ----- adding a product: a copy of one already there (its versions, prices and photos), or a blank one -----
const DUP_M = `mutation Dup($productId: ID!, $newTitle: String!) { productDuplicate(productId: $productId, newTitle: $newTitle, includeImages: true, newStatus: DRAFT) { newProduct { id title } userErrors { field message } } }`;
const CREATE_M = `mutation New($product: ProductCreateInput!) { productCreate(product: $product) { product { id title } userErrors { field message } } }`;
async function shopAdd(site, body, by) {
  const title = cleanText(body.title, 255).trim();
  if (!title) throw shopError("Give the new product a title.", 400);
  let made;
  if (body.from) {
    if (!isGid(body.from, "Product")) throw shopError("Choose the product to copy.", 400);
    const d = await shopify(site, DUP_M, { productId: body.from, newTitle: title }); made = shopRefused(d.productDuplicate, "Copying the product").newProduct;
  } else {
    const d = await shopify(site, CREATE_M, { product: { title, status: "DRAFT" } }); made = shopRefused(d.productCreate, "Adding the product").product;
  }
  if (!made || !made.id) throw shopError("Shopify did not say which product it made. Look in the list before trying again.");
  await shopLogAdd(site, shopEntry(by, "Added " + title + (body.from ? " as a copy" : "") + ", as a draft", [{ kind: "note", productId: made.id, title, what: "Added as a draft" }]));
  return { ok: true, id: made.id };
}

// ----- a new photo: Shopify gives a place to send it, then the photo joins the product -----
const STAGE_M = `mutation Stage($input: [StagedUploadInput!]!) { stagedUploadsCreate(input: $input) { stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } } }`;
const MEDIA_M = `mutation Media($product: ProductUpdateInput!, $media: [CreateMediaInput!]) { productUpdate(product: $product, media: $media) { product { id } userErrors { field message } } }`;
async function shopPhoto(site, body, by) {
  if (!isGid(body.id, "Product")) throw shopError("That product is not known.", 400);
  const content = String(body.content || ""), ext = String(body.ext || "").toLowerCase();
  if (!["jpg", "jpeg", "png", "webp"].includes(ext)) throw shopError("Use a JPG, PNG or WebP photo.", 400);
  if (!content || content.length > 13_500_000 || /[^A-Za-z0-9+/=]/.test(content)) throw shopError("That photo is too large or could not be read. Keep photos under 10 MB.", 400);
  const alt = cleanText(body.alt, 500).trim();
  if (!alt) throw shopError("Say what the photo shows. It is read out to people who cannot see it.", 400);
  const bytes = Uint8Array.from(atob(content), (c) => c.charCodeAt(0)), mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const name = (slugFrom(cleanText(body.name, 80).replace(/\.[a-z0-9]+$/i, "")) || "photo") + "." + (ext === "jpeg" ? "jpg" : ext);
  const d = await shopify(site, STAGE_M, { input: [{ filename: name, mimeType: mime, httpMethod: "POST", resource: "PRODUCT_IMAGE", fileSize: String(bytes.length) }] });
  const target = shopRefused(d.stagedUploadsCreate, "Sending the photo").stagedTargets[0];
  if (!target || !/^https:\/\//.test(String(target.url || ""))) throw shopError("Shopify did not give a place to send the photo. Please try again.");
  const form = new FormData();
  for (const p of target.parameters || []) form.append(p.name, p.value);
  form.append("file", new Blob([bytes], { type: mime }), name);
  let up;
  try { up = await fetch(target.url, { method: "POST", body: form }); } catch (_e) { up = null; }
  if (!up || !up.ok) throw shopError("The photo could not be sent to Shopify. Please try again.");
  const m = await shopify(site, MEDIA_M, { product: { id: body.id }, media: [{ originalSource: target.resourceUrl, alt, mediaContentType: "IMAGE" }] });
  shopRefused(m.productUpdate, "Adding the photo");
  await shopLogAdd(site, shopEntry(by, "Added a photo to " + cleanText(body.title, 120), [{ kind: "note", productId: body.id, title: cleanText(body.title, 255), what: "Photo added: " + alt }]));
  return { ok: true };
}

export async function shopAction(site, action, body, by) {
  if (action === "shopProducts") {
    const first = await shopify(site, LIST_Q, { after: null });
    const nodes = [...((first.products && first.products.nodes) || [])]; let page = first.products && first.products.pageInfo;
    for (let i = 0; i < 20 && page && page.hasNextPage; i++) { const d = await shopify(site, LIST_Q, { after: page.endCursor }); nodes.push(...((d.products && d.products.nodes) || [])); page = d.products && d.products.pageInfo; }
    return { products: nodes.map(shopListed), collections: shopCollections(first), currency: first.shop ? first.shop.currencyCode : "GBP", store: site.shop.store };
  }
  if (action === "shopProduct") return { product: await shopReadOne(site, String(body.id || "")) };
  if (action === "shopSave") {
    const now = await shopReadOne(site, String(body.id || ""));
    const ch = shopCleanChange(body.change, now);
    const items = await shopApply(site, now, ch);
    if (!items.length) return { ok: true, nothing: true, product: now };
    const logged = await shopLogAdd(site, shopEntry(by, shopSay(items, now.title), items));
    return { ok: true, logged, product: await shopReadOne(site, now.id) };
  }
  if (action === "shopPricePlan") return { plan: await shopPricePlan(site, body) };
  if (action === "shopPriceApply") return await shopPriceApply(site, body, by);
  if (action === "shopChanges") {
    const log = await shopLogRead(site), id = String(body.id || "");
    return { changes: log.entries.filter((e) => !id || e.items.some((x) => x.productId === id)).slice(0, 100) };
  }
  if (action === "shopPutBack") return await shopPutBack(site, body, by);
  if (action === "shopAdd") return await shopAdd(site, body, by);
  if (action === "shopPhoto") return await shopPhoto(site, body, by);
  throw shopError("Unknown request.", 400);
}

export async function handle(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  // The clock (a timed job in GitHub) calls with its own key to publish what was kept for later.
  const clockKey = req.headers && req.headers.get ? req.headers.get("x-schedule-key") : "";
  if (clockKey) {
    const want = env("SCHEDULE_KEY");
    if (!want || want.length < 24 || !sameText(clockKey, want)) return json({ error: "Not allowed." }, 403);
    if (!env("GITHUB_TOKEN")) return json({ error: "The GitHub connection has not been set up yet." }, 500);
    await loadSiteList();
    return json(await runLater(new Date()));
  }

  const email = await signedInEmail(req);
  if (!email) return json({ error: "Please sign in again." }, 401);
  await loadSiteList();
  let me = await personOf(email);
  if (!me) return json({ error: "This email address does not have access yet. Ask the admin to invite you in People. If you were invited, sign in with the same email address the invitation went to." }, 403);
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
    const names = await namesFor(me);
    if (!me.admin) await db("people?email=eq." + encodeURIComponent(email), { method: "PATCH", body: JSON.stringify({ last_seen: new Date().toISOString() }) });
    const mine = SITES.filter((s) => me.sites.includes(s.id));
    const sites = await Promise.all(mine.map((s) => siteOverview(s, String(wanted[s.id] || ""), asOn(me, s), names)));
    return json({ user: { email, admin: me.admin, name: me.name }, sites });
  }

  // ----- people: only the admin adds, changes and removes them -----
  if (["people", "invitePerson", "updatePerson", "removePerson", "resendInvite"].includes(action)) {
    if (!me.admin) return json({ error: "Only the admin can manage people." }, 403);
    if (!dbKeys().length) return json({ error: "People are not set up yet. The database key is missing." }, 500);
    const sites = SITES.map((s) => ({ id: s.id, name: s.name, live: s.live }));
    if (action === "people") {
      const r = await db("people?select=email,name,sites,invited_at,last_seen&order=invited_at.asc");
      if (!r.ok) return json({ error: r.status === 404 ? "People are not set up yet. Run the setup line in Supabase first." : dbRefused(r) ? GRANT_HELP : "The list of people could not be read." + dbSaid(r) }, 502);
      return json({ people: r.data.map((p) => ({ email: p.email, name: p.name, sites: p.sites, invited: p.invited_at, lastSeen: p.last_seen })), sites });
    }
    const who = String(body.email || "").trim().toLowerCase();
    if (!EMAIL_OK.test(who)) return json({ error: "That does not look like an email address." }, 400);
    if (isAllowed(who)) return json({ error: "That is the admin's address." }, 400);
    if (action === "invitePerson") {
      const p = cleanPerson(body);
      const r = await db("people", { method: "POST", body: JSON.stringify({ email: who, id: newTag(), name: p.name, sites: p.sites }) });
      if (r.status === 409) return json({ error: "That person is already in People." }, 409);
      if (!r.ok) return json({ error: dbRefused(r) ? GRANT_HELP : "The person could not be added." + dbSaid(r) }, 502);
      return json({ ok: true, emailed: await sendSignIn(who, body.back) });
    }
    if (action === "updatePerson") {
      const p = cleanPerson(body);
      const r = await db("people?email=eq." + encodeURIComponent(who), { method: "PATCH", body: JSON.stringify({ name: p.name, sites: p.sites }) });
      if (!r.ok || !Array.isArray(r.data) || !r.data.length) return json({ error: "That person is not in People." }, 404);
      return json({ ok: true });
    }
    if (action === "resendInvite") {
      const r = await db("people?select=email&email=eq." + encodeURIComponent(who));
      if (!r.ok || !Array.isArray(r.data) || !r.data.length) return json({ error: "That person is not in People." }, 404);
      return json({ ok: true, emailed: await sendSignIn(who, body.back) });
    }
    // removePerson: they cannot sign in from their next click. What they saved stays.
    const r = await db("people?email=eq." + encodeURIComponent(who), { method: "DELETE" });
    if (!r.ok) return json({ error: "The person could not be removed. Please try again." }, 502);
    return json({ ok: true });
  }

  // ----- Start building: a site still to build, or the practice build -----
  if (action === "planSite" || action === "createSite") {
    const card = SITES.find((x) => x.id === String(body.site || ""));
    if (!card || !me.sites.includes(card.id)) return json({ error: "That site is not available." }, 400);
    const allowed = card.playground ? asOn(me, card).admin && card.live : me.admin && !card.live && !card.repo;
    if (!allowed) return json({ error: card.playground ? "The practice build is not ready yet." : card.live ? "That site is already built." : "Only the admin can start building a site." }, 403);
    try {
      if (action === "planSite") { const plan = await planSite(card, body.choices); return json({ ok: true, plan, spec: buildSpec(plan.choices.template) }); }
      const r = await createSite(card, body.choices, me.tag || "admin");
      return json(r, r.error ? 502 : 200);
    } catch (e) { return json({ error: String(e && e.message || e) }, 400); }
  }

  // ----- a shop on Shopify: products, prices, stock and photos -----
  if (action.startsWith("shop")) {
    const shopSite = SITES.find((x) => x.id === String(body.site || "") && x.shop);
    if (!shopSite || !me.sites.includes(shopSite.id)) return json({ error: "That shop is not available." }, 400);
    if (!me.admin) return json({ error: "Only the admin can change the shop for now." }, 403);
    try { return json(await shopAction(shopSite, action, body, me.tag || "admin")); }
    catch (e) { return json({ error: String(e && e.message || e), stale: !!(e && e.stale) }, e && e.status || 502); }
  }

  const site = liveSite(String(body.site || ""));
  if (!site) return json({ error: "That site is not available." }, 400);
  if (!me.sites.includes(site.id)) return json({ error: "That site is not one of yours." }, 403);
  // On the practice build, everyone given it works as the admin does: it is there to try things.
  me = asOn(me, site);

  // ----- content -----
  const col = (site.collections || []).find((c) => c.id === body.collection) || null;
  const who = " (by " + me.tag + ")";

  // Which copy of the site this request is about, and the branch that goes with it.
  const WRITES = ["saveTheme", "saveEntry", "setHidden", "deleteEntry", "removePhoto", "undo", "uploadPhoto", "savePages", "saveFiles"];
  const COPY_ACTIONS = ["codeOpen", "codeSave", "codeStatus", "makeCopy", "scheduleCopy", "deleteCopy", "refreshCopy", "publish", "discard", "undoStep", "redoStep", "restoreVersion"];
  const DRAFT_ACTIONS = ["answerTopic", "publishDraft", "returnDraft", "rejectDraft", "history"];
  if (!me.admin && DRAFT_ACTIONS.includes(action)) return json({ error: "Only the admin can do that." }, 403);
  let copies = [], copy = null, ref = "main";
  if (!DRAFT_ACTIONS.includes(action)) {
    copies = await copiesOf(site);
    if (!me.admin) {
      // An editor works only on their own copy. They can read the live site, and publish their copy.
      const mine = ownCopyId(me.tag);
      copies = copies.filter((c) => c.kind === "live" || c.id === mine);
      if (action === "makeCopy") {
        if (copies.some((c) => c.id === mine)) return json({ ok: true, copy: mine });
        const sha = await mainSha(site);
        const made = await gh("/repos/" + site.repo + "/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/adh/" + mine, sha }) });
        if (!sha || !made.ok) return json({ error: writeProblem(made, "GitHub did not make your copy. Please try again.") }, 502);
        return json({ ok: true, copy: mine });
      }
    }
    copy = pickCopy(copies, String(body.copy || ""));
    if (!copy) return json({ error: "That trial copy is no longer there. Refresh and choose again." }, 409);
    if (!me.admin && (WRITES.includes(action) || COPY_ACTIONS.includes(action)) && copy.id !== ownCopyId(me.tag)) {
      return json({ error: "Editors work on their own copy. Open your copy to make changes." }, 403);
    }
    if (!me.admin && action === "deleteCopy") return json({ error: "Your copy is kept for you. Only the admin can delete it." }, 403);
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

  // Writes several files as one step, which one Undo takes back.
  const repoPath = "/repos/" + site.repo;
  async function textBlob(tree, path, data) {
    const b = await gh(repoPath + "/git/blobs", { method: "POST", body: JSON.stringify({ content: encodeBase64Utf8(JSON.stringify(data, null, 2) + "\n"), encoding: "base64" }) });
    if (!b.ok) throw new Error(writeProblem(b, "GitHub did not save the change. Please try again."));
    tree.push({ path, mode: "100644", type: "blob", sha: b.data.sha });
  }
  async function photoBlob(tree, path, content) {
    content = String(content || "");
    if (!content || content.length > 7_500_000 || /[^A-Za-z0-9+/=]/.test(content)) throw Object.assign(new Error("One of the photos is too large or could not be read."), { status: 400 });
    const b = await gh(repoPath + "/git/blobs", { method: "POST", body: JSON.stringify({ content, encoding: "base64" }) });
    if (!b.ok) throw new Error(writeProblem(b, "GitHub did not accept the photo. Please try again."));
    tree.push({ path, mode: "100644", type: "blob", sha: b.data.sha });
  }
  async function commitTree(tree, message) {
    const head = await gh(repoPath + "/git/ref/heads/" + ref);
    const headSha = head.ok && head.data.object ? head.data.object.sha : "";
    const headCommit = headSha ? await gh(repoPath + "/git/commits/" + headSha) : null;
    if (!headCommit || !headCommit.ok) return json({ error: "The site could not be read. Please try again." }, 502);
    const made = await gh(repoPath + "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: headCommit.data.tree.sha, tree }) });
    if (!made.ok) return json({ error: writeProblem(made, "GitHub did not save the change. Please try again.") }, 502);
    if (made.data.sha === headCommit.data.tree.sha) return null;
    const commit = await gh(repoPath + "/git/commits", { method: "POST", body: JSON.stringify({ message: message + who, tree: made.data.sha, parents: [headSha] }) });
    if (!commit.ok) return json({ error: writeProblem(commit, "GitHub did not save the change. Please try again.") }, 502);
    const moved = await moveBranch(site, ref, commit.data.sha, false);
    if (!moved.ok) return json({ error: "Someone else changed this site at the same moment. Refresh and try again." }, 409);
    return null;
  }
  const failed = (e) => json({ error: e.message || "GitHub did not save the change. Please try again." }, e.status || 502);
  // Global Art Monitor keeps its words, sales and picture notes in three files.
  // What the page fields may refer to: the artists and articles as they are now.
  function pageCtx(editorData) {
    if (!editorData) return site;
    return { ...site, artists: (editorData.artists || []).map((a) => ({ slug: a.slug, name: a.name })), articleSlugs: (editorData.articles || []).map((a) => a.slug) };
  }

  if (action === "pages" || action === "savePages") {
    const ps = site.pages;
    if (!ps || !site.sectionKinds) return json({ error: "This site cannot be edited by sections yet." }, 400);
    const f = await loadJson(ps.file);
    if (!f) return json({ error: "The page list could not be read." }, 502);
    const c = ps.content ? await loadJson(ps.content) : null;
    const gamNow = site.model ? await site.model.load(loadJson, gh, repoPath, ref) : null;
    if (site.model && !gamNow) return json({ error: "The site's words could not be read." }, 502);
    const editorNow = site.model ? site.model.forEditor(gamNow) : c && site.items ? siteForEditor(c.data) : null;
    const pctx = pageCtx(editorNow);
    const version = [f.sha, c ? c.sha : "", ...(gamNow ? gamNow.shas : [])].join(".");
    if (action === "savePages" && body.version && body.version !== version && !body.replace) {
      return json({ error: "Someone else changed this site while you were editing, perhaps the website agent or another person. Your changes are still here and have not been saved.", stale: true }, 409);
    }
    if (action === "pages") {
      const [imgs, meta] = await Promise.all([
        gh("/repos/" + site.repo + "/contents/" + ps.images + "?ref=" + encodeURIComponent(ref)),
        ps.meta ? loadJson(ps.meta) : null,
      ]);
      const files = Array.isArray(imgs.data) ? imgs.data.filter((x) => x.type === "file" && /\.(jpe?g|png|webp|mp4)$/i.test(x.name)) : [];
      const images = files.map((x) => x.name), imageSizes = Object.fromEntries(files.map((x) => [x.name, x.size || 0]));
      // A copy's own preview is built a minute or two after the copy is made. Until then the editor
      // draws the copy's pages on top of the live site, rather than showing GitHub's "not found" page.
      let preview = copy.kind === "trial" ? copy.preview : "https://" + site.domain + "/", previewWaiting = false;
      if (copy.kind === "trial" && await pageMissing(preview)) { preview = "https://" + site.domain + "/"; previewWaiting = true; }
      // a site just made in the console: its first publish takes a minute or two to appear
      else if (copy.kind !== "trial" && site.starter && await pageMissing(preview)) previewWaiting = "first";
      const pictures = c ? pictureSpots(c.data).filter((x) => x.kind !== "work").map(publicSpot) : [];
      const imageMeta = meta && meta.data && meta.data.files && typeof meta.data.files === "object" ? meta.data.files : {};
      let doc = f.data; try { doc = cleanPages(pctx, f.data, f.data); } catch (_e) { /* shown as it is */ }
      const extra = editorNow ? { site: editorNow, itemKinds: site.items, lists: Object.fromEntries(Object.entries(site.lists || {}).map(([k, l]) => [k, { label: l.label, section: l.section || "" }])), paths: site.paths || null, listFields: LIST_FIELDS, gam: !!site.model, model: site.model ? site.model.id : "", builtIn: site.builtIn || null,
        pageFields: site.model ? [{ name: "title", label: "Title in the browser tab and search results", type: "text" }, { name: "description", label: "Description for search engines", type: "long", plain: true, hint: "One or two sentences. Not shown on the page." }] : null } : {};
      return json({ pages: doc, wordSpec: wordSpec(site), addonSpec: ADDONS.map((a) => ({ id: a.id, label: a.label, about: a.about, icon: a.icon, fields: a.fields })), kinds: kindsFor(site), summaries: summariesFor(site, doc), images, imageSizes, imageMeta, pictures, imageBase: preview + ps.images + "/", previewWaiting, artists: editorNow ? editorNow.artists.map((a) => ({ slug: a.slug, name: a.name })) : site.artists, preview, sha: f.sha, version, ...extra });
    }
    // the page fields may refer to artists and articles added in this same save
    const sctx = body.content && typeof body.content === "object" ? pageCtx(body.content) : pctx;
    let next;
    try { next = cleanPages(sctx, body.pages, f.data); } catch (e) { return json({ error: e.message }, 400); }
    let was; try { was = cleanPages(sctx, f.data, f.data); } catch (_e) { was = f.data; }
    const what = cleanText(body.what, 80) || "Edit page";
    const uploads = Array.isArray(body.uploads) ? body.uploads.slice(0, 12) : [];
    const pics = body.pictures && typeof body.pictures === "object" && !Array.isArray(body.pictures) ? body.pictures : {};
    const hasSite = !!(body.content && typeof body.content === "object" && site.items);
    const hasPics = Object.keys(pics).length > 0 || hasSite;
    if (canon(next) === canon(was) && !uploads.length && !hasPics) return json({ ok: true, unchanged: true });
    if (!uploads.length && !hasPics) {
      const put = await saveJson(ps.file, next, f.sha, "Edit page: " + what);
      if (put.status === 409) return json({ error: "Someone else changed this page at the same moment. Refresh and try again." }, 409);
      if (!put.ok) return json({ error: writeProblem(put, "GitHub did not save the page. Please try again.") }, 502);
      return json({ ok: true, summaries: summariesFor(site, next) });
    }
    if (hasPics && !c && !site.model) return json({ error: "The pictures of this site could not be read." }, 502);
    // New photos, shared pictures and the page go in together, as one step that one Undo takes back.
    const tree = [], renamed = {};
    try {
      const listing = await gh(repoPath + "/contents/" + ps.images + "?ref=" + encodeURIComponent(ref));
      const taken = Array.isArray(listing.data) ? listing.data.map((x) => x.name) : [];
      for (const u of uploads) {
        const name = photoFileName(u && u.name, u && u.ext, taken); taken.push(name);
        renamed[String((u && u.key) || "")] = name;
        await photoBlob(tree, ps.images + "/" + name, u && u.content);
      }
    } catch (e) { return failed(e); }
    // point everything at the photos' final names
    const fix = (v) => { if (Array.isArray(v)) return v.map(fix); if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = fix(v[k]); return o; } return typeof v === "string" && renamed[v] ? renamed[v] : v; };
    let withPhotos, picsFixed = fix(pics), res = { done: [], slotsChanged: false };
    try { withPhotos = cleanPages(sctx, fix(body.pages), f.data); } catch (e) { return json({ error: e.message }, 400); }
    const slots = hasPics ? await loadJson("image-slots.json") : null;
    let items = { changed: [] }; const gamFiles = [];
    if (hasSite && site.model) {
      let r; try { r = site.model.fromEditor(site.items, fix(body.content), gamNow, Object.values(renamed)); } catch (e) { return json({ error: e.message }, 400); }
      items = { changed: r.changed };
      for (const x of r.files) gamFiles.push(x);
    } else if (hasSite) {
      try { items = cleanSite(site.items, fix(body.content), c.data); } catch (e) { return json({ error: e.message }, 400); }
      if (items.changed.length) { c.data = items.data; if (slots) keepSlots(slots.data, c.data); }
    }
    if (hasPics && c && Object.keys(pics).length) { try { res = applyPictures(c.data, picsFixed, slots ? slots.data : null); } catch (e) { return json({ error: e.message }, 400); } }
    if (items.changed.length) res.done = res.done.concat(items.changed);
    if (!uploads.length && !res.done.length && canon(withPhotos) === canon(was)) return json({ ok: true, unchanged: true });
    try {
      if (canon(withPhotos) !== canon(was)) await textBlob(tree, ps.file, withPhotos);
      if (res.done.length && c && !site.model) await textBlob(tree, ps.content, c.data);
      for (const [path, data] of gamFiles) await textBlob(tree, path, data);
      if ((res.slotsChanged || items.changed.length) && slots && !site.model) await textBlob(tree, "image-slots.json", slots.data);
      // a new photo keeps the description it was given, for next time it is chosen
      if (uploads.length && ps.meta) {
        const m = await loadJson(ps.meta);
        const doc = m && m.data && typeof m.data === "object" ? m.data : { note: "Descriptions and captions of the photos in " + ps.images + "/, kept by Artiscope Digital Home." };
        if (!doc.files || typeof doc.files !== "object") doc.files = {};
        let wrote = false;
        for (const name of Object.values(renamed)) {
          let alt = "", caption = "";
          const find = (x) => { if (Array.isArray(x)) return x.forEach(find); if (!x || typeof x !== "object") return; if (!alt && Object.keys(x).some((k) => k !== "alt" && x[k] === name) && x.alt) { alt = cleanText(x.alt, 240); caption = cleanText(x.caption, 160); } Object.values(x).forEach(find); };
          find(withPhotos); find(picsFixed); if (hasSite) find(fix(body.content));
          if (alt) { doc.files[name] = { alt, caption }; wrote = true; }
        }
        if (wrote) await textBlob(tree, ps.meta, doc);
      }
    } catch (e) { return failed(e); }
    const onlyItems = items.changed.length && canon(withPhotos) === canon(was) && !uploads.length;
    const label = onlyItems ? (items.changed.length === 1 && res.done.length === 1 ? items.changed[0] : "Edit: " + what).slice(0, 120)
      : res.done.length && canon(withPhotos) === canon(was) && !uploads.length ? "Edit picture: " + res.done.join(", ").slice(0, 80) : "Edit page: " + what;
    const problem = await commitTree(tree, label);
    if (problem) return problem;
    return json({ ok: true, photos: renamed, summaries: summariesFor(site, withPhotos) });
  }

  // ----- Files: every photo on the site, its description and where it is used -----
  if (action === "files" || action === "saveFiles") {
    const ps = site.pages;
    if (!ps || !ps.images || !ps.meta) return json({ error: "This site keeps its photos another way for now. Use Photos." }, 400);
    const [listing, pf, cf, mf] = await Promise.all([
      gh(repoPath + "/contents/" + ps.images + "?ref=" + encodeURIComponent(ref)),
      loadJson(ps.file), ps.content ? loadJson(ps.content) : null, loadJson(ps.meta),
    ]);
    const files = Array.isArray(listing.data) ? listing.data.filter((x) => x.type === "file" && /\.(jpe?g|png|webp)$/i.test(x.name)) : [];
    const metaDoc = mf && mf.data && typeof mf.data === "object" && !Array.isArray(mf.data) ? mf.data : { note: "Descriptions and captions of the photos in " + ps.images + "/, kept by Artiscope Digital Home." };
    if (!metaDoc.files || typeof metaDoc.files !== "object") metaDoc.files = {};
    const meta = metaDoc.files, kinds = site.sectionKinds || {};
    const pagesDoc = pf ? pf.data : { shared: {}, pages: {} };
    const gamNow = site.model ? await site.model.load(loadJson, gh, repoPath, ref) : null;
    const spots = gamNow ? site.model.spots(gamNow) : cf ? pictureSpots(cf.data) : [];
    if (action === "files") {
      const preview = copy.kind === "trial" ? copy.preview : "https://" + site.domain + "/";
      return json({
        files: files.map((x) => ({ name: x.name, size: x.size || 0, alt: (meta[x.name] || {}).alt || "", caption: (meta[x.name] || {}).caption || "", used: usageOf(x.name, pagesDoc, kinds, spots) })),
        spots: spots.filter((x) => !x.hidden).map(publicSpot),
        imageBase: preview + ps.images + "/",
      });
    }
    const op = String(body.op || ""), names = files.map((x) => x.name), name = String(body.name || "");
    const tree = [];
    let message = "", out = {};
    try {
      if (op === "add") {
        const final = photoFileName(body.fileName, body.ext, names);
        await photoBlob(tree, ps.images + "/" + final, body.content);
        const alt = cleanText(body.alt, 240), caption = cleanText(body.caption, 160);
        if (alt || caption) { meta[final] = { alt, caption }; await textBlob(tree, ps.meta, metaDoc); }
        message = "Add photo: " + final; out = { name: final };
      } else {
        if (!names.includes(name)) return json({ error: "That photo is no longer on the site. Refresh and try again." }, 409);
        if (op === "describe") {
          const alt = cleanText(body.alt, 240), caption = cleanText(body.caption, 160);
          if (alt || caption) meta[name] = { alt, caption }; else delete meta[name];
          await textBlob(tree, ps.meta, metaDoc);
          // places that show this photo without a description get this one
          if (alt) {
            if (pf && fillDescriptions(pagesDoc.pages, name, alt) + fillDescriptions(pagesDoc.shared, name, alt) + fillDescriptions(pagesDoc.groups || {}, name, alt) + fillDescriptions(pagesDoc.templates || {}, name, alt)) await textBlob(tree, ps.file, pagesDoc);
            if (cf && spots.some((sp) => sp.image === name && !String(sp.alt || "").trim())) {
              const ch = {}; spots.forEach((sp) => { if (sp.image === name && !String(sp.alt || "").trim()) ch[sp.key] = { alt }; });
              if (applyPictures(cf.data, ch, null).done.length) await textBlob(tree, ps.content, cf.data);
            }
          }
          message = "Photo description: " + name;
        } else if (op === "replace") {
          const want = /\.png$/i.test(name) ? "png" : "jpg";
          if ((body.ext === "png" ? "png" : "jpg") !== want) return json({ error: "Please choose a " + want.toUpperCase() + " photo to replace a " + want.toUpperCase() + " photo." }, 400);
          await photoBlob(tree, ps.images + "/" + name, body.content);
          message = "Replace photo: " + name;
        } else if (op === "remove") {
          if (usageOf(name, pagesDoc, kinds, spots).length) return json({ error: "This photo is still used on the site. Take it out of those places first." }, 409);
          tree.push({ path: ps.images + "/" + name, mode: "100644", type: "blob", sha: null });
          if (meta[name]) { delete meta[name]; await textBlob(tree, ps.meta, metaDoc); }
          message = "Remove photo: " + name;
        } else if (op === "assign" && gamNow && site.gam) {
          const sp = spots.find((x) => x.key === String(body.spot || ""));
          if (!sp) return json({ error: "That place is no longer on the site. Refresh and try again." }, 409);
          const alt = cleanText(body.alt, 240) || (meta[name] || {}).alt || "";
          if (!alt) return json({ error: "Please describe the picture first. It is read out to people who cannot see it." }, 400);
          const im = JSON.parse(JSON.stringify(gamNow.images || {})), slug = sp.key.slice(7);
          im[slug] = { ...(im[slug] || {}), alt, file: name };
          await textBlob(tree, "data/images.json", im);
          message = "Edit picture: " + sp.label;
        } else if (op === "assign") {
          if (!cf) return json({ error: "The pictures of this site could not be read." }, 502);
          const sp = spots.find((x) => x.key === String(body.spot || ""));
          if (!sp) return json({ error: "That place is no longer on the site. Refresh and try again." }, 409);
          const alt = cleanText(body.alt, 240) || (meta[name] || {}).alt || "";
          if (!alt) return json({ error: "Please describe the picture first. It is read out to people who cannot see it." }, 400);
          const slots = await loadJson("image-slots.json");
          const res = applyPictures(cf.data, { [sp.key]: { image: name, alt } }, slots ? slots.data : null);
          if (!res.done.length) return json({ ok: true, unchanged: true });
          await textBlob(tree, ps.content, cf.data);
          if (res.slotsChanged && slots) await textBlob(tree, "image-slots.json", slots.data);
          message = "Edit picture: " + sp.label;
        } else return json({ error: "Unknown request." }, 400);
      }
    } catch (e) { return failed(e); }
    if (!tree.length) return json({ ok: true, unchanged: true });
    const problem = await commitTree(tree, message);
    return problem || json({ ok: true, ...out });
  }

  if (action === "theme" || action === "saveTheme") {
    const spec = site.theme;
    if (!spec) return json({ error: "This site has no theme settings yet." }, 400);
    const f = await loadJson(spec.file);
    let current;
    try { current = cleanTheme(spec, f ? f.data : {}); } catch (_e) { current = cleanTheme(spec, {}); }
    if (action === "theme") {
      return json({ spec: { colours: spec.colours, fonts: spec.fonts, looks: spec.looks || [], fontRequests: FONTS, url: "https://" + site.domain + "/", settings: THEME_SETTINGS.filter((x) => !x.only || (spec.look || {})[x.only]), look: spec.look || {}, imageBase: "https://" + site.domain + "/" + site.pages.images + "/" }, values: current });
    }
    let next;
    try { next = cleanTheme(spec, body.values); } catch (e) { return json({ error: e.message }, 400); }
    if (JSON.stringify(next) === JSON.stringify(current)) return json({ ok: true, unchanged: true });
    const changed = [];
    for (const c of spec.colours) if (next.colours[c.id] !== current.colours[c.id]) changed.push(c.label.toLowerCase());
    for (const x of spec.fonts) if (next.fonts[x.id] !== current.fonts[x.id]) changed.push(x.label.toLowerCase() + " typeface");
    for (const x of THEME_SETTINGS) if (JSON.stringify(next.settings[x.name]) !== JSON.stringify(current.settings[x.name])) changed.push((x.group === x.label ? x.label : x.group + " " + x.label).toLowerCase());
    const put = await saveJson(spec.file, themeFile(site, spec, next), f ? f.sha : undefined, "Theme: " + changed.join(", ").slice(0, 120));
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
      try { changed = applyEntry(x, col, body.values || {}); }
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

  if (action === "history") {
    const names = await namesFor(me);
    const r = await gh("/repos/" + site.repo + "/commits?per_page=30");
    if (!r.ok || !Array.isArray(r.data)) return json({ error: "The history could not be read." }, 502);
    return json({
      changes: r.data.map((c) => {
        const first = String(c.commit.message || "").split("\n")[0];
        return { sha: c.sha, what: whatOf(first), when: c.commit.author ? c.commit.author.date : "", by: nameOf(byOf(first), me, names) || (c.commit.author ? c.commit.author.name : ""), canUndo: UNDOABLE.test(first) };
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
    const commit = await gh("/repos/" + site.repo + "/git/commits", { method: "POST", body: JSON.stringify({ message: "Undo: " + whatOf(first) + who, tree: made.data.sha, parents: [headSha] }) });
    if (!commit.ok) return json({ error: writeProblem(commit, "GitHub did not save the undo.") }, 502);
    const moved = await moveBranch(site, ref, commit.data.sha, false);
    if (!moved.ok) return json({ error: writeProblem(moved, "GitHub did not save the undo.") }, 502);
    return json({ ok: true });
  }

  // ----- copies: trial copies, undo and redo, publish -----
  // The admin starts the Practice site again: its words, pages, theme and photos become World Art Review's.
  // The practice build starts again from the starter: every page, the look, the words, the photos and any
  // code changes go, and so do its copies. Its publishing steps (.github) stay as they are.
  if (action === "checkDomain" || action === "finishSite") {
    if (!site.starter || site.playground) return json({ error: "Only a site built in the console can do that." }, 400);
    if (!me.admin) return json({ error: "Only the admin can do that." }, 403);
    const r = action === "checkDomain" ? await checkDomain(site, me.tag || "admin") : await finishSite(site, me.tag || "admin");
    return json(r, r.error ? 502 : 200);
  }
  if (action === "startAgain") {
    if (!site.playground) return json({ error: "Only the practice build can be started again like this." }, 400);
    if (!me.admin) return json({ error: "Only someone given the practice build can start it again." }, 403);
    const r = await starterInto({ ...site, dir: STARTER_DIR }, "Start again from the starter" + who);
    if (r.error) return json({ error: r.error }, 502);
    if (site.template && site.template !== "starter") {
      const err = await changeSiteList((list) => list.map((x) => { if (!x || x.id !== site.id) return x; const n = { ...x }; delete n.template; return n; }), "The practice build starts again from the starter" + who);
      if (err) return json({ error: err }, 502);
    }
    const found = await gh("/repos/" + site.repo + "/git/matching-refs/heads/adh/");
    for (const ref of Array.isArray(found.data) ? found.data : []) await gh("/repos/" + site.repo + "/git/" + String(ref.ref).replace(/^refs\//, "refs/"), { method: "DELETE" });
    return json({ ok: true });
  }
  if (action === "resetPractice") {
    if (!me.admin) return json({ error: "Only the admin can start the Practice site again." }, 403);
    if (!site.practice) return json({ error: "Only the Practice site can be started again." }, 400);
    const from = SITES.find((x) => x.id === site.from);
    const keep = (t) => t.type === "blob" && (CONTENT_FILES.includes(t.path) || /^images\/[^/]+$/.test(t.path));
    const [src, headSha] = await Promise.all([gh("/repos/" + from.repo + "/git/trees/main?recursive=1"), mainSha(site)]);
    const head = headSha ? await gh("/repos/" + site.repo + "/git/commits/" + headSha) : null;
    const have = headSha ? await gh("/repos/" + site.repo + "/git/trees/" + headSha + "?recursive=1") : null;
    if (!src.ok || !head || !head.ok || !have || !have.ok) return json({ error: "The sites could not be read from GitHub just now." }, 502);
    const wanted = src.data.tree.filter(keep), names = new Set(wanted.map((t) => t.path)), had = {};
    for (const t of have.data.tree) if (keep(t)) had[t.path] = t.sha;
    const tree = Object.keys(had).filter((p) => !names.has(p)).map((path) => ({ path, mode: "100644", type: "blob", sha: null }));
    for (const t of wanted) {
      if (had[t.path] === t.sha) continue;   // already the same
      const b = await gh("/repos/" + from.repo + "/git/blobs/" + t.sha);
      const made = b.ok ? await gh("/repos/" + site.repo + "/git/blobs", { method: "POST", body: JSON.stringify({ content: String(b.data.content || "").replace(/\n/g, ""), encoding: "base64" }) }) : b;
      if (!made.ok) return json({ error: writeProblem(made, "GitHub did not copy " + t.path + ".") }, 502);
      tree.push({ path: t.path, mode: "100644", type: "blob", sha: made.data.sha });
    }
    if (!tree.length) return json({ ok: true, unchanged: true });
    const madeTree = await gh("/repos/" + site.repo + "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: head.data.tree.sha, tree }) });
    if (!madeTree.ok) return json({ error: writeProblem(madeTree, "GitHub did not start the Practice site again.") }, 502);
    const commit = await gh("/repos/" + site.repo + "/git/commits", { method: "POST", body: JSON.stringify({ message: "Start again from " + from.name + who, tree: madeTree.data.sha, parents: [headSha] }) });
    if (!commit.ok) return json({ error: writeProblem(commit, "GitHub did not start the Practice site again.") }, 502);
    const moved = await moveBranch(site, "main", commit.data.sha, false);
    if (!moved.ok) return json({ error: writeProblem(moved, "GitHub did not start the Practice site again.") }, 502);
    return json({ ok: true });
  }

  if (action === "versions") {
    const [list, names] = await Promise.all([versionsOf(site), namesFor(me)]);
    return json({
      canGoBack: me.admin,
      versions: list.map((v, i) => ({ number: v.number, when: v.when, live: i === 0, by: nameOf(v.by, me, names), big: v.n[1] === 0,
        title: v.name.replace(new RegExp("^" + site.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " [0-9.]+(: )?"), ""),
        notes: v.notes.replace(/\n*<!-- by: [^>]* -->\s*$/, "") })),
    });
  }

  if (COPY_ACTIONS.includes(action)) {
    const repo = "/repos/" + site.repo;
    // ----- Edit code: the admin reads the site's own code and saves changes to the Code changes copy only -----
    if (action === "codeOpen" || action === "codeSave" || action === "codeStatus") {
      if (!me.admin) return json({ error: "Only the admin can edit code." }, 403);
      if (!site.code) return json({ error: "This site's code cannot be edited here yet." }, 400);
      const codeCopy = copies.find((c) => c.id === CODE_COPY) || null;
      if (action === "codeStatus") return json({ copy: !!codeCopy, ahead: codeCopy ? codeCopy.ahead : 0, preview: codeCopy ? codeCopy.preview : "", ...(codeCopy ? await codeCheck(site, codeCopy.sha) : { status: "none" }) });
      const at = codeCopy ? codeCopy.branch : "main";
      if (action === "codeOpen") {
        const files = [];
        for (const path of site.code.edit.concat(site.code.read)) {
          const f = await getText(site.repo, path, at);
          if (f) files.push({ path, edit: site.code.edit.includes(path), text: f.text });
        }
        return json({ files, copy: !!codeCopy, ahead: codeCopy ? codeCopy.ahead : 0, preview: codeCopy ? codeCopy.preview : "", ...(codeCopy ? await codeCheck(site, codeCopy.sha) : { status: "none" }) });
      }
      // codeSave: only the files that may be edited, each as plain text
      const given = Array.isArray(body.files) ? body.files.slice(0, 8) : [];
      if (!given.length) return json({ error: "Nothing to save." }, 400);
      for (const g of given) {
        if (!site.code.edit.includes(String(g && g.path))) return json({ error: "That file cannot be changed here." }, 400);
        if (typeof g.text !== "string" || g.text.length > 900000) return json({ error: "That file is too large to save here." }, 400);
      }
      if (!codeCopy) {
        const sha = await mainSha(site);
        const made = await gh(repo + "/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/adh/" + CODE_COPY, sha }) });
        if (!sha || !made.ok) return json({ error: writeProblem(made, "GitHub did not make the Code changes copy. Please try again.") }, 502);
      }
      let last = "";
      for (const g of given) {
        const cur = await getText(site.repo, g.path, "adh/" + CODE_COPY);
        if (cur && cur.text === g.text) continue;
        const put = await gh(repo + "/contents/" + g.path, { method: "PUT", body: JSON.stringify({ message: "Code: " + g.path + who, content: encodeBase64Utf8(g.text), sha: cur ? cur.sha : undefined, branch: "adh/" + CODE_COPY }) });
        if (!put.ok) return json({ error: writeProblem(put, "GitHub did not save " + g.path + ".") }, 502);
        last = put.data && put.data.commit ? put.data.commit.sha : last;
      }
      return json({ ok: true, status: last ? "checking" : "unchanged" });
    }
    // Publish later: a copy of the live site to save the changes on, published by the clock at that time.
    if (action === "scheduleCopy") {
      if (!me.admin) return json({ error: "Only the admin can publish later." }, 403);
      if (!env("SCHEDULE_KEY")) return json({ error: "The clock that publishes later is not set up yet, so nothing was kept. It needs the same long random key added as SCHEDULE_KEY in Supabase (Edge Functions, Secrets) and in GitHub (artiscope-digital-home, Settings, Secrets and variables, Actions). Your changes are still here." }, 400);
      const when = fromLondon(body.at);
      if (!when || when.getTime() < Date.now() + 5 * 60000) return json({ error: "Choose a time at least five minutes from now." }, 400);
      if (when.getTime() > Date.now() + 366 * 86400000) return json({ error: "Choose a time within the next year." }, 400);
      if (copies.filter((c) => laterOf(c.id)).length >= 5) return json({ error: "Five changes are already waiting to publish later. Publish or delete one first." }, 400);
      const sha = await mainSha(site), id = laterId(when);
      const made = await gh(repo + "/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/adh/" + id, sha }) });
      if (!sha || !made.ok) return json({ error: writeProblem(made, "GitHub did not keep the changes for later. Please try again.") }, 502);
      return json({ ok: true, copy: id, when: londonWhen(when) });
    }
    if (action === "makeCopy") {
      const slug = copySlug(body.name);
      if (!slug) return json({ error: "Give the trial copy a short name, for example Winter look." }, 400);
      if (copies.filter((c) => c.kind === "trial" && !ownerOfCopy(c.id) && !laterOf(c.id) && !/^trial-held-/.test(c.id) && c.id !== CODE_COPY).length >= MAX_TRIALS) return json({ error: "This site already has " + MAX_TRIALS + " trial copies. Delete one to make another." }, 400);
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
    if (action === "refreshCopy") {
      if (copy.kind !== "trial") return json({ ok: true, unchanged: true });
      // Start again: the copy becomes exactly the live site. Its unpublished work is let go (the console asks first).
      if (body.fresh) {
        await dropRedo(site, copy);
        const moved = await moveBranch(site, copy.branch, await mainSha(site), true);
        if (!moved.ok) return json({ error: writeProblem(moved, "GitHub did not start the copy again.") }, 502);
        return json({ ok: true });
      }
      if (copy.behind === 0) return json({ ok: true, unchanged: true });
      await dropRedo(site, copy);
      const m = copy.ahead === 0
        ? await moveBranch(site, copy.branch, await mainSha(site), false)
        : await gh(repo + "/merges", { method: "POST", body: JSON.stringify({ base: copy.branch, head: "main", commit_message: "Bring in the latest live changes" + who }) });
      if (m.status === 409) return json({ clash: true, error: "Your copy and the live site have both changed the same part, so they cannot be joined. You can publish yours over it, or start again from the live site." }, 409);
      if (!m.ok && m.status !== 204) return json({ error: writeProblem(m, "GitHub did not refresh the copy.") }, 502);
      return json({ ok: true });
    }

    if (action === "publish") {
      if (copy.kind !== "trial") return json({ ok: true, unchanged: true });
      if (copy.id === CODE_COPY) {
        const chk = await codeCheck(site, copy.sha);
        if (chk.status !== "passed") return json({ error: chk.status === "failed" ? "The code changes do not build yet, so they cannot be made live. Open Edit code to see what went wrong." : chk.status === "unknown" ? chk.why : "The code changes are still being checked. Try again in a minute or two." }, 400);
      }
      if (copy.ahead === 0) return json({ ok: true, unchanged: true });
      const before = await mainSha(site);
      const message = (copy.kind === "live" ? "Publish: " + copy.ahead + (copy.ahead === 1 ? " change" : " changes") : "Make live: " + copy.name) + who;
      let newSha = "";
      const m = await gh(repo + "/merges", { method: "POST", body: JSON.stringify({ base: "main", head: copy.branch, commit_message: message }) });
      if (m.ok && m.data && m.data.sha) newSha = m.data.sha;
      else if (m.status === 409) {
        if (!body.replace || copy.id === CODE_COPY) {   // code is never forced over live: it is joined by hand
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
      if (copy.id === CODE_COPY) await gh(repo + "/git/refs/heads/" + copy.branch, { method: "DELETE" });   // the next code change starts again from live
      else await moveBranch(site, copy.branch, newSha, true);   // the copy now matches live exactly
      const steps = copy.steps.map((x) => x.what).filter((w) => !/^(Merge|Bring in the latest)/.test(w)).slice(0, 20);
      return json({ ok: true, ...(await makeVersion(site, me, { before, sha: newSha, steps, note: body.note, big: body.big, title: "" })) });
    }

    if (action === "discard") return json({ error: "Nothing waits on the live site. Undo a step instead." }, 400);

    // On the live site, undo and redo add new commits that put earlier words back.
    async function restoreTo(sha, message) {
      const want = await gh(repo + "/git/trees/" + sha + "?recursive=1");
      const headSha = await mainSha(site);
      const head = headSha ? await gh(repo + "/git/commits/" + headSha) : null;
      const have = headSha ? await gh(repo + "/git/trees/" + headSha + "?recursive=1") : null;
      if (!want.ok || !head || !head.ok || !have.ok) return json({ error: "The earlier version could not be read." }, 502);
      const keep = (t) => t.type === "blob" && (CONTENT_FILES.includes(t.path) || /^(images|assets\/images|inbox)\/[^/]+$/.test(t.path));
      const wanted = {}; for (const t of want.data.tree) if (keep(t)) wanted[t.path] = t.sha;
      const tree = [];
      for (const t of have.data.tree) if (keep(t) && !(t.path in wanted)) tree.push({ path: t.path, mode: "100644", type: "blob", sha: null });
      for (const [path, blob] of Object.entries(wanted)) tree.push({ path, mode: "100644", type: "blob", sha: blob });
      const made = await gh(repo + "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: head.data.tree.sha, tree }) });
      if (!made.ok) return json({ error: writeProblem(made, "GitHub did not save the change.") }, 502);
      if (made.data.sha === head.data.tree.sha) return json({ ok: true, unchanged: true });
      const commit = await gh(repo + "/git/commits", { method: "POST", body: JSON.stringify({ message: message + "\n\nRestored-To: " + sha, tree: made.data.sha, parents: [headSha] }) });
      if (!commit.ok) return json({ error: writeProblem(commit, "GitHub did not save the change.") }, 502);
      const moved = await moveBranch(site, "main", commit.data.sha, false);
      if (!moved.ok) return json({ error: writeProblem(moved, "GitHub did not save the change. Please try again.") }, 502);
      return json({ ok: true });
    }
    if (action === "restoreVersion") {
      if (!me.admin) return json({ error: "Only the admin can go back to an earlier version." }, 403);
      const list = await versionsOf(site), v = list.find((x) => x.number === String(body.version || ""));
      if (!v || !v.sha) return json({ error: "That version could not be found." }, 404);
      if (v === list[0]) return json({ error: "That version is already live." }, 409);
      const before = await mainSha(site);
      const r = await restoreTo(v.sha, "Back to version " + v.number + who);
      if (r.status !== 200) return r;
      const out = await r.json(); if (out.unchanged) return json({ ok: true, unchanged: true });
      return json({ ok: true, ...(await makeVersion(site, me, { before, sha: await mainSha(site), steps: ["Back to version " + v.number + "."], note: body.note, title: "back to " + v.number })) });
    }
    if (action === "undoStep" && copy.kind === "live") {
      const n = Math.max(1, Math.min(20, Number(body.steps) || 1));
      if (copy.steps.length < n) return json({ error: "There is nothing more to undo." }, 409);
      const last = await gh(repo + "/git/commits/" + copy.steps[n - 1].sha);
      const parent = last.ok && last.data.parents && last.data.parents[0] ? last.data.parents[0].sha : "";
      if (!parent) return json({ error: "That step could not be undone." }, 502);
      if (!copy.canRedo) {
        const kept = await gh(repo + "/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/adh-redo/live", sha: copy.sha }) });
        if (!kept.ok) return json({ error: writeProblem(kept, "GitHub did not undo the step.") }, 502);
      }
      const what = n === 1 ? copy.steps[0].what : n + " steps";
      return await restoreTo(parent, "Undo: " + what + who);
    }
    if (action === "redoStep" && copy.kind === "live") {
      if (!copy.canRedo) return json({ error: "There is nothing to redo." }, 409);
      const tip = await gh(repo + "/git/ref/heads/adh-redo/live");
      const at = tip.ok && tip.data.object ? tip.data.object.sha : "";
      const out = at ? await restoreTo(at, "Redo: earlier steps" + who) : null;
      await dropRedo(site, copy);
      return out || json({ error: "There is nothing to redo." }, 409);
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
      const before = await mainSha(site);
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
      const steps = ["Website agent's draft: " + cleanText(pull.title, 120)];
      return json({ ok: true, ...(await makeVersion(site, me, { before, sha: (m.data && m.data.sha) || (await mainSha(site)), steps, title: "" })) });
    }

    const note = String(body.note || "").trim().slice(0, 2000);
    if (action === "returnDraft" && !note) return json({ error: "Please say what should change." }, 400);
    if (note) {
      const label = action === "returnDraft" ? "Sent back by the owner" : "Rejected by the owner";
      await gh(base + "/issues/" + pull.number + "/comments", {
        method: "POST",
        body: JSON.stringify({ body: label + ":\n\n" + note }),
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
          content: encodeBase64Utf8(JSON.stringify({ alt, caption, sent_by: me.tag }, null, 2) + "\n"),
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
