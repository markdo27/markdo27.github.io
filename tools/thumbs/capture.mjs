// Captures the thumbnail for every tool cell on the index.
//
//   cd tools/thumbs
//   npm ci && npx playwright install --with-deps chromium
//   node capture.mjs                          every tool
//   THUMBS_ONLY=nuftext,visual node capture.mjs   just those
//
// A tool's first screen is often an empty state or a wall of controls, so
// each entry stages the tool until it shows what it makes, then shoots and
// crops to WIDTH x HEIGHT WebP in /thumbs, named after the cell's data-tool.
//
// CHROMIUM_PATH points it at a Chromium you already have instead of the one
// Playwright downloads.

import { chromium } from 'playwright';
import sharp from 'sharp';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';

const OUT = new URL('../../thumbs/', import.meta.url);
const WIDTH = 800;
const HEIGHT = 500; // 8:5, the same box as .thumb in index.html
const VIEWPORT = { width: 1440, height: 900 };
// Long on purpose. SwiftShader draws the WebGL tools at two or three frames
// a second, so one element screenshot takes seconds, and longer on a busy
// shared runner. The timeout is there to catch a hang, not a slow page.
const SHOT_TIMEOUT = 60_000;
// Figma answers a non-browser user agent with 403.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

const GH = 'https://markdo27.github.io';
const FIGMA = 'https://www.figma.com/community/plugin';

/* One entry per cell, keyed by its data-tool.
     steps   run in order before the shot:
               { click: selector }  { wait: ms }  { eval: 'js' }
               { upload: 'fixtures/file' }  into the page's first file input
             add optional: true to a step that may legitimately not apply.
     clip    element to shoot; omitted shoots the whole viewport.
     focus   where the 8:5 crop sits: 'attention' (default) follows the
             busiest part of the frame, 'centre' and 'top' do what they say.
     fit     'contain' letterboxes onto background instead of cropping, for
             a subject too wide to crop without cutting it in half.
     viewport  overrides the default window for one tool.
     og      a page whose og:image is the thumbnail, for the Figma plugins,
             which have no page of their own to stage. */
