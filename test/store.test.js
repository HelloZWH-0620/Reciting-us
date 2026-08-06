/**
 * Store module unit tests
 * Run: node test/store.test.js
 *
 * These tests verify the localStorage-backed Store abstraction layer,
 * including the newly added streak, study time, and last state methods.
 */

// Mock localStorage for Node.js
var storage = {};
global.localStorage = {
  getItem: function(key) { return key in storage ? storage[key] : null; },
  setItem: function(key, val) { storage[key] = String(val); },
  removeItem: function(key) { delete storage[key]; },
  clear: function() { storage = {}; }
};

// Mock Date.now for deterministic testing
var fixedNow = new Date('2025-06-15T10:00:00').getTime();
var origDateNow = Date.now;
Date.now = function() { return fixedNow; };

var tests = [];
var assertCount = 0;
var passCount = 0;

function test(name, fn) {
  tests.push({ name: name, fn: fn });
}

function assertEqual(actual, expected, msg) {
  assertCount++;
  var actualStr = JSON.stringify(actual);
  var expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    passCount++;
  } else {
    throw new Error((msg || 'Assertion failed') + ': expected ' + expectedStr + ', got ' + actualStr);
  }
}

// --- Store implementation (extracted from app.js) ---
// We test the core logic, not the DOM-dependent parts

