'use strict';
const publicOriginalAction=doAction;
doAction=async function(action){if(['template','report','download'].includes(action)){if(action!=='template'&&!S.result)throw Error('请先完成一次分析。');await localExports(action,S.result?.id);return;}return publicOriginalAction(action);};
const publicOriginalRender=render;
render=async function(){await publicOriginalRender();const m=document.getElementById('main');if(m&&S.catalog)m.insertAdjacentHTML('afterbegin','<div class="workspace-privacy"><strong>独立工作区</strong><span>文件、模型和分析结果仅在当前浏览器中保存与计算。换设备使用时，请重新导入数据；分析包可下载留存。</span></div>');if(window.SiteData?.isTemporary()&&m)m.insertAdjacentHTML('afterbegin','<div class="dataset-provenance" role="note">当前浏览器仅临时保存本次数据，请在关闭页面前下载分析包。</div>');};
window.localReady.then(()=>{if(S.catalog)render();});
