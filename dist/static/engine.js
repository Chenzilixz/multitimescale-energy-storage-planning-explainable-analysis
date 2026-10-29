/* Independent browser regression engine and exact tree-path-dependent SHAP.
 * For a leaf, its coalition value factors into (unknown branch mass / known
 * path membership). A feature's Shapley value is the integral of the product
 * of the other linear factors. Repeated splits on a feature are combined.
 * This is an exact Shapley computation, not a feature-importance proxy.
 */
(function(root){'use strict';
function random(seed){let s=(seed>>>0)||0x9e3779b9;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}
function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
function numeric(v){if(typeof v==='number')return Number.isFinite(v)?v:NaN;if(typeof v!=='string'||!v.trim())return NaN;let s=v.trim().replace(/,/g,'');const pct=s.endsWith('%');if(pct)s=s.slice(0,-1);const n=Number(s);return Number.isFinite(n)?n/(pct?100:1):NaN;}
function metrics(y,p,ids){let av=0;for(const i of ids)av+=y[i];av/=ids.length;let sq=0,abs=0,total=0;for(const i of ids){const e=p[i]-y[i];sq+=e*e;abs+=Math.abs(e);total+=(y[i]-av)**2;}return {r2:total>1e-24?1-sq/total:null,mae:abs/ids.length,rmse:Math.sqrt(sq/ids.length)};}
function trainingBins(X,ids,bins=32){const d=X[0].length,lo=new Float64Array(d).fill(Infinity),hi=new Float64Array(d).fill(-Infinity);for(const i of ids)for(let j=0;j<d;j++){lo[j]=Math.min(lo[j],X[i][j]);hi[j]=Math.max(hi[j],X[i][j]);}const step=Array.from(lo,(v,j)=>(hi[j]-v)/bins||1);const B=X.map(row=>Uint8Array.from(row,(v,j)=>Math.max(0,Math.min(bins-1,Math.ceil((v-lo[j])/step[j])-1))));return {B,lo,step,bins};}
function fitTree(X,y,ids,binInfo,rng,options){
 const {B,lo,step,bins}=binInfo,d=X[0].length,nodes=[],maxDepth=options.depth,minLeaf=options.minLeaf;
 function build(ix,depth){const n=ix.length;let sy=0,sy2=0;for(const i of ix){sy+=y[i];sy2+=y[i]*y[i];}const ni=nodes.length;nodes.push({feature:-1,threshold:0,left:-1,right:-1,value:sy/n,cover:n});if(depth>=maxDepth||n<2*minLeaf||sy2-sy*sy/n<1e-12)return ni;
  let cols=Array.from({length:d},(_,j)=>j);if(options.featureCount<d)cols=shuffle(cols,rng).slice(0,options.featureCount);
  let gain=0,bestF=-1,bestB=0;
  for(const j of cols){const count=new Int32Array(bins),sum=new Float64Array(bins);for(const i of ix){const b=B[i][j];count[b]++;sum[b]+=y[i];}let nl=0,sl=0;const candidate=options.extra?Math.floor(rng()*(bins-1)):-1;
   for(let b=0;b<bins-1;b++){nl+=count[b];sl+=sum[b];if((candidate>=0&&b!==candidate)||nl<minLeaf||n-nl<minLeaf)continue;const score=sl*sl/nl+(sy-sl)*(sy-sl)/(n-nl)-sy*sy/n;if(score>gain+1e-14){gain=score;bestF=j;bestB=b;}}
  }
  if(bestF<0)return ni;const threshold=lo[bestF]+(bestB+1)*step[bestF],a=[],b=[];for(const i of ix)(X[i][bestF]<=threshold?a:b).push(i);if(a.length<minLeaf||b.length<minLeaf)return ni;
  const l=build(a,depth+1),r=build(b,depth+1);Object.assign(nodes[ni],{feature:bestF,threshold,left:l,right:r,value:(nodes[l].value*nodes[l].cover+nodes[r].value*nodes[r].cover)/n});return ni;
 }
 build(ids,0);return {nodes};
}
function treePredict(tree,x){let i=0;while(tree.nodes[i].feature>=0){const n=tree.nodes[i];i=x[n.feature]<=n.threshold?n.left:n.right;}return tree.nodes[i].value;}
function prepareLeaves(tree){const leaves=[];function walk(i,path){const n=tree.nodes[i];if(n.feature<0){leaves.push({value:n.value,path:Array.from(path,([feature,p])=>({feature,...p}))});return;}for(const [child,left] of [[n.left,true],[n.right,false]]){const next=new Map(Array.from(path,([k,v])=>[k,{...v}])),p=next.get(n.feature)||{zero:1,lo:-Infinity,hi:Infinity};p.zero*=tree.nodes[child].cover/n.cover;if(left)p.hi=Math.min(p.hi,n.threshold);else p.lo=Math.max(p.lo,n.threshold);next.set(n.feature,p);walk(child,next);}}walk(0,new Map());tree.leaves=leaves;return tree;}
function treeExplain(tree,x,d){if(!tree.leaves)prepareLeaves(tree);const phi=new Float64Array(d);
 for(const leaf of tree.leaves){const path=leaf.path,k=path.length;if(!k)continue;const z=new Float64Array(k),delta=new Float64Array(k),poly=new Float64Array(k+1);poly[0]=1;
  for(let j=0;j<k;j++){const p=path[j];z[j]=p.zero;delta[j]=(x[p.feature]>p.lo&&x[p.feature]<=p.hi?1:0)-p.zero;for(let q=j+1;q>=0;q--)poly[q]=(q<=j?poly[q]*z[j]:0)+(q>0?poly[q-1]*delta[j]:0);}
  for(let j=0;j<k;j++){if(delta[j]===0)continue;const q=new Float64Array(k);if(Math.abs(z[j])>=Math.abs(delta[j])){q[0]=poly[0]/z[j];for(let u=1;u<k;u++)q[u]=(poly[u]-delta[j]*q[u-1])/z[j];}else{q[k-1]=poly[k]/delta[j];for(let u=k-1;u>0;u--)q[u-1]=(poly[u]-z[j]*q[u])/delta[j];}let integral=0;for(let u=0;u<k;u++)integral+=q[u]/(u+1);phi[path[j].feature]+=leaf.value*delta[j]*integral;}
 }return Array.from(phi);
}
function fitEnsemble(X,y,train,kind,seed,progress=()=>{}){
 const rng=random(seed),d=X[0].length,ys=train.map(i=>y[i]),av=mean(ys),scale=Math.sqrt(mean(ys.map(v=>(v-av)**2)))||1,yn=y.map(v=>v/scale),bin=trainingBins(X,train),gb=kind==='gradient_boosting';
 const count=gb?220:72,rate=gb?.05:1/count,base=gb?mean(train.map(i=>yn[i])):0,work=new Float64Array(X.length).fill(base),trees=[];
 for(let t=0;t<count;t++){const target=gb?yn.map((v,i)=>v-work[i]):yn;let ids=train;if(!gb&&kind==='random_forest')ids=Array.from({length:train.length},()=>train[Math.floor(rng()*train.length)]);
  const tree=fitTree(X,target,ids,bin,rng,{depth:gb?3:6,minLeaf:gb?4:5,featureCount:gb?d:Math.max(1,Math.ceil(Math.sqrt(d))),extra:kind==='extra_trees'});trees.push(prepareLeaves(tree));for(let i=0;i<X.length;i++)work[i]+=rate*treePredict(tree,X[i]);if(t%20===0||t===count-1)progress((t+1)/count);
 }
 return {trees,rate,base,scale,predicted:Array.from(work,v=>v*scale),expected:(base+rate*trees.reduce((s,t)=>s+t.nodes[0].value,0))*scale,parameters:{trees:count,max_depth:gb?3:6,learning_rate:gb?rate:null,histogram_bins:32,min_leaf:gb?4:5,engine:'Browser histogram CART v1'}};
}
function explain(model,X,progress=()=>{}){const d=X[0].length,all=[];for(let i=0;i<X.length;i++){const row=new Float64Array(d);for(const tree of model.trees){const p=treeExplain(tree,X[i],d);for(let j=0;j<d;j++)row[j]+=p[j]*model.rate*model.scale;}all.push(Array.from(row));if(i%64===0||i===X.length-1)progress((i+1)/X.length);}return all;}
function analyze(table,config,schema,meta,log=()=>{}){
 const started=Date.now(),mapping=config.mapping||{},fields=[...schema.features,...schema.outputs],keys=new Set(fields.map(f=>f.key)),used=new Set();
 log(3,'读取与校验','读取当前浏览器工作区的数据，文件不上传公共服务器');
 for(const [k,v] of Object.entries(mapping)){if(!keys.has(k)||!v)continue;if(!table.columns.includes(v))throw Error('字段映射包含不存在的数据列。');if(used.has(v))throw Error('一个数据列不能映射到多个输入或输出字段。');used.add(v);}
 if(!mapping.Cost_sum||!mapping.Cost_car)throw Error('请映射规划总成本和规划环境成本两个目标。');
 const active=schema.features.filter(f=>mapping[f.key]),outs=schema.outputs.filter(f=>mapping[f.key]);if(!active.length)throw Error('至少需要一项有效输入参数。');
 const pos=Object.fromEntries(fields.filter(f=>mapping[f.key]).map(f=>[f.key,table.columns.indexOf(mapping[f.key])])),rows=[],invalid=[];const stageCol=config.stage_column||'',stagePos=table.columns.indexOf(stageCol),stage=String(config.stage_value||'');
 if(stageCol&&stagePos<0)throw Error('阶段字段不存在。');
 for(const raw of table.rows){if(stage&&String(raw.cells[stagePos]??'')!==stage)continue;const values={};let valid=true;for(const f of [...active,...outs]){const n=numeric(raw.cells[pos[f.key]]);values[f.key]=n;if(!Number.isFinite(n))valid=false;}if(!valid){invalid.push(raw.source_row);continue;}for(const f of active)if(f.key.endsWith('_eta')&&(values[f.key]<=0||values[f.key]>1))throw Error('效率应为0—1之间的小数，请核对原始数据。');if(values.Cost_sum<0||values.Cost_car<0)throw Error('成本目标不能为负。');rows.push({source_row:raw.source_row,values,stage:stageCol?String(raw.cells[stagePos]??''):null});}
 if(invalid.length&&config.missing_policy!=='drop')throw Error('存在缺失或非数值记录，原表行号：'+invalid.slice(0,12).join('、')+'。可在设置中明确选择排除。');
 if(rows.length<40)throw Error('至少需要40条完整数值记录。');if(rows.length>10000)throw Error('浏览器版每次支持最多10000条有效记录，请分批分析。');
 const fixed=active.filter(f=>rows.every(r=>r.values[f.key]===rows[0].values[f.key])).map(f=>f.key),features=active.filter(f=>!fixed.includes(f.key)),missing=schema.features.filter(f=>!mapping[f.key]).map(f=>f.key);if(!features.length)throw Error('全部输入均为固定值，无法识别变化因素。');
 const X=rows.map(r=>features.map(f=>r.values[f.key])),groups=new Map();X.forEach((x,i)=>{const k=JSON.stringify(x);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);});if(groups.size<15)throw Error('至少需要15组不同的输入边界组合。');
 const seed=Number(config.seed??42),testSize=Number(config.test_size??.2);if(!Number.isInteger(seed)||seed<0||seed>999999||testSize<.1||testSize>.4)throw Error('随机种子或测试集比例不合法。');
 const groupList=shuffle(Array.from(groups.values()),random(seed)),nTest=Math.ceil(groupList.length*testSize),test=groupList.slice(0,nTest).flat().sort((a,b)=>a-b),train=groupList.slice(nTest).flat().sort((a,b)=>a-b),testSet=new Set(test);
 const warnings=[];if(meta.synthetic_demo)warnings.push(meta.data_notice);if(missing.length)warnings.push('有'+missing.length+'项输入未提供，本次仅解释实际映射的变化输入。');if(fixed.length)warnings.push('固定参数不参与因素排序。');if(invalid.length)warnings.push('已排除缺失记录'+invalid.length+'条，并保留原表行号。');
 const high=[];for(let a=0;a<features.length;a++)for(let b=a+1;b<features.length;b++){let sx=0,sy=0,sxx=0,syy=0,sxy=0;for(const x of X){sx+=x[a];sy+=x[b];sxx+=x[a]**2;syy+=x[b]**2;sxy+=x[a]*x[b];}const n=X.length,r=(n*sxy-sx*sy)/Math.sqrt((n*sxx-sx*sx)*(n*syy-sy*sy));if(Math.abs(r)>.95)high.push({a:features[a].key,b:features[b].key,correlation:r});}if(high.length)warnings.push('部分输入高度相关，SHAP贡献分配需结合采样设计解读。');
 const targetData={Cost_sum:rows.map(r=>r.values.Cost_sum),Cost_car:rows.map(r=>r.values.Cost_car)};
 let emissionNote='当前分析环境成本。未确认碳价与核算关系，不自动换算物理碳排放量。';
 if(config.derive_emissions){if(!config.carbon_relation_confirmed)throw Error('请确认碳价、币种、核算时期与环境成本的换算关系。');const factor=Number(config.environment_cost_multiplier),fixedPrice=Number(config.fixed_carbon_price);if(!(factor>0&&Number.isFinite(factor)))throw Error('环境成本单位换算倍数应为正数。');targetData.Emissions=rows.map(r=>{const price=mapping.Carbon_price?r.values.Carbon_price:fixedPrice;if(!(price>0&&Number.isFinite(price)))throw Error('碳价必须为正值。');return r.values.Cost_car*factor/price;});emissionNote='按用户确认的环境成本×单位换算倍数÷碳价换算tCO₂；环境成本解释仍单独保留。';}
 const kind=config.model||'gradient_boosting';if(!['gradient_boosting','random_forest','extra_trees'].includes(kind))throw Error('不支持所选模型。');const targets={},labels={Cost_sum:'规划总成本',Cost_car:'规划环境成本',Emissions:'碳排放总量'},count=Object.keys(targetData).length;let tIndex=0;
 for(const [key,y] of Object.entries(targetData)){if(Math.max(...y)-Math.min(...y)<1e-12)throw Error(labels[key]+'没有变化，无法拟合解释模型。');const start=8+tIndex*82/count,span=82/count;log(start,'训练'+labels[key],'训练集拟合，独立测试集评估');const model=fitEnsemble(X,y,train,kind,seed,f=>log(start+span*.55*f,'训练'+labels[key],'正在拟合树模型 '+Math.round(f*100)+'%'));
  const phi=explain(model,X,f=>log(start+span*(.55+.45*f),'计算'+labels[key]+' SHAP','逐样本计算精确树路径Shapley贡献 '+Math.round(f*100)+'%'));
  let error=0;for(let i=0;i<X.length;i++)error=Math.max(error,Math.abs(model.expected+phi[i].reduce((s,v)=>s+v,0)-model.predicted[i]));if(error>Math.max(1,...model.predicted.map(Math.abs))*1e-7)throw Error('SHAP贡献加和校验失败，本次结果未保存。');
  const importance=ids=>features.map((_,j)=>ids.reduce((s,i)=>s+Math.abs(phi[i][j]),0)/ids.length),tm=metrics(y,model.predicted,test);if(tm.r2===null||tm.r2<.8)warnings.push(labels[key]+'的独立测试表现有限，请先检查数据与模型拟合情况。');
  targets[key]={label:labels[key],unit:key==='Emissions'?'tCO₂':config.cost_unit||'数据原始成本单位',actual:y,predicted:model.predicted,base_value:model.expected,shap:phi,importance_test:importance(test),importance_all:importance(X.map((_,i)=>i)),train_metrics:metrics(y,model.predicted,train),test_metrics:tm,quality:tm.r2!==null&&tm.r2>=.8?'良好':'需改进',additivity_max_error:error,engine_parameters:model.parameters};tIndex++;
 }
 log(96,'保存独立分析记录','保存到当前浏览器，其他访问者无法读取本工作区数据');
 return {created_at:new Date().toISOString(),duration_seconds:(Date.now()-started)/1000,dataset_id:meta.id,dataset_name:meta.name,source_sha256:meta.sha256,sheet:config.sheet,scope_label:stage|| (stageCol?'所选工作表全部阶段':'所选工作表全体样本（未提供阶段标签）'),features:features.map(({key,label})=>({key,label})),missing_features:missing,fixed_features:fixed,invalid_rows:invalid,high_correlations:high,rows:rows.map((r,i)=>({id:'S'+String(i+1).padStart(4,'0'),source_row:r.source_row,split:testSet.has(i)?'test':'train',features:Object.fromEntries(features.map(f=>[f.key,r.values[f.key]])),outputs:Object.fromEntries(outs.map(f=>[f.key,r.values[f.key]])),stage:r.stage})),train_indices:train,test_indices:test,targets,config,synthetic_demo:!!meta.synthetic_demo,data_notice:meta.data_notice||'',warnings,emission_note:emissionNote,explanation_boundary:'解释代理模型预测贡献，不代表因果效应或重新求解的规划结果。',method:'Tree SHAP / tree_path_dependent · 浏览器独立计算',split_method:'按完全相同的输入边界分组后划分，测试样本不参与训练',versions:{shap:'精确Tree SHAP JS v1',sklearn:'浏览器CART/GBDT v1',engine:'browser-tree-v1'}};
}
function makeDemo(schema,n=2400){const ranges=[[800,3000],[900,3600],[200,1500],[.6,.9],[.55,.85],[600,1800],[400,1400],[30,180],[0,.05],[.6,1.1],[150,400],[200,1000],[3000,7500],[1800,5000]],rng=random(20261029),U=ranges.map(()=>shuffle(Array.from({length:n},(_,i)=>i),rng)),rows=[];
 for(let i=0;i<n;i++){const x=ranges.map(([a,b],j)=>a+(b-a)*(U[j][i]+rng())/n),z=x.map((v,j)=>(v-(ranges[j][0]+ranges[j][1])/2)/((ranges[j][1]-ranges[j][0])/2)),sp=45000*Math.exp(-.17*z[5]-.08*z[6]+.12*z[8]+.07*z[7]),se=sp*4*Math.exp(-.15*z[6]+.07*z[8]),ld=2800*Math.exp(-.12*z[1]+.1*z[5]+.13*z[8]+.08*z[7]),lc=4500*Math.exp(-.16*z[0]+.09*z[8]+.06*z[5]),le=ld*120*Math.exp(-.18*z[2]+.08*z[6]-.09*z[3]-.07*z[4]),gf=10000*Math.exp(-.2*z[11]+.07*z[8]+.08*z[10]),w=200000*Math.exp(-.18*z[12]+.1*z[8]+.08*z[7]),pv=300000*Math.exp(-.19*z[13]+.13*z[8]+.08*z[7]),car=15000*x[7]*Math.exp(.22*z[8]+.25*z[9]-.12*z[7]+.12*z[12]+.1*z[13]+.05*z[6]-.08*z[4]),non=2e9*Math.exp(.06*z[0]+.04*z[1]+.06*z[2]-.09*z[3]-.08*z[4]+.05*z[5]+.06*z[6]+.02*z[7]+.18*z[8]+.025*z[9]+.1*z[10]+.03*z[11]+.1*z[12]+.09*z[13]+.025*z[0]*z[2]);rows.push([...x,non+car,car,sp,se,le,lc,ld,gf,w,pv,.9,'SYNTHETIC_DEMO']);}
 return {columns:[...schema.features,...schema.outputs].map(f=>f.key).concat(['SDES_eta','Data_origin']),rows:rows.map((cells,i)=>({source_row:i+2,cells})),header_row:1};
}
const api={random,numeric,fitEnsemble,treePredict,prepareLeaves,treeExplain,explain,analyze,makeDemo,metrics};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StorageEngine=api;
})(typeof self!=='undefined'?self:this);
