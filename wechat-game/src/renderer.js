(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MosslightRenderer = factory();
})(typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis, function () {
  'use strict';
  const W = 390, H = 790, BOARD = { x: 24, y: 188, size: 342 }, CELL = BOARD.size / 8;
  const C = { bg: '#102e2d', panel: '#1c403a', ink: '#f4ecd2', muted: '#9fb9a6', gold: '#e4c58d', line: '#54725b' };
  class Renderer {
    constructor(platform, heroes) {
      this.platform = platform; this.canvas = platform.canvas; this.ctx = this.canvas.getContext('2d');
      this.heroes = heroes; this.images = []; this.hits = [];
      heroes.forEach((hero, i) => {
        const image = platform.createImage();
        image.onload = () => { this.images[i] = image; };
        image.onerror = () => { this.images[i] = null; };
        image.src = 'assets/' + hero.file + '.png';
      });
      this.resize();
    }
    resize() {
      const d = this.platform.getWindow();
      this.width = d.width; this.height = d.height; this.dpr = d.pixelRatio || 1;
      const top = d.top || 0, bottom = d.bottom || 0;
      this.scale = Math.max(0.1, Math.min(d.width / W, (d.height - top - bottom) / H));
      this.ox = (d.width - W * this.scale) / 2;
      this.oy = top + Math.max(0, (d.height - top - bottom - H * this.scale) / 2);
      this.canvas.width = Math.round(d.width * this.dpr); this.canvas.height = Math.round(d.height * this.dpr);
    }
    point(p) { return { x: (p.x - this.ox) / this.scale, y: (p.y - this.oy) / this.scale }; }
    cellAt(p) {
      if (p.x < BOARD.x || p.y < BOARD.y || p.x >= BOARD.x + BOARD.size || p.y >= BOARD.y + BOARD.size) return -1;
      return Math.floor((p.y - BOARD.y) / CELL) * 8 + Math.floor((p.x - BOARD.x) / CELL);
    }
    hitAt(p) {
      const hit = [...this.hits].reverse().find(b => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
      return hit ? hit.id : null;
    }
    round(x, y, w, h, r = 12) {
      const c = this.ctx; r = Math.min(r, w / 2, h / 2);
      c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
      c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
      c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
    }
    box(x, y, w, h, fill, stroke, r = 12) {
      this.round(x, y, w, h, r); const c = this.ctx;
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
    }
    text(value, x, y, size = 14, color = C.ink, align = 'left', bold = false, maxWidth) {
      const c = this.ctx; c.font = `${bold ? '600 ' : ''}${size}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle';
      if (maxWidth) c.fillText(String(value), x, y, maxWidth); else c.fillText(String(value), x, y);
    }
    wrap(value, width, size = 13) {
      this.ctx.font = `${size}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      const lines = []; let line = '';
      for (const char of String(value)) {
        if (char === '\n' || (line && this.ctx.measureText(line + char).width > width)) { lines.push(line); line = char === '\n' ? '' : char; }
        else line += char;
      }
      if (line) lines.push(line);
      return lines;
    }
    button(id, label, x, y, w, h, options = {}) {
      const disabled = options.disabled, primary = options.primary;
      this.box(x, y, w, h, disabled ? '#24433c' : primary ? C.gold : '#274d43', disabled ? '#365348' : primary ? '#f4dfb1' : '#5b7963', 11);
      this.text(label, x + w / 2, y + h / 2, options.size || 13, disabled ? '#718e7a' : primary ? '#203b30' : C.ink, 'center', true, w - 15);
      if (!disabled) this.hits.push({ id, x, y, w, h });
    }
    portrait(type, x, y, size, alpha = 1) {
      const c = this.ctx; c.save(); c.globalAlpha *= alpha;
      if (this.images[type]) c.drawImage(this.images[type], x, y, size, size);
      else {
        c.beginPath(); c.arc(x + size / 2, y + size / 2, size * 0.32, 0, Math.PI * 2); c.fillStyle = this.heroes[type].color; c.fill();
        this.text(this.heroes[type].name[0], x + size / 2, y + size / 2, size * 0.36, '#263d35', 'center', true);
      }
      c.restore();
    }
    background() {
      const c = this.ctx, sky = c.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#2f5548'); sky.addColorStop(0.45, '#193e36'); sky.addColorStop(1, '#0d2b29');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      c.beginPath(); c.arc(318, 65, 44, 0, Math.PI * 2); c.fillStyle = '#c5bd8830'; c.fill();
      for (let layer = 0; layer < 3; layer++) {
        c.beginPath(); c.moveTo(0, 190 + layer * 140);
        for (let x = -20; x < W + 70; x += 70) c.lineTo(x, 150 + layer * 150 - Math.sin(x * 0.03 + layer) * 55);
        c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fillStyle = ['#3b61504a', '#274d3d4a', '#0b282749'][layer]; c.fill();
      }
      for (let i = 0; i < 16; i++) { c.fillStyle = '#e6d39450'; c.fillRect((i * 73 + 15) % W, (i * 137 + 42) % H, 1.5, 1.5); }
    }
    draw(app, now) {
      const c = this.ctx, s = app.view, game = app.game;
      this.hits = [];
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.globalAlpha = 1;
      c.fillStyle = C.bg; c.fillRect(0, 0, this.width, this.height);
      c.translate(this.ox, this.oy); c.scale(this.scale, this.scale);
      this.background();
      this.text('苔灯漫游', 24, 28, 24, C.ink, 'left', true);
      this.text('森林消消乐  /  拾起微光，一路同行', 25, 52, 10, C.muted);
      this.button('sound', app.progress.sound ? '♪' : '静', 286, 16, 32, 32, { size: 16 });
      this.button('menu', '···', 326, 16, 40, 32, { size: 20 });
      const mode = game.zen ? '随心小憩' : game.challenge ? '守关挑战' : `第 ${game.level + 1} / ${app.progress.stars.length} 关`;
      this.text(mode, 26, 81, 16, C.gold, 'left', true);
      this.text(game.zen ? '不计步数，慢慢消' : game.config.name, 26, 102, 10, C.muted);
      this.text('剩余步数', 306, 78, 9, C.muted, 'center');
      this.text(game.zen ? '∞' : s.moves, 306, 99, 26, C.ink, 'center', true);
      const goals = [
        { label: '微光', value: `${s.score.toLocaleString()} / ${game.config.score}`, done: s.score >= game.config.score },
        { label: '收集', value: `${s.collected} / ${game.config.collect}`, done: s.collected >= game.config.collect },
        { label: '冰晶', value: s.iceLeft === 0 ? '已清空' : `${s.iceLeft} 格`, done: s.iceLeft === 0 }
      ];
      goals.forEach((g, i) => {
        const x = 24 + i * 116;
        this.box(x, 116, 110, 44, '#23473e', '#48664e', 8);
        this.text((g.done ? '✓ ' : '') + g.label, x + 10, 128, 10, C.muted);
        this.text(g.value, x + 10, 146, 12, g.done ? '#c3dfad' : C.ink, 'left', true, 94);
      });
      if (s.boss) {
        this.box(24, 168, 342, 12, '#152f2c', null, 6);
        if (s.boss.hp > 0) this.box(24, 168, Math.max(4, 342 * s.boss.hp / s.boss.maxHp), 12, '#a781ab', null, 6);
        this.text(s.boss.hp > 0 ? `${s.boss.name}  ${s.boss.hp} / ${s.boss.maxHp}  ·  ${s.boss.charge} 步后冻结` : '守卫已击退 · 继续完成收集与破冰', 195, 174, 8, '#f7eff6', 'center');
      } else this.text(game.zen ? '不计步数，跟着山风慢慢消' : '四消起风纹，五消聚光珠，转角相连有惊喜', 195, 175, 9, C.muted, 'center');
      this.board(app, now);
      this.text(app.message, 195, 544, 10, C.gold, 'center', false, 336);
      this.button('hint', '✧  萤光提示', 24, 562, 165, 38, { disabled: !!app.pending });
      this.button('shuffle', `↻  清风重排  ${app.shuffles}`, 201, 562, 165, 38, { disabled: !!app.pending || app.shuffles === 0 });
      this.text('同行伙伴', 25, 620, 11, C.muted);
      this.text(app.game.boon ? ({ torrent: '晨露之约', spring: '新芽之约', shatter: '砾石之约' })[app.game.boon] : '本局同行约定', 364, 620, 10, C.gold, 'right');
      this.heroes.forEach((hero, i) => {
        const x = 24 + i * 58, active = i === app.hero;
        this.box(x, 635, 52, 57, active ? '#45624b' : '#204138', active ? C.gold : '#3a5a48', 10);
        this.portrait(i, x + 7, 635, 38);
        this.text(hero.name, x + 26, 681, 9, active ? C.gold : '#d3decb', 'center');
        if (!app.pending) this.hits.push({ id: 'hero:' + i, x, y: 635, w: 52, h: 57 });
      });
      const link = app.canLink(), ready = s.energy >= game.energyMax;
      const skill = link ? `${link.name} · 免费连携` : `${this.heroes[app.hero].skill}  ${s.energy} / ${game.energyMax}`;
      this.button('skill', '✦  ' + skill, 24, 707, 342, 43, { primary: !!link || ready, disabled: !!app.pending });
      if (!ready && !link) {
        this.box(28, 745, 334, 3, '#142e28', null, 1);
        if (s.energy > 0) this.box(28, 745, Math.max(2, 334 * s.energy / game.energyMax), 3, C.gold, null, 1);
      }
      this.text(link ? '换人连携不扣微光与步数' : this.heroes[app.hero].desc, 195, 764, 10, C.muted, 'center');
      this.text('苔灯小队的千关旅程 · 本机存档', 195, 783, 8, '#6e9480', 'center');
      if (app.modal) {
        if (app.modal.kind === 'journey') this.journey(app.modal);
        else if (app.modal.kind === 'chapters') this.chapters(app.modal);
        else this.modal(app.modal);
      }
      if (app.toast && app.toast.until > now) {
        const lines = this.wrap(app.toast.text, 290, 12);
        this.box(33, 535, 324, lines.length * 19 + 20, '#102a26f5', C.gold, 10);
        lines.forEach((line, i) => this.text(line, 195, 554 + i * 19, 12, C.ink, 'center'));
      }
    }
    board(app, now) {
      const c = this.ctx, s = app.view;
      this.box(18, 182, 354, 354, '#102e2b', '#b3a46c', 15);
      if (this.lastView !== s) {
        this.previousCells = new Map();
        if (this.lastView) this.lastView.board.forEach((tile, i) => { if (tile) this.previousCells.set(tile.id, i); });
        this.lastView = s; this.transitionStart = now;
      }
      const duration = s.phase === 'fall' ? 130 : ['swap', 'invalid'].includes(s.phase) ? 85 : 0;
      const t = duration ? Math.min(1, (now - this.transitionStart) / duration) : 1;
      const ease = 1 - Math.pow(1 - t, 3);
      c.save(); this.round(BOARD.x, BOARD.y, BOARD.size, BOARD.size, 6); c.clip();
      const clearing = new Set(s.phase === 'clear' ? s.clear : []), targets = new Set(s.boss ? s.boss.targets : []);
      for (let i = 0; i < 64; i++) {
        const x = BOARD.x + i % 8 * CELL, y = BOARD.y + Math.floor(i / 8) * CELL, tile = s.board[i];
        this.box(x + 1, y + 1, CELL - 2, CELL - 2, (i + Math.floor(i / 8)) % 2 ? '#295044' : '#24483e', '#345b46', 6);
        if (!tile) continue;
        if (tile.special === 'rainbow') {
          const grad = c.createRadialGradient(x + CELL / 2, y + CELL / 2, 2, x + CELL / 2, y + CELL / 2, 19);
          grad.addColorStop(0, '#fff4c5'); grad.addColorStop(0.4, '#cca4e0'); grad.addColorStop(0.8, '#84c7b6'); grad.addColorStop(1, '#346b5c');
          c.beginPath(); c.arc(x + CELL / 2, y + CELL / 2, 17, 0, Math.PI * 2); c.fillStyle = grad; c.fill();
          this.text('✦', x + CELL / 2, y + CELL / 2, 23, '#fff6da', 'center');
        } else {
          const bob = app.modal || app.pending ? 0 : Math.sin(now / 1150 + tile.id * 1.7) * 0.7;
          const shrink = clearing.has(i) ? 0.76 : 1, size = CELL * shrink;
          const old = this.previousCells.get(tile.id);
          const oldX = old === undefined ? x : BOARD.x + old % 8 * CELL;
          const oldY = old === undefined ? BOARD.y - CELL : BOARD.y + Math.floor(old / 8) * CELL;
          this.portrait(tile.type, oldX + (x - oldX) * ease + (CELL - size) / 2, oldY + (y - oldY) * ease + (CELL - size) / 2 + bob, size, clearing.has(i) ? 0.4 : 1);
        }
        if (s.ice[i]) {
          this.box(x + 2, y + 2, CELL - 4, CELL - 4, s.ice[i] > 1 ? '#b4e6ff4a' : '#b4e6ff25', '#b2e4ee', 6);
          this.text(s.ice[i] === 2 ? '❄ 2' : '❄', x + 7, y + 9, 9, '#def7ff');
        }
        if (tile.special && tile.special !== 'rainbow') {
          this.box(x + CELL - 19, y + CELL - 18, 16, 14, '#e2c28a', null, 4);
          this.text(({ row: '↔', col: '↕', bomb: '✦' })[tile.special], x + CELL - 11, y + CELL - 11, 11, '#274231', 'center', true);
        }
        if (targets.has(i)) {
          this.box(x + 3, y + 3, CELL - 6, CELL - 6, null, '#d4a1e4', 6);
          c.beginPath(); c.arc(x + CELL - 7, y + 7, 3, 0, Math.PI * 2); c.fillStyle = '#d4a1e4'; c.fill();
        }
        if (i === app.selected || app.hint.includes(i)) {
          c.lineWidth = 2; this.round(x + 2, y + 2, CELL - 4, CELL - 4, 6); c.strokeStyle = '#ffe5a0'; c.stroke(); c.lineWidth = 1;
        }
        if (clearing.has(i)) {
          this.text('✧', x + CELL / 2, y + CELL / 2, 28, '#fff4bc', 'center');
        }
      }
      c.restore();
    }
    journey(modal) {
      const c = this.ctx; this.hits = [];
      c.fillStyle = '#071c1ce6'; c.fillRect(0, 0, W, H);
      this.box(20, 55, 350, 680, '#1c4038', '#ab9e6f', 20);
      this.text(`${modal.total} 关冒险 · 50 章山间旅程`, 195, 85, 11, C.gold, 'center');
      this.text(modal.chapterName, 195, 119, 21, C.ink, 'center', true, 310);
      this.button('journey-chapter:' + (modal.chapter - 1), '‹', 40, 146, 40, 33, { disabled: modal.chapter === 0, size: 23 });
      this.button('chapters', `第 ${modal.chapter + 1} / ${modal.chapterCount} 章 · 选章节`, 88, 146, 214, 33);
      this.button('journey-chapter:' + (modal.chapter + 1), '›', 310, 146, 40, 33, { disabled: modal.chapter === modal.chapterCount - 1, size: 23 });
      modal.levels.forEach((level, i) => {
        const x = 40 + i % 5 * 64, y = 202 + Math.floor(i / 5) * 65;
        this.box(x, y, 54, 55, level.current ? '#6a7150' : level.unlocked ? '#2e5746' : '#203e35', level.current ? C.gold : level.unlocked ? '#6a8664' : '#395646', 9);
        this.text(level.number, x + 27, y + 21, 15, level.unlocked ? C.ink : '#78917d', 'center', true);
        this.text(level.stars ? '✦'.repeat(level.stars) : level.current ? '当前' : level.unlocked ? '出发' : '待解锁', x + 27, y + 42, 8, level.stars || level.current ? C.gold : '#89a38b', 'center');
        if (level.boss) { c.beginPath(); c.arc(x + 45, y + 8, 3, 0, Math.PI * 2); c.fillStyle = '#d3a0ce'; c.fill(); }
        if (level.unlocked) this.hits.push({ id: 'confirm-level:' + (level.number - 1), x, y, w: 54, h: 55 });
      });
      this.text(`已解锁至第 ${modal.unlocked} 关`, 195, 486, 13, C.gold, 'center');
      this.text('紫色圆点为守卫关 · 通关后解锁下一关', 195, 512, 10, C.muted, 'center');
      this.button('journey-latest', '定位最新解锁关卡', 40, 542, 310, 40);
      this.text('八种冰晶布局，沿途逐渐增加挑战', 195, 611, 11, C.muted, 'center');
      this.text('可从「选章节」浏览第 1—1000 关', 195, 635, 10, C.muted, 'center');
      this.button(modal.returnId, modal.returnId === 'close' ? '继续当前这一局' : '去随心模式放松一下', 40, 671, 310, 43, { primary: true });
    }
    chapters(modal) {
      const c = this.ctx; this.hits = [];
      c.fillStyle = '#071c1ce6'; c.fillRect(0, 0, W, H);
      this.box(20, 44, 350, 702, '#1c4038', '#ab9e6f', 20);
      this.text('五十章 · 一千盏苔灯', 195, 77, 20, C.ink, 'center', true);
      this.text('点击章节查看关卡，已解锁的关卡可以出发', 195, 108, 10, C.muted, 'center');
      modal.chapters.forEach((chapter, i) => {
        const x = 40 + i % 5 * 64, y = 140 + Math.floor(i / 5) * 48;
        this.box(x, y, 54, 41, i === modal.chapter ? '#6a7150' : chapter.unlocked ? '#2e5746' : '#203e35', i === modal.chapter ? C.gold : '#4b6650', 7);
        this.text(`第${i + 1}章`, x + 27, y + 13, 10, chapter.unlocked ? C.ink : '#9bac96', 'center', true);
        this.text(`${chapter.first}—${chapter.last}`, x + 27, y + 30, 7, C.muted, 'center');
        this.hits.push({ id: 'journey-chapter:' + i, x, y, w: 54, h: 41 });
      });
      this.text('章节可自由浏览，关卡依次解锁', 195, 653, 11, C.muted, 'center');
      this.button('journey-chapter:' + modal.chapter, '返回当前章节', 40, 682, 310, 43, { primary: true });
    }
    modal(modal) {
      const c = this.ctx; this.hits = [];
      c.fillStyle = '#071c1ce6'; c.fillRect(0, 0, W, H);
      const body = (modal.body || []).flatMap(line => this.wrap(line, 294, 12));
      const optionsHeight = modal.options.reduce((sum, option) => sum + (option.tall ? 84 : 43) + 9, 0);
      const height = Math.min(740, 124 + body.length * 20 + optionsHeight);
      const y = (H - height) / 2;
      this.box(20, y, 350, height, '#1c4038', '#ab9e6f', 20);
      this.text(modal.kicker || '森林来信', 195, y + 30, 10, C.gold, 'center');
      this.text(modal.title, 195, y + 64, 22, C.ink, 'center', true, 306);
      body.forEach((line, i) => this.text(line, 48, y + 101 + i * 20, 12, C.muted));
      let buttonY = y + 119 + body.length * 20;
      modal.options.forEach((option, i) => {
        const h = option.tall ? 84 : 43;
        if (option.tall) {
          this.box(40, buttonY, 310, h, '#2d5042', '#73825b', 12);
          this.text(option.label, 55, buttonY + 22, 15, C.gold, 'left', true);
          this.wrap(option.detail, 274, 11).slice(0, 3).forEach((line, index) => this.text(line, 55, buttonY + 44 + index * 15, 11, '#c6d4bd'));
          this.hits.push({ id: option.id, x: 40, y: buttonY, w: 310, h });
        } else this.button(option.id, option.label, 40, buttonY, 310, h, { primary: i === 0 && !option.disabled, disabled: option.disabled });
        buttonY += h + 9;
      });
    }
    destroy() { this.images.forEach(image => { if (image) { image.onload = null; image.onerror = null; } }); }
  }
  return { Renderer, W, H, BOARD, CELL };
});
