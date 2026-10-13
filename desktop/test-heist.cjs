'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const H=require('./app/heist-core.js');
const AI=require('./app/heist-ai.js');
const Search=require('./app/heist-search.js');
let checks=0;
const ok=(x,m)=>{checks++;assert.ok(x,m);};
const equal=(a,b,m)=>{checks++;assert.deepEqual(a,b,m);};
const same=(a,b)=>a&&b&&a.q===b.q&&a.r===b.r;
const tile=(s,p)=>s.board.tiles.find(t=>same(t,p));
const total=s=>s.piles.reduce((n,p)=>n+p.count,0)+s.players.reduce((n,p)=>n+p.carry+p.score,0);
const event=(r,type)=>r.events.find(e=>e.type===type);
function scene(n=2){
  const s=new H.Game({players:n}).view();
  s.board.tiles.forEach(t=>{if(t.kind!=='home'){t.kind='floor';delete t.dir;delete t.exit;delete t.group;delete t.open;delete t.rate;delete t.cap;}});
  s.players[0].pos={q:0,r:0};s.players[1].pos={q:-3,r:0};s.piles=[];return s;
}
function act(s,a){const r=H.simulate(s,a);ok(r.ok,JSON.stringify(a)+'：'+r.code);return r;}
function invariant(s){
  const occupied=new Set();
  for(const p of s.players){
    ok(Number.isInteger(p.score)&&p.score>=0&&p.carry>=0&&p.carry<=5,'积分与背包范围');
    ok(Number.isInteger(p.ammo)&&p.ammo>=0&&p.ammo+s.bombs.filter(b=>b.owner===p.id).length<=2,'弹药守恒上限');
    if(p.pos){const t=tile(s,p.pos);ok(t&&t.kind!=='pit'&&!(t.kind==='gate'&&!t.open),'猪猪在可站立格');
      ok(t.kind!=='home'||t.owner===p.id,'不能侵占别人的家');const k=p.pos.q+','+p.pos.r;ok(!occupied.has(k),'实体不重叠');occupied.add(k);}
  }
  const ids=new Set();
  for(const b of s.bombs){const t=tile(s,b),k=b.q+','+b.r;ok(t&&t.kind!=='pit'&&t.kind!=='home'&&!(t.kind==='gate'&&!t.open),'弹在合法格');
    ok(!occupied.has(k),'弹不与猪或其他弹重叠');occupied.add(k);ok(!ids.has(b.id)&&b.id<s.nextBombId,'弹编号唯一');ids.add(b.id);}
  const pileKeys=new Set();for(const p of s.piles){const k=p.q+','+p.r;ok(tile(s,p)&&p.count>0&&Number.isInteger(p.count)&&!pileKeys.has(k),'战利品有效');pileKeys.add(k);}
  ok(s.ap>=0&&s.ap<=2&&s.turn>=0&&s.turn<s.players.length,'轮次和行动点有效');
  if(s.phase==='playing')ok(s.players[s.turn].pos,'当前行动者已返场');
  if(s.phase==='finished')ok(s.result&&s.result.winners.length>0,'终局有获胜者');
}

