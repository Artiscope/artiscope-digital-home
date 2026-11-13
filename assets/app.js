/* Artiscope Digital Home: the console.
   Plain JavaScript, no build step. Everything shown from GitHub is
   escaped before it reaches the page. */
(function () {
  "use strict";

  var VERSION = "27";   // shown on screen so it is clear which copy is loaded
  var cfg = window.ADH_CONFIG || {};
  var params = new URLSearchParams(window.location.search);
  var demo = !cfg.supabaseKey || params.has("demo");
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
    edPrefs: {},           // site id -> { mode, page, sel } kept while the editor reloads
    pg: {},                // site id -> the page editor: { doc, base, kinds, summaries, images, artists, preview, page, sel, mode, panel, dirty }
    photoFiles: [], photoSent: {}, photoDone: [],
    files: {},             // site id -> Files screen: { files, spots, imageBase, filter, open, assign, pick, bust }
    fileAdd: [],           // photos chosen in Files, waiting for their descriptions
    fileBust: {}, fileFilter: "all",   // photos replaced in this visit, so the new one shows; the last filter used
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
  var COLOURS = { "world-art-review": ["#1D4A35", "#EEE5D4"], "global-art-monitor": ["#F3C3C8", "#2A2A2F"] };
  function colours(id) { return COLOURS[id] || ["#EDE8F3", "#5D5866"]; }

  // ---------- talking to the server ----------

  async function api(action, payload) {
    var body = Object.assign({ action: action }, payload || {});
    if (body.site && body.copy == null) body.copy = state.copy[body.site] || "";
    if (action === "overview") body.copies = state.copy;
    if (demo) return demoApi(body);
    var res = await sb.functions.invoke(cfg.functionName || "home", { body: body });
    if (res.error) { var err = new Error(await explain(res.error)); err.stale = !!(explain.last && explain.last.stale); throw err; }
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
    render();
    if (state.data) ensure();
  }

  // Fetches what the open screen needs, once per site.
  async function ensure(force) {
    var s = site(); if (!s) return;
    try {
      if ((state.tab === "content" || state.tab === "overview") && (force || !state.content[s.id])) {
        var c = await api("content", { site: s.id }); state.content[s.id] = c.collections || []; render();
      }
      if ((state.tab === "theme" || state.tab === "overview") && !state.theme[s.id]) {
        var t = await api("theme", { site: s.id });
        state.theme[s.id] = { spec: t.spec, values: t.values, draft: JSON.parse(JSON.stringify(t.values)), mode: "computer", live: null }; render();
      }
      if (state.tab === "pages" && !state.pg[s.id]) {
        var pgd = await api("pages", { site: s.id });
        var pref = state.edPrefs[s.id] || {};
        var pics = {}; (pgd.pictures || []).forEach(function (p) { pics[p.key] = p; });
        state.pg[s.id] = { version: pgd.version || "", pictures: pics, picBase: JSON.stringify(pics), imageMeta: pgd.imageMeta || {}, doc: pgd.pages, base: canon(pgd.pages), kinds: pgd.kinds, summaries: pgd.summaries || {}, images: pgd.images || [], imageBase: pgd.imageBase || "", uploads: {}, picker: "", artists: pgd.artists || [], preview: pgd.preview, page: pref.page && pgd.pages.pages[pref.page] ? pref.page : "home", sel: pref.sel || null, mode: pref.mode || "computer", panel: "", dirty: false, sent: false,
          site: pgd.site || null, siteBase: JSON.stringify(pgd.site || null), itemKinds: pgd.itemKinds || null, lists: pgd.lists || {}, listFields: pgd.listFields || [], at: pref.at || "", gam: !!pgd.gam, pageFields: pgd.pageFields || null };
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
  function curCopy() { var s = site(), list = copiesOf(s), id = s ? state.copy[s.id] : ""; return list.find(function (c) { return c.id === id; }) || list[0]; }
  function keepCopies() {
    sites().forEach(function (s) { var id = state.copy[s.id]; if (id && !copiesOf(s).some(function (c) { return c.id === id && c.kind === "trial"; })) state.copy[s.id] = ""; });
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
      state.status = "live"; state.notice = e.stale && state.ask ? null : { text: e.message, problem: true };
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
    block: "M4 5h16v14H4z"
  };
  function ic(name, size) { var z = size || 16; return '<svg class="i" width="' + z + '" height="' + z + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (IC[name] || IC.block) + '"></path></svg>'; }
  // Which icon stands for each kind of section, on both sites.
  var KIND_IC = { hero: "banner", featured: "person", "section-list": "list", explained: "book", numbers: "hash", method: "cards", opening: "loader", header: "topbar", footer: "footer", "page-heading": "heading", "long-text": "text", status: "clock", timeline: "table", words: "book", features: "cards", profiles: "person", "page-links": "links", "page-head": "heading", "results-table": "table", "latest-result": "hash", glossary: "book", panel: "panel", prose: "text", "contact-form": "form" };
  function kindIc(type) { return '<span class="kic">' + ic(KIND_IC[type] || "block") + '</span>'; }
  // Which icon stands for each kind of block.
  var BLOCK_IC = { headline: "heading", tagline: "text", picture: "picture", latest: "doc", rule: "panel", links: "links", logos: "logo", artists: "person", rows: "list", cards: "cards", items: "book", columns: "list", buttons: "block", about_links: "links", menu_extra: "links", words: "book", sections: "list", timeline: "clock", works: "picture" };
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
    ["history", "History", "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "M12 8v4.5l3 2"],
  ];
  // Outside a site only "All sites" shows. Inside, the site's own screens.
  // Sites that keep their photos in Files show Files instead of Photos.
  var NAV_FILES = ["files", "Files", "M4 6a1 1 0 0 1 1-1h5l2 2h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z", "M8 15l2.5-2.5 2 2 1.5-1.5 2 2"];
  function navItems() {
    var s = site(); if (!(state.inSite && s)) return NAV.slice(0, 1);
    return (s.files ? NAV.map(function (n) { return n[0] === "photos" ? NAV_FILES : n; }) : NAV).filter(function (n) { return !(s.edits && n[0] === "content"); });
  }
  function photosTab(s) { return s && s.files ? "files" : "photos"; }
  function navIndex(tab) { var i = navItems().findIndex(function (n) { return n[0] === tab; }); return i < 0 ? 0 : i; }
  function mark() { return '<svg width="20" height="20" viewBox="0 0 26 26"><path d="M2 24V10l11-9 11 9v14z" fill="#FFFFFF"></path><rect x="10" y="14" width="6" height="10" fill="#52057B"></rect></svg>'; }

  // The floating bar: which site, and what state its changes are in.
  function islandBusy() { return state.status !== "live" || (curCopy().kind === "trial" && curCopy().ahead > 0); }
  function islandInner() {
    var s = site(), list = copiesOf(s), c = curCopy(), trial = c.kind === "trial", busy = state.status === "saving";
    if (!state.inSite || !s) {
      return '<span class="dot" aria-hidden="true" style="background:#C9C2D3"></span><b class="island-name">All sites</b><span class="small">' + (state.status === "saving" ? "Saving" : state.flash || "Pick a site to work on") + '</span>';
    }
    var copyPick = list.length > 1
      ? '<label class="small" for="copy-pick" style="position:absolute;left:-9999px">Working on</label><select id="copy-pick" class="copypick" data-change="copy">' +
        list.map(function (x) { return '<option value="' + esc(x.kind === "live" ? "" : x.id) + '"' + (x.id === c.id ? " selected" : "") + '>' + esc(x.kind === "live" ? "Live site" : "Trial: " + x.name) + '</option>'; }).join("") + '</select>'
      : "";
    var text = busy ? "Saving" : state.flash ? state.flash
      : trial ? (c.ahead ? c.ahead + (c.ahead === 1 ? " change" : " changes") + " on this copy" : "Same as the live site")
      : "Live site. Saves go straight to visitors";
    var canUndo = trial ? c.ahead > 0 : (c.steps && c.steps.length > 0);
    var act = trial && c.ahead && !busy ? '<button type="button" class="btn slim" data-act="ask-makelive">Make live</button>'
      : '<span class="tick" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="#52057B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>';
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

  // A question asked before anything that reaches visitors or throws work away.
  function viewAsk() {
    var q = state.ask; if (!q) return "";
    var c = copiesOf(site()).find(function (x) { return x.id === q.copy; }) || curCopy(), title, text, yes, act;
    if (q.kind === "makelive") {
      title = "Make \u201C" + c.name + "\u201D the live site?";
      text = "Visitors will see it in about two minutes. You can put the old version back from History." + (c.behind ? " The live site has changed since this copy was made. Those changes are kept, unless they are in the same place as yours." : "");
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
    } else if (q.kind === "deletecopy") {
      title = "Delete the trial copy \u201C" + c.name + "\u201D?";
      text = "Its changes are lost. The live site is not affected. This cannot be undone.";
      yes = "Delete the copy"; act = "deletecopy";
    } else return "";
    return '<div class="sunk stack ask" role="alertdialog" aria-label="' + esc(title) + '"><b>' + esc(title) + '</b><span class="muted">' + esc(text) + '</span>' +
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
        '<span class="banner" aria-hidden="true" style="background:' + c[0] + ";color:" + c[1] + '">' + esc(x.live ? initials(x.name) : x.name.replace(/\D/g, "")) + '</span>' +
        '<span class="info"><b>' + esc(x.name) + '</b><span class="small">' + esc(x.live ? x.domain : "Domain owned") + '</span>' +
        '<span class="small" style="margin-top:8px">' + esc(statusLine(x)) + '</span>' +
        '<span class="small" style="color:var(--accent);margin-top:8px">' + (x.live ? "Open" : "Not built yet") + '</span></span></button>';
    }).join("");
    return '<div class="page-head"><span class="small">' + esc(today()) + '</span><h1>' + greeting() + '</h1>' +
      '<p>Your five sites. Open one to work on its words, colours and photos. On the live site, Save goes straight to visitors. On a trial copy, nothing is seen until you make it live. Every step can be undone.</p></div>' +
      '<div class="sites">' + cards + '</div>';
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
      '<p>' + esc(s.domain) + '. Everything for this site is here. Saves on the live site reach visitors straight away. Use a trial copy to try things first.</p></div>' +
      '<div class="grid-3">' +
        (s.edits ? tile("pages", "", "Pages", "Every page, article and artist portfolio, edited beside the real page", "Open the editor")
          : tile("content", entries, "Content", (cols ? cols.map(function (c) { return c.label.toLowerCase(); }).join(", ") : "Articles, artists and more"), "Edit, hide or delete")) +
        (t ? '<button type="button" class="card lift sitecard tile" data-tab="theme"><span class="swatches" aria-hidden="true">' + t.spec.colours.map(function (c) { return '<i style="background:' + esc(t.values.colours[c.id] || c.default) + '" title="' + esc(c.label) + '"></i>'; }).join("") + '</span>' +
          '<b>Theme</b><span class="small">' + t.spec.fonts.map(function (f) { return esc(t.values.fonts[f.id] || f.default); }).join(" &nbsp;&middot;&nbsp; ") + '</span><span class="small" style="color:var(--accent);margin-top:6px">Change the look</span></button>'
          : tile("theme", "", "Theme", "Colours and typefaces", "Change the look")) +
        (s.files ? tile("files", state.files[s.id] ? state.files[s.id].files.length : "", "Files", "Every photo on the site, what it shows and where it is used", "Upload and describe")
          : tile("photos", empty, "Photos", empty + " empty " + (empty === 1 ? "spot" : "spots") + ", " + waiting + " on the way", "Add photos")) +
      '</div>' + viewCopies();
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
    var tabs = '<div class="tabs" role="tablist" style="grid-template-columns:repeat(' + n + ',minmax(0,1fr))">' +
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
    return head("Content", "The words your pages are made from. Open anything to edit it, hide it from visitors, or delete it.") + tabs +
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
    return { css: decl.length ? ":root{" + decl.join(";") + "}" : "", font_links: links };
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
      if (ev.data.type === "adh-click") { var pgd = pgOf(); if (!pgd) return; try { if (ev.origin !== new URL(pgd.preview).origin) return; } catch (e) { return; } var vw = String(ev.data.view || ""), kk = atKind(pgd); if (vw && vw !== (kk === "other" ? "page" : kk)) return; pickSection(String(ev.data.id || ""), ev.data.block, true, undefined, String(ev.data.bf || "")); return; }
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
  function publish(id, replace) {
    var s = site(); if (!s) return; var x = copyArg(id);
    change(key("publish", s.id), function () { return api("publish", { site: s.id, copy: x.arg, replace: !!replace }); },
      function (out) { if (out && out.conflict) { state.ask = { kind: "replace", copy: x.c.id, live: out.live || [] }; state.flash = "Not published yet"; } },
      "Published. Live in about two minutes");
  }
  function stepBack(n) { var s = site(); if (s) change(key("step", s.id), function () { return api("undoStep", { site: s.id, steps: n || 1 }); }, null, n > 1 ? "Undone, " + n + " steps" : "Undone"); }
  function stepForward() { var s = site(); if (s) change(key("step", s.id), function () { return api("redoStep", { site: s.id }); }, null, "Redone"); }
  function copyAction(action, id, say, after) {
    var s = site(); if (!s) return; var x = copyArg(id);
    change(key("copy", s.id), function () { return api(action, { site: s.id, copy: x.arg }); }, after, say);
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
      return { where: "pageinfo", id: q.id, sec: { type: "pageinfo", settings: pgi }, kind: { label: "Page settings", about: "This page's title, and where to find it.", fields: pgd.pageFields || [{ name: "title", label: "Page title", type: "text", hint: "Shown in the browser tab and in the page picker." }] }, block: null };
    }
    if (out) return resolveBlock(out, q);
    if (q.where === "shared") { var part = pgd.doc.shared[q.id]; if (!part) return null; out = { where: "shared", id: q.id, sec: part, kind: pgd.kinds[part.type] }; }
    else { var sec = pgSections(pgd).find(function (x) { return x.id === q.id; }); if (!sec) return null; out = { where: "page", id: q.id, sec: sec, kind: pgd.kinds[sec.type] }; }
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
    return blockTitle(item, i);
  }
  // The name a block goes by in the list: its title, name or first words.
  function blockTitle(item, i) {
    if (Array.isArray(item)) return String(item[0] || "") || "Item " + (i + 1);
    if (item && typeof item === "object") { var t = item.title || item.name || item.q || item.t || item.what || item.word || ""; return String(t).replace(/<[^>]*>/g, "") || "Item " + (i + 1); }
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
    var own = pgd.summaries[(where === "shared" ? "shared:" : pgd.page + ":") + key];
    return own != null ? fillWords(pgd, own) : "";
  }
  // Words in curly brackets, such as {headline}, are filled in by the site from Site details.
  // The list on the left shows them filled in, as visitors see them.
  function fillWords(pgd, t) {
    var d = pgd.gam && pgd.site && pgd.site.site; if (!d || typeof t !== "string" || t.indexOf("{") < 0) return t;
    return t.replace(/\{(tagline|headline|intro|disclosure|email|published)\}/g, function (m, w) { var v = w === "published" ? pgd.site.published_text : d[w]; return v ? String(v) : m; });
  }
  function pgMark(pgd) { pgd.dirty = canon(pgd.doc) !== pgd.base || JSON.stringify(pgd.pictures || {}) !== (pgd.picBase || "{}") || siteChanged(pgd); state.dirty = pgd.dirty; }
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
  function itemName(pgd) { var it = itemOf(pgd), k = atKind(pgd); return k === "site" ? "Site details" : it ? (k === "artist" ? it.name : it.title) || "" : ""; }
  // Global Art Monitor's page titles are written for search results; the picker shows the first part.
  function shortTitle(pgd, t) { return pgd.gam ? String(t || "").split(" | ")[0] : t; }
  function pageLabel(pgd) {
    var k = atKind(pgd), key = atKey(pgd);
    if (k === "page") return shortTitle(pgd, (pgd.doc.pages[key] || {}).title) || key;
    if (k === "list") return pgd.lists[key].label;
    if (k === "other") return key.charAt(0).toUpperCase() + key.slice(1);
    return itemName(pgd);
  }
  // Goes to the page a link points at, as the site would.
  // On Global Art Monitor a link is a path, such as artists/zara-muse/.
  function gamWhere(pgd, path) {
    path = String(path || "").replace(/^\/+/, "").replace(/index\.html$/, ""); var m;
    if (path === "" ) return "home";
    if ((m = /^artists\/([a-z0-9-]+)\/?$/.exec(path)) && pgd.site.artists.some(function (a) { return a.slug === m[1]; })) return "artist-" + m[1];
    if ((m = /^research\/([a-z0-9-]+)\/?$/.exec(path)) && pgd.site.articles.some(function (a) { return a.slug === m[1]; })) return "a-" + m[1];
    var want = path.replace(/\/?$/, "/") + "index.html", key = Object.keys(pgd.doc.pages).find(function (k) { return pgd.doc.pages[k].path === want; });
    return key ? (key === "home" ? "home" : "page-" + key) : path.replace(/[^a-z0-9-]/gi, "") || "home";
  }
  function navTo(hash) {
    var pgd = pgOf(); if (!pgd) return;
    hash = String(hash || "home").replace(/^#/, "");
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
  // Pages, lists, articles and portfolios, for the picker at the top.
  function pagePicker(pgd) {
    var cur = atHash(pgd), o = function (v, label) { return '<option value="' + esc(v) + '"' + (v === cur ? " selected" : "") + '>' + esc(label) + '</option>'; };
    var pages = Object.keys(pgd.doc.pages).map(function (k) { return o(k === "home" ? "home" : "page-" + k, shortTitle(pgd, pgd.doc.pages[k].title) || k); }).join("");
    var lists = Object.keys(pgd.lists).map(function (k) { return o(k, pgd.lists[k].label); }).join("");
    var out = '<optgroup label="Pages">' + pages + '</optgroup>' + (lists ? '<optgroup label="Lists">' + lists + '</optgroup>' : "");
    if (pgd.site) {
      var arts = pgd.site.articles.slice().sort(function (a, b) { return String(a.title).localeCompare(String(b.title)); });
      out += '<optgroup label="Articles">' + arts.map(function (a) { return o("a-" + a.slug, a.title + (a.hidden ? " (hidden)" : "")); }).join("") + '</optgroup>';
      out += '<optgroup label="' + (pgd.gam ? "Artist market profiles" : "Artist portfolios") + '">' + pgd.site.artists.map(function (a) { return o("artist-" + a.slug, a.name + (pgd.gam || a.published ? "" : " (not published)")); }).join("") + '</optgroup>';
      if (pgd.gam) out += '<optgroup label="Across the site">' + o("site-details", "Site details, sections and glossary") + '</optgroup>';
    }
    if (atKind(pgd) === "other") out += o(cur, pageLabel(pgd) + " (not editable here)");
    return '<select class="box pagepick" data-change="ed-goto" aria-label="Page being edited">' + out + '</select>';
  }

  function viewLeave() {
    return state.leave ? '<div class="sunk stack ask"><b>You have changes that are not saved yet.</b>' +
      '<div class="row"><button type="button" class="btn" data-act="leave-save">Save</button><button type="button" class="soft" data-act="leave-go">Leave without saving</button><button type="button" class="linklike" data-act="leave-stay">Keep editing</button></div></div>' : "";
  }
  function viewPagesEditor(s) {
    var pgd = pgOf();
    if (!pgd) return '<div class="ed">' + viewRail(navHtml()) + '<div class="ed-top">' + edTop(s, null) + '</div><p class="loading" style="grid-column:1/-1">Reading the pages of ' + esc(s.name) + '</p></div>';
    var right = edRight(pgd);
    return '<div class="ed' + (right ? " with-right" : "") + '">' + viewRail(navHtml()) +
      '<div class="ed-top">' + edTop(s, pgd) + '</div>' +
      '<div class="ed-left">' + edList(pgd) + '</div>' +
      '<div class="ed-mid">' + viewLeave() + viewAsk() + (state.notice ? '<p class="notice' + (state.notice.problem ? " problem" : "") + '" role="status">' + esc(state.notice.text) + '</p>' : "") +
        '<div class="ed-frame ' + esc(pgd.mode) + '"><iframe id="ed-frame" title="The page being edited" src="' + esc(pgd.preview) + '"></iframe></div><div id="ed-pick">' + edPicker(pgd) + '</div></div>' +
      (right ? '<div class="ed-right">' + right + '</div>' : "") + '</div>';
  }
  function edTop(s, pgd) {
    var c = curCopy(), trial = c.kind === "trial", saving = state.status === "saving";
    var said = saving ? "Saving" : pgd && pgd.dirty ? "Edited, not saved" : state.flash || (trial ? (c.ahead ? c.ahead + (c.ahead === 1 ? " change" : " changes") + " on this copy" : "Same as the live site") : "Live site");
    var dot = saving || (pgd && pgd.dirty) ? "warn" : trial ? "trial" : "live";
    return '<div class="lefty"><button type="button" class="ed-site" data-tab="overview" title="Back to the overview">' + esc(s.name) + '</button>' +
      (copiesOf(s).length > 1 ? '<select class="copypick" data-change="copy" aria-label="Working on">' + copiesOf(s).map(function (x) { return '<option value="' + esc(x.kind === "live" ? "" : x.id) + '"' + (x.id === c.id ? " selected" : "") + '>' + esc(x.kind === "live" ? "Live site" : "Trial: " + x.name) + '</option>'; }).join("") + '</select>' : '<span class="chip quiet">' + (trial ? "Trial: " + esc(c.name) : "Live site") + '</span>') + '</div>' +
      '<div class="mid">' + (pgd ? pagePicker(pgd) + '<button type="button" class="ib" data-act="ed-new" aria-label="New page, article, artist or source" title="New page, article, artist or source">' + ic("plus", 18) + '</button>' : "") +
        '<div class="seg mini icons"><button type="button" class="' + (!pgd || pgd.mode === "computer" ? "on" : "") + '" data-act="ed-mode" data-mode="computer" aria-label="Computer view" title="Computer view">' + ic("monitor", 18) + '</button><button type="button" class="' + (pgd && pgd.mode === "phone" ? "on" : "") + '" data-act="ed-mode" data-mode="phone" aria-label="Phone view" title="Phone view">' + ic("phone", 18) + '</button></div></div>' +
      '<div class="righty"><button type="button" class="plain" data-act="undo-step"' + ((trial ? c.ahead > 0 : (c.steps || []).length > 0) && !saving ? "" : " disabled") + '>Undo</button>' +
      '<button type="button" class="plain" data-act="redo-step"' + (c.canRedo && !saving ? "" : " disabled") + '>Redo</button>' +
      '<span class="state"><i class="sdot ' + dot + '" aria-hidden="true"></i><span id="island-text">' + esc(said) + '</span></span>' +
      (pgd && pgd.dirty ? '<button type="button" class="plain" data-act="ed-discard">Discard</button><button type="button" class="btn" data-act="ed-save"' + (saving ? " disabled" : "") + '>Save</button>'
        : trial && c.ahead ? '<button type="button" class="btn" data-act="ask-makelive">Make live</button>' : "") + '</div>';
  }
  // The eye and the bin on a row of the list. The bin only on what can be removed.
  function rowTools(pgd, where, id, bf, block, off, canHide, canDel, word) {
    var d = ' data-where="' + where + '" data-id="' + esc(id) + '"' + (bf ? ' data-bf="' + esc(bf) + '"' : "") + (block != null ? ' data-block="' + block + '"' : "");
    return '<span class="rtools' + (off ? " keep" : "") + '">' +
      (canHide ? '<button type="button" class="rb' + (off ? " is-off" : "") + '" data-act="ed-row-hide"' + d + ' aria-label="' + (off ? "Show" : "Hide") + ' this ' + word + '" title="' + (off ? "Hidden. Show it" : "Hide") + '">' + ic(off ? "eyeoff" : "eye", 15) + (off ? '<span class="vh">Hidden</span>' : "") + '</button>' : (off ? '<span class="rb is-off" title="Hidden">' + ic("eyeoff", 15) + '<span class="vh">Hidden</span></span>' : "")) +
      (canDel ? '<button type="button" class="rb del" data-act="ed-row-del"' + d + ' aria-label="Remove this ' + word + '" title="Remove">' + ic("bin", 15) + '</button>' : "") + '</span>';
  }
  function edRow(pgd, where, id, sec, picked) {
    var k = pgd.kinds[sec.type] || { label: sec.type }, hidden = sec.visible === false, kinds = bkinds(k), st = sec.settings || {};
    var open = picked;
    var count = 0; kinds.forEach(function (bk) { count += bk.one ? 1 : (Array.isArray(st[bk.field]) ? st[bk.field].length : 0); });
    var row = '<div class="sec' + (picked && pgd.sel.block == null && !pgd.sel.pic ? " on" : "") + (hidden ? " off" : "") + '" data-act="ed-pick" data-where="' + where + '" data-id="' + esc(id) + '"' + (where === "page" ? ' draggable="true"' : "") + '>' +
      kindIc(sec.type) + '<span class="nm">' + esc(k.label) + '<small id="sum-' + esc(where + "-" + id) + '">' + esc(pgSummary(pgd, where, id, sec)) + '</small></span>' +
      (kinds.length ? '<span class="cnt">' + count + (count === 1 ? " block" : " blocks") + '</span>' : "") +
      rowTools(pgd, where, id, "", null, hidden, true, where === "page", "section") +
      (where === "page" ? '<span class="grip" aria-hidden="true" title="Drag to move"><i></i><i></i><i></i><i></i><i></i><i></i></span>' : "") + '</div>';
    if (!kinds.length || !open) return row;
    var sel = pgd.sel || {}, rows = "";
    var ins = function (bf, at) { return '<button type="button" class="ins" data-act="ed-blockpicker" data-where="' + where + '" data-id="' + esc(id) + '" data-bf="' + esc(bf) + '" data-at="' + at + '" aria-label="Add a block here" title="Add a block here"><i aria-hidden="true">+</i></button>'; };
    kinds.forEach(function (bk) {
      var mine = picked && sel.block != null && (sel.bf || kinds[0].field) === bk.field;
      if (bk.one) {
        var off = !!st[bk.hide];
        rows += '<div class="sec blk' + (mine ? " on" : "") + (off ? " off" : "") + '" data-act="ed-pick" data-where="' + where + '" data-id="' + esc(id) + '" data-bf="' + esc(bk.field) + '" data-block="0">' + blockIc(bk) +
          '<span class="nm">' + esc(bk.label) + '</span>' + rowTools(pgd, where, id, bk.field, 0, off, !!bk.hide, false, bk.label.toLowerCase()) + '</div>' + ins(bk.field, 1);
        return;
      }
      var list = Array.isArray(st[bk.field]) ? st[bk.field] : [];
      list.forEach(function (item, i) {
        var on = mine && sel.block === i, off = blockHidden(item);
        rows += '<div class="sec blk' + (on ? " on" : "") + (off ? " off" : "") + '" data-act="ed-pick" data-where="' + where + '" data-id="' + esc(id) + '" data-bf="' + esc(bk.field) + '" data-block="' + i + '">' + blockIc(bk) +
          '<span class="nm">' + esc(bTitle(pgd, bk, item, i)) + '</span>' + rowTools(pgd, where, id, bk.field, i, off, !Array.isArray(item), true, bk.label.toLowerCase()) + '</div>' + ins(bk.field, i + 1);
      });
    });
    return row + '<div class="blocks">' + ins(kinds[0].field, 0) + rows +
      '<button type="button" class="addl blk" data-act="ed-blockpicker" data-where="' + where + '" data-id="' + esc(id) + '">' + ic("plus", 14) + 'Add a block</button></div>';
  }
  function secIns(at) { return '<button type="button" class="ins" data-act="ed-secpicker" data-at="' + at + '" aria-label="Add a section here" title="Add a section here"><i aria-hidden="true">+</i></button>'; }
  function edShared(pgd, keys) {
    var sel = pgd.sel || {}, sh = pgd.doc.shared || {};
    return keys.filter(function (k) { return sh[k]; }).map(function (k) { return edRow(pgd, "shared", k, sh[k], sel.where === "shared" && sel.id === k); }).join("");
  }
  function plainWords(html) { return String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
  function partSummary(pgd, part, it) {
    var k = atKind(pgd), n = function (x, one, many) { return x + " " + (x === 1 ? one : many); };
    if (part.picture) { var ps = pgd.pictures[k + ":" + atKey(pgd)]; return ps && ps.image ? "Chosen" : "No picture yet"; }
    if (part.id === "picture") return it.image ? "Chosen" : "No picture yet";
    if (k === "site") return part.id === "details" ? (it.site || {}).name || "" : part.id === "sections" ? (it.sections || []).length + " sections" : (it.glossary || []).length + " terms";
    if (part.id === "about") return (it.body || []).length + " paragraphs";
    if (part.id === "words") return k === "artist" ? (it.tag || "") : (it.kicker || "");
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
    var kindWord = { page: key === "home" ? "Home page" : "Page", list: "List page", article: "Article", artist: pgd.gam ? "Artist market profile" : "Artist portfolio", site: "Used on every page", other: "Page" }[k];
    if (k === "page") {
      mid = (key !== "home" || pgd.gam ? '<div class="sec' + (sel.where === "pageinfo" ? " on" : "") + '" data-act="ed-pick" data-where="pageinfo" data-id="' + esc(key) + '">' + '<span class="kic">' + ic("gear") + '</span><span class="nm">Page settings<small>' + (pgd.gam ? "Title and description for search engines" : "Title, menu bar, delete") + '</small></span></div>' : "") +
        '<div class="grp">This page</div><div id="ed-sections">' + secIns(0) + pgSections(pgd).map(function (x, i) { return '<div class="secwrap">' + edRow(pgd, "page", x.id, x, sel.where === "page" && sel.id === x.id) + '</div>' + secIns(i + 1); }).join("") + '</div>' +
        '<button type="button" class="addl" data-act="ed-secpicker" data-at="' + (sel.where === "page" ? pgSections(pgd).findIndex(function (x) { return x.id === sel.id; }) + 1 || pgSections(pgd).length : pgSections(pgd).length) + '">' + ic("plus") + 'Add a section</button>';
    } else if (k === "list") {
      var l = pgd.lists[key], entries = !pgd.site ? [] : key === "artists"
        ? pgd.site.artists.map(function (a) { return { hash: "artist-" + a.slug, title: a.name, note: a.published ? "" : "Not published" }; })
        : l.section ? pgd.site.articles.filter(function (a) { return a.section === l.section; }).map(function (a) { return { hash: "a-" + a.slug, title: a.title, note: a.hidden ? "Hidden" : "" }; }) : [];
      mid = '<div class="grp">This page</div><div class="sec' + (sel.where === "list" ? " on" : "") + '" data-act="ed-pick" data-where="list" data-id="' + esc(key) + '"><span class="kic">' + ic("heading") + '</span><span class="nm">Page heading<small>' + esc(((pgd.doc.lists || {})[key] || {}).eyebrow || "") + '</small></span></div>' +
        (pgd.site && (key === "artists" || l.section) ? '<div class="grp">In this list</div>' + entries.map(function (x) {
          return '<button type="button" class="sec plain go" data-act="ed-go" data-hash="' + esc(x.hash) + '"><span class="nm">' + esc(x.title) + (x.note ? '<small>' + esc(x.note) + '</small>' : "") + '</span><span class="eye">Open</span></button>';
        }).join("") + '<button type="button" class="addl" data-act="ed-new" data-what="' + (key === "artists" ? "artist" : "article") + '" data-section="' + esc(l.section || "") + '">' + ic("plus") + (key === "artists" ? "Add an artist" : "Add an article to this list") + '</button>' : "");
    } else if (k === "article" || k === "artist" || k === "site") {
      var it = itemOf(pgd), ik = pgd.itemKinds[k];
      mid = '<div class="grp">' + ({ article: "This article", artist: pgd.gam ? "This market profile" : "This portfolio", site: "Across the whole site" })[k] + '</div>' + ik.parts.map(function (part) { return edPartRow(pgd, part, it); }).join("");
    } else {
      mid = '<p class="small" style="margin:10px 6px">' + esc(pageLabel(pgd)) + ' is drawn by the site\'s own code, so its words cannot be changed here yet. The menu bar and footer can.</p>';
    }
    var edits = s && s.edits;
    return '<div class="lt">' + esc(pageLabel(pgd)) + '</div><span class="small lkind">' + esc(kindWord) + '</span>' +
      '<div class="grp">Top of every page</div>' + edShared(pgd, ["opening", "header"]) + mid +
      '<div class="grp">Bottom of every page</div>' + edShared(pgd, ["footer"]) +
      '';
  }
  function edRight(pgd) { var sel = pgSel(pgd); return pgd.panel === "new" ? edNew(pgd) : sel ? edSettings(pgd, sel) : ""; }
  // What a section looks like, drawn small for the picker's preview.
  var SHAPES = { hero: "banner", "picture-banner": "banner", text: "text", prose: "text", "long-text": "text", "text-picture": "textpic", picture: "picture", quote: "quote", articles: "cards", features: "cards", profiles: "cards", featured: "cards", method: "cards", faq: "rows", words: "rows", glossary: "rows", "page-links": "rows", "section-list": "rows", button: "button", status: "bar", timeline: "table", "results-table": "table", panel: "panel", "contact-form": "form", "page-head": "heading", "page-heading": "heading", "latest-result": "card", numbers: "cards", explained: "text" };
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
      case "form": return '<div class="pv-form"><span></span><span></span><em>Send</em></div>';
      case "heading": return '<div class="pv-lines"><b class="big">A page heading</b>' + bar(60) + '</div>';
      case "card": return '<div class="pv-card"><b>The latest result</b>' + bar(50) + '</div>';
      default: return '<div class="pv-lines"><b>A heading</b>' + bar(92) + bar(86) + bar(60) + '</div>';
    }
  }
  // Where each kind of section sits in the "Add a section" list.
  var SECTION_GROUP = {
    hero: "Top of the page", "page-heading": "Top of the page", "page-head": "Top of the page", status: "Top of the page",
    text: "Words", "long-text": "Words", quote: "Words", faq: "Words", panel: "Words", prose: "Words", words: "Words", glossary: "Words",
    picture: "Pictures", "text-picture": "Pictures",
    featured: "Art and artists", profiles: "Art and artists", timeline: "Art and artists", "results-table": "Art and artists", "latest-result": "Art and artists",
    articles: "Reading and trust", features: "Reading and trust", explained: "Reading and trust", "section-list": "Reading and trust", "page-links": "Reading and trust", numbers: "Reading and trust", method: "Reading and trust",
    button: "Contact and sign-up", "contact-form": "Contact and sign-up"
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
        var blocks = bkinds(kd).map(function (b) { return b.label.toLowerCase(); }), n = usedOnSite(pgd, k);
        out.push({ key: k, group: SECTION_GROUP[k] || "Words", label: kd.label, note: blocks.length ? "Blocks: " + blocks.join(", ") : (kd.library || kd.about), about: kd.about + (n ? " Starts with the words of the one already on the site." : ""), blocks: blocks, shape: SHAPES[k] || "text" });
      });
      var order = ["Top of the page", "Words", "Pictures", "Art and artists", "Reading and trust", "Contact and sign-up"];
      return out.map(function (x, i) { return [x, i]; }).sort(function (x, y) { return (order.indexOf(x[0].group) - order.indexOf(y[0].group)) || (x[1] - y[1]); }).map(function (x) { return x[0]; });
    }
    var ps = pgSel({ sel: { where: pk.where, id: pk.id, block: null }, doc: pgd.doc, page: pgd.page, kinds: pgd.kinds, pictures: pgd.pictures, itemKinds: pgd.itemKinds, at: pgd.at, site: pgd.site, lists: pgd.lists });
    if (!ps || !ps.kind) return [];
    return bkinds(ps.kind).map(function (bk) {
      return { key: bk.field, group: "Blocks that belong in " + ps.kind.label, label: bk.label, note: bk.one ? "One per section, already in it" : bk.about || bk.add, off: !!bk.one, about: (bk.about || "") + (bk.one ? " One per section." : ""), blocks: [], shape: "block", kind: ps.kind.label };
    });
  }
  function edPicker(pgd) {
    var pk = pgd.picker2; if (!pk) return "";
    var items = pickerItems(pgd), groups = [], first = null;
    items.forEach(function (it) { var g = groups.filter(function (x) { return x.label === it.group; })[0]; if (!g) { g = { label: it.group, items: [] }; groups.push(g); } g.items.push(it); if (!first && !it.off) first = it; });
    var title = pk.mode === "section" ? "Add a section" : "Add a block";
    return '<div class="pk-veil" data-act="ed-pick-close"></div><div class="pk" role="dialog" aria-label="' + title + '">' +
      '<div class="pk-head"><b>' + title + '</b><button type="button" class="ib" data-act="ed-pick-close" aria-label="Close" title="Close">' + ic("close") + '</button></div>' +
      '<label class="pk-search"><span class="vh">Search</span>' + ic("search") + '<input type="text" data-pick-q="1" placeholder="' + (pk.mode === "section" ? "Search sections" : "Search blocks") + '" autocomplete="off"></label>' +
      '<div class="pk-list">' + groups.map(function (g) {
        return '<div class="pk-grp" data-grp="1"><span class="pk-gl">' + esc(g.label) + '</span>' + g.items.map(function (it) {
          return '<button type="button" class="pk-item' + (it === first ? " on" : "") + '" data-act="ed-pick-add" data-key="' + esc(it.key) + '"' + (it.off ? " disabled" : "") + ' data-words="' + esc((it.label + " " + it.about + " " + it.note).toLowerCase()) + '">' +
            (pk.mode === "section" ? kindIc(it.key) : blockIc({ field: it.key })) + '<span class="pk-t"><b>' + esc(it.label) + '</b><small>' + esc(it.note) + '</small></span></button>';
        }).join("") + '</div>';
      }).join("") + '<p class="small pk-none" hidden>Nothing matches. Try another word.</p></div></div>' +
      '<div class="pk-view" aria-hidden="true">' + (first ? pickView(pk, first) : "") + '</div>';
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
    if (w === "page") body = f("title", "Page title", "Such as Visit us or About the review.") + '<label class="chk"><input type="checkbox" name="menu" checked> Add it to the menu bar</label><span class="small">It starts with one text section. Add more from the section library.</span>';
    else if (w === "article" && pgd.gam) body = f("title", "Title", "You can change it later.") + '<span class="small">New articles start hidden, so you can write in peace. Show it from its Settings when it is ready. It goes under Research; choose where else it shows in Title and summary.</span>';
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
      var fieldsB = (sel.bdef ? sel.bdef.fields : []).map(function (g) {
        if (sel.single) return edField(pgd, g, st[g.name], g.name);
        if (g.name == null) { var wrapped = sel.item && typeof sel.item === "object"; return edField(pgd, g, nameOf(sel.item), sel.bk.field + "." + sel.block + (wrapped ? ".v" : "")); }
        return edField(pgd, g, Array.isArray(sel.item) ? sel.item[g.name] : (sel.item || {})[g.name], sel.bk.field + "." + sel.block + "." + g.name);
      }).join("");
      var count = sel.single ? "" : '<span class="small">' + esc(sel.bk.label) + " " + (sel.block + 1) + " of " + sel.list.length + '</span>';
      return '<div class="rhead"><div class="row between"><button type="button" class="linklike small" data-act="ed-pick" data-where="' + sel.where + '" data-id="' + esc(sel.id) + '">Back to ' + esc(kind.label) + '</button>' + count + '</div>' +
        '<h2>' + esc(sel.single ? sel.bk.label : bTitle(pgd, sel.bk, sel.item, sel.block)) + '</h2><span class="small">' + esc(sel.bk.about || ("A " + sel.bk.label.toLowerCase() + " in " + kind.label + ".")) + '</span>' + (selHidden(sel) ? '<span class="chip quiet" style="align-self:flex-start">Hidden from the page</span>' : "") + edTools(pgd) + '</div>' +
        '<form class="stack" data-form="section">' + fieldsB + '</form>' + (sel.single && sel.bk.field === "picture" ? picsHere(pgd, sel) : "");
    }
    var kinds = bkinds(kind), taken = {}, main = [], look = [];
    kinds.forEach(function (b) { taken[b.field] = 1; (b.fields || []).forEach(function (n) { taken[n] = 1; }); if (b.hide) taken[b.hide] = 1; });
    kind.fields.forEach(function (f) {
      if (taken[f.name] || f.internal) return;
      (f.group === "Look" ? look : main).push(edField(pgd, f, pgGet(st, String(f.name)), String(f.name)));
    });
    var blockNote = kinds.length ? '<div class="blocknote"><b>Blocks in this section</b>' + kinds.map(function (b) { var n = b.one ? 1 : (st[b.field] || []).length; return '<span class="bn">' + blockIc(b) + '<span>' + esc(b.label) + '</span><em>' + n + '</em></span>'; }).join("") +
      '<button type="button" class="soft slim" data-act="ed-blockpicker" data-where="' + sel.where + '" data-id="' + esc(sel.id) + '">Add a block</button></div>' : "";
    var bk = kinds[0];
    return '<div class="rhead"><button type="button" class="linklike small" data-act="ed-panel-close">Done</button><h2>' + esc(kind.label) + '</h2>' + (kind.about ? '<span class="small">' + esc(kind.about) + '</span>' : "") + (sel.sec.visible === false ? '<span class="chip quiet" style="align-self:flex-start">Hidden from the page</span>' : "") + edTools(pgd) + '</div>' +
      '<form class="stack" data-form="section">' + (main.join("") || (bk ? "" : '<span class="small" style="margin:0 6px">Nothing to set here.</span>')) + blockNote +
      (look.length ? '<div class="sub">Look</div>' + look.join("") : "") + '</form>' + (sel.where === "page" ? picsHere(pgd, sel) : "") + edExtras(pgd, sel);
  }
  // The shared pictures a section shows, such as an artist's or an article's, each opening its own settings.
  function picsHere(pgd, sel) {
    var sec = sel.sec, links = sel.where === "page" ? linkedOf(pgd, sec) : [];
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
      if ((pgd.gam && GAM_BUILT_IN[sel.id]) || (!pgd.gam && WAR_BUILT_IN[sel.id])) return '<div class="stack extras"><span class="small">This is one of the site\'s own pages, so it stays.' + (sel.sec.settings.path ? ' Its address is ' + esc(sel.sec.settings.path.replace(/index\.html$/, "") || "the home page") + '.' : "") + '</span></div>';
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
    if (sel.where === "item" && atKind(pgd) === "artist" && sel.id === (pgd.gam ? "about" : "settings")) {
      var why = artistInUse(pgd, itemOf(pgd));
      return '<div class="stack extras"><div class="sub">Delete</div>' + (why ? '<span class="small">' + esc(why) + '</span>'
        : asking("ed-delartist") ? '<span class="small">Delete ' + esc(itemOf(pgd).name) + (pgd.gam ? "'s market profile" : "'s portfolio") + '? Undo can still bring it back after saving.</span><div class="row"><button type="button" class="btn slim" data-act="ed-delartist">Yes, delete</button><button type="button" class="linklike small" data-act="cancel">Keep it</button></div>'
        : '<button type="button" class="linklike small" data-act="ask" data-k="ed-delartist" style="align-self:flex-start">Delete this artist</button>' + (pgd.gam ? "" : '<span class="small">Unpublishing keeps the portfolio for later.</span>')) + '</div>';
    }
    return "";
  }
  var WAR_BUILT_IN = { home: 1, standards: 1 };
  var GAM_BUILT_IN = { home: 1, "auction-results": 1, artists: 1, research: 1, "market-intelligence": 1, "collecting-valuation": 1, about: 1, contact: 1 };
  // The links a new page can be added to: the menu bar, or on Global Art Monitor the full-screen menu.
  function menuLinks(pgd) { var st = pgd.doc.shared.header.settings; if (pgd.gam) { st.menu_extra = st.menu_extra || []; return st.menu_extra; } st.links = st.links || []; return st.links; }
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
    var isBlock = sel.block != null, page = sel.where === "page", idx, n, hid, canHide = true;
    if (!isBlock && sel.where !== "page" && sel.where !== "shared") return null;
    if (isBlock && sel.single) { idx = 0; n = 1; hid = selHidden(sel); canHide = !!sel.bk.hide; }
    else if (isBlock) { idx = sel.block; n = sel.list.length; hid = blockHidden(sel.item); canHide = !Array.isArray(sel.item) && (sel.where !== "item" || sel.bk.field === "works"); }
    else { idx = page ? pgSections(pgd).findIndex(function (x) { return x.id === sel.id; }) : -1; n = pgSections(pgd).length; hid = sel.sec.visible === false; }
    var movable = (isBlock && !sel.single) || page;
    return { isBlock: isBlock, idx: idx, n: n, hid: hid, canHide: canHide, movable: movable, word: isBlock ? sel.bk.label.toLowerCase() : "section", key: "ed-remove|" + sel.id + "|" + (isBlock ? sel.block : "") };
  }
  function edTools(pgd) {
    var sel = pgSel(pgd), t = toolsFor(pgd, sel); if (!t) return "";
    if (state.confirm === t.key) return '<div class="ptools ask" role="group" aria-label="Remove this ' + t.word + '"><span class="small">Remove this ' + t.word + '?</span><button type="button" class="btn slim" data-act="ed-remove">Yes, remove</button><button type="button" class="soft slim" data-act="cancel">Keep it</button></div>';
    var b = function (act, icon, label, extra) { return '<button type="button" class="tb' + (extra || "") + '" data-act="' + act + '" aria-label="' + label + ' this ' + t.word + '" title="' + label + '">' + ic(icon, 17) + '</button>'; };
    return '<div class="ptools" role="toolbar" aria-label="Change this ' + t.word + '">' +
      (t.canHide ? b("ed-hide", t.hid ? "eyeoff" : "eye", t.hid ? "Show" : "Hide") : "") +
      (t.movable ? b("ed-dup", "copy", "Duplicate") : "") +
      (t.movable ? '<button type="button" class="tw" data-act="ed-move" data-dir="-1"' + (t.idx > 0 ? "" : " disabled") + '>Move up</button><button type="button" class="tw" data-act="ed-move" data-dir="1"' + (t.idx < t.n - 1 ? "" : " disabled") + '>Move down</button>' : "") +
      (t.movable ? '<button type="button" class="tb danger" data-act="ask" data-k="' + esc(t.key) + '" aria-label="Remove this ' + t.word + '" title="Remove">' + ic("bin", 17) + '</button>' : "") +
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
  var FIELD_N = 0;
  function edField(pgd, f, value, path) {
    var id = "pf-" + (FIELD_N++), label = '<label for="' + id + '">' + esc(f.label) + '</label>', hint = f.hint ? '<span class="small">' + esc(f.hint) + '</span>' : "", input = "";
    var t = f.type, v = value;
    if (t === "text") input = '<input type="text" id="' + id + '" data-pf="' + esc(path) + '" value="' + esc(v == null ? "" : v) + '">';
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
    else if (t === "yesno") input = '<select class="box" id="' + id + '" data-pf="' + esc(path) + '" data-kind="yesno"><option value="true"' + (v === true ? " selected" : "") + '>Yes</option><option value="false"' + (v === true ? "" : " selected") + '>No</option></select>';
    else if (t === "choice" && f.seg) input = '<div class="seg wide" role="radiogroup" aria-label="' + esc(f.label) + '">' + f.options.map(function (o, oi) { var on = String(v == null || v === "" ? (f.dflt || f.options[0][0]) : v) === o[0]; return '<label class="segr' + (on ? " on" : "") + '"><input type="radio" name="' + id + '" data-pf="' + esc(path) + '" value="' + esc(o[0]) + '"' + (on ? " checked" : "") + (oi === 0 ? ' id="' + id + '"' : "") + '>' + esc(o[1]) + '</label>'; }).join("") + '</div>';
    else if (t === "piece") input = '<select class="box" id="' + id + '" data-pf="' + esc(path) + '"><option value="">Choose a piece</option>' + (((pgd.site || {}).articles) || []).map(function (a) { return '<option value="' + esc(a.slug) + '"' + (a.slug === v ? " selected" : "") + '>' + esc(a.title) + (a.hidden ? " (hidden)" : "") + '</option>'; }).join("") + '</select>';
    else if (t === "choice") input = '<select class="box" id="' + id + '" data-pf="' + esc(path) + '">' + f.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v == null ? "" : v) === o[0] ? " selected" : "") + '>' + esc(o[1]) + '</option>'; }).join("") + '</select>';
    else if (t === "colour") {
      var theme = f.theme || [], isTheme = theme.some(function (o) { return o[0] === String(v == null ? "" : v); }), custom = isTheme ? "#1D4A35" : (v || "#1D4A35");
      input = '<div class="row"><select class="box" id="' + id + '" data-pf="' + esc(path) + '" data-kind="colour-pick" style="max-width:220px">' + theme.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (isTheme && o[0] === String(v == null ? "" : v) ? " selected" : "") + '>' + esc(o[1]) + '</option>'; }).join("") + '<option value="custom"' + (isTheme ? "" : " selected") + '>Any colour</option></select>' +
        '<label class="sw small" style="background:' + esc(custom) + '"' + (isTheme ? ' hidden' : "") + ' data-swatch="' + esc(path) + '"><input type="color" data-pf="' + esc(path) + '" data-kind="colour" value="' + esc(custom) + '" aria-label="' + esc(f.label) + ', any colour"></label></div>';
    } else if (t === "image") {
      var src = imageSrc(pgd, v), open = pgd.picker === path;
      input = '<div class="picrow">' + (src ? '<img class="picthumb" src="' + esc(src) + '" alt="">' : '<span class="picthumb none">No picture yet</span>') +
        '<div class="stack" style="gap:8px"><label class="btn slim upl">' + (f.button || "Upload a photo") + '<input type="file" accept="image/jpeg,image/png" data-upload="' + esc(path) + '" hidden></label>' +
        '<button type="button" class="soft slim" data-act="ed-picker" data-path="' + esc(path) + '">' + (open ? "Close the photos" : "Choose from the site") + '</button>' +
        (v ? '<button type="button" class="linklike small" data-act="ed-pic-none" data-path="' + esc(path) + '" style="align-self:flex-start">Remove picture</button>' : "") + '</div></div>' +
        (open ? '<div class="picgrid">' + (pgd.images.length ? pgd.images.map(function (im) { var about = (pgd.imageMeta[im] || {}).alt; return '<button type="button" class="pictile' + (im === v ? " on" : "") + '" data-act="ed-pic-choose" data-path="' + esc(path) + '" data-name="' + esc(im) + '" title="' + esc(about || im) + '"><img src="' + esc(pgd.imageBase + im) + '" alt="" loading="lazy"><span>' + esc(about || im) + '</span></button>'; }).join("") : '<span class="small">No photos on the site yet. Upload one.</span>') + '</div>' : "") +
        '<span class="small">JPG or PNG. Resized for the web, never cropped. Kept when you press Save.</span>';
      hint = "";
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
      if (f.one) input = '<select class="box" id="' + id + '" data-pf="' + esc(path) + '"><option value="">' + (f.name == null ? "Choose an artist" : "First published artist") + '</option>' + pgd.artists.map(function (a) { return '<option value="' + esc(a.slug) + '"' + (a.slug === v ? " selected" : "") + '>' + esc(a.name) + '</option>'; }).join("") + '</select>';
      else input = '<div class="stack" style="gap:6px">' + pgd.artists.map(function (a) { return '<label class="chk"><input type="checkbox" data-pf="' + esc(path) + '" data-kind="artists" value="' + esc(a.slug) + '"' + ((v || []).indexOf(a.slug) >= 0 ? " checked" : "") + '> ' + esc(a.name) + '</label>'; }).join("") + '</div>';
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
    var pgd = pgOf(), frame = app.querySelector && app.querySelector("#ed-frame"); if (!pgd || !frame || !frame.contentWindow) return;
    var sel = pgSel(pgd), images = {};
    Object.keys(pgd.uploads || {}).forEach(function (k) { images[k] = pgd.uploads[k].dataUrl; });
    var block = -1, label = "", bf = "", bi = -1;
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
    try { frame.contentWindow.postMessage({ type: "adh-pages", at: gamAt || atHash(pgd), data: pgd.gam ? pgd.site : undefined, content: pgd.gam ? undefined : pgd.site || undefined, show: atKind(pgd) === "article" ? atKey(pgd) : "", pages: { shared: pgd.doc.shared, pages: pgd.doc.pages, lists: pgd.doc.lists }, images: images, pictures: pictures, pick: id, block: id ? block : -1, bf: id ? bf : "", bi: id ? bi : -1, label: id ? label : "", scroll: !!pgd.scrollNext }, new URL(pgd.preview).origin); } catch (e) { /* preview only */ }
    pgd.scrollNext = false;
  }
  function pushSoon() { clearTimeout(pushTimer); pushTimer = setTimeout(function () { pushPreview(); }, 150); }
  function mountPages() {
    var pgd = pgOf(), frame = app.querySelector && app.querySelector("#ed-frame"); if (!pgd || !frame) return;
    frame.addEventListener("load", function () { pgd.sent = true; pushPreview(); });
    if (pgd.sent) pushPreview();
    mountDrag();
  }
  function mountDrag() {
    var pgd = pgOf(); if (!pgd) return;
    var list = app.querySelector("#ed-sections"); if (!list || !list.addEventListener) return;
    var dragId = null;
    list.addEventListener("dragstart", function (ev) { var row = ev.target.closest && ev.target.closest(".sec:not(.blk)"); if (!row) return; dragId = row.dataset.id; try { ev.dataTransfer.setData("text/plain", dragId); ev.dataTransfer.effectAllowed = "move"; } catch (e) { /* fine */ } });
    list.addEventListener("dragover", function (ev) { if (dragId) { ev.preventDefault(); var row = ev.target.closest && ev.target.closest(".sec"); Array.prototype.forEach.call(list.querySelectorAll(".sec"), function (x) { x.classList.toggle("over", x === row); }); } });
    list.addEventListener("dragleave", function () { });
    list.addEventListener("drop", function (ev) {
      ev.preventDefault(); var row = ev.target.closest && ev.target.closest(".sec"); if (row && row.classList.contains("blk")) { var up = row.parentNode && row.parentNode.previousElementSibling; row = up && up.classList.contains("sec") ? up : null; } if (!row || !dragId || row.dataset.id === dragId) { dragId = null; return; }
      var secs = pgSections(pgd), from = secs.findIndex(function (x) { return x.id === dragId; }), to = secs.findIndex(function (x) { return x.id === row.dataset.id; });
      if (from < 0 || to < 0) return;
      var moved = secs.splice(from, 1)[0]; secs.splice(to, 0, moved); dragId = null; pgMark(pgd); edPatch(); pushPreview();
    });
  }
  // Redraws the editor's panels without touching the page in the middle, which would reload it.
  function edPatch() {
    var ed = app.querySelector && app.querySelector(".ed"), s = site(), pgd = pgOf();
    if (!ed || !s || !pgd) { render(); return; }
    var right = edRight(pgd);
    ed.className = "ed" + (right ? " with-right" : "");
    ed.querySelector(".ed-top").innerHTML = edTop(s, pgd);
    ed.querySelector(".ed-left").innerHTML = edList(pgd);
    var rp = ed.querySelector(".ed-right");
    if (right) { if (!rp) { rp = document.createElement("div"); rp.className = "ed-right"; ed.appendChild(rp); } rp.innerHTML = right; }
    else if (rp) rp.remove();
    var mid = ed.querySelector(".ed-mid"), notes = mid.querySelectorAll(".ask, .notice"); Array.prototype.forEach.call(notes, function (x) { x.remove(); });
    mid.insertAdjacentHTML("afterbegin", viewLeave() + viewAsk() + (state.notice ? '<p class="notice' + (state.notice.problem ? " problem" : "") + '" role="status">' + esc(state.notice.text) + '</p>' : ""));
    var pkb = ed.querySelector("#ed-pick"); if (pkb) pkb.innerHTML = edPicker(pgd);
    mountRich(); mountDrag();
  }
  function edRemember() { var s = site(), p = pgOf(); if (s && p) state.edPrefs[s.id] = { mode: p.mode, page: p.page, sel: p.sel, at: p.at }; }
  function pickSection(id, block, fromPage, where, bf) {
    var pgd = pgOf(); if (!pgd) return;
    var b = block == null || block === "" || Number(block) < 0 ? null : Number(block), k = atKind(pgd);
    if (id === "header" || id === "footer" || id === "opening") pgd.sel = { where: "shared", id: id, block: b };
    else if (where === "item" || (!where && (k === "article" || k === "artist"))) pgd.sel = { where: "item", id: id, block: b };
    else if (where === "list" || (!where && k === "list")) pgd.sel = { where: "list", id: atKey(pgd), block: null };
    else if (where === "pageinfo" || where === "source") pgd.sel = { where: where, id: id, block: null };
    else if (pgSections(pgd).some(function (x) { return x.id === id; })) pgd.sel = { where: "page", id: id, block: b };
    else return;
    if (bf) pgd.sel.bf = bf;
    if (!pgSel(pgd)) { pgd.sel = null; return; }
    // a click on the page without a kind counts hidden blocks out, so find the real one
    var sel = pgSel(pgd), first = sel && sel.kind ? bkinds(sel.kind)[0] : null;
    if (fromPage && !bf && b != null && first && !first.one) {
      var list = (sel.sec.settings || {})[first.field] || [], seen = -1;
      for (var i = 0; i < list.length; i++) { if (!blockHidden(list[i])) seen++; if (seen === b) { pgd.sel.block = i; break; } }
    }
    pgd.panel = ""; pgd.picker = ""; pgd.picker2 = null; state.confirm = null; pgd.scrollNext = !fromPage; edRemember(); edPatch(); pushPreview();
  }
  function focusPicker() { try { var q = app.querySelector("[data-pick-q]"); if (q) q.focus(); } catch (e) { /* fine */ } }
  // Adds what was chosen in a picker: a section where the line was, or a block in its section.
  function pickerAdd(pgd, key) {
    var pk = pgd.picker2;
    if (pk.mode === "section") {
      var kd = pgd.kinds[key]; if (!kd) return;
      var saved = ((JSON.parse(pgd.base || "{}").pages || {})[pgd.page] || { sections: [] }).sections || [];
      // a section taken off this page comes back as it was; otherwise copy the one already on the site, or start fresh
      var back = saved.filter(function (x) { return x.type === key && !pgSections(pgd).some(function (y) { return y.id === x.id; }); })[0];
      var from = back || firstOnSite(pgd, key);
      var nid = back ? back.id : newSectionId(pgd, key);
      var sec = { id: nid, type: key, visible: true, settings: JSON.parse(JSON.stringify(from ? from.settings || {} : kd.starter || {})) };
      var secs = pgSections(pgd), at = Math.max(0, Math.min(pk.at == null || pk.at < 0 ? secs.length : pk.at, secs.length));
      secs.splice(at, 0, sec);
      pgd.summaries[pgd.page + ":" + nid] = ""; pgd.sel = { where: "page", id: nid, block: null };
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
  function newSectionId(pgd, type) {
    var n = 1, used = pgSections(pgd).map(function (x) { return x.id; });
    while (used.indexOf(type + "-" + n) >= 0) n++;
    return type + "-" + n;
  }
  // Every picture needs a description before it is saved.
  function missingDescription(pgd) {
    var found = null;
    Object.keys(pgd.doc.pages).forEach(function (pk) { (pgd.doc.pages[pk].sections || []).forEach(function (sec) {
      var k = pgd.kinds[sec.type]; if (!k || found) return;
      k.fields.forEach(function (f) { if (f.type === "image" && f.alt && (sec.settings || {})[f.name] && !String((sec.settings || {})[f.alt] || "").trim()) found = { page: pk, id: sec.id, label: k.label }; });
    }); });
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
  function savePages() {
    var s = site(), pgd = pgOf(); if (!s || !pgd || !pgd.dirty) return;
    var miss = missingDescription(pgd);
    if (miss && miss.at) { pgd.at = miss.at; pgd.sel = { where: "item", id: miss.part, block: miss.block }; state.notice = { text: "Please describe the picture of " + miss.label + " before saving. It is read out to people who cannot see it.", problem: true }; edPatch(); pushPreview(); return; }
    if (miss && miss.shared) { pgd.sel = { where: "shared", id: miss.shared, block: miss.block, bf: miss.bf }; state.notice = { text: "Please give " + miss.label + " a name before saving. It is read out to people who cannot see it.", problem: true }; edPatch(); pushPreview(); return; }
    if (miss) { if (miss.page) { pgd.page = miss.page; pgd.at = ""; } pgd.sel = miss.id ? { where: "page", id: miss.id, block: null, pic: miss.pic || "" } : null; state.notice = { text: "Please describe the picture in " + miss.label + " before saving. It is read out to people who cannot see it.", problem: true }; edPatch(); pushPreview(); return; }
    var doc = JSON.parse(JSON.stringify(pgd.doc)), what = pgd.what || (pgPage(pgd).title || pgd.page);
    var pics = picChanges(pgd), picNames = Object.keys(pics).map(function (k) { return pgd.pictures[k].label; });
    if (canon(doc) === pgd.base && picNames.length) what = "Picture of " + picNames.join(", ");
    var contentNow = siteChanged(pgd) ? JSON.parse(JSON.stringify(pgd.site)) : undefined;
    if (canon(doc) === pgd.base && !picNames.length && contentNow) what = pgd.what || "Edit " + (itemName(pgd) || "content");
    var used = canon(doc) + canon(pics) + (contentNow ? canon(contentNow) : ""), uploads = Object.keys(pgd.uploads || {}).filter(function (k) { return used.indexOf(JSON.stringify(k)) >= 0; }).map(function (k) { var u = pgd.uploads[k]; return { key: k, name: u.name, ext: u.ext, content: u.content }; });
    edRemember(); state.notice = null;
    onLive(function () {
      change(key("pages", s.id), function () { return api("savePages", { site: s.id, pages: doc, what: what, uploads: uploads, pictures: pics, content: contentNow, version: pgd.version, replace: !!pgd.replaceNext }).catch(function (e) {
          pgd.replaceNext = false;
          if (e.stale) state.ask = { kind: "stale" };
          throw e;
        }); }, function () { state.dirty = false; }, curCopy().kind === "trial" ? "Saved on this copy" : "Saved. Live in about two minutes");
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
        '<div class="savebar"><button type="submit" class="btn"' + (busy ? " disabled" : "") + '>' + (busy ? "Saving" : "Save") + '</button>' +
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
              '<div class="row"><button type="submit" class="btn slim"' + (state.busy[k] ? " disabled" : "") + '>Save</button><button type="button" class="linklike small" data-act="files-describe" data-name="">Cancel</button></div></form>'
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
    state.edPrefs[s.id] = Object.assign({}, state.edPrefs[s.id] || {}, { page: el.dataset.page || "home", sel: { where: el.dataset.where === "shared" ? "shared" : "page", id: el.dataset.id, block: null } });
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
      return '<div class="card copycard' + (on ? " on" : "") + '"><div class="copytop" style="background:' + (live ? tone[0] : "#F1E6FC") + ';color:' + (live ? tone[1] : "#52057B") + '"><span>' + (live ? "Live site" : "Trial copy") + '</span></div>' +
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
    var views = { home: viewHome, overview: viewOverview, content: viewContent, theme: viewTheme, photos: viewPhotos, files: viewFiles, history: viewHistory };
    var s = site(), unbuilt = state.inSite && !s && state.site;
    if (state.inSite && s && state.tab === "pages") { app.innerHTML = viewPagesEditor(s); mountRich(); mountPages(); return; }
    var inner = unbuilt ? viewUnbuilt(sites().find(function (x) { return x.id === state.site; }) || { name: "Site" }) : (views[state.inSite ? state.tab : "home"] || viewHome)();
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
    state.flash = ""; state.ask = null; state.site = id; state.inSite = true; state.photoFiles = []; state.prevCtab = 0;
    go(x.live ? (state.place[id] || "pages") : "overview");
  }
  function go(tab) {
    if (tab === "home") { state.inSite = false; }
    else if (site()) state.place[site().id] = tab;
    state.prevTab = state.tab; state.tab = tab; state.open = null; state.draft = null; state.dirty = false; state.leave = null; state.confirm = null; state.notice = null;
    state.csearch = ""; state.cmore = false;
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
  var RESERVED_PAGES = ["home", "artists", "reviews", "explained", "library", "guides", "standards", "research", "search", "assets", "data", "tools", "inbox", "preview", "auction-results", "market-intelligence", "collecting-valuation", "about", "contact"];
  function makeNew(form) {
    var pgd = pgOf(); if (!pgd) return;
    var val = function (n) { var x = form.querySelector('[name="' + n + '"]'); return x ? (x.type === "checkbox" ? x.checked : x.value.trim()) : ""; };
    var w = form.dataset.what, say = function (t) { state.notice = { text: t, problem: true }; edPatch(); };
    state.notice = null;
    if (w === "page") {
      var title = val("title"); if (!title) return say("Please give the page a title.");
      var key = freeSlug(slugFrom(title) || "page", Object.keys(pgd.doc.pages).concat(RESERVED_PAGES));
      if (pgd.gam) {
        var head = JSON.parse(JSON.stringify((pgd.kinds["page-head"] && pgd.kinds["page-head"].starter) || {})); head.eyebrow = title; head.headline = title;
        pgd.doc.pages[key] = { path: key + "/index.html", title: title + " | Global Art Monitor", description: "", current: "", intro: false, sections: [{ id: "head", type: "page-head", visible: true, settings: head }] };
      } else {
        var starter = JSON.parse(JSON.stringify((pgd.kinds.text && pgd.kinds.text.starter) || {})); starter.heading = [title];
        pgd.doc.pages[key] = { title: title, sections: [{ id: "text-1", type: "text", visible: true, settings: starter }] };
      }
      if (val("menu")) menuLinks(pgd).push([title, menuHref(pgd, key)]);
      pgd.what = "Add page: " + title; pgMark(pgd); navTo("page-" + key); return;
    }
    if (!pgd.site) return;
    if (w === "article" && pgd.gam) {
      var gt = val("title"); if (!gt) return say("Please give the article a title.");
      var gs = freeSlug(slugFrom(gt) || "article", pgd.site.articles.map(function (x) { return x.slug; }));
      pgd.site.articles.push({ slug: gs, title: gt, kicker: "Research", tags: ["research"], mins: 5, standfirst: "", body: "<p>Write here.</p>", description: "", hidden: true });
      pgd.what = "Add article: " + gt; pgMark(pgd); navTo("a-" + gs); pickSection("words", null, false, "item"); return;
    }
    if (w === "artist" && pgd.gam) {
      var gn = val("name"); if (!gn) return say("Please give the artist's name.");
      var ga = freeSlug(slugFrom(gn) || "artist", pgd.site.artists.map(function (x) { return x.slug; }));
      pgd.site.artists.push({ slug: ga, name: gn, line: "", houses: [], summary: "", body: [], sources: [], image: "", alt: "", caption: "", sales: [] });
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
    var el = ev.target.closest("[data-tab],[data-act]"); if (!el) return;
    if (el.dataset.tab) { var to = el.dataset.tab; guard(function () { go(to); }); return; }
    var a = el.dataset.act, s = site();
    if (a === "refresh") { state.content = {}; state.history = {}; load(); }
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
    else if (a === "ed-pick") pickSection(el.dataset.id, el.dataset.block, false, el.dataset.where, el.dataset.bf);
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
      var hk = pz2.gam ? "menu_extra" : "links", hl2 = ((pz2.doc.shared.header || {}).settings || {})[hk]; if (hl2) pz2.doc.shared.header.settings[hk] = hl2.filter(function (l) { return l[1] !== menuHref(pz2, dk); });
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
    else if (a === "ed-panel-close") { var pq = pgOf(); if (pq) { pq.panel = ""; pq.sel = null; pq.picker = ""; edPatch(); pushPreview(""); } }
    else if (a === "ed-secpicker") { var pl = pgOf(); if (pl) { pl.picker2 = { mode: "section", at: Number(el.dataset.at) }; pl.panel = ""; edPatch(); focusPicker(); } }
    else if (a === "ed-blockpicker") {
      var pb = pgOf(); if (!pb) return;
      pb.picker2 = { mode: "block", where: el.dataset.where, id: el.dataset.id, bf: el.dataset.bf || "", at: el.dataset.at == null ? -1 : Number(el.dataset.at) };
      // with only one kind of block to add, there is nothing to choose
      var can = pickerItems(pb).filter(function (x) { return !x.off; });
      if (can.length === 1) { pickerAdd(pb, can[0].key); return; }
      edPatch(); focusPicker();
    }
    else if (a === "ed-pick-close") { var pz2 = pgOf(); if (pz2) { pz2.picker2 = null; edPatch(); } }
    else if (a === "ed-pick-add") { var pa2 = pgOf(); if (pa2 && pa2.picker2 && !el.disabled) pickerAdd(pa2, el.dataset.key); }
    else if (a === "ed-page") { var pp = pgOf(); if (pp) { pp.page = el.dataset.page; pp.sel = null; pp.panel = ""; edRemember(); edPatch(); pushPreview(); } }
    else if (a === "ed-mode") { var pm = pgOf(); if (pm) { pm.mode = el.dataset.mode; edRemember(); var fr = app.querySelector(".ed-frame"); if (fr) fr.className = "ed-frame " + pm.mode; patchEdTop(); } }
    else if (a === "ed-hide") { var ph0 = pgOf(); if (ph0) toggleHidden(ph0); }
    else if (a === "ed-row-hide") {
      // hide or show a row without moving away from what is picked
      var pr0 = pgOf(); if (!pr0) return; var keep = pr0.sel;
      pr0.sel = { where: el.dataset.where, id: el.dataset.id, block: el.dataset.block == null ? null : Number(el.dataset.block), bf: el.dataset.bf || undefined };
      toggleHidden(pr0, keep);
    }
    else if (a === "ed-row-del") {
      var pr1 = pgOf(); if (!pr1) return;
      pr1.sel = { where: el.dataset.where, id: el.dataset.id, block: el.dataset.block == null ? null : Number(el.dataset.block), bf: el.dataset.bf || undefined };
      pr1.panel = ""; pr1.picker = ""; pr1.picker2 = null;
      var t1 = toolsFor(pr1, pgSel(pr1)); state.confirm = t1 && t1.movable ? t1.key : null;
      edRemember(); edPatch(); pushPreview();
    }
    else if (a === "ed-dup") {
      var pd = pgOf(), ds = pd && pgSel(pd); if (!ds) return;
      if (ds.block != null && ds.single) return;
      if (ds.block != null) { var dupe = JSON.parse(JSON.stringify(ds.item)); if (dupe && !Array.isArray(dupe) && dupe.id) dupe.id = dupe.id + "-copy"; ds.list.splice(ds.block + 1, 0, dupe); pd.sel.block = ds.block + 1; pd.what = "Add " + ds.bk.label.toLowerCase() + ": copy of " + blockTitle(ds.item, ds.block); }
      else { if (ds.where !== "page") return; var copy = JSON.parse(JSON.stringify(ds.sec)); copy.id = newSectionId(pd, ds.sec.type);
        var dl = pgSections(pd), di = dl.findIndex(function (x) { return x.id === ds.id; }); dl.splice(di + 1, 0, copy);
        pd.summaries[pd.page + ":" + copy.id] = pd.summaries[pd.page + ":" + ds.id] || ""; pd.sel = { where: "page", id: copy.id, block: null }; pd.what = "Add section: copy of " + (ds.kind ? ds.kind.label : ds.id); }
      pgMark(pd); edPatch(); pushPreview();
    }
    else if (a === "ed-move") {
      var pv = pgOf(), ms = pv && pgSel(pv); if (!ms) return;
      var dir = Number(el.dataset.dir);
      if (ms.block != null && ms.single) return;
      if (ms.block != null) { var bj = ms.block + dir; if (bj < 0 || bj >= ms.list.length) return; var bt = ms.list[ms.block]; ms.list[ms.block] = ms.list[bj]; ms.list[bj] = bt; pv.sel.block = bj; pv.what = "Move " + ms.bk.label.toLowerCase() + ": " + blockTitle(bt, bj); }
      else { if (ms.where !== "page") return; var ml = pgSections(pv), mi = ml.findIndex(function (x) { return x.id === ms.id; }), mj = mi + dir;
        if (mj < 0 || mj >= ml.length) return; var tmp = ml[mi]; ml[mi] = ml[mj]; ml[mj] = tmp; pv.what = "Move section: " + (ms.kind ? ms.kind.label : ms.id); }
      pgMark(pv); edPatch(); pushPreview();
    }
    else if (a === "ed-remove") {
      var pr = pgOf(), rs = pr && pgSel(pr); if (!rs) return;
      if (rs.block != null && rs.single) return;
      if (rs.block != null) { rs.list.splice(rs.block, 1); pr.what = "Remove " + rs.bk.label.toLowerCase() + ": " + blockTitle(rs.item, rs.block); pr.sel.block = null; }
      else { if (rs.where !== "page") return; var rl = pgSections(pr); rl.splice(rl.findIndex(function (x) { return x.id === rs.id; }), 1); pr.sel = null; pr.what = "Remove section: " + (rs.kind ? rs.kind.label : rs.id); }
      state.confirm = null; pgMark(pr); edPatch(); pushPreview(pr.sel ? undefined : "");
    }
    else if (a === "ed-add-block") {
      var pk = pgOf(); if (!pk) return; pk.sel = { where: el.dataset.where, id: el.dataset.id, block: null };
      var ks = pgSel(pk), kb = ks && ks.kind ? bkinds(ks.kind)[0] : null; if (!kb) return;
      var bf = ks.kind.fields.find(function (f) { return f.name === kb.field; }); if (!bf) return;
      var arr = ks.sec.settings[kb.field]; if (!Array.isArray(arr)) { arr = []; ks.sec.settings[kb.field] = arr; }
      var blank = blankFrom(bf.fields); if (ks.where === "item" && kb.field === "sections") { var sn = 1; while (arr.some(function (x) { return x && x.id === "part-" + sn; })) sn++; blank.id = "part-" + sn; }
      arr.push(blank); pk.sel.block = arr.length - 1; pk.sel.bf = kb.field; pk.what = kb.add + " in " + (ks.where === "item" ? itemName(pk) : ks.kind.label);
      pgMark(pk); pk.scrollNext = true; edPatch(); pushPreview();
    }
    else if (a === "ed-picker") { var pq2 = pgOf(); if (pq2) { pq2.picker = pq2.picker === el.dataset.path ? "" : el.dataset.path; edPatch(); } }
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
    else if (a === "ed-discard") { var pz = pgOf(); if (pz) { pgReset(pz); pz.sel = null; pz.panel = ""; pz.uploads = {}; pz.picker = ""; edPatch(); pushPreview(""); } }
    else if (a === "look") { var t = themeOf(), i = Number(el.dataset.i); if (t) { Object.assign(t.draft.colours, i < 0 ? t.values.colours : t.spec.looks[i].colours); themeUpdate(); } }
    else if (a === "theme-discard") { var t2 = themeOf(); if (t2) { t2.draft = JSON.parse(JSON.stringify(t2.values)); themeUpdate(); } }
    else if (a === "theme-publish") onLive(publishTheme, "This theme change");
    else if (a === "publish-replace") publish(el.dataset.copy, true);
    else if (a === "ask-makelive") { state.ask = { kind: "makelive", copy: curCopy().id }; render(); if (typeof window.scrollTo === "function") window.scrollTo(0, 0); }
    else if (a === "ask-big") { state.ask = { kind: el.dataset.kind, copy: el.dataset.copy }; render(); if (typeof window.scrollTo === "function") window.scrollTo(0, 0); }
    else if (a === "stale-replace") { var px = pgOf(); state.ask = null; state.notice = null; if (px) { px.replaceNext = true; state.sure = true; try { savePages(); } finally { state.sure = false; } } }
    else if (a === "stale-reload") { var sx = site(); state.ask = null; state.notice = null; state.dirty = false; if (sx) { delete state.pg[sx.id]; render(); ensure(); } }
    else if (a === "ask-cancel") { state.ask = null; if (state.tab === "pages" && pgOf()) edPatch(); else render(); }
    else if (a === "livesave") { var run = state.ask && state.ask.go; state.ask = null; state.sure = true; try { if (run) run(); } finally { state.sure = false; } }
    else if (a === "makelive") publish(el.dataset.copy);
    else if (a === "discard") copyAction("discard", el.dataset.copy, "Changes thrown away. The live site is as it was");
    else if (a === "deletecopy") copyAction("deleteCopy", el.dataset.copy, "Trial copy deleted", function () { state.copy[s.id] = ""; });
    else if (a === "refresh-copy") copyAction("refreshCopy", el.dataset.copy, "Copy brought up to date with live");
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
    var pgd = pgOf(), sel = pgd && pgSel(pgd); if (!sel) return;
    var path = t.dataset.pf, kind = t.dataset.kind, v;
    if (kind === "lines") v = t.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    else if (kind === "number") v = t.value === "" ? 0 : Number(t.value);
    else if (kind === "numnull") v = t.value === "" ? null : Number(t.value);
    else if (kind === "which") { if (t.value === "+chosen") { v = []; pgSet(sel.sec.settings, path, v); pgd.what = "Edit " + (sel.kind ? sel.kind.label : sel.id); pgMark(pgd); edPatch(); pushPreview(); return; } v = t.value; var wasList = Array.isArray(pgGet(sel.sec.settings, path)); pgSet(sel.sec.settings, path, v); pgMark(pgd); if (wasList) edPatch(); else patchEdTop(); pushSoon(); return; }
    else if (kind === "yesno") v = t.value === "true";
    else if (kind === "artists") { v = []; Array.prototype.forEach.call(app.querySelectorAll('[data-pf="' + path + '"]'), function (c) { if (c.checked) v.push(c.value); }); }
    else if (kind === "colour-pick") {
      if (t.value === "custom") { var cin = app.querySelector('[data-pf="' + path + '"][data-kind="colour"]'); v = cin ? cin.value.toUpperCase() : "#1D4A35"; }
      else v = t.value;
      var sw = app.querySelector('[data-swatch="' + path + '"]'); if (sw) sw.hidden = t.value !== "custom";
    }
    else if (kind === "colour") { v = t.value.toUpperCase(); var sw2 = app.querySelector('[data-swatch="' + path + '"]'); if (sw2) sw2.style.background = v; }
    else v = t.value;
    pgSet(sel.sec.settings, path, v);
    pgd.what = sel.where === "item" ? "Edit " + itemName(pgd) : sel.where === "source" ? "Edit source: " + (sel.sec.settings.title || sel.id) : "Edit " + (sel.kind ? sel.kind.label : sel.id); pgMark(pgd); patchEdTop(); pushSoon();
    if (sel.where === "item" && (path === "title" || path === "name")) { var lt = app.querySelector(".ed-left .lt"); if (lt) lt.textContent = v; }
  }
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
    if (kind === "files-replace") { filesReplace(t); t.value = ""; return; }
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
  app.addEventListener("focusin", function (ev) { var b = ev.target.closest && ev.target.closest(".pk-item"); if (b) pickerHover(b); });
  app.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && app.querySelector && app.querySelector(".pk")) { var pe2 = pgOf(); if (pe2) { pe2.picker2 = null; edPatch(); } } });
  app.addEventListener("input", function (ev) {
    if (ev.target.dataset && ev.target.dataset.pickQ) {
      var words = ev.target.value.trim().toLowerCase(), any = false;
      Array.prototype.forEach.call(app.querySelectorAll(".pk-grp"), function (g) { var shown = 0; Array.prototype.forEach.call(g.querySelectorAll(".pk-item"), function (b) { var hit = !words || b.dataset.words.indexOf(words) >= 0; b.hidden = !hit; if (hit) shown++; }); g.hidden = !shown; if (shown) any = true; });
      var none = app.querySelector(".pk-none"); if (none) none.hidden = any;
      var firstHit = app.querySelector(".pk-item:not([hidden]):not([disabled])"); if (firstHit) pickerHover(firstHit);
      return;
    }
    var ed = ev.target.closest && ev.target.closest("[data-rich]");
    if (ed && ed.dataset.pfRich) { var pe = pgOf(), es = pe && pgSel(pe); if (es && rich[ed.dataset.rich]) { rich[ed.dataset.rich].dirty = true; pgSet(es.sec.settings, ed.dataset.rich, richOut(ed, rich[ed.dataset.rich].keep, false)); pe.what = "Edit " + (es.kind ? es.kind.label : es.id); pgMark(pe); patchEdTop(); pushSoon(); } return; }
    if (ed) { state.dirty = true; if (rich[ed.dataset.rich]) rich[ed.dataset.rich].dirty = true; return; }
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
  var demoData = { user: { email: "sample" }, sites: [
    { id: "world-art-review", name: "World Art Review", domain: "worldartreview.com", live: true, files: true, edits: true, artists: [], inbox: [],
      slots: [{ id: "artist-zara-muse", group: "Artist main images", label: "Zara Muse", filled: true, waiting: false }, { id: "artist-konn-artiss", group: "Artist main images", label: "Konn Artiss", filled: false, waiting: false }, { id: "article-sample", group: "Articles", label: "[Sample] An article", filled: false, waiting: false }] },
    { id: "global-art-monitor", name: "Global Art Monitor", domain: "globalartmonitor.com", live: true, files: true, edits: true, artists: [], inbox: ["slot--artist-zara-muse.jpg"],
      slots: [{ id: "artist-zara-muse", group: "Artist profile images", label: "Zara Muse", filled: false, waiting: true }, { id: "artist-konn-artiss", group: "Artist profile images", label: "Konn Artiss", filled: true, waiting: false }] },
    { id: "site-3", name: "Site 3", domain: "", live: false }, { id: "site-4", name: "Site 4", domain: "", live: false }, { id: "site-5", name: "Site 5", domain: "", live: false },
  ] };
  var demoHistory = [
    { sha: "a".repeat(40), what: "Edit article: [Sample] How to look at a painting", when: new Date().toISOString(), by: "you", canUndo: true },
    { sha: "b".repeat(40), what: "[Sample] An earlier change made outside the console", when: new Date(Date.now() - 86400000).toISOString(), by: "", canUndo: false },
  ];
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
  var DEMO_STEPS = { saveEntry: "Edit: sample entry", setHidden: "Hide or show: sample entry", deleteEntry: "Delete: sample entry", removePhoto: "Remove photo", uploadPhoto: "Add photo", saveTheme: "Theme: sample change", undo: "Undo: an earlier change" };
  // Sample pages for sample mode, generated from the server by tests/pages.mjs helpers.
  var demoKinds = {"opening":{"label":"Opening screen","about":"The short screen shown while the site loads.","fields":[{"name":"name","label":"Site name","type":"text","hint":"Shown beside the logo."},{"name":"tagline","label":"Tagline","type":"text","hint":"Small words under the name."}],"library":"","starter":null},"header":{"label":"Menu bar","about":"The bar at the top of every page.","fields":[{"name":"name","label":"Site name","type":"text","hint":"Shown in the middle of the bar."},{"name":"links","label":"Links","type":"rows","fields":[{"name":0,"label":"Words","type":"text","hint":"What visitors see."},{"name":1,"label":"Address","type":"text","hint":"A page on this site starts with #, for example #artists. Or paste a full web address."}]},{"name":"logos","label":"Logos","type":"rows","fields":[{"name":"image","label":"Logo","type":"image","alt":"alt","button":"Upload a logo","hint":"A PNG with a clear background works best."},{"name":"alt","label":"Name, read aloud to people who cannot see it","type":"text","hint":"For example Grove Gallery."},{"name":"size","label":"Size","type":"choice","seg":true,"dflt":"M","options":[["S","Small"],["M","Medium"],["L","Large"]]},{"name":"place","label":"Place in the menu bar","type":"choice","seg":true,"options":[["L","Left"],["C","Centre"],["R","Right"]]},{"name":"href","label":"Opens when clicked","type":"text","addr":true,"hint":"A page on this site such as #home, or a full web address starting https://. Leave empty for no link."}]}],"library":"","starter":null,"blocks":[{"field":"links","label":"Link","add":"Add a link","about":"A link on the left of the menu bar."},{"field":"logos","label":"Logo","add":"Add a logo","about":"A logo in the menu bar. Add more than one, for example the gallery's beside the site's."}]},"footer":{"label":"Newsletter and footer","about":"The sign-up band and the links at the bottom of every page.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"button","label":"Button words","type":"text","hint":"The button opens the sign-up form."},{"name":"blurb","label":"Short description of the site","type":"long","hint":"Shown under the name, at the bottom left."},{"name":"columns","label":"Link columns","type":"rows","fields":[{"name":"title","label":"Column title","type":"text","hint":"A short word or two, such as Read."},{"name":"links","label":"Links in this column","type":"rows","fields":[{"name":0,"label":"Words","type":"text","hint":"What visitors see."},{"name":1,"label":"Address","type":"text","hint":"A page on this site starts with #, for example #artists. Or paste a full web address."}]}]},{"name":"copyright","label":"Copyright line","type":"text"},{"name":"elsewhere","label":"Links in the bottom bar","type":"rows","fields":[{"name":0,"label":"Words","type":"text","hint":"What visitors see."},{"name":1,"label":"Address","type":"text","hint":"A page on this site starts with #, for example #artists. Or paste a full web address."}]}],"library":"","starter":null,"blocks":[{"field":"columns","label":"Column","add":"Add a column","about":""}]},"hero":{"label":"Opening banner","about":"The large green band, usually at the top of the home page. On another page it takes the place of the menu bar.","fields":[{"name":"headline","label":"Headline","type":"rows","hint":"Each line of the large headline. Italic lines are set in the slanted style.","fields":[{"name":"t","label":"Words","type":"text"},{"name":"ital","label":"In italics","type":"yesno"}]},{"name":"tagline","label":"Tagline","type":"rows","hint":"The smaller words at the bottom left of the banner.","fields":[{"name":"t","label":"Words","type":"text"},{"name":"ital","label":"In italics","type":"yesno"}]},{"name":"image","label":"Main picture","type":"image","alt":"alt","hint":"Leave empty to show the picture of the artist chosen below. A picture here is used in this banner only."},{"name":"alt","label":"Describe the picture","type":"text","hint":"Read aloud to people who cannot see it."},{"name":"credit","label":"Credit under the picture","type":"text","hint":"For example the title of the work and the photographer. Leave empty for none."},{"name":"artist","label":"Whose work is shown","type":"artists","one":true,"hint":"Leave empty for the first published artist. Their name and details sit beside the picture."},{"name":"rule_label","label":"Rule box, small line","type":"text","hint":"The box at the bottom right of the banner."},{"name":"rule_text","label":"Rule box, text","type":"text"},{"name":"rule_link","label":"Rule box, link words","type":"text","hint":"The link opens the page about sources."},{"name":"latest","label":"Pieces in the Latest box","type":"lines","hint":"Article names as they appear in web addresses, for example zara-muse-profile."},{"name":"hide_picture","label":"Hide the picture","type":"yesno","internal":true},{"name":"hide_rule","label":"Hide the rule box","type":"yesno","internal":true}],"library":"","starter":null,"blocks":[{"field":"headline","label":"Headline line","add":"Add a headline line","about":"One line of the large headline."},{"field":"picture","label":"Picture","add":"","about":"The picture on the right of the banner, with the artist's details beside it.","one":true,"hide":"hide_picture","fields":["image","alt","credit","artist"]},{"field":"tagline","label":"Tagline line","add":"Add a tagline line","about":"One line of the smaller words at the bottom left."},{"field":"latest","label":"Latest box piece","add":"Add a piece","about":"One piece shown in turn in the Latest box.","item":{"name":null,"label":"Piece","type":"piece"}},{"field":"rule","label":"Rule box","add":"","about":"The box at the bottom right of the banner.","one":true,"hide":"hide_rule","fields":["rule_label","rule_text","rule_link"]}]},"featured":{"label":"Featured artists","about":"The artist carousel under the banner. With no artists added, every published artist is shown.","fields":[{"name":"badge","label":"Badge words","type":"text","hint":"Under the number in the small square."},{"name":"artists","label":"Which artists","type":"artists","hint":"Tick the artists to show, in the order ticked. Leave all empty to show every published artist."}],"library":"","starter":null,"blocks":[{"field":"artists","label":"Artist","add":"Add an artist","about":"One artist in the carousel, in this order.","item":{"name":null,"label":"Which artist","type":"artists","one":true}}]},"section-list":{"label":"Read by section","about":"A list of the parts of the site, each with a count.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"rows","label":"Rows","type":"rows","fields":[{"name":"n","label":"Number","type":"text","hint":"Shown small on the left, such as 01."},{"name":"name","label":"Name","type":"text"},{"name":"desc","label":"Description","type":"text","hint":"One short sentence."},{"name":"href","label":"Address","type":"text","hint":"Where the row leads. A page on this site starts with #."},{"name":"count","label":"Count shown","hint":"The number on the right is counted for you.","type":"choice","options":[["artists","Artists"],["reviews","Reviews"],["explained","Art explained pieces"],["library","Library guides"],["articles","All articles"],["sources","Sources"]]},{"name":"unit","label":"Count word","type":"text"}]}],"library":"","starter":null,"blocks":[{"field":"rows","label":"Row","add":"Add a row","about":""}]},"explained":{"label":"Art, explained","about":"Two Art Explained articles beside a short introduction.","fields":[{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"text","label":"Text","type":"long","plain":true,"hint":"One or two sentences."},{"name":"count","label":"How many articles","type":"number","hint":"The newest Art Explained articles are shown."}],"library":"","starter":null},"numbers":{"label":"Numbers band","about":"Four figures counted from the site.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"labels","label":"The four labels","type":"lines","hint":"One label per line. The numbers are counted for you."}],"library":"Figures from the site, in a band","starter":{"eyebrow":"The review so far","heading":["Research you","can check"],"labels":["Artists documented","Articles and reviews","Sources cited","Facts with a numbered source"]}},"method":{"label":"How we research","about":"Three cards explaining the method.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"cards","label":"Cards","type":"rows","fields":[{"name":"n","label":"Number","type":"text","hint":"Shown large at the top of the card."},{"name":"title","label":"Title","type":"text","hint":"Shown in bold at the foot of the card."},{"name":"text","label":"Text","type":"long","hint":"Two or three short sentences read best."},{"name":"sub","label":"Small line","type":"text","hint":"Grey text under the title. Leave empty to hide."}]}],"library":"Three cards in a row","starter":{"eyebrow":"How we research","heading":["The work first,","then the story"],"cards":[{"n":"1","text":"Write here.","title":"A title","sub":"A small line"}]},"blocks":[{"field":"cards","label":"Card","add":"Add a card","about":""}]},"text":{"label":"Text","about":"A heading and a few paragraphs.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"body","label":"Text","type":"long","hint":"Type as you would in a document."},{"name":"align","label":"Placing","type":"choice","group":"Look","options":[["","Left"],["centre","Centred"]]},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"A heading and paragraphs","starter":{"eyebrow":"","heading":["A new heading"],"body":"<p>Write here.</p>","align":"","bg":"paper","fg":""}},"text-picture":{"label":"Text with picture","about":"Words on one side, a photo on the other.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"body","label":"Text","type":"long"},{"name":"image","label":"Picture","type":"image","alt":"alt"},{"name":"alt","label":"Describe the picture","type":"text","hint":"For people who cannot see it. Needed before you save."},{"name":"caption","label":"Caption","type":"text","hint":"Small text under the picture. Leave empty to hide."},{"name":"side","group":"Look","label":"Picture on the","type":"choice","options":[["right","Right"],["left","Left"]]},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"Words beside a photo","starter":{"eyebrow":"","heading":["A new heading"],"body":"<p>Write here.</p>","image":"","alt":"","caption":"","side":"right","bg":"paper","fg":""}},"picture":{"label":"Picture","about":"One large photo with a caption.","fields":[{"name":"image","label":"Picture","type":"image","alt":"alt"},{"name":"alt","label":"Describe the picture","type":"text","hint":"For people who cannot see it. Needed before you save."},{"name":"caption","label":"Caption","type":"text","hint":"Small text under the picture. Leave empty to hide."},{"name":"size","group":"Look","label":"Width","type":"choice","options":[["","Full width"],["contained","Contained"]]},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."}],"library":"One large photo, with a caption","starter":{"image":"","alt":"","caption":"","size":"","bg":"paper"}},"quote":{"label":"Quote","about":"One line, shown large.","fields":[{"name":"text","label":"The quote","type":"lines","hint":"Each line of the quote on its own line."},{"name":"who","label":"Who said it","type":"text","hint":"Leave empty to hide."},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"A short line that stands out","starter":{"text":["A line worth remembering."],"who":"","bg":"green","fg":""}},"articles":{"label":"Latest articles","about":"Article cards, filled in from Content.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"section","label":"Which articles","type":"choice","options":[["all","All"],["reviews","Reviews"],["explained","Art explained"],["library","Collector's library"],["features","Artist portfolios"]]},{"name":"count","label":"How many","type":"number"},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"Fills itself from Content","starter":{"eyebrow":"Latest","heading":["Recent pieces"],"section":"all","count":3,"bg":"paper","fg":""}},"faq":{"label":"Questions and answers","about":"Questions that open to show their answer.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"items","label":"Questions","type":"rows","fields":[{"name":"q","label":"Question","type":"text","hint":"Keep it short. Visitors click it to open the answer."},{"name":"a","label":"Answer","type":"long"}]},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"A list that opens and closes","starter":{"eyebrow":"","heading":["Questions"],"items":[{"q":"A question?","a":"<p>The answer.</p>"}],"bg":"paper","fg":""},"blocks":[{"field":"items","label":"Question","add":"Add a question","about":""}]},"button":{"label":"Button or link","about":"A heading, a line and one button.","fields":[{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"text","label":"Text","type":"text"},{"name":"label","label":"Button words","type":"text"},{"name":"href","label":"Where it goes","type":"text","hint":"A page on this site starts with #, or a full web address."},{"name":"style","label":"Style","type":"choice","group":"Look","options":[["green","Green"],["paper","Paper"],["outline","Outline"]]},{"name":"bg","label":"Background","type":"colour","group":"Look","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]],"hint":"Theme colours keep the site consistent. Choose Any colour for something else."},{"name":"fg","label":"Text colour","type":"colour","group":"Look","theme":[["","Automatic"]],"hint":"Automatic picks dark or light text to suit the background."}],"library":"Send visitors somewhere","starter":{"heading":["Find out more"],"text":"","label":"Read on","href":"#artists","style":"green","bg":"paper","fg":""}},"page-heading":{"label":"Page heading","about":"The heading at the top of a page.","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text","hint":"Shown in small italics. Leave empty to hide."},{"name":"heading","label":"Heading","type":"lines","hint":"Each line of the heading on its own line. Two short lines read best."},{"name":"intro","label":"Introduction","type":"long","plain":true}],"library":"A page's heading and introduction","starter":{"eyebrow":"A small line","heading":["A new","page"],"intro":""}},"long-text":{"label":"Long text","about":"Headings and paragraphs, in the narrow reading column.","fields":[{"name":"body","label":"Text","type":"long","cite":false,"hint":"Type as you would in a document. Grey square brackets mark wording still to be added."}],"library":"Headings and paragraphs to read","starter":{"body":"<h2>A heading</h2><p>Write here.</p>"}}};
  var demoPages = {"_how_to_edit":"Each page is a list of sections shown top to bottom. 'visible' hides a section without deleting it. 'settings' holds the words and choices for that section. Edit this from Artiscope Digital Home.","shared":{"opening":{"type":"opening","visible":true,"settings":{"name":"World Art Review","tagline":"Discover Artists. Understand Art."}},"header":{"type":"header","visible":true,"settings":{"name":"World Art Review","links":[["Artists A to Z","#artists"],["Reviews","#reviews"],["Art Explained","#explained"]],"logos":[]}},"footer":{"type":"footer","visible":true,"settings":{"eyebrow":"Get the review","heading":["New portfolios,","once a month."],"button":"Subscribe","blurb":"Researched artist portfolios, reviews and collecting guides. Discover Artists. Understand Art.","columns":[{"title":"Read","links":[["Artists A to Z","#artists"],["Reviews","#reviews"],["Art Explained","#explained"],["Exhibition Guides","#guides"]]},{"title":"Collect","links":[["Collector's Library","#library"],["Original or print?","#a-original-vs-print"],["Provenance","#a-provenance-certificates"],["Research an artist","#a-research-emerging-artist"]]},{"title":"About","links":[["How we research","#home"],["Sources","#standards"],["Suggest an artist","mailto:info@grovegallery.com?subject=Suggest%20an%20artist%20for%20World%20Art%20Review"],["Contact","mailto:info@grovegallery.com"]]}],"copyright":"© 2026 World Art Review. All rights reserved.","elsewhere":[["Instagram","#"],["X","#"],["LinkedIn","#"],["Privacy","#standards"],["Terms","#standards"]]}}},"pages":{"home":{"title":"Home","sections":[{"id":"hero","type":"hero","visible":true,"settings":{"headline":[{"t":"Discover","ital":false},{"t":"Artists.","ital":true}],"tagline":[{"t":"Understand","ital":false},{"t":"Art.","ital":true}],"image":"","alt":"","credit":"","artist":"","rule_label":"Our rule","rule_text":"Every fact carries a numbered source. Where only the gallery or the artist says so, we say so.","rule_link":"How we work","latest":["zara-muse-profile","konn-artiss-profile","review-anti-frieze"],"hide_picture":false,"hide_rule":false}},{"id":"featured","type":"featured","visible":true,"settings":{"badge":"Artist in focus","artists":[]}},{"id":"sections","type":"section-list","visible":true,"settings":{"eyebrow":"What you will find here","heading":["Read by","section"],"rows":[{"n":"01","name":"Artists A to Z","desc":"Researched portfolios: biography, style, career and selected works.","href":"#artists","count":"artists","unit":"portfolio"},{"n":"02","name":"Reviews","desc":"Close readings of single works, shows and interventions.","href":"#reviews","count":"reviews","unit":"review"},{"n":"03","name":"Art Explained","desc":"Techniques, materials and ideas, in plain language.","href":"#explained","count":"explained","unit":"guide"},{"n":"04","name":"Collector's Library","desc":"How to research an artist, read a certificate and tell an original from a print.","href":"#library","count":"library","unit":"guide"}]}},{"id":"explainedHome","type":"explained","visible":true,"settings":{"heading":["How to","look at","a painting"],"text":"Short, sourced explainers on the techniques and materials behind the work, so you know what you are looking at before you look it up.","count":2}},{"id":"numbers","type":"numbers","visible":true,"settings":{"eyebrow":"The review so far","heading":["Research you","can check"],"labels":["Artists documented","Articles and reviews","Sources cited","Facts with a numbered source"]}},{"id":"method","type":"method","visible":true,"settings":{"eyebrow":"How we research","heading":["The work first,","then the story"],"cards":[{"n":"1","title":"Start with the work","text":"<p>We start with the work itself : what it is made of, how it was made and where it has been shown.</p>","sub":"Seen, measured, described"},{"n":"2","title":"Every fact, sourced","text":"Every fact in a portfolio carries a numbered source you can open and read for yourself.","sub":"Press, auction records, gallery files"},{"n":"3","title":"Publicity, flagged","text":"Claims that come only from publicity are labelled <span class=\"reported\">Reported</span> so you can weigh them.","sub":"Kept apart from checked fact"}]}}]},"standards":{"title":"Editorial standards","sections":[{"id":"heading","type":"page-heading","visible":true,"settings":{"eyebrow":"Editorial standards","heading":["How we research","and what we publish"],"intro":"The rules every portfolio and article on World Art Review follows."}},{"id":"text","type":"long-text","visible":true,"settings":{"body":"\n  <h2>Every fact has a source</h2><p>Each fact in an artist portfolio carries a numbered citation to where it came from. If we cannot source something, we do not state it as fact; it appears as a gap to be filled.</p>\n  <h2>We say who said it</h2><p>We label sources by type: independent reporting, interviews with the artist, the artist's or gallery's own publicity, and gallery records. A claim that comes only from publicity is marked <span class=\"reported\">Reported</span>.</p>\n  <h2>We show what is missing</h2><p>Portfolios show a research status: how many facts are sourced and how many dates or details are still awaiting confirmation.</p>\n  <h2>Our relationships</h2><p><span class=\"placeholder\">[Disclosure of the link between World Art Review and Grove Gallery, wording to confirm.]</span></p>\n  <h2>Corrections</h2><p>If you spot an error, write to <a href=\"mailto:info@grovegallery.com?subject=Correction\">info@grovegallery.com</a>. We correct promptly and note the change on the page.</p>\n  <h2>Privacy and terms</h2><p><span class=\"placeholder\">[Privacy notice and terms of use to be added before launch.]</span></p>\n  "}}]}},"lists":{"artists":{"eyebrow":"Artists A to Z","heading":["Every artist,","researched and sourced"],"intro":"Each portfolio brings together biography, documented works, a career timeline and the sources behind every fact. Portfolios marked in research are being compiled now."},"reviews":{"eyebrow":"Reviews","heading":["Recent reviews","and comparisons"],"intro":"Considered responses to individual works and projects, and side-by-side comparisons of artists."},"explained":{"eyebrow":"Art Explained","heading":["How the work is made,","and why it matters"],"intro":"Plain-language guides to the techniques, materials and ideas behind the artworks."},"library":{"eyebrow":"Collector's Library","heading":["Buy with your","eyes open"],"intro":"Practical, independent guidance on researching artists, understanding what you are buying and keeping good records."},"guides":{"eyebrow":"Exhibition Guides","heading":["What to see,","and how to see it"],"intro":"Short, practical guides to current exhibitions featuring the artists we cover."},"search":{"eyebrow":"Search","heading":["Search the","archive"],"intro":"Artists, artworks, techniques and collecting guides."},"research":{"eyebrow":"Research desk","heading":["What still needs","to be added"],"intro":"An internal checklist, drawn from the portfolios themselves. Each item disappears once the information is added. Not for the public site."}}};
  var demoFiles = ["zara-muse-portrait.jpg", "article-palette-knife-painting.jpg"];
  var demoMeta = { "zara-muse-portrait.jpg": { alt: "Zara Muse's portrait, painted with a palette knife in warm reds and gold", caption: "" } };
  var demoSpots = [{"key":"artist:zara-muse","kind":"artist","label":"Zara Muse","group":"Artists","also":"Zara Muse's portfolio and the home page","image":"zara-muse-portrait.jpg","alt":"A painting in thick palette knife strokes of a woman seen from behind, with a pale blonde bob and bare shoulders, against a deep blue background.","credit":"Image: painting by Zara Muse. Supplied by Grove Gallery","published":true,"slot":"artist-zara-muse","hasCredit":true},{"key":"work:zara-muse:0","kind":"work","label":"Malala Yousafzai","group":"Artworks: Zara Muse","also":"Zara Muse's portfolio","image":"","alt":"","credit":"","slot":"work-zara-muse-malala-yousafzai","hasCredit":false},{"key":"work:zara-muse:1","kind":"work","label":"Bella Dama del Sol","group":"Artworks: Zara Muse","also":"Zara Muse's portfolio","image":"","alt":"","credit":"","slot":"work-zara-muse-bella-dama-del-sol","hasCredit":false},{"key":"work:zara-muse:2","kind":"work","label":"Delicada Belleza","group":"Artworks: Zara Muse","also":"Zara Muse's portfolio","image":"","alt":"","credit":"","slot":"work-zara-muse-delicada-belleza","hasCredit":false},{"key":"work:zara-muse:3","kind":"work","label":"Ecos de Azul","group":"Artworks: Zara Muse","also":"Zara Muse's portfolio","image":"","alt":"","credit":"","slot":"work-zara-muse-ecos-de-azul","hasCredit":false},{"key":"work:zara-muse:4","kind":"work","label":"Gracia de Azafra","group":"Artworks: Zara Muse","also":"Zara Muse's portfolio","image":"","alt":"","credit":"","slot":"work-zara-muse-gracia-de-azafra","hasCredit":false},{"key":"work:zara-muse:5","kind":"work","label":"Oro Roja","group":"Artworks: Zara Muse","also":"Zara Muse's portfolio","image":"","alt":"","credit":"","slot":"work-zara-muse-oro-roja","hasCredit":false},{"key":"work:zara-muse:6","kind":"work","label":"Viento del Sur","group":"Artworks: Zara Muse","also":"Zara Muse's portfolio","image":"","alt":"","credit":"","slot":"work-zara-muse-viento-del-sur","hasCredit":false},{"key":"work:zara-muse:7","kind":"work","label":"A Moment in Amber","group":"Artworks: Zara Muse","also":"Zara Muse's portfolio","image":"","alt":"","credit":"","slot":"work-zara-muse-a-moment-in-amber","hasCredit":false},{"key":"artist:konn-artiss","kind":"artist","label":"Konn Artiss","group":"Artists","also":"Konn Artiss's portfolio and the home page","image":"grove-gallery-23-7-26-018402.jpg","alt":"Konn Artiss","credit":"Image: ANTI-FRIEZE, London, October 2025. Courtesy Konn Artiss","published":true,"slot":"artist-konn-artiss","hasCredit":true},{"key":"work:konn-artiss:0","kind":"work","label":"The Washington Ghost","group":"Artworks: Konn Artiss","also":"Konn Artiss's portfolio","image":"","alt":"","credit":"","slot":"work-konn-artiss-the-washington-ghost","hasCredit":false},{"key":"work:konn-artiss:1","kind":"work","label":"Venice canal effigy","group":"Artworks: Konn Artiss","also":"Konn Artiss's portfolio","image":"","alt":"","credit":"","slot":"work-konn-artiss-venice-canal-effigy","hasCredit":false},{"key":"work:konn-artiss:2","kind":"work","label":"ANTI-FRIEZE","group":"Artworks: Konn Artiss","also":"Konn Artiss's portfolio","image":"","alt":"","credit":"","slot":"work-konn-artiss-anti-frieze","hasCredit":false},{"key":"work:konn-artiss:3","kind":"work","label":"Frieze week ice blocks","group":"Artworks: Konn Artiss","also":"Konn Artiss's portfolio","image":"","alt":"","credit":"","slot":"work-konn-artiss-frieze-week-ice-blocks","hasCredit":false},{"key":"artist:zen-xander","kind":"artist","label":"Zen Xander","group":"Artists","also":"Zen Xander's portfolio and the home page","image":"","alt":"","credit":"","published":false,"slot":"artist-zen-xander","hasCredit":true},{"key":"article:zara-muse-profile","kind":"article","label":"Zara Muse: biography, artistic style and career","group":"Articles: Features","section":"features","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: Zara Muse portrait, detail. Supplied by Grove Gallery","slot":"article-zara-muse-profile","hasCredit":true},{"key":"article:konn-artiss-profile","kind":"article","label":"Konn Artiss: artist profile and selected works","group":"Articles: Features","section":"features","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: ANTI-FRIEZE, London, 2025. Courtesy Konn Artiss","slot":"article-konn-artiss-profile","hasCredit":true},{"key":"article:palette-knife-painting","kind":"article","label":"Understanding palette-knife painting","group":"Articles: Art explained","section":"explained","hidden":false,"also":"the article and its card in every list","image":"article-palette-knife-painting.jpg","alt":"Looking close on the strokes","credit":"Image: palette-knife detail.","slot":"article-palette-knife-painting","hasCredit":true},{"key":"article:texture-in-portraiture","kind":"article","label":"The role of texture in contemporary portraiture","group":"Articles: Art explained","section":"explained","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: portrait surface, raking light. [Image to supply]","slot":"article-texture-in-portraiture","hasCredit":true},{"key":"article:how-to-look-at-a-painting","kind":"article","label":"How to look at a painting in ten minutes","group":"Articles: Art explained","section":"explained","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: a visitor in front of a painting. [Image to supply]","slot":"article-how-to-look-at-a-painting","hasCredit":true},{"key":"article:oil-and-acrylic","kind":"article","label":"Oil or acrylic: what the difference means for the person who owns it","group":"Articles: Art explained","section":"explained","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: tubes of oil and acrylic paint. [Image to supply]","slot":"article-oil-and-acrylic","hasCredit":true},{"key":"article:glossary-of-paint","kind":"article","label":"A short glossary of paint, from impasto to sgraffito","group":"Articles: Art explained","section":"explained","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"","slot":"article-glossary-of-paint","hasCredit":true},{"key":"article:what-is-an-intervention","kind":"article","label":"What is an art intervention?","group":"Articles: Art explained","section":"explained","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: ANTI-FRIEZE, London, 2025. Courtesy Konn Artiss","slot":"article-what-is-an-intervention","hasCredit":true},{"key":"article:how-prints-are-made","kind":"article","label":"How prints are made: screenprint, etching, lithograph and giclée","group":"Articles: Art explained","section":"explained","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: a screenprinting squeegee. [Image to supply]","slot":"article-how-prints-are-made","hasCredit":true},{"key":"article:research-emerging-artist","kind":"article","label":"How to research an emerging artist","group":"Articles: Collecting library","section":"library","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"","slot":"article-research-emerging-artist","hasCredit":true},{"key":"article:original-vs-print","kind":"article","label":"Original, limited edition or open print?","group":"Articles: Collecting library","section":"library","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"","slot":"article-original-vs-print","hasCredit":true},{"key":"article:provenance-certificates","kind":"article","label":"Provenance and certificates, explained","group":"Articles: Collecting library","section":"library","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"","slot":"article-provenance-certificates","hasCredit":true},{"key":"article:mixed-media","kind":"article","label":"Mixed-media art: materials, meaning and conservation","group":"Articles: Art explained","section":"explained","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: ANTI-FRIEZE, 2025. Courtesy Konn Artiss","slot":"article-mixed-media","hasCredit":true},{"key":"article:review-anti-frieze","kind":"article","label":"ANTI-FRIEZE: what melts when the art market is put on ice","group":"Articles: Reviews","section":"reviews","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: ANTI-FRIEZE, London, October 2025. Courtesy Konn Artiss","slot":"article-review-anti-frieze","hasCredit":true},{"key":"article:review-washington-ghost","kind":"article","label":"The Washington Ghost: satire as a printed newspaper","group":"Articles: Reviews","section":"reviews","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"Image: The Washington Ghost, Venice, 2025. [Image to supply]","slot":"article-review-washington-ghost","hasCredit":true},{"key":"article:compare-muse-artiss","kind":"article","label":"Zara Muse and Konn Artiss: two ways to talk about value","group":"Articles: Reviews","section":"reviews","hidden":false,"also":"the article and its card in every list","image":"","alt":"","credit":"","slot":"article-compare-muse-artiss","hasCredit":true}];
  var demoSummaries = { "shared:opening": "World Art Review", "shared:header": "3 links", "shared:footer": "3 columns", "home:hero": "Discover Artists.", "home:featured": "All published", "home:sections": "4 rows", "home:explainedHome": "2 articles", "home:numbers": "Four figures", "home:method": "3 cards" };
  var demoSite = null;   // the sample site's articles, artists and sources, read once from assets/demo-site.json
  var demoGam = null;    // Global Art Monitor's sample, from assets/demo-gam.json
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
    if (body.action === "pages" && !demoSite) return fetch("assets/demo-site.json").then(function (r) { return r.json(); }).then(function (d) { demoSite = d; if (!demoPages.lists) demoPages.lists = d.pageLists; return demoApi(body); }, function () { demoSite = { site: null, itemKinds: null, lists: {}, listFields: [] }; return demoApi(body); });
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        var a = body.action, c = body.site ? demoCopy(body) : null, l = body.site ? demoList(body.site) : null;
        if (DEMO_STEPS[a]) demoStep(body, DEMO_STEPS[a]);
        if (a === "overview") {
          var d = JSON.parse(JSON.stringify(demoData));
          d.sites.forEach(function (x) { if (!x.live) return; var list = demoList(x.id), want = (body.copies || {})[x.id]; x.copies = JSON.parse(JSON.stringify(list)); x.copy = (list.find(function (y) { return y.id === want; }) || list[0]).id; });
          resolve(d);
        }
        else if (a === "content") resolve({ collections: JSON.parse(JSON.stringify(demoContent)) });
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
        else if (a === "theme") { if (params.has("preview")) demoTheme.spec.url = params.get("preview"); resolve(JSON.parse(JSON.stringify(demoTheme))); }
        else if (a === "saveTheme") { demoTheme.values = JSON.parse(JSON.stringify(body.values)); resolve({ ok: true, values: body.values }); }
        else if (a === "uploadPhoto") resolve({ ok: true, name: (body.slot ? "slot--" + body.slot : "note--" + String(body.description).toLowerCase().replace(/[^a-z0-9]+/g, "-")) + "." + body.ext });
        else if (a === "undoStep") { var n = Math.min(Number(body.steps) || 1, c.steps.length); if (!n) return reject(new Error("There is nothing more to undo.")); while (n--) c.redo.push(c.steps.shift()); c.ahead = c.kind === "live" ? 0 : c.steps.length; c.canRedo = true; resolve({ ok: true }); }
        else if (a === "redoStep") { if (!c.redo.length) return reject(new Error("There is nothing to redo.")); c.steps.unshift(c.redo.pop()); c.ahead = c.kind === "live" ? 0 : c.steps.length; c.canRedo = c.redo.length > 0; resolve({ ok: true }); }
        else if (a === "publish") { c.steps = []; c.redo = []; c.ahead = 0; c.behind = 0; c.canRedo = false; l[0].steps.unshift({ what: "Make live: " + c.name, when: new Date().toISOString(), by: "sample" }); resolve({ ok: true }); }
        else if (a === "refreshCopy") { c.behind = 0; resolve({ ok: true }); }
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
  window.__adh = { state: state, render: render, esc: esc, go: go, openSite: openSite, pgOf: pgOf, themeCss: themeCss, richIn: richIn, richOut: richOut, richInline: richInline };
  start();
})();
