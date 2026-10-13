/* 给动画制作的确定性样例。运行时只写本游戏 docs/heist 下的两个示例文件。 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const H=require('../app/heist-core.js'),AI=require('../app/heist-ai.js');
const at=(s,q,r)=>s.board.tiles.find(t=>t.q===q&&t.r===r);
function blank(players=2){
  const s=new H.Game({players}).view();s.piles=[];
  s.board.tiles=s.board.tiles.map(t=>t.kind==='home'?t:{q:t.q,r:t.r,kind:'floor'});
  s.players[0].pos={q:0,r:0};s.players[1].pos={q:-3,r:0};return s;
}
const fixtures=[];
function add(id,label,before,action){
  const result=H.simulate(before,action);if(!result.ok)throw new Error(result.code);
  fixtures.push({id,label,origin:'authored-scenario',before,action,events:result.events,after:result.view});
}
{
  const s=blank();Object.assign(at(s,1,0),{kind:'spring',dir:'E'});
  Object.assign(at(s,3,0),{kind:'portal',exit:{q:-2,r:1}});Object.assign(at(s,-2,1),{kind:'portal',exit:{q:3,r:0}});
  s.piles.push({q:-2,r:1,count:3});add('spring-portal','弹簧弹飞 → 传送 → 抱起松露',s,{type:'move',dir:'E'});
}
{
  const s=blank(3);s.players[1].pos={q:1,r:0};s.players[1].carry=2;s.players[2].pos={q:2,r:0};s.players[2].carry=3;
  at(s,3,0).kind='pit';add('push-domino','拱鼻抢宝 → 连续挤人 → 掉泥坑',s,{type:'push',dir:'E'});
}
{
  const s=blank();s.players[0].pos={q:0,r:1};s.players[1].pos={q:-2,r:0};s.players[1].carry=3;
  s.bombs=[{id:1,owner:0,q:0,r:0,dueTurn:1},{id:2,owner:0,q:-1,r:0,dueTurn:8}];s.players[0].ammo=0;s.nextBombId=3;
  add('bomb-chain','公开读秒 → 两颗连爆 → 掉落与击退',s,{type:'end'});
}
{
  const s=blank();Object.assign(at(s,1,0),{kind:'spring',dir:'E'});Object.assign(at(s,3,0),{kind:'spring',dir:'W'});
  add('spring-loop','两只弹簧互弹 → 循环保护停下',s,{type:'move',dir:'E'});
}
const output=path.join(__dirname,'..','docs','heist');fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'animation-fixtures.json'),JSON.stringify({rulesVersion:H.RULES_VERSION,fixtures},null,2)+'\n');
const g=new H.Game({players:2,first:0});let steps=0;
while(g.view().phase==='playing'){
  const s=g.view(),r=g.act(s.turn,AI.choose(s,{tier:'smart'}),s.revision);
  if(!r.ok||++steps>320)throw new Error('示例对局生成失败');
}
fs.writeFileSync(path.join(output,'sample-match.json'),JSON.stringify(g.save(),null,2)+'\n');
console.log(JSON.stringify({fixtures:fixtures.length,matchSteps:steps,result:g.view().result}));
