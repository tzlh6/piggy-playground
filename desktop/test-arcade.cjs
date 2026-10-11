// Rules for the two arcade games (贪吃猪 / 跳跳猪) and 2048 tile tracking.
const C=require('./app/core.js'),A=require('node:assert/strict');
let s=new C.Snake(10,8,()=>0);A.equal(s.body.length,3);A(!s.turn('left'),'no reverse');
s.food=[s.body[0][0]+1,s.body[0][1]];A.equal(s.step().type,'eat');s.step();A.equal(s.body.length,4);
s=new C.Snake(10,8);let n=0;while(!s.dead&&n<50){s.food=[0,0];s.step();n++}A(s.dead&&n<=8,'wall kills');
s=new C.Snake(10,8);s.grow=5;for(let k=0;k<5;k++)s.step();s.turn('down');s.step();s.turn('left');s.step();s.turn('up');A.equal(s.step().type,'dead','self hit');
s=new C.Snake(10,8);s.body=[[2,2],[2,3],[3,3],[3,2]];s.dir='up';s.turn('right');s.food=[9,9];A.equal(s.step().type,'move','moving into the tail cell is allowed');
s=new C.Snake(10,8);A(s.turn('up'));A(s.turn('left'));A(!s.turn('down'),'queue max 2');
s=new C.Snake(20,14);for(let k=0;k<5;k++){const [hx,hy]=s.body[0];s.food=[hx+1,hy];s.step();s.body=s.body.map(([x,y])=>[x>15?x-10:x,y])}A(s.gold,'golden truffle after 5');
for(let k=0;k<200;k++){const t=new C.Snake(20,14);for(let j=0;j<40;j++){const f=t.food;A(!t.body.some(([x,y])=>x===f[0]&&y===f[1]),'food never on body');t.food=[t.body[0][0]+1,t.body[0][1]];const e=t.step();if(e.type==='dead')break;t.turn(['up','down'][j%2])}}
const run=(setup,act)=>{const r=new C.Runner(()=>0.5);r.next=1e9;setup(r);let crashed=false;for(let t=0;t<240&&!crashed;t++){act&&act(r);crashed=r.update(1/60).includes('crash')}return crashed};
A(run(r=>r.obs=[{kind:'fence',x:220,y:r.ground-44,w:22,h:44}]),'fence hits a pig that never jumps');
A(!run(r=>r.obs=[{kind:'fence',x:220,y:r.ground-44,w:44,h:44}],r=>{if(r.obs[0]&&r.obs[0].x-r.pig.x<100&&!r.pig.air&&!r._j){r.jump();r._j=1}}),'jump clears the tallest wide fence');
A(!run(r=>{r.obs=[{kind:'crow',x:240,y:r.ground-48,w:42,h:22}];r.duck(true)}),'duck under a mid crow');
A(run(r=>r.obs=[{kind:'crow',x:240,y:r.ground-48,w:42,h:22}]),'standing pig hits a mid crow');
A(!run(r=>r.apples=[{x:300,y:r.ground-20,r:11}])&&true);
{const r=new C.Runner(()=>0.5);r.next=1e9;r.apples=[{x:200,y:r.ground-20,r:11}];let got=0;for(let t=0;t<120;t++)got+=r.update(1/60).filter(e=>e==='apple').length;A.equal(got,1,'apple collected once');A(r.score>25)}
{const r=new C.Runner(()=>0.5);A.equal(r.jump(),'jump');for(let t=0;t<20;t++)r.update(1/60);A.equal(r.jump(),'double');A.equal(r.jump(),false,'only one double jump')}
// spacing: obstacles never spawn closer than the pig can react to
for(let k=0;k<20;k++){const r=new C.Runner();let last=null,minGap=1e9;r.pig.y=-1e6;r.update=r.update.bind(r);for(let t=0;t<60*90;t++){r.pig.y=-1e6;r.pig.air=true;r.pig.vy=0;r.update(1/60);const o=r.obs[r.obs.length-1];if(o&&o!==last){if(last)minGap=Math.min(minGap,o.x-(last.x+last.w));last=o}}A(minGap>=170,'gap '+minGap)}
for(let k=0;k<3000;k++){const b=Array.from({length:16},()=>Math.random()<.4?0:2**(1+Math.floor(Math.random()*4)));for(const d of ['left','right','up','down']){const r=C.move2048(b,d),x=Array(16).fill(0);r.moves.forEach(m=>{if(m.keep)x[m.to]=m.merge?m.v*2:m.v});A.equal(x.join(),r.board.join());A.equal(r.moves.length,b.filter(Boolean).length)}}
console.log('PASS: snake eat/grow/walls/self/tail-chase/turn queue/golden truffle/food placement; runner jump, double jump, duck, crash, apples, spawn spacing; 2048 tile moves replay 12000 boards.');
