// The fixed words a site's own code uses, read from its W(), Wt() and SW() calls:
// each gives a key and the site's own words. Used by the checks, so the console's
// list of words (WORDS on the server) and the sites never drift apart.
import fs from "node:fs";
const CALL = /\b(?:Wt?|SWh?)\(\s*(["'])([a-z]+\.[a-z0-9-]+)\1\s*,\s*(["'])((?:\\.|(?!\3).)*)\3/g;
export function wordsIn(files) {
  const out = {}, clash = [];
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    for (const m of text.matchAll(CALL)) {
      const key = m[2], words = m[4].replace(/\\(["'\\])/g, "$1");
      if (key in out && out[key] !== words) clash.push(key + ": " + JSON.stringify(out[key]) + " and " + JSON.stringify(words));
      out[key] = words;
    }
  }
  return { words: out, clash };
}
