// Every section kind of each site, twice, on a brand-new page made in the console, at computer and phone size.
// Fails if any is not drawn, if two parts of the page share a name, if anything is too wide on a phone, or on any error.
import fs from "node:fs"; import { spawn, execFileSync } from "node:child_process"; import { W_DIR, G_DIR, C_DIR, chromeOptions } from "./where.mjs";
import { createRequire } from "node:module"; const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
const A = 8831, G = 8832, B = 8833, consoleAt = "http://localhost:" + B, warAt = "http://localhost:" + A + "/", gamAt = "http://localhost:" + G + "/";
fs.rmSync("/tmp/ev-war", { recursive: true, force: true }); execFileSync("python3", [W_DIR + "/tools/build_site.py", "/tmp/ev-war"]);
fs.writeFileSync("/tmp/ev-war/index.html", fs.readFileSync("/tmp/ev-war/index.html", "utf8").split('var ok="https://artiscope.github.io"').join('var ok="' + consoleAt + '"'));
fs.rmSync("/tmp/ev-gam", { recursive: true, force: true }); fs.cpSync(G_DIR, "/tmp/ev-gam", { recursive: true, filter: (p) => !p.includes("/.git") });
execFileSync("node", ["/tmp/ev-gam/tools/build.mjs"]);
fs.writeFileSync("/tmp/ev-gam/assets/site.js", fs.readFileSync("/tmp/ev-gam/assets/site.js", "utf8").split('"https://artiscope.github.io"').join('"' + consoleAt + '"'));
const servers = [["/tmp/ev-war", A], ["/tmp/ev-gam", G], [C_DIR, B]].map(([d, p]) => spawn("python3", ["-m", "http.server", String(p), "-d", d], { stdio: "ignore" }));
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch(chromeOptions()); const problems = [];
const only = process.env.SITE || "world-art-review,global-art-monitor";
try {
  for (const siteKey of only.split(",")) {
    const page = await browser.newPage({ viewport: { width: 1500, height: 960 } });
    const errors = []; page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push("console: " + m.text()); });
    await page.route((u) => !u.hostname.includes("localhost"), (r) => r.abort());
    await page.goto(consoleAt + "/index.html?demo&preview=" + encodeURIComponent(warAt) + "&gampreview=" + encodeURIComponent(gamAt));
    await page.waitForSelector('[data-act="open-site"]'); await page.click('[data-act="open-site"][data-site="' + siteKey + '"]');
    await page.waitForSelector("#ed-sections .sec"); await page.waitForTimeout(2500);
    await page.click('[data-act="ed-new"]'); await page.click('[data-act="ed-new"][data-what="page"]'); await page.fill("#nw-title", "Every section"); await page.click('form[data-form="ednew"] button[type=submit]'); await page.waitForTimeout(1500);
    await page.click('.addl[data-act="ed-secpicker"]'); await page.waitForSelector(".pk-item");
    const keys = await page.$$eval(".pk-item", (b) => b.map((x) => x.dataset.key)); await page.click('[data-act="ed-pick-close"] >> nth=-1').catch(() => page.keyboard.press("Escape"));
    for (const round of [1, 2]) for (const k of keys) { await page.click('.addl[data-act="ed-secpicker"]'); await page.click('.pk-item[data-key="' + k + '"]'); await page.waitForTimeout(120); }
    await page.waitForTimeout(2500);
    const frame = page.frames().find((f) => f.url().startsWith(siteKey === "world-art-review" ? warAt : gamAt));
    const listed = await page.$$eval("#ed-sections .sec:not(.blk)", (r) => r.map((x) => x.dataset.id));
    const info = await frame.evaluate((listed) => {
      const ids = [...document.querySelectorAll("[id]")].map((e) => e.id), dup = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
      const marked = listed.map((id) => { const e = document.querySelector('[data-adh="' + id + '"]') || document.getElementById(id); return e ? [id, Math.round(e.getBoundingClientRect().height)] : null; }).filter(Boolean);
      return { dup, marked, heads: document.querySelectorAll("header.hdr, header.site-head").length, w: document.documentElement.scrollWidth };
    }, listed);
    const empty = info.marked.filter((m) => m[1] < 20 && m[0] !== "header" && m[0] !== "footer").map((m) => m[0]);
    const missing = listed.filter((id) => !info.marked.some((m) => m[0] === id));
    console.log(siteKey, "types", keys.length, "sections listed", listed.length, "drawn", info.marked.length, "| duplicate ids", JSON.stringify(info.dup), "| menu bars", info.heads, "| width", info.w);
    console.log("  not drawn:", JSON.stringify(missing), " nearly empty:", JSON.stringify(empty));
    if (missing.length || empty.length || info.dup.length || info.heads !== 1) problems.push(siteKey + ": drawing");
    // phone size
    await page.click('[data-act="ed-mode"][data-mode="phone"]'); await page.waitForTimeout(1500);
    const pw = await frame.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth, [...document.querySelectorAll("main > *, #main > *, body > section")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).map((e) => e.id || e.getAttribute("data-adh") || e.className)]);
    console.log("  phone width", pw[0], "of", pw[1], "too wide:", JSON.stringify(pw[2]));
    if (pw[0] > pw[1] || pw[2].length) problems.push(siteKey + ": too wide on a phone");
    for (const [i, frac] of [[1, 0.1], [2, 0.35], [3, 0.6], [4, 0.85]].entries ? [[1, 0.1], [2, 0.35], [3, 0.6], [4, 0.85]] : []) {
      await frame.evaluate((f) => window.scrollTo(0, document.documentElement.scrollHeight * f), frac); await page.waitForTimeout(700);
      await page.screenshot({ path: "/tmp/look/every-" + siteKey.slice(0, 3) + "-p" + i + ".png", clip: { x: 340, y: 50, width: 790, height: 900 } });
    }
    console.log("  errors", JSON.stringify(errors.slice(0, 5)));
    if (errors.length) problems.push(siteKey + ": errors");
    await page.close();
  }
  if (problems.length) { console.log("EVERY SECTION CHECK FAILED: " + problems.join(", ")); process.exitCode = 1; } else console.log("EVERY SECTION CHECKS PASSED");
} finally { await browser.close(); servers.forEach((s) => s.kill()); }
