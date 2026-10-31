// 猪猪轮盘 4.3 三阶段积分赛规则测试：node test-roulette.cjs
const assert=require('assert');
const R=require('./app/roulette-core.js');
const {Game,createRng,chooseAction,STAGES,BAG_RECIPE}=R;
const snap=g=>JSON.stringify({hp:g.hp,items:g.items,order:g.order,pos:g.pos,clues:g.clues,flips:g.flips,boosted:g.boosted,mud:g.mud,turn:g.turn,points:g.points,phase:g.phase,stage:g.stage,batch:g.batch,bags:g.bags});
let checks=0;const ok=(c,m)=>{assert.ok(c,m);checks++};
// 摆一个局面：指定阶段、当前玩家 p0、弹药与背包
function setup(mag,items0,items1,o){o=o||{};const g=new Game({rng:createRng(o.seed||7),first:0});
 if(o.stage&&o.stage>1){g.points=[0,0];g.startStage(o.stage)}
 g.turn=0;g._setMagazine(mag);g.items=[(items0||[]).slice(),(items1||[]).slice()];g.hp=[g.maxHp,g.maxHp];g.boosted=false;g.mud=[false,false];return g}
// 让某方直接赢下当前阶段
function winStage(g,w){g.turn=w;g._setMagazine(['real','real','real']);g.hp[1-w]=1;const r=g.act(w,{type:'shoot',target:'opp'});assert.ok(r.ok,r.reason);return r}

// ---- 阶段配置 ----
{const g=new Game({rng:createRng(1),first:0});
 ok(g.stage===1&&g.maxHp===2&&g.hp.join()==='2,2'&&g.items.every(b=>!b.length),'第一阶段：2 血、无道具');
 ok(g.announced.total===3&&g.announced.fake===2,'第一阶段首批 3 发（1 真 2 假）');
 g.turn=0;g.order=['fake','fake','fake'];g.pos=0;g.act(0,{type:'shoot',target:'self'});g.act(0,{type:'shoot',target:'self'});g.act(0,{type:'shoot',target:'self'});
 ok(g.batch===2&&g.announced.total===5&&g.announced.fake===2&&g.order.filter(s=>s==='real').length===3,'第一阶段第二批 5 发（3 真 2 假）');
 ok(g.items.every(b=>!b.length),'第一阶段换弹没有补给');
 winStage(g,0);ok(g.phase==='stageOver'&&g.points.join()==='1,0','第一阶段胜者 +1');
 g.nextStage();ok(g.stage===2&&g.maxHp===4&&g.hp.join()==='4,4','第二阶段 4 血');
 ok(g.items.every(b=>b.join()==='book,rotten'),'第二阶段起手：魔法书＋腐肉');
 ok(g.announced.total===2&&g.announced.fake===1,'第二阶段首批 2 发（1 真 1 假）');
 g.turn=0;g.order=['fake','fake'];g.pos=0;g.act(0,{type:'shoot',target:'self'});g.act(0,{type:'shoot',target:'self'});
 ok(g.items.every(b=>b.length===4),'第二阶段之后每次装填补给 2 件');
 winStage(g,0);ok(g.points.join()==='3,0','第二阶段胜者 +2');
 const r=g.nextStage();ok(g.stage===3&&g.maxHp===6&&g.items.every(b=>b.length===4&&b[0]==='book'&&b[1]==='rotten'),'第三阶段 6 血，起手魔法书＋腐肉＋随机 2 件');
 ok(r.some(e=>e.type==='stage'&&e.stage===3),'3∶0 也继续打第三阶段');
 const n=g.items[0].length;g.turn=0;g.order=Array(g.order.length).fill('fake');g.pos=0;while(g.batch===1)g.act(0,{type:'shoot',target:'self'});
 ok(g.items[0].length===Math.min(8,n+4),'第三阶段之后每次装填补给 4 件');
 winStage(g,1);ok(g.phase==='stageOver'&&g.points.join()==='3,3','3∶3 时进入加赛，不直接结束');}

