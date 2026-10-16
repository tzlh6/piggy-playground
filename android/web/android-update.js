/* Native Android updates; only the fixed project release channel is reachable. */
(() => {
  'use strict';
  const version = window.PigAndroid.version;
  const native = window.PiggyAndroidBridge || null;
  const hall = document.getElementById('android-games');
  let state = {current: version, status: 'idle', auto: true};
  if (native) { try { state = JSON.parse(native.info()); } catch (ignored) {} }
  const updates = document.createElement('dialog');
  updates.id = 'android-updates'; updates.setAttribute('aria-label', '版本与更新');
  updates.innerHTML = `<div class="dialog-head"><div><div class="eyebrow">猪猪游乐场 · 安卓</div><h2>版本与更新</h2></div><button class="close" aria-label="关闭更新"><svg class="ico"><use href="#i-close"/></svg></button></div><p class="android-current"></p><p class="android-update-status" role="status" aria-live="polite"></p><progress hidden aria-label="新版下载进度"></progress><p class="android-update-error" hidden></p><p class="android-update-notes" hidden></p><div class="android-update-actions"><button class="secondary" id="android-check">检查更新</button><button class="primary" id="android-download" hidden>下载新版</button><button class="primary" id="android-install" hidden>安装新版</button><button class="secondary" id="android-release-page">GitHub 下载页</button></div><label class="android-auto"><input type="checkbox" id="android-auto">启动时自动检查</label><p class="muted small">游戏可离线玩。检查和下载更新需要联网，下载由你点选。首次安装更新时，安卓系统会让你允许本应用安装新版，再由系统确认安装。覆盖安装保留成绩和设置。</p>`;
  document.body.append(updates);
  updates.querySelector('.close').onclick = () => updates.close();
  updates.addEventListener('close', () => Sound.stop());
  const chip = document.getElementById('update-chip');
  function action(name, ...args) {
    if (!native) return;
    try {
      // Android selects a Java bridge method by argument count; undefined is still an argument.
      if (args.length === 0) native[name]();
      else native[name](...args);
    } catch (error) {
      state = {...state, status: 'error', error: '未能调用安卓更新功能，请关闭此窗口后重试。'};
      render();
    }
  }
  function render() {
    const busy = ['checking', 'downloading'].includes(state.status);
    const mb = bytes => (Number(bytes || 0) / 1048576).toFixed(1) + ' MB';
    const labels = {
      idle: state.auto ? '启动后会自动检查一次；也可以手动检查。' : '自动检查已关闭，仍可手动检查。',
      checking: '正在检查更新，请稍候…',
      available: `发现新版 ${state.latest || ''}，可以下载更新。`,
      downloading: `正在下载 ${state.latest || ''}：${mb(state.done)} / ${mb(state.total)}。`,
      ready: `新版 ${state.latest || ''} 已校验，可以安装。`,
      latest: '已经是最新版本。',
      error: '暂时无法完成更新，不影响离线游玩。'
    };
    updates.querySelector('.android-current').textContent = `当前版本：${state.current || version}`;
    updates.querySelector('.android-update-status').textContent = native ? labels[state.status] || labels.idle : '请在安装后的安卓版中检查更新。';
    const error = updates.querySelector('.android-update-error'); error.textContent = state.error || ''; error.hidden = !state.error;
    const notes = updates.querySelector('.android-update-notes'); notes.textContent = state.notes || '';
    notes.hidden = !state.notes || !['available', 'downloading', 'ready'].includes(state.status);
    const progress = updates.querySelector('progress'); progress.hidden = state.status !== 'downloading';
    progress.max = state.total || 1; progress.value = state.done || 0;
    updates.querySelector('#android-check').disabled = busy || !native;
    updates.querySelector('#android-download').hidden = state.status !== 'available';
    updates.querySelector('#android-install').hidden = state.status !== 'ready';
    updates.querySelector('#android-release-page').disabled = !native;
    const auto = updates.querySelector('#android-auto'); auto.checked = state.auto !== false; auto.disabled = !native;
    chip.hidden = !['available', 'downloading', 'ready'].includes(state.status);
    chip.classList.toggle('busy', busy);
    chip.textContent = state.status === 'downloading' ? '下载更新中…' : state.status === 'ready' ? '新版已就绪' : '发现新版';
    const hallUpdate = document.getElementById('android-update');
    hallUpdate.textContent = state.status === 'ready' ? '新版已就绪' : state.status === 'available' ? '发现新版' : '版本与更新';
    hallUpdate.classList.toggle('has-update', !chip.hidden);
  }
  function open() { window.PigAndroid.pause(); if (hall.open) hall.close(); render(); if (!updates.open) updates.showModal(); }
  document.getElementById('android-update').onclick = open; chip.onclick = open;
  updates.querySelector('#android-check').onclick = () => action('check');
  updates.querySelector('#android-download').onclick = () => action('download');
  updates.querySelector('#android-install').onclick = () => action('install');
  updates.querySelector('#android-release-page').onclick = () => action('openPage');
  updates.querySelector('#android-auto').onchange = event => action('setAuto', event.target.checked);
  function mobileAbout() {
    const panel = document.getElementById('update-panel');
    panel.innerHTML = `<p>安卓 ${version} · 20 款游戏可离线玩。</p><button class="secondary" id="android-about-update">检查版本与更新</button>`;
    panel.querySelector('button').onclick = () => { document.getElementById('about-dialog').close(); open(); };
  }
  document.getElementById('about').onclick = () => { mobileAbout(); openDialog('about-dialog'); };
  mobileAbout();
  const sharedNotes = openNotes;
  openNotes = function(auto) {
    sharedNotes(auto);
    Store.set('seen-android-version', version);
    const note = document.createElement('section'); note.className = 'note-cur';
    note.innerHTML = '<p class="note-meta">安卓 4.4.4 · 2026-10-16</p><h3>新游戏：猪猪跳一跳</h3><ul><li>新增第 20 款离线小游戏。按住画面或按钮蓄力，松手起跳；连续落在中心递增加分。</li><li>经典挑战与轻松练习独立保存最高分，练习模式显示预估落点。复用现有猪猪造型、表情和声音。</li><li>保留既有原生更新与数据保存方式，局域网联机仅适用于 Windows。</li></ul><p class="muted small">下方是共用游戏 4.4.4 及历史更新说明。</p>';
    document.getElementById('notes-body').prepend(note);
  };
  document.getElementById('android-notes').onclick = () => { hall.close(); openNotes(false); };
  const navigation = window.PigAndroid;
  window.PigAndroid = Object.freeze({
    ...navigation,
    onUpdate(status) { state = status; render(); },
    back() {
      const modal = [updates, ...['notes-dialog', 'help-dialog', 'about-dialog', 'look-dialog', 'sound-dialog'].map(id => document.getElementById(id))].find(dialog => dialog && dialog.open);
      if (modal) { modal.close(); return 'handled'; }
      return navigation.back();
    }
  });
  render();
})();
