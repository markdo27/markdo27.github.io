# markdo27.github.io

MRKD tools index. A single page linking to live demos of my browser based
tools, self hosted instead of Linktree.

Live at **https://markdo27.github.io/**
Author **Mark Do**
Contact **dtcmark@gmail.com**

## Structure

The page has no build step and no dependencies. GitHub Pages serves it
straight from `main`. The only tooling is the thumbnail capture, and that runs
in CI, not on the page.

| File | Purpose |
| --- | --- |
| `index.html` | The whole page. Markup, CSS and the one script, in one file. |
| `logo.svg` | The mark: white square, black circle. Favicon, apple touch icon, OG image. |
| `thumbs/` | One 800 × 500 WebP per tool cell, named after its `data-tool`. Generated, never edited by hand. |
| `tools/thumbs/` | The capture script that makes them, and the font it feeds TypeForge. |
| `.github/workflows/thumbnails.yml` | Runs the capture against the live sites and commits the images. |
| `visual/` | Khối, the chrometype studio, hosted here as an offline single-file build. |
| `liquid-poster/` | Liquid.Poster, the poster tool split out of Liquid.Font. Same origin as the Font tool, so it can draw with the letters you sculpted there. See its README. |

## The attractor field

The third masthead cell (`#field`) runs a small physics sim on a canvas: black
circles float in zero gravity, and while the pointer is inside that cell they
are pulled toward it, cluster, then drift apart again when it leaves.

Vanilla canvas, no library. Tuning constants sit at the top of the script:

| Constant | Does |
| --- | --- |
| `PULL` | Strength at the centre of the pointer field |
| `FIELD` | Pointer field radius, resized to the cell in `measure()` |
| `VMIN` / `VMAX` | The idle float speed band. Nothing ever comes to rest |
| `VCAP` | Speed limit while the pointer pulls |
| `WALL` / `BOUNCE` | Restitution off the walls and off each other |
| `idealCount()` | Circle count, derived from the cell area |

It parks itself when off screen or in a hidden tab, and honours
`prefers-reduced-motion` by drawing one static scatter and never starting the
loop.

The canvas is full bleed, `inset:0` at `z-index:-1`, clipped by the cell radius,
and the brand line sits over it. Three things make that readable and they are
easy to break:

1. The line is white with `mix-blend-mode:difference`, so it comes out near
   black over the cell and near white wherever a circle passes under it.
2. `.cell--play` carries `isolation:isolate`, which is the blending group. Give
   `.cell-body` a stacking context of its own and the text is cut off from that
   group, blends against nothing, and renders white on white.
3. `draw()` paints `PAPER` over the canvas instead of clearing it. The ground
   under the text has to be opaque or the blend has nothing to work against.

## Design system

Modelled on a hardware quick start sheet: a light grey field with soft
rounded cells, everything set in uppercase mono, one red accent dot.

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#e3e3e3` | Page field, visible as the gap between cells |
| `--cell` | `#f0f0f0` | Cell fill |
| `--ink` | `#2e2e2e` | Headings, names, numbers |
| `--ink-soft` | `#585858` | Body copy |
| `--ink-faint` | `#9b9b9b` | Counts, footer, resting state of `OPEN` |
| `--ink-deep` | `#0a0a0a` | A tool cell under the cursor, and the circles |
| `--on-ink` | `#ffffff` | Type on a turned over cell |
| `--on-ink-soft` | `#b8b8b8` | Body copy on a turned over cell |
| `--on-ink-hair` | `#3d3d3d` | The `OPEN` rule on a turned over cell |
| `--red` | `#d71921` | Accent dot on hover and on the contact cell |
| `--r` | `22px` | Cell radius |
| `--gap` | `10px` | Grid gap and page padding |

