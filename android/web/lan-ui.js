/* Phone LAN screens. Offline controllers and their scores/saves remain independent. */
(() => {
  'use strict';
  const G = window.PigLanGames, api = window.PiggyLan, ids = [...G.SUPPORTED,'doudizhu'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const meta = id => PigCatalog.byId[id];
  const token = (() => {
    let value = Store.get('lan-player-token','');
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(value)) {
      const bytes = new Uint8Array(24); crypto.getRandomValues(bytes); value = Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join(''); Store.set('lan-player-token',value);
    } return value;
  })();
  let room=null,packet=null,rooms=[],joining=false,activeId='',chosen=null,rotation=true,placingCue=false,address=null,poolAngle=0,poolPower=.45,poolDrag=null;
  const generic = () => G.SUPPORTED.includes(game) && level === 'lan';
  const playing = () => generic() && state?.androidLan;
  const me = () => packet?.you || (room instanceof G.Guest?2:1);
  const v = () => packet?.view;
  const online = () => !!packet?.online?.every(Boolean) && !packet?.paused && !(room instanceof G.Guest && !room.connected);
  const turn = () => !!v() && !v().status?.over && v().turn===me() && online();
  const pig = (p,small=false) => PigArt.inline({skin:p===1?'peach':'soda',role:'pig',viewBox:'0 10 160 145',cls:small?'lan-token-small':'lan-token'});
  const statusText = text => { if ($('lan-status')) $('lan-status').textContent=text; };
  const myName = () => G.name(Store.get('lan-name',Store.get('ddz-name','小猪')));
  function saveName() { const field=$('lan-name');if(field){const n=G.name(field.value);field.value=n;Store.set('lan-name',n);} }
  async function closeRoom() {
    const old=room;room=null;packet=null;chosen=null;poolDrag=null;address=null;
    if(old)await old.close();else if(api)await api.scan(false);
  }
  // The shared page calls every controller's tick. Suppress offline handlers while
  // the phone LAN controller owns the state (including during a mode transition).
  for(const c of controllers) for(const key of ['tick','keyDown','keyUp','clearKeys','changeLook','resize','captureKeys','modal']) {
    if(typeof c[key]!=='function')continue;const fn=c[key];c[key]=function(...args){if(state?.androidLan)return false;return fn.apply(c,args);};
  }
  for(const id of G.SUPPORTED) if(!configs[id].levels.some(([k])=>k==='lan')) configs[id].levels.push(['lan','局域网联机']);
  configs.doudizhu.tag='三档人机 · 安卓 / Windows 局域网联机';
  PigHelp.HELP.doudizhu.rules.push('安卓 5.0.0 可以建房或加入同一 Wi-Fi / 热点里的猪圈；也可与 Windows 斗地猪联机。');
  for(const id of G.SUPPORTED) {
    configs[id].tag += ' · 局域网联机';
    PigHelp.HELP[id].rules.push('局域网：选择“局域网联机”，一人建房，另一人查找或输入房主地址加入；双方使用安卓 5.0.0。');
  }
  const originalHelp=helpHTML;
  helpHTML=function(id){
    if(!G.SUPPORTED.includes(id)||level!=='lan')return originalHelp(id);
    const h=PigHelp.HELP[id],rules=h.rules.filter(text=>!/(人机|电脑|同屏|难度|悔棋|存档|接着上一局|每走一步|一方一直|局域网)/.test(text));
    const controls={connect:'点一列让棋子落下。',xiangqi:'点自己的棋子，再点标出的落点；后手棋盘会自动翻转。',chess:'点自己的棋子，再点合法落点；升变时选择后、车、象或马。',gomoku:'点交叉点落子。',reversi:'点亮出的合法空格落子。',dots:'点两颗圆点之间画栅栏。',battleship:'轮到你布舰时，逐艘放置或自动布齐；双方布好后点对方海域开炮。',roulette:'点道具查看效果并确认使用，再选择对自己或朋友发射；私密记录只有本人可见。',pool:'点球桌瞄准，左右按钮微调，调节力度后出杆；可移动白猪时先点按钮再点桌面空处。'};
    return '<div class="help-col"><h3>游戏说明</h3><p class="help-goal">'+esc(h.goal)+'</p><ul>'+rules.map(r=>'<li>'+esc(r)+'</li>').join('')+'</ul></div><div class="help-col"><h3>局域网操作</h3><ul><li>'+controls[id]+'</li><li>一人建房，另一人查找或输入地址加入。双方使用安卓 5.0.0。</li><li>各用自己的手机操作，房主同步局面。保持应用在前台，双人房间掉线后暂停；原手机重新加入可回原座位。</li><li>一局结束后双方点“准备再来一局”。点“离开房间”退出；房主离开会关闭房间。</li></ul></div>';
  };
  const originalNewGame = newGame;
  newGame = function() {
    if(room && (game!==room.game || level!=='lan'))closeRoom();
    const net=generic()||game==='doudizhu'&&level==='lan';$('pause').disabled=net;$('restart').disabled=net;
    if(!generic())configs[game].labels.forEach((text,i)=>$('stat'+(i+1)+'-label').textContent=text);
    return originalNewGame();
  };
  const originalPause=setPause;
  setPause=function(on){if(generic() || game==='doudizhu'&&level==='lan'){if(on&&document.visibilityState!=='hidden')message('联机对局不能单独暂停；切到后台时请先告诉朋友。');return;}return originalPause(on);};
  function skeleton(id) {
    $('board').innerHTML=`<section class="lan-shell" aria-label="${esc(meta(id).name)}局域网"><div id="lan-body"></div><p id="lan-status" class="lan-status" role="status" aria-live="polite"></p></section>`;
    $('play-toolbar').innerHTML='<button class="secondary" id="lan-exit">离开房间</button><button class="secondary" id="lan-sync">刷新局面</button><span class="lan-tag">同一 Wi-Fi / 手机热点</span>';
    $('lan-exit').onclick=async()=>{await closeRoom();if(playing()){showMenu();message('已离开房间，可以重新建房或加入。');}};
    $('lan-sync').onclick=()=>{if(room instanceof G.Guest)room.sync();else if(room)room.push();else api?.scan(true);};
  }
  function init(id) {
    activeId=id;state={androidLan:true};running=true;
    skeleton(id);
    if(room?.game===id && packet)render();else showMenu();
    stats('局域网',packet?.view?.revision||0);
    ['对局状态','已执行操作','对局人数'].forEach((text,i)=>$('stat'+(i+1)+'-label').textContent=text);setStat('stat3','2 人');
    message('手机连到同一 Wi-Fi 或热点，一人开猪圈，另一人加入。');
  }
  function showMenu() {
    const body=$('lan-body');if(!body)return;
    body.innerHTML=`<div class="lan-intro"><span>${pig(1)}</span><div><h3>${esc(meta(activeId).name)} · 一起玩</h3><p>两部手机各操控一方。无需账号，也不需要外网。</p></div></div><label class="lan-field">我的名字<input id="lan-name" maxlength="12" value="${esc(myName())}" autocomplete="off"></label><button id="lan-host" class="primary">开一个猪圈</button><h4>同一网络里的猪圈</h4><div id="lan-rooms" class="lan-rooms"></div><form id="lan-manual"><label class="lan-field">房主地址<input id="lan-address" placeholder="如 192.168.1.23:47321" inputmode="decimal" autocomplete="off" value="${esc(Store.get('lan-address-'+activeId,''))}"></label><button class="secondary" type="submit" id="lan-join">输入地址加入</button></form><p class="lan-note">双方都使用安卓 5.0.0。找不到房间时输入房主显示的地址；公共 Wi-Fi 可能隔离设备，可改用一部手机开热点，另一部连接。请保持两部手机上的游乐场在前台。</p>`;
    $('lan-name').onchange=saveName;$('lan-host').disabled=!api;$('lan-join').disabled=!api;
    $('lan-host').onclick=host;
    $('lan-manual').onsubmit=e=>{e.preventDefault();const text=$('lan-address').value.trim(),m=text.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?$/);if(!m||m[2]&&(+m[2]<1||+m[2]>65535))return statusText('请输入房主显示的地址，例如 192.168.1.23:47321');join(m[1],m[2]?+m[2]:47321);};
    renderRooms();if(api)api.scan(true);else statusText('请在安装后的安卓版中使用局域网联机。');
  }
  function renderRooms() {
    const el=$('lan-rooms');if(!el)return;
    const list=rooms.filter(r=>r.room?.game===activeId&&r.room?.proto===G.PROTO).slice(0,40);
    el.innerHTML=list.length?list.map((r,i)=>`<button class="lan-room" data-lan-room="${i}" ${r.room.open||r.room.rejoin?'':'disabled'}><b>${esc(r.room.name)}</b><span>${r.room.rejoin?'等待原玩家重连':r.room.open?'等你加入':'已满员'} · ${esc(r.host)}:${Number(r.port)||47321}</span></button>`).join(''):'<p class="lan-search">正在查找…让朋友先开一个猪圈。</p>';
    el.querySelectorAll('[data-lan-room]').forEach(b=>b.onclick=()=>{const r=list[+b.dataset.lanRoom];join(r.host,r.port);});
  }
  const changed = m => { packet=m;chosen=null;placingCue=false;if(playing())render(); };
  async function host() {
    if(joining)return;saveName();joining=true;$('lan-host').disabled=true;statusText('正在建房…');
    const id=activeId;
    const current=new G.Host({lan:api,game:id,name:myName(),token,onChange:changed});room=current;
    const r=await current.open();joining=false;
    if(room!==current||!playing()||activeId!==id){current.close();return;}
    if(!r?.ok){await current.close();room=null;showMenu();return statusText(r?.error||'建房失败，请重试');}
    api.scan(false);address=r;render();Sound.greet();
  }
  async function join(ip,port) {
    if(joining)return;saveName();joining=true;statusText('正在加入 '+ip+'…');
    if(room)await closeRoom();
    const id=activeId;
    const current=new G.Guest({lan:api,game:id,name:myName(),token,onChange:changed,onError:text=>{
      if(room!==current)return;
      if(playing()){render();statusText(text);}
    }});room=current;
    address={host:ip,port};Store.set('lan-address-'+id,ip+':'+port);
    const r=await current.join(ip,port);joining=false;
    if(room!==current||!playing()||activeId!==id){current.close();return;}
    if(!r?.ok){await current.close();room=null;packet=null;showMenu();return statusText(r?.error||'加入失败，请检查 Wi-Fi 和房主地址');}
    api.scan(false);render();Sound.greet();
  }
  function action(a) {
    if(!room)return;const r=room.localAct(a);
    if(!r?.ok)statusText(r?.error||'操作未完成');else Sound.click();
  }
  function summary() {
    const names=packet?.names||['房主','朋友'],you=me();
    return `<div class="lan-players">${[1,2].map(p=>`<div class="${p===you?'me ':''}${v()?.turn===p?'current':''}">${pig(p)}<b>${esc(G.name(names[p-1]))}${p===you?'（我）':''}</b><small>${p===1?'房主':'朋友'}${activeId==='roulette'?'':p===1?' · 先手':' · 后手'}${packet?.online?.[p-1]?'':' · 断线'}</small></div>`).join('')}<span>VS</span></div>`;
  }
  function render() {
    if(!playing()||!$('lan-body')||!packet)return;
    const body=$('lan-body');
    if(!packet.view) {
      const host=room instanceof G.Host,addrs=address?.addrs||room?.address?.addrs||[];
      body.innerHTML=summary()+`<h3>${host?'猪圈开好啦，等朋友来':'已加入，等房主开始'}</h3>`+
        (host?`<div class="lan-addresses">${addrs.length?addrs.slice(0,4).map(ip=>`<b>${esc(ip)}:${address?.port||room?.address?.port||47321}</b>`).join(''):'没有可用的局域网地址，请先连接 Wi-Fi 或开启热点'}</div><p>让朋友查找“${esc(myName())}的猪圈”，或输入上方地址。</p><button class="primary" id="lan-start" ${packet.online[1]?'':'disabled'}>两人开始</button>`:'<p>房主开始后，双方会自动进入同一局。</p>');
      if($('lan-start'))$('lan-start').onclick=()=>room.start();statusText(packet.online[1]?'朋友到齐了，可以开始。':'等待朋友加入…');return;
    }
    const s=v(),over=s.status.over;
    body.innerHTML=summary()+`<div class="lan-turn" id="lan-turn">${over?(s.status.winner?esc(packet.names[s.status.winner-1])+'获胜！':'握握小蹄子，平局！'):!online()?'对局暂停，等待双方回到房间':s.turn===me()?'轮到你了':'轮到 '+esc(packet.names[s.turn-1])}</div><div id="lan-play" class="lan-play lan-${activeId}"></div><div id="lan-actions" class="lan-actions"></div>`;
    if(activeId==='connect')drawConnect();
    else if(['xiangqi','chess','gomoku','reversi'].includes(activeId))drawGrid();
    else if(activeId==='dots')drawDots();
    else if(activeId==='battleship')drawBattle();
    else if(activeId==='roulette')drawRoulette();
    else if(activeId==='pool')drawPool();
    const actions=$('lan-actions');
    if(over){actions.insertAdjacentHTML('beforeend',`<p>${s.status.reason==='resignation'?'对方或你选择了认输。':'本局已经结束。'}</p><button class="primary" id="lan-ready" ${packet.ready[me()-1]||!online()?'disabled':''}>${packet.ready[me()-1]?'已准备，等朋友…':'准备再来一局'}</button>`);$('lan-ready').onclick=()=>room.prepare(me());}
    else {actions.insertAdjacentHTML('beforeend','<button class="text-button" id="lan-resign">认输</button>');$('lan-resign').onclick=()=>{if($('lan-resign-confirm'))return;const b=document.createElement('button');b.id='lan-resign-confirm';b.className='secondary';b.textContent='确认认输本局';b.onclick=()=>action({type:'resign'});actions.append(b);};}
    if(room instanceof G.Guest&&!room.connected){actions.insertAdjacentHTML('beforeend','<button class="primary" id="lan-reconnect">重新加入</button>');$('lan-reconnect').onclick=()=>{const a={...address};join(a.host,a.port);};}
    statusText(!online()?'连接暂停。若已掉线，请用原手机重新加入；房主关闭房间后需要重新建房。':s.last||'双方各操作自己的手机，局面自动同步。');
    stats(over?'已结束':s.turn===me()?'轮到你':'等待对方',s.revision);
    setStat('stat3','2 人');
  }
  function drawConnect() {
    const s=v();$('lan-play').innerHTML=`<div class="lan-connect" style="--cols:7">${s.board.slice(0,42).map((p,i)=>`<button data-col="${i%7}" class="p${p}${s.line.includes(i)?' won':''}" aria-label="第${Math.floor(i/7)+1}行第${i%7+1}列${p?'，'+p+'号棋子':''}" ${turn()?'':'disabled'}>${p?pig(p,true):''}</button>`).join('')}</div><p>点一列，小猪落到该列最下方。横、竖、斜先连四只获胜。</p>`;
    $('lan-play').querySelectorAll('[data-col]').forEach(b=>b.onclick=()=>action({col:+b.dataset.col}));
  }
  const labels={xiangqi:{1:{k:'帥',a:'仕',b:'相',n:'傌',r:'俥',c:'炮',p:'兵'},2:{k:'將',a:'士',b:'象',n:'馬',r:'車',c:'砲',p:'卒'}},chess:{1:{k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},2:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}}};
  function drawGrid() {
    const s=v(),piece=activeId==='chess'||activeId==='xiangqi',w=piece?s.width:activeId==='gomoku'?15:8,h=piece?s.height:w;
    const cells=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)cells.push({x,y});
    const reversed=piece&&me()===2;if(reversed)cells.reverse();
    const sq=(x,y)=>String.fromCharCode(97+x)+(h-1-y+(activeId==='chess'?1:0));
    $('lan-play').innerHTML=`<div class="lan-grid ${piece?'lan-pieceboard ':''}${activeId}" style="--cols:${w}">${cells.map(({x,y})=>{
      const p=piece?s.board[y]?.[x]:s.board[y*w+x],owner=piece?p?.player:p,square=sq(x,y),legal=piece?s.legal.some(m=>m.to===square):s.legal.some(m=>m.x===x&&m.y===y);
      return `<button class="${(x+y)%2?'dark':'light'} p${owner||0}${legal?' legal':''}" data-square="${square}" data-x="${x}" data-y="${y}" aria-label="${square}${p?' '+(piece?labels[activeId][owner][p.type]:owner+'号猪'):''}" ${turn()?'':'disabled'}>${piece&&p?`<span class="lan-piece">${esc(labels[activeId][owner][p.type])}</span>`:owner?pig(owner,true):''}</button>`;
    }).join('')}</div><p>${piece?'点自己的棋子，再点落点。'+(reversed?'你的棋子已转到下方。':''):activeId==='gomoku'?'15 路自由五子棋，先连成五只获胜。':'亮点为合法落点，无处可下时自动跳过。'}</p>`;
    $('lan-play').querySelectorAll('[data-square]').forEach(b=>b.onclick=()=>{
      if(!piece)return action({x:+b.dataset.x,y:+b.dataset.y});
      const square=b.dataset.square,x=+b.dataset.x,y=+b.dataset.y,p=s.board[y]?.[x];
      if(p?.player===me()) {chosen=square;for(const cell of $('lan-play').querySelectorAll('[data-square]')){cell.classList.toggle('selected',cell.dataset.square===chosen);cell.classList.toggle('destination',s.legal.some(m=>m.from===chosen&&m.to===cell.dataset.square));}return;}
      const candidates=s.legal.filter(m=>m.from===chosen&&m.to===square);
      if(!candidates.length)return statusText('先选自己的棋子，再点亮起的合法落点。');
      if(candidates.some(m=>m.promotion)){
        const tray=$('lan-actions');tray.insertAdjacentHTML('afterbegin','<div class="lan-promotion">升变为 '+[['q','后'],['r','车'],['b','象'],['n','马']].map(([p,n])=>`<button data-promote="${p}">${n}</button>`).join('')+'</div>');
        tray.querySelectorAll('[data-promote]').forEach(btn=>btn.onclick=()=>action({from:chosen,to:square,promotion:btn.dataset.promote}));
      }else action(candidates[0]);
    });
  }
  function drawDots() {
    const s=v(),w=5,h=5,parts=[];
    for(let y=0;y<=h;y++)for(let x=0;x<=w;x++){
      const left=x*100/w,top=y*100/h;parts.push(`<i class="lan-dot" style="left:${left}%;top:${top}%"></i>`);
      if(x<w){const p=s.h[y*w+x];parts.push(`<button data-edge="h" data-x="${x}" data-y="${y}" class="lan-edge horizontal p${p}" style="left:${left}%;top:${top}%;width:${100/w}%" aria-label="第${y+1}行第${x+1}段横栅栏" ${p||!turn()?'disabled':''}></button>`);}
      if(y<h){const p=s.v[y*(w+1)+x];parts.push(`<button data-edge="v" data-x="${x}" data-y="${y}" class="lan-edge vertical p${p}" style="left:${left}%;top:${top}%;height:${100/h}%" aria-label="第${y+1}行第${x+1}段竖栅栏" ${p||!turn()?'disabled':''}></button>`);}
      if(x<w&&y<h&&s.boxes[y*w+x])parts.push(`<span class="lan-boxpig" style="left:${left+10}%;top:${top+10}%">${pig(s.boxes[y*w+x],true)}</span>`);
    }
    $('lan-play').innerHTML=`<div class="lan-dots"><div>${parts.join('')}</div></div><p>比分 ${s.scores[0]} : ${s.scores[1]} · 围住一格可接着画。</p>`;
    $('lan-play').querySelectorAll('[data-edge]').forEach(b=>b.onclick=()=>action({orientation:b.dataset.edge,x:+b.dataset.x,y:+b.dataset.y}));
  }
  function drawBattle() {
    const s=v(),placement=s.phase==='placement',own=s.ownBoard||[],shot=s.players[me()-1].shots,target=s.target;
    const grid=(friendly)=>`<div class="lan-sea" style="--cols:10">${Array.from({length:100},(_,i)=>{
      const hit=friendly?shot[i]:target[i],ship=friendly&&own[i];
      return `<button data-sea="${friendly?'own':'enemy'}" data-x="${i%10}" data-y="${Math.floor(i/10)}" class="${ship?'ship ':''}hit${hit}" aria-label="${friendly?'我方':'对方'}海域，第${Math.floor(i/10)+1}行第${i%10+1}列，${hit===1?'落空':hit>=2?'命中':ship?'舰船':'海水'}" ${turn()&&(placement?friendly:!friendly)&&!hit?'':'disabled'}>${hit===1?'·':hit>=2?'✹':ship?'▰':''}</button>`;
    }).join('')}</div>`;
    $('lan-play').innerHTML=`<h4>${placement?'我的布舰海域':'对方海域 · 点格开炮'}</h4>${grid(placement)}${!placement?'<details><summary>查看我的舰队</summary>'+grid(true)+'</details>':''}`;
    if(placement){$('lan-actions').innerHTML=`<p>${s.players[me()-1].ready?'舰队已准备好，等朋友布舰。':'下一艘：'+s.fleet[s.ownShips.length]+' 格长'} · 顺序布舰，坐标只发给本人。</p><button class="secondary" id="lan-rotate">${rotation?'横向':'竖向'} · 点此旋转</button><button class="secondary" id="lan-random" ${turn()?'':'disabled'}>自动布齐余下舰只</button>`;$('lan-rotate').onclick=()=>{rotation=!rotation;$('lan-rotate').textContent=(rotation?'横向':'竖向')+' · 点此旋转';};$('lan-random').onclick=()=>action({type:'auto-place'});}
    $('lan-play').querySelectorAll('[data-sea]').forEach(b=>b.onclick=()=>action({type:placement?'place':'fire',x:+b.dataset.x,y:+b.dataset.y,...(placement?{horizontal:rotation}:{})}));
  }
  function drawRoulette() {
    const s=v(),p=me()-1,R=PigRouletteCore,A=PigRouletteArt;
    $('lan-play').innerHTML=`<div class="lan-roulette-scene"><div>${pig(1)}<b>${s.hp[0]} / ${s.maxHp} ♥</b></div>${PigArt.inline({palette:A.PIGLET,role:"pig",viewBox:"0 0 160 160",cls:"lan-barrel"})}<div>${pig(2)}<b>${s.hp[1]} / ${s.maxHp} ♥</b></div></div><h4>${s.stage===4?'加赛':'第 '+s.stage+' 阶段'} · 积分 ${s.points[0]} : ${s.points[1]}</h4><p>本批装填：共 ${s.announced.total} 发，其中 ${s.announced.fake} 发是假屎。${s.flipNext?'下一颗已盖魔术布。':''}${s.boosted?'已喂饲料，下一枪强化。':''}</p><div class="lan-items">${s.items[p].map(item=>`<button data-item="${esc(item)}" title="${esc(R.ITEM_INFO[item]?.desc||'')}" ${turn()&&s.phase==='play'?'':'disabled'}>${A.itemIcon(item)}<b>${esc(R.ITEM_INFO[item]?.name||item)}</b></button>`).join('')}</div><details class="lan-clues" open><summary>我的私密验弹记录</summary><p>${s.clueList.length?s.clueList.map(c=>(c.item==='xray'?'X 光':'魔法书')+'：'+(c.stale?'已过时':'从现在起第 '+(c.rel+1)+' 颗')+' · '+(c.shell==='real'?'真屎':'假屎')+(c.flipped?'（已随魔术布翻转）':'')).map(esc).join('<br>'):'还没有验弹记录。'}</p></details>`;
    if(s.phase==='stageOver'){$('lan-actions').innerHTML='<button class="primary" id="lan-next-stage" '+(!online()?'disabled':'')+'>进入下一阶段</button>';$('lan-next-stage').onclick=()=>action({type:'next-stage'});}
    else if(s.phase==='play'){$('lan-actions').innerHTML=`<button class="secondary" id="lan-shoot-self" ${turn()?'':'disabled'}>对自己发射</button><button class="primary" id="lan-shoot-opp" ${turn()?'':'disabled'}>对朋友发射</button>`;$('lan-shoot-self').onclick=()=>action({type:'shoot',target:'self'});$('lan-shoot-opp').onclick=()=>action({type:'shoot',target:'opp'});}
    $('lan-play').querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>{const item=b.dataset.item;const info=R.ITEM_INFO[item];if(!info)return;const actions=$('lan-actions');actions.querySelector('.lan-item-confirm')?.remove();const box=document.createElement('div');box.className='lan-item-confirm';box.innerHTML=`<p>${esc(info.name)}：${esc(info.desc)}</p><button class="primary">使用${esc(info.name)}</button>`;box.querySelector('button').onclick=()=>action({type:'item',item});actions.prepend(box);});
  }
  function drawPool() {
    const s=v();$('lan-play').innerHTML='<canvas id="lan-pool" width="1100" height="600" aria-label="黑猪8球桌，点桌面瞄准，下方调力度出杆"></canvas>';
    $('lan-actions').innerHTML=`<p>${s.groups.map((g,i)=>esc(packet.names[i])+': '+(g==='solid'?'全色':g==='stripe'?'花色':'待定组')).join(' · ')}</p><label class="lan-power">力度 <input id="lan-power" type="range" min="3" max="100" value="${Math.round(poolPower*100)}"><output id="lan-power-value">${Math.round(poolPower*100)}%</output></label><div class="lan-pool-adjust"><button class="secondary" id="lan-aim-left" ${turn()&&s.phase==='aim'?'':'disabled'}>向左微调</button><button class="secondary" id="lan-aim-right" ${turn()&&s.phase==='aim'?'':'disabled'}>向右微调</button><button class="primary" id="lan-pool-shoot" ${turn()&&s.phase==='aim'?'':'disabled'}>出杆</button>${s.ballInHand?`<button class="secondary" id="lan-cue" ${turn()?'':'disabled'}>移动白猪</button>`:''}</div>`;
    const cv=$('lan-pool'),c=cv.getContext('2d'),colors=['#fff8e8','#edc735','#3866ba','#d94d4f','#764b96','#e98a42','#41936d','#75303f','#191f28','#edc735','#3866ba','#d94d4f','#764b96','#e98a42','#41936d','#75303f'];
    function paint(){
      c.clearRect(0,0,1100,600);c.fillStyle='#594234';c.fillRect(0,0,1100,600);c.fillStyle='#287763';c.fillRect(50,50,1000,500);
      for(const p of PigPoolCore.POCKETS){c.beginPath();c.arc(p.x+50,p.y+50,30,0,Math.PI*2);c.fillStyle='#182c28';c.fill();}
      if(turn()&&s.phase==='aim'){const b=s.balls[0];c.beginPath();c.moveTo(b.x+50,b.y+50);c.lineTo(b.x+50+Math.cos(poolAngle)*800,b.y+50+Math.sin(poolAngle)*800);c.strokeStyle='#fff5cc';c.lineWidth=2;c.setLineDash([9,9]);c.stroke();c.setLineDash([]);}
      for(const b of s.balls){if(b.potted)continue;const x=b.x+50,y=b.y+50;
        c.save();c.translate(x,y);c.beginPath();c.arc(0,0,17,0,Math.PI*2);c.fillStyle=b.id>8?'#fff7e7':colors[b.id];c.shadowBlur=6;c.shadowColor='#102c26';c.fill();c.shadowBlur=0;
        if(b.id>8){c.save();c.beginPath();c.arc(0,0,17,0,Math.PI*2);c.clip();c.fillStyle=colors[b.id];c.fillRect(-18,-9,36,18);c.restore();}
        c.fillStyle='#f5b8bc';c.beginPath();c.ellipse(0,5,8,5,0,0,Math.PI*2);c.fill();c.fillStyle='#78515a';c.beginPath();c.arc(-3,5,1.5,0,7);c.arc(3,5,1.5,0,7);c.fill();c.font='bold 12px sans-serif';c.textAlign='center';c.fillStyle=b.id===8?'#fff':'#182521';if(b.id)c.fillText(String(b.id),0,-3);c.restore();
      }
    }
    paint();
    cv.onpointerdown=e=>{if(!turn()||s.phase!=='aim')return;e.preventDefault();poolDrag=e.pointerId;cv.setPointerCapture(e.pointerId);point(e);};
    cv.onpointermove=e=>{if(poolDrag===e.pointerId)point(e);};cv.onpointerup=()=>poolDrag=null;cv.onpointercancel=()=>poolDrag=null;
    function point(e){const r=cv.getBoundingClientRect(),x=(e.clientX-r.left)*1100/r.width-50,y=(e.clientY-r.top)*600/r.height-50;if(placingCue){action({type:'cue',x,y});placingCue=false;return;}const b=s.balls[0];poolAngle=Math.atan2(y-b.y,x-b.x);paint();}
    $('lan-power').oninput=e=>{poolPower=+e.target.value/100;$('lan-power-value').textContent=e.target.value+'%';};
    $('lan-aim-left').onclick=()=>{poolAngle-=.009;paint();};$('lan-aim-right').onclick=()=>{poolAngle+=.009;paint();};
    $('lan-pool-shoot').onclick=()=>action({type:'shot',angle:poolAngle,power:poolPower});
    if($('lan-cue'))$('lan-cue').onclick=()=>{placingCue=true;statusText('点桌面空处放白猪，然后瞄准出杆。');};
  }
  controllers.unshift({has:id=>G.SUPPORTED.includes(id)&&game===id&&level==='lan',init,
    tick:dt=>{if(playing()&&room instanceof G.Host)room.tick(dt);},resize(){},keyDown:()=>false,keyUp(){},clearKeys(){},changeLook(){},
    captureKeys:e=>{if(!playing())return false;if(['r','p'].includes(e.key.toLowerCase())){e.preventDefault();message('联机中用“准备再来一局”重新开局，或点“离开房间”。');return true;}return false;},
    leave(prev,next){if(room&&prev!==next)closeRoom();}
  });
  if(api)api.onEvent(e=>{if(e.type==='rooms'){rooms=Array.isArray(e.list)?e.list:[];renderRooms();}else if(e.type==='error')statusText(e.error||'联机暂时不可用');});
  const chooser=document.createElement('dialog');chooser.id='android-lan-games';chooser.className='android-hall';
  chooser.innerHTML='<div class="dialog-head"><div><div class="eyebrow">同一 Wi-Fi / 手机热点</div><h2>局域网一起玩</h2></div><button class="close" aria-label="关闭联机大厅">×</button></div><p>10 款多人游戏，各用自己的手机玩。</p><div class="android-game-grid">'+ids.map(id=>`<button class="android-game-card" data-lan-game="${id}"><svg class="ico"><use href="#${meta(id).icon}"/></svg><div>${esc(meta(id).name)}<small>${id==='doudizhu'?'2–3 人，空位可补电脑；兼容 Windows':'2 人 · 安卓 5.0.0'}</small></div></button>`).join('')+'</div>';
  document.body.append(chooser);chooser.querySelector('.close').onclick=()=>chooser.close();
  chooser.querySelectorAll('[data-lan-game]').forEach(b=>b.onclick=()=>{chooser.close();$('android-games').close();Store.set('level-'+b.dataset.lanGame,'lan');selectGame(b.dataset.lanGame);});
  const open=()=>{Sound.stop();if(!chooser.open)chooser.showModal();};
  const entry=document.createElement('button');entry.id='android-lan';entry.className='android-hall-button';entry.textContent='局域网联机';entry.onclick=open;document.querySelector('main > header').append(entry);
  const hallEntry=document.createElement('button');hallEntry.className='text-button';hallEntry.id='android-hall-lan';hallEntry.textContent='局域网联机 · 10 款';hallEntry.onclick=open;$('android-games').querySelector('.android-hall-footer').prepend(hallEntry);
  const previous=window.PigAndroid;
  window.PigAndroid=Object.freeze({...previous,onLanForeground(on){
    if(room instanceof G.Host)room.setPaused(!on);else if(room instanceof G.Guest&&room.connected)api.send('host',{t:'presence',away:!on});
  }});
  // Source and packaged browser tests use this public entry, as do future native menus.
  window.PigAndroidLan=Object.freeze({games:Object.freeze(ids.slice()),open});
  renderLevels(configs[game]);renderHelp(game);
})();
