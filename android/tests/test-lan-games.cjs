'use strict';
const assert=require('node:assert/strict'),path=require('path');
const app=path.resolve(process.argv[2]||path.join(__dirname,'../../desktop/app'));
const deps={boards:require(path.join(app,'board-session.js')),arcade:require(path.join(app,'arcade-core.js')),roulette:require(path.join(app,'roulette-core.js')),pool:require(path.join(app,'pool-core.js'))};
const G=require('../web/lan-games.js')(deps),sleep=ms=>new Promise(r=>setTimeout(r,ms));
function hub(){
  let seq=0;const peers=new Map(),events=new Set(),wire=[];
  const emit=(set,e)=>set.forEach(cb=>cb(structuredClone(e)));
  const host={onEvent:cb=>{events.add(cb);return()=>events.delete(cb);},host:async()=>({ok:true,port:47321,addrs:['192.168.1.2']}),room:()=>{},scan:()=>{},
    send:(to,msg)=>{wire.push({to,msg:structuredClone(msg)});for(const [id,p]of peers)if(to==='*'||to===id)queueMicrotask(()=>p.emit({type:'msg',from:'host',msg}));},
    kick:id=>{const p=peers.get(id);if(p){peers.delete(id);queueMicrotask(()=>{emit(events,{type:'peer-left',id});p.emit({type:'closed'});});}},
    leave:()=>{for(const p of peers.values())p.emit({type:'closed'});peers.clear();}};
  const client=()=>{const listeners=new Set();let id;const p={emit:e=>emit(listeners,e),onEvent:cb=>{listeners.add(cb);return()=>listeners.delete(cb);},
    join:async()=>{id='p'+(++seq);peers.set(id,p);queueMicrotask(()=>emit(events,{type:'peer',id}));return {ok:true};},
    send:(_,msg)=>{wire.push({from:id,msg:structuredClone(msg)});queueMicrotask(()=>emit(events,{type:'msg',from:id,msg}));},
    leave:()=>{if(peers.delete(id))queueMicrotask(()=>emit(events,{type:'peer-left',id}));},drop:()=>{host.kick(id);},scan:()=>{},room:()=>{},kick:()=>{}};return p;};
  return {host,client,wire};
}
(async()=>{
  for(const id of G.SUPPORTED){
    const m=new G.Match(id),p=m.turn,rev=m.revision;
    assert(!m.act(3-p,{col:0,x:0,y:0}).ok,id+' rejects wrong turn');assert.equal(m.revision,rev);
    const legal=id==='connect'?{col:0}:id==='roulette'?{type:'shoot',target:'opp'}:id==='pool'?{type:'shot',angle:0,power:.4}:m.core.legalMoves(p)[0];
    assert(m.act(p,legal).ok,id+' accepts legal action');assert.equal(m.revision,rev+1);
    assert(!m.act(m.turn,{type:'illegal',x:-1,y:NaN,col:-1}).ok,id+' rejects malformed move');
    assert(m.act(1,{type:'resign'}).ok);assert(m.status.over);assert.equal(m.status.winner,2);
    assert(!m.act(2,legal).ok,id+' rejects action after end');
  }
  const chess=new G.Match('chess');for(const [p,m]of [[1,{from:'f2',to:'f3'}],[2,{from:'e7',to:'e5'}],[1,{from:'g2',to:'g4'}],[2,{from:'d8',to:'h4'}]])assert(chess.act(p,m).ok);
  assert.equal(chess.status.reason,'checkmate');assert.equal(chess.status.winner,2);
  for(const id of ['connect','gomoku','reversi','dots','battleship']){
    const m=new G.Match(id);let n=0;while(!m.status.over&&n++<500){const a=id==='connect'?{col:[3,2,4,1,5,0,6].find(c=>m.core.row(c)>=0)}:id==='battleship'&&m.core.engine.phase==='placement'?{type:'auto-place'}:m.core.legalMoves(m.turn)[0];assert(m.act(m.turn,a).ok,id);}
    assert(m.status.over,id+' full game');
  }
  const sea=new G.Match('battleship');sea.act(1,{type:'auto-place'});sea.act(2,{type:'auto-place'});
  for(const p of [1,2]){const view=sea.view(p),text=JSON.stringify(view);assert(view.ownShips.length===5);assert(!('boards'in view)&&!('ships'in view)&&!text.includes('rngState'));assert.equal(view.players[2-p].sunk.length,0);assert(!('seed'in view));}
  const roulette=new G.Match('roulette');roulette.core.startStage(2);roulette.core.items[roulette.core.turn].push('xray');const rp=roulette.turn;roulette.act(rp,{type:'item',item:'xray'});
  assert(roulette.view(rp).clueList.length);assert.equal(roulette.view(3-rp).clueList.length,0);for(const p of [1,2]){const t=JSON.stringify(roulette.view(p));assert(!t.includes('"order"')&&!t.includes('"history"')&&!t.includes('"bags"'));}
  let stages=0;const rl=new G.Match('roulette');while(!rl.status.over&&stages++<1000){if(rl.core.phase==='stageOver')assert(rl.act(1,{type:'next-stage'}).ok);else assert(rl.act(rl.turn,{type:'shoot',target:'opp'}).ok);}assert(rl.status.over,'roulette full points match');
  const pool=new G.Match('pool');pool.act(1,{type:'shot',angle:0,power:.7});for(let i=0;i<500&&pool.core.phase==='moving';i++)pool.tick(50);assert.equal(pool.core.phase,'aim');assert(pool.view(1).balls.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)));
  for(const id of G.SUPPORTED){
    const net=hub();let local,remote;
    const host=new G.Host({lan:net.host,game:id,name:'房主',token:'h'.repeat(24),onChange:m=>local=m});await host.open();
    const c=net.client();let guest=new G.Guest({lan:c,game:id,name:'朋友',token:'a'.repeat(24),onChange:m=>remote=m});assert((await guest.join('192.168.1.2',47321)).ok);await sleep(1);assert(host.start());await sleep(1);
    assert.equal(local.round,remote.round);assert.equal(local.view.revision,remote.view.revision);
    const revision=host.match.revision;host.event({type:'msg',from:host.remote.peer,msg:{t:'act',id:1,revision:-1,round:host.round,a:{type:'resign'}}});assert.equal(host.match.revision,revision,'stale packet rejected');
    host.event({type:'msg',from:host.remote.peer,msg:{t:'presence',away:true}});assert(local.paused);assert(!host.localAct({type:'resign'}).ok);host.event({type:'msg',from:host.remote.peer,msg:{t:'presence',away:false}});
    c.drop();await sleep(1);assert(!local.online[1]);assert(!host.localAct({type:'resign'}).ok,'disconnected match pauses');guest.close();
    const c2=net.client();guest=new G.Guest({lan:c2,game:id,name:'朋友',token:'a'.repeat(24),onChange:m=>remote=m});assert((await guest.join('192.168.1.2',47321)).ok);await sleep(1);assert(local.online[1]);assert.equal(host.match.revision,revision,'reconnect keeps game');
    assert(host.localAct({type:'resign'}).ok);await sleep(1);assert.equal(remote.phase,'result');host.prepare(1);guest.prepare();await sleep(1);assert.equal(host.round,2,'mutual rematch');assert(!host.match.status.over);
    const wire=net.wire.filter(p=>p.msg.t==='state');for(const p of wire)assert(!('token'in p.msg)&&!('save'in p.msg),'private state omitted');guest.close();host.close();
  }
  console.log('PASS 9 LAN games: legal/illegal moves, complete games, chess mate, roulette stages/private clues, hidden fleets, pool physics, stale actions, pause, reconnect, mutual rematch');
})().catch(e=>{console.error(e);process.exitCode=1;});
