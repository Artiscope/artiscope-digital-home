# Artiscope Digital Home: brief for Claude Code

Read all of this before doing anything. It is the standing brief for
building the console, carried over from the Claude conversation where it
was built (Versions 1 to 32, up to 13 November 2026).

## Who you work for

The owner is the Digital Product Manager at Artiscope (Grove Gallery,
London). They are not a web developer. They are building Artiscope
Digital Home, an in-house console to run the group's websites, with the
longer aim of a Shopify-like system of their own, payments included.

How they like to work. Follow this every time:

- Plain language, UK spelling, no long dashes anywhere. No jargon in what
  you tell them.
- Before building anything, list what will be built and wait for
  "go ahead". On a build with several steps, finish one step, report, and
  ask before starting the next.
- Show a visual sample before building a design (a Claude Design canvas
  has worked well). If they say "build now", build without the sample.
- Render and check your work before handing it over: look at it at
  computer and phone size.
- When they ask for code, give it in full in the conversation, not as a
  file and not as a diff, unless they ask for a file.
- Report back in short sections: what changed, how it behaves, checks
  run, and the next step as a question.

## Design rules (console and both sites)

- It must look human-made, not AI-made. No AI-looking fonts.
- No long dashes, no long horizontal lines, no hairline dividing rules.
- No boxed arrow icons or arrow buttons. Use words and spacing
  ("Previous", "Next", "Close", "Open").
- Reuse the patterns already there before inventing new ones.
- Console colours: background #F7F5FA, panels #FFFFFF, accent #52057B,
  violet #892CDC, picked #F1E6FC, text #0B0A0F, muted #5D5866. Fonts:
  Castoro and Libre Franklin. Icons are line icons in the `IC` set in
  `assets/app.js`.

## The three repositories

Clone them side by side in one folder. The tests find the two sites next
to this one, under either spelling of their names.

| Repository | What it is | Published at |
|---|---|---|
| `Artiscope/artiscope-digital-home` (this one) | The console and its server | GitHub Pages |
| `Artiscope/World-art-review` | worldartreview.com | GitHub Pages, on every push to main |
| `Artiscope/global-art-monitor` | globalartmonitor.com | GitHub Pages, on every push to main |
| `Artiscope/practice-site` | The Practice site, a copy of World Art Review for trying things out | GitHub Pages at artiscope.github.io/practice-site, unlisted, every page marked noindex |

Each site has its own `CLAUDE.md`. Those are written for the unattended
weekday agent. When the owner is here and asks for a change, their
instructions in the conversation decide what you build, but the sites'
rules on facts, sources, honesty, images and design still hold.

## How the console is put together

- `index.html` loads `config.js`, `assets/app.css` and `assets/app.js`
  with `?v=<version>`. There is no build step.
- `assets/app.js` is the whole console. `VERSION` near the top is shown
  on screen, so the owner can tell which copy is loaded.
- `index.html?demo` is sample mode: it runs with no sign-in, using sample
  data written into `assets/app.js`, `assets/demo-site.json` and
  `assets/demo-gam.json`. Add `&preview=<World Art Review address>` and
  `&gampreview=<Global Art Monitor address>` to preview local copies.
- The server is a Supabase edge function,
  `supabase/functions/home/index.ts`. It is published by
  `.github/workflows/deploy-function.yml` on every push to main. It holds
  each site's section kinds (`WAR_SECTIONS`, `GAM_SECTIONS`), cleans and
  checks everything the console saves, and writes to the site
  repositories through GitHub.

### Pages, sections and blocks

- A page is a list of sections. A section kind is defined on the server
  with `label`, `about`, `summary`, `library`, `starter`, `fields` and,
  where it has repeated parts, `blocks`.
- Blocks are the repeated parts of a section (messages, columns, slides,
  photos and so on): a `rows` field plus a `blocks` entry with `field`,
  `label`, `add` and `about`. A one-only block uses `one: true` and
  `hide`. A list of plain values uses `item`.
