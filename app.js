/*
 * ============================================================
 *  Songlap Math Worksheet Generator — main app
 * ============================================================
 *  LICENSING CONFIG
 *  Each buyer has a UNIQUE code, registered to their name by
 *  the license server (Google Apps Script + Google Sheet).
 *  The app sends { name, code } to LICENSE_API_URL and unlocks
 *  only when the server says ok.
 *  >> After deploying the Apps Script web app, paste its URL
 *     in place of the placeholder below. That is the ONLY
 *     change needed to go live. <<
 * ============================================================
 */
const LICENSE_API_URL = "https://script.google.com/macros/s/AKfycbw0QV17mMUaP4Me0v8EEqhxEBvukIVlZWca7xGJa0g7M_9jWwZV4itDQLNxZMqII51ZxA/exec";

/* ---------- License response handling (pure, unit-tested) ---------- */

var LICENSE_ERROR_MESSAGES = {
  invalid_code: 'This code was not found. Please check the code from your purchase.',
  code_registered_to_another_name: 'This code is already registered to another buyer. If this is your code, please contact support.',
  missing_fields: 'Please enter both your name and your code.',
  network: 'Could not verify your code. Please check your internet connection and try again.'
};

function licenseErrorMessage(errorCode) {
  return LICENSE_ERROR_MESSAGES[errorCode] || LICENSE_ERROR_MESSAGES.network;
}

/* Turn a parsed license-server response into an app decision. */
function interpretLicenseResponse(data) {
  if (!data || typeof data !== 'object') {
    return { action: 'error', message: licenseErrorMessage('network') };
  }
  if (data.ok === true) {
    return { action: 'unlock', test: data.test === true };
  }
  return { action: 'error', message: licenseErrorMessage(data.error) };
}

/* ---------- Grade quick-set (pure data, unit-tested) ----------
 * Every worksheet tab (and the Book Builder) has a "Grade (quick set)"
 * dropdown. Choosing Grade 1–5 presets the tab's EXISTING controls to
 * the values below; choosing "Custom" leaves the controls untouched.
 * If the buyer then changes a mapped control by hand, that tab's Grade
 * dropdown falls back to "Custom" (wired in initGrades below).
 * Word Problems has no difficulty control to preset — its grade is a
 * generator parameter instead (see MW.wordGradeOps in generators.js),
 * held as tab state in the app and passed to MW.generateWordProblems.
 */
var TAB_GRADE_MAP = {
  addition: {
    gradeId: 'addition-grade', controlId: 'addition-level',
    values: { '1': '1digit', '2': '2digit-noreg', '3': '2digit-reg', '4': '3digit', '5': '3digit' }
  },
  subtraction: {
    gradeId: 'subtraction-grade', controlId: 'subtraction-level',
    values: { '1': '1digit', '2': '2digit-noreg', '3': '2digit-reg', '4': '3digit', '5': '3digit' }
  },
  multiplication: {
    gradeId: 'multiplication-grade', controlId: 'multiplication-range',
    values: { '1': '2-5', '2': '2-5', '3': '2-9', '4': '2-12', '5': '2x1' }
  },
  division: {
    gradeId: 'division-grade', controlId: 'division-range',
    values: { '1': '2-5', '2': '2-5', '3': '2-9', '4': '2-12', '5': '2-12' },
    checkboxId: 'division-remainders',
    remainders: { '1': false, '2': false, '3': false, '4': false, '5': true }
  },
  mixed: {
    gradeId: 'mixed-grade', controlId: 'mixed-level',
    values: { '1': 'easy', '2': 'easy', '3': 'medium', '4': 'medium', '5': 'hard' }
  },
  money: {
    gradeId: 'money-grade', controlId: 'money-mode',
    values: { '1': 'count', '2': 'count', '3': 'mixed', '4': 'mixed', '5': 'mixed' }
  },
  fractions: {
    gradeId: 'fractions-grade', controlId: 'fractions-mode',
    values: { '1': 'identify', '2': 'identify', '3': 'equiv', '4': 'add', '5': 'mixed' }
  },
  book: {
    gradeId: 'bk-grade', controlId: 'bk-difficulty',
    values: { '1': 'easy', '2': 'easy', '3': 'medium', '4': 'hard', '5': 'hard' }
  }
};

