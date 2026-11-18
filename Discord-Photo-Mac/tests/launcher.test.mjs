import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createController,ACTIONS} from '../LauncherCore.mjs';
import {createNativeUI,appleString} from '../Launcher.mjs';
import {createBackend} from '../LauncherBackend.mjs';
const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function harness(overrides={}) {
 const calls=[];
 const ui={choose:async()=>null,confirm:async()=>false,ask:async()=>null,file:async()=>null,save:async()=>null,message:async text=>calls.push(['message',text]),...overrides.ui};
 const backend={state:()=>({kind:'closed'}),current:()=>null,list:()=>[{id:'one',name:'Miku',appearance:'dark'},{id:'two',name:'Miku',appearance:'light'}],launch:async(...args)=>calls.push(['launch',...args]),download:async id=>{calls.push(['download',id]);return {id:'saved',name:'Miku'};},importPack:async file=>{calls.push(['import',file]);return {id:'saved',name:'Miku'};},...overrides.backend};
 return {calls,controller:createController(ui,backend)};
}
test('theme picker passes stable ID even when names match',async()=>{
 const h=harness({ui:{choose:async(_,items)=>items[1]}});await h.controller.dispatch('launch');assert.deepEqual(h.calls,[['launch','two',{restartOrdinary:false}]]);
});
test('ordinary Discord restart cancellation does not launch or change theme',async()=>{
 const h=harness({ui:{choose:async(_,items)=>items[0]},backend:{state:()=>({kind:'ordinary'})}});await h.controller.dispatch('launch');assert.equal(h.calls.length,0);
});
test('ordinary Discord restart is passed only after explicit native confirmation',async()=>{
 const h=harness({ui:{choose:async(_,items)=>items[0],confirm:async()=>true},backend:{state:()=>({kind:'ordinary'})}});await h.controller.dispatch('launch');assert.equal(h.calls[0][2].restartOrdinary,true);
});
test('cancel picker leaves app/config untouched',async()=>{const h=harness();await h.controller.dispatch('launch');assert.deepEqual(h.calls,[]);});
test('other debugging sessions are never restarted',async()=>{
 const h=harness({ui:{choose:async(_,items)=>items[0],confirm:async()=>true},backend:{state:()=>({kind:'other'})}});await assert.rejects(h.controller.dispatch('launch'),/其他调试/);assert.equal(h.calls.length,0);
});
test('import saves pack without applying when launch offer is cancelled',async()=>{
 const h=harness({ui:{file:async()=>'/tmp/with spaces/theme.zip'}});await h.controller.dispatch('import');assert.deepEqual(h.calls,[['import','/tmp/with spaces/theme.zip']]);
});
test('photo naming cancellation creates nothing',async()=>{
 const h=harness({ui:{file:async()=>'/tmp/photo.png'},backend:{createPhoto:()=>{throw Error('should not run');}}});await h.controller.dispatch('photo');assert.deepEqual(h.calls,[]);
});
test('online catalog pagination and selected download ID',async()=>{
 let choices=0;const pages=[];
 const h=harness({ui:{ask:async()=> 'Miku',choose:async(_,options)=>choices++===0?'下一页':options[0]},backend:{catalog:async(q,offset)=>{pages.push([q,offset]);return {items:[{name:'Theme',id:offset?'ver_abcdef12':'ver_12345678',version:'1.0'}],total:13,limit:12};}}});
 await h.controller.dispatch('browse');assert.deepEqual(pages,[['Miku',0],['Miku',12]]);assert.deepEqual(h.calls,[['download','ver_abcdef12']]);
});
test('updates save new versions without launching or applying',async()=>{
 const h=harness({ui:{choose:async(_,items)=>items[0]},backend:{updates:async()=>({localOnly:0,items:[{id:'one',name:'Miku',current:'1.0',latest:{id:'ver_abcdef12',version:'1.1'},update:true}]})}});
 await h.controller.dispatch('updates');assert.equal(h.calls[0][0],'download');assert.equal(h.calls.some(c=>c[0]==='launch'),false);
});
test('failed update is reported without claiming all updates succeeded',async()=>{
 const h=harness({ui:{choose:async(_,items)=>items[0]},backend:{updates:async()=>({localOnly:0,items:[{name:'Miku',current:'1',latest:{id:'ver_abcdef12',version:'2'},update:true}]}),download:async()=>{throw Error('offline');}}});
 await h.controller.dispatch('updates');assert.match(h.calls[0][1],/已保存更新：0/);assert.match(h.calls[0][1],/offline/);
});
test('launcher closes after confirmed launch rather than reopening menu over Discord',async()=>{
 let menus=0;const h=harness({ui:{choose:async(_,items)=>{menus++;return menus===1?ACTIONS.launch:items[0];}}});await h.controller.run();assert.equal(menus,2);assert.equal(h.calls[0][0],'launch');
});
test('catalog requests fixed public API and rejects malformed response',async()=>{
 const requested=[];const valid={id:'ver_12345678',name:'Miku',themeId:'miku',version:'1.0.0',reviewedAt:'2026-10-01',packageBytes:100,packageSha256:'a'.repeat(64)};
 const backend=createBackend({fetchBytes:async url=>{requested.push(new URL(url));return Buffer.from(JSON.stringify({items:[valid,{...valid,id:'https://evil.example'}],total:2}));}});
 const page=await backend.catalog('Miku & Snow');assert.equal(page.items.length,1);assert.equal(requested[0].origin,'https://api.dreamskin.cc');assert.equal(requested[0].searchParams.get('q'),'Miku & Snow');
 await assert.rejects(createBackend({fetchBytes:async()=>Buffer.from('{"items":{},"total":1}')}).catalog(),/无法识别/);
});
test('personal photo import is saved in the library without replacing current config',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'launcher-photo-test-'));
 try {
  const source=`import fs from 'node:fs';import {createBackend} from ${JSON.stringify(path.join(ROOT,'LauncherBackend.mjs'))};import {CONFIG} from ${JSON.stringify(path.join(ROOT,'DiscordPhoto.mjs'))};const b=createBackend();const t=await b.createPhoto(process.argv[1],'My upload');if(fs.existsSync(CONFIG))throw Error('active theme changed');console.log(JSON.stringify({id:t.id,themes:b.list().length}));`;
  const result=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',source,path.join(ROOT,'theme-template','background.png')],{env:{...process.env,DISCORD_PHOTO_HOME:temp},encoding:'utf8'}));
  assert.match(result.id,/^photo-/);assert.equal(result.themes,1);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('update checker compares source identity without modifying current theme',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'launcher-updates-test-'));
 try {
  const source=`import fs from 'node:fs';import path from 'node:path';import {createBackend} from ${JSON.stringify(path.join(ROOT,'LauncherBackend.mjs'))};import {importTheme,LIBRARY,CONFIG} from ${JSON.stringify(path.join(ROOT,'DiscordPhoto.mjs'))};await importTheme(process.argv[1],{themeId:'my-discord-theme',versionId:'ver_12345678',version:'1.0.0'});const b=createBackend({fetchBytes:async()=>Buffer.from(JSON.stringify({items:[{id:'ver_abcdef12',themeId:'my-discord-theme',name:'New theme',version:'1.1.0',reviewedAt:'2026-10-28',packageBytes:100,packageSha256:'a'.repeat(64)}],total:1}))});const r=await b.updates();if(!r.items[0].update || fs.existsSync(CONFIG))throw Error('update detection failed');console.log('PASS update detected without activation');`;
  const output=execFileSync(process.execPath,['--input-type=module','-e',source,path.join(ROOT,'theme-template')],{env:{...process.env,DISCORD_PHOTO_HOME:temp},encoding:'utf8'});assert.match(output,/PASS update detected/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('all native dialogs compile with quotes, spaces and multiline input',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'launcher-native-test-'));const scripts=[];
 try {
  const ui=createNativeUI(async script=>{scripts.push(script);return '';});
  await ui.choose('Miku "quoted"\nline',['a " b','other \\ text']);await ui.ask('Name','"; do shell script "false');await ui.confirm('Restart?','重开');await ui.message('A\nB');await ui.file('ZIP','zip');await ui.file('Photo','image');await ui.save('Save','My theme.zip');
  for(const [i,script]of scripts.entries()){const source=path.join(temp,i+'.applescript');fs.writeFileSync(source,script);execFileSync('/usr/bin/osacompile',['-o',path.join(temp,i+'.scpt'),source],{stdio:'pipe'});}
  assert.equal(scripts.length,7);assert.equal(appleString('a"b'),'"a\\"b"');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('installer builds a signed app, preserves library on upgrade, and refuses foreign apps',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'launcher-install-test-'));
 try {
  const app=path.join(temp,'Discord Themes.app'),data=path.join(temp,'data');
  const install=(destination=app)=>execFileSync(process.execPath,[path.join(ROOT,'InstallLauncher.mjs'),'--destination',destination,'--data',data,'--no-migrate'],{encoding:'utf8',stdio:'pipe'});
  install();const config=path.join(data,'photo.json');const changed=JSON.parse(fs.readFileSync(config));changed.darkness=.67;fs.writeFileSync(config,JSON.stringify(changed));
  const before=fs.readFileSync(config,'utf8'),theme=fs.readFileSync(path.join(data,'themes','my-discord-theme.json'),'utf8');install();
  assert.equal(fs.readFileSync(config,'utf8'),before);assert.equal(fs.readFileSync(path.join(data,'themes','my-discord-theme.json'),'utf8'),theme);
  execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',app],{stdio:'pipe'});
  const foreign=path.join(temp,'Foreign.app');fs.cpSync(app,foreign,{recursive:true});
  execFileSync('/usr/bin/plutil',['-replace','CFBundleIdentifier','-string','com.example.foreign',path.join(foreign,'Contents','Info.plist')]);
  assert.throws(()=>install(foreign));assert.equal(execFileSync('/usr/bin/plutil',['-extract','CFBundleIdentifier','raw',path.join(foreign,'Contents','Info.plist')],{encoding:'utf8'}).trim(),'com.example.foreign');
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