const SHOTS = [
  // ── A / Type ────────────────────────────────────────────────────────
  { slug: 'circle', url: 'https://circlefont.vercel.app',
    // The editor, letters drawn on the circle grid, is the tool. The
    // Preview tab only shows a finished pixel font.
    steps: [{ wait: 2500 }], clip: 'main', focus: 'top' },
  { slug: 'typoman', url: `${GH}/typoman/`,
    // Full-bleed kinetic type; the whole window is the piece.
    steps: [{ wait: 3500 }], focus: 'centre' },
  { slug: 'liquid-font', url: `${GH}/generativefont_creator/`,
    steps: [{ wait: 3000 }], clip: '.specimen-panel' },
  { slug: 'typeforge', url: `${GH}/fontconvertswift/`,
    // Empty, it is a drop zone. With a font in it, it is a specimen and a
    // set of formats to convert to, which is what the tool is for.
    // A narrow window wraps the card to near 2:1, so the whole of it, name,
    // specimen, formats and export, letterboxes in without being cut.
    viewport: { width: 720, height: 1000 },
    steps: [{ wait: 2000 }, { upload: 'fixtures/JetBrainsMono-ExtraBold.woff2' }, { wait: 2500 }],
    clip: '.font-cell', fit: 'contain', background: '#e3e3e3' },

  // ── B / Print & Pattern ─────────────────────────────────────────────
  { slug: 'fractured', url: 'https://poster-generator-jet.vercel.app',
    steps: [{ wait: 5000 }], clip: '#canvas-holder canvas' },
  { slug: 'mosaic', url: `${GH}/mosaic_art/`,
    steps: [{ wait: 2500 }], clip: '#mosaicCanvas' },
  { slug: 'pattern-typo', url: `${GH}/pattern_typo/`,
    // It opens on plain stripes. Emblem is the one pattern that carries
    // letterforms, which is the half of the name stripes leave out.
    steps: [{ wait: 2500 }, { click: '#patternGrid >> text=/^emblem$/i' }, { wait: 1000 }],
    clip: '#canvasWrapper', focus: 'centre' },
  { slug: 'burnt-noise', url: `${GH}/Burnt-Noise/`,
    steps: [{ wait: 6000 }], clip: 'canvas#gl' },
  { slug: 'nuftext', url: `${GH}/nuftext/`,
    // Auto mode needs a few seconds of scanning before the type has melted.
    steps: [{ wait: 7000 }], clip: '#canvasShell' },
  { slug: 'saigon-1985', url: `${GH}/vietnamsesignage/`,
    // The dock sits over the wall; the tool's own Hide puts the wall alone.
    steps: [{ wait: 3500 }, { eval: "document.body.classList.add('chrome-off')" }, { wait: 800 }] },
  { slug: 'liquid-poster', url: `${GH}/liquid-poster/`,
    // A first visit opens on the demo poster (black on signal orange), so it
    // needs no staging beyond the trace. The stage frames the portrait sheet
    // on its dark backdrop at about 8:5.
    steps: [{ wait: 4500 }], clip: '.stage-view', focus: 'centre' },

  // ── C / Sound & Visual ──────────────────────────────────────────────
  { slug: 'musicbox', url: `${GH}/musicbox/`,
    // An empty sequencer reads as a dark form. A genre preset lights the
    // steps up so the grid looks like music.
    steps: [{ wait: 2500 }, { click: 'button:has-text("Techno")' }, { wait: 1200 }],
    clip: '#track-list', focus: 'top' },
  { slug: 'dead4rat', url: `${GH}/dead4rat-v3/`,
    // Opens on a start card. Demo needs no camera or microphone, and the
    // output fills #stage beside the effects panel.
    steps: [{ wait: 4000 }, { click: 'button:has-text("DEMO")' }, { wait: 7000 }],
    clip: '#stage' },
  { slug: 'visual', url: `${GH}/visual/`,
    steps: [{ wait: 4000 }], clip: '#stage' },

  // ── D / Figma Plugin ────────────────────────────────────────────────
  { slug: 'eps-importer', og: `${FIGMA}/1672276000158452389/eps-importer` },
  { slug: 'pdf-importer', og: `${FIGMA}/1673270708025158573/free-pdf-importer` },
  { slug: 'website-importer', og: `${FIGMA}/1674297961569861299/free-html-to-figma` },

  // ── E / Data & Document ─────────────────────────────────────────────
  { slug: 'vietlot', url: `${GH}/vietlot_predict/`,
    // Opens on "choose a game"; Power 6/55 loads the history. Its stats
    // panel, hot, cold and longest absent, reads as lottery at a glance.
    // At full width the panel is a 6:1 strip; at 560 the three groups stack.
    viewport: { width: 560, height: 1000 },
    steps: [{ wait: 2500 }, { click: '#btn-power655' }, { wait: 6000 }],
    clip: '#stats-panel', fit: 'contain', background: '#f5f3ef' },
  { slug: 'translaate', url: 'https://translate-doc-nine.vercel.app',
    // The landing page's own before-and-after card says more than the
    // upload form above it.
    // At 640 the card holds the full Chinese source beside the full
    // Vietnamese result; any crop would cut one of them mid-sentence.
    viewport: { width: 640, height: 1000 },
    steps: [{ wait: 3000 }], clip: '.preview-card',
    fit: 'contain', background: '#07080f' },
];

