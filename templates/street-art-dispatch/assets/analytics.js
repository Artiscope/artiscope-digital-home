/* Visitor statistics (Google Analytics 4), only with the visitor's permission.
   Nothing loads and no cookie is set until the visitor presses Accept on the small bar.
   Decline, or no answer, means no statistics at all. A link to "#cookie-settings" anywhere
   on the site opens the bar again so the choice can be changed.
   The same file is used on every Artiscope publication; only the three lines below differ. */
(function () {
  'use strict';
  var GA4_ID = '';                 // this site's GA4 measurement ID, e.g. 'G-ABC123XYZ'. Empty = switched off.
  var WEBSITE = 'streetartdispatch.com';
  var PRIVACY = '/privacy/';       // this site's privacy page

  var KEY = 'site-stats-consent';
  if (!/^G-[A-Z0-9]{4,}$/.test(GA4_ID)) return;
  if (window.ADH_EDIT || window.self !== window.top) return; // never inside the editor's preview
  if (/^\/preview\//.test(location.pathname)) return;      // nor on trial copies under /preview/
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl) {
    // The browser already asks sites not to track. Respect it and do not ask again.
    try { if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, 'denied'); } catch (e) {}
  }

  function getChoice() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setChoice(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  // ---- what kind of page this is ----------------------------------------------------
  var parts = location.pathname.replace(/index\.html$/, '').split('/').filter(Boolean);
  var section = parts[0] || 'home';
  var pageType = !parts.length ? 'home'
    : section === 'artists' && parts.length > 1 ? 'artist'
    : parts.length > 1 ? 'article'
    : 'section';
  function heading() { var h = document.querySelector('main h1, h1'); return h ? h.textContent.replace(/\s+/g, ' ').trim().slice(0, 100) : ''; }

  // ---- loading GA4 after Accept ------------------------------------------------------
  var queue = [], loaded = false;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  function load() {
    if (loaded) return; loaded = true;
    gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    gtag('js', new Date());
    gtag('config', GA4_ID, {
      website: WEBSITE,
      page_type: pageType,
      content_topic: section,
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    if (pageType === 'artist') send('artist_page_view', { artist_name: heading() });
    while (queue.length) { var q = queue.shift(); gtag('event', q[0], q[1]); }
  }

  function send(name, params) {
    params = params || {};
    params.website = WEBSITE; params.page_type = pageType; params.content_topic = section;
    for (var k in params) { if (params[k] === '' || params[k] == null) delete params[k]; else if (typeof params[k] === 'string') params[k] = params[k].slice(0, 100); }
    var c = getChoice();
    if (c === 'granted' && loaded) gtag('event', name, params);
    else if (!c) queue.push([name, params]); // waiting for an answer; sent only if the visitor accepts
  }

  function clearCookies() {
    var host = location.hostname.split('.'), domains = [];
    for (var i = 0; i < host.length - 1; i++) domains.push(host.slice(i).join('.'));
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (!/^_ga/.test(n)) return;
      document.cookie = n + '=; Max-Age=0; path=/';
      domains.forEach(function (d) { document.cookie = n + '=; Max-Age=0; path=/; domain=.' + d; });
    });
  }

  // ---- the bar ----------------------------------------------------------------------------
  var bar = null;
  function showBar() {
    if (bar) { bar.hidden = false; return; }
    bar = document.createElement('div');
    bar.className = 'stats-consent';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Visitor statistics');
    bar.innerHTML =
      '<p>May we count your visit? With your permission we use Google Analytics to see which pages are read, so we can write more of what is useful. No adverts, and nothing is shared for marketing. <a href="' + PRIVACY + '">Privacy</a></p>' +
      '<div class="stats-consent-btns"><button type="button" data-stats="denied">Decline</button><button type="button" data-stats="granted">Accept</button></div>';
    var css = document.createElement('style');
    css.textContent =
      '.stats-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:640px;margin:0 auto;padding:14px 16px;' +
      'background:#1b1d22;color:#fff;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.25);font:inherit;font-size:15px;line-height:1.45;' +
      'display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center}' +
      '.stats-consent[hidden]{display:none}.stats-consent p{margin:0;flex:1 1 280px}.stats-consent a{color:inherit;text-decoration:underline}' +
      '.stats-consent-btns{display:flex;gap:8px;flex:0 0 auto}.stats-consent button{font:inherit;font-size:15px;min-height:44px;padding:0 18px;border-radius:6px;cursor:pointer;border:1px solid #fff}' +
      '.stats-consent [data-stats=denied]{background:transparent;color:#fff}.stats-consent [data-stats=granted]{background:#fff;color:#1b1d22}' +
      '.stats-consent button:focus-visible{outline:3px solid #9cc3ff;outline-offset:2px}';
    document.head.appendChild(css);
    bar.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-stats]'); if (!b) return;
      var v = b.getAttribute('data-stats'), was = getChoice();
      setChoice(v); bar.hidden = true;
      if (v === 'granted') load();
      else {
        queue = [];
        if (was === 'granted') { gtag('consent', 'update', { analytics_storage: 'denied' }); window['ga-disable-' + GA4_ID] = true; clearCookies(); }
      }
    });
    document.body.appendChild(bar);
  }

  // A link to #cookie-settings (for example on the privacy page) opens the bar again.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href$="#cookie-settings"],[data-cookie-settings]');
    if (!a) return; e.preventDefault(); showBar();
  });

  // ---- what we count -------------------------------------------------------------------------
  // Newsletter: the sign-up boxes open the visitor's email app; the site marks the form with data-mailto when it does.
  var seenMail = typeof WeakSet === 'function' ? new WeakSet() : null;
  function formKind(f) { return f.getAttribute('data-mailform') || f.id || (f.hasAttribute('data-popform') ? 'popup' : f.hasAttribute('data-signup') ? 'signup' : 'form'); }
  new MutationObserver(function (list) {
    list.forEach(function (m) {
      var f = m.target;
      if (m.attributeName === 'data-mailto' && f.getAttribute('data-mailto')) {
        send('newsletter_signup', { lead_type: 'newsletter_request', form_location: formKind(f) });
      }
      // Enquiry forms: the site removes data-busy when sending ends, and clears the form only when it went through.
      if (m.attributeName === 'data-busy' && m.oldValue && !f.hasAttribute('data-busy')) {
        var em = f.elements && f.elements.email;
        if (em && em.value === '') send('contact_form_submit', { lead_type: 'enquiry', form_location: formKind(f) });
      }
    });
  }).observe(document.documentElement, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-mailto', 'data-busy'] });

  // Sign-up boxes that open the email app without marking the form (Street Art Dispatch).
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.id !== 'nl') return;
    var em = f.querySelector('input[type=email]');
    if (em && em.value.trim() && em.checkValidity()) send('newsletter_signup', { lead_type: 'newsletter_request', form_location: f.id });
  }, true);

  // Links: email addresses, sharing buttons and other websites.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var href = a.getAttribute('href') || '', text = (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (a.closest('.ao-share')) { send('share', { method: text, content_type: pageType, item_id: location.pathname }); return; }
    if (/^mailto:/i.test(href)) { send('email_click', { lead_type: 'direct_contact', link_text: text }); return; }
    var url; try { url = new URL(href, location.href); } catch (x) { return; }
    if (!/^https?:$/.test(url.protocol) || url.hostname === location.hostname) return;
    send('outbound_click', { link_domain: url.hostname, link_url: url.href, link_text: text });
  }, true);

  // ---- start -----------------------------------------------------------------------------------
  var choice = getChoice();
  if (choice === 'granted') load();
  else if (!choice) { if (document.body) showBar(); else document.addEventListener('DOMContentLoaded', showBar); }
})();
