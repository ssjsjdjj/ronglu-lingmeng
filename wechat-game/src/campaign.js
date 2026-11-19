(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MosslightCampaign = factory();
})(typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis, function () {
  'use strict';
  const LEVEL_COUNT = 1000, CHAPTER_SIZE = 20;
  const regions = ['雾隐群山', '蕨影溪谷', '流萤溪岸', '霜月林海', '暖石丘陵', '星落石原', '云上古道', '镜湖秘境', '苍穹雪岭', '破晓之巅'];
  const routes = ['寻泉', '听风', '逐星', '问心', '归灯'];
  const stages = ['石径微光', '松间清露', '溪桥听雨', '林深寻踪', '回廊花影', '轻舟过涧', '云岫生烟', '竹海回声', '月下流萤', '山隘守关', '古树新芽', '星河浅渡', '风起重峦', '灵泉映月', '花间旧约', '石塔晚钟', '霜叶归途', '峰回路转', '长夜将明', '章末试炼'];
  const patterns = ['diagonals', 'river', 'islands', 'frame', 'cross', 'checker', 'rings', 'columns'];
  const CHAPTERS = Array.from({ length: LEVEL_COUNT / CHAPTER_SIZE }, (_, index) => ({
    index, name: regions[Math.floor(index / routes.length)] + '·' + routes[index % routes.length],
    first: index * CHAPTER_SIZE + 1, last: (index + 1) * CHAPTER_SIZE
  }));
  const intro = [
    { name: '林口初见', tag: '苔灯林口', desc: '跟上小队的脚步，收集散落的微光。', moves: 24, score: 1600, ice: 0, collect: 12, target: 0 },
    { name: '冰晶小径', tag: '霜落石阶', desc: '消除冰晶上的小兽，打通上山的路。', moves: 25, score: 2200, ice: 12, collect: 15, target: 1 },
    { name: '叶芽小径', tag: '蕨影溪谷', desc: '跟着芽卷收集微光，让连锁在叶影间绽放。', moves: 26, score: 2800, ice: 16, collect: 18, target: 3 },
    { name: '石庭试炼', tag: '暖石丘陵', desc: '双层冰晶需要命中两次，巧用特效破局。', moves: 28, score: 3400, ice: 20, layers: 2, collect: 20, target: 2 },
    { name: '苔塔初亮', tag: '苔灯高塔', desc: '收集澜羽的微光，化开冰晶，点亮林中的苔灯。', moves: 30, score: 4200, ice: 24, layers: 2, collect: 24, target: 4 }
  ];
  const LEVELS = Array.from({ length: LEVEL_COUNT }, (_, level) => {
    const number = level + 1, chapter = Math.floor(level / CHAPTER_SIZE), position = level % CHAPTER_SIZE;
    if (level < intro.length) return { ...intro[level], number, chapter, position, difficulty: number };
    // Bounded ramp: objectives grow faster than the move budget. Boss stages grant
    // two extra moves, providing room to counter the additional objective.
    const progress = (number - 6) / (LEVEL_COUNT - 6), bossStage = number % 10 === 0, finale = number % 20 === 0;
    const boss = bossStage ? {
      name: finale ? '山巅守卫' : '山隘守卫',
      maxHp: Math.round(460 + 1440 * progress) + (finale ? 100 : 0),
      freeze: 6 + Math.floor(3 * progress), interval: number >= 700 ? 3 : 4
    } : null;
    return {
      number, chapter, position, difficulty: number,
      name: number === LEVEL_COUNT ? '千关破晓' : stages[position], tag: CHAPTERS[chapter].name,
      desc: bossStage ? '观察冻结预告，用连消、技能和连携击退守卫。' : '巧用角色技能，收集微光，逐格化开山间冰晶。',
      moves: 30 - Math.floor(4 * progress) + (bossStage ? 2 : 0),
      score: 4200 + Math.floor(31800 * progress / 50) * 50,
      collect: 24 + Math.floor(76 * progress), target: (level + chapter) % 6,
      ice: 24 + Math.floor(28 * progress), layers: 2,
      pattern: patterns[position % patterns.length], patternOffset: (chapter + position) % 8, boss
    };
  });
  // Pick exactly config.ice distinct cells. Every layout remains a full 8×8 board;
  // frost affects objectives rather than preventing legal swaps.
  function iceCells(config, rng) {
    const offset = config.patternOffset || 0;
    const ranked = Array.from({ length: 64 }, (_, i) => {
      let r = Math.floor(i / 8), c = i % 8;
      if (offset & 1) [r, c] = [c, r];
      if (offset & 2) r = 7 - r;
      if (offset & 4) c = 7 - c;
      const edge = Math.min(r, c, 7 - r, 7 - c);
      let rank;
      switch (config.pattern) {
        case 'diagonals': rank = Math.min(Math.abs(r - c), Math.abs(r + c - 7)); break;
        case 'river': rank = Math.abs(c - (3.5 + 2 * Math.sin(r * 0.9))); break;
        case 'islands': rank = Math.min(...[[1, 1], [1, 6], [6, 1], [6, 6]].map(([a, b]) => Math.abs(r - a) + Math.abs(c - b))); break;
        case 'frame': rank = edge; break;
        case 'cross': rank = Math.min(Math.abs(r - 3.5), Math.abs(c - 3.5)); break;
        case 'checker': rank = (r + c) % 2; break;
        case 'rings': rank = Math.abs(edge - 1); break;
        case 'columns': rank = c % 3; break;
        default: rank = 0;
      }
      return { i, rank: rank + rng() * 0.3 };
    });
    ranked.sort((a, b) => a.rank - b.rank || a.i - b.i);
    return ranked.slice(0, config.ice).map(cell => cell.i);
  }
  return { LEVEL_COUNT, CHAPTER_SIZE, CHAPTERS, LEVELS, iceCells };
});
