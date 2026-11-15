/*
 * Songlap Math Worksheet Generator — pure worksheet logic.
 * Works in the browser (window.MW) and in Node (module.exports) for tests.
 * No dependencies, no network, no DOM.
 *
 * Every generator returns a worksheet object:
 *   { type, title, instructions, problems: [...] }
 * Every problem carries the structured fields it was built from PLUS an
 * answerText computed at construction time, so the answer key always
 * matches the worksheet exactly (same order, same numbering).
 */
(function (global) {
  'use strict';

  /* ---------------- RNG helpers (same as Puzzle Book Generator) ---------------- */

  function makeRng(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randInt(rng, n) { return Math.floor(rng() * n); }
  function randRange(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(rng, i + 1);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function pick(rng, arr) { return arr[randInt(rng, arr.length)]; }

  /* ---------------- Small numeric helpers ---------------- */

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = a % b; a = b; b = t; }
    return a || 1;
  }

  /* Reduced [num, den] pair. */
  function reduceFraction(n, d) {
    var g = gcd(n, d);
    return [n / g, d / g];
  }

  /* Answer text for a fraction value: whole numbers print bare. */
  function fractionText(n, d) {
    if (d === 0) return '0';
    if (n === 0) return '0';
    var r = reduceFraction(n, d);
    return r[1] === 1 ? String(r[0]) : r[0] + '/' + r[1];
  }

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  /* Build `count` problems from maker(), skipping duplicates by key(). */
  function dedupe(count, maker, keyFn) {
    var out = [], seen = {}, tries = 0, limit = count * 80;
    while (out.length < count && tries < limit) {
      tries++;
      var p = maker();
      if (!p) continue;
      var k = keyFn(p);
      if (seen[k]) continue;
      seen[k] = true;
      out.push(p);
    }
    while (out.length < count) { // pool exhausted (tiny ranges) — allow repeats
      var q = maker();
      if (q) out.push(q);
    }
    return out;
  }

  function arithKey(p) { return p.op + ':' + p.a + ':' + p.b; }

  function arithProblem(op, a, b, answer, remainder) {
    var p = { kind: 'arith', op: op, a: a, b: b, answer: answer };
    if (remainder) { p.remainder = remainder; p.answerText = answer + ' R' + remainder; }
    else p.answerText = String(answer);
    return p;
  }

  /* ---------------- Addition ---------------- */

  function makeAdd(level, rng) {
    var a, b, ta, oa, tb, ob;
    switch (level) {
      case '1digit':
        a = randRange(rng, 1, 9); b = randRange(rng, 1, 9);
        break;
      case '2digit-noreg':
        ta = randRange(rng, 1, 8); oa = randRange(rng, 0, 9);
        tb = randRange(rng, 1, 9 - ta); ob = randRange(rng, 0, 9 - oa);
        a = ta * 10 + oa; b = tb * 10 + ob;
        break;
      case '2digit-reg':
        oa = randRange(rng, 1, 9); ob = randRange(rng, 10 - oa, 9);
        ta = randRange(rng, 1, 9); tb = randRange(rng, 1, 9);
        a = ta * 10 + oa; b = tb * 10 + ob;
        break;
      case '3digit':
        a = randRange(rng, 100, 999); b = randRange(rng, 100, 999);
        break;
      default:
        a = randRange(rng, 1, 9); b = randRange(rng, 1, 9);
    }
    return arithProblem('+', a, b, a + b, 0);
  }

  function generateAddition(count, level, rng) {
    rng = rng || Math.random;
    return {
      type: 'addition', title: 'Addition',
      instructions: 'Add. Find each sum.',
      problems: dedupe(count, function () { return makeAdd(level, rng); }, arithKey)
    };
  }

  /* ---------------- Subtraction ---------------- */

  function makeSub(level, rng) {
    var a, b, ta, oa, tb, ob, tries;
    switch (level) {
      case '1digit':
        a = randRange(rng, 3, 9); b = randRange(rng, 1, a - 1);
        break;
      case '2digit-noreg':
        for (tries = 0; tries < 60; tries++) {
          ta = randRange(rng, 2, 9); oa = randRange(rng, 0, 9);
          tb = randRange(rng, 1, ta);
          ob = randRange(rng, 0, oa); // ones of b never exceed ones of a -> no borrow
          a = ta * 10 + oa; b = tb * 10 + ob;
          if (a > b) break;
        }
        if (a <= b) { a = 54; b = 23; }
        break;
      case '2digit-reg':
        ta = randRange(rng, 2, 9); oa = randRange(rng, 0, 8);
        ob = randRange(rng, oa + 1, 9); tb = randRange(rng, 1, ta - 1);
        a = ta * 10 + oa; b = tb * 10 + ob;
        break;
      case '3digit':
        a = randRange(rng, 150, 999); b = randRange(rng, 100, a - 10);
        break;
      default:
        a = randRange(rng, 3, 9); b = randRange(rng, 1, a - 1);
    }
    return arithProblem('−', a, b, a - b, 0);
  }

  function generateSubtraction(count, level, rng) {
    rng = rng || Math.random;
    return {
      type: 'subtraction', title: 'Subtraction',
      instructions: 'Subtract. Find each difference.',
      problems: dedupe(count, function () { return makeSub(level, rng); }, arithKey)
    };
  }

  /* ---------------- Multiplication ---------------- */

  /* Ranges are "times tables": table base 2..max, multiplier 2..12.
   * '2x1' is a 2-digit number times a 1-digit number. */
  function makeMul(range, rng) {
    var a, b;
    if (range === '2x1') {
      a = randRange(rng, 12, 99); b = randRange(rng, 2, 9);
    } else {
      var max = range === '2-5' ? 5 : range === '2-12' ? 12 : 9;
      a = randRange(rng, 2, max); b = randRange(rng, 2, 12);
    }
    return arithProblem('×', a, b, a * b, 0);
  }

  function generateMultiplication(count, range, rng) {
    rng = rng || Math.random;
    return {
      type: 'multiplication', title: 'Multiplication',
      instructions: 'Multiply. Find each product.',
      problems: dedupe(count, function () { return makeMul(range, rng); }, arithKey)
    };
  }

  /* ---------------- Division ---------------- */

  function makeDiv(range, withRemainders, rng) {
    var max = range === '2-5' ? 5 : range === '2-12' ? 12 : 9;
    var d = randRange(rng, 2, max);
    var q = randRange(rng, 2, 12);
    var r = 0;
    if (withRemainders) r = randRange(rng, 1, d - 1);
    var dividend = d * q + r;
    return arithProblem('÷', dividend, d, q, r);
  }

  function generateDivision(count, range, withRemainders, rng) {
    rng = rng || Math.random;
    return {
      type: 'division', title: 'Division',
      instructions: withRemainders
        ? 'Divide. Write the quotient and remainder (like 7 R2) when there is one.'
        : 'Divide. Find each quotient.',
      problems: dedupe(count, function () { return makeDiv(range, withRemainders, rng); }, arithKey)
    };
  }

  /* ---------------- Mixed operations ---------------- */

  var MIXED_OPS = ['+', '−', '×', '÷'];

  function mixedMaker(op, level, rng) {
    if (level === 'easy') {
      if (op === '+') return makeAdd('1digit', rng);
      if (op === '−') return makeSub('1digit', rng);
      if (op === '×') return makeMul('2-5', rng);
      return makeDiv('2-5', false, rng);
    }
    if (level === 'hard') {
      if (op === '+') return makeAdd('3digit', rng);
      if (op === '−') return makeSub('3digit', rng);
      if (op === '×') return makeMul(pick(rng, ['2-12', '2x1']), rng);
      return makeDiv('2-12', rng() < 0.5, rng);
    }
    // medium
    if (op === '+') return makeAdd(pick(rng, ['2digit-noreg', '2digit-reg']), rng);
    if (op === '−') return makeSub(pick(rng, ['2digit-noreg', '2digit-reg']), rng);
    if (op === '×') return makeMul(pick(rng, ['2-9', '2x1']), rng);
    return makeDiv('2-9', false, rng);
  }

  function generateMixed(count, level, rng) {
    rng = rng || Math.random;
    // cycle the four operations (shuffled) so every worksheet is a real mix
    var ops = [];
    while (ops.length < count) {
      var round = shuffle(MIXED_OPS.slice(), rng);
      for (var i = 0; i < round.length && ops.length < count; i++) ops.push(round[i]);
    }
    var seen = {}, problems = [];
    ops.forEach(function (op) {
      var p = null, tries = 0;
      while (tries < 60) {
        tries++;
        var cand = mixedMaker(op, level, rng);
        if (!seen[arithKey(cand)]) { seen[arithKey(cand)] = true; p = cand; break; }
      }
      problems.push(p || mixedMaker(op, level, rng));
    });
    return {
      type: 'mixed', title: 'Mixed Operations',
      instructions: 'Solve each problem. Watch the sign!',
      problems: problems
    };
  }

  /* ---------------- Money (USD) ---------------- */

  var COINS = [
    { denom: 'quarter', label: '25¢', cents: 25, kind: 'coin' },
    { denom: 'dime', label: '10¢', cents: 10, kind: 'coin' },
    { denom: 'nickel', label: '5¢', cents: 5, kind: 'coin' },
    { denom: 'penny', label: '1¢', cents: 1, kind: 'coin' }
  ];
  var BILLS = [
    { denom: 'ten', label: '$10', cents: 1000, kind: 'bill' },
    { denom: 'five', label: '$5', cents: 500, kind: 'bill' },
    { denom: 'one', label: '$1', cents: 100, kind: 'bill' }
  ];

  function moneyItemsTotal(items) {
    var total = 0;
    items.forEach(function (it) { total += it.cents * it.count; });
    return total;
  }

  function makeMoneyCount(rng) {
    var withBills = rng() < 0.4;
    var counts = {};
    var items = [], totalCount = 0, tries = 0;
    while (tries < 60) {
      tries++;
      items = []; totalCount = 0;
      counts = {
        quarter: randRange(rng, 0, 3), dime: randRange(rng, 0, 4),
        nickel: randRange(rng, 0, 2), penny: randRange(rng, 0, 4),
        ten: withBills ? randRange(rng, 0, 1) : 0,
        five: withBills ? randRange(rng, 0, 2) : 0,
        one: withBills ? randRange(rng, 0, 3) : 0
      };
      BILLS.concat(COINS).forEach(function (d) {
        if (counts[d.denom] > 0) {
          items.push({ denom: d.denom, label: d.label, cents: d.cents, kind: d.kind, count: counts[d.denom] });
          totalCount += counts[d.denom];
        }
      });
      var total = moneyItemsTotal(items);
      if (totalCount >= 2 && total >= 10 && (!withBills || counts.ten + counts.five + counts.one >= 1)) break;
      items = [];
    }
    if (!items.length) { // deterministic fallback
      items = [
        { denom: 'quarter', label: '25¢', cents: 25, kind: 'coin', count: 2 },
        { denom: 'dime', label: '10¢', cents: 10, kind: 'coin', count: 1 }
      ];
    }
    var totalCents = moneyItemsTotal(items);
    return {
      kind: 'money-count', items: items, totalCents: totalCents,
      prompt: 'How much money is shown?',
      answerText: formatMoney(totalCents)
    };
  }

  function makeMoneyAdd(rng) {
    function amount() {
      var dollars = randRange(rng, 0, 9);
      var cents = pick(rng, [0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 90, 95]);
      if (dollars === 0 && cents === 0) cents = 25;
      return dollars * 100 + cents;
    }
    var a = amount(), b = amount();
    return {
      kind: 'money-add', aCents: a, bCents: b, answerCents: a + b,
      prompt: formatMoney(a) + ' + ' + formatMoney(b) + ' = ?',
      answerText: formatMoney(a + b)
    };
  }

  function moneyKey(p) {
    if (p.kind === 'money-add') return 'add:' + p.aCents + ':' + p.bCents;
    return 'count:' + p.items.map(function (it) { return it.denom + 'x' + it.count; }).join(',');
  }

  function generateMoney(count, mode, rng) {
    rng = rng || Math.random;
    var maker;
    if (mode === 'count') maker = function () { return makeMoneyCount(rng); };
    else if (mode === 'add') maker = function () { return makeMoneyAdd(rng); };
    else {
      var flip = false;
      maker = function () { flip = !flip; return flip ? makeMoneyCount(rng) : makeMoneyAdd(rng); };
    }
    return {
      type: 'money', title: 'Money',
      instructions: 'Count the money, or add the amounts. Write your answer in dollars and cents.',
      problems: dedupe(count, maker, moneyKey)
    };
  }

  /* ---------------- Fractions ---------------- */

  function makeFracIdentify(rng) {
    var shape = rng() < 0.5 ? 'circle' : 'rect';
    var parts = shape === 'circle'
      ? pick(rng, [2, 3, 4, 6, 8])
      : pick(rng, [3, 4, 5, 6, 8, 10, 12]);
    var shaded = randRange(rng, 1, parts - 1);
    var red = reduceFraction(shaded, parts);
    return {
      kind: 'frac-identify', shape: shape, parts: parts, shaded: shaded,
      prompt: 'What fraction is shaded?',
      answerNum: red[0], answerDen: red[1],
      answerText: fractionText(shaded, parts)
    };
  }

  function makeFracEquiv(rng) {
    var den, num, tries = 0;
    do {
      den = pick(rng, [3, 4, 5, 6, 8]);
      num = randRange(rng, 1, den - 1);
      tries++;
    } while (gcd(num, den) !== 1 && tries < 40);
    if (gcd(num, den) !== 1) { num = 1; den = 3; }
    var scale = randRange(rng, 2, 4);
    return {
      kind: 'frac-equiv', num: num, den: den, scale: scale,
      answerNum: num * scale, answerDen: den * scale,
      prompt: 'Find the missing number.',
      answerText: String(num * scale)
    };
  }

  function makeFracAdd(rng) {
    var den = pick(rng, [4, 6, 8, 10, 12]);
    var n1 = randRange(rng, 1, den - 2);
    var n2 = randRange(rng, 1, den - n1);
    var red = reduceFraction(n1 + n2, den);
    return {
      kind: 'frac-add', n1: n1, n2: n2, den: den,
      answerNum: red[0], answerDen: red[1],
      prompt: 'Add the fractions.',
      answerText: fractionText(n1 + n2, den)
    };
  }

  function fracKey(p) {
    if (p.kind === 'frac-identify') return 'id:' + p.shape + ':' + p.parts + ':' + p.shaded;
    if (p.kind === 'frac-equiv') return 'eq:' + p.num + '/' + p.den + 'x' + p.scale;
    return 'add:' + p.n1 + '+' + p.n2 + '/' + p.den;
  }

  function generateFractions(count, mode, rng) {
    rng = rng || Math.random;
    var maker;
    if (mode === 'identify') maker = function () { return makeFracIdentify(rng); };
    else if (mode === 'equiv') maker = function () { return makeFracEquiv(rng); };
    else if (mode === 'add') maker = function () { return makeFracAdd(rng); };
    else {
      var kinds = [
        function () { return makeFracIdentify(rng); },
        function () { return makeFracEquiv(rng); },
        function () { return makeFracAdd(rng); }
      ];
      var i = 0;
      maker = function () { return kinds[i++ % 3](); };
    }
    return {
      type: 'fractions', title: 'Fractions',
      instructions: 'Answer each fraction question.',
      problems: dedupe(count, maker, fracKey)
    };
  }

  /* ---------------- Word problems ---------------- */

  var WP_NAMES = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Mason', 'Sophia',
    'Lucas', 'Mia', 'Ethan', 'Isabella', 'James', 'Benjamin', 'Charlotte',
    'Henry', 'Amelia', 'Leo', 'Grace', 'Owen', 'Lily'];
  var WP_OBJECTS = ['marbles', 'stickers', 'pencils', 'apples', 'oranges',
    'books', 'cookies', 'crayons', 'baseball cards', 'seashells', 'toy cars',
    'balloons', 'cupcakes', 'buttons', 'coins', 'rocks', 'cards', 'beads',
    'plums', 'peaches'];

  function makeWordProblem(op, rng) {
    var name = pick(rng, WP_NAMES);
    var obj = pick(rng, WP_OBJECTS);
    var a, b, answer, text;
    if (op === '+') {
      a = randRange(rng, 12, 95); b = randRange(rng, 11, 88);
      answer = a + b;
      text = name + ' has ' + a + ' ' + obj + '. ' + name + ' finds ' + b +
        ' more ' + obj + '. How many ' + obj + ' does ' + name + ' have in all?';
    } else if (op === '−') {
      a = randRange(rng, 25, 98); b = randRange(rng, 11, a - 5);
      answer = a - b;
      text = name + ' had ' + a + ' ' + obj + '. ' + name + ' gave ' + b +
        ' ' + obj + ' to a friend. How many ' + obj + ' does ' + name + ' have left?';
    } else if (op === '×') {
      a = randRange(rng, 2, 9); b = randRange(rng, 2, 12);
      answer = a * b;
      text = name + ' has ' + a + ' boxes. Each box has ' + b + ' ' + obj +
        '. How many ' + obj + ' does ' + name + ' have in all?';
    } else { // '÷'
      b = randRange(rng, 2, 9);
      var q = randRange(rng, 2, 12);
      a = b * q; answer = q;
      text = name + ' shares ' + a + ' ' + obj + ' equally among ' + b +
        ' friends. How many ' + obj + ' does each friend get?';
    }
    return {
      kind: 'word', text: text, a: a, op: op, b: b, answer: answer,
      unit: obj, answerText: answer + ' ' + obj
    };
  }

  function generateWordProblems(count, rng) {
    rng = rng || Math.random;
    var ops = [];
    while (ops.length < count) {
      var round = shuffle(MIXED_OPS.slice(), rng);
      for (var i = 0; i < round.length && ops.length < count; i++) ops.push(round[i]);
    }
    var seen = {}, problems = [];
    ops.forEach(function (op) {
      var p = null, tries = 0;
      while (tries < 60) {
        tries++;
        var cand = makeWordProblem(op, rng);
        if (!seen[cand.text]) { seen[cand.text] = true; p = cand; break; }
      }
      problems.push(p || makeWordProblem(op, rng));
    });
    return {
      type: 'word', title: 'Word Problems',
      instructions: 'Read each problem. Show your work in the space below, then write the answer.',
      problems: problems
    };
  }

  /* ---------------- Answer key ---------------- */

  /* The key is derived from the worksheet itself, so order and numbering
   * always match the printed problems exactly. */
  function answerKey(worksheet) {
    return worksheet.problems.map(function (p) { return p.answerText; });
  }

  /* ---------------- Book assembly (pure; used by book.js) ---------------- */

  var BOOK_TYPE_ORDER = ['addition', 'subtraction', 'multiplication', 'division',
    'mixed', 'money', 'fractions', 'word'];

  /*
   * spec: { counts: {addition: n, ...}, difficulty: 'easy'|'medium'|'hard',
   *         perWorksheet: n, divisionRemainders: bool }
   * Returns an array of worksheets in BOOK_TYPE_ORDER.
   */
  function assembleBook(spec, rng) {
    rng = rng || Math.random;
    spec = spec || {};
    var counts = spec.counts || {};
    var per = Math.max(1, Math.min(25, spec.perWorksheet || 20));
    var diff = spec.difficulty || 'medium';
    var addLevel = diff === 'easy' ? '1digit' : diff === 'hard' ? '3digit' : '2digit-reg';
    var mulRange = diff === 'easy' ? '2-5' : diff === 'hard' ? '2-12' : '2-9';
    var makers = {
      addition: function () { return generateAddition(per, addLevel, rng); },
      subtraction: function () { return generateSubtraction(per, addLevel, rng); },
      multiplication: function () { return generateMultiplication(per, mulRange, rng); },
      division: function () { return generateDivision(per, mulRange, !!spec.divisionRemainders, rng); },
      mixed: function () { return generateMixed(per, diff, rng); },
      money: function () { return generateMoney(per, 'mixed', rng); },
      fractions: function () { return generateFractions(per, 'mixed', rng); },
      word: function () { return generateWordProblems(per, rng); }
    };
    var sets = [];
    BOOK_TYPE_ORDER.forEach(function (type) {
      var n = Math.max(0, Math.min(100, counts[type] || 0));
      for (var i = 0; i < n; i++) sets.push(makers[type]());
    });
    return sets;
  }

  /* ---------------- API ---------------- */

  var api = {
    makeRng: makeRng, randInt: randInt, randRange: randRange,
    shuffle: shuffle, pick: pick,
    gcd: gcd, reduceFraction: reduceFraction, fractionText: fractionText,
    formatMoney: formatMoney, moneyItemsTotal: moneyItemsTotal,
    generateAddition: generateAddition,
    generateSubtraction: generateSubtraction,
    generateMultiplication: generateMultiplication,
    generateDivision: generateDivision,
    generateMixed: generateMixed,
    generateMoney: generateMoney,
    generateFractions: generateFractions,
    generateWordProblems: generateWordProblems,
    answerKey: answerKey,
    assembleBook: assembleBook,
    BOOK_TYPE_ORDER: BOOK_TYPE_ORDER,
    COINS: COINS, BILLS: BILLS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.MW = api;
})(typeof window !== 'undefined' ? window : globalThis);
