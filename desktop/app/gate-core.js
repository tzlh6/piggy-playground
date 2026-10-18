/* 猪猪闯算门：独立规则，不依赖渲染或时钟。
 * 跑道左右两扇门，队伍领头走哪边就算哪扇门；途中有野猪拦路，终点按剩余猪猪数挑战巨大猪王。
 * 门的“加 / 乘”结算与按队伍半径收窄左右边界的思路参考 5ubh4d45/CountMasters_Prototype
 * （commit da97ed904ee97b186305c51cf32bed94f4828bd8，Copyright (c) 2022 Subha Das，MIT；
 * 见 assets/licenses/5ubh4d45_CountMasters_Prototype-MIT.txt）。本文件为重新实现，
 * 并扩展了减、除、平方、开方与微积分门。
 * 所有门的运算都是单调不减的，所以“每扇门都选结果更大的”就是全局最优路线，
 * 关卡用它来设定猪王血量，保证每一关都有解。
 */
(function(root){
'use strict';
const MAX_COUNT=999,ROAD=3.4,MAX_VISIBLE=160;
const LEVELS={
 easy:{name:'加减乘除',gates:7,speed:11,hp:.6,start:5,hidden:false},
 normal:{name:'平方开方',gates:8,speed:10,hp:.68,start:4,hidden:false},
 hard:{name:'微积分',gates:8,speed:8.2,hp:.72,start:4,hidden:true}
};
const FIRST_Z=34,GAP=26,ENEMY_AFTER=13,BOSS_GAP=44,BOSS_STOP=7,BOSS_DELAY=1.1;
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
   case 'frac':return '('+P(x.n)+')/('+P(x.d)+')';
   case 'sqrt':return '√('+P(x.c)+')';
   case 'big':return x.sym+'['+P(x.lo)+','+P(x.hi)+'] ';
   case 'lim':return 'lim['+P(x.u)+'] ';
   case 'at':return P(x.c)+'|'+P(x.s);
  }
  return '';
 }).join('');
}

