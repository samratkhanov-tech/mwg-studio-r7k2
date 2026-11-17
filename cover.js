/*
 * Songlap Math Worksheet Generator — Cover Maker.
 *
 * Buyers design a commercial-looking book cover (their own title,
 * subtitle, grade label, author/brand name and highlight chips) in
 * one of four ready-made themes modelled on the bestselling kids'
 * math workbooks (School Zone "I Know It!", Spectrum Math, Sylvan
 * "Jumbo Math Success"): a huge friendly title, a bright grade
 * badge, a starburst "WITH ANSWER KEYS!" callout, a topic-chip row
 * and playful number / operator motifs — all drawn with SVG/CSS,
 * no external images and no faces.
 *
 * One layout function (coverLayout) produces abstract elements in a
 * 730 x 980 design space; two renderers consume it:
 *   - coverHTML  -> an inline SVG that scales to the preview, a
 *                   Letter page and an A4 page identically, and
 *                   becomes page 1 of the built book;
 *   - coverPlan  -> a pure canvas draw-plan (same op vocabulary as
 *                   png.js) for the ~300 DPI standalone PNG export,
 *                   executed by PNGExport.renderPlan.
 * The layout layer is pure, so the Node tests verify content and
 * geometry without a browser.
 */
(function (global) {
  'use strict';

  var DESIGN_W = 730, DESIGN_H = 980;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------- Themes ----------
   * bg: page background (also the PNG base fill and the letterbox
   * colour when the design is fitted onto the other paper size).
   * band: optional top series band { fill, text }.
   * titleFill / titleShadow: the big title and its offset "pop".
   * badge: the grade badge { fill, text }.
   * chip: highlight chips { fill, text, stroke }.
   * burst: starburst callout { fill, text }.
   * motif: colours cycled through the number/operator motif row.
   * confetti: scattered decoration colours. */
  var COVER_THEMES = [
    {
      id: 'sunshine', name: 'Sunshine Pop',
      bg: '#29a7e1', band: { fill: '#ff5d8f', text: '#ffffff' },
      titleFill: '#ffffff', titleShadow: '#1668a0',
      subtitleFill: '#ffffff',
      badge: { fill: '#ffd166', text: '#14232b' },
      chip: { fill: '#ffffff', text: '#1668a0', stroke: '#ffffff' },
      burst: { fill: '#ffd166', text: '#14232b' },
      pill: { fill: '#ff5d8f', text: '#ffffff' },
      authorFill: '#ffffff',
      motif: ['#ffd166', '#ff5d8f', '#7bd747', '#ffffff'],
      confetti: ['#ffd166', '#ff5d8f', '#7bd747', '#ffffff', '#1668a0']
    },
    {
      id: 'rainbow', name: 'Rainbow Classic',
      bg: '#ffffff', band: null,
      titleFill: '#14232b', titleShadow: '#ffd166',
      subtitleFill: '#48626e',
      badge: { fill: '#f4840b', text: '#ffffff' },
      chip: { fill: '#eef3f5', text: '#33505c', stroke: '#c8d6dc' },
      burst: { fill: '#f4840b', text: '#ffffff' },
      pill: { fill: '#2a9d8f', text: '#ffffff' },
      authorFill: '#33505c',
      motif: ['#e63946', '#f4840b', '#ffd166', '#2a9d8f', '#29a7e1'],
      confetti: ['#e63946', '#f4840b', '#ffd166', '#2a9d8f', '#29a7e1'],
      stripe: ['#e63946', '#f4840b', '#ffd166', '#7bd747', '#29a7e1', '#7b5ea7']
    },
    {
      id: 'jumbo', name: 'Jumbo Carnival',
      bg: '#ff7847', band: null,
      panel: { fill: '#fff7e6', stroke: '#d64533' },
      ribbon: { fill: '#ffd166', text: '#8a4b00' },
      titleFill: '#d64533', titleShadow: '#ffd9a8',
      subtitleFill: '#7a4a21',
      badge: { fill: '#2a7f62', text: '#ffffff' },
      chip: { fill: '#ffffff', text: '#d64533', stroke: '#f0c9a0' },
      burst: { fill: '#2a7f62', text: '#ffffff' },
      pill: { fill: '#d64533', text: '#ffffff' },
      authorFill: '#7a4a21',
      motif: ['#d64533', '#f4840b', '#2a7f62', '#29a7e1'],
      confetti: ['#ffd166', '#ffffff', '#2a7f62', '#d64533', '#29a7e1']
    },
    {
      id: 'teal', name: 'Teal & Gold',
      bg: '#0f2027', band: null,
      frame: { stroke: '#ffd166' },
      titleFill: '#ffd166', titleShadow: '#000000',
      subtitleFill: '#ffffff',
      badge: { fill: '#ffd166', text: '#14232b' },
      chip: { fill: '#203a43', text: '#ffffff', stroke: '#ffd166' },
      burst: { fill: '#e63946', text: '#ffffff' },
      pill: { fill: '#ffd166', text: '#14232b' },
      authorFill: '#ffffff',
      motif: ['#ffd166', '#ffffff', '#7bd747', '#29a7e1'],
      confetti: ['#ffd166', '#2c5364', '#ffffff', '#e63946']
    }
  ];

  function themeById(id) {
    for (var i = 0; i < COVER_THEMES.length; i++) {
      if (COVER_THEMES[i].id === id) return COVER_THEMES[i];
    }
    return COVER_THEMES[0];
  }

  /* ---------- Settings ---------- */

  var DEFAULT_COVER_SETTINGS = {
    title: 'Math Worksheets',
    subtitle: 'Addition • Subtraction • Multiplication • Division — with Answer Keys',
    grade: 'Grades 1–5',
    author: '',
    features: 'Money Skills • Fractions Fun • Word Problems • Answer Keys Included',
    theme: 'sunshine'
  };

  var CAPS = { title: 60, subtitle: 90, grade: 24, author: 40, features: 120 };

  /* Clean raw form/stored values into a safe settings object. */
  function normalizeCoverSettings(raw) {
    raw = raw || {};
    var out = {};
    Object.keys(DEFAULT_COVER_SETTINGS).forEach(function (k) {
      var v = raw[k];
      v = (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();
      out[k] = v || DEFAULT_COVER_SETTINGS[k];
      if (CAPS[k]) out[k] = out[k].slice(0, CAPS[k]);
    });
    out.author = (raw && raw.author != null)
      ? String(raw.author).replace(/\s+/g, ' ').trim().slice(0, CAPS.author) : '';
    out.theme = themeById(raw && raw.theme).id;
    return out;
  }

  /* Highlight chips: split the features line on • or commas, max 4. */
  function coverChips(settings) {
    return String(settings.features || '')
      .split(/[•,]/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; })
      .slice(0, 4);
  }

  /* ---------- Text fitting (shared by SVG + canvas) ----------
   * Average advance of the app's bold sans is ~0.58em; estimates are
   * deliberately a touch wide so fitted text never overflows. */
  function fitLines(text, size, maxWidth, maxLines) {
    var perLine = Math.max(4, Math.floor(maxWidth / (size * 0.58)));
    var words = String(text).split(/\s+/).filter(Boolean);
    var lines = [], cur = '';
    words.forEach(function (w) {
      while (w.length > perLine) { // hard-split an over-long word
        if (cur) { lines.push(cur); cur = ''; }
        lines.push(w.slice(0, perLine));
        w = w.slice(perLine);
      }
      if (!cur) cur = w;
      else if ((cur + ' ' + w).length <= perLine) cur += ' ' + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    return lines.slice(0, maxLines);
  }

  /* Pick the largest title size whose wrap fits maxLines lines. */
  function fitTitle(title) {
    var sizes = [78, 68, 58, 50, 44];
    for (var i = 0; i < sizes.length; i++) {
      var lines = fitLines(title, sizes[i], 600, 3);
      var widest = 0;
      lines.forEach(function (ln) { widest = Math.max(widest, ln.length * sizes[i] * 0.58); });
      if (lines.length <= 3 && widest <= 610) return { size: sizes[i], lines: lines };
    }
    return { size: 44, lines: fitLines(title, 44, 600, 3) };
  }

  /* Relative luminance (0..1) of a #rrggbb colour. */
  function luminance(hex) {
    var n = parseInt(String(hex).slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  function starPoints(cx, cy, rOuter, rInner, n, rotDeg) {
    var pts = [];
    var rot = (rotDeg || 0) * Math.PI / 180;
    for (var i = 0; i < n * 2; i++) {
      var r = i % 2 === 0 ? rOuter : rInner;
      var a = rot + i * Math.PI / n - Math.PI / 2;
      pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
    }
    return pts.join(' ');
  }

  /* ---------- Layout ----------
   * Returns { theme, width, height, els: [...] } in design units.
   * Element kinds: rect, circle, ring, line, poly, text, burst.
   * Text elements carry x/y as the CENTRE of the text (SVG uses
   * text-anchor:middle + dominant-baseline:middle; the canvas
   * renderer uses textAlign/textBaseline the same way). */
  function coverLayout(settings, opts) {
    opts = opts || {};
    var s = normalizeCoverSettings(settings);
    var th = themeById(s.theme);
    var els = [];
    function rect(x, y, w, h, fill, o) {
      o = o || {};
      els.push({ k: 'rect', x: x, y: y, w: w, h: h, fill: fill, rx: o.rx || 0,
        stroke: o.stroke || null, sw: o.sw || 0, opacity: o.opacity == null ? 1 : o.opacity });
    }
    function circle(cx, cy, r, fill, o) {
      o = o || {};
      els.push({ k: 'circle', cx: cx, cy: cy, r: r, fill: fill,
        stroke: o.stroke || null, sw: o.sw || 0, opacity: o.opacity == null ? 1 : o.opacity });
    }
    function text(x, y, str, size, fill, o) {
      o = o || {};
      els.push({ k: 'text', x: x, y: y, str: String(str), size: size, fill: fill,
        weight: o.weight || 700, spacing: o.spacing || 0,
        opacity: o.opacity == null ? 1 : o.opacity });
    }

    /* background */
    rect(0, 0, DESIGN_W, DESIGN_H, th.bg);

    /* theme furniture */
    if (th.stripe) { // Rainbow Classic: Spectrum-style left stripe
      th.stripe.forEach(function (c, i) { rect(i * 10, 0, 10, DESIGN_H, c); });
      rect(60, 0, 4, DESIGN_H, '#e8edf0');
    }
    if (th.panel) { // Jumbo Carnival: cream panel + rainbow rings
      rect(42, 108, DESIGN_W - 84, DESIGN_H - 170, th.panel.fill, { rx: 30, stroke: th.panel.stroke, sw: 4 });
      var ringCols = ['#e63946', '#f4840b', '#ffd166', '#7bd747', '#29a7e1'];
      ringCols.forEach(function (c, i) {
        els.push({ k: 'ring', cx: 365, cy: 108, r: 118 - i * 21, stroke: c, sw: 15 });
      });
      rect(215, 84, 300, 48, th.ribbon.fill, { rx: 10 });
      text(365, 109, '★ JUMBO WORKBOOK ★', 21, th.ribbon.text, { weight: 800 });
    }
    if (th.frame) { // Teal & Gold: inset gold frame + corner dots
      rect(24, 24, DESIGN_W - 48, DESIGN_H - 48, 'none', { stroke: th.frame.stroke, sw: 5, rx: 18 });
      [[24, 24], [DESIGN_W - 24, 24], [24, DESIGN_H - 24], [DESIGN_W - 24, DESIGN_H - 24]]
        .forEach(function (p) { circle(p[0], p[1], 11, th.frame.stroke); });
    }
    if (th.band) { // Sunshine Pop: School Zone-style series band
      rect(0, 0, DESIGN_W, 66, th.band.fill);
      text(365, 34, '★  MATH WORKBOOK  ★', 24, th.band.text, { weight: 800, spacing: 3 });
    }

    /* confetti: playful numbers and operators scattered in the
     * background (kept clear of the title block in the middle). */
    var confetti = [
      { x: 92, y: 150, t: '7' }, { x: 640, y: 168, t: '+' }, { x: 120, y: 560, t: '×' },
      { x: 618, y: 545, t: '3' }, { x: 70, y: 760, t: '÷' }, { x: 660, y: 730, t: '9' },
      { x: 150, y: 905, t: '−' }, { x: 585, y: 905, t: '=' }, { x: 350, y: 130, t: '5' }
    ];
    confetti.forEach(function (c, i) {
      text(c.x, c.y, c.t, 44, th.confetti[i % th.confetti.length], { weight: 800, opacity: 0.5 });
    });
    [[210, 120], [520, 120], [60, 420], [672, 420], [240, 930], [470, 80]].forEach(function (p, i) {
      circle(p[0], p[1], i % 2 ? 7 : 10, th.confetti[(i + 2) % th.confetti.length], { opacity: 0.55 });
    });

    /* grade badge — top right, Spectrum-style coloured box */
    var badgeW = Math.ceil(s.grade.length * 13.5) + 36;
    var badgeX = DESIGN_W - 34 - badgeW, badgeY = th.band ? 88 : 36;
    rect(badgeX, badgeY, badgeW, 52, th.badge.fill, { rx: 12 });
    text(badgeX + badgeW / 2, badgeY + 27, s.grade.toUpperCase(), 22, th.badge.text, { weight: 800 });

    /* title */
    var fit = fitTitle(s.title);
    var titleTop = th.panel ? 268 : 218;
    fit.lines.forEach(function (ln, i) {
      var y = titleTop + i * fit.size * 1.14 + fit.size / 2;
      text(368, y + 5, ln, fit.size, th.titleShadow, { weight: 800, opacity: 0.9 });
      text(365, y, ln, fit.size, th.titleFill, { weight: 800 });
    });
    var afterTitle = titleTop + fit.lines.length * fit.size * 1.14 + 26;

    /* subtitle (up to 2 lines) */
    var subLines = fitLines(s.subtitle, 25, 590, 2);
    subLines.forEach(function (ln, i) {
      text(365, afterTitle + i * 36 + 14, ln, 25, th.subtitleFill, { weight: 600 });
    });
    var afterSub = afterTitle + subLines.length * 36 + 30;

    /* motif row: big friendly operators and numbers in circles;
     * the glyph colour is chosen for contrast with its circle */
    var motif = ['+', '−', '×', '÷', '=', '7'];
    var mY = Math.max(afterSub + 44, 600);
    motif.forEach(function (g, i) {
      var cx = 133 + i * 93;
      var fill = th.motif[i % th.motif.length];
      circle(cx, mY, 34, fill);
      text(cx, mY + 2, g, 36, luminance(fill) > 0.62 ? '#14232b' : '#ffffff',
        { weight: 800 });
    });

    /* highlight chips (the Spectrum/School Zone topic list) */
    var chips = coverChips(s);
    var chipY = mY + 66;
    var rows = [chips.slice(0, 2), chips.slice(2, 4)].filter(function (r) { return r.length; });
    rows.forEach(function (row, ri) {
      var widths = row.map(function (c) { return Math.ceil(c.length * 12.4) + 40; });
      var total = widths.reduce(function (a, b) { return a + b; }, 0) + (row.length - 1) * 16;
      var x = (DESIGN_W - total) / 2;
      row.forEach(function (c, ci) {
        rect(x, chipY + ri * 54, widths[ci], 42, th.chip.fill, { rx: 21, stroke: th.chip.stroke, sw: 2 });
        text(x + widths[ci] / 2, chipY + ri * 54 + 22, c, 20, th.chip.text, { weight: 700 });
        x += widths[ci] + 16;
      });
    });
    var afterChips = chipY + rows.length * 54 + 18;

    /* starburst callout + worksheet-count pill */
    var burstY = Math.max(afterChips + 58, 838);
    els.push({ k: 'burst', cx: 592, cy: burstY, r: 76,
      fill: th.burst.fill, textFill: th.burst.text });
    if (opts.count > 0) {
      var pillText = opts.count + (opts.count === 1 ? ' WORKSHEET INSIDE!' : ' WORKSHEETS INSIDE!');
      var pillW = Math.ceil(pillText.length * 12.4) + 44;
      rect(66, burstY - 26, pillW, 52, th.pill.fill, { rx: 26 });
      text(66 + pillW / 2, burstY + 1, pillText, 20, th.pill.text, { weight: 800 });
    }

    /* author / brand */
    if (s.author) text(365, 934, 'by ' + s.author, 25, th.authorFill, { weight: 600 });

    return { theme: th, width: DESIGN_W, height: DESIGN_H, els: els,
      settings: s, burstLines: ['WITH', 'ANSWER KEYS!'] };
  }

  /* ---------- SVG renderer (preview + book page 1) ---------- */

  function elToSVG(el) {
    switch (el.k) {
      case 'rect':
        return '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
          '" rx="' + el.rx + '" fill="' + el.fill + '"' +
          (el.stroke ? ' stroke="' + el.stroke + '" stroke-width="' + el.sw + '"' : '') +
          (el.opacity !== 1 ? ' opacity="' + el.opacity + '"' : '') + '/>';
      case 'circle':
        return '<circle cx="' + el.cx + '" cy="' + el.cy + '" r="' + el.r + '" fill="' + el.fill + '"' +
          (el.stroke ? ' stroke="' + el.stroke + '" stroke-width="' + el.sw + '"' : '') +
          (el.opacity !== 1 ? ' opacity="' + el.opacity + '"' : '') + '/>';
      case 'ring':
        return '<circle cx="' + el.cx + '" cy="' + el.cy + '" r="' + el.r +
          '" fill="none" stroke="' + el.stroke + '" stroke-width="' + el.sw + '"/>';
      case 'line':
        return '<line x1="' + el.x1 + '" y1="' + el.y1 + '" x2="' + el.x2 + '" y2="' + el.y2 +
          '" stroke="' + el.color + '" stroke-width="' + el.lw + '"/>';
      case 'poly':
        return '<polygon points="' + el.points + '" fill="' + el.fill + '"/>';
      case 'text':
        return '<text x="' + el.x + '" y="' + el.y + '" text-anchor="middle" ' +
          'dominant-baseline="middle" font-size="' + el.size + '" font-weight="' + el.weight + '"' +
          (el.spacing ? ' letter-spacing="' + el.spacing + '"' : '') +
          ' fill="' + el.fill + '"' +
          (el.opacity !== 1 ? ' opacity="' + el.opacity + '"' : '') + '>' + esc(el.str) + '</text>';
      default:
        return '';
    }
  }

  function burstSVG(layout) {
    var b = null;
    layout.els.forEach(function (el) { if (el.k === 'burst') b = el; });
    if (!b) return '';
    return '<g transform="rotate(-12 ' + b.cx + ' ' + b.cy + ')">' +
      '<polygon points="' + starPoints(b.cx, b.cy, b.r, b.r * 0.8, 16) + '" fill="' + b.fill + '"/>' +
      '<text x="' + b.cx + '" y="' + (b.cy - 17) + '" text-anchor="middle" dominant-baseline="middle" ' +
      'font-size="19" font-weight="700" fill="' + b.textFill + '">WITH</text>' +
      '<text x="' + b.cx + '" y="' + (b.cy + 10) + '" text-anchor="middle" dominant-baseline="middle" ' +
      'font-size="24" font-weight="800" fill="' + b.textFill + '">ANSWER</text>' +
      '<text x="' + b.cx + '" y="' + (b.cy + 38) + '" text-anchor="middle" dominant-baseline="middle" ' +
      'font-size="24" font-weight="800" fill="' + b.textFill + '">KEYS!</text></g>';
  }

  /* The cover as a self-contained SVG inside a wrapper that fills
   * its container (preview box or book cover page). The SVG scales
   * with preserveAspectRatio="meet", so one design fits the screen
   * preview, Letter and A4 identically; the wrapper carries the
   * theme background colour so any letterbox blends in. */
  function coverHTML(settings, opts) {
    var layout = coverLayout(settings, opts);
    var parts = [];
    layout.els.forEach(function (el) { if (el.k !== 'burst') parts.push(elToSVG(el)); });
    parts.push(burstSVG(layout));
    return '<div class="cv-wrap cv-' + layout.theme.id + '" style="background:' + layout.theme.bg + '">' +
      '<svg class="cv-svg" viewBox="0 0 ' + DESIGN_W + ' ' + DESIGN_H + '" ' +
      'preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" ' +
      'role="img" aria-label="' + esc(layout.settings.title) + ' — book cover">' +
      parts.join('') + '</svg></div>';
  }

  /* ---------- Canvas plan (standalone PNG, ~300 DPI) ---------- */

  var PNG_SIZES = {
    letter: { w: 2550, h: 3300 },
    a4: { w: 2480, h: 3508 }
  };
  var PNG_FONT = 'Arial, Helvetica, sans-serif';

  /* Map the design layout onto a print-size canvas with a uniform
   * scale (letterboxed, centred — same fit as the SVG "meet"). */
  function coverPlan(settings, opts) {
    opts = opts || {};
    var dims = PNG_SIZES[opts.size] || PNG_SIZES.letter;
    var layout = coverLayout(settings, opts);
    var scale = Math.min(dims.w / DESIGN_W, dims.h / DESIGN_H);
    var ox = (dims.w - DESIGN_W * scale) / 2;
    var oy = (dims.h - DESIGN_H * scale) / 2;
    var plan = { type: 'cover', theme: layout.theme.id, width: dims.w, height: dims.h,
      ops: [{ t: 'bg', color: layout.theme.bg }] };
    function X(v) { return ox + v * scale; }
    function Y(v) { return oy + v * scale; }
    function S(v) { return v * scale; }
    layout.els.forEach(function (el) {
      switch (el.k) {
        case 'rect':
          if (el.fill && el.fill !== 'none') {
            plan.ops.push({ t: 'rect', x: X(el.x), y: Y(el.y), w: S(el.w), h: S(el.h), color: el.fill });
          }
          if (el.stroke) {
            plan.ops.push({ t: 'frame', x: X(el.x), y: Y(el.y), w: S(el.w), h: S(el.h),
              lw: Math.max(2, S(el.sw)), color: el.stroke });
          }
          break;
        case 'circle':
          plan.ops.push({ t: 'circle', x: X(el.cx), y: Y(el.cy), r: S(el.r), color: el.fill });
          if (el.stroke) {
            plan.ops.push({ t: 'ring', x: X(el.cx), y: Y(el.cy), r: S(el.r),
              lw: Math.max(2, S(el.sw)), color: el.stroke });
          }
          break;
        case 'ring':
          plan.ops.push({ t: 'ring', x: X(el.cx), y: Y(el.cy), r: S(el.r),
            lw: Math.max(2, S(el.sw)), color: el.stroke });
          break;
        case 'text':
          plan.ops.push({ t: 'text', x: X(el.x), y: Y(el.y), str: el.str, size: S(el.size),
            font: PNG_FONT, weight: el.weight, color: el.fill, align: 'center' });
          break;
        case 'burst': {
          // starburst approximated with a filled circle + spokes
          for (var i = 0; i < 16; i++) {
            var a = i * Math.PI / 8 - Math.PI / 2;
            plan.ops.push({ t: 'line',
              x1: X(el.cx), y1: Y(el.cy),
              x2: X(el.cx + el.r * Math.cos(a)), y2: Y(el.cy + el.r * Math.sin(a)),
              lw: S(13), color: el.fill });
          }
          plan.ops.push({ t: 'circle', x: X(el.cx), y: Y(el.cy), r: S(el.r * 0.82), color: el.fill });
          plan.ops.push({ t: 'text', x: X(el.cx), y: Y(el.cy - 17), str: 'WITH', size: S(19),
            font: PNG_FONT, weight: 700, color: el.textFill, align: 'center' });
          plan.ops.push({ t: 'text', x: X(el.cx), y: Y(el.cy + 10), str: 'ANSWER', size: S(24),
            font: PNG_FONT, weight: 800, color: el.textFill, align: 'center' });
          plan.ops.push({ t: 'text', x: X(el.cx), y: Y(el.cy + 38), str: 'KEYS!', size: S(24),
            font: PNG_FONT, weight: 800, color: el.textFill, align: 'center' });
          break;
        }
      }
    });
    return plan;
  }

  /* Browser-only: render the plan through png.js and download it. */
  function downloadCoverPNG(settings, opts) {
    opts = opts || {};
    var plan = coverPlan(settings, opts);
    var renderer = (typeof window !== 'undefined' && window.PNGExport) ||
      (typeof globalThis !== 'undefined' && globalThis.PNGExport);
    if (!renderer || typeof document === 'undefined') return plan;
    var canvas = document.createElement('canvas');
    renderer.renderPlan(canvas, plan);
    var filename = 'math-workbook-cover-' + plan.theme + '.png';
    if (canvas.toBlob) {
      canvas.toBlob(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      }, 'image/png');
    } else {
      var a2 = document.createElement('a');
      a2.href = canvas.toDataURL('image/png');
      a2.download = filename;
      document.body.appendChild(a2);
      a2.click();
      a2.remove();
    }
    return plan;
  }

  var api = {
    COVER_THEMES: COVER_THEMES,
    DEFAULT_COVER_SETTINGS: DEFAULT_COVER_SETTINGS,
    normalizeCoverSettings: normalizeCoverSettings,
    coverChips: coverChips,
    themeById: themeById,
    fitLines: fitLines,
    fitTitle: fitTitle,
    starPoints: starPoints,
    coverLayout: coverLayout,
    coverHTML: coverHTML,
    luminance: luminance,
    coverPlan: coverPlan,
    downloadCoverPNG: downloadCoverPNG,
    DESIGN_W: DESIGN_W,
    DESIGN_H: DESIGN_H,
    PNG_SIZES: PNG_SIZES
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.CoverMaker = api;
})(typeof window !== 'undefined' ? window : globalThis);
