#!/usr/bin/env python3
"""Builds the site's pages into a folder.

Run:  python3 tools/build.py _site
The pages are drawn by assets/render.js (the same code the page editor in
Artiscope Digital Home uses for its preview), run here with Node through
tools/build.mjs. The site's details are in data/content.json, its pages in
data/pages.json, and its colours and typefaces in data/theme.json.
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.exit(subprocess.call(["node", os.path.join(HERE, "build.mjs")] + sys.argv[1:]))
