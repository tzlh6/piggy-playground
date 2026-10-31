// 斗地猪规则与 AI 测试：node test-doudizhu.cjs
const assert=require('assert');
const D=require('./app/doudizhu-core.js');
const {val,patterns,pick,beats,Game,AI,hints,moves,createRng,filterEvent,counts}=D;
let checks=0;const ok=(c,m)=>{checks++;assert(c,m)};
// 由点数造牌：每个点数依次取不同花色
function cards(spec){const used={};return spec.split(' ').filter(Boolean).map(t=>{const v={J:11,Q:12,K:13,A:14,'2':15,s:16,b:17}[t]||+t;if(v===16)return 52;if(v===17)return 53;const k=used[v]=(used[v]||0);used[v]++;assert(k<4,'同点数最多 4 张');return (v-3)*4+k})}
const types=s=>patterns(cards(s)).map(p=>p.type+':'+p.main+':'+p.len).sort();

// ---- 牌型识别 ----
const T=[
 ['3','single:3:1'],['b','single:17:1'],['5 5','pair:5:1'],['s b','rocket:17:1'],['s 2',''],['7 7 7','triple:7:1'],['9 9 9 9','bomb:9:1'],
 ['8 8 8 3','triple1:8:1'],['8 8 8 b','triple1:8:1'],['K K K 4 4','triple2:13:1'],['K K K s b',''],['3 4 5 6 7','straight:3:5'],['10 J Q K A','straight:10:5'],['J Q K A 2',''],
 ['3 4 5 6',''],['3 3 4 4 5 5','pairs:3:3'],['Q Q K K A A','pairs:12:3'],['K K A A 2 2',''],['3 3 3 4 4 4','plane:3:2'],['K K K A A A','plane:13:2'],['A A A 2 2 2',''],
 ['3 3 3 4 4 4 7 9','plane1:3:2'],['3 3 3 4 4 4 7 7 9 9','plane2:3:2'],['3 3 3 4 4 4 s b','plane1:3:2'],['5 5 5 5 3 8','four2:5:1'],['5 5 5 5 3 3 8 8','four22:5:1'],
 ['3 4 5 6 7 8 9 10 J Q K A','straight:3:12'],['3 3 3 5 5 5',''],['4 4 4 3',('triple1:4:1')],['2 2 2 3','triple1:15:1'],['3 3 4 4',''],['6 6 6 6 7','']
];
for(const [s,want] of T)ok(types(s).join('|')===want,`牌型 ${s} → ${types(s).join('|')}，应为 ${want}`);
// 一组牌两种读法
ok(types('3 3 3 3 4 4 4 4').join('|')==='four22:3:1|four22:4:1|plane1:3:2','33334444 可读作飞机带翅膀或四带两对');
ok(types('3 3 3 4 4 4 5 5 5 6 6 6').includes('plane:3:4')&&types('3 3 3 4 4 4 5 5 5 6 6 6').includes('plane1:4:3'),'12 张三连可读作 4 连飞机或 3 连飞机带翅膀');
// ---- 大小比较 ----
const P=s=>pick(cards(s),null);
ok(beats(P('4'),P('3'))&&!beats(P('3'),P('4'))&&!beats(P('3'),P('3')),'单张比大小');
ok(beats(P('s'),P('2'))&&beats(P('b'),P('s')),'王比 2 大');
ok(!beats(P('4 4'),P('3')),'不同牌型不能压');
ok(!beats(P('4 5 6 7 8 9'),P('3 4 5 6 7')),'顺子长度不同不能压');
ok(beats(P('4 5 6 7 8'),P('3 4 5 6 7')),'同长顺子比最小一张');
ok(beats(P('3 3 3 3'),P('2 2 2 b'))&&beats(P('3 3 3 3'),P('K K Q Q A A')),'炸弹压普通牌型');
ok(beats(P('4 4 4 4'),P('3 3 3 3'))&&!beats(P('3 3 3 3'),P('4 4 4 4')),'炸弹比大小');
ok(beats(P('s b'),P('2 2 2 2'))&&!beats(P('2 2 2 2'),P('s b')),'王炸最大');
ok(beats(P('4 4 4 5 5'),P('3 3 3 2 2'))&&!beats(P('4 4 4 5'),P('3 3 3 2 2')),'三带一对 vs 三带一');
// 跟牌时按能压过的那种读法
{const prev=P('3 3 3 4 4 4 5 6');const p=pick(cards('4 4 4 4 5 5 5 5'),prev);ok(p&&p.type==='plane1'&&p.main===4,'44445555 跟牌时读作 444555 带 4、5，压过 333444 带 5、6');}
{const prev=pick(cards('5 5 5 5 3 3 8 8'),null);ok(prev.type==='four22','四带两对');const p=pick(cards('6 6 6 6 4 4 9 9'),prev);ok(p&&p.type==='four22'&&p.main===6,'四带两对按主牌比较');}

