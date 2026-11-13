// A small stand-in for the Supabase people table and the sign-in email, kept in memory.
export function makePeople() {
  const t = { table: [], mails: [], keys: [] };
  t.handles = (url) => String(url).includes("/rest/v1/") || String(url).includes("/auth/v1/otp");
  t.fetch = async (url, init = {}) => {
    url = String(url);
    if (url.includes("/auth/v1/otp")) { t.mails.push({ to: JSON.parse(init.body).email, back: new URL(url).searchParams.get("redirect_to") }); return new Response("{}"); }
    const u = new URL(url), method = init.method || "GET", body = init.body ? JSON.parse(init.body) : null;
    t.keys.push((init.headers || {}).Authorization);
    const eq = u.searchParams.get("email"), match = (p) => !eq || p.email === eq.replace(/^eq\./, "");
    const pick = (p) => { const cols = (u.searchParams.get("select") || "*").split(","); return cols[0] === "*" ? { ...p } : Object.fromEntries(cols.map((c) => [c, p[c]])); };
    const out = (status, data) => new Response(JSON.stringify(data), { status });
    if (method === "GET") return out(200, t.table.filter(match).map(pick));
    if (method === "POST") { if (t.table.some((p) => p.email === body.email || p.id === body.id)) return out(409, { message: "duplicate" }); t.table.push({ invited_at: new Date().toISOString(), last_seen: null, ...body }); return out(201, [body]); }
    if (method === "PATCH") { const hit = t.table.filter(match); hit.forEach((p) => Object.assign(p, body)); return out(200, hit); }
    if (method === "DELETE") { const hit = t.table.filter(match); t.table = t.table.filter((p) => !match(p)); return out(200, hit); }
    return out(405, {});
  };
  return t;
}