// 开局参数、独立快照、非法命令、重放/重复点击都不能改动权威状态。
for(const n of [2,3,4])for(let first=0;first<n;first++){
  const g=new H.Game({players:n,first}),s=g.view();equal(s.turn,first);equal(s.board.tiles.length,61);equal(total(s),6);invariant(s);
}
for(const opts of [{players:1},{players:5},{players:2.2},{first:3},{target:0},{maxRounds:100},{oops:1}])assert.throws(()=>new H.Game(opts));
const game=new H.Game(),before=game.view();
const invalid=[null,{},[],{type:'wat'},{type:'__proto__'},{type:'move',dir:'X'},{type:'move',dir:'W',ap:99},{type:'rotate',at:{q:NaN,r:0},step:1},{type:'plant',dir:'E'}];
for(const a of invalid){const r=game.act(0,a,0);ok(!r.ok,'非法行动拒绝');equal(game.view(),before,'非法行动无副作用');equal(r.events,[]);}
ok(!game.act(1,{type:'end'},0).ok);ok(!game.act(0,{type:'end'},undefined).ok);ok(!game.act(0,{type:'end'},99).ok);
const leaked=game.view();leaked.players[0].score=999;leaked.board.tiles[0].kind='pit';equal(game.view(),before,'快照不能反写');
const walk={type:'move',dir:'W'},prediction=game.preview(0,walk,0);equal(game.view(),before,'预览不消耗行动');
const commit=game.act(0,walk,0);equal(commit,prediction,'预览与执行完全一致');ok(!game.act(0,walk,0).ok,'重复提交被拒绝');
commit.view.players[0].score=999;ok(game.view().players[0].score!==999,'返回结果不能修改权威状态');
game.act(0,{type:'move',dir:'W'},1);
const saved=game.save();equal(H.Game.load(JSON.stringify(saved)).view(),game.view(),'存档逐行动重放');
const frames=H.Game.replay(saved);equal(frames.length,saved.actions.length+1);equal(frames[frames.length-1].view,game.view());
const revision=game.view().revision;ok(game.undo().ok);equal(game.view().revision,revision+1);ok(!game.act(game.view().turn,{type:'end'},revision).ok);
ok(game.undo().ok);ok(!game.undo().ok);
assert.throws(()=>H.Game.load({...saved,rulesVersion:'bad'}));assert.throws(()=>H.Game.load({...saved,actions:[{seat:1,action:{type:'end'}}]}));
assert.throws(()=>H.Game.load({...saved,actions:new Array(321).fill({seat:0,action:{type:'end'}})}));

// 行动点、捡取上限、回家交存、回合与整轮判胜。
{
  const s=scene();s.piles=[{q:1,r:0,count:8}];const r=act(s,{type:'move',dir:'E'});
  equal(r.view.players[0].carry,5);equal(r.view.piles[0].count,3);equal(r.view.ap,1);equal(s.players[0].carry,0);
  const next=act(r.view,{type:'end'});equal(next.view.turn,1);equal(next.view.ap,2);
}
{
  const s=scene();s.config.target=5;s.players[0].pos={q:3,r:0};s.players[0].carry=5;s.players[0].ammo=0;
  const r=act(s,{type:'move',dir:'E'});equal(r.view.players[0].score,5);equal(r.view.players[0].carry,0);equal(r.view.players[0].ammo,2);
  equal(r.view.phase,'playing','达到目标要等整轮结束');let next=act(r.view,{type:'end'});equal(next.view.turn,1);
  next.view.players[1].score=5;next=act(next.view,{type:'end'});equal(next.view.result.winners,[0,1],'同分共享胜利');
  equal(next.view.result.reason,'target');equal(H.legalActions(next.view),[]);ok(!H.simulate(next.view,{type:'end'}).ok);
}

// 弹簧跳过中间地形；传送出口不反弹，出口被占时停留；循环弹簧有确定的停止规则。
{
  const s=scene();Object.assign(tile(s,{q:1,r:0}),{kind:'spring',dir:'E'});tile(s,{q:2,r:0}).kind='pit';
  const r=act(s,{type:'move',dir:'E'});equal(r.view.players[0].pos,{q:3,r:0});ok(event(r,'spring'));ok(!event(r,'fall'));
}
{
  const s=scene();Object.assign(tile(s,{q:1,r:0}),{kind:'spring',dir:'E'});
  Object.assign(tile(s,{q:3,r:0}),{kind:'portal',exit:{q:-2,r:1}});Object.assign(tile(s,{q:-2,r:1}),{kind:'portal',exit:{q:3,r:0}});
  const r=act(s,{type:'move',dir:'E'});equal(r.view.players[0].pos,{q:-2,r:1});equal(r.events.filter(e=>e.type==='teleport').length,1);
  s.players[1].pos={q:-2,r:1};const blocked=act(s,{type:'move',dir:'E'});equal(blocked.view.players[0].pos,{q:3,r:0});ok(event(blocked,'portalBlocked'));
}
{
  const s=scene();Object.assign(tile(s,{q:1,r:0}),{kind:'spring',dir:'E'});Object.assign(tile(s,{q:3,r:0}),{kind:'spring',dir:'W'});
  const r=act(s,{type:'move',dir:'E'});equal(r.view.players[0].pos,{q:1,r:0});ok(event(r,'chainStopped'));ok(r.events.length<20);invariant(r.view);
}
{
  const s=scene();Object.assign(tile(s,{q:1,r:0}),{kind:'spring',dir:'E'});
  const r=act(s,{type:'rotate',at:{q:1,r:0},step:-1});equal(tile(r.view,{q:1,r:0}).dir,'NE');equal(r.view.ap,1);
  ok(!H.simulate(s,{type:'rotate',at:{q:3,r:0},step:1}).ok);
}

