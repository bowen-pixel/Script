import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as engine from './DiscordPhoto.mjs';

const DIR=path.dirname(fileURLToPath(import.meta.url));
const SCRIPT=path.join(DIR,'DiscordPhoto.mjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const run=(file,args)=>execFileSync(file,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,LC_ALL:'en_US.UTF-8'}}).trim();
const cleanText=(s,max=160)=>typeof s==='string' && s.length>0 && s.length<=max && !/[\u0000-\u001f\u007f-\u009f]/.test(s);

export function runningStatus() {
  let rows;
  try {rows=run('/usr/bin/pgrep',['-f','^/Applications/Discord[.]app/Contents/MacOS/Discord( |$)']).split('\n');}
  catch(e){if(e.status===1)return {kind:'closed'};throw e;}
  if(rows.length!==1)throw Error('发现多个Discord主进程，请先正常退出再启动。');
  const pid=Number(rows[0]);
  const command=run('/bin/ps',['-p',String(pid),'-o','command=']);
  const startedAt=run('/bin/ps',['-p',String(pid),'-o','lstart=']);
  const session=engine.readState();
  if(session?.pid===pid && command.startsWith(engine.EXE+' ') && command.includes(`--remote-debugging-port=${session.port}`) && (!session.startedAt || startedAt===session.startedAt)) return {kind:'managed',pid,startedAt};
  if(command!==engine.EXE) return {kind:'other',pid,startedAt};
  return {kind:'ordinary',pid,startedAt};
}

export function createBackend({fetchBytes=engine.limitedFetch}={}) {
  async function catalog(query='',offset=0) {
    if(typeof query!=='string' || query.length>120 || !Number.isInteger(offset) || offset<0 || offset>10000)throw Error('搜索条件无效。');
    const params=new URLSearchParams({limit:'12',offset:String(offset)});if(query.trim())params.set('q',query.trim());
    const data=JSON.parse((await fetchBytes('https://api.dreamskin.cc/v1/themes?'+params,512*1024)).toString('utf8'));
    if(!Array.isArray(data.items) || !Number.isInteger(data.total) || data.total<0 || data.items.length>24)throw Error('主题库返回了无法识别的数据。');
    const items=data.items.filter(t=>/^ver_[a-z0-9]{8,64}$/.test(t.id) && cleanText(t.name) && cleanText(t.themeId) && cleanText(t.version,40) && t.reviewedAt && Number.isInteger(t.packageBytes) && t.packageBytes>0 && t.packageBytes<=32*1024*1024 && /^[a-f0-9]{64}$/.test(t.packageSha256));
    return {items,total:data.total,offset,limit:12};
  }
  function list() {
    return engine.savedThemes().map(t=>{
      const c=JSON.parse(fs.readFileSync(path.join(engine.LIBRARY,t.id+'.json'),'utf8'));
      return {...t,gallery:c.gallery || null};
    });
  }
  async function updates() {
    const themes=list();
    const results=await Promise.all(themes.filter(t=>t.gallery?.themeId && /^ver_[a-z0-9]{8,64}$/.test(t.gallery.versionId)).map(async t=>{
      try {
        const page=await catalog(t.gallery.themeId);
        const same=page.items.filter(n=>n.themeId===t.gallery.themeId).sort((a,b)=>String(b.reviewedAt).localeCompare(String(a.reviewedAt)));
        const latest=same[0];
        return {id:t.id,name:t.name,current:t.gallery.version,latest,update:!!latest && latest.id!==t.gallery.versionId};
      } catch(e){return {id:t.id,name:t.name,error:e.message};}
    }));
    return {items:results,localOnly:themes.length-results.length};
  }
  async function launch(id,{restartOrdinary=false}={}) {
    const state=runningStatus();
    if(state.kind==='other')throw Error('Discord正在其他调试会话中运行。请用原工具恢复，或完整退出Discord后再启动。');
    if(state.kind==='ordinary') {
      if(!restartOrdinary)throw Error('需要先正常退出Discord；尚未更改主题。');
      if(run('/bin/ps',['-p',String(state.pid),'-o','command='])!==engine.EXE || run('/bin/ps',['-p',String(state.pid),'-o','lstart='])!==state.startedAt)throw Error('Discord进程已变化，请重试。');
      process.kill(state.pid,'SIGTERM');
      for(let i=0;i<50 && engine.alive(state.pid);i++)await sleep(200);
      if(engine.alive(state.pid))throw Error('Discord未退出，没有强制结束。请先Command+Q退出。');
    }
    const previous=fs.existsSync(engine.CONFIG)?fs.readFileSync(engine.CONFIG,'utf8'):null;
    try {
      if(id)await engine.useTheme(id);else engine.config();
      await engine.start();
      const rows=await engine.confirmedApply(engine.readState(),{attempts:80});
      run('/usr/bin/open',['-a','/Applications/Discord.app']);
      return rows;
    } catch(error) {
      if(previous)engine.save(engine.CONFIG,JSON.parse(previous));else fs.rmSync(engine.CONFIG,{force:true});
      const s=engine.readState();
      if(s && engine.alive(s.pid)) {
        if(state.kind==='managed' && previous) {
          try {await engine.confirmedApply(s);}catch {throw Error(error.message+'；旧配置已恢复，但画面恢复未确认，请使用“恢复普通Discord”。');}
        } else {
          try {await engine.restore(true);}catch {throw Error(error.message+'；调试会话清理未确认，请完整退出Discord。');}
        }
      }
      throw error;
    }
  }
  async function createPhoto(file,name) {
    if(!cleanText(name,100))throw Error('请输入1至100个字符的主题名称。');
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'discord-launcher-photo-'));
    try {
      execFileSync(process.execPath,[SCRIPT,'import',file],{env:{...process.env,DISCORD_PHOTO_HOME:temp},stdio:['ignore','pipe','pipe']});
      const c=JSON.parse(fs.readFileSync(path.join(temp,'photo.json'),'utf8'));
      const id='photo-'+randomUUID();
      const saved=engine.validate({...c,name,theme:{schemaVersion:1,id,name,image:'background.png',appearance:'dark'},safeCSS:'[data-ds-part="composer"] { border-radius: 16px; }',fingerprint:createHash('sha256').update(c.imageData).digest('hex'),sourcePlatforms:[],license:'Personal photo'});
      fs.mkdirSync(engine.LIBRARY,{recursive:true,mode:0o700});engine.save(path.join(engine.LIBRARY,id+'.json'),saved);
      return {id,name};
    }finally{fs.rmSync(temp,{recursive:true,force:true});}
  }
  return {
    list,catalog,updates,launch,createPhoto,state:runningStatus,
    current:()=>{try{const c=engine.config();return {name:c.theme?.name || c.name,id:c.theme?.id || null};}catch{return null;}},
    importPack:file=>engine.importTheme(file),download:id=>engine.fetchTheme(id),
    restore:()=>{if(runningStatus().kind==='other')throw Error('这是其他工具的Discord会话，请用原工具恢复。');return engine.restore(true);},
    exportCurrent:file=>run(process.execPath,[SCRIPT,'theme-export',file]),
    openFolder:()=>{fs.mkdirSync(engine.LIBRARY,{recursive:true,mode:0o700});run('/usr/bin/open',[engine.LIBRARY]);},
    info:()=>({running:runningStatus(),current:(()=>{try{return engine.config().theme?.name || engine.config().name;}catch{return '尚未选择';}})(),saved:list().length}),
  };
}
