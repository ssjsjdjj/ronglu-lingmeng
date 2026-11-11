import {Game,BOONS,legalMoves} from '../dist/engine.js';
function value(before,after){return (after.status==='won'?1e6:0)+(Math.min(after.collected,after.config.collect)-Math.min(before.collected,before.config.collect))*17+(before.iceLeft()-after.iceLeft())*25+((before.boss?.hp||0)-(after.boss?.hp||0))*.45+(Math.min(after.score,after.config.score)-Math.min(before.score,before.config.score))*.025+(after.moves-before.moves)*25;}
const report=[];
for(const boon of BOONS){let won=0,turns=0;const losses=[];
  for(let seed=100;seed<110;seed++){
    let g=new Game({challenge:true,seed});g.chooseBoon(boon.id);let actions=0;
    while(g.status==='playing'&&actions++<160){
      let candidates=[];
      if(g.link&&(g.zen||g.linkUses<2))for(let hero=0;hero<5;hero++){const c=Game.restore(g.exportState());if(c.linkSkill(hero).valid)candidates.push(c);}
      if(!candidates.length&&g.energy>=g.energyMax)for(let hero=0;hero<5;hero++){const c=Game.restore(g.exportState());if(c.skill(hero).valid)candidates.push(c);}
      if(!candidates.length)for(const pair of legalMoves(g.board)){const c=Game.restore(g.exportState());c.swap(...pair);candidates.push(c);}
      candidates.sort((a,b)=>value(g,b)-value(g,a));if(!candidates.length)break;g=candidates[0];
    }
    if(g.status==='won'){won++;turns+=g.turns;}else losses.push({seed,hp:g.boss?.hp,ice:g.iceLeft(),collected:g.collected,moves:g.moves});
  }
  report.push({boon:boon.id,wins:won,outOf:10,averageWinningMoves:won?Number((turns/won).toFixed(1)):null,losses});
}
console.log(JSON.stringify(report,null,2));
