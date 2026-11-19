#!/usr/bin/env python3
"""Builds the site's pages into a folder (a site from the Street Art Dispatch template).

Run:  python3 tools/build.py _site   (with no folder, the pages are written next to this folder)
The pages are drawn by assets/render.js (the same code the page editor in
Artiscope Digital Home uses for its preview), run here with Node through
tools/build.mjs. Articles, columns, artists, the archive, exhibitions, the
collecting figures and the glossary live in data/content.json; the sections of
each page and their words in data/pages.json; colours and typefaces chosen in
the console in data/theme.json.
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.exit(subprocess.call(["node", os.path.join(HERE, "build.mjs")] + sys.argv[1:]))