// ---- 常数的“难题写法” ----
// 每种写法返回 {form, p, nodes, value}；form 与参数 p 让测试独立复算。
const isInt=v=>Math.abs(v-Math.round(v))<1e-9;
const TRI=m=>m*(m+1)/2;
const HARD_FORMS=[
 k=>{const a=Math.sqrt(k);return isInt(a)&&a>=2&&a<=20?{form:'int2x',p:{a},nodes:[big('∫','0',S(a)),'2x dx']}:null},
 k=>{const a=Math.cbrt(k);return isInt(a)&&a>=2&&a<=4?{form:'int3x2',p:{a},nodes:[big('∫','0',S(a)),'3',sup('x','2'),' dx']}:null},
 k=>k===2?{form:'intsin',p:{},nodes:[big('∫','0','π'),'sin x dx']}:null,
 k=>{for(const a of [2,3,4,5,6,7,8,9]){const c=k/a;if(isInt(c)&&c>=2&&c<=9)return {form:'intc',p:{a,c},nodes:[big('∫','0',S(a)),S(c)+' dx']}}return null},
 k=>{const a=k/2;return isInt(a)&&a>=2&&a<=200?{form:'d2',p:{a},nodes:[at(['(',sup('x','2'),')′'],'x='+a)]}:null},
 k=>{const a=Math.sqrt(k/3);return isInt(a)&&a>=1&&a<=4&&k>3?{form:'d3',p:{a},nodes:[at(['(',sup('x','3'),')′'],'x='+a)]}:null},
 k=>k>=2&&k<=60?{form:'limsin',p:{a:k},nodes:[lim('x→0'),frac('sin '+k+'x','x')]}:null,
 k=>k>=2&&k<=9?{form:'liminf',p:{a:k},nodes:[lim('x→∞'),frac([S(k),sup('x','2'),'+1'],[sup('x','2'),'+3'])]}:null,
 k=>k>=2&&k<=999?{form:'dlin',p:{a:k,b:3+(k*7)%6},nodes:[frac('d','dx'),'('+k+'x+'+(3+(k*7)%6)+')']}:null,
 k=>{for(let m=2;m<=20;m++)if(TRI(m)===k)return {form:'sum',p:{m},nodes:[big('Σ','i=1',S(m)),'i']};return null},
 k=>k>=2&&k<=7?{form:'log',p:{a:k},nodes:[sub('log','2'),' '+Math.pow(2,k)]}:null,
 k=>({2:2,6:3,24:4})[k]?{form:'fact',p:{m:({2:2,6:3,24:4})[k]},nodes:[({2:2,6:3,24:4})[k]+'!']}:null,
 k=>k>=2&&k<=9?{form:'eln',p:{a:k},nodes:[sup('e','ln '+k)]}:null,
 k=>{for(let m=3;m<=8;m++)if(m*(m-1)===k)return {form:'perm',p:{m},nodes:[{k:'ss',b:['A'],sub:[S(m)],sup:['2']}]};return null},
 k=>k>=2&&k<=12?{form:'sqrtsq',p:{a:k},nodes:[sqrt(S(k*k))]}:null,
 k=>k>=3&&k<=400?{form:'dpoly',p:{a:k-2},nodes:[at(['(',sup('x','2'),'+'+(k-2)+'x)′'],'x=1')]}:null,
 k=>{const a=k/2;return isInt(a)&&a>=2&&a<=30?{form:'limq',p:{a},nodes:[lim('x→'+a),frac([sup('x','2'),'−'+a*a],'x−'+a)]}:null},
 k=>k>=10&&k<=999?{form:'liminf1',p:{a:k},nodes:[lim('x→∞'),frac(k+'x+1','x')]}:null,
 k=>{const c=(k-2)/2;return isInt(c)&&c>=1&&c<=60?{form:'intlin',p:{c},nodes:[big('∫','0','2'),'(x+'+c+') dx']}:null}
];
const MID_FORMS=[
 k=>{const a=Math.sqrt(k);return isInt(a)&&a>=2&&a<=9?{form:'sq',p:{a},nodes:[sup(S(a),'2')]}:null},
 k=>k>=2&&k<=12?{form:'sqrtsq',p:{a:k},nodes:[sqrt(S(k*k))]}:null,
 k=>{const e=Math.log2(k);return isInt(e)&&e>=3&&e<=6?{form:'pow2',p:{e},nodes:[sup('2',S(e))]}:null},
 k=>{const a=Math.cbrt(k);return isInt(a)&&a>=2&&a<=4?{form:'cube',p:{a},nodes:[sup(S(a),'3')]}:null}
];
// 同一关里优先挑还没出现过的写法，避免一直是同一种极限。
let USED={};
function constForm(k,mode,rng){
 const pool=mode==='hard'?HARD_FORMS:mode==='normal'?MID_FORMS:[];
 let hit=pool.map(f=>f(k)).filter(Boolean);
 // 普通难度大约一半写成平方 / 开方；困难难度尽量都写成微积分。
 if(hit.length&&(mode==='hard'?rng()<.9:rng()<.5)){
  const low=Math.min(...hit.map(h=>USED[h.form]||0));hit=hit.filter(h=>(USED[h.form]||0)===low);
  const h=hit[Math.floor(rng()*hit.length)];USED[h.form]=(USED[h.form]||0)+1;h.value=k;return h}
 return {form:'num',p:{a:k},nodes:[S(k)],value:k};
}
// 常数取值：尽量挑能写成难题的数
function niceConst(lo,hi,mode,rng){
 lo=Math.max(2,Math.round(lo));hi=Math.max(lo,Math.round(hi));
 if(mode==='easy')return lo+Math.floor(rng()*(hi-lo+1));
 const pool=mode==='hard'?HARD_FORMS:MID_FORMS,good=[];
 for(let k=lo;k<=hi;k++)if(pool.some(f=>f(k)))good.push(k);
 if(good.length&&rng()<.85)return good[Math.floor(rng()*good.length)];
 return lo+Math.floor(rng()*(hi-lo+1));
}

