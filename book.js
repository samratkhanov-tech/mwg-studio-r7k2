/*
 * Songlap Math Worksheet Generator — Book Builder + single-sheet printing.
 * Assembles a print-ready book (title page, worksheet pages, and an
 * Answer Key section at the back) into #book-preview, which is what the
 * browser prints. @page size is set to the chosen page size.
 * The same preview area is used to print a single worksheet + its key.
 *
 * PAGINATION: a worksheet does NOT always fit on one sheet — 25 word
 * problems or money problems are several sheets tall. Fixed-height
 * pages with overflow:hidden used to clip the excess silently, so
 * buyers lost problems in print. Instead, every worksheet and answer
 * key is now MEASURED in a hidden replica page (same width, padding,
 * label and footer as the real page) and split into as many sheets as
 * it needs, with problem numbering continuing across the split
 * (Render's startIndex). A chunk never splits a problem grid row or
 * list item awkwardly — chunks are whole problem prefixes, and the
 * measurement is done with the real browser layout, so the fit is
 * exact for the buyer's own fonts. No chunk is ever empty.
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

  /* ---------- Page assembly ---------- */

  /* One printed page: optional label, body, footer. Used for BOTH the
   * measuring replica and the real output so they can never drift. */
  function pageHTML(size, labelText, bodyHTML, footerText) {
    return '<div class="book-page" style="' + pageStyle(size) + '">' +
      (labelText ? '<p class="worksheet-label">' + Render.esc(labelText) + '</p>' : '') +
      '<div class="page-body">' + bodyHTML + '</div>' +
      '<p class="page-footer">' + Render.esc(footerText) + '</p></div>';
  }

  function coverPageHTML(size, innerHTML) {
    return '<div class="book-page cover-page" style="' + pageStyle(size) + '">' +
      '<div class="cover-inner">' + innerHTML + '</div></div>';
  }

  function dividerPageHTML(size, innerHTML) {
    return '<div class="book-page divider-page" style="' + pageStyle(size) + '">' +
      '<div class="cover-inner">' + innerHTML + '</div></div>';
  }

  /* ---------- Measuring ---------- */

  var measureEl = null;

  /* Lay the candidate page out in a hidden replica and report whether
   * everything sits inside the sheet: the footer must end within the
   * page box and the content must not reach into the footer. */
  function contentFits(size, labelText, bodyHTML, footerText) {
    if (!measureEl) {
      measureEl = document.createElement('div');
      measureEl.setAttribute('aria-hidden', 'true');
      measureEl.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden;';
      document.body.appendChild(measureEl);
    }
    measureEl.innerHTML = pageHTML(size, labelText, bodyHTML, footerText);
    var page = measureEl.firstChild;
    var body = page.querySelector('.page-body');
    var content = body ? body.firstElementChild : null;
    var footerEl = page.querySelector('.page-footer');
    if (!content || !footerEl) return true;
    var footerBottom = footerEl.offsetTop + footerEl.offsetHeight;
    var contentBottom = content.offsetTop + content.offsetHeight;
    return footerBottom <= page.clientHeight + 1 &&
      contentBottom <= footerEl.offsetTop + 1;
  }

  /* ---------- Pagination (pure chunking; unit-tested in Node) ---------- */

  /* Split `total` items into consecutive chunks. buildBody(start, count)
   * returns the page-body HTML for that slice; fits(html) reports
   * whether a slice fits on one sheet. Fitting is monotone (a shorter
   * slice never needs more room), so binary search finds the largest
   * fitting slice. Every item is covered exactly once, in order; a
   * single item that cannot fit alone still gets its own page — items
   * are never dropped and no page is ever empty. */
  function paginateByFit(total, buildBody, fits) {
    var chunks = [];
    var start = 0;
    while (start < total) {
      var remaining = total - start;
      var best = 1;
      var lo = 1, hi = remaining;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        if (fits(buildBody(start, mid))) { best = mid; lo = mid + 1; }
        else { hi = mid - 1; }
      }
      chunks.push({ start: start, count: best });
      start += best;
    }
    return chunks;
  }

  /* A worksheet copy holding only problems[start, start+count). */
  function subsetWS(ws, start, count) {
    var copy = {};
    for (var k in ws) copy[k] = ws[k];
    copy.problems = ws.problems.slice(start, start + count);
    return copy;
  }

  function bodyBuilder(ws, renderSlice) {
    var b = function (start, count) {
      return renderSlice(subsetWS(ws, start, count), start);
    };
    b.total = ws.problems.length;
    return b;
  }

  function worksheetBody(ws) {
    return bodyBuilder(ws, function (sub, start) {
      return Render.worksheetHTML(sub, { startIndex: start });
    });
  }

  function answerKeyBody(ws) {
    return bodyBuilder(ws, function (sub, start) {
      return Render.answerKeyHTML(sub, { startIndex: start });
    });
  }

  /* Build the printed pages for one body (a worksheet or an answer
   * key): as many sheets as the content needs. The first sheet carries
   * labelBase, later sheets labelBase + " (continued)"; labelBase may
   * be null for unlabelled pages. Fit is measured against the
   * continuation label (the longer one) so every sheet fits. */
  function paginatedPages(size, labelBase, footerText, buildBody) {
    var measureLabel = labelBase ? labelBase + ' (continued)' : null;
    var chunks = paginateByFit(buildBody.total, buildBody, function (html) {
      return contentFits(size, measureLabel, html, footerText);
    });
    return chunks.map(function (ch, ci) {
      var label = labelBase
        ? (ci === 0 ? labelBase : labelBase + ' (continued)')
        : null;
      return pageHTML(size, label, buildBody(ch.start, ch.count), footerText);
    });
  }

  /* ---------- Single worksheet printing ---------- */

  function printWorksheet(ws) {
    var size = SIZES.letter;
    setPageSize(size);
    var foot = 'Math Worksheet Generator · Songlap Deals';
    var pages = [];
    pages = pages.concat(paginatedPages(size, null, foot, worksheetBody(ws)));
    pages = pages.concat(paginatedPages(size, 'Answer Key — ' + ws.title, foot, answerKeyBody(ws)));
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
    var pages = [];

    // title page
    pages.push(coverPageHTML(size,
      '<div class="cover-puzzle-icon">🧮</div>' +
      '<h1 class="cover-title">' + Render.esc(title) + '</h1>' +
      (author ? '<p class="cover-author">by ' + Render.esc(author) + '</p>' : '') +
      '<p class="cover-count">' + sets.length + ' worksheets with answer keys</p>' +
      '<p class="cover-brand">SONGLAP DEALS</p>'));

    // worksheet pages (each worksheet takes as many sheets as it needs)
    sets.forEach(function (ws, idx) {
      var label = 'Worksheet ' + (idx + 1) + ' — ' + ws.title;
      var foot = title + ' · Worksheet ' + (idx + 1);
      pages = pages.concat(paginatedPages(size, label, foot, worksheetBody(ws)));
    });

    // answer-key divider
    pages.push(dividerPageHTML(size,
      '<h1 class="cover-title">Answer Key</h1>' +
      '<p class="cover-count">Answers for all ' + sets.length + ' worksheets</p>'));

    // answer-key pages
    sets.forEach(function (ws, idx) {
      var label = 'Answer Key — Worksheet ' + (idx + 1) + ' (' + ws.title + ')';
      var foot = title + ' · Answer Key ' + (idx + 1);
      pages = pages.concat(paginatedPages(size, label, foot, answerKeyBody(ws)));
    });

    var preview = $('book-preview');
    preview.innerHTML = pages.join('');
    preview.hidden = false;
    return pages.length;
  }

  var api = {
    init: init, printWorksheet: printWorksheet, _renderBook: renderBook,
    _paginateByFit: paginateByFit, _SIZES: SIZES
  };
  if (typeof window !== 'undefined') window.BookBuilder = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