// ---- 随机批次 2–8 发，真假各至少一发 ----
{const g=new Game({rng:createRng(3),first:0});let seen=new Set();for(let k=0;k<3000;k++){g.stage=3;g.load();const r=g.order.filter(s=>s==='real').length;ok(g.order.length>=2&&g.order.length<=8&&r>=1&&r<g.order.length,'每批 2–8 发且至少各一');seen.add(g.order.length);g.items=[[],[]]}
 ok(seen.size===7,'2 到 8 发都会出现');}

// ---- 四种开枪结果 ----
{let g=setup(['fake','real','real']);let r=g.act(0,{type:'shoot',target:'self'});ok(r.ok&&g.hp[0]===2&&g.turn===0,'自己假屎：不扣血、继续');
 g.act(0,{type:'shoot',target:'self'});ok(g.hp[0]===1&&g.turn===1,'自己真屎：受伤、结束回合');
 g=setup(['fake','real']);g.act(0,{type:'shoot',target:'opp'});ok(g.hp[1]===2&&g.turn===1,'对手假屎：结束回合');
 g=setup(['real','fake']);g.act(0,{type:'shoot',target:'opp'});ok(g.hp[1]===1&&g.turn===1,'对手真屎：受伤、结束回合');
 g=setup(['fake','fake','real'],['meat','book'],[],{stage:2});g.hp[0]=3;g.act(0,{type:'shoot',target:'self'});ok(g.act(0,{type:'item',item:'meat'}).ok&&g.hp[0]===4&&g.turn===0,'假屎后可继续用道具，道具不结束回合');}

// ---- 饲料强化 ----
{let g=setup(['real','fake'],['feed'],[],{stage:2});g.act(0,{type:'item',item:'feed'});ok(g.boosted,'饲料强化');g.act(0,{type:'shoot',target:'self'});ok(g.hp[0]===2&&!g.boosted&&g.turn===1,'强化真屎自伤 2 并消耗');
 g=setup(['fake','real','real'],['feed'],[],{stage:2});g.act(0,{type:'item',item:'feed'});g.act(0,{type:'shoot',target:'self'});ok(!g.boosted&&g.turn===0,'强化射出假屎：0 伤害，强化也消耗');
 g=setup(['fake','fake','real','real'],['feed','plunger'],[],{stage:2});g.act(0,{type:'item',item:'feed'});g.act(0,{type:'item',item:'plunger'});ok(g.boosted&&g.mag.length===3,'退弹保留强化');
 g=setup(['fake'],['feed','plunger'],[],{stage:2});g.act(0,{type:'item',item:'feed'});const b=g.batch;g.act(0,{type:'item',item:'plunger'});ok(g.batch===b+1&&g.boosted&&g.turn===0,'退掉最后一颗：换弹，强化保留，不换手');
 g=setup(['real','real'],['feed','feed'],[],{stage:2});g.act(0,{type:'item',item:'feed'});const s=snap(g);const r=g.act(0,{type:'item',item:'feed'});ok(!r.ok&&snap(g)===s,'饲料不能叠加且无副作用');
 g=setup(['fake','real'],['feed'],[],{stage:2});g.act(0,{type:'item',item:'feed'});g.act(0,{type:'shoot',target:'opp'});ok(g.turn===1&&!g.boosted,'对对手打出强化假屎：强化消耗');}

