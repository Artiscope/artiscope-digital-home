#!/usr/bin/env python3
"""Builds a site from the World Art Review template from its three parts.

  content/site.json   the words and pictures (edited in Artiscope Digital Home)
  content/theme.json  the colours and typefaces (edited in Artiscope Digital Home)
  content/pages.json  the sections of each page, in order (edited in Artiscope Digital Home)
  src/index.html      the design and layout
  -> index.html       the finished page, written to the folder you name

Run:  python3 tools/build_site.py [output folder]   (python3 tools/build.py <folder> does the same)
The site's own name, email and web address come from "site" in content/site.json. Until
its web address is connected ("indexed": true), every page asks search engines to stay away.
An entry with "hidden": true is left out of the finished page.
"""
import html
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARK = "/*@@CONTENT@@*/"
SECTION_TYPES = {"hero", "featured", "section-list", "explained", "numbers", "method",
                 "text", "text-picture", "picture", "quote", "articles", "faq", "button",
                 "page-heading", "long-text", "announcement", "columns", "space",
                 "picture-banner", "slideshow", "gallery", "logo-row",
                 "artworks", "exhibitions", "career", "press", "artist-cards",
                 "signup", "visit", "contact-form", "signup-popup"}
SHARED_TYPES = {"opening", "header", "footer"}


def check_pages(pages):
    """Refuses to build if the page list would not draw, so a bad edit
    cannot blank the site."""
    for key, part in (pages.get("shared") or {}).items():
        if not isinstance(part, dict) or part.get("type") not in SHARED_TYPES or not isinstance(part.get("settings"), dict):
            sys.exit("The shared part '%s' in content/pages.json is not something the site can draw." % key)
    for key in ("opening", "header", "footer"):
        if key not in (pages.get("shared") or {}):
            sys.exit("content/pages.json must have the shared part '%s'." % key)
    home = (pages.get("pages") or {}).get("home")
    if not home or not isinstance(home.get("sections"), list):
        sys.exit("content/pages.json must have a home page with a list of sections.")
    for key, page in (pages.get("pages") or {}).items():
        if not isinstance(page, dict) or not isinstance(page.get("sections"), list):
            sys.exit("The page '%s' in content/pages.json needs a list of sections." % key)
        seen = set()
        for sec in page["sections"]:
            if not isinstance(sec, dict) or sec.get("type") not in SECTION_TYPES:
                sys.exit("The page '%s' has a section of a kind the site cannot draw: %r" % (key, sec.get("type") if isinstance(sec, dict) else sec))
            sid = str(sec.get("id") or "")
            if not sid or not all(c.isalnum() or c in "-_" for c in sid) or sid in seen:
                sys.exit("Every section on the page '%s' needs its own id of letters, digits and hyphens: %r" % (key, sid))
            seen.add(sid)
            if not isinstance(sec.get("settings", {}), dict):
                sys.exit("The settings of section '%s' must be a list of fields." % sid)
    groups = pages.get("groups") or {}
    if not isinstance(groups, dict):
        sys.exit("The shared sections in content/pages.json must be a top and a bottom list.")
    gseen = set()
    for where in ("top", "popups", "bottom"):
        for sec in groups.get(where) or []:
            if not isinstance(sec, dict) or sec.get("type") not in SECTION_TYPES:
                sys.exit("A section shared by every page is of a kind the site cannot draw: %r" % (sec.get("type") if isinstance(sec, dict) else sec))
            sid = str(sec.get("id") or "")
            if not sid.startswith("every-") or sid in gseen:
                sys.exit("Every shared section needs its own id starting every-: %r" % sid)
            gseen.add(sid)
    # templates: the sections article and artist pages are drawn with, around their own content ("main")
    templates = pages.get("templates") or {}
    if not isinstance(templates, dict):
        sys.exit("The templates in content/pages.json must be grouped by kind of page.")
    for kind, tpls in templates.items():
        if kind not in ("article", "artist") or not isinstance(tpls, dict) or "default" not in tpls:
            sys.exit("Templates are for articles and artists, and each kind needs a default: %r" % kind)
        for tid, t in tpls.items():
            secs = t.get("sections") if isinstance(t, dict) else None
            if not isinstance(secs, list) or sum(1 for x in secs if isinstance(x, dict) and x.get("type") == "main") != 1:
                sys.exit("The template '%s' needs a list of sections with the page's own content in it once." % tid)
            for sec in secs:
                if not isinstance(sec, dict) or (sec.get("type") != "main" and sec.get("type") not in SECTION_TYPES):
                    sys.exit("The template '%s' has a section of a kind the site cannot draw." % tid)
                if sec.get("type") != "main" and not str(sec.get("id") or "").startswith("t-"):
                    sys.exit("Every section in a template needs its own id starting t-: %r" % sec.get("id"))
    if not isinstance(pages.get("assign", {}), dict):
        sys.exit("The templates chosen for articles and artists must be listed by kind.")
    if not isinstance(pages.get("lists", {}), dict):
        sys.exit("The list headings in content/pages.json must be a list of fields.")
    # changed fixed words, from Edit default text: plain words only
    words = pages.get("words", {})
    if not isinstance(words, dict) or any(not isinstance(v, str) for v in words.values()):
        sys.exit("The changed words in content/pages.json must be a list of plain words.")


def visible(items):
    return [x for x in items if not (isinstance(x, dict) and x.get("hidden") is True)]