/* The preset for one tab + grade: { controlId, value } plus, for the
 * division tab, { checkboxId, checked }. Null for "Custom"/unknown. */
function gradePreset(tabKey, grade) {
  var spec = TAB_GRADE_MAP[tabKey];
  if (!spec) return null;
  var value = spec.values[grade];
  if (value === undefined) return null;
  var preset = { controlId: spec.controlId, value: value };
  if (spec.checkboxId) {
    preset.checkboxId = spec.checkboxId;
    preset.checked = !!spec.remainders[grade];
  }
  return preset;
}

/* Allow the Node test suite to exercise the pure logic above. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LICENSE_API_URL: LICENSE_API_URL,
    LICENSE_ERROR_MESSAGES: LICENSE_ERROR_MESSAGES,
    licenseErrorMessage: licenseErrorMessage,
    interpretLicenseResponse: interpretLicenseResponse,
    TAB_GRADE_MAP: TAB_GRADE_MAP,
    gradePreset: gradePreset
  };
}

(function () {
  'use strict';

  /* ---------- License gate ---------- */

  var NAME_KEY = 'mwg_license_name';
  var CODE_KEY = 'mwg_license_code';
  var appStarted = false;

  function unlock() {
    document.getElementById('lock-screen').hidden = true;
    document.getElementById('app').hidden = false;
    if (!appStarted) { appStarted = true; initApp(); }
  }

  function showLicenseBar(name, code) {
    document.getElementById('license-name').textContent = name;
    document.getElementById('license-code').textContent = code;
    document.getElementById('license-bar').hidden = false;
  }

  function storedLicense() {
    try {
      var name = localStorage.getItem(NAME_KEY);
      var code = localStorage.getItem(CODE_KEY);
      if (name && code) return { name: name, code: code };
    } catch (e) { /* private mode */ }
    return null;
  }

  function initGate() {
    var saved = storedLicense();
    if (saved) { showLicenseBar(saved.name, saved.code); unlock(); return; }

    var form = document.getElementById('lock-form');
    var nameInput = document.getElementById('lock-name');
    var codeInput = document.getElementById('lock-input');
    var button = document.getElementById('lock-submit');
    var errorEl = document.getElementById('lock-error');

    function showError(message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }

    function setChecking(checking) {
      button.disabled = checking;
      nameInput.disabled = checking;
      codeInput.disabled = checking;
      button.textContent = checking ? 'Checking…' : 'Unlock';
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = nameInput.value.trim().replace(/\s+/g, ' ');
      var code = codeInput.value.trim().toUpperCase();
      if (!name || !code) { showError(licenseErrorMessage('missing_fields')); return; }
      errorEl.hidden = true;
      setChecking(true);
      // text/plain keeps this a "simple request" (no CORS preflight),
      // which is what the Apps Script web app expects.
      fetch(LICENSE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ name: name, code: code })
      }).then(function (resp) {
        return resp.json();
      }).then(function (data) {
        var result = interpretLicenseResponse(data);
        setChecking(false);
        if (result.action === 'unlock') {
          try {
            localStorage.setItem(NAME_KEY, name);
            localStorage.setItem(CODE_KEY, code);
          } catch (e) { /* ignore */ }
          showLicenseBar(name, code);
          unlock();
        } else {
          showError(result.message);
        }
      }).catch(function () {
        setChecking(false);
        showError(licenseErrorMessage('network'));
      });
    });
  }

  /* ---------- App ---------- */

  function $(id) { return document.getElementById(id); }
  function seedRng() { return MW.makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0); }
  function countOf(id) { return parseInt($(id).value, 10) || 20; }

  var state = {}; // key -> { ws, showKey }
  var wordGrade = null; // Word Problems tab state: '1'..'5', or null = Custom

  function initApp() {
    initTabs();
    wireTab('addition', function (rng) {
      return MW.generateAddition(countOf('addition-count'), $('addition-level').value, rng);
    });
    wireTab('subtraction', function (rng) {
      return MW.generateSubtraction(countOf('subtraction-count'), $('subtraction-level').value, rng);
    });
    wireTab('multiplication', function (rng) {
      return MW.generateMultiplication(countOf('multiplication-count'), $('multiplication-range').value, rng);
    });
    wireTab('division', function (rng) {
      return MW.generateDivision(countOf('division-count'), $('division-range').value,
        $('division-remainders').checked, rng);
    });
    wireTab('mixed', function (rng) {
      return MW.generateMixed(countOf('mixed-count'), $('mixed-level').value, rng);
    });
    wireTab('money', function (rng) {
      return MW.generateMoney(countOf('money-count'), $('money-mode').value, rng);
    });
    wireTab('fractions', function (rng) {
      return MW.generateFractions(countOf('fractions-count'), $('fractions-mode').value, rng);
    });
    wireTab('word', function (rng) {
      return MW.generateWordProblems(countOf('word-count'), rng, wordGrade);
    });
    initGrades();
    if (window.BookBuilder) BookBuilder.init(seedRng);
    // friendly first screen: pre-generate an addition worksheet
    $('addition-generate').click();
  }

  function initTabs() {
    $('tabs').addEventListener('click', function (ev) {
      var btn = ev.target.closest('.tab');
      if (!btn) return;
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.panel').forEach(function (p) { p.hidden = true; });
      $('panel-' + btn.dataset.tab).hidden = false;
    });
  }

  /* Grade quick-set wiring. Picking a grade presets the tab's mapped
   * control(s) (programmatic value sets do not fire 'change', so this
   * never loops); touching a mapped control by hand afterwards sends
   * that tab's Grade dropdown back to "Custom". The Word Problems tab
   * has no mapped control — its grade lives in `wordGrade` above and
   * is handed to the generator on every Generate click. */
  function initGrades() {
    Object.keys(TAB_GRADE_MAP).forEach(function (key) {
      var spec = TAB_GRADE_MAP[key];
      var gradeSel = $(spec.gradeId);
      if (!gradeSel) return;
      gradeSel.addEventListener('change', function () {
        var preset = gradePreset(key, gradeSel.value);
        if (!preset) return; // "Custom": leave the controls as they are
        var control = $(preset.controlId);
        if (control) control.value = preset.value;
        if (preset.checkboxId) {
          var box = $(preset.checkboxId);
          if (box) box.checked = preset.checked;
        }
      });
      var mapped = [spec.controlId, spec.checkboxId];
      mapped.forEach(function (controlId) {
        if (!controlId) return;
        var el = $(controlId);
        if (el) el.addEventListener('change', function () { gradeSel.value = 'custom'; });
      });
    });
    var wordSel = $('word-grade');
    if (wordSel) {
      wordSel.addEventListener('change', function () {
        wordGrade = wordSel.value === 'custom' ? null : wordSel.value;
      });
    }
  }

  /* One worksheet tab: Generate / answer-key toggle / Print-PDF / PNG. */
  function wireTab(key, makeWorksheet) {
    state[key] = { ws: null, showKey: false };

    $(key + '-generate').addEventListener('click', function () {
      state[key].ws = makeWorksheet(seedRng());
      state[key].showKey = false;
      $(key + '-key').disabled = false;
      $(key + '-print').disabled = false;
      $(key + '-png').disabled = false;
      $(key + '-key').textContent = 'Show Answer Key';
      $(key + '-status').textContent = state[key].ws.problems.length + ' problems generated. ' +
        'Use Print / PDF for a printable worksheet plus its answer key.';
      draw(key);
    });

    $(key + '-key').addEventListener('click', function () {
      state[key].showKey = !state[key].showKey;
      $(key + '-key').textContent = state[key].showKey ? 'Hide Answer Key' : 'Show Answer Key';
      draw(key);
    });

    $(key + '-print').addEventListener('click', function () {
      if (state[key].ws && window.BookBuilder) BookBuilder.printWorksheet(state[key].ws);
    });

    $(key + '-png').addEventListener('click', function () {
      if (state[key].ws) PNGExport.downloadPNG(state[key].ws, { solution: state[key].showKey });
    });
  }

  function draw(key) {
    var s = state[key];
    if (!s || !s.ws) return;
    $(key + '-output').innerHTML =
      Render.worksheetHTML(s.ws) + (s.showKey ? Render.answerKeyHTML(s.ws) : '');
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initGate);
  }
})();
