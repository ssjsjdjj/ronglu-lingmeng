const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, matches, legalMoves, adjacent } = require('../src/engine');
const { createGame, KEY } = require('../src/game-app');

function platform(stored, windowInfo = {}) {
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({ measureText: s => ({ width: String(s).length * 7 }), createLinearGradient: () => gradient, createRadialGradient: () => gradient }, {
    get(target, key) { return key in target ? target[key] : () => {}; }
  });
  let now = 1000, serial = 0;
  const frames = new Map();
  const p = {
    canvas: { getContext: () => ctx }, handlers: null, saved: null,
    getWindow: () => ({ width: 390, height: 844, pixelRatio: 2, top: 24, bottom: 20, ...windowInfo }),
    createImage() { return { set src(_) { this.onload(); } }; },
    read: () => stored, write: (key, value) => { assert.equal(key, KEY); p.saved = structuredClone(value); },
    bind: handlers => { p.handlers = handlers; return () => { p.unbound = true; }; },
    now: () => now, requestFrame: cb => { frames.set(++serial, cb); return serial; }, cancelFrame: id => frames.delete(id),
    enableAudio() {}, tone() {}, pauseAudio() {},
    advance(ms = 250) { now += ms; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb()); },
    get frameCount() { return frames.size; }
  };
  return p;
}
function ready(p = platform()) {
  const app = createGame(p);
  if (!app.game.boon) { app.act('boon:torrent'); for (let i = 0; i < 5; i++) p.advance(); }
  return { app, p };
}
function settle(app, p) { for (let i = 0; app.pending && i < 200; i++) p.advance(); assert.equal(app.pending, null); }

