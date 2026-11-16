// Sample mode, Street Art Dispatch: assets/demo-sad.json, the site's lists as the Content screen shows them.
import { sadDir, C_DIR } from "../where.mjs";
import fs from "node:fs";
globalThis.Deno = { env: { get: () => "" }, serve() {} };
const m = await import(new URL("../home.mjs", import.meta.url));
let dir = null; try { dir = sadDir(); } catch (e) { console.log("Street Art Dispatch not found, its sample was left as it was. " + e.message); }
if (dir) {
  const data = JSON.parse(fs.readFileSync(dir + "/data/content.json", "utf8"));
  const site = m.SITES.find((s) => s.id === "street-art-dispatch");
  const collections = site.collections.map((c) => ({ id: c.id, label: c.label, singular: c.singular, canHide: !!c.canHide, canDelete: !!c.canDelete, entries: m.entriesOf(data, c).map((x) => m.entryView(x, c)), problem: "" }));
  fs.writeFileSync(C_DIR + "/assets/demo-sad.json", JSON.stringify({ collections }));
}
