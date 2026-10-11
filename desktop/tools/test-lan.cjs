// 局域网中继（主进程 lan.cjs）端到端测试：同一台电脑上开房、找房、加入、双向收发、踢人、断线。
// 用法：node tools/test-lan.cjs
const assert=require('assert');
const {Lan}=require('../lan.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function rec(){const ev=[];return {ev,emit:e=>ev.push(e),wait:async(pred,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||4000)){const hit=ev.find(pred);if(hit)return hit;await sleep(20)}throw new Error('等待超时')}}}
(async()=>{
 const opts={discoveryPort:47390,tcpPort:47391};
 const H=rec(),A=rec(),B=rec(),C=rec();
 const host=new Lan(Object.assign({emit:H.emit},opts)),a=new Lan(Object.assign({emit:A.emit},opts)),b=new Lan(Object.assign({emit:B.emit},opts)),c=new Lan(Object.assign({emit:C.emit},opts));
 const r=await host.host({name:'测试猪圈',game:'doudizhu',players:1,seats:3,open:2,state:'lobby',version:'4.4.0',proto:'ddz/1'});
 assert(r.ok&&r.port===47391,'开房成功');
 // 找房间（本机 127.0.0.1 应答）
 a.scan(true);const rooms=await A.wait(e=>e.type==='rooms'&&e.list.length);assert.equal(rooms.list[0].room.name,'测试猪圈');assert.equal(rooms.list[0].port,47391);a.scan(false);
 // 端口被占用时换下一个
 const other=new Lan(Object.assign({emit:()=>{}},opts));const r2=await other.host({name:'第二个'});assert(r2.ok&&r2.port===47392,'端口顺延');other.close();
 // 加入、收发
 const j=await a.join('127.0.0.1',r.port);assert(j.ok,'A 加入');const pa=await H.wait(e=>e.type==='peer');
 const jb=await b.join('127.0.0.1',r.port);assert(jb.ok,'B 加入');const pb=await H.wait(e=>e.type==='peer'&&e.id!==pa.id);
 a.send('host',{t:'hello',name:'甲',big:'猪'.repeat(2000)});const m=await H.wait(e=>e.type==='msg'&&e.from===pa.id);assert.equal(m.msg.name,'甲');assert.equal(m.msg.big.length,2000);
 host.send(pb.id,{t:'only-b'});await B.wait(e=>e.type==='msg'&&e.msg.t==='only-b');await sleep(150);assert(!A.ev.some(e=>e.type==='msg'&&e.msg.t==='only-b'),'单发只到 B');
 host.send('*',{t:'all',n:3});await A.wait(e=>e.type==='msg'&&e.msg.t==='all');await B.wait(e=>e.type==='msg'&&e.msg.t==='all');
 // 一次写入多条、跨包拆分也能正确分行
 const sock=a.client.sock;sock.write(JSON.stringify({t:'x1'})+'\n'+JSON.stringify({t:'x2'}).slice(0,5));await sleep(60);sock.write(JSON.stringify({t:'x2'}).slice(5)+'\n');
 await H.wait(e=>e.type==='msg'&&e.msg.t==='x2');assert(H.ev.some(e=>e.type==='msg'&&e.msg.t==='x1'));
 // 非法行被忽略，不影响后续
 sock.write('not json\n[1,2]\n');a.send('host',{t:'after'});await H.wait(e=>e.type==='msg'&&e.msg.t==='after');
 // 超长行直接断开
 const evil=new Lan(Object.assign({emit:C.emit},opts));await evil.join('127.0.0.1',r.port);const pe=await H.wait(e=>e.type==='peer'&&e.id!==pa.id&&e.id!==pb.id);evil.client.sock.write('x'.repeat(600*1024));await H.wait(e=>e.type==='peer-left'&&e.id===pe.id,5000);
 // 踢人
 host.kick(pb.id);await B.wait(e=>e.type==='closed');await H.wait(e=>e.type==='peer-left'&&e.id===pb.id);
 // 房主关门，客人收到断开
 host.close();await A.wait(e=>e.type==='closed');
 // 连不上的地址
 const bad=await c.join('127.0.0.1',47399);assert(!bad.ok,'无人监听时加入失败');
 const fmt=await c.join('bad host!',1);assert(!fmt.ok);
 [a,b,c,evil].forEach(x=>x.close());
 console.log('PASS: LAN relay — host/port fallback, UDP room discovery, join, unicast/broadcast, line framing across packets, junk lines ignored, oversized line drops the peer, kick, host close, connect failures.');
 process.exit(0);
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