// 推撞、连续挤人、泥坑掉落与下一次本人回合返场。
{
  const s=scene();s.players[1].pos={q:1,r:0};s.players[1].carry=2;
  const r=act(s,{type:'push',dir:'E'});equal(r.view.players[0].carry,1,'跟进捡起拱落的松露');equal(r.view.players[1].carry,1);
  equal(total(r.view),2);equal(event(r,'spill').reason,'push');
}
{
  const s=new H.Game().view();s.players[0].pos={q:0,r:0};s.turn=1;s.turnNumber=1;
  const r=act(s,{type:'end'});equal(r.view.round,2);equal(r.view.players[0].carry,2,'井口补给长在脚下也拾取');
  equal(total(r.view),14,'首轮结束生成 8 颗');
}
{
  const s=scene(3);s.players[1].pos={q:1,r:0};s.players[2].pos={q:2,r:0};s.players[2].carry=3;
  tile(s,{q:3,r:0}).kind='pit';const r=act(s,{type:'push',dir:'E'});
  equal(r.view.players[0].pos,{q:1,r:0});equal(r.view.players[1].pos,{q:2,r:0});equal(r.view.players[2].pos,null);
  equal(total(r.view),3,'掉落松露不消失');ok(event(r,'spill'));invariant(r.view);
  let next=act(r.view,{type:'end'});equal(next.view.turn,1);equal(next.view.players[2].pos,null);
  next=act(next.view,{type:'end'});equal(next.view.turn,2);equal(next.view.players[2].pos,next.view.players[2].home);ok(event(next,'respawn'));
}
{
  const s=scene();s.players[0].pos={q:3,r:1};Object.assign(tile(s,{q:3,r:0}),{kind:'spring',dir:'E'});
  s.players[0].carry=4;const r=act(s,{type:'move',dir:'NW'});equal(r.view.players[0].pos,null);equal(r.view.turn,1);equal(total(r.view),4);ok(event(r,'fall'));
}

// 闸门成对连动、占用保护、阻挡移动与爆炸。
{
  const s=scene();for(const q of [1,-1])Object.assign(tile(s,{q,r:0}),{kind:'gate',open:true,group:0});
  const r=act(s,{type:'toggle',at:{q:1,r:0}});ok(!tile(r.view,{q:-1,r:0}).open);ok(!H.simulate(r.view,{type:'move',dir:'E'}).ok);
  s.players[1].pos={q:-1,r:0};const bad=H.simulate(s,{type:'toggle',at:{q:1,r:0}});equal(bad.code,'OCCUPIED_GATE');equal(bad.view,s);
}

