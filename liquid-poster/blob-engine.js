// ---------------------------------------------------------------------------
// Metaball / SDF letterform engine.
//
// A glyph is a set of chains of NODES, each node carrying its own radius.
// Each chain is drawn as a smooth spline through its nodes (radius splined
// too -> variable stroke thickness), cut into short tapered capsules. The
// strokes are combined with a polynomial smooth-minimum, which makes the mass
// pool into the joints where strokes meet, exactly like a viscous liquid.
//
// Liquid terms make it flow rather than sit (all 0 = the plain field). Two
// are sliders, the rest ride with the Flow preset:
//  - flow (slider, 0-1): how much the surface moves. It scales
//      warp (preset): the whole field is read through a smooth,
//        low-frequency domain warp, so contours slide instead of fizzing;
//      neck (preset): strokes bead and neck along their length
//        (Plateau-Rayleigh), with a drop at free stroke ends (neckLattice);
//  - sag (preset): gravity -- the lower part of a glyph slides down and
//    spreads, low beads are fuller, strokes hang fuller near the foot;
//  - drip (slider, 0 = none): a few seeded drips from free stem feet and bar
//    tips (planDrips), shaped by dripForm (preset: 0 fat and short, 1 long
//    and thin); stretch (preset) runs the surface noise downward.
// None of them can clot a counter: beads are capped by the room around them,
// the warp is kept one-to-one, and drips only hang where they clear all
// other ink. Strokes that meet face to face pool into their joints, and two
// strokes facing across a gap melt only by a share of that gap.
//
// The resulting scalar field is contoured with marching squares and then
// Chaikin-smoothed, so every edge comes out round -- there are no straight
// lines or corners anywhere in the output by construction.
// ---------------------------------------------------------------------------
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.BlobEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- noise
  function hash2(ix, iy, seed) {
    var h = ix * 374761393 + iy * 668265263 + seed * 1274126177;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }
  function valueNoise(x, y, seed) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = x - ix, fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
    var c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
    return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
  }
  // A second lattice noise for the flow terms, with a full-range integer hash
  // (uniform in [0, 1)). With smoothstep interpolation its gradient is at
  // most 1.5 per lattice unit, which the Lipschitz bound in glyphRings uses.
  function hashU(ix, iy, seed) {
    var h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function flowNoise(x, y, seed) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = x - ix, fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var a = hashU(ix, iy, seed), b = hashU(ix + 1, iy, seed);
    var c = hashU(ix, iy + 1, seed), d = hashU(ix + 1, iy + 1, seed);
    return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
  }

  // ------------------------------------------------------------------ sdf
  // ------------------------------------------------------------ presets
  // The Flow states, shared by the Font tool and the Poster tool (the single
  // source of truth; both tools only keep a fallback copy). Melt is capped
  // per point (see makeField), so counters stay open even when the mass is
  // allowed to pool heavily at the joints. flow and drip are sliders; warp,
  // neck, sag, dripForm and stretch are the preset's own physics, so each
  // state keeps its character at any slider value.
  var PRESETS = {
    liquid:  { mass: 1.00, melt: 18, tension: -4,   wobble: 0.6, grain: 0.038, smooth: 2, res: 1.6,
               flow: 0.70, warp: 0.80, neck: 0.70, sag: 0.50, drip: 0.30, dripForm: 0.40, stretch: 1.2 },
    mercury: { mass: 1.02, melt: 22, tension: -2.5, wobble: 0,   grain: 0.045, smooth: 3, res: 1.6,
               flow: 0.75, warp: 0.25, neck: 1.00, sag: 0.15, drip: 0,    dripForm: 0.20, stretch: 1.0 },
    acid:    { mass: 0.98, melt: 15, tension: -3.5, wobble: 3.4, grain: 0.09,  smooth: 3, res: 1.5,
               flow: 0.85, warp: 0.90, neck: 0.30, sag: 0.30, drip: 0,    dripForm: 0.60, stretch: 1.0 },
    molten:  { mass: 1.14, melt: 24, tension: -1,   wobble: 0.6, grain: 0.035, smooth: 3, res: 1.6,
               flow: 0.50, warp: 0.60, neck: 0.60, sag: 1.00, drip: 0.35, dripForm: 0.10, stretch: 1.3 },
    bubble:  { mass: 1.14, melt: 10, tension: -1.5, wobble: 0,   grain: 0.045, smooth: 2, res: 1.6,
               flow: 0.40, warp: 0.50, neck: 0.90, sag: 0.10, drip: 0,    dripForm: 0.20, stretch: 1.0 },
    goo:     { mass: 1.04, melt: 20, tension: -2.5, wobble: 2.6, grain: 0.06,  smooth: 3, res: 1.5,
               flow: 0.80, warp: 0.75, neck: 0.70, sag: 0.80, drip: 0.55, dripForm: 0.90, stretch: 2.2 },
  };

  // ------------------------------------------------------------- skeleton
  // Chains are drawn through their nodes as a centripetal Catmull-Rom spline
  // (radius splined too), then cut into short tapered capsules, so a round
  // reads as one smooth stroke instead of a polygon with a bump at each node.
  // The editor's nodes are untouched: the spline passes through every one.
  //
  // A node where the stroke turns sharply (> ~75 deg) is a CORNER: the spline
  // breaks there and the two sides meet at an angle, filleted by the melt.
  // Between corners a stretch of chain is one PIECE, hard-unioned (no melt
  // inside a piece, hence no bulge at every sub-node); pieces then melt into
  // each other with the smooth-min. A chain whose first node carries a 4th
  // element 1 ([x, y, r, 1]) starts a new GROUP: groups never melt together
  // (hard union), which keeps the dot of ! ? ; : off its stem.
  //
  // Each capsule also carries the arc length of its ends along its chain
  // (sa sb) and the chain's index, so the stroke can neck and swell along
  // its length (see neckLattice); out.chains lists each chain's capsules,
  // its group and whether it is a drip.
  var STRIDE = 11;                        // ax ay ra bx by rb piece group sa sb chain
  var CORNER_LO = 60 * Math.PI / 180;     // turn below this: fully smooth
  var CORNER_HI = 90 * Math.PI / 180;     // turn above this: a hard corner
  var SUB_ANGLE = 11 * Math.PI / 180;     // max tangent turn per sub-span
  var SUB_MAX = 8;

  function smoothstep(a, b, x) {
    var t = (x - a) / (b - a);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t * (3 - 2 * t);
  }
  function turnAngle(a, b, c) {
    var ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
    var lu = Math.sqrt(ux * ux + uy * uy), lv = Math.sqrt(vx * vx + vy * vy);
    if (lu < 1e-9 || lv < 1e-9) return Math.PI;
    var cs = (ux * vx + uy * vy) / (lu * lv);
    return Math.acos(cs < -1 ? -1 : cs > 1 ? 1 : cs);
  }
  // Centripetal Catmull-Rom tangent at p1 for the span p1 -> p2, in span
  // parameter units (Barry-Goldman form), for x, y and r alike.
  function crTangent(p0, p1, p2, d01, d12) {
    var out = [0, 0, 0];
    for (var c = 0; c < 3; c++) {
      out[c] = d12 * ((p1[c] - p0[c]) / d01 - (p2[c] - p0[c]) / (d01 + d12) + (p2[c] - p1[c]) / d12);
    }
    return out;
  }

  function buildSkeleton(chains, mass) {
    var out = [], info = [];
    var piece = -1, group = 0, arc = 0, cid = 0;
    function push(a, b) {
      var l = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
      out.push(a[0], a[1], a[2], b[0], b[1], b[2], piece, group, arc, arc + l, cid);
      arc += l;
    }
    out.chains = info;
    for (var c = 0; c < chains.length; c++) {
      var ch = chains[c];
      if (!ch || !ch.length) continue;
      cid = info.length; arc = 0;
      if (ch[0].length > 3 && ch[0][3] === 1 && out.length) group++;
      // drip chains (planDrips) are flagged on the chain array itself
      info.push({ c0: out.length / STRIDE, c1: 0, len: 0, closed: false, group: group, drip: !!ch.drip });
      // scaled copy, consecutive duplicates collapsed
      var pts = [];
      for (var q = 0; q < ch.length; q++) {
        var nd = ch[q], p = [+nd[0], +nd[1], Math.max(0, nd[2] * mass)];
        var last = pts[pts.length - 1];
        if (last && Math.abs(last[0] - p[0]) < 1e-6 && Math.abs(last[1] - p[1]) < 1e-6) {
          if (p[2] > last[2]) last[2] = p[2];
        } else pts.push(p);
      }
      piece++;
      if (pts.length === 1) { push(pts[0], pts[0]); continue; }
      var n = pts.length;
      var closed = n >= 4 && Math.abs(pts[0][0] - pts[n - 1][0]) < 0.5 && Math.abs(pts[0][1] - pts[n - 1][1]) < 0.5;
      if (closed) { pts.pop(); n--; info[cid].closed = true; }
      var w = new Array(n);
      for (var i = 0; i < n; i++) {
        if (!closed && (i === 0 || i === n - 1)) w[i] = 1;
        else w[i] = smoothstep(CORNER_LO, CORNER_HI, turnAngle(pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n]));
      }
      if (closed) {
        // start a cornered loop at a corner, so its first and last spans
        // belong to different pieces only where the loop really breaks
        var rot = -1;
        for (var ci = 0; ci < n; ci++) if (w[ci] >= 0.5) { rot = ci; break; }
        if (rot > 0) { pts = pts.slice(rot).concat(pts.slice(0, rot)); w = w.slice(rot).concat(w.slice(0, rot)); }
      }
      var spans = closed ? n : n - 1;
      for (var s = 0; s < spans; s++) {
        var ia = s, ib = (s + 1) % n;
        if (s > 0 && w[ia] >= 0.5) piece++;
        var P1 = pts[ia], P2 = pts[ib];
        var chord = [P2[0] - P1[0], P2[1] - P1[1], P2[2] - P1[2]];
        var d12 = Math.sqrt(Math.sqrt(chord[0] * chord[0] + chord[1] * chord[1]));
        var m1 = chord, m2 = chord;
        if (w[ia] < 1) {
          var P0 = pts[(ia - 1 + n) % n];
          var d01 = Math.sqrt(Math.hypot(P1[0] - P0[0], P1[1] - P0[1]));
          var t1 = crTangent(P0, P1, P2, d01, d12);
          m1 = [t1[0] + (chord[0] - t1[0]) * w[ia], t1[1] + (chord[1] - t1[1]) * w[ia], t1[2] + (chord[2] - t1[2]) * w[ia]];
        }
        if (w[ib] < 1) {
          var P3 = pts[(ib + 1) % n];
          var d23 = Math.sqrt(Math.hypot(P3[0] - P2[0], P3[1] - P2[1]));
          // tangent at p2 = tangent of the reversed span at its start, negated
          var t2 = crTangent(P3, P2, P1, d23, d12);
          m2 = [-t2[0] + (chord[0] + t2[0]) * w[ib], -t2[1] + (chord[1] + t2[1]) * w[ib], -t2[2] + (chord[2] + t2[2]) * w[ib]];
        }
        // how far the tangent swings along the span decides the sub-spans
        var l1 = Math.hypot(m1[0], m1[1]), l2 = Math.hypot(m2[0], m2[1]);
        var phi = 0;
        if (l1 > 1e-9 && l2 > 1e-9) {
          var cs = (m1[0] * m2[0] + m1[1] * m2[1]) / (l1 * l2);
          phi = Math.acos(cs < -1 ? -1 : cs > 1 ? 1 : cs);
        }
        var sub = Math.max(1, Math.min(SUB_MAX, Math.ceil(phi / SUB_ANGLE - 1e-9)));
        var rlo = Math.min(P1[2], P2[2]), rhi = Math.max(P1[2], P2[2]);
        var prev = P1;
        for (var k = 1; k <= sub; k++) {
          var cur;
          if (k === sub) cur = P2;
          else {
            var u = k / sub, u2 = u * u, u3 = u2 * u;
            var h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
            var r = h00 * P1[2] + h10 * m1[2] + h01 * P2[2] + h11 * m2[2];
            cur = [h00 * P1[0] + h10 * m1[0] + h01 * P2[0] + h11 * m2[0],
                   h00 * P1[1] + h10 * m1[1] + h01 * P2[1] + h11 * m2[1],
                   r < rlo ? rlo : r > rhi ? rhi : r];
          }
          push(prev, cur);
          prev = cur;
        }
      }
    }
    for (var ii = 0; ii < info.length; ii++) {
      info[ii].c1 = ii + 1 < info.length ? info[ii + 1].c0 : out.length / STRIDE;
      info[ii].len = info[ii].c1 > info[ii].c0 ? out[(info[ii].c1 - 1) * STRIDE + 9] : 0;
    }
    return out;
  }

  // ------------------------------------------------------- necking / beads
  // A liquid thread doesn't keep one thickness: surface tension pulls it
  // into beads joined by thinner necks (the Plateau-Rayleigh instability).
  // Each chain gets a 1D lattice along its arc length whose points alternate
  // bulge / neck with seeded random strength; the radius is scaled by
  // 1 + m(s), m smoothstep-interpolated between lattice points (C1, so the
  // contour stays smooth). Open chains get an even number of cells, so both
  // terminals land on a bulge (a drop at every stroke end, and a pooled bead
  // where a stroke runs into another); loops get an even count that wraps.
  // Gravity (sag) makes the low beads fuller and the high necks thinner.
  //
  // A bead may only take a share (BEAD_ROOM) of the gap between its stroke
  // and the nearest other stroke, less the part of that gap the melt
  // bridges anyway (the smooth-min fuses surfaces closer than melt / 2): so
  // beads swell freely on the outside of a letter but can't clot a counter
  // or fuse two legs, and a stroke end buried in another stroke (the bar of
  // H, the arms of E at the stem) gets no bead at all.
  var NECK_WAVE = 25;     // glyph units from a bulge to the next neck
  var CURVE_WAVE = 0.6;   // a round's wavelength is up to 1 + this longer
  var INNER_CUT = 0.75;   // share of a bead/neck removed on a curve's inside
  var CURVE_DAMP = 0.35;  // ... and on its outside (rounds keep gentle lobes)
  var BEAD_ROOM = 0.4;
  var TERMINAL_MAX = 0.35;  // a stroke-end drop swells at most this much
  var TOP_END_DAMP = 0.6;   // an end pointing up keeps this share of its drop
  function neckLattice(sk, bb, neck, sag, seed, melt) {
    var bridge = 0.5 * (melt > 0 ? melt : 0) + 3;
    var info = sk.chains || [], ncap = sk.length / STRIDE;
    var U0 = new Float64Array(ncap), DU = new Float64Array(ncap), OFF = new Int32Array(ncap).fill(-1);
    var val = [], apos = 0, slope = 0;
    var top = bb[1], hh = Math.max(1e-6, bb[3] - bb[1]);
    var grav = Math.min(0.8, 0.6 * sag);
    // which side of each capsule is the inside of its curve (a counter, as
    // a rule), and how much the stroke bends there (CW). On the inside beads
    // and necks keep only 1 - INNER_CUT of their strength, on the outside
    // 1 - CURVE_DAMP (see makeField), and a round chain beads more slowly.
    var NX = new Float64Array(ncap), NY = new Float64Array(ncap), CW = new Float64Array(ncap);
    for (var cc = 0; cc < info.length; cc++) {
      var chn = info[cc], m0 = chn.c0, m1 = chn.c1, cnt = m1 - m0;
      if (cnt < 2 || chn.drip) continue;
      var raw = new Float64Array(cnt);
      for (var a = m0; a < m1; a++) {
        var oa = a * STRIDE, ux0 = sk[oa + 3] - sk[oa], uy0 = sk[oa + 4] - sk[oa + 1], ul = Math.hypot(ux0, uy0);
        if (ul < 1e-9) continue;
        ux0 /= ul; uy0 /= ul;
        var turn = 0;
        for (var side = -1; side <= 1; side += 2) {
          var b = a + side;
          if (b < m0 || b >= m1) { if (!chn.closed) continue; b = b < m0 ? m1 - 1 : m0; }
          var ob2 = b * STRIDE;
          if (sk[ob2 + 6] !== sk[oa + 6]) continue;           // across a corner: not a curve
          var vx0 = sk[ob2 + 3] - sk[ob2], vy0 = sk[ob2 + 4] - sk[ob2 + 1], vl = Math.hypot(vx0, vy0);
          if (vl < 1e-9) continue;
          var cr = side < 0 ? (vx0 * uy0 - vy0 * ux0) / vl : (ux0 * vy0 - uy0 * vx0) / vl;
          turn += Math.asin(Math.max(-1, Math.min(1, cr)));
        }
        raw[a - m0] = turn;
        // inward normal: to the left of travel when the chain turns left
        NX[a] = turn >= 0 ? -uy0 : uy0; NY[a] = turn >= 0 ? ux0 : -ux0;
      }
      for (var a2 = 0; a2 < cnt; a2++) {      // 1-2-1 smoothing along the chain
        var pa = a2 > 0 ? raw[a2 - 1] : chn.closed ? raw[cnt - 1] : raw[a2];
        var na = a2 < cnt - 1 ? raw[a2 + 1] : chn.closed ? raw[0] : raw[a2];
        CW[m0 + a2] = Math.min(1, Math.abs(pa + 2 * raw[a2] + na) / 4 / (10 * Math.PI / 180));
      }
    }
    // axis point, radius and height of chain ch at arc length s
    function at(ch, s) {
      var ci = ch.c0;
      while (ci < ch.c1 - 1 && sk[ci * STRIDE + 9] < s) ci++;
      var o = ci * STRIDE, sa = sk[o + 8], sb = sk[o + 9];
      var u = sb > sa ? Math.max(0, Math.min(1, (s - sa) / (sb - sa))) : 0;
      return [sk[o] + (sk[o + 3] - sk[o]) * u, sk[o + 1] + (sk[o + 4] - sk[o + 1]) * u, sk[o + 2] + (sk[o + 5] - sk[o + 2]) * u];
    }
    // surface gap from the stroke at p (radius r, chain c, arc s) to the
    // nearest stroke that isn't this one's own neighbourhood (drips aside:
    // the base glyph beads the same with Drip on or off)
    function room(p, c, s, L, closed) {
      var best = 1e9;
      for (var q = 0; q < ncap; q++) {
        var o = q * STRIDE;
        if (sk[o + 10] === c) {
          var ds = Math.abs((sk[o + 8] + sk[o + 9]) * 0.5 - s);
          if (closed) ds = Math.min(ds, L - ds);
          if (ds < 2.2 * (p[2] + sk[o + 2]) + 0.5 * (sk[o + 9] - sk[o + 8])) continue;
        } else if (info[sk[o + 10]].drip) continue;
        var bx = sk[o + 3] - sk[o], by = sk[o + 4] - sk[o + 1], l2 = bx * bx + by * by;
        var t = l2 > 1e-9 ? ((p[0] - sk[o]) * bx + (p[1] - sk[o + 1]) * by) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        var gap = Math.hypot(p[0] - sk[o] - bx * t, p[1] - sk[o + 1] - by * t) - p[2] - (sk[o + 2] + (sk[o + 5] - sk[o + 2]) * t);
        if (gap < best) best = gap;
      }
      return best;
    }
    // the outward direction's y at an open chain's end (e: 0 start, 1 end)
    function endDy(ch, e) {
      for (var q = e ? ch.c1 - 1 : ch.c0; q >= ch.c0 && q < ch.c1; q += e ? -1 : 1) {
        var o = q * STRIDE, ex = sk[o + 3] - sk[o], ey = sk[o + 4] - sk[o + 1], el = Math.hypot(ex, ey);
        if (el > 1e-6) return (e ? ey : -ey) / el;
      }
      return 0;
    }
    for (var c = 0; c < info.length; c++) {
      var ch = info[c], L = ch.len;
      if (ch.drip) continue;
      var mcw = 0;
      for (var qc = ch.c0; qc < ch.c1; qc++) mcw += CW[qc];
      mcw = ch.c1 > ch.c0 ? mcw / (ch.c1 - ch.c0) : 0;
      var wave = NECK_WAVE * (1 + CURVE_WAVE * mcw);
      if (!(L > 0.9 * wave) || ch.c1 - ch.c0 < 1) continue;
      var n = 2 * Math.round(L / (2 * wave));
      if (n < 2) n = ch.closed ? 2 : 1;
      var scale = n / L, off = val.length;
      // loops neck more gently: their beads face their own counter
      var amp = ch.closed ? neck * 0.6 : neck;
      for (var i = 0; i <= n; i++) {
        if (ch.closed && i === n) { val.push(val[off]); break; }
        var s = i / scale, p = at(ch, s);
        var vy = Math.max(0, Math.min(1, (p[1] - top) / hh));
        var mag = 0.45 + 0.55 * hashU(i, c * 31 + 7, seed);
        var v;
        if (n === 1) v = 0.55 * mag * (1 + grav * (2 * vy - 1));              // short stroke: two soft drops
        else if (i % 2 === 0) v = mag * (1 + grav * (2 * vy - 1));             // bead
        else v = -mag * (1 + grav * (1 - 2 * vy));                             // neck
        var m = amp * v;
        if (!ch.closed && (i === 0 || i === n) && m > 0) {
          // stroke-end drops: modest, and smaller on an end pointing up (the
          // tops of V W Y, the arms of K), so terminals don't turn into pins
          if (m > TERMINAL_MAX) m = TERMINAL_MAX;
          if (endDy(ch, i === 0 ? 0 : 1) < -0.5) m *= TOP_END_DAMP;
        }
        if (m > 0 && p[2] > 1e-6) {
          // the bead's reach: its own point and half a cell either side
          var g = room(p, c, s, L, ch.closed), hs = 0.5 / scale;
          if (s - hs > 0 || ch.closed) g = Math.min(g, room(at(ch, (s - hs + L) % L), c, (s - hs + L) % L, L, ch.closed));
          if (s + hs < L || ch.closed) g = Math.min(g, room(at(ch, (s + hs) % L), c, (s + hs) % L, L, ch.closed));
          var cap = Math.max(0, BEAD_ROOM * (g - bridge) / p[2]);
          if (m > cap) m = cap;
        }
        m = m < -0.42 ? -0.42 : m > 0.6 ? 0.6 : m;
        if (m > apos) apos = m;
        val.push(m);
      }
      val.push(val[val.length - 1]);           // sentinel for u == n exactly
      for (var q = ch.c0; q < ch.c1; q++) {
        var o2 = q * STRIDE;
        U0[q] = sk[o2 + 8] * scale; DU[q] = (sk[o2 + 9] - sk[o2 + 8]) * scale; OFF[q] = off;
      }
      ch.n = n;
    }
    var aabs = 0;
    for (var vi = 0; vi < val.length; vi++) aabs = Math.max(aabs, Math.abs(val[vi]));
    // the fullest bead on each capsule (for culling and the lazy test), and
    // the steepest radius slope dr/ds of any capsule, for the Lipschitz
    // bound: the taper (scaled by the fullest bead) plus the bead profile's
    // own slope
    var MP = new Float64Array(ncap);
    for (var p2 = 0; p2 < ncap; p2++) {
      if (OFF[p2] < 0) continue;
      var o3 = p2 * STRIDE, l = sk[o3 + 9] - sk[o3 + 8];
      var nn = info[sk[o3 + 10]].n, base = OFF[p2];
      var k0 = Math.max(0, Math.floor(U0[p2])), k1 = Math.min(nn - 1, Math.floor(U0[p2] + DU[p2]));
      var dmax = 0, mp = Math.max(0, val[base + k0]);
      for (var k = k0; k <= k1; k++) {
        dmax = Math.max(dmax, Math.abs(val[base + k + 1] - val[base + k]));
        mp = Math.max(mp, val[base + k + 1]);
      }
      MP[p2] = mp;
      if (l < 1e-6) continue;
      var rmax = Math.max(sk[o3 + 2], sk[o3 + 5]);
      var sl = Math.abs(sk[o3 + 5] - sk[o3 + 2]) / l * (1 + mp) + rmax * 1.5 * dmax * DU[p2] / l;
      if (sl > slope) slope = sl;
    }
    return { U0: U0, DU: DU, OFF: OFF, MP: MP, VAL: new Float64Array(val), apos: apos, slope: slope,
      NX: NX, NY: NY, CW: CW, aabs: aabs };
  }
  // The lattice of a drip-free skeleton, carried over to the same skeleton
  // with nIns drip capsules inserted at capsule index `at`: they get no
  // beads, so the base glyph beads exactly as it does with Drip off.
  function shiftLattice(nk, at, nIns) {
    var n1 = nk.OFF.length + nIns;
    function mv(A, T) {
      var B = new T(n1);
      for (var i = 0; i < n1; i++) B[i] = i < at ? A[i] : i < at + nIns ? 0 : A[i - nIns];
      return B;
    }
    var OFF = mv(nk.OFF, Int32Array);
    for (var j = at; j < at + nIns; j++) OFF[j] = -1;
    return { U0: mv(nk.U0, Float64Array), DU: mv(nk.DU, Float64Array), OFF: OFF, MP: mv(nk.MP, Float64Array),
      VAL: nk.VAL, apos: nk.apos, slope: nk.slope, NX: mv(nk.NX, Float64Array), NY: mv(nk.NY, Float64Array),
      CW: mv(nk.CW, Float64Array), aabs: nk.aabs };
  }

  // Legacy shape, kept for anything that inspected the capsule list:
  // [ax, ay, ra, bx, by, rb] per capsule (now post-subdivision).
  function buildCapsules(chains, mass) {
    var sk = buildSkeleton(chains, mass), caps = [];
    for (var i = 0; i < sk.length; i += STRIDE) caps.push(sk.slice(i, i + 6));
    return caps;
  }

  function skeletonBounds(sk) {
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (var i = 0; i < sk.length; i += STRIDE) {
      var ra = sk[i + 2], rb = sk[i + 5];
      minX = Math.min(minX, sk[i] - ra, sk[i + 3] - rb);
      maxX = Math.max(maxX, sk[i] + ra, sk[i + 3] + rb);
      minY = Math.min(minY, sk[i + 1] - ra, sk[i + 4] - rb);
      maxY = Math.max(maxY, sk[i + 1] + ra, sk[i + 4] + rb);
    }
    return [minX, minY, maxX, maxY];
  }

  // The warp's noise lattices over the traced area, hashed once: the warp
  // is so low-frequency that a glyph spans only a few cells. LX / LY hold
  // the two flow components in [-1, 1], LS the per-column sag in [0, 1].
  function warpTables(wp, bounds, seed) {
    var g = wp.g, gs = wp.gs, ws = (seed | 0) + 7919;
    var lx0 = Math.floor(bounds[0] * g) - 1, ly0 = Math.floor(bounds[1] * g) - 1;
    var lw = Math.floor(bounds[2] * g) + 3 - lx0, lh = Math.floor(bounds[3] * g) + 3 - ly0;
    var LX = new Float64Array(lw * lh), LY = new Float64Array(lw * lh);
    for (var y = 0; y < lh; y++) {
      for (var x = 0; x < lw; x++) {
        LX[y * lw + x] = hashU(x + lx0, y + ly0, ws) * 2 - 1;
        LY[y * lw + x] = hashU(x + lx0, y + ly0, ws + 1) * 2 - 1;
      }
    }
    var sx0 = Math.floor(bounds[0] * gs) - 1, sw = Math.floor(bounds[2] * gs) + 3 - sx0;
    var LS = new Float64Array(sw);
    for (var i = 0; i < sw; i++) LS[i] = hashU(i + sx0, 0, ws + 2);
    wp.ws = ws; wp.lx0 = lx0; wp.ly0 = ly0; wp.lw = lw; wp.lh = lh; wp.LX = LX; wp.LY = LY;
    wp.sx0 = sx0; wp.sw = sw; wp.LS = LS;
  }

  // ------------------------------------------------------------------ drips
  // A few drips, seeded and curated, so a word reads as melting without
  // turning into an icicle fringe. Only free stroke ends of the main group
  // can drip (a dot, a mark or punctuation never does; GlyphCompose turns
  // drips off there), in three kinds:
  //   FOOT     an end pointing down at the floor (stems, diagonal legs)
  //   LOWTIP   a level end in the bottom zone (L's bar, E's lower arm, 2)
  //            -- both hang below the baseline, at most DRIP_DEPTH_MAX deep
  //   HIGHTIP  a level end high in the glyph (T's bar, F's top arm, 7)
  //            -- only where an axis ray falls freely to the floor (never
  //            into a counter or a notch) with no ink above it (never from
  //            a bowl's underside or a middle arm, so P can't read as R),
  //            and the drop stops FLOOR_GAP above the floor.
  // An end buried in other ink (a junction) never drips, and every drip
  // keeps GAP_D of clear air to all other ink along its whole length.
  // Each drip is a uniform neck (no taper, so the Lipschitz bound holds)
  // plus a single-node drop, added as two ordinary chains right after the
  // main group, so the melt flares the neck out of the stroke and rounds the
  // drop into a teardrop; culling, bounds and padding include them as is.
  // Everything is hashed from the seed (never from res): nothing pops when
  // a slider is released.
  var DRIP_DEPTH_MAX = 30;   // a low drip hangs at most this far below its end's ink
  var DRIP_REACH = 100;      // neck length scale, glyph units
  function planDrips(sk, bb, nk, o) {
    var a = o.drip, f = o.dripForm, seed = o.seed | 0;
    var info = sk.chains || [], ncap = sk.length / STRIDE, h = bb[3] - bb[1];
    if (!(a > 0) || !info.length || h < 40) return null;
    if (hashU(17, 3, seed) >= Math.min(0.92, 1.3 * a)) return null;
    var k = o.melt > 0 ? o.melt : 0, ten = o.tension, wob = o.wobble, mass = o.mass > 0 ? o.mass : 1;
    var jf = o.jf || 0;
    var GAP_D = 0.5 * k + 3 + 0.75 * wob;
    var NECK_MIN = (3 + 0.35 * wob) * (1 + 0.5 * jf);
    var FLOOR_GAP = Math.max(10, 0.09 * h);
    var VAL = nk && nk.VAL, OFF = nk && nk.OFF, MPa = nk && nk.MP;
    // capsule boxes and radii at their fullest bead: clearance is in ink
    var BX0 = new Float64Array(ncap), BX1 = new Float64Array(ncap), BY0 = new Float64Array(ncap), BY1 = new Float64Array(ncap);
    var BR = new Float64Array(ncap), GRW = new Float64Array(ncap), m, p;
    var rFoot = 1e9;
    for (m = 0; m < ncap; m++) {
      p = m * STRIDE;
      GRW[m] = 1 + (MPa ? MPa[m] : 0);
      BX0[m] = Math.min(sk[p], sk[p + 3]); BX1[m] = Math.max(sk[p], sk[p + 3]);
      BY0[m] = Math.min(sk[p + 1], sk[p + 4]); BY1[m] = Math.max(sk[p + 1], sk[p + 4]);
      BR[m] = Math.max(sk[p + 2], sk[p + 5]) * GRW[m];
      if (sk[p + 1] + sk[p + 2] >= bb[3] - 3) rFoot = Math.min(rFoot, sk[p + 2]);
      if (sk[p + 4] + sk[p + 5] >= bb[3] - 3) rFoot = Math.min(rFoot, sk[p + 5]);
    }
    // ink the axis may meet low down without it being a counter's floor
    var floorHit = bb[3] - 1.1 * (rFoot < 1e9 ? rFoot : 10);
    function own(q, c, a0, a1) {          // capsule q is chain c within arc [a0, a1]
      var pq = q * STRIDE;
      if (sk[pq + 10] !== c) return false;
      var s0 = sk[pq + 8], s1 = sk[pq + 9];
      if (s1 >= a0 && s0 <= a1) return true;
      if (!info[c].closed) return false;
      var L = info[c].len;
      return (s1 + L >= a0 && s0 + L <= a1) || (s1 - L >= a0 && s0 - L <= a1);
    }
    // signed distance from (px, py) to the visible ink, leaving out chain c
    // within arc [a0, a1] (the stroke a drip hangs from); c < 0: nothing
    function inkDist(px, py, c, a0, a1) {
      var best = 1e9;
      for (var q = 0; q < ncap; q++) {
        var ox = px < BX0[q] ? BX0[q] - px : px > BX1[q] ? px - BX1[q] : 0;
        var oy = py < BY0[q] ? BY0[q] - py : py > BY1[q] ? py - BY1[q] : 0;
        if ((ox > oy ? ox : oy) - BR[q] - ten >= best) continue;
        if (c >= 0 && own(q, c, a0, a1)) continue;
        var pq = q * STRIDE, ax = sk[pq], ay = sk[pq + 1], bx = sk[pq + 3] - ax, by = sk[pq + 4] - ay;
        var l2 = bx * bx + by * by, t = l2 > 1e-9 ? ((px - ax) * bx + (py - ay) * by) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        var d = Math.hypot(px - ax - bx * t, py - ay - by * t) - (sk[pq + 2] + (sk[pq + 5] - sk[pq + 2]) * t) * GRW[q] - ten;
        if (d < best) best = d;
      }
      return best;
    }
    // candidate ends
    var cands = [];
    for (var c = 0; c < info.length; c++) {
      var C = info[c];
      if (C.closed || C.drip || C.group !== 0 || C.c1 - C.c0 < 1 || !(C.len > 0)) continue;
      for (var e = 0; e < 2; e++) {
        var ci = e === 0 ? C.c0 : C.c1 - 1, step = e === 0 ? 1 : -1, cj = ci, dx = 0, dy = 0, dl = 0;
        for (; cj >= C.c0 && cj < C.c1; cj += step) {
          p = cj * STRIDE; dx = sk[p + 3] - sk[p]; dy = sk[p + 4] - sk[p + 1]; dl = Math.hypot(dx, dy);
          if (dl > 1e-6) break;
        }
        if (!(dl > 1e-6)) continue;
        if (e === 0) { dx = -dx; dy = -dy; }
        dx /= dl; dy /= dl;
        p = ci * STRIDE;
        var x = e === 0 ? sk[p] : sk[p + 3], y = e === 0 ? sk[p + 1] : sk[p + 4], r = e === 0 ? sk[p + 2] : sk[p + 5];
        var aE = e === 0 ? 0 : C.len;
        var mE = nk && OFF[ci] >= 0 && C.n ? VAL[OFF[ci] + (e === 0 ? 0 : C.n)] : 0;
        var inkR = r * (1 + mE) + ten;
        if (inkR < 6) continue;
        var lowZ = y + r >= bb[3] - 0.12 * h, cls, w0;
        if (dy >= 0.6 && lowZ) { cls = 1; w0 = dy >= 0.9 ? 1 : 0.75; }
        else if (Math.abs(dy) <= 0.45 && lowZ) { cls = 2; w0 = 0.6; }
        else if (Math.abs(dy) <= 0.45 && y <= bb[1] + 0.6 * h) { cls = 3; w0 = 0.9; }
        else continue;
        var win = 2.5 * r;
        if (inkDist(x, y, c, aE - win, aE + win) + ten < -0.5 * r) continue;   // buried: a junction
        var id = c * 2 + e;
        cands.push({ c: c, x: x, y: y, r: r, dx: dx, inkR: inkR, cls: cls, aE: aE, win: win, id: id,
          w: w0 * (0.4 + 0.6 * hashU(id, 101, seed)) });
      }
    }
    if (!cands.length) return null;
    cands.sort(function (u, v) { return v.w - u.w || u.id - v.id; });

    function shape(cd) {
      var R1 = hashU(cd.id, 102, seed), R2 = hashU(cd.id, 103, seed), R3 = hashU(cd.id, 104, seed), R4 = hashU(cd.id, 105, seed);
      var high = cd.cls === 3, tip = cd.cls !== 1, inkR = cd.inkR, yy, d0;
      var rn = Math.max(NECK_MIN, inkR * (0.22 + 0.10 * (1 - f)));
      var rd = Math.max(rn + 2, inkR * (0.32 + 0.24 * (1 - f)) * (0.85 + 0.3 * R2));
      var Ln = DRIP_REACH * (0.03 + 0.11 * f + 0.05 * a) * (0.6 + 0.8 * R1) * (high ? 1.6 : 1);
      var xr = cd.x + (R3 - 0.5) * 0.4 * inkR * (tip ? 0.5 : 1);
      if (tip) xr += (cd.dx >= 0 ? 1 : -1) * 0.35 * inkR;
      var lim = Math.max(0, inkR - rn - 1);           // the neck leaves through the end's own ink
      xr = Math.max(cd.x - lim, Math.min(cd.x + lim, xr));
      var ox = xr - cd.x, yEdge = cd.y + Math.sqrt(Math.max(0, inkR * inkR - ox * ox));
      var inkBot = cd.y + inkR;
      if (high) {
        // the axis falls freely to the floor zone (never starts in a counter
        // or a notch), and no ink sits above the tip (no bowl underside, no
        // middle arm)
        for (yy = yEdge + 2; yy < floorHit; yy += 2) if (inkDist(xr, yy, cd.c, cd.aE - cd.win, cd.aE + cd.win) < 0.5) return null;
        for (yy = cd.y - inkR - 3; yy > cd.y - 0.5 * h; yy -= 3) if (inkDist(xr, yy, cd.c, cd.aE - cd.win, cd.aE + cd.win) < 0) return null;
      }
      var win2 = cd.win + rd;
      for (var fit = 0; fit < 8; fit++) {
        if (high) {
          d0 = yEdge + Ln + 2 * rd - 1 - (bb[3] + ten - FLOOR_GAP);
          if (d0 > 0) Ln -= d0;
        } else {
          d0 = yEdge + Ln + 2 * rd - 1 - inkBot - DRIP_DEPTH_MAX;
          if (d0 > 0) Ln -= d0;
        }
        if (Ln < 2) { rd -= 2 - Ln; Ln = 2; }
        if (rd < rn + 2) return null;
        // the drop drifts a little, but stays within the end's own width
        var jm = Math.max(0, inkR - rd - Math.abs(ox));
        var xd = xr + Math.max(-jm, Math.min(jm, (R4 - 0.5) * 0.25 * Ln));
        var yc = yEdge + Ln + rd - 1, yB = yc + rd, yN = yEdge + Ln, ok = true;
        for (yy = yEdge - Math.min(4, 0.5 * inkR); yy <= yB + 0.01 && ok; yy += 2) {
          var tt = (yy - cd.y) / Math.max(1e-6, yN - cd.y);
          var axx = yy >= yN ? xd : xr + (xd - xr) * (tt < 0 ? 0 : tt);
          var hw = rn, dyc = yy - yc;
          if (dyc * dyc < rd * rd) hw = Math.max(hw, Math.sqrt(rd * rd - dyc * dyc));
          if (inkDist(axx, yy, cd.c, cd.aE - win2, cd.aE + win2) < hw + GAP_D) ok = false;
        }
        if (ok) {
          var rnS = Math.max(0.5, (rn - ten) / mass), rdS = Math.max(0.5, (rd - ten) / mass);
          var neck = [[xr, cd.y, rnS], [xd, yN, rnS]], drop = [[xd, yc, rdS]];
          neck.drip = 1; drop.drip = 1;
          return { low: !high, kind: ['', 'foot', 'lowtip', 'hightip'][cd.cls], x: cd.x, y: cd.y, inkR: inkR,
            xr: xr, xd: xd, rn: rn, rd: rd, len: Ln, depth: yB - inkBot, chains: [neck, drop] };
        }
        if (fit % 2 === 0) Ln *= 0.75; else rd = Math.max(rn + 2, rd * 0.85);
      }
      return null;
    }
    var list = [];
    var want = hashU(29, 5, seed) < Math.max(0, Math.min(0.7, 2 * (a - 0.45))) ? 2 : 1;
    for (var i = 0; i < cands.length && list.length < want; i++) {
      var D = shape(cands[i]);
      if (!D) continue;
      if (list.length && Math.abs(list[0].xd - D.xd) < list[0].rd + D.rd + 2 * GAP_D + 6) continue;
      list.push(D);
    }
    return list.length ? list : null;
  }

  // The ink bottom of a glyph leaving its low drips out, measured exactly:
  // the lowest ring point outside every drip's band, and under each drip a
  // few columns probed down the drip-free field (field.noDrip). This is what
  // the tools set the baseline from, so drips never move a word's baseline.
  function computeFoot(rings, low, field, res, k) {
    var foot = -1e9, i, j, m, p, D;
    for (i = 0; i < rings.length; i++) {
      for (j = 0; j < rings[i].length; j++) {
        p = rings[i][j];
        if (p[1] <= foot) continue;
        var band = false;
        for (m = 0; m < low.length && !band; m++) {
          D = low[m];
          var hw = D.rd + 0.5 * k + 2;
          if (p[1] > D.y && p[0] > Math.min(D.xr, D.xd) - hw && p[0] < Math.max(D.xr, D.xd) + hw) band = true;
        }
        if (!band) foot = p[1];
      }
    }
    var nd = field.noDrip || field;
    for (m = 0; m < low.length; m++) {
      D = low[m];
      for (var s = -2; s <= 2; s++) {
        var x = D.x + s * 0.3 * D.inkR, y0 = D.y, y1 = y0;
        if (!(nd(x, y0) < 0)) continue;
        var out = false;
        for (var st = 0; st < 80; st++) {
          y1 = y0 + res;
          if (nd(x, y1) >= 0) { out = true; break; }
          y0 = y1;
        }
        if (!out) continue;
        for (var bi = 0; bi < 10; bi++) {
          var ym = (y0 + y1) * 0.5;
          if (nd(x, ym) < 0) y0 = ym; else y1 = ym;
        }
        var yb = (y0 + y1) * 0.5;
        if (yb > foot) foot = yb;
      }
    }
    return foot > -1e9 ? foot : null;
  }

  // The field: per point, each piece is the hard minimum of its capsules;
  // pieces are folded in with the sequential smooth-min (k = melt), and the
  // result is capped at one pairwise blend below the hard minimum, so a
  // counter ringed by many pieces can't be eaten by melt/4 over and over.
  //
  // Spatial culling: capsules are binned into a bucket grid, each bucket
  // listing only the capsules that can still change the field near the
  // contour there (bbox grown by `reach`). Anything farther is provably
  // irrelevant: its distance exceeds every in-bucket hard minimum that can
  // reach the zero level by more than the melt width.
  //
  // Liquid terms (all optional, all off by default):
  //  - nk (neckLattice): the radius of a capsule is scaled by 1 + m(s) along
  //    its chain. Evaluated lazily: a capsule whose distance minus its
  //    fullest possible bead can't beat its piece's minimum is skipped. A
  //    neck never thins the visible stroke below about NECK_FLOOR units (a
  //    stroke already that thin just doesn't neck), so thin settings can't
  //    snap a stroke in two.
  //  - opts.sagX: gravity on the cross-section. Below its axis a stroke is
  //    measured with dy shrunk by 1 / (1 + sagX * w), so it hangs fuller
  //    underneath: feet round into drops, bottom bars and bowls pool
  //    downward. w ramps from 0 at mid-height to 1 at the foot (by the
  //    capsule's centre), so a top bar or a bowl's upper arc never sags into
  //    the counter below it. Shrinking a coordinate can't raise the slope.
  //  - opts.warp: domain warp, applied around the whole field (see below).
  //  - opts.dLo / dHi: the drip capsules. The field then also keeps bucket
  //    lists without them, read by field.noDrip(x, y) (see computeFoot).
  var BUCKET = 8;
  var W_FACE = 0.45;    // strokes overlapping face to face still pool this much
  var GAP_W0 = 0.30;    // melt kept across a gap at its narrowest (crease roots round)
  var GAP_KEEP = 0.5;   // facing strokes melt across at most 1 - this of their gap
  var GAP_C0 = -0.5, GAP_C1 = -0.85;   // gradient cosines where the gap rule fades in
  var GAP_LIP = 0.2;    // the most the gap rule can steepen the field
  var NECK_FLOOR = 2.5, NECK_FLOOR_WOB = 0.6;   // thinnest necked stroke (ink radius)
  var PIN_LO = 0.4, PIN_H = 0.35;   // the warp's vertical slide near the baseline, and its fade height
  function makeField(sk, opts, bounds, nk) {
    var melt = opts.melt, tension = opts.tension;
    var wob = opts.wobble, grain = opts.grain, seed = opts.seed;
    // a stretched surface: lower noise frequency in y runs the wobble
    // downward (only lowers its slope, so lip still holds)
    var grainY = grain / (opts.stretch > 1 ? opts.stretch : 1);
    var res = opts.res || 1.7;
    var k = melt > 1e-6 ? melt : 0, kq = k * 0.25;
    var gapK = k > 0 ? 2 * (1 - GAP_KEEP) / k : 0, gapCS = 1 / (GAP_C0 - GAP_C1);
    var ncap = sk.length / STRIDE;
    var sagX = opts.sagX > 0 ? opts.sagX : 0;
    var nOn = !!nk;
    var U0 = nk && nk.U0, DU = nk && nk.DU, OFF = nk && nk.OFF, VAL = nk && nk.VAL, MP = nk && nk.MP;
    var NX = nk && nk.NX, NY = nk && nk.NY, CW = nk && nk.CW;
    // the neck floor, in capsule units (the noise and the warp can thin a
    // stroke further, hence their margins)
    var nfloor = (NECK_FLOOR + NECK_FLOOR_WOB * wob) * (1 + 0.5 * (opts.jf || 0)) - tension;
    // Exactness is needed wherever the hard minimum dh can still reach the
    // contour (dh <= T): within interpolation range of zero, or within the
    // coarse sampler's skip radius (see sampleGrid). Capsules farther than
    // T + melt from such a point cannot change its value.
    var lip = opts.lip || 1;
    var skip = lip * 0.5 * COARSE * res * Math.SQRT2;
    var T = tension + 0.75 * wob + kq + Math.max(2.5 * res, skip) + 0.5;
    var reach = Math.max(0, T) + k + 1;

    var AX = new Float64Array(ncap), AY = new Float64Array(ncap), RA = new Float64Array(ncap);
    var BX = new Float64Array(ncap), BY = new Float64Array(ncap), IL = new Float64Array(ncap);
    var DR = new Float64Array(ncap), PC = new Int32Array(ncap), GR = new Int32Array(ncap);
    var ISG = new Float64Array(ncap).fill(1);
    var stop = opts.bb ? opts.bb[1] : 0, sih = opts.bb ? 1 / Math.max(1e-6, opts.bb[3] - opts.bb[1]) : 0;
    for (var i = 0; i < ncap; i++) {
      var o = i * STRIDE;
      if (sagX > 0) ISG[i] = 1 / (1 + sagX * smoothstep(0.5, 0.95, ((sk[o + 1] + sk[o + 4]) * 0.5 - stop) * sih));
      AX[i] = sk[o]; AY[i] = sk[o + 1]; RA[i] = sk[o + 2];
      BX[i] = sk[o + 3] - sk[o]; BY[i] = sk[o + 4] - sk[o + 1];
      var l2 = BX[i] * BX[i] + BY[i] * BY[i];
      IL[i] = l2 > 1e-9 ? 1 / l2 : 0;
      DR[i] = sk[o + 5] - sk[o + 2];
      PC[i] = sk[o + 6]; GR[i] = sk[o + 7];
    }

    var gx0 = bounds[0], gy0 = bounds[1];
    var gw = Math.max(1, Math.ceil((bounds[2] - gx0) / BUCKET) + 1);
    var gh = Math.max(1, Math.ceil((bounds[3] - gy0) / BUCKET) + 1);
    var spans = new Int32Array(ncap * 4);
    for (var c = 0; c < ncap; c++) {
      // a bead can push this capsule's surface out by 1 + MP, and the sag
      // measures distance below its axis up to 1 / ISG times shorter
      var grow = (nOn ? 1 + MP[c] : 1) / ISG[c], reachG = reach / ISG[c];
      var o2 = c * STRIDE, ra = sk[o2 + 2] * grow, rb = sk[o2 + 5] * grow;
      var bx0 = Math.min(sk[o2] - ra, sk[o2 + 3] - rb) - reachG, bx1 = Math.max(sk[o2] + ra, sk[o2 + 3] + rb) + reachG;
      var by0 = Math.min(sk[o2 + 1] - ra, sk[o2 + 4] - rb) - reachG, by1 = Math.max(sk[o2 + 1] + ra, sk[o2 + 4] + rb) + reachG;
      spans[c * 4] = Math.max(0, Math.floor((bx0 - gx0) / BUCKET)); spans[c * 4 + 1] = Math.min(gw - 1, Math.floor((bx1 - gx0) / BUCKET));
      spans[c * 4 + 2] = Math.max(0, Math.floor((by0 - gy0) / BUCKET)); spans[c * 4 + 3] = Math.min(gh - 1, Math.floor((by1 - gy0) / BUCKET));
    }
    // bucket lists, ascending (so pieces stay contiguous), leaving out
    // capsules [xLo, xHi)
    function lists(xLo, xHi) {
      var cnt = new Int32Array(gw * gh + 1), cc, yy, xx;
      for (cc = 0; cc < ncap; cc++) {
        if (cc >= xLo && cc < xHi) continue;
        for (yy = spans[cc * 4 + 2]; yy <= spans[cc * 4 + 3]; yy++) for (xx = spans[cc * 4]; xx <= spans[cc * 4 + 1]; xx++) cnt[yy * gw + xx + 1]++;
      }
      for (var b = 1; b <= gw * gh; b++) cnt[b] += cnt[b - 1];
      var fill = cnt.slice(0, gw * gh), ix = new Int32Array(cnt[gw * gh]);
      for (cc = 0; cc < ncap; cc++) {
        if (cc >= xLo && cc < xHi) continue;
        for (yy = spans[cc * 4 + 2]; yy <= spans[cc * 4 + 3]; yy++) for (xx = spans[cc * 4]; xx <= spans[cc * 4 + 1]; xx++) ix[fill[yy * gw + xx]++] = cc;
      }
      return [cnt, ix];
    }
    var L0 = lists(0, 0), counts = L0[0], idx = L0[1];
    var far = reach - tension;   // a point with no capsule in reach is outside

    // Domain warp: the field is read at q = p - D(p), so the ink drawn at p
    // is the ink of q -- the whole letter slides along D. D is a smooth,
    // low-frequency vector noise (the surface flows instead of fizzing)
    // plus gravity: below the top SAG_TOP of the glyph the ink slides down
    // (more in some columns than others) and the foot spreads sideways,
    // like a candle melting onto the table. The flow's vertical part is
    // pinned to PIN_LO of itself near the baseline, so feet don't bounce
    // from letter to letter. glyphTrace keeps the map one-to-one (strokes
    // can't tear, counters can't close) and folds the most it can steepen
    // the field into o.lip.
    var wp = opts.warp, wOn = !!wp;
    var wax = 0, way = 0, wg = 0, wsa = 0, wgs = 0, wtop = 0, wih = 0, wsp = 0, wcx = 0, wihw = 0, ws = 0;
    var wpy = 0, wpi = 0;
    var lx0 = 0, ly0 = 0, lw = 0, lh = 0, LX = null, LY = null, sx0 = 0, sw = 0, LS = null;
    if (wOn) {
      if (!wp.LX) warpTables(wp, bounds, seed);
      wax = wp.ax; way = wp.ay; wg = wp.g; wsa = wp.sa; wgs = wp.gs; wtop = wp.top; wih = 1 / wp.h;
      wsp = wp.sp; wcx = wp.cx; wihw = 1 / wp.hw; ws = wp.ws;
      wpy = wp.pinY || 0; wpi = wp.pinInv || 0;
      lx0 = wp.lx0; ly0 = wp.ly0; lw = wp.lw; lh = wp.lh; LX = wp.LX; LY = wp.LY;
      sx0 = wp.sx0; sw = wp.sw; LS = wp.LS;
    }
    var vScale = 1 / (1 - SAG_TOP);

    // The pieces are folded in with a smooth-min whose fillet is weighted by
    // how the two surfaces meet (c = cos of the angle between gradients):
    //   crease (c ~ 0: an L corner, a bar leaving a stem): the full fillet;
    //   face to face (c -> 1: a shared corner node, a bar end inside a
    //     stem): still W_FACE of it, so joints swell into pools;
    //   across a gap (c < GAP_C0: a counter, the gap between H's legs, an
    //     acute crease): the melt bridges at most 1 - GAP_KEEP of the gap
    //     (GAP_W0 at its root, so a crease rounds instead of slivering).
    // The folded gradient is a blend of unit vectors, never renormalised:
    // midway between two facing strokes it shrinks toward zero, so c -> 0
    // and the next piece gets a clean weight instead of one that flips sign.
    //
    // Beads are evaluated lazily: a capsule's distance minus its fullest
    // bead (MP) is a lower bound, and the exact value is only needed if that
    // bound could still lower its piece's minimum below hard-min + melt. A
    // piece that stays above dh + k can't reach the fold (the running fold is
    // never above dh when a piece is folded) nor the hard minimum.
    // (Written out twice, inline, because this is the hot loop.)
    var field = function (px, py) {
      if (wOn) {
        var ux = px * wg, uy = py * wg, ix = Math.floor(ux), iy = Math.floor(uy);
        var fx = ux - ix, fy = uy - iy, qx = px, qy = py;
        var pin = (wpy - py) * wpi;
        pin = pin <= 0 ? PIN_LO : pin >= 1 ? 1 : PIN_LO + (1 - PIN_LO) * pin * pin * (3 - 2 * pin);
        ix -= lx0; iy -= ly0;
        if (ix >= 0 && iy >= 0 && ix < lw - 1 && iy < lh - 1) {
          var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), lo = iy * lw + ix;
          var na = LX[lo], nb = LX[lo + 1], nc = LX[lo + lw], nd = LX[lo + lw + 1];
          qx -= wax * ((na + (nb - na) * sx) * (1 - sy) + (nc + (nd - nc) * sx) * sy);
          na = LY[lo]; nb = LY[lo + 1]; nc = LY[lo + lw]; nd = LY[lo + lw + 1];
          qy -= way * pin * ((na + (nb - na) * sx) * (1 - sy) + (nc + (nd - nc) * sx) * sy);
        } else {
          qx -= wax * (2 * flowNoise(ux, uy, ws) - 1);
          qy -= way * pin * (2 * flowNoise(ux, uy, ws + 1) - 1);
        }
        var v = ((py - wtop) * wih - SAG_TOP) * vScale;
        if (v > 0 && (wsa > 0 || wsp > 0)) {
          // v^2, eased into a flat cap just below the lowest ink (C1)
          var vv = v <= 1 ? v * v : v < 1 + RAMP_C ? 1 + 2 * (v - 1) - (v - 1) * (v - 1) / RAMP_C : 1 + RAMP_C;
          var us = px * wgs, is = Math.floor(us), fs = us - is, n1;
          is -= sx0;
          if (is >= 0 && is < sw - 1) { fs = fs * fs * (3 - 2 * fs); n1 = LS[is] + (LS[is + 1] - LS[is]) * fs; }
          else n1 = flowNoise(us, 0, ws + 2);
          qy -= wsa * vv * (SAG_N0 + SAG_N1 * n1);
          // the spread's lever: x, eased into +-2/3 LEVER_C at the sides (C1)
          var X = (px - wcx) * wihw;
          X = X <= -LEVER_C ? -LEVER_C * 2 / 3 : X >= LEVER_C ? LEVER_C * 2 / 3 : X - X * X * X / (3 * LEVER_C * LEVER_C);
          qx -= wsp * vv * X;
        }
        px = qx; py = qy;
      }
      var gxi = Math.floor((px - gx0) / BUCKET), gyi = Math.floor((py - gy0) / BUCKET);
      if (gxi < 0 || gyi < 0 || gxi >= gw || gyi >= gh) return far;
      var cell = gyi * gw + gxi, s = counts[cell], e = counts[cell + 1];
      if (s === e) return far;
      var best = 1e9, dh = 1e9;
      var d = 1e9, gx = 0, gy = 0;               // folded value + its gradient
      var pm = 1e9, pdx = 0, pdy = 0, pl = 0;     // current piece: min + offset
      var curP = -1, curG = GR[idx[s]];
      var ad, h, bx, by, w, cw, sg;
      for (var q = s; q < e; q++) {
        var i = idx[q];
        var ax = AX[i], ay = AY[i];
        var t = ((px - ax) * BX[i] + (py - ay) * BY[i]) * IL[i];
        if (t < 0) t = 0; else if (t > 1) t = 1;
        var dx = px - ax - BX[i] * t, dy = py - ay - BY[i] * t;
        if (dy > 0) dy *= ISG[i];                // gravity: fuller underneath
        var len = Math.sqrt(dx * dx + dy * dy);
        var rr = RA[i] + DR[i] * t;
        var di = len - rr;                       // tapered-capsule distance
        var np = PC[i] !== curP;
        if (nOn) {
          var ob = OFF[i];
          if (ob >= 0) {
            var lb = di - rr * MP[i], lim = dh + k;
            if (!np && pm < lim) lim = pm;
            if (lb < lim) {
              var u = U0[i] + DU[i] * t, uc = u | 0, uf = u - uc, v0 = VAL[ob + uc];
              var mm = v0 + (VAL[ob + uc + 1] - v0) * uf * uf * (3 - 2 * uf), cwi = CW[i];
              if (rr > 1e-6) {
                if (cwi > 0) {
                  // on a curve, beads and necks fade: CURVE_DAMP on the outer
                  // surface up to INNER_CUT on the inner one (the counter)
                  var sn = (dx * NX[i] + dy * NY[i]) / (2 * rr) + 0.5;
                  sn = sn < 0 ? 0 : sn > 1 ? 1 : sn;
                  mm *= 1 - cwi * (CURVE_DAMP + (INNER_CUT - CURVE_DAMP) * sn);
                }
                var mf = nfloor / rr - 1;        // the neck floor (only ever raises m)
                if (mf > 0) mf = 0;
                if (mm < mf) mm = mf;
              }
              di = len - rr * (1 + mm);
            } else di = lb;
          }
        }
        if (np) {
          if (curP >= 0) {                       // fold the finished piece in
            ad = d > pm ? d - pm : pm - d;
            bx = pl > 1e-9 ? pdx / pl : 0; by = pl > 1e-9 ? pdy / pl : 0;
            if (ad >= k) { if (pm < d) { d = pm; gx = bx; gy = by; } }
            else {
              h = (k - ad) / k;
              cw = gx * bx + gy * by;
              if (cw >= 0) w = W_FACE + (1 - W_FACE) * (1 - cw);
              else if (cw >= GAP_C0) w = 1;
              else {
                sg = (GAP_C0 - cw) * gapCS; if (sg > 1) sg = 1; sg = sg * sg * (3 - 2 * sg);
                w = GAP_W0 + gapK * ((d > 0 ? d : 0) + (pm > 0 ? pm : 0));
                w = 1 + ((w > 1 ? 1 : w) - 1) * sg;
              }
              if (pm < d) { gx = gx * h * 0.5 + bx * (1 - h * 0.5); gy = gy * h * 0.5 + by * (1 - h * 0.5); d = pm; }
              else { gx = gx * (1 - h * 0.5) + bx * h * 0.5; gy = gy * (1 - h * 0.5) + by * h * 0.5; }
              d -= h * h * k * 0.25 * w;
            }
          }
          if (GR[i] !== curG) {                  // finished group: cap + hard union
            if (d < dh - kq) d = dh - kq;
            if (d < best) best = d;
            d = 1e9; dh = 1e9; gx = 0; gy = 0; curG = GR[i];
          }
          curP = PC[i]; pm = di; pdx = dx; pdy = dy; pl = len;
        } else if (di < pm) { pm = di; pdx = dx; pdy = dy; pl = len; }
        if (di < dh) dh = di;
      }
      ad = d > pm ? d - pm : pm - d;
      if (ad >= k) { if (pm < d) d = pm; }
      else {
        h = (k - ad) / k;
        cw = pl > 1e-9 ? (gx * pdx + gy * pdy) / pl : 0;
        if (cw >= 0) w = W_FACE + (1 - W_FACE) * (1 - cw);
        else if (cw >= GAP_C0) w = 1;
        else {
          sg = (GAP_C0 - cw) * gapCS; if (sg > 1) sg = 1; sg = sg * sg * (3 - 2 * sg);
          w = GAP_W0 + gapK * ((d > 0 ? d : 0) + (pm > 0 ? pm : 0));
          w = 1 + ((w > 1 ? 1 : w) - 1) * sg;
        }
        d = (pm < d ? pm : d) - h * h * k * 0.25 * w;
      }
      if (d < dh - kq) d = dh - kq;
      if (d < best) best = d;
      if (wob > 0) {
        // two octaves of drifting noise = molten, uneven surface
        var nz = valueNoise(px * grain, py * grainY, seed) - 0.5;
        nz += (valueNoise(px * grain * 2.3, py * grainY * 2.3, seed + 91) - 0.5) * 0.5;
        best += nz * wob;
      }
      return best - tension;
    };
    if (opts.dHi > opts.dLo) {
      var LN = lists(opts.dLo, opts.dHi);
      field.noDrip = function (x, y) {
        var c0 = counts, i0 = idx;
        counts = LN[0]; idx = LN[1];
        try { return field(x, y); } finally { counts = c0; idx = i0; }
      };
    }
    return field;
  }

  // -------------------------------------------------------- marching squares
  var CASES = [
    [], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
    [[2, 3]], [[2, 0]], [[0, 1], [2, 3]], [[2, 1]], [[1, 3]], [[1, 0]], [[0, 3]], [],
  ];

  // Sample the field on the grid. With a Lipschitz bound `lip` (|grad f| <=
  // lip, known for the capsule field) most of the grid is skipped: the field
  // is first sampled every COARSE cells, and a coarse cell whose corners all
  // sit farther from zero than lip * half its diagonal provably has no
  // contour inside, so its interior samples just take the corners' sign.
  //
  // The test recurses (a quadtree): a coarse cell that can't be skipped is
  // split in four at its midpoints, and each quarter is tested again with
  // its own, smaller radius, down to single cells. Near the contour that
  // evaluates the same samples as before; in the margin around it (where
  // a steeper field used to force whole coarse cells) most quarters skip.
  var COARSE = 4;
  function sampleGrid(field, x0, y0, hx, hy, nx, ny, lip) {
    var W = nx + 1, V = new Float64Array(W * (ny + 1));
    var i, j;
    if (!(lip > 0)) {
      for (j = 0; j <= ny; j++) for (i = 0; i <= nx; i++) V[j * W + i] = field(x0 + i * hx, y0 + j * hy);
      return V;
    }
    V.fill(NaN);
    var xs = [], ys = [];
    for (i = 0; i < nx; i += COARSE) xs.push(i);
    xs.push(nx);
    for (j = 0; j < ny; j += COARSE) ys.push(j);
    ys.push(ny);
    for (var b = 0; b < ys.length; b++) {
      for (var a = 0; a < xs.length; a++) V[ys[b] * W + xs[a]] = field(x0 + xs[a] * hx, y0 + ys[b] * hy);
    }
    var flats = [];                        // [i0, j0, i1, j1] proven contour-free
    function at(ii, jj) {
      var q = jj * W + ii;
      if (V[q] !== V[q]) V[q] = field(x0 + ii * hx, y0 + jj * hy);
      return V[q];
    }
    function refine(i0, j0, i1, j1) {
      if (i1 - i0 <= 1 && j1 - j0 <= 1) return;
      var c0 = V[j0 * W + i0], c1 = V[j0 * W + i1], c2 = V[j1 * W + i0], c3 = V[j1 * W + i1];
      var thr = lip * 0.5 * Math.sqrt((i1 - i0) * hx * (i1 - i0) * hx + (j1 - j0) * hy * (j1 - j0) * hy);
      if ((c0 > thr && c1 > thr && c2 > thr && c3 > thr) || (c0 < -thr && c1 < -thr && c2 < -thr && c3 < -thr)) {
        flats.push(i0, j0, i1, j1);
        return;
      }
      var im = (i0 + i1) >> 1, jm = (j0 + j1) >> 1;
      if (im > i0) { at(im, j0); at(im, j1); }
      if (jm > j0) { at(i0, jm); at(i1, jm); }
      if (im > i0 && jm > j0) at(im, jm);
      if (im > i0 && jm > j0) {
        refine(i0, j0, im, jm); refine(im, j0, i1, jm); refine(i0, jm, im, j1); refine(im, jm, i1, j1);
      } else if (im > i0) {
        refine(i0, j0, im, j1); refine(im, j0, i1, j1);
      } else {
        refine(i0, j0, i1, jm); refine(i0, jm, i1, j1);
      }
    }
    for (b = 0; b + 1 < ys.length; b++) {
      for (a = 0; a + 1 < xs.length; a++) refine(xs[a], ys[b], xs[a + 1], ys[b + 1]);
    }
    for (var f = 0; f < flats.length; f += 4) {
      var fi0 = flats[f], fj0 = flats[f + 1], fi1 = flats[f + 2], fj1 = flats[f + 3];
      var fill = V[fj0 * W + fi0];
      for (j = fj0; j <= fj1; j++) {
        for (i = fi0; i <= fi1; i++) {
          var q2 = j * W + i;
          if (V[q2] !== V[q2]) V[q2] = fill;
        }
      }
    }
    return V;
  }

  function contour(field, bounds, res, lip) {
    var x0 = bounds[0], y0 = bounds[1], x1 = bounds[2], y1 = bounds[3];
    // (a span that is a whole number of cells, as glyphTrace makes it, keeps
    // exactly that many despite rounding)
    var nx = Math.max(2, Math.ceil((x1 - x0) / res - 1e-6));
    var ny = Math.max(2, Math.ceil((y1 - y0) / res - 1e-6));
    var hx = (x1 - x0) / nx, hy = (y1 - y0) / ny;

    // sample grid once
    var V = sampleGrid(field, x0, y0, hx, hy, nx, ny, lip);

    var segs = [];
    function interp(va, vb, ax, ay, bx, by) {
      var t = va / (va - vb);
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    }

    for (var jj = 0; jj < ny; jj++) {
      for (var ii = 0; ii < nx; ii++) {
        var v00 = V[jj * (nx + 1) + ii];
        var v10 = V[jj * (nx + 1) + ii + 1];
        var v11 = V[(jj + 1) * (nx + 1) + ii + 1];
        var v01 = V[(jj + 1) * (nx + 1) + ii];
        var idx = (v00 < 0 ? 1 : 0) | (v10 < 0 ? 2 : 0) | (v11 < 0 ? 4 : 0) | (v01 < 0 ? 8 : 0);
        if (idx === 0 || idx === 15) continue;

        var cx0 = x0 + ii * hx, cy0 = y0 + jj * hy;
        var cx1 = cx0 + hx, cy1 = cy0 + hy;
        var E = [
          v00 !== v10 ? interp(v00, v10, cx0, cy0, cx1, cy0) : [cx0, cy0], // top
          v10 !== v11 ? interp(v10, v11, cx1, cy0, cx1, cy1) : [cx1, cy0], // right
          v11 !== v01 ? interp(v11, v01, cx1, cy1, cx0, cy1) : [cx1, cy1], // bottom
          v01 !== v00 ? interp(v01, v00, cx0, cy1, cx0, cy0) : [cx0, cy1], // left
        ];

        var cs = CASES[idx];
        // saddle disambiguation via the cell-centre sample
        if (idx === 5 || idx === 10) {
          var mid = field((cx0 + cx1) / 2, (cy0 + cy1) / 2);
          if ((idx === 5) === (mid >= 0)) cs = idx === 5 ? [[3, 2], [1, 0]] : [[0, 3], [2, 1]];
        }
        for (var s = 0; s < cs.length; s++) segs.push([E[cs[s][0]], E[cs[s][1]]]);
      }
    }
    return segs;
  }

  // ------------------------------------------------------------- stitching
  // Walk segments into closed rings WITHOUT assuming a consistent direction.
  // Marching-squares saddle cells can emit a segment wound opposite to its
  // neighbours; a head-to-tail-only walk stalls there and leaves the ring
  // open, which later renders as a straight chord across the glyph. Matching
  // either endpoint makes the trace robust — final winding is fixed later by
  // the containment pass anyway.
  function stitch(segs, tol) {
    var key = function (p) { return Math.round(p[0] / tol) * 4194304 + Math.round(p[1] / tol); };
    var ends = new Map();
    function add(k, rec) {
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push(rec);
    }
    for (var i = 0; i < segs.length; i++) {
      add(key(segs[i][0]), [i, 0]);
      add(key(segs[i][1]), [i, 1]);
    }

    var used = new Array(segs.length).fill(false);
    var rings = [];
    for (var s = 0; s < segs.length; s++) {
      if (used[s]) continue;
      used[s] = true;
      var ring = [segs[s][0], segs[s][1]];
      var startKey = key(segs[s][0]);
      var guard = 0, flipped = false, closedRing = false;
      while (guard++ < 200000) {
        var tail = ring[ring.length - 1];
        var tk = key(tail);
        if (tk === startKey && ring.length > 2) { closedRing = true; break; }
        var cand = ends.get(tk), nxt = -1, nend = 0;
        if (cand) {
          for (var c = 0; c < cand.length; c++) {
            if (!used[cand[c][0]]) { nxt = cand[c][0]; nend = cand[c][1]; break; }
          }
        }
        if (nxt < 0) {
          // Dead end. The seed segment may have started mid-contour, so turn
          // around and keep growing from the other end before giving up —
          // otherwise a contour gets shredded into orphan fragments.
          if (flipped) break;
          flipped = true;
          ring.reverse();
          startKey = key(ring[0]);
          continue;
        }
        used[nxt] = true;
        ring.push(segs[nxt][nend === 0 ? 1 : 0]);
      }
      // Keep every fragment, however short — repairChains reassembles them.
      // Dropping them here silently deletes whole limbs of a glyph.
      if (ring.length >= 2) rings.push(ring);
    }
    return rings;
  }

  // A single closed contour can still get split into open chains where the
  // shape pinches and four segment-ends meet in one cell. Reassemble by
  // repeatedly joining whichever two open chains have the nearest endpoints,
  // then closing what remains.
  function repairChains(chains, tol) {
    var d2 = function (a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return dx * dx + dy * dy; };
    var closed = [], open = [];
    for (var i = 0; i < chains.length; i++) {
      var c = chains[i];
      (d2(c[0], c[c.length - 1]) <= tol * tol ? closed : open).push(c);
    }

    var joined = true;
    while (joined && open.length > 1) {
      joined = false;
      var bestD = Infinity, bi = -1, bj = -1, mode = 0;
      for (var a = 0; a < open.length && !joined; a++) {
        for (var b = a + 1; b < open.length; b++) {
          var A = open[a], B = open[b];
          var cands = [
            [d2(A[A.length - 1], B[0]), 0],
            [d2(A[A.length - 1], B[B.length - 1]), 1],
            [d2(A[0], B[0]), 2],
            [d2(A[0], B[B.length - 1]), 3],
          ];
          for (var k = 0; k < 4; k++) {
            if (cands[k][0] < bestD) { bestD = cands[k][0]; bi = a; bj = b; mode = cands[k][1]; }
          }
        }
      }
      if (bi >= 0 && bestD <= tol * tol) {
        var A2 = open[bi], B2 = open[bj];
        var merged;
        if (mode === 0) merged = A2.concat(B2);
        else if (mode === 1) merged = A2.concat(B2.slice().reverse());
        else if (mode === 2) merged = A2.slice().reverse().concat(B2);
        else merged = B2.concat(A2);
        open.splice(bj, 1); open.splice(bi, 1);
        open.push(merged);
        joined = true;
      }
    }

    for (var m = 0; m < open.length; m++) {
      if (open[m].length > 4) closed.push(open[m]); // implicit close
    }
    return closed;
  }

  // --------------------------------------------------------------- smoothing
  function chaikin(ring, iters) {
    var pts = ring.slice();
    if (pts.length > 2) {
      var a = pts[0], b = pts[pts.length - 1];
      if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) pts.pop();
    }
    for (var it = 0; it < iters; it++) {
      var n = pts.length;
      if (n < 4) break;
      var out = new Array(n * 2);
      for (var i = 0; i < n; i++) {
        var p = pts[i], q = pts[(i + 1) % n];
        out[i * 2] = [p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25];
        out[i * 2 + 1] = [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75];
      }
      pts = out;
    }
    return pts;
  }

  // ------------------------------------------------------------- decimation
  // Chaikin quadruples the point count; thin it back out with Douglas-Peucker
  // so the contour stays smooth but exportable (font charstrings and polygon
  // maths both choke on thousands of near-collinear points).
  function pointSegDist2(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var l2 = dx * dx + dy * dy;
    var ex = p[0] - a[0], ey = p[1] - a[1];
    if (l2 < 1e-12) return ex * ex + ey * ey;
    var t = (ex * dx + ey * dy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    ex -= t * dx; ey -= t * dy;
    return ex * ex + ey * ey;
  }
  function dpChain(pts, first, last, tol, keep) {
    var tol2 = tol * tol;
    var stack = [first, last];
    while (stack.length) {
      var l = stack.pop(), f = stack.pop();
      if (l <= f + 1) continue;
      var maxD = -1, idx = -1, pf = pts[f], pl = pts[l];
      for (var i = f + 1; i < l; i++) {
        var d = pointSegDist2(pts[i], pf, pl);
        if (d > maxD) { maxD = d; idx = i; }
      }
      if (maxD > tol2) { keep[idx] = true; stack.push(f, idx, idx, l); }
    }
  }
  function decimateRing(ring, tol) {
    var n = ring.length;
    if (n < 8) return ring;
    var keep = new Array(n).fill(false);
    var anchor = 0, far = -1;
    for (var i = 1; i < n; i++) {
      var ex = ring[i][0] - ring[0][0], ey = ring[i][1] - ring[0][1], d = ex * ex + ey * ey;
      if (d > far) { far = d; anchor = i; }
    }
    keep[0] = true; keep[anchor] = true;
    dpChain(ring, 0, anchor, tol, keep);
    var tail = ring.slice(anchor).concat([ring[0]]);
    var tk = new Array(tail.length).fill(false);
    tk[0] = true; tk[tail.length - 1] = true;
    dpChain(tail, 0, tail.length - 1, tol, tk);
    for (var j = 1; j < tail.length - 1; j++) if (tk[j]) keep[anchor + j] = true;
    var out = [];
    for (var k = 0; k < n; k++) if (keep[k]) out.push(ring[k]);
    return out.length >= 6 ? out : ring;
  }

  // For curve output: fewer, longer segments. Points at horizontal and
  // vertical extremes are always kept (fonts want nodes there, and hinting
  // and rasterisers like them), Douglas-Peucker thins the rest between them;
  // ringToCubics then puts a smooth curve back through what is left.
  function simplifyForCurves(ring, tol) {
    var n = ring.length, i;
    if (n < 8) return ring;
    var keep = new Array(n).fill(false), idx = [];
    for (i = 0; i < n; i++) {
      var a = ring[(i + n - 1) % n], p = ring[i], b = ring[(i + 1) % n];
      if ((p[0] - a[0]) * (b[0] - p[0]) < 0 || (p[1] - a[1]) * (b[1] - p[1]) < 0) { keep[i] = true; idx.push(i); }
    }
    if (idx.length < 2) return decimateRing(ring, tol);
    for (var k = 0; k < idx.length; k++) {
      var f = idx[k], l = idx[(k + 1) % idx.length], seg = [];
      for (var j = f; ; j = (j + 1) % n) { seg.push(ring[j]); if (j === l) break; }
      var sk = new Array(seg.length).fill(false);
      sk[0] = true; sk[seg.length - 1] = true;
      dpChain(seg, 0, seg.length - 1, tol, sk);
      for (var m = 1; m < seg.length - 1; m++) if (sk[m]) keep[(f + m) % n] = true;
    }
    var out = [];
    for (i = 0; i < n; i++) if (keep[i]) out.push(ring[i]);
    return out.length >= 4 ? out : ring;
  }

  // ------------------------------------------------------------ orientation
  function signedArea(r) {
    var a = 0;
    for (var i = 0; i < r.length; i++) {
      var p = r[i], q = r[(i + 1) % r.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  }
  function pointInRing(pt, ring) {
    var inside = false, x = pt[0], y = pt[1];
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  // ------------------------------------------------------------- main entry
  // Shared tail of the pipeline: a scalar field + bounds go in, clean,
  // correctly-wound, hole-punched rings come out. Used both by the capsule
  // (hand-authored glyph) field below and by any other field a caller
  // constructs (e.g. a rasterized/blurred canvas alpha channel).
  function ringsFromField(field, bounds, o, debug) {
    var segs = contour(field, bounds, o.res, o.lip);
    if (!segs.length) return [];
    if (debug) {
      var raw = stitch(segs, o.res * 0.05);
      return { segs: segs.length, raw: raw.map(function (r) { return r.length; }),
               rawRings: raw, bounds: bounds };
    }
    // Rings smaller than minArea are specks: a pinhole counter the melt
    // almost closed, or a crumb of noise. glyphRings drops anything under
    // 30 u^2; traceField keeps its old near-zero threshold unless asked.
    var minArea = o.minArea == null ? 0.8 : o.minArea;
    var rings = repairChains(stitch(segs, o.res * 0.05), o.res * 4)
      .map(function (r) { return chaikin(r, o.smooth); })
      .map(function (r) { return o.simplify > 0 ? decimateRing(r, o.simplify) : r; })
      .filter(function (r) { return r.length > 5 && Math.abs(signedArea(r)) > minArea; });

    // Outer shells wound one way, counters the other, so a nonzero fill (what
    // OpenType uses) punches the holes correctly.
    return rings.map(function (r, i) {
      var depth = 0;
      for (var j = 0; j < rings.length; j++) {
        if (j !== i && pointInRing(r[0], rings[j])) depth++;
      }
      var wantPositive = depth % 2 === 0;
      var isPositive = signedArea(r) > 0;
      return isPositive === wantPositive ? r : r.slice().reverse();
    });
  }

  // chains: [[ [x, y, r(, flag)], ... ], ...]. A node's optional 4th element
  // 1 on a chain's FIRST node starts a detached group (see buildSkeleton);
  // plain [x, y, r] nodes behave exactly as before.
  //
  // glyphTrace returns { rings, foot, drips }: foot is the glyph's ink
  // bottom without its low drips (null when none hang below), which is what
  // a baseline should be measured from; drips counts them ({ low, high }).
  // glyphRings is the rings alone.
  function clamp01(v) { return v > 0 ? (v < 1 ? v : 1) : 0; }
  function glyphTrace(chains, opts) {
    opts = opts || {};
    var o = {
      mass: opts.mass == null ? 1 : opts.mass,
      melt: opts.melt == null ? 10 : opts.melt,
      tension: opts.tension == null ? 0 : opts.tension,
      wobble: opts.wobble == null ? 0 : opts.wobble,
      grain: opts.grain == null ? 0.045 : opts.grain,
      seed: opts.seed == null ? 1 : opts.seed,
      smooth: opts.smooth == null ? 2 : opts.smooth,
      res: opts.res == null ? 1.7 : opts.res,
      simplify: opts.simplify == null ? 0.3 : opts.simplify,
      minArea: opts.minArea == null ? 30 : opts.minArea,
      // liquid terms; a missing key is off
      flow: clamp01(opts.flow), warp: clamp01(opts.warp), neck: clamp01(opts.neck), sag: clamp01(opts.sag),
      drip: clamp01(opts.drip), dripForm: opts.dripForm == null ? 0.5 : clamp01(opts.dripForm),
      stretch: opts.stretch > 1 ? Math.min(3, opts.stretch) : 1,
    };
    chains = chains || [];
    var skB = buildSkeleton(chains, o.mass);
    if (!skB.length) return { rings: [], foot: null, drips: { low: 0, high: 0, list: [] } };
    // the glyph's frame, without drips: the warp, the gravity and the drip
    // rules all measure from it
    var bbB = skeletonBounds(skB);
    var bw = bbB[2] - bbB[0], bh = bbB[3] - bbB[1];

    // Domain warp (see makeField), scaled with the glyph so a small accent
    // isn't thrown about as far as a capital. Flow sets how far the surface
    // moves, the preset's warp and neck how that motion is shared.
    var sz = Math.max(0.25, Math.min(1, Math.max(bw, bh) / 130));
    var warpAmp = o.flow * WARP_MAX * o.warp;
    var neckAmp = Math.min(0.5, o.flow * NECK_MAX * o.neck);
    var wp = null, jf = 0, J = 1;
    if (warpAmp > 0 || o.sag > 0) {
      var wh = Math.max(20, bh);
      wp = {
        ax: 0.7 * warpAmp * sz, ay: warpAmp * sz, g: Math.max(0.012, Math.min(0.035, 0.012 + 0.12 * o.grain)),
        sa: SAG_W * o.sag * sz, sp: SAG_SPREAD * o.sag * sz, gs: SAG_GS,
        top: bbB[1], h: wh, cx: (bbB[0] + bbB[2]) / 2, hw: Math.max(15, bw / 2),
        pinY: bbB[3] - 0.05 * wh, pinInv: 1 / (PIN_H * wh),
      };
      // The warp's Jacobian J_D = J_flow + J_grav, bounded from the slopes of
      // its parts: |grad flowNoise| <= 1.5 per cell on a [-1, 1] lattice;
      // the baseline pin's slope <= (1 - PIN_LO) * 1.5 / (PIN_H * h) on the
      // vertical flow; the ramp w <= 1 + RAMP_C with 0 <= dw/dv <= 2; the
      // column factor in (0, N0 + N1], its slope <= N1 * 1.5 * gs; the lever
      // |X| <= 2/3 LEVER_C with 0 <= dX/dx <= 1 / hw.
      // Gravity only ever stretches: its diagonal entries (the slide's
      // d/dy, the spread's d/dx) are >= 0, so they can't steepen the field;
      // only its off-diagonal entries can. Hence
      //   |I - J_D| <= sigma_max([[1, Gxy], [Gyx, 1]]) + |J_flow|,
      // and the map is one-to-one because the symmetric part of I - J_D
      // stays positive definite (a strictly monotone map can't fold):
      //   1 - max(Gxx, Gyy) - (Gxy + Gyx) / 2 - |J_flow| > 0,
      // which FLOW_J + GRAV_J < 1 guarantees: amplitudes past either cap
      // are scaled back (the flow's two parts both scale with amplitude).
      var vy = 1 / ((1 - SAG_TOP) * wp.h), wmax = 1 + RAMP_C, lv = LEVER_C * 2 / 3;
      jf = 3 * wp.g * Math.hypot(wp.ax, wp.ay) + wp.ay * (1 - PIN_LO) * 1.5 * wp.pinInv;
      if (jf > FLOW_J) { wp.ax *= FLOW_J / jf; wp.ay *= FLOW_J / jf; jf = FLOW_J; }
      var gxx = wp.sp * wmax / wp.hw, gyy = wp.sa * 2 * vy * (SAG_N0 + SAG_N1);
      var gxy = wp.sp * 2 * vy * lv, gyx = wp.sa * wmax * SAG_N1 * 1.5 * wp.gs;
      var gr = Math.max(gxx, gyy) + (gxy + gyx) / 2;
      if (gr > GRAV_J) { var f = GRAV_J / gr; wp.sa *= f; wp.sp *= f; gxy *= f; gyx *= f; }
      // sigma_max of [[1, b], [c, 1]]
      var T2 = 2 + gxy * gxy + gyx * gyx, D2 = 1 - gxy * gyx;
      var sg = Math.sqrt((T2 + Math.sqrt(Math.max(0, T2 * T2 - 4 * D2 * D2))) / 2);
      J = sg + jf;
    }
    o.jf = jf;

    // beads on the drip-free skeleton, then the drips (none at Drip 0), then
    // the skeleton with the drips added right after the main group
    var nkB = neckAmp > 0 ? neckLattice(skB, bbB, neckAmp, o.sag, o.seed, o.melt) : null;
    var plan = o.drip > 0 ? planDrips(skB, bbB, nkB, o) : null;
    var sk = skB, nk = nkB, low = [];
    if (plan) {
      var at = -1, grp = 0, seen = false, add = [];
      for (var ci = 0; ci < chains.length; ci++) {
        var ch = chains[ci];
        if (!ch || !ch.length) continue;
        if (ch[0].length > 3 && ch[0][3] === 1 && seen) grp++;
        seen = true;
        if (grp === 0) at = ci;
      }
      plan.forEach(function (D) { add.push(D.chains[0], D.chains[1]); if (D.low) low.push(D); });
      sk = buildSkeleton(chains.slice(0, at + 1).concat(add, chains.slice(at + 1)), o.mass);
      var dLo = -1, dHi = -1;
      sk.chains.forEach(function (C) { if (C.drip) { if (dLo < 0) dLo = C.c0; dHi = C.c1; } });
      o.dLo = dLo; o.dHi = dHi;
      if (nkB) nk = shiftLattice(nkB, dLo, dHi - dLo);
    }

    var bb = skeletonBounds(sk);
    // Lipschitz bound of the field. Inside a capsule's slab the distance
    // gradient is perpendicular to the axis and the radius term's runs along
    // it, so |grad| <= sqrt(1 + (dr/ds)^2) with dr/ds the steepest taper or
    // bead slope (in the end caps it is 1; a drip's neck has no taper). The
    // sag's shrunken dy can only lower it. Plus the wobble's slope: hash2
    // never sets the top bit (an int32 x ^ (x >> 16) is never negative), so
    // valueNoise lies in [0, 0.5) and its slope is at most 1.5 * 0.5 per
    // lattice unit; the two octaves (x grain, x 2.3 grain at half weight)
    // give 0.75 + 0.86 = 1.61 * grain (a stretched y only lowers it). Plus
    // the gap rule's slope: across a gap d + pm is nearly constant, so it adds
    // at most GAP_LIP. All of it times the warp's |I - J_D|.
    var taper = 0, rmax = 0;
    for (var i = 0; i < sk.length; i += STRIDE) {
      var len = Math.hypot(sk[i + 3] - sk[i], sk[i + 4] - sk[i + 1]);
      if (len > 1e-9) taper = Math.max(taper, Math.abs(sk[i + 5] - sk[i + 2]) / len);
      rmax = Math.max(rmax, sk[i + 2], sk[i + 5]);
    }
    if (nk) taper = Math.max(taper, nk.slope);
    taper = Math.min(taper, 3);
    // the curve fade varies across the stroke: |d m_eff| <= |m| *
    // INNER_CUT / (2 r) per unit, times r -- it adds to the across-axis slope
    var across = 1 + (nk ? nk.aabs * INNER_CUT * 0.5 : 0);
    o.lip = Math.sqrt(across * across + taper * taper) * 1.02 + o.wobble * o.grain * 1.65 + (o.melt > 1e-6 ? GAP_LIP : 0);
    o.sagX = SAG_X * o.sag;
    o.bb = bbB;
    // headroom for melt bulge, tension inflation, noise displacement, beads,
    // the sag's fuller underside and the warp's slide
    var warpPad = wp ? wp.ax + wp.ay + (wp.sa * (SAG_N0 + SAG_N1) + wp.sp * LEVER_C * 2 / 3) * (1 + RAMP_C) : 0;
    var pad = o.melt * 0.5 + Math.abs(o.tension) + o.wobble + o.res * 3 +
      rmax * ((nk ? nk.apos : 0) + o.sagX * (1 + (nk ? nk.apos : 0))) + warpPad;
    // the far edges snap to whole cells from the near ones, so drips (which
    // only reach down) leave the base glyph's sampling grid where it was
    var x0 = Math.min(bb[0], bbB[0]) - pad, y0 = Math.min(bb[1], bbB[1]) - pad;
    var bounds = [x0, y0, x0 + Math.ceil((Math.max(bb[2], bbB[2]) + pad - x0) / o.res) * o.res,
      y0 + Math.ceil((Math.max(bb[3], bbB[3]) + pad - y0) / o.res) * o.res];
    if (wp) {
      warpTables(wp, bounds, o.seed);
      o.warp = wp;
      o.lip *= J;
    }
    if (opts._lip != null) o.lip = opts._lip;   // test hook: 0 samples every grid point

    var field = makeField(sk, o, bounds, nk);
    var rings = ringsFromField(field, bounds, o, opts._debug);
    var foot = low.length && Array.isArray(rings) ? computeFoot(rings, low, field, o.res, o.melt > 1e-6 ? o.melt : 0) : null;
    return { rings: rings, foot: foot, drips: { low: low.length, high: plan ? plan.length - low.length : 0, list: plan || [] } };
  }
  function glyphRings(chains, opts) { return glyphTrace(chains, opts).rings; }
  var WARP_MAX = 8;     // warp amplitude (glyph units) at Flow 1, warp 1
  var NECK_MAX = 0.4;   // neck amplitude at Flow 1, neck 1
  var SAG_X = 0.2;      // cross-section stretch below the axis at sag 1
  var SAG_W = 9;        // downward slide (glyph units) at the foot at sag 1
  var SAG_SPREAD = 5;   // sideways spread of the foot at sag 1
  var SAG_TOP = 0.3;    // the top of a glyph that gravity leaves alone
  var RAMP_C = 0.3;     // the ramp eases flat over v in [1, 1.3], below the ink
  var LEVER_C = 2.25;   // the spread's lever eases flat at 2.25 half-widths
  var SAG_N0 = 0.55, SAG_N1 = 0.9, SAG_GS = 0.011;   // per-column droop: range, frequency
  var FLOW_J = 0.35;    // cap on |J_flow|, the flow's Jacobian norm
  var GRAV_J = 0.45;    // cap on gravity's stretch + shear (FLOW_J + GRAV_J < 1)

  // Generic entry point: trace any scalar field(x,y) -> number (negative =
  // inside) over `bounds` = [x0,y0,x1,y1]. Lets callers build their own field
  // (e.g. from a rasterized/blurred canvas) and still get the same
  // marching-squares + stitch + repair + Chaikin + hole-punch treatment.
  function traceField(field, bounds, opts) {
    opts = opts || {};
    var o = {
      smooth: opts.smooth == null ? 2 : opts.smooth,
      res: opts.res == null ? 1.7 : opts.res,
      simplify: opts.simplify == null ? 0.3 : opts.simplify,
      minArea: opts.minArea,
    };
    return ringsFromField(field, bounds, o, opts._debug);
  }

  // ----------------------------------------------------------- curve output
  // Traced rings are polygons. For display and export each edge becomes one
  // cubic, tangent-continuous through every point: the tangent at a point
  // follows the chord between its neighbours, and each handle is a third of
  // its own edge long, so the uneven spacing Douglas-Peucker leaves (long
  // edges on flats, short ones on curves) can't make the curve overshoot.
  // Returns [[p0, c1, c2, p1], ...] for a closed ring.
  function ringToCubics(ring) {
    var n = ring.length, tan = new Array(n), out = new Array(n);
    for (var i = 0; i < n; i++) {
      var a = ring[(i + n - 1) % n], b = ring[(i + 1) % n];
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      tan[i] = [dx / l, dy / l];
    }
    for (var j = 0; j < n; j++) {
      var p = ring[j], q = ring[(j + 1) % n], tq = tan[(j + 1) % n];
      var h = Math.sqrt((q[0] - p[0]) * (q[0] - p[0]) + (q[1] - p[1]) * (q[1] - p[1])) / 3;
      out[j] = [p, [p[0] + tan[j][0] * h, p[1] + tan[j][1] * h], [q[0] - tq[0] * h, q[1] - tq[1] * h], q];
    }
    return out;
  }

  return {
    PRESETS: PRESETS,
    ringToCubics: ringToCubics,
    simplifyForCurves: simplifyForCurves,
    glyphRings: glyphRings,
    glyphTrace: glyphTrace,
    signedArea: signedArea,
    traceField: traceField,
    valueNoise: valueNoise,
    buildCapsules: buildCapsules,
  };
});