def js(value):
    # Valid JavaScript, and safe to sit inside a <script> block.
    return json.dumps(value, ensure_ascii=False).replace("</", "<\\/")


def theme_head(path):
    """The colours and typefaces chosen in Artiscope Digital Home, as a small
    block for the page head. Empty when the theme is the original one."""
    if not os.path.exists(path):
        return ""
    theme = json.load(open(path, encoding="utf-8"))
    out = ""
    for link in theme.get("font_links") or []:
        if isinstance(link, str) and link.startswith("https://fonts.googleapis.com/css2?") and not re.search(r'["<>\s]', link):
            out += '<link href="%s" rel="stylesheet">\n' % link.replace("&", "&amp;")
    css = theme.get("css") or ""
    if css and re.fullmatch(r":root\{[^<>{}]*\}", css):
        out += '<style id="theme">%s</style>\n' % css
    rules = theme.get("rules") or ""
    if isinstance(rules, str) and rules.strip() and "<" not in rules:
        out += '<style id="theme-rules">\n%s\n</style>\n' % rules
    icon = theme.get("favicon") or ""
    if isinstance(icon, str) and re.fullmatch(r"images/[A-Za-z0-9._-]{1,120}\.(png|jpe?g|svg|ico)", icon):
        out += '<link rel="icon" href="%s">\n' % icon
    return out


def theme_social(path):
    """The social media addresses chosen in the theme, for the footer and the menu."""
    if not os.path.exists(path):
        return {}
    theme = json.load(open(path, encoding="utf-8"))
    out = {}
    for k, v in (theme.get("social") or {}).items():
        if isinstance(v, dict) and isinstance(v.get("href"), str) and re.fullmatch(r"https://[^\s<>\"'`]+", v["href"]) and isinstance(v.get("label"), str):
            out[k] = {"label": v["label"][:20], "href": v["href"]}
    return out


def address_of(site):
    a = str((site or {}).get("address") or "")
    return a.rstrip("/") + "/" if re.fullmatch(r"https://[a-z0-9.-]+(/[A-Za-z0-9._/-]*)?", a) else "https://example.org/"


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "_site")
    data = json.load(open(os.path.join(ROOT, "content", "site.json"), encoding="utf-8"))
    site = data.get("site") if isinstance(data.get("site"), dict) else {}
    pages = json.load(open(os.path.join(ROOT, "content", "pages.json"), encoding="utf-8"))
    check_pages(pages)
    template = open(os.path.join(ROOT, "src", "index.html"), encoding="utf-8").read()
    if template.count(MARK) != 1:
        sys.exit("The layout file must contain the content marker exactly once.")

    articles = visible(data["articles"])
    artists = []
    for a in data["artists"]:
        a = dict(a)
        if isinstance(a.get("works"), list):
            a["works"] = visible(a["works"])
        artists.append(a)

    block = "\n".join([
        "const SOURCES = " + js(data["sources"]) + ";",
        "const ARTISTS = " + js(artists) + ";",
        "const ARTICLES = " + js(articles) + ";",
        "const GUIDES = " + js(data["guides"]) + ";",
        "const PAGES = " + js(pages) + ";",
        "let SOCIAL = " + js(theme_social(os.path.join(ROOT, "content", "theme.json"))) + ";",
        "const SITE = " + js({"email": str(site.get("email") or ""), "address": address_of(site), "indexed": site.get("indexed") is True}) + ";",
    ])
    shared = pages.get("shared") or {}
    name = str(((shared.get("header") or {}).get("settings") or {}).get("name") or "[Site name]")
    tagline = str(((shared.get("opening") or {}).get("settings") or {}).get("tagline") or "")
    template = (template.replace("@@SITE_NAME@@", html.escape(name)).replace("@@SITE_TAGLINE@@", html.escape(tagline))
                .replace("@@ROBOTS@@", "" if site.get("indexed") is True else '<meta name="robots" content="noindex, nofollow">\n'))
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as f:
        page = template.replace(MARK, block)
        theme = theme_head(os.path.join(ROOT, "content", "theme.json"))
        if 'rel="icon" href="images/' in theme:
            page = re.sub(r'<link rel="icon"[^>]*>\n?', "", page)
        if theme:
            if page.count("</head>") != 1:
                sys.exit("The layout file must contain one </head>.")
            page = page.replace("</head>", theme + "</head>")
        f.write(page)
    # the pictures, and what search engines are told
    if os.path.isdir(os.path.join(ROOT, "images")) and os.path.abspath(out_dir) != ROOT:
        shutil.copytree(os.path.join(ROOT, "images"), os.path.join(out_dir, "images"), dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns(".gitkeep"))
    address = address_of(site)
    with open(os.path.join(out_dir, "robots.txt"), "w") as f:
        f.write("User-agent: *\nAllow: /\nSitemap: " + address + "sitemap.xml\n" if site.get("indexed") is True else "User-agent: *\nDisallow: /\n")
    if site.get("indexed") is True:
        with open(os.path.join(out_dir, "sitemap.xml"), "w") as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>' + address + "</loc></url>\n</urlset>\n")
        host = address.split("/")[2]
        if not host.endswith(".github.io") and host != "example.org":
            with open(os.path.join(out_dir, "CNAME"), "w") as f:
                f.write(host + "\n")
    open(os.path.join(out_dir, ".nojekyll"), "w").close()
    print(f"Built index.html with {len(artists)} artists and {len(articles)} articles.")


if __name__ == "__main__":
    main()