// ---- 泥巴：跳过一回合、允许连控、不能叠加、换弹清除 ----
{let g=setup(['fake','real','fake','real','fake','real'],['mud','mud'],['mud'],{stage:2});g.act(0,{type:'item',item:'mud'});ok(g.mud[1],'泥巴必中');
 let s=snap(g),r=g.act(0,{type:'item',item:'mud'});ok(!r.ok&&snap(g)===s,'同一次控制未消耗时不能叠加');
 g.act(0,{type:'shoot',target:'self'});ok(g.mud[1]&&g.turn===0,'自己假屎继续，不提前消耗泥巴');
 r=g.act(0,{type:'shoot',target:'opp'});ok(g.turn===0&&!g.mud[1]&&r.events.some(e=>e.type==='skip'&&e.player===1),'对方回合被跳过，仍由自己行动');
 ok(g.act(0,{type:'item',item:'mud'}).ok&&g.mud[1],'上一次控制消耗后可以连控');
 g.act(0,{type:'shoot',target:'opp'});ok(g.turn===0,'连控：对方再次被跳过');
 g=setup(['fake'],['mud','plunger'],[],{stage:2});g.act(0,{type:'item',item:'mud'});r=g.act(0,{type:'item',item:'plunger'});
 ok(!g.mud[1]&&g.turn===0&&r.events.find(e=>e.type==='load').mudCleared.join()==='1','换弹清除未触发的泥巴，行动者不回滚');
 g=setup(['real','fake'],['mud'],[],{stage:2});g.act(0,{type:'item',item:'mud'});g.order=['fake'];g.pos=0;r=g.act(0,{type:'shoot',target:'opp'});
 ok(g.turn===0&&r.events.some(e=>e.type==='skip')&&r.events.some(e=>e.type==='load'),'先跳过对方确定行动者，再换弹');}

// ---- 魔法书 / X 光：私密线索 ----
{let g=setup(['fake','real','fake','real'],['xray','book','book','book'],[],{stage:2});let r=g.act(0,{type:'item',item:'xray'});
 ok(r.ok&&r.events[0].private.rel===0&&r.events[0].private.shell==='fake'&&g.cluesOf(0)[0]==='fake','X 光验下一颗');
 ok(JSON.stringify(g.cluesOf(1))==='{}'&&!g.publicView(1).clues.some(Boolean),'线索只属于使用者');
 r=g.act(0,{type:'item',item:'book'});const p=r.events[0].private;ok(p.rel>=1&&p.rel<=3&&g.order[g.pos+p.rel]===p.shell,'魔法书随机验后面一颗，排除下一颗');
 g.act(0,{type:'shoot',target:'self'});const c=g.cluesOf(0);ok(c[p.rel-1]===p.shell&&!(p.rel-1 in c&&p.rel-1<0),'线索随射击前移');
 g.act(0,{type:'item',item:'book'});g.act(0,{type:'item',item:'book'});ok(Object.keys(g.cluesOf(0)).length>=2,'魔法书优先验没看过的位置');
 const pos=[0,0,0,0];for(let s=1;s<=800;s++){const h=setup(['real','fake','real','fake'],['book'],[],{stage:2,seed:s});pos[h.act(0,{type:'item',item:'book'}).events[0].private.rel]++}
 ok(pos[0]===0&&pos.slice(1).every(n=>n>200),'魔法书在后面三颗里均匀选择 '+pos);
 g=setup(['real'],['book'],[],{stage:2});r=g.act(0,{type:'item',item:'book'});ok(r.ok&&r.events[0].private.none&&!g.items[0].length,'只剩一颗：魔法书照样用掉、没有有效线索');
 g=setup(['fake','real'],['xray','plunger'],[],{stage:2});g.act(0,{type:'item',item:'xray'});g.act(0,{type:'item',item:'plunger'});ok(JSON.stringify(g.cluesOf(0))==='{}','退弹后旧线索随之移出');
 g=setup(['fake'],['xray','plunger'],[],{stage:2});g.act(0,{type:'item',item:'xray'});g.act(0,{type:'item',item:'plunger'});ok(JSON.stringify(g.clues)==='[{},{}]','换弹清空线索');
 ok(!g.log.some(e=>e.private||e.shell&&e.item==='xray'),'公共记录不含私密验弹结果');
 // 4.3.1：线索条数按批计，射击 / 退弹不减少（同屏时不给对方暗示）；只在换弹、新阶段归零
 g=setup(['fake','real','fake','fake','real'],['xray','book','plunger','xray'],[],{stage:2});g.act(0,{type:'item',item:'xray'});ok(g.clueCount(0)===1&&g.clueCount(1)===0,'验弹后本批条数 +1，只算自己的');
 g.act(0,{type:'shoot',target:'self'});let L=g.clueList(0);ok(g.clueCount(0)===1&&L.length===1&&L[0].stale&&L[0].gone==='shot'&&L[0].rel===null&&JSON.stringify(g.cluesOf(0))==='{}','打出验过的那一颗：条数不变，标为已过时');
 g.act(0,{type:'item',item:'xray'});g.act(0,{type:'item',item:'plunger'});L=g.clueList(0);ok(g.clueCount(0)===2&&L.filter(c=>c.stale).length===2&&L[1].gone==='pop','退出验过的那一颗：条数不变，标为已过时（退出）');
 g.act(0,{type:'item',item:'book'});L=g.clueList(0);const live=L.filter(c=>!c.stale);ok(g.clueCount(0)===3&&live.length===1&&live[0].item==='book'&&g.order[g.pos+live[0].rel]===live[0].shell&&live[0].shell===g.cluesOf(0)[live[0].rel],'有效线索给出相对位置与真假，与私密线索一致');
 while(g.batch===1&&g.phase==='play'){g.turn=0;g.hp=[4,4];g.act(0,{type:'shoot',target:'self'})}ok(g.clueCount(0)===0&&!g.clueList(0).length,'换弹后条数归零');
 g=setup(['fake','real'],['xray','xray'],[],{stage:2});g.act(0,{type:'item',item:'xray'});g.act(0,{type:'item',item:'xray'});ok(g.clueCount(0)===2&&g.clueList(0).every(c=>c.rel===0),'同一颗验两次算两条');
 g=setup(['real'],['book'],[],{stage:2});g.act(0,{type:'item',item:'book'});ok(g.clueCount(0)===0,'没有有效线索的魔法书不计条数');
 g=setup(['fake','real','fake'],['xray'],[],{stage:2});g.act(0,{type:'item',item:'xray'});winStage(g,0);g.nextStage();ok(g.clueCount(0)===0&&g.clueCount(1)===0,'新阶段条数归零');}

