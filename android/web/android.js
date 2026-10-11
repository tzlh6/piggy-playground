/* Mobile navigation and touch adaptation. Existing controllers still own each game. */
(() => {
  'use strict';
  const header = document.querySelector('header');
  const button = document.createElement('button');
  button.id = 'android-hall-button';
  button.className = 'android-hall-button';
  button.innerHTML = '<svg class="ico"><use href="#i-cards"/></svg>游戏大厅';
  header.prepend(button);
  document.getElementById('look-settings').textContent = '换装';
  document.getElementById('audio-settings').textContent = '音效';
  const version = '__PIGGY_ANDROID_VERSION__';
  const gameButtons = document.querySelectorAll('.sidebar button.nav[data-game]');

  const touchTips = {
    mine: {1: ['圈出藏身处', '长按未打开的格子标旗，再长按可取消。也可以切换上方的标记模式后点按。']},
    merge: {0: ['滑动，一起向前推', '在棋盘上向上下左右滑动，或点下方方向按钮，所有小猪一起移动。']},
    snake: {0: ['滑动带路', '在画面上滑动，或用下方方向按钮转向。不能直接掉头。']},
    runner: {0: ['点一下，跳起来', '点跑道或按「跳」起跳，按住跳得更高；空中再按一次可以二段跳。'], 1: ['点一下，也能趴下', '点「趴下」会低头片刻，按住可以保持；低飞的乌鸦要跳，齐头高的乌鸦趴下躲，空中趴下会快速落地。']},
    slice: {0: ['点按或划过软糖猪', '点小猪也能切中；按住画面划过可以一划连切，避开黑色危险球。']},
    shooter: {0: ['点哪飞哪，自动射击', '点场内位置，小猪会平滑飞过去；也可以拖动或用方向按钮，按住慢移按钮穿过窄缝。'], 1: ['点护盾，九秒恢复', '护盾按钮清掉当前弹幕并短暂保护小猪。受击后也有短暂无敌；绿色星星补一条生命。']},
    rhythm: {0: ['到白线时点一下', '默认单击模式：长条点一下自动保持，双音符点其中一轨即可。关闭单击模式后，长条按住到尾端，双音符同时按两轨。']},
    roulette: {0: ['先用道具，再选枪口', '点背包使用道具，X 光再点要查看的位置。对自己打出假屎可以继续，对对手开枪总会结束回合。']}
  };
  Object.entries(touchTips).forEach(([id, edits]) => Object.entries(edits).forEach(([index, tip]) => configs[id].tips[index] = tip));
  document.querySelectorAll('#tips .tip').forEach((tip, index) => {
    const text = configs[document.body.dataset.game].tips[index];
    tip.querySelector('b').textContent = text[0];
    tip.querySelector('p').textContent = text[1];
  });

  const hall = document.createElement('dialog');
  hall.id = 'android-games';
  hall.className = 'android-hall';
  hall.setAttribute('aria-label', '游戏大厅');
  hall.innerHTML = `<div class="dialog-head"><div class="android-brand"><img alt="" data-pig-role="pig"><div><h2>猪猪游乐场</h2><p>${gameButtons.length} 款小游戏 · 随时离线玩</p></div></div><button class="close" aria-label="返回游戏"><svg class="ico"><use href="#i-close"/></svg></button></div><input class="android-game-search" type="search" placeholder="今天想玩哪一个？" aria-label="搜索小游戏"><div class="android-game-grid"></div><p class="android-empty" hidden>换个名字找找，小猪在这里等你。</p><div class="android-hall-footer"><span>一点点挑战，一大把快乐。</span><button class="text-button" id="android-about">玩法与说明</button></div>`;
  hall.querySelector('img').src = PigLook.src();
  document.body.append(hall);
  const search = hall.querySelector('input');
  const grid = hall.querySelector('.android-game-grid');
  const cards = [];
  gameButtons.forEach(original => {
    const card = document.createElement('button');
    card.className = 'android-game-card';
    card.dataset.mobileGame = original.dataset.game;
    card.innerHTML = original.innerHTML;
    card.addEventListener('click', () => {
      hall.close();
      original.click();
      window.scrollTo({top: 0, behavior: 'instant'});
    });
    grid.append(card);
    cards.push(card);
  });

  function pause() {
    setPause(true);
    Sound.stop();
  }
  function openHall() {
    pause();
    search.value = '';
    cards.forEach(card => {
      card.hidden = false;
      card.setAttribute('aria-current', card.dataset.mobileGame === document.body.dataset.game ? 'page' : 'false');
    });
    hall.querySelector('.android-empty').hidden = true;
    hall.querySelector('img').src = PigLook.src();
    if (!hall.open) hall.showModal();
    // Do not summon the keyboard on launch; leave it for an intentional search tap.
    hall.querySelector('.close').focus({preventScroll: true});
    hall.scrollTop = 0;
  }
  button.addEventListener('click', openHall);
  hall.querySelector('.close').addEventListener('click', () => hall.close());
  hall.addEventListener('close', () => Sound.stop());
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    cards.forEach(card => card.hidden = !card.textContent.toLowerCase().includes(query));
    hall.querySelector('.android-empty').hidden = cards.some(card => !card.hidden);
  });
  document.getElementById('android-about').addEventListener('click', () => {
    hall.close();
    document.getElementById('about').click();
  });
  const paragraphs = document.querySelectorAll('#about-dialog > p');
  paragraphs[0].textContent = `${gameButtons.length} 款游戏，全部离线。成绩、猪猪造型和声音设置自动保存在手机内。游戏大厅可搜索和切换游戏，切换会开始新局；切到后台自动暂停，回来后点「继续玩」。返回键先关闭弹窗，再回到游戏大厅。`;
  paragraphs[1].textContent = '扫猪：点格子翻开，长按标旗，也可切换标记模式。2048 与贪吃猪：滑动或方向按钮。跳跳猪：点跑道或跳跃按钮，趴下也可点按。切切猪：点小猪或手指划切。星际守卫：点哪飞哪或拖动，下方按钮控制慢速与护盾。节奏派对：默认单击模式，长条点一下、双音符点其中一轨。猪猪轮盘：点道具，再选对自己或对对手开枪；X 光可选择任意未知位置，默认电影感动画，可切换轻快节奏。其余游戏看各自下方的玩法提示。';
  paragraphs[2].textContent = `安卓离线版 ${version}。无需账号，也无需联网、存储或麦克风权限。重新打开会开始新局，最高成绩、造型、音量与难度设置会保留；卸载 App 会清除这些记录。Android 8.0 及以上，需启用并更新系统 WebView。`;

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
