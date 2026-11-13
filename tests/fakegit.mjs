// A small stand-in for GitHub, kept in memory, so the server code can be
// tested without touching the real sites. One store per repository.
import { createHash } from "node:crypto";
const hash = (x) => createHash("sha1").update(x).digest("hex");
const b64 = (text) => Buffer.from(text, "utf8").toString("base64");

export function makeGitHub(seed) {   // seed: { "Owner/repo": { "path": "text" } }
  const repos = {}; let clock = Date.UTC(2026, 10, 1);
  const log = [];
  function repoOf(name) {
    if (repos[name]) return repos[name];
    const r = { blobs: {}, trees: {}, commits: {}, refs: {} };
    const files = {};
    for (const [p, text] of Object.entries(seed[name] || {})) files[p] = blob(r, b64(text));
    r.refs.main = commit(r, tree(r, files), [], "Start");
    return (repos[name] = r);
  }
  function blob(r, content) { const sha = hash("blob" + content); r.blobs[sha] = content; return sha; }
  function tree(r, files) { const sha = hash("tree" + JSON.stringify(Object.keys(files).sort().map((k) => [k, files[k]]))); r.trees[sha] = { ...files }; return sha; }
  function commit(r, treeSha, parents, message) {
    clock += 60000; const date = new Date(clock).toISOString();
    const sha = hash("commit" + treeSha + parents.join() + message + date);
    r.commits[sha] = { sha, tree: treeSha, parents, message, date }; return sha;
  }
  const filesAt = (r, sha) => r.trees[r.commits[sha].tree];
  function resolve(r, ref) { ref = decodeURIComponent(ref || "main"); return r.refs[ref] || (r.commits[ref] ? ref : null); }
  function ancestors(r, sha) { const seen = new Set(), todo = [sha]; while (todo.length) { const x = todo.pop(); if (!x || seen.has(x)) continue; seen.add(x); todo.push(...r.commits[x].parents); } return seen; }
  function view(r, sha) {
    const c = r.commits[sha], now = filesAt(r, sha), before = c.parents[0] ? filesAt(r, c.parents[0]) : {};
    const files = [...new Set([...Object.keys(now), ...Object.keys(before)])].filter((p) => now[p] !== before[p])
      .map((p) => ({ filename: p, status: !before[p] ? "added" : !now[p] ? "removed" : "modified" }));
    return { sha, commit: { message: c.message, author: { date: c.date, name: "x" }, committer: { date: c.date } }, parents: c.parents.map((p) => ({ sha: p })), files };
  }
  function subtrees(r, files) {
    const out = [], dirs = {};
    for (const [p, sha] of Object.entries(files)) {
      out.push({ path: p, mode: "100644", type: "blob", sha });
      const parts = p.split("/");
      for (let i = 1; i < parts.length; i++) { const d = parts.slice(0, i).join("/"); (dirs[d] = dirs[d] || {})[parts.slice(i).join("/")] = sha; }
    }
    for (const [d, inner] of Object.entries(dirs)) out.push({ path: d, mode: "040000", type: "tree", sha: tree(r, inner) });
    return out;
  }
  const res = (status, data) => new Response(status === 204 ? null : JSON.stringify(data ?? {}), { status });

  async function fetch(url, init = {}) {
    url = String(url); const method = init.method || "GET"; const body = init.body ? JSON.parse(init.body) : {};
    const m = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/(.*)$/);
    if (!m) throw new Error("unexpected " + method + " " + url);
    const r = repoOf(m[1]); let [path, query = ""] = m[2].split("?"); const q = new URLSearchParams(query);
    log.push(method + " " + m[2]);
    let x;
    if ((x = path.match(/^contents\/(.+)$/))) {
      const file = x[1], branch = method === "GET" ? (q.get("ref") || "main") : (body.branch || "main"), head = resolve(r, branch);
      if (!head) return res(404);
      const files = filesAt(r, head);
      if (method === "GET") {
        if (files[file]) return res(200, { sha: files[file], content: r.blobs[files[file]] });
        const inside = Object.keys(files).filter((p) => p.startsWith(file + "/") && !p.slice(file.length + 1).includes("/"));
        return inside.length ? res(200, inside.map((p) => ({ type: "file", name: p.slice(file.length + 1), sha: files[p] }))) : res(404);
      }
      if (!r.refs[branch]) return res(404);
      const next = { ...files };
      if (method === "PUT") { if (files[file] && body.sha !== files[file]) return res(409); next[file] = blob(r, body.content); }
      else if (method === "DELETE") { if (!files[file]) return res(404); delete next[file]; }
      r.refs[branch] = commit(r, tree(r, next), [head], body.message); return res(200, { commit: { sha: r.refs[branch] } });
    }
    if ((x = path.match(/^git\/matching-refs\/heads\/(.*)$/))) return res(200, Object.keys(r.refs).filter((n) => n.startsWith(x[1])).map((n) => ({ ref: "refs/heads/" + n, object: { sha: r.refs[n] } })));
    if ((x = path.match(/^git\/ref\/heads\/(.+)$/))) return r.refs[x[1]] ? res(200, { object: { sha: r.refs[x[1]] } }) : res(404);
    if (path === "git/refs" && method === "POST") { const n = body.ref.replace("refs/heads/", ""); if (r.refs[n] || !r.commits[body.sha]) return res(422); r.refs[n] = body.sha; return res(201); }
    if ((x = path.match(/^git\/refs\/heads\/(.+)$/))) {
      if (!r.refs[x[1]]) return res(422);
      if (method === "DELETE") { delete r.refs[x[1]]; return res(204); }
      if (!body.force && !ancestors(r, body.sha).has(r.refs[x[1]])) return res(422, { message: "Update is not a fast forward" });
      r.refs[x[1]] = body.sha; return res(200);
    }
    if ((x = path.match(/^compare\/(.+)\.\.\.(.+)$/))) {
      const a = resolve(r, x[1]), b = resolve(r, x[2]); if (!a || !b) return res(404);
      const A = ancestors(r, a), B = ancestors(r, b);
      const ahead = [...B].filter((s) => !A.has(s)).sort((p, c) => r.commits[p].date.localeCompare(r.commits[c].date));
      const base = [...A].filter((s) => B.has(s)).sort((p, c) => r.commits[c].date.localeCompare(r.commits[p].date))[0];
      return res(200, { ahead_by: ahead.length, behind_by: [...A].filter((s) => !B.has(s)).length, commits: ahead.map((s) => view(r, s)), merge_base_commit: view(r, base) });
    }
    if (path === "releases" && method === "POST") {
      r.releases = r.releases || [];
      if (r.releases.some((x) => x.tag_name === body.tag_name) || !r.commits[body.target_commitish]) return res(422, { message: "Validation Failed" });
      const rel = { id: r.releases.length + 1, tag_name: body.tag_name, name: body.name, body: body.body, target_commitish: body.target_commitish, created_at: new Date(clock).toISOString(), published_at: new Date(clock).toISOString() };
      r.releases.unshift(rel); return res(201, rel);
    }
    if (path === "releases" && method === "GET") return res(200, (r.releases || []).slice(0, Number(q.get("per_page") || 30)));
    if (path === "merges" && method === "POST") {
      const ours = resolve(r, body.base), theirs = resolve(r, body.head);
      if (ancestors(r, ours).has(theirs)) return res(204);
      const A = ancestors(r, ours), base = [...ancestors(r, theirs)].filter((s) => A.has(s)).sort((p, c) => r.commits[c].date.localeCompare(r.commits[p].date))[0];
      const o = filesAt(r, ours), t = filesAt(r, theirs), b0 = filesAt(r, base), out = {};
      for (const p of new Set([...Object.keys(o), ...Object.keys(t), ...Object.keys(b0)])) {
        if (o[p] === t[p] || t[p] === b0[p]) { if (o[p]) out[p] = o[p]; }
        else if (o[p] === b0[p]) { if (t[p]) out[p] = t[p]; }
        else return res(409, { message: "Merge conflict" });
      }
      r.refs[body.base] = commit(r, tree(r, out), [ours, theirs], body.commit_message); return res(201, { sha: r.refs[body.base] });
    }
    if ((x = path.match(/^commits\/([0-9a-f]{40})$/))) return r.commits[x[1]] ? res(200, view(r, x[1])) : res(404);
    if (path === "commits") { const out = []; let at = resolve(r, q.get("sha") || "main"); const seen = [...ancestors(r, at)].sort((p, c) => r.commits[c].date.localeCompare(r.commits[p].date)); return res(200, seen.slice(0, 30).map((s) => view(r, s))); }
    if ((x = path.match(/^git\/commits\/([0-9a-f]{40})$/))) { const c = r.commits[x[1]]; return c ? res(200, { sha: c.sha, tree: { sha: c.tree }, parents: c.parents.map((p) => ({ sha: p })), message: c.message }) : res(404); }
    if (path === "git/commits" && method === "POST") { if (!r.trees[body.tree]) return res(422); return res(201, { sha: commit(r, body.tree, body.parents, body.message) }); }
    if ((x = path.match(/^git\/trees\/(.+)$/))) { const s = resolve(r, x[1]); return s ? res(200, { tree: subtrees(r, filesAt(r, s)) }) : res(404); }
    if (path === "git/blobs" && method === "POST") return res(201, { sha: blob(r, body.content) });
    if ((x = path.match(/^git\/blobs\/([0-9a-f]{40})$/))) return r.blobs[x[1]] != null ? res(200, { content: r.blobs[x[1]], encoding: "base64" }) : res(404);
    if (path === "git/trees" && method === "POST") {
      const files = { ...r.trees[body.base_tree] };
      for (const e of body.tree) {
        if (e.type === "tree") { for (const p of Object.keys(files)) if (p.startsWith(e.path + "/")) delete files[p]; for (const [p, s] of Object.entries(r.trees[e.sha])) files[e.path + "/" + p] = s; }
        else if (e.sha === null) delete files[e.path]; else files[e.path] = e.sha;
      }
      return res(201, { sha: tree(r, files) });
    }
    if ((x = path.match(/^pulls\/(\d+)$/))) { const pr = (r.pulls || {})[x[1]]; return pr ? res(200, pr) : res(404); }
    if ((x = path.match(/^pulls\/(\d+)\/merge$/)) && method === "PUT") {
      const pr = (r.pulls || {})[x[1]]; if (!pr || pr.state !== "open") return res(405);
      const head = r.refs[pr.head.ref], files = filesAt(r, head);
      r.refs.main = commit(r, tree(r, files), [r.refs.main], pr.title + " (#" + pr.number + ")"); pr.state = "closed"; return res(200, { sha: r.refs.main, merged: true });
    }
    if (path.startsWith("pulls")) return res(200, Object.values(r.pulls || {}).filter((p) => p.state === "open"));
    throw new Error("unexpected " + method + " " + url);
  }
  return {
    fetch, log,
    read(repo, ref, file) { const r = repoOf(repo), s = resolve(r, ref), f = s && filesAt(r, s)[file]; return f ? Buffer.from(r.blobs[f], "base64").toString("utf8") : null; },
    refs(repo) { return { ...repoOf(repo).refs }; },
    releases(repo) { return [...(repoOf(repo).releases || [])]; },
    addPull(repo, number, branch, title) { const r = repoOf(repo); (r.pulls = r.pulls || {})[number] = { number, title, state: "open", head: { ref: branch }, user: { login: "agent" }, html_url: "https://github.com/" + repo + "/pull/" + number, body: "", created_at: new Date(clock).toISOString() }; },
    lastMessage(repo, ref) { const r = repoOf(repo); return r.commits[resolve(r, ref)].message; },
    commitOn(repo, ref, file, text, message) { const r = repoOf(repo), head = resolve(r, ref); r.refs[ref] = commit(r, tree(r, { ...filesAt(r, head), [file]: blob(r, b64(text)) }), [head], message); return r.refs[ref]; },
  };
}