var Store = {
  get: function(key, def) {
    try { var v = localStorage.getItem('bsw_' + key); return v === null ? def : JSON.parse(v); }
    catch(e) { return def; }
  },
  set: function(key, val) { try { localStorage.setItem('bsw_' + key, JSON.stringify(val)); } catch(e) {} },

  getStreak: function() {
    var s = this.get('streak', { days: 0, lastDate: '' });
    if (s.lastDate) {
      var today = this.getDailyKey();
      if (s.lastDate !== today) {
        var last = new Date(s.lastDate);
        var now = new Date(today);
        var diff = Math.round((now - last) / 86400000);
        if (diff > 1) { s.days = 0; }
      }
    }
    return s;
  },
  updateStreak: function() {
    var s = this.get('streak', { days: 0, lastDate: '' });
    var today = this.getDailyKey();
    if (s.lastDate === today) return s;
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var yKey = yesterday.getFullYear() + '-' +
      ('0' + (yesterday.getMonth() + 1)).slice(-2) + '-' +
      ('0' + yesterday.getDate()).slice(-2);
    if (s.lastDate === yKey) { s.days = (s.days || 0) + 1; }
    else if (s.lastDate === today) { /* already counted */ }
    else { s.days = 1; }
    s.lastDate = today;
    this.set('streak', s);
    return s;
  },
  addStudyTime: function(minutes) {
    var dk = this.getDailyKey();
    this.recordDaily(dk, 'studyTime', minutes);
  },
  getStudyTime: function() {
    var ds = this.getDailyStats();
    var total = 0;
    for (var d in ds) { total += (ds[d].studyTime || 0); }
    var today = this.getDailyKey();
    var todayTime = (ds[today] && ds[today].studyTime) || 0;
    return { total: total, today: todayTime };
  },
  getDailyStats: function() { return this.get('dailyStats', {}); },
  getDailyKey: function(d) {
    var dd = d ? new Date(d) : new Date();
    var m = dd.getMonth() + 1;
    var day = dd.getDate();
    return dd.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  },
  recordDaily: function(date, field, value) {
    var ds = this.getDailyStats();
    if (!ds[date]) ds[date] = { attempts: 0, correct: 0, studyTime: 0 };
    ds[date][field] = (ds[date][field] || 0) + value;
    this.set('dailyStats', ds);
  },
  setLastState: function(state) { this.set('lastState', state); },
  getLastState: function() { return this.get('lastState', null); },

  // Wrong book with UID
  getWrongBook: function() { return this.get('wrongbook', []); },
  addWrongBook: function(item) {
    var wb = this.getWrongBook();
    item.reviewLevel = item.reviewLevel || 0;
    item.nextReviewDate = item.nextReviewDate || (Date.now() + 86400000);
    item.uid = item.uid || ('w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
    wb.push(item);
    this.set('wrongbook', wb);
  },
  removeWrongBook: function(idx) {
    var wb = this.getWrongBook();
    if (typeof idx === 'string') {
      for (var i = 0; i < wb.length; i++) { if (wb[i].uid === idx) { wb.splice(i, 1); break; } }
    } else { wb.splice(idx, 1); }
    this.set('wrongbook', wb);
  },
  clearWrongBook: function() { this.set('wrongbook', []); },
  getTodayWrongReviews: function() {
    var wb = this.getWrongBook();
    var now = Date.now();
    var result = [];
    for (var i = 0; i < wb.length; i++) {
      var item = wb[i];
      if (!item.nextReviewDate || item.nextReviewDate <= now) result.push(item.uid || i);
    }
    return result;
  }
};

// ===== TESTS =====

test('Store.get/set basic round-trip', function() {
  localStorage.clear();
  Store.set('testKey', { a: 1, b: 'hello' });
  var result = Store.get('testKey');
  assertEqual(result, { a: 1, b: 'hello' }, 'Basic set/get');
});

test('Store.get returns default when key missing', function() {
  localStorage.clear();
  var result = Store.get('nonexistent', 'defaultVal');
  assertEqual(result, 'defaultVal', 'Default value returned');
});

test('Store.getStreak returns empty streak on first use', function() {
  localStorage.clear();
  var streak = Store.getStreak();
  assertEqual(streak, { days: 0, lastDate: '' }, 'Initial streak is empty');
});

test('Store.updateStreak sets days=1 on first call', function() {
  localStorage.clear();
  var streak = Store.updateStreak();
  assertEqual(streak.days, 1, 'First streak is 1 day');
  assertEqual(streak.lastDate, Store.getDailyKey(), 'lastDate is today');
});

test('Store.updateStreak does not double-count same day', function() {
  localStorage.clear();
  Store.updateStreak();
  Store.updateStreak();
  var streak = Store.getStreak();
  assertEqual(streak.days, 1, 'Same day streak stays at 1');
});

test('Store.addStudyTime accumulates correctly', function() {
  localStorage.clear();
  Store.addStudyTime(5);
  Store.addStudyTime(10);
  var st = Store.getStudyTime();
  assertEqual(st.today, 15, 'Today study time is 15');
  assertEqual(st.total, 15, 'Total study time is 15');
});

test('Store.setLastState/getLastState round-trip', function() {
  localStorage.clear();
  var state = { mode: 'learn', tab: 'wen', articleId: 'lunyu' };
  Store.setLastState(state);
  var result = Store.getLastState();
  assertEqual(result, state, 'Last state round-trip');
});

test('Store.getLastState returns null when not set', function() {
  localStorage.clear();
  var result = Store.getLastState();
  assertEqual(result, null, 'Last state is null initially');
});

test('Store.addWrongBook assigns UID', function() {
  localStorage.clear();
  Store.addWrongBook({ type: 'blank', question: 'test', correctAnswer: 'answer' });
  var wb = Store.getWrongBook();
  assertEqual(wb.length, 1, 'Wrong book has 1 item');
  assertEqual(typeof wb[0].uid, 'string', 'Item has UID');
  assertEqual(wb[0].uid.length > 2, true, 'UID is non-trivial');
});

test('Store.getTodayWrongReviews returns UIDs', function() {
  localStorage.clear();
  // Add items with nextReviewDate in the past (already due)
  Store.addWrongBook({ type: 'blank', question: 'q1', correctAnswer: 'a1', nextReviewDate: fixedNow - 1000 });
  Store.addWrongBook({ type: 'blank', question: 'q2', correctAnswer: 'a2', nextReviewDate: fixedNow - 1000 });
  var reviews = Store.getTodayWrongReviews();
  assertEqual(reviews.length, 2, '2 items due for review');
  assertEqual(typeof reviews[0], 'string', 'Review item is UID string');
});

test('Store.removeWrongBook by UID does not shift other indices', function() {
  localStorage.clear();
  Store.addWrongBook({ type: 'blank', question: 'q1', correctAnswer: 'a1' });
  Store.addWrongBook({ type: 'blank', question: 'q2', correctAnswer: 'a2' });
  Store.addWrongBook({ type: 'blank', question: 'q3', correctAnswer: 'a3' });
  var wb = Store.getWrongBook();
  var middleUid = wb[1].uid;
  // Remove middle item by UID
  Store.removeWrongBook(middleUid);
  var wb2 = Store.getWrongBook();
  assertEqual(wb2.length, 2, '2 items remain after removal');
  assertEqual(wb2[0].question, 'q1', 'First item unchanged');
  assertEqual(wb2[1].question, 'q3', 'Third item is now second');
});

// ===== RUN =====

var failCount = 0;
tests.forEach(function(t) {
  try {
    t.fn();
    console.log('  PASS: ' + t.name);
  } catch(e) {
    failCount++;
    console.error('  FAIL: ' + t.name + ' - ' + e.message);
  }
});

console.log('\n' + (passCount - failCount) + '/' + assertCount + ' assertions passed, ' +
  (tests.length - failCount) + '/' + tests.length + ' tests passed.');

// Restore Date.now
Date.now = origDateNow;

process.exit(failCount > 0 ? 1 : 0);
