// ---------------------------------------------------------------------------
// Diacritic composition, shared by the Font tool and the Poster tool.
//
// Accented letters are never drawn by hand. A key like 'Ấ' is decomposed
// (Unicode NFD, plus a couple of letters NFD leaves alone, like Đ) into a base
// glyph and a list of marks, and each mark is itself an ordinary node-chain
// glyph, editable like any letter. Marks fall into three zones:
//
//   top     floats above the base (acute, grave, hook, tilde, circumflex, breve)
//   bottom  floats below it (dot below)
//   fused   melts into the base's own field (the horn of Ơ Ư, the bar of Đ)
//
// Floating marks are traced on their own and translated into place, so the
// smooth-min melt can never bridge them into the letter: a diacritic that has
// fused onto its base stops reading as a diacritic. Their vertical position is
// measured from real ink (base ink top, previous mark's ink top), so the gaps
// hold under every Flow-state preset and after any node edit.
// ---------------------------------------------------------------------------
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.GlyphCompose = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GRAVE = '\u0300', ACUTE = '\u0301', CIRC = '\u0302', TILDE = '\u0303',
      BREVE = '\u0306', HOOK = '\u0309', HORN = '\u031B', DOT = '\u0323',
      BAR = '\u0335', DIAER = '\u0308', RING = '\u030A', CARON = '\u030C',
      CEDIL = '\u0327', OGON = '\u0328', DOTA = '\u0307', MACRON = '\u0304';

  var MARKS = {};
  MARKS[ACUTE] = { zone: 'top', name: 'Acute', vi: 'sắc' };
  MARKS[GRAVE] = { zone: 'top', name: 'Grave', vi: 'huyền' };
  MARKS[HOOK]  = { zone: 'top', name: 'Hook above', vi: 'hỏi' };
  MARKS[TILDE] = { zone: 'top', name: 'Tilde', vi: 'ngã' };
  MARKS[DOT]   = { zone: 'bottom', name: 'Dot below', vi: 'nặng' };
  MARKS[CIRC]  = { zone: 'top', name: 'Circumflex', vi: 'mũ' };
  MARKS[BREVE] = { zone: 'top', name: 'Breve', vi: 'trăng' };
  MARKS[HORN]  = { zone: 'fused', name: 'Horn', vi: 'móc' };
  MARKS[BAR]   = { zone: 'fused', name: 'Stroke', vi: 'gạch' };
  // beyond Vietnamese: the marks that unlock most other Latin capitals
  MARKS[DIAER] = { zone: 'top', name: 'Diaeresis', vi: 'hai chấm' };
  MARKS[RING]  = { zone: 'top', name: 'Ring above', vi: 'khuyên' };
  MARKS[CARON] = { zone: 'top', name: 'Caron', vi: 'mũ ngược' };
  MARKS[DOTA]  = { zone: 'top', name: 'Dot above', vi: 'chấm trên' };
  MARKS[MACRON] = { zone: 'top', name: 'Macron', vi: 'gạch trên' };
  MARKS[CEDIL] = { zone: 'bottom', name: 'Cedilla', vi: 'móc dưới' };
  MARKS[OGON]  = { zone: 'bottom', name: 'Ogonek', vi: 'đuôi' };
  var MARK_ORDER = [ACUTE, GRAVE, HOOK, TILDE, DOT, CIRC, BREVE, HORN, BAR, DIAER, RING, CARON, DOTA, MACRON, CEDIL, OGON];
  // cedilla and ogonek hang right off the foot instead of a gap below it,
  // and the ogonek sits at the right foot rather than the centre
  var TIGHT_BOTTOM = {}; TIGHT_BOTTOM[CEDIL] = 1; TIGHT_BOTTOM[OGON] = 1;
  var RIGHT_FOOT = {}; RIGHT_FOOT[OGON] = 1;

  // letters NFD does not split
  var EXTRA = { 'Đ': 'D' + BAR, '\u00D0': 'D' + BAR };   // Ð (Icelandic eth) shares Đ's form

  // Where fused marks attach, in base-glyph units. Anything not listed falls
  // back to a guess from the base's ink box (see fusedAnchor).
  var FUSED_ANCHORS = {};
  FUSED_ANCHORS[HORN] = { O: [72, 15], U: [74, 7] };
  FUSED_ANCHORS[BAR] = { D: [20, 50] };

  // Vietnamese placement rules, all in glyph units (cap height = 100).
  // A tone after a circumflex sits beside it instead of on top, or the stack
  // would tower over the line: acute and hook to the right, grave mirrored to
  // the left (the usual Vietnamese convention). A circumflex or breve that
  // carries a tone is squashed to 80% height to keep the stack compact.
  var LAYOUT = {
    scale: 1,       // mark size relative to its drawn skeleton
    gapTop: 6,      // mark line (cap ink top) -> first mark ink bottom
    gapStack: 3,    // mark ink top -> next mark ink bottom
    gapBottom: 6,   // foot line (base ink bottom) -> dot-below ink top
    sideTuck: 3,    // tone beside circumflex: how far its ink tucks over the circumflex's outer edge
    sideRise: 0.55, // ...and where its ink bottom sits, as a fraction of the circumflex height
    squash: 0.8,    // height of a circumflex/breve that carries a tone
    clear: 3,       // a floating mark never comes closer than this to the base
  };
  var BESIDE_CIRC = {};
  BESIDE_CIRC[ACUTE] = 1; BESIDE_CIRC[HOOK] = 1; BESIDE_CIRC[GRAVE] = -1;
  var CARRIERS = {};
  CARRIERS[CIRC] = 1; CARRIERS[BREVE] = 1;

  var VIET_BASES = ['A', 'Ă', 'Â', 'E', 'Ê', 'I', 'O', 'Ô', 'Ơ', 'U', 'Ư', 'Y'];
  var TONES = ['', ACUTE, GRAVE, HOOK, TILDE, DOT];

  // Every precomposed Latin capital (Latin-1, Extended-A, Extended
  // Additional) whose decomposition this set of marks can build, minus the
  // Vietnamese ones — computed, so adding a mark skeleton adds its letters.
  function latinUpper(has) {
    var out = [], viet = {};
    vietnameseUpper().forEach(function (v) { viet[v] = 1; });
    [[0xC0, 0x24F], [0x1E00, 0x1EFF]].forEach(function (r) {
      for (var cp = r[0]; cp <= r[1]; cp++) {
        var c = String.fromCodePoint(cp);
        if (viet[c] || c.toUpperCase() !== c || c.toLowerCase() === c) continue;
        var p = plan(c, has);
        if (p && !p.simple) out.push(c);
      }
    });
    return out;
  }

  // All 67 uppercase Vietnamese letters outside ASCII, grouped by vowel.
  function vietnameseUpper() {
    var out = [];
    VIET_BASES.forEach(function (b) {
      TONES.forEach(function (t) {
        var c = (b + t).normalize('NFC');
        if (c.length === 1 && c.charCodeAt(0) > 127) out.push(c);
      });
    });
    out.push('Đ');
    return out;
  }

  function isMark(k) { return Object.prototype.hasOwnProperty.call(MARKS, k); }

  // Marks are a fraction of a stem's size, so the shape parameters have to be
  // scaled down with them: the full melt would round a hook into a blob, and
  // the full (negative) tension would shave a thin acute away to nothing.
  function traceOpts(key, opts) {
    if (!isMark(key) || MARKS[key].zone === 'fused') return opts;
    var o = {};
    for (var k in opts) o[k] = opts[k];
    o.melt = opts.melt * 0.4;
    o.tension = opts.tension * 0.55;
    return o;
  }
  function markChains(key, chains) {
    var s = LAYOUT.scale;
    if (!isMark(key) || MARKS[key].zone === 'fused' || s === 1) return chains;
    return chains.map(function (c) {
      return c.map(function (n) { var o = n.slice(); o[0] *= s; o[1] *= s; o[2] *= s; return o; });   // keeps a hard-union flag
    });
  }

  // Text -> display clusters: one base letter plus its combining marks, NFC,
  // uppercased (the design is caps-only, so lowercase input maps onto it).
  function clusters(text) {
    var out = [];
    var s = String(text == null ? '' : text).normalize('NFC');
    var raw = s.match(/\P{M}\p{M}*|\p{M}+/gu) || [];
    raw.forEach(function (c) {
      var up = c.toUpperCase().normalize('NFC');
      if (up === c || !/\P{M}.*\P{M}/u.test(up)) { out.push(up); return; }
      // ß -> SS and friends: the uppercase can be more than one letter
      (up.match(/\P{M}\p{M}*|\p{M}+/gu) || []).forEach(function (u) { out.push(u); });
    });
    return out;
  }

  // key -> { base, top:[], bottom:[], fused:[] } or null when it can't be built.
  // has(k) says whether a glyph or mark skeleton exists.
  function plan(key, has) {
    if (has(key) && !isMark(key)) return { base: key, top: [], bottom: [], fused: [], simple: true };
    var d = EXTRA[key] || key.normalize('NFD');
    var cps = Array.from(d);
    if (cps.length < 2) return null;
    var base = cps[0];
    if (EXTRA[base]) { cps = Array.from(EXTRA[base]).concat(cps.slice(1)); base = cps[0]; }
    if (!has(base) || isMark(base)) return null;
    var p = { base: base, top: [], bottom: [], fused: [] };
    for (var i = 1; i < cps.length; i++) {
      var m = cps[i];
      if (!isMark(m) || !has(m)) return null;
      p[MARKS[m].zone].push(m);
    }
    return p;
  }

  function bbox(rings) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (var i = 0; i < rings.length; i++) {
      var r = rings[i];
      for (var j = 0; j < r.length; j++) {
        var p = r[j];
        if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
        if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
      }
    }
    return x0 > x1 ? null : [x0, y0, x1, y1];
  }
  function shift(rings, dx, dy) {
    return rings.map(function (r) { return r.map(function (p) { return [p[0] + dx, p[1] + dy]; }); });
  }
  // keeps any 4th element: [x,y,r,1] starts a hard-unioned (unmelted) group
  function shiftChains(chains, dx, dy) {
    return chains.map(function (c) { return c.map(function (n) { var o = n.slice(); o[0] += dx; o[1] += dy; return o; }); });
  }

  function fusedAnchor(base, mark, plainBox) {
    var t = FUSED_ANCHORS[mark];
    if (t && t[base]) return t[base];
    if (!plainBox) return [0, 0];
    if (mark === HORN) return [plainBox[2] - 14, plainBox[1] + 18];
    if (mark === BAR) return [plainBox[0] + 18, (plainBox[1] + plainBox[3]) / 2];
    return [(plainBox[0] + plainBox[2]) / 2, plainBox[1]];
  }

  function squashRings(rings, k) {
    var b = bbox(rings);
    if (!b || k === 1) return rings;
    return rings.map(function (r) { return r.map(function (p) { return [p[0], b[3] - (b[3] - p[1]) * k]; }); });
  }
  // Highest / lowest ink of a ring set within a vertical band around x.
  function localExtent(rings, x, half) {
    var top = 1e9, bot = -1e9;
    for (var i = 0; i < rings.length; i++) {
      var r = rings[i];
      for (var j = 0; j < r.length; j++) {
        var p = r[j];
        if (Math.abs(p[0] - x) > half) continue;
        if (p[1] < top) top = p[1];
        if (p[1] > bot) bot = p[1];
      }
    }
    return [top, bot];
  }
  // Smallest distance from any vertex of one ring set to any edge of
  // another (and vice versa), within a band of interest. Used to keep each
  // floating mark at least LAYOUT.clear away from the letter and from the
  // marks already placed.
  function segDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    var t = l2 > 1e-9 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var ex = p[0] - a[0] - t * dx, ey = p[1] - a[1] - t * dy;
    return Math.sqrt(ex * ex + ey * ey);
  }
  function minGap(ra, rb, limit) {
    var ba = bbox(ra), bb = bbox(rb);
    if (!ba || !bb || ba[0] > bb[2] + limit || bb[0] > ba[2] + limit || ba[1] > bb[3] + limit || bb[1] > ba[3] + limit) return Infinity;
    // only geometry inside the overlap of the two boxes can be closest
    var bx = [Math.max(ba[0], bb[0]) - limit, Math.max(ba[1], bb[1]) - limit,
              Math.min(ba[2], bb[2]) + limit, Math.min(ba[3], bb[3]) + limit];
    function inBox(q) { return q[0] >= bx[0] && q[0] <= bx[2] && q[1] >= bx[1] && q[1] <= bx[3]; }
    function pts(R) { var o = []; R.forEach(function (r) { r.forEach(function (q) { if (inBox(q)) o.push(q); }); }); return o; }
    function edges(R) {
      var o = [];
      // an edge counts if its own box crosses the overlap box — a long flat
      // edge (the foot of an E) can pass under a mark with both ends outside
      R.forEach(function (r) {
        for (var k = 0; k < r.length; k++) {
          var a = r[k], b = r[(k + 1) % r.length];
          if (Math.max(a[0], b[0]) >= bx[0] && Math.min(a[0], b[0]) <= bx[2] &&
              Math.max(a[1], b[1]) >= bx[1] && Math.min(a[1], b[1]) <= bx[3]) o.push([a, b]);
        }
      });
      return o;
    }
    var best = Infinity;
    function scan(P, E) {
      for (var i = 0; i < P.length; i++) for (var j = 0; j < E.length; j++) {
        var d = segDist(P[i], E[j][0], E[j][1]);
        if (d < best) best = d;
      }
    }
    scan(pts(ra), edges(rb)); scan(pts(rb), edges(ra));
    return best;
  }
  // nudge a placed mark (dir -1 up, +1 down) until it clears every obstacle
  function settle(mr, ox, oy, dir, obstacles) {
    var placed = shift(mr, ox, oy);
    for (var it = 0; it < 6; it++) {
      var need = 0;
      obstacles.forEach(function (o) {
        var g = minGap(placed, o, LAYOUT.clear + 1);
        if (g < LAYOUT.clear) need = Math.max(need, LAYOUT.clear - g + 0.25);
      });
      if (!need) break;
      oy += dir * need;
      placed = shift(mr, ox, oy);
    }
    return { oy: oy, placed: placed };
  }

  // Build a composite.
  //   api.rings(k)              traced rings of a glyph/mark in its own space
  //   api.chains(k)             its node chains (only needed for fused marks)
  //   api.trace(chains, key)    trace base+fused chains as one melted field
  //   api.lines()               optional { cap, foot }: the cap-height ink top
  //                             and foot ink bottom of the whole font, so marks
  //                             share one line across letters (A's apex does
  //                             not lift its acute above É's)
  // Returns { rings, parts:[{key, ox, oy, zone}] } — parts say where every
  // component's own origin landed, so an editor can show and drag its nodes.
  function compose(key, api, has) {
    var p = plan(key, has);
    if (!p || p.simple) return null;
    var plain = api.rings(p.base);
    var pb = bbox(plain) || [0, 0, 92, 100];
    var parts = [{ key: p.base, ox: 0, oy: 0, zone: 'base' }];

    var baseRings = plain;
    if (p.fused.length) {
      var chains = api.chains(p.base).slice();
      p.fused.forEach(function (m) {
        var a = fusedAnchor(p.base, m, pb);
        parts.push({ key: m, ox: a[0], oy: a[1], zone: 'fused' });
        chains = chains.concat(shiftChains(api.chains(m), a[0], a[1]));
      });
      baseRings = api.trace(chains, p.base + p.fused.join(''));
    }
    var baseKey = p.base + p.fused.join('');
    var baseCount = baseRings.length;
    var bb = bbox(baseRings) || pb;
    var ax = (pb[0] + pb[2]) / 2;      // centred on the letter itself, not its horn
    var lines = api.lines ? api.lines() : null;
    var local = localExtent(baseRings, ax, 26);
    var out = baseRings.slice();

    var top = Math.min(local[0] < 1e8 ? local[0] : bb[1], lines ? lines.cap : 1e9);
    var prev = null, prevBox = null, obstacles = [baseRings];
    p.top.forEach(function (m, i) {
      var mr = api.rings(m);
      if (CARRIERS[m] && p.top[i + 1]) mr = squashRings(mr, LAYOUT.squash);
      var mb = bbox(mr);
      if (!mb) return;
      var ox, oy, side = prev === CIRC && BESIDE_CIRC[m];
      if (side) {
        // measured from the circumflex's ink: the tone's near edge tucks just
        // over the circumflex's outer edge, well clear of its apex
        ox = side > 0 ? prevBox[2] - LAYOUT.sideTuck - mb[0] : prevBox[0] + LAYOUT.sideTuck - mb[2];
        oy = prevBox[3] - (prevBox[3] - prevBox[1]) * LAYOUT.sideRise - mb[3];
      } else {
        ox = ax;
        oy = top - (prev ? LAYOUT.gapStack : LAYOUT.gapTop) - mb[3];
      }
      var st = settle(mr, ox, oy, -1, obstacles);
      oy = st.oy;
      out = out.concat(st.placed);
      obstacles.push(st.placed);
      parts.push({ key: m, ox: ox, oy: oy, zone: 'top' });
      prevBox = bbox(st.placed);
      if (prevBox[1] < top) top = prevBox[1];
      prev = m;
    });

    var bottom = Math.max(local[1] > -1e8 ? local[1] : bb[3], lines ? lines.foot : -1e9);
    p.bottom.forEach(function (m) {
      var mr = api.rings(m), mb = bbox(mr);
      if (!mb) return;
      var bx2 = RIGHT_FOOT[m] ? pb[2] - (mb[2] - mb[0]) * 0.6 : ax, st;
      // the foot under the mark itself: an ogonek under a round U or O must
      // hang from the curve there, not from the glyph's lowest point
      var foot = localExtent(baseRings, bx2 + (mb[0] + mb[2]) / 2, Math.max(4, (mb[2] - mb[0]) / 2))[1];
      var hasFoot = foot > -1e8 && foot > bb[3] - 0.12 * (bb[3] - bb[1]);
      if (TIGHT_BOTTOM[m] && hasFoot) {   // overlaps the foot slightly, so it reads attached
        var oy0 = foot - LAYOUT.clear - mb[1];
        st = { oy: oy0, placed: shift(mr, bx2, oy0) };
      } else {
        // nothing to attach to (Ķ Ņ Ŗ: the gap between the feet) — hang it
        // free below the foot line, like the Latvian comma below
        st = settle(mr, bx2, bottom + LAYOUT.gapBottom - mb[1], 1, [baseRings]);
      }
      out = out.concat(st.placed);
      parts.push({ key: m, ox: bx2, oy: st.oy, zone: 'bottom' });
      bottom = bbox(st.placed)[3];
    });

    // baseKey/baseCount let a renderer reuse the base outline (plain or
    // fused) and only add the floating marks: out.slice(baseCount)
    return { rings: out, parts: parts, baseKey: baseKey, baseRings: baseRings, baseCount: baseCount };
  }

  return {
    MARKS: MARKS,
    MARK_ORDER: MARK_ORDER,
    LAYOUT: LAYOUT,
    FUSED_ANCHORS: FUSED_ANCHORS,
    isMark: isMark,
    traceOpts: traceOpts,
    markChains: markChains,
    clusters: clusters,
    plan: plan,
    compose: compose,
    bbox: bbox,
    shift: shift,
    shiftChains: shiftChains,
    vietnameseUpper: vietnameseUpper,
    latinUpper: latinUpper,
  };
});