// ---- 门 ----
// kind：add / sub / mul / div 带常数；sq / sqrt / dbl / tri / log / same 作用在 n（当前猪猪数）上。
const SIGN={add:'+',sub:'−',mul:'×',div:'÷'};
// reveal：过门后给出的化简结果（向下取整）。
const N_OPS={
 sq:{f:n=>n*n,nodes:m=>m==='hard'?['n→',big('∫','0','n'),'2x dx']:['n→',sup('n','2')],reveal:m=>m==='hard'?'∫₀ⁿ 2x dx = n²':'平方'},
 sqrt:{f:n=>Math.floor(Math.sqrt(n)),nodes:m=>m==='hard'?['n→',sup('n','½')]:['n→',sqrt('n')],reveal:m=>m==='hard'?'n^½ = √n，向下取整':'开方，向下取整'},
 dbl:{f:n=>2*n,nodes:()=>['n→(',sup('n','2'),')′'],reveal:()=>'(n²)′ = 2n'},
 tri:{f:n=>n*(n+1)/2,nodes:()=>['n→',big('Σ','i=1','n'),'i'],reveal:()=>'1+2+…+n = n(n+1)/2'},
 log:{f:n=>n>0?Math.floor(Math.log2(n)):0,nodes:()=>['n→',sub('log','2'),' n'],reveal:()=>'log₂ n，向下取整'},
 same:{f:n=>n,nodes:()=>['n→',big('∫','0','n'),'1 dx'],reveal:()=>'∫₀ⁿ 1 dx = n，原地踏步'}
};
function makeOp(kind,k,mode,rng){
 if(N_OPS[kind]){const o=N_OPS[kind];return {kind,nodes:o.nodes(mode),apply:n=>cap(o.f(n)),text:plain(o.nodes(mode)),reveal:o.reveal(mode)}}
 const c=constForm(k,mode,rng),f={add:n=>n+k,sub:n=>n-k,mul:n=>n*k,div:n=>n/k}[kind];
 const nodes=[SIGN[kind]].concat(c.form==='num'?c.nodes:(c.nodes.length===1&&typeof c.nodes[0]!=='string'?c.nodes:['(',...c.nodes,')']));
 // 写成括号便于读：+(∫…) 。单个上标 / 根号节点不加括号。
 return {kind,k,form:c.form,p:c.p,value:k,nodes,apply:n=>cap(f(n)),text:plain(nodes),reveal:'',revealNodes:c.form==='num'?null:c.nodes.concat([' = '+k])};
}
// 越到后面加得越克制，正常走最优路线约在 150–450 只，不轻易顶到 999。
function goodOp(E,mode,rng){
 const opts=[],g=E<60?1:E<150?.7:.4;
 const mulK=E<30?2+Math.floor(rng()*2):2;
 if(E<=120)opts.push(['mul',mulK]);
 opts.push(['add',niceConst(Math.max(3,E*.3*g),Math.max(6,E*g),mode,rng)]);
 if(mode!=='easy'&&E>=3&&E<=12)opts.push(['sq',0]);
 if(mode==='hard'&&E>=4&&E<=120)opts.push(['dbl',0]);
 if(mode==='hard'&&E>=4&&E<=14)opts.push(['tri',0]);
 const [kind,k]=opts[Math.floor(rng()*opts.length)];return makeOp(kind,k,mode,rng);
}
function badOp(E,mode,rng){
 const opts=[['sub',niceConst(Math.max(2,E*.2),Math.max(3,E*.55),mode,rng)],['div',E>=6&&rng()<.6?2+Math.floor(rng()*2):2]];
 if(mode!=='easy'&&E>=9)opts.push(['sqrt',0]);
 if(mode==='hard'&&E>=10)opts.push(['log',0]);
 if(mode==='hard')opts.push(['same',0]);
 const [kind,k]=opts[Math.floor(rng()*opts.length)];return makeOp(kind,k,mode,rng);
}
function gatePair(E,mode,rng){
 for(let tries=0;tries<40;tries++){
  const a=goodOp(E,mode,rng),b=rng()<.35?goodOp(E,mode,rng):badOp(E,mode,rng);
  const va=a.apply(E),vb=b.apply(E);
  if(va===vb||Math.max(va,vb)<1)continue;
  if(Math.abs(va-vb)<Math.max(2,Math.max(va,vb)*.08))continue;
  return rng()<.5?{left:a,right:b}:{left:b,right:a};
 }
 const a=makeOp('add',3,mode,rng),b=makeOp('sub',1,mode,rng);return {left:a,right:b};
}

function makeLevel(level,rng,stage){
 const cfg=LEVELS[level]||LEVELS.easy;rng=rng||Math.random;stage=Math.max(1,stage||1);
 const rows=[];let best=cfg.start,worst=cfg.start,z=FIRST_Z;USED={};
 for(let i=0;i<cfg.gates;i++){
  const pair=gatePair(best,level,rng);
  const vl=pair.left.apply(best),vr=pair.right.apply(best);
  rows.push({type:'gate',z,left:pair.left,right:pair.right,best:vl>=vr?'left':'right'});
  best=Math.max(vl,vr);worst=Math.min(pair.left.apply(worst),pair.right.apply(worst));
  if(i===1||i===4||i===6&&cfg.gates>7){
   const n=Math.max(3,Math.round(best*(.18+rng()*.17)));
   rows.push({type:'enemy',z:z+ENEMY_AFTER,n});best=Math.max(0,best-n);worst=Math.max(0,worst-n);
  }
  z+=GAP;
 }
 const factor=Math.min(.94,cfg.hp+.03*(stage-1));
 let hp=Math.max(6,Math.round(best*factor));
 if(hp<=worst&&worst<best)hp=worst+1;
 hp=Math.min(hp,best);
 return {level,cfg,rows,bossZ:z-GAP+BOSS_GAP,bossHp:hp,optimal:best,worst,stage};
}

class Run{
 constructor(level,rng,stage){
  this.L=makeLevel(level,rng,stage);this.level=level;this.cfg=this.L.cfg;this.rows=this.L.rows;
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
const api={LEVELS,MAX_COUNT,MAX_VISIBLE,ROAD,BOSS_STOP,BOSS_DELAY,HARD_FORMS,MID_FORMS,N_OPS,radius,steerLimit,makeOp,makeLevel,constForm,plain,Run};
if(typeof module==='object'&&module.exports)module.exports=api;
root.PigGateCore=api;
})(typeof window!=='undefined'?window:globalThis);
