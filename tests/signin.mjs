import fs from "node:fs"; import vm from "node:vm"; import assert from "node:assert/strict";
const el = { innerHTML: "", listeners: {}, addEventListener(t, f) { this.listeners[t] = f; }, querySelector() { return null; } };
let mode = "rate";
const sbClient = { auth: {
  onAuthStateChange() {}, getSession: async () => ({ data: { session: null } }),
  signInWithOtp: async () => mode === "rate" ? { error: { status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" } } : { error: null },
  signInWithPassword: async () => ({ error: { status: 400, code: "invalid_credentials", message: "Invalid login credentials" } }),
} };
const win = { ADH_CONFIG: { supabaseUrl: "https://x.supabase.co", supabaseKey: "k" }, location: { search: "", origin: "https://x", pathname: "/" }, scrollTo() {}, supabase: { createClient: () => sbClient } };
vm.runInContext(fs.readFileSync("assets/app.js", "utf8"), vm.createContext({ window: win, document: { getElementById: () => el }, URLSearchParams, setTimeout, console, Date, JSON, Promise, URL }));
await new Promise((r) => setTimeout(r, 50));
assert.ok(el.innerHTML.includes("Send me a sign-in link") && el.innerHTML.includes("Use a password instead"));
const form = { dataset: { form: "signin" }, email: { value: "a@b.com" }, password: { value: "x" } };
await el.listeners.submit({ preventDefault() {}, target: form });
assert.ok(el.innerHTML.includes("Too many sign-in emails"), "rate limit explained");
el.listeners.click({ target: { closest: () => ({ dataset: { act: "signin-mode", mode: "password" } }) } });
assert.ok(el.innerHTML.includes('type="password"') && el.innerHTML.includes('value="a@b.com"'));
await el.listeners.submit({ preventDefault() {}, target: form });
assert.ok(el.innerHTML.includes("do not match"), "wrong password explained");
console.log("SIGN-IN CHECKS PASSED");
