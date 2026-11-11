import assert from "node:assert/strict";
import { handle } from "./home.mjs";
globalThis.Deno = { env: { get: (k) => ({ GITHUB_TOKEN: "t", ALLOWED_EMAILS: "me@x.com", SUPABASE_URL: "https://s" }[k] || "") }, serve() {} };
const calls = [];
const slots = { slots: [{ id: "artist-konn-artiss", group: "Artists", label: "Konn Artiss", filled: false }] };
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ email: "me@x.com" }));
  const method = init.method || "GET";
  calls.push(method + " " + url.replace("https://api.github.com/repos/Artiscope/World-art-review/contents/", ""));
  if (url.endsWith("image-slots.json")) return new Response(JSON.stringify({ sha: "s1", content: btoa(JSON.stringify(slots)) }));
  if (method === "GET") return new Response("{}", { status: 404 });
  const body = JSON.parse(init.body);
  if (url.endsWith(".json")) { const note = JSON.parse(atob(body.content)); assert.equal(note.alt, "Ice blocks on a pavement"); assert.equal(note.caption, "ANTI-FRIEZE, 2025"); assert.equal(note.sent_by, "me@x.com"); }
  return new Response("{}", { status: 201 });
};
const post = (b) => new Request("https://x", { method: "POST", headers: { Authorization: "Bearer t", apikey: "k" }, body: JSON.stringify(b) });
let r = await handle(post({ action: "uploadPhoto", site: "world-art-review", slot: "artist-konn-artiss", ext: "jpg", content: "QUJD", alt: "Ice <blocks> on a pavement".replace(/[<>]/g, ""), caption: "ANTI-FRIEZE, 2025" }));
assert.equal(r.status, 200); const out = await r.json(); assert.equal(out.name, "slot--artist-konn-artiss.jpg");
const writes = calls.filter((c) => c.startsWith("PUT"));
assert.deepEqual(writes, ["PUT inbox/slot--artist-konn-artiss.json", "PUT inbox/slot--artist-konn-artiss.jpg"], "description is saved before the photo");
r = await handle(post({ action: "uploadPhoto", site: "world-art-review", slot: "artist-nobody", ext: "jpg", content: "QUJD", alt: "x" }));
assert.equal(r.status, 409);
r = await handle(post({ action: "uploadPhoto", site: "site-3", slot: "artist-konn-artiss", ext: "jpg", content: "QUJD" }));
assert.equal(r.status, 400);
console.log("UPLOAD CHECKS PASSED");
