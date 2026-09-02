# markdo27.github.io

MRKD tools index. A single page linking to live demos of my browser based
tools, self hosted instead of Linktree.

Live at **https://markdo27.github.io/**
Contact **dtcmark@gmail.com**

## Structure

Two files, no build step, no dependencies. GitHub Pages serves them straight
from `main`.

| File | Purpose |
| --- | --- |
| `index.html` | The whole page. Markup, CSS and the one script, in one file. |
| `logo.svg` | The mark: white square, black circle. Favicon, apple touch icon, OG image. |

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

The fifteen tool cells turn over to `--ink-deep` on hover and focus, type to
white, over `.55s`. The lift runs faster at `.25s` so the card still feels
responsive while the colour is still travelling. The red dot fades in at
`.35s`. Category bars do not turn over: nothing there is clickable.

## Categories

| Key | Category | Tools |
| --- | --- | --- |
| A | Type | 01 to 03 |
| B | Print & Pattern | 04 to 08 |
| C | Sound & Visual | 09, 10 |
| D | Figma Plugin | 11 to 13 |
| E | Data & Document | 14, 15 |
| F | Contact | dtcmark@gmail.com |

Numbering runs `01` to `15` straight through, across categories. Adding a tool
mid sheet therefore renumbers every card after it, and the two meta
descriptions in `<head>` spell the total out in words.

## Adding a tool

Copy a `.tool` cell into the right category `.row`, then bump the numbers that
follow it and the `count` on that category bar.

```html
<a class="cell tool" href="https://EXAMPLE.COM" target="_blank" rel="noopener">
  <div class="cell-top"><span class="dot idx">00</span><span class="cue"></span></div>
  <div class="name">WHAT IT DOES</div>
  <div class="cell-body">
    <div class="meta">
      <span class="code">CODENAME</span>
      <span class="desc">ONE OR TWO LINES, UPPERCASE, NO EM DASH.</span>
    </div>
    <div class="go">OPEN<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 8.5 8.5 3.5M4.5 3.5H8.5V7.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></div>
  </div>
</a>
```

`.name` is the function, `.code` is the project name. A visitor scans for what
a thing does before they care what it is called.

## Adding a category

Add a bar, then a row under it:

```html
<div class="bar">
  <span class="dot">G</span>
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
