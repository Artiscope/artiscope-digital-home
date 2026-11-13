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
  footer: { label: "Newsletter and footer", about: "The sign-up band and the links at the bottom of every page.", summary: (st) => ((st.columns || []).length + " columns"), blocks: { field: "columns", label: "Column", add: "Add a column", title: (b) => b.title }, fields: [
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
  articles: { label: "Latest articles", about: "Article cards, filled in from Content.", summary: (st) => ((Number(st.count) || 3) + " from " + (st.section && st.section !== "all" ? st.section : "all")), library: "Fills itself from Content", fields: [EYEBROW, HEADING, { name: "section", label: "Which articles", type: "choice", options: [["all", "All"], ["reviews", "Reviews"], ["explained", "Art explained"], ["library", "Collector's library"], ["features", "Artist portfolios"]] }, { name: "count", label: "How many", type: "number" }, BG, FG],
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
const SECONDS = { name: "seconds", label: "Seconds before the next message", type: "number", group: "Look", hint: "Between 3 and 30. Only used with more than one message." };
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
const SLIDE_ROWS = { name: "slides", label: "Slides", type: "rows", fields: [PIC, PIC_ALT, { name: "caption", label: "Caption", type: "text", hint: "Such as the title, year and medium, and who took the photo. Leave empty for none." }] };
const SLIDE_BLOCK = { field: "slides", label: "Slide", add: "Add a slide", about: "One picture in the slideshow, with its caption." };
const SLIDE_LOOK = [{ name: "auto", label: "Move on by itself", type: "yesno", group: "Look", hint: "Every few seconds, until a visitor uses Previous or Next. Pictures stay still for people who ask their device for less motion." }, { name: "seconds", label: "Seconds on each slide", type: "number", group: "Look", hint: "Between 3 and 30." }];
const SLIDE_SUMMARY = (st) => { const n = (st.slides || []).filter((x) => x && !x.hidden).length; return n + (n === 1 ? " slide" : " slides"); };
const SLIDE_STARTER = { slides: [{ image: "", alt: "", caption: "" }, { image: "", alt: "", caption: "" }, { image: "", alt: "", caption: "" }], auto: true, seconds: 6 };
const PHOTO_ROWS = { name: "photos", label: "Photos", type: "rows", fields: [PIC, PIC_ALT, { name: "caption", label: "Title under the photo", type: "text", hint: "Leave empty for none." }, { name: "sub", label: "Small line", type: "text", hint: "Such as the year and medium. Leave empty for none." }] };
const PHOTO_BLOCK = { field: "photos", label: "Photo", add: "Add a photo", about: "One photo in the gallery. Visitors click it to see it larger." };
const PHOTO_PER_ROW = { name: "per_row", label: "Photos in a row", type: "choice", group: "Look", seg: true, dflt: "3", options: [["2", "Two"], ["3", "Three"], ["4", "Four"]], hint: "Two in a row on a phone." };
const PHOTO_SUMMARY = (st) => { const n = (st.photos || []).filter((x) => x && !x.hidden).length; return n + (n === 1 ? " photo" : " photos"); };
const PHOTO_STARTER = { photos: [1, 2, 3].map(() => ({ image: "", alt: "", caption: "", sub: "" })), per_row: "3" };
const LOGO_ITEM_ROWS = (hint) => ({ name: "logos", label: "Logos", type: "rows", fields: [{ ...PIC, label: "Logo", button: "Upload a logo", hint: "A PNG with a clear background works best." }, { name: "alt", label: "Name, read aloud to people who cannot see it", type: "text", hint: "Shown as words until a logo is uploaded." }, { name: "href", label: "Opens when clicked", type: "text", addr: true, hint }] });
const LOGO_ITEM_BLOCK = { field: "logos", label: "Logo", add: "Add a logo", about: "One logo in the row, with an optional link." };
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
    { id: "about", label: "About the artist", about: "The paragraphs and the background sources.", fields: [
      { name: "body", label: "Paragraphs", type: "lines", hint: "One paragraph per line." },
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
    return { slug, name: a.name, line: a.line || "", houses: [...(a.houses || [])], summary: bio.summary || "", body: [...(bio.body || [])], sources: (bio.sources || []).map((x) => [...x]),
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
  const curSlugs = Object.keys(sales.artists || {}), seenR = new Set(), allSales = [], artistsOut = {}, wasAll = gamForEditor(content, sales, images, imageFiles || []);
  const wordFields = kinds.artist.parts[0].fields, picFields = kinds.artist.parts[1].fields, aboutFields = kinds.artist.parts[3].fields;
  for (const g of gr) {
    const slug = String((g && g.slug) || ""), isNew = !curSlugs.includes(slug);
    if (seenR.has(slug)) throw new Error("Two artists have the same web address.");
    seenR.add(slug);
    if (isNew && !SLUG.test(slug)) throw new Error("A new artist needs a web address of letters, digits and hyphens.");
    const was = isNew ? { slug, name: "", line: "", houses: [], summary: "", body: [], sources: [], image: "", alt: "", caption: "", sales: [] } : wasAll.artists.find((a) => a.slug === slug);
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
    rows.forEach((r) => { delete r.sale._i; allSales.push(r.sale); });
    if (isNew) changed.push("Add artist: " + a.name); else if (touched) changed.push("Edit profile: " + a.name);
  }
  // an artist can go only once their sales have gone
  for (const slug of curSlugs) if (!seenR.has(slug)) {
    const n = (sales.sales || []).filter((x) => x.artist === slug).length, name = (sales.artists[slug] || {}).name || slug;
    if (n) throw new Error(name + " still has " + n + (n === 1 ? " sale" : " sales") + " on the site. Remove the sales and save first, then delete the artist.");
    if (c.bios) delete c.bios[slug]; delete im[slug]; changed.push("Delete artist: " + name);
  }
  s.artists = artistsOut; s.sales = allSales;
  return { content: c, sales: s, images: im, changed };
}
export function gamSpots(content, sales, images, imageFiles) {
  return gamForEditor(content, sales, images, imageFiles).artists.map((a) => ({ key: "artist:" + a.slug, kind: "artist", label: a.name, group: "Artists", also: a.name + "'s market profile", image: a.image, alt: a.alt, credit: a.caption, slot: "artist-" + a.slug, hasCredit: true }));
}

function cleanField(f, v, site) {
  const t = f.type;
  if (t === "text") {
    if (f.none && (v === false || /^\s*none\s*$/i.test(String(v == null ? "" : v)))) return false;
    const x = String(v == null ? "" : v).replace(/ *— */g, ", ").replace(/, ,/g, ",").slice(0, 400);
    if (f.addr) { const a = x.trim().replace(/[<>"\s]/g, ""); return /^(#|\/|[a-z0-9-]+\/|https?:\/\/|mailto:)/i.test(a) ? a.slice(0, 300) : ""; }
    return f.nullable && !x.trim() ? null : x;
  }
  if (t === "long") { const x = String(v == null ? "" : v).replace(/ *— */g, ", ").replace(/, ,/g, ",").slice(0, 60000); return f.nullable && !x.trim() ? null : x; }
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
  if (t === "choice") { const ok = f.options.map((o) => o[0]); return ok.includes(String(v == null ? "" : v)) ? String(v) : (f.dflt && ok.includes(f.dflt) ? f.dflt : ok[0]); }
  if (t === "colour") { const x = String(v == null ? "" : v).trim(); const themeOk = (f.theme || []).map((o) => o[0]); return themeOk.includes(x) ? x : (/^#[0-9a-fA-F]{6}$/.test(x) ? x.toUpperCase() : (themeOk[0] || "")); }
  if (t === "image") {
    let x = String(v == null ? "" : v).trim();
    if (f.path) { x = x.startsWith(f.path) ? x.slice(f.path.length) : x; return /^[A-Za-z0-9._-]{1,120}$/.test(x) ? f.path + x : null; }
    return /^[A-Za-z0-9._-]{0,120}$/.test(x) ? x : "";
  }
  if (t === "artists") { const ok = (site.artists || []).map((a) => a.slug); if (f.one) return ok.includes(String(v)) ? String(v) : ""; return (Array.isArray(v) ? v : []).map((x) => x && typeof x === "object" ? (ok.includes(String(x.v)) ? { v: String(x.v), hidden: true } : "") : (ok.includes(String(x)) ? String(x) : "")).filter(Boolean).slice(0, 20); }
  if (t === "rows") {
    const rows = (Array.isArray(v) ? v : []).slice(0, 40);
    return rows.map((row) => {
      const isList = f.fields.some((g) => typeof g.name === "number");
      const out = isList ? [] : {};
      for (const g of f.fields) out[g.name] = cleanField(g, row && row[g.name], site);
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
  for (const f of schema.fields) out[f.name] = cleanField(f, given ? given[f.name] : undefined, site);
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
  for (const [pk, pg] of Object.entries((pagesDoc && pagesDoc.pages) || {})) for (const sec of (pg && pg.sections) || []) {
    if (has(sec.settings)) used.push({ label: (pg.title || pk) + " page: " + ((kinds[sec.type] || {}).label || sec.type) + (sec.visible === false ? " (hidden)" : ""), page: pk, where: "page", id: sec.id });
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

export function cleanPages(site, given, current) {
  const spec = site.sectionKinds;
  if (!given || typeof given !== "object") throw new Error("The page could not be read.");
  const out = { _how_to_edit: current._how_to_edit, shared: {}, pages: {} };
  for (const key of Object.keys(current.shared || {})) {
    const cur = current.shared[key], g = (given.shared || {})[key] || cur;
    if (!spec[cur.type]) { out.shared[key] = cur; continue; }
    out.shared[key] = { type: cur.type, visible: g.visible !== false, settings: cleanSettings(spec[cur.type], g.settings, site) };
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
      const id = String(sec.id || "");
      if (!SECTION_ID.test(id) || seen.has(id)) throw new Error("Every section needs its own short name.");
      seen.add(id);
      sections.push({ id, type: sec.type, visible: sec.visible !== false, settings: cleanSettings(spec[sec.type], sec.settings, site) });
    }
    const title = cleanText(g && g.title, site.gam ? 120 : 60) || (cur && cur.title) || "";
    if (!title) throw new Error("Every page needs a title.");
    if (site.gam) {
      const base = cur || { path: key + "/index.html", title, description: "", current: "", intro: false };
      out.pages[key] = { ...base, title, description: cleanText(g && g.description != null ? g.description : base.description, 300), sections };
    } else out.pages[key] = { ...(cur || {}), title, sections };
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
const PAGE_KEY = /^[a-z][a-z0-9-]{0,40}$/;
const RESERVED = ["home", "artists", "reviews", "explained", "library", "guides", "standards", "research", "search", "assets", "data", "tools", "inbox", "preview", "auction-results", "market-intelligence", "collecting-valuation", "about", "contact"];
// A section's kinds of block, as a list. A kind is a list of rows, a list of names, or one block made of some of the section's own fields.
export function blockKinds(b) {
  return (Array.isArray(b) ? b : b ? [b] : []).map((x) => {
    const o = { field: x.field, label: x.label, add: x.add || "", about: x.about || "" };
    if (x.one) { o.one = true; o.hide = x.hide || ""; o.fields = x.fields || []; }
    if (x.item) o.item = x.item;
    return o;
  });
}
// What the console needs to draw the editor: each kind's label, fields and starter.
function kindsFor(site) {
  const out = {};
  for (const [k, v] of Object.entries(site.sectionKinds || {})) {
    out[k] = { label: v.label, about: v.about || "", fields: v.fields, library: v.library || "", starter: v.starter || null };
    if (v.blocks) out[k].blocks = blockKinds(v.blocks);
  }
  return out;
}
function summariesFor(site, pages) {
  const f = (sec) => { const k = site.sectionKinds[sec.type]; try { return k && k.summary ? String(k.summary(sec.settings || {})) : ""; } catch (_e) { return ""; } };
  const out = {};
  for (const [key, part] of Object.entries(pages.shared || {})) out["shared:" + key] = f(part);
  for (const [key, pg] of Object.entries(pages.pages || {})) for (const sec of pg.sections || []) out[key + ":" + sec.id] = f(sec);
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
    sectionKinds: WAR_SECTIONS,
    items: WAR_ITEMS,
    lists: WAR_LISTS,
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
    pages: { file: "data/pages.json", images: "assets/images", meta: "data/files.json" },
    sectionKinds: GAM_SECTIONS,
    items: GAM_ITEMS,
    gam: true,
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
      v = String(v == null ? "" : v).replace(/ *— */g, ", ").replace(/, ,/g, ",").slice(0, 60000);
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
function publicCopy(c) {
  return { id: c.id, kind: c.kind, name: c.name, ahead: c.ahead, behind: c.behind, since: c.since, steps: c.steps.map((x) => ({ what: x.what, when: x.when, by: x.by })), canRedo: c.canRedo, preview: c.kind === "trial" ? c.preview : "" };
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

async function siteOverview(site, wanted = "") {
  const base = { id: site.id, name: site.name, domain: site.domain, live: site.live, artists: site.artists, files: !!(site.pages && site.pages.meta), edits: !!site.items };
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
  const WRITES = ["saveTheme", "saveEntry", "setHidden", "deleteEntry", "removePhoto", "undo", "uploadPhoto", "savePages", "saveFiles"];
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
  async function loadGam() {
    const [content, sales, images, listing] = await Promise.all([loadJson("data/content.json"), loadJson("data/sales.json"), loadJson("data/images.json"),
      gh(repoPath + "/contents/assets/images?ref=" + encodeURIComponent(ref))]);
    if (!content || !sales) return null;
    const imageFiles = Array.isArray(listing.data) ? listing.data.filter((x) => x.type === "file").map((x) => x.name) : [];
    return { content: content.data, sales: sales.data, images: images ? images.data : {}, imageFiles, shas: [content.sha, sales.sha, images ? images.sha : ""] };
  }
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
    const gamNow = site.gam ? await loadGam() : null;
    if (site.gam && !gamNow) return json({ error: "The site's words and sales could not be read." }, 502);
    const editorNow = site.gam ? gamForEditor(gamNow.content, gamNow.sales, gamNow.images, gamNow.imageFiles) : c && site.items ? siteForEditor(c.data) : null;
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
      const images = Array.isArray(imgs.data) ? imgs.data.filter((x) => x.type === "file" && /\.(jpe?g|png|webp)$/i.test(x.name)).map((x) => x.name) : [];
      const preview = copy.kind === "trial" ? copy.preview : "https://" + site.domain + "/";
      const pictures = c ? pictureSpots(c.data).filter((x) => x.kind !== "work").map(publicSpot) : [];
      const imageMeta = meta && meta.data && meta.data.files && typeof meta.data.files === "object" ? meta.data.files : {};
      let doc = f.data; try { doc = cleanPages(pctx, f.data, f.data); } catch (_e) { /* shown as it is */ }
      const extra = editorNow ? { site: editorNow, itemKinds: site.items, lists: Object.fromEntries(Object.entries(site.lists || {}).map(([k, l]) => [k, { label: l.label, section: l.section || "" }])), listFields: LIST_FIELDS, gam: !!site.gam,
        pageFields: site.gam ? [{ name: "title", label: "Title in the browser tab and search results", type: "text" }, { name: "description", label: "Description for search engines", type: "long", plain: true, hint: "One or two sentences. Not shown on the page." }] : null } : {};
      return json({ pages: doc, kinds: kindsFor(site), summaries: summariesFor(site, doc), images, imageMeta, pictures, imageBase: preview + ps.images + "/", artists: editorNow ? editorNow.artists.map((a) => ({ slug: a.slug, name: a.name })) : site.artists, preview, sha: f.sha, version, ...extra });
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
    if (hasPics && !c && !site.gam) return json({ error: "The pictures of this site could not be read." }, 502);
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
    if (hasSite && site.gam) {
      let r; try { r = gamFromEditor(site.items, fix(body.content), gamNow.content, gamNow.sales, gamNow.images, gamNow.imageFiles.concat(Object.values(renamed))); } catch (e) { return json({ error: e.message }, 400); }
      items = { changed: r.changed };
      for (const [path, data, cur] of [["data/content.json", r.content, gamNow.content], ["data/sales.json", r.sales, gamNow.sales], ["data/images.json", r.images, gamNow.images]]) if (canon(data) !== canon(cur)) gamFiles.push([path, data]);
      if (!gamFiles.length) items.changed = [];
    } else if (hasSite) {
      try { items = cleanSite(site.items, fix(body.content), c.data); } catch (e) { return json({ error: e.message }, 400); }
      if (items.changed.length) { c.data = items.data; if (slots) keepSlots(slots.data, c.data); }
    }
    if (hasPics && c && Object.keys(pics).length) { try { res = applyPictures(c.data, picsFixed, slots ? slots.data : null); } catch (e) { return json({ error: e.message }, 400); } }
    if (items.changed.length) res.done = res.done.concat(items.changed);
    if (!uploads.length && !res.done.length && canon(withPhotos) === canon(was)) return json({ ok: true, unchanged: true });
    try {
      if (canon(withPhotos) !== canon(was)) await textBlob(tree, ps.file, withPhotos);
      if (res.done.length && c && !site.gam) await textBlob(tree, ps.content, c.data);
      for (const [path, data] of gamFiles) await textBlob(tree, path, data);
      if ((res.slotsChanged || items.changed.length) && slots && !site.gam) await textBlob(tree, "image-slots.json", slots.data);
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
    const gamNow = site.gam ? await loadGam() : null;
    const spots = gamNow ? gamSpots(gamNow.content, gamNow.sales, gamNow.images, gamNow.imageFiles) : cf ? pictureSpots(cf.data) : [];
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
            if (pf && fillDescriptions(pagesDoc.pages, name, alt) + fillDescriptions(pagesDoc.shared, name, alt)) await textBlob(tree, ps.file, pagesDoc);
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
        } else if (op === "assign" && gamNow) {
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
    if (action === "refreshCopy") {
      if (copy.kind !== "trial") return json({ ok: true, unchanged: true });
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
      if (copy.kind !== "trial") return json({ ok: true, unchanged: true });
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
