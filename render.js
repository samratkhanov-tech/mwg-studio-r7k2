/*
 * Songlap Math Worksheet Generator — HTML renderers for worksheets.
 * Pure string builders: used by the single-worksheet tabs (app.js) and the
 * Book Builder (book.js) so screen and print output look identical.
 * Money and fraction visuals are inline SVG drawn from the problem data.
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------- Worksheet shell: Name / Date / Score header ---------- */

  function worksheetHeaderHTML(ws) {
    return '<div class="ws-head">' +
      '<h3 class="ws-title">' + esc(ws.title) + '</h3>' +
      '<div class="ws-meta">' +
        '<span>Name: <span class="fill-line fill-name"></span></span>' +
        '<span>Date: <span class="fill-line fill-date"></span></span>' +
        '<span>Score: <span class="fill-line fill-score"></span></span>' +
      '</div></div>' +
      (ws.instructions ? '<p class="ws-instructions">' + esc(ws.instructions) + '</p>' : '');
  }

  /* ---------- Arithmetic (vertical format) ---------- */

  function arithProblemHTML(p, idx, opts) {
    opts = opts || {};
    var ans = opts.solution
      ? '<div class="vp-answer">' + esc(p.answerText) + '</div>'
      : '<div class="vp-answer vp-blank"></div>';
    return '<div class="vprob">' +
      '<div class="vp-row"><span class="prob-num">' + (idx + 1) + ')</span>' +
        '<span class="vp-a">' + p.a + '</span></div>' +
      '<div class="vp-row"><span class="vp-op">' + p.op + '</span>' +
        '<span class="vp-b">' + p.b + '</span></div>' +
      '<div class="vp-rule"></div>' + ans +
    '</div>';
  }

  function arithBodyHTML(ws, opts) {
    var h = '<div class="prob-grid">';
    ws.problems.forEach(function (p, i) { h += arithProblemHTML(p, i, opts); });
    return h + '</div>';
  }

  /* ---------- Money ---------- */

  var COIN_R = { quarter: 21, dime: 17, nickel: 19, penny: 16 };
  var COIN_FILL = { quarter: '#e8edf0', dime: '#e8edf0', nickel: '#dfe6ea', penny: '#e6b98a' };

  function moneySVG(items) {
    var parts = [], x = 4;
    var H = 52;
    items.forEach(function (it) {
      for (var i = 0; i < it.count; i++) {
        if (it.kind === 'bill') {
          parts.push('<g><rect x="' + x + '" y="9" width="76" height="34" rx="4" ' +
            'fill="#cfe8cf" stroke="#3e7d4e" stroke-width="1.6"/>' +
            '<text x="' + (x + 38) + '" y="27" text-anchor="middle" dominant-baseline="middle" ' +
            'font-size="16" font-weight="700" fill="#1e5631">' + esc(it.label) + '</text></g>');
          x += 84;
        } else {
          var r = COIN_R[it.denom] || 18;
          var cy = H / 2;
          parts.push('<g><circle cx="' + (x + r) + '" cy="' + cy + '" r="' + r + '" fill="' +
            (COIN_FILL[it.denom] || '#e8edf0') + '" stroke="#8a6d1f" stroke-width="1.6"/>' +
            '<text x="' + (x + r) + '" y="' + cy + '" text-anchor="middle" dominant-baseline="middle" ' +
            'font-size="' + (r >= 20 ? 14 : 12) + '" font-weight="700" fill="#5c4a12">' +
            esc(it.label) + '</text></g>');
          x += r * 2 + 7;
        }
      }
    });
    return '<svg class="money-svg" viewBox="0 0 ' + (x + 2) + ' ' + H +
      '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Money">' + parts.join('') + '</svg>';
  }

  function moneyBodyHTML(ws, opts) {
    opts = opts || {};
    var h = '<div class="prob-list">';
    ws.problems.forEach(function (p, i) {
      h += '<div class="money-prob"><span class="prob-num">' + (i + 1) + ')</span>';
      if (p.kind === 'money-count') {
        h += '<div class="money-visual">' + moneySVG(p.items) + '</div>' +
          '<div class="money-prompt">' + esc(p.prompt) +
          ' <span class="answer-line">' + (opts.solution ? esc(p.answerText) : '') + '</span></div>';
      } else {
        h += '<div class="money-prompt money-add">' + esc(p.prompt).replace(' = ?', '') +
          ' = <span class="answer-line">' + (opts.solution ? esc(p.answerText) : '') + '</span></div>';
      }
      h += '</div>';
    });
    return h + '</div>';
  }

  /* ---------- Fractions ---------- */

  function fractionSVG(p) {
    var parts = [], i;
    if (p.shape === 'circle') {
      var cx = 55, cy = 55, r = 50;
      for (i = 0; i < p.parts; i++) {
        var a0 = -Math.PI / 2 + i * 2 * Math.PI / p.parts;
        var a1 = -Math.PI / 2 + (i + 1) * 2 * Math.PI / p.parts;
        var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
        var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
        var large = (a1 - a0) > Math.PI ? 1 : 0;
        parts.push('<path d="M' + cx + ' ' + cy + ' L' + x0.toFixed(1) + ' ' + y0.toFixed(1) +
          ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) +
          ' Z" fill="' + (i < p.shaded ? '#ffd166' : '#ffffff') +
          '" stroke="#14232b" stroke-width="1.8"/>');
      }
      return '<svg class="frac-svg" viewBox="0 0 110 110" xmlns="http://www.w3.org/2000/svg" ' +
        'role="img" aria-label="Fraction shape">' + parts.join('') + '</svg>';
    }
    var W = 168, H = 62, seg = W / p.parts;
    for (i = 0; i < p.parts; i++) {
      parts.push('<rect x="' + (i * seg).toFixed(1) + '" y="1" width="' + seg.toFixed(1) +
        '" height="' + (H - 2) + '" fill="' + (i < p.shaded ? '#ffd166' : '#ffffff') +
        '" stroke="#14232b" stroke-width="1.8"/>');
    }
    return '<svg class="frac-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" ' +
      'role="img" aria-label="Fraction shape">' + parts.join('') + '</svg>';
  }

  function fracHTML(n, d) {
    return '<span class="frac"><span class="frac-num">' + n + '</span>' +
      '<span class="frac-den">' + d + '</span></span>';
  }

  function fractionsBodyHTML(ws, opts) {
    opts = opts || {};
    var h = '<div class="frac-grid">';
    ws.problems.forEach(function (p, i) {
      h += '<div class="frac-prob"><span class="prob-num">' + (i + 1) + ')</span>';
      if (p.kind === 'frac-identify') {
        h += fractionSVG(p) +
          '<div class="frac-blank">' + fracHTML('&nbsp;', '&nbsp;') + '</div>' +
          (opts.solution ? '<div class="frac-solution">= ' + esc(p.answerText) + '</div>' : '');
      } else if (p.kind === 'frac-equiv') {
        h += '<div class="frac-eq">' + fracHTML(p.num, p.den) + ' = ' +
          fracHTML(opts.solution ? p.answerNum : '?', p.answerDen) + '</div>';
      } else { // frac-add
        h += '<div class="frac-eq">' + fracHTML(p.n1, p.den) + ' + ' + fracHTML(p.n2, p.den) +
          ' = ' + (opts.solution
            ? '<span class="frac-solution-inline">' + esc(p.answerText) + '</span>'
            : fracHTML('&nbsp;', '&nbsp;')) + '</div>';
      }
      h += '</div>';
    });
    return h + '</div>';
  }

  /* ---------- Word problems ---------- */

  function wordBodyHTML(ws, opts) {
    opts = opts || {};
    var h = '<div class="prob-list">';
    ws.problems.forEach(function (p, i) {
      h += '<div class="word-prob"><p><span class="prob-num">' + (i + 1) + ')</span> ' +
        esc(p.text) + '</p>' +
        '<div class="workspace-lines"><div></div><div></div></div>' +
        '<p class="word-answer">Answer: <span class="answer-line">' +
        (opts.solution ? esc(p.answerText) : '') + '</span></p></div>';
    });
    return h + '</div>';
  }

  /* ---------- Dispatch + answer key ---------- */

  function worksheetBodyHTML(ws, opts) {
    switch (ws.type) {
      case 'money': return moneyBodyHTML(ws, opts);
      case 'fractions': return fractionsBodyHTML(ws, opts);
      case 'word': return wordBodyHTML(ws, opts);
      default: return arithBodyHTML(ws, opts);
    }
  }

  function worksheetHTML(ws, opts) {
    opts = opts || {};
    return '<div class="wsheet">' + worksheetHeaderHTML(ws) +
      worksheetBodyHTML(ws, opts) + '</div>';
  }

  function answerKeyHTML(ws) {
    var key = MW.answerKey(ws);
    var h = '<div class="akey"><h3>Answer Key — ' + esc(ws.title) + '</h3><ol class="akey-list">';
    key.forEach(function (a) { h += '<li>' + esc(a) + '</li>'; });
    return h + '</ol></div>';
  }

  var api = {
    esc: esc,
    worksheetHeaderHTML: worksheetHeaderHTML,
    worksheetHTML: worksheetHTML,
    worksheetBodyHTML: worksheetBodyHTML,
    answerKeyHTML: answerKeyHTML,
    moneySVG: moneySVG,
    fractionSVG: fractionSVG,
    fracHTML: fracHTML
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Render = api;
})(typeof window !== 'undefined' ? window : globalThis);
