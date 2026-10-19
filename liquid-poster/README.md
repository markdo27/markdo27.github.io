# Liquid.Poster

Pour liquid type into posters: melted, inked and contour-echoed letterforms
with Vietnamese accents, exported as PNG or SVG.

Live at **https://markdo27.github.io/liquid-poster/**

Split out of [Liquid.Font](https://github.com/markdo27/generativefont_creator)
(the glyph editor) on 19 Oct 2026. It is static: GitHub Pages serves this
folder as it is, no build step.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The page: controls, stage, dialogs. |
| `poster.css` | The poster layout. |
| `styles.css` | Shared design tokens and controls, as in Liquid.Font. |
| `poster-engine.js` | The poster: layout, title styles and effects, finish, palette, persistence, exports. |
| `blob-engine.js` | The liquid letterform engine (Flow, Drip, melt), from Liquid.Font. |
| `glyph-compose.js` | Diacritic composition (Vietnamese stacking), from Liquid.Font. |
| `glyphs_meta.js` | The built-in letter skeletons, from Liquid.Font. |

`blob-engine.js`, `glyph-compose.js`, `glyphs_meta.js` and `styles.css` are
copies of Liquid.Font's. When the engine changes there, copy them across
again.

## The demo poster

A first visit, the *Demo* button above the stage (undoable) and *Reset
poster* all open the demo: LIQUID solid and
dripping, POSTER as a contour echo it drips into, and the inked Vietnamese
subhead CHẢY TRÔI ("flowing, adrift"), black on signal orange (the Blaze
pair). The letters are Goo poured heavier, at full Drip and 85% Flow. The
composition lives in `defaultRows`, `defaultBlocks`, `DEFAULTS` and
`stockGlyph` in `poster-engine.js`.

The poster autosaves under its own key, `liquidposter.v1`. Before the split,
the Font tool's poster page saved under `liquidfont.poster.v1` on this same
origin; that key is deliberately not read, so a poster left there does not
hide the demo on a first visit here.

## Drawing with your own letters

The page shares an origin with Liquid.Font
(`markdo27.github.io/generativefont_creator/`), so it can read that tool's
autosave: with *Use my Font-tool glyphs* on, the poster draws with the
letters and accents you sculpted there, and follows its flow state if
*Match its flow state & accents* is on.

## How it works

**Typeface**: either the built-in Liquid glyph set or an uploaded font
(`.ttf`/`.otf`/`.woff`, parsed with opentype.js). For the built-in set the
letterforms themselves are adjustable here: the Font tool's flow-state
presets plus Mass / Melt / Tension / Wobble / Flow / Drip feed `BlobEngine.glyphRings`,
so the whole alphabet can be reshaped without leaving the poster. Per-glyph
node editing lives in the Font tool, and its edits come across: when the
Font tool has saved a project in this browser, *Use my Font-tool glyphs*
swaps in your skeletons and marks (and *Match its flow state & accents*
adopts its shape settings too). Text is read as letter + accent clusters
through `glyph-compose.js`, so Vietnamese works in both title styles; an
uploaded font missing a precomposed letter has it rebuilt from base + mark
glyphs.

**Big title**: any number of independent rows, each with its own text,
tracking, transform and *style*. Each row is rasterized to its own mask,
which is blurred, thresholded, converted to a signed distance field and
contoured with `BlobEngine.traceField`: the same marching-squares pipeline the
Font tool uses per glyph, just fed a raster-derived field instead of an
analytic one. The blur + threshold (*Merge*) is what fuses the letterforms
into a single molten mass; floating accents are drawn after it, so they stay
separate from their letters.

Each row is transformed directly on the canvas: drag the box to move, corner
handles to resize, the stem handle above it to rotate (hold shift to snap to
15°). Arrow keys nudge, `[` / `]` rotate.

Rows are traced independently, which is what lets each one carry its own
effect and fill mode, a shared trace could not be split back apart per row.
They therefore overlap rather than melting into one another.

**Title style (per row)**: `Melt` fuses the glyph silhouettes (blocky,
poster-weight). `Ink stroke` instead draws the built-in font's node chains as
one thin variable-width pen stroke, the glyph data is a skeleton with
per-node radii, so this gives a real modulated stroke that swells where
strokes cross rather than a melted silhouette. A ribbon along the baseline
joins the letters into a single written mark, Slant leans it, Pen sets the
thickness, and Pocket floods small enclosed rings solid (the inked wedges
where the stroke doubles back). Ink stroke needs the skeleton, so an uploaded font , 
which has outlines only, falls back to Melt geometry plus the ribbon, slant
and pockets.

**Line effect (per row)**: the traced mass is contoured from a true signed
distance field (exact Felzenszwalb EDT), so "the same shape offset inward by
N pixels" is a first-class operation and the three treatments are just
different lists of offsets:

- `Solid`: one clean contour.
- `Rough`: a second line just inside the first, displaced by
  high-frequency noise: a shivered double-stroke band. Gap / Shake.
- `Contour`: nested lines stepping inward at even spacing, topographic-map
  style. Lines / Step.

Lines deeper than the thickest part of the mass are skipped (a contour with
nothing to trace shatters into noise fragments and the O(n^2) chain repair
stalls), and noise eases off with depth for the same reason.

**Outline / Filled (per row)**: `Filled` uses even-odd across every line the
effect produced, so Solid reads as a solid mass while Contour reads as
concentric bands.

**Undo / persistence**: the composition autosaves to this browser
(`liquidposter.v1`, validated on load); Ctrl/⌘Z / Shift+Ctrl/⌘Z undo
and redo every gesture, Reset included.

**Small text**: any number of independent blocks, each with its own
Google Mono face, size, leading, alignment, position and colour, drawn
crisply on top and untouched by the melt. Block colour is independent of the
title ink (with a "Match ink" shortcut to re-link it).

Positions are stored as percentages, so changing the poster size rescales the
composition rather than scattering it. The stage has zoom (slider, +/−, Fit,
100%, ⌘/Ctrl+scroll) and drag-to-pan. Unselected row/text cards collapse to
just their identity, so the sidebar stays scannable as a poster grows.

Exports PNG at 1–3× and SVG (vector outline + each Google font inlined as a
base64 `@font-face` subset containing only the glyphs actually used).
