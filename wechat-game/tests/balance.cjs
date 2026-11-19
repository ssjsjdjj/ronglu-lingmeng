// Diagnostic, not a human pass-rate estimate. The greedy policy can inspect
// deterministic one-action outcomes. It never modifies real player storage.
const { Game, legalMoves } = require('../src/engine');
const levels = [1, 5, 6, 20, 50, 100, 200, 400, 600, 800, 1000];
const trials = Number(process.env.BALANCE_TRIALS) || 3;
function quality(before, after) {
  const config = before.config;
  const ice = game => game.ice.reduce((a, b) => a + b, 0);
  const capped = (key, goal) => Math.min(after[key], goal) - Math.min(before[key], goal);
  return (after.status === 'won' ? 100000 : 0)
    + capped('score', config.score) / 60 * 0.8
    + capped('collected', config.collect) * 9
    + (ice(before) - ice(after)) * 6
    + ((before.boss ? before.boss.hp : 0) - (after.boss ? after.boss.hp : 0)) * 0.08
    + (after.energy - before.energy) * 0.25
    + (after.moves - before.moves) * 12;
}
const results = [];
for (const number of levels) {
  let wins = 0, turns = 0, samples = [];
  for (let trial = 0; trial < trials; trial++) {
    const g = new Game({ level: number - 1, seed: 97000 + trial * 997 + number }); g.chooseBoon('shatter');
    for (let step = 0; step < 200 && g.status === 'playing'; step++) {
      const actions = legalMoves(g.board).map(pair => ({ kind: 'swap', arg: pair }));
      if (g.energy >= g.energyMax) for (let hero = 0; hero < 6; hero++) actions.push({ kind: 'skill', arg: [hero] });
      if (g.link) for (let hero = 0; hero < 6; hero++) if (hero !== g.link.from) actions.push({ kind: 'linkSkill', arg: [hero] });
      let best, value = -Infinity;
      for (const action of actions) {
        const candidate = Game.restore(g.exportState()), result = candidate[action.kind](...action.arg);
        if (!result.valid) continue;
        const score = quality(g, candidate);
        if (score > value) { value = score; best = action; }
      }
      if (!best) break;
      g[best.kind](...best.arg);
    }
    if (g.status === 'won') wins++;
    turns += g.turns;
    samples.push({ seed: 97000 + trial * 997 + number, status: g.status, moves: g.moves, score: g.score, collected: g.collected, ice: g.iceLeft(), bossHp: g.boss ? g.boss.hp : 0 });
  }
  results.push({ level: number, wins, trials, averageSwaps: Number((turns / trials).toFixed(1)), samples });
}
if (process.argv.includes('--json')) console.log(JSON.stringify({ policy: 'one-step greedy with deterministic outcomes; shatter boon', results }, null, 2));
else console.table(results.map(({ level, wins, trials, averageSwaps, samples }) => ({ level, wins, trials, averageSwaps, remainingSteps: samples.map(s => s.moves).join('/'), remainingCollect: samples.map(s => Math.max(0, require('../src/engine').LEVELS[level - 1].collect - s.collected)).join('/') })));
