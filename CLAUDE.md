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
- Console look (since Version 47): "Flat and crisp", from the owner's
  design guide (`Digital Home design guide`, 17 November 2026). Read the
  last block of `assets/app.css` before changing any style.
  - Everything flat: no shadows, glows, gradients or pressed-in shapes.
    Shapes are told apart by a step in charcoal and a 1.5px edge, drawn
    inside the shape (`inset 0 0 0 1.5px`, the `--shadow`,
    `--shadow-small` and `--pressed-small` variables now hold edges).
    No lines between rows.
  - Surfaces: panels and cards #26272B with edge #3A3C42, 16px corners;
    buttons one step lighter #2C2E33 with edge #44474E (hover edge
    #6E727A, pressed fill #1C1D21), 10px corners, 34px tall; boxes you
    type in, counts and quiet cards one step darker #1C1D21 with edge
    #34363C; the preview well #1F2024.
  - One accent, ice blue #8EC5FF: Save and Publish are the only solid
    colour (words #0E1A26, bold, 40px tall, pressed #7CB9F7; `.btn.key`
    or the save actions listed in `app.css`). Chosen always looks the
    same: fill #1E2834, ice blue edge and icon, words #F2F3F5 semi-bold.
    Links, switches when on (54 by 30), slider fill (`--pct`, set by
    `rangeFill`) and the preview outline and name tag are ice blue.
  - Words #D4D7DC, headings #F2F3F5, muted #9A9EA6, turned off #6E727A.
    Status only as 9px dots or words: green #4CC38A, amber #E8B44C, red
    #F07A7A. Remove is red words on an ordinary button. No colour on
    panels or large areas (the copy cards carry a dot, not a band).
  - Labels are 11px capitals, 0.08em spacing, semi-bold, muted. Fonts:
    Castoro for headings (40px greeting), Libre Franklin 14px for words.
    Outline icons only, from the `IC` set in `assets/app.js`.
  - A new control uses an existing surface and state, never a new colour.
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

## Where things stand (17 November 2026, Version 47)

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
  Edit default text stays shown but switched off; the owner chose to
  leave it for later.
- Version 47: the Flat and crisp look (see Design rules), and the
  picked outline, name tag and plus in all four sites' editor link turned
  ice blue (#8EC5FF, words #0E1A26), with no halo.
- Next, agreed on 17 November: building a new site from the console.
  Step 2 is a sample of the Start building screens, then step 3 a starter
  site (Artiscope/site-starter) drawing every shared section and block,
  with the list of sites kept where the console can add to it; step 4 the
  Start building screens (name, tagline, web address, contact email,
  starting look from the ready-made looks or an existing site, starting
  pages blank or copied with placeholder words), Create making the
  repository, switching on GitHub Pages and opening the editor, and the
  DNS records shown for the owner to add; step 5 articles and artist
  pages with templates. The owner chose that the tool makes the
  repository: the GitHub key will need permission to create repositories
  and manage Pages in the Artiscope organisation (the owner sets it).

Waiting for the owner:

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

Later, in this order unless the owner says otherwise: building new
sites from the console (above), payments (Stripe), Edit default text,
extras. A comparison
with Shopify is paused until the owner sends screenshots or code.

Earlier samples and reports, for reference:

- Batch samples: https://claude.ai/artifact/N4KALiybRsBpVnFhxi9iXw (1),
  https://claude.ai/artifact/U3TsSwtRR6oUV7Wvd3cyQs (2),
  https://claude.ai/artifact/CHjJnQp1MMq4hQtQmkayYP (4)
- Blocks and pickers sample: https://claude.ai/artifact/7aTnkPvmNnGHv5MDGkPk7i
- Theme samples: https://claude.ai/artifact/3RE2FguoELV3rJxFjogSPH
- Acceptance test report: https://claude.ai/artifact/GCTYoKHrNNgnRdmj2A16cE
