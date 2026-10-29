importScripts('schema.js','engine.js');
self.onmessage=function(e){try{const {table,config,meta,id}=e.data;const r=StorageEngine.analyze(table,config,StorageSchema,meta,(progress,title,detail)=>self.postMessage({type:'progress',progress,title,detail}));r.id=id;self.postMessage({type:'done',result:r});}catch(err){self.postMessage({type:'error',error:err.message||String(err)});}};
