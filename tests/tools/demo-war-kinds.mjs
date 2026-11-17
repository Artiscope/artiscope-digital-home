// Sample mode, World Art Review: the section kinds and shared pictures written into assets/app.js.
import { W_DIR, G_DIR, C_DIR } from "../where.mjs";
import fs from "node:fs";
globalThis.Deno = { env: { get: () => "" }, serve() {} };
const m = await import(new URL("../home.mjs", import.meta.url));
const site = m.SITES[0], kinds = {};
for (const [k, v] of Object.entries(site.sectionKinds)) { kinds[k] = { label: v.label, about: v.about || "", fields: v.fields, library: v.library || "", starter: v.starter || null }; if (v.blocks) kinds[k].blocks = m.blockKinds(v.blocks); if (v.popup) kinds[k].popup = true; }
const war = JSON.parse(fs.readFileSync((W_DIR + "/content/site.json"), "utf8"));
const spots = m.pictureSpots(war).map(m.publicSpot);
const p = (C_DIR + "/assets/app.js"); let s = fs.readFileSync(p, "utf8");
s = s.replace(/  var demoKinds = .*;\n/, () => "  var demoKinds = " + JSON.stringify(kinds) + ";\n");
s = s.replace(/  var demoSpots = .*;\n/, "");
s = s.replace("  var demoSummaries = ", () => "  var demoSpots = " + JSON.stringify(spots) + ";\n  var demoSummaries = ");
s = s.replace(/  var demoThemeExtra = .*;\n/, "");
s = s.replace("  var demoTheme = {", () => "  var demoThemeExtra = " + JSON.stringify({ settings: m.THEME_SETTINGS.filter((x) => !x.only || (site.theme.look || {})[x.only]), look: site.theme.look }) + ";\n  var demoTheme = {");
fs.writeFileSync(p, s);
console.log("demo kinds", Object.keys(kinds).length, "spots", spots.length);
