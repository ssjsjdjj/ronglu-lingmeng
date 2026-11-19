(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine'), require('./characters'), require('./renderer'));
  else root.MosslightApp = factory(root.MosslightEngine, root.MosslightCharacters, root.MosslightRenderer);
})(typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis, function (Engine, HEROES, Render) {
  'use strict';
  const { Game, LEVELS, LEVEL_COUNT, CHAPTERS, CHAPTER_SIZE, BOONS, adjacent, legalMoves, linkInfo } = Engine;
  const KEY = 'ronglu-wechat-v1';
  const integer = (n, min, max, fallback = min) => Number.isInteger(n) ? Math.max(min, Math.min(max, n)) : fallback;
  class GameApp {
    constructor(platform) {
      this.platform = platform;
      this.hidden = false; this.destroyed = false; this.frameId = null;
      this.selected = -1; this.hint = []; this.pending = null; this.pointer = null;
      this.message = '交换相邻小兽，三个相连即可消除';
      this.progress = { unlocked: 0, stars: Array(LEVEL_COUNT).fill(0), best: Array(LEVEL_COUNT).fill(0), challengeBest: 0, hero: 0, sound: false };
      let stored;
      try {
        stored = platform.read(KEY);
        if (typeof stored === 'string') stored = stored.trim() ? JSON.parse(stored) : null;
        if (stored && typeof stored === 'object') {
          this.progress.unlocked = integer(stored.unlocked, 0, LEVEL_COUNT - 1);
          this.progress.hero = integer(stored.hero, 0, 5);
          this.progress.sound = stored.sound === true;
          this.progress.challengeBest = integer(stored.challengeBest, 0, 1000000000);
          for (const k of ['stars', 'best']) this.progress[k] = Array.from({ length: LEVEL_COUNT }, (_, i) => integer(stored[k] && stored[k][i], 0, k === 'stars' ? 3 : 1000000000));
        }
      } catch (error) {
        this.message = '存档不可用，已开启新的山间旅程';
        if (typeof console !== 'undefined' && console.warn) console.warn('mosslight: local save could not be read', error && error.message);
      }
      try { this.game = Game.restore(stored && stored.active); } catch (_) { this.game = null; }
      // Never restore a locked adventure level from malformed local data.
      if (this.game && !this.game.zen && !this.game.challenge && this.game.level > this.progress.unlocked) this.game = null;
      const restored = !!this.game;
      if (!this.game) this.game = new Game({ level: this.progress.unlocked });
      this.shuffles = restored ? integer(stored.active.shuffles, 0, 2, 2) : 2;
      this.hero = this.progress.hero;
      this.view = this.game.snapshot('settled');
      this.renderer = new Render.Renderer(platform, HEROES);
      this.unbind = platform.bind({
        start: p => this.touchStart(p), end: p => this.touchEnd(p), cancel: () => { this.pointer = null; },
        hide: () => this.hide(), show: () => this.show(), resize: () => { this.pointer = null; this.renderer.resize(); this.render(); }
      });
      this.modal = this.game.boon ? null : this.boonModal();
      this.render(); this.schedule();
    }
    boonModal() {
      return { title: '选一份同行约定，出发', kicker: '森林来信 · 本局加成', body: ['三种同行约定，选择适合自己的节奏。'], options: BOONS.map(b => ({ id: 'boon:' + b.id, label: b.name, detail: b.desc, tall: true })) };
    }
    notify(text) { this.toast = { text, until: this.platform.now() + 2600 }; this.render(); }
    save() {
      this.progress.hero = this.hero;
      const active = this.game.status === 'playing' ? { ...this.game.exportState(), shuffles: this.shuffles } : null;
      try { this.platform.write(KEY, { version: 2, ...this.progress, active }); return true; }
      catch (_) { this.toast = { text: '本地存档未成功，退出后可能无法续玩', until: this.platform.now() + 4000 }; return false; }
    }
    sound(freq = 540) { if (this.progress.sound) { this.platform.enableAudio(); this.platform.tone(freq, 0.12); } }
    schedule() {
      if (this.hidden || this.destroyed || this.frameId !== null) return;
      this.frameId = this.platform.requestFrame(() => { this.frameId = null; this.tick(); this.schedule(); });
    }
    tick() {
      if (this.destroyed || this.hidden) return;
      const now = this.platform.now();
      if (this.pending && now >= this.nextFrameAt) {
        this.view = this.pending.shift();
        if (this.view.phase === 'clear') {
          this.sound(420 + Math.min(this.view.chain || 1, 5) * 90);
          this.message = this.view.chain > 1 ? `${this.view.chain} 重连消 · +${this.view.points} 微光` : `+${this.view.points} 微光`;
        }
        this.nextFrameAt = now + (this.view.phase === 'clear' ? 160 : this.view.phase === 'fall' ? 140 : 90);
        if (!this.pending.length) this.settle();
      }
      this.render();
    }
    render() { if (!this.destroyed) this.renderer.draw(this, this.platform.now()); }
    play(plan) {
      if (!plan.frames.length) return;
      this.selected = -1; this.hint = [];
      this.pending = [...plan.frames]; this.nextFrameAt = this.platform.now();
      if (!plan.valid) this.message = '这两只还不能消除，换个方向试试';
      this.save(); this.tick();
    }
    settle() {
      this.pending = null; this.view = this.game.snapshot('settled');
      if (this.game.status === 'won') {
        if (!this.resultRecorded) {
          if (this.game.challenge) this.progress.challengeBest = Math.max(this.progress.challengeBest, this.game.score);
          else {
            const l = this.game.level, stars = this.game.moves >= 8 ? 3 : this.game.moves >= 3 ? 2 : 1;
            this.progress.stars[l] = Math.max(this.progress.stars[l], stars);
            this.progress.best[l] = Math.max(this.progress.best[l], this.game.score);
            this.progress.unlocked = Math.max(this.progress.unlocked, Math.min(LEVEL_COUNT - 1, l + 1));
          }
          this.resultRecorded = true;
        }
        const next = this.game.level + 1;
        this.modal = { title: this.game.challenge ? '石庭安静，苔灯亮起' : next === LEVEL_COUNT ? '千关走过，苔灯长明' : '苔灯又亮了一盏', kicker: '旅程完成', body: [`收集 ${this.game.score.toLocaleString()} 微光 · 剩余 ${this.game.moves} 步`, this.game.challenge ? '换一种同行约定，再试试另一组连携。' : '✦'.repeat(this.progress.stars[this.game.level])], options: [
          !this.game.challenge && next < LEVEL_COUNT ? { id: 'start:' + next, label: `下一关 · ${next + 1} ${LEVELS[next].name}` } : { id: 'zen', label: '进入随心模式' },
          { id: 'restart', label: '再玩一次' }, { id: 'journey', label: '山间旅程' }
        ] };
      } else if (this.game.status === 'lost') {
        this.modal = { title: '歇一歇，再出发', kicker: '好风景值得再来', body: [`本局收集了 ${this.game.score.toLocaleString()} 微光。`, '试试四消、角色技能与免费连携。'], options: [{ id: 'restart', label: '换种同行约定，免费重试' }, { id: 'zen', label: '随心模式 · 不限步数' }, { id: 'journey', label: '山间旅程' }] };
      } else if (this.game.energy >= this.game.energyMax) this.message = '微光已满，点击下方技能按钮助阵';
      else if (this.game.link) this.message = '换一位角色，三步内可免费连携';
      this.save();
    }
    start(level = this.game.level, zen = false, challenge = false) {
      if (!Number.isInteger(level) || level < 0 || level >= LEVEL_COUNT || (!zen && !challenge && level > this.progress.unlocked)) return;
      this.game = new Game({ level, zen, challenge }); this.resultRecorded = false;
      this.shuffles = 2; this.selected = -1; this.hint = []; this.pending = null;
      this.message = '交换相邻小兽，三个相连即可消除';
      this.view = this.game.snapshot('settled'); this.modal = this.boonModal(); this.save(); this.render();
    }
    canLink() { return this.game.link && linkInfo(this.game.link.from, this.hero); }
    confirm(title, id) {
      this.modal = { title, kicker: '开启新的旅程', body: ['当前棋盘会重新开始。', '已解锁关卡与最佳成绩会保留。'], options: [{ id, label: '确认，出发' }, { id: 'close', label: '继续当前这一局' }] };
    }
    openJourney(chapter = Math.floor(this.game.level / CHAPTER_SIZE)) {
      if (!Number.isInteger(chapter)) return;
      chapter = Math.max(0, Math.min(CHAPTERS.length - 1, chapter));
      this.journeyChapter = chapter;
      this.modal = {
        kind: 'journey', chapter, chapterName: CHAPTERS[chapter].name, chapterCount: CHAPTERS.length, total: LEVEL_COUNT,
        unlocked: this.progress.unlocked + 1,
        levels: LEVELS.slice(chapter * CHAPTER_SIZE, (chapter + 1) * CHAPTER_SIZE).map((level, offset) => {
          const index = chapter * CHAPTER_SIZE + offset;
          return { number: index + 1, name: level.name, boss: !!level.boss || index === 2 || index === 4, unlocked: index <= this.progress.unlocked, stars: this.progress.stars[index], current: index === this.game.level && !this.game.zen && !this.game.challenge };
        }),
        returnId: this.game.status === 'playing' ? 'close' : 'zen'
      };
    }
    openChapters() {
      this.modal = { kind: 'chapters', chapter: this.journeyChapter || 0, total: LEVEL_COUNT, chapters: CHAPTERS.map(chapter => ({ ...chapter, unlocked: chapter.first <= this.progress.unlocked + 1 })) };
    }
    act(id) {
      if (this.hidden || this.destroyed || this.pending) return;
      if (this.progress.sound) this.platform.enableAudio();
      if (id === 'sound') { this.progress.sound = !this.progress.sound; this.sound(); this.save(); }
      else if (id.indexOf('boon:') === 0) { this.modal = null; this.play(this.game.chooseBoon(id.slice(5))); }
      else if (id === 'close') { if (this.game.status === 'playing') this.modal = this.game.boon ? null : this.boonModal(); }
      else if (id === 'menu') {
        this.modal = { title: '山风轻轻，歇一歇', kicker: this.game.zen ? '随心小憩' : this.game.config.name, body: ['伙伴们在等你。'], options: [
          { id: 'close', label: '继续游戏' }, { id: 'journey', label: '山间旅程 · 选择关卡' },
          { id: 'confirm-challenge', label: '守关挑战' }, { id: 'confirm-zen', label: this.game.zen ? '回到冒险模式' : '随心模式 · 不限步数' },
          { id: 'confirm-restart', label: '重新开始本关' }, { id: 'help', label: '玩法说明' }
        ] };
      } else if (id === 'help') {
        this.modal = { title: '一点就会，一消就爱', kicker: '山间小手册', body: [
          '点击两只相邻小兽，或滑动交换；三个相连即可消除。',
          '四消起风纹，五消聚光珠，T / L 形生成爆破。',
          '消除可蓄能，技能不扣步数。施放后换角色，三步内可免费连携，每局两次。',
          '冒险需要同时完成微光、收集、破冰及守卫目标。提示不限次，重排每局两次。',
          '共1000关，每20关一章，每10关有守卫。后期守卫每3步冻结，四消、连锁或技能可以打断。'
        ], options: [{ id: 'close', label: '明白了，继续冒险' }] };
      } else if (id === 'journey') {
        this.openJourney();
      } else if (id === 'chapters') this.openChapters();
      else if (id === 'journey-latest') this.openJourney(Math.floor(this.progress.unlocked / CHAPTER_SIZE));
      else if (id.indexOf('journey-chapter:') === 0) {
        if (this.modal && ['journey', 'chapters'].includes(this.modal.kind)) this.openJourney(Number(id.split(':')[1]));
      } else if (id === 'confirm-restart') this.confirm('重新开始这一关？', 'restart');
      else if (id === 'confirm-zen') this.confirm(this.game.zen ? '回到冒险旅程？' : '随心消一会儿？', this.game.zen ? 'adventure' : 'zen');
      else if (id === 'confirm-challenge') this.confirm('挑战石庭守卫？', 'challenge');
      else if (id.indexOf('confirm-level:') === 0) {
        const level = Number(id.split(':')[1]);
        if (Number.isInteger(level) && level >= 0 && level < LEVEL_COUNT && level <= this.progress.unlocked) this.confirm(`前往第${level + 1}关？`, 'start:' + level);
      } else if (id.indexOf('start:') === 0) this.start(Number(id.split(':')[1]));
      else if (id === 'restart') this.start(this.game.level, this.game.zen, this.game.challenge);
      else if (id === 'zen') this.start(this.game.level, true);
      else if (id === 'adventure') this.start(this.progress.unlocked);
      else if (id === 'challenge') this.start(this.progress.unlocked, false, true);
      else if (this.modal) return;
      else if (id.indexOf('hero:') === 0) { this.hero = integer(Number(id.split(':')[1]), 0, 5); this.save(); }
      else if (id === 'hint') { this.hint = legalMoves(this.game.board)[0] || []; this.notify('金色边框标出的两只小兽可以交换'); }
      else if (id === 'shuffle') {
        if (this.shuffles <= 0) this.notify('本局重排已用完，试试萤光提示');
        else { this.shuffles--; this.message = '清风重排，换个思路继续出发'; this.play(this.game.shuffle()); }
      } else if (id === 'skill') {
        if (this.canLink()) this.play(this.game.linkSkill(this.hero));
        else if (this.game.energy >= this.game.energyMax) this.play(this.game.skill(this.hero));
        else this.notify(HEROES[this.hero].desc + ' · 还需 ' + (this.game.energyMax - this.game.energy) + ' 点微光');
      }
      this.render();
    }
    touchStart(p) {
      if (this.hidden || this.pending || this.destroyed) return;
      const pos = this.renderer.point(p);
      this.pointer = { ...pos, id: p.id, cell: this.modal ? -1 : this.renderer.cellAt(pos), action: this.renderer.hitAt(pos) };
    }
    touchEnd(p) {
      const start = this.pointer; this.pointer = null;
      if (!start || start.id !== p.id || this.hidden || this.pending || this.destroyed) return;
      const end = this.renderer.point(p), dx = end.x - start.x, dy = end.y - start.y;
      if (start.action) {
        if (this.renderer.hitAt(end) === start.action && Math.max(Math.abs(dx), Math.abs(dy)) < 20) this.act(start.action);
        return;
      }
      if (this.modal || start.cell < 0) return;
      this.hint = [];
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 16) {
        const b = start.cell + (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : -1) : (dy > 0 ? 8 : -8));
        if (adjacent(start.cell, b)) this.play(this.game.swap(start.cell, b));
      } else if (this.selected >= 0 && adjacent(this.selected, start.cell)) this.play(this.game.swap(this.selected, start.cell));
      else { this.selected = this.selected === start.cell ? -1 : start.cell; this.sound(440); }
      this.render();
    }
    hide() {
      this.pointer = null;
      if (this.pending) this.settle();
      this.save(); this.hidden = true;
      if (this.frameId !== null) this.platform.cancelFrame(this.frameId);
      this.frameId = null; this.platform.pauseAudio();
    }
    show() {
      if (this.destroyed) return;
      this.hidden = false; this.renderer.resize();
      if (!this.modal) this.modal = { title: '欢迎回到山间', kicker: '进度已保存在本机', body: ['准备好了，就继续刚才的冒险。'], options: [{ id: 'close', label: '继续游戏' }, { id: 'menu', label: '打开菜单' }] };
      this.render(); this.schedule();
    }
    destroy() {
      if (this.destroyed) return;
      this.hide(); this.destroyed = true;
      if (this.unbind) this.unbind();
      this.renderer.destroy();
    }
  }
  return { GameApp, createGame: platform => new GameApp(platform), KEY };
});
