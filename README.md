# Artiscope Digital Home

One private console for the Artiscope websites. It shows what the
website agent has done, and lets you approve topics, publish or send
back drafts, and add photos, without opening GitHub.

## How it works

- The console is a plain web page: `index.html`, `assets/app.css` and
  `assets/app.js`. There is nothing to install and no build step.
- You sign in with a link sent to your email (Supabase).
- A single server-side function, `supabase/functions/home/index.ts`,
  checks who is signed in and then reads and writes the site
  repositories on GitHub. The GitHub token lives in Supabase as a
  secret and never reaches the browser.
- GitHub stays the home of every site. A yes in the console is saved
  to that site's `CONTENT-CALENDAR.md`. Publishing a draft merges its
  pull request. A photo is saved to that site's `inbox/` folder.

## What each screen does

| Screen | What it shows | What you can do |
|---|---|---|
| Today | What is waiting, your sites, the agent's latest log | Jump to anything waiting |
| Topics | Ideas the agent has proposed | Yes or no, with an optional note |
| Drafts | Finished pieces waiting for approval | Publish, send back with a note, or reject |
| Photos | Photos waiting to be placed, and the image spots on each site | Add one or several photos and choose the exact spot for each |
| Sites | All five sites and their status | Nothing to change here |

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
| `tests/` | Automated checks. Run `node tests/run.mjs` and `node tests/ui.mjs` |

## Adding a site

Add an entry to `SITES` at the top of
`supabase/functions/home/index.ts` (name, domain, repository, artists),
set `live: true`, and redeploy the function. The site then appears in
every screen.

## Safety

- Only email addresses listed in the `ALLOWED_EMAILS` secret can use it.
- The console can only publish pull requests whose branch starts with
  `draft/`, which are the ones the agent prepares.
- Never put a secret key, a service_role key or a GitHub token in this
  repository. It is public.
