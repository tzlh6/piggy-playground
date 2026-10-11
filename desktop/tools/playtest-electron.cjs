// 用 Electron 22（Chromium 108，与 Win7 便携版同内核）启动桌面程序，检查 18 款游戏与轮盘演出。
// 用法（Linux 需显示环境，可用 xvfb-run）：xvfb-run -a node tools/playtest-electron.cjs [项目目录] [截图目录]
const path=require('path'),fs=require('fs');
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const ROOT=path.resolve(process.argv[2]||path.join(__dirname,'..'));const OUT=process.argv[3]&&path.resolve(process.argv[3]);if(OUT)fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const games=['mine','memory','merge','whack','snake','runner','blocks','breakout','flappy','stack','connect','sokoban','lights','match','slice','shooter','rhythm','roulette'];
(async()=>{
 const app=await _electron.launch({executablePath:require(path.join(ROOT,'node_modules','electron')),args:[path.join(ROOT,'main.cjs')],cwd:ROOT});
 const win=await app.firstWindow();const errors=[];win.on('pageerror',e=>errors.push(e.message));win.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await win.waitForLoadState('domcontentloaded');await sleep(800);
 const info=await win.evaluate(()=>({chrome:navigator.userAgent.match(/Chrome\/([\d.]+)/)[1],title:document.title,games:document.querySelectorAll('.nav[data-game]').length,count:document.getElementById('game-count').textContent,version:document.querySelector('.version').textContent,voices:(window.PIG_VOICES||[]).length,skins:Object.keys(window.PIG_SKIN_URI||{}).length}));
 console.log('Electron',info.chrome,'|',info.title,'|',info.games,'个入口 |',info.count,'|',info.version);
 const res=[];
 for(const g of games){try{await win.click(`.nav[data-game="${g}"]`);await sleep(300);
   await win.evaluate(g=>{const c=id=>{const e=document.getElementById(id);if(e)e.click()};c('extra-go');c('challenge-go');c('snake-go');c('runner-go');c('start-whack')},g);await sleep(g==='roulette'?3500:700);
   const ok=await win.evaluate(()=>!!document.querySelector('#board').children.length);res.push([g,ok]);if(OUT)await win.screenshot({path:path.join(OUT,'electron-'+g+'.png')})}catch(e){res.push([g,false,e.message])}}
 // 轮盘：等到玩家回合，用道具与开枪各一次，测帧率
 await win.click('.nav[data-game="roulette"]');await win.waitForFunction(()=>{const D=PigRouletteDebug;return !D.busy()&&D.state().g.turn===0},null,{timeout:90000});
 await win.evaluate(()=>{const t=PigRouletteDebug.state();t.g.items[0]=['feed','xray','book'];t.g._setMagazine(['real','fake','real']);Object.assign(t.disp,t.g.publicView(0));PigRouletteDebug.refresh();window.__f=[];let last=performance.now();const loop=n=>{window.__f.push(n-last);last=n;if(window.__f.length<400)requestAnimationFrame(loop)};requestAnimationFrame(loop)});
 await win.click('#rl-bag0 [data-k="0"]');await win.waitForFunction(()=>!PigRouletteDebug.busy(),null,{timeout:20000});
 await win.click('#rl-bag0 .rl-item.xray');await win.click('#rl-slots [data-slot="2"]');await win.waitForFunction(()=>!PigRouletteDebug.busy(),null,{timeout:20000});
 await win.click('#rl-opp');await sleep(1700);if(OUT)await win.screenshot({path:path.join(OUT,'electron-roulette-shot.png')});await win.waitForFunction(()=>{const b=PigRouletteDebug.state().beat;return !b||b.kind!=='shoot'},null,{timeout:20000});
 const st=await win.evaluate(()=>{const t=PigRouletteDebug.state(),f=window.__f.slice(10),avg=f.reduce((a,b)=>a+b,0)/f.length;return {hp:t.disp.hp,known:t.g.known,boosted:t.g.boosted,avg,slow:f.filter(x=>x>34).length,n:f.length}});
 await app.close();
 for(const r of res)console.log((r[1]?'PASS':'FAIL')+'  '+r[0]+(r[2]?'  '+r[2]:''));
 console.log(`轮盘（饲料 → X 光 → 强化真屎打对手）：对手血量 ${st.hp[1]}，强化已消耗 ${!st.boosted}；平均帧间隔 ${st.avg.toFixed(1)} ms（约 ${Math.round(1000/st.avg)} fps），超过 34 ms 的帧 ${st.slow}/${st.n}`);
 console.log('page errors:',errors.length?errors.join(' | '):'none');
 process.exit(res.every(r=>r[1])&&!errors.length&&st.hp[1]===2&&!st.boosted?0:1);
})();
