// 局域网联机端到端试玩：同一台电脑启动两个 Electron 22 窗口（各用自己的存档目录），
// A 开猪圈，B 在“找猪圈”里找到并加入，A 给空位补电脑后开始，两边自动打完一整局，检查信息隐藏与结算一致。
// 用法（Linux 需显示环境）：xvfb-run -a node tools/playtest-lan.cjs [项目目录] [截图目录]
const path=require('path'),fs=require('fs'),os=require('os');
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const ROOT=path.resolve(process.argv[2]||path.join(__dirname,'..'));const OUT=process.argv[3]&&path.resolve(process.argv[3]);if(OUT)fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const results=[];const must=(c,m)=>{if(!c)throw new Error(m)};
async function launch(tag){
 const user=fs.mkdtempSync(path.join(os.tmpdir(),'piggy-lan-'+tag+'-'));
 const app=await _electron.launch({executablePath:require(path.join(ROOT,'node_modules','electron')),args:[ROOT,'--no-sandbox'],cwd:ROOT,env:Object.assign({},process.env,{PIGGY_USERDATA:user,PIGGY_UPDATE_BASE:'http://127.0.0.1:9/'})});
 const win=await app.firstWindow();const errors=[];win.on('pageerror',e=>errors.push(e.message));win.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await win.waitForLoadState('domcontentloaded');await sleep(900);
 await win.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
 await win.evaluate(n=>{localStorage.setItem('piggy2-ddz-name',JSON.stringify(n))},tag==='A'?'房主小猪':'客人小猪');
 return {app,win,errors,tag};
}
async function shot(w,name){if(OUT){await sleep(700);await w.win.screenshot({path:path.join(OUT,name+'.png')})}}
async function step(name,fn){const t0=Date.now();try{const note=await fn();results.push({name,ok:true,note:note||'',ms:Date.now()-t0})}catch(e){results.push({name,ok:false,note:String(e.message||e).split('\n')[0],ms:Date.now()-t0})}}
(async()=>{
 const A=await launch('A'),B=await launch('B');
 const S=(w,f,a)=>w.win.evaluate(f,a);
 const openLan=async w=>{await w.win.click('.nav[data-game="doudizhu"]');await sleep(400);await w.win.click('#level [data-level="lan"]');await sleep(600)};
 await step('两边进入局域网联机',async()=>{await openLan(A);await openLan(B);must(await S(A,()=>!!document.getElementById('dz-host')),'A 有“开猪圈”');must(await S(B,()=>!!window.PiggyLan),'桌面版提供 PiggyLan');return '大厅显示开猪圈 / 找猪圈'});
 await step('A 开猪圈',async()=>{await A.win.click('#dz-host');await A.win.waitForSelector('.dz-seatcards',{timeout:8000});await shot(A,'lan-A-room');const addr=await S(A,()=>document.querySelector('.dz-addr').textContent);return addr.slice(0,60)});
 await step('B 找到并加入',async()=>{await B.win.waitForSelector('.dz-room',{timeout:10000});await shot(B,'lan-B-find');await B.win.click('.dz-room');await B.win.waitForSelector('.dz-seatcards',{timeout:8000});await sleep(500);
  const seats=await S(A,()=>PigDdzDebug.room().lobby().seats.map(s=>s.kind+':'+s.name));must(seats[1]==='human:客人小猪','A 看到 B 坐 1 号：'+seats.join());await shot(B,'lan-B-room');return seats.join(' / ')});
 await step('A 补电脑并开始',async()=>{await A.win.click('[data-ai="2"][data-tier="smart"]');await sleep(300);await A.win.click('#dz-start');await sleep(800);
  must(await S(B,()=>PigDdzDebug.state().overlay!=='room'),'B 收起房间面板');return 'AI 坐 2 号'});
 await step('猪猪表情：A 发，B 看到',async()=>{await A.win.click('#dz-emote-btn');await A.win.click('#dz-emotes [data-emote="2"]');await sleep(500);const txt=await S(B,()=>[...document.querySelectorAll('.dz-bubble.show')].map(b=>b.textContent).join('|'));must(txt.includes('炸得好'),'B 看到表情气泡：'+txt);return txt});
 await step('整局联机对打（双方自动出牌）',async()=>{
  const t0=Date.now();let shotGame=false,checks=0;
  while(Date.now()-t0<150000){
   for(const w of [A,B]){
    const st=await S(w,()=>{const t=PigDdzDebug.state();return {phase:t.disp.phase,turn:t.disp.turn,seat:t.seat,busy:PigDdzDebug.busy(),pending:t.pending,ov:t.overlay,hand:t.disp.hand.length,counts:t.disp.counts.slice()}});
    if(st.phase==='play'||st.phase==='bid'){checks++;if(st.hand!==st.counts[st.seat]&&!st.busy)throw new Error(w.tag+' 手牌数与公开张数不一致')}
    if(!shotGame&&st.phase==='play'&&w.tag==='B'){shotGame=true;await shot(B,'lan-B-game');await shot(A,'lan-A-game')}
    if(st.turn===st.seat&&!st.busy&&!st.pending&&(st.phase==='bid'||st.phase==='play')){
     await S(w,()=>{const t=PigDdzDebug.state();const D=PigDdzCore;if(t.disp.phase==='bid'){PigDdzDebug.bid(t.disp.highest<1?1:0);return}PigDdzDebug.hint();if(t.sel.size)PigDdzDebug.play();else PigDdzDebug.pass()});
    }
   }
   const done=await S(A,()=>PigDdzDebug.state().overlay==='result')&&await S(B,()=>PigDdzDebug.state().overlay==='result');
   if(done)break;await sleep(200);
  }
  const ra=await S(A,()=>PigDdzDebug.state().disp.result),rb=await S(B,()=>PigDdzDebug.state().disp.result);
  must(ra&&rb,'两边都出结算');must(JSON.stringify(ra.deltas)===JSON.stringify(rb.deltas),'两边结算一致');await shot(A,'lan-A-result');await shot(B,'lan-B-result');
  return `结算一致 ${ra.deltas.join('/')}，倍数 ×${ra.mult}，${checks} 次手牌数核对`});
 await step('信息隐藏：B 只收到自己的手牌',async()=>{const leak=await S(B,()=>{const r=PigDdzDebug.room();return !!(r&&r.game)});must(!leak,'客人端没有完整牌局对象');return '客人端只有 RemoteRoom，没有 Game'});
 await step('联机中 R 不会重开、P 不暂停',async()=>{await B.win.keyboard.press('r');await sleep(200);const still=await S(B,()=>!!(PigDdzDebug.room()&&!PigDdzDebug.room().closed));must(still,'R 后仍在房间');await B.win.keyboard.press('p');await sleep(200);must(!(await S(B,()=>document.getElementById('pause-layer').hidden===false)),'不暂停');return '房间保持'});
 await step('下一局：双方准备后自动开局',async()=>{await A.win.click('#dz-again');await B.win.click('#dz-again');await sleep(3500);const r=await S(A,()=>PigDdzDebug.room().game.round);must(r===2,'第 2 局开始，实际 '+r);return '第 2 局'});
 await step('B 离开：A 那边由电脑代打',async()=>{await S(B,()=>document.getElementById('dz-leave-btn').click());await sleep(1200);const seat=await S(A,()=>{const s=PigDdzDebug.room().seats[1];return {online:s.online,auto:s.auto}});must(!seat.online&&seat.auto,'B 掉线后托管');await shot(A,'lan-A-after-leave');return '座位 1 托管'});
 await step('B 手动输入地址重新加入，回到原座位',async()=>{await B.win.waitForSelector('#dz-ip',{timeout:10000});await B.win.fill('#dz-ip','127.0.0.1');await B.win.click('#dz-join-ip');await sleep(1800);const s=await S(A,()=>{const s=PigDdzDebug.room().seats[1];return {online:s.online,name:s.name}});must(s.online&&s.name==='客人小猪','重连');const seat=await S(B,()=>PigDdzDebug.state().seat);must(seat===1,'回到 1 号');return '回到 1 号座位'});
 await step('A 关掉猪圈，B 收到通知',async()=>{await S(A,()=>document.getElementById('dz-leave-btn').click());await sleep(1500);const ov=await S(B,()=>PigDdzDebug.state().overlay);must(ov==='menu','B 回到大厅，实际 '+ov);return 'B 回到找猪圈'});
 for(const w of [A,B])await w.app.close();
 const errs=[...A.errors,...B.errors];
 for(const r of results)console.log((r.ok?'PASS':'FAIL')+'  '+r.name.padEnd(22)+'  '+r.note);
 if(errs.length)console.log('页面错误：\n'+errs.join('\n'));
 const failed=results.filter(r=>!r.ok).length+errs.length;console.log(failed?'FAILED':'ALL PASSED');process.exit(failed?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
