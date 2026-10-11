// 猪猪轮盘规则测试：node test-roulette.cjs
const assert=require('assert');
const R=require('./app/roulette-core.js');
const {Game,createRng,chooseAction}=R;
const snap=g=>JSON.stringify({hp:g.hp,items:g.items,mag:g.mag,known:g.known,boosted:g.boosted,mud:g.mud,mudUsed:g.mudUsed,turn:g.turn,wins:g.wins,phase:g.phase,round:g.round,batch:g.batch});
// 一个摆好的局面：当前玩家 p0，指定弹药与背包。
function setup(mag,items0,items1,seed){const g=new Game({rng:createRng(seed||7)});g.turn=0;g._setMagazine(mag);g.items=[items0||[],items1||[]];g.hp=[4,4];g.boosted=false;g.mud=[false,false];g.mudUsed=[false,false];return g}
let checks=0;const ok=(c,m)=>{assert.ok(c,m);checks++};

// ---- 四种开枪结果 ----
{let g=setup(['fake','real','real']);let r=g.act(0,{type:'shoot',target:'self'});ok(r.ok&&g.hp[0]===4&&g.turn===0,'自己假屎：不扣血、继续');
 r=g.act(0,{type:'shoot',target:'self'});ok(g.hp[0]===3&&g.turn===1,'自己真屎：扣血、换手');
 g=setup(['fake','real']);g.act(0,{type:'shoot',target:'opp'});ok(g.hp[1]===4&&g.turn===1,'对手假屎：不扣血、换手');
 g=setup(['real','fake']);g.act(0,{type:'shoot',target:'opp'});ok(g.hp[1]===3&&g.turn===1,'对手真屎：扣血、换手');
 // 自己假屎后仍可用道具与开枪
 g=setup(['fake','fake','real'],['meat','book']);g.hp[0]=3;g.act(0,{type:'shoot',target:'self'});ok(g.act(0,{type:'item',item:'meat'}).ok&&g.hp[0]===4,'假屎后可继续用道具');}

// ---- 强化：双倍自伤，跨假屎 / 退弹 / 装填保留 ----
{let g=setup(['real','fake'],['feed']);g.act(0,{type:'item',item:'feed'});ok(g.boosted,'饲料强化');g.act(0,{type:'shoot',target:'self'});ok(g.hp[0]===2&&!g.boosted&&g.turn===1,'强化真屎自伤 2 并消耗');
 g=setup(['fake','fake','real','real'],['feed','plunger']);g.act(0,{type:'item',item:'feed'});g.act(0,{type:'shoot',target:'self'});ok(g.boosted,'假屎不消耗强化');
 g.act(0,{type:'item',item:'plunger'});ok(g.boosted&&g.mag.length===2,'退弹不消耗强化');
 g.act(0,{type:'shoot',target:'opp'});ok(g.hp[1]===2&&!g.boosted,'强化真屎打对手 2');
 // 强化跨装填，对手也能用
 g=setup(['fake'],['feed','plunger']);g.act(0,{type:'item',item:'feed'});const batch=g.batch;g.act(0,{type:'item',item:'plunger'});ok(g.batch===batch+1&&g.boosted&&g.turn===0,'吸出最后一发：装填，强化保留，不换手');
 g=setup(['fake','real'],['feed']);g.act(0,{type:'item',item:'feed'});g.act(0,{type:'shoot',target:'opp'});ok(g.turn===1&&g.boosted,'强化跟着枪交给对手');g.act(1,{type:'shoot',target:'opp'});ok(g.hp[0]===2&&!g.boosted,'对手用共用强化打出 2');
 g=setup(['fake'],['feed']);g.act(0,{type:'item',item:'feed'});g.act(0,{type:'shoot',target:'self'});ok(g.boosted&&g.turn===0&&g.mag.length>=2,'假屎打空后重新装填仍保留强化');
 g=setup(['real','real'],['feed','feed']);g.act(0,{type:'item',item:'feed'});const before=snap(g);const r=g.act(0,{type:'item',item:'feed'});ok(!r.ok&&snap(g)===before,'饲料不能叠加且无副作用');}