Type is [Doto](https://fonts.google.com/specimen/Doto) for titles, numbers and
section letters, and [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono)
for everything else. Body copy is uppercase with open tracking.

House style: no em dashes anywhere in the copy. Break the sentence or use a
comma.

## Hover

The nineteen tool cells turn over to `--ink-deep` on hover and focus, type to
white, over `.55s`. The lift runs faster at `.25s` so the card still feels
responsive while the colour is still travelling. The red dot fades in at
`.35s`. Category bars do not turn over: nothing there is clickable.

## Categories

| Key | Category | Tools |
| --- | --- | --- |
| A | Type | 01 to 03 |
| B | Print & Pattern | 04 to 10 |
| C | Sound & Visual | 11 to 13 |
| D | Figma Plugin | 14 to 16 |
| E | Data & Document | 17 to 19 |
| F | About | Author and contact |
| G | Legal | Personal use free, commercial on request |
| H | Contact | dtcmark@gmail.com |

Numbering runs `01` to `19` straight through, across categories. Adding a tool
mid sheet therefore renumbers every card after it, and the two meta
descriptions in `<head>` spell the total out in words.

## About, legal and contact

`F`, `G` and `H` are the three closing cells. They carry copy rather than a
link, so they share the `.plate` class, which drops the `330px` tool cell
floor and lets each one sit as tall as its text. They ride the same
`.row--three` grid as the masthead, and stack to one column under `880px`.

`G` states the terms the whole sheet runs on: every tool is free for personal,
study and other non commercial work, and any paid, client, brand or resale use
needs written permission first. The commercial address carries a
`?subject=Commercial%20use%20request` so those requests arrive sorted. Change
the terms in one place and they cover all nineteen tools.

## Adding a tool

Copy a `.tool` cell into the right category `.row`, then bump the numbers that
follow it and the `count` on that category bar.

```html
<a class="cell tool" href="https://EXAMPLE.COM" target="_blank" rel="noopener"
   data-tool="codename" data-released="2026-01-31" data-updated="2026-02-14">
  <div class="cell-top"><span class="dot idx">00</span><span class="cue"></span></div>
  <div class="name">WHAT IT DOES</div>
  <div class="thumb"><img src="thumbs/codename.webp" alt="" width="800" height="500" loading="lazy" decoding="async"></div>
  <div class="cell-body">
    <div class="meta">
      <span class="code">CODENAME</span>
      <span class="desc">ONE OR TWO LINES, UPPERCASE, NO EM DASH.</span>
    </div>
    <dl class="dates">
      <div><dt>RELEASED</dt><dd>2026-01-31</dd></div>
      <div><dt>UPDATED</dt><dd>2026-02-14</dd></div>
    </dl>
    <div class="go">OPEN<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 8.5 8.5 3.5M4.5 3.5H8.5V7.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></div>
  </div>
</a>
```

The dates appear twice on purpose. The `<dl>` is what a visitor reads and is
plain markup, so it survives with JavaScript off. `data-released` is what the
NEW badge is computed from, and `data-tool` is the slug the visit counter
ranks the tool under. Keep the attribute and the `<dd>` in step.

The thumbnail is named after `data-tool` too. Add an entry for the tool to
`SHOTS` in `tools/thumbs/capture.mjs` and push: the Thumbnails workflow sees
the change, captures the image and commits it. Until it exists the cell simply
shows no picture rather than a broken one.

`.name` is the function, `.code` is the project name. A visitor scans for what
a thing does before they care what it is called.

## Dates and the NEW badge

Each cell carries a release date and, except for the Figma plugins, an update
date. They were seeded from real history: `data-released` is the first commit
in that tool's own repository, `data-updated` its last change before the
licence pass of 21 Sep 2026. The three Figma plugins have no repository here,
so they carry the date they were listed on this sheet and no update date.

They are static text. Nothing fetches them, so shipping a change to a tool
means editing its two dates here as well. A runtime lookup was the other
option and was not worth it: the GitHub API allows 60 unauthenticated calls an
hour per visitor, nineteen of them would go on one page load, and it would not
cover the Vercel or Figma entries at all.

The **NEW** badge is not written into the markup. A script compares
`data-released` against `NEW_FOR_DAYS` at the top of the page script and adds
the badge only while a tool is inside that window, so a badge ages out on its
own instead of waiting for someone to remember to strip it. Widening the
window is a one-number edit:

```js
var NEW_FOR_DAYS = 30;
```

## Thumbnails

Every cell carries a screenshot of the tool at work, grayscale at rest so the
grid stays quiet, full colour when the cell turns over on hover. Touch screens
have no hover, so there they are in colour from the start.

They are captured, not hand-made, by `tools/thumbs/capture.mjs`: headless
Chromium against the live sites, cropped to 8:5 WebP at 800 × 500. All nineteen
come to about 0.4 MB, and they lazy-load, so only the ones on screen are
fetched.

A tool's first screen is often an empty state, so each entry in `SHOTS` stages
the tool until it shows what it makes. Dead4rat opens on a start card, so the
capture presses Demo. Vietlot opens on "choose a game", so it picks Power 6/55.
Musicbox loads the Techno preset so the sequencer is lit, Pattern Typo switches
to Emblem, the one pattern that carries letterforms, and TypeForge is handed a
font so it shows a specimen rather than a drop zone. The Figma plugins have no
page to stage, so they use their Community cover image.

### Refreshing

Actions, Thumbnails, Run workflow. Leave *only* blank for every tool, or give
slugs, `nuftext,visual`, to redo just those. The run commits whatever changed,
and Pages redeploys from that commit on its own. It also runs on its own
whenever anything under `tools/thumbs/` changes, on any branch.

Fractured and the sign wall randomise on every load, so their pictures change
on each run. That is expected, not drift.

To run it locally:

    cd tools/thumbs
    npm ci && npx playwright install --with-deps chromium
    node capture.mjs
    THUMBS_ONLY=nuftext,visual node capture.mjs

A failed capture leaves that tool's previous image in place and turns the run
red, so a broken stage shows up instead of quietly shipping a blank card. The
run page names the tool and the reason in an annotation, and its summary has a
row per tool with size and time.

The heavy WebGL tools draw at two or three frames a second under the
software renderer CI has to use, so a single screenshot can take several
seconds. The capture allows a minute per shot; that limit is for hangs.

## Visitor counting

Off by default. The page is static, so counting real visitors needs something
server side to record the hit; this uses [GoatCounter][gc], which sets no
cookies and stores no personal data.

GoatCounter is the same program whether its author runs it or you do, so the
page takes a base URL rather than an account name and works against either:

```js
var GOATCOUNTER_HOST = 'https://mrkd.goatcounter.com';   // hosted
var GOATCOUNTER_HOST = 'https://stats.example.com';      // your own server
```

A trailing slash is trimmed, so both spellings are fine. While it is empty no
script is loaded and no request is made, so the page carries no analytics at
all rather than calling a dead host.

`count.js` is served by GoatCounter itself, which is what lets one line cover
both cases. The hosted documentation points at the `gc.zgo.at` CDN instead; it
is a little faster, but it pins the snippet to goatcounter.com and adds a third
party, which is not worth it for a 3.5K script.

[gc]: https://www.goatcounter.com/

### Hosted

1. Make a site at goatcounter.com and use the host it gives you.
2. For the footer total, turn on *Allow adding visitor counts to your website*
   in the settings. Without it that endpoint returns 403 and the footer simply
   shows nothing.

### Self-hosted

The [source][src] is EUPL 1.2 and the README is explicit that it can be
self-hosted without restrictions. It is a single static Go binary; the only
dependency is somewhere to keep a SQLite file, or PostgreSQL for a larger site.
There is a Dockerfile and a compose.yaml in that repository.

    goatcounter serve -listen=:443 -tls=tls,rdr,acme

ACME certificates are handled by GoatCounter itself. Note that this cannot live
on GitHub Pages, which only serves static files: self-hosting means a second,
always-on host somewhere, and a hostname pointing at it.

[src]: https://github.com/arp242/goatcounter

### What is recorded

Two things: the page view, and a click on any tool cell as an event named
`tool/<slug>` taken from `data-tool`. Those events are listed together in the
dashboard, which is what ranks the tools against each other.

Note what that measures. A visitor who goes straight to a tool's own URL never
touches this page and is not counted. Counting those would mean installing the
tracker inside every web tool, sixteen of the nineteen; the three Figma
plugins live on figma.com and cannot carry one.

The footer total is fetched from `/counter/TOTAL.json`. Any failure, offline,
blocked or private, leaves the slot hidden instead of showing an error.

## Adding a category

Add a bar, then a row under it. Categories run in front of the closing
plates, so a sixth one takes `F` and `About`, `Legal` and `Contact` shift
along to `G`, `H` and `I`:

```html
<div class="bar">
  <span class="dot">F</span>
  <h2>CATEGORY NAME</h2>
  <span class="count">/ 2</span>
</div>
<div class="row">
  ...tool cells...
</div>
```

`.row` is `auto-fit, minmax(288px, 1fr)`, so two cells fill half the width each
and three fill a third each. No empty slots to plan around.

## Linking a new demo

For a `markdo27.github.io/REPO/` link to resolve, that repo needs Pages turned
on: Settings, Pages, deploy from `main`, folder `/`.

## Legal

© 2026 Mark Do. Every tool linked from this sheet is free for personal, study
and other non commercial use. Commercial use, meaning client, brand, resale or
any other paid work, needs written permission first: **dtcmark@gmail.com**.
The tools are provided as is, with no warranty.
