'use strict';
const {Resolver}=require('dns').promises;const {performance}=require('perf_hooks');const net=require('net');const https=require('https');
const providers={cloudflare:{name:'Cloudflare',servers:['1.1.1.1','1.0.0.1']},google:{name:'Google',servers:['8.8.8.8','8.8.4.4']},quad9:{name:'Quad9',servers:['9.9.9.9','149.112.112.112']},opendns:{name:'OpenDNS',servers:['208.67.222.222','208.67.220.220']}};
function validateTarget(value){if(typeof value!=='string'||value.length>253||value.includes('://'))throw Error('Yalnızca IP adresi veya alan adı girin.');if(net.isIP(value))return value;if(!value||value.split('.').some(x=>!x||x.length>63||!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(x)))throw Error('Geçersiz hedef.');return value;}
const round=x=>Math.round(x*10)/10;
function summarize(samples){const valid=samples.filter(x=>x.ok&&Number.isFinite(x.ms));let diffs=[];for(let i=1;i<samples.length;i++)if(samples[i].ok&&samples[i-1].ok)diffs.push(Math.abs(samples[i].ms-samples[i-1].ms));const values=valid.map(x=>x.ms);return {sent:samples.length,received:valid.length,lossPct:samples.length?round(100*(samples.length-valid.length)/samples.length):null,avg:values.length?round(values.reduce((a,b)=>a+b,0)/values.length):null,min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null,jitter:diffs.length?round(diffs.reduce((a,b)=>a+b,0)/diffs.length):null,samples};}
function median(values){const a=[...values].sort((a,b)=>a-b);if(!a.length)return null;return round(a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2);}
async function benchmarkDns(makeResolver=()=>new Resolver({timeout:1500,tries:1})){
 const domains=['discord.com','www.microsoft.com','github.com'];
 const rows=await Promise.all(Object.entries(providers).map(async([id,provider])=>{
  const resolver=makeResolver();resolver.setServers([provider.servers[0]]);const times=[],errors=[];
  for(let roundIndex=0;roundIndex<2;roundIndex++)for(const domain of domains){
   let timer;const start=performance.now();try{
    const result=await Promise.race([resolver.resolve4(domain),new Promise((_,reject)=>{timer=setTimeout(()=>{resolver.cancel();reject(Error('ETIMEDOUT'));},2200);})]);
    if(!result?.length)throw Error('EMPTY');times.push(performance.now()-start);
   }catch(e){errors.push(e.code||e.message);}finally{clearTimeout(timer);}
  }
  return {id,name:provider.name,server:provider.servers[0],successes:times.length,total:6,median:median(times),errors};
 }));
 const complete=rows.filter(x=>x.successes===x.total).sort((a,b)=>a.median-b.median);
 return {rows,recommended:complete[0]?.id||null,measuredAt:new Date().toISOString()};
}
function httpsProbe(url,options={}){return new Promise(resolve=>{const start=performance.now();let done=false,timer;const finish=result=>{if(!done){done=true;clearTimeout(timer);resolve({url,...result});}};const req=https.get(url,{agent:false,signal:options.signal},res=>{res.resume();finish({ok:res.statusCode>=200&&res.statusCode<300,status:res.statusCode,ms:round(performance.now()-start)});});timer=setTimeout(()=>{finish({ok:false,error:'Zaman aşımı'});req.destroy();},6000);req.on('error',e=>finish({ok:false,error:e.code||'Bağlantı hatası'}));});}
module.exports={providers,validateTarget,summarize,median,benchmarkDns,httpsProbe};