async function stageAndShoot(browser, shot) {
  const context = await browser.newContext({ viewport: shot.viewport ?? VIEWPORT, userAgent: UA });
  try {
    const page = await context.newPage();
    await page.goto(shot.url, { waitUntil: 'load', timeout: 60_000 });
    for (const step of shot.steps ?? []) {
      try {
        if (step.wait) await page.waitForTimeout(step.wait);
        if (step.click) await page.locator(step.click).first().click({ timeout: 15_000 });
        if (step.eval) await page.evaluate(step.eval);
        if (step.upload) {
          await page.locator('input[type=file]').first()
            .setInputFiles(new URL(step.upload, import.meta.url).pathname);
        }
      } catch (err) {
        if (!step.optional) throw err;
      }
    }
    return shot.clip
      ? await page.locator(shot.clip).first().screenshot({ timeout: SHOT_TIMEOUT })
      : await page.screenshot({ timeout: SHOT_TIMEOUT });
  } finally {
    await context.close();
  }
}

async function fetchOgImage(shot) {
  const html = await (await fetchOk(shot.og)).text();
  const m = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
  if (!m) throw new Error('no og:image on ' + shot.og);
  const src = m[1].replace(/&#47;/g, '/').replace(/&amp;/g, '&');
  return Buffer.from(await (await fetchOk(src)).arrayBuffer());
}

async function fetchOk(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res;
}

const POSITION = { attention: sharp.strategy.attention, centre: 'centre', top: 'top' };

// Workflow commands end at a newline and treat % as an escape.
function escapeCommand(text) {
  return text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

// One row per tool on the run's summary page.
async function writeSummary(results) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const rows = results.map(r => r.ok
    ? `| ${r.slug} | ok | ${r.kb} KB | ${r.s.toFixed(1)} s |`
    : `| ${r.slug} | **failed** | ${r.error.replace(/\|/g, '\\|')} | ${r.s.toFixed(1)} s |`);
  await appendFile(process.env.GITHUB_STEP_SUMMARY,
    ['### Thumbnails', '', '| Tool | Result | Size or reason | Time |', '| --- | --- | --- | --- |', ...rows, ''].join('\n'));
}

async function main() {
  const only = (process.env.THUMBS_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
  const shots = only.length ? SHOTS.filter(s => only.includes(s.slug)) : SHOTS;
  const unknown = only.filter(slug => !SHOTS.some(s => s.slug === slug));
  if (unknown.length) throw new Error('no entry for ' + unknown.join(', '));

  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    // No GPU on CI runners. SwiftShader keeps the WebGL tools drawing
    // instead of landing on their "WebGL unavailable" screens.
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });

  const results = [];
  for (const shot of shots) {
    const started = Date.now();
    try {
      const raw = shot.og ? await fetchOgImage(shot) : await stageAndShoot(browser, shot);
      const webp = await sharp(raw)
        .resize(WIDTH, HEIGHT, shot.fit === 'contain'
          ? { fit: 'contain', background: shot.background ?? '#000' }
          : { fit: 'cover', position: POSITION[shot.focus ?? 'attention'] })
        .webp({ quality: 78 })
        .toBuffer();
      await writeFile(new URL(`${shot.slug}.webp`, OUT), webp);
      const r = { slug: shot.slug, ok: true, kb: Math.round(webp.length / 1024), s: (Date.now() - started) / 1000 };
      results.push(r);
      console.log(`ok    ${r.slug.padEnd(18)} ${String(r.kb).padStart(4)} KB  ${r.s.toFixed(1)}s`);
    } catch (err) {
      const r = { slug: shot.slug, ok: false, s: (Date.now() - started) / 1000, error: err.message.split('\n')[0] };
      results.push(r);
      console.log(`FAIL  ${r.slug.padEnd(18)} ${r.error}`);
      // In Actions this becomes an annotation on the run: it names the tool
      // and the reason on the run page, where the raw log is a click deeper.
      if (process.env.GITHUB_ACTIONS) {
        console.log(`::error title=Thumbnail failed: ${r.slug}::${escapeCommand(r.error)}`);
      }
    }
  }
  await browser.close();
  await writeSummary(results);

  // A failure keeps the old image in place and turns the run red, rather
  // than quietly shipping a card without a picture.
  const failed = results.filter(r => !r.ok).map(r => r.slug);
  if (failed.length) {
    console.log(`\n${failed.length} of ${shots.length} failed: ${failed.join(', ')}`);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