// 臭臭弹一整圈后爆炸、可被推动和弹射、连爆、家园保护与闸门挡爆。
{
  let s=scene();s.players[0].pos={q:0,r:1};s.players[1].pos={q:2,r:0};
  let r=act(s,{type:'plant',dir:'NW'});equal(r.view.bombs[0].dueTurn,2);equal(r.view.players[0].ammo,1);
  r=act(r.view,{type:'end'});ok(!event(r,'explode'));equal(r.view.turn,1);
  r=act(r.view,{type:'end'});ok(event(r,'explode'));equal(r.view.bombs.length,0);equal(r.view.players[1].pos,{q:3,r:0});equal(r.view.turn,0);
}
{
  const s=scene();s.players[0].pos={q:0,r:1};s.players[1].pos={q:-2,r:0};s.players[1].carry=3;
  s.bombs=[{id:1,owner:0,q:0,r:0,dueTurn:1},{id:2,owner:0,q:-1,r:0,dueTurn:20}];s.nextBombId=3;s.players[0].ammo=0;
  const r=act(s,{type:'end'});equal(r.events.filter(e=>e.type==='explode').map(e=>e.bombId),[1,2]);equal(r.view.bombs.length,0);equal(total(r.view),3);invariant(r.view);
}
{
  const s=scene();s.players[0].pos=s.players[0].home;s.players[1].pos={q:0,r:0};
  s.bombs=[{id:1,owner:0,q:2,r:0,dueTurn:1}];s.nextBombId=2;s.players[0].ammo=1;
  Object.assign(tile(s,{q:1,r:0}),{kind:'gate',group:0,open:false});
  const r=act(s,{type:'end'});equal(r.view.players[0].pos,s.players[0].home);equal(r.view.players[1].pos,{q:0,r:0});ok(!event(r,'hit'));
}
{
  const s=scene();s.bombs=[{id:1,owner:0,q:1,r:0,dueTurn:2}];s.nextBombId=2;s.players[0].ammo=1;
  Object.assign(tile(s,{q:2,r:0}),{kind:'spring',dir:'NE'});
  const r=act(s,{type:'push',dir:'E'});equal({q:r.view.bombs[0].q,r:r.view.bombs[0].r},{q:4,r:-2});equal(r.view.bombs[0].dueTurn,2);ok(event(r,'spring'));
}
{
  // 同一股冲击先推中间猪，再将外侧猪送回自家；后者不能被已锁定命中再次炸出家门。
  const s=scene();s.players[0].pos={q:-2,r:0};s.players[1].pos={q:-3,r:0};s.players[1].carry=3;
  s.bombs=[{id:1,owner:0,q:-1,r:0,dueTurn:1}];s.nextBombId=2;s.players[0].ammo=1;
  const r=act(s,{type:'end'});equal(r.view.players[1].pos,s.players[1].home);
  equal(r.view.players[1].score,3);equal(r.view.players[1].falls,0);
  equal(r.events.filter(e=>e.type==='hit').map(e=>e.seat),[0],'中途回家立即获得保护');invariant(r.view);
}
{
  let s=scene(4);s.players[0].pos={q:0,r:1};let r=act(s,{type:'plant',dir:'NW'});
  for(let i=1;i<=4;i++){r=act(r.view,{type:'end'});equal(!!event(r,'explode'),i===4,'四人局完整一圈才引爆');}
  equal(r.view.turn,0);equal(r.view.bombs.length,0);
}

// AI 有实际的抢夺战术选择，不能仅靠放大搜索预算命名难度。
{
  const s=scene();s.players[0].carry=4;s.players[0].score=5;s.players[0].pos={q:3,r:-1};
  s.players[1].carry=5;s.players[1].score=9;s.players[1].pos={q:4,r:-1};
  const choice=AI.choose(s,{tier:'devil'});equal(choice,{type:'push',dir:'E'},'识别抢一颗并把领先者挤出边界的战术');
}

