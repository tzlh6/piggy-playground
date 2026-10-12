/* Mobile navigation and touch adaptation. Existing controllers still own each game. */
(() => {
  'use strict';
  const header = document.querySelector('main > header');
  const button = document.createElement('button');
  button.id = 'android-hall-button';
  button.className = 'android-hall-button';
  button.innerHTML = '<svg class="ico"><use href="#i-cards"/></svg>游戏大厅';
  header.prepend(button);
  document.getElementById('look-settings').textContent = '换装';
  document.getElementById('audio-settings').textContent = '音效';
  const version = '__PIGGY_ANDROID_VERSION__';
  const games = PigCatalog.GAMES;
  configs.doudizhu.levels = configs.doudizhu.levels.filter(([id]) => id !== 'lan');
  configs.doudizhu.tag = '经典斗地主 · 人机三档';
  if (Store.get('level-doudizhu', '') === 'lan') Store.set('level-doudizhu', 'smart');

  const touchTips = {
    mine: {1: ['圈出藏身处', '长按未打开的格子标旗，再长按可取消。也可以切换上方的标记模式后点按。']},
    merge: {0: ['滑动，一起向前推', '在棋盘上向上下左右滑动，或点下方方向按钮，所有小猪一起移动。']},
    snake: {0: ['滑动带路', '在画面上滑动，或用下方方向按钮转向。不能直接掉头。']},
    runner: {0: ['点一下，跳起来', '点跑道或按「跳」起跳，按住跳得更高；空中再按一次可以二段跳。'], 1: ['点一下，也能趴下', '点「趴下」会低头片刻，按住可以保持；低飞的乌鸦要跳，齐头高的乌鸦趴下躲，空中趴下会快速落地。']},
    slice: {0: ['点按或划过软糖猪', '点小猪也能切中；按住画面划过可以一划连切，避开黑色危险球。']},
    shooter: {0: ['点哪飞哪，自动射击', '点场内位置，小猪会平滑飞过去；也可以拖动或用方向按钮，按住慢移按钮穿过窄缝。'], 1: ['点护盾，九秒恢复', '护盾按钮清掉当前弹幕并短暂保护小猪。受击后也有短暂无敌；绿色星星补一条生命。']},
    rhythm: {0: ['到白线时点一下', '默认单击模式：长条点一下自动保持，双音符点其中一轨即可。关闭单击模式后，长条按住到尾端，双音符同时按两轨。']},
    roulette: {0: ['先用道具，再选枪口', '点背包使用道具。X 光查看下一颗，魔法书随机查看后面的未知一颗。对自己打出假屎可以继续，对对手开枪总会结束回合。']},
    doudizhu: {0: ['点牌选中，再点出牌', '点牌选中，再点取消；按住划过多张牌一起选择。点「提示」找牌，点「不要」让过，叫分最高的当邪恶猪猪。']}
  };
  Object.entries(touchTips).forEach(([id, edits]) => Object.entries(edits).forEach(([index, tip]) => configs[id].tips[index] = tip));
  Object.entries(touchTips).forEach(([id, edits]) => {
    PigHelp.HELP[id].mouse = Object.values(edits).map(([title, text]) => title + '：' + text);
  });
  PigHelp.HELP.doudizhu.rules = PigHelp.HELP.doudizhu.rules.filter(text => !text.includes('局域网'));
  renderHelp(document.body.dataset.game);

  const hall = document.createElement('dialog');
  hall.id = 'android-games';
  hall.className = 'android-hall';
  hall.setAttribute('aria-label', '游戏大厅');
  hall.innerHTML = `<div class="dialog-head"><div class="android-brand"><img alt="" data-pig-role="pig"><div><h2>猪猪游乐场</h2><p>${games.length} 款小游戏 · 安卓 ${version}</p></div></div><button class="close" aria-label="返回游戏"><svg class="ico"><use href="#i-close"/></svg></button></div><input class="android-game-search" type="search" placeholder="今天想玩哪一个？" aria-label="搜索小游戏"><div class="android-categories" role="tablist" aria-label="游戏分类"></div><div class="android-sort-row"><span id="android-game-count"></span><label>排序 <select id="android-sort" aria-label="游戏排序"></select></label></div><div class="android-game-grid"></div><p class="android-empty" hidden>换个名字找找，小猪在这里等你。</p><div class="android-hall-footer"><button class="text-button" id="android-about">玩法与说明</button><button class="text-button" id="android-notes">更新说明</button><button class="text-button" id="android-update">版本与更新</button></div>`;
  hall.querySelector('img').src = PigLook.src();
  document.body.append(hall);
  const search = hall.querySelector('input');
  const grid = hall.querySelector('.android-game-grid');
  let category = Store.get('android-lobby-cat', 'all');
  let sorting = Store.get('android-lobby-sort', 'default');
  if (!PigCatalog.CATS.some(([id]) => id === category)) category = 'all';
  if (!PigCatalog.SORTS.some(([id]) => id === sorting)) sorting = 'default';
  const sort = hall.querySelector('#android-sort');
  sort.innerHTML = PigCatalog.SORTS.map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
  sort.value = sorting;
  function renderGames() {
    const query = search.value.trim().toLowerCase();
    const stats = Store.get('play-stats', {}) || {};
    let list = games.filter(g => (category === 'all' || g.cat === category) &&
      (g.name + g.desc + g.keys + PigCatalog.catName[g.cat]).toLowerCase().includes(query));
    const by = {
      default: (a, b) => a.no - b.no,
      recent: (a, b) => ((stats[b.id] || {}).last || 0) - ((stats[a.id] || {}).last || 0) || a.no - b.no,
      most: (a, b) => ((stats[b.id] || {}).n || 0) - ((stats[a.id] || {}).n || 0) || a.no - b.no,
      name: (a, b) => a.name.localeCompare(b.name, 'zh-CN')
    };
    list.sort(by[sorting]); grid.replaceChildren();
    list.forEach(g => {
      const card = document.createElement('button');
      card.className = 'android-game-card'; card.dataset.mobileGame = g.id;
      card.setAttribute('aria-current', g.id === document.body.dataset.game ? 'page' : 'false');
      card.innerHTML = `<svg class="ico"><use href="#${g.icon}"/></svg><div>${g.name}<small>${g.desc}</small></div><b>${String(g.no).padStart(2, '0')}</b>`;
      card.addEventListener('click', () => {
        hall.close(); if (game !== g.id) selectGame(g.id);
        window.scrollTo({top: 0, behavior: 'instant'});
      });
      grid.append(card);
    });
    hall.querySelector('.android-empty').hidden = list.length > 0;
    hall.querySelector('#android-game-count').textContent = `${list.length} / ${games.length} 款`;
    hall.querySelector('.android-categories').innerHTML = PigCatalog.CATS.map(([id, name]) =>
      `<button role="tab" data-category="${id}" aria-selected="${id === category}">${name}</button>`).join('');
  }
  hall.querySelector('.android-categories').onclick = event => {
    const tab = event.target.closest('[data-category]'); if (!tab) return;
    category = tab.dataset.category; Store.set('android-lobby-cat', category); renderGames();
  };
  sort.onchange = () => { sorting = sort.value; Store.set('android-lobby-sort', sorting); renderGames(); };

  function pause() {
    setPause(true);
    Sound.stop();
  }
  function openHall() {
    pause();
    search.value = '';
    renderGames();
    hall.querySelector('img').src = PigLook.src();
    if (!hall.open) hall.showModal();
    // Do not summon the keyboard on launch; leave it for an intentional search tap.
    hall.querySelector('.close').focus({preventScroll: true});
    hall.scrollTop = 0;
  }
  button.addEventListener('click', openHall);
  hall.querySelector('.close').addEventListener('click', () => hall.close());
  hall.addEventListener('close', () => Sound.stop());
  search.addEventListener('input', renderGames);
  document.getElementById('android-about').addEventListener('click', () => {
    hall.close();
    document.getElementById('about').click();
  });
  const paragraphs = document.querySelectorAll('#about-dialog > .about-block');
  paragraphs[0].querySelector('p').textContent = `${games.length} 款游戏，全部可离线。游戏大厅可搜索、分类和排序；切换游戏会开始新局。切到后台自动暂停，回来后点「继续玩」。返回键先关闭弹窗，再回到游戏大厅。斗地猪提供三档人机对战。`;
  paragraphs[0].querySelector('.muted').textContent = '扫猪长按标旗；2048 与贪吃猪可滑动；跳跳猪、切切猪、星际守卫、节奏派对支持点按。轮盘点道具再选枪口；斗地猪点牌或划过多张牌，再点出牌。更多规则点每款游戏的「玩法」。';
  paragraphs[1].querySelector('p').textContent = '成绩、猪猪造型和声音设置自动保存在手机内。覆盖安装新版会保留记录；卸载 App 会清除记录。无需账号，无广告，不申请存储或麦克风权限。Android 8.0 及以上，需启用并更新系统 WebView。';

  // Keep the original hand and action nodes (and their rule handlers), but move them
  // below the scaled animation stage so card faces and buttons remain finger-sized.
  function adaptCards() {
    const board = document.getElementById('board');
    const hand = document.getElementById('dz-hand');
    const actions = document.getElementById('dz-actions');
    if (!hand || !actions || board.querySelector('.android-dz-controls')) return;
    const tray = document.createElement('section');
    tray.className = 'android-dz-controls';
    tray.setAttribute('aria-label', '手牌与出牌操作');
    const label = document.createElement('p');
    label.textContent = '点牌选中 · 按住划选 · 再点出牌';
    tray.append(actions, label, hand);
    board.append(tray);
  }
  new MutationObserver(adaptCards).observe(document.getElementById('board'), {childList: true});
  adaptCards();

  // Touch long-press flags cancel on a scroll or drag, and consume the following tap.
  let hold = null;
  let swallowed = null;
  function clearHold() { if (hold) clearTimeout(hold.timer); hold = null; }
  document.addEventListener('pointerdown', event => {
    clearHold();
    swallowed = null;
    const cell = event.target.closest('.mine-cell');
    if (!cell || cell.classList.contains('open') || event.pointerType === 'mouse' || event.button > 0) return;
    hold = {cell, x: event.clientX, y: event.clientY, id: event.pointerId, timer: null};
    hold.timer = setTimeout(() => {
      if (!hold || !cell.isConnected) return;
      swallowed = {cell, until: performance.now() + 1600};
      cell.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}));
      clearHold();
    }, 420);
  }, {capture: true, passive: true});
  document.addEventListener('pointermove', event => {
    if (hold && (event.pointerId !== hold.id || Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > 10)) clearHold();
  }, {capture: true, passive: true});
  ['pointerup', 'pointercancel'].forEach(type => document.addEventListener(type, clearHold, {capture: true, passive: true}));
  document.addEventListener('click', event => {
    if (swallowed && performance.now() < swallowed.until && event.target.closest('.mine-cell') === swallowed.cell) {
      event.preventDefault();
      event.stopImmediatePropagation();
      swallowed = null;
    }
  }, true);
  document.addEventListener('contextmenu', event => {
    const cell = event.target.closest('.mine-cell');
    if (cell) {
      event.preventDefault();
      if (event.isTrusted && swallowed && swallowed.cell === cell && performance.now() < swallowed.until) {
        event.stopImmediatePropagation();
      }
    }
  }, true);

  window.PigAndroid = Object.freeze({
    pause,
    back() {
      const modal = Array.from(document.querySelectorAll('dialog[open]')).pop();
      if (modal === hall) return 'exit';
      if (modal) { modal.close(); return 'handled'; }
      openHall();
      return 'handled';
    }
  });
  document.body.dataset.androidReady = 'true';
  openHall();
})();
