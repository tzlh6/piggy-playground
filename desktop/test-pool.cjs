// Physics, rule outcomes and CPU shots. Run with node test-pool.cjs.
const assert=require('node:assert/strict'),A=require('./app/pool-core.js');
let checks=0;function ok(v,s){assert.ok(v,s);checks++}
const near=(a,b,e=.001)=>Math.abs(a-b)<e;
let seed=912761;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
function scene(mode='local',layout={0:[250,250],1:[500,250]}){
 const g=new A.Pool(mode,rng);g.break=false;
 for(const b of g.balls){b.potted=!layout[b.id];b.vx=b.vy=0;if(layout[b.id])[b.x,b.y]=layout[b.id]}
 return g;
}
function settle(g,ms=1000/60){let n=0;while(g.phase==='moving'&&n++<1800)g.update(ms);ok(g.phase!=='moving','a shot always comes to rest');return g.last}
function outcome({group=null,targets,first=1,pots=[],rail=true,brk=false,scratch=false,called=null,mode='local'}){
 const g=new A.Pool(mode,rng);g.break=brk;if(group){g.groups=[group,group==='solid'?'stripe':'solid']}
 if(targets)for(const b of g.balls)if(b.id&&A.group(b.id)===group&&!targets.includes(b.id))b.potted=true;
 if(called!==null)g.callPocket(called);
 ok(g.shoot(0,.4),'rule fixture accepts a shot');g.balls[0].vx=0;g.shot.first=first;g.shot.afterRail=rail;
 if(brk&&rail)g.shot.rails=new Set([1,2,3,4]);
 for(const item of pots)g.pot(g.balls[typeof item==='number'?item:item.id],typeof item==='number'?0:item.pocket);
 if(scratch)g.pot(g.balls[0],0);
 g.resolve();return g;
}
for(let k=0;k<100;k++){
 const g=new A.Pool('local',rng);ok(new Set(g.balls.map(b=>b.id)).size===16,'rack contains each number exactly once');
 ok(g.balls[8].y===250&&g.balls[8].x>750,'8 is centred in the third row');
 const rear=g.balls.filter(b=>b.x>798);ok(rear.some(b=>A.group(b.id)==='solid')&&rear.some(b=>A.group(b.id)==='stripe'),'rack rear has both groups');
 for(let i=0;i<16;i++)for(let j=i+1;j<16;j++)ok(Math.hypot(g.balls[i].x-g.balls[j].x,g.balls[i].y-g.balls[j].y)>=A.R*2,'rack has no overlaps');
}
// First contact, equal-mass exchange, and a real cut retain tangential motion.
{
 const g=scene();g.shoot(0,.5);g.update(330);ok(g.shot.first===1,'straight shot reaches object ball');ok(g.balls[1].vx>500&&g.balls[0].vx<20,'head-on shot transfers normal velocity');
 const cut=scene('local',{0:[250,250],1:[500,267]});cut.shoot(0,.5);cut.update(360);
 ok(cut.shot.first===1,'cut makes contact');ok(cut.balls[1].vy>0&&cut.balls[0].vy<0,'cut separates object and cue along different paths');
}
// 20, 60 and 144 Hz produce identical fixed-step state after the same interval.
const positions=[];
for(const hz of [20,60,144]){
 const g=scene('local',{0:[250,250],1:[500,267],8:[750,180]});g.shoot(0,.8);let left=1600;
 while(left>1e-8){const dt=Math.min(left,1000/hz);g.update(dt);left-=dt}
 positions.push(g.balls.map(b=>[b.x,b.y,b.vx,b.vy]));
}
for(let i=1;i<3;i++)for(const b of [0,1,8])for(let j=0;j<4;j++)ok(near(positions[0][b][j],positions[i][b][j],1e-7),'frame rate does not change physics');
// Corner and centre pockets, cushion rebounds, jaw geometry and no tunnelling.
for(const [id,p] of A.POCKETS.entries()){
 const dx=p.x===0?130:p.x===1000?-130:0,dy=p.y<100?130:-130;
 const g=scene('practice',{0:[p.x+dx,p.y+dy]});g.shoot(Math.atan2(-dy,-dx),.28);settle(g);
 ok(g.last.pots.some(b=>b.id===0&&b.pocket===id),'cue enters actual pocket '+id);ok(g.ballInHand,'practice scratch allows placement');
}
{
 const g=scene('practice',{0:[250,100],1:[800,400]});g.shoot(-Math.PI/2,.45);g.update(220);ok(g.balls[0].vy>0,'closed cushion reflects a fast shot');
 const q=A.trace(g,Math.PI/2);ok(Number.isFinite(q.x)&&q.dist>0,'guide can raycast a real cushion');
 const fast=scene('practice',{0:[200,250],1:[450,250],8:[800,400]});fast.shoot(0,1);fast.update(200);ok(fast.shot.first===1,'max speed cannot tunnel through a ball');settle(fast);
 const guide=scene();const ray=A.trace(guide,0);ok(ray.hit===1&&near(ray.x,500-A.R*2),'ghost cue predicts first ball contact');
}
{
 const g=new A.Pool('local',rng);g.shoot(0,1);settle(g);
 ok(g.last.first===1,'full rack break hits apex');
 ok(g.balls.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.vx)),'break never produces NaN');
 ok(g.balls.every(b=>b.potted||(b.x>=-35&&b.x<=1035&&b.y>=-35&&b.y<=535)),'all live balls remain accessible');
}
// Rule regressions: open break, assignment, continuation, foul and called eight.
let g=outcome({brk:true,pots:[2]});ok(g.groups[0]===null&&g.turn===0,'break keeps table open and legal pot continues');
g=outcome({pots:[10,2],first:10});ok(g.groups[0]==='stripe'&&g.groups[1]==='solid','first actual post-break pot assigns groups');
g=outcome({group:'solid',pots:[1]});ok(g.turn===0&&!g.last.foul,'own pot continues');
g=outcome({group:'solid',pots:[9]});ok(g.turn===1&&!g.last.foul,'opponent-only pot passes without foul');
for(const options of [{first:null},{group:'solid',first:9},{rail:false},{scratch:true}]){
 g=outcome(options);ok(g.ballInHand&&g.turn===1&&!!g.last.foul,'foul grants incoming player ball in hand');
 ok(!g.placeCue(-5,250)&&!g.placeCue(g.balls[1].x,g.balls[1].y),'reject invalid or overlapping placement');
 ok(g.placeCue(200,200)&&g.canShoot,'legal placement restores shooting');
}
g=outcome({group:'solid',pots:[8]});ok(g.over&&g.winner===1,'early eight loses');
g=outcome({group:'solid',targets:[1],pots:[1,8]});ok(g.winner===1,'last group ball plus eight in one shot loses');
g=outcome({group:'solid',targets:[],first:8,pots:[{id:8,pocket:4}],called:4});ok(g.over&&g.winner===0,'cleared group plus called eight wins');
g=outcome({group:'solid',targets:[],first:8,pots:[{id:8,pocket:3}],called:4});ok(g.winner===1,'eight into wrong called pocket loses');
g=outcome({group:'solid',targets:[],first:8,pots:[{id:8,pocket:4}],called:4,scratch:true});ok(g.winner===1,'eight and scratch loses');
g=outcome({brk:true,pots:[8]});ok(!g.over&&!g.balls[8].potted,'eight on break is respotted');
g=outcome({brk:true,pots:[8],scratch:true});ok(g.ballInHand&&!g.balls[8].potted&&g.turn===1,'break eight with scratch respots and gives ball in hand');
g=outcome({mode:'practice',first:8,pots:[8]});ok(!g.over&&g.balls[8].potted,'practice allows eight first');
{
 const g=scene('local',{0:[250,250],8:[700,250]});g.groups=['solid','stripe'];
 ok(g.needsCall&&!g.shoot(0,.5),'cannot shoot eight before selecting pocket');ok(g.callPocket(2)&&g.shoot(0,.5),'called pocket unlocks shot');
}
// A geometrically clear pot must actually drop; AI does not shoot through blockers.
for(const difficulty of ['easy','normal','hard']){
 const g=scene(difficulty,{0:[500,380],1:[500,170],8:[850,350],9:[850,200]});g.groups=['solid','stripe'];
 const shot=A.plan(g,difficulty,()=>.5);ok(shot&&Number.isFinite(shot.angle),'CPU produces finite shot');
 ok(g.shoot(shot.angle,shot.power),'CPU shot accepted');settle(g);ok(g.balls[1].potted,'CPU can actually pot a clear ball at '+difficulty);
}
{
 const g=new A.Pool('hard',rng);let shots=0;
 while(!g.over&&shots++<250){const s=A.plan(g,'hard',rng);ok(s&&Number.isFinite(s.power),'CPU handles crowded table / free ball');if(g.needsCall)g.callPocket(s.pocket);ok(g.shoot(s.angle,s.power),'CPU can play full legal turn');settle(g,1000/30)}
 ok(g.over,'CPU self-play can finish a full rack');
 console.log('CPU self-play:',shots,'shots; winner',g.winner);
}
console.log('PASS:',checks,'pool physics, frame independence, placement, eight-ball rules and CPU checks.');