// ---- 鲜肉、腐肉、濒死 ----
{let g=setup(['real','fake'],['meat','rotten'],[],{stage:2});let s=snap(g),r=g.act(0,{type:'item',item:'meat'});ok(!r.ok&&snap(g)===s,'满血不能吃鲜肉');r=g.act(0,{type:'item',item:'rotten'});ok(!r.ok&&snap(g)===s,'满血不能吃腐肉');
 g.hp[0]=3;g.act(0,{type:'item',item:'meat'});ok(g.hp[0]===4,'鲜肉回 1 血');
 const out={heal:0,hurt:0};for(let k=1;k<=2000;k++){const h=setup(['real','fake'],['rotten'],[],{stage:2,seed:k});h.hp[0]=3;const e=h.act(0,{type:'item',item:'rotten'}).events[0];out[e.outcome]++;
  if(e.outcome==='heal')assert.ok(h.hp[0]===4,'+2 受上限限制');else assert.ok(h.hp[0]===2,'−1')}
 ok(out.heal>900&&out.hurt>900,'腐肉约 50% / 50% '+JSON.stringify(out));
 let died=false;for(let k=1;k<50&&!died;k++){const h=setup(['real','fake'],['rotten'],[],{stage:2,seed:k});h.hp[0]=1;const r2=h.act(0,{type:'item',item:'rotten'});if(r2.events[0].outcome==='hurt'){died=h.phase==='stageOver'&&h.stageWinner===1}}ok(died,'腐肉扣血可能导致落败');
 g=setup(['real','real','real'],['meat','rotten'],[],{stage:3});g.hp[0]=2;s=snap(g);ok(!g.act(0,{type:'item',item:'meat'}).ok&&!g.act(0,{type:'item',item:'rotten'}).ok&&snap(g)===s,'濒死格无法回血');
 g.act(0,{type:'shoot',target:'self'});ok(g.hp[0]===0&&g.stageWinner===1,'濒死时再受伤即落败（2 血也一击落败）');
 g=setup(['real','fake'],['feed'],[],{stage:3});g.hp[1]=3;g.act(0,{type:'item',item:'feed'});const ev=g.act(0,{type:'shoot',target:'opp'}).events.find(e=>e.type==='shoot');ok(g.hp[1]===1&&ev.entered&&g.phase==='play','从 3 血被强化打到 1 血：进入濒死但不落败');
 g=setup(['real','fake'],[],[],{stage:2});g.hp[1]=2;g.act(0,{type:'shoot',target:'opp'});ok(g.hp[1]===1&&g.phase==='play','第二阶段没有濒死格');}

