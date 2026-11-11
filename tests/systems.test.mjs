import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,BOONS,linkInfo,matches,legalMoves} from '../dist/engine.js';
function fixed(g){g.board=Array.from({length:64},(_,i)=>({id:++g.serial,type:((i/8|0)*2+i%8)%6,special:null}));g.boss=null;return g;}
function invalidPair(g){const legal=new Set(legalMoves(g.board).map(x=>x.join(',')));for(let a=0;a<64;a++)if(a%8<7&&!legal.has([a,a+1].join(',')))return [a,a+1];throw new Error('No invalid pair');}

test('boons can be selected only once and shatter gives one usable bomb',()=>{for(const boon of BOONS){const g=new Game({seed:70});assert(g.chooseBoon(boon.id).valid);assert(!g.chooseBoon('spring').valid);assert.equal(g.boon,boon.id);assert.equal(matches(g.board).length,0);if(boon.id==='shatter')assert.equal(g.board.filter(t=>t.special==='bomb').length,1);}});
test('torrent changes the actual skill threshold to 36',()=>{const g=new Game({seed:71});g.chooseBoon('torrent');g.energy=35;assert.equal(g.energyMax,36);assert(!g.skill(0).valid);g.energy=36;assert(g.skill(0).valid);assert(g.energy<=36);});
test('spring grants a step at the twentieth cleared cell and stops after three refunds',()=>{const g=fixed(new Game({seed:72}));g.chooseBoon('spring');g.boonProgress=19;const before=g.moves;const f=g.resolve([0])[0];assert.equal(f.stepBonus,1);assert.equal(f.moves,before+1);g.boonCharges=3;g.boonProgress=0;const left=g.moves;g.resolve(Array.from({length:20},(_,i)=>i));assert.equal(g.moves,left);assert.equal(g.boonCharges,3);});
test('a spring refund on the final step prevents a premature loss',()=>{const g=fixed(new Game({seed:73}));g.chooseBoon('spring');g.moves=0;g.boonProgress=19;g.resolve([0]);assert.equal(g.moves,1);assert.equal(g.status,'playing');});
test('shatter breaks a second ice layer with a special but regular three-cell clears break only one',()=>{const g=fixed(new Game({level:3,seed:74}));g.chooseBoon('shatter');g.ice.fill(0);g.ice[0]=2;g.board[0].special='row';assert.equal(g.resolve([0])[0].ice[0],0);const h=fixed(new Game({level:3,seed:75}));h.chooseBoon('shatter');h.ice.fill(0);h.ice[0]=2;assert.equal(h.resolve([0,1,2])[0].ice[0],1);});
test('a main skill opens a three-move link window, same-role link is refused without mutation',()=>{const g=new Game({seed:76});g.energy=48;g.skill(0);assert.deepEqual(g.link,{from:0,turns:3});const before=g.exportState();assert(!g.linkSkill(0).valid);assert.deepEqual(g.exportState(),before);});
test('frost-thunder link clears a cross, breaks double ice and spends neither moves nor mana',()=>{const g=fixed(new Game({level:3,seed:77}));g.ice.fill(0);g.ice[27]=2;g.link={from:0,turns:3};g.energy=10;const before=g.moves;const p=g.linkSkill(1),f=p.frames[0];assert(p.valid);assert.equal(p.info.name,'霜雷双绝');assert.equal(f.clear.length,15);assert.equal(f.ice[27],0);assert.equal(f.moves,before);assert.equal(f.energy,25);assert.equal(g.link,null);assert.equal(g.linkUses,1);});
test('cat-and-fox link leaves an actual bomb for a later move',()=>{const g=fixed(new Game({seed:78}));g.link={from:2,turns:2};const p=g.linkSkill(3);assert(p.valid);assert.equal(p.info.name,'幻影破阵');assert(p.frames.some(f=>f.phase==='gift'));assert(g.board.some(t=>t.special==='bomb'));assert.equal(matches(g.board).length,0);});
test('Black Water link clears both diagonals, the limited follow-up cannot be looped',()=>{const g=fixed(new Game({seed:79}));g.link={from:4,turns:3};g.linkUses=1;const p=g.linkSkill(0),f=p.frames[0];assert(p.valid);assert.equal(f.clear.length,16);assert([0,7,56,63].every(i=>f.clear.includes(i)));g.energy=48;g.skill(1);assert.equal(g.link,null);assert(!g.linkSkill(4).valid);});
test('invalid exchanges and shuffles do not spend the link window',()=>{const g=new Game({seed:80});g.energy=48;g.skill(0);g.swap(...invalidPair(g));assert.equal(g.link.turns,3);g.shuffle();assert.equal(g.link.turns,3);});
test('three valid swaps expire an unused link window',()=>{const g=new Game({seed:81});g.config={...g.config,score:1e9};g.energy=48;g.skill(0);for(let i=0;i<3;i++)g.swap(...legalMoves(g.board)[0]);assert.equal(g.link,null);});
test('all pair orderings give the same synergy and unsupported role values are rejected',()=>{for(let a=0;a<6;a++)for(let b=0;b<6;b++){assert.deepEqual(linkInfo(a,b),linkInfo(b,a));assert.equal(!!linkInfo(a,b),a!==b);}assert.equal(linkInfo(NaN,1),null);assert.equal(linkInfo(-1,4),null);assert.equal(linkInfo(6,1),null);});

