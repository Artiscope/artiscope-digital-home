/* A site built from the Street Art Dispatch template in Artiscope Digital Home:
   draws every page from the site's data. The design is a copy of Street Art
   Dispatch's, taken when the site was made; later changes to that site never
   reach this one. Used twice: by tools/build.mjs to write the published pages,
   and by the page editor in Artiscope Digital Home to redraw a page as it is edited.
   The data is data/content.json (articles, columns, artists, the archive,
   exhibitions, collecting figures and glossary), the page list is
   data/pages.json, and the theme block goes in the head of every page. */
(function (root) {
  "use strict";
  // The site's own web address, from its details: a GitHub address until its domain is connected.
  function addressOf(D) { var a = String(((D || {}).site || {}).address || ""); return /^https:\/\/[a-z0-9.-]+(\/[A-Za-z0-9._\/-]*)?$/.test(a) ? a.replace(/\/*$/, "/") : "https://example.org/"; }

  // ----- small helpers, written to match the old build exactly -----
  // Python's html.escape(quote=True)
  function esc(v) { return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;"); }
  // words typed in the console: shown as written, never as markup
  function txt(v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function get(o, k, d) { return o && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined && o[k] !== null ? o[k] : d; }
  function stripTags(s) { return String(s).replace(/<[^>]+>/g, ""); }
  function mins(a) { var w = stripTags(String(a.body || "").replace(/<[^>]+>/g, " ")).split(/\s+/).filter(Boolean).length; return Math.max(1, Math.round(w / 225)); }
  // an address typed in the console: a page of this site, or a full address
  function addrOk(h) { return /^(#|\/|[a-z0-9-]+\/|https?:\/\/|mailto:)/i.test(String(h || "")); }
  function hrefOf(h) { h = String(h || ""); return /^(https?:|mailto:|\/)/i.test(h) ? h : "@@" + h; }

  // The data file as one object, the same shape Artiscope Digital Home edits:
  // every article (dispatches and columns) in one list with its section, every artist with a web address and its note.
  function fromFiles(content) {
    var c = JSON.parse(JSON.stringify(content || {})), notes = c.artist_notes || {}, s = c.site || {};
    return {
      site: { desk: c.desk || "", date: c.date || "", email: String(s.email || ""), address: String(s.address || ""), indexed: s.indexed === true },
      photos: c.photos || {}, artist_photos: c.artist_photos || {},
      photo_files: c.photo_files || {}, artist_photo_files: c.artist_photo_files || {},
      articles: (c.features || []).map(function (f) { return Object.assign({}, f, { section: "dispatches" }); })
        .concat((c.columns || []).map(function (f) { return Object.assign({}, f, { section: "urban-culture" }); })),
      artists: (c.artists || []).map(function (a) { return Object.assign({ slug: a.slug || slug(a.name) }, a, { note: notes[a.name] || "" }); }),
      archive: c.archive || [], exhibitions: c.exhibitions || [], stats: c.stats || [], glossary: c.glossary || [],
    };
  }

  function Site(D, PAGES, THEME, opts) {
    opts = opts || {};
    // Social media addresses chosen in the theme; nothing is shown until one is filled in.
    function socialHtml() {
      var all = opts.social && typeof opts.social === "object" ? opts.social : {}, out = Object.keys(all).map(function (k) { return all[k]; }).filter(function (x) { return x && /^https:\/\/[^\s<>"']+$/.test(x.href || ""); });
      return out.length ? '<nav class="foot-social" aria-label="' + W("sr.social", "Social media") + '">' + out.map(function (x) { return '<a href="' + esc(x.href) + '" rel="noopener">' + esc(x.label) + '</a>'; }).join("") + '</nav>\n' : "";
    }
    function iconOk() { return typeof opts.favicon === "string" && /^assets\/images\/[A-Za-z0-9._-]{1,120}\.(png|jpe?g|svg|ico)$/.test(opts.favicon); }
    opts = opts || {};
    D = D || {}; PAGES = PAGES || { shared: {}, pages: {} };
    var SITE = D.site || {}, SITE_URL = addressOf(D), MAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(SITE.email || "") ? SITE.email : "info@artiscope.co.uk";
    // The fixed words of the design. Edit default text in Artiscope Digital Home keeps changed ones in the
    // page list file under "words"; any word not changed keeps the site's own, written beside each W().
    var WORDS = PAGES.words && typeof PAGES.words === "object" ? PAGES.words : {};
    function W(key, dflt, slots) {
      var t = txt(typeof WORDS[key] === "string" && WORDS[key].trim() ? WORDS[key] : dflt).replace(/"/g, "&quot;");
      Object.keys(slots || {}).forEach(function (k) { t = t.split("{" + k + "}").join(slots[k]); });
      return t;
    }
    function wordsTag() { return Object.keys(WORDS).length ? '<script type="application/json" id="adh-words">' + JSON.stringify(WORDS).replace(/</g, "\\u003c") + '</script>\n' : ""; }
    // a hidden article is kept but not shown, except when it is being edited
    var LIVE = (D.articles || []).filter(function (a) { return !a.hidden || (opts.show && a.slug === opts.show); });
    var FEATURES = LIVE.filter(function (a) { return a.section !== "urban-culture"; }), COLUMNS = LIVE.filter(function (a) { return a.section === "urban-culture"; }), ALL = FEATURES.concat(COLUMNS);
    var COLS = {}; COLUMNS.forEach(function (c) { COLS[c.slug] = 1; });
    var BY_SLUG = {}; ALL.forEach(function (a) { BY_SLUG[a.slug] = a; });
    var PHOTOS = D.photos || {}, ART_PHOTOS = D.artist_photos || {}, PHOTO_FILES = D.photo_files || {}, ART_PHOTO_FILES = D.artist_photo_files || {};
    function hasPage(x) { return !!(x.read && BY_SLUG[x.read]) || !!opts.mark; }
    var ARCHIVE = D.archive || [];

    function shared(key) { var part = (PAGES.shared || {})[key] || {}; return [part.settings || {}, get(part, "visible", true) !== false]; }
    function hd() { return shared("header")[0]; }
    function NAME() { return get(hd(), "name", "[Site name]"); }
    // the words of the menu link to a page, so a crumb follows the site's own words
    function menuWord(href, dflt) { var l = navLinks().filter(function (x) { return x[1] === href; })[0]; return l ? txt(String(l[0]).replace(/^\[(.*)\]$/, "$1")) : dflt; }
    function navLinks() { return (get(hd(), "links", []) || []).filter(function (l) { return Array.isArray(l) && l[0]; }); }
    function pathOf(s) { return (COLS[s] ? "urban-culture/" : "dispatches/") + s + "/"; }
    function photo(desc, ratio) {
      var st = ratio ? ' style="aspect-ratio:' + ratio + '"' : "";
      return '<div class="ph" role="img" aria-label="' + W("sr.photo", "Photograph to come: {what}", { what: esc(desc) }) + '"' + st + '><span class="ph-t">' + W("missing.photo", "Photo to come") + '</span><span class="ph-d">' + esc(desc) + '</span></div>';
    }
    // a licensed photo placed in a story or artist space: { image, alt, caption, credit, credit_href, focus }
    function fileOk(v) { return v && typeof v === "object" && /^[A-Za-z0-9._-]{1,120}\.(png|jpe?g)$/.test(String(v.image || "")); }
    function slotPic(v, desc, ratio) {
      if (!fileOk(v)) return photo(desc, ratio);
      var pos = /^\d{1,3}% \d{1,3}%$/.test(String(v.focus || "")) ? "object-position:" + v.focus + ";" : "";
      var st = (ratio ? "aspect-ratio:" + ratio + ";" : "") + pos;
      return '<img class="ph-img" src="' + esc(opts.imageSrc ? opts.imageSrc(v.image) : "@@assets/images/" + v.image) + '" alt="' + esc(v.alt || "") + '" loading="lazy"' + (st ? ' style="' + st + '"' : "") + '>';
    }
    function slotCap(v, missing) {
      if (!fileOk(v)) return missing;
      var c = txt(v.credit || ""), href = String(v.credit_href || "");
      if (c && /^https:\/\//.test(href)) c = '<a href="' + esc(href) + '">' + c + '</a>';
      return [txt(v.caption || ""), c].filter(Boolean).join(" ");
    }
    function fixLinks(body, r) {
      return String(body).replace(/href="#read\/([\w-]+)"/g, function (m, s) { return 'href="' + r + pathOf(s) + '"'; })
        .replace(/href="#artist\/([\w-]+)"/g, function (m, s) { return 'href="' + r + "artists/" + s + '/"'; })
        .split('href="#interventions"').join('href="' + r + 'interventions/"');
    }
    function yearOf(x) { return typeof x.y === "number" ? x.y : -1; }
    function newestFirst(list) { return list.map(function (x, i) { return [x, i]; }).sort(function (a, b) { return yearOf(b[0]) - yearOf(a[0]) || a[1] - b[1]; }).map(function (p) { return p[0]; }); }

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
    function aoClosed() { try { return typeof localStorage !== "undefined" && localStorage.getItem("ao-privacy-closed") === "1"; } catch (x) { return false; } }
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
      var home = !!o.home, name = esc(NAME()), st = hd(), hon = shared("header")[1];
      main = String(main).split("@@").join(r);
      var links = navLinks().map(function (l) { return '<li><a href="' + r + l[1] + '"' + (urlPath.indexOf(l[1]) === 0 ? ' aria-current="page"' : "") + '>' + txt(l[0]) + '</a></li>'; }).join("");
      var sub = hrefOf(get(st, "subscribe_href", "#newsletter")).split("@@").join(r), subWords = txt(get(st, "subscribe", "Subscribe"));
      var plate = home && !o.own ? '<header class="nameplate"><a href="' + (r || "./") + '">' + name + '</a><p>' + txt(get(st, "tagline", "")) + '</p></header>' +
        '<div id="navSentinel" aria-hidden="true"></div>' : "";
      var nav = !hon || o.own ? "" : '<nav class="nav' + (home ? "" : " nav--inner") + '" id="nav" aria-label="' + W("sr.nav", "Sections") + '">\n  <div class="wrap">\n' +
        '    <a class="nav-mark" href="' + (r || "./") + '"><span>' + name + '</span></a>\n' +
        (headLogos(st, r, "L") ? '    <span class="hlogos">' + headLogos(st, r, "L") + '</span>\n' : "") +
        '    <ul class="nav-links">' + links + '</ul>\n' + (headLogos(st, r, "C") ? '    <span class="hlogos">' + headLogos(st, r, "C") + '</span>\n' : "") + '    <div class="nav-right">\n' + (headLogos(st, r, "R") ? '      <span class="hlogos">' + headLogos(st, r, "R") + '</span>\n' : "") + '      <a class="btn btn--sm" href="' + sub + '">' + subWords + '</a>\n' +
        '      <button class="menu-btn" id="menuBtn" aria-expanded="false" aria-controls="sheet"><i aria-hidden="true"></i>' + W("menu.open", "Menu") + '</button>\n    </div>\n  </div>\n</nav>\n' +
        '<div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-label="' + W("sr.menu", "Menu") + '">\n  <div class="sheet-top"><span>' + name + '</span><button class="close-btn" id="sheetClose">' + W("menu.close", "Close") + ' <b aria-hidden="true">×</b></button></div>\n' +
        '  <ul>' + links + '</ul>\n  <a class="btn" href="' + sub + '">' + subWords + '</a>\n</div>';
      var ft = shared("footer"), f = ft[0];
      var foot = !ft[1] || o.own ? "" : '<footer class="on-pine foot" id="contact">\n  <div class="wrap">\n    <div class="foot-grid">\n' +
        '      <div><p class="mark">' + name + '</p><p class="tag">' + txt(get(f, "tagline", "")) + '</p></div>\n' +
        '      <nav aria-labelledby="f-sec"><h2 id="f-sec">' + txt(get(f, "sections_heading", "Sections")) + '</h2><ul>' + navLinks().map(function (l) { return '<li><a href="' + r + l[1] + '">' + txt(l[0]) + '</a></li>'; }).join("") + '</ul></nav>\n' +
        '      <nav aria-labelledby="f-abt"><h2 id="f-abt">' + txt(get(f, "about_heading", "About")) + '</h2><ul>\n        ' +
        (get(f, "about_links", []) || []).filter(function (l) { return Array.isArray(l) && l[0]; }).map(function (l) { return '<li><a href="' + hrefOf(l[1]).split("@@").join(r) + '">' + txt(l[0]) + '</a></li>'; }).join("") + '</ul></nav>\n' +
        '    </div>\n    ' + socialHtml() + '<p class="legal">' + txt(get(f, "legal", "")) + '</p>\n  </div>\n</footer>';
      // Until its own web address is connected, every page asks search engines to stay away.
      var noindex = SITE.indexed !== true ? '<meta name="robots" content="noindex, nofollow">\n' : "";
      var html = '<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' + noindex +
        '<title>' + esc(title) + '</title>\n<meta name="description" content="' + esc(desc) + '">\n<link rel="canonical" href="' + SITE_URL + urlPath + '">\n' +
        '<meta property="og:type" content="' + (home ? "website" : "article") + '">\n<meta property="og:site_name" content="' + name + '">\n' +
        '<meta property="og:title" content="' + esc(title) + '">\n<meta property="og:description" content="' + esc(desc) + '">\n<meta property="og:url" content="' + SITE_URL + urlPath + '">\n' +
        '<meta name="twitter:card" content="summary_large_image">\n' +
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
        '<link href="https://fonts.googleapis.com/css2?family=Gloock&family=Libre+Franklin:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">\n' +
        (o.head || "") + (iconOk() ? '<link rel="icon" href="' + r + opts.favicon + '">\n' : "") +
        '<link rel="stylesheet" href="' + r + 'assets/site.css">\n' + (THEME || "") + secCssTag() + wordsTag() +
        '</head>\n<body>\n<a class="skip" href="#main">' + W("menu.skip", "Skip to content") + '</a>\n' + plate + '\n' + (o.top ? String(o.top).split("@@").join(r) + "\n" : "") + nav + '\n<main id="main">\n' + main + '\n</main>\n' + foot + '\n' +
        '<script src="' + r + 'assets/site.js" defer></script>\n</body>\n</html>\n';
      return { path: o.file || path, url: urlPath, html: html };
    }

    // ----- shared pieces -----
    function story(f, cls) {
      var stand = cls !== "s-side" ? '<p class="stand">' + f.standfirst + '</p>' : "";
      return '<article class="story ' + cls + '">' + picFor(f, PHOTO_FILES[f.slug], PHOTOS[f.slug] || f.title) + '<p class="kicker">' + f.kicker + '</p>' +
        '<h3><a href="@@' + pathOf(f.slug) + '">' + f.title + '</a></h3>' + stand + '<p class="byline">By ' + SITE.desk + ' · ' + W("item.min-read", "{n} min read", { n: String(mins(f)) }) + '</p></article>';
    }
    function icard(x) {
      var badge = x.pending ? '<span class="badge">' + W("missing.awaiting", "Awaiting confirmation") + '</span>' : "";
      var more = x.read && BY_SLUG[x.read] ? '<a class="tlink" href="@@' + pathOf(x.read) + '">' + W("btn.read-story", "Read the story") + '</a>' : "";
      return '<li class="icard"><p class="kicker"><span>' + esc(x.type) + '</span>' + badge + '</p><h4>' + esc(x.title) + '</h4>' +
        '<p class="who"><a href="@@interventions/?artist=' + slug(x.artist) + '">' + esc(x.artist) + '</a> · ' + esc(x.city) + ', ' + esc(x.country) + '</p>' +
        '<p>' + esc(x.note) + '</p>' + more + '</li>';
    }
    function acard(x) {
      var inner = picFor(x, ART_PHOTO_FILES[x.name], ART_PHOTOS[x.name] || x.name) + '<h3>' + x.name + '</h3><p>' + x.role + '</p>';
      if (x.read && BY_SLUG[x.read]) return '<li><a class="acard" href="@@artists/' + x.slug + '/">' + inner + '<span class="more">' + W("btn.open-profile", "Open profile") + '</span></a></li>';
      return '<li><div class="acard acard--soon">' + inner + '<span class="soon">' + W("missing.soon", "Coming soon") + '</span></div></li>';
    }
    function ccard(c) {
      return '<li class="ccard"><p class="kicker">' + c.kicker + ' · ' + W("item.mins", "{n} min", { n: String(mins(c)) }) + '</p><h3><a href="@@' + pathOf(c.slug) + '">' + c.title + '</a></h3><p>' + c.standfirst + '</p>' +
        '<span class="more" aria-hidden="true">' + (COLS[c.slug] ? W("btn.read-column", "Read the column") : W("btn.read-dispatch", "Read the dispatch")) + '</span></li>';
    }
    function ecard(x) {
      return '<li class="ecard"><p class="kicker">' + x.venue + '</p><h3>' + x.t + '</h3><p>' + x.sub + '</p><dl><div><dt>' + W("item.dates", "Dates:") + ' </dt><dd>' + x.when + '</dd></div></dl><span class="badge">' + x.status + '</span></li>';
    }
    // where cards will go on a new site: a placeholder line in square brackets, like every other unwritten word
    function empty(words) { return '<p class="dek">' + txt(words) + '</p>'; }
    function dgrid(list) {
      if (!list.length) return "";
      var out = story(list[0], "s-lead"), side = list.slice(1, 3), rest = list.slice(3);
      if (side.length) out += '<div class="side">' + side.map(function (f) { return story(f, "s-side"); }).join("") + '</div>';
      return out + rest.map(function (f) { return story(f, "s-small"); }).join("");
    }
    // A section's heading. At the top of a page it is the page's own heading; further down it is a section heading.
    function wrapSec(st, ctx, inner, o) {
      o = o || {};
      var h = txt(get(st, "heading", "")), d = get(st, "intro", ""), dek = d ? '<p class="dek">' + txt(d) + '</p>' : "", cls = "sec" + (o.pine ? " on-pine" : "");
      if (get(st, "top", false)) return '<section class="sec sec--top' + (o.pine ? " on-pine" : "") + '"' + (o.id ? ' id="' + o.id + '"' : "") + (o.attrs || "") + '><div class="wrap">' + (h || dek ? '<div class="sec-head">' + (h ? "<h1>" + h + "</h1>" : "") + dek + '</div>' : "") + inner + '</div></section>';
      var id = o.id || ctx.id, hid = "h-" + id;
      return '<section class="' + cls + '" id="' + id + '"' + (h ? ' aria-labelledby="' + hid + '"' : "") + (get(st, "flush", false) ? ' style="padding-top:0"' : "") + (o.attrs || "") + '><div class="wrap">\n    ' +
        (h || dek ? '<div class="sec-head">' + (h ? '<h2 id="' + hid + '">' + h + '</h2>' : "") + dek + '</div>\n    ' : "") + inner + '</div></section>';
    }

    // ----- sections -----
    var S = {};
    S.hero = function (st) {
      var btn = get(st, "button", "") && addrOk(get(st, "button_href", "")) ? '<a class="btn" href="' + hrefOf(st.button_href) + '">' + txt(st.button) + '</a>' : "";
      var lnk = get(st, "link", "") && addrOk(get(st, "link_href", "")) ? '<a class="tlink" href="' + hrefOf(st.link_href) + '">' + txt(st.link) + '</a>' : "";
      var cap = txt(get(st, "caption", "")) + (get(st, "caption_link", "") && addrOk(get(st, "caption_href", "")) ? ' <a href="' + hrefOf(st.caption_href) + '">' + txt(st.caption_link) + '</a>.' : "");
      return '<div class="wrap">\n    <section class="hero" aria-labelledby="heroTitle">\n      <div>\n' +
        (get(st, "eyebrow", "") ? '        <p class="kicker">' + txt(st.eyebrow) + '</p>\n' : "") +
        '        <h1 id="heroTitle">' + txt(get(st, "headline", "")) + '</h1>\n' +
        (get(st, "intro", "") ? '        <p class="hero-intro">' + txt(st.intro) + '</p>\n' : "") +
        (btn || lnk ? '        <div class="actions">' + btn + lnk + '</div>\n' : "") +
        '      </div>\n      <figure>' + picOf({ image: get(st, "image", ""), alt: get(st, "photo", "") }, "Lead image") + (cap ? '<figcaption>' + cap + '</figcaption>' : "") + '</figure>\n    </section>\n  </div>';
    };
    function articlesFor(which) {
      if (which === "dispatches") return FEATURES.slice();
      if (which === "columns") return COLUMNS.slice();
      if (which === "all") return ALL.slice();
      return (Array.isArray(which) ? which : []).filter(function (s) { return BY_SLUG[s]; }).map(function (s) { return BY_SLUG[s]; });
    }
    S.features = function (st, ctx) {
      var list = articlesFor(get(st, "which", "dispatches"));
      var inner = !list.length ? empty("[Articles appear here once you add them]") : get(st, "look", "grid") === "list" ? '<ul class="cgrid">' + list.map(ccard).join("") + '</ul>' : '<div class="dgrid">' + dgrid(list) + '</div>';
      return wrapSec(st, ctx, inner);
    };
    S.profiles = function (st, ctx) {
      var want = (get(st, "artists", []) || []).filter(function (x) { return typeof x === "string"; }), list = (D.artists || []).filter(function (x) { return !want.length || want.indexOf(x.slug) >= 0; });
      return wrapSec(st, ctx, list.length ? '<ul class="agrid">' + list.map(acard).join("") + '</ul>' : empty("[Artists appear here once you add them]"));
    };
    S.archive = function (st, ctx) {
      if (get(st, "show", "recent") !== "all") {
        var n = Math.max(1, Math.min(60, Number(get(st, "count", 6)) || 6)), recent = newestFirst(ARCHIVE).slice(0, n);
        var b = get(st, "button", ""), more = b && addrOk(get(st, "button_href", "")) ? '\n    <p class="amore"><a class="btn" href="' + hrefOf(st.button_href) + '">' + txt(b).split("{count}").join(String(ARCHIVE.length)) + '</a></p>' : "";
        return wrapSec(st, ctx, (recent.length ? '<ul class="cards">' + recent.map(icard).join("") + '</ul>' : empty("[Archive entries appear here once you add them]")) + more);
      }
      var names = Array.from(new Set(ARCHIVE.map(function (x) { return x.artist; }))).sort(), cities = Array.from(new Set(ARCHIVE.map(function (x) { return x.city; }))).sort();
      var dec = function (x) { return typeof x.y === "number" ? String(Math.floor(x.y / 10) * 10) : "tbc"; };
      var groups = [], at = {};
      newestFirst(ARCHIVE).forEach(function (x) { var k = String(x.y); if (!(k in at)) { at[k] = groups.length; groups.push([k, []]); } groups[at[k]][1].push(x); });
      var card = function (x) {
        var text = esc(["title", "artist", "city", "country", "type", "note", "y"].map(function (k) { return String(x[k]); }).join(" ").toLowerCase());
        return icard(x).replace('<li class="icard">', '<li class="icard" data-artist="' + slug(x.artist) + '" data-city="' + esc(x.city) + '" data-dec="' + dec(x) + '" data-text="' + text + '">');
      };
      var label = function (y) { return y === "TBC" ? W("missing.date", "Date to confirm") : y; };
      var out = groups.map(function (g) { return '<section class="yr" aria-label="' + label(g[0]) + '"><h2>' + label(g[0]) + '</h2><ul class="cards">' + g[1].map(card).join("") + '</ul></section>'; }).join("");
      var chips = [["", W("archive.all-years", "All years")], ["2020", "2020s"], ["2010", "2010s"], ["2000", "2000s"], ["1990", "1990s"], ["1980", "1980s"], ["tbc", W("missing.date", "Date to confirm")]].map(function (c) {
        return '<button type="button" class="chip" data-dec="' + c[0] + '" aria-pressed="' + (c[0] === "" ? "true" : "false") + '">' + c[1] + '</button>';
      }).join("");
      var aopts = names.map(function (n) { return '<option value="' + slug(n) + '">' + esc(n) + '</option>'; }).join(""), copts = cities.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join("");
      var email = get(st, "email", "") || mailTo(), note = get(st, "note", "");
      var inner = '\n    <form class="atools" role="search" onsubmit="return false">\n' +
        '      <div class="field"><label for="fQ">' + W("archive.search", "Search") + '</label><input id="fQ" type="search" placeholder="' + txt(get(st, "search_hint", "")) + '" autocomplete="off"></div>\n' +
        '      <div class="field"><label for="fArtist">' + W("archive.artist", "Artist") + '</label><select id="fArtist"><option value="">' + W("archive.all-artists", "All artists") + '</option>' + aopts + '</select></div>\n' +
        '      <div class="field"><label for="fCity">' + W("archive.city", "City") + '</label><select id="fCity"><option value="">' + W("archive.all-cities", "All cities") + '</option>' + copts + '</select></div>\n' +
        '      <div class="field decades" role="group" aria-labelledby="decLbl"><span class="lbl" id="decLbl">' + W("archive.year", "Year") + '</span><div class="chips" id="decades">' + chips + '</div></div>\n    </form>\n' +
        '    <div class="astatus"><p id="aCount" aria-live="polite">' + W("archive.count", "{n} interventions, newest first", { n: String(ARCHIVE.length) }) + '</p><button class="tlink" id="aClear" type="button" hidden>' + W("archive.clear", "Clear filters") + '</button></div>\n' +
        '    <div class="results" id="results">' + out + '</div>\n    <p class="empty" id="aEmpty" hidden>' + W("archive.empty", "Nothing matches those filters yet.") + '</p>\n' +
        (note || email ? '    <p class="anote">' + txt(note) + (email && get(st, "note_link", "") ? ' <a class="tlink" href="mailto:' + esc(email) + '" style="min-height:0">' + txt(st.note_link) + '</a>' : "") + '</p>\n  ' : "  ");
      return wrapSec(st, ctx, inner, { id: "archive", attrs: ' data-total="' + ARCHIVE.length + '"' });
    };
    S["exhibition-list"] = function (st, ctx) { var l = D.exhibitions || []; return wrapSec(st, ctx, l.length ? '<ul class="egrid">' + l.map(ecard).join("") + '</ul>' : empty("[Exhibitions appear here once you add them]")); };
    S.collecting = function (st, ctx) {
      var top = !!get(st, "top", false), h2 = top ? "h2" : "h3", h3 = top ? "h3" : "h4";
      var facts = (D.stats || []).map(function (p) { return '<li class="fact"><strong>' + p[0] + '</strong><span>' + p[1] + '</span></li>'; }).join("");
      var terms = (D.glossary || []).map(function (p) { return '<div><' + h3 + '>' + p[0] + '</' + h3 + '><p>' + p[1] + '</p></div>'; }).join("");
      var b = get(st, "button", ""), btn = b && addrOk(get(st, "button_href", "")) ? '\n      <a class="btn" href="' + hrefOf(st.button_href) + '">' + txt(b) + '</a>' : "";
      var inner = '<ul class="facts">' + facts + '</ul>\n    <div class="primer"><div class="intro"><' + h2 + '>' + txt(get(st, "primer_heading", "")) + '</' + h2 + '>\n      <p>' + txt(get(st, "primer", "")) + '</p>' + btn + '</div>\n' +
        '      <div class="terms">' + terms + '</div></div>';
      return wrapSec(st, ctx, inner, { pine: true });
    };
    S.signup = function (st, ctx) {
      var email = get(st, "email", "") || mailTo(), id = ctx.id;
      return '<section class="sec" id="' + id + '" aria-labelledby="h-' + id + '">\n    <div class="wrap news">\n' +
        '      <div><h2 id="h-' + id + '">' + txt(get(st, "heading", "")) + '</h2>' + (get(st, "text", "") ? '<p class="dek">' + txt(st.text) + '</p>' : "") + '</div>\n      <div>\n' +
        '        <form class="nl" id="nl" data-email="' + esc(mailTo()) + '"><label class="sr" for="nlEmail">' + W("form.email", "Email address") + '</label><input id="nlEmail" type="email" required placeholder="' + W("form.placeholder", "you@example.com") + '" autocomplete="email"><button class="btn" type="submit">' + txt(get(st, "button", "Subscribe")) + '</button></form>\n' +
        '        <p class="nl-msg" id="nlMsg" aria-live="polite"></p>\n' +
        '        <p class="mf-note">' + W("form.note", "This opens your own email app with a message ready to send to {email}.", { email: esc(mailTo()) }) + '</p>\n' +
        (get(st, "pitch", "") || email ? '        <p class="pitch">' + txt(get(st, "pitch", "")) + (email ? ' <a class="tlink" style="min-height:0" href="mailto:' + esc(email) + '">' + esc(email) + '</a>' : "") + '</p>\n' : "") +
        '      </div>\n    </div>\n  </section>';
    };
    // A sign-up box that pops up once a visit; drawn hidden, and shown by the site's script.
    S["signup-popup"] = function (st, ctx) {
      var id = (ctx && ctx.id) || "popup", d = Math.max(3, Math.min(60, Number(get(st, "delay", 8)) || 8)), e = get(st, "eyebrow", ""), t = get(st, "text", "");
      return '<div class="supop" id="' + esc(id) + '" data-popup data-delay="' + d + '" role="dialog" aria-labelledby="' + esc(id) + '-h" hidden>\n  <button type="button" class="supop-x" data-pop-close>' + W("btn.close", "Close") + '</button>\n' +
        (e ? '  <p class="kicker">' + txt(e) + '</p>\n' : "") + '  <h2 id="' + esc(id) + '-h">' + txt(get(st, "heading", "")) + '</h2>\n' + (t ? '  <p class="dek">' + txt(String(t).trim()) + '</p>\n' : "") +
        '  <form class="nl" data-popform data-email="' + esc(mailTo()) + '" novalidate><label class="sr" for="' + esc(id) + '-e">' + W("form.email", "Email address") + '</label><input id="' + esc(id) + '-e" name="email" type="email" required placeholder="' + W("form.placeholder", "you@example.com") + '" autocomplete="email"><button class="btn" type="submit">' + (get(st, "button", "") ? txt(get(st, "button", "")) : W("btn.join", "Ask to join")) + '</button></form>\n' +
        '  <p class="mf-note" role="status">' + W("form.note", "This opens your own email app with a message ready to send to {email}.", { email: esc(mailTo()) }) + '</p>\n</div>';
    };
    S["text-page"] = function (st) {
      var body = (get(st, "intro", []) || []).map(function (p) { return "<p>" + (typeof p === "object" && p ? p.v : p) + "</p>"; }).join("");
      var items = (get(st, "items", []) || []).filter(function (x) { return x && x.hidden !== true && (x.term || x.text); });
      var lh = get(st, "list_heading", ""), anchor = get(st, "list_anchor", "");
      if (items.length) body += (lh ? '<h2' + (anchor ? ' id="' + esc(anchor) + '"' : "") + '>' + txt(lh) + '</h2>' : "") + '<dl class="stds">' + items.map(function (x) { return '<div><dt>' + x.term + '</dt><dd>' + x.text + '</dd></div>'; }).join("") + '</dl>';
      if (get(st, "end_heading", "") || get(st, "end_text", "")) body += (get(st, "end_heading", "") ? '<h2>' + txt(st.end_heading) + '</h2>' : "") + (get(st, "end_text", "") ? '<p>' + st.end_text + '</p>' : "");
      return '<article><header class="r-head"><h1>' + txt(get(st, "heading", "")) + '</h1>' + (get(st, "stand", "") ? '<p class="r-stand">' + st.stand + '</p>' : "") + '</header><div class="r-body r-body--page">' + body.split("{root}").join("@@") + '</div></article>';
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
    // the item's own photo first, then a licensed photo placed in its space, then the frame
    function picFor(x, lic, desc, ratio) { return x && x.image ? picOf(x, desc, ratio) : fileOk(lic) ? slotPic(lic, desc, ratio) : picOf(x, desc, ratio); }
    function link(words, h, cls) { return words && addrOk(h) ? '<a class="' + (cls || "tlink") + '" href="' + esc(hrefOf(h)) + '"' + (/^https?:/i.test(String(h)) ? ' rel="noopener"' : "") + '>' + txt(words) + '</a>' : ""; }
    function rep(x) { return x && x.reported ? '<span class="badge">' + W("item.reported", "Reported") + '</span> ' : ""; }
    function per(st) { return { "2": 2, "3": 3, "4": 4 }[String(get(st, "per_row", "3"))] || 3; }
    function mailTo() { return MAIL; }

    S.announcement = function (st) {
      var rows = liveRows(get(st, "messages", [])).filter(function (r) { return r.x.text || r.x.link; });
      var look = get(st, "style", "pine") === "linen" ? "ann--linen" : "ann--pine";
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
      return get(st, "panel", true) === false ? libSec("", '<div class="cta cta--plain">' + inner + '</div>') : libSec("on-pine", '<div class="cta">' + inner + '</div>');
    };
    S["picture-banner"] = function (st) {
      var place = { C: "pb--c", R: "pb--r" }[get(st, "place", "L")] || "pb--l", box = get(st, "box", "pine") === "linen" ? "pb-box--linen" : "pb-box--pine";
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
        return '<li class="ecard" data-adh-b="shows.' + r.i + '"><p class="kicker">' + txt(x.place || "") + '</p><h3>' + rep(x) + txt(x.title || "") + '</h3><dl><div><dt>' + W("item.dates", "Dates:") + ' </dt><dd>' + (x.dates ? txt(x.dates) : W("missing.tbc", "To confirm")) + '</dd></div></dl>' +
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
        '<form class="mf" data-mailform="contact" data-email="' + esc(mailTo()) + '" novalidate><div class="mf-row"><div class="field"><label>' + W("form.name", "Your name") + '<input name="name" type="text" autocomplete="name"></label></div><div class="field"><label>' + W("form.your-email", "Your email") + '<input name="email" type="email" autocomplete="email" required></label></div></div>' +
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
    // Templates: an article or an artist page is drawn with the sections of its template around its own content (the "main" section).
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
      if (v === "{page.artist}") return kind === "artist" ? it.slug : ((it.artists || [])[0] || "");
      if (v === "{page.article}") return kind === "article" ? it.slug : "";
      var plain = function (x) { return String(x == null ? "" : x).replace(/<[^>]*>/g, "").replace(/[<>]/g, ""); };
      var title = kind === "artist" ? it.name : it.title, sum = kind === "artist" ? (it.summary || it.dek || it.role || "") : (it.dek || it.standfirst || it.description || "");
      return v.split("{page.title}").join(plain(title)).split("{page.summary}").join(plain(sum));
    }
    function tplWrap(kind, slug, inner) {
      var t = tplOf(kind, slug); if (!t || !Array.isArray(t.sections)) return inner;
      var item = kind === "article" ? BY_SLUG[slug] : (D.artists || []).filter(function (x) { return x.slug === slug; })[0];
      var placed = false, seen = {};
      inner.replace(/ id="([^"]+)"/g, function (m, x) { seen[x] = 1; return m; });
      var out = t.sections.map(function (sec) {
        if (sec && sec.type === "main") { placed = true; return inner; }
        if (!sec || sec.visible === false || !S[sec.type]) return "";
        return mark(cssMark(own(S[sec.type](pageFill(sec.settings || {}, kind, item), { id: sec.id, page: "tpl" }), sec.id, seen), sec), sec.id);
      });
      if (!placed) out.unshift(inner);
      return out.filter(Boolean).join("\n");
    }
    function sectionsPage(key) {
      var pg = PAGES.pages[key], parts = [], top = [], lead = true, seen = {};
      (pg.sections || []).forEach(function (sec) {
        if (!sec || sec.visible === false || !S[sec.type]) return;
        var html = mark(cssMark(own(S[sec.type](sec.settings || {}, { id: sec.id, page: key }), sec.id, seen), sec), sec.id);
        if (lead && sec.type === "announcement") top.push(html); else { lead = false; parts.push(html); }
      });
      return page(pg.path, pg.title || "", pg.description || "", (pg.own ? top.concat(parts) : parts).join("\n  "), { home: !!pg.home, top: pg.own ? "" : top.join("\n"), own: !!pg.own });
    }

    // ----- articles, columns and artists, each on its own page -----
    // The photo at the top of an article or artist page: the photo with its credit, or the Photo to come frame.
    function rFigure(x, lic, desc) {
      if (!x.image && fileOk(lic)) return '<figure class="r-fig">' + slotPic(lic, desc) + '<figcaption>' + slotCap(lic, "") + '</figcaption></figure>';
      var credit = String(x.credit || "").trim();
      return '<figure class="r-fig">' + picOf(x, desc) + '<figcaption>' + (x.image ? txt(credit) : W("missing.commission", "Photograph to be commissioned.")) + '</figcaption></figure>';
    }
    function M(h, id) { return opts.mark ? h.replace(/^(\s*<[a-z]+)/, '$1 data-adh="' + id + '"') : h; }
    function articlePage(a) {
      var p = pathOf(a.slug), isCol = !!COLS[a.slug], pool = isCol ? COLUMNS : FEATURES;
      var nxt = pool[(pool.indexOf(a) + 1) % pool.length];
      var sect = isCol ? [menuWord("urban-culture/", "Urban Culture"), "urban-culture/"] : [menuWord("dispatches/", "Dispatches"), "dispatches/"];
      var fig = PHOTOS[a.slug] || a.image || fileOk(PHOTO_FILES[a.slug]) || opts.mark ? M(rFigure(a, PHOTO_FILES[a.slug], PHOTOS[a.slug] || a.title), "picture") : "";
      var main = '<article>\n    ' + M('<header class="r-head"><p class="crumb"><a href="@@' + sect[1] + '">' + sect[0] + '</a></p><p class="kicker">' + a.kicker + '</p><h1>' + a.title + '</h1><p class="r-stand">' + a.standfirst + '</p><p class="byline">By ' + SITE.desk + ' · ' + SITE.date + ' · ' + W("item.min-read", "{n} min read", { n: String(mins(a)) }) + '</p></header>', "words") + '\n    ' +
        fig + '\n    ' + M('<div class="r-body">' + fixLinks(a.body, "@@") + '</div>', "body") + '\n' +
        '    <footer class="r-foot"><p class="filed">' + W("item.filed", "Filed under {tags}.", { tags: (a.tags || []).join(", ") }) + '</p>\n' +
        '      <div class="next"><p class="kicker">' + (isCol ? W("item.next-column", "Next column") : W("item.next-dispatch", "Next dispatch")) + '</p><h2>' + nxt.title + '</h2><a class="btn" href="@@' + pathOf(nxt.slug) + '">' + W("btn.read-next", "Read next") + '</a></div></footer>\n  </article>';
      main = tplWrap("article", a.slug, main); AO_KIND = "article";
      return page(p + "index.html", a.title + " | " + NAME(), stripTags(a.standfirst), main);
    }
    function artistPage(x) {
      var s = x.slug;
      var works = newestFirst(ARCHIVE.filter(function (w) { return w.artist === x.name; }));
      var feat = BY_SLUG[x.read];
      var facts = (x.facts || []).map(function (p) { return '<div><dt>' + p[0] + '</dt><dd>' + p[1] + '</dd></div>'; }).join("");
      var arch = "";
      if (works.length) {
        var rows = works.map(function (w) { return '<li><strong>' + (w.y === "TBC" ? W("missing.date", "Date to confirm") : w.y) + '</strong>: ' + esc(w.title) + ', ' + esc(w.city) + '</li>'; }).join("");
        arch = '<h2>' + W("item.in-archive", "In the archive") + '</h2><ul class="plain">' + rows + '</ul><p><a href="@@interventions/?artist=' + s + '">' + W("item.see-archive", "See these entries in the archive") + '</a></p>';
      }
      var main = '<article>\n    ' + M('<header class="r-head"><p class="crumb"><a href="@@artists/">' + W("item.crumb-artists", "Artists") + '</a></p><p class="kicker">' + W("item.kicker-artist", "Artist") + '</p><h1>' + x.name + '</h1><p class="r-stand">' + x.role + '</p></header>', "words") + '\n' +
        '    ' + M(rFigure(x, ART_PHOTO_FILES[x.name], ART_PHOTOS[x.name] || x.name), "picture") + '\n' +
        '    ' + M('<div class="r-body"><p>' + x.summary + '</p><p>' + (x.note || "") + '</p>\n      <dl class="kfacts">' + facts + '</dl>' + arch + '</div>', "about") + '\n' +
        (feat ? '    <footer class="r-foot"><div class="next"><p class="kicker">' + W("item.read-more", "Read more") + '</p><h2>' + feat.title + '</h2><a class="btn" href="@@' + pathOf(feat.slug) + '">' + W("btn.read-story", "Read the story") + '</a></div></footer>\n' : "") + '  </article>';
      main = tplWrap("artist", s, main); AO_KIND = "artist";
      return page("artists/" + s + "/index.html", x.name + " | " + NAME(), stripTags(x.summary), main);
    }
    function notFound() {
      var root = SITE_URL.replace(/^https:\/\/[^\/]+/, "") || "/";
      var base = "<script>document.write('<base href=\"'+(location.hostname.slice(-9)==='github.io'?'" + esc(root) + "':'/')+'\">')</script>\n";
      var main = '<article><header class="r-head"><p class="kicker">' + W("nf.eyebrow", "Page not found") + '</p><h1>' + W("nf.title", "That page isn’t here.") + '</h1><p class="r-stand">' + W("nf.lede", "It may have moved, or the address may be mistyped.") + '</p></header><div class="r-body r-body--page"><p><a href="./">' + W("nf.home", "Go to the front page") + '</a> ' + W("nf.or", "or") + ' <a href="interventions/">' + W("nf.archive", "search the archive") + '</a>.</p></div></article>';
      return page("", "Page not found | " + NAME(), "That page is not here.", main, { file: "404.html", head: base });
    }
    var LIST_ORDER = ["home", "dispatches", "urban-culture", "artists", "interventions", "exhibitions", "collecting", "about", "contact"];
    // Every published page: the pages from the page list, then each article and artist, then the page for a wrong address.
    function all() {
      var out = [], done = {};
      function p(k) { if (PAGES.pages[k] && !done[k]) { done[k] = 1; out.push(sectionsPage(k)); } }
      LIST_ORDER.forEach(p); Object.keys(PAGES.pages || {}).forEach(p);
      ALL.forEach(function (a) { out.push(articlePage(a)); });
      (D.artists || []).forEach(function (x) { if (x.read && BY_SLUG[x.read]) out.push(artistPage(x)); });
      out.push(notFound());
      return out;
    }
    return {
      all: all, sectionsPage: sectionsPage, notFound: notFound,
      articlePage: function (s) { return BY_SLUG[s] ? articlePage(BY_SLUG[s]) : null; },
      featurePage: function (s) { return BY_SLUG[s] ? articlePage(BY_SLUG[s]) : null; },
      artistPage: function (s) { var x = (D.artists || []).find(function (a) { return a.slug === s && hasPage(a); }); return x ? artistPage(x) : null; },
      // Which page a web address inside the site leads to.
      which: function (path) {
        path = String(path || "").replace(/^\/+/, "").replace(/index\.html$/, "").split("#")[0].split("?")[0];
        var m;
        if ((m = /^artists\/([a-z0-9-]+)\/?$/.exec(path)) && (D.artists || []).some(function (a) { return a.slug === m[1] && hasPage(a); })) return { kind: "artist", key: m[1] };
        if ((m = /^(dispatches|urban-culture)\/([a-z0-9-]+)\/?$/.exec(path)) && BY_SLUG[m[2]]) return { kind: "article", key: m[2] };
        var k = Object.keys(PAGES.pages || {}).find(function (x) { return PAGES.pages[x].path === path + (path && !/\/$/.test(path) ? "/" : "") + "index.html"; });
        return k ? { kind: "page", key: k } : null;
      },
    };
  }

  var SAD = { fromFiles: fromFiles, Site: Site, slug: slug, addressOf: addressOf };
  if (typeof module !== "undefined" && module.exports) module.exports = SAD; else root.SAD = SAD;
})(typeof window !== "undefined" ? window : this);