test('200 seeded boards begin settled and playable; valid swaps keep board invariants', () => {
  for (let seed = 0; seed < 200; seed++) {
    const g = new Game({ seed, level: seed % 5 });
    assert.equal(matches(g.board).length, 0);
    const [a, b] = legalMoves(g.board)[0]; assert.ok(adjacent(a, b));
    const moves = g.moves; assert.equal(g.swap(a, b).valid, true);
    assert.equal(g.moves, moves - 1); assert.equal(matches(g.board).length, 0);
    assert.equal(g.board.length, 64); assert.equal(new Set(g.board.map(t => t.id)).size, 64);
  }
});
test('invalid swaps do not cost steps or alter the board', () => {
  const g = new Game({ seed: 24 }), before = g.exportState();
  const valid = new Set(legalMoves(g.board).map(pair => pair.join(',')));
  let pair;
  for (let a = 0; a < 63 && !pair; a++) if (a % 8 < 7 && !valid.has([a, a + 1].join(','))) pair = [a, a + 1];
  assert.equal(g.swap(...pair).valid, false); assert.deepEqual(g.exportState(), before);
});
test('six hero skills and cross-hero links remain free of step costs', () => {
  for (let hero = 0; hero < 6; hero++) {
    const g = new Game({ seed: hero + 42, zen: true }); g.chooseBoon('torrent'); g.energy = g.energyMax;
    const moves = g.moves; assert.equal(g.skill(hero).valid, true); assert.equal(g.moves, moves);
    assert.ok(g.link); assert.equal(g.linkSkill((hero + 1) % 6).valid, true); assert.equal(g.moves, moves);
    assert.equal(g.linkUses, 1); assert.equal(matches(g.board).length, 0);
  }
});
test('saving and restoring preserves deterministic next moves and challenge state', () => {
  const g = new Game({ seed: 190, challenge: true }); g.chooseBoon('shatter');
  g.swap(...legalMoves(g.board)[0]);
  const restored = Game.restore(JSON.parse(JSON.stringify(g.exportState())));
  assert.ok(restored); assert.deepEqual(restored.exportState(), g.exportState());
  const pair = legalMoves(g.board)[0];
  assert.deepEqual(restored.swap(...pair), g.swap(...pair));
});
test('boon modal blocks board input and hit targets route taps to their actions', () => {
  const p = platform(), app = createGame(p), before = app.game.exportState();
  const r = app.renderer, screen = (x, y) => ({ x: r.ox + x * r.scale, y: r.oy + y * r.scale, id: 1 });
  p.handlers.start(screen(45, 210)); p.handlers.end(screen(90, 210));
  assert.deepEqual(app.game.exportState(), before);
  const hit = r.hits[0], point = screen(hit.x + hit.w / 2, hit.y + hit.h / 2);
  p.handlers.start(point); p.handlers.end(point); settle(app, p);
  assert.equal(app.game.boon, 'torrent'); assert.equal(app.modal, null); app.destroy();
});
test('swipe coordinates map to board exchanges and mismatched pointers are ignored', () => {
  const { app, p } = ready(), r = app.renderer;
  const [a, b] = legalMoves(app.game.board)[0];
  const point = (i, id = 1) => ({ x: r.ox + (24 + i % 8 * 42.75 + 21) * r.scale, y: r.oy + (188 + Math.floor(i / 8) * 42.75 + 21) * r.scale, id });
  const moves = app.game.moves;
  p.handlers.start(point(a)); p.handlers.end(point(b, 2)); assert.equal(app.game.moves, moves);
  p.handlers.start(point(a)); p.handlers.end(point(b)); settle(app, p);
  assert.equal(app.game.moves, moves - 1); assert.ok(p.saved.active); app.destroy();
});
test('hiding during a cascade saves final state and stops animation; returning requires resume', () => {
  const { app, p } = ready(); app.play(app.game.swap(...legalMoves(app.game.board)[0]));
  assert.ok(app.pending); p.handlers.hide();
  assert.equal(app.pending, null); assert.equal(p.frameCount, 0); assert.equal(app.hidden, true);
  assert.deepEqual(p.saved.active.board, app.game.board);
  p.handlers.show(); assert.ok(app.modal); assert.equal(p.frameCount, 1);
  app.act('close'); assert.equal(app.modal, null); app.destroy(); assert.equal(p.frameCount, 0); assert.ok(p.unbound);
});
test('restoring a saved session preserves board, selected hero, boon and shuffle allowance', () => {
  const { app, p } = ready(); app.act('hero:5'); app.act('shuffle'); settle(app, p); app.hide();
  const p2 = platform(p.saved), restored = createGame(p2);
  assert.deepEqual(restored.game.exportState(), app.game.exportState());
  assert.equal(restored.hero, 5); assert.equal(restored.shuffles, 1); assert.equal(restored.modal, null);
  restored.destroy(); app.destroy();
});
test('malformed storage and unavailable storage do not prevent play', () => {
  for (const stored of ['{broken', { unlocked: 99, hero: -3, stars: 'bad', active: { board: [] } }]) {
    const p = platform(stored), app = createGame(p); assert.equal(app.game.board.length, 64); app.destroy();
  }
  const p = platform(); p.write = () => { throw new Error('quota exceeded'); };
  const { app } = ready(p); assert.ok(app.toast.text.includes('存档')); assert.equal(app.game.boon, 'torrent'); app.destroy();
});

