export const ACTIONS={
  launch:'选择主题并启动 Discord',import:'导入主题 ZIP',photo:'用我的照片创建主题',
  browse:'浏览 / 下载在线主题',updates:'检查在线主题更新',export:'导出当前主题 ZIP',
  restore:'恢复普通 Discord',folder:'打开已保存主题文件夹',status:'查看状态',
};
export function createController(ui,backend) {
  let launched=false;
  async function launch(id) {
    const state=await backend.state();
    if(state.kind==='other')throw Error('Discord正在其他调试会话中运行，请先用原工具恢复或退出Discord。');
    const restartOrdinary=state.kind==='ordinary';
    if(restartOrdinary && !await ui.confirm('Discord已在普通模式运行。\n应用主题需要退出并重开，会中断语音、直播和未保存的操作。','重开并应用'))return;
    await backend.launch(id,{restartOrdinary});
    launched=true;
    // Successful launch returns control to Discord; no redundant success dialog.
  }
  async function offerLaunch(theme) {
    if(await ui.confirm(`已保存「${theme.name}」。\n现在选择它并启动Discord？`,'现在启动'))await launch(theme.id);
  }
  async function browse() {
    let query=await ui.ask('搜索主题名称或作者；留空浏览最近主题。','Miku');if(query===null)return;
    let offset=0;
    while(true) {
      const page=await backend.catalog(query,offset);
      const labels=page.items.map(t=>`${t.name} · ${t.version} · ${t.displayMeta?.appearance || 'auto'} · ${t.id}`);
      const options=[...labels,'重新搜索'];if(offset>0)options.push('上一页');if(offset+page.limit<page.total)options.push('下一页');
      const selected=await ui.choose(`在线主题：${query || '全部'}（${page.total}套）\n选择一项即可下载到本机主题库。`,options);
      if(selected===null)return;
      if(selected==='重新搜索'){query=await ui.ask('搜索主题名称或作者。',query);if(query===null)return;offset=0;continue;}
      if(selected==='上一页'){offset=Math.max(0,offset-page.limit);continue;}
      if(selected==='下一页'){offset+=page.limit;continue;}
      const item=page.items[labels.indexOf(selected)];if(!item)throw Error('主题选择无效。');
      const downloaded=await backend.download(item.id);await offerLaunch(downloaded);return;
    }
  }
  async function dispatch(action) {
    if(action==='launch') {
      const current=await backend.current(),themes=await backend.list();
      const options=themes.map(t=>`${t.name} · ${t.appearance} · ${t.id}`);
      const currentLabel=current?`继续上次主题：${current.name}`:null;if(currentLabel)options.unshift(currentLabel);
      if(!options.length){await ui.message('主题库还是空的。请先导入ZIP、照片，或浏览在线主题。');return;}
      const selected=await ui.choose('选择这次要使用的主题',options);if(selected===null)return;
      if(selected===currentLabel)return launch(null);
      const t=themes[options.indexOf(selected)-(currentLabel?1:0)];if(!t)throw Error('主题选择无效。');return launch(t.id);
    }
    if(action==='import') {const f=await ui.file('选择DreamSkin主题ZIP','zip');if(f)await offerLaunch(await backend.importPack(f));return;}
    if(action==='photo') {
      const f=await ui.file('选择自己的背景照片','image');if(!f)return;
      const name=await ui.ask('为这套照片主题起个名字。','我的照片主题');if(name===null)return;
      return offerLaunch(await backend.createPhoto(f,name));
    }
    if(action==='browse')return browse();
    if(action==='updates') {
      const result=await backend.updates();const candidates=result.items.filter(t=>t.update && t.latest);
      const failures=result.items.filter(t=>t.error).map(t=>t.name);
      if(!candidates.length){await ui.message(`没有发现可用更新。\n本地导入、无在线来源的主题：${result.localOnly}套。${failures.length?'\n检查失败：'+failures.join('、'):'\n检查已完成。'}\nZIP主题需要导入作者提供的新版本。`);return;}
      const labels=candidates.map(t=>`${t.name} · ${t.current || '旧版本'} → ${t.latest.version} · ${t.latest.id}`);
      const all='更新以上全部主题';const selected=await ui.choose('发现主题更新。保存后不会自动替换当前画面。',[all,...labels]);if(selected===null)return;
      const chosen=selected===all?candidates:[candidates[labels.indexOf(selected)]];
      if(chosen.some(t=>!t))throw Error('更新选择无效。');
      const done=[],failed=[];
      for(const t of chosen){try{await backend.download(t.latest.id);done.push(t.name);}catch(e){failed.push(t.name+'：'+e.message);}}
      await ui.message(`已保存更新：${done.length}套。\n当前画面保持原样；在“选择主题并启动”中应用。${failed.length?'\n失败：'+failed.join('\n'):''}`);return;
    }
    if(action==='export') {const file=await ui.save('导出当前主题ZIP','My-Discord-Theme.zip');if(file){await backend.exportCurrent(file);await ui.message('主题ZIP已保存到你选择的位置。');}return;}
    if(action==='restore') {if(await ui.confirm('恢复将退出主题实例并重开普通Discord，会中断当前语音等操作。','恢复普通Discord')){await backend.restore();await ui.message('已完成恢复操作。照片与主题库保留。');}return;}
    if(action==='folder')return backend.openFolder();
    if(action==='status'){const info=await backend.info();await ui.message(`Discord：${({closed:'未运行',managed:'本启动器主题模式',ordinary:'普通模式',other:'其他会话'})[info.running.kind]}\n当前选择：${info.current}\n已保存：${info.saved}套主题`);return;}
    throw Error('未知操作。');
  }
  async function run() {
    while(true) {
      const selected=await ui.choose('Discord Themes\n选择主题、导入素材，或检查在线主题更新。',Object.values(ACTIONS));
      if(selected===null)return;
      const action=Object.keys(ACTIONS).find(k=>ACTIONS[k]===selected);
      try {await dispatch(action);if(launched)return;}
      catch(e){await ui.message('操作未完成：\n'+e.message);}
    }
  }
  return {dispatch,run};
}
