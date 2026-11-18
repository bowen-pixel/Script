import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createController} from './LauncherCore.mjs';
import {createBackend} from './LauncherBackend.mjs';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const execute=promisify(execFile);
export const appleString=s=>'"'+String(s).replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\r','\\r').replaceAll('\n','\\n')+'"';
async function apple(script) {
  try{return (await execute('/usr/bin/osascript',['-e',script],{maxBuffer:32*1024})).stdout.replace(/\r?\n$/,'');}
  catch(e){if(/\(-128\)/.test(e.stderr || ''))return null;throw Error((e.stderr || e.message).trim());}
}
export function createNativeUI(run=apple) {return {
  async choose(prompt,items){const selected=await run(`set picked to choose from list {${items.map(appleString).join(',')}} with title "Discord Themes" with prompt ${appleString(prompt)} OK button name "选择" cancel button name "关闭"\nif picked is false then return ""\nreturn item 1 of picked`);return selected || null;},
  async ask(prompt,value=''){return run(`text returned of (display dialog ${appleString(prompt)} with title "Discord Themes" default answer ${appleString(value)} buttons {"取消", "继续"} default button "继续" cancel button "取消")`);},
  async confirm(prompt,button){const r=await run(`button returned of (display dialog ${appleString(prompt)} with title "Discord Themes" buttons {"取消",${appleString(button)}} default button ${appleString(button)} cancel button "取消")`);return r===button;},
  async message(text){await run(`display dialog ${appleString(text)} with title "Discord Themes" buttons {"好"} default button "好"`);},
  async file(prompt,kind){return run(`POSIX path of (choose file with prompt ${appleString(prompt)} of type {${appleString(kind==='zip'?'public.zip-archive':'public.image')}})`);},
  async save(prompt,name){return run(`POSIX path of (choose file name with prompt ${appleString(prompt)} default name ${appleString(name)})`);},
};}
if(process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1])===fileURLToPath(import.meta.url)) {
  const backend=createBackend();
  if(process.argv.includes('--diagnose')) {
    console.log(JSON.stringify({node:process.version,python:(await execute('python3',['--version'])).stdout.trim(),themes:backend.list(),current:backend.current()},null,2));
  } else {
    const ui=createNativeUI();
    try {await createController(ui,backend).run();}
    catch(e){await ui.message('启动器无法完成操作：\n'+e.message);process.exitCode=1;}
  }
}
