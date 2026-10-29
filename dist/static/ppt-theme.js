/* PPT-aligned presentation layer. All figures still consume saved SHAP results. */
'use strict';
const originalDataWorkspace=renderData;
const renderWithoutDataNotice=render;
render=async function(){await renderWithoutDataNotice();const ds=S.ds;if(ds?.synthetic_demo&&$('#main'))$('#main').insertAdjacentHTML('afterbegin','<div class="dataset-provenance" role="note">'+icon('info')+'<div><strong>合成演示数据集</strong><span>'+esc(ds.data_notice)+'</span></div></div>');};
S.globalTab='beeswarm';S.planSelected=null;S.planCount=6;S.showPlanDetails=false;
const shortLabel=f=>f.label.replace('单位充电功率容量成本','充电功率成本').replace('单位放电功率容量成本','放电功率成本').replace('单位能量容量成本','能量容量成本').replace('单位容量成本','容量成本').replace('单位功率成本','功率成本').replace('单位','');
const boardTitle=(title,controls='')=>'<div class="board-head"><h1>'+title+'</h1><div class="controls">'+controls+'</div></div>';
const scopeLabel=()=>S.result?.config.stage_value?String(S.result.config.stage_value):S.result?.config.stage_column?'当前工作表 · 全部阶段':'当前工作表 · 未提供阶段标签';
const sampleOptions=()=>S.result.rows.map((r,i)=>({key:i,label:r.id+' · 原表'+r.source_row+'行 · '+(r.split==='test'?'测试':'训练')}));

function boundaryTable(keys){
 return '<table><thead><tr><th>参数</th><th>样本下限</th><th>样本上限</th><th>单位</th></tr></thead><tbody>'+keys.map(key=>{
  const f=S.catalog.features.find(v=>v.key===key),label=f?shortLabel(f):'短时储能效率';
  const mapped=S.mapping[key]||(key==='SDES_eta'&&S.info?.columns.includes(key)?key:''),st=S.info?.column_stats?.[mapped]||S.info?.stats[key],usable=st&&st.column===mapped;
  const efficiency=key.endsWith('_eta')||(key==='Load_growth'&&S.ds?.synthetic_demo),unit=efficiency?'%':S.ds?.synthetic_demo?'示例单位':'原始单位';
  const v=n=>fmt(efficiency?n*100:n,efficiency?2:3);
  return '<tr><td>'+esc(label.replace(/^短时储能|^长时储能/,''))+'</td>'+(usable?'<td class="range-value">'+v(st.min)+'</td><td class="range-value">'+v(st.max)+'</td>':'<td colspan="2" class="unavailable">'+(mapped?'待重新校验':'未提供')+'</td>')+'<td>'+unit+'</td></tr>';
 }).join('')+'</tbody></table>';
}
function boundaryCard(title,keys,kind,ico,name,note){return '<section class="card boundary-card '+kind+'"><div class="card-head"><h2>'+title+'</h2></div><div class="boundary-content"><div class="boundary-table">'+boundaryTable(keys)+'<p class="boundary-caption">'+(kind==='teal'?'充、放电效率分别展示；百分数由原始0—1数值换算。':kind===''?'已映射的成本参与因素解释；效率为补充技术参数。':'仅展示数据中已提供的参数，未提供项保留为空。')+'</p></div><div class="boundary-art">'+icon(ico)+'<strong>'+name+'</strong><small>'+note+'</small></div></div></section>';}

