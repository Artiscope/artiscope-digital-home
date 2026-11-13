// Runs every check in turn and says plainly which passed. Add "uat" to include the long acceptance test.
//   node tests/run-all.mjs          the quick and browser checks
//   node tests/run-all.mjs uat      the same, then the full acceptance test (about seven minutes)
import { spawnSync } from "node:child_process"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const list = ["run", "content", "people", "versions", "upload", "console", "signin", "files", "items", "gam", "pages", "rich", "theme", "files-ui", "edit-pages", "gam-ui", "every-section"];
if (process.argv.includes("uat")) list.push("uat");
let failed = [];
for (const t of list) {
  const r = spawnSync(process.execPath, [path.join(here, t + ".mjs")], { encoding: "utf8", env: process.env, timeout: 900000 });
  const out = ((r.stdout || "") + (r.stderr || "")).trim().split("\n"), last = out[out.length - 1] || "";
  const m = /(\d+) of (\d+) passed/.exec(out.join("\n")), ok = r.status === 0 && !/FAIL/.test(last) && (!m || m[1] === m[2]);
  console.log((ok ? "passed  " : "FAILED  ") + t.padEnd(14) + last.slice(0, 100));
  if (!ok) { failed.push(t); console.log(out.slice(-15).map((l) => "          " + l).join("\n")); }
}
console.log(failed.length ? "\n" + failed.length + " failed: " + failed.join(", ") : "\nAll " + list.length + " passed.");
process.exitCode = failed.length ? 1 : 0;