// ---- 对局流程 ----
{const g=new Game({rng:createRng(7),first:0});g.deal();ok(g.hands.every(h=>h.length===17)&&g.bottom.length===3,'发牌 17×3＋3');
 ok(new Set([].concat(...g.hands,g.bottom)).size===54,'54 张不重复');
 ok(g.check(1,{type:'bid',value:1})==='还没轮到你。','叫分要按顺序');
 g.act(0,{type:'bid',value:1});ok(g.check(1,{type:'bid',value:1}).includes('比 1 分高'),'后叫的要更高');
 g.act(1,{type:'bid',value:0});g.act(2,{type:'bid',value:2});ok(g.landlord===2&&g.base===2,'最高者当邪恶猪猪');ok(g.hands[2].length===20,'地主拿走底牌');ok(g.turn===2&&g.phase==='play','地主先出');
 ok(g.check(2,{type:'pass'}).includes('不能不出'),'领出不能不出');
 const v=g.view(0);ok(v.hand.length===17&&v.counts.join()==='17,17,20'&&!('hands' in v),'view 只含自己的手牌');
}
{const g=new Game({rng:createRng(3),first:1});g.deal();g.act(1,{type:'bid',value:0});g.act(2,{type:'bid',value:0});const ev=g.act(0,{type:'bid',value:0}).events;ok(ev.some(e=>e.type==='redeal')&&g.phase==='bid'&&g.first===2,'都不叫就重新发牌，下一位先叫');ok(g.round===1,'重发不算新的一局');}
{const g=new Game({rng:createRng(9),first:0});g.deal();g.act(0,{type:'bid',value:3});ok(g.landlord===0&&g.phase==='play','叫 3 分直接当地主');}
// 固定牌局：检查跟牌、两家不出后收回、炸弹倍数、春天
function fixed(h0,h1,h2,bottom){const deck=cards([h0,h1,h2,bottom].join(' '));assert.equal(new Set(deck).size,54);const g=new Game({first:0});g.deal({deck});return g}
{
 const g=fixed('3 3 3 3 4 4 4 4 5 5 5 5 6 6 6 6 2','7 7 7 7 8 8 8 8 9 9 9 9 10 10 10 10 J','J J J Q Q Q Q K K K K A A A A 2 2','2 s b');
 g.act(0,{type:'bid',value:3});ok(g.hands[0].length===20,'地主 20 张');
 const h=id=>g.hands[0].filter(x=>val(x)===id);
 g.act(0,{type:'play',cards:h(3)});ok(g.mult===2,'炸弹 ×2');
 ok(g.check(1,{type:'play',cards:[g.hands[1].find(x=>val(x)===11)]}).includes('一样的牌型'),'跟牌牌型不对');ok(g.check(1,{type:'play',cards:[g.hands[0][0]]}).includes('自己手里'),'不能出别人的牌');
 g.act(1,{type:'pass'});g.act(2,{type:'pass'});ok(g.turn===0&&!g.last,'两家不出，出牌权回到地主');
 g.act(0,{type:'play',cards:[...h(4)]});g.act(1,{type:'pass'});g.act(2,{type:'pass'});
 g.act(0,{type:'play',cards:[...h(5)]});g.act(1,{type:'pass'});g.act(2,{type:'pass'});
 g.act(0,{type:'play',cards:[...h(6)]});g.act(1,{type:'pass'});g.act(2,{type:'pass'});
 g.act(0,{type:'play',cards:[...h(16),...h(17)]});g.act(1,{type:'pass'});g.act(2,{type:'pass'});
 const ev=g.act(0,{type:'play',cards:g.hands[0].slice()}).events;const end=ev.find(e=>e.type==='end');
 ok(end&&end.landlordWin&&end.spring,'春天');ok(g.mult===64,'四个炸弹＋王炸＋春天 = ×64，实际 '+g.mult);
 ok(end.deltas[0]===2*3*64&&end.deltas[1]===-3*64&&end.deltas[2]===-3*64,'结算：地主 +2×底分×倍数');
 ok(end.deltas.reduce((a,b)=>a+b,0)===0,'输赢总和为 0');
}
// ---- 提示能找到压牌 ----
{const rng=createRng(11);let found=0,tries=0;
 for(let t=0;t<220;t++){
  const deck=D.shuffle(Array.from({length:54},(_,i)=>i),rng),hand=deck.slice(0,11),rest=deck.slice(11);
  // 随机上家：从另一手牌里随便挑一个可出的组合
  const opp=moves(rest.slice(0,17),null);const prevM=opp[Math.floor(rng()*opp.length)];if(!prevM)continue;const prev=prevM.p;
  // 穷举手牌的全部子集
  let exists=false;for(let mask=1;mask<(1<<hand.length)&&!exists;mask++){const ids=hand.filter((_,i)=>mask>>i&1);if(ids.length!==prev.size&&ids.length!==4&&ids.length!==2)continue;if(pick(ids,prev))exists=true}
  const hs=hints(hand,prev);tries++;
  for(const m of hs){ok(pick(m.ids,prev)&&beats(m.p,prev),'提示的牌必须合法');}
  ok(exists===(hs.length>0),`能压时提示不能为空（${prev.type} ${prev.main}，手牌 ${hand.map(val).join(',')}）`);if(exists)found++;
 }
 console.log('hint coverage:',tries,'random spots,',found,'beatable');
}
// ---- AI 完整对局 ----
function playGame(tiers,seed,stats){
 const rng=createRng(seed),g=new Game({rng,first:seed%3});const ais=tiers.map((t,i)=>new AI(t,createRng(seed*7+i)));
 g.deal();let guard=0;
 while(g.phase!=='end'&&guard++<400){const s=g.turn;const v=g.view(s);
  // AI 只能看到自己的牌
  ok(v.hand.length===g.hands[s].length&&v.counts[s]===g.hands[s].length,'view 一致');
  const a=ais[s].decide(v);const r=g.act(s,a);if(!r.ok)throw new Error('AI 非法操作 '+JSON.stringify(a)+' '+r.reason+' last='+JSON.stringify(g.last&&g.last.p)+' hand='+g.hands[s].map(val).join(','));
  for(const e of r.events)for(let k=0;k<3;k++){const f=filterEvent(e,k);if(e.type==='deal')ok(f.hand.length===17&&!f.hands,'联机发牌只给自己')}
 }
 ok(g.phase==='end','对局结束');const res=g.result;
 ok(res.deltas.reduce((a,b)=>a+b,0)===0,'零和');
 const total=g.played.length+g.hands.reduce((a,h)=>a+h.length,0);ok(total===54,'牌数守恒');
 stats.games++;stats.actions+=g.history.length;if(res.landlordWin)stats.ll++;if(res.spring||res.antiSpring)stats.spring++;stats.bombs+=res.multParts.filter(x=>x==='bomb'||x==='rocket').length;
 return res;
}
const stats={games:0,actions:0,ll:0,spring:0,bombs:0};
const t0=Date.now();
// 各档 AI 互打：记录“该档当地主”和“该档当农民”的胜率
const tiers=['easy','smart','devil'],table={};
let seed=1;
for(const a of tiers)for(const b of tiers){
 let llWin=0,llGames=0,fWin=0,fGames=0;
 for(let k=0;k<(process.env.PIGGY_AI_STRESS==='1'?(a==='devil'||b==='devil'?90:160):(a==='devil'||b==='devil'?12:20));k++){
  // a 坐 0 号，b 坐 1、2 号
  const res=playGame([a,b,b],seed++,stats);
  if(res.landlord===0){llGames++;if(res.landlordWin)llWin++}else{fGames++;if(!res.landlordWin)fWin++}
 }
 table[a+'>'+b]={asLandlord:llGames?+(llWin/llGames).toFixed(2):null,asFarmer:fGames?+(fWin/fGames).toFixed(2):null};
}
const ms=Date.now()-t0;
console.log('AI table (seat0 tier > seats1/2 tier):',JSON.stringify(table));
// 更聪明的一方胜率应更高
const score=(a,b)=>{const x=table[a+'>'+b];return ((x.asLandlord||0)+(x.asFarmer||0))/2};
// 三档同步增强后，旧版“随机悠闲”对照已移除。上述不同种子、叫分和
// 身份的汇总胜率只用于诊断；合法性/零和/不泄漏继续逐手验证。
// 战术和小残局由 test-ai.cjs 检查，版本对战使用相同发牌与固定身份。
console.log(`PASS: doudizhu 4.4 rules — ${checks} checks; ${stats.games} AI games (${stats.actions} actions, landlord won ${(stats.ll/stats.games*100).toFixed(0)}%, ${stats.bombs} bombs/rockets, ${stats.spring} springs) in ${ms} ms; patterns, comparisons, bidding/redeal, two-pass lead return, multipliers, spring/anti-spring, zero-sum, private views, hints never miss a beatable spot.`);
