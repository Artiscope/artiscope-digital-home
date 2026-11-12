/* Artiscope Digital Home: the console.
   Plain JavaScript, no build step. Everything shown from GitHub is
   escaped before it reaches the page. */
(function () {
  "use strict";

  var VERSION = "16";   // shown on screen so it is clear which copy is loaded
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
  function colours(id) { return COLOURS[id] || ["#1B2132", "#6F7890"]; }

  // ---------- talking to the server ----------

  async function api(action, payload) {
    var body = Object.assign({ action: action }, payload || {});
    if (body.site && body.copy == null) body.copy = state.copy[body.site] || "";
    if (action === "overview") body.copies = state.copy;
    if (demo) return demoApi(body);
    var res = await sb.functions.invoke(cfg.functionName || "home", { body: body });
    if (res.error) throw new Error(await explain(res.error));
    return res.data;
  }

  // Turns a failed call to the server function into a plain sentence
  // that says which setup step to look at.
  async function explain(error) {
    var ctx = error && error.context, status = ctx && typeof ctx.status === "number" ? ctx.status : 0, detail = null;
    try { if (ctx && typeof ctx.json === "function") detail = await ctx.json(); } catch (e) { detail = null; }
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
        state.pg[s.id] = { doc: pgd.pages, base: canon(pgd.pages), kinds: pgd.kinds, summaries: pgd.summaries || {}, images: pgd.images || [], artists: pgd.artists || [], preview: pgd.preview, page: pref.page && pgd.pages.pages[pref.page] ? pref.page : "home", sel: pref.sel || null, mode: pref.mode || "computer", panel: "", dirty: false, sent: false };
        render();
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
      if (s) { delete state.history[s.id]; delete state.content[s.id]; delete state.theme[s.id]; delete state.pg[s.id]; }
      try { await refreshCopies(); } catch (e2) { /* the next refresh will catch up */ }
      delete state.busy[k]; render();
      await ensure(true);
    } catch (e) {
      state.status = "live"; state.notice = { text: e.message, problem: true };
      delete state.busy[k]; render();
    }
  }

  // ---------- the frame: menu, floating bar ----------

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
  function navItems() { return state.inSite && site() ? NAV : NAV.slice(0, 1); }
  function navIndex(tab) { var i = navItems().findIndex(function (n) { return n[0] === tab; }); return i < 0 ? 0 : i; }
  function mark() { return '<svg width="24" height="24" viewBox="0 0 26 26"><path d="M2 24V10l11-9 11 9v14z" fill="#A9BCE0"></path><rect x="10" y="14" width="6" height="10" fill="#141927"></rect></svg>'; }

  // The floating bar: which site, and what state its changes are in.
  function islandBusy() { return state.status !== "live" || (curCopy().kind === "trial" && curCopy().ahead > 0); }
  function islandInner() {
    var s = site(), list = copiesOf(s), c = curCopy(), trial = c.kind === "trial", busy = state.status === "saving";
    if (!state.inSite || !s) {
      return '<span class="dot" aria-hidden="true" style="background:#55678C"></span><b class="island-name">All sites</b><span class="small">' + (state.status === "saving" ? "Saving" : state.flash || "Pick a site to work on") + '</span>';
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
      : '<span class="tick" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="#A9BCE0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>';
    return '<span class="dot" aria-hidden="true" style="background:' + (s ? colours(s.id)[0] : "#55678C") + '"></span>' +
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
    var from = navIndex(state.prevTab), to = navIndex(state.tab);
    var nav = navItems().map(function (n) {
      var on = n[0] === state.tab;
      return '<button type="button" class="navb' + (on ? " on" : "") + '" data-tab="' + n[0] + '"' + (on ? ' aria-current="page"' : "") + '>' +
        '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="' + n[2] + '"></path><path class="o" d="' + n[2] + '"></path><path class="d" d="' + n[3] + '"></path></svg>' +
        '<span>' + n[1] + '</span></button>';
    }).join("");
    return '<div class="shell">' +
      '<nav class="rail" aria-label="Sections">' +
        '<div class="brand"><span class="brand-mark" aria-hidden="true">' + mark() + '</span><span class="brand-name">Artiscope<br>Digital Home</span></div>' +
        (state.inSite && s ? '<div class="where"><span class="small">Working in</span><b>' + esc(s.name) + '</b></div>' : "") +
        '<div class="nav"><span class="well" aria-hidden="true" data-to="' + (to * 58) + '" style="top:' + (from * 58) + 'px"></span>' +
          '<span class="bulge' + (from !== to ? " go" : "") + '" aria-hidden="true" data-to="' + (to * 58) + '" style="top:' + (from * 58) + 'px"><i></i></span>' + nav + '</div>' +
        '<div class="rail-foot">' +
          (demo ? '<span class="small">Sample mode. Example data only, nothing is saved.</span>' : '<span class="small">Signed in as ' + esc(state.email) + '</span>') +
          '<button type="button" class="linklike small" data-act="refresh">Refresh</button>' +
          (demo ? "" : '<button type="button" class="linklike small" data-act="signout">Sign out</button>') +
          '<span class="small">Version ' + VERSION + '</span>' +
        '</div>' +
      '</nav>' +
      '<main class="main">' +
        '<div class="island-row"><div class="island' + (islandBusy() ? " busy" : "") + '" role="status">' + islandInner() + '</div></div>' +
        '<div class="column fade">' +
          (state.notice ? '<p class="notice' + (state.notice.problem ? " problem" : "") + '" role="status">' + esc(state.notice.text) + '</p>' : "") +
          viewAsk() + inner +
        '</div></main></div>';
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
    return '<div class="page-head"><span class="small">' + esc(today()) + '</span><h1 style="font-size:48px">' + greeting() + '</h1>' +
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
        tile("content", entries, "Content", (cols ? cols.map(function (c) { return c.label.toLowerCase(); }).join(", ") : "Articles, artists and more"), "Edit, hide or delete") +
        tile("theme", colourCount == null ? "" : colourCount, "Theme", "Colours and typefaces", "Change the look") +
        tile("photos", empty, "Photos", empty + " empty " + (empty === 1 ? "spot" : "spots") + ", " + waiting + " on the way", "Add photos") +
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
      if (ev.data.type === "adh-click") { var pgd = pgOf(); if (!pgd) return; try { if (ev.origin !== new URL(pgd.preview).origin) return; } catch (e) { return; } pickSection(String(ev.data.id || "")); return; }
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
    state.busy.copy = true;
    change(key("copy", s.id), function () { return api("makeCopy", { site: s.id, name: name }); },
      function (out) { delete state.busy.copy; state.copyName = ""; if (out && out.copy) state.copy[s.id] = out.copy; }, "Trial copy made. You are working on it now").then(function () { delete state.busy.copy; });
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
    if (q.where === "shared") { var part = pgd.doc.shared[q.id]; return part ? { where: "shared", id: q.id, sec: part, kind: pgd.kinds[part.type] } : null; }
    var sec = pgSections(pgd).find(function (x) { return x.id === q.id; });
    return sec ? { where: "page", id: q.id, sec: sec, kind: pgd.kinds[sec.type] } : null;
  }
  function pgSummary(pgd, where, key, sec) {
    var k = pgd.kinds[sec.type]; if (!k) return "";
    var own = pgd.summaries[(where === "shared" ? "shared:" : pgd.page + ":") + key];
    return own != null ? own : "";
  }
  function pgMark(pgd) { pgd.dirty = canon(pgd.doc) !== pgd.base; state.dirty = pgd.dirty; }

  function viewLeave() {
    return state.leave ? '<div class="sunk stack ask"><b>You have changes that are not saved yet.</b>' +
      '<div class="row"><button type="button" class="btn" data-act="leave-save">Save</button><button type="button" class="soft" data-act="leave-go">Leave without saving</button><button type="button" class="linklike" data-act="leave-stay">Keep editing</button></div></div>' : "";
  }
  function viewPagesEditor(s) {
    var pgd = pgOf();
    if (!pgd) return '<div class="ed"><div class="ed-top">' + edTop(s, null) + '</div><p class="loading" style="grid-column:1/-1">Reading the pages of ' + esc(s.name) + '</p></div>';
    var sel = pgSel(pgd), right = pgd.panel === "library" ? edLibrary(pgd) : sel ? edSettings(pgd, sel) : "";
    return '<div class="ed' + (right ? " with-right" : "") + '">' +
      '<div class="ed-top">' + edTop(s, pgd) + '</div>' +
      '<div class="ed-left">' + edList(pgd) + '</div>' +
      '<div class="ed-mid">' + viewLeave() + viewAsk() + (state.notice ? '<p class="notice' + (state.notice.problem ? " problem" : "") + '" role="status">' + esc(state.notice.text) + '</p>' : "") +
        '<div class="ed-frame ' + esc(pgd.mode) + '"><iframe id="ed-frame" title="The page being edited" src="' + esc(pgd.preview) + '"></iframe></div>' +
        '<span class="small">The real page, redrawn as you edit. Click any part of it to open its settings. Nothing is kept until you press Save.</span></div>' +
      (right ? '<div class="ed-right">' + right + '</div>' : "") + '</div>';
  }
  function edTop(s, pgd) {
    var c = curCopy(), trial = c.kind === "trial";
    return '<button type="button" class="linklike small" data-tab="overview">Overview</button><b class="island-name">' + esc(s.name) + '</b>' +
      (copiesOf(s).length > 1 ? '<select class="copypick" data-change="copy" aria-label="Working on">' + copiesOf(s).map(function (x) { return '<option value="' + esc(x.kind === "live" ? "" : x.id) + '"' + (x.id === c.id ? " selected" : "") + '>' + esc(x.kind === "live" ? "Live site" : "Trial: " + x.name) + '</option>'; }).join("") + '</select>' : '<span class="chip quiet">' + (trial ? "Trial: " + esc(c.name) : "Live site") + '</span>') +
      '<div class="mid"><div class="seg mini">' + (pgd ? Object.keys(pgd.doc.pages).map(function (k) { return '<button type="button" class="' + (k === pgd.page ? "on" : "") + '" data-act="ed-page" data-page="' + esc(k) + '">' + esc(pgd.doc.pages[k].title || k) + '</button>'; }).join("") : "") + '</div></div>' +
      '<div class="seg mini"><button type="button" class="' + (!pgd || pgd.mode === "computer" ? "on" : "") + '" data-act="ed-mode" data-mode="computer">Computer</button><button type="button" class="' + (pgd && pgd.mode === "phone" ? "on" : "") + '" data-act="ed-mode" data-mode="phone">Phone</button></div>' +
      '<button type="button" class="soft slim" data-act="undo-step"' + ((trial ? c.ahead > 0 : (c.steps || []).length > 0) && state.status !== "saving" ? "" : " disabled") + '>Undo</button>' +
      '<button type="button" class="soft slim" data-act="redo-step"' + (c.canRedo && state.status !== "saving" ? "" : " disabled") + '>Redo</button>' +
      '<span class="small" id="island-text">' + esc(state.status === "saving" ? "Saving" : pgd && pgd.dirty ? "Edited, not saved" : state.flash || (trial ? (c.ahead ? c.ahead + (c.ahead === 1 ? " change" : " changes") + " on this copy" : "Same as the live site") : "Live site")) + '</span>' +
      (pgd && pgd.dirty ? '<button type="button" class="linklike small" data-act="ed-discard">Discard</button><button type="button" class="btn slim" data-act="ed-save"' + (state.status === "saving" ? " disabled" : "") + '>Save</button>'
        : trial && c.ahead ? '<button type="button" class="btn slim" data-act="ask-makelive">Make live</button>' : "") +
      '<span class="small" style="margin-left:6px">Version ' + VERSION + '</span>';
  }
  function edRow(pgd, where, id, sec, picked) {
    var k = pgd.kinds[sec.type] || { label: sec.type }, hidden = sec.visible === false;
    return '<div class="sec' + (picked ? " on" : "") + (hidden ? " off" : "") + '" data-act="ed-pick" data-where="' + where + '" data-id="' + esc(id) + '"' + (where === "page" ? ' draggable="true"' : "") + '>' +
      (where === "page" ? '<span class="grip" aria-hidden="true"><i></i><i></i><i></i></span>' : '<span class="grip" aria-hidden="true"></span>') +
      '<span class="nm">' + esc(k.label) + '<small id="sum-' + esc(where + "-" + id) + '">' + esc(pgSummary(pgd, where, id, sec)) + '</small></span>' + (hidden ? '<span class="eye">Hidden</span>' : "") + '</div>';
  }
  function edList(pgd) {
    var sel = pgd.sel || {}, sh = pgd.doc.shared || {};
    var top = ["opening", "header"].filter(function (k) { return sh[k]; }), bottom = ["footer"].filter(function (k) { return sh[k]; });
    return '<div class="grp">Top of every page</div>' + top.map(function (k) { return edRow(pgd, "shared", k, sh[k], sel.where === "shared" && sel.id === k); }).join("") +
      '<div class="grp">' + esc(pgPage(pgd).title || pgd.page) + '</div><div id="ed-sections">' + pgSections(pgd).map(function (x) { return edRow(pgd, "page", x.id, x, sel.where === "page" && sel.id === x.id); }).join("") + '</div>' +
      '<button type="button" class="addl" data-act="ed-library">+ &nbsp;Add a section</button>' +
      '<div class="grp">Bottom of every page</div>' + bottom.map(function (k) { return edRow(pgd, "shared", k, sh[k], sel.where === "shared" && sel.id === k); }).join("") +
      '<div class="grp">Also on this site</div>' +
      '<button type="button" class="sec plain" data-tab="theme"><span class="nm">Theme: colours and typefaces</span></button>' +
      '<button type="button" class="sec plain" data-tab="content"><span class="nm">Content: articles, artists, sources</span></button>' +
      '<button type="button" class="sec plain" data-tab="photos"><span class="nm">Photos</span></button>' +
      '<button type="button" class="sec plain" data-tab="history"><span class="nm">History</span></button>';
  }
  function edLibrary(pgd) {
    var kinds = Object.keys(pgd.kinds).filter(function (k) { return pgd.kinds[k].library; });
    return '<div class="rhead"><button type="button" class="linklike small" data-act="ed-panel-close">Cancel</button><h2>Add a section</h2><span class="small">' + (pgd.sel && pgd.sel.where === "page" ? "It goes under the section you picked." : "It goes at the end of the page.") + ' You can move it afterwards.</span></div>' +
      '<div class="kinds">' + kinds.map(function (k) { return '<button type="button" class="kind" data-act="ed-add" data-kind="' + esc(k) + '"><b>' + esc(pgd.kinds[k].label) + '</b><span class="small">' + esc(pgd.kinds[k].library) + '</span></button>'; }).join("") + '</div>';
  }
  function edSettings(pgd, sel) {
    var kind = sel.kind || { label: sel.sec.type, fields: [] }, st = sel.sec.settings || {}, page = sel.where === "page";
    var idx = page ? pgSections(pgd).findIndex(function (x) { return x.id === sel.id; }) : -1, n = pgSections(pgd).length;
    var fields = kind.fields.map(function (f) { return edField(pgd, f, st[f.name], f.name); }).join("");
    var removing = state.confirm === "ed-remove|" + sel.id;
    return '<div class="rhead"><button type="button" class="linklike small" data-act="ed-panel-close">Done</button><h2>' + esc(kind.label) + '</h2>' + (sel.sec.visible === false ? '<span class="chip quiet" style="align-self:flex-start">Hidden from the page</span>' : "") + '</div>' +
      '<form class="stack" data-form="section">' + (fields || '<span class="small" style="margin:0 6px">Nothing to set here.</span>') + '</form>' +
      '<div class="row edacts">' +
        '<button type="button" class="soft slim" data-act="ed-hide">' + (sel.sec.visible === false ? "Show" : "Hide") + '</button>' +
        (page ? '<button type="button" class="soft slim" data-act="ed-dup">Duplicate</button>' +
          '<button type="button" class="soft slim" data-act="ed-move" data-dir="-1"' + (idx > 0 ? "" : " disabled") + '>Move up</button>' +
          '<button type="button" class="soft slim" data-act="ed-move" data-dir="1"' + (idx < n - 1 ? "" : " disabled") + '>Move down</button>' +
          (removing ? '<span class="small">Remove it? </span><button type="button" class="btn slim" data-act="ed-remove">Yes, remove</button><button type="button" class="linklike small" data-act="cancel">Keep</button>'
            : '<button type="button" class="linklike small" data-act="ask" data-k="ed-remove|' + esc(sel.id) + '">Remove</button>') : "") +
      '</div>';
  }
  var FIELD_N = 0;
  function edField(pgd, f, value, path) {
    var id = "pf-" + (FIELD_N++), label = '<label for="' + id + '">' + esc(f.label) + '</label>', hint = f.hint ? '<span class="small">' + esc(f.hint) + '</span>' : "", input = "";
    var t = f.type, v = value;
    if (t === "text") input = '<input type="text" id="' + id + '" data-pf="' + esc(path) + '" value="' + esc(v == null ? "" : v) + '">';
    else if (t === "long") {
      if (f.plain) input = '<textarea id="' + id + '" data-pf="' + esc(path) + '">' + esc(v == null ? "" : v) + '</textarea>';
      else { richSource[path] = { html: String(v || ""), dirty: false }; input = '<div class="rt">' + richTools(id, true) + '<div class="rt-page short" id="' + id + '" data-rich="' + esc(path) + '" data-pf-rich="1" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true" lang="en-GB"></div></div>'; }
    } else if (t === "lines") input = '<textarea id="' + id + '" data-pf="' + esc(path) + '" data-kind="lines" rows="3">' + esc((Array.isArray(v) ? v : [v || ""]).join("\n")) + '</textarea>' + (f.hint ? "" : '<span class="small">One line each.</span>');
    else if (t === "number") input = '<input type="number" step="1" id="' + id + '" data-pf="' + esc(path) + '" data-kind="number" value="' + esc(v == null ? "" : v) + '" style="max-width:140px">';
    else if (t === "yesno") input = '<select class="box" id="' + id + '" data-pf="' + esc(path) + '" data-kind="yesno"><option value="true"' + (v === true ? " selected" : "") + '>Yes</option><option value="false"' + (v === true ? "" : " selected") + '>No</option></select>';
    else if (t === "choice") input = '<select class="box" id="' + id + '" data-pf="' + esc(path) + '">' + f.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v == null ? "" : v) === o[0] ? " selected" : "") + '>' + esc(o[1]) + '</option>'; }).join("") + '</select>';
    else if (t === "colour") {
      var theme = f.theme || [], isTheme = theme.some(function (o) { return o[0] === String(v == null ? "" : v); }), custom = isTheme ? "#1D4A35" : (v || "#1D4A35");
      input = '<div class="row"><select class="box" id="' + id + '" data-pf="' + esc(path) + '" data-kind="colour-pick" style="max-width:220px">' + theme.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (isTheme && o[0] === String(v == null ? "" : v) ? " selected" : "") + '>' + esc(o[1]) + '</option>'; }).join("") + '<option value="custom"' + (isTheme ? "" : " selected") + '>Any colour</option></select>' +
        '<label class="sw small" style="background:' + esc(custom) + '"' + (isTheme ? ' hidden' : "") + ' data-swatch="' + esc(path) + '"><input type="color" data-pf="' + esc(path) + '" data-kind="colour" value="' + esc(custom) + '" aria-label="' + esc(f.label) + ', any colour"></label></div>';
    } else if (t === "image") input = '<select class="box" id="' + id + '" data-pf="' + esc(path) + '"><option value="">No picture yet</option>' + pgd.images.map(function (im) { return '<option value="' + esc(im) + '"' + (im === v ? " selected" : "") + '>' + esc(im) + '</option>'; }).join("") + '</select><span class="small">Photos sent from the Photos screen appear here.</span>';
    else if (t === "artists") {
      if (f.one) input = '<select class="box" id="' + id + '" data-pf="' + esc(path) + '"><option value="">First published artist</option>' + pgd.artists.map(function (a) { return '<option value="' + esc(a.slug) + '"' + (a.slug === v ? " selected" : "") + '>' + esc(a.name) + '</option>'; }).join("") + '</select>';
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
    try { frame.contentWindow.postMessage({ type: "adh-pages", pages: { shared: pgd.doc.shared, pages: pgd.doc.pages }, pick: pick || (pgd.sel ? (pgd.sel.where === "shared" ? pgd.sel.id : pgd.sel.id) : "") }, new URL(pgd.preview).origin); } catch (e) { /* preview only */ }
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
    list.addEventListener("dragstart", function (ev) { var row = ev.target.closest && ev.target.closest(".sec"); if (!row) return; dragId = row.dataset.id; try { ev.dataTransfer.setData("text/plain", dragId); ev.dataTransfer.effectAllowed = "move"; } catch (e) { /* fine */ } });
    list.addEventListener("dragover", function (ev) { if (dragId) { ev.preventDefault(); var row = ev.target.closest && ev.target.closest(".sec"); Array.prototype.forEach.call(list.querySelectorAll(".sec"), function (x) { x.classList.toggle("over", x === row); }); } });
    list.addEventListener("dragleave", function () { });
    list.addEventListener("drop", function (ev) {
      ev.preventDefault(); var row = ev.target.closest && ev.target.closest(".sec"); if (!row || !dragId || row.dataset.id === dragId) { dragId = null; return; }
      var secs = pgSections(pgd), from = secs.findIndex(function (x) { return x.id === dragId; }), to = secs.findIndex(function (x) { return x.id === row.dataset.id; });
      if (from < 0 || to < 0) return;
      var moved = secs.splice(from, 1)[0]; secs.splice(to, 0, moved); dragId = null; pgMark(pgd); edPatch(); pushPreview();
    });
  }
  // Redraws the editor's panels without touching the page in the middle, which would reload it.
  function edPatch() {
    var ed = app.querySelector && app.querySelector(".ed"), s = site(), pgd = pgOf();
    if (!ed || !s || !pgd) { render(); return; }
    var sel = pgSel(pgd), right = pgd.panel === "library" ? edLibrary(pgd) : sel ? edSettings(pgd, sel) : "";
    ed.className = "ed" + (right ? " with-right" : "");
    ed.querySelector(".ed-top").innerHTML = edTop(s, pgd);
    ed.querySelector(".ed-left").innerHTML = edList(pgd);
    var rp = ed.querySelector(".ed-right");
    if (right) { if (!rp) { rp = document.createElement("div"); rp.className = "ed-right"; ed.appendChild(rp); } rp.innerHTML = right; }
    else if (rp) rp.remove();
    var mid = ed.querySelector(".ed-mid"), notes = mid.querySelectorAll(".ask, .notice"); Array.prototype.forEach.call(notes, function (x) { x.remove(); });
    mid.insertAdjacentHTML("afterbegin", viewLeave() + viewAsk() + (state.notice ? '<p class="notice' + (state.notice.problem ? " problem" : "") + '" role="status">' + esc(state.notice.text) + '</p>' : ""));
    mountRich(); mountDrag();
  }
  function edRemember() { var s = site(), p = pgOf(); if (s && p) state.edPrefs[s.id] = { mode: p.mode, page: p.page, sel: p.sel }; }
  function pickSection(id) {
    var pgd = pgOf(); if (!pgd) return;
    if (id === "header" || id === "footer" || id === "opening") pgd.sel = { where: "shared", id: id };
    else if (pgSections(pgd).some(function (x) { return x.id === id; })) pgd.sel = { where: "page", id: id };
    else return;
    pgd.panel = ""; state.confirm = null; edRemember(); edPatch(); pushPreview();
  }
  function newSectionId(pgd, type) {
    var n = 1, used = pgSections(pgd).map(function (x) { return x.id; });
    while (used.indexOf(type + "-" + n) >= 0) n++;
    return type + "-" + n;
  }
  function savePages() {
    var s = site(), pgd = pgOf(); if (!s || !pgd || !pgd.dirty) return;
    var doc = JSON.parse(JSON.stringify(pgd.doc)), what = pgd.what || (pgPage(pgd).title || pgd.page);
    edRemember();
    onLive(function () {
      change(key("pages", s.id), function () { return api("savePages", { site: s.id, pages: doc, what: what }); }, function () { state.dirty = false; }, curCopy().kind === "trial" ? "Saved on this copy" : "Saved. Live in about two minutes");
    }, "This page change");
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
  function richTools(id, short) {
    function b(cmd, label, extra) { return '<button type="button" class="rt-b" data-rt="' + cmd + '"' + (extra || "") + '>' + label + '</button>'; }
    return '<div class="rt-bar" role="toolbar" aria-label="Formatting">' +
      b("bold", "<b>Bold</b>") + b("italic", "<i>Italic</i>") + '<span class="rt-gap"></span>' +
      (short ? "" : b("h2", "Heading") + b("h3", "Small heading") + b("p", "Normal text") + '<span class="rt-gap"></span>' +
      b("ul", "Bullet list") + b("ol", "Numbered list") + '<span class="rt-gap"></span>') +
      b("link", "Link") + b("unlink", "Remove link") + '</div>' +
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
      return '<div class="card entry"><span aria-hidden="true" style="flex:none;width:10px;height:10px;border-radius:50%;background:' + (h.canUndo ? "var(--accent)" : "rgba(221,225,234,.25)") + '"></span>' +
        '<div class="body"><b style="font-size:16px">' + esc(h.what) + '</b><span class="small">' + esc(when(h.when)) + (h.by ? ", by " + esc(h.by) : "") + '</span></div>' + action + '</div>';
    }).join("");
    return head("History", "Every change to this site, newest first. Changes made in this console can be undone.") +
      '<div class="stack">' + (rows || '<p class="notice">No changes yet.</p>') + '</div>';
  }

  function viewCopies() {
    var s = site(), list = copiesOf(s), cur = curCopy(), trials = list.filter(function (c) { return c.kind === "trial"; });
    function card(c) {
      var live = c.kind === "live", on = c.id === cur.id, tone = s ? colours(s.id) : ["#1B2132", "#6F7890"];
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
      return '<div class="card copycard' + (on ? " on" : "") + '"><div class="copytop" style="background:' + (live ? tone[0] : "linear-gradient(120deg, #2E3A57, #55678C)") + ';color:' + (live ? tone[1] : "#EEF1F6") + '"><span>' + (live ? "Live site" : "Trial copy") + '</span></div>' +
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
    var views = { home: viewHome, overview: viewOverview, content: viewContent, theme: viewTheme, photos: viewPhotos, history: viewHistory };
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

  // Shrinks a photo in the browser so uploads stay quick.
  function prepareImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 2400, scale = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var png = file.type === "image/png", dataUrl = c.toDataURL(png ? "image/png" : "image/jpeg", 0.9);
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
    else if (a === "leave-go") { var next = state.leave; state.leave = null; state.dirty = false; if (pgOf()) { pgOf().doc = JSON.parse(pgOf().base); pgOf().dirty = false; } if (next) next(); }
    else if (a === "egroup") {
      state.egroup = Number(el.dataset.g);
      Array.prototype.forEach.call(app.querySelectorAll(".egroup"), function (x) { x.hidden = x.dataset.g !== el.dataset.g; });
      Array.prototype.forEach.call(app.querySelectorAll('[data-act="egroup"]'), function (x) { x.className = x.dataset.g === el.dataset.g ? "on" : ""; });
    }
    else if (a === "cmore") { state.cmore = true; filterList(); }
    else if (a === "ed-pick") pickSection(el.dataset.id);
    else if (a === "ed-panel-close") { var pq = pgOf(); if (pq) { pq.panel = ""; pq.sel = null; edPatch(); pushPreview(""); } }
    else if (a === "ed-library") { var pl = pgOf(); if (pl) { pl.panel = "library"; edPatch(); } }
    else if (a === "ed-page") { var pp = pgOf(); if (pp) { pp.page = el.dataset.page; pp.sel = null; pp.panel = ""; edRemember(); edPatch(); pushPreview(); } }
    else if (a === "ed-mode") { var pm = pgOf(); if (pm) { pm.mode = el.dataset.mode; edRemember(); var fr = app.querySelector(".ed-frame"); if (fr) fr.className = "ed-frame " + pm.mode; patchEdTop(); } }
    else if (a === "ed-add") {
      var pa = pgOf(), kd = pa && pa.kinds[el.dataset.kind]; if (!pa || !kd) return;
      var nid = newSectionId(pa, el.dataset.kind), sec = { id: nid, type: el.dataset.kind, visible: true, settings: JSON.parse(JSON.stringify(kd.starter || {})) };
      var secs = pgSections(pa), after = pa.sel && pa.sel.where === "page" ? secs.findIndex(function (x) { return x.id === pa.sel.id; }) : -1;
      secs.splice(after >= 0 ? after + 1 : secs.length, 0, sec);
      pa.summaries[pa.page + ":" + nid] = ""; pa.sel = { where: "page", id: nid }; pa.panel = ""; pa.what = "Add section: " + kd.label; pgMark(pa); edPatch(); pushPreview();
    }
    else if (a === "ed-hide") { var ph = pgOf(), hs = ph && pgSel(ph); if (hs) { hs.sec.visible = hs.sec.visible === false; ph.what = (hs.sec.visible ? "Show section: " : "Hide section: ") + (hs.kind ? hs.kind.label : hs.id); pgMark(ph); edPatch(); pushPreview(); } }
    else if (a === "ed-dup") {
      var pd = pgOf(), ds = pd && pgSel(pd); if (!ds || ds.where !== "page") return;
      var copy = JSON.parse(JSON.stringify(ds.sec)); copy.id = newSectionId(pd, ds.sec.type);
      var dl = pgSections(pd), di = dl.findIndex(function (x) { return x.id === ds.id; }); dl.splice(di + 1, 0, copy);
      pd.summaries[pd.page + ":" + copy.id] = pd.summaries[pd.page + ":" + ds.id] || ""; pd.sel = { where: "page", id: copy.id }; pd.what = "Add section: copy of " + (ds.kind ? ds.kind.label : ds.id); pgMark(pd); edPatch(); pushPreview();
    }
    else if (a === "ed-move") {
      var pv = pgOf(), ms = pv && pgSel(pv); if (!ms || ms.where !== "page") return;
      var ml = pgSections(pv), mi = ml.findIndex(function (x) { return x.id === ms.id; }), mj = mi + Number(el.dataset.dir);
      if (mj < 0 || mj >= ml.length) return;
      var tmp = ml[mi]; ml[mi] = ml[mj]; ml[mj] = tmp; pv.what = "Move section: " + (ms.kind ? ms.kind.label : ms.id); pgMark(pv); edPatch(); pushPreview();
    }
    else if (a === "ed-remove") {
      var pr = pgOf(), rs = pr && pgSel(pr); if (!rs || rs.where !== "page") return;
      var rl = pgSections(pr); rl.splice(rl.findIndex(function (x) { return x.id === rs.id; }), 1);
      pr.sel = null; state.confirm = null; pr.what = "Remove section: " + (rs.kind ? rs.kind.label : rs.id); pgMark(pr); edPatch(); pushPreview("");
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
    else if (a === "ed-discard") { var pz = pgOf(); if (pz) { pz.doc = JSON.parse(pz.base); pz.dirty = false; state.dirty = false; pz.sel = null; pz.panel = ""; edPatch(); pushPreview(""); } }
    else if (a === "look") { var t = themeOf(), i = Number(el.dataset.i); if (t) { Object.assign(t.draft.colours, i < 0 ? t.values.colours : t.spec.looks[i].colours); themeUpdate(); } }
    else if (a === "theme-discard") { var t2 = themeOf(); if (t2) { t2.draft = JSON.parse(JSON.stringify(t2.values)); themeUpdate(); } }
    else if (a === "theme-publish") onLive(publishTheme, "This theme change");
    else if (a === "publish-replace") publish(el.dataset.copy, true);
    else if (a === "ask-makelive") { state.ask = { kind: "makelive", copy: curCopy().id }; render(); if (typeof window.scrollTo === "function") window.scrollTo(0, 0); }
    else if (a === "ask-big") { state.ask = { kind: el.dataset.kind, copy: el.dataset.copy }; render(); if (typeof window.scrollTo === "function") window.scrollTo(0, 0); }
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
    pgd.what = "Edit " + (sel.kind ? sel.kind.label : sel.id); pgMark(pgd); patchEdTop(); pushSoon();
  }
  function patchEdTop() { var top = app.querySelector && app.querySelector(".ed-top"), s = site(); if (top && s) top.innerHTML = edTop(s, pgOf()); }

  app.addEventListener("change", function (ev) {
    var t = ev.target, kind = t.dataset.change;
    if (t.dataset && t.dataset.pf && (t.tagName === "SELECT" || t.type === "checkbox" || t.type === "color")) { pgInput(t); return; }
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
  app.addEventListener("input", function (ev) {
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
      patchIsland(); applyPreview(); return;
    }
    field = { "photo-note": "note", "photo-alt": "alt", "photo-caption": "caption" }[t.dataset.input];
    if (!field) return;
    var p = state.photoFiles[Number(t.dataset.i)]; if (!p) return;
    p[field] = t.value;
    var ready = state.photoFiles.every(photoReady), btn = app.querySelector('[data-act="photo-send"]'), hint = app.querySelector("#photo-hint");
    if (btn) btn.disabled = !ready || !!state.busy.photo;
    if (hint) hint.style.display = ready ? "none" : "";
  });

  app.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var form = ev.target;
    if (form.dataset.form === "entry") { saveEntry(form); return; }
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
    { id: "world-art-review", name: "World Art Review", domain: "worldartreview.com", live: true, artists: [], inbox: [],
      slots: [{ id: "artist-zara-muse", group: "Artist main images", label: "Zara Muse", filled: true, waiting: false }, { id: "artist-konn-artiss", group: "Artist main images", label: "Konn Artiss", filled: false, waiting: false }, { id: "article-sample", group: "Articles", label: "[Sample] An article", filled: false, waiting: false }] },
    { id: "global-art-monitor", name: "Global Art Monitor", domain: "globalartmonitor.com", live: true, artists: [], inbox: ["slot--artist-zara-muse.jpg"],
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
  var demoKinds = {"opening":{"label":"Opening screen","fields":[{"name":"name","label":"Site name","type":"text"},{"name":"tagline","label":"Tagline","type":"text"}],"library":"","starter":null},"header":{"label":"Menu bar","fields":[{"name":"name","label":"Site name","type":"text"},{"name":"links","label":"Links","type":"rows","fields":[{"name":0,"label":"Words","type":"text"},{"name":1,"label":"Address","type":"text","hint":"A page on this site starts with #, for example #artists."}]}],"library":"","starter":null},"footer":{"label":"Newsletter and footer","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text"},{"name":"heading","label":"Heading","type":"lines","hint":"One line of the heading per paragraph."},{"name":"button","label":"Button words","type":"text"},{"name":"blurb","label":"Short description of the site","type":"long"},{"name":"columns","label":"Link columns","type":"rows","fields":[{"name":"title","label":"Column title","type":"text"},{"name":"links","label":"Links in this column","type":"rows","fields":[{"name":0,"label":"Words","type":"text"},{"name":1,"label":"Address","type":"text","hint":"A page on this site starts with #, for example #artists."}]}]},{"name":"copyright","label":"Copyright line","type":"text"},{"name":"elsewhere","label":"Links in the bottom bar","type":"rows","fields":[{"name":0,"label":"Words","type":"text"},{"name":1,"label":"Address","type":"text","hint":"A page on this site starts with #, for example #artists."}]}],"library":"","starter":null},"hero":{"label":"Opening banner","fields":[{"name":"headline","label":"Headline","type":"rows","fields":[{"name":"t","label":"Words","type":"text"},{"name":"ital","label":"In italics","type":"yesno"}]},{"name":"tagline","label":"Tagline","type":"rows","fields":[{"name":"t","label":"Words","type":"text"},{"name":"ital","label":"In italics","type":"yesno"}]},{"name":"artist","label":"Whose work is shown","type":"artists","one":true,"hint":"Leave empty for the first published artist."},{"name":"rule_label","label":"Rule box, small line","type":"text"},{"name":"rule_text","label":"Rule box, text","type":"text"},{"name":"rule_link","label":"Rule box, link words","type":"text"},{"name":"latest","label":"Pieces in the Latest box","type":"lines","hint":"Article names as they appear in web addresses, for example zara-muse-profile."}],"library":"","starter":null},"featured":{"label":"Featured artists","fields":[{"name":"badge","label":"Badge words","type":"text"},{"name":"artists","label":"Which artists","type":"artists","hint":"Leave empty to show every published artist."}],"library":"","starter":null},"section-list":{"label":"Read by section","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text"},{"name":"heading","label":"Heading","type":"lines","hint":"One line of the heading per paragraph."},{"name":"rows","label":"Rows","type":"rows","fields":[{"name":"n","label":"Number","type":"text"},{"name":"name","label":"Name","type":"text"},{"name":"desc","label":"Description","type":"text"},{"name":"href","label":"Address","type":"text"},{"name":"count","label":"Count shown","type":"choice","options":[["artists","Artists"],["reviews","Reviews"],["explained","Art explained pieces"],["library","Library guides"],["articles","All articles"],["sources","Sources"]]},{"name":"unit","label":"Count word","type":"text"}]}],"library":"","starter":null},"explained":{"label":"Art, explained","fields":[{"name":"heading","label":"Heading","type":"lines","hint":"One line of the heading per paragraph."},{"name":"text","label":"Text","type":"long","plain":true},{"name":"count","label":"How many articles","type":"number"}],"library":"","starter":null},"numbers":{"label":"Numbers band","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text"},{"name":"heading","label":"Heading","type":"lines","hint":"One line of the heading per paragraph."},{"name":"labels","label":"The four labels","type":"lines"}],"library":"Figures from the site, in a band","starter":{"eyebrow":"The review so far","heading":["Research you","can check"],"labels":["Artists documented","Articles and reviews","Sources cited","Facts with a numbered source"]}},"method":{"label":"How we research","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text"},{"name":"heading","label":"Heading","type":"lines","hint":"One line of the heading per paragraph."},{"name":"cards","label":"Cards","type":"rows","fields":[{"name":"n","label":"Number","type":"text"},{"name":"text","label":"Text","type":"long"},{"name":"title","label":"Title","type":"text"},{"name":"sub","label":"Small line","type":"text"}]}],"library":"Three cards in a row","starter":{"eyebrow":"How we research","heading":["The work first,","then the story"],"cards":[{"n":"1","text":"Write here.","title":"A title","sub":"A small line"}]}},"text":{"label":"Text","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text"},{"name":"heading","label":"Heading","type":"lines","hint":"One line of the heading per paragraph."},{"name":"body","label":"Text","type":"long"},{"name":"align","label":"Placing","type":"choice","options":[["","Left"],["centre","Centred"]]},{"name":"bg","label":"Background","type":"colour","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]]},{"name":"fg","label":"Text colour","type":"colour","theme":[["","Automatic"]]}],"library":"A heading and paragraphs","starter":{"eyebrow":"","heading":["A new heading"],"body":"<p>Write here.</p>","align":"","bg":"paper","fg":""}},"text-picture":{"label":"Text with picture","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text"},{"name":"heading","label":"Heading","type":"lines","hint":"One line of the heading per paragraph."},{"name":"body","label":"Text","type":"long"},{"name":"image","label":"Picture","type":"image"},{"name":"alt","label":"Picture description","type":"text"},{"name":"caption","label":"Caption","type":"text"},{"name":"side","label":"Picture on the","type":"choice","options":[["right","Right"],["left","Left"]]},{"name":"bg","label":"Background","type":"colour","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]]},{"name":"fg","label":"Text colour","type":"colour","theme":[["","Automatic"]]}],"library":"Words beside a photo","starter":{"eyebrow":"","heading":["A new heading"],"body":"<p>Write here.</p>","image":"","alt":"","caption":"","side":"right","bg":"paper","fg":""}},"picture":{"label":"Picture","fields":[{"name":"image","label":"Picture","type":"image"},{"name":"alt","label":"Picture description","type":"text"},{"name":"caption","label":"Caption","type":"text"},{"name":"size","label":"Width","type":"choice","options":[["","Full width"],["contained","Contained"]]},{"name":"bg","label":"Background","type":"colour","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]]}],"library":"One large photo, with a caption","starter":{"image":"","alt":"","caption":"","size":"","bg":"paper"}},"quote":{"label":"Quote","fields":[{"name":"text","label":"The quote","type":"lines","hint":"One line per paragraph."},{"name":"who","label":"Who said it","type":"text"},{"name":"bg","label":"Background","type":"colour","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]]},{"name":"fg","label":"Text colour","type":"colour","theme":[["","Automatic"]]}],"library":"A short line that stands out","starter":{"text":["A line worth remembering."],"who":"","bg":"green","fg":""}},"articles":{"label":"Latest articles","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text"},{"name":"heading","label":"Heading","type":"lines","hint":"One line of the heading per paragraph."},{"name":"section","label":"Which articles","type":"choice","options":[["all","All"],["reviews","Reviews"],["explained","Art explained"],["library","Collector's library"],["features","Artist portfolios"]]},{"name":"count","label":"How many","type":"number"},{"name":"bg","label":"Background","type":"colour","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]]},{"name":"fg","label":"Text colour","type":"colour","theme":[["","Automatic"]]}],"library":"Fills itself from Content","starter":{"eyebrow":"Latest","heading":["Recent pieces"],"section":"all","count":3,"bg":"paper","fg":""}},"faq":{"label":"Questions and answers","fields":[{"name":"eyebrow","label":"Small line above the heading","type":"text"},{"name":"heading","label":"Heading","type":"lines","hint":"One line of the heading per paragraph."},{"name":"items","label":"Questions","type":"rows","fields":[{"name":"q","label":"Question","type":"text"},{"name":"a","label":"Answer","type":"long"}]},{"name":"bg","label":"Background","type":"colour","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]]},{"name":"fg","label":"Text colour","type":"colour","theme":[["","Automatic"]]}],"library":"A list that opens and closes","starter":{"eyebrow":"","heading":["Questions"],"items":[{"q":"A question?","a":"<p>The answer.</p>"}],"bg":"paper","fg":""}},"button":{"label":"Button or link","fields":[{"name":"heading","label":"Heading","type":"lines","hint":"One line of the heading per paragraph."},{"name":"text","label":"Text","type":"text"},{"name":"label","label":"Button words","type":"text"},{"name":"href","label":"Where it goes","type":"text","hint":"A page on this site starts with #, or a full web address."},{"name":"style","label":"Style","type":"choice","options":[["green","Green"],["paper","Paper"],["outline","Outline"]]},{"name":"bg","label":"Background","type":"colour","theme":[["paper","Page background"],["deep","Deeper paper"],["green","Bands and buttons"]]},{"name":"fg","label":"Text colour","type":"colour","theme":[["","Automatic"]]}],"library":"Send visitors somewhere","starter":{"heading":["Find out more"],"text":"","label":"Read on","href":"#artists","style":"green","bg":"paper","fg":""}}};
  var demoPages = {"_how_to_edit":"Each page is a list of sections shown top to bottom. 'visible' hides a section without deleting it. 'settings' holds the words and choices for that section. Edit this from Artiscope Digital Home.","shared":{"opening":{"type":"opening","visible":true,"settings":{"name":"World Art Review","tagline":"Discover Artists. Understand Art."}},"header":{"type":"header","visible":true,"settings":{"links":[["Artists A to Z","#artists"],["Reviews","#reviews"],["Art Explained","#explained"]],"name":"World Art Review"}},"footer":{"type":"footer","visible":true,"settings":{"eyebrow":"Get the review","heading":["New portfolios,","once a month."],"button":"Subscribe","blurb":"Researched artist portfolios, reviews and collecting guides. Discover Artists. Understand Art.","columns":[{"title":"Read","links":[["Artists A to Z","#artists"],["Reviews","#reviews"],["Art Explained","#explained"],["Exhibition Guides","#guides"]]},{"title":"Collect","links":[["Collector's Library","#library"],["Original or print?","#a-original-vs-print"],["Provenance","#a-provenance-certificates"],["Research an artist","#a-research-emerging-artist"]]},{"title":"About","links":[["How we research","#home","method"],["Sources","#standards"],["Suggest an artist","mailto:info@grovegallery.com?subject=Suggest%20an%20artist%20for%20World%20Art%20Review"],["Contact","mailto:info@grovegallery.com"]]}],"copyright":"© 2026 World Art Review. All rights reserved.","elsewhere":[["Instagram","#"],["X","#"],["LinkedIn","#"],["Privacy","#standards"],["Terms","#standards"]]}}},"pages":{"home":{"title":"Home","sections":[{"id":"hero","type":"hero","visible":true,"settings":{"headline":[{"t":"Discover"},{"t":"Artists.","ital":true}],"tagline":[{"t":"Understand"},{"t":"Art.","ital":true}],"artist":"","rule_label":"Our rule","rule_text":"Every fact carries a numbered source. Where only the gallery or the artist says so, we say so.","rule_link":"How we work","latest":["zara-muse-profile","konn-artiss-profile","review-anti-frieze"]}},{"id":"featured","type":"featured","visible":true,"settings":{"badge":"Artist in focus","artists":[]}},{"id":"sections","type":"section-list","visible":true,"settings":{"eyebrow":"What you will find here","heading":["Read by","section"],"rows":[{"n":"01","name":"Artists A to Z","href":"#artists","desc":"Researched portfolios: biography, style, career and selected works.","count":"artists","unit":"portfolio"},{"n":"02","name":"Reviews","href":"#reviews","desc":"Close readings of single works, shows and interventions.","count":"reviews","unit":"review"},{"n":"03","name":"Art Explained","href":"#explained","desc":"Techniques, materials and ideas, in plain language.","count":"explained","unit":"guide"},{"n":"04","name":"Collector's Library","href":"#library","desc":"How to research an artist, read a certificate and tell an original from a print.","count":"library","unit":"guide"}]}},{"id":"explainedHome","type":"explained","visible":true,"settings":{"heading":["How to","look at","a painting"],"text":"Short, sourced explainers on the techniques and materials behind the work, so you know what you are looking at before you look it up.","count":2}},{"id":"numbers","type":"numbers","visible":true,"settings":{"eyebrow":"The review so far","heading":["Research you","can check"],"labels":["Artists documented","Articles and reviews","Sources cited","Facts with a numbered source"]}},{"id":"method","type":"method","visible":true,"settings":{"eyebrow":"How we research","heading":["The work first,","then the story"],"cards":[{"n":"1","text":"We start with the work itself: what it is made of, how it was made and where it has been shown.","title":"Start with the work","sub":"Seen, measured, described"},{"n":"2","text":"Every fact in a portfolio carries a numbered source you can open and read for yourself.","title":"Every fact, sourced","sub":"Press, auction records, gallery files"},{"n":"3","text":"Claims that come only from publicity are labelled <span class=\"reported\">Reported</span> so you can weigh them.","title":"Publicity, flagged","sub":"Kept apart from checked fact"}]}}]}}};
  var demoSummaries = { "shared:opening": "World Art Review", "shared:header": "3 links", "shared:footer": "3 columns", "home:hero": "Discover Artists.", "home:featured": "All published", "home:sections": "4 rows", "home:explainedHome": "2 articles", "home:numbers": "Four figures", "home:method": "3 cards" };
  function demoApi(body) {
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
        else if (a === "pages") resolve({ pages: JSON.parse(JSON.stringify(demoPages)), kinds: demoKinds, summaries: demoSummaries, images: ["zara-muse-portrait.jpg"], artists: [{ slug: "zara-muse", name: "Zara Muse" }, { slug: "konn-artiss", name: "Konn Artiss" }], preview: params.get("preview") || "https://worldartreview.com/" });
        else if (a === "savePages") { demoPages = JSON.parse(JSON.stringify(body.pages)); resolve({ ok: true }); }
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
