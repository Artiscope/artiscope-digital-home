# Artiscope Digital Home

One private console for running the Artiscope websites: edit the words,
add and remove photos, hide or delete content, and undo any change,
without opening GitHub or touching code.

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
| Content | Edit, hide or delete articles, artworks, sales and more |
| Photos | Add photos to exact spots, and remove photos |
| History | See every change and undo the ones made here |
| Sites | See all five sites and their status |

Still to come: page layouts and sections, theme colours and fonts, and
creating new sites from a template.

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
