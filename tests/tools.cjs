'use strict';
const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {SettingsJournal,dnsEqual,powerEqual}=require('../system-tools');
const {summarize,median,validateTarget,benchmarkDns}=require('../network-tools');
async function main(){
 assert.deepEqual(Object.fromEntries(Object.entries(summarize([{ok:true,ms:10},{ok:true,ms:20},{ok:false},{ok:true,ms:30}])).filter(([k])=>k!=='samples')),{sent:4,received:3,lossPct:25,avg:20,min:10,max:30,jitter:10});
 assert.equal(summarize([{ok:false},{ok:false}]).avg,null);assert.equal(summarize([{ok:true,ms:10},{ok:false},{ok:true,ms:30}]).jitter,null);assert.equal(summarize([]).lossPct,null);assert.equal(median([1,4,2,3]),2.5);
 for(const t of ['1.1.1.1','discord.com','2001:4860:4860::8888'])assert.equal(validateTarget(t),t);
 for(const t of ['https://x.com','x;shutdown','a b','-n','bad..host','x\n.exe'])assert.throws(()=>validateTarget(t));
 const dns=await benchmarkDns(()=>({setServers(s){this.bad=s[0]==='8.8.8.8';},async resolve4(){if(this.bad)throw Object.assign(Error('Blocked'),{code:'ETIMEOUT'});return ['1.2.3.4'];},cancel(){}}));
 assert.equal(dns.rows.length,4);assert.equal(dns.rows.find(x=>x.id==='google').successes,0);assert.notEqual(dns.recommended,'google');assert(dns.rows.filter(x=>x.id!=='google').every(x=>x.successes===6));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ata74-journal-test-'));const file=path.join(dir,'journal.json');const journal=new SettingsJournal(file);
 let state={id:'adapter',manual:false,servers:['192.168.1.1']};const initial=structuredClone(state),desired={id:'adapter',manual:true,servers:['1.1.1.1','1.0.0.1']};
 const read=async()=>structuredClone(state);let writes=0;const write=async s=>{assert(fs.existsSync(file),'Backup must exist before mutation');writes++;state=structuredClone(s);};
 await journal.apply('dns:adapter',desired,read,write,dnsEqual);assert(dnsEqual(state,desired));assert.deepEqual(journal.read()['dns:adapter'].before,initial);
 await journal.apply('dns:adapter',desired,read,write,dnsEqual);assert.equal(writes,1);
 await assert.rejects(()=>journal.apply('dns:adapter',{...desired,servers:['9.9.9.9']},read,write,dnsEqual),/Önce/);
 state={...desired,servers:['8.8.8.8']};await assert.rejects(()=>journal.restore('dns:adapter',read,write,dnsEqual),/başka/);assert.equal(writes,1);
 state=structuredClone(desired);await journal.restore('dns:adapter',read,write,dnsEqual);assert(dnsEqual(state,initial));assert.deepEqual(journal.read(),{});
 await assert.rejects(()=>journal.restore('dns:adapter',read,write,dnsEqual),/önceki ayar yok/);
 let fail=true;const failOnce=async s=>{if(fail){fail=false;throw Error('Device refused');}state=structuredClone(s);};
 await assert.rejects(()=>journal.apply('dns:adapter',desired,read,failOnce,dnsEqual),/Önceki ayar geri yüklendi/);assert(dnsEqual(state,initial));assert.deepEqual(journal.read(),{});
 await assert.rejects(()=>journal.apply('dns:adapter',desired,read,async()=>{},dnsEqual),/doğrulanamadı/);assert.deepEqual(journal.read(),{});
 await assert.rejects(()=>journal.apply('dns:adapter',desired,read,async()=>{throw Error('persistent failure')},dnsEqual),/yedek korundu/);assert(journal.read()['dns:adapter']);
 state=structuredClone(desired);await journal.restore('dns:adapter',read,write,dnsEqual);
 let power={active:'custom-original'};await journal.apply('power',{active:'selected'},async()=>power,async s=>{power=s},powerEqual);await journal.restore('power',async()=>power,async s=>{power=s},powerEqual);assert.equal(power.active,'custom-original');
 fs.writeFileSync(file,'broken json');assert.throws(()=>journal.read());assert.equal(fs.readFileSync(file,'utf8'),'broken json');
 // Remove only this test's known file and directory, without recursive deletion.
 fs.unlinkSync(file);fs.rmdirSync(dir);
 console.log('PASS: RTT/loss/variation math, input validation, actual-query DNS selection, pre-write backups, exact restore, no-op, external conflicts, rollback, recovery retention and corrupt journal');
}
main().catch(e=>{console.error(e);process.exitCode=1});
