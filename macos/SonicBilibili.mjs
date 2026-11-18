import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import net from 'node:net';
import {execFileSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const DIR=path.dirname(fileURLToPath(import.meta.url));
const RUNTIME=path.join(DIR,'.sonic-runtime');
const STATE=path.join(RUNTIME,'session.json');
const CHARACTER=path.join(RUNTIME,'character.json');
const CLIENT_VERSION='1.1.0';

// 本文件已内置角色和显示脚本，无需另外发送素材文件。
const DEFAULT_CONFIG={"width": 31, "height": 38, "idleOpacity": 0.65, "bottom": 2};
const IMAGE_DATA="data:image/gif;base64,R0lGODlhHwAmAPf/ABU3xdoDASdc+uLj1pelt2VicujZ5aiayldldKOktv6tOOXe3tnp5IUBApmcuOQCAaeautzb2sm96Agld1hjhMLF5hQ2uaRnNuqueLdjTLvE19rj2nkBAQcbdmpUdtuxcmhag/SneSYjKQUaaxQsxAsmhQsquLnD4hIZdWFlgtrY5gghace81iNj/ri34hZBx8HD2AssxNt4BgZpJxhq6Oqtghxj/hgmKBUheRYuuiRi5+WygwtDtgdIxJicx7q93bJqOpxySykaKdrh9hxc+BQaaPiyhJyjwQ4cgxtk9Bxp/Q0zwxMjahRHuSIjGV5Zi/2yOwwyvBIjGuWrauYBEge+AyMusKOhyhYzz1lYd5yireG2V+/j8Qg10QU1q5Oywh0vxJ2pw7RsU6OjweyxfJ1sNwQ0vKxbRRZp+/OpiOyzcyFp/Q0zyxM0q9Dr1qVtQ5WkxOOxciNj9QwZX7fCyhxq8+Hl7OW0erJePPK0d5mj04UBERNk8o+quuHi4Rop1aZyOww6w6xlS9bnyAMytCkZFWJkk6mgyxwZFw0ytAw5ugMywhscJdTC59zd7yNp8wI7w6lrVPIBAwdKq+rkzipi/RZI0NwGDXsCEQxC1hdi/qWe1Q46zODr6a5rQaplQr67zuvl36FoQ6ZtSaWiq3p8gzNm/erg7Bpw+B4WdrtlKrh0Vgw7sC1p85yry20GAJqz0yxf86ZzRQcsqq5pTPKtbLhvRqRjSwM6ygAzz6mivwMiXyxr/xJPvJqvvatiL/G0awpQugY4up6hzyxy/urc7w9r9BMqqx0MbQ0qzQE5sY8AAcQDABdq9bCguw8SZRdu3w8teg0ReI2rzZG4yp8DEOwAKCQejIu4vYx/eeGtfu+tlaC02dHk4g1i4+vr7wprQhoqgu7Z3RFw5hJPycLBxwtV0Pja9szF3t7ez6enzq5zVc7j0KGyvHAKGiA8wNHc2W5ihXBineje0e26f/DbyAs24N+3d+i3e05qW6/C3QpUqQwvagcwenoLAv///yH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6ODNCNjNCQjNFM0I0MTFFMzg3RjBCRUM5NDFEREU1QUUiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6ODNCNjNCQjRFM0I0MTFFMzg3RjBCRUM5NDFEREU1QUUiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo4M0I2M0JCMUUzQjQxMUUzODdGMEJFQzk0MURERTVBRSIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo4M0I2M0JCMkUzQjQxMUUzODdGMEJFQzk0MURERTVBRSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgH//v38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubi3trW0s7KxsK+urayrqqmop6alpKOioaCfnp2cm5qZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBgH9+fXx7enl4d3Z1dHNycXBvbm1sa2ppaGdmZWRjYmFgX15dXFtaWVhXVlVUU1JRUE9OTUxLSklIR0ZFRENCQUA/Pj08Ozo5ODc2NTQz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";
const RENDERER_SOURCE="/* Desktop renderer payload. Loaded only into verified bilipc player.html targets. */\n(() => {\n  'use strict';\n  const VERSION = '1.0.0';\n  const KEY = '__BILI_MAC_SONIC__';\n  const config = window.__BILI_MAC_SONIC_CONFIG__;\n  if (window[KEY]?.version === VERSION && window[KEY]?.signature === config?.signature) return window[KEY].status();\n  window[KEY]?.destroy?.();\n  if (!config?.imageData?.startsWith('data:image/')) throw new Error('Missing local character image');\n  const ID = 'bili-mac-sonic-overlay';\n  let active = null;\n  let last = {state:'waiting-player',version:VERSION};\n  function visible(e) {\n    if (!e || !e.isConnected) return false;\n    const rect=e.getBoundingClientRect();\n    if(rect.width<=0 || rect.height<=0) return false;\n    let opacity=1;\n    for(let p=e;p instanceof Element;p=p.parentElement) {\n      const s=getComputedStyle(p);\n      if(p.hidden || s.display==='none' || s.visibility==='hidden') return false;\n      opacity*=Number(s.opacity);\n      if(opacity<0.05) return false;\n    }\n    return true;\n  }\n  function detach() {\n    if(!active)return;\n    active.layer.remove();\n    if(active.positionChanged && active.root.style.position==='relative') {\n      if(active.oldPosition)active.root.style.setProperty('position',active.oldPosition,active.oldPriority);\n      else active.root.style.removeProperty('position');\n    }\n    active=null;\n  }\n  function mount(root,video) {\n    detach();\n    const oldPosition=root.style.getPropertyValue('position');\n    const oldPriority=root.style.getPropertyPriority('position');\n    const positionChanged=getComputedStyle(root).position==='static';\n    if(positionChanged)root.style.position='relative';\n    const layer=document.createElement('div');\n    layer.id=ID;layer.setAttribute('aria-hidden','true');\n    layer.style.cssText='position:absolute;pointer-events:none;z-index:100;overflow:visible;height:3px;display:none;';\n    const fill=document.createElement('div');\n    fill.style.cssText='position:absolute;top:0;left:0;height:100%;pointer-events:none;background:#139dff;';\n    const image=document.createElement('img');\n    image.alt='';image.draggable=false;\n    image.style.cssText=`position:absolute;bottom:1px;width:${config.width}px;height:${config.height}px;max-width:none;object-fit:contain;pointer-events:none;`;\n    image.src=config.imageData;\n    image.addEventListener('error',()=>{last={...last,image:'failed'};image.style.display='none';});\n    layer.append(fill,image);root.append(layer);\n    active={root,video,layer,fill,image,positionChanged,oldPosition,oldPriority};\n  }\n  function tick() {\n    try {\n      const choices=[...document.querySelectorAll('.bpx-player-container video,.bpx-player-container bwp-video')]\n        .map(video=>({video,root:video.closest('.bpx-player-container')}))\n        .filter(({root,video})=>visible(root)&&(visible(video)||video.tagName==='BWP-VIDEO'))\n        .sort((a,b)=>{\n          const aReady=Number.isFinite(a.video.duration)&&a.video.duration>0;\n          const bReady=Number.isFinite(b.video.duration)&&b.video.duration>0;\n          if(aReady!==bReady)return Number(bReady)-Number(aReady);\n          const x=a.root.getBoundingClientRect(),y=b.root.getBoundingClientRect();return y.width*y.height-x.width*x.height;\n        });\n      if(!choices.length){detach();last={state:'waiting-player',version:VERSION};return;}\n      const {root,video}=choices[0];\n      if(!active || active.root!==root || active.video!==video || !active.layer.isConnected)mount(root,video);\n      const {layer,fill,image}=active;\n      const duration=Number(video.duration),time=Number(video.currentTime);\n      if(!Number.isFinite(duration)||duration<=0){layer.style.display='none';last={state:'waiting-duration',version:VERSION};return;}\n      const rect=root.getBoundingClientRect();\n      const tracks=[...root.querySelectorAll('.bpx-player-progress-schedule-wrap,.bpx-player-progress-wrap')]\n        .filter(e=>!e.closest('.bpx-player-shadow-progress-area'));\n      const track=tracks.find(visible);\n      const hidden=root.getAttribute('data-ctrl-hidden');\n      const ctrlShown=root.getAttribute('ctrl-shown');\n      const shown=hidden!==null ? hidden==='false' : ctrlShown!==null ? ctrlShown==='true' : !!track;\n      let left=0,top=root.clientHeight-3-config.bottom,width=root.clientWidth;\n      if(shown && track){\n        const r=track.getBoundingClientRect();\n        const scaleX=root.clientWidth/rect.width,scaleY=root.clientHeight/rect.height;\n        left=(r.left-rect.left)*scaleX;top=(r.bottom-rect.top)*scaleY-3;width=r.width*scaleX;\n      }\n      const fraction=Math.min(1,Math.max(0,(Number.isFinite(time)?time:0)/duration));\n      layer.style.left=`${left}px`;layer.style.top=`${top}px`;layer.style.width=`${width}px`;\n      layer.style.opacity=String(shown?1:config.idleOpacity);\n      layer.style.background=shown?'transparent':'rgba(255,255,255,.22)';\n      layer.style.display='block';fill.style.display=shown?'none':'block';fill.style.width=`${fraction*100}%`;\n      image.style.left=`${Math.min(Math.max(0,width-config.width),Math.max(0,fraction*width-config.width/2))}px`;\n      last={version:VERSION,state:'active',mode:shown?'native-track':'idle-bottom',currentTime:time,duration,fraction,image:image.complete&&image.naturalWidth>0?'loaded':image.style.display==='none'?'failed':'loading',overlayCount:root.querySelectorAll('#'+ID).length};\n    }catch(error){if(active)active.layer.style.display='none';last={version:VERSION,state:'error',message:String(error.message)};}\n  }\n  const timer=setInterval(tick,150);\n  const destroy=()=>{clearInterval(timer);detach();delete window[KEY];delete window.__BILI_MAC_SONIC_CONFIG__;};\n  window[KEY]={version:VERSION,signature:config.signature,status:()=>({...last}),destroy};\n  tick();return window[KEY].status();\n})();\n";

const APP='/Applications/哔哩哔哩.app';
const EXE=APP+'/Contents/MacOS/哔哩哔哩';
fs.mkdirSync(RUNTIME,{recursive:true,mode:0o700});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
if(Number(process.versions.node.split('.')[0])<22||typeof WebSocket!=='function')throw Error('需要Node.js 22或更高版本。');
function readState(){try{return JSON.parse(fs.readFileSync(STATE,'utf8'));}catch{return null;}}
function alive(pid){try{process.kill(pid,0);return true;}catch{return false;}}
function verify(state){
 if(!Number.isInteger(state?.pid)||!Number.isInteger(state?.port)||state.port<1024||state.port>65535)throw Error('无效会话记录');
 const command=execFileSync('/bin/ps',['-p',String(state.pid),'-o','command='],{encoding:'utf8',env:{...process.env,LC_ALL:'en_US.UTF-8'}}).trim();
 if(!command.startsWith(EXE+' ')||!command.includes(`--remote-debugging-port=${state.port}`))throw Error('PID与本启动器的B站实例不匹配；停止操作');
 const sockets=execFileSync('/usr/sbin/lsof',['-nP','-a','-p',String(state.pid),`-iTCP:${state.port}`,'-sTCP:LISTEN'],{encoding:'utf8',env:{...process.env,LC_ALL:'en_US.UTF-8'}});
 const rows=sockets.trim().split('\n').slice(1);
 if(!rows.length||rows.some(r=>!r.includes(`127.0.0.1:${state.port} (LISTEN)`)))throw Error('调试端口未确认仅绑定127.0.0.1；停止连接');
}
async function targets(state){verify(state);const r=await fetch(`http://127.0.0.1:${state.port}/json/list`,{signal:AbortSignal.timeout(2500)});if(!r.ok)throw Error('无法读取本机调试目标');return(await r.json()).filter(t=>{try{const u=new URL(t.url);return t.type==='page'&&u.protocol==='https:'&&u.hostname==='bilipc.bilibili.com'&&u.pathname==='/player.html';}catch{return false;}});}
async function evaluate(state,target,expression){
 const u=new URL(target.webSocketDebuggerUrl);
 if(u.protocol!=='ws:'||!['127.0.0.1','localhost'].includes(u.hostname)||Number(u.port)!==state.port)throw Error('拒绝非本机会话地址');
 const ws=new WebSocket(u);let timer;
 try{
  await new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('调试连接超时')),5000);ws.onopen=resolve;ws.onerror=()=>reject(Error('调试连接失败'));});clearTimeout(timer);
  return await new Promise((resolve,reject)=>{
   timer=setTimeout(()=>reject(Error('脚本执行超时')),5000);
   ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id!==1)return;if(m.error||m.result?.exceptionDetails)reject(Error(m.error?.message||m.result.exceptionDetails.text));else resolve(m.result?.result?.value);};
   ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression,returnByValue:true}}));
  });
 }finally{clearTimeout(timer);ws.close();}
}
function inspectGif(bytes){
 if(bytes.length>2*1024*1024)throw Error('GIF超过2MiB，请缩小或减少动画帧');
 if(bytes.length<14||!['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString()))throw Error('不是实际GIF文件；不能只改扩展名');
 const width=bytes.readUInt16LE(6),height=bytes.readUInt16LE(8);
 if(width<1||height<1||width>2048||height>2048||width*height>4_000_000)throw Error('GIF画布需1-2048像素，且不超过400万像素');
 let at=13,frames=0,trailer=false;
 const requireBytes=n=>{if(at+n>bytes.length)throw Error('GIF被截断或结构损坏');};
 if(bytes[10]&128){const n=3*(1<<((bytes[10]&7)+1));requireBytes(n);at+=n;}
 const subBlocks=()=>{while(true){requireBytes(1);const n=bytes[at++];if(!n)return;requireBytes(n);at+=n;}};
 while(at<bytes.length){
  const tag=bytes[at++];
  if(tag===0x3b){trailer=true;break;}
  if(tag===0x21){requireBytes(1);at++;subBlocks();continue;}
  if(tag!==0x2c)throw Error('GIF存在未知或损坏的数据块');
  requireBytes(9);
  const left=bytes.readUInt16LE(at),top=bytes.readUInt16LE(at+2);
  const w=bytes.readUInt16LE(at+4),h=bytes.readUInt16LE(at+6),packed=bytes[at+8];at+=9;
  if(!w||!h||left+w>width||top+h>height)throw Error('GIF帧超出画布，或帧尺寸无效');
  if(++frames>300||frames*width*height>100_000_000)throw Error('GIF动画过大：最多300帧，画布像素乘帧数最多1亿');
  if(packed&128){const n=3*(1<<((packed&7)+1));requireBytes(n);at+=n;}
  requireBytes(1);const lzw=bytes[at++];if(lzw<2||lzw>8)throw Error('GIF压缩参数无效');
  subBlocks();
 }
 if(!trailer||!frames)throw Error('GIF缺少图像帧或结束标记');
 return {width,height,frames,bytes:bytes.length};
}
function currentCharacter(){
 if(!fs.existsSync(CHARACTER))return {imageData:IMAGE_DATA,...DEFAULT_CONFIG,source:'builtin'};
 const fileStat=fs.statSync(CHARACTER);
 if(fileStat.size>3*1024*1024)throw Error('保存的角色配置异常，请执行character-reset');
 const c=JSON.parse(fs.readFileSync(CHARACTER,'utf8'));
 if(typeof c.imageData!=='string'||!/^data:image\/gif;base64,[A-Za-z0-9+/=]+$/.test(c.imageData))throw Error('保存的GIF数据异常，请重新选择角色');
 const metadata=inspectGif(Buffer.from(c.imageData.split(',')[1],'base64'));
 // Trust parsed dimensions, not editable persisted width/height values.
 const scale=Math.min(1,48/metadata.width,48/metadata.height);
 return {imageData:c.imageData,width:Math.max(1,Math.round(metadata.width*scale)),height:Math.max(1,Math.round(metadata.height*scale)),idleOpacity:DEFAULT_CONFIG.idleOpacity,bottom:DEFAULT_CONFIG.bottom,source:'custom',metadata,name:typeof c.name==='string'?c.name.slice(0,200):'自定义GIF'};
}
function payload(){
 const config=currentCharacter();
 const signature=createHash('sha256').update(JSON.stringify(config)).digest('hex');
 return `window.__BILI_MAC_SONIC_CONFIG__=${JSON.stringify({...config,signature})};\n`+RENDERER_SOURCE;
}
async function refreshCharacter(){
 const state=readState();if(!state||!alive(state.pid))return false;
 verify(state);startWatcher(state);
 for(const t of await targets(state))await evaluate(state,t,payload());
 return true;
}
function chooseGif(){
 const script='try\nset f to choose file with prompt "选择B站进度条角色GIF（本机保存，不上传）" of type {"com.compuserve.gif"}\nreturn POSIX path of f\non error number -128\nreturn ""\nend try';
 return execFileSync('/usr/bin/osascript',['-e',script],{encoding:'utf8',maxBuffer:4096}).trim();
}
async function importCharacter(argument){
 const selected=argument||chooseGif();
 if(!selected){console.log('已取消选择，角色保持不变。');return;}
 const file=path.resolve(selected),info=fs.statSync(file);
 if(!info.isFile())throw Error('请选择一个GIF文件，不是文件夹');
 if(info.size>2*1024*1024)throw Error('GIF超过2MiB，请缩小或减少动画帧');
 const bytes=fs.readFileSync(file),metadata=inspectGif(bytes);
 const config={imageData:'data:image/gif;base64,'+bytes.toString('base64'),name:path.basename(file),metadata};
 const temporary=path.join(RUNTIME,'character-'+randomUUID()+'.tmp');
 try{fs.writeFileSync(temporary,JSON.stringify(config),{flag:'wx',mode:0o600});fs.renameSync(temporary,CHARACTER);}finally{fs.rmSync(temporary,{force:true});}
 console.log(`GIF已在本机保存：${metadata.width}×${metadata.height}，${metadata.frames}帧。原文件之后可移动。`);
 try{console.log(await refreshCharacter()?'已通知运行中的Sonic会话；打开播放器后生效。':'下次使用start启动时自动使用这个角色。');}
 catch(error){console.log('素材已保存，但当前会话刷新未完成：'+error.message+'。可完整恢复后再start。');}
}
async function status(state){const rows=[];for(const t of await targets(state))rows.push(await evaluate(state,t,'window.__BILI_MAC_SONIC__?.status() || {state:"not-injected"}'));return rows;}
async function watch(state){
 let busy=false,misses=0;
 const tick=async()=>{if(busy)return;busy=true;try{for(const t of await targets(state))await evaluate(state,t,payload());misses=0;}catch(error){if(!alive(state.pid))process.exit(0);if(++misses===3)console.error('接入失败：'+error.message);}finally{busy=false;}};
 await tick();const timer=setInterval(tick,1200);
 for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{clearInterval(timer);process.exit(0);});
}
function startWatcher(state){
 if(state.helperPid&&alive(state.helperPid)){
  if(state.helperVersion===CLIENT_VERSION)return state;
  const cmd=execFileSync('/bin/ps',['-p',String(state.helperPid),'-o','command='],{encoding:'utf8',env:{...process.env,LC_ALL:'en_US.UTF-8'}});
  if(!cmd.includes(fileURLToPath(import.meta.url))||!cmd.includes('watch'))throw Error('旧后台身份不匹配，请先用原版本恢复');
  process.kill(state.helperPid,'SIGTERM');
 }
 state.helperVersion=CLIENT_VERSION;
 const log=fs.openSync(path.join(RUNTIME,'helper.log'),'a',0o600);
 const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'watch'],{detached:true,stdio:['ignore',log,log]});child.unref();fs.closeSync(log);state.helperPid=child.pid;
 fs.writeFileSync(STATE,JSON.stringify(state),{mode:0o600});return state;
}
async function restore(state){
 verify(state);
 if(state.helperPid&&alive(state.helperPid)){
  const cmd=execFileSync('/bin/ps',['-p',String(state.helperPid),'-o','command='],{encoding:'utf8',env:{...process.env,LC_ALL:'en_US.UTF-8'}});
  if(!cmd.includes(fileURLToPath(import.meta.url))||!cmd.includes('watch'))throw Error('后台PID不匹配，拒绝结束');
  process.kill(state.helperPid,'SIGTERM');await sleep(300);
 }
 for(const t of await targets(state))await evaluate(state,t,'window.__BILI_MAC_SONIC__?.destroy();true');
 // CDP itself closes only after the debug-enabled application fully quits.
 execFileSync('/usr/bin/osascript',['-e','tell application id "com.bilibili.bilibiliPC" to quit']);
 for(let i=0;i<40&&alive(state.pid);i++)await sleep(200);
 if(alive(state.pid))throw Error('B站尚未完全退出，请正常退出它，再从官方图标打开；没有强制结束');
 fs.rmSync(STATE,{force:true});
 execFileSync('/usr/bin/open',['-a',APP]);
 console.log('已移除角色并完整退出调试实例；已从官方入口重新打开B站。');
}
const command=process.argv[2]||'start';
try{
 if(command==='character'){
  await importCharacter(process.argv[3]);
 }else if(command==='character-reset'){
  fs.rmSync(CHARACTER,{force:true});
  console.log('已恢复内置角色。');
  try{console.log(await refreshCharacter()?'运行中的会话已刷新。':'下次start时使用内置角色。');}catch(error){console.log('当前会话刷新未完成：'+error.message);}
 }else if(command==='character-info'){
  const c=currentCharacter();console.log(JSON.stringify({source:c.source,name:c.name||'内置角色',displayWidth:c.width,displayHeight:c.height,metadata:c.metadata},null,2));
 }else if(command==='self-check'){
  new Function(payload());
  inspectGif(Buffer.from(IMAGE_DATA.split(',')[1],'base64'));
  currentCharacter();
  console.log('自检通过：GIF结构、当前角色、渲染代码、Node运行环境；未启动B站。');
 }else if(command==='help'||command==='--help'){
  console.log('Mac版，Node.js 22+。命令：node SonicBilibili.mjs start | status | restore | character [GIF路径] | character-reset | character-info | self-check');
 }else if(command==='watch'){const s=readState();if(!s)throw Error('没有启动会话');await watch(s);}
 else if(command==='status'){const s=readState();if(!s)throw Error('没有启动会话');const rows=await status(s);console.log(rows.length?JSON.stringify(rows,null,2):'已连接客户端，等待打开一个视频。');}
 else if(command==='restore'){const s=readState();if(!s)throw Error('没有启动会话；请正常退出B站，再从官方入口打开');await restore(s);}
 else if(command==='attach'){
  // For this task's verified test instance only; no changes to installed app files.
  const s={port:Number(process.argv[3]),pid:Number(process.argv[4]),createdAt:new Date().toISOString()};verify(s);
  if(readState()?.helperPid&&alive(readState().helperPid))throw Error('已有后台，请先恢复');
  fs.writeFileSync(STATE,JSON.stringify(s),{mode:0o600});startWatcher(s);await sleep(1600);console.log(JSON.stringify(await status(s),null,2));
 }else if(command==='start'){
  const old=readState();if(old&&alive(old.pid)){verify(old);startWatcher(old);execFileSync('/usr/bin/open',['-a',APP]);console.log('角色模式已经运行。打开任意视频即可。');}
  else{
   try{const pids=execFileSync('/usr/bin/pgrep',['-f','^/Applications/哔哩哔哩[.]app/Contents/MacOS/哔哩哔哩( |$)'],{encoding:'utf8',env:{...process.env,LC_ALL:'en_US.UTF-8'}}).trim();if(pids)throw Error('BILI_RUNNING');}catch(e){if(e.message==='BILI_RUNNING')throw Error('请先正常退出B站客户端（Command+Q），再双击启动。不会自动强制关闭你的播放。');if(e.status!==1)throw e;}
   const server=net.createServer();await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});const port=server.address().port;await new Promise(r=>server.close(r));
   const child=spawn(EXE,[`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1'],{detached:true,stdio:'ignore'});child.unref();
   const s={pid:child.pid,port,createdAt:new Date().toISOString()};let ready=false;
   for(let i=0;i<60;i++){await sleep(250);try{await targets(s);ready=true;break;}catch{if(!alive(child.pid))break;}}
   if(!ready)throw Error('未确认本机调试入口；请正常退出本次B站后使用官方图标。不要修改安装包或关闭系统保护。');
   fs.writeFileSync(STATE,JSON.stringify(s),{mode:0o600});startWatcher(s);console.log('角色模式已启动。请在客户端打开一个视频；原生进度条和底部条都会显示角色。');
  }
 }else throw Error('未知命令');
}catch(error){console.error('操作未完成：'+error.message);process.exitCode=1;}
