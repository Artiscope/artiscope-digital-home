/* A site built with Artiscope Digital Home from the Editions template: prints and
   editions in their frames, on a bold page. Draws every page from the site's data.
   Used twice: by tools/build.mjs to write the published pages, and by the page
   editor in Artiscope Digital Home to redraw a page as it is edited.
   The site's details are in data/content.json, its pages and their sections in
   data/pages.json, and the colours and typefaces in data/theme.json. Besides the
   sections every site offers, this design has five of its own: Opening slides,
   Series banner, Works, Social tiles and Every series. Works and series are the
   site's articles and artists, at works/<name>/ and series/<name>/. */
(function (root) {
  "use strict";

  // ----- small helpers -----
  function esc(v) { return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;"); }
  // words typed in the console: shown as written, never as markup
  function txt(v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function get(o, k, d) { return o && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined && o[k] !== null ? o[k] : d; }
  // an address typed in the console: a page of this site, or a full address
  function addrOk(h) { return /^(\.\/$|#|\/|[a-z0-9-]+\/|https?:\/\/|mailto:)/i.test(String(h || "")); }
  function hrefOf(h) { h = String(h || ""); return /^(https?:|mailto:|\/)/i.test(h) ? h : "@@" + h; }
  // the site's own web address, always ending in a slash
  function addressOf(D) { var a = String(((D || {}).site || {}).address || ""); return /^https:\/\/[a-z0-9.-]+(\/[A-Za-z0-9._\/-]*)?$/.test(a) ? a.replace(/\/*$/, "/") : "https://example.org/"; }

  // The data file as one object, the same shape Artiscope Digital Home edits.
  // Where works and series live on the site: works/<name>/ and series/<name>/.
  var P = { articles: "works", artists: "series" };
  function fromFiles(content) {
    var c = JSON.parse(JSON.stringify(content || {})), s = c.site || {};
    return { site: { email: String(s.email || ""), address: String(s.address || ""), indexed: s.indexed === true, mark: String(s.mark || ""), icons: String(s.icons || ""), share: String(s.share || "") },
      articles: Array.isArray(c.articles) ? c.articles : [], artists: Array.isArray(c.artists) ? c.artists : [],
      forward: c.forward && typeof c.forward === "object" && !Array.isArray(c.forward) ? c.forward : {} };
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
    var SITE = D.site || {}, SITE_URL = addressOf(D), MAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(SITE.email || "") ? SITE.email : "info@grovegallery.com";
    // Social media addresses chosen in the theme; nothing is shown until one is filled in.
    function socialHtml() {
      var all = opts.social && typeof opts.social === "object" ? opts.social : {}, out = Object.keys(all).map(function (k) { return all[k]; }).filter(function (x) { return x && /^https:\/\/[^\s<>"']+$/.test(x.href || ""); });
      return out.length ? '<nav class="foot-social" aria-label="' + W("sr.social", "Social media") + '">' + out.map(function (x) { return '<a href="' + esc(x.href) + '" rel="noopener">' + esc(x.label) + '</a>'; }).join("") + '</nav>\n' : "";
    }
    function iconOk() { return typeof opts.favicon === "string" && /^assets\/images\/[A-Za-z0-9._-]{1,120}\.(png|jpe?g|svg|ico)$/.test(opts.favicon); }

    function shared(key) { var part = (PAGES.shared || {})[key] || {}; return [part.settings || {}, get(part, "visible", true) !== false]; }
    function hd() { return shared("header")[0]; }
    function NAME() { return get(hd(), "name", "") || "[Site name]"; }
    // The menu: the links chosen in the console, and nothing added by itself.
    function navLinks() {
      var out = (get(hd(), "links", []) || []).filter(function (l) { return Array.isArray(l) && l[0]; });
      var has = function (a) { return out.some(function (l) { return String(l[1] || "").replace(/^\.?\//, "").replace(/index\.html$/, "") === a; }); };
      return out;
    }
    // ----- articles and artists: the ones visitors can see, newest article first -----
    var stamp = function (a) { var t = Date.parse(String(a.date || "")); return isNaN(t) ? -Infinity : t; };
    var ARTICLES = (D.articles || []).filter(function (a) { return a && a.slug && a.hidden !== true; }).map(function (a, i) { return { a: a, i: i }; })
      .sort(function (x, y) { return stamp(y.a) - stamp(x.a) || x.i - y.i; }).map(function (x) { return x.a; });
    var ARTISTS = (D.artists || []).filter(function (x) { return x && x.slug && x.hidden !== true; });
    function articleOf(slug) { return (D.articles || []).find(function (a) { return a.slug === slug; }) || null; }
    function artistOf(slug) { return (D.artists || []).find(function (a) { return a.slug === slug; }) || null; }
    // A list page is drawn by the site unless a page of the console already uses its address.
    function listOn(k) { return !Object.keys(PAGES.pages || {}).some(function (x) { return PAGES.pages[x].path === P[k] + "/index.html"; }); }
    // where every story is listed: the site's own list, or a page of the console at the same address
    function storiesHref() { return "@@" + P.articles + "/"; }
    function listWords(k) {
      var l = ((PAGES.lists || {})[k]) || {}, h = Array.isArray(l.heading) ? l.heading.filter(Boolean) : l.heading ? [l.heading] : [];
      var name = k === "articles" ? Wt("menu.articles", "All works") : Wt("menu.artists", "Series");
      return { name: name, eyebrow: l.eyebrow == null ? name : l.eyebrow, heading: h.length ? h : [name], intro: l.intro == null ? (k === "articles" ? "[A line about the works]" : "[A line about the series]") : l.intro };
    }
    function photo(desc, ratio) {
      var st = ratio ? ' style="aspect-ratio:' + ratio + '"' : "";
      return '<div class="ph" role="img" aria-label="' + W("sr.photo", "Photograph to come: {what}", { what: esc(desc) }) + '"' + st + '><span class="ph-t">' + W("missing.photo", "Photograph to come.") + '</span> <span class="ph-d">' + esc(desc) + '</span></div>';
    }

    // logos added in the console: each on the left, in the centre or on the right of the menu bar
    function headLogos(st, r, where) {
      return (get(st, "logos", []) || []).map(function (g, k) { return { g: g, k: k }; }).filter(function (x) { return x.g && x.g.hidden !== true && (x.g.place || "L") === where; }).map(function (x) {
        var g = x.g, src = g.image ? (opts.imageSrc ? opts.imageSrc(g.image) : r + "assets/images/" + g.image) : "";
        var inner = src ? '<img src="' + esc(src) + '" alt="' + esc(g.alt || "") + '">' : (opts.mark ? '<span class="hlogo-empty">' + txt(g.alt || "Logo") + '</span>' : "");
        if (!inner) return "";
        var h = String(g.href || ""), cls = "hlogo hlogo--" + ({ S: "s", L: "l" }[g.size] || "m"), tag = opts.mark ? ' data-adh-b="logos.' + x.k + '"' : "";
        if (!addrOk(h)) h = ""; else h = hrefOf(h).split("@@").join(r);
        return h ? '<a class="' + cls + '" href="' + esc(h) + '"' + tag + '>' + inner + '</a>' : '<span class="' + cls + '"' + tag + '>' + inner + '</span>';
      }).join("");
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
      var ao = aoHtml(PAGES.addons, AO_KIND, SITE_URL + urlPath, String(title || "").split(" | ")[0], esc, function (x) { return /^(https?:|mailto:|#|\/)/.test(x) ? x : "@@" + x; }); AO_KIND = "page";
      // a page with its own layout has no menu bar, footer or shared sections; popups show on every page
      o.top = o.own ? "" : [groupHtml("top", true), o.top || ""].filter(Boolean).join("\n");
      main = (o.own ? [main, groupHtml("popups"), ao.fixed] : [groupHtml("top", false), main, ao.share, groupHtml("bottom"), groupHtml("popups"), ao.fixed]).filter(Boolean).join("\n  ");
      var depth = (urlPath.match(/\//g) || []).length, r = o.file ? "" : new Array(depth + 1).join("../");
      var name = txt(NAME()), st = hd(), hon = shared("header")[1];
      // the site's own mark beside its name, drawn from the outline kept in the site's details
      var markSvg = /^[MLHVCSQTAZmlhvcsqtaz0-9 .,-]{1,600}$/.test(SITE.mark || "") ? '<svg class="mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path fill-rule="evenodd" fill="currentColor" d="' + SITE.mark + '"></path></svg>' : "";
      var icons = /^assets\/[a-z0-9-]+\/$/.test(SITE.icons || "") && !iconOk() ? '<link rel="icon" href="' + r + SITE.icons + 'favicon.svg" type="image/svg+xml">\n<link rel="icon" href="' + r + SITE.icons + 'favicon.png" type="image/png" sizes="32x32">\n<link rel="apple-touch-icon" href="' + r + SITE.icons + 'apple-touch-icon.png">\n' : "";
      var share = /^assets\/[a-z0-9\/._-]+\.(png|jpe?g)$/.test(SITE.share || "") ? '<meta property="og:image" content="' + esc(SITE_URL + SITE.share) + '">\n<meta name="twitter:card" content="summary_large_image">\n' : "";
      main = String(main).split("@@").join(r);
      var links = navLinks().map(function (l) { return '<a href="' + esc(hrefOf(l[1]).split("@@").join(r)) + '"' + (l[1] && urlPath === String(l[1]).replace(/^\.?\/?/, "") ? ' aria-current="page"' : "") + '>' + txt(l[0]) + '</a>'; }).join("\n    ");
      var logosL = headLogos(st, r, "L"), logosR = headLogos(st, r, "C") + headLogos(st, r, "R");
      var nav = !hon || o.own ? "" : '<header class="site-header" id="nav">\n' +
        '  <a class="wordmark" href="' + (r || "./") + '">' + markSvg + '<span>' + name + '</span></a>\n' + (logosL ? '  <span class="hlogos">' + logosL + '</span>\n' : "") +
        (links ? '  <nav class="site-nav" aria-label="' + W("sr.nav", "Sections") + '">\n    ' + links + '\n  </nav>\n' : "") + (logosR ? '  <span class="hlogos">' + logosR + '</span>\n' : "") + '</header>';
      var ft = shared("footer"), f = ft[0];
      var flinks = (get(f, "links", []) || []).filter(function (l) { return Array.isArray(l) && l[0]; }).map(function (l) { return '<a href="' + esc(hrefOf(l[1]).split("@@").join(r)) + '">' + txt(l[0]) + '</a>'; }).join("\n      ");
      var fh = get(f, "links_heading", ""), legal = get(f, "legal", ""), social = socialHtml();
      var foot = !ft[1] || o.own ? "" : '<footer class="site-footer foot" id="foot">\n  <div class="footer-inner">\n' +
        '    <div class="footer-brand"><p class="wordmark">' + markSvg + '<span>' + name + '</span></p>' + (get(f, "tagline", "") ? '<p>' + txt(f.tagline) + '</p>' : "") + '</div>\n' +
        (flinks ? '    <nav class="footer-nav" aria-label="' + (fh ? esc(fh) : W("sr.links", "Links")) + '">' + (fh ? '<h2 class="label">' + txt(fh) + '</h2>' : "") + '\n      ' + flinks + '\n    </nav>\n' : "") +
        '  </div>\n' + (social || legal ? '  <div class="footer-foot">' + social + (legal ? '<p>' + txt(legal).split("{year}").join(String(new Date().getFullYear())) + '</p>' : "") + '</div>\n' : "") + '</footer>';
      var bl = navLinks().slice(0, 2), bar = !hon || o.own || get(st, "bar", true) === false ? "" : '<nav class="ed-bar" aria-label="' + W("sr.bar", "Quick links") + '">\n  <a href="' + (r || "./") + '">' + W("menu.home", "Home") + '</a>' +
        bl.map(function (l) { return '<a href="' + esc(hrefOf(l[1]).split("@@").join(r)) + '">' + txt(l[0]) + '</a>'; }).join("") + '\n</nav>';
      foot = foot + (bar ? "\n" + bar : "");
      var noindex = SITE.indexed !== true ? '<meta name="robots" content="noindex, nofollow">\n' : "";
      var html = '<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' + noindex +
        '<title>' + esc(title) + '</title>\n<meta name="description" content="' + esc(desc) + '">\n<link rel="canonical" href="' + esc(SITE_URL + urlPath) + '">\n' +
        '<meta property="og:type" content="website">\n<meta property="og:site_name" content="' + name + '">\n' +
        '<meta property="og:title" content="' + esc(title) + '">\n<meta property="og:description" content="' + esc(desc) + '">\n<meta property="og:url" content="' + esc(SITE_URL + urlPath) + '">\n' + share + icons +
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
        '<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">\n' +
        (o.head || "") + (iconOk() ? '<link rel="icon" href="' + r + opts.favicon + '">\n' : "") +
        '<link rel="stylesheet" href="' + r + 'assets/site.css">\n' + (THEME || "") + secCssTag() + wordsTag() +
        '</head>\n<body>\n<a class="skip" href="#main">' + W("menu.skip", "Skip to the works") + '</a>\n' + (o.top ? String(o.top).split("@@").join(r) + "\n" : "") + nav + '\n<main id="main">\n' + main + '\n</main>\n' + foot + '\n' +
        '<script src="' + r + 'assets/site.js" defer></script>\n</body>\n</html>\n';
      return { path: o.file || path, url: urlPath, html: html };
    }

    // ----- sections -----
    var S = {};
    S.signup = function (st, ctx) {
      var id = (ctx && ctx.id) || "signup";
      return '<section class="join" id="' + esc(id) + '" aria-labelledby="h-' + esc(id) + '">\n' +
        '    <h2 id="h-' + esc(id) + '">' + txt(get(st, "heading", "")) + '</h2>' + (get(st, "text", "") ? '<p class="join-note">' + txt(st.text) + '</p>' : "") + '\n' +
        '    <form class="nl signup" data-signup data-email="' + esc(MAIL) + '" novalidate><div class="field"><label for="' + esc(id) + '-e">' + W("form.email", "Your email address") + '</label><input id="' + esc(id) + '-e" name="email" type="email" required autocomplete="email"></div><button class="btn btn-solid" type="submit">' + (get(st, "button", "") ? txt(get(st, "button", "")) : W("btn.join", "Sign up")) + '</button></form>\n' +
        '    <p class="mf-note" role="status">' + W("form.note", "This opens your own email app with a message ready to send to {email}.", { email: esc(MAIL) }) + '</p>\n' +
        (get(st, "pitch", "") ? '    <p class="pitch">' + txt(st.pitch) + ' <a href="mailto:' + esc(MAIL) + '">' + esc(MAIL) + '</a></p>\n' : "") + '  </section>';
    };
    // A sign-up box that pops up once a visit; drawn hidden, and shown by the site's script.
    S["signup-popup"] = function (st, ctx) {
      var id = (ctx && ctx.id) || "popup", d = Math.max(3, Math.min(60, Number(get(st, "delay", 8)) || 8)), e = get(st, "eyebrow", ""), t = get(st, "text", "");
      return '<div class="supop" id="' + esc(id) + '" data-popup data-delay="' + d + '" role="dialog" aria-labelledby="' + esc(id) + '-h" hidden>\n  <button type="button" class="supop-x" data-pop-close>' + W("btn.close", "Close") + '</button>\n' +
        (e ? '  <p class="kicker">' + txt(e) + '</p>\n' : "") + '  <h2 id="' + esc(id) + '-h">' + txt(get(st, "heading", "")) + '</h2>\n' + (t ? '  <p class="dek">' + txt(String(t).trim()) + '</p>\n' : "") +
        '  <form class="nl" data-popform data-email="' + esc(MAIL) + '" novalidate><label class="sr" for="' + esc(id) + '-e">' + W("form.email", "Your email address") + '</label><input id="' + esc(id) + '-e" name="email" type="email" required placeholder="' + W("form.placeholder", "you@example.com") + '" autocomplete="email"><button class="btn" type="submit">' + (get(st, "button", "") ? txt(get(st, "button", "")) : W("btn.join", "Sign up")) + '</button></form>\n' +
        '  <p class="mf-note" role="status">' + W("form.note", "This opens your own email app with a message ready to send to {email}.", { email: esc(MAIL) }) + '</p>\n</div>';
    };

    // ----- the five sections of this design -----
    function textLink(words, h, cls) { return words && addrOk(h) ? '<a class="' + (cls || "btn") + '" href="' + esc(hrefOf(h)) + '"' + (/^https?:/i.test(String(h)) ? ' rel="noopener"' : "") + '>' + txt(words) + '</a>' : ""; }
    // A work in its frame: the photograph, never cropped, or a plain stand-in until one is chosen.
    var STAND = ["#B9A07E", "#7E9196", "#A65A3A", "#5F6B4E", "#C9C2B3", "#2F4858", "#D8A23A", "#8C6E8F"];
    function framed(x, desc, k, cls) {
      var img = x && x.image ? '<img src="' + esc(opts.imageSrc ? opts.imageSrc(x.image) : "@@assets/images/" + x.image) + '" alt="' + esc(x.alt || desc || "") + '" loading="lazy">'
        : '<div class="pic" role="img" aria-label="' + W("sr.photo", "Photograph to come: {what}", { what: esc(desc || "") }) + '" style="background:' + STAND[(k || 0) % STAND.length] + '"><span>' + W("missing.photo", "Photograph to come.") + '</span></div>';
      return '<div class="frame' + (cls ? " " + cls : "") + '"><div class="mount">' + img + '</div></div>';
    }
    function seriesOf(a) { return a && a.artist ? artistOf(String(a.artist)) : null; }
    function worksIn(x) { return ARTICLES.filter(function (a) { return x ? a.artist === x.slug : true; }); }
    function workCard(a, k) {
      var meta = String(a.edition || "").trim(), price = String(a.price || "").trim();
      return '<li class="card"><a href="@@' + P.articles + '/' + esc(a.slug) + '/"><div class="tile">' + framed(a, or(a.alt, or(a.title, "the work")), k) + '</div><h3>' + txt(or(a.title, "[Work title]")) + '</h3></a>' +
        (meta ? '<p class="meta soft">' + txt(meta) + '</p>' : "") + (price ? '<p class="meta">' + txt(price) + '</p>' : "") + '</li>';
    }
    function seriesCard(x) {
      var two = worksIn(x).slice(0, 2), k = ARTISTS.indexOf(x);
      var pics = [0, 1].map(function (i) { return framed(two[i] || null, two[i] ? or(two[i].alt, two[i].title) : "", k * 2 + i, "frame-sm"); }).join("");
      var n = worksIn(x).length;
      return '<li class="scard"><a href="@@' + P.artists + '/' + esc(x.slug) + '/"><div class="spics">' + pics + '</div><h3>' + txt(or(x.name, "[Series name]")) + '</h3></a>' +
        '<p class="meta soft">' + (n === 1 ? W("item.one-work", "1 work") : W("item.works", "{n} works", { n: String(n) })) + '</p></li>';
    }
    // Up to three large slides, each with words, a button and a work in its frame.
    S["ed-slides"] = function (st, ctx) {
      var id = esc((ctx && ctx.id) || "slides"), rows = liveRows(get(st, "slides", [])), n = rows.length;
      if (!n) return '<section class="slides-wrap"><p class="soft">[Add a slide]</p></section>';
      var slides = rows.map(function (r, k) {
        var x = r.x || {};
        return '<div class="slide" data-adh-b="slides.' + r.i + '"' + (k ? ' hidden' : "") + ' role="group" aria-roledescription="slide" aria-label="' + (k + 1) + ' / ' + n + '">' +
          '<div class="slide-words">' + (x.eyebrow ? '<p class="caps soft">' + txt(x.eyebrow) + '</p>' : "") + (x.heading ? (k ? '<h2 class="slide-h">' : '<h1 class="slide-h">') + txt(x.heading) + (k ? '</h2>' : '</h1>') : "") +
          (x.text ? '<p class="slide-text soft">' + txt(x.text) + '</p>' : "") + textLink(x.link, x.href, "btn btn-solid") + '</div>' +
          '<div class="slide-art">' + framed(x, x.alt || "", k) + '</div></div>';
      }).join("");
      var ctl = n > 1 ? '<div class="slide-ctl"><span class="slide-n">' + W("btn.count", "{n} of {total}", { n: "1", total: String(n) }) + '</span><button type="button" data-ed="-1">' + W("btn.previous", "Previous") + '</button><button type="button" data-ed="1">' + W("btn.next", "Next") + '</button></div>' : "";
      return '<section class="slides-wrap" id="' + id + '" aria-roledescription="carousel" aria-label="' + W("sr.slides", "Opening slides") + '" data-edslides><div class="slides">' + slides + '</div>' + ctl + '</section>';
    };
    // A banner for one series: a small line, a large heading, a few words, a button, and two of its works.
    S["ed-series"] = function (st) {
      var x = get(st, "series", "") ? artistOf(String(st.series)) : null, two = worksIn(x).slice(0, 2);
      var h = get(st, "heading", "") || (x ? x.name : ""), t = get(st, "text", "") || (x ? x.line : "");
      return '<section class="series-band"><div class="series-words">' + (get(st, "eyebrow", "") ? '<p class="caps soft">' + txt(st.eyebrow) + '</p>' : "") + (h ? '<h2>' + txt(h) + '</h2>' : "") +
        (t ? '<p class="soft">' + txt(t) + '</p>' : "") + textLink(get(st, "link", ""), get(st, "href", "") || (x ? P.artists + "/" + x.slug + "/" : "")) + '</div>' +
        '<div class="series-art">' + framed(two[0] || null, two[0] ? or(two[0].alt, two[0].title) : "", 1) + framed(two[1] || null, two[1] ? or(two[1].alt, two[1].title) : "", 2, "lift") + '</div></section>';
    };
    // A grid of works: every work, or one series; the newest first.
    S["ed-works"] = function (st, ctx) {
      var id = esc((ctx && ctx.id) || "works"), x = get(st, "series", "") ? artistOf(String(st.series)) : null;
      var list = worksIn(x), n = Math.max(1, Math.min(48, Number(get(st, "count", 8)) || 8)), shown = get(st, "every", false) === true ? list : list.slice(0, n);
      var h = get(st, "heading", "") || (x ? x.name : ""), m = get(st, "more", ""), cols = String(get(st, "per_row", "4")) === "3" ? 3 : 4;
      var more = m && list.length ? '<a class="caps" href="@@' + (x ? P.artists + '/' + esc(x.slug) : P.articles) + '/">' + txt(m).split("{n}").join(String(list.length)) + '</a>' : "";
      return '<section class="works" aria-labelledby="h-' + id + '">' + (h || more ? '<div class="row-head">' + (h ? '<h2 id="h-' + id + '">' + txt(h) + '</h2>' : "") + more + '</div>' : "") +
        (shown.length ? '<ul class="grid grid-' + cols + '">' + shown.map(workCard).join("") + '</ul>' : '<p class="soft">[Works appear here once you add them]</p>') + '</section>';
    };
    // The site's own photographs, each a link to its Instagram or TikTok. No outside feed.
    S["ed-social"] = function (st, ctx) {
      var id = esc((ctx && ctx.id) || "social"), h = get(st, "heading", "");
      var tiles = liveRows(get(st, "tiles", [])).map(function (r, k) {
        var x = r.x || {}, inner = x.image ? '<img src="' + esc(opts.imageSrc ? opts.imageSrc(x.image) : "@@assets/images/" + x.image) + '" alt="' + esc(x.alt || "") + '" loading="lazy">' : '<span>' + W("missing.photo", "Photograph to come.") + '</span>';
        return addrOk(x.href) ? '<a class="sq" href="' + esc(hrefOf(x.href)) + '" rel="noopener" data-adh-b="tiles.' + r.i + '">' + inner + '</a>' : '<div class="sq" data-adh-b="tiles.' + r.i + '">' + inner + '</div>';
      }).join("");
      return '<section class="social" aria-labelledby="h-' + id + '"><div class="row-head">' + (h ? '<h2 id="h-' + id + '">' + txt(h) + '</h2>' : "") + textLink(get(st, "link", ""), get(st, "href", ""), "btn") + '</div>' +
        (tiles ? '<div class="tiles">' + tiles + '</div>' : '<p class="soft">[Add your photographs]</p>') + '</section>';
    };
    // Every series as a card with two of its works.
    S["ed-series-list"] = function (st, ctx) {
      var id = esc((ctx && ctx.id) || "series-list"), h = get(st, "heading", ""), skip = String(get(st, "skip", "") || "");
      var list = ARTISTS.filter(function (x) { return x.slug !== skip; });
      return '<section class="works" aria-labelledby="h-' + id + '">' + (h ? '<div class="row-head"><h2 id="h-' + id + '">' + txt(h) + '</h2></div>' : "") +
        (list.length ? '<ul class="grid grid-3">' + list.map(seriesCard).join("") + '</ul>' : '<p class="soft">[Series appear here once you add them]</p>') + '</section>';
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
      var topics = (Array.isArray(get(st, "topics", [])) ? st.topics : []).map(function (t, i) { return { t: t, i: i }; }).filter(function (x) { return typeof x.t === "string" && x.t.trim(); });
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
    function detailList(rows, open) {
      rows = (rows || []).filter(function (d) { return Array.isArray(d) && String(d[0] || "").trim(); });
      if (!rows.length) return opts.mark ? '<dl class="spec"><dt>[Detail, such as Size]</dt><dd>[What it is]</dd></dl>' : "";
      return '<dl class="spec">' + rows.map(function (d, i) { return '<div data-adh-b="details.' + i + '"><dt>' + txt(d[0]) + '</dt><dd>' + txt(d[1] || "") + '</dd></div>'; }).join("") + '</dl>';
    }
    function sourceList(list) {
      var rows = (list || []).filter(function (x) { return x && String(x.title || "").trim(); });
      if (!rows.length) return "";
      return '<p class="caps soft">' + W("item.sources", "Sources") + '</p><ul class="sources">' + rows.map(function (x, i) {
        var t = txt(x.title) + [x.publisher, x.date].filter(function (y) { return String(y || "").trim(); }).map(function (y) { return ", " + txt(y); }).join("");
        return '<li data-adh-b="sources.' + i + '">' + (/^https?:\/\//i.test(String(x.href || "")) ? '<a href="' + esc(x.href) + '" rel="noopener">' + t + '</a>' : t) + '</li>';
      }).join("") + '</ul>';
    }
    // A work's page: the framed work, then its title, price, details and words, and a way to ask about it.
    function articlePage(a) {
      var x = seriesOf(a), k = ARTICLES.indexOf(a), price = String(a.price || "").trim();
      var crumbs = '<p class="crumbs soft">' + (x ? '<a href="@@' + P.artists + '/' + esc(x.slug) + '/">' + txt(or(x.name, "[Series name]")) + '</a> / ' : "") + txt(or(a.title, "[Work title]")) + '</p>';
      var subject = (SITE.email ? W("form.about-work", "About {work}", { work: txt(or(a.title, "a work")) }) : "");
      var ask = MAIL ? '<a class="btn btn-solid" href="mailto:' + esc(MAIL) + '?subject=' + encodeURIComponent(String(subject).replace(/&amp;/g, "&")) + '">' + W("btn.ask", "Ask about this work") + '</a><p class="mf-note">' + W("form.note-work", "This opens your own email app with a message about this work, ready to send to {email}.", { email: esc(MAIL) }) + '</p>' : "";
      var more = x ? worksIn(x).filter(function (w) { return w !== a; }).slice(0, 4) : [];
      var main = crumbs + '\n  <article class="work">\n    ' + M('<div class="work-art">' + framed(a, or(a.alt, "[What the work shows]"), k, "frame-lg") + (String(a.credit || "").trim() ? '<p class="credit soft">' + txt(a.credit) + '</p>' : (opts.mark ? '<p class="credit soft">[Credit]</p>' : "")) + '</div>', "picture") +
        '\n    <div class="work-words">' + M('<div>' + (x ? '<p class="caps soft">' + txt(or(x.name, "")) + '</p>' : (String(a.kicker || "").trim() ? '<p class="caps soft">' + txt(a.kicker) + '</p>' : "")) + '<h1>' + txt(or(a.title, "[Work title]")) + '</h1>' + (price ? '<p class="price">' + txt(price) + '</p>' : (opts.mark ? '<p class="price">[Price, such as From £250]</p>' : "")) + '</div>', "words") +
        M('<div>' + detailList(a.details) + '</div>', "details") + M('<div class="work-text">' + (String(a.body || "").replace(/<[^>]*>/g, "").trim() ? a.body : (opts.mark ? "<p>[A few lines about this work]</p>" : "")) + '</div>', "body") + ask +
        M('<div>' + sourceList(a.sources) + '</div>', "sources") + '</div>\n  </article>' +
        (more.length ? '\n  <section class="works" aria-labelledby="more-h"><div class="row-head"><h2 id="more-h">' + W("item.more-from", "More from {series}", { series: txt(or(x.name, "the series")) }) + '</h2><a class="caps" href="@@' + P.artists + '/' + esc(x.slug) + '/">' + W("btn.see-series", "See the series") + '</a></div><ul class="grid grid-4">' + more.map(workCard).join("") + '</ul></section>' : "");
      main = tplWrap("article", a.slug, main); AO_KIND = "article";
      return page(P.articles + "/" + a.slug + "/index.html", or(a.title, "[Work title]") + " | " + NAME(), String(a.description || "").trim() || String(a.summary || "").trim() || or(a.title, ""), main);
    }
    // A series page: its name, its facts and words, then every work in it.
    function artistPage(x) {
      var works = worksIn(x), aboutText = String(x.about || "").replace(/<[^>]*>/g, "").trim() ? x.about : (opts.mark ? "<p>[A paragraph on the series: where the idea came from, how the works are made, printed and framed.]</p>" : "");
      var main = '<article class="series-page">\n    ' + M('<section class="phead"><div><p class="caps soft">' + W("item.series", "Series") + '</p><h1>' + txt(or(x.name, "[Series name]")) + '</h1>' + (String(x.line || "").trim() ? '<p class="soft">' + txt(x.line) + '</p>' : "") + '</div>' +
        '<div class="phead-side">' + aboutText + '</div></section>', "words") + '\n    ' + M('<div class="phead-facts">' + detailList(x.details) + '</div>', "details") +
        '\n    <section class="works" aria-label="' + W("item.works-in", "Works in {series}", { series: esc(or(x.name, "the series")) }) + '">' + (works.length ? '<ul class="grid grid-4">' + works.map(workCard).join("") + '</ul>' : '<p class="soft">[Works in this series appear here]</p>') + '</section>' +
        (String(x.image || "").trim() || opts.mark ? '\n    ' + M('<figure class="series-pic">' + framed(x, or(x.alt, "Picture for " + or(x.name, "the series")), 3) + '</figure>', "picture") : "") +
        (sourceList(x.sources) ? '\n    ' + M('<footer class="filed">' + sourceList(x.sources) + '</footer>', "sources") : "") + '\n  </article>';
      main = tplWrap("artist", x.slug, main); AO_KIND = "artist";
      return page(P.artists + "/" + x.slug + "/index.html", or(x.name, "[Series name]") + " | " + NAME(), String(x.line || ""), main);
    }
    // Every work, or every series, as the site's own list pages.
    function listPage(k) {
      var w = listWords(k), items = k === "articles" ? ARTICLES : ARTISTS;
      var head = M('<section class="phead phead-list"><div>' + (String(w.eyebrow || "").trim() ? '<p class="caps soft">' + txt(w.eyebrow) + '</p>' : "") + '<h1>' + w.heading.map(txt).join("<br>") + '</h1></div>' + (String(w.intro || "").trim() ? '<p class="soft phead-side">' + txt(w.intro) + '</p>' : "") + '</section>', "listhead");
      var grid = !items.length ? '<p class="soft">' + (k === "articles" ? "[No works yet]" : "[No series yet]") + '</p>'
        : k === "articles" ? '<ul class="grid grid-4">' + items.map(workCard).join("") + '</ul>' : '<ul class="grid grid-3">' + items.map(seriesCard).join("") + '</ul>';
      return page(P[k] + "/index.html", w.name + " | " + NAME(), String(w.intro || ""), head + '\n  <section class="works">' + grid + '</section>');
    }
    function notFound() {
      var base = SITE_URL.replace(/^https:\/\/[^\/]+/, "") || "/";
      var head = "<script>document.write('<base href=\"'+(location.hostname.slice(-9)==='github.io'?'" + esc(base) + "':'/')+'\">')</script>\n";
      var main = '<section class="phead nf"><div><p class="caps soft">' + W("nf.eyebrow", "Page not found") + '</p><h1>' + W("nf.title", "Nothing hangs here.") + '</h1><p class="soft">' + W("nf.lede", "The address may have changed, or the work may not be shown yet.") + '</p><p><a class="btn" href="./">' + W("nf.home", "Back to the home page") + '</a></p></div></section>';
      return page("", "Page not found | " + NAME(), "This page could not be found.", main, { file: "404.html", head: head });
    }
    // Every published page: the pages from the page list, then the page for a wrong address.
    function all() {
      var out = [], done = {};
      function p(k) { if (PAGES.pages[k] && !done[k]) { done[k] = 1; out.push(sectionsPage(k)); } }
      p("home"); Object.keys(PAGES.pages || {}).forEach(p);
      // a list page is published once it has something in it, or the menu already leads to it
      ["articles", "artists"].forEach(function (k) {
        var linked = (get(hd(), "links", []) || []).some(function (l) { return Array.isArray(l) && String(l[1] || "").replace(/^\.?\//, "") === P[k] + "/"; });
        if (listOn(k) && ((k === "articles" ? ARTICLES : ARTISTS).length || linked)) out.push(listPage(k));
      });
      ARTICLES.forEach(function (a) { out.push(articlePage(a)); });
      ARTISTS.forEach(function (x) { out.push(artistPage(x)); });
      out.push(notFound());
      return out;
    }
    // A page at each of the site's old addresses that sends the visitor on to the new one.
    function forwards() {
      var all = D.forward || {}, made = {};
      return Object.keys(all).filter(function (from) { return /^[a-z0-9-]+\.html$/.test(from) && from !== "index.html" && from !== "404.html" && /^([a-z0-9-]+\/)*$/.test(String(all[from])); }).map(function (from) {
        var to = SITE_URL + all[from];
        made[from] = 1;
        return { path: from, html: '<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n<title>' + txt(NAME()) + '</title>\n<meta name="robots" content="noindex">\n<link rel="canonical" href="' + esc(to) + '">\n<meta http-equiv="refresh" content="0; url=' + esc(to) + '">\n</head>\n<body>\n<p><a href="' + esc(to) + '">' + W("nf.moved", "This page has moved. Continue to the new address.") + '</a></p>\n</body>\n</html>\n' };
      });
    }
    return {
      all: all, forwards: forwards, sectionsPage: sectionsPage, notFound: notFound, address: SITE_URL, paths: P,
      // in the editor a hidden article or artist can still be opened; on the site it has no page
      articlePage: function (s) { var a = articleOf(s); return a && (opts.mark || a.hidden !== true) ? articlePage(a) : null; },
      featurePage: function (s) { var a = articleOf(s); return a && (opts.mark || a.hidden !== true) ? articlePage(a) : null; },
      artistPage: function (s) { var x = artistOf(s); return x && (opts.mark || x.hidden !== true) ? artistPage(x) : null; },
      listPage: function (k) { return (k === "articles" || k === "artists") && listOn(k) ? listPage(k) : null; },
      // Which page a web address inside the site leads to.
      which: function (path) {
        path = String(path || "").replace(/^\/+/, "").replace(/index\.html$/, "").split("#")[0].split("?")[0];
        var k = Object.keys(PAGES.pages || {}).find(function (x) { return PAGES.pages[x].path === path + (path && !/\/$/.test(path) ? "/" : "") + "index.html"; });
        if (k) return { kind: "page", key: k };
        var m = /^([a-z]+)\/?$/.exec(path), lk = m && (m[1] === P.articles ? "articles" : m[1] === P.artists ? "artists" : ""); if (lk && listOn(lk)) return { kind: "list", key: lk };
        if ((m = /^([a-z]+)\/([a-z0-9-]+)\/?$/.exec(path)) && m[1] === P.articles && articleOf(m[2])) return { kind: "article", key: m[2] };
        if (m && m[1] === P.artists && artistOf(m[2])) return { kind: "artist", key: m[2] };
        return null;
      },
    };
  }

  var EDITIONS = { fromFiles: fromFiles, Site: Site, slug: slug, addressOf: addressOf };
  if (typeof module !== "undefined" && module.exports) module.exports = EDITIONS; else root.EDITIONS = EDITIONS;
})(typeof window !== "undefined" ? window : this);
