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
| `thumbs/` | One 800 × 500 WebP per tool, named after its `data-tool`, used for the hover preview. Generated, never edited by hand. |
| `tools/thumbs/` | The capture script that makes them, and the font it feeds TypeForge. |
| `.github/workflows/thumbnails.yml` | Runs the capture against the live sites and commits the images. |
| `overdot/` | Overdot, the modular typeface specimen, tester and editor, hosted as a static build from Moduletext. |
| `visual/` | Khối, the chrometype studio, hosted here as an offline single-file build. |
| `liquid-poster/` | Liquid.Poster, the poster tool split out of Liquid.Font. Same origin as the Font tool, so it can draw with the letters you sculpted there. See its README. |

## The dot panel

The black panel beside the headline is a specimen card for Overdot. A canvas
draws a grid of dim dots. The dots near the pointer swell and brighten, a soft
diagonal wave runs through the whole grid, and with no pointer over it a slow
drifting focus keeps it breathing. Over the grid sits one Overdot glyph at a
time, swapped every 2.4 seconds, with its code point in the top corner.

Vanilla canvas, no library. The tuning lives in the panel block of the motion
script:

| Name | Does |
| --- | --- |
| `gap` | Dot pitch, 15px on narrow panels and 18px otherwise |
| `R` | Radius of the pointer focus, scaled to the panel |
| `frame()` | The alpha and radius formulas for each dot |
| `GLYPHS` | The characters the panel cycles through |

It parks itself when off screen or in a hidden tab, and never starts under
`prefers-reduced-motion`.

## Design system

Modelled on a Nothing spec sheet: a light grey field, hairline rules, small
condensed labels, and one red accent used sparingly.

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f2f2f2` | Page field and row fill |
| `--ink` | `#0a0a0a` | Type, rules, the active pill |
| `--mute` | `#636363` | Descriptions, numbers, secondary labels |
| `--hair` | `#cfcfcf` | Row separators, resting pill borders |
| `--red` | `#d71921` | The NEW pill, the blinking dot in the hero, the pointer in the panel |
| `--night` | `#0a0a0a` | The panel and the footer |
| `--night-mute` | `#9b9b9b` | Labels on night |

Type is [Overdot](overdot/), from Moduletext, in three cuts. Each is subset to
Basic Latin plus a few marks, about 24 KB.

| Cut | Role |
| --- | --- |
| Extended Bold | Headline, section titles, tool names, numbers, the panel glyph, the email |
| Regular | Body copy and descriptions |
| Condensed Regular | Labels: upper case, tracked `.07em`, 11 to 12px |

To cut them again, run `pyftsubset` over the TTFs in Moduletext `fonts/ttf/`:

    pyftsubset Overdot-Regular.ttf --flavor=woff2 \
      --unicodes="U+0020-007E,U+00A0,U+00A9,U+00B7,U+00D7,U+00D8,U+00F8,U+2013,U+2018,U+2019,U+201C,U+201D,U+2026" \
      --layout-features='kern,liga,tnum,case' \
      --output-file=assets/fonts/overdot-regular.woff2

House style: no em dashes anywhere in the copy. Break the sentence or use a
comma.

## Motion

Everything that moves is decoration, and the page reads the same without it.
A one line script in `<head>` adds `.motion` to `<html>` only when JavaScript
runs and reduced motion is off. Every animation hangs off that class, so
nothing ever waits hidden for a script that did not run.

| Effect | Where |
| --- | --- |
| Headline lines slide up on load | `h1 .ln` |
| Hero numbers count up from zero | `[data-count]` |
| Section titles resolve from noise | `[data-scramble]`, with an `sr-only` copy carrying the real text |
| Rows and about blocks stagger in on scroll | `.rv`, IntersectionObserver |
| Row hover, a black wipe from the left | `.row::after` |
| Halftone preview trailing the pointer | `.peek`, see Thumbnails |
| Scroll percentage and progress hairline | `.pct`, `.top::after` |

The row hover is a white layer in `mix-blend-mode:difference` that scales in
from the left, so it inverts the row exactly as far as it has reached. Two
things keep it working and are easy to break:

1. `.row` carries `isolation:isolate` and its own `--paper` background. That
   background is what the blend inverts; without it the layer shows white.
2. The NEW pill sits above the layer at `z-index:2`, so it stays red instead
   of turning cyan. Anything given a `transform` or `opacity` of its own
   becomes a stacking context and cannot climb above the layer.

