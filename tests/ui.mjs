import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const el = { innerHTML: "", listeners: {}, addEventListener(t, f) { this.listeners[t] = f; }, querySelector() { return null; } };
const win = {
  ADH_CONFIG: { supabaseUrl: "https://x.supabase.co", supabaseKey: "", functionName: "home" },
  location: { search: "?demo", origin: "https://x", pathname: "/" },
  scrollTo() {},
};
const ctx = vm.createContext({ window: win, document: { getElementById: () => el, createElement: () => ({}) }, URLSearchParams, setTimeout, console, Date, JSON, Promise, URL });
vm.runInContext(fs.readFileSync("assets/app.js", "utf8"), ctx);
await new Promise((r) => setTimeout(r, 600));

const adh = win.__adh;
assert.ok(el.innerHTML.includes("Artiscope<br>Digital Home"), "shell renders");
assert.ok(el.innerHTML.includes("Sample mode"), "sample mode is labelled");
for (const tab of ["today", "topics", "drafts", "photos", "sites"]) {
  adh.state.tab = tab; adh.render();
  assert.ok(el.innerHTML.length > 500, tab + " renders");
  assert.ok(!el.innerHTML.includes("undefined"), tab + " has no undefined");
  assert.ok(!/[–—]/.test(el.innerHTML), tab + " has no long dashes");
}

// hostile text from GitHub must be shown as text, never run
const bad = '<img src=x onerror=alert(1)>"\'<script>alert(2)</script>';
const s = adh.state.data.sites[1];
s.name = bad; s.domain = bad;
s.topics.waiting[0] = { title: bad, type: bad, why: bad, sources: bad, answer: "" };
s.drafts[0] = { number: 7, title: bad, body: bad, url: 'javascript:alert(3)"><b>', created: "2026-11-11T00:00:00Z" };
s.inbox = [bad]; s.log = [{ date: bad, lines: [bad] }];
for (const tab of ["today", "topics", "drafts", "photos", "sites"]) {
  adh.state.tab = tab; adh.render();
  assert.ok(!el.innerHTML.includes("<img src=x"), tab + " escapes tags");
  assert.ok(!el.innerHTML.includes("<script>alert"), tab + " escapes scripts");
  assert.ok(!el.innerHTML.includes("javascript:"), tab + " drops unsafe links");
  assert.ok(!el.innerHTML.includes('alert(3)"><b>'), tab + " escapes attributes");
}
console.log("UI CHECKS PASSED");
