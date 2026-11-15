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

/* Allow the Node test suite to exercise the pure logic above. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LICENSE_API_URL: LICENSE_API_URL,
    LICENSE_ERROR_MESSAGES: LICENSE_ERROR_MESSAGES,
    licenseErrorMessage: licenseErrorMessage,
    interpretLicenseResponse: interpretLicenseResponse
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
      return MW.generateWordProblems(countOf('word-count'), rng);
    });
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
