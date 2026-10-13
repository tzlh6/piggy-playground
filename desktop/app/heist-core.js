/* 猪猪夺宝：机关乱斗 · 本地规则引擎。MIT.
 * 不依赖 DOM、网络、时钟或随机数。界面只提交行动、播放事件，不能修改权威状态。
 * 浏览器：PigHeistCore；Node：require('./app/heist-core.js')。
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PigHeistCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const RULES_VERSION = '1.0.0';
  const DIRS = Object.freeze([
    Object.freeze({id:'E', q:1, r:0}), Object.freeze({id:'SE', q:0, r:1}),
    Object.freeze({id:'SW', q:-1, r:1}), Object.freeze({id:'W', q:-1, r:0}),
    Object.freeze({id:'NW', q:0, r:-1}), Object.freeze({id:'NE', q:1, r:-1})
  ]);
  const LIMITS = Object.freeze({radius:4, ap:2, bag:5, bombs:2, blast:2, launch:2, chain:64});
  const COSTS = Object.freeze({move:1, push:1, plant:1, rotate:1, toggle:1, end:0});
  const ERRORS = Object.freeze({
    BAD_ACTION:'无法识别这个行动。', BAD_SEAT:'玩家编号无效。', NOT_TURN:'还没轮到这位玩家。',
    STALE:'棋局已经变化，请刷新后再操作。', OVER:'本局已经结束。', NO_AP:'行动点不足。',
    BLOCKED:'这个位置无法进入。', NO_TARGET:'相邻位置没有可推动的目标。',
    NO_BOMB:'臭臭弹不足，或已有两颗在场上。', BAD_TILE:'这个位置没有可操作的机关。',
    TOO_FAR:'只能操作自己所在格或相邻格的机关。', OCCUPIED_GATE:'连动闸门上有猪猪或臭臭弹，暂时不能关闭。'
  });
  const privateGames = new WeakMap();
  const clone = value => JSON.parse(JSON.stringify(value));
  const key = p => p.q + ',' + p.r;
  const same = (a,b) => !!a && !!b && a.q === b.q && a.r === b.r;
  const point = p => ({q:p.q,r:p.r});
  const add = (p,d,n) => ({q:p.q+d.q*(n || 1),r:p.r+d.r*(n || 1)});
  const distance = (a,b) => Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
  const validPoint = p => p && Number.isInteger(p.q) && Number.isInteger(p.r) && Math.abs(p.q)<=12 && Math.abs(p.r)<=12;
  const dirOf = d => DIRS.find(x => x.id === d);
  const tileAt = (s,p) => s.board.tiles.find(t => same(t,p));
  const pigEntity = id => ({kind:'pig',id});
  const bombEntity = id => ({kind:'bomb',id});
  const recordOf = (s,e) => e.kind==='pig' ? s.players[e.id] : s.bombs.find(b=>b.id===e.id);
  const posOf = (s,e) => {const x=recordOf(s,e);return x ? (e.kind==='pig' ? x.pos : point(x)) : null;};
  function occupant(s,p,exclude) {
    const pig=s.players.find(x=>same(x.pos,p) && !(exclude && exclude.kind==='pig' && exclude.id===x.id));
    if(pig)return pigEntity(pig.id);
    const bomb=s.bombs.find(x=>same(x,p) && !(exclude && exclude.kind==='bomb' && exclude.id===x.id));
    return bomb ? bombEntity(bomb.id) : null;
  }
  function options(input) {
    const o=input || {};
    const c={players:o.players===undefined?2:o.players,first:o.first===undefined?0:o.first,
      target:o.target===undefined?10:o.target,maxRounds:o.maxRounds===undefined?24:o.maxRounds};
    for(const name of Object.keys(o))if(!Object.prototype.hasOwnProperty.call(c,name))throw new Error('未知配置：'+name);
    if(!Number.isInteger(c.players)||c.players<2||c.players>4)throw new Error('players 必须为 2、3 或 4');
    if(!Number.isInteger(c.first)||c.first<0||c.first>=c.players)throw new Error('first 必须为有效座位');
    if(!Number.isInteger(c.target)||c.target<5||c.target>30)throw new Error('target 必须为 5～30');
    if(!Number.isInteger(c.maxRounds)||c.maxRounds<4||c.maxRounds>40)throw new Error('maxRounds 必须为 4～40');
    return c;
  }
  function initial(config) {
    const c=options(config),tiles=[];
    for(let q=-4;q<=4;q++)for(let r=-4;r<=4;r++)if(distance({q,r},{q:0,r:0})<=4)tiles.push({q,r,kind:'floor'});
    const put=(p,attrs)=>Object.assign(tiles.find(t=>same(t,p)),attrs);
    put({q:0,r:0},{kind:'well',rate:2,cap:6});
    const portals=DIRS.map((d,i)=>add(d,DIRS[(i+1)%6]));
    DIRS.forEach((d,i)=>{
      put(d,{kind:'well',rate:1,cap:2});
      put(add({q:0,r:0},d,2),{kind:'spring',dir:DIRS[(i+3)%6].id});
      put(add({q:0,r:0},d,3),{kind:'gate',group:i%3,open:true});
      put(portals[i],{kind:'portal',exit:point(portals[(i+3)%6])});
      put(add(add({q:0,r:0},d,2),DIRS[(i+1)%6],2),{kind:'pit'});
    });
    const seats={2:[0,3],3:[0,2,4],4:[0,1,3,4]}[c.players];
    const players=seats.map((v,id)=>{
      const home=add({q:0,r:0},DIRS[v],4);put(home,{kind:'home',owner:id});
      return {id,home,pos:point(home),carry:0,score:0,ammo:2,falls:0};
    });
    return {schemaVersion:1,rulesVersion:RULES_VERSION,config:c,board:{radius:4,tiles},players,
      // 中央井首轮为空，避免先手直接拿走一大包；首轮结束后按公开节奏产出。
      piles:tiles.filter(t=>t.kind==='well'&&(t.q!==0||t.r!==0)).map(t=>({q:t.q,r:t.r,count:1})),bombs:[],
      turn:c.first,round:1,turnNumber:0,ap:2,revision:0,nextBombId:1,phase:'playing',result:null};
  }
  function passable(s,p,e) {
    const t=tileAt(s,p);
    return !!t && t.kind!=='pit' && !(t.kind==='gate'&&!t.open) &&
      !(t.kind==='home' && (e.kind==='bomb'||t.owner!==e.id));
  }
  function normalize(action) {
    if(!action || typeof action!=='object' || Array.isArray(action) || !Object.prototype.hasOwnProperty.call(COSTS,action.type))return null;
    const type=action.type;
    const fields=type==='end'?['type']:type==='rotate'?['type','at','step']:type==='toggle'?['type','at']:['type','dir'];
    if(Object.keys(action).some(k=>!fields.includes(k)))return null;
    if(type==='end')return {type};
    if(type==='rotate'||type==='toggle') {
      if(!validPoint(action.at)||Object.keys(action.at).some(k=>k!=='q'&&k!=='r'))return null;
      if(type==='rotate' && action.step!==1 && action.step!==-1)return null;
      return type==='rotate'?{type,at:point(action.at),step:action.step}:{type,at:point(action.at)};
    }
    return dirOf(action.dir)?{type,dir:action.dir}:null;
  }
  function validate(s,seat,a,revision) {
    if(!Number.isInteger(seat)||seat<0||seat>=s.players.length)return 'BAD_SEAT';
    if(!Number.isInteger(revision)||revision!==s.revision)return 'STALE';
    if(s.phase!=='playing')return 'OVER';
    if(seat!==s.turn)return 'NOT_TURN';
    if(!a)return 'BAD_ACTION';
    if(s.ap<COSTS[a.type])return 'NO_AP';
    const p=s.players[seat],e=pigEntity(seat);
    if(a.type==='end')return null;
    if(a.type==='move') {
      const to=add(p.pos,dirOf(a.dir));
      return !passable(s,to,e)||occupant(s,to)?'BLOCKED':null;
    }
    if(a.type==='push') {
      const at=add(p.pos,dirOf(a.dir)),target=occupant(s,at),t=tileAt(s,at);
      return !target||t.kind==='home'?'NO_TARGET':null;
    }
    if(a.type==='plant') {
      if(p.ammo<1||s.bombs.filter(b=>b.owner===seat).length>=2)return 'NO_BOMB';
      const to=add(p.pos,dirOf(a.dir));
      return !passable(s,to,bombEntity(-1))||occupant(s,to)?'BLOCKED':null;
    }
    if(distance(p.pos,a.at)>1)return 'TOO_FAR';
    const t=tileAt(s,a.at);
    if(!t || (a.type==='rotate'?t.kind!=='spring':t.kind!=='gate'))return 'BAD_TILE';
    if(a.type==='toggle' && t.open && s.board.tiles.some(x=>x.kind==='gate'&&x.group===t.group&&occupant(s,x)))return 'OCCUPIED_GATE';
    return null;
  }
  function legalActions(s) {
    if(s.phase!=='playing')return [];
    const all=[{type:'end'}],p=s.players[s.turn];
    for(const d of DIRS)for(const type of ['move','push','plant'])all.push({type,dir:d.id});
    for(const t of s.board.tiles)if(distance(p.pos,t)<=1) {
      if(t.kind==='spring')for(const step of [-1,1])all.push({type:'rotate',at:point(t),step});
      if(t.kind==='gate')all.push({type:'toggle',at:point(t)});
    }
    return all.filter(a=>!validate(s,s.turn,a,s.revision));
  }
  class Resolver {
    constructor(s) {this.s=s;this.events=[];}
    emit(type,data) {this.events.push(Object.assign({id:this.s.revision+':'+this.events.length,type},data||{}));}
    context() {return {seen:new Set(),moving:new Set(),steps:0};}
    pile(p,delta) {
      let pile=this.s.piles.find(x=>same(x,p));
      if(!pile){pile={q:p.q,r:p.r,count:0};this.s.piles.push(pile);}
      pile.count+=delta;
      if(pile.count===0)this.s.piles=this.s.piles.filter(x=>x!==pile);
      return pile.count;
    }
    restock(p) {
      const ammo=LIMITS.bombs-this.s.bombs.filter(b=>b.owner===p.id).length;
      if(p.ammo!==ammo){p.ammo=ammo;this.emit('restock',{seat:p.id,ammo});}
    }
    collect(e) {
      if(e.kind!=='pig')return;
      const p=recordOf(this.s,e);if(!p.pos)return;
      const pile=this.s.piles.find(x=>same(x,p.pos));
      if(pile&&p.carry<LIMITS.bag) {
        const amount=Math.min(pile.count,LIMITS.bag-p.carry);p.carry+=amount;
        const left=this.pile(p.pos,-amount);this.emit('pickup',{seat:p.id,at:point(p.pos),amount,carry:p.carry,left});
      }
      if(same(p.pos,p.home)) {
        if(p.carry){const amount=p.carry;p.score+=amount;p.carry=0;this.emit('deposit',{seat:p.id,amount,score:p.score});}
        this.restock(p);
      }
    }
    spill(p,amount,at,reason) {
      amount=Math.min(amount,p.carry);if(!amount)return;
      p.carry-=amount;
      const candidates=this.s.board.tiles.filter(t=>t.kind!=='pit'&&t.kind!=='home'&&!(t.kind==='gate'&&!t.open))
        .sort((a,b)=>distance(a,at)-distance(b,at)||a.q-b.q||a.r-b.r);
      const drops=[];
      for(let i=0;i<amount;i++){const dest=candidates[i%candidates.length],count=this.pile(dest,1);drops.push({q:dest.q,r:dest.r,count});}
      this.emit('spill',{seat:p.id,amount,carry:p.carry,reason,drops});
    }
    fall(e,from,to,reason) {
      if(e.kind==='pig') {
        const p=recordOf(this.s,e);this.spill(p,p.carry,from,'fall');p.pos=null;p.falls++;
        this.emit('fall',{entity:e.kind,entityId:e.id,from:point(from),to:point(to),reason,respawn:'next-own-turn'});
      } else {
        this.s.bombs=this.s.bombs.filter(b=>b.id!==e.id);
        this.emit('fall',{entity:e.kind,entityId:e.id,from:point(from),to:point(to),reason,respawn:null});
      }
    }
    relocate(e,to,mode,dir,forced,ctx) {
      const from=posOf(this.s,e);if(!from)return false;
      const entityKey=e.kind+e.id;
      if(ctx.steps++>=LIMITS.chain||ctx.moving.has(entityKey)) {
        this.emit('chainStopped',{entity:e.kind,entityId:e.id,at:point(from),reason:'cycle-or-limit'});return false;
      }
      const t=tileAt(this.s,to);
      if(!t||t.kind==='pit') {
        if(!forced)return false;
        this.emit('move',{entity:e.kind,entityId:e.id,from:point(from),to:point(to),mode});
        this.fall(e,from,to,t?'pit':'edge');return true;
      }
      if(!passable(this.s,to,e)) {this.emit('bump',{entity:e.kind,entityId:e.id,at:point(from),against:point(to),reason:'terrain'});return false;}
      const other=occupant(this.s,to,e);
      if(other) {
        ctx.moving.add(entityKey);
        if(forced) {
          const otherTile=tileAt(this.s,posOf(this.s,other));
          if(otherTile.kind!=='home')this.relocate(other,add(posOf(this.s,other),dir), 'domino',dir,true,ctx);
        }
        ctx.moving.delete(entityKey);
        if(occupant(this.s,to,e)) {this.emit('bump',{entity:e.kind,entityId:e.id,at:point(from),against:point(to),reason:'occupied'});return false;}
      }
      const rec=recordOf(this.s,e);
      if(e.kind==='pig')rec.pos=point(to);else Object.assign(rec,point(to));
      this.emit('move',{entity:e.kind,entityId:e.id,from:point(from),to:point(to),mode});
      this.land(e,ctx);return true;
    }
    land(e,ctx) {
      const pos=posOf(this.s,e);if(!pos)return;
      this.collect(e);
      const t=tileAt(this.s,pos);
      if(t.kind!=='spring'&&t.kind!=='portal')return;
      const signature=e.kind+e.id+':'+key(pos)+':'+(t.dir||'portal');
      if(ctx.seen.has(signature)) {this.emit('chainStopped',{entity:e.kind,entityId:e.id,at:point(pos),reason:'repeated-device'});return;}
      ctx.seen.add(signature);
      if(t.kind==='spring') {
        const d=dirOf(t.dir),to=add(pos,d,LIMITS.launch);
        this.emit('spring',{entity:e.kind,entityId:e.id,at:point(pos),dir:t.dir,to});
        this.relocate(e,to,'launch',d,true,ctx);
      } else {
        const to=point(t.exit);
        // 出口被占时留在入口；传送不挤人，也不立即从出口传回来。
        if(occupant(this.s,to,e)) {this.emit('portalBlocked',{entity:e.kind,entityId:e.id,at:point(pos),exit:to});return;}
        const rec=recordOf(this.s,e);
        if(e.kind==='pig')rec.pos=point(to);else Object.assign(rec,to);
        this.emit('teleport',{entity:e.kind,entityId:e.id,from:point(pos),to});this.collect(e);
      }
    }
    explode(ids) {
      const queue=ids.slice().sort((a,b)=>a-b),done=new Set();
      while(queue.length) {
        const id=queue.shift(),b=this.s.bombs.find(x=>x.id===id);if(!b||done.has(id))continue;done.add(id);
        this.s.bombs=this.s.bombs.filter(x=>x.id!==id);
        const cells=[point(b)],rays=[];
        for(const d of DIRS)for(let n=1;n<=LIMITS.blast;n++) {
          const at=add(b,d,n),t=tileAt(this.s,at);
          if(!t||t.kind==='home'||(t.kind==='gate'&&!t.open))break;
          cells.push(at);rays.push({at,dir:d});
          const bomb=this.s.bombs.find(x=>same(x,at));
          if(bomb){queue.push(bomb.id);break;}
        }
        queue.sort((a,b)=>a-b);
        const hits=this.s.players.filter(p=>p.pos).map(p=>({p,ray:rays.find(x=>same(x.at,p.pos))})).filter(x=>x.ray);
        this.emit('explode',{bombId:id,owner:b.owner,at:point(b),cells});
        // 同波较早的击退可能把另一只猪送回家门；安全区立即生效。
        for(const hit of hits)if(hit.p.pos&&!same(hit.p.pos,hit.p.home)) {
          this.emit('hit',{seat:hit.p.id,bombId:id,at:point(hit.p.pos),dir:hit.ray.dir.id});
          this.spill(hit.p,1,hit.p.pos,'blast');
          this.relocate(pigEntity(hit.p.id),add(hit.p.pos,hit.ray.dir),'blast',hit.ray.dir,true,this.context());
        }
      }
    }
    finish(reason) {
      const best=Math.max(...this.s.players.map(p=>p.score));
      this.s.phase='finished';this.s.ap=0;
      this.s.result={reason,winners:this.s.players.filter(p=>p.score===best).map(p=>p.id),
        scores:this.s.players.map(p=>p.score),round:this.s.round};
      this.emit('finish',clone(this.s.result));
    }
    advance() {
      const s=this.s;this.emit('turnEnd',{seat:s.turn,turnNumber:s.turnNumber});
      const completed=s.turnNumber+1;
      if(completed%s.players.length===0) {
        this.emit('roundEnd',{round:s.round,scores:s.players.map(p=>p.score)});
        if(s.players.some(p=>p.score>=s.config.target)){this.finish('target');return;}
        if(s.round>=s.config.maxRounds){this.finish('round-limit');return;}
        s.round++;this.emit('roundStart',{round:s.round});
        for(const t of s.board.tiles)if(t.kind==='well') {
          const old=s.piles.find(p=>same(p,t)),amount=Math.max(0,Math.min(t.rate,t.cap-(old?old.count:0)));
          if(amount){const count=this.pile(t,amount);this.emit('supply',{at:point(t),amount,count});}
        }
        // 新松露长在脚下时也自动捡取，不要求玩家先离开再回来。
        for(const p of s.players)if(p.pos&&tileAt(s,p.pos).kind==='well')this.collect(pigEntity(p.id));
      }
      s.turnNumber=completed;s.turn=(s.config.first+s.turnNumber)%s.players.length;
      for(const b of s.bombs)this.emit('fuse',{bombId:b.id,remainingTurns:Math.max(0,b.dueTurn-s.turnNumber)});
      this.explode(s.bombs.filter(b=>b.dueTurn<=s.turnNumber).map(b=>b.id));
      const p=s.players[s.turn];
      if(!p.pos) {p.pos=point(p.home);this.restock(p);this.emit('respawn',{seat:p.id,at:point(p.home),ammo:p.ammo});}
      s.ap=LIMITS.ap;this.emit('turnStart',{seat:s.turn,round:s.round,turnNumber:s.turnNumber,ap:s.ap});
    }
    run(a) {
      const s=this.s,p=s.players[s.turn],e=pigEntity(p.id),ctx=this.context();
      this.emit('action',{seat:p.id,action:clone(a)});
      s.ap-=COSTS[a.type];this.emit('ap',{seat:p.id,ap:s.ap});
      if(a.type==='move')this.relocate(e,add(p.pos,dirOf(a.dir)),'walk',dirOf(a.dir),false,ctx);
      if(a.type==='push') {
        const d=dirOf(a.dir),at=add(p.pos,d),target=occupant(s,at);
        this.emit('push',{seat:p.id,target:clone(target),at});
        if(target.kind==='pig')this.spill(recordOf(s,target),1,at,'push');
        this.relocate(target,add(at,d),'push',d,true,ctx);
        if(!occupant(s,at)&&passable(s,at,e))this.relocate(e,at,'follow',d,false,ctx);
      }
      if(a.type==='plant') {
        const at=add(p.pos,dirOf(a.dir)),bomb={id:s.nextBombId++,owner:p.id,q:at.q,r:at.r,dueTurn:s.turnNumber+s.players.length};
        s.bombs.push(bomb);p.ammo--;this.emit('plant',{seat:p.id,bomb:clone(bomb),ammo:p.ammo});
        this.land(bombEntity(bomb.id),ctx);
      }
      if(a.type==='rotate') {
        const t=tileAt(s,a.at),from=t.dir,idx=DIRS.findIndex(d=>d.id===from);t.dir=DIRS[(idx+a.step+6)%6].id;
        this.emit('rotate',{seat:p.id,at:point(t),from,to:t.dir});
        // 旋转只改朝向；站在机关上的实体必须离开并再次落入才触发。
      }
      if(a.type==='toggle') {
        const t=tileAt(s,a.at),open=!t.open,tiles=s.board.tiles.filter(x=>x.kind==='gate'&&x.group===t.group);
        tiles.forEach(x=>{x.open=open;});this.emit('gates',{seat:p.id,group:t.group,open,tiles:tiles.map(point)});
      }
      if(!p.pos)s.ap=0;
      if(a.type==='end'||s.ap===0)this.advance();
      return this.events;
    }
  }
  function transition(s,seat,action,revision) {
    const a=normalize(action),error=validate(s,seat,a,revision);
    if(error)return {ok:false,code:error,message:ERRORS[error],events:[],view:clone(s)};
    const next=clone(s);next.revision++;
    const events=new Resolver(next).run(a);
    return {ok:true,code:null,events,view:next};
  }
  function checkView(s) {
    // 此入口供 AI/Worker 接收公开快照；外部存档一律用 Game.load 重放校验。
    if(!s||s.rulesVersion!==RULES_VERSION||s.schemaVersion!==1||!s.config||!Array.isArray(s.players)||s.players.length<2||s.players.length>4||
      !s.board||!Array.isArray(s.board.tiles)||s.board.tiles.length!==61||!Array.isArray(s.bombs)||s.bombs.length>8||
      !Array.isArray(s.piles)||s.piles.length>61)throw new Error('不是有效的夺宝引擎快照');
  }
  class Game {
    constructor(config) {const state=initial(config);privateGames.set(this,{state,history:[]});}
    view() {return clone(privateGames.get(this).state);}
    legalActions() {return legalActions(privateGames.get(this).state);}
    act(seat,action,revision) {
      const g=privateGames.get(this),result=transition(g.state,seat,action,revision);
      if(result.ok){g.state=result.view;g.history.push({seat,action:normalize(action)});}
      return clone(result);
    }
    preview(seat,action,revision) {return transition(privateGames.get(this).state,seat,action,revision);}
    save() {const g=privateGames.get(this);return {schemaVersion:1,rulesVersion:RULES_VERSION,config:clone(g.state.config),actions:clone(g.history)};}
    undo() {
      const g=privateGames.get(this);if(!g.history.length)return {ok:false,code:'NO_HISTORY',view:this.view(),events:[]};
      const data=this.save();data.actions.pop();const restored=Game.load(data),r=privateGames.get(restored);
      // 撤销也提高修订号，防止撤销前的 Worker 结果在相同局面误提交。
      r.state.revision=g.state.revision+1;privateGames.set(this,r);
      return {ok:true,view:this.view(),events:[{id:r.state.revision+':0',type:'restored'}]};
    }
    static load(data) {
      if(typeof data==='string'){if(data.length>150000)throw new Error('存档过大');data=JSON.parse(data);}
      if(!data||data.schemaVersion!==1||data.rulesVersion!==RULES_VERSION||!Array.isArray(data.actions)||data.actions.length>320)throw new Error('不支持的存档');
      const game=new Game(data.config);
      for(const entry of data.actions) {
        if(!entry||typeof entry!=='object')throw new Error('存档行动损坏');
        const result=game.act(entry.seat,entry.action,game.view().revision);
        if(!result.ok)throw new Error('存档行动非法：'+result.code);
      }
      return game;
    }
    static replay(data) {
      const game=Game.load(data),archive=game.save(),cursor=new Game(archive.config),frames=[{events:[],view:cursor.view()}];
      for(const entry of archive.actions)frames.push(cursor.act(entry.seat,entry.action,cursor.view().revision));
      return frames;
    }
  }
  function simulate(view,action) {checkView(view);return transition(view,view.turn,action,view.revision);}
  function actionsFor(view) {checkView(view);return legalActions(view);}
  // 路线估值使用的“落点”：忽略其他实体，不改状态；所有真实判定仍以 simulate/act 为准。
  function landing(view,seat,from,dir) {
    const d=dirOf(dir);if(!d)return null;
    let p=add(from,d);const e=pigEntity(seat),seen=new Set();
    if(!passable(view,p,e))return null;
    for(let n=0;n<LIMITS.chain;n++) {
      const t=tileAt(view,p),k=key(p);if(seen.has(k))return p;seen.add(k);
      if(t.kind==='portal')return point(t.exit);
      if(t.kind!=='spring')return p;
      const to=add(p,dirOf(t.dir),2),nt=tileAt(view,to);
      if(!nt||nt.kind==='pit')return null;
      if(!passable(view,to,e))return p;p=to;
    }
    return p;
  }
  return Object.freeze({RULES_VERSION,DIRS,LIMITS,COSTS,ERRORS,Game,simulate,legalActions:actionsFor,landing,distance});
});
