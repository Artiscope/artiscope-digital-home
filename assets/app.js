/* Artiscope Digital Home: the console.
   Plain JavaScript, no build step. Everything shown from GitHub is
   escaped before it reaches the page. */
(function () {
  "use strict";

  var VERSION = "6";   // shown on screen so it is clear which copy is loaded
  var cfg = window.ADH_CONFIG || {};
  var params = new URLSearchParams(window.location.search);
  var demo = !cfg.supabaseKey || params.has("demo");
  var sb = null;
  var app = document.getElementById("app");

  var state = {
    session: null,
    email: "",
    data: null,
    tab: "today",
    loading: false,
    notice: null,        // { text, problem }
    signinSent: false,
    signinMode: "link",   // "link" or "password"
    busy: {},            // key -> true while a request is running
    topicDone: {},       // key -> "yes" | "no"
    draftMode: {},       // key -> "confirm" | "return" | "reject"
    draftDone: {},       // key -> "published" | "returned" | "rejected"
    photoDone: [],
  };

  // ---------- small helpers ----------

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function key() { return Array.prototype.join.call(arguments, "|"); }
  function greeting() {
    var h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }
  function today() {
    return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  }
  // The agent's notes use code marks around file names. Drop them for reading.
  function plain(text) { return String(text).replace(/`/g, ""); }
  function liveSites() { return (state.data ? state.data.sites : []).filter(function (s) { return s.live; }); }
  function plural(n, one, many) { return n === 1 ? one : many; }

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
    if (detail && detail.error) return detail.error;
    var extra = detail ? String(detail.message || detail.msg || detail.code || "") : "";
    if (status === 404) return "The server function was not found. In Supabase, under Edge Functions, it must exist under the name set in config.js";
    if (status === 401) return "Supabase blocked the request before it reached the server function. Open the function's settings in Supabase, switch off Verify JWT, save, and try again.";
    if (status >= 500) return "The server function is there but failed to run (code " + status + (extra ? ", " + extra : "") + "). Send this message to Claude.";
    if (status) return "The server function answered with code " + status + (extra ? " (" + extra + ")" : "") + ". Send this message to Claude.";
    return "The server function could not be reached. Either it has not been added in Supabase yet (or under a different name), or the connection dropped.";
  }

  async function load() {
    state.loading = true; render();
    try {
      state.data = await api("overview");
      state.notice = null;
    } catch (e) {
      state.notice = { text: e.message, problem: true };
    }
    state.loading = false; render();
  }

  // ---------- counting what is waiting ----------

  function waitingTopics() {
    var out = [];
    liveSites().forEach(function (s) {
      ((s.topics && s.topics.waiting) || []).forEach(function (t) {
        var k = key(s.id, t.title);
        if (!t.answer && !state.topicDone[k]) out.push({ site: s, topic: t, k: k });
      });
    });
    return out;
  }
  function allTopics() {
    var out = [];
    liveSites().forEach(function (s) {
      ((s.topics && s.topics.waiting) || []).forEach(function (t) {
        out.push({ site: s, topic: t, k: key(s.id, t.title) });
      });
    });
    return out;
  }
  function openDrafts() {
    var out = [];
    liveSites().forEach(function (s) {
      (s.drafts || []).forEach(function (d) { out.push({ site: s, draft: d, k: key(s.id, d.number) }); });
    });
    return out;
  }
  function draftsLeft() { return openDrafts().filter(function (d) { return !state.draftDone[d.k]; }).length; }
  function inboxCount() {
    return liveSites().reduce(function (n, s) { return n + (s.inbox ? s.inbox.length : 0); }, 0) + state.photoDone.length;
  }

  // ---------- the pieces of the page ----------

  function viewSignin() {
    var pw = state.signinMode === "password";
    var formBody;
    if (state.signinSent) {
      formBody = '<p class="notice">Check your inbox. The sign-in link has been sent to ' + esc(state.email) + '.</p>' +
        '<button type="button" class="linklike small" data-act="signin-mode" data-mode="password">Use a password instead</button>';
    } else {
      formBody =
        '<p class="muted">' + (pw ? "Enter your work email and password." : "Enter your work email and we will send you a sign-in link. No password needed.") + '</p>' +
        '<div class="field"><label for="email">Email address</label>' +
        '<input id="email" name="email" type="email" autocomplete="email" required value="' + esc(state.email) + '"></div>' +
        (pw ? '<div class="field"><label for="password">Password</label>' +
              '<input id="password" name="password" type="password" autocomplete="current-password" required></div>' : '') +
        '<div><button class="btn primary" type="submit"' + (state.busy.signin ? " disabled" : "") + '>' + (pw ? "Sign in" : "Send me a sign-in link") + '</button></div>' +
        '<button type="button" class="linklike small" data-act="signin-mode" data-mode="' + (pw ? "link" : "password") + '">' +
          (pw ? "Email me a sign-in link instead" : "Use a password instead") + '</button>';
    }
    return '<div class="signin"><form class="card" data-form="signin">' +
      '<span class="brand-mark" aria-hidden="true">' + mark() + '</span>' +
      '<h1>Artiscope<br>Digital Home</h1>' + formBody +
      (state.notice ? '<p class="notice problem">' + esc(state.notice.text) + '</p>' : '') +
      '<span class="small">Version ' + VERSION + '</span>' +
      '</form></div>';
  }

  // Turns a sign-in failure into a plain sentence.
  function signinProblem(error, usedPassword) {
    var code = String(error.code || ""), status = Number(error.status || 0), msg = String(error.message || "");
    if (status === 429 || /rate|limit|seconds/i.test(code + " " + msg)) {
      return "Too many sign-in emails were requested. Supabase only sends a few each hour. Wait a while, or use a password instead.";
    }
    if (usedPassword) return "That email and password do not match. Check them and try again.";
    if (/invalid|valid email/i.test(code + " " + msg)) return "That does not look like an email address. Check it and try again.";
    if (/signup|not allowed|disabled/i.test(code + " " + msg)) return "This email address is not set up for sign-in yet.";
    return "The link could not be sent" + (msg ? " (" + msg + ")." : ".") + " Please try again in a few minutes.";
  }

  function mark() {
    return '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M2 24V10l11-9 11 9v14z" fill="#93A7C9"></path><rect x="10" y="14" width="6" height="10" fill="#0B0E17"></rect></svg>';
  }

  function viewShell(inner) {
    var tabs = [
      ["today", "Today", ""],
      ["topics", "Topics", waitingTopics().length],
      ["drafts", "Drafts", draftsLeft()],
      ["photos", "Photos", inboxCount()],
      ["sites", "Sites", state.data ? state.data.sites.length : ""],
    ];
    var nav = tabs.map(function (t) {
      return '<button type="button" data-tab="' + t[0] + '"' + (state.tab === t[0] ? ' aria-current="page"' : "") + '>' +
        '<span>' + t[1] + '</span><span class="count">' + (t[2] ? esc(t[2]) : "") + '</span></button>';
    }).join("");
    return '<div class="shell">' +
      '<nav class="menu" aria-label="Sections">' +
        '<div class="brand"><span class="brand-mark" aria-hidden="true">' + mark() + '</span>' +
        '<div><div class="brand-name">Artiscope<br>Digital Home</div><div class="small">Five websites, one screen</div></div></div>' +
        '<div class="nav">' + nav + '</div>' +
        '<div class="menu-foot">' +
          (demo ? '<span class="small">Sample mode. Example data only, nothing is saved.</span>'
                : '<span class="small">Signed in as ' + esc(state.email) + '</span>') +
          '<button type="button" class="linklike small" data-act="refresh">Refresh</button>' +
          '<span class="small">Version ' + VERSION + '</span>' +
          (demo ? '' : '<button type="button" class="linklike small" data-act="signout">Sign out</button>') +
        '</div>' +
      '</nav>' +
      '<main class="main"><div class="column">' +
        (state.notice ? '<p class="notice' + (state.notice.problem ? " problem" : "") + '" role="status">' + esc(state.notice.text) + '</p>' : '') +
        inner +
      '</div></main></div>';
  }

  function viewToday() {
    var t = waitingTopics().length, d = draftsLeft(), p = inboxCount();
    var tiles = state.data.sites.map(function (s) {
      return '<div class="tile"><span class="dot' + (s.live ? "" : " off") + '" aria-hidden="true"></span>' +
        '<span class="name">' + esc(s.name) + '</span><span class="small">' + (s.live ? "Live" : "To be built") + '</span></div>';
    }).join("");
    var runs = liveSites().map(function (s) {
      if (s.error) return '<div class="logline"><span class="dot off" aria-hidden="true"></span><span><b>' + esc(s.name) + '.</b> ' + esc(s.error) + '</span></div>';
      var e = s.log && s.log[0];
      if (!e) return '<div class="logline"><span class="dot off" aria-hidden="true"></span><span><b>' + esc(s.name) + '.</b> No runs recorded yet.</span></div>';
      return '<div class="logline"><span class="dot" aria-hidden="true"></span><div class="stack" style="gap:4px"><span><b>' + esc(s.name) + '</b> <span class="small">' + esc(e.date) + '</span></span>' +
        e.lines.map(function (l) { return '<span class="muted">' + esc(plain(l)) + '</span>'; }).join("") + '</div></div>';
    }).join("");
    return '<div class="page-head"><span class="small">' + esc(today()) + '</span><h1>' + greeting() + '</h1>' +
      '<p>' + (t + d ? "Here is what is waiting for you across your sites." : "Nothing is waiting for you. Everything is up to date.") + '</p></div>' +
      '<div class="counters">' +
        counter(t, plural(t, "topic to approve", "topics to approve"), "Open topics", "topics") +
        counter(d, plural(d, "draft waiting for your yes", "drafts waiting for your yes"), "Read drafts", "drafts") +
        counter(p, plural(p, "photo waiting to be placed", "photos waiting to be placed"), "Add photos", "photos") +
      '</div>' +
      '<div class="stack"><h2 class="label">Your sites</h2><div class="tiles">' + tiles + '</div></div>' +
      '<div class="stack"><h2 class="label">Latest from the agent</h2><div class="card stack-wide">' + runs + '</div></div>';
  }
  function counter(n, what, go, tab) {
    return '<button type="button" class="counter" data-tab="' + tab + '"><span class="num">' + n + '</span>' +
      '<span class="what">' + what + '</span><span class="go">' + go + '</span></button>';
  }

  function viewTopics() {
    var list = allTopics();
    var cards = list.map(function (x) {
      var done = state.topicDone[x.k] || (x.topic.answer ? (/^yes/i.test(x.topic.answer) ? "yes" : /^no/i.test(x.topic.answer) ? "no" : "") : "");
      var busy = state.busy[x.k];
      var foot;
      if (done === "yes") foot = '<div class="row"><span class="chip">Approved. The agent writes it on its next weekday run.</span></div>';
      else if (done === "no") foot = '<div class="row"><span class="chip quiet">Declined. It will not be suggested again.</span></div>';
      else foot =
        '<div class="field"><label for="note-' + esc(x.k) + '">A note for the agent (optional)</label>' +
        '<input type="text" id="note-' + esc(x.k) + '" data-note="' + esc(x.k) + '" maxlength="300" placeholder="For example: keep it short"></div>' +
        '<div class="row"><button type="button" class="btn primary" data-act="topic" data-k="' + esc(x.k) + '" data-answer="yes"' + (busy ? " disabled" : "") + '>Yes, write it</button>' +
        '<button type="button" class="btn" data-act="topic" data-k="' + esc(x.k) + '" data-answer="no"' + (busy ? " disabled" : "") + '>Not this one</button></div>';
      return '<article class="card"><div class="meta"><span class="dot" aria-hidden="true"></span><span>' + esc(x.site.name) + '</span>' +
        (x.topic.type ? '<span>' + esc(x.topic.type) + '</span>' : '') +
        (x.topic.sources ? '<span>Sources: ' + esc(x.topic.sources) + '</span>' : '') + '</div>' +
        '<h2>' + esc(x.topic.title) + '</h2>' +
        (x.topic.why ? '<p class="prose">' + esc(x.topic.why) + '</p>' : '') + foot + '</article>';
    }).join("");
    return '<div class="page-head"><h1>Topics</h1><p>Each Monday the agent suggests what to write next. Say yes to an idea and it writes the piece on its next run. Nothing is written until you do.</p></div>' +
      (cards ? '<div class="stack-wide">' + cards + '</div>' : '<p class="notice">No topic ideas are waiting. New ones arrive on Monday.</p>');
  }

  function viewDrafts() {
    var cards = openDrafts().map(function (x) {
      var done = state.draftDone[x.k], mode = state.draftMode[x.k], busy = state.busy[x.k], k = esc(x.k), foot;
      if (done === "published") foot = '<div class="row"><span class="chip">Published. It will be live on ' + esc(x.site.domain) + ' within a few minutes.</span></div>';
      else if (done === "returned") foot = '<div class="row"><span class="chip quiet">Sent back. The agent reworks it on its next run.</span></div>';
      else if (done === "rejected") foot = '<div class="row"><span class="chip quiet">Rejected. It will not be proposed again.</span></div>';
      else if (mode === "confirm") foot = '<p>This puts the piece on the live site straight away.</p><div class="row">' +
        '<button type="button" class="btn primary" data-act="draft-publish" data-k="' + k + '"' + (busy ? " disabled" : "") + '>Yes, publish now</button>' +
        '<button type="button" class="btn" data-act="draft-mode" data-k="' + k + '" data-mode="">Cancel</button></div>';
      else if (mode === "return" || mode === "reject") foot =
        '<div class="field"><label for="dn-' + k + '">' + (mode === "return" ? "What should change?" : "Why is it rejected? (optional)") + '</label>' +
        '<textarea id="dn-' + k + '" data-dnote="' + k + '" maxlength="2000"></textarea></div><div class="row">' +
        '<button type="button" class="btn primary" data-act="draft-' + mode + '" data-k="' + k + '"' + (busy ? " disabled" : "") + '>' + (mode === "return" ? "Send back to the agent" : "Reject this draft") + '</button>' +
        '<button type="button" class="btn" data-act="draft-mode" data-k="' + k + '" data-mode="">Cancel</button></div>';
      else foot = '<div class="row">' +
        '<button type="button" class="btn primary" data-act="draft-mode" data-k="' + k + '" data-mode="confirm">Publish to the live site</button>' +
        '<button type="button" class="btn" data-act="draft-mode" data-k="' + k + '" data-mode="return">Send back with a note</button>' +
        '<button type="button" class="linklike" data-act="draft-mode" data-k="' + k + '" data-mode="reject">Reject</button></div>';
      return '<article class="card"><div class="meta"><span class="dot" aria-hidden="true"></span><span>' + esc(x.site.name) + '</span>' +
        (x.draft.created ? '<span>Prepared ' + esc(new Date(x.draft.created).toLocaleDateString("en-GB", { day: "numeric", month: "long" })) + '</span>' : '') + '</div>' +
        '<h2 class="big-title">' + esc(x.draft.title) + '</h2>' +
        '<div class="well"><div class="label" style="margin-bottom:8px">What the agent says about this draft</div><div class="prose">' + esc(x.draft.body || "No summary was provided.") + '</div></div>' +
        (/^https:\/\/github\.com\//.test(x.draft.url || "") ? '<p><a href="' + esc(x.draft.url) + '" target="_blank" rel="noopener">Read the full draft on GitHub</a></p>' : '') +
        foot + '</article>';
    }).join("");
    return '<div class="page-head"><h1>Drafts</h1><p>Finished pieces wait here. Nothing with a new fact or figure reaches a live site until you publish it.</p></div>' +
      (cards ? '<div class="stack-wide">' + cards + '</div>' : '<p class="notice">No drafts are waiting.</p>');
  }

  function viewPhotos() {
    var sites = liveSites();
    var current = sites.find(function (s) { return s.id === state.photoSite; }) || sites[0];
    var siteOptions = sites.map(function (s) { return '<option value="' + esc(s.id) + '"' + (current && s.id === current.id ? " selected" : "") + '>' + esc(s.name) + '</option>'; }).join("");
    var artistOptions = current ? current.artists.map(function (a) { return '<option value="' + esc(a.slug) + '">' + esc(a.name) + '</option>'; }).join("") : "";
    var waiting = [];
    sites.forEach(function (s) { (s.inbox || []).forEach(function (n) { waiting.push({ site: s.name, name: n }); }); });
    state.photoDone.forEach(function (p) { waiting.push(p); });
    var list = waiting.map(function (w) {
      return '<div class="card" style="padding:16px 22px"><div class="row" style="justify-content:space-between"><div><b>' + esc(w.name) + '</b><div class="small">' + esc(w.site) + '</div></div><span class="badge">Waiting for the next run</span></div></div>';
    }).join("");
    return '<div class="page-head"><h1>Photos</h1><p>Add a photo and say where it belongs. The agent resizes it, writes a description and places it on its next run. It never uses images from anywhere else.</p></div>' +
      '<form class="card stack-wide" data-form="photo">' +
        '<div class="grid-2"><div class="field"><label for="p-site">Which site?</label><select id="p-site" name="site" data-change="photo-site">' + siteOptions + '</select></div>' +
        '<div class="field"><label for="p-artist">Which artist?</label><select id="p-artist" name="artist">' + artistOptions + '</select></div></div>' +
        '<div class="field"><label for="p-desc">What does it show?</label><input type="text" id="p-desc" name="description" maxlength="60" required placeholder="For example: portrait, or the title of the artwork"></div>' +
        '<div class="field"><label for="p-file">The photo</label><div class="well"><input type="file" id="p-file" name="file" accept="image/jpeg,image/png" required></div><span class="small">JPG or PNG. Send the largest version you have.</span></div>' +
        '<div><button type="submit" class="btn primary"' + (state.busy.photo ? " disabled" : "") + '>' + (state.busy.photo ? "Sending the photo" : "Add this photo") + '</button></div>' +
      '</form>' +
      '<div class="stack"><h2 class="label">Waiting to be placed</h2>' + (list || '<p class="notice">No photos are waiting.</p>') + '</div>';
  }

  function viewSites() {
    var rows = state.data.sites.map(function (s) {
      return '<div class="card" style="padding:20px 26px"><div class="row" style="justify-content:space-between"><div class="row"><span class="dot' + (s.live ? "" : " off") + '" aria-hidden="true"></span>' +
        '<div><b style="font-size:17px">' + esc(s.name) + '</b><div class="muted">' + (s.live ? esc(s.domain) : "Domain owned. Not built yet.") + '</div></div></div>' +
        '<span class="badge' + (s.live ? "" : " muted") + '">' + (s.live ? "Live, agent running" : "Waiting to be built") + '</span></div></div>';
    }).join("");
    return '<div class="page-head"><h1>Sites</h1><p>Every site has its own brief, voice guide and rules. The agent works through them one at a time each weekday.</p></div>' +
      '<div class="stack">' + rows + '</div>' +
      '<div class="well" style="max-width:66ch"><b>Adding a site</b><p class="muted" style="margin-top:6px">Once a new site is built, it gets a brief and a voice guide, joins the weekday schedule and appears in this list.</p></div>';
  }

  function render() {
    if (!demo && !state.session) { app.innerHTML = viewSignin(); return; }
    if (!state.data) {
      app.innerHTML = state.notice
        ? '<div class="signin"><div class="card"><p class="notice problem">' + esc(state.notice.text) + '</p><div class="row"><button type="button" class="btn" data-act="refresh">Try again</button>' + (demo ? "" : '<button type="button" class="linklike" data-act="signout">Sign out</button>') + '</div><span class="small">Version ' + VERSION + '</span></div></div>'
        : '<p class="loading">Reading your sites</p>';
      return;
    }
    var views = { today: viewToday, topics: viewTopics, drafts: viewDrafts, photos: viewPhotos, sites: viewSites };
    app.innerHTML = viewShell((views[state.tab] || viewToday)());
  }

  // ---------- doing things ----------

  function find(list, k) { return list.find(function (x) { return x.k === k; }); }
  function valueOf(selector) { var el = app.querySelector(selector); return el ? el.value.trim() : ""; }
  function attr(v) { return String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }

  async function act(k, run, onDone) {
    state.busy[k] = true; state.notice = null; render();
    try { await run(); onDone(); }
    catch (e) { state.notice = { text: e.message, problem: true }; }
    delete state.busy[k]; render();
  }

  async function answerTopic(k, answer) {
    var x = find(allTopics(), k); if (!x) return;
    var note = valueOf('[data-note="' + attr(k) + '"]');
    await act(k, function () { return api("answerTopic", { site: x.site.id, title: x.topic.title, answer: answer, note: note }); },
      function () { state.topicDone[k] = answer; });
  }

  async function draftAction(k, kind) {
    var x = find(openDrafts(), k); if (!x) return;
    var note = valueOf('[data-dnote="' + attr(k) + '"]');
    if (kind === "return" && !note) { state.notice = { text: "Please say what should change.", problem: true }; render(); return; }
    var action = kind === "publish" ? "publishDraft" : kind === "return" ? "returnDraft" : "rejectDraft";
    var done = kind === "publish" ? "published" : kind === "return" ? "returned" : "rejected";
    await act(k, function () { return api(action, { site: x.site.id, number: x.draft.number, note: note }); },
      function () { state.draftDone[k] = done; delete state.draftMode[k]; });
  }

  // Shrinks a photo in the browser so uploads stay quick. The agent
  // does the final sizing when it places the photo.
  function prepareImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var max = 2400, scale = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var png = file.type === "image/png";
        var dataUrl = c.toDataURL(png ? "image/png" : "image/jpeg", 0.9);
        resolve({ content: dataUrl.slice(dataUrl.indexOf(",") + 1), ext: png ? "png" : "jpg" });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That file could not be read as a photo.")); };
      img.src = url;
    });
  }

  async function uploadPhoto(form) {
    var file = form.file.files[0]; if (!file) return;
    var siteId = form.site.value, artist = form.artist.value, description = form.description.value.trim();
    var site = liveSites().find(function (s) { return s.id === siteId; });
    await act("photo", async function () {
      var img = await prepareImage(file);
      var res = await api("uploadPhoto", { site: siteId, artist: artist, description: description, ext: img.ext, content: img.content });
      state.photoDone.push({ site: site ? site.name : "", name: res.name });
    }, function () { state.notice = { text: "Photo added. The agent will place it on its next weekday run." }; });
  }

  app.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-tab],[data-act]"); if (!el) return;
    if (el.dataset.tab) { state.tab = el.dataset.tab; state.notice = null; render(); window.scrollTo(0, 0); return; }
    var a = el.dataset.act, k = el.dataset.k;
    if (a === "refresh") load();
    else if (a === "signin-mode") { state.signinMode = el.dataset.mode; state.signinSent = false; state.notice = null; var em = app.querySelector("#email"); if (em) state.email = em.value.trim(); render(); }
    else if (a === "signout") sb.auth.signOut();
    else if (a === "topic") answerTopic(k, el.dataset.answer);
    else if (a === "draft-mode") { if (el.dataset.mode) state.draftMode[k] = el.dataset.mode; else delete state.draftMode[k]; state.notice = null; render(); }
    else if (a === "draft-publish") draftAction(k, "publish");
    else if (a === "draft-return") draftAction(k, "return");
    else if (a === "draft-reject") draftAction(k, "reject");
  });

  app.addEventListener("change", function (ev) {
    if (ev.target.dataset.change === "photo-site") { state.photoSite = ev.target.value; render(); }
  });

  app.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var form = ev.target;
    if (form.dataset.form === "photo") { uploadPhoto(form); return; }
    if (form.dataset.form === "signin") {
      state.email = form.email.value.trim();
      var usePassword = state.signinMode === "password";
      var password = usePassword ? form.password.value : "";
      state.busy.signin = true; state.notice = null; render();
      var res = usePassword
        ? await sb.auth.signInWithPassword({ email: state.email, password: password })
        : await sb.auth.signInWithOtp({
            email: state.email,
            options: { emailRedirectTo: window.location.origin + window.location.pathname },
          });
      delete state.busy.signin;
      if (res.error) state.notice = { text: signinProblem(res.error, usePassword), problem: true };
      else if (!usePassword) state.signinSent = true;
      render();
    }
  });

  // ---------- sample data, used until the console is connected ----------

  var demoData = {
    user: { email: "sample" },
    sites: [
      { id: "world-art-review", name: "World Art Review", domain: "worldartreview.com", live: true,
        artists: [{ slug: "zara-muse", name: "Zara Muse" }, { slug: "konn-artiss", name: "Konn Artiss" }, { slug: "zen-xander", name: "Zen Xander" }],
        topics: { waiting: [{ title: "[Sample] A technique explainer for one artist", type: "Technique explainer", why: "The site has no technique explainer yet.", sources: "3", answer: "" }], approved: [] },
        drafts: [], inbox: [],
        log: [{ date: "[Sample day]", lines: ["Published: two broken source links fixed.", "Drafts waiting: none.", "Needs you: nothing."] }] },
      { id: "global-art-monitor", name: "Global Art Monitor", domain: "globalartmonitor.com", live: true,
        artists: [{ slug: "zara-muse", name: "Zara Muse" }, { slug: "konn-artiss", name: "Konn Artiss" }],
        topics: { waiting: [{ title: "[Sample] What a buyer's premium adds to a hammer price", type: "Collecting guide", why: "Readers reach the auction tables without a plain guide to the two prices.", sources: "2", answer: "" }], approved: [] },
        drafts: [{ number: 1, title: "[Sample] How to read an auction estimate", body: "What is new: a plain guide to estimates.\n\nSources:\n[source one]\n[source two]", url: "", created: new Date().toISOString() }],
        inbox: ["zara-muse-portrait.jpg"],
        log: [{ date: "[Sample day]", lines: ["Published: nothing went live.", "Drafts waiting: one guide.", "Needs you: one topic to approve."] }] },
      { id: "site-3", name: "Site 3", domain: "", live: false, artists: [] },
      { id: "site-4", name: "Site 4", domain: "", live: false, artists: [] },
      { id: "site-5", name: "Site 5", domain: "", live: false, artists: [] },
    ],
  };
  function demoApi(body) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        if (body.action === "overview") resolve(JSON.parse(JSON.stringify(demoData)));
        else if (body.action === "uploadPhoto") resolve({ ok: true, name: body.artist + "-" + String(body.description).toLowerCase().replace(/[^a-z0-9]+/g, "-") + "." + body.ext });
        else resolve({ ok: true });
      }, 250);
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
  window.__adh = { state: state, render: render, esc: esc };
  start();
})();