// ---- 猪蹄 ----
{let g=setup(['real','fake'],['hoof'],[],{stage:2});let s=snap(g),r=g.act(0,{type:'item',item:'hoof'});ok(!r.ok&&snap(g)===s&&/不会被用掉/.test(r.reason),'对方背包为空：不能用、不消耗');
 g=setup(['real','fake'],['hoof','meat','meat','meat','meat','meat','meat','meat'],['feed'],{stage:2});r=g.act(0,{type:'item',item:'hoof'});ok(r.ok&&g.items[0].length===8&&g.items[0].includes('feed')&&!g.items[1].length,'满背包也能用：先消耗猪蹄再放入');
 ok(g.act(0,{type:'item',item:'feed'}).ok,'偷来的道具立即可用');
 const cnt={};for(let k=1;k<=3000;k++){const h=setup(['real','fake'],['hoof'],['mud','xray','xray','hoof'],{stage:2,seed:k});const e=h.act(0,{type:'item',item:'hoof'}).events[0];cnt[e.stolen]=(cnt[e.stolen]||0)+1}
 ok(cnt.xray>1350&&cnt.xray<1650&&cnt.mud>620&&cnt.mud<880&&cnt.hoof>620&&cnt.hoof<880,'按件等概率偷，可能偷到另一只猪蹄 '+JSON.stringify(cnt));
 ok(g.log.some(e=>e.item==='hoof'&&e.stolen==='feed'),'公共记录写明偷走的道具');}

