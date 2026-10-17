'use strict';
const {loadSignedRelease,matchUpdateInfo,verifyArtifact:verifyFile}=require('./update-security');
function setupUpdates({app,ipcMain,updater,send,beforeInstall,canInstall,configured,authorize=()=>{},onInstallError=()=>{},verifyRelease=version=>loadSignedRelease(version,app.getVersion()),verifyArtifact=verifyFile,createCancellationToken=()=>new(require('electron-updater').CancellationToken)()}){
 let state={status:'idle',version:app.getVersion(),message:'Güncelleme kontrolü hazır.'};
 let busy=false,installing=false,manifest=null,verified=null,releaseTask=null,downloadedInfo=null,cancellation=null,generation=0;
 const publish=patch=>{state={...state,...patch,canCancel:Boolean(cancellation&&!installing&&['downloading','verifying','cancelling'].includes(patch.status||state.status))};send(state);};
 const fail=error=>{generation++;manifest=null;verified=null;installing=false;onInstallError();publish({status:'error',message:error?.message||'Güncelleme doğrulanamadı. Kurulum engellendi.'});};
 updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;
 updater.on('checking-for-update',()=>publish({status:'checking',message:'Güncelleme kontrol ediliyor...'}));
 updater.on('update-available',info=>{
  publish({status:'verifying',message:'Yeni sürümün yayıncı imzası kontrol ediliyor...'});
  const request=++generation;manifest=null;verified=null;
  releaseTask=(async()=>{try{const signed=await verifyRelease(info.version);matchUpdateInfo(info,signed);if(request!==generation)return;manifest=signed;publish({status:'available',nextVersion:signed.version,message:`İmzalı sürüm ${signed.version} hazır. İndirmek için tıkla.`});}catch(error){if(request===generation)fail(error);}})();
 });
 updater.on('update-not-available',()=>{manifest=null;verified=null;publish({status:'current',message:'En güncel sürüm kullanılıyor.'});});
 updater.on('download-progress',info=>{if(state.status==='downloading')publish({percent:Math.max(0,Math.min(100,Math.round(info.percent))),message:`Güncelleme indiriliyor: %${Math.round(info.percent)}`});});
 updater.on('update-downloaded',info=>{downloadedInfo=info;publish({status:'verifying',message:'İndirilen dosya imzalı özetle karşılaştırılıyor...'});});
 updater.on('error',error=>{if(cancellation?.cancelled)return;fail(Error(error?.code==='ERR_UPDATER_INVALID_SIGNATURE'?'Windows yayıncı imzası geçersiz.':error?.code?.includes('CHECKSUM')?'Dosya bütünlüğü doğrulanamadı.': 'Güncelleme işlemi başarısız. Tekrar kontrol edebilirsiniz.'));});
 async function check(){
  if(busy||installing||['downloaded','downloading','verifying','cancelling'].includes(state.status))return state;
  if(!configured||!app.isPackaged){publish({status:'unconfigured',message:configured?'Güncelleme kontrolü kurulu uygulamada çalışır.':'GitHub güncelleme deposu ayarlanmamış.'});return state;}
  busy=true;manifest=null;verified=null;releaseTask=null;
  try{const result=await updater.checkForUpdates();if(releaseTask)await releaseTask;if(result===null&&state.status==='checking')fail(Error('Güncelleme bu kurulumda kontrol edilemedi.'));}
  catch(error){fail(Error('Güncelleme kontrol edilemedi. İnternet bağlantısını kontrol edip tekrar deneyin.'));}
  finally{busy=false;}return state;
 }
 ipcMain.handle('updates-state',event=>{authorize(event);return state;});
 ipcMain.handle('updates-check',event=>{authorize(event);return check();});
 ipcMain.handle('updates-download',async event=>{
  authorize(event);if(busy||installing||state.status!=='available'||!manifest)return state;
  busy=true;verified=null;downloadedInfo=null;cancellation=createCancellationToken();const expected=manifest,request=generation;
  publish({status:'downloading',percent:0,message:'İndirme başlıyor...'});
  try{
   const files=await updater.downloadUpdate(cancellation);
   if(cancellation.cancelled||request!==generation)throw Error('İndirme iptal edildi.');
   if(!downloadedInfo||downloadedInfo.version!==expected.version||!Array.isArray(files)||files.length!==1||files[0]!==downloadedInfo.downloadedFile)throw Error('İndirilen paket bilgileri doğrulanamadı.');
   await verifyArtifact(files[0],expected);
   if(cancellation.cancelled||request!==generation)throw Error('İndirme iptal edildi.');
   verified={file:files[0],manifest:expected};publish({status:'downloaded',message:'Yayıncı imzası ve dosya özeti doğrulandı. Kur ve yeniden başlat ile güncelle.'});
  }catch(error){if(cancellation.cancelled){verified=null;manifest=expected;publish({status:'available',message:'İndirme iptal edildi. İstersen yeniden indirebilirsin.'});}else fail(Error(error.message||'İndirme doğrulanamadı. Kurulum engellendi.'));}
  finally{busy=false;cancellation=null;}return state;
 });
 ipcMain.handle('updates-cancel',event=>{authorize(event);if(cancellation&&!installing){generation++;cancellation.cancel();publish({status:'cancelling',message:'İndirme iptal ediliyor...'});}return state;});
 ipcMain.handle('updates-install',async event=>{
  authorize(event);if(busy||installing)return {success:false,message:'Başka bir güncelleme işlemi sürüyor.'};
  if(state.status!=='downloaded'||!verified)return {success:false,message:'Önce imzası doğrulanmış güncellemeyi indirin.'};
  if(!canInstall())return {success:false,message:'Önce devam eden işlemi veya kapatma zamanlayıcısını tamamlayın/iptal edin.'};
  installing=true;const record=verified,request=generation;
  publish({status:'verifying',message:'Kurulum öncesi dosya yeniden doğrulanıyor...'});
  try{
   await verifyArtifact(record.file,record.manifest);
   if(request!==generation||!canInstall())throw Error('Devam eden işlem nedeniyle kurulum başlatılamadı.');
   publish({status:'installing',message:'Doğrulandı. Kurulum başlatılıyor...'});
   setImmediate(()=>{try{if(!canInstall())throw Error('Başka bir işlem sürüyor.');beforeInstall();updater.quitAndInstall(false,true);}catch(error){installing=false;onInstallError();publish({status:'downloaded',message:'Kurulum başlatılamadı. Tekrar deneyebilirsiniz.'});}});
   return {success:true};
  }catch(error){fail(Error(error.message||'Kurulum öncesi doğrulama başarısız.'));return {success:false,message:state.message};}
 });
 return {check,getState:()=>state};
}
module.exports={setupUpdates};
