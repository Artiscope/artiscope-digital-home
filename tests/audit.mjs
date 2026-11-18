// The usability walk: every screen of the console, as the admin and as an editor, at computer and
// phone width. For each screen it records what a person would trip over: errors, sideways scrolling,
// controls too small to hit, controls with no name, boxes with no label, words too faint to read,
// technical words, leaked "undefined" or "null", and pictures with no description.
// Run through tests/uat.mjs with AUDIT=1, so it uses the real server code and the real sites.
import fs from "node:fs";

const JARGON = /\b(repositor(?:y|ies)|repo|branch(?:es)?|commits?|merge[sd]?|pull requests?|deploy(?:ed|ment)?|workflows?|JSON|API|tokens?|slug|endpoint|schema|stack trace|exception|HTTP|status code|42501|403|404|409|422|500|502)\b/i;
const LEAK = /\b(undefined|NaN)\b|\[object Object\]|\bnull\b/;

// Runs inside the page: everything a person can see and use, measured.
function measure() {
  const out = { overflow: document.documentElement.scrollWidth > innerWidth + 1, small: [], unnamed: [], unlabelled: [], faint: [], jargon: [], leaks: [], noAlt: [] };
  const seen = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); const shut = el.closest("details:not([open])"); if (shut && !(el.tagName === "SUMMARY" && el.parentElement === shut)) return false; return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05 && r.bottom > 0 && r.right > 0 && r.left < innerWidth; };
  const say = (el) => { const t = (el.getAttribute("aria-label") || el.innerText || el.value || el.title || el.placeholder || "").replace(/\s+/g, " ").trim(); return el.tagName.toLowerCase() + (el.dataset.act ? "[" + el.dataset.act + "]" : el.dataset.tab ? "[tab " + el.dataset.tab + "]" : el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "") + (t ? ' "' + t.slice(0, 40) + '"' : ""); };
  const named = (el) => !!((el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.innerText || el.title || el.value || "").trim() || el.querySelector("img[alt]:not([alt=''])"));
  for (const el of document.querySelectorAll("button, a[href], [role=button], [role=tab], [role=radio], summary, input:not([type=hidden]), select, textarea")) {
    if (!seen(el)) continue;
    const r = el.getBoundingClientRect(), box = ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName);
    if (box) { if (!(el.labels && el.labels.length) && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.title) out.unlabelled.push(say(el)); }
    else if (!named(el)) out.unnamed.push(say(el));
    // links inside running text are exempt; everything else should be at least 24 by 24 (44 on a phone is better)
    const inText = el.tagName === "A" && getComputedStyle(el).display === "inline" && el.parentElement && /^(P|LI|SPAN|SMALL|LABEL|DD)$/.test(el.parentElement.tagName);
    if (!inText && el.type !== "checkbox" && el.type !== "radio" && (r.width < 24 || r.height < 24)) out.small.push(say(el) + " " + Math.round(r.width) + "x" + Math.round(r.height));
  }
  const rgbOf = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; let v = m.map(Number); if (/^color\(srgb/.test(c)) v = [v[0] * 255, v[1] * 255, v[2] * 255, v.length > 3 ? v[3] : 1]; return v; };
  const lum = (c) => { const m = rgbOf(c); if (!m) return null; const [r, g, b, a] = m; if (a === 0) return null; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage && cs.backgroundImage !== "none") return null; const m = rgbOf(cs.backgroundColor); if (m && (m.length < 4 || +m[3] > 0.9)) return cs.backgroundColor; } return "rgb(255,255,255)"; };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const done = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.replace(/\s+/g, " ").trim(); if (!t) continue;
    const el = n.parentElement; if (!el || done.has(el) || !seen(el) || el.closest("script,style,code,pre,.cm,.code-area,textarea")) continue;
    done.add(el);
    const cs = getComputedStyle(el); if (el.closest("[disabled],[aria-disabled=true]")) continue;
    if (JARGON_RE.test(t)) out.jargon.push(t.slice(0, 110));
    if (LEAK_RE.test(t)) out.leaks.push(t.slice(0, 110));
    const bg = bgOf(el), a = lum(cs.color), b = bg && lum(bg);
    if (a != null && b != null) {
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 600;
      const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      if (ratio < need - 0.05) out.faint.push(ratio.toFixed(2) + " " + Math.round(size) + "px \"" + t.slice(0, 40) + "\"");
    }
  }
  for (const im of document.querySelectorAll("img")) if (seen(im) && !im.hasAttribute("alt")) out.noAlt.push(im.src.split("/").pop());
  return out;
}

