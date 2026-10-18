/* 猪猪闯算门 rules regression: every formula is recomputed independently,
 * gates are monotone, every level is winnable on the best route and the
 * outcome does not depend on frame rate. */
const assert=require('node:assert/strict');
const G=require('./app/gate-core.js');
let checks=0;function ok(v,message){assert.ok(v,message);checks++}
let seed=90210;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const near=(a,b,eps)=>Math.abs(a-b)<=(eps||1e-6)*Math.max(1,Math.abs(b));
function simpson(f,a,b){const n=2000,h=(b-a)/n;let s=f(a)+f(b);for(let i=1;i<n;i++)s+=f(a+i*h)*(i%2?4:2);return s*h/3}
const dd=(f,x)=>(f(x+1e-5)-f(x-1e-5))/2e-5;
const fact=m=>m<=1?1:m*fact(m-1);
// Independent evaluation by form name and parameters (numerical where it is calculus).
const EVAL={
 int2x:p=>simpson(x=>2*x,0,p.a),int3x2:p=>simpson(x=>3*x*x,0,p.a),intsin:()=>simpson(Math.sin,0,Math.PI),intc:p=>simpson(()=>p.c,0,p.a),
 d2:p=>dd(x=>x*x,p.a),d3:p=>dd(x=>x*x*x,p.a),limsin:p=>Math.sin(p.a*1e-7)/1e-7,liminf:p=>{const x=1e7;return (p.a*x*x+1)/(x*x+3)},
 dlin:p=>dd(x=>p.a*x+p.b,1.3),sum:p=>{let s=0;for(let i=1;i<=p.m;i++)s+=i;return s},log:p=>Math.log2(Math.pow(2,p.a)),fact:p=>fact(p.m),
 eln:p=>Math.exp(Math.log(p.a)),perm:p=>p.m*(p.m-1),sqrtsq:p=>Math.sqrt(p.a*p.a),dpoly:p=>dd(x=>x*x+p.a*x,1),
 limq:p=>{const x=p.a+1e-7;return (x*x-p.a*p.a)/(x-p.a)},liminf1:p=>{const x=1e9;return (p.a*x+1)/x},intlin:p=>simpson(x=>x+p.c,0,2),
 sq:p=>p.a*p.a,pow2:p=>Math.pow(2,p.e),cube:p=>p.a**3
};
const forms=new Set();
for(const pool of [G.HARD_FORMS,G.MID_FORMS])for(const f of pool)for(let k=1;k<=999;k++){
 const h=f(k);if(!h)continue;forms.add(h.form);
 ok(EVAL[h.form],'evaluator for '+h.form);ok(near(EVAL[h.form](h.p),k,1e-5),h.form+' '+JSON.stringify(h.p)+' = '+k);
 ok(G.plain(h.nodes).length>0,'printable '+h.form);
}
ok(forms.size===Object.keys(EVAL).length,'every form exercised: '+[...forms].join(','));

// Gates are integer, capped and monotone, so greedy choice is the optimum.
const kinds=[['add',7],['sub',5],['mul',3],['div',2],['div',3],['sq',0],['sqrt',0],['dbl',0],['tri',0],['log',0],['same',0]];
for(const mode of ['easy','normal','hard'])for(const [kind,k] of kinds){
 const op=G.makeOp(kind,k,mode,rng);let prev=-1;
 for(let n=0;n<=G.MAX_COUNT;n++){const v=op.apply(n);ok(Number.isInteger(v)&&v>=0&&v<=G.MAX_COUNT,'range '+kind);ok(v>=prev,'monotone '+kind+' at '+n);prev=v}
}
ok(G.makeOp('sq',0,'hard',rng).apply(12)===144&&G.makeOp('sqrt',0,'normal',rng).apply(50)===7&&G.makeOp('dbl',0,'hard',rng).apply(21)===42,'n-ops');
ok(G.makeOp('tri',0,'hard',rng).apply(10)===55&&G.makeOp('log',0,'hard',rng).apply(100)===6&&G.makeOp('same',0,'hard',rng).apply(33)===33,'n-ops 2');
ok(G.makeOp('div',3,'easy',rng).apply(10)===3&&G.makeOp('sub',9,'easy',rng).apply(4)===0&&G.makeOp('mul',3,'easy',rng).apply(500)===999,'floor / floor at 0 / cap');

