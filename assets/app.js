/* Artiscope Digital Home: the console.
   Plain JavaScript, no build step. Everything shown from GitHub is
   escaped before it reaches the page. */
(function () {
  "use strict";

  var VERSION = "44";   // shown on screen so it is clear which copy is loaded
  var cfg = window.ADH_CONFIG || {};
  var params = new URLSearchParams(window.location.search);
  var demo = !cfg.supabaseKey || params.has("demo");
  var demoEditor = demo && params.get("as") === "editor";   // index.html?demo&as=editor shows the console as an editor sees it
  var sb = null;
  var app = document.getElementById("app");

  var state = {
    session: null, email: "", signinSent: false, signinMode: "link",
    data: null,            // overview: sites, photo spots, waiting photos
    site: "",              // id of the site being worked on
    tab: "home", prevTab: "home",
    inSite: false,         // true once a site has been opened from Home
    place: {},             // site id -> the screen last used there
    notice: null,          // { text, problem }
    status: "live",        // "live" | "saving" | "saved"
    flash: "",             // what just happened, said once in the top bar
    copy: {},              // site id -> the trial copy being worked on ("" is the live site)
    ask: null,             // a question shown before something big: { kind, ... }
    sure: false,           // set while a confirmed live save runs
    busy: {},
    content: {},           // site id -> collections
    ctab: {}, prevCtab: 0, // site id -> index of the open content tab
    open: null,            // { ci, ei } entry being edited
    confirm: null,         // key of the thing waiting for a second press
    history: {},           // site id -> list of changes
    draft: null,           // what has been typed into the open entry, kept across redraws
    dirty: false,          // the open entry has typing that is not saved
    leave: null,           // where the user was going when asked about unsaved typing
    egroup: 0,             // which part of the open entry is on screen
    csearch: "", csort: "site", cmore: false,   // content list: search, order, show all
    theme: {},             // site id -> { spec, values, draft, mode, live }
    customCss: true,       // the Custom CSS box at the end of a section's settings
    edPrefs: {},           // site id -> { mode, page, sel } kept while the editor reloads
    pg: {},                // site id -> the page editor: { doc, base, kinds, summaries, images, artists, preview, page, sel, mode, panel, dirty }
    photoFiles: [], photoSent: {}, photoDone: [],
    files: {},             // site id -> Files screen: { files, spots, imageBase, filter, open, assign, pick, bust }
    fileAdd: [],           // photos chosen in Files, waiting for their descriptions
    fileBust: {}, fileFilter: "all",   // photos replaced in this visit, so the new one shows; the last filter used
    people: null,          // People screen: { list, sites, sel, mode, ask, note, busy }
    versions: {},          // site id -> { list, canGoBack, archive, open }
  };

  // ---------- small helpers ----------

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function key() { return Array.prototype.join.call(arguments, "|"); }
  function greeting() { var h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }
  function today() { return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }); }
  function when(iso) {
    var d = new Date(iso); if (isNaN(d)) return "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" }) + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  function sites() { return state.data ? state.data.sites : []; }
  function liveSites() { return sites().filter(function (s) { return s.live; }); }
  function site() { return liveSites().find(function (s) { return s.id === state.site; }) || null; }
  function initials(name) { return String(name).split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 3).toUpperCase(); }
  var COLOURS = { "world-art-review": ["#1D4A35", "#EEE5D4"], "global-art-monitor": ["#F3C3C8", "#2A2A2F"], "practice-site": ["#F1E6FC", "#52057B"], "street-art-dispatch": ["#163A30", "#EFE6D3"] };
  function colours(id) { return COLOURS[id] || ["#EDE8F3", "#5D5866"]; }

  // ---------- talking to the server ----------

  async function api(action, payload) {
    var body = Object.assign({ action: action }, payload || {});
    if (body.site && body.copy == null) body.copy = state.copy[body.site] || "";
    if (action === "overview") body.copies = state.copy;
    if (demo) return demoApi(body);
    var res = await sb.functions.invoke(cfg.functionName || "home", { body: body });
    if (res.error) { var err = new Error(await explain(res.error)); err.stale = !!(explain.last && explain.last.stale); err.clash = !!(explain.last && explain.last.clash); throw err; }
    return res.data;
  }

  // Turns a failed call to the server function into a plain sentence
  // that says which setup step to look at.
  async function explain(error) {
    var ctx = error && error.context, status = ctx && typeof ctx.status === "number" ? ctx.status : 0, detail = null;
    try { if (ctx && typeof ctx.json === "function") detail = await ctx.json(); } catch (e) { detail = null; }
    explain.last = detail;
    if (detail && detail.error) return detail.error === "Unknown request."
      ? "The server function in Supabase is an older copy. Paste in the latest version from GitHub and deploy it, then press Refresh."
      : detail.error;
    var extra = detail ? String(detail.message || detail.msg || detail.code || "") : "";
    if (status === 404) return "The server function was not found. In Supabase, under Edge Functions, it must exist under the name set in config.js";
    if (status === 401) return "Supabase blocked the request before it reached the server function. Open the function's settings in Supabase, switch off Verify JWT, save, and try again.";
    if (status >= 500) return "The server function is there but failed to run (code " + status + (extra ? ", " + extra : "") + "). Send this message to Claude.";
    if (status) return "The server function answered with code " + status + (extra ? " (" + extra + ")" : "") + ". Send this message to Claude.";
    return "The server function could not be reached. Either it has not been added in Supabase yet (or under a different name), or the connection dropped.";
  }

  async function load() {
    try {
      state.data = await api("overview");
      if (state.inSite && !sites().some(function (x) { return x.id === state.site; })) { state.inSite = false; state.site = ""; state.tab = "home"; }
      keepCopies();
      state.notice = null;
    } catch (e) { state.notice = { text: e.message, problem: true }; }
    if (state.data && params.get("ed") && !state.edLinked && edFromAddress()) return;
    render();
    if (state.data) ensure();
  }

  // Fetches what the open screen needs, once per site.
  async function ensure(force) {
    if (!state.inSite && state.tab === "people" && isAdmin() && (force || !state.people || !state.people.list)) { await loadPeople(); return; }
    var s = site(); if (!s) return;
    try {
      if (state.tab === "versions" && (force || !state.versions[s.id])) {
        var vd = await api("versions", { site: s.id }); var old = state.versions[s.id] || {};
        state.versions[s.id] = { list: vd.versions || [], canGoBack: !!vd.canGoBack, archive: !!old.archive, open: old.open || "" }; render();
      }
      if ((state.tab === "content" || state.tab === "overview") && (force || !state.content[s.id])) {
        var c = await api("content", { site: s.id }); state.content[s.id] = c.collections || []; render();
      }
      if ((state.tab === "theme" || state.tab === "overview" || state.tab === "pages") && !state.theme[s.id] && hasScreen(s, "theme")) {
        var t = await api("theme", { site: s.id });
        t.values.settings = t.values.settings || {};
        state.theme[s.id] = { spec: t.spec, values: t.values, draft: JSON.parse(JSON.stringify(t.values)), mode: "computer", live: null }; if (state.tab === "pages" && pgOf()) edPatch(); else render();
      }
      if (state.tab === "pages" && !state.pg[s.id]) {
        var pgd = await api("pages", { site: s.id });
        var pref = state.edPrefs[s.id] || {};
        var pics = {}; (pgd.pictures || []).forEach(function (p) { pics[p.key] = p; });
        if (pgd.pages) { pgd.pages.groups = pgd.pages.groups || {}; ["top", "popups", "bottom"].forEach(function (w) { if (!pgd.pages.groups[w]) pgd.pages.groups[w] = []; }); tplNormal(pgd.pages, pgd.itemKinds); }
        state.pg[s.id] = { version: pgd.version || "", pictures: pics, picBase: JSON.stringify(pics), imageMeta: pgd.imageMeta || {}, doc: pgd.pages, base: canon(pgd.pages), kinds: pgd.kinds, summaries: pgd.summaries || {}, images: pgd.images || [], imageSizes: pgd.imageSizes || {}, imageBase: pgd.imageBase || "", uploads: {}, picker: "", artists: pgd.artists || [], preview: pgd.preview, page: pref.page && pgd.pages.pages[pref.page] ? pref.page : "home", sel: pref.sel || null, mode: pref.mode || "computer", panel: "", dirty: false, sent: false,
          site: pgd.site || null, siteBase: JSON.stringify(pgd.site || null), itemKinds: pgd.itemKinds || null, lists: pgd.lists || {}, listFields: pgd.listFields || [], at: pref.at || "", gam: !!pgd.gam, model: pgd.model || (pgd.gam ? "gam" : ""), builtIn: pgd.builtIn || null, pageFields: pgd.pageFields || null, leftPanel: pref.leftPanel || undefined };
        var made = state.pg[s.id]; if (made.at && !atKnown(made)) made.at = "";
        render();
      }
      if (state.tab === "files" && (force || !state.files[s.id])) {
        var fl = await api("files", { site: s.id }), was = state.files[s.id] || {};
        state.files[s.id] = { files: fl.files || [], spots: fl.spots || [], imageBase: fl.imageBase || "", filter: was.filter || state.fileFilter || "all", open: "", assign: "", pick: "" }; render();
      }
      if (state.tab === "history" && (force || !state.history[s.id])) {
        var h = await api("history", { site: s.id }); state.history[s.id] = h.changes || []; render();
      }
    } catch (e) { state.notice = { text: e.message, problem: true }; render(); }
  }

  // ---------- copies of a site ----------
  function copiesOf(s) { return (s && s.copies && s.copies.length ? s.copies : [{ id: "live", kind: "live", name: "Live site", ahead: 0, behind: 0, steps: [], canRedo: false, preview: "" }]); }
  function curCopy() { var s = site(), list = copiesOf(s), id = s ? state.copy[s.id] : ""; if (!isAdmin() && myCopy(s)) return myCopy(s); return list.find(function (c) { return c.id === id; }) || list[0]; }
  function keepCopies() {
    sites().forEach(function (s) {
      if (!isAdmin()) { var m = myCopy(s); state.copy[s.id] = m ? m.id : ""; return; }
      var id = state.copy[s.id]; if (id && !copiesOf(s).some(function (c) { return c.id === id && c.kind === "trial"; })) state.copy[s.id] = "";
    });
  }
  async function refreshCopies() {
    var fresh = await api("overview"); state.data = fresh; keepCopies();
  }

  // On the live site, a save reaches visitors, so it asks once first.
  function onLive(fn, what) {
    if (curCopy().kind === "live" && !state.sure) { state.ask = { kind: "livesave", what: what || "This change", go: fn }; if (state.tab === "pages" && pgOf()) edPatch(); else render(); if (typeof window.scrollTo === "function") window.scrollTo(0, 0); }
    else fn();
  }

  // Runs one change, shows it in the floating bar, then refreshes.
  // "say" is what the bar says afterwards. Saving never reaches visitors; only Publish does.
  async function change(k, run, done, say) {
    state.busy[k] = true; state.status = "saving"; state.flash = ""; state.notice = null; state.confirm = null; state.ask = null; render();
    try {
      var out = await run();
      state.status = "saved"; state.flash = say || (curCopy().kind === "trial" ? "Saved on this copy" : "Saved. Live in about two minutes");
      if (done) done(out);
      var s = site();
      if (s) { delete state.history[s.id]; delete state.content[s.id]; delete state.theme[s.id]; delete state.pg[s.id]; delete state.files[s.id]; }
      try { await refreshCopies(); } catch (e2) { /* the next refresh will catch up */ }
      delete state.busy[k]; render();
      await ensure(true);
    } catch (e) {
      state.status = "live"; state.notice = (e.stale || e.clash) && state.ask ? null : { text: e.message, problem: true };
      delete state.busy[k]; render();
    }
  }

  // ---------- the frame: menu, floating bar ----------

  // One small set of line icons, drawn the same way everywhere.
  var IC = {
    monitor: "M3.5 4.5h17v11.5h-17z M9 20h6 M12 16v4",
    phone: "M7.5 3h9v18h-9z M11 18h2",
    plus: "M12 5v14 M5 12h14",
    copy: "M8.5 8.5h11v11h-11z M15.5 8.5V4.5h-11v11h4",
    eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z M12 9.2a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 1 1 0-5.6z",
    eyeoff: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z M12 9.2a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 1 1 0-5.6z M4 20L20 4",
    bin: "M4.5 7h15 M10 7V4.5h4V7 M6.5 7l1 13h9l1-13",
    banner: "M3.5 5h17v14h-17z M7 10h7 M7 14h4",
    person: "M12 5.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7z M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5",
    list: "M9 6h11 M9 12h11 M9 18h11 M4.5 6h.5 M4.5 12h.5 M4.5 18h.5",
    book: "M4 5.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4z M20 5.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h6z",
    hash: "M9 4l-2 16 M17 4l-2 16 M4.5 9h16 M3.5 15h16",
    cards: "M3 6h5v12H3z M9.5 6h5v12h-5z M16 6h5v12h-5z",
    loader: "M12 4.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 1 1 0-15z M12 4.5a7.5 7.5 0 0 1 7.5 7.5",
    topbar: "M3.5 5h17v5h-17z M6 15h12 M6 19h8",
    footer: "M6 5h12 M6 9h8 M3.5 14h17v5h-17z",
    heading: "M6 5v14 M18 5v14 M6 12h12",
    text: "M5 6h14 M5 10h14 M5 14h14 M5 18h9",
    table: "M3.5 5h17v14h-17z M3.5 10h17 M9.5 10v9",
    clock: "M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17z M12 7.5V12l3 2",
    picture: "M3.5 5h17v14h-17z M9 8.4a1.6 1.6 0 1 1 0 3.2a1.6 1.6 0 1 1 0-3.2z M4 17l5-4 4 3 3-2 4 3",
    form: "M4 5h16v14H4z M7 9h10 M7 13h6",
    links: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
    panel: "M4 6h16v12H4z M8 10h8 M8 14h5",
    gear: "M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6z M12 2.8v2.6 M12 18.6v2.6 M2.8 12h2.6 M18.6 12h2.6 M5.5 5.5l1.8 1.8 M16.7 16.7l1.8 1.8 M5.5 18.5l1.8-1.8 M16.7 7.3l1.8-1.8",
    doc: "M6 3h8l4 4v14H6z M14 3v4h4",
    logo: "M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.4l-5.1 2.7 1-5.6-4.1-4 5.7-.8z",
    search: "M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13z M15.5 15.5L20 20",
    close: "M6 6l12 12 M18 6L6 18",
    quote: "M7 7h4v4c0 3-1.5 5-4 6 M14 7h4v4c0 3-1.5 5-4 6",
    bell: "M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z M10 20.5h4",
    columns: "M4 5h4.5v14H4z M9.75 5h4.5v14h-4.5z M15.5 5H20v14h-4.5z",
    space: "M5 4h14 M5 20h14 M12 8v8 M9.5 10.5 12 8l2.5 2.5 M9.5 13.5 12 16l2.5-2.5",
    slides: "M3.5 5.5h17v11h-17z M8 20h2 M11.5 20h1 M14 20h2",
    gallery: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
    frame: "M4 4h16v16H4z M7.5 7.5h9v9h-9z",
    calendar: "M4 6h16v14H4z M4 10h16 M8 3.5v4 M16 3.5v4",
    mail: "M3.5 6h17v12h-17z M4 6.5l8 6.5 8-6.5",
    pin: "M12 20.5s-6-5.6-6-10.5a6 6 0 0 1 12 0c0 4.9-6 10.5-6 10.5z M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    block: "M4 5h16v14H4z",
    exit: "M10 5H5v14h5 M14 8l-4 4 4 4 M10 12h10",
    layout: "M4 4h16v5H4z M4 11h16v9H4z",
    palette: "M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16z M9 8.8a1.2 1.2 0 1 1 0 2.4a1.2 1.2 0 1 1 0-2.4z M14.5 7.8a1.2 1.2 0 1 1 0 2.4a1.2 1.2 0 1 1 0-2.4z M12 20a2.5 2.5 0 0 1 0-5h2a3 3 0 0 0 3-3",
    addons: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M16.5 13.5v6 M13.5 16.5h6",
    cursor: "M5 5l6 14 2-6 6-2z",
    undo: "M8 8H5V5 M5.5 8.5A8 8 0 1 1 12 20",
    redo: "M16 8h3V5 M18.5 8.5A8 8 0 1 0 12 20",
    dots: "M6 10.8a1.2 1.2 0 1 1 0 2.4a1.2 1.2 0 1 1 0-2.4z M12 10.8a1.2 1.2 0 1 1 0 2.4a1.2 1.2 0 1 1 0-2.4z M18 10.8a1.2 1.2 0 1 1 0 2.4a1.2 1.2 0 1 1 0-2.4z",
    home: "M4 11l8-7 8 7 M6 10v10h12V10",
    keys: "M3.5 7h17v10h-17z M7 10.5h1 M10.5 10.5h1 M14 10.5h1 M17 10.5h.5 M7.5 14h9",
    help: "M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17z M9.6 9.5a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8v.4 M12 17h.01",
    code: "M9 7l-5 5 5 5 M15 7l5 5-5 5",
    swap: "M5 9h12.5 M14.5 6l3 3-3 3 M19 15H6.5 M9.5 12l-3 3 3 3",
    pen: "M14.5 5.5l4 4L9 19H5v-4z M12.5 7.5l4 4",
    globe: "M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17z M3.5 12h17 M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z",
    star: "M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z",
    tpl: "M4 4h16v16H4z M4 9h16 M10 9v11",
  };
  function ic(name, size) { var z = size || 16; return '<svg class="i" width="' + z + '" height="' + z + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (IC[name] || IC.block) + '"></path></svg>'; }
  // Which icon stands for each kind of section, on both sites.
  var KIND_IC = { "signup-popup": "bell", signup: "mail", visit: "pin", hero: "banner", featured: "person", "section-list": "list", explained: "book", numbers: "hash", method: "cards", opening: "loader", header: "topbar", footer: "footer", "page-heading": "heading", "long-text": "text", status: "clock", timeline: "table", words: "book", features: "cards", profiles: "person", "page-links": "links", "page-head": "heading", "results-table": "table", "latest-result": "hash", glossary: "book", panel: "panel", prose: "text", "contact-form": "form", announcement: "bell", columns: "columns", space: "space", "picture-banner": "banner", slideshow: "slides", gallery: "gallery", "logo-row": "logo", artworks: "frame", exhibitions: "calendar", career: "clock", press: "quote", "artist-cards": "person", quote: "quote", faq: "list", button: "block", text: "text", "text-picture": "picture", picture: "picture", articles: "doc", archive: "table", "exhibition-list": "calendar", collecting: "hash", "text-page": "text" };
  function kindIc(type) { return '<span class="kic">' + ic(KIND_IC[type] || "block") + '</span>'; }
  // Which icon stands for each kind of block.
  var BLOCK_IC = { details: "pin", topics: "list", headline: "heading", tagline: "text", picture: "picture", latest: "doc", rule: "panel", links: "links", logos: "logo", artists: "person", rows: "list", cards: "cards", items: "book", columns: "columns", buttons: "block", about_links: "links", menu_extra: "links", words: "book", sections: "list", timeline: "clock", works: "picture", messages: "bell", slides: "slides", photos: "picture", artworks: "frame", shows: "calendar", events: "clock", quotes: "quote" };
  function blockIc(bk) { return '<span class="kic">' + ic(BLOCK_IC[bk && bk.field] || "block", 15) + '</span>'; }

  var ICON_HOME = "M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z";
  var ICON_SITES = ["M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "M4.5 12h15M12 4.5c2.6 2.4 2.6 12.6 0 15M12 4.5c-2.6 2.4-2.6 12.6 0 15"];
  var NAV = [
    ["home", "All sites", ICON_SITES[0], ICON_SITES[1]],
    ["overview", "Overview", ICON_HOME, ""],
    ["pages", "Pages", "M4 5h16v4H4zM4 11h16v8H4z", "M7 14h6"],
    ["content", "Content", "M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z", ""],
    ["theme", "Theme", "M12 4a8 8 0 1 0 0 16c1.2 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a3 3 0 0 0 3-3c0-3.9-3.6-7-8-7z", "M8.5 11.5h.01M11 8.5h.01M14.5 9h.01"],
    ["photos", "Photos", "M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z", "M7 16l3.5-3.5 2.5 2.5 2-2 2 3"],
    ["versions", "Versions", "M6 4h12v16H6z", "M9 8h6M9 12h6M9 16h3"],
    ["history", "History", "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "M12 8v4.5l3 2"],
  ];
  // Outside a site only "All sites" shows. Inside, the site's own screens.
  // Sites that keep their photos in Files show Files instead of Photos.
  var NAV_FILES = ["files", "Files", "M4 6a1 1 0 0 1 1-1h5l2 2h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z", "M8 15l2.5-2.5 2 2 1.5-1.5 2 2"];
  var NAV_PEOPLE = ["people", "People", "M9 5.3a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zM3.5 19.5c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5", "M16.8 7a2.5 2.5 0 1 1 0 5M16.5 14.6c2.2.1 3.7 1.6 4.1 4.4"];
  // The admin sees everything; an editor sees only their own sites and their own copy.
  function isAdmin() { return !state.data || !state.data.user || state.data.user.admin !== false; }
  // An editor's own copy of a site. Editors always work on it, never on the live site.
  function myCopy(s) { return copiesOf(s).find(function (c) { return c.mine; }) || null; }
  function navItems() {
    var s = site(); if (!(state.inSite && s)) return NAV.slice(0, 1).concat(isAdmin() ? [NAV_PEOPLE] : []);
    return (s.files ? NAV.map(function (n) { return n[0] === "photos" ? NAV_FILES : n; }) : NAV).filter(function (n) { return !(s.edits && n[0] === "content") && !(n[0] === "history" && !isAdmin()) && hasScreen(s, n[0]); });
  }
  // A site that is not yet set up for Pages, Theme or Photos leaves those screens out.
  function hasScreen(s, tab) {
    if (!s) return true;
    if (tab === "pages") return s.pagesOn !== false;
    if (tab === "theme") return s.themeOn !== false;
    if (tab === "photos" || tab === "files") return s.photosOn !== false;
    return true;
  }
  // The screen a site opens on: Pages where it has them, otherwise Content.
  function firstTab(x) { return hasScreen(x, "pages") ? "pages" : "content"; }
  function photosTab(s) { return s && s.files ? "files" : "photos"; }
  function navIndex(tab) { var i = navItems().findIndex(function (n) { return n[0] === tab; }); return i < 0 ? 0 : i; }
  function mark() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F2F3F5" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-7 8 7"></path><path d="M6 10v10h12V10"></path><path d="M10 20v-5h4v5"></path></svg>'; }

  // The floating bar: which site, and what state its changes are in.
  function islandBusy() { return state.status !== "live" || (curCopy().kind === "trial" && curCopy().ahead > 0); }
  function islandInner() {
    var s = site(), list = copiesOf(s), c = curCopy(), trial = c.kind === "trial", busy = state.status === "saving";
    if (!state.inSite || !s) {
      var ppl = state.tab === "people";
      return '<span class="dot" aria-hidden="true" style="background:#9A9EA6"></span><b class="island-name">' + (ppl ? "People" : "All sites") + '</b><span class="small">' + (state.status === "saving" ? "Saving" : state.flash || (ppl ? "Who can sign in, and which sites they work on" : "Pick a site to work on")) + '</span>';
    }
    var copyPick = list.length > 1 && isAdmin()
      ? '<label class="small" for="copy-pick" style="position:absolute;left:-9999px">Working on</label><select id="copy-pick" class="copypick" data-change="copy">' +
        list.map(function (x) { return '<option value="' + esc(x.kind === "live" ? "" : x.id) + '"' + (x.id === c.id ? " selected" : "") + '>' + esc(x.kind === "live" ? "Live site" : "Trial: " + x.name) + '</option>'; }).join("") + '</select>'
      : "";
    var text = busy ? "Saving" : state.flash ? state.flash : copyWords(c);
    var canUndo = trial ? c.ahead > 0 : (c.steps && c.steps.length > 0);
    var act = !isAdmin() && c.behind && !busy ? '<button type="button" class="soft slim" data-act="refresh-copy" data-copy="' + esc(c.id) + '">Bring my copy up to date</button>' + (c.ahead ? '<button type="button" class="btn slim" data-act="ask-makelive">Publish</button>' : "")
      : trial && c.ahead && !busy ? '<button type="button" class="btn slim" data-act="ask-makelive">' + (isAdmin() ? "Make live" : "Publish") + '</button>'
      : '<span class="tick" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="#3DDC84" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>';
    return '<span class="dot" aria-hidden="true" style="background:' + (s ? colours(s.id)[0] : "#C9C2D3") + '"></span>' +
      '<b class="island-name">' + esc(s.name) + '</b>' + copyPick +
      '<button type="button" class="soft slim" data-act="undo-step"' + (canUndo && !busy ? "" : " disabled") + '>Undo</button>' +
      '<button type="button" class="soft slim" data-act="redo-step"' + (c.canRedo && !busy ? "" : " disabled") + '>Redo</button>' +
      '<span class="small" id="island-text">' + esc(text) + '</span>' + act;
  }
  function patchIsland() {
    var el = app.querySelector && app.querySelector(".island"); if (!el) return;
    el.className = "island" + (islandBusy() ? " busy" : ""); el.innerHTML = islandInner();
  }

  // What the bar says about the copy being worked on.
  function copyWords(c) {
    if (!isAdmin()) return c.behind ? "The live site has changed since your copy was made" : c.ahead ? "Your copy. " + c.ahead + (c.ahead === 1 ? " change" : " changes") + " not published yet" : "Your copy, the same as the live site";
    return c.kind === "trial" ? (c.ahead ? c.ahead + (c.ahead === 1 ? " change" : " changes") + " on this copy" : "Same as the live site") : "Live site. Saves go straight to visitors";
  }
  // A question asked before anything that reaches visitors or throws work away.
  function viewAsk() {
    var q = state.ask; if (!q) return "";
    var c = copiesOf(site()).find(function (x) { return x.id === q.copy; }) || curCopy(), title, text, yes, act;
    if (q.kind === "makelive" && !isAdmin()) {
      title = "Publish your copy?";
      text = "It goes live straight away as a new version, and visitors see it in about two minutes. The admin gets the release notes. Your copy then starts again from the new live site." + (c.behind ? " The live site has changed since your copy was made. Those changes are kept, unless they are in the same place as yours." : "");
      yes = "Publish"; act = "makelive";
    } else if (q.kind === "makelive") {
      title = "Make \u201C" + c.name + "\u201D the live site?";
      text = "It goes live as a new version, and visitors see it in about two minutes. You can go back to the old one from Versions." + (c.behind ? " The live site has changed since this copy was made. Those changes are kept, unless they are in the same place as yours." : "");
      yes = "Make it live"; act = "makelive";
    } else if (q.kind === "replace") {
      title = "The live site has changed in the same places";
      text = "Since this work was started, the live site had these changes: " + ((q.live || []).join("; ") || "changes made elsewhere") + ". If you carry on, your version of the words, pictures and theme replaces the live one. You can undo it from History.";
      yes = "Publish my version"; act = "publish-replace";
    } else if (q.kind === "livesave") {
      title = q.what + " goes live in about two minutes";
      text = "You are working on the live site, so this reaches visitors straight away. You can undo it afterwards. To try things first, make a trial copy.";
      yes = "Save and go live"; act = "livesave";
    } else if (q.kind === "discard") {
      title = "Throw away " + c.ahead + (c.ahead === 1 ? " change" : " changes") + " that are not live yet?";
      text = "The live site stays exactly as visitors see it now. This cannot be undone.";
      yes = "Throw them away"; act = "discard";
    } else if (q.kind === "stale") {
      return '<div class="sunk stack ask" role="alertdialog" aria-label="Someone else changed this site"><b>Someone else changed this site while you were editing</b><span class="muted">Perhaps the website agent or another person saved something. Your changes are still here and have not been saved. You can save yours anyway, which replaces what they changed in the same places, or start again from the latest version.</span>' +
        '<div class="row"><button type="button" class="btn" data-act="stale-replace">Save mine anyway</button><button type="button" class="soft" data-act="stale-reload">Start again from the latest</button></div></div>';
    } else if (q.kind === "clash") {
      return '<div class="sunk stack ask" role="alertdialog" aria-label="Your copy and the live site changed the same part"><b>Your copy and the live site changed the same part</b><span class="muted">' +
        'Someone published a change to the same place you were working on, so the two cannot be joined. You can publish yours over it, which replaces their version of that part, or start again from the live site, which lets go of the changes on your copy that are not published yet.</span>' +
        '<div class="row"><button type="button" class="btn" data-act="ask-makelive">Publish mine over it</button><button type="button" class="soft" data-act="ask-fresh" data-copy="' + esc(c.id) + '">Start again from the live site</button><button type="button" class="linklike" data-act="ask-cancel">Not now</button></div></div>';
    } else if (q.kind === "fresh") {
      title = "Start again from the live site?";
      text = "Your copy becomes exactly what visitors see now. " + (c.ahead ? "The " + c.ahead + (c.ahead === 1 ? " change" : " changes") + " on your copy that are not published yet are let go. " : "") + "This cannot be undone.";
      yes = "Start again"; act = "fresh";
    } else if (q.kind === "deletecopy") {
      title = "Delete the trial copy \u201C" + c.name + "\u201D?";
      text = "Its changes are lost. The live site is not affected. This cannot be undone.";
      yes = "Delete the copy"; act = "deletecopy";
    } else if (q.kind === "resetpractice") {
      title = "Start the Practice site again from World Art Review?";
      text = "Everything practised on its live copy is replaced by World Art Review as it is now. World Art Review itself is not touched. This cannot be undone, though earlier versions stay in the list.";
      yes = "Start again"; act = "resetpractice";
    } else if (q.kind === "goback") {
      title = "Go back to version " + q.version + "?";
      text = "The live site goes back to how it was in " + q.version + ", as a new version, so this can be undone the same way. Editors are asked to bring their copies up to date.";
      yes = "Go back"; act = "goback";
    } else return "";
    var notes = q.kind === "makelive" ? '<div class="stack" style="gap:6px"><b style="font-size:13.5px">What changed</b>' +
        ((c.steps || []).length ? c.steps.slice(0, 20).map(function (st) { return '<span class="pstep">' + esc(st.what) + '</span>'; }).join("") : '<span class="small">The changes on this copy.</span>') + '</div>' +
        '<div class="field"><label class="label" for="pub-note">A line for the release notes</label><textarea id="pub-note" maxlength="300" style="min-height:64px" placeholder="Optional. Why it changed, or anything to check."></textarea></div>' +
        (isAdmin() ? '<label class="chk"><input type="checkbox" id="pub-big"> A big change, such as a new look. It starts a new first number.</label>' : "") : "";
    return '<div class="sunk stack ask" role="alertdialog" aria-label="' + esc(title) + '"><b>' + esc(title) + '</b><span class="muted">' + esc(text) + '</span>' + notes +
      '<div class="row"><button type="button" class="btn" data-act="' + act + '" data-copy="' + esc(c.id) + '">' + yes + '</button><button type="button" class="soft" data-act="ask-cancel">Cancel</button></div></div>';
  }

  function viewShell(inner) {
    var s = site();
    var nav = navHtml();
    return '<div class="shell">' + viewRail(nav) +
      '<main class="main">' +
        '<div class="island-row"><div class="island' + (islandBusy() ? " busy" : "") + '" role="status">' + islandInner() + '</div></div>' +
        '<div class="column fade">' +
          (state.notice ? '<p class="notice' + (state.notice.problem ? " problem" : "") + '" role="status">' + esc(state.notice.text) + '</p>' : "") +
          viewAsk() + inner +
        '</div></main></div>';
  }
  // The slim menu down the left, shared by every screen and the page editor.
  function viewRail(nav) {
    var who = demo ? "S" : String(state.email || "?").charAt(0).toUpperCase();
    return '<nav class="rail" aria-label="Sections">' +
        '<div class="brand"><span class="brand-mark" aria-hidden="true">' + mark() + '</span><span class="brand-name">Artiscope<br>Digital Home</span></div>' +
        '<div class="nav">' + nav + '</div>' +
        '<div class="rail-foot">' +
          '<details class="acct"><summary aria-label="Your account">' + esc(who) + '</summary><div class="acct-menu">' +
            (demo ? '<span class="small">Sample mode. Example data only, nothing is saved.</span>' : '<span class="small">Signed in as ' + esc(state.email) + '</span>') +
            '<button type="button" class="linklike small" data-act="refresh">Refresh</button>' +
            (demo ? "" : '<button type="button" class="linklike small" data-act="signout">Sign out</button>') +
          '</div></details>' +
          '<span class="small ver">Version ' + VERSION + '</span>' +
        '</div>' +
      '</nav>';
  }
  function navHtml() {
    return navItems().map(function (n) {
      var on = n[0] === state.tab || (n[0] === "pages" && state.tab === "pages");
      return '<button type="button" class="navb' + (on ? " on" : "") + '" data-tab="' + n[0] + '"' + (on ? ' aria-current="page"' : "") + '>' +
        '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path class="o" d="' + n[2] + '"></path><path class="d" d="' + n[3] + '"></path></svg>' +
        '<span>' + n[1] + '</span></button>';
    }).join("");
  }

  // After drawing, let the menu and tab highlights glide to their new place.
  function settle() {
    if (typeof requestAnimationFrame !== "function") return;
    requestAnimationFrame(function () {
      Array.prototype.forEach.call(app.querySelectorAll("[data-to]"), function (el) { el.style.top = el.dataset.to + "px"; });
      var blob = app.querySelector(".blob");
      if (blob && blob.dataset.left) { blob.style.left = blob.dataset.left; blob.style.right = blob.dataset.right; }
      state.prevTab = state.tab;
    });
  }

  // ---------- screens ----------

  function head(title, text) { return '<div class="page-head"><h1>' + esc(title) + '</h1><p>' + esc(text) + '</p></div>'; }

  function statusLine(x) {
    if (!x.live) return "Not built yet";
    var list = copiesOf(x), live = list[0], trials = list.length - 1, bits = [];
    bits.push(live.ahead ? live.ahead + (live.ahead === 1 ? " change" : " changes") + " waiting to be published" : "Everything is live");
    if (x.inbox && x.inbox.length) bits.push(x.inbox.length + (x.inbox.length === 1 ? " photo" : " photos") + " on the way");
    if (trials) bits.push(trials + (trials === 1 ? " trial copy" : " trial copies"));
    return bits.join(". ");
  }
  function viewHome() {
    var cards = sites().map(function (x) {
      var c = colours(x.live ? x.id : "");
      return '<button type="button" class="card lift sitecard" data-act="open-site" data-site="' + esc(x.id) + '">' +
        '<span class="banner" aria-hidden="true" style="background:' + c[0] + ";color:" + c[1] + '">' + esc(x.practice ? "Practice" : x.live ? initials(x.name) : x.name.replace(/\D/g, "")) + '</span>' +
        '<span class="info"><b>' + esc(x.name) + '</b><span class="small">' + esc(x.practice ? "Not public. A copy of World Art Review to try things on" : x.live ? x.domain : "Domain owned") + '</span>' +
        '<span class="small" style="margin-top:8px">' + esc(statusLine(x)) + '</span>' +
        '<span class="small" style="color:var(--accent);margin-top:8px">' + (x.live ? "Open" : "Not built yet") + '</span></span></button>';
    }).join("");
    return '<div class="page-head"><span class="small">' + esc(today()) + '</span><h1>' + greeting() + '</h1>' +
      (isAdmin() ? '<p>Your sites. Open one to work on its words, colours and photos. On the live site, Save goes straight to visitors. On a trial copy, nothing is seen until you make it live. Every step can be undone.</p></div>'
        : '<p>' + (sites().length === 1 ? "Your site." : "Your sites.") + ' Open one to work on your own copy of it. Nothing you save is seen until you publish it, and every step can be undone.</p></div>') +
      viewNewVersions() + '<div class="sites">' + cards + '</div>';
  }
  function viewUnbuilt(x) {
    return '<div class="page-head"><button type="button" class="linklike" data-tab="home" style="align-self:flex-start">All sites</button><h1>' + esc(x.name) + '</h1>' +
      '<p>Not built yet. Creating a new site from a template arrives in a later stage. Until then there is nothing to do here.</p></div>';
  }
  function viewOverview() {
    var s = site(); if (!s) return viewHome();
    var cols = state.content[s.id];
    var entries = cols ? cols.reduce(function (n, c) { return n + c.entries.length; }, 0) : null;
    var empty = (s.slots || []).filter(function (x) { return !x.filled && !x.waiting; }).length, waiting = s.inbox ? s.inbox.length : 0;
    var t = state.theme[s.id], colourCount = t ? t.spec.colours.length + t.spec.fonts.length : null;
    function tile(tab, n, name, sub, act) {
      return '<button type="button" class="card lift sitecard tile" data-tab="' + tab + '"><span class="bignum">' + (n == null ? "..." : n) + '</span><b>' + name + '</b><span class="small">' + esc(sub) + '</span><span class="small" style="color:var(--accent);margin-top:4px">' + act + '</span></button>';
    }
    return '<div class="page-head"><button type="button" class="linklike" data-tab="home" style="align-self:flex-start">All sites</button><h1>' + esc(s.name) + '</h1>' +
      '<p>' + esc(s.domain) + (isAdmin() ? '. Everything for this site is here. Saves on the live site reach visitors straight away. Use a trial copy to try things first.' : '. You work on your own copy. Nothing you save is seen until you publish it.') + '</p></div>' +
      '<div class="grid-3">' +
        (s.edits ? tile("pages", "", "Pages", "Every page, article and artist portfolio, edited beside the real page", "Open the editor")
          : tile("content", entries, "Content", (cols ? cols.map(function (c) { return c.label.toLowerCase(); }).join(", ") : "Articles, artists and more"), cols && cols.some(function (c) { return c.canHide; }) ? "Edit, hide or delete" : "Edit the words")) +
        (!hasScreen(s, "theme") ? "" : t ? '<button type="button" class="card lift sitecard tile" data-tab="theme"><span class="swatches" aria-hidden="true">' + t.spec.colours.map(function (c) { return '<i style="background:' + esc(t.values.colours[c.id] || c.default) + '" title="' + esc(c.label) + '"></i>'; }).join("") + '</span>' +
          '<b>Theme</b><span class="small">' + t.spec.fonts.map(function (f) { return esc(t.values.fonts[f.id] || f.default); }).join(" &nbsp;&middot;&nbsp; ") + '</span><span class="small" style="color:var(--accent);margin-top:6px">Change the look</span></button>'
          : tile("theme", "", "Theme", "Colours and typefaces", "Change the look")) +
        (!hasScreen(s, "photos") ? tile("versions", s.versions && s.versions[0] ? s.versions[0].number : "", "Versions", "Every publish, numbered, with notes on what changed", "See the versions") +
          (isAdmin() ? tile("history", "", "History", "Every change made to the site, and who made it", "See the history") : "")
        : s.files ? tile("files", state.files[s.id] ? state.files[s.id].files.length : "", "Files", "Every photo on the site, what it shows and where it is used", "Upload and describe")
          : tile("photos", empty, "Photos", empty + " empty " + (empty === 1 ? "spot" : "spots") + ", " + waiting + " on the way", "Add photos")) +
      '</div>' + (s.practice && isAdmin() ? '<div class="card stack" style="max-width:820px;margin-top:22px"><h2 class="cardh">Start the Practice site again</h2><span class="small">Its words, pages, theme and photos become World Art Review\'s as they are now. Its versions stay in the list. Anyone practising is asked to bring their copy up to date.</span><div class="row"><button type="button" class="soft" data-act="ask-resetpractice">Start again from World Art Review</button></div></div>' : "") +
      (isAdmin() ? viewCopies() : viewMyCopy());
  }
  // An editor's own copy, and what is waiting on it.
  function viewMyCopy() {
    var c = curCopy(); if (!c || c.kind === "live") return "";
    return '<h2 class="cardh" style="margin:34px 0 14px">Your copy</h2><div class="card stack" style="max-width:820px">' +
      '<span>' + esc(copyWords(c)) + '</span>' +
      (c.steps && c.steps.length ? c.steps.map(function (st) { return '<div class="row between steprow"><div class="body"><span>' + esc(st.what) + '</span><span class="small">' + esc(when(st.when)) + '</span></div></div>'; }).join("") : "") +
      '<div class="row">' + (c.behind ? '<button type="button" class="soft" data-act="refresh-copy" data-copy="' + esc(c.id) + '">Bring my copy up to date</button>' : "") +
        (c.ahead ? '<button type="button" class="btn" data-act="ask-makelive">Publish</button>' : "") +
        (c.preview ? '<a class="linklike small" href="' + esc(c.preview) + '" target="_blank" rel="noopener">Open the preview</a>' : "") + '</div></div>';
  }

  // Long lists open short. Searching looks through all of them without redrawing.
  var LIST_FIRST = 8;
  function filterList() {
    var box = app.querySelector && app.querySelector("#clist"); if (!box) return;
    var q = state.csearch.trim().toLowerCase(), shown = 0, more = app.querySelector("#cmore"), none = app.querySelector("#cnone");
    Array.prototype.forEach.call(box.querySelectorAll(".entry"), function (el, i) {
      var ok = q ? el.dataset.text.indexOf(q) >= 0 : (state.cmore || i < LIST_FIRST);
      el.hidden = !ok; if (ok) shown++;
    });
    if (more) more.hidden = !!q || state.cmore;
    if (none) none.hidden = shown > 0 || !q;
  }

  function viewContent() {
    var s = site(); if (!s) return "";
    var cols = state.content[s.id];
    if (!cols) return head("Content", "Reading the content of " + s.name + ".");
    if (state.open) return viewEditor(s, cols);
    var n = cols.length; if (!n) return head("Content", "This site has no editable content yet.");
    var ci = Math.min(state.ctab[s.id] || 0, n - 1), prev = Math.min(state.prevCtab, n - 1);
    var col = cols[ci];
    var right = ci >= prev, lead = ".28s cubic-bezier(.3,1.3,.6,1)", trail = ".55s cubic-bezier(.3,1.3,.6,1) .04s";
    function pos(i) { return ["calc(" + (i * 100 / n) + "% + 4px)", "calc(" + ((n - 1 - i) * 100 / n) + "% + 4px)"]; }
    // more lists than fit side by side wrap onto a second line, each at its own width
    var tabs = '<div class="tabs' + (n > 5 ? " many" : "") + '" role="tablist" style="grid-template-columns:repeat(' + n + ',minmax(0,1fr))">' +
      '<span class="blob" aria-hidden="true" data-left="' + pos(ci)[0] + '" data-right="' + pos(ci)[1] + '" style="left:' + pos(prev)[0] + ";right:" + pos(prev)[1] + ";transition:left " + (right ? trail : lead) + ",right " + (right ? lead : trail) + '"></span>' +
      cols.map(function (c, i) { return '<button type="button" role="tab" class="tabb' + (i === ci ? " on" : "") + '" aria-selected="' + (i === ci) + '" data-act="ctab" data-i="' + i + '">' + esc(c.label) + '</button>'; }).join("") + '</div>';
    var order = col.entries.map(function (e, ei) { return ei; });
    if (state.csort === "az") order.sort(function (a, b) { return String(col.entries[a].title).localeCompare(String(col.entries[b].title)); });
    var many = col.entries.length > 6;
    var tools = many ? '<div class="row listtools"><input type="text" id="csearch" data-input="csearch" value="' + esc(state.csearch) + '" placeholder="Search ' + esc(col.label.toLowerCase()) + '" aria-label="Search ' + esc(col.label.toLowerCase()) + '">' +
      '<select class="box" data-change="csort" aria-label="Order"><option value="site"' + (state.csort === "site" ? " selected" : "") + '>In site order</option><option value="az"' + (state.csort === "az" ? " selected" : "") + '>A to Z</option></select></div>' : "";
    var list = order.map(function (ei) {
      var e = col.entries[ei];
      return '<div class="card lift entry' + (e.hidden ? " off" : "") + '" data-text="' + esc((e.title + " " + e.sub).toLowerCase()) + '"><div class="body"><b>' + esc(e.title) + '</b><span class="small">' + esc(e.sub) + '</span></div>' +
        (e.hidden ? '<span class="chip quiet">Hidden from the site</span>' : "") +
        '<button type="button" class="soft" data-act="open" data-ci="' + ci + '" data-ei="' + ei + '">Edit</button></div>';
    }).join("");
    var canHide = cols.some(function (c) { return c.canHide; }), canDel = cols.some(function (c) { return c.canDelete; });
    return head("Content", "The words your pages are made from. Open anything to edit it" + (canHide && canDel ? ", hide it from visitors, or delete it." : canHide ? " or hide it from visitors." : canDel ? ". Some lists also let you delete an entry." : ".")) + tabs +
      (col.problem ? '<p class="notice problem">' + esc(col.problem) + '</p>' : "") + tools +
      '<div class="stack" id="clist">' + (list || '<p class="notice">Nothing here yet.</p>') + '</div>' +
      '<p class="notice" id="cnone" hidden>Nothing matches that search.</p>' +
      (col.entries.length > LIST_FIRST ? '<button type="button" class="soft" id="cmore" data-act="cmore" style="align-self:flex-start">Show all ' + col.entries.length + '</button>' : "");
  }


  // ---------- theme: colours and typefaces ----------

  function themeOf() { var s = site(); return (s && state.theme[s.id]) || null; }
  function themeChanges(t) {
    var n = 0;
    ["colours", "fonts"].forEach(function (g) { Object.keys(t.values[g]).forEach(function (k) { if (String(t.draft[g][k]).toUpperCase() !== String(t.values[g][k]).toUpperCase()) n++; }); });
    var a = t.values.settings || {}, b = t.draft.settings || {};
    Object.keys(Object.assign({}, a, b)).forEach(function (k) { var x = a[k] == null ? "" : a[k], y = b[k] == null ? "" : b[k]; if (JSON.stringify(x) !== JSON.stringify(y)) n++; });
    return n;
  }
  function anyThemeChanges() { return Object.keys(state.theme).some(function (k) { return themeChanges(state.theme[k]) > 0; }); }
  // The same sums as the server, so the preview matches what will be published.
  function themeCss(spec, values) {
    var decl = [], links = [];
    spec.colours.forEach(function (c) {
      var v = String((values.colours || {})[c.id] || c.default).toUpperCase();
      if (v === c.default.toUpperCase()) return;
      decl.push(c.var + ":" + v);
      (c.derived || []).forEach(function (d) { decl.push(d[0] + ":color-mix(in srgb, " + v + " " + d[1] + "%, " + d[2] + ")"); });
    });
    spec.fonts.forEach(function (f) {
      var name = (values.fonts || {})[f.id] || f.default;
      if (name === f.default || !spec.fontRequests[name]) return;
      decl.push(f.var + ":'" + name + "', " + f.fallback);
      var link = fontLink(spec, name);
      if (links.indexOf(link) < 0) links.push(link);
    });
    [["h_size", "--h-scale"], ["b_size", "--b-scale"], ["nav_size", "--nav-scale"]].forEach(function (x) { var v = (values.settings || {})[x[0]]; if (v != null && v !== "" && Number(v) !== 100) decl.push(x[1] + ":" + Number(v) / 100); });
    return { css: decl.length ? ":root{" + decl.join(";") + "}" : "", font_links: links };
  }
  function themeRules(spec, st) {
    var L = spec.look || {}, out = [], has = function (k) { return st && st[k] != null && st[k] !== ""; };
    var head = L.head || "h1, h2, h3, h4", body = L.body || "p, li, dd", nav = L.nav || "nav a";
    if (has("h_track")) out.push(head + "{letter-spacing:" + st.h_track / 100 + "em !important}");
    if (has("h_lh")) out.push(head + "{line-height:" + st.h_lh / 100 + " !important}");
    if (st && st.h_caps) out.push(head + "{text-transform:uppercase !important}");
    if (has("b_track")) out.push(body + "{letter-spacing:" + st.b_track / 100 + "em !important}");
    if (has("b_lh")) out.push(body + "{line-height:" + st.b_lh / 100 + " !important}");
    var nf = { body: L.bodyFont, heading: L.headFont }[st && st.nav_font];
    if (nf) out.push(nav + "{font-family:" + nf + " !important}");
    if (st && st.nav_caps) out.push(nav + "{text-transform:uppercase !important;letter-spacing:.06em !important}");
    if (st && st.dir === "rtl") out.push("html, body{direction:rtl}");
    if (has("corners") && L.round) out.push(L.round + "{border-radius:" + (st.corners === "round" ? "10px" : "0") + " !important}");
    if (st && st.buttons === "outline" && L.buttons) out.push(L.buttons + "{background:transparent !important;color:" + (L.band || "currentColor") + " !important;box-shadow:inset 0 0 0 2px currentColor !important}");
    if (st && st.crumbs === false && L.crumbs) out.push(L.crumbs + "{display:none !important}");
    var own = st && st.css ? String(st.css) : "";
    return out.join("\n") + (own ? (out.length ? "\n" : "") + own : "");
  }
  function fontLink(spec, name) { return "https://fonts.googleapis.com/css2?family=" + spec.fontRequests[name] + "&display=swap"; }
  function validHex(v) { return /^#[0-9a-fA-F]{6}$/.test(String(v)); }
  function luminance(hex) {
    var c = [1, 3, 5].map(function (i) { var x = parseInt(hex.substr(i, 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) { var x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function themeWarning(t, c) {
    if (!c.on) return "";
    var other = t.spec.colours.find(function (x) { return x.id === c.on; }); if (!other) return "";
    return contrast(t.draft.colours[c.id], t.draft.colours[other.id]) < c.min ? "Hard to read against the " + other.label.toLowerCase() : "";
  }
  // Shows or clears the "hard to read" warning on every colour while a colour is being changed.
  function themeWarnings(t) {
    t.spec.colours.forEach(function (c) {
      var input = app.querySelector('[data-theme-hex="' + c.id + '"]'), body = input && input.closest(".swrow") && input.closest(".swrow").querySelector(".body"); if (!body) return;
      var w = themeWarning(t, c), el = body.querySelector(".warn");
      if (w && !el) { el = document.createElement("span"); el.className = "warn"; body.appendChild(el); }
      if (el) { if (w) el.textContent = w; else el.remove(); }
    });
  }
  function byRole(list, role) { return list.find(function (x) { return x.role === role; }); }

  function themeSettings(t) {
    var spec = t.spec, d = t.draft;
    function sameColours(set) { return spec.colours.every(function (c) { return String(d.colours[c.id]).toUpperCase() === String(set[c.id] || "").toUpperCase(); }); }
    function look(name, set, i) {
      return '<button type="button" class="look' + (sameColours(set) ? " on" : "") + '" data-act="look" data-i="' + i + '"><i>' +
        spec.colours.slice(0, 3).map(function (c) { return '<span style="background:' + esc(set[c.id]) + '"></span>'; }).join("") + '</i>' + esc(name) + '</button>';
    }
    var looks = look("Live now", t.values.colours, -1) + (spec.looks || []).map(function (l, i) { return look(l.name, l.colours, i); }).join("");
    var cols = spec.colours.map(function (c) {
      var v = d.colours[c.id], warn = themeWarning(t, c);
      return '<div class="swrow"><label class="sw" style="background:' + esc(v) + '" title="Choose a colour"><input type="color" data-theme-colour="' + esc(c.id) + '" value="' + esc(v) + '" aria-label="' + esc(c.label) + '"></label>' +
        '<div class="body"><b>' + esc(c.label) + '</b><span class="small">' + esc(c.use) + '</span>' + (warn ? '<span class="warn">' + esc(warn) + '</span>' : "") + '</div>' +
        '<input type="text" class="hex" data-theme-hex="' + esc(c.id) + '" value="' + esc(v) + '" maxlength="7" spellcheck="false" aria-label="' + esc(c.label) + ', colour code"></div>';
    }).join("");
    var fonts = spec.fonts.map(function (f) {
      var v = d.fonts[f.id];
      return '<div class="swrow"><span class="sw aa" style="font-family:\'' + esc(v) + '\', ' + esc(f.fallback) + '" aria-hidden="true">Aa</span>' +
        '<div class="body"><b>' + esc(f.label) + '</b><span class="small">' + esc(f.use) + '</span></div>' +
        '<select class="box fontpick" data-theme-font="' + esc(f.id) + '" aria-label="' + esc(f.label) + '">' +
        f.options.map(function (o) { return '<option' + (o === v ? " selected" : "") + '>' + esc(o) + '</option>'; }).join("") + '</select></div>';
    }).join("");
    return '<div class="card stack"><h2 class="cardh">Ready-made looks</h2><span class="small">A quick starting point. You can still change every colour below.</span><div class="looks">' + looks + '</div></div>' +
      '<div class="card stack"><h2 class="cardh">Colours</h2>' + cols + '<span class="small">Press a colour square to choose a colour, or type its code.</span></div>' +
      '<div class="card stack"><h2 class="cardh">Typefaces</h2>' + fonts + '<span class="small">A short list chosen to suit a gallery site, so nothing looks out of place.</span></div>' +
      (themeChanges(t) ? '<div class="savebar"><button type="button" class="btn" data-act="theme-publish"' + (state.busy[key("theme", site().id)] ? " disabled" : "") + '>Save theme</button><button type="button" class="soft" data-act="theme-discard">Discard</button><span class="small">' + themeChanges(t) + (themeChanges(t) === 1 ? " change" : " changes") + ' to the theme, not saved yet.</span></div>' : "");
  }
  function drawPreview(s) {
    return '<div class="pvd"><div class="pvd-band"><b>' + esc(s.name) + '</b><span>Artists &nbsp; Reviews &nbsp; Guides</span></div>' +
      '<div class="pvd-hero"><span class="pvd-eye">Artist portfolio</span><h3>A headline in your chosen typeface</h3><p>Reading text looks like this, with <u>a link in the highlight colour</u>.</p><span class="pvd-btn">A button</span></div>' +
      '<div class="pvd-cards"><div><i></i><b>First article</b><span>A line of reading text.</span></div><div><i class="alt"></i><b>Second article</b><span>A line of reading text.</span></div><div><i></i><b>Third article</b><span>A line of reading text.</span></div></div></div>';
  }
  function viewTheme() {
    var s = site(); if (!s) return "";
    var t = themeOf();
    if (!t) return head("Theme", "Reading the theme of " + s.name + ".");
    return head("Theme", "Colours and typefaces for " + s.name + ". Try things freely, then save. Like everything else, a saved theme waits for Publish.") +
      '<div class="theme"><div class="stack-wide" id="theme-settings">' + themeSettings(t) + '</div>' +
      '<div class="card stack pv-card"><div class="row between"><h2 class="cardh">Preview</h2>' +
        '<div class="seg" id="pv-seg"><button type="button" class="' + (t.mode === "computer" ? "on" : "") + '" data-act="pv-mode" data-mode="computer">Computer</button><button type="button" class="' + (t.mode === "phone" ? "on" : "") + '" data-act="pv-mode" data-mode="phone">Phone</button></div></div>' +
        '<div class="pv-stage ' + esc(t.mode) + '" id="pv-stage">' +
          ((demo && !params.has("preview")) || t.live === false ? "" : '<iframe id="pv-live" title="Preview of ' + esc(s.name) + '" src="' + esc(t.spec.url) + '" hidden></iframe>') +
          '<div id="pv-draw">' + drawPreview(s) + '</div></div>' +
        '<span class="small" id="pv-note">' + previewNote(t) + '</span></div></div>';
  }
  function previewNote(t) {
    return t.live ? "This is your real homepage with your changes applied. Only you can see them until you publish."
      : "A simple picture of your colours and typefaces. Only you can see it until you publish.";
  }
  function loadFont(spec, name) {
    if (!document.head || !spec.fontRequests[name]) return;
    var href = fontLink(spec, name), had = false;
    Array.prototype.forEach.call(document.querySelectorAll("link[data-font]"), function (l) { if (l.getAttribute("data-font") === href) had = true; });
    if (had) return;
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; l.setAttribute("data-font", href); document.head.appendChild(l);
  }
  function applyPreview() {
    var t = themeOf(), stage = app.querySelector && app.querySelector("#pv-stage"); if (!t || !stage) return;
    var spec = t.spec, d = t.draft, bg = byRole(spec.colours, "bg"), band = byRole(spec.colours, "band"), acc = byRole(spec.colours, "accent"), text = byRole(spec.colours, "text") || band;
    stage.style.setProperty("--pv-bg", d.colours[bg.id]); stage.style.setProperty("--pv-band", d.colours[band.id]);
    stage.style.setProperty("--pv-accent", d.colours[acc.id]); stage.style.setProperty("--pv-text", d.colours[text.id]);
    var disp = byRole(spec.fonts, "display"), body = byRole(spec.fonts, "body"), small = byRole(spec.fonts, "small") || body;
    [["--pv-display", disp], ["--pv-body", body], ["--pv-small", small]].forEach(function (x) {
      stage.style.setProperty(x[0], "'" + d.fonts[x[1].id] + "', " + x[1].fallback); loadFont(spec, d.fonts[x[1].id]);
    });
    var frame = app.querySelector("#pv-live");
    if (frame && t.live && frame.contentWindow) {
      var out = themeCss(spec, d);
      try { frame.contentWindow.postMessage({ type: "adh-theme", css: out.css, fonts: out.font_links }, new URL(spec.url).origin); } catch (e) { /* preview only */ }
    }
  }
  function sizePreview() {
    var t = themeOf(), stage = app.querySelector && app.querySelector("#pv-stage"); if (!t || !stage) return;
    var w = stage.clientWidth || 600, k = t.mode === "phone" ? 1 : w / 1280;
    stage.style.setProperty("--k", k);
    stage.style.height = t.live ? (t.mode === "phone" ? 720 : Math.round(800 * k)) + "px" : "";
  }
  function showLive(t, yes) {
    t.live = yes;
    var frame = app.querySelector("#pv-live"), draw = app.querySelector("#pv-draw"), note = app.querySelector("#pv-note");
    if (frame) { if (yes) frame.hidden = false; else frame.remove(); }
    if (draw) draw.hidden = !!yes;
    if (note) note.textContent = previewNote(t);
    sizePreview(); applyPreview();
  }
  // Once the Theme screen is drawn: ask the real site whether it can show a preview.
  function mountTheme() {
    var t = themeOf(); if (state.tab !== "theme" || !t || !app.querySelector) return;
    var frame = app.querySelector("#pv-live");
    if (frame) t.live = null;   // a fresh frame has to answer again
    sizePreview(); applyPreview();
    if (!frame) return;
    var origin = new URL(t.spec.url).origin, tries = 0;
    var asking = setInterval(function () {
      tries++;
      if (!frame.isConnected || t.live) { clearInterval(asking); return; }
      if (tries > 12) { clearInterval(asking); if (themeOf() === t) showLive(t, false); return; }
      try { frame.contentWindow.postMessage({ type: "adh-hello" }, origin); } catch (e) { /* not ready yet */ }
    }, 500);
  }
  if (typeof window.addEventListener === "function") {
    window.addEventListener("message", function (ev) {
      if (!ev.data) return;
      if (ev.data.type === "adh-click") { var pgd = pgOf(); if (!pgd) return; try { if (ev.origin !== new URL(pgd.preview).origin) return; } catch (e) { return; } var vw = String(ev.data.view || ""), kk = atKind(pgd); if (vw && vw !== "every" && !(vw === "tpl" && tplHere(pgd)) && vw !== (kk === "other" ? "page" : kk)) return; pickSection(String(ev.data.id || ""), ev.data.block, true, undefined, String(ev.data.bf || "")); return; }
      if (ev.data.type === "adh-add") { var pa = pgOf(); if (!pa) return; try { if (ev.origin !== new URL(pa.preview).origin) return; } catch (e) { return; } var va = String(ev.data.view || ""), ka = atKind(pa); if (va && va !== "every" && !(va === "tpl" && tplHere(pa)) && va !== (ka === "other" ? "page" : ka)) return; previewAdd(pa, ev.data); return; }
      if (ev.data.type === "adh-nav") { var pn = pgOf(); if (!pn) return; try { if (ev.origin !== new URL(pn.preview).origin) return; } catch (e) { return; } navTo(pn.gam && ev.data.path != null ? gamWhere(pn, ev.data.path) : String(ev.data.hash || "home")); return; }
      var t = themeOf(); if (!t || ev.data.type !== "adh-ready") return;
      try { if (ev.origin !== new URL(t.spec.url).origin) return; } catch (e) { return; }
      if (!t.live) showLive(t, true);
    });
    window.addEventListener("resize", sizePreview);
    window.addEventListener("beforeunload", function (ev) { if (state.dirty || anyThemeChanges()) { ev.preventDefault(); ev.returnValue = ""; } });
  }
  // Redraws only the settings, so the preview does not reload.
  function themeUpdate() {
    var t = themeOf(), box = app.querySelector("#theme-settings"); if (!t || !box) { render(); return; }
    box.innerHTML = themeSettings(t); patchIsland(); applyPreview();
  }
  // ---------- publish, undo, redo and trial copies ----------
  function copyArg(id) { var s = site(), c = copiesOf(s).find(function (x) { return x.id === id; }) || curCopy(); return { c: c, arg: c.kind === "live" ? "" : c.id }; }
  function publish(id, replace, extra) {
    var s = site(); if (!s) return; var x = copyArg(id), ex = extra || {};
    change(key("publish", s.id), function () { return api("publish", { site: s.id, copy: x.arg, replace: !!replace, note: ex.note || "", big: !!ex.big }); },
      function (out) {
        if (out && out.conflict) { state.ask = { kind: "replace", copy: x.c.id, live: out.live || [], note: ex.note, big: ex.big }; state.flash = "Not published yet"; return; }
        if (out && out.version) { state.flash = "Published as " + out.version + ". Live in about two minutes"; delete state.versions[s.id]; }
        else if (out && out.versionProblem) state.notice = { text: "Published. The version number and release notes could not be saved on GitHub just now, so the next publish will list these changes too.", problem: true };
      },
      "Published. Live in about two minutes");
  }
  // What the publish question holds: the line for the notes and, for the admin, a big change.
  function publishExtra() {
    var n = app.querySelector("#pub-note"), b = app.querySelector("#pub-big");
    return { note: n ? n.value.trim() : "", big: !!(b && b.checked) };
  }
  function stepBack(n) { var s = site(); if (s) change(key("step", s.id), function () { return api("undoStep", { site: s.id, steps: n || 1 }); }, null, n > 1 ? "Undone, " + n + " steps" : "Undone"); }
  function stepForward() { var s = site(); if (s) change(key("step", s.id), function () { return api("redoStep", { site: s.id }); }, null, "Redone"); }
  function copyAction(action, id, say, after) {
    var s = site(); if (!s) return; var x = copyArg(id);
    change(key("copy", s.id), function () { return api(action, { site: s.id, copy: x.arg }); }, after, say);
  }
  // Brings a copy up to date with the live site. If both changed the same part, ask what to do instead of stopping.
  function refreshMine(id) {
    var s = site(); if (!s) return; var x = copyArg(id);
    change(key("copy", s.id), function () {
      return api("refreshCopy", { site: s.id, copy: x.arg }).catch(function (e) { if (e.clash) state.ask = { kind: "clash", copy: x.c.id }; throw e; });
    }, null, isAdmin() ? "Copy brought up to date with live" : "Your copy is up to date with the live site");
  }
  function makeCopy(name) {
    var s = site(); if (!s) return;
    if (!name) { state.notice = { text: "Give the trial copy a short name, for example Winter look.", problem: true }; render(); var box = app.querySelector("#copy-name"); if (box) box.focus(); return; }
    state.busy.copy = true;
    change(key("copy", s.id), function () { return api("makeCopy", { site: s.id, name: name }); },
      function (out) { delete state.busy.copy; state.copyName = ""; if (out && out.copy) state.copy[s.id] = out.copy; }, "Trial copy made. You are working on it now").then(function () { if (state.busy.copy) { delete state.busy.copy; render(); } });
  }
  async function workOn(id) {
    var s = site(); if (!s) return;
    state.copy[s.id] = id || ""; state.open = null; state.draft = null; state.dirty = false; state.leave = null; state.ask = null; state.flash = ""; state.photoFiles = [];
    delete state.content[s.id]; delete state.theme[s.id]; render();
    try { await refreshCopies(); } catch (e) { state.notice = { text: e.message, problem: true }; }
    render(); ensure();
  }

  function publishTheme() {
    var s = site(), t = themeOf(); if (!s || !t) return;
    var sent = JSON.parse(JSON.stringify(t.draft));
    change(key("theme", s.id), function () { return api("saveTheme", { site: s.id, values: sent }); }, function () { t.values = sent; });
  }


  // ---------- the page editor: sections on the left, the real page in the middle, settings on the right ----------

  function pgOf() { var s = site(); return (s && state.pg[s.id]) || null; }
  function canon(v) {
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ":" + canon(v[k]); }).join(",") + "}";
    return JSON.stringify(v);
  }
  function pgPage(pgd) { return pgd.doc.pages[pgd.page] || { sections: [] }; }
  function pgSections(pgd) { return pgPage(pgd).sections || []; }
  function pgSel(pgd) {
    var q = pgd.sel; if (!q) return null;
    var out;
    if (q.where === "item") {
      var it = itemOf(pgd), ik = pgd.itemKinds && pgd.itemKinds[atKind(pgd)], part = ik && ik.parts.find(function (x) { return x.id === q.id; });
      if (!it || !part) return null;
      if (part.picture) {
        var ps = pgd.pictures[atKind(pgd) + ":" + atKey(pgd)]; if (!ps) return null;
        return { where: "item", id: part.id, parent: { kind: { label: ik.label } }, pic: atKind(pgd) + ":" + atKey(pgd), spot: ps, sec: { type: "picture", settings: ps }, kind: picKind(ps), block: null };
      }
      out = { where: "item", id: part.id, sec: { type: "item", settings: it }, kind: { label: part.label, about: part.about || "", fields: part.fields, blocks: part.blocks } };
    } else if (q.where === "source") {
      var src = pgd.site && pgd.site.sources[q.id]; if (!src) return null;
      return { where: "source", id: q.id, sec: { type: "source", settings: src }, kind: { label: "Source", about: "Shown in the numbered list of every article and portfolio that cites it.", fields: pgd.itemKinds.source.parts[0].fields }, block: null };
    } else if (q.where === "list") {
      if (!pgd.doc.lists || !pgd.doc.lists[q.id]) return null;
      return { where: "list", id: q.id, sec: { type: "list", settings: pgd.doc.lists[q.id] }, kind: { label: "Page heading", about: "The heading and introduction at the top of " + pgd.lists[q.id].label + ".", fields: pgd.listFields }, block: null };
    } else if (q.where === "pageinfo") {
      var pgi = pgd.doc.pages[q.id]; if (!pgi || (q.id === "home" && !pgd.gam)) return null;
      var pfields = (pgd.pageFields || [{ name: "title", label: "Page title", type: "text", hint: "Shown in the browser tab and in the page picker." }]).slice();
      if (q.id !== "home" && !builtInPage(pgd, q.id)) pfields.push({ name: "own", label: "Its own layout", type: "yesno", hint: "No menu bar, footer or sections shared by every page, for a page such as Coming soon. Popups still show." });
      return { where: "pageinfo", id: q.id, sec: { type: "pageinfo", settings: pgi }, kind: { label: "Page settings", about: "This page's title, and where to find it.", fields: pfields }, block: null };
    }
    if (out) return resolveBlock(out, q);
    if (q.where === "shared") { var part = pgd.doc.shared[q.id]; if (!part) return null; out = { where: "shared", id: q.id, sec: part, kind: pgd.kinds[part.type] }; }
    else { var lw = isGroup(q.where) || q.where === "tpl" ? q.where : "page", sec = secList(pgd, lw).find(function (x) { return x.id === q.id && x.type !== "main"; }); if (!sec) return null; out = { where: lw, id: q.id, sec: sec, kind: pgd.kinds[sec.type] }; }
    out.block = null;
    var sp = q.pic && pgd.pictures && pgd.pictures[q.pic];
    if (sp) return { where: out.where, id: out.id, parent: out, pic: q.pic, spot: sp, sec: { type: "picture", settings: sp }, kind: picKind(sp), block: null };
    return out.kind ? resolveBlock(out, q) : out;
  }
  // A section's kinds of block, always as a list. One kind can be a list of rows, a list of names, or one block made of the section's own fields.
  function bkinds(kind) { var b = kind && kind.blocks; return !b ? [] : Array.isArray(b) ? b : [b]; }
  function bkindOf(kind, bf) { var ks = bkinds(kind); return ks.filter(function (k) { return k.field === bf; })[0] || ks[0] || null; }
  function resolveBlock(out, q) {
    out.block = null;
    var bk = q.block != null ? bkindOf(out.kind, q.bf) : null; if (!bk) return out;
    var st = out.sec.settings || {};
    if (bk.one) { out.block = 0; out.item = st; out.list = null; out.bk = bk; out.single = true; out.bdef = { fields: (out.kind.fields || []).filter(function (f) { return (bk.fields || []).indexOf(f.name) >= 0; }) }; return out; }
    var list = st[bk.field];
    if (Array.isArray(list) && list[q.block] !== undefined) {
      out.block = q.block; out.item = list[q.block]; out.list = list; out.bk = bk;
      out.bdef = bk.item ? { fields: [bk.item] } : (out.kind.fields || []).filter(function (f) { return f.name === bk.field; })[0];
      // a block inside this block, one level down
      var cbk = q.sf && q.sub != null ? (bk.blocks || []).filter(function (c) { return c.field === q.sf; })[0] : null;
      var clist = cbk && out.item && typeof out.item === "object" ? out.item[q.sf] : null;
      if (cbk && Array.isArray(clist) && clist[q.sub] !== undefined) {
        out.pbk = bk; out.pblock = q.block; out.plist = list; out.pitem = out.item; out.pre = bk.field + "." + q.block + ".";
        out.child = true; out.bk = cbk; out.block = q.sub; out.item = clist[q.sub]; out.list = clist;
        out.bdef = ((out.bdef || {}).fields || []).filter(function (f) { return f.name === q.sf; })[0] || { fields: [] };
      }
    }
    return out;
  }
  // A name in a list can be hidden by wrapping it: "name" or {v: "name", hidden: true}.
  function nameOf(item) { return item && typeof item === "object" && !Array.isArray(item) && "v" in item ? item.v : item; }
  function selHidden(sel) { return sel.single ? !!(sel.item || {})[sel.bk.hide] : blockHidden(sel.item); }
  // What a block is called in the list.
  function bTitle(pgd, bk, item, i) {
    if (bk && bk.one) return bk.label;
    if (bk && bk.item) {
      var v = nameOf(item), t = bk.item.type;
      if (t === "artists") { var a = (pgd.artists || []).filter(function (x) { return x.slug === v; })[0]; return a ? a.name : v || "Choose an artist"; }
      if (t === "piece") { var ar = ((pgd.site || {}).articles || []).filter(function (x) { return x.slug === v; })[0]; return ar ? ar.title : v || "Choose a piece"; }
      return v || "Empty";
    }
    if (bk && bk.field === "logos") return (item && item.alt) || "Logo";
    var bt = blockTitle(item, i);
    return bk && bt === "Item " + (i + 1) ? bk.label + " " + (i + 1) : bt;
  }
  // The name a block goes by in the list: its title, name or first words.
  function blockTitle(item, i) {
    if (Array.isArray(item)) return String(item[0] || "") || "Item " + (i + 1);
    if (item && typeof item === "object") { var t = item.title || item.name || item.q || item.t || item.what || item.word || item.text || item.quote || item.link || item.caption || item.alt || ""; return String(t).replace(/<[^>]*>/g, "") || "Item " + (i + 1); }
    return "Item " + (i + 1);
  }
  function blockHidden(item) { return !!(item && typeof item === "object" && !Array.isArray(item) && item.hidden === true); }
  function blankFrom(fields) {
    var listy = function (g) { return g.type === "rows" || g.type === "lines" || g.type === "sources" || g.type === "articles"; };
    if (fields.some(function (g) { return typeof g.name === "number"; })) return fields.map(function (g) { return listy(g) ? [] : ""; });
    return fields.reduce(function (o, g) { o[g.name] = listy(g) ? [] : g.type === "yesno" ? false : g.type === "number" ? 0 : ""; return o; }, {});
  }
  function pgSummary(pgd, where, key, sec) {
    var k = pgd.kinds[sec.type]; if (!k) return "";
    var own = pgd.summaries[sumKey(pgd, where, key)];
    return own != null ? fillWords(pgd, own) : "";
  }
  // Words in curly brackets, such as {headline}, are filled in by the site from Site details.
  // The list on the left shows them filled in, as visitors see them.
  function fillWords(pgd, t) {
    var d = pgd.gam && pgd.site && pgd.site.site; if (!d || typeof t !== "string" || t.indexOf("{") < 0) return t;
    return t.replace(/\{(tagline|headline|intro|disclosure|email|published)\}/g, function (m, w) { var v = w === "published" ? pgd.site.published_text : d[w]; return v ? String(v) : m; });
  }
  // A setting that holds only {tagline}, {headline}, {intro}, {disclosure} or {email} is one of the site's shared phrases.
  function sharedWord(pgd, v) {
    var d = pgd && pgd.gam && pgd.site && pgd.site.site, m = d && typeof v === "string" && /^\s*\{(tagline|headline|intro|disclosure|email)\}\s*$/.exec(v);
    return m ? { word: m[1], value: d[m[1]] == null ? "" : String(d[m[1]]) } : null;
  }
  function pgMark(pgd) { pgd.dirty = canon(pgd.doc) !== pgd.base || JSON.stringify(pgd.pictures || {}) !== (pgd.picBase || "{}") || siteChanged(pgd) || themeDirty(); state.dirty = pgd.dirty; }
  function themeDirty() { var t = themeOf(); return !!t && themeChanges(t) > 0; }
  function siteChanged(pgd) { return !!pgd.site && JSON.stringify(pgd.site) !== pgd.siteBase; }
  function pgReset(pgd) { pgd.doc = JSON.parse(pgd.base); pgd.pictures = JSON.parse(pgd.picBase || "{}"); if (pgd.site) pgd.site = JSON.parse(pgd.siteBase); if (!atKnown(pgd)) pgd.at = ""; pgd.dirty = false; state.dirty = false; }
  // Pictures that belong to an artist or an article but show in a section of this page.
  var LATEST_DEFAULT = ["zara-muse-profile", "konn-artiss-profile", "review-anti-frieze"];
  function linkedOf(pgd, sec) {
    var P = pgd.pictures || {}, st = sec.settings || {}, all = Object.keys(P).map(function (k) { return P[k]; }), out = [], seen = {};
    var artists = all.filter(function (x) { return x.kind === "artist" && x.published; }), arts = all.filter(function (x) { return x.kind === "article" && !x.hidden; });
    function add(x, where) { if (x && !seen[x.key]) { seen[x.key] = 1; out.push({ key: x.key, label: where + x.label }); } }
    if (sec.type === "hero") {
      var a1 = P["artist:" + st.artist] && P["artist:" + st.artist].published ? P["artist:" + st.artist] : artists[0];
      var a2 = artists.find(function (a) { return a !== a1; }) || a1;
      if (!st.image) add(a1, "Banner: ");
      (st.latest && st.latest.length ? st.latest : LATEST_DEFAULT).forEach(function (sl) { add(P["article:" + sl], "Latest box: "); });
      add(a2, "Small box: ");
    } else if (sec.type === "featured") {
      var chosen = (st.artists || []).map(function (sl) { return P["artist:" + sl]; }).filter(function (x) { return x && x.published; });
      (chosen.length ? chosen : artists).forEach(function (x) { add(x, ""); });
    } else if (sec.type === "explained") {
      arts.filter(function (x) { return x.section === "explained"; }).slice(0, Number(st.count) || 2).forEach(function (x) { add(x, ""); });
    } else if (sec.type === "articles") {
      arts.filter(function (x) { return !st.section || st.section === "all" || x.section === st.section; }).slice(0, Math.max(1, Math.min(12, Number(st.count) || 3))).forEach(function (x) { add(x, ""); });
    }
    return out;
  }
  function picKind(sp) {
    var f = [{ name: "image", label: "Picture", type: "image", alt: "alt" }, { name: "alt", label: "Describe the picture", type: "text", hint: "Read aloud to people who cannot see it." }];
    if (sp.hasCredit) f.push({ name: "credit", label: "Credit under the picture", type: "text", hint: sp.kind === "artist" ? "Shown under the large picture on the portfolio and in the banner." : "Shown under the picture at the top of the article." });
    return { label: "Picture of " + sp.label, fields: f };
  }

  // ----- which page the editor is on -----
  // A page of sections (pgd.page), or with pgd.at set: "list:reviews", "article:slug", "artist:slug", or "other:standards".
  var LIST_HASH = { artists: 1, reviews: 1, explained: 1, library: 1, guides: 1, research: 1, search: 1 };
  function atKind(pgd) { return pgd.at ? pgd.at.split(":")[0] : "page"; }
  function atKey(pgd) { return pgd.at ? pgd.at.slice(pgd.at.indexOf(":") + 1) : pgd.page; }
  function atKnown(pgd) {
    var k = atKind(pgd), key = atKey(pgd);
    if (k === "page") return !!pgd.doc.pages[key];
    if (k === "list") return !!pgd.lists[key];
    if (k === "article") return !!(pgd.site && pgd.site.articles.some(function (a) { return a.slug === key; }));
    if (k === "artist") return !!(pgd.site && pgd.site.artists.some(function (a) { return a.slug === key; }));
    if (k === "site") return !!(pgd.gam && pgd.site);
    return k === "other";
  }
  function atHash(pgd) {
    var k = atKind(pgd), key = atKey(pgd);
    if (k === "site") return "site-details";
    return k === "page" ? (key === "home" ? "home" : "page-" + key) : k === "list" ? key : k === "article" ? "a-" + key : k === "artist" ? "artist-" + key : key;
  }
  function itemOf(pgd) {
    var k = atKind(pgd), key = atKey(pgd); if (!pgd.site) return null;
    if (k === "site") return pgd.site;
    if (k === "article") return pgd.site.articles.find(function (a) { return a.slug === key; }) || null;
    if (k === "artist") return pgd.site.artists.find(function (a) { return a.slug === key; }) || null;
    return null;
  }
  function itemName(pgd) { var it = itemOf(pgd), k = atKind(pgd); return k === "site" ? (pgd.model === "sad" ? "Issue details" : "Site details") : it ? (k === "artist" ? it.name : it.title) || "" : ""; }
  // Global Art Monitor's page titles are written for search results; the picker shows the first part.
  function shortTitle(pgd, t) { return pgd.gam ? String(t || "").split(" | ")[0] : t; }
  function pageLabel(pgd) {
    var k = atKind(pgd), key = atKey(pgd);
    if (k === "page") return shortTitle(pgd, (pgd.doc.pages[key] || {}).title) || key;
    if (k === "list") return pgd.lists[key].label;
    if (k === "other") return key === "not-found" ? "Page not found" : key.charAt(0).toUpperCase() + key.slice(1);
    return itemName(pgd);
  }
  // Goes to the page a link points at, as the site would.
  // On Global Art Monitor a link is a path, such as artists/zara-muse/.
  function gamWhere(pgd, path) {
    path = String(path || "").replace(/^\/+/, "").replace(/index\.html$/, ""); var m;
    if (path === "" ) return "home";
    if ((m = /^artists\/([a-z0-9-]+)\/?$/.exec(path)) && pgd.site.artists.some(function (a) { return a.slug === m[1]; })) return "artist-" + m[1];
    if ((m = /^(?:research|dispatches|urban-culture)\/([a-z0-9-]+)\/?$/.exec(path)) && pgd.site.articles.some(function (a) { return a.slug === m[1]; })) return "a-" + m[1];
    var want = path.replace(/\/?$/, "/") + "index.html", key = Object.keys(pgd.doc.pages).find(function (k) { return pgd.doc.pages[k].path === want; });
    return key ? (key === "home" ? "home" : "page-" + key) : path.replace(/[^a-z0-9-]/gi, "") || "home";
  }
  function navTo(hash, keepTpl) {
    var pgd = pgOf(); if (!pgd) return;
    hash = String(hash || "home").replace(/^#/, "");
    if (!keepTpl) pgd.tplOpen = {};
    state.tplEx = false;
    if (hash === "site-details" && pgd.gam) { pgd.at = "site:details"; pgd.sel = null; pgd.panel = ""; edRemember(); edPatch(); pushPreview(""); return; }
    pgd.at = ""; pgd.page = "home";
    if (hash.indexOf("page-") === 0 && pgd.doc.pages[hash.slice(5)]) pgd.page = hash.slice(5);
    else if (hash !== "home" && pgd.doc.pages[hash] && !pgd.gam) pgd.page = hash;
    else if (LIST_HASH[hash] && pgd.lists[hash]) pgd.at = "list:" + hash;
    else if (hash.indexOf("a-") === 0 && pgd.site) pgd.at = "article:" + hash.slice(2);
    else if (hash.indexOf("artist-") === 0 && pgd.site) pgd.at = "artist:" + hash.slice(7);
    else if (hash !== "home" && hash) pgd.at = "other:" + hash.replace(/[^a-z0-9-]/gi, "");
    if (!atKnown(pgd)) { pgd.at = ""; pgd.page = "home"; }
    pgd.sel = null; pgd.panel = ""; pgd.picker = ""; state.confirm = null; edRemember(); edPatch(); pushPreview("");
  }
  // What each site calls an artist's page.
  function artistsWord(pgd) { return pgd.model === "sad" ? "Artist profiles" : pgd.gam ? "Artist market profiles" : "Artist portfolios"; }
  function artistWord(pgd) { return pgd.model === "sad" ? "Artist profile" : pgd.gam ? "Artist market profile" : "Artist portfolio"; }


  function viewLeave() {
    return state.leave ? '<div class="sunk stack ask"><b>You have changes that are not saved yet.</b>' +
      '<div class="row"><button type="button" class="btn" data-act="leave-save">Save</button><button type="button" class="soft" data-act="leave-go">Leave without saving</button><button type="button" class="linklike" data-act="leave-stay">Keep editing</button></div></div>' : "";
  }
  function edClass(pgd, right) { return "ed" + (right ? " with-right" : "") + (pgd && pgd.leftHidden ? " noleft" : "") + (pgd && pgd.inspector === false ? " noinsp" : ""); }
  // The editor's left column: the sections of the page, the theme settings or the add-ons.
  function edLeft(pgd) {
    var p = pgd.leftPanel || "sections";
    if (p === "theme") return themePanel(pgd);
    if (p === "themeold") return '<div class="lpanel"><h2 class="lt">Theme settings</h2><p class="small">Colours and typefaces for the whole site. They move into this panel in a later step. Until then they are on the Theme screen.</p><button type="button" class="soft" data-tab="theme">Open the Theme screen</button></div>';
    if (p === "addons") return '<div class="lpanel"><h2 class="lt">Add-ons</h2><p class="small">Extra pieces for the pages of the site will be listed here. They come in a later step.</p></div>';
    return edList(pgd);
  }
  function edFrameSrc(pgd) {
    if (pgd.inspector !== false) return pgd.preview;
    if (pgd.gam) return pgd.preview; // the site opens at its home page
    var h = atHash(pgd); return pgd.preview.replace(/#.*$/, "") + (h && h !== "home" ? "#" + h : "");
  }
  function viewPagesEditor(s) {
    var pgd = pgOf();
    if (!pgd) return '<div class="ed noleft"><div class="ed-top">' + edTop(s, null) + '</div><p class="loading" style="grid-column:1/-1">Reading the pages of ' + esc(s.name) + '</p></div>';
    var right = edRight(pgd);
    return '<div class="' + edClass(pgd, right) + '">' +
      '<div class="ed-top">' + edTop(s, pgd) + '</div>' +
      '<div class="ed-left">' + edLeft(pgd) + '</div>' +
      '<div class="ed-mid">' + viewLeave() + viewAsk() + viewRemoved(pgd) + (state.notice ? '<p class="notice' + (state.notice.problem ? " problem" : "") + '" role="status">' + esc(state.notice.text) + '</p>' : "") +
        '<div class="ed-frame ' + esc(pgd.mode) + '"><iframe id="ed-frame" title="The page being edited" src="' + esc(edFrameSrc(pgd)) + '"></iframe></div><div id="ed-pick">' + edPicker(pgd) + '</div><div id="ed-fbar">' + edFloatBar(pgd) + '</div></div>' +
      (right ? '<div class="ed-right">' + right + '</div>' : "") + '</div>';
  }

  // Pages, lists, articles and portfolios, grouped for the page picker at the top.
  function pageGroups(pgd) {
    var o = function (v, label) { return { v: v, label: label }; }, g = [];
    g.push({ id: "pages", label: "Pages", icon: "doc", items: Object.keys(pgd.doc.pages).map(function (k) { return o(k === "home" ? "home" : "page-" + k, shortTitle(pgd, pgd.doc.pages[k].title) || k); }).concat([o("not-found", "Page not found")]) });
    var lists = Object.keys(pgd.lists).map(function (k) { return o(k, pgd.lists[k].label); });
    if (lists.length) g.push({ id: "lists", label: "Lists", icon: "list", items: lists });
    if (pgd.site) {
      var arts = pgd.site.articles.slice().sort(function (a, b) { return String(a.title).localeCompare(String(b.title)); });
      g.push({ id: "articles", label: "Articles", icon: "book", items: arts.map(function (a) { return o("a-" + a.slug, a.title + (a.hidden ? " (hidden)" : "")); }) });
      g.push({ id: "artists", label: artistsWord(pgd), icon: "person", items: pgd.site.artists.map(function (a) { return o("artist-" + a.slug, a.name + (pgd.gam || a.published ? "" : " (not published)")); }) });
      if (pgd.gam) g.push({ id: "site", label: "Across the site", icon: "gear", items: [o("site-details", pgd.model === "sad" ? "Issue details, archive and glossary" : "Site details, sections and glossary")] });
    }
    return g;
  }
  // The plain list behind the picker. It stays on the page, out of sight, so keyboards and checks can still use it.
  function pagePicker(pgd) {
    var cur = atHash(pgd), o = function (x) { return '<option value="' + esc(x.v) + '"' + (x.v === cur ? " selected" : "") + '>' + esc(x.label) + '</option>'; };
    var out = pageGroups(pgd).map(function (g) { return '<optgroup label="' + esc(g.label) + '">' + g.items.map(o).join("") + '</optgroup>'; }).join("");
    if (atKind(pgd) === "other" && cur !== "not-found") out += o({ v: cur, label: pageLabel(pgd) + " (not editable here)" });
    return '<select class="box pagepick" data-change="ed-goto" aria-label="Page being edited" tabindex="-1" aria-hidden="true">' + out + '</select>';
  }
  function pageIcon(pgd) { var k = atKind(pgd); return k === "page" ? (atKey(pgd) === "home" ? "home" : "doc") : { list: "list", article: "book", artist: "person", site: "gear" }[k] || "doc"; }
  // The page picker: a search box, the kinds of page, then the pages of one kind.
  // Kinds of page the sites do not have yet. Shown greyed, used by none, until they are built.
  function laterKinds(pgd) { var out = [["frame", "Artworks"], ["gallery", "Collections of works"], ["calendar", "Exhibitions"]]; if (pgd.gam && pgd.model !== "sad") out.push(["table", "Auction results"]); return out; }
  function pagePop(pgd) {
    var cur = atHash(pgd), groups = pageGroups(pgd), g = groups.find(function (x) { return x.id === state.ppGroup; }), tk = tplKinds(pgd);
    var item = function (grp) { return function (x) {
      return '<button type="button" class="pp-item' + (x.v === cur ? " on" : "") + '" data-act="ed-goto-item" data-hash="' + esc(x.v) + '" data-q="' + esc((x.label + " " + grp.label).toLowerCase()) + '">' + ic(grp.icon) + '<span class="t">' + esc(x.label) + '</span>' + (x.v === cur ? '<em>Open now</em>' : "") + '</button>'; }; };
    var kindOf = function (gid) { return gid === "articles" ? "article" : gid === "artists" ? "artist" : ""; };
    // a template line: its name, a star for the default, and how many pages use it
    var tplLine = function (k, id, inAll) {
      var t = tplAll(pgd, k)[id], n = tplUsers(pgd, k, id).length, none = !tplItems(pgd, k).length, on = tplHere(pgd) === k && tplId(pgd) === id;
      return '<button type="button" class="pp-item tpl-line' + (on ? " on" : "") + '" data-act="ed-tpl-open" data-kind="' + k + '" data-id="' + esc(id) + '"' + (inAll ? ' data-q="' + esc((t.name + " template").toLowerCase()) + '"' : "") + (none ? " disabled" : "") + '>' + ic("tpl") +
        '<span class="t"><span class="tn">' + esc(t.name) + (id === "default" ? '<span class="tpl-star" aria-label="The default template">' + ic("star", 13) + '</span>' : "") + '</span><span class="tu">Used by ' + (none ? "0" : tplWord(pgd, k, n)) + '</span></span>' + (on ? '<em>Open now</em>' : "") + '</button>';
    };
    var level;
    if (state.ppGroup === "ct") {
      level = '<button type="button" class="pp-back" data-act="ed-ppgroup" data-g="">All kinds of page</button><p class="cap">Content type templates</p>' +
        laterKinds(pgd).map(function (x) { return '<button type="button" class="pp-item" disabled>' + ic(x[0]) + '<span class="t">' + esc(x[1]) + '</span><span class="count">Comes later</span></button>'; }).join("") +
        '<p class="small pp-note">These kinds of page are built in a later step. Once one exists, its template is made here.</p>';
    } else if (g) {
      var gk = kindOf(g.id), ts = gk && tk.indexOf(gk) >= 0 ? Object.keys(tplAll(pgd, gk)) : [], empty = gk && !tplItems(pgd, gk).length;
      level = '<button type="button" class="pp-back" data-act="ed-ppgroup" data-g="">All kinds of page</button>' +
        (ts.length ? '<p class="cap">' + esc(pgd.itemKinds[gk].label) + ' templates</p>' + ts.map(function (id) { return tplLine(gk, id); }).join("") +
          '<button type="button" class="soft slim pp-make" data-act="ed-tpl-new" data-kind="' + gk + '"' + (empty ? " disabled" : "") + '>' + ic("plus", 14) + 'Create template</button>' +
          (empty ? '<p class="small pp-note">Nothing to show until there is one to fill the preview.</p>' : "") : "") +
        '<p class="cap">' + esc(g.label) + '</p>' + g.items.filter(function (x) { return x.v !== "home"; }).map(item(g)).join("");
    } else {
      level = item({ label: "Home page", icon: "home" })({ v: "home", label: "Home page" }) + groups.map(function (x) {
        var k = kindOf(x.id), nt = k && tk.indexOf(k) >= 0 ? Object.keys(tplAll(pgd, k)).length : 0, n = x.id === "pages" ? x.items.length - 1 : x.items.length;
        return '<button type="button" class="pp-item" data-act="ed-ppgroup" data-g="' + x.id + '">' + ic(x.icon) + '<span class="t">' + esc(x.label) + '</span><span class="count">' + (nt ? n + ", " + nt + (nt === 1 ? " template" : " templates") : n) + '</span></button>';
      }).join("") +
        (tk.length ? '<p class="cap">Not on this site yet</p>' + laterKinds(pgd).map(function (x) { return '<button type="button" class="pp-item" disabled>' + ic(x[0]) + '<span class="t">' + esc(x[1]) + '</span><span class="count">Used by 0</span></button>'; }).join("") +
          '<button type="button" class="soft slim pp-make" data-act="ed-ppgroup" data-g="ct">' + ic("plus", 14) + 'Create a content type template</button>' : "");
    }
    return '<div class="ed-pop pp" role="dialog" aria-label="Choose the page to edit">' +
      '<label class="pp-search">' + ic("search") + '<input type="text" id="pp-q" placeholder="Search pages, templates, articles and artists" autocomplete="off" aria-label="Search pages"></label>' +
      '<div class="pp-lvl">' + level + '</div>' +
      '<div class="pp-all" hidden>' + groups.map(function (x) { return x.items.map(function (y) { return y.v === "home" ? item({ label: "Home page", icon: "home" })({ v: "home", label: "Home page" }) : item(x)(y); }).join(""); }).join("") +
        tk.map(function (k) { return Object.keys(tplAll(pgd, k)).map(function (id) { return tplLine(k, id, true); }).join(""); }).join("") + '<p class="small pp-none" hidden>Nothing matches that.</p></div>' +
      '<button type="button" class="pp-item pp-new" data-act="ed-new">' + ic("plus") + '<span class="t">Make something new</span></button></div>';
  }
  // The web address of this page on the live site.
  function liveHref(s, pgd) {
    var base = "https://" + String(s.domain || "").replace(/^https?:\/\//, "").replace(/\/+$/, "") + "/";
    if (!pgd) return base;
    var k = atKind(pgd), key = atKey(pgd);
    if (!pgd.gam) { var h = atHash(pgd); return h === "home" || h === "site-details" ? base : base + "#" + h; }
    if (k === "page") return base + String((pgd.doc.pages[key] || {}).path || "").replace(/index\.html$/, "");
    if (k === "artist") return base + "artists/" + key + "/";
    if (k === "article") { var a = itemOf(pgd) || {}; return base + (pgd.model === "sad" ? (a.section || "dispatches") : "research") + "/" + key + "/"; }
    return base;
  }
  var ED_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
  var ED_CTRL = ED_MAC ? "Cmd" : "Ctrl";
  var ED_KEYS = [[ED_CTRL + "+Alt+1", "Sections"], [ED_CTRL + "+Alt+2", "Theme settings"], [ED_CTRL + "+Alt+3", "Add-ons"], [ED_CTRL + "+Shift+I, or Alt+Shift+I", "Inspector on or off"], ["Escape", "Close a menu"]];
  function sitePop(s) {
    var c = curCopy(), list = isAdmin() ? copiesOf(s) : [c];
    return '<div class="ed-pop sp" role="dialog" aria-label="Which copy you are working on"><p class="cap">Working on</p>' +
      list.map(function (x) {
        var nm = !isAdmin() ? "Your copy" : x.kind === "live" ? "Live site" : "Trial: " + x.name;
        return '<button type="button" class="pp-item' + (x.id === c.id ? " on" : "") + '" data-act="ed-copy" data-copy="' + esc(x.kind === "live" ? "" : x.id) + '"><i class="lamp ' + (x.kind === "live" ? "g" : "a") + '" aria-hidden="true"></i><span class="t">' + esc(nm) + '</span>' + (x.id === c.id ? '<em>Open now</em>' : "") + '</button>';
      }).join("") +
      '<button type="button" class="pp-item" data-tab="overview">' + ic("copy") + '<span class="t">' + (isAdmin() ? "Live site and trial copies" : "About your copy") + '</span></button></div>';
  }
  function morePop(s, pgd) {
    var keys = state.edMenu === "keys", help = state.edMenu === "help";
    var body = keys ? '<p class="cap">Keyboard shortcuts</p>' + ED_KEYS.map(function (k) { return '<div class="pp-item still"><span class="t">' + esc(k[1]) + '</span><span class="kbd">' + esc(k[0]) + '</span></div>'; }).join("")
      : help ? '<p class="cap">Help</p><p class="pop-note">Click a part of the page, or a row on the left, to change it. Save keeps your changes on the copy you are working on. On a trial copy, Make live puts them on the site.</p><p class="pop-note">The hover outlines and clicks on the page come from the inspector. Turn it off to use the page as a visitor would.</p>'
      : '<button type="button" class="pp-item" disabled>' + ic("code") + '<span class="t">Edit code</span><em>Later step</em></button>' +
        '<button type="button" class="pp-item" disabled>' + ic("text") + '<span class="t">Edit default text</span><em>Later step</em></button>' +
        '<a class="pp-item" href="' + esc(liveHref(s, pgd)) + '" target="_blank" rel="noopener">' + ic("globe") + '<span class="t">View the live page</span></a>' +
        '<button type="button" class="pp-item" data-act="ed-pop" data-menu="help">' + ic("help") + '<span class="t">Help</span></button>' +
        '<button type="button" class="pp-item" data-act="ed-pop" data-menu="keys">' + ic("keys") + '<span class="t">Keyboard shortcuts</span></button>';
    return '<div class="ed-pop mp" role="dialog" aria-label="More">' + (keys || help ? '<button type="button" class="pp-back" data-act="ed-pop" data-menu="more">Back to More</button>' : "") + body +
      '<p class="pop-foot"><span>' + esc(s.name) + ' theme</span><span>Version ' + VERSION + '</span></p></div>';
  }
  function savePop(s, pgd, c) {
    var dirty = pgd && pgd.dirty, trial = c.kind === "trial", out = '<button type="button" class="pp-item" disabled>' + ic("calendar") + '<span class="t">Publish later</span><em>Later step</em></button>';
    if (dirty) out += '<button type="button" class="pp-item" data-act="ed-save">' + ic("doc") + '<span class="t">Save</span></button>';
    if (dirty && !isAdmin()) out += '<button type="button" class="pp-item" data-act="ed-save-publish">' + ic("globe") + '<span class="t">Save and publish</span></button>';
    if (!dirty && trial && c.ahead) out += '<button type="button" class="pp-item" data-act="ask-makelive">' + ic("globe") + '<span class="t">' + (isAdmin() ? "Make live" : "Publish") + '</span></button>';
    if (!isAdmin() && c.behind) out += '<button type="button" class="pp-item" data-act="refresh-copy" data-copy="' + esc(c.id) + '">' + ic("copy") + '<span class="t">Bring my copy up to date</span></button>';
    if (dirty) out += '<button type="button" class="pp-item danger" data-act="ed-discard">' + ic("bin") + '<span class="t">Discard changes</span></button>';
    out += '<button type="button" class="pp-item" data-tab="versions">' + ic("clock") + '<span class="t">See the versions</span></button>';
    return '<div class="ed-pop svp" role="dialog" aria-label="Other ways to save">' + out + '</div>';
  }
  // The top bar of the page editor.
  function edTop(s, pgd) {
    var c = curCopy(), trial = c.kind === "trial", saving = state.status === "saving", dirty = !!(pgd && pgd.dirty), m = state.edMenu || "";
    var n = function (x) { return x + (x === 1 ? " change" : " changes"); };
    var said = saving ? "Saving" : dirty ? "Edited, not saved" : state.flash || (!isAdmin() && c.behind ? "The live site has moved on" : trial || !isAdmin() ? (c.ahead ? n(c.ahead) + (isAdmin() ? " on this copy" : " not published yet") : "Same as the live site") : "All saved");
    var copyName = !isAdmin() ? "Your copy" : trial ? "Trial copy: " + c.name : "Live", panel = pgd ? pgd.leftPanel || "sections" : "sections", leftOn = pgd ? !pgd.leftHidden : true;
    var sw = function (id, icon, label, key) { var on = leftOn && panel === id; return '<button type="button" class="tb' + (on ? " on" : "") + '" data-act="ed-panel" data-panel="' + id + '" aria-pressed="' + on + '" aria-label="' + label + '" data-tip="' + label + '" data-key="' + key + '">' + ic(icon, 17) + '</button>'; };
    var insp = !pgd || pgd.inspector !== false;
    return '<div class="lefty"><button type="button" class="tb word ed-exit" data-tab="overview" title="Back to the overview">' + ic("exit", 17) + '<span>Exit</span></button>' +
        '<div class="seg tbs" role="group" aria-label="Left panel">' + sw("sections", "layout", "Sections", ED_CTRL + "+Alt+1") + sw("theme", "palette", "Theme settings", ED_CTRL + "+Alt+2") + sw("addons", "addons", "Add-ons", ED_CTRL + "+Alt+3") + '</div></div>' +
      '<div class="mid">' +
        '<span class="popat"><button type="button" class="tb word ed-sitebtn' + (m === "site" ? " on" : "") + '" data-act="ed-pop" data-menu="site" aria-haspopup="dialog" aria-expanded="' + (m === "site") + '"><span class="ed-site">' + esc(s.name) + '</span><i class="lamp ' + (trial ? "a" : "g") + '" aria-hidden="true"></i><span class="copyname" title="' + esc(copyName) + '">' + esc(copyName) + '</span></button>' + (m === "site" ? sitePop(s) : "") + '</span>' +
        (pgd ? '<span class="popat"><button type="button" class="tb word ed-pagebtn' + (m === "page" ? " on" : "") + '" data-act="ed-pop" data-menu="page" aria-haspopup="dialog" aria-expanded="' + (m === "page") + '">' + ic(tplHere(pgd) ? "tpl" : pageIcon(pgd), 16) + '<span class="pn">' + esc(tplHere(pgd) ? tplCur(pgd).name : pageLabel(pgd)) + '</span><span class="ch">Change</span></button>' + pagePicker(pgd) + (m === "page" ? pagePop(pgd) : "") + '</span>' : "") +
      '</div>' +
      '<div class="righty">' +
        '<button type="button" class="tb word insp" data-act="ed-inspector" role="switch" aria-checked="' + insp + '" title="Inspector: pick parts of the page by clicking them (' + ED_CTRL + '+Shift+I)">' + ic("cursor", 16) + '<span class="lbl">Inspector</span><span class="sw2' + (insp ? "" : " off") + '" aria-hidden="true"><i></i></span></button>' +
        '<div class="seg tbs" role="group" aria-label="Screen size"><button type="button" class="tb word' + (!pgd || pgd.mode === "computer" ? " on" : "") + '" data-act="ed-mode" data-mode="computer" aria-label="Computer view" title="Computer view">' + ic("monitor", 17) + '<span class="lbl">Computer</span></button><button type="button" class="tb word' + (pgd && pgd.mode === "phone" ? " on" : "") + '" data-act="ed-mode" data-mode="phone" aria-label="Phone view" title="Phone view">' + ic("phone", 17) + '<span class="lbl">Phone</span></button></div>' +
        '<button type="button" class="tb word" data-act="undo-step" aria-label="Undo" title="Undo"' + ((trial ? c.ahead > 0 : (c.steps || []).length > 0) && !saving ? "" : " disabled") + '>' + ic("undo", 16) + '<span class="lbl">Undo</span></button>' +
        '<button type="button" class="tb word" data-act="redo-step" aria-label="Redo" title="Redo"' + (c.canRedo && !saving ? "" : " disabled") + '>' + ic("redo", 16) + '<span class="lbl">Redo</span></button>' +
        '<span class="popat"><button type="button" class="tb word' + (m === "more" || m === "keys" || m === "help" ? " on" : "") + '" data-act="ed-pop" data-menu="more" aria-haspopup="dialog" aria-label="More" title="More">' + ic("dots", 17) + '<span class="lbl">More</span></button>' + (m === "more" || m === "keys" || m === "help" ? morePop(s, pgd) : "") + '</span>' +
        (dirty ? '<button type="button" class="tb word" data-act="ed-discard">Discard</button>' + (!isAdmin() ? '<button type="button" class="tb word" data-act="ed-save-publish"' + (saving ? " disabled" : "") + '>Save and publish</button>' : "")
          : !isAdmin() && c.behind ? '<button type="button" class="tb word" data-act="refresh-copy" data-copy="' + esc(c.id) + '">Bring my copy up to date</button>' + (c.ahead ? '<button type="button" class="tb word" data-act="ask-makelive">Publish</button>' : "")
          : trial && c.ahead ? '<button type="button" class="tb word" data-act="ask-makelive">' + (isAdmin() ? "Make live" : "Publish") + '</button>' : "") +
        '<span class="state" id="island-text" title="' + esc(said) + '">' + (dirty || saving ? '<i class="lamp a" aria-hidden="true"></i>' : "") + esc(said) + '</span>' +
        '<span class="popat split"><button type="button" class="btn" data-act="ed-save"' + (dirty && !saving ? "" : " disabled") + '>Save</button><button type="button" class="btn sm" data-act="ed-pop" data-menu="save" aria-haspopup="dialog" aria-label="Other ways to save" title="Other ways to save">' + ic("dots", 16) + '</button>' + (m === "save" ? savePop(s, pgd, c) : "") + '</span>' +
      '</div>';
  }
  // The eye and the bin on a row of the list. The bin only on what can be removed.
  function rowTools(pgd, where, id, bf, block, off, canHide, canDel, word) {
    var d = ' data-where="' + where + '" data-id="' + esc(id) + '"' + (bf ? ' data-bf="' + esc(bf) + '"' : "") + (block != null ? ' data-block="' + block + '"' : "");
    return '<span class="rtools' + (off ? " keep" : "") + '">' +
      (canHide ? '<button type="button" class="rb' + (off ? " is-off" : "") + '" data-act="ed-row-hide"' + d + ' aria-label="' + (off ? "Show" : "Hide") + ' this ' + word + '" title="' + (off ? "Hidden. Show it" : "Hide") + '">' + ic(off ? "eyeoff" : "eye", 15) + (off ? '<span class="vh">Hidden</span>' : "") + '</button>' : (off ? '<span class="rb is-off" title="Hidden">' + ic("eyeoff", 15) + '<span class="vh">Hidden</span></span>' : "")) +
      (canDel ? '<button type="button" class="rb del" data-act="ed-row-del"' + d + ' aria-label="Remove this ' + word + '" title="Remove">' + ic("bin", 15) + '</button>' : "") + '</span>';
  }
  // ----- the sections list: groups, rows, blocks -----
  // Sections shared by every page sit in two groups, at the top and at the bottom; the page's own are in between.
  // ----- templates: the sections article and artist pages are drawn with, around the page's own content ("main") -----
  var TPL_KINDS = ["article", "artist"];
  function tplDefaultName(ik, kind) { var l = String(((ik || {})[kind] || {}).label || kind).toLowerCase(); return ("Default " + l).length <= 25 ? "Default " + l : ("Default " + l.replace(/^artist /, "")).slice(0, 25); }
  function tplNormal(doc, ik) {
    if (!doc || !ik) return;
    var kinds = TPL_KINDS.filter(function (k) { return ik[k]; }); if (!kinds.length) return;
    doc.templates = doc.templates && typeof doc.templates === "object" ? doc.templates : {}; doc.assign = doc.assign && typeof doc.assign === "object" ? doc.assign : {};
    kinds.forEach(function (k) {
      var all = doc.templates[k] = doc.templates[k] && typeof doc.templates[k] === "object" ? doc.templates[k] : {};
      if (!all["default"]) { var rest = all; all = { "default": { name: tplDefaultName(ik, k), sections: [{ id: "main", type: "main" }] } }; Object.keys(rest).forEach(function (id) { all[id] = rest[id]; }); doc.templates[k] = all; }
      doc.assign[k] = doc.assign[k] && typeof doc.assign[k] === "object" ? doc.assign[k] : {};
    });
  }
  function tplKinds(pgd) { return pgd.itemKinds && pgd.doc.templates ? TPL_KINDS.filter(function (k) { return pgd.itemKinds[k] && pgd.doc.templates[k]; }) : []; }
  function tplAll(pgd, kind) { return ((pgd.doc.templates || {})[kind]) || {}; }
  function tplAssigned(pgd, kind, slug) { var id = (((pgd.doc.assign || {})[kind]) || {})[slug]; return id && tplAll(pgd, kind)[id] ? id : "default"; }
  function tplItems(pgd, kind) { return !pgd.site ? [] : kind === "artist" ? pgd.site.artists || [] : pgd.site.articles || []; }
  function tplUsers(pgd, kind, id) { return tplItems(pgd, kind).filter(function (x) { return tplAssigned(pgd, kind, x.slug) === id; }); }
  function tplHere(pgd) { var k = atKind(pgd); return (k === "article" || k === "artist") && tplKinds(pgd).indexOf(k) >= 0 ? k : ""; }
  function tplId(pgd) { var k = tplHere(pgd); if (!k) return ""; var o = (pgd.tplOpen || {})[k]; return o && tplAll(pgd, k)[o] ? o : tplAssigned(pgd, k, atKey(pgd)); }
  function tplCur(pgd) { var k = tplHere(pgd); return k ? tplAll(pgd, k)[tplId(pgd)] || null : null; }
  function tplOne(pgd, kind) { return kind === "article" ? "article" : pgd.model === "sad" ? "artist profile" : pgd.gam ? "market profile" : "portfolio"; }
  function tplWord(pgd, kind, n) { return n + " " + tplOne(pgd, kind) + (n === 1 ? "" : "s"); }
  function tplItemName(kind, x) { return kind === "artist" ? x.name : x.title; }
  // A short name for a new template, from the name typed: letters, digits and hyphens, not used yet.
  function tplNewId(pgd, kind, name) {
    var base = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "template", id = base, n = 2;
    if (id === "default") id = base = "template";
    while (tplAll(pgd, kind)[id]) id = base + "-" + n++;
    return id;
  }
  function isGroup(where) { return where === "top" || where === "bottom" || where === "popups"; }
  function isSecList(where) { return where === "page" || where === "tpl" || isGroup(where); }
  function secList(pgd, where) {
    if (where === "tpl") { var tc = tplCur(pgd); if (!tc) return []; if (!Array.isArray(tc.sections)) tc.sections = [{ id: "main", type: "main" }]; return tc.sections; }
    if (isGroup(where)) { if (!pgd.doc.groups) pgd.doc.groups = { top: [], popups: [], bottom: [] }; if (!pgd.doc.groups[where]) pgd.doc.groups[where] = []; return pgd.doc.groups[where]; }
    return pgSections(pgd);
  }
  function groupOf(pgd, id) { var g = pgd.doc.groups || {}; return ["top", "popups", "bottom"].filter(function (w) { return (g[w] || []).some(function (x) { return x.id === id; }); })[0] || ""; }
  function sumKey(pgd, where, id) { return where === "shared" ? "shared:" + id : isGroup(where) ? "every:" + id : where === "tpl" ? "tpl:" + tplHere(pgd) + ":" + tplId(pgd) + ":" + id : pgd.page + ":" + id; }
  function builtInPage(pgd, key) { var built = pgd.builtIn && pgd.builtIn.length ? pgd.builtIn : pgd.gam ? Object.keys(GAM_BUILT_IN) : ["home", "standards"]; return built.indexOf(key) >= 0; }
  // The page's own content, on a page the site was built with: it can be hidden and moved, never removed. The server keeps the same rule.
  function mainId(pgd) {
    if (atKind(pgd) !== "page" || pgd.page === "home") return "";
    var built = pgd.builtIn && pgd.builtIn.length ? pgd.builtIn : pgd.gam ? Object.keys(GAM_BUILT_IN) : ["standards"];
    if (built.indexOf(pgd.page) < 0) return "";
    if (!pgd.mainCache || pgd.mainCache.base !== pgd.base) pgd.mainCache = { base: pgd.base, pages: JSON.parse(pgd.base || "{}").pages || {} };
    var saved = ((pgd.mainCache.pages[pgd.page] || {}).sections || []).filter(function (x) { return x && ["page-head", "page-heading", "announcement"].indexOf(x.type) < 0; })[0];
    return saved ? saved.id : "";
  }
  // The name a section goes by in the list: the one given to it, or its kind.
  function secName(pgd, sec) { if (sec && sec.type === "main") { var mk = tplHere(pgd); return mk ? pgd.itemKinds[mk].label : "Page's own content"; } return (sec && sec.name) || ((pgd.kinds[sec.type] || {}).label) || sec.type; }
  function blockPic(item) { return item && typeof item === "object" && !Array.isArray(item) ? item.image || item.photo || "" : ""; }
  // A block row reads "Kind: first words", with a small picture when it has one.
  function blockRowName(pgd, bk, item, i) {
    var t = bTitle(pgd, bk, item, i);
    if (bk.one || bk.item || t === bk.label + " " + (i + 1)) return t;
    t = String(t).replace(/\s+/g, " ").trim(); if (t.length > 42) t = t.slice(0, 40).replace(/\s+\S*$/, "") + "…";
    return bk.label + ": " + t;
  }
  function edRow(pgd, where, id, sec, picked) {
    var k = pgd.kinds[sec.type] || { label: sec.type }, hidden = sec.visible === false, kinds = bkinds(k), st = sec.settings || {};
    var listy = isSecList(where), main = where === "page" && id === mainId(pgd), openKey = where + ":" + id;
    var opens = pgd.open || {}, open = openKey in opens ? !!opens[openKey] : picked;
    var count = 0; kinds.forEach(function (bk) { count += bk.one ? 1 : (Array.isArray(st[bk.field]) ? st[bk.field].length : 0); });
    var renaming = state.renaming && !state.renaming.panel && state.renaming.where === where && state.renaming.id === id;
    var name = renaming ? '<input type="text" class="rename" id="ed-rename" value="' + esc(secName(pgd, sec)) + '" maxlength="40" aria-label="Name in this list">' : esc(secName(pgd, sec));
    var row = '<div class="sec' + (picked && pgd.sel.block == null && !pgd.sel.pic ? " on" : "") + (hidden ? " off" : "") + (main ? " main" : "") + '" data-act="ed-pick" data-where="' + where + '" data-id="' + esc(id) + '"' + (listy ? ' draggable="true"' : "") + '>' +
      (listy ? '<span class="grip" aria-hidden="true" title="Drag to move"><i></i><i></i><i></i><i></i><i></i><i></i></span>' : "") +
      kindIc(sec.type) + '<span class="nm">' + name + '<small id="sum-' + esc(where + "-" + id) + '">' + esc(main ? "The page's own content. It can be hidden or moved, not removed." : pgSummary(pgd, where, id, sec)) + '</small></span>' +
      (kinds.length ? '<button type="button" class="cnt" data-act="ed-expand" data-key="' + esc(openKey) + '" aria-expanded="' + open + '" title="' + (open ? "Close the blocks" : "Open the blocks") + '">' + count + (count === 1 ? " block" : " blocks") + '</button>' : "") +
      rowTools(pgd, where, id, "", null, hidden, true, listy && !main, "section") + '</div>';
    if (!kinds.length || !open) return row;
    var sel = pgd.sel || {}, rows = "";
    var full = function (bk, n) { return !!(bk.max && n >= bk.max); };
    var ins = function (bf, at) { return '<button type="button" class="ins" data-act="ed-blockpicker" data-where="' + where + '" data-id="' + esc(id) + '" data-bf="' + esc(bf) + '" data-at="' + at + '" aria-label="Add a block here" title="Add a block here"><i aria-hidden="true">+</i></button>'; };
    var anyRoom = false;
    kinds.forEach(function (bk) {
      var mine = picked && sel.block != null && (sel.bf || kinds[0].field) === bk.field;
      if (bk.one) {
        var off = !!st[bk.hide];
        rows += '<div class="sec blk' + (mine ? " on" : "") + (off ? " off" : "") + '" data-act="ed-pick" data-where="' + where + '" data-id="' + esc(id) + '" data-bf="' + esc(bk.field) + '" data-block="0">' + blockIc(bk) +
          '<span class="nm">' + esc(bk.label) + '</span>' + rowTools(pgd, where, id, bk.field, 0, off, !!bk.hide, false, bk.label.toLowerCase()) + '</div>';
        return;
      }
      var list = Array.isArray(st[bk.field]) ? st[bk.field] : [], room = !full(bk, list.length);
      if (room) anyRoom = true;
      list.forEach(function (item, i) {
        var on = mine && sel.block === i && sel.sub == null, off = blockHidden(item), pic = blockPic(item);
        var kids = (bk.blocks || []), ckey = where + ":" + id + ":" + bk.field + ":" + i, inMe = mine && sel.block === i;
        var kidsOpen = kids.length && (ckey in opens ? !!opens[ckey] : inMe), kidN = 0;
        kids.forEach(function (c) { kidN += Array.isArray((item || {})[c.field]) ? item[c.field].length : 0; });
        rows += (room ? ins(bk.field, i) : "") + '<div class="sec blk' + (on ? " on" : "") + (off ? " off" : "") + '" data-act="ed-pick" data-where="' + where + '" data-id="' + esc(id) + '" data-bf="' + esc(bk.field) + '" data-block="' + i + '" draggable="true">' +
          '<span class="grip" aria-hidden="true" title="Drag to move"><i></i><i></i><i></i><i></i><i></i><i></i></span>' +
          (pic ? '<img class="mini" src="' + esc(imageSrc(pgd, pic)) + '" alt="">' : blockIc(bk)) +
          '<span class="nm">' + esc(blockRowName(pgd, bk, item, i)) + '</span>' +
          (kids.length ? '<button type="button" class="cnt" data-act="ed-expand" data-key="' + esc(ckey) + '" aria-expanded="' + !!kidsOpen + '" title="' + (kidsOpen ? "Close" : "Open") + '">' + kidN + " " + (kidN === 1 ? kids[0].label.toLowerCase() : kids[0].label.toLowerCase() + "s") + '</button>' : "") +
          rowTools(pgd, where, id, bk.field, i, off, !Array.isArray(item), true, bk.label.toLowerCase()) + '</div>';
        if (kidsOpen) kids.forEach(function (c) {
          var cl = Array.isArray((item || {})[c.field]) ? item[c.field] : [], cfull = !!(c.max && cl.length >= c.max);
          cl.forEach(function (citem, j) {
            var con = inMe && sel.sf === c.field && sel.sub === j, coff = blockHidden(citem);
            var d = ' data-where="' + where + '" data-id="' + esc(id) + '" data-bf="' + esc(bk.field) + '" data-block="' + i + '" data-sf="' + esc(c.field) + '" data-sub="' + j + '"';
            rows += '<div class="sec blk kid' + (con ? " on" : "") + (coff ? " off" : "") + '" data-act="ed-pick"' + d + ' draggable="true"><span class="grip" aria-hidden="true" title="Drag to move"><i></i><i></i><i></i><i></i><i></i><i></i></span>' + blockIc(c) +
              '<span class="nm">' + esc(blockRowName(pgd, c, citem, j)) + '</span><span class="rtools"><button type="button" class="rb del" data-act="ed-row-del"' + d + ' aria-label="Remove this ' + esc(c.label.toLowerCase()) + '" title="Remove">' + ic("bin", 15) + '</button></span></div>';
          });
          rows += '<button type="button" class="addl blk kid" data-act="ed-childadd" data-where="' + where + '" data-id="' + esc(id) + '" data-bf="' + esc(bk.field) + '" data-block="' + i + '" data-sf="' + esc(c.field) + '"' + (cfull ? " disabled" : "") + '>' + ic("plus", 14) + esc((c.add || "Add a " + c.label.toLowerCase()) + (c.max ? " (" + cl.length + " of " + c.max + ")" : "")) + '</button>';
        });
      });
      if (room && list.length) rows += ins(bk.field, list.length);
    });
    var adds = kinds.filter(function (bk) { return !bk.one; }).map(function (bk) {
      var n = (Array.isArray(st[bk.field]) ? st[bk.field] : []).length, isFull = full(bk, n), word = bk.add || "Add a " + bk.label.toLowerCase();
      return { bk: bk, n: n, full: isFull, word: word + (bk.max ? " (" + n + " of " + bk.max + ")" : "") };
    });
    var addBtns = adds.length > 1 || (adds.length === 1 && adds[0].full)
      ? adds.map(function (a) { return '<button type="button" class="addl blk" data-act="ed-blockpicker" data-where="' + where + '" data-id="' + esc(id) + '" data-bf="' + esc(a.bk.field) + '"' + (a.full ? " disabled" : "") + '>' + ic("plus", 14) + esc(a.word) + '</button>'; }).join("")
      : '<button type="button" class="addl blk" data-act="ed-blockpicker" data-where="' + where + '" data-id="' + esc(id) + '"' + (anyRoom || !adds.length ? "" : " disabled") + '>' + ic("plus", 14) + (adds.length === 1 && adds[0].bk.max ? esc(adds[0].word) : "Add a block") + '</button>';
    return row + '<div class="blocks" data-where="' + where + '" data-id="' + esc(id) + '">' + rows + addBtns + '</div>';
  }
  function secIns(at, g) { return '<button type="button" class="ins" data-act="ed-secpicker" data-g="' + (g || "page") + '" data-at="' + at + '" aria-label="Add a section here" title="Add a section here"><i aria-hidden="true">+</i></button>'; }
  // One of the three lists of sections: the top group, this page, or the bottom group.
  function secRows(pgd, where) {
    var sel = pgd.sel || {}, list = secList(pgd, where);
    return '<div class="dl"' + (where === "page" ? ' id="ed-sections"' : "") + ' data-g="' + where + '">' + (where === "page" || list.length ? secIns(0, where) : "") +
      list.map(function (x, i) { return '<div class="secwrap">' + edRow(pgd, where, x.id, x, sel.where === where && sel.id === x.id) + '</div>' + secIns(i + 1, where); }).join("") + '</div>';
  }
  function addSecBtn(pgd, where) {
    var sel = pgd.sel || {}, list = secList(pgd, where), at = sel.where === where ? list.findIndex(function (x) { return x.id === sel.id; }) + 1 || list.length : list.length;
    return '<button type="button" class="addl" data-act="ed-secpicker" data-g="' + where + '" data-at="' + at + '">' + ic("plus") + (where === "popups" ? "Add a popup" : "Add a section") + '</button>';
  }
  function edShared(pgd, keys) {
    var sel = pgd.sel || {}, sh = pgd.doc.shared || {};
    return keys.filter(function (k) { return sh[k]; }).map(function (k) { return edRow(pgd, "shared", k, sh[k], sel.where === "shared" && sel.id === k); }).join("");
  }
  function plainWords(html) { return String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
  function partSummary(pgd, part, it) {
    var k = atKind(pgd), n = function (x, one, many) { return x + " " + (x === 1 ? one : many); };
    if (part.picture) { var ps = pgd.pictures[k + ":" + atKey(pgd)]; return ps && ps.image ? "Chosen" : "No picture yet"; }
    if (part.id === "picture") return it.image ? "Chosen" : "No picture yet";
    if (k === "site" && pgd.model === "sad") return part.id === "details" ? [(it.site || {}).desk, (it.site || {}).date].filter(Boolean).join(", ") : part.blocks ? n((it[part.blocks.field] || []).length, part.blocks.label.toLowerCase(), part.blocks.label.toLowerCase() + "s") : "";
    if (k === "site") return part.id === "details" ? (it.site || {}).name || "" : part.id === "sections" ? (it.sections || []).length + " sections" : (it.glossary || []).length + " terms";
    if (part.id === "about") return (it.body || []).length + " paragraphs";
    if (part.id === "words") return k === "artist" ? (it.tag || it.role || "") : (it.kicker || "");
    if (part.id === "body") return n(plainWords(it.body).split(" ").filter(Boolean).length, "word", "words");
    if (part.id === "sources") return n((it.sources || []).length, "source", "sources");
    if (part.id === "settings") return k === "article" ? (it.hidden ? "Hidden from the site" : "Shown on the site") : (it.published ? "Portfolio shown" : "Not published yet");
    if (part.id === "words" && pgd.gam) return k === "artist" ? (it.line || "") : (it.kicker || "");
    if (part.blocks) return n((it[part.blocks.field] || []).length, part.blocks.label.toLowerCase(), part.blocks.label.toLowerCase() + "s");
    return "";
  }
  var PART_IC = { words: "text", picture: "picture", body: "text", sources: "links", settings: "gear", about: "person", details: "gear", sections: "list", glossary: "book", sales: "table", works: "picture", timeline: "clock", glance: "list" };
  function edPartRow(pgd, part, it) {
    var sel = pgd.sel || {}, picked = sel.where === "item" && sel.id === part.id;
    var row = '<div class="sec' + (picked && sel.block == null ? " on" : "") + '" data-act="ed-pick" data-where="item" data-id="' + esc(part.id) + '"><span class="kic">' + ic(PART_IC[part.id] || "block") + '</span>' +
      '<span class="nm">' + esc(part.label) + '<small>' + esc(partSummary(pgd, part, it)) + '</small></span></div>';
    var bk = part.blocks, list = bk ? it[bk.field] : null;
    if (!bk || !picked) return row;
    return row + '<div class="blocks">' + (Array.isArray(list) ? list : []).map(function (item, i) {
      var off = blockHidden(item);
      return '<div class="sec blk' + (sel.block === i ? " on" : "") + (off ? " off" : "") + '" data-act="ed-pick" data-where="item" data-id="' + esc(part.id) + '" data-block="' + i + '">' +
        '<span class="dot" aria-hidden="true"></span><span class="nm">' + esc(blockTitle(item, i)) + '</span>' + (off ? '<span class="eye">Hidden</span>' : "") + '</div>';
    }).join("") + '<button type="button" class="addl blk" data-act="ed-add-block" data-where="item" data-id="' + esc(part.id) + '">' + ic("plus", 14) + esc(bk.add) + '</button></div>';
  }
  function edList(pgd) {
    var sel = pgd.sel || {}, k = atKind(pgd), key = atKey(pgd), s = site(), mid = "";
    var kindWord = { page: key === "home" ? "Home page" : "Page", list: "List page", article: "Article", artist: artistWord(pgd), site: "Used on every page", other: "Page" }[k];
    if (k === "page") {
      mid = (key !== "home" || pgd.gam ? '<div class="sec' + (sel.where === "pageinfo" ? " on" : "") + '" data-act="ed-pick" data-where="pageinfo" data-id="' + esc(key) + '">' + '<span class="kic">' + ic("gear") + '</span><span class="nm">Page settings<small>' + (pgd.gam ? "Title and description for search engines" : "Title, menu bar, delete") + '</small></span></div>' : "") +
        '<div class="grp">This page</div>' + secRows(pgd, "page") + addSecBtn(pgd, "page");
    } else if (k === "list") {
      var l = pgd.lists[key], entries = !pgd.site ? [] : key === "artists"
        ? pgd.site.artists.map(function (a) { return { hash: "artist-" + a.slug, title: a.name, note: a.published ? "" : "Not published" }; })
        : l.section ? pgd.site.articles.filter(function (a) { return a.section === l.section; }).map(function (a) { return { hash: "a-" + a.slug, title: a.title, note: a.hidden ? "Hidden" : "" }; }) : [];
      mid = '<div class="grp">This page</div><div class="sec' + (sel.where === "list" ? " on" : "") + '" data-act="ed-pick" data-where="list" data-id="' + esc(key) + '"><span class="kic">' + ic("heading") + '</span><span class="nm">Page heading<small>' + esc(((pgd.doc.lists || {})[key] || {}).eyebrow || "") + '</small></span></div>' +
        (pgd.site && (key === "artists" || l.section) ? '<div class="grp">In this list</div>' + entries.map(function (x) {
          return '<button type="button" class="sec plain go" data-act="ed-go" data-hash="' + esc(x.hash) + '"><span class="nm">' + esc(x.title) + (x.note ? '<small>' + esc(x.note) + '</small>' : "") + '</span><span class="eye">Open</span></button>';
        }).join("") + '<button type="button" class="addl" data-act="ed-new" data-what="' + (key === "artists" ? "artist" : "article") + '" data-section="' + esc(l.section || "") + '">' + ic("plus") + (key === "artists" ? "Add an artist" : "Add an article to this list") + '</button>' : "");
    } else if (tplHere(pgd)) {
      mid = '<div class="grp">Template</div>' + tplRows(pgd) + addSecBtn(pgd, "tpl");
    } else if (k === "article" || k === "artist" || k === "site") {
      var it = itemOf(pgd), ik = pgd.itemKinds[k];
      mid = '<div class="grp">' + ({ article: "This article", artist: pgd.model === "sad" ? "This profile" : pgd.gam ? "This market profile" : "This portfolio", site: "Across the whole site" })[k] + '</div>' + ik.parts.map(function (part) { return edPartRow(pgd, part, it); }).join("");
    } else {
      // a fixed page: what is there is listed, and nothing can be added
      mid = '<div class="grp">This page</div><div class="sec fixed"><span class="kic">' + ic("doc") + '</span><span class="nm">' + esc(pageLabel(pgd)) + '<small>Drawn by the site itself, so nothing can be added or changed here. The sections shared by every page can.</small></span></div>';
    }
    var edits = s && s.edits;
    // a page with its own layout has no menu bar, footer or shared sections; popups show everywhere
    var own = k === "page" && !!(pgd.doc.pages[key] || {}).own;
    // the page's own settings sit under its name, above the groups
    var cut = k === "page" ? mid.indexOf('<div class="grp">This page</div>') : -1, pset = cut > 0 ? mid.slice(0, cut) : "";
    if (cut > 0) mid = mid.slice(cut);
    if (own) kindWord = "Page with its own layout";
    var head = tplHere(pgd) ? tplHead(pgd) : '<div class="lt">' + esc(pageLabel(pgd)) + '</div><span class="small lkind">' + esc(kindWord) + '</span>';
    return head + pset +
      (own ? "" : '<div class="grp">Top of every page</div>' + edShared(pgd, ["opening", "header"]) + secRows(pgd, "top") + addSecBtn(pgd, "top")) +
      '<div class="grp">Popups</div>' + secRows(pgd, "popups") + addSecBtn(pgd, "popups") + mid +
      (own ? "" : '<div class="grp">Bottom of every page</div>' + secRows(pgd, "bottom") + edShared(pgd, ["footer"]) + addSecBtn(pgd, "bottom")) +
      '';
  }
  // The top of the list on an article or artist page: the template's name, how many use it, and which one is shown.
  function tplHead(pgd) {
    var k = tplHere(pgd), id = tplId(pgd), t = tplCur(pgd), n = tplUsers(pgd, k, id).length, ik = pgd.itemKinds[k];
    var renaming = state.tplRename && state.tplRename.kind === k && state.tplRename.id === id;
    var name = renaming ? '<input type="text" class="rename" id="tpl-rename" value="' + esc(t.name) + '" maxlength="25" aria-label="Name of this template">' : esc(t.name);
    var tools = '<span class="tpl-tools">' + (renaming ? "" : '<button type="button" class="linklike small" data-act="ed-tpl-rename">Rename</button>') +
      (id !== "default" && !n && !renaming ? '<button type="button" class="linklike small" data-act="ed-tpl-del">Remove template</button>' : "") + '</span>';
    return '<div class="lt tpl-name">' + name + (id === "default" ? '<span class="tpl-star" title="The default template" aria-label="The default template">' + ic("star", 15) + '</span>' : "") + '</div>' +
      '<span class="small lkind">' + esc(ik.label) + ' template, used by ' + tplWord(pgd, k, n) + '</span>' + tools +
      '<div class="tpl-ex"><span class="small">Preview:</span><b class="tpl-ex-name">' + esc(itemName(pgd)) + '</b><button type="button" class="tb ib" data-act="ed-tpl-ex" aria-expanded="' + !!state.tplEx + '" aria-label="Show a different ' + esc(tplOne(pgd, k)) + '" title="Show a different ' + esc(tplOne(pgd, k)) + '">' + ic("pen", 15) + '</button></div>' +
      (state.tplEx ? tplExPop(pgd) : "");
  }
  // The pencil: choose which article or artist fills the preview. The template stays the same.
  function tplExPop(pgd) {
    var k = tplHere(pgd), id = tplId(pgd), users = tplUsers(pgd, k, id), list = users.length ? users : tplItems(pgd, k), cur = atKey(pgd);
    return '<div class="tpl-pop" role="dialog" aria-label="Show a different ' + esc(tplOne(pgd, k)) + '"><label class="pp-search">' + ic("search") + '<input type="text" id="tpl-ex-q" placeholder="Search ' + esc(tplOne(pgd, k)) + 's using this template" autocomplete="off" aria-label="Search"></label>' +
      list.map(function (x) { var nm = tplItemName(k, x) || x.slug; return '<button type="button" class="pp-item' + (x.slug === cur ? " on" : "") + '" data-act="ed-tpl-show" data-slug="' + esc(x.slug) + '" data-q="' + esc(String(nm).toLowerCase()) + '">' + ic(k === "article" ? "book" : "person") + '<span class="t">' + esc(nm) + '</span></button>'; }).join("") +
      '<p class="small">' + (users.length ? "Only " + tplOne(pgd, k) + "s using " + esc(tplCur(pgd).name) + " are listed." : "No " + tplOne(pgd, k) + " uses this template yet, so any one can fill the preview.") + '</p></div>';
  }
  // The template's sections, with the page's own content as one of them.
  function tplRows(pgd) {
    var sel = pgd.sel || {}, list = secList(pgd, "tpl");
    return '<div class="dl" id="ed-sections" data-g="tpl">' + secIns(0, "tpl") + list.map(function (x, i) {
      return '<div class="secwrap">' + (x.type === "main" ? tplMainRow(pgd) : edRow(pgd, "tpl", x.id, x, sel.where === "tpl" && sel.id === x.id)) + '</div>' + secIns(i + 1, "tpl");
    }).join("") + '</div>';
  }
  function tplMainRow(pgd) {
    var k = tplHere(pgd), ik = pgd.itemKinds[k], it = itemOf(pgd), opens = pgd.open || {}, open = "tpl:main" in opens ? !!opens["tpl:main"] : true;
    var row = '<div class="sec main tplmain" data-act="ed-expand" data-key="tpl:main" aria-expanded="' + open + '" data-where="tpl" data-id="main" draggable="true"><span class="grip" aria-hidden="true" title="Drag to move"><i></i><i></i><i></i><i></i><i></i><i></i></span>' +
      '<span class="kic">' + ic(k === "article" ? "book" : "person") + '</span><span class="nm">' + esc(ik.label) + '<small>This ' + esc(tplOne(pgd, k)) + "'s own content. It can be moved, not removed." + '</small></span>' +
      '<span class="cnt">' + ik.parts.length + ' blocks</span></div>';
    return row + (open && it ? '<div class="blocks tplparts">' + ik.parts.map(function (part) { return edPartRow(pgd, part, it); }).join("") + '</div>' : "");
  }
  // Create a template: a name of up to 25 characters, and which template it starts as a copy of.
  function tplDialog(pgd) {
    var d = pgd.tplNew, k = d.kind, all = tplAll(pgd, k), n = String(d.name || "").length, ik = pgd.itemKinds[k];
    var clash = Object.keys(all).some(function (id) { return String(all[id].name || "").toLowerCase() === String(d.name || "").trim().toLowerCase(); });
    return '<div class="tpl-dlg-wrap"><div class="tpl-dlg" role="dialog" aria-modal="true" aria-labelledby="tpl-dlg-t"><h2 id="tpl-dlg-t">Create a template</h2>' +
      '<p class="small">A new template starts as a copy. Once it is saved, choose it for ' + (k === "article" ? "an article in that article's" : "an artist in that page's") + ' Settings.</p>' +
      '<div class="field"><label for="tpl-new-name">Name</label><input type="text" class="box" id="tpl-new-name" maxlength="25" value="' + esc(d.name || "") + '" autocomplete="off"><span class="small tpl-count" id="tpl-new-count">' + n + ' of 25</span></div>' +
      '<div class="field"><label for="tpl-new-base">Based on</label><select class="box" id="tpl-new-base">' + Object.keys(all).map(function (id) { return '<option value="' + esc(id) + '"' + (id === (d.base || "default") ? " selected" : "") + '>' + esc(all[id].name) + (id === "default" ? " (the default)" : "") + '</option>'; }).join("") + '</select></div>' +
      '<p class="small problem-text" id="tpl-new-clash"' + (clash ? "" : " hidden") + '>A ' + esc(ik.label.toLowerCase()) + ' template already has that name.</p>' +
      '<div class="row end"><button type="button" class="soft" data-act="ed-tpl-cancel">Cancel</button><button type="button" class="soft" id="tpl-new-go" data-act="ed-tpl-make"' + (String(d.name || "").trim() && !clash ? "" : " disabled") + '>Create template</button></div></div></div>';
  }
  // In an article's or an artist's own Settings: which template it is drawn with.
  function tplPartId(pgd, k) { var ik = pgd.itemKinds[k]; return ik.parts.some(function (x) { return x.id === "settings"; }) ? "settings" : k === "artist" ? (pgd.model === "sad" ? "words" : "about") : ik.parts[ik.parts.length - 1].id; }
  function tplChoice(pgd, sel) {
    var k = tplHere(pgd); if (!k || sel.where !== "item" || sel.block != null || sel.id !== tplPartId(pgd, k)) return "";
    var all = tplAll(pgd, k), mine = tplAssigned(pgd, k, atKey(pgd)), n = tplUsers(pgd, k, mine).length;
    return '<div class="field tpl-choice"><label for="tpl-assign">Template</label><select class="box" id="tpl-assign" data-change="ed-tpl-assign">' + Object.keys(all).map(function (id) { return '<option value="' + esc(id) + '"' + (id === mine ? " selected" : "") + '>' + esc(all[id].name) + (id === "default" ? " (the default)" : "") + '</option>'; }).join("") + '</select>' +
      '<span class="small">' + esc(all[mine].name) + ' is used by ' + tplWord(pgd, k, n) + '. Changing it here changes only this ' + esc(tplOne(pgd, k)) + '.</span></div>';
  }
  function edRight(pgd) { var sel = pgSel(pgd); return pgd.panel === "new" ? edNew(pgd) : pgd.fontPick ? fontPanel(pgd) : themeOpen(pgd) ? "" : sel ? edSettings(pgd, sel) : ""; }
  // ---------- Theme settings in the editor's left column ----------
  function isThemePath(p) { return String(p || "").indexOf("theme:") === 0; }
  function themeGet(path) { var t = themeOf(); if (!t) return undefined; var b = path.slice(6).split("."); return (t.draft[b[0]] || {})[b[1]]; }
  function themeSet(path, v) {
    var t = themeOf(); if (!t) return; var b = path.slice(6).split(".");
    t.draft[b[0]] = t.draft[b[0]] || {}; t.draft[b[0]][b[1]] = v;
    var pgd = pgOf(); if (pgd) { pgd.what = "Theme"; pgMark(pgd); patchEdTop(); }
    themePush(); if (/^social_/.test(b[1])) pushSoon();
  }
  function fGet(pgd, path) { if (isThemePath(path)) return themeGet(path); var sel = pgSel(pgd); return sel ? pgGet(sel.sec.settings, path) : undefined; }
  function fSet(pgd, path, v) {
    if (isThemePath(path)) { themeSet(path, v); return true; }
    var sel = pgSel(pgd); if (!sel) return false;
    pgSet(sel.sec.settings, path, v); pgd.what = "Edit " + (sel.kind ? sel.kind.label : sel.id); pgMark(pgd); patchEdTop(); return true;
  }
  function themeSocial() {
    var t = themeOf(); if (!t) return undefined; var st = t.draft.settings || {}, out = {};
    (t.spec.settings || []).forEach(function (f) { var v = st[f.name]; if (f.social && /^https:\/\/\S+$/.test(v || "")) out[f.name.slice(7)] = { label: f.label, href: v }; });
    return out;
  }
  // The theme's colours, typefaces and rules, shown in the page while they are being changed.
  function themePush() {
    var t = themeOf(), pgd = pgOf(), fr = app.querySelector && app.querySelector("#ed-frame"); if (!t || !pgd || !fr || !fr.contentWindow) return;
    var out = themeCss(t.spec, t.draft), rules = themeRules(t.spec, t.draft.settings || {});
    out.font_links.forEach(function () {}); Object.keys(t.draft.fonts || {}).forEach(function (k) { loadFont(t.spec, t.draft.fonts[k]); });
    try { fr.contentWindow.postMessage({ type: "adh-theme", css: out.css + (rules ? "\n" + rules : ""), fonts: out.font_links }, new URL(pgd.preview).origin); } catch (e) { /* preview only */ }
  }
  var THEME_GROUPS = [["colours", "Colours"], ["type", "Typography"], ["design", "Design"], ["artworks", "Artworks", 1], ["cards", "Artwork cards", 1], ["collections", "Collection cards", 1], ["enquiries", "Enquiries", 1],
    ["social", "Social media"], ["favicon", "Favicon"], ["search", "Search", 1], ["extras", "Extras"], ["css", "Custom CSS"], ["style", "Theme style"]];
  function tDef(t, name) { return (t.spec.settings || []).find(function (x) { return x.name === name; }); }
  function tField(pgd, t, name) { var f = tDef(t, name); if (!f) return ""; var ff = Object.assign({}, f); if (f.type === "image") ff.lib = "noadd"; return edField(pgd, ff, (t.draft.settings || {})[name], "theme:settings." + name); }
  function tFont(pgd, t, role, label) {
    var f = t.spec.fonts.find(function (x) { return x.role === role; }); if (!f) return ""; var map = {};
    f.options.forEach(function (o) { map[o] = t.spec.fontRequests[o] || ""; });
    return edField(pgd, { type: "font", label: label || "Typeface", fonts: map, noStyle: true, hint: f.use }, t.draft.fonts[f.id], "theme:fonts." + f.id);
  }
  function themePanel(pgd) {
    var t = themeOf(); if (!t) return '<div class="lpanel"><h2 class="lt">Theme settings</h2><p class="small">Reading the theme.</p></div>';
    t.draft.settings = t.draft.settings || {};
    var open = state.themeGroup == null ? "colours" : state.themeGroup, crumbs = !!tDef(t, "crumbs");
    var notUsed = function (why) { return '<p class="info">' + esc(why) + '</p>'; }, sub = function (x) { return '<div class="sub">' + esc(x) + '</div>'; };
    var bodies = {
      colours: function () { return sub("General") + t.spec.colours.map(function (c) { var w = themeWarning(t, c); return edField(pgd, { type: "colour", label: c.label, hint: c.use + "." + (w ? " " + w + "." : "") }, t.draft.colours[c.id], "theme:colours." + c.id); }).join("") +
        '<p class="info">Sections choose from these colours in their own settings, so a change here reaches every section that uses it. The sites have no separate header, footer or numbered colour schemes.</p>'; },
      type: function () { return sub("Headings") + tFont(pgd, t, "display") + ["h_size", "h_track", "h_lh", "h_caps"].map(function (n) { return tField(pgd, t, n); }).join("") +
        sub("Body text") + tFont(pgd, t, "body") + ["b_size", "b_track", "b_lh"].map(function (n) { return tField(pgd, t, n); }).join("") +
        sub("Navigation") + tFont(pgd, t, "small", "Small text and labels") + ["nav_font", "nav_size", "nav_caps"].map(function (n) { return tField(pgd, t, n); }).join("") +
        sub("Language") + tField(pgd, t, "dir"); },
      design: function () { return sub("General") + tField(pgd, t, "corners") + tField(pgd, t, "buttons") + sub("Icons") + notUsed("Not used on this site. The sites use words rather than icons."); },
      social: function () { return (t.spec.settings || []).filter(function (f) { return f.social; }).map(function (f) { return tField(pgd, t, f.name); }).join("") + '<p class="info">Only the networks with an address are shown, at the foot of every page.</p>'; },
      favicon: function () { return tField(pgd, t, "favicon") + '<p class="info">Choose a picture from the site\'s own files. To add a new one, upload it in Files first. <button type="button" class="linklike small" data-tab="files">Open Files</button></p>'; },
      extras: function () { return crumbs ? tField(pgd, t, "crumbs") : notUsed("Not used on this site. It has no breadcrumbs."); },
      css: function () { return tField(pgd, t, "css"); },
      style: function () {
        var looks = [{ name: "The site's own", colours: Object.fromEntries(t.spec.colours.map(function (c) { return [c.id, c.default]; })) }].concat(t.spec.looks || []);
        return '<p class="small">A ready-made look. Changing style puts back the colours of that look and the site\'s own typography and design settings. Words, pictures and pages are never touched.</p>' +
          '<div class="looks tlooks">' + looks.map(function (l, i) { return '<button type="button" class="look' + (pgd.tlook === i - 1 ? " on" : "") + '" data-act="ed-tlook" data-i="' + (i - 1) + '"><i>' + t.spec.colours.slice(0, 3).map(function (c) { return '<span style="background:' + esc(l.colours[c.id] || c.default) + '"></span>'; }).join("") + '</i>' + esc(l.name) + '</button>'; }).join("") + '</div>' +
          (pgd.tlook != null ? '<div class="row tlook-go"><button type="button" class="tw" data-act="ed-tlook-cancel">Cancel</button><button type="button" class="tw strong" data-act="ed-tlook-go">Change style</button></div>' : "");
      },
    };
    var off = { artworks: 1, cards: 1, collections: 1, enquiries: 1, search: 1 }; if (!crumbs) off.extras = 1;
    var sellWhy = "These settings are for a site that sells art: prices, artwork and collection cards, and enquiries. None of our sites sells online yet, so there is nothing to change here.";
    return '<div class="lpanel tpanel"><h2 class="lt">Theme settings</h2><p class="small">These apply to every page of the site and show in the preview straight away. Save keeps them.</p>' +
      THEME_GROUPS.map(function (g) {
        var on = open === g[0], o = !!off[g[0]];
        var body = on ? (bodies[g[0]] ? bodies[g[0]]() : notUsed(g[0] === "search" ? "Not used on this site. None of the sites suggests results while you type a search." : sellWhy)) : "";
        return '<div class="tgrp' + (on ? " open" : "") + '"><button type="button" class="tghead" data-act="ed-tgroup" data-g="' + g[0] + '" aria-expanded="' + on + '"><span>' + esc(g[1]) + '</span>' + (o ? '<em>Not used on this site</em>' : '<em>' + (on ? "Close" : "Open") + '</em>') + '</button>' +
          (on ? '<div class="tgbody stack">' + body + '</div>' : "") + '</div>';
      }).join("") + '</div>';
  }
  // Theme style: the colours of a ready-made look, and the site's own typography and design.
  function themeStyle(i) {
    var t = themeOf(); if (!t || i == null) return;
    var look = i < 0 ? null : (t.spec.looks || [])[i];
    t.spec.colours.forEach(function (c) { t.draft.colours[c.id] = look ? look.colours[c.id] || c.default : c.default; });
    ["h_size", "h_track", "h_lh", "h_caps", "b_size", "b_track", "b_lh", "nav_font", "nav_size", "nav_caps", "corners", "buttons"].forEach(function (k) { t.draft.settings[k] = /_caps$/.test(k) ? null : /^(nav_font|corners|buttons)$/.test(k) ? "" : null; });
    var pgd = pgOf(); if (pgd) { pgd.what = "Theme style"; pgMark(pgd); patchEdTop(); } themePush();
  }
  // A section's own panel: the site-wide colours and typefaces it uses, and a way to them.
  function themeBox(pgd, sel) {
    var t = themeOf(); if (!t || !sel.kind) return "";
    var open = !!pgd.tboxOpen;
    return '<div class="cssbox tbox' + (open ? " open" : "") + '"><button type="button" class="csshead" data-act="ed-tbox" aria-expanded="' + open + '"><span>Theme settings</span><em>' + (open ? "Close" : "Open") + '</em></button>' +
      (open ? '<p class="small">This section uses the site-wide colours and typefaces below. Changing them changes them across the whole site, not just here.</p><div class="tlist">' +
        t.spec.colours.map(function (c) { return '<span class="ti"><i style="background:' + esc(t.draft.colours[c.id]) + '"></i>' + esc(c.label) + '</span>'; }).join("") +
        t.spec.fonts.map(function (f) { return '<span class="ti"><b style="font-family:\'' + esc(t.draft.fonts[f.id]) + '\', ' + esc(f.fallback) + '">Aa</b>' + esc(f.label) + ': ' + esc(t.draft.fonts[f.id]) + '</span>'; }).join("") +
        '</div><button type="button" class="tw tgo" data-act="ed-theme-open">Open theme settings</button>' : "") + '</div>';
  }
  function themeOpen(pgd) { return pgd.leftPanel === "theme" && !pgd.leftHidden; }
  // What a section looks like, drawn small for the picker's preview.
  var SHAPES = { "signup-popup": "popup", signup: "form", visit: "rows", hero: "banner", "picture-banner": "banner", text: "text", prose: "text", "long-text": "text", "text-picture": "textpic", picture: "picture", quote: "quote", articles: "cards", features: "cards", profiles: "cards", featured: "cards", method: "cards", faq: "rows", words: "rows", glossary: "rows", "page-links": "rows", "section-list": "rows", button: "button", status: "bar", timeline: "table", "results-table": "table", panel: "panel", "contact-form": "form", "page-head": "heading", "page-heading": "heading", "latest-result": "card", numbers: "cards", explained: "text", announcement: "ann", columns: "columns", space: "space", slideshow: "slides", gallery: "gallery", "logo-row": "logos", artworks: "gallery", exhibitions: "rows", career: "rows", press: "quote", "artist-cards": "cards", archive: "cards", "exhibition-list": "cards", collecting: "panel", "text-page": "text" };
  function shapeHtml(shape) {
    var bar = function (w) { return '<i style="width:' + w + '%"></i>'; };
    switch (shape) {
      case "banner": return '<div class="pv-banner"><b>A large heading</b><span></span></div>';
      case "textpic": return '<div class="pv-split"><span class="pv-img"></span><div class="pv-lines"><b>A heading</b>' + bar(90) + bar(70) + '</div></div>';
      case "picture": return '<div class="pv-pic"><span class="pv-img"></span><small>A caption under the picture</small></div>';
      case "quote": return '<div class="pv-quote">A short line that stands out.</div>';
      case "cards": return '<div class="pv-cards"><span></span><span></span><span></span></div>';
      case "rows": return '<div class="pv-rows"><b>01</b>' + bar(80) + '<b>02</b>' + bar(64) + '<b>03</b>' + bar(72) + '</div>';
      case "button": return '<div class="pv-btn"><span>Read more</span></div>';
      case "bar": return '<div class="pv-bar">' + bar(30) + bar(30) + '</div>';
      case "table": return '<div class="pv-table">' + bar(100) + bar(100) + bar(100) + '</div>';
      case "panel": return '<div class="pv-panel"><b>A heading</b>' + bar(70) + '</div>';
      case "popup": return '<div class="pv-popwrap"><div class="pv-popup"><b>Join the mailing list</b>' + bar(80) + '<div class="pv-form"><span></span><em>Ask to join</em></div></div></div>';
      case "form": return '<div class="pv-form"><span></span><span></span><em>Send</em></div>';
      case "heading": return '<div class="pv-lines"><b class="big">A page heading</b>' + bar(60) + '</div>';
      case "ann": return '<div class="pv-ann"><span>A short message for visitors.</span><u>Read more</u></div>';
      case "columns": return '<div class="pv-cols">' + [1, 2, 3].map(function (n) { return '<div><small>0' + n + '</small><b>A title</b>' + bar(90) + bar(70) + '</div>'; }).join("") + '</div>';
      case "space": return '<div class="pv-space"><span></span><em>Room between two sections</em><span></span></div>';
      case "slides": return '<div class="pv-slides"><span class="pv-img"></span><div><small>A caption</small><em>Previous</em><em>1 of 3</em><em>Next</em></div></div>';
      case "gallery": return '<div class="pv-gallery">' + [1, 2, 3, 4, 5, 6].map(function () { return '<span></span>'; }).join("") + '</div>';
      case "logos": return '<div class="pv-logos">' + [1, 2, 3, 4].map(function () { return '<span>Logo</span>'; }).join("") + '</div>';
      case "card": return '<div class="pv-card"><b>The latest result</b>' + bar(50) + '</div>';
      default: return '<div class="pv-lines"><b>A heading</b>' + bar(92) + bar(86) + bar(60) + '</div>';
    }
  }
  // Where each kind of section sits in the "Add a section" list.
  var SECTION_GROUP = {
    hero: "Top of the page", "page-heading": "Top of the page", "page-head": "Top of the page", status: "Top of the page", announcement: "Top of the page",
    columns: "Words", space: "Words", "picture-banner": "Top of the page", slideshow: "Pictures", gallery: "Pictures", "logo-row": "Pictures",
    artworks: "Art and artists", exhibitions: "Art and artists", career: "Art and artists", "artist-cards": "Art and artists", press: "Reading and trust",
    text: "Words", "long-text": "Words", quote: "Words", faq: "Words", panel: "Words", prose: "Words", words: "Words", glossary: "Words",
    picture: "Pictures", "text-picture": "Pictures",
    featured: "Art and artists", profiles: "Art and artists", timeline: "Art and artists", "results-table": "Art and artists", "latest-result": "Art and artists",
    articles: "Reading and trust", features: "Reading and trust", explained: "Reading and trust", "section-list": "Reading and trust", "page-links": "Reading and trust", numbers: "Reading and trust", method: "Reading and trust",
    button: "Contact and sign-up", "contact-form": "Contact and sign-up", signup: "Contact and sign-up", visit: "Contact and sign-up", "signup-popup": "Popups",
    archive: "Art and artists", "exhibition-list": "Art and artists", collecting: "Reading and trust", "text-page": "Words"
  };
  // The first section of this kind anywhere on the site: this page first, then the home page, then the rest.
  function firstOnSite(pgd, type) {
    var pages = pgd.doc.pages || {}, keys = [pgd.page, "home"].concat(Object.keys(pages));
    for (var i = 0; i < keys.length; i++) { var pg = pages[keys[i]]; var hit = pg && (pg.sections || []).filter(function (x) { return x.type === type; })[0]; if (hit) return hit; }
    var base = JSON.parse(pgd.base || "{}").pages || {};
    for (var k in base) { var h2 = (base[k].sections || []).filter(function (x) { return x.type === type; })[0]; if (h2) return h2; }
    return null;
  }
  function usedOnSite(pgd, type) { return firstOnSite(pgd, type) ? 1 : 0; }
  function pickerItems(pgd) {
    var pk = pgd.picker2; if (!pk) return [];
    if (pk.mode === "section") {
      var shared = Object.keys(pgd.doc.shared || {}).map(function (k) { return pgd.doc.shared[k].type; }), out = [];
      Object.keys(pgd.kinds).forEach(function (k) {
        var kd = pgd.kinds[k]; if (shared.indexOf(k) >= 0 || k === "header" || k === "footer" || k === "opening") return;
        if (!!kd.popup !== (pk.g === "popups")) return;
        var blocks = bkinds(kd).map(function (b) { return b.label.toLowerCase(); }), n = usedOnSite(pgd, k);
        out.push({ key: k, group: SECTION_GROUP[k] || "Words", label: kd.label, note: blocks.length ? "Blocks: " + blocks.join(", ") : (kd.library || kd.about), about: kd.about + (n ? " Starts with the words of the one already on the site." : ""), blocks: blocks, shape: SHAPES[k] || "text" });
      });
      var order = ["Popups", "Top of the page", "Words", "Pictures", "Art and artists", "Reading and trust", "Contact and sign-up"];
      var counts = usageCounts(pgd), most = out.filter(function (x) { return counts[x.key] > 1; }).sort(function (x, y) { return counts[y.key] - counts[x.key] || x.label.localeCompare(y.label); }).slice(0, 4)
        .map(function (x) { return Object.assign({}, x, { group: "Most used on this site", most: true, note: "Used " + counts[x.key] + " times. " + x.note }); });
      return most.concat(out.map(function (x, i) { return [x, i]; }).sort(function (x, y) { return (order.indexOf(x[0].group) - order.indexOf(y[0].group)) || (x[1] - y[1]); }).map(function (x) { return x[0]; }));
    }
    var ps = pgSel({ sel: { where: pk.where, id: pk.id, block: null }, doc: pgd.doc, page: pgd.page, kinds: pgd.kinds, pictures: pgd.pictures, itemKinds: pgd.itemKinds, at: pgd.at, site: pgd.site, lists: pgd.lists });
    if (!ps || !ps.kind) return [];
    return bkinds(ps.kind).map(function (bk) {
      var have = Array.isArray(ps.sec.settings[bk.field]) ? ps.sec.settings[bk.field].length : 0, full = bk.one || (bk.max && have >= bk.max);
      return { key: bk.field, group: "Blocks that belong in " + ps.kind.label, label: bk.label, note: bk.about || bk.add, off: !!full, about: bk.about || "", blocks: [], shape: "block", kind: ps.kind.label };
    }).filter(function (x) { return !x.off; });
  }
  // The image library: a large window opened from Select or Change on any picture or video setting.
  function libFiles(pgd) {
    var lib = pgd.lib, video = lib.kind === "video", out = [];
    (pgd.images || []).forEach(function (n) { if (video === /\.mp4$/i.test(n)) out.push({ name: n, src: (pgd.imageBase || "") + n, size: (pgd.imageSizes || {})[n] || 0 }); });
    if (!video) Object.keys(pgd.uploads || {}).forEach(function (k) { var u = pgd.uploads[k]; out.push({ name: k, label: u.name, src: u.dataUrl, size: Math.round((u.content || "").length * 0.75), fresh: true }); });
    return out;
  }
  function libUsed(pgd) {
    if (pgd.libUsedAt === pgd.what && pgd.libUsedMap) return pgd.libUsedMap;
    var text = JSON.stringify(pgd.doc) + JSON.stringify(pgd.site || {}), map = {};
    (pgd.images || []).forEach(function (n) { map[n] = text.split(n).length - 1; });
    Object.keys(pgd.uploads || {}).forEach(function (k) { map[k] = text.split('"' + k + '"').length - 1; });
    pgd.libUsedAt = pgd.what; pgd.libUsedMap = map; return map;
  }
  function kb(n) { return n ? Math.max(1, Math.round(n / 1024)) + " KB" : ""; }
  function edLibrary(pgd) {
    var lib = pgd.lib, used = libUsed(pgd), arts = (pgd.site && pgd.site.artists) || pgd.artists || [], video = lib.kind === "video";
    var files = libFiles(pgd).filter(function (f) {
      var meta = pgd.imageMeta[f.name] || {}, words = (f.name + " " + (f.label || "") + " " + (meta.alt || "") + " " + (meta.caption || "")).toLowerCase();
      if (lib.size === "small" && !(f.size && f.size < 200 * 1024)) return false;
      if (lib.size === "mid" && !(f.size >= 200 * 1024 && f.size <= 400 * 1024)) return false;
      if (lib.size === "big" && !(f.size > 400 * 1024)) return false;
      if (lib.used === "yes" && !used[f.name]) return false;
      if (lib.used === "no" && used[f.name]) return false;
      if (lib.artist) { var a = arts.find(function (x) { return x.slug === lib.artist; }); if (!a || (words.indexOf(a.slug) < 0 && words.indexOf(String(a.name).toLowerCase()) < 0)) return false; }
      return true;
    });
    files.sort(function (x, y) { var nx = (x.label || x.name).toLowerCase(), ny = (y.label || y.name).toLowerCase(); return lib.sort === "za" ? ny.localeCompare(nx) : lib.sort === "big" ? y.size - x.size : lib.sort === "small" ? x.size - y.size : x.fresh !== y.fresh ? (x.fresh ? -1 : 1) : nx.localeCompare(ny); });
    var sel = function (name, cur, opts, label) { return '<label class="libsel"><span class="vh">' + label + '</span><select class="box" data-change="ed-lib-opt" data-o="' + name + '" aria-label="' + label + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === (cur || "") ? " selected" : "") + '>' + esc(o[1]) + '</option>'; }).join("") + '</select></label>'; };
    var tile = function (f) {
      var meta = pgd.imageMeta[f.name] || {}, on = lib.tick === f.name, type = (/\.(\w+)$/.exec(f.label || f.name) || [, "jpg"])[1].toUpperCase().replace("JPEG", "JPG"), n = used[f.name] || 0;
      return '<label class="libf' + (on ? " on" : "") + '" data-q="' + esc((f.name + " " + (f.label || "") + " " + (meta.alt || "")).toLowerCase()) + '"><input type="checkbox" data-lib-tick="' + esc(f.name) + '"' + (on ? " checked" : "") + ' aria-label="' + esc(f.label || f.name) + '">' +
        (video ? '<video src="' + esc(f.src) + '" muted preload="metadata"></video>' : '<img src="' + esc(f.src) + '" alt="" loading="lazy">') +
        '<span class="libn">' + esc(f.label || f.name) + '</span><span class="small">' + type + (f.size ? " · " + kb(f.size) : "") + (f.fresh ? " · new, saved with the page" : "") + '</span>' +
        '<span class="small libu">' + (n ? "Used " + (n === 1 ? "once" : n + " times") : "Not used yet") + '</span></label>';
    };
    return '<div class="lib-veil" data-act="ed-lib-close"></div><div class="lib" role="dialog" aria-modal="true" aria-label="' + esc(lib.label) + '">' +
      '<div class="lib-head"><h2>' + esc(lib.label) + '</h2><button type="button" class="tw" data-act="ed-lib-close">Close</button></div>' +
      '<div class="lib-bar"><label class="pk-search"><span class="vh">Search</span>' + ic("search") + '<input type="text" data-lib-q="1" value="' + esc(lib.q || "") + '" placeholder="Search ' + (video ? "videos" : "files") + '" autocomplete="off"></label>' +
        sel("sort", lib.sort, [["", "Newest uploads, then A to Z"], ["za", "Name, Z to A"], ["big", "Largest first"], ["small", "Smallest first"]], "Sort") +
        '<div class="seg mini" role="group" aria-label="View">' + [["grid", "Grid"], ["list", "List"]].map(function (o) { return '<button type="button" class="' + ((lib.view || "grid") === o[0] ? "on" : "") + '" data-act="ed-lib-view" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join("") + '</div></div>' +
      '<div class="lib-filters">' + sel("size", lib.size, [["", "Any file size"], ["small", "Under 200 KB"], ["mid", "200 to 400 KB"], ["big", "Over 400 KB"]], "File size") +
        sel("used", lib.used, [["", "Used anywhere or not"], ["yes", "Used on the site"], ["no", "Not used yet"]], "Used in") +
        sel("artist", lib.artist, [["", "Any artist"]].concat(arts.map(function (a) { return [a.slug, a.name]; })), "Artist") + '</div>' +
      (video || lib.noAdd ? (lib.noAdd ? '<p class="small">Choose from the site\'s own files. To add a new picture, upload it in Files first.</p>' : "") : '<div class="lib-drop" data-lib-drop="1"><label class="soft slim upl">Add files<input type="file" accept="image/jpeg,image/png" data-lib-add="1" multiple hidden></label><span class="small">or drag and drop images here. JPG or PNG, resized for the web and never cropped.</span></div>') +
      '<div class="lib-files ' + (lib.view === "list" ? "list" : "grid") + '">' + (files.length ? files.map(tile).join("") : '<p class="small">' + (video ? "No videos on the site yet. Paste a link to your own MP4 file in the setting instead." : "No files match. Try another word or filter.") + '</p>') + '<p class="small lib-none" hidden>No files match that search.</p></div>' +
      '<div class="lib-foot"><span class="small">' + (lib.tick ? "1 chosen" : "Tick a file to choose it.") + '</span><button type="button" class="tw" data-act="ed-lib-close">Cancel</button><button type="button" class="tw strong" data-act="ed-lib-done"' + (lib.tick ? "" : " disabled") + '>Done</button></div></div>';
  }
  function libPatch() { var pgd = pgOf(), box = app.querySelector("#ed-pick"); if (!pgd || !box) return; var q = box.querySelector("[data-lib-q]"), had = q && document.activeElement === q; box.innerHTML = edPicker(pgd); if (had) { q = box.querySelector("[data-lib-q]"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); } libFilter(); }
  function libFilter() {
    var pgd = pgOf(); if (!pgd || !pgd.lib) return; var q = String(pgd.lib.q || "").trim().toLowerCase(), any = false;
    Array.prototype.forEach.call(app.querySelectorAll(".lib-files .libf"), function (x) { var hit = !q || x.dataset.q.indexOf(q) >= 0; x.hidden = !hit; if (hit) any = true; });
    var none = app.querySelector(".lib-none"); if (none) none.hidden = any || !app.querySelector(".lib-files .libf");
  }
  async function libAdd(files) {
    var pgd = pgOf(); if (!pgd || !pgd.lib) return; var last = "";
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (!/^image\/(jpeg|png)$/.test(file.type)) { state.notice = { text: file.name + " is not a JPG or PNG photo, so it was left out.", problem: true }; continue; }
      if (Object.keys(pgd.uploads || {}).length >= 12) { state.notice = { text: "Save the photos you have added first, then add more.", problem: true }; break; }
      try { var img = await prepareImage(file); pgd.uploads = pgd.uploads || {}; pgd.upN = (pgd.upN || 0) + 1; last = "upload:" + pgd.upN; pgd.uploads[last] = { name: file.name, ext: img.ext, content: img.content, dataUrl: "data:image/" + (img.ext === "png" ? "png" : "jpeg") + ";base64," + img.content }; }
      catch (e) { state.notice = { text: e.message, problem: true }; }
    }
    if (last) pgd.lib.tick = last;
    pgd.libUsedAt = null; libPatch();
  }
  function usageCounts(pgd) {
    var n = {}, add = function (x) { if (x && x.type) n[x.type] = (n[x.type] || 0) + 1; }, g = pgd.doc.groups || {};
    Object.keys(pgd.doc.pages || {}).forEach(function (k) { (pgd.doc.pages[k].sections || []).forEach(add); });
    ["top", "popups", "bottom"].forEach(function (k) { (g[k] || []).forEach(add); });
    return n;
  }
  function edPicker(pgd) {
    if (pgd.tplNew) return tplDialog(pgd);
    if (pgd.lib) return edLibrary(pgd);
    var pk = pgd.picker2; if (!pk) return "";
    var items = pickerItems(pgd), groups = [], first = null;
    items.forEach(function (it) { var g = groups.filter(function (x) { return x.label === it.group; })[0]; if (!g) { g = { label: it.group, items: [] }; groups.push(g); } g.items.push(it); if (!first && !it.off) first = it; });
    var title = pk.mode === "section" ? "Add a section" : "Add a block", isB = pk.mode !== "section", tab = pk.tab || "types";
    var tabs = '<div class="pk-tabs" role="tablist">' + [["types", isB ? "Blocks" : pk.g === "popups" ? "Popups" : "Sections"], ["addons", "Add-ons"]].map(function (t) { return '<button type="button" role="tab" aria-selected="' + (tab === t[0]) + '" class="' + (tab === t[0] ? "on" : "") + '" data-act="ed-pk-tab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join("") + '</div>';
    var head = '<div class="pk-veil" data-act="ed-pick-close"></div><div class="pk' + (isB ? " short" : "") + '" role="dialog" aria-label="' + title + '">' +
      '<div class="pk-head"><b>' + title + '</b><button type="button" class="ib" data-act="ed-pick-close" aria-label="Close" title="Close">' + ic("close") + '</button></div>';
    if (tab === "addons") return head + tabs + '<div class="pk-list"><p class="small pk-addons">No add-ons yet. Add-ons made on our own code will be listed here once they are switched on in the Add-ons panel.</p></div></div>';
    if (isB && !items.length) return head + tabs + '<div class="pk-list"><p class="small pk-addons">Every block this section takes is already in it.</p></div></div>';
    return head + tabs +
      '<label class="pk-search"><span class="vh">Search</span>' + ic("search") + '<input type="text" data-pick-q="1" placeholder="' + (pk.mode === "section" ? "Search sections" : "Search blocks") + '" autocomplete="off"></label>' +
      '<div class="pk-list">' + groups.map(function (g) {
        return '<div class="pk-grp" data-grp="1"' + (g.items[0] && g.items[0].most ? " data-most=\"1\"" : "") + '><span class="pk-gl">' + esc(g.label) + '</span>' + g.items.map(function (it) {
          return '<button type="button" class="pk-item' + (it === first ? " on" : "") + '" data-act="ed-pick-add" data-key="' + esc(it.key) + '"' + (it.off ? " disabled" : "") + ' data-words="' + esc((it.label + " " + it.about + " " + it.note).toLowerCase()) + '">' +
            (pk.mode === "section" ? kindIc(it.key) : blockIc({ field: it.key })) + '<span class="pk-t"><b>' + esc(it.label) + '</b><small>' + esc(it.note) + '</small></span></button>';
        }).join("") + '</div>';
      }).join("") + '<p class="small pk-none" hidden>Nothing matches. Try another word.</p></div></div>' +
      (isB ? "" : '<div class="pk-view" aria-hidden="true">' + (first ? pickView(pk, first) : "") + '</div>');
  }
  function pickView(pk, it) {
    return '<div class="pk-card"><div class="pk-draw">' + (pk.mode === "section" ? shapeHtml(it.shape) : '<div class="pv-block">' + ic(BLOCK_IC[it.key] || "block", 28) + '<b>' + esc(it.label) + '</b></div>') + '</div>' +
      '<div class="pk-about"><b>' + esc(it.label) + '</b><span class="small">' + esc(it.about || it.note) + '</span>' + (it.blocks && it.blocks.length ? '<span class="small">Its blocks: ' + esc(it.blocks.join(", ")) + '.</span>' : "") + '</div></div>';
  }
  // Making something new: a page, an article, an artist or a source.
  var NEW_WHAT = [["page", "Page"], ["article", "Article"], ["artist", "Artist"], ["source", "Source"]];
  function edNew(pgd) {
    var w = pgd.newWhat || "page", ok = function (x) { return x === "page" || (!!pgd.site && !(pgd.gam && x === "source")); };
    if (!ok(w)) w = "page";
    var tabs = '<div class="seg mini">' + NEW_WHAT.filter(function (x) { return ok(x[0]); }).map(function (x) { return '<button type="button" class="' + (w === x[0] ? "on" : "") + '" data-act="ed-new" data-what="' + x[0] + '">' + x[1] + '</button>'; }).join("") + '</div>';
    var f = function (id, label, hint, extra) { return '<div class="field"><label for="nw-' + id + '">' + esc(label) + '</label><input type="text" id="nw-' + id + '" name="' + id + '" maxlength="160"' + (extra || "") + '>' + (hint ? '<span class="small">' + esc(hint) + '</span>' : "") + '</div>'; };
    var body = "";
    if (w === "page") body = f("title", "Page title", "Such as Visit us or About the review.") + '<label class="chk"><input type="checkbox" name="menu" checked> Add it to the menu bar</label><label class="chk"><input type="checkbox" name="own"> Its own layout: no menu bar, footer or shared sections, for a page such as Coming soon</label><span class="small">It starts with one text section. Add more from the section library.</span>';
    else if (w === "article" && pgd.model === "sad") body = f("title", "Title", "You can change it later.") + '<span class="small">New articles start hidden, so you can write in peace. Show it from its Settings when it is ready. It goes under Dispatches; move it to Urban Culture in Title and summary.</span>';
    else if (w === "article" && pgd.gam) body = f("title", "Title", "You can change it later.") + '<span class="small">New articles start hidden, so you can write in peace. Show it from its Settings when it is ready. It goes under Research; choose where else it shows in Title and summary.</span>';
    else if (w === "artist" && pgd.model === "sad") body = f("name", "Artist's name") + '<span class="small">The artist\'s card shows Coming soon until you choose the story their profile links to.</span>';
    else if (w === "artist" && pgd.gam) body = f("name", "Artist's name") + '<span class="small">The market profile is listed as soon as you save, so add at least one sourced sale first.</span>';
    else if (w === "article") body = f("title", "Title", "You can change it later.") + '<div class="field"><label for="nw-section">Which list it belongs to</label><select class="box" id="nw-section" name="section">' +
      [["explained", "Art Explained"], ["library", "Collector's Library"], ["reviews", "Reviews"], ["features", "Artists A to Z"]].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === (pgd.newSection || "explained") ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select></div><span class="small">New articles start hidden, so you can write in peace. Show it from its Settings when it is ready.</span>';
    else if (w === "artist") body = f("name", "Artist's name") + '<span class="small">The portfolio starts unpublished. The artist shows in Artists A to Z as In research until you publish it from Settings.</span>';
    else body = f("title", "Title", "The title of the article, page or record.") + f("pub", "Publication or owner", "Such as The Guardian or Bonhams.") + f("date", "Date", "A year, or a full date.") + f("kind", "Kind of source", "Such as Independent news report or Gallery source.") + f("url", "Link", "The full web address, starting https://") +
      (pgd.newCite ? '<span class="small">It is added to the sources you were choosing.</span>' : "");
    return '<div class="rhead"><button type="button" class="linklike small" data-act="ed-panel-close">Cancel</button><h2>Make something new</h2>' + tabs + '</div>' +
      '<form class="stack" data-form="ednew" data-what="' + w + '">' + body + '<div class="row"><button type="submit" class="btn slim">' + { page: "Make the page", article: "Make the article", artist: "Add the artist", source: "Add the source" }[w] + '</button></div></form>';
  }
  function edSettings(pgd, sel) {
    var kind = sel.kind || { label: sel.sec.type, fields: [] }, st = sel.sec.settings || {};
    if (sel.pic) {
      var parentKind = sel.parent.kind || { label: sel.id };
      return '<div class="rhead">' + (sel.where === "item" ? '<button type="button" class="linklike small" data-act="ed-panel-close">Done</button>' : '<button type="button" class="linklike small" data-act="ed-pick" data-where="' + sel.where + '" data-id="' + esc(sel.id) + '">Back to ' + esc(parentKind.label) + '</button>') +
        '<h2>' + esc(kind.label) + '</h2><div class="shared-note"><b>A shared picture</b><span class="small">It belongs to ' + esc(sel.spot.kind === "artist" ? sel.spot.label : "the article") + ', so a change here also shows on ' + esc(sel.spot.also) + '.</span></div></div>' +
        '<form class="stack" data-form="section">' + kind.fields.map(function (f) { return edField(pgd, f, st[f.name], f.name); }).join("") + '</form>';
    }
    if (sel.block != null) {
      // blocks inside this block are listed on the left, not in this form
      var kidFields = (!sel.child && sel.bk.blocks) ? sel.bk.blocks.map(function (c) { return c.field; }) : [], pre = sel.pre || "";
      var fieldsB = grouped((sel.bdef ? sel.bdef.fields : []).filter(function (g) { return kidFields.indexOf(g.name) < 0; }).map(function (g) {
        var h;
        if (g.type === "info") h = edField(pgd, g, null, "");
        else if (sel.single) h = edField(pgd, g, st[g.name], g.name);
        else if (g.name == null) { var wrapped = sel.item && typeof sel.item === "object"; h = edField(pgd, g, nameOf(sel.item), pre + sel.bk.field + "." + sel.block + (wrapped ? ".v" : "")); }
        else h = edField(pgd, g, Array.isArray(sel.item) ? sel.item[g.name] : (sel.item || {})[g.name], pre + sel.bk.field + "." + sel.block + "." + g.name);
        return { g: g.group || "", h: h };
      }));
      fieldsB = fieldsB.top + fieldsB.rest;
      var kidNote = kidFields.length ? '<div class="blocknote"><b>Blocks in this ' + esc(sel.bk.label.toLowerCase()) + '</b>' + sel.bk.blocks.map(function (c) { var n = Array.isArray((sel.item || {})[c.field]) ? sel.item[c.field].length : 0; return '<span class="bn">' + blockIc(c) + '<span>' + esc(c.label) + '</span><em>' + n + '</em></span>' +
        '<button type="button" class="soft slim" data-act="ed-childadd" data-where="' + sel.where + '" data-id="' + esc(sel.id) + '" data-bf="' + esc(sel.bk.field) + '" data-block="' + sel.block + '" data-sf="' + esc(c.field) + '">' + esc(c.add || "Add a " + c.label.toLowerCase()) + '</button>'; }).join("") + '</div>' : "";
      var count = sel.single ? "" : '<span class="small">' + esc(sel.bk.label) + " " + (sel.block + 1) + " of " + sel.list.length + '</span>';
      var backTo = sel.child ? '<button type="button" class="linklike small" data-act="ed-pick" data-where="' + sel.where + '" data-id="' + esc(sel.id) + '" data-bf="' + esc(sel.pbk.field) + '" data-block="' + sel.pblock + '">Back to ' + esc(blockRowName(pgd, sel.pbk, sel.pitem, sel.pblock)) + '</button>'
        : '<button type="button" class="linklike small" data-act="ed-pick" data-where="' + sel.where + '" data-id="' + esc(sel.id) + '">Back to ' + esc(kind.label) + '</button>';
      return pHead(pgd, sel, { back: '<div class="row between rback">' + backTo + count + '</div>', icon: blockIc(sel.bk), title: sel.single ? sel.bk.label : bTitle(pgd, sel.bk, sel.item, sel.block), about: sel.bk.about || ("A " + sel.bk.label.toLowerCase() + " in " + kind.label + "."), hidden: selHidden(sel) }) +
        '<form class="stack" data-form="section">' + fieldsB + '</form>' + kidNote + (sel.single && sel.bk.field === "picture" ? picsHere(pgd, sel) : "") + pRemove(pgd);
    }
    var kinds = bkinds(kind), taken = {}, items = [];
    kinds.forEach(function (b) { taken[b.field] = 1; (b.fields || []).forEach(function (n) { taken[n] = 1; }); if (b.hide) taken[b.hide] = 1; });
    kind.fields.forEach(function (f) {
      if ((f.name != null && taken[f.name]) || f.internal) return;
      items.push({ g: f.group || "", h: edField(pgd, f, f.type === "info" ? null : pgGet(st, String(f.name)), f.type === "info" ? "" : String(f.name)) });
    });
    var parts = grouped(items);
    var blockNote = kinds.length ? '<div class="blocknote"><b>Blocks in this section</b>' + kinds.map(function (b) { var n = b.one ? 1 : (st[b.field] || []).length; return '<span class="bn">' + blockIc(b) + '<span>' + esc(b.label) + '</span><em>' + n + '</em></span>'; }).join("") +
      '<button type="button" class="soft slim" data-act="ed-blockpicker" data-where="' + sel.where + '" data-id="' + esc(sel.id) + '">Add a block</button></div>' : "";
    var bk = kinds[0];
    var secLike = isSecList(sel.where) || sel.where === "shared";
    return pHead(pgd, sel, { icon: secLike ? kindIc(sel.sec.type) : '<span class="kic">' + ic("doc") + '</span>', title: secLike ? secName(pgd, sel.sec) : kind.label, about: kind.about, hidden: sel.sec.visible === false }) + tplChoice(pgd, sel) +
      '<form class="stack" data-form="section">' + (parts.top || (bk || parts.rest ? "" : '<span class="small" style="margin:0 6px">Nothing to set here.</span>')) + blockNote +
      parts.rest + '</form>' + (isSecList(sel.where) ? picsHere(pgd, sel) : "") + edExtras(pgd, sel) + (secLike ? themeBox(pgd, sel) : "") + (state.customCss && isSecList(sel.where) ? cssBox(pgd, sel) : "") + pRemove(pgd);
  }
  // Settings in the order the schema gives: those without a group first, then each group under its own small heading.
  function grouped(items) {
    var order = [], by = {}, top = "";
    items.forEach(function (x) { if (!x.g) { top += x.h; return; } if (!(x.g in by)) { by[x.g] = ""; order.push(x.g); } by[x.g] += x.h; });
    return { top: top, rest: order.map(function (g) { return '<div class="sub">' + esc(g) + '</div>' + by[g]; }).join("") };
  }
  // The top of the settings panel: Section or Block, More and Close, then the icon and the name.
  // It stays in place while the settings under it scroll. A section's name can be changed by clicking it.
  function pHead(pgd, sel, o) {
    var isBlock = sel.block != null, secLike = !isBlock && (isSecList(sel.where) || sel.where === "shared");
    var canMore = secLike || (isBlock && (isSecList(sel.where) || sel.where === "shared"));
    var renaming = secLike && state.renaming && state.renaming.panel && state.renaming.id === sel.id;
    var title = renaming ? '<input type="text" class="rename" id="ed-rename" value="' + esc(o.title) + '" maxlength="40" aria-label="Name in the list">'
      : secLike ? '<button type="button" class="rname" data-act="ed-trename" title="Click to rename">' + esc(o.title) + '</button>' : '<span class="rname">' + esc(o.title) + '</span>';
    return '<div class="rhead"><div class="rtop"><span class="rkind">' + (isBlock ? "Block" : secLike ? "Section" : "Settings") + '</span><span class="rbtns">' +
      (canMore ? '<button type="button" class="tw" data-act="ed-pmore" aria-haspopup="menu">More</button>' : "") +
      '<button type="button" class="tw" data-act="ed-panel-close">Close</button></span></div>' + (o.back || "") +
      '<h2 class="rtitle">' + o.icon + title + '</h2>' + (o.about ? '<span class="small">' + esc(o.about) + '</span>' : "") +
      (o.hidden ? '<span class="chip quiet" style="align-self:flex-start">Hidden from the page</span>' : "") + edTools(pgd) + '</div>';
  }
  // Date and time from five dropdowns: kept once day, month and year are chosen; the time starts at 09:00.
  function dtChanged(path) {
    var pgd = pgOf(), sel = pgd && pgSel(pgd); if (!sel) return;
    var get = function (p2) { var x = app.querySelector('[data-dt="' + cssq(path) + '"][data-part="' + p2 + '"]'); return x ? x.value : ""; };
    var y = get("y"), m = get("m"), d = get("d"), h = get("h"), i = get("i");
    if (!(y && m && d)) return;
    var last = new Date(Number(y), Number(m), 0).getDate(); if (Number(d) > last) d = String(last).padStart(2, "0");
    pgSet(sel.sec.settings, path, y + "-" + m + "-" + d + "T" + (h || "09") + ":" + (i || "00"));
    pgd.what = "Edit " + (sel.kind ? sel.kind.label : sel.id); pgMark(pgd); edPatch(); pushSoon();
  }
  function fontClose(pgd, putBack) {
    var fp = pgd.fontPick; pgd.fontPick = null;
    if (putBack && fp) { fSet(pgd, fp.path, fp.was); pushSoon(); }
    edPatch();
  }
  // Custom CSS for one section: a folding box with line numbers. The site keeps it inside that section.
  function cssBox(pgd, sel) {
    var key = sel.where + ":" + sel.id, open = pgd.cssOpen === key, css = sel.sec.css || "";
    return '<div class="cssbox' + (open ? " open" : "") + '"><button type="button" class="csshead" data-act="ed-css" aria-expanded="' + open + '"><span>Custom CSS</span><em>' + (open ? "Close" : css.trim() ? "In use" : "Open") + '</em></button>' +
      (open ? '<p class="small">These styles change this section only. Styles for the whole site live in Theme settings. Anything that would load from another website is taken out. <a href="https://developer.mozilla.org/en-GB/docs/Learn_web_development/Core/Styling_basics" target="_blank" rel="noopener">Learn more</a></p>' +
        '<div class="code"><pre class="gut" aria-hidden="true">' + gutter(css) + '</pre><textarea class="ctext" data-css="1" spellcheck="false" wrap="off" rows="' + Math.max(6, css.split("\n").length + 1) + '" aria-label="Custom CSS for this section" placeholder="h2 { letter-spacing: 0.02em; }">' + esc(css) + '</textarea></div>' : "") + '</div>';
  }
  function gutter(css) { var n = Math.max(6, String(css || "").split("\n").length), out = []; for (var i = 1; i <= n; i++) out.push(i); return out.join("\n"); }
  // Remove sits at the very bottom, in red. The main section of a page and the shared frame have none.
  function pRemove(pgd) {
    var sel = pgSel(pgd), t = toolsFor(pgd, sel);
    return t && t.canDel ? '<div class="premove"><button type="button" class="linklike danger" data-act="ed-remove">Remove ' + (t.isBlock ? "block" : "section") + '</button></div>' : "";
  }
  // The shared pictures a section shows, such as an artist's or an article's, each opening its own settings.
  function picsHere(pgd, sel) {
    var sec = sel.sec, links = isSecList(sel.where) ? linkedOf(pgd, sec) : [];
    if (!links.length) return "";
    return '<div class="sub">Pictures shown here</div><div class="picsln">' + links.map(function (l) {
      var sp = pgd.pictures[l.key];
      return '<button type="button" class="sec blk pic" data-act="ed-pick-pic" data-id="' + esc(sel.id) + '" data-key="' + esc(l.key) + '">' +
        (sp.image ? '<img class="mini" src="' + esc(imageSrc(pgd, sp.image)) + '" alt="">' : '<span class="mini none" aria-hidden="true"></span>') +
        '<span class="nm">' + esc(l.label) + '</span><span class="eye">Shared</span></button>';
    }).join("") + '</div>';
  }
  // Things that sit under the settings: the menu bar for a page, deleting a page or an article.
  function edExtras(pgd, sel) {
    var asking = function (k) { return state.confirm === k; };
    if (sel.where === "pageinfo") {
      if ((pgd.builtIn && pgd.builtIn.length ? pgd.builtIn.indexOf(sel.id) >= 0 : pgd.gam ? GAM_BUILT_IN[sel.id] : WAR_BUILT_IN[sel.id])) return '<div class="stack extras"><span class="small">This is one of the site\'s own pages, so it stays.' + (sel.sec.settings.path ? ' Its address is ' + esc(sel.sec.settings.path.replace(/index\.html$/, "") || "the home page") + '.' : "") + '</span></div>';
      var links = menuLinks(pgd), href = menuHref(pgd, sel.id), inMenu = links.some(function (l) { return l[1] === href; });
      return '<div class="stack extras"><div class="sub">Menu bar</div><span class="small">' + (inMenu ? "This page is in the menu bar." : "This page is not in the menu bar. Visitors reach it from links you add.") + '</span>' +
        '<button type="button" class="soft slim" data-act="ed-menu" data-id="' + esc(sel.id) + '">' + (inMenu ? "Take it out of the menu bar" : "Add it to the menu bar") + '</button>' +
        '<div class="sub">Delete</div>' + (asking("ed-delpage") ? '<span class="small">Delete this page and its sections?</span><div class="row"><button type="button" class="btn slim" data-act="ed-delpage" data-id="' + esc(sel.id) + '">Yes, delete</button><button type="button" class="linklike small" data-act="cancel">Keep it</button></div>'
          : '<button type="button" class="linklike small" data-act="ask" data-k="ed-delpage">Delete this page</button>') + '</div>';
    }
    if (sel.where === "item" && sel.id === "settings" && atKind(pgd) === "article") {
      return '<div class="stack extras"><div class="sub">Delete</div>' + (asking("ed-delart") ? '<span class="small">Delete this article for good? Undo can still bring it back after saving.</span><div class="row"><button type="button" class="btn slim" data-act="ed-delart">Yes, delete</button><button type="button" class="linklike small" data-act="cancel">Keep it</button></div>'
        : '<button type="button" class="linklike small" data-act="ask" data-k="ed-delart">Delete this article</button><span class="small">Hiding it keeps it for later.</span>') + '</div>';
    }
    if (sel.where === "source") {
      var cites = citedCount(pgd, sel.id);
      return '<div class="stack extras"><span class="small">Short name: ' + esc(sel.id) + '. ' + (cites ? "Cited " + cites + (cites === 1 ? " time" : " times") + " across the site, so it cannot be deleted. Take it out of those places first." : "Not cited anywhere.") + '</span>' +
        (cites ? "" : asking("ed-delsrc") ? '<span class="small">Delete this source?</span><div class="row"><button type="button" class="btn slim" data-act="ed-delsrc">Yes, delete</button><button type="button" class="linklike small" data-act="cancel">Keep it</button></div>'
          : '<button type="button" class="linklike small" data-act="ask" data-k="ed-delsrc" style="align-self:flex-start">Delete this source</button>') + '</div>';
    }
    if (sel.where === "item" && atKind(pgd) === "artist" && sel.id === (pgd.model === "sad" ? "words" : pgd.gam ? "about" : "settings")) {
      var why = artistInUse(pgd, itemOf(pgd));
      return '<div class="stack extras"><div class="sub">Delete</div>' + (why ? '<span class="small">' + esc(why) + '</span>'
        : asking("ed-delartist") ? '<span class="small">Delete ' + esc(itemOf(pgd).name) + (pgd.model === "sad" ? "'s profile" : pgd.gam ? "'s market profile" : "'s portfolio") + '? Undo can still bring it back after saving.</span><div class="row"><button type="button" class="btn slim" data-act="ed-delartist">Yes, delete</button><button type="button" class="linklike small" data-act="cancel">Keep it</button></div>'
        : '<button type="button" class="linklike small" data-act="ask" data-k="ed-delartist" style="align-self:flex-start">Delete this artist</button>' + (pgd.gam ? "" : '<span class="small">Unpublishing keeps the portfolio for later.</span>')) + '</div>';
    }
    return "";
  }
  var WAR_BUILT_IN = { home: 1, standards: 1 };
  var GAM_BUILT_IN = { home: 1, "auction-results": 1, artists: 1, research: 1, "market-intelligence": 1, "collecting-valuation": 1, about: 1, contact: 1 };
  // The links a new page can be added to: the menu bar, or on Global Art Monitor the full-screen menu.
  function menuLinks(pgd) { var st = pgd.doc.shared.header.settings; if (pgd.gam && pgd.model !== "sad") { st.menu_extra = st.menu_extra || []; return st.menu_extra; } st.links = st.links || []; return st.links; }
  function menuHref(pgd, key) { return pgd.gam ? key + "/" : "#page-" + key; }
  // Why an artist cannot be deleted yet, in plain words, or "" when they can.
  function artistInUse(pgd, a) {
    if (!a) return "";
    if (pgd.gam) { var n = (a.sales || []).length; return n ? a.name + " has " + n + (n === 1 ? " sale" : " sales") + ". Remove the sales and save first, then delete the artist." : ""; }
    var named = pgd.site.articles.filter(function (x) { return (x.artists || []).indexOf(a.slug) >= 0; });
    return named.length ? a.name + " is named in " + named.length + (named.length === 1 ? " article (" + named[0].title + ")" : " articles") + ". Take them out of those first, or unpublish the portfolio instead." : "";
  }
  function citedCount(pgd, id) { var txt = JSON.stringify({ a: (pgd.site || {}).artists, b: (pgd.site || {}).articles }); return txt.split('"' + id + '"').length - 1 + txt.split('data-src=\\"' + id + '\\"').length - 1; }

  // The floating bar over the page: acts on whatever is picked.
  // What can be done to the picked section or block, shown at the top of its settings.
  function toolsFor(pgd, sel) {
    if (!sel || sel.pic) return null;
    var isBlock = sel.block != null, page = isSecList(sel.where), idx, n, hid, canHide = true;
    if (!isBlock && !page && sel.where !== "shared") return null;
    if (isBlock && sel.single) { idx = 0; n = 1; hid = selHidden(sel); canHide = !!sel.bk.hide; }
    else if (isBlock) { idx = sel.block; n = sel.list.length; hid = blockHidden(sel.item); canHide = !Array.isArray(sel.item) && (sel.where !== "item" || sel.bk.field === "works"); }
    else { idx = page ? secList(pgd, sel.where).findIndex(function (x) { return x.id === sel.id; }) : -1; n = page ? secList(pgd, sel.where).length : 0; hid = sel.sec.visible === false; }
    var movable = (isBlock && !sel.single) || page;
    return { isBlock: isBlock, idx: idx, n: n, hid: hid, canHide: canHide, movable: movable, canDel: movable && !(!isBlock && sel.where === "page" && sel.id === mainId(pgd)), word: isBlock ? sel.bk.label.toLowerCase() : "section", key: "ed-remove|" + sel.id + "|" + (isBlock ? sel.block : "") };
  }
  function edTools(pgd) {
    var sel = pgSel(pgd), t = toolsFor(pgd, sel); if (!t) return "";
    if (state.confirm === t.key) return '<div class="ptools ask" role="group" aria-label="Remove this ' + t.word + '"><span class="small">Remove this ' + t.word + '?</span><button type="button" class="btn slim" data-act="ed-remove">Yes, remove</button><button type="button" class="soft slim" data-act="cancel">Keep it</button></div>';
    var b = function (act, icon, label, extra) { return '<button type="button" class="tb' + (extra || "") + '" data-act="' + act + '" aria-label="' + label + ' this ' + t.word + '" title="' + label + '">' + ic(icon, 17) + '</button>'; };
    return '<div class="ptools" role="toolbar" aria-label="Change this ' + t.word + '">' +
      (t.canHide ? b("ed-hide", t.hid ? "eyeoff" : "eye", t.hid ? "Show" : "Hide") : "") +
      (t.movable ? b("ed-dup", "copy", "Duplicate") : "") +
      (t.movable ? '<button type="button" class="tw" data-act="ed-move" data-dir="-1"' + (t.idx > 0 ? "" : " disabled") + '>Move up</button><button type="button" class="tw" data-act="ed-move" data-dir="1"' + (t.idx < t.n - 1 ? "" : " disabled") + '>Move down</button>' : "") +
      '</div>';
  }
  function toggleHidden(ph, keep) {
    var hs = pgSel(ph); if (!hs) { if (keep !== undefined) ph.sel = keep; return; }
    if (hs.block != null && hs.single) { if (!hs.bk.hide) { if (keep !== undefined) ph.sel = keep; return; } hs.sec.settings[hs.bk.hide] = !hs.sec.settings[hs.bk.hide]; ph.what = (hs.sec.settings[hs.bk.hide] ? "Hide " : "Show ") + hs.bk.label.toLowerCase() + " in " + hs.kind.label; }
    else if (hs.block != null && hs.bk.item) { var hv = nameOf(hs.item), now = !blockHidden(hs.item); hs.list[hs.block] = now ? { v: hv, hidden: true } : hv; ph.what = (now ? "Hide " : "Show ") + hs.bk.label.toLowerCase() + ": " + bTitle(ph, hs.bk, hv, hs.block); }
    else if (hs.block != null) { if (Array.isArray(hs.item)) { if (keep !== undefined) ph.sel = keep; return; } if (hs.item.hidden) delete hs.item.hidden; else hs.item.hidden = true; ph.what = (hs.item.hidden ? "Hide " : "Show ") + hs.bk.label.toLowerCase() + ": " + bTitle(ph, hs.bk, hs.item, hs.block); }
    else { hs.sec.visible = hs.sec.visible === false; ph.what = (hs.sec.visible ? "Show section: " : "Hide section: ") + (hs.kind ? hs.kind.label : hs.id); }
    if (keep !== undefined) ph.sel = keep;
    pgMark(ph); edPatch(); pushPreview();
  }
  var FIELD_N = 0, FIELD_DEF = {};
  // One artist, one article, or a menu: a rounded tag once chosen, with Replace, Edit, Connect stored data and Remove.
  function resItems(pgd, f) {
    if (f.type === "menu") return [{ v: "main", label: "Main menu", note: "The links in the menu bar" }, { v: "footer", label: "Footer menu", note: "The links at the bottom of every page" }];
    if (f.type === "piece") return (((pgd.site || {}).articles) || []).map(function (a) { return { v: a.slug, label: a.title + (a.hidden ? " (hidden)" : ""), pic: a.image, hash: "a-" + a.slug }; });
    var full = (pgd.site && pgd.site.artists) || [];
    return (pgd.artists || []).map(function (a) { var x = full.find(function (y) { return y.slug === a.slug; }) || {}; return { v: a.slug, label: a.name, pic: x.image, hash: "artist-" + a.slug }; });
  }
  function resThumb(pgd, it) { var pic = it && it.pic, src = !pic ? "" : /^https?:/.test(pic) ? pic : /\//.test(pic) ? (pgd.preview || "") + pic : imageSrc(pgd, pic); return src ? '<img class="rthumb" src="' + esc(src) + '" alt="">' : '<span class="rthumb none" aria-hidden="true">' + esc(String((it && it.label) || "?").trim().charAt(0).toUpperCase()) + '</span>'; }
  function resField(pgd, f, v, path, id) {
    var items = resItems(pgd, f), cur = items.find(function (x) { return x.v === v; }), mode = pgd.res && pgd.res.path === path ? pgd.res.mode : "";
    var word = f.type === "menu" ? "menu" : f.type === "piece" ? "article" : "artist";
    var empty = f.type === "artists" ? (f.name == null ? "No artist chosen yet." : "None chosen, so the first published artist is shown.") : f.type === "menu" ? "No menu chosen yet." : "No article chosen yet.";
    var out = cur ? '<button type="button" class="rtag" id="' + id + '" data-act="ed-res" data-path="' + esc(path) + '" data-mode="menu" aria-haspopup="menu" aria-expanded="' + (mode === "menu") + '">' + (f.type === "menu" ? "" : resThumb(pgd, cur)) + '<span>' + esc(cur.label) + '</span></button>'
      : '<div class="rempty"><span class="small">' + esc(empty) + '</span><button type="button" class="soft slim" id="' + id + '" data-act="ed-res" data-path="' + esc(path) + '" data-mode="list">Select</button></div>';
    if (mode === "menu" && cur) out += '<div class="ed-pop resmenu" role="menu">' +
      '<button type="button" class="pp-item" role="menuitem" data-act="ed-res" data-path="' + esc(path) + '" data-mode="list">' + ic("swap") + '<span class="t">Replace</span></button>' +
      (cur.hash ? '<button type="button" class="pp-item" role="menuitem" data-act="ed-goto-item" data-hash="' + esc(cur.hash) + '">' + ic("pen") + '<span class="t">Edit</span><span class="k">Opens its page</span></button>' : "") +
      (f.type === "menu" ? "" : '<button type="button" class="pp-item" role="menuitem" disabled>' + ic("links") + '<span class="t">Connect stored data</span><span class="k">With templates</span></button>') +
      '<button type="button" class="pp-item danger" role="menuitem" data-act="ed-res-set" data-path="' + esc(path) + '" data-v="">' + ic("bin") + '<span class="t">Remove</span></button></div>';
    if (mode === "list") out += '<div class="ed-pop reslist" role="dialog" aria-label="Choose ' + (word === "article" ? "an" : "a") + " " + word + '"><input type="search" class="box" data-res-q="1" placeholder="Search ' + word + 's" aria-label="Search ' + word + 's"><div class="resitems">' +
      items.map(function (it) { return '<button type="button" class="pp-item' + (it.v === v ? " on" : "") + '" data-act="ed-res-set" data-path="' + esc(path) + '" data-v="' + esc(it.v) + '" data-q="' + esc(it.label.toLowerCase()) + '">' + (f.type === "menu" ? ic("list") : resThumb(pgd, it)) + '<span class="t">' + esc(it.label) + '</span>' + (it.note ? '<span class="k">' + esc(it.note) + '</span>' : "") + '</button>'; }).join("") +
      '<p class="small rnone" hidden>Nothing by that name.</p></div>' +
      (f.type === "menu" ? '<button type="button" class="pp-item" disabled>' + ic("plus") + '<span class="t">Create menu</span><span class="k">Menus are the menu bar and footer for now</span></button>'
        : '<button type="button" class="pp-item" data-act="ed-res-new" data-what="' + word + '">' + ic("plus") + '<span class="t">Create ' + word + '</span></button>') + '</div>';
    return '<div class="resf">' + out + '</div>';
  }
  function isPhoto(n) { return !/\.mp4$/i.test(n); }
  // Numbered groups instead of blocks: Slide 1, Slide 2, Slide 3, each with its own switch.
  function setField(pgd, f, v, path) {
    var rows = Array.isArray(v) ? v : [], out = "", word = f.label || "Group";
    for (var i = 0; i < (f.count || 3); i++) {
      var row = rows[i] && typeof rows[i] === "object" ? rows[i] : {}, on = row.on !== false;
      out += '<div class="setgrp' + (on ? "" : " off") + '" data-set="' + esc(path) + '"><div class="sub">' + esc(word + " " + (i + 1)) + '</div>' +
        (f.enable === false ? "" : edField(pgd, { name: "on", label: "Show " + word.toLowerCase() + " " + (i + 1), type: "yesno" }, on, path + "." + i + ".on")) +
        (f.fields || []).map(function (g) { return edField(pgd, g, row[g.name], path + "." + i + "." + g.name); }).join("") + '</div>';
    }
    return out;
  }
  // Links: the site's own kinds of page to choose from, or any address pasted in.
  function linkGroups(pgd) {
    var out = [], site2 = pgd.site || { articles: [], artists: [] };
    var push = function (id, label, items) { if (items.length) out.push({ id: id, label: label, items: items }); };
    if (pgd.gam) {
      var pages = []; Object.keys(pgd.doc.pages).forEach(function (k) { var pg = pgd.doc.pages[k], at = String(pg.path || "").replace(/index\.html$/, ""); if (k !== "home" && at) pages.push({ label: shortTitle(pgd, pg.title) || k, href: at }); });
      push("pages", "Pages", pages);
      push("artists", artistsWord(pgd), (site2.artists || []).map(function (a) { return { label: a.name, href: "artists/" + a.slug + "/", pic: a.image }; }));
      push("articles", "Articles", (site2.articles || []).filter(function (a) { return !a.hidden; }).map(function (a) { return { label: a.title, href: (pgd.model === "sad" ? (a.section || "dispatches") : "research") + "/" + a.slug + "/" }; }));
      return out;
    }
    pageGroups(pgd).forEach(function (g) {
      if (g.id === "site") return;
      push(g.id, g.label, g.items.filter(function (x) { return x.v !== "not-found" && !/\((hidden|not published)\)$/.test(x.label); }).map(function (x) { return { label: x.label, href: "#" + x.v }; }));
    });
    return out;
  }
  function linkOptions(pgd) {
    var out = []; linkGroups(pgd).forEach(function (g) { g.items.forEach(function (x) { out.push({ label: x.label, href: x.href, kind: g.label.replace(/s$/, ""), g: g.id }); }); }); return out;
  }
  function linkTag(pgd, v) {
    v = String(v == null ? "" : v).trim(); if (!v) return '<span class="ltag" hidden></span>';
    var hit = linkOptions(pgd).find(function (o) { return o.href === v; }), full = /^(https?:|mailto:)/i.test(v) ? v : (pgd.preview || "") + v;
    return '<span class="ltag"><span class="lt-t">' + esc(hit ? hit.label : v) + '</span>' + (/^mailto:/i.test(v) ? "" : '<a href="' + esc(full) + '" target="_blank" rel="noopener">Open</a>') + '</span>';
  }
  // The small list under a link field: the kinds of page first, then the pages of one kind, or everything that matches what is typed.
  function linkList(input) {
    var pgd = pgOf(); if (!pgd) return;
    var q = input.value.trim().toLowerCase(), box = input.parentNode, old = box.querySelector(".lopts"); if (old) old.remove();
    var groups = linkGroups(pgd), kind = groups.find(function (g) { return g.id === input.dataset.lkind; }), body;
    var opt = function (o, kindWord) { return '<button type="button" class="lopt" data-href="' + esc(o.href) + '" role="option"><span class="t">' + esc(o.label) + '</span>' + (kindWord ? '<em>' + esc(kindWord) + '</em>' : "") + '</button>'; };
    var exact = /^(https?:|mailto:|#|\/)/.test(q) && q.length > 1 && groups.every(function (g) { return g.items.every(function (x) { return x.href.toLowerCase() !== q; }); });
    if (kind) {
      var hits = kind.items.filter(function (o) { return !q || exact || o.label.toLowerCase().indexOf(q) >= 0 || o.href.toLowerCase().indexOf(q) >= 0; });
      body = '<button type="button" class="lopt lback" data-lback="1"><span class="t">All kinds of page</span></button><span class="cap">' + esc(kind.label) + '</span>' +
        (hits.length ? hits.map(function (o) { return opt(o, ""); }).join("") : '<span class="small">Nothing by that name in ' + esc(kind.label) + '.</span>');
    } else if (!q || exact) {
      body = groups.map(function (g) { return '<button type="button" class="lopt lkind" data-lkind="' + esc(g.id) + '"><span class="t">' + esc(g.label) + '</span><em>' + g.items.length + '</em></button>'; }).join("") +
        '<span class="small">Or paste a full address starting https://' + (exact ? ". This one is kept as you typed it." : "") + '</span>';
    } else {
      var all = []; groups.forEach(function (g) { g.items.forEach(function (o) { if (o.label.toLowerCase().indexOf(q) >= 0 || o.href.toLowerCase().indexOf(q) >= 0) all.push(opt(o, g.label.replace(/s$/, ""))); }); });
      body = all.slice(0, 40).join("") || '<span class="small">No page by that name. A full address starting https:// works too.</span>';
    }
    box.insertAdjacentHTML("beforeend", '<div class="lopts" role="listbox" aria-label="Pages on this site">' + body + '</div>');
  }
  function linkPicked(input, href) {
    input.value = href; pgInput(input);
    var box = input.parentNode, l = box.querySelector(".lopts"); if (l) l.remove();
    var tag = box.parentNode.querySelector(".ltag"), pgd = pgOf(); if (tag && pgd) tag.outerHTML = linkTag(pgd, href);
  }
  // Colours: a swatch and the hex code, with a small picker under it.
  function hexToHsv(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return { h: 150, s: 61, v: 29 };
    var n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = Math.round(h * 60); if (h < 0) h += 360;
    return { h: h, s: Math.round(mx ? d / mx * 100 : 0), v: Math.round(mx * 100) };
  }
  function hsvToHex(h, s2, v2) {
    s2 /= 100; v2 /= 100; var c = v2 * s2, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v2 - c, rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return "#" + rgb.map(function (y) { return ("0" + Math.round((y + m) * 255).toString(16)).slice(-2); }).join("").toUpperCase();
  }
  function colourPop(pgd, f, path, cv, hex) {
    var hsv = pgd.colourHsv && pgd.colourHsv.path === path ? pgd.colourHsv : Object.assign({ path: path }, hexToHsv(hex || "#1D4A35")); pgd.colourHsv = hsv;
    var theme = f.theme || [];
    return '<div class="cpop" data-cpop="' + esc(path) + '">' +
      (theme.length ? '<div class="cthemes"><span class="small">Theme colours</span><div class="row">' + theme.map(function (o) { return '<button type="button" class="chip' + (o[0] === cv ? " on" : " quiet") + '" data-act="ed-colour-set" data-path="' + esc(path) + '" data-v="' + esc(o[0]) + '">' + esc(o[1]) + '</button>'; }).join("") + '</div></div>' : "") +
      '<div class="csv" data-sv="' + esc(path) + '" style="background-color:hsl(' + hsv.h + ',100%,50%)" role="slider" aria-label="Colour: lightness and strength" aria-valuetext="' + esc(hex || "theme colour") + '" tabindex="0"><span class="cdot" style="left:' + hsv.s + '%;top:' + (100 - hsv.v) + '%"></span></div>' +
      '<input type="range" class="chue" min="0" max="359" value="' + hsv.h + '" data-hue="' + esc(path) + '" aria-label="Hue">' +
      '<div class="row cfoot"><input type="text" class="hex" data-pf="' + esc(path) + '" data-kind="hex" value="' + esc(hex) + '" placeholder="#1D4A35" maxlength="7" spellcheck="false" aria-label="Hex code">' +
      (window.EyeDropper ? '<button type="button" class="tw" data-act="ed-eyedrop" data-path="' + esc(path) + '">Eyedropper</button>' : "") +
      '<button type="button" class="tw" data-act="ed-colour" data-path="' + esc(path) + '">Done</button></div></div>';
  }
  // Puts a colour in place as it moves, without drawing the panel again.
  function setColour(path, hex, fromHsv) {
    var pgd = pgOf(), sel = pgd && pgSel(pgd); if (!pgd || (!sel && !isThemePath(path))) return;
    if (isThemePath(path)) themeSet(path, hex); else pgSet(sel.sec.settings, path, hex);
    if (!fromHsv) pgd.colourHsv = Object.assign({ path: path }, hexToHsv(hex));
    var q = '[data-pf="' + cssq(path) + '"]';
    Array.prototype.forEach.call(app.querySelectorAll(q + '[data-kind="hex"]'), function (x) { if (x !== document.activeElement) x.value = hex; });
    var sw = app.querySelector('.cswatch[data-path="' + cssq(path) + '"]'); if (sw) { sw.style.background = hex; sw.classList.remove("themed"); }
    var hv = pgd.colourHsv, pop = app.querySelector('.cpop[data-cpop="' + cssq(path) + '"]');
    if (pop && hv) { var sv = pop.querySelector(".csv"), dot = pop.querySelector(".cdot"), hue = pop.querySelector(".chue"); sv.style.backgroundColor = "hsl(" + hv.h + ",100%,50%)"; dot.style.left = hv.s + "%"; dot.style.top = (100 - hv.v) + "%"; if (hue !== document.activeElement) hue.value = hv.h; Array.prototype.forEach.call(pop.querySelectorAll(".cthemes .chip"), function (c) { c.classList.remove("on"); c.classList.add("quiet"); }); }
    if (!sel) return;
    pgd.what = "Edit " + (sel.kind ? sel.kind.label : sel.id); pgMark(pgd); patchEdTop(); pushSoon();
  }
  // Fonts: "Family", or "Family:700" or "Family:400i" with a style. Empty means the theme's font.
  var SYS_FONTS = [["system-sans", "System sans serif", "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"], ["system-serif", "System serif", "Georgia, 'Times New Roman', serif"], ["system-mono", "System monospace", "ui-monospace, Menlo, Consolas, monospace"]];
  function parseFont(v) { var m = /^([^:]+?)(?::(\d{3}i?))?$/.exec(String(v || "").trim()); return m ? { family: m[1], style: m[2] || "400" } : { family: "", style: "400" }; }
  function fontName(fam) { var s2 = SYS_FONTS.find(function (x) { return x[0] === fam; }); return s2 ? s2[1] : fam; }
  function fontStack(fam) { var s2 = SYS_FONTS.find(function (x) { return x[0] === fam; }); return s2 ? s2[2] : "'" + fam + "', serif"; }
  function fontCss(fv) { return "font-family:" + fontStack(fv.family) + ";font-weight:" + parseInt(fv.style, 10) + ";font-style:" + (/i$/.test(fv.style) ? "italic" : "normal"); }
  function styleName(st) { var w = { 300: "Light", 400: "Regular", 500: "Medium", 600: "Semi bold", 700: "Bold", 800: "Extra bold", 900: "Black" }[parseInt(st, 10)] || st; return /i$/.test(st) ? (w === "Regular" ? "Italic" : w + " italic") : w; }
  function fontStyles(req, fam) {
    if (!req || SYS_FONTS.some(function (x) { return x[0] === fam; })) return ["400", "400i", "700", "700i"];
    var m = /:(ital,wght|wght|ital)@(.+)$/.exec(req), out = [];
    if (!m) return ["400"];
    m[2].split(";").forEach(function (t2) { var p2 = t2.split(","); if (m[1] === "ital") out.push(p2[0] === "1" ? "400i" : "400"); else if (m[1] === "wght") out.push(p2[0]); else out.push(p2[1] + (p2[0] === "1" ? "i" : "")); });
    return out.filter(function (x, i, a) { return a.indexOf(x) === i; });
  }
  function fontList(pgd, f) { var t2 = state.theme[(site() || {}).id]; return (f && f.fonts) || (t2 && t2.spec.fontRequests) || {}; }
  function loadFontList(fonts) {
    var keys = Object.keys(fonts); if (!keys.length || !document.head) return;
    var href = "https://fonts.googleapis.com/css2?" + keys.map(function (k) { return "family=" + fonts[k]; }).join("&") + "&display=swap", l = document.getElementById("adh-fontlist");
    if (l && l.getAttribute("href") === href) return;
    if (!l) { l = document.createElement("link"); l.id = "adh-fontlist"; l.rel = "stylesheet"; document.head.appendChild(l); }
    l.setAttribute("href", href);
  }
  // The font picker opens in the right-hand panel: search, system fonts, the other fonts in their own typeface, the styles, then Done.
  function fontPanel(pgd) {
    var fp = pgd.fontPick;
    var cur = parseFont(fGet(pgd, fp.path)), fonts = fp.fonts;
    var opt = function (fam, label, stack) { return '<button type="button" class="fontopt' + (cur.family === fam ? " on" : "") + '" data-act="ed-font-set" data-v="' + esc(fam) + '" data-q="' + esc(label.toLowerCase()) + '" style="font-family:' + esc(stack) + '">' + esc(label) + '</button>'; };
    var styles = cur.family && !fp.noStyle ? fontStyles(fonts[cur.family], cur.family) : [];
    return '<div class="rhead"><div class="rtop"><span class="rkind">Font</span><span class="rbtns"><button type="button" class="tw" data-act="ed-font-close">Close</button></span></div><h2 class="rtitle">' + esc(fp.label) + '</h2><span class="small">A font shows on the page as soon as you click it. Done keeps it; Close puts the old one back.</span></div>' +
      '<div class="fontpick"><input type="search" class="box" data-input="fontq" placeholder="Search fonts" aria-label="Search fonts">' +
      (fp.noStyle ? "" : '<button type="button" class="fontopt' + (cur.family ? "" : " on") + '" data-act="ed-font-set" data-v="" data-q="theme font">Theme font</button>' +
      '<div class="sub">System fonts</div>' + SYS_FONTS.map(function (x) { return opt(x[0], x[1], x[2]); }).join("")) +
      '<div class="sub">Other fonts</div>' + Object.keys(fonts).sort().map(function (k) { return opt(k, k, "'" + k + "', serif"); }).join("") +
      '<p class="small fnone" hidden>No font by that name.</p></div>' +
      (styles.length ? '<div class="field"><label for="font-style">Style</label><select class="box" id="font-style" data-change="ed-font-style">' + styles.map(function (st) { return '<option value="' + st + '"' + (st === cur.style ? " selected" : "") + '>' + esc(styleName(st)) + '</option>'; }).join("") + '</select></div>' : "") +
      '<div class="row" style="margin:12px 4px"><button type="button" class="btn slim" data-act="ed-font-done">Done</button></div>';
  }
  function edField(pgd, f, value, path) {
    var id = "pf-" + (FIELD_N++), label = '<label for="' + id + '">' + esc(f.label) + '</label>', input = "";
    var more = f.more ? ' <a href="' + esc(f.more) + '" target="_blank" rel="noopener">Learn more</a>' : "";
    var hint = f.hint || more ? '<span class="small">' + esc(f.hint || "") + more + '</span>' : "";
    var t = f.type, v = value;
    if (path) FIELD_DEF[path] = f;
    // a short grey note between settings, sometimes with a way to the screen where something is changed
    var shared = sharedWord(pgd, v);
    if (shared && (t === "text" || t === "long")) {
      var real = shared.value, attrs = ' id="' + id + '" data-site-word="' + shared.word + '"';
      return '<div class="field">' + label + (t === "long" ? '<textarea class="box"' + attrs + ' rows="' + Math.max(3, Math.ceil(String(real).length / 38)) + '">' + esc(real) + '</textarea>' : '<input type="text" class="box"' + attrs + ' value="' + esc(real) + '">') +
        '<span class="small">Shared with Site details, so a change here shows everywhere these words are used. <button type="button" class="linklike small" data-act="ed-unshare" data-path="' + esc(path) + '" data-word="' + shared.word + '">Use different words here only</button></span></div>';
    }
    if (t === "info") return '<p class="info">' + esc(f.text || f.label || "") + (f.go ? ' <button type="button" class="linklike small" data-tab="' + esc(f.go) + '">' + esc(f.goLabel || "Open") + '</button>' : "") + '</p>';
    if (t === "set") return setField(pgd, f, value, path);
    if (t === "yesno") return '<div class="field swfield"><div class="swline">' + label + '<label class="switch"><input type="checkbox" role="switch" id="' + id + '" data-pf="' + esc(path) + '" data-kind="yesno"' + (v === true ? " checked" : "") + '><span class="knob" aria-hidden="true"></span></label></div>' + hint + '</div>';
    if (t === "text" && (f.addr || /^(href|url|map)$/.test(String(f.name)))) {
      input = '<div class="linkf"><input type="text" id="' + id + '" data-pf="' + esc(path) + '" data-linkq="1" value="' + esc(v == null ? "" : v) + '" placeholder="Paste a link or search" autocomplete="off" spellcheck="false"></div>' + linkTag(pgd, v);
    }
    else if (t === "text") input = '<input type="text" id="' + id + '" data-pf="' + esc(path) + '" value="' + esc(v == null ? "" : v) + '">';
    else if (t === "long") {
      if (f.plain) input = '<textarea id="' + id + '" data-pf="' + esc(path) + '">' + esc(v == null ? "" : v) + '</textarea>';
      else { richSource[path] = { html: String(v || ""), dirty: false }; input = '<div class="rt">' + richTools(id, !f.cite, f.cite && pgd.site ? pgd.site.sources : null) + '<div class="rt-page' + (f.cite ? "" : " short") + '" id="' + id + '" data-rich="' + esc(path) + '" data-pf-rich="1" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true" lang="en-GB"></div></div>'; }
    } else if (t === "lines") input = '<textarea id="' + id + '" data-pf="' + esc(path) + '" data-kind="lines" rows="3">' + esc((Array.isArray(v) ? v : [v || ""]).join("\n")) + '</textarea>' + (f.hint ? "" : '<span class="small">One line each.</span>');
    else if (t === "number") input = '<input type="number" step="' + (f.nullable ? "any" : "1") + '" min="0" id="' + id + '" data-pf="' + esc(path) + '" data-kind="' + (f.nullable ? "numnull" : "number") + '" value="' + esc(v == null ? "" : v) + '" style="max-width:' + (f.nullable ? "220px" : "140px") + '"' + (f.nullable ? ' placeholder="To confirm"' : "") + '>';
    else if (t === "pair") { var pv = Array.isArray(v) ? v : ["", ""]; input = '<div class="row" style="gap:8px;flex-wrap:nowrap"><input type="text" id="' + id + '" data-pf="' + esc(path) + '.0" value="' + esc(pv[0] || "") + '" aria-label="' + esc(f.labels[0]) + '" placeholder="' + esc(f.labels[0]) + '"><input type="text" data-pf="' + esc(path) + '.1" value="' + esc(pv[1] || "") + '" aria-label="' + esc(f.labels[1]) + '" placeholder="' + esc(f.labels[1]) + '"></div>'; }
    else if (t === "checks") input = '<div class="stack" style="gap:6px">' + f.options.map(function (o) { return '<label class="chk"><input type="checkbox" data-pf="' + esc(path) + '" data-kind="artists" value="' + esc(o[0]) + '"' + ((v || []).indexOf(o[0]) >= 0 ? " checked" : "") + '> ' + esc(o[1]) + '</label>'; }).join("") + '</div>';
    else if (t === "which") {
      var chosenW = Array.isArray(v), arts = pgd.site ? pgd.site.articles : [];
      input = '<select class="box" id="' + id + '" data-pf="' + esc(path) + '" data-kind="which">' + f.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (!chosenW && v === o[0] ? " selected" : "") + '>' + esc(o[1]) + '</option>'; }).join("") + '<option value="+chosen"' + (chosenW ? " selected" : "") + '>Articles I choose</option></select>' +
        (chosenW ? '<div class="picklist" style="margin-top:8px">' + (v.length ? '<ol>' + v.map(function (x, i) { var a = arts.find(function (y) { return y.slug === x; }); return '<li><span class="pk-name">' + esc(a ? a.title : x) + '</span><span class="pk-act">' + (i ? '<button type="button" class="linklike small" data-act="ed-pk" data-op="up" data-path="' + esc(path) + '" data-i="' + i + '">Up</button>' : "") + '<button type="button" class="linklike small" data-act="ed-pk" data-op="del" data-path="' + esc(path) + '" data-i="' + i + '">Remove</button></span></li>'; }).join("") + '</ol>' : '<span class="small">None chosen yet.</span>') +
          '<select class="box" data-change="ed-pk-add" data-path="' + esc(path) + '"><option value="">Add an article</option>' + arts.filter(function (a) { return v.indexOf(a.slug) < 0; }).map(function (a) { return '<option value="' + esc(a.slug) + '">' + esc(a.title) + '</option>'; }).join("") + '</select></div>' : "");
    }
    else if (t === "choice" && (f.seg || (!f.select && f.options.length >= 2 && f.options.length <= 4 && f.options.every(function (o) { return String(o[1]).length <= 12; })))) input = '<div class="seg wide" role="radiogroup" aria-label="' + esc(f.label) + '">' + f.options.map(function (o, oi) { var on = String(v == null || v === "" ? (f.dflt || f.options[0][0]) : v) === o[0]; return '<label class="segr' + (on ? " on" : "") + '"><input type="radio" name="' + id + '" data-pf="' + esc(path) + '" value="' + esc(o[0]) + '"' + (on ? " checked" : "") + (oi === 0 ? ' id="' + id + '"' : "") + '>' + esc(o[1]) + '</label>'; }).join("") + '</div>';
    else if (t === "piece" || t === "menu" || (t === "artists" && f.one)) input = resField(pgd, f, v, path, id);
    else if (t === "choice") input = '<select class="box" id="' + id + '" data-pf="' + esc(path) + '">' + f.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v == null ? "" : v) === o[0] ? " selected" : "") + '>' + esc(o[1]) + '</option>'; }).join("") + '</select>';
    else if (t === "range") {
      var rmin = f.min == null ? 0 : f.min, rmax = f.max == null ? 100 : f.max, rstep = f.step || 1, rv = v == null || v === "" || isNaN(Number(v)) ? (f.dflt != null ? f.dflt : rmin) : Number(v);
      var rat = ' min="' + rmin + '" max="' + rmax + '" step="' + rstep + '" data-pf="' + esc(path) + '" data-kind="number" data-twin="1" value="' + esc(rv) + '"';
      input = '<div class="slider"><input type="range" id="' + id + '"' + rat + ' style="--at:' + Math.round((rv - rmin) / ((rmax - rmin) || 1) * 100) + '%"><span class="numbox"><input type="number"' + rat + ' aria-label="' + esc(f.label) + ', as a number">' + (f.unit ? '<em>' + esc(f.unit) + '</em>' : "") + '</span></div>' +
        (f.reset ? (v == null || v === "" ? '<span class="small own">The site\'s own. Move it to change.</span>' : '<button type="button" class="linklike small own" data-act="ed-range-reset" data-path="' + esc(path) + '">Use the site\'s own</button>') : "");
    }
    else if (t === "colour") {
      var theme = f.theme || [], cv = String(v == null ? "" : v), th = theme.find(function (o) { return o[0] === cv; }), hex = /^#[0-9a-f]{6}$/i.test(cv) ? cv.toUpperCase() : "", copen = pgd.colourOpen === path;
      input = '<div class="colour"><button type="button" class="cswatch' + (hex ? "" : " themed") + '" data-act="ed-colour" data-path="' + esc(path) + '"' + (hex ? ' style="background:' + hex + '"' : "") + ' aria-expanded="' + copen + '" aria-label="' + esc(f.label) + ': open the colour picker"></button>' +
        '<input type="text" class="hex" id="' + id + '" data-pf="' + esc(path) + '" data-kind="hex" value="' + esc(hex || (th ? th[1] : "")) + '" placeholder="#1D4A35" maxlength="20" spellcheck="false" autocomplete="off"></div>' +
        (copen ? colourPop(pgd, f, path, cv, hex) : "");
    } else if (t === "image") {
      var src = imageSrc(pgd, v), open = pgd.picker === path, fname = !v ? "" : pgd.uploads && pgd.uploads[v] ? pgd.uploads[v].name : String(v).split("/").pop();
      var upl = '<label class="soft slim upl">Upload<input type="file" accept="image/jpeg,image/png" data-upload="' + esc(path) + '" hidden></label>';
      input = (v ? '<div class="imgpick">' + (src ? '<img class="picthumb" src="' + esc(src) + '" alt="">' : '<span class="picthumb none"></span>') + '<div class="stack"><span class="fname">' + esc(fname) + '</span><div class="row"><button type="button" class="soft slim" data-act="ed-picker" data-path="' + esc(path) + '">Change</button>' + upl + '<button type="button" class="linklike small danger" data-act="ed-pic-none" data-path="' + esc(path) + '">Remove</button></div></div></div>'
        : '<div class="imgpick empty"><span class="small">No picture yet</span><div class="row"><button type="button" class="soft slim" data-act="ed-picker" data-path="' + esc(path) + '">Select</button>' + upl + '</div></div>') +
        '<span class="small">JPG or PNG. Resized for the web, never cropped. Kept when you press Save.</span>';
      hint = "";
    } else if (t === "video") {
      var isUrl = /^https?:\/\//i.test(v || ""), vopen = pgd.picker === path, vids = (pgd.images || []).filter(function (n) { return /\.mp4$/i.test(n); });
      var vsrc = !v ? "" : isUrl ? v : (pgd.imageBase || "") + v;
      input = (v ? '<div class="imgpick"><video class="picthumb" src="' + esc(vsrc) + '" muted preload="metadata"></video><div class="stack"><span class="fname">' + esc(String(v).split("/").pop()) + '</span><div class="row"><button type="button" class="soft slim" data-act="ed-picker" data-path="' + esc(path) + '">Change</button><button type="button" class="linklike small danger" data-act="ed-pic-none" data-path="' + esc(path) + '">Remove</button></div></div></div>'
        : '<div class="imgpick empty"><span class="small">No video yet</span><div class="row"><button type="button" class="soft slim" data-act="ed-picker" data-path="' + esc(path) + '">Select</button></div></div>') +
        '<label class="small" for="' + id + 'l">Or a link to your own video</label><input type="text" id="' + id + 'l" data-pf="' + esc(path) + '" data-kind="vlink" value="' + esc(isUrl ? v : "") + '" placeholder="https://www.example.com/film.mp4" spellcheck="false">';
      hint = '<span class="small">MP4 only, your own files. It plays without sound, on a loop.' + more + '</span>';
    } else if (t === "code") {
      input = '<div class="cssbox open plain"><div class="code"><pre class="gut" aria-hidden="true">' + gutter(v) + '</pre><textarea class="ctext" id="' + id + '" data-pf="' + esc(path) + '" data-kind="code" spellcheck="false" wrap="off" rows="' + Math.max(6, String(v || "").split("\n").length + 1) + '" placeholder="h1 { letter-spacing: 0.01em; }">' + esc(v || "") + '</textarea></div></div>';
      hint = '<span class="small">Styles every page of the site. Styles for one section live in that section\'s own Custom CSS. Anything that would load from another website is taken out. <a href="https://developer.mozilla.org/en-GB/docs/Learn_web_development/Core/Styling_basics" target="_blank" rel="noopener">Learn more</a></span>';
    } else if (t === "font") {
      var fv = parseFont(v);
      input = '<button type="button" class="fontbtn" id="' + id + '" data-act="ed-font" data-path="' + esc(path) + '"' + (fv.family ? ' style="' + esc(fontCss(fv)) + '"' : "") + '><span>' + esc(fv.family ? fontName(fv.family) : "Theme font") + '</span><em>' + esc(fv.family ? styleName(fv.style) : "Change") + '</em></button>';
    } else if (t === "datetime") {
      var dm = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v || "") || [], yNow = new Date().getFullYear();
      var dsel = function (part, first, opts, cur, lab) { return '<select class="box" data-dt="' + esc(path) + '" data-part="' + part + '" aria-label="' + esc(f.label + ", " + lab) + '"' + (part === "d" ? ' id="' + id + '"' : "") + '><option value="">' + first + '</option>' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select>'; };
      var rng = function (a, b, step, pad) { var o = []; for (var i = a; i <= b; i += step) { var x = pad ? String(i).padStart(2, "0") : String(i); o.push([pad ? x : String(i), x]); } return o; };
      var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(function (m, i) { return [String(i + 1).padStart(2, "0"), m]; });
      input = '<div class="dt"><div class="dtrow">' + dsel("d", "Day", rng(1, 31, 1, true), dm[3], "day") + dsel("m", "Month", months, dm[2], "month") + dsel("y", "Year", rng(yNow - 1, yNow + 5, 1, false), dm[1], "year") + '</div>' +
        '<div class="dtrow"><span class="small">At</span>' + dsel("h", "Hour", rng(0, 23, 1, true), dm[4], "hour") + '<span class="small">:</span>' + dsel("i", "Min", rng(0, 55, 5, true), dm[5], "minute") + '</div></div>' +
        (v ? '<button type="button" class="linklike small" data-act="ed-dt-clear" data-path="' + esc(path) + '" style="align-self:flex-start">Clear</button>' : "");
    }
    else if (t === "sources" || t === "articles") {
      var opts = t === "sources" ? Object.keys(pgd.site ? pgd.site.sources : {}).map(function (k) { var x = pgd.site.sources[k]; return [k, (x.title || k) + (x.pub ? ", " + x.pub : "")]; })
        : (pgd.site ? pgd.site.articles : []).map(function (a) { return ["a-" + a.slug, a.title]; });
      var chosen = Array.isArray(v) ? v : [], nameOf = function (x) { var o = opts.find(function (y) { return y[0] === x; }); return o ? o[1] : x; };
      input = '<div class="picklist">' + (chosen.length ? '<ol>' + chosen.map(function (x, i) {
        return '<li><span class="pk-name">' + (t === "sources" ? '<b>' + (i + 1) + '</b> ' : "") + esc(nameOf(x)) + '</span><span class="pk-act">' +
          (i ? '<button type="button" class="linklike small" data-act="ed-pk" data-op="up" data-path="' + esc(path) + '" data-i="' + i + '">Up</button>' : "") +
          (t === "sources" ? '<button type="button" class="linklike small" data-act="ed-pk" data-op="edit" data-path="' + esc(path) + '" data-i="' + i + '">Details</button>' : "") +
          '<button type="button" class="linklike small" data-act="ed-pk" data-op="del" data-path="' + esc(path) + '" data-i="' + i + '">Remove</button></span></li>';
      }).join("") + '</ol>' : '<span class="small">None chosen yet.</span>') +
        '<select class="box" id="' + id + '" data-change="ed-pk-add" data-path="' + esc(path) + '"><option value="">' + (t === "sources" ? "Add a source" : "Add an article") + '</option>' +
        opts.filter(function (o) { return chosen.indexOf(o[0]) < 0; }).map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join("") +
        (t === "sources" ? '<option value="+new">A new source, not listed yet</option>' : "") + '</select></div>';
    }
    else if (t === "artists") {
      input = '<div class="stack" style="gap:6px">' + pgd.artists.map(function (a) { return '<label class="chk"><input type="checkbox" data-pf="' + esc(path) + '" data-kind="artists" value="' + esc(a.slug) + '"' + ((v || []).indexOf(a.slug) >= 0 ? " checked" : "") + '> ' + esc(a.name) + '</label>'; }).join("") + '</div>';
    } else if (t === "rows") {
      var rows = Array.isArray(v) ? v : [];
      input = '<div class="rows" data-rows="' + esc(path) + '">' + rows.map(function (row, i) {
        return '<div class="rowcard"><div class="row between"><span class="small">' + (i + 1) + '</span><span><button type="button" class="linklike small" data-act="ed-row-move" data-path="' + esc(path) + '" data-i="' + i + '" data-dir="-1"' + (i ? "" : " disabled") + '>Up</button> <button type="button" class="linklike small" data-act="ed-row-move" data-path="' + esc(path) + '" data-i="' + i + '" data-dir="1"' + (i < rows.length - 1 ? "" : " disabled") + '>Down</button> <button type="button" class="linklike small" data-act="ed-row-del" data-path="' + esc(path) + '" data-i="' + i + '">Remove</button></span></div>' +
          f.fields.map(function (g) { return edField(pgd, g, row ? row[g.name] : undefined, path + "." + i + "." + g.name); }).join("") + '</div>';
      }).join("") + '<button type="button" class="soft slim" data-act="ed-row-add" data-path="' + esc(path) + '">Add one</button></div>';
    }
    return '<div class="field">' + label + input + hint + '</div>';
  }

  function imageSrc(pgd, v) {
    if (!v) return "";
    if (pgd.uploads && pgd.uploads[v]) return pgd.uploads[v].dataUrl;
    return pgd.imageBase ? pgd.imageBase + v + (state.fileBust[v] ? "?v=" + state.fileBust[v] : "") : "";
  }
  // Reading and writing one setting by its path, such as "items.0.q".
  function pgGet(obj, path) { var cur = obj; path.split(".").forEach(function (k) { cur = cur == null ? undefined : cur[k]; }); return cur; }
  function pgSet(obj, path, value) {
    var parts = path.split("."), cur = obj;
    for (var i = 0; i < parts.length - 1; i++) { var k = parts[i]; if (cur[k] == null || typeof cur[k] !== "object") cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {}; cur = cur[k]; }
    cur[parts[parts.length - 1]] = value;
  }
  var pushTimer = null;
  function pushPreview(pick) {
    var pgd = pgOf(), frame = app.querySelector && app.querySelector("#ed-frame"); if (!pgd || !frame || !frame.contentWindow || pgd.inspector === false) return;
    var sel = pgSel(pgd), images = {};
    Object.keys(pgd.uploads || {}).forEach(function (k) { images[k] = pgd.uploads[k].dataUrl; });
    var block = -1, label = "", bf = "", bi = -1;
    if (sel && sel.child) sel = Object.assign({}, sel, { bk: sel.pbk, block: sel.pblock, list: sel.plist, item: sel.pitem, child: false, single: false });
    if (sel) {
      label = sel.kind ? sel.kind.label : "";
      if (sel.block != null && !selHidden(sel)) {
        var firstKind = bkinds(sel.kind)[0];
        bf = sel.bk.field; bi = sel.block; label = sel.single ? sel.bk.label : sel.bk.label + ": " + bTitle(pgd, sel.bk, sel.item, sel.block);
        if (!sel.single && firstKind && firstKind.field === sel.bk.field) block = sel.list.slice(0, sel.block).filter(function (x) { return !blockHidden(x); }).length;
      }
    }
    var id = pick != null ? pick : (sel ? (sel.where === "list" ? "listhead" : sel.where === "pageinfo" || sel.where === "source" ? "" : sel.id) : "");
    var pictures = Object.keys(pgd.pictures || {}).map(function (k) { var p = pgd.pictures[k]; return { key: k, image: p.image, alt: p.alt, credit: p.credit }; });
    if (sel && sel.pic) label = sel.kind.label;
    var gamAt = pgd.gam ? { kind: atKind(pgd), key: atKey(pgd) } : null;
    try { frame.contentWindow.postMessage({ type: "adh-pages", names: previewNames(pgd), social: themeSocial(), at: gamAt || atHash(pgd), data: pgd.gam ? pgd.site : undefined, content: pgd.gam ? undefined : pgd.site || undefined, show: atKind(pgd) === "article" ? atKey(pgd) : "", pages: { shared: pgd.doc.shared, pages: pgd.doc.pages, lists: pgd.doc.lists, groups: pgd.doc.groups || { top: [], popups: [], bottom: [] }, templates: pgd.doc.templates || {}, assign: pgd.doc.assign || {} }, tpl: tplHere(pgd) ? { kind: tplHere(pgd), id: tplId(pgd) } : null, images: images, pictures: pictures, pick: id, block: id ? block : -1, bf: id ? bf : "", bi: id ? bi : -1, label: id ? label : "", scroll: !!pgd.scrollNext }, new URL(pgd.preview).origin); } catch (e) { /* preview only */ }
    pgd.scrollNext = false; themePush();
  }
  // The names the preview shows on its outlines: each section's name, and each kind of block's.
  function previewNames(pgd) {
    var out = {}, g = pgd.doc.groups || {}, add = function (x) {
      var kd = pgd.kinds[x.type]; if (!kd) return; out[x.id] = secName(pgd, x);
      bkinds(kd).forEach(function (b) { out[x.id + ":" + b.field] = b.label; (b.blocks || []).forEach(function (c) { out[x.id + ":" + c.field] = c.label; }); });
    };
    pgSections(pgd).forEach(add); ["top", "popups", "bottom"].forEach(function (k) { (g[k] || []).forEach(add); });
    if (tplHere(pgd)) secList(pgd, "tpl").forEach(function (x) { if (x.type !== "main") add(x); });
    Object.keys(pgd.doc.shared || {}).forEach(function (k) { var x = pgd.doc.shared[k], kd = pgd.kinds[x.type]; if (!kd) return; out[k] = x.name || kd.label; bkinds(kd).forEach(function (b) { out[k + ":" + b.field] = b.label; }); });
    return out;
  }
  // A plus on the edge of an outline in the preview: add a section, or a block, just above or below what it is on.
  function previewAdd(pgd, d) {
    pickSection(String(d.id || ""), d.block, true, undefined, String(d.bf || ""));
    var sel = pgd.sel, below = d.edge === "bottom"; if (!sel) return;
    if (sel.block != null && sel.bf) {
      pgd.picker2 = { mode: "block", where: sel.where, id: sel.id, bf: sel.bf, at: sel.block + (below ? 1 : 0) };
      var can = pickerItems(pgd); if (can.length === 1) { pickerAdd(pgd, can[0].key); return; }
    } else if (isSecList(sel.where)) {
      var at = secList(pgd, sel.where).findIndex(function (x) { return x.id === sel.id; });
      pgd.picker2 = { mode: "section", at: at < 0 ? 0 : at + (below ? 1 : 0), g: sel.where };
    } else return;
    pgd.panel = ""; edPatch(); focusPicker();
  }
  // The small bar at the bottom of the preview for whatever is picked: Duplicate, Hide and Remove.
  function edFloatBar(pgd) {
    if (pgd.inspector === false || pgd.picker2 || pgd.lib || themeOpen(pgd)) return "";
    var sel = pgSel(pgd), t = toolsFor(pgd, sel); if (!t || (!t.movable && !t.canHide)) return "";
    var name = t.isBlock ? (sel.single ? sel.bk.label : sel.bk.label) : secName(pgd, sel.sec);
    return '<div class="fbar" role="toolbar" aria-label="' + esc(name) + '"><span class="fb-name">' + esc(name) + '</span>' +
      (t.movable ? '<button type="button" data-act="ed-dup">' + ic("copy", 16) + 'Duplicate</button>' : "") +
      (t.canHide ? '<button type="button" data-act="ed-hide">' + ic(t.hid ? "eye" : "eyeoff", 16) + (t.hid ? "Show" : "Hide") + '</button>' : "") +
      (t.canDel ? '<button type="button" class="danger" data-act="ed-remove">' + ic("bin", 16) + 'Remove</button>' : "") + '</div>';
  }
  var DESK_WIDTH = 1280;
  function edFit() {
    var box = app.querySelector && app.querySelector(".ed-frame"), fr = box && box.querySelector("iframe"); if (!box || !fr) return;
    var w = box.clientWidth, h = box.clientHeight;
    if (!box.classList.contains("computer") || !w || !h || w >= DESK_WIDTH || w < 600) { fr.style.width = ""; fr.style.height = ""; fr.style.transform = ""; return; }
    var k = w / DESK_WIDTH; fr.style.width = DESK_WIDTH + "px"; fr.style.height = Math.ceil(h / k) + "px"; fr.style.transformOrigin = "0 0"; fr.style.transform = "scale(" + k + ")";
  }
  function edFitWatch() {
    var box = app.querySelector && app.querySelector(".ed-frame"); if (!box) return; edFit();
    if (typeof ResizeObserver === "function" && box.adhWatched !== true) { box.adhWatched = true; new ResizeObserver(function () { edFit(); }).observe(box); }
  }
  function pushSoon() { clearTimeout(pushTimer); pushTimer = setTimeout(function () { pushPreview(); }, 150); }
  function mountPages() {
    var pgd = pgOf(), frame = app.querySelector && app.querySelector("#ed-frame"); if (!pgd || !frame) return;
    frame.addEventListener("load", function () { pgd.sent = true; pushPreview(); });
    if (pgd.sent) pushPreview();
    mountDrag(); edFitWatch();
  }
  // Drag a section within its group, or a block within its section. A line shows where it will land.
  function mountDrag() {
    var pgd = pgOf(), left = app.querySelector && app.querySelector(".ed-left"); if (!pgd || !left || !left.addEventListener || left.dataset.drag) return;
    left.dataset.drag = "1";
    var drag = null;
    var rowOf = function (t) {
      var row = t && t.closest && t.closest(".sec[data-where]"); if (!row || !drag) return null;
      if (drag.block == null && row.classList.contains("blk")) { var wrap = row.closest(".blocks"); row = wrap && wrap.previousElementSibling && wrap.previousElementSibling.classList.contains("sec") ? wrap.previousElementSibling : null; if (!row) return null; }
      if (row.dataset.where !== drag.where) return null;
      if (drag.block == null) return row.classList.contains("blk") ? null : row;
      if (drag.sf) return row.dataset.id === drag.id && (row.dataset.bf || "") === drag.bf && Number(row.dataset.block) === drag.block && row.dataset.sf === drag.sf ? row : null;
      return row.classList.contains("blk") && !row.dataset.sf && row.dataset.id === drag.id && (row.dataset.bf || "") === drag.bf ? row : null;
    };
    var clear = function () { Array.prototype.forEach.call(left.querySelectorAll(".over"), function (x) { x.classList.remove("over"); }); };
    left.addEventListener("dragstart", function (ev) {
      var row = ev.target.closest && ev.target.closest(".sec[draggable]"); if (!row || ev.target.closest("#ed-rename")) return;
      drag = { where: row.dataset.where, id: row.dataset.id, bf: row.dataset.bf || "", block: row.dataset.block == null ? null : Number(row.dataset.block), sf: row.dataset.sf || "", sub: row.dataset.sub == null ? null : Number(row.dataset.sub) };
      try { ev.dataTransfer.setData("text/plain", drag.id); ev.dataTransfer.effectAllowed = "move"; } catch (e) { /* fine */ }
    });
    left.addEventListener("dragover", function (ev) { if (!drag) return; var row = rowOf(ev.target); clear(); if (row) { ev.preventDefault(); row.classList.add("over"); } });
    left.addEventListener("dragend", function () { drag = null; clear(); });
    left.addEventListener("drop", function (ev) {
      var row = rowOf(ev.target), d = drag; drag = null; clear(); if (!row || !d) return; ev.preventDefault();
      var p = pgOf(); if (!p) return;
      if (d.block == null) {
        var list = secList(p, d.where), from = list.findIndex(function (x) { return x.id === d.id; }), to = list.findIndex(function (x) { return x.id === row.dataset.id; });
        if (from < 0 || to < 0 || from === to) return;
        var moved = list.splice(from, 1)[0]; list.splice(to, 0, moved); p.what = "Move section: " + secName(p, moved);
      } else {
        p.sel = { where: d.where, id: d.id, block: d.block, bf: d.bf || undefined }; if (d.sf) { p.sel.sf = d.sf; p.sel.sub = d.sub; }
        var ms = pgSel(p); if (!ms || !ms.list) return;
        var bfrom = d.sf ? d.sub : d.block, bto = Number(d.sf ? row.dataset.sub : row.dataset.block); if (bfrom === bto) return;
        var bm = ms.list.splice(bfrom, 1)[0]; ms.list.splice(bto, 0, bm); if (d.sf) p.sel.sub = bto; else p.sel.block = bto; p.what = "Move " + ms.bk.label.toLowerCase() + ": " + blockTitle(bm, bto);
      }
      pgMark(p); edPatch(); pushPreview();
    });
  }
  // Duplicate: an exact copy straight underneath, picked, with its settings open.
  function dupSel(pd) {
      var ds = pd && pgSel(pd); if (!ds) return;
      if (ds.block != null && ds.single) return;
      if (ds.block != null) { var dupe = JSON.parse(JSON.stringify(ds.item)); if (dupe && !Array.isArray(dupe) && dupe.id) dupe.id = dupe.id + "-copy"; ds.list.splice(ds.block + 1, 0, dupe); if (ds.child) pd.sel.sub = ds.block + 1; else pd.sel.block = ds.block + 1; pd.what = "Add " + ds.bk.label.toLowerCase() + ": copy of " + blockTitle(ds.item, ds.block); }
      else { if (!isSecList(ds.where)) return; var copy = JSON.parse(JSON.stringify(ds.sec)); copy.id = newSectionId(pd, ds.sec.type, ds.where);
        var dl = secList(pd, ds.where), di = dl.findIndex(function (x) { return x.id === ds.id; }); dl.splice(di + 1, 0, copy);
        pd.summaries[sumKey(pd, ds.where, copy.id)] = pd.summaries[sumKey(pd, ds.where, ds.id)] || ""; pd.sel = { where: ds.where, id: copy.id, block: null }; pd.what = "Add section: copy of " + secName(pd, ds.sec); }
      pgMark(pd); edPatch(); pushPreview();
      }
  // Remove happens at once; the bar above the page offers to put it back.
  function removeSel(pgd, keep) {
    var rs = pgSel(pgd), restore = function () { if (keep !== undefined) pgd.sel = keep; };
    if (!rs || rs.pic || (rs.block != null && rs.single)) { restore(); return; }
    if (rs.block != null) {
      var item = rs.list.splice(rs.block, 1)[0];
      pgd.removed = { kind: "block", where: rs.where, id: rs.id, bf: rs.child ? rs.pbk.field : rs.bk.field, at: rs.block, item: item, page: pgd.page, pat: pgd.at, label: blockRowName(pgd, rs.bk, item, rs.block), child: rs.child ? { pblock: rs.pblock, sf: rs.bk.field } : null, tpl: rs.where === "tpl" ? { kind: tplHere(pgd), id: tplId(pgd) } : null };
      pgd.what = "Remove " + rs.bk.label.toLowerCase() + ": " + blockTitle(item, rs.block);
      var back = rs.child ? { where: rs.where, id: rs.id, block: rs.pblock, bf: rs.pbk.field } : { where: rs.where, id: rs.id, block: null };
      pgd.sel = keep && !(keep.where === rs.where && keep.id === rs.id && keep.block != null) ? keep : back;
    } else {
      if (!isSecList(rs.where) || (rs.where === "page" && rs.id === mainId(pgd))) { restore(); return; }
      var l = secList(pgd, rs.where), at = l.findIndex(function (x) { return x.id === rs.id; }), sec = l.splice(at, 1)[0];
      pgd.removed = { kind: "section", where: rs.where, at: at, sec: sec, page: pgd.page, pat: pgd.at, label: secName(pgd, sec), tpl: rs.where === "tpl" ? { kind: tplHere(pgd), id: tplId(pgd) } : null };
      pgd.what = "Remove section: " + secName(pgd, sec);
      pgd.sel = keep && !(keep.where === rs.where && keep.id === rs.id) ? keep : null;
    }
    state.confirm = null; pgd.panel = ""; pgd.picker2 = null; pgMark(pgd); edPatch(); pushPreview(pgd.sel ? undefined : "");
  }
  function putBack(pgd) {
    var r = pgd.removed; if (!r) return; pgd.removed = null;
    if (r.where === "page" || r.where === "item" || r.where === "tpl") { pgd.page = r.page; pgd.at = r.pat || ""; }
    if (r.tpl) { pgd.tplOpen = {}; pgd.tplOpen[r.tpl.kind] = r.tpl.id; }
    if (r.kind === "section") { var l = secList(pgd, r.where); l.splice(Math.min(r.at, l.length), 0, r.sec); pgd.sel = { where: r.where, id: r.sec.id, block: null }; }
    else if (r.child) {
      pgd.sel = { where: r.where, id: r.id, block: r.child.pblock, bf: r.bf }; var pc = pgSel(pgd); if (!pc || !pc.item || typeof pc.item !== "object") return;
      var carr = pc.item[r.child.sf]; if (!Array.isArray(carr)) { carr = []; pc.item[r.child.sf] = carr; }
      var cat = Math.min(r.at, carr.length); carr.splice(cat, 0, r.item); pgd.sel = { where: r.where, id: r.id, block: r.child.pblock, bf: r.bf, sf: r.child.sf, sub: cat };
    } else {
      pgd.sel = { where: r.where, id: r.id, block: null }; var ps = pgSel(pgd); if (!ps) return;
      var arr = ps.sec.settings[r.bf]; if (!Array.isArray(arr)) { arr = []; ps.sec.settings[r.bf] = arr; }
      var at = Math.min(r.at, arr.length); arr.splice(at, 0, r.item); pgd.sel = { where: r.where, id: r.id, block: at, bf: r.bf };
    }
    pgd.open = pgd.open || {}; pgd.open[r.where + ":" + (r.kind === "section" ? r.sec.id : r.id)] = true;
    pgd.what = "Put back: " + r.label; pgMark(pgd); pgd.scrollNext = true; edPatch(); pushPreview();
  }
  function addChild(pgd, d) {
    pgd.sel = { where: d.where, id: d.id, block: Number(d.block), bf: d.bf || undefined };
    var ps = pgSel(pgd); if (!ps || !ps.bk || !ps.item || typeof ps.item !== "object") return;
    var cbk = (ps.bk.blocks || []).filter(function (c) { return c.field === d.sf; })[0], cdef = ((ps.bdef || {}).fields || []).filter(function (f) { return f.name === d.sf; })[0];
    if (!cbk || !cdef) return;
    var arr = ps.item[d.sf]; if (!Array.isArray(arr)) { arr = []; ps.item[d.sf] = arr; }
    if (cbk.max && arr.length >= cbk.max) return;
    var at = d.at == null || d.at === "" ? arr.length : Math.max(0, Math.min(Number(d.at), arr.length));
    arr.splice(at, 0, blankFrom(cdef.fields || []));
    pgd.sel = { where: d.where, id: d.id, block: Number(d.block), bf: d.bf || undefined, sf: d.sf, sub: at };
    pgd.open = pgd.open || {}; pgd.open[d.where + ":" + d.id + ":" + (d.bf || "") + ":" + d.block] = true;
    pgd.what = (cbk.add || "Add a " + cbk.label.toLowerCase()) + " in " + ps.kind.label; pgMark(pgd); pgd.scrollNext = true; edPatch(); pushPreview();
  }
  function viewRemoved(pgd) {
    var r = pgd && pgd.removed; if (!r) return "";
    return '<div class="notice putback" role="status"><span>Removed <b>' + esc(r.label) + '</b>.</span><button type="button" class="linklike" data-act="ed-putback">Put it back</button></div>';
  }
  // The menu on a row of the list, opened with a right click.
  function ctxTarget(pgd) { var c = state.ctx; if (!c) return null; return { where: c.where, id: c.id, block: c.block, bf: c.bf }; }
  function ctxMenu(pgd, c) {
    var item = function (op, icon, label, o) { o = o || {}; return '<button type="button" class="pp-item' + (o.red ? " danger" : "") + '" data-act="ctx" data-op="' + op + '"' + (o.off ? " disabled" : "") + '>' + ic(icon) + '<span class="t">' + esc(label) + '</span>' + (o.key ? '<span class="kbd">' + esc(o.key) + '</span>' : o.note ? '<em>' + esc(o.note) + '</em>' : "") + '</button>'; };
    var hideKey = ED_CTRL + "+Shift+H", out = "";
    if (c.more) {
      var ms = pgSel(Object.assign({}, pgd, { sel: { where: c.where, id: c.id, block: c.block, bf: c.bf || undefined, sf: c.sf || undefined, sub: c.sub } })); if (!ms) return "";
      var mt = toolsFor(pgd, ms) || {};
      out = (ms.block == null ? item("rename", "text", "Rename") : "") + (mt.canHide ? item("hide", mt.hid ? "eye" : "eyeoff", mt.hid ? "Show" : "Hide", { key: hideKey }) : "") +
        item("code", "code", "Edit code", { off: true, note: "Later step" });
      return '<div class="ed-pop ctxm" role="menu" aria-label="More for this ' + (ms.block == null ? "section" : "block") + '" style="left:' + c.x + 'px;top:' + c.y + 'px">' + out + '</div>';
    }
    if (c.block != null) {
      var bs = pgSel(Object.assign({}, pgd, { sel: { where: c.where, id: c.id, block: c.block, bf: c.bf, sf: c.sf || undefined, sub: c.sub } })); if (!bs || bs.block == null) return "";
      var bfull = bs.bk.max && bs.list && bs.list.length >= bs.bk.max, bhid = bs.single ? selHidden(bs) : blockHidden(bs.item), canHideB = bs.single ? !!bs.bk.hide : !Array.isArray(bs.item);
      out = (bs.single ? "" : item("dup", "copy", "Duplicate", { off: bfull })) +
        (canHideB ? item("hide", bhid ? "eye" : "eyeoff", bhid ? "Show" : "Hide", { key: hideKey }) : "") +
        (bs.single ? "" : item("before", "plus", "Add block before", { off: bfull }) + item("after", "plus", "Add block after", { off: bfull })) +
        item("code", "code", "Edit code", { off: true, note: "Later step" }) +
        (bs.single ? "" : item("remove", "bin", "Remove", { red: true, key: "Shift+Delete" }));
    } else {
      var listy = isSecList(c.where), sec = listy ? secList(pgd, c.where).find(function (x) { return x.id === c.id; }) : (pgd.doc.shared || {})[c.id]; if (!sec) return "";
      var clip = state.clip && site() && state.clip.site === site().id, main = c.where === "page" && c.id === mainId(pgd), hid = sec.visible === false;
      out = item("copy", "copy", "Copy", { off: !listy }) + item("paste", "doc", "Paste", { off: !clip }) + item("dup", "copy", "Duplicate", { off: !listy }) +
        item("rename", "text", "Rename") + item("hide", hid ? "eye" : "eyeoff", hid ? "Show" : "Hide", { key: hideKey }) +
        item("before", "plus", "Add section before") + item("after", "plus", "Add section after") +
        item("code", "code", "Edit code", { off: true, note: "Later step" }) +
        (listy && !main ? item("remove", "bin", "Remove", { red: true, key: "Shift+Delete" }) : "");
    }
    return '<div class="ed-pop ctxm" role="menu" aria-label="What to do with this row" style="left:' + c.x + 'px;top:' + c.y + 'px">' + out + '</div>';
  }
  function ctxClose() { state.ctx = null; var m = app.querySelector && app.querySelector(".ctxm"); if (m) m.remove(); }
  function ctxOpen(pgd, row, x, y) {
    ctxClose();
    var dd = row.dataset || row;
    state.ctx = { more: !!dd.more, where: dd.where, id: dd.id, bf: dd.bf || "", block: dd.block == null || dd.block === "" ? null : Number(dd.block), sf: dd.sf || "", sub: dd.sub == null ? null : Number(dd.sub), x: 0, y: 0 };
    var html = ctxMenu(pgd, state.ctx); if (!html) { state.ctx = null; return; }
    var ed = app.querySelector(".ed"); if (!ed) return;
    ed.insertAdjacentHTML("beforeend", html);
    var m = ed.querySelector(".ctxm"), w = m.offsetWidth || 260, h = m.offsetHeight || 360;
    var vw = window.innerWidth || 1440, vh = window.innerHeight || 900;
    m.style.left = Math.max(8, Math.min(x, vw - w - 8)) + "px"; m.style.top = Math.max(8, Math.min(y, vh - h - 8)) + "px";
    var first = m.querySelector(".pp-item:not([disabled])"); if (first) first.focus();
  }
  function ctxDo(pgd, op) {
    var c = state.ctx; ctxClose(); if (!c) return;
    var keep = pgd.sel, target = { where: c.where, id: c.id, block: c.block, bf: c.bf || undefined };
    if (c.sf && c.sub != null) { target.sf = c.sf; target.sub = c.sub; }
    var listy = isSecList(c.where);
    if (c.more && op === "hide") { toggleHidden(pgd); return; }
    if (c.block != null) {
      if (op === "dup") { pgd.sel = target; dupSel(pgd); }
      else if (op === "hide") { pgd.sel = target; toggleHidden(pgd, keep); }
      else if (op === "remove") { pgd.sel = target; removeSel(pgd, keep); }
      else if ((op === "before" || op === "after") && c.sf && c.sub != null) addChild(pgd, { where: c.where, id: c.id, bf: c.bf, block: c.block, sf: c.sf, at: c.sub + (op === "after" ? 1 : 0) });
      else if (op === "before" || op === "after") { pgd.picker2 = { mode: "block", where: c.where, id: c.id, bf: c.bf || "", at: c.block + (op === "after" ? 1 : 0) }; var can = pickerItems(pgd).filter(function (x) { return !x.off; }); if (can.length === 1) { pickerAdd(pgd, can[0].key); return; } pgd.panel = ""; edPatch(); focusPicker(); }
      return;
    }
    var list = listy ? secList(pgd, c.where) : null, idx = list ? list.findIndex(function (x) { return x.id === c.id; }) : -1;
    // around a part of the frame, new sections go into the group beside it
    var g = listy ? c.where : c.id === "footer" ? "bottom" : "top", gat = listy ? idx : g === "bottom" ? secList(pgd, "bottom").length : 0;
    if (op === "copy") { var cs = list[idx]; state.clip = { site: site().id, sec: JSON.parse(JSON.stringify(cs)), label: secName(pgd, cs) }; state.notice = null; }
    else if (op === "paste") {
      if (!state.clip || state.clip.site !== site().id) return;
      var ps = JSON.parse(JSON.stringify(state.clip.sec)), into = secList(pgd, g); ps.id = newSectionId(pgd, ps.type, g);
      into.splice(listy ? idx + 1 : gat, 0, ps); pgd.summaries[sumKey(pgd, g, ps.id)] = "";
      pgd.sel = { where: g, id: ps.id, block: null }; pgd.what = "Paste section: " + secName(pgd, ps); pgd.scrollNext = true; pgMark(pgd); edPatch(); pushPreview(); return;
    }
    else if (op === "dup") { pgd.sel = target; dupSel(pgd); return; }
    else if (op === "rename") { state.renaming = { where: c.where, id: c.id, panel: !!c.more }; edPatch(); var ri = app.querySelector("#ed-rename"); if (ri) { ri.focus(); ri.select(); } return; }
    else if (op === "hide") { pgd.sel = target; toggleHidden(pgd, keep); return; }
    else if (op === "remove") { pgd.sel = target; removeSel(pgd, keep); return; }
    else if (op === "before" || op === "after") { pgd.picker2 = { mode: "section", g: g, at: listy ? idx + (op === "after" ? 1 : 0) : gat }; pgd.panel = ""; edPatch(); focusPicker(); return; }
    edPatch();
  }
  // Renaming a row in place: Enter keeps the new name, Escape puts the old one back.
  function renameDone(keepIt) {
    var pgd = pgOf(), r = state.renaming; state.renaming = null; if (!pgd || !r) return;
    var inp = app.querySelector("#ed-rename"), v = inp ? inp.value.replace(/\s+/g, " ").trim().slice(0, 40) : "";
    var sec = isSecList(r.where) ? secList(pgd, r.where).find(function (x) { return x.id === r.id; }) : (pgd.doc.shared || {})[r.id];
    if (keepIt && sec) {
      var kindName = (pgd.kinds[sec.type] || {}).label || sec.type, was = sec.name || "";
      if (!v || v === kindName) delete sec.name; else sec.name = v;
      if ((sec.name || "") !== was) { pgd.what = "Rename section: " + (sec.name || kindName); pgMark(pgd); }
    }
    edPatch();
  }
  // The three switches at the top left: Sections, Theme settings, Add-ons. The one already open hides the column.
  function edPanel(p) {
    var pgd = pgOf(); if (!pgd || !p) return;
    if ((pgd.leftPanel || "sections") === p && !pgd.leftHidden) pgd.leftHidden = true;
    else { pgd.leftPanel = p; pgd.leftHidden = false; }
    pgd.fontPick = null; edPatch(); edAddress(site(), pgd);
  }
  // With the inspector off, the page is shown as a visitor sees it: links work and clicks pick nothing.
  // Turning it back on loads the page again with the changes not yet saved.
  function edInspector() {
    var pgd = pgOf(); if (!pgd) return;
    pgd.inspector = pgd.inspector === false;
    pgd.sent = false;
    var fr = app.querySelector && app.querySelector("#ed-frame"); if (fr) fr.src = edFrameSrc(pgd);
    edPatch();
  }
  // Redraws the editor's panels without touching the page in the middle, which would reload it.
  function edPatch() {
    if (state.ctx) ctxClose();
    var ed = app.querySelector && app.querySelector(".ed"), s = site(), pgd = pgOf();
    if (!ed || !s || !pgd) { render(); return; }
    var right = edRight(pgd);
    ed.className = edClass(pgd, right);
    ed.querySelector(".ed-top").innerHTML = edTop(s, pgd);
    ed.querySelector(".ed-left").innerHTML = edLeft(pgd);
    var rp = ed.querySelector(".ed-right");
    if (right) { if (!rp) { rp = document.createElement("div"); rp.className = "ed-right"; ed.appendChild(rp); } rp.innerHTML = right; }
    else if (rp) rp.remove();
    var mid = ed.querySelector(".ed-mid"), notes = mid.querySelectorAll(".ask, .notice"); Array.prototype.forEach.call(notes, function (x) { x.remove(); });
    mid.insertAdjacentHTML("afterbegin", viewLeave() + viewAsk() + viewRemoved(pgd) + (state.notice ? '<p class="notice' + (state.notice.problem ? " problem" : "") + '" role="status">' + esc(state.notice.text) + '</p>' : ""));
    var pkb = ed.querySelector("#ed-pick"); if (pkb) pkb.innerHTML = edPicker(pgd);
    var fb = ed.querySelector("#ed-fbar"); if (fb) fb.innerHTML = edFloatBar(pgd);
    mountRich(); mountDrag(); edFitWatch();
    var onRow = ed.querySelector(".ed-left .sec.on"); if (onRow && right && typeof onRow.scrollIntoView === "function") onRow.scrollIntoView({ block: "nearest" });
  }
  function edRemember() { var s = site(), p = pgOf(); if (s && p) { state.edPrefs[s.id] = { mode: p.mode, page: p.page, sel: p.sel, at: p.at, leftPanel: p.leftPanel }; edAddress(s, p); } }
  // The page address records the site, the page and what is picked, so a link can open the editor right there.
  function edAddress(s, p) {
    try {
      if (!window.history || !history.replaceState) return;
      var u = new URL(window.location.href), sel = p && p.sel;
      if (s && p && state.tab === "pages" && themeOpen(p)) u.searchParams.set("tg", state.themeGroup == null ? "colours" : state.themeGroup || "none"); else u.searchParams.delete("tg");
      if (s && p && state.tab === "pages") u.searchParams.set("ed", [s.id, p.at || "page:" + (p.page || "home"), sel ? [sel.where, sel.id, sel.block == null ? "" : sel.block, sel.bf || "", sel.sf || "", sel.sub == null ? "" : sel.sub].join(".") : ""].join("~"));
      else if (u.searchParams.has("ed")) u.searchParams.delete("ed"); else return;
      history.replaceState(null, "", u.toString());
    } catch (e) { /* an address that cannot be changed here */ }
  }
  // Opening a link made by edAddress.
  function edFromAddress() {
    var raw = params.get("ed"); if (!raw || state.edLinked) return false; state.edLinked = true;
    var bits = raw.split("~"), sid = bits[0], at = bits[1] || "", sp = (bits[2] || "").split(".");
    if (!sites().some(function (x) { return x.id === sid; })) return false;
    var pref = { page: "home", at: "", sel: null };
    if (at.indexOf("page:") === 0) pref.page = at.slice(5) || "home"; else pref.at = at;
    if (sp[0] && sp[1]) { pref.sel = { where: sp[0], id: sp[1], block: sp[2] === "" || sp[2] == null ? null : Number(sp[2]) }; if (sp[3]) pref.sel.bf = sp[3]; if (sp[4] && sp[5] !== "" && sp[5] != null) { pref.sel.sf = sp[4]; pref.sel.sub = Number(sp[5]); } }
    if (params.get("tg")) { pref.leftPanel = "theme"; state.themeGroup = params.get("tg") === "none" ? "" : params.get("tg"); }
    state.edPrefs[sid] = pref; openSite(sid); if (state.site === sid && state.tab !== "pages") go("pages");
    return state.site === sid;
  }
  // Opens a template: the preview shows an article or artist using it, or any one when none does yet.
  function tplOpenIt(kind, id) {
    var pgd = pgOf(); if (!pgd || !tplAll(pgd, kind)[id]) return;
    var users = tplUsers(pgd, kind, id), all = tplItems(pgd, kind); if (!all.length) return;
    var ex = tplHere(pgd) === kind && users.some(function (x) { return x.slug === atKey(pgd); }) ? atKey(pgd) : (users[0] || all[0]).slug;
    state.edMenu = ""; state.tplEx = false;
    pgd.tplOpen = pgd.tplOpen || {}; pgd.tplOpen[kind] = id;
    navTo((kind === "article" ? "a-" : "artist-") + ex, true); patchEdTop();
  }
  function tplMake(pgd) {
    var d = pgd.tplNew; if (!d) return;
    var name = String(d.name || "").trim().slice(0, 25), all = tplAll(pgd, d.kind); if (!name) return;
    if (Object.keys(all).some(function (id) { return String(all[id].name || "").toLowerCase() === name.toLowerCase(); })) return;
    if (Object.keys(all).length >= 10) { state.notice = { text: "Each kind of page can have up to 10 templates.", problem: true }; pgd.tplNew = null; edPatch(); return; }
    var base = all[d.base] || all["default"], id = tplNewId(pgd, d.kind, name);
    all[id] = { name: name, sections: JSON.parse(JSON.stringify(base.sections || [{ id: "main", type: "main" }])) };
    pgd.tplNew = null; pgd.what = "Create template: " + name; pgMark(pgd); tplOpenIt(d.kind, id);
  }
  function tplRemove(pgd) {
    var k = tplHere(pgd), id = tplId(pgd), all = tplAll(pgd, k); if (!k || id === "default" || tplUsers(pgd, k, id).length) return;
    var name = all[id].name; delete all[id]; pgd.tplOpen = pgd.tplOpen || {}; pgd.tplOpen[k] = tplAssigned(pgd, k, atKey(pgd));
    pgd.sel = null; pgd.what = "Remove template: " + name; pgMark(pgd); patchEdTop(); edPatch(); pushPreview("");
  }
  function tplRenameDone(keep) {
    var pgd = pgOf(), r = state.tplRename; state.tplRename = null; if (!pgd || !r) return;
    var box = app.querySelector("#tpl-rename"), t = tplAll(pgd, r.kind)[r.id], v = box ? String(box.value || "").trim().slice(0, 25) : "";
    var all = tplAll(pgd, r.kind), clash = Object.keys(all).some(function (id) { return id !== r.id && String(all[id].name || "").toLowerCase() === v.toLowerCase(); });
    if (keep && t && v && v !== t.name && !clash) { t.name = v; pgd.what = "Rename template: " + v; pgMark(pgd); patchEdTop(); }
    else if (keep && clash) state.notice = { text: "Another template already has that name.", problem: true };
    edPatch();
  }
  function tplAssign(pgd, id) {
    var k = tplHere(pgd), slug = atKey(pgd); if (!k || !tplAll(pgd, k)[id]) return;
    pgd.doc.assign = pgd.doc.assign || {}; pgd.doc.assign[k] = pgd.doc.assign[k] || {};
    if (id === "default") delete pgd.doc.assign[k][slug]; else pgd.doc.assign[k][slug] = id;
    pgd.tplOpen = pgd.tplOpen || {}; pgd.tplOpen[k] = id;
    pgd.what = "Template for " + itemName(pgd) + ": " + tplAll(pgd, k)[id].name; pgMark(pgd); patchEdTop(); edPatch(); pushPreview();
  }
  function pickSection(id, block, fromPage, where, bf, sf, sub) {
    var pgd = pgOf(); if (!pgd) return;
    var b = block == null || block === "" || Number(block) < 0 ? null : Number(block), k = atKind(pgd);
    var gw = isGroup(where) ? where : !where ? groupOf(pgd, id) : "";
    if (id === "header" || id === "footer" || id === "opening") pgd.sel = { where: "shared", id: id, block: b };
    else if (gw) pgd.sel = { where: gw, id: id, block: b };
    else if (where === "tpl" || (!where && tplHere(pgd) && secList(pgd, "tpl").some(function (x) { return x.id === id && x.type !== "main"; }))) pgd.sel = { where: "tpl", id: id, block: b };
    else if (where === "item" || (!where && (k === "article" || k === "artist"))) pgd.sel = { where: "item", id: id, block: b };
    else if (where === "list" || (!where && k === "list")) pgd.sel = { where: "list", id: atKey(pgd), block: null };
    else if (where === "pageinfo" || where === "source") pgd.sel = { where: where, id: id, block: null };
    else if (pgSections(pgd).some(function (x) { return x.id === id; })) pgd.sel = { where: "page", id: id, block: b };
    else return;
    if (bf) pgd.sel.bf = bf;
    if (sf && sub != null && sub !== "") { pgd.sel.sf = sf; pgd.sel.sub = Number(sub); }
    if (!pgSel(pgd)) { pgd.sel = null; return; }
    // a click on the page without a kind counts hidden blocks out, so find the real one
    var sel = pgSel(pgd), first = sel && sel.kind ? bkinds(sel.kind)[0] : null;
    if (fromPage && !bf && b != null && first && !first.one) {
      var list = (sel.sec.settings || {})[first.field] || [], seen = -1;
      for (var i = 0; i < list.length; i++) { if (!blockHidden(list[i])) seen++; if (seen === b) { pgd.sel.block = i; break; } }
    }
    pgd.open = pgd.open || {}; if (isSecList(pgd.sel.where) || pgd.sel.where === "shared") pgd.open[pgd.sel.where + ":" + pgd.sel.id] = true;
    pgd.panel = ""; pgd.picker = ""; pgd.picker2 = null; pgd.fontPick = null; pgd.colourOpen = ""; pgd.res = null; pgd.lib = null; state.confirm = null; state.renaming = null; pgd.scrollNext = !fromPage; edRemember(); edPatch(); pushPreview();
  }
  function focusPicker() { try { var q = app.querySelector("[data-pick-q]"); if (q) q.focus(); } catch (e) { /* fine */ } }
  // Adds what was chosen in a picker: a section where the line was, or a block in its section.
  function pickerAdd(pgd, key) {
    var pk = pgd.picker2;
    if (pk.mode === "section") {
      var kd = pgd.kinds[key]; if (!kd) return;
      var g = isGroup(pk.g) || (pk.g === "tpl" && tplHere(pgd)) ? pk.g : "page";
      var saved = g === "page" ? ((JSON.parse(pgd.base || "{}").pages || {})[pgd.page] || { sections: [] }).sections || [] : [];
      // a section taken off this page comes back as it was; otherwise copy the one already on the site, or start fresh
      var back = saved.filter(function (x) { return x.type === key && !pgSections(pgd).some(function (y) { return y.id === x.id; }); })[0];
      var from = back || firstOnSite(pgd, key);
      var nid = back ? back.id : newSectionId(pgd, key, g);
      var sec = { id: nid, type: key, visible: true, settings: JSON.parse(JSON.stringify(from ? from.settings || {} : kd.starter || {})) };
      var secs = secList(pgd, g), at = Math.max(0, Math.min(pk.at == null || pk.at < 0 ? secs.length : pk.at, secs.length));
      secs.splice(at, 0, sec);
      pgd.summaries[sumKey(pgd, g, nid)] = ""; pgd.sel = { where: g, id: nid, block: null }; pgd.open = pgd.open || {};
      pgd.picker2 = null; pgd.what = "Add section: " + kd.label; pgMark(pgd); pgd.scrollNext = true; edPatch(); pushPreview(); return;
    }
    pgd.sel = { where: pk.where, id: pk.id, block: null };
    var ks = pgSel(pgd); if (!ks || !ks.kind) return;
    var bk = bkinds(ks.kind).filter(function (b) { return b.field === key; })[0]; if (!bk || bk.one) return;
    var arr = ks.sec.settings[bk.field]; if (!Array.isArray(arr)) { arr = []; ks.sec.settings[bk.field] = arr; }
    var blank;
    if (bk.item) blank = "";
    else { var bfd = ks.kind.fields.filter(function (f) { return f.name === bk.field; })[0]; if (!bfd) return; blank = blankFrom(bfd.fields); }
    var at = pk.bf === bk.field && pk.at >= 0 ? Math.min(pk.at, arr.length) : arr.length;
    arr.splice(at, 0, blank);
    pgd.sel = { where: pk.where, id: pk.id, block: at, bf: bk.field };
    pgd.picker2 = null; pgd.what = (bk.add || "Add a " + bk.label.toLowerCase()) + " in " + ks.kind.label; pgMark(pgd); pgd.scrollNext = true; edPatch(); pushPreview();
  }
  function newSectionId(pgd, type, where) {
    var g = pgd.doc.groups || {}, inGroups = (g.top || []).concat(g.popups || [], g.bottom || []).map(function (x) { return x.id; });
    var pre = isGroup(where) ? "every-" + type : where === "tpl" ? "t-" + type : type, n = 1, used = isGroup(where) ? inGroups : where === "tpl" ? secList(pgd, "tpl").map(function (x) { return x.id; }) : pgSections(pgd).map(function (x) { return x.id; });
    while (used.indexOf(pre + "-" + n) >= 0) n++;
    return pre + "-" + n;
  }
  // Every picture needs a description before it is saved.
  function missingDescription(pgd) {
    var found = null;
    Object.keys(pgd.doc.pages).forEach(function (pk) { (pgd.doc.pages[pk].sections || []).forEach(function (sec) {
      var k = pgd.kinds[sec.type]; if (!k || found) return;
      k.fields.forEach(function (f) {
        if (found) return;
        if (f.type === "image" && f.alt && (sec.settings || {})[f.name] && !String((sec.settings || {})[f.alt] || "").trim()) found = { page: pk, id: sec.id, label: k.label };
        if (f.type === "rows") (f.fields || []).forEach(function (g) {
          if (g.type !== "image" || !g.alt) return;
          (((sec.settings || {})[f.name]) || []).forEach(function (row, i) { if (!found && row && row[g.name] && !String(row[g.alt] || "").trim()) found = { page: pk, id: sec.id, block: i, bf: f.name, label: k.label }; });
        });
      });
    }); });
    if (found) return found;
    ["top", "popups", "bottom"].forEach(function (g) { secList(pgd, g).forEach(function (sec) {
      var k = pgd.kinds[sec.type]; if (!k || found) return;
      k.fields.forEach(function (f) {
        if (found) return;
        if (f.type === "image" && f.alt && (sec.settings || {})[f.name] && !String((sec.settings || {})[f.alt] || "").trim()) found = { g: g, id: sec.id, label: k.label };
        if (f.type === "rows") (f.fields || []).forEach(function (gf) {
          if (gf.type !== "image" || !gf.alt) return;
          (((sec.settings || {})[f.name]) || []).forEach(function (row, i) { if (!found && row && row[gf.name] && !String(row[gf.alt] || "").trim()) found = { g: g, id: sec.id, block: i, bf: f.name, label: k.label }; });
        });
      });
    }); });
    if (found) return found;
    tplKinds(pgd).forEach(function (tk) { var all = tplAll(pgd, tk); Object.keys(all).forEach(function (tid) { (all[tid].sections || []).forEach(function (sec) {
      var k = pgd.kinds[sec.type]; if (!k || found || sec.type === "main") return;
      k.fields.forEach(function (f) {
        if (found) return;
        if (f.type === "image" && f.alt && (sec.settings || {})[f.name] && !String((sec.settings || {})[f.alt] || "").trim()) found = { tpl: { kind: tk, id: tid }, id: sec.id, label: k.label };
        if (f.type === "rows") (f.fields || []).forEach(function (gf) {
          if (gf.type !== "image" || !gf.alt) return;
          (((sec.settings || {})[f.name]) || []).forEach(function (row, i) { if (!found && row && row[gf.name] && !String(row[gf.alt] || "").trim()) found = { tpl: { kind: tk, id: tid }, id: sec.id, block: i, bf: f.name, label: k.label }; });
        });
      });
    }); }); });
    if (found) return found;
    Object.keys(pgd.doc.shared || {}).forEach(function (key) {
      var part = pgd.doc.shared[key], k = pgd.kinds[part.type]; if (!k || found) return;
      (((part.settings || {}).logos) || []).forEach(function (g, i) { if (!found && g && g.image && !String(g.alt || "").trim()) found = { shared: key, block: i, bf: "logos", label: "the logo in the " + k.label.toLowerCase() }; });
    });
    if (found) return found;
    (pgd.gam && pgd.site ? pgd.site.artists : []).some(function (a) { if (a.image && !String(a.alt || "").trim()) { found = { at: "artist:" + a.slug, part: "picture", block: null, label: a.name }; return true; } return false; });
    if (found) return found;
    (pgd.site ? pgd.site.artists : []).some(function (a) { return (a.works || []).some(function (w, i) { if (w && w.image && !String(w.alt || "").trim()) { found = { at: "artist:" + a.slug, part: "works", block: i, label: "the artwork " + (w.title || i + 1) }; return true; } return false; }); });
    if (found) return found;
    var ch = picChanges(pgd);
    Object.keys(ch).some(function (k) {
      if (!ch[k].image || String(ch[k].alt || "").trim()) return false;
      var home = pgSections(pgd).find(function (sec) { return linkedOf(pgd, sec).some(function (l) { return l.key === k; }); });
      found = { page: pgd.page, id: home ? home.id : "", pic: k, label: "the picture of " + pgd.pictures[k].label }; return true;
    });
    return found;
  }
  function picChanges(pgd) {
    var was = JSON.parse(pgd.picBase || "{}"), out = {};
    Object.keys(pgd.pictures || {}).forEach(function (k) { var a = pgd.pictures[k], b = was[k] || {}; if (a.image !== b.image || a.alt !== b.alt || a.credit !== b.credit) out[k] = { image: a.image, alt: a.alt, credit: a.credit }; });
    return out;
  }
  function savePages(after) {
    var s = site(), pgd = pgOf(); if (!s || !pgd || !pgd.dirty) return;
    var miss = missingDescription(pgd);
    if (miss && miss.at) { pgd.at = miss.at; pgd.sel = { where: "item", id: miss.part, block: miss.block }; state.notice = { text: "Please describe the picture of " + miss.label + " before saving. It is read out to people who cannot see it.", problem: true }; edPatch(); pushPreview(); return; }
    if (miss && miss.tpl) { tplOpenIt(miss.tpl.kind, miss.tpl.id); pgd.sel = { where: "tpl", id: miss.id, block: miss.block == null ? null : miss.block, bf: miss.bf }; state.notice = { text: "Please describe the picture in " + miss.label + " before saving. It is read out to people who cannot see it.", problem: true }; edPatch(); pushPreview(); return; }
    if (miss && miss.shared) { pgd.sel = { where: "shared", id: miss.shared, block: miss.block, bf: miss.bf }; state.notice = { text: "Please give " + miss.label + " a name before saving. It is read out to people who cannot see it.", problem: true }; edPatch(); pushPreview(); return; }
    if (miss) { if (miss.page) { pgd.page = miss.page; pgd.at = ""; } pgd.sel = miss.id ? { where: miss.g || "page", id: miss.id, block: miss.block == null ? null : miss.block, bf: miss.bf, pic: miss.pic || "" } : null; state.notice = { text: "Please describe the picture in " + miss.label + " before saving. It is read out to people who cannot see it.", problem: true }; edPatch(); pushPreview(); return; }
    var doc = JSON.parse(JSON.stringify(pgd.doc)), what = pgd.what || (pgPage(pgd).title || pgd.page);
    var pics = picChanges(pgd), picNames = Object.keys(pics).map(function (k) { return pgd.pictures[k].label; });
    if (canon(doc) === pgd.base && picNames.length) what = "Picture of " + picNames.join(", ");
    var contentNow = siteChanged(pgd) ? JSON.parse(JSON.stringify(pgd.site)) : undefined;
    if (canon(doc) === pgd.base && !picNames.length && contentNow) what = pgd.what || "Edit " + (itemName(pgd) || "content");
    var used = canon(doc) + canon(pics) + (contentNow ? canon(contentNow) : ""), uploads = Object.keys(pgd.uploads || {}).filter(function (k) { return used.indexOf(JSON.stringify(k)) >= 0; }).map(function (k) { var u = pgd.uploads[k]; return { key: k, name: u.name, ext: u.ext, content: u.content }; });
    edRemember(); state.notice = null;
    var th = themeOf(), thSend = th && themeChanges(th) > 0 ? JSON.parse(JSON.stringify(th.draft)) : null;
    var saveTheme = function (r) { return thSend ? api("saveTheme", { site: s.id, values: thSend }).then(function () { th.values = JSON.parse(JSON.stringify(thSend)); return r; }) : r; };
    if (thSend && canon(doc) === pgd.base && !picNames.length && !contentNow && !uploads.length) {
      onLive(function () { change(key("pages", s.id), function () { return saveTheme({ ok: true }); }, function () { pgMark(pgd); state.dirty = false; if (after) setTimeout(after, 0); }, curCopy().kind === "trial" ? "Theme saved on this copy" : "Theme saved. Live in about two minutes"); }, "This theme change");
      return;
    }
    onLive(function () {
      change(key("pages", s.id), function () { return api("savePages", { site: s.id, pages: doc, what: what, uploads: uploads, pictures: pics, content: contentNow, version: pgd.version, replace: !!pgd.replaceNext }).then(saveTheme).catch(function (e) {
          pgd.replaceNext = false;
          if (e.stale) state.ask = { kind: "stale" };
          throw e;
        }); }, function () { state.dirty = false; if (after) setTimeout(after, 0); }, curCopy().kind === "trial" ? "Saved on this copy" : "Saved. Live in about two minutes");
    }, (picNames.length ? "This change, including the shared " + (picNames.length === 1 ? "picture of " + picNames[0] + "," : "pictures of " + picNames.join(" and ") + ",") : "This page change") + (uploads.length ? (uploads.length === 1 ? " and its new photo" : " and its " + uploads.length + " new photos") : ""));
  }

  // ---------- formatted text, edited as plain writing ----------
  // Article bodies are stored with formatting marks. The editor shows them
  // the way a document would, and turns the result back into the same
  // marks on save. Sources and built-in features are held aside untouched.

  var RICH_OK = { p: 1, h2: 1, h3: 1, h4: 1, ul: 1, ol: 1, li: 1, strong: 1, b: 1, em: 1, i: 1, a: 1, br: 1, blockquote: 1, cite: 1, span: 1, div: 1, sup: 1 };
  var RICH_BLOCK = { p: 1, h2: 1, h3: 1, h4: 1, ul: 1, ol: 1, li: 1, blockquote: 1, div: 1 };
  var RICH_ATTR = ["class", "href", "data-src", "id"];
  var TOKEN = /\[\[([A-Z]+):([a-z0-9-]+)\]\]/g;
  var rich = {};        // field name -> { keep: [...], dirty: bool } for the editors on screen
  var richSource = {};  // field name -> { html, dirty } waiting to be shown
  var richRange = null; // the words selected when "Link" was pressed

  function isRich(v) { return /<[a-z][^>]*>/i.test(String(v || "")); }
  function tagOf(n) { return String(n.nodeName || "").toLowerCase(); }
  function kids(n) { return Array.prototype.slice.call(n.childNodes || []); }
  function escText(v) { return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function attrsOf(n) {
    return RICH_ATTR.map(function (a) {
      var v = n.getAttribute(a); if (v == null) return "";
      if (a === "class") v = v.split(/\s+/).filter(function (c) { return c && c.indexOf("rt-") !== 0; }).join(" ");
      if (a === "href" && /^\s*(javascript|data|vbscript):/i.test(v)) v = "";
      return v ? " " + a + '="' + esc(v) + '"' : "";
    }).join("");
  }
  function strange(n) {
    if (n.nodeType !== 1) return false;
    return !RICH_OK[tagOf(n)] || kids(n).some(strange);
  }
  function tokenLabel(kind, slug) {
    var words = slug.replace(/-/g, " ");
    return kind === "TIMELINE" ? "The auction table for " + words + " appears here" : "A built-in feature appears here (" + kind.toLowerCase() + ", " + words + ")";
  }
  function textIn(v, block) {
    return escText(v).replace(TOKEN, function (m, kind, slug) {
      return "<" + (block ? "div" : "span") + ' class="' + (block ? "rt-lock" : "rt-chip") + '" contenteditable="false" data-token="' + m + '">' + esc(tokenLabel(kind, slug)) + "</" + (block ? "div" : "span") + ">";
    });
  }

  // From the stored text to what the editor shows.
  function richIn(root, keep) {
    function inline(n) {
      if (n.nodeType === 3) return textIn(n.nodeValue, false);
      if (n.nodeType !== 1) return "";
      var t = tagOf(n);
      if (t === "br") return "<br>";
      if (t === "sup" && /\bcite\b/.test(n.getAttribute("class") || "")) {
        keep.push(n.outerHTML);
        return '<span class="rt-chip" contenteditable="false" data-keep="' + (keep.length - 1) + '" title="' + esc("Source: " + String(n.textContent || "").replace(/[\[\]]/g, "")) + '">source</span>';
      }
      return "<" + t + attrsOf(n) + ">" + kids(n).map(inline).join("") + "</" + t + ">";
    }
    return kids(root).map(function (n) {
      if (n.nodeType === 3) {
        var v = n.nodeValue.trim(); if (!v) return "";
        return v.replace(TOKEN, "") ? "<p>" + textIn(v, false) + "</p>" : textIn(v, true);
      }
      if (n.nodeType !== 1) return "";
      if (strange(n)) {
        keep.push(n.outerHTML);
        return '<div class="rt-lock" contenteditable="false" data-keep="' + (keep.length - 1) + '">A built-in feature sits here, such as an interactive picture. It stays as it is.</div>';
      }
      return inline(n);
    }).join("");
  }

  // From what is in the editor back to the stored text.
  // A single line of text (no paragraphs of its own) is stored without paragraph marks.
  function richInline(root) { return !kids(root).some(function (n) { return n.nodeType === 1 && RICH_BLOCK[tagOf(n)]; }); }
  function richOut(root, keep, single) {
    function out(n) {
      if (n.nodeType === 3) return escText(String(n.nodeValue).replace(/ /g, " "));
      if (n.nodeType !== 1) return "";
      var k = n.getAttribute("data-keep");
      if (k != null) return keep[Number(k)] || "";
      var tk = n.getAttribute("data-token");
      if (tk != null) return /^\[\[[A-Z]+:[a-z0-9-]+\]\]$/.test(tk) ? tk : "";
      var t = tagOf(n);
      if (t === "script" || t === "style") return "";
      if (t === "br") return "<br>";
      if (t === "b") t = "strong";
      var inner = kids(n).map(out).join("");
      if (!RICH_OK[t]) return inner;
      var a = attrsOf(n);
      if (t === "span" && !a) return inner;
      if (t === "div" && !a) { if (kids(n).some(function (c) { return c.nodeType === 1 && RICH_BLOCK[tagOf(c)]; })) return inner; t = "p"; }
      if (RICH_BLOCK[t]) inner = inner.replace(/(<br>\s*)+$/, "");
      if (!inner.replace(/<br>|\s/g, "")) return RICH_BLOCK[t] ? "" : inner;
      return "<" + t + a + ">" + inner + "</" + t + ">";
    }
    var parts = [], run = "";
    function flush() { run = run.replace(/^(\s|<br>)+|(\s|<br>)+$/g, ""); if (run) parts.push("<p>" + run + "</p>"); run = ""; }
    kids(root).forEach(function (n) {
      var h = out(n);
      if (n.nodeType === 1 && RICH_BLOCK[tagOf(n)]) { flush(); if (h) parts.push(h); } else run += h;
    });
    flush();
    if (single) return parts.map(function (h) { return h.replace(/^<p>([\s\S]*)<\/p>$/, "$1"); }).join(" ");
    return parts.join("\n");
  }

  function mountRich() {
    rich = {};
    if (typeof DOMParser === "undefined" || !app.querySelectorAll) return;
    Array.prototype.forEach.call(app.querySelectorAll("[data-rich]"), function (ed) {
      var name = ed.dataset.rich, src = richSource[name] || { html: "", dirty: false }, keep = [];
      var doc = new DOMParser().parseFromString("<body>" + src.html + "</body>", "text/html");
      ed.innerHTML = richIn(doc.body, keep) || "<p><br></p>";
      rich[name] = { keep: keep, dirty: src.dirty, single: richInline(doc.body) };
    });
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) { /* older browsers */ }
  }
  function richTools(id, short, sources) {
    function b(cmd, label, extra) { return '<button type="button" class="rt-b" data-rt="' + cmd + '"' + (extra || "") + '>' + label + '</button>'; }
    return '<div class="rt-bar" role="toolbar" aria-label="Formatting">' +
      b("bold", "<b>Bold</b>") + b("italic", "<i>Italic</i>") + '<span class="rt-gap"></span>' +
      (short ? "" : b("h2", "Heading") + b("h3", "Small heading") + b("p", "Normal text") + '<span class="rt-gap"></span>' +
      b("ul", "Bullet list") + b("ol", "Numbered list") + '<span class="rt-gap"></span>') +
      b("link", "Link") + b("unlink", "Remove link") +
      (sources ? '<span class="rt-gap"></span><select class="rt-cite" data-cite="1" aria-label="Cite a source where the cursor is"><option value="">Cite a source</option>' + Object.keys(sources).map(function (k) { return '<option value="' + esc(k) + '">' + esc(sources[k].title || k) + '</option>'; }).join("") + '</select>' : "") + '</div>' +
      '<div class="rt-link" hidden><input type="text" aria-label="Web address for the link" placeholder="Paste the web address, for example https://www.tate.org.uk">' +
      '<button type="button" class="soft" data-rt="link-add">Add link</button><button type="button" class="linklike" data-rt="link-cancel">Cancel</button></div>' +
      '<span class="small rt-say" hidden>Select the words for the link first, then press Link.</span>';
  }
  function richCmd(btn) {
    var box = btn.closest(".rt"); if (!box) return;
    var ed = box.querySelector("[data-rich]"), panel = box.querySelector(".rt-link"), say = box.querySelector(".rt-say"), input = panel.querySelector("input");
    var c = btn.dataset.rt, r = rich[ed.dataset.rich];
    function run(cmd, value) { ed.focus(); document.execCommand(cmd, false, value == null ? null : value); if (r) r.dirty = true; }
    say.hidden = true;
    if (c === "link") {
      var sel = window.getSelection(), ok = sel && sel.rangeCount && !sel.isCollapsed && ed.contains(sel.anchorNode);
      if (!ok) { say.hidden = false; panel.hidden = true; return; }
      richRange = sel.getRangeAt(0).cloneRange(); panel.hidden = false; input.value = ""; input.focus();
    } else if (c === "link-cancel") { panel.hidden = true; richRange = null; }
    else if (c === "link-add") {
      var url = input.value.trim(); if (!url || !richRange) return;
      if (/^\s*(javascript|data|vbscript):/i.test(url)) return;
      if (!/^(https?:|mailto:|#|\/|@@)/i.test(url)) url = "https://" + url;
      ed.focus(); var s2 = window.getSelection(); s2.removeAllRanges(); s2.addRange(richRange);
      run("createLink", url); panel.hidden = true; richRange = null;
    }
    else if (c === "bold" || c === "italic" || c === "unlink") run(c);
    else if (c === "ul") run("insertUnorderedList");
    else if (c === "ol") run("insertOrderedList");
    else if (c === "h2" || c === "h3" || c === "p") run("formatBlock", "<" + c + ">");
  }

  // What is in the open form right now. Formatted fields are only
  // included when someone has changed them, so nothing is rewritten by accident.
  function collect(form) {
    var values = {};
    Array.prototype.forEach.call(form.querySelectorAll("[data-field]"), function (el) {
      if (!el.dataset.field) return;
      values[el.dataset.field] = el.dataset.kind === "lines" ? el.value.split(/\n\s*\n/) : el.value;
    });
    Array.prototype.forEach.call(form.querySelectorAll("[data-rich]"), function (el) {
      var r = rich[el.dataset.rich];
      if (r && r.dirty) values[el.dataset.rich] = richOut(el, r.keep, r.single);
    });
    return values;
  }
  function snapshot() {
    var form = app.querySelector && app.querySelector('form[data-form="entry"]'), o = openEntry();
    if (!form || !o || !o.e) return;
    state.draft = { k: key("entry", o.s.id, o.col.id, o.e.id), values: collect(form) };
  }

  function viewEditor(s, cols) {
    var col = cols[state.open.ci], e = col && col.entries[state.open.ei];
    if (!e) { state.open = null; return viewContent(); }
    var k = key("entry", s.id, col.id, e.id), busy = state.busy[k];
    var draft = state.draft && state.draft.k === k ? state.draft.values : {};
    richSource = {};
    var groups = [], parts = {};
    e.fields.forEach(function (f0, i) {
      var typed = Object.prototype.hasOwnProperty.call(draft, f0.name);
      var f = typed ? Object.assign({}, f0, { value: f0.type === "yesno" ? String(draft[f0.name]) === "true" : draft[f0.name] }) : f0;
      var id = "f-" + i, label = '<label for="' + id + '" id="l-' + i + '">' + esc(f.label) + '</label>', input;
      if (f.type === "long" && isRich(f0.value)) {
        richSource[f.name] = { html: String(f.value || ""), dirty: typed };
        input = '<div class="rt">' + richTools(id, !/<(p|h\d|ul|ol|div|blockquote)[\s>]/i.test(String(f0.value))) +
          '<div class="rt-page' + (String(f0.value).length < 400 ? " short" : "") + '" id="' + id + '" data-rich="' + esc(f.name) + '" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="l-' + i + '" spellcheck="true" lang="en-GB"></div></div>' +
          (String(f0.value).length < 400 ? "" : '<span class="small">Type as you would in a document. Select words, then use the buttons above to style them. The small grey tags mark sources and built-in features, and stay as they are.</span>');
      } else if (f.type === "long") {
        var big = String(f.value || "").length > 600;
        input = '<textarea id="' + id + '" data-field="' + esc(f.name) + '"' + (big ? ' class="tall"' : "") + '>' + esc(f.value) + '</textarea>';
      } else if (f.type === "lines") {
        input = '<textarea id="' + id + '" data-field="' + esc(f.name) + '" data-kind="lines">' + esc((f.value || []).join("\n\n")) + '</textarea><span class="small">One item per paragraph. Leave an empty line between them.</span>';
      } else if (f.type === "number") {
        input = '<input type="number" step="any" id="' + id + '" data-field="' + esc(f.name) + '" value="' + esc(f.value == null ? "" : f.value) + '" style="max-width:260px"><span class="small">Leave empty if it is not known.</span>';
      } else if (f.type === "yesno") {
        input = '<select class="box" id="' + id + '" data-field="' + esc(f.name) + '" style="max-width:200px"><option value="true"' + (f.value ? " selected" : "") + '>Yes</option><option value="false"' + (f.value ? "" : " selected") + '>No</option></select>';
      } else {
        input = '<input type="text" id="' + id + '" data-field="' + esc(f.name) + '" value="' + esc(f.value == null ? "" : f.value) + '">';
      }
      var g = f0.group || (f0.type === "long" && isRich(f0.value) && String(f0.value).length >= 400 ? f0.label : "Details");
      if (!parts[g]) { parts[g] = ""; if (g === "Details") groups.unshift(g); else groups.push(g); }
      parts[g] += '<div class="field">' + label + input + '</div>';
    });
    var at = Math.min(state.egroup, Math.max(groups.length - 1, 0));
    var fields = (groups.length > 1 ? '<div class="seg wide" role="tablist" aria-label="Parts of this page">' + groups.map(function (g, gi) {
        return '<button type="button" role="tab" class="' + (gi === at ? "on" : "") + '" data-act="egroup" data-g="' + gi + '">' + esc(g) + '</button>'; }).join("") + '</div>' : "") +
      groups.map(function (g, gi) { return '<div class="egroup stack-wide" data-g="' + gi + '"' + (gi === at ? "" : " hidden") + '>' + parts[g] + '</div>'; }).join("");
    var leaving = viewLeave();
    var danger;
    if (state.confirm === k + "|delete") {
      danger = '<div class="sunk stack"><b>Delete this ' + esc(col.singular) + '?</b><span class="muted">It comes off the site. You can bring it back from History.</span>' +
        '<div class="row"><button type="button" class="btn" data-act="entry-delete"' + (busy ? " disabled" : "") + '>Yes, delete it</button><button type="button" class="soft" data-act="cancel">Keep it</button></div></div>';
    } else {
      danger = '<div class="row">' +
        (col.canHide ? '<button type="button" class="soft" data-act="entry-hide"' + (busy ? " disabled" : "") + '>' + (e.hidden ? "Show on the site again" : "Hide from the site") + '</button>' : "") +
        (col.canDelete ? '<button type="button" class="linklike" data-act="ask" data-k="' + esc(k + "|delete") + '">Delete</button>' : "") + '</div>';
    }
    return '<div class="page-head"><button type="button" class="linklike" data-act="close" style="align-self:flex-start">Back to ' + esc(col.label.toLowerCase()) + '</button>' +
      '<h1>' + esc(e.title) + '</h1><p>' + esc(s.name) + (e.hidden ? ". Hidden from the site at the moment." : "") + '</p></div>' +
      leaving +
      '<form class="card stack-wide" data-form="entry">' + (fields || '<p class="muted">Nothing on this entry can be edited here yet.</p>') +
        '<div class="savebar"><button type="submit" class="btn key"' + (busy ? " disabled" : "") + '>' + (busy ? "Saving" : "Save") + '</button>' +
        '<button type="button" class="soft" data-act="close">Cancel</button>' +
        (groups.length > 1 ? '<span class="small">Saves every part of this page, not only the one on screen.</span>' : "") + '</div></form>' + danger;
  }

  // ----- photos -----

  function slotOptions(s, chosen) {
    var groups = {}, order = [];
    (s.slots || []).forEach(function (x) { if (!groups[x.group]) { groups[x.group] = []; order.push(x.group); } groups[x.group].push(x); });
    var html = '<option value="">Choose a spot</option>';
    order.forEach(function (g) {
      html += '<optgroup label="' + esc(g) + '">' + groups[g].map(function (x) {
        var waiting = x.waiting || state.photoSent[key(s.id, x.id)];
        var tag = waiting ? " (photo already waiting)" : x.filled ? " (has an image)" : " (empty)";
        return '<option value="' + esc(x.id) + '"' + (x.id === chosen ? " selected" : "") + (waiting || x.filled ? " disabled" : "") + '>' + esc(x.label + tag) + '</option>';
      }).join("") + '</optgroup>';
    });
    return html + '<option value="other"' + (chosen === "other" ? " selected" : "") + '>Somewhere else, I will describe it</option>';
  }
  function photoReady(p) { return p.slot && p.alt.trim() && (p.slot !== "other" || p.note.trim()); }

  function viewPhotos() {
    var s = site(); if (!s) return "";
    if (!s.slots) return head("Photos", "Choosing exact spots needs the newest server function.") +
      '<p class="notice problem">The server function in Supabase is an older copy. Paste in the latest version from GitHub and deploy it, then press Refresh.</p>';
    var rows = state.photoFiles.map(function (p, i) {
      return '<div class="sunk stack"><b>' + esc(p.file.name) + '</b>' +
        '<div class="field"><label for="slot-' + i + '">Where should it go?</label><select class="box" id="slot-' + i + '" data-change="photo-slot" data-i="' + i + '">' + slotOptions(s, p.slot) + '</select></div>' +
        (p.slot === "other" ? '<div class="field"><label for="pnote-' + i + '">Describe where it belongs</label><input type="text" id="pnote-' + i + '" data-input="photo-note" data-i="' + i + '" maxlength="70" value="' + esc(p.note) + '"></div>' : "") +
        '<div class="field"><label for="palt-' + i + '">Describe the picture</label><input type="text" id="palt-' + i + '" data-input="photo-alt" data-i="' + i + '" maxlength="240" value="' + esc(p.alt) + '" placeholder="For example: a woman seen from behind, painted in thick strokes on deep blue"><span class="small">Read aloud to people who cannot see the picture.</span></div>' +
        '<div class="field"><label for="pcap-' + i + '">Caption or credit (optional)</label><input type="text" id="pcap-' + i + '" data-input="photo-caption" data-i="' + i + '" maxlength="160" value="' + esc(p.caption) + '"></div>' +
        (p.status ? '<span>' + esc(p.status) + '</span>' : "") +
        '<div><button type="button" class="linklike" data-act="photo-remove" data-i="' + i + '">Take this photo out of the batch</button></div></div>';
    }).join("");
    var ready = state.photoFiles.length && state.photoFiles.every(photoReady);
    var spots = (s.slots || []).filter(function (x) { return x.filled || x.waiting; }).map(function (x) {
      var k = key("photo", s.id, x.id), canRemove = /^(artist|article)-/.test(x.id) && x.filled;
      var actions = state.confirm === k
        ? '<span class="small">Take this photo off the site?</span><button type="button" class="soft" data-act="photo-take" data-slot="' + esc(x.id) + '"' + (state.busy[k] ? " disabled" : "") + '>Yes, remove</button><button type="button" class="linklike" data-act="cancel">Keep it</button>'
        : (canRemove ? '<button type="button" class="linklike" data-act="ask" data-k="' + esc(k) + '">Remove</button>' : "");
      return '<div class="card" style="padding:14px"><div class="frame ' + (x.filled ? "full" : "empty") + '" aria-hidden="true">' + (x.filled ? "Photo in place" : "On its way") + '</div>' +
        '<div class="stack" style="gap:2px;padding:14px 8px 4px"><b style="color:var(--bright)">' + esc(x.label) + '</b><span class="small">' + esc(x.group) + '</span>' +
        '<div class="row" style="gap:16px">' + actions + '</div></div></div>';
    }).join("");
    var empty = (s.slots || []).filter(function (x) { return !x.filled && !x.waiting; }).length;
    return head("Photos", "Add photos, choose the exact spot for each and describe it. A photo for an empty spot is on the site within a few minutes. To replace a photo, remove it first, then add the new one.") +
      '<div class="card stack-wide">' +
        '<div class="field"><label for="p-file">Add photos</label><span class="small">JPG or PNG. Choose several at once if you like. ' + empty + ' empty ' + (empty === 1 ? "spot" : "spots") + ' on this site.</span></div>' +
        '<div class="sunk"><input type="file" id="p-file" data-change="photo-files" accept="image/jpeg,image/png" multiple></div>' +
        (rows ? '<div class="stack-wide">' + rows + '</div>' : "") +
        (state.photoFiles.length ? '<div class="row"><button type="button" class="btn" data-act="photo-send"' + (ready && !state.busy.photo ? "" : " disabled") + '>' +
          (state.busy.photo ? "Sending" : state.photoFiles.length === 1 ? "Send this photo" : "Send these " + state.photoFiles.length + " photos") + '</button>' +
          (ready ? "" : '<span class="small" id="photo-hint">Choose a spot and describe every photo first.</span>') + '</div>' : "") +
      '</div>' +
      '<div class="stack"><h2 class="label">Photos on this site</h2>' + (spots ? '<div class="grid-3">' + spots + '</div>' : '<p class="notice">No photos yet.</p>') + '</div>';
  }


  // ----- Files: every photo on the site -----

  var FILE_FILTERS = [["all", "All"], ["used", "Used"], ["unused", "Not used yet"], ["nodesc", "No description"], ["empty", "Places without a picture"]];
  function filesOf() { var s = site(); return (s && state.files[s.id]) || null; }
  function fileSrc(fd, name) { var b = state.fileBust[name]; return fd.imageBase + name + (b ? "?v=" + b : ""); }
  function fileCount(fd, f) {
    if (f === "empty") return fd.spots.filter(function (x) { return !x.image; }).length;
    return fd.files.filter(function (x) { return f === "all" || (f === "used" ? x.used.length : f === "unused" ? !x.used.length : !x.alt); }).length;
  }
  function viewFiles() {
    var s = site(); if (!s) return "";
    var fd = filesOf();
    var top = head("Files", "Every photo on " + s.name + ". Describe a photo once here and it comes with it whenever you choose it in Pages. Replace a photo and every place that uses it shows the new one.");
    if (!fd) return top + '<p class="loading">Reading the photos</p>';
    var adding = state.fileAdd.map(function (p, i) {
      return '<div class="addrow"><img src="' + esc(p.url) + '" alt=""><div class="stack" style="gap:8px;flex:1">' +
        '<b class="small" style="color:var(--bright)">' + esc(p.file.name) + '</b>' +
        '<div class="field"><label for="fa-alt-' + i + '">Describe the picture</label><input type="text" id="fa-alt-' + i + '" data-input="fadd-alt" data-i="' + i + '" maxlength="240" value="' + esc(p.alt) + '" placeholder="For example: a woman seen from behind, painted in thick strokes on deep blue"><span class="small">Read aloud to people who cannot see it.</span></div>' +
        '<div class="field"><label for="fa-cap-' + i + '">Caption or credit (optional)</label><input type="text" id="fa-cap-' + i + '" data-input="fadd-cap" data-i="' + i + '" maxlength="160" value="' + esc(p.caption) + '"></div>' +
        '<button type="button" class="linklike small" data-act="fadd-drop" data-i="' + i + '" style="align-self:flex-start">Leave this one out</button></div></div>';
    }).join("");
    var ready = state.fileAdd.length && state.fileAdd.every(function (p) { return p.alt.trim(); });
    var upload = '<div class="card stack-wide">' +
      '<div class="row between"><div class="stack" style="gap:2px"><b style="color:var(--bright)">Upload photos</b><span class="small">JPG or PNG, several at once if you like. Resized for the web, never cropped.</span></div>' +
      '<label class="btn slim upl">Choose photos<input type="file" accept="image/jpeg,image/png" multiple data-change="files-add" hidden></label></div>' +
      (adding ? '<div class="stack-wide">' + adding + '</div><div class="row"><button type="button" class="btn" data-act="files-send"' + (ready && state.status !== "saving" ? "" : " disabled") + '>' + (state.fileAdd.length === 1 ? "Add this photo" : "Add these " + state.fileAdd.length + " photos") + '</button>' +
        (ready ? "" : '<span class="small">Describe every photo first.</span>') + '</div>' : "") + '</div>';
    var filters = '<div class="seg mini filters" role="group" aria-label="Show">' + FILE_FILTERS.map(function (f) {
      return '<button type="button" class="' + (fd.filter === f[0] ? "on" : "") + '" data-act="files-filter" data-f="' + f[0] + '">' + esc(f[1]) + ' <span class="n">' + fileCount(fd, f[0]) + '</span></button>';
    }).join("") + '</div>';
    return top + upload + '<div class="stack-wide">' + filters + (fd.filter === "empty" ? viewFileSpots(fd) : viewFileGrid(fd)) + '</div>';
  }
  function viewFileGrid(fd) {
    var list = fd.files.filter(function (x) { var f = fd.filter; return f === "all" || (f === "used" ? x.used.length : f === "unused" ? !x.used.length : !x.alt); });
    if (!list.length) return '<p class="notice">' + (fd.files.length ? "No photos here." : "No photos on this site yet. Upload some above.") + '</p>';
    return '<div class="files">' + list.map(function (x) {
      var k = key("file", x.name), open = fd.open === x.name, asking = state.confirm === "fdel|" + x.name;
      var used = x.used.length ? '<ul class="used">' + x.used.map(function (u) {
        return '<li>' + (u.id ? '<button type="button" class="linklike" data-act="files-goto" data-page="' + esc(u.page) + '" data-where="' + esc(u.where) + '" data-id="' + esc(u.id) + '">' + esc(u.label) + '</button>' : esc(u.label)) + '</li>';
      }).join("") + '</ul>' : '<span class="small">Not used yet</span>';
      var actions = asking
        ? '<span class="small">Delete this photo for good?</span><button type="button" class="soft slim" data-act="files-remove" data-name="' + esc(x.name) + '">Yes, delete</button><button type="button" class="linklike small" data-act="cancel">Keep it</button>'
        : '<button type="button" class="linklike small" data-act="files-describe" data-name="' + esc(x.name) + '">' + (x.alt ? "Change description" : "Describe") + '</button>' +
          '<label class="linklike small upl">Replace everywhere<input type="file" accept="image/jpeg,image/png" data-change="files-replace" data-name="' + esc(x.name) + '" hidden></label>' +
          (x.used.length ? '<span class="small quiet">In use, so it cannot be deleted</span>' : '<button type="button" class="linklike small" data-act="ask" data-k="fdel|' + esc(x.name) + '">Delete</button>');
      return '<div class="card filecard"><div class="fthumb"><img src="' + esc(fileSrc(fd, x.name)) + '" alt="" loading="lazy"><span class="small">On its way. Ready in about two minutes.</span></div>' +
        '<div class="stack" style="gap:8px;padding:14px 14px 12px">' +
          '<div class="stack" style="gap:2px"><b class="fname">' + esc(x.name) + '</b><span class="small">' + (x.size ? Math.max(1, Math.round(x.size / 1024)) + " KB" : "") + '</span></div>' +
          (open ? '<form class="stack" data-form="fdesc" data-name="' + esc(x.name) + '"><div class="field"><label for="fd-alt">Describe the picture</label><input type="text" id="fd-alt" name="alt" maxlength="240" value="' + esc(x.alt) + '"><span class="small">Places that show this photo without a description get this one too.</span></div>' +
              '<div class="field"><label for="fd-cap">Caption or credit (optional)</label><input type="text" id="fd-cap" name="caption" maxlength="160" value="' + esc(x.caption) + '"></div>' +
              '<div class="row"><button type="submit" class="btn slim key"' + (state.busy[k] ? " disabled" : "") + '>Save</button><button type="button" class="linklike small" data-act="files-describe" data-name="">Cancel</button></div></form>'
            : (x.alt ? '<p class="fdesc">' + esc(x.alt) + '</p>' : '<span class="chip warn" style="align-self:flex-start">No description yet</span>') + (x.caption && !open ? '<span class="small">' + esc(x.caption) + '</span>' : "")) +
          '<div class="stack" style="gap:4px"><span class="label">Used in</span>' + used + '</div>' +
          '<div class="row factions">' + actions + '</div>' +
        '</div></div>';
    }).join("") + '</div>';
  }
  function viewFileSpots(fd) {
    var empty = fd.spots.filter(function (x) { return !x.image; });
    if (!empty.length) return '<p class="notice">Every place on the site has a picture.</p>';
    var groups = [];
    empty.forEach(function (x) { var g = groups.find(function (y) { return y.name === x.group; }); if (!g) groups.push(g = { name: x.group, list: [] }); g.list.push(x); });
    return groups.map(function (g) {
      return '<div class="stack" style="gap:8px"><h2 class="label">' + esc(g.name) + '</h2><div class="spots">' + g.list.map(function (x) {
        var open = fd.assign === x.key, chosen = open && fd.pick ? fd.files.find(function (f) { return f.name === fd.pick; }) : null;
        return '<div class="card spot' + (open ? " open" : "") + '"><div class="row between"><div class="stack" style="gap:2px"><b style="color:var(--bright)">' + esc(x.label) + '</b><span class="small">Shows on ' + esc(x.also) + '.</span></div>' +
          '<button type="button" class="' + (open ? "linklike small" : "soft slim") + '" data-act="files-assign" data-key="' + (open ? "" : esc(x.key)) + '">' + (open ? "Cancel" : "Choose a photo") + '</button></div>' +
          (open ? '<div class="picgrid">' + (fd.files.length ? fd.files.map(function (f) { return '<button type="button" class="pictile' + (f.name === fd.pick ? " on" : "") + '" data-act="files-pick" data-name="' + esc(f.name) + '" title="' + esc(f.alt || f.name) + '"><img src="' + esc(fileSrc(fd, f.name)) + '" alt="" loading="lazy"><span>' + esc(f.alt || f.name) + '</span></button>'; }).join("") : '<span class="small">Upload a photo above first.</span>') + '</div>' +
            (chosen ? '<form class="stack" data-form="fassign" data-key="' + esc(x.key) + '" data-name="' + esc(chosen.name) + '"><div class="field"><label for="fa-alt">Describe the picture</label><input type="text" id="fa-alt" name="alt" maxlength="240" value="' + esc(chosen.alt) + '"><span class="small">Read aloud to people who cannot see it.</span></div>' +
              '<div class="row"><button type="submit" class="btn slim"' + (state.status === "saving" ? " disabled" : "") + '>Put it here</button></div></form>' : "") : "") +
          '</div>';
      }).join("") + '</div></div>';
    }).join("");
  }
  function filesWrite(what, payload, done, say) {
    var s = site(); if (!s) return;
    onLive(function () {
      change(key("files", s.id, payload.op, payload.name || ""), function () { return api("saveFiles", Object.assign({ site: s.id }, payload)); }, done, say);
    }, what);
  }
  async function filesSend() {
    var s = site(); if (!s || !state.fileAdd.length) return;
    var batch = state.fileAdd.slice(), n = batch.length;
    onLive(function () {
      change(key("files", s.id, "add"), async function () {
        for (var i = 0; i < batch.length; i++) {
          var p = batch[i], img = await prepareImage(p.file);
          await api("saveFiles", { site: s.id, op: "add", fileName: p.file.name, ext: img.ext, content: img.content, alt: p.alt.trim(), caption: p.caption.trim() });
          state.fileAdd = state.fileAdd.filter(function (q) { return q !== p; }); URL.revokeObjectURL(p.url);
        }
      }, null, n === 1 ? "Photo added" : n + " photos added");
    }, n === 1 ? "Adding this photo" : "Adding these " + n + " photos");
  }
  async function filesReplace(t) {
    var s = site(), fd = filesOf(), file = t.files && t.files[0], name = t.dataset.name; if (!s || !fd || !file) return;
    if (!/^image\/(jpeg|png)$/.test(file.type)) { state.notice = { text: "Please choose a JPG or PNG photo.", problem: true }; render(); return; }
    try {
      var img = await prepareImage(file, /\.png$/i.test(name) ? "png" : "jpg"), x = fd.files.find(function (f) { return f.name === name; }), where = x ? x.used.length : 0;
      filesWrite("Replacing " + name + (where ? ", in all " + where + (where === 1 ? " place" : " places") + " it is used," : ""), { op: "replace", name: name, ext: img.ext, content: img.content },
        function () { state.fileBust[name] = Date.now(); }, "Photo replaced everywhere");
    } catch (e) { state.notice = { text: e.message, problem: true }; render(); }
  }
  function filesGoto(el) {
    var s = site(); if (!s) return;
    state.edPrefs[s.id] = Object.assign({}, state.edPrefs[s.id] || {}, { page: el.dataset.page || "home", sel: { where: el.dataset.where === "shared" || isGroup(el.dataset.where) ? el.dataset.where : "page", id: el.dataset.id, block: null } });
    var pgd = state.pg[s.id]; if (pgd) { pgd.page = state.edPrefs[s.id].page; pgd.sel = state.edPrefs[s.id].sel; pgd.scrollNext = true; }
    go("pages");
  }

  // ----- history -----

  function viewHistory() {
    var s = site(); if (!s) return "";
    var list = state.history[s.id];
    if (!list) return head("History", "Reading the history of " + s.name + ".");
    var rows = list.map(function (h) {
      var k = key("undo", s.id, h.sha), action = "";
      if (state.confirm === k) action = '<div class="stack" style="gap:8px;flex:1 1 100%"><span class="muted">This puts that part of the site back to how it was just before this change. Later changes to the same content are undone too.</span>' +
        '<div class="row"><button type="button" class="btn" data-act="undo" data-sha="' + esc(h.sha) + '"' + (state.busy[k] ? " disabled" : "") + '>Yes, undo it</button><button type="button" class="soft" data-act="cancel">Leave it</button></div></div>';
      else if (h.canUndo) action = '<button type="button" class="soft" data-act="ask" data-k="' + esc(k) + '">Undo</button>';
      return '<div class="card entry"><span aria-hidden="true" style="flex:none;width:10px;height:10px;border-radius:50%;background:' + (h.canUndo ? "var(--accent)" : "#D9D3E2") + '"></span>' +
        '<div class="body"><b style="font-size:16px">' + esc(h.what) + '</b><span class="small">' + esc(when(h.when)) + (h.by ? ", by " + esc(h.by) : "") + '</span></div>' + action + '</div>';
    }).join("");
    return head("History", "Every change to this site, newest first. Changes made in this console can be undone.") +
      '<div class="stack">' + (rows || '<p class="notice">No changes yet.</p>') + '</div>';
  }

  function viewCopies() {
    var s = site(), list = copiesOf(s), cur = curCopy(), trials = list.filter(function (c) { return c.kind === "trial"; });
    function card(c) {
      var live = c.kind === "live", on = c.id === cur.id, tone = s ? colours(s.id) : ["#EDE8F3", "#5D5866"];
      var lines = [];
      if (live) lines.push("Saves here go straight to visitors. " + (c.steps && c.steps.length ? c.steps.length + (c.steps.length === 1 ? " recent step" : " recent steps") + " can be undone." : "Nothing to undo."));
      else {
        lines.push(c.ahead ? c.ahead + (c.ahead === 1 ? " change" : " changes") + " saved on this copy" : "Same as the live site");
        if (c.behind) lines.push("The live site has changed since this copy was made");
      }
      var acts = (on ? '<span class="chip">You are working on this</span>' : '<button type="button" class="btn slim" data-act="work-on" data-copy="' + esc(live ? "" : c.id) + '">Work on this</button>') +
        (c.preview ? '<a class="linklike small" href="' + esc(c.preview) + '" target="_blank" rel="noopener">Open the preview</a>' : "") +
        (!live && c.ahead ? '<button type="button" class="soft slim" data-act="ask-big" data-kind="makelive" data-copy="' + esc(c.id) + '">Make this the live site</button>' : "") +
        (!live && c.behind ? '<button type="button" class="linklike small" data-act="refresh-copy" data-copy="' + esc(c.id) + '">Refresh from live</button>' : "") +
        (!live ? '<button type="button" class="linklike small" data-act="ask-big" data-kind="deletecopy" data-copy="' + esc(c.id) + '">Delete</button>' : "");
      return '<div class="card copycard' + (on ? " on" : "") + '"><div class="copytop" style="background:' + (live ? tone[0] : "#1E1F22") + ';color:' + (live ? tone[1] : "#F2B33D") + '"><span>' + (live ? "Live site" : "Trial copy") + '</span></div>' +
        '<div class="stack copybody"><b class="copyname">' + esc(live ? "What visitors see" : c.name) + '</b>' +
        '<span class="small">' + esc(live ? (s ? s.domain : "") : (c.since ? "Copied from live on " + when(c.since).split(",")[0] : "A copy of the live site")) + '</span>' +
        lines.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join("") + '<div class="row">' + acts + '</div></div></div>';
    }
    var maker = trials.length < 2
      ? '<form class="card stack copycard maker" data-form="copy"><h2 class="cardh">Make a trial copy</h2><span class="small">A full copy of the live site to try new content, colours and photos on. Visitors never see it.</span>' +
        '<input type="text" id="copy-name" data-input="copy-name" maxlength="30" value="' + esc(state.copyName || "") + '" placeholder="A name, for example Winter look" aria-label="Name for the trial copy"><button type="submit" class="soft" style="align-self:flex-start"' + (state.busy.copy ? " disabled" : "") + '>Make the copy</button></form>'
      : '<div class="card stack copycard maker"><h2 class="cardh">Two trial copies</h2><span class="small">That is the most a site can have. Delete one to make another.</span></div>';
    var steps = cur.steps && cur.steps.length
      ? '<div class="card stack" style="max-width:820px"><h2 class="cardh">Recent steps on ' + esc(cur.kind === "live" ? "the live site" : "the trial copy " + cur.name) + '</h2>' +
        (cur.kind === "live" ? '<span class="small">Undoing a step here changes the live site straight away.</span>' : "") +
        cur.steps.map(function (st, i) { return '<div class="row between steprow"><div class="body"><span>' + esc(st.what) + '</span><span class="small">' + esc(when(st.when)) + (st.by ? ", by " + esc(st.by) : "") + '</span></div><button type="button" class="linklike small" data-act="undo-step" data-steps="' + (i + 1) + '">' + (i ? "Undo back to before this" : "Undo this") + '</button></div>'; }).join("") + '</div>'
      : "";
    return '<h2 class="cardh" style="margin:34px 0 14px">Live site and trial copies</h2><div class="copies" style="margin-top:0">' + list.map(card).join("") + maker + '</div>' +
      '<p class="small" style="margin:14px 0 26px">A preview is ready about two minutes after a change. Anyone with the link can open it, so keep confidential work out of trial copies.</p>' + steps;
  }

  // ----- sign in -----

  // ---------- Versions: every publish is a numbered version with release notes ----------
  var VERSIONS_SHOWN = 10;
  // A version is called by its title, or else its first change, so the list reads at a glance.
  function versionTitle(x) {
    if (x.title) return x.title;
    if (x.number === "1.0") return "Where versions began";
    var steps = String(x.notes || "").split("\n").filter(function (l) { return /^- /.test(l); }).map(function (l) { return l.slice(2); });
    return steps.length ? steps[0] + (steps.length > 1 ? ", and " + (steps.length - 1) + " more" : "") : "Published";
  }
  function viewVersions() {
    var s = site(), v = s && state.versions[s.id];
    var head = '<div class="page-head"><h1>Versions</h1><p>Every publish is a version, with notes on what changed. Each one adds to the second number, and a big change starts a new first number. The latest ' + VERSIONS_SHOWN + ' are shown; older ones are archived, never deleted.</p></div>';
    if (!v) return head + '<p class="loading">Reading the versions</p>';
    if (!v.list.length) return head + '<div class="card stack"><b>No versions yet</b><span class="small">The first publish makes version 1.0, the site as it was, and 1.1, the publish itself.</span></div>';
    var row = function (x, archived) {
      var open = v.open === x.number;
      return '<div class="card vrow' + (archived ? " old" : "") + '"><div class="vtop"><span class="vnum">' + esc(x.number) + '</span>' +
        '<span class="vbody"><b>' + esc(versionTitle(x)) + '</b><span class="small">' + esc((x.by ? "By " + x.by + ", " : "") + (when(x.when) || "")) + '</span></span>' +
        '<span class="row vacts">' + (x.live ? '<span class="chip live">Live now</span>' : "") + (x.big && x.number !== "1.0" ? '<span class="chip">Big change</span>' : "") +
          '<button type="button" class="linklike small" data-act="v-notes" data-v="' + esc(x.number) + '" aria-expanded="' + (open ? "true" : "false") + '">' + (open ? "Hide the notes" : "Release notes") + '</button>' +
          (v.canGoBack && !x.live ? '<button type="button" class="soft slim" data-act="ask-goback" data-v="' + esc(x.number) + '">Go back to this version</button>' : "") + '</span></div>' +
        (open ? '<pre class="vnotes">' + esc(x.notes) + '</pre>' : "") + '</div>';
    };
    var shown = v.list.slice(0, VERSIONS_SHOWN), old = v.list.slice(VERSIONS_SHOWN);
    return head + '<div class="stack versions">' + shown.map(function (x) { return row(x, false); }).join("") +
      (old.length ? '<button type="button" class="linklike" data-act="v-archive" aria-expanded="' + (v.archive ? "true" : "false") + '">' + (v.archive ? "Hide archived versions" : "Show archived versions (" + old.length + ")") + '</button>' +
        (v.archive ? old.map(function (x) { return row(x, true); }).join("") : "") : "") + '</div>' +
      (v.canGoBack ? '<p class="small" style="margin-top:14px">Going back makes a new version, so it can be undone the same way. Editors see this list without the Go back buttons.</p>' : "");
  }
  // New versions published by someone else, shown to the admin at the top of All sites until marked as seen.
  function seenOf() { try { return JSON.parse(localStorage.getItem("adh-seen") || "{}"); } catch (e) { return {}; } }
  function markSeen(id, number) { var m = seenOf(); m[id] = number; try { localStorage.setItem("adh-seen", JSON.stringify(m)); } catch (e) { /* only a convenience */ } }
  function newVersions() {
    if (!isAdmin()) return [];
    var seen = seenOf(), out = [];
    liveSites().forEach(function (x) {
      var top = (x.versions || [])[0];
      if (top && top.by && top.by !== "You" && seen[x.id] !== top.number && top.number !== "1.0") out.push({ site: x, v: top });
    });
    return out;
  }
  function viewNewVersions() {
    var list = newVersions(); if (!list.length) return "";
    return '<div class="stack" style="margin-bottom:22px">' + list.map(function (n) {
      return '<div class="card stack newv"><div class="row between"><b class="cardh">' + esc(n.site.name + " " + n.v.number) + '</b><span class="chip live">Live</span></div>' +
        '<span class="small">Published by ' + esc(n.v.by) + (when(n.v.when) ? ", " + esc(when(n.v.when)) : "") + '. GitHub also emails these notes to anyone watching the site\'s releases.</span>' +
        '<pre class="vnotes">' + esc(n.v.notes) + '</pre>' +
        '<div class="row"><button type="button" class="btn slim" data-act="v-seen" data-site="' + esc(n.site.id) + '" data-v="' + esc(n.v.number) + '">Seen</button>' +
        '<a class="linklike small" href="https://' + esc(n.site.domain) + '/" target="_blank" rel="noopener">Look at the live site</a>' +
        '<button type="button" class="linklike small" data-act="v-open" data-site="' + esc(n.site.id) + '">All versions</button></div></div>';
    }).join("") + '</div>';
  }

  // ---------- People: you are the admin, everyone else is an editor ----------
  function peopleOf() { return state.people || (state.people = { list: null, sites: [], sel: "", mode: "", ask: "", note: "", busy: false }); }
  async function loadPeople() {
    var pp = peopleOf();
    try {
      var d = await api("people");
      pp.list = d.people || []; pp.sites = d.sites || [];
      if (!pp.mode && !pp.sel) pp.sel = pp.list.length ? pp.list[0].email : "admin";
      if (pp.sel !== "admin" && !pp.list.some(function (x) { return x.email === pp.sel; })) pp.sel = pp.list.length ? pp.list[0].email : "admin";
    } catch (e) { pp.list = pp.list || []; state.notice = { text: e.message, problem: true }; }
    if (state.tab === "people") render();
  }
  function personSub(x) {
    if (!x.lastSeen) return "Invited " + (when(x.invited) ? "on " + when(x.invited).split(",")[0] + ", " : "") + "not signed in yet";
    return "Last signed in on " + when(x.lastSeen);
  }
  function siteNames(pp, ids) {
    var n = (ids || []).map(function (id) { var x = pp.sites.find(function (y) { return y.id === id; }); return x ? x.name : ""; }).filter(Boolean);
    return n.length ? n.join(", ") : "No sites yet";
  }
  function siteChecks(pp, chosen) {
    return '<fieldset class="pfs"><legend>Sites they can work on</legend>' + pp.sites.map(function (x) {
      return '<label class="chk pchk"><input type="checkbox" name="site" value="' + esc(x.id) + '"' + ((chosen || []).indexOf(x.id) >= 0 ? " checked" : "") + '><span>' + esc(x.name) + '</span>' + (x.live ? "" : '<span class="small">Not built yet</span>') + '</label>';
    }).join("") + '</fieldset>';
  }
  function viewPeople() {
    var pp = peopleOf(), busy = pp.busy ? " disabled" : "";
    if (!pp.list) return '<div class="page-head"><h1>People</h1></div><p class="loading">Reading the list of people</p>';
    var row = function (key, initial, name, sub, sitesText, how, chip, on) {
      return '<button type="button" class="card prow' + (on ? " on" : "") + '" data-act="people-pick" data-email="' + esc(key) + '"' + (on ? ' aria-current="true"' : "") + '>' +
        '<span class="pav" aria-hidden="true">' + esc(initial) + '</span>' +
        '<span class="pmain"><b>' + esc(name) + '</b><span class="small">' + esc(sub) + '</span></span>' +
        '<span class="pmeta"><span>' + esc(sitesText) + '</span><span class="small">' + esc(how) + '</span></span>' +
        '<span class="chip' + (chip === "Admin" ? "" : " quiet") + '">' + esc(chip) + '</span></button>';
    };
    var me = demo ? "Sample admin" : (state.email || "You");
    var rows = row("admin", "Y", "You", me, "Every site", "Live site and copies", "Admin", !pp.mode && pp.sel === "admin") +
      pp.list.map(function (x) {
        var invited = !x.lastSeen;
        return row(x.email, invited ? "@" : (x.name || x.email).charAt(0).toUpperCase(), x.name || x.email, personSub(x), siteNames(pp, x.sites),
          invited ? "Their own copy, once they sign in" : "Their own copy, and can publish it", invited ? "Editor, invited" : "Editor", !pp.mode && pp.sel === x.email);
      }).join("") +
      (pp.list.length ? "" : '<p class="small" style="margin:4px">No editors yet. Invite someone to give them their own copy of a site.</p>');
    var panel;
    if (pp.mode === "invite") {
      var dr = pp.draft || { email: "", name: "", sites: [] };
      panel = '<form class="stack-wide" data-form="invite"><div class="stack" style="gap:2px"><h2 class="cardh">Invite an editor</h2><span class="small">They get the same sign-in email you use. Nothing else is sent.</span></div>' +
        '<div class="field"><label class="label" for="pi-email">Their email</label><input id="pi-email" name="email" type="email" autocomplete="off" required value="' + esc(dr.email) + '"></div>' +
        '<div class="field"><label class="label" for="pi-name">Their name</label><input id="pi-name" name="name" type="text" autocomplete="off" maxlength="60" value="' + esc(dr.name) + '"><span class="small">Shown on their changes and in History. Optional.</span></div>' +
        siteChecks(pp, dr.sites) +
        '<p class="small">They get their own copy of each site you tick, and can publish it. They never work on the live site itself.</p>' +
        '<div class="row"><button type="submit" class="btn"' + busy + '>Send the sign-in email</button><button type="button" class="linklike" data-act="people-close">Close</button></div></form>';
    } else if (pp.sel === "admin") {
      panel = '<div class="stack-wide"><h2 class="cardh">You, the admin</h2><p class="pnote">You can do everything, on every site: work on the live site and on copies, publish, answer the website agents and manage people. The admin is set outside the console, so you can never lock yourself out.</p></div>';
    } else {
      var x = pp.list.find(function (y) { return y.email === pp.sel; });
      if (!x) panel = '<p class="small">Choose someone on the left.</p>';
      else {
        var first = String(x.name || "this editor").split(" ")[0];
        panel = '<form class="stack-wide" data-form="person" data-email="' + esc(x.email) + '"><div class="stack" style="gap:2px"><h2 class="cardh">' + esc(x.name || x.email) + '</h2><span class="small">' + esc(x.email) + '</span></div>' +
          '<div class="field"><label class="label" for="pp-name">Name</label><input id="pp-name" name="name" type="text" maxlength="60" value="' + esc(x.name || "") + '"></div>' +
          siteChecks(pp, x.sites) +
          '<p class="pnote">' + esc(first.charAt(0).toUpperCase() + first.slice(1)) + ' works on their own copy of each site and can publish it. Only you work on the live site.</p>' +
          (!x.lastSeen ? '<div class="row"><button type="button" class="linklike" data-act="people-resend" data-email="' + esc(x.email) + '"' + busy + '>Send the sign-in email again</button></div>' : "") +
          (pp.ask === x.email ? '<div class="pask"><span>Remove ' + esc(x.name || x.email) + '? They will not be able to sign in from their next click. Their copies and everything they saved stay.</span>' +
            '<div class="row"><button type="button" class="btn danger" data-act="people-remove-yes" data-email="' + esc(x.email) + '"' + busy + '>Remove</button><button type="button" class="soft" data-act="people-remove-no">Keep</button></div></div>' : "") +
          '<div class="row between"><button type="submit" class="btn key"' + busy + '>Save changes</button><button type="button" class="linklike danger" data-act="people-remove" data-email="' + esc(x.email) + '">Remove access</button></div></form>';
      }
    }
    return '<div class="page-head"><h1>People</h1><p>You are the admin. Everyone else is an editor: they work on their own copy of the sites you choose, and can publish it. A change here works from their next click.</p>' +
      '<div class="row"><button type="button" class="btn" data-act="people-invite">Invite an editor</button></div></div>' +
      (pp.note ? '<p class="notice" role="status">' + esc(pp.note) + '</p>' : "") +
      '<div class="people"><div class="plist">' + rows + '</div><aside class="card ppanel" aria-label="Settings">' + panel + '</aside></div>';
  }
  async function peopleDo(action, payload, note, after) {
    var pp = peopleOf(); if (pp.busy) return;
    pp.busy = true; pp.note = ""; state.notice = null; render();
    try {
      var d = await api(action, payload);
      pp.note = typeof note === "function" ? note(d) : note;
      if (after) after(d);
    } catch (e) { state.notice = { text: e.message, problem: true }; }
    pp.busy = false;
    await loadPeople();
  }
  // On a phone the settings sit under the list, so bring them into view.
  function peopleShowPanel() { var pn = app.querySelector && app.querySelector(".ppanel"); if (pn && window.innerWidth < 900 && pn.scrollIntoView) pn.scrollIntoView({ block: "start" }); }
  function formSites(form) { return Array.prototype.map.call(form.querySelectorAll('input[name="site"]:checked'), function (i) { return i.value; }); }

  function signinBack() { return window.location.origin + window.location.pathname; }
  function viewSignin() {
    var pw = state.signinMode === "password", body;
    if (state.signinSent) {
      body = '<p class="notice">Check your inbox. The sign-in link has been sent to ' + esc(state.email) + '.</p>' +
        '<button type="button" class="linklike" data-act="signin-mode" data-mode="password">Use a password instead</button>';
    } else {
      body = '<p class="muted">' + (pw ? "Enter your work email and password." : "Enter your work email and we will send you a sign-in link. No password needed.") + '</p>' +
        '<div class="field"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" required value="' + esc(state.email) + '"></div>' +
        (pw ? '<div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>' : "") +
        '<div><button class="btn" type="submit"' + (state.busy.signin ? " disabled" : "") + '>' + (pw ? "Sign in" : "Send me a sign-in link") + '</button></div>' +
        '<button type="button" class="linklike" data-act="signin-mode" data-mode="' + (pw ? "link" : "password") + '">' + (pw ? "Email me a sign-in link instead" : "Use a password instead") + '</button>';
    }
    return '<div class="signin"><form class="card" data-form="signin"><span class="brand-mark" aria-hidden="true">' + mark() + '</span>' +
      '<h1>Artiscope<br>Digital Home</h1>' + body +
      (state.notice ? '<p class="notice problem">' + esc(state.notice.text) + '</p>' : "") +
      '<span class="small">Version ' + VERSION + '</span></form></div>';
  }

  function signinProblem(error, usedPassword) {
    var code = String(error.code || ""), status = Number(error.status || 0), msg = String(error.message || "");
    if (status === 429 || /rate|limit|seconds/i.test(code + " " + msg)) return "Too many sign-in emails were requested. Supabase only sends a few each hour. Wait a while, or use a password instead.";
    if (usedPassword) return "That email and password do not match. Check them and try again.";
    if (/invalid|valid email/i.test(code + " " + msg)) return "That does not look like an email address. Check it and try again.";
    if (/signup|not allowed|disabled/i.test(code + " " + msg)) return "This email address is not set up for sign-in yet.";
    return "The link could not be sent" + (msg ? " (" + msg + ")." : ".") + " Please try again in a few minutes.";
  }

  function render() {
    snapshot();
    if (!demo && !state.session) { app.innerHTML = viewSignin(); return; }
    if (!state.data) {
      app.innerHTML = state.notice
        ? '<div class="signin"><div class="card"><p class="notice problem">' + esc(state.notice.text) + '</p><div class="row"><button type="button" class="soft" data-act="refresh">Try again</button>' + (demo ? "" : '<button type="button" class="linklike" data-act="signout">Sign out</button>') + '</div><span class="small">Version ' + VERSION + '</span></div></div>'
        : '<p class="loading">Reading your sites</p>';
      return;
    }
    var views = { home: viewHome, overview: viewOverview, content: viewContent, theme: viewTheme, photos: viewPhotos, files: viewFiles, history: viewHistory, people: viewPeople, versions: viewVersions };
    var s = site(), unbuilt = state.inSite && !s && state.site;
    if (state.inSite && s && state.tab === "pages") { app.innerHTML = viewPagesEditor(s); mountRich(); mountPages(); return; }
    var inner = unbuilt ? viewUnbuilt(sites().find(function (x) { return x.id === state.site; }) || { name: "Site" }) : (views[state.inSite ? state.tab : (state.tab === "people" && isAdmin() ? "people" : "home")] || viewHome)();
    app.innerHTML = viewShell(inner);
    mountRich(); mountTheme(); filterList();
    settle();
  }

  // ---------- doing things ----------

  function openEntry() { var s = site(), cols = s && state.content[s.id]; if (!cols || !state.open) return null; var col = cols[state.open.ci]; return col ? { s: s, col: col, e: col.entries[state.open.ei] } : null; }
  function entryChange(action, extra) {
    var o = openEntry(); if (!o || !o.e) return;
    var k = key("entry", o.s.id, o.col.id, o.e.id);
    change(k, function () { return api(action, Object.assign({ site: o.s.id, collection: o.col.id, id: o.e.id }, extra(o))); }, function () { state.open = null; state.draft = null; state.dirty = false; state.leave = null; delete state.content[o.s.id]; });
  }
  function saveEntry(form) {
    var values = collect(form);
    onLive(function () { entryChange("saveEntry", function () { return { values: values }; }); }, "This edit");
  }
  function takePhoto(slot) {
    var s = site(); if (!s) return;
    change(key("photo", s.id, slot), function () { return api("removePhoto", { site: s.id, slot: slot }); }, function () {
      var x = (s.slots || []).find(function (y) { return y.id === slot; }); if (x) x.filled = false;
    });
  }
  function undo(sha) {
    var s = site(); if (!s) return;
    change(key("undo", s.id, sha), function () { return api("undo", { site: s.id, sha: sha }); }, function () { delete state.content[s.id]; });
  }
  // Shrinks a photo in the browser so uploads stay quick. The sites ask for 2000 pixels at most on the longest side, and about 400 KB.
  // Shrinks a photo in the browser so uploads stay quick.
  function prepareImage(file, as) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 2000, scale = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var png = as ? as === "png" : file.type === "image/png", dataUrl = c.toDataURL(png ? "image/png" : "image/jpeg", 0.9);
        resolve({ content: dataUrl.slice(dataUrl.indexOf(",") + 1), ext: png ? "png" : "jpg" });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That file could not be read as a photo.")); };
      img.src = url;
    });
  }

  async function sendPhotos() {
    var s = site(); if (!s || !state.photoFiles.length) return;
    state.busy.photo = true; state.status = "saving"; state.notice = null; render();
    var sent = 0, left = [];
    for (var i = 0; i < state.photoFiles.length; i++) {
      var p = state.photoFiles[i];
      try {
        var img = await prepareImage(p.file);
        var payload = { site: s.id, ext: img.ext, content: img.content, alt: p.alt.trim(), caption: p.caption.trim() };
        if (p.slot === "other") payload.description = p.note.trim(); else payload.slot = p.slot;
        var res = await api("uploadPhoto", payload);
        if (p.slot !== "other") { state.photoSent[key(s.id, p.slot)] = true; var x = (s.slots || []).find(function (y) { return y.id === p.slot; }); if (x) x.waiting = true; }
        state.photoDone.push({ site: s.name, name: res.name });
        sent++;
      } catch (e) { p.status = e.message; left.push(p); }
    }
    state.photoFiles = left; delete state.busy.photo;
    state.status = sent ? "saved" : "live"; state.flash = sent ? (curCopy().kind === "trial" ? "Saved on this copy" : "Saved. Live in about two minutes") : "";
    if (sent) { try { await refreshCopies(); } catch (e3) { /* shown on the next refresh */ } }
    state.notice = left.length
      ? { text: sent + " sent. " + left.length + " could not be sent, see below.", problem: true }
      : { text: (sent === 1 ? "Photo sent." : sent + " photos sent.") + (curCopy().kind === "trial" ? " It is placed on this copy within a few minutes." : " It is placed on the site within a few minutes.") + " Press Refresh to see it marked as in place." };
    render();
  }

  function openSite(id) {
    var x = sites().find(function (y) { return y.id === id; }); if (!x) return;
    if (!isAdmin() && x.live && !myCopy(x)) {
      state.status = "saving"; state.flash = ""; render();
      api("makeCopy", { site: id, copy: "" }).then(refreshCopies).then(function () { state.status = "live"; if (myCopy(x) || myCopy(sites().find(function (y) { return y.id === id; }))) openSite(id); else { state.notice = { text: "Your copy could not be made just now. Please try again.", problem: true }; render(); } },
        function (e) { state.status = "live"; state.notice = { text: e.message, problem: true }; render(); });
      return;
    }
    state.flash = ""; state.ask = null; state.site = id; state.inSite = true; state.photoFiles = []; state.prevCtab = 0;
    var back = state.place[id]; if (back && !hasScreen(x, back)) back = "";
    go(x.live ? (back || firstTab(x)) : "overview");
  }
  function go(tab) {
    if (tab === "home" || tab === "people") { state.inSite = false; }
    else if (site()) state.place[site().id] = tab;
    state.prevTab = state.tab; state.tab = tab; state.open = null; state.draft = null; state.dirty = false; state.leave = null; state.confirm = null; state.notice = null;
    state.csearch = ""; state.cmore = false; state.edMenu = "";
    if (tab !== "pages") edAddress(); else if (site() && pgOf()) edAddress(site(), pgOf());
    if (state.status === "saved") state.status = "live";
    state.flash = ""; state.ask = null;
    render(); ensure();
    if (typeof window.scrollTo === "function") window.scrollTo(0, 0);
  }

  // Formatting buttons must not take the cursor out of the text.
  app.addEventListener("mousedown", function (ev) {
    var b = ev.target.closest && ev.target.closest(".rt-b"); if (b) ev.preventDefault();
  });
  app.addEventListener("keydown", function (ev) {
    var t = ev.target;
    if (ev.key === "Enter" && t.closest && t.closest(".rt-link")) { ev.preventDefault(); var add = t.closest(".rt-link").querySelector('[data-rt="link-add"]'); if (add) richCmd(add); }
  });
  // Pasting brings in the words only, never the styling of where they came from.
  app.addEventListener("paste", function (ev) {
    var ed = ev.target.closest && ev.target.closest("[data-rich]"); if (!ed) return;
    ev.preventDefault();
    var text = (ev.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
    state.dirty = true;
    if (rich[ed.dataset.rich]) rich[ed.dataset.rich].dirty = true;
  });

  // ----- making a page, an article, an artist or a source -----
  function slugFrom(t) { return String(t || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50); }
  function freeSlug(base, taken) { base = base || "new"; var n = 2, out = base; while (taken.indexOf(out) >= 0) out = base + "-" + (n++); return out; }
  var RESERVED_PAGES = ["home", "artists", "reviews", "explained", "library", "guides", "standards", "research", "search", "assets", "data", "tools", "inbox", "preview", "auction-results", "market-intelligence", "collecting-valuation", "about", "contact", "dispatches", "urban-culture", "interventions", "exhibitions", "collecting", "images"];
  function makeNew(form) {
    var pgd = pgOf(); if (!pgd) return;
    var val = function (n) { var x = form.querySelector('[name="' + n + '"]'); return x ? (x.type === "checkbox" ? x.checked : x.value.trim()) : ""; };
    var w = form.dataset.what, say = function (t) { state.notice = { text: t, problem: true }; edPatch(); };
    state.notice = null;
    if (w === "page") {
      var title = val("title"); if (!title) return say("Please give the page a title.");
      var key = freeSlug(slugFrom(title) || "page", Object.keys(pgd.doc.pages).concat(RESERVED_PAGES));
      if (pgd.model === "sad") {
        var tp = JSON.parse(JSON.stringify((pgd.kinds["text-page"] && pgd.kinds["text-page"].starter) || {})); tp.heading = title;
        pgd.doc.pages[key] = { path: key + "/index.html", title: title + " | Street Art Dispatch", description: "", current: "", intro: false, sections: [{ id: "text", type: "text-page", visible: true, settings: tp }] };
      } else if (pgd.gam) {
        var head = JSON.parse(JSON.stringify((pgd.kinds["page-head"] && pgd.kinds["page-head"].starter) || {})); head.eyebrow = title; head.headline = title;
        pgd.doc.pages[key] = { path: key + "/index.html", title: title + " | Global Art Monitor", description: "", current: "", intro: false, sections: [{ id: "head", type: "page-head", visible: true, settings: head }] };
      } else {
        var starter = JSON.parse(JSON.stringify((pgd.kinds.text && pgd.kinds.text.starter) || {})); starter.heading = [title];
        pgd.doc.pages[key] = { title: title, sections: [{ id: "text-1", type: "text", visible: true, settings: starter }] };
      }
      if (val("own")) pgd.doc.pages[key].own = true;
      if (val("menu")) menuLinks(pgd).push([title, menuHref(pgd, key)]);
      pgd.what = "Add page: " + title; pgMark(pgd); navTo("page-" + key); return;
    }
    if (!pgd.site) return;
    if (w === "article" && pgd.gam) {
      var gt = val("title"); if (!gt) return say("Please give the article a title.");
      var gs = freeSlug(slugFrom(gt) || "article", pgd.site.articles.map(function (x) { return x.slug; }));
      if (pgd.model === "sad") pgd.site.articles.push({ slug: gs, section: "dispatches", kicker: "", title: gt, standfirst: "", tags: [], body: "<p>Write here.</p>", hidden: true });
      else pgd.site.articles.push({ slug: gs, title: gt, kicker: "Research", tags: ["research"], mins: 5, standfirst: "", body: "<p>Write here.</p>", description: "", hidden: true });
      pgd.what = "Add article: " + gt; pgMark(pgd); navTo("a-" + gs); pickSection("words", null, false, "item"); return;
    }
    if (w === "artist" && pgd.gam) {
      var gn = val("name"); if (!gn) return say("Please give the artist's name.");
      var ga = freeSlug(slugFrom(gn) || "artist", pgd.site.artists.map(function (x) { return x.slug; }));
      if (pgd.model === "sad") pgd.site.artists.push({ slug: ga, name: gn, role: "", cover: "", read: null, summary: "", facts: [], note: "" });
      else pgd.site.artists.push({ slug: ga, name: gn, line: "", houses: [], summary: "", body: [], sources: [], image: "", alt: "", caption: "", sales: [] });
      pgd.artists.push({ slug: ga, name: gn });
      pgd.what = "Add artist: " + gn; pgMark(pgd); navTo("artist-" + ga); pickSection("words", null, false, "item"); return;
    }
    if (w === "article") {
      var at = val("title"); if (!at) return say("Please give the article a title.");
      var slug = freeSlug(slugFrom(at) || "article", pgd.site.articles.map(function (x) { return x.slug; }));
      pgd.site.articles.push({ slug: slug, section: val("section") || "explained", kicker: "", artists: [], tone: "#D3C5AA", title: at, dek: "", credit: "", minutes: 5, updated: new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }), status: "Draft for review", sources: [], body: "<p>Write here.</p>", hidden: true, image: null, alt: "" });
      pgd.pictures["article:" + slug] = { key: "article:" + slug, kind: "article", label: at, group: "Articles", also: "the article and its card in every list", image: "", alt: "", credit: "", hasCredit: true, hidden: true, section: val("section") };
      pgd.what = "Add article: " + at; pgMark(pgd); navTo("a-" + slug); pickSection("words", null, false, "item"); return;
    }
    if (w === "artist") {
      var name = val("name"); if (!name) return say("Please give the artist's name.");
      var aslug = freeSlug(slugFrom(name) || "artist", pgd.site.artists.map(function (x) { return x.slug; }));
      pgd.site.artists.push({ slug: aslug, name: name, letter: name.charAt(0).toUpperCase(), published: false, image: null, alt: "", ghostWords: [name, "", "", ""], tag: "", place: "", tone: "#D3C5AA", heroTone: "#D9CCB4", summary: "", dek: "", heroCredit: "", checked: "", glance: [], sections: [], works: [], timeline: [], seen: "", related: [], research: ["Biography and background"] });
      pgd.pictures["artist:" + aslug] = { key: "artist:" + aslug, kind: "artist", label: name, group: "Artists", also: name + "'s portfolio and the home page", image: "", alt: "", credit: "", hasCredit: true, published: false };
      pgd.artists.push({ slug: aslug, name: name });
      pgd.what = "Add artist: " + name; pgMark(pgd); navTo("artist-" + aslug); pickSection("words", null, false, "item"); return;
    }
    if (w === "source") {
      var st = val("title"), url = val("url"); if (!st) return say("Please give the source a title.");
      if (url && !/^https?:\/\//i.test(url)) return say("The link must start with https://");
      var id = freeSlug(slugFrom((val("pub") + " " + st).split(" ").slice(0, 5).join(" ")).slice(0, 40) || "source", Object.keys(pgd.site.sources));
      pgd.site.sources[id] = { title: st, pub: val("pub"), date: val("date"), kind: val("kind"), url: url };
      var cite = pgd.newCite; pgd.newCite = ""; pgd.panel = "";
      if (cite) { pgd.at = cite.at; pgd.page = cite.page; pgd.sel = cite.sel; var cs = pgSel(pgd); if (cs) { var l2 = pgGet(cs.sec.settings, cite.path); if (!Array.isArray(l2)) { l2 = []; pgSet(cs.sec.settings, cite.path, l2); } l2.push(id); } }
      else pgd.sel = { where: "source", id: id, block: null };
      pgd.what = "Add source: " + st; pgMark(pgd); edPatch(); pushPreview();
    }
  }

  // Moving between pages keeps unsaved changes: they belong to the whole site until Save.
  function guardless(fn) { fn(); }
  // Puts a numbered citation where the cursor was in the text being edited.
  var citeAt = null;
  if (typeof document.addEventListener === "function") document.addEventListener("selectionchange", function () {
    var sel = window.getSelection(); if (!sel || !sel.rangeCount) return;
    var node = sel.anchorNode, ed = node && (node.nodeType === 1 ? node : node.parentNode); ed = ed && ed.closest && ed.closest("[data-pf-rich]");
    if (ed) citeAt = { ed: ed, range: sel.getRangeAt(0).cloneRange() };
  });
  function citeHere(id) {
    if (!id) return;
    var c = citeAt;
    if (!c || !document.body.contains(c.ed)) { state.notice = { text: "Click in the text where the source belongs first, then choose it.", problem: true }; edPatch(); return; }
    c.ed.focus(); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(c.range); sel.collapseToEnd();
    document.execCommand("insertHTML", false, '<sup class="cite"><a data-src="' + esc(id) + '">[' + esc(id) + ']</a></sup>&#8203;');
  }

  // Asks before leaving an entry that has typing in it.
  function guard(next) {
    var pgd = pgOf();
    if ((state.open && state.dirty) || (state.tab === "pages" && pgd && pgd.dirty)) { state.leave = next; if (state.tab === "pages") edPatch(); else render(); if (typeof window.scrollTo === "function") window.scrollTo(0, 0); }
    else next();
  }
  function closeEntry() { var s = site(); state.open = null; state.draft = null; state.dirty = false; state.leave = null; state.confirm = null; state.prevCtab = s ? (state.ctab[s.id] || 0) : 0; render(); }

  app.addEventListener("click", function (ev) {
    var rt = ev.target.closest("[data-rt]"); if (rt && rt.dataset && rt.dataset.rt) { state.dirty = true; richCmd(rt); return; }
    var rnm = ev.target.closest && ev.target.closest("#ed-rename"); if (rnm && rnm.id === "ed-rename") return;
    if (state.ctx && !(ev.target.closest && ev.target.closest(".ctxm"))) { ctxClose(); return; }
    var el = ev.target.closest("[data-tab],[data-act]");
    if (state.edMenu) {
      var inPop = ev.target.closest(".ed-pop"), keep = el && (el.dataset.act === "ed-pop" || el.dataset.act === "ed-ppgroup");
      if (!keep && (!inPop || el)) { state.edMenu = ""; if (!el) { patchEdTop(); return; } if (!el.dataset.tab && ["ed-goto-item", "ed-copy", "ed-new", "ed-discard", "ed-save", "ed-save-publish", "ask-makelive", "refresh-copy"].indexOf(el.dataset.act) < 0) patchEdTop(); }
    }
    if (!el) return;
    if (el.dataset.tab) { var to = el.dataset.tab; guard(function () { go(to); }); return; }
    var a = el.dataset.act, s = site();
    if (a === "ed-pop") { var wm = el.dataset.menu; state.edMenu = state.edMenu === wm || (wm === "more" && (state.edMenu === "keys" || state.edMenu === "help") && !ev.target.closest(".ed-pop")) ? "" : wm; if (wm === "page") state.ppGroup = ""; patchEdTop(); if (state.edMenu === "page") { var q = app.querySelector("#pp-q"); if (q) q.focus(); } return; }
    if (a === "ed-ppgroup") { state.ppGroup = el.dataset.g || ""; patchEdTop(); var q2 = app.querySelector("#pp-q"); if (q2) q2.focus(); return; }
    if (a === "ed-goto-item") { var gh = el.dataset.hash; navTo(gh); return; }
    if (a === "ed-tpl-open") { tplOpenIt(el.dataset.kind, el.dataset.id); return; }
    if (a === "ed-tpl-new") { var pn2 = pgOf(); if (!pn2) return; var nk = el.dataset.kind; state.edMenu = ""; pn2.tplNew = { kind: nk, name: "", base: tplHere(pn2) === nk ? tplId(pn2) : "default" }; pn2.picker2 = null; pn2.lib = null; patchEdTop(); edPatch(); var nb = app.querySelector("#tpl-new-name"); if (nb) nb.focus(); return; }
    if (a === "ed-copy") { var cid = el.dataset.copy || ""; guard(function () { workOn(cid); }); return; }
    if (a === "ed-panel") { edPanel(el.dataset.panel); return; }
    if (a === "ed-inspector") { edInspector(); return; }
    if (a === "refresh") { state.content = {}; state.history = {}; if (state.people) state.people.list = null; load(); }
    else if (a === "v-notes") { var vs = state.versions[state.site]; if (vs) { vs.open = vs.open === el.dataset.v ? "" : el.dataset.v; render(); } }
    else if (a === "v-archive") { var va = state.versions[state.site]; if (va) { va.archive = !va.archive; render(); } }
    else if (a === "v-seen") { markSeen(el.dataset.site, el.dataset.v); render(); }
    else if (a === "v-open") { var vo = el.dataset.site; guard(function () { openSite(vo); go("versions"); }); }
    else if (a === "ask-resetpractice") { state.ask = { kind: "resetpractice" }; render(); if (typeof window.scrollTo === "function") window.scrollTo(0, 0); }
    else if (a === "resetpractice") { var rp = site(); if (rp) change(key("reset", rp.id), function () { return api("resetPractice", { site: rp.id }); }, null, "The Practice site starts again from World Art Review. Live in about two minutes"); }
    else if (a === "ask-goback") { state.ask = { kind: "goback", version: el.dataset.v }; render(); if (typeof window.scrollTo === "function") window.scrollTo(0, 0); }
    else if (a === "goback") {
      var gs = site(), gv = state.ask && state.ask.version; if (gs && gv) change(key("goback", gs.id), function () { return api("restoreVersion", { site: gs.id, version: gv }); },
        function (out) { delete state.versions[gs.id]; if (out && out.version) state.flash = "Back to " + gv + ", as version " + out.version + ". Live in about two minutes"; }, "Back to " + gv + ". Live in about two minutes");
    }
    else if (a === "people-pick") { var pk0 = peopleOf(); pk0.sel = el.dataset.email; pk0.mode = ""; pk0.ask = ""; pk0.note = ""; render(); peopleShowPanel(); }
    else if (a === "people-invite") { var pk1 = peopleOf(); pk1.mode = "invite"; pk1.draft = null; pk1.ask = ""; pk1.note = ""; render(); peopleShowPanel(); var pe = app.querySelector("#pi-email"); if (pe) pe.focus({ preventScroll: true }); }
    else if (a === "people-close") { peopleOf().mode = ""; render(); }
    else if (a === "people-remove") { peopleOf().ask = el.dataset.email; render(); }
    else if (a === "people-remove-no") { peopleOf().ask = ""; render(); }
    else if (a === "people-remove-yes") { var gone = el.dataset.email; peopleDo("removePerson", { email: gone }, "Removed. They can no longer sign in.", function () { var pk2 = peopleOf(); pk2.ask = ""; pk2.sel = "admin"; }); }
    else if (a === "people-resend") { peopleDo("resendInvite", { email: el.dataset.email, back: signinBack() }, function (d) { return d.emailed === false ? "The sign-in email could not be sent just now. Please try again." : "Sent again."; }); }
    else if (a === "signout") sb.auth.signOut();
    else if (a === "signin-mode") { state.signinMode = el.dataset.mode; state.signinSent = false; state.notice = null; var em = app.querySelector("#email"); if (em) state.email = em.value.trim(); render(); }
    else if (a === "open-site") { var sid = el.dataset.site; guard(function () { openSite(sid); }); }
    else if (a === "leave-stay") { state.leave = null; if (state.tab === "pages") edPatch(); else render(); }
    else if (a === "leave-save") { var fm = app.querySelector('form[data-form="entry"]'); state.leave = null; if (state.tab === "pages") savePages(); else if (fm) saveEntry(fm); }
    else if (a === "leave-go") { var next = state.leave; state.leave = null; state.dirty = false; if (pgOf()) pgReset(pgOf()); if (next) next(); }
    else if (a === "egroup") {
      state.egroup = Number(el.dataset.g);
      Array.prototype.forEach.call(app.querySelectorAll(".egroup"), function (x) { x.hidden = x.dataset.g !== el.dataset.g; });
      Array.prototype.forEach.call(app.querySelectorAll('[data-act="egroup"]'), function (x) { x.className = x.dataset.g === el.dataset.g ? "on" : ""; });
    }
    else if (a === "cmore") { state.cmore = true; filterList(); }
    else if (a === "files-filter") { var ff = filesOf(); if (ff) { ff.filter = state.fileFilter = el.dataset.f; ff.assign = ""; ff.pick = ""; render(); } }
    else if (a === "files-describe") { var fe = filesOf(); if (fe) { fe.open = el.dataset.name || ""; state.confirm = null; render(); var box = fe.open && app.querySelector("#fd-alt"); if (box) box.focus(); } }
    else if (a === "files-assign") { var fg = filesOf(); if (fg) { fg.assign = el.dataset.key || ""; fg.pick = ""; render(); } }
    else if (a === "files-pick") { var fh = filesOf(); if (fh) { fh.pick = el.dataset.name; render(); var ab = app.querySelector("#fa-alt"); if (ab && !ab.value) ab.focus(); } }
    else if (a === "files-goto") filesGoto(el);
    else if (a === "files-remove") filesWrite("Deleting " + el.dataset.name, { op: "remove", name: el.dataset.name }, null, "Photo deleted");
    else if (a === "files-send") filesSend();
    else if (a === "fadd-drop") { var dp = state.fileAdd.splice(Number(el.dataset.i), 1)[0]; if (dp) URL.revokeObjectURL(dp.url); render(); }
    else if (a === "ed-pick") {
      var pq = pgOf(), cq = pq && pq.sel;
      if (cq && el.dataset.block == null && cq.where === el.dataset.where && cq.id === el.dataset.id && cq.block == null && !cq.pic && (isSecList(cq.where) || cq.where === "shared")) {
        var oq = cq.where + ":" + cq.id; pq.open = pq.open || {}; pq.open[oq] = !(oq in pq.open ? pq.open[oq] : true); edPatch(); return;
      }
      pickSection(el.dataset.id, el.dataset.block, false, el.dataset.where, el.dataset.bf, el.dataset.sf, el.dataset.sub);
    }
    else if (a === "ed-childadd") { var pca = pgOf(); if (pca) addChild(pca, el.dataset); }
    else if (a === "ed-go") navTo(el.dataset.hash);
    else if (a === "ed-new") { var pw = pgOf(); if (pw) { pw.panel = "new"; pw.newWhat = el.dataset.what || pw.newWhat || "page"; if (el.dataset.section != null) pw.newSection = el.dataset.section; if (!el.dataset.keep) pw.newCite = ""; state.notice = null; edPatch(); var nf = app.querySelector('form[data-form="ednew"] input[type=text]'); if (nf) nf.focus(); } }
    else if (a === "ed-menu") {
      var pm2 = pgOf(); if (!pm2) return; var hl = menuLinks(pm2), hh = menuHref(pm2, el.dataset.id), at2 = hl.findIndex(function (l) { return l[1] === hh; });
      if (at2 >= 0) { hl.splice(at2, 1); pm2.what = "Take a page out of the menu bar"; } else { hl.push([shortTitle(pm2, pm2.doc.pages[el.dataset.id].title), hh]); pm2.what = "Add a page to the menu bar"; }
      pgMark(pm2); edPatch(); pushPreview();
    }
    else if (a === "ed-delpage") {
      var pz2 = pgOf(), dk = el.dataset.id; if (!pz2 || dk === "home") return;
      var title2 = pz2.doc.pages[dk].title; delete pz2.doc.pages[dk];
      var hk = pz2.gam && pz2.model !== "sad" ? "menu_extra" : "links", hl2 = ((pz2.doc.shared.header || {}).settings || {})[hk]; if (hl2) pz2.doc.shared.header.settings[hk] = hl2.filter(function (l) { return l[1] !== menuHref(pz2, dk); });
      pz2.what = "Delete page: " + title2; state.confirm = null; pgMark(pz2); navTo("home");
    }
    else if (a === "ed-delsrc") {
      var pd4 = pgOf(), sid = pd4 && pd4.sel && pd4.sel.id; if (!sid || citedCount(pd4, sid)) return;
      var stitle = pd4.site.sources[sid].title; delete pd4.site.sources[sid]; pd4.sel = null; state.confirm = null;
      pd4.what = "Delete source: " + stitle; pgMark(pd4); edPatch(); pushPreview("");
    }
    else if (a === "ed-delartist") {
      var pd5 = pgOf(), ar = pd5 && itemOf(pd5); if (!ar || artistInUse(pd5, ar)) return;
      pd5.site.artists = pd5.site.artists.filter(function (x) { return x !== ar; }); delete pd5.pictures["artist:" + ar.slug];
      pd5.artists = pd5.artists.filter(function (x) { return x.slug !== ar.slug; });
      pd5.what = "Delete artist: " + ar.name; state.confirm = null; pgMark(pd5); navTo(pd5.gam ? "page-artists" : "artists");
    }
    else if (a === "ed-delart") {
      var pz3 = pgOf(), it3 = pz3 && itemOf(pz3); if (!it3) return;
      var sec3 = it3.section; pz3.site.articles = pz3.site.articles.filter(function (x) { return x !== it3; }); delete pz3.pictures["article:" + it3.slug];
      pz3.what = "Delete article: " + it3.title; state.confirm = null; pgMark(pz3);
      navTo(({ explained: "explained", library: "library", reviews: "reviews", features: "artists" })[sec3] || "home");
    }
    else if (a === "ed-pk") {
      var pp2 = pgOf(), ps2 = pp2 && pgSel(pp2); if (!ps2) return;
      var arr2 = pgGet(ps2.sec.settings, el.dataset.path), i2 = Number(el.dataset.i); if (!Array.isArray(arr2)) return;
      if (el.dataset.op === "up" && i2 > 0) { var t2 = arr2[i2 - 1]; arr2[i2 - 1] = arr2[i2]; arr2[i2] = t2; }
      else if (el.dataset.op === "del") arr2.splice(i2, 1);
      else if (el.dataset.op === "edit") { pp2.sel = { where: "source", id: arr2[i2], block: null }; pp2.panel = ""; edPatch(); return; }
      pp2.what = "Edit " + (itemName(pp2) || ps2.kind.label); pgMark(pp2); edPatch(); pushPreview();
    }
    else if (a === "ed-pick-pic") { var pi = pgOf(); if (pi && pi.pictures[el.dataset.key]) { pi.sel = { where: "page", id: el.dataset.id, block: null, pic: el.dataset.key }; pi.panel = ""; pi.picker = ""; edRemember(); edPatch(); pushPreview(); } }
    else if (a === "ed-colour") { var pco = pgOf(); if (!pco) return; pco.colourOpen = pco.colourOpen === el.dataset.path ? "" : el.dataset.path; pco.colourHsv = null; edPatch(); var csv = app.querySelector(".csv"); if (csv) csv.focus(); }
    else if (a === "ed-colour-set") { var pcs2 = pgOf(), scs2 = pcs2 && pgSel(pcs2); if (!scs2) return; pgSet(scs2.sec.settings, el.dataset.path, el.dataset.v); pcs2.colourHsv = null; pcs2.what = "Edit " + (scs2.kind ? scs2.kind.label : scs2.id); pgMark(pcs2); edPatch(); pushSoon(); }
    else if (a === "ed-eyedrop") { var edp = el.dataset.path; try { new window.EyeDropper().open().then(function (r) { var hx2 = String(r.sRGBHex || ""); if (/^#[0-9a-f]{6}$/i.test(hx2)) setColour(edp, hx2.toUpperCase()); }, function () {}); } catch (e) { /* not offered by this browser */ } }
    else if (a === "ed-font") { var pfo = pgOf(); if (!pfo || (!pgSel(pfo) && !isThemePath(el.dataset.path))) return; var fdef = FIELD_DEF[el.dataset.path] || {}; pfo.fontPick = { path: el.dataset.path, label: fdef.label || "Font", was: fGet(pfo, el.dataset.path) || "", fonts: fontList(pfo, fdef), noStyle: !!fdef.noStyle }; loadFontList(pfo.fontPick.fonts); pfo.colourOpen = ""; edPatch(); var fq2 = app.querySelector('[data-input="fontq"]'); if (fq2) fq2.focus(); }
    else if (a === "ed-font-set") {
      var pfs2 = pgOf(); if (!pfs2 || !pfs2.fontPick) return;
      var fam = el.dataset.v, was2 = parseFont(fGet(pfs2, pfs2.fontPick.path)), sts = fam && !pfs2.fontPick.noStyle ? fontStyles(pfs2.fontPick.fonts[fam], fam) : [], st2 = sts.indexOf(was2.style) >= 0 ? was2.style : (sts.indexOf("400") >= 0 ? "400" : sts[0]);
      fSet(pfs2, pfs2.fontPick.path, fam ? fam + (st2 && st2 !== "400" ? ":" + st2 : "") : (pfs2.fontPick.noStyle ? pfs2.fontPick.was : ""));
      var rp2 = app.querySelector(".ed-right"), top2 = rp2 ? rp2.scrollTop : 0; edPatch(); rp2 = app.querySelector(".ed-right"); if (rp2) rp2.scrollTop = top2; pushSoon();
    }
    else if (a === "ed-font-done") { var pfd = pgOf(); if (pfd) fontClose(pfd, false); }
    else if (a === "ed-font-close") { var pfc = pgOf(); if (pfc) fontClose(pfc, true); }
    else if (a === "ed-dt-clear") { var pdc = pgOf(), sdc = pdc && pgSel(pdc); if (!sdc) return; pgSet(sdc.sec.settings, el.dataset.path, ""); pdc.what = "Edit " + (sdc.kind ? sdc.kind.label : sdc.id); pgMark(pdc); edPatch(); pushSoon(); }
    else if (a === "ed-pmore") { var pmo = pgOf(); if (!pmo || !pmo.sel) return; var pr = el.getBoundingClientRect(); ctxOpen(pmo, Object.assign({}, pmo.sel, { more: true }), pr.right - 230, pr.bottom + 8); }
    else if (a === "ed-trename") { var ptr = pgOf(); if (!ptr || !ptr.sel) return; state.renaming = { where: ptr.sel.where, id: ptr.sel.id, panel: true }; edPatch(); var tri = app.querySelector("#ed-rename"); if (tri) { tri.focus(); tri.select(); } }
    else if (a === "ed-css") { var pcs = pgOf(), scs = pcs && pgSel(pcs); if (!scs) return; var ck = scs.where + ":" + scs.id; pcs.cssOpen = pcs.cssOpen === ck ? "" : ck; edPatch(); var cta = app.querySelector(".cssbox textarea"); if (cta) cta.focus(); }
    else if (a === "ed-panel-close") { var pq = pgOf(); if (pq) { pq.panel = ""; pq.sel = null; pq.picker = ""; pq.fontPick = null; pq.colourOpen = ""; edRemember(); edPatch(); pushPreview(""); } }
    else if (a === "ed-secpicker") { var pl = pgOf(); if (pl) { pl.picker2 = { mode: "section", at: Number(el.dataset.at), g: el.dataset.g || "page" }; pl.panel = ""; edPatch(); focusPicker(); } }
    else if (a === "ed-blockpicker") {
      var pb = pgOf(); if (!pb) return;
      pb.picker2 = { mode: "block", where: el.dataset.where, id: el.dataset.id, bf: el.dataset.bf || "", at: el.dataset.at == null ? -1 : Number(el.dataset.at) };
      // with only one kind of block to add, there is nothing to choose
      var can = pickerItems(pb).filter(function (x) { return !x.off; });
      if (can.length === 1) { pickerAdd(pb, can[0].key); return; }
      edPatch(); focusPicker();
    }
    else if (a === "ed-pk-tab") { var ptb = pgOf(); if (ptb && ptb.picker2) { ptb.picker2.tab = el.dataset.t; edPatch(); if (el.dataset.t === "types") focusPicker(); } }
    else if (a === "ed-pick-close") { var pz2 = pgOf(); if (pz2) { pz2.picker2 = null; edPatch(); } }
    else if (a === "ed-pick-add") { var pa2 = pgOf(); if (pa2 && pa2.picker2 && !el.disabled) pickerAdd(pa2, el.dataset.key); }
    else if (a === "ed-page") { var pp = pgOf(); if (pp) { pp.page = el.dataset.page; pp.sel = null; pp.panel = ""; edRemember(); edPatch(); pushPreview(); } }
    else if (a === "ed-mode") { var pm = pgOf(); if (pm) { pm.mode = el.dataset.mode; edRemember(); var fr = app.querySelector(".ed-frame"); if (fr) fr.className = "ed-frame " + pm.mode; edFit(); patchEdTop(); } }
    else if (a === "ed-hide") { var ph0 = pgOf(); if (ph0) toggleHidden(ph0); }
    else if (a === "ed-row-hide") {
      // hide or show a row without moving away from what is picked
      var pr0 = pgOf(); if (!pr0) return; var keep = pr0.sel;
      pr0.sel = { where: el.dataset.where, id: el.dataset.id, block: el.dataset.block == null ? null : Number(el.dataset.block), bf: el.dataset.bf || undefined };
      toggleHidden(pr0, keep);
    }
    else if (a === "ed-row-del") {
      // the bin removes at once; Put it back is offered straight away
      var pr1 = pgOf(); if (!pr1) return; var keep1 = pr1.sel;
      pr1.sel = { where: el.dataset.where, id: el.dataset.id, block: el.dataset.block == null ? null : Number(el.dataset.block), bf: el.dataset.bf || undefined };
      if (el.dataset.sf) { pr1.sel.sf = el.dataset.sf; pr1.sel.sub = Number(el.dataset.sub); }
      removeSel(pr1, keep1);
    }
    else if (a === "ed-dup") { dupSel(pgOf()); }
    else if (a === "ed-move") {
      var pv = pgOf(), ms = pv && pgSel(pv); if (!ms) return;
      var dir = Number(el.dataset.dir);
      if (ms.block != null && ms.single) return;
      if (ms.block != null) { var bj = ms.block + dir; if (bj < 0 || bj >= ms.list.length) return; var bt = ms.list[ms.block]; ms.list[ms.block] = ms.list[bj]; ms.list[bj] = bt; if (ms.child) pv.sel.sub = bj; else pv.sel.block = bj; pv.what = "Move " + ms.bk.label.toLowerCase() + ": " + blockTitle(bt, bj); }
      else { if (!isSecList(ms.where)) return; var ml = secList(pv, ms.where), mi = ml.findIndex(function (x) { return x.id === ms.id; }), mj = mi + dir;
        if (mj < 0 || mj >= ml.length) return; var tmp = ml[mi]; ml[mi] = ml[mj]; ml[mj] = tmp; pv.what = "Move section: " + (ms.kind ? ms.kind.label : ms.id); }
      pgMark(pv); edPatch(); pushPreview();
    }
    else if (a === "ed-remove") { var pr = pgOf(); if (pr) removeSel(pr); }
    else if (a === "ed-putback") { var pb2 = pgOf(); if (pb2) putBack(pb2); }
    else if (a === "ed-tpl-cancel") { var tc0 = pgOf(); if (tc0) { tc0.tplNew = null; edPatch(); } }
    else if (a === "ed-tpl-make") { var tm = pgOf(); if (tm) tplMake(tm); }
    else if (a === "ed-tpl-ex") { state.tplEx = !state.tplEx; edPatch(); var xq = app.querySelector("#tpl-ex-q"); if (xq) xq.focus(); }
    else if (a === "ed-tpl-show") { var ts0 = pgOf(); if (ts0) { var tk0 = tplHere(ts0), keep = tplId(ts0); state.tplEx = false; ts0.tplOpen = ts0.tplOpen || {}; ts0.tplOpen[tk0] = keep; navTo((tk0 === "article" ? "a-" : "artist-") + el.dataset.slug, true); patchEdTop(); } }
    else if (a === "ed-tpl-rename") { var tr0 = pgOf(); if (tr0 && tplHere(tr0)) { state.tplRename = { kind: tplHere(tr0), id: tplId(tr0) }; edPatch(); var rb = app.querySelector("#tpl-rename"); if (rb) { rb.focus(); rb.select(); } } }
    else if (a === "ed-tpl-del") { var td0 = pgOf(); if (td0) tplRemove(td0); }
    else if (a === "ed-expand") { var pe = pgOf(); if (pe) { pe.open = pe.open || {}; pe.open[el.dataset.key] = el.getAttribute("aria-expanded") !== "true"; if (!pe.open[el.dataset.key] && pe.sel && pe.sel.where + ":" + pe.sel.id === el.dataset.key) pe.sel = Object.assign({}, pe.sel, { block: null }); edPatch(); } }
    else if (a === "ctx") { var pc = pgOf(); if (pc) ctxDo(pc, el.dataset.op); }
    else if (a === "ed-add-block") {
      var pk = pgOf(); if (!pk) return; pk.sel = { where: el.dataset.where, id: el.dataset.id, block: null };
      var ks = pgSel(pk), kb = ks && ks.kind ? bkinds(ks.kind)[0] : null; if (!kb) return;
      var bf = ks.kind.fields.find(function (f) { return f.name === kb.field; }); if (!bf) return;
      var arr = ks.sec.settings[kb.field]; if (!Array.isArray(arr)) { arr = []; ks.sec.settings[kb.field] = arr; }
      var blank = blankFrom(bf.fields); if (ks.where === "item" && kb.field === "sections") { var sn = 1; while (arr.some(function (x) { return x && x.id === "part-" + sn; })) sn++; blank.id = "part-" + sn; }
      arr.push(blank); pk.sel.block = arr.length - 1; pk.sel.bf = kb.field; pk.what = kb.add + " in " + (ks.where === "item" ? itemName(pk) : ks.kind.label);
      pgMark(pk); pk.scrollNext = true; edPatch(); pushPreview();
    }
    else if (a === "ed-picker" && FIELD_DEF[el.dataset.path] && /^(image|video)$/.test(FIELD_DEF[el.dataset.path].type)) {
      var plo = pgOf(); if (!plo || (!pgSel(plo) && !isThemePath(el.dataset.path))) return; var fd = FIELD_DEF[el.dataset.path], cur = fGet(plo, el.dataset.path);
      plo.lib = { path: el.dataset.path, label: fd.label || "Picture", kind: fd.type, tick: cur && !/^https?:/i.test(cur) ? cur : "", view: (plo.libView || "grid"), noAdd: fd.lib === "noadd" }; edPatch();
      var lq = app.querySelector("[data-lib-q]"); if (lq) lq.focus();
    }
    else if (a === "ed-picker") { var pq2 = pgOf(); if (pq2) { pq2.picker = pq2.picker === el.dataset.path ? "" : el.dataset.path; edPatch(); } }
    else if (a === "ed-res") { var prs = pgOf(); if (!prs) return; prs.res = prs.res && prs.res.path === el.dataset.path && prs.res.mode === el.dataset.mode ? null : { path: el.dataset.path, mode: el.dataset.mode }; edPatch(); var rq = app.querySelector("[data-res-q]"); if (rq) rq.focus(); }
    else if (a === "ed-res-set") { var prs2 = pgOf(), srs = prs2 && pgSel(prs2); if (!srs) return; pgSet(srs.sec.settings, el.dataset.path, el.dataset.v); prs2.res = null; prs2.what = "Edit " + (srs.kind ? srs.kind.label : srs.id); pgMark(prs2); edPatch(); pushPreview(); }
    else if (a === "ed-res-new") { var prn = pgOf(); if (!prn) return; prn.res = null; prn.panel = "new"; prn.newWhat = el.dataset.what; edPatch(); var nfr = app.querySelector('form[data-form="ednew"] input[type=text]'); if (nfr) nfr.focus(); }
    else if (a === "ed-lib-close") { var plc = pgOf(); if (plc) { plc.lib = null; edPatch(); } }
    else if (a === "ed-lib-view") { var plv = pgOf(); if (plv && plv.lib) { plv.lib.view = el.dataset.v; plv.libView = el.dataset.v; libPatch(); } }
    else if (a === "ed-lib-done") {
      var pld = pgOf(), sld = pld && pgSel(pld); if (!pld || !pld.lib || !pld.lib.tick) return;
      var lp = pld.lib.path, ln = pld.lib.tick; pld.lib = null;
      if (isThemePath(lp)) { themeSet(lp, ln); edPatch(); return; }
      if (!sld) return;
      pgSet(sld.sec.settings, lp, ln);
      var lk = pld.imageMeta[ln] || {}, lAlt = lp.replace(/[^.]+$/, "alt"); if (lk.alt && !String(pgGet(sld.sec.settings, lAlt) || "").trim()) pgSet(sld.sec.settings, lAlt, lk.alt);
      pld.what = "Edit " + (sld.kind ? sld.kind.label : sld.id); pgMark(pld); edPatch(); pushPreview();
    }
    else if (a === "ed-pic-none" && isThemePath(el.dataset.path)) { themeSet(el.dataset.path, ""); edPatch(); }
    else if (a === "ed-unshare") { var pun = pgOf(), sun = pun && pgSel(pun); if (!sun) return; var sw3 = sharedWord(pun, "{" + el.dataset.word + "}"); pgSet(sun.sec.settings, el.dataset.path, sw3 ? sw3.value : ""); pun.what = "Edit " + (sun.kind ? sun.kind.label : sun.id); pgMark(pun); edPatch(); pushPreview(); var fe = app.querySelector('[data-pf="' + cssq(el.dataset.path) + '"]'); if (fe) fe.focus(); }
    else if (a === "ed-range-reset") { var prr = pgOf(); if (prr && fSet(prr, el.dataset.path, null)) { edPatch(); pushSoon(); } }
    else if (a === "ed-tgroup") { state.themeGroup = state.themeGroup === el.dataset.g ? "" : el.dataset.g; edPatch(); var ps9 = site(), pg9 = pgOf(); if (ps9 && pg9) edAddress(ps9, pg9); }
    else if (a === "ed-theme-open") { var pto = pgOf(); if (pto) { pto.leftPanel = "theme"; pto.leftHidden = false; pto.tboxOpen = false; if (state.themeGroup == null || state.themeGroup === "") state.themeGroup = "colours"; edPatch(); } }
    else if (a === "ed-tbox") { var ptb2 = pgOf(); if (ptb2) { ptb2.tboxOpen = !ptb2.tboxOpen; edPatch(); } }
    else if (a === "ed-tlook") { var ptl = pgOf(); if (ptl) { ptl.tlook = Number(el.dataset.i); edPatch(); } }
    else if (a === "ed-tlook-cancel") { var ptc = pgOf(); if (ptc) { ptc.tlook = null; edPatch(); } }
    else if (a === "ed-tlook-go") { var ptg = pgOf(); if (ptg) { themeStyle(ptg.tlook); ptg.tlook = null; edPatch(); } }
    else if (a === "ed-pic-choose" || a === "ed-pic-none") {
      var pc = pgOf(), cs = pc && pgSel(pc); if (!cs) return;
      pgSet(cs.sec.settings, el.dataset.path, a === "ed-pic-none" ? "" : el.dataset.name); pc.picker = "";
      var known = a === "ed-pic-choose" && (pc.imageMeta[el.dataset.name] || {}), altAt = el.dataset.path.replace(/[^.]+$/, "alt");
      if (known && known.alt && !String(pgGet(cs.sec.settings, altAt) || "").trim()) pgSet(cs.sec.settings, altAt, known.alt);
      pc.what = "Edit " + (cs.kind ? cs.kind.label : cs.id); pgMark(pc); edPatch(); pushPreview();
    }
    else if (a === "ed-row-add" || a === "ed-row-del" || a === "ed-row-move") {
      var px = pgOf(), xs = px && pgSel(px); if (!xs) return;
      var rows = pgGet(xs.sec.settings, el.dataset.path); if (!Array.isArray(rows)) { rows = []; pgSet(xs.sec.settings, el.dataset.path, rows); }
      if (a === "ed-row-add") { var kf = (xs.kind.fields || []).concat([]).reduce(function (found, f) { return found || (f.name === el.dataset.path ? f : null) || ((f.fields || []).find(function (g) { return el.dataset.path.endsWith("." + g.name) && g.type === "rows"; }) || null); }, null); var blank = kf && kf.fields ? (kf.fields.some(function (g) { return typeof g.name === "number"; }) ? kf.fields.map(function () { return ""; }) : kf.fields.reduce(function (o, g) { o[g.name] = g.type === "rows" || g.type === "lines" ? [] : g.type === "yesno" ? false : ""; return o; }, {})) : {}; rows.push(blank); }
      else if (a === "ed-row-del") rows.splice(Number(el.dataset.i), 1);
      else { var ri = Number(el.dataset.i), rj = ri + Number(el.dataset.dir); if (rj >= 0 && rj < rows.length) { var rt = rows[ri]; rows[ri] = rows[rj]; rows[rj] = rt; } }
      px.what = "Edit " + (xs.kind ? xs.kind.label : xs.id); pgMark(px); edPatch(); pushPreview();
    }
    else if (a === "ed-save") savePages();
    else if (a === "ed-save-publish") { var cp = curCopy().id; savePages(function () { state.ask = { kind: "makelive", copy: cp }; if (pgOf()) edPatch(); else render(); var q = app.querySelector(".ask"); if (q && q.scrollIntoView) q.scrollIntoView({ block: "start" }); var nb = app.querySelector("#pub-note"); if (nb) nb.focus({ preventScroll: true }); }); }
    else if (a === "ed-discard") { var pz = pgOf(); if (pz) { var tdd = themeOf(); if (tdd) { tdd.draft = JSON.parse(JSON.stringify(tdd.values)); themePush(); } pgReset(pz); pz.removed = null; state.renaming = null; pz.sel = null; pz.panel = ""; pz.uploads = {}; pz.picker = ""; edPatch(); pushPreview(""); } }
    else if (a === "look") { var t = themeOf(), i = Number(el.dataset.i); if (t) { Object.assign(t.draft.colours, i < 0 ? t.values.colours : t.spec.looks[i].colours); themeUpdate(); } }
    else if (a === "theme-discard") { var t2 = themeOf(); if (t2) { t2.draft = JSON.parse(JSON.stringify(t2.values)); themeUpdate(); } }
    else if (a === "theme-publish") onLive(publishTheme, "This theme change");
    else if (a === "publish-replace") publish(el.dataset.copy, true, { note: state.ask && state.ask.note, big: state.ask && state.ask.big });
    else if (a === "ask-makelive") { state.ask = { kind: "makelive", copy: curCopy().id }; if (state.tab === "pages" && pgOf()) edPatch(); else render(); var qa = app.querySelector(".ask"); if (qa && qa.scrollIntoView) qa.scrollIntoView({ block: "start" }); else if (typeof window.scrollTo === "function") window.scrollTo(0, 0); }
    else if (a === "ask-big") { state.ask = { kind: el.dataset.kind, copy: el.dataset.copy }; render(); if (typeof window.scrollTo === "function") window.scrollTo(0, 0); }
    else if (a === "stale-replace") { var px = pgOf(); state.ask = null; state.notice = null; if (px) { px.replaceNext = true; state.sure = true; try { savePages(); } finally { state.sure = false; } } }
    else if (a === "stale-reload") { var sx = site(); state.ask = null; state.notice = null; state.dirty = false; if (sx) { delete state.pg[sx.id]; render(); ensure(); } }
    else if (a === "ask-cancel") { state.ask = null; if (state.tab === "pages" && pgOf()) edPatch(); else render(); }
    else if (a === "livesave") { var run = state.ask && state.ask.go; state.ask = null; state.sure = true; try { if (run) run(); } finally { state.sure = false; } }
    else if (a === "makelive") publish(el.dataset.copy, false, publishExtra());
    else if (a === "discard") copyAction("discard", el.dataset.copy, "Changes thrown away. The live site is as it was");
    else if (a === "deletecopy") copyAction("deleteCopy", el.dataset.copy, "Trial copy deleted", function () { state.copy[s.id] = ""; });
    else if (a === "refresh-copy") refreshMine(el.dataset.copy);
    else if (a === "ask-fresh") { state.ask = { kind: "fresh", copy: el.dataset.copy }; if (state.tab === "pages" && pgOf()) edPatch(); else render(); }
    else if (a === "fresh") { var fs1 = site(), fx = copyArg(el.dataset.copy); if (fs1) change(key("copy", fs1.id), function () { return api("refreshCopy", { site: fs1.id, copy: fx.arg, fresh: true }); }, null, "Your copy now starts again from the live site"); }
    else if (a === "undo-step") { var n = Number(el.dataset.steps) || 1; guard(function () { state.open = null; state.draft = null; state.dirty = false; onLive(function () { stepBack(n); }, n > 1 ? "Undoing " + n + " steps" : "Undoing this step"); }); }
    else if (a === "redo-step") guard(function () { state.open = null; state.draft = null; state.dirty = false; onLive(stepForward, "Redoing this step"); });
    else if (a === "work-on") { var wid = el.dataset.copy; guard(function () { workOn(wid); }); }
    else if (a === "pv-mode") {
      var t3 = themeOf(); if (!t3) return; t3.mode = el.dataset.mode;
      app.querySelector("#pv-stage").className = "pv-stage " + t3.mode;
      Array.prototype.forEach.call(app.querySelectorAll('[data-act="pv-mode"]'), function (x) { x.className = x.dataset.mode === t3.mode ? "on" : ""; });
      sizePreview();
    }
    else if (a === "ctab") { state.prevCtab = state.ctab[s.id] || 0; state.ctab[s.id] = Number(el.dataset.i); state.csearch = ""; state.cmore = false; render(); }
    else if (a === "open") { state.draft = null; state.dirty = false; state.leave = null; state.egroup = 0; state.open = { ci: Number(el.dataset.ci), ei: Number(el.dataset.ei) }; state.confirm = null; state.notice = null; render(); if (typeof window.scrollTo === "function") window.scrollTo(0, 0); }
    else if (a === "close") guard(closeEntry);
    else if (a === "ask") { state.confirm = el.dataset.k; if (state.tab === "pages" && pgOf()) edPatch(); else render(); }
    else if (a === "cancel") { state.confirm = null; if (state.tab === "pages" && pgOf()) edPatch(); else render(); }
    else if (a === "entry-hide") onLive(function () { entryChange("setHidden", function (o) { return { hidden: !o.e.hidden }; }); }, "Hiding or showing this");
    else if (a === "entry-delete") onLive(function () { entryChange("deleteEntry", function () { return {}; }); }, "Deleting this");
    else if (a === "photo-take") { var ps = el.dataset.slot; onLive(function () { takePhoto(ps); }, "Removing this photo"); }
    else if (a === "undo") { var us = el.dataset.sha; onLive(function () { undo(us); }, "Putting this back"); }
    else if (a === "photo-send") onLive(sendPhotos, "Sending these photos");
    else if (a === "photo-remove") { state.photoFiles.splice(Number(el.dataset.i), 1); render(); }
  });

  // One setting in the page editor changed: keep it, redraw the page in the middle, nothing else.
  function pgInput(t) {
    var pgd = pgOf(), sel = pgd && pgSel(pgd), isT = isThemePath(t.dataset.pf); if (!pgd || (!sel && !isT)) return;
    var path = t.dataset.pf, kind = t.dataset.kind, v;
    if (kind === "lines") v = t.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    else if (kind === "number") {
      v = t.value === "" ? 0 : Number(t.value);
      if (t.dataset.twin) {
        var ownEl = t.closest && t.closest(".field") && t.closest(".field").querySelector("span.own"); if (ownEl) ownEl.outerHTML = '<button type="button" class="linklike small own" data-act="ed-range-reset" data-path="' + esc(path) + '">Use the site\'s own</button>';
        var lo = Number(t.min), hi = Number(t.max); if (t.type === "number" && t.value !== "" && !isNaN(lo) && !isNaN(hi)) v = Math.min(hi, Math.max(lo, v));
        Array.prototype.forEach.call(app.querySelectorAll('[data-pf="' + cssq(path) + '"][data-twin]'), function (x) { if (x !== t) x.value = v; if (x.type === "range") x.style.setProperty("--at", Math.round((v - lo) / ((hi - lo) || 1) * 100) + "%"); });
      }
    }
    else if (kind === "numnull") v = t.value === "" ? null : Number(t.value);
    else if (kind === "which") { if (t.value === "+chosen") { v = []; pgSet(sel.sec.settings, path, v); pgd.what = "Edit " + (sel.kind ? sel.kind.label : sel.id); pgMark(pgd); edPatch(); pushPreview(); return; } v = t.value; var wasList = Array.isArray(pgGet(sel.sec.settings, path)); pgSet(sel.sec.settings, path, v); pgMark(pgd); if (wasList) edPatch(); else patchEdTop(); pushSoon(); return; }
    else if (kind === "yesno") { v = t.type === "checkbox" ? t.checked : t.value === "true"; var grp = t.closest && t.closest(".setgrp"); if (grp && /\.on$/.test(path)) grp.classList.toggle("off", !v); }
    else if (kind === "hex") { var hx = t.value.trim().replace(/^#?/, "#"); if (/^#[0-9a-f]{6}$/i.test(hx)) setColour(path, hx.toUpperCase()); return; }
    else if (kind === "vlink") v = t.value.trim();
    else if (kind === "artists") { v = []; Array.prototype.forEach.call(app.querySelectorAll('[data-pf="' + path + '"]'), function (c) { if (c.checked) v.push(c.value); }); }
    else if (kind === "colour-pick") {
      if (t.value === "custom") { var cin = app.querySelector('[data-pf="' + path + '"][data-kind="colour"]'); v = cin ? cin.value.toUpperCase() : "#1D4A35"; }
      else v = t.value;
      var sw = app.querySelector('[data-swatch="' + path + '"]'); if (sw) sw.hidden = t.value !== "custom";
    }
    else if (kind === "colour") { v = t.value.toUpperCase(); var sw2 = app.querySelector('[data-swatch="' + path + '"]'); if (sw2) sw2.style.background = v; }
    else if (kind === "code") { v = t.value; var gu = t.parentNode.querySelector(".gut"); if (gu) gu.textContent = gutter(v); t.rows = Math.max(6, v.split("\n").length + 1); }
    else v = t.value;
    if (isT) { themeSet(path, v); return; }
    pgSet(sel.sec.settings, path, v);
    pgd.what = sel.where === "item" ? "Edit " + itemName(pgd) : sel.where === "source" ? "Edit source: " + (sel.sec.settings.title || sel.id) : "Edit " + (sel.kind ? sel.kind.label : sel.id); pgMark(pgd); patchEdTop(); pushSoon();
    if (sel.where === "item" && (path === "title" || path === "name")) { var lt = app.querySelector(tplHere(pgd) ? ".ed-left .tpl-ex-name" : ".ed-left .lt"); if (lt) lt.textContent = v; }
    // the picked block's row in the list follows its words as they are typed
    if (sel.block != null && !sel.single) { var bf2 = sel.bk.field, row2 = app.querySelector('.sec.blk[data-id="' + cssq(sel.id) + '"][data-bf="' + cssq(bf2) + '"][data-block="' + sel.block + '"] .nm'); if (row2) row2.textContent = bTitle(pgd, sel.bk, sel.list[sel.block], sel.block); }
  }
  function cssq(x) { return String(x).replace(/["\\]/g, "\\$&"); }
  function patchEdTop() { var top = app.querySelector && app.querySelector(".ed-top"), s = site(); if (top && s) top.innerHTML = edTop(s, pgOf()); }

  async function uploadInto(t) {
    var pgd = pgOf(), sel = pgd && pgSel(pgd), file = t.files && t.files[0]; if (!sel || !file) return;
    var path = t.dataset.upload;
    if (!/^image\/(jpeg|png)$/.test(file.type)) { state.notice = { text: "Please choose a JPG or PNG photo.", problem: true }; edPatch(); return; }
    if (Object.keys(pgd.uploads || {}).length >= 12) { state.notice = { text: "Save the photos you have added first, then add more.", problem: true }; edPatch(); return; }
    try {
      var img = await prepareImage(file);
      pgd.uploads = pgd.uploads || {}; pgd.upN = (pgd.upN || 0) + 1;
      var keyName = "upload:" + pgd.upN;
      pgd.uploads[keyName] = { name: file.name, ext: img.ext, content: img.content, dataUrl: "data:image/" + (img.ext === "png" ? "png" : "jpeg") + ";base64," + img.content };
      pgSet(sel.sec.settings, path, keyName); pgd.picker = ""; state.notice = null;
      pgd.what = "Add photo to " + (sel.kind ? sel.kind.label : sel.id); pgMark(pgd); edPatch(); pushPreview();
      var altPath = path.replace(/[^.]+$/, "alt"), altBox = app.querySelector('[data-pf="' + altPath + '"]');
      if (altBox && !altBox.value) altBox.focus();
    } catch (e) { state.notice = { text: e.message, problem: true }; edPatch(); }
  }

  app.addEventListener("change", function (ev) {
    var t = ev.target, kind = t.dataset.change;
    if (t.dataset && t.dataset.upload) { uploadInto(t); return; }
    if (t.dataset && t.dataset.dt) { dtChanged(t.dataset.dt); return; }
    if (t.dataset && t.dataset.libTick) { var plt = pgOf(); if (plt && plt.lib) { plt.lib.tick = t.checked ? t.dataset.libTick : ""; libPatch(); } return; }
    if (t.dataset && t.dataset.libAdd) { libAdd(Array.prototype.slice.call(t.files || [])); t.value = ""; return; }
    if (kind === "ed-lib-opt") { var plo2 = pgOf(); if (plo2 && plo2.lib) { plo2.lib[t.dataset.o] = t.value; libPatch(); } return; }
    if (kind === "ed-font-style") { var pfs = pgOf(); if (!pfs || !pfs.fontPick) return; var cfs = parseFont(fGet(pfs, pfs.fontPick.path)); if (!cfs.family) return; fSet(pfs, pfs.fontPick.path, cfs.family + (t.value === "400" ? "" : ":" + t.value)); pushSoon(); return; }
    if (kind === "files-replace") { filesReplace(t); t.value = ""; return; }
    if (kind === "ed-tpl-assign") { var pta = pgOf(); if (pta) tplAssign(pta, t.value); return; }
    if (t.id === "tpl-new-base") { var ptb = pgOf(); if (ptb && ptb.tplNew) ptb.tplNew.base = t.value; return; }
    if (kind === "ed-goto") { var gt = t.value; guardless(function () { navTo(gt); }); return; }
    if (kind === "ed-pk-add") {
      var pa2 = pgOf(), sa2 = pa2 && pgSel(pa2); if (!sa2 || !t.value) return;
      if (t.value === "+new") { pa2.panel = "new"; pa2.newWhat = "source"; pa2.newCite = { sel: JSON.parse(JSON.stringify(pa2.sel)), path: t.dataset.path, at: pa2.at, page: pa2.page }; edPatch(); var nf2 = app.querySelector('form[data-form="ednew"] input[type=text]'); if (nf2) nf2.focus(); return; }
      var list2 = pgGet(sa2.sec.settings, t.dataset.path); if (!Array.isArray(list2)) { list2 = []; pgSet(sa2.sec.settings, t.dataset.path, list2); }
      if (list2.indexOf(t.value) < 0) list2.push(t.value);
      pa2.what = "Edit " + (itemName(pa2) || sa2.kind.label); pgMark(pa2); edPatch(); pushPreview(); return;
    }
    if (t.dataset && t.dataset.cite) { citeHere(t.value); t.value = ""; return; }
    if (kind === "files-add") {
      var bad = 0;
      Array.prototype.forEach.call(t.files, function (f) { if (!/^image\/(jpeg|png)$/.test(f.type)) { bad++; return; } if (state.fileAdd.length < 12) state.fileAdd.push({ file: f, url: URL.createObjectURL(f), alt: "", caption: "" }); });
      state.notice = bad ? { text: bad === 1 ? "One file was not a JPG or PNG photo, so it was left out." : bad + " files were not JPG or PNG photos, so they were left out.", problem: true } : null;
      t.value = ""; render(); var first = app.querySelector('[data-input="fadd-alt"]'); if (first) first.focus(); return;
    }
    if (t.dataset && t.dataset.pf && (t.tagName === "SELECT" || t.type === "checkbox" || t.type === "color" || t.type === "radio")) { pgInput(t); if (t.type === "radio" || t.tagName === "SELECT") edPatch(); return; }
    if (t.dataset.field) state.dirty = true;
    if (kind === "copy") { var cw = t.value; if (state.open && state.dirty) t.value = curCopy().kind === "live" ? "" : curCopy().id; guard(function () { workOn(cw); }); }
    else if (kind === "csort") { state.csort = t.value; render(); }
    else if (t.dataset.themeFont) { var tf = themeOf(); if (tf) { tf.draft.fonts[t.dataset.themeFont] = t.value; themeUpdate(); } }
    else if (t.dataset.themeColour || t.dataset.themeHex) { themeUpdate(); }
    else if (kind === "photo-files") {
      Array.prototype.forEach.call(t.files, function (f) { if (state.photoFiles.length < 12) state.photoFiles.push({ file: f, slot: "", note: "", alt: "", caption: "" }); });
      state.notice = null; render();
    } else if (kind === "photo-slot") {
      var p = state.photoFiles[Number(t.dataset.i)]; if (!p) return;
      var taken = t.value && t.value !== "other" && state.photoFiles.some(function (q) { return q !== p && q.slot === t.value; });
      if (taken) { state.notice = { text: "Another photo in this batch is already going to that spot.", problem: true }; p.slot = ""; }
      else { p.slot = t.value; p.status = ""; state.notice = null; }
      render();
    }
  });

  // Typing must not redraw the page, or the box loses focus.
  function pickerHover(btn) {
    var pgd = pgOf(); if (!pgd || !pgd.picker2 || !btn || btn.disabled) return;
    var it = pickerItems(pgd).filter(function (x) { return x.key === btn.dataset.key; })[0]; if (!it) return;
    Array.prototype.forEach.call(app.querySelectorAll(".pk-item.on"), function (x) { x.classList.remove("on"); }); btn.classList.add("on");
    var v = app.querySelector(".pk-view"); if (v) v.innerHTML = pickView(pgd.picker2, it);
  }
  app.addEventListener("mouseover", function (ev) { var b = ev.target.closest && ev.target.closest(".pk-item"); if (b) pickerHover(b); });
  app.addEventListener("focusin", function (ev) { var b = ev.target.closest && ev.target.closest(".pk-item"); if (b) pickerHover(b); if (ev.target.dataset && ev.target.dataset.linkq) linkList(ev.target); });
  app.addEventListener("focusout", function (ev) {
    if (!(ev.target.dataset && ev.target.dataset.linkq)) return;
    var box = ev.target.parentNode; setTimeout(function () { if (!box.contains(document.activeElement)) { var l = box.querySelector(".lopts"); if (l) l.remove(); } }, 120);
  });
  app.addEventListener("mousedown", function (ev) {
    var lo = ev.target.closest && ev.target.closest(".lopt");
    if (lo) {
      ev.preventDefault(); var inp = lo.closest(".linkf").querySelector("[data-linkq]");
      if (lo.dataset.lkind) { inp.dataset.lkind = lo.dataset.lkind; linkList(inp); return; }
      if (lo.dataset.lback) { delete inp.dataset.lkind; linkList(inp); return; }
      delete inp.dataset.lkind; linkPicked(inp, lo.dataset.href);
    }
  });
  app.addEventListener("dragover", function (ev) { var d = ev.target.closest && ev.target.closest("[data-lib-drop]"); if (d) { ev.preventDefault(); d.classList.add("over"); } });
  app.addEventListener("dragleave", function (ev) { var d = ev.target.closest && ev.target.closest("[data-lib-drop]"); if (d) d.classList.remove("over"); });
  app.addEventListener("drop", function (ev) { var d = ev.target.closest && ev.target.closest("[data-lib-drop]"); if (!d) return; ev.preventDefault(); d.classList.remove("over"); libAdd(Array.prototype.slice.call((ev.dataTransfer && ev.dataTransfer.files) || [])); });
  app.addEventListener("pointerdown", function (ev) {
    var sv = ev.target.closest && ev.target.closest(".csv"); if (!sv) return;
    ev.preventDefault(); var path = sv.dataset.sv;
    var at = function (e) { var pg = pgOf(); if (!pg || !pg.colourHsv) return; var r = sv.getBoundingClientRect(); pg.colourHsv.s = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 100); pg.colourHsv.v = Math.round((1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))) * 100); setColour(path, hsvToHex(pg.colourHsv.h, pg.colourHsv.s, pg.colourHsv.v), true); };
    var up = function () { document.removeEventListener("pointermove", at); document.removeEventListener("pointerup", up); };
    at(ev); document.addEventListener("pointermove", at); document.addEventListener("pointerup", up);
  });
  (typeof document.addEventListener === "function" ? document : app).addEventListener("keydown", function (ev) {
    var pk = state.tab === "pages" && pgOf(); if (!pk) return;
    var sv = ev.target.classList && ev.target.classList.contains("csv") ? ev.target : null;
    if (sv && pk.colourHsv && /^Arrow/.test(ev.key)) { ev.preventDefault(); var d = ev.shiftKey ? 10 : 2, h2 = pk.colourHsv; if (ev.key === "ArrowLeft") h2.s = Math.max(0, h2.s - d); if (ev.key === "ArrowRight") h2.s = Math.min(100, h2.s + d); if (ev.key === "ArrowUp") h2.v = Math.min(100, h2.v + d); if (ev.key === "ArrowDown") h2.v = Math.max(0, h2.v - d); setColour(sv.dataset.sv, hsvToHex(h2.h, h2.s, h2.v), true); return; }
    if (ev.key === "Enter" && ev.target && ev.target.id === "tpl-new-name") { ev.preventDefault(); tplMake(pk); return; }
    if (ev.target && ev.target.id === "tpl-rename") { if (ev.key === "Enter") { ev.preventDefault(); tplRenameDone(true); } else if (ev.key === "Escape") { ev.preventDefault(); tplRenameDone(false); } return; }
    if (ev.key !== "Escape") return;
    if (pk.tplNew) { pk.tplNew = null; edPatch(); }
    else if (state.tplEx) { state.tplEx = false; edPatch(); }
    else if (pk.lib) { pk.lib = null; edPatch(); }
    else if (pk.picker2) { pk.picker2 = null; edPatch(); }
    else if (pk.res) { pk.res = null; edPatch(); }
    else if (pk.colourOpen) { pk.colourOpen = ""; edPatch(); }
    else if (pk.fontPick) { fontClose(pk, true); }
  });
  if (typeof document.addEventListener === "function") document.addEventListener("keydown", function (ev) {
    if (state.tab !== "pages" || !pgOf()) return;
    if (ev.key === "Escape" && state.edMenu) { state.edMenu = ""; patchEdTop(); var mb = app.querySelector(".ed-pagebtn"); if (mb) mb.focus(); return; }
    if (ev.key === "Enter" && ev.target.id === "pp-q") { var first = app.querySelector(".pp-all .pp-item:not([hidden])"); if (first) { ev.preventDefault(); first.click(); } return; }
    if (ev.target && ev.target.id === "ed-rename") { if (ev.key === "Enter") { ev.preventDefault(); renameDone(true); } else if (ev.key === "Escape") { ev.preventDefault(); renameDone(false); } return; }
    if (ev.key === "Escape" && state.ctx) { ctxClose(); return; }
    var typing = ev.target && (ev.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName || ""));
    if (typing) return; // AltGr is Ctrl+Alt on many keyboards, so leave typing alone
    var pk = pgOf();
    if (ev.shiftKey && ev.code === "KeyH" && (ev.ctrlKey || ev.metaKey || ev.altKey) && pk.sel) { ev.preventDefault(); toggleHidden(pk); return; }
    if (ev.shiftKey && (ev.key === "Delete" || (ED_MAC && ev.key === "Backspace")) && pk.sel) { ev.preventDefault(); removeSel(pk); return; }
    var digit = /^Digit([123])$/.exec(ev.code || "");
    var mod = ev.ctrlKey || ev.metaKey;
    if (mod && ev.altKey && !ev.shiftKey && digit) { ev.preventDefault(); edPanel(["sections", "theme", "addons"][Number(digit[1]) - 1]); return; }
    if (ev.shiftKey && ev.code === "KeyI" && ((mod && !ev.altKey) || (ev.altKey && !mod))) { ev.preventDefault(); edInspector(); }
  });
  app.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && app.querySelector && app.querySelector(".pk")) { var pe2 = pgOf(); if (pe2) { pe2.picker2 = null; edPatch(); } } });
  // A right click on a row of the list opens its menu.
  app.addEventListener("contextmenu", function (ev) {
    var row = ev.target.closest && ev.target.closest(".ed-left .sec[data-where]"); if (!row || state.tab !== "pages") return;
    var w = row.dataset.where; if (!(isSecList(w) || w === "shared") || (w === "tpl" && row.dataset.id === "main")) return;
    var pgd = pgOf(); if (!pgd) return;
    ev.preventDefault(); ctxOpen(pgd, row, ev.clientX, ev.clientY);
  });
  app.addEventListener("focusout", function (ev) { if (ev.target && ev.target.id === "ed-rename" && state.renaming) setTimeout(function () { if (state.renaming) renameDone(true); }, 0); if (ev.target && ev.target.id === "tpl-rename" && state.tplRename) setTimeout(function () { if (state.tplRename) tplRenameDone(true); }, 0); });
  app.addEventListener("input", function (ev) {
    if (ev.target.id === "tpl-new-name") {
      var pnn = pgOf(); if (!pnn || !pnn.tplNew) return; pnn.tplNew.name = ev.target.value;
      var all = tplAll(pnn, pnn.tplNew.kind), v = ev.target.value.trim().toLowerCase(), clash = !!v && Object.keys(all).some(function (id) { return String(all[id].name || "").toLowerCase() === v; });
      var cn = app.querySelector("#tpl-new-count"), go = app.querySelector("#tpl-new-go"), cl = app.querySelector("#tpl-new-clash");
      if (cn) cn.textContent = ev.target.value.length + " of 25"; if (go) go.disabled = !v || clash; if (cl) cl.hidden = !clash;
      return;
    }
    if (ev.target.id === "tpl-ex-q") {
      var xq = ev.target.value.trim().toLowerCase();
      Array.prototype.forEach.call(app.querySelectorAll(".tpl-pop .pp-item"), function (b) { b.hidden = !!xq && b.dataset.q.indexOf(xq) < 0; });
      return;
    }
    if (ev.target.id === "pp-q") {
      var pq = ev.target.value.trim().toLowerCase(), pop = ev.target.closest(".pp"), hits = 0; if (!pop) return;
      pop.querySelector(".pp-lvl").hidden = !!pq; pop.querySelector(".pp-all").hidden = !pq;
      Array.prototype.forEach.call(pop.querySelectorAll(".pp-all .pp-item"), function (b) { var hit = !!pq && b.dataset.q.indexOf(pq) >= 0; b.hidden = !hit; if (hit) hits++; });
      pop.querySelector(".pp-none").hidden = !pq || hits > 0;
      return;
    }
    if (ev.target.dataset && ev.target.dataset.pickQ) {
      var words = ev.target.value.trim().toLowerCase(), any = false;
      Array.prototype.forEach.call(app.querySelectorAll(".pk-grp"), function (g) { var shown = 0; Array.prototype.forEach.call(g.querySelectorAll(".pk-item"), function (b) { var hit = !words || b.dataset.words.indexOf(words) >= 0; b.hidden = !hit; if (hit) shown++; }); if (words && g.dataset.most) shown = 0; g.hidden = !shown; if (shown) any = true; });
      var none = app.querySelector(".pk-none"); if (none) none.hidden = any;
      var firstHit = app.querySelector(".pk-item:not([hidden]):not([disabled])"); if (firstHit) pickerHover(firstHit);
      return;
    }
    var ed = ev.target.closest && ev.target.closest("[data-rich]");
    if (ed && ed.dataset.pfRich) { var pe = pgOf(), es = pe && pgSel(pe); if (es && rich[ed.dataset.rich]) { rich[ed.dataset.rich].dirty = true; pgSet(es.sec.settings, ed.dataset.rich, richOut(ed, rich[ed.dataset.rich].keep, false)); pe.what = "Edit " + (es.kind ? es.kind.label : es.id); pgMark(pe); patchEdTop(); pushSoon(); } return; }
    if (ed) { state.dirty = true; if (rich[ed.dataset.rich]) rich[ed.dataset.rich].dirty = true; return; }
    if (ev.target.dataset && ev.target.dataset.css) {
      var pc3 = pgOf(), sc3 = pc3 && pgSel(pc3); if (!sc3) return;
      if (ev.target.value.trim()) sc3.sec.css = ev.target.value; else delete sc3.sec.css;
      var gut = ev.target.parentNode.querySelector(".gut"); if (gut) gut.textContent = gutter(ev.target.value);
      ev.target.rows = Math.max(6, ev.target.value.split("\n").length + 1);
      pc3.what = "Custom CSS: " + secName(pc3, sc3.sec); pgMark(pc3); patchEdTop(); pushSoon(); return;
    }
    if (ev.target.dataset && ev.target.dataset.resQ) {
      var rq2 = ev.target.value.trim().toLowerCase(), rany = false;
      Array.prototype.forEach.call(app.querySelectorAll(".resitems .pp-item"), function (b) { var hit = !rq2 || b.dataset.q.indexOf(rq2) >= 0; b.hidden = !hit; if (hit) rany = true; });
      var rn = app.querySelector(".rnone"); if (rn) rn.hidden = rany; return;
    }
    if (ev.target.dataset && ev.target.dataset.libQ) { var plq = pgOf(); if (plq && plq.lib) { plq.lib.q = ev.target.value; libFilter(); } return; }
    if (ev.target.dataset && ev.target.dataset.hue) { var ph3 = pgOf(); if (!ph3 || !ph3.colourHsv) return; ph3.colourHsv.h = Number(ev.target.value); setColour(ev.target.dataset.hue, hsvToHex(ph3.colourHsv.h, ph3.colourHsv.s, ph3.colourHsv.v), true); return; }
    if (ev.target.dataset && ev.target.dataset.input === "fontq") {
      var fq = ev.target.value.trim().toLowerCase(), fany = false;
      Array.prototype.forEach.call(app.querySelectorAll(".fontpick .fontopt"), function (b) { var hit = !fq || b.dataset.q.indexOf(fq) >= 0; b.hidden = !hit; if (hit) fany = true; });
      Array.prototype.forEach.call(app.querySelectorAll(".fontpick .sub"), function (h) { h.hidden = !!fq; });
      var fno = app.querySelector(".fontpick .fnone"); if (fno) fno.hidden = fany; return;
    }
    if (ev.target.dataset && ev.target.dataset.siteWord) {
      var pw = pgOf(); if (!pw || !pw.site || !pw.site.site) return;
      pw.site.site[ev.target.dataset.siteWord] = ev.target.value; pw.what = "Edit site details"; pgMark(pw); patchEdTop(); pushSoon(); return;
    }
    if (ev.target.dataset && ev.target.dataset.linkq) { pgInput(ev.target); linkList(ev.target); var lt3 = ev.target.parentNode.parentNode.querySelector(".ltag"), pl3 = pgOf(); if (lt3 && pl3) lt3.outerHTML = linkTag(pl3, ev.target.value); return; }
    if (ev.target.dataset && ev.target.dataset.pf) { pgInput(ev.target); return; }
    var t = ev.target, field;
    if (!t.dataset) return;
    if (t.dataset.field) { state.dirty = true; return; }
    if (t.dataset.input === "csearch") { state.csearch = t.value; filterList(); return; }
    if (t.dataset.input === "copy-name") { state.copyName = t.value; return; }
    if (t.dataset.themeColour || t.dataset.themeHex) {
      var th = themeOf(), id = t.dataset.themeColour || t.dataset.themeHex, v = t.value.trim();
      if (!th || !validHex(v)) return;
      th.draft.colours[id] = v.toUpperCase();
      var row = t.closest(".swrow"), other = row && row.querySelector(t.dataset.themeColour ? "[data-theme-hex]" : "[data-theme-colour]"), sw = row && row.querySelector(".sw");
      if (other) other.value = t.dataset.themeColour ? v.toUpperCase() : v.toLowerCase();
      if (sw) sw.style.background = v;
      themeWarnings(th); patchIsland(); applyPreview(); return;
    }
    if (t.dataset.input === "fadd-alt" || t.dataset.input === "fadd-cap") {
      var fa = state.fileAdd[Number(t.dataset.i)]; if (!fa) return;
      fa[t.dataset.input === "fadd-alt" ? "alt" : "caption"] = t.value;
      var ok = state.fileAdd.every(function (p) { return p.alt.trim(); }), sb2 = app.querySelector('[data-act="files-send"]'); if (sb2) sb2.disabled = !ok || state.status === "saving";
      return;
    }
    field = { "photo-note": "note", "photo-alt": "alt", "photo-caption": "caption" }[t.dataset.input];
    if (!field) return;
    var p = state.photoFiles[Number(t.dataset.i)]; if (!p) return;
    p[field] = t.value;
    var ready = state.photoFiles.every(photoReady), btn = app.querySelector('[data-act="photo-send"]'), hint = app.querySelector("#photo-hint");
    if (btn) btn.disabled = !ready || !!state.busy.photo;
    if (hint) hint.style.display = ready ? "none" : "";
  });

  // A photo saved on the live site appears there a minute or two later. Until then, say so.
  app.addEventListener("error", function (ev) { var im = ev.target, box = im && im.tagName === "IMG" && im.parentNode; if (box && box.classList && (box.classList.contains("fthumb") || box.classList.contains("pictile"))) box.classList.add("waiting"); }, true);

  app.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var form = ev.target;
    if (form.dataset.form === "entry") { saveEntry(form); return; }
    if (form.dataset.form === "invite") {
      var ie = form.querySelector('[name="email"]').value.trim(), inm = form.querySelector('[name="name"]').value.trim(), isites = formSites(form);
      peopleOf().draft = { email: ie, name: inm, sites: isites };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ie)) { state.notice = { text: "Please type their email address.", problem: true }; render(); return; }
      if (!isites.length) { state.notice = { text: "Tick at least one site, so they have something to work on.", problem: true }; render(); return; }
      peopleDo("invitePerson", { email: ie, name: inm, sites: isites, back: signinBack() }, function (d) { return d.emailed === false ? "Added, but the sign-in email could not be sent just now. Use Send the sign-in email again." : "Sent. They appear as invited until they first sign in."; },
        function () { var pk3 = peopleOf(); pk3.mode = ""; pk3.draft = null; pk3.sel = ie.toLowerCase(); });
      return;
    }
    if (form.dataset.form === "person") {
      peopleDo("updatePerson", { email: form.dataset.email, name: form.querySelector('[name="name"]').value.trim(), sites: formSites(form) }, "Saved. It works from their next click.");
      return;
    }
    if (form.dataset.form === "ednew") { makeNew(form); return; }
    if (form.dataset.form === "fdesc") {
      var dn = form.dataset.name, dalt = form.querySelector('[name="alt"]').value.trim(), dcap = form.querySelector('[name="caption"]').value.trim();
      filesWrite("The description of " + dn, { op: "describe", name: dn, alt: dalt, caption: dcap }, null, "Description saved"); return;
    }
    if (form.dataset.form === "fassign") {
      var aalt = form.querySelector('[name="alt"]').value.trim(), fs0 = filesOf(), spot = fs0 && fs0.spots.find(function (x) { return x.key === form.dataset.key; });
      if (!aalt) { state.notice = { text: "Please describe the picture first. It is read out to people who cannot see it.", problem: true }; render(); return; }
      filesWrite("The picture of " + (spot ? spot.label : "this place"), { op: "assign", name: form.dataset.name, spot: form.dataset.key, alt: aalt }, null, "Picture put in place"); return;
    }
    if (form.dataset.form === "copy") { var nm = form.querySelector("#copy-name"); makeCopy(nm ? nm.value.trim() : ""); return; }
    if (form.dataset.form === "signin") {
      state.email = form.email.value.trim();
      var usePassword = state.signinMode === "password", password = usePassword ? form.password.value : "";
      state.busy.signin = true; state.notice = null; render();
      var res = usePassword
        ? await sb.auth.signInWithPassword({ email: state.email, password: password })
        : await sb.auth.signInWithOtp({ email: state.email, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
      delete state.busy.signin;
      if (res.error) state.notice = { text: signinProblem(res.error, usePassword), problem: true };
      else if (!usePassword) state.signinSent = true;
      render();
    }
  });

  // ---------- sample data, used until the console is connected ----------

  var demoContent = [
    { id: "articles", label: "Articles", singular: "article", canHide: true, canDelete: true, entries: [
      { id: "a1", title: "[Sample] How to look at a painting", sub: "Looking", hidden: false, fields: [{ name: "title", label: "Title", type: "text", value: "[Sample] How to look at a painting" }, { name: "dek", label: "Summary line", type: "long", value: "A short sample summary that shows how a longer piece of text is edited in the console, in a box that grows." }, { name: "minutes", label: "Reading time, minutes", type: "number", value: 6 }, { name: "body", label: "Body", type: "long", value: '<p>Start with the whole picture before the detail. Give it a full minute.<sup class="cite"><a data-src="sample-1">[sample-1]</a></sup></p>\n<h2>Then move closer</h2>\n<p>Look for where the paint is <strong>thick</strong> and where it is thin, and read the <a href="#guides">collecting guides</a> for more.</p>\n<ul><li>Stand back.</li><li>Step in.</li></ul>\n<div class="callout"><strong>Try it</strong>Pick one small area and count the separate marks in it.</div>\n[[TIMELINE:zara-muse]]' }] },
      { id: "a2", title: "[Sample] Original or print", sub: "Collecting", hidden: true, fields: [{ name: "title", label: "Title", type: "text", value: "[Sample] Original or print" }] }] },
    { id: "artists", label: "Artists", singular: "artist", canHide: false, canDelete: false, entries: [
      { id: "zara-muse", title: "Zara Muse", sub: "Portraiture, London", hidden: false, fields: [{ name: "name", label: "Name", type: "text", value: "Zara Muse" }, { name: "published", label: "Shown on the site", type: "yesno", value: true }, { name: "ghostWords", label: "Large background words", type: "lines", value: ["Knives,", "not", "brushes."] }, { name: "glance.0.1", label: "Based in", type: "text", value: "London", group: "At a glance" }, { name: "glance.1.1", label: "Gallery", type: "long", value: '<span class="placeholder">[Gallery relationship to confirm]</span>', group: "At a glance" }, { name: "sections.0.title", label: "Biography: title", type: "text", value: "Biography", group: "Portfolio sections" }, { name: "sections.0.html", label: "Biography: text", type: "long", value: '<p>A sample biography paragraph, with a source at the end.<sup class="cite"><a data-src="sample-1">[sample-1]</a></sup></p>\n<p>A second paragraph, with a <strong>bold</strong> word in it.</p>', group: "Portfolio sections" }, { name: "timeline.0.when", label: "1: when", type: "text", value: "2019", group: "Timeline" }, { name: "timeline.0.what", label: "1: what happened", type: "text", value: "A sample event in the timeline.", group: "Timeline" }] }] },
    { id: "sources", label: "Sources", singular: "source", canHide: false, canDelete: false, entries: [] },
  ];
  // Example versions for sample mode: 1.0 when versions began, then a few publishes.
  var demoVersions = {};
  function demoVersionsOf(id) {
    if (demoVersions[id]) return demoVersions[id];
    var day = function (n) { return new Date(Date.now() - n * 86400000).toISOString(); };
    var list = [["1.3", "Sam Taylor", 1, "Add section: Visit us\n- Edit: Opening hours"], ["1.2", "You", 4, "Edit article: Zara Muse profile"], ["1.1", "Sam Taylor", 6, "Add photo: gallery-front.jpg"], ["1.0", "You", 9, "The site as it was when versions began."]];
    return (demoVersions[id] = list.map(function (x, i) { return { number: x[0], title: x[0] === "1.0" ? "where versions began" : "", by: x[1], when: day(x[2]), live: i === 0, big: x[0] === "1.0", notes: "Published by " + (x[1] === "You" ? "the admin" : "Sam") + ".\n\nWhat changed:\n- " + x[3] }; }));
  }
  function demoNext(list, big) { var t = (list[0] ? list[0].number : "0.0").split(".").map(Number); return big ? (t[0] + 1) + ".0" : t[0] + "." + (t[1] + 1); }
  // Example people for sample mode. The addresses are made up.
  var demoPeople = [
    { email: "sam@example.org", name: "Sam Taylor", sites: ["world-art-review", "global-art-monitor"], invited: "2026-11-02T10:00:00Z", lastSeen: "2026-11-10T14:20:00Z" },
    { email: "kit@example.org", name: "", sites: ["global-art-monitor"], invited: "2026-11-12T09:30:00Z", lastSeen: null }
  ];
  var demoData = { user: { email: "sample" }, sites: [
    { id: "world-art-review", name: "World Art Review", domain: "worldartreview.com", live: true, files: true, edits: true, artists: [], inbox: [],
      slots: [{ id: "artist-zara-muse", group: "Artist main images", label: "Zara Muse", filled: true, waiting: false }, { id: "artist-konn-artiss", group: "Artist main images", label: "Konn Artiss", filled: false, waiting: false }, { id: "article-sample", group: "Articles", label: "[Sample] An article", filled: false, waiting: false }] },
    { id: "global-art-monitor", name: "Global Art Monitor", domain: "globalartmonitor.com", live: true, files: true, edits: true, artists: [], inbox: ["slot--artist-zara-muse.jpg"],
      slots: [{ id: "artist-zara-muse", group: "Artist profile images", label: "Zara Muse", filled: false, waiting: true }, { id: "artist-konn-artiss", group: "Artist profile images", label: "Konn Artiss", filled: true, waiting: false }] },
    { id: "street-art-dispatch", name: "Street Art Dispatch", domain: "streetartdispatch.com", live: true, files: true, edits: true, artists: [], inbox: [], slots: [] },
    { id: "site-4", name: "Site 4", domain: "", live: false }, { id: "site-5", name: "Site 5", domain: "", live: false },
    { id: "practice-site", name: "Practice site", domain: "artiscope.github.io/practice-site", live: true, files: true, edits: true, practice: true, artists: [], inbox: [], slots: [] },
  ] };
  var demoHistory = [
    { sha: "a".repeat(40), what: "Edit article: [Sample] How to look at a painting", when: new Date().toISOString(), by: "you", canUndo: true },
    { sha: "b".repeat(40), what: "[Sample] An earlier change made outside the console", when: new Date(Date.now() - 86400000).toISOString(), by: "", canUndo: false },
  ];
  var demoThemeExtra = {"settings":[{"name":"h_size","group":"Headings","label":"Size","type":"range","min":70,"max":140,"step":5,"unit":"%","dflt":100,"reset":true},{"name":"h_track","group":"Headings","label":"Letter spacing","type":"range","min":-5,"max":20,"step":1,"unit":"%","dflt":0,"reset":true,"hint":"Space between letters, as a share of the letter size."},{"name":"h_lh","group":"Headings","label":"Line height","type":"range","min":85,"max":180,"step":5,"unit":"%","dflt":110,"reset":true},{"name":"h_caps","group":"Headings","label":"Capital letters","type":"yesno"},{"name":"b_size","group":"Body text","label":"Size","type":"range","min":80,"max":130,"step":5,"unit":"%","dflt":100,"reset":true},{"name":"b_track","group":"Body text","label":"Letter spacing","type":"range","min":-3,"max":10,"step":1,"unit":"%","dflt":0,"reset":true},{"name":"b_lh","group":"Body text","label":"Line height","type":"range","min":120,"max":210,"step":5,"unit":"%","dflt":160,"reset":true},{"name":"nav_font","group":"Navigation","label":"Typeface of the menu","type":"choice","options":[["","Site's own"],["body","Body text"],["heading","Headings"]]},{"name":"nav_size","group":"Navigation","label":"Size","type":"range","min":80,"max":130,"step":5,"unit":"%","dflt":100,"reset":true},{"name":"nav_caps","group":"Navigation","label":"Capital letters","type":"yesno"},{"name":"dir","group":"Language","label":"Text direction","type":"choice","options":[["ltr","Left to right"],["rtl","Right to left"]],"hint":"Right to left is for languages such as Arabic and Hebrew."},{"name":"corners","group":"Design","label":"Corners","type":"choice","options":[["","Site's own"],["square","Square"],["round","Round"]],"hint":"Buttons, boxes and pictures."},{"name":"buttons","group":"Design","label":"Button style","type":"choice","options":[["","Filled"],["outline","Outline"]]},{"name":"social_instagram","group":"Social media","label":"Instagram","type":"text","social":true,"hint":"For example https://www.instagram.com/yourname"},{"name":"social_x","group":"Social media","label":"X","type":"text","social":true,"hint":"For example https://x.com/yourname"},{"name":"social_linkedin","group":"Social media","label":"LinkedIn","type":"text","social":true,"hint":"For example https://www.linkedin.com/company/yourname"},{"name":"social_facebook","group":"Social media","label":"Facebook","type":"text","social":true,"hint":"For example https://www.facebook.com/yourname"},{"name":"social_pinterest","group":"Social media","label":"Pinterest","type":"text","social":true,"hint":"For example https://www.pinterest.com/yourname"},{"name":"social_youtube","group":"Social media","label":"YouTube","type":"text","social":true,"hint":"For example https://www.youtube.com/@yourname"},{"name":"social_tiktok","group":"Social media","label":"TikTok","type":"text","social":true,"hint":"For example https://www.tiktok.com/@yourname"},{"name":"favicon","group":"Favicon","label":"Favicon","type":"image","hint":"Shown at 32 by 32 pixels in the browser tab. A square picture works best."},{"name":"crumbs","group":"Extras","label":"Show breadcrumbs","type":"yesno","only":"crumbs","hint":"The trail of links at the top of an article, such as Home, Art Explained."},{"name":"css","group":"Custom CSS","label":"Custom CSS","type":"code"}],"look":{"head":"#main h1, #main h2, #main h3, #main h4","body":"#main p, #main li, #main dd, #main blockquote","nav":".hdr .left a, .hdr .right a, .hdr .right button","bodyFont":"var(--text)","headFont":"var(--display)","buttons":".btn","band":"var(--green)","round":".btn, .mf input, .mf select, .mf textarea, #main img","crumbs":".crumbs"}};
  var demoTheme = {
    spec: {
      url: "https://worldartreview.com/",
      colours: [
        { id: "paper", role: "bg", label: "Page background", use: "Pages and cards", var: "--paper", default: "#EEE5D4", derived: [["--paper-deep", 94, "black"]] },
        { id: "green", role: "band", label: "Bands and buttons", use: "Top band, buttons and labels", var: "--green", default: "#1D4A35", on: "paper", min: 3, derived: [["--green-dark", 78, "black"]] },
        { id: "brick", role: "accent", label: "Links and highlights", use: "Links and small accents", var: "--brick", default: "#B5392B", on: "paper", min: 3, derived: [] },
        { id: "ink", role: "text", label: "Text", use: "All reading text", var: "--ink", default: "#1D1D1B", on: "paper", min: 4.5, derived: [] },
      ],
      fonts: [
        { id: "display", role: "display", label: "Headlines", use: "Site name and titles", var: "--display", default: "Castoro", fallback: "Georgia, serif", options: ["Castoro", "Libre Caslon Display", "Cormorant Garamond", "EB Garamond"] },
        { id: "text", role: "body", label: "Reading text", use: "Articles and portfolios", var: "--text", default: "Literata", fallback: "Georgia, serif", options: ["Literata", "Source Serif 4", "EB Garamond"] },
        { id: "sans", role: "small", label: "Small text", use: "Buttons, labels and menus", var: "--sans", default: "Libre Franklin", fallback: "Arial, sans-serif", options: ["Libre Franklin", "Work Sans", "Karla"] },
      ],
      looks: [{ name: "Ink and clay", colours: { paper: "#F1EEE8", green: "#22304A", brick: "#A4572F", ink: "#1B1D22" } }, { name: "Bark and moss", colours: { paper: "#EFEAE4", green: "#3B2F2A", brick: "#5F7A3C", ink: "#1F1B19" } }],
      fontRequests: { "Castoro": "Castoro:ital@0;1", "Libre Caslon Display": "Libre+Caslon+Display", "Cormorant Garamond": "Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400", "EB Garamond": "EB+Garamond:ital,wght@0,400;0,500;0,600;1,400", "Literata": "Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;1,7..72,400", "Source Serif 4": "Source+Serif+4:ital,wght@0,400;0,500;0,600;1,400", "Libre Franklin": "Libre+Franklin:wght@400;500;600", "Work Sans": "Work+Sans:wght@400;500;600", "Karla": "Karla:wght@400;500;600" },
    },
    values: { colours: { paper: "#EEE5D4", green: "#1D4A35", brick: "#B5392B", ink: "#1D1D1B" }, fonts: { display: "Castoro", text: "Literata", sans: "Libre Franklin" } },
  };
  // Sample mode keeps its own pretend copies, so every button can be tried.
  var demoCopies = {};
  function demoList(id) { return demoCopies[id] || (demoCopies[id] = [{ id: "live", kind: "live", name: "Live site", ahead: 0, behind: 0, since: "", steps: [], canRedo: false, preview: "", redo: [] }]); }
  function demoCopy(body) { var l = demoList(body.site); return l.find(function (c) { return c.id === body.copy; }) || l[0]; }
  function demoStep(body, what) { var c = demoCopy(body); c.steps.unshift({ what: what, when: new Date().toISOString(), by: "sample" }); c.ahead = c.kind === "live" ? 0 : c.steps.length; c.redo = []; c.canRedo = false; }
  var DEMO_STEPS = { savePages: "Edit page: sample change", saveEntry: "Edit: sample entry", setHidden: "Hide or show: sample entry", deleteEntry: "Delete: sample entry", removePhoto: "Remove photo", uploadPhoto: "Add photo", saveTheme: "Theme: sample change", undo: "Undo: an earlier change" };
  // Sample pages for sample mode, generated from the server by tests/pages.mjs helpers.
  var demoKinds = {"opening":{"label":"Opening screen","about":"The short screen shown while the site loads.","fields":[{"name":"name","label":"Site name","type":"text","hint":"Shown beside the logo."},{"name":"tagline","label":"Tagline","type":"text","hint":"Small words under the name."}],"library":"","starter":null},"header":{"label":"Menu bar","about":"The bar at the top of every page.","fields":[{"name":"name","label":"Site name","type":"text","hint":"Shown in the middle of the bar."},{"name":"links","label":"Links","type":"rows","fields":[{"name":0,"label":"Words","type":"text","hint":"What visitors see."},{"name":1,"label":"Address","type":"text","hint":"A page on this site starts with #, for example #artists. Or paste a full web address."}]},{"name":"logos","label":"Logos","type":"rows","fields":[{"name":"image","label":"Logo","type":"image","alt":"alt","button":"Upload a logo","hint":"A PNG with a clear background works best."},{"name":"alt","label":"Name, read aloud to people who cannot see it","type":"text","hint":"For example Grove Gallery."},{"name":"size","label":"Size","type":"choice","seg":true,"dflt":"M","options":[["S","Small"],["M","Medium"],["L","Large"]]},{"name":"place","label":"Place in the menu bar","type":"choice","seg":true,"options":[["L","Left"],["C","Centre"],["R","Right"]]},{"name":"href","label":"Opens when clicked","type":"text","addr":true,"hint":"A page on this site such as #home, or a full web address starting https://. Leave empty for no link."}]}],"library":"","starter":null,"blocks":[{"field":"links","label":"Link","add":"Add a link","about":"A link on the left of the menu bar."},{"field":"logos","label":"Logo","add":"Add a logo","about":"A logo in the menu bar. Add more than one, for example the gallery's beside the site's."}]},"footer":{"label":"Newsletter and footer","about":"The sign-up band and the links at the bottom of every page.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"button","label":"Button words","type":"text","hint":"The button opens the sign-up form."},{"name":"blurb","label":"Short description of the site","type":"long","hint":"Shown under the name, at the bottom left."},{"name":"columns","label":"Link columns","type":"rows","fields":[{"name":"title","label":"Column title","type":"text","hint":"A short word or two, such as Read."},{"name":"links","label":"Links in this column","type":"rows","fields":[{"name":0,"label":"Words","type":"text","hint":"What visitors see."},{"name":1,"label":"Address","type":"text","hint":"A page on this site starts with #, for example #artists. Or paste a full web address."}]}]},{"name":"copyright","label":"Copyright line","type":"text"},{"name":"elsewhere","label":"Links in the bottom bar","type":"rows","fields":[{"name":0,"label":"Words","type":"text","hint":"What visitors see."},{"name":1,"label":"Address","type":"text","hint":"A page on this site starts with #, for example #artists. Or paste a full web address."}]}],"library":"","starter":null,"blocks":[{"field":"columns","label":"Column","add":"Add a column","about":"","blocks":[{"field":"links","label":"Link","add":"Add a link","about":"One link in this column: its words and where it goes."}]}]},"hero":{"label":"Opening banner","about":"The large green band, usually at the top of the home page. On another page it takes the place of the menu bar.","fields":[{"name":"headline","label":"Headline","type":"rows","hint":"Each line of the large headline. Italic lines are set in the slanted style.","fields":[{"name":"t","label":"Words","type":"text"},{"name":"ital","label":"In italics","type":"yesno"}]},{"name":"tagline","label":"Tagline","type":"rows","hint":"The smaller words at the bottom left of the banner.","fields":[{"name":"t","label":"Words","type":"text"},{"name":"ital","label":"In italics","type":"yesno"}]},{"name":"image","label":"Main picture","type":"image","alt":"alt","hint":"Leave empty to show the picture of the artist chosen below. A picture here is used in this banner only."},{"name":"alt","label":"Describe the picture","type":"text","hint":"Read aloud to people who cannot see it."},{"name":"credit","label":"Credit under the picture","type":"text","hint":"For example the title of the work and the photographer. Leave empty for none."},{"name":"artist","label":"Whose work is shown","type":"artists","one":true,"hint":"Leave empty for the first published artist. Their name and details sit beside the picture."},{"name":"rule_label","label":"Rule box, small line","type":"text","hint":"The box at the bottom right of the banner."},{"name":"rule_text","label":"Rule box, text","type":"text"},{"name":"rule_link","label":"Rule box, link words","type":"text","hint":"The link opens the page about sources."},{"name":"latest","label":"Pieces in the Latest box","type":"lines","hint":"Article names as they appear in web addresses, for example zara-muse-profile."},{"name":"hide_picture","label":"Hide the picture","type":"yesno","internal":true},{"name":"hide_rule","label":"Hide the rule box","type":"yesno","internal":true}],"library":"","starter":null,"blocks":[{"field":"headline","label":"Headline line","add":"Add a headline line","about":"One line of the large headline."},{"field":"picture","label":"Picture","add":"","about":"The picture on the right of the banner, with the artist's details beside it.","one":true,"hide":"hide_picture","fields":["image","alt","credit","artist"]},{"field":"tagline","label":"Tagline line","add":"Add a tagline line","about":"One line of the smaller words at the bottom left."},{"field":"latest","label":"Latest box piece","add":"Add a piece","about":"One piece shown in turn in the Latest box.","item":{"name":null,"label":"Piece","type":"piece"}},{"field":"rule","label":"Rule box","add":"","about":"The box at the bottom right of the banner.","one":true,"hide":"hide_rule","fields":["rule_label","rule_text","rule_link"]}]},"featured":{"label":"Featured artists","about":"The artist carousel under the banner. With no artists added, every published artist is shown.","fields":[{"name":"badge","label":"Badge words","type":"text","hint":"Under the number in the small square."},{"name":"artists","label":"Which artists","type":"artists","hint":"Tick the artists to show, in the order ticked. Leave all empty to show every published artist."}],"library":"","starter":null,"blocks":[{"field":"artists","label":"Artist","add":"Add an artist","about":"One artist in the carousel, in this order.","item":{"name":null,"label":"Which artist","type":"artists","one":true}}]},"section-list":{"label":"Read by section","about":"A list of the parts of the site, each with a count.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"rows","label":"Rows","type":"rows","fields":[{"name":"n","label":"Number","type":"text","hint":"Shown small on the left, such as 01."},{"name":"name","label":"Name","type":"text"},{"name":"desc","label":"Description","type":"text","hint":"One short sentence."},{"name":"href","label":"Address","type":"text","hint":"Where the row leads. A page on this site starts with #."},{"name":"count","label":"Count shown","hint":"The number on the right is counted for you.","type":"choice","options":[["artists","Artists"],["reviews","Reviews"],["explained","Art explained pieces"],["library","Library guides"],["articles","All articles"],["sources","Sources"]]},{"name":"unit","label":"Count word","type":"text"}]}],"library":"","starter":null,"blocks":[{"field":"rows","label":"Row","add":"Add a row","about":""}]},"explained":{"label":"Art, explained","about":"Two Art Explained articles beside a short introduction.","fields":[{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"text","label":"Text","type":"long","plain":true,"hint":"One or two sentences."},{"name":"count","label":"How many articles","type":"number","hint":"The newest Art Explained articles are shown."}],"library":"","starter":null},"numbers":{"label":"Numbers band","about":"Four figures counted from the site.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"labels","label":"The four labels","type":"lines","hint":"One label per line. The numbers are counted for you."}],"library":"Figures from the site, in a band","starter":{"eyebrow":"The review so far","heading":["Research you","can check"],"labels":["Artists documented","Articles and reviews","Sources cited","Facts with a numbered source"]}},"method":{"label":"How we research","about":"Three cards explaining the method.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"cards","label":"Cards","type":"rows","fields":[{"name":"n","label":"Number","type":"text","hint":"Shown large at the top of the card."},{"name":"title","label":"Title","type":"text","hint":"Shown in bold at the foot of the card."},{"name":"text","label":"Text","type":"long","hint":"Two or three short sentences read best."},{"name":"sub","label":"Small line","type":"text","hint":"Grey text under the title. Leave empty to hide."}]}],"library":"Three cards in a row","starter":{"eyebrow":"How we research","heading":["The work first,","then the story"],"cards":[{"n":"1","text":"Write here.","title":"A title","sub":"A small line"}]},"blocks":[{"field":"cards","label":"Card","add":"Add a card","about":""}]},"text":{"label":"Text","about":"A heading and a few paragraphs.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"body","label":"Text","type":"long","hint":"Type as you would in a document."},{"name":"align","label":"Placing","type":"choice","group":"Look","options":[["","Left"],["centre","Centred"]]},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"A heading and paragraphs","starter":{"eyebrow":"","heading":["A new heading"],"body":"<p>Write here.</p>","align":"","bg":"paper","fg":""}},"text-picture":{"label":"Text with picture","about":"Words on one side, a photo on the other.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"body","label":"Text","type":"long"},{"name":"image","label":"Picture","type":"image","alt":"alt"},{"name":"alt","label":"Describe the picture","type":"text","hint":"For people who cannot see it. Needed before you save."},{"name":"caption","label":"Caption","type":"text","hint":"Small text under the picture. Leave empty to hide."},{"name":"side","group":"Look","label":"Picture on the","type":"choice","options":[["right","Right"],["left","Left"]]},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"Words beside a photo","starter":{"eyebrow":"","heading":["A new heading"],"body":"<p>Write here.</p>","image":"","alt":"","caption":"","side":"right","bg":"paper","fg":""}},"picture":{"label":"Picture","about":"One large photo with a caption.","fields":[{"name":"image","label":"Picture","type":"image","alt":"alt"},{"name":"alt","label":"Describe the picture","type":"text","hint":"For people who cannot see it. Needed before you save."},{"name":"caption","label":"Caption","type":"text","hint":"Small text under the picture. Leave empty to hide."},{"name":"size","group":"Look","label":"Width","type":"choice","options":[["","Full width"],["contained","Contained"]]},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."}],"library":"One large photo, with a caption","starter":{"image":"","alt":"","caption":"","size":"","bg":"paper"}},"quote":{"label":"Quote","about":"One line, shown large.","fields":[{"name":"text","label":"The quote","type":"lines","hint":"Each line of the quote on its own line."},{"name":"who","label":"Who said it","type":"text","hint":"Leave empty to hide."},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"A short line that stands out","starter":{"text":["A line worth remembering."],"who":"","bg":"green","fg":""}},"articles":{"label":"Latest articles","about":"Article cards, filled in from Content.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"section","label":"Which articles","type":"choice","options":[["all","All"],["reviews","Reviews"],["explained","Art explained"],["library","Collector's library"],["features","Artist portfolios"]]},{"name":"count","label":"How many","type":"number"},{"type":"info","text":"The cards are filled in from your articles, so their words and pictures are changed there, not here.","go":"content","goLabel":"Open Content"},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"Fills itself from Content","starter":{"eyebrow":"Latest","heading":["Recent pieces"],"section":"all","count":3,"bg":"paper","fg":""}},"faq":{"label":"Questions and answers","about":"Questions that open to show their answer.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"items","label":"Questions","type":"rows","fields":[{"name":"q","label":"Question","type":"text","hint":"Keep it short. Visitors click it to open the answer."},{"name":"a","label":"Answer","type":"long"}]},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"A list that opens and closes","starter":{"eyebrow":"","heading":["Questions"],"items":[{"q":"A question?","a":"<p>The answer.</p>"}],"bg":"paper","fg":""},"blocks":[{"field":"items","label":"Question","add":"Add a question","about":""}]},"button":{"label":"Button or link","about":"A heading, a line and one button.","fields":[{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"text","label":"Text","type":"text"},{"name":"label","label":"Button words","type":"text"},{"name":"href","label":"Where it goes","type":"text","hint":"A page on this site starts with #, or a full web address."},{"name":"style","label":"Style","type":"choice","group":"Look","options":[["green","Green"],["paper","Paper"],["outline","Outline"]]},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"Send visitors somewhere","starter":{"heading":["Find out more"],"text":"","label":"Read on","href":"#artists","style":"green","bg":"paper","fg":""}},"page-heading":{"label":"Page heading","about":"The heading at the top of a page.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"intro","label":"Introduction","type":"long","plain":true}],"library":"A page's heading and introduction","starter":{"eyebrow":"A small line","heading":["A new","page"],"intro":""}},"long-text":{"label":"Long text","about":"Headings and paragraphs, in the narrow reading column.","fields":[{"name":"body","label":"Text","type":"long","cite":false,"hint":"Type as you would in a document. Grey square brackets mark wording still to be added."}],"library":"Headings and paragraphs to read","starter":{"body":"<h2>A heading</h2><p>Write here.</p>"}},"announcement":{"label":"Announcement bar","about":"A thin band with a short message. With more than one message they take turns. As the first section on a page it sits above the menu bar.","fields":[{"name":"messages","label":"Messages","type":"rows","fields":[{"name":"text","label":"Message","type":"text","hint":"One short sentence."},{"name":"link","label":"Link words","type":"text","hint":"Leave empty for no link."},{"name":"href","label":"Where the link goes","type":"text","addr":true,"hint":"A page on this site starts with #, such as #artists, or a full web address starting https://."}]},{"name":"seconds","label":"Seconds before the next message","type":"range","min":3,"max":30,"step":1,"unit":"s","dflt":6,"group":"Look","hint":"Only used with more than one message."},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"A short message in a thin band","starter":{"messages":[{"text":"A short message for visitors.","link":"","href":""}],"seconds":6,"bg":"green","fg":""},"blocks":[{"field":"messages","label":"Message","add":"Add a message","about":"One message in the bar. With more than one, they take turns."}]},"columns":{"label":"Columns","about":"Two to four columns side by side, each with a title, a few words and a link. On a phone they stack.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"columns","label":"Columns","type":"rows","fields":[{"name":"title","label":"Title","type":"text"},{"name":"text","label":"Text","type":"long","plain":true,"hint":"Two or three short sentences read best."},{"name":"link","label":"Link words","type":"text","hint":"Leave empty for no link."},{"name":"href","label":"Where the link goes","type":"text","addr":true,"hint":"A page on this site starts with #, such as #artists, or a full web address starting https://."}]},{"name":"per_row","label":"Columns in a row","type":"choice","group":"Look","seg":true,"dflt":"3","options":[["2","Two"],["3","Three"],["4","Four"]],"hint":"On a phone they always stack."},{"name":"numbered","label":"Number the columns","type":"yesno","group":"Look"},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"Columns side by side","starter":{"eyebrow":"","heading":["A heading"],"columns":[{"title":"A title","text":"A few words about it.","link":"","href":""},{"title":"A title","text":"A few words about it.","link":"","href":""},{"title":"A title","text":"A few words about it.","link":"","href":""}],"per_row":"3","numbered":true,"bg":"paper","fg":""},"blocks":[{"field":"columns","label":"Column","add":"Add a column","about":"One column: a title, a few words and a link."}]},"space":{"label":"Space","about":"Empty room between two sections. Nothing is drawn, not even a line.","fields":[{"name":"size","label":"How much room","type":"choice","seg":true,"dflt":"M","options":[["S","Small"],["M","Medium"],["L","Large"]]}],"library":"Empty room between two sections","starter":{"size":"M"}},"picture-banner":{"label":"Picture banner","about":"A large picture with a box of words and one button over it.","fields":[{"name":"image","label":"Picture","type":"image","alt":"alt"},{"name":"alt","label":"Describe the picture","type":"text","hint":"For people who cannot see it. Needed before you save."},{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"text","label":"Text","type":"text","hint":"One short sentence. Leave empty to hide."},{"name":"label","label":"Button words","type":"text","hint":"Leave empty for no button."},{"name":"href","label":"Where the link goes","type":"text","addr":true,"hint":"A page on this site starts with #, such as #artists, or a full web address starting https://."},{"name":"place","label":"Box of words at the","type":"choice","group":"Look","seg":true,"dflt":"L","options":[["L","Left"],["C","Centre"],["R","Right"]]},{"name":"box","label":"Box colour","type":"choice","group":"Look","seg":true,"dflt":"green","options":[["green","Green"],["paper","Paper"]]},{"name":"fit","label":"Picture","type":"choice","group":"Look","seg":true,"dflt":"fill","options":[["fill","Fill the banner"],["whole","Show it whole"]],"hint":"Fill the banner trims the edges to fit. Choose Show it whole for an artwork, so none of it is cut off."}],"library":"A large picture with words over it","starter":{"image":"","alt":"","eyebrow":"","heading":["A heading"],"text":"","label":"Read on","href":"#artists","place":"L","box":"green","fit":"fill"}},"slideshow":{"label":"Slideshow","about":"Large pictures that take turns, each with a caption. Visitors move it on with Previous and Next.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"slides","label":"Slides","type":"rows","max":10,"fields":[{"name":"image","label":"Picture","type":"image","alt":"alt"},{"name":"alt","label":"Describe the picture","type":"text","hint":"For people who cannot see it. Needed before you save."},{"name":"caption","label":"Caption","type":"text","hint":"Such as the title, year and medium, and who took the photo. Leave empty for none."}]},{"name":"auto","label":"Move on by itself","type":"yesno","group":"Look","hint":"Every few seconds, until a visitor uses Previous or Next. Pictures stay still for people who ask their device for less motion."},{"name":"seconds","label":"Seconds on each slide","type":"range","min":3,"max":30,"step":1,"unit":"s","dflt":6,"group":"Look"},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"Pictures that take turns","starter":{"eyebrow":"","heading":[],"slides":[{"image":"","alt":"","caption":""},{"image":"","alt":"","caption":""},{"image":"","alt":"","caption":""}],"auto":true,"seconds":6,"bg":"paper","fg":""},"blocks":[{"field":"slides","label":"Slide","add":"Add a slide","about":"One picture in the slideshow, with its caption.","max":10}]},"gallery":{"label":"Gallery","about":"A grid of photos with captions. Visitors click one to see it larger.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"photos","label":"Photos","type":"rows","fields":[{"name":"image","label":"Picture","type":"image","alt":"alt"},{"name":"alt","label":"Describe the picture","type":"text","hint":"For people who cannot see it. Needed before you save."},{"name":"caption","label":"Title under the photo","type":"text","hint":"Leave empty for none."},{"name":"sub","label":"Small line","type":"text","hint":"Such as the year and medium. Leave empty for none."}]},{"name":"per_row","label":"Photos in a row","type":"choice","group":"Look","seg":true,"dflt":"3","options":[["2","Two"],["3","Three"],["4","Four"]],"hint":"Two in a row on a phone."},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"A grid of photos that open larger","starter":{"eyebrow":"","heading":["Gallery"],"photos":[{"image":"","alt":"","caption":"","sub":""},{"image":"","alt":"","caption":"","sub":""},{"image":"","alt":"","caption":"","sub":""}],"per_row":"3","bg":"paper","fg":""},"blocks":[{"field":"photos","label":"Photo","add":"Add a photo","about":"One photo in the gallery. Visitors click it to see it larger."}]},"logo-row":{"label":"Logo row","about":"A row of logos, such as partners or fairs, each with an optional link.","fields":[{"name":"eyebrow","label":"Small line above the logos","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"logos","label":"Logos","type":"rows","max":12,"fields":[{"name":"image","label":"Logo","type":"image","alt":"alt","button":"Upload a logo","hint":"A PNG with a clear background works best."},{"name":"alt","label":"Name, read aloud to people who cannot see it","type":"text","hint":"Shown as words until a logo is uploaded."},{"name":"href","label":"Opens when clicked","type":"text","addr":true,"hint":"A page on this site starts with #, or a full web address starting https://. Leave empty for no link."}]},{"name":"colour","label":"Logo colours","type":"choice","group":"Look","seg":true,"dflt":"one","options":[["one","One colour"],["own","Their own colours"]],"hint":"One colour keeps a row of different logos calm."},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"A row of partner logos","starter":{"eyebrow":"","logos":[{"image":"","alt":"Partner","href":""},{"image":"","alt":"Partner","href":""},{"image":"","alt":"Partner","href":""}],"colour":"one","bg":"paper","fg":""},"blocks":[{"field":"logos","label":"Logo","add":"Add a logo","about":"One logo in the row, with an optional link.","max":12}]},"artworks":{"label":"Artworks","about":"A grid of works, each with a label: title, year, medium and size.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"artworks","label":"Artworks","type":"rows","fields":[{"name":"image","label":"Picture","type":"image","alt":"alt"},{"name":"alt","label":"Describe the picture","type":"text","hint":"For people who cannot see it. Needed before you save."},{"name":"title","label":"Title","type":"text"},{"name":"year","label":"Year","type":"text","hint":"Leave empty if not known yet."},{"name":"medium","label":"Medium","type":"text","hint":"Such as Acrylic on canvas."},{"name":"size","label":"Size","type":"text","hint":"Such as 100 x 80 cm. Leave empty if not known."},{"name":"note","label":"Small line","type":"text","hint":"Such as where it is now. Leave empty for none."},{"name":"href","label":"Opens when clicked","type":"text","addr":true,"hint":"A page on this site starts with #, or a full web address. Leave empty for no link."}]},{"name":"per_row","label":"Artworks in a row","type":"choice","group":"Look","seg":true,"dflt":"3","options":[["2","Two"],["3","Three"],["4","Four"]],"hint":"Two in a row on a phone."},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"Works, each with its label","starter":{"eyebrow":"","heading":["Selected works"],"artworks":[{"image":"","alt":"","title":"","year":"","medium":"","size":"","note":"","href":""},{"image":"","alt":"","title":"","year":"","medium":"","size":"","note":"","href":""},{"image":"","alt":"","title":"","year":"","medium":"","size":"","note":"","href":""}],"per_row":"3","bg":"paper","fg":""},"blocks":[{"field":"artworks","label":"Artwork","add":"Add an artwork","about":"One work with its label: title, year, medium and size."}]},"exhibitions":{"label":"Exhibitions","about":"A list of exhibitions with their dates, places and sources.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"shows","label":"Exhibitions","type":"rows","fields":[{"name":"title","label":"Exhibition title","type":"text"},{"name":"dates","label":"Dates","type":"text","hint":"Such as 4 March to 12 April 2026. Leave empty if not confirmed."},{"name":"place","label":"Gallery and city","type":"text"},{"name":"kind","label":"Kind","type":"text","hint":"Such as Solo, Group or Art fair. Leave empty for none."},{"name":"href","label":"Source link","type":"text","addr":true,"hint":"Where this can be checked, such as the gallery's or a newspaper's page, starting https://."},{"name":"reported","label":"Only from publicity or the artist","type":"yesno","hint":"Marks it Reported, so readers know it has not been checked elsewhere."}]},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"Exhibitions with dates and places","starter":{"eyebrow":"","heading":["Exhibitions"],"shows":[{"title":"Exhibition title","dates":"","place":"","kind":"","href":"","reported":false}],"bg":"paper","fg":""},"blocks":[{"field":"shows","label":"Exhibition","add":"Add an exhibition","about":"One exhibition with its dates, place and source."}]},"career":{"label":"Career timeline","about":"Dated moments in an artist's career, each with its source, as on a portfolio.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"events","label":"Moments","type":"rows","fields":[{"name":"when","label":"When","type":"text","hint":"A year, or a month and year. Leave empty if not confirmed."},{"name":"what","label":"What happened","type":"text","hint":"One sentence."},{"name":"href","label":"Source link","type":"text","addr":true,"hint":"Where this can be checked, such as the gallery's or a newspaper's page, starting https://."},{"name":"reported","label":"Only from publicity or the artist","type":"yesno","hint":"Marks it Reported, so readers know it has not been checked elsewhere."}]},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"Dated moments, with sources","starter":{"eyebrow":"","heading":["Career timeline"],"events":[{"when":"","what":"What happened.","href":"","reported":false}],"bg":"paper","fg":""},"blocks":[{"field":"events","label":"Moment","add":"Add a moment","about":"One dated moment in the artist's career, with its source."}]},"press":{"label":"Press quotes","about":"Short quotes from named press, each with a link to its source.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"quotes","label":"Quotes","type":"rows","fields":[{"name":"quote","label":"The quote","type":"long","plain":true,"hint":"A short line, word for word, from a named review. Keep it under twenty words."},{"name":"who","label":"Who wrote it","type":"text"},{"name":"publication","label":"Publication","type":"text"},{"name":"date","label":"Date","type":"text"},{"name":"href","label":"Source link","type":"text","addr":true,"hint":"The page the quote comes from, starting https://. A quote is shown with its source."}]},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"Quotes from the press, with sources","starter":{"eyebrow":"","heading":["In the press"],"quotes":[{"quote":"A short line from a named review.","who":"","publication":"","date":"","href":""}],"bg":"paper","fg":""},"blocks":[{"field":"quotes","label":"Quote","add":"Add a quote","about":"One short quote from named press, with its source."}]},"artist-cards":{"label":"Artist cards","about":"A card for each artist, linking to their portfolio. With none added, every published artist is shown.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"artists","label":"Which artists","type":"artists","hint":"Leave empty to show every published artist."},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"Cards linking to portfolios","starter":{"eyebrow":"","heading":["Artists"],"artists":[],"bg":"paper","fg":""},"blocks":[{"field":"artists","label":"Artist","add":"Add an artist","about":"One artist's card, in this order.","item":{"name":null,"label":"Which artist","type":"artists","one":true}}]},"signup":{"label":"Email sign-up","about":"A heading, a line, first name and email, and one button. It opens the visitor's own email app with the message ready to send to info@grovegallery.com. Nothing is sent or kept by the site.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"text","label":"Text","type":"long","plain":true,"hint":"One or two short sentences. Leave empty to hide."},{"name":"button","label":"Button words","type":"text","hint":"Such as Ask to join. The line under the button, saying it opens the visitor's email app, is always shown."},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"Visitors ask to join the letter","starter":{"eyebrow":"Get the review","heading":["New portfolios,","once a month."],"text":"One short letter when there is something new to read. No spare emails.","button":"Ask to join","bg":"green","fg":""}},"signup-popup":{"label":"Sign-up popup","about":"A small box that pops up once a visit, with an email box and one button. It opens the visitor's own email app with the message ready to send to info@grovegallery.com. Nothing is sent or kept by the site.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"text"},{"name":"text","label":"Text","type":"long","plain":true,"hint":"One or two short sentences. Leave empty to hide."},{"name":"button","label":"Button words","type":"text","hint":"Such as Ask to join. The line under the button, saying it opens the visitor's email app, is always shown."},{"name":"delay","label":"Seconds before it shows","type":"range","min":3,"max":60,"step":1,"unit":"s","dflt":8,"hint":"It shows once a visit, and Close or Escape puts it away."}],"library":"A sign-up box that pops up","starter":{"eyebrow":"","heading":"Join the mailing list","text":"Leave your email and we will add you.","button":"Ask to join","delay":8},"popup":true},"visit":{"label":"Visit us","about":"The address, opening hours and how to get there, with an optional link to a map.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"details","label":"Lines","type":"rows","fields":[{"name":"title","label":"Label","type":"text","hint":"Such as Address, Opening hours or Getting there."},{"name":"text","label":"Words","type":"long","plain":true,"hint":"Put each part on its own line, such as the street and the postcode."}]},{"name":"map_words","label":"Map link words","type":"text","hint":"Leave empty for no map link."},{"name":"map","label":"Map link","type":"text","addr":true,"hint":"The gallery's page on a map site, starting https://. It opens in a new tab. No map is built into the page."},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"Address, hours and directions","starter":{"eyebrow":"See the work","heading":["Visit Grove Gallery"],"details":[{"title":"Address","text":""},{"title":"Opening hours","text":""},{"title":"Getting there","text":""}],"map_words":"Open in a map","map":"","bg":"paper","fg":""},"blocks":[{"field":"details","label":"Line","add":"Add a line","about":"One line of visiting details: a label and its words."}]},"contact-form":{"label":"Contact form","about":"Name, email, a topic and a message. It opens the visitor's own email app with the message ready to send to info@grovegallery.com. Nothing is sent or kept by the site.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"text","label":"Text","type":"long","plain":true,"hint":"One or two short sentences. Leave empty to hide."},{"name":"topics","label":"Topics","type":"lines","hint":"The choices for what a message is about, each on its own. Leave empty to leave the choice out."},{"name":"button","label":"Button words","type":"text","hint":"Such as Write the email. The line under the button, saying it opens the visitor's email app, is always shown."},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"Visitors write to the gallery","starter":{"eyebrow":"Contact","heading":["Write to us"],"text":"Questions, corrections and press enquiries all reach the same desk.","topics":["A question","A correction","Press","Something else"],"button":"Write the email","bg":"deep","fg":""},"blocks":[{"field":"topics","label":"Topic","add":"Add a topic","about":"One choice in the list of what a message is about. With none, the list is left out.","item":{"name":null,"label":"Topic","type":"text"}}]}};
  var demoPages = {"_how_to_edit":"Each page is a list of sections shown top to bottom. 'visible' hides a section without deleting it. 'settings' holds the words and choices for that section. Edit this from Artiscope Digital Home.","shared":{"opening":{"type":"opening","visible":true,"settings":{"name":"World Art Review","tagline":"Discover Artists. Understand Art."}},"header":{"type":"header","visible":true,"settings":{"name":"World Art Review","links":[["Artists A to Z","#artists"],["Reviews","#reviews"],["Art Explained","#explained"]],"logos":[]}},"footer":{"type":"footer","visible":true,"settings":{"eyebrow":"Get the review","heading":["New portfolios,","once a month."],"button":"Subscribe","blurb":"Researched artist portfolios, reviews and collecting guides. Discover Artists. Understand Art.","columns":[{"title":"Read","links":[["Artists A to Z","#artists"],["Reviews","#reviews"],["Art Explained","#explained"],["Exhibition Guides","#guides"]]},{"title":"Collect","links":[["Collector's Library","#library"],["Original or print?","#a-original-vs-print"],["Provenance","#a-provenance-certificates"],["Research an artist","#a-research-emerging-artist"]]},{"title":"About","links":[["How we research","#home"],["Sources","#standards"],["Suggest an artist","mailto:info@grovegallery.com?subject=Suggest%20an%20artist%20for%20World%20Art%20Review"],["Contact","mailto:info@grovegallery.com"]]}],"copyright":"© 2026 World Art Review. All rights reserved.","elsewhere":[["Instagram","#"],["X","#"],["LinkedIn","#"],["Privacy","#standards"],["Terms","#standards"]]}}},"pages":{"home":{"title":"Home","sections":[{"id":"hero","type":"hero","visible":true,"settings":{"headline":[{"t":"Discover","ital":false},{"t":"Artists.","ital":true}],"tagline":[{"t":"Understand","ital":false},{"t":"Art.","ital":true}],"image":"","alt":"","credit":"","artist":"","rule_label":"Our rule","rule_text":"Every fact carries a numbered source. Where only the gallery or the artist says so, we say so.","rule_link":"How we work","latest":["zara-muse-profile","konn-artiss-profile","review-anti-frieze"],"hide_picture":false,"hide_rule":false}},{"id":"featured","type":"featured","visible":true,"settings":{"badge":"Artist in focus","artists":[]}},{"id":"sections","type":"section-list","visible":true,"settings":{"eyebrow":"What you will find here","heading":["Read by","section"],"rows":[{"n":"01","name":"Artists A to Z","desc":"Researched portfolios: biography, style, career and selected works.","href":"#artists","count":"artists","unit":"portfolio"},{"n":"02","name":"Reviews","desc":"Close readings of single works, shows and interventions.","href":"#reviews","count":"reviews","unit":"review"},{"n":"03","name":"Art Explained","desc":"Techniques, materials and ideas, in plain language.","href":"#explained","count":"explained","unit":"guide"},{"n":"04","name":"Collector's Library","desc":"How to research an artist, read a certificate and tell an original from a print.","href":"#library","count":"library","unit":"guide"}]}},{"id":"explainedHome","type":"explained","visible":true,"settings":{"heading":["How to","look at","a painting"],"text":"Short, sourced explainers on the techniques and materials behind the work, so you know what you are looking at before you look it up.","count":2}},{"id":"numbers","type":"numbers","visible":true,"settings":{"eyebrow":"The review so far","heading":["Research you","can check"],"labels":["Artists documented","Articles and reviews","Sources cited","Facts with a numbered source"]}},{"id":"method","type":"method","visible":true,"settings":{"eyebrow":"How we research","heading":["The work first,","then the story"],"cards":[{"n":"1","title":"Start with the work","text":"<p>We start with the work itself : what it is made of, how it was made and where it has been shown.</p>","sub":"Seen, measured, described"},{"n":"2","title":"Every fact, sourced","text":"Every fact in a portfolio carries a numbered source you can open and read for yourself.","sub":"Press, auction records, gallery files"},{"n":"3","title":"Publicity, flagged","text":"Claims that come only from publicity are labelled <span class=\"reported\">Reported</span> so you can weigh them.","sub":"Kept apart from checked fact"}]}}]},"standards":{"title":"Editorial standards","sections":[{"id":"heading","type":"page-heading","visible":true,"settings":{"eyebrow":"Editorial standards","heading":["How we research","and what we publish"],"intro":"The rules every portfolio and article on World Art Review follows."}},{"id":"text","type":"long-text","visible":true,"settings":{"body":"\n  <h2>Every fact has a source</h2><p>Each fact in an artist portfolio carries a numbered citation to where it came from. If we cannot source something, we do not state it as fact; it appears as a gap to be filled.</p>\n  <h2>We say who said it</h2><p>We label sources by type: independent reporting, interviews with the artist, the artist's or gallery's own publicity, and gallery records. A claim that comes only from publicity is marked <span class=\"reported\">Reported</span>.</p>\n  <h2>We show what is missing</h2><p>Portfolios show a research status: how many facts are sourced and how many dates or details are still awaiting confirmation.</p>\n  <h2>Our relationships</h2><p><span class=\"placeholder\">[Disclosure of the link between World Art Review and Grove Gallery, wording to confirm.]</span></p>\n  <h2>Corrections</h2><p>If you spot an error, write to <a href=\"mailto:info@grovegallery.com?subject=Correction\">info@grovegallery.com</a>. We correct promptly and note the change on the page.</p>\n  <h2>Privacy and terms</h2><p><span class=\"placeholder\">[Privacy notice and terms of use to be added before launch.]</span></p>\n  "}}]}},"groups":{"top":[],"popups":[],"bottom":[]},"templates":{"article":{"default":{"name":"Default article","sections":[{"id":"main","type":"main"}]}},"artist":{"default":{"name":"Default artist portfolio","sections":[{"id":"main","type":"main"}]}}},"assign":{"article":{},"artist":{}},"lists":{"artists":{"eyebrow":"Artists A to Z","heading":["Every artist,","researched and sourced"],"intro":"Each portfolio brings together biography, documented works, a career timeline and the sources behind every fact. Portfolios marked in research are being compiled now."},"reviews":{"eyebrow":"Reviews","heading":["Recent reviews","and comparisons"],"intro":"Considered responses to individual works and projects, and side-by-side comparisons of artists."},"explained":{"eyebrow":"Art Explained","heading":["How the work is made,","and why it matters"],"intro":"Plain-language guides to the techniques, materials and ideas behind the artworks."},"library":{"eyebrow":"Collector's Library","heading":["Buy with your","eyes open"],"intro":"Practical, independent guidance on researching artists, understanding what you are buying and keeping good records."},"guides":{"eyebrow":"Exhibition Guides","heading":["What to see,","and how to see it"],"intro":"Short, practical guides to current exhibitions featuring the artists we cover."},"search":{"eyebrow":"Search","heading":["Search the","archive"],"intro":"Artists, artworks, techniques and collecting guides."},"research":{"eyebrow":"Research desk","heading":["What still needs","to be added"],"intro":"An internal checklist, drawn from the portfolios themselves. Each item disappears once the information is added. Not for the public site."}}};
  var demoFiles = ["zara-muse-portrait.jpg", "article-palette-knife-painting.jpg"];
  var demoMeta = { "zara-muse-portrait.jpg": { alt: "Zara Muse's portrait, painted with a palette knife in warm reds and gold", caption: "" } };
  var demoSpots = [{"key":"artist:zara-muse","kind":"artist","label":"Zara Muse","group":"Artists","also":"Zara Muse's portfolio and the home page","image":"zara-muse-portrait.jpg","alt":"A painting in thick palette knife strokes of a woman seen from behind, with a pale blonde bob and bare shoulders, against a deep blue background.","credit":"Image: painting by Zara Muse. Supplied by Grove Gallery","published":true,"slot":"artist-zara-muse","hasCredit":true},{"key":"work:zara-muse:0","kind":"work","label":"Malala Yousafzai","group":"Artworks: Zara Muse","also":"Zara Muse's portfolio","image":"","alt":"","credit":"","slot":"work-zara-muse-malala-yousafzai","hasCredit":false},{"key":"work:zara-muse:1","kind":"work","label":"Bella Dama del Sol","group":"Artworks: Zara Muse","also":"Zara Muse's portfolio","image":"","alt":"","credit":"","slot":"work-zara-muse-bella-dama-del-sol","hasCredit":false},{"key":"work:zara-muse:2","kind":"work","label":"Delicada Belleza","group":"Artworks: Zara Muse","also":"Zara Muse's portfolio","image":"","alt":"","credit":"","slot":"work-zara-muse-delicada-belleza","hasCredit":false},{"key":"work:zara-muse:3","kind":"work","label":"Ecos de Azul","group":"Artworks: Zara Muse","also":"Zara Muse's portfolio","image":"","alt":"","credit":"","slot":"work-zara-muse-ecos-de-azul","hasCredit":false},{"key":"work:zara-muse:4","kind":"work","label":"Gracia de Azafra","group":"Artworks: Zara Muse","also":"Zara Muse's portfolio","image":"","alt":"","credit":"","slot":"work-zara-muse-gracia-de-azafra","hasCredit":false},{"key":"work:zara-muse:5","kind":"work","label":"Oro Roja","group":"Artworks: Zara Muse","also":"Zara Muse's portfolio","image":"","alt":"","credit":"","slot":"work-zara-muse-oro-roja","hasCredit":false},{"key":"work:zara-muse:6","kind":"work","label":"Viento del Sur","group":"Artworks: Zara Muse","also":"Zara Muse's portfolio","image":"","alt":"","credit":"","slot":"work-zara-muse-viento-del-sur","hasCredit":false},{"key":"work:zara-muse:7","kind":"work","label":"A Moment in Amber","group":"Artworks: Zara Muse","also":"Zara Muse's portfolio","image":"","alt":"","credit":"","slot":"work-zara-muse-a-moment-in-amber","hasCredit":false},{"key":"artist:konn-artiss","kind":"artist","label":"Konn Artiss","group":"Artists","also":"Konn Artiss's portfolio and the home page","image":"grove-gallery-23-7-26-018402.jpg","alt":"Konn Artiss","credit":"Image: ANTI-FRIEZE, London, October 2025. Courtesy Konn Artiss","published":true,"slot":"artist-konn-artiss","hasCredit":true},{"key":"work:konn-artiss:0","kind":"work","label":"The Washington Ghost","group":"Artworks: Konn Artiss","also":"Konn Artiss's portfolio","image":"","alt":"","credit":"","slot":"work-konn-artiss-the-washington-ghost","hasCredit":false},{"key":"work:konn-artiss:1","kind":"work","label":"Venice canal effigy","group":"Artworks: Konn Artiss","also":"Konn Artiss's portfolio","image":"","alt":"","credit":"","slot":"work-konn-artiss-venice-canal-effigy","hasCredit":false},{"key":"work:konn-artiss:2","kind":"work","label":"ANTI-FRIEZE","group":"Artworks: Konn Artiss","also":"Konn Artiss's portfolio","image":"","alt":"","credit":"","slot":"work-konn-artiss-anti-frieze","hasCredit":false},{"key":"work:konn-artiss:3","kind":"work","label":"Frieze week ice blocks","group":"Artworks: Konn Artiss","also":"Konn Artiss's portfolio","image":"","alt":"","credit":"","slot":"work-konn-artiss-frieze-week-ice-blocks","hasCredit":false},{"key":"artist:zen-xander","kind":"artist","label":"Zen Xander","group":"Artists","also":"Zen Xander's portfolio and the home page","image":"","alt":"","credit":"","published":false,"slot":"artist-zen-xander","hasCredit":true},{"key":"article:zara-muse-profile","kind":"article","label":"Zara Muse: biography, artistic style and career","group":"Articles: Features","section":"features","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: Zara Muse portrait, detail. Supplied by Grove Gallery","slot":"article-zara-muse-profile","hasCredit":true},{"key":"article:konn-artiss-profile","kind":"article","label":"Konn Artiss: artist profile and selected works","group":"Articles: Features","section":"features","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: ANTI-FRIEZE, London, 2025. Courtesy Konn Artiss","slot":"article-konn-artiss-profile","hasCredit":true},{"key":"article:palette-knife-painting","kind":"article","label":"Understanding palette-knife painting","group":"Articles: Art explained","section":"explained","hidden":false,"also":"the article and its card in every list","image":"article-palette-knife-painting.jpg","alt":"Looking close on the strokes","credit":"Image: palette-knife detail.","slot":"article-palette-knife-painting","hasCredit":true},{"key":"article:texture-in-portraiture","kind":"article","label":"The role of texture in contemporary portraiture","group":"Articles: Art explained","section":"explained","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: portrait surface, raking light. [Image to supply]","slot":"article-texture-in-portraiture","hasCredit":true},{"key":"article:how-to-look-at-a-painting","kind":"article","label":"How to look at a painting in ten minutes","group":"Articles: Art explained","section":"explained","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: a visitor in front of a painting. [Image to supply]","slot":"article-how-to-look-at-a-painting","hasCredit":true},{"key":"article:oil-and-acrylic","kind":"article","label":"Oil or acrylic: what the difference means for the person who owns it","group":"Articles: Art explained","section":"explained","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: tubes of oil and acrylic paint. [Image to supply]","slot":"article-oil-and-acrylic","hasCredit":true},{"key":"article:glossary-of-paint","kind":"article","label":"A short glossary of paint, from impasto to sgraffito","group":"Articles: Art explained","section":"explained","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"","slot":"article-glossary-of-paint","hasCredit":true},{"key":"article:what-is-an-intervention","kind":"article","label":"What is an art intervention?","group":"Articles: Art explained","section":"explained","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: ANTI-FRIEZE, London, 2025. Courtesy Konn Artiss","slot":"article-what-is-an-intervention","hasCredit":true},{"key":"article:how-prints-are-made","kind":"article","label":"How prints are made: screenprint, etching, lithograph and giclée","group":"Articles: Art explained","section":"explained","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: a screenprinting squeegee. [Image to supply]","slot":"article-how-prints-are-made","hasCredit":true},{"key":"article:research-emerging-artist","kind":"article","label":"How to research an emerging artist","group":"Articles: Collecting library","section":"library","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"","slot":"article-research-emerging-artist","hasCredit":true},{"key":"article:original-vs-print","kind":"article","label":"Original, limited edition or open print?","group":"Articles: Collecting library","section":"library","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"","slot":"article-original-vs-print","hasCredit":true},{"key":"article:provenance-certificates","kind":"article","label":"Provenance and certificates, explained","group":"Articles: Collecting library","section":"library","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"","slot":"article-provenance-certificates","hasCredit":true},{"key":"article:mixed-media","kind":"article","label":"Mixed-media art: materials, meaning and conservation","group":"Articles: Art explained","section":"explained","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: ANTI-FRIEZE, 2025. Courtesy Konn Artiss","slot":"article-mixed-media","hasCredit":true},{"key":"article:review-anti-frieze","kind":"article","label":"ANTI-FRIEZE: what melts when the art market is put on ice","group":"Articles: Reviews","section":"reviews","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: ANTI-FRIEZE, London, October 2025. Courtesy Konn Artiss","slot":"article-review-anti-frieze","hasCredit":true},{"key":"article:review-washington-ghost","kind":"article","label":"The Washington Ghost: satire as a printed newspaper","group":"Articles: Reviews","section":"reviews","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: The Washington Ghost, Venice, 2025. [Image to supply]","slot":"article-review-washington-ghost","hasCredit":true},{"key":"article:compare-muse-artiss","kind":"article","label":"Zara Muse and Konn Artiss: two ways to talk about value","group":"Articles: Reviews","section":"reviews","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"","slot":"article-compare-muse-artiss","hasCredit":true}];
  var demoSummaries = { "shared:opening": "World Art Review", "shared:header": "3 links", "shared:footer": "3 columns", "home:hero": "Discover Artists.", "home:featured": "All published", "home:sections": "4 rows", "home:explainedHome": "2 articles", "home:numbers": "Four figures", "home:method": "3 cards" };
  var demoSite = null;   // the sample site's articles, artists and sources, read once from assets/demo-site.json
  var demoGam = null;    // Global Art Monitor's sample, from assets/demo-gam.json
  var demoSad = null;    // Street Art Dispatch's lists, from assets/demo-sad.json
  function demoApi(body) {
    if (body.action === "pages" && body.site === "global-art-monitor") {
      if (!demoGam) return fetch("assets/demo-gam.json").then(function (r) { return r.json(); }).then(function (d) { demoGam = d; return demoApi(body); }, function () { return Promise.reject(new Error("The sample could not be read.")); });
      return Promise.resolve(JSON.parse(JSON.stringify(Object.assign({}, demoGam, { preview: params.get("gampreview") || "https://globalartmonitor.com/", imageBase: (params.get("gampreview") || "https://globalartmonitor.com/") + "assets/images/" }))));
    }
    if (body.action === "files" && body.site === "global-art-monitor" && demoGam) {
      var gb = (params.get("gampreview") || "https://globalartmonitor.com/") + "assets/images/";
      return Promise.resolve({ imageBase: gb, spots: demoGam.site.artists.map(function (a) { return { key: "artist:" + a.slug, kind: "artist", label: a.name, group: "Artists", also: a.name + "'s market profile", image: a.image }; }),
        files: demoGam.images.map(function (n) { return { name: n, size: 120000, alt: "", caption: "", used: demoGam.site.artists.filter(function (a) { return a.image === n; }).map(function (a) { return { label: "Artist: " + a.name, spot: "artist:" + a.slug }; }) }; }) });
    }
    if (body.action === "savePages" && body.site === "global-art-monitor" && demoGam) { demoGam.pages = JSON.parse(JSON.stringify(body.pages)); if (body.content) demoGam.site = JSON.parse(JSON.stringify(body.content)); return Promise.resolve({ ok: true }); }
    if (body.action === "pages" && body.site === "street-art-dispatch") {
      if (!demoSad) return fetch("assets/demo-sad.json").then(function (r) { return r.json(); }).then(function (d) { demoSad = d; return demoApi(body); }, function () { return Promise.reject(new Error("The sample could not be read.")); });
      var sp = params.get("sadpreview") || "https://streetartdispatch.com/";
      return Promise.resolve(JSON.parse(JSON.stringify(Object.assign({}, demoSad, { preview: sp, imageBase: sp + "assets/images/" }))));
    }
    if (body.action === "files" && body.site === "street-art-dispatch") {
      var sb = (params.get("sadpreview") || "https://streetartdispatch.com/") + "assets/images/";
      return Promise.resolve({ imageBase: sb, spots: [], files: ((demoSad || {}).images || []).map(function (n) { return { name: n, size: 120000, alt: "", caption: "", used: [] }; }) });
    }
    if (body.action === "savePages" && body.site === "street-art-dispatch" && demoSad) { demoSad.pages = JSON.parse(JSON.stringify(body.pages)); if (body.content) demoSad.site = JSON.parse(JSON.stringify(body.content)); return Promise.resolve({ ok: true }); }
    if (body.action === "pages" && !demoSite) return fetch("assets/demo-site.json").then(function (r) { return r.json(); }).then(function (d) { demoSite = d; if (!demoPages.lists) demoPages.lists = d.pageLists; return demoApi(body); }, function () { demoSite = { site: null, itemKinds: null, lists: {}, listFields: [] }; return demoApi(body); });
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        var a = body.action, c = body.site ? demoCopy(body) : null, l = body.site ? demoList(body.site) : null;
        if (DEMO_STEPS[a]) demoStep(body, DEMO_STEPS[a]);
        if (a === "overview") {
          var d = JSON.parse(JSON.stringify(demoData));
          if (demoEditor) { d.user = { email: "sample", admin: false, name: "Sample editor" }; d.sites = d.sites.filter(function (x) { return x.live; }); }
          d.sites.forEach(function (x) { if (x.live) x.versions = JSON.parse(JSON.stringify(demoVersionsOf(x.id).slice(0, 3))); });
          d.sites.forEach(function (x) { if (!x.live) return; var list = demoList(x.id), want = (body.copies || {})[x.id]; x.copies = JSON.parse(JSON.stringify(list)); x.copy = (list.find(function (y) { return y.id === want; }) || list[0]).id; });
          resolve(d);
        }
        else if (a === "content") resolve({ collections: JSON.parse(JSON.stringify(demoContent)) });
        else if (a === "versions") resolve({ canGoBack: !demoEditor, versions: JSON.parse(JSON.stringify(demoVersionsOf(body.site))) });
        else if (a === "restoreVersion") { var dv = demoVersionsOf(body.site), nx = demoNext(dv, false); dv.forEach(function (x) { x.live = false; }); dv.unshift({ number: nx, title: "back to " + body.version, by: "You", when: new Date().toISOString(), live: true, big: false, notes: "Published by the admin.\n\nWhat changed:\n- Back to version " + body.version + "." }); resolve({ ok: true, version: nx }); }
        else if (a === "people") resolve({ people: JSON.parse(JSON.stringify(demoPeople)), sites: demoData.sites.map(function (x) { return { id: x.id, name: x.name, live: x.live }; }) });
        else if (a === "invitePerson") {
          var ne = String(body.email || "").trim().toLowerCase();
          if (demoPeople.some(function (x) { return x.email === ne; })) reject(new Error("That person is already in People."));
          else { demoPeople.push({ email: ne, name: String(body.name || ""), sites: body.sites || [], invited: new Date().toISOString(), lastSeen: null }); resolve({ ok: true, emailed: true }); }
        }
        else if (a === "updatePerson") { var up = demoPeople.find(function (x) { return x.email === body.email; }); if (up) { up.name = String(body.name || ""); up.sites = body.sites || []; } resolve({ ok: true }); }
        else if (a === "removePerson") { demoPeople = demoPeople.filter(function (x) { return x.email !== body.email; }); resolve({ ok: true }); }
        else if (a === "resendInvite") resolve({ ok: true, emailed: true });
        else if (a === "resetPractice") resolve({ ok: true });
        else if (a === "history") resolve({ changes: demoHistory });
        else if (a === "pages") resolve({ site: demoSite.site ? JSON.parse(JSON.stringify(demoSite.site)) : null, itemKinds: demoSite.itemKinds, lists: demoSite.lists, listFields: demoSite.listFields, pictures: JSON.parse(JSON.stringify(demoSpots.filter(function (x) { return x.kind !== "work"; }))), imageMeta: JSON.parse(JSON.stringify(demoMeta)), pages: JSON.parse(JSON.stringify(demoPages)), kinds: demoKinds, summaries: demoSummaries, images: demoFiles.slice(), imageBase: (params.get("preview") || "https://worldartreview.com/") + "images/", artists: [{ slug: "zara-muse", name: "Zara Muse" }, { slug: "konn-artiss", name: "Konn Artiss" }], preview: params.get("preview") || "https://worldartreview.com/" });
        else if (a === "savePages") {
          var named = {}; (body.uploads || []).forEach(function (u) { var n = String(u.name || "photo").toLowerCase().replace(/\.[a-z]+$/, "").replace(/[^a-z0-9]+/g, "-") + "." + u.ext; named[u.key] = n; if (demoFiles.indexOf(n) < 0) demoFiles.push(n); });
          var fix = function (v) { return JSON.parse(JSON.stringify(v), function (k, x) { return typeof x === "string" && named[x] ? named[x] : x; }); };
          demoPages = fix(body.pages);
          if (body.content) demoSite.site = fix(body.content);
          var pics = fix(body.pictures || {}); Object.keys(pics).forEach(function (k) { var sp = demoSpots.find(function (x) { return x.key === k; }); if (sp) Object.assign(sp, pics[k]); });
          var keepAlt = function (x) { if (Array.isArray(x)) return x.forEach(keepAlt); if (!x || typeof x !== "object") return; Object.keys(x).forEach(function (k) { if (k !== "alt" && typeof x[k] === "string" && Object.keys(named).some(function (u) { return named[u] === x[k]; }) && x.alt && !demoMeta[x[k]]) demoMeta[x[k]] = { alt: x.alt, caption: "" }; keepAlt(x[k]); }); };
          keepAlt(demoPages); keepAlt(pics);
          resolve({ ok: true, photos: named });
        }
        else if (a === "files") {
          var usage = function (n) {
            var out = [], has = function (v) { return Array.isArray(v) ? v.some(has) : v && typeof v === "object" ? Object.keys(v).some(function (k) { return has(v[k]); }) : v === n; };
            (demoPages.pages.home.sections || []).forEach(function (sec) { if (has(sec.settings)) out.push({ label: "Home page: " + ((demoKinds[sec.type] || {}).label || sec.type), page: "home", where: "page", id: sec.id }); });
            demoSpots.forEach(function (sp) { if (sp.image === n) out.push({ label: { artist: "Artist: ", work: "Artwork: ", article: "Article: " }[sp.kind] + sp.label, spot: sp.key }); });
            return out;
          };
          resolve({ files: demoFiles.map(function (n) { return { name: n, size: 180000, alt: (demoMeta[n] || {}).alt || "", caption: (demoMeta[n] || {}).caption || "", used: usage(n) }; }), spots: JSON.parse(JSON.stringify(demoSpots)), imageBase: (params.get("preview") || "https://worldartreview.com/") + "images/" });
        }
        else if (a === "saveFiles") {
          if (body.op === "add") { var base0 = String(body.fileName || "photo").toLowerCase().replace(/\.[a-z]+$/, "").replace(/[^a-z0-9]+/g, "-"), nn = base0 + "." + body.ext, nk = 2; while (demoFiles.indexOf(nn) >= 0) nn = base0 + "-" + (nk++) + "." + body.ext; demoFiles.push(nn); demoMeta[nn] = { alt: body.alt || "", caption: body.caption || "" }; demoStep(body, "Add photo: " + nn); }
          else if (body.op === "describe") { demoMeta[body.name] = { alt: body.alt, caption: body.caption }; demoStep(body, "Photo description: " + body.name); }
          else if (body.op === "replace") demoStep(body, "Replace photo: " + body.name);
          else if (body.op === "remove") { demoFiles = demoFiles.filter(function (n) { return n !== body.name; }); demoStep(body, "Remove photo: " + body.name); }
          else if (body.op === "assign") { var sq = demoSpots.find(function (x) { return x.key === body.spot; }); if (sq) { sq.image = body.name; sq.alt = body.alt; } demoStep(body, "Edit picture: " + (sq ? sq.label : "")); }
          resolve({ ok: true });
        }
        else if (a === "theme") { if (params.has("preview")) demoTheme.spec.url = params.get("preview"); var dt = JSON.parse(JSON.stringify(demoTheme)); Object.assign(dt.spec, JSON.parse(JSON.stringify(demoThemeExtra)), { imageBase: (params.get("preview") || "https://worldartreview.com/") + "images/" }); dt.values.settings = dt.values.settings || {}; resolve(dt); }
        else if (a === "saveTheme") { demoTheme.values = JSON.parse(JSON.stringify(body.values)); resolve({ ok: true, values: body.values }); }
        else if (a === "uploadPhoto") resolve({ ok: true, name: (body.slot ? "slot--" + body.slot : "note--" + String(body.description).toLowerCase().replace(/[^a-z0-9]+/g, "-")) + "." + body.ext });
        else if (a === "undoStep") { var n = Math.min(Number(body.steps) || 1, c.steps.length); if (!n) return reject(new Error("There is nothing more to undo.")); while (n--) c.redo.push(c.steps.shift()); c.ahead = c.kind === "live" ? 0 : c.steps.length; c.canRedo = true; resolve({ ok: true }); }
        else if (a === "redoStep") { if (!c.redo.length) return reject(new Error("There is nothing to redo.")); c.steps.unshift(c.redo.pop()); c.ahead = c.kind === "live" ? 0 : c.steps.length; c.canRedo = c.redo.length > 0; resolve({ ok: true }); }
        else if (a === "publish") { var pv = demoVersionsOf(body.site), pn = demoNext(pv, body.big && !demoEditor); pv.forEach(function (x) { x.live = false; }); pv.unshift({ number: pn, title: "", by: "You", when: new Date().toISOString(), live: true, big: /\.0$/.test(pn), notes: "Published by " + (demoEditor ? "Sample" : "the admin") + ".\n\nWhat changed:\n" + c.steps.map(function (x) { return "- " + x.what; }).join("\n") + (body.note ? "\n\nNote: " + body.note : "") });
          c.steps = []; c.redo = []; c.ahead = 0; c.behind = 0; c.canRedo = false; l[0].steps.unshift({ what: "Make live: " + c.name, when: new Date().toISOString(), by: "sample" }); resolve({ ok: true, version: pn }); }
        else if (a === "refreshCopy") { c.behind = 0; resolve({ ok: true }); }
        else if (a === "makeCopy" && demoEditor) {
          var own = l.find(function (x) { return x.mine; });
          if (!own) { own = { id: "trial-own-5a3c9e0b1d", kind: "trial", name: "Your copy", own: true, mine: true, ahead: 0, behind: 0, since: new Date().toISOString(), steps: [], canRedo: false, preview: "https://example.org/preview/trial-own-5a3c9e0b1d/", redo: [] }; l.push(own); }
          resolve({ ok: true, copy: own.id });
        }
        else if (a === "makeCopy") {
          var slug = String(body.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          if (!slug) return reject(new Error("Give the trial copy a short name, for example Winter look."));
          if (l.length > 2) return reject(new Error("This site already has 2 trial copies. Delete one to make another."));
          var id = "trial-" + slug + "-00000" + l.length;
          l.push({ id: id, kind: "trial", name: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " "), ahead: 0, behind: 0, since: new Date().toISOString(), steps: [], canRedo: false, preview: "https://example.org/preview/" + id + "/", redo: [] });
          resolve({ ok: true, copy: id });
        }
        else if (a === "deleteCopy") { demoCopies[body.site] = l.filter(function (x) { return x !== c || x.kind === "live"; }); resolve({ ok: true }); }
        else resolve({ ok: true });
      }, 100);
    });
  }

  // ---------- start ----------

  async function start() {
    if (demo) { await load(); return; }
    if (!window.supabase) { app.innerHTML = '<p class="loading">The sign-in service could not be reached. Check your connection and refresh.</p>'; return; }
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    sb.auth.onAuthStateChange(function (event, session) {
      var had = !!state.session;
      state.session = session;
      state.email = session && session.user ? session.user.email : state.email;
      if (session && !had) { state.signinSent = false; setTimeout(load, 0); }
      if (!session) { state.data = null; render(); }
    });
    var current = await sb.auth.getSession();
    if (!current.data.session) render();
  }

  // Exposed for the automated checks only.
  window.__adh = { state: state, render: render, esc: esc, go: go, openSite: openSite, pgOf: pgOf, themeCss: themeCss, themeRules: themeRules, richIn: richIn, richOut: richOut, richInline: richInline };
  start();
})();
