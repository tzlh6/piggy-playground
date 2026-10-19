/* 猪猪闯算门 rules regression (4.6.1 question generator).
 * Every generated constant is recomputed from its structure with independent numerics
 * (Simpson integrals, central differences, limits at nearby points, explicit sums),
 * pure arithmetic / power gates are re-evaluated from the text shown to the player,
 * every n-gate is checked against an independent formula and for monotonicity,
 * and every level is winnable on the best route and frame-rate independent. */
const assert=require('node:assert/strict');
const G=require('./app/gate-core.js');
let checks=0;function ok(v,message){assert.ok(v,message);checks++}
let seed=90210;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const near=(a,b,eps)=>Math.abs(a-b)<=(eps||1e-6)*Math.max(1,Math.abs(b));
function simpson(f,a,b){const n=4000,h=(b-a)/n;let s=f(a)+f(b);for(let i=1;i<n;i++)s+=f(a+i*h)*(i%2?4:2);return s*h/3}
// 1/x 到 e^8：按几何分段做 Simpson，避免均匀网格在 x 接近 1 处失准。
function simpsonGeo(f,a,b){const k=400,r=Math.pow(b/a,1/k);let s=0,x=a;for(let i=0;i<k;i++){const y=i===k-1?b:x*r,h=(y-x)/2;s+=h/3*(f(x)+4*f(x+h)+f(y));x=y}return s}
const dd=(f,x)=>(f(x+1e-5)-f(x-1e-5))/2e-5;
const d2=(f,x)=>(f(x+1e-3)-2*f(x)+f(x-1e-3))/1e-6;
const poly=c=>x=>c.reduce((s,k,e)=>s+(k||0)*x**e,0);
const pascal=(m,k)=>{let row=[1];for(let i=0;i<m;i++){const nx=[1];for(let j=1;j<row.length;j++)nx.push(row[j-1]+row[j]);nx.push(1);row=nx}return row[k]};
const fact=m=>m<=1?1:m*fact(m-1);
const sum=(a,b,f)=>{let s=0;for(let i=a;i<=b;i++)s+=f(i);return s};
const EVAL={
 'p:sq':p=>p.a*p.a,'p:pow':p=>Math.pow(p.b,p.e),'p:sqrt':p=>Math.sqrt(p.a),'p:cbrt':p=>Math.pow(p.a,1/p.n),'p:root4':p=>Math.pow(p.a,1/p.n),
 'p:fpow':p=>Math.pow(p.b,p.p/p.q),'p:negpow':p=>Math.pow(1/p.b,-p.e),'p:sqrtmul':p=>Math.sqrt(p.a)*Math.sqrt(p.b),'p:sqrtdiv':p=>Math.sqrt(p.a)/Math.sqrt(p.b),
 'p:pyth':p=>Math.hypot(p.a,p.b),'p:dsq':p=>p.a**2-p.b**2,'p:explaw':p=>Math.pow(p.b,p.m)/Math.pow(p.b,p.k),'p:nested':p=>Math.sqrt(Math.sqrt(p.a)),'p:negsq':p=>(-p.a)**2,
 'c:intlin':p=>simpson(poly(p.c),p.a,p.b),'c:intquad':p=>simpson(poly(p.c),p.a,p.b),'c:intcubic':p=>simpson(poly(p.c),p.a,p.b),
 'c:intsin':p=>simpson(x=>p.c*Math.sin(x),0,Math.PI),'c:intcos':p=>simpson(x=>p.c*Math.cos(x),0,Math.PI/2),'c:intinv':p=>simpsonGeo(x=>p.c/x,1,Math.exp(p.k)),
 'c:intexp':p=>simpson(Math.exp,0,Math.log(p.m)),'c:intodd':p=>simpson(x=>x**3+p.b*x+p.k,-p.a,p.a),'c:intabs':p=>simpson(x=>Math.abs(x-p.r),0,2*p.r),
 'c:dpoly':p=>dd(poly(p.c),p.a),'c:d2nd':p=>d2(x=>p.c*x**p.m,p.a),'c:dexp':p=>dd(x=>Math.exp(p.k*x),0),'c:dln':p=>dd(x=>p.c*Math.log(x),1/p.m),
 'c:dsin':p=>dd(x=>Math.sin(p.k*x),0),'c:dsqrt':p=>dd(x=>p.c*Math.sqrt(x),1),'c:dinv':p=>dd(x=>-p.k/x,1),
 'c:limsin':p=>{const x=1e-7;return Math.sin(p.k*x)/(p.m*x)},'c:limtan':p=>{const x=1e-7;return Math.tan(p.k*x)/x},'c:limexp':p=>{const x=1e-7;return (Math.exp(p.k*x)-1)/x},
 'c:limln':p=>{const x=1e-7;return Math.log(1+p.k*x)/x},'c:limcos':p=>{const x=1e-3;return (1-Math.cos(p.k*x))/(x*x)},'c:limq2':p=>{const x=p.a+1e-7;return (x*x-p.a*p.a)/(x-p.a)},
 'c:limq3':p=>{const x=p.a+1e-7;return (x**3-p.a**3)/(x-p.a)},'c:liminf':p=>{const x=1e7;return (p.p*x*x+p.q*x)/(p.r*x*x-p.s)},'c:limroot':p=>{const x=1e9;return p.k*x/(Math.sqrt(x*x+p.k*x)+x)},
 'c:limxsin':p=>{const x=1e7;return x*Math.sin(p.k/x)},'c:sumodd':p=>sum(1,p.m,i=>2*i-1),'c:sumsq':p=>sum(1,p.m,i=>i*i),'c:sumcube':p=>sum(1,p.m,i=>i**3),
 'c:sumgeo':p=>sum(0,p.m,i=>2**i),'c:sumbin':p=>sum(0,p.m,k=>pascal(p.m,k)),'c:sumarith':p=>sum(1,p.m,i=>p.p*i+p.q),'c:comb':p=>pascal(p.m,p.k),
 'c:perm':p=>fact(p.m)/fact(p.m-p.k),'c:fact':p=>p.k===p.m?fact(p.m):fact(p.m)/fact(p.m-p.k),'c:log':p=>Math.log(p.b**p.k)/Math.log(p.b),
 'c:logsum':p=>Math.log2(2**p.i)+Math.log2(2**p.j),'c:logroot':p=>Math.log(p.b**p.k)/Math.log(Math.sqrt(p.b)),'c:lne':p=>Math.log(Math.exp(p.k)),'c:eln':p=>Math.exp(Math.log(p.k)),
 'c:cabs':p=>Math.hypot(p.a,p.b),'c:cconj':p=>{const re=p.a*p.a+p.b*p.b,im=-p.a*p.b+p.b*p.a;return im===0?re:NaN}
};
function evalSpec(s){
 if(s.num!==undefined)return s.num;
 if(s.form){ok(EVAL[s.form],'evaluator for '+s.form);return EVAL[s.form](s.p)}
 const a=evalSpec(s.a);
 switch(s.op){case '+':return a+evalSpec(s.b);case '-':return a-evalSpec(s.b);case '*':return a*evalSpec(s.b);case '/':return a/evalSpec(s.b);case '^':return a**evalSpec(s.b);case 'sqrt':return Math.sqrt(a)}
 throw new Error('spec '+JSON.stringify(s));
}
const hasCalc=s=>!!(s&&(s.form&&s.form.startsWith('c:')||hasCalc(s.a)||hasCalc(s.b)));
const SUP={'⁰':0,'¹':1,'²':2,'³':3,'⁴':4,'⁵':5,'⁶':6,'⁷':7,'⁸':8,'⁹':9};
// Re-evaluate exactly what the gate shows (arithmetic, %, fractions, powers, roots).
function evalText(t){
 let js=t.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/(\d+)%/g,'($1/100)')
  .replace(/∜\(/g,'R4(').replace(/∛\(/g,'Math.cbrt(').replace(/√\(/g,'Math.sqrt(')
  .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,m=>'**'+[...m].map(c=>SUP[c]).join('')).replace(/\^\(/g,'**(');
 ok(/^[\d+\-*/().\sMathsqrcbR]*$/.test(js),'only arithmetic in "'+t+'" -> '+js);
 return Function('R4','"use strict";return ('+js+')')(x=>Math.sqrt(Math.sqrt(x)));
}

// 1. Every form, many values: independent value equals the target.
const seen=new Set();
for(const [pre,list] of [['p:',G.POW_FORMS],['c:',G.CALC_FORMS]])for(const f of list)for(let v=1;v<=700;v++)for(let t=0;t<2;t++){
 const h=f.gen(v,rng);if(!h)continue;seen.add(pre+f.id);
 ok(near(EVAL[pre+f.id](h.p),v,2e-4),pre+f.id+' '+JSON.stringify(h.p)+' = '+v+' got '+EVAL[pre+f.id](h.p));
 ok(G.plain(h.nodes).length>0,'printable '+f.id);
}
ok(seen.size===Object.keys(EVAL).length,'every form exercised: missing '+Object.keys(EVAL).filter(k=>!seen.has(k)).join(','));

// 2. Random expression trees for every level: structure value, and (when no calculus) the shown text.
let texts=0;const shapes={};
for(const L of ['easy','normal','hard','mix'])for(let i=0;i<1500;i++){
 G.reset();const v=1+Math.floor(rng()*300),x=G.buildConst(v,L,rng,1+(i%4));
 ok(near(evalSpec(x.spec),v,2e-4),L+' tree '+G.plain(x.nodes)+' should be '+v);
 if(!hasCalc(x.spec)){ok(near(evalText(G.plain(x.nodes)),v,1e-6),L+' text '+G.plain(x.nodes)+' should read as '+v);texts++}
 shapes[L]=shapes[L]||new Set();shapes[L].add(G.plain(x.nodes).replace(/\d+/g,'#'));
}
ok(texts>2500,'enough text checks '+texts);
for(const L of ['easy','normal','hard','mix'])ok(shapes[L].size>300,L+' produces many different shapes: '+shapes[L].size);

// 3. n-gates: independent formula, integer, capped, monotone.
const NEVAL={aff:(n,p)=>p.a*n+p.b,affdiv:(n,p)=>(n+p.b)/p.a,scale:(n,p)=>n*p.p/p.q,addpart:(n,p)=>n+Math.floor(n/p.a),subpart:(n,p)=>n-Math.floor(n/p.a),halfadd:(n,p)=>Math.floor(n/p.a)+p.b,
 sqdiv:(n,p)=>n*n/p.a,ksqrt:(n,p)=>p.a*Math.sqrt(n),sqrtk:(n,p)=>Math.sqrt(p.k*p.k*n*n),rootadd:(n,p)=>Math.sqrt(n*n+p.a),sqplus:(n,p)=>n+2*p.a*Math.sqrt(n)+p.a*p.a,pow32:(n,p)=>n*Math.sqrt(n)/p.a,sqrtn:n=>Math.sqrt(n),
 dsq:(n,p)=>dd(x=>x*x+p.b*x,n),intn:(n,p)=>simpson(x=>2*x+p.b,0,n),intx:n=>simpson(x=>x,0,n),limn:n=>{const x=n+1e-6;return (x*x-n*n)/(x-n)},logn:(n,p)=>n*Math.log2(2**p.k),
 sumn:(n,p)=>sum(1,p.k,()=>n),intspan:(n,p)=>simpson(()=>1,n,(p.k+1)*n),dcube:n=>n?dd(x=>x**3,n)/n:0,lnadd:(n,p)=>n+p.b,logfloor:n=>n>0?Math.log2(n):0,comb2:n=>n<2?0:pascal(Math.min(n,60),2)*(n>60?n*(n-1)/2/pascal(60,2):1),same:n=>n};
const nseen=new Set();
for(const L of ['easy','normal','hard','mix'])for(const o of G.NOPS){
 if(!o.lv.includes({easy:'e',normal:'m',hard:'h',mix:'x'}[L]))continue;
 for(let t=0;t<25;t++){
  const E=2+Math.floor(rng()*(t<5?30:300)),tgt=t<5?[E*E/2,3*E,E*(E-1)/2,E,2*E][t]:E*(0.4+rng()*1.8);G.reset();
  const op=(()=>{const r=o.make(E,tgt,rng);return r&&{r}})();if(!op)continue;nseen.add(o.id);
  const g={apply:n=>{const v=op.r.f(n);return Number.isFinite(v)?Math.max(0,Math.min(999,Math.floor(v+1e-9))):0}};
  let prev=-1;
  for(let n=0;n<=999;n+=(n<60?1:7)){
   const want=NEVAL[o.id](n,op.r.p),w=Math.max(0,Math.min(999,Math.abs(want-Math.round(want))<1e-4?Math.round(want):Math.floor(want))),got=g.apply(n);
   ok(got===w,o.id+' '+JSON.stringify(op.r.p)+' at n='+n+': '+got+' vs '+w);ok(got>=prev,'monotone '+o.id);prev=got;
  }
 }
}
ok(nseen.size===G.NOPS.length,'every n-gate exercised: missing '+G.NOPS.map(o=>o.id).filter(i=>!nseen.has(i)).join(','));

// 4. Levels: values agree with the structure, best route wins, worst loses, frame-rate independent.
function play(level,stage,pick,dt){
 seed=stage*7919+level.length*31;const r=new G.Run(level,rng,stage);r.start();let guard=0;
 while(!r.over&&guard++<300000){const row=r.rows.slice(r.next).find(x=>x.type==='gate');if(row){const side=pick(row,r);r.x=r.targetX=side==='left'?-.8:.8}r.update(typeof dt==='function'?dt():dt)}
 return r;
}
const best=row=>row.best,worst=(row,r)=>row.left.apply(r.count)<=row.right.apply(r.count)?'left':'right';
for(const level of ['easy','normal','hard','mix'])for(let stage=1;stage<=6;stage++){
 const a=play(level,stage,best,.05);
 ok(a.phase==='won','best route wins '+level+' stage '+stage);ok(a.result.score===a.L.optimal-a.bossMax,'score = optimal - hp');
 const b=play(level,stage,best,()=>.004+rng()*.09);ok(b.phase===a.phase&&b.result.score===a.result.score,'frame-rate independent '+level+stage);
 const w=play(level,stage,worst,.05);if(w.L.bossHp>w.L.worst)ok(w.phase==='lost','worst route loses '+level+stage);
}
const modes={},formUse={};
for(const level of ['easy','normal','hard','mix'])for(let i=0;i<250;i++){
 const L=G.makeLevel(level,rng,1+(i%5),i%2?L0ids(level):[]);
 ok(L.optimal>=L.bossHp&&L.bossHp>=1,'reachable');
 let n=G.LEVELS[level].start;
 for(const row of L.rows){
  if(row.type!=='gate'){ok(row.n>=3,'enemy size');n=Math.max(0,n-row.n);continue}
  const l=row.left.apply(n),r=row.right.apply(n);ok(l!==r,'pair differs');ok(row.best===(l>=r?'left':'right'),'best flag');ok(row.left.id!==row.right.id,'two different kinds of gate');
  for(const op of [row.left,row.right]){
   if(op.spec){ok(near(evalSpec(op.spec),op.k,2e-4),'gate constant '+op.text);if(!hasCalc(op.spec))ok(near(evalText(G.plain(op.nodes).slice(1)),op.k,1e-6),'gate text '+op.text);
    if(level==='hard')for(const id of L.ids)if(id.startsWith('c:')&&!/^c:(add|sub|mul|div)$/.test(id))formUse[id]=1}
  }
  modes[row.mode]=(modes[row.mode]||0)+1;n=Math.max(l,r);
 }
 ok(n===L.optimal,'optimal recomputed');
}
function L0ids(level){return G.makeLevel(level,rng,1).ids}
ok(modes.close>modes.bad&&modes.split>0&&modes.bad>0,'all three gate situations occur '+JSON.stringify(modes));
ok(Object.keys(formUse).length>=30,'hard levels use many calculus forms: '+Object.keys(formUse).length);
// Recent history steers away from forms just seen.
{let fresh=0,tot=0;for(let i=0;i<60;i++){const a=G.makeLevel('hard',rng,1),b=G.makeLevel('hard',rng,1,a.ids);const A=new Set(a.ids.filter(x=>x.startsWith('c:')&&x.length>6)),Bs=b.ids.filter(x=>x.startsWith('c:')&&x.length>6);tot+=Bs.length;fresh+=Bs.filter(x=>!A.has(x)).length}
 ok(fresh/tot>.6,'next level mostly uses forms not in the previous one: '+(fresh/tot).toFixed(2))}
// Lifecycle.
{seed=4;const r=new G.Run('easy',rng,1);ok(r.phase==='ready','ready');r.update(1);ok(r.z===0,'no motion before start');r.start();ok(r.phase==='run','run');
 r.count=160;r.steer(99);ok(r.targetX===G.steerLimit(160),'clamp');
 const e=r.rows.find(x=>x.type==='enemy');r.next=r.rows.indexOf(e);r.z=e.z-2;r.count=e.n+5;let ev=[];for(let i=0;i<400&&!ev.some(x=>x.type==='cleared')&&!r.over;i++)ev=ev.concat(r.update(.05));
 ok(ev.some(x=>x.type==='clash')&&r.count===5,'enemy trade 1:1');
 const r3=new G.Run('mix',rng,1);r3.start();r3.next=r3.rows.length;r3.z=r3.bossZ-G.BOSS_STOP-1;r3.count=r3.bossHp;for(let i=0;i<2000&&!r3.over;i++)r3.update(.05);
 ok(r3.phase==='won'&&r3.result.score===0,'last pig lands the final blow');}
console.log('test-gate: '+checks+' checks passed');