// ---- 泥巴：跳过回合、不能叠加、每批一次 ----
{let g=setup(['fake','fake','real','fake','real'],['mud','mud'],['mud']);g.act(0,{type:'item',item:'mud'});ok(g.mud[1],'泥巴困住对手');
 let s=snap(g),r=g.act(0,{type:'item',item:'mud'});ok(!r.ok&&snap(g)===s,'泥巴不能叠加');
 g.act(0,{type:'shoot',target:'self'});ok(g.mud[1]&&g.turn===0,'自己假屎继续操作不提前消耗泥巴');
 r=g.act(0,{type:'shoot',target:'opp'});ok(g.turn===0&&!g.mud[1]&&r.events.some(e=>e.type==='skip'&&e.player===1),'对手被跳过，回合仍归自己');
 s=snap(g);r=g.act(0,{type:'item',item:'mud'});ok(!r.ok&&/这批弹药/.test(r.reason)&&snap(g)===s,'每批弹药每只猪最多一次泥巴');
 g.act(0,{type:'shoot',target:'opp'});ok(g.turn===1,'泥巴消耗后正常换手');
 // 新装填后可再次使用
 g=setup(['fake'],['mud','mud','plunger']);g.act(0,{type:'item',item:'mud'});g.act(0,{type:'item',item:'plunger'});g.mud=[false,false];ok(g.act(0,{type:'item',item:'mud'}).ok,'新一批弹药可再用泥巴');}

// ---- X 光 / 魔法书：指定位置公开，线索随消耗前移，装填清空 ----
{let g=setup(['fake','real','fake','real'],['xray','book','xray']);let r=g.act(0,{type:'item',item:'xray',index:2});ok(r.ok&&g.known[2]==='fake'&&r.events[0].pos===2,'X 光公开指定位置');
 const s=snap(g);r=g.act(0,{type:'item',item:'xray',index:2});ok(!r.ok&&snap(g)===s,'已公开位置不重复消耗');
 r=g.act(0,{type:'item',item:'xray',index:9});ok(!r.ok&&snap(g)===s,'越界位置非法');
 g.act(0,{type:'shoot',target:'self'});ok(g.known[1]==='fake'&&g.known.length===3,'公开线索随弹药前移');
 r=g.act(0,{type:'item',item:'book'});ok(r.ok&&g.known[0]==='real'&&r.events[0].shell==='real','魔法书公开下一发');
 g=setup(['fake'],['xray','plunger']);g.act(0,{type:'item',item:'xray',index:0});g.act(0,{type:'item',item:'plunger'});ok(g.known.every(k=>k===null),'重新装填清空旧线索');}

// ---- 肉、背包上限、非法动作 ----
{let g=setup(['real','fake'],['meat']);let s=snap(g),r=g.act(0,{type:'item',item:'meat'});ok(!r.ok&&snap(g)===s,'满血不能吃肉');
 g.hp[0]=3;g.act(0,{type:'item',item:'meat'});ok(g.hp[0]===4&&!g.items[0].length,'肉回 1 血');
 g=setup(['fake'],['book','book','book','book','book','book','book'],['meat','meat','meat','meat','meat','meat','meat','meat']);g.act(0,{type:'shoot',target:'self'});ok(g.items[0].length===8&&g.items[1].length===8,'背包最多 8 件，按空位补发');
 g=setup(['real','fake'],[]);s=snap(g);
 [[1,{type:'shoot',target:'opp'}],[0,{type:'item',item:'book'}],[0,{type:'shoot',target:'up'}],[0,null],[0,{type:'dance'}]].forEach(([p,a])=>{const r=g.act(p,a);ok(!r.ok&&r.reason&&snap(g)===s,'非法动作无副作用：'+JSON.stringify(a))});}

// ---- 装填规则 ----
{const g=new Game({rng:createRng(3)});for(let k=0;k<2000;k++){g.load();ok(g.mag.length>=2&&g.mag.length<=8&&g.realLeft>=1&&g.fakeLeft>=1,'每批 2–8 发且至少各一');g.items=[[],[]]}
 const counts={};const g2=new Game({rng:createRng(11)});for(let k=0;k<3000;k++){g2.items=[[],[]];g2.load();g2.items[0].concat(g2.items[1]).forEach(i=>counts[i]=(counts[i]||0)+1)}
 Object.values(counts).forEach(c=>ok(c>1700&&c<2300,'六种道具约等概率 '+c));
 const firsts=new Set();for(let s=1;s<40;s++)firsts.add(new Game({rng:createRng(s)}).firstPlayer);ok(firsts.size===2,'第一局随机先手');}

