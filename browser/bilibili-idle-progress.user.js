// ==UserScript==
// @name         Bilibili 隐藏控制栏时显示底部进度
// @namespace    local.bilibili-idle-progress
// @version      0.2.2
// @description  原生进度条隐藏时显示半透明进度与可选角色，不接管拖动。
// @match        https://www.bilibili.com/*
// @match        https://bilibili.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  const CONFIG = {
    opacity: 0.55, // 0-1，整个叠加层的不透明度
    height: 3, // 进度条像素高度
    bottom: 0, // 距播放器底部的像素数
    color: '#168dff',
    characterWidth: 31,
    characterHeight: 40,
    // 用户给出的原主题图片地址；可设为 '' 仅显示进度条。
    // 依赖外部图片可访问；使用自有角色时替换为获准使用的HTTPS图片地址。
    characterUrl: 'https://i.imgur.com/sR2lxuX.gif',
  };
  const ID = 'local-bili-idle-progress';
  const SELECTOR = '.bpx-player-progress-wrap';
  let active = null;
  let force = false;
  let imageState = CONFIG.characterUrl ? '等待加载' : '未启用';
  const panel = document.createElement('div');
  panel.id = 'bili-idle-diagnostic';
  panel.style.cssText = 'position:fixed;top:90px;right:12px;z-index:2147483647;padding:10px;background:rgba(15,20,30,.92);color:white;font:12px/1.6 monospace;border-radius:8px;max-width:350px;white-space:pre-wrap;';
  const message = document.createElement('div');
  const toggle = document.createElement('button');
  toggle.textContent = '测试：强制显示';
  toggle.style.cssText = 'color:#111;background:#eee;border:1px solid #999;padding:3px;margin:5px;cursor:pointer';
  toggle.onclick = () => { force = !force; toggle.textContent = force ? '返回自动切换' : '测试：强制显示'; safeReconcile(); };
  const close = toggle.cloneNode(false);
  close.textContent = '关闭面板';
  close.onclick = () => panel.remove();
  panel.append(message,toggle,close);
  (document.body || document.documentElement).append(panel);
  function report(text) { message.textContent = 'B站底部条 v0.2.2：已执行\n' + text; }
  report('正在寻找播放器…');

  function controlState(root) {
    // 优先读取播放器自己的状态；不更改这些属性。
    const hidden = root.getAttribute('data-ctrl-hidden');
    if (hidden === 'true' || hidden === 'false') return {shown: hidden === 'false', source:'data-ctrl-hidden=' + hidden};
    const shown = root.getAttribute('ctrl-shown');
    if (shown === 'true' || shown === 'false') return {shown: shown === 'true', source:'ctrl-shown=' + shown};
    const tracks = [...root.querySelectorAll(SELECTOR)].filter(e => !e.closest('.bpx-player-shadow-progress-area'));
    const bottom = root.querySelector('.bpx-player-control-bottom');
    const nodes = bottom ? [bottom] : tracks;
    return {shown: nodes.length ? nodes.some(e => visible(e,root)) : null, source: nodes.length ? '元素可见性' : '控制栏未识别'};
  }
  const events = ['timeupdate', 'durationchange', 'loadedmetadata', 'seeking', 'seeked', 'emptied', 'ended'];

  function visible(element, root) {
    const r = element.getBoundingClientRect();
    const box = root.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.bottom <= box.top || r.top >= box.bottom || r.right <= box.left || r.left >= box.right) return false;
    let opacity = 1;
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const s = getComputedStyle(node);
      if (node.hidden || s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
      opacity *= Number(s.opacity);
      if (opacity <= 0.05) return false;
    }
    return true;
  }

  function cleanup() {
    if (!active) return;
    for (const name of events) active.video.removeEventListener(name, update);
    active.layer.remove();
    if (active.changedPosition && active.root.style.position === 'relative') {
      if (active.oldPosition) active.root.style.setProperty('position', active.oldPosition, active.oldPriority);
      else active.root.style.removeProperty('position');
    }
    active = null;
  }

  function mount(root, video) {
    const duplicate = root.querySelector(`#${ID}`);
    if (duplicate) duplicate.remove();
    const oldPosition = root.style.getPropertyValue('position');
    const oldPriority = root.style.getPropertyPriority('position');
    const changedPosition = getComputedStyle(root).position === 'static';
    if (changedPosition) root.style.position = 'relative';
    const layer = document.createElement('div');
    layer.id = ID;
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = `position:absolute;left:0;right:0;bottom:${CONFIG.bottom}px;height:${CONFIG.height}px;z-index:60;pointer-events:none;opacity:${CONFIG.opacity};display:none;overflow:visible;background:rgba(255,255,255,.25);`;
    const fill = document.createElement('div');
    fill.style.cssText = `position:absolute;inset:0 auto 0 0;width:0;background:${CONFIG.color};pointer-events:none;`;
    const character = document.createElement('img');
    character.alt = '';
    character.referrerPolicy = 'no-referrer';
    character.draggable = false;
    character.style.cssText = `position:absolute;bottom:0;width:${CONFIG.characterWidth}px;height:${CONFIG.characterHeight}px;max-width:none;object-fit:contain;pointer-events:none;`;
    imageState = CONFIG.characterUrl ? '等待加载' : '未启用';
    character.addEventListener('load', () => {imageState = '已加载';});
    character.addEventListener('error', () => {
      imageState = '加载失败（只显示条）';
      character.style.display = 'none';
      console.warn('[Bili idle progress] 角色图片加载失败；进度条继续工作。');
    }, {once: true});
    if (CONFIG.characterUrl) character.src = CONFIG.characterUrl;
    else character.style.display = 'none';
    layer.append(fill, character);
    root.append(layer);
    active = {root, video, layer, fill, character, changedPosition, oldPosition, oldPriority};
    for (const name of events) video.addEventListener(name, update);
  }

  function update() {
    if (!active) return;
    const {root, video, layer, fill, character} = active;
    const state = controlState(root);
    const duration = video.duration;
    const ready = Number.isFinite(duration) && duration > 0;
    const show = ready && visible(root,root) && (force || state.shown === false);
    layer.style.display = show ? 'block' : 'none';
    report(`视频：${video.tagName}，时长：${ready ? Math.round(duration) + '秒' : '未知/未就绪'}\n控制栏：${state.shown === null ? '未知' : state.shown ? '显示' : '隐藏'}（${state.source}）\n底部条：${show ? '显示' : '隐藏'}，模式：${force ? '强制测试' : '自动'}\n角色图片：${imageState}\n${!ready ? '先播放视频；仍未知请截图反馈。' : state.shown === null ? '请用强制显示测试，勿同时开启重复脚本。' : ''}`);
    const fraction = Math.min(1, Math.max(0, (Number.isFinite(video.currentTime) ? video.currentTime : 0) / duration));
    fill.style.width = `${fraction * 100}%`;
    // 边缘夹紧，防止角色在开头或结尾被播放器裁掉。
    const width = root.clientWidth;
    const x = Math.min(Math.max(0, width - CONFIG.characterWidth), Math.max(0, fraction * width - CONFIG.characterWidth / 2));
    character.style.left = `${x}px`;
  }

  function reconcile() {
    if (!/^\/(?:[a-z]{2}(?:-[a-z]{2,8})?\/)?(?:video|bangumi\/play)\//i.test(location.pathname)) {
      cleanup(); panel.style.display = 'none'; return;
    }
    panel.style.display = '';
    if (panel.isConnected && document.body && panel.parentNode !== document.body) document.body.append(panel);
    const choices = [...document.querySelectorAll('video, bwp-video')]
      .map(video => ({video, root: video.closest('.bpx-player-container, .bilibili-player-video-wrap')}))
      .filter(({root, video}) => root && visible(root, root) && (visible(video, root) || video.tagName.toLowerCase() === 'bwp-video'))
      .sort((a,b) => {
        const readyA = Number.isFinite(a.video.duration) && a.video.duration > 0;
        const readyB = Number.isFinite(b.video.duration) && b.video.duration > 0;
        if (readyA !== readyB) return Number(readyB) - Number(readyA);
        const x=a.root.getBoundingClientRect(), y=b.root.getBoundingClientRect();
        return y.width*y.height-x.width*x.height;
      });
    const chosen = choices[0];
    if (!chosen) { cleanup(); report(`未找到可见播放器。video/bwp-video数量：${document.querySelectorAll('video,bwp-video').length}\n请确认是B站视频详情页，并开始播放。`); return; }
    if (!active || active.root !== chosen.root || active.video !== chosen.video || !active.layer.isConnected) {
      cleanup(); mount(chosen.root, chosen.video);
    }
    update();
  }
  function safeReconcile() {
    try { reconcile(); }
    catch (error) {
      if (active) active.layer.style.display = 'none';
      report('运行异常：' + String(error?.message || error) + '\n请反馈此面板；不必重装扩展。');
      console.error('[Bili idle progress]',error);
    }
  }
  // 兼容站内切换视频、替换播放器和控制栏淡入淡出；不观察自身style避免反馈循环。
  let timer = setInterval(safeReconcile, 200);
  document.addEventListener('fullscreenchange', safeReconcile);
  window.addEventListener('pagehide', () => {clearInterval(timer); cleanup();}, {once:true});
  window.addEventListener('pageshow', event => {if(event.persisted) {clearInterval(timer); timer=setInterval(safeReconcile,200); safeReconcile();}});
  safeReconcile();
})();
