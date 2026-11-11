/* Artiscope Digital Home: the console.
   Plain JavaScript, no build step. Everything shown from GitHub is
   escaped before it reaches the page. */
(function () {
  "use strict";

  var VERSION = "9";   // shown on screen so it is clear which copy is loaded
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
    notice: null,          // { text, problem }
    status: "live",        // "live" | "saving" | "saved"
    busy: {},
    content: {},           // site id -> collections
    ctab: {}, prevCtab: 0, // site id -> index of the open content tab
    open: null,            // { ci, ei } entry being edited
    confirm: null,         // key of the thing waiting for a second press
    history: {},           // site id -> list of changes
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
  function site() { return liveSites().find(function (s) { return s.id === state.site; }) || liveSites()[0] || null; }
  function initials(name) { return String(name).split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 3).toUpperCase(); }
  var COLOURS = { "world-art-review": ["#1D4A35", "#EEE5D4"], "global-art-monitor": ["#F3C3C8", "#2A2A2F"] };
  function colours(id) { return COLOURS[id] || ["#1B2132", "#6F7890"]; }

  // ---------- talking to the server ----------

  async function api(action, payload) {
    var body = Object.assign({ action: action }, payload || {});
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
      if (!site() || site().id !== state.site) state.site = liveSites()[0] ? liveSites()[0].id : "";
      state.notice = null;
    } catch (e) { state.notice = { text: e.message, problem: true }; }
    render();
    if (state.data) ensure();
  }

  // Fetches what the open screen needs, once per site.
  async function ensure(force) {
    var s = site(); if (!s) return;
    try {
      if ((state.tab === "content" || state.tab === "home") && (force || !state.content[s.id])) {
        var c = await api("content", { site: s.id }); state.content[s.id] = c.collections || []; render();
      }
      if (state.tab === "history" && (force || !state.history[s.id])) {
        var h = await api("history", { site: s.id }); state.history[s.id] = h.changes || []; render();
      }
    } catch (e) { state.notice = { text: e.message, problem: true }; render(); }
  }

  // Runs one change, shows it in the floating bar, then refreshes.
  async function change(k, run, done) {
    state.busy[k] = true; state.status = "saving"; state.notice = null; state.confirm = null; render();
    try {
      await run();
      state.status = "saved";
      if (done) done();
      var s = site();
      if (s) { delete state.history[s.id]; }
      delete state.busy[k]; render();
      await ensure(true);
    } catch (e) {
      state.status = "live"; state.notice = { text: e.message, problem: true };
      delete state.busy[k]; render();
    }
  }

  // ---------- the frame: menu, floating bar ----------

  var NAV = [
    ["home", "Home", "M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z", ""],
    ["content", "Content", "M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z", ""],
    ["photos", "Photos", "M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z", "M7 16l3.5-3.5 2.5 2.5 2-2 2 3"],
    ["history", "History", "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "M12 8v4.5l3 2"],
    ["sites", "Sites", "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "M4.5 12h15M12 4.5c2.6 2.4 2.6 12.6 0 15M12 4.5c-2.6 2.4-2.6 12.6 0 15"],
  ];
  function navIndex(tab) { var i = NAV.findIndex(function (n) { return n[0] === tab; }); return i < 0 ? 0 : i; }
  function mark() { return '<svg width="24" height="24" viewBox="0 0 26 26"><path d="M2 24V10l11-9 11 9v14z" fill="#A9BCE0"></path><rect x="10" y="14" width="6" height="10" fill="#141927"></rect></svg>'; }

  function viewShell(inner) {
    var s = site();
    var from = navIndex(state.prevTab), to = navIndex(state.tab);
    var nav = NAV.map(function (n) {
      var on = n[0] === state.tab;
      return '<button type="button" class="navb' + (on ? " on" : "") + '" data-tab="' + n[0] + '"' + (on ? ' aria-current="page"' : "") + '>' +
        '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="' + n[2] + '"></path><path class="o" d="' + n[2] + '"></path><path class="d" d="' + n[3] + '"></path></svg>' +
        '<span>' + n[1] + '</span></button>';
    }).join("");
    var options = liveSites().map(function (x) { return '<option value="' + esc(x.id) + '"' + (s && x.id === s.id ? " selected" : "") + '>' + esc(x.name) + '</option>'; }).join("");
    var statusText = state.status === "saving" ? "Saving your change" : state.status === "saved" ? "Saved. Live in about two minutes" : "Everything is live";
    return '<div class="shell">' +
      '<nav class="rail" aria-label="Sections">' +
        '<div class="brand"><span class="brand-mark" aria-hidden="true">' + mark() + '</span><span class="brand-name">Artiscope<br>Digital Home</span></div>' +
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
        '<div class="island-row"><div class="island' + (state.status === "live" ? "" : " busy") + '" role="status">' +
          '<span class="dot" aria-hidden="true" style="background:' + (s ? colours(s.id)[0] : "#55678C") + '"></span>' +
          '<label class="small" for="site-pick" style="position:absolute;left:-9999px">Site</label>' +
          '<select id="site-pick" data-change="site">' + options + '</select>' +
          '<span class="small">' + statusText + '</span>' +
          '<span class="tick" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="#A9BCE0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>' +
        '</div></div>' +
        '<div class="column fade">' +
          (state.notice ? '<p class="notice' + (state.notice.problem ? " problem" : "") + '" role="status">' + esc(state.notice.text) + '</p>' : "") +
          inner +
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

  function viewHome() {
    var s = site();
    var cards = sites().map(function (x) {
      var c = colours(x.live ? x.id : "");
      return '<button type="button" class="card lift sitecard' + (s && x.id === s.id ? " current" : "") + '" data-act="' + (x.live ? "pick-site" : "go-sites") + '" data-site="' + esc(x.id) + '">' +
        '<span class="banner" aria-hidden="true" style="background:' + c[0] + ";color:" + c[1] + '">' + esc(x.live ? initials(x.name) : x.name.replace(/\D/g, "")) + '</span>' +
        '<span class="info"><b>' + esc(x.name) + '</b><span class="small">' + esc(x.live ? x.domain : "Not built yet") + '</span>' +
        '<span class="small" style="color:var(--accent);margin-top:8px">' + (x.live ? (s && x.id === s.id ? "You are working on this site" : "Work on this site") : "To be built") + '</span></span></button>';
    }).join("");
    var cols = s ? state.content[s.id] : null;
    var entries = cols ? cols.reduce(function (n, c) { return n + c.entries.length; }, 0) : null;
    var empty = s ? (s.slots || []).filter(function (x) { return !x.filled && !x.waiting; }).length : 0;
    var waiting = s && s.inbox ? s.inbox.length : 0;
    return '<div class="page-head"><span class="small">' + esc(today()) + '</span><h1 style="font-size:48px">' + greeting() + '</h1>' +
      '<p>Pick a site to work on. A change you save goes live on that site in about two minutes, and every change can be undone from History.</p></div>' +
      '<div class="sites">' + cards + '</div>' +
      (s ? '<div class="stack"><h2 class="label">' + esc(s.name) + ' at a glance</h2><div class="grid-3">' +
        '<button type="button" class="card lift sitecard" data-tab="content" style="padding:26px 28px;gap:6px"><span class="bignum">' + (entries == null ? "..." : entries) + '</span><b>pieces of content</b><span class="small">Edit, hide or delete</span></button>' +
        '<button type="button" class="card lift sitecard" data-tab="photos" style="padding:26px 28px;gap:6px"><span class="bignum">' + empty + '</span><b>empty photo spots</b><span class="small">Add photos</span></button>' +
        '<button type="button" class="card lift sitecard" data-tab="photos" style="padding:26px 28px;gap:6px"><span class="bignum">' + waiting + '</span><b>' + (waiting === 1 ? "photo on its way" : "photos on their way") + '</b><span class="small">See what is waiting</span></button>' +
        '</div></div>' : "");
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
    var list = col.entries.map(function (e, ei) {
      return '<div class="card lift entry' + (e.hidden ? " off" : "") + '"><div class="body"><b>' + esc(e.title) + '</b><span class="small">' + esc(e.sub) + '</span></div>' +
        (e.hidden ? '<span class="chip quiet">Hidden from the site</span>' : "") +
        '<button type="button" class="soft" data-act="open" data-ci="' + ci + '" data-ei="' + ei + '">Edit</button></div>';
    }).join("");
    return head("Content", "The words your pages are made from. Open anything to edit it, hide it from visitors, or delete it.") + tabs +
      (col.problem ? '<p class="notice problem">' + esc(col.problem) + '</p>' : "") +
      '<div class="stack">' + (list || '<p class="notice">Nothing here yet.</p>') + '</div>';
  }

  function viewEditor(s, cols) {
    var col = cols[state.open.ci], e = col && col.entries[state.open.ei];
    if (!e) { state.open = null; return viewContent(); }
    var k = key("entry", s.id, col.id, e.id), busy = state.busy[k];
    var fields = e.fields.map(function (f, i) {
      var id = "f-" + i, label = '<label for="' + id + '">' + esc(f.label) + '</label>', input;
      if (f.type === "long") {
        var big = String(f.value || "").length > 600;
        input = '<textarea id="' + id + '" data-field="' + esc(f.name) + '"' + (big ? ' class="tall"' : "") + '>' + esc(f.value) + '</textarea>' +
          (big ? '<span class="small">The marks in angle brackets are formatting. Change the words between them and leave the marks as they are.</span>' : "");
      } else if (f.type === "lines") {
        input = '<textarea id="' + id + '" data-field="' + esc(f.name) + '" data-kind="lines">' + esc((f.value || []).join("\n\n")) + '</textarea><span class="small">One item per paragraph. Leave an empty line between them.</span>';
      } else if (f.type === "number") {
        input = '<input type="number" step="any" id="' + id + '" data-field="' + esc(f.name) + '" value="' + esc(f.value == null ? "" : f.value) + '" style="max-width:260px"><span class="small">Leave empty if it is not known.</span>';
      } else if (f.type === "yesno") {
        input = '<select class="box" id="' + id + '" data-field="' + esc(f.name) + '" style="max-width:200px"><option value="true"' + (f.value ? " selected" : "") + '>Yes</option><option value="false"' + (f.value ? "" : " selected") + '>No</option></select>';
      } else {
        input = '<input type="text" id="' + id + '" data-field="' + esc(f.name) + '" value="' + esc(f.value == null ? "" : f.value) + '">';
      }
      return '<div class="field">' + label + input + '</div>';
    }).join("");
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
      '<form class="card stack-wide" data-form="entry">' + (fields || '<p class="muted">Nothing on this entry can be edited here yet.</p>') +
        '<div class="row"><button type="submit" class="btn"' + (busy ? " disabled" : "") + '>' + (busy ? "Saving" : "Save and publish") + '</button>' +
        '<button type="button" class="soft" data-act="close">Cancel</button></div></form>' + danger;
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

  function viewSites() {
    var rows = sites().map(function (x) {
      return '<div class="card entry"><span aria-hidden="true" style="flex:none;width:14px;height:14px;border-radius:50%;background:' + (x.live ? colours(x.id)[0] : "rgba(221,225,234,.25)") + ';box-shadow:0 0 0 2px rgba(221,225,234,.25)"></span>' +
        '<div class="body"><b>' + esc(x.name) + '</b><span class="small">' + esc(x.live ? x.domain : "Domain owned. Not built yet.") + '</span></div>' +
        '<span class="chip' + (x.live ? "" : " quiet") + '">' + (x.live ? "Live" : "To be built") + '</span></div>';
    }).join("");
    return head("Sites", "Your five sites. Creating a new site from a template arrives in a later stage, along with page layouts and theme colours.") + '<div class="stack">' + rows + '</div>';
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
    if (!demo && !state.session) { app.innerHTML = viewSignin(); return; }
    if (!state.data) {
      app.innerHTML = state.notice
        ? '<div class="signin"><div class="card"><p class="notice problem">' + esc(state.notice.text) + '</p><div class="row"><button type="button" class="soft" data-act="refresh">Try again</button>' + (demo ? "" : '<button type="button" class="linklike" data-act="signout">Sign out</button>') + '</div><span class="small">Version ' + VERSION + '</span></div></div>'
        : '<p class="loading">Reading your sites</p>';
      return;
    }
    var views = { home: viewHome, content: viewContent, photos: viewPhotos, history: viewHistory, sites: viewSites };
    app.innerHTML = viewShell((views[state.tab] || viewHome)());
    settle();
  }

  // ---------- doing things ----------

  function openEntry() { var s = site(), cols = s && state.content[s.id]; if (!cols || !state.open) return null; var col = cols[state.open.ci]; return col ? { s: s, col: col, e: col.entries[state.open.ei] } : null; }
  function entryChange(action, extra) {
    var o = openEntry(); if (!o || !o.e) return;
    var k = key("entry", o.s.id, o.col.id, o.e.id);
    change(k, function () { return api(action, Object.assign({ site: o.s.id, collection: o.col.id, id: o.e.id }, extra(o))); }, function () { state.open = null; delete state.content[o.s.id]; });
  }
  function saveEntry(form) {
    var values = {};
    Array.prototype.forEach.call(form.querySelectorAll("[data-field]"), function (el) {
      values[el.dataset.field] = el.dataset.kind === "lines" ? el.value.split(/\n\s*\n/) : el.value;
    });
    entryChange("saveEntry", function () { return { values: values }; });
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
    state.status = sent ? "saved" : "live";
    state.notice = left.length
      ? { text: sent + " sent. " + left.length + " could not be sent, see below.", problem: true }
      : { text: (sent === 1 ? "Photo sent." : sent + " photos sent.") + " It will be on the site within a few minutes. Press Refresh to see it marked as in place." };
    render();
  }

  function go(tab) {
    state.prevTab = state.tab; state.tab = tab; state.open = null; state.confirm = null; state.notice = null;
    if (state.status === "saved") state.status = "live";
    render(); ensure();
    if (typeof window.scrollTo === "function") window.scrollTo(0, 0);
  }

  app.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-tab],[data-act]"); if (!el) return;
    if (el.dataset.tab) { go(el.dataset.tab); return; }
    var a = el.dataset.act, s = site();
    if (a === "refresh") { state.content = {}; state.history = {}; load(); }
    else if (a === "signout") sb.auth.signOut();
    else if (a === "signin-mode") { state.signinMode = el.dataset.mode; state.signinSent = false; state.notice = null; var em = app.querySelector("#email"); if (em) state.email = em.value.trim(); render(); }
    else if (a === "pick-site") { state.site = el.dataset.site; go("content"); }
    else if (a === "go-sites") go("sites");
    else if (a === "ctab") { state.prevCtab = state.ctab[s.id] || 0; state.ctab[s.id] = Number(el.dataset.i); render(); }
    else if (a === "open") { state.open = { ci: Number(el.dataset.ci), ei: Number(el.dataset.ei) }; state.confirm = null; state.notice = null; render(); if (typeof window.scrollTo === "function") window.scrollTo(0, 0); }
    else if (a === "close") { state.open = null; state.confirm = null; state.prevCtab = s ? (state.ctab[s.id] || 0) : 0; render(); }
    else if (a === "ask") { state.confirm = el.dataset.k; render(); }
    else if (a === "cancel") { state.confirm = null; render(); }
    else if (a === "entry-hide") entryChange("setHidden", function (o) { return { hidden: !o.e.hidden }; });
    else if (a === "entry-delete") entryChange("deleteEntry", function () { return {}; });
    else if (a === "photo-take") takePhoto(el.dataset.slot);
    else if (a === "undo") undo(el.dataset.sha);
    else if (a === "photo-send") sendPhotos();
    else if (a === "photo-remove") { state.photoFiles.splice(Number(el.dataset.i), 1); render(); }
  });

  app.addEventListener("change", function (ev) {
    var t = ev.target, kind = t.dataset.change;
    if (kind === "site") { state.site = t.value; state.open = null; state.confirm = null; state.photoFiles = []; state.prevCtab = 0; render(); ensure(); }
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
    var t = ev.target, field = { "photo-note": "note", "photo-alt": "alt", "photo-caption": "caption" }[t.dataset.input];
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
      { id: "a1", title: "[Sample] How to look at a painting", sub: "Looking", hidden: false, fields: [{ name: "title", label: "Title", type: "text", value: "[Sample] How to look at a painting" }, { name: "dek", label: "Summary line", type: "long", value: "A short sample summary that shows how a longer piece of text is edited in the console, in a box that grows." }, { name: "minutes", label: "Reading time, minutes", type: "number", value: 6 }] },
      { id: "a2", title: "[Sample] Original or print", sub: "Collecting", hidden: true, fields: [{ name: "title", label: "Title", type: "text", value: "[Sample] Original or print" }] }] },
    { id: "artists", label: "Artists", singular: "artist", canHide: false, canDelete: false, entries: [
      { id: "zara-muse", title: "Zara Muse", sub: "Portraiture, London", hidden: false, fields: [{ name: "name", label: "Name", type: "text", value: "Zara Muse" }, { name: "published", label: "Shown on the site", type: "yesno", value: true }, { name: "ghostWords", label: "Large background words", type: "lines", value: ["Knives,", "not", "brushes."] }] }] },
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
  function demoApi(body) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        if (body.action === "overview") resolve(JSON.parse(JSON.stringify(demoData)));
        else if (body.action === "content") resolve({ collections: JSON.parse(JSON.stringify(demoContent)) });
        else if (body.action === "history") resolve({ changes: demoHistory });
        else if (body.action === "uploadPhoto") resolve({ ok: true, name: (body.slot ? "slot--" + body.slot : "note--" + String(body.description).toLowerCase().replace(/[^a-z0-9]+/g, "-")) + "." + body.ext });
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
  window.__adh = { state: state, render: render, esc: esc, go: go };
  start();
})();