## Categories

| `data-cat` | Pill | Tools |
| --- | --- | --- |
| `type` | Type | 01 to 06 |
| `print` | Print | 07 to 12 |
| `sound` | Sound | 13 to 14 |
| `figma` | Figma | 15 to 17 |
| `data` | Utility | 18 to 20 |

The pill counts and the hero numbers are computed from the list, so they never
need editing. Numbering runs `01` to `20` straight through. Sorting by Latest
reorders the rows, and each keeps its number.

## Adding a tool

Copy an `<li>` into the list where it belongs and renumber the rows after it.
The two meta descriptions in `<head>` spell the total out in words, so fix
those too.

```html
<li data-cat="type" data-date="2026-11-02"><a class="row" data-tool="codename" data-released="2026-11-01" href="https://EXAMPLE.COM" target="_blank" rel="noopener">
  <span class="no lab" aria-hidden="true">21</span>
  <span class="title"><span class="name">What it does</span><span class="code lab" aria-hidden="true">CODENAME</span></span>
  <span class="desc">One sentence, two at most. No em dash.</span>
  <span class="meta"><span class="cat lab">Type</span><time class="date lab" datetime="2026-11-02"><span class="sr-only">Updated </span>2026.11.02</time></span>
  <span class="go" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M3.5 8.5 8.5 3.5M4.5 3.5H8.5V7.5"/></svg></span><span class="sr-only"> (opens in a new tab)</span>
</a></li>
```

`data-date` is the date the row shows and sorts by: the last update, or the
release date when there is none, as with the Figma plugins. `data-released`
drives the NEW badge, and `data-tool` names both the thumbnail and the visit
counter event. Keep `data-date`, `datetime` and the printed date in step.

`.name` is the function, `.code` is the project name. A visitor scans for what
a thing does before they care what it is called.

## Dates and the NEW badge

Each row carries a release date and, except for the Figma plugins, an update
date. They were seeded from real history: `data-released` is the first commit
in that tool's own repository, `data-updated` its last change before the
licence pass of 21 Sep 2026. The three Figma plugins have no repository here,
so they carry the date they were listed on this page and no update date.

They are static text. Nothing fetches them, so shipping a change to a tool
means editing its two dates here as well. A runtime lookup was the other
option and was not worth it: the GitHub API allows 60 unauthenticated calls an
hour per visitor, twenty of them would go on one page load, and it would not
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

The list carries no pictures. The thumbnails only feed the preview that
glides beside the list on desktop: the first hover on a row loads
`thumbs/<slug>.webp`, redraws it as a halftone, ink dots on paper, and
caches it. That turns twenty different screenshots into one family. An image
that is mostly dark is inverted first, so the dots carry the content and not
the background. Touch screens never show the preview, and a missing
thumbnail simply means no preview for that row.

They are captured, not hand-made, by `tools/thumbs/capture.mjs`: headless
Chromium against the live sites, cropped to 8:5 WebP at 800 × 500. All twenty
come to about 0.4 MB, and the page fetches one only when its row is first
hovered.

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

Two things: the page view, and a click on any tool row as an event named
`tool/<slug>` taken from `data-tool`. Those events are listed together in the
dashboard, which is what ranks the tools against each other.

Note what that measures. A visitor who goes straight to a tool's own URL never
touches this page and is not counted. Counting those would mean installing the
tracker inside every web tool, seventeen of the twenty; the three Figma
plugins live on figma.com and cannot carry one.

The footer total is fetched from `/counter/TOTAL.json`. Any failure, offline,
blocked or private, leaves the slot hidden instead of showing an error.

## Adding a category

Add a pill to `.pills` with a new `data-filter` key, then give the rows that
belong to it `data-cat` with the same key. The pill count fills itself in.

```html
<button class="pill" type="button" data-filter="video" aria-pressed="false">Video <span class="n">00</span></button>
```

## Linking a new demo

For a `markdo27.github.io/REPO/` link to resolve, that repo needs Pages turned
on: Settings, Pages, deploy from `main`, folder `/`.

## Legal

© 2026 Mark Do. Every tool linked from this sheet is free for personal, study
and other non commercial use. Commercial use, meaning client, brand, resale or
any other paid work, needs written permission first: **dtcmark@gmail.com**.
The tools are provided as is, with no warranty.
