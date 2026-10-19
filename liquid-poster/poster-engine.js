// ---------------------------------------------------------------------------
// Poster generator.
//
// Big title: one or more ROWS of text, each independently placed, sized and
// tracked. Each row is rendered from either the built-in Liquid glyph engine
// (reusing blob-engine.js + glyphs_meta.js, same as the Font tool) or an
// uploaded font file (parsed with opentype.js). Every row is rasterized to a
// shared offscreen mask once per ECHO — copies of the whole composition
// transformed along a trail / radial spiral, or fed back through themselves —
// then blurred, thresholded into a scalar field, and re-traced with
// BlobEngine.traceField. That's the same marching-squares + Chaikin pipeline
// the Font tool uses per glyph, just fed a raster-derived field instead of an
// analytic capsule one; the blur+threshold is what fuses separate copies into
// one molten mass.
//
// Small text: any number of independent blocks in Google Mono webfonts, drawn
// crisply on top and untouched by the melt.
//
// Positions are stored as PERCENTAGES of the canvas, so changing the poster
// size rescales the composition instead of scattering it.
// ---------------------------------------------------------------------------
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var GH = GLYPH_DATA.H, GW = GLYPH_DATA.W, BASE = GLYPH_DATA.glyphs;
  // Accent composition (Vietnamese and friends) is shared with the Font tool.
  // Everything below still works without it, minus composed letters.
  var GC = typeof GlyphCompose !== 'undefined' ? GlyphCompose : null;
  var SIDE = 5, SPACE = 30;
  var hasOwn = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  // Flow states lifted from the Font tool, so a shape sculpted there can be
  // reproduced here by name. The Font tool may export its own table as
  // BlobEngine.PRESETS; when it does, that is the single source of truth.
  var GLYPH_PRESETS = {
    liquid: { mass: 1.00, melt: 15, tension: -4, wobble: 0, grain: 0.045, smooth: 2, res: 1.6 },
    mercury: { mass: 1.05, melt: 24, tension: -2, wobble: 0, grain: 0.045, smooth: 3, res: 1.6 },
    acid: { mass: 1.08, melt: 26, tension: -2, wobble: 2.2, grain: 0.050, smooth: 3, res: 1.5 },
    molten: { mass: 1.16, melt: 30, tension: 2, wobble: 1.2, grain: 0.040, smooth: 3, res: 1.6 },
    bubble: { mass: 0.94, melt: 7, tension: -7, wobble: 0, grain: 0.045, smooth: 2, res: 1.6 },
    goo: { mass: 1.10, melt: 20, tension: 0, wobble: 3.6, grain: 0.070, smooth: 3, res: 1.5 },
  };
  // flow and drip have sliders; warp, neck, sag, dripForm and stretch are the
  // Flow preset's own liquid physics (0 = off where a table doesn't name them)
  var FLOW_KEYS = ['flow', 'warp', 'neck', 'sag', 'drip', 'dripForm', 'stretch'];
  var SHAPE_KEYS = ['mass', 'melt', 'tension', 'wobble', 'grain', 'smooth', 'res'].concat(FLOW_KEYS);
  // a shape saved before the flow keys existed takes them from its preset
  function fillFlowKeys(sh, presetName) {
    var p = typeof presetName === 'string' && hasOwn(presetTable(), presetName) ? presetTable()[presetName] : {};
    FLOW_KEYS.forEach(function (k) { if (!finite(sh[k])) sh[k] = finite(p[k]) ? p[k] : k === 'stretch' ? 1 : k === 'dripForm' ? 0.5 : 0; });
    return sh;
  }
  // the stock letter shape, the demo poster's: Goo poured heavier (full
  // Drip, more Flow), every key filled (a key the table lacks is off, 0,
  // except stretch and dripForm's neutral values)
  var STOCK_PRESET = 'goo', STOCK_OVER = { drip: 1, flow: 0.85 };
  function stockGlyph() {
    var lp = presetTable()[STOCK_PRESET] || presetTable().liquid || {}, fb = GLYPH_PRESETS.liquid;
    var g = { preset: STOCK_PRESET };
    SHAPE_KEYS.forEach(function (k) {
      g[k] = finite(lp[k]) ? lp[k] : finite(fb[k]) ? fb[k] : k === 'stretch' ? 1 : k === 'dripForm' ? 0.5 : 0;
    });
    Object.keys(STOCK_OVER).forEach(function (k) { if (g[k] !== STOCK_OVER[k]) { g[k] = STOCK_OVER[k]; g.preset = 'custom'; } });
    return g;
  }
  function presetTable() {
    return (typeof BlobEngine !== 'undefined' && BlobEngine.PRESETS) || GLYPH_PRESETS;
  }

  var SIZE_PRESETS = {
    square: [1200, 1200], portrait: [1000, 1333], tall: [1080, 1920], landscape: [1333, 1000],
  };

  // [css family, label, weight]. The weight matters: Space Mono and Courier
  // Prime ship 400/700 only, so asking Google for 600 404s and the browser
  // silently synthesises a different weight than the export would embed. Each
  // entry names a weight the family actually has, and that same number is used
  // for canvas rendering, the SVG attribute and the webfont request.
  var MONO_FONTS = [
    ["'JetBrains Mono'", 'JetBrains Mono', 700],
    ["'IBM Plex Mono'", 'IBM Plex Mono', 600],
    ["'Space Mono'", 'Space Mono', 700],
    ["'Roboto Mono'", 'Roboto Mono', 600],
    ["'Fira Code'", 'Fira Code', 600],
    ["'Courier Prime'", 'Courier Prime', 700],
  ];
  function fontWeight(fam) {
    for (var i = 0; i < MONO_FONTS.length; i++) if (MONO_FONTS[i][0] === fam) return MONO_FONTS[i][2];
    return 400;
  }

  // Palette: black, white and one signal orange. A neutral grey ramp, a
  // paper ramp (newsprint whites, warm blacks) and an orange ramp around
  // #ff5000; any other colour is one custom pick away.
  var RAMPS = [
    ['#000000', '#141414', '#2b2b2b', '#4d4d4d', '#7a7a7a', '#a8a8a8', '#d4d4d4', '#ededed', '#ffffff'],
    ['#0d0c0a', '#1c1a17', '#34312c', '#56524b', '#848077', '#b2ada3', '#d4cfc5', '#f5f2ec', '#fbfaf6'],
    ['#1f0800', '#3d1100', '#661d00', '#8f2900', '#c23a00', '#ff5000', '#ff7a3d', '#ffa679', '#ffd2b8'],
  ];
  var PAIRS = [
    { name: 'Blaze', bg: '#ff5000', ink: '#0d0c0a' },
    { name: 'Ember', bg: '#0d0c0a', ink: '#ff5000' },
    { name: 'Signal', bg: '#f5f2ec', ink: '#ff5000' },
    { name: 'Paper', bg: '#f5f2ec', ink: '#141414' },
    { name: 'Noir', bg: '#000000', ink: '#ffffff' },
    { name: 'Print', bg: '#ffffff', ink: '#000000' },
    { name: 'Graphite', bg: '#2b2b2b', ink: '#ededed' },
    { name: 'Ash', bg: '#a8a8a8', ink: '#000000' },
    { name: 'Smoke', bg: '#141414', ink: '#7a7a7a' },
  ];

  var TITLE_STYLE_HINTS = {
    melt: 'Glyph silhouettes fused by the blur — blocky and poster-weight.',
    ink: 'Letter skeletons drawn as one thin variable-width pen stroke, joined along the baseline, with small pockets flooded solid. Needs the built-in skeleton; an uploaded font falls back to Melt geometry.',
  };

  // ------------------------------------------------------------------ state
  var uid = 0;
  // Every big-title row carries its own transform AND its own style, so one
  // poster can pair a melted headline with an inked subhead.
  function makeRow(over) {
    var row = {
      id: ++uid, text: 'TEMPO', size: 170, tracking: 0.02,
      xp: 50, yp: 40, rot: 0,
      // how the letterform geometry is built
      style: 'melt', flow: 14, slant: 8, weight: 0.7, pocket: 0.045,
      // how the traced contour is drawn
      effect: 'solid', mode: 'outline',
      gap: 4, jitter: 2.2,          // rough
      lines: 5, spacing: 9,         // contour
    };
    if (over) Object.keys(over).forEach(function (k) { row[k] = over[k]; });
    return row;
  }
  function makeBlock(over) {
    var b = {
      id: ++uid, text: 'NEW TEXT', font: "'JetBrains Mono'",
      size: 30, lh: 130, align: 'left', xp: 6, yp: 92, color: '#141414',
    };
    if (over) Object.keys(over).forEach(function (k) { b[k] = over[k]; });
    return b;
  }

  // The demo poster, what a first visit (and Reset) opens on: the Font
  // tool's signature, liquid letters with drips, poured into the poster's
  // own effects. LIQUID solid and dripping, POSTER as a contour echo it
  // drips into, and an inked Vietnamese subhead (CHẢY TRÔI, "flowing,
  // adrift") for the composed accents and the pen-stroke style. Black on
  // signal orange (the Blaze pair).
  // `fit` asks for an auto size at boot (a fraction of the poster width).
  var DEMO_INK = '#0d0c0a';
  function defaultRows() {
    return [
      makeRow({ text: 'LIQUID', mode: 'filled', yp: 27.5, fit: 0.88 }),
      makeRow({ text: 'POSTER', effect: 'contour', mode: 'outline', lines: 7, spacing: 7, yp: 46.5, fit: 0.88 }),
      makeRow({
        text: 'CHẢY TRÔI', yp: 68.5, rot: -5, fit: 0.78,
        style: 'ink', mode: 'filled', flow: 13, slant: 7, weight: 0.8,
      }),
    ];
  }
  function defaultBlocks() {
    var caption = function (text, size, align, xp, yp) {
      return makeBlock({ text: text, size: size, lh: 130, align: align, xp: xp, yp: yp, color: DEMO_INK });
    };
    return [
      caption('LIQUID.POSTER\nVOL. 01 / 2026', 26, 'left', 6, 5),
      caption('MELT / INK / ECHO\nDRIP 100% · FLOW 85%', 26, 'right', 94, 5),
      caption('CHẢY TRÔI = FLOWING, ADRIFT', 22, 'center', 50, 80.5),
      caption('LETTERS POURED IN LIQUID.FONT,\nNOT DRAWN.', 22, 'left', 6, 92),
      caption('MARKDO27.GITHUB.IO\n/LIQUID-POSTER', 22, 'right', 94, 92),
    ];
  }
  // Every scalar the poster composition is made of, with its stock value.
  // Reset and restore both start from here.
  var DEFAULTS = {
    fontSource: 'builtin',
    seed: 5,
    melt: 8, tension: 2, wobble: 1.6, grain: 0.055, smooth: 2, strokeWidth: 1.5,
    canvasPreset: 'portrait', canvasW: 1000, canvasH: 1333,
    ink: DEMO_INK, bg: '#ff5000', bgTransparent: false,
  };

  var state = {
    fontSource: DEFAULTS.fontSource, uploadedFont: null, uploadedFontName: '',
    glyph: stockGlyph(),

    bigRows: defaultRows(),
    smallBlocks: defaultBlocks(),

    seed: DEFAULTS.seed,
    melt: DEFAULTS.melt, tension: DEFAULTS.tension, wobble: DEFAULTS.wobble,
    grain: DEFAULTS.grain, smooth: DEFAULTS.smooth, strokeWidth: DEFAULTS.strokeWidth,

    canvasPreset: DEFAULTS.canvasPreset, canvasW: DEFAULTS.canvasW, canvasH: DEFAULTS.canvasH,
    ink: DEFAULTS.ink, bg: DEFAULTS.bg, bgTransparent: DEFAULTS.bgTransparent,

    zoom: 0.5,
    selected: null, // {type:'row'|'block', id}
  };

  // -------------------------------------------------------------- utilities
  var toastTimer = null;
  function toast(msg, ms) {
    // role=status + aria-live on #toast: the text change is what gets announced
    var el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, ms || 2200);
  }
  function dl(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }
  function safeName() {
    var t = (state.bigRows[0] && state.bigRows[0].text) || 'poster';
    // fold accents so "TIẾNG VIỆT" names the file tieng-viet, not ti-ng-vi-t
    t = t.replace(/[Đđ]/g, 'd').normalize('NFD').replace(/\p{M}+/gu, '');
    return t.trim().replace(/[^a-z0-9\-_]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'poster';
  }
  function escapeXml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function mk(tag, cls, txt) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (txt != null) el.textContent = txt;
    return el;
  }
  function wrapDeg(d) { return ((d + 180) % 360 + 360) % 360 - 180; }
  function findRow(id) { for (var i = 0; i < state.bigRows.length; i++) if (state.bigRows[i].id === id) return state.bigRows[i]; return null; }
  function findBlock(id) { for (var i = 0; i < state.smallBlocks.length; i++) if (state.smallBlocks[i].id === id) return state.smallBlocks[i]; return null; }

  // ------------------------------------------------- Font-tool project link
  // The Font tool autosaves its project (every letter and accent skeleton with
  // the user's node edits, plus its shape and accent spacing) to localStorage.
  // When one is there the poster draws with those skeletons instead of the
  // stock ones. It is another page's data, so nothing is trusted: every number
  // is checked before it reaches the tracer, and a bad glyph is dropped on its
  // own rather than taking the whole project down with it.
  var PROJECT_KEY = 'liquidfont.project.v1';
  var project = null;     // validated project, or null
  var projectRaw;         // the raw string it was read from (undefined = never read)
  var link = {
    use: true,            // draw with the project's skeletons
    shape: true,          // ...and adopt its flow state + accent spacing
    saved: null,          // poster settings from before matching, restored on opt-out
  };
  var srcVer = 0;         // bumped whenever the glyph source changes (cache key)
  var DEFAULT_LAYOUT = GC ? copyObj(GC.LAYOUT) : null;

  var SHAPE_LIMITS = {
    mass: [0.3, 3], melt: [0, 80], tension: [-40, 40], wobble: [0, 20],
    grain: [0.001, 0.5], smooth: [0, 6], res: [0.8, 4],
    flow: [0, 1], warp: [0, 1], neck: [0, 1], sag: [0, 1], drip: [0, 1], dripForm: [0, 1], stretch: [1, 3],
  };
  var MARK_LIMITS = { scale: [0.5, 1.6], gapTop: [0, 30], gapStack: [0, 30], gapBottom: [0, 30] };  // as the Font tool clamps them

  function copyObj(o) { var c = {}; for (var k in o) if (hasOwn(o, k)) c[k] = o[k]; return c; }
  function finite(v) { return typeof v === 'number' && isFinite(v); }
  function clampTo(v, lim) { return Math.max(lim[0], Math.min(lim[1], v)); }

  // [[[x, y, r], ...], ...] with sane finite numbers, or null.
  function validChains(v) {
    if (!Array.isArray(v) || !v.length || v.length > 64) return null;
    var out = [];
    for (var i = 0; i < v.length; i++) {
      var c = v[i];
      if (!Array.isArray(c) || !c.length || c.length > 256) return null;
      var cc = [];
      for (var j = 0; j < c.length; j++) {
        var n = c[j];
        if (!Array.isArray(n) || n.length < 3) return null;
        var x = n[0], y = n[1], r = n[2];
        if (!finite(x) || !finite(y) || !finite(r)) return null;
        if (Math.abs(x) > 2000 || Math.abs(y) > 2000 || r < 0 || r > 400) return null;
        // optional 4th element: 1 starts a new melt group (blob-engine)
        cc.push(n.length > 3 && n[3] === 1 ? [x, y, Math.max(0.5, r), 1] : [x, y, Math.max(0.5, r)]);
      }
      out.push(cc);
    }
    return out;
  }

  function validateProject(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
    if (p.app != null && p.app !== 'liquid.font') return null;
    if (p.version != null && p.version !== 1) return null;
    if (!p.chains || typeof p.chains !== 'object' || Array.isArray(p.chains)) return null;
    var chains = Object.create(null), count = 0, edited = 0;
    Object.keys(p.chains).slice(0, 600).forEach(function (k) {
      if (!k || k.length > 8) return;
      var c = validChains(p.chains[k]);
      if (!c) return;
      chains[k] = c; count++;
      if (!hasOwn(BASE, k) || JSON.stringify(BASE[k]) !== JSON.stringify(c)) edited++;
    });
    if (!count) return null;

    var out = {
      chains: chains, count: count, edited: edited,
      fontName: typeof p.fontName === 'string' ? p.fontName.slice(0, 60) : '',
      preset: typeof p.preset === 'string' && hasOwn(presetTable(), p.preset) && !p.presetEdited ? p.preset : 'custom',
      seed: finite(p.seed) ? Math.round(Math.max(-1e6, Math.min(1e6, p.seed))) : null,
      shape: null, marks: null,
    };
    if (p.shape && typeof p.shape === 'object') {
      var sh = {}, nShape = 0;
      SHAPE_KEYS.forEach(function (k) {
        if (finite(p.shape[k])) { sh[k] = clampTo(p.shape[k], SHAPE_LIMITS[k]); nShape++; }
      });
      if (nShape) out.shape = fillFlowKeys(sh, p.preset);
    }
    if (p.marks && typeof p.marks === 'object') {
      var mk2 = {}, nMarks = 0;
      Object.keys(MARK_LIMITS).forEach(function (k) {
        if (finite(p.marks[k])) { mk2[k] = clampTo(p.marks[k], MARK_LIMITS[k]); nMarks++; }
      });
      if (nMarks) out.marks = mk2;
    }
    return out;
  }

  // Re-read storage. Returns true when the project actually changed.
  function readProject() {
    var raw = null;
    try { raw = window.localStorage.getItem(PROJECT_KEY); } catch (e) { raw = null; }
    if (raw === projectRaw) return false;
    projectRaw = raw;
    var p = null;
    if (typeof raw === 'string' && raw.length < 8e6) {
      try { p = validateProject(JSON.parse(raw)); } catch (e) { p = null; }
    }
    project = p;
    return true;
  }
  function linked() { return !!(project && link.use); }

  // Skeleton of a glyph or mark key from whichever source is active.
  function chainsOf(k) {
    if (linked() && k in project.chains) return project.chains[k];
    return hasOwn(BASE, k) ? BASE[k] : null;
  }
  function hasGlyph(k) { return !!chainsOf(k); }
  function isMark(k) { return !!(GC && GC.isMark(k)); }

  // Same per-letter seeding as the Font tool, so with its seed the noise
  // matches what the user saw there.
  function glyphSeed() { return linked() && project.seed != null ? project.seed : 7; }

  // ------------------------------------------------------- built-in glyphs
  var builtinCache = {};
  function glyphKey() {
    var g = state.glyph;
    var lay = GC ? Object.keys(GC.LAYOUT).map(function (k) { return GC.LAYOUT[k]; }).join(':') : '';
    return [srcVer, linked() ? 1 : 0, g.mass, g.melt, g.tension, g.wobble, g.grain, g.smooth, g.res,
      g.flow, g.warp, g.neck, g.sag, g.drip, g.dripForm, g.stretch, glyphSeed(), lay].join(',');
  }
  function cachePut(key, v) {
    if (Object.keys(builtinCache).length > 700) builtinCache = {};
    builtinCache[key] = v;
    return v;
  }
  // Per-glyph melt factor from the glyph data (GLYPH_DATA.tune, the same
  // table the Font tool's meltFor() reads): M, W, #, @, 8… melt less so their
  // narrow counters don't clot in the heavy flow states. A fused composite
  // (Ơ, Đ) is looked up by its own key, then by its base letter.
  var TUNE = GLYPH_DATA.tune && typeof GLYPH_DATA.tune === 'object' ? GLYPH_DATA.tune : null;
  function meltFactor(k) {
    if (!TUNE) return 1;
    var keys = [k, Array.from(k)[0]];
    for (var i = 0; i < keys.length; i++) {
      var t = hasOwn(TUNE, keys[i]) && TUNE[keys[i]];
      if (t && finite(t.melt) && t.melt > 0) return t.melt;
    }
    return 1;
  }
  // Drips hang only from letters and figures (as in the Font tool): never
  // from a mark, a dot or punctuation, nor from a letter that carries a mark
  // below it (noDrip), whose dot or cedilla would land in the drip.
  function traceOptsFor(k, noDrip) {
    var g = state.glyph;
    var o = {
      mass: g.mass, melt: g.melt * meltFactor(k), tension: g.tension, wobble: g.wobble,
      grain: g.grain, smooth: g.smooth, res: g.res || 1.6, simplify: 0.3,
      flow: g.flow || 0, warp: g.warp || 0, neck: g.neck || 0, sag: g.sag || 0,
      drip: noDrip || !/^(?:[A-Z0-9]|\p{Lu})$/u.test(k) ? 0 : g.drip || 0,
      dripForm: finite(g.dripForm) ? g.dripForm : 0.5, stretch: g.stretch || 1,
      seed: glyphSeed() + k.charCodeAt(0) * 13,
    };
    return GC ? GC.traceOpts(k, o) : o;
  }
  // each traced ring set remembers its drip-free foot, so drips never move
  // the measured foot line (fontLines)
  var FOOT = typeof WeakMap === 'function' ? new WeakMap() : null;
  function traceTo(chains, k, noDrip) {
    var t = BlobEngine.glyphTrace ? BlobEngine.glyphTrace(chains, traceOptsFor(k, noDrip))
      : { rings: BlobEngine.glyphRings(chains, traceOptsFor(k, noDrip)), foot: null };
    if (FOOT && t.foot != null) FOOT.set(t.rings, t.foot);
    return t.rings;
  }
  // A glyph or mark traced in its own space. Floating marks go through
  // markChains (global accent size) and traceOpts (gentler melt/tension).
  function builtinRings(k, noDrip) {
    var key = 'g:' + k + '@' + glyphKey() + (noDrip ? '|nd' : '');
    if (hasOwn(builtinCache, key)) return builtinCache[key];
    var ch = chainsOf(k), r = [];
    if (ch) {
      try { r = traceTo(GC ? GC.markChains(k, ch) : ch, k, noDrip); }
      catch (e) { console.error('glyph failed', k, e); r = []; }
    }
    return cachePut(key, r);
  }
  // Base + fused marks (horn, Đ bar) traced as one melted field.
  function traceAs(chains, k, noDrip) {
    var key = 't:' + k + '@' + glyphKey() + (noDrip ? '|nd' : '');
    if (hasOwn(builtinCache, key)) return builtinCache[key];
    var r;
    try { r = traceTo(chains, k, noDrip); }
    catch (e) { console.error('glyph failed', k, e); r = []; }
    return cachePut(key, r);
  }
  // Cap line and foot line of the whole set, so every accent in a word sits on
  // one line (A's apex doesn't lift its acute above E's). Measured from ink
  // over the same letters as the Font tool, so accents land where they do there.
  function fontLines() {
    var key = 'lines@' + glyphKey();
    if (hasOwn(builtinCache, key)) return builtinCache[key];
    var med = function (a) { a.sort(function (x, y) { return x - y; }); return a[a.length >> 1]; };
    var edge = function (letters, i) {
      var out = [];
      Array.from(letters).forEach(function (k) {
        var r = hasGlyph(k) && builtinRings(k), b = r && GC.bbox(r);
        if (!b) return;
        var f = i === 3 && FOOT ? FOOT.get(r) : null;
        out.push(f != null ? f : b[i]);
      });
      return out;
    };
    var tops = edge('HIETFZBDPRKL', 1), bots = edge('HIELNMKTFZ', 3);
    return cachePut(key, tops.length && bots.length ? { cap: med(tops), foot: med(bots) } : null);
  }
  var composeApi = {
    rings: builtinRings,
    chains: function (k) { return chainsOf(k) || []; },
    trace: traceAs,
    lines: fontLines,
  };

  // Text -> display clusters (base letter + its combining marks, NFC, caps).
  function clustersOf(text) {
    if (GC) return GC.clusters(text);
    return (String(text).normalize('NFC').toUpperCase().match(/\P{M}\p{M}*|\p{M}+/gu) || []);
  }
  function isSpace(c) { return /^\s/.test(c); }

  // One cluster of the built-in set, in glyph units, or null when it can't be
  // drawn: { rings, parts, base, marks }. For composites `parts` says where
  // each component's own origin landed and `marks` is the set of rings that
  // are floating accents; `base` is the plain base letter, whose ink defines
  // the cap band the row is anchored on.
  function clusterGlyph(c) {
    if (hasGlyph(c) && !isMark(c)) return { rings: builtinRings(c), parts: null, base: c, marks: null };
    if (!GC) return null;
    var key = 'c:' + c + '@' + glyphKey();
    if (hasOwn(builtinCache, key)) return builtinCache[key];
    var out = null, traced = null, seen = {};
    var plan = GC.plan(c, hasGlyph), below = !!(plan && plan.bottom && plan.bottom.length);
    // compose() passes the base rings through as-is and builds every placed
    // accent fresh, so ring identity tells them apart; record exactly the
    // arrays it was handed. A mark below means a drip-free base.
    var api = {
      rings: function (k) { return (seen[k] = builtinRings(k, below && plan && k === plan.base)); },
      chains: composeApi.chains, lines: composeApi.lines,
      trace: function (ch, k) { return (traced = traceAs(ch, k, below)); },
    };
    try {
      var comp = GC.compose(c, api, hasGlyph);
      if (comp && comp.rings && comp.parts && comp.parts.length) {
        var baseKey = comp.parts[0].key;
        var baseSet = new Set(traced || seen[baseKey] || []);
        var marks = comp.rings.filter(function (r) { return !baseSet.has(r); });
        out = {
          rings: comp.rings, parts: comp.parts, base: baseKey,
          // nothing matched: compose copied the base after all, so draw it all as letter ink
          marks: marks.length < comp.rings.length ? new Set(marks) : null,
        };
      }
    } catch (e) { console.error('compose failed', c, e); out = null; }
    return cachePut(key, out);
  }

  function inkBounds(rings) {
    var a = 1e9, b = -1e9;
    rings.forEach(function (r) { r.forEach(function (p) { if (p[0] < a) a = p[0]; if (p[0] > b) b = p[0]; }); });
    return a > b ? [0, GW] : [a, b];
  }
  function ringsYRange(rings) {
    var a = 1e9, b = -1e9;
    rings.forEach(function (r) { r.forEach(function (p) { if (p[1] < a) a = p[1]; if (p[1] > b) b = p[1]; }); });
    return a > b ? null : [a, b];
  }
  function growBand(band, y0, y1) {
    if (y0 < band[0]) band[0] = y0;
    if (y1 > band[1]) band[1] = y1;
  }

  // Spacing of accented letters. A cluster advances by its LETTER's ink (the
  // plain base plus anything fused into it, the Ơ/Ư horn and the Đ bar),
  // never by its floating marks: a tone beside a circumflex, or a hook, sits
  // above the cap line and may overhang the neighbour, as in the Font tool.
  // Without this "TIẾNG" opened a gap after the Ế. The only thing that can
  // then collide is two neighbours' marks, so those get a kerning floor:
  // never closer than MARK_KERN glyph units, at the same height.
  var MARK_KERN = 4;
  // Boxes of a cluster's floating marks, split into the ones above the
  // letter and the ones below it: [top, bottom], each [x0, y0, x1, y1] or null.
  function splitMarkBoxes(items, boxOf, midY) {
    var out = [null, null];
    items.forEach(function (it) {
      var b = boxOf(it);
      if (!b) return;
      var i = (b[1] + b[3]) / 2 < midY ? 0 : 1, o = out[i];
      out[i] = o ? [Math.min(o[0], b[0]), Math.min(o[1], b[1]), Math.max(o[2], b[2]), Math.max(o[3], b[3])] : b;
    });
    return out[0] || out[1] ? out : null;
  }
  // How far right a cluster whose marks sit at `boxes` (already placed, in
  // poster px) has to move so they clear every earlier mark in the row.
  function markKernPush(boxes, placed, gap) {
    var push = 0;
    if (!boxes) return 0;
    placed.forEach(function (p) {
      boxes.forEach(function (b, i) {
        var q = p[i];
        if (!b || !q || b[1] > q[3] + gap || b[3] < q[1] - gap) return;
        // only marks that would otherwise overlap from the left; one that
        // ends up entirely to the left of an earlier mark is a separate case
        if (b[2] <= q[0]) return;
        push = Math.max(push, q[2] + gap - b[0]);
      });
    });
    return push;
  }
  function shiftBoxes(boxes, dx, dy) {
    return boxes && boxes.map(function (b) { return b && [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy]; });
  }

  // Lay out one row using the built-in glyph set. Returns the same shape as
  // uploadRowGeom so the rest of the pipeline never has to know which font
  // source produced it.
  // Both layout builders hand back raw geometry rather than a finished shape,
  // so finishLayout can slant it and measure the result before anyone draws.
  // `band` is the y-extent of the base letters alone (accents excluded), and
  // `missing` lists the clusters the set could not draw.
  function builtinRowGeom(text, size, tracking) {
    var scale = size / GH, gap = tracking * size;
    var x = 0, y = 0, polys = [], markPolys = [], missing = [], band = [1e9, -1e9];
    var placedMarks = [];
    clustersOf(text).forEach(function (c) {
      if (isSpace(c)) { x += SPACE * scale + gap; return; }
      var cg = clusterGlyph(c);
      if (!cg) { missing.push(c); x += SPACE * scale + gap; return; }
      var rings = cg.rings;
      var letter = cg.marks ? rings.filter(function (r) { return !cg.marks.has(r); }) : rings;
      var bb = inkBounds(letter.length ? letter : rings);
      var w = (bb[1] - bb[0] + SIDE * 2) * scale;
      var ox = x - (bb[0] - SIDE) * scale;
      if (cg.marks && letter.length) {
        var ly = ringsYRange(letter);
        var mb = splitMarkBoxes(rings.filter(function (r) { return cg.marks.has(r); }), function (r) {
          var b = GC.bbox([r]);
          return b && [ox + b[0] * scale, y + b[1] * scale, ox + b[2] * scale, y + b[3] * scale];
        }, y + (ly ? (ly[0] + ly[1]) / 2 : GH / 2) * scale);
        var push = markKernPush(mb, placedMarks, MARK_KERN * scale);
        if (push > 0) { x += push; ox += push; mb = shiftBoxes(mb, push, 0); }
        if (mb) placedMarks.push(mb);
      }
      for (var r = 0; r < rings.length; r++) {
        var ring = rings[r], poly = new Array(ring.length);
        for (var p = 0; p < ring.length; p++) poly[p] = [ox + ring[p][0] * scale, y + ring[p][1] * scale];
        (cg.marks && cg.marks.has(ring) ? markPolys : polys).push(poly);
      }
      var yr = ringsYRange(cg.parts ? builtinRings(cg.base) : rings);
      if (yr) growBand(band, y + yr[0] * scale, y + yr[1] * scale);
      x += w + gap;
    });
    return {
      kind: 'polys', polys: polys, markPolys: markPolys,
      fallbackW: size * 0.6, fallbackH: size,
      missing: missing, band: band[0] < band[1] ? band : null,
    };
  }

  // A cluster's pen skeleton for Ink stroke: { base: chains, marks: chains },
  // in glyph units. Composites reuse compose()'s placement and move each
  // part's own chains to where its origin landed.
  var CARRIERS = { '\u0302': 1, '\u0306': 1 };   // circumflex, breve
  function clusterChains(c) {
    if (hasGlyph(c) && !isMark(c)) return { base: chainsOf(c), marks: [] };
    var cg = clusterGlyph(c);
    if (!cg || !cg.parts) return null;
    var base = [], marks = [];
    cg.parts.forEach(function (part, i) {
      var ch = chainsOf(part.key) || [];
      if (part.zone === 'top' || part.zone === 'bottom') {
        ch = GC.markChains(part.key, ch);
        // compose() squashes a circumflex/breve that carries a tone; follow it
        // so the tone placed against the squashed ring doesn't collide
        var squash = GC.LAYOUT.squash;
        if (part.zone === 'top' && CARRIERS[part.key] && finite(squash) && squash !== 1 &&
            cg.parts.slice(i + 1).some(function (q) { return q.zone === 'top'; })) {
          var yr = ringsYRange(builtinRings(part.key));
          if (yr) {
            ch = ch.map(function (cc) {
              return cc.map(function (n) { return [n[0], yr[1] - (yr[1] - n[1]) * squash, n[2]]; });
            });
          }
        }
      }
      var placed = GC.shiftChains(ch, part.ox, part.oy);
      if (part.zone === 'top' || part.zone === 'bottom') marks = marks.concat(placed);
      else base = base.concat(placed);
    });
    return { base: base, marks: marks };
  }

  // Ink style, built-in font only: the glyph data is already a set of node
  // chains carrying per-node radii — i.e. a pen skeleton, not an outline. Using
  // it directly gives a genuinely variable-width stroke that swells where
  // strokes cross, instead of melting a fat silhouette into a blob.
  function builtinInkGeom(text, size, tracking, weight) {
    var scale = size / GH, gap = tracking * size;
    var x = 0, chains = [], markChains = [], missing = [], band = [1e9, -1e9];
    var placedMarks = [];
    clustersOf(text).forEach(function (c) {
      if (isSpace(c)) { x += SPACE * scale + gap; return; }
      var cc = clusterChains(c);
      if (!cc) { missing.push(c); x += SPACE * scale + gap; return; }
      var all = cc.base.concat(cc.marks);
      // advance from the letter (fused horn / bar are in cc.base); marks overhang
      var nmin = 1e9, nmax = -1e9, ny0 = 1e9, ny1 = -1e9;
      (cc.base.length ? cc.base : all).forEach(function (ch) {
        ch.forEach(function (n) {
          if (n[0] - n[2] < nmin) nmin = n[0] - n[2];
          if (n[0] + n[2] > nmax) nmax = n[0] + n[2];
          if (n[1] < ny0) ny0 = n[1];
          if (n[1] > ny1) ny1 = n[1];
        });
      });
      if (nmin > nmax) { nmin = 0; nmax = GW; ny0 = 0; ny1 = GH; }
      var w = (nmax - nmin + SIDE * 2) * scale;
      var ox = x - (nmin - SIDE) * scale;
      if (cc.marks.length && cc.base.length) {
        var mb = splitMarkBoxes(cc.marks, function (ch) {
          var b = [1e9, 1e9, -1e9, -1e9];
          ch.forEach(function (n) {
            var r = Math.max(0.6, n[2] * scale * weight) / scale;
            b = [Math.min(b[0], n[0] - r), Math.min(b[1], n[1] - r), Math.max(b[2], n[0] + r), Math.max(b[3], n[1] + r)];
          });
          return b[0] <= b[2] ? [ox + b[0] * scale, b[1] * scale, ox + b[2] * scale, b[3] * scale] : null;
        }, (ny0 + ny1) / 2 * scale);
        var push = markKernPush(mb, placedMarks, MARK_KERN * scale);
        if (push > 0) { x += push; ox += push; mb = shiftBoxes(mb, push, 0); }
        if (mb) placedMarks.push(mb);
      }
      all.forEach(function (ch, ci) {
        var isBase = ci < cc.base.length;
        (isBase ? chains : markChains).push(ch.map(function (n) {
          var r = Math.max(0.6, n[2] * scale * weight), yy = n[1] * scale;
          if (isBase) growBand(band, yy - r, yy + r);
          return [ox + n[0] * scale, yy, r];
        }));
      });
      x += w + gap;
    });
    return {
      kind: 'chains', chains: chains, markChains: markChains, fallbackW: size * 0.6, fallbackH: size,
      missing: missing, band: band[0] < band[1] ? band : null,
    };
  }

  // ------------------------------------------------------- uploaded fonts
  // Some uploaded fonts — including this tool's own OTF export, which only
  // maps A–Z/0–9/punctuation — have no lowercase in their cmap at all.
  // font.stringToGlyphs() doesn't know that; it silently hands back .notdef
  // (usually an empty path) for anything unmapped, so the row renders as
  // nothing with no error. Look each character up ourselves and retry
  // uppercased before giving up, the same fallback the built-in font documents.
  function cmapIndex(font, ch) {
    try { return font.charToGlyphIndex(ch) || 0; } catch (e) { return 0; }
  }
  function glyphIndexFor(font, ch) {
    var idx = cmapIndex(font, ch);
    if (idx) return idx;
    var upper = ch.toUpperCase().normalize('NFC');
    if (upper !== ch && Array.from(upper).length === 1) idx = cmapIndex(font, upper);
    return idx || 0;
  }
  function pathBox(path) {
    try {
      var b = path.getBoundingBox();
      if (isFinite(b.x1) && isFinite(b.y1) && b.x2 >= b.x1 && b.y2 >= b.y1) return b;
    } catch (e) { /* empty path */ }
    return null;
  }

  // opentype.js has no mark positioning (no GPOS), so a letter the font lacks
  // precomposed is rebuilt from its NFD base + combining-mark glyphs, each mark
  // centred on the base's ink and nudged clear of it (and of the previous mark).
  // Vietnamese follows the Font tool's convention (GlyphCompose.compose): a
  // tone after a circumflex sits BESIDE it, not on top (acute and hook to the
  // right, grave to the left, tucked over the circumflex's outer edge), and a
  // circumflex / breve that carries a tone is squashed to keep the stack low.
  var MARK_ABOVE = /[\u0300-\u0315\u031A\u033D-\u0344\u0346\u034A-\u034C\u0350-\u0352\u0357\u035B\u0363-\u036F]/;
  var MARK_BELOW = /[\u0316-\u0319\u031C-\u0333\u0339-\u033C\u0347-\u0349\u034D\u034E\u0353-\u0356\u0359\u035A]/;
  var DECOMPOSE_EXTRA = { 'Đ': 'D\u0335', 'đ': 'd\u0335' };
  var BESIDE_CIRC = { '\u0301': 1, '\u0309': 1, '\u0300': -1 };   // acute, hook right; grave left
  // the same numbers as GlyphCompose.LAYOUT (glyph units, cap height = 100)
  function composeLayout() {
    var L = GC && GC.LAYOUT || {};
    return {
      tuck: finite(L.sideTuck) ? L.sideTuck : 3, rise: finite(L.sideRise) ? L.sideRise : 0.55,
      squash: finite(L.squash) ? L.squash : 0.8, clear: finite(L.clear) ? L.clear : 3,
    };
  }
  // Path commands -> closed polylines (curves sampled), for clearance checks.
  function cmdsToRings(cmds) {
    var rings = [], cur = null, px = 0, py = 0, N = 8;
    cmds.forEach(function (c) {
      if (c.type === 'M') { cur = [[c.x, c.y]]; rings.push(cur); px = c.x; py = c.y; return; }
      if (!cur) { cur = [[px, py]]; rings.push(cur); }
      var i, t, u;
      if (c.type === 'L') cur.push([c.x, c.y]);
      else if (c.type === 'Q') {
        for (i = 1; i <= N; i++) {
          t = i / N; u = 1 - t;
          cur.push([u * u * px + 2 * u * t * c.x1 + t * t * c.x, u * u * py + 2 * u * t * c.y1 + t * t * c.y]);
        }
      } else if (c.type === 'C') {
        for (i = 1; i <= N; i++) {
          t = i / N; u = 1 - t;
          cur.push([u * u * u * px + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
                    u * u * u * py + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y]);
        }
      } else if (c.type === 'Z') { cur = null; return; }
      if (c.x != null) { px = c.x; py = c.y; }
    });
    return rings.filter(function (r) { return r.length > 1; });
  }
  function ptSegDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    var t = l2 > 1e-9 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  // Smallest outline-to-outline distance, or Infinity beyond `limit`; 0 when
  // one shape's vertex lies inside the other's box overlap and they cross.
  function ringsGap(ra, rb, limit) {
    var A = GC ? GC.bbox(ra) : null, B = GC ? GC.bbox(rb) : null;
    if (!A || !B) return Infinity;
    if (A[0] > B[2] + limit || B[0] > A[2] + limit || A[1] > B[3] + limit || B[1] > A[3] + limit) return Infinity;
    var best = Infinity;
    function scan(P, R) {
      P.forEach(function (r) {
        r.forEach(function (p) {
          R.forEach(function (s) {
            for (var k = 0; k < s.length; k++) {
              var d = ptSegDist(p, s[k], s[(k + 1) % s.length]);
              if (d < best) best = d;
            }
          });
        });
      });
    }
    scan(ra, rb); scan(rb, ra);
    return best;
  }
  function shiftCmds(cmds, dx, dy) {
    return cmds.map(function (c) {
      var o = { type: c.type };
      ['x', 'x1', 'x2'].forEach(function (k) { if (c[k] != null) o[k] = c[k] + dx; });
      ['y', 'y1', 'y2'].forEach(function (k) { if (c[k] != null) o[k] = c[k] + dy; });
      return o;
    });
  }
  // vertical squash about the shape's own bottom edge (canvas y grows down)
  function squashCmds(cmds, bottom, k) {
    return cmds.map(function (c) {
      var o = {}; for (var key in c) o[key] = c[key];
      ['y', 'y1', 'y2'].forEach(function (yk) { if (o[yk] != null) o[yk] = bottom - (bottom - o[yk]) * k; });
      return o;
    });
  }
  function cmdsBox(cmds) {
    var b = [1e9, 1e9, -1e9, -1e9];
    cmdsToRings(cmds).forEach(function (r) {
      r.forEach(function (p) {
        if (p[0] < b[0]) b[0] = p[0]; if (p[0] > b[2]) b[2] = p[0];
        if (p[1] < b[1]) b[1] = p[1]; if (p[1] > b[3]) b[3] = p[1];
      });
    });
    return b[0] <= b[2] ? b : null;
  }
  function drawDecomposed(font, c, x, size, cmds, markCmds) {
    var cps = Array.from(DECOMPOSE_EXTRA[c] || c.normalize('NFD'));
    var bi = /^\p{M}/u.test(cps[0]) ? 0 : glyphIndexFor(font, cps[0]);
    if (!bi) return { base: null, complete: false };
    var bg = font.glyphs.get(bi);
    var bp = bg.getPath(x, 0, size);
    Array.prototype.push.apply(cmds, bp.commands);
    var bb = pathBox(bp);
    var adv = (bg.advanceWidth || font.unitsPerEm * 0.55) * size / font.unitsPerEm;
    var x1 = bb ? bb.x1 : x, x2 = bb ? bb.x2 : x + adv;
    var top = bb ? bb.y1 : -size * 0.7, bottom = bb ? bb.y2 : 0;
    var cx = (x1 + x2) / 2, gap = size * 0.05, complete = true;
    // glyph units (cap = 100) -> px, so the Font tool's numbers carry over
    var capPx = fontRefLines(font).cap * size / font.unitsPerEm, unit = capPx / 100;
    var lay = composeLayout(), clear = lay.clear * unit;
    var obstacles = [cmdsToRings(bp.commands)];
    var prev = null, prevBox = null;
    cps.slice(1).forEach(function (m, idx, rest) {
      var mi = cmapIndex(font, m);
      if (!mi) { complete = false; return; }
      var mg = font.glyphs.get(mi);
      var mcmds = mg.getPath(0, 0, size).commands;
      var mb = cmdsBox(mcmds);
      if (!mb) return;
      var above = MARK_ABOVE.test(m);
      // a circumflex or breve that carries a tone is squashed, like the Font tool does
      if (above && (m === '\u0302' || m === '\u0306') && rest.slice(idx + 1).some(function (q) { return MARK_ABOVE.test(q); })) {
        mcmds = squashCmds(mcmds, mb[3], lay.squash);
        mb = cmdsBox(mcmds);
      }
      var mcx = (mb[0] + mb[2]) / 2, dx, dy, dir = 0;
      var side = above && prev === '\u0302' && prevBox && BESIDE_CIRC[m];
      if (side) {
        // the tone's near edge tucks just over the circumflex's outer edge,
        // its ink bottom part way up the circumflex: well clear of the apex
        dx = side > 0 ? prevBox[2] - lay.tuck * unit - mb[0] : prevBox[0] + lay.tuck * unit - mb[2];
        dy = prevBox[3] - (prevBox[3] - prevBox[1]) * lay.rise - mb[3];
        dir = -1;
      } else if (above) {
        dx = cx - mcx;
        dy = Math.min(0, (top - gap) - mb[3]);     // lift only if it would cut in
        dir = -1;
      } else if (MARK_BELOW.test(m)) {
        dx = cx - mcx;
        dy = Math.max(0, (bottom + gap) - mb[1]);
        dir = 1;
      } else if (m === '\u031B') {                  // horn: hooks onto the top right
        dx = x2 - mb[0] - size * 0.06;
        dy = (bb ? bb.y1 : top) - size * 0.04 - mb[1];
      } else if (m === '\u0335') {                  // short stroke: across the stem
        dx = x1 + (x2 - x1) * 0.3 - mcx;
        dy = (bb ? (bb.y1 + bb.y2) / 2 : -size * 0.35) - (mb[1] + mb[3]) / 2;
      } else {                                      // other overlays: centred, as drawn
        dx = cx - mcx; dy = 0;
      }
      // floating marks keep LAYOUT.clear from the letter and every mark placed
      // so far, nudged away (up for marks above, down for marks below)
      var placed = shiftCmds(mcmds, dx, dy);
      if (dir) {
        for (var it = 0; it < 6; it++) {
          var pr = cmdsToRings(placed), need = 0;
          obstacles.forEach(function (o) {
            var g = ringsGap(pr, o, clear + 1);
            if (g < clear) need = Math.max(need, clear - g + 0.25 * unit);
          });
          if (!need) break;
          dy += dir * need;
          placed = shiftCmds(mcmds, dx, dy);
        }
      }
      // attached parts (a horn) are obstacles for the marks after them too
      obstacles.push(cmdsToRings(placed));
      var pb = cmdsBox(placed);
      if (above && pb) { top = Math.min(top, pb[1]); prev = m; prevBox = pb; }
      if (dir > 0 && pb) bottom = Math.max(bottom, pb[3]);
      Array.prototype.push.apply(markCmds, placed);
    });
    return { base: bg, complete: complete };
  }

  // A precomposed letter (Ấ, Ệ, ữ…) arrives as ONE glyph, so its accents would
  // go through the row's Merge blur with the letter and — being the thinnest,
  // most isolated ink — vanish: "TIẾNG VIỆT" came out "TIĖNG VIĖT", which
  // changes the meaning. Its contours are sorted instead: any that sits wholly
  // above the plain base letter (capped at the cap height) or wholly below the
  // baseline is a floating mark and joins the unblurred mark layer, exactly as
  // drawDecomposed's marks do. The font designer's own placement is kept, so a
  // Vietnamese tone still sits beside its circumflex rather than on top of it.
  // Attached parts (a horn, an ogonek) touch the letter and stay in the body.
  function fontRefLines(font) {
    if (font._lfLines) return font._lfLines;
    var upm = font.unitsPerEm || 1000, os2 = font.tables && font.tables.os2;
    var top = function (ch) { return glyphTopU(font, ch); };
    var cap = os2 && os2.sCapHeight > 0 ? os2.sCapHeight : top('H') || upm * 0.7;
    var xh = os2 && os2.sxHeight > 0 ? os2.sxHeight : top('x') || upm * 0.5;
    font._lfLines = { cap: cap, xh: xh, markLine: Object.create(null) };
    return font._lfLines;
  }
  // Top of a character's ink in font units (y up), or null when it has none.
  function glyphTopU(font, ch) {
    var i = cmapIndex(font, ch);
    if (!i) return null;
    var b = pathBox(font.glyphs.get(i).getPath(0, 0, font.unitsPerEm));   // 1 unit = 1 px
    return b ? -b.y1 : null;
  }
  // Height (font units) a contour of `ch` must clear to count as a floating mark.
  function markLineU(font, ch) {
    var L = fontRefLines(font);
    if (ch in L.markLine) return L.markLine[ch];
    var cps = Array.from(ch.normalize('NFD')), line = L.cap;
    if (cps.length > 1 && !/^\p{M}/u.test(cps[0]) && cps.slice(1).every(function (m) { return /^\p{M}$/u.test(m); })) {
      var b = cps[0], t = null;
      // i/j carry a tittle that is not an accent: measure their dotless forms
      if (b === 'i' || b === 'j') t = glyphTopU(font, b === 'i' ? 'ı' : 'ȷ') || L.xh;
      else t = glyphTopU(font, b);
      if (t == null) t = b !== b.toUpperCase() ? L.xh : L.cap;
      line = Math.min(t, L.cap);
    } else if (cps.length === 1 && ch !== ch.toUpperCase()) {
      // A plain lowercase letter: ink wholly above its x-height can only be a
      // dot (i, j, ĳ…) or a bar riding over an ascender (đ, ħ). Measured the
      // way the composed ị is, so a plain i keeps its dot under Merge too
      // (the dot is the smallest, most isolated ink: the blur ate it).
      var dl = ch === 'i' || ch === 'j' ? glyphTopU(font, ch === 'i' ? '\u0131' : '\u0237') : null;
      line = Math.min(dl || L.xh, L.cap);
    }
    L.markLine[ch] = line;
    return line;
  }
  // Thinnest regular stroke of an uploaded font in font units: the H
  // crossbar (a vertical run through its middle), else the I / l stem. The
  // Đ bar and the Ơ/Ư horns are strokes of about that weight, so a Merge
  // blur much wider than it rubs them out (see rowMelt).
  function fontThinU(font) {
    if (font._lfThin !== undefined) return font._lfThin;
    var out = null;
    try {
      var S = 320, c = document.createElement('canvas');
      c.width = S + 80; c.height = S + 80;
      var ctx = c.getContext('2d', { willReadFrequently: true });
      var run = function (ch, vertical) {
        var gi = cmapIndex(font, ch);
        if (!gi) return null;
        var path = font.glyphs.get(gi).getPath(40, S, S);
        var b = pathBox(path);
        if (!b) return null;
        ctx.clearRect(0, 0, c.width, c.height);
        path.fill = '#000'; path.draw(ctx);
        var data, i, best = 0, cur = 0;
        if (vertical) {
          var col = Math.round((b.x1 + b.x2) / 2);
          data = ctx.getImageData(col, 0, 1, c.height).data;
          for (i = 0; i < c.height; i++) {
            if (data[i * 4 + 3] > 127) { cur++; if (cur > best) best = cur; } else cur = 0;
          }
        } else {
          var rowY = Math.round((b.y1 + b.y2) / 2);
          data = ctx.getImageData(0, rowY, c.width, 1).data;
          for (i = 0; i < c.width; i++) {
            if (data[i * 4 + 3] > 127) { cur++; if (cur > best) best = cur; } else cur = 0;
          }
        }
        var u = best * font.unitsPerEm / S;
        // anything outside a plausible stroke weight is a measuring miss
        return u > font.unitsPerEm * 0.008 && u < font.unitsPerEm * 0.3 ? u : null;
      };
      out = run('H', true) || run('I', false) || run('l', false);
    } catch (e) { out = null; }
    font._lfThin = out;
    return out;
  }
  // Merge blur actually used for a row. Uploaded fonts cap it at about half
  // their thinnest stroke at the row's size: beyond that the blur no longer
  // melts letters together, it erodes them (the Đ bar and the Ơ/Ư horns went
  // first). The built-in Liquid letters are all fat strokes and keep the
  // slider value as set.
  var THIN_BLUR = 0.55;
  function rowMelt(row) {
    var m = state.melt;
    if (state.fontSource !== 'upload' || !state.uploadedFont || !(m > 0)) return m;
    var thin = fontThinU(state.uploadedFont);
    if (!thin) return m;
    return Math.min(m, Math.max(0.5, THIN_BLUR * thin * row.size / state.uploadedFont.unitsPerEm));
  }

  // Cap height and baseline only mean "accent zone" in the cased alphabets; a
  // CJK ideograph's top stroke also clears the cap height, and is no accent.
  var CASED_SCRIPT = /^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}]/u;
  // Split one glyph's path commands into contours and route each to the body
  // or the mark layer. `aboveY` / `belowY` are canvas y (y down).
  function routeContours(cmds, aboveY, belowY, body, marks) {
    var cur = null, y0 = 1e9, y1 = -1e9;
    function flush() {
      if (cur && cur.length) {
        var isMark = y0 <= y1 && (y1 <= aboveY || y0 >= belowY);
        Array.prototype.push.apply(isMark ? marks : body, cur);
      }
      cur = null; y0 = 1e9; y1 = -1e9;
    }
    function see(y) { if (y != null) { if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    for (var i = 0; i < cmds.length; i++) {
      var c = cmds[i];
      if (c.type === 'M') flush();
      if (!cur) cur = [];
      cur.push(c);
      see(c.y); see(c.y1); see(c.y2);
      if (c.type === 'Z') flush();
    }
    flush();
  }

  function uploadRowGeom(font, text, size, trackingPx) {
    var scale = size / font.unitsPerEm, upm = font.unitsPerEm;
    var cmds = [], markCmds = [], missing = [];
    var x = 0, drawn = 0, total = 0;
    // whole code point clusters, never UTF-16 halves or detached marks
    var units = String(text).normalize('NFC').match(/\P{M}\p{M}*|\p{M}+/gu) || [];
    units.forEach(function (c) {
      if (isSpace(c)) { x += font.unitsPerEm * 0.28 * scale + trackingPx; return; }
      total++;
      var gi = Array.from(c).length === 1 ? glyphIndexFor(font, c) : 0;
      var g;
      if (gi) {
        g = font.glyphs.get(gi);
        // the character actually drawn (glyphIndexFor may have uppercased it)
        var drawnCh = cmapIndex(font, c) ? c : c.toUpperCase().normalize('NFC');
        var gcmds = g.getPath(x, 0, size).commands;
        if (CASED_SCRIPT.test(drawnCh.normalize('NFD'))) {
          // a little slack either side: an accent may kiss the line it clears
          routeContours(gcmds, -(markLineU(font, drawnCh) - upm * 0.03) * scale, -upm * 0.01 * scale, cmds, markCmds);
        } else {
          Array.prototype.push.apply(cmds, gcmds);
        }
        drawn++;
      } else {
        var d = drawDecomposed(font, c, x, size, cmds, markCmds);
        g = d.base || font.glyphs.get(0);
        if (d.base) drawn++;
        if (!d.complete) missing.push(c);
      }
      x += (g.advanceWidth || font.unitsPerEm * 0.55) * scale + trackingPx;
    });
    return {
      kind: 'path', cmds: cmds, markCmds: markCmds, fallbackW: Math.max(x, size * 0.6), fallbackH: size,
      empty: total > 0 && drawn === 0, missing: missing, band: null,
    };
  }

  // Slant about the baseline: points above it swing right, so the baseline
  // itself stays put the way a real italic does.
  function shearGeom(geom, tan, pivotY) {
    if (!tan) return;
    if (geom.kind === 'polys') {
      geom.polys.concat(geom.markPolys || []).forEach(function (poly) {
        poly.forEach(function (p) { p[0] -= tan * (p[1] - pivotY); });
      });
    } else if (geom.kind === 'chains') {
      geom.chains.concat(geom.markChains || []).forEach(function (ch) {
        ch.forEach(function (n) { n[0] -= tan * (n[1] - pivotY); });
      });
    } else {
      geom.cmds.concat(geom.markCmds || []).forEach(function (c) {
        if (c.x != null) c.x -= tan * (c.y - pivotY);
        if (c.x1 != null) c.x1 -= tan * (c.y1 - pivotY);
        if (c.x2 != null) c.x2 -= tan * (c.y2 - pivotY);
      });
    }
  }

  function geomBBox(geom) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    if (geom.kind === 'polys') {
      geom.polys.concat(geom.markPolys || []).forEach(function (r) { r.forEach(function (p) {
        if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
        if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
      }); });
    } else if (geom.kind === 'chains') {
      geom.chains.concat(geom.markChains || []).forEach(function (ch) { ch.forEach(function (n) {
        if (n[0] - n[2] < x0) x0 = n[0] - n[2]; if (n[0] + n[2] > x1) x1 = n[0] + n[2];
        if (n[1] - n[2] < y0) y0 = n[1] - n[2]; if (n[1] + n[2] > y1) y1 = n[1] + n[2];
      }); });
    } else {
      var p = new opentype.Path(); p.commands = geom.cmds.concat(geom.markCmds || []);
      try {
        var bb = p.getBoundingBox();
        x0 = bb.x1; y0 = bb.y1; x1 = bb.x2; y1 = bb.y2;
      } catch (e) { /* falls through to the guard below */ }
    }
    if (!(isFinite(x0) && isFinite(y0) && x1 > x0 && y1 > y0)) {
      return [0, -geom.fallbackH, geom.fallbackW, 0];
    }
    return [x0, y0, x1, y1];
  }

  // Stamp overlapping discs along a chain, lerping the radius between nodes.
  // The mask is blurred and thresholded downstream, so discs are indistinguish-
  // able from a true tapered capsule and cost a fraction of the code.
  function strokeChain(ctx, ch) {
    if (ch.length === 1) {
      var n = ch[0];
      ctx.moveTo(n[0] + n[2], n[1]);
      ctx.arc(n[0], n[1], n[2], 0, Math.PI * 2);
      return;
    }
    for (var i = 0; i < ch.length - 1; i++) {
      var a = ch[i], b = ch[i + 1];
      var d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      var steps = Math.max(2, Math.ceil(d / Math.max(0.8, Math.min(a[2], b[2]) * 0.45)));
      for (var s = 0; s <= steps; s++) {
        var t = s / steps;
        var px = a[0] + (b[0] - a[0]) * t;
        var py = a[1] + (b[1] - a[1]) * t;
        var pr = a[2] + (b[2] - a[2]) * t;
        ctx.moveTo(px + pr, py);
        ctx.arc(px, py, pr, 0, Math.PI * 2);
      }
    }
  }

  // Floating accents are kept apart from the letters' geometry: the row's
  // Merge blur would otherwise erase them from a small row (they are the
  // thinnest, most isolated ink there) or bridge them into their letter
  // across a gap narrower than the blur. computeContour draws them after the
  // blur instead, so they reach the threshold crisp and always separate.
  function drawMarks(geom, ctx) {
    ctx.beginPath();
    if (geom.kind === 'polys') {
      (geom.markPolys || []).forEach(function (r) {
        if (!r.length) return;
        ctx.moveTo(r[0][0], r[0][1]);
        for (var i = 1; i < r.length; i++) ctx.lineTo(r[i][0], r[i][1]);
        ctx.closePath();
      });
    } else if (geom.kind === 'chains') {
      (geom.markChains || []).forEach(function (ch) { strokeChain(ctx, ch); });
    } else {
      pathCmds(ctx, geom.markCmds || []);   // an uploaded font's fallback marks
    }
    ctx.fill();
  }
  function hasMarks(geom) {
    return ['markPolys', 'markChains', 'markCmds'].some(function (k) { return geom[k] && geom[k].length; });
  }

  function drawGeom(geom, ctx) {
    ctx.beginPath();
    if (geom.kind === 'polys') {
      geom.polys.forEach(function (r) {
        if (!r.length) return;
        ctx.moveTo(r[0][0], r[0][1]);
        for (var i = 1; i < r.length; i++) ctx.lineTo(r[i][0], r[i][1]);
        ctx.closePath();
      });
    } else if (geom.kind === 'chains') {
      geom.chains.forEach(function (ch) { strokeChain(ctx, ch); });
    } else {
      pathCmds(ctx, geom.cmds);
    }
    ctx.fill();
  }
  function pathCmds(ctx, cmds) {
    cmds.forEach(function (c) {
      if (c.type === 'M') ctx.moveTo(c.x, c.y);
      else if (c.type === 'L') ctx.lineTo(c.x, c.y);
      else if (c.type === 'C') ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
      else if (c.type === 'Q') ctx.quadraticCurveTo(c.x1, c.y1, c.x, c.y);
      else if (c.type === 'Z') ctx.closePath();
    });
  }

  // The connector: an undulating, variable-width stroke running along the
  // baseline. Once the melt fuses it into the letters the row stops reading as
  // separate glyphs and starts reading as one continuous ink ribbon — which is
  // what makes a script wordmark look written rather than set.
  function makeRibbon(bbox, flow, seed) {
    if (flow <= 0) return [];
    var x0 = bbox[0], x1 = bbox[2], y0 = bbox[1], y1 = bbox[3];
    var h = Math.max(1, y1 - y0), w = Math.max(1, x1 - x0);
    var baseY = y1 - h * 0.30;
    var amp = h * 0.11;
    var n = Math.max(10, Math.round(w / 5));
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var wob = (BlobEngine.valueNoise(t * 5.5, seed * 0.37, seed) - 0.5) * 2
              + (BlobEngine.valueNoise(t * 13.1, seed * 0.71, seed + 31) - 0.5);
      var rr = flow * (0.45 + 0.85 * BlobEngine.valueNoise(t * 7.3 + 11, seed * 0.19, seed + 5));
      // taper the very ends so the ribbon enters and leaves like a brush lift
      var ease = Math.min(1, Math.min(t, 1 - t) * 9);
      pts.push([x0 + w * t, baseY + wob * amp, Math.max(0.4, rr * ease)]);
    }
    return pts;
  }

  // Layouts are pure functions of their inputs, so cache them — dragging a row
  // around must not re-tessellate its glyphs.
  var layoutCache = {};
  var uploadVer = 0;      // bumped per uploaded file (two files can share a name)
  function rowLayout(row) {
    var text = (row.text || '').trim();
    if (!text) return null;
    var ink = row.style === 'ink';
    var slant = ink ? row.slant : 0;
    var flow = ink ? row.flow * (row.size / 180) : 0;
    var weight = ink ? row.weight : 1;
    var srcKey = state.fontSource === 'upload' ? 'u:' + uploadVer : 'b:' + glyphKey();
    var key = [srcKey, text, row.size, row.tracking, slant, flow, weight, ink, state.seed].join('|');
    if (layoutCache[key]) return layoutCache[key];

    var geom = null;
    if (state.fontSource === 'upload') {
      if (!state.uploadedFont) return null;
      try { geom = uploadRowGeom(state.uploadedFont, text, row.size, row.tracking * row.size); }
      catch (e) { console.error('upload layout failed', e); return null; }
    } else {
      geom = ink ? builtinInkGeom(text, row.size, row.tracking, weight)
                 : builtinRowGeom(text, row.size, row.tracking);
    }

    var bbox = geomBBox(geom);
    if (slant) {
      shearGeom(geom, Math.tan(slant * Math.PI / 180), bbox[3]);
      bbox = geomBBox(geom);
    }
    // The ribbon rides the letters' own band, so accents don't lift it.
    var band = geom.band;
    var ribbon = makeRibbon(band ? [bbox[0], band[0], bbox[2], band[1]] : bbox, flow, state.seed + 3);
    if (ribbon.length) {
      // the ribbon can bulge past the glyphs, so re-measure with it included
      ribbon.forEach(function (p) {
        if (p[0] - p[2] < bbox[0]) bbox[0] = p[0] - p[2];
        if (p[0] + p[2] > bbox[2]) bbox[2] = p[0] + p[2];
        if (p[1] - p[2] < bbox[1]) bbox[1] = p[1] - p[2];
        if (p[1] + p[2] > bbox[3]) bbox[3] = p[1] + p[2];
      });
    }
    // A row is placed by its box centre. Anchor that on the middle of the cap
    // band and grow the box symmetrically to take the accents (stacked marks
    // reach ~0.3 em above the caps, a dot below ~0.15 em under the baseline):
    // typing an accent then never makes the row jump, and the selection box
    // and hit area always contain every mark.
    var inkBox = bbox.slice();     // the real ink, before that padding
    if (band) {
      var mid = (band[0] + band[1]) / 2;
      var top = Math.min(bbox[1], 2 * mid - bbox[3]);
      var bot = Math.max(bbox[3], 2 * mid - bbox[1]);
      bbox = [bbox[0], top, bbox[2], bot];
    }

    var out = {
      bbox: bbox,
      inkBox: inkBox,
      missing: geom.missing || [],
      empty: !!geom.empty,
      // part: 'base' (letters + ribbon), 'marks' (floating accents) or all
      draw: function (ctx, part) {
        if (part !== 'marks') {
          drawGeom(geom, ctx);
          if (ribbon.length) {
            ctx.beginPath();
            strokeChain(ctx, ribbon);
            ctx.fill();
          }
        }
        if (part !== 'base') drawMarks(geom, ctx);
      },
      hasMarks: hasMarks(geom),
    };
    if (Object.keys(layoutCache).length > 120) layoutCache = {};
    layoutCache[key] = out;
    return out;
  }

  // Pick a point size that makes this row span `frac` of the canvas width, so
  // a freshly added row never lands overflowing the poster.
  function autoFitRowSize(row, frac) {
    var REF = 100;
    var lay = rowLayout({
      text: row.text, size: REF, tracking: row.tracking,
      style: row.style, flow: row.flow, slant: row.slant, weight: row.weight,
    });
    if (!lay) return;
    var w = lay.bbox[2] - lay.bbox[0];
    if (!(w > 0)) return;
    row.size = Math.round(Math.max(20, Math.min(500, REF * (frac * state.canvasW) / w)));
  }

  // Clusters the current typeface could not draw, across every row: toasted
  // once whenever that set changes, rather than on every keystroke or drag.
  var lastMissing = '';
  function showCluster(c) {
    if (/^\p{M}/u.test(c)) return '\u25CC' + c;           // lone mark: show it on a dotted circle
    if (/\p{C}/u.test(c)) return 'U+' + c.codePointAt(0).toString(16).toUpperCase();
    return c;
  }
  function reportMissing() {
    var seen = {}, list = [], emptyRow = null;
    state.bigRows.forEach(function (row) {
      var lay = rowLayout(row);
      if (!lay) return;
      if (lay.empty && !emptyRow) emptyRow = row;
      lay.missing.forEach(function (c) { if (!seen[c]) { seen[c] = 1; list.push(c); } });
    });
    var upload = state.fontSource === 'upload';
    var sig = (upload ? 'u' + uploadVer : 'b' + srcVer) + '|' + (emptyRow ? emptyRow.id : '') + '|' + list.join('\u0000');
    if (sig === lastMissing) return false;
    lastMissing = sig;
    if (emptyRow) {
      toast('"' + emptyRow.text.trim() + '" has no matching glyphs in ' + state.uploadedFontName + ' (even uppercased)', 3800);
      return true;
    }
    if (!list.length) return false;
    var shown = list.slice(0, 14).map(showCluster).join(' ') + (list.length > 14 ? ' \u2026' : '');
    toast('Not in ' + (upload ? state.uploadedFontName || 'the uploaded font' : 'the built-in set') + ': ' + shown, 3600);
    return true;
  }

  // Overflow notes on the row cards. Cheap (layouts are cached), so it runs on
  // every paint, drags included; the toast is separate and fires once per row.
  var rowWarnState = {};    // row id -> overflow kind last computed
  var warnedRows = {};      // row ids already toasted about
  function updateRowWarnings() {
    var kinds = {};
    buildRowLayouts().forEach(function (rl) { kinds[rl.row.id] = rowOverflow(rl); });
    rowWarnState = kinds;
    var cards = $('bigRowList').children;
    for (var i = 0; i < cards.length; i++) {
      var w = cards[i]._warn, k = kinds[cards[i]._id] || '';
      if (!w || w._k === k) continue;
      w._k = k;
      w.textContent = k ? OVERFLOW_TEXT[k] : '';
      w.title = k ? OVERFLOW_TIP[k] : '';
      w.hidden = !k;
    }
  }
  // The first time a row outgrows the poster, say so once. Returns true when
  // it toasted, so callers don't stack it on top of another message.
  function toastOverflowOnce() {
    for (var i = 0; i < state.bigRows.length; i++) {
      var row = state.bigRows[i], k = rowWarnState[row.id];
      if ((k === 'wide' || k === 'tall') && !warnedRows[row.id]) {
        warnedRows[row.id] = 1;
        toast('Row ' + (i + 1) + ' is ' + (k === 'wide' ? 'wider' : 'taller') +
          ' than the poster, so it is cropped', 3600);
        return true;
      }
    }
    return false;
  }

  // Each row placed so its ink bbox centre lands on the row's (xp,yp) point.
  function buildRowLayouts() {
    var W = state.canvasW, H = state.canvasH, out = [];
    state.bigRows.forEach(function (row) {
      var lay = rowLayout(row);
      if (!lay) return;
      var bb = lay.bbox;
      out.push({
        row: row, layout: lay,
        cx: (bb[0] + bb[2]) / 2, cy: (bb[1] + bb[3]) / 2,
        w: bb[2] - bb[0], h: bb[3] - bb[1],
        px: row.xp / 100 * W, py: row.yp / 100 * H,
      });
    });
    return out;
  }
  // Once rows can rotate, the selection box stops being axis-aligned: corners
  // are the source of truth and anything that needs an AABB derives one.
  function rowCorners(rl) {
    var hw = rl.w / 2, hh = rl.h / 2;
    var rad = (rl.row.rot || 0) * Math.PI / 180;
    var cos = Math.cos(rad), sin = Math.sin(rad);
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(function (c) {
      return [rl.px + c[0] * cos - c[1] * sin, rl.py + c[0] * sin + c[1] * cos];
    });
  }
  function cornersAABB(cs) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    cs.forEach(function (p) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    });
    return [x0, y0, x1, y1];
  }
  // How a row's real ink meets the poster's edges, in poster terms (after
  // rotation): 'wide' / 'tall' when no placement could fit it, 'edge' when it
  // would fit but currently runs off an edge, '' when it is wholly on the
  // poster. Nothing is changed automatically; the card and a toast just say so.
  var OVERFLOW_TEXT = {
    wide: '▲ wider than poster', tall: '▲ taller than poster', edge: '▲ off the edge',
  };
  var OVERFLOW_TIP = {
    wide: 'This row is wider than the poster, so its ends are cropped. Reduce its size or tracking, or split it into two rows.',
    tall: 'This row is taller than the poster, so it is cropped. Reduce its size.',
    edge: 'Part of this row runs past the poster edge and is cropped. Move it inward if that is not intended.',
  };
  function rowOverflow(rl) {
    var ib = rl.layout.inkBox;
    if (!ib) return '';
    var rad = (rl.row.rot || 0) * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    var a = cornersAABB([[ib[0], ib[1]], [ib[2], ib[1]], [ib[2], ib[3]], [ib[0], ib[3]]].map(function (c) {
      var lx = c[0] - rl.cx, ly = c[1] - rl.cy;
      return [rl.px + lx * cos - ly * sin, rl.py + lx * sin + ly * cos];
    }));
    var W = state.canvasW, H = state.canvasH, tol = 1;
    if (a[2] - a[0] > W + tol) return 'wide';
    if (a[3] - a[1] > H + tol) return 'tall';
    if (a[0] < -tol || a[2] > W + tol || a[1] < -tol || a[3] > H + tol) return 'edge';
    return '';
  }

  // Test in the row's own frame so rotation is handled by un-rotating the point.
  function pointInRow(p, rl, slack) {
    slack = slack || 0;
    var rad = -(rl.row.rot || 0) * Math.PI / 180;
    var cos = Math.cos(rad), sin = Math.sin(rad);
    var dx = p.x - rl.px, dy = p.y - rl.py;
    var lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
    return Math.abs(lx) <= rl.w / 2 + slack && Math.abs(ly) <= rl.h / 2 + slack;
  }

  // ------------------------------------------------------- distance field
  // The three line treatments are all "the same shape, offset inward by N
  // pixels", so the pipeline needs true distance — not the blurred alpha ramp,
  // whose spacing would drift with the melt radius. This is the standard
  // Felzenszwalb & Huttenlocher exact squared-EDT: two O(n) passes of a 1-D
  // lower-envelope scan, run down the columns then across the rows.
  var EDT_INF = 1e20;
  function edt1d(f, d, v, z, n) {
    var k = 0;
    v[0] = 0; z[0] = -EDT_INF; z[1] = EDT_INF;
    for (var q = 1; q < n; q++) {
      var s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++; v[k] = q; z[k] = s; z[k + 1] = EDT_INF;
    }
    k = 0;
    for (q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      var dq = q - v[k];
      d[q] = dq * dq + f[v[k]];
    }
  }
  function edt2d(grid, w, h) {
    var m = Math.max(w, h);
    var d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
    var col = new Float64Array(h), x, y;
    for (x = 0; x < w; x++) {
      for (y = 0; y < h; y++) col[y] = grid[y * w + x];
      edt1d(col, d, v, z, h);
      for (y = 0; y < h; y++) grid[y * w + x] = d[y];
    }
    var row = new Float64Array(w);
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) row[x] = grid[y * w + x];
      edt1d(row, d, v, z, w);
      for (x = 0; x < w; x++) grid[y * w + x] = d[x];
    }
  }
  // Signed distance in mask pixels: negative inside the shape, positive out.
  // Also reports the deepest point inside, which is what tells the caller how
  // many inward contours the shape can actually hold.
  function signedDistance(alpha, w, h, level) {
    var n = w * h, i;
    var inside = new Float32Array(n), outside = new Float32Array(n);
    for (i = 0; i < n; i++) {
      if (alpha[i * 4 + 3] >= level) { inside[i] = 0; outside[i] = EDT_INF; }
      else { inside[i] = EDT_INF; outside[i] = 0; }
    }
    edt2d(inside, w, h);
    edt2d(outside, w, h);
    var sd = new Float32Array(n), deepest = 0;
    for (i = 0; i < n; i++) {
      var v = Math.sqrt(inside[i]) - Math.sqrt(outside[i]);
      sd[i] = v;
      if (v < deepest) deepest = v;
    }
    return { sd: sd, maxInside: -deepest };
  }

  // Wrap the distance field as something traceField can contour: shift it by
  // `offset` to move the line inward, and displace it with noise to rough it up.
  function makeOffsetField(sd, w, h, maskDpr, ox, oy, offset, noise, grain, seed) {
    return function (x, y) {
      var px = Math.round((x - ox) * maskDpr), py = Math.round((y - oy) * maskDpr);
      // anything off the mask is far outside, so every contour closes
      var d = (px < 0 || px >= w || py < 0 || py >= h) ? 1e4 : sd[py * w + px] / maskDpr;
      var v = d + offset;
      if (noise > 0) {
        var nz = BlobEngine.valueNoise(x * grain, y * grain, seed) - 0.5;
        nz += (BlobEngine.valueNoise(x * grain * 2.3, y * grain * 2.3, seed + 91) - 0.5) * 0.5;
        v += nz * noise;
      }
      return v;
    };
  }

  // ------------------------------------------------------------- effects
  // Each effect is just a list of contour levels to trace. Offsets are in
  // poster pixels measured inward from the shape's edge.
  var EFFECT_HINTS = {
    solid: 'One clean contour around the mass.',
    rough: 'A second line just inside the first, shivered with high-frequency noise — reads as a rough double-stroke band.',
    contour: 'Nested lines stepping inward at even spacing, like a topographic map.',
  };
  function effectLevels(row) {
    var wob = state.wobble;
    if (row.effect === 'contour') {
      var out = [];
      for (var i = 0; i < row.lines; i++) {
        out.push({ offset: i * row.spacing, noise: wob, grain: state.grain });
      }
      return out;
    }
    if (row.effect === 'rough') {
      return [
        { offset: 0, noise: wob, grain: state.grain },
        { offset: row.gap, noise: wob + row.jitter, grain: state.grain * 4 },
      ];
    }
    return [{ offset: 0, noise: wob, grain: state.grain }];
  }
  // How far inward the deepest line of this effect reaches — the mask has to
  // be padded enough to still contain it.
  function effectDepth(row) {
    if (row.effect === 'contour') return row.lines * row.spacing;
    if (row.effect === 'rough') return row.gap;
    return 0;
  }

  // ------------------------------------------------------------ raster field
  function rowBounds(rl) {
    var b = cornersAABB(rowCorners(rl));
    var pad = state.melt * 0.8 + state.strokeWidth + effectDepth(rl.row) + state.wobble * 2 + 12;
    return [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
  }

  // Mask pixel space -> the row's own layout space.
  function rowMaskTransform(ctx, rl, bounds, maskDpr) {
    ctx.setTransform(maskDpr, 0, 0, maskDpr, 0, 0);
    ctx.translate(-bounds[0], -bounds[1]);
    ctx.translate(rl.px, rl.py);
    if (rl.row.rot) ctx.rotate(rl.row.rot * Math.PI / 180);
    ctx.translate(-rl.cx, -rl.cy);
    ctx.fillStyle = '#000';
  }
  function rasterizeRow(rl, bounds, maskDpr, part) {
    var pw = Math.max(1, Math.round((bounds[2] - bounds[0]) * maskDpr));
    var ph = Math.max(1, Math.round((bounds[3] - bounds[1]) * maskDpr));
    var mask = document.createElement('canvas'); mask.width = pw; mask.height = ph;
    var mctx = mask.getContext('2d');
    rowMaskTransform(mctx, rl, bounds, maskDpr);
    rl.layout.draw(mctx, part);
    return { canvas: mask, w: pw, h: ph };
  }

  var cachedContour = null;

  // Rows are traced independently now, so each one can carry its own effect
  // and its own fill mode. (They no longer melt into each other — a shared
  // trace could not be split back apart per row.)
  function computeContour(exportMode) {
    var out = { rows: [] };
    buildRowLayouts().forEach(function (rl) {
      var bounds = rowBounds(rl);
      var maskDpr = exportMode ? 3 : 1.8;
      var bw = bounds[2] - bounds[0], bh = bounds[3] - bounds[1];
      var MAXPIX = exportMode ? 2600 : 1500;
      if (bw * maskDpr > MAXPIX || bh * maskDpr > MAXPIX) {
        maskDpr = MAXPIX / Math.max(bw, bh);
      }

      var melt = rowMelt(rl.row), blur = melt > 0;
      var mask = rasterizeRow(rl, bounds, maskDpr, blur ? 'base' : undefined);
      var src = mask.canvas;
      if (blur) {
        var bc = document.createElement('canvas'); bc.width = mask.w; bc.height = mask.h;
        var bctx = bc.getContext('2d');
        bctx.filter = 'blur(' + (melt * maskDpr) + 'px)';
        bctx.drawImage(mask.canvas, 0, 0);
        bctx.filter = 'none';
        // accents skip the blur (see drawMarks)
        if (rl.layout.hasMarks) {
          rowMaskTransform(bctx, rl, bounds, maskDpr);
          rl.layout.draw(bctx, 'marks');
        }
        src = bc;
      }
      var img = src.getContext('2d').getImageData(0, 0, mask.w, mask.h).data;

      // tension biases the threshold, fattening or starving the mass
      var level = Math.max(10, Math.min(245, 128 - state.tension * 3));
      var dist;
      try { dist = signedDistance(img, mask.w, mask.h, level); }
      catch (err) { console.error('distance field failed', err); return; }
      var maxInside = dist.maxInside / maskDpr;   // poster px

      var seedBase = state.seed * 13 + 7 + rl.row.id * 101;
      var levels = [];
      effectLevels(rl.row).forEach(function (lv, i) {
        // A line deeper than the thickest part of the mass has nothing to trace;
        // attempting it anyway shatters the field into thousands of noise
        // fragments and the O(n^2) chain repair then stalls the page.
        if (lv.offset > 0 && lv.offset >= maxInside - 0.5) return;
        // ease the noise off with depth for the same reason
        var noise = lv.noise * (1 - 0.6 * Math.min(1, lv.offset / Math.max(1, maxInside)));
        var field = makeOffsetField(dist.sd, mask.w, mask.h, maskDpr, bounds[0], bounds[1],
          lv.offset, noise, lv.grain, seedBase + i * 37);
        try {
          levels.push(BlobEngine.traceField(field, bounds, {
            res: exportMode ? 1.1 : 1.7, smooth: state.smooth, simplify: 0.35,
          }));
        } catch (err) { console.error('contour trace failed', err); levels.push([]); }
      });
      out.rows.push({ row: rl.row, levels: levels });
    });
    return out;
  }

  // ------------------------------------------------------------ small text
  var measureCtx = document.createElement('canvas').getContext('2d');
  function blockFontStr(b) { return fontWeight(b.font) + ' ' + b.size + 'px ' + b.font + ', monospace'; }
  function blockLayout(b) {
    var W = state.canvasW, H = state.canvasH;
    var lines = b.text.split('\n');
    var lh = b.size * (b.lh / 100);
    var x = b.xp / 100 * W, y = b.yp / 100 * H;
    measureCtx.font = blockFontStr(b);
    var maxW = 0;
    lines.forEach(function (l) { maxW = Math.max(maxW, measureCtx.measureText(l).width); });
    var blockH = lh * (lines.length - 1);
    var x0 = b.align === 'left' ? x : b.align === 'right' ? x - maxW : x - maxW / 2;
    return {
      lines: lines, lh: lh, x: x, y: y, align: b.align, width: maxW,
      bbox: [x0, y - b.size * 0.82, x0 + maxW, y + blockH + b.size * 0.26],
    };
  }
  function drawSmallBlocks(ctx) {
    ctx.textBaseline = 'alphabetic';
    state.smallBlocks.forEach(function (b) {
      var t = blockLayout(b);
      ctx.font = blockFontStr(b);
      ctx.fillStyle = b.color || state.ink;
      ctx.textAlign = b.align === 'left' ? 'left' : b.align === 'right' ? 'right' : 'center';
      t.lines.forEach(function (line, i) { ctx.fillText(line, t.x, t.y + t.lh * i); });
    });
  }

  // ------------------------------------------------------------------ paint
  // Backing-store scale: sharp at the current zoom without letting a zoomed-in
  // 1080x1920 poster allocate a gigapixel canvas.
  function renderScale() {
    var base = Math.min(window.devicePixelRatio || 1, 2);
    return Math.max(0.5, Math.min(3, state.zoom * base));
  }

  function sizeCanvases() {
    var W = state.canvasW, H = state.canvasH, s = renderScale(), z = state.zoom;
    ['posterCanvas', 'overlayCanvas'].forEach(function (id) {
      var c = $(id);
      c.width = Math.max(1, Math.round(W * s));
      c.height = Math.max(1, Math.round(H * s));
      c.style.width = (W * z) + 'px';
      c.style.height = (H * z) + 'px';
    });
    var holder = $('canvasHolder');
    holder.style.width = (W * z) + 'px';
    holder.style.height = (H * z) + 'px';
  }

  function ringCentroid(r) {
    var x = 0, y = 0;
    for (var i = 0; i < r.length; i++) { x += r[i][0]; y += r[i][1]; }
    return { x: x / r.length, y: y / r.length };
  }

  // Ink style floods the small enclosed pockets — the slivers where the stroke
  // doubles back on itself — solid, and outlines everything else. That contrast
  // between hollow stroke and a few inked wedges is what sells the brush look.
  // Only the outermost contour is eligible; inner effect lines stay hairlines.
  function splitPockets(row, rings) {
    if (row.mode === 'filled' || row.style !== 'ink' || !(row.pocket > 0) || !rings.length) {
      return { line: rings, solid: [] };
    }
    var areas = rings.map(function (r) { return Math.abs(BlobEngine.signedArea(r)); });
    var maxA = 0;
    areas.forEach(function (a) { if (a > maxA) maxA = a; });
    var line = [], solid = [];
    rings.forEach(function (r, i) { (areas[i] < maxA * row.pocket ? solid : line).push(r); });
    return { line: line, solid: solid };
  }

  function traceRings(ctx, rings) {
    ctx.beginPath();
    rings.forEach(function (r) {
      ctx.moveTo(r[0][0], r[0][1]);
      for (var i = 1; i < r.length; i++) ctx.lineTo(r[i][0], r[i][1]);
      ctx.closePath();
    });
  }

  // Filled uses even-odd across every line the effect produced, so Solid reads
  // as a solid mass while Contour reads as concentric bands.
  function drawRowRings(ctx, entry) {
    var row = entry.row, levels = entry.levels;
    if (!levels.length) return;
    if (row.mode === 'filled') {
      ctx.beginPath();
      levels.forEach(function (rings) {
        rings.forEach(function (r) {
          ctx.moveTo(r[0][0], r[0][1]);
          for (var i = 1; i < r.length; i++) ctx.lineTo(r[i][0], r[i][1]);
          ctx.closePath();
        });
      });
      ctx.fillStyle = state.ink;
      ctx.fill('evenodd');
      return;
    }
    levels.forEach(function (rings, idx) {
      if (!rings.length) return;
      var split = idx === 0 ? splitPockets(row, rings) : { line: rings, solid: [] };
      if (split.line.length) {
        traceRings(ctx, split.line);
        ctx.strokeStyle = state.ink; ctx.lineWidth = state.strokeWidth;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
      }
      if (split.solid.length) {
        traceRings(ctx, split.solid);
        ctx.fillStyle = state.ink; ctx.fill();
      }
    });
  }

  function drawContour(ctx, result) {
    if (!result || !result.rows) return;
    result.rows.forEach(function (entry) { drawRowRings(ctx, entry); });
  }

  function paint(result) {
    var W = state.canvasW, H = state.canvasH, s = renderScale();
    sizeCanvases();
    var ctx = $('posterCanvas').getContext('2d');
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!state.bgTransparent) { ctx.fillStyle = state.bg; ctx.fillRect(0, 0, W, H); }

    drawContour(ctx, result);
    drawSmallBlocks(ctx);
    paintOverlay();
    updateRowWarnings();
    updateEmptyState();
    $('stageMeta').textContent = W + ' × ' + H + ' px — ' +
      (state.fontSource === 'upload'
        ? (state.uploadedFontName || (restoredFontName ? 'upload ' + restoredFontName + ' again' : 'no font uploaded'))
        : linked() ? 'Font-tool glyphs' + (project.fontName ? ' (' + project.fontName + ')' : '') : 'Liquid (built-in)');
  }

  // Empty / edge states, drawn as HTML over the stage (never into the bitmap,
  // so never into an export): no title rows, every row blank, or Upload
  // picked with no font file loaded yet.
  function updateEmptyState() {
    var box = $('stageEmpty');
    if (!box) return;
    var kind = '', msg = '', btn = '';
    if (state.fontSource === 'upload' && !state.uploadedFont) {
      kind = 'upload';
      msg = restoredFontName
        ? 'Drop ' + restoredFontName + ' here again, or click Upload, to finish restoring this poster (font files aren\u2019t saved)'
        : 'Drop a .ttf / .otf / .woff here, or click Upload';
      btn = 'Upload\u2026';
    } else if (!state.bigRows.length) {
      kind = 'add'; msg = 'Add a title row to start'; btn = '+ Title row';
    } else if (!state.bigRows.some(function (r) { return (r.text || '').trim(); })) {
      kind = 'edit'; msg = 'Every title row is empty: type a title to start'; btn = 'Type in row 1';
    }
    box.hidden = !kind;
    if (box._kind === kind + msg) return;
    box._kind = kind + msg;
    box.dataset.kind = kind;
    $('stageEmptyMsg').textContent = msg;
    $('stageEmptyBtn').textContent = btn;
  }

  // Rough, instant stand-in used while dragging: the raw silhouettes with no
  // blur/threshold/trace, so the composition stays interactive.
  function paintFast() {
    var W = state.canvasW, H = state.canvasH, s = renderScale();
    sizeCanvases();
    var ctx = $('posterCanvas').getContext('2d');
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!state.bgTransparent) { ctx.fillStyle = state.bg; ctx.fillRect(0, 0, W, H); }

    ctx.fillStyle = state.ink;
    ctx.globalAlpha = 0.45;
    buildRowLayouts().forEach(function (rl) {
      ctx.save();
      ctx.translate(rl.px, rl.py);
      if (rl.row.rot) ctx.rotate(rl.row.rot * Math.PI / 180);
      ctx.translate(-rl.cx, -rl.cy);
      rl.layout.draw(ctx);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
    drawSmallBlocks(ctx);
    paintOverlay();
    updateRowWarnings();
    updateEmptyState();
  }

  // Geometry of the selection widget, in poster units. Shared by the painter
  // and the hit-tester so what you see is exactly what you can grab.
  var HANDLE_R = 5, ROTATE_ARM = 26;
  function rowGizmo(rl) {
    var pad = 7 / state.zoom;
    var hw = rl.w / 2 + pad, hh = rl.h / 2 + pad;
    var rad = (rl.row.rot || 0) * Math.PI / 180;
    var cos = Math.cos(rad), sin = Math.sin(rad);
    var toWorld = function (lx, ly) {
      return [rl.px + lx * cos - ly * sin, rl.py + lx * sin + ly * cos];
    };
    return {
      corners: [toWorld(-hw, -hh), toWorld(hw, -hh), toWorld(hw, hh), toWorld(-hw, hh)],
      rotate: toWorld(0, -hh - ROTATE_ARM / state.zoom),
      rotateAnchor: toWorld(0, -hh),
      center: [rl.px, rl.py],
    };
  }

  function paintOverlay() {
    var W = state.canvasW, H = state.canvasH, s = renderScale(), z = state.zoom;
    var ctx = $('overlayCanvas').getContext('2d');
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!state.selected) return;
    var lw = 1.5 / z;
    // Black and white, so it reads on any poster colour: white over a black
    // line (dashed for the box), white handles with a black edge.
    function bw(path, dashed) {
      ctx.setLineDash([]); ctx.strokeStyle = '#000'; ctx.lineWidth = lw * 2.2;
      path(); ctx.stroke();
      ctx.setLineDash(dashed ? [6 / z, 4 / z] : []); ctx.strokeStyle = '#fff'; ctx.lineWidth = lw;
      path(); ctx.stroke();
      ctx.setLineDash([]);
    }

    if (state.selected.type === 'row') {
      var rl = buildRowLayouts().filter(function (r) { return r.row.id === state.selected.id; })[0];
      if (!rl) return;
      var g = rowGizmo(rl);
      bw(function () {
        ctx.beginPath();
        ctx.moveTo(g.corners[0][0], g.corners[0][1]);
        for (var i = 1; i < 4; i++) ctx.lineTo(g.corners[i][0], g.corners[i][1]);
        ctx.closePath();
      }, true);
      // rotation arm
      bw(function () {
        ctx.beginPath();
        ctx.moveTo(g.rotateAnchor[0], g.rotateAnchor[1]);
        ctx.lineTo(g.rotate[0], g.rotate[1]);
      }, false);
      var hs = HANDLE_R / z;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = lw;
      g.corners.forEach(function (p) {
        ctx.fillRect(p[0] - hs, p[1] - hs, hs * 2, hs * 2);
        ctx.strokeRect(p[0] - hs, p[1] - hs, hs * 2, hs * 2);
      });
      ctx.beginPath();
      ctx.arc(g.rotate[0], g.rotate[1], hs, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      return;
    }

    var b = findBlock(state.selected.id);
    if (!b) return;
    var bbox = blockLayout(b).bbox, pad = 6 / z;
    bw(function () {
      ctx.beginPath();
      ctx.rect(bbox[0] - pad, bbox[1] - pad, bbox[2] - bbox[0] + pad * 2, bbox[3] - bbox[1] + pad * 2);
    }, true);
  }

  // -------------------------------------------------------------- scheduler
  var heavyTimer = null, dragging = false;
  function scheduleRender(heavy) {
    schedulePersist();
    if (!heavy) { paint(cachedContour); return; }
    paintFast();
    clearTimeout(heavyTimer);
    heavyTimer = setTimeout(function () {
      if (dragging) return;
      $('stageLoading').classList.add('show');
      setTimeout(function () {
        try { cachedContour = computeContour(false); }
        catch (e) { console.error(e); cachedContour = null; }
        paint(cachedContour);
        $('stageLoading').classList.remove('show');
        if (!reportMissing()) toastOverflowOnce();
      }, 0);
    }, 130);
  }

  // ---------------------------------------------------------------- sidebar
  // `name` is the accessible name (the visible label is often a terse
  // abbreviation like "Track"), e.g. "Row 1 tracking".
  function sliderRow(label, min, max, step, value, fmt, onInput, name) {
    var wrap = mk('div', 'mini-slider');
    wrap.appendChild(mk('span', null, label)).setAttribute('aria-hidden', 'true');
    var inp = document.createElement('input');
    inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = value;
    inp.setAttribute('aria-label', name || label);
    inp.setAttribute('aria-valuetext', String(fmt(value)));
    var val = mk('b', null, fmt(value));
    val.setAttribute('aria-hidden', 'true');
    inp.addEventListener('input', function () {
      var v = parseFloat(inp.value);
      val.textContent = fmt(v);
      inp.setAttribute('aria-valuetext', String(fmt(v)));
      onInput(v);
    });
    wrap.appendChild(inp); wrap.appendChild(val);
    wrap._input = inp; wrap._val = val; wrap._fmt = fmt;
    return wrap;
  }

  // options: [value, label, tooltip?, accessible name?]. Real toggle buttons,
  // so they are tabbable and announce which one is on.
  function segRow(options, current, onPick, groupName, fkPrefix) {
    var row = mk('div', 'seg-row');
    row.setAttribute('role', 'group');
    if (groupName) row.setAttribute('aria-label', groupName);
    options.forEach(function (o) {
      var on = current === o[0];
      var btn = mk('button', 'pill-btn' + (on ? ' active' : ''), o[1]);
      btn.type = 'button';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (o[2]) btn.title = o[2];
      if (o[3]) btn.setAttribute('aria-label', o[3]);
      if (fkPrefix) btn.dataset.fk = fkPrefix + o[0];
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        checkpoint(groupName);
        row.querySelectorAll('.pill-btn').forEach(function (x) {
          x.classList.remove('active'); x.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true');
        onPick(o[0]);
      });
      row.appendChild(btn);
    });
    return row;
  }

  function cardHead(label, meta) {
    var head = mk('div', 'item-card-head');
    head.appendChild(mk('span', null, label));
    var m = mk('span', 'meta', meta || '');
    head.appendChild(m);
    head.appendChild(mk('div', 'spacer'));
    head._meta = m;
    return head;
  }

  function rowMetaText(row) {
    var bits = [Math.round(row.size) + 'px'];
    if (Math.round(row.rot)) bits.push(Math.round(row.rot) + '\u00b0');
    if (row.style === 'ink') bits.push('ink');
    if (row.effect !== 'solid') bits.push(row.effect);
    if (row.mode === 'filled') bits.push('filled');
    return bits.join(' \u00b7 ');
  }

  // Called during a canvas drag: refresh the header readout and the Turn
  // slider in place, rather than rebuilding the card (which would blow away
  // focus and the open state).
  function updateCardMeta() {
    if (!state.selected || state.selected.type !== 'row') return;
    var row = findRow(state.selected.id);
    if (!row) return;
    var cards = $('bigRowList').children;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (c._id !== row.id) continue;
      if (c._meta) c._meta.textContent = rowMetaText(row);
      if (c._turn) {
        c._turn._input.value = row.rot;
        c._turn._val.textContent = c._turn._fmt(row.rot);
      }
      return;
    }
  }

  // Cards are rebuilt wholesale on structural changes (style, effect, order,
  // palette), which would drop keyboard focus on the floor. Every focusable
  // control carries a stable data-fk key, and keepFocus puts focus back on the
  // rebuilt control with the same key.
  function keepFocus(fn) {
    var a = document.activeElement;
    var key = a && a.dataset ? a.dataset.fk : null;
    fn();
    if (!key) return;
    var el = document.querySelector('[data-fk="' + key + '"]');
    if (el && el !== document.activeElement && !el.disabled) el.focus({ preventScroll: true });
  }
  function fk(el, key) { el.dataset.fk = key; return el; }

  function onHeadButton(e) { return !!(e.target && e.target.closest && e.target.closest('.icon-btn')); }

  function renderBigRowCards() {
    var list = $('bigRowList');
    list.innerHTML = '';
    state.bigRows.forEach(function (row, idx) {
      var selected = state.selected && state.selected.type === 'row' && state.selected.id === row.id;
      var card = mk('div', 'item-card' + (selected ? ' selected' : ''));
      var name = 'Row ' + (idx + 1), pre = 'row-' + row.id + '-';
      card._id = row.id;
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', 'Title ' + name.toLowerCase());
      // tabbing into a collapsed card opens it, like clicking it does. Not for
      // its header buttons: opening this card collapses the one above, which
      // moves the button out from under the pointer mid-click and the click
      // (delete, move up) was silently lost.
      card.addEventListener('mousedown', function (e) { if (!onHeadButton(e)) select('row', row.id); });
      card.addEventListener('focusin', function (e) { if (!onHeadButton(e)) select('row', row.id); });

      var head = cardHead(name, rowMetaText(row));
      card._meta = head._meta;
      // overflow note (see updateRowWarnings); filled in after the cards exist
      var warn = mk('span', 'row-warn');
      warn.id = pre + 'warn'; warn.hidden = true;
      head.insertBefore(warn, head._meta.nextSibling);
      card._warn = warn;
      var up = fk(mk('button', 'icon-btn', '\u2191'), pre + 'up');
      up.type = 'button'; up.title = 'Move up';
      up.setAttribute('aria-label', 'Move ' + name.toLowerCase() + ' up');
      up.disabled = idx === 0;
      up.addEventListener('click', function (e) {
        e.stopPropagation();
        checkpoint('Move ' + name.toLowerCase() + ' up');
        moveItem(state.bigRows, idx, -1);
        keepFocus(renderBigRowCards); scheduleRender(true);
      });
      var del = fk(mk('button', 'icon-btn danger', '\u00d7'), pre + 'del');
      del.type = 'button'; del.title = 'Delete row';
      del.setAttribute('aria-label', 'Delete ' + name.toLowerCase());
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        checkpoint('Delete ' + name.toLowerCase());
        state.bigRows.splice(idx, 1);
        if (state.selected && state.selected.id === row.id) state.selected = null;
        renderBigRowCards(); scheduleRender(true);
        $('btnAddBigRow').focus({ preventScroll: true });
      });
      head.appendChild(up); head.appendChild(del);
      card.appendChild(head);

      var txt = fk(document.createElement('input'), pre + 'text');
      txt.className = 'ptext compact'; txt.value = row.text; txt.spellcheck = false;
      txt.setAttribute('aria-label', name + ' text');
      txt.setAttribute('aria-describedby', warn.id);
      txt.addEventListener('input', function () { row.text = txt.value; scheduleRender(true); });
      card.appendChild(txt);

      var body = mk('div', 'item-card-body');
      var s;
      s = sliderRow('Track', -0.06, 0.5, 0.005, row.tracking,
        function (v) { return v.toFixed(3); },
        function (v) { row.tracking = v; scheduleRender(true); }, name + ' tracking');
      fk(s._input, pre + 'track'); body.appendChild(s);
      var turn = sliderRow('Turn', -180, 180, 1, row.rot,
        function (v) { return Math.round(v) + '\u00b0'; },
        function (v) { row.rot = v; updateCardMeta(); scheduleRender(true); }, name + ' rotation');
      fk(turn._input, pre + 'turn');
      card._turn = turn;
      body.appendChild(turn);

      body.appendChild(segRow([
        ['melt', 'Melt', TITLE_STYLE_HINTS.melt],
        ['ink', 'Ink stroke', TITLE_STYLE_HINTS.ink],
      ], row.style, function (v) {
        row.style = v;
        keepFocus(renderBigRowCards);
        scheduleRender(true);
      }, name + ' title style', pre + 'style-'));

      if (row.style === 'ink') {
        body.appendChild(mk('p', 'phint', TITLE_STYLE_HINTS.ink));
        s = sliderRow('Flow', 0, 46, 1, row.flow,
          function (v) { return Math.round(v) + 'px'; },
          function (v) { row.flow = v; scheduleRender(true); }, name + ' ribbon flow');
        fk(s._input, pre + 'flow'); body.appendChild(s);
        s = sliderRow('Slant', -25, 25, 0.5, row.slant,
          function (v) { return v.toFixed(1) + '\u00b0'; },
          function (v) { row.slant = v; scheduleRender(true); }, name + ' slant');
        fk(s._input, pre + 'slant'); body.appendChild(s);
        s = sliderRow('Pen', 0.15, 1.4, 0.01, row.weight,
          function (v) { return v.toFixed(2) + '\u00d7'; },
          function (v) { row.weight = v; scheduleRender(true); }, name + ' pen thickness');
        fk(s._input, pre + 'pen'); body.appendChild(s);
        s = sliderRow('Pocket', 0, 0.14, 0.002, row.pocket,
          function (v) { return (v * 100).toFixed(1) + '%'; },
          function (v) { row.pocket = v; scheduleRender(false); }, name + ' pocket fill');
        fk(s._input, pre + 'pocket'); body.appendChild(s);
      }

      body.appendChild(mk('div', 'field-label', 'Line effect'));
      body.appendChild(segRow([
        ['solid', 'Solid', EFFECT_HINTS.solid],
        ['rough', 'Rough', EFFECT_HINTS.rough],
        ['contour', 'Contour', EFFECT_HINTS.contour],
      ], row.effect, function (v) {
        row.effect = v; keepFocus(renderBigRowCards); scheduleRender(true);
      }, name + ' line effect', pre + 'effect-'));
      body.appendChild(mk('p', 'phint', EFFECT_HINTS[row.effect]));

      if (row.effect === 'rough') {
        s = sliderRow('Gap', 1, 20, 0.5, row.gap,
          function (v) { return v.toFixed(1) + 'px'; },
          function (v) { row.gap = v; scheduleRender(true); }, name + ' rough gap');
        fk(s._input, pre + 'gap'); body.appendChild(s);
        s = sliderRow('Shake', 0, 10, 0.1, row.jitter,
          function (v) { return v.toFixed(1); },
          function (v) { row.jitter = v; scheduleRender(true); }, name + ' rough shake');
        fk(s._input, pre + 'shake'); body.appendChild(s);
      } else if (row.effect === 'contour') {
        s = sliderRow('Lines', 2, 14, 1, row.lines,
          function (v) { return Math.round(v); },
          function (v) { row.lines = Math.round(v); scheduleRender(true); }, name + ' contour lines');
        fk(s._input, pre + 'lines'); body.appendChild(s);
        s = sliderRow('Step', 3, 40, 0.5, row.spacing,
          function (v) { return v.toFixed(1) + 'px'; },
          function (v) { row.spacing = v; scheduleRender(true); }, name + ' contour step');
        fk(s._input, pre + 'step'); body.appendChild(s);
      }

      body.appendChild(segRow([
        ['outline', 'Outline'], ['filled', 'Filled'],
      ], row.mode, function (v) {
        row.mode = v; updateCardMeta(); scheduleRender(false);
      }, name + ' fill mode', pre + 'mode-'));

      card.appendChild(body);
      list.appendChild(card);
    });
    updateRowWarnings();
  }

  function renderSmallBlockCards() {
    var list = $('smallBlockList');
    list.innerHTML = '';
    state.smallBlocks.forEach(function (b, idx) {
      var selected = state.selected && state.selected.type === 'block' && state.selected.id === b.id;
      var card = mk('div', 'item-card' + (selected ? ' selected' : ''));
      var name = 'Text ' + (idx + 1), pre = 'block-' + b.id + '-';
      card._id = b.id;
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', 'Small text block ' + (idx + 1));
      card.addEventListener('mousedown', function (e) { if (!onHeadButton(e)) select('block', b.id); });
      card.addEventListener('focusin', function (e) { if (!onHeadButton(e)) select('block', b.id); });

      var firstLine = (b.text.split('\n')[0] || '').slice(0, 18);
      var head = cardHead(name, firstLine);
      var del = fk(mk('button', 'icon-btn danger', '\u00d7'), pre + 'del');
      del.type = 'button'; del.title = 'Delete text block';
      del.setAttribute('aria-label', 'Delete small text block ' + (idx + 1));
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        checkpoint('Delete small text ' + (idx + 1));
        state.smallBlocks.splice(idx, 1);
        if (state.selected && state.selected.id === b.id) state.selected = null;
        renderSmallBlockCards(); scheduleRender(false);
        $('btnAddSmallBlock').focus({ preventScroll: true });
      });
      head.appendChild(del);
      card.appendChild(head);

      var ta = fk(document.createElement('textarea'), pre + 'text');
      ta.className = 'ptextarea'; ta.value = b.text; ta.spellcheck = false;
      ta.setAttribute('aria-label', 'Small text block ' + (idx + 1));
      ta.addEventListener('input', function () {
        b.text = ta.value;
        head._meta.textContent = (b.text.split('\n')[0] || '').slice(0, 18);
        scheduleRender(false);
      });
      card.appendChild(ta);

      var body = mk('div', 'item-card-body');

      var sel = fk(document.createElement('select'), pre + 'font');
      sel.className = 'pselect compact';
      sel.setAttribute('aria-label', 'Font for small text block ' + (idx + 1));
      MONO_FONTS.forEach(function (f) {
        var o = document.createElement('option');
        o.value = f[0]; o.textContent = f[1];
        if (f[0] === b.font) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () {
        b.font = sel.value;
        loadFontThen(b, function () { scheduleRender(false); });
      });
      body.appendChild(sel);

      body.appendChild(segRow([
        ['left', 'L', null, 'Align left'], ['center', 'C', null, 'Align centre'], ['right', 'R', null, 'Align right'],
      ], b.align, function (v) {
        b.align = v; scheduleRender(false);
      }, name + ' alignment', pre + 'align-'));

      var s = sliderRow('Size', 6, 72, 1, b.size,
        function (v) { return Math.round(v) + 'px'; },
        function (v) { b.size = v; scheduleRender(false); }, name + ' size');
      fk(s._input, pre + 'size'); body.appendChild(s);
      s = sliderRow('Lead', 90, 220, 1, b.lh,
        function (v) { return Math.round(v) + '%'; },
        function (v) { b.lh = v; scheduleRender(false); }, name + ' line spacing');
      fk(s._input, pre + 'lead'); body.appendChild(s);

      // Small text carries its own colour so it can sit apart from the title ink.
      var colorRow = mk('div', 'prow prow-baseline');
      var pick = mk('label', 'swatch-pick');
      var ci = fk(document.createElement('input'), pre + 'color');
      ci.type = 'color'; ci.value = b.color || state.ink;
      ci.setAttribute('aria-label', name + ' colour');
      ci.addEventListener('input', function () { b.color = ci.value; scheduleRender(false); });
      pick.appendChild(ci); pick.appendChild(mk('span', null, 'Colour')).setAttribute('aria-hidden', 'true');
      colorRow.appendChild(pick);
      colorRow.appendChild(mk('div', 'spacer'));
      var matchBtn = fk(mk('button', 'mini-btn', 'Match ink'), pre + 'match');
      matchBtn.type = 'button';
      matchBtn.title = 'Reset to the title ink colour';
      matchBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        checkpoint(name + ' colour');
        b.color = state.ink; ci.value = state.ink; scheduleRender(false);
      });
      colorRow.appendChild(matchBtn);
      body.appendChild(colorRow);

      card.appendChild(body);
      list.appendChild(card);
    });
  }

  function moveItem(arr, idx, dir) {
    var j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    var tmp = arr[idx]; arr[idx] = arr[j]; arr[j] = tmp;
  }

  // Selection only opens/closes cards, so it toggles classes in place rather
  // than rebuilding them: focus, the caret and a click in progress all survive.
  function syncSelection() {
    [['bigRowList', 'row'], ['smallBlockList', 'block']].forEach(function (cfg) {
      Array.prototype.forEach.call($(cfg[0]).children, function (card) {
        card.classList.toggle('selected', !!state.selected &&
          state.selected.type === cfg[1] && state.selected.id === card._id);
      });
    });
  }
  function select(type, id) {
    if (state.selected && state.selected.type === type && state.selected.id === id) return false;
    state.selected = { type: type, id: id };
    syncSelection();
    paintOverlay();
    // expanding one card collapses another, which can move the focused field
    // out of view after the browser has already scrolled to it
    requestAnimationFrame(function () {
      var a = document.activeElement;
      var side = document.querySelector('.poster-sidebar');
      if (a && a.scrollIntoView && side && side.contains(a)) a.scrollIntoView({ block: 'nearest' });
    });
    return true;
  }

  // ---------------------------------------------------------------- palette
  function renderPalette() {
    var pairs = $('pairPalette'); pairs.innerHTML = '';
    PAIRS.forEach(function (p) {
      var on = p.ink === state.ink && p.bg === state.bg;
      var btn = fk(mk('button', 'pair-btn' + (on ? ' active' : '')), 'pair-' + p.name);
      btn.type = 'button';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', p.name + ' colour pair');
      var chip = mk('div', 'pair-chip'); chip.style.background = p.bg;
      var s = mk('span', null, 'Aa'); s.style.color = p.ink;
      chip.appendChild(s);
      btn.appendChild(chip);
      btn.appendChild(mk('div', 'pair-name', p.name));
      btn.addEventListener('click', function () {
        checkpoint(p.name + ' colour pair');
        // small text that followed the old ink follows the new one, so a dark
        // pair (Ember, Noir, Graphite, Smoke) never leaves the caption invisible
        var oldInk = String(state.ink).toLowerCase();
        state.smallBlocks.forEach(function (b) {
          if (String(b.color).toLowerCase() === oldInk || String(b.color).toLowerCase() === '#141414') b.color = p.ink;
        });
        state.ink = p.ink; state.bg = p.bg; state.bgTransparent = false;
        renderSmallBlockCards();
        $('inkColor').value = p.ink; $('bgColor').value = p.bg;
        $('bgTransparent').checked = false;
        keepFocus(renderPalette); scheduleRender(false);
      });
      pairs.appendChild(btn);
    });

    [['inkPalette', 'ink'], ['bgPalette', 'bg']].forEach(function (cfg) {
      var host = $(cfg[0]), key = cfg[1];
      host.innerHTML = '';
      RAMPS.forEach(function (ramp) {
        ramp.forEach(function (c) {
          var on = state[key].toLowerCase() === c;
          var sw = fk(mk('button', 'sw' + (on ? ' active' : '')), key + '-' + c.slice(1));
          sw.type = 'button';
          sw.style.background = c; sw.title = c;
          sw.setAttribute('aria-label', (key === 'ink' ? 'Title ink ' : 'Background ') + c);
          sw.setAttribute('aria-pressed', on ? 'true' : 'false');
          sw.addEventListener('click', function () {
            checkpoint(key === 'ink' ? 'Title ink' : 'Background');
            state[key] = c;
            $(key === 'ink' ? 'inkColor' : 'bgColor').value = c;
            if (key === 'bg') { state.bgTransparent = false; $('bgTransparent').checked = false; }
            keepFocus(renderPalette); scheduleRender(false);
          });
          host.appendChild(sw);
        });
      });
    });
    $('valInk').textContent = state.ink.toUpperCase();
    $('valBg').textContent = state.bgTransparent ? 'NONE' : state.bg.toUpperCase();
  }

  // ------------------------------------------------------------------- zoom
  function setZoom(z, focal) {
    var scroll = $('stageScroll');
    var prev = state.zoom;
    state.zoom = Math.max(0.05, Math.min(2, z));
    $('zoomRange').value = Math.round(state.zoom * 100);
    $('valZoom').textContent = Math.round(state.zoom * 100) + '%';
    // keep the point under the cursor (or the viewport centre) put
    var rect = scroll.getBoundingClientRect();
    var fx = focal ? focal.x - rect.left : rect.width / 2;
    var fy = focal ? focal.y - rect.top : rect.height / 2;
    var ratio = state.zoom / prev;
    var nl = (scroll.scrollLeft + fx) * ratio - fx;
    var nt = (scroll.scrollTop + fy) * ratio - fy;
    paint(cachedContour);
    scroll.scrollLeft = nl; scroll.scrollTop = nt;
  }
  function zoomToFit() {
    var scroll = $('stageScroll');
    var pad = 60;
    // At boot the stage may not have been laid out yet; fitting against a
    // zero-size box would clamp the zoom to its 5% floor.
    if (scroll.clientWidth < 50 || scroll.clientHeight < 50) {
      requestAnimationFrame(zoomToFit);
      return;
    }
    var zx = (scroll.clientWidth - pad) / state.canvasW;
    var zy = (scroll.clientHeight - pad) / state.canvasH;
    setZoom(Math.min(zx, zy));
  }

  // --------------------------------------------------------- canvas pointer
  function canvasPoint(ev) {
    var rect = $('posterCanvas').getBoundingClientRect();
    return { x: (ev.clientX - rect.left) / state.zoom, y: (ev.clientY - rect.top) / state.zoom };
  }
  function inBox(p, b, slack) {
    slack = slack || 0;
    return p.x >= b[0] - slack && p.x <= b[2] + slack && p.y >= b[1] - slack && p.y <= b[3] + slack;
  }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

  // Handles on the *selected* row win over everything, so a corner grip stays
  // grabbable even where it overlaps other artwork.
  function hitHandles(p) {
    if (!state.selected || state.selected.type !== 'row') return null;
    var rl = buildRowLayouts().filter(function (r) { return r.row.id === state.selected.id; })[0];
    if (!rl) return null;
    var g = rowGizmo(rl), grab = (HANDLE_R + 4) / state.zoom;
    if (dist(p.x, p.y, g.rotate[0], g.rotate[1]) <= grab) {
      return { mode: 'rotate', rl: rl, row: rl.row };
    }
    for (var i = 0; i < 4; i++) {
      if (dist(p.x, p.y, g.corners[i][0], g.corners[i][1]) <= grab) {
        return { mode: 'resize', rl: rl, row: rl.row };
      }
    }
    return null;
  }

  function hitTest(p) {
    var handle = hitHandles(p);
    if (handle) return handle;
    // small text sits on top, so it wins ties
    for (var i = state.smallBlocks.length - 1; i >= 0; i--) {
      var b = state.smallBlocks[i];
      if (inBox(p, blockLayout(b).bbox, 6)) return { mode: 'move', type: 'block', id: b.id, item: b };
    }
    var layouts = buildRowLayouts();
    for (var j = layouts.length - 1; j >= 0; j--) {
      if (pointInRow(p, layouts[j], 4)) {
        return { mode: 'move', type: 'row', id: layouts[j].row.id, item: layouts[j].row };
      }
    }
    return null;
  }

  function initCanvasInteraction() {
    var overlay = $('overlayCanvas'), scroll = $('stageScroll');
    var drag = null, pan = null;

    function setCursor(hit) {
      overlay.classList.toggle('movable', !!hit && hit.mode === 'move');
      overlay.classList.toggle('resizing', !!hit && hit.mode === 'resize');
      overlay.classList.toggle('rotating', !!hit && hit.mode === 'rotate');
    }

    overlay.addEventListener('mousemove', function (ev) {
      if (drag || pan) return;
      setCursor(hitTest(canvasPoint(ev)));
    });

    overlay.addEventListener('mousedown', function (ev) {
      var p = canvasPoint(ev);
      var hit = hitTest(p);
      if (!hit) {
        state.selected = null;
        syncSelection(); paintOverlay();
        pan = { x: ev.clientX, y: ev.clientY, sl: scroll.scrollLeft, st: scroll.scrollTop };
        scroll.classList.add('panning');
        return;
      }
      ev.preventDefault();
      dragging = true;
      if (hit.mode === 'move') {
        select(hit.type, hit.id);
        drag = { mode: 'move', hit: hit, startX: p.x, startY: p.y, origXp: hit.item.xp, origYp: hit.item.yp };
        overlay.classList.add('grabbing');
      } else {
        var row = hit.row, rl = hit.rl;
        drag = {
          mode: hit.mode, hit: hit, row: row,
          cx: rl.px, cy: rl.py,
          origSize: row.size, origRot: row.rot || 0,
          startDist: Math.max(1e-3, dist(p.x, p.y, rl.px, rl.py)),
          startAngle: Math.atan2(p.y - rl.py, p.x - rl.px),
        };
      }
    });

    window.addEventListener('mousemove', function (ev) {
      if (drag) {
        var p = canvasPoint(ev);
        if (!drag.moved) {
          drag.moved = true;
          var who = drag.mode === 'move' ? itemName(drag.hit.type, drag.hit.id) : itemName('row', drag.row.id);
          checkpoint((drag.mode === 'move' ? 'Move ' : drag.mode === 'resize' ? 'Resize ' : 'Rotate ') + who);
        }
        if (drag.mode === 'move') {
          drag.hit.item.xp = drag.origXp + (p.x - drag.startX) / state.canvasW * 100;
          drag.hit.item.yp = drag.origYp + (p.y - drag.startY) / state.canvasH * 100;
          if (drag.hit.type === 'row') paintFast(); else paint(cachedContour);
        } else if (drag.mode === 'resize') {
          var f = dist(p.x, p.y, drag.cx, drag.cy) / drag.startDist;
          drag.row.size = Math.max(20, Math.min(500, Math.round(drag.origSize * f)));
          paintFast();
        } else {
          var a = Math.atan2(p.y - drag.cy, p.x - drag.cx);
          var deg = drag.origRot + (a - drag.startAngle) * 180 / Math.PI;
          if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
          drag.row.rot = wrapDeg(deg);
          paintFast();
        }
        updateCardMeta();
      } else if (pan) {
        scroll.scrollLeft = pan.sl - (ev.clientX - pan.x);
        scroll.scrollTop = pan.st - (ev.clientY - pan.y);
      }
    });

    window.addEventListener('mouseup', function () {
      if (drag) {
        var heavy = drag.mode !== 'move' || drag.hit.type === 'row';
        drag = null; dragging = false;
        overlay.classList.remove('grabbing');
        if (heavy) scheduleRender(true); else schedulePersist();
      }
      if (pan) { pan = null; scroll.classList.remove('panning'); }
    });

    scroll.addEventListener('wheel', function (ev) {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      ev.preventDefault();
      setZoom(state.zoom * (ev.deltaY < 0 ? 1.12 : 1 / 1.12), { x: ev.clientX, y: ev.clientY });
    }, { passive: false });

    window.addEventListener('keydown', function (ev) {
      if (!state.selected) return;
      var tag = (ev.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      var item = state.selected.type === 'row' ? findRow(state.selected.id) : findBlock(state.selected.id);
      if (!item) return;
      var isRow = state.selected.type === 'row';
      var step = ev.shiftKey ? 1 : 0.15, moved = true;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      var turn = isRow && (ev.key === '[' || ev.key === ']');
      if (!turn && !/^Arrow(Left|Right|Up|Down)$/.test(ev.key)) return;
      // a run of presses (key repeat included) is one undo step
      var nkey = (turn ? 'turn:' : 'nudge:') + state.selected.type + item.id;
      if (nudge.key !== nkey) checkpoint((turn ? 'Rotate ' : 'Nudge ') + itemName(state.selected.type, item.id));
      nudge.key = nkey;
      clearTimeout(nudge.timer);
      nudge.timer = setTimeout(function () { nudge.key = ''; }, 700);
      if (ev.key === 'ArrowLeft') item.xp -= step;
      else if (ev.key === 'ArrowRight') item.xp += step;
      else if (ev.key === 'ArrowUp') item.yp -= step;
      else if (ev.key === 'ArrowDown') item.yp += step;
      else if (isRow && (ev.key === '[' || ev.key === ']')) {
        item.rot = wrapDeg((item.rot || 0) + (ev.key === '[' ? -1 : 1) * (ev.shiftKey ? 15 : 1));
      } else moved = false;
      if (!moved) return;
      ev.preventDefault();
      if (isRow) updateCardMeta();
      scheduleRender(isRow);
    });
  }

  // --------------------------------------------------------------- binding
  function bindRange(id, valId, get, set, fmt, heavy) {
    var el = $(id), val = valId ? $(valId) : null;
    var sync = function () { el.value = get(); if (val) val.textContent = fmt(get()); };
    sync();
    rangeSyncs.push(sync);
    el.addEventListener('input', function () {
      var v = parseFloat(el.value);
      set(v);
      if (val) val.textContent = fmt(v);
      scheduleRender(heavy);
    });
  }
  function bindSegRow(rowId, get, set, heavy, onChange) {
    var row = $(rowId);
    var cells = row.querySelectorAll('.pill-btn');
    cells.forEach(function (btn) {
      var on = btn.dataset.value === get();
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.addEventListener('click', function () {
        checkpoint(row.getAttribute('aria-label') || '');
        cells.forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        set(btn.dataset.value);
        if (onChange) onChange();
        scheduleRender(heavy);
      });
    });
  }

  function loadFontThen(block, cb) {
    if (document.fonts && document.fonts.load) {
      document.fonts.load(blockFontStr(block)).then(cb).catch(cb);
    } else cb();
  }

  function updateFontSourceUI() {
    var isUpload = state.fontSource === 'upload';
    $('fontDropzone').hidden = !isUpload;
    $('glyphControls').hidden = isUpload;
  }

  // ------------------------------------------------- built-in letter shape
  var GLYPH_FIELDS = [
    ['glyphMass', 'valGlyphMass', 'mass', function (v) { return v.toFixed(2); }],
    ['glyphMelt', 'valGlyphMelt', 'melt', function (v) { return Math.round(v); }],
    ['glyphTension', 'valGlyphTension', 'tension', function (v) { return v.toFixed(1); }],
    ['glyphWobble', 'valGlyphWobble', 'wobble', function (v) { return v.toFixed(1); }],
    ['glyphFlow', 'valGlyphFlow', 'flow', function (v) { return Math.round(v * 100) + '%'; }],
    ['glyphDrip', 'valGlyphDrip', 'drip', function (v) { return Math.round(v * 100) + '%'; }],
  ];
  function syncGlyphSliders() {
    GLYPH_FIELDS.forEach(function (f) {
      $(f[0]).value = state.glyph[f[2]];
      $(f[1]).textContent = f[3](state.glyph[f[2]]);
    });
    var sel = $('glyphPreset');
    sel.value = hasOwn(presetTable(), state.glyph.preset) ? state.glyph.preset : 'custom';
  }
  function glyphChanged() {
    // the letterforms themselves changed, so both caches are stale
    builtinCache = {}; layoutCache = {};
    scheduleRender(true);
  }
  // The user reshaping letters here means they no longer want the Font
  // tool's shape mirrored: drop the match, but keep what they just set.
  function unmatchShape() {
    if (!(linked() && link.shape)) return;
    link.shape = false; link.saved = null;
    $('useProjectShape').checked = false;
    updateProjectUI();
  }

  // Adopt (or give back) the project's flow state, seed-free shape values and
  // accent spacing, depending on the two toggles.
  function applyLinkShape() {
    var on = linked() && link.shape;
    if (on) {
      if (!link.saved) link.saved = { glyph: copyObj(state.glyph), layout: GC ? copyObj(GC.LAYOUT) : null };
      if (project.shape) {
        Object.keys(project.shape).forEach(function (k) { state.glyph[k] = project.shape[k]; });
        state.glyph.preset = project.preset;
      }
      if (GC) {
        // start from stock spacing, so keys the project doesn't carry are not
        // left over from an earlier project
        Object.keys(DEFAULT_LAYOUT).forEach(function (k) { GC.LAYOUT[k] = DEFAULT_LAYOUT[k]; });
        if (project.marks) Object.keys(project.marks).forEach(function (k) { GC.LAYOUT[k] = project.marks[k]; });
      }
    } else if (link.saved) {
      state.glyph = copyObj(link.saved.glyph);
      if (GC && link.saved.layout) Object.keys(link.saved.layout).forEach(function (k) { GC.LAYOUT[k] = link.saved.layout[k]; });
      link.saved = null;
    }
    syncGlyphSliders();
  }

  var HINT_STOCK = 'Reshapes the letterforms themselves. Sculpt single letters and accents node-by-node in the ' +
    '<a href="/generativefont_creator/" target="_blank" rel="noopener">Font tool</a>: your edits appear here automatically (same browser).';
  var HINT_LINKED = 'Drawing with the letters and accents from your <a href="/generativefont_creator/" target="_blank" rel="noopener">Font tool</a> project. ' +
    'Node edits there update this poster live; the sliders reshape every letter at once.';
  function updateProjectUI() {
    $('projectBox').hidden = !project;
    $('useProject').checked = link.use;
    $('useProjectShape').checked = link.shape;
    $('useProjectShape').disabled = !link.use;
    $('useProjectShape').parentNode.classList.toggle('is-disabled', !link.use);
    // project data is untrusted: textContent only, never markup
    var meta = '';
    if (project) {
      meta = (project.fontName ? '\u201c' + project.fontName + '\u201d \u00b7 ' : '') +
        (project.edited ? project.edited + ' edited glyph' + (project.edited === 1 ? '' : 's')
                        : 'no glyph edits yet') +
        (link.use ? '' : ' \u00b7 not in use');
    }
    $('projectMeta').textContent = meta;
    $('glyphHint').innerHTML = linked() ? HINT_LINKED : HINT_STOCK;
  }

  // Pick up the Font tool's latest autosave. `force` re-applies even when the
  // stored string hasn't changed (used at boot).
  function refreshProject(force) {
    var had = !!project;
    if (!readProject() && !force) return;
    // default ON whenever a project appears (at boot: whatever the saved poster said)
    if (project && !had && !force) link.use = true;
    srcVer++;
    builtinCache = {}; layoutCache = {};
    applyLinkShape();
    updateProjectUI();
    if (!force) scheduleRender(true);
  }

  // ------------------------------------------------------------ persistence
  // The composition (rows, small text, poster size and colours, typeface and
  // finish settings) autosaves to this browser and comes back on reload. An
  // uploaded font FILE is never stored, only its name, so the page can ask
  // for it again. Like the Font-tool project the stored copy is untrusted:
  // every field is type-checked and clamped, and a malformed field falls back
  // to its default on its own instead of discarding the rest.
  var POSTER_KEY = 'liquidfont.poster.v1';
  var ROW_NUM = {
    size: [20, 500], tracking: [-0.06, 0.5], xp: [-200, 300], yp: [-200, 300],
    flow: [0, 46], slant: [-25, 25], weight: [0.15, 1.4], pocket: [0, 0.14],
    gap: [1, 20], jitter: [0, 10], lines: [2, 14], spacing: [3, 40],
  };
  var ROW_ENUM = { style: ['melt', 'ink'], effect: ['solid', 'rough', 'contour'], mode: ['outline', 'filled'] };
  var BLOCK_NUM = { size: [6, 72], lh: [90, 220], xp: [-200, 300], yp: [-200, 300] };
  var BLOCK_KEYS = ['text', 'font', 'size', 'lh', 'align', 'xp', 'yp', 'color'];
  var MERGE_NUM = {
    melt: [0, 40], tension: [-30, 30], wobble: [0, 10], grain: [0.01, 0.15], smooth: [0, 4], strokeWidth: [0.5, 6],
  };
  var restoredFontName = '';   // an uploaded font the restored poster used, until it is uploaded again

  function strOf(v, max) { return typeof v === 'string' ? v.slice(0, max) : null; }
  function hexOf(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null; }
  function pickKeys(o, keys) { var c = {}; keys.forEach(function (k) { c[k] = o[k]; }); return c; }

  function serializeComposition() {
    var rowKeys = ['text', 'rot'].concat(Object.keys(ROW_NUM), Object.keys(ROW_ENUM));
    // while the Font tool's shape is mirrored, the user's own one is parked in link.saved
    var glyph = linked() && link.shape && link.saved ? link.saved.glyph : state.glyph;
    return {
      app: 'liquid.poster', version: 1,
      fontSource: state.fontSource,
      uploadedFontName: state.uploadedFontName || restoredFontName || '',
      glyph: pickKeys(glyph, ['preset'].concat(SHAPE_KEYS)),
      link: { use: link.use, shape: link.shape },
      seed: state.seed,
      merge: pickKeys(state, Object.keys(MERGE_NUM)),
      canvas: { preset: state.canvasPreset, w: state.canvasW, h: state.canvasH },
      palette: { ink: state.ink, bg: state.bg, transparent: state.bgTransparent },
      rows: state.bigRows.map(function (r) { return pickKeys(r, rowKeys); }),
      blocks: state.smallBlocks.map(function (b) { return pickKeys(b, BLOCK_KEYS); }),
    };
  }

  function validRow(o) {
    if (!o || typeof o !== 'object') return null;
    var text = strOf(o.text, 200);
    if (text == null) return null;
    var over = { text: text };
    Object.keys(ROW_NUM).forEach(function (k) { if (finite(o[k])) over[k] = clampTo(o[k], ROW_NUM[k]); });
    Object.keys(ROW_ENUM).forEach(function (k) { if (ROW_ENUM[k].indexOf(o[k]) >= 0) over[k] = o[k]; });
    if (finite(o.rot)) over.rot = wrapDeg(o.rot);
    if (over.lines != null) over.lines = Math.round(over.lines);
    return makeRow(over);
  }
  function validBlock(o) {
    if (!o || typeof o !== 'object') return null;
    var text = strOf(o.text, 2000);
    if (text == null) return null;
    var over = { text: text };
    Object.keys(BLOCK_NUM).forEach(function (k) { if (finite(o[k])) over[k] = clampTo(o[k], BLOCK_NUM[k]); });
    if (MONO_FONTS.some(function (f) { return f[0] === o.font; })) over.font = o.font;
    if (['left', 'center', 'right'].indexOf(o.align) >= 0) over.align = o.align;
    if (hexOf(o.color)) over.color = hexOf(o.color);
    return makeBlock(over);
  }
  function validateComposition(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
    if (p.app !== 'liquid.poster' || p.version !== 1) return null;
    var out = {};
    if (Array.isArray(p.rows)) {
      var rows = p.rows.slice(0, 24).map(validRow).filter(Boolean);
      // an emptied poster comes back empty (the stage prompts for a row); a
      // list whose every row was unreadable falls back to the stock rows
      if (rows.length || !p.rows.length) out.rows = rows;
    }
    // no small text at all is a legitimate choice
    if (Array.isArray(p.blocks)) out.blocks = p.blocks.slice(0, 40).map(validBlock).filter(Boolean);
    if (p.fontSource === 'builtin' || p.fontSource === 'upload') out.fontSource = p.fontSource;
    var nm = strOf(p.uploadedFontName, 120);
    if (nm) out.uploadedFontName = nm;
    if (p.glyph && typeof p.glyph === 'object') {
      var g = {}, n = 0;
      SHAPE_KEYS.forEach(function (k) {
        if (finite(p.glyph[k])) { g[k] = clampTo(p.glyph[k], SHAPE_LIMITS[k]); n++; }
      });
      if (n) {
        var pr = p.glyph.preset;
        g.preset = typeof pr === 'string' && hasOwn(presetTable(), pr) ? pr : 'custom';
        out.glyph = fillFlowKeys(g, pr);
      }
    }
    if (p.link && typeof p.link === 'object') out.link = { use: p.link.use !== false, shape: p.link.shape !== false };
    if (finite(p.seed)) out.seed = Math.round(clampTo(p.seed, [0, 1e6]));
    if (p.merge && typeof p.merge === 'object') {
      var m = {};
      Object.keys(MERGE_NUM).forEach(function (k) { if (finite(p.merge[k])) m[k] = clampTo(p.merge[k], MERGE_NUM[k]); });
      if (m.smooth != null) m.smooth = Math.round(m.smooth);
      out.merge = m;
    }
    if (p.canvas && typeof p.canvas === 'object') {
      var cp = p.canvas.preset;
      if (typeof cp === 'string' && hasOwn(SIZE_PRESETS, cp)) {
        out.canvas = { preset: cp, w: SIZE_PRESETS[cp][0], h: SIZE_PRESETS[cp][1] };
      } else if (cp === 'custom' && finite(p.canvas.w) && finite(p.canvas.h)) {
        out.canvas = {
          preset: 'custom',
          w: Math.round(clampTo(p.canvas.w, [100, 10000])), h: Math.round(clampTo(p.canvas.h, [100, 10000])),
        };
      }
    }
    if (p.palette && typeof p.palette === 'object') {
      out.palette = { ink: hexOf(p.palette.ink), bg: hexOf(p.palette.bg), transparent: p.palette.transparent === true };
    }
    return out;
  }
  function applyComposition(c) {
    if (c.rows) state.bigRows = c.rows;
    if (c.blocks) state.smallBlocks = c.blocks;
    if (c.fontSource) state.fontSource = c.fontSource;
    restoredFontName = c.fontSource === 'upload' && c.uploadedFontName ? c.uploadedFontName : '';
    if (c.glyph) Object.keys(c.glyph).forEach(function (k) { state.glyph[k] = c.glyph[k]; });
    if (c.link) { link.use = c.link.use; link.shape = c.link.shape; }
    if (c.seed != null) state.seed = c.seed;
    if (c.merge) Object.keys(c.merge).forEach(function (k) { state[k] = c.merge[k]; });
    if (c.canvas) { state.canvasPreset = c.canvas.preset; state.canvasW = c.canvas.w; state.canvasH = c.canvas.h; }
    if (c.palette) {
      if (c.palette.ink) state.ink = c.palette.ink;
      if (c.palette.bg) state.bg = c.palette.bg;
      state.bgTransparent = c.palette.transparent;
    }
  }
  // Read and apply the saved poster. Returns true when one was restored.
  function restoreComposition() {
    var raw = null, c = null;
    try { raw = window.localStorage.getItem(POSTER_KEY); } catch (e) { return false; }
    if (typeof raw !== 'string' || raw.length > 2e6) return false;
    try { c = validateComposition(JSON.parse(raw)); } catch (e) { c = null; }
    if (!c) return false;
    applyComposition(c);
    return true;
  }

  // Saves settle for a moment: a slider drag or a burst of typing is one write.
  var persistTimer = null, persistReady = false;
  function schedulePersist() {
    commitStep();                         // every edit passes through here: keep its undo step
    if (!persistReady) return;            // nothing is written until boot has finished
    clearTimeout(persistTimer);
    persistTimer = setTimeout(savePoster, 400);
  }
  function savePoster() {
    clearTimeout(persistTimer); persistTimer = null;
    try { window.localStorage.setItem(POSTER_KEY, JSON.stringify(serializeComposition())); }
    catch (e) { /* full, blocked or private mode: the poster still works, it just won't come back */ }
  }
  function flushPersist() { if (persistTimer) savePoster(); }

  // ---------------------------------------------------------------- history
  // Undo / redo over exactly what the autosave stores (rows, small text,
  // poster size and colours, typeface and its shape, merge settings). A
  // snapshot is taken at the START of each gesture: a slider drag, a pick, a
  // burst of typing, a canvas drag, a run of arrow-key nudges, Reset... It is
  // only kept once that gesture really changes something (commitStep runs on
  // every edit via schedulePersist), so clicking the pill that is already on,
  // or a press on the canvas that never moves, leaves no empty step behind.
  var HISTORY_MAX = 80;
  var undoStack = [], redoStack = [];
  var pendingStep = null;     // { s, sel, label } from the gesture in progress
  var restoring = false;
  var IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

  // while the Font tool's shape is mirrored, the user's own one is parked in link.saved
  function userGlyph() { return linked() && link.shape && link.saved ? link.saved.glyph : state.glyph; }
  function snapshotState() {
    return JSON.stringify({
      rows: state.bigRows, blocks: state.smallBlocks,
      fontSource: state.fontSource,
      glyph: pickKeys(userGlyph(), ['preset'].concat(SHAPE_KEYS)),
      link: [link.use, link.shape],
      seed: state.seed,
      merge: pickKeys(state, Object.keys(MERGE_NUM)),
      canvas: [state.canvasPreset, state.canvasW, state.canvasH],
      palette: [state.ink, state.bg, state.bgTransparent],
      restoredFontName: restoredFontName,
    });
  }
  function selCopy() { return state.selected ? { type: state.selected.type, id: state.selected.id } : null; }
  function selExists(sel) { return !!sel && !!(sel.type === 'row' ? findRow(sel.id) : findBlock(sel.id)); }
  function itemName(type, id) {
    var list = type === 'row' ? state.bigRows : state.smallBlocks;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return (type === 'row' ? 'row ' : 'text ') + (i + 1);
    return type === 'row' ? 'row' : 'text';
  }

  // Mark the start of a gesture. `label` names it in the Undo tooltip / toast.
  function checkpoint(label) {
    if (restoring || !persistReady) return;
    commitStep();               // a previous gesture still settling (an async font load) keeps its own step
    pendingStep = { s: snapshotState(), sel: selCopy(), label: label || '' };
  }
  function commitStep() {
    if (!pendingStep || restoring) return;
    if (snapshotState() === pendingStep.s) return;
    undoStack.push(pendingStep);
    if (undoStack.length > HISTORY_MAX) undoStack.shift();
    redoStack.length = 0;
    pendingStep = null;
    updateHistoryUI();
  }

  // Gesture state for the coalescing rules: one step per typing burst, per
  // slider drag (first 'input' after a 'change'), per run of nudges.
  var typing = { el: null, timer: null }, nudge = { key: '', timer: null };
  function endBursts() {
    clearTimeout(typing.timer); typing.el = null;
    clearTimeout(nudge.timer); nudge.key = '';
  }

  function undo() { return stepHistory(undoStack, redoStack, 'Undo'); }
  function redo() { return stepHistory(redoStack, undoStack, 'Redo'); }
  function stepHistory(from, to, verb) {
    commitStep();
    pendingStep = null;
    endBursts();
    var cur = snapshotState(), entry;
    // skip anything identical to what is on screen (nothing to see change)
    while ((entry = from.pop()) && entry.s === cur) { /* drop it */ }
    if (!entry) { updateHistoryUI(); return false; }
    to.push({ s: cur, sel: selCopy(), label: entry.label });
    restoreSnapshot(entry);
    updateHistoryUI();
    toast(verb + (entry.label ? ': ' + entry.label : ''), 1600);
    return true;
  }

  function restoreSnapshot(entry) {
    var c = JSON.parse(entry.s);
    var active = document.activeElement;
    var fromList = active && active.closest ? active.closest('.card-list') : null;
    restoring = true;
    try {
      // fresh objects (ids kept, so selection and focus keys still match)
      state.bigRows = c.rows.map(function (r) { return makeRow(r); });
      state.smallBlocks = c.blocks.map(function (b) { return makeBlock(b); });
      state.fontSource = c.fontSource;
      state.seed = c.seed;
      Object.keys(c.merge).forEach(function (k) { state[k] = c.merge[k]; });
      var resized = state.canvasW !== c.canvas[1] || state.canvasH !== c.canvas[2];
      state.canvasPreset = c.canvas[0]; state.canvasW = c.canvas[1]; state.canvasH = c.canvas[2];
      state.ink = c.palette[0]; state.bg = c.palette[1]; state.bgTransparent = c.palette[2];
      // the font FILE is never part of history: a loaded one stays loaded
      restoredFontName = state.uploadedFont ? '' : c.restoredFontName;

      var glyphNow = JSON.stringify([pickKeys(userGlyph(), ['preset'].concat(SHAPE_KEYS)), link.use, link.shape]);
      if (glyphNow !== JSON.stringify([c.glyph, c.link[0], c.link[1]])) {
        // hand back a mirrored Font-tool shape first, so what gets parked
        // again below is the user's own spacing, not the project's
        if (link.saved) {
          if (GC && link.saved.layout) Object.keys(link.saved.layout).forEach(function (k) { GC.LAYOUT[k] = link.saved.layout[k]; });
          link.saved = null;
        }
        state.glyph = copyObj(c.glyph);
        link.use = c.link[0]; link.shape = c.link[1];
        applyLinkShape(); updateProjectUI();
      }

      // selection: what was selected at that step, else what is selected now
      state.selected = selExists(entry.sel) ? entry.sel : selExists(state.selected) ? selCopy() : null;
      syncControls();
      keepFocus(function () { renderPalette(); renderBigRowCards(); renderSmallBlockCards(); });
      // the focused card control went away with its row: land somewhere sane
      if (fromList && (!document.activeElement || document.activeElement === document.body)) {
        $(fromList.id === 'bigRowList' ? 'btnAddBigRow' : 'btnAddSmallBlock').focus({ preventScroll: true });
      }
      state.smallBlocks.forEach(function (b) { loadFontThen(b, function () { paint(cachedContour); }); });
      if (resized) zoomToFit();
      scheduleRender(true);
    } finally {
      restoring = false;
    }
  }

  function updateHistoryUI() {
    histButton($('btnUndo'), undoStack, 'Undo', IS_MAC ? '\u2318Z' : 'Ctrl+Z');
    histButton($('btnRedo'), redoStack, 'Redo', IS_MAC ? '\u21e7\u2318Z' : 'Ctrl+Y');
  }
  function histButton(btn, stack, verb, keys) {
    if (!btn) return;
    var top = stack[stack.length - 1];
    btn.setAttribute('aria-disabled', top ? 'false' : 'true');
    btn.title = top ? verb + (top.label ? ' ' + top.label : '') + ' (' + keys + ')' : 'Nothing to ' + verb.toLowerCase();
  }

  // Text you type into keeps the browser's own undo while it has focus.
  function isTextEntry(el) {
    if (!el || !el.tagName) return false;
    if (el.isContentEditable) return true;
    var tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return true;
    return tag === 'input' && /^(text|search|email|url|tel|password|number)$/.test(el.type);
  }
  function labelText(l) {
    var c = l.cloneNode(true);
    c.querySelectorAll('b, input, select, textarea').forEach(function (x) { x.remove(); });
    return c.textContent.replace(/\s+/g, ' ').trim();
  }
  function controlName(el) {
    var n = el.getAttribute('aria-label');
    if (!n && el.id) {
      var l = document.querySelector('label[for="' + el.id + '"]');
      if (l) n = labelText(l);
    }
    if (!n && el.closest('label')) n = labelText(el.closest('label'));
    return (n || '').trim();
  }

  function initHistory() {
    // Sidebar controls, caught in the capture phase, i.e. before their own
    // handlers have touched the state.
    var side = document.querySelector('.poster-sidebar');
    side.addEventListener('input', function (ev) {
      var el = ev.target;
      if (el.type === 'file') return;
      if (isTextEntry(el)) {
        if (typing.el !== el) checkpoint(controlName(el));
        typing.el = el;
        clearTimeout(typing.timer);
        typing.timer = setTimeout(function () { typing.el = null; }, 900);
      } else if (el.type === 'range' || el.type === 'color') {
        if (!el._gesture) { el._gesture = true; checkpoint(controlName(el)); }
      }
    }, true);
    side.addEventListener('change', function (ev) {
      var el = ev.target;
      if (el.type === 'file') return;
      if (el.type === 'range' || el.type === 'color') { el._gesture = false; return; }
      if (isTextEntry(el)) { if (typing.el === el) typing.el = null; return; }
      checkpoint(controlName(el));          // selects and checkboxes: one step each
    }, true);
    side.addEventListener('focusout', function (ev) { if (typing.el === ev.target) typing.el = null; }, true);

    $('btnUndo').addEventListener('click', function () { if (this.getAttribute('aria-disabled') !== 'true') undo(); });
    $('btnRedo').addEventListener('click', function () { if (this.getAttribute('aria-disabled') !== 'true') redo(); });

    window.addEventListener('keydown', function (ev) {
      if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
      var k = (ev.key || '').toLowerCase();
      if (k !== 'z' && k !== 'y') return;
      // native undo inside text fields; ranges, selects and buttons don't block it
      if (isTextEntry(ev.target)) return;
      if (document.querySelector('dialog[open]')) return;
      ev.preventDefault();
      if (k === 'y' || ev.shiftKey) redo(); else undo();
    });
    updateHistoryUI();
  }

  // Every sidebar control that mirrors state, refreshed from it in one go
  // (boot after a restore, and Reset poster).
  var rangeSyncs = [];
  function syncSegRow(rowId, value) {
    $(rowId).querySelectorAll('.pill-btn').forEach(function (b) {
      var on = b.dataset.value === value;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function syncControls() {
    rangeSyncs.forEach(function (f) { f(); });
    $('valSeed').textContent = '#' + state.seed;
    syncSegRow('fontSourceRow', state.fontSource);
    $('canvasPreset').value = state.canvasPreset;
    $('customSizeRow').hidden = state.canvasPreset !== 'custom';
    $('canvasW').value = state.canvasW; $('canvasH').value = state.canvasH;
    $('inkColor').value = state.ink; $('bgColor').value = state.bg;
    $('bgTransparent').checked = state.bgTransparent;
    syncGlyphSliders();
    updateFontSourceUI();
    updateDropLabel();
  }
  function updateDropLabel() {
    var label = $('fontDropLabel'), zone = $('fontDropzone');
    if (state.uploadedFont) {
      label.textContent = 'Loaded: ' + state.uploadedFontName + ' — click to replace.';
    } else if (restoredFontName) {
      // the poster came back but the font file could not (files are never stored)
      label.textContent = 'Upload ' + restoredFontName + ' again to finish restoring this poster (font files aren’t saved), or click to browse.';
    } else {
      label.textContent = 'Drop a .ttf / .otf / .woff, or click to browse';
    }
    zone.classList.toggle('has-font', !!state.uploadedFont);
    zone.classList.toggle('needs-font', !state.uploadedFont && !!restoredFontName);
  }
  // Sizes for rows that asked for one (`fit`): the stock rows, at boot or reset.
  function fitPendingRows() {
    state.bigRows.forEach(function (r) {
      if (r.fit) { autoFitRowSize(r, r.fit); delete r.fit; }
    });
  }

  function resetPoster() {
    clearTimeout(persistTimer); persistTimer = null;
    try { window.localStorage.removeItem(POSTER_KEY); } catch (e) { /* nothing stored, or storage blocked */ }
    Object.keys(DEFAULTS).forEach(function (k) { state[k] = DEFAULTS[k]; });
    state.bigRows = defaultRows(); state.smallBlocks = defaultBlocks();
    state.selected = null;
    restoredFontName = '';
    // stock letter shape, and the Font-tool link back on (its default)
    state.glyph = stockGlyph();
    link.use = true; link.shape = true; link.saved = null;
    // stock accent spacing too, so applyLinkShape parks the stock values (not
    // a previous project's) for when the user opts out of the match
    if (GC && DEFAULT_LAYOUT) Object.keys(DEFAULT_LAYOUT).forEach(function (k) { GC.LAYOUT[k] = DEFAULT_LAYOUT[k]; });
    srcVer++;
    builtinCache = {}; layoutCache = {};
    applyLinkShape();
    updateProjectUI();
    warnedRows = {}; lastMissing = '';
    fitPendingRows();
    syncControls();
    renderBigRowCards(); renderSmallBlockCards(); renderPalette();
    zoomToFit();
    scheduleRender(true);
    clearTimeout(persistTimer); persistTimer = null;   // a reset poster is the stock one: nothing to store
    toast('Poster reset to the starting layout. ' + (IS_MAC ? '\u2318Z' : 'Ctrl+Z') + ' or Undo brings it back', 3600);
  }

  function applyCanvasSize(w, h) {
    state.canvasW = w; state.canvasH = h;
    layoutCache = {};
    scheduleRender(true);
  }

  function init() {
    // -- built-in letterform shape: the demo poster's (stockGlyph), read now
    // that the shared Flow states are loaded
    state.glyph = stockGlyph();

    // -- the poster from the last visit, before any control reads state
    var restored = restoreComposition();

    // -- typeface
    bindSegRow('fontSourceRow', function () { return state.fontSource; },
      function (v) { state.fontSource = v; layoutCache = {}; }, true, updateFontSourceUI);
    updateFontSourceUI();

    // The dropzone is a <label for=fontFileInput>: the browser opens the picker
    // on click, and the (visually hidden) input itself takes keyboard focus.
    var dropzone = $('fontDropzone'), fileInput = $('fontFileInput');
    dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.style.borderColor = 'var(--hi)'; });
    dropzone.addEventListener('dragleave', function () { if (!state.uploadedFont) dropzone.style.borderColor = ''; });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault(); dropzone.style.borderColor = '';
      if (e.dataTransfer.files[0]) loadFontFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', function (e) { if (e.target.files[0]) loadFontFile(e.target.files[0]); });

    // With Upload picked, the whole stage takes a dropped font file too: that
    // is where the empty-state prompt asks for it.
    var stageView = $('stageView');
    var dragDepth = 0;
    function fileDrag(e) {
      return state.fontSource === 'upload' && e.dataTransfer &&
        Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0;
    }
    stageView.addEventListener('dragenter', function (e) {
      if (!fileDrag(e)) return;
      e.preventDefault(); dragDepth++; stageView.classList.add('drop-ready');
    });
    stageView.addEventListener('dragover', function (e) { if (fileDrag(e)) e.preventDefault(); });
    stageView.addEventListener('dragleave', function () {
      if (--dragDepth <= 0) { dragDepth = 0; stageView.classList.remove('drop-ready'); }
    });
    stageView.addEventListener('drop', function (e) {
      dragDepth = 0; stageView.classList.remove('drop-ready');
      if (!fileDrag(e)) return;
      e.preventDefault();
      if (e.dataTransfer.files[0]) loadFontFile(e.dataTransfer.files[0]);
    });
    $('stageEmptyBtn').addEventListener('click', function () {
      var kind = $('stageEmpty').dataset.kind;
      if (kind === 'upload') fileInput.click();
      else if (kind === 'add') $('btnAddBigRow').click();
      else if (kind === 'edit' && state.bigRows[0]) {
        select('row', state.bigRows[0].id);
        var t = document.querySelector('[data-fk="row-' + state.bigRows[0].id + '-text"]');
        if (t) { t.focus(); t.scrollIntoView({ block: 'nearest' }); }
      }
    });

    function loadFontFile(file) {
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var font = opentype.parse(e.target.result);
          state.uploadedFont = font; state.uploadedFontName = file.name;
          restoredFontName = '';
          uploadVer++;
          layoutCache = {};
          updateDropLabel();
          var fam = (font.names && font.names.fontFamily && (font.names.fontFamily.en || Object.values(font.names.fontFamily)[0])) || file.name;
          toast('Font loaded: ' + fam);
          scheduleRender(true);
        } catch (err) {
          console.error(err); toast('Could not parse that font file', 3200);
        }
      };
      reader.onerror = function () { toast('Failed to read file', 3200); };
      reader.readAsArrayBuffer(file);
    }

    $('glyphPreset').addEventListener('change', function (ev) {
      var name = ev.target.value;
      unmatchShape();
      state.glyph.preset = name;
      var p = presetTable()[name];
      if (p) SHAPE_KEYS.forEach(function (k) { if (finite(p[k])) state.glyph[k] = p[k]; });
      syncGlyphSliders();
      glyphChanged();
    });
    GLYPH_FIELDS.forEach(function (f) {
      $(f[0]).addEventListener('input', function (ev) {
        unmatchShape();
        state.glyph[f[2]] = parseFloat(ev.target.value);
        $(f[1]).textContent = f[3](state.glyph[f[2]]);
        state.glyph.preset = 'custom';
        $('glyphPreset').value = 'custom';
        glyphChanged();
      });
    });

    // -- Font-tool project link
    $('useProject').addEventListener('change', function (ev) {
      link.use = ev.target.checked;
      srcVer++;
      applyLinkShape(); updateProjectUI(); glyphChanged();
    });
    $('useProjectShape').addEventListener('change', function (ev) {
      link.shape = ev.target.checked;
      applyLinkShape(); updateProjectUI(); glyphChanged();
    });
    refreshProject(true);
    // The Font tool autosaves from another tab: 'storage' fires here for every
    // save. Saves come in bursts while a node is dragged, so settle first.
    var projectTimer = null;
    window.addEventListener('storage', function (e) {
      if (e.key !== null && e.key !== PROJECT_KEY) return;
      clearTimeout(projectTimer);
      projectTimer = setTimeout(function () { refreshProject(false); }, 250);
    });
    // belt and braces for a missed event (e.g. edits made in this same tab)
    window.addEventListener('focus', function () { refreshProject(false); });

    // -- rows / blocks
    renderBigRowCards();
    renderSmallBlockCards();
    $('btnAddBigRow').addEventListener('click', function () {
      checkpoint('Add title row');
      // inherit the last row's look so a new line joins the composition
      // instead of arriving with unrelated settings
      var last = state.bigRows[state.bigRows.length - 1] || {};
      var row = makeRow({
        text: 'SPLIT',
        tracking: last.tracking != null ? last.tracking : 0.02,
        rot: last.rot || 0,
        style: last.style || 'melt',
        flow: last.flow, slant: last.slant, weight: last.weight, pocket: last.pocket,
        mode: last.mode || 'outline',
        xp: 50, yp: 50,
      });
      autoFitRowSize(row, 0.8);
      // Stack it under the last row using both real boxes (which already hold
      // any accents), instead of a fixed step that stacked marks could overrun.
      if (last.yp != null) {
        var la = rowLayout(last), na = rowLayout(row), H = state.canvasH;
        var step = la && na ? ((la.bbox[3] - la.bbox[1]) + (na.bbox[3] - na.bbox[1])) / 2 + H * 0.025 : H * 0.16;
        row.yp = Math.min(112, last.yp + step / H * 100);
      }
      state.bigRows.push(row);
      state.selected = { type: 'row', id: row.id };
      renderBigRowCards(); scheduleRender(true);
    });
    $('btnAddSmallBlock').addEventListener('click', function () {
      checkpoint('Add small text');
      var last = state.smallBlocks[state.smallBlocks.length - 1] || {};
      var b = makeBlock({
        font: last.font || "'JetBrains Mono'",
        size: last.size || 30, lh: last.lh || 130,
        color: last.color || state.ink,
      });
      state.smallBlocks.push(b);
      state.selected = { type: 'block', id: b.id };
      renderSmallBlockCards(); scheduleRender(false);
    });

    // -- merge & finish
    bindRange('melt', 'valMelt', function () { return state.melt; }, function (v) { state.melt = v; }, function (v) { return Math.round(v) + 'px'; }, true);
    bindRange('tension', 'valTension', function () { return state.tension; }, function (v) { state.tension = v; }, function (v) { return Math.round(v); }, true);
    bindRange('wobble', 'valWobble', function () { return state.wobble; }, function (v) { state.wobble = v; }, function (v) { return v.toFixed(1); }, true);
    bindRange('grain', 'valGrain', function () { return state.grain; }, function (v) { state.grain = v; }, function (v) { return v.toFixed(3); }, true);
    bindRange('smooth', 'valSmooth', function () { return state.smooth; }, function (v) { state.smooth = v; }, function (v) { return Math.round(v); }, true);
    bindRange('strokeWidth', 'valStroke', function () { return state.strokeWidth; }, function (v) { state.strokeWidth = v; }, function (v) { return v.toFixed(2) + 'px'; }, false);
    $('valSeed').textContent = '#' + state.seed;
    $('btnReseed').addEventListener('click', function () {
      checkpoint('Restir');
      state.seed = Math.floor(Math.random() * 9999);
      $('valSeed').textContent = '#' + state.seed;
      scheduleRender(true);
    });

    // -- canvas
    $('canvasPreset').value = state.canvasPreset;
    $('canvasPreset').addEventListener('change', function (ev) {
      var v = ev.target.value; state.canvasPreset = v;
      $('customSizeRow').hidden = v !== 'custom';
      if (v !== 'custom') {
        var s = SIZE_PRESETS[v];
        $('canvasW').value = s[0]; $('canvasH').value = s[1];
        applyCanvasSize(s[0], s[1]);
        zoomToFit();
      }
    });
    $('canvasW').value = state.canvasW; $('canvasH').value = state.canvasH;
    $('canvasW').addEventListener('input', function (ev) { applyCanvasSize(Math.max(100, parseInt(ev.target.value, 10) || 1000), state.canvasH); });
    $('canvasH').addEventListener('input', function (ev) { applyCanvasSize(state.canvasW, Math.max(100, parseInt(ev.target.value, 10) || 1000)); });

    // -- palette
    renderPalette();
    $('inkColor').value = state.ink; $('bgColor').value = state.bg;
    $('inkColor').addEventListener('input', function (ev) { state.ink = ev.target.value; renderPalette(); scheduleRender(false); });
    $('bgColor').addEventListener('input', function (ev) { state.bg = ev.target.value; state.bgTransparent = false; $('bgTransparent').checked = false; renderPalette(); scheduleRender(false); });
    $('bgTransparent').addEventListener('change', function (ev) { state.bgTransparent = ev.target.checked; renderPalette(); scheduleRender(false); });

    // -- zoom
    $('zoomRange').value = Math.round(state.zoom * 100);
    $('zoomRange').addEventListener('input', function (ev) { setZoom(parseFloat(ev.target.value) / 100); });
    $('btnZoomIn').addEventListener('click', function () { setZoom(state.zoom * 1.2); });
    $('btnZoomOut').addEventListener('click', function () { setZoom(state.zoom / 1.2); });
    $('btnZoomFit').addEventListener('click', zoomToFit);
    $('btnZoom100').addEventListener('click', function () { setZoom(1); });

    initCanvasInteraction();
    initHistory();

    // -- export
    $('btnExportPng').addEventListener('click', exportPng);
    $('btnExportSvg').addEventListener('click', exportSvg);

    // -- saved poster
    var resetBtn = $('btnResetPoster'), resetArm = null;
    // two-step, no modal: the first press arms it, a second within 4 s resets
    function disarmReset() {
      clearTimeout(resetArm); resetArm = null;
      resetBtn.textContent = 'Reset poster'; resetBtn.classList.remove('armed');
    }
    resetBtn.addEventListener('click', function () {
      if (!resetArm) {
        resetBtn.textContent = 'Click again to reset';
        resetBtn.classList.add('armed');
        resetArm = setTimeout(disarmReset, 4000);
        return;
      }
      disarmReset();
      checkpoint('Reset poster');
      resetPoster();
    });
    resetBtn.addEventListener('blur', disarmReset);
    window.addEventListener('pagehide', flushPersist);
    // Narrow layout: the export bar is pinned over the bottom of the page, so
    // a control that takes focus underneath it is scrolled clear (browsers
    // only promise "into view", which the pinned bar may still cover).
    document.addEventListener('focusin', function (ev) {
      var bar = document.querySelector('.control-bar'), t = ev.target;
      if (!bar || !t || !t.getBoundingClientRect || bar.contains(t)) return;
      if (getComputedStyle(bar).position !== 'sticky') return;
      requestAnimationFrame(function () {
        var r = t.getBoundingClientRect(), top = bar.getBoundingClientRect().top;
        if (!r.height || r.bottom <= top - 8) return;
        // clear the bar, but never push the control's own top off screen
        var dy = Math.min(r.bottom - top + 16, r.top - 8);
        if (dy > 0) window.scrollBy(0, dy);
      });
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) flushPersist(); });

    // -- boot
    syncControls();
    fitPendingRows();
    renderBigRowCards();
    cachedContour = computeContour(false);
    zoomToFit();
    paint(cachedContour);
    if (restored && state.fontSource === 'upload' && !state.uploadedFont && restoredFontName) {
      toast('Poster restored. Upload ' + restoredFontName + ' again: font files aren\u2019t saved', 5000);
    } else if (!reportMissing()) toastOverflowOnce();
    // small text in a webfont that isn't loaded yet would draw in the fallback
    state.smallBlocks.forEach(function (b) { loadFontThen(b, function () { paint(cachedContour); }); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { paint(cachedContour); });
    window.addEventListener('resize', function () { paint(cachedContour); });
    persistReady = true;
  }

  // --------------------------------------------------------------- exports
  // Exports must not inherit the on-screen zoom or the selection chrome, so
  // they render through a detached canvas of their own.
  function renderToCanvas(result, scale) {
    var W = state.canvasW, H = state.canvasH;
    var c = document.createElement('canvas');
    c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    var ctx = c.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (!state.bgTransparent) { ctx.fillStyle = state.bg; ctx.fillRect(0, 0, W, H); }
    drawContour(ctx, result);
    drawSmallBlocks(ctx);
    return c;
  }

  // Browsers refuse canvases past ~16k px a side or ~268M px in all (and
  // then hand toBlob a null): keep a PNG export inside both.
  var PNG_MAX_SIDE = 16384, PNG_MAX_AREA = 2.6e8;
  function pngScaleFor(W, H, want) {
    var max = Math.min(Math.sqrt(PNG_MAX_AREA / (W * H)), PNG_MAX_SIDE / W, PNG_MAX_SIDE / H);
    return want <= max ? want : Math.floor(max * 100) / 100;
  }
  function exportPng() {
    var want = parseFloat($('exportScale').value) || 2;
    var scale = pngScaleFor(state.canvasW, state.canvasH, want);
    var loading = $('stageLoading');
    var done = function (msg, ms) { loading.classList.remove('show'); toast(msg, ms); };
    loading.classList.add('show');
    setTimeout(function () {
      try {
        var res = computeContour(true);
        renderToCanvas(res, scale).toBlob(function (blob) {
          try {
            if (!blob) {
              done('PNG export failed: the browser could not encode a ' +
                Math.round(state.canvasW * scale) + ' \u00d7 ' + Math.round(state.canvasH * scale) +
                ' px image. Try a lower export scale or SVG.', 5000);
              return;
            }
            dl(blob, safeName() + '.png');
            done(scale < want
              ? 'PNG exported at ' + scale + '\u00d7 (reduced from ' + want + '\u00d7: the browser\u2019s image size limit)'
              : 'PNG exported', scale < want ? 4200 : 2200);
          } catch (err) {
            console.error(err); done('PNG export failed: ' + err.message, 4000);
          }
        });
      } catch (err) {
        console.error(err); done('PNG export failed: ' + err.message, 3500);
      }
    }, 30);
  }

  // Traced rings are dense closed polylines. The SVG gets them as smooth
  // cubic Béziers through the same points (the same rule the Font tool's
  // export uses): each point's tangent runs parallel to its neighbours'
  // chord, and each segment's handles reach a third of its length along the
  // tangents at its ends. Curves stay smooth when scaled up in an editor
  // instead of showing every facet of the trace.
  function fmtN(v) { return String(Math.round(v * 100) / 100); }
  function ringToCubicD(r) {
    var n = r.length;
    // a repeated closing point would make a zero-length segment
    if (n > 3 && Math.abs(r[0][0] - r[n - 1][0]) < 1e-6 && Math.abs(r[0][1] - r[n - 1][1]) < 1e-6) n--;
    if (n < 3) {
      var dl = '';
      for (var k = 0; k < n; k++) dl += (k ? 'L' : 'M') + fmtN(r[k][0]) + ',' + fmtN(r[k][1]);
      return dl ? dl + 'Z' : '';
    }
    var tx = new Array(n), ty = new Array(n), i;
    for (i = 0; i < n; i++) {
      var a = r[(i - 1 + n) % n], b = r[(i + 1) % n];
      var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      tx[i] = len > 1e-9 ? dx / len : 0; ty[i] = len > 1e-9 ? dy / len : 0;
    }
    var d = 'M' + fmtN(r[0][0]) + ',' + fmtN(r[0][1]);
    for (i = 0; i < n; i++) {
      var j = (i + 1) % n, p = r[i], q = r[j];
      var L3 = Math.hypot(q[0] - p[0], q[1] - p[1]) / 3;
      d += 'C' + fmtN(p[0] + tx[i] * L3) + ',' + fmtN(p[1] + ty[i] * L3) +
        ' ' + fmtN(q[0] - tx[j] * L3) + ',' + fmtN(q[1] - ty[j] * L3) +
        ' ' + fmtN(q[0]) + ',' + fmtN(q[1]);
    }
    return d + 'Z';
  }
  function ringsToPathD(rings) {
    return rings.map(ringToCubicD).join('');
  }

  // Which characters each family actually has to render, so the export can ask
  // Google for exactly that subset.
  function usedGlyphsByFamily() {
    var map = {};
    state.smallBlocks.forEach(function (b) {
      var chars = map[b.font] || (map[b.font] = {});
      b.text.split('').forEach(function (ch) { if (ch !== '\n' && ch !== '\r') chars[ch] = 1; });
    });
    return map;
  }

  // Inline each family the poster uses as a base64 @font-face, so the exported
  // SVG renders identically on a machine that has never seen the font.
  //
  // The subset must be requested with `text=`: a plain css2 request returns one
  // @font-face per unicode-range (latin-ext first, then latin…), so grabbing
  // the first url() embeds a subset with no ASCII in it and the text silently
  // falls back to a generic mono wherever the font isn't already installed.
  function fetchFontFaceCSS(cb) {
    var used = usedGlyphsByFamily();
    var fams = Object.keys(used).filter(function (f) { return Object.keys(used[f]).length; });
    var out = [], pending = fams.length;
    if (!pending) return cb('');
    var timer = setTimeout(function () { pending = -1; cb(out.join('')); }, 8000);
    fams.forEach(function (fam) {
      var famName = fam.replace(/'/g, '').trim();
      var wt = fontWeight(fam);
      var text = Object.keys(used[fam]).sort().join('');
      var url = 'https://fonts.googleapis.com/css2?family=' +
        encodeURIComponent(famName).replace(/%20/g, '+') + ':wght@' + wt +
        '&text=' + encodeURIComponent(text);
      function done(css) {
        if (pending < 0) return;
        if (css) out.push(css);
        if (--pending === 0) { clearTimeout(timer); cb(out.join('')); }
      }
      fetch(url).then(function (r) {
        if (!r.ok) throw new Error('css ' + r.status);
        return r.text();
      }).then(function (css) {
        // The text= endpoint serves /l/font?kit=… with no file extension, so
        // match any https url inside url(), not just *.woff2.
        var m = css.match(/url\((https:\/\/[^)'"]+)\)/);
        if (!m) throw new Error('no font url');
        return fetch(m[1]).then(function (r2) {
          if (!r2.ok) throw new Error('font ' + r2.status);
          return r2.blob();
        });
      }).then(function (blob) {
        var reader = new FileReader();
        reader.onload = function () {
          done('@font-face{font-family:"' + famName + '";src:url(' + reader.result +
            ') format("woff2");font-weight:' + wt + ';}');
        };
        reader.onerror = function () { done(''); };
        reader.readAsDataURL(blob);
      }).catch(function (err) { console.warn('font embed failed for', famName, err); done(''); });
    });
  }

  function exportSvg() {
    $('stageLoading').classList.add('show');
    setTimeout(function () {
      var res;
      try { res = computeContour(true); }
      catch (err) {
        console.error(err); toast('SVG export failed: ' + err.message, 3500);
        $('stageLoading').classList.remove('show'); return;
      }

      var W = state.canvasW, H = state.canvasH;
      var bgRect = state.bgTransparent ? '' : '<rect width="100%" height="100%" fill="' + state.bg + '"/>';
      // One path group per row, mirroring how drawRowRings paints it.
      var strokeAttrs = 'fill="none" stroke="' + state.ink + '" stroke-width="' +
        state.strokeWidth + '" stroke-linejoin="round" stroke-linecap="round"';
      var pathEl = (res.rows || []).map(function (entry) {
        var row = entry.row, out = '';
        if (row.mode === 'filled') {
          var all = [];
          entry.levels.forEach(function (rings) { all = all.concat(rings); });
          return all.length
            ? '<path d="' + ringsToPathD(all) + '" fill="' + state.ink + '" fill-rule="evenodd" stroke="none"/>'
            : '';
        }
        entry.levels.forEach(function (rings, idx) {
          if (!rings.length) return;
          var split = idx === 0 ? splitPockets(row, rings) : { line: rings, solid: [] };
          if (split.line.length) out += '<path d="' + ringsToPathD(split.line) + '" ' + strokeAttrs + '/>';
          if (split.solid.length) {
            out += '<path d="' + ringsToPathD(split.solid) + '" fill="' + state.ink + '" fill-rule="nonzero" stroke="none"/>';
          }
        });
        return out;
      }).join('');

      var anchorOf = { left: 'start', center: 'middle', right: 'end' };
      var textEls = state.smallBlocks.map(function (b) {
        var t = blockLayout(b);
        var fam = b.font.replace(/"/g, "'");
        return t.lines.map(function (line, i) {
          return '<text x="' + t.x.toFixed(1) + '" y="' + (t.y + t.lh * i).toFixed(1) +
            '" text-anchor="' + (anchorOf[b.align] || 'start') +
            '" font-family="' + fam + ', monospace" font-size="' + b.size +
            '" font-weight="' + fontWeight(b.font) + '" fill="' + (b.color || state.ink) + '">' + escapeXml(line) + '</text>';
        }).join('');
      }).join('');

      fetchFontFaceCSS(function (faceCss) {
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
          (faceCss ? '<style>' + faceCss + '</style>' : '') + bgRect + pathEl + textEls + '</svg>';
        dl(new Blob([svg], { type: 'image/svg+xml' }), safeName() + '.svg');
        $('stageLoading').classList.remove('show');
        toast('SVG exported' + (faceCss ? '' : ' (small text font referenced by name only)'));
      });
    }, 30);
  }

  init();
})();
