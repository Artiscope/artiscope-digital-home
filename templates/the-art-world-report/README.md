# A site built with Artiscope Digital Home from The Art World Report template

This site is edited in Artiscope Digital Home. Nothing here needs editing by
hand to change the words, the pages or the look.

- `data/pages.json`: the pages and their sections, kept by the page editor.
- `data/theme.json`: the colours, typefaces and theme settings.
- `data/content.json`: the site's details (its email address and web address), its
  features (at `features/<name>/`) and its research areas (at `research/<name>/`).
- `assets/render.js`: draws every page. The page editor uses it for its preview,
  so the preview and the published page always match.
- `tools/build.py <folder>`: builds the pages into a folder. Publishing runs it on
  every push to main (`.github/workflows/pages.yml`).

Words in square brackets are placeholders waiting for real words. In a heading,
words between stars are set in italics.

`assets/vendor/lenis.mjs` is a copy of Lenis 1.3.19 (MIT licence), the smooth
scrolling, kept in the site so nothing loads from another company.
