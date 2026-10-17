'use strict';
const {Worker}=require('worker_threads');
class StorageScanner{
 constructor(workerFile,onProgress=()=>{}){this.workerFile=workerFile;this.onProgress=onProgress;this.job=null;}
 get active(){return Boolean(this.job);}
 async start(root){
  if(this.job)throw Error('Bir tarama zaten sürüyor.');
  return new Promise((resolve,reject)=>{
   const worker=new Worker(this.workerFile,{workerData:{root}});const job={worker,resolve,reject};this.job=job;
   const finish=(err,data)=>{if(this.job!==job)return;this.job=null;worker.terminate().catch(()=>{});err?reject(err):resolve(data);};
   worker.on('message',message=>{if(this.job!==job)return;if(message.type==='progress')this.onProgress(message.data);else if(message.type==='result')finish(null,message.data);else if(message.type==='error')finish(Error(message.message));});
   worker.on('error',error=>finish(error));worker.on('exit',code=>{if(this.job===job)finish(Error('Tarama işlemi beklenmeden kapandı ('+code+').'));});
  });
 }
 cancel(){const job=this.job;if(!job)return false;this.job=null;job.worker.terminate().catch(()=>{});job.resolve({cancelled:true});return true;}
}
class ShutdownTimer{
 constructor({execute,onChange=()=>{},now=Date.now,setTicker=setInterval,clearTicker=clearInterval}={}){this.execute=execute;this.onChange=onChange;this.now=now;this.setTicker=setTicker;this.clearTicker=clearTicker;this.timer=null;this.state={status:'idle',message:'Kapatma planlanmadı.'};}
 get active(){return this.state.status==='scheduled';}
 getState(){return {...this.state,remainingSeconds:this.active?Math.max(0,Math.ceil((this.state.dueAt-this.now())/1000)):0};}
 publish(state){this.state=state;this.onChange(this.getState());}
 schedule(minutes){if(!Number.isInteger(minutes)||minutes<1||minutes>1440)throw Error('1–1440 arasında tam dakika girin.');if(this.active)throw Error('Önce mevcut zamanlayıcıyı iptal edin.');const time=this.now();this.lastTick=time;this.publish({status:'scheduled',dueAt:time+minutes*60000,message:'Uygulama açık/tepside olduğu sürece geri sayım sürer.'});this.timer=this.setTicker(()=>this.tick(),1000);this.timer.unref?.();return this.getState();}
 async tick(){if(!this.active)return;const now=this.now(),gap=now-this.lastTick;this.lastTick=now;
  if(gap>15000||gap<0){this.cancel('Uyku, saat değişikliği veya uzun duraklama nedeniyle zamanlayıcı iptal edildi.');return;}
  if(now<this.state.dueAt){this.onChange(this.getState());return;}
  this.clearTicker(this.timer);this.timer=null;this.publish({status:'sending',message:'Windows’a normal kapatma isteği gönderiliyor...'});
  try{await this.execute();this.publish({status:'sent',message:'Kapatma isteği gönderildi. Kaydedilmemiş işler Windows tarafından kapatmayı engelleyebilir.'});}catch(error){this.publish({status:'error',message:'Kapatma isteği gönderilemedi: '+error.message});}
 }
 cancel(message='Kapatma zamanlayıcısı iptal edildi.'){if(!this.active)return this.getState();if(this.timer)this.clearTicker(this.timer);this.timer=null;this.publish({status:'cancelled',message});return this.getState();}
 dispose(){this.cancel('Uygulama kapandığı için zamanlayıcı iptal edildi.');}
}
module.exports={StorageScanner,ShutdownTimer};