renderData=function(m){
 const info=S.info;
 if(!info){originalDataWorkspace(m);return;}
 m.innerHTML='<div class="board">'+boardTitle('协同规划输入边界','<label for="boundaryDataset">案例</label><select id="boundaryDataset" aria-label="选择案例数据集">'+options(S.datasets.map(d=>({key:d.id,label:d.name})),S.ds.id)+'</select><button data-ui="settings">'+icon('settings')+'分析设置</button>'+button('导入参数','upload',false,'upload')+button('开始可解释分析','run',true,'play'))+
 '<div class="scope-strip"><span>下限、上限来自已导入数据的实际取值范围；单值参数的上下限相同。</span><div class="inline"><span>'+fmt(info.rows,0)+'组样本</span><span>'+info.feature_count+'/14项输入</span><span>'+info.output_count+'/10项输出</span></div></div>'+
 '<div class="boundary-grid">'+boundaryCard('短时储能技术与经济参数',['SDES_e_cost','SDES_p_cost','SDES_eta'],'','battery','短时储能','功率与能量配置')+boundaryCard('长时储能技术与经济参数',['LDES_e_cost','LDES_ch_cost','LDES_dis_cost','LDES_ch_eta','LDES_dis_eta'],'teal','layers','长时储能','充放电与能量配置')+
 boundaryCard('电源投资与改造参数',['Coal_retrofit_cost','Wind_cost','PV_cost'],'amber','bolt','电源侧','投资与灵活改造')+boundaryCard('系统运行与低碳参数',['Coal_fuel_cost','Carbon_price','Load_growth','Coal_emission'],'green','leaf','系统边界','运行、负荷与排放')+'</div>'+
 '<div class="card boundary-flow">'+[['database','数据校验','核对字段与数据完整性'],['layers','边界样本','读取已有输入输出组合'],['chart','模型拟合','训练并评估预测模型'],['leaf','可解释分析','计算经济性与低碳性贡献']].map(x=>'<div><span class="step-icon">'+icon(x[0])+'</span><div><b>'+x[1]+'</b><small>'+x[2]+'</small></div></div>').join('')+'</div>'+
 '<details class="workspace-details" id="dataWorkspace"><summary>数据管理、字段映射与分析设置</summary><div class="details-body" id="legacy-data-workspace"></div></details>'+
 '<div class="boundary-actions"><span>工作表：'+esc(info.sheet)+' · 原表头第'+info.header_row+'行 · 当前输入以'+(info.feature_count<14?'实际已提供字段':'全部已映射字段')+'为准</span><a href="#plans">查看规划结果 →</a></div></div>';
 originalDataWorkspace($('#legacy-data-workspace'));
 const settings=$('#legacy-data-workspace .card:last-child');if(settings)settings.classList.add('model-settings');
};

