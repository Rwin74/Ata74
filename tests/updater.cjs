'use strict';
const {EventEmitter}=require('events'),assert=require('assert/strict');const {setupUpdates}=require('../updater');
function fixture(){const updater=new EventEmitter(),h={};let downloads=0,installs=0,cleanups=0,allow=true,verifications=0,failVerify=false;
 const manifest={schema:1,version:'1.5.1',platform:'win32',arch:'x64',asset:'Ata74-Setup-1.5.1.exe',size:10,sha512:Buffer.alloc(64,1).toString('base64')};const info={version:manifest.version,files:[{url:manifest.asset,size:10,sha512:manifest.sha512}]};
 updater.checkForUpdates=async()=>{updater.emit('checking-for-update');updater.emit('update-available',info);return {updateInfo:info};};
 updater.downloadUpdate=async()=>{downloads++;updater.emit('download-progress',{percent:50});updater.emit('update-downloaded',{version:manifest.version,downloadedFile:'C:/cache/update.exe'});return ['C:/cache/update.exe'];};updater.quitAndInstall=()=>installs++;
 const api=setupUpdates({app:{isPackaged:true,getVersion:()=> '1.5.0'},ipcMain:{handle:(k,v)=>h[k]=v},updater,send(){},configured:true,canInstall:()=>allow,beforeInstall:()=>cleanups++,verifyRelease:async()=>manifest,verifyArtifact:async()=>{verifications++;if(failVerify)throw Error('Tampered installer');},createCancellationToken:()=>({cancelled:false,cancel(){this.cancelled=true;this.onCancel?.();}})});
 return {h,updater,api,manifest,info,counts:()=>({downloads,installs,cleanups,verifications}),deny:()=>allow=false,tamper:()=>failVerify=true};}
(async()=>{
 let f=fixture();assert.equal(f.updater.autoDownload,false);assert.equal(f.updater.autoInstallOnAppQuit,false);await f.h['updates-download']();assert.equal(f.counts().downloads,0);
 await f.api.check();assert.equal(f.api.getState().status,'available');assert.equal(f.counts().downloads,0);
 await f.h['updates-download']();assert.equal(f.api.getState().status,'downloaded');assert.equal(f.counts().verifications,1);
 assert((await f.h['updates-install']()).success);assert.equal((await f.h['updates-install']()).success,false);await new Promise(setImmediate);assert.deepEqual(f.counts(),{downloads:1,installs:1,cleanups:1,verifications:2});
 f=fixture();await f.api.check();await f.h['updates-download']();f.deny();assert.equal((await f.h['updates-install']()).success,false);
 f=fixture();await f.api.check();f.tamper();await f.h['updates-download']();assert.equal(f.api.getState().status,'error');assert.equal((await f.h['updates-install']()).success,false);assert.equal(f.counts().installs,0);
 f=fixture();await f.api.check();await f.h['updates-download']();f.tamper();assert.equal((await f.h['updates-install']()).success,false);assert.equal(f.counts().installs,0);
 f=fixture();f.info.files[0].url='https://evil.invalid/payload.exe';await f.api.check();assert.equal(f.api.getState().status,'error');await f.h['updates-download']();assert.equal(f.counts().downloads,0);
 f=fixture();f.updater.downloadUpdate=async()=>['C:/cache/update.exe'];await f.api.check();await f.h['updates-download']();assert.equal(f.api.getState().status,'error');
 f=fixture();f.updater.checkForUpdates=async()=>{throw Error('offline')};await f.api.check();assert.equal(f.api.getState().status,'error');
 f=fixture();f.updater.checkForUpdates=async()=>{f.updater.emit('update-not-available');return {updateInfo:{}}};await f.api.check();assert.equal(f.api.getState().status,'current');
 f=fixture();await f.api.check();f.updater.downloadUpdate=token=>new Promise((_,reject)=>token.onCancel=()=>reject(Error('cancelled')));const pending=f.h['updates-download']();f.h['updates-cancel']();await pending;assert.equal(f.api.getState().status,'available');assert.equal(f.counts().installs,0);
 console.log('PASS: signed metadata gating, consent, download validation, install-time rehash, double install, tamper rejection, unknown artifacts, offline errors and cancellation');
})().catch(e=>{console.error(e);process.exitCode=1});