// Drive a run choosing a side before each gate.
function play(level,stage,pick,dt){
 seed=stage*7919+level.length*31;const r=new G.Run(level,rng,stage);r.start();
 let guard=0;
 while(!r.over&&guard++<200000){
  const row=r.rows.slice(r.next).find(x=>x.type==='gate');
  if(row){const side=pick(row,r);r.x=r.targetX=side==='left'?-.8:.8}
  r.update(typeof dt==='function'?dt():dt);
 }
 return r;
}
const best=row=>row.best,worst=(row,r)=>row.left.apply(r.count)<=row.right.apply(r.count)?'left':'right';
for(const level of ['easy','normal','hard'])for(let stage=1;stage<=6;stage++){
 seed=stage*7919+level.length*31;const L=G.makeLevel(level,rng,stage);
 ok(L.bossHp>=1&&L.bossHp<=L.optimal,'hp within reach '+level+stage);
 ok(L.rows.filter(x=>x.type==='gate').length===G.LEVELS[level].gates,'gate count');
 for(const row of L.rows)if(row.type==='gate'){ok(row.left.text!==undefined&&row.right.text!==undefined,'labels');}
 const a=play(level,stage,best,.05);
 ok(a.phase==='won','best route wins '+level+' stage '+stage);
 ok(a.result.score===a.L.optimal-a.L.bossMax||a.result.score===a.L.optimal-a.bossMax,'score = optimal - hp');
 ok(a.passed.every(p=>p.best),'all best');
 const b=play(level,stage,best,()=>.004+rng()*.09);
 ok(b.phase===a.phase&&b.result.score===a.result.score,'frame-rate independent '+level+stage);
 const w=play(level,stage,worst,.05);
 if(w.L.bossHp>w.L.worst)ok(w.phase==='lost','worst route loses '+level+stage);
}
// Many random levels: optimal stays sane, gate pairs differ, hp is reachable.
for(const level of ['easy','normal','hard'])for(let i=0;i<400;i++){
 const L=G.makeLevel(level,rng,1+(i%5));
 ok(L.optimal>=L.bossHp&&L.bossHp>=1,'reachable');
 let n=G.LEVELS[level].start;
 for(const row of L.rows){if(row.type==='gate'){const l=row.left.apply(n),r=row.right.apply(n);ok(l!==r,'pair differs');ok(row.best===(l>=r?'left':'right'),'best flag');n=Math.max(l,r)}else{ok(row.n>=3,'enemy size');n=Math.max(0,n-row.n)}}
 ok(n===L.optimal,'optimal recomputed');
}
// Lifecycle: ready -> run, steering clamps to the road for big crowds, enemies trade one for one.
{seed=4;const r=new G.Run('easy',rng,1);ok(r.phase==='ready','ready');r.update(1);ok(r.z===0,'no motion before start');r.start();ok(r.phase==='run','run');
 r.count=160;r.steer(99);ok(r.targetX<=G.ROAD&&r.targetX===G.steerLimit(160),'clamp');r.count=1;r.steer(99);ok(r.targetX>r.limit()-1e-9&&G.steerLimit(1)>G.steerLimit(160),'small crowd moves wider');
 const e=r.rows.find(x=>x.type==='enemy');r.next=r.rows.indexOf(e);r.z=e.z-2;r.count=e.n+5;let ev=[];for(let i=0;i<400&&!ev.some(x=>x.type==='cleared')&&!r.over;i++)ev=ev.concat(r.update(.05));
 ok(ev.some(x=>x.type==='clash')&&ev.some(x=>x.type==='cleared')&&r.count===5,'enemy trade 1:1');
 const r2=new G.Run('easy',rng,1);r2.start();const e2=r2.rows.find(x=>x.type==='enemy');r2.next=r2.rows.indexOf(e2);r2.z=e2.z-2;r2.count=e2.n-1;for(let i=0;i<200&&!r2.over;i++)r2.update(.05);
 ok(r2.phase==='lost'&&r2.result.reason==='enemy','too few pigs lose to boars');
 const r3=new G.Run('easy',rng,1);r3.start();r3.next=r3.rows.length;r3.z=r3.bossZ-G.BOSS_STOP-1;r3.count=r3.bossHp;for(let i=0;i<2000&&!r3.over;i++)r3.update(.05);
 ok(r3.phase==='won'&&r3.result.score===0,'last pig lands the final blow');
}
console.log('test-gate: '+checks+' checks passed');
