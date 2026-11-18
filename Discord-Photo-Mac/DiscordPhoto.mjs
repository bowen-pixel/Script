import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync, spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadPack, adaptedCSS, validateTheme} from './theme-packs.mjs';

const SELF = fileURLToPath(import.meta.url);
const DIR = path.dirname(SELF);
const RUNTIME = process.env.DISCORD_PHOTO_HOME ? path.resolve(process.env.DISCORD_PHOTO_HOME) : path.join(DIR, '.discord-photo-runtime');
const CONFIG = path.join(RUNTIME, 'photo.json');
const STATE = path.join(RUNTIME, 'session.json');
const APP = '/Applications/Discord.app';
const EXE = APP + '/Contents/MacOS/Discord';
const VERSION = '0.3.0';
const LIBRARY = path.join(RUNTIME, 'themes');
const DEFAULTS = {darkness: 0.48, blur: 0, position: 'center', accent: '#a6b6ff', readability:true};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const env = {...process.env, LC_ALL: 'en_US.UTF-8'};
function run(exe, args) { return execFileSync(exe, args, {encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe']}).trim(); }
function alive(pid) { if (!Number.isInteger(pid) || pid < 2) return false; try { process.kill(pid, 0); return true; } catch { return false; } }
function save(file, value) {
  fs.mkdirSync(RUNTIME, {recursive: true, mode: 0o700});
  const temp = file + '.' + randomUUID();
  try { fs.writeFileSync(temp, JSON.stringify(value), {flag: 'wx', mode: 0o600}); fs.renameSync(temp, file); }
  finally { fs.rmSync(temp, {force: true}); }
}
function readState() { if (!fs.existsSync(STATE)) return null; return JSON.parse(fs.readFileSync(STATE, 'utf8')); }
function validate(c) {
  if (!c || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(c.imageData) || c.imageData.length > 28 * 1024 * 1024) throw Error('图片配置异常，请重新import');
  if (!Number.isFinite(c.darkness) || c.darkness < 0 || c.darkness > 0.9) throw Error('darkness范围是0至0.9');
  if (!Number.isFinite(c.blur) || c.blur < 0 || c.blur > 30) throw Error('blur范围是0至30像素');
  if (!['center', 'top', 'bottom', 'left', 'right'].includes(c.position)) throw Error('position可选center/top/bottom/left/right');
  if (!/^#[0-9a-f]{6}$/i.test(c.accent)) throw Error('accent需为六位十六进制颜色，例如#b8a6ff');
  if (c.theme) validateTheme(c.theme);
  if (c.safeCSS !== undefined) adaptedCSS(c.safeCSS);
  for (const k of ['focusX','focusY']) if (c[k] !== undefined && (!Number.isFinite(c[k]) || c[k] < 0 || c[k] > 1)) throw Error('Invalid focal point');
  if(c.readability!==undefined && typeof c.readability!=='boolean') throw Error('readability需为on或off');
  return c;
}
function config() {
  if (!fs.existsSync(CONFIG)) throw Error('请先执行 node DiscordPhoto.mjs import 选择背景照片');
  if (fs.statSync(CONFIG).size > 29 * 1024 * 1024) throw Error('图片配置过大，请重新import');
  return validate(JSON.parse(fs.readFileSync(CONFIG, 'utf8')));
}
function css(c) {
  const prefix = names => names.flatMap(n => [`[class^="${n}_"]`, `[class*=" ${n}_"]`]).join(',');
  const light = c.theme?.appearance === 'light';
  const p = {background:light?'#f5f8fa':'#151720',panel:light?'#ffffff':'#161822',panelAlt:light?'#edf3f7':'#20222e',text:light?'#183038':'#f0f1f5',muted:light?'#526875':'#bec2d0',accentAlt:c.accent,secondary:c.accent,highlight:c.accent,line:light?'#bfd0db':'#465065',...(c.theme?.colors || {}),accent:c.accent};
  const tokens=Object.entries(p).map(([k,v])=>`--ds-theme-color-${k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}: ${v};`).join('\n');
  const palette=`body[data-discord-photo], body[data-discord-photo] #app-mount, body[data-discord-photo] :is(.theme-dark,.theme-light,.theme-darker,.theme-midnight,[data-discord-ds-part]) {
${tokens}
--ds-theme-surface-radius:16px; --ds-theme-surface-opacity:.8; --ds-theme-surface-blur:12px;
--ds-theme-font-family:system-ui; --ds-theme-font-scale:1; --ds-theme-density-scale:1;
--text-normal:${p.text} !important; --text-default:${p.text} !important; --header-primary:${p.text} !important;
--text-muted:${p.muted} !important; --text-subtle:${p.muted} !important; --header-secondary:${p.muted} !important;
--interactive-normal:${p.muted} !important; --interactive-active:${p.text} !important;
--text-strong:${p.text} !important; --text-secondary:${p.muted} !important; --channels-default:${p.muted} !important;
--interactive-text-default:${p.muted} !important; --interactive-text-hover:${p.text} !important; --interactive-text-active:${p.text} !important;
--interactive-icon-default:${p.muted} !important; --interactive-icon-hover:${p.text} !important; --interactive-icon-active:${p.text} !important;
--background-floating:${p.panel} !important; --background-surface-high:${p.panel} !important;
--background-surface-higher:${p.panel} !important; --background-surface-highest:${p.panelAlt} !important;
--channeltextarea-background:${p.panelAlt} !important; --text-link:${c.accent} !important;
--background-modifier-hover:${light?'rgba(20,60,80,.08)':'rgba(200,225,255,.08)'} !important;
}
body[data-discord-photo] [data-discord-photo-shell] {background-color:transparent !important;}
body[data-discord-photo] [data-discord-ds-part="composer"] {color:${p.text};}
`;
  const readable=c.theme && c.readability!==false ? `@layer discord-readability {
  [data-discord-ds-part="sidebar"] {background-color:color-mix(in srgb,${p.panel} 82%,transparent) !important;}
  [data-discord-ds-part="header"] {background-color:color-mix(in srgb,${p.panel} 92%,transparent) !important; color:${p.text} !important;}
  [data-discord-ds-part="project-list"] {background-color:color-mix(in srgb,${p.panel} 88%,transparent) !important;}
  [data-discord-ds-part="home"] {background-color:color-mix(in srgb,${p.panel} ${light?'72':'32'}%,transparent) !important;}
  [data-discord-ds-part="dialog"], [data-discord-ds-part="composer"] {background-color:color-mix(in srgb,${p.panel} 96%,transparent) !important;}
}` : '';
  return `/* Discord Photo ${VERSION}; generated locally. */
@layer discord-readability, discord-dreamskin-community;
body[data-discord-photo] {
  --background-primary: transparent !important;
  --background-secondary: rgba(15,17,24,.35) !important;
  --background-secondary-alt: rgba(15,17,24,.45) !important;
  --background-tertiary: transparent !important;
  --background-base-lowest: transparent !important;
  --background-base-lower: rgba(15,17,24,.25) !important;
  --background-base-low: rgba(15,17,24,.3) !important;
  --background-surface-high: rgba(22,24,34,.96) !important;
  --background-surface-higher: rgba(28,30,42,.98) !important;
  --background-surface-highest: rgba(32,34,46,.98) !important;
  --background-floating: rgba(22,24,34,.98) !important;
  --chat-background: transparent !important;
  --chat-background-default: transparent !important;
  --channeltextarea-background: rgba(20,22,30,.8) !important;
  --text-normal: #f0f1f5 !important;
  --text-muted: #bec2d0 !important;
  --text-default: #f0f1f5 !important;
  --text-subtle: #bec2d0 !important;
  --header-primary: #ffffff !important;
  --header-secondary: #d4d7e3 !important;
  --interactive-normal: #d4d7e3 !important;
  --interactive-active: #ffffff !important;
  --text-link: ${c.accent} !important;
  --brand-500: ${c.accent} !important;
  background: #151720 !important;
}
body[data-discord-photo] #discord-photo-background {
  position: fixed; inset: -${c.blur * 2}px; z-index: 0; pointer-events: none;
  background-image: linear-gradient(rgba(5,7,12,${c.darkness}),rgba(5,7,12,${c.darkness})), url("${c.imageData}");
  background-size: cover; background-position: ${c.focusX === undefined ? c.position : `${c.focusX*100}% ${(c.focusY ?? .5)*100}%`}; filter: blur(${c.blur}px);
}
body[data-discord-photo] #app-mount { position: relative; z-index: 1; background: transparent !important; }
body[data-discord-photo] #app-mount :is(${prefix(['app', 'appAsidePanelWrapper', 'bg', 'base', 'chat', 'chatContent', 'content', 'page', 'sidebar', 'sidebarList', 'privateChannels', 'scroller', 'standardSidebarView', 'contentRegion', 'contentRegionScroller', 'sidebarRegion', 'sidebarRegionScroller'])}) {
  background-color: transparent !important;
}
body[data-discord-photo] #app-mount :is(${prefix(['members', 'membersWrap', 'panels'])}) { background-color: rgba(15,17,24,.42) !important; }
body[data-discord-photo] #app-mount :is(${prefix(['messagesPopoutWrap', 'menu', 'root'])}) { --background-primary: rgba(22,24,34,.98); }
` + palette + readable + (c.safeCSS ? adaptedCSS(c.safeCSS) : '');
}

// Only creates/removes our own two elements and one body attribute.
function renderer(c, stylesheet, signature) {
  const KEY = '__DISCORD_PHOTO_LOCAL__';
  if (window[KEY]?.signature === signature && document.getElementById('discord-photo-style') && document.getElementById('discord-photo-background')) return window[KEY].status();
  window[KEY]?.destroy();
  if (!document.body || !document.getElementById('app-mount')) return {state: 'waiting-app'};
  const previousAttribute = document.body.getAttribute('data-discord-photo');
  const changed = new Map();
  const mark = (el, key, value) => {
    if (!el) return;
    if (!changed.has(el)) changed.set(el,new Map());
    if (!changed.get(el).has(key)) changed.get(el).set(key,el.getAttribute(key));
    if (el.getAttribute(key)!==value) el.setAttribute(key,value);
  };
  const byClass = name => `[class^="${name}_"],[class*=" ${name}_"]`;
  const parts = {
    root:'#app-mount', sidebar:byClass('sidebarList')+','+byClass('privateChannels'),
    main:byClass('chat')+','+byClass('tabBody'), header:'section'+byClass('title').split(',').join(',section')+','+byClass('headerBar')+`,:is(${byClass('container')})[class*="themed_"]`,
    home:byClass('peopleColumn')+','+byClass('nowPlayingColumn'),
    'project-list':'[data-list-id="guildsnav"]', thread:byClass('chatContent'),
    message:byClass('message'), composer:byClass('channelTextArea'),
    'composer-toolbar':`:is(${byClass('channelTextArea')}) :is(${byClass('buttons')})`, dialog:'[role="dialog"]'
  };
  const tag = () => {
    for(const [el,attrs] of changed) if(!el.isConnected) {for(const [key,value] of attrs) {if(value===null)el.removeAttribute(key);else el.setAttribute(key,value);}changed.delete(el);}
    for (const [part, selector] of Object.entries(parts)) for (const el of document.querySelectorAll(selector)) {
      mark(el,'data-discord-ds-part',part);
      if (['sidebar','main','thread'].includes(part)) {
        for (let parent=el.parentElement;parent && parent.id!=='app-mount';parent=parent.parentElement) mark(parent,'data-discord-photo-shell','');
      }
    }
  };
  tag();
  let scheduled = false;
  const observer = new MutationObserver(() => {if (!scheduled) {scheduled=true;queueMicrotask(()=>{scheduled=false;tag();});}});
  observer.observe(document.getElementById('app-mount'), {childList:true,subtree:true});
  const layer = document.createElement('div'); layer.id = 'discord-photo-background'; layer.setAttribute('aria-hidden', 'true');
  const style = document.createElement('style'); style.id = 'discord-photo-style'; style.textContent = stylesheet;
  document.head.append(style); document.body.prepend(layer); document.body.setAttribute('data-discord-photo', '');
  let imageState = 'loading';
  const probe = new Image(); probe.onload = () => imageState = 'loaded'; probe.onerror = () => imageState = 'error'; probe.src = c.imageData;
  const api = {signature, status() {
    const counts=Object.fromEntries(Object.keys(parts).map(p=>[p,document.querySelectorAll(`[data-discord-ds-part="${p}"]`).length]));
    const mount=document.getElementById('app-mount'), rect=mount.getBoundingClientRect();
    return {state: 'applied', theme:c.theme?.name || c.name, image: imageState, style: style.isConnected, background: layer.isConnected, width: probe.naturalWidth, height: probe.naturalHeight, parts:counts,
      viewport:{width:innerWidth,height:innerHeight,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2},
      nativeAppVisible:rect.width>0 && rect.height>0 && Number(getComputedStyle(mount).opacity)>.1 && getComputedStyle(mount).visibility!=='hidden', decorationNonInteractive:getComputedStyle(layer).pointerEvents==='none',
      backgroundPainted:getComputedStyle(layer).backgroundImage!=='none',
      singleton:document.querySelectorAll('#discord-photo-style').length===1 && document.querySelectorAll('#discord-photo-background').length===1}; }, destroy() {
    observer.disconnect();
    for(const [el,attrs] of changed) for(const [key,value] of attrs) {if(value===null)el.removeAttribute(key);else el.setAttribute(key,value);}
    probe.onload = probe.onerror = null; style.remove(); layer.remove();
    if (previousAttribute === null) document.body.removeAttribute('data-discord-photo'); else document.body.setAttribute('data-discord-photo', previousAttribute);
    delete window[KEY];
  }};
  window[KEY] = api; return api.status();
}
function payload() {
  const c = config(); const stylesheet = css(c);
  const signature = createHash('sha256').update(stylesheet).digest('hex');
  return `(${renderer.toString()})(${JSON.stringify(c)},${JSON.stringify(stylesheet)},${JSON.stringify(signature)})`;
}
function verifyProcess(s) {
  if (!Number.isInteger(s?.pid) || !Number.isInteger(s?.port) || s.port < 1024 || s.port > 65535) throw Error('会话记录无效');
  const command = run('/bin/ps', ['-p', String(s.pid), '-o', 'command=']);
  if (!command.startsWith(EXE + ' ') || !command.includes(`--remote-debugging-port=${s.port}`)) throw Error('进程身份不匹配，停止连接');
  if(s.startedAt && run('/bin/ps',['-p',String(s.pid),'-o','lstart='])!==s.startedAt) throw Error('Discord process start time mismatch');
}
function verify(s) {
  verifyProcess(s);
  const sockets = run('/usr/sbin/lsof', ['-nP', '-a', '-p', String(s.pid), `-iTCP:${s.port}`, '-sTCP:LISTEN']).split('\n').slice(1);
  if (!sockets.length || sockets.some(l => !l.includes(`127.0.0.1:${s.port} (LISTEN)`))) throw Error('未确认调试端口仅监听127.0.0.1');
}
async function targets(s) {
  verify(s);
  const r = await fetch(`http://127.0.0.1:${s.port}/json/list`, {signal: AbortSignal.timeout(2500)});
  if (!r.ok) throw Error('无法读取本机会话');
  return (await r.json()).filter(t => { try { const u = new URL(t.url); return t.type === 'page' && u.protocol === 'https:' && u.hostname === 'discord.com' && (u.pathname === '/app' || u.pathname.startsWith('/channels/') || u.pathname === '/login'); } catch { return false; } });
}
async function evaluate(s, t, expression) {
  const u = new URL(t.webSocketDebuggerUrl);
  if (u.protocol !== 'ws:' || u.hostname !== '127.0.0.1' || Number(u.port) !== s.port) throw Error('拒绝非本机会话地址');
  const ws = new WebSocket(u); let timer;
  try {
    await new Promise((resolve, reject) => { timer = setTimeout(() => reject(Error('连接超时')), 5000); ws.onopen = resolve; ws.onerror = () => reject(Error('连接失败')); });
    clearTimeout(timer);
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(Error('执行超时')), 5000);
      ws.onerror = () => reject(Error('会话中断'));
      ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id !== 1) return; if (m.error || m.result?.exceptionDetails) reject(Error(m.error?.message || m.result.exceptionDetails.text)); else resolve(typeof expression==='string'?m.result?.result?.value:m.result); };
      ws.send(JSON.stringify({id: 1, ...(typeof expression==='string'?{method: 'Runtime.evaluate', params: {expression, returnByValue: true}}:expression)}));
    });
  } finally { clearTimeout(timer); ws.close(); }
}
async function apply(s) { const source = payload(); const rows = []; for (const t of await targets(s)) rows.push(await evaluate(s, t, source)); return rows; }
function verifyHelper(s) {
  const command = run('/bin/ps', ['-p', String(s.helperPid), '-o', 'command=']);
  if (!command.startsWith(s.helperExec+' ') || !command.includes(SELF) || !command.endsWith(' watch') || !s.helperStartedAt || run('/bin/ps',['-p',String(s.helperPid),'-o','lstart='])!==s.helperStartedAt) throw Error('后台身份不匹配');
}
function startWatcher(s) {
  const revision=createHash('sha256').update(fs.readFileSync(SELF)).update(fs.readFileSync(path.join(DIR,'theme-packs.mjs'))).digest('hex');
  if (alive(s.helperPid)) { verifyHelper(s); if(s.helperRevision===revision)return;process.kill(s.helperPid,'SIGTERM'); }
  const fd = fs.openSync(path.join(RUNTIME, 'helper.log'), 'a', 0o600);
  try { const child = spawn(process.execPath, [SELF, 'watch'], {detached: true, stdio: ['ignore', fd, fd]}); child.unref(); s.helperPid = child.pid;s.helperRevision=revision;s.helperExec=process.execPath;s.helperStartedAt=run('/bin/ps',['-p',String(child.pid),'-o','lstart=']); save(STATE, s); }
  finally { fs.closeSync(fd); }
}
async function refresh() {
  const s = readState();
  if (!s || !alive(s.pid)) { console.log('下次start时自动使用新设置。'); return; }
  const rows = await apply(s); startWatcher(s);
  console.log(rows.length ? '已通知当前Discord会话；status可检查图片加载结果。' : '已保存，等待Discord主界面。');
}
async function imported(argument) {
  const selected = argument || run('/usr/bin/osascript', ['-e', 'try\nset f to choose file with prompt "选择Discord背景照片（仅在本机保存）" of type {"public.image"}\nreturn POSIX path of f\non error number -128\nreturn ""\nend try']);
  if (!selected) { console.log('已取消，原背景保持不变。'); return; }
  const file = path.resolve(selected), stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 12 * 1024 * 1024) throw Error('请选择不超过12MiB的照片文件');
  const info = run('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'format', file]);
  const width = Number(info.match(/pixelWidth: (\d+)/)?.[1]), height = Number(info.match(/pixelHeight: (\d+)/)?.[1]);
  const format = info.match(/format: (\S+)/)?.[1];
  if (!['png', 'jpeg', 'heic', 'webp'].includes(format)) throw Error('本版支持PNG/JPG/HEIC及系统可解码的WebP静态照片');
  if (!width || !height || width > 8192 || height > 8192 || width * height > 24_000_000) throw Error('照片最多8192像素边长、2400万像素，请先缩小');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'discord-photo-'));
  try {
    const output = path.join(temp, 'background.png');
    const resize = Math.max(width, height) > 2560 ? ['-Z', '2560'] : [];
    run('/usr/bin/sips', ['-s', 'format', 'png', ...resize, file, '--out', output]);
    if (fs.statSync(output).size > 20 * 1024 * 1024) throw Error('转换后图片过大，请缩小后重试');
    const data = fs.readFileSync(output);
    if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('图片转换失败');
    const previous = fs.existsSync(CONFIG) ? config() : DEFAULTS;
    const c = validate({...previous, imageData: 'data:image/png;base64,' + data.toString('base64'), name: path.basename(file), originalWidth: width, originalHeight: height});
    save(CONFIG, c); console.log(`照片已在本机保存：${width}×${height}。原照片之后可以移动。`);
  } finally { fs.rmSync(temp, {recursive: true, force: true}); }
  try { await refresh(); } catch (e) { console.log('照片已保存，但当前会话刷新失败：' + e.message); }
}
async function start() {
  config();
  const old = readState();
  if (old && alive(old.pid)) { verify(old); startWatcher(old); console.log(JSON.stringify(await apply(old))); return; }
  if (!fs.existsSync(EXE)) throw Error('找不到/Applications/Discord.app');
  try { if (run('/usr/bin/pgrep', ['-f', '^/Applications/Discord[.]app/Contents/MacOS/Discord( |$)'])) throw Error('DISCORD_RUNNING'); }
  catch (e) { if (e.message === 'DISCORD_RUNNING') throw Error('请先Command+Q正常退出Discord，再start；不会强制关闭已有会话'); if (e.status !== 1) throw e; }
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port; await new Promise(r => server.close(r));
  const child = spawn(EXE, [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1'], {detached: true, stdio: 'ignore'}); child.unref();
  child.on('error', e => console.error('Discord启动失败：' + e.message));
  if (!child.pid) throw Error('Discord启动失败');
  const s = {pid: child.pid, port, version: VERSION, createdAt: new Date().toISOString(),startedAt:run('/bin/ps',['-p',String(child.pid),'-o','lstart='])};
  save(STATE, s); // Retain recovery information even if the client refuses debugging.
  let ready = false;
  for (let i = 0; i < 60; i++) { await sleep(250); try { await targets(s); ready = true; break; } catch { if (!alive(s.pid)) break; } }
  if (!ready) throw Error('当前Discord未开放可验证的本机调试入口。请Command+Q退出，再从官方图标打开。未修改安装包；本版本暂不能接入。');
  startWatcher(s);
  const rows = await apply(s);
  console.log(rows.length ? '主题已注入；请用status检查image是否loaded。' : '启动器已连接，等待Discord主界面；尚未确认主题显示。');
}
async function watch() {
  const s = readState(); verify(s); let busy = false, failures = 0;
  const timer = setInterval(async () => {
    if (!alive(s.pid)) { clearInterval(timer); process.exit(0); }
    if (busy) return; busy = true;
    try { await apply(s); failures = 0; }
    catch (e) { if (++failures === 3) console.error('主题接入失败：' + e.message); }
    finally { busy = false; }
  }, 1800);
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { clearInterval(timer); process.exit(0); });
}
async function restore(restart=false) {
  const s = readState();
  if (!s) { console.log('没有本启动器的会话。正常退出Discord后从官方图标打开即可。'); return; }
  if (alive(s.helperPid)) { verifyHelper(s); process.kill(s.helperPid, 'SIGTERM'); await sleep(300); }
  if (!alive(s.pid)) { fs.rmSync(STATE, {force: true}); console.log('主题会话已退出；已清理记录，照片仍保留。'); return; }
  if(restart) {
    verifyProcess(s);
    process.kill(s.pid,'SIGTERM');
    for(let i=0;i<50 && alive(s.pid);i++) await sleep(200);
    if(alive(s.pid)) throw Error('Discord尚未退出，没有强制结束；请正常Command+Q退出以关闭调试端口。');
    fs.rmSync(STATE,{force:true}); run('/usr/bin/open',['-a',APP]);
    return console.log('Discord已完整退出主题会话，并从官方入口重开；调试端口已关闭，照片和主题库保留。');
  }
  verify(s);
  for (const t of await targets(s)) await evaluate(s, t, 'window.__DISCORD_PHOTO_LOCAL__?.destroy();true');
  console.log('已移除照片主题。请Command+Q完整退出Discord，再点击官方图标打开，以关闭本次调试入口。照片仍保留。');
  // Keep session identity until the application exits, so start can safely reuse it.
}
function savedThemes() {
  if (!fs.existsSync(LIBRARY)) return [];
  return fs.readdirSync(LIBRARY).filter(n=>/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}\.json$/.test(n)).map(n=>{
    const c=validate(JSON.parse(fs.readFileSync(path.join(LIBRARY,n),'utf8')));
    return {id:c.theme.id,name:c.theme.name,appearance:c.theme.appearance || 'auto',sourcePlatforms:c.sourcePlatforms,license:c.license};
  });
}
async function importTheme(argument, origin = null) {
  const source=argument || run('/usr/bin/osascript',['-e','try\nset f to choose file with prompt "选择DreamSkin主题ZIP（保存后用theme-use应用）" of type {"public.zip-archive"}\nreturn POSIX path of f\non error number -128\nreturn ""\nend try']);
  if (!source) return console.log('已取消，当前主题保持不变。');
  const pack=loadPack(source);
  const light=pack.theme.appearance==='light';
  const accent=/^#[\da-f]{6}$/i.test(pack.theme.colors?.accent || '')?pack.theme.colors.accent:DEFAULTS.accent;
  const custom=pack.theme.discordPhoto || {};
  if(!custom || typeof custom!=='object' || Array.isArray(custom) || Object.keys(custom).some(k=>!['darkness','blur','readability','position'].includes(k))) throw Error('Invalid Discord adapter settings');
  const c=validate({...DEFAULTS,...pack,accent,darkness:light?.06:.22,focusX:pack.theme.art?.focusX ?? .5,focusY:pack.theme.art?.focusY ?? .5,...custom,...(origin?{gallery:origin}:{})});
  fs.mkdirSync(LIBRARY,{recursive:true,mode:0o700});
  const file=path.join(LIBRARY,pack.theme.id+'.json');
  if (fs.existsSync(file)) {
    if (fs.lstatSync(file).isSymbolicLink()) throw Error('Saved theme is a symbolic link');
    const old=JSON.parse(fs.readFileSync(file,'utf8'));
    if (old.theme?.id!==pack.theme.id) throw Error('Saved theme identity mismatch');
    if (old.fingerprint===pack.fingerprint) {
      if(origin)save(file,{...old,gallery:origin});
      console.log('相同主题已保存；当前主题未改变。ID: '+pack.theme.id);
      return {id:pack.theme.id,name:pack.theme.name,unchanged:true};
    }
  }
  save(file,c);
  console.log(`已保存主题：${pack.theme.name}\nID: ${pack.theme.id}\n源平台：${pack.sourcePlatforms.join(', ') || '未声明'}（通过Discord适配器使用素材和Safe CSS）\n当前主题未改变。执行 theme-use ${pack.theme.id} 应用。`);
  return {id:pack.theme.id,name:pack.theme.name,unchanged:false};
}
async function confirmedApply(s,{attempts=24}={}) {
  for(let i=0;i<attempts;i++) {
    const rows=await apply(s);
    if(rows.length && rows.every(r=>r.state==='applied' && r.image==='loaded' && r.nativeAppVisible && r.decorationNonInteractive && r.singleton && !r.viewport.horizontalOverflow)) return rows;
    if(rows.some(r=>r.image==='error')) throw Error('Background could not be decoded in Discord');
    await sleep(250);
  }
  throw Error('Live render not confirmed (image/native interface/overflow checks)');
}
async function useTheme(id) {
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(id || '')) throw Error('Specify an ID from the themes command');
  const file=path.join(LIBRARY,id+'.json');
  if(fs.lstatSync(file).isSymbolicLink() || fs.statSync(file).size>29*1024*1024) throw Error('Invalid saved theme');
  const next=validate(JSON.parse(fs.readFileSync(file,'utf8')));
  const previous=fs.existsSync(CONFIG)?fs.readFileSync(CONFIG):null;
  save(CONFIG,next);
  const s=readState();
  if(!s || !alive(s.pid)) return console.log('主题已选择；下次start应用，尚未验证实时显示：'+next.theme.name);
  try {
    const rows=await confirmedApply(s);startWatcher(s);
    console.log('Discord实时检查通过：'+next.theme.name+'\n'+JSON.stringify(rows,null,2));
  } catch(error) {
    if(previous) {
      save(CONFIG,JSON.parse(previous));
      try {await confirmedApply(s);console.error('新主题未通过检查，已确认恢复上一个主题。');}
      catch {console.error('旧配置已恢复，但实时恢复未确认；请restore并完整退出Discord。');}
    } else {
      fs.rmSync(CONFIG,{force:true});
      for(const t of await targets(s)) await evaluate(s,t,'window.__DISCORD_PHOTO_LOCAL__?.destroy();true');
    }
    throw error;
  }
}
async function limitedFetch(url,limit) {
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok || Number(response.headers.get('content-length'))>limit) throw Error('Theme download failed or exceeded limits');
  const chunks=[];let total=0;
  for await(const chunk of response.body) {total+=chunk.length;if(total>limit) throw Error('Download exceeded limit');chunks.push(chunk);}
  return Buffer.concat(chunks);
}
async function fetchTheme(input) {
  const id=/^ver_[a-z0-9]{8,64}$/.test(input || '')?input:input?.match(/^https:\/\/dreamskin\.cc\/(?:en\/)?themes\/(ver_[a-z0-9]{8,64})\/?$/)?.[1];
  if(!id) throw Error('Use a ver_... version ID or a DreamSkin /themes/ver_... page URL');
  const meta=JSON.parse((await limitedFetch('https://api.dreamskin.cc/v1/themes/'+id,128*1024)).toString('utf8'));
  if(meta.id!==id || !meta.reviewedAt || !Number.isInteger(meta.packageBytes) || meta.packageBytes<1 || meta.packageBytes>32*1024*1024 || !/^[a-f0-9]{64}$/.test(meta.packageSha256)) throw Error('Invalid public gallery metadata');
  const bytes=await limitedFetch('https://api.dreamskin.cc/v1/themes/'+id+'/download',32*1024*1024);
  if(bytes.length!==meta.packageBytes || createHash('sha256').update(bytes).digest('hex')!==meta.packageSha256) throw Error('Public theme size/hash mismatch');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'discord-gallery-'));
  try {const file=path.join(tmp,'theme.zip');fs.writeFileSync(file,bytes,{mode:0o600});return await importTheme(file,{versionId:id,themeId:meta.themeId,version:meta.version,name:meta.name,packageSha256:meta.packageSha256});}
  finally {fs.rmSync(tmp,{recursive:true,force:true});}
}
const HELP = `Discord照片主题 macOS ${VERSION}（实验版，Node 22+）
node DiscordPhoto.mjs import [照片路径]  选择/更换照片
node DiscordPhoto.mjs theme-import [ZIP/目录] 保存DreamSkin主题（需Python3）
node DiscordPhoto.mjs themes             列出已保存主题
node DiscordPhoto.mjs theme-use ID       应用主题，失败时尝试恢复旧设置
node DiscordPhoto.mjs theme-fetch VERSION 从DreamSkin官方API下载并保存
node DiscordPhoto.mjs verify             检查原生界面、图片和装饰层
node DiscordPhoto.mjs theme-export FILE.zip 导出自己的完整主题（需Python3）
node DiscordPhoto.mjs capture FILE.png    保存当前Discord截图（可能包含私人内容）
node DiscordPhoto.mjs info               查看照片和设置
node DiscordPhoto.mjs set darkness 0.48  遮罩0–0.9（越大越暗）
node DiscordPhoto.mjs set blur 6         模糊0–30像素
node DiscordPhoto.mjs set position top   center/top/bottom/left/right
node DiscordPhoto.mjs set accent '#a6b6ff'
node DiscordPhoto.mjs start              启动照片主题模式
node DiscordPhoto.mjs status             检查注入与图片解码
node DiscordPhoto.mjs restore            移除照片主题
node DiscordPhoto.mjs restore --restart  完整退出调试实例并重开普通Discord
node DiscordPhoto.mjs self-check         检查已保存配置与注入脚本
node DiscordPhoto.mjs export             导出CSS（需加载器配合，不是官方导入格式）`;
export {validate, css, renderer, evaluate, targets, readState, config, savedThemes, importTheme, fetchTheme, limitedFetch, useTheme, start, restore, confirmedApply, alive, save, RUNTIME, LIBRARY, CONFIG, EXE};
async function main() {
  if (Number(process.versions.node.split('.')[0]) < 22 || typeof WebSocket !== 'function') throw Error('需要Node.js 22或更高版本');
  const [cmd = 'help', a, b] = process.argv.slice(2);
  if (cmd === 'help' || cmd === '--help') return console.log(HELP);
  if (process.platform !== 'darwin') throw Error('本启动器仅支持macOS');
  if (cmd === 'import' || cmd === 'image') return imported(a);
  if (cmd === 'theme-import') return importTheme(a);
  if (cmd === 'theme-fetch') return fetchTheme(a);
  if (cmd === 'themes') return console.log(JSON.stringify(savedThemes(),null,2));
  if (cmd === 'theme-use') return useTheme(a);
  if (cmd === 'theme-export') {
    config();if(!a?.endsWith('.zip')) throw Error('Specify an output .zip path');
    run('python3',[path.join(DIR,'export-pack.py'),CONFIG,path.resolve(a)]);
    return console.log('已导出简化主题包：'+path.resolve(a));
  }
  if (cmd === 'capture') {
    if(!a?.endsWith('.png')) throw Error('Specify an output .png path');
    const s=readState(),pages=await targets(s); if(!pages.length) throw Error('Discord main page unavailable');
    const result=await evaluate(s,pages[0],{method:'Page.captureScreenshot',params:{format:'png',captureBeyondViewport:false}});
    fs.writeFileSync(path.resolve(a),Buffer.from(result.data,'base64'),{mode:0o600});return console.log('截图已在本机保存。');
  }
  if (cmd === 'start') return start();
  if (cmd === 'watch') return watch();
  if (cmd === 'restore') return restore(a==='--restart');
  if (cmd === 'info') { const {imageData, ...rest} = config(); return console.log(JSON.stringify(rest, null, 2)); }
  if (cmd === 'set') {
    if ((!Object.hasOwn(DEFAULTS, a) && !['focusX','focusY'].includes(a)) || b === undefined) throw Error('请按help里的set格式输入');
    if(a==='readability' && !['on','off'].includes(b)) throw Error('readability可选on/off');
    const c = validate({...config(), [a]: a==='readability'?b==='on':['darkness', 'blur','focusX','focusY'].includes(a) ? Number(b) : b});
    if(a==='position') {delete c.focusX;delete c.focusY;}
    save(CONFIG, c);
    console.log('设置已保存。'); try { await refresh(); } catch (e) { console.log('当前会话刷新失败：' + e.message); } return;
  }
  if (cmd === 'status' || cmd === 'verify') {
    const s = readState(); if (!s || !alive(s.pid)) return console.log('主题模式未运行。');
    const rows = []; for (const t of await targets(s)) rows.push(await evaluate(s, t, 'window.__DISCORD_PHOTO_LOCAL__?.status() || {state:"not-injected"}'));
    if(cmd==='verify' && (!rows.length || rows.some(r=>r.image!=='loaded' || !r.nativeAppVisible || !r.decorationNonInteractive || !r.singleton || r.viewport?.horizontalOverflow))) process.exitCode=1;
    return console.log(JSON.stringify(rows.length ? rows : {state: 'waiting-app'}, null, 2));
  }
  if (cmd === 'self-check') { new Function(payload()); console.log('配置和脚本结构检查通过；不代表已在Discord显示。'); return; }
  if (cmd === 'export') {
    const c = config();
    if(c.theme) throw Error('完整主题需要Discord部件适配，请使用theme-export导出ZIP；纯CSS不能创建部件映射。');
    // Export includes its own background element via a body pseudo-element.
    const out = css(c).replaceAll('body[data-discord-photo]', 'body').replaceAll('#discord-photo-background', '::before').replace('position: fixed;', 'content: ""; position: fixed;');
    fs.writeFileSync(path.join(DIR, 'DiscordPhoto.theme.css'), `/**\n * @name Discord Photo\n * @author Local\n * @version ${VERSION}\n * @description Local photo background\n */\n` + out, {mode: 0o600});
    console.log('已导出DiscordPhoto.theme.css（内含照片，请按私人文件保管）。'); return;
  }
  throw Error('未知命令；执行node DiscordPhoto.mjs help查看用法');
}
if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(SELF)) main().catch(e => { console.error('操作未完成：' + (e.stderr?.toString().trim() || e.message)); process.exitCode = 1; });
