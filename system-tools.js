'use strict';
const fs=require('fs'),path=require('path'),{execFile}=require('child_process');
function runSystem(scriptPath,action,payload={}) {
 const quote=s=>"'"+s.replace(/'/g,"''")+"'";
 const data=Buffer.from(JSON.stringify(payload),'utf8').toString('base64');
 const source=fs.readFileSync(scriptPath,'utf8').replace(/^\uFEFF/,'');
 const command=`& {
${source}
} -Action ${quote(action)} -PayloadBase64 '${data}'`;
 return new Promise((resolve,reject)=>execFile(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{windowsHide:true,timeout:45000,maxBuffer:2*1024*1024,encoding:'utf8'},(error,stdout,stderr)=>{
  let result;try{result=JSON.parse(stdout.trim().replace(/^\uFEFF/,''));}catch{reject(new Error(error?.killed?'İşlem zaman aşımına uğradı.':(stderr.trim()||'Windows sonucu okunamadı.')));return;}
  if(error||!result.success)reject(new Error(result.error||'Windows işlemi başarısız.'));else resolve(result.data);
 }));
}
class SettingsJournal {
 constructor(file){this.file=file;}
 read(){if(!fs.existsSync(this.file))return {};const value=JSON.parse(fs.readFileSync(this.file,'utf8'));if(!value||Array.isArray(value)||typeof value!=='object')throw Error('Ayar yedeği okunamadı. Dosyayı silmeden destek alın.');return value;}
 save(value){fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(tmp,this.file);}
 async apply(key,desired,read,write,equal){
  const journal=this.read(),existing=journal[key],before=await read();
  if(existing){if(!equal(before,existing.after))throw Error('Önceki işlem için bir yedek var ve mevcut ayar değişmiş. Otomatik üzerine yazılmadı.');if(equal(before,desired))return {changed:false};throw Error('Önce kayıtlı ayarı geri alın, sonra yeni seçim yapın.');}
  if(equal(before,desired))return {changed:false};
  journal[key]={before,after:desired,createdAt:new Date().toISOString(),status:'pending'};this.save(journal);
  try{await write(desired);if(!equal(await read(),desired))throw Error('Uygulanan ayar doğrulanamadı.');journal[key].status='applied';this.save(journal);return {changed:true};}
  catch(error){
   try{await write(before);if(!equal(await read(),before))throw Error('Geri alma doğrulanamadı.');delete journal[key];this.save(journal);}
   catch(rollback){throw Error(error.message+' Önceki ayar geri yüklenemedi; yedek korundu: '+rollback.message);}
   throw Error(error.message+' Önceki ayar geri yüklendi.');
  }
 }
 async restore(key,read,write,equal){
  const journal=this.read(),entry=journal[key];if(!entry)throw Error('Bu sürüm tarafından kaydedilmiş bir önceki ayar yok. Varsayılan değer tahmin edilmedi.');
  const current=await read();
  if(!equal(current,entry.before)&&!equal(current,entry.after))throw Error('Ayar başka bir uygulama veya kullanıcı tarafından değiştirilmiş. Üzerine yazılmadı.');
  if(!equal(current,entry.before)){await write(entry.before);if(!equal(await read(),entry.before))throw Error('Geri yükleme doğrulanamadı; yedek korundu.');}
  delete journal[key];this.save(journal);return {changed:true};
 }
}
const dnsEqual=(a,b)=>a.id===b.id&&a.manual===b.manual&&(!a.manual||JSON.stringify(a.servers)===JSON.stringify(b.servers));
const powerEqual=(a,b)=>a.active===b.active;
module.exports={runSystem,SettingsJournal,dnsEqual,powerEqual};
