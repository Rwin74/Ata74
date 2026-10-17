'use strict';
const fs=require('fs'),path=require('path'),{performance}=require('perf_hooks'),{isMainThread,parentPort,workerData}=require('worker_threads');
async function analyzeFolder(root,{maxEntries=300000,maxMs=90000,onProgress=()=>{}}={}){
 const started=performance.now(),resolved=await fs.promises.realpath(root),rootStat=await fs.promises.lstat(root);if(rootStat.isSymbolicLink()||!rootStat.isDirectory())throw Error('Normal bir klasör veya sürücü seçin. Bağlantı klasörü taranmaz.');
 let volume=null;try{const v=await fs.promises.statfs(resolved);volume={total:v.blocks*v.bsize,free:v.bavail*v.bsize};}catch{}
 const queue=[resolved],folders=new Map(),types=new Map(),largest=[],seen=new Set();let visited=0,files=0,bytes=0,skipped=0,errors=0,links=0,hardlinks=0,lastReport=0,partial=false,reason='';
 const within=p=>{const relative=path.relative(resolved,p);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));};
 const snapshot=()=>({files,folders:visited,bytes,skipped,errors,links,hardlinks,elapsedMs:Math.round(performance.now()-started)});
 let entries=0;
 while(queue.length){
  if(entries>=maxEntries||performance.now()-started>=maxMs){partial=true;reason=entries>=maxEntries?'Dosya sayısı sınırı':'Süre sınırı';break;}
  const folder=queue.pop();
  try{
   const actual=await fs.promises.realpath(folder);if(!within(actual)){skipped++;links++;continue;}
   const directory=await fs.promises.opendir(folder);visited++;
   for await(const entry of directory){
    entries++;if(entries>maxEntries||performance.now()-started>=maxMs){partial=true;reason=entries>maxEntries?'Dosya sayısı sınırı':'Süre sınırı';break;}
    const full=path.join(folder,entry.name);if(entry.isSymbolicLink()){skipped++;links++;continue;}
    if(entry.isDirectory()){if(queue.length>=20000){skipped++;partial=true;reason='Klasör kuyruğu sınırı';}else queue.push(full);continue;}
    if(!entry.isFile()){skipped++;continue;}
    try{
     const stat=await fs.promises.lstat(full);if(stat.isSymbolicLink()||!stat.isFile()){skipped++;links++;continue;}
     if(stat.nlink>1&&stat.ino!==0){const key=stat.dev+':'+stat.ino;if(seen.has(key)){hardlinks++;continue;}seen.add(key);}
     const size=stat.size;files++;bytes+=size;
     const rel=path.relative(resolved,full),parts=rel.split(path.sep),group=parts.length===1?'(Kök dosyalar)':parts[0];folders.set(group,(folders.get(group)||0)+size);
     let ext=path.extname(entry.name).toLowerCase()||'(uzantısız)';if(ext.length>20)ext='(diğer)';if(!types.has(ext)&&types.size>=200)ext='(diğer)';types.set(ext,(types.get(ext)||0)+size);
     largest.push({path:full,bytes:size});largest.sort((a,b)=>b.bytes-a.bytes);if(largest.length>30)largest.pop();
    }catch{errors++;skipped++;}
    if(performance.now()-lastReport>500){lastReport=performance.now();onProgress(snapshot());}
   }
  }catch{errors++;skipped++;}
  if(partial&&reason!=='Klasör kuyruğu sınırı')break;
 }
 if(errors>0){partial=true;if(!reason)reason='Bazı dosyalar okunamadı';}
 const ranked=map=>[...map.entries()].map(([name,bytes])=>({name,bytes})).sort((a,b)=>b.bytes-a.bytes).slice(0,25);
 return {root:resolved,volume,...snapshot(),partial,reason,largest,folders:ranked(folders),types:ranked(types),folderCount:visited};
}
if(!isMainThread)analyzeFolder(workerData.root,{...workerData.options,onProgress:data=>parentPort.postMessage({type:'progress',data})}).then(data=>parentPort.postMessage({type:'result',data})).catch(e=>parentPort.postMessage({type:'error',message:e.message}));
module.exports={analyzeFolder};