// 浏览器全局、Worker 消息协议不依赖 Node/DOM；Worker 的三种标识必须原样返回。
{
  // 玩家 1 选择自己的 7 分，不能把三人博弈误作“其他人联合压低玩家 0”。
  const tree={turn:0,children:[{name:'A',turn:1,children:[{values:[10,7,0]},{values:[1,3,20]}]},
    {name:'B',turn:2,children:[{values:[4,5,1]},{values:[3,0,9]}]}]};
  const adapter={isTerminal:n=>!!n.values,player:n=>n.turn,evaluate:n=>n.values||[0,0,0],children:n=>n.children};
  const r=Search.maxN(tree,adapter,2);equal(r.child.name,'A');equal(r.values,[10,7,0]);ok(r.completed);
  ok(!Search.maxN(tree,adapter,2,2).completed,'预算耗尽不返回偏置的半棵搜索树');
}
{
  const browser=vm.createContext({});vm.runInContext(fs.readFileSync('app/heist-core.js','utf8'),browser);
  vm.runInContext(fs.readFileSync('app/heist-search.js','utf8'),browser);
  vm.runInContext(fs.readFileSync('app/heist-ai.js','utf8'),browser);
  const rendered=vm.runInContext('new PigHeistCore.Game({players:3}).view()',browser);equal(JSON.parse(JSON.stringify(rendered)),new H.Game({players:3}).view());
  let response;const ctx=vm.createContext({self:{postMessage:v=>{response=v;}}});
  ctx.importScripts=(...names)=>names.forEach(name=>vm.runInContext(fs.readFileSync('app/'+name,'utf8'),ctx));
  vm.runInContext(fs.readFileSync('app/heist-ai-worker.js','utf8'),ctx);
  ctx.self.onmessage({data:{requestId:'r1',sessionId:7,view:new H.Game().view(),options:{tier:'easy'}}});
  ok(response.ok);equal(response.requestId,'r1');equal(response.sessionId,7);equal(response.revision,0);ok(response.result.action);
  ctx.self.onmessage({data:{requestId:'r2',sessionId:7,view:null}});ok(!response.ok,'坏 Worker 请求返回错误');
}

// 固定种子随机完整对局：检查每一步不变量、预览一致、资源守恒、上限结束与存档还原。
function rng(seed){let a=seed>>>0;return ()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296;};}
const counts={};let fuzzGames=0;
for(const n of [2,3,4])for(let seed=1;seed<=30;seed++){
  const g=new H.Game({players:n,first:seed%n,maxRounds:8}),random=rng(seed*719+n);let resources=6,steps=0;
  while(g.view().phase==='playing'){
    const s=g.view(),legal=g.legalActions(),a=legal[Math.floor(random()*legal.length)];
    const predicted=g.preview(s.turn,a,s.revision),r=g.act(s.turn,a,s.revision);ok(r.ok);equal(r,predicted,'随机对局预览等于执行');
    for(const e of r.events){counts[e.type]=(counts[e.type]||0)+1;if(e.type==='supply')resources+=e.amount;}
    equal(new Set(r.events.map(e=>e.id)).size,r.events.length,'事件标识唯一');equal(total(r.view),resources,'全局资源守恒');invariant(r.view);
    ok(++steps<=8*n*2,'对局必定结束');
  }
  equal(H.Game.load(g.save()).view(),g.view());fuzzGames++;
}
ok(counts.explode>20&&counts.spring>20&&counts.teleport>20&&counts.fall>10&&counts.gates>20,'随机对局覆盖机关交互');

// 三档 AI 能在不同人数/先手下合法完成整局，不偷看、不改快照，节点预算有界。
let aiGames=0;const aiStats=[];
for(const n of [2,3,4])for(const tier of ['easy','smart','devil']){
  const g=new H.Game({players:n,first:(n+1)%n,maxRounds:12});let steps=0,nodes=0;const start=Date.now();
  while(g.view().phase==='playing'){
    const s=g.view(),copy=JSON.stringify(s),d=AI.analyze(s,{tier});equal(JSON.stringify(s),copy,'AI 不改快照');
    ok(d.nodes<=AI.TIERS[tier].nodes,'节点预算有效');nodes+=d.nodes;
    const r=g.act(s.turn,d.action,s.revision);ok(r.ok,'AI 行动合法');invariant(r.view);ok(++steps<=12*n*2);
  }
  aiGames++;aiStats.push({players:n,tier,steps,nodes,ms:Date.now()-start,scores:g.view().result.scores});
}
const reproducible=new H.Game().view();equal(AI.analyze(reproducible,{tier:'devil'}),AI.analyze(reproducible,{tier:'devil'}),'AI 可复现');
console.log(JSON.stringify({checks,fuzzGames,aiGames,events:counts,aiStats}));