test('only intended adventure stages and the separate challenge create a guard',()=>{assert.equal(new Game({level:0}).boss,null);assert.equal(new Game({level:1}).boss,null);assert(new Game({level:2}).boss);assert(new Game({level:4}).boss);assert(new Game({challenge:true}).boss);assert.equal(new Game({zen:true,level:4}).boss,null);});
test('clearing a telegraphed cell removes that threat and damages the guard',()=>{const g=new Game({challenge:true,seed:82});const target=g.boss.targets[0],hp=g.boss.hp,charge=g.boss.charge;const f=g.resolve([target])[0];assert(!f.boss.targets.includes(target));assert.equal(f.boss.hp,hp-5);assert.equal(f.boss.charge,charge);});
test('four-cell clears and skills interrupt guard charge without freezing any cells',()=>{const g=new Game({challenge:true,seed:83});g.boss.charge=1;const ice=g.ice.reduce((a,b)=>a+b),frames=g.resolve([0,1,2,3],[],null,{kind:'swap'});assert(frames.some(f=>f.phase==='interrupt'));assert(!frames.some(f=>f.phase==='attack'));assert.equal(g.boss.charge,4);assert(g.ice.reduce((a,b)=>a+b)<=ice);g.boss.charge=1;g.energy=48;assert(g.skill(0).frames.some(f=>f.phase==='interrupt'));assert.equal(g.boss.charge,4);});
test('four ordinary moves trigger the forecast freeze; invalid swaps and shuffles do not advance it',()=>{
  const g=new Game({challenge:true,seed:84});g.swap(...invalidPair(g));assert.equal(g.boss.charge,4);g.shuffle();assert.equal(g.boss.charge,4);
  let last;
  for(let n=0;n<4;n++){
    const chosen=legalMoves(g.board).find(pair=>{const c=Game.restore(g.exportState()),p=c.swap(...pair);return p.frames.filter(f=>f.phase==='clear').length===1&&p.frames.find(f=>f.phase==='clear').clear.length===3;});
    assert(chosen,'Expected at least one ordinary three-match');last=g.swap(...chosen);
  }
  const attack=last.frames.find(f=>f.phase==='attack');assert(attack);assert.equal(g.boss.charge,4);assert(attack.frozen.every(i=>attack.ice[i]===1));assert.equal(new Set(g.boss.targets).size,g.boss.targets.length);
});
test('guard HP is part of victory and killing it on the final move wins before an attack',()=>{const g=new Game({challenge:true,seed:85});g.score=g.config.score;g.collected=g.config.collect;g.ice.fill(0);g.resolve([0]);assert.equal(g.status,'playing');g.boss.hp=1;g.boss.charge=1;g.moves=1;g.board[0].special='row';const p=g.swap(0,1);assert.equal(g.status,'won');assert.equal(g.boss.hp,0);assert(!p.frames.some(f=>f.phase==='attack'));});
test('defeated guards never create more ice while remaining collection goals are unfinished',()=>{const g=new Game({challenge:true,seed:86});g.boss.hp=0;g.boss.targets=[];const before=g.ice.reduce((a,b)=>a+b);g.swap(...legalMoves(g.board)[0]);assert(g.ice.reduce((a,b)=>a+b)<=before);assert(!g.boss.targets.length);});
test('new run state restores boons, link, guard countdown and exact RNG continuation',()=>{const g=new Game({challenge:true,seed:87});g.chooseBoon('torrent');g.energy=36;g.skill(4);const copy=Game.restore(JSON.parse(JSON.stringify(g.exportState())));assert(copy);assert.deepEqual(copy.exportState(),g.exportState());const pair=legalMoves(g.board)[0];assert.deepEqual(copy.swap(...pair),g.swap(...pair));});
test('legacy mid-game saves keep their board and do not gain an unexpected guard',()=>{const g=new Game({level:2,seed:88});const old={level:2,zen:false,board:g.board,ice:g.ice,moves:20,score:1200,collected:7,energy:32,turns:6};const copy=Game.restore(old);assert(copy);assert.deepEqual(copy.board,g.board);assert.equal(copy.moves,20);assert.equal(copy.boss,null);assert.equal(copy.boon,null);});
test('malformed saved boards are rejected safely',()=>{const g=new Game({seed:89}),d=g.exportState();d.board[0].id=d.board[1].id;assert.equal(Game.restore(d),null);assert.equal(Game.restore({}),null);assert.equal(Game.restore(null),null);});

