/* 斗地猪 · 规则核心与电脑 AI（4.4）
   - 一副 54 张：id 0–51 为普通牌（点数 = (id>>2)+3，3…A 记 3…14，2 记 15，花色 = id&3），52 小猪王（16），53 大猪王（17）。
   - 三人：叫分（不叫 / 1 / 2 / 3 分）定出邪恶猪猪（地主），另两位是屠夫（农民）。
   - 牌型：单张、对子、三张、三带一、三带一对、顺子（≥5）、连对（≥3 对）、飞机（≥2 组三张，可带同数量的单张或对子）、
     四带二（两张单牌或两对）、炸弹、王炸。花色不影响大小。
   - 倍数：底分 = 叫分；炸弹、王炸、春天、反春各 ×2。邪恶猪猪赢：自己 +2×底分×倍数，两位屠夫各 −底分×倍数；屠夫赢反之。
   - Game 只做规则，所有改动都产生事件（events），界面按事件播放动画；view(seat) 只给某个座位它该看到的信息（联机信息隐藏）。
   - AI 只读 view(seat)：悠闲（贪小）、聪明（拆牌估值 + 配合）、恶魔（另外记牌，知道哪些牌已经出过）。 */
(function(root){
'use strict';
const RANK={3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A',15:'2',16:'小王',17:'大王'};
const SUITS=['hoof','snout','truffle','tail'];
const SUIT_NAME={hoof:'猪蹄',snout:'猪鼻',truffle:'松露',tail:'卷尾'};
const TYPE_NAME={single:'单张',pair:'对子',triple:'三张',triple1:'三带一',triple2:'三带一对',straight:'顺子',pairs:'连对',plane:'飞机',plane1:'飞机带翅膀',plane2:'飞机带对子',four2:'四带二',four22:'四带两对',bomb:'炸弹',rocket:'王炸'};
const val=id=>id>=52?(id===52?16:17):(id>>2)+3;
const suitOf=id=>id>=52?null:SUITS[id&3];
const rankName=v=>RANK[v];
// 显示用：点数大的在前，同点按花色
const byDesc=(a,b)=>val(b)-val(a)||b-a;
const byAsc=(a,b)=>val(a)-val(b)||a-b;
function counts(ids){const c=new Array(18).fill(0);for(const id of ids)c[val(id)]++;return c}
function createRng(seed){let s=seed>>>0||1;return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function shuffle(a,rng){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

// ================= 牌型识别 =================
// 返回这些牌所有可能的解释（同一组牌有时能读成两种牌型，例如 33334444 既是飞机带翅膀，也是四带两对）
function patterns(ids){
 const n=ids.length;if(!n)return [];
 const c=counts(ids),vals=[];for(let v=3;v<=17;v++)if(c[v])vals.push(v);
 const out=[],add=(type,main,len)=>{if(!out.some(p=>p.type===type&&p.main===main&&p.len===len))out.push({type,main,len,size:n})};
 const run=(vs)=>vs.every((v,i)=>i===0||v===vs[i-1]+1);
 const top=vals[vals.length-1];
 if(n===1)add('single',vals[0],1);
 if(n===2){if(c[16]&&c[17])add('rocket',17,1);else if(vals.length===1)add('pair',vals[0],1)}
 if(n===3&&vals.length===1)add('triple',vals[0],1);
 if(n===4){if(vals.length===1)add('bomb',vals[0],1);else for(const v of vals)if(c[v]===3)add('triple1',v,1)}
 if(n===5)for(const v of vals)if(c[v]===3&&vals.length===2&&vals.every(x=>x===v||(c[x]===2&&x<16)))add('triple2',v,1);
 if(n>=5&&vals.length===n&&top<=14&&run(vals))add('straight',vals[0],n);
 if(n>=6&&n%2===0&&vals.length===n/2&&top<=14&&vals.every(v=>c[v]===2)&&run(vals))add('pairs',vals[0],n/2);
 // 飞机：k 组连续的三张（最大到 A），翅膀为 k 张任意单牌或 k 对
 for(let k=2;3*k<=n;k++){
  for(let s=3;s+k-1<=14;s++){
   let ok=true;for(let v=s;v<s+k;v++)if(c[v]<3){ok=false;break}
   if(!ok)continue;
   if(n===3*k&&vals.length===k)add('plane',s,k);
   if(n===4*k)add('plane1',s,k);
   if(n===5*k){const r=c.slice();for(let v=s;v<s+k;v++)r[v]-=3;let pairs=0,bad=false;for(let v=3;v<=17;v++){if(!r[v])continue;if(r[v]%2||v>=16){bad=true;break}pairs+=r[v]/2}if(!bad&&pairs===k)add('plane2',s,k)}
  }
 }
 if(n===6)for(const v of vals)if(c[v]===4)add('four2',v,1);
 if(n===8)for(const v of vals)if(c[v]===4){const r=c.slice();r[v]-=4;let pairs=0,bad=false;for(let x=3;x<=17;x++){if(!r[x])continue;if(r[x]%2||x>=16){bad=true;break}pairs+=r[x]/2}if(!bad&&pairs===2)add('four22',v,1)}
 return out;
}
const LEAD_ORDER=['rocket','bomb','straight','pairs','plane','plane2','plane1','four22','four2','triple2','triple1','triple','pair','single'];
function beats(p,q){
 if(!q)return true;
 if(p.type==='rocket')return q.type!=='rocket';
 if(q.type==='rocket')return false;
 if(p.type==='bomb')return q.type!=='bomb'||p.main>q.main;
 if(q.type==='bomb')return false;
 return p.type===q.type&&p.len===q.len&&p.size===q.size&&p.main>q.main;
}
// 选出这组牌在当前局面下的牌型：领出时按固定优先级，跟牌时找能压过上家的解释
function pick(ids,prev){
 const ps=patterns(ids);if(!ps.length)return null;
 if(!prev){ps.sort((a,b)=>LEAD_ORDER.indexOf(a.type)-LEAD_ORDER.indexOf(b.type)||b.main-a.main);return ps[0]}
 const ok=ps.filter(p=>beats(p,prev));if(!ok.length)return null;
 ok.sort((a,b)=>(a.type===prev.type?0:1)-(b.type===prev.type?0:1)||a.main-b.main);return ok[0];
}
function describe(p){if(!p)return '';const t=TYPE_NAME[p.type];if(p.type==='straight')return `顺子（${rankName(p.main)}–${rankName(p.main+p.len-1)}）`;if(p.type==='pairs')return `连对（${p.len} 对）`;if(p.type.startsWith('plane'))return `${t}（${p.len} 组）`;return t}
// 牌面排列：主体（三张、四张）在前，带的牌在后
function arrange(ids,p){
 const c=counts(ids);const key=id=>{const v=val(id);let w=c[v];if(p&&(p.type==='plane1'||p.type==='plane2'||p.type.startsWith('triple')))w=(v>=p.main&&v<p.main+p.len&&c[v]>=3)?3:Math.min(c[v],2);if(p&&p.type.startsWith('four'))w=v===p.main?4:1;return w*100+v};
 return ids.slice().sort((a,b)=>key(b)-key(a)||b-a);
}

// ================= 出牌候选 =================
// 按点数挑出具体的牌（同点数优先挑花色编号小的）
function takeIds(hand,valsNeeded){
 const pool={};for(const id of hand.slice().sort(byAsc)){(pool[val(id)]=pool[val(id)]||[]).push(id)}
 const out=[];for(const v of valsNeeded){const p=pool[v];if(!p||!p.length)return null;out.push(p.shift())}return out;
}
// 生成“合理的”出牌：所有主体结构 × 少量启发式带牌（不穷举全部带牌组合）
function moves(hand,prev){
 const c=counts(hand),list=[],seen=new Set();
 const push=(vs)=>{const key=vs.slice().sort((a,b)=>a-b).join(',');if(seen.has(key))return;seen.add(key);const ids=takeIds(hand,vs);if(!ids)return;const p=pick(ids,prev);if(!p)return;if(prev&&!beats(p,prev))return;list.push({ids,p,vals:vs})};
 const rep=(v,k)=>Array(k).fill(v);
 const want=t=>!prev||prev.type===t||t==='bomb'||t==='rocket';
 // 带牌候选：先挑真正落单的小牌，再拆对子、三张；不拆炸弹与王炸
 const kickers=(used,k,pair)=>{
  const res=[];const cand=[];
  for(let v=3;v<=17;v++){const left=c[v]-(used[v]||0);if(left<=0||c[v]===4)continue;if(pair&&(left<2||v>=16))continue;if(!pair&&v>=16&&c[16]&&c[17])continue;cand.push({v,left,w:(left===1?0:left===2?20:40)+v})}
  cand.sort((a,b)=>a.w-b.w);
  const pickSet=(arr)=>{const vs=[];for(const o of arr){if(vs.length/(pair?2:1)>=k)break;vs.push(...rep(o.v,pair?2:1))}return vs.length===(pair?2:1)*k?vs:null};
  const a=pickSet(cand);if(a)res.push(a);
  // 另一种：按点数从小到大（不考虑是否落单）
  const b=pickSet(cand.slice().sort((x,y)=>x.v-y.v));if(b)res.push(b);
  return res;
 };
 for(let v=3;v<=17;v++){
  if(!c[v])continue;
  if(want('single'))push([v]);
  if(c[v]>=2&&v<16&&want('pair'))push(rep(v,2));
  if(c[v]>=3){
   if(want('triple'))push(rep(v,3));
   if(want('triple1')){for(let x=3;x<=17;x++)if(x!==v&&c[x])push(rep(v,3).concat([x]))}
   if(want('triple2')){for(let x=3;x<=15;x++)if(x!==v&&c[x]>=2)push(rep(v,3).concat(rep(x,2)))}
  }
  if(c[v]===4){
   if(want('bomb'))push(rep(v,4));
   if(want('four2'))kickers({[v]:4},2,false).forEach(k=>push(rep(v,4).concat(k)));
   if(want('four22'))kickers({[v]:4},2,true).forEach(k=>push(rep(v,4).concat(k)));
  }
 }
 if(c[16]&&c[17]&&want('rocket'))push([16,17]);
 const chainLen=prev&&['straight','pairs','plane','plane1','plane2'].includes(prev.type)?prev.len:0;
 // 顺子 / 连对 / 飞机
 for(const [type,need,minLen] of [['straight',1,5],['pairs',2,3],['plane',3,2]]){
  if(prev&&!(prev.type===type||(type==='plane'&&prev.type.startsWith('plane'))))continue;
  for(let s=3;s<=14;s++){
   let e=s-1;while(e+1<=14&&c[e+1]>=need)e++;
   for(let L=minLen;L<=e-s+1;L++){
    if(chainLen&&L!==chainLen)continue;
    const body=[];for(let v=s;v<s+L;v++)body.push(...rep(v,need));
    if(type!=='plane'){push(body);continue}
    if(!prev||prev.type==='plane')push(body);
    const used={};for(let v=s;v<s+L;v++)used[v]=3;
    if(!prev||prev.type==='plane1')kickers(used,L,false).forEach(k=>push(body.concat(k)));
    if(!prev||prev.type==='plane2')kickers(used,L,true).forEach(k=>push(body.concat(k)));
   }
  }
 }
 return list;
}
// 提示顺序：同牌型从小到大，然后炸弹、王炸
function hints(hand,prev){
 const ms=moves(hand,prev);
 const rank=m=>(m.p.type==='rocket'?2:m.p.type==='bomb'?1:0);
 if(!prev){ms.sort((a,b)=>rank(a)-rank(b)||a.p.main-b.p.main||b.ids.length-a.ids.length);return ms}
 return ms.sort((a,b)=>rank(a)-rank(b)||a.p.main-b.p.main||kickWeight(a)-kickWeight(b));
}
function kickWeight(m){return m.vals.reduce((s,v)=>s+v,0)}

// ================= 拆牌估值（AI 用） =================
// 估值越低越好：手数（几次能出完）为主，小单张、小对子是负担，大牌和炸弹是控制力。
function Planner(){this.memo=new Map()}
Planner.prototype.plan=function(c){
 c=c.slice();const fixed=[];
 if(c[16]&&c[17]){fixed.push({type:'rocket',main:17,len:1,vals:[16,17]});c[16]=c[17]=0}
 for(let v=3;v<=15;v++)if(c[v]===4){fixed.push({type:'bomb',main:v,len:1,vals:[v,v,v,v]});c[v]=0}
 const r=this.best(c,0);
 // 炸弹、王炸也算一手，但它们一定能抢到出牌权，所以估值略减
 return {score:r.score-fixed.length*2,hands:r.hands+fixed.length,groups:fixed.concat(r.groups)};
};
Planner.prototype.best=function(c,slots){
 const key=c.join('')+'|'+slots;let hit=this.memo.get(key);if(hit)return hit;
 let best=leaf(c,slots);
 for(const ch of chainCands(c)){
  const rest=c.slice();for(let v=ch.main;v<ch.main+ch.len;v++)rest[v]-=ch.need;
  const sub=this.best(rest,slots+(ch.type==='plane'?ch.len:0));
  const g={type:ch.type,main:ch.main,len:ch.len,vals:[]};for(let v=ch.main;v<ch.main+ch.len;v++)for(let k=0;k<ch.need;k++)g.vals.push(v);
  const score=sub.score+12+(14-(ch.main+ch.len-1))*.15;
  if(score<best.score-1e-9){
   // 飞机的翅膀：把叶子里分给“三张”的带牌名额中，属于飞机的那几份挂到飞机上
   best={score,hands:sub.hands+1,groups:[g].concat(sub.groups)};
  }
 }
 if(this.memo.size>200000)this.memo.clear();
 this.memo.set(key,best);return best;
};
function chainCands(c){
 const out=[];
 for(const [type,need,minLen] of [['straight',1,5],['pairs',2,3],['plane',3,2]]){
  for(let s=3;s<=14;s++){if(c[s]<need)continue;let e=s;while(e+1<=14&&c[e+1]>=need)e++;for(let L=minLen;L<=e-s+1;L++)out.push({type,main:s,len:L,need})}
 }
 return out;
}
// 叶子：没有连牌了，剩下三张 / 对子 / 单张；三张（和飞机的名额）带走最小的单张或对子
function leaf(c,planeSlots){
 const singles=[],pairs=[],triples=[];
 for(let v=3;v<=17;v++){if(c[v]===1)singles.push(v);else if(c[v]===2)pairs.push(v);else if(c[v]===3)triples.push(v)}
 const units=singles.map(v=>({v,k:1})).concat(pairs.map(v=>({v,k:2}))).sort((a,b)=>a.v-b.v||a.k-b.k);
 let slots=triples.length+planeSlots;
 const kick=[],rest=[];
 for(const u of units){if(slots>0&&u.v<14){kick.push(u);slots--}else rest.push(u)}
 let score=0;const groups=[];
 // 三张带牌：小三张优先带小牌
 const tk=kick.slice();
 for(const v of triples){const k=tk.length>planeSlots?tk.shift():null;const g={type:k?(k.k===1?'triple1':'triple2'):'triple',main:v,len:1,vals:[v,v,v].concat(k?Array(k.k).fill(k.v):[])};groups.push(g);score+=12+(15-v)*.25}
 // 留给飞机的带牌（交给出牌时再挑），这里只记为“已被带走”
 for(const u of tk)groups.push({type:'wing',main:u.v,len:1,vals:Array(u.k).fill(u.v)});
 for(const u of rest){groups.push({type:u.k===1?'single':'pair',main:u.v,len:1,vals:Array(u.k).fill(u.v)});score+=12+(u.v>=15?-(u.v-14)*2.2:(15-u.v)*(u.k===1?.7:.45))}
 const hands=groups.filter(g=>g.type!=='wing').length;
 return {score,hands,groups};
}

// ================= 对局 =================
class Game{
 constructor(o){
  o=o||{};this.rng=o.rng||Math.random;this.events=[];this.round=0;
  this.nextFirst=o.first!==undefined?o.first:Math.floor(this.rng()*3);
  this.phase='idle';this.hands=[[],[],[]];this.bottom=[];this.landlord=-1;
 }
 next(s){return (s+1)%3}
 emit(e){this.events.push(e);return e}
 deal(o){
  o=o||{};const deck=o.deck||shuffle(Array.from({length:54},(_,i)=>i),this.rng);
  this.round++;this.hands=[deck.slice(0,17),deck.slice(17,34),deck.slice(34,51)].map(h=>h.sort(byDesc));this.bottom=deck.slice(51,54).sort(byDesc);
  this.phase='bid';this.first=this.nextFirst;this.nextFirst=this.next(this.first);
  this.bids=[null,null,null];this.bidCount=0;this.highest=0;this.highSeat=-1;this.turn=this.first;this.landlord=-1;this.base=0;this.mult=1;this.multParts=[];
  this.last=null;this.passes=0;this.plays=[0,0,0];this.played=[];this.trick=[null,null,null];this.history=[];this.result=null;this.redeals=o.redeals||0;
  this.emit({type:'deal',round:this.round,first:this.first,hands:this.hands.map(h=>h.slice()),redeal:this.redeals});
  this.emit({type:'turn',seat:this.turn,phase:'bid',highest:0});
 }
 check(seat,a){
  if(this.phase==='end')return '这一局已经结束了。';
  if(seat!==this.turn)return '还没轮到你。';
  if(a.type==='bid'){
   if(this.phase!=='bid')return '现在不是叫分的时候。';
   const v=a.value|0;if(v<0||v>3)return '只能叫 1、2、3 分或不叫。';
   if(v&&v<=this.highest)return `要比 ${this.highest} 分高才能叫。`;
   return '';
  }
  if(this.phase!=='play')return '还在叫分，先决定谁当邪恶猪猪。';
  if(a.type==='pass'){if(!this.last)return '这一轮由你先出，不能不出。';return ''}
  if(a.type==='play'){
   const ids=a.cards||[];if(!ids.length)return '先选几张牌。';
   const hand=new Set(this.hands[seat]);if(new Set(ids).size!==ids.length||ids.some(id=>!hand.has(id)))return '只能出自己手里的牌。';
   if(!patterns(ids).length)return '这几张牌组不成牌型。';
   if(this.last&&!pick(ids,this.last.p)){const p0=pick(ids,null);if(p0&&(p0.type!==this.last.p.type||p0.len!==this.last.p.len||p0.size!==this.last.p.size)&&p0.type!=='bomb'&&p0.type!=='rocket')return `要出和上家一样的牌型（${describe(this.last.p)}），或者用炸弹。`;return '压不过上家的牌。'}
   return '';
  }
  return '看不懂这个操作。';
 }
 act(seat,a){
  const reason=this.check(seat,a);if(reason)return {ok:false,reason,events:[]};
  const start=this.events.length;
  if(a.type==='bid')this.doBid(seat,a.value|0);else if(a.type==='pass')this.doPass(seat);else this.doPlay(seat,a.cards);
  return {ok:true,events:this.events.slice(start)};
 }
 doBid(seat,v){
  this.bids[seat]=v;this.bidCount++;if(v>this.highest){this.highest=v;this.highSeat=seat}
  this.emit({type:'bid',seat,value:v,highest:this.highest});
  if(v===3||this.bidCount===3){
   if(this.highest>0)return this.setLandlord(this.highSeat);
   // 没人叫：重新洗牌，下一位先叫
   this.emit({type:'redeal',round:this.round});this.nextFirst=this.next(this.first);this.round--;
   return this.deal({redeals:this.redeals+1});
  }
  this.turn=this.next(seat);this.emit({type:'turn',seat:this.turn,phase:'bid',highest:this.highest});
 }
 setLandlord(seat){
  this.landlord=seat;this.base=this.highest;this.hands[seat]=this.hands[seat].concat(this.bottom).sort(byDesc);
  this.phase='play';this.turn=seat;this.last=null;this.passes=0;
  this.emit({type:'landlord',seat,bottom:this.bottom.slice(),base:this.base,hand:this.hands[seat].slice()});
  this.emit({type:'turn',seat,phase:'play',lead:true});
 }
 doPlay(seat,ids){
  const p=pick(ids,this.last&&this.last.p);const set=new Set(ids);
  this.hands[seat]=this.hands[seat].filter(id=>!set.has(id));
  const cards=arrange(ids,p);this.last={seat,ids:cards,p};this.passes=0;this.plays[seat]++;this.played.push(...cards);
  this.trick[seat]={ids:cards,p};this.history.push({seat,ids:cards,p});
  const left=this.hands[seat].length;
  this.emit({type:'play',seat,cards,pattern:p,left,label:describe(p)});
  if(p.type==='bomb'||p.type==='rocket'){this.mult*=2;this.multParts.push(p.type);this.emit({type:'mult',mult:this.mult,reason:p.type})}
  if(left===0)return this.finish(seat);
  if(left<=2)this.emit({type:'alarm',seat,left});
  this.turn=this.next(seat);this.trick[this.turn]=null;
  this.emit({type:'turn',seat:this.turn,phase:'play',lead:false});
 }
 doPass(seat){
  this.passes++;this.trick[seat]={pass:true};this.history.push({seat,pass:true});
  this.emit({type:'pass',seat});
  this.turn=this.next(seat);
  if(this.passes>=2){const lead=this.last.seat;this.last=null;this.passes=0;this.trick=[null,null,null];this.turn=lead;this.emit({type:'clear',seat:lead});this.emit({type:'turn',seat:lead,phase:'play',lead:true});return}
  this.trick[this.turn]=null;
  this.emit({type:'turn',seat:this.turn,phase:'play',lead:false});
 }
 finish(seat){
  const L=this.landlord,landlordWin=seat===L,farmers=[0,1,2].filter(s=>s!==L);
  const spring=landlordWin&&farmers.every(s=>this.plays[s]===0),anti=!landlordWin&&this.plays[L]===1;
  if(spring||anti){this.mult*=2;this.multParts.push(spring?'spring':'antispring')}
  const unit=this.base*this.mult,deltas=[0,0,0];
  for(const s of farmers)deltas[s]=landlordWin?-unit:unit;deltas[L]=landlordWin?2*unit:-2*unit;
  this.phase='end';this.turn=-1;
  this.result={winner:seat,landlord:L,landlordWin,spring,antiSpring:anti,base:this.base,mult:this.mult,multParts:this.multParts.slice(),deltas,hands:this.hands.map(h=>h.slice()),bottom:this.bottom.slice()};
  if(spring||anti)this.emit({type:'spring',anti,mult:this.mult});
  this.emit(Object.assign({type:'end'},this.result));
 }
 // 某个座位能看到的局面（联机、断线重连、AI 都用它）
 view(seat){
  const L=this.landlord;
  return {seat,round:this.round,phase:this.phase,hand:(this.hands[seat]||[]).slice(),counts:this.hands.map(h=>h.length),landlord:L,bottom:L>=0?this.bottom.slice():null,
   first:this.first,bids:this.bids?this.bids.slice():[null,null,null],highest:this.highest||0,turn:this.turn,base:this.base||0,mult:this.mult||1,multParts:(this.multParts||[]).slice(),
   last:this.last?{seat:this.last.seat,ids:this.last.ids.slice(),p:Object.assign({},this.last.p)}:null,lead:this.phase==='play'&&!this.last,
   trick:(this.trick||[null,null,null]).map(x=>x?(x.pass?{pass:true}:{ids:x.ids.slice(),p:x.p}):null),
   plays:(this.plays||[0,0,0]).slice(),played:(this.played||[]).slice(),result:this.result?JSON.parse(JSON.stringify(this.result)):null};
 }
}
// 联机：把事件过滤成某个座位能看到的样子（发牌只给自己的手牌；地主拿到的整手牌只给地主）
function filterEvent(e,seat){
 if(e.type==='deal'){const o=Object.assign({},e);o.hand=e.hands[seat].slice();o.counts=e.hands.map(h=>h.length);delete o.hands;return o}
 if(e.type==='landlord'){const o=Object.assign({},e);if(seat!==e.seat)delete o.hand;return o}
 return e;
}

// ================= AI =================
const TIERS=['easy','smart','devil'];
const TIER_NAME={easy:'悠闲',smart:'聪明',devil:'恶魔'};
function unseenCounts(view,memory){
 const c=new Array(18).fill(0);for(let v=3;v<=15;v++)c[v]=4;c[16]=c[17]=1;
 for(const id of view.hand)c[val(id)]--;
 if(memory)for(const id of view.played)c[val(id)]--;
 return c;
}
// 对手手里有没有可能压过这一手（按“看不见的牌”估计）
function canBeBeaten(p,unseen,maxCards){
 if(p.type==='rocket')return false;
 const rocket=unseen[16]&&unseen[17]&&maxCards>=2;
 const bombs=[];for(let v=3;v<=15;v++)if(unseen[v]===4&&maxCards>=4)bombs.push(v);
 if(p.type==='bomb')return rocket||bombs.some(v=>v>p.main);
 if(rocket||bombs.length)return true;
 if(p.size>maxCards)return false;
 const need={single:1,pair:2,triple:3,triple1:3,triple2:3,straight:1,pairs:2,plane:3,plane1:3,plane2:3,four2:4,four22:4}[p.type]||1;
 for(let m=p.main+1;m+p.len-1<=(p.len>1||p.type==='straight'||p.type==='pairs'||p.type.startsWith('plane')?14:17);m++){
  let ok=true;for(let v=m;v<m+p.len;v++)if(unseen[v]<need){ok=false;break}
  if(ok)return true;
 }
 return false;
}
function sumScore(g){return g.vals.reduce((s,v)=>s+v,0)}
class AI{
 constructor(tier,rng){this.tier=TIERS.includes(tier)?tier:'smart';this.rng=rng||Math.random;this.planner=new Planner()}
 decide(view){if(view.phase==='bid')return this.bid(view);if(view.phase==='play')return this.play(view);return null}
 strength(hand){
  const c=counts(hand);let s=0;
  if(c[16]&&c[17])s+=8;else s+=c[17]*4+c[16]*3;
  s+=c[15]*2+c[14]*.8;
  for(let v=3;v<=15;v++)if(c[v]===4)s+=5;
  const pl=this.planner.plan(c);s+=Math.max(0,9-pl.hands)*.7;
  return s;
 }
 bid(view){
  let s=this.strength(view.hand);
  if(this.tier==='easy')s+=this.rng()*4-2;
  if(this.tier==='devil')s+=.4;
  let want=s>=10?3:s>=7.5?2:s>=5.5?1:0;
  if(want<=view.highest)want=0;
  // 最后一位、前面都不叫：手牌还行就叫 1 分，免得重洗
  if(!want&&view.highest===0&&view.bids.filter(b=>b!==null).length===2&&s>=4.5)want=1;
  return {type:'bid',value:want};
 }
 roleInfo(view){
  const me=view.seat,L=view.landlord,isL=me===L;
  const enemies=isL?[0,1,2].filter(s=>s!==me):[L];
  const mate=isL?-1:[0,1,2].find(s=>s!==me&&s!==L);
  const enemyMin=Math.min(...enemies.map(s=>view.counts[s]));
  return {me,L,isL,enemies,mate,enemyMin,next:(me+1)%3};
 }
 play(view){
  const hand=view.hand,prev=view.last?view.last.p:null;
  const all=hints(hand,prev);
  const m=prev?this.follow(view,all):this.lead(view,all);
  const pickA=m?{type:'play',cards:m.ids}:{type:'pass'};
  if(this.tier==='devil'&&!this.rollout&&all.length&&this.endgame(view))return this.search(view,all,pickA);
  return pickA;
 }
 endgame(view){const R=this.roleInfo(view),total=view.counts.reduce((a,b)=>a+b,0);return total<=34&&(view.hand.length<=9||R.enemyMin<=6)}
 // 恶魔的残局推演：把看不见的牌（记牌后）随机分给对手，用“聪明”打法推演到底，挑胜率最高的一手
 search(view,all,fallback){
  const me=view.seat,key=a=>a.type==='pass'?'pass':a.cards.slice().sort((x,y)=>x-y).join(',');
  const cand=[fallback],seen=new Set([key(fallback)]);
  const add=a=>{const k=key(a);if(!seen.has(k)&&cand.length<9){seen.add(k);cand.push(a)}};
  if(view.last)add({type:'pass'});
  const byType={};for(const m of all){const t=m.p.type+m.p.len;(byType[t]=byType[t]||[]).push(m)}
  for(const t in byType){const list=byType[t];add({type:'play',cards:list[0].ids});add({type:'play',cards:list[list.length-1].ids})}
  for(const m of all)add({type:'play',cards:m.ids});
  if(cand.length<2)return fallback;
  // 每次思考最多约 0.15 秒（老电脑上也不会卡）；每个样本对所有候选都推演一遍，比较才公平
  const samples=this.samples||18,wins=cand.map(()=>0),t0=Date.now(),budget=this.budget||150;
  for(let k=0;k<samples;k++){
   const hands=sampleWorld(view,this.rng);
   cand.forEach((a,i)=>{if(rollout(view,hands,a,me))wins[i]++});
   if(k>=5&&Date.now()-t0>budget)break;
  }
  let best=0;for(let i=1;i<cand.length;i++)if(wins[i]>wins[best])best=i;
  return cand[best];
 }
 // ---- 领出 ----
 lead(view,all){
  const hand=view.hand,c=counts(hand);
  // 一手能出完
  const whole=all.find(m=>m.ids.length===hand.length);if(whole)return whole;
  if(this.tier==='easy'){
   const pl=this.planner.plan(c);const gs=pl.groups.filter(g=>g.type!=='wing');
   gs.sort((a,b)=>a.main-b.main);const g=this.rng()<.25?gs[Math.floor(this.rng()*gs.length)]:gs[0];
   return this.groupMove(hand,g,all,pl)||all[0];
  }
  const R=this.roleInfo(view),unseen=unseenCounts(view,this.tier==='devil');
  const maxOpp=Math.max(...R.enemies.map(s=>view.counts[s]));
  const pl=this.planner.plan(c),gs=pl.groups.filter(g=>g.type!=='wing');
  const info=gs.map(g=>{const m=this.groupMove(hand,g,all,pl);return m?{g,m,boss:!canBeBeaten(m.p,unseen,maxOpp)}:null}).filter(Boolean);
  if(!info.length)return all[0];
  const weak=info.filter(x=>!x.boss),boss=info.filter(x=>x.boss);
  // 只剩一手非必胜：先出必胜的保住出牌权，最后再出那一手
  if(weak.length<=1&&boss.length){const b=boss.filter(x=>x.m.p.type!=='bomb'&&x.m.p.type!=='rocket');return (b[0]||boss[0]).m}
  // 屠夫：队友只剩一张，而且队友就是下家 → 送一张最小的单牌
  if(!R.isL&&R.mate===R.next&&view.counts[R.mate]===1){const s=all.filter(m=>m.p.type==='single').sort((a,b)=>a.p.main-b.p.main)[0];if(s)return s}
  if(!R.isL&&R.mate===R.next&&view.counts[R.mate]===2){const s=all.filter(m=>m.p.type==='pair').sort((a,b)=>a.p.main-b.p.main)[0];if(s)return s}
  let pool=weak.length?weak:info;
  // 敌方只剩 1 张：别出小单张；剩 2 张：别出小对子
  if(R.enemyMin===1){const safe=pool.filter(x=>x.m.p.type!=='single');if(safe.length)pool=safe;else return pool.slice().sort((a,b)=>b.m.p.main-a.m.p.main)[0].m}
  if(R.enemyMin===2){const safe=pool.filter(x=>x.m.p.type!=='pair');if(safe.length)pool=safe}
  // 优先出能带走更多牌的小组合（连牌、飞机、三带），再出小单、小对
  const order=x=>{const p=x.m.p;const multi=['straight','pairs','plane','plane1','plane2','triple1','triple2','triple'].includes(p.type);return (multi&&p.main<=12?-6:0)+p.main*1.0-x.m.ids.length*.15+(p.type==='bomb'||p.type==='rocket'?50:0)};
  pool=pool.slice().sort((a,b)=>order(a)-order(b));
  return pool[0].m;
 }
 // 把拆牌结果里的一组变成具体出牌（飞机、三张带上最合适的翅膀）
 groupMove(hand,g,all,pl){
  const key=vs=>vs.slice().sort((a,b)=>a-b).join(',');
  if(g.type==='plane'){
   const wings=pl.groups.filter(x=>x.type==='wing'||x.type==='single'||x.type==='pair');
   const singles=wings.filter(x=>x.vals.length===1&&x.main<14).sort((a,b)=>a.main-b.main),pairs=wings.filter(x=>x.vals.length===2&&x.main<14).sort((a,b)=>a.main-b.main);
   let vs=g.vals.slice();
   if(singles.length>=g.len)vs=vs.concat(singles.slice(0,g.len).map(x=>x.main));else if(pairs.length>=g.len)vs=vs.concat(...pairs.slice(0,g.len).map(x=>x.vals));
   const m=all.find(x=>key(x.vals)===key(vs));if(m)return m;
  }
  return all.find(x=>key(x.vals)===key(g.vals))||all.find(x=>x.p.type===g.type&&x.p.main===g.main&&x.p.len===g.len);
 }
 // ---- 跟牌 ----
 follow(view,all){
  const hand=view.hand,last=view.last,prev=last.p;
  if(!all.length)return null;
  const finish=all.find(m=>m.ids.length===hand.length);if(finish)return finish;
  const R=this.roleInfo(view);
  if(this.tier==='easy'){
   const normal=all.filter(m=>m.p.type!=='bomb'&&m.p.type!=='rocket');
   if(!R.isL&&last.seat===R.mate&&this.rng()<.85)return null;
   if(normal.length&&this.rng()<.82)return normal[0];
   if(!normal.length&&R.enemyMin<=3&&this.rng()<.6)return all[0];
   return null;
  }
  const c=counts(hand),base=this.planner.plan(c).score;
  const devil=this.tier==='devil',unseen=unseenCounts(view,devil);
  const fromMate=!R.isL&&last.seat===R.mate;
  const evals=all.map(m=>{const r=c.slice();for(const id of m.ids)r[val(id)]--;const pl=this.planner.plan(r);return {m,pl,delta:pl.score-(base-12),bomb:m.p.type==='bomb'||m.p.type==='rocket'}});
  // 队友出的牌：一般让队友走；只有自己能马上走完，或者地主就在下家且队友的牌太小时才接
  if(fromMate){
   const twoHands=evals.filter(e=>!e.bomb&&e.pl.hands<=1);if(twoHands.length)return twoHands[0].m;
   const landlordNext=R.next===R.L;
   if(landlordNext&&view.counts[R.L]<=2&&prev.type==='single'&&prev.main<14){const big=evals.filter(e=>!e.bomb).sort((a,b)=>b.m.p.main-a.m.p.main)[0];if(big)return big.m}
   return null;
  }
  // 危险：下一个出牌的是敌人且快走完了 → 尽力压住（单张用最大的）
  const nextIsEnemy=R.enemies.includes(R.next),danger=R.enemyMin<=2||(nextIsEnemy&&view.counts[R.next]<=3);
  const normal=evals.filter(e=>!e.bomb).sort((a,b)=>a.delta-b.delta||a.m.p.main-b.m.p.main);
  if(danger&&normal.length){
   if((prev.type==='single'||prev.type==='pair')&&R.enemyMin<=prev.size+1){return normal.slice().sort((a,b)=>b.m.p.main-a.m.p.main)[0].m}
   return normal[0].m;
  }
  let allow=R.isL?7:5.5;
  // 屠夫：我就在地主前面（地主是下家）、队友已经不要了 → 必须顶住
  if(!R.isL&&last.seat===R.L&&R.next===R.L)allow+=1.5;
  // 早期别轻易用 2 和王压小牌
  const early=Math.min(...R.enemies.map(s=>view.counts[s]))>=9;
  for(const e of normal){if(early&&e.m.p.main>=15&&prev.main<=11)e.delta+=devil?7:5;if(early&&e.m.p.main===14&&prev.main<=9&&prev.type==='single')e.delta+=2}
  normal.sort((a,b)=>a.delta-b.delta||a.m.p.main-b.m.p.main);
  if(normal.length&&normal[0].delta<=allow){
   return normal[0].m;
  }
  // 炸弹：敌人快走完，或者炸完自己也快走完
  const bombs=evals.filter(e=>e.bomb).sort((a,b)=>a.m.p.main-b.m.p.main);
  if(bombs.length){const b=bombs[0];if(R.enemyMin<=(devil?6:4)||b.pl.hands<=(devil?2:1)||(R.isL&&last.p.type!=='single'&&R.enemyMin<=8&&devil))return b.m}
  return null;
 }
}

// ---- 推演工具 ----
function sampleWorld(view,rng){
 const me=view.seat,mine=new Set(view.hand),played=new Set(view.played);
 let pool=[];for(let id=0;id<54;id++)if(!mine.has(id)&&!played.has(id))pool.push(id);
 const hands=[[],[],[]];hands[me]=view.hand.slice();
 // 地主手里一定还有没出过的底牌（底牌是公开的）
 if(view.landlord!==me&&view.bottom){const forced=view.bottom.filter(id=>!played.has(id)&&!mine.has(id));hands[view.landlord].push(...forced);const f=new Set(forced);pool=pool.filter(id=>!f.has(id))}
 shuffle(pool,rng);
 for(const s of [0,1,2])if(s!==me){const need=view.counts[s]-hands[s].length;hands[s].push(...pool.splice(0,need))}
 return hands;
}
function gameFrom(view,hands){
 const g=new Game({first:view.first});const me=view.seat;
 Object.assign(g,{phase:'play',hands:hands.map(h=>h.slice().sort(byDesc)),landlord:view.landlord,turn:me,base:view.base,mult:view.mult,multParts:view.multParts.slice(),
  last:view.last?{seat:view.last.seat,ids:view.last.ids.slice(),p:view.last.p}:null,passes:view.last?((me-view.last.seat+3)%3)-1:0,
  plays:view.plays.slice(),played:view.played.slice(),trick:[null,null,null],history:[],bottom:(view.bottom||[]).slice(),bids:view.bids.slice(),result:null,events:[]});
 return g;
}
const ROLL={planner:new Planner(),ais:null};
function rollout(view,hands,action,me){
 const g=gameFrom(view,hands);
 if(!ROLL.ais){ROLL.ais=[0,1,2].map(()=>{const a=new AI('smart',createRng(1));a.planner=ROLL.planner;a.rollout=true;return a})}
 let r=g.act(me,action);if(!r.ok)return false;let guard=0;
 while(g.phase!=='end'&&guard++<120){const s=g.turn;r=g.act(s,ROLL.ais[s].decide(g.view(s)));if(!r.ok)return false;if(g.events.length>40)g.events=[]}
 if(g.phase!=='end')return false;
 const L=g.result.landlord;return (me===L)===g.result.landlordWin;
}

const api={RANK,SUITS,SUIT_NAME,TYPE_NAME,TIERS,TIER_NAME,val,suitOf,rankName,byDesc,byAsc,counts,createRng,shuffle,patterns,beats,pick,describe,arrange,moves,hints,Planner,Game,AI,filterEvent,unseenCounts,canBeBeaten};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PigDdzCore=api;
})(typeof window!=='undefined'?window:globalThis);
