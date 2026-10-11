/* 猪猪轮盘 · 规则核心（不碰 DOM）
   - 唯一的规则状态都在 Game 里；UI 只播放 act() 返回的事件。
   - 随机源可注入（测试用固定种子），装填时只洗牌一次。
   - AI 只拿 publicView()：血量、背包、真假数量、已公开位置、强化与泥巴状态，拿不到隐藏队列与随机种子。 */
(function(root){
'use strict';
const ITEMS=['book','xray','feed','meat','mud','plunger'];
const ITEM_INFO={
 book:{name:'魔法书',short:'看下一发',desc:'变身魔法猪，公开紧接着的一发是真是假。'},
 xray:{name:'X 光',short:'任选位置',desc:'选择剩余弹药的任意位置，扫描并公开真假。'},
 feed:{name:'饲料',short:'下一真屎×2',desc:'吃饲料放屁压缩猪猪枪：下一发实际射出的真屎伤害翻倍。强化跟着枪，双方共用，不可叠加。'},
 meat:{name:'肉',short:'回 1 血',desc:'加一滴血，不超过上限；满血时不能使用。'},
 mud:{name:'泥巴',short:'跳过对手回合',desc:'困住对手，跳过它下一次本应获得的回合。不能叠加，每批弹药每只猪最多用一次。'},
 plunger:{name:'马桶搋子',short:'吸出当前一发',desc:'吸出当前这一发并公开真假，不结束回合。'}
};
const MAX_HP=4,MAX_ITEMS=8,WIN_ROUNDS=2;

// 小而稳定的种子随机数（mulberry32）。
function createRng(seed){let a=(seed>>>0)||0x9e3779b9;return function(){a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const pick=(rng,n)=>Math.min(n-1,Math.floor(rng()*n));
function shuffle(list,rng){for(let i=list.length-1;i>0;i--){const j=pick(rng,i+1);const t=list[i];list[i]=list[j];list[j]=t}return list}

class Game{
 constructor(opts){
  opts=opts||{};this.rng=opts.rng||Math.random;this.maxHp=MAX_HP;this.maxItems=MAX_ITEMS;
  this.wins=[0,0];this.round=0;this.firstPlayer=-1;this.phase='play';this.winner=-1;this.roundWinner=-1;this.scored=false;
  this.events=[];this.startRound();
 }
 // ---- 局与装填 ----
 startRound(){
  this.round++;
  this.firstPlayer=this.round===1?pick(this.rng,2):1-this.firstPlayer;
  this.hp=[MAX_HP,MAX_HP];this.items=[[],[]];this.mag=[];this.known=[];
  this.boosted=false;this.mud=[false,false];this.mudUsed=[false,false];this.batch=0;
  this.turn=this.firstPlayer;this.phase='play';this.roundWinner=-1;
  this.emit({type:'round',round:this.round,first:this.turn,wins:this.wins.slice()});
  this.load();
  this.emit({type:'turn',player:this.turn});
 }
 load(){
  const total=2+pick(this.rng,7),real=1+pick(this.rng,total-1),mag=[];
  for(let i=0;i<total;i++)mag.push(i<real?'real':'fake');
  this.mag=shuffle(mag,this.rng);this.known=this.mag.map(()=>null);this.batch++;this.mudUsed=[false,false];
  const gained=[[],[]];
  for(const p of [0,1])for(let k=0;k<2;k++){if(this.items[p].length>=MAX_ITEMS)break;const it=ITEMS[pick(this.rng,ITEMS.length)];this.items[p].push(it);gained[p].push(it)}
  this.emit({type:'load',batch:this.batch,total,real,fake:total-real,gained,boosted:this.boosted});
 }
 // 测试钩子：换成指定的弹药队列（同时清空公开线索）。
 _setMagazine(list){this.mag=list.slice();this.known=this.mag.map(()=>null)}
 emit(e){this.events.push(e);return e}
 get realLeft(){return this.mag.filter(s=>s==='real').length}
 get fakeLeft(){return this.mag.length-this.realLeft}

 // ---- 公开局面（AI 与界面共用，不含隐藏队列）----
 publicView(me){
  if(me===undefined)me=this.turn;
  return {me,turn:this.turn,phase:this.phase,hp:this.hp.slice(),maxHp:MAX_HP,items:this.items.map(a=>a.slice()),maxItems:MAX_ITEMS,
   real:this.realLeft,fake:this.fakeLeft,total:this.mag.length,known:this.known.slice(),boosted:this.boosted,mud:this.mud.slice(),mudUsed:this.mudUsed.slice(),wins:this.wins.slice(),round:this.round,batch:this.batch};
 }

 // 检查一个行动能否执行；不改变任何状态。返回 null 或中文原因。
 check(player,action){
  if(this.phase!=='play')return this.phase==='matchOver'?'整场已经结束，按“再来一场”重新开始。':'这一局已经结束，等待下一局开始。';
  if(player!==this.turn)return '还没轮到这只小猪。';
  if(!action||(action.type!=='shoot'&&action.type!=='item'))return '不认识的行动。';
  if(action.type==='shoot'){if(action.target!=='self'&&action.target!=='opp')return '请选择对自己或对对手开枪。';return null}
  const it=action.item,bag=this.items[player];
  if(!ITEM_INFO[it])return '不认识的道具。';
  if(!bag.includes(it))return '背包里没有'+ITEM_INFO[it].name+'。';
  const opp=1-player;
  if(it==='book'&&this.known[0])return '下一发已经公开过了，不用浪费魔法书。';
  if(it==='xray'){const i=action.index;if(!Number.isInteger(i)||i<0||i>=this.mag.length)return '请选择要扫描的弹药位置。';if(this.known[i])return '第 '+(i+1)+' 发已经公开过了，换一个位置吧。'}
  if(it==='feed'&&this.boosted)return '猪猪枪已经压缩强化过了，饲料不能叠加。';
  if(it==='meat'&&this.hp[player]>=MAX_HP)return '血量已满，肉留着以后吃。';
  if(it==='mud'){if(this.mud[opp])return '对手已经被泥巴困住了，不能叠加。';if(this.mudUsed[player])return '这批弹药里已经扔过泥巴了，下次装填后再用。'}
  return null;
 }
 // 执行行动。非法行动：{ok:false,reason}，状态完全不变。合法：{ok:true,events}
 act(player,action){
  const reason=this.check(player,action);if(reason)return {ok:false,reason};
  this.events=[];
  if(action.type==='shoot')this.shoot(player,action.target);else this.useItem(player,action);
  return {ok:true,events:this.events};
 }
 useItem(p,action){
  const it=action.item,bag=this.items[p],opp=1-p;bag.splice(bag.indexOf(it),1);
  const e=this.emit({type:'item',by:p,item:it});
  if(it==='book'){this.known[0]=this.mag[0];Object.assign(e,{pos:0,shell:this.mag[0]})}
  else if(it==='xray'){const i=action.index;this.known[i]=this.mag[i];Object.assign(e,{pos:i,shell:this.mag[i]})}
  else if(it==='feed'){this.boosted=true}
  else if(it==='meat'){this.hp[p]++;e.hp=this.hp[p]}
  else if(it==='mud'){this.mud[opp]=true;this.mudUsed[p]=true;e.target=opp}
  else if(it==='plunger'){const shell=this.mag.shift();this.known.shift();Object.assign(e,{pos:0,shell,boosted:this.boosted});if(!this.mag.length)this.load()}
 }
 shoot(p,target){
  const shell=this.mag.shift();this.known.shift();const victim=target==='self'?p:1-p;
  const boosted=this.boosted,damage=shell==='real'?(boosted?2:1):0;
  if(shell==='real')this.boosted=false; // 只有真正射出的真屎才消耗强化
  if(damage)this.hp[victim]=Math.max(0,this.hp[victim]-damage);
  this.emit({type:'shoot',by:p,target,victim,shell,damage,boosted:boosted&&shell==='real',hp:this.hp.slice()});
  if(this.hp[victim]<=0){this.endRound(1-victim);return}
  // 先按这次行动确定回合归属，再处理装填
  const keep=target==='self'&&shell==='fake';
  if(!keep)this.passTurn();
  if(!this.mag.length)this.load();
  this.emit({type:'turn',player:this.turn});
 }
 passTurn(){
  const next=1-this.turn;
  if(this.mud[next]){this.mud[next]=false;this.emit({type:'skip',player:next});return}
  this.turn=next;
 }
 endRound(winner){
  this.phase='roundOver';this.roundWinner=winner;this.wins[winner]++;
  this.emit({type:'roundEnd',winner,wins:this.wins.slice()});
  if(this.wins[winner]>=WIN_ROUNDS&&!this.scored){this.scored=true;this.phase='matchOver';this.winner=winner;this.emit({type:'matchEnd',winner,wins:this.wins.slice()})}
 }
 // 下一局（UI 在胜负动画后调用）。整场结束后无效。
 nextRound(){if(this.phase!=='roundOver')return null;this.events=[];this.startRound();return this.events}
}

// ---- 公开局面推算 ----
function analyze(v){
 const unknown=[];let kr=0,kf=0;
 v.known.forEach((k,i)=>{if(k==='real')kr++;else if(k==='fake')kf++;else unknown.push(i)});
 const ur=v.real-kr,uf=v.fake-kf,pUnknown=unknown.length?ur/unknown.length:0;
 const p=i=>v.known[i]==='real'?1:v.known[i]==='fake'?0:pUnknown;
 return {unknown,ur,uf,pUnknown,p,p0:v.total?p(0):0};
}

// ---- AI：悠闲 / 聪明 / 恶魔。只读公开局面 + 给定随机源 ----
function legal(v,item,extra){
 const me=v.me,opp=1-me;
 if(!v.items[me].includes(item))return false;
 if(item==='book')return !v.known[0];
 if(item==='xray')return v.known.some(k=>!k);
 if(item==='feed')return !v.boosted;
 if(item==='meat')return v.hp[me]<v.maxHp;
 if(item==='mud')return !v.mud[opp]&&!v.mudUsed[me];
 return true;
}
function chooseAction(v,rng,tier){
 rng=rng||Math.random;tier=tier||'smart';
 const me=v.me,opp=1-me,has=it=>legal(v,it),a=analyze(v),p0=a.p0,dmg=v.boosted?2:1;
 const item=(it,index)=>index===undefined?{type:'item',item:it}:{type:'item',item:it,index};
 const shoot=t=>({type:'shoot',target:t});
 if(tier==='easy'){
  const usable=ITEMS.filter(has);
  if(usable.length&&rng()<.35){const it=usable[pick(rng,usable.length)];return it==='xray'?item(it,a.unknown[pick(rng,a.unknown.length)]):item(it)}
  if(p0===1)return shoot(rng()<.85?'opp':'self');
  if(p0===0)return shoot(rng()<.7?'self':'opp');
  return shoot(rng()<.4+p0*.4?'opp':'self');
 }
 if(tier==='devil')return devilSearch(v);
 const devil=false;
 // 1) 能回血就回血
 if(has('meat')&&(devil||v.hp[me]<=v.maxHp-1))return item('meat');
 // 2) 下一发未知：先查
 if(p0>0&&p0<1){
  if(has('book'))return item('book');
  if(has('xray'))return item('xray',0);
  if(has('plunger')&&(devil?p0>=.34&&p0<=.75:p0>.3&&p0<.7))return item('plunger');
 }
 // 恶魔：下一发已知时，用 X 光提前看后面的弹药，规划下一步
 if(devil&&(p0===0||p0===1)&&a.ur>0&&a.uf>0&&v.items[me].filter(x=>x==='xray').length>1)return item('xray',a.unknown[0]);
 const goOpp=p0===1||(p0>0&&(v.boosted?p0>=.4:p0>=.5));
 if(goOpp){
  const lethal=v.hp[opp]<=dmg;
  if(!lethal&&has('feed')&&(p0===1||(devil&&p0>=.67))&&v.hp[opp]>=2)return item('feed');
  if(has('mud')&&(devil||p0>=.6||rng()<.5))return item('mud');
  return shoot('opp');
 }
 return shoot('self');
}


// 恶魔档：在公开局面上做小型期望搜索（未知弹药按剩余真假数量计算概率），只看自己连续行动的几步。
const ITEM_VALUE={book:1.6,xray:1.6,feed:1.4,meat:2.2,mud:2.2,plunger:1.3};
function cloneView(v){return {me:v.me,turn:v.turn,hp:v.hp.slice(),maxHp:v.maxHp,items:v.items.map(a=>a.slice()),real:v.real,fake:v.fake,total:v.total,known:v.known.slice(),boosted:v.boosted,mud:v.mud.slice(),mudUsed:v.mudUsed.slice()}}
function candidates(v){
 const me=v.turn,out=[{type:'shoot',target:'opp'},{type:'shoot',target:'self'}],seen=new Set();
 for(const it of v.items[me]){if(seen.has(it))continue;seen.add(it);const view=Object.assign({},v,{me});if(!legal(view,it))continue;
  if(it==='xray'){if(!v.known[0])out.push({type:'item',item:'xray',index:0});const later=v.known.findIndex((k,i)=>i>0&&!k);if(later>0)out.push({type:'item',item:'xray',index:later})}
  else out.push({type:'item',item:it})}
 return out;
}
// 某位置的可能结果：[[概率, 'real'|'fake'], ...]
function shellOdds(v,i){const k=v.known[i];if(k)return [[1,k]];const a=analyze(v);if(!a.unknown.length)return [];const p=a.pUnknown;return [[p,'real'],[1-p,'fake']].filter(x=>x[0]>0)}
function take(v,i,shell){v.known.splice(i,1);v.total--;if(shell==='real')v.real--;else v.fake--}
function outcomes(v,act){
 const me=v.turn,opp=1-me,res=[];
 if(act.type==='shoot'){for(const [p,shell] of shellOdds(v,0)){const n=cloneView(v);take(n,0,shell);const victim=act.target==='self'?me:opp;
   if(shell==='real'){n.hp[victim]=Math.max(0,n.hp[victim]-(n.boosted?2:1));n.boosted=false}
   if(!(act.target==='self'&&shell==='fake')){if(n.mud[opp])n.mud[opp]=false;else n.turn=opp}
   res.push([p,n])}return res}
 const it=act.item;
 if(it==='book'||it==='xray'){const i=act.index||0;for(const [p,shell] of shellOdds(v,i)){const n=cloneView(v);n.items[me].splice(n.items[me].indexOf(it),1);n.known[i]=shell;res.push([p,n])}return res}
 if(it==='plunger'){for(const [p,shell] of shellOdds(v,0)){const n=cloneView(v);n.items[me].splice(n.items[me].indexOf(it),1);take(n,0,shell);res.push([p,n])}return res}
 const n=cloneView(v);n.items[me].splice(n.items[me].indexOf(it),1);
 if(it==='feed')n.boosted=true;if(it==='meat')n.hp[me]++;if(it==='mud'){n.mud[opp]=true;n.mudUsed[me]=true}
 return [[1,n]];
}
function staticValue(v,me){
 const opp=1-me;if(v.hp[opp]<=0)return 1000;if(v.hp[me]<=0)return -1000;
 let s=12*(v.hp[me]-v.hp[opp]);
 for(const it of v.items[me])s+=ITEM_VALUE[it];for(const it of v.items[opp])s-=ITEM_VALUE[it];
 const p=v.total?analyze(v).p0:.5,dmg=v.boosted?2:1;
 if(v.turn===me){s+=2+12*dmg*Math.max(p,1-p)*.35;if(v.mud[opp])s+=5}
 else{s-=2+12*dmg*Math.max(p,1-p)*.6;if(v.hp[me]<=dmg&&p>0)s-=40*p}
 return s;
}
function searchValue(v,me,depth){
 if(v.hp[0]<=0||v.hp[1]<=0||v.turn!==me||depth<=0||!v.total)return staticValue(v,me);
 let best=-Infinity;for(const a of candidates(v)){const e=expectValue(v,a,me,depth);if(e>best)best=e}return best;
}
function expectValue(v,a,me,depth){let sum=0;for(const [p,n] of outcomes(v,a))sum+=p*searchValue(n,me,depth-1);return sum}
function devilSearch(v){
 const view=cloneView(v);view.turn=v.me;let best=null,score=-Infinity;
 for(const a of candidates(view)){const e=expectValue(view,a,v.me,4);if(e>score+1e-9){score=e;best=a}}
 return best||{type:'shoot',target:'opp'};
}

const api={ITEMS,ITEM_INFO,MAX_HP,MAX_ITEMS,WIN_ROUNDS,createRng,shuffle,Game,analyze,chooseAction,legal};
if(typeof module!=='undefined')module.exports=api;root.PigRouletteCore=api;
})(typeof window!=='undefined'?window:globalThis);