function drawImportance(){
 const r=S.result,key=activeTarget(),t=r.targets[key],sc=targetScale(key),order=rank(key).reverse(),im=S.cohort==='test'?t.importance_test:t.importance_all;
 plot('importance-chart',[{type:'bar',orientation:'h',y:order.map(j=>shortLabel(r.features[j])),x:order.map(j=>im[j]/sc.scale),text:order.map(j=>fmt(im[j]/sc.scale,3)),textposition:'outside',cliponaxis:false,marker:{color:S.page==='carbon'?'#189c9a':'#315def'},hovertemplate:'%{y}<br>mean(|SHAP|) = %{x:.5g}<extra></extra>'}],{margin:{l:$('#importance-chart').clientWidth<400?143:200,r:48,t:20,b:60},xaxis:{title:{text:'mean(|SHAP|) / '+sc.unit,font:{size:10}},gridcolor:'#e1ebf7',zeroline:false},yaxis:{showgrid:false,tickfont:{size:10}},bargap:.38});
}
drawGlobal=function(){
 const r=S.result,key=activeTarget(),t=r.targets[key],sc=targetScale(key),ix=indices(),order=rank(key),features=r.features,labels=order.map(j=>shortLabel(features[j]));
 const width=$('#global-chart').clientWidth,left=width<420?140:width<700?190:235;
 if(S.globalTab==='beeswarm'){
  const keep=ix.filter((_,i)=>i%Math.max(1,Math.ceil(ix.length/600))===0),traces=[];
  order.forEach((j,row)=>{
   const allValues=ix.map(i=>r.rows[i].features[features[j].key]),lo=Math.min(...allValues),hi=Math.max(...allValues),binWidth=Math.max(...keep.map(i=>Math.abs(t.shap[i][j])))/32||1;
   const bins=keep.map(i=>Math.round(t.shap[i][j]/binWidth)),counts={},seen={};bins.forEach(b=>counts[b]=(counts[b]||0)+1);
   const ys=bins.map(b=>{const slot=seen[b]||0;seen[b]=slot+1;return row+(slot-(counts[b]-1)/2)*Math.min(.035,.58/counts[b]);});
   traces.push({type:'scatter',mode:'markers',x:keep.map(i=>t.shap[i][j]/sc.scale),y:ys,text:keep.map(i=>r.rows[i].id+'<br>'+esc(features[j].label)+' = '+fmt(r.rows[i].features[features[j].key],5)),marker:{size:5,opacity:.8,color:keep.map(i=>(r.rows[i].features[features[j].key]-lo)/(hi-lo||1)),cmin:0,cmax:1,colorscale:[[0,'#2899c5'],[.5,'#cfb4d4'],[1,'#ef5689']],showscale:row===0,colorbar:{title:{text:'特征值',font:{size:10}},thickness:8,len:.8,tickvals:[0,1],ticktext:['低','高'],tickfont:{size:9}}},showlegend:false,hovertemplate:'%{text}<br>SHAP %{x:.5g}<extra></extra>'});
  });
  plot('global-chart',traces,{margin:{l:left,r:55,t:18,b:65},xaxis:{title:{text:'SHAP值 / '+sc.unit,font:{size:10}},gridcolor:'#e1ebf7',zeroline:true,zerolinecolor:'#94a6c0'},yaxis:{tickvals:order.map((_,i)=>i),ticktext:labels,tickfont:{size:10},range:[order.length-.55,-.55],showgrid:false}});
  $('#global-note').textContent='每点对应一个数据样本，颜色表示该因素取值的相对高低；最多显示600条，排序统计仍覆盖所选样本全集。';
 }
 if(S.globalTab==='dependence'){
  const j=Number(S.dep),c=Number(S.color),f=features[j],col=features[c];
  plot('global-chart',[{type:'scatter',mode:'markers',x:ix.map(i=>r.rows[i].features[f.key]),y:ix.map(i=>t.shap[i][j]/sc.scale),text:ix.map(i=>r.rows[i].id),marker:{size:5,opacity:.75,color:ix.map(i=>r.rows[i].features[col.key]),colorscale:[[0,'#2899c5'],[1,'#ef5689']],showscale:true,colorbar:{title:{text:shortLabel(col).replace('储能','储能<br>'),font:{size:9}},thickness:8,len:.7,tickfont:{size:9}}},hovertemplate:'%{text}<br>输入 %{x:.5g}<br>SHAP %{y:.5g}<extra></extra>'}],{margin:{l:65,r:100,t:25,b:65},xaxis:{title:{text:shortLabel(f)+' / 原始单位',font:{size:10}},gridcolor:'#e1ebf7'},yaxis:{title:{text:'SHAP / '+sc.unit,font:{size:10}},gridcolor:'#e1ebf7',zeroline:true}});
  $('#global-note').textContent='横轴为输入值，纵轴为SHAP贡献。着色用于观察模型中的因素关联，不代表参数干预的因果效应。';
 }
 if(S.globalTab==='heatmap'){
  const sorted=[...ix].sort((a,b)=>t.predicted[a]-t.predicted[b]),keep=sorted.filter((_,i)=>i%Math.max(1,Math.ceil(sorted.length/200))===0);
  plot('global-chart',[{type:'heatmap',x:keep.map(i=>r.rows[i].id),y:labels,z:order.map(j=>keep.map(i=>t.shap[i][j]/sc.scale)),zmid:0,colorscale:[[0,'#2899c5'],[.5,'#fafcff'],[1,'#ef5689']],colorbar:{title:'SHAP',thickness:8},hovertemplate:'%{x}<br>%{y}<br>SHAP %{z:.5g}<extra></extra>'}],{margin:{l:left,r:55,t:18,b:50},xaxis:{title:{text:'按预测值升序排列的样本',font:{size:10}},showticklabels:false},yaxis:{autorange:'reversed',tickfont:{size:10},showgrid:false}});
  $('#global-note').textContent='观察不同样本的贡献模式；最多显示200条等间隔抽样记录，颜色使用同一SHAP量纲。';
 }
 const directions=$('.shap-directions');if(directions)directions.hidden=S.globalTab!=='beeswarm';
};
function readingGuide(key){
 const metric=key==='Cost_sum'?'总成本':key==='Emissions'?'碳排放量':'环境成本';
 return '<aside class="reading-guide"><h2>'+icon('info')+'读图说明</h2><div class="reading-item"><span class="reading-symbol">↑</span><div><b>正SHAP值：推高预测'+metric+'</b><p>该因素使所选方案的模型预测值高于基准。</p></div></div><div class="reading-item negative"><span class="reading-symbol">↓</span><div><b>负SHAP值：降低预测'+metric+'</b><p>该因素使所选方案的模型预测值低于基准。</p></div></div><div class="reading-item neutral"><span class="reading-symbol">'+icon('file')+'</span><div><b>结合整体样本分布解读</b><p>单个方案不能代表阶段总体规律。SHAP贡献解释模型预测，不直接等同于因果效应'+(key==='Emissions'?'或实际减排量':'')+'。</p></div></div></aside>';
}
renderAnalysis=function(m){
 const r=S.result,carbon=S.page==='carbon';
 const title=carbon?'协同规划低碳性可解释分析':'协同规划经济性可解释分析';
 if(!r){m.innerHTML='<div class="board">'+boardTitle(title)+empty('尚无可解释分析结果','请先选择数据集并运行双维度分析。')+'</div>';return;}
 if(S.globalTab==='bar')S.globalTab='beeswarm';
 const key=activeTarget(),t=r.targets[key],sc=targetScale(key),metric=key==='Cost_sum'?'总成本':key==='Emissions'?'碳排放量':'环境成本';
 if(S.dep>=r.features.length)S.dep=rank(key)[0];if(S.color>=r.features.length)S.color=0;
 const stageText=r.config.stage_value?esc(r.config.stage_value):r.config.stage_column?'已加载阶段字段（全部）':'未提供阶段标签';
 const targetControls=carbon?'<div class="target-tabs"><button data-carbon="Cost_car" class="'+(key==='Cost_car'?'active':'')+'">环境成本</button><button data-carbon="Emissions" '+(!r.targets.Emissions?'disabled title="需先确认碳价和换算关系"':'')+' class="'+(key==='Emissions'?'active':'')+'">碳排放量</button></div>':'<span class="tag blue">规划总成本</span>';
 m.innerHTML='<div class="board">'+boardTitle(title,'<label>解释目标</label>'+targetControls+'<label>阶段</label><select aria-label="当前分析阶段" disabled><option>'+stageText+'</option></select><label for="sampleSelect">方案</label><select id="sampleSelect" aria-label="选择局部解释方案">'+options(sampleOptions(),S.sample)+'</select>'+button('导出分析','download',true,'download'))+
 '<div class="explain-context"><label for="cohort">全局统计范围</label><select id="cohort">'+options([{key:'test',label:'独立测试样本（推荐）'},{key:'all',label:'全部有效样本'}],S.cohort)+'</select><span>'+indices().length+'条样本 · '+r.features.length+'项变化输入</span><span>工作表：'+esc(r.sheet)+'</span>'+(carbon?'<span>'+esc(key==='Emissions'?'已按确认关系换算物理排放量':'当前分析环境成本，未将其直接作为物理排放量')+'</span>':'')+'</div>'+
 '<div class="compact-metrics"><div><span>独立测试集 R²</span><b>'+fmt(t.test_metrics.r2,4)+'</b></div><div><span>独立测试集 MAE</span><b>'+compact(t.test_metrics.mae)+'</b></div><div><span>解释基准 E[f(X)]</span><b>'+compact(t.base_value)+'</b></div><div><span>SHAP加和最大误差</span><b>'+Number(t.additivity_max_error).toExponential(2)+'</b></div></div>'+
 '<div class="explanation-grid"><section class="card importance-card"><div class="card-head"><div><h2>影响'+(carbon?'低碳性':'经济性')+'的关键因素排序</h2><p>当前统计范围平均绝对SHAP值</p></div></div>'+chart('importance-chart')+'<p class="chart-note">缺失输入'+r.missing_features.length+'项、固定输入'+r.fixed_features.length+'项，不计入当前排序。</p></section>'+
 '<section class="card global-card"><div class="card-head"><div><h2>全局解释 · '+esc(t.label)+'</h2><p>'+esc(scopeLabel())+' · '+esc(sc.unit)+'</p></div></div><div class="tabbar">'+[['beeswarm','蜂群分布'],['dependence','依赖关系'],['heatmap','贡献热力图']].map(a=>'<button data-global="'+a[0]+'" class="'+(S.globalTab===a[0]?'active':'')+'">'+a[1]+'</button>').join('')+'</div>'+
 (S.globalTab==='dependence'?'<div class="chart-control"><label>分析因素</label><select id="depFeature" aria-label="依赖图分析因素">'+options(r.features.map((f,j)=>({key:j,label:shortLabel(f)})),S.dep)+'</select><label>着色因素</label><select id="colorFeature" aria-label="依赖图着色因素">'+options(r.features.map((f,j)=>({key:j,label:shortLabel(f)})),S.color)+'</select></div>':'')+
 chart('global-chart')+'<div class="shap-directions"><span>← 降低预测'+metric+'</span><span>增加预测'+metric+' →</span></div><p id="global-note" class="chart-note"></p></section></div>'+
 '<div class="local-grid"><section class="card local-panel"><div class="card-head"><div><h2>局部方案解释 · '+esc(r.rows[S.sample].id)+'</h2><p>解释所选方案的预测'+metric+'，实际值与模型预测分别展示</p></div></div><div class="sample-info" id="sample-info"></div><div class="tabbar">'+[['waterfall','瀑布图'],['force','力图'],['decision','决策路径']].map(a=>'<button data-local="'+a[0]+'" class="'+(S.localTab===a[0]?'active':'')+'">'+a[1]+'</button>').join('')+'</div><div id="local-holder">'+(S.localTab==='force'?'<iframe id="forceFrame" title="SHAP局部力图" style="width:100%;height:290px;border:0" src="'+forceUrl(r.id,key,S.sample)+'"></iframe>':chart('local-chart'))+'</div><p class="chart-note">基准预测与各项贡献之和等于模型预测；局部解释的单位为'+esc(t.unit)+'。</p></section>'+readingGuide(key)+'</div>'+
 '<details class="workspace-details" id="modelDiagnostics"><summary>模型预测评估、计算依据与适用范围</summary><div class="details-body diagnostics-layout"><div><h3>独立测试集：预测值与实际值</h3>'+chart('fit-chart')+'</div><div><h3>本次分析依据</h3><p>模型：'+esc(r.config.model)+' · 训练 / 测试：'+r.train_indices.length+' / '+r.test_indices.length+'</p><p>测试集 RMSE：'+fmt(t.test_metrics.rmse)+' '+esc(t.unit)+'<br>训练集 R²：'+fmt(t.train_metrics.r2,4)+'<br>解释方法：'+esc(r.method)+'</p><p>'+esc(r.split_method)+'。</p><ul>'+r.warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul></div></div></details>'+
 '<p class="analysis-footer">'+esc(r.explanation_boundary)+' · 缺失的因素不表示没有影响；阶段信息与成本单位以已导入数据及分析设置为准。</p></div>';
 drawImportance();drawGlobal();drawLocal();
 const n=r.features.length;if(n>8){$('#importance-chart').style.height=Math.max(345,n*34)+'px';$('#global-chart').style.height=Math.max(345,n*34)+'px';resizeCharts();}
 $('#modelDiagnostics').addEventListener('toggle',e=>{if(e.target.open)drawFit();});
};