// ---- 魔术布（4.4.3）----
{let g=setup(['fake','real'],['cloth'],[],{stage:2});let r=g.act(0,{type:'item',item:'cloth'});
 ok(r.ok&&g.order[0]==='real'&&g.flipNext&&g.turn===0&&!g.items[0].length,'魔术布：下一颗假屎变真屎，不结束回合');
 ok(r.events.length===1&&!('shell' in r.events[0])&&!('private' in r.events[0])&&g.log.filter(e=>e.item==='cloth').every(e=>!('shell' in e)),'公共事件与记录不带真假');
 let v=g.publicView(0);ok(v.flipNext&&v.realLeft===1&&v.fakeLeft===1,'公开计数仍按原始装填，另标 flipNext');
 let e=g.act(0,{type:'shoot',target:'opp'}).events.find(x=>x.type==='shoot');ok(e.shell==='real'&&e.flipped&&g.hp[1]===3&&g.log.some(x=>x.k==='shoot'&&x.flipped),'盖过布的假屎变真屎，打中对手；记录标明魔术布');
 v=g.publicView(1);ok(!v.flipNext&&v.realLeft===1&&v.fakeLeft===0,'打出后按原值扣：剩下的是原来那颗真屎');
 g=setup(['real','fake'],['cloth'],[],{stage:2});g.act(0,{type:'item',item:'cloth'});e=g.act(0,{type:'shoot',target:'self'}).events.find(x=>x.type==='shoot');ok(e.shell==='fake'&&e.flipped&&g.hp[0]===4&&g.turn===0,'真屎变假屎：对自己开枪不扣血、继续');
 g=setup(['real','fake','fake'],['cloth','cloth'],[],{stage:2});g.act(0,{type:'item',item:'cloth'});let s=snap(g);r=g.act(0,{type:'item',item:'cloth'});ok(!r.ok&&/不能叠加/.test(r.reason)&&snap(g)===s,'不能叠加且无副作用');
 g.act(0,{type:'shoot',target:'self'});ok(g.act(0,{type:'item',item:'cloth'}).ok&&g.order[1]==='real'&&g.flips.join()==='0,1','下一颗离开后可以盖新的一颗');
 g=setup(['fake','real','fake'],['xray','cloth'],['xray'],{stage:2});g.act(0,{type:'item',item:'xray'});g.turn=1;g.act(1,{type:'item',item:'xray'});g.turn=0;g.act(0,{type:'item',item:'cloth'});
 ok(g.cluesOf(0)[0]==='real'&&g.cluesOf(1)[0]==='real'&&g.clueList(0)[0].flipped&&g.clueList(1)[0].shell==='real'&&g.clueCount(0)===1&&g.clueCount(1)===1,'双方验过的这颗线索一起翻，条数不变');
 ok(R.analyze(g.publicView(0)).p0===1&&R.analyze(g.publicView(1)).p0===1,'AI：验过假屎再盖布，确定是真屎');
 g=setup(['fake','fake','fake','real'],['cloth','cloth'],[],{stage:2});const p=R.analyze(g.publicView(0)).p0;g.act(0,{type:'item',item:'cloth'});const q=R.analyze(g.publicView(1)).p0,pl=R.analyze(g.publicView(1)).p(1);
 ok(Math.abs(p-.25)<1e-9&&Math.abs(q-.75)<1e-9&&Math.abs(pl-.25)<1e-9,'盖布后下一颗概率取反，后面几颗不变 '+p+'→'+q);
 ok(!R.legal(g.publicView(0),'cloth')&&R.legal(Object.assign(g.publicView(0),{flipNext:false}),'cloth'),'legal：盖过就不能再盖');
 g=setup(['fake','real','fake'],['cloth','plunger'],[],{stage:2});g.act(0,{type:'item',item:'cloth'});e=g.act(0,{type:'item',item:'plunger'}).events[0];
 ok(e.shell==='real'&&e.flipped&&!g.flipNext&&g.publicView(0).realLeft===1&&g.publicView(0).fakeLeft===1,'马桶搋子退出盖过的那颗：公开实际真假，计数按原值');
 g=setup(['fake'],['cloth'],[],{stage:2});g.act(0,{type:'item',item:'cloth'});const b0=g.batch;g.act(0,{type:'shoot',target:'opp'});ok(g.batch===b0+1&&!g.flips.length&&!g.flipNext&&g.hp[1]===3,'换弹后盖布记录清零');
 g=new Game({rng:createRng(4),first:0});g.points=[0,0];g.startStage(2);g.turn=0;g.items=[['cloth'],[]];const before=g.order[0];g.act(0,{type:'item',item:'cloth'});const hb=g.history[1].batches[0];
 ok(hb.flips.join()==='0'&&hb.order[0]===before&&g.order[0]!==before,'赛后回顾：保留原始顺序并记下盖布位置');
 winStage(g,0);g.nextStage();ok(!g.flips.length,'新阶段清零');
 // AI：已知假屎、对手只剩 1 血 → 盖布变真屎
 for(const tier of ['smart','devil']){g=setup(['fake'],['cloth'],[],{stage:2});g.hp[1]=1;ok(JSON.stringify(chooseAction(g.publicView(0),createRng(3),tier))==='{"type":"item","item":"cloth"}',tier+'：已知假屎会盖布')}}

