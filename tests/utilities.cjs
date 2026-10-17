'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');const {analyzeFolder}=require('../storage-worker');const {StorageScanner,ShutdownTimer}=require('../utilities');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ata74-storage-test-')),root=path.join(dir,'root'),outside=path.join(dir,'outside');fs.mkdirSync(root);fs.mkdirSync(outside);fs.mkdirSync(path.join(root,'nested'));fs.writeFileSync(path.join(root,'small.txt'),Buffer.alloc(10));fs.writeFileSync(path.join(root,'nested','large.bin'),Buffer.alloc(100));fs.writeFileSync(path.join(outside,'hidden.bin'),Buffer.alloc(1000));
 const link=path.join(root,'outside-link');fs.symlinkSync(outside,link,process.platform==='win32'?'junction':'dir');
 let result=await analyzeFolder(root);assert.equal(result.files,2);assert.equal(result.bytes,110);assert.equal(result.links,1);assert.equal(result.largest[0].bytes,100);assert.equal(result.partial,false);assert.equal(fs.statSync(path.join(outside,'hidden.bin')).size,1000);
 result=await analyzeFolder(root,{maxEntries:1});assert.equal(result.partial,true);
 const scanner=new StorageScanner(path.join(__dirname,'../storage-worker.js'));result=await scanner.start(root);assert.equal(result.bytes,110);const pending=scanner.start(root);assert(scanner.cancel());assert((await pending).cancelled);
 fs.unlinkSync(link);fs.unlinkSync(path.join(root,'small.txt'));fs.unlinkSync(path.join(root,'nested','large.bin'));fs.unlinkSync(path.join(outside,'hidden.bin'));fs.rmdirSync(path.join(root,'nested'));fs.rmdirSync(root);fs.rmdirSync(outside);fs.rmdirSync(dir);
 let time=0,calls=0;const timer=new ShutdownTimer({execute:async()=>calls++,now:()=>time,setTicker:()=>({unref(){}}),clearTicker(){}});
 assert.throws(()=>timer.schedule(0));assert.throws(()=>timer.schedule(1.5));timer.schedule(1);assert.throws(()=>timer.schedule(2));assert.equal(timer.getState().remainingSeconds,60);timer.cancel();time=60000;await timer.tick();assert.equal(calls,0);
 timer.schedule(1);time+=16000;await timer.tick();assert.equal(timer.getState().status,'cancelled');assert.equal(calls,0);
 timer.schedule(1);for(let i=0;i<60;i++){time+=1000;await timer.tick();}assert.equal(calls,1);assert.equal(timer.getState().status,'sent');await timer.tick();assert.equal(calls,1);
 timer.schedule(1);timer.dispose();assert.equal(timer.active,false);
 console.log('PASS: storage totals, junction exclusion, partial results, worker completion/cancellation, timer validation/cancellation/sleep handling and exactly-once shutdown using a mock executor');
})().catch(e=>{console.error(e);process.exitCode=1});
