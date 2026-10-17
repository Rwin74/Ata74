'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{performance}=require('perf_hooks'),{isMainThread,parentPort,workerData}=require('worker_threads');
function fingerprint(stat){return {size:stat.size,mtimeMs:stat.mtimeMs,ctimeMs:stat.ctimeMs,ino:stat.ino,dev:stat.dev};}
function unchanged(a,b){return ['size','mtimeMs','ctimeMs','ino','dev'].every(k=>a[k]===b[k]);}
async function findDuplicates(root,{maxEntries=150000,maxMs=120000,maxBytes=4*1024**3,maxFileBytes=2*1024**3,onProgress=()=>{}}={}){
 const begin=performance.now(),rootInfo=await fs.promises.lstat(root);if(rootInfo.isSymbolicLink()||!rootInfo.isDirectory())throw Error('Normal bir klasör veya sürücü seçin.');
 const resolved=await fs.promises.realpath(root),queue=[resolved],sizes=new Map(),seen=new Set();let entries=0,files=0,hashed=0,readBytes=0,skipped=0,errors=0,links=0,hardlinks=0,empty=0,partial=false,lastProgress=0;const reasons=new Set();
 const within=p=>{const r=path.relative(resolved,p);return r===''||(!path.isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+path.sep));};
 const snapshot=phase=>({phase,files,hashed,readBytes,skipped,errors,elapsedMs:Math.round(performance.now()-begin)});
 function progress(phase){if(performance.now()-lastProgress>400){lastProgress=performance.now();onProgress(snapshot(phase));}}
 function limit(reason){partial=true;reasons.add(reason);}
 while(queue.length){
  if(entries>=maxEntries||performance.now()-begin>=maxMs){limit('Tarama sınırına ulaşıldı');break;}
  const folder=queue.pop();try{
   if(!within(await fs.promises.realpath(folder))){links++;skipped++;continue;}
   const directory=await fs.promises.opendir(folder);
   for await(const entry of directory){entries++;if(entries>maxEntries||performance.now()-begin>=maxMs){limit('Tarama sınırına ulaşıldı');break;}
    const full=path.join(folder,entry.name);if(entry.isSymbolicLink()){links++;skipped++;continue;}
    if(entry.isDirectory()){if(queue.length<20000)queue.push(full);else{skipped++;limit('Klasör kuyruğu sınırı');}continue;}
    if(!entry.isFile()){skipped++;continue;}
    try{const stat=await fs.promises.lstat(full);if(stat.isSymbolicLink()||!stat.isFile()){links++;skipped++;continue;}if(stat.nlink>1&&stat.ino!==0){const id=stat.dev+':'+stat.ino;if(seen.has(id)){hardlinks++;continue;}seen.add(id);}files++;if(stat.size===0){empty++;continue;}if(stat.size>maxFileBytes){skipped++;limit('2 GB üstü dosyalar atlandı');continue;}const list=sizes.get(stat.size)||[];list.push({path:full,stat:fingerprint(stat)});sizes.set(stat.size,list);}catch{errors++;skipped++;limit('Bazı dosyalar okunamadı');}progress('listing');
   }
  }catch{errors++;skipped++;limit('Bazı klasörler okunamadı');}
 }
 const hashes=new Map();let exhausted=false;
 for(const candidates of sizes.values()){
  if(candidates.length<2)continue;
  for(const file of candidates){
   if(performance.now()-begin>=maxMs||readBytes>=maxBytes){limit('İçerik okuma / süre sınırı');exhausted=true;break;}
   let handle;try{
    if(!within(await fs.promises.realpath(file.path)))throw Error('Klasör dışına çıkan bağlantı');
    const current=await fs.promises.lstat(file.path);if(current.isSymbolicLink()||!unchanged(fingerprint(current),file.stat))throw Error('Dosya değişti');
    handle=await fs.promises.open(file.path,'r');if(!unchanged(fingerprint(await handle.stat()),file.stat))throw Error('Dosya değişti');
    const hash=crypto.createHash('sha256');
    for await(const chunk of handle.createReadStream({autoClose:false,highWaterMark:65536})){readBytes+=chunk.length;if(readBytes>maxBytes||performance.now()-begin>=maxMs){limit('İçerik okuma / süre sınırı');exhausted=true;throw Error('LIMIT');}hash.update(chunk);progress('hashing');}
    if(!unchanged(fingerprint(await handle.stat()),file.stat))throw Error('Dosya tarama sırasında değişti');
    const digest=hash.digest('hex'),key=file.stat.size+':'+digest;const group=hashes.get(key)||{id:key,sha256:digest,size:file.stat.size,count:0,paths:[]};group.count++;if(group.paths.length<20)group.paths.push(file.path);hashes.set(key,group);hashed++;
   }catch(error){if(error.message!=='LIMIT'){errors++;skipped++;limit('Değişen veya okunamayan dosyalar atlandı');}}
   finally{if(handle)await handle.close().catch(()=>{});}
   if(exhausted)break;
  }
  if(exhausted)break;
 }
 const groups=[...hashes.values()].filter(g=>g.count>1).map(g=>({...g,extraCount:g.count-g.paths.length,potentialBytes:(g.count-1)*g.size})).sort((a,b)=>b.potentialBytes-a.potentialBytes);
 return {root:resolved,...snapshot('done'),links,hardlinks,empty,partial,reasons:[...reasons],totalGroups:groups.length,potentialBytes:groups.reduce((n,g)=>n+g.potentialBytes,0),groups:groups.slice(0,100),truncatedGroups:Math.max(0,groups.length-100)};
}
if(!isMainThread)findDuplicates(workerData.root,{...workerData.options,onProgress:data=>parentPort.postMessage({type:'progress',data})}).then(data=>parentPort.postMessage({type:'result',data})).catch(error=>parentPort.postMessage({type:'error',message:error.message}));
module.exports={findDuplicates,fingerprint,unchanged};
