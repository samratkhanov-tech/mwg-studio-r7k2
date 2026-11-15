/*
 * Songlap Math Worksheet Generator — PNG export.
 *
 * Each worksheet is drawn from its DATA (never a DOM screenshot) by a
 * pure "draw plan" builder: buildPlan(worksheet, opts) returns
 * { type, width, height, ops: [...] } where ops are abstract canvas
 * commands. renderPlan(canvas, plan) executes the ops on a 2D context.
 * Because the plan layer is pure, the Node tests can verify geometry
 * and content (canvas size, op counts, answer texts) without a browser;
 * only renderPlan/downloadPNG need the DOM.
 *
 * Resolution: the canvas is 2550px wide = 8.5in at 300 DPI, print-ready.
 */
(function (global) {
  'use strict';

  var INK = '#14232b';
  var GRID_LINE = '#b9c6cc';
  var GOLD = '#ffd166';
  var GREEN = '#2a7f62';
  var GRAY = '#5a707a';
  var COIN_EDGE = '#8a6d1f';
  var BILL_FILL = '#cfe8cf';
  var BILL_EDGE = '#3e7d4e';
  var WIDTH = 2550;        // 8.5in at 300 DPI
  var MARGIN = 130;
  var FONT = 'Arial, Helvetica, sans-serif';
  var MONO = '"Courier New", Courier, monospace';

  function newPlan(type, title) {
    return { type: type, title: title || '', width: WIDTH, height: 0, ops: [{ t: 'bg', color: '#ffffff' }] };
  }
  function text(plan, x, y, str, size, opts) {
    opts = opts || {};
    plan.ops.push({
      t: 'text', x: x, y: y, str: String(str), size: size, font: opts.font || FONT,
      weight: opts.weight || 400, color: opts.color || INK,
      align: opts.align || 'center'
    });
  }

  /* Title + Name/Date/Score header. Returns the y where content starts. */
  function planHeader(plan, ws, opts) {
    var title = ws.title + (opts.solution ? ' — Answer Key' : '');
    text(plan, MARGIN, 105, title, 88, { weight: 800, align: 'left' });
    text(plan, MARGIN, 215,
      'Name: ______________________        Date: ________________        Score: __________',
      54, { align: 'left', color: GRAY });
    plan.ops.push({ t: 'line', x1: MARGIN, y1: 268, x2: WIDTH - MARGIN, y2: 268, lw: 6, color: INK });
    var y = 330;
    if (ws.instructions) {
      text(plan, MARGIN, y + 26, ws.instructions, 50, { align: 'left', color: GRAY });
      y += 92;
    }
    return y;
  }

  /* ---------- Arithmetic worksheets ---------- */
  function planArith(ws, opts) {
    var plan = newPlan(ws.type, ws.title);
    var y0 = planHeader(plan, ws, opts);
    var n = ws.problems.length;
    var cols = n <= 12 ? 3 : n <= 20 ? 4 : 5;
    var rows = Math.ceil(n / cols);
    var cellW = (WIDTH - MARGIN * 2) / cols;
    var numSize = 116, lineH = 126, blockH = lineH * 2 + 190;
    var charW = numSize * 0.6; // Courier New advance width
    ws.problems.forEach(function (p, i) {
      var col = i % cols, row = Math.floor(i / cols);
      var x = MARGIN + col * cellW;
      var y = y0 + row * blockH;
      var xRight = x + cellW - 70;
      var digits = Math.max(String(p.a).length, String(p.b).length);
      var blockW = (digits + 1.4) * charW;
      text(plan, x + 6, y + lineH / 2, (i + 1) + ')', 52, { align: 'left', color: GRAY });
      text(plan, xRight, y + lineH / 2, p.a, numSize, { font: MONO, weight: 700, align: 'right' });
      text(plan, xRight - digits * charW - 26, y + lineH * 1.5, p.op, numSize,
        { font: MONO, weight: 700, align: 'right' });
      text(plan, xRight, y + lineH * 1.5, p.b, numSize, { font: MONO, weight: 700, align: 'right' });
      plan.ops.push({
        t: 'line', x1: xRight - blockW, y1: y + lineH * 2 + 26,
        x2: xRight + 8, y2: y + lineH * 2 + 26, lw: 7, color: INK
      });
      if (opts.solution) {
        text(plan, xRight, y + lineH * 2 + 26 + lineH / 2 + 26, p.answerText, numSize,
          { font: MONO, weight: 700, color: GREEN, align: 'right' });
      }
    });
    plan.height = y0 + rows * blockH + MARGIN;
    return plan;
  }

  /* ---------- Money ---------- */
  var PNG_COIN_R = { quarter: 80, dime: 64, nickel: 72, penny: 60 };
  function planMoney(ws, opts) {
    var plan = newPlan('money', ws.title);
    var y = planHeader(plan, ws, opts);
    ws.problems.forEach(function (p, i) {
      if (p.kind === 'money-count') {
        text(plan, MARGIN, y + 34, (i + 1) + ')  ' + p.prompt, 58, { align: 'left', weight: 600 });
        y += 96;
        var x = MARGIN + 10;
        p.items.forEach(function (it) {
          for (var k = 0; k < it.count; k++) {
            if (it.kind === 'bill') {
              plan.ops.push({ t: 'rect', x: x, y: y, w: 300, h: 128, color: BILL_FILL });
              plan.ops.push({ t: 'frame', x: x, y: y, w: 300, h: 128, lw: 4, color: BILL_EDGE });
              text(plan, x + 150, y + 64, it.label, 62, { weight: 700, color: '#1e5631' });
              x += 322;
            } else {
              var r = PNG_COIN_R[it.denom] || 66;
              plan.ops.push({ t: 'circle', x: x + r, y: y + 84, r: r, color: '#e8edf0' });
              plan.ops.push({ t: 'ring', x: x + r, y: y + 84, r: r, lw: 4, color: COIN_EDGE });
              text(plan, x + r, y + 84, it.label, 50, { weight: 700, color: '#5c4a12' });
              x += r * 2 + 24;
            }
          }
        });
        y += 196;
        text(plan, MARGIN, y + 30, 'Answer: ' + (opts.solution ? p.answerText : '______________'),
          58, { align: 'left', weight: 600, color: opts.solution ? GREEN : INK });
        y += 128;
      } else { // money-add
        var eq = (i + 1) + ')  ' + MW.formatMoney(p.aCents) + ' + ' + MW.formatMoney(p.bCents) + ' = ';
        if (opts.solution) {
          text(plan, MARGIN, y + 40, eq, 72, { align: 'left', weight: 600, color: INK });
          // answer in green right after the equation (x estimated at ~0.55em/char)
          text(plan, MARGIN + eq.length * 40, y + 40, p.answerText, 72,
            { align: 'left', weight: 700, color: GREEN });
        } else {
          text(plan, MARGIN, y + 40, eq + '______________', 72,
            { align: 'left', weight: 600, color: INK });
        }
        y += 150;
      }
    });
    plan.height = y + MARGIN;
    return plan;
  }

  /* ---------- Fractions ---------- */
  function planFractionShape(plan, p, x, y, scale) {
    var i;
    if (p.shape === 'circle') {
      var r = 185 * scale, cx = x + r, cy = y + r;
      for (i = 0; i < p.parts; i++) {
        var a0 = -Math.PI / 2 + i * 2 * Math.PI / p.parts;
        var a1 = -Math.PI / 2 + (i + 1) * 2 * Math.PI / p.parts;
        plan.ops.push({
          t: 'wedge', x: cx, y: cy, r: r, a0: a0, a1: a1,
          color: i < p.shaded ? GOLD : '#ffffff', lw: 5, stroke: INK
        });
      }
      return { w: r * 2, h: r * 2 };
    }
    var W = 560 * scale, H = 200 * scale, seg = W / p.parts;
    for (i = 0; i < p.parts; i++) {
      plan.ops.push({ t: 'rect', x: x + i * seg, y: y, w: seg, h: H, color: i < p.shaded ? GOLD : '#ffffff' });
      plan.ops.push({ t: 'frame', x: x + i * seg, y: y, w: seg, h: H, lw: 5, color: INK });
    }
    return { w: W, h: H };
  }

  /* Draw one stacked fraction at (x, yTop); returns its width. */
  function planFraction(plan, numStr, denStr, x, yTop, size) {
    var w = Math.max(String(numStr).length, String(denStr).length) * size * 0.62 + 36;
    var cx = x + w / 2;
    text(plan, cx, yTop + size * 0.52, numStr, size, { font: MONO, weight: 700 });
    plan.ops.push({ t: 'line', x1: x + 6, y1: yTop + size * 1.06, x2: x + w - 6, y2: yTop + size * 1.06, lw: 6, color: INK });
    text(plan, cx, yTop + size * 1.6, denStr, size, { font: MONO, weight: 700 });
    return w;
  }

  function planFractions(ws, opts) {
    var plan = newPlan('fractions', ws.title);
    var y0 = planHeader(plan, ws, opts);
    var cols = 2;
    var cellW = (WIDTH - MARGIN * 2) / cols;
    // group into rows; row height = tallest block in the row
    var rows = [];
    ws.problems.forEach(function (p, i) {
      var row = Math.floor(i / cols);
      if (!rows[row]) rows[row] = [];
      rows[row].push({ p: p, i: i });
    });
    var y = y0;
    rows.forEach(function (row) {
      var rowH = 0;
      row.forEach(function (entry) { rowH = Math.max(rowH, entry.p.kind === 'frac-identify' ? 660 : 380); });
      row.forEach(function (entry, ci) {
        var p = entry.p, x = MARGIN + ci * cellW;
        text(plan, x + 6, y + 30, (entry.i + 1) + ')', 52, { align: 'left', color: GRAY });
        if (p.kind === 'frac-identify') {
          var dim = planFractionShape(plan, p, x + 90, y + 10, 1);
          planFraction(plan, opts.solution ? p.answerNum : '?', opts.solution ? p.answerDen : '?',
            x + 90 + dim.w / 2 - 60, y + 10 + dim.h + 40, 92);
        } else if (p.kind === 'frac-equiv') {
          var ex = x + 90, ey = y + 40;
          var w1 = planFraction(plan, p.num, p.den, ex, ey, 104);
          text(plan, ex + w1 + 58, ey + 108, '=', 104, { weight: 700 });
          planFraction(plan, opts.solution ? p.answerNum : '?', p.answerDen, ex + w1 + 128, ey, 104);
        } else { // frac-add
          var ax = x + 90, ay = y + 40;
          var wa = planFraction(plan, p.n1, p.den, ax, ay, 104);
          text(plan, ax + wa + 58, ay + 108, '+', 104, { weight: 700 });
          var wb = planFraction(plan, p.n2, p.den, ax + wa + 128, ay, 104);
          text(plan, ax + wa + wb + 186, ay + 108, '=', 104, { weight: 700 });
          if (opts.solution) {
            text(plan, ax + wa + wb + 256, ay + 108, p.answerText, 104,
              { font: MONO, weight: 700, color: GREEN, align: 'left' });
          } else {
            planFraction(plan, '?', '?', ax + wa + wb + 256, ay, 104);
          }
        }
      });
      y += rowH;
    });
    plan.height = y + MARGIN;
    return plan;
  }

  /* ---------- Word problems ---------- */
  function wrapText(str, maxChars) {
    var words = String(str).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; }
      else cur = (cur + ' ' + w).trim();
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function planWord(ws, opts) {
    var plan = newPlan('word', ws.title);
    var y = planHeader(plan, ws, opts);
    var size = 58, lineH = 76;
    var maxChars = Math.floor((WIDTH - MARGIN * 2 - 110) / (size * 0.5));
    ws.problems.forEach(function (p, i) {
      var lines = wrapText((i + 1) + ')  ' + p.text, maxChars);
      lines.forEach(function (ln, li) {
        text(plan, MARGIN, y + li * lineH + 30, ln, size, { align: 'left' });
      });
      y += lines.length * lineH + 26;
      for (var k = 0; k < 2; k++) {
        plan.ops.push({ t: 'line', x1: MARGIN + 10, y1: y + 44, x2: WIDTH - MARGIN - 60, y2: y + 44, lw: 3, color: GRID_LINE });
        y += 92;
      }
      text(plan, MARGIN, y + 32, 'Answer: ' + (opts.solution ? p.answerText : '______________'),
        58, { align: 'left', weight: 600, color: opts.solution ? GREEN : INK });
      y += 128;
    });
    plan.height = y + MARGIN;
    return plan;
  }

  /* ---------- dispatch ---------- */
  function buildPlan(ws, opts) {
    opts = opts || {};
    switch (ws.type) {
      case 'money': return planMoney(ws, opts);
      case 'fractions': return planFractions(ws, opts);
      case 'word': return planWord(ws, opts);
      default: return planArith(ws, opts);
    }
  }

  /* ---------- canvas execution (browser only) ---------- */
  function renderPlan(canvas, plan) {
    canvas.width = plan.width;
    canvas.height = plan.height;
    var ctx = canvas.getContext('2d');
    plan.ops.forEach(function (op) {
      switch (op.t) {
        case 'bg':
          ctx.fillStyle = op.color;
          ctx.fillRect(0, 0, plan.width, plan.height);
          break;
        case 'rect':
          ctx.fillStyle = op.color;
          ctx.fillRect(op.x, op.y, op.w, op.h);
          break;
        case 'frame':
          ctx.strokeStyle = op.color;
          ctx.lineWidth = op.lw;
          ctx.strokeRect(op.x, op.y, op.w, op.h);
          break;
        case 'ring':
          ctx.strokeStyle = op.color;
          ctx.lineWidth = op.lw;
          ctx.beginPath();
          ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'line':
          ctx.strokeStyle = op.color;
          ctx.lineWidth = op.lw;
          ctx.beginPath();
          ctx.moveTo(op.x1, op.y1);
          ctx.lineTo(op.x2, op.y2);
          ctx.stroke();
          break;
        case 'circle':
          ctx.fillStyle = op.color;
          ctx.beginPath();
          ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'wedge':
          ctx.beginPath();
          ctx.moveTo(op.x, op.y);
          ctx.arc(op.x, op.y, op.r, op.a0, op.a1);
          ctx.closePath();
          ctx.fillStyle = op.color;
          ctx.fill();
          if (op.stroke) {
            ctx.strokeStyle = op.stroke;
            ctx.lineWidth = op.lw || 3;
            ctx.stroke();
          }
          break;
        case 'text':
          if (!op.str) break;
          ctx.fillStyle = op.color;
          ctx.font = op.weight + ' ' + op.size + 'px ' + op.font;
          ctx.textAlign = op.align;
          ctx.textBaseline = 'middle';
          ctx.fillText(op.str, op.x, op.y);
          break;
      }
    });
    return canvas;
  }

  function downloadPNG(ws, opts) {
    opts = opts || {};
    var plan = buildPlan(ws, opts);
    var canvas = document.createElement('canvas');
    renderPlan(canvas, plan);
    var filename = ws.type + (opts.solution ? '-answer-key.png' : '-worksheet.png');
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
    buildPlan: buildPlan,
    renderPlan: renderPlan,
    downloadPNG: downloadPNG,
    planArith: planArith,
    planMoney: planMoney,
    planFractions: planFractions,
    planWord: planWord,
    wrapText: wrapText,
    WIDTH: WIDTH
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.PNGExport = api;
})(typeof window !== 'undefined' ? window : globalThis);
