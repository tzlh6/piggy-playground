/* 猪猪轮盘 · 规则核心（不碰 DOM）
   4.3：三阶段积分赛。
   - 唯一的规则状态都在 Game 里；UI 只播放 act() 返回的事件。
   - 随机源可注入（测试用固定种子）；每批弹药装好后不再洗牌。
   - 每次装填只公布一次“本批共几发、其中几发是假弹”。之后界面不再显示剩余数量。
   - 魔法书、X 光的结果是使用者的私密线索；AI 只拿 publicView()：公开记录 + 自己的线索，拿不到隐藏队列与随机源。 */
(function(root){
'use strict';
const ITEMS=['book','xray','feed','meat','rotten','mud','plunger','hoof'];
const ITEM_INFO={
 book:{name:'魔法书',short:'随机验后面一颗',desc:'翻书念咒，随机查看后面某一颗（不含下一颗），结果只有自己知道。只剩一颗时道具照样用掉，但没有有效线索。'},
 xray:{name:'X 光',short:'验下一颗',desc:'扫描猪仔肚子，查看下一颗是真弹还是假弹，结果只有自己知道。'},
 feed:{name:'饲料',short:'下一枪真弹×2',desc:'喂给发射用的小猪仔：下一次射击若是真弹，伤害×2；打出假弹也会用掉强化。不能叠加，退弹和换弹都保留强化。'},
 meat:{name:'鲜肉',short:'回 1 血',desc:'回 1 滴血，不超过血量上限。满血或濒死时不能吃。'},
 rotten:{name:'腐肉',short:'50% +2 / 50% −1',desc:'一半机会回 2 滴血，一半机会扣 1 滴血（可能因此落败）。不超过血量上限；满血或濒死时不能吃。'},
 mud:{name:'泥巴',short:'跳过对方下一回合',desc:'必中，困住对方的蹄子，跳过对方下一回合。可以连控，但上一次泥巴还没生效时不能叠加；换弹会清掉还没生效的泥巴。'},
 plunger:{name:'马桶搋子',short:'退掉当前一颗',desc:'把当前这一颗吸出来并公开真假，继续行动。强化保留。'},
 hoof:{name:'猪蹄',short:'偷对方 1 件',desc:'按件等概率随机偷走对方背包里的 1 件道具，放进自己背包，立即可用；也可能偷到另一只猪蹄。对方背包为空时不能用。'}
};
// 阶段配置：血量、开局固定道具、开局随机道具、之后每次装填补给、获胜积分、濒死格
const STAGES={
 1:{hp:2,open:[],openRandom:0,supply:0,points:1,nearDeath:0,name:'第一阶段'},
 2:{hp:4,open:['book','rotten'],openRandom:0,supply:2,points:2,nearDeath:0,name:'第二阶段'},
 3:{hp:6,open:['book','rotten'],openRandom:2,supply:4,points:3,nearDeath:2,name:'第三阶段'},
 4:{hp:6,open:['book','rotten'],openRandom:2,supply:4,points:0,nearDeath:2,name:'加赛',tiebreak:true}
};
// 固定批次：第一阶段 3 发（1 真 2 假）、5 发（3 真 2 假）；第二阶段首批 2 发（1 真 1 假）
const FIXED={'1-1':[1,3],'1-2':[3,5],'2-1':[1,2]};
// 随机补给洗牌袋：泥巴 1 件，其余七种各 2 件，共 15 件
const BAG_RECIPE=ITEMS.reduce((a,it)=>a.concat(it==='mud'?[it]:[it,it]),[]);
const MAX_ITEMS=8;

// 小而稳定的种子随机数（mulberry32）。
function createRng(seed){let a=(seed>>>0)||0x9e3779b9;return function(){a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const pick=(rng,n)=>Math.min(n-1,Math.floor(rng()*n));
function shuffle(list,rng){for(let i=list.length-1;i>0;i--){const j=pick(rng,i+1);const t=list[i];list[i]=list[j];list[j]=t}return list}

class Game{
 // opts.first：整场第一阶段先手（0/1）；不给则随机。连续再战时由界面传入上一场的反面。
 constructor(opts){
  opts=opts||{};this.rng=opts.rng||Math.random;this.maxItems=MAX_ITEMS;
  this.matchFirst=opts.first===0||opts.first===1?opts.first:pick(this.rng,2);
  this.points=[0,0];this.stage=0;this.stageWinners=[];this.phase='play';this.winner=-1;this.stageWinner=-1;this.scored=false;this.tiebreak=false;
  this.history=[];this.log=[];this.events=[];
  this.startStage(1);
 }
 get cfg(){return STAGES[this.stage]}
 firstFor(stage){return stage===2||stage===4?1-this.matchFirst:this.matchFirst}
 // ---- 阶段与装填 ----
 startStage(n){
  this.stage=n;const c=this.cfg;this.tiebreak=!!c.tiebreak;
  this.maxHp=c.hp;this.hp=[c.hp,c.hp];this.items=[[],[]];this.bags=[[],[]];
  this.boosted=false;this.mud=[false,false];this.clues=[{},{}];this.clueHist=[[],[]];this.batch=0;this.order=[];this.pos=0;this.spent=[];this.spentHow=[];this.announced={total:0,fake:0};
  this.first=this.firstFor(n);this.turn=this.first;this.phase='play';this.stageWinner=-1;
  this.history.push({stage:n,name:c.name,first:this.first,points:c.points,batches:[],winner:-1});
  this.emit({type:'stage',stage:n,name:c.name,first:this.first,hp:c.hp,points:this.points.slice(),award:c.points,tiebreak:this.tiebreak,nearDeath:c.nearDeath});
  this.record({k:'stage',stage:n,first:this.first,tiebreak:this.tiebreak});
  // 开局道具：固定道具不占洗牌袋配额，随机部分从各自的洗牌袋里抽
  const opening=[0,1].map(p=>{const got=c.open.slice();for(let k=0;k<c.openRandom;k++)got.push(this.draw(p));return got});
  this.load(opening);
  this.emit({type:'turn',player:this.turn});
 }
 draw(p){if(!this.bags[p].length)this.bags[p]=shuffle(BAG_RECIPE.slice(),this.rng);return this.bags[p].pop()}
 load(opening){
  this.batch++;const fixed=FIXED[this.stage+'-'+this.batch];let total,real;
  if(fixed){real=fixed[0];total=fixed[1]}else{total=2+pick(this.rng,7);real=1+pick(this.rng,total-1)}
  const list=[];for(let i=0;i<total;i++)list.push(i<real?'real':'fake');
  this.order=shuffle(list,this.rng);this.pos=0;this.spent=[];this.spentHow=[];this.clues=[{},{}];this.clueHist=[[],[]];this.announced={total,fake:total-real};
  // 换弹清除尚未触发的泥巴控制；已经判定的行动者不回滚
  const mudCleared=[0,1].filter(p=>this.mud[p]);this.mud=[false,false];
  const gained=[[],[]];
  for(const p of [0,1]){
   const want=opening?opening[p]:Array.from({length:this.cfg.supply},()=>null);
   for(const it of want){if(this.items[p].length>=MAX_ITEMS)break;const got=it||this.draw(p);this.items[p].push(got);gained[p].push(got)}
  }
  this.history[this.history.length-1].batches.push({order:this.order.slice(),total,fake:total-real});
  this.emit({type:'load',stage:this.stage,batch:this.batch,total,fake:total-real,gained,opening:!!opening,boosted:this.boosted,mudCleared});
  this.record({k:'load',stage:this.stage,batch:this.batch,mudCleared});
 }
 // 测试钩子：换成指定的弹药队列（同时清空线索，公布数量随之更新）。
 _setMagazine(list){this.order=list.slice();this.pos=0;this.spent=[];this.spentHow=[];this.clues=[{},{}];this.clueHist=[[],[]];this.announced={total:list.length,fake:list.filter(s=>s==='fake').length}}
 get mag(){return this.order.slice(this.pos)}
 emit(e){this.events.push(e);return e}
 record(entry){entry.stage=entry.stage||this.stage;this.log.push(entry);const h=this.history[this.history.length-1];if(h){(h.actions||(h.actions=[])).push(entry)}return entry}
 nearDeath(p){const nd=this.cfg.nearDeath;return !!nd&&this.hp[p]>0&&this.hp[p]<=nd}
 // 私密线索：相对位置 → 真假（只给本人）
 cluesOf(p){const out={};for(const k in this.clues[p]){const abs=+k;if(abs>=this.pos)out[abs-this.pos]=this.clues[p][k]}return out}
 // 本批验弹记录：条数只在换弹 / 新阶段时归零，射击和退弹不会让它变少（避免同屏时给对方暗示）。
 // 已经打出或退出的那一颗标为“已过时”。
 clueCount(p){return (this.clueHist&&this.clueHist[p]||[]).length}
 clueList(p){return (this.clueHist&&this.clueHist[p]||[]).map(c=>{const stale=c.abs<this.pos;return {item:c.item,abs:c.abs,shell:c.shell,stale,rel:stale?null:c.abs-this.pos,gone:stale?(this.spentHow[c.abs]||'shot'):null}})}

 // ---- 公开局面（AI 与界面共用，不含隐藏队列）----
 publicView(me){
  if(me===undefined)me=this.turn;
  const spentReal=this.spent.filter(s=>s==='real').length,spentFake=this.spent.length-spentReal;
  const left=this.announced.total-this.spent.length,realLeft=this.announced.total-this.announced.fake-spentReal,fakeLeft=this.announced.fake-spentFake;
  const own=this.cluesOf(me),clues=[];for(let i=0;i<left;i++)clues.push(own[i]||null);
  return {me,turn:this.turn,phase:this.phase,stage:this.stage,hp:this.hp.slice(),maxHp:this.maxHp,nearDeathCells:this.cfg.nearDeath,nearDeath:[this.nearDeath(0),this.nearDeath(1)],
   items:this.items.map(a=>a.slice()),maxItems:MAX_ITEMS,boosted:this.boosted,mud:this.mud.slice(),points:this.points.slice(),
   announced:Object.assign({},this.announced),spent:this.spent.slice(),left,realLeft,fakeLeft,clues,batch:this.batch};
 }

 // 检查一个行动能否执行；不改变任何状态。返回 null 或中文原因。
 check(player,action){
  if(this.phase!=='play')return this.phase==='matchOver'?'整场已经结束，按“再来一局”重新开始。':'这一阶段已经结束，等待下一阶段开始。';
  if(player!==this.turn)return '还没轮到这只小猪。';
  if(!action||(action.type!=='shoot'&&action.type!=='item'))return '不认识的行动。';
  if(action.type==='shoot'){if(action.target!=='self'&&action.target!=='opp')return '请选择对自己或对对手开枪。';return null}
  const it=action.item,bag=this.items[player],opp=1-player;
  if(!ITEM_INFO[it])return '不认识的道具。';
  if(!bag.includes(it))return '背包里没有'+ITEM_INFO[it].name+'。';
  if(it==='feed'&&this.boosted)return '猪仔已经吃过饲料、正在蓄力，饲料不能叠加。';
  if(it==='meat'||it==='rotten'){if(this.nearDeath(player))return '已经进入濒死格，无法回血。';if(this.hp[player]>=this.maxHp)return '血量已满，'+ITEM_INFO[it].name+'留着以后吃。'}
  if(it==='mud'&&this.mud[opp])return '对方已经被泥巴困住，这次控制还没生效，不能叠加。';
  if(it==='hoof'&&!this.items[opp].length)return '对方背包是空的，没东西可偷。猪蹄不会被用掉。';
  return null;
 }
 // 执行行动。非法行动：{ok:false,reason}，状态完全不变。合法：{ok:true,events}
 act(player,action){
  const reason=this.check(player,action);if(reason)return {ok:false,reason};
  this.events=[];
  if(action.type==='shoot')this.shoot(player,action.target);else this.useItem(player,action.item);
  return {ok:true,events:this.events};
 }
 damage(victim,dmg){
  const before=this.hp[victim],wasNear=this.nearDeath(victim);
  this.hp[victim]=wasNear?0:Math.max(0,before-dmg);
  const entered=!wasNear&&this.nearDeath(victim);
  if(entered)this.record({k:'nearDeath',p:victim});
  return {before,after:this.hp[victim],wasNear,entered,lethal:this.hp[victim]<=0};
 }
 useItem(p,it){
  const bag=this.items[p],opp=1-p;bag.splice(bag.indexOf(it),1);
  const e=this.emit({type:'item',by:p,item:it});
  if(it==='book'){
   const later=[];for(let i=this.pos+1;i<this.order.length;i++)later.push(i);
   if(!later.length){e.private={none:true};}
   else{const fresh=later.filter(i=>!this.clues[p][i]),from=fresh.length?fresh:later,abs=from[pick(this.rng,from.length)];this.clues[p][abs]=this.order[abs];this.clueHist[p].push({item:it,abs,shell:this.order[abs]});e.private={rel:abs-this.pos,shell:this.order[abs]}}
   this.record({k:'item',by:p,item:it});
  }else if(it==='xray'){
   const abs=this.pos;this.clues[p][abs]=this.order[abs];this.clueHist[p].push({item:it,abs,shell:this.order[abs]});e.private={rel:0,shell:this.order[abs]};this.record({k:'item',by:p,item:it});
  }else if(it==='feed'){this.boosted=true;this.record({k:'item',by:p,item:it})}
  else if(it==='meat'){this.hp[p]=Math.min(this.maxHp,this.hp[p]+1);e.hp=this.hp[p];e.delta=1;this.record({k:'item',by:p,item:it,delta:1,hp:this.hp[p]})}
  else if(it==='rotten'){
   const good=this.rng()<.5;e.outcome=good?'heal':'hurt';
   if(good){const before=this.hp[p];this.hp[p]=Math.min(this.maxHp,before+2);e.delta=this.hp[p]-before}
   else{const d=this.damage(p,1);e.delta=-1;Object.assign(e,{entered:d.entered,lethal:d.lethal})}
   e.hp=this.hp[p];this.record({k:'item',by:p,item:it,outcome:e.outcome,delta:e.delta,hp:this.hp[p]});
   if(this.hp[p]<=0){this.endStage(opp);return}
  }
  else if(it==='mud'){this.mud[opp]=true;e.target=opp;this.record({k:'item',by:p,item:it,target:opp})}
  else if(it==='plunger'){
   const shell=this.order[this.pos];this.pos++;this.spent.push(shell);this.spentHow.push('pop');Object.assign(e,{shell,boosted:this.boosted});
   this.record({k:'item',by:p,item:it,shell});
   if(this.pos>=this.order.length){this.load();this.emit({type:'turn',player:this.turn})}
  }
  else if(it==='hoof'){
   const ob=this.items[opp],k=pick(this.rng,ob.length),stolen=ob.splice(k,1)[0];bag.push(stolen);
   Object.assign(e,{target:opp,stolen,slot:k});this.record({k:'item',by:p,item:it,target:opp,stolen});
  }
 }
 shoot(p,target){
  const shell=this.order[this.pos];this.pos++;this.spent.push(shell);this.spentHow.push('shot');
  const victim=target==='self'?p:1-p,boosted=this.boosted;
  this.boosted=false; // 强化射击无论真假都消耗
  let dmg=0,d=null;if(shell==='real'){dmg=boosted?2:1;d=this.damage(victim,dmg)}
  const lost=d?d.before-d.after:0,finisher=!!(d&&d.wasNear);
  this.emit({type:'shoot',by:p,target,victim,shell,damage:dmg,lost,finisher,boosted,hp:this.hp.slice(),entered:!!(d&&d.entered),lethal:!!(d&&d.lethal),nearDeath:[this.nearDeath(0),this.nearDeath(1)]});
  this.record({k:'shoot',by:p,target,victim,shell,boosted,damage:dmg,lost,finisher,hp:this.hp.slice()});
  if(this.hp[victim]<=0){this.endStage(1-victim);return}
  // 先按这次行动确定行动者，再处理换弹
  if(!(target==='self'&&shell==='fake'))this.passTurn();
  if(this.pos>=this.order.length)this.load();
  this.emit({type:'turn',player:this.turn});
 }
 passTurn(){
  const next=1-this.turn;
  if(this.mud[next]){this.mud[next]=false;this.emit({type:'skip',player:next});this.record({k:'skip',p:next});return}
  this.turn=next;
 }
 endStage(winner){
  this.phase='stageOver';this.stageWinner=winner;const award=this.cfg.points;this.points[winner]+=award;this.stageWinners.push(winner);
  this.history[this.history.length-1].winner=winner;
  this.emit({type:'stageEnd',stage:this.stage,winner,award,points:this.points.slice(),tiebreak:this.tiebreak});
  this.record({k:'stageEnd',winner,award,points:this.points.slice()});
  const last=this.stage>=3;
  if(last&&!this.scored){
   if(this.stage===3&&this.points[0]===this.points[1]){this.emit({type:'tiebreak',points:this.points.slice()});this.record({k:'tiebreak'});return}
   this.scored=true;this.phase='matchOver';this.winner=this.stage===4?winner:(this.points[0]>this.points[1]?0:1);
   this.emit({type:'matchEnd',winner:this.winner,points:this.points.slice(),tiebreak:this.stage===4});
   this.record({k:'matchEnd',winner:this.winner,points:this.points.slice(),tiebreak:this.stage===4});
  }
 }
 // 下一阶段（UI 在阶段演出后调用）。整场结束后无效。
 nextStage(){if(this.phase!=='stageOver')return null;this.events=[];this.startStage(this.stage+1);return this.events}
}

// ================= AI：只读公开局面 + 自己的线索 =================
function analyze(v){
 const n=Math.max(0,v.left|0),clues=v.clues||[];let kr=0,kf=0;const unknown=[];
 for(let i=0;i<n;i++){const k=clues[i];if(k==='real')kr++;else if(k==='fake')kf++;else unknown.push(i)}
 const ur=Math.max(0,v.realLeft-kr),uf=Math.max(0,v.fakeLeft-kf),pUnknown=unknown.length?Math.min(1,ur/unknown.length):0;
 const p=i=>clues[i]==='real'?1:clues[i]==='fake'?0:pUnknown;
 return {n,unknown,ur,uf,pUnknown,p,p0:n?p(0):0,unknownLater:unknown.filter(i=>i>0).length};
}
function legal(v,item){
 const me=v.me,opp=1-me;
 if(!v.items[me].includes(item))return false;
 if(item==='feed')return !v.boosted;
 if(item==='meat'||item==='rotten')return v.hp[me]<v.maxHp&&!v.nearDeath[me];
 if(item==='mud')return !v.mud[opp];
 if(item==='hoof')return v.items[opp].length>0;
 return true;
}
const ITEM_VALUE={book:1.2,xray:1.6,feed:1.4,meat:2,rotten:1.1,mud:2,plunger:1.3,hoof:1.5};
function chooseAction(v,rng,tier){
 rng=rng||Math.random;tier=tier||'smart';
 const me=v.me,opp=1-me,has=it=>legal(v,it),a=analyze(v),p0=a.p0,dmg=v.boosted?2:1;
 const item=it=>({type:'item',item:it}),shoot=t=>({type:'shoot',target:t});
 if(tier==='easy'){
  const usable=ITEMS.filter(has);
  if(usable.length&&rng()<.35)return item(usable[pick(rng,usable.length)]);
  // 悠闲猪猪记性一般：只看自己的线索，数量凭感觉
  const guess=v.clues[0]==='real'?1:v.clues[0]==='fake'?0:.5;
  if(guess===1)return shoot(rng()<.85?'opp':'self');
  if(guess===0)return shoot(rng()<.7?'self':'opp');
  return shoot(rng()<.55?'opp':'self');
 }
 if(tier==='devil')return devilSearch(v);
 // ---- 聪明档 ----
 if(has('hoof')&&v.items[opp].some(it=>it!=='hoof'||v.items[opp].length>1))return item('hoof');
 if(has('meat')&&v.hp[me]<=v.maxHp-1)return item('meat');
 if(has('rotten')&&v.hp[me]<=v.maxHp-2&&v.hp[me]>=2)return item('rotten');
 if(p0>0&&p0<1){
  if(has('xray'))return item('xray');
  if(has('book')&&a.unknownLater>0)return item('book');
  if(has('plunger')&&p0>.3&&p0<.7)return item('plunger');
 }
 if(p0===0&&v.boosted&&has('plunger'))return item('plunger'); // 已知假弹：退掉它，强化留给真弹
 const goOpp=p0===1||(p0>0&&p0>=.5);
 if(goOpp){
  const lethal=v.nearDeath[opp]||v.hp[opp]<=dmg;
  if(!lethal&&has('feed')&&(p0===1||p0>=.67))return item('feed');
  if(has('mud')&&(p0===1||p0>=.6))return item('mud');
  return shoot('opp');
 }
 return shoot('self');
}

// ---- 恶魔档：在公开局面 + 自己的线索上做小型期望搜索，只看自己连续行动的几步 ----
function toState(v){return {me:v.me,turn:v.me,hp:v.hp.slice(),maxHp:v.maxHp,nd:v.nearDeathCells||0,items:v.items.map(x=>x.slice()),clues:v.clues.slice(),r:v.realLeft,f:v.fakeLeft,boosted:v.boosted,mud:v.mud.slice()}}
function cloneS(s){return {me:s.me,turn:s.turn,hp:s.hp.slice(),maxHp:s.maxHp,nd:s.nd,items:s.items.map(x=>x.slice()),clues:s.clues.slice(),r:s.r,f:s.f,boosted:s.boosted,mud:s.mud.slice()}}
const near=(s,p)=>!!s.nd&&s.hp[p]>0&&s.hp[p]<=s.nd;
function sView(s){return {me:s.turn,hp:s.hp,maxHp:s.maxHp,nearDeath:[near(s,0),near(s,1)],items:s.items,boosted:s.boosted,mud:s.mud,left:s.clues.length,realLeft:s.r,fakeLeft:s.f,clues:s.clues}}
function odds(s,i){const k=s.clues[i];if(k)return [[1,k]];const a=analyze(sView(s));if(!a.unknown.length)return [];const p=a.pUnknown;return [[p,'real'],[1-p,'fake']].filter(x=>x[0]>0)}
function takeAt(s,i,shell){s.clues.splice(i,1);if(shell==='real')s.r--;else s.f--}
function hurt(s,v,d){s.hp[v]=near(s,v)?0:Math.max(0,s.hp[v]-d)}
function use(s,it){const b=s.items[s.turn];b.splice(b.indexOf(it),1)}
function sCandidates(s){
 const v=sView(s),out=[{type:'shoot',target:'opp'},{type:'shoot',target:'self'}],seen=new Set();
 for(const it of s.items[s.turn]){if(seen.has(it))continue;seen.add(it);if(legal(v,it))out.push({type:'item',item:it})}
 return out;
}
function outcomes(s,act){
 const me=s.turn,opp=1-me,res=[];
 if(act.type==='shoot'){for(const [p,shell] of odds(s,0)){const n=cloneS(s);takeAt(n,0,shell);const victim=act.target==='self'?me:opp;
   if(shell==='real')hurt(n,victim,n.boosted?2:1);n.boosted=false;
   if(!(act.target==='self'&&shell==='fake')){if(n.mud[opp])n.mud[opp]=false;else n.turn=opp}
   res.push([p,n])}return res}
 const it=act.item;
 if(it==='xray'){for(const [p,shell] of odds(s,0)){const n=cloneS(s);use(n,it);n.clues[0]=shell;res.push([p,n])}return res}
 if(it==='book'){const i=s.clues.findIndex((k,j)=>j>0&&!k);if(i<0){const n=cloneS(s);use(n,it);return [[1,n]]}
  for(const [p,shell] of odds(s,i)){const n=cloneS(s);use(n,it);n.clues[i]=shell;res.push([p,n])}return res}
 if(it==='plunger'){for(const [p,shell] of odds(s,0)){const n=cloneS(s);use(n,it);takeAt(n,0,shell);res.push([p,n])}return res}
 if(it==='rotten'){const a=cloneS(s);use(a,it);a.hp[me]=Math.min(a.maxHp,a.hp[me]+2);const b=cloneS(s);use(b,it);hurt(b,me,1);return [[.5,a],[.5,b]]}
 if(it==='hoof'){const ob=s.items[opp],kinds={};ob.forEach(x=>kinds[x]=(kinds[x]||0)+1);
  for(const k in kinds){const n=cloneS(s);use(n,it);const o=n.items[opp];o.splice(o.indexOf(k),1);n.items[me].push(k);res.push([kinds[k]/ob.length,n])}return res}
 const n=cloneS(s);use(n,it);
 if(it==='feed')n.boosted=true;if(it==='meat')n.hp[me]=Math.min(n.maxHp,n.hp[me]+1);if(it==='mud')n.mud[opp]=true;
 return [[1,n]];
}
function staticValue(s,me){
 const opp=1-me;if(s.hp[opp]<=0)return 1000;if(s.hp[me]<=0)return -1000;
 let v=12*(s.hp[me]-s.hp[opp]);if(near(s,me))v-=10;if(near(s,opp))v+=10;
 for(const it of s.items[me])v+=ITEM_VALUE[it];for(const it of s.items[opp])v-=ITEM_VALUE[it];
 const n=s.clues.length,p=n?analyze(sView(s)).p0:.5,dmg=s.boosted?2:1;
 if(s.turn===me){v+=2+12*dmg*Math.max(p,1-p)*.35;if(s.mud[opp])v+=5}
 else{v-=2+12*dmg*Math.max(p,1-p)*.6;if((s.hp[me]<=dmg||near(s,me))&&p>0)v-=40*p}
 return v;
}
function searchValue(s,me,depth){
 if(s.hp[0]<=0||s.hp[1]<=0||s.turn!==me||depth<=0||!s.clues.length)return staticValue(s,me);
 let best=-Infinity;for(const a of sCandidates(s)){const e=expectValue(s,a,me,depth);if(e>best)best=e}return best;
}
function expectValue(s,a,me,depth){let sum=0;for(const [p,n] of outcomes(s,a))sum+=p*searchValue(n,me,depth-1);return sum}
function devilSearch(v){
 const s=toState(v);let best=null,score=-Infinity;
 if(!s.clues.length)return {type:'shoot',target:'opp'};
 for(const a of sCandidates(s)){const e=expectValue(s,a,v.me,3);if(e>score+1e-9){score=e;best=a}}
 return best||{type:'shoot',target:'opp'};
}

const api={ITEMS,ITEM_INFO,STAGES,FIXED,BAG_RECIPE,MAX_ITEMS,createRng,shuffle,Game,analyze,chooseAction,legal};
if(typeof module!=='undefined')module.exports=api;root.PigRouletteCore=api;
})(typeof window!=='undefined'?window:globalThis);