// ---- 补给洗牌袋与背包上限 ----
{ok(BAG_RECIPE.length===16&&['mud','cloth'].every(it=>BAG_RECIPE.filter(x=>x===it).length===1)&&R.ITEMS.filter(x=>x!=='mud'&&x!=='cloth').every(it=>BAG_RECIPE.filter(x=>x===it).length===2),'洗牌袋 16 件：泥巴、魔术布各 1，其余各 2');
 const counts={};const h=new Game({rng:createRng(5),first:0});h.startStage(3);h.bags=[[],[]];for(let k=0;k<1600;k++){const it=h.draw(0);counts[it]=(counts[it]||0)+1}
 ok(counts.mud===100&&counts.cloth===100&&R.ITEMS.filter(x=>x!=='mud'&&x!=='cloth').every(it=>counts[it]===200),'抽完再洗：每 16 件严格按配方 '+JSON.stringify(counts));
 const a=new Game({rng:createRng(8),first:0});a.startStage(3);ok(a.bags[0]!==a.bags[1],'双方洗牌袋独立');
 const f=setup(['fake'],['book','book','book','book','book','book','book'],['meat','meat','meat','meat','meat','meat','meat','meat'],{stage:3});const bag0=f.bags[0].length,bag1=f.bags[1].length;f.act(0,{type:'shoot',target:'self'});
 ok(f.items[0].length===8&&f.items[1].length===8,'背包上限 8 件');ok((bag0-f.bags[0].length+16)%16===1&&f.bags[1].length===bag1,'补给只填空位，不多抽');}

// ---- 每阶段重置、先手轮换、3∶3 加赛、只结算一次 ----
{const g=new Game({rng:createRng(5),first:1});ok(g.first===1&&g.turn===1,'整场先手可指定（连续再战交换）');
 winStage(g,0);g.boosted=true;g.mud=[true,true];g.clues[0][3]='real';g.nextStage();
 ok(g.first===0&&!g.boosted&&!g.mud.some(Boolean)&&JSON.stringify(g.clues)==='[{},{}]'&&g.hp.join()==='4,4','第二阶段交换先手，重置强化、泥巴、线索、血量');
 winStage(g,0);g.nextStage();ok(g.first===1,'第三阶段换回');
 const r=winStage(g,1);ok(g.points.join()==='3,3'&&g.phase==='stageOver'&&r.events.some(e=>e.type==='tiebreak'),'3∶3 进入加赛');
 ok(!g.act(g.turn,{type:'shoot',target:'opp'}).ok,'阶段之间不能行动');
 g.nextStage();ok(g.stage===4&&g.first===0&&g.maxHp===6&&g.items.every(b=>b.length===4&&b[0]==='book')&&STAGES[4].nearDeath===2,'加赛按第三阶段规则，交换第三阶段先手');
 const e=winStage(g,0).events.filter(x=>x.type==='matchEnd');ok(e.length===1&&e[0].tiebreak&&g.points.join()==='3,3'&&g.winner===0,'加赛只决定赢家：3∶3，加赛获胜');
 ok(g.nextStage()===null&&!g.act(g.turn,{type:'shoot',target:'opp'}).ok,'整场结束后不再结算、不能行动');
 const firsts=new Set();for(let s=1;s<40;s++)firsts.add(new Game({rng:createRng(s)}).matchFirst);ok(firsts.size===2,'首次比赛随机先手');
 const k=new Game({rng:createRng(9),first:0});winStage(k,0);k.nextStage();winStage(k,0);k.nextStage();const m=winStage(k,0);ok(k.phase==='matchOver'&&k.points.join()==='6,0'&&m.events.filter(x=>x.type==='matchEnd').length===1,'6∶0 整场结束只结算一次');
 const h=new Game({rng:createRng(9),first:0});h.turn=0;h._setMagazine(['real','fake']);h.hp[0]=1;h.act(0,{type:'shoot',target:'self'});ok(h.stageWinner===1&&h.points[1]===1,'自己打倒自己判对手胜');}

// ---- 非法动作无副作用 ----
{const g=setup(['real','fake'],[],[],{stage:2});const s=snap(g);
 [[1,{type:'shoot',target:'opp'}],[0,{type:'item',item:'book'}],[0,{type:'shoot',target:'up'}],[0,null],[0,{type:'dance'}],[0,{type:'item',item:'cake'}]].forEach(([p,a])=>{const r=g.act(p,a);ok(!r.ok&&r.reason&&snap(g)===s,'非法动作无副作用：'+JSON.stringify(a))});}

