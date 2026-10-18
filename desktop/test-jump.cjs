/* Rules regression: meaningful geometry, charge timing, scoring and lifecycle. */
const assert=require('node:assert/strict');
const A=require('./app/jump-core.js');
let checks=0;function ok(v,message){assert.ok(v,message);checks++}
let seed=138267;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
function landAt(g,point){
 const d=Math.hypot(point.x-g.pig.x,point.z-g.pig.z);
 ok(g.begin(),'can begin on a stable platform');g.update(A.chargeFor(d));
 ok(g.release(),'can release held jump');const events=g.update(A.FLIGHT_MS+260);return events;
}
// Distance is monotone, capped, invertible, and independent of frame rate.
ok(A.distanceFor(0)===12&&A.distanceFor(1500)===342&&A.distanceFor(9000)===342,'charge limits');
for(let ms=0;ms<=1500;ms+=10)ok(Math.abs(A.chargeFor(A.distanceFor(ms))-ms)<1e-8,'inverse distance map');
for(const hz of [20,30,60,90,120,144]){
 const g=new A.Jump('classic',rng);g.begin();let remain=927;
 while(remain>0){const dt=Math.min(remain,1000/hz);g.update(dt);remain-=dt}
 ok(Math.abs(g.charge-927)<1e-7,'same held duration at '+hz+' Hz');
}
// Square vs circular collision: corner inside a square lies outside a circle.
const square={x:0,z:0,size:100,shape:'square'},circle={...square,shape:'circle'},far={...square,x:300};
ok(A.surfaceDistance(square,{x:45,z:45})<0,'square corner inside');
ok(A.surfaceDistance(circle,{x:45,z:45})>0,'circle corner outside');
ok(A.classify(square,far,{x:50,z:0}).kind==='stay','inclusive hoof surface boundary');
ok(A.classify(square,far,{x:150,z:0}).reason==='short','gap is too short');
ok(A.classify(square,far,{x:420,z:0}).reason==='long','overshoot');
ok(A.classify(square,far,{x:51,z:0}).reason==='edge','edge miss');
ok(A.classify(square,far,{x:300,z:0}).perfect,'target center');
// Thousands of perfect manual-distance jumps through turns and both shapes.
for(const mode of ['classic','practice']){
 const g=new A.Jump(mode,rng);let expected=0;
 for(let n=1;n<=1500;n++){
  const goal={x:g.next.x,z:g.next.z},distance=Math.hypot(goal.x-g.pig.x,goal.z-g.pig.z);
  ok(distance<A.MAX_DISTANCE,'every generated target is reachable');
  const events=landAt(g,goal);expected+=Math.min(10,n*2);
  ok(events.some(e=>e.type==='land'&&e.perfect),'perfect landing at turn '+n);
  ok(g.score===expected&&g.steps===n&&g.combo===n,'combo scoring');
  ok(g.phase==='ready'&&!g.over,'settling returns to ready');
  ok(g.platforms.length<=7,'old platform geometry stays bounded');
  ok(Math.hypot(g.pig.x-goal.x,g.pig.z-goal.z)<1e-7,'landing has no drift');
 }
}
// Normal edgeward landing is retained, and the next jump aims from that offset.
{
 const g=new A.Jump('classic',rng),to={x:g.next.x-28,z:g.next.z};
 landAt(g,to);ok(g.score===1&&g.combo===0,'ordinary landing earns one');
 ok(Math.abs(g.pig.x-to.x)<1e-8,'actual off-center position retained');
 landAt(g,g.next);ok(g.score===3&&g.combo===1,'center combo restarts after normal landing');
}
// A small jump that stays on the old platform cannot farm points.
{
 const g=new A.Jump('classic',rng);g.begin();g.release();g.update(800);
 ok(g.steps===0&&g.score===0&&!g.over,'stay is playable without points');
}
// Cancel / repeated input and end state are deterministic.
{
 const g=new A.Jump('classic',rng);g.begin();g.update(800);
 ok(!g.begin(),'repeat begin cannot reset charge');ok(g.cancel(),'cancel during charge');
 ok(g.charge===0&&g.phase==='ready'&&!g.release(),'canceled charge never launches');
 g.begin();g.update(1500);g.release();ok(!g.release(),'double release does not duplicate a jump');
 const events=g.update(2000);ok(g.over&&events.filter(e=>e.type==='over').length===1,'overshoot finishes once');
 ok(!g.begin()&&g.update(500).length===0,'no actions after death');
}
// 4.4.7 feel: shorter airtime for short hops, buffered charge during the landing bounce,
// and edge misses that slide outward before falling.
{
 ok(A.flightFor(A.MIN_DISTANCE)<A.flightFor(200)&&A.flightFor(A.MAX_DISTANCE)<=A.FLIGHT_MS,'airtime scales with distance and stays capped');
 ok(A.apexFor(20)<A.apexFor(300),'longer jumps arc higher');
 const g=new A.Jump('classic',rng),d=Math.hypot(g.next.x-g.pig.x,g.next.z-g.pig.z);
 g.begin();g.update(A.chargeFor(d));g.release();g.update(A.flightFor(d)-1);ok(g.phase==='flying','still airborne one ms before touchdown');
 g.update(2);ok(g.phase==='settling'&&g.steps===1,'touchdown exactly at flightFor(distance)');
 ok(g.begin()&&g.phase==='charging','charge may begin during the landing bounce');
 g.update(400);ok(Math.abs(g.charge-400)<1e-9,'buffered charge counts from landing, not the bounce end');
 g.cancel();
 const edge=A.classify(square,far,{x:52,z:0});ok(edge.reason==='edge'&&edge.tip.x>0&&edge.slide>0,'edge miss tips outward');
 const gap=A.classify(square,far,{x:150,z:0});ok(gap.slide===0&&gap.tip.x>0,'gap miss falls straight forward');
 const h=new A.Jump('classic',rng);h.begin();h.update(A.MAX_CHARGE);h.release();h.update(A.FLIGHT_MS);
 ok(h.phase==='falling'&&!h.begin(),'no charging while falling');
 h.update(A.FALL_MS);ok(h.over,'fall ends the run');
}
// 4.4.8 easter eggs: wait quietly on an egg platform for a one-time bonus.
{
 let seen=new Set(),inRow=false;
 for(let k=0;k<40;k++){const g=new A.Jump(k%2?'practice':'classic',rng);
  for(let n=0;n<60;n++){const was=g.current.egg;landAt(g,g.next);if(g.current.egg){seen.add(g.current.egg);ok(g.current.shape===A.EGGS[g.current.egg].shape,'egg keeps its shape');if(was)inRow=true}}}
 ok(seen.size===Object.keys(A.EGGS).length,'all six eggs appear: '+[...seen].join(','));ok(!inRow,'never two eggs in a row');
 {let eggs=0,hops=0;for(let k=0;k<200;k++){const g=new A.Jump('classic',rng);for(let n=0;n<40;n++){landAt(g,g.next);hops++;if(g.current.egg)eggs++;if(n<4)ok(!g.current.egg,'no egg in the opening hops')}}
  ok(eggs/hops>.04&&eggs/hops<.1,'eggs stay rare: '+(eggs/hops*100).toFixed(1)+'%')}
 const g=new A.Jump('classic',rng);
 g.next={...g.next,egg:'pool',eggDone:false,shape:'square'};g.platforms[1]=g.next;
 landAt(g,g.next);const base=g.score;ok(g.current.egg==='pool'&&g.phase==='ready','landed on the pool table');
 const p0=g.eggProgress;g.update(A.EGG_MS/4);ok(Math.abs(g.eggProgress-p0-.25)<1e-9,'progress fills while waiting');
 g.begin();ok(g.eggProgress===0,'charging resets the egg timer');g.cancel();
 g.update(A.EGG_MS-50);ok(g.score===base,'no bonus before the full wait');
 const ev=g.update(100);ok(ev.some(e=>e.type==='egg'&&e.egg==='pool'&&e.points===8)&&g.score===base+8,'pool table pays 8');
 ok(g.update(5000).length===0&&g.score===base+8&&g.eggProgress===0,'each egg pays once');
 ok(g.combo===1&&g.eggs.length===1,'bonus keeps the center combo');
}
// 4.5.0 猪猪轮盘系列彩蛋
{
 const onEgg=(kind,r)=>{const g=new A.Jump('classic',r||rng);g.next={...g.next,egg:kind,eggDone:false,shape:A.EGGS[kind].shape};g.platforms[1]=g.next;landAt(g,g.next);return g};
 const wait=g=>g.update(A.EGG_MS+50);
 // 弹料袋：真假各半，假屎 +8、真屎 +3
 const seen={fake:0,real:0};
 for(let k=0;k<200;k++){const g=onEgg('sack'),b=g.score,ev=wait(g).find(e=>e.type==='egg');seen[ev.outcome]++;ok(g.score-b===(ev.outcome==='fake'?8:3)&&ev.points===g.score-b,'sack pays by outcome')}
 ok(seen.fake>60&&seen.real>60,'sack is a real gamble '+JSON.stringify(seen));
 // 饲料：下一次成功落台 ×2，只一次；落回原台不消耗
 {const g=onEgg('feed');wait(g);ok(g.feed,'feed armed');
  g.begin();g.release();g.update(800);ok(g.last.kind==='stay'&&g.feed,'stay keeps the feed buff');
  const before=g.score,ev=landAt(g,g.next).find(e=>e.type==='land');ok(ev.doubled&&g.score-before===ev.points&&ev.points===(ev.perfect?Math.min(10,g.combo*2):1)*2,'next landing doubled');
  ok(!g.feed,'feed is used up');const b2=g.score,ev2=landAt(g,g.next).find(e=>e.type==='land');ok(!ev2.doubled&&g.score-b2===ev2.points,'only once')}
 // 魔法书：下一跳预言，起跳后消失
 {const g=onEgg('book');wait(g);ok(g.prophecy,'prophecy armed');g.begin();ok(g.prophecy,'visible while charging');g.update(200);g.release();ok(!g.prophecy,'prophecy spent on release')}
 // 魔术布 / 猪王：装扮，王冠优先
 {const g=onEgg('cloth');wait(g);ok(g.hat==='hat','magic hat');landAt(g,g.next);
  g.next={...g.next,egg:'crown',eggDone:false,shape:'square'};g.platforms[g.platforms.length-1]=g.next;landAt(g,g.next);const b=g.score;wait(g);ok(g.hat==='crown'&&g.score-b===15,'crown +15 replaces the hat')}
 {const g=onEgg('crown');wait(g);g.next={...g.next,egg:'cloth',eggDone:false,shape:'square'};g.platforms[g.platforms.length-1]=g.next;landAt(g,g.next);wait(g);ok(g.hat==='crown','hat never downgrades the crown')}
 for(const kind of ['rotten','plunger','xray']){const g=onEgg(kind),b=g.score;wait(g);ok(g.score-b===A.EGGS[kind].points,kind+' pays')}
 // 猪王宝座更稀有
 {const g=new A.Jump('classic',rng),count={};for(let k=0;k<30000;k++){const e=g.pickEgg();count[e]=(count[e]||0)+1}
  ok(Object.keys(count).length===Object.keys(A.EGGS).length&&count.crown<count.sack*.7,'weighted picks, crown rarer '+count.crown+' vs '+count.sack)}
}
// Bad frame intervals cannot corrupt state.
{
 const g=new A.Jump('practice',rng);g.begin();for(const dt of [NaN,Infinity,-1,0])g.update(dt);
 ok(g.charge===0&&Number.isFinite(g.camera.x),'invalid time rejected');
}
console.log('PASS: 猪猪跳一跳 '+checks+' checks; 3000 perfect jumps, charge rate, real square/circle surfaces, offset aim, no point farming, cancellation and game over.');
