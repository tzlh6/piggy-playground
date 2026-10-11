// 猪猪轮盘生命周期检查：动画中重开 / 切换游戏 / 失焦暂停 / 换装 / 减少动态效果。
// 用法：node tools/playtest-roulette-lifecycle.cjs [index.html 路径]
const path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','app','index.html'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out=[];const must=(c,m)=>{if(!c)throw new Error(m)};
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1366,height:860}});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await p.goto('file://'+FILE);await sleep(300);
 // 让音频引擎真正工作，便于检查残留声音
 await p.mouse.click(5,5);await p.evaluate(()=>{Sound.unlock();Sound.enabled=true;Sound.volume=.5});
 const S=(f,a)=>p.evaluate(f,a);
 const fresh=async()=>{await p.click('.nav[data-game="roulette"]').catch(()=>{});await p.click('#restart');await p.waitForFunction(()=>{const D=PigRouletteDebug;return !D.busy()&&D.state().g.turn===0&&D.state().g.phase==='play'},null,{timeout:60000})};
 const rig=async(mag,items)=>S(([mag,items])=>{const t=PigRouletteDebug.state();t.g._setMagazine(mag);if(items)t.g.items[0]=items;Object.assign(t.disp,t.g.publicView(0));t.gunSlotsKey='';PigRouletteDebug.refresh()},[mag,items]);
 const atBeat=(kind,tm)=>p.waitForFunction(([k,tm])=>{const b=PigRouletteDebug.state().beat;return b&&b.kind===k&&b.t>=tm},[kind,tm],{timeout:15000,polling:'raf'});
 async function check(name,fn){try{out.push(['PASS',name,await fn()||''])}catch(e){out.push(['FAIL',name,e.message.split('\n')[0]])}}

 await check('动画中按“重新开始”：旧演出作废，不会扣新局的血',async()=>{await fresh();await rig(['real','real','fake']);await p.click('#rl-opp');await atBeat('shoot',1.0);
  const oldSession=await S(()=>PigRouletteDebug.state().session);await p.click('#restart');await sleep(50);
  const st=await S(()=>{const t=PigRouletteDebug.state();return {session:t.session,hp:t.g.hp.slice(),effects:Sound.effects.length,voices:Sound.voices.length}});
  must(st.session!==oldSession,'新会话');await sleep(2500);const hp2=await S(()=>PigRouletteDebug.state().g.hp.slice());
  must(hp2.join()==='4,4','新局血量没被旧演出扣：'+hp2.join());return `重开瞬间只有新局问候声（合成音 ${st.effects}、录音猪叫 ${st.voices}），2.5 秒后血量仍为 4:4`});
 await check('动画中切换到别的游戏：时间轴停止、声音清空',async()=>{await fresh();await rig(['real','fake'],['feed','meat']);await p.click('#rl-bag0 [data-k="0"]');await atBeat('feed',1.0);
  await p.click('.nav[data-game="mine"]');await sleep(60);const st=await S(()=>({effects:Sound.effects.length,timers:Sound.timers.length,game:document.body.dataset.game}));must(st.game==='mine','已切换');
  // 切换时新游戏会随机问候一声；等旧演出本应播完的时间后再查，确认旧时间轴没有继续发声
  await sleep(2500);const late=await S(()=>({effects:Sound.effects.length,voices:Sound.voices.length}));must(late.effects===0&&late.voices===0,'旧演出仍在发声 '+JSON.stringify(late));await p.click('.nav[data-game="roulette"]');await sleep(300);
  const t=await S(()=>{const t=PigRouletteDebug.state();return {round:t.g.round,boosted:t.g.boosted,items:t.g.items[0].length,beat:t.beat&&t.beat.kind}});must(!t.boosted,'回来是全新一局');return '回到轮盘：全新一局，第 '+t.round+' 局'});
 await check('动画中窗口失焦：自动暂停、时间冻结，继续后只结算一次',async()=>{await fresh();await rig(['real','fake','fake']);const hp0=await S(()=>PigRouletteDebug.state().disp.hp[1]);await p.click('#rl-opp');await atBeat('shoot',1.1);
  await S(()=>window.dispatchEvent(new Event('blur')));const t1=await S(()=>PigRouletteDebug.state().beat.t);await sleep(1200);const t2=await S(()=>PigRouletteDebug.state().beat.t);
  must(await S(()=>!document.getElementById('pause-layer').hidden),'出现暂停层');must(Math.abs(t2-t1)<1e-6,'暂停时时间轴冻结');must(await S(()=>Sound.effects.length===0),'暂停时声音停止');
  await p.click('#resume');await p.waitForFunction(()=>{const b=PigRouletteDebug.state().beat;return !b||b.kind!=='shoot'},null,{timeout:15000,polling:'raf'});
  const hp1=await S(()=>PigRouletteDebug.state().disp.hp[1]);must(hp1===hp0-1,`只扣一次血：${hp0}→${hp1}`);return `冻结在 t=${t1.toFixed(2)}s，恢复后从原位置继续`});
 await check('动画中换装：本局保留，造型恢复所选',async()=>{await fresh();await rig(['fake','real'],['book']);await p.click('#rl-bag0 [data-k="0"]');await atBeat('book',1.2);
  const costume=await S(()=>PigRouletteDebug.state().actors[0].costume);await S(()=>PigLook.choose('taro'));await sleep(40);
  await p.waitForFunction(()=>!PigRouletteDebug.busy(),null,{timeout:15000});const st=await S(()=>{const t=PigRouletteDebug.state();return {skin:t.actors[0].skin,costume:t.actors[0].costume,known:t.g.known[0],rival:t.actors[1].skin}});
  await S(()=>PigLook.choose('peach'));must(costume==='wizard-magic','演出中正处于魔法猪造型');must(st.skin==='taro'&&st.costume==='pig','换装后恢复自己的造型');must(st.known==='fake','线索仍在');return `魔法猪 → 芋泥配色基础猪，对手 ${st.rival}`});
 await check('P 暂停 / 继续：动画从原位置继续',async()=>{await fresh();await rig(['real','fake'],['meat']);await S(()=>{PigRouletteDebug.state().g.hp[0]=3});await p.click('#rl-bag0 [data-k="0"]');await atBeat('meat',.8);
  await p.keyboard.press('p');const t1=await S(()=>PigRouletteDebug.state().beat.t);await sleep(800);await p.keyboard.press('p');await p.waitForFunction(()=>!PigRouletteDebug.busy(),null,{timeout:15000});
  must(await S(()=>PigRouletteDebug.state().g.hp[0]===4),'回血一次');return `暂停于 ${t1.toFixed(2)}s`});
 await check('非法操作：说明原因且不改变状态',async()=>{await fresh();await rig(['real','fake'],['meat','feed']);await S(()=>{const t=PigRouletteDebug.state();t.g.hp[0]=4;Object.assign(t.disp,t.g.publicView(0));PigRouletteDebug.refresh()});const before=await S(()=>JSON.stringify(PigRouletteDebug.state().g.publicView(0)));
  await p.click('#rl-bag0 [data-k="0"]');const msg=await S(()=>document.getElementById('message').textContent+'|'+document.getElementById('message').className);const after=await S(()=>JSON.stringify(PigRouletteDebug.state().g.publicView(0)));
  must(before===after,'状态不变');must(/满/.test(msg)&&/warn/.test(msg),'显示原因：'+msg);return msg.split('|')[0]});
 await check('减少动态效果：镜头不动、演出照常完成',async()=>{const ctx=await b.newContext({viewport:{width:1100,height:760},reducedMotion:'reduce'});const q=await ctx.newPage();q.on('pageerror',e=>errors.push('reduced: '+e.message));await q.goto('file://'+FILE);await sleep(300);await q.click('.nav[data-game="roulette"]');
  await q.waitForFunction(()=>{const D=PigRouletteDebug;return !D.busy()&&D.state().g.turn===0},null,{timeout:60000});await q.evaluate(()=>{const t=PigRouletteDebug.state();t.g._setMagazine(['real','fake']);t.g.items[0]=['mud'];Object.assign(t.disp,t.g.publicView(0));PigRouletteDebug.refresh()});
  await q.click('#rl-bag0 [data-k="0"]');const cams=new Set();for(let k=0;k<12;k++){await sleep(150);cams.add(await q.evaluate(()=>document.getElementById('rl-cam').getAttribute('transform')))}
  await q.waitForFunction(()=>!PigRouletteDebug.busy(),null,{timeout:15000});const mud=await q.evaluate(()=>PigRouletteDebug.state().g.mud[1]);await ctx.close();must(cams.size===1,'镜头保持不动');must(mud,'泥巴结果保留');return '镜头固定，泥巴状态清楚'});

 // 帧率粗测：一段开枪演出里的平均帧间隔
 await check('演出帧率（Chromium，无节流）',async()=>{await fresh();await rig(['real','fake']);await S(()=>{window.__f=[];let last=performance.now();const loop=n=>{window.__f.push(n-last);last=n;if(window.__f.length<150)requestAnimationFrame(loop)};requestAnimationFrame(loop)});await p.click('#rl-opp');await sleep(2800);
  const f=await S(()=>window.__f.slice(5));const avg=f.reduce((a,b)=>a+b,0)/f.length,worst=Math.max(...f);must(avg<20,'平均帧间隔 '+avg.toFixed(1));return `平均 ${avg.toFixed(1)} ms（约 ${Math.round(1000/avg)} fps），最长 ${worst.toFixed(0)} ms`});

 await b.close();for(const r of out)console.log(r[0]+'  '+r[1]+'  '+r[2]);
 console.log(`\n${out.filter(r=>r[0]==='PASS').length}/${out.length} passed; page errors: ${errors.length?errors.join(' | '):'none'}`);
 process.exit(out.every(r=>r[0]==='PASS')&&!errors.length?0:1);
})();
