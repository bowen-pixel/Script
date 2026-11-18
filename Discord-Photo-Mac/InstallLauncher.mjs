import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {validate} from './DiscordPhoto.mjs';

const DIR=path.dirname(fileURLToPath(import.meta.url));
const run=(file,args,options={})=>execFileSync(file,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],...options}).trim();
const apple=s=>'"'+s.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\n','\\n')+'"';
export function launcherSource(node,python,data) {
  const envPath=[path.dirname(node),path.dirname(python),'/opt/homebrew/bin','/usr/local/bin','/usr/bin','/bin','/usr/sbin','/sbin'].join(':');
  return `on run
    set dataPath to ${apple(data)}
    set nodePath to ${apple(node)}
    try
        set resourcePath to POSIX path of (path to resource "Discord-Photo-Mac")
        set commandText to "/usr/bin/env " & quoted form of ${apple('PATH='+envPath)} & " " & quoted form of ("DISCORD_PHOTO_HOME=" & dataPath) & " " & quoted form of nodePath & " " & quoted form of (resourcePath & "/Launcher.mjs") & " >> " & quoted form of (dataPath & "/launcher.log") & " 2>&1"
        do shell script commandText
    on error errorMessage number errorNumber
        set details to errorMessage
        try
            set details to details & return & (do shell script "/usr/bin/tail -n 12 " & quoted form of (dataPath & "/launcher.log"))
        end try
        display dialog "Discord Themes could not complete the operation:" & return & details buttons {"OK"} default button "OK"
    end try
end run
`;
}
function regular(file) {const st=fs.lstatSync(file);if(!st.isFile() || st.isSymbolicLink() || st.size>29*1024*1024)throw Error('Invalid migration file: '+path.basename(file));}
export function install({destination=path.join(os.homedir(),'Applications','Discord Themes.app'),data=path.join(os.homedir(),'Library','Application Support','Discord Theme Launcher'),migrate=true}={}) {
  if(process.platform!=='darwin')throw Error('macOS only');
  if(Number(process.versions.node.split('.')[0])<22)throw Error('Node.js 22+ required');
  const node=process.execPath,python=run('python3',['-c','import sys; print(sys.executable)']);
  if(!path.isAbsolute(destination) || !destination.endsWith('.app') || !path.isAbsolute(data))throw Error('Absolute app/data paths required');
  const parent=path.dirname(destination);fs.mkdirSync(parent,{recursive:true});
  if(fs.lstatSync(parent).isSymbolicLink())throw Error('Application directory is a symbolic link');
  if(fs.existsSync(data) && fs.lstatSync(data).isSymbolicLink())throw Error('Data directory is a symbolic link');
  if(fs.existsSync(destination)) {
    if(fs.lstatSync(destination).isSymbolicLink())throw Error('Application is a symbolic link');
    const identifier=run('/usr/bin/plutil',['-extract','CFBundleIdentifier','raw',path.join(destination,'Contents','Info.plist')]);
    if(identifier!=='local.discord-photo.launcher')throw Error('Destination belongs to another application; nothing replaced');
  }
  fs.mkdirSync(data,{recursive:true,mode:0o700});
  const library=path.join(data,'themes');fs.mkdirSync(library,{recursive:true,mode:0o700});
  if(fs.lstatSync(library).isSymbolicLink())throw Error('Theme library is a symbolic link');
  if(migrate) {
    const old=path.join(DIR,'.discord-photo-runtime');
    const copyJSON=(source,target)=>{regular(source);const parsed=validate(JSON.parse(fs.readFileSync(source,'utf8')));if(!fs.existsSync(target))fs.writeFileSync(target,JSON.stringify(parsed),{mode:0o600,flag:'wx'});};
    if(fs.existsSync(path.join(old,'photo.json')))copyJSON(path.join(old,'photo.json'),path.join(data,'photo.json'));
    if(fs.existsSync(path.join(old,'themes')))for(const name of fs.readdirSync(path.join(old,'themes'))) {
      if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}\.json$/.test(name))continue;
      copyJSON(path.join(old,'themes',name),path.join(library,name));
    }
  }
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'discord-launcher-build-'));
  const staged=path.join(parent,'.Discord-Themes-'+randomUUID()+'.app');
  let backup=null;
  try {
    const script=path.join(temp,'Launcher.applescript');const source=launcherSource(node,python,data);fs.writeFileSync(script,source);
    run('/usr/bin/osacompile',['-o',staged,script]);
    const resources=path.join(staged,'Contents','Resources');const code=path.join(resources,'Discord-Photo-Mac');fs.mkdirSync(code);
    for(const name of ['DiscordPhoto.mjs','theme-packs.mjs','Launcher.mjs','LauncherCore.mjs','LauncherBackend.mjs','validate-pack.py','export-pack.py','NOTICE.md'])fs.copyFileSync(path.join(DIR,name),path.join(code,name));
    for(const name of ['vendor','theme-template'])fs.cpSync(path.join(DIR,name),path.join(code,name),{recursive:true});
    fs.writeFileSync(path.join(resources,'Launcher.applescript'),source);
    const plist=path.join(staged,'Contents','Info.plist');
    for(const [key,value] of Object.entries({CFBundleIdentifier:'local.discord-photo.launcher',CFBundleName:'Discord Themes',CFBundleDisplayName:'Discord Themes',CFBundleShortVersionString:'0.3.0',CFBundleVersion:'3'}))run('/usr/bin/plutil',['-replace',key,'-string',value,plist]);
    const discordInfo='/Applications/Discord.app/Contents/Info.plist';
    if(fs.existsSync(discordInfo)) {
      const icon=run('/usr/bin/plutil',['-extract','CFBundleIconFile','raw',discordInfo]);
      if(path.basename(icon)===icon) {
        const original=path.join('/Applications/Discord.app/Contents/Resources',icon.endsWith('.icns')?icon:icon+'.icns');
        if(fs.existsSync(original)){fs.copyFileSync(original,path.join(resources,'DiscordThemes.icns'));run('/usr/bin/plutil',['-replace','CFBundleIconFile','-string','DiscordThemes.icns',plist]);}
      }
    }
    const environment={...process.env,DISCORD_PHOTO_HOME:data,PATH:[path.dirname(python),process.env.PATH].join(':')};
    if(!fs.readdirSync(library).some(n=>n.endsWith('.json'))) {
      run(node,[path.join(code,'DiscordPhoto.mjs'),'theme-import',path.join(code,'theme-template')],{env:environment});
      if(!fs.existsSync(path.join(data,'photo.json')))run(node,[path.join(code,'DiscordPhoto.mjs'),'theme-use','my-discord-theme'],{env:environment});
    }
    run(node,[path.join(code,'Launcher.mjs'),'--diagnose'],{env:environment});
    run('/usr/bin/codesign',['--force','--sign','-',staged]);
    if(fs.existsSync(destination)){backup=path.join(parent,'.Discord-Themes-previous-'+randomUUID()+'.app');fs.renameSync(destination,backup);}
    try{fs.renameSync(staged,destination);}catch(e){if(backup)fs.renameSync(backup,destination);backup=null;throw e;}
    if(backup){fs.rmSync(backup,{recursive:true,force:true});backup=null;}
    return {app:destination,data,node,python};
  } finally {fs.rmSync(temp,{recursive:true,force:true});fs.rmSync(staged,{recursive:true,force:true});}
}
if(process.argv[1] && fs.realpathSync(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2);const value=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;
    console.log(JSON.stringify(install({destination:value('--destination'),data:value('--data'),migrate:!args.includes('--no-migrate')}),null,2));
  } catch(e){console.error(e.stderr?.toString().trim() || e.message);process.exitCode=1;}
}
