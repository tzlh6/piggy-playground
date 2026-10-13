/* 无画面的完整对局示例：node tools/demo-heist.cjs [2|3|4] [easy|smart|devil] */
'use strict';
const H=require('../app/heist-core.js');
const AI=require('../app/heist-ai.js');
const game=new H.Game({players:Number(process.argv[2]||2)}),tier=process.argv[3]||'smart';
let commands=0,totalNodes=0;const start=Date.now();
while(game.view().phase==='playing'){
  const before=game.view(),decision=AI.analyze(before,{tier});
  const result=game.act(before.turn,decision.action,before.revision);
  if(!result.ok)throw new Error(result.code);
  commands++;totalNodes+=decision.nodes;
  for(const e of result.events)if(['deposit','fall','roundEnd','finish'].includes(e.type))console.log(JSON.stringify(e));
  if(commands>320)throw new Error('对局未在上限内结束');
}
console.log(JSON.stringify({commands,totalNodes,milliseconds:Date.now()-start,result:game.view().result}));
