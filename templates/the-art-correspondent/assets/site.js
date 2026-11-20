/* A site built with Artiscope Digital Home from The Art Correspondent template:
   the soft fade as content comes into view, the story filter, the forms, the
   slideshows, galleries, announcement bars, popups and add-ons.
   Everything is set up by refresh(), so the page editor in Artiscope Digital Home
   can redraw a page and set it up again. */
(function(){
  var html=document.documentElement,watch=null,keys=false;
  function $(s){return document.querySelector(s)}
  /* The site's fixed words. Edit default text in Artiscope Digital Home keeps changed ones, which the page
     carries in #adh-words (the editor sets window.ADH_WORDS); every call here carries the site's own words. */
  function SW(key,dflt,slots){
    var w=window.ADH_WORDS||null;
    if(!w){try{var el=document.getElementById('adh-words');w=el?JSON.parse(el.textContent):{}}catch(x){w={}}}
    var t=w&&typeof w[key]==='string'&&w[key].trim()?w[key]:dflt;
    Object.keys(slots||{}).forEach(function(k){t=t.split('{'+k+'}').join(slots[k])});
    return t;
  }
  function SWh(key,dflt){return SW(key,dflt).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

  function setMenu(open){
    var sheet=$('#sheet'),menuBtn=$('#menuBtn'),closeBtn=$('#sheetClose');if(!sheet)return;
    sheet.classList.toggle('open',open);html.classList.toggle('menu-open',open);
    if(menuBtn)menuBtn.setAttribute('aria-expanded',open);
    if(open){if(closeBtn)closeBtn.focus()}else if(menuBtn)menuBtn.focus({preventScroll:true});
  }
  function setupMenu(){
    var sheet=$('#sheet'),menuBtn=$('#menuBtn'),closeBtn=$('#sheetClose');
    if(!sheet||!menuBtn||!closeBtn)return;
    menuBtn.addEventListener('click',function(){setMenu(true)});
    closeBtn.addEventListener('click',function(){setMenu(false)});
    sheet.addEventListener('click',function(e){if(e.target.closest('a'))setMenu(false)});
    if(!keys){keys=true;addEventListener('keydown',function(e){var s=$('#sheet');if(e.key==='Escape'&&s&&s.classList.contains('open'))setMenu(false)})}
  }

  function siteName(){var n=document.querySelector('.site-header .wordmark span');return n?n.textContent.trim():document.title.split(' | ')[0]}
  /* The sign-up boxes open the visitor's own email app with a request to join. The site sends and keeps nothing. */
  function setupSignup(){
    document.querySelectorAll('form[data-signup]').forEach(function(f){
      if(f.getAttribute('data-wired'))return;f.setAttribute('data-wired','1');
      var note=f.parentNode.querySelector('.mf-note');
      f.addEventListener('submit',function(e){
        e.preventDefault();var em=f.elements.email,to=f.getAttribute('data-email');
        if(!em.value.trim()||!em.checkValidity()){em.focus();if(note)note.textContent=SW('form.need-email-join','We need a working email address, so we can add you.');return}
        var url='mailto:'+to+'?subject='+encodeURIComponent(SW('form.subject','Join the {site} mailing list',{site:siteName()}))+'&body='+encodeURIComponent('Please add '+em.value.trim()+' to the mailing list.');
        f.setAttribute('data-mailto',url);location.href=url;
        if(note)note.textContent=SW('form.sent-join','Your email app should now be open with the message ready. Send it and we will add you. If nothing opened, write to {email}.',{email:to});
      });
    });
  }

  /* Announcement bars with more than one message show them in turn, pausing while the pointer is over them. */
  var timers=[];
  var still=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setupAnnounce(){
    document.querySelectorAll('[data-announce]').forEach(function(bar){
      var msgs=bar.querySelectorAll('.ann-msg'),count=bar.querySelector('.ann-count'),at=0,hold=false;if(msgs.length<2)return;
      function show(i){at=(i+msgs.length)%msgs.length;msgs.forEach(function(m,k){m.classList.toggle('on',k===at)});if(count)count.textContent=SW('btn.count','{n} of {total}',{n:String(at+1),total:String(msgs.length)})}
      bar.adhShow=function(el){for(var i=0;i<msgs.length;i++)if(msgs[i]===el)show(i)};
      bar.addEventListener('mouseenter',function(){hold=true});bar.addEventListener('mouseleave',function(){hold=false});
      if(!still)timers.push(setInterval(function(){if(!hold&&!html.classList.contains('adh'))show(at+1)},1000*(+bar.dataset.secs||6)));
    });
  }
  /* Slideshows: Previous and Next, and an optional slow turn of their own. */
  function setupSlides(){
    document.querySelectorAll('[data-slides]').forEach(function(box){
      var sl=box.querySelectorAll('.ss-slide'),label=box.querySelector('.ss-at'),at=0;if(sl.length<2)return;
      function show(i){at=(i+sl.length)%sl.length;sl.forEach(function(s,k){s.classList.toggle('on',k===at)});if(label)label.textContent=SW('btn.count','{n} of {total}',{n:String(at+1),total:String(sl.length)})}
      box.adhShow=function(el){for(var k=0;k<sl.length;k++)if(sl[k]===el)show(k)};
      box.addEventListener('click',function(e){var b=e.target.closest('[data-ss]');if(!b)return;show(at+(b.dataset.ss==='next'?1:-1));box.dataset.auto='0'});
      if(!still&&box.dataset.auto==='1')timers.push(setInterval(function(){if(box.dataset.auto==='1'&&!html.classList.contains('adh'))show(at+1)},1000*(+box.dataset.secs||6)));
    });
  }
  /* Galleries: a photo opens larger, with Previous, Next and Close. */
  function setupGalleries(){
    document.querySelectorAll('[data-gallery]').forEach(function(g){
      var items=[].slice.call(g.querySelectorAll('.gl-item'));
      items.forEach(function(it,i){it.addEventListener('click',function(){if(!html.classList.contains('adh'))openBox(items,i)})});
    });
  }
  function openBox(items,i){
    var box=document.createElement('div');box.className='lbox';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',SW('sr.photo-box','Photo'));
    box.innerHTML='<div class="lbox-top"><span class="lbox-at"></span><button type="button" data-lb="close">'+SWh('btn.close','Close')+'</button></div><div class="lbox-pic"></div><div class="lbox-nav"><button type="button" data-lb="prev">'+SWh('btn.previous','Previous')+'</button><span class="lbox-cap"></span><button type="button" data-lb="next">'+SWh('btn.next','Next')+'</button></div>';
    function show(k){i=(k+items.length)%items.length;var it=items[i],pic=it.querySelector('img,.ph');box.querySelector('.lbox-pic').innerHTML=pic?pic.outerHTML:'';box.querySelector('.lbox-at').textContent=SW('btn.count','{n} of {total}',{n:String(i+1),total:String(items.length)});var t=it.querySelector('.gl-t');box.querySelector('.lbox-cap').textContent=t?t.textContent:''}
    function close(){box.remove();html.classList.remove('menu-open');removeEventListener('keydown',key);items[i].focus()}
    function key(e){if(e.key==='Escape')close();if(e.key==='ArrowRight')show(i+1);if(e.key==='ArrowLeft')show(i-1)}
    box.addEventListener('click',function(e){var b=e.target.closest('[data-lb]');if(!b)return;if(b.dataset.lb==='close')close();else show(i+(b.dataset.lb==='next'?1:-1))});
    addEventListener('keydown',key);document.body.appendChild(box);html.classList.add('menu-open');show(i);box.querySelector('[data-lb="close"]').focus();
  }
  /* The contact form opens the visitor's own email app with the message ready to send. The site sends and keeps nothing. */
  function setupMailForms(){
    document.querySelectorAll('form[data-mailform]').forEach(function(form){
      form.addEventListener('submit',function(e){
        e.preventDefault();
        var v=function(n){var el=form.elements[n];return el?el.value.trim():''},note=form.querySelector('.mf-note'),to=form.getAttribute('data-email');
        var say=function(t,bad){if(note){note.textContent=t;note.classList.toggle('err',!!bad)}};
        var email=form.elements.email;
        if(email&&(!email.value.trim()||!email.checkValidity())){email.focus();say(SW('form.need-email','We need a working email address, so we can reply.'),true);return}
        if(form.elements.message&&!v('message')){form.elements.message.focus();say(SW('form.need-message','Please write your message first.'),true);return}
        var subject=(v('topic')||'A message')+' for '+siteName();
        var url='mailto:'+to+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(v('message')+'\n\nName: '+v('name')+'\nEmail: '+v('email'));
        form.setAttribute('data-mailto',url);location.href=url;
        say(SW('form.sent','Your email app should now be open with the message ready. Send it and it reaches us. If nothing opened, write to {email}.',{email:to}));
      });
    });
  }

  /* Each popup shows once a visit, after its delay; Close or Escape puts it away. Never while the page is being edited.
     Its form opens the visitor's own email app, like the sign-up box. */
  function setupPopups(){
    document.querySelectorAll('[data-popup]').forEach(function(p){
      if(p.getAttribute('data-wired'))return;p.setAttribute('data-wired','1');
      var key='site-popup-'+p.id,seen=function(){try{return sessionStorage.getItem(key)==='1'}catch(e){return false}};
      var shut=function(){p.hidden=true};
      p.querySelectorAll('[data-pop-close]').forEach(function(b){b.addEventListener('click',shut)});
      p.addEventListener('keydown',function(e){if(e.key==='Escape')shut()});
      var f=p.querySelector('[data-popform]'),note=p.querySelector('.mf-note');
      if(f)f.addEventListener('submit',function(e){
        e.preventDefault();var em=f.elements.email,to=f.getAttribute('data-email');
        if(!em.value.trim()||!em.checkValidity()){em.focus();if(note)note.textContent=SW('form.need-email-join','We need a working email address, so we can add you.');return}
        var url='mailto:'+to+'?subject='+encodeURIComponent(SW('form.subject','Join the {site} mailing list',{site:siteName()}))+'&body='+encodeURIComponent('Please add '+em.value.trim()+' to the mailing list.');
        f.setAttribute('data-mailto',url);location.href=url;
        if(note)note.textContent=SW('form.sent-join','Your email app should now be open with the message ready. Send it and we will add you. If nothing opened, write to {email}.',{email:to});
      });
      if(window.ADH_EDIT||seen())return;
      setTimeout(function(){if(!window.ADH_EDIT&&!seen()&&document.body.contains(p)){p.hidden=false;try{sessionStorage.setItem(key,'1')}catch(e){}}},(Number(p.getAttribute('data-delay'))||8)*1000);
    });
  }

  // add-ons: the Top button, the reading progress and the privacy notice's Close
  function aoWire() {
    if (typeof window === "undefined") return;
    var tick = function () {
      var t = document.querySelector(".ao-top"); if (t) { t.classList.toggle("on", window.scrollY > (Number(t.getAttribute("data-after")) || 600)); var d = document.getElementById("dock");  }
      var p = document.querySelector(".ao-progress"); if (p) { var h = document.documentElement.scrollHeight - window.innerHeight, f = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0, bar = p.querySelector("i"), n = p.querySelector("b"); if (bar) bar.style.width = (f * 100).toFixed(1) + "%"; if (n) n.textContent = Math.round(f * 100) + "%"; }
    };
    var pv = document.querySelector(".ao-privacy"); if (pv && !window.ADH_EDIT) { try { if (localStorage.getItem("ao-privacy-closed") === "1") pv.hidden = true; } catch (x) { } }
    if (!window.__aoWired) {
      window.__aoWired = true;
      window.addEventListener("scroll", function () { requestAnimationFrame(function () { requestAnimationFrame(tick); }); }, { passive: true }); window.addEventListener("resize", function () { requestAnimationFrame(tick); });
      document.addEventListener("click", function (e) {
        if (window.ADH_EDIT || !e.target.closest) return;
        var c = e.target.closest("[data-ao-close]"); if (c) { var n = c.closest(".ao-privacy"); if (n) n.hidden = true; try { localStorage.setItem("ao-privacy-closed", "1"); } catch (x) { } return; }
        if (e.target.closest(".ao-top")) { e.preventDefault(); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (x) { window.scrollTo(0, 0); } }
      });
    }
    tick();
  }
  /* Soft fade-up as content comes into view, as on The Art Correspondent. Never in the editor or a small
     picture of the site, where everything shows at once, and never for visitors who ask for less motion. */
  function setupReveal(){
    var items=Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if(watch){watch.disconnect();watch=null}
    var still=window.parent!==window||!('IntersectionObserver' in window)||(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if(still){html.classList.remove('js');items.forEach(function(el){el.classList.add('in')});return}
    html.classList.add('js');
    watch=new IntersectionObserver(function(entries){
      var shown=0;
      entries.forEach(function(en){if(!en.isIntersecting)return;en.target.style.setProperty('--wait',(shown*80)+'ms');en.target.classList.add('in');watch.unobserve(en.target);shown+=1});
    },{threshold:0.12,rootMargin:'0px 0px -6% 0px'});
    items.forEach(function(el){watch.observe(el)});
  }
  /* The words above the story cards show only the stories with that small line. */
  function setupFilter(){
    Array.prototype.forEach.call(document.querySelectorAll('.filter'),function(bar){
      var grid=bar.parentNode.querySelector('[data-stories]');if(!grid||bar.getAttribute('data-on'))return;bar.setAttribute('data-on','1');
      bar.addEventListener('click',function(e){
        var b=e.target.closest&&e.target.closest('button[data-filter]');if(!b)return;var want=b.getAttribute('data-filter');
        Array.prototype.forEach.call(bar.querySelectorAll('button'),function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
        Array.prototype.forEach.call(grid.children,function(li){li.hidden=!!want&&li.getAttribute('data-kind')!==want});
        grid.classList.toggle('is-filtered',!!want);
      });
    });
  }
  function refresh(){timers.forEach(clearInterval);timers=[];setupReveal();setupFilter();aoWire();setupMenu();setupSignup();setupAnnounce();setupSlides();setupGalleries();setupMailForms();setupPopups()}
  window.SiteJS={refresh:refresh};
  refresh();
})();

/* lets Artiscope Digital Home redraw any page as it is edited, and pick or follow what is clicked */
(function () {
  var ok = "https://artiscope.github.io", active = false, me = document.currentScript;
  if (window.parent === window) { return; }
  var ROOT = new URL(".", new URL("..", (me && me.src) || location.href)).href;
  var BLOCKS = { header: ".site-nav a", footer: ".footer-nav a" };
  var view = { kind: "page", key: "home" }, types = {}, grp = {}, tsec = {};
  function loadRender(done) {
    if (window.TAC) { done(); return; }
    var s = document.createElement("script"); s.src = ROOT + "assets/render.js"; s.onload = done; document.head.appendChild(s);
  }
  function style() {
    if (document.getElementById("adh-style")) { return; }
    var st = document.createElement("style"); st.id = "adh-style";
    st.textContent = ".adh-picked{outline:2px dashed #8EC5FF;outline-offset:-2px}.adh-picked-block{outline:2px solid #8EC5FF;outline-offset:3px;position:relative}" +
      ".adh-picked-block[data-adh-label]::before{content:attr(data-adh-label);position:absolute;left:0;top:-30px;z-index:2147482000;background:#8EC5FF;color:#0E1A26;font:600 12px/1 'Libre Franklin',Arial,sans-serif;padding:6px 10px;border-radius:7px;white-space:nowrap;pointer-events:none}";
    document.head.appendChild(st);
  }
  function draw(m) {
    // the words changed in Edit default text, for the words this script writes itself
    window.ADH_WORDS = m.pages && m.pages.words && typeof m.pages.words === "object" ? m.pages.words : {};
    var site = window.TAC.Site(m.data, m.pages, "", { mark: true, show: m.show || "", social: m.social || {}, tpl: m.tpl || null, imageSrc: function (name) { return (m.images || {})[name] || ROOT + "assets/images/" + name; } });
    var at = m.at || { kind: "page", key: "home" }, out = null;
    if (at.kind === "artist") { out = site.artistPage(at.key); }
    else if (at.kind === "article") { out = site.articlePage(at.key); }
    else if (at.kind === "list") { out = site.listPage(at.key); }
    else if (m.pages.pages[at.key]) { out = site.sectionsPage(at.key); }
    if (!out) { out = site.notFound(); }
    view = at; types = {};
    (((m.pages.pages || {})[at.key] || {}).sections || []).forEach(function (x) { types[x.id] = x.type; });
    grp = {}; ["top", "popups", "bottom"].forEach(function (w) { (((m.pages.groups || {})[w]) || []).forEach(function (x) { types[x.id] = x.type; grp[x.id] = 1; }); });
    tsec = {}; if (at.kind === "article" || at.kind === "artist") { var tall = ((m.pages.templates || {})[at.kind]) || {}, tid = m.tpl && m.tpl.kind === at.kind && tall[m.tpl.id] ? m.tpl.id : ((((m.pages.assign || {})[at.kind]) || {})[at.key] || "default"); (((tall[tid] || tall["default"] || {}).sections) || []).forEach(function (x) { if (x.type !== "main") { types[x.id] = x.type; tsec[x.id] = 1; } }); }
    var moved = out.path !== draw.path; draw.path = out.path;
    var base = document.querySelector("base[data-adh]");
    if (!base) { base = document.createElement("base"); base.setAttribute("data-adh", ""); document.head.insertBefore(base, document.head.firstChild); }
    base.href = ROOT + out.path.replace(/[^\/]*$/, "");
    var doc = new DOMParser().parseFromString(out.html, "text/html");
    doc.querySelectorAll("script").forEach(function (x) { x.remove(); });
    var t = doc.querySelector("title"); if (t) { document.title = t.textContent; }
    var oldCss = document.head.querySelector("style[data-sec-css]"), newCss = doc.head.querySelector("style[data-sec-css]");
    if (oldCss) { oldCss.remove(); }
    if (newCss) { document.head.appendChild(newCss); }
    var y = window.scrollY;
    document.body.innerHTML = doc.body.innerHTML;
    if (window.SiteJS) { window.SiteJS.refresh(); }
    if (moved) { window.scrollTo(0, 0); } else { window.scrollTo(0, y); }
    return moved;
  }
  function sectionEl(id) {
    if (id === "header") { return document.querySelector("header#nav"); }
    if (id === "footer") { return document.querySelector("footer.foot"); }
    return document.querySelector('[data-adh="' + id + '"]');
  }
  function blockEls(id) {
    var el = sectionEl(id), sel = BLOCKS[id === "header" || id === "footer" ? id : types[id]];
    return el && sel ? [].slice.call(el.querySelectorAll(sel)) : [];
  }
  // a block the page tags with its kind and place, so hidden ones never shift the count
  function tagged(el, bf, block) { if (!el || !bf) { return null; } return el.querySelector('[data-adh-b="' + bf + "." + block + '"]'); }
  function pick(id, block, label, scroll, bf, bi) {
    document.querySelectorAll(".adh-picked,.adh-picked-block,[data-adh-label]").forEach(function (x) { x.classList.remove("adh-picked", "adh-picked-block"); x.removeAttribute("data-adh-label"); });
    document.querySelectorAll("[data-popup]").forEach(function (p) { p.hidden = true; });
    if (!id) { return; }
    var el = sectionEl(id); if (!el) { return; }
    if (el.hasAttribute("data-popup")) { el.hidden = false; }
    var target = el;
    if ((block != null && block >= 0) || (bf && bi >= 0)) { var b = (bf && bi >= 0 ? tagged(el, bf, bi) : null) || (block >= 0 ? blockEls(id)[block] : null); if (b) { var bar = b.closest("[data-announce],[data-slides]"); if (bar && bar.adhShow) { bar.adhShow(b); } el.classList.add("adh-picked"); b.classList.add("adh-picked-block"); target = b; } else { el.classList.add("adh-picked-block"); } }
    else { el.classList.add("adh-picked-block"); }
    if (label) { target.setAttribute("data-adh-label", label); }
    if (scroll) { var r0 = target.getBoundingClientRect(), y0 = window.pageYOffset + r0.top - (r0.height < window.innerHeight ? (window.innerHeight - r0.height) / 2 : 20); try { window.scrollTo({ top: Math.max(0, y0), behavior: "smooth" }); } catch (x) { window.scrollTo(0, Math.max(0, y0)); } }
  }
  // Edit default text: "Show me where" outlines the first place on this page that shows a word.
  // A word with slots ({n} of {total}) matches whatever the site filled in. The text of a whole
  // element is tried first, so "Close" does not match inside a longer line.
  function findClear() {
    var t = document.getElementById("adh-found-tag"); if (t) { t.remove(); }
    Array.prototype.forEach.call(document.querySelectorAll(".adh-found"), function (x) { x.classList.remove("adh-found"); });
  }
  function findWord(text, label) {
    findClear();
    var t = String(text || "").replace(/\s+/g, " ").trim(); if (!t) { return 0; }
    var body = t.split(/\{[a-z]+\}/).map(function (p) { return p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join(".+?");
    var exact = new RegExp("^" + body + "$"), part = new RegExp(body), hit = null, loose = null;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (var n = walker.nextNode(); n && !hit; n = walker.nextNode()) {
      var el = n.parentElement; if (!el || el.closest("#adh-hover, #adh-found-tag, script, style, noscript")) { continue; }
      var r = el.getBoundingClientRect(); if (!r.width || !r.height) { continue; }
      var own = n.nodeValue.replace(/\s+/g, " ").trim(), all = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (exact.test(own) || exact.test(all)) { hit = el; } else if (!loose && part.test(own)) { loose = el; }
    }
    hit = hit || loose; if (!hit) { return 0; }
    if (!document.getElementById("adh-found-css")) { var st = document.createElement("style"); st.id = "adh-found-css"; st.textContent = ".adh-found{outline:2px solid #8EC5FF!important;outline-offset:3px;border-radius:4px}#adh-found-tag{position:absolute;z-index:2147483000;background:#8EC5FF;color:#0E1A26;font:600 12px/1 'Libre Franklin',Arial,sans-serif;padding:6px 10px;border-radius:7px;white-space:nowrap;pointer-events:none}"; document.head.appendChild(st); }
    hit.classList.add("adh-found");
    var b = hit.getBoundingClientRect(), y = window.pageYOffset + b.top - Math.max(80, (window.innerHeight - b.height) / 2);
    window.scrollTo(0, Math.max(0, y));
    var tag = document.createElement("div"); tag.id = "adh-found-tag"; tag.textContent = label || t;
    tag.style.left = Math.max(4, window.pageXOffset + b.left - 2) + "px"; tag.style.top = Math.max(4, window.pageYOffset + b.top - 32) + "px";
    document.body.appendChild(tag);
    return 1;
  }
  window.addEventListener("message", function (e) {
    if (e.origin !== ok || !e.data) { return; }
    if (!active) { active = true; window.ADH_EDIT = true; document.querySelectorAll("[data-popup]").forEach(function (p) { p.hidden = true; }); document.documentElement.classList.add("adh"); style(); }
    if (e.data.type === "adh-pages" && e.data.data && e.data.pages) {
      findClear();
      var m = e.data; NAMES = m.names || {}; hoverOff();
      loadRender(function () { var moved = false; try { moved = draw(m); } catch (x) { } pick(m.pick, m.block, m.label, m.scroll || moved, m.bf, m.bi); });
      return;
    }
    if (e.data.type === "adh-pick") { pick(e.data.id, e.data.block, e.data.label, true, e.data.bf, e.data.bi); }
    if (e.data.type === "adh-find") { var found = findWord(e.data.text, e.data.label); window.parent.postMessage({ type: "adh-found", key: e.data.key, found: found }, ok); }
  });
  function whatAt(t) {
    var id = "", block = -1, bf = "";
    if (t.closest("header#nav, #sheet")) { id = "header"; }
    else if (t.closest("footer.foot")) { id = "footer"; }
    else { var sec = t.closest("[data-adh]"); if (sec) { id = sec.getAttribute("data-adh"); } }
    if (!id) { return null; }
    var host = sectionEl(id); if (!host) { return null; }
    var el = host, tag = t.closest("[data-adh-b]");
    if (tag && host.contains(tag)) { var bp = tag.getAttribute("data-adh-b").split("."); bf = bp[0]; block = Number(bp[1]); el = tag; }
    return { id: id, block: block, bf: bf, view: grp[id] ? "every" : tsec[id] ? "tpl" : view.kind, el: el, plus: !!bf || (id !== "header" && id !== "footer" && (!!grp[id] || !!tsec[id] || view.kind === "page")) };
  }
  /* the inspector: an outline and a name tag on whatever the pointer is over, with a plus above and below to add something just there */
  var NAMES = {}, hov = null, hovBox = null, hovRaf = 0;
  function hoverStyle() {
    if (document.getElementById("adh-hover-style")) { return; }
    var st = document.createElement("style"); st.id = "adh-hover-style";
    st.textContent = "#adh-hover{position:absolute;z-index:2147483000;pointer-events:none;outline:2px solid #8EC5FF;outline-offset:2px;display:none}#adh-hover.on{display:block}#adh-hover.blk{outline-style:dashed}" +
      "#adh-hover .adh-tag{position:absolute;left:-2px;top:-30px;background:#8EC5FF;color:#0E1A26;font:600 12px/1 'Libre Franklin',Arial,sans-serif;padding:6px 10px;border-radius:7px;white-space:nowrap}#adh-hover.inside .adh-tag{top:6px;left:6px}" +
      "#adh-hover .adh-plus{pointer-events:auto;position:absolute;left:50%;width:28px;height:28px;margin-left:-14px;padding:0;border:0;border-radius:50%;background:#8EC5FF;color:#0E1A26;font:600 18px/28px Arial,sans-serif;text-align:center;box-shadow:none;cursor:pointer}" +
      "#adh-hover .adh-plus.top{top:-16px}#adh-hover .adh-plus.bottom{bottom:-16px}#adh-hover.noplus .adh-plus{display:none}#adh-hover .adh-plus:hover{background:#7CB9F7;color:#0E1A26}";
    document.head.appendChild(st);
  }
  function hoverBox() {
    if (hovBox && hovBox.parentNode) { return hovBox; }
    hoverStyle();
    hovBox = document.createElement("div"); hovBox.id = "adh-hover";
    hovBox.innerHTML = '<span class="adh-tag"></span><button type="button" class="adh-plus top" tabindex="-1" title="Add here, above" aria-label="Add here, above">+</button><button type="button" class="adh-plus bottom" tabindex="-1" title="Add here, below" aria-label="Add here, below">+</button>';
    document.documentElement.appendChild(hovBox); return hovBox;
  }
  /* tell the console what the pointer is over, so the matching row in its list lights up */
  var overKey = "";
  function overSay(w) {
    var k = w ? w.id + "|" + w.bf + "|" + w.block + "|" + w.view : "";
    if (k === overKey) { return; }
    overKey = k;
    try { window.parent.postMessage({ type: "adh-over", id: w ? w.id : "", block: w ? w.block : -1, bf: w ? w.bf : "", view: w ? w.view : "" }, ok); } catch (x) { /* the console has gone */ }
  }
  function hoverOff() { if (hovBox) { hovBox.className = ""; } hov = null; overSay(null); }
  function hoverAt(target) {
    if (!active || !target || !target.closest) { return; }
    if (target.closest("#adh-hover")) { return; }
    var w = null; try { w = whatAt(target); } catch (x) { w = null; }
    if (!w || !w.el) { hoverOff(); return; }
    var r = w.el.getBoundingClientRect(); if (!r.width || !r.height) { hoverOff(); return; }
    var box = hoverBox(); hov = w;
    box.style.left = (r.left + window.scrollX) + "px"; box.style.top = (r.top + window.scrollY) + "px"; box.style.width = r.width + "px"; box.style.height = r.height + "px";
    box.querySelector(".adh-tag").textContent = w.bf ? (NAMES[w.id + ":" + w.bf] || "Block") : (NAMES[w.id] || "Section");
    box.className = "on" + (w.bf ? " blk" : "") + (w.plus ? "" : " noplus") + (r.top < 34 ? " inside" : "");
    overSay(w);
  }
  document.addEventListener("mousemove", function (e) { if (!active) { return; } var t = e.target; cancelAnimationFrame(hovRaf); hovRaf = requestAnimationFrame(function () { hoverAt(t); }); }, true);
  document.documentElement.addEventListener("mouseleave", hoverOff);
  window.addEventListener("scroll", function () { if (!hov || !hovBox) { return; } var r = hov.el.getBoundingClientRect(); if (!r.width) { hoverOff(); return; } hovBox.style.left = (r.left + window.scrollX) + "px"; hovBox.style.top = (r.top + window.scrollY) + "px"; }, true);
  function plusClick(e) {
    e.preventDefault(); e.stopPropagation();
    var b = e.target.closest(".adh-plus"); if (!b || !hov) { return; }
    window.parent.postMessage({ type: "adh-add", id: hov.id, block: hov.block, bf: hov.bf, view: hov.view, edge: b.classList.contains("top") ? "top" : "bottom" }, ok);
    hoverOff();
  }
  // A click on a link inside the site goes to that page; anything else, or a click with Alt held, picks what was clicked.
  document.addEventListener("click", function (e) {
    if (!active) { return; }
    if (e.target.closest && e.target.closest("#adh-hover")) { plusClick(e); return; }
    e.preventDefault(); e.stopPropagation();
    var link = e.target.closest("a[href]");
    if (link && !e.altKey) {
      var u; try { u = new URL(link.getAttribute("href"), document.baseURI); } catch (x) { u = null; }
      if (u && u.href.indexOf(ROOT) === 0) { window.parent.postMessage({ type: "adh-nav", path: u.href.slice(ROOT.length).split("#")[0].split("?")[0] }, ok); return; }
    }
    var id = "", block = -1;
    if (e.target.closest("header#nav, #sheet")) { id = "header"; }
    else if (e.target.closest("footer.foot")) { id = "footer"; }
    else { var sec = e.target.closest("[data-adh]"); if (sec) { id = sec.getAttribute("data-adh"); } }
    if (!id) { return; }
    var bf = "", tag = e.target.closest("[data-adh-b]");
    if (tag) { var bp = tag.getAttribute("data-adh-b").split("."); bf = bp[0]; block = Number(bp[1]); }
    else { var list = blockEls(id); for (var i = 0; i < list.length; i++) { if (list[i].contains(e.target)) { block = i; break; } } }
    window.parent.postMessage({ type: "adh-click", id: id, block: block, bf: bf, view: grp[id] ? "every" : tsec[id] ? "tpl" : view.kind }, ok);
  }, true);
})();

/* lets Artiscope Digital Home preview a theme before it is published */
(function(){var ok="https://artiscope.github.io";if(window.parent===window)return;window.addEventListener("message",function(e){if(e.origin!==ok||!e.data)return;if(e.data.type==="adh-hello"){e.source.postMessage({type:"adh-ready"},ok);return;}if(e.data.type!=="adh-theme")return;var s=document.getElementById("adh-theme-preview");if(!s){s=document.createElement("style");s.id="adh-theme-preview";document.head.appendChild(s);}s.textContent=String(e.data.css||"");(e.data.fonts||[]).forEach(function(u){if(typeof u!=="string"||u.indexOf("https://fonts.googleapis.com/css2?")!==0)return;var had=false;Array.prototype.forEach.call(document.querySelectorAll("link[data-adh]"),function(l){if(l.getAttribute("data-adh")===u)had=true;});if(had)return;var l=document.createElement("link");l.rel="stylesheet";l.href=u;l.setAttribute("data-adh",u);document.head.appendChild(l);});});})();