function planRows(){return S.result.rows.map((_,i)=>i).sort((a,b)=>S.result.targets.Cost_sum.actual[a]-S.result.targets.Cost_sum.actual[b]).slice(0,S.planCount);}
function planInputDetails(i){
 const r=S.result,row=r.rows[i];
 return '<div class="card-head"><h2>方案 '+esc(row.id)+' · 输入边界与规划结果</h2><span class="tag">原表第'+row.source_row+'行</span></div><div class="card-body input-combination-grid"><div><h3>规划输入组合</h3><table><tbody>'+S.catalog.features.map(f=>'<tr><td>'+esc(f.label)+'</td><td>'+fmt(row.features[f.key],5)+'</td></tr>').join('')+'</tbody></table></div><div><h3>规划输出结果</h3><table><tbody>'+S.catalog.outputs.map(f=>'<tr><td>'+esc(f.label)+'</td><td>'+fmt(row.outputs[f.key],5)+'</td></tr>').join('')+'</tbody></table></div></div>';
}
renderPlans=function(m){
 const r=S.result;
 const heading=boardTitle('多时间尺度储能规划结果','<span class="tag">按规划总成本升序</span><select id="planCount" aria-label="展示方案数量">'+options([{key:5,label:'展示前5个方案'},{key:6,label:'展示前6个方案'}],S.planCount)+'</select>'+button('导出结果','download',true,'download'));
 if(!r){m.innerHTML='<div class="board">'+heading+empty('先运行一次案例分析','在输入边界页选择案例并完成分析，即可查看已有规划结果。')+'</div>';return;}
 const ids=planRows();if(!ids.includes(S.planSelected))S.planSelected=ids[0];
 m.innerHTML='<div class="board">'+heading+'<div class="explain-context"><span>核算范围：'+esc(scopeLabel())+'</span><span>容量和功率保留原始单位；成本单位：'+esc(r.targets.Cost_sum.unit)+'</span><span>对比已导入的规划结果，不重新求解规划模型。</span></div>'+
 '<div class="scheme-grid">'+ids.map((i,j)=>'<button class="scheme-card '+(S.planSelected===i?'selected':'')+'" data-plan="'+i+'" aria-pressed="'+(S.planSelected===i)+'"><div class="scheme-label"><strong>方案 '+esc(r.rows[i].id)+'</strong>'+(j===0?'<span class="tag blue">成本最低</span>':'')+'</div><div class="cost-label">规划总成本</div><div class="cost-number">'+compact(r.targets.Cost_sum.actual[i])+'</div><div class="source-row">优选'+String(j+1).padStart(2,'0')+' · 原表第'+r.rows[i].source_row+'行</div></button>').join('')+'</div>'+
 '<div class="plan-chart-grid"><section class="card"><div class="card-head"><h2>短时储能规划结果</h2></div>'+chart('short-plan')+'<p class="chart-note">能量容量与功率分别标轴，避免混用量纲。</p></section><section class="card"><div class="card-head"><h2>长时储能规划结果</h2></div>'+chart('long-plan')+'<p class="chart-note">上方为能量容量，下方对比充电与放电功率。</p></section></div>'+
 '<section class="card cost-chart section-gap"><div class="card-head"><div><h2>规划成本'+(r.targets.Emissions?'与碳排放':'与环境成本')+'对比</h2><p>'+(r.targets.Emissions?'两项成本共用左轴，碳排放量使用右轴。':'两项成本量级不同，分别使用左右坐标轴；碳排放量尚未换算。')+'</p></div><button class="small" data-ui="plan-details">'+icon('file')+(S.showPlanDetails?'收起方案输入组合':'查看所选方案输入组合')+'</button></div>'+chart('cost-plan')+'</section>'+
 '<section id="planDetails" class="card scheme-details" '+(!S.showPlanDetails?'hidden':'')+'>'+planInputDetails(S.planSelected)+'</section>'+
 '<details class="workspace-details"><summary>优选方案完整结果表</summary><div class="details-body table-wrap"><table><thead><tr><th>方案 / 原表行号</th>'+S.catalog.outputs.map(f=>'<th>'+esc(f.label)+'</th>').join('')+'</tr></thead><tbody>'+ids.map(i=>'<tr><td>'+r.rows[i].id+' / '+r.rows[i].source_row+'</td>'+S.catalog.outputs.map(f=>'<td>'+fmt(r.rows[i].outputs[f.key])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></details></div>';
 const cats=ids.map(i=>r.rows[i].id),vals=k=>ids.map(i=>r.rows[i].outputs[k]??null);
 const trace=(k,label,color,secondary=false)=>({type:'bar',name:label,x:cats,y:vals(k),marker:{color},text:vals(k).map(v=>v==null?'':Math.abs(v)>=1e6?fmt(v/1e6,2)+'M':Math.abs(v)>=1e3?fmt(v/1e3,1)+'k':fmt(v,1)),textfont:{size:9},textposition:'outside',cliponaxis:false,...(secondary?{xaxis:'x2',yaxis:'y2'}:{})});
 const common={margin:{l:70,r:25,t:46,b:40},legend:{orientation:'h',y:1.16,x:0,font:{size:10}},barmode:'group',bargap:.38,yaxis:{domain:[.62,1],title:{text:'能量 / 原始单位',font:{size:10}},gridcolor:'#e1ebf7',rangemode:'tozero'},xaxis:{domain:[0,1],anchor:'y'},yaxis2:{domain:[0,.34],title:{text:'功率 / 原始单位',font:{size:10}},gridcolor:'#e1ebf7',rangemode:'tozero'},xaxis2:{domain:[0,1],anchor:'y2'}};
 plot('short-plan',[trace('SDES_e','能量容量','#315def'),trace('SDES_p','规划功率','#80a6ff',true)],common);
 plot('long-plan',[trace('LDES_e','能量容量','#189c9a'),trace('LDES_ch','充电功率','#48bec2',true),trace('LDES_dis','放电功率','#208e74',true)],common);
 let traces=[{type:'bar',name:'规划总成本（左轴）',offsetgroup:'total',alignmentgroup:'costs',x:cats,y:vals('Cost_sum'),marker:{color:'#315def'}},{type:'bar',name:'环境成本'+(r.targets.Emissions?'（左轴）':'（右轴）'),offsetgroup:'environment',alignmentgroup:'costs',x:cats,y:vals('Cost_car'),marker:{color:'#d99c24'},...(r.targets.Emissions?{}:{yaxis:'y2'})}];
 if(r.targets.Emissions)traces.push({type:'scatter',mode:'lines+markers',name:'碳排放量（右轴）',x:cats,y:ids.map(i=>r.targets.Emissions.actual[i]),yaxis:'y2',line:{color:'#208e74',width:2}});
 plot('cost-plan',traces,{margin:{l:100,r:110,t:44,b:40},barmode:'group',legend:{orientation:'h',y:1.22,font:{size:10}},yaxis:{title:{text:'总成本 / '+r.targets.Cost_sum.unit,font:{size:10}},gridcolor:'#e1ebf7',rangemode:'tozero'},yaxis2:{title:{text:r.targets.Emissions?'碳排放量 / tCO₂':'环境成本 / '+r.targets.Cost_car.unit,font:{size:10}},overlaying:'y',side:'right',showgrid:false,rangemode:'tozero'},xaxis:{tickfont:{size:10}}});
};

document.addEventListener('click',e=>{
 if(e.target.closest('#presentationLayout')){if(document.documentElement.clientWidth<1200){document.body.classList.remove('presentation-layout');$('#presentationLayout').textContent='演示布局';$('#presentationLayout').setAttribute('aria-pressed','false');toast('当前窗口使用自适应布局，确保参数和图表完整显示。拉宽窗口后可切换演示布局。');return;}const wide=document.body.classList.toggle('presentation-layout');$('#presentationLayout').textContent=wide?'自适应布局':'演示布局';$('#presentationLayout').setAttribute('aria-pressed',String(wide));requestAnimationFrame(()=>{if(S.result&&['economy','carbon'].includes(S.page)){drawImportance();drawGlobal();drawLocal();}resizeCharts();});}
 const action=e.target.closest('[data-ui]');
 if(action?.dataset.ui==='settings'){const d=$('#dataWorkspace');d.open=true;d.scrollIntoView({behavior:'smooth',block:'start'});}
 if(action?.dataset.ui==='plan-details'){S.showPlanDetails=!S.showPlanDetails;$('#planDetails').hidden=!S.showPlanDetails;action.innerHTML=icon('file')+(S.showPlanDetails?'收起方案输入组合':'查看所选方案输入组合');if(S.showPlanDetails)$('#planDetails').scrollIntoView({behavior:'smooth',block:'start'});}
 const plan=e.target.closest('[data-plan]');if(plan){S.planSelected=Number(plan.dataset.plan);$$('[data-plan]').forEach(el=>{el.classList.toggle('selected',el===plan);el.setAttribute('aria-pressed',String(el===plan));});$('#planDetails').innerHTML=planInputDetails(S.planSelected);}
});
document.addEventListener('change',async e=>{
 try{if(e.target.id==='boundaryDataset'){await selectDataset(e.target.value);if(S.result?.dataset_id!==S.ds.id)S.result=null;render();}
 if(e.target.id==='planCount'){S.planCount=Number(e.target.value);render();}
 if(e.target.id==='sampleSelect'&&['economy','carbon'].includes(S.page)){const h=$('.local-panel .card-head h2');if(h)h.textContent='局部方案解释 · '+S.result.rows[S.sample].id;}
 }catch(err){toast(err.message);}
});
if(S.catalog)render();
window.addEventListener('resize',()=>{if(document.documentElement.clientWidth<1200&&document.body.classList.contains('presentation-layout')){document.body.classList.remove('presentation-layout');$('#presentationLayout').textContent='演示布局';$('#presentationLayout').setAttribute('aria-pressed','false');}});
