/* A site built with Artiscope Digital Home from The Art World Report template:
   an editorial site on the business of the art world, with features in sections
   and research areas. Draws every page from the site's data.
   Used twice: by tools/build.mjs to write the published pages, and by the page
   editor in Artiscope Digital Home to redraw a page as it is edited.
   The site's details, features and research areas are in data/content.json, its
   pages and their sections in data/pages.json, and the colours and typefaces in
   data/theme.json. Besides the sections every site offers, this design has six of
   its own: Page opening, Feature cards, Cards, Briefing band, Link list and Page text. */
(function (root) {
  "use strict";

  // ----- small helpers -----
  function esc(v) { return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;"); }
  // words typed in the console: shown as written, never as markup
  function txt(v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  // a heading: words between stars are set in italics, as in "Understanding the *Business* of Art."
  function ital(v) { return txt(v).replace(/\*([^*\n]+)\*/g, "<em>$1</em>"); }
  function plainOf(v) { return String(v == null ? "" : v).replace(/\*([^*\n]+)\*/g, "$1"); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function arr(o, k) { var v = o && o[k]; return Array.isArray(v) ? v : []; }
  function get(o, k, d) { return o && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined && o[k] !== null ? o[k] : d; }
  // an address typed in the console: a page of this site, or a full address
  function addrOk(h) { return /^(\.\/$|#|\/|[a-z0-9-]+\/|https?:\/\/|mailto:)/i.test(String(h || "")); }
  function hrefOf(h) { h = String(h || ""); return /^(https?:|mailto:|\/)/i.test(h) ? h : "@@" + h; }
  // the site's own web address, always ending in a slash
  function addressOf(D) { var a = String(((D || {}).site || {}).address || ""); return /^https:\/\/[a-z0-9.-]+(\/[A-Za-z0-9._\/-]*)?$/.test(a) ? a.replace(/\/*$/, "/") : "https://example.org/"; }
  // The site's logo, drawn beside its name: plain shapes only (rectangles, paths, circles and a mask), never
  // anything that could run. {id} in it becomes a name of its own on each use, so the header's and the footer's
  // masks do not clash. Anything else is left out, and the name shows alone.
  var MARK_TAGS = /^(svg|defs|mask|g|rect|path|circle|ellipse|line|polyline|polygon)$/;
  var MARK_ATTR = /^(d|x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|width|height|points|fill|stroke|stroke-width|stroke-linejoin|stroke-linecap|transform|mask|id|opacity|viewBox)$/;
  function markOk(m) {
    m = String(m || ""); if (!m || m.length > 4000) return false;
    var ok = true;
    m.replace(/<\/?([a-zA-Z]+)([^>]*)>/g, function (all, tag, rest) {
      if (!MARK_TAGS.test(tag)) ok = false;
      String(rest).replace(/\/\s*$/, "").replace(/\s+([a-zA-Z-]+)="([^"<>]*)"/g, function (x, k, v) { if (!MARK_ATTR.test(k) || /script|javascript|url\((?!#)/i.test(v)) ok = false; return ""; }).replace(/\s+/g, "") && (ok = false);
      return "";
    });
    return ok && !/<[^>]*$/.test(m) && m.replace(/<[^>]*>/g, "").trim() === "";
  }
  // the small pause before each item of a row comes into view
  function delay(k, step, per) { var d = (k % per) * step; return d ? ' style="--d:' + d + 'ms"' : ""; }

  // The data file as one object, the same shape Artiscope Digital Home edits.
  // Features live at features/<name>/ and research areas at research/<name>/.
  var P = { articles: "features", artists: "research" };
  // A feature lives at features/<name>/ unless it names another folder, such as industry-news or reports.
  function folderOf(a) { var f = String((a && a.folder) || ""); return /^[a-z0-9-]{1,40}$/.test(f) ? f : P.articles; }
  function fromFiles(content) {
    var c = JSON.parse(JSON.stringify(content || {})), s = c.site || {};
    return { site: { email: String(s.email || ""), address: String(s.address || ""), indexed: s.indexed === true, mark: String(s.mark || ""), icons: String(s.icons || "") },
      articles: Array.isArray(c.articles) ? c.articles : [], artists: Array.isArray(c.artists) ? c.artists : [] };
  }

  function Site(D, PAGES, THEME, opts) {
    opts = opts || {};
    D = D || {}; PAGES = PAGES || { shared: {}, pages: {} };
    // The fixed words of the design. Edit default text in Artiscope Digital Home keeps changed ones in the
    // page list file under "words"; any word not changed keeps the site's own, written beside each W().
    var WORDS = PAGES.words && typeof PAGES.words === "object" ? PAGES.words : {};
    function Wt(key, dflt) { return typeof WORDS[key] === "string" && WORDS[key].trim() ? WORDS[key] : dflt; }
    function W(key, dflt, slots) {
      var t = txt(Wt(key, dflt)).replace(/"/g, "&quot;");
      Object.keys(slots || {}).forEach(function (k) { t = t.split("{" + k + "}").join(slots[k]); });
      return t;
    }
    function wordsTag() { return Object.keys(WORDS).length ? '<script type="application/json" id="adh-words">' + JSON.stringify(WORDS).replace(/</g, "\\u003c") + '</script>\n' : ""; }
    var SITE = D.site || {}, SITE_URL = addressOf(D), MAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(SITE.email || "") ? SITE.email : "info@artiscope.co.uk";
    // Social media addresses chosen in the theme; nothing is shown until one is filled in.
    function socialHtml() {
      var all = opts.social && typeof opts.social === "object" ? opts.social : {}, out = Object.keys(all).map(function (k) { return all[k]; }).filter(function (x) { return x && /^https:\/\/[^\s<>"']+$/.test(x.href || ""); });
      return out.length ? '<nav class="foot-social" aria-label="' + W("sr.social", "Social media") + '">' + out.map(function (x) { return '<a href="' + esc(x.href) + '" rel="noopener">' + esc(x.label) + '</a>'; }).join("") + '</nav>\n' : "";
    }
    // the site's own small icons for browser tabs and phones, when its details name the folder they are in
    function icons(r) {
      var d = String(SITE.icons || ""); if (!/^assets\/([a-z0-9-]+\/)?$/.test(d)) return "";
      return '<link rel="icon" href="' + r + d + 'favicon.svg" type="image/svg+xml">\n<link rel="icon" href="' + r + d + 'favicon-32.png" sizes="32x32" type="image/png">\n<link rel="apple-touch-icon" href="' + r + d + 'apple-touch-icon.png">\n';
    }
    function iconOk() { return typeof opts.favicon === "string" && /^assets\/images\/[A-Za-z0-9._-]{1,120}\.(png|jpe?g|svg|ico)$/.test(opts.favicon); }

    function shared(key) { var part = (PAGES.shared || {})[key] || {}; return [part.settings || {}, get(part, "visible", true) !== false]; }
    function hd() { return shared("header")[0]; }
    function NAME() { return get(hd(), "name", "") || "[Site name]"; }
    function pairs(list) { return (Array.isArray(list) ? list : []).map(function (l, k) { return { l: l, k: k }; }).filter(function (x) { return Array.isArray(x.l) && String(x.l[0] || "").trim(); }); }

    // ----- features and research areas: the ones visitors can see, newest feature first -----
    var stamp = function (a) { var t = Date.parse(String(a.date || "")); return isNaN(t) ? -Infinity : t; };
    var ARTICLES = (D.articles || []).filter(function (a) { return a && a.slug && a.hidden !== true; }).map(function (a, i) { return { a: a, i: i }; })
      .sort(function (x, y) { return stamp(y.a) - stamp(x.a) || x.i - y.i; }).map(function (x) { return x.a; });
    var ARTISTS = (D.artists || []).filter(function (x) { return x && x.slug && x.hidden !== true; });
    function articleOf(slug) { return (D.articles || []).find(function (a) { return a.slug === slug; }) || null; }
    function artistOf(slug) { return (D.artists || []).find(function (a) { return a.slug === slug; }) || null; }
    // A list page is drawn by the site unless a page of the console already uses its address.
    function listOn(k) { return !Object.keys(PAGES.pages || {}).some(function (x) { return PAGES.pages[x].path === P[k] + "/index.html"; }); }
    function listWords(k) {
      var l = ((PAGES.lists || {})[k]) || {}, h = Array.isArray(l.heading) ? l.heading.filter(Boolean) : l.heading ? [l.heading] : [];
      var name = k === "articles" ? Wt("menu.articles", "Features") : Wt("menu.artists", "Research areas");
      return { name: name, eyebrow: l.eyebrow == null ? name : l.eyebrow, heading: h.length ? h : [name], intro: l.intro == null ? (k === "articles" ? "[A line about what the features cover]" : "[A line about the research areas]") : l.intro };
    }
    function photo(desc, ratio) {
      var st = ratio ? ' style="aspect-ratio:' + ratio + '"' : "";
      return '<div class="ph" role="img" aria-label="' + W("sr.photo", "Photograph to come: {what}", { what: esc(desc) }) + '"' + st + '><span class="ph-t">' + W("missing.photo", "Photograph to come.") + '</span> <span class="ph-d">' + esc(desc) + '</span></div>';
    }

    // ----- the frame of every page -----
    // Sections shared by every page: announcement bars above the menu bar, the rest at the top and bottom of the page.
    function groupHtml(where, ann) {
      return (((PAGES.groups || {})[where]) || []).filter(function (sec) { return sec && sec.visible !== false && S[sec.type] && (where !== "top" || (sec.type === "announcement") === !!ann); })
        .map(function (sec) { return mark(cssMark(S[sec.type](sec.settings || {}, { id: sec.id, page: "every" }), sec), sec.id); }).join("\n");
    }

    // ----- add-ons: our own small extras for every page, switched on in Artiscope Digital Home -----
    function aoHtml(A, kind, url, title, esc, link) {
      A = A || {}; var out = { share: "", fixed: "" }, on = function (id) { return !!(A[id] && A[id].on === true); };
      var fits = function (w) { return w === "all" || (w === "items" ? (kind === "article" || kind === "artist") : kind === "article"); };
      if (on("share") && fits(A.share.where || "articles")) {
        var u = encodeURIComponent(url), t = encodeURIComponent(title || "");
        var nets = { email: ["Email", "mailto:?subject=" + t + "&body=" + u], x: ["X", "https://x.com/intent/post?url=" + u + "&text=" + t], linkedin: ["LinkedIn", "https://www.linkedin.com/sharing/share-offsite/?url=" + u], facebook: ["Facebook", "https://www.facebook.com/sharer/sharer.php?u=" + u] };
        var links = (A.share.networks || []).filter(function (n) { return nets[n]; }).map(function (n) { return '<a href="' + esc(nets[n][1]) + '"' + (n === "email" ? "" : ' target="_blank" rel="noopener noreferrer"') + '>' + nets[n][0] + '</a>'; }).join("");
        if (links) out.share = '<aside class="ao-share" aria-label="' + W("sr.share", "Share this page") + '"><span>' + esc(A.share.heading || "Share this page") + '</span>' + links + '</aside>';
      }
      if (on("progress") && fits(A.progress.where || "articles")) out.fixed += A.progress.style === "percent" ? '<div class="ao-progress pct" aria-hidden="true"><b>0%</b></div>' : '<div class="ao-progress" aria-hidden="true"><i></i></div>';
      if (on("top")) out.fixed += '<button type="button" class="ao-top' + (A.top.side === "left" ? " left" : "") + '" data-after="' + (Number(A.top.after) || 600) + '">' + esc(A.top.label || "Top") + '</button>';
      if (on("privacy")) out.fixed += '<div class="ao-privacy" role="region" aria-label="' + W("sr.privacy", "Privacy") + '"><p>' + esc(A.privacy.text || "") + (A.privacy.link && A.privacy.link_label ? ' <a href="' + esc(link(A.privacy.link)) + '">' + esc(A.privacy.link_label) + '</a>' : "") + '</p><button type="button" data-ao-close>' + esc(A.privacy.button || "Close") + '</button></div>';
      return out;
    }
    var AO_KIND = "page";
    function page(path, title, desc, main, o) {
      o = o || {};
      var urlPath = /index\.html$/.test(path) ? path.slice(0, -"index.html".length) : (o.file ? "" : path);
      var ao = aoHtml(PAGES.addons, AO_KIND, SITE_URL + urlPath, String(title || "").split(" | ")[0], esc, function (x) { return /^(https?:|mailto:|#|\/)/.test(x) ? x : "@@" + x; });
      var kind = AO_KIND; AO_KIND = "page";
      // a page with its own layout has no menu bar, footer or shared sections; popups show on every page
      o.top = o.own ? "" : [groupHtml("top", true), o.top || ""].filter(Boolean).join("\n");
      main = (o.own ? [main, groupHtml("popups"), ao.fixed] : [groupHtml("top", false), main, ao.share, groupHtml("bottom"), groupHtml("popups"), ao.fixed]).filter(Boolean).join("\n  ");
      var depth = (urlPath.match(/\//g) || []).length, r = o.file ? "" : new Array(depth + 1).join("../");
      var go = function (h) { return esc(hrefOf(h).split("@@").join(r)); };
      var name = txt(NAME()), st = hd(), hon = shared("header")[1], home = r || "./";
      var brand = function (n) { return markOk(SITE.mark) ? '<svg class="mark" viewBox="0 0 100 100" aria-hidden="true">' + SITE.mark.split("{id}").join("mk" + n) + '</svg><span>' + name + '</span>' : name; };
      main = String(main).split("@@").join(r);
      var links = pairs(get(st, "links", [])).map(function (x) { return '<a href="' + go(x.l[1]) + '" data-adh-b="links.' + x.k + '">' + txt(x.l[0]) + '</a>'; }).join("\n        ");
      var menuLinks = pairs(get(st, "menu", [])).map(function (x, i) { return '<a href="' + go(x.l[1]) + '" style="--i:' + i + '" data-adh-b="menu.' + x.k + '">' + txt(x.l[0]) + '</a>'; }).join("\n      ");
      var line = get(st, "line", "");
      var nav = !hon || o.own ? "" : '<header class="site-header" id="nav">\n  <div class="wrap">\n    <a class="wordmark" href="' + home + '">' + brand(1) + '</a>\n    <div class="head-right">\n' +
        (links ? '      <nav class="head-nav" aria-label="' + W("sr.nav", "Primary") + '">\n        ' + links + '\n      </nav>\n' : "") +
        (menuLinks ? '      <button class="menu-btn" id="menu-open" type="button" aria-expanded="false" aria-controls="menu">' + W("btn.menu", "Menu") + '</button>\n' : "") + '    </div>\n  </div>\n</header>\n' +
        (menuLinks ? '<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="' + W("btn.menu", "Menu") + '" aria-hidden="true">\n  <div class="menu-panel"></div>\n  <div class="menu-inner">\n' +
          '    <div class="menu-top"><span>' + W("btn.menu", "Menu") + '</span><button type="button" id="menu-close">' + W("btn.close", "Close") + '</button></div>\n' +
          '    <nav class="menu-nav" aria-label="' + W("sr.menu", "All sections") + '">\n      ' + menuLinks + '\n    </nav>\n' +
          '    <div class="menu-foot">\n      <a href="mailto:' + esc(MAIL) + '">' + esc(MAIL) + '</a>\n' + (line ? '      <span>' + txt(line) + '</span>\n' : "") + '    </div>\n  </div>\n</div>' : "");
      var ft = shared("footer"), f = ft[0];
      var cols = arr(f, "columns").map(function (c, k) { return { c: c, k: k }; }).filter(function (x) { return x.c && x.c.hidden !== true; }).map(function (x) {
        var c = x.c, ls = pairs(c.links).map(function (y) { return '            <li data-adh-b="columns.' + x.k + '.links.' + y.k + '"><a href="' + go(y.l[1]) + '">' + txt(y.l[0]) + '</a></li>'; }).join("\n");
        return '        <div data-adh-b="columns.' + x.k + '">\n' + (c.title ? '          <p class="eyebrow">' + txt(c.title) + '</p>\n' : "") + (ls ? '          <ul>\n' + ls + '\n          </ul>\n' : "") + '        </div>';
      }).join("\n");
      var legal = get(f, "legal", ""), social = socialHtml(), tag = get(f, "tagline", "");
      var foot = !ft[1] || o.own ? "" : '<footer class="site-footer foot" id="foot">\n  <div class="wrap">\n    <div class="foot-top">\n      <div class="foot-brand">\n        <a class="wordmark" href="' + home + '">' + brand(2) + '</a>\n' +
        (tag ? '        <p class="tag">' + txt(tag) + '</p>\n' : "") + (get(f, "email", true) !== false ? '        <a class="mail" href="mailto:' + esc(MAIL) + '">' + esc(MAIL) + '</a>\n' : "") + '      </div>\n' +
        (cols ? '      <div class="foot-cols">\n' + cols + '\n      </div>\n' : "") + '    </div>\n' + social + (legal ? '    <p class="legal">' + txt(legal).split("{year}").join(String(new Date().getFullYear())) + '</p>\n' : "") + '  </div>\n</footer>';
      var noindex = SITE.indexed !== true ? '<meta name="robots" content="noindex, nofollow">\n' : "";
      var html = '<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' + noindex +
        '<title>' + esc(title) + '</title>\n<meta name="description" content="' + esc(desc) + '">\n<link rel="canonical" href="' + esc(SITE_URL + urlPath) + '">\n' +
        '<meta property="og:title" content="' + esc(title) + '">\n<meta property="og:description" content="' + esc(desc) + '">\n' +
        '<meta property="og:type" content="' + (kind === "article" ? "article" : "website") + '">\n<meta property="og:url" content="' + esc(SITE_URL + urlPath) + '">\n' +
        (iconOk() ? "" : icons(r)) + '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital@0;1&family=Libre+Franklin:wght@400;500;600&display=swap">\n' +
        (o.head || "") + (iconOk() ? '<link rel="icon" href="' + r + opts.favicon + '">\n' : "") +
        '<link rel="stylesheet" href="' + r + 'assets/site.css">\n' + (THEME || "") + secCssTag() + wordsTag() +
        '</head>\n<body' + (/class="ann /.test(o.top || "") ? ' class="has-ann"' : "") + '>\n<a class="skip" href="#main">' + W("menu.skip", "Skip to content") + '</a>\n' + (o.top ? String(o.top).split("@@").join(r) + "\n" : "") + nav + '\n<main id="main">\n' + main + '\n</main>\n' + foot + '\n' +
        '<script src="' + r + 'assets/site.js" defer></script>\n</body>\n</html>\n';
      return { path: o.file || path, url: urlPath, html: html };
    }

    // ----- sections -----
    var S = {};
    // The newsletter: a full band with the sign-up box, or a short strip at the foot of a page that leads to it.
    // The box opens the visitor's own email app with a request to join; the site sends and keeps nothing.
    function briefing(st, id, h1) {
      var e = get(st, "eyebrow", ""), h = get(st, "heading", ""), t = get(st, "text", ""), b = get(st, "button", "") ? txt(st.button) : W("btn.join", "Subscribe"), tag = h1 ? "h1" : "h2";
      return '<section class="band band-dark briefing" id="' + esc(id) + '">\n  <div class="wrap">\n    <div class="briefing-copy">\n' +
        (e ? '      <p class="eyebrow" data-r="fade">' + txt(e) + '</p>\n' : "") + (h ? '      <' + tag + ' data-lines>' + ital(h) + '</' + tag + '>\n' : "") +
        (t ? '      <p class="lead" data-words style="--s:16ms">' + txt(t) + '</p>\n' : "") +
        '      <form class="signup" data-signup data-email="' + esc(MAIL) + '" data-r style="--d:300ms" novalidate>\n        <label class="vh" for="' + esc(id) + '-email">' + W("form.email", "Email address") + '</label>\n' +
        '        <input id="' + esc(id) + '-email" name="email" type="email" autocomplete="email" placeholder="' + W("form.placeholder", "Your email address") + '">\n        <button class="btn btn-light" type="submit">' + b + '</button>\n      </form>\n' +
        '      <p class="signup-note" role="status">' + W("form.note", "This opens your own email app with a message ready to send to {email}.", { email: esc(MAIL) }) + '</p>\n' +
        (get(st, "pitch", "") ? '      <p class="signup-note">' + txt(st.pitch) + '</p>\n' : "") + '    </div>\n  </div>\n</section>';
    }
    S.signup = function (st, ctx) { return briefing(st, (ctx && ctx.id) || "signup", false); };
    // A sign-up box that pops up once a visit; drawn hidden, and shown by the site's script.
    S["signup-popup"] = function (st, ctx) {
      var id = (ctx && ctx.id) || "popup", d = Math.max(3, Math.min(60, Number(get(st, "delay", 8)) || 8)), e = get(st, "eyebrow", ""), t = get(st, "text", "");
      return '<div class="supop" id="' + esc(id) + '" data-popup data-delay="' + d + '" role="dialog" aria-labelledby="' + esc(id) + '-h" hidden>\n  <button type="button" class="supop-x" data-pop-close>' + W("btn.close", "Close") + '</button>\n' +
        (e ? '  <p class="eyebrow">' + txt(e) + '</p>\n' : "") + '  <h2 id="' + esc(id) + '-h">' + ital(get(st, "heading", "")) + '</h2>\n' + (t ? '  <p class="dek">' + txt(String(t).trim()) + '</p>\n' : "") +
        '  <form class="nl" data-popform data-email="' + esc(MAIL) + '" novalidate><label class="vh" for="' + esc(id) + '-e">' + W("form.email", "Email address") + '</label><input id="' + esc(id) + '-e" name="email" type="email" required placeholder="' + W("form.placeholder", "Your email address") + '" autocomplete="email"><button class="btn" type="submit">' + (get(st, "button", "") ? txt(get(st, "button", "")) : W("btn.join", "Subscribe")) + '</button></form>\n' +
        '  <p class="mf-note" role="status">' + W("form.note", "This opens your own email app with a message ready to send to {email}.", { email: esc(MAIL) }) + '</p>\n</div>';
    };

    // ----- the six sections of this design -----
    function band(st) { return { grey: " band-grey", dark: " band-dark" }[get(st, "band", "")] || ""; }
    // A card's line may lead somewhere: [some words](contact/) becomes a link on those words.
    function withLinks(t) {
      return txt(t).replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, function (all, words, h) { h = h.replace(/&amp;/g, "&"); return addrOk(h) ? '<a href="' + esc(hrefOf(h)) + '">' + words + '</a>' : all; });
    }
    function featureCard(a, k) {
      var kick = String(a.kicker || "").trim();
      return '<article class="card" data-r' + delay(k, 90, 2) + '>' + (kick ? '<p class="eyebrow">' + txt(kick) + '</p>' : "") + '<h3><a href="@@' + folderOf(a) + '/' + esc(a.slug) + '/">' + txt(String(a.title || "").trim() || "[Feature title]") + '</a></h3>' + (String(a.card || "").trim() ? '<p class="muted">' + txt(a.card) + '</p>' : "") + '</article>';
    }
    // Section names, as typed in a setting: several are separated by commas.
    function sectionNames(v) { return String(v || "").split(",").map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean); }
    // A feature is in a section when that is its own section, or one of the others it is also listed under.
    function inSections(a, names) {
      var mine = [a.kicker].concat(Array.isArray(a.also) ? a.also : []).map(function (x) { return String(x || "").trim().toLowerCase(); });
      return names.some(function (x) { return mine.indexOf(x) >= 0; });
    }
    function cardGrid(list) { return '<div class="grid-2">\n' + list.map(function (a, k) { return '      ' + featureCard(a, k); }).join("\n") + '\n    </div>'; }
    // The words at the top of a page: full screen on the home page, smaller on the others.
    S["awr-opening"] = function (st, ctx) {
      var size = get(st, "size", "page"), e = get(st, "eyebrow", ""), h = get(st, "heading", ""), t = get(st, "text", "");
      var topics = arr(st, "topics").filter(function (x) { return typeof x === "string" && x.trim(); });
      var btn = get(st, "button", "") && addrOk(get(st, "button_href", "")) ? '<a class="btn" href="' + esc(hrefOf(st.button_href)) + '">' + txt(st.button) + '</a>' : "";
      var lnk = get(st, "link", "") && addrOk(get(st, "href", "")) ? '<a class="textlink" href="' + esc(hrefOf(st.href)) + '">' + txt(st.link) + '</a>' : "";
      var hero = size === "large", id = esc((ctx && ctx.id) || "opening");
      return '<section class="' + (hero ? "hero" : "page-head" + (size === "tall" ? " page-tall" : "")) + '" id="' + id + '">\n  <div class="wrap">\n' +
        (e ? '    <p class="eyebrow" data-r="fade">' + txt(e) + '</p>\n' : "") + (h ? '    <h1 data-lines style="--s:140ms">' + ital(h) + '</h1>\n' : "") +
        (String(get(st, "note", "") || "").trim() ? '    <p class="byline" data-r style="--d:400ms">' + txt(st.note) + '</p>\n' : "") +
        (t ? '    <p class="lead muted' + (get(st, "wide", false) === true ? " lead-wide" : "") + '" data-words style="--d:' + (hero ? 500 : 400) + 'ms">' + txt(t) + '</p>\n' : "") +
        (topics.length ? '    <ul class="topics" data-r style="--d:400ms">\n' + topics.map(function (x) { return '      <li>' + txt(x.trim()) + '</li>'; }).join("\n") + '\n    </ul>\n' : "") +
        (get(st, "email", false) === true ? '    <p data-r style="--d:600ms"><a class="biglink serif" href="mailto:' + esc(MAIL) + '">' + esc(MAIL) + '</a></p>\n' : "") +
        (btn || lnk ? (hero ? '    <div class="hero-cta" data-r style="--d:800ms">\n      ' + [btn, lnk].filter(Boolean).join("\n      ") + '\n    </div>\n' : '    <p class="head-cta" data-r style="--d:600ms">' + [btn, lnk].filter(Boolean).join(" ") + '</p>\n') : "") +
        '  </div>\n</section>';
    };
    // Cards for the features: every feature, or one section's, or one research area's. Newest first.
    S["awr-features"] = function (st, ctx) {
      var only = sectionNames(get(st, "only", "")), folder = String(get(st, "folder", "") || "").trim(), area = String(get(st, "area", "") || "").trim(), n = Math.max(1, Math.min(48, Number(get(st, "count", 6)) || 6));
      var list = ARTICLES.filter(function (a) { return (!only.length || inSections(a, only)) && (!folder || folderOf(a) === folder) && (!area || subjectsOf(a).some(function (x) { return x.slug === area; })); });
      var shown = get(st, "every", true) === false ? list.slice(0, n) : list, e = get(st, "eyebrow", ""), h = get(st, "heading", "");
      var empty = get(st, "empty", "") || "[Features appear here once you add them]";
      return '<section class="band' + band(st) + (get(st, "close", false) === true ? " band-top0" : "") + '" id="' + esc((ctx && ctx.id) || "features") + '">\n  <div class="wrap">\n' +
        (e ? '    <p class="eyebrow" data-r="fade">' + txt(e) + '</p>\n' : "") + (h ? '    <h2 class="h-section" data-lines>' + ital(h) + '</h2>\n' : "") +
        (shown.length ? '    ' + cardGrid(shown) + '\n' : '    <p class="muted empty" data-r>' + txt(empty) + '</p>\n') + '  </div>\n</section>';
    };
    // Cards written by hand, each with a heading, a line and an optional link; or one for every research area.
    S["awr-cards"] = function (st, ctx) {
      var e = get(st, "eyebrow", ""), h = get(st, "heading", ""), rows;
      if (get(st, "source", "hand") === "areas") rows = ARTISTS.map(function (x) { return { title: String(x.name || "").trim() || "[Research area]", text: x.line || "", href: P.artists + "/" + x.slug + "/", tag: "" }; });
      else rows = liveRows(get(st, "cards", [])).filter(function (r) { return r.x.title || r.x.text; }).map(function (r) { return { title: r.x.title || "", text: r.x.text || "", href: r.x.href, tag: ' data-adh-b="cards.' + r.i + '"' }; });
      var cards = rows.map(function (c, k) {
        var t = txt(c.title), head = addrOk(c.href) ? '<a href="' + esc(hrefOf(c.href)) + '">' + t + '</a>' : t;
        return '      <article class="card card-plain" data-r' + delay(k, 90, 3) + c.tag + '><h3>' + head + '</h3>' + (String(c.text || "").trim() ? '<p class="muted">' + withLinks(c.text) + '</p>' : "") + '</article>';
      }).join("\n");
      return '<section class="band' + band(st) + '" id="' + esc((ctx && ctx.id) || "cards") + '">\n  <div class="wrap">\n' +
        (e ? '    <p class="eyebrow" data-r="fade">' + txt(e) + '</p>\n' : "") + (h ? '    <h2 class="h-section" data-lines>' + ital(h) + '</h2>\n' : "") +
        (cards ? '    <div class="grid-3">\n' + cards + '\n    </div>\n' : '    <p class="muted empty" data-r>[Cards appear here once you add them]</p>\n') + '  </div>\n</section>';
    };
    // The newsletter, as a full band with the sign-up box or as a short strip with a button that leads to it.
    S["awr-briefing"] = function (st, ctx) {
      var id = (ctx && ctx.id) || "briefing";
      if (get(st, "style", "full") === "full") return briefing(st, id, get(st, "main", false) === true);
      var h = get(st, "heading", ""), t = get(st, "text", ""), b = get(st, "button", "") && addrOk(get(st, "href", "")) ? '<a class="btn btn-light" href="' + esc(hrefOf(st.href)) + '">' + txt(st.button) + '</a>' : "";
      return '<section class="band band-dark strip" id="' + esc(id) + '">\n  <div class="wrap">\n' + (h ? '    <h2 data-lines>' + ital(h) + '</h2>\n' : "") +
        (t ? '    <p class="lead" data-r>' + txt(t) + '</p>\n' : "") + (b ? '    <p data-r style="--d:150ms">' + b + '</p>\n' : "") + '  </div>\n</section>';
    };
    // A row of large links, such as the sections or the related research areas.
    function linkList(rows) {
      return '<ul class="linklist">\n' + rows.map(function (x, k) { return '      <li data-r style="--d:' + (k * 80) + 'ms"' + (x.tag || "") + '><a href="' + esc(x.href) + '">' + txt(x.label) + '</a></li>'; }).join("\n") + '\n    </ul>';
    }
    S["awr-links"] = function (st, ctx) {
      var e = get(st, "eyebrow", ""), rows = liveRows(get(st, "links", [])).filter(function (r) { return r.x.label && addrOk(r.x.href); }).map(function (r) { return { label: r.x.label, href: hrefOf(r.x.href), tag: ' data-adh-b="links.' + r.i + '"' }; });
      return '<section class="band' + band(st) + '" id="' + esc((ctx && ctx.id) || "links") + '">\n  <div class="wrap">\n' + (e ? '    <p class="eyebrow" data-r="fade">' + txt(e) + '</p>\n' : "") +
        (rows.length ? '    ' + linkList(rows) + '\n' : '    <p class="muted empty" data-r>[Links appear here once you add them]</p>\n') + '  </div>\n</section>';
    };
    // Words in the reading column, with headings, lists and links, such as Privacy and Terms.
    S["awr-text"] = function (st, ctx) {
      var sf = String(get(st, "standfirst", "") || "").trim(), body = String(get(st, "body", "") || "");
      if (!body.replace(/<[^>]*>/g, "").trim() && !sf) body = "<p>[Write the words for this page here]</p>";
      return '<section class="article-body" id="' + esc((ctx && ctx.id) || "text") + '">\n  <div class="wrap">\n    <div class="prose">\n' + (sf ? '<p class="standfirst">' + txt(sf) + '</p>\n' : "") + body + '\n    </div>\n  </div>\n</section>';
    };

    // ----- sections any page can use, the same set as the other sites, drawn in this site's look -----
    function liveRows(list) { return (Array.isArray(list) ? list : []).map(function (x, i) { return { x: x, i: i }; }).filter(function (r) { return r.x && r.x.hidden !== true; }); }
    function paras(t) { t = String(t || "").trim(); return t ? "<p>" + txt(t).split(/\n\s*\n/).join("</p><p>").replace(/\n/g, "<br>") + "</p>" : ""; }
    function headBlock(st) {
      var e = get(st, "eyebrow", ""), h = get(st, "heading", "");
      if (!e && !h) return "";
      return '<div class="sec-head">' + (e ? '<p class="kicker">' + txt(e) + '</p>' : "") + (h ? '<h2>' + txt(h) + '</h2>' : "") + '</div>';
    }
    function libSec(cls, inner) { return '<section class="sec sec--lib' + (cls ? " " + cls : "") + '"><div class="wrap">' + inner + '</div></section>'; }
    // a photo, or the frame that waits for one
    function picOf(x, desc, ratio) {
      if (x && x.image) return '<img class="ph-img" src="' + esc(opts.imageSrc ? opts.imageSrc(x.image) : "@@assets/images/" + x.image) + '" alt="' + esc(x.alt || "") + '" loading="lazy"' + (ratio ? ' style="aspect-ratio:' + ratio + '"' : "") + '>';
      return photo((x && x.alt) || desc || "Photograph", ratio);
    }
    function link(words, h, cls) { return words && addrOk(h) ? '<a class="' + (cls || "tlink") + '" href="' + esc(hrefOf(h)) + '"' + (/^https?:/i.test(String(h)) ? ' rel="noopener"' : "") + '>' + txt(words) + '</a>' : ""; }
    function rep(x) { return x && x.reported ? '<span class="badge">' + W("item.reported", "Reported") + '</span> ' : ""; }
    function per(st) { return { "2": 2, "3": 3, "4": 4 }[String(get(st, "per_row", "3"))] || 3; }
    function mailTo() { return MAIL; }

    S.announcement = function (st) {
      var rows = liveRows(get(st, "messages", [])).filter(function (r) { return r.x.text || r.x.link; });
      var look = get(st, "style", "band") === "page" ? "ann--page" : "ann--band";
      var secs = Math.max(3, Math.min(30, Number(get(st, "seconds", 6)) || 6));
      var msgs = rows.map(function (r, k) { return '<p class="ann-msg' + (k ? "" : " on") + '" data-adh-b="messages.' + r.i + '"><span>' + txt(r.x.text || "") + '</span>' + link(r.x.link, r.x.href, "ann-link") + '</p>'; }).join("");
      return '<div class="ann ' + look + '" data-announce data-secs="' + secs + '"><div class="wrap ann-in"><div class="ann-msgs">' + msgs + '</div>' + (rows.length > 1 ? '<span class="ann-count" aria-hidden="true">' + W("btn.count", "{n} of {total}", { n: "1", total: String(rows.length) }) + '</span>' : "") + '</div></div>';
    };
    S.columns = function (st) {
      var num = get(st, "numbered", true) !== false;
      var cards = liveRows(get(st, "columns", [])).map(function (r, k) {
        var c = r.x;
        return '<div class="lcard" data-adh-b="columns.' + r.i + '">' + (num ? '<p class="kicker">' + (k < 9 ? "0" : "") + (k + 1) + '</p>' : "") + (c.title ? '<h3>' + txt(c.title) + '</h3>' : "") +
          (c.text ? '<div class="lcard-text">' + paras(c.text) + '</div>' : "") + link(c.link, c.href) + '</div>';
      }).join("");
      return libSec("", headBlock(st) + '<div class="lgrid lgrid--' + per(st) + '">' + cards + '</div>');
    };
    S.space = function (st) { return '<div class="space space--' + ({ S: "s", L: "l" }[get(st, "size", "M")] || "m") + '" aria-hidden="true"></div>'; };
    S.quote = function (st) {
      var who = get(st, "who", "");
      return libSec("", '<figure class="bigq"><blockquote>' + txt(String(get(st, "text", "")).trim()).replace(/\n+/g, "<br>") + '</blockquote>' + (who ? '<figcaption>' + txt(who) + '</figcaption>' : "") + '</figure>');
    };
    S.faq = function (st) {
      var items = liveRows(get(st, "items", [])).map(function (r) {
        return '<details class="qa" data-adh-b="items.' + r.i + '"><summary><span class="qa-q">' + txt(r.x.q || "") + '</span><span class="qa-word" aria-hidden="true"></span></summary><div class="qa-a">' + paras(r.x.a) + '</div></details>';
      }).join("");
      return libSec("", headBlock(st) + '<div class="qa-list">' + items + '</div>');
    };
    S.button = function (st) {
      var inner = (get(st, "heading", "") ? '<h2>' + txt(st.heading) + '</h2>' : "") + (get(st, "text", "") ? '<p class="dek">' + txt(st.text) + '</p>' : "") + link(get(st, "label", ""), get(st, "href", ""), "btn");
      return get(st, "panel", true) === false ? libSec("", '<div class="cta cta--plain">' + inner + '</div>') : libSec("on-band", '<div class="cta">' + inner + '</div>');
    };
    S["picture-banner"] = function (st) {
      var place = { C: "pb--c", R: "pb--r" }[get(st, "place", "L")] || "pb--l", box = get(st, "box", "band") === "page" ? "pb-box--page" : "pb-box--band";
      var e = get(st, "eyebrow", ""), h = get(st, "heading", ""), t = get(st, "text", "");
      return libSec("", '<div class="pb ' + place + (get(st, "fit", "fill") === "whole" ? " pb--whole" : "") + '"><div class="pb-pic">' + picOf(st, "Banner photograph") + '</div>' +
        '<div class="pb-box ' + box + '">' + (e ? '<p class="kicker">' + txt(e) + '</p>' : "") + (h ? '<h2>' + txt(h) + '</h2>' : "") + (t ? '<p>' + txt(t) + '</p>' : "") + link(get(st, "label", ""), get(st, "href", ""), "btn") + '</div></div>');
    };
    S.slideshow = function (st) {
      var rows = liveRows(get(st, "slides", [])), n = rows.length, secs = Math.max(3, Math.min(30, Number(get(st, "seconds", 6)) || 6));
      var slides = rows.map(function (r, k) { return '<figure class="ss-slide' + (k ? "" : " on") + '" data-adh-b="slides.' + r.i + '">' + picOf(r.x, "Slide " + (k + 1), "16/9") + (r.x.caption ? '<figcaption>' + txt(r.x.caption) + '</figcaption>' : "") + '</figure>'; }).join("");
      var nav = n > 1 ? '<div class="ss-nav"><button type="button" class="tlink" data-ss="prev">' + W("btn.previous", "Previous") + '</button><span class="ss-at" aria-live="polite">' + W("btn.count", "{n} of {total}", { n: "1", total: String(n) }) + '</span><button type="button" class="tlink" data-ss="next">' + W("btn.next", "Next") + '</button></div>' : "";
      return libSec("", headBlock(st) + '<div class="ss" data-slides data-auto="' + (get(st, "auto", true) === false ? 0 : 1) + '" data-secs="' + secs + '" aria-roledescription="slideshow">' + slides + nav + '</div>');
    };
    S.gallery = function (st) {
      var items = liveRows(get(st, "photos", [])).map(function (r, k) {
        return '<button type="button" class="gl-item" data-adh-b="photos.' + r.i + '">' + picOf(r.x, "Photograph " + (k + 1), "4/5") + (r.x.caption ? '<span class="gl-t">' + txt(r.x.caption) + '</span>' : "") + (r.x.sub ? '<span class="gl-d">' + txt(r.x.sub) + '</span>' : "") + '</button>';
      }).join("");
      return libSec("", headBlock(st) + '<div class="lgrid lgrid--' + per(st) + ' gl" data-gallery>' + items + '</div>');
    };
    S["logo-row"] = function (st) {
      var items = liveRows(get(st, "logos", [])).filter(function (r) { return r.x.image || r.x.alt; }).map(function (r) {
        var g = r.x, inner = g.image ? '<img src="' + esc(opts.imageSrc ? opts.imageSrc(g.image) : "@@assets/images/" + g.image) + '" alt="' + esc(g.alt || "") + '">' : '<span class="lg-name">' + txt(g.alt) + '</span>';
        return addrOk(g.href) ? '<a class="lg" href="' + esc(hrefOf(g.href)) + '" data-adh-b="logos.' + r.i + '">' + inner + '</a>' : '<span class="lg" data-adh-b="logos.' + r.i + '">' + inner + '</span>';
      }).join("");
      var e = get(st, "eyebrow", "");
      return libSec("", '<div class="lgrow' + (get(st, "colour", "one") === "own" ? " lgrow--own" : "") + '">' + (e ? '<p class="kicker">' + txt(e) + '</p>' : "") + '<div class="lgs">' + items + '</div></div>');
    };
    S.picture = function (st) {
      var cap = get(st, "caption", "");
      return libSec("", '<figure class="pic' + (get(st, "size", "") === "contained" ? " pic--narrow" : "") + '">' + picOf(st, "Photograph", "16/9") + (cap ? '<figcaption>' + txt(cap) + '</figcaption>' : "") + '</figure>');
    };
    S["text-picture"] = function (st) {
      var cap = get(st, "caption", "");
      return libSec("", '<div class="tp' + (get(st, "side", "right") === "left" ? " tp--flip" : "") + '"><div class="tp-words">' + headBlock(st) + '<div class="tp-body">' + paras(get(st, "body", "")) + '</div>' + link(get(st, "link", ""), get(st, "href", "")) + '</div>' +
        '<figure class="tp-pic">' + picOf(st, "Photograph", "4/5") + (cap ? '<figcaption>' + txt(cap) + '</figcaption>' : "") + '</figure></div>');
    };
    S.artworks = function (st) {
      var items = liveRows(get(st, "artworks", [])).map(function (r, k) {
        var w = r.x, tag = addrOk(w.href) ? "a" : "div", line = [w.year, w.medium].filter(Boolean).join(", ");
        return '<' + tag + ' class="aw"' + (tag === "a" ? ' href="' + esc(hrefOf(w.href)) + '"' : "") + ' data-adh-b="artworks.' + r.i + '">' + picOf(w, w.title || "Artwork " + (k + 1), "4/5") +
          '<h3>' + (w.title ? txt(w.title) : '<span class="tbc">' + W("missing.title", "Title to confirm") + '</span>') + '</h3>' + (line ? '<p class="aw-d">' + txt(line) + '</p>' : "") + (w.size ? '<p class="aw-d">' + txt(w.size) + '</p>' : "") + (w.note ? '<p class="aw-n">' + txt(w.note) + '</p>' : "") + '</' + tag + '>';
      }).join("");
      return libSec("", headBlock(st) + '<div class="lgrid lgrid--' + per(st) + '">' + items + '</div>');
    };
    S.exhibitions = function (st) {
      var cards = liveRows(get(st, "shows", [])).map(function (r) {
        var x = r.x;
        return '<li class="ecard" data-adh-b="shows.' + r.i + '">' + (x.place ? '<p class="kicker">' + txt(x.place) + '</p>' : "") + '<h3>' + rep(x) + txt(x.title || "") + '</h3><dl><div><dt>' + W("item.dates", "Dates:") + ' </dt><dd>' + (x.dates ? txt(x.dates) : W("missing.tbc", "To confirm")) + '</dd></div></dl>' +
          (x.kind ? '<span class="badge">' + txt(x.kind) + '</span>' : "") + (x.href && addrOk(x.href) ? ' <a class="tlink ecard-src" href="' + esc(hrefOf(x.href)) + '" rel="noopener">' + W("btn.source", "Source") + '</a>' : "") + '</li>';
      }).join("");
      return libSec("", headBlock(st) + '<ul class="egrid">' + cards + '</ul>');
    };
    S.career = function (st) {
      var rows = liveRows(get(st, "events", [])).map(function (r) {
        var x = r.x;
        return '<li class="car-row" data-adh-b="events.' + r.i + '"><span class="car-when">' + (x.when ? txt(x.when) : '<span class="tbc">' + W("missing.tbc", "To confirm") + '</span>') + '</span><span class="car-what">' + rep(x) + txt(x.what || "") +
          (x.href && addrOk(x.href) ? ' <a class="tlink" href="' + esc(hrefOf(x.href)) + '" rel="noopener">' + W("btn.source", "Source") + '</a>' : "") + '</span></li>';
      }).join("");
      return libSec("", headBlock(st) + '<ol class="car">' + rows + '</ol>');
    };
    S.press = function (st) {
      var items = liveRows(get(st, "quotes", [])).filter(function (r) { return r.x.quote; }).map(function (r) {
        var x = r.x, by = [x.who, x.publication, x.date].filter(Boolean).map(txt).join(", ");
        return '<figure class="lcard pq" data-adh-b="quotes.' + r.i + '"><blockquote>“' + txt(String(x.quote).trim()) + '”</blockquote>' + (by ? '<figcaption>' + by + '</figcaption>' : "") + (x.href && addrOk(x.href) ? '<a class="tlink" href="' + esc(hrefOf(x.href)) + '" rel="noopener">' + W("btn.read-source", "Read it at the source") + '</a>' : "") + '</figure>';
      }).join("");
      return libSec("", headBlock(st) + '<div class="lgrid lgrid--2">' + items + '</div>');
    };
    S.visit = function (st) {
      var mw = get(st, "map_words", ""), m = String(get(st, "map", "") || ""), map = mw && /^https:\/\//i.test(m) ? '<a class="tlink" href="' + esc(m) + '" target="_blank" rel="noopener">' + txt(mw) + '</a>' : "";
      var cards = liveRows(get(st, "details", [])).map(function (r, k) {
        return '<div class="lcard vis" data-adh-b="details.' + r.i + '"><p class="kicker">' + txt(r.x.title || "") + '</p><p class="vis-words">' + (r.x.text ? txt(String(r.x.text).trim()).replace(/\n/g, "<br>") : '<span class="tbc">' + W("missing.to-add", "To add") + '</span>') + '</p>' + (k === 0 ? map : "") + '</div>';
      }).join("");
      return libSec("", headBlock(st) + '<div class="lgrid lgrid--3">' + cards + '</div>' + (cards ? "" : map));
    };
    S["contact-form"] = function (st) {
      var topics = arr(st, "topics").map(function (t, i) { return { t: t, i: i }; }).filter(function (x) { return typeof x.t === "string" && x.t.trim(); });
      var t = get(st, "text", "");
      return libSec("", '<div class="mform"><div>' + headBlock(st) + (t ? '<p class="dek">' + txt(String(t).trim()) + '</p>' : "") + '</div>' +
        '<form class="mf" data-mailform="contact" data-email="' + esc(mailTo()) + '" novalidate><div class="mf-row"><div class="field"><label>' + W("form.name", "Your name") + '<input name="name" type="text" autocomplete="name"></label></div><div class="field"><label>' + W("form.your-email", "Your email address") + '<input name="email" type="email" autocomplete="email" required></label></div></div>' +
        (topics.length ? '<div class="field"><label>' + W("form.topic", "What it is about") + '<select name="topic">' + topics.map(function (x) { return '<option data-adh-b="topics.' + x.i + '">' + txt(x.t.trim()) + '</option>'; }).join("") + '</select></label></div>' : "") +
        '<div class="field"><label>' + W("form.message", "Your message") + '<textarea name="message" rows="5" required></textarea></label></div>' +
        '<div><button class="btn" type="submit">' + (get(st, "button", "") ? txt(get(st, "button", "")) : W("btn.write", "Write the email")) + '</button><p class="mf-note" role="status">' + W("form.note-contact", "This opens your own email app with your message ready to send to {email}.", { email: esc(mailTo()) }) + '</p></div></form></div>');
    };

    // In the editor each section is marked, so a click on the page can find it.
    var SEC_CSS;
    // A section's own CSS (set in the editor), kept inside that section: every rule is limited to it.
    function scopeCss(css, scope) {
      var s = String(css || "").replace(/[<>\\]/g, "").replace(/url\s*\(/gi, "none("), out = "", i = 0;
      while (i < s.length) {
        var open = s.indexOf("{", i); if (open < 0) break;
        var sel = s.slice(i, open).replace(/[;}]/g, " ").trim(), depth = 1, j = open + 1;
        while (j < s.length && depth) { if (s[j] === "{") depth++; else if (s[j] === "}") depth--; j++; }
        var body = s.slice(open + 1, depth ? j : j - 1);
        if (/^@(media|supports|container)\b/i.test(sel)) out += sel + "{" + scopeCss(body, scope) + "}\n";
        else if (/^@(-webkit-)?keyframes\b/i.test(sel)) out += sel + "{" + body + "}\n";
        else if (sel && sel.charAt(0) !== "@") out += sel.split(",").map(function (x) { x = x.trim(); return /^:scope\b/.test(x) ? scope + x.slice(6) : /^&/.test(x) ? scope + x.slice(1) : scope + " " + x; }).join(", ") + " {" + body + "}\n";
        i = j;
      }
      return out;
    }
    function cssMark(html, sec) {
      if (!sec || !sec.css || !String(sec.css).trim()) return html;
      (SEC_CSS = SEC_CSS || []).push(scopeCss(sec.css, '[data-css="' + sec.id + '"]'));
      return html.replace(/^(\s*<[a-z]+)/, '$1 data-css="' + sec.id + '"');
    }
    function secCssTag() { var t = SEC_CSS && SEC_CSS.length ? '<style data-sec-css>\n' + SEC_CSS.join("") + '</style>\n' : ""; SEC_CSS = []; return t; }
    function mark(html, id) { return opts.mark ? html.replace(/^(\s*<[a-z]+)/, '$1 data-adh="' + id + '"') : html; }
    // A second copy of a section gets its own names for anything already used
    // higher up the page, so its filters, form and links work on their own.
    function own(html, sid, seen) {
      var clash = {};
      html.replace(/ id="([^"]+)"/g, function (m, x) { if (seen[x]) clash[x] = 1; return m; });
      var names = Object.keys(clash);
      if (names.length) {
        var pre = String(sid).replace(/[^a-z0-9-]/gi, "-") + "--";
        html = html.replace(/ (id|for|aria-labelledby|aria-describedby|aria-controls)="([^"]+)"/g, function (m, a, x) { return clash[x] ? " " + a + '="' + pre + x + '"' : m; })
          .replace(/ href="#([^"]+)"/g, function (m, x) { return clash[x] ? ' href="#' + pre + x + '"' : m; });
      }
      html.replace(/ id="([^"]+)"/g, function (m, x) { seen[x] = 1; return m; });
      return html;
    }
    function sectionsPage(key) {
      var pg = PAGES.pages[key], parts = [], top = [], lead = true, seen = {};
      (pg.sections || []).forEach(function (sec) {
        if (!sec || sec.visible === false || !S[sec.type]) return;
        var html = mark(cssMark(own(S[sec.type](sec.settings || {}, { id: sec.id, page: key }), sec.id, seen), sec), sec.id);
        if (lead && sec.type === "announcement") top.push(html); else { lead = false; parts.push(html); }
      });
      if (!parts.length && opts.mark) parts.push('<section class="sec sec--lib sec--empty"><div class="wrap"><p class="dek">This page has no sections yet. Add one from the list on the left.</p></div></section>');
      return page(pg.path, (pg.title || NAME()), pg.description || "", (pg.own ? top.concat(parts) : parts).join("\n  "), { top: pg.own ? "" : top.join("\n"), own: !!pg.own });
    }
    // ----- an article, an artist, and the two list pages -----
    function M(h, id) { return opts.mark ? h.replace(/^(\s*<[a-z]+)/, '$1 data-adh="' + id + '"') : h; }
    function tplOf(kind, slug) {
      var all = ((PAGES.templates || {})[kind]) || {}, o = opts.tpl;
      var id = o && o.kind === kind && all[o.id] ? o.id : ((((PAGES.assign || {})[kind]) || {})[slug] || "default");
      return all[id] || all["default"] || null;
    }
    // A setting in a template can take its value from the page it is drawn on ("connect stored data").
    function pageFill(v, kind, it) {
      if (!it) return v;
      if (Array.isArray(v)) return v.map(function (x) { return pageFill(x, kind, it); });
      if (v && typeof v === "object") { var o = {}; Object.keys(v).forEach(function (k) { o[k] = pageFill(v[k], kind, it); }); return o; }
      if (typeof v !== "string" || v.indexOf("{page.") < 0) return v;
      if (v === "{page.artist}") return kind === "artist" ? it.slug : (it.artist || "");
      if (v === "{page.article}") return kind === "article" ? it.slug : "";
      var plain = function (x) { return String(x == null ? "" : x).replace(/<[^>]*>/g, "").replace(/[<>]/g, ""); };
      return v.split("{page.title}").join(plain(kind === "artist" ? it.name : it.title)).split("{page.summary}").join(plain(kind === "artist" ? it.line : it.summary));
    }
    function tplWrap(kind, slug, inner) {
      var t = tplOf(kind, slug); if (!t || !Array.isArray(t.sections)) return inner;
      var item = kind === "article" ? articleOf(slug) : artistOf(slug), placed = false, seen = {};
      inner.replace(/ id="([^"]+)"/g, function (m, x) { seen[x] = 1; return m; });
      var out = t.sections.map(function (sec) {
        if (sec && sec.type === "main") { placed = true; return inner; }
        if (!sec || sec.visible === false || !S[sec.type]) return "";
        return mark(cssMark(own(S[sec.type](pageFill(sec.settings || {}, kind, item), { id: sec.id, page: "tpl" }), sec.id, seen), sec), sec.id);
      });
      if (!placed) out.unshift(inner);
      return out.filter(Boolean).join("\n");
    }
    function or(v, words) { v = String(v == null ? "" : v).trim(); return v || words; }
    function sourceList(list) {
      var rows = (list || []).filter(function (x) { return x && String(x.title || "").trim(); });
      if (!rows.length) return opts.mark ? '\n<div class="feature-sources">\n<h2>' + W("item.sources", "Sources") + '</h2>\n<p class="muted">[Add the sources this feature rests on]</p>\n</div>' : "";
      return '\n<div class="feature-sources">\n<h2 id="sources">' + W("item.sources", "Sources") + '</h2>\n<ul class="sources">\n' + rows.map(function (x, i) {
        var rest = [x.publisher, x.date].filter(function (y) { return String(y || "").trim(); }).map(function (y) { return ", " + txt(y); }).join("");
        return '<li data-adh-b="sources.' + i + '">' + (/^https?:\/\//i.test(String(x.href || "")) ? '<a href="' + esc(x.href) + '">' + txt(x.title) + '</a>' : txt(x.title)) + rest + '</li>';
      }).join("\n") + '\n</ul>\n</div>';
    }
    // The research areas a feature is filed under, in the order chosen.
    function subjectsOf(a) {
      var list = Array.isArray(a.subjects) ? a.subjects : a.artist ? [a.artist] : [];
      return list.map(function (x) { return artistOf(String(x)); }).filter(function (x, i, all) { return x && (opts.mark || x.hidden !== true) && all.indexOf(x) === i; });
    }
    // The page of the console that lists one section's features, so a feature's section leads there.
    function sectionHref(kick) {
      var k = String(kick || "").trim().toLowerCase(), hit = "";
      if (k) Object.keys(PAGES.pages || {}).forEach(function (key) {
        var pg = PAGES.pages[key];
        if (!hit && (pg.sections || []).some(function (x) { var o = sectionNames((x.settings || {}).only); return x && x.visible !== false && x.type === "awr-features" && o.length === 1 && o[0] === k; })) hit = "@@" + String(pg.path || "").replace(/index\.html$/, "");
      });
      return hit || (k ? "@@" + P.articles + "/" : "");
    }
    function bandLinks(eyebrow, rows, mk) {
      return rows.length ? '\n<section class="band band-grey">\n  <div class="wrap">\n    <p class="eyebrow" data-r="fade">' + eyebrow + '</p>\n    ' + linkList(rows) + '\n  </div>\n</section>' : (opts.mark ? mk : "");
    }
    // Headings in a feature's words get an anchor of their own when they have none, so the contents list can lead to them.
    function anchored(body) {
      var used = {};
      return String(body).replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g, function (all, attrs, inner) {
        var m = /\sid="([^"]+)"/.exec(attrs || "");
        if (m) { used[m[1]] = 1; return all; }
        var id = slug(inner.replace(/<[^>]*>/g, "")) || "part", k = id, n = 2; while (used[k]) k = id + "-" + n++; used[k] = 1;
        return '<h2' + (attrs || "") + ' id="' + k + '">' + inner + '</h2>';
      });
    }
    function contents(body, sources) {
      var rows = []; String(body).replace(/<h2[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g, function (all, id, inner) { rows.push([id, inner.replace(/<[^>]*>/g, "").trim()]); return ""; });
      if (sources) rows.push(["sources", Wt("item.sources", "Sources")]);
      return rows.length ? '    <nav class="toc" aria-label="' + W("item.toc", "In this article") + '">\n      <p class="eyebrow">' + W("item.toc", "In this article") + '</p>\n      <ul>\n' +
        rows.map(function (x) { return '        <li><a href="#' + esc(x[0]) + '">' + txt(x[1]) + '</a></li>'; }).join("\n") + '\n      </ul>\n    </nav>\n' : "";
    }
    // More reading at the side: the three chosen for this feature, or the next ones in the list.
    function moreOf(a) {
      var picked = [a.more1, a.more2, a.more3].map(function (x) { return x && articleOf(String(x)); }).filter(function (x, i, all) { return x && x !== a && x.hidden !== true && all.indexOf(x) === i; });
      if (!picked.length) picked = ARTICLES.filter(function (x) { return x !== a; }).slice(0, 3);
      return picked.length ? '    <aside class="more">\n      <p class="eyebrow">' + (folderOf(a) === P.articles ? W("item.more", "More features") : W("item.more-other", "More reading")) + '</p>\n      <ul>\n' + picked.map(function (x) {
        var k = String(x.kicker || "").trim();
        return '        <li><a href="@@' + folderOf(x) + '/' + esc(x.slug) + '/">' + (k ? '<span class="sec">' + txt(k) + '</span>' : "") + txt(or(x.title, "[Feature title]")) + '</a></li>';
      }).join("\n") + '\n      </ul>\n    </aside>\n' : "";
    }
    function articlePage(a) {
      var subs = subjectsOf(a), kick = String(a.kicker || "").trim(), date = String(a.date || "").trim();
      var label = kick ? '<a href="' + sectionHref(kick) + '">' + txt(kick) + '</a>' : "";
      var body = anchored(String(a.body || "").replace(/<[^>]*>/g, "").trim() ? a.body : "<p>[Write the feature here]</p>"), srcs = sourceList(a.sources);
      var main = '<article>\n' + M('<section class="page-head page-head-article">\n  <div class="wrap">\n' + (label ? '    <p class="eyebrow" data-r="fade">' + label + '</p>\n' : "") +
        '    <h1 class="h-article" data-lines>' + txt(or(a.title, "[Feature title]")) + '</h1>\n' +
        '    <p class="byline" data-r style="--d:400ms">' + (date ? W("item.byline-date", "{site} · {date}", { site: txt(NAME()), date: txt(date) }) : W("item.byline", "{site}", { site: txt(NAME()) })) + '</p>\n  </div>\n</section>', "words") + '\n' +
        M('<section class="article-body">\n  <div class="wrap">\n    <div class="article-grid">\n' + contents(body, /<ul class="sources">/.test(srcs)) +
          '    <div class="prose">\n<p class="standfirst">' + txt(or(a.summary, "[One or two sentences that open the feature]")) + '</p>\n\n' + body + M(srcs, "sources") + '\n    </div>\n' + moreOf(a) + '    </div>\n  </div>\n</section>', "body") + '\n</article>' +
        bandLinks(W("item.related-areas", "Related research areas"), subs.map(function (x) { return { label: or(x.name, "[Research area]"), href: "@@" + P.artists + "/" + x.slug + "/" }; }),
          '\n<section class="band band-grey"><div class="wrap"><p class="eyebrow">' + W("item.related-areas", "Related research areas") + '</p><p class="muted empty">[Choose the research areas this feature is filed under]</p></div></section>');
      main = tplWrap("article", a.slug, main); AO_KIND = "article";
      return page(folderOf(a) + "/" + a.slug + "/index.html", or(a.title, "[Feature title]") + " | " + NAME(), String(a.description || "").trim() || String(a.summary || ""), main);
    }
    // A research area: its name and topics, every feature filed under it, then the sections it relates to.
    function artistPage(x) {
      var about = ARTICLES.filter(function (a) { return subjectsOf(a).indexOf(x) >= 0; });
      var topics = (Array.isArray(x.topics) ? x.topics : []).filter(function (t) { return typeof t === "string" && t.trim(); });
      var rel = (Array.isArray(x.related) ? x.related : []).filter(function (r) { return r && r.label && addrOk(r.href); });
      var main = M('<section class="page-head">\n  <div class="wrap">\n    <p class="eyebrow" data-r="fade">' + W("item.subject", "Research area") + '</p>\n    <h1 data-lines style="--s:140ms">' + txt(or(x.name, "[Research area]")) + '</h1>\n' +
        (topics.length ? '    <ul class="topics" data-r style="--d:400ms">\n' + topics.map(function (t) { return '      <li>' + txt(t.trim()) + '</li>'; }).join("\n") + '\n    </ul>\n' : (opts.mark ? '    <ul class="topics"><li>[A topic]</li><li>[Another topic]</li></ul>\n' : "")) + '  </div>\n</section>', "words") + '\n' +
        '<section class="band band-top0">\n  <div class="wrap">\n    <p class="eyebrow" data-r="fade">' + W("item.stories-about", "Features on this subject") + '</p>\n' +
        (about.length ? '      ' + cardGrid(about) + '\n' : '    <p class="muted empty" data-r>' + W("item.none-yet", "Nothing has been published on this subject yet.") + '</p>\n') + '  </div>\n</section>' +
        M(bandLinks(W("item.related", "Related sections"), rel.map(function (r) { return { label: r.label, href: hrefOf(r.href) }; }),
          '\n<section class="band band-grey"><div class="wrap"><p class="eyebrow">' + W("item.related", "Related sections") + '</p><p class="muted empty">[Add links to the sections this area relates to]</p></div></section>'), "related");
      main = tplWrap("artist", x.slug, main); AO_KIND = "artist";
      return page(P.artists + "/" + x.slug + "/index.html", or(x.name, "[Research area]") + " | " + NAME(), String(x.description || "").trim() || String(x.line || ""), main);
    }
    // Every feature as cards, or every research area.
    function listPage(k) {
      var w = listWords(k), items = k === "articles" ? ARTICLES : ARTISTS;
      var head = M('<section class="page-head">\n  <div class="wrap">\n' + (String(w.eyebrow || "").trim() ? '    <p class="eyebrow" data-r="fade">' + txt(w.eyebrow) + '</p>\n' : "") + '    <h1 data-lines style="--s:140ms">' + w.heading.map(ital).join("<br>") + '</h1>\n' +
        (String(w.intro || "").trim() ? '    <p class="lead muted" data-words style="--d:400ms">' + txt(w.intro) + '</p>\n' : "") + '  </div>\n</section>', "listhead");
      var grid = !items.length ? '<p class="muted empty">' + (k === "articles" ? "[No features yet]" : "[No research areas yet]") + '</p>'
        : k === "articles" ? cardGrid(items)
        : '<div class="grid-3">\n' + items.map(function (x, n) { return '      <article class="card card-plain" data-r' + delay(n, 90, 3) + '><h3><a href="@@' + P.artists + '/' + esc(x.slug) + '/">' + txt(or(x.name, "[Research area]")) + '</a></h3>' + (String(x.line || "").trim() ? '<p class="muted">' + txt(x.line) + '</p>' : "") + '</article>'; }).join("\n") + '\n    </div>';
      return page(P[k] + "/index.html", w.name + " | " + NAME(), String(w.intro || ""), head + '\n<section class="band band-top0">\n  <div class="wrap">\n    ' + grid + '\n  </div>\n</section>');
    }
    function notFound() {
      var base = SITE_URL.replace(/^https:\/\/[^\/]+/, "") || "/";
      var head = "<script>document.write('<base href=\"'+(location.hostname.slice(-9)==='github.io'?'" + esc(base) + "':'/')+'\">')</script>\n";
      var main = '<section class="page-head page-tall">\n  <div class="wrap">\n    <p class="eyebrow">' + W("nf.eyebrow", "Page not found") + '</p>\n    <h1>' + W("nf.title", "This page does not exist.") + '</h1>\n    <p class="nf-back"><a class="btn" href="./">' + W("nf.home", "Back to the homepage") + '</a></p>\n  </div>\n</section>';
      return page("", W("nf.eyebrow", "Page not found") + " | " + NAME(), "This page could not be found.", main, { file: "404.html", head: head });
    }
    // A list page is published once the menu bar or the footer leads to it.
    function linked(k) {
      var want = P[k] + "/", f = shared("footer")[0];
      var all = pairs(get(hd(), "links", [])).concat(pairs(get(hd(), "menu", [])));
      arr(f, "columns").forEach(function (c) { if (c) all = all.concat(pairs(c.links)); });
      return all.some(function (x) { return String(x.l[1] || "").replace(/^\.?\//, "") === want; });
    }
    // Every published page: the pages from the page list, then the page for a wrong address.
    function all() {
      var out = [], done = {};
      function p(k) { if (PAGES.pages[k] && !done[k]) { done[k] = 1; out.push(sectionsPage(k)); } }
      p("home"); Object.keys(PAGES.pages || {}).forEach(p);
      ["articles", "artists"].forEach(function (k) { if (listOn(k) && linked(k)) out.push(listPage(k)); });
      ARTICLES.forEach(function (a) { out.push(articlePage(a)); });
      ARTISTS.forEach(function (x) { out.push(artistPage(x)); });
      out.push(notFound());
      return out;
    }
    return {
      all: all, forwards: function () { return []; }, sectionsPage: sectionsPage, notFound: notFound, address: SITE_URL, paths: P,
      // in the editor a hidden feature or research area can still be opened; on the site it has no page
      articlePage: function (s) { var a = articleOf(s); return a && (opts.mark || a.hidden !== true) ? articlePage(a) : null; },
      featurePage: function (s) { var a = articleOf(s); return a && (opts.mark || a.hidden !== true) ? articlePage(a) : null; },
      artistPage: function (s) { var x = artistOf(s); return x && (opts.mark || x.hidden !== true) ? artistPage(x) : null; },
      listPage: function (k) { return (k === "articles" || k === "artists") && listOn(k) ? listPage(k) : null; },
      // Which page a web address inside the site leads to.
      which: function (path) {
        path = String(path || "").replace(/^\/+/, "").replace(/index\.html$/, "").split("#")[0].split("?")[0];
        var k = Object.keys(PAGES.pages || {}).find(function (x) { return PAGES.pages[x].path === path + (path && !/\/$/.test(path) ? "/" : "") + "index.html"; });
        if (k) return { kind: "page", key: k };
        var m = /^(features|research)\/?$/.exec(path), lk = m && (m[1] === P.articles ? "articles" : "artists"); if (m && listOn(lk)) return { kind: "list", key: lk };
        if ((m = /^([a-z0-9-]+)\/([a-z0-9-]+)\/?$/.exec(path)) && articleOf(m[2]) && folderOf(articleOf(m[2])) === m[1]) return { kind: "article", key: m[2] };
        if ((m = /^research\/([a-z0-9-]+)\/?$/.exec(path)) && artistOf(m[1])) return { kind: "artist", key: m[1] };
        return null;
      },
    };
  }

  var TAWR = { fromFiles: fromFiles, Site: Site, slug: slug, addressOf: addressOf, plain: plainOf };
  if (typeof module !== "undefined" && module.exports) module.exports = TAWR; else root.TAWR = TAWR;
})(typeof window !== "undefined" ? window : this);
