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
- Console look (since Version 63): "Snow and teal", Option G of the
  colour options the owner chose on 23 November 2026 (canvas:
  https://claude.ai/artifact/XsiwECaQLDuA2yp91Y5gFZ). It is the last block
  of `assets/app.css` and wins over everything above it (the older
  "Flat and crisp" charcoal block stays above it, overridden). Read that
  last block before changing any style.
  - Flat: no glows, gradients or pressed-in shapes. Panels and cards are
    white #FFFFFF on the page #F5F8F8, told apart by a 1px edge #DDE5E5
    drawn inside (`--shadow`); menus and pickers float with a soft
    shadow (`--shadow-pop`). 16px corners on panels, 10px on buttons. No
    lines between rows.
  - Buttons white with a 1.5px edge #C9D3D3 (hover #8B9696, pressed
    #E6EDED), 34px tall. Boxes you type in are white with a 1.5px edge
    #8B9696 (`--input`, `--input-edge`, 3 to 1); focus makes it 2px teal.
    Quiet cards, counts and steps #F2F6F6 (`--field`); the preview well
    #E8EEEE.
  - One accent, deep teal #0D6767 (`--ice` keeps its old name): Save,
    Publish and the main action are the only solid colour (white words,
    bold, 40px tall, pressed #0A5656). Chosen always looks the same: fill
    #E0F0EF, teal edge and icon, words #121818 semi-bold. Links, switches
    when on, slider fill and keyboard focus are teal.
  - Words #2B3333, headings #121818, muted #56605F, turned off #646E6D.
    Every word colour is at least 4.5 to 1 on what it sits on. Status
    only as 9px dots or words: green #1F7444, amber #8A5800, red #B3261E.
    Remove is red words on an ordinary button.
  - Labels are 12px sentence case, semi-bold, muted (no small capitals).
    Fonts: Castoro for headings (40px greeting), Libre Franklin 14px for
    words. Outline icons only, from the `IC` set in `assets/app.js`.
  - A new control uses an existing surface and state, never a new colour.
  - Where you are (Version 64): a side menu 236px wide with words beside
    the icons (`viewRail`, `navHtml`, `navButton`), the site's name and
    mode under All sites (`.railsite`); a path at the top of every screen
    (`crumbs`: All sites / site / screen) and the mode marker beside it
    (`.island`, `islandClass`: green edge for the live site or a shop,
    amber for a trial copy or an editor's own copy). "Undo the last save"
    and "Redo" sit in the marker only when there is one to take back. A
    site opens on its Overview (`openSite`), whose main button is Edit
    pages. Under 901px the menu is still the strip at the top until step 5.
  - One main action per screen (Version 65): solid teal only for it
    (`.btn.key`): Start a new site on All sites, Edit pages on a site's
    Overview, Choose photos on Files, Invite an editor on People, Add a
    product on Products, Save in the editor. All sites: a live site's
    whole card opens it (its name is the `.hopen` button with
    `data-act="open-site"`, stretched over the card; no Open button),
    practice and sites to build are quiet rows (`.hquiet`), the counts are
    a sentence (`.hcounts`). Overview: Needs you first (`.needs`, `.need`:
    photos with no description, places with no picture, empty photo
    spots, trial copies with changes not live, an editor's copy behind or
    ahead; `ov-files` opens Files at that filter), then three quiet tiles
    (Theme, Files or Photos, Versions; History when one is missing), then
    the copies. Files are read on the Overview too, for Needs you.
  - The editor (Version 66): the top bar in three groups (`edTop`):
    Exit, the site and the page on the left; the Sections, Theme and
    Add-ons switches in words in the middle (`.edsw`, icons dropped below
    1500px); inspector, view, undo, More and Save on the right, with
    names shortened below 1400 and 1200 so it fits from 1120. From 1280
    to 1799 wide the list, preview and settings sit side by side (300,
    the rest, 320); below 1280 the settings sit under the list. The
    floating bar over the preview is gone (`edFloatBar` returns
    nothing): the picked item's Hide, Duplicate, Move up and Move down
    are words, two to a row, at the top of its settings (`edTools`,
    `.ptools`). The picked outline, name tag and plus in every site's
    editor link are teal #0D6767 with white words.
  - Step 5 of the agreed UI plan is still to come (phone): it waits for
    the owner's go ahead.
  - All sites (`viewHome`): live sites three to a row, each with a small
    picture of its home page (an iframe laid out 1280 wide and scaled,
    `homeFit`), then the Practice site and the sites still to build on
    quieter cards with Start building; new versions below.
  - The owner chose (17 November) to keep the editor's full-screen layout
    and every control; only the look changed.

## The repositories

Clone them side by side in one folder. The tests find the sites next
to this one, under either spelling of their names (or set `WAR_DIR`,
`GAM_DIR`, `SAD_DIR`).

| Repository | What it is | Published at |
|---|---|---|
| `Artiscope/artiscope-digital-home` (this one) | The console and its server | GitHub Pages |
| `Artiscope/World-art-review` | worldartreview.com | GitHub Pages, on every push to main |
| `Artiscope/global-art-monitor` | globalartmonitor.com | GitHub Pages, on every push to main |
| `Artiscope/street-art-dispatch` | streetartdispatch.com. Its words are all in `data/content.json`; `tools/build.py <folder>` builds every page on publish, and no built pages are kept in the repository | GitHub Pages, on every push to main |
| `Artiscope/practice-site` | The Practice site, a copy of World Art Review for trying things out | GitHub Pages at artiscope.github.io/practice-site, unlisted, every page marked noindex |
| `Artiscope/the-art-correspondent` | theartcorrespondent.com, a site of The Art Correspondent template, listed in `sites.json` (`site-4`). Built by `tools/build.py <folder>` on publish; no built pages in the repository | GitHub Pages through GitHub Actions, on every push to main |

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
  data written into `assets/app.js`, `assets/demo-site.json`,
  `assets/demo-gam.json` and `assets/demo-sad.json`. Add `&preview=<World Art Review address>` and
  `&gampreview=<Global Art Monitor address>` and
  `&sadpreview=<Street Art Dispatch address>` to preview local copies.
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

## Where things stand (23 November 2026, Version 66)

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
- Street Art Dispatch is the third site, and since Version 34 it works
  exactly like Global Art Monitor: page editor, the same "Add a section"
  list, Theme, Files, Versions and History, articles and artists as pages
  in the page list, and "Issue details, archive and glossary" across the
  site. Its pages are drawn by its own `assets/render.js` (run by
  `tools/build.mjs`, which `python3 tools/build.py <folder>` runs) from
  `data/content.json`, `data/pages.json` and `data/theme.json`.
  On the server it has `SAD_SECTIONS`, `SAD_ITEMS` and `SAD_MODEL`
  (`sadForEditor`, `sadFromEditor`). Sites drawn from their own data have
  a `model` (`GAM_MODEL`, `SAD_MODEL`) that loads, opens and saves them;
  `gam: true` in the console means "a site with a model", and
  `pgd.model` says which. Archive years are a whole number or "TBC".
  Hidden articles get no page. An artist's web address stays the same
  when their name changes. Checks: `tests/dispatch.mjs`, the "Street Art
  Dispatch" area of `tests/uat.mjs`, and `tests/every-section.mjs`.
- The standard for every new site (follow it for the three still to
  build): its pages in a page list file (`shared` header and footer,
  `pages` with `path`, `title`, `description`, `sections`), a theme file,
  a content file, a drawing program used both by the build and by the
  console's preview, the editor link in its script (the `adh-pages`,
  `adh-pick`, `adh-click`, `adh-nav` messages and the `data-adh` and
  `data-adh-b` tags), and every section in the shared set: announcement,
  columns, space, quote, faq, button, picture-banner, slideshow, gallery,
  logo-row, picture, text-picture, artworks, exhibitions, career, press,
  signup, visit and contact-form, drawn in the site's own look.
  `tests/run.mjs` fails if a site does not offer one of them.
- Words saved through Content on any site lose anything that could run
  on a page (`safeMarks` on the server), keeping ordinary formatting.

- The Shopify-style editor, step 1 of 9 (Version 35), from the owner's
  reference document: the charcoal and silver look on every screen, and
  the page editor as a full screen with its own top bar (Exit, the
  Sections, Theme settings and Add-ons switches with Ctrl+Alt+1 to 3, the
  site button with its lamp and copies, the page picker with search and
  kinds of page, Inspector with Alt+Shift+I, Computer and Phone, Undo,
  Redo, More, and a split Save that stays off until something changes).
  There is no side menu in the editor: Exit leads back to it, and tests
  use `goTab` from `tests/where.mjs`. The old page list `select.pagepick`
  stays on the page, out of sight, so checks can still choose a page.
  With the inspector off the preview loads without the editor link, so
  links work and nothing is picked; turning it on loads it again with the
  unsaved changes. Under 1800 pixels wide the settings sit under the list
  in the left column. Theme settings, Add-ons and Edit code came in
  steps 6 and 9; Edit default text is still a placeholder.
  Version 36 finished step 1 against the updated brief
  ("Digital Home page editor: build prompt, Shopify reference and chosen
  look", 16 November 2026, 49 pages): silver only on Save and Publish,
  22px corners, small capital headings, no glass, an outline house, the
  site button says Live, Trial copy: name or Your copy with the save state
  beside Save, Publish later first in Save's dropdown (a later step), Home
  page first in the page picker, Cmd on a Mac, Ctrl/Cmd+Shift+I or
  Alt+Shift+I for the inspector, and charcoal picked outlines and name
  tags in all four sites' editor link.
  The owner agreed (16 November): no free images, add-ons only on our own
  code (no analytics, cookie or review services), own MP4 videos only, no
  arrows (words instead), Undo means unsaved edits (Go back on Versions
  for saved ones), Remove without a question, selling-art theme groups
  marked "Not used on this site", a second shortcut where the browser
  keeps one, and plain group names (Top of every page, Popups, This page,
  Bottom of every page).
  Step 2, the sections list (Version 37):
  - Three groups: Top of every page (opening screen, menu bar, then
    `groups.top`), This page, Bottom of every page (`groups.bottom`, then
    the footer), each ending with an Add section button (`data-g`).
    Sections shared by every page live in the page list file under
    `groups: {top: [], bottom: []}`, with ids starting `every-`. Each
    site draws them on every page, articles and artists included:
    announcement bars above the menu bar, the rest after the menu bar
    (after an opening banner that holds it) and above the footer
    (`groupHTML` in World Art Review, `groupHtml` in the other two). The
    editor link reports a click on one with `view: "every"`.
  - Rows: a name the owner gives (`name`, never shown to visitors), the
    block count opens and closes the blocks, a drag handle in place of
    the icon on hover, eye and bin. Blocks read "Kind: first words" with
    a small picture. Lists of blocks can have a limit (`max` on the rows
    field and its block; slides 10, logos 12) and Add then reads
    "(10 of 10)" and turns off.
  - Drag sections within their group and blocks within their section.
  - Right-click menu: Copy, Paste, Duplicate, Rename (in place, Enter
    keeps, Escape cancels), Hide or Show, Add section before and after,
    Edit code (later step), Remove. Ctrl/Cmd+Shift+H (or Alt+Shift+H)
    hides, Shift+Delete removes.
  - Remove happens at once, with "Put it back" above the preview, until
    the session undo of step 8.
  - The main section of a page the site was built with (not the home
    page: the first section after its heading, `mainSectionOf` on the
    server, `mainId` in the console) has no Remove; the server refuses
    it too.
  Version 38 finished step 2:
  - Every Add button reads "Add a section" (or "Add a popup" in the
    Popups group). Clicking a picked section's row again folds its
    blocks away.
  - Popups group (`groups.popups`, up to 3): only kinds with
    `popup: true` go there, and they go nowhere else; the server refuses
    both mistakes. The first is `signup-popup` (heading, text, button,
    delay 3 to 60 seconds) on all three sites, class `supop`. It opens
    the visitor's email app like the other forms, shows once a visit
    after its delay, never in the editor, and only while picked there.
  - Blocks inside blocks: a block kind may have its own `blocks`. The
    first is World Art Review's footer, columns then links. A picked
    child carries `sf` and `sub`; its parent stays drawn in the preview.
  - Pages with their own layout (`own: true`, only on pages made in the
    console): no menu bar, footer or shared Top and Bottom sections,
    popups still shown. Set when making the page or under its settings.
  - Pages the site draws itself (search, Page not found) show a fixed
    row: only the shared groups can be changed for them.
  Step 3, the settings panel (Version 39):
  - Header (`pHead`): Section, Block or Settings, More (Rename, Hide or
    Show, Edit code later) and Close, then the icon and the name. It stays
    in place while the settings scroll. A section's name changes by
    clicking it (Enter keeps, Escape cancels). Remove section or Remove
    block sits at the bottom in red (`pRemove`), never for a main section
    or the shared frame.
  - Settings follow the schema's order; those with a `group` sit under a
    small heading of that name (`grouped`). `hint` is grey help, `more` a
    Learn more link.
  - Controls by `type`: text (a link field with the site's pages when
    `addr`, or named href, url or map), long, lines, number, `range`
    (slider and number box: `min`, `max`, `step`, `unit`, `dflt`),
    `yesno` (a switch), choice (side by side when 2 to 4 short options,
    or `seg`; a dropdown otherwise or with `select`), `colour` (swatch,
    hex, and a picker with square, hue strip, theme colours, eyedropper),
    `image` (Select, Upload, Change, Remove), `video` (own MP4 from the
    site's files or an https link to an .mp4), `font` (opens in the panel;
    `fonts` on the field, or the theme's list; value "Family", "Family:700"
    or "Family:400i"), `datetime` ("YYYY-MM-DDTHH:MM", five dropdowns),
    `info` (a grey note, `go` opens a screen), `set` (numbered groups such
    as Slide 1 and 2, `count`, each with an `on` switch), rows, artists
    and the pickers already there. The server cleans each type
    (`cleanField`). No section uses video, font, date or numbered groups
    yet; they are ready for when one does.
  - Custom CSS (`sec.css`, a folding box with line numbers on sections
    in the page and group lists): the server cleans it (`cleanCss`: no
    imports, no url(), no code); each site limits every rule to that
    section (`scopeCss`, `cssMark`, the root gets `data-css="<id>"`).
    `:scope` or `&` means the section itself. The owner said yes on
    17 November, so the box is on (`state.customCss: true`). World Art Review puts it
    in `style#sec-css`, the other two in `style[data-sec-css]` in the head.
  - The address keeps `?ed=<site>~<page or at>~<where.id.block.bf.sf.sub>`
    (`edAddress`), and opening such a link goes straight there.
  - Checks: the "Settings panel" area of `tests/uat.mjs`, and the step 3
    lines in `tests/run.mjs`.
  Step 4, the pickers (Version 40):
  - Add a section and Add a block have two tabs (Sections or Blocks, and
    Add-ons, empty until step 9). "Most used on this site" lists up to
    four kinds used more than once (`usageCounts`); searching hides it.
    Add a block is the short picker with no preview side, and blocks that
    are one per section, or whose list is full, drop out. Escape closes
    any picker. The plus lines between rows were already there (step 2).
  - Link fields open the site's kinds of page (`linkGroups`: pages, lists,
    articles, artists; site paths on Global Art Monitor and Street Art
    Dispatch), each with its own list, or match what is typed.
  - The image library (`edLibrary`, `pgd.lib`) opens from Select or Change
    on any picture or video setting: search, sort, grid or list, filters
    (file size from `imageSizes` sent by the server, used or not, artist),
    Add files or drag and drop (kept as uploads, saved with the page), a
    tick per file, Cancel and Done (off until a file is ticked).
  - One artist (`artists` with `one`), one article (`piece`) and `menu`
    settings use `resField`: Select, then a rounded tag with a thumbnail.
    The tag's menu: Replace (search, list, Create artist or article),
    Edit (opens that page in the editor), Connect stored data (shown, off
    until templates in step 7) and Remove. Menus are Main menu and Footer
    menu; Create menu is shown off. No section uses `menu` yet.
  - Checks: the "Pickers" area of `tests/uat.mjs`.
  Step 5, the preview inspector (Version 41):
  - Each site's editor link draws `#adh-hover` (on the html element, so
    redraws of the page keep it): an outline and a name tag on whatever
    the pointer is over, dashed for a block, with a plus in the middle of
    its top and bottom edges. The names come from the console in
    `adh-pages` (`names`, from `previewNames`: section names and
    "<id>:<block field>" labels). `whatAt` finds the section or block.
    The menu bar, footer and parts of article and artist pages show no
    plus; their blocks do.
  - A plus sends `adh-add` (id, block, bf, view, edge). The console
    (`previewAdd`) picks it, then opens Add a section at that place in
    its list, or Add a block at that place in its section (straight in
    when only one kind fits).
  - The floating bar (`edFloatBar`, `#ed-fbar` at the bottom of the
    preview) shows the picked item's name with Duplicate, Hide or Show and
    Remove, as each is allowed. It hides with the inspector off, and
    while a picker or the library is open.
  - Checks: the "Inspector" area of `tests/uat.mjs`.
  Step 6, theme settings (Version 42):
  - The Theme settings switch opens `themePanel` in the left column: the
    groups of the brief in order (`THEME_GROUPS`), one open at a time
    (`state.themeGroup`, kept in the address as `tg=`). The right panel
    closes while it is open, except for the font picker.
  - The owner chose (17 November) to rework all three sites so heading,
    body and menu sizes can be set: every font size in each site's styles
    is multiplied by `var(--h-scale, 1)`, `var(--b-scale, 1)` or
    `var(--nav-scale, 1)` (done once by a script; keep it so when adding
    styles). Untouched, nothing changes.
  - Settings (`THEME_SETTINGS` on the server, kept in the theme file under
    `settings`): heading and body size, letter spacing and line height
    (sliders with "the site's own", stored as null), heading capitals,
    menu typeface, size and capitals, text direction, corners, button
    style, seven social networks (https only), favicon (a file already in
    the site's pictures), breadcrumbs (World Art Review only, via
    `look.crumbs`), and site-wide Custom CSS (`cleanCss`).
  - Sizes become variables in the theme's `:root{}` (`themeCss`); the rest
    become `rules` (`themeRules`, using each site's `theme.look`
    selectors), which every site's build writes as `style#theme-rules`.
    `themeFile` also writes `social` (shown at the foot of every page:
    on World Art Review in place of the dead network links in the footer
    and menu, on the other two as `.foot-social`; nothing until an address
    is filled in) and `favicon` (replaces the site's own icon link).
  - Artworks, Artwork cards, Collection cards, Enquiries, Search and
    Icons say "Not used on this site", as agreed.
  - Theme style: the ready-made looks (and the site's own), Cancel and
    Change style, which puts back the look's colours and the site's own
    typography and design, never content.
  - The editor's Save also saves the theme (`saveTheme`), and Discard puts
    it back. The preview gets the theme through `adh-theme` (`themePush`)
    and the social links through `adh-pages`.
  - Every section's panel has a folding Theme settings box (`themeBox`)
    with the site's colours and typefaces and "Open theme settings".
  - Checks: the "Theme settings" area of `tests/uat.mjs`, the settings in
    `tests/content.mjs`, the console and server sums agreeing in
    `tests/theme.mjs`, and each site's build in `tests/run.mjs`.
  Fixes after step 6 (Version 43):
  - Global Art Monitor's opening banner keeps `{tagline}`, `{headline}`
    and `{intro}` in its settings, words shared with Site details. The
    panel shows the real words (`sharedWord`), and typing changes Site
    details (`data-site-word`). "Use different words here only"
    (`ed-unshare`) copies the words into that section's own setting.
  - The computer preview always lays the page out 1280 pixels wide and
    scales it down to fit (`edFit`, `edFitWatch`), so the menu bars stay
    whole when the settings panel is open. Tests clicking small things in
    the preview use a real mouse (`mouseIn` in `tests/uat.mjs`), since
    Playwright's own click lands off target in a scaled frame.
  - The name tag on a picked block sits above everything on the page,
    sticky menu bars included, in all four sites.
  Step 7, templates (Version 44). Sample:
  https://claude.ai/artifact/9UGjHLj2j5XJWERrzXL3kw
  - Article and artist pages are drawn from templates, kept in the page
    list file: `templates: {article: {default: {name, sections}, <id>:
    ...}, artist: {...}}` and `assign: {article: {<slug>: <id>}}` (the
    default is never written in `assign`). A template's sections hold the
    page's own content once, as `{id: "main", type: "main"}`, which can be
    moved but not removed or hidden; the others have ids starting `t-`.
    Untouched, the default is just the main section, so nothing changes.
  - Server: `cleanPages` checks and fills them (`TEMPLATE_KINDS`,
    `TPL_ID`, `TPL_SEC`, `templateName`: up to 10 templates a kind,
    names of 25 characters at most and different, unknown articles or
    templates dropped from `assign`). Summaries are keyed
    `tpl:<kind>:<id>:<section id>`.
  - Sites: `tplWrap` puts the sections around the page's own content
    (World Art Review through `TPL_NOW` in `shell`, the other two in
    `artistPage`, `featurePage` or `articlePage`). The preview message
    carries `templates`, `assign` and `tpl` (the template being edited,
    `window.ADH_TPL` or `opts.tpl`); the editor link reports a click on
    a template section with `view: "tpl"`. Each build refuses a template
    without its main section or with a section id not starting `t-`.
  - Console: `where: "tpl"` is a list of sections like the page's
    (`secList`, `isSecList`), the template being edited is `tplId`
    (`pgd.tplOpen[kind]`, or the item's own). The page picker counts
    templates, lists them under Articles and Artists (star for the
    default, "Used by", Create template) above the items, and shows
    Artworks, Collections of works and Exhibitions (and Auction results
    on Global Art Monitor) greyed with Used by 0. "Create a content type
    template" lists those kinds as "Comes later", as agreed. The left
    column shows the template's name, Rename and Remove template (only
    when unused, never the default), and "Preview:" with a pencil to show
    another article or artist (`tplExPop`). The page's own parts are the
    blocks of its main row (`tplMainRow`). Create template is a dialog
    (`tplDialog`: name with "0 of 25", Based on, Cancel and Create
    template, off until a new name is typed). An item's template is
    chosen in its own Settings (`tplChoice`, `tplPartId`), not on a
    Pages screen, since Pages opens the editor itself.
  - Checks: the "Templates" area of `tests/uat.mjs`, and the step 7 block
    in `tests/run.mjs`.
  Stored data (Version 45, owner's yes on 17 November):
  - In a template's sections, a setting can take its value from the page
    it is drawn on: text, long text and lines connect to `{page.title}`
    or `{page.summary}`, one artist to `{page.artist}` (this artist, or
    an article's first artist where articles name artists) and one
    article to `{page.article}` (`storedOptions`, `storedTag`,
    `storedLink`, and Connect stored data in `resField`'s menu). Each
    site fills them in `tplWrap` with `pageFill`. The server keeps the
    artist and article ones only inside templates (`site.tplKind`).
  Step 8, undo and saving (Version 45):
  - Undo and Redo in the top bar are for changes not saved yet, kept per
    page or template (`locKey`). Every change is noted in `pgMark` by
    `histNote` as the places it touched, before and after (`diffInto`),
    so one page's Undo never takes back another's. Typing in one box with
    pauses under 1.5 seconds is one step. Undo selects what it changed
    (`histGo`; a removed section is picked again via `histSel`). Save
    turns off again once everything is undone. History starts afresh on
    loading, Discard and Save (`histBase`).
  - The Changes list: a count beside Save ("3 changes") opens every
    unsaved change in plain words (`histLabel`, for example "Numbers
    band: Small line above the heading changed to ...") with where it is
    and its own Undo (`changesPop`, `histUndoOne`).
  - Undo the last save and Redo the last save moved to Save's dropdown.
  - Shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z, Ctrl/Cmd+S,
    Ctrl/Cmd+/ (`ED_KEYS`). In a text box the box keeps its own undo.
  - Publish later (owner chose to build it fully): the admin picks a
    date and time, London time (`laterPop`). The server makes a copy
    `adh/trial-later-<UTC yyyymmddhhmm>-<tail>` (`scheduleCopy`,
    `laterId`, `fromLondon`) and the changes are saved there
    (`savePages(after, later)`). The copy shows as "Publish later: 1
    December 2026, 09:00"; it can be made live early or deleted like any
    trial copy, and does not count towards the two trial copies. The
    clock is `.github/workflows/publish-later.yml` in this repository,
    every 15 minutes, calling the function with `x-schedule-key`; the
    server checks it against the `SCHEDULE_KEY` secret and runs
    `runLater`: each copy whose time has come is merged into main with a
    new version and release note, and the copy deleted. One that clashes
    with live is kept as "Could not publish later" (`trial-held-...`).
    Without `SCHEDULE_KEY` in both Supabase and GitHub, scheduling is
    refused with a plain message.
  - Checks: the "Stored data" and "Undo and changes" areas of
    `tests/uat.mjs`, and the step 8 block in `tests/run.mjs`.
  Step 9, add-ons and Edit code (Version 46). Sample:
  https://claude.ai/artifact/VJXnrCx1P8Fom3vEvie7Rz
  - Add-ons, all our own code, nothing sent to other companies: Back to
    top button, Reading progress, Share links (email, X, LinkedIn,
    Facebook as plain links) and Privacy notice. Defined in `ADDONS` on
    the server (fields and start values), cleaned by `cleanAddons`, kept
    in the page list file under `addons`, and sent to the console as
    `addonSpec`. Each site draws them with `aoHtml` (share links before
    the shared Bottom group, the rest at the very end) and wires them with
    `aoWire` (Top shows after the scroll distance and sits above World Art
    Review's dock; the privacy notice remembers Close in the visitor's
    browser; nothing moves or remembers in the editor). Reading progress
    and Share links choose their pages: articles, articles and artist
    pages, or every page (progress only). Classes start `ao-`.
  - Console: the Add-ons switch opens `addonsPanel` (search, a switch
    per add-on with `data-pf="addon:<id>.on"`, Settings opens its fields
    through `edField` with `addon:<id>.<field>` paths). The Add-ons tab
    in Add a section lists them On or Off and points to the panel.
  - Edit code (admin only), from More, a row's right-click menu or the
    settings panel's More (which open at that section's drawing,
    `codeFind`). `viewCode` is its own full screen: Back to the editor,
    the site with its lamp (Live site or Code changes), Search all
    files, Go to file (Ctrl/Cmd+P), Commands (Ctrl/Cmd+Shift+P, with Go
    to line, Ctrl/Cmd+G), the changed count, and Save to the trial copy
    (Ctrl/Cmd+S). Files are grouped by what they do; the settings and
    words files are read only here. Tabs with Close, a line gutter, an
    outline (`codeOutline`) and the build status line.
  - Each site lists its files in `code: {edit, read}` on the server.
    `codeOpen`, `codeSave` and `codeStatus` read from and save to the
    trial copy `adh/trial-code-changes` only (`CODE_COPY`, named "Code
    changes", not counted in the two trial copies), made from live on the
    first save. Every push to an `adh/` branch runs the site's
    `.github/workflows/check-copy.yml`, which builds the copy the way
    publishing does and publishes nothing. `codeCheck` reads that run;
    `publish` refuses the code copy until it has passed, never forces it
    over live on a clash, and deletes the copy once it is live, so the
    next code change starts again from live. The console asks for the
    status every 15 seconds while checking.
  - The GitHub key needs Actions: Read on each site repository for the
    check to be read; without it the status line says so plainly.
  - Checks: the "Add-ons" and "Edit code" areas of `tests/uat.mjs`
    (`hub.setRun` in `tests/fakegit.mjs` sets a check's result), and the
    step 9 block in `tests/run.mjs`.
  Edit default text came later, in Version 52 (below).
- Version 47: the Flat and crisp look (see Design rules), and the
  picked outline, name tag and plus in all four sites' editor link turned
  ice blue (#8EC5FF, words #0E1A26), with no halo.
- Next, agreed on 17 November: building a new site from the console.
  Step 2 is a sample of the Start building screens, then step 3 a starter
  site (kept as `starter/` in this repository) drawing every shared section and block,
  with the list of sites kept where the console can add to it; step 4 the
  Start building screens (name, tagline, web address, contact email,
  starting look from the ready-made looks or an existing site, starting
  pages blank or copied with placeholder words), Create making the
  repository, switching on GitHub Pages and opening the editor, and the
  DNS records shown for the owner to add; step 5 articles and artist
  pages with templates. The owner chose that the tool makes the
  repository: the GitHub key will need permission to create repositories
  and manage Pages in the Artiscope organisation (the owner sets it).
  Sample of the screens, approved 17 November:
  https://claude.ai/artifact/Be2WCf55vjt2Wj6zR6DkXh
  Owner's decisions (17 November): new sites get the shared 20 sections
  only (the 19 of the standard plus the sign-up popup). A shared
  "Practice build" (repository Artiscope/practice-build) gets its own
  card on All sites: any test user given it in People can run Start
  building and do everything there an admin can (Save, publish,
  Versions, Theme, Edit code), and Start again, after one question,
  wipes it back to empty. It never gets a web address and stays hidden
  from search engines.
- Step 3 (Version 48, 18 November): the starter, the list of sites, the
  practice build and the People fix.
  - The starter lives in `starter/` in this repository (this session
    cannot make repositories; step 4 copies it into each new one). It is a
    site in the Street Art Dispatch pattern: `assets/render.js` (the
    STARTER module, used by the build and the console preview),
    `assets/site.css` (colours and typefaces from the theme only, through
    `--page`, `--band`, `--accent`, `--ink`, `--display`, `--text`,
    `--sans`), `assets/site.js` (editor link, menu, sign-up, add-ons),
    `tools/build.mjs` run by `tools/build.py <folder>`, `data/` (pages,
    content with `site.email`, `site.address` and `site.indexed`, theme,
    files) and `.github/workflows` (pages, check-copy, preview). Its
    `package.json` says commonjs, because this repository's says module.
    Every page carries noindex and robots.txt says Disallow until
    `site.indexed` is true; CNAME is written only then, and never for a
    github.io address. It offers the shared 20 only (`STARTER_KINDS` on
    the server, `KINDS` in its build), with every sample word in square
    brackets (`ST_BRACKET`).
  - Server: `STARTER_SECTIONS`, `STARTER_ITEMS`, `STARTER_MODEL`
    (`starterForEditor`, `starterFromEditor`: only the email for now),
    `STARTER_LOOKS`, `STARTER_THEME`, `starterSite(e)`.
  - The list of sites: the four built-in sites and the Practice site stay
    in the code (`BUILT_IN`); every other site comes from `sites.json` at
    the top of this repository (`CONSOLE_REPO`), read by `loadSiteList`
    at most every 30 seconds and checked by `cleanSiteList` (`id`, `name`,
    `domain`, `repo`, `kind: "starter"`, `playground`, `live`; a site
    without a repository is never live). Without the file the console
    uses `DEFAULT_SITE_LIST`: the practice build (not live), Site 4 and
    Site 5.
  - The practice build (`playground: true`, repository
    Artiscope/practice-build, address artiscope.github.io/practice-build):
    `asOn` makes anyone given it in People the admin there, and only
    there (`youAdmin` on the site; the console's `isAdmin` and
    `openSite` follow it). Start again (`startAgain`, a card on its
    Overview, asks once) puts the starter back with `starterInto`, keeps
    its address and `.github`, and deletes every `adh/` copy.
  - People: `PEOPLE_SQL` now ends with the two grant lines, and a 42501
    from Supabase shows `GRANT_HELP` in plain words.
  - Previews of new copies: each site's `preview.yml` also runs on
    `create`, so a copy's preview is built when the copy is made. Until it
    exists (`pageMissing`, a quick check for a 404), the editor shows the
    live site with the unsaved changes on top, and a line saying the
    copy's own preview is still being made (`previewWaiting`,
    `viewWaiting`).
  - Checks: the "Practice build" area of `tests/uat.mjs`, and the step 3
    block in `tests/run.mjs`.
  - The practice build is live (18 November): the owner made
    Artiscope/practice-build and added it to the GitHub key, the starter
    was pushed to it with the address
    `https://artiscope.github.io/practice-build/`, and both `sites.json`
    and `DEFAULT_SITE_LIST` mark it `live: true`.
- Step 4 (Version 49, 18 November): Start building, from the approved
  sample (https://claude.ai/artifact/Be2WCf55vjt2Wj6zR6DkXh).
  - Console (`startBuild`, `viewBuild`, `bdAct`, `state.build`): a full
    screen with Close, the four steps (About the site, Look, Pages, Check
    and create), Previous and Next, and on the right a preview of the
    home page drawn by the starter's own `starter/assets/render.js`
    (loaded from the console's address, written into a sandboxed srcdoc
    frame without its scripts; Computer at 1280 wide scaled, Phone at
    390). Opening a site still to build as the admin starts it; the
    practice build has a Start building card on its Overview. Then the
    Ready screen (`viewBuildDone`): what was done, Open the editor, and the
    web address records (`domainCard`) with Check.
  - Server: `cleanBuild` (name, tagline, web address via `cleanDomain`,
    registrar 123-reg, GoDaddy or somewhere else, email, look, pages
    "home", "set" or "copy" with `from`), `buildLooks` (the twelve
    `STARTER_LOOKS` with typefaces and corners from `BUILD_LOOK_TYPE`),
    `planFiles` and `planSite` (the three data files; `nameInto` puts the
    name and tagline in), the ready set (`BUILD_SET`: Home, About,
    Artists, Exhibitions, Visit us, Contact), `copyLayout` (another site's
    pages and section order; its own kinds become the nearest shared one
    by `BUILD_NEAR`, or are left out, and both are listed). Every word not
    given stays in square brackets; Visit us starts empty.
  - `createSite`: for a site still to build, makes `Artiscope/<slug of
    the name>` (POST /orgs/Artiscope/repos, auto_init), switches Pages to
    GitHub Actions, writes the whole starter with the planned files
    (`starterInto` with `files` and `github`), marks version 1.0 and adds
    the site to `sites.json` (`changeSiteList`) keeping its card id
    (site-4), with `want` (the domain to connect), `registrar` and
    `todo`. Whatever GitHub refuses after the repository exists
    (publishing steps without the Workflows permission, Pages) is noted
    in `todo`; Finish setting up on the site's Overview runs
    `finishSite`, which adds only what is missing (`starterInto` with
    `only: ".github/"`). For the practice build it rewrites the practice
    build in place and deletes its copies; no repository is made.
  - `checkDomain`: asks dns.google for the domain's A records and the
    www CNAME; once every A record is one of `GITHUB_IPS`, sets the Pages
    custom domain and https, writes `site.address` and `indexed: true`
    to `data/content.json` (search engines let in) and moves the site's
    `domain` in `sites.json`. The console never touches DNS.
  - A new site's first publish takes a minute or two: until its page
    answers, the editor says so (`previewWaiting: "first"`).
  - Planning, creating, Finish and Check are the admin's, except that
    anyone given the practice build can rebuild it.
  - Sample mode: `assets/demo-build.json`, written by
    `tests/tools/demo-starter.mjs` from the server's own code.
  - Checks: `tests/build.mjs` (22 checks, in `run-all`), the "Start
    building" area of `tests/uat.mjs` (`tests/fakegit.mjs` now makes
    repositories, keeps Pages settings, and `hub.refuse` and
    `hub.refuseSteps` take permissions away).
  - The GitHub key needs, for Create site: All repositories in the
    Artiscope organisation, with Administration, Contents, Pages,
    Workflows and Pull requests set to Read and write, and Actions Read.

- Step 5 (Version 50, 18 November): articles and artist pages on every
  site built in the console, from the approved sample
  (https://claude.ai/artifact/DHjcXbzGsNq27cChZt9d9n).
  - Content: `data/content.json` holds `articles` (slug, title, kicker,
    summary, date as written, artist (one artist's slug), image, alt,
    credit, body, sources of title, publisher, date and https link,
    hidden) and `artists` (slug, name, line, about, details as label and
    detail pairs, image, alt, credit, sources, hidden). New ones start
    hidden. An artist keeps their web address when the name changes;
    removing an artist clears any article that named them.
  - Server: `STARTER_ITEMS` (article and artist parts: words, picture,
    body or about, details, sources, settings), `starterForEditor` and
    `starterFromEditor` (like Street Art Dispatch's), `STARTER_LISTS` (the
    Articles and Artists list pages, their small line, heading and
    introduction kept under `lists` in the page list file). Templates
    work as on the other sites.
  - Site (`starter/assets/render.js`): `articlePage` (articles/<slug>/),
    `artistPage` (artists/<slug>/, with "Articles about" filled in from
    the articles that name them), `listPage` (articles/ and artists/,
    newest article first by date where the date can be read), `tplWrap`
    and `pageFill`. A list is published once it has something in it or
    the menu leads to it, and never where a page of the console uses
    that address. Articles and Artists join the menu once there is one
    to show. Hidden ones get no page; the editor can still open them.
    Unfilled words show in square brackets; the editor alone shows
    "[Credit]" and "[Add the sources this page rests on]".
  - Start building: the ready set's Artists is now the list the site
    draws (a link, not a page); a copied page of articles or artists
    becomes the list too, and says so.
  - Console: the page picker has Articles and Artists with their
    templates and Create article and Create artist; the lists are under
    Lists; links can point to lists, articles and artists; an artist
    named in an article cannot be deleted (hide instead); a new page
    starts with a Text with picture section and joins the menu.
  - Checks: the step 5 block in `tests/build.mjs` and the "Articles and
    artists" area of `tests/uat.mjs`.

- Usability pass (Version 51, 18 November): a walk of every screen as
  the admin and as an editor at 1440 and 390 wide (`AUDIT=1 node
  tests/uat.mjs`, `tests/audit.mjs`, results in `/tmp/uat/audit.json`),
  then fixes:
  - Picking a section on a narrow window (1100 wide or less) scrolls to
    its settings (`edShowRight`). Each site's editor link now scrolls only
    its own page (`window.scrollTo`), never the console around it.
  - If the editor cannot read a site's pages it says so, with Try again
    and Back to the overview (`state.pgFail`), instead of a blank screen.
  - A save that fails says the changes are still there. Signing out clears
    old messages. The access message tells people to ask the admin and to
    use the email the invitation went to.
  - Start building: length limits on every box, a name needs two letters
    or numbers, the web address and email are checked at Next, and closing
    the tab while Create runs asks first. Pressing Create again after a
    half-made site carries on with the repository it made (matched by its
    homepage); a repository the console did not start is never used.
  - Web addresses: accented names are turned into their plain form; a
    subdomain (shop.example.co.uk) is connected with one CNAME record
    (`isSubdomain`, `dnsRecords`), shown as such on the Ready screen and
    the Overview; lookups only count the record type asked for.
  - Bigger block counts and footer links, pickers that fit on a phone, a
    Theme screen line that opens Theme settings in the editor, and
    "artist page" or "artist profile" wording per site on the Overview.
  - Checks: the "Edge cases" area of `tests/uat.mjs` and the edge block in
    `tests/build.mjs`.

- Edit default text (Version 52, 18 November), from the approved sample
  (https://claude.ai/artifact/BtS13Hb1gcpWWU4Kuz7n1z).
  - Sites: every fixed word of a site's design (buttons, menu words, empty
    spaces, table headings, Page not found, words for screen readers) is
    drawn through `W("key", "the site's own words")` (`Wt` for plain words
    on World Art Review and the starter, `SW` in each `site.js`). Changed
    words live in the page list file under `words` (only the changed
    ones; no `words` at all when none are changed). Each site's build
    refuses `words` that are not plain words. Pages carry the changed
    words in `script#adh-words` for `site.js`; in the editor `draw` sets
    `window.ADH_WORDS`, and World Art Review sets `PAGES.words` and runs
    `applyWords()` (its fixed markup) on every page drawn. The editor link
    answers `adh-find` (outline the first place a word shows, `findWord`,
    `#adh-found-tag`) with `adh-found`.
  - Server: `WAR_WORDS`, `GAM_WORDS`, `SAD_WORDS`, `STARTER_WORDS` (key to
    the site's own words), `WORD_GROUPS` (by the key's first part),
    `WORD_LOCKS` (form notes saying what the form does; the publisher
    disclosure heading on Global Art Monitor; Draft and Date to confirm on
    Street Art Dispatch), `wordMax` (40 for menu, button and table words,
    200 otherwise), `slotsOf`, `cleanWords` (plain words only, every
    {slot} kept, no new slots, unknown and locked words dropped) used by
    `cleanPages`, and `wordSpec` sent to the console with the pages.
    Long passages about method and facts are left out on purpose.
  - Console: Edit default text in More and in the page picker opens
    `wordsPanel` in the left column (`leftPanel: "words"`): search
    (`state.wordQ`), Changed only (`state.wordOnly`), groups one open at a
    time (`state.wordGroup`), a box per word with the site's own words as
    its label and placeholder, Use the site's own (`wd-reset`), Show me
    where (`wordFind`), counts, and plain messages (`wordProblem`).
    Typing goes through `wordSet` (preview, Undo and the Changes list:
    "Default text, Buttons: ... changed to ..."). Locked words show their
    reason and no box.
  - When adding a fixed word to a site, use W() with a new key and run
    `node tests/run.mjs`: it fails until the server's list matches the
    code (`tests/tools/site-words.mjs` reads the calls).
  - Checks: the Edit default text block in `tests/run.mjs` and the
    "Default text" area of `tests/uat.mjs` (13 checks, edge cases
    included).

- Version 53 (18 November): photos from the editor on every site, and a
  top bar that fits.
  - Street Art Dispatch articles and artists have a Picture part
    (`S_PICTURE`: Photo, What the photo shows, Credit), kept in
    `data/content.json` as `image`, `alt` and `credit` (`sadPicture` leaves
    out empty ones, and `alt` when it repeats the frame's words from
    `photos` or `artist_photos`). The site draws the photo on the page and
    its cards (`picOf`, `rFigure`), or the Photo to come frame with what
    it shows; the editor marks it `data-adh="picture"`. The opening
    banner has a Lead photo (`image`) with `photo` as what it shows.
    Licensed photos placed in `photo_files` or `artist_photo_files` show as
    the item's photo in the editor (`sadShown`); changing their description
    or credit updates that entry, changing or removing the photo replaces it
    (`sadLicSave`), and their credit line cannot be emptied.
  - Global Art Monitor: in the editor an artist with no picture shows
    where it goes, and the figure is marked `data-adh="picture"`. World
    Art Review: the editor always shows an article's picture spot
    (`.art-hero`). Sites built in the console already had this.
  - A missing description on an article's photo stops Save, as for
    artists (`missingDescription`).
  - The editor's top bar fits from 1120 to 2200 wide with changes
    waiting: icon words only from 1920, tighter spacing and no Change or
    copy name below 1400, Exit as an icon and a shorter page name below
    1250, and the changes count as a number only there.
  - Checks: the "Photos" area of `tests/uat.mjs`, the photo block in
    `tests/run.mjs`, and the top bar check in the "Edge cases" area.
  - The walkthrough video: `FILM=1 node tests/uat.mjs` films the console
    (`tests/tools/film.mjs`), then `python3 tests/tools/film-make.py video`
    makes `/tmp/film/out/console.mp4` (captions, scene cards, about five
    minutes, no sound).

- Version 54 (19 November): the smallest gaps from the Shopify comparison
  (doc: https://claude.ai/artifact/4bkH7aBxkRRjCEXK7qrPfi, 84 features).
  - Shortcuts (`ED_KEYS`): Shift+Up and Shift+Down pick the row above or
    below (`edStep`, the rows as shown), Shift+Enter opens or closes the
    picked section's blocks, Ctrl/Cmd+Shift+O or Alt+Shift+O opens every
    section's blocks and Ctrl/Cmd+Shift+P or Alt+Shift+P closes them
    (`edOpenBlocks`).
  - Preview at full width (`state.fullView`, `edFull`, class `full`):
    Ctrl/Cmd+Alt+0, or More, hides the lists and settings; a quiet bar
    (`viewFull`, `.fullbar`) has Show the panels; Escape, a panel switch or
    a pick on the page brings them back.
  - Each site's editor link posts `adh-over` (`overSay`) with what the
    pointer is over; the console marks that row `.over` (`edOver`).
  - Checks: the "Shortcuts and full width" area of `tests/uat.mjs`.

- Version 55 (19 November): The Art Correspondent joins the list of sites
  as a card only. It was made outside the console (Artiscope/the-art-
  correspondent, about 50 hand-written pages, theartcorrespondent.com), so
  `sites.json` lists it as `site-4` with `kind: "outside"`: `cleanSiteList`
  keeps it never live in the editor, `siteOverview` sends `outside` and
  `repo`, and `viewHome` shows it with the live sites (picture, "Live. Not
  in the editor yet", View site and GitHub, no Open). The owner chose to
  convert it to the console's pattern later, in six steps with a sample
  first (plan: https://claude.ai/artifact/Hd329iyEdJF4o5g3mtXjpd, with four
  decisions for the owner before step 1);
  another session builds it, so only one session changes its repository
  at a time. Checks: the outside lines in `tests/run.mjs` and the last
  check of the "Shortcuts and full width" area.

- Version 56 (19 November): site templates in Start building, step 2 of 6
  (plan approved 19 November, sample
  https://claude.ai/artifact/87cdGt5x9oqQW7dCEdaQx7). Start building now
  opens on a Template step (five steps: Template, About the site, Look,
  Pages, Check and create).
  - A template is a folder in this repository: `starter/` and
    `templates/<id>/`, each a copy of a site's design code with placeholder
    data files. A new site gets its own copy, so later changes to the
    original never reach it. Nothing of the original's content comes
    across (articles, artists, figures, photos, logos, email addresses),
    and every word starts in square brackets.
  - Ready: the starter, Street Art Dispatch
    (`templates/street-art-dispatch`), Global Art Monitor (Version 57)
    and World Art Review (Version 58), The Art Correspondent (Version 59).
  - The Street Art Dispatch template: SAD's render.js, site.js, site.css
    and build with its name, stamp logo, favicon, Draft note, licensed
    photo credits and own addresses taken out; the site's address and
    email come from `site` in `data/content.json` (`addressOf`, noindex
    until `indexed`, CNAME only then); hard-coded SAD colours in site.css
    now follow the theme; empty lists say "[Articles appear here once you
    add them]". Its data files come from
    `node tests/tools/make-template.mjs street-art-dispatch` (placeholders
    by field, links only to its own kinds of page, refuses to write if a
    word of the original is left). The design code is kept by hand.
  - Server: `SITE_TEMPLATES`, `templateOf`; `starterSite(e)` builds a
    site of its template (SAD's: `TSAD_SECTIONS`, `TSAD_ITEMS` with no
    Draft and an email in Site details, `TSAD_WORDS`, `WORD_LOCKS.tsad`,
    `SAD_MODEL`, SAD's theme). `sites.json` entries keep `template`
    (absent means the starter). `starterInto` copies the site's own
    template folder (`site.dir`). `cleanBuild` has `template` (pages
    "template" for anything but the starter), `buildLooks(template)` puts
    the template's own look first, `lookInto` maps a look onto the
    template's colours and typefaces by what each is for, `planFiles`
    reads the template's pages and content (`templateFiles`, kept two
    minutes). The practice build can start from any ready template and is
    then run as a site of it; Start again puts it back on the starter.
  - Console: `bdStep0` (template rows with their look, what stays
    behind), `bdTpl`, `bdStarter` loads each template's render.js once
    (`bdModules`), the Look step's "From the template" group, the Pages
    step lists the template's pages. Sample mode: `assets/demo-build.json`
    has `specs`, `contents` and `tpl:<id>` plans.
  - Checks: the templates block in `tests/build.mjs`, the `tsad` words in
    `tests/run.mjs`, the "Start building" and "Edge cases" areas of
    `tests/uat.mjs`.

- Version 57 (19 November): the Global Art Monitor template, step 3 of 6.
  - `templates/global-art-monitor`: GAM's render.js, site.js, site.css and
    build, with its name, G logo, favicon, "MONITOR" words, Grove Gallery
    lines, its method words and links to its own articles taken out. The
    name comes from the menu bar (`NAME()`), the big word behind the
    opening and in the footer is the name's last word (`bigWord`, none
    while the name is a placeholder), the address from `site.address`
    (`addressOf`, `ROOT` for the page for a wrong address), noindex until
    `indexed`. The build writes into a folder like the starter's (no
    pages kept in the repository) and uses the starter's workflows. Empty
    tables and article lists show "[Sales appear here once you add
    them]" and "[Articles appear here once you add them]". Hard-coded
    GAM colours in site.css follow the theme.
  - Its data files from `node tests/tools/make-template.mjs
    global-art-monitor`: the eight pages with `current` and `intro`, the
    About and Contact passages written by hand as structure with
    placeholders (`BY_HAND`), `{disclosure}`, `{email}` and the other
    slots kept, the footer's small print still opening with
    `{disclosure}`, empty `sales.json` and `images.json`, and Site
    details with placeholder headline, introduction and disclosure.
  - Server: `TGAM_SECTIONS`, `TGAM_ITEMS` (a plain disclosure hint),
    `TGAM_WORDS`, `WORD_LOCKS.tgam` (the disclosure heading stays locked),
    `GAM_MODEL` with `gam: true`. `planFiles` puts the name and tagline
    into a template's Site details when it has them. `lookInto` gives a
    theme with one text face the look's reading face, or its small face,
    whichever the theme's list allows.
  - Console: look cards on a template other than the starter say "the
    template's own corners" instead of "square corners".
  - Checks: the Global Art Monitor block in `tests/build.mjs`, the `tgam`
    words in `tests/run.mjs`, the first "Start building" check in
    `tests/uat.mjs`.

- Version 58 (19 November): the World Art Review template, step 4 of 6.
  - `templates/world-art-review`: WAR's `src/index.html` and
    `tools/build_site.py` (with `tools/build.py` calling it, so the
    starter's workflows work), data in `content/` (`site.json` with
    `site`, empty `sources`, `artists`, `articles`, `guides`;
    `pages.json` with the home and standards pages, the list pages'
    words under `lists`, default templates; `theme.json`; `files.json`),
    pictures in `images/`.
  - Taken out of the design: the frame logo (`sym-mark`, `IC.mark` is
    empty), the favicon, every "World Art Review" (`SITE_NAME()` from the
    menu bar; the build fills `@@SITE_NAME@@`, `@@SITE_TAGLINE@@` and
    `@@ROBOTS@@` in the head and opening screen), Grove Gallery's email
    (`MAIL_TO` comes from `SITE.email`, shown in `.mail-to` and
    `.mail-link`), the Zara Muse and Konn Artiss comparison table
    (`compareTable` returns nothing), the default latest articles, the
    standards and research desk words (placeholders), and the letter
    panel's words. Storage keys start `site-` instead of `war-`. The "100%"
    figure in the numbers band is "[100%]".
  - With no published artist yet, the opening picture and the featured
    artist use `NOART` (every word in brackets, linking to #artists), so
    the page draws instead of failing.
  - The build writes `index.html`, `images/`, robots.txt, and when
    `site.indexed` is true a sitemap and CNAME; otherwise every page
    carries noindex.
  - Server: `TWAR_SECTIONS`, `TWAR_WORDS`, `WORD_LOCKS.twar`; a WAR
    template site is WAR's config with the site's own id, repository,
    no artists and `files: WAR_FILES`. Each template says where its
    files live (`files`, else `DATA_FILES`): `templateFiles`,
    `createSite` and `checkDomain` (`detailsFile`) use them. `nameInto`
    now puts the tagline only where the design has a place for it, and
    the name in the opening screen too.
  - Console: a template with a whole-page design (`page` in its spec)
    is previewed by `bdWholePage`: its page with the plan's data put in
    as the build does, in a frame that may run its own code but has no
    access to the console (`sandbox="allow-scripts"`), with the opening
    screen skipped. The Pages step lists the design's own list pages
    (`bdPageNames`).
  - Checks: the World Art Review block in `tests/build.mjs`, the `twar`
    words in `tests/run.mjs`, the first "Start building" check in
    `tests/uat.mjs`.

- Site templates, step 6 (20 November): the full check of the four
  ready templates together. No change to the console or the sites; two
  new checks.
  - `tests/templates.mjs` (in `run-all`): for each ready template, in its
    own look and in a ready-made one, a site is planned as Start building
    plans it (`cleanBuild`, `planFiles`), built with its own
    `tools/build.py`, served at its GitHub address
    (artiscope.github.io/wall-and-page/, from the built folder) and every
    page opened at 1440 and 390 wide (World Art Review: every route). It
    fails on an error on a page, a missing file, a link to a page that was
    not built or outside the site, anything too wide on a phone, a long
    dash, a US spelling, a word of any original site, a page without
    noindex, or a home page without the site's name or a placeholder.
    Screenshots in `/tmp/look/templates`.
  - The "Templates end to end" area of `tests/uat.mjs`: the practice
    build is rebuilt through Start building from each of Street Art
    Dispatch, Global Art Monitor and World Art Review, published as the
    workflow would (`pbPublish`), opened in the editor (preview shows the
    template's design and the new name), a heading or small line is
    changed and saved to the right pages file, and Start again puts the
    starter back. The test GitHub holds every template folder.

- Version 59 (20 November): The Art Correspondent template, step 5 of 6.
  The live site was still hand-written pages when this was built (its
  conversion into the console had not been pushed), so the owner asked
  for the template to be made from its current design. It lives in this
  repository only; Artiscope/the-art-correspondent was not touched, and
  the live site stays an outside card on All sites until its conversion.
  - `templates/the-art-correspondent`: the starter's code (`render.js` as
    the global `TAC`, `site.js`, build, workflows, `data/`) drawn in the
    site's design: its `styles.css` turned into `assets/site.css` on the
    theme's variables (`--page` Warm Plaster, `--band` Soft Black for
    buttons and footer, `--accent` Pale Oak for the band, photograph
    frames and cards, `--ink`; EB Garamond, Karla, and Reenie Beanie for
    the handwritten line), its menu bar and footer (name in words, no
    nib logo), the soft fade-up (`setupReveal`, never in a frame) and the
    story filter (`setupFilter`).
  - Six sections of its own (`TAC_KINDS`, `TAC_OWN` on the server):
    Page opening (`tac-opening`, Large or Page heading), Lead photograph
    (`tac-lead`, with the handwritten line), Latest stories
    (`tac-latest`: numbered list or cards, how many, only one section by
    its small line, a link to every story), Read by subject
    (`tac-subjects`: every artist's page, then added links), Feature band
    (`tac-band`) and Page text (`tac-text`, paragraphs as lines). The
    shared 20 come from the starter, restyled in the site's voice.
  - Stories are the starter's articles with the site's layout: section
    label, byline ("By {site}. Published {date}."), standfirst, body,
    Read next, how it was reported (`how`, new in `TTAC_ITEMS`), Sources
    and Filed under (the artist). Artist pages are subject pages, with
    "Stories about {name}" as cards. Lists are cards with the section
    words to filter by; addresses are folders (articles/<slug>/).
  - Server: `TTAC_SECTIONS` (the starter's, a menu bar of name and links
    only, and `TAC_OWN`), `TTAC_ITEMS`, `TTAC_WORDS`, `WORD_LOCKS.ttac`,
    `TTAC_LISTS`, `TTAC_THEME` (Page background, Buttons and footer,
    Second colour, Text; Karla added to the reading faces), and
    `SITE_TEMPLATES` marks it ready with `global: "TAC"`. Forms open the
    visitor's email app like the other console sites; no publisher line.
  - Console: icons, drawings and groups for the six kinds.
  - Checks: The Art Correspondent block in `tests/build.mjs`, the `ttac`
    words in `tests/run.mjs`, `tests/templates.mjs` (now five
    templates), the first "Start building" check and a fourth run in
    "Templates end to end" in `tests/uat.mjs`.

- Version 60 (20 November): The Art Correspondent moved into the console,
  start to finish in one conversation (owner's choice, 20 November).
  Decisions taken: forms open the visitor's email app (info@grovegallery.com);
  folder addresses with every old `<name>.html` forwarding; no publisher
  line; every word, source and the nib logo unchanged.
  - The site is now a site of its own template: `sites.json` lists it as
    `site-4`, `kind: "starter"`, `template: "the-art-correspondent"`,
    `live: true`, so `starterSite` gives it `TTAC_SECTIONS`, `TTAC_ITEMS`,
    `TTAC_WORDS`, `STARTER_MODEL` and `TTAC_THEME`. Its `assets/render.js`,
    `site.js`, `site.css` and `tools/build.mjs` are the template's, file for
    file (`tests/run.mjs` checks it); change the template and copy them over.
  - Its data: `data/content.json` holds 22 stories (`articles`: section as
    `kicker`, `summary` the standfirst, `description` for search results,
    `subjects` in order, a chosen `next`, `how`, `sources`), 7 subjects
    (`artists`: two artists and five themes), the site's `mark` (the nib's
    outline), `icons` and `share` (in `assets/brand/`), and `forward` (old
    address to new). `data/pages.json` has the home page, the six section
    pages (Opening plus Latest stories set to one section, or the list by
    hand on Exhibitions, or Page text on Conversations), All stories at
    `stories/`, Studio Sessions, About and Write to us. Converted by
    `/tmp/tac/convert.py` (kept in this session only); the live pages were
    compared word for word and at both sizes before the switch.
  - The template gained what the site needed, so new sites get it too:
    stories at `stories/<slug>/` and subjects at `subjects/<slug>/` (`P` in
    render.js, `paths` on the server, sent to the console, which uses
    `itemBase`, `itemWord`, `articlesWord` for links, the live address and
    the picker's Stories and Subjects); several subjects per story and a
    chosen Read next; a search description; the story's label leading to
    the section page that lists it (`sectionHref`); List by hand
    (`tac-entries`, with a note under it); Page text in parts with a larger
    first paragraph; Latest stories with Show every story and `{n}` in its
    link; the email sign-up as the site's letter with its label showing;
    `{year}` in the footer's small print; the menu holding only the links
    chosen; the site's `mark`, `icons` and `share` drawn when its details
    name them; forwarding pages (`forwards`, written by the build).
  - `starterForEditor` passes `mark`, `icons` and `share` to the preview.
    `RESERVED` page keys now include stories, subjects and articles.
  - The site's repository has its own `CLAUDE.md` and `README.md`.
  - Checks: the Art Correspondent block in `tests/run.mjs` (`tacDir` in
    `tests/where.mjs`, or `TAC_DIR`), the "The Art Correspondent" area of
    `tests/uat.mjs` (site-7 in the test list; the outside-site check now
    uses a made-up "Old Notes"), and the template checks as before.

- Version 61 (20 November): Editions, the sixth site template and the
  first original one, from the approved sample
  (https://claude.ai/artifact/Cx4NmMUudawei4gPmpgEJj). Its look and page
  order follow the group's own Zen Xander store; the code is written fresh
  (nothing from the store's theme, whose code belongs to its maker). The
  owner declined copying designs of sites the group does not own.
  - `templates/editions`: the TAC template's code reworked (`EDITIONS`
    global). Works are the articles at `works/<slug>/`, series the artists
    at `series/<slug>/` (`paths`). Every work sits in a frame (`--band`)
    with a paper mount (`--mount`), never cropped; with no photograph it
    shows a plain coloured stand-in, "Photograph to come.".
  - Five sections of its own (`ED_OWN`, `ED_KINDS`): Opening slides
    (`ed-slides`, up to 3, Previous and Next in words, `setupEdSlides`),
    Series banner (`ed-series`), Works (`ed-works`: every work or one
    series, 3 or 4 a row), Social tiles (`ed-social`, the owner's own
    photographs as links; nothing fetched) and Every series
    (`ed-series-list`, with `skip`, connected to `{page.artist}` in the
    default series template so a series leaves itself out).
  - A work (`TED_ITEMS`) has Series, Edition, Price (words as written,
    such as From £250 or Sold), Details (label and detail) and "Ask about
    this work", which opens the visitor's email app. No basket, no
    payments, no delivery or returns words (they would be invented).
  - The menu bar has `bar` (a yes or no): quick links at the foot of a
    phone screen (Home and the first two menu links).
  - Theme (`TED_THEME`): Page background, Text and buttons, Panels,
    Frames; Syne and DM Sans, with Anton offered (headings never fake a
    bold weight). Looks: Black gallery (its own, `ownLook`), White
    gallery and Warm grey (`ED_LOOKS`, `looks` on the template entry,
    listed under From the template); `FONTS` gained Syne, Anton, DM Sans.
  - Console: icons, drawings and groups for the five kinds; `plural`
    leaves "Series" alone.
  - Checks: the Editions block in `tests/build.mjs` (site-15), the `ted`
    words in `tests/run.mjs`, `tests/templates.mjs` (six templates), the
    first "Start building" check and a fifth run in "Templates end to end"
    in `tests/uat.mjs`.

- Version 62 (23 November): shops on Shopify, Phase 1 of moving the Zen
  Xander shop into the console (plan:
  https://claude.ai/artifact/NvpPCBVWGr7W2ErFcgwGn7, sample of the screens:
  https://claude.ai/artifact/Uq461xRJW5uvHGpQz3KBYJ, both approved). Shopify
  stays the one record and still takes the payments, sends order emails and
  handles delivery; the console reads and changes its products.
  - `sites.json` entries with `kind: "shop"` and `store` (the part of the
    Shopify address before .myshopify.com; Zen Xander is `7bb690-c7`). A shop
    has no repository and is never built; on All sites it sits with the live
    sites ("Shop on Shopify", or "Waiting for the Shopify key"). Only the
    admin opens it (`shopAction` refuses editors). Its menu is Products and
    Changes only. The other sites are not touched.
  - The key lives only in Supabase's secrets: `SHOPIFY_TOKEN` (an app made in
    the shop's admin before 2026), or `SHOPIFY_CLIENT_ID` and
    `SHOPIFY_CLIENT_SECRET` (an app made in Shopify's Dev Dashboard in the
    same organisation; `shopToken` asks Shopify for a key with the client
    credentials grant and keeps it until it lapses). A second store adds
    `_<STORE>` to each name. Since 1 January 2026 new apps can only be made in
    the Dev Dashboard. The app needs to read and write products, inventory and
    files, and read locations. Never take a key in the conversation.
  - Server (`shopify`, `SHOPIFY_VERSION` "2026-10", Admin GraphQL; it asks
    again when Shopify is busy): `shopProducts`, `shopProduct`, `shopSave`
    (`shopCleanChange`: every change carries what it was, and the save is
    refused with `stale` if Shopify has moved on; descriptions pass through
    `safeMarks`; rule-filled collections cannot be changed by hand; stock
    uses `inventorySetQuantities` with `changeFromQuantity` and the
    `@idempotent` key), `shopPricePlan` and `shopPriceApply` (many prices at
    once: on sale, every product, a collection or chosen by hand, by option
    value; set, or raise or lower by an amount or a percentage, rounded to
    whole pounds; a was price when lowering; the plan is applied only if
    every price is still as checked), `shopChanges` and `shopPutBack` (the
    list of changes on the `shop-log` branch of this repository, never main;
    Put back only when nothing in the change has moved since), `shopAdd` (a
    draft copy with `productDuplicate`, or a blank draft), `shopPhoto`
    (staged upload, then the photo joins the product; a description is
    required).
  - Console (`viewProducts`, `viewShopProduct`, `viewShopPrices`,
    `viewShopAdd`, `viewShopChanges`, `shopClick`, `shopInput`, `spChange`;
    styles under `.sp` at the end of `app.css`): as in the sample. Prices,
    was prices, stock codes and stock per place, grouped by an option with
    one box for the whole group; title, description (the rich editor),
    status, collections, search words, page layout, photo words and order,
    Add a photo. Sample mode: `assets/demo-shop.json` and `demoShop`.
  - Checks: `tests/shop.mjs` (in `run-all`, with `tests/fakeshop.mjs`, a
    Shopify in memory) and the "Shop" area of `tests/uat.mjs`.
  - Still to come (the plan's Phase 2 onwards): the Zen Xander site itself
    in the console, then payments. Options (sizes, frames, colours) are
    still changed in Shopify.

- Version 63 (23 November): the console's new look, step 1 of 5 of the
  UI plan. The owner compared ten colour options on a canvas
  (https://claude.ai/artifact/XsiwECaQLDuA2yp91Y5gFZ) and chose Option G,
  Snow and teal. Colours and text only: a last block in `assets/app.css`
  sets the roles (see Design rules), clearer text boxes, a teal focus
  ring, sentence-case labels, light drawings in Add a section, and the
  menu's house icon and saved tick follow the words' colour. No screen,
  control or behaviour changed. Next steps, each with the owner's go
  ahead: 2 where you are (side menu with words, path, Live or Trial copy
  marker, a site opens on its Overview), 3 fewer boxes and one main
  action per screen (Needs you on the Overview), 4 the editor (top bar
  in three groups with words, panels side by side from 1280, no floating
  bar, teal outline in the sites' editor link), 5 phone (a bar at the
  foot, 44px buttons).

- Version 64 (23 November): step 2 of 5 of the UI plan, where you are.
  The side menu has words beside its icons and shows the site you are in
  with its mode; every screen has a path at the top (All sites / World
  Art Review / Versions) and a marker saying Live site (saves go straight
  to visitors), Trial copy: name, Your copy, or Shop on Shopify, with
  Make live, Publish and "Undo the last save" there when they apply. A
  site now opens on its Overview, with View the live site and Edit pages
  at the top; Open the editor after Start building still goes straight
  to the editor. Tests that open a site press Edit pages first.

- Version 65 (23 November): step 3 of 5 of the UI plan, fewer boxes and
  one main action per screen (see Design rules). The agents' drafts are
  not in Needs you yet: the console does not read the weekday agents'
  pull requests, so that waits for the owner's say.

- Version 66 (23 November): step 4 of 5 of the UI plan, the editor (see
  Design rules). The teal outline went to all six site repositories, the
  starter and every template.
  - On 23 November the owner merged the weekday agents' drafts (Banksy on
    World Art Review, Global Art Monitor, Street Art Dispatch and The Art
    Correspondent, prices kept in their sale currency on Global Art
    Monitor). Many checks count the sites' content as it was on 19 and 20
    November, so the suite is run against copies at those commits, with
    only the change being made added: `git worktree add --detach
    /tmp/ts/<repo> <commit>` for world-art-review 055fa62,
    street-art-dispatch 8b85f25, the-art-correspondent a1b8b91 and
    global-art-monitor d575fa8 (with today's `assets/render.js`, `site.js`
    and `site.css` copied in), then `WAR_DIR`, `SAD_DIR`, `TAC_DIR` and
    `GAM_DIR` pointing at them for `npm run sync` and the tests. Moving
    the checks onto the new content is a job for later.
  - Global Art Monitor's new fixed word `table.mixed-note` is in
    `GAM_WORDS` (added after `TGAM_WORDS`, so the older template copy of
    its code does not need it).

Waiting for the owner:

- The Shopify key for Zen Xander (see Version 62), and what the shop's
  "Artiscope Sync" app is for.

- Create site needs the GitHub key widened (see step 4 above). The
  practice build works without it.

- Publish later needs its clock key: a long random key (from a password
  manager) added as SCHEDULE_KEY in Supabase (Edge Functions, Secrets)
  and in GitHub (artiscope-digital-home, Settings, Secrets and
  variables, Actions). Never take the key in the conversation.

- Edit code's build check needs the GitHub key to have Actions: Read on
  each site repository (GitHub, the key's settings). The owner sets it;
  never take the key in the conversation.
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

- Street Art Dispatch's own rules: Konn Artiss's Draft note and "Date to
  confirm" on the Venice entry stay until the owner gives confirmed
  facts. Only one session changes its repository at a time.

Asked about on 19 November: an AI assistant for the console (like
Shopify's Sidekick). Plan given in the conversation; nothing built until
the owner chooses.

Later, in this order unless the owner says otherwise: payments
(Stripe), extras. A comparison
with Shopify is paused until the owner sends screenshots or code.

Earlier samples and reports, for reference:

- Batch samples: https://claude.ai/artifact/N4KALiybRsBpVnFhxi9iXw (1),
  https://claude.ai/artifact/U3TsSwtRR6oUV7Wvd3cyQs (2),
  https://claude.ai/artifact/CHjJnQp1MMq4hQtQmkayYP (4)
- Blocks and pickers sample: https://claude.ai/artifact/7aTnkPvmNnGHv5MDGkPk7i
- Theme samples: https://claude.ai/artifact/3RE2FguoELV3rJxFjogSPH
- Acceptance test report: https://claude.ai/artifact/GCTYoKHrNNgnRdmj2A16cE
