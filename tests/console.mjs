import fs from "node:fs"; import vm from "node:vm"; import assert from "node:assert/strict";
const el = { innerHTML: "", listeners: {}, addEventListener(t, f) { this.listeners[t] = f; }, querySelector() { return null; }, querySelectorAll() { return []; } };
class FakeImage { set src(v) { this.width = 4000; this.height = 2000; setTimeout(() => this.onload(), 0); } }
const doc = { getElementById: () => el, createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/jpeg;base64,QUJD" }) };
const win = { ADH_CONFIG: { supabaseKey: "" }, location: { search: "?demo", origin: "https://x", pathname: "/" }, scrollTo() {} };
vm.runInContext(fs.readFileSync("assets/app.js", "utf8"), vm.createContext({ window: win, document: doc, URLSearchParams, setTimeout, console, Date, JSON, Promise, URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} }, Image: FakeImage, Array, Number, String, Object, Math }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (d) => el.listeners.click({ target: { closest: () => ({ dataset: d }) } });
await wait(500);
const adh = win.__adh, html = () => el.innerHTML;
assert.ok(html().includes("Artiscope<br>Digital Home") && html().includes("Sample mode") && html().includes("Version 13"));
assert.ok(html().includes("Everything is live") && html().includes('class="bulge'));

// every screen draws, with no stray "undefined" and no long dashes
for (const tab of ["home", "content", "theme", "photos", "history", "sites"]) {
  adh.go(tab); await wait(300);
  assert.ok(html().length > 800, tab + " draws");
  assert.ok(!html().includes("undefined") && !html().includes("[object"), tab + " is clean");
  assert.ok(!/[–—]/.test(html()), tab + " has no long dashes");
  assert.ok(html().includes('data-tab="' + tab + '" aria-current="page"'), tab + " is marked in the menu");
}

// content: tabs, open an entry, save, hide, delete with a second press
adh.go("content"); await wait(300);
assert.ok(html().includes('class="blob"') && html().includes("Hidden from the site"));
click({ act: "open", ci: "0", ei: "0" });
assert.ok(html().includes("Save and publish") && html().includes("Summary line") && html().includes('type="number"') && html().includes("Hide from the site"));
const form = { dataset: { form: "entry" }, querySelectorAll: () => [{ dataset: { field: "title" }, value: "New title" }, { dataset: { field: "minutes" }, value: "7" }] };
el.listeners.submit({ preventDefault() {}, target: form }); await wait(50);
assert.ok(html().includes(">Saving<") || html().includes("Saved. Not live yet"));
await wait(500);
assert.ok(html().includes("Saved. Not live yet") && !html().includes("Save and publish"), "returns to the list after saving");
// nothing is live until Publish; undo and redo step through what was saved
assert.ok(html().includes('data-act="publish"') && adh.state.data.sites[0].copies[0].ahead === 1);
click({ act: "undo-step" }); await wait(500);
assert.ok(html().includes("Undone") && !html().includes('data-act="publish"') && adh.state.data.sites[0].copies[0].canRedo);
click({ act: "redo-step" }); await wait(500);
assert.ok(html().includes("Redone") && html().includes('data-act="publish"'));
adh.go("content"); await wait(300);
assert.ok(html().includes("1 change saved, not yet live"));
click({ act: "publish" }); await wait(500);
assert.ok(html().includes("Published. Live in about two minutes") && !html().includes('data-act="publish"'));
// trial copies: make one, work on it, make it live after a question, delete after a question
adh.go("sites"); await wait(100);
assert.ok(html().includes("Make a trial copy") && html().includes("What visitors see") && html().includes("You are working on this"));
el.listeners.submit({ preventDefault() {}, target: { dataset: { form: "copy" }, querySelector: () => ({ value: "Winter look" }) } }); await wait(500);
assert.ok(html().includes("Trial: Winter look") && html().includes("Same as the live site") && adh.state.copy["world-art-review"].startsWith("trial-winter-look"));
adh.go("content"); await wait(300); click({ act: "open", ci: "0", ei: "0" });
el.listeners.submit({ preventDefault() {}, target: form }); await wait(600);
assert.ok(html().includes('data-act="ask-makelive"') && html().includes(">Make live<"));
adh.go("sites"); await wait(100);
assert.ok(html().includes("1 change saved on this copy") && html().includes("Open the preview") && html().includes("Undo this"));
click({ act: "ask-makelive" });
assert.ok(html().includes("the live site?") && html().includes("Make it live"));
click({ act: "ask-cancel" }); assert.ok(!html().includes("Make it live"));
click({ act: "ask-big", kind: "deletecopy", copy: adh.state.copy["world-art-review"] });
assert.ok(html().includes("Delete the copy"));
click({ act: "deletecopy", copy: adh.state.copy["world-art-review"] }); await wait(500);
assert.ok(html().includes("Trial copy deleted") && adh.state.copy["world-art-review"] === "" && !html().includes("Trial: Winter look"));
adh.go("content"); await wait(300);
click({ act: "open", ci: "0", ei: "0" });
const delKey = adh.state.confirm; click({ act: "ask", k: "entry|world-art-review|articles|a1|delete" });
assert.ok(html().includes("Yes, delete it") && html().includes("bring it back from History"));
click({ act: "cancel" }); assert.ok(!html().includes("Yes, delete it"));
click({ act: "open", ci: "1", ei: "0" });
assert.ok(html().includes("Large background words") && html().includes("Knives,\n\nnot") && !html().includes("Hide from the site") && !html().includes(">Delete<"), "artists cannot be hidden or deleted");

// hostile text from GitHub is shown as text
click({ act: "close" });
const bad = '<img src=x onerror=alert(1)>"\'<script>alert(2)</script>';
const col = adh.state.content["world-art-review"][0];
col.label = bad; col.entries[0] = { id: bad, title: bad, sub: bad, hidden: false, fields: [{ name: bad, label: bad, type: "long", value: bad }, { name: "x", label: bad, type: "lines", value: [bad] }] };
adh.state.data.sites[0].name = bad; adh.state.data.sites[0].slots[0].label = bad; adh.state.data.sites[0].slots[0].group = bad;
adh.state.history["world-art-review"] = [{ sha: bad, what: bad, when: "2026-11-11T10:00:00Z", by: bad, canUndo: true }];
for (const tab of ["home", "content", "theme", "photos", "history", "sites"]) {
  adh.go(tab); await wait(50);
  if (tab === "content") click({ act: "open", ci: "0", ei: "0" });
  assert.ok(!html().includes("<img src=x") && !html().includes("<script>alert"), tab + " escapes hostile text");
}

// photos: add two, describe them, send; remove asks first
adh.state.data.sites[0].name = "World Art Review"; adh.go("photos"); await wait(50);
el.listeners.change({ target: { dataset: { change: "photo-files" }, files: [{ name: "a.jpg", type: "image/jpeg" }, { name: "b.png", type: "image/png" }] } });
assert.ok(html().includes("Send these 2 photos") && html().includes("Choose a spot and describe every photo first"));
el.listeners.change({ target: { dataset: { change: "photo-slot", i: "0" }, value: "artist-konn-artiss" } });
el.listeners.change({ target: { dataset: { change: "photo-slot", i: "1" }, value: "artist-konn-artiss" } });
assert.ok(html().includes("already going to that spot"));
el.listeners.change({ target: { dataset: { change: "photo-slot", i: "1" }, value: "other" } });
Object.assign(adh.state.photoFiles[0], { alt: "Ice blocks" }); Object.assign(adh.state.photoFiles[1], { alt: "A studio", note: "studio shot" }); adh.render();
assert.ok(!html().includes("Choose a spot and describe every photo first"));
click({ act: "photo-send" }); await wait(700);
assert.ok(html().includes("2 photos sent") && adh.state.photoFiles.length === 0);
click({ act: "ask", k: "photo|world-art-review|artist-zara-muse" });
assert.ok(html().includes("Take this photo off the site?"));

// history: undo asks first and explains
adh.state.history = {}; adh.go("history"); await wait(300);
assert.ok(html().includes(">Undo<"));
click({ act: "ask", k: "undo|world-art-review|" + "a".repeat(40) });
assert.ok(html().includes("Yes, undo it") && html().includes("Later changes to the same content are undone too"));
console.log("CONSOLE CHECKS PASSED");
