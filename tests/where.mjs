// Where the three repositories are, so the tests run on any computer.
// The two sites are looked for next to this console's folder, under either spelling of their names.
// Set WAR_DIR or GAM_DIR to point somewhere else, and CHROME to use a particular browser.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
export const C_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function sibling(env, names) {
  if (process.env[env]) return path.resolve(process.env[env]);
  for (const n of names) { const p = path.resolve(C_DIR, "..", n); if (fs.existsSync(p)) return p; }
  throw new Error("Cannot find " + names[0] + ". Clone it in the same folder as artiscope-digital-home, or set " + env + " to where it is.");
}
export const W_DIR = sibling("WAR_DIR", ["world-art-review", "World-art-review"]);
export const G_DIR = sibling("GAM_DIR", ["global-art-monitor", "Global-art-monitor"]);
export const FIX = path.join(C_DIR, "tests", "fixtures");
// scratch folders the tests write screenshots and copies into
for (const d of ["/tmp/s2", "/tmp/s4", "/tmp/uat", "/tmp/look"]) fs.mkdirSync(d, { recursive: true });
// the installed Chrome if there is one, otherwise the browser Playwright brings with it
export function chromeOptions() {
  const exe = process.env.CHROME || ["/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));
  return exe ? { executablePath: exe, args: ["--no-sandbox"] } : { args: ["--no-sandbox"] };
}
