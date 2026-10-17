'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const idFor=entry=>crypto.createHash('sha256').update(JSON.stringify([entry.source,entry.scope,entry.name])).digest('hex');
const equalRun=(a,b)=>a.exists===b.exists&&(!a.exists||(a.kind===b.kind&&a.value===b.value));
async function shortcutState(file){
 let stat;try{stat=await fs.promises.lstat(file);}catch(error){if(error.code==='ENOENT')return {exists:false};throw error;}
 if(stat.isSymbolicLink()||!stat.isFile()||stat.size>1024*1024)throw Error('Normal, 1 MB altında bir kısayol bekleniyordu.');
 const bytes=await fs.promises.readFile(file),after=await fs.promises.lstat(file);if(stat.size!==after.size||stat.mtimeMs!==after.mtimeMs||stat.ino!==after.ino)throw Error('Kısayol okunurken değişti.');
 return {exists:true,size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}
const equalShortcut=(a,b)=>a.exists===b.exists&&(!a.exists||(a.size===b.size&&a.sha256===b.sha256));
class StartupManager{
 constructor({directory,backend}){this.directory=directory;this.backend=backend;this.file=path.join(directory,'startup-backups.json');}
 validateBackup(id,record){
  if(record.entry.source==='run'){if(record.backup!==null||!['String','ExpandString'].includes(record.before.kind)||typeof record.before.value!=='string')throw Error('Run yedeği geçersiz.');return;}
  const base=path.resolve(this.directory,'files'),backup=typeof record.backup==='string'?path.resolve(record.backup):'';
  if(!backup||path.basename(backup)!=='shortcut.backup'||path.dirname(path.dirname(backup))!==base||!path.basename(path.dirname(backup)).startsWith(id+'-')||!['.lnk','.url'].includes(path.extname(record.entry.name).toLowerCase())||!Number.isInteger(record.before.size)||record.before.size<0||record.before.size>1024*1024||!/^[a-f0-9]{64}$/.test(record.before.sha256))throw Error('Kısayol yedeği geçersiz.');
 }
 readJournal(){if(!fs.existsSync(this.file))return {};if(fs.statSync(this.file).size>2*1024*1024)throw Error('Başlangıç yedeği boyut sınırını aşıyor.');const records=JSON.parse(fs.readFileSync(this.file,'utf8'));if(!records||Array.isArray(records)||typeof records!=='object')throw Error('Başlangıç yedeği okunamadı.');for(const [id,record] of Object.entries(records)){if(!/^[0-9a-f]{64}$/.test(id)||idFor(record.entry)!==id||!record.before?.exists||!['run','shortcut'].includes(record.entry.source))throw Error('Başlangıç yedeği geçersiz; otomatik işlem yapılmadı.');if(record.entry.source==='run'&&record.entry.scope!=='user')throw Error('Yedekte desteklenmeyen kapsam.');if(record.entry.source==='shortcut'&&record.entry.scope!=='user')throw Error('Yedekte desteklenmeyen kapsam.');this.validateBackup(id,record);}return records;}
 save(records){fs.mkdirSync(this.directory,{recursive:true});const temp=this.file+'.tmp';fs.writeFileSync(temp,JSON.stringify(records,null,2),{mode:0o600});fs.renameSync(temp,this.file);}
 async list(){
  const raw=await this.backend('list'),items=[];
  for(const entry of raw.entries||[])items.push({...entry,id:idFor(entry),label:entry.name,command:entry.value,writable:entry.scope==='user'&&['String','ExpandString'].includes(entry.kind),state:'present'});
  const notes=[];
  for(const [scope,folder] of [['user',raw.startup],['common',raw.commonStartup]]){
   if(!folder)continue;try{
    const rootInfo=await fs.promises.lstat(folder);if(rootInfo.isSymbolicLink()||!rootInfo.isDirectory()){notes.push('Başlangıç klasörü bağlantı veya normal klasör değil; atlandı.');continue;}
    for(const dirent of await fs.promises.readdir(folder,{withFileTypes:true})){
     if(dirent.name.toLowerCase()==='desktop.ini')continue;
     const source={source:'shortcut',scope,name:dirent.name},full=path.join(folder,dirent.name);let writable=false;
     if(scope==='user'&&dirent.isFile()&&!dirent.isSymbolicLink()&&['.lnk','.url'].includes(path.extname(dirent.name).toLowerCase())){const stat=await fs.promises.lstat(full);writable=stat.size<=1024*1024;}
     items.push({...source,id:idFor(source),label:dirent.name,command:full,file:full,root:await fs.promises.realpath(folder),writable,state:'present'});
    }
   }catch(error){if(error.code!=='ENOENT')notes.push('Bir başlangıç klasörü okunamadı.');}
  }
  const records=this.readJournal();
  for(const [id,record] of Object.entries(records)){
   const existing=items.find(x=>x.id===id);if(existing){existing.state='backup-conflict';existing.hasBackup=true;}else items.push({...record.entry,id,writable:false,state:record.status==='disabled'?'paused':'pending',hasBackup:true});
  }
  return {account:raw.account,entries:items,notes};
 }
 async readState(entry){if(entry.source==='run')return this.backend('read',{scope:entry.scope,name:entry.name});return shortcutState(entry.file);}
 async checkRoot(entry){if(entry.source!=='shortcut')return;const raw=await this.backend('list');const actual=raw.startup;if(!actual||path.resolve(actual)!==path.dirname(path.resolve(entry.file))||path.basename(entry.file)!==entry.name||await fs.promises.realpath(actual)!==entry.root||(await fs.promises.lstat(actual)).isSymbolicLink())throw Error('Başlangıç klasörü değişmiş; işlem yapılmadı.');}
 async disable(id,expectedCommand){
  const records=this.readJournal();if(records[id])throw Error('Bu kayıt için yedek var. Önce geri yükleyin.');
  const list=await this.list(),entry=list.entries.find(x=>x.id===id);if(!entry||!entry.writable||entry.state!=='present')throw Error('Bu başlangıç kaydı doğrudan değiştirilemiyor.');
  if(expectedCommand!==undefined&&entry.command!==expectedCommand)throw Error('Başlangıç kaydı onay sırasında değişti. Listeyi yenileyin.');
  await this.checkRoot(entry);const before=await this.readState(entry);if(!before.exists)throw Error('Başlangıç kaydı artık yok.');
  if(entry.source==='run'&&(before.value!==entry.value||before.kind!==entry.kind))throw Error('Başlangıç kaydı değişti. Listeyi yenileyin.');
  let backup=null;
  if(entry.source==='shortcut'){const files=path.join(this.directory,'files');fs.mkdirSync(files,{recursive:true});const dir=fs.mkdtempSync(path.join(files,id+'-'));backup=path.join(dir,'shortcut.backup');}
  const record={entry,before,backup,status:'pending',createdAt:new Date().toISOString()};records[id]=record;this.save(records);
  try{
   if(entry.source==='run')await this.backend('remove',{scope:entry.scope,name:entry.name,kind:before.kind,value:before.value});
   else{if(!equalShortcut(await shortcutState(entry.file),before))throw Error('Kısayol değişti.');await fs.promises.rename(entry.file,backup);if(!equalShortcut(await shortcutState(backup),before))throw Error('Taşınan kısayol farklı; yedek korundu.');}
   if((await this.readState(entry)).exists)throw Error('Duraklatma doğrulanamadı.');record.status='disabled';this.save(records);return {message:'Başlangıç kaydı yedeklendi ve Ata74 ile duraklatıldı. Çalışan uygulama kapatılmaz.'};
  }catch(error){const current=await this.readState(entry).catch(()=>null);if(current&&(entry.source==='run'?equalRun(current,before):equalShortcut(current,before))&&(!backup||!fs.existsSync(backup))){delete records[id];this.save(records);}throw Error(error.message+' Geri yükleme bilgisi varsa korunmuştur.');}
 }
 async restore(id){
  const records=this.readJournal(),record=records[id];if(!record)throw Error('Bu kayıt için Ata74 yedeği yok.');const {entry,before}=record;await this.checkRoot(entry);const current=await this.readState(entry),equal=entry.source==='run'?equalRun:equalShortcut;
  if(current.exists&&!equal(current,before))throw Error('Aynı adla farklı bir kayıt var. Üzerine yazılmadı; yedek korundu.');
  if(!current.exists){
   if(entry.source==='run')await this.backend('create',{scope:entry.scope,name:entry.name,kind:before.kind,value:before.value});
   else{
    const parent=path.dirname(record.backup);if((await fs.promises.lstat(parent)).isSymbolicLink()||(await fs.promises.lstat(path.dirname(parent))).isSymbolicLink())throw Error('Yedek klasörü bağlantıya dönüşmüş; işlem yapılmadı.');
    if(!equalShortcut(await shortcutState(record.backup),before))throw Error('Yedek kısayol değişmiş. Otomatik geri yüklenmedi.');
    await fs.promises.copyFile(record.backup,entry.file,fs.constants.COPYFILE_EXCL);
   }
  }
  if(!equal(await this.readState(entry),before))throw Error('Geri yükleme doğrulanamadı; yedek korundu.');
  delete records[id];this.save(records);
  // Keep the small shortcut backup for manual recovery; never delete a path read from the journal.
  return {message:'Önceki başlangıç kaydı geri yüklendi ve doğrulandı. Windows’un kendi başlangıç ayarları ayrıca geçerlidir.'};
 }
}
module.exports={StartupManager,idFor,shortcutState,equalRun,equalShortcut};
