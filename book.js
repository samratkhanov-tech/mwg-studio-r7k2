/*
 * Songlap Math Worksheet Generator — Book Builder + single-sheet printing.
 * Assembles a print-ready book (title page, one worksheet per page, and an
 * Answer Key section at the back) into #book-preview, which is what the
 * browser prints. @page size is set to the chosen page size.
 * The same preview area is used to print a single worksheet + its key.
 */
(function () {
  'use strict';

  var SIZES = {
    'letter': { w: 8.5, h: 11, unit: 'in', cssSize: '8.5in 11in', label: 'Letter (8.5 × 11 in)', pad: 0.6 },
    'a4': { w: 210, h: 297, unit: 'mm', cssSize: '210mm 297mm', label: 'A4 (210 × 297 mm)', pad: 15 }
  };

  function $(id) { return document.getElementById(id); }

  function setPageSize(size) {
    var old = document.getElementById('page-style');
    if (old) old.remove();
    var st = document.createElement('style');
    st.id = 'page-style';
    st.textContent = '@page { size: ' + size.cssSize + '; margin: 0; }';
    document.head.appendChild(st);
  }

  function pageStyle(size) {
    return 'width:' + size.w + size.unit + ';height:' + size.h + size.unit +
      ';padding:' + size.pad + size.unit + ';';
  }

  /* ---------- Single worksheet printing ---------- */

  function printWorksheet(ws) {
    var size = SIZES.letter;
    setPageSize(size);
    var ps = pageStyle(size);
    var pages = [];
    pages.push(
      '<div class="book-page" style="' + ps + '">' +
        '<div class="page-body">' + Render.worksheetHTML(ws) + '</div>' +
        '<p class="page-footer">Math Worksheet Generator · Songlap Deals</p></div>');
    pages.push(
      '<div class="book-page" style="' + ps + '">' +
        '<div class="page-body">' + Render.answerKeyHTML(ws) + '</div>' +
        '<p class="page-footer">Math Worksheet Generator · Songlap Deals</p></div>');
    var preview = $('book-preview');
    preview.innerHTML = pages.join('');
    preview.hidden = false;
    // let the preview paint before the print dialog opens
    setTimeout(function () { window.print(); }, 60);
  }

  /* ---------- Book Builder ---------- */

  function init(seedRng) {
    $('bk-build').addEventListener('click', function () { buildBook(seedRng); });
    $('bk-print').addEventListener('click', function () { window.print(); });
  }

  function clampCount(v) {
    var n = parseInt(v, 10);
    if (isNaN(n) || n < 0) return 0;
    return Math.min(n, 100);
  }

  function buildBook(seedRng) {
    var title = $('bk-title').value.trim() || 'My Math Worksheets';
    var author = $('bk-author').value.trim();
    var size = SIZES[$('bk-size').value] || SIZES.letter;
    var counts = {};
    var totalSets = 0;
    MW.BOOK_TYPE_ORDER.forEach(function (type) {
      counts[type] = clampCount($('bk-count-' + type).value);
      totalSets += counts[type];
    });
    if (totalSets === 0) {
      $('bk-status').textContent = 'Set at least one worksheet count above zero.';
      return;
    }
    $('bk-status').textContent = 'Building your book…';
    $('bk-build').disabled = true;

    setTimeout(function () {
      try {
        var rng = seedRng();
        var sets = MW.assembleBook({
          counts: counts,
          difficulty: $('bk-difficulty').value,
          perWorksheet: parseInt($('bk-per').value, 10) || 20,
          divisionRemainders: $('bk-remainders').checked
        }, rng);
        var pageCount = renderBook(title, author, size, sets);
        $('bk-print').disabled = false;
        $('bk-status').textContent = 'Book ready: ' + sets.length + ' worksheets, ' +
          pageCount + ' pages total (title + worksheet pages + answer-key section). ' +
          'Scroll down to preview, then click Download / Print PDF.';
        $('bk-output').innerHTML = '<p class="placeholder">✅ Book generated — preview is below the tool. ' +
          'Click <strong>Download / Print PDF</strong> to save it at ' + size.label + '.</p>';
      } catch (err) {
        $('bk-status').textContent = 'Something went wrong while building the book: ' + err.message;
      } finally {
        $('bk-build').disabled = false;
      }
    }, 30);
  }

  function renderBook(title, author, size, sets) {
    setPageSize(size);
    var ps = pageStyle(size);
    var pages = [];

    // title page
    pages.push(
      '<div class="book-page cover-page" style="' + ps + '">' +
        '<div class="cover-inner">' +
          '<div class="cover-puzzle-icon">🧮</div>' +
          '<h1 class="cover-title">' + Render.esc(title) + '</h1>' +
          (author ? '<p class="cover-author">by ' + Render.esc(author) + '</p>' : '') +
          '<p class="cover-count">' + sets.length + ' worksheets with answer keys</p>' +
          '<p class="cover-brand">SONGLAP DEALS</p>' +
        '</div>' +
      '</div>');

    function footer(text) {
      return '<p class="page-footer">' + Render.esc(text) + '</p>';
    }

    // worksheet pages
    sets.forEach(function (ws, idx) {
      pages.push(
        '<div class="book-page" style="' + ps + '">' +
          '<p class="worksheet-label">Worksheet ' + (idx + 1) + ' — ' + Render.esc(ws.title) + '</p>' +
          '<div class="page-body">' + Render.worksheetHTML(ws) + '</div>' +
          footer(title + ' · Worksheet ' + (idx + 1)) +
        '</div>');
    });

    // answer-key divider
    pages.push(
      '<div class="book-page divider-page" style="' + ps + '">' +
        '<div class="cover-inner"><h1 class="cover-title">Answer Key</h1>' +
        '<p class="cover-count">Answers for all ' + sets.length + ' worksheets</p></div>' +
      '</div>');

    // answer-key pages
    sets.forEach(function (ws, idx) {
      pages.push(
        '<div class="book-page" style="' + ps + '">' +
          '<p class="worksheet-label">Answer Key — Worksheet ' + (idx + 1) + ' (' + Render.esc(ws.title) + ')</p>' +
          '<div class="page-body">' + Render.answerKeyHTML(ws) + '</div>' +
          footer(title + ' · Answer Key ' + (idx + 1)) +
        '</div>');
    });

    var preview = $('book-preview');
    preview.innerHTML = pages.join('');
    preview.hidden = false;
    return pages.length;
  }

  window.BookBuilder = { init: init, printWorksheet: printWorksheet, _renderBook: renderBook };
})();
