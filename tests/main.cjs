'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm'),assert=require('assert/strict'),{EventEmitter}=require('events');
async function main(){
 const root=path.join(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ata74-ipc-')),handlers={},events={},messages=[];let win,confirmResponse=0,writes=0;
 let dns={id:'adapter',manual:false,servers:['192.168.1.1'],name:'Test Wi-Fi'},power={active:'original'};
 const app={requestSingleInstanceLock:()=>true,on(){},whenReady:()=>Promise.resolve(),getPath:()=>dir,getVersion:()=> '1.4.0',setAppUserModelId(){},quit(){},isPackaged:false};
 class Window{constructor(){win=this;this.webContents={mainFrame:{},send:(c,v)=>messages.push([c,v]),setWindowOpenHandler(){},on(){},once(){}};}loadFile(){}on(){}isDestroyed(){return false}hide(){}show(){}isMaximized(){return false}maximize(){}minimize(){}}
 const electron={app,BrowserWindow:Window,ipcMain:{handle:(c,f)=>handlers[c]=f,on:(c,f)=>events[c]=f},Tray:class{setToolTip(){}setContextMenu(){}on(){}},Menu:{buildFromTemplate:x=>x},nativeImage:{createFromDataURL:()=>({})},dialog:{showMessageBox:async()=>({response:confirmResponse})}};
 async function system(_path,action,payload){switch(action){case 'dns-validate-adapter':case 'dns-read':return structuredClone(dns);case 'dns-write':writes++;dns={...dns,...payload};return dns;case 'power-read':return {...power,plans:[{id:'original',name:'Original'},{id:'selected',name:'Selected'}]};case 'power-write':writes++;power=payload;return power;case 'adapters':return [{...dns,physical:true,status:'Up'}];case 'ping':return {samples:[{ok:true,ms:15},{ok:false}]};case 'flush':return {};default:throw Error('Unexpected command '+action)}}
 const cp={execFile:(_exe,_args,_opts,cb)=>cb(null,''),spawn(){const p=new EventEmitter();p.stdout=new EventEmitter();p.stderr=new EventEmitter();p.exitCode=null;p.kill=()=>{p.exitCode=0;queueMicrotask(()=>p.emit('close',0));};return p;}};
 const tools=require('../system-tools'),network=require('../network-tools');
 const context={require(id){if(id==='electron')return electron;if(id==='electron-updater')return {autoUpdater:{}};if(id==='child_process')return cp;if(id==='./updater')return {setupUpdates:()=>({check(){}})};if(id==='./system-tools')return {...tools,runSystem:system};if(id==='./network-tools')return {...network,httpsProbe:async()=>({ok:false,error:'blocked'})};if(id.startsWith('./'))return require(path.join(root,id));return require(id)},__dirname:root,process:{resourcesPath:root},console,AbortController,setTimeout(fn,ms){if(ms===1000){queueMicrotask(fn);return 0;}return setTimeout(fn,ms)},clearTimeout};
 vm.runInNewContext('(function(){'+fs.readFileSync(path.join(root,'main.js'),'utf8')+'\n})()',context);await new Promise(setImmediate);
 const event={sender:win.webContents,senderFrame:win.webContents.mainFrame};
 assert.equal((await handlers['shutdown-schedule'](event,0)).success,false);
 assert.equal((await handlers['shutdown-schedule'](event,60)).success,false);
 assert.equal((await handlers['shutdown-state'](event)).data.status,'idle');
 assert.equal((await handlers.tool({sender:{},senderFrame:{}},'flush',{})).success,false);
 assert.equal((await handlers.tool(event,'dns-apply',{id:'adapter',provider:'cloudflare'})).success,false);assert.equal(writes,0,'Cancelled dialog must not mutate');
 confirmResponse=1;assert((await handlers['shutdown-schedule'](event,60)).success);assert.equal((await handlers['shutdown-state'](event)).data.status,'scheduled');assert.equal((await handlers['shutdown-cancel'](event)).data.status,'cancelled');
 assert.equal((await handlers.tool(event,'dns-apply',{id:'adapter',provider:'evil'})).success,false);assert.equal(writes,0);
 assert((await handlers.tool(event,'dns-apply',{id:'adapter',provider:'cloudflare'})).success);assert.equal(dns.manual,true);assert.deepEqual(dns.servers,['1.1.1.1','1.0.0.1']);
 assert((await handlers.tool(event,'dns-restore',{id:'adapter'})).success);assert.equal(dns.manual,false);
 assert((await handlers.tool(event,'power-apply',{id:'selected'})).success);assert.equal(power.active,'selected');assert((await handlers.tool(event,'power-restore')).success);assert.equal(power.active,'original');
 assert.equal((await handlers.tool(event,'removed-unsafe-tool')).success,false);
 const ping=await handlers.tool(event,'ping',{target:'1.1.1.1'});assert.equal(ping.data.lossPct,50);
 const bad=await handlers.tool(event,'ping',{target:'x;shutdown'});assert.equal(bad.success,false);
 const launch=await handlers['start-launcher'](event,'default');assert(launch.success);assert.equal(launch.verified,false,'Motor startup alone must not prove HTTPS');
 assert.equal((await handlers.tool(event,'dns-benchmark')).success,false,'DNS measurement requires stopped DPI');
 assert((await handlers['stop-launcher'](event)).success);
 assert.equal((await handlers['start-launcher'](event,'nonexistent')).success,false);
 const source=fs.readFileSync(path.join(root,'main.js'),'utf8')+fs.readFileSync(path.join(root,'system-scripts/system.ps1'),'utf8');assert(!/Stop-Service|Set-Service|NtSetTimerResolution|NtSetSystemInformation|MSISupported|Set-NetAdapterAdvancedProperty|Remove-Item\s+-Path/.test(source),'Removed performance mutations must stay removed');
 for(const f of fs.readdirSync(dir)){fs.unlinkSync(path.join(dir,f));}fs.rmdirSync(dir);
 console.log('PASS: main IPC trust, confirmation cancellation, DNS provider validation, real journal routing, DNS/power restoration, ping routing, DPI/DNS exclusion and honest HTTPS state');
}
main().catch(e=>{console.error(e);process.exitCode=1});