// ---- 三局两胜，只记分一次；先手交替；新局重置 ----
{const g=new Game({rng:createRng(5)});const f1=g.firstPlayer;g.boosted=true;g.mud=[true,false];
 const kill=w=>{g.turn=w;g._setMagazine(['real','real','real','real','real']);g.hp[1-w]=1;return g.act(w,{type:'shoot',target:'opp'})};
 let r=kill(0);ok(g.phase==='roundOver'&&g.wins[0]===1&&r.events.some(e=>e.type==='roundEnd'),'第一局结束');
 ok(!g.act(g.turn,{type:'shoot',target:'opp'}).ok,'局间不能行动');
 g.nextRound();ok(g.firstPlayer===1-f1&&g.hp.join()==='4,4'&&!g.boosted&&!g.mud.some(Boolean)&&g.known.every(k=>!k)&&g.items.every(b=>b.length===2),'新局重置并交替先手');
 kill(1);g.nextRound();ok(g.firstPlayer===f1,'第三局再交替');r=kill(1);
 ok(g.phase==='matchOver'&&g.winner===1&&g.wins.join()==='1,2'&&r.events.filter(e=>e.type==='matchEnd').length===1,'先赢两局获胜');
 ok(g.nextRound()===null&&g.wins.join()==='1,2'&&!g.act(g.turn,{type:'shoot',target:'opp'}).ok,'终局只记分一次，之后无动作');
 // 自杀式真屎让对手赢局
 const h=new Game({rng:createRng(9)});h.turn=0;h._setMagazine(['real','fake']);h.hp[0]=1;h.act(0,{type:'shoot',target:'self'});ok(h.roundWinner===1&&h.wins[1]===1,'自己打死自己判对手胜');}

// ---- AI 公开信息决策：同一公开局面 + 同 RNG ⇒ 同一决策 ----
{let same=0;for(let s=1;s<=400;s++){const g=new Game({rng:createRng(s)});const v=g.publicView();
  for(const tier of ['easy','smart','devil']){const other=new Game({rng:createRng(s)});const perm=other.mag.slice().reverse();other._setMagazine(perm);other.known=g.known.slice();
   const a=JSON.stringify(chooseAction(v,createRng(s*13),tier)),b=JSON.stringify(chooseAction(other.publicView(),createRng(s*13),tier));ok(a===b,'隐藏排列不影响决策');same++}}
 // 视图里没有队列
 const v=new Game({rng:createRng(1)}).publicView();ok(!('mag' in v)&&!('rng' in v),'公开视图不含隐藏队列与随机源');}

// ---- 多种子 AI 完整对战 ----
const tiers=['easy','smart','devil'];const tally={};let games=0,actions=0;
for(let s=1;s<=300;s++)for(const A of tiers)for(const B of tiers){const g=new Game({rng:createRng(s*31+tiers.indexOf(A)*7+tiers.indexOf(B))}),ai=createRng(s*977);let guard=0;
 while(g.phase!=='matchOver'){if(g.phase==='roundOver'){g.nextRound();continue}const p=g.turn,v=g.publicView(p),a=chooseAction(v,ai,p===0?A:B),r=g.act(p,a);
  assert.ok(r.ok,`AI 动作非法 seed=${s} ${A}/${B}: ${JSON.stringify(a)} ${r.reason}`);actions++;
  assert.ok(g.hp.every(h=>h>=0&&h<=4)&&g.items.every(b=>b.length<=8)&&g.mag.length>0||g.phase!=='play','不变量');
  if(++guard>3000)throw new Error('对局未结束 seed='+s)}
 games++;assert.ok(g.wins[g.winner]===2&&g.wins[1-g.winner]<=1);const k=A+'>'+B;tally[k]=(tally[k]||0)+(g.winner===0?1:0)}
checks+=games;
const rate=(a,b)=>tally[a+'>'+b]/300;
ok(rate('smart','easy')>.55,'聪明档胜过悠闲档 '+rate('smart','easy'));ok(rate('devil','easy')>.6,'恶魔档胜过悠闲档 '+rate('devil','easy'));const ds=(rate('devil','smart')+1-rate('smart','devil'))/2;ok(ds>.55,'恶魔档胜过聪明档 '+ds);
console.log('PASS: roulette rules —',checks,'checks; four shot outcomes, boosted self-hit, boost across fake/plunger/reload, mud skip/limits, X-ray position & clue shift, bag cap 8, illegal actions side-effect free, best-of-3 scored once, public-only AI.');
console.log('AI matches:',games,'complete,',actions,'actions; win rates P0 vs P1:',Object.entries(tally).map(([k,v])=>k+' '+(v/300).toFixed(2)).join(', '));
