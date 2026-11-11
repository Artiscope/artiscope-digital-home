// Artiscope Digital Home: the one server-side piece.
// It checks who is signed in, then reads and writes the website
// repositories on GitHub on their behalf. The GitHub token never
// reaches the browser.
//
// Secrets this function needs (set in Supabase, never in code):
//   GITHUB_TOKEN     a fine-grained token limited to the site repositories
//   ALLOWED_EMAILS   comma separated list of people who may use the console
// SUPABASE_URL is provided by Supabase. This function checks every
// request itself, so its "Verify JWT" setting is switched off.

// One entry per website. To add a site, add an entry and redeploy.
export const SITES = [
  {
    id: "world-art-review",
    name: "World Art Review",
    domain: "worldartreview.com",
    repo: "Artiscope/World-art-review",
    live: true,
    artists: [
      { slug: "zara-muse", name: "Zara Muse" },
      { slug: "konn-artiss", name: "Konn Artiss" },
      { slug: "zen-xander", name: "Zen Xander" },
    ],
  },
  {
    id: "global-art-monitor",
    name: "Global Art Monitor",
    domain: "globalartmonitor.com",
    repo: "Artiscope/global-art-monitor",
    live: true,
    artists: [
      { slug: "zara-muse", name: "Zara Muse" },
      { slug: "konn-artiss", name: "Konn Artiss" },
    ],
  },
  { id: "site-3", name: "Site 3", domain: "", repo: "", live: false, artists: [] },
  { id: "site-4", name: "Site 4", domain: "", repo: "", live: false, artists: [] },
  { id: "site-5", name: "Site 5", domain: "", repo: "", live: false, artists: [] },
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function env(name) {
  return (globalThis.Deno ? globalThis.Deno.env.get(name) : "") || "";
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ---------- reading the plain text files the agent keeps ----------

function field(block, label) {
  const m = block.match(new RegExp("^- " + label + ":[ \\t]*(.*)$", "m"));
  return m ? m[1].trim() : "";
}

function sectionOf(md, heading) {
  const parts = md.split(/^## /m);
  for (const p of parts) {
    if (p.toLowerCase().startsWith(heading.toLowerCase())) return p;
  }
  return "";
}

function itemsOf(section) {
  return section
    .split(/^### /m)
    .slice(1)
    .map((b) => {
      const title = b.split("\n")[0].trim();
      return {
        title,
        type: field(b, "Type"),
        why: field(b, "Why now"),
        sources: field(b, "Sources found"),
        answer: field(b, "Your answer"),
      };
    })
    .filter((t) => t.title);
}

export function parseCalendar(md) {
  return {
    waiting: itemsOf(sectionOf(md, "Waiting for your answer")),
    approved: itemsOf(sectionOf(md, "Approved, to be written")),
  };
}

// Writes the owner's yes or no next to one topic. Returns the new text,
// or null if that topic is not waiting for an answer.
export function setAnswer(md, title, answer, note) {
  const parts = md.split(/^(?=## )/m);
  let done = false;
  const out = parts.map((sec) => {
    if (done || !/^## Waiting for your answer/i.test(sec)) return sec;
    const blocks = sec.split(/^(?=### )/m);
    return blocks
      .map((b) => {
        if (done || !b.startsWith("### ")) return b;
        if (b.split("\n")[0].slice(4).trim() !== title) return b;
        const clean = String(note || "").replace(/[\r\n]+/g, " ").trim().slice(0, 300);
        const line = "- Your answer: " + answer + (clean ? ", " + clean : "");
        if (!/^- Your answer:.*$/m.test(b)) return b;
        done = true;
        return b.replace(/^- Your answer:.*$/m, line);
      })
      .join("");
  });
  return done ? out.join("") : null;
}

export function parseLog(md, limit = 3) {
  return md
    .split(/^## /m)
    .slice(1)
    .slice(0, limit)
    .map((e) => {
      const lines = e.split("\n");
      return {
        date: lines[0].trim(),
        lines: lines.slice(1).map((l) => l.trim()).filter(Boolean).slice(0, 8),
      };
    });
}

export function safePhotoName(artistSlug, description, ext) {
  const slug = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  const e = String(ext || "").toLowerCase().replace("jpeg", "jpg");
  if (e !== "jpg" && e !== "png") return null;
  const a = slug(artistSlug);
  const d = slug(description);
  if (!a || !d) return null;
  return a + "-" + d + "." + e;
}

// Reads a site's list of image spots. Anything malformed is dropped.
export function parseSlots(text) {
  let data = null;
  try { data = JSON.parse(text); } catch (_e) { return []; }
  const list = data && Array.isArray(data.slots) ? data.slots : [];
  return list
    .filter((x) => x && /^[a-z0-9][a-z0-9-]{1,90}$/.test(String(x.id || "")) && x.label)
    .slice(0, 400)
    .map((x) => ({
      id: String(x.id),
      group: String(x.group || "Other").slice(0, 80),
      label: String(x.label).slice(0, 160),
      filled: x.filled === true,
    }));
}

// Plain single-line text, safe to drop into a page.
export function cleanText(text, limit) {
  return String(text || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[<>`\\]/g, "")
    .replace(/\u2014/g, ",").replace(/\u2013/g, "-")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, limit);
}

// A photo meant for an exact spot is saved as slot--<spot id>.<ext>
export function slotPhotoName(slotId, ext) {
  const e = String(ext || "").toLowerCase().replace("jpeg", "jpg");
  if (e !== "jpg" && e !== "png") return null;
  if (!/^[a-z0-9][a-z0-9-]{1,90}$/.test(String(slotId || ""))) return null;
  return "slot--" + slotId + "." + e;
}

// A photo with only a description is saved as note--<description>.<ext>
export function notePhotoName(description, ext) {
  const e = String(ext || "").toLowerCase().replace("jpeg", "jpg");
  if (e !== "jpg" && e !== "png") return null;
  const d = String(description || "").toLowerCase().normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  return d ? "note--" + d + "." + e : null;
}

function decodeBase64Utf8(b64) {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// ---------- GitHub ----------

async function gh(path, init = {}) {
  const res = await fetch("https://api.github.com" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + env("GITHUB_TOKEN"),
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "artiscope-digital-home",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  let data = null;
  try {
    data = await res.json();
  } catch (_e) {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

// Says in plain words why GitHub refused to save something.
function writeProblem(r, fallback) {
  if (r.status === 401) return "The GitHub key is no longer valid. Create a new one and replace the GITHUB_TOKEN secret.";
  if (r.status === 403 || r.status === 404) {
    return "The GitHub key is not allowed to make changes to this site. On GitHub, open the key and check that the resource owner is Artiscope, this repository is selected, Contents and Pull requests are both set to Read and write, and the key is not waiting for approval.";
  }
  return fallback + " (GitHub code " + r.status + ")";
}

async function getText(repo, path) {
  const r = await gh("/repos/" + repo + "/contents/" + path);
  if (!r.ok || !r.data || !r.data.content) return null;
  return { text: decodeBase64Utf8(r.data.content), sha: r.data.sha };
}

async function draftsOf(repo) {
  const r = await gh("/repos/" + repo + "/pulls?state=open&per_page=30");
  if (!r.ok || !Array.isArray(r.data)) return [];
  return r.data
    .filter((p) => p.head && String(p.head.ref).startsWith("draft/"))
    .map((p) => ({
      number: p.number,
      title: p.title,
      body: String(p.body || "").slice(0, 6000),
      url: p.html_url,
      created: p.created_at,
    }));
}

async function inboxOf(repo) {
  const r = await gh("/repos/" + repo + "/contents/inbox");
  if (!r.ok || !Array.isArray(r.data)) return [];
  return r.data
    .filter((f) => f.type === "file" && /\.(jpe?g|png)$/i.test(f.name))
    .map((f) => f.name);
}

async function siteOverview(site) {
  const base = { id: site.id, name: site.name, domain: site.domain, live: site.live, artists: site.artists };
  if (!site.live) return base;
  try {
    const [cal, log, drafts, inbox, slotFile] = await Promise.all([
      getText(site.repo, "CONTENT-CALENDAR.md"),
      getText(site.repo, "AGENT-LOG.md"),
      draftsOf(site.repo),
      inboxOf(site.repo),
      getText(site.repo, "image-slots.json"),
    ]);
    const waitingSlots = inbox
      .map((n) => (n.match(/^slot--([a-z0-9-]+)\.(jpg|png)$/) || [])[1])
      .filter(Boolean);
    const slots = (slotFile ? parseSlots(slotFile.text) : []).map((x) => ({
      ...x,
      waiting: waitingSlots.includes(x.id),
    }));
    return {
      ...base,
      topics: cal ? parseCalendar(cal.text) : { waiting: [], approved: [] },
      log: log ? parseLog(log.text) : [],
      drafts,
      inbox,
      slots,
    };
  } catch (_e) {
    return { ...base, error: "Could not read this site from GitHub just now." };
  }
}

function liveSite(id) {
  return SITES.find((s) => s.id === id && s.live) || null;
}

async function draftPull(site, number) {
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) return null;
  const r = await gh("/repos/" + site.repo + "/pulls/" + n);
  if (!r.ok || !r.data || r.data.state !== "open") return null;
  if (!String(r.data.head.ref).startsWith("draft/")) return null;
  return r.data;
}

// ---------- who is asking ----------

function publishableKey() {
  try {
    const keys = JSON.parse(env("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    const first = keys.default || Object.values(keys)[0];
    if (first) return String(first);
  } catch (_e) { /* fall through to the older variable */ }
  return env("SUPABASE_ANON_KEY");
}

async function signedInEmail(req) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  // The browser sends the project's publishable key with every call.
  // It is public by design, so it is safe to pass on to the sign-in service.
  const apikey = req.headers.get("apikey") || publishableKey();
  const res = await fetch(env("SUPABASE_URL") + "/auth/v1/user", {
    headers: { Authorization: auth, apikey },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user && user.email ? String(user.email).toLowerCase() : null;
}

function isAllowed(email) {
  const list = env("ALLOWED_EMAILS")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email);
}

// ---------- the actions the console can ask for ----------

export async function handle(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const email = await signedInEmail(req);
  if (!email) return json({ error: "Please sign in again." }, 401);
  if (!isAllowed(email)) return json({ error: "This email address does not have access." }, 403);
  if (!env("GITHUB_TOKEN")) return json({ error: "The GitHub connection has not been set up yet." }, 500);

  let body = {};
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "Could not read the request." }, 400);
  }
  const action = String(body.action || "");

  if (action === "overview") {
    const sites = await Promise.all(SITES.map(siteOverview));
    return json({ user: { email }, sites });
  }

  const site = liveSite(String(body.site || ""));
  if (!site) return json({ error: "That site is not available." }, 400);

  if (action === "answerTopic") {
    const answer = body.answer === "yes" ? "yes" : body.answer === "no" ? "no" : null;
    if (!answer) return json({ error: "Answer must be yes or no." }, 400);
    const file = await getText(site.repo, "CONTENT-CALENDAR.md");
    if (!file) return json({ error: "The content calendar could not be read." }, 502);
    const next = setAnswer(file.text, String(body.title || ""), answer, body.note);
    if (!next) return json({ error: "That topic is no longer waiting for an answer." }, 409);
    const put = await gh("/repos/" + site.repo + "/contents/CONTENT-CALENDAR.md", {
      method: "PUT",
      body: JSON.stringify({
        message: "Topic answered " + answer + " from Artiscope Digital Home",
        content: encodeBase64Utf8(next),
        sha: file.sha,
      }),
    });
    if (!put.ok) return json({ error: writeProblem(put, "GitHub did not save the answer. Please try again.") }, 502);
    return json({ ok: true });
  }

  if (action === "publishDraft" || action === "returnDraft" || action === "rejectDraft") {
    const pull = await draftPull(site, body.number);
    if (!pull) return json({ error: "That draft is no longer open." }, 409);
    const base = "/repos/" + site.repo;

    if (action === "publishDraft") {
      const m = await gh(base + "/pulls/" + pull.number + "/merge", {
        method: "PUT",
        body: JSON.stringify({ merge_method: "squash" }),
      });
      if (!m.ok && (m.status === 401 || m.status === 403 || m.status === 404)) {
        return json({ error: writeProblem(m, "") }, 502);
      }
      if (!m.ok) {
        return json({
          error: "This draft could not be published as it stands. The agent will refresh it on its next run.",
        }, 409);
      }
      return json({ ok: true });
    }

    const note = String(body.note || "").trim().slice(0, 2000);
    if (action === "returnDraft" && !note) return json({ error: "Please say what should change." }, 400);
    if (note) {
      const label = action === "returnDraft" ? "Sent back by the owner" : "Rejected by the owner";
      await gh(base + "/issues/" + pull.number + "/comments", {
        method: "POST",
        body: JSON.stringify({ body: label + " (" + email + "):\n\n" + note }),
      });
    }
    if (action === "rejectDraft") {
      const c = await gh(base + "/pulls/" + pull.number, {
        method: "PATCH",
        body: JSON.stringify({ state: "closed" }),
      });
      if (!c.ok) return json({ error: writeProblem(c, "GitHub did not close the draft. Please try again.") }, 502);
    }
    return json({ ok: true });
  }

  if (action === "uploadPhoto") {
    let name = null;
    if (body.slot) {
      const slotFile = await getText(site.repo, "image-slots.json");
      const known = slotFile ? parseSlots(slotFile.text) : [];
      if (!known.some((x) => x.id === body.slot)) return json({ error: "That spot is no longer on the site. Refresh and choose again." }, 409);
      name = slotPhotoName(body.slot, body.ext);
    } else {
      name = notePhotoName(body.description, body.ext);
    }
    if (!name) return json({ error: "Choose where the photo goes, or describe it, and use a JPG or PNG." }, 400);
    const content = String(body.content || "");
    if (!content || content.length > 7_500_000 || /[^A-Za-z0-9+/=]/.test(content)) {
      return json({ error: "That photo is too large or could not be read." }, 400);
    }
    const path = "/repos/" + site.repo + "/contents/inbox/" + name;
    const exists = await gh(path);
    if (exists.ok) return json({ error: "A photo is already waiting for that spot. The agent will place it on its next run." }, 409);

    // The owner's description travels with the photo in a small note,
    // saved first so it is already there when the photo arrives.
    const alt = cleanText(body.alt, 240);
    const caption = cleanText(body.caption, 160);
    if (alt || caption) {
      const notePath = "/repos/" + site.repo + "/contents/inbox/" + name.replace(/\.(jpg|png)$/, ".json");
      const old = await gh(notePath);
      const saved = await gh(notePath, {
        method: "PUT",
        body: JSON.stringify({
          message: "Photo description from Artiscope Digital Home",
          content: encodeBase64Utf8(JSON.stringify({ alt, caption, sent_by: email }, null, 2) + "\n"),
          ...(old.ok && old.data && old.data.sha ? { sha: old.data.sha } : {}),
        }),
      });
      if (!saved.ok) return json({ error: writeProblem(saved, "GitHub did not accept the description. Please try again.") }, 502);
    }

    const put = await gh(path, {
      method: "PUT",
      body: JSON.stringify({ message: "Photo added from Artiscope Digital Home", content }),
    });
    if (!put.ok) return json({ error: writeProblem(put, "GitHub did not accept the photo. Please try again.") }, 502);
    return json({ ok: true, name, slot: body.slot || null });
  }

  return json({ error: "Unknown request." }, 400);
}

if (globalThis.Deno) {
  globalThis.Deno.serve(handle);
}
