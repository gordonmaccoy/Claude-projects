const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const publicDir = path.join(__dirname, '..', 'public');

test('public root entrypoint brands Examio and preserves professor workspace route', () => {
  const home = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const professor = fs.readFileSync(path.join(publicDir, 'professor.html'), 'utf8');

  assert.match(home, /<title>Examio/);
  assert.match(home, /href=["']\/professor\.html["']/);
  assert.match(home, /href="#how-it-works">See how it works/);
  assert.match(home, /<section class="section-wrap walkthrough" id="how-it-works"/);
  assert.match(professor, /<title>Examio.*Professor workspace/);
});

test('carousel rotates counter-clockwise every three seconds and pauses accessibly', () => {
  const cards = [
    { dataset: {screen: 'student', position: 'left'}, querySelector: () => ({textContent: 'Student test'}) },
    { dataset: {screen: 'classroom', position: 'center'}, querySelector: () => ({textContent: 'Classroom display'}) },
    { dataset: {screen: 'professor', position: 'right'}, querySelector: () => ({textContent: 'Professor dashboard'}) }
  ];
  const handlers = new Map();
  const makeButton = () => ({
    handlers: {}, attributes: {}, textContent: '',
    addEventListener(type, callback) { this.handlers[type] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; },
    click() { this.handlers.click(); }
  });
  const carousel = {
    querySelectorAll() { return cards; },
    contains() { return false; }
  };
  const stage = {
    addEventListener(type, callback) { handlers.set(type, callback); },
    contains() { return false; }
  };
  const previous = makeButton();
  const next = makeButton();
  const pause = makeButton();
  const status = {textContent: ''};
  const selectors = new Map([
    ['#preview-carousel', carousel],
    ['#preview-stage', stage],
    ['[data-carousel-action="previous"]', previous],
    ['[data-carousel-action="next"]', next],
    ['[data-carousel-action="pause"]', pause],
    ['#carousel-status', status]
  ]);
  const documentHandlers = new Map();
  const document = {
    hidden: false,
    querySelector(selector) { return selectors.get(selector) || null; },
    addEventListener(type, callback) { documentHandlers.set(type, callback); }
  };
  const motion = {matches: false, addEventListener() {}};
  let interval = null;
  let intervalDelay = null;
  const window = {
    examioLanguage: {setup() {}, t: (text, values) => values ? text.replace('{screen}', values.screen) : text},
    matchMedia: () => motion,
    clearInterval() { interval = null; },
    setInterval(callback, delay) { interval = callback; intervalDelay = delay; return 1; }
  };
  const scriptPath = path.join(__dirname, '..', 'public', 'landing.js');
  assert.equal(fs.existsSync(scriptPath), true, 'landing carousel controller is implemented');
  const source = fs.readFileSync(scriptPath, 'utf8');
  vm.runInNewContext(source, {document, window});

  assert.equal(intervalDelay, 3000);
  interval();
  assert.deepEqual(cards.map(card => card.dataset.position), ['right', 'left', 'center']);
  assert.equal(status.textContent, 'Professor dashboard preview is in the center.');
  pause.click();
  assert.equal(interval, null);
  assert.equal(pause.textContent, 'Resume');
  assert.equal(pause.attributes['aria-pressed'], 'true');
  pause.click();
  assert.equal(intervalDelay, 3000);
  handlers.get('pointerenter')();
  assert.equal(interval, null);
  handlers.get('pointerleave')();
  assert.equal(intervalDelay, 3000);
  handlers.get('focusin')();
  assert.equal(interval, null);
  handlers.get('focusout')({relatedTarget: null});
  assert.equal(intervalDelay, 3000);
  next.click();
  assert.equal(cards.find(card => card.dataset.position === 'center').querySelector('figcaption').textContent, 'Student test');
  motion.matches = true;
  documentHandlers.get('visibilitychange')();
  assert.equal(interval, null);
});
