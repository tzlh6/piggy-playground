// 斗地猪房间逻辑测试（不需要真实网络）：node test-doudizhu-net.cjs
// 用一个进程内的假“PiggyLan”把房主和两位客人连起来，跑完整多局，检查信息隐藏、掉线托管、重连、超时托管、拒绝加入。
const assert=require('assert');
const D=require('./app/doudizhu-core.js'),N=require('./app/doudizhu-net.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// ---- 假网络 ----
function hub(){
 const h={host:null,peers:new Map(),seq:0};
 h.hostApi={onRoomEvent:null,host:async()=>({ok:true,port:1,addrs:['10.0.0.2']}),room:()=>{},scan:()=>{},kick:id=>{const c=h.peers.get(id);if(c){h.peers.delete(id);setTimeout(()=>{h.emitHost({type:'peer-left',id});c.emit({type:'closed'})},1)}},leave:()=>{for(const [id,c] of h.peers){c.emit({type:'closed'})}h.peers.clear()},
  send:(to,msg)=>{const json=JSON.parse(JSON.stringify(msg));if(to==='*'){for(const c of h.peers.values())setTimeout(()=>c.emit({type:'msg',from:'host',msg:json}),0)}else{const c=h.peers.get(to);if(c)setTimeout(()=>c.emit({type:'msg',from:'host',msg:json}),0)}}};
 h.emitHost=ev=>{if(h.hostApi.onRoomEvent)h.hostApi.onRoomEvent(ev)};
 h.client=()=>{const c={onRoomEvent:null,id:null,emit:ev=>{if(c.onRoomEvent)c.onRoomEvent(ev)}};
  c.join=async()=>{c.id='p'+(++h.seq);h.peers.set(c.id,c);setTimeout(()=>h.emitHost({type:'peer',id:c.id,addr:'10.0.0.9'}),0);return {ok:true}};
  c.send=(_to,msg)=>{if(!h.peers.has(c.id))return;const json=JSON.parse(JSON.stringify(msg));setTimeout(()=>h.emitHost({type:'msg',from:c.id,msg:json}),0)};
  c.leave=()=>{if(h.peers.delete(c.id))setTimeout(()=>h.emitHost({type:'peer-left',id:c.id}),0)};c.kick=()=>{};
  c.drop=()=>{if(h.peers.delete(c.id)){setTimeout(()=>h.emitHost({type:'peer-left',id:c.id}),0)}};
  return c};
 return h;
}
// 每个“玩家”：记录收到的全部消息，轮到自己时用 AI 出牌
function player(name,tier,opts){
 const p={name,inbox:[],view:null,seat:-1,ai:new D.AI(tier||'smart',D.createRng(name.length*99)),room:null,lazy:false,acts:0};
 p.onLocal=msg=>{p.inbox.push(msg);if(msg.t==='welcome')p.seat=msg.seat;if(msg.view)p.view=msg.view;
  if(msg.t==='ev'||msg.t==='sync'){
   // 信息隐藏：只能看到自己的手牌
   for(const e of msg.events||[]){if(e.type!=='end')assert(!e.hands,'不能收到别人的手牌');if(e.type==='landlord'&&e.hand)assert.equal(e.seat,p.room.localSeat,'只有地主拿到整手牌')}
   if(msg.view){assert.equal(msg.view.hand.length,msg.view.counts[p.room.localSeat],'手牌数一致');assert(!('hands' in msg.view))}
   const v=msg.view;if(v&&v.phase!=='end'&&v.turn===p.room.localSeat&&!p.lazy){setTimeout(()=>{if(p.view!==v)return;p.acts++;p.room.localAct(p.ai.decide(v))},2)}
  }
  if(msg.t==='lobby'&&msg.lobby.phase==='result'&&opts&&opts.autoReady&&!msg.lobby.seats[p.room.localSeat].ready)setTimeout(()=>p.room.ready(p.room.localSeat),2);
 };
 return p;
}
(async()=>{
 const H=hub();
 const hp=player('房主','smart',{autoReady:true});
 const room=new N.Room({mode:'host',lan:H.hostApi,name:'房主',token:'t-host',onLocal:hp.onLocal,rng:D.createRng(5),speed:0.002,turnMs:{bid:300,play:300},version:'4.4.0'});hp.room=room;
 assert((await room.open()).ok);
 const pa=player('阿甲','smart',{autoReady:true}),pb=player('阿乙','devil',{autoReady:true});
 const ca=H.client(),cb=H.client();
 pa.room=new N.RemoteRoom({lan:ca,name:'阿甲',token:'tok-a',onLocal:pa.onLocal});pb.room=new N.RemoteRoom({lan:cb,name:'阿乙',token:'tok-b',onLocal:pb.onLocal});
 const ja=await pa.room.join('10.0.0.2',47321),jb=await pb.room.join('10.0.0.2',47321);assert(ja.ok&&jb.ok,'两位客人加入');
 assert.deepEqual([pa.seat,pb.seat],[1,2]);
 // 第四个人：满员被拒
 const c4=H.client(),p4=player('阿丙');p4.room=new N.RemoteRoom({lan:c4,name:'阿丙',token:'tok-c',onLocal:p4.onLocal});const j4=await p4.room.join('x',1);assert(!j4.ok&&/满/.test(j4.error),'满员拒绝');
 // 版本不同被拒
 const c5=H.client();await c5.join();await sleep(5);let rej=null;c5.onRoomEvent=ev=>{if(ev.type==='msg'&&ev.msg.t==='reject')rej=ev.msg.reason};c5.send('host',{t:'hello',proto:'ddz/0',name:'旧版'});await sleep(30);assert(rej&&/版本/.test(rej),'旧版本拒绝');
 // 名字被清洗
 assert.equal(room.seats[1].name,'阿甲');
 assert(room.start(),'开局');
 // 跑 6 局
 const t0=Date.now();
 while((room.game.round<6||room.phase!=='result')&&Date.now()-t0<60000)await sleep(20);
 assert(room.game.round>=6,'完成 6 局，实际 '+room.game.round);
 assert.equal(room.totals.reduce((a,b)=>a+b,0),0,'总分零和');
 // 客人看到的总分和房主一致
 await sleep(30);const lobA=[...pa.inbox].reverse().find(m=>m.t==='lobby');assert.deepEqual(lobA.lobby.seats.map(s=>s.total),room.totals);
 // ---- 掉线：电脑代打，对局继续；同一口令重连回到原座位 ----
 while(room.phase!=='game')await sleep(10);
 await sleep(40);cb.drop();await sleep(30);assert(room.seats[2].auto&&!room.seats[2].online,'掉线后托管');
 const roundAtDrop=room.game.round;
 while(room.game.round===roundAtDrop&&room.phase==='game')await sleep(10);
 const cb2=H.client(),pb2=player('阿乙','devil',{autoReady:true});pb2.room=new N.RemoteRoom({lan:cb2,name:'阿乙',token:'tok-b',onLocal:pb2.onLocal});
 // 对局进行中，新人（不同口令）不能加入；原口令可以回来
 const cx=H.client(),px=player('路人');px.room=new N.RemoteRoom({lan:cx,name:'路人',token:'zzz',onLocal:px.onLocal});
 if(room.phase==='game'){const jx=await px.room.join('x',1);assert(!jx.ok,'开打后陌生人不能加入')}
 const jb2=await pb2.room.join('x',1);assert(jb2.ok&&pb2.seat===2,'重连回到 2 号座位');
 await sleep(20);assert(pb2.inbox.some(m=>m.t==='sync'),'重连收到完整局面');
 room.setAuto(2,false);
 // ---- 超时：轮到不出牌的人，时间到自动出；连续两次超时进入托管 ----
 pa.lazy=true;
 const t1=Date.now();while(!room.seats[1].auto&&Date.now()-t1<20000)await sleep(20);
 assert(room.seats[1].auto,'连续超时后托管');pa.lazy=false;room.setAuto(1,false);
 // ---- 表情：限速 ----
 const before=hp.inbox.filter(m=>m.t==='emote').length;room.emote(1,2);room.emote(1,3);await sleep(10);assert.equal(hp.inbox.filter(m=>m.t==='emote').length-before,1,'表情限速');
 // ---- 非法操作被拒 ----
 const bad=room.act(1,{type:'play',cards:[999]});assert(bad,'非法操作被拒');
 // ---- 房主关门 ----
 let closedA=false;const old=pa.onLocal;pa.room.onLocal=m=>{if(m.t==='closed')closedA=true;old(m)};
 room.close();await sleep(200);assert(closedA,'客人收到关门');
 // ---- 客人端整理房主数据：恶意字段被清掉 ----
 {const m=N.cleanFromHost({t:'lobby',you:9,lobby:{phase:'x',seats:[{kind:'human',name:'<img src=x onerror=alert(1)>',avatar:{skin:'"><x',role:'pig" onload="'},total:'<i>',tier:'boss'}]}});
  assert(!/[<>"]/.test(m.lobby.seats[0].name),'名字去掉尖括号');assert.equal(m.lobby.seats[0].avatar.skin,'peach');assert.equal(m.lobby.seats[0].avatar.role,'pig');assert.equal(m.lobby.seats[0].total,0);assert.equal(m.lobby.seats.length,3);assert.equal(m.you,2);assert.equal(m.lobby.phase,'lobby');
  const ev=N.cleanFromHost({t:'ev',events:[{type:'play',seat:1,cards:[1,2,'x',999],pattern:{type:'<script>',main:'9'},left:3},{type:'evil'},{type:'end',deltas:['1e99',2,3],hands:[[1],[2],'x'],multParts:['bomb','<x>']}],view:{hand:[1,2],counts:['3'],phase:'hack'}});
  assert.deepEqual(ev.events[0].cards,[1,2,0,53]);assert.equal(ev.events[0].pattern.type,'single');assert.equal(ev.events.length,2,'未知事件被丢掉');assert.deepEqual(ev.events[1].multParts,['bomb']);assert.equal(ev.view.phase,'idle');assert.deepEqual(ev.view.counts,[3,0,0]);
  assert.equal(N.cleanFromHost({t:'evil'}),null,'未知消息丢掉')}
 // ---- 人机对战房间：界面驱动电脑 ----
 const sp=player('我','smart');const solo=new N.Room({mode:'solo',name:'我',onLocal:sp.onLocal,tiers:['easy','devil'],rng:D.createRng(9)});sp.room=solo;
 solo.start();let guard=0;while(solo.phase!=='result'&&guard++<3000){if(solo.aiSeat()>=0)solo.runAI();await sleep(1)}
 assert.equal(solo.phase,'result','人机一局打完');assert(sp.acts>0,'玩家自己出过牌');
 console.log(`PASS: doudizhu rooms — host + 2 LAN guests played ${room.game.round} rounds (totals ${room.totals.join('/')}), full-room & old-version rejects, private hands only, drop → AI takes over, same token rejoins the same seat, strangers blocked mid-game, turn timeouts → auto-play, emote rate limit, illegal actions refused, host close notifies guests, guest-side sanitizing of host data, solo AI room.`);
 process.exit(0);
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