- Every section kind can go on any page, any number of times. A second
  copy gets its own names on the page so its behaviour works on its own.
- Each site draws the sections:
  - World Art Review: `src/index.html` (the `SECTIONS` and `LIBRARY`
    objects, styles in the same file). Build with
    `python3 tools/build_site.py <folder>`.
  - Global Art Monitor: `assets/render.js` (the `S.<kind>` functions),
    `assets/site.css` and `assets/site.js`. Build with
    `python3 tools/build.py`, which rewrites the published pages in the
    repository: commit them with the source.
- In the editor, each site tags blocks with `data-adh-b="<field>.<index>"`
  so a click on the page picks the right block.

### Adding a new section kind

1. Define it in `supabase/functions/home/index.ts` for each site that
   gets it.
2. Draw it in each site (see above), with phone styles, and add it to the
   site's list of allowed kinds: `SECTION_TYPES` in World Art Review's
   `tools/build_site.py`, `KINDS` in Global Art Monitor's
   `tools/build.mjs`. A page using a kind missing from that list will not
   publish. `tests/run.mjs` checks the console and both builds agree.
3. In `assets/app.js`, add it to `SECTION_GROUP` (its group in "Add a
   section"), `SHAPES` (the drawing in the picker), `KIND_IC` and
   `BLOCK_IC` (icons).
4. Run `npm run sync`, then the checks below, then look at it filled in
   on a real published copy of each site at both sizes.
5. Add acceptance checks to `tests/uat.mjs` for the new kind.

## Checks before every publish

```
npm install                  # once, then: npx playwright install chromium
npm run sync                 # after any change to the server or to a site's content
npm test                     # quick and browser checks, about four minutes
npm run test:all             # the same plus the full acceptance test (UAT), about eleven minutes
```

- `tests/where.mjs` finds the repositories and the browser. Set
  `WAR_DIR`, `GAM_DIR` or `CHROME` if they are somewhere unusual.
- `tests/every-section.mjs` puts every section kind of each site, twice,
  on a new page and checks it at computer and phone size. Screenshots go
  to `/tmp/look`.
- Then bump the version: `VERSION` in `assets/app.js`, every `?v=` in
  `index.html`, and the "Version N" expected in `tests/console.mjs` and
  `tests/uat.mjs`. Run `npm run sync` again afterwards.

## Publishing

- Publishing is a push to main of each repository. Publish the sites
  first, then the console, so the sites can draw anything the console
  offers.
- Pull before pushing (`git pull --rebase`). Never force push and never
  rewrite history.
- Check the publishing steps finished: `gh run list -R <repository> -L 2`.
- End commit messages with:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

## Security, never break these

- Never ask for, or accept in the conversation, the Supabase database
  password, any secret or service_role key, the GitHub token, the
  Supabase access token or anyone's password. They go only into Supabase
  or GitHub secrets.
- No secrets in any repository. The two site repositories are public.
- The owner's email address is private.
- The console may only merge pull requests whose branch starts with
  `draft/`. The weekday agents ignore comments from people outside the
  Artiscope organisation.
- Upload only photos the owner is happy to publish. Never download images
  from the web or generate pictures of artworks or people.
- Trial preview links are unlisted, not secret.
- On Shopify, the owner signs in themselves. Look only; change or save
  nothing in the store unless they ask.

## People and access

- One admin: the address in the `ALLOWED_EMAILS` secret. Everyone else is
  an editor, kept in the `people` table in Supabase (`PEOPLE_SQL` in the
  server). Row level security is on with no rules, so only the server,
  with the key Supabase gives it, can read it. The table has been made.
- The server checks every request (`personOf`): editors reach only their
  own sites, read the live site, and change only their own copy
  (`trial-own-<tag>`, one per site), which they can publish. Topics,
  agent drafts, History, Go back and People are the admin's.
- Never write an email address into GitHub: the site repositories are
  public. Changes end "(by admin)" or "(by <tag>)", a random code per
  editor; the console turns it into a name. Four early World Art Review
  commits carry the owner's address; removing them would mean rewriting
  history, which is the owner's call.
- Versions: every publish (an editor's, the admin's Make live, an agent
  draft, Go back) is the next number, kept as a GitHub release `vA.B`
  with release notes. 1.0 marks where versions began. Only the admin can
  mark a big change (a new first number) or go back. Notes carry first
  names only. The console shows the latest 10, the rest archived.
- The Practice site is a sixth site sharing World Art Review's setup. The
  admin can start it again from World Art Review (`resetPractice`).
- Sample mode as an editor: `index.html?demo&as=editor`.
- The in-memory GitHub in `tests/fakegit.mjs` joins changes file by file,
  where GitHub joins them line by line, so tests make two people change
  different files when they should join cleanly.

## Where things stand (13 November 2026, Version 32)

Done:

- Light theme with icon rail; blocks inside sections; Shopify-style
  pickers for sections and blocks; logos in the menu bar.
- An eye and a bin on every section and block row; eye, copy, Move up,
  Move down and bin at the top of the settings panel; remove asks once.
- Any section on any page, any number of times.
- New sections, batch 1: Announcement bar, Columns, Space (both sites);
  Quote, Questions and answers, Button or link (Global Art Monitor).
- Batch 2, pictures: Picture banner, Slideshow, Gallery, Logo row (both);
  Picture, Text with picture (Global Art Monitor).
- Batch 3, art and reading: Artworks, Exhibitions, Career timeline,
  Press quotes (both); Artist cards (World Art Review).
- Batch 4, the last of the set: Email sign-up and Visit us (both sites);
  Contact form (World Art Review), with its topics as blocks. Sample:
  https://claude.ai/artifact/CHjJnQp1MMq4hQtQmkayYP
  The forms send nothing themselves. They open the visitor's own email
  app with the message ready to send to info@grovegallery.com, and a line
  under the button always says so. No outside service.
- World Art Review's existing Subscribe panel (`subForm` in
  `src/index.html`) now works the same honest way: "Ask to join" opens
  the visitor's email app. It no longer says the first letter is on its
  way.
