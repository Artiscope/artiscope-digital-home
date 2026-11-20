// Every site template, end to end: a new site is planned from each the way Start building plans it (its own
// name, tagline and email, in its own look and in a ready-made one), built the way publishing builds it, and
// every page it has is opened at computer and phone size. Fails on any error on a page, a missing file, a link
// to a page that does not exist, anything too wide on a phone, a long dash, a US spelling, a word of any of
// the original sites, or a page that search engines are not told to leave alone.
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
import { createRequire } from "node:module"; import { C_DIR, chromeOptions } from "./where.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
globalThis.Deno = { env: { get: () => "" }, serve() {} };
const h = await import(new URL("./home.mjs", import.meta.url));

const ORIGINAL = /World Art Review|Global Art Monitor|Street Art Dispatch|worldartreview|globalartmonitor|streetartdispatch|grovegallery|Grove Gallery|Konn|Zara Muse|Zen Xander|Banksy|Invader|Shepard Fairey|Tate Ward|Frieze/;
const US = /\b(colors?|center(ed|s)?|favorites?|organiz\w*|analyz\w*|gray|catalog|behaviors?)\b/i;
const NAME = "Wall and Page", TAG = "Art looked at closely", EMAIL = "hello@wallandpage.org";
const WAR_ROUTES = ["", "#artists", "#reviews", "#explained", "#library", "#guides", "#standards", "#research", "#search"];
const OUT = "/tmp/look/templates"; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
let passed = 0, total = 0; const problems = [];
const ok = (cond, what) => { total++; if (cond) passed++; else problems.push(what); };

const ready = h.SITE_TEMPLATES.filter((t) => t.ready);
const browser = await chromium.launch(chromeOptions());
try {
  for (const t of ready) {
    const looks = h.buildLooks(t.id), pick = [looks[0], looks.find((l) => l.name === (looks[0].name === "Ink and clay" ? "Paper and ink" : "Ink and clay"))];
    for (const look of pick) {
      const label = t.id + " in " + look.name;
      // plan as Start building does, then build as publishing does
      const F = t.files || { pages: "data/pages.json", theme: "data/theme.json", content: "data/content.json" };
      const dir = path.join(C_DIR, t.dir), read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const c = h.cleanBuild({ name: NAME, tagline: TAG, email: EMAIL, template: t.id, look: look.name, pages: "set" }, { name: "Site 4" });
      const plan = h.planFiles(c, "https://artiscope.github.io/wall-and-page/", null, t.id === "starter" ? null : { pages: read(F.pages), content: read(F.content) });
      const src = "/tmp/tpl-src", out = "/tmp/tpl-out"; fs.rmSync(src, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true });
      fs.cpSync(dir, src, { recursive: true });
      for (const [k, v] of Object.entries({ [F.pages]: plan.pages, [F.theme]: plan.theme, [F.content]: plan.content })) fs.writeFileSync(path.join(src, k), JSON.stringify(v, null, 2));
      execFileSync("python3", [src + "/tools/build.py", out], { stdio: "pipe" });
      ok(fs.readFileSync(out + "/robots.txt", "utf8").includes("Disallow: /") && !fs.existsSync(out + "/CNAME"), label + ": search engines are not told to stay away");
      const files = fs.readdirSync(out, { recursive: true }).map(String).filter((f) => f.endsWith(".html")).sort((a, b) => (a === "index.html" ? -1 : b === "index.html" ? 1 : a.localeCompare(b)));
      // served at the GitHub address it will have before its own domain is connected, from the built folder
      const at = "https://artiscope.github.io/wall-and-page/";
      const routes = t.page ? WAR_ROUTES.map((r) => "index.html" + r) : t.id === "world-art-review" ? WAR_ROUTES.map((r) => "index.html" + r) : files;
      for (const [w, hgt] of [[1440, 900], [390, 844]]) {
        const page = await browser.newPage({ viewport: { width: w, height: hgt }, reducedMotion: "reduce" });
        const errs = [];
        page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
        page.on("response", (r) => { const u = r.url(); if (u.startsWith(at) && r.status() >= 400 && !/favicon\.ico$/.test(u)) errs.push(r.status() + " " + u.replace(at, "")); });
        await page.route("**/*", async (route) => {
          const u = route.request().url();
          if (!u.startsWith("https://artiscope.github.io/")) return route.abort();
          if (!u.startsWith(at)) return route.fulfill({ status: 404, body: "" });
          let f = decodeURIComponent(new URL(u).pathname.slice("/wall-and-page/".length)); if (f === "" || f.endsWith("/")) f += "index.html";
          const full = path.join(out, f);
          if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) return route.fulfill({ status: 404, contentType: "text/html", body: fs.existsSync(path.join(out, "404.html")) ? fs.readFileSync(path.join(out, "404.html")) : "" });
          const ext = path.extname(full), type = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg" }[ext] || "application/octet-stream";
          return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(full) });
        });
        for (const r of routes) {
          errs.length = 0;
          await page.goto(at + r); await page.waitForTimeout(r.includes("#") || r === routes[0] ? 1400 : 500);
          const where = label + ", " + r + " at " + w;
          const info = await page.evaluate(() => ({
            text: document.body.innerText, title: document.title, wide: document.documentElement.scrollWidth,
            robots: (document.querySelector('meta[name="robots"]') || {}).content || "",
            links: Array.from(document.querySelectorAll("a[href]")).map((a) => a.href).filter((u) => u.startsWith(location.origin)),
          }));
          ok(!errs.length, where + ": " + errs.join("; "));
          ok(info.wide <= w + 1, where + ": " + (info.wide - w) + " pixels too wide");
          ok(!/[–—]/.test(info.text), where + ": a long dash: " + (info.text.match(/.{0,30}[–—].{0,30}/) || [""])[0]);
          const us = info.text.match(US); ok(!us, where + ": a US spelling: " + (us && us[0]));
          const orig = (info.text + info.title).match(ORIGINAL); ok(!orig, where + ": a word of an original site: " + (orig && orig[0]));
          ok(info.robots.includes("noindex"), where + ": no noindex");
          if (r === routes[0]) {
            ok((info.text + info.title).includes(NAME), where + ": the site's name is not on the page");
            ok(/\[[^\]]+\]/.test(info.text), where + ": no placeholder in square brackets");
            await page.screenshot({ path: OUT + "/" + t.id + "-" + look.name.replace(/\W+/g, "-") + "-" + w + ".png", fullPage: true });
          }
          // every link to a page of the site leads to a page that was built
          for (const u of new Set(info.links)) {
            if (!u.startsWith(at)) { ok(false, where + ": a link outside the site's own address: " + u); continue; }
            const p = new URL(u).pathname.slice("/wall-and-page/".length);
            const file = p === "" || p.endsWith("/") ? p + "index.html" : p;
            ok(fs.existsSync(path.join(out, decodeURIComponent(file))), where + ": a link to a page that does not exist: " + p);
          }
        }
        await page.close();
      }
    }
  }
} finally { await browser.close(); }
for (const p of [...new Set(problems)].slice(0, 80)) console.log("FAIL " + p);
console.log(passed + " of " + total + " passed." + (problems.length ? "" : " TEMPLATE CHECKS PASSED"));
process.exitCode = problems.length ? 1 : 0;
