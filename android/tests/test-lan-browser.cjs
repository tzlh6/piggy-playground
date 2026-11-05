/* End-to-end phone UI + separate JVM native transports using real TCP/UDP.
 * Compile LanNetworkTests first. Configure PIGGY_LAN_QA, PIGGY_JAVA,
 * PIGGY_LAN_CLASSPATH, PIGGY_CHROMIUM and optionally PIGGY_PLAYWRIGHT.
 * This is a host test, not an Android-device installation test. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{spawn}=require('child_process'),readline=require('readline');
const {chromium}=require(process.env.PIGGY_PLAYWRIGHT||'playwright');
const out=process.env.PIGGY_LAN_QA,assets=path.resolve(__dirname,'../assets');
assert(out&&process.env.PIGGY_JAVA&&process.env.PIGGY_LAN_CLASSPATH&&process.env.PIGGY_CHROMIUM,'Missing test configuration');fs.mkdirSync(out,{recursive:true});
const errors=[],transports=[],clients=[],tests=[];
let browser;
async function client(width=390){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
  const child=spawn(process.env.PIGGY_JAVA,['-Dfile.encoding=UTF-8','-cp',process.env.PIGGY_LAN_CLASSPATH,'local.piggy.playground.LanNetworkTests','--serve'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  transports.push(child);child.stderr.on('data',b=>errors.push('Java: '+b.toString().slice(0,200)));
  const channel=readline.createInterface({input:child.stdout});
  channel.on('line',line=>{let m;try{m=JSON.parse(line);}catch(e){errors.push(line.slice(0,200));return;}page.evaluate(m=>{if(!window.PiggyLan)return;if(m.event)PiggyLan._event(m.event);else PiggyLan._reply(m);},m).catch(e=>{if(!page.isClosed())errors.push('Bridge delivery: '+e.message);});});
  await page.exposeFunction('__nativeLan',(id,op,payload)=>child.stdin.write(JSON.stringify({id,op,data:JSON.parse(payload)})+'\n'));
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('Console: '+m.text().slice(0,300));});
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin!=='https://appassets.androidplatform.net')return route.abort();
    const rel=decodeURIComponent(url.pathname).slice(1);if(rel!=='game.html'&&!/^assets\/engines\/(stockfish|pikafish|rapfi|egaroucid)\/part-\d+\.js$/.test(rel))return route.abort();
    await route.fulfill({contentType:rel.endsWith('.html')?'text/html; charset=utf-8':'application/javascript',body:fs.readFileSync(path.join(assets,rel))});
  });
  await page.addInitScript(()=>{
    for(const [k,v]of Object.entries({'seen-version':'5.0.0','seen-android-version':'5.0.0','chess-difficulty-v493':true,'level-mine':'easy'}))localStorage.setItem('piggy2-'+k,JSON.stringify(v));
    localStorage.setItem('upgrade-proof','preserved');
    window.PiggyLanAndroid={call:(id,op,payload)=>window.__nativeLan(id,op,payload)};
    window.PiggyAndroidBridge={info:()=>JSON.stringify({current:'5.0.0',currentCode:50010,nativeRevision:7,status:'idle',auto:false}),check(){},setAuto(){},download(){},install(){},openPage(){}};
  });
  await page.goto('https://appassets.androidplatform.net/game.html');await page.waitForFunction(()=>window.PigAndroidLan&&document.body.dataset.androidReady==='true');
  assert.equal(await page.evaluate(()=>PigAndroid.version),'5.0.0');assert.equal(await page.evaluate(()=>localStorage.getItem('upgrade-proof')),'preserved');
  assert.equal(await page.locator('[data-mobile-game]').count(),29);assert.equal(await page.locator('[data-lan-game]').count(),10);
  clients.push(page);return page;
}
async function enter(page,id){
  if(await page.locator('#android-games[open]').count())await page.locator('#android-hall-lan').click();else await page.locator('#android-lan').click();
  await page.locator('[data-lan-game="'+id+'"]').click();
  await page.waitForFunction(id=>game===id&&level==='lan',id);
}
async function sameRevision(a,b){
  const rev=await a.locator('#stat2').textContent();await b.waitForFunction(rev=>document.getElementById('stat2').textContent===rev,rev);return rev;
}
async function joinGeneric(a,b,id,useDiscovery=false){
  await enter(a,id);await enter(b,id);await a.locator('#lan-host').click();await a.locator('.lan-addresses b').first().waitFor();
  const info=await a.evaluate(()=>PiggyLan.info());
  if(useDiscovery){await b.waitForFunction(port=>[...document.querySelectorAll('[data-lan-room] span')].some(x=>x.textContent.endsWith(':'+port)),info.port);const r=b.locator('[data-lan-room]').filter({hasText:':'+info.port}).first();await r.click();}
  else{await b.locator('#lan-address').fill('127.0.0.1:'+info.port);await b.locator('#lan-join').click();}
  await a.locator('#lan-start').waitFor();await a.waitForFunction(()=>!document.getElementById('lan-start').disabled);await a.locator('#lan-start').click();
  await a.locator('#lan-play').waitFor();await b.locator('#lan-play').waitFor();return info;
}
async function resignAndRematch(a,b){
  await a.locator('#lan-resign').click();await a.locator('#lan-resign-confirm').click();await a.locator('#lan-ready').waitFor();await b.locator('#lan-ready').waitFor();
  await a.locator('#lan-ready').click();await b.locator('#lan-ready').click();await a.locator('#lan-resign').waitFor();await b.locator('#lan-resign').waitFor();
  assert((await a.locator('#lan-turn').textContent()).includes('轮到'));assert.equal(await a.locator('#stat2').textContent(),'0');
}
(async()=>{
  browser=await chromium.launch({headless:true,executablePath:process.env.PIGGY_CHROMIUM});
  const a=await client(),b=await client(360);
  await a.screenshot({path:path.join(out,'lan-hall.png'),fullPage:true});
  const targets=['connect','xiangqi','chess','gomoku','reversi','dots','battleship','roulette','pool'].filter(id=>!process.env.PIGGY_LAN_GAMES||process.env.PIGGY_LAN_GAMES.split(',').includes(id));
  for(const id of targets){
    await joinGeneric(a,b,id,id==='gomoku');
    if(id==='connect')await a.locator('[data-col="0"]').first().click();
    else if(id==='xiangqi'){await a.locator('[data-square="a0"]').click();await a.locator('[data-square="a1"]').click();}
    else if(id==='chess'){await a.locator('[data-square="e2"]').click();await a.locator('[data-square="e4"]').click();}
    else if(id==='gomoku')await a.locator('[data-x="7"][data-y="7"]').click();
    else if(id==='reversi')await a.locator('[data-x="3"][data-y="2"]').click();
    else if(id==='dots')await a.locator('[data-edge="h"][data-x="0"][data-y="0"]').click();
    else if(id==='battleship'){
      await a.locator('#lan-random').click();await b.waitForFunction(()=>!document.getElementById('lan-random').disabled);await b.locator('#lan-random').click();await a.locator('[data-sea="enemy"]').first().waitFor();await a.locator('[data-sea="enemy"][data-x="0"][data-y="0"]').click();
      const ownA=await a.locator('.lan-sea .ship').count(),ownB=await b.locator('.lan-sea .ship').count();assert.equal(ownA,17);assert.equal(ownB,17);
    }else if(id==='roulette'){
      const first=await a.locator('#lan-shoot-opp').isEnabled()?a:b;await first.locator('#lan-shoot-opp').click();
    }else if(id==='pool'){
      await a.locator('#lan-power').fill('65');await a.locator('#lan-pool-shoot').click();await a.waitForFunction(()=>Number(document.getElementById('stat2').textContent)>1,null,{timeout:20000});
    }
    await a.waitForFunction(()=>Number(document.getElementById('stat2').textContent)>0);await sameRevision(a,b);
    if(id==='chess'){
      await b.evaluate(()=>PigAndroid.onLanForeground(false));await a.waitForFunction(()=>document.getElementById('lan-turn').textContent.includes('暂停'));
      await b.evaluate(()=>PigAndroid.onLanForeground(true));await a.waitForFunction(()=>!document.getElementById('lan-turn').textContent.includes('暂停'));
      const rev=await a.locator('#stat2').textContent();await a.evaluate(async()=>{const i=await PiggyLan.info();await PiggyLan.kick(i.peers[0]);});
      await b.locator('#lan-reconnect').waitFor();await b.locator('#lan-reconnect').click();await b.waitForFunction(()=>!document.getElementById('lan-reconnect'));assert.equal(await a.locator('#stat2').textContent(),rev);await sameRevision(a,b);
    }
    await a.screenshot({path:path.join(out,'lan-'+id+'.png'),fullPage:true});
    if(id==='gomoku')assert.equal(await a.locator('.lan-grid button').first().evaluate(b=>getComputedStyle(b,'::before').height),'1px','15-column board lines remain one pixel');
    if(id==='xiangqi')assert((await a.locator('main>header .top-actions').boundingBox()).height<65,'Header controls stay on one row');
    assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,id+' phone overflow');
    assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,id+' narrow phone overflow');
    await resignAndRematch(a,b);await a.locator('#lan-exit').click();await b.locator('#lan-exit').click();tests.push(id);console.log('PASS real TCP + phone clicks: '+id+' (start, move, sync, result, mutual rematch)');
  }
  if(!process.env.PIGGY_LAN_SKIP_DDZ){
  const c=await client(390);for(const page of [a,b,c])await enter(page,'doudizhu');
  await a.locator('#dz-host').click();await a.locator('#dz-start').waitFor();const info=await a.evaluate(()=>PiggyLan.info());
  for(const page of [b,c]){await page.locator('#dz-ip').fill('127.0.0.1:'+info.port);await page.locator('#dz-join-ip').click();await page.locator('#dz-leave3').waitFor();}
  await a.waitForFunction(()=>state.lobby?.seats?.every(s=>s.kind==='human'));await a.screenshot({path:path.join(out,'lan-ddz-room.png'),fullPage:true});
  assert((await a.locator('#dz-start').boundingBox()).width>100,'Phone lobby controls remain full size');
  await a.locator('#dz-start').click();
  for(const page of [a,b,c])await page.waitForFunction(()=>state.disp?.hand?.length===17,{timeout:15000});
  const hands=await Promise.all([a,b,c].map(page=>page.evaluate(()=>state.disp.hand)));
  assert.equal(new Set(hands.flat()).size,51,'Three independent hands');
  for(const page of [b,c])assert.equal(await page.evaluate(()=>state.room.game===undefined),true,'Guest has no authoritative deck');
  const pages=[a,b,c];let bidder;
  for(const page of pages){await page.waitForFunction(()=>state.disp.phase==='bid',{timeout:15000});if(await page.evaluate(()=>state.disp.turn===state.seat))bidder=page;}
  assert(bidder);await bidder.waitForFunction(()=>!state.beat&&!state.queue.length&&state.disp.turn===state.seat,{timeout:15000});
  const bid=bidder.locator('#dz-actions [data-bid="3"]');await bid.click();
  for(const page of pages)await page.waitForFunction(()=>state.disp.phase==='play',{timeout:20000});
  await a.screenshot({path:path.join(out,'lan-ddz-play.png'),fullPage:true});tests.push('doudizhu');console.log('PASS three-player real TCP ddz: mobile lobby, three private hands, bid/landlord/play sync');
  await a.locator('#dz-leave-btn').click();await a.locator('#android-hall-button').click();await a.locator('[data-mobile-game="xiangqi"]').click();await a.locator('#android-xiangqi-school').click();await a.locator('#xq-school').waitFor({state:'visible'});await a.locator('#xq-school .xqs-close').click();
  }
  assert.deepEqual(errors,[]);assert.equal(tests.length,targets.length+(process.env.PIGGY_LAN_SKIP_DDZ?0:1));
  fs.writeFileSync(path.join(out,process.env.PIGGY_LAN_GAMES?'browser-lan-layout.json':'browser-lan-results.json'),JSON.stringify({version:'5.0.0',games:tests,realTcpUdp:true,separateJavaTransports:true,phoneWidths:[360,390],reconnect:!process.env.PIGGY_LAN_GAMES,backgroundPause:!process.env.PIGGY_LAN_GAMES,mutualRematch:true,threePlayerDdz:!process.env.PIGGY_LAN_SKIP_DDZ,schoolRetained:!process.env.PIGGY_LAN_SKIP_DDZ,realAndroidDevices:false,errors},null,2));
})().catch(e=>{console.error(e);if(out)fs.writeFileSync(path.join(out,'browser-lan-failure.json'),JSON.stringify({error:e.stack,errors},null,2));process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();for(const child of transports){child.stdin.end();child.kill();}
});