- User access (Version 32): People screen, editors with their own copy,
  Save and Save and publish, versions and release notes, the Versions
  screen, and the Practice site. Sample: https://claude.ai/artifact/53dS5mbfCJkPL8eyKmCgS6

Waiting for the owner:

- To get release emails: on each site repository, Watch, Custom, tick
  Releases.
- Real address, opening hours and travel details for Visit us. The
  section starts with them empty, shown as "[To add]". Never guess them.
- A real mailing list would need a service such as Mailchimp or
  Buttondown. That is the owner's decision; until then the email-app
  approach stays.

Notes for checking:

- In the editor a click on the page picks a section, so the form buttons
  do nothing there. `tests/uat.mjs` sends the forms directly. Each form
  keeps the email it prepared in `data-mailto`, so a check can read it.
- In a cloud session the project may not see the installed browser
  tools. Link them rather than installing a second copy:
  `ln -s "$(npm root -g)/playwright" node_modules/playwright`.

Later, in this order unless the owner says otherwise: a Code screen,
payments (Stripe), building the three new sites, extras. A comparison
with Shopify is paused until the owner sends screenshots or code.

Earlier samples and reports, for reference:

- Batch samples: https://claude.ai/artifact/N4KALiybRsBpVnFhxi9iXw (1),
  https://claude.ai/artifact/U3TsSwtRR6oUV7Wvd3cyQs (2),
  https://claude.ai/artifact/CHjJnQp1MMq4hQtQmkayYP (4)
- Blocks and pickers sample: https://claude.ai/artifact/7aTnkPvmNnGHv5MDGkPk7i
- Theme samples: https://claude.ai/artifact/3RE2FguoELV3rJxFjogSPH
- Acceptance test report: https://claude.ai/artifact/GCTYoKHrNNgnRdmj2A16cE
