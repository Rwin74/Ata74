'use strict';
const assert=require('assert/strict'),crypto=require('crypto'),fs=require('fs'),os=require('os'),path=require('path');const {verifyManifest,matchUpdateInfo,verifyArtifact,readReleaseAsset,newer}=require('../update-security');
(async()=>{
 const keys=crypto.generateKeyPairSync('ed25519'),other=crypto.generateKeyPairSync('ed25519');const body=Buffer.from('test installer bytes');const m={schema:1,version:'1.5.1',platform:'win32',arch:'x64',asset:'Ata74-Setup-1.5.1.exe',size:body.length,sha512:crypto.createHash('sha512').update(body).digest('base64')};const bytes=Buffer.from(JSON.stringify(m)),sig=crypto.sign(null,bytes,keys.privateKey).toString('base64');
 const verified=verifyManifest(bytes,sig,keys.publicKey,'1.5.1','1.5.0');assert.equal(verified.version,m.version);assert(Object.isFrozen(verified));
 assert.throws(()=>verifyManifest(Buffer.from(JSON.stringify({...m,size:1})),sig,keys.publicKey,'1.5.1','1.5.0'));assert.throws(()=>verifyManifest(bytes,sig,other.publicKey,'1.5.1','1.5.0'));assert.throws(()=>verifyManifest(bytes,sig,keys.publicKey,'1.5.1','1.5.2'));assert.throws(()=>verifyManifest(bytes,sig,keys.publicKey,'1.5.2','1.5.0'));assert(!newer('1.5.0','1.5.0'));
 const invalid={...m,asset:'../../payload.exe'},badBytes=Buffer.from(JSON.stringify(invalid)),badSig=crypto.sign(null,badBytes,keys.privateKey).toString('base64');assert.throws(()=>verifyManifest(badBytes,badSig,keys.publicKey,'1.5.1','1.5.0'));
 const info={version:m.version,files:[{url:m.asset,size:m.size,sha512:m.sha512}]};matchUpdateInfo(info,m);assert.throws(()=>matchUpdateInfo({...info,packages:{}},m));assert.throws(()=>matchUpdateInfo({...info,files:[{...info.files[0],sha512:'bad'}]},m));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ata74-sign-test-')),file=path.join(dir,'update.exe');fs.writeFileSync(file,body);await verifyArtifact(file,m);fs.writeFileSync(file,Buffer.alloc(body.length,2));await assert.rejects(()=>verifyArtifact(file,m));fs.unlinkSync(file);fs.rmdirSync(dir);
 let called=false;await assert.rejects(()=>readReleaseAsset('http://github.com/x',()=>{called=true}));assert.equal(called,false);
 await assert.rejects(()=>readReleaseAsset('https://github.com/x',async()=>new Response(null,{status:302,headers:{location:'https://evil.invalid/file'}})));
 await assert.rejects(()=>readReleaseAsset('https://github.com/x',async()=>new Response(Buffer.alloc(17000),{status:200})));
 const result=await readReleaseAsset('https://github.com/x',async()=>new Response('ok',{status:200}));assert.equal(result.toString(),'ok');
 console.log('PASS: real Ed25519 signatures, wrong-key/tamper/replay rejection, manifest matching, EXE hashing and HTTPS redirect/size limits');
})().catch(e=>{console.error(e);process.exitCode=1});
