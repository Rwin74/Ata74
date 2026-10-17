const {EventEmitter}=require('events');const assert=require('assert');
const {setupUpdates}=require('../updater');
function fixture(configured=true){const updater=new EventEmitter(),h={};let downloads=0,installs=0,cleanups=0,allow=true;updater.checkForUpdates=async()=>{updater.emit('checking-for-update');updater.emit('update-available',{version:'1.2.1'})};updater.downloadUpdate=async()=>{downloads++;updater.emit('download-progress',{percent:50});updater.emit('update-downloaded',{version:'1.2.1'})};updater.quitAndInstall=()=>installs++;const api=setupUpdates({app:{isPackaged:true,getVersion:()=> '1.2.0'},ipcMain:{handle:(k,v)=>h[k]=v},updater,send(){},configured,canInstall:()=>allow,beforeInstall:()=>cleanups++});return {h,updater,api,counts:()=>({downloads,installs,cleanups}),deny:()=>allow=false};}
(async()=>{
 let f=fixture();assert.equal(f.updater.autoDownload,false);assert.equal(f.updater.autoInstallOnAppQuit,false);
 await f.h['updates-download']();assert.equal(f.counts().downloads,0);
 await f.api.check();assert.equal(f.api.getState().status,'available');assert.equal(f.counts().downloads,0);
 await f.h['updates-download']();assert.equal(f.api.getState().status,'downloaded');assert.equal(f.counts().downloads,1);
 assert(f.h['updates-install']().success);assert.equal(f.h['updates-install']().success,false);await new Promise(setImmediate);assert.deepEqual(f.counts(),{downloads:1,installs:1,cleanups:1});
 f=fixture();await f.api.check();await f.h['updates-download']();f.deny();assert.equal(f.h['updates-install']().success,false);
 f=fixture(false);await f.api.check();assert.equal(f.api.getState().status,'unconfigured');
 f=fixture();f.updater.checkForUpdates=async()=>{throw Error('offline')};await f.api.check();assert.equal(f.api.getState().status,'error');
 f=fixture();await f.api.check();f.updater.downloadUpdate=async()=>{throw Error('checksum mismatch')};await f.h['updates-download']();assert.equal(f.api.getState().status,'error');assert.equal(f.h['updates-install']().success,false);
 f=fixture();f.updater.checkForUpdates=async()=>f.updater.emit('update-not-available');await f.api.check();assert.equal(f.api.getState().status,'current');
 console.log('PASS: consent, progress, install, cleanup, busy guard, missing config, offline, failed download and current version');
})().catch(e=>{console.error(e);process.exitCode=1});