// ---- 公开信息：装填数量只在公布时给出；视图不含隐藏队列 ----
{const g=new Game({rng:createRng(1)});const v=g.publicView();ok(!('order' in v)&&!('rng' in v)&&!('bags' in v),'公开视图不含隐藏队列、洗牌袋与随机源');
 ok(g.log.every(e=>!('total' in e)&&!('fake' in e)),'公共记录不保存装填数量');
 ok(g.history[0].batches[0].order.length===3,'赛后回顾保存各批装填顺序');}

// ---- AI：同一公开局面 + 同 RNG ⇒ 同一决策（隐藏排列无关） ----
{for(let s=1;s<=300;s++){const g=new Game({rng:createRng(s)});g.points=[0,0];g.startStage(1+s%3);g.turn=0;const v=g.publicView(0);
  for(const tier of ['easy','smart','devil']){const o=new Game({rng:createRng(s)});o.points=[0,0];o.startStage(1+s%3);o.turn=0;o.order=o.order.slice().reverse();o.clues=[{},{}];
   const a=JSON.stringify(chooseAction(v,createRng(s*13),tier)),b=JSON.stringify(chooseAction(o.publicView(0),createRng(s*13),tier));ok(a===b,'隐藏排列不影响决策')}}
 // 只用自己的线索：对方的线索变化不影响决策
 const g=setup(['real','fake','real'],['book','xray'],['xray'],{stage:2});g.turn=1;g.act(1,{type:'item',item:'xray'});g.turn=0;const v1=JSON.stringify(g.publicView(0));g.clues[1]={};ok(JSON.stringify(g.publicView(0))===v1,'AI 视图只含自己的线索');}

// ---- 多种子 AI 完整对战 ----
const tiers=['easy','smart','devil'];const tally={};let games=0,actions=0,ties=0;const N=process.env.PIGGY_AI_STRESS==='1'?200:20;
for(let s=1;s<=N;s++)for(const A of tiers)for(const B of tiers){const g=new Game({rng:createRng(s*31+tiers.indexOf(A)*7+tiers.indexOf(B))}),ai=createRng(s*977);let guard=0;
 while(g.phase!=='matchOver'){if(g.phase==='stageOver'){g.nextStage();continue}const p=g.turn,v=g.publicView(p),a=chooseAction(v,ai,p===0?A:B),r=g.act(p,a);
  assert.ok(r.ok,`AI 动作非法 seed=${s} ${A}/${B}: ${JSON.stringify(a)} ${r.reason}`);actions++;
  assert.ok(g.hp.every(h=>h>=0&&h<=g.maxHp)&&g.items.every(b=>b.length<=8),'不变量');
  if(++guard>4000)throw new Error('对局未结束 seed='+s)}
 games++;if(g.history.length===4)ties++;assert.ok(g.history.length>=3,'三个阶段全部打完');const k=A+'>'+B;tally[k]=(tally[k]||0)+(g.winner===0?1:0)}
checks+=games;
const rate=(a,b)=>tally[a+'>'+b]/N;
// 4.9.1 三档同时增强，原来以随机放水的 easy 为对照的胜率阈值已不适用。
// 此处保留全部对局的合法性与信息边界检查；胜率只作诊断，不将未配对
// 的随机牌局冒充棋力证明。战术、穷举残局与版本配对对战另行验证。
console.log('PASS: roulette 4.4.3 rules —',checks,'checks; 3-stage points (1/2/3), fixed opening batches, 16-item shuffle bag, 9 items (magic cloth flips the next shell), private clues, near-death cells, 3:3 tiebreak, mud chain/clear, boost consumed by any shot, scored once, public-only AI.');
console.log('AI matches:',games,'complete ('+ties+' tiebreaks),',actions,'actions; win rates P0 vs P1:',Object.entries(tally).map(([k,v])=>k+' '+(v/N).toFixed(2)).join(', '));
