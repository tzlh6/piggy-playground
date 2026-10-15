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
// Bad frame intervals cannot corrupt state.
{
 const g=new A.Jump('practice',rng);g.begin();for(const dt of [NaN,Infinity,-1,0])g.update(dt);
 ok(g.charge===0&&Number.isFinite(g.camera.x),'invalid time rejected');
}
console.log('PASS: 猪猪跳一跳 '+checks+' checks; 3000 perfect jumps, charge rate, real square/circle surfaces, offset aim, no point farming, cancellation and game over.');