test('Purple Fox chooses the most frozen cross and spends energy without spending a move',()=>{
  const g=fixed(new Game({level:3,seed:101}));g.ice.fill(0);
  const expected=[...new Set([...Array.from({length:8},(_,n)=>16+n),...Array.from({length:8},(_,n)=>n*8+5)])];
  for(const i of expected)g.ice[i]=2;g.ice[0]=1;g.energy=48;
  const before=g.moves,p=g.skill(5),first=p.frames.find(f=>f.phase==='clear');
  assert(p.valid);assert.equal(g.moves,before);assert.deepEqual(new Set(first.clear),new Set(expected));
  assert(expected.every(i=>first.ice[i]===1));assert.equal(first.ice[0],1);assert.equal(first.energy,15);assert.equal(g.link.from,5);assert.equal(matches(g.board).length,0);
});
test('Purple Fox uses a central cross without ice and requires the full skill threshold',()=>{
  const g=fixed(new Game({seed:102}));g.ice.fill(0);g.chooseBoon('torrent');g.energy=35;
  const before=g.exportState();assert(!g.skill(5).valid);assert.deepEqual(g.exportState(),before);
  g.energy=36;const first=g.skill(5).frames[0];
  assert.equal(first.clear.length,15);assert(first.clear.every(i=>(i/8|0)===3||i%8===3));assert.equal(first.energy,15);
});
test('Purple Fox links in either order, breaks double ice, and cannot follow itself',()=>{
  const g=fixed(new Game({level:3,seed:103}));g.ice.fill(0);g.ice[27]=2;g.link={from:5,turns:3};g.energy=7;
  const before=g.exportState();assert(!g.linkSkill(5).valid);assert.deepEqual(g.exportState(),before);
  const first=g.linkSkill(2).frames[0];assert.equal(first.moves,before.moves);assert.equal(first.energy,22);assert.equal(first.clear.length,15);assert.equal(first.ice[27],0);assert.equal(g.linkUses,1);
  assert.equal(linkInfo(2,5).name,'紫梅同心');assert.deepEqual(linkInfo(2,5),linkInfo(5,2));
});
test('Purple Fox link and random continuation survive a saved game',()=>{
  const g=new Game({challenge:true,seed:104});g.chooseBoon('torrent');g.energy=36;g.skill(5);
  const copy=Game.restore(JSON.parse(JSON.stringify(g.exportState())));assert(copy);assert.equal(copy.link.from,5);assert.deepEqual(copy.exportState(),g.exportState());assert.deepEqual(copy.linkSkill(4),g.linkSkill(4));
});
