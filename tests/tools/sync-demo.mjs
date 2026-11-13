// Run after any change to the server (supabase/functions/home/index.ts) or to either site's content.
// 1. The tests use a copy of the server: refresh it.
// 2. Sample mode (index.html?demo) shows the sites' real sections and pages: refresh those too.
import fs from "node:fs"; import { C_DIR } from "../where.mjs";
fs.copyFileSync(C_DIR + "/supabase/functions/home/index.ts", C_DIR + "/tests/home.mjs");
console.log("Copied the server into tests/home.mjs");
for (const f of ["demo-war-kinds.mjs", "demo-war-site.mjs", "demo-gam.mjs"]) await import(new URL("./" + f, import.meta.url));
console.log("Sample data refreshed");
