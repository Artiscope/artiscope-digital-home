// The walkthrough video: the real console, driven the way the acceptance test drives it,
// filmed screen by screen. Run with FILM=1 node tests/uat.mjs. Each frame is a JPEG in
// /tmp/film with its scene, caption and the parts of the screen to point out, listed in
// /tmp/film/frames.json; tests/tools/film-make.py turns them into the video.
import fs from "node:fs";
const OUT = "/tmp/film/";

export async function runFilm(x) {
  const { page, settle, openSite } = x;
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 698 }); await settle(800);
  const frames = [], problems = [];
  let n = 0;
  // one frame: the screen as it is now, with the parts named in `hl` outlined in the video
  async function shot(scene, caption, hl = [], o = {}) {
    await settle(o.wait || 900);
    if (!o.keepScroll) { await page.evaluate(() => window.scrollTo(0, 0)); await settle(300); }
    const boxes = [];
    for (const sel of hl) { const b = await page.locator(sel).first().boundingBox({ timeout: 1500 }).catch(() => null); if (b && b.width && b.height) boxes.push(b); }
    const file = OUT + "f" + String(++n).padStart(2, "0") + ".jpg";
    await page.screenshot({ path: file, type: "jpeg", quality: 92 });
    frames.push({ file, scene, caption, boxes, hold: o.hold || 0 });
  }
  const step = async (name, fn) => { try { await fn(); } catch (e) { problems.push(name + ": " + String(e.message || e).split("\n")[0].slice(0, 160)); } };
  const home = async () => { await page.click(".ed-exit", { timeout: 800 }).catch(() => {}); await page.click('[data-tab="home"]', { timeout: 2000 }).catch(() => {}); await page.waitForSelector('[data-act="open-site"]', { timeout: 15000 }); await settle(1200); };
  const toTab = async (tab) => { if (await page.isVisible(".ed-exit")) { await page.click(".ed-exit"); await page.waitForSelector('.navb[data-tab="overview"]'); } await page.click('.navb[data-tab="' + tab + '"]'); await settle(1300); };
  const panel = async (p) => { await page.click('[data-act="ed-panel"][data-panel="' + p + '"]'); await settle(900); };

  // 1. All sites
  await step("All sites", async () => {
    await home(); await settle(2500);
    await shot(1, "All sites: every website Artiscope runs, each with a small picture of its home page. Click a site to open it.", ['[data-act="open-site"][data-site="world-art-review"]']);
    await page.mouse.wheel(0, 700); await settle(900);
    await shot(1, "Below them sit the Practice site, the practice build for test users, and the sites still to build, each with Start building.", ['[data-act="open-site"][data-site="site-4"]'], { keepScroll: true });
  });
  // 2. Overview
  await step("Overview", async () => {
    await openSite("global-art-monitor"); await toTab("overview");
    await shot(2, "Each site has its Overview: the live site, trial copies to try things out safely, and anything waiting for you.", []);
  });
  // 3. The page editor
  await step("Page editor", async () => {
    await page.click('.navb[data-tab="pages"]').catch(() => {}); await page.waitForSelector("#ed-sections .sec", { timeout: 12000 }); await settle(2500);
    await shot(3, "The page editor: the sections of the page on the left, and the live page in the middle, exactly as visitors see it.", []);
    await page.click("#ed-sections .sec:not(.blk) >> nth=2"); await settle(1200);
    await shot(3, "Click a section, in the list or on the page itself, and its settings open beside it.", ["#ed-sections .sec.on, #ed-sections .sec.picked"]);
    await page.fill('.ed-right [data-pf="heading"]', "Zara Muse at auction: every documented sale"); await settle(1400);
    await shot(3, "Type in a box and the page changes as you type. Nothing reaches visitors until you press Save.", ['.ed-right [data-pf="heading"]', '[data-act="ed-save"]']);
  });
  // 4. Adding things
  await step("Adding", async () => {
    await page.click('.addl[data-act="ed-secpicker"] >> nth=0'); await settle(1100);
    await shot(4, "Add a section: twenty kinds, from text with a picture to galleries, exhibitions and sign-up forms, each with a preview.", []);
    await page.click('.pk-item[data-key="quote"]').catch(() => {}); await settle(1600);
    await shot(4, "Every section can go on any page, any number of times. Rows can be dragged, hidden, copied or removed, and Undo is always there.", ["#ed-sections .sec.on, #ed-sections .sec.picked"]);
  });
  // 5. Theme settings
  await step("Theme", async () => {
    await panel("theme");
    await shot(5, "Theme settings: the site's colours, typefaces, text sizes, corners and buttons, set once for every page.", [".tgrp.open"]);
    await page.click('[data-act="ed-tgroup"][data-g="type"]'); await settle(1000);
    await shot(5, "Typography: headings and reading text, chosen from a short list of typefaces picked for the sites, with sizes and spacing.", [".tgrp.open"]);
    await page.click('[data-act="ed-tgroup"][data-g="style"]'); await settle(1000);
    await shot(5, "Theme style: ready-made looks to try on. The site's own look is always one click away, and words are never touched.", [".tgrp.open"]);
  });
  // 6. Templates, add-ons and default text
  await step("Templates and more", async () => {
    await panel("sections");
    await page.click(".ed-pagebtn"); await settle(500);
    await page.click('[data-act="ed-ppgroup"][data-g="articles"]').catch(() => {}); await settle(900);
    await shot(6, "The page picker: pages, lists, articles and artists. Templates set the layout of every article or artist page at once.", [".ed-pop.pp"]);
    await page.keyboard.press("Escape"); await settle(400);
    await panel("addons");
    await shot(6, "Add-ons: small extras for every page, such as Back to top and Share links. All our own, nothing sent to other companies.", []);
    await page.click('[data-act="ed-pop"][data-menu="more"]'); await page.click('.ed-pop.mp [data-act="wd-open"]'); await settle(700);
    await page.click('.wd-grp[data-g="btn"]'); await settle(500);
    await page.fill('.wd-row[data-k="btn.read-feature"] .wd-in', "Read the whole feature"); await settle(1400);
    await page.click('.wd-row[data-k="btn.open-profile"] [data-act="wd-find"]').catch(() => {}); await settle(1400);
    await shot(6, "Edit default text: the fixed words of the design, such as button words. Show me where outlines a word on the page.", ['.wd-row[data-k="btn.read-feature"]']);
  });
  // 7. Saving safely
  await step("Saving", async () => {
    await page.click('[data-act="ed-pop"][data-menu="changes"]'); await settle(700);
    await shot(7, "Every change not saved yet is listed in plain words, each with its own Undo.", [".ed-pop.chg"]);
    await page.keyboard.press("Escape"); await settle(300);
    await page.click('[data-act="ed-pop"][data-menu="save"]'); await settle(700);
    await shot(7, "Save puts changes live after one question. Publish later picks a date and time, and trial copies keep work private until it is made live.", [".svp"]);
    await page.keyboard.press("Escape"); await settle(300);
    await page.click('[data-act="ed-save"]'); await settle(500);
    await shot(7, "Saving the live site asks once, so nothing goes to visitors by accident.", [".ed-pop, .ask"]);
    await page.click('[data-act="livesave"]'); await page.waitForSelector("text=Saved", { timeout: 9000 }); await settle(2500);
    await shot(7, "Once saved, the changes are on the site that visitors see.", []);
    // two versions to show: where versions began, and this save
    const api = "https://api.github.com/repos/Artiscope/global-art-monitor/";
    const head = await (await x.hub.fetch(api + "git/ref/heads/main")).json();
    for (const [tag, note] of [["v1.0", "Where versions began."], ["v1.1", "The auction timeline's heading now names every documented sale. (by admin)"]])
      await x.hub.fetch(api + "releases", { method: "POST", body: JSON.stringify({ tag_name: tag, name: "Version " + tag.slice(1), body: note, target_commitish: head.object.sha }) });
    await toTab("versions");
    await shot(7, "Versions: every publish is numbered with notes on what changed, and Go back returns the site to any earlier version.", []);
  });
  // 8. People
  await step("People", async () => {
    const now = new Date().toISOString();
    x.ppl.table.push({ email: "priya@example.org", id: "1a2b3c4d5e", name: "Priya", sites: ["world-art-review", "global-art-monitor"], invited_at: now, last_seen: now });
    x.ppl.table.push({ email: "tom@example.org", id: "6f7a8b9c0d", name: "Tom", sites: ["practice-build"], invited_at: now, last_seen: null });
    await home(); await page.click('.navb[data-tab="people"]'); await settle(1300);
    await shot(8, "People: invite editors by email and choose their sites. Each editor works on their own copy, and only the admin manages people.", []);
  });
  // 9. Start building
  await step("Start building", async () => {
    await home(); await page.click('[data-act="open-site"][data-site="site-4"]'); await page.waitForSelector('[data-bd="name"]'); await settle(1500);
    await page.fill('[data-bd="name"]', "Grove Prints"); await page.fill('[data-bd="tagline"]', "Prints and editions from Grove Gallery").catch(() => {}); await settle(1800);
    await shot(9, "Start building: a new site in four steps. First its name, tagline, web address and contact email, with the home page drawn as you type.", ['[data-bd="name"]', "#bd-if"]);
    await page.click('[data-act="bd-next"]'); await settle(1800);
    await shot(9, "Then a look: one of twelve ready-made looks, or the look of a site you already have.", []);
    await page.click('[data-act="bd-next"]'); await settle(1600);
    await shot(9, "Then its first pages: a home page, a ready-made set, or another site's layout with placeholder words.", []);
    await page.click('[data-act="bd-next"]'); await settle(1600);
    await shot(9, "Check and create makes the site's home on GitHub, publishes it and opens the editor. The web address records to add are shown afterwards.", ['[data-act="bd-create"]']);
    await page.click('[data-act="bd-close"]').catch(() => {}); await settle(800);
  });
  // 10. Edit code
  await step("Edit code", async () => {
    await openSite("street-art-dispatch"); await settle(1500);
    await page.click('[data-act="ed-pop"][data-menu="more"]'); await page.click('[data-act="code-open"]'); await settle(2000);
    await shot(10, "Edit code, for the admin only: the site's own files, saved to a separate copy that is built and checked before it can go live.", []);
    await page.click('[data-act="code-back"]').catch(() => {}); await settle(800);
  });
  fs.writeFileSync(OUT + "frames.json", JSON.stringify({ frames, problems }, null, 1));
  console.log("FILM: " + frames.length + " frames, problems: " + (problems.length ? problems.join(" | ") : "none"));
}