export async function runAudit(x) {
  const { page, shot, settle, openSite, goTab } = x;
  const report = [], errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  const src = measure.toString().replace("JARGON_RE", JARGON.toString()).replace("LEAK_RE", LEAK.toString()).replace("JARGON_RE", JARGON.toString()).replace("LEAK_RE", LEAK.toString());
  async function look(name, who = "admin") {
    for (const [w, h, size] of [[1440, 900, "computer"], [390, 844, "phone"]]) {
      await page.setViewportSize({ width: w, height: h }); await settle(700);
      const before = errs.length;
      const m = await page.evaluate("(" + src + ")()");
      const file = "audit-" + name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + "-" + size;
      await shot(file);
      report.push({ screen: name, who, size, shot: file, errors: errs.slice(before), ...m });
    }
    await page.setViewportSize({ width: 1440, height: 900 }); await settle(500);
  }
  const step = async (name, fn, who) => { try { await fn(); await look(name, who); } catch (e) { report.push({ screen: name, who: who || "admin", size: "both", failed: String(e.message || e).split("\n")[0].slice(0, 200) }); await shot("audit-failed-" + name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()).catch(() => {}); } };
  const home = async () => { await page.click(".ed-exit", { timeout: 800 }).catch(() => {}); await page.click('[data-tab="home"]', { timeout: 2000 }).catch(() => {}); await page.waitForSelector('[data-act="open-site"]', { timeout: 15000 }); await settle(800); };

  await step("All sites", home);
  await step("People", async () => { await home(); await page.click('.navb[data-tab="people"]'); await settle(900); });
  for (const id of ["world-art-review", "global-art-monitor", "street-art-dispatch", "practice-site", "practice-build"]) {
    await step(id + ": page editor", async () => { await openSite(id); await settle(1500); });
    await step(id + ": a section picked", async () => { await page.click("#ed-sections .sec:not(.blk) >> nth=2"); await settle(900); });
    await step(id + ": Add a section", async () => { await page.click('.addl[data-act="ed-secpicker"] >> nth=0'); await settle(700); });
    await page.keyboard.press("Escape"); await settle(300);
    await step(id + ": page picker", async () => { await page.click(".ed-pagebtn"); await settle(600); });
    await page.keyboard.press("Escape"); await settle(300);
    await step(id + ": Theme settings", async () => { await page.click('[data-act="ed-panel"][data-panel="theme"]').catch(async () => { await page.keyboard.press("Control+Alt+2"); }); await settle(900); });
    await step(id + ": Add-ons", async () => { await page.click('[data-act="ed-panel"][data-panel="addons"]').catch(async () => { await page.keyboard.press("Control+Alt+3"); }); await settle(900); });
    await page.click('[data-act="ed-panel"][data-panel="sections"]').catch(() => {});
    for (const tab of ["overview", "content", "theme", "files", "photos", "versions", "history"]) {
      await step(id + ": " + tab, async () => {
        if (await page.isVisible(".ed-exit")) { await page.click(".ed-exit"); await page.waitForSelector('.navb[data-tab="overview"]'); }
        if (!(await page.isVisible('.navb[data-tab="' + tab + '"]'))) throw new Error("no " + tab + " screen on this site");
        await page.click('.navb[data-tab="' + tab + '"]'); await settle(1100);
      });
    }
  }
  await step("Edit code", async () => { await openSite("street-art-dispatch"); await page.click('[data-act="ed-pop"][data-menu="more"]'); await page.click('[data-act="code-open"]'); await settle(1500); });
  await page.click('[data-act="code-back"]').catch(() => {});
  for (const n of [1, 2, 3, 4]) {
    await step("Start building, step " + n, async () => {
      if (n === 1) { await home(); await page.click('[data-act="open-site"][data-site="site-4"]'); await page.waitForSelector('[data-bd="name"]'); await settle(1500); await page.fill('[data-bd="name"]', "Grove Prints"); await settle(900); }
      else { await page.click('[data-act="bd-next"]'); await settle(1200); }
    });
  }
  await page.click('[data-act="bd-close"]').catch(() => {});
  await step("Start building, ready", async () => {
    await openSite("practice-build"); await page.click(".ed-exit"); await page.click('.navb[data-tab="overview"]'); await settle(500);
    await page.click('[data-act="bd-start"]'); await page.waitForSelector('[data-bd="name"]'); await page.fill('[data-bd="name"]', "Practice gallery"); await settle(900);
    for (let i = 0; i < 3; i++) { await page.click('[data-act="bd-next"]'); await settle(500); }
    await page.click('[data-act="bd-create"]'); await page.waitForSelector("text=is on the practice build", { timeout: 15000 }); await settle(600);
  });
  await page.click('[data-act="bd-close"]').catch(() => {});
  // an editor: one person given World Art Review only
  x.ppl.table.push({ email: "eddie@example.org", id: "0e1d2c3b4a", name: "Eddie", sites: ["world-art-review"], invited_at: new Date().toISOString(), last_seen: null });
  x.setSignedIn("eddie@example.org");
  await step("Editor: All sites", async () => { await page.goto(x.consoleAt + "/index.html"); await page.waitForSelector('[data-act="open-site"]', { timeout: 15000 }); await settle(900); }, "editor");
  await step("Editor: opening a site", async () => { await page.click('[data-act="open-site"][data-site="world-art-review"]'); await settle(1500); }, "editor");
  await step("Signed out", async () => { await page.click(".acct summary").catch(() => {}); await page.click('[data-act="signout"]'); await settle(900); }, "nobody");
  fs.writeFileSync("/tmp/uat/audit.json", JSON.stringify(report, null, 1));
  return report;
}
