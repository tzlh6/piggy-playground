/* 猪猪闯算门：独立规则，不依赖渲染或时钟。
 * 跑道左右两扇门，队伍领头走哪边就算哪扇门；途中有野猪拦路，终点按剩余猪猪数挑战巨大猪王。
 * 门的“加 / 乘”结算与按队伍半径收窄左右边界的思路参考 5ubh4d45/CountMasters_Prototype
 * （commit da97ed904ee97b186305c51cf32bed94f4828bd8，Copyright (c) 2022 Subha Das，MIT；
 * 见 assets/licenses/5ubh4d45_CountMasters_Prototype-MIT.txt）。本文件为重新实现，
 * 并扩展了减、除、平方、开方与微积分门。4.6.1 起门上的式子由“先定答案、再随机拆分”的表达式树生成。
 * 所有门的运算都是单调不减的，所以“每扇门都选结果更大的”就是全局最优路线，
 * 关卡用它来设定猪王血量，保证每一关都有解。
 */
(function(root){
'use strict';
const MAX_COUNT=999,ROAD=3.4,MAX_VISIBLE=160;
const LEVELS={
 easy:{name:'加减乘除',gates:8,speed:9.5,gap:30,hp:.62,start:5,hidden:false},
 normal:{name:'平方开方',gates:8,speed:8.5,gap:32,hp:.62,start:4,hidden:true},
 hard:{name:'微积分',gates:8,speed:7,gap:36,hp:.6,start:4,hidden:true},
 mix:{name:'混合运算',gates:9,speed:7,gap:36,hp:.6,start:4,hidden:true}
};
const FIRST_Z=40,BOSS_GAP=44,BOSS_STOP=7,BOSS_DELAY=1.1;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const cap=n=>clamp(Math.floor(n),0,MAX_COUNT);
// 队伍半径（世界单位）：向日葵阵列，与画面上的摆位一致。
const radius=n=>.27*Math.sqrt(clamp(n,1,MAX_VISIBLE))+.3;
const steerLimit=n=>Math.max(.6,ROAD-radius(n)*.7-.25);

// ---- 公式排版节点 ----
// 字符串；{k:'sup',b,s} 上标；{k:'sub',b,s} 下标；{k:'frac',n,d} 分数；{k:'sqrt',c} 根号；
// {k:'big',sym,lo,hi} 积分 / 求和号带上下限；{k:'lim',u} lim 下方写趋向；{k:'at',c,s} 竖线取值。
const S=v=>String(v);
const sup=(b,s)=>({k:'sup',b:[].concat(b),s:[].concat(s)});
const sub=(b,s)=>({k:'sub',b:[].concat(b),s:[].concat(s)});
const frac=(n,d)=>({k:'frac',n:[].concat(n),d:[].concat(d)});
const sqrt=c=>({k:'sqrt',c:[].concat(c)});
const big=(sym,lo,hi)=>({k:'big',sym,lo:[].concat(lo),hi:[].concat(hi)});
const lim=u=>({k:'lim',u:[].concat(u)});
const at=(c,s)=>({k:'at',c:[].concat(c),s:[].concat(s)});
const SUPS={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','n':'ⁿ'};
function plain(nodes){
 return [].concat(nodes).map(x=>{
  if(typeof x==='string')return x;
  const P=plain;
  switch(x.k){
   case 'sup':{const s=P(x.s);return P(x.b)+([...s].every(c=>SUPS[c])?[...s].map(c=>SUPS[c]).join(''):'^('+s+')')}
   case 'sub':return P(x.b)+'_'+P(x.s);
   case 'ss':return P(x.b)+'_'+P(x.sub)+'^'+P(x.sup);
   // 分数在门上是上下叠放的一整块，文字版也整体加括号：(3/4)、(√32/√8)、((x²+1)/(x−3))。
   case 'frac':{const g=s=>/[+\-−×÷/ ]/.test(s)?'('+s+')':s;return '('+g(P(x.n))+'/'+g(P(x.d))+')'}
   case 'sqrt':return '√('+P(x.c)+')';
   case 'root':return (x.n==='3'?'∛':x.n==='4'?'∜':x.n+'√')+'('+P(x.c)+')';
   case 'big':return x.sym+'['+P(x.lo)+','+P(x.hi)+'] ';
   case 'lim':return 'lim['+P(x.u)+'] ';
   case 'at':return P(x.c)+'|'+P(x.s);
  }
  return '';
 }).join('');
}

// ---- 出题：从答案倒推的随机表达式树 ----
// 每个常数都是先定结果、再随机拆成算式（加、减、乘、除、分数、百分数、乘方、开方、微积分写法），
// 所以算式千变万化、结果一定是整数。spec 记录结构，测试用独立的数值方法逐个复算。
const ATOM=3,MUL=2,ADD=1,BIG=0;
const ri=(rng,a,b)=>a+Math.floor(rng()*(b-a+1));
const pick=(rng,a)=>a[Math.floor(rng()*a.length)];
const isInt=v=>Math.abs(v-Math.round(v))<1e-9;
const sqr=n=>{const r=Math.round(Math.sqrt(n));return r*r===n?r:0};
const gcd=(a,b)=>b?gcd(b,a%b):a;
const TRI=m=>m*(m+1)/2;
const C=(m,k)=>{let r=1;for(let i=1;i<=k;i++)r=r*(m-k+i)/i;return Math.round(r)};
const ss=(b,lo,hi)=>({k:'ss',b:[].concat(b),sub:[].concat(lo),sup:[].concat(hi)});
const nroot=(n,c)=>({k:'root',n:S(n),c:[].concat(c)});
const X=(nodes,v,prec,spec,id)=>({nodes:[].concat(nodes),v,prec,spec,id});
const wrap=(x,need)=>x.prec<need?['(',...x.nodes,')']:x.nodes;
// 多项式 c[0]+c[1]x+c[2]x²+c[3]x³（按降幂写）
function polyNodes(c,v){
 v=v||'x';const out=[];let first=true;
 for(let e=c.length-1;e>=0;e--){const k=c[e]||0;if(!k)continue;const a=Math.abs(k),sign=k<0?'−':first?'':'+';first=false;
  const coef=a===1&&e>0?'':S(a);out.push(sign+coef+(e===1?v:''));if(e>=2)out.push(sup(v,S(e)))}
 return out.length?out:['0'];
}
// 同一关（以及最近几局）里用得越多的写法越不容易再被抽中。
let USED={},IDS=[];
const use=id=>{USED[id]=(USED[id]||0)+1;IDS.push(id)};
function choose(rng,list,idOf){
 const w=list.map(x=>1/(1+5*(USED[idOf(x)]||0)));let r=rng()*w.reduce((a,b)=>a+b,0);
 for(let i=0;i<list.length;i++){r-=w[i];if(r<=0)return list[i]}return list[list.length-1];
}

// 乘方与开方写法（平方开方、混合）。gen(v,rng) → {nodes,p,prec?}，结果恰为 v。
const POW_FORMS=[
 {id:'sq',gen:v=>{const r=sqr(v);return r>=2&&r<=40?{nodes:[sup(S(r),'2')],p:{a:r}}:null}},
 {id:'pow',gen:(v,rng)=>{const c=[];for(const b of [2,3,5,6,7])for(let e=3;e<=10;e++)if(b**e===v)c.push([b,e]);if(!c.length)return null;const [b,e]=pick(rng,c);return {nodes:[sup(S(b),S(e))],p:{b,e}}}},
 {id:'sqrt',gen:v=>v>=2&&v<=40?{nodes:[sqrt(S(v*v))],p:{a:v*v}}:null},
 {id:'cbrt',gen:v=>v>=2&&v<=12?{nodes:[nroot(3,S(v**3))],p:{a:v**3,n:3}}:null},
 {id:'root4',gen:v=>v>=2&&v<=6?{nodes:[nroot(4,S(v**4))],p:{a:v**4,n:4}}:null},
 {id:'fpow',gen:(v,rng)=>{const c=[];for(let r=2;r<=10;r++)for(let q=2;q<=5;q++)for(let p=1;p<=5;p++)if(p!==q&&gcd(p,q)===1&&r**q<=1024&&r**p===v)c.push([r**q,p,q]);if(!c.length)return null;const [b,p,q]=pick(rng,c);return {nodes:[sup(S(b),p+'/'+q)],p:{b,p,q}}}},
 {id:'negpow',gen:(v,rng)=>{const c=[];for(const b of [2,3,4,5,10])for(let e=2;e<=9;e++)if(b**e===v)c.push([b,e]);if(!c.length)return null;const [b,e]=pick(rng,c);return {nodes:[sup(['(',frac('1',S(b)),')'],'−'+e)],p:{b,e}}}},
 {id:'sqrtmul',gen:(v,rng)=>{const c=[];for(let b=2;b<=50;b++){const a=v*v/b;if(isInt(a)&&a>=2&&a<=600&&!sqr(b)&&!sqr(a))c.push([a,b])}if(!c.length)return null;const [a,b]=pick(rng,c);return {nodes:[sqrt(S(a)),'×',sqrt(S(b))],p:{a,b},prec:MUL}}},
 {id:'sqrtdiv',gen:(v,rng)=>{const c=[];for(let b=2;b<=12;b++)if(!sqr(b)&&v*v*b<=900)c.push(b);if(!c.length)return null;const b=pick(rng,c);return {nodes:[frac([sqrt(S(v*v*b))],[sqrt(S(b))])],p:{a:v*v*b,b}}}},
 {id:'pyth',gen:(v,rng)=>{const c=[];for(let a=1;a<v;a++){const b=sqr(v*v-a*a);if(b&&a<b)c.push([a,b])}if(!c.length)return null;const [a,b]=pick(rng,c);return {nodes:[sqrt([sup(S(a),'2'),'+',sup(S(b),'2')])],p:{a,b}}}},
 {id:'dsq',gen:(v,rng)=>{const c=[];for(let d=1;d*d<v;d++)if(v%d===0&&(d+v/d)%2===0){const a=(d+v/d)/2,b=(v/d-d)/2;if(b>=2&&a<=60)c.push([a,b])}if(!c.length)return null;const [a,b]=pick(rng,c);return {nodes:[sup(S(a),'2'),'−',sup(S(b),'2')],p:{a,b},prec:ADD}}},
 {id:'explaw',gen:(v,rng)=>{const c=[];for(const b of [2,3,5])for(let k=1;k<=9;k++)if(b**k===v)c.push([b,k]);if(!c.length)return null;const [b,k]=pick(rng,c),m=k+ri(rng,2,6);return rng()<.5?{nodes:[sup(S(b),S(m)),'÷',sup(S(b),S(m-k))],p:{b,m,k:m-k,op:'/'},prec:MUL}:{nodes:[frac(sup(S(b),S(m)),sup(S(b),S(m-k)))],p:{b,m,k:m-k,op:'/'}}}},
 {id:'nested',gen:v=>v>=2&&v<=9?{nodes:[sqrt([sqrt(S(v**4))])],p:{a:v**4}}:null},
 {id:'negsq',gen:v=>{const r=sqr(v);return r>=2&&r<=20?{nodes:[sup('(−'+r+')','2')],p:{a:r}}:null}}
];
// 微积分（以及对数、组合、复数）写法。结果恰为 v。
const CALC_FORMS=[
 {id:'intlin',gen:(v,rng)=>{for(let t=0;t<12;t++){const a=pick(rng,[0,0,1,2]),b=a+ri(rng,1,5),p=ri(rng,1,6),q=(v-p*(b*b-a*a)/2)/(b-a);if(isInt(q)&&q>=0&&q<=40)return {nodes:[big('∫',S(a),S(b))].concat(q?['(',...polyNodes([q,p]),') dx']:[...polyNodes([0,p]),' dx']),p:{a,b,c:[q,p]}}}return null}},
 {id:'intquad',gen:(v,rng)=>{for(let t=0;t<12;t++){const b=ri(rng,1,5),c2=ri(rng,1,9),c1=(v-c2*b**3/3)/(b*b/2);if(isInt(c1)&&c1>=0&&c1<=30)return {nodes:[big('∫','0',S(b)),'(',...polyNodes([0,c1,c2]),') dx'],p:{a:0,b,c:[0,c1,c2]}}}return null}},
 {id:'intcubic',gen:(v,rng)=>{for(let t=0;t<10;t++){const b=ri(rng,1,4),c3=4*v/b**4;if(isInt(c3)&&c3>=1&&c3<=40)return {nodes:[big('∫','0',S(b)),...polyNodes([0,0,0,c3]),' dx'],p:{a:0,b,c:[0,0,0,c3]}}}return null}},
 {id:'intsin',gen:v=>v%2===0&&v<=60?{nodes:[big('∫','0','π'),(v===2?'':S(v/2))+'sin x dx'],p:{c:v/2}}:null},
 {id:'intcos',gen:v=>v<=40?{nodes:[big('∫','0',frac('π','2')),(v===1?'':S(v))+'cos x dx'],p:{c:v}}:null},
 {id:'intinv',gen:(v,rng)=>v<=8&&rng()<.5?{nodes:[big('∫','1',sup('e',S(v))),frac('1','x'),' dx'],p:{k:v,c:1}}:v<=40?{nodes:[big('∫','1','e'),frac(S(v),'x'),' dx'],p:{k:1,c:v}}:null},
 {id:'intexp',gen:v=>v<=60?{nodes:[big('∫','0','ln '+(v+1)),sup('e','x'),' dx'],p:{m:v+1}}:null},
 {id:'intodd',gen:(v,rng)=>{if(v%2)return null;const c=[];for(let a=1;a<=5;a++)if((v/2)%a===0&&v/2/a<=30)c.push(a);if(!c.length)return null;const a=pick(rng,c),k=v/2/a,b=ri(rng,1,7);return {nodes:[big('∫','−'+a,S(a)),'(',sup('x','3'),'+'+b+'x+'+k+') dx'],p:{a,b,k}}}},
 {id:'intabs',gen:v=>{const r=sqr(v);return r>=1&&r<=12?{nodes:[big('∫','0',S(2*r)),'|x−'+r+'| dx'],p:{r}}:null}},
 {id:'dpoly',gen:(v,rng)=>{for(let t=0;t<12;t++){const a=ri(rng,1,4),p=ri(rng,0,2),q=ri(rng,0,3),r=v-(3*p*a*a+2*q*a);if((p||q)&&r>=0&&r<=60)return {nodes:[at(['(',...polyNodes([0,r,q,p]),')′'],'x='+a)],p:{a,c:[0,r,q,p]}}}return null}},
 {id:'d2nd',gen:(v,rng)=>{const c=[];for(let m=3;m<=10;m++)if(m*(m-1)===v)c.push(['m',m]);for(let a=1;a<=5;a++)for(let k=1;k<=9;k++)if(6*k*a===v)c.push(['c',k,a]);if(!c.length)return null;const h=pick(rng,c);return h[0]==='m'?{nodes:[at(['(',sup('x',S(h[1])),')″'],'x=1')],p:{m:h[1],c:1,a:1}}:{nodes:[at(['(',(h[1]===1?'':S(h[1])),sup('x','3'),')″'],'x='+h[2])],p:{m:3,c:h[1],a:h[2]}}}},
 {id:'dexp',gen:v=>v<=40?{nodes:[at(['(',sup('e',(v===1?'':v)+'x'),')′'],'x=0')],p:{k:v}}:null},
 {id:'dln',gen:(v,rng)=>v<=40?(rng()<.5?{nodes:[at(['(ln x)′'],['x=',frac('1',S(v))])],p:{m:v,c:1}}:{nodes:[at(['('+v+'ln x)′'],'x=1')],p:{m:1,c:v}}):null},
 {id:'dsin',gen:(v,rng)=>v<=40?{nodes:[at(['('+pick(rng,['sin','tan'])+' '+(v===1?'':v)+'x)′'],'x=0')],p:{k:v}}:null},
 {id:'dsqrt',gen:v=>v<=40?{nodes:[at(['('+(2*v),sqrt('x'),')′'],'x=1')],p:{c:2*v}}:null},
 {id:'dinv',gen:v=>v<=60?{nodes:[at(['(−',frac(S(v),'x'),')′'],'x=1')],p:{k:v}}:null},
 {id:'limsin',gen:(v,rng)=>{const m=ri(rng,1,4),k=v*m;return k<=60?{nodes:[lim('x→0'),frac('sin '+k+'x',m===1?'x':m+'x')],p:{k,m}}:null}},
 {id:'limtan',gen:v=>v<=40?{nodes:[lim('x→0'),frac('tan '+v+'x','x')],p:{k:v}}:null},
 {id:'limexp',gen:v=>v<=30?{nodes:[lim('x→0'),frac([sup('e',(v===1?'':v)+'x'),'−1'],'x')],p:{k:v}}:null},
 {id:'limln',gen:v=>v<=30?{nodes:[lim('x→0'),frac('ln(1+'+(v===1?'':v)+'x)','x')],p:{k:v}}:null},
 {id:'limcos',gen:v=>{const j=Math.sqrt(v/2);return isInt(j)&&j>=1&&j<=8?{nodes:[lim('x→0'),frac('1−cos '+2*j+'x',sup('x','2'))],p:{k:2*j}}:null}},
 {id:'limq2',gen:v=>v%2===0&&v/2<=40?{nodes:[lim('x→'+v/2),frac([sup('x','2'),'−'+(v/2)**2],'x−'+v/2)],p:{a:v/2}}:null},
 {id:'limq3',gen:v=>{const a=Math.sqrt(v/3);return isInt(a)&&a>=1&&a<=6?{nodes:[lim('x→'+a),frac([sup('x','3'),'−'+a**3],'x−'+a)],p:{a}}:null}},
 {id:'liminf',gen:(v,rng)=>{const r=ri(rng,1,4),p=v*r;if(p>60)return null;const q=ri(rng,1,9),s=ri(rng,1,9);return {nodes:[lim('x→∞'),frac([S(p),sup('x','2'),'+'+q+'x'],[(r===1?'':S(r)),sup('x','2'),'−'+s])],p:{p,q,r,s}}}},
 {id:'limroot',gen:v=>v<=30?{nodes:[lim('x→∞'),'(',sqrt([sup('x','2'),'+'+2*v+'x']),'−x)'],p:{k:2*v}}:null},
 {id:'limxsin',gen:v=>v<=40?{nodes:[lim('x→∞'),'x·sin',frac(S(v),'x')],p:{k:v}}:null},
 {id:'sumodd',gen:v=>{const r=sqr(v);return r>=2&&r<=20?{nodes:[big('Σ','i=1',S(r)),'(2i−1)'],p:{m:r}}:null}},
 {id:'sumsq',gen:v=>{for(let m=2;m<=12;m++)if(m*(m+1)*(2*m+1)/6===v)return {nodes:[big('Σ','i=1',S(m)),sup('i','2')],p:{m}};return null}},
 {id:'sumcube',gen:v=>{for(let m=2;m<=8;m++)if(TRI(m)**2===v)return {nodes:[big('Σ','i=1',S(m)),sup('i','3')],p:{m}};return null}},
 {id:'sumgeo',gen:v=>{for(let m=2;m<=8;m++)if(2**(m+1)-1===v)return {nodes:[big('Σ','i=0',S(m)),sup('2','i')],p:{m}};return null}},
 {id:'sumbin',gen:v=>{for(let m=2;m<=9;m++)if(2**m===v)return {nodes:[big('Σ','k=0',S(m)),ss('C',S(m),'k')],p:{m}};return null}},
 {id:'sumarith',gen:(v,rng)=>{for(let t=0;t<10;t++){const m=ri(rng,3,8),p=ri(rng,1,4),q=(v-p*TRI(m))/m;if(isInt(q)&&q>=0&&q<=20)return {nodes:[big('Σ','i=1',S(m)),'('+(p>1?p:'')+'i'+(q?'+'+q:'')+')'],p:{m,p,q}}}return null}},
 {id:'comb',gen:(v,rng)=>{const c=[];for(let m=4;m<=16;m++)for(let k=2;k<=m/2;k++)if(C(m,k)===v)c.push([m,k]);if(!c.length)return null;const [m,k]=pick(rng,c);return {nodes:[ss('C',S(m),S(k))],p:{m,k}}}},
 {id:'perm',gen:(v,rng)=>{const c=[];for(let m=3;m<=12;m++)for(let k=2;k<=3;k++)if(fact(m)/fact(m-k)===v)c.push([m,k]);if(!c.length)return null;const [m,k]=pick(rng,c);return {nodes:[ss('A',S(m),S(k))],p:{m,k}}}},
 {id:'fact',gen:(v,rng)=>{const f={2:2,6:3,24:4,120:5,720:6}[v];if(f&&rng()<.6)return {nodes:[f+'!'],p:{m:f,k:f}};for(let m=3;m<=12;m++)if(m*(m-1)===v)return {nodes:[frac(m+'!',(m-2)+'!')],p:{m,k:2}};return null}},
 {id:'log',gen:(v,rng)=>{const c=[];for(const b of [2,3,4,5,8,9,10])if(b**v<=100000)c.push(b);if(!c.length)return null;const b=pick(rng,c);return {nodes:b===10?['lg '+10**v]:[sub('log',S(b)),' '+b**v],p:{b,k:v}}}},
 {id:'logsum',gen:(v,rng)=>{if(v<3||v>14)return null;const i=ri(rng,1,v-1);return {nodes:[sub('log','2'),' '+2**i,'+',sub('log','2'),' '+2**(v-i)],p:{i,j:v-i},prec:ADD}}},
 {id:'logroot',gen:(v,rng)=>{if(v%2||v>16)return null;const b=pick(rng,[2,3,5]);if(b**(v/2)>100000)return null;return {nodes:[sub('log',sqrt(S(b))),' '+b**(v/2)],p:{b,k:v/2}}}},
 {id:'lne',gen:v=>v<=60?{nodes:['ln ',sup('e',S(v))],p:{k:v}}:null},
 {id:'eln',gen:v=>v<=99?{nodes:[sup('e','ln '+v)],p:{k:v}}:null},
 {id:'cabs',mixOnly:true,gen:(v,rng)=>{const c=[];for(let a=1;a<v;a++){const b=sqr(v*v-a*a);if(b)c.push([a,b])}if(!c.length)return null;const [a,b]=pick(rng,c);return {nodes:['|'+a+'+'+b+'i|'],p:{a,b}}}},
 {id:'cconj',mixOnly:true,gen:(v,rng)=>{const c=[];for(let a=1;a*a<v;a++){const b=sqr(v-a*a);if(b)c.push([a,b])}if(!c.length)return null;const [a,b]=pick(rng,c);return {nodes:['('+a+'+'+b+'i)('+a+'−'+b+'i)'],p:{a,b},prec:MUL}}}
];
function fact(m){return m<=1?1:m*fact(m-1)}
const FORM_BY={};for(const f of POW_FORMS)FORM_BY['p:'+f.id]=f;for(const f of CALC_FORMS)FORM_BY['c:'+f.id]=f;

// 叶子：把一个数写成数字本身，或（按难度）乘方开方 / 微积分写法。
function leaf(v,L,rng){
 const want=L==='easy'?'num':L==='normal'?(rng()<.75?'p':'num'):L==='hard'?(rng()<.9?'c':rng()<.5?'p':'num'):(rng()<.45?'c':rng()<.6?'p':'num');
 if(want!=='num'){
  const pool=want==='c'?CALC_FORMS:POW_FORMS,pre=want+':';
  const hits=[];for(const f of pool){if(f.mixOnly&&L!=='mix')continue;const h=f.gen(v,rng);if(h)hits.push({f,h})}
  if(hits.length){const o=choose(rng,hits,x=>pre+x.f.id);use(pre+o.f.id);
   return X(o.h.nodes,v,o.h.prec!==undefined?o.h.prec:want==='c'?BIG:ATOM,{form:pre+o.f.id,p:o.h.p},pre+o.f.id)}
 }
 return X([S(v)],v,ATOM,{num:v},'num');
}
// 把 v 随机拆成算式；budget 是还能用的运算次数。
const OPS={easy:['+','−','×','÷','÷','frac','pct'],normal:['+','−','×','÷','^2','√'],hard:['+','−','×','+'],mix:['+','−','×','÷','frac','pct','^2','√']};
const LIMIT={easy:999,normal:999,hard:400,mix:999};
function expand(v,budget,L,rng){
 if(budget<=0||v<1)return leaf(v,L,rng);
 for(let t=0;t<8;t++){
  const op=choose(rng,OPS[L],o=>'ar:'+o),lb=ri(rng,0,budget-1),rb=budget-1-lb,lim=LIMIT[L];
  if(op==='+'&&v>=4){const x=ri(rng,Math.max(1,Math.ceil(v*.15)),Math.max(1,Math.floor(v*.85))),A=expand(x,lb,L,rng),B=expand(v-x,rb,L,rng);use('ar:+');
   return X([...wrap(A,ADD),'+',...wrap(B,ADD)],v,ADD,{op:'+',a:A.spec,b:B.spec})}
  if(op==='−'){const y=ri(rng,2,Math.max(3,Math.min(L==='easy'?99:60,v+20)));if(v+y>lim)continue;const A=expand(v+y,lb,L,rng),B=expand(y,rb,L,rng);use('ar:−');
   return X([...wrap(A,ADD),'−',...wrap(B,MUL)],v,ADD,{op:'-',a:A.spec,b:B.spec})}
  if(op==='×'){const ds=[];for(let d=2;d*d<=v;d++)if(v%d===0)ds.push(d);if(!ds.length)continue;let d=pick(rng,ds),e=v/d;if(rng()<.5)[d,e]=[e,d];const A=expand(d,lb,L,rng),B=expand(e,rb,L,rng);use('ar:×');
   return X([...wrap(A,MUL),'×',...wrap(B,MUL)],v,MUL,{op:'*',a:A.spec,b:B.spec})}
  if(op==='÷'){const y=ri(rng,2,L==='easy'?12:9);if(v*y>lim)continue;const A=expand(v*y,lb,L,rng),B=expand(y,rb,L,rng);use('ar:÷');
   return X([...wrap(A,MUL),'÷',...wrap(B,ATOM)],v,MUL,{op:'/',a:A.spec,b:B.spec})}
  if(op==='frac'){const q=ri(rng,2,9),p=ri(rng,1,q+4);if(gcd(p,q)!==1||p===q)continue;const b=v*q/p;if(!isInt(b)||b>lim||b<2)continue;const B=expand(b,budget-1,L,rng);use('ar:frac');
   return X([frac(S(p),S(q)),'×',...wrap(B,MUL)],v,MUL,{op:'*',a:{op:'/',a:{num:p},b:{num:q}},b:B.spec})}
  if(op==='pct'){const p=pick(rng,[10,20,25,30,40,50,60,75,120,125,150,200]),b=v*100/p;if(!isInt(b)||b>lim||b<2)continue;const B=expand(b,budget-1,L,rng);use('ar:pct');
   return X([...wrap(B,MUL),'×'+p+'%'],v,MUL,{op:'*',a:B.spec,b:{num:p/100}})}
  if(op==='^2'){const r=sqr(v);if(!r||r<2||r>40)continue;const A=expand(r,budget-1,L,rng);use('ar:^2');
   // 底数不是单纯数字就加括号：(16^(1/4))²、(√49)²，避免看成指数叠指数。
   return X([sup(A.spec.num!==undefined?A.nodes:['(',...A.nodes,')'],'2')],v,ATOM,{op:'^',a:A.spec,b:{num:2}})}
  if(op==='√'){if(v>30)continue;const A=expand(v*v,budget-1,L,rng);use('ar:√');
   return X([sqrt(A.nodes)],v,ATOM,{op:'sqrt',a:A.spec})}
 }
 return leaf(v,L,rng);
}
// 每档的式子必须带上本档的“招牌”：加减乘除要有乘除（或分数、百分数），平方开方要有乘方或根号，
// 微积分要有微积分写法，混合要有乘方开方或微积分；只有加减的式子太容易，会重新拆。
const anyIn=(s,f)=>!!s&&(f(s)||anyIn(s.a,f)||anyIn(s.b,f));
function flavour(s,L){
 const md=anyIn(s,x=>x.op==='*'||x.op==='/'),pw=anyIn(s,x=>x.op==='^'||x.op==='sqrt'||(x.form||'').startsWith('p:')),ca=anyIn(s,x=>(x.form||'').startsWith('c:'));
 return L==='easy'?md:L==='normal'?pw:L==='hard'?ca:(pw||ca);
}
// 门上常数的最终写法：按难度给运算次数，过长就换一种拆法。
const MAXLEN={easy:20,normal:22,hard:30,mix:30};
function buildConst(k,L,rng,stage){
 const extra=stage>=3?1:0;
 const base={easy:[2,3],normal:[1,2],hard:[0,1],mix:[1,2]}[L]||[1,2];
 let best=null;
 for(let t=0;t<30;t++){
  const keep={USED:{...USED},n:IDS.length};
  const b=Math.max(0,ri(rng,base[0],base[1])+extra-(t>=15?1:0)-(t>=25?1:0));
  const x=expand(k,b,L,rng),len=plain(x.nodes).length;
  if(len<=MAXLEN[L]&&(t>=24||flavour(x.spec,L)))return x;
  USED=keep.USED;IDS.length=keep.n;if(!best||len<plain(best.nodes).length)best=x;
 }
 return best;
}

// ---- 作用在 n 上的门：都单调不减（猪猪多，结果不会更少）----
// make(E,t,rng)：尽量让当前最优猪数 E 经过这扇门后接近目标 t。f 不含取整与封顶，apply 统一处理。
const NOPS=[
 {id:'aff',lv:'emx',make:(E,t,rng)=>{const a=ri(rng,2,3),b=Math.round(t-a*E);return b&&Math.abs(b)<=60?{p:{a,b},f:n=>a*n+b,nodes:['n→'+a+'n'+(b>0?'+':'−')+Math.abs(b)],reveal:'n 变成 '+a+'n'+(b>0?'+':'−')+Math.abs(b)}:null}},
 {id:'affdiv',lv:'emx',make:(E,t,rng)=>{const a=ri(rng,2,4),b=Math.round(t*a-E);return b>=2&&b<=150?{p:{a,b},f:n=>(n+b)/a,nodes:['n→(n+'+b+')÷'+a],reveal:'先加 '+b+' 再除以 '+a+'，向下取整'}:null}},
 {id:'scale',lv:'emx',make:(E,t,rng)=>{const c=[[3,2],[4,3],[5,4],[2,3],[3,4],[5,3],[7,4],[5,2],[7,5],[4,5],[6,5],[9,4]].filter(([p,q])=>Math.abs(E*p/q-t)<t*.2+2);if(!c.length)return null;const [p,q]=pick(rng,c);return {p:{p,q},f:n=>n*p/q,nodes:rng()<.5?['n→n×'+p+'÷'+q]:['n→',frac(S(p),S(q)),'n'],reveal:'乘 '+p+'/'+q+'，向下取整'}}},
 {id:'addpart',lv:'emx',make:(E,t)=>{if(t<=E)return null;const a=Math.round(E/(t-E));return a>=2&&a<=9?{p:{a},f:n=>n+Math.floor(n/a),nodes:['n→n+n÷'+a],reveal:'n 加上 n÷'+a+'（取整）'}:null}},
 {id:'subpart',lv:'emx',make:(E,t)=>{if(t>=E)return null;const a=Math.round(E/(E-t));return a>=2&&a<=9?{p:{a},f:n=>n-Math.floor(n/a),nodes:['n→n−n÷'+a],reveal:'n 减去 n÷'+a+'（取整）'}:null}},
 {id:'halfadd',lv:'emx',make:(E,t,rng)=>{const a=ri(rng,2,4),b=Math.round(t-E/a);return b>=1&&b<=200?{p:{a,b},f:n=>Math.floor(n/a)+b,nodes:['n→n÷'+a+'+'+b],reveal:'n÷'+a+' 取整后加 '+b}:null}},
 {id:'sqdiv',lv:'mx',make:(E,t)=>{const a=Math.round(E*E/t);return a>=2&&a<=400?{p:{a},f:n=>n*n/a,nodes:['n→',sup('n','2'),'÷'+a],reveal:'n² 除以 '+a+'，向下取整'}:null}},
 {id:'ksqrt',lv:'mx',make:(E,t)=>{const a=Math.round(t/Math.sqrt(E));return a>=2&&a<=40?{p:{a},f:n=>a*Math.sqrt(n),nodes:['n→'+a,sqrt('n')],reveal:a+'√n，向下取整'}:null}},
 {id:'sqrtk',lv:'mx',make:(E,t)=>{const k=Math.round(t/E);return k>=2&&k<=5?{p:{k},f:n=>k*n,nodes:['n→',sqrt([S(k*k),sup('n','2')])],reveal:'√('+k*k+'n²) = '+k+'n'}:null}},
 {id:'rootadd',lv:'mx',make:(E,t,rng)=>{const a=ri(rng,2,9)*ri(rng,5,30);return {p:{a},f:n=>Math.sqrt(n*n+a),nodes:['n→',sqrt([sup('n','2'),'+'+a])],reveal:'√(n²+'+a+') 只比 n 大一点点'}}},
 {id:'sqplus',lv:'mx',make:(E,t)=>{const a=Math.round(Math.sqrt(t)-Math.sqrt(E));return a>=1&&a<=9?{p:{a},f:n=>(Math.sqrt(n)+a)**2,nodes:['n→',sup(['(',sqrt('n'),'+'+a+')'],'2')],reveal:'(√n+'+a+')² = n+'+2*a+'√n+'+a*a+'，向下取整'}:null}},
 {id:'pow32',lv:'mx',make:(E,t)=>{const a=Math.round(E**1.5/t);return a>=2&&a<=300?{p:{a},f:n=>n**1.5/a,nodes:['n→',sup('n','3/2'),'÷'+a],reveal:'n√n 除以 '+a+'，向下取整'}:null}},
 {id:'sqrtn',lv:'mx',make:(E,t)=>t<E?{p:{},f:n=>Math.sqrt(n),nodes:['n→',sqrt('n')],reveal:'开方，向下取整'}:null},
 {id:'dsq',lv:'hx',make:(E,t)=>{const b=Math.round(t-2*E);return b>=-40&&b<=60?{p:{b},f:n=>2*n+b,nodes:['n→',at(['(',...polyNodes([0,b,1]),')′'],'x=n')],reveal:'(x²'+(b?(b>0?'+':'−')+Math.abs(b)+'x':'')+')′ = 2x'+(b?(b>0?'+':'−')+Math.abs(b):'')+'，代入 x=n'}:null}},
 {id:'intn',lv:'hx',make:(E,t)=>{const b=Math.round((t-E*E)/E);return b>=-9&&b<=40?{p:{b},f:n=>n*n+b*n,nodes:['n→',big('∫','0','n'),'(',...polyNodes([b,2]),') dx'],reveal:'原函数 x²'+(b?(b>0?'+':'−')+Math.abs(b)+'x':'')+'，结果 n²'+(b?(b>0?'+':'−')+Math.abs(b)+'n':'')}:null}},
 {id:'intx',lv:'hx',make:(E,t)=>Math.abs(E*E/2-t)<=t*.25+2?{p:{},f:n=>n*n/2,nodes:['n→',big('∫','0','n'),'x dx'],reveal:'∫₀ⁿ x dx = n²/2，向下取整'}:null},
 {id:'limn',lv:'hx',make:(E,t)=>Math.abs(2*E-t)<=t*.25+2?{p:{},f:n=>2*n,nodes:['n→',lim('x→n'),frac([sup('x','2'),'−',sup('n','2')],'x−n')],reveal:'(x²−n²)/(x−n) = x+n → 2n'}:null},
 {id:'logn',lv:'hx',make:(E,t)=>{const k=Math.round(t/E);return k>=2&&k<=4?{p:{k},f:n=>k*n,nodes:['n→',sub('log','2'),' ',sup(S(2**k),'n')],reveal:'log₂ '+2**k+'ⁿ = '+k+'n'}:null}},
 {id:'sumn',lv:'hx',make:(E,t)=>{const k=Math.round(t/E);return k>=2&&k<=6?{p:{k},f:n=>k*n,nodes:['n→',big('Σ','i=1',S(k)),'n'],reveal:k+' 个 n 相加 = '+k+'n'}:null}},
 {id:'intspan',lv:'hx',make:(E,t)=>{const k=Math.round(t/E);return k>=2&&k<=5?{p:{k},f:n=>k*n,nodes:['n→',big('∫','n',(k+1)+'n'),'dx'],reveal:'区间长度 '+(k+1)+'n−n = '+k+'n'}:null}},
 {id:'dcube',lv:'hx',make:(E,t)=>Math.abs(3*E-t)<=t*.25+2?{p:{},f:n=>3*n,nodes:['n→',at(['(',sup('x','3'),')′'],'x=n'),'÷n'],reveal:'3n² ÷ n = 3n'}:null},
 {id:'lnadd',lv:'hx',make:(E,t)=>{const b=Math.round(t-E);return b&&b>=-30&&b<=60?{p:{b},f:n=>n+b,nodes:['n→ln ',sup('e','n'),(b>0?'+':'−')+Math.abs(b)],reveal:'ln eⁿ = n，再'+(b>0?'加 ':'减 ')+Math.abs(b)}:null}},
 {id:'logfloor',lv:'hx',make:(E,t)=>t<E?{p:{},f:n=>n>0?Math.log2(n):0,nodes:['n→',sub('log','2'),' n'],reveal:'log₂ n，向下取整'}:null},
 {id:'comb2',lv:'hx',make:(E,t)=>Math.abs(E*(E-1)/2-t)<=t*.25+2?{p:{},f:n=>n*(n-1)/2,nodes:['n→',ss('C','n','2')],reveal:'Cₙ² = n(n−1)/2'}:null},
 {id:'same',lv:'hx',make:(E,t)=>Math.abs(E-t)<=t*.12+1?{p:{},f:n=>n,nodes:['n→',big('∫','0','n'),'dx'],reveal:'∫₀ⁿ dx = n，原地踏步'}:null}
];
const LVCH={easy:'e',normal:'m',hard:'h',mix:'x'};
const apply=f=>n=>{const v=f(n);return Number.isFinite(v)?cap(v+1e-9):0};

// ---- 门 ----
const SIGN={add:'+',sub:'−',mul:'×',div:'÷'};
const NEED={add:ADD,sub:MUL,mul:MUL,div:ATOM};
function constOp(kind,k,L,rng,stage){
 const c=buildConst(k,L,rng,stage),f={add:n=>n+k,sub:n=>n-k,mul:n=>n*k,div:n=>n/k}[kind];use('c:'+kind);
 const nodes=[SIGN[kind],...wrap(c,NEED[kind])];
 return {kind,id:'c:'+kind,k,value:k,spec:c.spec,nodes,apply:apply(f),text:plain(nodes),reveal:'',revealNodes:c.spec.num!==undefined?null:c.nodes.concat([' = '+k])};
}
function nOp(o,r){use('n:'+o.id);return {kind:'n',id:'n:'+o.id,nid:o.id,p:r.p,nodes:r.nodes,apply:apply(r.f),text:plain(r.nodes),reveal:r.reveal}}
// 造一扇门，让 E 经过后尽量接近 t。
function opFor(t,E,L,rng,stage,avoid){
 t=Math.max(0,Math.round(t));const cs=[];
 if(t>E){cs.push({id:'c:add',mk:()=>constOp('add',t-E,L,rng,stage)});const m=Math.round(t/E);if(m>=2&&m<=4&&Math.abs(m*E-t)<=t*.22)cs.push({id:'c:mul',mk:()=>constOp('mul',m,L,rng,stage)})}
 if(t<E){cs.push({id:'c:sub',mk:()=>constOp('sub',E-t,L,rng,stage)});const m=Math.round(E/t);if(m>=2&&m<=6&&Math.abs(E/m-t)<=t*.25+1)cs.push({id:'c:div',mk:()=>constOp('div',m,L,rng,stage)})}
 for(const o of NOPS){if(!o.lv.includes(LVCH[L]))continue;const r=o.make(E,t,rng);if(!r)continue;const v=apply(r.f)(E);if(Math.abs(v-t)<=t*.2+3)cs.push({id:'n:'+o.id,mk:()=>nOp(o,r)})}
 const ok=cs.filter(c=>c.id!==avoid);if(!ok.length)return null;
 // 先定是“常数算式门”还是“n 门”（算式门约占六成），再在同类里挑用得少的。
 const kc=ok.filter(c=>c.id.startsWith('c:')),kn=ok.filter(c=>c.id.startsWith('n:'));
 const fam=!kn.length?kc:!kc.length?kn:rng()<(L==='easy'||L==='normal'?.55:.6)?kc:kn;
 return choose(rng,fam,c=>c.id).mk();
}
const rnd=(rng,a,b)=>a+(b-a)*rng();
function upRange(E){return E<40?[1.4,2.4]:E<120?[1.25,1.9]:E<300?[1.1,1.45]:[1.02,1.18]}
// 三种局面：两扇都变多但差得不多（45%）、一好一坏（35%）、两扇都变少只能两害取其轻（20%）。
function gatePair(E,L,rng,stage,i){
 for(let tries=0;tries<80;tries++){
  const [u0,u1]=upRange(E),r=rng();let t1,t2,mode;
  if(r<.45){mode='close';t1=E*rnd(rng,u0,u1);t2=t1*(rng()<.5?1-rnd(rng,.05,.2):1+rnd(rng,.05,.2));if(t2<=E)t2=E+Math.max(1,(t1-E)*.6)}
  else if(r<.88||E<20||i<2){mode='split';t1=E*rnd(rng,u0,u1);t2=E*rnd(rng,.45,.93)}
  else{mode='bad';t1=E*rnd(rng,.62,.95);t2=t1*(1-rnd(rng,.06,.22))}
  if(t1>G_CAP)t1=G_CAP;if(t2>G_CAP)t2=G_CAP;
  const keep={USED:{...USED},n:IDS.length};
  const a=opFor(t1,E,L,rng,stage),b=a&&opFor(t2,E,L,rng,stage,a.id);
  if(a&&b){const va=a.apply(E),vb=b.apply(E),hi=Math.max(va,vb);
   const okv=va!==vb&&hi>=1&&Math.abs(va-vb)>=Math.max(1,hi*.03)&&(mode!=='close'||Math.min(va,vb)>E);
   if(okv)return rng()<.5?{left:a,right:b,mode}:{left:b,right:a,mode};}
  USED=keep.USED;IDS.length=keep.n;
 }
 return {left:constOp('add',3,L,rng,stage),right:constOp('sub',1,L,rng,stage),mode:'fallback'};
}
const G_CAP=900;

function makeLevel(level,rng,stage,recent){
 const cfg=LEVELS[level]||LEVELS.easy;rng=rng||Math.random;stage=Math.max(1,stage||1);
 USED={};IDS=[];for(const id of recent||[])USED[id]=(USED[id]||0)+1;
 const rows=[];let best=cfg.start,worst=cfg.start,z=FIRST_Z;
 for(let i=0;i<cfg.gates;i++){
  const pair=gatePair(best,level,rng,stage,i);
  const vl=pair.left.apply(best),vr=pair.right.apply(best);
  rows.push({type:'gate',z,left:pair.left,right:pair.right,best:vl>=vr?'left':'right',mode:pair.mode,at:best});
  best=Math.max(vl,vr);worst=Math.min(pair.left.apply(worst),pair.right.apply(worst));
  if(i===1||i===4||i===6&&cfg.gates>7){
   const n=Math.max(3,Math.round(best*(.18+rng()*.17)));
   rows.push({type:'enemy',z:z+cfg.gap/2,n});best=Math.max(0,best-n);worst=Math.max(0,worst-n);
  }
  z+=cfg.gap;
 }
 const factor=Math.min(.94,cfg.hp+.03*(stage-1));
 let hp=Math.max(6,Math.round(best*factor));
 if(hp<=worst&&worst<best)hp=worst+1;
 hp=Math.min(hp,best);
 return {level,cfg,rows,bossZ:z-cfg.gap+BOSS_GAP,bossHp:hp,optimal:best,worst,stage,ids:IDS.slice()};
}

class Run{
 constructor(level,rng,stage,recent){
  this.L=makeLevel(level,rng,stage,recent);this.level=level;this.cfg=this.L.cfg;this.rows=this.L.rows;
  this.bossZ=this.L.bossZ;this.bossMax=this.bossHp=this.L.bossHp;
  this.count=this.cfg.start;this.z=0;this.x=0;this.targetX=0;this.phase='ready';
  this.next=0;this.fight=null;this.acc=0;this.bossT=0;this.bossRate=0;this.result=null;this.passed=[];
 }
 get over(){return this.phase==='won'||this.phase==='lost'}
 get progress(){return clamp(this.z/(this.bossZ-BOSS_STOP),0,1)}
 start(){if(this.phase==='ready')this.phase='run'}
 limit(){return steerLimit(this.count)}
 steer(x){const l=this.limit();this.targetX=clamp(x,-l,l)}
 side(){return this.x<0?'left':'right'}
 lose(reason,ev){this.phase='lost';this.result={win:false,reason};ev.push({type:'lost',reason})}
 update(dt){
  const ev=[];dt=clamp(dt,0,.1);
  if(this.phase==='run'){
   const l=this.limit();this.targetX=clamp(this.targetX,-l,l);
   const d=this.targetX-this.x,step=9*dt;this.x+=Math.abs(d)<=step?d:Math.sign(d)*step;
   this.z+=this.cfg.speed*dt;
   while(this.phase==='run'&&this.next<this.rows.length&&this.z>=this.rows[this.next].z-(this.rows[this.next].type==='enemy'?1.4:0)){
    const r=this.rows[this.next];
    if(r.type==='gate'){
     const side=this.side(),op=r[side],from=this.count;this.count=op.apply(from);this.next++;
     this.passed.push({side,best:side===r.best});
     ev.push({type:'gate',row:r,side,op,from,to:this.count,best:side===r.best});
     if(this.count<=0)this.lose('gate',ev);
    }else{
     this.z=r.z-1.4;this.phase='fight';this.fight={row:r,left:r.n,total:r.n};this.acc=0;r.left=r.n;
     ev.push({type:'clash',row:r});
    }
   }
   if(this.phase==='run'&&this.z>=this.bossZ-BOSS_STOP){
    this.z=this.bossZ-BOSS_STOP;this.phase='boss';this.bossT=0;
    this.bossRate=Math.max(6,Math.min(this.count,this.bossHp)/3);this.acc=0;ev.push({type:'boss',count:this.count,hp:this.bossHp});
   }
  }else if(this.phase==='fight'){
   const f=this.fight;this.acc+=Math.max(10,f.total/.9)*dt;
   let k=Math.min(Math.floor(this.acc),f.left,this.count);this.acc-=Math.floor(this.acc);
   if(k>0){f.left-=k;f.row.left=f.left;this.count-=k;ev.push({type:'trade',n:k})}
   if(f.left<=0){f.row.done=true;this.next++;this.phase='run';this.fight=null;ev.push({type:'cleared',row:f.row})}
   else if(this.count<=0)this.lose('enemy',ev);
  }else if(this.phase==='boss'){
   this.bossT+=dt;if(this.bossT<BOSS_DELAY)return ev;
   this.acc+=this.bossRate*dt;
   let k=Math.min(Math.floor(this.acc),this.bossHp,this.count);this.acc-=Math.floor(this.acc);
   if(k>0){this.bossHp-=k;this.count-=k;ev.push({type:'hit',n:k,hp:this.bossHp})}
   // 最后一只猪猪打出致命一击也算赢。
   if(this.bossHp<=0){this.phase='won';this.result={win:true,score:this.count};ev.push({type:'won',score:this.count})}
   else if(this.count<=0)this.lose('boss',ev);
  }
  return ev;
 }
}
const api={LEVELS,MAX_COUNT,MAX_VISIBLE,ROAD,BOSS_STOP,BOSS_DELAY,POW_FORMS,CALC_FORMS,NOPS,radius,steerLimit,constOp,buildConst,expand,makeLevel,plain,Run,reset:()=>{USED={};IDS=[]}};
if(typeof module==='object'&&module.exports)module.exports=api;
root.PigGateCore=api;
})(typeof window!=='undefined'?window:globalThis);
