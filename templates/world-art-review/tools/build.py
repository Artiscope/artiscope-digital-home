#!/usr/bin/env python3
"""Builds the site into a folder: python3 tools/build.py <folder>.
The same as tools/build_site.py, under the name every site built in Artiscope Digital Home uses."""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.exit(subprocess.call([sys.executable, os.path.join(HERE, "build_site.py")] + sys.argv[1:]))