test('WeChat empty storage starts a new game without a corrupted-save warning', () => {
  for (const empty of ['', '   ', null, undefined]) {
    const app = createGame(platform(empty));
    assert.equal(app.game.level, 0);
    assert.equal(app.game.board.length, 64);
    assert.equal(app.message, '交换相邻小兽，三个相连即可消除');
    assert.ok(app.modal);
    app.destroy();
  }
});
test('winning updates stars and unlocks once, removes active game, and can open next level', () => {
  const { app, p } = ready(); app.game.status = 'won'; app.game.score = 1800; app.game.moves = 9; app.settle();
  assert.equal(p.saved.unlocked, 1); assert.equal(p.saved.stars[0], 3); assert.equal(p.saved.active, null);
  app.settle(); assert.equal(p.saved.unlocked, 1); app.act('start:1'); assert.equal(app.game.level, 1); assert.equal(app.game.status, 'playing');
  app.destroy();
});
test('locked levels cannot be opened; cancelled confirmations preserve current board', () => {
  const { app, p } = ready(), board = structuredClone(app.game.board);
  app.act('start:4'); assert.equal(app.game.level, 0);
  app.act('menu'); app.act('confirm-restart'); app.act('close'); assert.equal(app.modal, null); assert.deepEqual(app.game.board, board);
  app.act('menu'); app.act('confirm-challenge'); app.act('challenge'); settle(app, p);
  assert.ok(app.game.challenge); assert.ok(app.game.boss); app.destroy();
});
test('layout and touch inverse mapping fit small phones, safe areas and desktops', () => {
  for (const [width, height, top, bottom] of [[320,568,24,0],[375,667,44,20],[390,844,90,34],[430,932,90,34],[1920,1080,0,0]]) {
    const { app } = ready(platform(null, { width, height, top, bottom })), r = app.renderer;
    assert.ok(r.ox >= -0.01); assert.ok(r.oy >= top); assert.ok(r.oy + 790 * r.scale <= height - bottom + 0.01);
    for (const hit of r.hits) { assert.ok(hit.x >= 0 && hit.x + hit.w <= 390); assert.ok(hit.y >= 0 && hit.y + hit.h <= 790); }
    const pos = r.point({ x: r.ox + 100 * r.scale, y: r.oy + 300 * r.scale });
    assert.ok(Math.abs(pos.x - 100) < 0.001); assert.ok(Math.abs(pos.y - 300) < 0.001); app.destroy();
  }
});
test('WeChat adapter boots with wx Canvas, touch, storage and lifecycle API surface', () => {
  const p = platform(), events = {};
  global.wx = {
    createCanvas: () => p.canvas, createImage: p.createImage,
    getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, screenHeight: 844, pixelRatio: 2, safeArea: { top: 44, bottom: 810 } }),
    getMenuButtonBoundingClientRect: () => ({ bottom: 80 }), getStorageSync: () => null, setStorageSync: p.write
  };
  for (const name of ['TouchStart','TouchEnd','TouchCancel','Hide','Show','WindowResize']) {
    global.wx['on' + name] = fn => { events[name] = fn; };
    global.wx['off' + name] = fn => { assert.equal(events[name], fn); delete events[name]; };
  }
  global.requestAnimationFrame = p.requestFrame; global.cancelAnimationFrame = p.cancelFrame;
  try {
    const { createPlatform } = require('../src/wechat-platform');
    const app = createGame(createPlatform()); assert.equal(app.game.board.length, 64); assert.ok(events.TouchEnd); app.destroy(); assert.equal(Object.keys(events).length, 0);
  } finally { delete global.wx; delete global.requestAnimationFrame; delete global.cancelAnimationFrame; }
});

