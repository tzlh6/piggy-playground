/* Android multiplayer rules. Only the host owns a Match. Guests receive views,
 * never saves/seeds/decks/fleets. The game cores are the existing offline cores. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.PigLanGames = factory({boards:root.PigBoardGames, arcade:root.PigArcadeCore,
    roulette:root.PigRouletteCore, pool:root.PigPoolCore});
})(typeof window !== 'undefined' ? window : globalThis, function(D) {
  'use strict';
  const PROTO = 'piggy-games/1';
  const SUPPORTED = ['connect','roulette','pool','xiangqi','chess','gomoku','reversi','battleship','dots'];
  const copy = v => JSON.parse(JSON.stringify(v));
  const name = v => String(v || '小猪').replace(/[<>&"'`\u0000-\u001f]/g,'').trim().slice(0,12) || '小猪';
  const validToken = s => typeof s === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(s);
  const int = (n,a,b) => Number.isInteger(n) && n >= a && n <= b;
  function cleanMove(m) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
    const a = {};
    for (const k of ['type','from','to','promotion','orientation','target','item']) if (typeof m[k] === 'string' && m[k].length <= 20) a[k] = m[k];
    for (const k of ['x','y','col','angle','power']) if (Number.isFinite(m[k])) a[k] = m[k];
    if (typeof m.horizontal === 'boolean') a.horizontal = m.horizontal;
    return a;
  }
  class Match {
    constructor(game) {
      if (!SUPPORTED.includes(game)) throw Error('不支持的联机游戏');
      this.game = game; this.revision = 0; this.resigned = null; this.last = '';
      if (game === 'connect') this.core = new D.arcade.Connect();
      else if (game === 'roulette') this.core = new D.roulette.Game();
      else if (game === 'pool') this.core = new D.pool.Pool('local');
      else this.core = D.boards.create(game, game === 'dots' ? {width:5,height:5} :
        game === 'battleship' ? {seed:Math.floor(Math.random()*4294967295)} : undefined);
    }
    get turn() { return this.core.turn + (['roulette','pool'].includes(this.game) ? 1 : 0); }
    get status() {
      if (this.resigned) return this.resigned;
      const c = this.core;
      if (this.game === 'connect') return {over:c.over,winner:c.winner,reason:c.winner?'four':'board-full'};
      if (this.game === 'roulette') return {over:c.phase==='matchOver',winner:c.winner<0?null:c.winner+1,reason:'points'};
      if (this.game === 'pool') return {over:c.over,winner:c.winner===null?null:c.winner+1,reason:c.last?.reason||'eight-ball'};
      return c.status;
    }
    act(player, raw) {
      const a = cleanMove(raw), c = this.core;
      if (!a || !int(player,1,2) || this.status.over) return {ok:false,error:'本局已经结束或操作无效'};
      if (a.type === 'resign') { this.resigned = {over:true,winner:3-player,reason:'resignation'}; this.revision++; this.last = '一方认输，本局结束'; return {ok:true}; }
      if (this.game === 'roulette' && a.type === 'next-stage' && c.phase === 'stageOver') {
        c.nextStage(); this.revision++; this.last = '进入下一阶段'; return {ok:true};
      }
      if (player !== this.turn) return {ok:false,error:'请等待对方行动'};
      let ok = false, detail = '';
      try {
        if (this.game === 'connect') ok = int(a.col,0,6) && !!c.drop(a.col);
        else if (this.game === 'roulette') {
          const r = c.act(player-1,a); ok = r.ok; detail = r.reason || '';
          if (ok) {
            const shot = r.events.find(e => e.type === 'shot');
            this.last = a.type === 'item' ? '使用了'+(D.roulette.ITEM_INFO[a.item]?.name||'道具') :
              shot ? (shot.shell==='real'?'真屎命中！':'假屎，噗！') : '发射完成';
          }
        } else if (this.game === 'pool') {
          if (a.type === 'cue') ok = c.placeCue(a.x,a.y);
          else if (a.type === 'shot' && Number.isFinite(a.angle) && a.angle >= -Math.PI*2 && a.angle <= Math.PI*2) ok = c.shoot(a.angle,a.power);
        } else {
          // Filtered moves cannot supply a ship placement list or a restore/save.
          const r = c.dispatch(player,a); ok = r.ok;
        }
      } catch (error) { ok = false; }
      if (!ok) return {ok:false,error:detail || '这个操作不符合当前规则，请重新选择'};
      this.revision++;
      return {ok:true};
    }
    tick(ms) {
      if (this.game !== 'pool' || this.status.over || this.core.phase !== 'moving') return false;
      this.core.update(Math.min(100,ms));
      if (this.core.phase !== 'moving') { this.last = this.core.last?.foul ? '犯规：'+this.core.last.reason : this.core.last?.again ? '进球，继续出杆' : '轮到另一位出杆'; this.revision++; }
      return true;
    }
    view(player) {
      const c = this.core, base = {game:this.game,revision:this.revision,turn:this.turn,status:copy(this.status),last:this.last};
      if (this.game === 'connect') return {...base,board:c.board.slice(),moves:c.moves,line:c.line.slice()};
      if (this.game === 'roulette') return {...base,...c.publicView(player-1),turn:this.turn,status:copy(this.status),
        winner:c.winner<0?null:c.winner+1,clueList:c.clueList(player-1),stageWinner:c.stageWinner<0?null:c.stageWinner+1};
      if (this.game === 'pool') return {...base,balls:copy(c.balls),groups:c.groups.slice(),phase:c.phase,ballInHand:c.ballInHand,
        shots:c.shots.slice(),pottedBy:copy(c.pottedBy),lastShot:copy(c.last),break:c.break};
      return {...c.view(player),...base,legal:copy(c.legalMoves(player))};
    }
  }
  class Host {
    constructor(o) {
      this.lan = o.lan; this.game = o.game; this.name = name(o.name); this.onChange = o.onChange || (()=>{});
      this.token = o.token; this.match = null; this.phase = 'lobby'; this.closed = false; this.sequence = 0; this.round = 0;
      this.remote = null; this.waiting = new Map(); this.ready = [false,false]; this.lastIds = new Map(); this.paused = false; this.hostAway = false; this.guestAway = false;
      this.unlisten = this.lan.onEvent(e => this.event(e));
    }
    info() { return {name:this.name+'的猪圈',game:this.game,players:this.remote?2:1,seats:2,
      open:!this.remote&&this.phase==='lobby'?1:0,rejoin:this.remote&&!this.remote.online?1:0,
      state:this.phase,version:'5.0.0',proto:PROTO}; }
    async open() {
      const r = await this.lan.host(this.info());
      if (this.closed) { await this.lan.leave(); return {ok:false}; }
      if (r?.ok) { this.address = r; this.push(); } return r;
    }
    packet(player) { return {t:'state',proto:PROTO,game:this.game,phase:this.phase,round:this.round,seq:++this.sequence,you:player,
      names:[this.name,this.remote?.name||'等待朋友'],online:[true,!!this.remote?.online],ready:this.ready.slice(),paused:this.paused,
      view:this.match?this.match.view(player):null}; }
    push() {
      if (this.closed) return;
      this.lan.room(this.info()); this.onChange(this.packet(1));
      if (this.remote?.online) this.lan.send(this.remote.peer,this.packet(2));
    }
    start() {
      if (this.closed || !this.remote?.online || this.match && !this.match.status.over) return false;
      this.match = new Match(this.game); this.phase = 'game'; this.ready = [false,false]; this.round++; this.lastIds.clear(); this.push(); return true;
    }
    action(player,a,revision,round) {
      if (this.paused || !this.remote?.online) return {ok:false,error:'连接暂停，请等双方回到房间'};
      if (!this.match || round !== this.round || revision !== this.match.revision) return {ok:false,error:'局面已更新，请按最新局面操作'};
      const r = this.match.act(player,a);
      if (r.ok) { if (this.match.status.over) this.phase = 'result'; this.push(); }
      return r;
    }
    localAct(a) { return this.action(1,a,this.match?.revision,this.round); }
    prepare(player) {
      if (!this.match?.status.over || !this.remote?.online) return false;
      this.ready[player-1] = true;
      if (this.ready.every(Boolean)) return this.start(); this.push(); return true;
    }
    event(e) {
      if (this.closed) return;
      if (e.type === 'peer') {
        this.waiting.set(e.id,setTimeout(()=>{this.waiting.delete(e.id);this.lan.kick(e.id);},7000)); return;
      }
      if (e.type === 'peer-left') {
        clearTimeout(this.waiting.get(e.id)); this.waiting.delete(e.id);
        if (this.remote?.peer === e.id) {
          if (!this.match) this.remote = null;
          else { this.remote.online = false; this.remote.peer = null; this.ready = [false,false]; }
          this.push();
        } return;
      }
      if (e.type !== 'msg') return;
      const m = e.msg || {};
      if (m.t === 'hello') {
        const reject = error => { this.lan.send(e.from,{t:'reject',reason:error}); this.lan.kick(e.from); };
        if (m.proto !== PROTO || m.game !== this.game || !validToken(m.token)) return reject('游戏或版本不同，请双方使用安卓 5.0.0');
        if (this.remote && (this.remote.online || this.remote.token !== m.token)) return reject('房间已满，或正在等待原玩家重连');
        clearTimeout(this.waiting.get(e.from)); this.waiting.delete(e.from);
        this.remote = {peer:e.from,token:m.token,name:name(m.name),online:true};
        this.guestAway = false; this.paused = this.hostAway;
        this.lastIds.delete(e.from); this.ready = [false,false]; this.lan.send(e.from,{t:'welcome',proto:PROTO,game:this.game}); this.push(); return;
      }
      if (!this.remote?.online || this.remote.peer !== e.from) return;
      if (m.t === 'act') {
        if (!int(m.id,1,Number.MAX_SAFE_INTEGER) || m.id <= (this.lastIds.get(e.from)||0)) return;
        this.lastIds.set(e.from,m.id);
        const r = this.action(2,m.a,m.revision,m.round);
        if (!r.ok) { this.lan.send(e.from,{t:'deny',reason:r.error}); this.push(); }
      } else if (m.t === 'ready' && m.round === this.round) this.prepare(2);
      else if (m.t === 'presence') { this.guestAway=!!m.away;this.paused=this.hostAway||this.guestAway;this.push(); }
      else if (m.t === 'sync') this.lan.send(e.from,this.packet(2));
      else if (m.t === 'bye') { this.lan.kick(e.from); }
    }
    setPaused(on) { this.hostAway = !!on; this.paused = this.hostAway || this.guestAway; this.push(); }
    tick(ms) {
      if (this.closed || this.paused || !this.remote?.online || !this.match?.tick(ms)) return;
      if (this.match.status.over) this.phase = 'result';
      this.sincePush = (this.sincePush||0)+ms;
      if (this.sincePush >= 80 || this.match.core.phase !== 'moving') { this.sincePush = 0; this.push(); }
    }
    close() {
      if (this.closed) return; this.closed = true;
      this.lan.send('*',{t:'closed',reason:'房主关闭了房间'}); this.unlisten?.();
      for (const t of this.waiting.values()) clearTimeout(t); this.waiting.clear();
      return this.lan.leave();
    }
  }
  class Guest {
    constructor(o) {
      this.lan=o.lan;this.game=o.game;this.name=name(o.name);this.token=o.token;this.onChange=o.onChange||(()=>{});this.onError=o.onError||(()=>{});
      this.id=0;this.closed=false;this.seq=0;this.connected=false;
      this.unlisten=this.lan.onEvent(e=>this.event(e));
    }
    async join(host,port) {
      const r = await this.lan.join(host,port);
      if (!r?.ok || this.closed) return r || {ok:false};
      const answer = new Promise(resolve=>{this.resolve=resolve;this.timer=setTimeout(()=>{this.finish({ok:false,error:'房主没有回应，请检查游戏和版本'});this.lan.leave();},7000);});
      this.lan.send('host',{t:'hello',proto:PROTO,game:this.game,name:this.name,token:this.token}); return answer;
    }
    finish(r) { clearTimeout(this.timer);const f=this.resolve;this.resolve=null;if(f)f(r); }
    event(e) {
      if(this.closed)return;
      if(e.type==='closed'){this.connected=false;this.finish({ok:false,error:'连接断开'});this.onError('和房主断开了。点“重新加入”可回到原座位。');return;}
      if(e.type!=='msg'||e.from!=='host')return;
      const m=e.msg||{};
      if(m.t==='reject'){this.finish({ok:false,error:String(m.reason||'加入失败').slice(0,120)});return;}
      if(m.t==='closed'){this.connected=false;this.onError(String(m.reason||'房间已关闭').slice(0,120));return;}
      if(m.t==='deny'){this.onError(String(m.reason||'操作无效').slice(0,120));return;}
      if(m.proto!==PROTO||m.game!==this.game)return;
      if(m.t==='welcome'){this.connected=true;this.finish({ok:true});return;}
      if(m.t==='state' && m.you===2 && int(m.seq,1,Number.MAX_SAFE_INTEGER) && m.seq>this.seq && ['lobby','game','result'].includes(m.phase)) {
        // Never execute strings from the network. UI uses textContent / escaped text.
        if (m.view && (m.view.game !== this.game || !int(m.view.revision,0,1e7))) return;
        this.seq=m.seq;this.state=copy(m);this.onChange(this.state);
      }
    }
    localAct(a) {
      if(!this.connected||!this.state?.view)return {ok:false,error:'尚未连接到房间'};
      this.lan.send('host',{t:'act',id:++this.id,round:this.state.round,revision:this.state.view.revision,a:cleanMove(a)});return {ok:true};
    }
    prepare(){if(this.connected)this.lan.send('host',{t:'ready',round:this.state?.round});}
    sync(){if(this.connected)this.lan.send('host',{t:'sync'});}
    close(){if(this.closed)return;this.closed=true;this.finish({ok:false});this.unlisten?.();this.lan.send('host',{t:'bye'});return this.lan.leave();}
  }
  return {PROTO,SUPPORTED,Match,Host,Guest,name,cleanMove};
});
