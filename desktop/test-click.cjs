// 只用鼠标 / 触屏也能玩：规则层面的检查。node test-click.cjs
const assert=require('assert');
const C=require('./app/core.js'),CH=require('./app/challenge-core.js');
// 跳跳猪：单击（按下立刻松开）的跳跃也能越过最高的篱笆与最宽的泥坑；按住仍然跳得更高
function clears(o,speed,click){const r=new C.Runner(()=>0.5);r.next=1e9;r.time=(speed-330)/11;o.x=r.pig.x+60+speed*.03;r.obs=[o];let crashed=false,jumped=false,peak=0;
 for(let k=0;k<240&&!crashed;k++){const front=o.x-(r.pig.x+44);if(!jumped&&front<speed*.12){r.jump();if(click)r.release();jumped=true}peak=Math.max(peak,r.ground-r.pig.y);crashed=r.update(1/60).includes('crash')}return {crashed,peak}}
for(const speed of [330,500,820]){
 const fence=clears({kind:'fence',y:184-47,w:44,h:47},speed,true),mud=clears({kind:'mud',y:184-12,w:88,h:12},speed,true),hold=clears({kind:'fence',y:184-47,w:44,h:47},speed,false);
 assert(!fence.crashed,'单击跳过 47 高 44 宽篱笆 @'+speed);assert(!mud.crashed,'单击跳过 88 宽泥坑 @'+speed);assert(hold.peak>fence.peak+20,'按住跳得更高')}
// 立刻松开不会再把跳跃压到很低
{const r=new C.Runner(()=>0.5);r.next=1e9;r.jump();r.release();let peak=0;for(let k=0;k<60;k++){r.update(1/60);peak=Math.max(peak,r.ground-r.pig.y)}assert(peak>=C.Runner.MIN_HOP,'最低跳高 '+peak)}
// 节奏派对：单击模式下三档谱面只用单点（一次一个、立刻松开）就能全部命中
for(const lv of ['easy','normal','hard']){const g=new CH.Rhythm(lv);g.assist=true;for(const n of g.notes.slice().sort((a,b)=>a.t-b.t)){if(n.done||n.started)continue;g.updateTo(n.t);g.press(n.lane,0);g.release(n.lane)}g.updateTo(g.duration+1);assert(g.won&&g.miss===0&&g.accuracy===100,lv+' 单击模式全中')}
// 关闭单击模式时，长条仍需按住、双键仍需同时按
{const g=new CH.Rhythm('hard');const n=g.notes.find(n=>n.hold);g.notes=[n];g.updateTo(n.t);g.press(n.lane,0);assert.equal(g.release(n.lane).type,'miss')}
// 切切猪：单击的短斜线（±24/±18）能切中经过点击位置的小猪
{const s=new CH.Slice('classic',()=>0.5);const p=s.launch('pig',380,0,0);p.y=200;s.beginStroke();const ev=s.slice({x:380-24,y:200+18},{x:380+24,y:200-18});assert(ev.some(e=>e.type==='cut'),'单击切中')}
console.log('PASS: click-only play — runner tap jumps clear the tallest fence and widest mud at 330–820 px/s (hold still jumps higher); rhythm click mode clears all three charts with single taps; a tap slices a pig.');