test('all 1,000 stages create settled playable boards, correct frost counts and legal turns', () => {
  const { LEVELS, LEVEL_COUNT, CHAPTERS } = require('../src/engine');
  assert.equal(LEVEL_COUNT, 1000); assert.equal(LEVELS.length, 1000); assert.equal(CHAPTERS.length, 50);
  const signatures = new Set();
  for (let level = 0; level < LEVEL_COUNT; level++) {
    const g = new Game({ level, seed: 10000 + level }), config = g.config;
    assert.equal(config.number, level + 1); assert.equal(config.chapter, Math.floor(level / 20));
    assert.equal(matches(g.board).length, 0); assert.equal(g.iceLeft(), config.ice);
    assert.equal(g.ice.reduce((a, b) => a + b, 0), config.ice * (config.layers || 1));
    assert.ok(config.moves >= 24 && config.moves <= 32); assert.ok(config.target >= 0 && config.target < 6);
    signatures.add(JSON.stringify([config.moves, config.score, config.collect, config.ice, config.target, config.pattern, config.patternOffset, config.boss]));
    const pair = legalMoves(g.board)[0]; assert.ok(pair); assert.equal(g.swap(...pair).valid, true);
    assert.equal(matches(g.board).length, 0);
  }
  assert.ok(signatures.size > 950, 'campaign configurations should vary beyond labels');
  assert.throws(() => new Game({ level: 1000 }), RangeError); assert.throws(() => new Game({ level: -1 }), RangeError);
});
test('extended difficulty rises within bounded objectives, with a boss every ten stages', () => {
  const { LEVELS } = require('../src/engine');
  for (let i = 6; i < 1000; i++) {
    assert.ok(LEVELS[i].score >= LEVELS[i - 1].score);
    assert.ok(LEVELS[i].collect >= LEVELS[i - 1].collect);
    assert.ok(LEVELS[i].ice >= LEVELS[i - 1].ice);
    assert.equal(!!LEVELS[i].boss, (i + 1) % 10 === 0);
  }
  assert.equal(LEVELS[999].score, 36000); assert.equal(LEVELS[999].collect, 100); assert.equal(LEVELS[999].ice, 52);
  assert.ok(LEVELS[999].score / LEVELS[999].moves > LEVELS[5].score / LEVELS[5].moves);
  assert.equal(LEVELS[999].boss.interval, 3);
});
test('late stage saves restore board, RNG, boss timing and deterministic subsequent actions', () => {
  for (const level of [5, 19, 499, 699, 999]) {
    const g = new Game({ level, seed: 101 + level }); g.chooseBoon('shatter');
    const restored = Game.restore(structuredClone(g.exportState()));
    assert.ok(restored); assert.deepEqual(restored.exportState(), g.exportState());
    const pair = legalMoves(g.board)[0]; assert.deepEqual(restored.swap(...pair), g.swap(...pair));
  }
});
test('five-stage legacy saves migrate without losing progress and unlock stage six', () => {
  const oldGame = new Game({ level: 4, seed: 21 }); oldGame.chooseBoon('spring');
  const oldState = oldGame.exportState(); oldState.version = 3;
  const p = platform({ unlocked: 4, stars: [3, 2, 1, 3, 0], best: [1800, 2400, 3000, 4000, 0], hero: 5, active: { ...oldState, shuffles: 1 } });
  const app = createGame(p); assert.equal(app.progress.stars.length, 1000); assert.equal(app.progress.best.length, 1000);
  assert.deepEqual(app.progress.stars.slice(0, 5), [3, 2, 1, 3, 0]); assert.deepEqual(app.game.board, oldGame.board);
  assert.equal(app.shuffles, 1); assert.equal(app.hero, 5);
  app.game.status = 'won'; app.game.score = 4500; app.settle();
  assert.equal(p.saved.unlocked, 5); assert.ok(app.modal.options.some(option => option.id === 'start:5'));
  app.act('start:5'); assert.equal(app.game.level, 5); app.destroy();
});
test('chapter boundaries and stage 1,000 completion never produce an out-of-range stage', () => {
  for (const level of [19, 998, 999]) {
    const p = platform({ unlocked: level }), app = createGame(p);
    app.game.status = 'won'; app.settle(); assert.equal(p.saved.unlocked, Math.min(999, level + 1));
    if (level < 999) { app.act('start:' + (level + 1)); assert.equal(app.game.level, level + 1); }
    else { assert.ok(app.modal.title.includes('千关')); assert.ok(!app.modal.options.some(option => option.id === 'start:1000')); }
    app.destroy();
  }
});
test('chapter navigation exposes all 1,000 levels without unlocking them or overflowing the screen', () => {
  const { app } = ready(); app.act('journey'); app.act('chapters');
  assert.equal(app.modal.chapters.length, 50); assert.equal(app.renderer.hits.length, 51);
  for (const hit of app.renderer.hits) assert.ok(hit.y + hit.h <= 790);
  app.act('journey-chapter:49'); assert.equal(app.modal.levels.length, 20);
  assert.equal(app.modal.levels[19].number, 1000); assert.ok(app.modal.levels.every(level => !level.unlocked));
  app.act('confirm-level:999'); assert.equal(app.modal.kind, 'journey'); assert.equal(app.game.level, 0);
  app.act('journey-latest'); assert.equal(app.modal.chapter, 0);
  for (let chapter = 0; chapter < 50; chapter++) {
    app.act('journey-chapter:' + chapter);
    assert.equal(app.modal.levels[0].number, chapter * 20 + 1);
    assert.ok(app.renderer.hits.length <= 25);
    for (const hit of app.renderer.hits) assert.ok(hit.y + hit.h <= 790);
  }
  app.destroy();
});
test('an unlocked stage 1,000 is selectable from chapter fifty and survives a reload', () => {
  const p = platform({ unlocked: 999 }), app = createGame(p);
  app.act('journey'); assert.equal(app.modal.chapter, 49);
  app.act('confirm-level:999'); assert.ok(app.modal.title.includes('1000'));
  app.act('start:999'); app.act('boon:shatter'); settle(app, p); app.hide();
  const restored = createGame(platform(p.saved)); assert.equal(restored.game.level, 999); assert.equal(restored.game.boon, 'shatter');
  restored.destroy(); app.destroy();
});
