# Artiscope Digital Home

One private console for running the Artiscope websites: edit the words,
add and remove photos, hide or delete content, and undo any change,
without opening GitHub or touching code.

Working on the console with Claude Code: start with `CLAUDE.md`, which
explains how it is put together, how to check and publish a change, and
where things stand.

## How it works

- The console is a plain web page: `index.html`, `assets/app.css` and
  `assets/app.js`. There is nothing to install and no build step.
- You sign in with a password or a link sent to your email (Supabase).
- A single server-side function, `supabase/functions/home/index.ts`,
  checks who is signed in and then reads and writes the site
  repositories on GitHub. The GitHub token lives in Supabase as a
  secret and never reaches the browser.
- Each site keeps its content in its own files, apart from its design.
  The console edits those files, and the site rebuilds and republishes
  itself in about two minutes.
- GitHub keeps every version, which is what makes History and Undo work.

## What each screen does

| Screen | What you can do |
|---|---|
| Home | Choose the site to work on and see it at a glance |
| Content | Retired on both live sites: everything it did is in Pages. Kept for sites not yet in the page editor |
| Pages | Edit every section of the page beside the real page, with its pictures |
| Theme | Colours and typefaces |
| Files | Every photo on the site: upload, describe, see where each is used, replace everywhere, delete when unused, fill places with no picture (World Art Review) |
| Photos | Add photos to exact spots. Kept for sites not yet using Files |
| History | See every change and undo the ones made here |
| Sites | See all five sites and their status |

Still to come: the code screen, payments, and creating new sites from a
template.

## Sample mode

Until `config.js` holds the Supabase publishable key, the console runs
in sample mode with example data and saves nothing. Adding `?demo` to
the address does the same at any time.

## Files

| File | Purpose |
|---|---|
| `config.js` | The Supabase address, publishable key and the server function's name. No secrets |
| `index.html`, `assets/` | The console |
| `supabase/functions/home/index.ts` | The server-side function, including the list of sites |
| `tests/` | Automated checks. Run each file with `node`, for example `node tests/console.mjs` |

## Adding a site

Add an entry to `SITES` at the top of
`supabase/functions/home/index.ts`: its name, domain, repository, and
its `collections` (which content files it has and what they hold). Set
`live: true` and redeploy the function.

## Safety

- Only email addresses listed in the `ALLOWED_EMAILS` secret can use it.
- The console can only publish pull requests whose branch starts with
  `draft/`, which are the ones the agent prepares.
- Never put a secret key, a service_role key or a GitHub token in this
  repository. It is public.

## Theme

The Theme screen changes a site's colours and typefaces. Choices are kept in `content/theme.json` (World Art Review) or `data/theme.json` (Global Art Monitor) and added to the pages when the site is built. Nothing is published until Publish is pressed, and a published theme can be undone from History. The preview shows the real homepage when the site answers, and a simple picture otherwise.

Browser tests: `PLAYWRIGHT=<path to playwright> node tests/rich.mjs` and `node tests/theme.mjs`.

## Saving, Undo and trial copies

On the live site, Save goes straight to visitors (it commits to `main`) after a short confirmation. Undo and Redo on the live site add new commits that put earlier words back, and the Recent steps list shows what can be undone. A trial copy (`adh/trial-...`) keeps its changes on its own branch with a preview at `preview/<name>/`, until "Make live" merges it into `main`. `tests/fakegit.mjs` stands in for GitHub in the tests.

## The page editor

Opening a site goes to the page editor: the sections of the page on the left, the real page in the middle, and the chosen section's settings on the right. The page redraws as you type, because the site's own code redraws from the edited section list sent to it, and nothing is kept until Save. Each site's section kinds and their fields are described on the server (`WAR_SECTIONS`). Library sections are drawn by the site itself (`LIBRARY` in `src/index.html` on World Art Review). Browser test: `node tests/pages.mjs`.

Pictures that belong to an artist or an article (kept in `content/site.json`) are listed under the section that shows them, marked Shared. A change there is saved to `content/site.json` in the same step as the page, so one Undo takes both back. The opening banner can also have a picture of its own. Descriptions given to photos are kept in `content/files.json` and offered whenever that photo is chosen again. Server checks: `node tests/files.mjs`. Browser test: `node tests/files-ui.mjs`.

Every page of World Art Review opens in the editor. Links in the preview go to the page they point at (hold Alt to pick a link instead), and the picker at the top lists every page, list, article and portfolio. Articles, portfolios and sources are described part by part on the server (`WAR_ITEMS`) and saved to `content/site.json` with the page in one step; only fields that really changed are rewritten. List headings live in `content/pages.json` under `lists`, and pages made in the console under `pages`. New articles start hidden and new portfolios unpublished. Server checks: `node tests/items.mjs`. Browser test: `node tests/edit-pages.mjs`.

Global Art Monitor is a site of separate pages. They are drawn by `assets/render.js` on that site, which both its build (`tools/build.mjs`, run by `python3 tools/build.py`) and the editor's preview use, so the preview is the published page. In the editor its articles, artist market profiles (with every sale, each figure in its own field, an empty figure shown as To confirm) and site details are described on the server (`GAM_ITEMS`) and turned back into `data/content.json`, `data/sales.json` and `data/images.json` on Save. Server checks: `node tests/gam.mjs`. Browser test: `node tests/gam-ui.mjs`.

## Deploying the server function

The workflow `.github/workflows/deploy-function.yml` deploys `supabase/functions/home/index.ts` to Supabase as `dynamic-handler` on every push that changes it (and on demand from the Actions tab). It needs the repository secret `SUPABASE_ACCESS_TOKEN`. The function's own secrets (`GITHUB_TOKEN`, `ALLOWED_EMAILS`) stay in Supabase and are not touched.

