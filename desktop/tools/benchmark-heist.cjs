/* 轮换先手的公开对打基准。策略与视图完全相同，不给电脑额外信息。
 * node tools/benchmark-heist.cjs [报告.json]
 * 结果只描述这些固定布局，不是人类水平评级或已证明的平衡性。
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const H=require('../app/heist-core.js'),AI=require('../app/heist-ai.js');
const matches=[],start=Date.now();
for(const n of [2,3,4])for(const mode of ['all-smart','devil-vs-smart'])for(let first=0;first<n;first++){
  const g=new H.Game({players:n,first}),tiers=Array(n).fill('smart');if(mode==='devil-vs-smart')tiers[0]='devil';
  const times=[],depths=[],events={};let actions=0;
  while(g.view().phase==='playing'){
    const s=g.view(),t=performance.now(),decision=AI.analyze(s,{tier:tiers[s.turn]});
    times.push(performance.now()-t);if(s.turn===0)depths.push(decision.searchDepth);
    const r=g.act(s.turn,decision.action,s.revision);if(!r.ok)throw new Error(r.code);
    for(const e of r.events)events[e.type]=(events[e.type]||0)+1;
    if(++actions>320)throw new Error('比赛未在步数上限内结束');
  }
  const result={players:n,mode,first,tiers,result:g.view().result,actions,
    meanDecisionMs:+(times.reduce((a,b)=>a+b,0)/times.length).toFixed(2),maxDecisionMs:+Math.max(...times).toFixed(2),
    minSeat0SearchDepth:Math.min(...depths),maxSeat0SearchDepth:Math.max(...depths),
    interaction:{push:events.push||0,plant:events.plant||0,rotate:events.rotate||0,gates:events.gates||0,fall:events.fall||0}};
  matches.push(result);console.log(JSON.stringify(result));
}
const report={rulesVersion:H.RULES_VERSION,algorithm:'selective-maxn',games:matches.length,totalMs:Date.now()-start,
  scope:'Fixed arena; rotate first seat. One devil at seat 0 versus smart opponents; no claim of statistical significance.',matches};
if(process.argv[2]){const target=path.resolve(process.argv[2]);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({games:report.games,totalMs:report.totalMs}));
