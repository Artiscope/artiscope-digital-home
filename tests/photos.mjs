import fs from "node:fs"; import vm from "node:vm"; import assert from "node:assert/strict";
const el = { innerHTML: "", listeners: {}, addEventListener(t, f) { this.listeners[t] = f; }, querySelector() { return null; } };
class FakeImage { set src(v) { this.width = 4000; this.height = 2000; setTimeout(() => this.onload(), 0); } }
const doc = { getElementById: () => el, createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/jpeg;base64,QUJD" }) };
const win = { ADH_CONFIG: { supabaseKey: "" }, location: { search: "?demo", origin: "https://x", pathname: "/" }, scrollTo() {} };
const ctx = vm.createContext({ window: win, document: doc, URLSearchParams, setTimeout, console, Date, JSON, Promise, URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} }, Image: FakeImage, Array, Number, String });
vm.runInContext(fs.readFileSync("assets/app.js", "utf8"), ctx);
await new Promise((r) => setTimeout(r, 500));
const adh = win.__adh; adh.state.tab = "photos"; adh.render();
assert.ok(el.innerHTML.includes("Empty spots on this site") && el.innerHTML.includes("multiple"));
// choose two files
el.listeners.change({ target: { dataset: { change: "photo-files" }, files: [{ name: "a.jpg", type: "image/jpeg" }, { name: "<b>.png", type: "image/png" }] } });
assert.ok(el.innerHTML.includes("Where should it go?") && el.innerHTML.includes("&lt;b&gt;.png") && !el.innerHTML.includes("<b>.png"));
assert.ok(el.innerHTML.includes("Send these 2 photos") && el.innerHTML.includes("Choose a spot and describe every photo first") && el.innerHTML.includes("Describe the picture"));
assert.ok(el.innerHTML.includes("has an image, replacing needs your approval") && el.innerHTML.includes("(empty)"));
// pick spots: same spot twice is refused
el.listeners.change({ target: { dataset: { change: "photo-slot", i: "0" }, value: "artist-konn-artiss" } });
el.listeners.change({ target: { dataset: { change: "photo-slot", i: "1" }, value: "artist-konn-artiss" } });
assert.ok(el.innerHTML.includes("already going to that spot"));
el.listeners.change({ target: { dataset: { change: "photo-slot", i: "1" }, value: "other" } });
assert.ok(el.innerHTML.includes("Describe where it belongs"));
adh.state.photoFiles[1].note = "studio shot"; adh.state.photoFiles[0].alt = "Ice blocks"; adh.state.photoFiles[1].alt = "A studio"; adh.state.photoFiles[0].caption = "ANTI-FRIEZE"; adh.render();
assert.ok(!el.innerHTML.includes("Choose a spot and describe every photo first"));
// send
el.listeners.click({ target: { closest: () => ({ dataset: { act: "photo-send" } }) } });
await new Promise((r) => setTimeout(r, 900));
assert.ok(el.innerHTML.includes("2 photos sent"), el.innerHTML.slice(0, 600));
assert.ok(el.innerHTML.includes("Artist main images, Konn Artiss") && el.innerHTML.includes("note--studio-shot.png"));
assert.equal(adh.state.photoFiles.length, 0);
el.listeners.change({ target: { dataset: { change: "photo-files" }, files: [{ name: "c.jpg", type: "image/jpeg" }] } });
assert.ok(el.innerHTML.includes("Konn Artiss (photo already waiting)"));
// older server function: clear message
delete adh.state.data.sites[0].slots; adh.render();
assert.ok(el.innerHTML.includes("older copy"));
console.log("PHOTO CHECKS PASSED");
