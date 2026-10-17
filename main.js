'use strict';
const {app,BrowserWindow,ipcMain,Tray,Menu,nativeImage,dialog}=require('electron');
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const {setupUpdates}=require('./updater');
const {runSystem,SettingsJournal,dnsEqual,powerEqual}=require('./system-tools');
const {providers,validateTarget,summarize,benchmarkDns,httpsProbe}=require('./network-tools');
const {profiles}=require('./profiles');
let mainWindow,tray,dpiProcess=null,launcherBusy=false,toolBusy=false,isQuitting=false,token=0,launcherAbort=null;
const recentDiagnostics={};
if(!app.requestSingleInstanceLock()){app.quit();return;}
app.on('second-instance',()=>{mainWindow?.show();if(mainWindow?.isMinimized())mainWindow.restore();mainWindow?.focus();});
const send=(channel,value)=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send(channel,value);};
const scriptPath=()=>path.join(app.isPackaged?process.resourcesPath:__dirname,'system-scripts','system.ps1');
const system=(action,payload)=>runSystem(scriptPath(),action,payload);
const journal=()=>new SettingsJournal(path.join(app.getPath('userData'),'settings-backup-v1.json'));
function trusted(event){if(event.sender!==mainWindow?.webContents||event.senderFrame!==mainWindow.webContents.mainFrame)throw Error('Geçersiz uygulama isteği.');}
function handle(channel,fn){ipcMain.handle(channel,async(event,...args)=>{try{trusted(event);return await fn(event,...args);}catch(e){return {success:false,error:e.message};}});}
function createWindow(){
 mainWindow=new BrowserWindow({width:1160,height:800,minWidth:900,minHeight:680,frame:false,backgroundColor:'#f7f8fa',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 mainWindow.loadFile(path.join(__dirname,'index.html'));
 mainWindow.on('close',event=>{if(!isQuitting){event.preventDefault();mainWindow.hide();}});
 mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 mainWindow.webContents.on('will-navigate',event=>event.preventDefault());
}
async function killDPI(){const p=dpiProcess;if(!p)return;dpiProcess=null;if(p.exitCode!==null)return;await new Promise((resolve,reject)=>{const done=()=>{clearTimeout(timer);resolve();};const timer=setTimeout(()=>{p.removeListener('close',done);reject(Error('Önceki motor kapanmadı. Tekrar deneyin.'));},2500);p.once('close',done);p.kill();});}
function stopOnQuit(){token++;launcherAbort?.abort();if(dpiProcess){dpiProcess.kill();dpiProcess=null;}}
app.on('will-quit',stopOnQuit);
app.whenReady().then(()=>{
 createWindow();
 const {autoUpdater}=require('electron-updater');
 const updates=setupUpdates({app,ipcMain,authorize:trusted,updater:autoUpdater,configured:Boolean(require('./update-config.json').owner),send:state=>send('updates-event',state),canInstall:()=>!launcherBusy&&!toolBusy,beforeInstall:()=>{isQuitting=true;stopOnQuit();}});
 mainWindow.webContents.once('did-finish-load',()=>updates.check());
 const icon=nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsQAAA7EAZUrDhsAAAApSURBVDhPY3gro/iPgQhgAmKCw0xQDAyD1gChbDSMFgOhAoaBofYBAwAAB2AHA7fV9jAAAAAASUVORK5CYII=');
 tray=new Tray(icon);tray.setToolTip('Ata74');tray.setContextMenu(Menu.buildFromTemplate([{label:'Göster',click:()=>mainWindow.show()},{label:'Çıkış',click:()=>{isQuitting=true;app.quit();}}]));tray.on('click',()=>mainWindow.show());
 app.setAppUserModelId('com.roblox.locallauncher');
});
app.on('window-all-closed',()=>{if(isQuitting)app.quit();});
handle('get-username',()=>os.userInfo().username);
for(const [channel,action] of Object.entries({'close-app':()=>mainWindow.hide(),'window-minimize':()=>mainWindow.minimize(),'window-maximize':()=>mainWindow.isMaximized()?mainWindow.unmaximize():mainWindow.maximize()}))ipcMain.on(channel,event=>{try{trusted(event);action();}catch{}});
handle('stop-launcher',async()=>{token++;launcherAbort?.abort();await killDPI();send('launcher-state',{state:'idle'});return {success:true};});
handle('start-launcher',async(event,mode)=>{
 if(launcherBusy||toolBusy)return {success:false,error:'Önce devam eden işlemin bitmesini bekleyin.'};
 if(!Object.hasOwn(profiles,mode))throw Error('Geçersiz profil.');
 launcherBusy=true;launcherAbort=new AbortController();const attempt=++token;const cancelled=()=>attempt!==token;
 const core=path.join(app.isPackaged?process.resourcesPath:__dirname,'core');
 const logPath=path.join(app.getPath('userData'),'yurt-diagnostic.log');
 fs.mkdirSync(app.getPath('userData'),{recursive:true});
 const log=text=>{try{if(fs.existsSync(logPath)&&fs.statSync(logPath).size>1024*1024)fs.writeFileSync(logPath,'');fs.appendFileSync(logPath,new Date().toISOString()+' '+text+'\n');}catch{}};
 try{
  await killDPI();if(cancelled())return {success:false,cancelled:true};
  if(!fs.existsSync(path.join(core,'goodbyedpi.exe')))throw Error('GoodbyeDPI motoru bulunamadı.');
  const tasks=await new Promise((resolve,reject)=>cp.execFile('tasklist.exe',['/FI','IMAGENAME eq goodbyedpi.exe','/FO','CSV','/NH'],{windowsHide:true,timeout:5000},(e,out)=>e?reject(e):resolve(out)));
  if(/goodbyedpi.exe/i.test(tasks))throw Error('Başka GoodbyeDPI çalışıyor; önce onu kapatın.');
  for(const profile of profiles[mode]){
   if(cancelled())return {success:false,cancelled:true};await killDPI();if(cancelled())return {success:false,cancelled:true};
   send('launcher-progress',profile.name+': deneniyor...');log(profile.name);
   const p=cp.spawn(path.join(core,'goodbyedpi.exe'),profile.args,{cwd:core,windowsHide:true});dpiProcess=p;let launchError;
   p.on('error',e=>{launchError=e;});p.stdout.on('data',d=>log(d.toString().slice(0,2000)));p.stderr.on('data',d=>log(d.toString().slice(0,2000)));
   p.on('close',code=>{if(dpiProcess===p){dpiProcess=null;if(!launcherBusy)send('launcher-state',{state:'error',message:'Bağlantı motoru kapandı ('+code+'). Yeniden başlatabilirsiniz.'});}});
   await new Promise(r=>setTimeout(r,1000));if(cancelled())return {success:false,cancelled:true};
   if(launchError||p.exitCode!==null){log('Motor açılamadı');continue;}
   const checks=await Promise.all([httpsProbe('https://discord.com/api/v10/gateway',{signal:launcherAbort.signal}),httpsProbe('https://discord.com/app',{signal:launcherAbort.signal})]);
   if(cancelled())return {success:false,cancelled:true};
   const verified=checks.every(x=>x.ok)&&dpiProcess===p&&p.exitCode===null&&!launchError;
   if(verified||mode!=='yurt_auto'){
    if(dpiProcess!==p||p.exitCode!==null||launchError)continue;
    return {success:true,verified,profile:profile.name,message:verified?'Discord web ve API HTTPS erişimi doğrulandı. Ses bağlantısını ayrıca deneyin.':'Motor çalışıyor; Discord HTTPS erişimi doğrulanamadı.'};
   }
  }
  await killDPI();throw Error('Hiçbir profil Discord HTTPS erişimini doğrulayamadı. Yurt girişini ve ağ kurallarını kontrol edin.');
 }catch(e){await killDPI().catch(()=>{});if(cancelled())return {success:false,cancelled:true};throw e;}
 finally{launcherBusy=false;launcherAbort=null;}
});
async function confirm(message,detail){const r=await dialog.showMessageBox(mainWindow,{type:'question',buttons:['İptal','Uygula'],defaultId:0,cancelId:0,message,detail});if(r.response!==1)throw Error('İşlem iptal edildi.');}
handle('tool',async(event,action,payload={})=>{
 if(toolBusy||launcherBusy)throw Error('Önce devam eden işlemin bitmesini bekleyin.');
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Geçersiz istek.');
 toolBusy=true;
 try{
  switch(action){
   case 'adapters':return {success:true,data:await system('adapters'),backups:Object.keys(journal().read())};
   case 'ping':{const target=validateTarget(payload.target);const result=await system('ping',{target});recentDiagnostics.ping={target,...summarize(result.samples),measuredAt:new Date().toISOString()};return {success:true,data:recentDiagnostics.ping};}
   case 'https':return {success:true,data:await Promise.all([httpsProbe('https://discord.com/api/v10/gateway'),httpsProbe('https://discord.com/app'),httpsProbe('https://www.microsoft.com/')])};
   case 'dns-benchmark':if(dpiProcess)throw Error('DNS yönlendirmesinin ölçümü etkilememesi için önce bağlantı motorunu durdurun.');recentDiagnostics.dns=await benchmarkDns();return {success:true,data:recentDiagnostics.dns};
   case 'dns-apply':{
    if(dpiProcess)throw Error('DNS değiştirmeden önce bağlantı motorunu durdurun.');
    if(!Object.hasOwn(providers,payload.provider))throw Error('Geçersiz DNS sağlayıcısı.');
    const before=await system('dns-validate-adapter',{id:payload.id});
    await confirm(before.name+' için IPv4 DNS değiştirilsin mi?',providers[payload.provider].name+' uygulanacak. Yalnızca seçili kart değişir; IPv6, IP ve ağ geçidi korunur. Kurumsal/yurt içi adreslerin çözümü etkilenebilir. Önceki DNS atama türü ve adresler kaydedilecek.');
    const desired={id:before.id,manual:true,servers:providers[payload.provider].servers};
    const read=()=>system('dns-read',{id:before.id}),write=s=>system('dns-write',s);
    const result=await journal().apply('dns:'+before.id,desired,read,write,dnsEqual);
    return {success:true,message:result.changed?'DNS uygulandı ve Windows yapılandırması doğrulandı.':'Seçili DNS zaten uygulanmış.'};
   }
   case 'dns-restore':{
    if(dpiProcess)throw Error('Önce bağlantı motorunu durdurun.');
    await confirm('Kaydedilmiş önceki DNS geri yüklensin mi?','Yalnızca bu sürümün kaydettiği ayar geri yüklenir. Başka bir uygulamanın sonradan yaptığı değişikliğin üzerine yazılmaz.');
    await journal().restore('dns:'+payload.id,()=>system('dns-read',{id:payload.id}),s=>system('dns-write',s),dnsEqual);
    return {success:true,message:'Önceki DNS atama türü ve ayarlar geri yüklendi, doğrulandı.'};
   }
   case 'flush':return {success:true,data:await system('flush'),message:'DNS önbelleği temizlendi. Bu işlem ping hızlandırıcısı değildir.'};
   case 'power-read':return {success:true,data:await system('power-read'),backup:Boolean(journal().read().power)};
   case 'power-apply':{
    const state=await system('power-read');if(!state.plans.some(p=>p.id===payload.id))throw Error('Bu güç planı bilgisayarda bulunmuyor.');
    await confirm('Seçili güç planı uygulansın mı?','Yalnızca Windows güç planı değişir. Servis durdurulmaz, dosya silinmez. Yüksek performans planları ısı ve pil tüketimini artırabilir; FPS artışı garanti değildir.');
    const result=await journal().apply('power',{active:payload.id},async()=>({active:(await system('power-read')).active}),s=>system('power-write',s),powerEqual);
    return {success:true,message:result.changed?'Güç planı uygulandı ve doğrulandı.':'Bu güç planı zaten etkin.'};
   }
   case 'power-restore':await confirm('Önceki güç planı geri yüklensin mi?','Kayıtlı plan geri yüklenip doğrulanır. Sonradan değiştirilmiş ayarın üzerine yazılmaz.');await journal().restore('power',async()=>({active:(await system('power-read')).active}),s=>system('power-write',s),powerEqual);return {success:true,message:'Önceki güç planı geri yüklendi ve doğrulandı.'};
   case 'inspect':return {success:true,data:await system('inspect')};
   case 'export':{
    const result=await dialog.showSaveDialog(mainWindow,{defaultPath:'Ata74-tani-raporu.json',filters:[{name:'JSON',extensions:['json']}]});if(result.canceled)return {success:false,error:'Kaydetme iptal edildi.'};
    const data={version:app.getVersion(),createdAt:new Date().toISOString(),adapters:await system('adapters'),system:await system('inspect'),diagnostics:recentDiagnostics};
    fs.writeFileSync(result.filePath,JSON.stringify(data,null,2));return {success:true,message:'Rapor kaydedildi. Ağ kartı ve DNS bilgileri içerir; paylaşmadan önce inceleyin.'};
   }
   default:throw Error('Desteklenmeyen araç.');
  }
 }finally{toolBusy=false;}
});
